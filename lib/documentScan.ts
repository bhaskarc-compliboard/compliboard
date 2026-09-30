/**
 * THE DOCUMENT SCAN — Documents Run 1, the open baseline.
 *
 * One document, one open model call, and everything it found written down. This is the contract
 * three later sections read: Audits checks evidence that lives in documents, the Calendar takes
 * its dates from permits and certificates, HR reads handbooks and records.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS NOT. It is not a replacement for `lib/documentReview.ts`, and nothing is rewired
 * to it in this run. The old review still serves the Review button, the attach flow and the audit
 * engine, and `document_reviews` is untouched. Two readings of one document can coexist; which
 * one the product uses is a later decision, made when this one has been judged.
 *
 * *** IT DOES NOT CARRY ITS OWN COPY OF THE FORMAT BRANCHING. *** `documentReview.ts` decides
 * PDF/image/Word/PowerPoint for itself, which is why Excel, CSV and text — formats every picker
 * accepts — fail on that path. This calls `parseDocumentToBlocks`, which is the one place that
 * knows how to turn a file into blocks, and gets those three formats for free.
 *
 * *** A PAID ANSWER IS NEVER DISCARDED. *** If the JSON does not parse, the text still cost money
 * and still contains the reading. It is kept on the scan row, the scan is stored
 * `could_not_read`, and the caller gets a normal return — never a 500. Measured on 25 September:
 * the OLD path throws on roughly one Haiku call in five and the money is simply gone.
 * ---------------------------------------------------------------------------
 */
import { createHash } from 'node:crypto'
import { askAIWithCitations, extractJsonText, modelForTask, scanStructuredOutput, type AIContent } from './ai.ts'
import { parseDocumentToBlocks } from './documentContent.ts'
import { buildCompanyContext } from './companyContext.ts'
import { scanPrompt, SCAN_JSON_SCHEMA, type ScanPromptContext } from '../prompts/document-scan.ts'

/** A Supabase client, loosely typed: these scripts run outside Next's generated-types world. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

// ---------------------------------------------------------------------------
// THE SHAPE. Migration 040's tables follow this, not the other way round.
// ---------------------------------------------------------------------------
export type ScanKind = 'permit' | 'certificate' | 'program' | 'policy' | 'record' | 'supplier_document' | 'other'

/**
 * DID THE MODEL READ THIS, OR WORK IT OUT?
 *
 * `read` — the words are in the document. `inferred` — the model concluded it.
 *
 * The prompt has always asked for the distinction and there was nowhere to put the answer, so
 * Documents Run 2 had to look for the WORD "inferred" somewhere in an item's prose. Three of the
 * six golden answer keys turn on it: an SDS says nothing about what the company does with the
 * chemical, so "the company holds an SDS for sodium hydroxide" is a fair proposal and "the
 * company uses sodium hydroxide" is not. Migration 041 carries the column.
 *
 * Anything the model does not say is `read`, which is the value that OVERSTATES a claim. That is
 * deliberate and it is the direction that gets noticed: an inference wrongly labelled as read is
 * a proposal a person will read the quote for and reject. The other way round is invisible.
 */
export type ScanBasis = 'read' | 'inferred'
const BASES: ScanBasis[] = ['read', 'inferred']
const basisOf = (v: unknown): ScanBasis => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return (BASES as string[]).includes(s) ? (s as ScanBasis) : 'read'
}
export type ScanStatus =
  | 'current' | 'expiring' | 'expired'
  | 'no_gaps_found' | 'gaps_found'
  | 'recorded' | 'not_judged' | 'could_not_read'

export interface ScanIdentity {
  kind: ScanKind | null
  title: string | null
  issuer: string | null
  agencies: string[]
  subjects: string[]
  site: string | null
  jurisdiction: string[]
  doc_date: string | null
  doc_date_kind: string | null
  page_refs: Record<string, string>
}
export interface ScanGap {
  title: string; description: string | null; fix: string | null
  citation: string | null; citation_url: string | null; locator: string | null
  draftable: boolean; quote: string | null
  /** Whether the gap is read off the document or worked out from it. */
  basis: ScanBasis
  /** Set by us, never by the model — see `verifyQuote`. */
  quote_verified: boolean | null
  /**
   * THE OPEN GAP THIS IS THE SAME FINDING AS, NAMED BY THE MODEL — Run 6.
   *
   * The scan is shown this document's open gaps with their ids, and each new gap says which of
   * them it replaces, or nothing. It is the only thing in the reading the model is asked to
   * identify by id, and it exists because Run 5 measured what the alternative costs: matching
   * gaps by title carried nothing across a re-scan of 01, because Haiku renamed all five
   * findings between two readings of the same unchanged file.
   *
   * An id the model invents or copies from another document is not trusted: `saveScan` only
   * acts on one that is in the list it was given. The title matcher stays as the fallback.
   */
  same_as_gap_id: string | null
}
export interface ScanCondition { title: string; condition_ref: string | null; evidence_expected: string | null }
export interface ScanDeadline { title: string; due_on: string | null; source_line: string | null; recurs: boolean }
export interface ScanFact {
  key: string; value: string; quote: string | null; locator: string | null
  as_of: string | null; affects: string | null
  /** Whether the fact is read off the document or worked out from it. */
  basis: ScanBasis
  quote_verified: boolean | null
}
export interface ScanExpectedMissing { title: string; why: string | null; basis: string | null }

export interface DocumentScan {
  identity: ScanIdentity
  summary: string | null
  status: ScanStatus
  significant_date: string | null
  significant_date_kind: string | null
  freshness_note: string | null
  gaps: ScanGap[]
  conditions: ScanCondition[]
  deadlines: ScanDeadline[]
  facts: ScanFact[]
  version_of: { title: string | null; confidence: string | null }
  expected_missing: ScanExpectedMissing[]
  confidence_notes: string | null
  could_not_read: { reason: string | null; way_forward: string | null }

  // --- how it was produced, for the row and the report's quiet last line ---
  raw_text: string
  json_parsed: boolean
  model: string
  /**
   * How many DISTINCT sources the answer cited, deduplicated by URL by `reassemble()`.
   * *** THIS IS NOT THE NUMBER OF SEARCHES *** and was stored under that name until migration
   * 042: an answer can search twice and cite one page, or search and cite nothing at all.
   */
  cited_sources: number
  /**
   * How many web searches Anthropic BILLED, read back off the `ai_calls` row — which takes it
   * from `usage.server_tool_use.web_search_requests` rather than counting result blocks, because
   * a search the `max_uses` cap refuses still produces one. Null when the ledger row could not
   * be found in time; null means "not recorded", never "none ran".
   */
  searches: number | null
  prompt_sha256: string
  quotes_checked: number
  quotes_verified: number
  /** The text we extracted from the file, when the format allows it. '' when it does not. */
  extracted_text: string
  /** When the model call began — used to find its `ai_calls` row. */
  started_at: string
  /**
   * Which way the shape was obtained: `schema` means the API enforced it via
   * `output_config.format`; `prose` means the prompt asked and `extractJsonText` did the work.
   * Recorded so a stored answer can be attributed to a path months later — the bake-off compares
   * the two and a run whose method nobody wrote down cannot be put on either side of it.
   */
  structured: boolean
}

const KINDS: ScanKind[] = ['permit', 'certificate', 'program', 'policy', 'record', 'supplier_document', 'other']
const STATUSES: ScanStatus[] = ['current', 'expiring', 'expired', 'no_gaps_found', 'gaps_found', 'recorded', 'not_judged', 'could_not_read']

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
  return s && s.toLowerCase() !== 'null' ? s : null
}
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter((x): x is string => !!x) : []
/** A date the database will accept, or null. The model is asked for YYYY-MM-DD and mostly obliges. */
const date = (v: unknown): string | null => {
  const s = str(v)
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/**
 * IS THIS QUOTE ACTUALLY IN THE DOCUMENT?
 *
 * Compared on letters and digits only: the model reflows whitespace, turns a hyphen into an
 * en-dash and straightens quotation marks, and none of that makes a quote invented. What it
 * cannot do is produce words the file does not contain.
 *
 * *** A QUOTE THAT FAILS IS KEPT AND FLAGGED, NOT DROPPED. *** The vision's contract table says
 * "a quote not found in the document is discarded"; the Run 1 brief says keep and flag. Keeping
 * it is what the vision's own standing rule asks for — "close, never delete" — and a dropped
 * quote is a finding that vanishes with no trace of why. Flagged, a person can see the model
 * paraphrased and judge it. Returns null when there is no text to check against, which is not
 * the same as false.
 */
export function verifyQuote(quote: string | null, extractedText: string): boolean | null {
  if (!quote) return null
  if (!extractedText) return null
  // *** TAGS COME OUT BEFORE THE COMPARISON. *** `parseDocumentToBlocks` returns Word as HTML —
  // deliberately, because a handbook's meaning often lives in its tables — so a sentence split
  // across two paragraphs arrives as `…a shift,</p><p>write it…`. Stripping punctuation alone
  // left the tag letters behind and turned a real quote into `ashiftppwriteit`, which matched
  // nothing. Measured on the .docx fixture: a quote that IS in the file was reported unverified
  // until this line existed.
  const norm = (s: string) => s.replace(/<[^>]*>/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const q = norm(quote)
  if (q.length < 8) return null
  return norm(extractedText).includes(q)
}

/**
 * THE DATE THAT MATTERS, CHOSEN IN CODE FROM THE KIND — NEVER THE MODEL'S PICK.
 *
 * *** THIS IS THE ONE FIELD THE WHOLE PAGE HANGS OFF. *** `document_index_v` computes expiring
 * and expired from it, the row prints it on the right, and the Calendar will read it next. The
 * model returned `significant_date` and `significant_date_kind` as free choices and they came
 * back wrong in ways nobody would notice from one document: case 01, an Emergency Action Plan
 * revised February 2021, was stored as "Renewal 1 January 2026" — a date that appears nowhere in
 * it. On screen that reads as a live obligation, on a document five years out of date.
 *
 * `CLAUDE.md` §3.2 already says readiness and coverage are computed in code and never by AI.
 * This is the same rule one field further down: WHICH date matters is a property of the KIND of
 * document, and kind is a small enum. There is nothing here for a model to decide.
 *
 *   permit, certificate   the expiry — the renewal deadline, because that is the day it stops
 *                         being worth anything
 *   program, policy       its own revision date, so freshness is measurable
 *   record                the last entry, because a log's worth is how recent it is
 *   supplier_document     the supplier's revision date — is this the current sheet
 *   other                 its own date, whatever kind that is
 *
 * The model's dates stay the INPUTS: `doc_date` is read off the document and the deadlines are
 * read out of its text. This only decides which of them is promoted to the row.
 */
export function chooseSignificantDate(
  kind: ScanKind | null,
  docDate: string | null,
  docDateKind: string | null,
  deadlines: ScanDeadline[],
): { date: string | null; kind: string | null } {
  const dated = deadlines.filter((d) => !!d.due_on)

  if (kind === 'permit' || kind === 'certificate') {
    // *** THE TITLE ONLY, NOT THE SOURCE LINE. *** Measured on golden case 02: the renewal
    // deadline's source line is condition 1.3, "no later than 120 days before the expiration
    // date", so matching the source line made the deadline that MENTIONS the expiry beat the one
    // that IS it — and the permit's row read 18 July instead of 15 November. A deadline that
    // refers to the expiry is not the expiry.
    const named = dated.filter((d) => !d.recurs && /expir/i.test(d.title))
      .sort((a, b) => (a.due_on! < b.due_on! ? 1 : -1))[0]
    // Otherwise the latest non-recurring dated deadline: on a permit that is the one that ends
    // it. A recurring report date never is.
    const fallback = dated.filter((d) => !d.recurs).sort((a, b) => (a.due_on! < b.due_on! ? 1 : -1))[0]
    const pick = named ?? fallback
    if (pick) return { date: pick.due_on, kind: 'expiry' }
    // *** AND IF THE SCAN READ NO EXPIRY AT ALL, THIS IS NOT AN EXPIRY. *** The fallback is the
    // document's own date and it keeps its own kind — `issued`, usually. That matters downstream:
    // an issue date is always in the past, so a view that treats any past date on a permit as
    // expiry would report every such permit as Expired. Golden case 03, a licence valid until
    // March 2027, read "Expired" for exactly that reason until the view was taught to require
    // significant_date_kind = 'expiry' (migration 048).
    return { date: docDate, kind: docDate ? (docDateKind ?? 'issued') : null }
  }

  if (kind === 'program' || kind === 'policy') {
    // Its own date, and the KIND of that date is whatever the document said it was — a plan is
    // "revised", a food safety plan is "effective". Both are the same question: how old is this.
    const k = docDateKind && /revis|effective/i.test(docDateKind) ? docDateKind : 'revised'
    return { date: docDate, kind: docDate ? k : null }
  }

  if (kind === 'record') {
    // The last entry. `doc_date` on a log IS the last entry when the scan read one; otherwise
    // the latest dated thing in it.
    if (docDate) return { date: docDate, kind: 'last_entry' }
    const latest = dated.sort((a, b) => (a.due_on! < b.due_on! ? 1 : -1))[0]
    return latest ? { date: latest.due_on, kind: 'last_entry' } : { date: null, kind: null }
  }

  if (kind === 'supplier_document') {
    return { date: docDate, kind: docDate ? 'revised' : null }
  }

  return { date: docDate, kind: docDate ? (docDateKind ?? null) : null }
}

/** Fill the shape from whatever the model returned, without trusting any of it. */
function normaliseScanRaw(parsed: Record<string, unknown>, extractedText: string): Omit<DocumentScan,
  'raw_text' | 'json_parsed' | 'model' | 'searches' | 'cited_sources' | 'structured' | 'prompt_sha256' | 'quotes_checked'
  | 'quotes_verified' | 'extracted_text' | 'started_at'> {
  const id = (parsed.identity ?? {}) as Record<string, unknown>
  // *** FLAT FIRST, NESTED AS THE FALLBACK — 26 September 2026. ***
  // `version_of` and `could_not_read` were two-field nested objects in the schema until Opus 5
  // refused the whole thing for its compiled grammar's size, and the database was flat all along
  // (`document_scans.version_of_title`, `version_confidence`, `could_not_read_reason` are columns).
  // The nested read stays because it costs one `??` and buys back every answer already stored: nine
  // scans' `raw_text` on staging, the golden fixtures' recorded runs, and any prose-path answer from
  // a model still following the old wording. A reader that only understood the new shape would turn
  // all of those into silent nulls. See `prompts/document-scan.ts`, the fourth rule.
  const cnr = (parsed.could_not_read ?? {}) as Record<string, unknown>
  const vo = (parsed.version_of ?? {}) as Record<string, unknown>

  const kindRaw = str(id.kind)
  const statusRaw = str(parsed.status)

  return {
    identity: {
      kind: kindRaw && (KINDS as string[]).includes(kindRaw) ? (kindRaw as ScanKind) : null,
      title: str(id.title),
      issuer: str(id.issuer),
      agencies: arr(id.agencies),
      subjects: arr(id.subjects),
      site: str(id.site),
      jurisdiction: arr(id.jurisdiction),
      doc_date: date(id.doc_date),
      doc_date_kind: str(id.doc_date_kind),
      page_refs: (id.page_refs && typeof id.page_refs === 'object' ? id.page_refs : {}) as Record<string, string>,
    },
    summary: str(parsed.summary),
    // An unrecognised status is NOT quietly turned into something valid — it becomes
    // `not_judged`, which says we did not get a status we could use.
    status: statusRaw && (STATUSES as string[]).includes(statusRaw) ? (statusRaw as ScanStatus) : 'not_judged',
    // Placeholders. Overwritten below by `chooseSignificantDate` once the kind, the doc date
    // and the deadlines are all normalised — the model's own pick is deliberately discarded.
    significant_date: null,
    significant_date_kind: null,
    freshness_note: str(parsed.freshness_note),
    gaps: (Array.isArray(parsed.gaps) ? parsed.gaps : []).map((g: Record<string, unknown>) => ({
      title: str(g?.title) ?? str(g?.description) ?? 'Untitled gap',
      description: str(g?.description), fix: str(g?.fix),
      citation: str(g?.citation), citation_url: str(g?.citation_url),
      locator: str(g?.locator), draftable: g?.draftable === true,
      basis: basisOf(g?.basis),
      quote: str(g?.quote),
      quote_verified: verifyQuote(str(g?.quote), extractedText),
      same_as_gap_id: str(g?.same_as_gap_id),
    })),
    conditions: (Array.isArray(parsed.conditions) ? parsed.conditions : []).map((c: Record<string, unknown>) => ({
      title: str(c?.title) ?? 'Untitled condition',
      condition_ref: str(c?.condition_ref), evidence_expected: str(c?.evidence_expected),
    })),
    deadlines: (Array.isArray(parsed.deadlines) ? parsed.deadlines : []).map((d: Record<string, unknown>) => ({
      title: str(d?.title) ?? 'Untitled deadline',
      due_on: date(d?.due_on), source_line: str(d?.source_line), recurs: d?.recurs === true,
    })),
    facts: (Array.isArray(parsed.facts) ? parsed.facts : []).map((f: Record<string, unknown>) => ({
      key: str(f?.key) ?? 'unnamed_fact', value: str(f?.value) ?? '',
      quote: str(f?.quote), locator: str(f?.locator),
      as_of: date(f?.as_of), affects: str(f?.affects),
      basis: basisOf(f?.basis),
      quote_verified: verifyQuote(str(f?.quote), extractedText),
    })),
    version_of: {
      title: str(parsed.version_of_title) ?? str(vo.title),
      confidence: str(parsed.version_of_confidence) ?? str(vo.confidence),
    },
    expected_missing: (Array.isArray(parsed.expected_missing) ? parsed.expected_missing : []).map((e: Record<string, unknown>) => ({
      title: str(e?.title) ?? 'Untitled', why: str(e?.why), basis: str(e?.basis),
    })),
    confidence_notes: str(parsed.confidence_notes),
    // Flat first, nested second — and the nested form is ALSO what this module's own
    // `failedScan` / `refusedScan` pass in, so the fallback is a live path and not only a legacy one.
    could_not_read: {
      reason: str(parsed.could_not_read_reason) ?? str(cnr.reason),
      way_forward: str(parsed.could_not_read_way_forward) ?? str(cnr.way_forward),
    },
  }
}

/**
 * The shape, with the one field the model does not get to choose put in by code.
 * Every caller uses this; `normaliseScanRaw` is not exported.
 */
export function normaliseScan(parsed: Record<string, unknown>, extractedText: string) {
  const shape = normaliseScanRaw(parsed, extractedText)
  const chosen = chooseSignificantDate(
    shape.identity.kind, shape.identity.doc_date, shape.identity.doc_date_kind, shape.deadlines,
  )
  return { ...shape, significant_date: chosen.date, significant_date_kind: chosen.kind }
}

/**
 * WHICH PARTS OF THE COMPANY CONTEXT THE SCAN READS — named once, exported, so nothing has to
 * guess.
 *
 * `scripts/run-golden-docs.js` and `scripts/scan-document.js` both report the block that fed a
 * prompt. If either wrote its own parts list, the block in the report would drift from the block in
 * the prompt and nobody would notice — the report would simply be of a different context. That is
 * the same failure `lib/gateContext.ts` was created to end, where the golden runner hand-rolled the
 * gate's context and measured a gate the routes do not use (AUDIT-CHECKS.md check 14).
 *
 * `declared` is NOT in this list: the scan does not read `company_switches` today.
 */
export const SCAN_CONTEXT_PARTS = ['company', 'confirmed', 'labels', 'keys', 'document'] as const

/**
 * THE CONTEXT THE SCAN PROMPT IS BUILT FROM — the scan's own two lists, plus the company context.
 *
 * *** THE ORDERING RULE MOVED WITH THE QUERIES, IT DID NOT GO AWAY. ***
 * PostgREST returns rows in whatever order Postgres yields them when no ORDER BY is given, and
 * that order is not stable: an UPDATE rewrites a row and moves it in the heap. The label list,
 * the "already holds" list and the dismissed gaps are all rendered into the prompt as lines, so
 * an unordered query means the same state produces a DIFFERENT PROMPT STRING on the next call.
 *
 * That makes `prompt_sha256` — which exists to be a tripwire, so that a changed prompt loudly
 * invalidates every stored expectation — fire on nothing having changed. Documents Run 2 saw it:
 * case 05's run 3 hashed differently from runs 1 and 2 with no label, document or wording change
 * between them. A tripwire that goes off by itself is one nobody reads.
 *
 * Everything about WHO THE COMPANY IS is now `lib/companyContext.ts`, which carries that rule on
 * every query it makes and adds two orderings this function could not have needed before:
 * migration 055 lets one fact key hold a company-wide row and one per site, so `order('key')`
 * stopped being a total order.
 *
 * The two lists still built here are the two that are not about the company: what else is on file
 * (the version question) and this document's own open gaps with their ids (the same_as_gap_id
 * handoff). `scripts/scan-document.js` once built the whole thing ONCE before its loop, so its run
 * 2 never saw the label run 1 had just written — which is the whole mechanism the per-company
 * label list exists for. It is still rebuilt per document, for that reason.
 */
export async function buildScanContext(
  db: Db,
  company: { id: string; name: string; industry: string | null; city?: string | null; state: string | null },
  documentId: string | null,
): Promise<ScanPromptContext> {
  // *** THE COMPANY'S OWN DETAILS, ITS LABELS, ITS KEYS, ITS CONFIRMED FACTS AND THIS DOCUMENT'S
  // CORRECTIONS NOW COME FROM ONE PLACE — `lib/companyContext.ts`, Task 0. ***
  //
  // The queries that used to sit here are the same queries, in the same order, with the same
  // ordering clauses; they moved so that research, the draft and every later section read the
  // identical assembly instead of each growing its own. `docs/VISION-DOCUMENTS.md` "One company
  // context".
  //
  // *** `declared` IS NOT ASKED FOR, AND THAT IS DELIBERATE. *** The scan does not read
  // `company_switches` today. Giving it them here would be a change to what feeds a prompt
  // (`CLAUDE.md` §3.1) smuggled in under a refactor, and nothing would say whether a later
  // golden movement came from the new facts or from the move. It is a separate, switched,
  // measured run.
  //
  // The two lists that stay here are the two that are NOT about who the company is:
  // `existingDocuments` (what else is on file, for the version question) and `openGaps` (this
  // document's own findings, by id, for the same_as_gap_id handoff).
  const ctx = await buildCompanyContext(db, company.id, { documentId, parts: SCAN_CONTEXT_PARTS })

  const { data: existing } = await db.from('document_scans')
    .select('title, kind, document_id').eq('company_id', company.id).eq('is_current', true)
    .order('title').limit(40)
  // THE GAPS THAT ARE STILL OPEN ON THIS DOCUMENT, WITH THEIR IDS — Run 6.
  //
  // Shown to the scan so a new reading can say which old finding each of its gaps IS, rather
  // than leaving us to guess from the wording. Ordered by id so the same state renders the same
  // prompt string, like everything else in this function.
  const { data: openGaps } = documentId
    ? await db.from('document_gaps').select('id, title, citation')
        .eq('document_id', documentId).eq('status', 'open').order('id')
    : { data: [] }

  return {
    company: {
      name: ctx.parts.company.name || company.name,
      // *** THE SLUG, VERBATIM, EXACTLY AS BEFORE. *** The context also carries the slug spelled
      // as words, and the block renders both — but this prompt has always rendered the raw value
      // of `companies.industry` and it goes on rendering that, so `prompt_sha256` does not move
      // for a company whose row has not changed.
      industry: ctx.parts.company.industrySlug ?? company.industry,
      address: ctx.parts.company.address,
      state: ctx.parts.company.state ?? company.state,
    },
    // The scan renders `name — address, state` and only those three, unchanged. The context knows
    // the city, county and which site is primary; this prompt is not told them today.
    sites: ctx.parts.company.sites.map((s) => ({ name: s.name, address: s.address, state: s.state })),
    agencyLabels: ctx.parts.labels.agencies,
    subjectLabels: ctx.parts.labels.subjects,
    // The document being scanned is NOT in its own "what this company already holds" list: on a
    // real upload it has not been read yet, and offering it as a version of itself is nonsense.
    existingDocuments: ((existing ?? []) as Array<{ title: string | null; kind: string | null; document_id: string }>)
      .filter((d) => d.title && d.document_id !== documentId)
      .map((d) => ({ title: d.title as string, kind: d.kind })),
    dismissedGaps: ctx.parts.document?.dismissedGaps ?? [],
    openGaps: ((openGaps ?? []) as Array<{ id: string; title: string; citation: string | null }>)
      .map((g) => ({ id: g.id, title: g.title, citation: g.citation })),
    factKeys: ctx.parts.keys,
    // `site` is carried so a two-site company's confirmed facts are two statements rather than two
    // bare values for one key. It is null for every row that exists today — migration 055 created
    // the column — so the rendered prompt is byte-identical until somebody confirms a fact against
    // a site for the first time. The as-of date is NOT passed: that would be visible on existing
    // rows, which is an addition, and additions are their own run.
    confirmedFacts: ctx.parts.confirmed.map((f) => ({
      key: f.key, value: f.value, basis: f.basis, site: f.siteName,
    })),
    corrections: ctx.parts.document?.corrections ?? [],
  }
}

/**
 * A READING WE COULD NOT PRODUCE, IN THE SHAPE OF A READING.
 *
 * *** THE REASON HAS TO LAND ON A ROW, NOT ONLY IN A RESPONSE BODY. *** The route used to
 * return its reason in JSON and set `documents.status = 'could_not_read'` without writing a
 * scan, so `could_not_read_reason` stayed null and the page fell back to generic wording the
 * moment anybody reloaded. Found on 25 September by uploading a file that is not a PDF: the row
 * said "Could not read" and could not say why, which is half of §5.1 — we admitted the failure
 * and lost the part that tells somebody what to do about it.
 *
 * Every field is the empty version of itself. Nothing here asserts anything about a document
 * nobody read.
 */
export function failedScan(reason: string, wayForward: string, model = '(not called)'): DocumentScan {
  return {
    ...normaliseScan({ status: 'could_not_read', could_not_read: { reason, way_forward: wayForward } }, ''),
    raw_text: '', json_parsed: false, model, cited_sources: 0, searches: null,
    structured: scanStructuredOutput(),
    prompt_sha256: '', quotes_checked: 0, quotes_verified: 0, extracted_text: '',
    started_at: new Date().toISOString(),
  }
}

/**
 * WAS THE FAILURE THE MODEL CALL, OR THE FILE? — 26 September 2026.
 *
 * *** THIS IS A STRUCTURAL TEST, NOT A TEST ON THE WORDS OF THE ERROR. *** An SDK `APIError`
 * carries a numeric `status`; a thrown `Error` from our own code does not. So a number here means
 * the request reached Anthropic and came back refused, and no number means we never got an answer
 * at all — a connection dropped, a DNS failure, a timeout. Reading the message and looking for
 * "grammar" or "400" would be the other way of doing this, and it would be wrong the first time
 * the API rephrased itself.
 *
 * Returns null when the thing thrown is not an API failure, so the caller RETHROWS rather than
 * describe something it has not identified. That direction matters: a `TypeError` from a bug of our
 * own would otherwise be reported to a customer as a refusal by Anthropic, which is a different
 * lie from the one this change removes.
 */
export function apiFailureStatus(error: unknown): number | null {
  const s = (error as { status?: unknown } | null)?.status
  return typeof s === 'number' ? s : null
}

/**
 * THE READING SERVICE ITSELF REFUSED — and that is not the same failure as a file we cannot open.
 *
 * *** THE WORDING THAT USED TO BE WRITTEN HERE WAS A CLAIM ABOUT THE CUSTOMER'S FILE. *** Every
 * throw out of `runDocumentScan` landed in the route's last-resort catch, which said *"it did not
 * arrive as something we can open"* and suggested exporting a fresh PDF. On 26 September the first
 * production scan on `claude-opus-5` was refused by the API — *"The compiled grammar is too large,
 * which would cause performance issues. Simplify your tool schemas or reduce the number of strict
 * tools."* — for a PDF that was perfectly readable, and read fine two minutes later. `CLAUDE.md`
 * §5.1: never assert anything about a document the product did not successfully read, and never
 * imply the user did something wrong when the failure is ours. The file was never the problem;
 * OUR request was.
 *
 * So the person is told the reading service refused OUR request, and the way forward is to ask for
 * it again once we have fixed it — not to go and re-export their document.
 *
 * *** THE API'S OWN MESSAGE IS KEPT, ON THE SCAN, FOR US. *** It goes in `raw_text`, which nothing
 * in the UI reads (`document_scans` has no separate technical column, and §5 wants the raw response
 * kept where a bad answer is diagnosable from the database days later). Without it the only record
 * of *why* is a Vercel log line that ages out; the grammar-limit sentence above is the entire reason
 * production runs with `AI_SCAN_STRUCTURED=false`, and it survived only because somebody screenshotted it.
 */
export function refusedScan(args: {
  error: unknown
  model: string
  status: number
  extractedText: string
  startedAt: string
  structured: boolean
  promptSha: string
}): DocumentScan {
  const detail = args.error instanceof Error ? args.error.message : String(args.error)
  return {
    ...normaliseScan({ status: 'could_not_read', could_not_read: {
      reason: 'The reading service refused our request to read this document, so nothing was read. '
        + 'That is our end of it, not a problem with the file you sent.',
      way_forward: 'Read it again once we have fixed it — nothing about your file needs changing.' } },
      args.extractedText),
    // For us, never for the customer: the API's own sentence, with the status it came back with.
    raw_text: `API ${args.status}: ${detail}`,
    json_parsed: false, model: args.model, cited_sources: 0, searches: null,
    structured: args.structured,
    prompt_sha256: args.promptSha, quotes_checked: 0, quotes_verified: 0,
    extracted_text: args.extractedText, started_at: args.startedAt,
  }
}

export interface RunScanInput {
  buffer: ArrayBuffer
  fileName: string
  fileType: string
  companyId: string
  context: ScanPromptContext
}

/**
 * Read one document. One call, search on and uncapped as in production.
 *
 * `DEV_MAX_SEARCHES` still applies in dev because it is enforced inside `lib/ai.ts` for every
 * caller; that is the point of it living there rather than here.
 */
export async function runDocumentScan(input: RunScanInput): Promise<DocumentScan> {
  const parsed = await parseDocumentToBlocks(input.buffer, input.fileName, input.fileType)
  if (!parsed.ok) {
    // We never reached the model, so there is no cost row and no reading. Said out loud, with
    // the way forward, rather than answered around.
    return {
      ...normaliseScan({ status: 'could_not_read', could_not_read: {
        reason: parsed.failure.message, way_forward: 'A PDF or a Word file we can read.' } }, ''),
      raw_text: '', json_parsed: false, model: '(not called)', searches: 0, cited_sources: 0,
      structured: scanStructuredOutput(),
      prompt_sha256: '', quotes_checked: 0, quotes_verified: 0, extracted_text: '',
      started_at: new Date().toISOString(),
    }
  }

  // *** THE TEXT TO CHECK QUOTES AGAINST, AND UNTIL RUN 6 IT WAS EMPTY FOR EVERY PDF. ***
  //
  // This used to be built from the parser's TEXT BLOCKS, and a PDF has none: it goes to the model
  // whole, as a document block. So `verifyQuote` had nothing to compare against on every single
  // document this product has ever read — 73 fact proposals, 73 nulls, and `quotes_checked = 0`
  // on all nine scans. The column migration 047 added was correct and its input was empty.
  //
  // `parseDocumentToBlocks` now extracts a PDF's text alongside sending the file, and hands it
  // back separately from the blocks. Still '' for a photograph of a page, which keeps the verdict
  // null there — no text to check against is not the same as a quote being wrong.
  const extractedText = parsed.text

  const startedAt = new Date().toISOString()
  const structured = scanStructuredOutput()
  const system = scanPrompt(input.context)
  const promptSha = createHash('sha256').update(system).digest('hex')
  const model = modelForTask('document_scan')

  const content: AIContent = [
    ...parsed.blocks,
    { type: 'text', text: `File name: ${input.fileName}\n\nRead this document.` },
  ] as AIContent

  // *** THE MODEL CALL IS CAUGHT HERE, AND THAT IS WHAT MAKES THE TWO FAILURES DIFFERENT. ***
  // Above this line, a failure is about the FILE — `parseDocumentToBlocks` said it could not open
  // it, and its own message is what the person reads. Below it, a failure is about the READING
  // SERVICE. Until 26 September both fell through to one catch in the route, which described every
  // one of them as a file that "did not arrive as something we can open" — see `refusedScan`.
  // The distinction is WHERE the throw is caught, not what the error says.
  let answer: Awaited<ReturnType<typeof askAIWithCitations>>
  try {
    answer = await askAIWithCitations(system, content, {
      task: 'document_scan',
      maxTokens: 16000,
      enableWebSearch: true,
      // The shape is enforced by the API, not asked for in prose — unless AI_SCAN_STRUCTURED is
      // "false", in which case nothing is sent and `extractJsonText` below is the mechanism again.
      // Which path ran is recorded on the scan so a stored answer can be attributed later.
      ...(structured ? { outputSchema: SCAN_JSON_SCHEMA } : {}),
      ledger: { companyId: input.companyId, task: 'document_scan' },
    })
  } catch (error) {
    const status = apiFailureStatus(error)
    // Something that is not an API failure is not ours to describe: rethrow it and let the caller's
    // own last-resort catch say "something went wrong at our end", which is all anyone knows.
    if (status === null) throw error
    console.error(`document scan: the model call was refused with ${status} —`, error)
    return refusedScan({ error, model, status, extractedText, startedAt, structured, promptSha })
  }

  const raw = answer.text ?? ''
  let obj: Record<string, unknown> | null = null
  try { obj = JSON.parse(extractJsonText(raw)) as Record<string, unknown> } catch { obj = null }

  if (!obj) {
    // THE MONEY IS SPENT AND THE READING IS IN THE TEXT. Keep it.
    return {
      ...normaliseScan({ status: 'could_not_read', could_not_read: {
        reason: 'the reading came back in a form we could not use',
        way_forward: 'Read it again — this is usually temporary.' } }, extractedText),
      raw_text: raw, json_parsed: false, model, cited_sources: answer.sources.length, searches: null,
      structured,
      prompt_sha256: promptSha, quotes_checked: 0, quotes_verified: 0,
      extracted_text: extractedText, started_at: startedAt,
    }
  }

  const shape = normaliseScan(obj, extractedText)
  const checked = [...shape.gaps, ...shape.facts].filter((x) => x.quote_verified !== null)
  return {
    ...shape,
    raw_text: raw, json_parsed: true, model, cited_sources: answer.sources.length, searches: null,
    structured,
    prompt_sha256: promptSha,
    quotes_checked: checked.length,
    quotes_verified: checked.filter((x) => x.quote_verified === true).length,
    extracted_text: extractedText, started_at: startedAt,
  }
}

// ---------------------------------------------------------------------------
// WRITING IT DOWN
// ---------------------------------------------------------------------------

/**
 * Persist one scan. Lives here rather than in the script so a route can reuse it unchanged.
 *
 * *** IT WRITES NOTHING TO `company_switches`, `calendar_events` OR `document_reviews`. ***
 * Facts go to `fact_proposals` for a person to confirm (§108: nothing about a company is written
 * silently). A deadline becomes a calendar event only when a person says so. And the old review
 * table is not this scan's business.
 */
export async function saveScan(
  db: Db, scan: DocumentScan,
  args: { documentId: string; companyId: string; entityId?: string | null
          /**
           * *** FALSE WHEN NO CALL WAS MADE — Audits Run 4a, item 4. ***
           * The ledger row is found BY TIME (`created_at >= scan.started_at`), which is right for a
           * reading that has just happened and wrong for one being restored from a stored run: the
           * stored `started_at` is hours or days old, so the poll would attach whichever
           * `document_scan` row happened to be the newest since then — somebody else's receipt on
           * this reading. A restore passes false and the scan is saved with `ai_call_id` null,
           * which is the truth: no call was made for it.
           */
          linkLedger?: boolean },
): Promise<{ scanId: string | null; aiCallId: string | null }> {
  const { documentId, companyId, entityId } = args
  const linkLedger = args.linkLedger !== false

  // The ledger row this call wrote. `recordAICall` is deliberately not awaited inside lib/ai.ts
  // — bookkeeping must never delay an answer — so it is found by time rather than by id.
  // AND IT IS POLLED, BRIEFLY, BECAUSE THE WRITE IS NOT AWAITED. Querying once right after the
  // call found the row about a third of the time — the insert was still in flight. Five tries
  // over a second; if it is still not there the scan is saved with a null ai_call_id rather
  // than delayed, because the reading matters more than the link to its receipt.
  let aiCallId: string | null = null
  let billedSearches: number | null = null
  for (let attempt = 0; linkLedger && attempt < 5 && !aiCallId; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 250))
    const { data: call } = await db.from('ai_calls')
      .select('id, searches').eq('company_id', companyId).eq('task', 'document_scan')
      .gte('created_at', scan.started_at).order('created_at', { ascending: false }).limit(1).maybeSingle()
    aiCallId = call?.id ?? null
    billedSearches = call?.searches ?? null
  }
  if (!aiCallId && linkLedger) {
    console.warn('document scan: saved with no ai_calls link — the ledger write had not landed')
  }

  // Only the newest scan of a document is current.
  await db.from('document_scans').update({ is_current: false }).eq('document_id', documentId)

  const { data: row, error } = await db.from('document_scans').insert({
    document_id: documentId, company_id: companyId,
    kind: scan.identity.kind, title: scan.identity.title, issuer: scan.identity.issuer,
    agencies: scan.identity.agencies, subjects: scan.identity.subjects,
    entity_id: args.entityId ?? null,
    site_scope: scan.identity.site === 'company_wide' ? 'company_wide' : scan.identity.site ? 'site' : 'unknown',
    jurisdiction: scan.identity.jurisdiction,
    doc_date: scan.identity.doc_date, doc_date_kind: scan.identity.doc_date_kind,
    page_refs: scan.identity.page_refs,
    summary: scan.summary, status: scan.status,
    // significant_date and its kind are NOT written: migration 049 computes them in the view
    // from the kind, the deadlines and the document date, so a corrected rule reaches every
    // document already scanned and a corrected KIND moves the date with it.
    freshness_note: scan.freshness_note,
    expected_missing: scan.expected_missing,
    version_of_title: scan.version_of.title, version_confidence: scan.version_of.confidence,
    confidence_notes: scan.confidence_notes,
    could_not_read_reason: scan.could_not_read.reason,
    raw_text: scan.raw_text, json_parsed: scan.json_parsed,
    // THE TEXT THE QUOTES WERE CHECKED AGAINST (migration 052). Stored, not recomputed: a quote
    // verified against a file the customer later replaced must still be explainable. Null rather
    // than '' when the format yielded none, because null is the column's own word for "there was
    // nothing to check against" and matches what quote_verified says on the same rows.
    extracted_text: scan.extracted_text || null,
    quotes_checked: scan.quotes_checked, quotes_verified: scan.quotes_verified,
    model: scan.model, cited_sources: scan.cited_sources,
    // THE BILLED COUNT, OFF THE LEDGER ROW — not counted here a second time. `ai_calls.searches`
    // is written by lib/ai.ts from the API's own usage block; reading it back is the only way
    // the two numbers cannot disagree. Null when the ledger write had not landed, which is
    // "not recorded" and not "none".
    searches: billedSearches,
    prompt_sha256: scan.prompt_sha256,
    ai_call_id: aiCallId, is_current: true,
  }).select('id').single()
  if (error) throw new Error(`document_scans: ${error.message}`)
  const scanId = row.id as string

  // *** WHAT A PERSON ALREADY DID SURVIVES A RE-SCAN. ***
  // A checklist made from a gap points at that gap's row and a draft is written onto it, and a
  // re-scan writes NEW gap rows — so without this the link would dangle the first time somebody
  // asked us to read the document again, and a fortnight of ticked items would be sitting on a
  // gap nothing shows any more.
  //
  // *** THE MODEL NAMES ITS OWN PREDECESSOR NOW (RUN 6), AND THE TITLE MATCHER IS THE FALLBACK. ***
  // Run 5 matched on title (case-insensitive, punctuation ignored) or citation, and Run 5 also
  // measured what that is worth: re-scanning 01-eap-chemical renamed all five findings, so the
  // matcher found nothing and the checklist stayed on a row the current report no longer lists.
  // The scan is now shown the open gaps with their ids and says which one each new gap IS.
  //
  // THE ID IS NOT TRUSTED BECAUSE IT LOOKS LIKE AN ID. Only one that appears in the list we gave
  // this scan is acted on — a model that invents a uuid, or repeats one from another document,
  // must not be able to reach a row. Where it names nothing, the string matcher runs.
  //
  // Everything a person put on the old gap moves: the checklist link, and the draft with the
  // date it was written and the ledger row behind it. The old row is then CLOSED as superseded
  // and points at its replacement — never deleted (migration 040's own rule), so a gap somebody
  // dismissed or drafted against stays readable.
  //
  // ALL of the document's open gaps are loaded, not only the ones carrying a checklist: a gap
  // with a draft on it and no checklist has work on it too, and one with neither still has to be
  // closed rather than left open for `open_gap_count` to keep counting.
  const { data: priorLinks } = await db.from('checklists')
    .select('id, document_gap_id').eq('document_id', documentId).not('document_gap_id', 'is', null)
  const carry = (priorLinks ?? []) as Array<{ id: string; document_gap_id: string }>
  const { data: priorOpen } = await db.from('document_gaps')
    .select('id, title, citation, draft_text, draft_created_at, draft_ai_call_id')
    .eq('document_id', documentId).eq('status', 'open')
  type PriorGap = {
    id: string; title: string; citation: string | null
    draft_text: string | null; draft_created_at: string | null; draft_ai_call_id: string | null
  }
  const priorGaps = (priorOpen ?? []) as PriorGap[]
  const key = (s: string | null) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

  if (scan.gaps.length) {
    const { error: e } = await db.from('document_gaps').insert(scan.gaps.map((g, i) => ({
      scan_id: scanId, document_id: documentId, company_id: companyId, ordinal: i + 1,
      title: g.title, description: g.description, fix: g.fix,
      citation: g.citation, citation_url: g.citation_url, locator: g.locator,
      draftable: g.draftable, quote: g.quote, quote_verified: g.quote_verified,
      basis: g.basis,
    })))
    if (e) throw new Error(`document_gaps: ${e.message}`)

    if (priorGaps.length) {
      const { data: freshRows } = await db.from('document_gaps')
        .select('id, title, citation, ordinal').eq('scan_id', scanId).order('ordinal')
      const fresh = (freshRows ?? []) as Array<{ id: string; title: string; citation: string | null; ordinal: number }>
      // The model's answer, by position: scan.gaps[i] became the row with ordinal i + 1.
      const namedBy = new Map<string, string>()   // old gap id → new gap id
      const allowed = new Set(priorGaps.map((p) => p.id))
      scan.gaps.forEach((g, i) => {
        const oldId = g.same_as_gap_id
        if (!oldId || !allowed.has(oldId) || namedBy.has(oldId)) return
        const row = fresh.find((f) => f.ordinal === i + 1)
        if (row) namedBy.set(oldId, row.id)
      })

      const pairedOff = new Set<string>()
      for (const old of priorGaps) {
        // The model's answer first; the string matcher only where it named nothing.
        const successorId = namedBy.get(old.id)
          ?? fresh.find((n) =>
               key(n.title) === key(old.title)
               || (!!old.citation && !!n.citation && key(n.citation) === key(old.citation)))?.id
        if (successorId) pairedOff.add(old.id)
        // No successor: NOTHING HAPPENS TO THE OLD ROW. It stays open and keeps its checklist,
        // and the report still lists it under "From earlier readings". Closing a finding because
        // the next reading did not mention it would be the product deciding a gap went away.
        if (!successorId) continue

        for (const link of carry.filter((c) => c.document_gap_id === old.id)) {
          await db.from('checklists').update({ document_gap_id: successorId }).eq('id', link.id)
        }
        if (old.draft_text) {
          await db.from('document_gaps').update({
            draft_text: old.draft_text,
            draft_created_at: old.draft_created_at,
            draft_ai_call_id: old.draft_ai_call_id,
          }).eq('id', successorId)
        }
        await db.from('document_gaps')
          .update({ status: 'superseded', superseded_by: successorId, not_seen_at: null })
          .eq('id', old.id)
      }

      // *** AND THE ONES THIS READING PASSED OVER — Run 7. ***
      //
      // A gap the new scan neither raised nor named in `same_as_gap_id` is the case nothing
      // handled. It STAYS OPEN and it is marked, because a reading that failed to mention a
      // missing evacuation procedure is not evidence that the procedure now exists. NOTHING
      // CLOSES A GAP WITHOUT A PERSON — dismissing it is a person's act with a reason on the
      // row, and the next scan is shown that reason. This column only lets the row say out
      // loud what would otherwise be an invisible difference between two readings.
      for (const old of priorGaps) {
        if (pairedOff.has(old.id)) continue
        await db.from('document_gaps').update({ not_seen_at: new Date().toISOString() }).eq('id', old.id)
      }
    }
  }
  if (scan.conditions.length) {
    const { error: e } = await db.from('document_conditions').insert(scan.conditions.map((c, i) => ({
      scan_id: scanId, document_id: documentId, company_id: companyId, ordinal: i + 1,
      title: c.title, condition_ref: c.condition_ref, evidence_expected: c.evidence_expected,
    })))
    if (e) throw new Error(`document_conditions: ${e.message}`)
  }
  if (scan.deadlines.length) {
    const { error: e } = await db.from('document_deadlines').insert(scan.deadlines.map((d) => ({
      scan_id: scanId, document_id: documentId, company_id: companyId,
      title: d.title, due_on: d.due_on, source_line: d.source_line, recurs: d.recurs,
    })))
    if (e) throw new Error(`document_deadlines: ${e.message}`)
  }
  // *** READING A DOCUMENT AGAIN WITHDRAWS EVERY PENDING PROPOSAL FROM ITS EARLIER READINGS. ***
  //
  // WITHDRAWN IS NOT REJECTED, and the difference matters in both directions. Rejected is a
  // person saying "that is wrong", and the next scan is shown it so the claim is not made again.
  // Withdrawn is us saying "this came from a reading we have replaced" — nobody was wrong, so it
  // teaches the next scan nothing, and it is not deleted either: the drawer shows it, which is
  // information a person may want to act on.
  //
  // *** CHANGED 29 SEPTEMBER 2026, AND THE OLD RULE WAS DELIBERATE, WHICH IS WHY IT SURVIVED. ***
  //
  // This used to match on the KEY: a pending proposal was withdrawn only when the new reading was
  // SILENT about its key, and a key the new reading restated with different words kept both rows.
  // The comment here argued for it — "a reading that now says 38 instead of 42 is a CHANGED
  // proposal, not a withdrawn one; the queue shows both under one key and the person settles it".
  //
  // The live smoke test on 29 September showed what that produces. One Emergency Action Plan, read
  // twice, proposed "Yes, kept in the front office" and "Yes — an AED kept in the front office" for
  // one key. `lib/confirmationQueue.ts` then did exactly the right thing with the wrong input and
  // lifted it out as **"we have two different answers"** — the product asking a person to arbitrate
  // between two paraphrases of one sentence in one file.
  //
  // **Only two different DOCUMENTS can disagree.** A document does not disagree with itself; its
  // latest reading is what it says. The two-values-one-key case Run 6 built for is real and is
  // unaffected: it needs two documents, and this only ever touches THIS document's own rows
  // (`.eq('document_id', documentId)`) — another document's reading of the same key is not ours to
  // retract.
  //
  // A CONFIRMED OR REJECTED PROPOSAL IS UNTOUCHED (`.eq('status', 'proposed')`). A person's decision
  // outranks a re-read, and the accepted row is the history a corrected fact points back to (§056).
  //
  // It runs BEFORE the insert, so the new reading's own rows are never caught by it.
  {
    const { error: wErr } = await db.from('fact_proposals')
      .update({ status: 'withdrawn' })
      .eq('document_id', documentId).eq('status', 'proposed')
    if (wErr) throw new Error(`fact_proposals withdraw: ${wErr.message}`)
  }

  // PROPOSED, NEVER WRITTEN (§108).
  if (scan.facts.length) {
    const { error: e } = await db.from('fact_proposals').insert(scan.facts.map((f) => ({
      company_id: companyId, document_id: documentId, topic_id: null, source: 'document',
      switch_key: f.key.slice(0, 120), proposed_value: String(f.value).slice(0, 500),
      quote: f.quote ? f.quote.slice(0, 2000) : null, locator: f.locator,
      basis: f.basis,
      // ...and the same for `affects` until migration 051. The prompt asks for "one line saying
      // what it affects" on every fact, and the queue that has to show it found the answer had
      // never reached a column.
      affects: f.affects,
      // COMPUTED AND THEN DISCARDED UNTIL MIGRATION 047. `verifyQuote` has run on every fact
      // since Run 1 and its answer never reached a column, so the drawer had nothing to show a
      // person about to confirm a claim on the strength of a quote.
      quote_verified: f.quote_verified,
      // ...AND THE THIRD TIME THE SAME SHAPE APPEARED — migration 055. `as_of` has been asked for
      // (`prompts/document-scan.ts`) and parsed (`normaliseScanRaw`) since Run 1 and had no column
      // to land in, so a fact read out of a 2021 handbook reached the queue looking as current as
      // one read out of this month's permit. No prompt changed to get it: the field was already
      // there.
      as_of: f.as_of,
      // The site the DOCUMENT is filed against, not one the model chose. A fact's site is a
      // property of where the document belongs, and `entityId` here is the same value the scan row
      // itself is written with — so a fact and its reading can never disagree about the plant.
      entity_id: entityId ?? null,
    })))
    if (e) throw new Error(`fact_proposals: ${e.message}`)
  }
  // Any label this document needed that the company did not already have.
  const labels = [
    ...scan.identity.agencies.map((l) => ({ kind: 'agency', label: l })),
    ...scan.identity.subjects.map((l) => ({ kind: 'subject', label: l })),
  ]
  if (labels.length) {
    await db.from('company_labels')
      .upsert(labels.map((l) => ({ company_id: companyId, ...l })),
              { onConflict: 'company_id,kind,label', ignoreDuplicates: true })
  }

  await db.from('documents')
    .update({ status: scan.status === 'could_not_read' ? 'could_not_read' : 'read' })
    .eq('id', documentId)

  return { scanId, aiCallId }
}

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
    version_of: { title: str(vo.title), confidence: str(vo.confidence) },
    expected_missing: (Array.isArray(parsed.expected_missing) ? parsed.expected_missing : []).map((e: Record<string, unknown>) => ({
      title: str(e?.title) ?? 'Untitled', why: str(e?.why), basis: str(e?.basis),
    })),
    confidence_notes: str(parsed.confidence_notes),
    could_not_read: { reason: str(cnr.reason), way_forward: str(cnr.way_forward) },
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
 * THE CONTEXT THE PROMPT IS BUILT FROM — one copy, and every query ordered.
 *
 * *** EVERY QUERY HERE CARRIES AN `order`, AND THAT IS THE POINT OF THE FUNCTION. ***
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
 * It lives here rather than in each script because there were two copies of it and they had
 * already drifted — `scripts/scan-document.js` built the context ONCE before its loop, so its
 * run 2 never saw the label its run 1 had just written, which is the whole mechanism the
 * per-company label list exists for. `CLAUDE.md` §3.4's rule about not reimplementing at a call
 * site is the same rule.
 */
export async function buildScanContext(
  db: Db,
  company: { id: string; name: string; industry: string | null; city?: string | null; state: string | null },
  documentId: string | null,
): Promise<ScanPromptContext> {
  const { data: sites } = await db.from('entities')
    .select('name, address, state').eq('company_id', company.id).order('name')
  const { data: labels } = await db.from('company_labels')
    .select('kind, label').eq('company_id', company.id).order('kind').order('label')
  const { data: existing } = await db.from('document_scans')
    .select('title, kind, document_id').eq('company_id', company.id).eq('is_current', true)
    .order('title').limit(40)
  const { data: dismissed } = documentId
    ? await db.from('document_gaps').select('title, dismissed_reason')
        .eq('document_id', documentId).eq('status', 'dismissed').order('title')
    : { data: [] }
  // THE GAPS THAT ARE STILL OPEN ON THIS DOCUMENT, WITH THEIR IDS — Run 6.
  //
  // Shown to the scan so a new reading can say which old finding each of its gaps IS, rather
  // than leaving us to guess from the wording. Ordered by id so the same state renders the same
  // prompt string, like everything else in this function.
  const { data: openGaps } = documentId
    ? await db.from('document_gaps').select('id, title, citation')
        .eq('document_id', documentId).eq('status', 'open').order('id')
    : { data: [] }
  // Newest per field. Ordered so the same state gives the same prompt string, like everything
  // else here — and `created_at desc, id desc` for the same tie-break reason as migration 045.
  // WHAT THE COMPANY HAS CONFIRMED ABOUT ITSELF (migration 050). Shown to the next scan so it
  // does not propose a fact somebody has already answered, and so it reads the document against
  // what is known rather than against nothing.
  //
  // *** THE RESEARCH PROMPT DOES NOT READ THESE IN THIS RUN. *** Only the scan does. Wiring them
  // into research is a change to what feeds an answer (§3.1) and belongs in its own run with its
  // own measurement.
  const { data: confirmedFacts } = await db.from('company_facts')
    .select('key, value, basis').eq('company_id', company.id).order('key')

  const { data: corrections } = documentId
    ? await db.from('document_corrections').select('field, new_value, reason, created_at, id')
        .eq('document_id', documentId).order('created_at', { ascending: false }).order('id', { ascending: false })
    : { data: [] }

  return {
    company: {
      name: company.name,
      industry: company.industry,
      address: [company.city, company.state].filter(Boolean).join(', ') || null,
      state: company.state,
    },
    sites: (sites ?? []).map((s: Record<string, string | null>) =>
      ({ name: s.name as string, address: s.address, state: s.state })),
    agencyLabels: (labels ?? []).filter((l: { kind: string }) => l.kind === 'agency')
      .map((l: { label: string }) => l.label),
    subjectLabels: (labels ?? []).filter((l: { kind: string }) => l.kind === 'subject')
      .map((l: { label: string }) => l.label),
    // The document being scanned is NOT in its own "what this company already holds" list: on a
    // real upload it has not been read yet, and offering it as a version of itself is nonsense.
    existingDocuments: (existing ?? [])
      .filter((d: { title: string | null; document_id: string }) => d.title && d.document_id !== documentId)
      .map((d: { title: string; kind: string | null }) => ({ title: d.title, kind: d.kind })),
    dismissedGaps: (dismissed ?? []).map((g: { title: string; dismissed_reason: string | null }) =>
      ({ title: g.title, reason: g.dismissed_reason })),
    openGaps: (openGaps ?? []).map((g: { id: string; title: string; citation: string | null }) =>
      ({ id: g.id, title: g.title, citation: g.citation })),
    confirmedFacts: (confirmedFacts ?? []).map((f: { key: string; value: unknown; basis: string }) => ({
      key: f.key,
      value: typeof f.value === 'string' ? f.value : JSON.stringify(f.value ?? '').replace(/^"|"$/g, ''),
      basis: f.basis,
    })),
    corrections: (() => {
      const seen = new Set<string>()
      const out: Array<{ field: string; value: string; reason: string | null }> = []
      for (const c of (corrections ?? []) as Array<{ field: string; new_value: unknown; reason: string | null }>) {
        if (seen.has(c.field)) continue          // the list is newest-first, so the first wins
        seen.add(c.field)
        const v = Array.isArray(c.new_value) ? c.new_value.join(', ') : String(c.new_value ?? '')
        if (v) out.push({ field: c.field, value: v, reason: c.reason })
      }
      return out.sort((a, b) => a.field.localeCompare(b.field))
    })(),
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

  const answer = await askAIWithCitations(system, content, {
    task: 'document_scan',
    maxTokens: 16000,
    enableWebSearch: true,
    // The shape is enforced by the API, not asked for in prose — unless AI_SCAN_STRUCTURED is
    // "false", in which case nothing is sent and `extractJsonText` below is the mechanism again.
    // Which path ran is recorded on the scan so a stored answer can be attributed later.
    ...(structured ? { outputSchema: SCAN_JSON_SCHEMA } : {}),
    ledger: { companyId: input.companyId, task: 'document_scan' },
  })

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
  db: Db, scan: DocumentScan, args: { documentId: string; companyId: string; entityId?: string | null },
): Promise<{ scanId: string | null; aiCallId: string | null }> {
  const { documentId, companyId } = args

  // The ledger row this call wrote. `recordAICall` is deliberately not awaited inside lib/ai.ts
  // — bookkeeping must never delay an answer — so it is found by time rather than by id.
  // AND IT IS POLLED, BRIEFLY, BECAUSE THE WRITE IS NOT AWAITED. Querying once right after the
  // call found the row about a third of the time — the insert was still in flight. Five tries
  // over a second; if it is still not there the scan is saved with a null ai_call_id rather
  // than delayed, because the reading matters more than the link to its receipt.
  let aiCallId: string | null = null
  let billedSearches: number | null = null
  for (let attempt = 0; attempt < 5 && !aiCallId; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 250))
    const { data: call } = await db.from('ai_calls')
      .select('id, searches').eq('company_id', companyId).eq('task', 'document_scan')
      .gte('created_at', scan.started_at).order('created_at', { ascending: false }).limit(1).maybeSingle()
    aiCallId = call?.id ?? null
    billedSearches = call?.searches ?? null
  }
  if (!aiCallId) console.warn('document scan: saved with no ai_calls link — the ledger write had not landed')

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

      for (const old of priorGaps) {
        // The model's answer first; the string matcher only where it named nothing.
        const successorId = namedBy.get(old.id)
          ?? fresh.find((n) =>
               key(n.title) === key(old.title)
               || (!!old.citation && !!n.citation && key(n.citation) === key(old.citation)))?.id
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
          .update({ status: 'superseded', superseded_by: successorId }).eq('id', old.id)
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

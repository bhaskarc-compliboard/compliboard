/**
 * THE DOCUMENTS CHAT'S BRIEF — `docs/GAPS-PLAN.md` Part A step 4a (decisions 1, 5, 14).
 *
 * What a question about documents is answered FROM, in the owner's order:
 *
 *   1. the company context every chat sends (`buildCompanyContext`, the three parts HR sends);
 *   2. THE INDEX — one line for every document the company holds, whole, never cut. What it is,
 *      its state, the date that matters, and how many gaps are open on it;
 *   3. THE REPORTS — the full reading of the documents the question names, then of the documents
 *      that need attention, until the budget is spent;
 *   4. the question.
 *
 * *** THE READINGS, NEVER THE FILES — decision 14. *** A file the person attaches to the
 * conversation IS sent, whole, by the engine (`lib/ask/engine.ts`). Everything else is what the
 * scan read. `extracted_text` is never in any block: it is the raw text of a document, it is what
 * made `document_scans` the biggest row in the database, and the summary, the gaps, the deadlines
 * and the conditions are what a person would want read back to them anyway.
 *
 * *** THE INDEX IS WHOLE, AND THAT IS THE ONE RULE THAT CANNOT BEND. *** A chat that was shown
 * half a company's documents would answer *"you do not hold a stormwater permit"* about a
 * stormwater permit sitting in the list — the worst thing this section can say, and the exact
 * shape of the failure `CLAUDE.md` §5.1's worked example describes. So the index is filled first.
 * If a company ever holds so many documents that the index alone will not fit, the LEAST important
 * status goes first — `on_file` before `recorded` before `current` — and the block says how many
 * went and which kind, so the model knows its list is short. Nothing silently disappears.
 *
 * Measured on staging, 2 November 2026: Cascade's twelve readings are 65,573 characters in full,
 * about 26,000 tokens — 22% of the 120,000 budget. One index line is about 120 characters, so two
 * hundred documents index in roughly 9,600 tokens. The pressure is on the reports, never the list.
 */
import { KIND_WORD, STATUS_WORD } from '../documentStatus.ts'
import { DOCUMENTS_EXAMPLE_QUESTIONS } from '../../config/examples.ts'
import { DOCUMENTS_SENTENCES } from '../../prompts/documents-answer.ts'
import {
  DOCUMENTS_LEDE, DOCUMENTS_EMPTY_CONVERSATIONS, DOCUMENTS_ATTACH_LABEL, DOCUMENTS_ATTACH_HREF,
} from '../documentsWords.ts'
import { companyBlock } from './engine.ts'
import { contextBudgetTokens } from './calendarBrief.ts'
import { packReadings } from './readings.ts'
import { tokensOf, type Passage } from './passages.ts'
import type { Brief, ContextBlock, Db, PackedContext } from './brief.ts'

/**
 * THE ORDER A PERSON'S OWN PAGE USES — `app/documents/page.tsx:105`–`:108`, copied so the chat
 * lists documents the way the list does. It is the operator's question walking in: what needs me
 * today? A status not in this list sorts last.
 */
export const STATUS_ORDER: readonly string[] = [
  'needs_work', 'expiring', 'expired', 'could_not_read', 'not_yet_read',
  'current', 'recorded', 'on_file',
]

/** Which statuses get a full report when the question names nothing — most wanted first. */
export const ATTENTION_ORDER: readonly string[] = ['needs_work', 'expired', 'expiring']

/** The least important first: what goes if even the index will not fit. */
export const DROP_ORDER: readonly string[] = ['on_file', 'recorded', 'current']

/** The index is filled first and whole; the reports take what is left. */
export const INDEX_SHARE = 0.25

const attr = (s: string | null | undefined): string =>
  String(s ?? '').replace(/"/g, "'").replace(/\s+/g, ' ').trim()

const statusRank = (s: string): number => {
  const i = STATUS_ORDER.indexOf(s)
  return i === -1 ? STATUS_ORDER.length : i
}

export interface IndexRow {
  document_id: string
  title: string | null
  file_name: string | null
  kind: string | null
  agencies: unknown
  subjects: unknown
  site_name: string | null
  doc_date: string | null
  significant_date: string | null
  significant_date_kind: string | null
  scanned_at: string | null
  display_status: string
  open_gap_count: number
  /** How many of those the reading worked out rather than quoted — migration 093, decision 48. */
  inferred_gap_count: number
  summary: string | null
  issuer: string | null
  could_not_read_reason: string | null
  version_of: string | null
  correction_count: number
}

/** The columns the index and the reports both read. `document_index_v` is `security_invoker`. */
export const INDEX_COLUMNS =
  'document_id, title, file_name, kind, agencies, subjects, site_name, doc_date, significant_date, '
  + 'significant_date_kind, scanned_at, display_status, open_gap_count, inferred_gap_count, '
  + 'summary, issuer, could_not_read_reason, version_of, correction_count'

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []

/**
 * ONE DOCUMENT, IN ONE LINE. Every column a question could turn on, and nothing derived twice.
 * The handle is what the model cites; the title is what the person sees in their list.
 */
export function indexLine(d: IndexRow, id: string): string {
  const parts = [
    `id="${id}"`,
    `document="${attr(d.title ?? d.file_name ?? 'Untitled')}"`,
    d.kind ? `kind="${attr(KIND_WORD[d.kind] ?? d.kind)}"` : '',
    list(d.agencies).length ? `agency="${attr(list(d.agencies).join(', '))}"` : '',
    list(d.subjects).length ? `subject="${attr(list(d.subjects).join(', '))}"` : '',
    d.site_name ? `site="${attr(d.site_name)}"` : '',
    `state="${attr(STATUS_WORD[d.display_status] ?? d.display_status)}"`,
    d.significant_date ? `${attr(d.significant_date_kind ?? 'date')}="${d.significant_date}"` : '',
    /**
     * *** THE TWO KINDS OF GAP, SAID APART — decision 48, 4 November 2026. ***
     *
     * This was one number, `gaps="5"`, and the chat could only read it as five things wrong with
     * the document. Since migration 093 the two halves mean different things to the person: a gap
     * READ from the page is why the row says "Needs work", and a NOTE is something the reading
     * worked out that nobody has checked. An answer that merges them states a guess as a finding,
     * which is the one thing `DOCUMENTS_WORDS` exists to stop — and it would be the packer making
     * the mistake first, before the model got a chance to.
     *
     * `gaps=` keeps its name and narrows to the read ones, so an answer written against the old
     * attribute cannot silently start counting notes.
     */
    d.open_gap_count - (d.inferred_gap_count ?? 0) > 0
      ? `gaps="${d.open_gap_count - (d.inferred_gap_count ?? 0)}"` : '',
    (d.inferred_gap_count ?? 0) > 0 ? `notes="${d.inferred_gap_count}"` : '',
  ].filter(Boolean)
  return `<document ${parts.join(' ')}/>`
}

/**
 * *** THE SAME LINE IN PLAIN WORDS, FOR THE QUOTE CHECK ONLY — step 4b, the owner's yes. ***
 *
 * `indexLine` above is what the MODEL is sent, and it is unchanged. This is what a quote is
 * checked AGAINST, and the two have to be different strings for a reason that is not obvious:
 *
 * `lib/ask/passages.ts:79` `normalisedWithMap` skips everything between `<` and `>`, because a
 * passage is usually a block with tags around its text. An index line is **one self-closing tag**,
 * so the whole thing is skipped and it normalises to the empty string — proved by running it:
 *
 *     normalisedWithMap('<document id="I1" document="Emergency Action Plan — Portland Facility" …/>')
 *       -> norm: ""      so a quote can match it: false
 *
 * All twelve of Cascade's `I` passages were therefore unquotable, which is why a title in
 * quotation marks came back marked *"we could not find these words in what we have on file"* — six
 * of 36 measured runs (step 4a-test). A `<report>` block never had the problem: its body sits
 * outside the tags.
 *
 * **The normaliser is not changed**, deliberately: HR and the Calendar check quotes through it too,
 * and a change there is a change to three sections' behaviour. The passage carries plain text
 * instead, and the fix is this section's alone.
 *
 * It is the same facts in the same order — title, kind, agency, site, state, date — so a quote of
 * any of them matches, and the card it becomes opens that document.
 */
export function indexPlain(d: IndexRow): string {
  return [
    attr(d.title ?? d.file_name ?? 'Untitled'),
    d.kind ? attr(KIND_WORD[d.kind] ?? d.kind) : '',
    list(d.agencies).join(', '),
    d.site_name ? attr(d.site_name) : '',
    attr(STATUS_WORD[d.display_status] ?? d.display_status),
    d.significant_date ? `${attr(d.significant_date_kind ?? 'date')} ${d.significant_date}` : '',
  ].filter(Boolean).join(' · ')
}

export interface ReportParts {
  gaps: Array<{ document_id: string; title: string; description: string | null; fix: string | null
    citation: string | null; locator: string | null; status: string }>
  deadlines: Array<{ document_id: string; title: string; due_on: string | null; recurs: boolean
    source_line: string | null }>
  conditions: Array<{ document_id: string; condition_ref: string | null; title: string | null
    evidence_expected: string | null }>
  corrections: Array<{ document_id: string; field: string; new_value: unknown; reason: string | null }>
  labels: Array<{ kind: string; label: string }>
}

/**
 * ONE DOCUMENT'S FULL READING — what `app/api/documents/report/route.ts:27`–`:84` puts in the
 * drawer, said in words rather than drawn. What it is, what we made of it, what is missing and
 * how to fix it, what dates it sets, what it asks the company to keep, and what a person
 * corrected about it.
 *
 * *** `extracted_text` IS NOT HERE AND MUST NOT BE. *** It is the raw text of the whole file. It
 * would be the largest thing in the message by an order of magnitude, and it is not what anybody
 * asks for: the summary, the gaps and the dates are the reading.
 */
export function reportBlock(d: IndexRow, p: ReportParts, id: string): string {
  const head = [
    `id="${id}"`,
    `document="${attr(d.title ?? d.file_name ?? 'Untitled')}"`,
    d.kind ? `kind="${attr(KIND_WORD[d.kind] ?? d.kind)}"` : '',
    d.issuer ? `issuer="${attr(d.issuer)}"` : '',
    d.doc_date ? `dated="${d.doc_date}"` : '',
    d.scanned_at ? `read="${String(d.scanned_at).slice(0, 10)}"` : '',
    `state="${attr(STATUS_WORD[d.display_status] ?? d.display_status)}"`,
  ].filter(Boolean).join(' ')

  const mine = <T extends { document_id: string }>(xs: T[]) => xs.filter((x) => x.document_id === d.document_id)
  const out: string[] = [`<report ${head}>`]

  out.push(d.summary?.trim() || 'No summary was stored for this reading.')
  if (d.could_not_read_reason) out.push(`We could not read this file: ${d.could_not_read_reason.trim()}`)
  if (d.version_of) out.push('A newer version of this document is on file.')

  const gaps = mine(p.gaps).filter((g) => g.status === 'open')
  if (gaps.length) {
    out.push('What is missing:')
    for (const g of gaps) {
      out.push(`- ${[g.title, g.description, g.fix ? `Fix: ${g.fix}` : '', g.citation ? `Rule: ${g.citation}` : '',
        g.locator ? `Where: ${g.locator}` : ''].map((x) => String(x ?? '').trim()).filter(Boolean).join(' — ')}`)
    }
  }

  const deadlines = mine(p.deadlines)
  if (deadlines.length) {
    out.push('Dates this document sets:')
    for (const dl of deadlines) {
      const when = dl.due_on ?? (dl.recurs ? 'repeats, no day read' : 'no day read')
      out.push(`- ${dl.title} — ${when}${dl.source_line ? `\n  "${dl.source_line.trim()}"` : ''}`)
    }
  }

  const conditions = mine(p.conditions)
  if (conditions.length) {
    out.push('What this document asks the company to keep:')
    for (const c of conditions) {
      out.push(`- ${[c.condition_ref, c.title, c.evidence_expected].map((x) => String(x ?? '').trim()).filter(Boolean).join(' — ')}`)
    }
  }

  const corrections = mine(p.corrections)
  if (corrections.length) {
    out.push('What a person corrected about this document (their word beats the reading):')
    for (const c of corrections) {
      const v = typeof c.new_value === 'string' ? c.new_value : JSON.stringify(c.new_value)
      out.push(`- ${c.field} is now ${attr(v)}${c.reason ? ` (${attr(c.reason)})` : ''}`)
    }
  }

  out.push('</report>')
  return out.join('\n')
}

/**
 * *** WHICH DOCUMENTS THE QUESTION NAMES — DECIDED IN CODE, NEVER BY A MODEL. ***
 *
 * A case-insensitive match of the question's words against each document's title, file name, kind
 * word, agency and subject. Those five are what a person can see on the Documents page, so they
 * are what a person can mean.
 *
 * *** IT DOES NOT MATCH ON LABELS, AND THAT IS NOT AN OVERSIGHT. *** `company_labels` is the
 * COMPANY's vocabulary — `(company_id, kind, label)` — and no document carries one. There is
 * nothing per-document to match against. Said here because the step's brief asked for labels and
 * reading the table is what found it.
 *
 * *** THE LENGTH FLOOR IS THREE, NOT FOUR, AND THAT COST A TEST. *** Four letters reads as the
 * safe choice until you notice it throws away "air", "SDS", "EPA", "gas" and "oil" — words that
 * are the whole subject of a document. So the floor is three and the common English joining words
 * are named instead. A stop list is longer to read than a number and it is the honest one.
 */
export const STOP_WORDS = new Set([
  'the', 'and', 'our', 'for', 'are', 'was', 'who', 'how', 'why', 'what', 'when', 'with', 'from',
  'does', 'did', 'has', 'have', 'you', 'your', 'can', 'any', 'all', 'not', 'its', 'this', 'that',
  'them', 'they', 'there', 'here', 'about', 'show', 'tell', 'need', 'needs', 'which', 'get', 'got',
  'see', 'say', 'said', 'into', 'out', 'off', 'over', 'under', 'been', 'were', 'will', 'would',
  'should', 'could', 'much', 'many', 'more', 'most', 'some', 'each', 'every', 'anything',
])

export function namedBy(question: string, d: IndexRow): boolean {
  const words = (question.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? [])
    .filter((w) => !STOP_WORDS.has(w))
  if (!words.length) return false
  const hay = [
    d.title, d.file_name,
    d.kind ? (KIND_WORD[d.kind] ?? d.kind) : '',
    ...list(d.agencies), ...list(d.subjects),
  ].map((x) => String(x ?? '').toLowerCase()).join(' | ')
  return words.some((w) => hay.includes(w))
}

/** How the two blocks say what they could not carry. */
export const INDEX_LEFT_OUT = (n: number, statuses: string[]) =>
  `${n} further document(s) are on file and are not listed here (${statuses.join(', ')}); `
  + 'say so rather than treating this list as all of them.'
export const REPORTS_LEFT_OUT = (n: number) =>
  `${n} further document reading(s) are on file and are not included here. Ask about one by name to see it.`

/** EVERYTHING THE DOCUMENTS CHAT IS GIVEN. Read as the caller — RLS decides what comes back. */
export async function packDocumentsContext(db: Db, companyId: string, question: string): Promise<PackedContext> {
  const budget = contextBudgetTokens()
  const blocks: ContextBlock[] = [await companyBlock(db, companyId)]
  const passages: Passage[] = []

  // ---- 2. THE INDEX: every document, whole ----
  const { data: rows, error } = await db.from('document_index_v').select(INDEX_COLUMNS)
  // §5.1: a read that failed must not look like a company with no documents. The chat would
  // otherwise answer "you hold nothing" to a company with forty.
  if (error) throw new Error(`document_index_v: ${error.message}`)

  const all = ((rows ?? []) as unknown as IndexRow[]).slice().sort((a, b) =>
    statusRank(a.display_status) - statusRank(b.display_status)
    || String(a.title ?? a.file_name ?? '').localeCompare(String(b.title ?? b.file_name ?? '')))

  // If even the index will not fit, the least important status goes first, and it is SAID.
  const indexCap = Math.floor(budget * INDEX_SHARE)
  let shown = all
  const droppedStatuses: string[] = []
  const indexCost = (xs: IndexRow[]) => tokensOf(xs.map((d, i) => indexLine(d, `I${i + 1}`)).join('\n'))
  for (const status of DROP_ORDER) {
    if (indexCost(shown) <= indexCap) break
    const before = shown.length
    shown = shown.filter((d) => d.display_status !== status)
    if (shown.length !== before) droppedStatuses.push(STATUS_WORD[status] ?? status)
  }
  const indexLeftOut = all.length - shown.length

  const indexLines = shown.map((d, i) => {
    const id = `I${i + 1}`
    const line = indexLine(d, id)
    passages.push({
      id, title: `${d.title ?? d.file_name ?? 'A document'} — its line in your list`,
      // `indexPlain`, NOT `line`: the line is one self-closing tag and the normaliser skips it
      // whole, so a quote could never match it. The block the model is sent is still `line`.
      label: 'your document', text: indexPlain(d),
      href: `/documents?document=${d.document_id}`, shortName: d.title ?? d.file_name ?? 'that document',
    })
    return line
  })
  const indexNote = indexLeftOut ? INDEX_LEFT_OUT(indexLeftOut, droppedStatuses) : ''
  const indexText = `Every document this company holds (${all.length} in all`
    + `${indexLeftOut ? `, ${shown.length} listed` : ''}):\n`
    + (indexLines.join('\n') || 'This company holds no documents yet.')
    + (indexNote ? `\n${indexNote}` : '')
  blocks.push({ name: 'your documents', text: indexText, chars: indexText.length,
    tokens: tokensOf(indexText), leftOut: indexNote || null })

  // ---- 3. THE REPORTS: the ones the question names, then the ones that need attention ----
  const named = shown.filter((d) => namedBy(question, d))
  const namedIds = new Set(named.map((d) => d.document_id))
  const attention = ATTENTION_ORDER.flatMap((s) =>
    shown.filter((d) => d.display_status === s && !namedIds.has(d.document_id)))
  const wanted = [...named, ...attention]

  if (wanted.length) {
    const ids = wanted.map((d) => d.document_id)
    const [gaps, deadlines, conditions, corrections, labels] = await Promise.all([
      db.from('document_gaps').select('document_id, title, description, fix, citation, locator, status')
        .in('document_id', ids).order('ordinal'),
      db.from('document_deadlines').select('document_id, title, due_on, recurs, source_line')
        .in('document_id', ids).order('due_on', { nullsFirst: false }),
      db.from('document_conditions').select('document_id, condition_ref, title, evidence_expected')
        .in('document_id', ids).order('ordinal'),
      db.from('document_corrections').select('document_id, field, new_value, reason')
        .in('document_id', ids).order('created_at', { ascending: false }),
      db.from('company_labels').select('kind, label').order('kind').order('label'),
    ])
    const parts: ReportParts = {
      gaps: (gaps.data ?? []) as ReportParts['gaps'],
      deadlines: (deadlines.data ?? []) as ReportParts['deadlines'],
      conditions: (conditions.data ?? []) as ReportParts['conditions'],
      corrections: (corrections.data ?? []) as ReportParts['corrections'],
      labels: (labels.data ?? []) as ReportParts['labels'],
    }
    // The reports take everything the index did not.
    const packed = packReadings(wanted, {
      cap: Math.max(0, budget - tokensOf(indexText) - blocks[0].tokens),
      idPrefix: 'R',
      blockFor: (d, id) => reportBlock(d, parts, id),
      passageFor: (d, id, block) => ({
        id, title: `${d.title ?? d.file_name ?? 'A document'} — what we read in it`,
        label: 'your document', text: block,
        href: `/documents?document=${d.document_id}`, shortName: d.title ?? d.file_name ?? 'that document',
      }),
    })
    passages.push(...packed.passages)
    if (packed.texts.length || packed.leftOut) {
      const note = packed.leftOut ? REPORTS_LEFT_OUT(packed.leftOut) : ''
      const text = `What we read in these documents:\n${packed.texts.join('\n\n')}`
        + (note ? `\n\n${note}` : '')
      blocks.push({ name: 'the readings', text, chars: text.length, tokens: tokensOf(text), leftOut: note || null })
    }
  }

  return { blocks, passages }
}

/** The Documents chat's brief. Five things; `extraStep` is deliberately absent. */
export const documentsBrief: Brief = {
  section: 'documents',
  /**
   * *** EVERY ONE OF THESE COMES FROM `lib/documentsWords.ts`, AND THAT IS THE POINT. ***
   * Nothing can read these fields — a brief reaches `lib/ai.ts` and no client file may
   * (`tests/unit/clientImports.test.ts`), so `Brief.words` has had no reader since it was written
   * (`docs/GAPS-PLAN.md` §8). The page reads the same file this does, so the brief and the screen
   * cannot say two different things. The Calendar keeps two copies; this keeps one.
   */
  words: {
    attachLabel: DOCUMENTS_ATTACH_LABEL,
    /** Kept for a section that links; the Documents page passes `onPick` and uploads in place. */
    attachHref: DOCUMENTS_ATTACH_HREF,
    examples: DOCUMENTS_EXAMPLE_QUESTIONS.map((e) => e.question),
    emptyConversations: DOCUMENTS_EMPTY_CONVERSATIONS,
    lede: DOCUMENTS_LEDE,
  },
  packContext: (db, companyId, question) => packDocumentsContext(db, companyId, question),
  promptSentences: DOCUMENTS_SENTENCES,
  /**
   * NOTHING, AND IT IS A DECISION. The Calendar can offer to add a date because `proposeDate` is
   * one writer with one meaning. What this chat could offer — make a checklist, draft a missing
   * section, confirm a fact — are three different writers, and which of them a chat may reach is
   * the owner's call. `parseOffers` drops any block the model writes while this is empty.
   */
  offers: [],
}

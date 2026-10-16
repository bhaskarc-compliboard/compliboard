/**
 * THE CALENDAR'S BRIEF — the engine's first customer. Calendar step 10a (decisions 4, 16, 17).
 *
 * What a calendar question is answered FROM, in the owner's order:
 *
 *   1. the company context every chat sends (`buildCompanyContext`, the three parts HR sends);
 *   2. EVERY LIVE DATE on the calendar — one line each with the line it was read from, and the
 *      row id, so an answer can point at the date it means;
 *   3. for each document those dates came from, ITS STORED READING as Documents keeps it
 *      (decision 16: readings, not files — the file itself only when attached, which is 10b);
 *   4. for a date that came from an audit, that finding's own words;
 *   5. the question.
 *
 * *** THE SIZE BUDGET IS PER BLOCK, AND WHAT DOES NOT FIT IS SAID OUT LOUD. *** A chat that
 * quietly drops half a company's dates would answer "that is not on your calendar" about a date
 * that is — the worst thing this section can say. So the dates block is filled first and whole,
 * the readings take what is left, and anything left out is named in the block itself (the model is
 * told) and in the context event (the log and the check record are told).
 */
import { liveDates } from '../calendarCounts.ts'
import {
  CALENDAR_VIEW_COLUMNS, longDay, repeatWords, siteWords, NOT_CONFIRMED, type CalendarRow,
} from '../calendarView.ts'
import { KIND_WORD } from '../documentStatus.ts'
import { CALENDAR_EXAMPLE_QUESTIONS } from '../../config/examples.ts'
import { CALENDAR_SENTENCES } from '../../prompts/calendar-answer.ts'
import { companyBlock } from './engine.ts'
import { tokensOf, type Passage } from './passages.ts'
import type { Brief, ContextBlock, Db, PackedContext } from './brief.ts'

/**
 * THE WHOLE CONTEXT'S BUDGET, in tokens. 120,000 leaves room on Haiku 4.5's 200K window for the
 * answer (16,000, twice for a retry), the instructions, the search rounds and the conversation so
 * far; on the production tier it is a fraction of the window. `ASK_CONTEXT_BUDGET_TOKENS`
 * overrides it, as `HR_HANDBOOK_BUDGET_TOKENS` overrides HR's.
 */
export const DEFAULT_CONTEXT_BUDGET_TOKENS = 120_000
export function contextBudgetTokens(): number {
  const n = Number(process.env.ASK_CONTEXT_BUDGET_TOKENS)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CONTEXT_BUDGET_TOKENS
}
/** The dates come first and are the cheapest; the readings are the big block and take what is left. */
export const DATES_SHARE = 0.3
export const READINGS_SHARE = 0.6
export const FINDINGS_SHARE = 0.1

const attr = (s: string | null | undefined): string => String(s ?? '').replace(/"/g, "'").replace(/\s+/g, ' ').trim()

/** How a date is written for the model: every column a question could turn on, and nothing derived twice. */
export function dateLine(row: CalendarRow, id: string, siteCount: number): string {
  const when = longDay(row.next_due) || (row.recurs ? 'no day read yet' : '')
  const repeat = repeatWords(row) || (row.recurs ? "repeats, how often wasn't read" : 'happens once')
  const site = siteWords(row, siteCount)
  const parts = [
    `id="${id}"`,
    `row="${row.id}"`,
    `title="${attr(row.title)}"`,
    when ? `when="${attr(when)}"` : '',
    `repeats="${attr(repeat)}"`,
    `status="${row.status === 'proposed' ? NOT_CONFIRMED : 'confirmed'}"`,
    site ? `site="${attr(site)}"` : '',
    row.source_title ? `from="${attr(row.source_title)}"` : `from="${row.source === 'person' ? 'added by hand' : row.source}"`,
    row.has_passed ? 'passed="yes"' : '',
  ].filter(Boolean)
  return `<date ${parts.join(' ')}>${row.source_line ? `\n"${row.source_line.trim()}"\n` : ''}</date>`
}

interface DocRow {
  document_id: string; title: string | null; kind: string | null; issuer: string | null
  doc_date: string | null; scanned_at: string | null; display_status: string; summary: string | null
}
interface ConditionRow { document_id: string; condition_ref: string | null; title: string | null; evidence_expected: string | null }
interface FindingRow { id: string; title: string; quote: string | null; locator: string | null; what_to_do: string | null; basis: string | null }

/** One document's stored reading, as Documents keeps it — the reading, never the file (decision 16). */
export function readingBlock(d: DocRow, conditions: ConditionRow[], id: string): string {
  const head = [
    `id="${id}"`,
    `document="${attr(d.title ?? 'Untitled')}"`,
    d.kind ? `kind="${attr(KIND_WORD[d.kind] ?? d.kind)}"` : '',
    d.issuer ? `issuer="${attr(d.issuer)}"` : '',
    d.doc_date ? `dated="${attr(longDay(d.doc_date))}"` : '',
    d.scanned_at ? `read="${attr(longDay(d.scanned_at))}"` : '',
  ].filter(Boolean).join(' ')
  const asks = conditions
    .map((c) => `- ${[c.condition_ref, c.title, c.evidence_expected].map((x) => String(x ?? '').trim()).filter(Boolean).join(' — ')}`)
    .filter((l) => l !== '- ')
  return `<reading ${head}>\n${d.summary?.trim() || 'No summary was stored for this reading.'}`
    + (asks.length ? `\nWhat this document asks for:\n${asks.join('\n')}` : '')
    + '\n</reading>'
}

export function findingBlock(f: FindingRow, run: string, id: string): string {
  const head = [`id="${id}"`, `audit="${attr(run)}"`, `title="${attr(f.title)}"`, f.locator ? `where="${attr(f.locator)}"` : '']
    .filter(Boolean).join(' ')
  const body = [f.quote ? `"${f.quote.trim()}"` : '', f.basis?.trim() ?? '', f.what_to_do ? `What to do: ${f.what_to_do.trim()}` : '']
    .filter(Boolean).join('\n')
  return `<finding ${head}>\n${body}\n</finding>`
}

/**
 * EVERYTHING THE CALENDAR'S CHAT IS GIVEN. Read as the caller — `calendar_v` and
 * `document_index_v` are `security_invoker`, so RLS decides what comes back and this function
 * never names a company in a filter.
 */
export async function packCalendarContext(db: Db, companyId: string): Promise<PackedContext> {
  const budget = contextBudgetTokens()
  const blocks: ContextBlock[] = [await companyBlock(db, companyId)]
  const passages: Passage[] = []

  // ---- 2. EVERY LIVE DATE (the one filter the tab counts and the badge use) ----
  const { data: dateData, error } = await liveDates(db as never, CALENDAR_VIEW_COLUMNS)
  // §5.1: a read that failed must not look like a calendar with nothing on it. The engine would
  // otherwise answer "you have no dates" to a company with forty.
  if (error) throw new Error(`calendar_v: ${error.message}`)
  const rows = ((dateData ?? []) as unknown as CalendarRow[])
    .slice()
    .sort((a, b) => String(a.next_due ?? '9999').localeCompare(String(b.next_due ?? '9999')))
  const { count: siteCount } = await db.from('entities').select('id', { count: 'exact', head: true })

  const dateCap = Math.floor(budget * DATES_SHARE)
  const dateLines: string[] = []
  let dateTokens = 0
  let datesLeftOut = 0
  rows.forEach((r, i) => {
    const id = `C${i + 1}`
    const line = dateLine(r, id, siteCount ?? 0)
    if (dateTokens + tokensOf(line) > dateCap) { datesLeftOut++; return }
    dateTokens += tokensOf(line)
    dateLines.push(line)
    /**
     * *** EVERY DATE THE MODEL IS SHOWN GETS A PASSAGE, even one with no line to quote. ***
     * The first version made a passage only when `source_line` was stored, so ids and passages
     * were two different namespaces — and the first real run wrote "as dates C6 and C7" with C6
     * left on screen, because C6 was an id nothing could name. A date with nothing stored to
     * quote has an empty `text`, which no quote can match, and a name, which is what the prose
     * needs.
     */
    passages.push({ id, title: `${r.title} — the line this date was read from`, label: 'your calendar',
      text: r.source_line ?? '', href: `/calendar?date=${r.id}`, shortName: r.title })
  })
  const datesNote = datesLeftOut
    ? `${datesLeftOut} further date(s) are on this calendar and are not listed here; say so rather than treating this list as all of them.`
    : ''
  const datesText = `The dates currently on this company's calendar (${rows.length} in all${datesLeftOut ? `, ${rows.length - datesLeftOut} listed` : ''}):\n`
    + (dateLines.join('\n') || 'There are no dates on this calendar yet.')
    + (datesNote ? `\n${datesNote}` : '')
  blocks.push({ name: 'the calendar', text: datesText, chars: datesText.length, tokens: tokensOf(datesText),
    leftOut: datesNote || null })

  // ---- 3. THE READINGS BEHIND THOSE DATES ----
  // Most-used documents first: a document that set four of the dates on screen is likelier to be
  // what the question is about than one that set a single passed date.
  const byDoc = new Map<string, number>()
  for (const r of rows) if (r.document_id) byDoc.set(r.document_id, (byDoc.get(r.document_id) ?? 0) + 1)
  const docIds = [...byDoc.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  let readingsLeftOut = 0
  const readingLines: string[] = []
  if (docIds.length) {
    const [{ data: docs }, { data: conds }] = await Promise.all([
      db.from('document_index_v')
        .select('document_id, title, kind, issuer, doc_date, scanned_at, display_status, summary')
        .in('document_id', docIds),
      db.from('document_conditions')
        .select('document_id, condition_ref, title, evidence_expected')
        .in('document_id', docIds).order('ordinal'),
    ])
    const docById = new Map(((docs ?? []) as DocRow[]).map((d) => [d.document_id, d]))
    const condsFor = (id: string) => ((conds ?? []) as ConditionRow[]).filter((c) => c.document_id === id)
    const cap = Math.floor(budget * READINGS_SHARE)
    let spent = 0
    docIds.forEach((docId, i) => {
      const d = docById.get(docId)
      if (!d) return                        // deleted since the date was filed (decision 14)
      const id = `D${i + 1}`
      const block = readingBlock(d, condsFor(docId), id)
      if (spent + tokensOf(block) > cap) { readingsLeftOut++; return }
      spent += tokensOf(block)
      readingLines.push(block)
      passages.push({ id, title: `${d.title ?? 'A document'} — what we read in it`, label: 'a reading of your document',
        text: block, href: `/documents?document=${docId}`, shortName: d.title ?? 'that document' })
    })
  }
  if (readingLines.length || readingsLeftOut) {
    const note = readingsLeftOut
      ? `${readingsLeftOut} further document reading(s) are on file and are not included here.`
      : ''
    const text = `What we read in the documents those dates came from:\n${readingLines.join('\n\n')}`
      + (note ? `\n\n${note}` : '')
    blocks.push({ name: 'the readings', text, chars: text.length, tokens: tokensOf(text), leftOut: note || null })
  }

  // ---- 4. THE AUDIT FINDINGS BEHIND AUDIT DATES ----
  const findingIds = [...new Set(rows.filter((r) => r.source === 'audit' && r.audit_finding_id)
    .map((r) => r.audit_finding_id as string))]
  if (findingIds.length) {
    const { data: findings } = await db.from('audit_findings')
      .select('id, title, quote, locator, what_to_do, basis').in('id', findingIds)
    const runOf = new Map(rows.filter((r) => r.audit_finding_id)
      .map((r) => [r.audit_finding_id as string, r.source_title ?? 'an audit']))
    const cap = Math.floor(budget * FINDINGS_SHARE)
    let spent = 0
    let leftOut = 0
    const lines: string[] = []
    ;((findings ?? []) as FindingRow[]).forEach((f, i) => {
      const id = `F${i + 1}`
      const block = findingBlock(f, runOf.get(f.id) ?? 'an audit', id)
      if (spent + tokensOf(block) > cap) { leftOut++; return }
      spent += tokensOf(block)
      lines.push(block)
      passages.push({ id, title: `${f.title} — the audit's own words`, label: 'an audit finding', text: block,
        href: null, shortName: f.title })
    })
    if (lines.length || leftOut) {
      const note = leftOut ? `${leftOut} further finding(s) are not included here.` : ''
      const text = `The audit findings those dates came from:\n${lines.join('\n\n')}${note ? `\n\n${note}` : ''}`
      blocks.push({ name: 'the findings', text, chars: text.length, tokens: tokensOf(text), leftOut: note || null })
    }
  }

  return { blocks, passages }
}

/** The Calendar's brief. Five things; `extraStep` is deliberately absent (`lib/ask/brief.ts`). */
export const calendarBrief: Brief = {
  section: 'calendar',
  words: {
    attachLabel: 'Add a document',
    attachHref: '/documents',
    examples: CALENDAR_EXAMPLE_QUESTIONS.map((e) => e.question),
    emptyConversations: 'Ask a question and the answer is kept here, with the dates and documents it drew on.',
    lede: 'Every date your documents set, in one place. Ask when something is due, and we say where the date came from.',
  },
  packContext: (db, companyId) => packCalendarContext(db, companyId),
  promptSentences: CALENDAR_SENTENCES,
  offers: ['add_date'],
}

/**
 * HR'S SUMMARY — ITS SOURCES AND ITS TURNS. HR Step 7 (`docs/HR-PLAN.md` decisions 11, 14, 19; DECISIONS §172).
 *
 * The writer is the workspace's (`lib/summaryReport.ts` summariseTopic, kind 'hr'); this file holds only what
 * HR's summary does differently:
 *   · A HANDBOOK PASSAGE IS A SOURCE. It has no URL, so the workspace's numbering would drop it
 *     (`gatherSources`). It is keyed by its handbook and its normalised quote (the same passage cited twice is
 *     one source), keeps its fields, and is listed for the model with its exact words.
 *   · THE APPENDED GREY LINES COME OFF (`splitAppended`): the day-1 line, the long-handbook lines and the drop
 *     counts are the product talking, not the conversation, and must not become items.
 *   · No re-check of a quote against the handbook as it is now (the owner, Step 7): the quote was checked when
 *     the answer was written, and the basis check finds it in that answer's paragraph.
 *
 * Imports only browser-safe words and the shared quote rule, never `lib/summaryReport.ts`, so there is no cycle.
 */
import { normaliseForQuote } from './documentScan.ts'
import { splitAppended } from './hrAnswerWords.ts'

/** A source as an HR summary carries it: the workspace's triple, and for a handbook passage its fields. */
export interface HrReportSource {
  n: number; title: string; url: string
  kind?: 'web' | 'handbook'; label?: string; quote?: string
  handbook_id?: string; handbook_name?: string; section_title?: string | null
  page_from?: number | null; page_to?: number | null
}

/** The key for a source with no URL: a handbook passage, by its handbook and its words; anything else, none. */
export function hrKeyWithoutUrl(s: Record<string, unknown>): string | null {
  if (s.kind !== 'handbook' || typeof s.quote !== 'string' || !s.quote.trim()) return null
  return `handbook:${String(s.handbook_id ?? s.handbook_name ?? '')}:${normaliseForQuote(s.quote)}`
}

/** The model's list line: a handbook passage with its exact words; a web page as the workspace lists it. */
export function hrLineOf(s: HrReportSource & Record<string, unknown>): string {
  return s.kind === 'handbook' ? `${s.n}. ${s.title} — your handbook: "${s.quote ?? ''}"` : `${s.n}. ${s.title} — ${s.url}`
}

export const HR_SOURCES = { keyWithoutUrl: hrKeyWithoutUrl, keepFields: true, lineOf: hrLineOf }

/** The turns as the summary reads them: each answer without the grey lines the product appended to it. */
export function hrTurns<T extends { role: string; text: string }>(turns: T[]): T[] {
  return turns.map((t) => (t.role === 'assistant' ? { ...t, text: splitAppended(t.text).body } : t))
}

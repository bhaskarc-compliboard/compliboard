/**
 * THE SUMMARY REPORT: ITS SOURCES, ITS CHECK, AND ITS PLAIN TEXT — Workspace Task 5.
 *
 * The rules are pure functions, unit-tested in `tests/unit/summaryReport.test.ts`. The prompt is
 * `prompts/summary-report.ts`. `summariseTopic`, at the foot of this file, is the one writer: it
 * makes the call, runs the check and writes the topic.
 *
 * *** THE SOURCES ARE NUMBERED BY CODE. *** Every answer numbers its own sources from 1, and its
 * `[n]` markers point at its own list. Handed to a model as they are, "[3]" means three different
 * pages in three answers. So: gather every turn's sources, drop duplicates by URL, number them 1..N
 * in order of first appearance, and rewrite each answer's markers into those numbers. The model is
 * then given ONE list and may cite only from it; `checkReport` drops anything else.
 *
 * *** A REPORT THAT FAILS THE CHECK IS REFUSED WHOLE. *** Half a report — the groups without their
 * items, or items whose sources were mangled — shown as though it were the summary is worse than a
 * plain sentence saying the summary could not be written.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
// *** SERVER-SIDE ONLY, BECAUSE OF THIS IMPORT. *** The model client must never reach a browser bundle,
// so no client file imports anything from this file but TYPES (`import type`, erased at build); the
// display words a client needs are in `./summaryWords.ts` (tests/unit/clientImports.test.ts holds both).
import { askAIJson } from './ai.ts'
import { summaryReportPrompt, SUMMARY_PROMPT_ASKS_FOR_BASIS } from '../prompts/summary-report.ts'
import { guardSummaryWrite, CLAIM_COLUMN } from './topicClaim.ts'
// The three display words live in a browser-safe file the summary drawer can import (HR Step 3a);
// re-exported here so every existing caller is unchanged.
import { NO_SOURCE, longDate, AS_OF_LINE, HR_AS_OF_LINE } from './summaryWords.ts'
export { NO_SOURCE, longDate, AS_OF_LINE }
// HR Step 7: the HR summary's pieces (its source key and list line, its turns without the grey lines, its
// prompt). Used only when `summariseTopic` is called with kind 'hr'; the workspace path never reaches them.
import { HR_SOURCES, hrTurns } from './hrSummary.ts'
import { hrSummaryPrompt } from '../prompts/hr-summary.ts'

export interface TurnLike {
  /** The turn's row id, when it has one; a fact's proposal points at the turn its quote came from. */
  id?: string
  role: string
  text: string
  stopped?: boolean | null
  sources?: Array<{ n?: number; title?: string | null; url?: string | null }> | null
  document_name?: string | null
}

export interface ReportSource { n: number; title: string; url: string }

export interface ReportItem {
  name: string
  what_to_do: string
  sources: number[]
  /** Set by the check when the conversation cited nothing for this item. */
  no_source?: true
  /** The words in an answer this item rests on, as the model copied them (changed prompt only). */
  basis?: string
}

export interface SummaryReport {
  title: string
  as_of: string
  situation: string
  applies: Array<{ authority: string; items: ReportItem[] }>
  to_confirm: ReportItem[]
  unanswered: string[]
  facts: Array<{ key: string; value: string; quote: string | null }>
  /** Facts the check refused, and why — said, not silently lost (B3). */
  facts_dropped?: Array<{ key: string; value: string; reason: string }>
  /** The sources the report's items cite, renumbered 1..k in order of first appearance (B4). */
  sources: ReportSource[]
}

export const TITLE_MAX = 70

/**
 * HOW SOURCES ARE KEYED AND LISTED — HR Step 7, ADDITIVE AND OFF BY DEFAULT. With no options every function
 * below runs exactly as before: a source with no URL is dropped, a source is the triple {n, title, url}, and
 * the model's list line is "n. title — url". `lib/checklistConvert.ts` calls them with no options.
 *   keyWithoutUrl  the key for a source that has no URL (HR: a handbook passage); null still drops it
 *   keepFields     keep the stored source's other fields (HR: kind, quote, handbook, section, pages)
 *   lineOf         the model's list line for one source
 */
export interface SourceOptions {
  keyWithoutUrl?: (s: Record<string, unknown>) => string | null
  keepFields?: boolean
  lineOf?: (s: ReportSource & Record<string, unknown>) => string
}

/** One URL, one source: the fragment and a trailing slash do not make a different page. */
export function sourceKey(url: string): string {
  return url.trim().replace(/#.*$/, '').replace(/\/+$/, '')
}

/**
 * Every source of every turn, deduplicated by URL and numbered 1..N in order of first appearance,
 * plus, for each turn, how its own numbers map onto the global ones.
 */
export function gatherSources(turns: TurnLike[], opts?: SourceOptions): { sources: ReportSource[]; perTurn: Array<Map<number, number>> } {
  const sources: ReportSource[] = []
  const byKey = new Map<string, number>()
  const perTurn = turns.map((t) => {
    const map = new Map<number, number>()
    ;(t.sources ?? []).forEach((s, i) => {
      const url = String(s?.url ?? '').trim()
      const key = url ? sourceKey(url) : (opts?.keyWithoutUrl?.(s as unknown as Record<string, unknown>) ?? null)
      if (!key) return
      let n = byKey.get(key)
      if (!n) {
        n = sources.length + 1
        byKey.set(key, n)
        sources.push(opts?.keepFields
          ? { ...(s as unknown as Record<string, unknown>), n, title: String(s?.title ?? '').trim() || url, url } as ReportSource
          : { n, title: String(s?.title ?? '').trim() || url, url })
      }
      map.set(typeof s?.n === 'number' ? s.n : i + 1, n)
    })
    return map
  })
  return { sources, perTurn }
}

/**
 * The transcript the model reads: each answer's markers rewritten into the global numbers, then the
 * one numbered list. A marker with nothing behind it in its own turn is left as it was and is NOT
 * in the list, so the model cannot cite it and the check would drop it.
 */
export function numberedTranscript(turns: TurnLike[], opts?: SourceOptions): { transcript: string; sources: ReportSource[] } {
  const { sources, perTurn } = gatherSources(turns, opts)
  const parts = turns.map((t, i) => {
    const who = t.role === 'user' ? 'USER' : 'ANSWER'
    const text = t.role === 'user' ? t.text
      : t.text.replace(/\[(\d+)\]/g, (m, k) => {
          const g = perTurn[i].get(Number(k))
          return g ? `[${g}]` : m
        })
    return `${who}${t.stopped ? ' (stopped)' : ''}${t.document_name ? ` [attached the file: ${t.document_name}]` : ''}: ${text}`
  })
  const list = sources.length
    ? `SOURCES USED IN THIS CONVERSATION (cite only these numbers):\n${sources.map((s) => (opts?.lineOf ? opts.lineOf(s as ReportSource & Record<string, unknown>) : `${s.n}. ${s.title} — ${s.url}`)).join('\n')}`
    : 'SOURCES USED IN THIS CONVERSATION: none.'
  return { transcript: `${parts.join('\n\n')}\n\n${list}`, sources }
}

/** An item as the model returned it, before its citations are settled. */
type DraftItem = Omit<ReportItem, 'basis'> & { basis: string | null }

/** What the check did to one item's citations — returned beside the report for the person reviewing it. */
export interface ItemCheck {
  where: string
  name: string
  basis: string | null
  /** true: the basis was found in an answer; false: not found (sources cleared); null: no basis asked for. */
  found: boolean | null
  /** In the conversation-wide numbering, before the report's own renumbering. */
  kept: number[]
  dropped: number[]
}

type CheckResult =
  | { ok: true; report: SummaryReport; checks: ItemCheck[] }
  | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : null)

/** Only whole numbers that are in the list; each once; in the order given. */
export function cleanSourceNumbers(v: unknown, count: number): number[] {
  if (!Array.isArray(v)) return []
  const out: number[] = []
  for (const x of v) {
    const n = typeof x === 'number' ? x : typeof x === 'string' && /^\d+$/.test(x.trim()) ? Number(x) : NaN
    if (Number.isInteger(n) && n >= 1 && n <= count && !out.includes(n)) out.push(n)
  }
  return out
}

/**
 * THE TEXT A QUOTE IS COMPARED AGAINST. Whitespace collapsed, `[n]` markers removed, markdown
 * emphasis (`**`, `__`, a lone `*` or `_` around a word) removed — the answers are markdown and a
 * sentence copied out of `**Register as …**` arrives without the asterisks — and LETTER CASE ignored
 * (the owner's decision, 4 October 2026: a quote lifted from mid-sentence comes back capitalised).
 * Nothing else is forgiven: the words, their order and their punctuation must match.
 */
export function normaliseForMatch(s: string): string {
  return s.replace(/\[\d+\]/g, ' ').replace(/\*\*|__/g, '').replace(/(^|\s)[*_](?=\S)|(?<=\S)[*_](?=\s|$|[.,;:])/g, '$1')
    .replace(/\s+/g, ' ').trim().toLowerCase()
}

/** A quote, normalised, and also forgiven ONE trailing full stop — a phrase cut from a sentence gains one. */
export function quoteKey(s: string): string {
  return normaliseForMatch(s).replace(/\.$/, '').trimEnd()
}

/** An answer split into its paragraphs (blocks separated by a blank line), each with its own markers. */
function paragraphs(turn: TurnLike): Array<{ norm: string; markers: number[] }> {
  return turn.text.split(/\n\s*\n/).map((p) => ({
    norm: normaliseForMatch(p),
    markers: [...p.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
  }))
}

/**
 * B1–B2. Where the item's basis is, and which of its citations that place supports.
 *   · no basis asked for (`basisRequired` false, or the field absent under the original prompt):
 *     the numbers are range-checked only, and the check says it did not look;
 *   · a basis that is not in any answer: every source is cleared — the item shows "no source";
 *   · a basis found: only numbers that are markers in THAT paragraph of THAT answer are kept.
 *
 * Exported for the conversation-to-checklist check (`lib/checklistConvert.ts`, Workspace Task 6), which
 * holds its items to the same rule. One copy, so the two can never drift apart.
 */
export function checkCitations(item: { basis: string | null; sources: number[] }, turns: TurnLike[],
  perTurn: Array<Map<number, number>>, basisRequired: boolean): { found: boolean | null; kept: number[]; dropped: number[] } {
  if (!basisRequired && item.basis === null) return { found: null, kept: item.sources, dropped: [] }
  const needle = item.basis ? quoteKey(item.basis) : ''
  if (needle.length >= 8) {
    for (let t = 0; t < turns.length; t++) {
      if (turns[t].role !== 'assistant') continue
      for (const para of paragraphs(turns[t])) {
        if (!para.norm.includes(needle)) continue
        const here = new Set(para.markers.map((k) => perTurn[t].get(k)).filter((g): g is number => !!g))
        return { found: true, kept: item.sources.filter((n) => here.has(n)), dropped: item.sources.filter((n) => !here.has(n)) }
      }
    }
  }
  return { found: false, kept: [], dropped: item.sources }
}

function cleanItem(v: unknown, count: number): (DraftItem) | 'bad' {
  if (!isObj(v)) return 'bad'
  const name = str(v.name)
  const what = str(v.what_to_do)
  if (name === null || what === null) return 'bad'
  if (!Array.isArray(v.sources ?? [])) return 'bad'
  if (v.basis !== undefined && v.basis !== null && typeof v.basis !== 'string') return 'bad'
  return { name, what_to_do: what, sources: cleanSourceNumbers(v.sources ?? [], count), basis: str(v.basis) }
}

/** Trim to the limit at a word where one is near, and never end on a full stop. */
export function trimTitle(title: string, max = TITLE_MAX): string {
  let t = title.replace(/\s+/g, ' ').trim()
  if (t.length > max) {
    const cut = t.slice(0, max)
    const space = cut.lastIndexOf(' ')
    t = (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()
  }
  return t.replace(/[.\s]+$/, '')
}

/**
 * VALIDATE AND CLEAN what the model returned.
 *   · Refuses the whole report when its shape is wrong.
 *   · Source numbers outside the conversation's list are dropped; then B1–B2 (`checkCitations`).
 *   · An item left with no source keeps its place, marked "No source cited in the conversation".
 *   · B3: a fact whose quote is not, word for word, in one of the PERSON's messages is dropped, and
 *     the report records how many and why (`facts_dropped`).
 *   · B4: the report's source list holds only the sources its items cite, renumbered 1..k in order
 *     of first appearance in the report, every item rewritten to match.
 *   · The title is trimmed; `as_of` is the date the code passes.
 */
export function checkReport(raw: unknown, turns: TurnLike[], asOf: string,
  opts: { basisRequired: boolean; sources?: SourceOptions } = { basisRequired: false }): CheckResult {
  const refuse = (why: string): CheckResult => ({ ok: false, error: `The summary came back in a shape we could not use (${why}).` })
  if (!isObj(raw)) return refuse('not an object')
  const title = str(raw.title)
  if (!title) return refuse('no title')
  const situation = str(raw.situation)
  if (situation === null) return refuse('no situation')
  if (!Array.isArray(raw.applies)) return refuse('no list of what applies')
  for (const k of ['to_confirm', 'unanswered', 'facts'] as const) {
    if (raw[k] !== undefined && !Array.isArray(raw[k])) return refuse(`${k} is not a list`)
  }
  const { sources: all, perTurn } = gatherSources(turns, opts.sources)
  const count = all.length
  const checks: ItemCheck[] = []
  const settle = (where: string, c: DraftItem): DraftItem => {
    const r = checkCitations(c, turns, perTurn, opts.basisRequired)
    checks.push({ where, name: c.name, basis: c.basis, found: r.found, kept: r.kept, dropped: r.dropped })
    return { ...c, sources: r.kept }
  }

  const applies: Array<{ authority: string; items: Array<DraftItem> }> = []
  for (const g of raw.applies as unknown[]) {
    if (!isObj(g) || !str(g.authority) || !Array.isArray(g.items)) return refuse('a group without an authority or items')
    const authority = str(g.authority) as string
    const items: Array<DraftItem> = []
    for (const it of g.items as unknown[]) {
      const c = cleanItem(it, count)
      if (c === 'bad') return refuse('an item without a name or what to do')
      if (c.name) items.push(settle(authority, c))
    }
    if (items.length) applies.push({ authority, items })
  }

  const confirm: Array<DraftItem> = []
  for (const it of (raw.to_confirm ?? []) as unknown[]) {
    const c = cleanItem(it, count)
    if (c === 'bad') return refuse('a "to confirm" item without a name or what to do')
    if (c.name) confirm.push(settle('Still to confirm', c))
  }

  const unanswered: string[] = []
  for (const q of (raw.unanswered ?? []) as unknown[]) {
    const s = str(q)
    if (s === null) return refuse('an unanswered question that is not text')
    if (s) unanswered.push(s)
  }

  // B3 — a fact stands only on the person's own words.
  const said = turns.filter((t) => t.role === 'user').map((t) => normaliseForMatch(t.text))
  const facts: SummaryReport['facts'] = []
  const facts_dropped: NonNullable<SummaryReport['facts_dropped']> = []
  for (const f of (raw.facts ?? []) as unknown[]) {
    if (!isObj(f)) return refuse('a fact that is not an object')
    const key = str(f.key), value = str(f.value), quote = str(f.quote)
    if (!key || !value) continue          // a fact with no key or value is not a fact; nothing is proposed
    const q = quote ? quoteKey(quote) : ''
    if (!q || !said.some((u) => u.includes(q))) {
      facts_dropped.push({ key: key.slice(0, 120), value: value.slice(0, 500),
        reason: q ? 'its quote is not in any of your messages' : 'it has no quote' })
      continue
    }
    facts.push({ key: key.slice(0, 120), value: value.slice(0, 500), quote: (quote as string).slice(0, 2000) })
  }

  // B4 — only the sources the report cites, renumbered 1..k in order of first appearance.
  const order: number[] = []
  for (const it of [...applies.flatMap((g) => g.items), ...confirm]) for (const n of it.sources) if (!order.includes(n)) order.push(n)
  const to = new Map(order.map((n, i) => [n, i + 1]))
  const finish = (it: DraftItem): ReportItem => {
    const nums = it.sources.map((n) => to.get(n) as number)
    const out: ReportItem = { name: it.name, what_to_do: it.what_to_do, sources: nums }
    if (it.basis) out.basis = it.basis
    if (!nums.length) out.no_source = true
    return out
  }

  return {
    ok: true,
    checks,
    report: {
      title: trimTitle(title), as_of: asOf, situation,
      applies: applies.map((g) => ({ authority: g.authority, items: g.items.map(finish) })),
      to_confirm: confirm.map(finish), unanswered, facts,
      ...(facts_dropped.length ? { facts_dropped } : {}),
      sources: order.map((n, i) => ({ ...all[n - 1], n: i + 1 })),
    },
  }
}

const cites = (it: ReportItem) => (it.sources.length
  ? ` (${it.sources.length === 1 ? 'source' : 'sources'} ${it.sources.join(', ')})` : ` (${NO_SOURCE.toLowerCase()})`)

/**
 * THE PLAIN-TEXT RENDERING, for `topics.summary`, which every older reader reads. Source numbers are
 * written as "(source 1)" or "(sources 1, 3)", not "[1]": the drawer renders a summary's text through `AnswerBody`,
 * which turns "[1]" into a citation marker, and a text summary carries no source list for it.
 */
/** HR Step 7, additive: the plain text's words and source line. With none, the workspace's, exactly as before. */
export interface PlainTextWords {
  asOf?: (asOf: string) => string
  applies?: string
  sourceLine?: (s: ReportSource & Record<string, unknown>) => string
}

export function renderPlainText(r: SummaryReport, words?: PlainTextWords): string {
  const out: string[] = [r.title, '', (words?.asOf ?? AS_OF_LINE)(r.as_of), '', 'Your situation', r.situation]
  if (r.applies.length) {
    out.push('', words?.applies ?? 'What applies')
    for (const g of r.applies) {
      out.push('', g.authority)
      for (const it of g.items) out.push(`- ${it.name}: ${it.what_to_do}${cites(it)}`)
    }
  }
  if (r.to_confirm.length) {
    out.push('', 'Still to confirm')
    for (const it of r.to_confirm) out.push(`- ${it.name}: ${it.what_to_do}${cites(it)}`)
  }
  if (r.unanswered.length) {
    out.push('', 'Asked and not answered')
    for (const q of r.unanswered) out.push(`- ${q}`)
  }
  if (r.sources.length) {
    out.push('', 'Sources')
    for (const s of r.sources) out.push(words?.sourceLine ? words.sourceLine(s as ReportSource & Record<string, unknown>) : `${s.n}. ${s.title} — ${s.url}`)
  }
  return out.join('\n')
}

/**
 * WHICH FACTS BECOME NEW PROPOSALS. The report's facts, minus any that already wait as a pending
 * proposal for the same conversation with the same key and value — so summarising twice never puts
 * the same question in front of the person twice. Each keeps the turn its quote came from, as the
 * nightly job always did (`from_turn_id`), so Company information can say where it was read.
 */
export function proposalsToInsert(
  facts: SummaryReport['facts'],
  pending: Array<{ switch_key: string; proposed_value: string }>,
  turns: TurnLike[], ids: { topicId: string; companyId: string },
): Array<Record<string, unknown>> {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const out: Array<Record<string, unknown>> = []
  for (const f of facts) {
    const dup = pending.some((p) => same(p.switch_key, f.key) && same(p.proposed_value, f.value))
      || out.some((o) => same(String(o.switch_key), f.key) && same(String(o.proposed_value), f.value))
    if (dup) continue
    const q = f.quote ? quoteKey(f.quote) : ''
    const from = q ? turns.find((t) => t.role === 'user' && normaliseForMatch(t.text).includes(q)) : undefined
    out.push({
      company_id: ids.companyId, topic_id: ids.topicId, source: 'conversation',
      switch_key: f.key, proposed_value: f.value, quote: f.quote, from_turn_id: from?.id ?? null,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// THE WRITER — one call, checked, written in one update, then the facts proposed. Shared by the
// "Summarise this conversation" route and the nightly job (`app/api/jobs/summarise/route.ts`).
// ---------------------------------------------------------------------------

type Db = SupabaseClient<any, any, any>   // eslint-disable-line @typescript-eslint/no-explicit-any

export async function summariseTopic(db: Db, admin: Db, args: {
  topicId: string; companyId: string; title: string | null; turns: TurnLike[]
  source: 'user' | 'nightly'; today?: string
  /**
   * HR Step 7, additive. 'hr': HR's prompt, the turns without their appended grey lines, handbook passages
   * kept as sources (`lib/hrSummary.ts`), and HR's words in the plain text. Absent or 'workspace': exactly
   * as before.
   */
  kind?: 'workspace' | 'hr'
  /** Columns only the nightly job sets beside the summary (`idle_at`, `extracted_at`). */
  extra?: Record<string, unknown>
  /**
   * THE CONDITIONAL SAVE — Workspace Stage 4 (`lib/topicClaim.ts`). The claim this run holds and the
   * `summarised_at` it read. The update matches only while both are unchanged, and clears the claim
   * in the same statement; no match means another run's work landed or took over, so nothing is
   * written, no fact is proposed, and `skipped` says why.
   */
  guard: { claimedAt: string; summarisedAt: string | null }
}): Promise<{ ok: true; report: SummaryReport; checks: ItemCheck[]; proposed: number }
  | { ok: false; error: string; skipped?: true }> {
  const today = args.today ?? new Date().toISOString().slice(0, 10)
  const hr = args.kind === 'hr'
  const turns = hr ? hrTurns(args.turns) : args.turns
  const { transcript } = numberedTranscript(turns, hr ? HR_SOURCES : undefined)
  const raw = await askAIJson<unknown>(
    hr ? hrSummaryPrompt(today) : summaryReportPrompt(today),
    `Conversation title: ${args.title ?? '(none)'}\n\n${transcript}`,
    // 12,000, not 4,000 — the owner's decision of 4 October 2026 (CLAUDE.md §3.1). With a "basis" on
    // every item the report is long, and at 4,000 an Opus run paid for a truncated first attempt
    // before `lib/ai.ts` retried it larger (run C2, Workspace Task 5).
    { maxTokens: 12000, task: 'summary', ledger: { companyId: args.companyId, task: 'summarise' } },
  )
  const checked = checkReport(raw, turns, today, { basisRequired: SUMMARY_PROMPT_ASKS_FOR_BASIS, ...(hr ? { sources: HR_SOURCES } : {}) })
  if (!checked.ok) return checked
  const { data: written, error } = await guardSummaryWrite(db.from('topics').update({
    summary_report: checked.report,
    summary: hr ? renderPlainText(checked.report, { asOf: HR_AS_OF_LINE, applies: 'What to change', sourceLine: HR_SOURCES.lineOf })
      : renderPlainText(checked.report),
    title: checked.report.title,
    summarised_at: new Date().toISOString(),
    summary_source: args.source,
    // The claim ends with the write, in the same statement, so no reader ever sees the summary
    // landed and the claim still held, or the claim gone and the summary not yet there.
    [CLAIM_COLUMN.summary]: null,
    ...(args.extra ?? {}),
  }).eq('id', args.topicId), args.guard).select('id')
  if (error) throw new Error(`writing the summary: ${error.message}`)
  if (!written?.length) {
    return { ok: false, skipped: true,
      error: 'the conversation changed while this summary was written (another summary landed, or this run lost its claim); nothing was written' }
  }

  // THE FACTS, PROPOSED — never written (§108). *** THE SERVICE ROLE, AS A NAMED STATEMENT
  // (CLAUDE.md §3.6). *** `authenticated` holds no INSERT on fact_proposals (migration 034), on purpose:
  // a person must not be able to propose facts about themselves through a channel built for review.
  // The pending read that guards against duplicates is scoped to this conversation.
  const { data: pending, error: pErr } = await admin.from('fact_proposals')
    .select('switch_key, proposed_value').eq('topic_id', args.topicId).eq('status', 'proposed')
  if (pErr) throw new Error(`reading pending proposals: ${pErr.message}`)
  const rows = proposalsToInsert(checked.report.facts, pending ?? [], turns,
    { topicId: args.topicId, companyId: args.companyId })
  // ONE ROW AT A TIME, AND A DUPLICATE IS NOT AN ERROR. Migration 065's unique index is the guarantee
  // the read above cannot give on its own (two writers can both read "none pending"); a row it refuses
  // (23505) is a proposal already waiting, which is the outcome the read was trying to reach anyway.
  let proposed = 0
  for (const row of rows) {
    const { error: iErr } = await admin.from('fact_proposals').insert(row)
    if (iErr && iErr.code !== '23505') throw new Error(`writing proposals: ${iErr.message}`)
    if (!iErr) proposed++
  }
  return { ...checked, proposed }
}

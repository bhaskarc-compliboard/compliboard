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
import { longDate, AS_OF_LINE, HR_AS_OF_LINE, NO_SITUATION } from './summaryWords.ts'
export { longDate, AS_OF_LINE }
// HR Step 7: the HR summary's pieces (its source key and list line, its turns without the grey lines, its
// prompt). Used only when `summariseTopic` is called with kind 'hr'; the workspace path never reaches them.
import { HR_SOURCES, hrTurns } from './hrSummary.ts'
import { PASSAGE_SOURCES } from './sourceTitle.ts'
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
  /**
   * *** THE KEY A `to_confirm` ITEM WOULD BE SETTLED BY — E2a item 3, and NOTHING SETS IT YET. ***
   * Company information keys every waiting question by a switch or fact key, and the summary's
   * link to "the exact waiting question" can only be built from that key (`confirmHref`). The
   * prompt asks for a key on a FACT, not on an item, so this is optional and absent on every
   * stored report: an item without one links to the page. Adding it is a prompt change (§3.1).
   */
  key?: string
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
type DraftItem = Omit<ReportItem, 'basis' | 'key'> & { basis: string | null; key: string | null }

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
  /** E2c item 2: the numbers the item did not cite and inherited from where its basis sits. */
  inherited?: number[]
  /** Which of the two it inherited from — the paragraph (E2c) or the whole answer (E2d). */
  inheritedFrom?: 'paragraph' | 'answer'
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
 * *** AND WITH `inherit`, AN ITEM THAT IS LEFT CITING NOTHING TAKES THE PARAGRAPH'S OWN NUMBERS —
 * E2c item 2, 5 November 2026. ***
 *
 * The measured problem: E2b's re-summary of the Calendar permit conversation cited nothing on any
 * of its six items, so every item read *"No source cited in the conversation"* — about a
 * conversation whose every answer carried two or three citations. The item's `basis` is copied
 * from one sentence of one answer, and this function has already FOUND that sentence; the
 * paragraph it sits in carries its own `[n]` markers. Those are the sources the sentence rests on,
 * whatever the model did or did not repeat in its `sources` array.
 *
 * **Nothing is invented and nothing is guessed.** A source is inherited only from the paragraph
 * the item's own words were copied out of — the same paragraph whose markers B2 uses to DROP a
 * number. An item whose basis is not in any answer inherits nothing, an item with no basis
 * inherits nothing, and a paragraph with no markers gives nothing. What the item cited and lost is
 * still reported in `dropped`, and what it gained is reported in `inherited`, so the record says
 * which numbers the model chose and which the code supplied.
 *
 * *** AND THE SAME WORDS ARE USUALLY IN THE ANSWER TWICE, WHICH IS WHY THE OCCURRENCE MATTERS. ***
 * Read off staging, Calendar conversation `aa50ee49`: the basis *"Renewal Application Due 60 days
 * prior to expiration"* appears in **three** paragraphs of that conversation — a markdown table
 * listing what the permit says, which carries NO marker, and twice more in sentences that carry
 * one. The original rule took the first occurrence, which is the table, so an item was held to a
 * paragraph that cites nothing: **a correctly cited number was being DROPPED**, not merely left
 * uninherited. With the option, the paragraph that cited the sentence decides, and the LAST such
 * paragraph wins — the same "latest state" the prompt's rule 3 and its rule 5 ask for (*"quote the
 * place where it is cited, not a summary paragraph that repeats it"*). Without it, the first
 * occurrence still decides, unchanged.
 *
 * *** AND WHEN NO PARAGRAPH THE SENTENCE IS IN CITES ANYTHING, THE ANSWER'S OWN SOURCES — E2d,
 * 5 November 2026, the owner's call made. *** E2c measured this exact widening and left it open:
 * on the Calendar permit conversation it is the difference between **0 of 6 items carrying a
 * source and 3 of 6**. The item's words came out of this answer, and these are the sources this
 * answer rested on — true, and a weaker claim than a marker in the paragraph, which is why it is
 * the second choice and why `inheritedFrom` records which of the two it was.
 *
 * *** THE CHECKLIST IS DELIBERATELY NOT GIVEN IT. *** `lib/checklistConvert.ts` calls this with no
 * options and keeps today's behaviour: its items write `checklist_items.sources` and `source_url`,
 * rows a person ticks and a later run reads, and E2c's brief is about the summary's items. One
 * copy of the rule, with the difference in one flag rather than in two implementations.
 *
 * Exported for the conversation-to-checklist check (`lib/checklistConvert.ts`, Workspace Task 6), which
 * holds its items to the same rule. One copy, so the two can never drift apart.
 */
export function checkCitations(item: { basis: string | null; sources: number[] }, turns: TurnLike[],
  perTurn: Array<Map<number, number>>, basisRequired: boolean,
  opts: { inherit?: boolean } = {}):
  { found: boolean | null; kept: number[]; dropped: number[]; inherited?: number[]; inheritedFrom?: 'paragraph' | 'answer' } {
  if (!basisRequired && item.basis === null) return { found: null, kept: item.sources, dropped: [] }
  const needle = item.basis ? quoteKey(item.basis) : ''
  if (needle.length >= 8) {
    /**
     * Every paragraph the basis appears in, in order, each as the global numbers it cites. Under
     * the original rule only the FIRST was ever looked at, and the loop stopped there.
     */
    const hits: Array<{ t: number; here: Set<number> }> = []
    for (let t = 0; t < turns.length && !(hits.length && !opts.inherit); t++) {
      if (turns[t].role !== 'assistant') continue
      for (const para of paragraphs(turns[t])) {
        if (!para.norm.includes(needle)) continue
        hits.push({ t, here: new Set(para.markers.map((k) => perTurn[t].get(k)).filter((g): g is number => !!g)) })
        if (!opts.inherit) break
      }
    }
    if (hits.length) {
      // *** WHICH OCCURRENCE DECIDES — E2c item 2. *** The paragraph that CITED the sentence, and
      // the last such paragraph, which is the latest state. Without the option, the first
      // occurrence, exactly as before.
      const cited = [...hits].reverse().find((h) => h.here.size)
      const here = opts.inherit ? (cited?.here ?? hits[0].here) : hits[0].here
      const kept = item.sources.filter((n) => here.has(n))
      const dropped = item.sources.filter((n) => !here.has(n))
      // *** THE ITEM THAT CITES NOTHING INHERITS WHERE ITS SENTENCE CAME FROM. ***
      if (!kept.length && opts.inherit) {
        if (here.size) return { found: true, kept: [...here], dropped, inherited: [...here], inheritedFrom: 'paragraph' }
        /**
         * *** AND WHEN NO PARAGRAPH THE SENTENCE IS IN CITES ANYTHING, THE ANSWER'S OWN — E2d. ***
         * The sentence came out of this answer, and these are the sources this answer rested on.
         * Weaker than a marker in the paragraph, which is why it is second and why the check says
         * which of the two it was. The LAST answer the words are in, for the same "latest state".
         */
        const last = hits[hits.length - 1]
        const mine = [...new Set(perTurn[last.t].values())]
        if (mine.length) return { found: true, kept: mine, dropped, inherited: mine, inheritedFrom: 'answer' }
      }
      return { found: true, kept, dropped }
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
  return { name, what_to_do: what, sources: cleanSourceNumbers(v.sources ?? [], count), basis: str(v.basis),
    // E2b item 2: the switch key this item would settle, checked against the waiting list below.
    key: str(v.key) }
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
 *   · An item left with no source INHERITS the sources of the paragraph its basis sits in (E2c
 *     item 2); one that still has none keeps its place, marked "No source cited in the conversation".
 *   · B3: a fact whose quote is not, word for word, in one of the PERSON's messages is dropped, and
 *     the report records how many and why (`facts_dropped`).
 *   · B4, as E2f rewrote it: the report's source list is EVERY source the conversation rested on,
 *     deduplicated and numbered in order of first appearance — not only the ones its items cite,
 *     because no item shows a source any more and this one list is the whole of what a summary
 *     says about where it stands.
 *   · The title is trimmed; `as_of` is the date the code passes.
 */
export function checkReport(raw: unknown, turns: TurnLike[], asOf: string,
  opts: {
    basisRequired: boolean; sources?: SourceOptions
    /**
     * *** E2b item 2: THE ONLY KEYS AN ITEM MAY CARRY. *** The keys this company has waiting, as
     * `/api/to-confirm` returns them. A key the model wrote that is not in this list is dropped,
     * not kept: the key is what sends a person straight to one question, and a wrong one sends
     * them to the wrong question — which is worse than sending them to the page. Absent (the
     * nightly job, a section with nothing waiting) means every key is dropped.
     */
    allowedKeys?: readonly string[]
  } = { basisRequired: false }): CheckResult {
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
    // E2c item 2: a summary's item inherits its paragraph's sources when it cites none of its own.
    const r = checkCitations(c, turns, perTurn, opts.basisRequired, { inherit: true })
    checks.push({ where, name: c.name, basis: c.basis, found: r.found, kept: r.kept, dropped: r.dropped,
      ...(r.inherited?.length ? { inherited: r.inherited, inheritedFrom: r.inheritedFrom } : {}) })
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

  /**
   * *** B4, REPLACED AT E2f: THE LIST IS EVERYTHING THE CONVERSATION RESTED ON. ***
   *
   * It was "only the sources the report cites, renumbered 1..k". That was right while every item
   * carried its own source line: the list was the key to the lines. E2f takes the lines away —
   * **a summary proves itself with ONE source list** — and a list built from what the items
   * happened to cite is then the wrong list: the Calendar permit conversation rested on four
   * documents and dates, its items cited none, and its summary would show no sources at all
   * about a conversation with four.
   *
   * So the list is `all` — every source of every turn, deduplicated and numbered by
   * `gatherSources` in order of first appearance. An item's own numbers are left pointing at that
   * same numbering (they are stored and unused; nothing renumbers behind them).
   */
  const allowed = new Set(opts.allowedKeys ?? [])
  const finish = (it: DraftItem): ReportItem => {
    const nums = it.sources
    const out: ReportItem = { name: it.name, what_to_do: it.what_to_do, sources: nums }
    if (it.basis) out.basis = it.basis
    // Only a key the page is actually waiting on survives (E2b item 2).
    if (it.key && allowed.has(it.key)) out.key = it.key
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
      sources: all,
    },
  }
}

/**
 * THE PLAIN-TEXT RENDERING, for `topics.summary`, which every older reader reads.
 *
 * *** E2f: IT IS THE SAME FOUR SECTIONS, IN THE SAME ORDER, AS THE CARDS. *** It used to write a
 * source list after every item — "(source 1)", or "(no source cited in the conversation)" — and
 * the whole of E2f is that a summary says where it stands ONCE, in one list, and nothing else
 * about sources. So an item is its name and its sentence here too, Sources follows What applies,
 * and "Asked and not answered" is gone with its card (decision 65). `summary_report` still holds
 * `unanswered` and still holds each item's own `sources`; nothing is lost, and only this
 * rendering changed.
 */
/** HR Step 7, additive: the plain text's words and source line. With none, the workspace's, exactly as before. */
export interface PlainTextWords {
  asOf?: (asOf: string) => string
  applies?: string
  sourceLine?: (s: ReportSource & Record<string, unknown>) => string
}

export function renderPlainText(r: SummaryReport, words?: PlainTextWords): string {
  const out: string[] = [r.title, '', (words?.asOf ?? AS_OF_LINE)(r.as_of), '', 'Your situation', r.situation.trim() || NO_SITUATION]
  if (r.applies.length) {
    out.push('', words?.applies ?? 'What applies')
    for (const g of r.applies) {
      out.push('', g.authority)
      for (const it of g.items) out.push(`- ${it.name}: ${it.what_to_do}`)
    }
  }
  if (r.sources.length) {
    out.push('', 'Sources')
    for (const s of r.sources) out.push(words?.sourceLine ? words.sourceLine(s as ReportSource & Record<string, unknown>) : `${s.n}. ${s.title} — ${s.url}`)
  }
  if (r.to_confirm.length) {
    out.push('', 'Still to confirm')
    for (const it of r.to_confirm) out.push(`- ${it.name}: ${it.what_to_do}`)
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
  /**
   * *** WHAT THE SUMMARISER IS SHOWN BESIDES THE CONVERSATION — E2b item 6, §3.1, approved. ***
   *
   * `about` is the company block the section's own brief already sends to the ANSWER
   * (`lib/ask/engine.ts` `companyBlock`): the same text, so a summary and the answers it
   * summarises are working from one description of the business. It fills "Your situation" on a
   * Documents, Audits or Calendar summary, where the person rarely states their headcount in the
   * conversation because the product already knows it — and where the card therefore used to read
   * *"No details about your business came up in this conversation."* about a company the product
   * has read nineteen documents of.
   *
   * `waiting` is what Company information has waiting, keys and all, so a `to_confirm` item can
   * name the question it would settle. The model may use no other key, and `checkReport` drops one
   * that is not in this list.
   *
   * Both are absent for the Workspace and for HR, which are byte-for-byte unchanged.
   */
  about?: string | null
  waiting?: ReadonlyArray<{ key: string; question: string }>
  /** The section's own as-of line for the stored plain text (E2b item 6). */
  asOfLine?: (asOf: string) => string
}): Promise<{ ok: true; report: SummaryReport; checks: ItemCheck[]; proposed: number }
  | { ok: false; error: string; skipped?: true }> {
  const today = args.today ?? new Date().toISOString().slice(0, 10)
  const hr = args.kind === 'hr'
  const turns = hr ? hrTurns(args.turns) : args.turns
  /**
   * *** EVERY SECTION KEEPS A SOURCE OF ITS OWN NOW — E2a, 4 November 2026. ***
   * It was `hr ? HR_SOURCES : undefined`, and `undefined` meant "drop every source without a URL":
   * a document or an audit cited in the conversation never reached the summary, so decision 63's
   * in-place swap had nothing to open. `PASSAGE_SOURCES` is HR's shape with HR's handbook rule
   * swapped for the address rule (`lib/sourceTitle.ts`). A web source is keyed and listed exactly
   * as it always was.
   */
  const { transcript } = numberedTranscript(turns, hr ? HR_SOURCES : PASSAGE_SOURCES)
  /**
   * The two blocks E2b item 6 adds, each only when the caller has one. Written out here rather
   * than inside the prompt so `ASK_DUMP_DIR` shows exactly what the model was handed.
   */
  const about = args.about?.trim()
    ? `About the company (what the product already holds about this business):\n${args.about.trim()}\n\n`
    : ''
  const waiting = args.waiting?.length
    ? 'Questions already waiting on Company information, with the key that settles each:\n'
      + args.waiting.map((w) => `- ${w.key}: ${w.question}`).join('\n') + '\n\n'
    : ''
  const raw = await askAIJson<unknown>(
    hr ? hrSummaryPrompt(today) : summaryReportPrompt(today),
    `Conversation title: ${args.title ?? '(none)'}\n\n${about}${waiting}${transcript}`,
    // 12,000, not 4,000 — the owner's decision of 4 October 2026 (CLAUDE.md §3.1). With a "basis" on
    // every item the report is long, and at 4,000 an Opus run paid for a truncated first attempt
    // before `lib/ai.ts` retried it larger (run C2, Workspace Task 5).
    { maxTokens: 12000, task: 'summary', ledger: { companyId: args.companyId, task: 'summarise' } },
  )
  const checked = checkReport(raw, turns, today, {
    basisRequired: SUMMARY_PROMPT_ASKS_FOR_BASIS,
    sources: hr ? HR_SOURCES : PASSAGE_SOURCES,
    allowedKeys: (args.waiting ?? []).map((w) => w.key),
  })
  if (!checked.ok) return checked
  const { data: written, error } = await guardSummaryWrite(db.from('topics').update({
    summary_report: checked.report,
    summary: hr ? renderPlainText(checked.report, { asOf: HR_AS_OF_LINE, applies: 'What to change', sourceLine: HR_SOURCES.lineOf })
      // The same line rule in the plain text, or a document would print as "3. Title — " with a
      // dangling dash where a web page has its address.
      : renderPlainText(checked.report,
          { sourceLine: PASSAGE_SOURCES.lineOf, ...(args.asOfLine ? { asOf: args.asOfLine } : {}) }),
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

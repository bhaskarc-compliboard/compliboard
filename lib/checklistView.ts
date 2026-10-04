/**
 * HOW A CHECKLIST IS SHOWN — Workspace Task 6, boards 8 and 9. Pure, and safe for the browser: it
 * imports only `lib/sourceTitle.ts`, which imports nothing. The page (`app/compliance/page.tsx`) and the "How do I do this?" route share it;
 * `tests/unit/checklistView.test.ts` holds it.
 *
 * THREE GROUPS, in this order: Must do (numbered, legal obligations in the order to do them), Worth
 * doing (advice, stored as `good_to_have`), To confirm (open questions). An empty group is not shown.
 * Checklists from Documents and Audits use the first two categories only and open in the same drawer.
 */
import { displaySource } from './sourceTitle.ts'

export interface ViewGroup {
  key: string
  title: string
  hint: (n: number) => string
  /** Must do is numbered: the order is the point. */
  numbered: boolean
  /** Whether each item offers "How do I do this?". Advice does not; obligations and open questions do. */
  howTo: boolean
}

export const VIEW_GROUPS: readonly ViewGroup[] = [
  { key: 'must_do', title: 'Must do', hint: (n) => `in the order to do them · ${n}`, numbered: true, howTo: true },
  { key: 'good_to_have', title: 'Worth doing', hint: (n) => `advice, not a legal rule · ${n}`, numbered: false, howTo: false },
  { key: 'to_confirm', title: 'To confirm', hint: (n) => `open questions · ${n}`, numbered: false, howTo: true },
]

/**
 * *** NUMBERING TELLS THE TRUTH — the owner, Workspace Task 6 Part C. ***
 *
 * "In the order to do them" is a promise only the workspace's own writers make: the conversion and
 * the box prompts are told to put Must do in the order the person has to act. A Documents checklist
 * is in the order of the gaps, an Audits one in the order of the findings. So their Must do is not
 * numbered, and its hint is "required · N".
 *
 * HOW THEY ARE TOLD APART, by fields their writers set:
 *   · `checklists.document_id` — set by `/api/document-checklist` (`:114`) and by nothing else;
 *   · `checklist_items.origin = 'document'` — set on every item by `/api/document-checklist` (`:88`)
 *     and `/api/audit-checklist` (`:72`), and by no workspace writer.
 * The second is needed because NO checklist column marks an Audits checklist: that route writes
 * `document_id: null` (`:60`), exactly as the box does, and says it has no `audit_run_id` (`:11–15`).
 */
export function madeInWorkspace(checklist: { document_id?: string | null }, items: Array<{ origin: string | null }>): boolean {
  return !checklist.document_id && !items.some((i) => i.origin === 'document')
}

const REQUIRED_MUST_DO: ViewGroup = {
  key: 'must_do', title: 'Must do', hint: (n) => `required · ${n}`, numbered: false, howTo: true,
}

/**
 * The items in their groups, each group in the items' own order, empty groups left out. A category
 * none of the three knows is not dropped: it gets a group of its own, named as stored, so a row
 * written by some future writer is still seen. `ordered` false (a Documents or Audits checklist):
 * Must do is not numbered and says "required · N".
 */
export function groupItems<T extends { category: string }>(items: T[], opts: { ordered: boolean } = { ordered: true }):
  Array<{ group: ViewGroup; items: T[] }> {
  const out: Array<{ group: ViewGroup; items: T[] }> = []
  for (const g of VIEW_GROUPS) {
    const these = items.filter((i) => i.category === g.key)
    if (these.length) out.push({ group: g.key === 'must_do' && !opts.ordered ? REQUIRED_MUST_DO : g, items: these })
  }
  const known = new Set(VIEW_GROUPS.map((g) => g.key))
  for (const cat of [...new Set(items.map((i) => i.category).filter((c) => !known.has(c)))]) {
    out.push({ group: { key: cat, title: cat, hint: (n) => String(n), numbered: false, howTo: false },
      items: items.filter((i) => i.category === cat) })
  }
  return out
}

/** "2 of 17 must-dos done" — the drawer's progress and the Checklists tab count Must do only. */
export function mustDoLabel(total: number, done: number): string {
  if (total <= 0) return 'No must-dos'
  return `${done} of ${total} must-do${total === 1 ? '' : 's'} done`
}

/** A copy of `lib/summaryReport.ts` NO_SOURCE (that file is server-only); pinned by the test. */
export const NO_SOURCE = 'No source cited in the conversation'
/** An item "Everything on this subject" added whose link failed the search check (`checkAddedLinks`). */
export const NO_SOURCE_FOUND = 'No source found'
/** An item with no source and no conversation behind it: the box checklist's own items. */
export const NO_SOURCE_GIVEN = 'No source given'

export function noSourceText(origin: string | null): string {
  if (origin === 'conversation') return NO_SOURCE
  if (origin === 'added') return NO_SOURCE_FOUND
  return NO_SOURCE_GIVEN
}

export interface ViewSource { title: string; url: string | null; label?: 'official' | 'other' }

/**
 * The sources an item shows: the `sources` list when it has one (Task 6 writers), otherwise its one
 * `source_url`, otherwise — for a Documents or Audits item — its `source_title` alone, which names
 * the document or audit and has no public page to link to.
 */
export function itemSources(item: { sources?: unknown; source_url: string | null; source_title: string | null }): ViewSource[] {
  if (Array.isArray(item.sources) && item.sources.length) {
    return (item.sources as Array<{ title?: string; url?: string; label?: 'official' | 'other' }>)
      .filter((s) => s?.url)
      .map((s) => ({ title: s.title || String(s.url), url: String(s.url), ...(s.label ? { label: s.label } : {}) }))
  }
  if (item.source_url) return [{ title: item.source_title || item.source_url, url: item.source_url }]
  if (item.source_title) return [{ title: item.source_title, url: null }]
  return []
}

/**
 * A claim older than this is a run that died without clearing it. The route uses the same number to
 * let a new run past it, so the page never shows a spinner the route would not honour.
 */
export const HOWTO_LOCK_MS = 10 * 60_000

export function isResearching(startedAt: string | null | undefined, now = Date.now()): boolean {
  if (!startedAt) return false
  const t = Date.parse(startedAt)
  return Number.isFinite(t) && now - t < HOWTO_LOCK_MS
}

/** "4 October 2026". */
export function longDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "How to do it · checked against 2 sources on 4 October 2026". */
export function howToHeading(sources: number, checkedOn: string): string {
  return `How to do it · checked against ${sources} source${sources === 1 ? '' : 's'} on ${longDay(checkedOn)}`
}

/** Each different page a step cites, numbered 1..k in order of first use. */
export function stepSourceNumbers(steps: Array<{ url: string }>, key: (u: string) => string): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of steps) { const k = key(s.url); if (!m.has(k)) m.set(k, m.size + 1) }
  return m
}

// ---------------------------------------------------------------------------
// ONE-LINE SOURCE LINKS — Workspace Stage 2 (the canvas feature boards, 6b and 8).
// ---------------------------------------------------------------------------

/**
 * A SOURCE ON ONE LINE: "[n] host · title". The title is the page's own (`displaySource`, which
 * already replaces junk titles from the URL), cut down to its subject:
 *   · a site prefix ending in " :: " goes — "eCFR :: 27 CFR Part 17 -- …" keeps the part after the
 *     LAST " :: ", which on eCFR, the Federal Register and Justia is the rule itself;
 *   · a trailing " | Site name" goes, always: a pipe in a page title is almost always the site;
 *   · a trailing " - Site name" goes ONLY when the tail is the site — it has a dot ("CCOF.org") or
 *     names the host ("Oregon.gov" on oregon.gov) — because " - " is also how statutes title
 *     themselves ("Chapter 471 - Alcoholic Liquors"), and that half is the subject.
 * Nothing is ever cut down to nothing: if a rule would leave fewer than 4 characters, it is skipped.
 * `full` is the cleaned title before any cut, for the link's hover text and for print.
 */

export function shortTitle(title: string, host: string): string {
  let t = title.replace(/\s+/g, ' ').trim()
  const keep = (next: string) => { if (next.trim().length >= 4) t = next.trim() }
  if (t.includes(' :: ')) keep(t.slice(t.lastIndexOf(' :: ') + 4))
  const pipe = t.lastIndexOf(' | ')
  if (pipe > 0) keep(t.slice(0, pipe))
  const dash = t.lastIndexOf(' - ')
  if (dash > 0) {
    const tail = t.slice(dash + 3).trim().toLowerCase()
    const site = host.toLowerCase().split('.').slice(-2, -1)[0] ?? ''
    if (/\.[a-z]{2,}$/.test(tail) || (site.length >= 3 && tail.replace(/[^a-z]/g, '').includes(site))) keep(t.slice(0, dash))
  }
  return t
}

export function oneLineSource(rawTitle: string, url: string): { host: string; title: string; full: string } {
  const shown = displaySource(rawTitle, url)
  return { host: shown.host, title: shortTitle(shown.title, shown.host), full: shown.title }
}

/** "1 thing to do" / "N things to do" — the accordion's counts. */
export function thingsToDo(n: number): string {
  return `${n} thing${n === 1 ? '' : 's'} to do`
}

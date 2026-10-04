/**
 * "JUST WHAT WE DISCUSSED" — THE CHECK ON A CONVERSATION TURNED INTO A CHECKLIST. Workspace Task 6.
 *
 * The prompt is `prompts/convert.ts` `CONVERT_DISCUSSED`; the route is `/api/checklists/from-topic`.
 * Pure functions, unit-tested in `tests/unit/checklistConvert.test.ts`.
 *
 * *** THE SAME CITATION RULE AS THE SUMMARY, FROM THE SAME CODE. *** The sources are numbered by
 * `numberedTranscript` before the model reads the conversation, and each item's `basis` is checked
 * by `checkCitations` — imported from `lib/summaryReport.ts`, not copied:
 *   · a basis not found in any answer clears the item's sources, and the item says
 *     "No source cited in the conversation";
 *   · a basis found keeps only the source numbers that are markers in that same paragraph.
 *
 * An item keeps its place either way. Dropping it would hide something the conversation may well
 * have said; showing it without a source is the honest middle.
 */
import { gatherSources, checkCitations, cleanSourceNumbers, type TurnLike, type ReportSource }
  from './summaryReport.ts'
import { findReturned, labelFor, type SourceLabel } from './howTo.ts'

export type ItemGroup = 'must_do' | 'good_to_have' | 'to_confirm'
export const GROUPS: readonly ItemGroup[] = ['must_do', 'good_to_have', 'to_confirm'] as const

export interface ConvertedItem {
  category: ItemGroup
  name: string
  description: string
  basis: string | null
  /** The sources the check let stand, in the conversation's own numbering. Empty = no source. */
  sources: ReportSource[]
}

/** What the check did to one item — returned beside the checklist for the person reviewing it. */
export interface ConvertCheck {
  category: ItemGroup
  name: string
  basis: string | null
  found: boolean | null
  kept: number[]
  dropped: number[]
}

export type ConvertResult =
  | { ok: true; title: string | null; items: ConvertedItem[]; checks: ConvertCheck[] }
  | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * Validate what the model returned and settle every item's citations.
 *   · The whole result is refused when its shape is wrong (no object, a group that is not a list).
 *   · An item with no name is skipped; that is not a checklist item.
 *   · Source numbers outside the conversation's list are dropped, then `checkCitations` runs.
 */
export function checkConversion(raw: unknown, turns: TurnLike[],
  opts: { basisRequired: boolean } = { basisRequired: true }): ConvertResult {
  if (!isObj(raw)) return { ok: false, error: 'not an object' }
  for (const g of GROUPS) {
    if (raw[g] !== undefined && !Array.isArray(raw[g])) return { ok: false, error: `${g} is not a list` }
  }
  const { sources: all, perTurn } = gatherSources(turns)
  const items: ConvertedItem[] = []
  const checks: ConvertCheck[] = []
  for (const category of GROUPS) {
    for (const it of (raw[category] ?? []) as unknown[]) {
      if (!isObj(it)) return { ok: false, error: `an item in ${category} is not an object` }
      const name = str(it.name)
      if (!name) continue
      const basis = str(it.basis) || null
      const numbers = cleanSourceNumbers(it.sources ?? [], all.length)
      const r = checkCitations({ basis, sources: numbers }, turns, perTurn, opts.basisRequired)
      checks.push({ category, name, basis, found: r.found, kept: r.kept, dropped: r.dropped })
      items.push({
        category, name: name.slice(0, 500), description: str(it.description ?? it.what_to_do), basis,
        sources: r.kept.map((n) => all[n - 1]),
      })
    }
  }
  return { ok: true, title: str(raw.title) || null, items, checks }
}

/**
 * The `checklist_items` columns for one checked item. `sources` holds every source the check let
 * stand; `source_url` / `source_title` hold the first, for the readers that know only one.
 */
export function itemColumns(it: ConvertedItem): Record<string, unknown> {
  return {
    category: it.category,
    name: it.name,
    description: it.description || null,
    basis: it.basis,
    sources: it.sources.map((s) => ({ title: s.title, url: s.url })),
    source_url: it.sources[0]?.url ?? null,
    source_title: it.sources[0]?.title ?? null,
    origin: 'conversation',
  }
}

// ---------------------------------------------------------------------------
// "EVERYTHING ON THIS SUBJECT" — THE ADDED ITEMS' LINKS. The owner's decision at STOP 1.
// ---------------------------------------------------------------------------

/** Shown where an added item's link failed the check. One copy, in the view module the page reads. */
export { NO_SOURCE_FOUND } from './checklistView.ts'

export interface AddedLinkInput {
  origin: 'conversation' | 'added'
  source_url: string | null
  source_title: string | null
}

/**
 * An ADDED item may carry only a link this call's web search returned — `lib/howTo.ts` `findReturned`,
 * the same check "How do I do this?" uses, and its official/other label. A link that fails is removed:
 * the item keeps its place, with no source, and the screen says "No source found". Items from the
 * conversation are not touched here; the route's conversation-URL rule still decides them.
 */
export function checkAddedLinks<T extends AddedLinkInput>(items: T[], returned: Array<{ url: string; title: string }>):
  { items: Array<T & { sources: Array<{ title: string; url: string; label: SourceLabel }> }>; removed: number } {
  let removed = 0
  const out = items.map((it) => {
    if (it.origin !== 'added') {
      return { ...it, sources: it.source_url ? [{ title: it.source_title ?? it.source_url, url: it.source_url, label: labelFor(it.source_url) }] : [] }
    }
    const hit = it.source_url ? findReturned(it.source_url, returned) : undefined
    if (!hit) {
      if (it.source_url) removed++
      return { ...it, source_url: null, source_title: null, sources: [] }
    }
    return { ...it, source_url: hit.url, source_title: it.source_title || hit.title,
      sources: [{ title: it.source_title || hit.title, url: hit.url, label: labelFor(hit.url) }] }
  })
  return { items: out, removed }
}

/**
 * "HOW DO I DO THIS?" — THE CHECK ON EVERY STEP. Workspace Task 6, boards 8 and 9.
 *
 * Pure functions, unit-tested in `tests/unit/howTo.test.ts`. The prompt is `prompts/how-to.ts`; the
 * route is `app/api/checklist-items/[id]/how-to/route.ts`.
 *
 * a. A step's URL must be a page the web search RETURNED IN THIS CALL (`lib/ai.ts` `searchResults`),
 *    or a page the answer cited. Anything else — a URL from the model's memory, a near miss, no URL
 *    at all — and the step is DROPPED and counted. The screen then says how many were not shown.
 * b. Each kept step is labelled by its host: "official" (a government host, or one of the short list
 *    below) or "other", which the screen shows with its exact link and a line saying to check it.
 * c. The result is what gets saved on the item: the steps, the dropped count, the date and the model.
 */

export type SourceLabel = 'official' | 'other'

export interface HowToStep {
  text: string
  url: string
  /** The page's title as the search returned it. */
  title: string
  host: string
  label: SourceLabel
}

export interface HowToResult {
  steps: HowToStep[]
  /** Steps the model wrote whose URL was not one this call's search returned. Not shown. */
  dropped: number
  /** One line, when the mothership does not publish the steps online. */
  note: string | null
  mothership: string | null
  /** The date the steps were checked (YYYY-MM-DD). */
  checked_on: string
  model: string
}

/**
 * *** THE OFFICIAL HOSTS. *** Kept short on purpose (the owner, 4 October 2026: start small). Each
 * entry carries its reason. A host not matched here is "other" — shown, with its exact link and the
 * line saying it is not the agency's own page — never hidden.
 *
 * ecfr.gov, federalregister.gov, oregonlegislature.gov, ttb.gov, cbp.gov, fda.gov and oregon.gov all
 * fall under the first rule, so none needs an entry of its own.
 */
export const OFFICIAL_HOSTS: ReadonlyArray<{ test: (host: string) => boolean; rule: string; reason: string }> = [
  {
    rule: '*.gov',
    test: (h) => h === 'gov' || h.endsWith('.gov'),
    reason: 'The .gov domain is issued only to US government bodies — federal, state, local and tribal — '
      + 'by the federal .gov registry. Every federal agency and most state agencies publish there.',
  },
  {
    rule: '*.state.xx.us',
    test: (h) => /(^|\.)state\.[a-z]{2}\.us$/.test(h),
    reason: 'The state.xx.us names under .us are delegated to each state government. Oregon still '
      + 'publishes the Oregon Administrative Rules at secure.sos.state.or.us.',
  },
  {
    rule: 'codes.iccsafe.org',
    test: (h) => h === 'codes.iccsafe.org',
    reason: 'The International Code Council publishes the model codes (fire, building) that states adopt '
      + 'into law, and hosts the adopted state editions; it is the official publisher of that text.',
  },
]

/** "This comes from ‹host›, not the agency itself. …" — the line the screen shows under an "other" step. */
export const OTHER_SOURCE_LINE = (host: string) =>
  `This comes from ${host}, not the agency itself. It looks correct, but check it before you rely on it.`

/** "N steps could not be checked against a source, so they are not shown." */
export const DROPPED_LINE = (n: number) =>
  `${n} ${n === 1 ? 'step' : 'steps'} could not be checked against a source, so ${n === 1 ? 'it is' : 'they are'} not shown.`

export function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

export function labelFor(url: string): SourceLabel {
  const h = hostOf(url)
  return h && OFFICIAL_HOSTS.some((o) => o.test(h)) ? 'official' : 'other'
}

/**
 * One page, one key. The scheme, a leading "www.", the fragment and a trailing slash do not make a
 * different page; letter case is ignored. The query string is KEPT: on many agency sites it is what
 * selects the page.
 */
export function urlKey(url: string): string {
  const u = url.trim()
  try {
    const x = new URL(u)
    const host = x.hostname.toLowerCase().replace(/^www\./, '')
    return `${host}${x.pathname.replace(/\/+$/, '')}${x.search}`.toLowerCase()
  } catch {
    return u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase()
  }
}

/** The citation markers `lib/ai.ts` `reassemble` adds to cited spans; they can land between JSON tokens. */
export function stripMarkers(text: string): string {
  return text.replace(/\[\d+\]/g, '')
}

/**
 * THE LINK CHECK, ON ITS OWN: the page this call's search returned under `url`, or undefined.
 * Used by `checkHowTo` below and by "Everything on this subject" (`lib/checklistConvert.ts`
 * `checkAddedLinks`) — one rule for both, never two copies of it.
 */
export function findReturned(url: string, returned: Array<{ url: string; title: string }>):
  { url: string; title: string } | undefined {
  const k = url ? urlKey(url) : ''
  return k ? returned.find((r) => r?.url && urlKey(r.url) === k) : undefined
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * CHECK WHAT THE MODEL RETURNED against the pages this call's search returned (and the answer cited).
 * Refuses the whole result only when its shape is wrong; a step that fails the check is dropped and
 * counted, never silently lost.
 */
export function checkHowTo(raw: unknown, returned: Array<{ url: string; title: string }>,
  meta: { today: string; model: string }): { ok: true; result: HowToResult } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: 'not an object' }
  if (raw.steps !== undefined && !Array.isArray(raw.steps)) return { ok: false, error: 'steps is not a list' }
  const steps: HowToStep[] = []
  let dropped = 0
  for (const s of (raw.steps ?? []) as unknown[]) {
    const text = isObj(s) ? str(s.text) : ''
    if (!text) continue                       // an empty step is not a step; nothing to show or count
    const url = isObj(s) ? str(s.url) : ''
    const hit = findReturned(url, returned)
    if (!hit) { dropped++; continue }
    // The search's own spelling of the URL is what is saved and linked, not the model's copy of it.
    steps.push({ text, url: hit.url, title: hit.title || hit.url, host: hostOf(hit.url), label: labelFor(hit.url) })
  }
  return {
    ok: true,
    result: {
      steps, dropped,
      note: str(raw.note) || null,
      mothership: str(raw.mothership) || null,
      checked_on: meta.today, model: meta.model,
    },
  }
}

/** How many different pages the kept steps rest on — "checked against N sources". */
export function sourceCount(r: Pick<HowToResult, 'steps'>): number {
  return new Set(r.steps.map((s) => urlKey(s.url))).size
}

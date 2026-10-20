/**
 * THE DASHBOARD'S TWO DISPLAY RULES — Dashboard step 5 (`docs/DASHBOARD-PLAN.md` decisions 4 and 5).
 *
 * Both of them are decisions about WORDS, which is exactly the kind of thing that rots inside a
 * component: a page is held by measurement and by eye, and neither notices that "Welcome back"
 * started appearing on somebody's first morning. So they live here, as functions over plain
 * values, and the page calls them.
 *
 * Nothing in this file reads a clock, a database or a request. `welcomed_at` arrives as the value
 * the row holds — a timestamp or null — and that is the whole of the input.
 */

/** The two ledes, exactly as board 1 and board 3 write them (`docs/dashboard-boards.html`). */
export const LEDE_FIRST_VISIT =
  'This page will show what has been done and what is coming up. Three quick questions below get things started.'
export const LEDE_RETURNING =
  'What has been done, what is coming up, and a few quick questions.'

/** What `welcomeFor` hands the page: the title it draws and the lede under it. */
export interface Welcome {
  title: string
  lede: string
  /** True on the one view that should write `welcomed_at`. The page uses it; no words depend on it. */
  firstVisit: boolean
}

/**
 * THE WELCOME IS THE PAGE TITLE — decision 5.
 *
 * `welcomed_at` is null until the first view of the Dashboard records it (migration 080), so null
 * means "this person has not been here before" and anything else means they have. The first name
 * is the first word of `full_name`; with no name on file the greeting simply stops after the
 * first word.
 *
 * *** THE NAMELESS FIRST VISIT SAYS "WELCOME", NOT "WELCOME BACK". *** `DASHBOARD-PLAN.md`
 * decision 5 closes with "No name on file → 'Welcome back'", which reads like a third rule and is
 * not one: it describes the ordinary case, where the person has history. The two inputs are
 * independent — whether we know a name, and whether this is the first visit — so there are four
 * answers, and the step 5 brief names all four. A nameless person's first visit gets "Welcome".
 */
export function welcomeFor(fullName: string | null | undefined, welcomedAt: string | null | undefined): Welcome {
  const firstVisit = !welcomedAt
  const greeting = firstVisit ? 'Welcome' : 'Welcome back'
  // `trim()` before `split`, or a leading space makes the first word the empty string and the
  // title comes out "Welcome back, " with a comma and nothing after it.
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? ''
  return {
    title: first ? `${greeting}, ${first}` : greeting,
    lede: firstVisit ? LEDE_FIRST_VISIT : LEDE_RETURNING,
    firstVisit,
  }
}

/** An em dash, not a hyphen and not a zero. The page draws it in the board's faint grey. */
export const NO_COUNT = '—'

/**
 * A COUNT OF NOTHING IS A DASH — decision 4.
 *
 * A company with no row in `usage_counters` and a company whose counter is still 0 are the same
 * thing to a person: nothing has happened yet. Neither gets a 0, because a 0 reads as a measured
 * result and this is an absence — and `CLAUDE.md` §6 is about exactly that difference. Undefined
 * (no row at all) and null (a column that somehow has none) both land here too.
 *
 * Everything else is the number itself, so a counter that reaches 1 shows 1.
 */
export function countWord(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_COUNT
  if (!Number.isFinite(value) || value <= 0) return NO_COUNT
  return String(value)
}

/** True when `countWord` returned the dash — the page's cue for the faint grey. */
export function isNoCount(value: number | null | undefined): boolean {
  return countWord(value) === NO_COUNT
}

/** The four numbers, in the boards' order, with the boards' labels. */
export const COUNTER_TILES = [
  { key: 'files_read', label: 'Files read' },
  { key: 'questions_answered', label: 'Questions answered' },
  { key: 'audits_done', label: 'Audits done' },
  { key: 'checklists_created', label: 'Checklists created' },
] as const

/** The columns `COUNTER_TILES` needs, for the page's `.select()`. */
export const COUNTER_COLUMNS = COUNTER_TILES.map(t => t.key).join(', ')

export type CounterRow = Partial<Record<(typeof COUNTER_TILES)[number]['key'], number | null>>

// -------------------------------------------------------------------------------------------
// STEP 6 — THE TWO SECTIONS UNDER THE NUMBERS
// -------------------------------------------------------------------------------------------

/** Board 1: at most six dates, then one line saying how many more. */
export const UPCOMING_MAX = 6
/** Decision 7: the last three runs. */
export const RECENT_AUDITS_MAX = 3

/**
 * SIX, AND A LINE THAT SAYS HOW MANY MORE — decision 6.
 *
 * Pure, and split out from the page for the reason the welcome was: the interesting cases are the
 * boundaries, and a boundary inside a `.map()` is only ever checked by looking at a screen that
 * happens to have seven dates on it. Six shows six and says nothing; seven shows six and says
 * "1 more".
 *
 * It does NOT sort. The caller hands in the order it wants shown — the Dashboard's is the view's
 * own `next_due`, soonest first — because a function that silently re-sorted would be a second
 * opinion about which date is next, and the Calendar already has the only one.
 */
export function splitUpcoming<T>(rows: readonly T[], max: number = UPCOMING_MAX): { shown: T[]; more: number } {
  const all = rows ?? []
  return { shown: all.slice(0, max), more: Math.max(0, all.length - max) }
}

/** The grey line under the rows. Singular at one, because "1 more dates" is how a product sounds careless. */
export function moreLine(n: number): string {
  return n === 1 ? '1 more in the next 30 days.' : `${n} more in the next 30 days.`
}

/** The link beside it, and where it goes — the Calendar's own tab, not the Calendar's front door. */
export const MORE_LINK = 'See them on the Calendar'
export const MORE_HREF = '/calendar?tab=calendar'

/**
 * THE DAY-ONE LINES — board 3. Each says what will appear there and how to make it happen, which
 * is `CLAUDE.md` §5.1's rule for an empty state: "nothing found" is a claim, and a claim has to be
 * true and has to leave the person somewhere to go.
 */
export const UPCOMING_EMPTY = 'Deadlines from your documents will be displayed here.'
export const UPCOMING_EMPTY_LINK = 'Add a document'
export const UPCOMING_EMPTY_HREF = '/documents'
export const AUDITS_EMPTY = 'Your recent audits will show here.'
export const AUDITS_EMPTY_LINK = 'Run your first audit'
export const AUDITS_EMPTY_HREF = '/audits'

/**
 * *** A DATE IN THE WINDOW — the Dashboard's one filter, and it computes nothing. ***
 *
 * `next_due`, `days_until` and `has_passed` are the VIEW's, worked out against the server's today;
 * a browser comparing a DATE to its own clock slips a day for anybody west of UTC. A row with no
 * computable day (`next_due` null) is not a deadline at all — decision 23 — and one that has passed
 * belongs to the Calendar's list rather than to "upcoming".
 */
export function inNext30Days(
  row: { next_due: string | null; days_until: number | null; has_passed: boolean | null },
): boolean {
  return !!row.next_due && !row.has_passed
    && row.days_until !== null && row.days_until >= 0 && row.days_until <= 30
}

/** Decision 6's window, named so the page and its test cannot disagree about the number. */
export const UPCOMING_DAYS = 30

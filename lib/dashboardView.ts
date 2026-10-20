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

// -------------------------------------------------------------------------------------------
// STEP 7 — THE THREE QUESTIONS (decisions 8, 9, 10; open question 1, settled at step 4)
// -------------------------------------------------------------------------------------------

/** Decision 8. Three a calendar day, then the card goes quiet. */
export const QUESTIONS_PER_DAY = 3

/** The heading and its quiet note — board 1. The note is plain faint text, not a link. */
export const QUESTIONS_HEADING = 'Three quick questions'
export const QUESTIONS_NOTE = 'Your answers are kept in Company information'

/** Board 2, state d. */
export const QUESTIONS_DONE = "Thanks — that's all for today. We'll ask a few more another day."
export const QUESTIONS_DONE_SUB = 'Your answers are in Company information if you want to change one.'

/** The one failure sentence. §5.1: it says whose problem it is and that nothing was lost. */
export const ANSWER_FAILED =
  'That answer could not be saved. Nothing was changed. Please try again.'

/** Board 2's skip, which writes nothing anywhere. */
export const SKIP_WORD = "I don't know yet"

/**
 * *** HOW A SWITCH IS ANSWERED, FROM ITS OWN TYPE. ***
 *
 * `switches.value_type` is the enum `switch_value_type` — `boolean | number | enum | text`
 * (`lib/resolve.ts:134`) — and three of the four map onto a control board 2 draws. `text` does
 * not: a free-text fact typed into a card has no way to be checked, and the Company information
 * page is where a sentence belongs. A switch of a type this cannot draw is SKIPPED, not guessed
 * at, and the step that skips it says so.
 *
 * On staging today no question-carrying switch is `text` at all: 78 boolean, 11 enum, 6 number.
 * The branch exists because the enum can grow and a card that silently drew nothing would be the
 * harder bug.
 */
export type AnswerKind = 'yes_no' | 'number' | 'options'
export function answerKind(valueType: string): AnswerKind | null {
  if (valueType === 'boolean') return 'yes_no'
  if (valueType === 'number') return 'number'
  if (valueType === 'enum') return 'options'
  return null
}

/**
 * THE BUTTONS FOR AN OPTION SWITCH: the label is drawn, the VALUE is posted.
 *
 * `allowed_values` holds keys that live requirement expressions compare against — `toll_processor`,
 * `iso_9001` — and `/api/switches/answer` refuses anything that is not one of them
 * (`app/api/switches/answer/route.ts:69`). So the value never changes shape on its way to the
 * wire. A value with no label falls back to the value itself: visibly wrong on a button beats
 * invisibly missing.
 */
export function optionButtons(q: Pick<CardQuestion, 'allowed_values' | 'allowed_value_labels'>) {
  const labels = q.allowed_value_labels ?? {}
  return (q.allowed_values ?? []).map((value) => ({ value, label: labels[value] ?? value }))
}

/** The two words a boolean switch is answered with, and what goes on the wire for each. */
export const YES_NO: Array<{ label: string; value: string }> = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
]

/** As much of an `Askable` (`lib/switchAsk.ts:38`) as the card needs. */
export interface CardQuestion {
  switch_id: string
  question: string
  /** `switches.help_plain` (migration 081), or null — the card draws it only when it is there. */
  help?: string | null
  scope: 'company' | 'site'
  value_type: string
  allowed_values: string[]
  /** value → the word on the button (migration 081). A value with no label shows as itself. */
  allowed_value_labels?: Record<string, string> | null
}

/**
 * *** COMPANY SCOPE ONLY — decision 8, and it is not a preference. ***
 *
 * `switches.scope` is the enum `switch_scope`, carried onto `Askable.scope`
 * (`lib/switchAsk.ts:141`). 73 of the 95 switches are site-scoped, because a second plant has its
 * own air permit and its own generator category. A site question asked on a page that names no
 * site would have to pick one, and picking one is exactly what `DECISIONS.md` §20 forbids — the
 * answer would be wrong at every site but that one, confidently. `/api/switches/answer` refuses
 * it anyway (`app/api/switches/answer/route.ts:60`); this keeps it off the card.
 *
 * A type no control fits is dropped here too, so everything downstream can assume a control.
 */
export function askableHere<T extends CardQuestion>(askables: readonly T[]): T[] {
  return (askables ?? []).filter((a) => a.scope === 'company' && answerKind(a.value_type) !== null)
}

/** Those an unfittable value type dropped, so the step can list them rather than lose them. */
export function skippedForType<T extends CardQuestion>(askables: readonly T[]): T[] {
  return (askables ?? []).filter((a) => a.scope === 'company' && answerKind(a.value_type) === null)
}

/**
 * THE QUESTION ON THE CARD: the first one left that today has not already passed over.
 *
 * An ANSWERED switch is not in `askables` at all — `askableSwitches` drops anything established
 * (`lib/switchAsk.ts:137`) — so answering is subtraction from the list and only skips are carried.
 * The order is the route's: unblocked first, then the ones only a person can answer, then by what
 * answering unblocks. Nothing here re-ranks.
 */
export function nextQuestion<T extends CardQuestion>(
  askables: readonly T[], skips: readonly string[],
): T | null {
  const skipped = new Set(skips ?? [])
  return askableHere(askables).find((a) => !skipped.has(a.switch_id)) ?? null
}

/** "1 of 3". A skip does not advance it, because a skip is not an answer. */
export function cardNumber(answeredToday: number, perDay: number = QUESTIONS_PER_DAY): string {
  return `${Math.min(answeredToday + 1, perDay)} of ${perDay}`
}

/**
 * WHICH OF THE THREE STATES THE BLOCK IS IN.
 *
 *   question — there is something to ask and today's three are not used up
 *   quiet    — board 2's state d: three answered, or nothing left to ask TODAY because the rest
 *              were skipped. Tomorrow the skips are gone and those questions come back.
 *   hidden   — no heading and no card at all: this company has no company-scope question left.
 *              Not "well done", not an empty card — nothing, because there is nothing to say.
 */
export type QuestionState = 'question' | 'quiet' | 'hidden'
export function questionState<T extends CardQuestion>(
  askables: readonly T[], answeredToday: number, skips: readonly string[],
  perDay: number = QUESTIONS_PER_DAY,
): QuestionState {
  if (askableHere(askables).length === 0) return 'hidden'
  if (answeredToday >= perDay) return 'quiet'
  return nextQuestion(askables, skips) ? 'question' : 'quiet'
}

/**
 * *** TODAY STARTS AT THE PERSON'S OWN MIDNIGHT, NOT AT UTC'S. ***
 *
 * "Three a calendar day" is a promise about the day the person is living in. Oregon is 7 or 8
 * hours behind UTC, so a UTC day boundary would end somebody's quota at 4 or 5 in the afternoon
 * and hand them three more questions over dinner. The browser is the only thing that knows the
 * local zone, so it computes the moment and sends it as an absolute instant; the database
 * compares timestamps and never a date.
 *
 * This is the same reasoning `lib/calendarCounts.ts` carries for the info bar, pointing the other
 * way: there, a DATE must not be compared to a browser clock; here, an INSTANT must come from one.
 */
export function localMidnightIso(now: Date = new Date()): string {
  const m = new Date(now.getTime())
  m.setHours(0, 0, 0, 0)
  return m.toISOString()
}

/** The browser-storage key for a day's skips. The local date, so it rolls at local midnight too. */
export function skipKey(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `compliboard:dashboard-skips:${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** The least of `Storage` this needs, so a test can hand it one that throws. */
export interface SkipStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

/**
 * *** A SKIP IS A BROWSER'S OPINION, AND THE PAGE WORKS WITHOUT ONE. ***
 *
 * "I don't know yet" writes nothing to the database on purpose (decision 8): the switch stays
 * unanswered, because "I don't know" is not a fact about the company and this product does not
 * store one. So the only place a skip can live is the browser — and `localStorage` throws outright
 * in a private window and comes back empty when site data is cleared. Both reads and writes are
 * therefore guarded, and failing to remember a skip costs the person one repeated question, which
 * is the right way for this to fail.
 */
export function readSkips(store: SkipStore | null | undefined, key: string): string[] {
  try {
    const raw = store?.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

export function writeSkip(store: SkipStore | null | undefined, key: string, switchId: string): string[] {
  const next = [...new Set([...readSkips(store, key), switchId])]
  try { store?.setItem(key, JSON.stringify(next)) } catch { /* one repeated question, not an error */ }
  return next
}

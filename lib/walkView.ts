/**
 * THE WALK — board 7, My Account step 14, `ACCOUNT-PLAN.md` decision 10.
 *
 * Three screens after signup, every one leavable. What we found, three questions, done. The words
 * are board 7's; the rules that decide which screen a person is on are here, where they can be
 * tested without a browser.
 *
 * *** NOTHING IS WRITTEN WITHOUT A PRESS, AND THE WALK WRITES NOTHING OF ITS OWN. ***
 * Screen 1's "Yes, that's us" sends what is IN THE FIELDS at that moment — the edited values, not
 * the proposal — through the routes that already own those tables, as the person. Screen 2 answers
 * through `/api/switches/answer`, which is the only writer of `company_switches`. Leaving at any
 * point writes nothing further, and coming back by URL shows the state as it is now and re-saves
 * nothing: `planSaves` is built from the fields and the fields are built from what was READ.
 *
 * *** AND THE WALK IS NOT A PAGE OF THE APP. *** Board 7 draws it as a `doorcard` on a narrow
 * board, the same frame `/login`, `/join` and `/signup` use. It is outside `AppLayout`, which is
 * decision 14's rule holding rather than being tested: the shell draws a sidebar and counts, and a
 * person halfway through telling us where they are should be looking at one thing.
 */
import { QUESTIONS_PER_DAY } from './dashboardView.ts'

/** Where it lives. `app/signup/page.tsx` pushes here instead of `/dashboard` (step 14). */
export const WALK_PATH = '/walk'

/** The three dots board 7 draws at the top of every screen. */
export const WALK_STEPS = 3

/**
 * *** THE ONE WORD ON EVERY SCREEN. *** Decision 10: the walk can be left at any point, so the way
 * out is visible at every moment — including while the website is still being read, where a person
 * who does not want to wait must not have to.
 */
export const SKIP = 'Skip for now'

// ── Screen 1, when there is a proposal ───────────────────────────────────────────────────────────

export const FOUND_TITLE = "Here's what we found"
/** "From willamettevinegar.com. Fix anything that's wrong, then confirm." */
export const foundLede = (host: string) => `From ${host}. Fix anything that's wrong, then confirm.`
export const CONFIRM = "Yes, that's us"

/** The card's own labels. "What you do" is the Company tab's word, imported rather than retyped. */
export const COMPANY_NAME_LABEL = 'Company name'
/**
 * The name is DISPLAY ONLY — decision 1, and the grant says so too: `companies.name` is outside
 * `authenticated`'s column grant (082), so this page could not write it if it tried. It is here so
 * the person can see at a glance that we read the right site.
 */
export const COMPANY_NAME_NOTE = 'From your website. We keep the name you gave us at signup.'
export const MAIN_ADDRESS_LABEL = 'Address of your main site'
export const OTHER_PLACES_LABEL = 'We also found these'
/** The checkbox beside each extra location, checked by default. */
export const ADD_AS_SITE = 'Add as a site'
/** The model's own note, when it left one. Shown as what it is: something it was unsure of. */
export const NOTE_LABEL = 'One thing we were not sure of'

// ── Screen 1, when there is not ──────────────────────────────────────────────────────────────────

export const ASK_TITLE = 'Where is your main site?'
export const ASK_LEDE = 'One address. We can fill in the rest later.'
export const ADDRESS_LABEL = 'Address of your main site'
export const ADDRESS_PLACEHOLDER = 'Street, city, state, ZIP'
export const ADDRESS_HINT = 'The address tells us which state and county rules apply.'
/** Board 7's word for this button. It saves, and then it continues; the board names the second. */
export const CONTINUE = 'Continue'

/** "We couldn't read willamettevinegar.com — tell us your main address instead." */
export const couldNotRead = (host: string) =>
  `We couldn't read ${host} — tell us your main address instead.`
/** While it is still being read. */
export const readingLine = (host: string) => `Reading ${host}…`

// ── Screen 3 ─────────────────────────────────────────────────────────────────────────────────────

export const DONE_TITLE = "That's it"
/** Straight apostrophes, because that is what board 7 has and these words are the board's. */
export const DONE_LEDE =
  "Add your first document when you're ready and we'll start reading. You can leave this walk at "
  + 'any point and the Dashboard picks up where you stopped.'
export const DONE_BUTTON = 'Go to my Dashboard'
export const DASHBOARD_PATH = '/dashboard'

// ── What the walk says when a save will not go through ───────────────────────────────────────────

/** Our problem, said as ours, and nothing is claimed about what was saved (§5.1). */
export const SAVE_FAILED = 'We could not save that just now. Nothing was changed.'

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE SCREEN A PERSON IS ON
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** What `GET /api/website-read` answers. `none` is a company that never had a website to read. */
export type ReadStatus = 'none' | 'reading' | 'ready' | 'failed'

/** Every two seconds, for forty, and then it is treated as failed. */
export const POLL_EVERY_MS = 2_000
export const POLL_UP_TO_MS = 40_000

/**
 * SCREEN 1's THREE FACES.
 *
 *   waiting — the read is running and we have not waited too long
 *   found   — there is a proposal to confirm
 *   ask     — there is not, and the one thing still missing is the address
 *
 * *** FORTY SECONDS AND THEN IT IS `ask`, WHICH IS A DECISION AND NOT A TIMEOUT. *** The read
 * itself cannot take longer than the route's own limit, so a row still `reading` after forty
 * seconds means something went wrong that the route could not record. The walk does not wait for
 * it: a person standing in front of a spinner is being asked to care about our machinery.
 */
export type FirstScreen = 'waiting' | 'found' | 'ask'
export function firstScreen(status: ReadStatus, waitedMs: number): FirstScreen {
  if (status === 'ready') return 'found'
  if (status === 'reading') return waitedMs < POLL_UP_TO_MS ? 'waiting' : 'ask'
  return 'ask'
}

/** The sentence above the address box: named when we know the host, silent when there is none. */
export function askNotice(status: ReadStatus, host: string | null, waitedMs: number): string | null {
  if (firstScreen(status, waitedMs) !== 'ask') return null
  if (status === 'none' || !host) return null
  return couldNotRead(host)
}

/** The three dots: which are filled on screen `n` (1-based). */
export function stepsDone(screen: number): boolean[] {
  return Array.from({ length: WALK_STEPS }, (_, i) => i < screen)
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — the same three questions the Dashboard asks, in the walk
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Three, and it is the Dashboard's three: one number, one rule, no second opinion. */
export const WALK_QUESTIONS = QUESTIONS_PER_DAY

/** Done when three have been answered, or when there is nothing left to ask. */
export function questionsDone(answered: number, hasQuestion: boolean): boolean {
  return answered >= WALK_QUESTIONS || !hasQuestion
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WHAT "YES, THAT'S US" DOES — the order, as a value, so a test can read it
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ProposedPlace { label: string | null; address: string }

/** What is in the fields when the button is pressed. Not the proposal — what the person left. */
export interface ConfirmFields {
  whatYouDo: string
  naicsCode: string | null
  mainAddress: string
  /** The main site as it exists now: created at signup, named after the company, with no address. */
  mainSite: { id: string; name: string } | null
  /** The other locations, with the ones whose box is still ticked. */
  others: Array<{ place: ProposedPlace; add: boolean }>
}

export type SaveStep =
  | { kind: 'company'; what_you_do: string | null; naics_code: string | null }
  | { kind: 'main-site'; id: string; name: string; address: string }
  | { kind: 'new-site'; name: string; address: string }
  | { kind: 'accept' }

/**
 * *** THE ORDER MATTERS AND IT IS THIS. ***
 *
 *   1. the company's own words, which depend on nothing;
 *   2. the MAIN site's address, because 083's trigger mirrors it onto the company row and the
 *      company row is what resolution reads (`lib/jurisdiction.ts:93`);
 *   3. the other sites, each a new row, after the main one — so that if a later one fails the
 *      company still has its jurisdiction;
 *   4. and only then `accept`, which stamps `accepted_at`. It is last because it is the record
 *      that the rest happened; stamping it first would say so before it was true.
 *
 * A step is omitted when there is nothing to do: an empty sentence with no code writes no company
 * row, and no main site means no address to put on one. `accept` is always last and always there —
 * a person who confirmed a card we could save nothing from has still confirmed it.
 */
export function planSaves(f: ConfirmFields): SaveStep[] {
  const steps: SaveStep[] = []
  const what = f.whatYouDo.trim()
  if (what || f.naicsCode) {
    steps.push({ kind: 'company', what_you_do: what || null, naics_code: f.naicsCode ?? null })
  }
  const main = f.mainAddress.trim()
  if (main && f.mainSite) {
    steps.push({ kind: 'main-site', id: f.mainSite.id, name: f.mainSite.name, address: main })
  }
  for (const o of f.others) {
    const address = o.place.address.trim()
    if (!o.add || !address) continue
    steps.push({ kind: 'new-site', name: siteNameFor(o.place), address })
  }
  steps.push({ kind: 'accept' })
  return steps
}

/**
 * What a second location is CALLED. `/api/sites` refuses a site with no name ("A site needs a
 * name — something you would call it, like 'Portland plant'"), and the model is asked for the name
 * the site gives each location, which is usually there. When it is not, the first part of the
 * address is a better name than nothing and is still the customer's own words — they can rename it
 * in the site drawer, which is one tab away.
 */
export function siteNameFor(place: ProposedPlace): string {
  const label = (place.label ?? '').trim()
  if (label) return label
  const first = place.address.split(',')[0]?.trim() ?? ''
  return first || place.address.trim()
}

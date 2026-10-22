/**
 * THE FRONT DOOR'S WORDS AND ITS TWO RULES — board 6, My Account step 12, decision 8.
 *
 * Signup asks FOUR things: a work email, a password, the company name, and a website that is
 * optional and strongly encouraged. The state, the city and the industry dropdowns go — not because
 * the fields were ugly but because of what they were worth:
 *
 *   · the state came from a list of fifty and the city from a text box, so a company's place was
 *     TYPED. Step 6 made the main site's address the only source of a state and a county, read from
 *     the Census geocoder (`lib/geocode.ts`, decision 16), and 083's trigger mirrors it onto the
 *     company row (decision 17). A dropdown cannot produce a county, and the county is what half
 *     the agencies in the library are keyed on.
 *   · the industry dropdown was `distinct requirement_templates.industries` — a list that can only
 *     ever offer verticals we have already built (`docs/WORKSPACE.md:586`), shown to somebody who
 *     has not yet seen the product. Decision 3 replaces it with what the person types about
 *     themselves, on the Company tab, with the NAICS titles as suggestions.
 *
 * *** THE WORDS ARE HERE SO THE PAGE, THE ROUTE AND THE TESTS CANNOT DISAGREE ABOUT THEM. *** The
 * refusals a person reads come from this file, the route sends them, and the page shows what the
 * route sent (`CLAUDE.md` §5.1).
 *
 * *** AND THE PASSWORD WORDS ARE NOT NEW. *** `/join` already asks a person to choose their first
 * password and already has the sentences for it (`lib/peopleView.ts:106`-`:145`). They are re-exported
 * here under the names the door uses rather than written again, so the two doors can never come to
 * disagree about what "long enough" means. `tests/unit/accountView.test.ts:336` already pins that
 * ten against `/reset-password`'s.
 */
import {
  JOIN_PASSWORD_MIN, JOIN_PASSWORD_HINT, JOIN_PASSWORD_SHORT, JOIN_EMAIL_TAKEN,
} from './peopleView.ts'
import { hostOf } from './sourceTitle.ts'

// ── Board 6, top to bottom ───────────────────────────────────────────────────────────────────────

export const SIGNUP_TITLE = 'Start with CompliBoard'
export const SIGNUP_LEDE = '14 days free. No card needed to start.'

export const EMAIL_LABEL = 'Work email'
export const EMAIL_PLACEHOLDER = 'you@company.com'

export const PASSWORD_LABEL = 'Password'
/** `At least 10 characters` — the placeholder board 6 draws, and the rule the route enforces. */
export const SIGNUP_PASSWORD_MIN = JOIN_PASSWORD_MIN
export const SIGNUP_PASSWORD_HINT = JOIN_PASSWORD_HINT

export const COMPANY_LABEL = 'Company name'
/**
 * "As it appears on your permits" is not a style note. The company name is not editable by a person
 * afterwards (decision 1) because every page, every report and every obligation hangs on it, and a
 * permit is the document the name has to match when an inspector reads both.
 */
export const COMPANY_PLACEHOLDER = 'As it appears on your permits'

export const WEBSITE_LABEL = 'Your website'
export const WEBSITE_OPTIONAL = '· optional'
export const WEBSITE_PLACEHOLDER = 'company.com'
export const WEBSITE_GREEN = 'Highly recommended — it helps us know your company.'

export const SIGNUP_BUTTON = 'Create my account'
export const SIGNUP_BUSY = 'Creating your account…'
export const HAVE_ACCOUNT = 'Already have an account?'
export const SIGN_IN = 'Sign in'

// ── The refusals ─────────────────────────────────────────────────────────────────────────────────

export const EMAIL_INVALID = 'That does not look like an email address.'
export const SIGNUP_PASSWORD_SHORT = JOIN_PASSWORD_SHORT
export const COMPANY_REQUIRED = 'Please tell us your company name — it goes on everything we produce.'
/**
 * Shown on the PAGE only, before anything is sent: what somebody typed in the website box could not
 * be read as a web address. The route never refuses over it (it is optional, and an optional field
 * must not be able to stop an account being created) — it stores a bare host or nothing. But
 * silently dropping what a person typed is its own small dishonesty, so the page says so first.
 */
export const WEBSITE_UNREADABLE = 'That does not look like a web address. Check it, or leave it blank.'

/** The address already has a login. Said in the one sentence `/join` already uses for it. */
export const EMAIL_TAKEN = JOIN_EMAIL_TAKEN
export const SIGN_IN_LINK = { label: 'Go to sign in', href: '/login' } as const

/**
 * *** THIS SENTENCE PROMISES SOMETHING THE ROUTE MUST ACTUALLY DO. *** "Nothing was saved" is only
 * true because migration 084 puts the company, its main site and the profile in ONE transaction and
 * the route deletes the login it had just made when that transaction fails. The address is then
 * free, which is the whole point: the old route left a login that could never be used and could
 * never be registered again (`docs/ACCOUNT-MACHINERY.md` §B3).
 */
export const NOTHING_SAVED = 'Something went wrong and nothing was saved. Try again.'

/**
 * And the one case where we may NOT say that: the company failed AND the login could not be
 * removed. Promising "nothing was saved" there would be false, so this says what is true and gives
 * the one address in the product (`components/AppLayout.tsx:444`).
 */
export const UNDO_FAILED =
  'Something went wrong while setting up your company, and we could not undo the sign-in we had '
  + 'just created. Email hello@compliboard.com and we will clear it so you can try again.'

// ── The two rules ────────────────────────────────────────────────────────────────────────────────

/**
 * A SHAPE CHECK, AND DELIBERATELY NOTHING MORE. Whether an address exists is settled by mail
 * reaching it, not by a regular expression, and every clever pattern refuses somebody's real
 * address. One `@`, something either side, and a dot in the domain.
 */
export function emailLooksLikeOne(value: string | null | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value ?? '').trim())
}

/** A hostname: labels of letters, digits and inner hyphens, at least two of them. */
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/**
 * What goes in `companies.website_url`: a BARE HOST, or nothing.
 *
 * A person types `company.com`, `www.company.com`, `https://Company.com/about` or nothing at all,
 * and all three of the first ones are the same company. `hostOf` (`lib/sourceTitle.ts:31`) already
 * does that reduction for citation links — scheme off, `www.` off, path off — and its fallback
 * branch is the one that matters here, because `new URL('company.com')` throws.
 *
 * Anything that is not a plausible host comes back null rather than being stored as typed: step 13
 * reads this column, and handing a model "about our vinegar" as a URL would be a fetch of nothing.
 */
export function normaliseWebsite(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const host = hostOf(raw).toLowerCase()
  return HOST.test(host) ? host : null
}

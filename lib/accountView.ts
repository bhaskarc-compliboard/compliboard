/**
 * MY ACCOUNT'S WORDS AND ITS DISPLAY RULES — step 6 (`docs/account-boards.html` boards 1 and 1b,
 * `ACCOUNT-PLAN.md` decisions 1, 3, 4, 5, 7, 15).
 *
 * The same split `lib/dashboardView.ts` and `lib/calendarView.ts` keep: every sentence the page
 * says, and every rule that turns a row into a line, live here as plain values and pure functions —
 * no database, no clock, no React. The page draws them.
 *
 * *** THE SENTENCES ARE THE BOARD'S, COPIED FROM IT. *** `tests/unit/accountView.test.ts` reads
 * `docs/account-boards.html` itself and fails if a word here has drifted from the approved picture,
 * for the reason `tests/unit/dashboardView.test.ts` does the same: a test that quotes its own
 * expectation cannot catch the two coming apart.
 *
 * *** BROWSER-SAFE: it imports `lib/listWords.ts`, which imports nothing. ***
 * `tests/unit/clientImports.test.ts` covers every client file's imports.
 */
import { countWord, fmtDate } from './listWords.ts'

// ── The page ──────────────────────────────────────────────────────────────────────────────────────

export const TITLE = 'My Account'
export const LEDE = 'Your company, the people who can sign in, how you sign in, and billing.'

/**
 * FIVE TABS, IN THE BOARD'S ORDER. Step 6 builds Company; the other four carry today's content
 * under the new names until their own steps (7, 8, 9 and part C).
 *
 * *** THE TAB IS ALWAYS IN THE ADDRESS, INCLUDING THE FIRST ONE. *** Audits and the Calendar drop
 * the default tab's parameter and write a bare path, which is exactly what the 20 October hotfix
 * was about: `router.replace` will not navigate to a path with no query, so the address stopped
 * matching the page (`DECISIONS.md` §206). Here `?tab=company` is written like any other, so the
 * query is never empty and the case that needed `history.replaceState` cannot arise.
 */
export const TABS = [
  { key: 'company', label: 'Company' },
  { key: 'people', label: 'People' },
  { key: 'signin', label: 'Sign-in' },
  { key: 'billing', label: 'Billing' },
  { key: 'cancel', label: 'Cancel' },
] as const

export type AccountTab = (typeof TABS)[number]['key']

export function asTab(raw: string | null | undefined): AccountTab {
  const hit = TABS.find((t) => t.key === raw)
  return hit ? hit.key : 'company'
}

// ── "Your company" ────────────────────────────────────────────────────────────────────────────────

export const COMPANY_HEADING = 'Your company'
export const COMPANY_LABEL = 'Company'

/**
 * THE GREY LINE UNDER THE NAME — decision 1, and migration 082 is what makes it true rather than a
 * promise. `companies.name` is out of `authenticated`'s column grant entirely, so the name is not
 * editable here because it is not editable, full stop.
 */
export const NAME_NOTE =
  'Tied to your account and cannot be changed here. Write to us if the name is wrong.'

export const WHAT_YOU_DO_LABEL = 'What you do'
export const WHAT_YOU_DO_PLACEHOLDER = 'In your own words'
export const WHAT_YOU_DO_EMPTY = 'Not said yet'
export const WEBSITE_LABEL = 'Website'
export const WEBSITE_EMPTY = 'Not given'
export const MAIN_SITE_LABEL = 'Main site'
export const EDIT_ADDRESS = 'Edit the address'
export const CHANGE = 'Change'
export const SAVE = 'Save'
export const CANCEL = 'Cancel'

// ── "Three things we need to know" ────────────────────────────────────────────────────────────────

export const QUESTIONS_HEADING = 'Three things we need to know'
export const QUESTIONS_NOTE = 'Kept in Company information · the same questions the Dashboard asks'
export const NOT_ANSWERED = 'Not answered yet'

/**
 * THE THREE, BY ID, IN THE BOARD'S ORDER — decision 5. They are the top three switches, and the
 * order is the board's (has employees, how many, what the business does), not a ranking this file
 * computed. Every word a person reads about them — the question and the line under it — comes from
 * `switches.question_plain` and `switches.help_plain`, so changing a question is a data change and
 * not an edit here (`components/DashboardQuestions.tsx` carries the same rule).
 */
export const THREE_SWITCHES = ['has_employees', 'employee_count', 'business_type'] as const

// ── "Sites" ───────────────────────────────────────────────────────────────────────────────────────

export const SITES_HEADING = 'Sites'
export const ADD_SITE = '+ Add a site'
export const MAIN_PILL = 'Main'
export const EDIT = 'Edit'

/** The grey line under the list, board 1's last words on the Company tab. */
export const SITES_NOTE =
  "A site's state and county come from its address. Dates, audits and site questions attach to " +
  'the site they belong to.'

// ── The site drawer (board 1b) ────────────────────────────────────────────────────────────────────

export const SITE_NAME_LABEL = 'Site name'
export const SITE_ADDRESS_LABEL = 'Address'
export const ON_THIS_SITE = 'On this site'
export const REMOVE_SITE = 'Remove this site'
/**
 * The confirming button in the sheet says something DIFFERENT from the one that opened it. Board 1b
 * names only the drawer's control; repeating it word for word in the confirmation gives a person
 * two identical buttons and no way to tell which one commits — and it made the step's own measured
 * walk ambiguous, which is the same problem showing up in a harness.
 */
export const REMOVE_SITE_CONFIRM = 'Remove it'
export const NEW_SITE_TITLE = 'Add a site'
export const NEW_SITE_SUB = 'A name and an address, and nothing else.'
export const COUNTY_LABEL = 'County'
export const COUNTY_HELP = 'Only if we could not find the address. Your word for it.'

/** The other four tabs until their own steps. */
export const PEOPLE_EMPTY = 'Who can sign in will appear here'

// ── Rules, not words ─────────────────────────────────────────────────────────────────────────────

/** As much of an `entities` row as this page reads. */
export interface SiteRow {
  id: string
  name: string | null
  address: string | null
  postal_code: string | null
  state: string | null
  county: string | null
  city: string | null
  is_primary: boolean | null
  created_at?: string | null
}

/**
 * THE ADDRESS LINE ON A SITE ROW — board 1: `2140 NW Yeon Ave, Portland, OR 97210 · Multnomah
 * County`, and the county is a SEPARATE part because it is the one the address did not say.
 *
 * *** A PART THAT IS NOT THERE IS ABSENT, NEVER A PLACEHOLDER. *** A site whose address did not
 * resolve has no state and no county, and the honest line is the address alone — not "Address,
 * , —". `CLAUDE.md` §5.1: an empty state is a message, and "nothing found" is a claim.
 */
export function addressLine(site: SiteRow): string {
  return (site.address ?? '').trim()
}

/** `Multnomah County`, or null when nothing resolved it. The word "County" is added for reading;
 *  the column holds the bare name (`'Multnomah'`), which is what jurisdiction matching compares. */
export function countyLine(site: SiteRow): string | null {
  const c = (site.county ?? '').trim()
  return c ? `${c} County` : null
}

/** The row's one line: the address, then the county when there is one. */
export function siteSubLine(site: SiteRow): string {
  return [addressLine(site), countyLine(site)].filter(Boolean).join(' · ')
}

/**
 * THE DRAWER'S GREY LINE, board 1b: *"The state and county are read from the address: Washington,
 * Clark County."* followed by what attaches to a site.
 *
 * With nothing resolved it says so instead — because the sentence's whole claim is that these two
 * facts came from the address, and printing it over two blanks would be the product asserting a
 * resolution it never made.
 */
export const SITE_PLACE_TAIL = 'Dates, audits and site questions for this site attach to it.'
export function sitePlaceLine(site: SiteRow): string {
  const state = (site.state ?? '').trim()
  const county = countyLine(site)
  if (!state && !county) {
    return `The state and county are read from the address. We have not been able to read them ` +
      `from this one yet. ${SITE_PLACE_TAIL}`
  }
  const both = [state, county].filter(Boolean).join(', ')
  return `The state and county are read from the address: ${both}. ${SITE_PLACE_TAIL}`
}

/** The drawer's subtitle: `Added 21 October 2026 · Clark County, Washington`, each part when there. */
export function siteDrawerSub(site: SiteRow): string {
  const added = site.created_at ? `Added ${fmtDate(site.created_at)}` : null
  const place = [countyLine(site), (site.state ?? '').trim() || null].filter(Boolean).join(', ')
  return [added, place || null].filter(Boolean).join(' · ')
}

/** Board 1's "· added 21 October 2026" on a site that is not the main one. */
export function addedLine(site: SiteRow): string | null {
  return site.created_at ? `added ${fmtDate(site.created_at)}` : null
}

/**
 * WHAT IS ON A SITE — board 1b's three lines, from three real reads.
 *
 * *** EVERY NUMBER HERE IS A COUNT SOMETHING ELSE ALREADY SHOWS. *** The dates are
 * `lib/calendarCounts.ts`'s own `liveDates` filter with one `eq` on the site, so the drawer and the
 * Calendar cannot disagree about what is on the calendar — which is the failure
 * `components/AppLayout.tsx` records, where a badge read 12 beside a page showing none. The audits
 * are `audit_runs` that are `done`, the status `lib/auditView.ts` says counts. The questions are
 * `company_switches` rows for this site, and `ready` from `/api/switches/ask?entity_id=`.
 *
 * `null` is "not read yet" and draws nothing. It is not 0: §9a — a check that cannot see anything
 * looks exactly like a check that found nothing, and "0 dates on the calendar" for a site whose
 * read failed is a claim nobody made.
 */
export interface SiteCounts {
  dates: number | null
  audits: number | null
  /** The most recent finished run, for the board's "· Washington L&I, 26 September 2026". */
  lastAudit: { name: string; on: string | null } | null
  answered: number | null
  open: number | null
}

export function siteCountLines(c: SiteCounts): string[] {
  const out: string[] = []
  if (c.dates !== null) out.push(`${countWord(c.dates, 'date')} on the calendar`)
  if (c.audits !== null) {
    const tail = c.lastAudit
      ? ` · ${c.lastAudit.name}${c.lastAudit.on ? `, ${fmtDate(c.lastAudit.on)}` : ''}`
      : ''
    out.push(`${countWord(c.audits, 'audit')}${tail}`)
  }
  if (c.answered !== null && c.open !== null) {
    out.push(`${c.answered} site question${c.answered === 1 ? '' : 's'} answered · ${c.open} open`)
  }
  return out
}

/** Nothing attached, and every read came back. Board 1b has no empty state, so this is its words. */
export const NOTHING_ON_SITE = 'Nothing is attached to this site yet.'

/**
 * *** OPEN QUESTIONS COUNT AS SOMETHING TO SAY. ***
 * A site with no dates, no audits and no answers but nine questions we could ask is not "nothing":
 * board 1b's third line — `3 site questions answered · 9 open` — is exactly the line a person needs
 * there, and an earlier version of this suppressed it behind the empty sentence. Nothing attached
 * AND nothing to ask is the only genuinely empty case. `null` is "not read", and a read that did
 * not come back can never make this true (§9a).
 */
export function siteIsEmpty(c: SiteCounts): boolean {
  return c.dates === 0 && c.audits === 0 && c.answered === 0 && (c.open === 0 || c.open === null)
}

/**
 * A SWITCH'S ANSWER AS A PERSON READS IT — `Yes`, `38`, `Manufacturer`.
 *
 * The same rule as `app/company-information/page.tsx:112`'s `plainValue`, which is older and local
 * to that page. **Converting that page to this is owed and is deliberately not in this step**: its
 * brief says the name leaves the draft and nothing else on it changes. Two copies of one rule is
 * the thing this file exists to avoid, so it is written down as owed rather than left unsaid.
 *
 * A value with no label shows AS STORED — visibly wrong on a line beats invisibly replaced by a
 * guess at what it is called.
 */
export function answerWord(
  value: string, valueType: string | null, labels?: Record<string, string> | null,
): string {
  if (valueType === 'boolean') {
    if (value === 'true') return 'Yes'
    if (value === 'false') return 'No'
  }
  return labels?.[value] ?? value
}

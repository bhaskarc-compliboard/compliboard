/**
 * WHO CAN SIGN IN — My Account step 7's words and display rules (board 2, `ACCOUNT-PLAN.md`
 * decision 6).
 *
 * The same split `lib/accountView.ts` and `lib/dashboardView.ts` keep: every sentence the page and
 * the routes say, and every rule that turns a row into a line, as plain values and pure functions.
 * No database, no clock, no React. `tests/unit/peopleView.test.ts` reads
 * `docs/account-boards.html` itself and fails if a word here has drifted from the approved picture.
 *
 * *** THE REFUSALS LIVE HERE TOO, AND THAT IS THE POINT OF THE FILE. ***
 * A refusal is a sentence a customer reads at the worst moment, and there are seven of them across
 * three routes and one page with no session. Written at each call site they drift; written here
 * they can be read side by side and tested without a server.
 *
 * Browser-safe: it imports `lib/listWords.ts`, which imports nothing.
 */
import { fmtDate } from './listWords.ts'

// ── The tab ──────────────────────────────────────────────────────────────────────────────────────

export const PEOPLE_HEADING = 'People who can sign in'
export const INVITE_ACTION = '+ Invite someone'
export const YOU_PILL = 'You'
export const INVITED_PILL = 'Invited'
export const REMOVE = 'Remove'
export const RESEND = 'Send the link again'
export const CANCEL_INVITE = 'Cancel'

/** Board 2's switch line. The words are the same whether it is a control or a statement. */
export const CALENDAR_EMAIL_LABEL = 'Monthly calendar email'
export const ON = 'on'
export const OFF = 'off'
export function calendarEmailLine(on: boolean): string {
  return `${CALENDAR_EMAIL_LABEL}: ${on ? ON : OFF}`
}

/** `joined 10 June 2026`, or nothing when the row carries no date. */
export function joinedLine(iso: string | null | undefined): string | null {
  const d = fmtDate(iso)
  return d ? `joined ${d}` : null
}

/** Board 2: `invited 21 October 2026 · the link is good for 7 days`. */
export const LINK_GOOD_FOR = 'the link is good for 7 days'
export function invitedLine(iso: string | null | undefined): string {
  const d = fmtDate(iso)
  return [d ? `invited ${d}` : null, LINK_GOOD_FOR].filter(Boolean).join(' · ')
}

/**
 * What a person is called on the list: their name, or — when they have not given one — the address
 * they sign in with. Never "Unknown", never a blank: every row on this list is a real person who
 * can reach the company's data, and a row with no words would be the most alarming one on the page.
 */
export function personName(fullName: string | null | undefined, email: string | null | undefined): string {
  const n = (fullName ?? '').trim()
  if (n) return n
  const e = (email ?? '').trim()
  return e || 'Someone with no name or address on record'
}

// ── The invite card ──────────────────────────────────────────────────────────────────────────────

export const INVITE_TITLE = 'Invite someone'
export const INVITE_LEDE =
  'They get a link by email, set their own password, and sign in to this company. ' +
  'Everyone here sees the same things.'
export const INVITE_PLACEHOLDER = 'name@company.com'
export const INVITE_SEND = 'Send the invitation'

// ── The seven refusals ───────────────────────────────────────────────────────────────────────────

/**
 * *** THE SHAPE IS DELIBERATELY NOT A FULL RFC 5322 CHECK. ***
 * A regular expression that accepts every legal address rejects none of the typos, and one that
 * rejects typos rejects legal addresses. This asks only what the product can act on — one `@`, a
 * dot after it, no spaces — and lets the mail system be the judge of the rest. A person whose
 * unusual-but-legal address is refused here would be stuck with no way round it, so the test is
 * loose on purpose.
 */
export function looksLikeEmail(raw: string): boolean {
  const e = (raw ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export const BAD_EMAIL = 'That does not look like an email address. Check it and try again.'
export const alreadySignsIn = (email: string) => `${email} can already sign in.`
export const alreadyInvited = (email: string) =>
  `An invitation to ${email} is already out. Send the link again from the list.`
export const INVITE_FAILED = 'We could not send that invitation just now. Nothing was sent.'

/** E's two refusals. Removing yourself is a different mistake from emptying the company. */
export const CANNOT_REMOVE_SELF =
  'You cannot remove yourself here. Delete the company from the Cancel tab, or ask a colleague to remove you.'
export const CANNOT_REMOVE_LAST =
  'This is the only person who can sign in, so they cannot be removed. ' +
  'Delete the company from the Cancel tab if that is what you mean.'
export const REMOVE_FAILED = 'We could not remove that person just now. Nothing was changed.'

/** The shared sheet's words. `name` is `personName`'s answer, so it is never blank. */
export const removeTitle = (name: string) => `Remove ${name}?`
export const REMOVE_LEDE = 'They will no longer be able to sign in. What they did here stays.'

// ── /join, which has no session ──────────────────────────────────────────────────────────────────

export const JOIN_PASSWORD_MIN = 10
export const JOIN_PASSWORD_HINT = `At least ${JOIN_PASSWORD_MIN} characters`
export const JOIN_NAME_LABEL = 'Your name'
export const JOIN_PASSWORD_LABEL = 'Password'
export const JOIN_EMAIL_LABEL = 'Your email'
export const joinTitle = (inviter: string, company: string) => `${inviter} invited you to join ${company}`
export const joinButton = (company: string) => `Join ${company}`

/**
 * *** FOUR WAYS A LINK CAN BE DEAD, AND THEY ARE NOT THE SAME SENTENCE. ***
 * `CLAUDE.md` §5.1: never assert anything we did not establish, and always say what the person can
 * do next. "Expired" has a remedy and names who has it; "already used" means they have an account
 * and should sign in; "withdrawn" is somebody's decision; "not found" is the only one where we
 * genuinely do not know what happened, and it says so rather than guessing at a cause.
 */
export type JoinProblem = 'expired' | 'cancelled' | 'accepted' | 'not_found'

export function joinProblemSentence(problem: JoinProblem, inviter: string | null): string {
  const who = (inviter ?? '').trim() || 'whoever invited you'
  switch (problem) {
    case 'expired':
      return `This link has expired. Ask ${who} to send a new one.`
    case 'cancelled':
      return `This invitation was withdrawn. Ask ${who} if you think that is a mistake.`
    case 'accepted':
      return 'This link has already been used. If that was you, sign in instead.'
    case 'not_found':
      return 'We could not find that invitation. Check the link in your email, or ask for a new one.'
  }
}

/** The link shown under the sentence, for the two problems a person can act on themselves. */
export function joinProblemLink(problem: JoinProblem): { label: string; href: string } | null {
  return problem === 'accepted' || problem === 'not_found'
    ? { label: 'Go to sign in', href: '/login' }
    : null
}

export const JOIN_EMAIL_TAKEN = 'That email already has an account. Sign in instead.'
export const JOIN_PASSWORD_SHORT = `Your password needs at least ${JOIN_PASSWORD_MIN} characters.`
export const JOIN_NAME_REQUIRED = 'Please tell us your name, so your colleagues know who you are.'
/**
 * The one sentence for a half-made account, and it promises something the route must actually do:
 * `POST /api/join` undoes what it made before it says this.
 */
export const JOIN_BROKEN = 'Something went wrong and nothing was saved. Try the link again.'

// ── The invitation email ─────────────────────────────────────────────────────────────────────────

/** `Maria Alvarez invited you to CompliBoard`, or the address when the inviter has no name. */
export const inviteSubject = (inviter: string) => `${inviter} invited you to CompliBoard`

/** The token belongs in the link and nowhere else — never in a page's response, never in a log. */
export const joinUrl = (appUrl: string, token: string) =>
  `${appUrl.replace(/\/+$/, '')}/join?t=${encodeURIComponent(token)}`

// ── Rules, not words ─────────────────────────────────────────────────────────────────────────────

export interface PersonRow {
  id: string
  full_name: string | null
  email: string | null
  created_at: string | null
  calendar_email: boolean
  /** True for exactly one row: the person reading the page. */
  is_you: boolean
}

export interface InvitationRow {
  id: string
  email: string
  created_at: string
  expires_at: string
  /** Never the token. See `joinUrl`. */
}

/**
 * *** A LIVE INVITATION IS ONE NOBODY HAS ACCEPTED, NOBODY HAS WITHDRAWN AND TIME HAS NOT KILLED. ***
 * The first two are columns; the third is a comparison with now, which is why this is a function and
 * not a `where` clause copied into three places. `idx_invitations_company_email_live` (migration 082)
 * uses the first two only — it has to, a partial index cannot reference `now()` — so an EXPIRED
 * invitation still blocks that index while this rule says it is dead. That gap is handled where it
 * bites, in `POST /api/invitations`, and is written down there.
 */
export function isLiveInvitation(
  inv: { accepted_at: string | null; cancelled_at: string | null; expires_at: string },
  now: Date = new Date(),
): boolean {
  if (inv.accepted_at || inv.cancelled_at) return false
  const t = new Date(inv.expires_at).getTime()
  return Number.isFinite(t) && t > now.getTime()
}

/** Which problem a token has, or null when it is good. The order is the order a person cares about. */
export function invitationProblem(
  inv: { accepted_at: string | null; cancelled_at: string | null; expires_at: string } | null,
  now: Date = new Date(),
): JoinProblem | null {
  if (!inv) return 'not_found'
  if (inv.accepted_at) return 'accepted'
  if (inv.cancelled_at) return 'cancelled'
  const t = new Date(inv.expires_at).getTime()
  if (!Number.isFinite(t) || t <= now.getTime()) return 'expired'
  return null
}

/**
 * THE ORDER OF THE LIST: you first, then everyone else by when they joined, then the invitations.
 * You first because board 2 draws it that way and because the switch on your own row is the only
 * control on the list that is yours.
 */
export function orderPeople<T extends { is_you: boolean; created_at: string | null }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    Number(b.is_you) - Number(a.is_you) ||
    String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
}

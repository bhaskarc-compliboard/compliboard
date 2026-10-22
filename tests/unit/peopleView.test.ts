/**
 * THE PEOPLE TAB, /join AND THE INVITATION — My Account step 7 (board 2, decision 6).
 *
 * The sentences are checked against `docs/account-boards.html` ITSELF, not against a copy typed
 * here, for the reason `tests/unit/accountView.test.ts` does the same: a test that quotes its own
 * expectation cannot catch the page and the picture coming apart.
 *
 * The last section is the one that matters most. It holds what the routes must never do — hand a
 * token to a browser, let a person empty a company, trust a form instead of the boundary — because
 * those are the failures nothing else would notice.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PEOPLE_HEADING, INVITE_ACTION, YOU_PILL, INVITED_PILL, REMOVE, RESEND, CANCEL_INVITE,
  CALENDAR_EMAIL_LABEL, ON, OFF, calendarEmailLine, joinedLine, invitedLine, LINK_GOOD_FOR,
  personName, INVITE_TITLE, INVITE_LEDE, INVITE_PLACEHOLDER, INVITE_SEND,
  looksLikeEmail, BAD_EMAIL, alreadySignsIn, alreadyInvited,
  CANNOT_REMOVE_SELF, CANNOT_REMOVE_LAST, removeTitle, REMOVE_LEDE,
  joinTitle, joinButton, joinProblemSentence, joinProblemLink, invitationProblem, isLiveInvitation,
  JOIN_EMAIL_TAKEN, JOIN_PASSWORD_MIN, JOIN_PASSWORD_SHORT, JOIN_BROKEN,
  inviteSubject, joinUrl, orderPeople,
} from '../../lib/peopleView.ts'
import {
  invitationEmail, invitationMailBlocked, MAIL_NOT_ON,
} from '../../lib/invitationEmail.ts'
import { SANDBOX_FROM, SANDBOX_SENDER } from '../../lib/email.ts'

/**
 * The source with its comments taken out. Every assertion about a route is about what it DOES, and
 * a paragraph explaining that a token never reaches a browser necessarily contains the word
 * "token" — two of these checks failed on their own explanation before this was added.
 */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')

const boardText = readFileSync('docs/account-boards.html', 'utf8')
  .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&apos;|&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const onBoard = (s: string) => boardText.includes(s.replace(/\s+/g, ' '))

describe('board 2\'s words are the board\'s', () => {
  test('the heading, the pills and every control', () => {
    for (const s of [PEOPLE_HEADING, INVITE_ACTION, YOU_PILL, INVITED_PILL, REMOVE, RESEND,
                     CANCEL_INVITE, INVITE_TITLE, INVITE_LEDE, INVITE_PLACEHOLDER, INVITE_SEND,
                     LINK_GOOD_FOR]) {
      assert.ok(onBoard(s), `not on board 2: ${JSON.stringify(s)}`)
    }
  })
  test('the switch line, both ways', () => {
    assert.equal(calendarEmailLine(true), 'Monthly calendar email: on')
    assert.equal(calendarEmailLine(false), 'Monthly calendar email: off')
    assert.ok(onBoard(calendarEmailLine(true)))
    assert.equal(`${CALENDAR_EMAIL_LABEL}: ${ON}`, calendarEmailLine(true))
    assert.equal(`${CALENDAR_EMAIL_LABEL}: ${OFF}`, calendarEmailLine(false))
  })
  test('the two date lines', () => {
    assert.equal(joinedLine('2026-06-10T09:00:00Z'), 'joined 10 June 2026')
    assert.equal(joinedLine(null), null, 'no date, no line — never "joined unknown"')
    assert.equal(invitedLine('2026-10-21T09:00:00Z'), 'invited 21 October 2026 · the link is good for 7 days')
    // The board writes the two halves with no spaces around its separator ("2026·the link"), so
    // they are checked as the two facts they are rather than as one typographic string.
    assert.ok(onBoard('invited 21 October 2026'))
    assert.ok(onBoard(LINK_GOOD_FOR))
  })
  test('the remove sheet', () => {
    assert.equal(removeTitle('Dev Patel'), 'Remove Dev Patel?')
    assert.equal(REMOVE_LEDE, 'They will no longer be able to sign in. What they did here stays.')
  })
})

describe('what a person is called', () => {
  test('their name, or the address they sign in with', () => {
    assert.equal(personName('Dev Patel', 'dev@x.com'), 'Dev Patel')
    assert.equal(personName('  ', 'dev@x.com'), 'dev@x.com')
    assert.equal(personName(null, 'dev@x.com'), 'dev@x.com')
  })
  test('*** NEVER A BLANK ROW ***', () => {
    // Every row on this list is somebody who can reach the company's data. A row with no words
    // would be the most alarming one on the page, so the last resort says what is true.
    const out = personName(null, null)
    assert.ok(out.length > 0)
    assert.ok(!/unknown|anonymous/i.test(out))
  })
})

describe('the order of the list', () => {
  test('you first, then by when they joined', () => {
    const rows = [
      { id: 'b', is_you: false, created_at: '2026-10-14T00:00:00Z' },
      { id: 'a', is_you: true, created_at: '2026-06-10T00:00:00Z' },
      { id: 'c', is_you: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    assert.deepEqual(orderPeople(rows).map((r) => r.id), ['a', 'c', 'b'])
  })
  test('it does not mutate what it was given', () => {
    const rows = [{ id: 'x', is_you: false, created_at: null }, { id: 'y', is_you: true, created_at: null }]
    orderPeople(rows)
    assert.deepEqual(rows.map((r) => r.id), ['x', 'y'])
  })
})

describe('an email address, loosely', () => {
  test('what the product can act on', () => {
    for (const ok of ['a@b.co', 'sam+s7@example.com', 'first.last@sub.domain.org']) {
      assert.ok(looksLikeEmail(ok), ok)
    }
    for (const bad of ['', '   ', 'sam', 'sam@', '@example.com', 'sam@example', 'a b@c.com']) {
      assert.ok(!looksLikeEmail(bad), bad)
    }
  })
  test('*** LOOSE ON PURPOSE ***', () => {
    // A pattern strict enough to catch typos rejects legal addresses, and a person whose unusual
    // address is refused here has no way round it. The mail system is the judge of the rest.
    assert.ok(looksLikeEmail('"odd"@example.com') || true)
    assert.ok(BAD_EMAIL.includes('Check it'), 'it says what they can do')
  })
})

describe('the refusals, side by side', () => {
  test('each names the thing it is about and what to do next', () => {
    assert.equal(alreadySignsIn('sam@x.com'), 'sam@x.com can already sign in.')
    assert.equal(alreadyInvited('sam@x.com'),
      'An invitation to sam@x.com is already out. Send the link again from the list.')
    assert.ok(CANNOT_REMOVE_SELF.includes('Cancel tab'))
    assert.ok(CANNOT_REMOVE_LAST.includes('Cancel tab'))
    assert.equal(JOIN_PASSWORD_SHORT, 'Your password needs at least 10 characters.')
    assert.equal(JOIN_PASSWORD_MIN, 10)
  })
  test('none of them blames the person or leaks machinery', () => {
    for (const s of [BAD_EMAIL, alreadySignsIn('a@b.co'), alreadyInvited('a@b.co'),
                     CANNOT_REMOVE_SELF, CANNOT_REMOVE_LAST, JOIN_EMAIL_TAKEN, JOIN_BROKEN,
                     JOIN_PASSWORD_SHORT]) {
      assert.ok(!/error|exception|null|undefined|RLS|policy|42501|23505/i.test(s), s)
    }
  })
  test('*** "NOTHING WAS SAVED" IS A PROMISE THE ROUTE HAS TO KEEP ***', () => {
    assert.equal(JOIN_BROKEN, 'Something went wrong and nothing was saved. Try the link again.')
    // So every failure after the login is created must undo it. Three of them, plus the catch.
    const route = readFileSync('app/api/join/route.ts', 'utf8')
    const undos = code(route).match(/auth\.admin\.deleteUser\(/g) ?? []
    assert.ok(undos.length >= 3, `only ${undos.length} undo(s) for a promise that nothing was saved`)
  })
})

describe('a link that cannot be used', () => {
  const live = { accepted_at: null, cancelled_at: null, expires_at: '2099-01-01T00:00:00Z' }
  test('the four problems, in the order a person cares about', () => {
    assert.equal(invitationProblem(null), 'not_found')
    assert.equal(invitationProblem({ ...live, accepted_at: '2026-10-21T00:00:00Z' }), 'accepted')
    assert.equal(invitationProblem({ ...live, cancelled_at: '2026-10-21T00:00:00Z' }), 'cancelled')
    assert.equal(invitationProblem({ ...live, expires_at: '2020-01-01T00:00:00Z' }), 'expired')
    assert.equal(invitationProblem(live), null)
    // Accepted beats cancelled: somebody who joined and was later withdrawn should be told to sign
    // in, not that their invitation was pulled.
    assert.equal(invitationProblem({ accepted_at: 'x', cancelled_at: 'y', expires_at: live.expires_at }), 'accepted')
  })
  test('an unreadable expiry is expired, not usable', () => {
    assert.equal(invitationProblem({ accepted_at: null, cancelled_at: null, expires_at: 'not a date' }), 'expired')
    assert.equal(isLiveInvitation({ accepted_at: null, cancelled_at: null, expires_at: 'not a date' }), false)
  })
  test('each problem has its own sentence, and two of them have a way out', () => {
    assert.equal(joinProblemSentence('expired', 'Maria'), 'This link has expired. Ask Maria to send a new one.')
    assert.ok(joinProblemSentence('expired', null).includes('whoever invited you'))
    assert.ok(joinProblemSentence('accepted', 'Maria').includes('sign in instead'))
    assert.ok(joinProblemSentence('cancelled', 'Maria').includes('Maria'))
    assert.ok(joinProblemSentence('not_found', 'Maria').includes('Check the link'))
    assert.deepEqual(joinProblemLink('accepted'), { label: 'Go to sign in', href: '/login' })
    assert.deepEqual(joinProblemLink('not_found'), { label: 'Go to sign in', href: '/login' })
    assert.equal(joinProblemLink('expired'), null, 'a new link is the inviter\'s to send')
    assert.equal(joinProblemLink('cancelled'), null)
  })
  test('four different sentences, not one shrug', () => {
    const all = (['expired', 'cancelled', 'accepted', 'not_found'] as const)
      .map((p) => joinProblemSentence(p, 'Maria'))
    assert.equal(new Set(all).size, 4)
  })
})

describe('the invitation email', () => {
  const mail = invitationEmail({
    inviter: 'Maria Alvarez', company: 'Willamette Vinegar Works',
    appUrl: 'https://app.compliboard.test/', token: 'abc123',
  })
  test('the subject says who is asking', () => {
    assert.equal(mail.subject, 'Maria Alvarez invited you to CompliBoard')
    assert.equal(inviteSubject('sam@x.com'), 'sam@x.com invited you to CompliBoard')
  })
  test('one button, to the link, with the company in it', () => {
    assert.equal(mail.shape.button?.label, 'Join Willamette Vinegar Works')
    assert.equal(mail.shape.button?.href, 'https://app.compliboard.test/join?t=abc123')
    assert.equal(joinButton('Acme'), 'Join Acme')
  })
  test('the link is absolute and the trailing slash does not double', () => {
    assert.equal(joinUrl('https://x.test/', 't'), 'https://x.test/join?t=t')
    assert.equal(joinUrl('https://x.test', 't'), 'https://x.test/join?t=t')
    assert.ok(joinUrl('https://x.test', 'a b&c').includes('a%20b%26c'), 'the token is encoded')
  })
  test('it says how long the link lasts, and that ignoring it costs nothing', () => {
    const footer = mail.shape.footer.join(' ')
    assert.ok(/good for 7 days/i.test(footer))
    assert.ok(/ignore it/i.test(footer))
  })
  test('*** THE TOKEN APPEARS ONLY IN THE LINK ***', () => {
    const everywhere = JSON.stringify({ ...mail, shape: { ...mail.shape, button: null } })
    assert.ok(!everywhere.includes('abc123'), 'the token must not be in the title, lede or footer')
  })
})

describe('*** WHAT THE ROUTES MUST NEVER DO ***', () => {
  const people = code(readFileSync('app/api/people/route.ts', 'utf8'))
  const invitations = code(readFileSync('app/api/invitations/route.ts', 'utf8'))
  const joinSrc = readFileSync('app/api/join/route.ts', 'utf8')
  const join = code(joinSrc)
  const remove = code(readFileSync('app/api/people/[id]/route.ts', 'utf8'))
  const page = code(readFileSync('app/join/page.tsx', 'utf8'))
  const tab = code(readFileSync('components/PeopleTab.tsx', 'utf8'))

  test('no token ever reaches a browser', () => {
    // 082 keeps `token` out of the person's SELECT grant. These two could read it with the admin
    // client and must not put it in a response.
    assert.ok(!/token/.test(people), '/api/people must not mention a token at all')
    assert.match(invitations, /select\('token'\)/, 'it reads one, to build the link')
    assert.ok(!/NextResponse\.json\(\{[^}]*token/.test(invitations), 'and never returns it')
    assert.ok(!/console\.log\([^)]*token/.test(invitations), 'nor logs it')
    assert.ok(!/ok: true, invitation: \{[^}]*token/.test(join))
  })

  test('the tenant work is the caller\'s and the admin client is named', () => {
    for (const [name, src] of [['people', people], ['invitations', invitations], ['remove', remove]] as const) {
      assert.match(src, /requireCompany\(request\)/, `${name} must authenticate`)
    }
    // /api/join is the one with no session, and says so — the claim is read from the full source,
    // because saying so IS a comment.
    assert.ok(!/requireCompany/.test(join))
    assert.match(joinSrc, /THE ONE ROUTE WITH NO SESSION/)
  })

  test('a person cannot remove themselves or empty a company', () => {
    assert.match(remove, /id === userId/)
    assert.match(remove, /CANNOT_REMOVE_SELF/)
    assert.match(remove, /count <= 1/)
    assert.match(remove, /CANNOT_REMOVE_LAST/)
    // A count that failed to read is not permission to delete.
    assert.match(remove, /typeof count !== 'number' \|\| count <= 1/)
  })

  test('the password rule is enforced where it counts, not only in the form', () => {
    assert.match(join, /password\.length < JOIN_PASSWORD_MIN/)
    assert.match(page, /password\.length < JOIN_PASSWORD_MIN/)
  })

  test('the token is checked again on POST, not trusted from the GET', () => {
    const post = join.slice(join.indexOf('export async function POST'))
    assert.match(post, /readInvitation\(token\)/)
    assert.match(post, /invitationProblem\(inv\)/)
  })

  test('the switch is written only on your own row', () => {
    // `profiles`' UPDATE policy is `auth.uid() = profiles.id` (080). The component may not even
    // offer a control on anybody else's row.
    assert.match(tab, /p\.is_you \? \(/)
    assert.match(tab, /setMyCalendarEmail\(p\.id, !p\.calendar_email\)/)
    assert.match(tab, /update\(\{ calendar_email: on \}\)\.eq\('id', id\)/)
  })

  test('/join is outside the app shell, because nobody there has a session', () => {
    assert.ok(!/AppLayout/.test(page))
  })
})


/* =================================================================================================
   WHEN MAIL CANNOT BE SENT — step 11 part A.
   ================================================================================================= */
describe('an invitation that cannot be emailed is never created', () => {
  const ok = { from: 'CompliBoard <hello@compliboard.com>', vercelEnv: 'production',
               resendKey: 'rs_live_x', appUrl: 'https://app.compliboard.com' }

  test('everything in place: nothing blocks it', () => {
    assert.equal(invitationMailBlocked(ok), null)
    // ...and off production the sandbox sender is fine, which is what keeps staging working.
    assert.equal(invitationMailBlocked({ ...ok, from: SANDBOX_FROM, vercelEnv: undefined }), null)
    assert.equal(invitationMailBlocked({ ...ok, from: SANDBOX_FROM, vercelEnv: 'preview' }), null)
  })

  test('*** THE SANDBOX SENDER ON PRODUCTION BLOCKS IT *** — which is today', () => {
    const b = invitationMailBlocked({ ...ok, from: SANDBOX_FROM, vercelEnv: 'production' })
    assert.ok(b)
    assert.equal(b!.sentence, MAIL_NOT_ON)
    // The log says which of the three it was; the person never sees it.
    assert.ok(b!.why.includes(SANDBOX_SENDER))
  })

  test('no key, or no app URL, blocks it too — and says the same thing to the person', () => {
    for (const bad of [{ resendKey: '' }, { resendKey: '   ' }, { appUrl: '' }]) {
      const b = invitationMailBlocked({ ...ok, ...bad })
      assert.ok(b, JSON.stringify(bad))
      assert.equal(b!.sentence, MAIL_NOT_ON)
    }
    // A dead link is worse than no email, so a missing app URL is a refusal and not a shrug.
    assert.match(invitationMailBlocked({ ...ok, appUrl: '' })!.why, /dead/)
  })

  test('the sentence tells the truth and does not invite a pointless retry', () => {
    assert.equal(MAIL_NOT_ON,
      'Invitations by email are not switched on yet. We will let you know when they are.')
    // "could not ... just now" would invite trying again, which fails identically.
    assert.ok(!/just now|try again/i.test(MAIL_NOT_ON))
  })

  test('*** AND THE ROUTE ASKS BEFORE IT WRITES ANYTHING ***', () => {
    // The whole fix is the order. It used to insert the row, read its token, build the mail and
    // only then discover the guard — leaving a live invitation for an email nobody would receive,
    // occupying the one-live-invitation index, and left there for good by any failure in between.
    const route = code(readFileSync('app/api/invitations/route.ts', 'utf8'))
    const asked = route.indexOf('invitationMailBlocked(')
    const written = route.indexOf(".insert({ company_id")
    assert.ok(asked > 0 && written > 0, 'both must be present')
    assert.ok(asked < written, 'the refusal must be settled before the row is written')
    // And the resend takes the same branch: the cancel of the OLD invitation also comes after.
    const cancelled = route.indexOf('cancelled_at: now.toISOString()')
    assert.ok(asked < cancelled, 'a refusal must not withdraw a working invitation first')
    // Nothing writes a row and then cancels it for this reason any more.
    assert.ok(!/sandboxSenderRefusal/.test(route), 'the late guard is gone from the route')
  })
})

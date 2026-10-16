/**
 * THE ONE EMAIL TEMPLATE AND THE MONTHLY CALENDAR EMAIL — Calendar step 11
 * (`DECISIONS.md` §197, `docs/TESTING.md` C11; board 10).
 *
 * Two things are tested here and they are different in kind:
 *
 *   1. `lib/email.ts` — that one shape produces two bodies which say THE SAME THING. A plain-text
 *      twin written by a second author is how an email ends up with a link in one half and not
 *      the other, so the test renders a fixed shape and reads both.
 *   2. `lib/calendarEmail.ts` — which date belongs in which section, which is where a month edge
 *      or an off-by-one would be invisible on screen and wrong in somebody's inbox.
 *
 * Neither file touches a database, a clock or Resend, which is why both can be read here.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  renderEmail, FOOTER_NOT_LEGAL_ADVICE, footerBecauseMember, sandboxSenderRefusal,
  SANDBOX_SENDER, SANDBOX_FROM, type EmailShape,
} from '../../lib/email.ts'
import {
  calendarEmail, splitForMonth, emailRow, bySite, sourceWords, nextMonthKey, prevMonthKey,
  EARLY_DAYS, DUE_HEADING, EARLY_HEADING, PASSED_HEADING, UNDATED_LINE, NOT_RIGHT_LINE,
} from '../../lib/calendarEmail.ts'
import type { CalendarRow } from '../../lib/calendarView.ts'

const row = (p: Partial<CalendarRow>): CalendarRow => ({
  id: 'r1', title: 'A date', description: null, due_date: null, next_due: null, days_until: null,
  has_passed: false, status: 'confirmed', source: 'document', recurs: false, period: null,
  source_line: null, source_url: null, source_page: null, source_title: 'The permit',
  site_id: null, site_name: null, entity_id: null, document_id: 'd1', handbook_id: null,
  audit_finding_id: null, deadline_id: null, added_by: null, confirmed_by: null, confirmed_at: null,
  dismissed_by: null, dismissed_at: null, dismissed_reason: null, replaced_by: null, created_at: null, ...p,
})

const APP = 'https://app.compliboard.com'

describe('the template: one shape, two bodies that agree', () => {
  const shape: EmailShape = {
    title: 'Due this month at Willamette Vinegar Works',
    lede: 'November 2026 · 2 dates',
    sections: [
      { heading: 'Portland plant', rows: [
        { primary: '15 Nov — Air permit expires', secondary: 'From the air permit', href: `${APP}/calendar?date=a1` },
      ] },
      { heading: 'Every site', rows: [
        { primary: '30 Nov — Visual monitoring', secondary: 'Added by Priya Nair', href: `${APP}/calendar?date=a2` },
      ] },
    ],
    button: { label: 'Open your calendar', href: `${APP}/calendar` },
    footer: ['You get this because you are a member of Willamette Vinegar Works on CompliBoard.', FOOTER_NOT_LEGAL_ADVICE],
  }
  const { html, text } = renderEmail(shape)

  test('every row, heading and footer line is in BOTH halves', () => {
    for (const s of shape.sections) {
      assert.ok(html.includes(s.heading!), `html is missing the heading ${s.heading}`)
      assert.ok(text.includes(s.heading!.toUpperCase()), `text is missing the heading ${s.heading}`)
      for (const r of s.rows) {
        assert.ok(html.includes(r.primary), `html is missing ${r.primary}`)
        assert.ok(text.includes(r.primary), `text is missing ${r.primary}`)
        assert.ok(html.includes(r.secondary!), 'html is missing a secondary line')
        assert.ok(text.includes(r.secondary!), 'text is missing a secondary line')
      }
    }
    for (const f of shape.footer) {
      assert.ok(html.includes(f) && text.includes(f), `a footer line is missing: ${f}`)
    }
  })

  test('every link is in both, and the plain text writes it out in full', () => {
    for (const href of [`${APP}/calendar?date=a1`, `${APP}/calendar?date=a2`, `${APP}/calendar`]) {
      assert.ok(html.includes(href), `html is missing ${href}`)
      assert.ok(text.includes(href), `text is missing ${href} — there is nothing to click in plain text`)
    }
  })

  test('the text version has no HTML in it at all', () => {
    assert.ok(!/<[a-z!/][^>]*>/i.test(text), `the plain text carries markup:\n${text.slice(0, 200)}`)
    assert.ok(!text.includes('&nbsp;') && !text.includes('&amp;'), 'and no entities either')
  })

  test('it says nothing about AI, and nothing about money', () => {
    for (const body of [html, text]) {
      for (const banned of [/\bAI\b/, /\bcost\b/i, /\$[0-9]/, /\btoken/i, /\bmodel\b/i]) {
        assert.ok(!banned.test(body), `an email must not say ${banned}`)
      }
    }
  })

  test('the HTML is an email, not a web page', () => {
    assert.match(html, /width="600"/, '600px, as board 10 draws it')
    assert.ok(!/<link|<style|class=/.test(html), 'no stylesheet and no classes — mail clients strip them')
    assert.match(html, /style="[^"]*background:#2F7D52/, "the button is the product's green")
    assert.match(html, /<span style="color:#2F7D52">Compli<\/span>/, 'the wordmark is text, not an image')
  })

  test('a row with no link and a shape with no button still render', () => {
    const bare = renderEmail({ title: 'T', lede: 'L', sections: [{ rows: [{ primary: 'One thing' }] }], footer: ['F'] })
    assert.ok(bare.html.includes('One thing') && bare.text.includes('One thing'))
    assert.ok(!bare.html.includes('<a href'), 'nothing to link to')
  })

  test('a title with an ampersand is escaped in the HTML and plain in the text', () => {
    const e = renderEmail({ title: 'Smith & Co', lede: 'x', sections: [], footer: [] })
    assert.ok(e.html.includes('Smith &amp; Co'))
    assert.ok(e.text.includes('Smith & Co'))
  })
})

describe('which date belongs in which section', () => {
  const month = '2026-11'
  const rows = [
    row({ id: 'a', title: 'Air permit expires', next_due: '2026-11-15', due_date: '2026-11-15' }),
    row({ id: 'b', title: 'Tier II report', next_due: '2026-11-01', due_date: '2026-11-01' }),
    row({ id: 'c', title: 'Early one', next_due: '2026-12-03', due_date: '2026-12-03' }),
    row({ id: 'd', title: 'Too far', next_due: '2026-12-09', due_date: '2026-12-09' }),
    row({ id: 'e', title: 'Passed one', next_due: '2026-10-28', due_date: '2026-10-28', has_passed: true }),
    row({ id: 'f', title: 'Older still', next_due: '2026-09-28', due_date: '2026-09-28', has_passed: true }),
    row({ id: 'g', title: 'No day yet', recurs: true, period: null }),
  ]
  const parts = splitForMonth(rows, month)

  test('the month, soonest first', () => {
    assert.deepEqual(parts.due.map((r) => r.id), ['b', 'a'])
  })
  test('the first 7 days of the next month, and nothing after them (open question 3)', () => {
    assert.equal(EARLY_DAYS, 7)
    assert.deepEqual(parts.early.map((r) => r.id), ['c'])
  })
  test('last month, and only what has passed', () => {
    assert.deepEqual(parts.passed.map((r) => r.id), ['e'])
  })
  test('a repeating date with no day is its own line, not a missing row', () => {
    assert.deepEqual(parts.undated.map((r) => r.id), ['g'])
  })
  /**
   * The edges, because an off-by-one here is invisible on screen and wrong in an inbox: the 1st
   * and the last day of the month are IN, and the 7th of the next month is early while the 8th
   * is not.
   */
  test('the edges', () => {
    const edge = splitForMonth([
      row({ id: 'first', next_due: '2026-11-01' }), row({ id: 'last', next_due: '2026-11-30' }),
      row({ id: 'd7', next_due: '2026-12-07' }), row({ id: 'd8', next_due: '2026-12-08' }),
      row({ id: 'oct31', next_due: '2026-10-31', has_passed: true }),
    ], month)
    assert.deepEqual(edge.due.map((r) => r.id), ['first', 'last'])
    assert.deepEqual(edge.early.map((r) => r.id), ['d7'])
    assert.deepEqual(edge.passed.map((r) => r.id), ['oct31'])
  })
  test('December rolls into January, and January back into December', () => {
    assert.equal(nextMonthKey('2026-12'), '2027-01')
    assert.equal(prevMonthKey('2027-01'), '2026-12')
    const dec = splitForMonth([row({ id: 'jan', next_due: '2027-01-05' })], '2026-12')
    assert.deepEqual(dec.early.map((r) => r.id), ['jan'])
  })
  test('a repeating date whose next occurrence is ahead is never "passed"', () => {
    const yearly = splitForMonth([row({ id: 'y', recurs: true, period: 'year',
      due_date: '2025-10-05', next_due: '2026-10-05', has_passed: false })], month)
    assert.equal(yearly.passed.length, 0)
    assert.equal(yearly.due.length, 0)
  })
})

describe('one site or several — decision 24', () => {
  const rows = [
    row({ id: 'a', title: 'Portland thing', next_due: '2026-11-10', site_id: 's1', site_name: 'Portland plant' }),
    row({ id: 'b', title: 'Company-wide thing', next_due: '2026-11-12' }),
    row({ id: 'c', title: 'Vancouver thing', next_due: '2026-11-14', site_id: 's2', site_name: 'Vancouver warehouse' }),
  ]
  test('with ONE site nothing about sites appears, anywhere', () => {
    const s = bySite(rows, APP, 1, {})
    assert.equal(s.length, 1)
    assert.equal(s[0].heading, undefined)
    for (const r of s[0].rows) {
      assert.ok(!/Portland plant|Vancouver warehouse|Every site/.test(`${r.primary} ${r.secondary}`))
    }
  })
  test('with several, a heading per site and "Every site" last', () => {
    const s = bySite(rows, APP, 2, {})
    assert.deepEqual(s.map((x) => x.heading), ['Portland plant', 'Vancouver warehouse', 'Every site'])
    // And the site is not repeated inside a row that already sits under its heading.
    assert.ok(!s[0].rows[0].secondary!.includes('Portland plant'))
  })
})

describe('what a row says, and what it never says', () => {
  test('the day and the title, then where it came from, and a link to the date', () => {
    const r = emailRow(row({ id: 'x', title: 'Air permit expires', next_due: '2026-11-15' }), APP, 1)
    assert.equal(r.primary, '15 Nov — Air permit expires')
    assert.equal(r.secondary, 'The permit')
    assert.equal(r.href, `${APP}/calendar?date=x`)
  })
  test('a typed date names the person; a date from the chat says so', () => {
    assert.equal(sourceWords(row({ source: 'person', source_title: null }), 'Priya Nair'), 'Added by Priya Nair')
    assert.equal(sourceWords(row({ source: 'person', source_title: null })), 'Added by hand')
    assert.equal(sourceWords(row({ source: 'rule', source_title: null })), 'Found in a rule and added in CompliBoard')
  })
  /**
   * *** DECISION 18: NO CONFIRMED OR NOT-CONFIRMED MARKS. *** Every date in this email is on the
   * calendar and is said plainly; the footer says what to do with one that is wrong. A mark here
   * would make the email a second queue.
   */
  test('a proposed date reads exactly like a confirmed one', () => {
    const proposed = emailRow(row({ id: 'x', title: 'T', next_due: '2026-11-15', status: 'proposed' }), APP, 1)
    const confirmed = emailRow(row({ id: 'x', title: 'T', next_due: '2026-11-15', status: 'confirmed' }), APP, 1)
    assert.deepEqual(proposed, confirmed)
  })
})

describe('the whole email', () => {
  const rows = [
    row({ id: 'a', title: 'Air permit expires', next_due: '2026-11-15', status: 'proposed' }),
    row({ id: 'b', title: 'Passed thing', next_due: '2026-10-20', due_date: '2026-10-20', has_passed: true }),
    row({ id: 'c', title: 'Visual monitoring', recurs: true, period: null }),
  ]
  const mail = calendarEmail({ company: 'Test Gamma Solvents', month: '2026-11', rows, siteCount: 1, appUrl: APP })
  const { html, text } = renderEmail(mail.shape)

  test('the subject, the title and the lede', () => {
    assert.equal(mail.subject, 'Test Gamma Solvents: what is due in November')
    assert.equal(mail.shape.title, 'Due this month at Test Gamma Solvents')
    assert.equal(mail.shape.lede, 'November 2026 · 1 date')
  })
  test('the sections, in board 10\'s order', () => {
    assert.deepEqual(mail.shape.sections.map((s) => s.heading),
      [DUE_HEADING('2026-11'), PASSED_HEADING('2026-11'), undefined])
    assert.match(mail.shape.sections[2].rows[0].primary, /^1 repeating date has no day set yet/)
    assert.equal(UNDATED_LINE(3), '3 repeating dates have no day set yet — set them in CompliBoard')
  })
  test('the button and the footer, with decision 18\'s line', () => {
    assert.deepEqual(mail.shape.button, { label: 'Open your calendar', href: `${APP}/calendar` })
    assert.ok(mail.shape.footer.includes(NOT_RIGHT_LINE))
    assert.ok(mail.shape.footer.some((f) => f.startsWith(footerBecauseMember('Test Gamma Solvents'))))
    assert.ok(mail.shape.footer.includes(FOOTER_NOT_LEGAL_ADVICE))
  })
  test('no banned word reaches either body', () => {
    for (const body of [html, text, mail.subject]) {
      for (const banned of [/overdue/i, /\bdone\b/i, /\bAI\b/, /compliant/i, /not confirmed/i, /\bconfirmed\b/i]) {
        assert.ok(!banned.test(body), `the email must not say ${banned}`)
      }
    }
  })

  /** An empty month still sends, and says the one thing a person wanted to know. */
  test('an empty month is short, and is still an email', () => {
    const empty = calendarEmail({ company: 'Test Beta Cannabis', month: '2026-11', rows: [], siteCount: 1, appUrl: APP })
    assert.equal(empty.subject, 'Test Beta Cannabis: nothing is due in November')
    assert.equal(empty.shape.title, 'Nothing is due in November.')
    assert.deepEqual(empty.shape.sections, [])
    assert.deepEqual(empty.shape.button, { label: 'Open your calendar', href: `${APP}/calendar` })
    const out = renderEmail(empty.shape)
    assert.ok(out.text.includes('Nothing is due in November.'))
    assert.ok(out.html.includes('Open your calendar'))
  })
  test('an empty month that still has passed dates says both', () => {
    const e = calendarEmail({ company: 'C', month: '2026-11', siteCount: 1, appUrl: APP,
      rows: [row({ id: 'p', title: 'Passed', next_due: '2026-10-02', due_date: '2026-10-02', has_passed: true })] })
    assert.match(e.subject, /nothing is due in November$/)
    assert.deepEqual(e.shape.sections.map((s) => s.heading), [PASSED_HEADING('2026-11')])
  })
  test('the headings say passed, never overdue', () => {
    assert.equal(PASSED_HEADING('2026-11'), 'Still on your calendar from October, passed')
    assert.equal(EARLY_HEADING('2026-11'), 'Early in December')
  })
})

describe('the job: the claim comes first', () => {
  const route = readFileSync('app/api/jobs/calendar-month/route.ts', 'utf8')
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('the cron secret, then one job_runs row, in that order', () => {
    assert.ok(code.indexOf('requireCronSecret(request)') < code.indexOf("startJobRun(supabaseAdmin, 'calendar_month')"))
    assert.match(code, /await run\.finish\(counts, errors\)/)
  })
  /**
   * *** THE ORDER IS THE WHOLE MECHANISM. *** Claim, then render, then send. Written the other way
   * round, a crash between sending and stamping leaves no row and the next run sends again — and
   * "we emailed everyone twice" is not recoverable by apologising to a database.
   */
  test('the claim is INSERTed before anything is rendered or sent, and 23505 means skip', () => {
    const claim = code.indexOf(".from('calendar_mailings').insert(")
    assert.ok(claim > 0, 'the claim must be an insert')
    assert.ok(claim < code.indexOf('calendarEmail('), 'claim before render')
    assert.ok(claim < code.indexOf('resend.emails.send'), 'claim before send')
    assert.match(code, /claimError\.code === '23505'/)
    assert.match(code, /already sent this month/)
  })
  test('sent_at is stamped only after Resend accepted it', () => {
    const send = code.indexOf('resend.emails.send')
    const stamp = code.indexOf('sent_at: new Date().toISOString()')
    assert.ok(send < stamp, 'the stamp must follow the send')
    assert.match(code, /if \(res\.error\) throw new Error/)
  })
  test('a failure is written on the row and never stops the other companies', () => {
    assert.match(code, /\.update\(\{ error: message\.slice\(0, 500\) \}\)/)
    assert.match(code, /errors\.push\(\{ company_id: co\.id, error: message \}\)/)
    // The loop continues: the catch is INSIDE the for.
    assert.ok(code.indexOf('} catch (e) {') > code.indexOf('for (const co of'))
  })
  test('a dry run claims nothing and sends nothing', () => {
    assert.match(code, /if \(dryRun\) \{ result\.sent = false; continue \}/)
    const dry = code.slice(code.indexOf('if (!dryRun) {'), code.indexOf('// ---- WHAT THE EMAIL SAYS'))
    assert.match(dry, /\.select\('id'\)/, 'a dry run only READS the claim row')
  })
  test('the recipients come from auth.users, because profiles has no email column', () => {
    assert.match(code, /auth\.admin\.getUserById\(p\.id\)/)
    assert.ok(!/profiles'\)\.select\([^)]*email/.test(code), 'profiles carries no email')
  })
  test('NOTIFY_TEST_TO is the To, and the real people are still recorded', () => {
    assert.match(code, /const to = override \? \[override\] : addresses/)
    assert.match(code, /sent_to: addresses/, 'the row records who it was FOR')
  })
  test('the cron is the 1st at 14:00 UTC', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
    const cron = vercel.crons.find((c) => c.path === '/api/jobs/calendar-month')
    assert.ok(cron, 'the job must be scheduled')
    assert.equal(cron!.schedule, '0 14 1 * *')
  })
  test('migration 077 makes the claim possible, and is not applied by this test', () => {
    const m = readFileSync('supabase/migrations/077_a_mailing_is_claimed_before_it_is_sent.sql', 'utf8')
    assert.match(m, /alter column sent_at drop not null/)
    assert.match(m, /add column if not exists error text/)
    assert.match(m, /unique_violation/, 'it proves the claim is refused twice')
  })
})

/**
 * ====================================================================================
 * THE SANDBOX SENDER GUARD — Calendar step 14 (`DECISIONS.md` §200, `docs/TESTING.md` C14).
 * ====================================================================================
 *
 * The thing this prevents happens once, on the first of a month, to every customer at once, and
 * there is no recall. So it is tested at both ends: the rule as a pure function of two strings,
 * and the route as the code that obeys it in the right ORDER — before the claim, so no month is
 * taken, and before the render, so nothing is paid for.
 */
describe('the sandbox sender cannot reach a customer', () => {
  test('the address the product sends from today, said once', () => {
    assert.equal(SANDBOX_SENDER, 'onboarding@resend.dev')
    assert.equal(SANDBOX_FROM, 'CompliBoard <onboarding@resend.dev>')
  })

  test('production plus the sandbox sender is a refusal that says what to do', () => {
    const r = sandboxSenderRefusal(SANDBOX_FROM, 'production')
    assert.ok(r, 'it must refuse')
    assert.match(r!, /onboarding@resend\.dev/)
    assert.match(r!, /Verify the CompliBoard domain in Resend/)
    assert.match(r!, /Nothing was claimed and nothing was sent/)
  })

  // *** INERT EVERYWHERE ELSE, which is what makes it safe to add before a release. *** The laptop,
  // the isolated server, `check:live` and every test below read `undefined` and pass through.
  test('it is silent off production, whatever the sender', () => {
    for (const env of [undefined, '', 'preview', 'development', 'Production ', 'PRODUCTION']) {
      assert.equal(sandboxSenderRefusal(SANDBOX_FROM, env), null, `env ${JSON.stringify(env)}`)
    }
  })

  // *** AND IT MUST SEE A PRESENCE BEFORE IT REPORTS AN ABSENCE (CLAUDE.md §9a). *** A guard that
  // returned null for every input would pass the test above having checked nothing.
  test('a verified sender on production passes, and the probe can tell the two apart', () => {
    assert.equal(sandboxSenderRefusal('CompliBoard <dates@compliboard.com>', 'production'), null)
    assert.ok(sandboxSenderRefusal('CompliBoard <onboarding@resend.dev>', 'production'))
    // Case and surrounding text do not help it through.
    assert.ok(sandboxSenderRefusal('CompliBoard Dates <Onboarding@Resend.Dev>', 'production'))
  })

  describe('the job obeys it, and in the right order', () => {
    const route = readFileSync('app/api/jobs/calendar-month/route.ts', 'utf8')
    const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    test('the refusal is decided before the claim and before the render', () => {
      const guard = code.indexOf('sandboxSenderRefusal(SANDBOX_FROM, process.env.VERCEL_ENV)')
      assert.ok(guard > 0, 'the job must ask the rule')
      assert.ok(guard < code.indexOf(".from('calendar_mailings').insert("), 'before the claim')
      assert.ok(guard < code.indexOf('calendarEmail('), 'before the render')
      assert.ok(guard < code.indexOf('resend.emails.send'), 'before the send')
    })

    test('a refused run writes the reason on its job_runs row and says so out loud', () => {
      assert.match(code, /await run\.finish\(refused, \[\{ error: sandbox \}\]\)/)
      assert.match(code, /console\.error\(`CALENDAR EMAIL NOT SENT: \$\{sandbox\}`\)/)
      assert.match(code, /refused: sandbox/)
    })

    test('a refused run is loud in the Vercel log: 503, not a green 200', () => {
      const guard = code.indexOf('if (sandbox && !dryRun) {')
      assert.ok(guard > 0)
      assert.match(code.slice(guard, guard + 600), /status: 503/)
    })

    // A dry run claims nothing and sends nothing by construction, so it stays the free way to read
    // what production's first email would say — and it reports that the guard is armed.
    test('a dry run is let through and reports that the guard would have fired', () => {
      assert.match(code, /if \(sandbox && !dryRun\) \{/)
      assert.match(code, /\.\.\.\(sandbox \? \{ would_be_refused: sandbox \} : \{\}\)/)
    })

    test('the from: line is the shared constant, so the DNS change is one line', () => {
      assert.match(code, /from: SANDBOX_FROM,/)
      assert.ok(!/from: 'CompliBoard </.test(code), 'no second copy of the sender in this route')
    })
  })

  /**
   * *** THE OTHER THREE SENDERS ARE OWED, NOT DONE, AND THIS TEST IS THE RECORD. ***
   * All three send from the sandbox address on production TODAY, so switching the guard on for
   * them would silence three emails that work. They move in the commit that changes all four
   * `from:` lines to the verified domain, where the guard is inert from the moment it lands.
   * When that commit happens this test fails, and the sentence it fails on says what to do.
   */
  test('the three older senders still carry the sandbox address in their own files', () => {
    const owed = ['lib/documentBatch.ts', 'lib/auditNotify.ts', 'lib/handbookCheckNotify.ts']
    for (const f of owed) {
      assert.match(readFileSync(f, 'utf8'), /onboarding@resend\.dev/,
        `${f} no longer sends from the sandbox — give it sandboxSenderRefusal and update this test`)
    }
  })
})

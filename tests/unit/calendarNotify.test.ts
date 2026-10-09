/**
 * THE MONTHLY EMAIL — `lib/calendarNotify.ts`, Calendar decision 11, board 12.
 *
 * *** THE TEST THIS FILE EXISTS FOR IS THE LAST ONE: A READ THAT FAILS SENDS NOTHING. ***
 * `docs/FIX-LIST-FAILURES.md` R2 and R3 are about code that turns a failed read into zero rows and
 * then prints the zero as a statement. For an email that would mean telling a customer **"Nothing is
 * due this month"** on a month when we simply could not read their dates — a false statement about
 * their own compliance, sent to their inbox, with nothing on any screen to contradict it.
 *
 * So this suite does not only check the words. It makes the database fail and asserts that no email
 * is rendered, that the failure is thrown so the job can record it, and that the reassuring sentence
 * never appears.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  monthlyDates, companyLogins, renderMonthlyEmail, notifyMonth,
} from '../../lib/calendarNotify.ts'
import { emailFrom, RESEND_TEST_SENDER } from '../../lib/emailSender.ts'

type Row = Record<string, unknown>

/**
 * A stand-in database. `fail` names the table whose read breaks, so one test can fail exactly one
 * read and see what the code does with it — which is the only way to tell "handled" from "happens to
 * return nothing".
 */
function fakeDb(rows: Row[], opts: { fail?: string; logins?: string[]; company?: Row | null } = {}) {
  const company = opts.company === undefined ? { name: 'Cascade Specialty Chemicals' } : opts.company
  const err = (t: string) => opts.fail === t ? { message: `permission denied for ${t}` } : null
  const build = (table: string) => {
    let out = rows.slice()
    let head = false
    const api: Record<string, unknown> = {}
    const self = () => api as never
    Object.assign(api, {
      select: (_c?: string, o?: { head?: boolean }) => { head = !!o?.head; return self() },
      eq: (f: string, v: unknown) => { out = out.filter((r) => r[f] === v || f === 'company_id'); return self() },
      neq: (f: string, v: unknown) => { out = out.filter((r) => r[f] !== v); return self() },
      gte: (f: string, v: string) => { out = out.filter((r) => String(r[f]) >= v); return self() },
      lte: (f: string, v: string) => { out = out.filter((r) => String(r[f]) <= v); return self() },
      lt: (f: string, v: string) => { out = out.filter((r) => String(r[f]) < v); return self() },
      order: () => self(),
      maybeSingle: async () => ({ data: table === 'companies' ? company : out[0] ?? null, error: err(table) }),
      then: (res: (v: unknown) => unknown) => res(
        table === 'profiles'
          ? { data: (opts.logins ?? ['owner@example.com']).map((_, i) => ({ id: `u${i}` })), error: err('profiles') }
          : { data: head ? null : out, count: out.length, error: err(table) }),
    })
    return api
  }
  return {
    from: (t: string) => build(t),
    auth: { admin: {
      getUserById: async (id: string) => {
        const list = opts.logins ?? ['owner@example.com']
        return { data: { user: { email: list[Number(id.slice(1))] } }, error: null }
      },
    } },
  } as never
}

// `counts_as_due` is on every row because it is on the real table: migration 073's generated column
// is what the email filters by, so a fixture without it would be testing a different query.
const DATES = [
  { title: 'Permit expires', due_date: '2026-11-15', state: 'confirmed', counts_as_due: true },
  { title: 'Annual report to DEQ', due_date: '2026-11-28', state: 'not_confirmed', counts_as_due: true },
  { title: 'Fire extinguisher service', due_date: '2026-09-30', state: 'confirmed', counts_as_due: true },
  // Not on the board: no day yet. It must appear in `waiting` and in neither list.
  { title: 'Report items marked N', due_date: null, state: 'not_confirmed', counts_as_due: false },
]

describe('what the month holds', () => {
  test('due this month, passed, and waiting are three different questions', async () => {
    const d = await monthlyDates(fakeDb(DATES), 'co-1', '2026-11-01')
    assert.deepEqual(d.due.map((x) => x.title), ['Permit expires', 'Annual report to DEQ'])
    assert.deepEqual(d.passed.map((x) => x.title), ['Fire extinguisher service'])
    assert.equal(typeof d.waiting, 'number')
  })

  test('a date that has passed is not also listed as due', async () => {
    const d = await monthlyDates(fakeDb(DATES), 'co-1', '2026-11-01')
    const twice = d.due.filter((x) => d.passed.some((p) => p.title === x.title))
    assert.deepEqual(twice, [])
  })
})

describe('board 12\'s words', () => {
  const render = (dates: Parameters<typeof renderMonthlyEmail>[0]['dates']) =>
    renderMonthlyEmail({
      companyName: 'Cascade Specialty Chemicals', asOf: '2026-11-01', dates,
      appUrl: 'https://compliboard.vercel.app',
    })

  test('the order is: due, passed, waiting — then one link per section', () => {
    const { text } = render({
      due: [{ title: 'Permit expires', due_date: '2026-11-15', state: 'confirmed' }],
      passed: [{ title: 'Fire extinguisher service', due_date: '2026-09-30' }],
      waiting: 4,
    })
    const at = (s: string) => text.indexOf(s)
    assert.ok(at('Due this month') < at('Passed and not done'))
    assert.ok(at('Passed and not done') < at('not yet confirmed'))
    assert.ok(at('not yet confirmed') < at('Confirm them:'))
    // ONE LINK PER SECTION, not one per date: in plain text a link after every line is a wall.
    assert.equal((text.match(/https:\/\//g) ?? []).length, 2)
  })

  test('a not-confirmed date says so, beside its day', () => {
    const { text } = render({
      due: [{ title: 'Annual report to DEQ', due_date: '2026-11-28', state: 'not_confirmed' }],
      passed: [], waiting: 1,
    })
    assert.match(text, /28 November 2026 — Annual report to DEQ {2}\(not confirmed\)/)
  })

  test('the subject counts what needs a person, and names the month', () => {
    assert.match(render({ due: [{ title: 'a', due_date: '2026-11-15', state: 'confirmed' }],
      passed: [{ title: 'b', due_date: '2026-09-01' }], waiting: 0 }).subject,
      /Your compliance dates for November 2026: 2 to look at/)
    assert.equal(render({ due: [], passed: [], waiting: 3 }).subject,
      'Your compliance dates for November 2026')
  })

  test('*** BOARD 12\'s LAST LINE IS ABSENT UNTIL THE SWITCH EXISTS ***', () => {
    // "You can turn it off in My Account" — there is no such switch, and telling somebody to turn
    // something off somewhere they cannot is worse than saying nothing (§5.1). The line and the
    // switch go in together; My Account's section is next.
    const { text } = render({ due: [{ title: 'a', due_date: '2026-11-15', state: 'confirmed' }], passed: [], waiting: 0 })
    assert.ok(!/turn it off/i.test(text))
    assert.ok(!/My Account/i.test(text))
  })

  test('no price, and never the word "compliant"', () => {
    const { text, subject } = render({
      due: [{ title: 'a', due_date: '2026-11-15', state: 'confirmed' }],
      passed: [{ title: 'b', due_date: '2026-09-01' }], waiting: 2,
    })
    for (const s of [text, subject]) {
      assert.ok(!/\$|compliant/i.test(s), s)
    }
  })

  test('the staging line says where it would really have gone', () => {
    const { text } = renderMonthlyEmail({
      companyName: 'Cascade', asOf: '2026-11-01',
      dates: { due: [{ title: 'a', due_date: '2026-11-15', state: 'confirmed' }], passed: [], waiting: 0 },
      appUrl: 'https://x', realTo: ['owner@example.com'], override: 'me@example.com',
    })
    assert.match(text, /\[staging: this would have gone to owner@example\.com\]/)
  })
})

describe('when nothing is sent', () => {
  test('nothing due, nothing passed, nothing waiting — NO EMAIL (decision 11)', async () => {
    const r = await notifyMonth(fakeDb([]), 'co-1', { asOf: '2026-11-01', dryRun: true })
    assert.equal(r.notified, false)
    assert.equal(r.reason, 'nothing to say')
    assert.equal(r.subject, undefined)
  })

  test('a company with no logins is not an error, and sends nothing', async () => {
    const r = await notifyMonth(fakeDb(DATES, { logins: [] }), 'co-1', { asOf: '2026-11-01', dryRun: true })
    assert.equal(r.notified, false)
    assert.equal(r.reason, 'no logins')
  })
})

describe('*** R2 AND R3: A READ THAT FAILS SENDS NOTHING ***', () => {
  // The whole point of the suite. Each read is failed in turn, and in every case the failure is
  // THROWN — so the job records it against `job_runs.errors` and that company gets no email — rather
  // than coming back as zero rows and being printed as "Nothing is due this month."
  for (const table of ['calendar_events', 'profiles', 'companies']) {
    test(`a failed read of ${table} throws, so no email is built`, async () => {
      await assert.rejects(
        () => notifyMonth(fakeDb(DATES, { fail: table }), 'co-1', { asOf: '2026-11-01', dryRun: true }),
        /could not be read|could not be counted/,
        `a failed ${table} read did not throw`,
      )
    })
  }

  test('THE SENTENCE THAT MUST NEVER BE SENT ON A FAILED READ', async () => {
    // "Nothing is due this month" is a statement about a customer's compliance. It may be made only
    // from a read that SUCCEEDED and returned nothing.
    let text: string | undefined
    try {
      const r = await notifyMonth(fakeDb(DATES, { fail: 'calendar_events' }), 'co-1',
        { asOf: '2026-11-01', dryRun: true })
      text = r.text
    } catch { /* the expected path */ }
    assert.equal(text, undefined, 'an email was rendered from a failed read')
  })

  test('...and it IS said when the read succeeded and found nothing', async () => {
    // The other half, or a test that only ever sees a refusal cannot tell a working rule from a
    // broken one. `waiting` is what keeps this email from being pointless.
    const { text } = renderMonthlyEmail({
      companyName: 'Cascade', asOf: '2026-11-01',
      dates: { due: [], passed: [], waiting: 3 }, appUrl: 'https://x',
    })
    assert.match(text, /Nothing is due this month\./)
  })

  test('monthlyDates and companyLogins each name the read that failed', async () => {
    await assert.rejects(() => monthlyDates(fakeDb([], { fail: 'calendar_events' }), 'co-1', '2026-11-01'),
      /dates due this month could not be read/)
    await assert.rejects(() => companyLogins(fakeDb([], { fail: 'profiles' }), 'co-1'),
      /logins could not be read/)
  })

  test('a client that cannot read auth.users says so rather than emailing nobody', async () => {
    const noAdmin = { ...(fakeDb(DATES) as unknown as Record<string, unknown>), auth: {} } as never
    await assert.rejects(() => companyLogins(noAdmin, 'co-1'), /cannot read auth\.users/)
  })
})

describe('one sender for every email (decision 22)', () => {
  test('with EMAIL_FROM unset, nothing changes — the address is the one used before', () => {
    const was = process.env.EMAIL_FROM
    delete process.env.EMAIL_FROM
    assert.equal(emailFrom(), RESEND_TEST_SENDER)
    assert.equal(emailFrom(), 'CompliBoard <onboarding@resend.dev>')
    process.env.EMAIL_FROM = '   '
    assert.equal(emailFrom(), RESEND_TEST_SENDER, 'a blank value must behave as unset')
    process.env.EMAIL_FROM = 'CompliBoard <hello@compliboard.com>'
    assert.equal(emailFrom(), 'CompliBoard <hello@compliboard.com>')
    if (was === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = was
  })

  test('all four senders import it, and none holds the literal any more', async () => {
    const fs = await import('node:fs')
    for (const f of ['lib/auditNotify.ts', 'lib/handbookCheckNotify.ts', 'lib/documentBatch.ts',
                     'app/api/feedback/route.ts']) {
      const src = fs.readFileSync(f, 'utf8')
      assert.match(src, /from: emailFrom\(\)/, f)
      assert.ok(!/onboarding@resend\.dev/.test(src), `${f} still holds the address`)
    }
  })
})

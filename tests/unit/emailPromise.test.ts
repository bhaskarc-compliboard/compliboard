/**
 * WHAT THE PRODUCT MAY PROMISE — `lib/emailPromise.ts`, `/api/promise`, Calendar B4.
 *
 * *** THE TEST THAT MATTERS IS THAT THE GATE CAN OPEN. ***
 * Job B first wrote this as a function the client page called, and the owner caught that it could
 * never say yes: `canReachCustomers()` reads `EMAIL_FROM`, and Next does not put that in the browser
 * bundle. The sentence promising the monthly email would have stayed hidden after the domain was
 * verified, silently, for ever. A gate only ever exercised in its "no" state is a gate nobody has
 * shown can say yes — `docs/HOW-WE-BUILD.md` §3 — so all four states are asserted here, on the
 * server, where the answer is now computed.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { monthlyEmailPromised, MY_ACCOUNT_OFF_SWITCH_EXISTS } from '../../lib/emailPromise.ts'

describe('the monthly email may be promised only when it can reach somebody', () => {
  test('all four states', () => {
    assert.equal(monthlyEmailPromised({ switchExists: false, canReach: false }), false)
    assert.equal(monthlyEmailPromised({ switchExists: false, canReach: true }), false,
      'the domain alone is not enough: an unasked-for email with no off switch is what gets marked spam')
    assert.equal(monthlyEmailPromised({ switchExists: true, canReach: false }), false,
      'the switch alone is not enough: the email still reaches nobody but our own inbox')
    assert.equal(monthlyEmailPromised({ switchExists: true, canReach: true }), true,
      '*** THE GATE MUST BE ABLE TO OPEN ***')
  })

  test('today it is shut, and the switch is why', () => {
    assert.equal(MY_ACCOUNT_OFF_SWITCH_EXISTS, false)
    assert.equal(monthlyEmailPromised(), false)
  })

  test('it short-circuits on the constant, so it never reads EMAIL_FROM while the switch is missing', () => {
    // That is what makes the same function safe to import anywhere. With the switch absent the
    // environment is not consulted at all, so a stale or missing EMAIL_FROM cannot change the answer.
    const was = process.env.EMAIL_FROM
    process.env.EMAIL_FROM = 'CompliBoard <hello@compliboard.com>'
    assert.equal(monthlyEmailPromised(), false)
    if (was === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = was
  })

  test('the ANSWER IS COMPUTED ON THE SERVER and handed to the browser', async () => {
    const fs = await import('node:fs')
    // The route exists and returns the server's answer...
    const route = fs.readFileSync('app/api/promise/route.ts', 'utf8')
    assert.match(route, /monthlyEmail: monthlyEmailPromised\(\)/)
    // ...the hook asks for it and defaults to NOT promising...
    const hook = fs.readFileSync('lib/usePromise.ts', 'utf8')
    assert.match(hook, /useState\(false\)/)
    assert.match(hook, /fetch\('\/api\/promise'\)/)
    assert.match(hook, /\.catch\(/)
    // ...and no client page calls the server function directly, which was the bug.
    for (const f of ['app/calendar/page.tsx']) {
      const src = fs.readFileSync(f, 'utf8')
      assert.ok(!/monthlyEmailPromised\(\)/.test(src), `${f} calls the server gate in client code`)
      assert.match(src, /useMonthlyEmailPromised\(\)/)
    }
  })
})

/**
 * EVERY SENTENCE THAT PROMISES THE MONTHLY EMAIL IS BEHIND THE GATE — decision 21, B4.
 *
 * The owner's instruction was *"Do not hold them by hand"*: the true words go in now, and the ones
 * that promise the email appear by themselves when it can be sent. So the thing to test is not the
 * wording — it is that no page states the promise unconditionally.
 */
describe('decision 21: the promise words', () => {
  const read = (f: string) => readFileSync(f, 'utf8')

  test('all three pages ask the server, and none of them promises unconditionally', () => {
    for (const f of ['app/calendar/page.tsx', 'app/page.tsx', 'app/account/page.tsx']) {
      const src = read(f)
      assert.match(src, /useMonthlyEmailPromised\(\)/, `${f} does not ask`)
      // Every mention of the monthly email sits inside a conditional on the gate's answer.
      // COMMENTS COME OUT FIRST, whole: the per-line "starts with * or //" test missed the middle
      // lines of a block comment, and failed on a paragraph explaining this very gate.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const line of code.split('\n')) {
        if (!/monthly email|1st of each month|month with what is due/i.test(line)) continue
        assert.match(line, /promised|emailPromised/,
          `${f} promises the monthly email outside the gate:\n    ${line.trim()}`)
      }
    }
  })

  test('the promises rev 1 cannot keep are gone', () => {
    const home = read('app/page.tsx').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const gone of [
      /Never miss a renewal/, /Never pay a late fee/,
      /alerted before (?:anything|every)/i, /Automatic date extraction/,
      /appears on your compliance calendar automatically/,
    ]) assert.ok(!gone.test(home), `the landing page still says ${gone}`)
    const account = read('app/account/page.tsx').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.ok(!/'Deadline reminders'/.test(account))
    const cal = read('app/calendar/page.tsx').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.ok(!/you never miss a deadline again/i.test(cal))
    assert.ok(!/automatically/i.test(cal), 'the calendar page still says a date is added automatically')
  })
})

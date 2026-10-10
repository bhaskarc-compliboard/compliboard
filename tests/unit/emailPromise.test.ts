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

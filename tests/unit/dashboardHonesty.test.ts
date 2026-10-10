/**
 * THE DASHBOARD NEVER SHOWS A CONFIDENT ZERO — fix list 34 (B1), 35 (B2) and 8 (B3), closed in
 * Calendar B3. `docs/FIX-LIST-FAILURES.md` roots R2 and R3, `CLAUDE.md` §3.12 and §5.1.
 *
 * *** THESE ARE SOURCE ASSERTIONS, AND THAT IS A DELIBERATE SECOND-BEST. *** What they really pin is
 * a rendering, and the honest way to check a rendering is to break the read and look — which
 * `docs/TEST-AT-FINISH-LINE.md` does, by hand, with the server stopped. What a test CAN hold on to
 * every run is that the guard is still in the file: all three of these were written correctly once
 * and lost to a later edit that had nothing to do with them, which is the failure mode a test
 * catches and a manual pass does not.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const raw = readFileSync('app/dashboard/page.tsx', 'utf8')

/**
 * *** THE CODE, WITHOUT ITS COMMENTS. ***
 * The first run of this file failed four times, and every failure was a comment of its own: the
 * paragraphs explaining each fix quote the wording and the expression they replaced, so a test
 * reading the raw file found "overdue", "No deadlines in the next 30 days" and
 * `display_status !== 'could_not_read'` still present and said the fixes had not been made.
 * That is the right answer to the wrong question. A comment is not shipped to anybody, and a rule
 * about what the product SAYS is a rule about its strings — so the comments come out first, which
 * also keeps the explanations free to quote the thing they are warning about.
 */
const page = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('the dashboard says what it could not read', () => {
  test('34 (B1): the calendar read checks its status', () => {
    assert.match(page, /if \(!cRes\.ok\) throw new Error/,
      'a 500, an expired session or a 404 would again read as "no deadlines"')
    assert.match(page, /if \(!Array\.isArray\(cJson\?\.dates\)\)/,
      'a body in the wrong shape must not come out as an empty calendar')
    assert.ok(!/No deadlines in the next 30 days/.test(page),
      'the sentence that stated a clear calendar on a failed read is gone')
  })

  test('35 (B2): a failed read is never a zero, a blank name or an empty list', () => {
    assert.match(page, /broke\.documents \? '—' : box\.value/, 'the four counters')
    assert.match(page, /broke\.profile \? 'Your company' : ''/, 'the company name')
    assert.match(page, /\{broke\.documents \? \(/, 'the readings list is guarded before its empty state')
    // Each of the three reads must actually SET the flag, or the guards above are decoration.
    for (const what of ['profile', 'dates', 'documents']) {
      assert.match(page, new RegExp(`setBroke\\(b => \\(\\{ \\.\\.\\.b, ${what}: true \\}\\)\\)`),
        `nothing sets broke.${what}`)
    }
    assert.match(page, /if \(readRes\.error\) throw/, 'a PostgREST error must not pass as no rows (R2)')
    assert.match(page, /if \(checklistsRes\.error\) throw/)
  })

  test('8 (B3): "Files reviewed" counts documents we have ever got a reading out of', () => {
    assert.match(page, /filesReviewed: all\.filter\(r => r\.readable_scan_id !== null\)\.length/)
    assert.ok(!/display_status !== 'could_not_read'/.test(page),
      'one rate-limited re-read would again drop a well-read document out of the count')
    assert.match(page, /readable_scan_id'\)/, 'the column has to be selected or it is undefined for every row')
  })

  test('the dates come from the calendar\'s own route, and days from the one helper', () => {
    assert.match(page, /\/api\/calendar\/dates\?view=board/)
    assert.match(page, /from '@\/lib\/calendarDate'/)
    assert.ok(!/new Date\(e\.due_date\)/.test(page),
      'parsing a day as UTC midnight is the off-by-one the map recorded as B2')
  })

  test('§185c: nothing on the dashboard calls a passed date overdue', () => {
    for (const word of [/\boverdue\b/i, /\bnot done\b/i]) {
      assert.ok(!word.test(page), `the dashboard says ${word}`)
    }
    // The words are split by a JSX ternary — `{n === 1 ? 'has' : 'have'} passed.` — so the phrase
    // is matched the way it is written, not the way it reads on screen. (The first version of this
    // line looked for "have passed" and failed on code that says exactly that.)
    assert.match(page, /'has' : 'have'\} passed/)
    assert.match(page, /A gentle reminder in case any of them still need attention/)
  })
})

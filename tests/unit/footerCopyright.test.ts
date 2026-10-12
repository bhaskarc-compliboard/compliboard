/**
 * *** THE COPYRIGHT LINE IS ON THE SCREEN AS WELL AS ON PAPER *** — E10, N8.
 *
 * Job E's 35c marked the footer's links `no-print` ("Privacy Policy · Terms of Service · Contact" at
 * the foot of a printed audit is website furniture on a compliance record) and added a `print-only`
 * copyright under the disclaimer. Its own comment says the line is "drawn twice rather than moved:
 * the two layouts want it in two places" — but only the printed copy was written. The on-screen
 * `© 2026 CompliBoard LLC` was deleted from every signed-in page in the product, because `AppLayout`
 * is the shell all of them render inside.
 *
 * The independent read found it by reading the diff (`docs/reports/jobE-independent-review.md` §1
 * N8). It is one line of text and no behaviour, which is exactly why no test and no check noticed.
 *
 * So the rule is held here, by counting both copies: the screen's and the paper's.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync('components/AppLayout.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

/** Every rendering of the line, with whatever classes its element carries. */
const copies = [...shell.matchAll(/<p className="([^"]*)"[^>]*>\s*© 2026 CompliBoard LLC\s*<\/p>/g)]
  .map((m) => m[1])

describe('*** N8: the footer\'s copyright, on screen and on paper ***', () => {
  test('the line is drawn twice, as the comment beside it says', () => {
    assert.equal(copies.length, 2,
      'AppLayout must render `© 2026 CompliBoard LLC` twice: once for the screen and once for print. '
      + `Found ${copies.length}: ${JSON.stringify(copies)}`)
  })

  test('one copy prints and is hidden on screen', () => {
    assert.equal(copies.filter((c) => /\bprint-only\b/.test(c)).length, 1)
    assert.match(css, /\.print-only \{ display: none; \}/)
    assert.match(css, /\.print-only \{ display: inline !important; \}/)
  })

  test('the other is on screen and does NOT print', () => {
    const onScreen = copies.filter((c) => !/\bprint-only\b/.test(c))
    assert.equal(onScreen.length, 1, 'the on-screen copy is missing — every page lost its copyright line.')
    assert.match(onScreen[0], /\bno-print\b/,
      'the on-screen copy must be `no-print`, or the line appears twice on paper.')
  })

  test('and the disclaimer above it still prints — the one line that matters most on paper', () => {
    const para = shell.match(/<p className="([^"]*)"[^>]*>\s*<span className="text-gray-500">CompliBoard reads your documents/)
    assert.ok(para, 'the disclaimer paragraph was not found')
    assert.ok(!/\bno-print\b/.test(para[1]), 'the disclaimer must not be marked no-print (35c, Job E4).')
  })
})

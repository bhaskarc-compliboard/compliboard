/**
 * THE WORKSPACE'S SHARED DISPLAY PIECES — HR Step 3a (`docs/HR-PLAN.md` decision 1).
 *
 * Only the two pieces with logic are tested here: the stage words, and the summary report's source
 * shape. The rest are markup, and they are held by measurement (`docs/TESTING.md`, "the workspace
 * looks the same"), not by assertions about class strings.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stageWords } from '../../components/stageWords.ts'

describe('the stages say what is true, in board 3\'s words', () => {
  test('each step has its own words, and only "read" names the file', () => {
    assert.equal(stageWords('save', 'plan.pdf'), 'Saving the file')
    assert.equal(stageWords('read', 'plan.pdf'), 'Reading plan.pdf')
    assert.equal(stageWords('check', 'plan.pdf'), 'Checking it against your question')
    assert.equal(stageWords('write', 'plan.pdf'), 'Writing the answer')
  })
})

describe('the summary report draws every source through its source shape', () => {
  const view = readFileSync('components/ReportView.tsx', 'utf8')
  const body = view.slice(view.indexOf('export function ReportView<'))
  test('a Sources entry comes from the shape — never from a field of the source', () => {
    // E2f: the Sources list is the only place a source is drawn, and `sourceEntry` is the one
    // function that draws it — the section's own shape, or the host's swap for a source of ours.
    assert.match(body, /\{sourceEntry\(src\)\}/)
    assert.match(body, /if \(!onOpenSource \|\| t\.kind === 'web'\) return sourceShape\.entry\(src\)/)
    /**
     * *** AND THE ONE EXCEPTION E2 ADDED, WHICH IS NOT A FIELD OF A WEB SOURCE (decision 63). ***
     * A source that points INSIDE the product — `/documents?document=…` or `/audits?run=…` — is
     * drawn by this file as a button, so the host can swap the drawer for that document's reading.
     * It reads `title` only there, and only after `sourceTarget` has said the source is ours; a
     * handbook passage, which has no url and no web title, never reaches that branch. Everything
     * else still goes through the section's own shape, untouched.
     */
    assert.ok(!/src\.url\b/.test(body), 'ReportView itself must not read src.url')
    const ours = body.slice(body.indexOf('const sourceEntry ='), body.indexOf('const item ='))
    assert.match(ours, /sourceTarget\(src as unknown as \{ url\?: string; href\?: string \}\)/)
  })
  test('the web shape draws a web page exactly as the workspace did: title + host', () => {
    const web = view.slice(view.indexOf('export const WEB_SOURCE'), view.indexOf('export function ReportView<'))
    // E2f: its `link` half — a source on an item's line — is gone, with the lines it drew.
    assert.ok(!web.includes('link:'))
    assert.match(web, /const shown = displaySource\(src\.title, src\.url\)/)
    assert.match(web, /\{shown\.title\}<\/a>\s*\{' '\}<span className="text-gray-400">\{shown\.host\}<\/span>/)
  })
  test('the workspace passes the web shape', () => {
    const page = readFileSync('app/compliance/page.tsx', 'utf8')
    // E2 added one prop after `sourceShape` (decision 63), so the element is no longer one line.
    assert.match(page, /<ReportView key=\{summaryDrawer\.id\} report=\{drawerReport\} factsLine=\{factsLine\} sourceShape=\{WEB_SOURCE\}/)
    assert.match(page, /onOpenSource=\{\(t\) => \{/)
  })
})

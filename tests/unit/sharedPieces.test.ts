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
  test('an item line and a Sources entry both come from the shape — never from a field of the source', () => {
    assert.match(body, /return src \? sourceShape\.link\(src\) : null/)
    assert.match(body, /\{sourceShape\.entry\(src\)\}/)
    // A handbook passage has no `url` and no `title` of a web page; the report must not reach for them.
    assert.ok(!/src\.(url|title)\b/.test(body), 'ReportView itself must not read src.url or src.title')
  })
  test('the web shape draws a web page exactly as the workspace did: a one-line link, and title + host', () => {
    const web = view.slice(view.indexOf('export const WEB_SOURCE'), view.indexOf('export function ReportView<'))
    assert.match(web, /link: \(src\) => <OneLineLink key=\{src\.n\} n=\{src\.n\} title=\{src\.title\} url=\{src\.url\} \/>/)
    assert.match(web, /const shown = displaySource\(src\.title, src\.url\)/)
    assert.match(web, /\{shown\.title\}<\/a>\s*\{' '\}<span className="text-gray-400">\{shown\.host\}<\/span>/)
  })
  test('the workspace passes the web shape', () => {
    const page = readFileSync('app/compliance/page.tsx', 'utf8')
    assert.match(page, /<ReportView key=\{summaryDrawer\.id\} report=\{drawerReport\} factsLine=\{factsLine\} sourceShape=\{WEB_SOURCE\} \/>/)
  })
})

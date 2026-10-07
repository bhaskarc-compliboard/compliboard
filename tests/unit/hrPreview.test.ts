/**
 * THE HR PREVIEW SWITCH AND THE HR PAGE SHELL — HR Step 4 (`docs/HR-PLAN.md` decision 32).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hrPreviewOn } from '../../lib/hrPreview.ts'
import { EXAMPLE_QUESTIONS, HR_EXAMPLE_QUESTIONS } from '../../config/examples.ts'

describe('HR_PREVIEW gates /hr/new, both ways', () => {
  test('exactly "1" turns it on; unset, empty, "0", "true" and " 1" do not', () => {
    assert.equal(hrPreviewOn({ HR_PREVIEW: '1' }), true)
    for (const v of [undefined, '', '0', 'true', ' 1', 'yes']) assert.equal(hrPreviewOn({ HR_PREVIEW: v }), false, String(v))
    assert.equal(hrPreviewOn({}), false)
  })
  test('the page reads it at request time and is a 404 without it', () => {
    const page = readFileSync('app/hr/new/page.tsx', 'utf8')
    assert.ok(!/^['"]use client['"]/m.test(page), 'the gate is a SERVER page')
    const body = page.slice(page.indexOf('export default async function'))
    assert.ok(body.indexOf('await connection()') >= 0 && body.indexOf('await connection()') < body.indexOf('hrPreviewOn()'),
      'connection() first, so the variable is read per request, not frozen at build')
    assert.match(body, /if \(!hrPreviewOn\(\)\) notFound\(\)/)
    assert.ok(body.indexOf('notFound()') < body.indexOf('<HrWorkspace />'), 'nothing renders before the check')
  })
  test('it is a server variable, never a public one', () => {
    const lib = readFileSync('lib/hrPreview.ts', 'utf8')
    assert.ok(!/NEXT_PUBLIC_HR_PREVIEW/.test(lib + readFileSync('app/hr/new/page.tsx', 'utf8') + readFileSync('app/hr/new/HrWorkspace.tsx', 'utf8')))
  })
  test('nothing links to /hr/new: the sidebar still points to old /hr', () => {
    const nav = readFileSync('components/AppLayout.tsx', 'utf8')
    assert.match(nav, /\{ label: 'HR Workspace', href: '\/hr' \}/)
    assert.ok(!nav.includes('/hr/new'))
  })
})

describe('the examples', () => {
  test("the workspace's EXAMPLE_QUESTIONS are unchanged", () => {
    assert.deepEqual(EXAMPLE_QUESTIONS.map((e) => e.question), [
      'We store acids and solvents at our plant. What do we need for safe storage?',
      "We're opening a cannabis dispensary in Oregon. What licenses do we need?",
      "Our hospice nurses drive to patients' homes. How do we pay for mileage?",
    ])
  })
  test("HR's three are the owner's words, written without \"e.g.\" (the page adds it)", () => {
    assert.deepEqual(HR_EXAMPLE_QUESTIONS.map((e) => e.question), [
      'An employee wants sick time to care for her grandmother. Do we allow it?',
      'What does our handbook say about the last paycheck when someone quits?',
      "Does our overtime policy match our state's rules?",
    ])
    for (const e of HR_EXAMPLE_QUESTIONS) assert.ok(!e.question.startsWith('e.g.'))
  })
})

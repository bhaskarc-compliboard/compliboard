/**
 * THE HR GO-LIVE — HR Step 13 (`docs/TEST-AT-FINISH-LINE.md` HR H). The preview switch (decision 32) is gone: the new
 * HR page is /hr for everyone, old HR is retired (decision 15), every HR route answers as the person (or the cron
 * secret) with no switch in front. These tests pin the live behaviour the switch's tests used to pin both ways.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { EXAMPLE_QUESTIONS, HR_EXAMPLE_QUESTIONS } from '../../config/examples.ts'
import { HR_PAGE_PATH } from '../../lib/handbookCheckNotify.ts'
import { checkingSections } from '../../lib/handbooks.ts'

const ROUTES = ['app/api/handbooks/route.ts', 'app/api/handbooks/read/route.ts', 'app/api/hr/answer/route.ts',
  'app/api/hr/handbooks/[id]/check/route.ts', 'app/api/hr/topics/[id]/summarise/route.ts']
const JOBS = ['app/api/jobs/handbook-checks/route.ts', 'app/api/jobs/handbook-queue/route.ts']

describe('the page is /hr, for everyone', () => {
  test('/hr renders the HR workspace with no gate; /hr/new is gone (no redirect)', () => {
    const page = readFileSync('app/hr/page.tsx', 'utf8')
    assert.match(page, /import HrWorkspace from '\.\/HrWorkspace'/)
    assert.match(page, /return <HrWorkspace \/>/)
    assert.ok(!/notFound|connection\(\)|hrPreview/.test(page))
    assert.ok(!existsSync('app/hr/new'), 'app/hr/new no longer exists')
  })
  test('the email\'s link opens /hr with the drawer; the sidebar marks /hr', () => {
    assert.equal(HR_PAGE_PATH, '/hr')
    assert.match(readFileSync('components/AppLayout.tsx', 'utf8'), /\{ label: 'HR Workspace', href: '\/hr' \}/)
  })
})

describe('the preview switch is gone, and old HR with it (decision 15)', () => {
  test('lib/hrPreview.ts and old HR\'s three files are deleted; the hr_audits table stays in account delete and export', () => {
    for (const f of ['lib/hrPreview.ts', 'app/api/hr/route.ts', 'app/api/hr-audits/route.ts', 'prompts/hr.ts']) assert.ok(!existsSync(f), f)
    assert.ok(readFileSync('app/api/account/route.ts', 'utf8').includes('hr_audits'))
    assert.ok(readFileSync('app/api/account/export/route.ts', 'utf8').includes('hr_audits'))
    assert.ok(readFileSync('app/requirements/page.tsx', 'utf8').includes('AIDisclaimer'), '/requirements still uses AIDisclaimer')
  })
  test('no HR route checks the switch: each starts with the person\'s session, each job with the cron secret', () => {
    for (const f of ROUTES) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!/hrPreview|HR_PREVIEW/.test(src), f)
      assert.match(src, /requireCompany\(request\)/, f)
    }
    for (const f of JOBS) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!/hrPreview|HR_PREVIEW/.test(src), f)
      const post = src.slice(src.indexOf('export async function POST'))
      assert.match(post.split('\n').slice(1, 4).join('\n'), /requireCronSecret\(request\)/, f + ': the secret first')
    }
  })
  test('the summary job picks workspace and HR conversations always', () => {
    const src = readFileSync('app/api/jobs/summarise/route.ts', 'utf8')
    assert.match(src, /const sections = \['workspace', 'hr'\]/)
    assert.ok(!/hrPreview/.test(src))
  })
})

describe('one fix (owner, after the Opus run): "Checking 0 of 1 sections…"', () => {
  test('the singular where the count is 1, with the page\'s own counted(); the drawer uses it', () => {
    assert.equal(checkingSections(0, 1), 'Checking 0 of 1 section…')
    assert.equal(checkingSections(3, 12), 'Checking 3 of 12 sections…')
    assert.match(readFileSync('lib/handbooks.ts', 'utf8'), /checkingSections = \(done: number, total: number\) => `Checking \$\{done\} of \$\{counted\(total, 'section'\)\}…`/)
    assert.match(readFileSync('app/hr/HrWorkspace.tsx', 'utf8'), /\{checkingSections\(open\.done, open\.total\)\}/)
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

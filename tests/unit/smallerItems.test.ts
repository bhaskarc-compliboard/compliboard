/**
 * *** §4 OF THE INDEPENDENT READ: THE WRONG WORDS AND THE SMALLER ITEMS *** — E10, Part 5.
 *
 * Thirteen separate things, each small and each visible to a customer
 * (`docs/reports/jobE-independent-review.md` §4). Three were left alone on the owner's instruction
 * and are listed in E10's report: E6 wording 3 (he is redrafting it), 079 and the audit input (his
 * call, later), and the three reads in `app/api/account/route.ts` (they belong to My Account).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { wayForwardFor, FILE_GONE, STORAGE_UNREACHABLE, STORAGE_UNREACHABLE_FINAL } from '../../lib/storageMiss.ts'
import { inUseNote, handbookList, IN_USE_WHILE_READING, type HandbookRow } from '../../lib/handbooks.ts'
import { mergeSummary, patchIsEmpty } from '../../lib/auditSummary.ts'

const strip = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('*** the way forward matches the failure (§4, first item) ***', () => {
  test('"we could not fetch the stored file" asks for the file, not for another press', () => {
    assert.equal(wayForwardFor(FILE_GONE.reason), 'Upload it again — the record is here but the file is not.')
    // The sentence it replaces would have been exactly wrong here: the record is there and the file
    // is not, so Read it again cannot work however many times it is pressed.
    assert.match(readFileSync('components/DocumentReport.tsx', 'utf8'),
      /wayForwardFor\(row\.could_not_read_reason\)/)
  })

  test('a storage failure we are still retrying says so; one we have stopped retrying asks for the press', () => {
    assert.match(wayForwardFor(STORAGE_UNREACHABLE.reason)!, /We will try it again on our next pass/)
    assert.equal(wayForwardFor(STORAGE_UNREACHABLE_FINAL.reason), 'Press Read it again in a little while.')
  })

  test('a reason we do not recognise gets no invented advice', () => {
    assert.equal(wayForwardFor('Something nobody has seen before'), null)
    assert.equal(wayForwardFor(null), null)
    assert.equal(wayForwardFor(''), null)
  })
})

describe('*** the retry email no longer claims to replace one that never went (§4) ***', () => {
  test('the sentence needs BOTH a retried part and an email that actually went', () => {
    assert.match(strip('lib/auditNotify.ts'), /if \(summary\.retried_parts && summary\.emailed_before\) \{/)
  })

  test('the retry reads notified_at BEFORE clearing it, and states the fact', () => {
    const retry = strip('app/api/audit-runs/[id]/sections/[sid]/retry/route.ts')
    assert.ok(retry.indexOf("select('notified_at')") < retry.indexOf('notified_at: null'))
    assert.match(retry, /set: \{ emailed_before: true \}/)
  })

  test('the patch can STATE a key, not only count or append one', () => {
    assert.deepEqual(mergeSummary({ note: 'keep me', retried_parts: 1 },
      { add: { retried_parts: 1 }, set: { emailed_before: true } }),
      { note: 'keep me', retried_parts: 2, emailed_before: true })
    // A key named in both ends as the thing it was STATED to be.
    assert.deepEqual(mergeSummary({ x: 1 }, { add: { x: 5 }, set: { x: 9 } }), { x: 9 })
    assert.equal(patchIsEmpty({ set: { emailed_before: true } }), false)
    assert.equal(patchIsEmpty({ add: { a: 0 }, append: { b: [] } }), true)
  })
})

describe('*** one time zone on the audit report (§4) ***', () => {
  test('every date goes through the company\'s zone, not the reader\'s', () => {
    const rep = readFileSync('components/AuditReport.tsx', 'utf8')
    assert.match(rep, /const fmtIn = \(tz: string \| undefined\) => \(iso: string \| null \| undefined\) => formatMoment\(iso, tz\)/)
    assert.match(rep, /const fmt = fmtIn\(rep\.timezone\)/)
    // The old helper read the browser's zone by omission, which is how one audit could be dated
    // two different days by two readers.
    assert.ok(!/toLocaleDateString\('en-GB', \{ day: 'numeric', month: 'long', year: 'numeric' \}\)/.test(rep))
  })
})

describe('*** the handbook list (§4) ***', () => {
  const row = (id: string, o: Partial<HandbookRow> = {}): HandbookRow => ({
    id, name: id, file_name: `${id}.pdf`, file_path: `co/handbooks/${id}.pdf`,
    scope: 'company', entity_id: null, status: 'read', status_reason: null,
    version_of: null, is_current: true, created_at: `2026-10-0${id.slice(-1)}T00:00:00Z`, ...o,
  })

  test('a version that could not be read is never labelled "in use"', () => {
    const v1 = row('v1', { status: 'could_not_read', status_reason: 'a scan' })
    const v2 = row('v2', { version_of: 'v1', status: 'reading' })
    assert.equal(inUseNote(v1, [v1, v2]), null,
      'nothing could be read out of v1, so it is not the one answering questions')
    // And a READ row with a newer one being read still says so, which is what the note is for.
    const r1 = row('v1')
    assert.equal(inUseNote(r1, [r1, v2]), IN_USE_WHILE_READING)
  })

  test('a forked chain does not list the same older version twice', () => {
    // v1 and v3 are both current (H4's state after a failed read), and both chains reach v0.
    const v0 = row('v0', { is_current: false })
    const v1 = row('v1', { version_of: 'v0' })
    const v2 = row('v2', { version_of: 'v1', is_current: false, status: 'could_not_read' })
    const v3 = row('v3', { version_of: 'v2' })
    const all = [v0, v1, v2, v3]
    const ids = handbookList(all, []).flatMap((g) => g.rows.map((r) => r.id))
    assert.equal(new Set(ids).size, ids.length, `a row is listed twice: ${ids.join(', ')}`)
    assert.ok(ids.includes('v0'), 'and it is still listed once, so a person can see and delete it')
  })
})

describe('*** the smaller items that cost money or lock a person out (§4) ***', () => {
  test('a checklist re-run reuses the lines migration 059 stored', () => {
    const route = strip('app/api/audit-runs/route.ts')
    assert.match(route, /const storedLines = previousRun\?\.template_document_id === templateDocumentId/)
    assert.match(route, /\? \{ templateSections: storedLines \}/)
    // Only for the SAME checklist: a re-run against a different file is a different question.
    assert.match(route, /Array\.isArray\(previousRun\?\.template_lines\)/)
  })

  test('the sections read is paged, so the last agency of every run does not vanish at ~90 runs', () => {
    const index = strip('app/api/audits/index/route.ts')
    assert.match(index, /const PAGE = 500/)
    assert.match(index, /\.range\(from, from \+ PAGE - 1\)/)
    assert.match(index, /if \(page\.length < PAGE\) break/)
    // Ordered by run_id first, so each page is stable; re-sorted once for the rest of the route.
    assert.match(index, /\.order\('run_id'\)\.order\('ordinal'\)/)
  })

  test('an item with no checklist can be researched — `.eq("id", "")` is an invalid uuid', () => {
    assert.match(strip('app/api/checklist-items/[id]/how-to/route.ts'),
      /const listRes = item\.checklist_id/)
  })

  test('GET on the monthly email refuses a flag it does not honour (E9\'s X2)', () => {
    const route = strip('app/api/jobs/calendar-month/route.ts')
    assert.match(route, /const asked = \['dry', 'as_of'\]\.filter\(\(k\) => p\.has\(k\)\)/)
    assert.match(route, /this call did nothing/)
    // POST still honours both, which is where they belong.
    assert.match(route, /p\.get\('dry'\) === '1'/)
  })

  test('signup checks the industry against the library (E9\'s X3)', () => {
    const route = strip('app/api/signup/route.ts')
    assert.match(route, /mustRows<\{ industries: string\[\] \| null \}>\('the industries we cover'/)
    assert.match(route, /if \(!slugs\.has\(industrySlug\)\)/)
    // And it is read from the library, not from a list in code (§7: verticals are data).
    assert.ok(!/chemical-manufacturing/.test(route))
  })

  test('a batch email whose send failed is tried again (E9\'s 9b)', () => {
    const sweep = strip('app/api/jobs/scan-documents/route.ts')
    assert.match(sweep, /async function sendBatchEmail\(/)
    assert.match(sweep, /\.or\('status\.neq\.done,notified_at\.is\.null'\)/)
    // The claim is `notified_at` still being null, so two sweeps cannot both send.
    assert.equal((sweep.match(/\.eq\('id', batchId\)\.is\('notified_at', null\)/g) ?? []).length, 2)
  })
})

describe('*** and the five reads that fall through to a write (E9\'s X1) ***', () => {
  test('handbookSave: all three, so the scope and site are never written from a failed read', () => {
    const save = strip('lib/handbookSave.ts')
    assert.match(save, /mustRow<\{ id: string; version_of: string \| null; is_current: boolean \}>\('that handbook'/)
    assert.match(save, /mustRow<\{ id: string \}>\('the newer versions of that handbook'/)
    assert.match(save, /mustRow<\{ id: string; version_of: string \| null \}>\('the older versions of that handbook'/)
  })

  test('conversation: a failed read no longer renames the conversation', () => {
    const c = strip('lib/conversation.ts')
    assert.match(c, /const \{ data, error: readErr \} = await db\.from\('topics'\)\.select\('title'\)/)
    assert.match(c, /if \(readErr\) \{/)
  })

  test('calendarDates and the workspace: said, not swallowed', () => {
    assert.match(strip('lib/calendarDates.ts'), /const \{ data: freshened, error: freshErr \}/)
    assert.match(strip('app/compliance/page.tsx'), /const \{ data, error \} = await supabase\.from\('document_index_v'\)/)
  })

  test('the zip an inspector reads cannot say every document is gone', () => {
    const zip = strip('app/api/audit-runs/[id]/documents/route.ts')
    assert.match(zip, /mustRows\('the documents this audit read', docsRes\)/)
    assert.match(zip, /mustRows\('the titles of your documents', titledRes\)/)
  })
})

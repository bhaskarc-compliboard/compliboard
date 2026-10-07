/**
 * READING ONE HANDBOOK — `lib/handbookRead.ts`, HR Step 5b, with stand-ins for the parser and the model.
 * And THE HAIKU GUARD (`scripts/haiku.mjs`), which must refuse before a model call can be made.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readContent, readClaimFilter } from '../../lib/handbookRead.ts'
import { READ_REASONS, statusWords } from '../../lib/handbooks.ts'
import { CLAIM_LOCK_MS } from '../../lib/topicClaim.ts'

const empty = new ArrayBuffer(8)
const pdfOf = (pages: string[]) => async () => pages

describe('reading', () => {
  test('a PDF: the outline is given TEXT, sections are cut in code and know their pages', async () => {
    const pages = ['Handbook\n1 Welcome Employees are welcome here at the plant.', '2 Pay Employees are paid every second Friday by deposit.']
    const seen: string[] = []
    const r = await readContent(empty, 'h.pdf', 'application/pdf', async (text) => {
      seen.push(text)
      return [{ title: '1 Welcome', anchor: '1 Welcome Employees are welcome here' }, { title: '2 Pay', anchor: '2 Pay Employees are paid every' }]
    }, pdfOf(pages))
    assert.ok(r.ok)
    if (!r.ok) return
    assert.equal(seen.length, 1); assert.equal(seen[0], pages.join('\n'), 'the model is sent the text, not the file')
    assert.equal(r.pageCount, 2)
    assert.deepEqual(r.sections.map((s) => [s.title, s.page_from, s.page_to]), [['1 Welcome', 1, 1], ['2 Pay', 2, 2]])
  })
  test('a scan stops before any model call', async () => {
    let calls = 0
    const r = await readContent(empty, 'scan.pdf', 'application/pdf', async () => { calls++; return [] }, pdfOf(['', '  ']))
    assert.deepEqual(r.ok ? null : r.reason, READ_REASONS.scan)
    assert.equal(calls, 0)
  })
  test('no pages, and a kind of file we cannot read, each say so in the owner\'s words', async () => {
    const none = await readContent(empty, 'h.pdf', 'application/pdf', async () => [], pdfOf([]))
    assert.equal(none.ok ? null : none.reason, READ_REASONS.noPages)
    const txt = await readContent(new TextEncoder().encode('notes').buffer as ArrayBuffer, 'notes.txt', 'text/plain', async () => [])
    assert.equal(txt.ok ? null : txt.reason, READ_REASONS.kind)
    const doc = await readContent(empty, 'old.doc', 'application/msword', async () => [])
    assert.equal(doc.ok ? null : doc.reason, READ_REASONS.kind)
  })
  test('the words on the row', () => {
    assert.equal(statusWords('reading', null), 'Reading…')
    assert.equal(statusWords('read', null, 12), 'Read · 12 sections')
    assert.equal(statusWords('could_not_read', READ_REASONS.ours), `Could not read — ${READ_REASONS.ours}`)
  })
})

describe('the claim', () => {
  test('one reading at a time; a reading older than ten minutes may be claimed again', () => {
    const now = Date.parse('2026-10-07T12:00:00Z')
    const f = readClaimFilter(now)
    assert.match(f, /^status\.in\.\(uploaded,could_not_read\),/)
    assert.ok(f.includes(`and(status.eq.reading,updated_at.lt."${new Date(now - CLAIM_LOCK_MS).toISOString()}")`))
    assert.equal(CLAIM_LOCK_MS, 10 * 60_000)
  })
})

describe('THE HAIKU GUARD', () => {
  const run = (extra: Record<string, string>) => spawnSync(process.execPath, ['scripts/haiku.mjs', process.execPath, '-e', 'console.log("RAN")'],
    { env: { ...process.env, ...extra }, encoding: 'utf8' })
  test('refuses, and never starts the command, when one tier is not Haiku', () => {
    const r = run({ HAIKU_GUARD_TEST_OVERRIDE: 'AI_MODEL_HR_CHECK=claude-opus-5-5' })
    assert.equal(r.status, 1)
    assert.ok(!r.stdout.includes('RAN'))
    assert.match(r.stderr, /REFUSED — 1 tier\(s\) not on claude-haiku-4-5: hr_check=claude-opus-5-5/)
  })
  test('passes and starts the command when every tier is Haiku', () => {
    const r = run({})
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /tiers on claude-haiku-4-5[\s\S]*RAN/)
  })
})

describe('the one write', () => {
  /** Stand-ins for the person's client and the server key, recording every write. */
  function fakes(opts: { claimHeld: boolean }) {
    const log: string[] = []
    const chain = (result: unknown) => {
      const q: Record<string, unknown> = {}
      for (const m of ['eq', 'in', 'select']) q[m] = () => q
      q.maybeSingle = async () => result
      q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return q
    }
    const db = {
      from: () => ({
        select: () => chain({ data: { file_path: 'co/handbooks/h.pdf', file_name: 'h.pdf', mime_type: 'application/pdf' } }),
        update: (patch: Record<string, unknown>) => { log.push(`db.update status=${patch.status}`); return chain({ data: opts.claimHeld ? [{ id: 'h1' }] : [], error: null }) },
      }),
      storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array(8)]), error: null }) }) },
    }
    const admin = {
      from: () => ({
        delete: () => { log.push('admin.delete sections'); return chain({ error: null }) },
        insert: (rows: unknown[]) => { log.push(`admin.insert ${rows.length} sections`); return chain({ data: [{ id: 's1' }, { id: 's2' }], error: null }) },
      }),
    }
    return { log, db, admin }
  }
  const pages = async () => ['1 Welcome Employees are welcome here at the plant.', '2 Pay Employees are paid every second Friday by deposit.']
  const outline = async () => [{ title: '1 Welcome', anchor: '1 Welcome Employees are welcome here' }, { title: '2 Pay', anchor: '2 Pay Employees are paid every' }]
  test('sections first, then the row — saved as read only while the claim still holds', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.match(out, /^read: 2 pages, 2 sections/)
    assert.deepEqual(f.log, ['admin.delete sections', 'admin.insert 2 sections', 'db.update status=read'])
  })
  test('A RUN THAT LOST ITS CLAIM saves nothing, and takes its own sections back out', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.equal(out, 'claim lost')
    assert.deepEqual(f.log, ['admin.delete sections', 'admin.insert 2 sections', 'db.update status=read', 'admin.delete sections'])
  })
})

describe('"Read it again" (owner, 7 October)', async () => {
  const { readFileSync } = await import('node:fs')
  const route = readFileSync('app/api/handbooks/read/route.ts', 'utf8')
  const page = readFileSync('app/hr/new/HrWorkspace.tsx', 'utf8')
  test('the our-fault words point at the button', () => {
    assert.equal(READ_REASONS.ours, 'Something went wrong at our end while reading it. Press Read it again.')
  })
  test('the route: the preview switch before the session, 404 for another company, 409 for read, the SAME claim', () => {
    assert.ok(route.indexOf('hrPreviewOn()') < route.indexOf('requireCompany(request)'))
    assert.match(route, /row\.company_id !== companyId\) return NextResponse\.json\(\{ error: 'Handbook not found' \}, \{ status: 404 \}\)/)
    assert.match(route, /row\.status === 'read'\) return NextResponse\.json\(\{ error: 'Already read' \}, \{ status: 409 \}\)/)
    assert.match(route, /await startReading\(db, companyId, id\)/)
    assert.match(readFileSync('app/api/handbooks/route.ts', 'utf8'), /await startReading\(db, companyId, result\.json\.id\)/)
  })
  test('the button shows only for could_not_read or uploaded', () => {
    assert.match(page, /\(st === 'could_not_read' \|\| st === 'uploaded'\) && \(\s*<button onClick=\{\(\) => readAgain\(drawer\)\}[^>]*>Read it again<\/button>/)
  })
})

describe('counts in plain English, and every drawer follows its own status (owner, 7 October)', async () => {
  const { counted } = await import('../../lib/handbooks.ts')
  const { readFileSync } = await import('node:fs')
  test('1 section, 2 sections; 1 page, 120 pages — never "60+"', () => {
    assert.equal(counted(1, 'section'), '1 section'); assert.equal(counted(2, 'section'), '2 sections')
    assert.equal(counted(1, 'page'), '1 page'); assert.equal(counted(120, 'page'), '120 pages')
    assert.equal(statusWords('read', null, 1), 'Read · 1 section')
  })
  test('the drawer body reads the row\'s own status, not whether it is current', () => {
    const page = readFileSync('app/hr/new/HrWorkspace.tsx', 'utf8')
    const body = page.slice(page.indexOf('EVERY VERSION TELLS THE TRUTH'), page.indexOf('</Drawer>'))
    assert.match(body, /h\.status === 'could_not_read'[\s\S]*statusWords\(h\.status, h\.status_reason\)/)
    assert.ok(!body.includes('is_current'), 'the body never branches on current vs older')
    assert.ok(!/\$\{n\} sections|pages, `/.test(body.replace(/counted\([^)]*\)/g, '')), 'no hand-made plural left')
  })
})

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
    assert.equal(seen.length, 1); assert.equal(seen[0], pages.join('\f'), 'the model is sent the text (pages joined by a form feed), not the file')
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
  test('THE HANDBOOK SIZE ON HAIKU (owner, 8 October): set to 120,000 for the command, unless the command already sets it', () => {
    const size = (extra: Record<string, string>) => {
      const env: Record<string, string | undefined> = { ...process.env, ...extra }
      if (!('HR_HANDBOOK_BUDGET_TOKENS' in extra)) delete env.HR_HANDBOOK_BUDGET_TOKENS
      const r = spawnSync(process.execPath, ['scripts/haiku.mjs', process.execPath, '-e', 'console.log("SIZE=" + process.env.HR_HANDBOOK_BUDGET_TOKENS)'],
        { env: env as NodeJS.ProcessEnv, encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
      return r.stdout.match(/^SIZE=(\d+)$/m)?.[1]
    }
    assert.equal(size({}), '120000')
    assert.equal(size({ HR_HANDBOOK_BUDGET_TOKENS: '40000' }), '40000', 'a command that sets its own keeps it')
  })
})

describe('the one write', () => {
  /** Stand-ins for the person's client and the server key, recording every write. */
  function fakes(opts: { claimHeld: boolean; textClaimHeld?: boolean; versionOf?: string | null; retireFails?: boolean
                         clearFails?: boolean
                         /** E10, N6: the company's handbook rows, for the chain walk. */
                         chain?: Array<{ id: string; version_of: string | null; created_at: string }>
                         chainFails?: boolean }) {
    const log: string[] = []
    /** Which ids the retire step actually switched off — E10, N6: every OLDER version, not one. */
    const retired: string[] = []
    const chain = (result: unknown) => {
      const q: Record<string, unknown> = {}
      for (const m of ['eq', 'select']) q[m] = () => q
      q.in = (_col: string, ids: string[]) => { retired.push(...ids); return q }
      q.maybeSingle = async () => result
      q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return q
    }
    /** The chain the company holds: h1 over old1 over older0, unless a test says otherwise. */
    const chainRows = opts.chain ?? [
      { id: 'h1', version_of: opts.versionOf ?? null, created_at: '2026-10-03T09:00:00Z' },
      { id: 'old1', version_of: 'older0', created_at: '2026-10-02T09:00:00Z' },
      { id: 'older0', version_of: null, created_at: '2026-10-01T09:00:00Z' },
    ]
    const db = {
      from: () => ({
        // The columns decide which read this is: the row being read, or the chain around it (N6).
        select: (cols: string) => String(cols).includes('file_path')
          ? chain({ data: { file_path: 'co/handbooks/h.pdf', file_name: 'h.pdf',
                            mime_type: 'application/pdf', version_of: opts.versionOf ?? null } })
          : chain(opts.chainFails ? { data: null, error: { message: 'refused' } } : { data: chainRows, error: null }),
        update: (patch: Record<string, unknown>) => {
          if ('extracted_text' in patch && !('status' in patch)) {
            log.push(`db.update text (${String(patch.extracted_text).length} chars, ${patch.page_count} pages)`)
            return chain({ data: opts.textClaimHeld === false ? [] : [{ updated_at: 'T2' }], error: null })
          }
          if ('outline_parts_done' in patch && !('status' in patch)) {
            log.push(`db.update progress ${patch.outline_parts_done}/${patch.outline_parts_total}`)
            return chain({ data: [{ updated_at: 'T3' }], error: null })
          }
          // H4: retiring the version this one replaces — the one write that happens once the new file
          // has actually been read, and used to happen at upload instead.
          if ('is_current' in patch && !('status' in patch)) {
            log.push(`db.update is_current=${patch.is_current}`)
            return chain({ error: opts.retireFails ? { message: 'refused' } : null })
          }
          log.push(`db.update status=${patch.status}`)
          return chain({ data: opts.claimHeld ? [{ id: 'h1' }] : [], error: null })
        },
      }),
      storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array(8)]), error: null }) }) },
    }
    const admin = {
      from: () => ({
        delete: () => { log.push('admin.delete sections'); return chain({ error: opts.clearFails ? { message: 'permission denied' } : null }) },
        insert: (rows: unknown[]) => { log.push(`admin.insert ${rows.length} sections`); return chain({ data: [{ id: 's1' }, { id: 's2' }], error: null }) },
      }),
    }
    return { log, db, admin, retired }
  }
  const pages = async () => ['1 Welcome Employees are welcome here at the plant.', '2 Pay Employees are paid every second Friday by deposit.']
  const outline = async () => [{ title: '1 Welcome', anchor: '1 Welcome Employees are welcome here' }, { title: '2 Pay', anchor: '2 Pay Employees are paid every' }]
  test('sections first, then the row — saved as read only while the claim still holds', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.match(out, /^read: 2 pages, 2 sections/)
    assert.deepEqual(f.log, ['db.update text (107 chars, 2 pages)', 'db.update progress 0/1', 'db.update progress 1/1',
      'admin.delete sections', 'admin.insert 2 sections', 'db.update status=read'])
  })
  test('A RUN THAT LOST ITS CLAIM saves nothing, and takes its own sections back out', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.equal(out, 'claim lost')
    assert.deepEqual(f.log, ['db.update text (107 chars, 2 pages)', 'db.update progress 0/1', 'db.update progress 1/1',
      'admin.delete sections', 'admin.insert 2 sections', 'db.update status=read', 'admin.delete sections'])
  })
  // =========================================================================================
  // H4 (fix list, root R5, Job E) — THE VERSION THIS ONE REPLACES IS RETIRED HERE, NOT AT UPLOAD.
  //
  // `lib/handbookSave.ts` used to set the older version `is_current: false` in the upload request,
  // before the new file had been read. If that read failed, a company with one handbook was told
  // "None of your handbooks could be read" (answers use current versions only,
  // `lib/hrAnswer.ts:119`), the older version's open check was cancelled as replaced
  // (`lib/handbookCheck.ts:290`), and the nightly job checked neither (`:550`, current AND read).
  // =========================================================================================
  test('*** H4: a NEW VERSION retires the older one only once it has been read ***', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true, versionOf: 'old1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.match(out, /^read: 2 pages/)
    assert.equal(f.log.at(-1), 'db.update is_current=false', 'the older version is retired')
    assert.ok(f.log.indexOf('db.update status=read') < f.log.indexOf('db.update is_current=false'),
      'and AFTER the read landed, never before — that order is the whole of H4')
  })

  /**
   * *** E10, N6: EVERY OLDER VERSION IN THE CHAIN, NOT ONLY THE PARENT. ***
   *
   * The shipped line was `.eq('id', row.version_of)`. The commonest way that forks a chain for good:
   * v2 cannot be read, so v1 and v2 are both current (H4 working); the person adds v3 from v2's
   * drawer, which is the natural move; v3 retires v2 — and v1 stays current for ever, used for
   * answers and checked every night, with nothing on the page explaining it.
   */
  test('*** N6: a successful read retires every older version in its chain ***', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    // h1 replaces old1, which replaces older0. All three are one handbook.
    const f = fakes({ claimHeld: true, versionOf: 'old1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.match(out, /^read: 2 pages/)
    assert.deepEqual(f.retired, ['old1', 'older0'],
      'the parent AND its own older version. Retiring only the parent is what left v1 current for ever.')
    assert.ok(!f.retired.includes('h1'), 'the version just read is the current one')
  })

  test('N6: a chain read that fails leaves the older versions current and says so, and the reading stands', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true, versionOf: 'old1', chainFails: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.match(out, /^read: 2 pages/, 'the reading succeeded; this write is not what the caller asked for')
    assert.deepEqual(f.retired, [])
    // And `newestPerChain` is what keeps that state from being used twice
    // (`tests/unit/oneVersionPerChain.test.ts`).
  })

  test('N6: a chain of two retires one — the plain case is unchanged', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true, versionOf: 'old1',
      chain: [{ id: 'h1', version_of: 'old1', created_at: '2026-10-02T09:00:00Z' },
              { id: 'old1', version_of: null, created_at: '2026-10-01T09:00:00Z' }] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.deepEqual(f.retired, ['old1'])
  })

  test('H4: a reading that FAILED retires nothing, so the older version stays in use', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true, versionOf: 'old1' })
    // A scan: `readContent` refuses it before any model call, which is the ordinary way this fails.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b',
      outline, parsePdf: async () => ['', ''] }, 'co', 'h1', 'T')
    assert.match(out, /^could_not_read/)
    assert.ok(!f.log.some((l) => l === 'db.update is_current=false'),
      'nothing may retire the readable version on the strength of a reading that read nothing')
  })

  test('H4: a run that lost its claim retires nothing either', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: false, versionOf: 'old1' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.equal(out, 'claim lost')
    assert.ok(!f.log.some((l) => l === 'db.update is_current=false'))
  })

  test('H4: a first handbook (no version_of) retires nothing', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.ok(!f.log.some((l) => l.startsWith('db.update is_current')))
  })

  test('H4: if the retirement itself is refused, the READING still succeeded and both stay current', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true, versionOf: 'old1', retireFails: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.match(out, /^read: 2 pages/, 'the reading is the valuable thing and is not failed for this')
  })

  test('*** HR-dup: a refused delete of the earlier sections fails the reading ***', async () => {
    // It was unchecked, so the insert ran anyway and the handbook ended up with TWO sets of
    // sections — the model handed the whole handbook twice, the budget spent twice, and the page
    // saying a 14-part handbook has 28 parts.
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const f = fakes({ claimHeld: true, clearFails: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline, parsePdf: pages }, 'co', 'h1', 'T')
    assert.match(out, /^could_not_read/)
    assert.ok(!f.log.some((l) => l.startsWith('admin.insert')),
      'and nothing is inserted on top of the set that could not be cleared')
  })

  test('TEXT FIRST: the text is saved before the outline call; a claim lost there stops before any model call', async () => {
    const { readHandbook } = await import('../../lib/handbookRead.ts')
    const order: string[] = []
    const f = fakes({ claimHeld: true, textClaimHeld: false })
    const spy = async () => { order.push('outline'); return outline() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await readHandbook({ db: f.db as any, admin: f.admin as any, bucket: 'b', outline: spy, parsePdf: pages }, 'co', 'h1', 'T')
    assert.equal(out, 'claim lost')
    assert.deepEqual(order, [], 'no outline call')
    assert.deepEqual(f.log, ['db.update text (107 chars, 2 pages)'])
  })
})

describe('"Read it again" (owner, 7 October)', async () => {
  const { readFileSync } = await import('node:fs')
  const route = readFileSync('app/api/handbooks/read/route.ts', 'utf8')
  const page = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
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
    const page = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
    const at = page.indexOf('EVERY VERSION TELLS THE TRUTH')
    // The handbook drawer's own closing tag: the conversation drawer (Step 6b) closes earlier in the file.
    const body = page.slice(at, page.indexOf('</Drawer>', at))
    assert.ok(at > 0 && body.length > 200, 'the slice holds the handbook drawer body')
    assert.match(body, /h\.status === 'could_not_read'[\s\S]*statusWords\(h\.status, h\.status_reason\)/)
    // THE DRAWER'S ONE DELIBERATE DEPENDENCE ON WHETHER A VERSION IS CURRENT (owner, 8 October and Step 9): `older`,
    // read once, and used only to say "This is an older version. Only the current version is checked." — in place of the
    // read-again note and of "Not checked yet". Everything else in the body follows the version's own status.
    assert.equal(body.match(/is_current/g)?.length, 1, 'whether a version is current is read in exactly one place')
    assert.match(body, /const older = !h\.is_current/)
    assert.equal(body.match(/const older\b|\(older\b|: older \?/g)?.length, 3, 'declared once, used twice: both for OLDER_VERSION_NOTE')
    assert.equal(body.match(/OLDER_VERSION_NOTE/g)?.length, 2)
    assert.ok(!/\$\{n\} sections|pages, `/.test(body.replace(/counted\([^)]*\)/g, '')), 'no hand-made plural left')
  })
})

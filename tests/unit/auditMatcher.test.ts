/**
 * A1 and O1 — "AUDIT AGAIN", AND THE FOUR WAYS IT CLOSED A FINDING NOBODY SPOKE ABOUT.
 *
 * `docs/FIX-LIST-FAILURES.md` items 51 (A1, severity 1) and O1, root R5, Job E1. **Fixed together,
 * and never apart:** O1 is one dropped field in `app/api/audit-runs/route.ts` that kept the agency
 * re-audit from ever linking to the run before it, so A1's matcher never ran in the app. Fixing O1
 * alone would have switched all four of A1's faults on at once, for every re-audit.
 *
 * *** MADE TO FAIL ON THE OLD CODE FIRST. *** `oldMatcher` below is the shipped function, copied line
 * for line, and each of the four groups shows it closing a customer's open findings on a non-answer.
 * The fake database records every write, so what is closed is read off the writes rather than
 * described.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Imported one at a time, and `closeUnmatchedPrevious` dynamically: on the shipped `lib/auditRun.ts`
// that export does not exist, and a top-level import of it makes the whole file fail to load — which
// is true but tells you nothing about which behaviour changed.
import { matchAgainstPrevious } from '../../lib/auditRun.ts'
const closeUnmatchedPrevious = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any, sec: { run_id: string }, unmatched: string[],
) => (await import('../../lib/auditRun.ts')).closeUnmatchedPrevious(db, sec, unmatched)
import { ReadFailed } from '../../lib/mustRead.ts'

const SEC = { id: 'sec-1', run_id: 'run-2', company_id: 'co-1' }

/** The previous run's three still-open findings, as the model is shown them. */
const PREVIOUS = [
  { id: 'p1', shown: { handle: 'F1', title: 'No written hazard communication programme', word: 'nothing_on_file', kind: 'finding' } },
  { id: 'p2', shown: { handle: 'F2', title: 'Annual emissions report not on file', word: 'nothing_on_file', kind: 'finding' } },
  { id: 'p3', shown: { handle: 'F3', title: 'Scrubber log stops in March', word: 'stale', kind: 'finding' } },
]

/**
 * A stand-in client. `rows` is what the section's own findings read returns; `readFails` makes that
 * read error, which is A1's first fault. Every update is recorded.
 */
function fakeDb(opts: { rows?: Array<Record<string, unknown>>; readFails?: boolean; closeFails?: boolean } = {}) {
  const updates: Array<{ patch: Record<string, unknown>; ids: string[] }> = []
  const b = {
    pending: null as null | { patch: Record<string, unknown>; ids: string[] },
    select: () => b,
    eq: (k: string, v: unknown) => { if (b.pending && k === 'id') b.pending.ids = [String(v)]; return b },
    in: (_k: string, v: string[]) => { if (b.pending) b.pending.ids = v; return b },
    order: () => b,
    maybeSingle: () => b,
    update: (patch: Record<string, unknown>) => { b.pending = { patch, ids: [] }; return b },
    then: (ok: (v: unknown) => unknown) => {
      if (b.pending) {
        const done = b.pending
        b.pending = null
        updates.push(done)
        return Promise.resolve(opts.closeFails && done.patch.status === 'closed'
          ? { data: null, error: { message: 'permission denied for table audit_findings' } }
          : { data: done.ids.map((id) => ({ id })), error: null }).then(ok)
      }
      return Promise.resolve(opts.readFails
        ? { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } }
        : { data: opts.rows ?? [], error: null }).then(ok)
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { from: () => b } as any, updates }
}

const closedIds = (updates: Array<{ patch: Record<string, unknown>; ids: string[] }>) =>
  updates.filter((u) => u.patch.status === 'closed').flatMap((u) => u.ids)
const carriedPairs = (updates: Array<{ patch: Record<string, unknown>; ids: string[] }>) =>
  updates.filter((u) => 'same_as' in u.patch).map((u) => [u.ids[0], u.patch.same_as])

/** Three rows the shaper wrote for this section, in ordinal order. */
const ROWS = [
  { id: 'n1', ordinal: 1, kind: 'finding', title: 'No written hazard communication programme' },
  { id: 'n2', ordinal: 2, kind: 'finding', title: 'The emissions report for 2025 is not on file' },
  { id: 'n3', ordinal: 3, kind: 'date', title: 'Permit expires' },
]

// =================================================================================================
// THE SHIPPED MATCHER, COPIED LINE FOR LINE
// =================================================================================================
/** `lib/auditRun.ts`'s `matchAgainstPrevious` as it shipped. It both matched and closed. */
async function oldMatcher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sec: { id: string; run_id: string; company_id: string },
  previous: typeof PREVIOUS,
  obj: Record<string, unknown>,
) {
  const KINDS = [{ field: 'findings' }, { field: 'dates' }, { field: 'contradictions' }, { field: 'expected_not_seen' }]
  const byHandle = new Map(previous.map((p) => [p.shown.handle.toUpperCase(), p.id]))
  const { data: fresh } = await db.from('audit_findings').select('id, ordinal').eq('section_id', sec.id).order('ordinal')
  const freshRows: Array<{ id: string }> = fresh ?? []
  const claimed = new Set<string>()
  let carried = 0
  let i = 0
  for (const { field } of KINDS) {
    const list = Array.isArray(obj[field]) ? (obj[field] as unknown[]) : []
    for (const raw of list) {
      const item = (typeof raw === 'string' ? { title: raw } : raw) as Record<string, unknown>
      const title = typeof item?.title === 'string' ? item.title : (item?.what as string)
      if (!title) continue
      const row = freshRows[i++]
      const h = typeof item?.same_as === 'string' ? item.same_as.trim().toUpperCase() : ''
      const prevId = h ? byHandle.get(h) : undefined
      if (row && prevId) {
        await db.from('audit_findings').update({ same_as: prevId }).eq('id', row.id)
        claimed.add(prevId); carried++
      }
    }
  }
  const unmatched = previous.filter((p) => !claimed.has(p.id)).map((p) => p.id)
  if (unmatched.length) {
    await db.from('audit_findings').update({
      status: 'closed', closed_by_run_id: sec.run_id, closed_reason: 'not raised by the newer audit',
    }).in('id', unmatched).eq('status', 'open')
  }
  return { carried, closed: unmatched.length }
}

// =================================================================================================
// THE GOOD RUN FIRST — §9a: a check that reports an absence must be shown seeing a presence.
// =================================================================================================
describe('the ordinary re-audit, which must still carry and still close', () => {
  const answer = {
    findings: [
      { title: 'No written hazard communication programme', same_as: 'F1' },
      { title: 'The emissions report for 2025 is not on file', same_as: 'F2' },
    ],
    dates: [{ title: 'Permit expires', due_on: '2027-11-15' }],
  }

  test('two findings carried to the right rows, by (kind, title)', async () => {
    const { db, updates } = fakeDb({ rows: ROWS })
    const r = await matchAgainstPrevious(db, SEC, PREVIOUS, answer)
    assert.equal(r.carried, 2)
    assert.deepEqual(carriedPairs(updates), [['n1', 'p1'], ['n2', 'p2']])
  })

  test('the one nothing claimed is reported unmatched — and NOT closed here', async () => {
    const { db, updates } = fakeDb({ rows: ROWS })
    const r = await matchAgainstPrevious(db, SEC, PREVIOUS, answer)
    assert.deepEqual(r.unmatched, ['p3'])
    assert.deepEqual(closedIds(updates), [], 'closing is the last thing the section does (fault 4)')
  })

  test('and closing it is a step of its own, with the reason in words', async () => {
    const { db, updates } = fakeDb({ rows: ROWS })
    const c = await closeUnmatchedPrevious(db, SEC, ['p3'])
    assert.deepEqual(c, { closed: 1, error: null })
    const close = updates.find((u) => u.patch.status === 'closed')!
    assert.deepEqual(close.ids, ['p3'])
    assert.equal(close.patch.closed_reason, 'not raised by the newer audit')
    assert.equal(close.patch.closed_by_run_id, 'run-2')
  })
})

// =================================================================================================
// FAULT 1 — THE READ OF THE NEW ROWS WAS UNCHECKED
// =================================================================================================
describe('*** A1 fault 1: a failed read of the section\'s own findings ***', () => {
  const answer = { findings: [{ title: 'No written hazard communication programme', same_as: 'F1' }] }

  test('the OLD code closed ALL THREE of the previous run\'s open findings', async () => {
    const { db, updates } = fakeDb({ readFails: true })
    const r = await oldMatcher(db, SEC, PREVIOUS, answer)
    assert.equal(r.closed, 3)
    assert.deepEqual(closedIds(updates), ['p1', 'p2', 'p3'],
      'this is the shipped behaviour: a database hiccup closed a customer\'s open findings')
  })

  test('the fix throws, naming what could not be read, and closes nothing', async () => {
    const { db, updates } = fakeDb({ readFails: true })
    await assert.rejects(() => matchAgainstPrevious(db, SEC, PREVIOUS, answer), (e: unknown) => {
      assert.ok(e instanceof ReadFailed)
      assert.equal(e.what, "this audit's own findings")
      return true
    })
    assert.deepEqual(closedIds(updates), [])
  })
})

// =================================================================================================
// FAULT 2 — ROWS MATCHED BY POSITION, WHILE THE SHAPER DROPS ITEMS
// =================================================================================================
describe('*** A1 fault 2: one dropped item moved every later answer onto the wrong row ***', () => {
  // The model named three findings. `shapeFindings` dropped the middle one — it would have landed
  // with no word — so the section holds two rows for three answers.
  const answer = {
    findings: [
      { title: 'No written hazard communication programme', same_as: 'F1' },
      { title: 'Something with no word at all' },                                 // dropped by the shaper
      { title: 'The emissions report for 2025 is not on file', same_as: 'F2' },
    ],
  }
  const rowsAfterDrop = [
    { id: 'n1', ordinal: 1, kind: 'finding', title: 'No written hazard communication programme' },
    { id: 'n2', ordinal: 2, kind: 'finding', title: 'The emissions report for 2025 is not on file' },
  ]

  test('the OLD code attached F2 to the WRONG ROW, and p2 looked claimed by a row that is not it', async () => {
    const { db, updates } = fakeDb({ rows: rowsAfterDrop })
    await oldMatcher(db, SEC, PREVIOUS, answer)
    // i walks 0,1,2 over two rows: F1 → n1 (right), the dropped item consumed n2, F2 → undefined.
    assert.deepEqual(carriedPairs(updates), [['n1', 'p1']], 'F2 was lost entirely')
    assert.deepEqual(closedIds(updates), ['p2', 'p3'],
      'so p2 — which the model said IS still being raised — was closed')
  })

  test('the fix matches by title: F2 lands on its own row and p2 is not closed', async () => {
    const { db, updates } = fakeDb({ rows: rowsAfterDrop })
    const r = await matchAgainstPrevious(db, SEC, PREVIOUS, answer)
    assert.deepEqual(carriedPairs(updates), [['n1', 'p1'], ['n2', 'p2']])
    assert.deepEqual(r.unmatched, ['p3'], 'only the one the model really did not raise')
  })

  test('and a date and a finding of the same wording stay apart', async () => {
    const rows = [
      { id: 'f1', ordinal: 1, kind: 'finding', title: 'Permit expires' },
      { id: 'd1', ordinal: 2, kind: 'date', title: 'Permit expires' },
    ]
    const { db, updates } = fakeDb({ rows })
    await matchAgainstPrevious(db, SEC, PREVIOUS,
      { dates: [{ title: 'Permit expires', same_as: 'F3' }] })
    assert.deepEqual(carriedPairs(updates), [['d1', 'p3']], 'the DATE row, not the finding row')
  })
})

// =================================================================================================
// FAULT 3 — A CHECKLIST RE-RUN HAS NONE OF THESE ARRAYS
// =================================================================================================
describe('*** A1 fault 3: an answer that carried no list at all ***', () => {
  // A template answer. Its shape is `lines`, not `findings`/`dates`/`contradictions`.
  const checklistAnswer = { lines: [{ ref: '1.1', word: 'on_file', title: 'SDS binder present' }] }

  test('the OLD code closed every previous finding, because none could be matched', async () => {
    const { db, updates } = fakeDb({ rows: ROWS })
    const r = await oldMatcher(db, SEC, PREVIOUS, checklistAnswer)
    assert.equal(r.closed, 3)
    assert.deepEqual(closedIds(updates), ['p1', 'p2', 'p3'],
      'running a checklist again closed every open finding of the agency audit before it')
  })

  test('the fix closes nothing: "nothing was said about these" is not "none of these is true"', async () => {
    const { db, updates } = fakeDb({ rows: ROWS })
    const r = await matchAgainstPrevious(db, SEC, PREVIOUS, checklistAnswer)
    assert.deepEqual(r.unmatched, [])
    assert.deepEqual(closedIds(updates), [])
  })

  test('an empty `findings` array IS an answer, and still closes', async () => {
    // The difference that matters: `findings: []` is the model saying it found none, which is a
    // real answer about this agency. A missing key is an answer we did not get.
    const { db } = fakeDb({ rows: ROWS })
    const r = await matchAgainstPrevious(db, SEC, PREVIOUS, { findings: [] })
    assert.deepEqual(r.unmatched, ['p1', 'p2', 'p3'])
  })

  test('and the caller skips a template run outright', () => {
    const code = readFileSync('lib/auditRun.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(code, /if \(previous\.length && !isTemplate\) \{/)
  })
})

// =================================================================================================
// FAULT 4 — CLOSING BEFORE THE REST OF THE SECTION
// =================================================================================================
describe('*** A1 fault 4: closing came before the work that could still fail ***', () => {
  const code = readFileSync('lib/auditRun.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('the close now happens AFTER the collapse and after the section is marked done', () => {
    const match = code.indexOf('matchAgainstPrevious(db, sec, previous, obj)')
    const collapse = code.indexOf('collapseAgainstEarlier(db, sec, raisedInRun, obj)')
    const done = code.indexOf("status: 'done', could_not_complete_reason: null")
    const close = code.indexOf('closeUnmatchedPrevious(db, sec, unmatchedPrevious)')
    assert.ok(match > 0 && collapse > 0 && done > 0 && close > 0, 'all four steps are in the file')
    assert.ok(close > collapse, 'a collapse that threw used to leave findings already closed')
    assert.ok(close > done, 'and the section is done before anything is closed')
  })

  test('the matcher itself no longer closes anything, so the order cannot be undone by accident', () => {
    const fn = code.slice(code.indexOf('export async function matchAgainstPrevious'),
                          code.indexOf('export async function closeUnmatchedPrevious'))
    assert.ok(!/status: 'closed'/.test(fn), 'the only closing write is in closeUnmatchedPrevious')
  })

  test('a failed close is reported and does NOT fail a section that finished', async () => {
    const { db } = fakeDb({ rows: ROWS, closeFails: true })
    const c = await closeUnmatchedPrevious(db, SEC, ['p3'])
    assert.equal(c.closed, 0)
    assert.match(String(c.error), /permission denied/)
  })
})

// =================================================================================================
// O1 — THE FIELD THAT KEPT ALL OF THIS FROM EVER RUNNING
// =================================================================================================
describe('*** O1: "Audit again" never linked the two runs ***', () => {
  const route = readFileSync('app/api/audit-runs/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('the report has always SENT previous_run_id', () => {
    assert.match(readFileSync('components/AuditReport.tsx', 'utf8'), /previous_run_id: run\.id/)
  })

  test('*** and the agency branch now keeps it — it used to drop it ***', () => {
    const agency = route.slice(route.indexOf("kind: 'agency', agency, scope, entityId"))
    assert.match(agency.slice(0, 200), /previousRunId/,
      'without it runSection sees no previous run and the matcher never runs: "carried" and '
      + '"closed" could not happen in the app at all')
  })

  test('both branches take the SAME validated value, read as the caller', () => {
    assert.equal((route.match(/previousRunId,/g) ?? []).length, 2, 'the template branch and the agency one')
    assert.match(route, /from\('audit_runs'\)\.select\('id'\)\.eq\('id', asked\)\.maybeSingle\(\)/)
    assert.match(route, /That earlier audit was not found\./)
    assert.ok(!/previousRunId: body\?\.previous_run_id/.test(route),
      'the template branch used to pass a client id straight through, unchecked')
  })

  test('404, not 403, so an id cannot be probed by which error comes back (§3.6)', () => {
    const check = route.slice(route.indexOf('let previousRunId'), route.indexOf('let previousRunId') + 500)
    assert.match(check, /status: 404/)
    assert.ok(!/status: 403/.test(check))
  })
})

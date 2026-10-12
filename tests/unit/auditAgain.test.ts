/**
 * *** THE SYSTEM NEVER CLOSES A FINDING BECAUSE THE NEWER AUDIT WENT QUIET ***
 * — the owner's decision **D1**, 12 October 2026 (`docs/reports/jobE-independent-review.md` §7),
 * out of E9 item 3 and the independent read's N2 and N3.
 *
 * *** MEASURED, ON TWO REAL RUNS OF ONE AGENCY (E9 item 3). *** `run 1: 7 findings · run 2: 8 ·
 * CARRIED 4 · NEW 4 · CLOSED 3`, and **closed because the title was worded differently: 0 of 3**.
 * The three were closed for worse reasons:
 *
 *   · run 2's `[finding] Monthly visual inspections…` carried `same_as` → run 1's
 *     `[expected] Monthly inspection log…`, while run 1's actual `[finding]` of that exact title
 *     was closed as "not raised by the newer audit" — in a run that raised it. Nothing checked that
 *     the two rows were the same KIND.
 *   · `[date]` and `[expected]` can be claimed by nothing: only the `findings` list has a `same_as`
 *     field (`prompts/audit-agency.ts`). So every re-audit closed them and raised them again —
 *     `date: carried 0, closed 2`, both re-created with identical titles, and four open rows for
 *     two obligations.
 *
 * And the lookup used the kind of THE LIST an item was in, while `shapeFindings` saves a row under a
 * kind the list does not always predict (a `nothing_on_file` finding with a future due date is
 * saved as a **date**).
 *
 * The decision, in four parts, and all four are here:
 *   1. plain facts first — same SAVED kind, same title ignoring case, punctuation and spacing;
 *      `same_as` only where the saved kinds agree, and a wrong-kind link is ignored and counted;
 *   2. only evidence closes — "Now on file: <document title>";
 *   3. silence never closes — the item stays OPEN and moves to "Not raised in this audit";
 *   4. the counts: duplicates merged inside one run never count as closed (N3).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchAgainstPrevious, closeUnmatchedPrevious, closeOnEvidence, normalise, matchKey, nowOnFile } from '../../lib/auditRun.ts'
import { carryLine } from '../../lib/auditSummary.ts'

const SEC = { id: 'sec1', run_id: 'run2', company_id: 'co1' }

/**
 * A stand-in for the caller's client over `audit_findings`: `freshRows` is what this section just
 * wrote, and every update is recorded so the test can read which row claimed which previous one.
 */
function fakeDb(freshRows: Array<Record<string, unknown>>, opts: { failUpdate?: boolean } = {}) {
  const updates: Array<{ patch: Record<string, unknown>; id: string }> = []
  const db = {
    from: () => {
      let id = ''
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.order = () => q
      q.in = (_c: string, ids: string[]) => { id = ids.join(','); return q }
      q.eq = (c: string, v: unknown) => { if (c === 'id') id = String(v); return q }
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: freshRows, error: null }).then(ok)
      q.update = (patch: Record<string, unknown>) => {
        const u: Record<string, unknown> = {}
        u.eq = (c: string, v: unknown) => { if (c === 'id') id = String(v); return u }
        u.in = (_c: string, ids: string[]) => { id = ids.join(','); return u }
        u.select = () => u
        u.then = (ok: (v: unknown) => unknown) => {
          updates.push({ patch, id })
          // One row back per id, the way PostgREST answers an `.in()` update.
          return Promise.resolve(opts.failUpdate
            ? { data: null, error: { message: 'refused' } }
            : { data: id.split(',').filter(Boolean).map((x) => ({ id: x })), error: null }).then(ok)
        }
        return u
      }
      return q
    },
  }
  return { db: db as never, updates }
}

const prev = (handle: string, id: string, kind: string, title: string) =>
  ({ id, shown: { handle, title, word: null, kind } })

describe('the match key (D1.1)', () => {
  test('case, punctuation and spacing are ignored', () => {
    assert.equal(normalise('Monthly visual inspections.'), normalise('monthly  Visual Inspections'))
    assert.equal(normalise('Spill plan (2026)'), 'spill plan 2026')
    assert.equal(normalise(''), '')
  })

  test('but the KIND still separates two items of the same wording', () => {
    assert.notEqual(matchKey('finding', 'Spill plan'), matchKey('date', 'Spill plan'))
    assert.equal(matchKey('finding', 'Spill plan.'), matchKey('finding', 'spill  plan'))
  })
})

describe('*** D1.1: plain facts first, and the saved kind is what counts ***', () => {
  test('a [date] and an [expected] carry WITHOUT the model saying anything — E9 3b', () => {
    // These two kinds have no `same_as` field in the prompt at all, so before E10 every re-audit
    // closed them and raised them again: four open rows for two obligations.
    const fresh = [
      { id: 'n1', ordinal: 0, kind: 'date', title: 'Air permit renewal', word: null, document_id: null },
      { id: 'n2', ordinal: 1, kind: 'expected', title: 'Monthly inspection log', word: null, document_id: null },
    ]
    const { db, updates } = fakeDb(fresh)
    const previous = [prev('F1', 'p1', 'date', 'Air permit renewal'),
                      prev('F2', 'p2', 'expected', 'Monthly inspection log')]
    return matchAgainstPrevious(db, SEC, previous, { findings: [] }).then((m) => {
      assert.equal(m.carried, 2, 'both carry on the plain facts')
      assert.deepEqual(m.unmatched, [], 'and neither is left to be closed')
      assert.deepEqual(updates.map((u) => [u.id, u.patch.same_as]), [['n1', 'p1'], ['n2', 'p2']])
    })
  })

  test('the row\'s SAVED kind is used, not the list it came from', async () => {
    // `shapeFindings` saved this item as a `date` although the model wrote it in `findings`.
    const fresh = [{ id: 'n1', ordinal: 0, kind: 'date', title: 'Tank test due', word: null, document_id: null }]
    const { db } = fakeDb(fresh)
    // The previous row is a date too, so the plain-fact match finds it even though the model put
    // the item in the findings list.
    const m = await matchAgainstPrevious(db, SEC, [prev('F1', 'p1', 'date', 'Tank test due')],
      { findings: [{ title: 'Tank test due', same_as: 'F1' }] })
    assert.equal(m.carried, 1)
    assert.equal(m.wrongKindLinks, 0, 'the kinds agree — the list it came from is not consulted')
  })

  test('*** a wrong-kind link is IGNORED and counted, and the real match is not closed — E9 3a ***', async () => {
    const fresh = [
      { id: 'n1', ordinal: 0, kind: 'finding', title: 'Monthly visual inspections', word: null, document_id: null },
    ]
    const { db, updates } = fakeDb(fresh)
    const previous = [
      prev('F1', 'p-expected', 'expected', 'Monthly inspection log'),
      prev('F2', 'p-finding', 'finding', 'Monthly visual inspections'),
    ]
    // The model claims the EXPECTED row. That is the link that closed the real finding.
    const m = await matchAgainstPrevious(db, SEC, previous,
      { findings: [{ title: 'Monthly visual inspections', same_as: 'F1' }] })
    assert.equal(m.wrongKindLinks, 1, 'the wrong-kind link is counted in the run\'s record')
    assert.deepEqual(updates.map((u) => u.patch.same_as), ['p-finding'],
      'the plain-fact match claimed the finding of the same kind and the same title')
    assert.deepEqual(m.unmatched, ['p-expected'],
      'the expected item is not raised this time — and under D1.3 that does NOT close it')
    assert.equal(m.carried, 1)
  })

  test('one previous row is claimed once, however many items point at it', async () => {
    const fresh = [
      { id: 'n1', ordinal: 0, kind: 'finding', title: 'Spill plan', word: null, document_id: null },
      { id: 'n2', ordinal: 1, kind: 'finding', title: 'Spill plan', word: null, document_id: null },
    ]
    const { db, updates } = fakeDb(fresh)
    const m = await matchAgainstPrevious(db, SEC, [prev('F1', 'p1', 'finding', 'Spill plan')],
      { findings: [{ title: 'Spill plan', same_as: 'F1' }, { title: 'Spill plan', same_as: 'F1' }] })
    assert.equal(m.carried, 1, 'carried counts previous findings, never links — Run 3 item 1')
    assert.equal(updates.length, 1)
  })

  test('an answer carrying NO list says nothing about any of them (A1 fault 3, kept)', async () => {
    const fresh = [{ id: 'n1', ordinal: 0, kind: 'finding', title: 'Something else', word: null, document_id: null }]
    const { db } = fakeDb(fresh)
    const m = await matchAgainstPrevious(db, SEC, [prev('F1', 'p1', 'finding', 'Spill plan')], {})
    assert.deepEqual(m.unmatched, [],
      '"the model said nothing about these" is not "none of these is still true"')
  })
})

describe('*** D1.2: only evidence closes ***', () => {
  test('a carried item the newer audit says is on file, citing a document', async () => {
    const fresh = [{ id: 'n1', ordinal: 0, kind: 'finding', title: 'Spill plan', word: 'on_file', document_id: 'doc9' }]
    const { db } = fakeDb(fresh)
    const m = await matchAgainstPrevious(db, SEC, [prev('F1', 'p1', 'finding', 'Spill plan')],
      { findings: [{ title: 'Spill plan', same_as: 'F1' }] })
    assert.deepEqual(m.onFile, [{ id: 'p1', document: 'doc9' }])

    const { db: db2, updates } = fakeDb([])
    const done = await closeOnEvidence(db2, SEC, m.onFile, () => 'Spill Prevention Plan 2026.pdf')
    assert.equal(done.closed, 1)
    assert.equal(updates[0].patch.status, 'closed')
    assert.equal(updates[0].patch.closed_reason, 'Now on file: Spill Prevention Plan 2026.pdf')
    assert.equal(updates[0].patch.closed_by_run_id, 'run2')
    assert.ok(updates[0].patch.closed_at, 'the date is recorded, because a person may ask when')
  })

  test('on file with NO document cited closes nothing — the evidence is the point', async () => {
    const fresh = [{ id: 'n1', ordinal: 0, kind: 'finding', title: 'Spill plan', word: 'on_file', document_id: null }]
    const { db } = fakeDb(fresh)
    const m = await matchAgainstPrevious(db, SEC, [prev('F1', 'p1', 'finding', 'Spill plan')],
      { findings: [{ title: 'Spill plan', same_as: 'F1' }] })
    assert.deepEqual(m.onFile, [])
  })

  test('a carried item that still needs a person stays open', async () => {
    const fresh = [{ id: 'n1', ordinal: 0, kind: 'finding', title: 'Spill plan', word: 'nothing_on_file', document_id: null }]
    const { db } = fakeDb(fresh)
    const m = await matchAgainstPrevious(db, SEC, [prev('F1', 'p1', 'finding', 'Spill plan')],
      { findings: [{ title: 'Spill plan', same_as: 'F1' }] })
    assert.deepEqual(m.onFile, [])
    assert.equal(m.carried, 1)
  })

  test('a document we cannot name still gets a sentence a person can read', () => {
    assert.equal(nowOnFile(null), 'Now on file: a document you have given us')
    assert.equal(nowOnFile('Permit.pdf'), 'Now on file: Permit.pdf')
  })

  test('a close that is refused leaves the finding open and says so', async () => {
    const { db, updates } = fakeDb([], { failUpdate: true })
    const done = await closeOnEvidence(db, SEC, [{ id: 'p1', document: 'doc9' }], () => 'X.pdf')
    assert.equal(done.closed, 0)
    assert.equal(done.error, 'refused')
    assert.equal(updates.length, 1)
  })
})

describe('*** D1.3: silence never closes ***', () => {
  test('an unmatched previous finding is MARKED, not closed', async () => {
    const { db, updates } = fakeDb([])
    const out = await closeUnmatchedPrevious(db, SEC, ['p1', 'p2'])
    assert.equal(out.closed, 2, 'the count is how many were marked')
    assert.equal(updates.length, 1)
    assert.deepEqual(updates[0].patch, { not_raised_by_run_id: 'run2' })
    // The three things that must NOT be written any more.
    assert.ok(!('status' in updates[0].patch), 'the finding stays OPEN')
    assert.ok(!('closed_reason' in updates[0].patch))
    assert.ok(!('closed_by_run_id' in updates[0].patch))
  })

  test('the phrase that went to customers is gone from the code', () => {
    const run = readFileSync('lib/auditRun.ts', 'utf8')
    const live = run.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!live.includes("'not raised by the newer audit'"),
      'nothing may write that reason any more — it was a claim a person could not undo')
  })

  test('nothing to mark is not a write', async () => {
    const { db, updates } = fakeDb([])
    assert.deepEqual(await closeUnmatchedPrevious(db, SEC, []), { closed: 0, error: null })
    assert.equal(updates.length, 0)
  })

  test('the report gathers the group, and the person closes or reopens it', () => {
    const rep = readFileSync('components/AuditReport.tsx', 'utf8')
    assert.match(rep, /title="Not raised in this audit"/)
    assert.match(rep, /If it&apos;s taken care of, close it\./)
    assert.match(rep, />Close it</)
    assert.match(rep, />Reopen</)
    assert.match(rep, /Closed\{f\.closed_by_name \? ` by \$\{f\.closed_by_name\}` : ''\}/)
    const route = readFileSync('app/api/audit-findings/route.ts', 'utf8')
    assert.match(route, /action !== 'dismiss' && action !== 'close' && action !== 'reopen'/)
    // Reopen leaves no trace, which is the whole complaint in E9 item 3.
    assert.match(route, /status: 'open', closed_by: null, closed_at: null, closed_reason: null/)
  })
})

describe('*** D1.4: the counts, and the run\'s own duplicates are not closes (N3) ***', () => {
  test('the three facts, in the owner\'s order and words', () => {
    assert.equal(carryLine({ carried: 4, closed: 1, not_raised: 2 }),
      '4 still open from last time · 1 now on file · 2 not raised this time — please check')
  })

  test('each clause only when there is something to say, and nothing at all on a first audit', () => {
    assert.equal(carryLine({ carried: 0, closed: 0, not_raised: 0 }), null)
    assert.equal(carryLine({ carried: 3, closed: 0 }), '3 still open from last time')
    assert.equal(carryLine({ carried: 0, closed: 2, not_raised: 0 }), '2 now on file')
    assert.equal(carryLine({ carried: 0, closed: 0, not_raised: 1 }),
      '1 not raised this time — please check')
  })

  test('the closed count leaves out a row this run closed on ITSELF', () => {
    // `collapseAgainstEarlier` stamps an in-run duplicate merge with `closed_by_run_id = this run`.
    const index = readFileSync('app/api/audits/index/route.ts', 'utf8')
    assert.match(index, /if \(!k \|\| k === f\.run_id\) continue/)
    const run = readFileSync('lib/auditRun.ts', 'utf8')
    assert.match(run, /\.eq\('closed_by_run_id', runId\)\.neq\('run_id', runId\)/)
  })

  test('and both of those counts are now checked reads', () => {
    const index = readFileSync('app/api/audits/index/route.ts', 'utf8')
    assert.match(index, /mustRows<\{ closed_by_run_id: string \| null; run_id: string \}>/)
    assert.match(readFileSync('lib/auditRun.ts', 'utf8'),
      /mustCount\('how many of your earlier findings this audit closed'/)
  })

  test('the email, the drawer and Past audits all read the one function', () => {
    for (const f of ['lib/auditNotify.ts', 'components/AuditReport.tsx', 'app/audits/page.tsx']) {
      assert.match(readFileSync(f, 'utf8'), /carryLine/, `${f} must use the shared line`)
    }
  })
})

/**
 * `lib/calendarDates.ts` — every branch of `proposeDate` and the three things a person does to a
 * date, against a stand-in client. Calendar step 5 (`docs/CALENDAR-PLAN.md` §2.6, decisions 11, 13,
 * 23, and the owner's two rules of 15 October: a superseded date comes back, a dismissed one never
 * does).
 *
 * THE INVARIANT EVERY DEDUPE TEST ASSERTS: at most ONE live row per (document, lower(title)), live
 * meaning `dismissed_by is null and replaced_by is null`. The database holds the other half — the
 * partial unique index refuses the same date twice — and no constraint can see this half.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  proposeDate, confirmDate, dismissDate, setPeriod,
  PERIODS, SOURCES, CONFIRMED_SOURCES, normaliseTitle,
} from '../../lib/calendarDates.ts'

type Row = Record<string, unknown>

/** A stand-in Supabase client over an array of rows. Records every write so a test can read it. */
function fake(initial: Row[] = []) {
  const rows: Row[] = initial.map((r) => ({ due_date: null, dismissed_by: null, replaced_by: null, ...r }))
  const log: string[] = []
  let n = 0
  function from(_table: string) {
    const eqs: Row = {}
    let inIds: string[] | null = null
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}
    const hits = () => rows.filter((r) =>
      Object.entries(eqs).every(([k, v]) => (r[k] ?? null) === v)
      && (inIds ? inIds.includes(r.id as string) : true))
    function apply() {
      if (mode === 'insert') {
        const row: Row = { id: `id${++n}`, due_date: null, dismissed_by: null, replaced_by: null, ...payload }
        rows.push(row)
        log.push(`insert ${String(row.title)} @${String(row.due_date)} ${String(row.status)}`)
        return { data: [row], error: null }
      }
      if (mode === 'update') {
        const t = hits()
        for (const r of t) Object.assign(r, payload)
        log.push(`update ${JSON.stringify(payload)} -> ${t.map((r) => r.id).join(',') || 'none'}`)
        return { data: t, error: null }
      }
      return { data: hits(), error: null }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {
      select() { return q },
      eq(k: string, v: unknown) { eqs[k] = v; return q },
      in(_k: string, v: string[]) { inIds = v; return q },
      insert(p: Row) { mode = 'insert'; payload = p; return q },
      update(p: Row) { mode = 'update'; payload = p; return q },
      single() { const r = apply(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }) },
      maybeSingle() { const r = apply(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }) },
      then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) { return Promise.resolve(apply()).then(res, rej) },
    }
    return q
  }
  return { db: { from } as never, rows, log }
}

/** The invariant, as a function, so every dedupe test can end with it. */
const liveFor = (rows: Row[], documentId: string, title: string) => rows.filter((r) =>
  r.document_id === documentId && normaliseTitle(String(r.title)) === normaliseTitle(title)
  && !r.dismissed_by && !r.replaced_by)

const DOC = 'doc-1'
const CO = 'co-1'
const base = { companyId: CO, source: 'document' as const, title: 'Permit expires', recurs: false }

// -------------------------------------------------------------------------------------------
describe('proposeDate — the contract refuses what the database would refuse', () => {
  test('a one-off date with no day throws, naming the rule rather than the constraint', async () => {
    await assert.rejects(
      () => proposeDate(fake().db, { ...base, dueOn: null, recurs: false }),
      /a one-off date must have a day/)
  })
  test('...and a REPEATING date with no day is accepted: the case migration 060 exists for', async () => {
    const f = fake()
    const r = await proposeDate(f.db, { ...base, title: 'Annual fee', dueOn: null, recurs: true, documentId: DOC })
    assert.equal(r.outcome, 'created')
    assert.equal(f.rows[0].due_date, null)
    assert.equal(f.rows[0].recurs, true)
  })
  test('a date that is not a date throws, and is never quietly dropped to null', async () => {
    await assert.rejects(() => proposeDate(fake().db, { ...base, dueOn: '15 November 2027' }), /is not a YYYY-MM-DD date/)
    await assert.rejects(() => proposeDate(fake().db, { ...base, dueOn: '2027-11' }), /is not a YYYY-MM-DD date/)
  })
  test('a source outside the five, a blank title, no company, and "dismissed" as a start all throw', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assert.rejects(() => proposeDate(fake().db, { ...base, source: 'compliance' as any, dueOn: '2027-01-01' }), /is not a source/)
    await assert.rejects(() => proposeDate(fake().db, { ...base, title: '   ', dueOn: '2027-01-01' }), /needs a title/)
    await assert.rejects(() => proposeDate(fake().db, { ...base, companyId: '', dueOn: '2027-01-01' }), /no companyId/)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await assert.rejects(() => proposeDate(fake().db, { ...base, dueOn: '2027-01-01', status: 'dismissed' as any }), /removing a date is dismissDate/)
  })
  test('the five sources and the five periods are exactly the migration\'s', () => {
    assert.deepEqual([...SOURCES], ['document', 'audit', 'handbook', 'rule', 'person'])
    assert.deepEqual([...PERIODS], ['month', 'quarter', '6 months', 'year', '2 years'])
    assert.deepEqual([...CONFIRMED_SOURCES], ['person', 'rule'])
  })
})

describe('proposeDate — what a date arrives as', () => {
  test('a person\'s date and the chat\'s offer are born CONFIRMED, naming who said so', async () => {
    for (const source of ['person', 'rule'] as const) {
      const f = fake()
      await proposeDate(f.db, { companyId: CO, source, title: 'Call the fire marshal', dueOn: '2027-01-06', recurs: false, addedBy: 'user-9' })
      assert.equal(f.rows[0].status, 'confirmed', source)
      assert.equal(f.rows[0].added_by, 'user-9')
      assert.equal(f.rows[0].confirmed_by, 'user-9', 'a confirmed date names its confirmer')
      assert.ok(f.rows[0].confirmed_at, 'and when')
    }
  })
  test('everything a MACHINE read arrives PROPOSED, and names no confirmer', async () => {
    for (const source of ['document', 'audit', 'handbook'] as const) {
      const f = fake()
      await proposeDate(f.db, { companyId: CO, source, title: 'Annual report', dueOn: '2027-02-15', recurs: false })
      assert.equal(f.rows[0].status, 'proposed', source)
      assert.equal(f.rows[0].confirmed_by, undefined)
    }
  })
  test('an explicit status overrides the source\'s default', async () => {
    const f = fake()
    await proposeDate(f.db, { ...base, dueOn: '2027-01-01', documentId: DOC, status: 'confirmed', addedBy: 'u1' })
    assert.equal(f.rows[0].status, 'confirmed')
  })
  test('the title is trimmed, and every pointer that was not given is null, not absent', async () => {
    const f = fake()
    await proposeDate(f.db, { ...base, title: '  Permit expires  ', dueOn: '2027-01-01' })
    assert.equal(f.rows[0].title, 'Permit expires')
    for (const k of ['document_id', 'deadline_id', 'audit_finding_id', 'handbook_id', 'entity_id', 'added_by',
                     'source_line', 'source_url', 'source_page', 'description']) {
      assert.equal(f.rows[0][k], null, k)
    }
  })
  test('description is the person\'s note and source_line is the document\'s line; they are separate', async () => {
    const f = fake()
    await proposeDate(f.db, { ...base, dueOn: '2027-01-01', documentId: DOC,
      description: 'ask Dave about this one', sourceLine: 'Condition 6.2 of the permit' })
    assert.equal(f.rows[0].description, 'ask Dave about this one')
    assert.equal(f.rows[0].source_line, 'Condition 6.2 of the permit')
  })
  test('a non-document source is NEVER deduped: two people may set the same reminder', async () => {
    const f = fake()
    const a = await proposeDate(f.db, { companyId: CO, source: 'person', title: 'Call the fire marshal', dueOn: '2027-01-06', recurs: false })
    const b = await proposeDate(f.db, { companyId: CO, source: 'person', title: 'Call the fire marshal', dueOn: '2027-01-06', recurs: false })
    assert.equal(a.outcome, 'created'); assert.equal(b.outcome, 'created')
    assert.notEqual(a.id, b.id)
    assert.equal(f.rows.length, 2)
  })
  test('a document source with NO documentId cannot be deduped and says so by creating', async () => {
    const f = fake([{ id: 'old', company_id: CO, document_id: null, source: 'document', title: 'Permit expires', due_date: '2027-01-01', status: 'proposed' }])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-01-01' })
    assert.equal(r.outcome, 'created')
  })
})

describe('proposeDate — decision 13: the same date is never proposed twice', () => {
  const live = { id: 'old', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-01-01', status: 'proposed' }

  test('the SAME document date is "existing", and nothing is written', async () => {
    const f = fake([{ ...live }])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-01-01', documentId: DOC })
    assert.deepEqual(r, { id: 'old', outcome: 'existing' })
    assert.equal(f.rows.length, 1)
    assert.deepEqual(f.log, [], 'no insert and no update')
  })
  test('...and the match is case-insensitive, as the index\'s lower(title) is', async () => {
    const f = fake([{ ...live }])
    const r = await proposeDate(f.db, { ...base, title: 'PERMIT EXPIRES', dueOn: '2027-01-01', documentId: DOC })
    assert.equal(r.outcome, 'existing')
    assert.equal(f.rows.length, 1)
  })
  test('...and an UNDATED repeating date matches an undated one, which the unique index needs coalesce for', async () => {
    const f = fake([{ id: 'old', company_id: CO, document_id: DOC, source: 'document', title: 'Annual fee', due_date: null, recurs: true, status: 'proposed' }])
    const r = await proposeDate(f.db, { ...base, title: 'Annual fee', dueOn: null, recurs: true, documentId: DOC })
    assert.deepEqual(r, { id: 'old', outcome: 'existing' })
    assert.equal(f.rows.length, 1)
  })
  test('a MOVED date is proposed anew and the old row superseded, never deleted', async () => {
    const f = fake([{ ...live }])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-11-15', documentId: DOC })
    assert.equal(r.outcome, 'replaced')
    assert.equal(f.rows.length, 2, 'the old row still exists')
    const old = f.rows.find((x) => x.id === 'old')!
    assert.equal(old.replaced_by, r.id)
    assert.equal(old.status, 'proposed', 'superseding does not change a status; replaced_by is the marker')
    assert.deepEqual(liveFor(f.rows, DOC, 'Permit expires').map((x) => x.id), [r.id])
  })
  test('a date that moves TWICE leaves one live row, and every superseded row points at it', async () => {
    const f = fake([{ ...live }])
    const first = await proposeDate(f.db, { ...base, dueOn: '2027-11-15', documentId: DOC })
    const second = await proposeDate(f.db, { ...base, dueOn: '2028-01-20', documentId: DOC })
    assert.equal(second.outcome, 'replaced')
    assert.equal(f.rows.length, 3)
    assert.deepEqual(liveFor(f.rows, DOC, 'Permit expires').map((x) => x.id), [second.id])
    // `replaced_by` names the row that is live NOW, not the next link in a chain.
    assert.equal(f.rows.find((x) => x.id === 'old')!.replaced_by, second.id)
    assert.equal(f.rows.find((x) => x.id === first.id)!.replaced_by, second.id)
  })
  test('a moved date whose only sibling was already superseded is "created", not "replaced"', async () => {
    const f = fake([{ ...live, replaced_by: 'gone' }])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-11-15', documentId: DOC })
    assert.equal(r.outcome, 'created', 'nothing live was replaced')
    assert.deepEqual(liveFor(f.rows, DOC, 'Permit expires').map((x) => x.id), [r.id])
  })
})

describe('proposeDate — the owner\'s two rules, 15 October', () => {
  test('(a) a SUPERSEDED date comes back when the newest reading finds it again', async () => {
    // 15 November was superseded by 18 July; today's reading says 15 November again.
    const f = fake([
      { id: 'nov', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-11-15', status: 'proposed', replaced_by: 'jul' },
      { id: 'jul', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-07-18', status: 'confirmed' },
    ])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-11-15', documentId: DOC })
    assert.deepEqual(r, { id: 'nov', outcome: 'revived' })
    const nov = f.rows.find((x) => x.id === 'nov')!
    assert.equal(nov.replaced_by, null, 'its replaced_by is cleared')
    assert.equal(nov.status, 'proposed', 'and it comes back as a proposal, for a person to confirm')
    assert.equal(f.rows.find((x) => x.id === 'jul')!.replaced_by, 'nov', 'the row that had replaced it is now replaced BY it')
    assert.equal(f.rows.length, 2, 'no new row')
    assert.deepEqual(liveFor(f.rows, DOC, 'Permit expires').map((x) => x.id), ['nov'])
  })
  test('(a) reviving supersedes EVERY other live sibling, so one row is live', async () => {
    const f = fake([
      { id: 'nov', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-11-15', status: 'proposed', replaced_by: 'jul' },
      { id: 'jul', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-07-18', status: 'proposed' },
      { id: 'mar', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2028-03-01', status: 'proposed' },
    ])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-11-15', documentId: DOC })
    assert.equal(r.outcome, 'revived')
    assert.deepEqual(liveFor(f.rows, DOC, 'Permit expires').map((x) => x.id), ['nov'])
    assert.equal(f.rows.find((x) => x.id === 'mar')!.replaced_by, 'nov')
  })
  test('(b) a date a PERSON dismissed never comes back, whatever the reading says', async () => {
    const f = fake([{ id: 'old', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-01-01', status: 'dismissed', dismissed_by: 'user-9', dismissed_reason: 'this permit was surrendered' }])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-01-01', documentId: DOC })
    assert.deepEqual(r, { id: 'old', outcome: 'existing' })
    const old = f.rows.find((x) => x.id === 'old')!
    assert.equal(old.status, 'dismissed', 'still dismissed')
    assert.equal(old.dismissed_by, 'user-9', 'and still names who removed it')
    assert.equal(f.rows.length, 1, 'and no second row was created beside it')
    assert.deepEqual(f.log, [], 'nothing was written at all')
  })
  test('(b) a dismissal outranks a superseding: dismissed AND replaced stays dismissed', async () => {
    // The row a person removed must not be revived by the replaced_by branch.
    const f = fake([{ id: 'old', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-01-01', status: 'dismissed', dismissed_by: 'user-9', replaced_by: 'other' }])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-01-01', documentId: DOC })
    assert.equal(r.outcome, 'existing')
    assert.equal(f.rows[0].replaced_by, 'other', 'untouched')
    assert.deepEqual(f.log, [])
  })
  test('(b) a dismissed sibling is never superseded when a new date moves in', async () => {
    const f = fake([
      { id: 'gone', company_id: CO, document_id: DOC, source: 'document', title: 'Permit expires', due_date: '2027-01-01', status: 'dismissed', dismissed_by: 'user-9' },
    ])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-11-15', documentId: DOC })
    assert.equal(r.outcome, 'created', 'nothing live was there to replace')
    assert.equal(f.rows.find((x) => x.id === 'gone')!.replaced_by, null, 'a person\'s row is left exactly as they left it')
  })
})

// -------------------------------------------------------------------------------------------
describe('confirmDate', () => {
  const row = { id: 'd1', company_id: CO, status: 'proposed', title: 'x', due_date: '2027-01-01' }
  test('a proposed date becomes confirmed, naming who and when', async () => {
    const f = fake([{ ...row }])
    const r = await confirmDate(f.db, 'd1', 'user-7')
    assert.equal(r.status, 200)
    assert.equal(f.rows[0].status, 'confirmed')
    assert.equal(f.rows[0].confirmed_by, 'user-7')
    assert.ok(f.rows[0].confirmed_at)
  })
  test('a REMOVED date is not confirmed back into existence; the words say what to do', async () => {
    const f = fake([{ ...row, status: 'dismissed', dismissed_by: 'user-9' }])
    const r = await confirmDate(f.db, 'd1', 'user-7')
    assert.equal(r.status, 409)
    assert.match(String(r.json.error), /Add it again if you need it back/)
    assert.equal(f.rows[0].status, 'dismissed', 'and nothing was written')
  })
  test('an unknown id is 404, never 403, so ids cannot be probed; no id is 400', async () => {
    assert.equal((await confirmDate(fake().db, 'nope', 'u')).status, 404)
    assert.equal((await confirmDate(fake().db, '', 'u')).status, 400)
  })
})

describe('dismissDate', () => {
  const row = { id: 'd1', company_id: CO, status: 'proposed', title: 'x', due_date: '2027-01-01' }
  test('a reason is required — the thing that stops the next reading proposing it again', async () => {
    const f = fake([{ ...row }])
    for (const reason of ['', '   ']) {
      const r = await dismissDate(f.db, 'd1', 'user-9', reason)
      assert.equal(r.status, 400)
      assert.match(String(r.json.error), /why this date is not right/)
    }
    assert.equal(f.rows[0].status, 'proposed', 'nothing was written')
  })
  test('with a reason: dismissed, with who, when and the reason, trimmed and capped', async () => {
    const f = fake([{ ...row }])
    const r = await dismissDate(f.db, 'd1', 'user-9', '  this permit was surrendered  ')
    assert.equal(r.status, 200)
    assert.equal(f.rows[0].status, 'dismissed')
    assert.equal(f.rows[0].dismissed_by, 'user-9')
    assert.ok(f.rows[0].dismissed_at)
    assert.equal(f.rows[0].dismissed_reason, 'this permit was surrendered')
    const g = fake([{ ...row }])
    await dismissDate(g.db, 'd1', 'user-9', 'x'.repeat(3000))
    assert.equal(String(g.rows[0].dismissed_reason).length, 2000)
  })
  test('an unknown id is 404; no id is 400', async () => {
    assert.equal((await dismissDate(fake().db, 'nope', 'u', 'r')).status, 404)
    assert.equal((await dismissDate(fake().db, '', 'u', 'r')).status, 400)
  })
})

describe('setPeriod', () => {
  const row = { id: 'd1', company_id: CO, status: 'proposed', recurs: true, title: 'x', due_date: '2027-01-01' }
  test('every one of the five is accepted and stored', async () => {
    for (const p of PERIODS) {
      const f = fake([{ ...row }])
      const r = await setPeriod(f.db, 'd1', p)
      assert.equal(r.status, 200, p)
      assert.equal(f.rows[0].period, p)
    }
  })
  test('null and "" clear it — "repeats, how often not known yet" is a real answer (decision 23)', async () => {
    for (const p of [null, '']) {
      const f = fake([{ ...row, period: 'year' }])
      const r = await setPeriod(f.db, 'd1', p)
      assert.equal(r.status, 200)
      assert.equal(f.rows[0].period, null)
    }
  })
  test('the old vocabulary is refused in plain words, and nothing is written', async () => {
    const f = fake([{ ...row }])
    const r = await setPeriod(f.db, 'd1', 'annually')
    assert.equal(r.status, 400)
    assert.match(String(r.json.error), /is not how often a date can repeat/)
    assert.equal(f.rows[0].period, undefined)
  })
  test('an unknown id is 404; no id is 400', async () => {
    assert.equal((await setPeriod(fake().db, 'nope', 'year')).status, 404)
    assert.equal((await setPeriod(fake().db, '', 'year')).status, 400)
  })
})

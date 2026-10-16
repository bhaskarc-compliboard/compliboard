/**
 * `lib/calendarDates.ts` — every branch of `proposeDate` and the three things a person does to a
 * date, against a stand-in client. Calendar step 5 (`docs/CALENDAR-PLAN.md` §2.6, decisions 11, 13,
 * 23, and the owner's two rules of 15 October: a superseded date comes back, a dismissed one never
 * does).
 *
 * THE INVARIANT EVERY DEDUPE TEST ASSERTS: at most ONE live row per (document, lower(title)), live
 * meaning `status in ('proposed','confirmed') and replaced_by is null`. The database holds the
 * other half — the partial unique index refuses the same date twice — and no constraint can see
 * this half.
 *
 * *** AND STEP 6b's RULE, decision 29: THE CURRENT READING WINS. *** The last three describe
 * blocks are the withdrawal — a reading that stops saying a date withdraws it, a person's decision
 * outranks a re-read either way, and a withdrawn date comes back when a later reading says it
 * again. `liveFor` below moved from `dismissed_by` to `status` with the library: the FK is
 * `ON DELETE SET NULL`, so a test written against `dismissed_by` would pass while the rule it
 * stands for expires the day somebody deletes a user.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  proposeDate, confirmDate, dismissDate, setPeriod,
  withdrawUnseenDocumentDates, withdrawAuditDatesNotMatchedBy,
  PERIODS, SOURCES, STATUSES, CONFIRMED_SOURCES, normaliseTitle,
} from '../../lib/calendarDates.ts'

type Row = Record<string, unknown>

/**
 * A stand-in Supabase client over an array of rows. Records every write so a test can read it.
 *
 * *** `.in()` IS KEYED ON ITS COLUMN, AND IT WAS NOT — fixed by Calendar step 6b. ***
 * It read `in(_k, v)` and filtered on `id` whatever column it was given, which was invisible while
 * every caller passed `'id'`. Step 6b's audit rule calls `.in('audit_finding_id', …)` and
 * `.in('section_id', …)`, and the old double would have matched the wrong rows and reported a
 * passing test — a hole in the instrument, found while planning its first use rather than by it.
 *
 * *** AND IT IS TABLE-AWARE for the same reason. *** `from(_table)` ignored its table and served
 * one array, which was true enough while `proposeDate` only ever touched `calendar_events`.
 * `withdrawAuditDatesNotMatchedBy` reads four tables, and a double that served calendar rows for
 * `audit_findings` would prove nothing. `fake(rows)` is unchanged for every existing test; the
 * second argument adds the other tables.
 */
function fake(initial: Row[] = [], others: Record<string, Row[]> = {}) {
  const rows: Row[] = initial.map((r) =>
    ({ due_date: null, status: 'proposed', dismissed_by: null, replaced_by: null, withdrawn_at: null, ...r }))
  const tables: Record<string, Row[]> = { calendar_events: rows, ...others }
  const log: string[] = []
  let n = 0
  function from(table: string) {
    const store: Row[] = tables[table] ?? (tables[table] = [])
    const eqs: Row = {}
    const ins: Array<[string, unknown[]]> = []
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Row = {}
    const hits = () => store.filter((r) =>
      Object.entries(eqs).every(([k, v]) => (r[k] ?? null) === v)
      && ins.every(([k, v]) => v.includes(r[k] as unknown)))
    function apply() {
      if (mode === 'insert') {
        const row: Row = { id: `id${++n}`, due_date: null, status: 'proposed',
                           dismissed_by: null, replaced_by: null, withdrawn_at: null, ...payload }
        store.push(row)
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
      in(k: string, v: unknown[]) { ins.push([k, v]); return q },
      insert(p: Row) { mode = 'insert'; payload = p; return q },
      update(p: Row) { mode = 'update'; payload = p; return q },
      single() { const r = apply(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }) },
      maybeSingle() { const r = apply(); return Promise.resolve({ data: r.data[0] ?? null, error: r.error }) },
      then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) { return Promise.resolve(apply()).then(res, rej) },
    }
    return q
  }
  return { db: { from } as never, rows, log, tables }
}

/** Live as `calendar_v` and `isLive` both read it since step 6b: by STATUS, not by `dismissed_by`. */
const isLiveRow = (r: Row) =>
  r.status !== 'dismissed' && r.status !== 'withdrawn' && !r.replaced_by

/** The invariant, as a function, so every dedupe test can end with it. */
const liveFor = (rows: Row[], documentId: string, title: string) => rows.filter((r) =>
  r.document_id === documentId && normaliseTitle(String(r.title)) === normaliseTitle(title)
  && isLiveRow(r))

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

describe('proposeDate — an AUDIT date is deduped in code, because no index can be (step 6)', () => {
  const audit = { companyId: CO, source: 'audit' as const, title: 'Annual report', dueOn: '2027-02-15', recurs: false }
  const live = { id: 'old', company_id: CO, source: 'audit', title: 'Annual report',
                 due_date: '2027-02-15', status: 'proposed', audit_finding_id: 'finding-1' }

  test('the first audit to find a date creates it, proposed, naming the finding', async () => {
    const f = fake()
    const r = await proposeDate(f.db, { ...audit, auditFindingId: 'finding-1' })
    assert.equal(r.outcome, 'created')
    assert.equal(f.rows[0].status, 'proposed')
    assert.equal(f.rows[0].source, 'audit')
    assert.equal(f.rows[0].audit_finding_id, 'finding-1')
  })

  test('A SECOND AUDIT FINDING THE SAME DATE IS "existing", AND MOVES audit_finding_id TO IT', async () => {
    // "The permit expires on 15 November" found by three DEQ runs is ONE date, not three — and the
    // drawer must open the audit the person last ran.
    const f = fake([{ ...live }])
    const r = await proposeDate(f.db, { ...audit, auditFindingId: 'finding-2' })
    assert.deepEqual(r, { id: 'old', outcome: 'existing' })
    assert.equal(f.rows.length, 1, 'no second row')
    assert.equal(f.rows[0].audit_finding_id, 'finding-2', 'the pointer moved to the newest finding')
    assert.equal(f.rows[0].status, 'proposed', 'and nothing else about the row changed')
  })

  test('...and the match is case-insensitive, as the document rule is', async () => {
    const f = fake([{ ...live }])
    const r = await proposeDate(f.db, { ...audit, title: 'ANNUAL REPORT', auditFindingId: 'finding-2' })
    assert.equal(r.outcome, 'existing')
    assert.equal(f.rows.length, 1)
  })

  test('a DIFFERENT day is a different date: audits do not supersede, they coexist', async () => {
    // Two real obligations can share a title and differ by day — an annual report for 2027 and for
    // 2028. A document date MOVES (one permit, one expiry); an audit finding is an observation.
    const f = fake([{ ...live }])
    const r = await proposeDate(f.db, { ...audit, dueOn: '2028-02-15', auditFindingId: 'finding-2' })
    assert.equal(r.outcome, 'created')
    assert.equal(f.rows.length, 2)
    assert.equal(f.rows.find((x) => x.id === 'old')!.replaced_by, null, 'the earlier one is NOT superseded')
  })

  test('an UNDATED recurring audit date dedupes against another undated one', async () => {
    const f = fake([{ id: 'old', company_id: CO, source: 'audit', title: 'Annual permit fee',
                      due_date: null, status: 'proposed', audit_finding_id: 'finding-1' }])
    const r = await proposeDate(f.db, { companyId: CO, source: 'audit', title: 'Annual permit fee',
      dueOn: null, recurs: true, auditFindingId: 'finding-2' })
    assert.deepEqual(r, { id: 'old', outcome: 'existing' })
    assert.equal(f.rows[0].audit_finding_id, 'finding-2')
  })

  test('a DISMISSED audit date is "existing" AND its audit_finding_id is NOT moved', async () => {
    // Re-pointing a row a person removed would quietly revive it on every screen that reads the
    // finding. The dismissal outranks the newer audit.
    const f = fake([{ ...live, status: 'dismissed', dismissed_by: 'user-9',
                      dismissed_reason: 'we surrendered that permit' }])
    const r = await proposeDate(f.db, { ...audit, auditFindingId: 'finding-2' })
    assert.deepEqual(r, { id: 'old', outcome: 'existing' })
    assert.equal(f.rows[0].audit_finding_id, 'finding-1', 'untouched')
    assert.equal(f.rows[0].status, 'dismissed')
    assert.deepEqual(f.log, [], 'nothing was written at all')
  })

  test('a SUPERSEDED audit row is not matched: a new one is created', async () => {
    // `replaced_by` means history. Only a live row counts as the same date.
    const f = fake([{ ...live, replaced_by: 'something' }])
    const r = await proposeDate(f.db, { ...audit, auditFindingId: 'finding-2' })
    assert.equal(r.outcome, 'created')
    assert.equal(f.rows.length, 2)
  })

  test("an audit date never matches a DOCUMENT row with the same title and day", async () => {
    // Two different pieces of evidence for one obligation, and the drawer opens each differently:
    // one shows the document's report, one shows the audit's.
    const f = fake([{ id: 'doc-row', company_id: CO, source: 'document', document_id: DOC,
                      title: 'Annual report', due_date: '2027-02-15', status: 'proposed' }])
    const r = await proposeDate(f.db, { ...audit, auditFindingId: 'finding-1' })
    assert.equal(r.outcome, 'created')
    assert.equal(f.rows.length, 2)
  })

  test('an audit date with NO finding id still dedupes, and writes nothing on a match', async () => {
    const f = fake([{ ...live }])
    const r = await proposeDate(f.db, { ...audit })
    assert.deepEqual(r, { id: 'old', outcome: 'existing' })
    assert.equal(f.rows[0].audit_finding_id, 'finding-1')
    assert.deepEqual(f.log, [])
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

// ===========================================================================================
// STEP 6b — THE CURRENT READING WINS (decision 29, the owner, 15 October 2026)
// ===========================================================================================
// The measurement behind it is in migration 075's header: three Opus 5.5 readings of one
// certificate turned three obligations into NINE live rows, `created 3, existing 0` three times
// out of three. Nothing in `proposeDate` was wrong — a document date's identity is its TITLE, the
// title is prose, and the scan prompt is never shown the dates already on file.
// ===========================================================================================

const docRow = (id: string, title: string, due: string | null, extra: Row = {}): Row => ({
  id, company_id: CO, document_id: DOC, source: 'document',
  title, due_date: due, status: 'proposed', ...extra,
})

describe('a reading that stops saying a date withdraws it', () => {
  test('the fourth status word is the migration\'s, and there is no fifth', () => {
    assert.deepEqual([...STATUSES], ['proposed', 'confirmed', 'dismissed', 'withdrawn'])
  })

  test('a proposed date this reading did not propose again is WITHDRAWN, and stamped', async () => {
    // Two rows for one obligation, which is the defect: "Extinguisher service due" and "Service
    // the extinguishers" are the same sentence read twice. This reading said only the first.
    const f = fake([
      docRow('old-a', 'Extinguisher service due', '2026-08-20'),
      docRow('old-b', 'Service the extinguishers', '2026-08-20'),
    ])
    const gone = await withdrawUnseenDocumentDates(f.db, CO, DOC, ['old-a'])
    assert.deepEqual(gone, ['old-b'], 'it reports what it withdrew, read back off the row')

    const b = f.rows.find((r) => r.id === 'old-b')!
    assert.equal(b.status, 'withdrawn')
    assert.ok(b.withdrawn_at, 'and when — the row says it out loud, not a code comment')
    assert.equal(b.dismissed_by, null, 'a withdrawal is NOT a person\'s dismissal')
    assert.equal(f.rows.find((r) => r.id === 'old-a')!.status, 'proposed', 'this reading\'s own row stands')

    assert.equal(liveFor(f.rows, DOC, 'Service the extinguishers').length, 0)
    assert.equal(liveFor(f.rows, DOC, 'Extinguisher service due').length, 1)
  })

  test('a reading that found NO dates withdraws all of them — the case the hoist exists for', async () => {
    const f = fake([docRow('a', 'Permit expires', '2027-01-01'), docRow('b', 'Fee due', '2027-02-01')])
    const gone = await withdrawUnseenDocumentDates(f.db, CO, DOC, [])
    assert.deepEqual(gone.sort(), ['a', 'b'])
    assert.equal(f.rows.filter((r) => r.status === 'withdrawn').length, 2)
  })

  test('ANOTHER DOCUMENT\'S dates are never touched: only two DOCUMENTS can disagree', async () => {
    const f = fake([
      docRow('mine', 'Permit expires', '2027-01-01'),
      docRow('theirs', 'Permit expires', '2027-01-01', { document_id: 'doc-2' }),
    ])
    assert.deepEqual(await withdrawUnseenDocumentDates(f.db, CO, DOC, []), ['mine'])
    assert.equal(f.rows.find((r) => r.id === 'theirs')!.status, 'proposed')
  })

  test('a row of ANOTHER COMPANY with the same document id is out of reach', async () => {
    const f = fake([docRow('other-co', 'Permit expires', '2027-01-01', { company_id: 'co-2' })])
    assert.deepEqual(await withdrawUnseenDocumentDates(f.db, CO, DOC, []), [])
    assert.equal(f.rows[0].status, 'proposed')
  })

  test('a date from another SOURCE citing this document is not a document date', async () => {
    // The partial unique index's own WHERE, and the same reason `siblingsOf` carries it.
    const f = fake([docRow('from-chat', 'Permit expires', '2027-01-01', { source: 'rule' })])
    assert.deepEqual(await withdrawUnseenDocumentDates(f.db, CO, DOC, []), [])
    assert.equal(f.rows[0].status, 'proposed')
  })

  test('a superseded row is left alone — `replaced_by` is a precise reason already', async () => {
    const f = fake([docRow('old', 'Permit expires', '2027-01-01', { replaced_by: 'new' })])
    assert.deepEqual(await withdrawUnseenDocumentDates(f.db, CO, DOC, []), [])
    assert.equal(f.rows[0].status, 'proposed')
    assert.equal(f.rows[0].withdrawn_at, null)
  })

  test('nothing to withdraw writes nothing at all', async () => {
    const f = fake([docRow('a', 'Permit expires', '2027-01-01')])
    assert.deepEqual(await withdrawUnseenDocumentDates(f.db, CO, DOC, ['a']), [])
    assert.equal(f.log.filter((l) => l.startsWith('update')).length, 0, 'no UPDATE is sent')
  })

  test('the UPDATE restates `status = proposed`, so a confirmation in the gap survives', async () => {
    // *** SHOW THE INPUT, NOT THE CONCLUSION. *** This is the one window code can close and data
    // cannot: the row is proposed when the select reads it and confirmed by the time the write
    // lands, because somebody pressed Confirm in between. The guard is on the UPDATE, so the
    // write misses it — and the only way to prove the guard is there is to read the query built.
    const applied: Array<{ eqs: Record<string, unknown>; ids: unknown[]; payload: Record<string, unknown> }> = []
    let selected = false
    const db = {
      from() {
        const eqs: Record<string, unknown> = {}
        let ids: unknown[] = []
        let payload: Record<string, unknown> | null = null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q: any = {
          select: () => q,
          eq: (k: string, v: unknown) => { eqs[k] = v; return q },
          in: (_k: string, v: unknown[]) => { ids = v; return q },
          update: (p: Record<string, unknown>) => { payload = p; return q },
          then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
            if (payload) {
              applied.push({ eqs: { ...eqs }, ids, payload })
              // Nothing comes back: by now the row is 'confirmed' and the filter missed it.
              return Promise.resolve({ data: [], error: null }).then(res, rej)
            }
            selected = true
            return Promise.resolve({ data: [{ id: 'x', replaced_by: null }], error: null }).then(res, rej)
          },
        }
        return q
      },
    } as never
    const gone = await withdrawUnseenDocumentDates(db, CO, DOC, [])
    assert.ok(selected, 'the select ran')
    assert.equal(applied.length, 1, 'exactly one UPDATE')
    assert.equal(applied[0].eqs.status, 'proposed', 'the UPDATE itself filters on proposed, not only the select')
    assert.deepEqual(applied[0].ids, ['x'])
    assert.equal(applied[0].payload.status, 'withdrawn')
    assert.ok(applied[0].payload.withdrawn_at)
    assert.deepEqual(gone, [], 'and it reports nothing withdrawn, because nothing was')
  })
})

describe('a person\'s decision outranks a re-read, in both directions', () => {
  test('a CONFIRMED date is never withdrawn', async () => {
    const f = fake([docRow('yes', 'Permit expires', '2027-01-01',
      { status: 'confirmed', confirmed_by: 'user-9', confirmed_at: '2026-10-01T00:00:00.000Z' })])
    assert.deepEqual(await withdrawUnseenDocumentDates(f.db, CO, DOC, []), [])
    const row = f.rows[0]
    assert.equal(row.status, 'confirmed')
    assert.equal(row.withdrawn_at, null)
    assert.equal(row.confirmed_by, 'user-9', 'and it still names who said so')
    assert.equal(liveFor(f.rows, DOC, 'Permit expires').length, 1, 'it is still on the calendar')
  })

  test('a PERSON-DISMISSED date stays dismissed — it is not withdrawn and not re-proposed', async () => {
    const f = fake([docRow('no', 'Permit expires', '2027-01-01',
      { status: 'dismissed', dismissed_by: 'user-9', dismissed_reason: 'this permit was surrendered' })])
    assert.deepEqual(await withdrawUnseenDocumentDates(f.db, CO, DOC, []), [],
      'the withdrawal does not reach it')

    // ...and the next reading finding the same line again does not revive it (rule b).
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-01-01', documentId: DOC })
    assert.deepEqual(r, { id: 'no', outcome: 'existing' })
    const row = f.rows.find((x) => x.id === 'no')!
    assert.equal(row.status, 'dismissed')
    assert.equal(row.withdrawn_at, null, 'and it is not quietly relabelled as a withdrawal')
    assert.equal(row.dismissed_reason, 'this permit was surrendered')
    assert.equal(f.rows.length, 1, 'no second row beside it')
    assert.equal(liveFor(f.rows, DOC, 'Permit expires').length, 0)
  })

  test('confirming a row the newest reading withdrew clears the stamp with the decision', async () => {
    const f = fake([docRow('back', 'Permit expires', '2027-01-01',
      { status: 'withdrawn', withdrawn_at: '2026-10-15T00:00:00.000Z' })])
    const out = await confirmDate(f.db, 'back', 'user-9')
    assert.equal(out.status, 200)
    const row = f.rows[0]
    assert.equal(row.status, 'confirmed')
    assert.equal(row.withdrawn_at, null, 'a row cannot say it is both confirmed and withdrawn')
    assert.equal(row.confirmed_by, 'user-9')
  })

  test('dismissing one does the same, so the reason is the only thing left on it', async () => {
    const f = fake([docRow('bin', 'Permit expires', '2027-01-01',
      { status: 'withdrawn', withdrawn_at: '2026-10-15T00:00:00.000Z' })])
    const out = await dismissDate(f.db, 'bin', 'user-9', 'we gave this permit up')
    assert.equal(out.status, 200)
    assert.equal(f.rows[0].status, 'dismissed')
    assert.equal(f.rows[0].withdrawn_at, null)
    assert.equal(f.rows[0].dismissed_reason, 'we gave this permit up')
  })
})

describe('a withdrawn date comes back when a later reading says it again', () => {
  test('the same title and day revives it: proposed, unstamped, and no second row', async () => {
    const f = fake([docRow('gone', 'Permit expires', '2027-01-01',
      { status: 'withdrawn', withdrawn_at: '2026-10-15T00:00:00.000Z' })])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-01-01', documentId: DOC })
    assert.deepEqual(r, { id: 'gone', outcome: 'revived' })
    const row = f.rows[0]
    assert.equal(row.status, 'proposed', 'a person confirms it, as they would any reading')
    assert.equal(row.withdrawn_at, null)
    assert.equal(row.replaced_by, null)
    assert.equal(f.rows.length, 1, 'revived, not duplicated — the index keeps its key slot')
    assert.equal(liveFor(f.rows, DOC, 'Permit expires').length, 1)
  })

  test('a DIFFERENT day does not revive it: the new date is created and nothing resurrects', async () => {
    const f = fake([docRow('gone', 'Permit expires', '2027-01-01',
      { status: 'withdrawn', withdrawn_at: '2026-10-15T00:00:00.000Z' })])
    const r = await proposeDate(f.db, { ...base, dueOn: '2027-06-30', documentId: DOC })
    assert.equal(r.outcome, 'created', 'nothing was live, so this is not a REPLACEMENT')
    assert.equal(f.rows.find((x) => x.id === 'gone')!.status, 'withdrawn',
      'and a withdrawn row is not superseded on top of being withdrawn')
    assert.equal(f.rows.find((x) => x.id === 'gone')!.replaced_by, null)
    assert.equal(liveFor(f.rows, DOC, 'Permit expires').length, 1)
  })

  test('the title is matched as the index matches it — trimmed and case-folded', async () => {
    const f = fake([docRow('gone', 'PERMIT  expires', '2027-01-01',
      { status: 'withdrawn', withdrawn_at: '2026-10-15T00:00:00.000Z' })])
    const r = await proposeDate(f.db, { ...base, title: '  permit  expires ', dueOn: '2027-01-01', documentId: DOC })
    assert.equal(r.outcome, 'revived')
    assert.equal(f.rows.length, 1)
  })
})

describe('a finished audit of an agency withdraws that agency\'s earlier dates it did not match', () => {
  // *** "DID NOT MATCH" IS RESOLVED FROM THE DATA, NOT FROM A SET HELD IN MEMORY. ***
  // A run is many sections across many route invocations, so there is no keep list to collect.
  // There does not need to be: `proposeDate`'s audit branch RE-POINTS `audit_finding_id` to the
  // newest finding whenever it matches, so a live audit row still pointing at a finding from an
  // EARLIER run of an agency this run just finished is precisely a row this run did not match.
  const NOW = '2026-10-15T12:00:00.000Z'
  const THEN = '2026-09-01T09:00:00.000Z'

  const world = (over: { runKind?: string; runAt?: string; sectionTitle?: string
                         findingRun?: string } = {}) => fake(
    [
      { id: 'c-deq', company_id: CO, source: 'audit', status: 'proposed', title: 'Permit renewal',
        due_date: '2027-03-01', audit_finding_id: 'f-deq' },
      { id: 'c-osha', company_id: CO, source: 'audit', status: 'proposed', title: 'Respirator fit testing',
        due_date: '2027-04-01', audit_finding_id: 'f-osha' },
    ],
    {
      audit_findings: [
        { id: 'f-deq', run_id: over.findingRun ?? 'run-deq-sep', section_id: 's-deq' },
        { id: 'f-osha', run_id: 'run-osha-sep', section_id: 's-osha' },
      ],
      audit_sections: [
        { id: 's-deq', title: over.sectionTitle ?? 'Oregon DEQ' },
        { id: 's-osha', title: 'Oregon OSHA' },
      ],
      audit_runs: [
        { id: 'run-deq-sep', kind: over.runKind ?? 'agency', created_at: over.runAt ?? THEN },
        { id: 'run-osha-sep', kind: 'agency', created_at: THEN },
      ],
    })

  const finish = (f: ReturnType<typeof world>, agencies: string[], runId = 'run-deq-oct') =>
    withdrawAuditDatesNotMatchedBy(f.db, { companyId: CO, agencies, runId, runCreatedAt: NOW })

  test('the SAME agency\'s earlier date is withdrawn, and ANOTHER agency\'s is not', async () => {
    const f = world()
    assert.deepEqual(await finish(f, ['Oregon DEQ']), ['c-deq'])
    assert.equal(f.rows.find((r) => r.id === 'c-deq')!.status, 'withdrawn')
    assert.ok(f.rows.find((r) => r.id === 'c-deq')!.withdrawn_at)
    // The whole point of the agency filter: a DEQ audit says nothing about an OSHA obligation.
    assert.equal(f.rows.find((r) => r.id === 'c-osha')!.status, 'proposed')
    assert.equal(f.rows.find((r) => r.id === 'c-osha')!.withdrawn_at, null)
  })

  test('a run of a DIFFERENT agency withdraws neither', async () => {
    const f = world()
    assert.deepEqual(await finish(f, ['Oregon Fire Marshal']), [])
    assert.deepEqual(f.rows.map((r) => r.status), ['proposed', 'proposed'])
  })

  test('both agencies in one run withdraw both', async () => {
    const f = world()
    assert.deepEqual((await finish(f, ['Oregon DEQ', 'Oregon OSHA'])).sort(), ['c-deq', 'c-osha'])
  })

  test('a TEMPLATE run\'s section titled like an agency withdraws nothing', async () => {
    // It had to come from the code: staging holds only agency runs, so no measurement would have
    // caught this. A template's sections are checklist sections (`createRun`), not agencies.
    const f = world({ runKind: 'template' })
    assert.deepEqual(await finish(f, ['Oregon DEQ']), [])
    assert.equal(f.rows.find((r) => r.id === 'c-deq')!.status, 'proposed')
  })

  test('this run\'s OWN rows are not withdrawn by itself', async () => {
    const f = world({ findingRun: 'run-deq-oct', runAt: NOW })
    f.tables.audit_runs.push({ id: 'run-deq-oct', kind: 'agency', created_at: NOW })
    assert.deepEqual(await finish(f, ['Oregon DEQ']), [])
    assert.equal(f.rows.find((r) => r.id === 'c-deq')!.status, 'proposed')
  })

  test('a LATER run\'s rows are not withdrawn by an earlier one finishing late', async () => {
    const f = world({ runAt: '2026-11-20T00:00:00.000Z' })
    assert.deepEqual(await finish(f, ['Oregon DEQ']), [])
    assert.equal(f.rows.find((r) => r.id === 'c-deq')!.status, 'proposed')
  })

  test('the agency is matched trimmed and case-folded, as every title in this file is', async () => {
    const f = world({ sectionTitle: '  oregon deq ' })
    assert.deepEqual(await finish(f, ['Oregon DEQ']), ['c-deq'])
  })

  test('a CONFIRMED audit date is never withdrawn, and a dismissed one stays dismissed', async () => {
    const f = world()
    f.rows.find((r) => r.id === 'c-deq')!.status = 'confirmed'
    f.rows.find((r) => r.id === 'c-osha')!.status = 'dismissed'
    f.rows.find((r) => r.id === 'c-osha')!.dismissed_by = 'user-9'
    assert.deepEqual(await finish(f, ['Oregon DEQ', 'Oregon OSHA']), [])
    assert.equal(f.rows.find((r) => r.id === 'c-deq')!.status, 'confirmed')
    assert.equal(f.rows.find((r) => r.id === 'c-osha')!.status, 'dismissed')
  })

  test('a run that completed NO section withdraws nothing, and asks the database nothing', async () => {
    // The audit twin of the `could_not_read` guard: silence from a reading that never happened is
    // not a withdrawal. The caller passes only its DONE sections, so this is an empty list.
    const f = world()
    assert.deepEqual(await finish(f, []), [])
    assert.equal(f.log.length, 0, 'not one query')
  })

  test('a row with no finding behind it is left alone rather than guessed about', async () => {
    const f = world()
    f.rows.push({ id: 'c-orphan', company_id: CO, source: 'audit', status: 'proposed',
                  title: 'Something', due_date: '2027-05-01', audit_finding_id: null,
                  dismissed_by: null, replaced_by: null, withdrawn_at: null })
    assert.deepEqual(await finish(f, ['Oregon DEQ']), ['c-deq'])
    assert.equal(f.rows.find((r) => r.id === 'c-orphan')!.status, 'proposed')
  })

  test('and a withdrawn audit date comes back when a later run of that agency says it again', async () => {
    const f = world()
    const row = f.rows.find((r) => r.id === 'c-deq')!
    row.status = 'withdrawn'
    row.withdrawn_at = '2026-10-15T00:00:00.000Z'
    const r = await proposeDate(f.db, {
      companyId: CO, source: 'audit', title: 'Permit renewal', dueOn: '2027-03-01',
      recurs: false, auditFindingId: 'f-deq-oct',
    })
    assert.deepEqual(r, { id: 'c-deq', outcome: 'revived' })
    assert.equal(row.status, 'proposed')
    assert.equal(row.withdrawn_at, null)
    assert.equal(row.audit_finding_id, 'f-deq-oct', 'and it points at the newest finding')
    assert.equal(f.rows.filter((x) => x.title === 'Permit renewal').length, 1, 'one row, not two')
  })
})

describe('a reader hides a withdrawn row — calendar_v (migration 075)', () => {
  // *** WHAT A UNIT TEST CAN HONESTLY PROVE HERE, AND WHAT IT CANNOT. ***
  // It cannot query a view. The live proof is migration 075's own verify block — §5.4 reads three
  // of the four statuses out of `calendar_v` and proves each of the three PRESENT by id, so "3
  // rows" cannot be three copies of one — and `npm run check:live`, which does it again as a
  // signed-in user against staging.
  //
  // What this test refuses is the regression that will actually be attempted: `create or replace
  // view` can only APPEND columns, so every later step that touches `calendar_v` re-emits the
  // whole definition, and the filter is one line a re-emit can silently drop. Steps 8 and 12 both
  // plan to touch it. So the NEWEST migration that defines the view must carry the line.
  test('the newest migration defining calendar_v filters withdrawn rows out', () => {
    const dir = new URL('../../supabase/migrations/', import.meta.url)
    const defining = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
      .filter((f) => /create\s+or\s+replace\s+view\s+public\.calendar_v\b/i
        .test(readFileSync(new URL(f, dir), 'utf8')))
    assert.ok(defining.length >= 1, 'some migration must define calendar_v')

    const newest = defining[defining.length - 1]
    // *** THE COMMENTS COME OFF FIRST, AND THE FIRST RUN OF THIS TEST IS WHY. *** It cut the
    // statement at the `;` inside "`concat_ws` skips a null part rather than nulling the whole
    // string;" — a prose semicolon in a `--` comment, 70 lines above the real end of the
    // statement — and reported the filter missing from a migration that carries it. A check that
    // cannot see the whole input looks exactly like a check that found nothing (§9a).
    const sql = readFileSync(new URL(newest, dir), 'utf8')
      .split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
    const at = sql.search(/create\s+or\s+replace\s+view\s+public\.calendar_v\b/i)
    const statement = sql.slice(at, sql.indexOf(';', at) + 1)
    assert.match(statement, /from\s+public\.calendar_events\s+e/i,
      'the whole statement was read, not a fragment cut at a semicolon in a comment')
    assert.match(statement, /where\s+e\.status\s*<>\s*'withdrawn'/i,
      `${newest} re-emits calendar_v without step 6b's filter`)
  })
})

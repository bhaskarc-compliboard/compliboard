/**
 * THE ONE WRITER — `lib/calendarDates.ts`, Calendar decisions 7, 8, 9, `DECISIONS.md` §185.
 *
 * With a stand-in client over an in-memory table, in the shape `tests/unit/handbookDelete.test.ts`
 * uses. The stand-in enforces the ONE THING THE DATABASE ENFORCES THAT THIS CODE DEPENDS ON:
 * `unique (company_id, date_key)`, returning Postgres's own `23505`. A stand-in that let a duplicate
 * through would make `addDate` look correct while the real compare-and-set was never exercised.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDate, dateKey, normaliseLine, requiredLink, confirmDate, rejectDate, markDone,
  withdrawStale, siblingsOnDay, listDates, DATE_SOURCES, DATE_STATES,
} from '../../lib/calendarDates.ts'

const CO = 'co-1'
const DOC = 'doc-1'

type Row = Record<string, unknown>

/**
 * A stand-in client. `unique (company_id, date_key)` is real; so is the generated `counts_as_due`,
 * because three tests below turn on it and a stand-in that computed it differently from migration 073
 * would be testing a fiction.
 */
function fakeDb(seed: Row[] = [], opts: { viewRows?: Row[]; viewError?: string } = {}) {
  const calendar: Row[] = seed.map((r) => ({ ...r }))
  const view: Row[] = (opts.viewRows ?? []).map((r) => ({ ...r }))
  const other: Record<string, Row[]> = { documents: [{ id: DOC }] }

  /** Migration 073's generated column, in the same terms, so the tests cannot drift from the schema. */
  const board = (r: Row) =>
    r.due_date != null
    && ['not_confirmed', 'confirmed', 'done'].includes(String(r.state))
    && (r.state !== 'not_confirmed' || r.line_verified !== false)

  /** A STORED generated column: recomputed on every insert and update, so `.eq('counts_as_due', …)`
   *  filters on it exactly as the real table does. Computing it only at read time was this stand-in's
   *  first shape and it made three true tests fail — the stand-in has to be faithful about the one
   *  thing the code leans on. */
  const stamp = (r: Row) => { r.counts_as_due = board(r); return r }

  function tableFor(name: string): Row[] {
    if (name === 'calendar_events') return calendar
    if (name === 'document_dates_current_v') return view
    return (other[name] ??= [])
  }

  function query(name: string) {
    const rows = tableFor(name)
    let filtered = rows.slice()
    const api: Record<string, unknown> = {}
    const self = () => api as never
    Object.assign(api, {
      select: () => self(),
      eq: (f: string, v: unknown) => { filtered = filtered.filter((r) => r[f] === v); return self() },
      in: (f: string, vs: unknown[]) => { filtered = filtered.filter((r) => vs.includes(r[f])); return self() },
      not: (f: string, _op: string, _v: unknown) => { filtered = filtered.filter((r) => r[f] != null); return self() },
      order: () => self(),
      maybeSingle: async () => ({ data: filtered[0] ? stamp(filtered[0]) : null, error: null }),
      single: async () => ({ data: filtered[0] ? stamp(filtered[0]) : null, error: filtered[0] ? null : { message: 'no row' } }),
      then: (resolve: (v: unknown) => unknown) => resolve(
        name === 'document_dates_current_v' && opts.viewError
          ? { data: null, error: { message: opts.viewError } }
          : { data: filtered.map(stamp), error: null }),
    })
    return api
  }

  return {
    calendar,
    db: {
      from: (name: string) => ({
        ...query(name),
        insert: (row: Row) => ({
          select: () => ({
            single: async () => {
              // THE UNIQUE INDEX, for real.
              if (tableFor(name).some((r) => r.company_id === row.company_id && r.date_key === row.date_key)) {
                return { data: null, error: { code: '23505', message: 'duplicate key value' } }
              }
              const made = { id: `ev-${tableFor(name).length + 1}`, created_at: '2026-10-09T00:00:00Z', ...row }
              tableFor(name).push(made)
              return { data: stamp(made), error: null }
            },
          }),
        }),
        update: (patch: Row) => {
          let scoped = tableFor(name).slice()
          const u: Record<string, unknown> = {}
          const apply = () => { for (const r of scoped) Object.assign(r, patch); return scoped }
          Object.assign(u, {
            eq: (f: string, v: unknown) => { scoped = scoped.filter((r) => r[f] === v); return u as never },
            in: (f: string, vs: unknown[]) => { scoped = scoped.filter((r) => vs.includes(r[f])); return u as never },
            select: () => ({ single: async () => { const got = apply(); return got[0] ? { data: stamp(got[0]), error: null } : { data: null, error: { message: 'no row' } } } }),
            then: (resolve: (v: unknown) => unknown) => { apply(); return resolve({ error: null }) },
          })
          return u as never
        },
      }),
    } as never,
  }
}

const docDate = (over: Row = {}) => ({
  companyId: CO, source: 'document' as const, title: 'Permit expires', day: '2027-01-01',
  line: 'This permit expires 1 January 2027.', documentId: DOC, state: 'not_confirmed' as const, ...over,
})

describe('the key (decision 7)', () => {
  test('normaliseLine is the rule that already exists, and is capped', () => {
    assert.equal(normaliseLine('This permit expires 1 January 2027.'), 'thispermitexpires1january2027')
    assert.equal(normaliseLine('<p>Items marked N</p>'), 'itemsmarkedn')
    assert.equal(normaliseLine(null), '')
    assert.equal(normaliseLine(''), '')
    assert.equal(normaliseLine('x'.repeat(500)).length, 200)
  })

  test('THE RE-READ CASE: the title changed, the line did not, so the key did not', () => {
    // Staging's own rows (`docs/CALENDAR-MACHINERY.md` C3): one reading called it "Report any items
    // marked N to the Plant Manager", the next "Report unchecked items to Plant Manager", and the
    // source line was byte-identical. A title-based key would have made a second date.
    const line = 'Items marked N are reported to the Plant Manager by the 5th'
    const a = dateKey({ source: 'document', refId: DOC, day: null, line })
    const b = dateKey({ source: 'document', refId: DOC, day: null, line })
    assert.equal(a, b)
    assert.equal(a, `document:${DOC}:no-day:itemsmarkednarereportedtotheplantmanagerbythe5th`)
  })

  test('THE FIRE-EXTINGUISHER CASE: two obligations on one day keep two keys', () => {
    // 11-fire-extinguisher-certificate.pdf on staging: a 6-year internal maintenance and a monthly
    // visual inspection, both 2026-10-31. A (document, day) key would merge them and lose one.
    const day = '2026-10-31'
    const one = dateKey({ source: 'document', refId: DOC, day, line: '6-year internal maintenance for units W-3 and L-1' })
    const two = dateKey({ source: 'document', refId: DOC, day, line: 'Monthly visual inspection of each unit, recorded on the tag' })
    assert.notEqual(one, two)
  })

  test('a key for every source, and each names its source — 073 requires the prefix', () => {
    const cases = {
      document: dateKey({ source: 'document', refId: DOC, day: '2027-01-01', line: 'x' }),
      conversation: dateKey({ source: 'conversation', refId: 'topic-1', day: '2027-01-01', line: 'x' }),
      audit: dateKey({ source: 'audit', refId: DOC, day: '2027-01-01', line: 'x' }),
      handbook: dateKey({ source: 'handbook', refId: 'hb-1', day: '2027-01-01', line: 'x' }),
      hand: dateKey({ source: 'hand', refId: null, day: '2027-01-01', line: null, ownId: 'ev-9' }),
    }
    for (const [source, key] of Object.entries(cases)) {
      assert.ok(key.startsWith(`${source}:`), `${source} -> ${key}`)
    }
    assert.equal(cases.hand, 'hand:ev-9')
    // Every source in the module's own list is covered by this test.
    assert.deepEqual(Object.keys(cases).sort(), [...DATE_SOURCES].sort())
  })

  test('no day and an empty day can never collide', () => {
    assert.notEqual(
      dateKey({ source: 'document', refId: DOC, day: null, line: 'x' }),
      dateKey({ source: 'document', refId: DOC, day: '', line: 'x' }),
    )
    assert.ok(dateKey({ source: 'document', refId: DOC, day: null, line: 'x' }).includes(':no-day:'))
  })

  test('two hand-added dates with the same words are two dates: the person is the authority', () => {
    const a = dateKey({ source: 'hand', refId: null, day: '2027-01-01', line: 'Fee' })
    const b = dateKey({ source: 'hand', refId: null, day: '2027-01-01', line: 'Fee' })
    assert.notEqual(a, b)
  })

  test('an audit date keys on the DOCUMENT, so every run does not make a new date', () => {
    const run1 = dateKey({ source: 'audit', refId: DOC, day: '2027-03-01', line: 'Annual report' })
    const run2 = dateKey({ source: 'audit', refId: DOC, day: '2027-03-01', line: 'Annual report' })
    assert.equal(run1, run2)
  })
})

describe('requiredLink — the invariant that could not be a CHECK', () => {
  test('each source needs its own link, and hand needs none', () => {
    assert.equal(requiredLink({ source: 'document' }), 'documentId')
    assert.equal(requiredLink({ source: 'document', documentId: DOC }), null)
    assert.equal(requiredLink({ source: 'conversation' }), 'topicId')
    assert.equal(requiredLink({ source: 'conversation', topicId: 't' }), null)
    assert.equal(requiredLink({ source: 'audit' }), 'auditFindingId')
    assert.equal(requiredLink({ source: 'audit', auditFindingId: 'f' }), null)
    assert.equal(requiredLink({ source: 'handbook' }), 'handbookId')
    assert.equal(requiredLink({ source: 'handbook', handbookId: 'h' }), null)
    assert.equal(requiredLink({ source: 'hand' }), null)
  })

  test('every source in the list is covered, so a new one cannot be added unnoticed', () => {
    for (const s of DATE_SOURCES) {
      assert.doesNotThrow(() => requiredLink({ source: s }))
    }
  })

  test('addDate refuses a document date with no document, with a sentence', async () => {
    const { db, calendar } = fakeDb()
    const r = await addDate(db, { ...docDate(), documentId: null })
    assert.equal(r.created, false)
    assert.equal(r.reason, 'refused')
    assert.match((r as { error: string }).error, /document date needs documentId/)
    assert.equal(calendar.length, 0)
  })
})

describe('addDate — compare-and-set, not check-then-insert (B8)', () => {
  test('the first add creates', async () => {
    const { db, calendar } = fakeDb()
    const r = await addDate(db, docDate())
    assert.equal(r.created, true)
    assert.equal(calendar.length, 1)
    assert.equal(calendar[0].state, 'not_confirmed')
    assert.equal(calendar[0].source, 'document')
    assert.equal(calendar[0].document_id, DOC)
  })

  test('THE SECOND ADD IS "already", and writes nothing', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate())
    const r = await addDate(db, docDate({ title: 'Expiry of permit' }))   // the re-read's new title
    assert.equal(r.created, false)
    assert.equal(r.reason, 'already')
    assert.equal((r as { date: { title: string } }).date.title, 'Permit expires')  // the one that is there
    assert.equal(calendar.length, 1)
  })

  test('A REJECTED KEY IS "rejected_before" — the next reading does not raise it again (decision 6)', async () => {
    const { db, calendar } = fakeDb()
    const first = await addDate(db, docDate())
    assert.equal(first.created, true)
    await rejectDate(db, { companyId: CO, id: String(calendar[0].id), reason: 'That is the old permit.' })
    const again = await addDate(db, docDate())
    assert.equal(again.created, false)
    assert.equal(again.reason, 'rejected_before')
    assert.equal((again as { date: { rejected_reason: string } }).date.rejected_reason, 'That is the old permit.')
    assert.equal(calendar.length, 1)
  })

  test('a repeat is never defaulted to yearly (B4)', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ repeats: true }))
    assert.equal(calendar[0].is_recurring, true)
    assert.equal(calendar[0].repeats_every, null)     // *** not 'annually', not 'yearly'
  })

  test('a date with no day must repeat', async () => {
    const { db } = fakeDb()
    const bad = await addDate(db, docDate({ day: null }))
    assert.equal(bad.created, false)
    assert.match((bad as { error: string }).error, /no day must be a repeating one/)
    const ok = await addDate(db, docDate({ day: null, repeats: true }))
    assert.equal(ok.created, true)
  })

  test('a title is required and a bad state is refused', async () => {
    const { db } = fakeDb()
    assert.equal((await addDate(db, docDate({ title: '   ' }))).created, false)
    assert.equal((await addDate(db, docDate({ state: 'pending' as never }))).created, false)
    for (const s of DATE_STATES) {
      const r = await addDate(db, docDate({ state: s, line: `line ${s}` }))
      assert.equal(r.created, true, s)
    }
  })

  test('the same key in another company is another company\'s own date', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate())
    const r = await addDate(db, docDate({ companyId: 'co-2' }))
    assert.equal(r.created, true)
    assert.equal(calendar.length, 2)
  })
})

describe('the states a person sets', () => {
  test('confirm settles the day and how often, and clears a reason', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ day: null, repeats: true }))
    const id = String(calendar[0].id)
    const r = await confirmDate(db, { companyId: CO, id, day: '2026-11-05', every: 'monthly' })
    assert.equal(r.ok, true)
    assert.equal(calendar[0].state, 'confirmed')
    assert.equal(calendar[0].due_date, '2026-11-05')
    assert.equal(calendar[0].repeats_every, 'monthly')
  })

  test('a date of another company is 404, never 403', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate())
    const id = String(calendar[0].id)
    for (const r of [
      await confirmDate(db, { companyId: 'co-2', id }),
      await rejectDate(db, { companyId: 'co-2', id, reason: 'x' }),
      await markDone(db, { companyId: 'co-2', id }),
    ]) {
      assert.equal(r.ok, false)
      assert.equal((r as { status: number }).status, 404)
    }
  })

  test('a rejection needs a reason', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate())
    const r = await rejectDate(db, { companyId: CO, id: String(calendar[0].id), reason: '  ' })
    assert.equal(r.ok, false)
    assert.equal((r as { status: number }).status, 400)
    assert.equal(calendar[0].state, 'not_confirmed')
  })

  test('a confirmed date whose line was NOT found goes on the month (decision 5)', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ lineVerified: false }))
    assert.equal(calendar[0].line_verified, false)
    const before = await listDates(db, { companyId: CO, view: 'board' })
    assert.equal(before.length, 0)                      // off the month while nobody has answered
    await confirmDate(db, { companyId: CO, id: String(calendar[0].id) })
    const after = await listDates(db, { companyId: CO, view: 'board' })
    assert.equal(after.length, 1)                       // a person's say-so outranks the line check
  })

  test('a null line_verified is not "not found"', async () => {
    const { db } = fakeDb()
    await addDate(db, docDate({ lineVerified: null }))
    assert.equal((await listDates(db, { companyId: CO, view: 'board' })).length, 1)
  })
})

describe('markDone — the next one is made, the done one stays (decision 9)', () => {
  test('a one-off is just done', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ state: 'confirmed' }))
    const r = await markDone(db, { companyId: CO, id: String(calendar[0].id) })
    assert.equal(r.ok, true)
    assert.equal((r as { next: unknown }).next, null)
    assert.equal(calendar.length, 1)
    assert.equal(calendar[0].state, 'done')
  })

  test('a monthly repeat rolls forward and keeps the done one', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ day: '2026-11-05', state: 'confirmed', repeats: true, every: 'monthly' }))
    const r = await markDone(db, { companyId: CO, id: String(calendar[0].id) })
    assert.equal(r.ok, true)
    assert.equal(calendar.length, 2)
    assert.equal(calendar[0].state, 'done')
    assert.equal(calendar[1].due_date, '2026-12-05')
    assert.equal(calendar[1].state, 'confirmed')        // it does not go back into the queue
    assert.equal(calendar[1].repeats_every, 'monthly')
    assert.equal(calendar[1].document_id, DOC)          // and it keeps its provenance
  })

  test('THE BRIEF\'S TWO ROLL-FORWARD CASES, end to end', async () => {
    const jan = fakeDb()
    await addDate(jan.db, docDate({ day: '2026-01-31', state: 'confirmed', repeats: true, every: 'monthly' }))
    await markDone(jan.db, { companyId: CO, id: String(jan.calendar[0].id) })
    assert.equal(jan.calendar[1].due_date, '2026-02-28')

    const leap = fakeDb()
    await addDate(leap.db, docDate({ day: '2028-02-29', state: 'confirmed', repeats: true, every: 'yearly' }))
    await markDone(leap.db, { companyId: CO, id: String(leap.calendar[0].id) })
    assert.equal(leap.calendar[1].due_date, '2029-02-28')
  })

  test('a repeat with no "how often" makes nothing, and SAYS WHY (never guesses yearly)', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ state: 'confirmed', repeats: true }))
    const r = await markDone(db, { companyId: CO, id: String(calendar[0].id) })
    assert.equal(r.ok, true)
    assert.equal((r as { next: unknown }).next, null)
    assert.match(String((r as { why: string }).why), /how often/)
    assert.equal(calendar.length, 1)
  })

  test('ticking the same repeat twice does not make two next ones', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ day: '2026-11-05', state: 'confirmed', repeats: true, every: 'monthly' }))
    await markDone(db, { companyId: CO, id: String(calendar[0].id) })
    await markDone(db, { companyId: CO, id: String(calendar[0].id) })
    assert.equal(calendar.length, 2)
  })
})

describe('withdrawStale — decision 4', () => {
  const live = (deadlineId: string) => ({ deadline_id: deadlineId, company_id: CO, document_id: DOC })

  test('a not-confirmed date whose reading is no longer current is withdrawn, not deleted', async () => {
    const { db, calendar } = fakeDb([], { viewRows: [live('dl-new')] })
    await addDate(db, docDate({ documentDeadlineId: 'dl-old' }))
    const r = await withdrawStale(db, { companyId: CO })
    assert.equal(r.withdrawn, 1)
    assert.equal(calendar.length, 1)
    assert.equal(calendar[0].state, 'withdrawn')
  })

  test('A CONFIRMED DATE IS NEVER TOUCHED — a person said it was right', async () => {
    const { db, calendar } = fakeDb([], { viewRows: [live('dl-new')] })
    await addDate(db, docDate({ documentDeadlineId: 'dl-old', state: 'confirmed' }))
    const r = await withdrawStale(db, { companyId: CO })
    assert.equal(r.withdrawn, 0)
    assert.equal(calendar[0].state, 'confirmed')
  })

  test('a date still in the current reading stays', async () => {
    const { db, calendar } = fakeDb([], { viewRows: [live('dl-1')] })
    await addDate(db, docDate({ documentDeadlineId: 'dl-1' }))
    assert.equal((await withdrawStale(db, { companyId: CO })).withdrawn, 0)
    assert.equal(calendar[0].state, 'not_confirmed')
  })

  test('a date with no deadline link is left alone, whatever the view says', async () => {
    const { db, calendar } = fakeDb([], { viewRows: [] })
    await addDate(db, { ...docDate(), source: 'hand', documentId: null, title: 'By hand', state: 'confirmed' })
    assert.equal((await withdrawStale(db, { companyId: CO })).withdrawn, 0)
    assert.equal(calendar[0].state, 'confirmed')
  })

  test('*** AN UNREADABLE VIEW WITHDRAWS NOTHING AND THROWS *** — an error is not an empty list', async () => {
    // The map's own lesson (`CLAUDE.md` §9a): a check that cannot see anything looks exactly like a
    // check that found nothing. Here it would have withdrawn every date the company has.
    const { db, calendar } = fakeDb([], { viewError: 'permission denied' })
    await addDate(db, docDate({ documentDeadlineId: 'dl-old' }))
    await assert.rejects(() => withdrawStale(db, { companyId: CO }), /current dates could not be read/)
    assert.equal(calendar[0].state, 'not_confirmed')
  })
})

describe('siblingsOnDay — shown, never acted on (decision 7, the owner 9 October)', () => {
  test('it finds the other date on that day and leaves this one out', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ line: '6-year internal maintenance', day: '2026-10-31', state: 'confirmed' }))
    await addDate(db, docDate({ line: 'Monthly visual inspection', day: '2026-10-31', state: 'confirmed' }))
    const sibs = await siblingsOnDay(db, { companyId: CO, documentId: DOC, day: '2026-10-31', exceptId: String(calendar[1].id) })
    assert.equal(sibs.length, 1)
    assert.equal(sibs[0].id, calendar[0].id)
  })

  test('it does NOT suppress the write — both dates exist', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ line: 'one', day: '2026-10-31' }))
    const second = await addDate(db, docDate({ line: 'two', day: '2026-10-31' }))
    assert.equal(second.created, true)
    assert.equal(calendar.length, 2)
  })

  test('a withdrawn or rejected date is not offered as a sibling', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ line: 'one', day: '2026-10-31' }))
    await rejectDate(db, { companyId: CO, id: String(calendar[0].id), reason: 'no' })
    const sibs = await siblingsOnDay(db, { companyId: CO, documentId: DOC, day: '2026-10-31' })
    assert.equal(sibs.length, 0)
  })
})

describe('listDates — the three tabs read one definition', () => {
  test('board, to_confirm and all', async () => {
    const { db, calendar } = fakeDb()
    await addDate(db, docDate({ line: 'a' }))                                    // not_confirmed, on the board
    await addDate(db, docDate({ line: 'b', lineVerified: false }))               // off the board
    await addDate(db, docDate({ line: 'c', day: null, repeats: true }))          // no day: off the board
    await addDate(db, docDate({ line: 'd', state: 'confirmed' }))
    await rejectDate(db, { companyId: CO, id: String(calendar[3].id), reason: 'no' })
    assert.equal((await listDates(db, { companyId: CO, view: 'board' })).length, 1)
    assert.equal((await listDates(db, { companyId: CO, view: 'to_confirm' })).length, 3)
    assert.equal((await listDates(db, { companyId: CO, view: 'all' })).length, 4)
  })
})

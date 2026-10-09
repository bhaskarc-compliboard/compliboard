/**
 * THE READING'S CALENDAR STEP — `lib/documentScan.ts` `saveScan`, Calendar decisions 3, 4 and 5.
 *
 * *** THE CASE THIS FILE EXISTS FOR: A RE-READ THAT FAILED. ***
 * Settled on staging on 9 October (`scripts/calendar-a3b-failed-reread.mjs`), before the guard it now
 * tests existed. A reading whose status is `could_not_read` — a rate limit, a dropped connection, a
 * format the reading service would not take — **withdrew 3 of a document's 4 real dates**:
 *
 *     reading 2: a FAILED reading — status "could_not_read", 0 deadlines
 *     reading 2's calendar step: {"added":0,"withdrawn":3,...}
 *     BEFORE the failed reading: 4 dates, 4 on the month
 *     AFTER  the failed reading: 4 dates, 1 on the month, 3 withdrawn
 *
 * A bad minute at the reading service took a permit's expiry off a customer's calendar and out of
 * their monthly email, and the only trace was a `withdrawn` state nobody looks at. It is the shape
 * `docs/HOW-WE-BUILD.md` §3 names: the failure is always something that looks like it worked.
 *
 * The rule, and `CLAUDE.md` §3.2's first line in a new place: **absence of evidence is not evidence of
 * absence.** Withdrawal means "the current reading no longer says this date". A reading that read
 * nothing says nothing. A reading that SUCCEEDED and found no deadlines is the opposite — a real
 * opinion — and its dates are withdrawn, which the second test holds.
 *
 * It uses a stand-in client, so the two cases are told apart by what the step DOES, not by a count
 * that could be right for the wrong reason.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { saveScan, failedScan, normaliseScan } from '../../lib/documentScan.ts'

const CO = 'co-1'
const DOC = 'doc-1'

type Row = Record<string, unknown>

/**
 * Enough of the database for `saveScan`'s writes: the tables it touches, the unique index the date
 * key depends on, and `document_dates_current_v` — which the stand-in computes the way migrations 073
 * and 074 define it, from whichever scan is `is_current`. That last part is the whole point: the bug
 * was that a failed scan becomes current and the view then returns nothing.
 */
function fakeDb(seed: { calendar?: Row[]; deadlines?: Row[]; scans?: Row[] } = {}) {
  const t: Record<string, Row[]> = {
    document_scans: (seed.scans ?? []).map((r) => ({ ...r })),
    document_deadlines: (seed.deadlines ?? []).map((r) => ({ ...r })),
    calendar_events: (seed.calendar ?? []).map((r) => ({ ...r })),
    document_gaps: [], document_conditions: [], fact_proposals: [], company_labels: [],
    documents: [{ id: DOC, company_id: CO }], checklists: [], ai_calls: [],
  }
  let nextId = 1
  const board = (r: Row) => r.due_date != null
    && ['not_confirmed', 'confirmed', 'done'].includes(String(r.state))
    && (r.state !== 'not_confirmed' || r.line_verified !== false)

  /** 073/074's view: the current reading's deadlines, for a document no confirmed version supersedes. */
  const currentDates = () => {
    const cur = t.document_scans.find((s) => s.is_current)
    if (!cur) return []
    return t.document_deadlines.filter((d) => d.scan_id === cur.id).map((d) => ({
      deadline_id: d.id, company_id: d.company_id, document_id: d.document_id,
      title: d.title, due_on: d.due_on, source_line: d.source_line,
      recurs: d.recurs, quote_verified: d.quote_verified, entity_id: null,
    }))
  }

  function rows(name: string): Row[] {
    return name === 'document_dates_current_v' ? currentDates() as Row[] : (t[name] ??= [])
  }

  function builder(name: string) {
    let filtered = rows(name).slice()
    const api: Record<string, unknown> = {}
    const self = () => api as never
    Object.assign(api, {
      select: () => self(),
      eq: (f: string, v: unknown) => { filtered = filtered.filter((r) => r[f] === v); return self() },
      in: (f: string, vs: unknown[]) => { filtered = filtered.filter((r) => vs.includes(r[f])); return self() },
      not: (f: string) => { filtered = filtered.filter((r) => r[f] != null); return self() },
      gte: () => self(), order: () => self(), limit: () => self(),
      maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
      single: async () => ({ data: filtered[0] ?? null, error: filtered[0] ? null : { message: 'no row' } }),
      then: (res: (v: unknown) => unknown) => res({ data: filtered.map((r) => ({ ...r, counts_as_due: board(r) })), error: null }),
    })
    return api
  }

  return {
    tables: t,
    db: {
      from: (name: string) => ({
        ...builder(name),
        insert: (row: Row | Row[]) => {
          const many = Array.isArray(row) ? row : [row]
          const made: Row[] = many.map((r) => ({ id: `${name}-${nextId++}`, ...r }))
          const dupe = name === 'calendar_events'
            && made.some((m) => rows(name).some((e) => e.company_id === m.company_id && e.date_key === m.date_key))
          const out = {
            select: () => ({
              single: async () => {
                if (dupe) return { data: null, error: { code: '23505', message: 'duplicate key' } }
                rows(name).push(...made)
                return { data: { ...made[0], counts_as_due: board(made[0]) }, error: null }
              },
              maybeSingle: async () => { rows(name).push(...made); return { data: made[0], error: null } },
            }),
            then: (res: (v: unknown) => unknown) => {
              if (!dupe) rows(name).push(...made)
              return res({ error: dupe ? { code: '23505' } : null })
            },
          }
          return out as never
        },
        upsert: () => ({ then: (res: (v: unknown) => unknown) => res({ error: null }) }) as never,
        update: (patch: Row) => {
          let scoped = rows(name).slice()
          const u: Record<string, unknown> = {}
          const apply = () => { for (const r of scoped) Object.assign(r, patch); return scoped }
          Object.assign(u, {
            eq: (f: string, v: unknown) => { scoped = scoped.filter((r) => r[f] === v); return u as never },
            in: (f: string, vs: unknown[]) => { scoped = scoped.filter((r) => vs.includes(r[f])); return u as never },
            is: (f: string, v: unknown) => { scoped = scoped.filter((r) => r[f] === v); return u as never },
            select: () => ({ single: async () => { const g = apply(); return { data: g[0] ? { ...g[0], counts_as_due: board(g[0]) } : null, error: g[0] ? null : { message: 'no row' } } } }),
            then: (res: (v: unknown) => unknown) => { apply(); return res({ error: null }) },
          })
          return u as never
        },
      }),
    } as never,
  }
}

/** A reading that succeeded, with the deadlines given. */
const goodScan = (deadlines: Array<{ title: string; due_on: string | null; source_line: string; recurs?: boolean }>) => ({
  ...normaliseScan({ status: 'current' }, ''),
  deadlines: deadlines.map((d) => ({ recurs: false, ...d })),
  extracted_text: deadlines.map((d) => d.source_line).join(' '),
  raw_text: '', json_parsed: true, model: '(test)', cited_sources: 0, searches: null,
  structured: null, prompt_sha256: '', quotes_checked: 0, quotes_verified: 0,
  started_at: new Date().toISOString(),
}) as never

const DEADLINES = [
  { title: 'Permit expires', due_on: '2027-01-01', source_line: 'This permit expires 1 January 2027.' },
  { title: 'Annual fee', due_on: '2027-03-01', source_line: 'The annual fee is due 1 March each year.', recurs: true },
]

describe('a reading that COULD NOT READ the document never withdraws a date', () => {
  test('*** THE BUG, PINNED: a failed re-read leaves every date exactly where it was ***', async () => {
    const f = fakeDb()
    // A good reading first: its dates reach the calendar.
    await saveScan(f.db, goodScan(DEADLINES), { documentId: DOC, companyId: CO, linkLedger: false })
    assert.equal(f.tables.calendar_events.length, 2)
    assert.deepEqual(f.tables.calendar_events.map((r) => r.state), ['not_confirmed', 'not_confirmed'])

    // A person confirms one of them.
    f.tables.calendar_events[0].state = 'confirmed'

    // Now the reading service refuses. This is exactly what the live route (`:95`) and the sweep
    // (`:215`) save.
    const r = await saveScan(f.db, failedScan('refused', 'try again'), {
      documentId: DOC, companyId: CO, linkLedger: false,
    })

    assert.equal(r.calendar.withdrawn, 0, 'a failed reading withdrew a date')
    assert.equal(r.calendar.added, 0)
    assert.match(String(r.calendar.skipped), /could not be read/)
    assert.equal(r.calendar.error, null, 'it is a deliberate skip, not a failure')
    // Every date is where it was: nothing withdrawn, nothing lost, the confirmed one still confirmed.
    assert.deepEqual(f.tables.calendar_events.map((r2) => r2.state), ['confirmed', 'not_confirmed'])
  })

  test('the failed reading IS still the current reading — this fix does not hide the failure', async () => {
    // `display_status` depends on it (044: a conclusion beats an absence), so the page must say
    // "Could not read" rather than go on showing the old reading as if nothing had happened. What is
    // refused is treating its silence as a statement about the dates.
    const f = fakeDb()
    await saveScan(f.db, goodScan(DEADLINES), { documentId: DOC, companyId: CO, linkLedger: false })
    await saveScan(f.db, failedScan('refused', 'try again'), { documentId: DOC, companyId: CO, linkLedger: false })
    const current = f.tables.document_scans.filter((s) => s.is_current)
    assert.equal(current.length, 1)
    assert.equal(current[0].status, 'could_not_read')
  })

  test('A READING THAT SUCCEEDED AND FOUND NOTHING *does* withdraw — the opposite case', async () => {
    // The distinction that makes the guard narrow rather than a blanket "never withdraw": a reading
    // that read the document and found no deadlines has a real opinion, and decision 4 applies.
    const f = fakeDb()
    await saveScan(f.db, goodScan(DEADLINES), { documentId: DOC, companyId: CO, linkLedger: false })
    const r = await saveScan(f.db, goodScan([]), { documentId: DOC, companyId: CO, linkLedger: false })
    assert.equal(r.calendar.skipped, null)
    assert.equal(r.calendar.withdrawn, 2)
    assert.deepEqual(f.tables.calendar_events.map((x) => x.state), ['withdrawn', 'withdrawn'])
  })

  test('...and a reading that still says a date does not withdraw it', async () => {
    const f = fakeDb()
    await saveScan(f.db, goodScan(DEADLINES), { documentId: DOC, companyId: CO, linkLedger: false })
    const r = await saveScan(f.db, goodScan([DEADLINES[0]]), { documentId: DOC, companyId: CO, linkLedger: false })
    assert.equal(r.calendar.already, 1)       // the one it still says, re-pointed
    assert.equal(r.calendar.withdrawn, 1)     // the one it no longer says
    assert.equal(f.tables.calendar_events.filter((x) => x.state === 'not_confirmed').length, 1)
  })
})

describe('the view behind the dates: "current" means the latest READABLE reading (migration 075)', () => {
  // The SQL is proved by 075's own verify block, against the real database. These hold the two things
  // the code on top of it must do with the answer, which a migration cannot assert.
  test('the report shows the grey line only when the dates are an earlier reading\'s', async () => {
    const route = await import('node:fs').then((fs) =>
      fs.readFileSync('app/api/documents/report/route.ts', 'utf8'))
    // The flag is read from the view and passed through; it is never computed in the route, or the
    // route and the view could disagree about which reading a date came from.
    assert.match(route, /from_an_earlier_reading: d\.from_an_earlier_reading === true/)
    assert.match(route, /dates_from_reading_at: [\s\S]*from_an_earlier_reading === true\)\?\.scanned_at \?\? null/)

    const drawer = await import('node:fs').then((fs) =>
      fs.readFileSync('components/DocumentReport.tsx', 'utf8'))
    assert.match(drawer, /These dates are from the last reading that could read this document, on/)
    // ...drawn only when the route set it, so an ordinary document says nothing.
    assert.match(drawer, /\{r\.dates_from_reading_at && \(/)
  })

  test('the report reads the view, not document_deadlines', async () => {
    // The whole point of one definition: if the report went back to reading the table directly it
    // would show a replaced reading's dates again (B3), and nothing would fail.
    const route = await import('node:fs').then((fs) =>
      fs.readFileSync('app/api/documents/report/route.ts', 'utf8'))
    assert.match(route, /from\('document_dates_current_v'\)/)
    assert.ok(!/from\('document_deadlines'\)/.test(route),
      'the report must read the current-dates view, never document_deadlines directly')
  })

  test('saveScan reads the same view, so the writer and the readers agree', async () => {
    const lib = await import('node:fs').then((fs) => fs.readFileSync('lib/documentScan.ts', 'utf8'))
    assert.match(lib, /from\('document_dates_current_v'\)/)
  })
})

describe('what a document IS survives a failed reading (migration 076)', () => {
  // The SQL is proved by 076's own verify block against the real database, including the audit's own
  // agency filter. These hold what the SCREENS must then do with the answer.
  test('the Documents row says where its title and agency came from', async () => {
    const page = await import('node:fs').then((fs) => fs.readFileSync('app/documents/page.tsx', 'utf8'))
    assert.match(page, /identity_from_an_earlier_reading && \(/)
    assert.match(page, /From the last reading that could read this document/)
    // ...and only then: an ordinary row says nothing, or the line would be noise on every document.
    assert.ok(!/From the last reading that could read this document[\s\S]{0,80}\}\s*\)\s*\}\s*$/m.test(page))
  })

  test('the report drawer says the same thing about its dates', async () => {
    const drawer = await import('node:fs').then((fs) => fs.readFileSync('components/DocumentReport.tsx', 'utf8'))
    assert.match(drawer, /These dates are from the last reading that could read this document, on/)
  })

  test('the audit\'s agency filter is the column 076 keeps alive', async () => {
    // `lib/audit.ts` keeps a document for an agency only when `agencies` contains its label, so an
    // empty list takes the document out of its own audit. This pins the filter the migration's verify
    // block asserts against, so a change to either is visible.
    const audit = await import('node:fs').then((fs) => fs.readFileSync('lib/audit.ts', 'utf8'))
    assert.match(audit, /from\('document_index_v'\)/)
    assert.match(audit, /list\.includes\(agencyLabel\)/)
  })
})

describe('every reader of a document\'s CONTENT takes the readable reading (§185a, A3e)', () => {
  // The sweep's result, pinned by file. Migration 076 put a document whose latest reading failed back
  // into its agency's audit — and the audit then handed the model its TITLE AND NOTHING ELSE, because
  // the content was still read by the CURRENT scan. "Nothing on file" had become "the permit is on
  // file and says nothing about this", which is the more convincing wrong answer.
  const read = async (f: string) =>
    (await import('node:fs')).readFileSync(f, 'utf8')

  test('the audit reads gaps, conditions and dates by the readable scan', async () => {
    const audit = await read('lib/audit.ts')
    assert.match(audit, /readableScans\(db, companyId/)
    assert.ok(!/mine\.map\(\(r\) => r\.scan_id as string\)/.test(audit),
      'lib/audit.ts must not take its scan ids from the CURRENT scan')
  })

  test('the Audits page, the Documents report and the Documents index all swapped', async () => {
    assert.match(await read('app/api/audits/index/route.ts'), /readableScanIds\(db, companyId/)
    assert.match(await read('app/api/documents/report/route.ts'), /row\.readable_scan_id as string \| null/)
    assert.match(await read('app/api/documents/index/route.ts'), /readableScanIds\(db, companyId\)/)
  })

  test('the shared libraries swapped: the run\'s date, an attachment, the labels, the scan\'s context', async () => {
    assert.match(await read('lib/auditRun.ts'), /readableScanIds\(db, runCo\.company_id/)
    assert.match(await read('lib/attachedDocument.ts'), /readableScanForDocument\(db, t\.document_id\)/)
    assert.match(await read('lib/companyLabels.ts'), /readableScanIds\(admin, companyId\)/)
    assert.match(await read('lib/documentScan.ts'), /readableScanIds\(db, company\.id\)/)
  })

  test('*** THE ONE THAT DELETES: a label is alive when the READABLE reading carries it ***', async () => {
    // `pruneOrphanLabels` removes a label no reading carries, and pruning runs when a document is
    // deleted. Under the old rule a failed re-read emptied a permit's `agencies`, so the next delete
    // took "Oregon DEQ" with it and the agency dropped out of "audit everything" — a company losing
    // its own vocabulary because a reading service refused for a minute. Proved on staging in
    // `scripts/calendar-a3b-failed-reread.mjs`: removed 0, and the label is still there.
    const labels = await read('lib/companyLabels.ts')
    assert.match(labels, /readableScanIds\(admin, companyId\)/)
    assert.ok(!/\.eq\('is_current', true\)/.test(labels),
      'pruneOrphanLabels must not decide an orphan from the CURRENT reading')
  })

  test('the audit\'s "found wrong with it: nothing" is a STATEMENT, so it must be the readable reading\'s', async () => {
    // `lib/audit.ts:358-360` prints either the findings or the flat sentence "WHAT THE READING FOUND
    // WRONG WITH IT: nothing". In a prompt that is not an absence, it is a claim — and under the old
    // rule it was made about a document whose reading we never got (§3.3: the model reasoning against
    // an artifact that is not there).
    const audit = await read('lib/audit.ts')
    assert.match(audit, /WHAT THE READING FOUND WRONG WITH IT: nothing/)
    assert.match(audit, /readableScans\(db, companyId/)
  })

  test('*** THE WATCHER KEEPS THE CURRENT SCAN *** — or the drawer spins for ever', async () => {
    // `components/DocumentReport.tsx` knows a re-read has landed when `scan_id` CHANGES, and a
    // re-read that failed has landed just as much as one that worked. This is the one place the swap
    // must NOT be made, so it is asserted rather than left to be noticed.
    const drawer = await read('components/DocumentReport.tsx')
    assert.match(drawer, /r\?\.row\.scan_id \?\? null\) === rereadFrom/)
    assert.ok(!/readable_scan_id.*rereadFrom/.test(drawer))
  })

  test('HR\'s and the handbooks\' is_current is a DIFFERENT table, and is not touched', async () => {
    // `handbooks.is_current` is HR's own version chain, nothing to do with a document's readings.
    // Named here so the next sweep does not "fix" it.
    const hr = await read('lib/hrAnswer.ts')
    assert.match(hr, /from\('handbooks'\)[\s\S]{0,200}is_current/)
    assert.ok(!/readableScan/.test(hr), 'HR\'s answer must not have been changed by this sweep')
  })

  test('the helper refuses to read an error as "never read"', async () => {
    const { readableScans } = await import('../../lib/readableScan.ts')
    const broken = { from: () => ({ select: () => ({ eq: () => ({
      then: (r: (v: unknown) => unknown) => r({ data: null, error: { message: 'permission denied' } }),
    }) }) }) } as never
    await assert.rejects(() => readableScans(broken, 'co-1'), /could not be read/)
  })
})

describe('the calendar step never fails the reading', () => {
  test('a broken view is logged and counted, and the reading stands', async () => {
    const f = fakeDb()
    // A client whose view read fails, which is what a dropped grant or a renamed column looks like.
    const broken = {
      from: (name: string) => name === 'document_dates_current_v'
        ? { select: () => ({ eq: () => ({ eq: () => ({ then: (res: (v: unknown) => unknown) => res({ data: null, error: { message: 'permission denied' } }) }) }) }) }
        : (f.db as unknown as { from: (n: string) => unknown }).from(name),
    } as never
    const r = await saveScan(broken, goodScan(DEADLINES), { documentId: DOC, companyId: CO, linkLedger: false })
    assert.ok(r.scanId, 'the reading was still saved')
    assert.match(String(r.calendar.error), /permission denied/)
    assert.equal(r.calendar.added, 0)
  })

  test('a one-off deadline with no day is counted, not forced onto the calendar', async () => {
    const f = fakeDb()
    const r = await saveScan(f.db, goodScan([
      { title: 'Something, sometime', due_on: null, source_line: 'No day is given.' },
    ]), { documentId: DOC, companyId: CO, linkLedger: false })
    assert.equal(r.calendar.added, 0)
    assert.equal(r.calendar.failed, 1)
    assert.equal(f.tables.calendar_events.length, 0)
    // The READING keeps it: the document really does say it, and the row is on the report.
    assert.equal(f.tables.document_deadlines.length, 1)
  })

  test('a deadline\'s source line is checked and stored (decision 5, B16)', async () => {
    const f = fakeDb()
    // The text holds the first line and not the second.
    const partial = Object.assign({}, goodScan(DEADLINES) as object,
      { extracted_text: 'This permit expires 1 January 2027.' }) as never
    await saveScan(f.db, partial, { documentId: DOC, companyId: CO, linkLedger: false })
    const checks = f.tables.document_deadlines.map((d) => d.quote_verified)
    assert.deepEqual(checks, [true, false])
    // ...and the unfound one is off the month, while the found one is on it.
    const ev = f.tables.calendar_events
    assert.equal(ev.find((e) => e.title === 'Permit expires')!.line_verified, true)
    assert.equal(ev.find((e) => e.title === 'Annual fee')!.line_verified, false)
  })
})

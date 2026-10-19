/**
 * `lib/calendarQueue.ts` — the confirm queue's shape and words. Calendar step 9, board 7
 * (`docs/TESTING.md` C9).
 *
 * Everything the queue DECIDES is here and is tested without a database or a browser: which group a
 * row belongs to, what a group's heading says, which group comes first, which row comes first
 * inside it, what goes where the date goes when there is no date, and which ids "Confirm all"
 * sends. The markup is held by measurement (`npm run measure`), not by assertions about classes.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  waitingRows, queueGroups, groupKeyOf, groupHeading, groupCount, queueWhen, queueMeta,
  needsPeriod, idsShown, confirmAllLabel, PERIOD_UNREAD, HOW_OFTEN_UNREAD, NO_DAY_YET, QUEUE_BAR,
  QUEUE_EMPTY_TITLE, QUEUE_EMPTY_NOTE, CONFIRM, NOT_RIGHT, DONT_KNOW_YET,
  needsWhenRows, needsWhenGroups, NEEDS_WHEN_HEADING, NEEDS_WHEN_NOTE, NEEDS_WHEN_ID,
} from '../../lib/calendarQueue.ts'
import { PERIOD_LABEL, type CalendarRow } from '../../lib/calendarView.ts'

const row = (p: Partial<CalendarRow>): CalendarRow => ({
  id: 'r1', title: 'A date', description: null, due_date: null, next_due: null, days_until: null,
  has_passed: false, status: 'proposed', source: 'document', recurs: false, period: null,
  source_line: null, source_url: null, source_page: null, source_title: 'The permit',
  site_id: null, site_name: null, entity_id: null, document_id: 'doc1', handbook_id: null,
  audit_finding_id: null, deadline_id: null, added_by: null, confirmed_by: null, confirmed_at: null,
  dismissed_by: null, dismissed_at: null, dismissed_reason: null, replaced_by: null,
  created_at: null, ...p,
})

describe('the queue is the proposed rows of the live set, and nothing else', () => {
  test('confirmed dates are not work waiting', () => {
    const rows = [
      row({ id: 'p', status: 'proposed' }),
      row({ id: 'c', status: 'confirmed' }),
      // `calendar_v` has already dropped withdrawn rows (075) and the page's filter has dropped
      // superseded ones, so neither can reach here — but a dismissed row CAN be in the view, and
      // it is a person's decision, not work.
      row({ id: 'd', status: 'dismissed' }),
    ]
    assert.deepEqual(waitingRows(rows).map((r) => r.id), ['p'])
  })

  /**
   * THE SAME FILTER THE TAB LABEL AND THE SIDEBAR BADGE USE. `countsFrom` counts
   * `status === 'proposed'` for both of them; if this file ever counted something else the nav
   * would promise a number of rows the page does not draw — the 29 September failure
   * `components/AppLayout.tsx` carries in full.
   */
  test('it is the same test the two numbers are made of', () => {
    const counts = readFileSync('lib/calendarCounts.ts', 'utf8')
    assert.match(counts, /rows\.filter\(\(r\) => r\.status === 'proposed'\)\.length/)
    const queue = readFileSync('lib/calendarQueue.ts', 'utf8')
    assert.match(queue, /rows\.filter\(\(r\) => r\.status === 'proposed'\)/)
  })
})

describe('what goes where the date goes', () => {
  test('a one-off is its day', () => {
    assert.equal(queueWhen(row({ due_date: '2026-11-15', next_due: '2026-11-15' })), '15 November 2026')
  })
  test('a repeating date with a period says the day and how often — board 7\'s own shape', () => {
    assert.equal(
      queueWhen(row({ recurs: true, period: 'year', due_date: '2026-03-01', next_due: '2027-03-01' })),
      '1 March 2027, every year')
    assert.equal(PERIOD_LABEL['6 months'], 'every 6 months', 'the words are the shared ones')
  })
  /**
   * *** A REPEATING DATE WITH NO PERIOD HAS NO DAY TO SHOW, AND THAT IS THE VIEW'S DOING. ***
   * `calendar_v` computes `next_due` from the period and the anchor, so with no period there is no
   * next date — the row genuinely has nothing to put in the date column, and saying "repeats" with
   * a confident day would be the silent guess decision 30 forbids. The ANCHOR is said when there
   * is one, because an anchor we have must not be hidden by a frequency we do not.
   */
  test('REPEATING WITH NO PERIOD: THE DAY FIRST WHEN THERE IS ONE — step 14b (the owner)', () => {
    // It read "repeats — how often wasn't read, from 20 Aug", which was true and buried the one
    // thing the row has. Migration 079 puts that date on the grid, so the queue leads with the
    // day the grid is showing and then says what is still unknown. With NO day there is nothing
    // to lead with, and the old sentence is the whole answer.
    assert.equal(queueWhen(row({ recurs: true, period: null, due_date: null })), PERIOD_UNREAD)
    assert.equal(queueWhen(row({ recurs: true, period: null, due_date: '2026-08-20', next_due: '2026-08-20' })),
      "20 August 2026, how often wasn't read")
    assert.equal(PERIOD_UNREAD, "repeats — how often wasn't read")
    assert.equal(HOW_OFTEN_UNREAD, "how often wasn't read")
  })
  test('repeating with a period and no anchor is the other honest state', () => {
    assert.equal(queueWhen(row({ recurs: true, period: 'month', due_date: null, next_due: null })),
      NO_DAY_YET)
    assert.equal(NO_DAY_YET, 'repeats, no day yet')
  })
  test('a date that has passed still says its day — never "overdue", never "done"', () => {
    const r = row({ due_date: '2026-09-01', next_due: '2026-09-01', has_passed: true, days_until: -45 })
    assert.equal(queueWhen(r), '1 September 2026')
    for (const banned of ['overdue', 'done', 'complete']) {
      assert.ok(!queueWhen(r).toLowerCase().includes(banned))
    }
  })
})

describe('the rest of the row', () => {
  test('the page it was read from, then the site — and the site ONLY with more than one', () => {
    const r = row({ source_page: '12', site_name: 'Portland plant', site_id: 's1' })
    assert.deepEqual(queueMeta(r, 1), ['Page 12'], 'one site: nothing about sites (decision 24)')
    assert.deepEqual(queueMeta(r, 2), ['Page 12', 'Portland plant'])
  })
  test('a company-wide date says so, with more than one site', () => {
    assert.deepEqual(queueMeta(row({}), 2), ['Every site'])
  })
  test('the quoted line is NOT in the meta parts — the component draws it as a quotation', () => {
    assert.deepEqual(queueMeta(row({ source_line: 'The permittee shall…' }), 1), [])
  })
  test('only a repeating date with no period gets the picker', () => {
    assert.equal(needsPeriod(row({ recurs: true, period: null })), true)
    assert.equal(needsPeriod(row({ recurs: true, period: 'year' })), false)
    assert.equal(needsPeriod(row({ recurs: false })), false)
  })
})

describe('the groups', () => {
  test('a row belongs to its SOURCE\'s own id, so two titles that match are not merged', () => {
    assert.equal(groupKeyOf(row({ source: 'document', document_id: 'd1' })), 'document:d1')
    assert.equal(groupKeyOf(row({ source: 'handbook', handbook_id: 'h1' })), 'handbook:h1')
    assert.equal(groupKeyOf(row({ source: 'rule' })), 'rule:')
  })
  /**
   * An audit row carries no run id — `calendar_v` has `audit_finding_id`, and a finding's id
   * changes with every run (`lib/calendarDates.ts` `auditSiblingsOf`). `source_title` IS the run:
   * migration 075 builds it as the agency label and the run's date. Grouping by the finding would
   * put every date in a group of one, which is the opposite of what this tab is for.
   */
  test('an audit groups by the run, which is what source_title is', () => {
    const a = row({ source: 'audit', source_title: 'Oregon DEQ · 09 Oct 2026', audit_finding_id: 'f1' })
    const b = row({ id: 'r2', source: 'audit', source_title: 'Oregon DEQ · 09 Oct 2026', audit_finding_id: 'f2' })
    assert.equal(groupKeyOf(a), groupKeyOf(b))
    assert.equal(queueGroups([a, b]).length, 1)
  })

  test('a document heading is its title, its kind word and when it was read', () => {
    assert.equal(
      groupHeading(row({ source_title: 'ACDP 26-2841' }), { kind: 'permit', scanned_at: '2026-10-14T09:00:00Z' }),
      'ACDP 26-2841 · Permit · read 14 October 2026')
  })
  test('a part we do not have is left out, never guessed (decision 30)', () => {
    assert.equal(groupHeading(row({ source_title: 'ACDP 26-2841' }), null), 'ACDP 26-2841')
    assert.equal(groupHeading(row({ source_title: 'ACDP' }), { kind: null, scanned_at: null }), 'ACDP')
    // The document was deleted: the view's join found nothing, so there is no title to show.
    assert.equal(groupHeading(row({ source_title: null })), 'A document that has been deleted')
  })
  test('an audit, a handbook and the chat each say what they are', () => {
    assert.equal(groupHeading(row({ source: 'audit', source_title: 'Oregon DEQ · 09 Oct 2026' })),
      'Audit: Oregon DEQ · 09 Oct 2026')
    assert.equal(groupHeading(row({ source: 'handbook', source_title: 'Employee handbook' })),
      'Handbook: Employee handbook')
    assert.equal(groupHeading(row({ source: 'rule' })), 'From the chat')
  })
  test('the kind word comes from the one map, not a fifth copy', () => {
    const queue = readFileSync('lib/calendarQueue.ts', 'utf8')
    assert.match(queue, /import \{ KIND_WORD \} from '\.\/documentStatus\.ts'/)
    assert.ok(!/supplier_document:/.test(queue), 'no copy of the map itself')
  })
  test('"3 dates", and one date is not "1 dates"', () => {
    assert.equal(groupCount(3), '3 dates')
    assert.equal(groupCount(1), '1 date')
  })
  test('each group\'s button names where its dates came from', () => {
    assert.equal(confirmAllLabel('document'), 'Confirm all from this document')
    assert.equal(confirmAllLabel('audit'), 'Confirm all from this audit')
    assert.equal(confirmAllLabel('handbook'), 'Confirm all from this handbook')
    // An unknown source still gets a button that says something true.
    assert.equal(confirmAllLabel('something new'), 'Confirm all')
  })
})

describe('the order, both levels', () => {
  const mk = (id: string, doc: string, day: string | null, extra: Partial<CalendarRow> = {}) =>
    row({ id, document_id: doc, source_title: doc, next_due: day, due_date: day, ...extra })

  test('groups come soonest-date first, by the soonest date any of their rows has', () => {
    const groups = queueGroups([
      mk('a', 'later', '2027-01-01'),
      mk('b', 'sooner', '2026-11-15'),
      mk('c', 'later', '2026-12-20'),
    ])
    assert.deepEqual(groups.map((g) => g.key), ['document:sooner', 'document:later'])
    assert.deepEqual(groups[1].rows.map((r) => r.id), ['c', 'a'], 'and by date inside the group')
  })

  /**
   * *** A GROUP WITH NO DATES AT ALL IS NOT "SOON", so it goes last. *** Its rows are repeating
   * dates whose frequency was never read, which is work — but it is not a deadline, and putting it
   * first because its key happened to sort early would push real deadlines down the page.
   */
  test('a group with no day at all sorts last, and undated rows sort last inside a group', () => {
    const groups = queueGroups([
      mk('u1', 'undated', null, { recurs: true }),
      mk('d1', 'dated', '2027-05-05'),
      mk('mixed-undated', 'dated', null, { recurs: true, title: 'zz' }),
      mk('mixed-dated', 'dated', '2026-12-31'),
    ])
    assert.deepEqual(groups.map((g) => g.key), ['document:dated', 'document:undated'])
    assert.deepEqual(groups[0].rows.map((r) => r.id), ['mixed-dated', 'd1', 'mixed-undated'])
  })

  test('two groups with the same soonest date are ordered by their heading, so a reload is stable', () => {
    const groups = queueGroups([mk('x', 'Beta', '2026-11-15'), mk('y', 'Alpha', '2026-11-15')])
    assert.deepEqual(groups.map((g) => g.heading), ['Alpha', 'Beta'])
  })
})

describe('"Confirm all" sends the ids that were on the screen', () => {
  /**
   * *** THE RULE, AND THE REASON IT IS A RULE. ***
   * The alternative is "confirm everything for this document", as a filter on the server — which
   * would confirm a date that arrived between the page loading and the click: a reading that
   * finished thirty seconds ago would have its dates confirmed by somebody who never saw them,
   * with their name on it. So the ids go over the wire, and the route confirms exactly those.
   */
  test('it is the drawn rows, and nothing wider', () => {
    const groups = queueGroups([
      row({ id: 'a', next_due: '2026-11-15', due_date: '2026-11-15' }),
      row({ id: 'b', next_due: '2026-11-16', due_date: '2026-11-16' }),
    ])
    assert.deepEqual(idsShown(groups[0]), ['a', 'b'])
  })
  test('the component sends idsShown, and never a document id', () => {
    const ui = readFileSync('components/DateQueue.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(ui, /action: 'confirm_many', ids: idsShown\(g\)/)
    assert.ok(!/document_id/.test(ui), 'a document id in the body would be the wider rule')
  })
  test('the route takes ids and has no document branch', () => {
    const route = readFileSync('app/api/calendar/route.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(route, /confirmMany\(db, body\?\.ids, userId\)/)
    assert.ok(!/confirm_many[\s\S]{0,200}document_id/.test(route))
  })
})

/**
 * *** NEEDS A DAY OR HOW OFTEN — the second section (decision 32, Calendar step 14b). ***
 *
 * The month grid and the list show dates and nothing else now; a row with no day is not a date
 * yet, it is a question, and this is where it is asked. The rules worth holding: WHICH rows
 * (every live row with no day, proposed or confirmed — not just the queue's), that the overlap
 * with the queue is deliberate, that the grouping is the queue's own, and that the tab's count is
 * still the queue's and never this one.
 */
describe('the section that holds a date with no day', () => {
  const dated = row({ id: 'has-day', next_due: '2026-11-20', due_date: '2026-11-20', recurs: true })
  const openQ = row({ id: 'none-proposed', recurs: true, status: 'proposed' })
  const settled = row({ id: 'none-confirmed', recurs: true, status: 'confirmed' })
  const rows = [dated, openQ, settled]

  test('it is every LIVE row with no day — confirmed ones too, which the queue never shows', () => {
    assert.deepEqual(needsWhenRows(rows).map((r) => r.id), ['none-proposed', 'none-confirmed'])
    // The queue is the proposed rows: the confirmed one is a question nobody is asking there.
    assert.deepEqual(waitingRows(rows).map((r) => r.id), ['has-day', 'none-proposed'])
  })
  test('A DATE WITH A DAY IS NOT HERE, whatever its period — migration 079 put it on the grid', () => {
    assert.ok(!needsWhenRows(rows).some((r) => r.id === 'has-day'))
    assert.deepEqual(needsWhenRows([row({ id: 'p', recurs: true, period: 'year', next_due: '2027-01-01' })]), [])
  })
  test('THE OVERLAP IS DELIBERATE: a proposed row with no day is in both, and answers two questions', () => {
    const both = waitingRows(rows).filter((r) => needsWhenRows(rows).some((n) => n.id === r.id))
    assert.deepEqual(both.map((r) => r.id), ['none-proposed'])
  })
  test('grouped by source exactly as the queue is — and ordered by heading, since none has a day', () => {
    const two = [row({ id: 'a', recurs: true, document_id: 'doc1' }),
      row({ id: 'b', recurs: true, document_id: 'doc2', source_title: 'The other permit' })]
    const groups = needsWhenGroups(two)
    assert.deepEqual(groups.map((g) => g.key), ['document:doc2', 'document:doc1'])
    assert.deepEqual(groups.map((g) => g.heading), ['The other permit', 'The permit'])
    assert.deepEqual(groups.map((g) => g.rows.length), [1, 1])
    // Every group in this section has no day by definition, so the queue's "soonest first" has
    // nothing to sort on and falls through to its tie-break, the heading — which is what makes
    // the order stable between reloads rather than left to the order rows came back in.
  })
  test('the heading carries its own count, and the note is the owner’s own sentence', () => {
    assert.equal(NEEDS_WHEN_HEADING(7), 'Needs a day or how often (7)')
    assert.equal(NEEDS_WHEN_NOTE,
      'These repeat, and nothing in the reading said when. Open one to set the day, or how often it repeats.')
    assert.equal(NEEDS_WHEN_ID, 'needs-a-day')
  })
  test('the component draws it, with no Confirm and no picker on its rows', () => {
    const ui = readFileSync('components/DateQueue.tsx', 'utf8')
    const at = ui.indexOf('NEEDS_WHEN_HEADING(')
    assert.ok(at > 0, 'the section must be drawn')
    const section = ui.slice(at)
    assert.ok(!section.includes('{CONFIRM}'), 'the question here is WHEN, and it is answered in the drawer')
    assert.ok(!section.includes('needsPeriod('), 'the picker belongs to the queue above')
    assert.match(ui, /id=\{NEEDS_WHEN_ID\}/)
    assert.match(section, /onOpen\(r\.id\)/, 'every row opens the drawer')
  })
  test('THE TAB COUNT IS STILL THE QUEUE’S, and this section carries its own', () => {
    // `lib/calendarCounts.ts` is what the tab and the sidebar badge read, and it counts `proposed`
    // rows — unchanged by this step. A badge that followed this section would say a number no
    // other screen in the product agrees with.
    const counts = readFileSync('lib/calendarCounts.ts', 'utf8')
    assert.match(counts, /rows\.filter\(\(r\) => r\.status === 'proposed'\)\.length/)
    assert.ok(!counts.includes('needsWhen'), 'the counts file must not learn about this section')
  })
})

describe('the words are the owner\'s, and the forbidden ones are absent', () => {
  test('board 7\'s line, the two actions and the empty state', () => {
    assert.equal(QUEUE_BAR,
      'These dates are already on your calendar. Confirm the ones that are right; tell us when one is not.')
    assert.equal(CONFIRM, 'Confirm')
    assert.equal(NOT_RIGHT, 'Not right')
    assert.equal(DONT_KNOW_YET, "I don't know yet")
    assert.equal(QUEUE_EMPTY_TITLE, 'Nothing waiting')
    assert.equal(QUEUE_EMPTY_NOTE,
      'When a reading finds a date, it lands here for you to confirm or set right.')
  })
  test('never "overdue", "done", "AI" or "compliant" — on either file', () => {
    for (const f of ['lib/calendarQueue.ts', 'components/DateQueue.tsx']) {
      // The strings a person reads, not the prose explaining them: single and double quoted text
      // plus JSX, which is what `code()` leaves behind.
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const banned of [/\boverdue\b/i, /\bdone\b/i, /\bAI\b/, /\bcompliant\b/i]) {
        assert.ok(!banned.test(code), `${f} must not say ${banned}`)
      }
    }
  })
})

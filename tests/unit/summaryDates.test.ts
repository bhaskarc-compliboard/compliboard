/**
 * DATES IN A SUMMARY — Calendar C2, board 10, decision 13.
 *
 * *** A DATE IS THE ONE THING IN THIS REPORT A PERSON ACTS ON WITHOUT RE-READING THE CONVERSATION. ***
 * They press "Add to calendar" and it becomes a deadline they plan around. So every one stands on
 * words really in the conversation — the bar `basis` and a fact's `quote` are already held to.
 *
 * Every check below was made to FAIL first, by breaking the check it covers in `lib/summaryReport.ts`
 * and watching this file go red; the note on each says what the break was.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { checkReport, newestTurnAt, type TurnLike, type SummaryReport } from '../../lib/summaryReport.ts'
import { readFileSync } from 'node:fs'
import { dayIsInLine } from '../../lib/calendarDate.ts'

// TWO sources, cited in DIFFERENT paragraphs. That matters: with only one source, a wrong
// citation number is already dropped by `cleanSourceNumbers` as out of range, so check 4's test
// passed with `checkCitations` disabled and proved nothing. It needs a number that is VALID but
// belongs to the other paragraph.
const ANSWER = 'Your air permit must be renewed by 15 March 2027. [1]\n\n'
  + 'You also report emissions every year, by 1 February. [2]'
const SAID = 'We run a coating line in Portland and the permit renewal is 15 March 2027.'
const turns: TurnLike[] = [
  { role: 'user', text: SAID },
  { role: 'assistant', text: ANSWER, sources: [
    { n: 1, title: 'Oregon DEQ — permits', url: 'https://deq.example/permit' },
    { n: 2, title: 'Oregon DEQ — reporting', url: 'https://deq.example/reporting' },
  ] },
]

function report(dates: unknown): SummaryReport {
  const r = checkReport({
    title: 'Air permit', situation: '', applies: [], to_confirm: [], unanswered: [], facts: [], dates,
  }, turns, '2026-10-09', { basisRequired: true })
  assert.ok(r.ok, r.ok ? '' : r.error)
  return r.report
}
const one = (over: Record<string, unknown> = {}) => ({
  title: 'Renew the air permit', day: '2027-03-15', how_often: null,
  line: 'Your air permit must be renewed by 15 March 2027', sources: [1], ...over,
})

describe('check 1 — the line must be in the conversation', () => {
  test('a line copied from an ANSWER is kept', () => {
    const r = report([one()])
    assert.equal(r.dates?.length, 1)
    assert.equal(r.dates?.[0].title, 'Renew the air permit')
    assert.equal(r.dates_dropped, undefined)
  })

  test('a line copied from the PERSON is kept, and marked as theirs', () => {
    const r = report([one({ line: 'the permit renewal is 15 March 2027', sources: [] })])
    assert.equal(r.dates?.[0].from_person, true)
    assert.deepEqual(r.dates?.[0].sources, [], 'a date the person said cites nothing')
  })

  // BROKEN FIRST BY: removing the `inAnswer && inSaid` guard — the invented date was then kept.
  test('*** A LINE THAT IS NOWHERE IS DROPPED AND COUNTED ***', () => {
    const r = report([one({ line: 'The permit is renewed every five years without exception' })])
    assert.equal(r.dates, undefined, 'nothing invented reaches the screen')
    assert.deepEqual(r.dates_dropped, [{ title: 'Renew the air permit',
      reason: 'its line is not in the conversation' }])
  })

  test('a date with no line at all is dropped, and says so differently', () => {
    assert.equal(report([one({ line: '' })]).dates_dropped?.[0].reason, 'it has no line')
  })
})

describe('check 2 — the day must be in the line', () => {
  // BROKEN FIRST BY: returning true from `dayIsInLine` — "15 March 2027" survived on a line that
  // only said "annually", which is the exact failure a customer plans a year around.
  test('*** A DAY THE LINE DOES NOT CONTAIN IS A DAY THE MODEL WORKED OUT ***', () => {
    const r = report([one({ line: 'You also report emissions every year, by 1 February',
      day: '2027-03-15' })])
    assert.equal(r.dates, undefined)
    assert.equal(r.dates_dropped?.[0].reason, 'its day is not in its line')
  })

  test('a NULL day passes — "within 30 days of hiring" is a real answer', () => {
    const r = report([one({ day: null, line: 'the permit renewal is 15 March 2027', sources: [] })])
    assert.equal(r.dates?.length, 1)
    assert.equal(r.dates?.[0].day, null)
  })

  test('a day that is not a date at all is dropped', () => {
    assert.equal(report([one({ day: 'next March' })]).dates_dropped?.[0].reason, 'its day is not a real date')
  })

  describe('dayIsInLine, on its own', () => {
    test('the month by name, short name or number, in any order', () => {
      for (const line of ['renewed by 15 March 2027', 'due 15 Mar 2027', 'on 2027-03-15',
                          'by 15/03/2027', 'the 15th of March'])
        assert.equal(dayIsInLine('2027-03-15', line), true, line)
    })
    test('a year in the line must match; no year in the line is fine', () => {
      assert.equal(dayIsInLine('2027-03-15', 'renewed by 15 March 2026'), false)
      assert.equal(dayIsInLine('2027-03-15', 'renewed by 15 March'), true,
        'the prompt resolves a bare day and month, so most lines carry no year')
    })
    test('a day number inside another number does not count', () => {
      assert.equal(dayIsInLine('2027-03-15', 'form 2015 is filed in March'), false,
        '"15" inside "2015" is not the 15th')
      assert.equal(dayIsInLine('2027-03-01', 'March 150 of the code'), false)
    })
    test('the month must be there too', () => {
      assert.equal(dayIsInLine('2027-03-15', 'due on the 15th of each period'), false)
    })
  })
})

describe('check 3 — how often stays only if the line says so, AND THE DATE IS KEPT', () => {
  // BROKEN FIRST BY: dropping the `/\b(every|each|annual…)\b/` guard — "every year" stuck to a line
  // that never said it, turning a one-off into a recurring obligation.
  test('*** AN UNSTATED REPEAT IS CLEARED, NOT REFUSED ***', () => {
    const r = report([one({ how_often: 'yearly' })])     // the line says nothing about repeating
    assert.equal(r.dates?.length, 1, 'losing the deadline would be the bigger error')
    assert.equal(r.dates?.[0].how_often, null)
  })

  test('a repeat the line DOES state is kept', () => {
    const r = report([one({ title: 'Report emissions', day: '2027-02-01', how_often: 'yearly',
      line: 'You also report emissions every year, by 1 February', sources: [2] })])
    assert.equal(r.dates?.[0].how_often, 'yearly')
  })

  test('the words a model writes are mapped, not refused', () => {
    const r = report([one({ title: 'Report emissions', day: '2027-02-01', how_often: 'every year',
      line: 'You also report emissions every year, by 1 February', sources: [2] })])
    assert.equal(r.dates?.[0].how_often, 'yearly')
  })
})

describe('check 4 — sources go through checkCitations, as items do', () => {
  // BROKEN FIRST BY: using the model's numbers directly — a date kept a citation to a source that
  // was never in the paragraph its line came from.
  test('*** ONLY A SOURCE CITED IN THAT PARAGRAPH SURVIVES ***', () => {
    // 2 is a real source of this conversation — it is the marker on the OTHER paragraph. That is
    // what makes this a test of `checkCitations` rather than of range-checking.
    const r = report([one({ sources: [1, 2] })])
    assert.deepEqual(r.dates?.[0].sources, [1], '2 is a marker on the other paragraph, not this one')
  })

  test('and a source number that does not exist at all is gone before that', () => {
    assert.deepEqual(report([one({ sources: [1, 9] })]).dates?.[0].sources, [1])
  })
})

describe('check 5 — a malformed dates field behaves exactly as facts do', () => {
  test('a missing field is an empty list, not an error', () => {
    const r = report(undefined)
    assert.equal(r.dates, undefined)
    assert.equal(r.dates_dropped, undefined)
  })
  test('an entry that is not an object is refused, like a fact', () => {
    const r = checkReport({ title: 'T', situation: '', applies: [], to_confirm: [],
      unanswered: [], facts: [], dates: ['15 March'] }, turns, '2026-10-09', { basisRequired: true })
    assert.equal(r.ok, false)
    assert.match(r.ok ? '' : r.error, /date that is not an object/)
  })
  test('a dates field that is not a list at all is refused', () => {
    const r = checkReport({ title: 'T', situation: '', applies: [], to_confirm: [],
      unanswered: [], facts: [], dates: 'none' }, turns, '2026-10-09', { basisRequired: true })
    assert.equal(r.ok, false)
  })
  test('an empty list is a correct answer and reaches the screen as nothing', () => {
    assert.equal(report([]).dates, undefined)
  })
})

// =================================================================================================
// W2 (fix list, severity 1, migration 078) — HOW FAR A SUMMARY READ IS A FACT ABOUT THE TURNS.
// =================================================================================================
describe('newestTurnAt — the coverage a summary records', () => {
  const turn = (created_at: string | null) => ({ role: 'user', text: 'x', created_at })

  test('the newest turn in hand, not "now" — the whole point of the column', () => {
    assert.equal(newestTurnAt([
      turn('2026-10-01T09:00:00Z'), turn('2026-10-01T09:05:00Z'), turn('2026-10-01T09:02:00Z'),
    ]), '2026-10-01T09:05:00Z')
  })

  test('out of order is fine: it compares times, not positions', () => {
    assert.equal(newestTurnAt([turn('2026-10-02T09:00:00Z'), turn('2026-10-01T09:00:00Z')]),
      '2026-10-02T09:00:00Z')
  })

  test('*** it THROWS rather than guessing, and the message names the fix ***', () => {
    // A caller that selects turns without `created_at` cannot record a coverage, and a summary with
    // no coverage is never cleared and re-summarised every night for ever. It is called before any
    // model call, so failing here costs nothing.
    assert.throws(() => newestTurnAt([turn(null), turn(undefined as unknown as null)]),
      /Select created_at with the turns/)
    assert.throws(() => newestTurnAt([]), /Select created_at with the turns/)
    assert.throws(() => newestTurnAt([turn('not a date')]), /Select created_at with the turns/)
  })

  test('one usable stamp among unusable ones is enough', () => {
    assert.equal(newestTurnAt([turn(null), turn('2026-10-01T09:00:00Z')]), '2026-10-01T09:00:00Z')
  })
})

describe('W2: and every caller of summariseTopic selects created_at', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  test('the two per-topic routes go through loadTurns, which selects it', () => {
    assert.match(read('lib/conversation.ts'), /\.select\('id, position, role, text, sources, stopped, created_at/)
    for (const p of ['app/api/topics/[id]/summarise/route.ts', 'app/api/hr/topics/[id]/summarise/route.ts']) {
      assert.match(read(p), /loadTurns\(db, id\)/, p)
    }
  })
  test('the nightly job reads its turns itself, so it names created_at', () => {
    const job = read('app/api/jobs/summarise/route.ts')
    const sel = job.slice(job.indexOf("from('turns')"), job.indexOf("from('turns')") + 300)
    assert.match(sel, /created_at/, 'without it summariseTopic throws before any model call')
  })
  test('the summary write records it', () => {
    assert.match(read('lib/summaryReport.ts'), /summary_covers_through: coversThrough/)
  })
})

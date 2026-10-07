/**
 * THE LIST WORDS — `lib/listWords.ts`, moved out of the workspace page in HR Step 4a and shared with HR.
 * What each helper says, pinned, so the two sections' lists say the same thing and keep saying it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LIST_CAP, countOf, countWord, displayTitle, startOfDay, daysAgo, listGroup, listWhen, summaryWords, fmtDate, groupByDay,
} from '../../lib/listWords.ts'

const NOW = new Date(2026, 9, 7, 15, 0)   // Wed 7 October 2026, 3 pm, local time

describe('counts', () => {
  test('a full read is "60+", never a bare 60', () => {
    assert.equal(LIST_CAP, 60)
    assert.equal(countOf(59), '59')
    assert.equal(countOf(60), '60+')
    assert.equal(countWord(1, 'conversation'), '1 conversation')
    assert.equal(countWord(0, 'handbook'), '0 handbooks')
    assert.equal(countWord(60, 'conversation'), '60+ conversations')
  })
})

describe('a title, as shown', () => {
  test('only a lowercase first letter is raised; everything else is left exactly as stored', () => {
    assert.equal(displayTitle('what does our handbook say'), 'What does our handbook say')
    assert.equal(displayTitle("'m opening a shop"), "'m opening a shop")
    assert.equal(displayTitle('2026 leave policy'), '2026 leave policy')
    assert.equal(displayTitle(null), null)
  })
})

describe('when, in the list', () => {
  const at = (d: number, h = 10, m = 5) => new Date(2026, 9, d, h, m).toISOString()
  test('grouped Today, This week, then by month', () => {
    assert.equal(listGroup(at(7), NOW), 'Today')
    assert.equal(listGroup(at(1), NOW), 'This week')
    assert.equal(listGroup(new Date(2026, 8, 30, 10).toISOString(), NOW), 'September 2026')
  })
  test('a row says the time today, the weekday this week, the date before that', () => {
    assert.equal(listWhen(at(7, 15, 42), NOW), '3:42 pm')
    assert.equal(listWhen(at(5), NOW), 'Mon 5 Oct')
    // en-GB writes September's short form as "Sept" in current ICU, "Sep" in older ones.
    assert.match(listWhen(new Date(2025, 8, 18, 9).toISOString(), NOW), /^18 Sept? 2025$/)
    assert.equal(daysAgo(at(6), NOW), 1)
    assert.equal(startOfDay(NOW), new Date(2026, 9, 7).getTime())
  })
})

describe('what the summary is, in the row\'s words', () => {
  test('three states', () => {
    assert.equal(summaryWords({ summarised_at: null, turnCount: 4 }), 'Not summarised yet')
    assert.equal(summaryWords({ summarised_at: '2026-10-07', turnCount: 4 }), 'Summary ready')
    assert.equal(summaryWords({ summarised_at: '2026-10-07', turnCount: 0 }), 'Summary only — the full conversation was cleared')
  })
})

describe('a date, as Audits writes it', () => {
  test('"7 October 2026"; a day-only date is read as that day; nothing for nothing', () => {
    assert.equal(fmtDate('2026-10-07'), '7 October 2026')
    assert.equal(fmtDate(null), '')
    assert.equal(fmtDate('not a date'), '')
  })
})

describe('grouping by day', () => {
  test('consecutive rows with the same label share a group; order is kept', () => {
    const g = groupByDay(['a1', 'a2', 'b1', 'a3'], (r) => r[0])
    assert.deepEqual(g, [{ day: 'a', rows: ['a1', 'a2'] }, { day: 'b', rows: ['b1'] }, { day: 'a', rows: ['a3'] }])
  })
})

test('lib/listWords.ts imports nothing — client pages read it', () => {
  const src = readFileSync('lib/listWords.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.ok(!/^\s*import\b/m.test(src), 'no import of any kind')
})

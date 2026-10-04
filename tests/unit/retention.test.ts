/**
 * THE 12-MONTH RULE — `lib/retention.ts`, Workspace Task 2.
 *
 * Turns are kept 12 months after the topic's LAST turn. Past that, they are cleared only when a
 * summary written at or after the last turn exists; otherwise the topic is skipped so the nightly
 * summariser can write one first. No conversation loses its turns with nothing kept.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { clearingDecision, clearsAt, clearingCutoff, RETENTION_MONTHS } from '../../lib/retention.ts'

const NOW = new Date('2026-10-03T12:00:00Z')
const monthsAgo = (m: number) => {
  const d = new Date(NOW); d.setUTCMonth(d.getUTCMonth() - m); return d.toISOString()
}

describe('the three cases the owner named', () => {
  test('11 months after the last turn: KEPT', () => {
    const t = { last_turn_at: monthsAgo(11), summarised_at: monthsAgo(11), summary: 'A summary.' }
    assert.equal(clearingDecision(t, NOW), 'keep')
  })
  test('13 months after the last turn, summarised: CLEARED', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(13), summary: 'A summary.' }
    assert.equal(clearingDecision(t, NOW), 'clear')
  })
  test('13 months after the last turn, no summary: SKIPPED', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: null, summary: null }
    assert.equal(clearingDecision(t, NOW), 'skip_no_summary')
  })
})

describe('the edges that would lose a conversation', () => {
  test('a summary older than the last turn does not cover it: skipped', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(14), summary: 'Covers the first half.' }
    assert.equal(clearingDecision(t, NOW), 'skip_no_summary')
  })
  test('a blank summary is no summary', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(13), summary: '   ' }
    assert.equal(clearingDecision(t, NOW), 'skip_no_summary')
  })
  test('a hand summary counts like a nightly one (machinery N2): cleared', () => {
    // summary_source is not an input at all — that is the point.
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(12), summary: 'Written by hand.' }
    assert.equal(clearingDecision(t, NOW), 'clear')
  })
  test('a topic with no turns is never due', () => {
    assert.equal(clearingDecision({ last_turn_at: null, summarised_at: null, summary: null }, NOW), 'keep')
  })
})

describe('the date', () => {
  test('is twelve calendar months after the last turn', () => {
    assert.equal(RETENTION_MONTHS, 12)
    assert.equal(clearsAt('2026-10-03T12:00:00Z')?.toISOString(), '2027-10-03T12:00:00.000Z')
  })
  test('the deleter\'s cutoff is twelve months before now', () => {
    assert.equal(clearingCutoff(NOW).toISOString(), '2025-10-03T12:00:00.000Z')
  })
})

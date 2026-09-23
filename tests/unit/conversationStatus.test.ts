/**
 * WHAT A CONVERSATION ROW SAYS — Run 3, `lib/conversationStatus.ts`.
 *
 * The property worth defending: **"cleared" is decided by whether turns exist, not by whether
 * the date has passed.** `delete_after` says when the transcript MAY go; the nightly deleter
 * says when it DID. Between the two the conversation is still open, and a row claiming
 * otherwise would hide a working button for up to a day.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { conversationStatus, progressLabel, progressPercent, friendlyDate } from '../../lib/conversationStatus.ts'

const NOW = new Date('2026-09-23T12:00:00Z')
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()

describe('the three states come from the real columns', () => {
  test('never summarised', () => {
    const s = conversationStatus({ summarised_at: null }, true, NOW)
    assert.equal(s.state, 'not_summarised')
    assert.equal(s.label, 'Not summarised yet')
  })
  test('summarised, turns present, countdown', () => {
    const s = conversationStatus({ summarised_at: inDays(-1), delete_after: inDays(6) }, true, NOW)
    assert.equal(s.state, 'kept')
    assert.equal(s.label, 'Summarised · full conversation kept 6 more days')
    assert.equal(s.daysLeft, 6)
  })
  test('summarised, turns gone', () => {
    const s = conversationStatus({ summarised_at: inDays(-9), delete_after: inDays(-2) }, false, NOW)
    assert.equal(s.state, 'cleared')
    assert.equal(s.label, 'Summarised · back-and-forth cleared')
  })
})

describe('THE ONE THAT MATTERS: past due but not yet deleted', () => {
  test('turns still exist, so it is KEPT — not "cleared"', () => {
    // delete_after passed two hours ago; the 03:30 deleter has not run.
    const s = conversationStatus({ summarised_at: inDays(-8), delete_after: inDays(-0.08) }, true, NOW)
    assert.equal(s.state, 'kept', 'a row must not claim a deletion that has not happened')
    assert.equal(s.daysLeft, 0)
  })
  test('and once the deleter has run, the same topic reads cleared', () => {
    const s = conversationStatus({ summarised_at: inDays(-8), delete_after: null }, false, NOW)
    assert.equal(s.state, 'cleared')
  })
})

describe('the countdown rounds up', () => {
  test('a few hours left still reads as a day, not zero', () => {
    const s = conversationStatus({ summarised_at: inDays(-7), delete_after: inDays(0.4) }, true, NOW)
    assert.equal(s.daysLeft, 1)
    assert.equal(s.label, 'Summarised · full conversation kept 1 more day', 'singular')
  })
})

describe('summarised by hand, with no deletion date', () => {
  test('says what is true and claims no countdown', () => {
    const s = conversationStatus({ summarised_at: inDays(-1), delete_after: null }, true, NOW)
    assert.equal(s.label, 'Summarised · full conversation kept')
    assert.equal(s.daysLeft, null)
  })
})

describe('progress', () => {
  test('"3 of 11 done"', () => { assert.equal(progressLabel(11, 3), '3 of 11 done') })
  test('an empty checklist does not read "0 of 0 done"', () => {
    assert.equal(progressLabel(0, 0), 'No items yet')
  })
  test('percent is 0 rather than NaN when empty', () => { assert.equal(progressPercent(0, 0), 0) })
  test('percent rounds', () => { assert.equal(progressPercent(11, 3), 27) })
})

describe('friendlyDate', () => {
  test('Today / Yesterday', () => {
    assert.equal(friendlyDate('2026-09-23T09:00:00Z', NOW), 'Today')
    assert.equal(friendlyDate('2026-09-22T09:00:00Z', NOW), 'Yesterday')
  })
  test('this year drops the year', () => {
    assert.equal(friendlyDate('2026-09-19T09:00:00Z', NOW), '19 September')
  })
  test('another year keeps it', () => {
    assert.equal(friendlyDate('2025-09-19T09:00:00Z', NOW), '19 September 2025')
  })
  test('a missing date is empty, not "Invalid Date"', () => {
    assert.equal(friendlyDate(null, NOW), '')
    assert.equal(friendlyDate('nonsense', NOW), '')
  })
})

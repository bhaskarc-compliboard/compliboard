/**
 * THE 12-MONTH RULE — `lib/retention.ts`, Workspace Task 2.
 *
 * Turns are kept 12 months after the topic's LAST turn. Past that, they are cleared only when a
 * summary that READ as far as the last turn exists; otherwise the topic is skipped so the nightly
 * summariser can write one first. No conversation loses its turns with nothing kept.
 *
 * *** THE TEST USED TO BE `summarised_at >= last_turn_at` — fix list W2, severity 1, migration 078.
 * `summarised_at` is when the summary was WRITTEN, which is after the turns it read were loaded. The
 * group at the bottom is the failure, with the old rule copied in beside the new one. ***
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
    const t = { last_turn_at: monthsAgo(11), summarised_at: monthsAgo(11), summary_covers_through: monthsAgo(11), summary: 'A summary.' }
    assert.equal(clearingDecision(t, NOW), 'keep')
  })
  test('13 months after the last turn, summarised: CLEARED', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(13), summary_covers_through: monthsAgo(13), summary: 'A summary.' }
    assert.equal(clearingDecision(t, NOW), 'clear')
  })
  test('13 months after the last turn, no summary: SKIPPED', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: null, summary: null }
    assert.equal(clearingDecision(t, NOW), 'skip_no_summary')
  })
})

describe('the edges that would lose a conversation', () => {
  test('a summary older than the last turn does not cover it: skipped', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(14),
                summary_covers_through: monthsAgo(14), summary: 'Covers the first half.' }
    assert.equal(clearingDecision(t, NOW), 'skip_not_covered')
  })
  test('a blank summary is no summary', () => {
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(13), summary_covers_through: monthsAgo(13), summary: '   ' }
    assert.equal(clearingDecision(t, NOW), 'skip_no_summary')
  })
  test('a hand summary counts like a nightly one (machinery N2): cleared', () => {
    // summary_source is not an input at all — that is the point.
    const t = { last_turn_at: monthsAgo(13), summarised_at: monthsAgo(12), summary_covers_through: monthsAgo(13), summary: 'Written by hand.' }
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

// ===============================================================================================
// W2 (fix list, severity 1, migration 078) — "COVERED" IS HOW FAR IT READ, NOT WHEN IT WAS WRITTEN.
//
// `summarised_at` is stamped at the write. The turns were loaded minutes earlier: the route reads
// them (`:76`), claims (`:85`), calls the model, then writes. A message sent in between is newer
// than anything the model saw and OLDER than `summarised_at`.
// ===============================================================================================
describe('*** W2: a turn sent while the summary was being written ***', () => {
  /** `lib/retention.ts` as it shipped, copied line for line. */
  function oldDecision(t: { last_turn_at: string; summarised_at: string | null; summary: string | null }) {
    const due = clearsAt(t.last_turn_at)
    if (!due || due.getTime() > NOW.getTime()) return 'keep'
    const hasSummary = Boolean(String(t.summary ?? '').trim()) && Boolean(t.summarised_at)
    if (!hasSummary) return 'skip_no_summary'
    if (new Date(t.summarised_at as string).getTime() < new Date(t.last_turn_at).getTime()) return 'skip_no_summary'
    return 'clear'
  }

  // 13 months ago: the turns were loaded at 10:00, the person spoke again at 10:03, and the summary
  // landed at 10:05. The summary contains nothing said at 10:03.
  const loaded = '2025-09-03T10:00:00Z'
  const spoke = '2025-09-03T10:03:00Z'
  const written = '2025-09-03T10:05:00Z'
  const topic = { last_turn_at: spoke, summarised_at: written, summary_covers_through: loaded, summary: 'A summary.' }

  test('the OLD rule cleared it, because the summary was written after the turn', () => {
    assert.equal(oldDecision(topic), 'clear',
      'this is the shipped behaviour, and it deleted a turn no summary contains')
  })

  test('*** the new rule skips it: the coverage stops before the last turn ***', () => {
    assert.equal(clearingDecision(topic, NOW), 'skip_not_covered')
  })

  test('and once it has been summarised again, covering that turn, it clears', () => {
    assert.equal(clearingDecision({ ...topic, summary_covers_through: spoke }, NOW), 'clear')
  })

  test('a coverage we do not have is never a covering one — not an older row, not a new column', () => {
    // Every row written before migration 078 that the backfill could not vouch for is this case.
    assert.equal(clearingDecision({ ...topic, summary_covers_through: null }, NOW), 'skip_not_covered')
    assert.equal(clearingDecision({ ...topic, summary_covers_through: 'not a date' }, NOW), 'skip_not_covered')
  })

  test('the old rule and the new one agree on an unraced conversation, or this would be a regression', () => {
    const quiet = { last_turn_at: '2025-09-03T10:00:00Z', summarised_at: '2025-09-03T10:05:00Z',
                    summary_covers_through: '2025-09-03T10:00:00Z', summary: 'A summary.' }
    assert.equal(oldDecision(quiet), 'clear')
    assert.equal(clearingDecision(quiet, NOW), 'clear')
  })
})

describe('W2: and the deleter itself only deletes on "clear"', () => {
  test('the route tests for clear, rather than deleting on anything it does not recognise', async () => {
    const { readFileSync } = await import('node:fs')
    const route = readFileSync('app/api/jobs/delete/route.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(route, /if \(decision !== 'clear'\) continue/,
      'a reason added to ClearingDecision later must not fall through to the delete')
    assert.match(route, /skipped_not_covered: skippedNotCovered/)
  })
})

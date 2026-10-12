/**
 * *** ONE CLOCK FOR "HOW FAR THE SUMMARY READ" AND "WHEN THE LAST TURN WAS" *** — E10, N1.
 *
 * The independent read of Job E (`docs/reports/jobE-independent-review.md` §1 N1) found this, and
 * two readers found it separately. It is the one fault in Job E that breaks the NORMAL path, and it
 * costs money every night from the first day after release.
 *
 *   - `summary_covers_through` (migration 078) is the newest turn's `created_at` — Postgres's clock,
 *     stamped inside the INSERT (`lib/summaryReport.ts`, `newestTurnAt`).
 *   - `last_turn_at` was written AFTERWARDS by `touchTopic`, from `new Date()` on the app server —
 *     a clock reading taken once the insert had already returned.
 *
 * So `last_turn_at` was always a few milliseconds LATER than the newest turn it stands for, the test
 * `last > covers` was always true, and every conversation summarised after release read as "spoken to
 * since its summary". Every night, for ever: a paid summary call, a person's own summary overwritten
 * (the rule that protects it never applies), the title rewritten, facts proposed again — and
 * `lib/retention.ts` answering `skip_not_covered` for ever, so transcripts are never cleared.
 *
 * *** THE NUMBERS BELOW ARE REAL, MEASURED ON STAGING ON 12 OCTOBER 2026. *** `CLAUDE.md` §9a: show
 * the input, not the conclusion. For each of the 40 most recently summarised conversations,
 * `last_turn_at` minus `max(turns.created_at)` was POSITIVE — between 4.993 ms and 64.646 ms. The
 * three pairs used here are rows `c37814f3`, `08dcf73a` and `afe72f18`, copied out of the query
 * result, not composed. Nothing on staging had yet been summarised by post-Job-E code
 * (`summary_covers_through <> last_turn_at` matched 0 of 86 rows, because migration 078's backfill
 * set the two equal), which is exactly why no measurement found it and why these tests exist.
 *
 * The fix is one clock: the insert's own `created_at` is what `last_turn_at` is set to, so the two
 * columns are the same fact read once. `touchTopic` cannot be called without it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { touchTopic, saveUserTurn, saveAssistantTurn } from '../../lib/conversation.ts'
import { nightlyCandidates } from '../../lib/topicClaim.ts'
import { clearingDecision } from '../../lib/retention.ts'

/** The real pairs, from staging. `turn` is the row's own `created_at`; `touched` is what the old code wrote. */
const MEASURED = [
  { id: 'c37814f3', turn: '2026-10-09T19:02:20.913025Z', touched: '2026-10-09T19:02:20.935Z' },
  { id: '08dcf73a', turn: '2026-10-09T19:02:14.082787Z', touched: '2026-10-09T19:02:14.108Z' },
  { id: 'afe72f18', turn: '2026-10-09T19:00:55.957007Z', touched: '2026-10-09T19:00:55.962Z' },
]

/**
 * A stand-in for the caller's client. The insert answers with a `created_at` the way Postgres does,
 * and every update patch is recorded so the test can read what was written to `last_turn_at`.
 */
function fakeDb(createdAt: string) {
  const updates: Array<Record<string, unknown>> = []
  const inserted: Array<Record<string, unknown>> = []
  const db = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row)
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.single = async () => ({ data: { id: 't1', created_at: createdAt }, error: null })
        q.maybeSingle = q.single
        return Object.assign(q, { then: (f: (v: unknown) => unknown) => f({ error: null }) })
      },
      update: (patch: Record<string, unknown>) => {
        updates.push(patch)
        return { eq: async () => ({ error: null }) }
      },
      select: () => {
        const q: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q
        q.maybeSingle = async () => ({ data: { position: 0, title: 'New conversation' }, error: null })
        q.single = q.maybeSingle
        return q
      },
    }),
  }
  return { db: db as never, updates, inserted }
}

describe('*** N1: the stamp on the conversation IS the turn\'s own created_at ***', () => {
  test('touchTopic writes the turn it was given, not a reading of the local clock', async () => {
    for (const m of MEASURED) {
      const { db, updates } = fakeDb(m.turn)
      await touchTopic(db, 'topic-1', m.turn)
      assert.equal(updates.length, 1)
      assert.equal(updates[0].last_turn_at, m.turn,
        `row ${m.id}: last_turn_at must be the turn's own created_at. The old code wrote ${m.touched}, `
        + `which is ${Date.parse(m.touched) - Date.parse(m.turn)} ms later than the turn it stands for.`)
      // The other two clocks it clears are unchanged — a new turn still un-idles the conversation.
      assert.equal(updates[0].idle_at, null)
      assert.equal(updates[0].delete_after, null)
    }
  })

  test('a question stamps the conversation from the row the database just wrote', async () => {
    const m = MEASURED[0]
    const { db, updates } = fakeDb(m.turn)
    await saveUserTurn(db, { topicId: 'topic-1', companyId: 'co-1', text: 'Do I need a permit?', position: 1 })
    assert.equal(updates.at(-1)?.last_turn_at, m.turn)
  })

  test('an answer stamps it the same way', async () => {
    const m = MEASURED[1]
    const { db, updates } = fakeDb(m.turn)
    await saveAssistantTurn(db, { topicId: 'topic-1', companyId: 'co-1', text: 'Yes.', sources: [], position: 2 })
    assert.equal(updates.at(-1)?.last_turn_at, m.turn)
  })

  test('so the two columns hold ONE value, and the nightly job leaves the conversation alone', () => {
    const now = Date.parse('2026-10-10T12:00:00Z')
    for (const m of MEASURED) {
      // What the old code produced: coverage from the turn, last_turn_at from the app server.
      const old = { id: m.id, summarised_at: '2026-10-09T19:10:00Z', summary_source: 'nightly',
                    last_turn_at: m.touched, summary_covers_through: m.turn }
      assert.equal(nightlyCandidates([old], now).candidates.length, 1,
        `row ${m.id}: this is the defect — ${Date.parse(m.touched) - Date.parse(m.turn)} ms of clock `
        + 'difference makes a summarised conversation a candidate again, every night, for ever.')

      // What one clock produces: the same conversation, left alone.
      const fixed = { ...old, last_turn_at: m.turn }
      assert.equal(nightlyCandidates([fixed], now).candidates.length, 0,
        `row ${m.id}: with one clock there is nothing to re-summarise.`)
    }
  })

  test('and the 12-month clean-up can clear it, instead of skipping it for ever', () => {
    const now = new Date('2027-11-01T00:00:00Z')
    for (const m of MEASURED) {
      assert.equal(clearingDecision({ last_turn_at: m.touched, summarised_at: '2026-10-09T19:10:00Z',
        summary_covers_through: m.turn, summary: 'a summary' }, now), 'skip_not_covered',
        `row ${m.id}: two clocks mean the transcript is never cleared.`)
      assert.equal(clearingDecision({ last_turn_at: m.turn, summarised_at: '2026-10-09T19:10:00Z',
        summary_covers_through: m.turn, summary: 'a summary' }, now), 'clear')
    }
  })

  test('the measured gap was positive in every row read, which is why this is not a rare race', () => {
    for (const m of MEASURED) {
      assert.ok(Date.parse(m.touched) > Date.parse(m.turn),
        `row ${m.id}: the staging measurement must show the app clock LATER than the turn.`)
    }
  })
})

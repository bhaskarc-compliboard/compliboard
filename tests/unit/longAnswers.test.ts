/**
 * *** LONG ANSWERS: THE TWO STOPS, HANDLED PROPERLY *** — the owner's decision **D3**,
 * 12 October 2026 (`docs/reports/jobE-independent-review.md` §7 and §3).
 *
 * Job E's S2 stopped a half-answer being saved, summarised and counted as a whole one. That was
 * right, and nothing then gave the answer more room:
 *
 *   · **the handbook check** paid for a piece that hit the ceiling, put it back, and sent THE SAME
 *     SECTIONS AT THE SAME CEILING next time — two paid calls and no result — and `queueDueChecks`
 *     then re-queued the whole check every night, for ever;
 *   · **chat and HR** stopped at 16,000 and "Try again" stopped there too;
 *   · **`pause_turn`** was treated as a failure, when Anthropic's own handling is to send the
 *     assistant's content back and carry on;
 *   · `lib/answerStream.ts` dropped `topicId` on every outcome but `done`, so an incomplete FIRST
 *     answer left an orphan conversation holding the question;
 *   · and **nothing recorded why any call stopped**, so the question "how often, and on which task"
 *     had no answer anywhere in the product (E9 item 2).
 *
 * The numbers the decision rests on are at the bottom of this file, read from stored answers with
 * no paid run — including the one the owner needs to see: the AUDIT task's own 16,000 ceiling is
 * reached on Opus in five of nine stored golden runs, and D3 did not change it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ANSWER_MAX_TOKENS, finishedCleanly } from '../../lib/answerShape.ts'
import { dueReason, failRows, MAX_ATTEMPTS, PIECE_MAX_TOKENS } from '../../lib/handbookCheck.ts'
import { PART_NOT_CHECKED } from '../../lib/handbooks.ts'
import { describeCost } from '../../lib/costLedger.ts'

const ai = readFileSync('lib/ai.ts', 'utf8')
const check = readFileSync('lib/handbookCheck.ts', 'utf8')

/** Records every write, so what was asked of the database is read off the writes. */
function fakeDb() {
  const updates: Array<{ values: Record<string, unknown>; filters: string[] }> = []
  const db = {
    from: () => {
      const cur: { values: Record<string, unknown>; filters: string[] } = { values: {}, filters: [] }
      const q: Record<string, unknown> = {}
      q.update = (v: Record<string, unknown>) => { cur.values = v; updates.push(cur); return q }
      q.eq = (k: string, v: unknown) => { cur.filters.push(`eq:${k},${String(v)}`); return q }
      q.in = (k: string, v: unknown[]) => { cur.filters.push(`in:${k},${v.join('|')}`); return q }
      q.select = () => q
      q.then = (ok: (x: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
      return q
    },
  }
  return { db: db as never, updates }
}

describe('*** D3.1: `pause_turn` is not a failure — it continues, up to 3 times ***', () => {
  test('the stream is a loop, and the assistant\'s own content goes back as the next turn', () => {
    assert.match(ai, /const PAUSE_CONTINUATIONS = 3/)
    assert.match(ai, /if \(stopReason === 'pause_turn' && pauses < PAUSE_CONTINUATIONS\) \{/)
    assert.match(ai, /convo\.push\(\{ role: 'assistant', content: final\.content as never \}\)/)
    // The loop sends the GROWING conversation, not the original messages.
    assert.match(ai, /messages: convo\.map\(\(m\) => \(\{ role: m\.role, content: m\.content as any \}\)\)/)
  })

  test('a continued answer is ONE answer to its caller: one `done`, all the text, one ledger row', () => {
    assert.match(ai, /const content: Array<Record<string, unknown>> = \[\]/)
    assert.match(ai, /content\.push\(\.\.\.\(final\.content as unknown as Array<Record<string, unknown>>\)\)/)
    assert.match(ai, /answer: openAnswer\(content\),/)
    assert.match(ai, /searched: searchResults\(content\),/)
    // The tokens of every continuation are added up — one answer, one row, as `askAI` already does.
    assert.match(ai, /ledgerIn \+= \(final as any\)\.usage\?\.input_tokens \?\? 0/)
    assert.match(ai, /ledgerOut \+= \(final as any\)\.usage\?\.output_tokens \?\? 0/)
  })

  test('the narration rule still holds across a continuation', () => {
    // `sawToolUse` and `emittedText` are declared OUTSIDE the loop, so a search part-way through a
    // continuation still withdraws what has been shown — the rule would be lost if they reset.
    const outside = ai.indexOf('let sawToolUse = false')
    const loop = ai.indexOf('  for (;;) {', outside)
    assert.ok(outside > 0 && loop > outside, 'the narration state must be hoisted above the loop')
  })

  test('and `pause_turn` is still NOT "finished" — a paused answer that stops being continued is incomplete', () => {
    assert.deepEqual(finishedCleanly('pause_turn'),
      { complete: false, why: 'the answer was paused part-way through' })
    assert.deepEqual(finishedCleanly('end_turn'), { complete: true })
  })
})

describe('*** D3.2: the ceiling, and the conversation an incomplete answer keeps ***', () => {
  test('32,000 for the Workspace chat answer and the HR answer, from one constant', () => {
    assert.equal(ANSWER_MAX_TOKENS, 32000)
    assert.match(readFileSync('app/api/chat/route.ts', 'utf8'),
      /\{ task: 'prose', maxTokens: ANSWER_MAX_TOKENS, signal: request\.signal,/)
    assert.match(readFileSync('app/api/hr/answer/route.ts', 'utf8'),
      /\{ task: 'hr', maxTokens: ANSWER_MAX_TOKENS, signal: request\.signal,/)
  })

  test('and nothing else moved — "other tasks are unchanged" (D3.2)', () => {
    // The audit, the checklist conversion, the document scan and the handbook check each keep
    // their own 16,000. The numbers at the bottom of this file say what that costs the audit.
    assert.equal(PIECE_MAX_TOKENS, 16000)
    assert.match(readFileSync('lib/auditRun.ts', 'utf8'), /maxTokens: 16000, enableWebSearch: true,/)
    assert.match(readFileSync('lib/documentScan.ts', 'utf8'), /maxTokens: 16000,/)
  })

  test('every outcome carries the conversation, so an incomplete FIRST answer is not orphaned', () => {
    const s = readFileSync('lib/answerStream.ts', 'utf8')
    for (const kind of ['stopped_early', 'stopped_by_user', 'failed']) {
      assert.match(s, new RegExp(`kind: '${kind}'[^}]*topicId`), `${kind} must carry topicId`)
    }
    // And both pages read it before they branch on the outcome.
    for (const page of ['app/compliance/page.tsx', 'app/hr/HrWorkspace.tsx']) {
      const p = readFileSync(page, 'utf8')
      const read = p.indexOf('if (outcome.topicId) setTopicId(outcome.topicId)')
      const branch = p.indexOf("outcome.kind === 'done'")
      assert.ok(read > 0 && read < branch, `${page} must keep the conversation whatever the answer did`)
    }
  })
})

describe('*** D3.3: the handbook check splits instead of repeating, and then waits ***', () => {
  test('a piece that ran out of room is divided in two at a section break', () => {
    assert.match(check, /if \(ev\.stopReason === 'max_tokens' && rows\.length > 1\) \{/)
    assert.match(check, /const half = Math\.floor\(rows\.length \/ 2\)/)
    assert.match(check, /const halves = \[rows\.slice\(0, half\), rows\.slice\(half\)\]/)
    // Back to 'queued' with NO attempt counted: dividing the work is not a second try at it.
    assert.match(check, /\.update\(\{ status: 'queued', claimed_at: null, started_at: null, failed_reason: null \}\)\s*\n?\s*\.in\('id', rows\.map\(\(r\) => r\.id\)\)\.eq\('status', 'checking'\)/)
    // And each half is checked now, not next night.
    assert.match(check, /const r = await runPiece\(admin, h\.map\(\(x\) => x\.id\), opts\)/)
  })

  test('one section that still will not fit is failed in the owner\'s words, and not retried', () => {
    assert.match(check, /status: 'failed', failed_reason: PART_NOT_CHECKED/)
    assert.equal(PART_NOT_CHECKED,
      "We could not check this part. That's on our side, not yours. Press Check now to try again.")
    // It says whose problem it is and what to do, and never names what does the reading.
    assert.ok(!/\bAI\b/i.test(PART_NOT_CHECKED))
  })

  test('*** and it is not re-queued every night for ever ***', () => {
    const NOW = Date.parse('2026-10-12T10:00:00Z')
    // Never checked, never failed: due, as before.
    assert.equal(dueReason({ version_of: null, next_check_at: null }, false, NOW), 'new_handbook')
    assert.equal(dueReason({ version_of: 'old', next_check_at: null }, false, NOW), 'new_version')
    // FAILED: not due. This is the loop the independent read's §3 found — every night, a paid call
    // for an answer that could not be given.
    assert.equal(dueReason({ version_of: null, next_check_at: null }, false, NOW, true), null)
    assert.equal(dueReason({ version_of: 'old', next_check_at: null }, false, NOW, true), null)
    // A check that DID finish is still scheduled 90 days on, failed or not.
    assert.equal(dueReason({ version_of: null, next_check_at: '2026-10-12T09:00:00Z' }, true, NOW, true), 'scheduled')
    assert.equal(dueReason({ version_of: null, next_check_at: '2027-02-01T09:00:00Z' }, true, NOW, true), null)
  })

  test('the queue reads both statuses, so a failed check is known about', () => {
    assert.match(check, /\.in\('status', \['done', 'failed'\]\)/)
    assert.match(check, /dueReason\(b, checked\.has\(b\.id\), now, failed\.has\(b\.id\)\)/)
  })
})

describe('*** S12: a failure before the claim used to retry for ever ***', () => {
  test('the put-back matches a row the claim never reached', async () => {
    const { db, updates } = fakeDb()
    await failRows(db, [{ id: 'a', attempts: 0 }], 'the sections could not be read', { started: false })
    assert.ok(updates[0].filters.includes('in:status,queued|checking'),
      'the guard was `.eq("status","checking")`, and two failures happen before a row is ever checking')
  })

  test('and the attempt is counted there, or the put-back is free and the loop never ends', async () => {
    const { db, updates } = fakeDb()
    // Never started, one attempt already: this failure is the second, so the row is FAILED.
    const r = await failRows(db, [{ id: 'a', attempts: MAX_ATTEMPTS - 1 }], 'refused', { started: false })
    assert.deepEqual(r, { retried: 0, failed: 1 })
    assert.equal(updates[0].values.status, 'failed')
    assert.equal(updates[0].values.attempts, MAX_ATTEMPTS)
  })

  test('a row the claim DID reach keeps the count the claim made — never twice', async () => {
    const { db, updates } = fakeDb()
    await failRows(db, [{ id: 'a', attempts: 1 }], 'the answer came back empty')
    assert.equal(updates[0].values.status, 'queued')
    assert.equal(updates[0].values.attempts, 1, 'the claim already counted it')
  })

  test('`fail` tells it which, from the one flag the claim sets', () => {
    assert.match(check, /let claimed = false/)
    assert.match(check, /failRows\(admin, rows, why, \{ started: claimed \}\)/)
    // And the flag flips where the claim happens, not before it.
    assert.ok(check.indexOf('claimed = true') > check.indexOf('let claimed = false'))
  })
})

describe('*** D3.4: every call says why it stopped ***', () => {
  test('both call sites in lib/ai.ts record it, verbatim', () => {
    assert.equal((ai.match(/stopReason: \(message as any\)\.stop_reason \?\? null,/g) ?? []).length, 1)
    // The streaming path reads it once, into a name, because the continuation decision and the
    // ledger row and the `done` event must all be the same reason.
    assert.match(ai, /const stopReason = \(final as any\)\.stop_reason \?\? null/)
    // Once on the ledger row, once on the `done` event the caller reads.
    assert.equal((ai.match(/^\s+stopReason,$/gm) ?? []).length, 2)
  })

  test('the ledger writes the column, and NULL means not recorded', () => {
    const l = readFileSync('lib/costLedger.ts', 'utf8')
    assert.match(l, /stop_reason: row\.stopReason \?\? null,/)
    assert.match(l, /stopReason\?: string \| null/)
    const m = readFileSync('supabase/migrations/080_every_call_says_why_it_stopped.sql', 'utf8')
    assert.match(m, /add column if not exists stop_reason text/)
    assert.ok(!/default/i.test(m.split('comment on column')[0].split('alter table')[1] ?? ''),
      'a default would make "not recorded" indistinguishable from a reason nobody saw')
  })

  test('and the log line carries it too, so it is greppable when the insert fails', () => {
    const row = { companyId: null, task: 'hr' as const, model: 'claude-haiku-4-5', effort: null,
                  inputTokens: 10, outputTokens: 20, searches: 0, wallMs: 1000, stopReason: 'max_tokens' }
    assert.match(describeCost(row), /stop=max_tokens/)
    assert.ok(!describeCost({ ...row, stopReason: null }).includes('stop='),
      'nothing is invented when no reason was recorded')
  })
})

/* ===========================================================================
 * *** D3.5: THE NUMBERS, FROM STORED ANSWERS, WITH NO PAID RUN. ***
 *
 * Read out of `tests/golden/**` on 12 October 2026 — every stored call that carries its own
 * `output_tokens`, which is 80 of them across the audit golden set in both modes and both models.
 * =========================================================================== */
describe('*** D3.5: no golden case comes near the new ceiling — and one comes through the old one ***', () => {
  /** Every stored golden call that recorded its own output tokens. */
  function storedCalls(): Array<{ out: number; model: string; mode: string; file: string }> {
    const out: Array<{ out: number; model: string; mode: string; file: string }> = []
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? walk(p) : (n.endsWith('.json') ? [p] : [])
    })
    for (const f of walk('tests/golden')) {
      let d: Record<string, unknown>
      try { d = JSON.parse(readFileSync(f, 'utf8')) } catch { continue }
      if (!d || typeof d !== 'object' || !Array.isArray(d.calls)) continue
      for (const c of d.calls as Array<Record<string, unknown>>) {
        if (typeof c?.output_tokens === 'number') {
          out.push({ out: c.output_tokens, model: String(d.model ?? ''), mode: String(d.mode ?? ''), file: f })
        }
      }
    }
    return out
  }

  const calls = storedCalls()

  test('the stored set can be seen at all — a check that reads nothing proves nothing (§9a)', () => {
    assert.ok(calls.length >= 60, `expected the stored golden calls to be there; found ${calls.length}`)
    assert.ok(calls.some((c) => c.out > 5000), 'and to include some long answers')
  })

  test('*** not one stored answer comes near 32,000 ***', () => {
    const worst = calls.reduce((a, b) => (b.out > a.out ? b : a))
    assert.ok(worst.out < ANSWER_MAX_TOKENS * 0.7,
      `the largest stored answer is ${worst.out} tokens (${worst.file}); the new ceiling is `
      + `${ANSWER_MAX_TOKENS}, so no golden case is near it`)
    assert.equal(calls.filter((c) => c.out >= ANSWER_MAX_TOKENS).length, 0)
  })

  test('on Haiku — what every build and every test of Claude Code\'s runs on — nothing is close', () => {
    const haiku = calls.filter((c) => c.model.includes('haiku'))
    assert.ok(haiku.length >= 50, `expected the Haiku runs; found ${haiku.length}`)
    const worst = haiku.reduce((a, b) => (b.out > a.out ? b : a))
    assert.ok(worst.out < 10000, `the largest Haiku answer is ${worst.out} tokens`)
  })

  /**
   * *** AND THE ONE THE OWNER HAS TO SEE. ***
   *
   * The AUDIT task's ceiling is 16,000 (`lib/auditRun.ts`) and D3.2 left it there, deliberately:
   * "other tasks are unchanged". But five of the nine stored whole-mode audit runs on Opus 5.5
   * recorded MORE than 16,000 output tokens — up to 20,254 — and that is only possible because
   * `askAI` hit `max_tokens`, doubled the budget and paid for the answer twice. It is reported
   * rather than changed: what the audit model is given room to say is a quality decision
   * (`CLAUDE.md` §3.1), and it is the owner's.
   */
  test('the audit task DOES reach its own 16,000 ceiling on Opus — reported, not changed', () => {
    const opus = calls.filter((c) => c.model.includes('opus'))
    const over = opus.filter((c) => c.out >= 16000)
    assert.ok(over.length >= 4,
      `expected the stored Opus audit runs that passed 16,000; found ${over.length} of ${opus.length}`)
    const worst = opus.reduce((a, b) => (b.out > a.out ? b : a))
    assert.ok(worst.out > 20000, `the largest is ${worst.out} tokens`)
    // And it is still 16,000 in the code, which is what makes this a finding and not a fix.
    assert.match(readFileSync('lib/auditRun.ts', 'utf8'), /maxTokens: 16000, enableWebSearch: true,/)
  })
})

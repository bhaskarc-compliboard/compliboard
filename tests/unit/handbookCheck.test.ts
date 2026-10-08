/**
 * THE HANDBOOK CHECK — HR Step 8, part 1: packing, what code does with an answer (quotes, links, the final word,
 * dates, "not covered"), the retry rule, the prompts as accepted, the routes' guards, migration 071. No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  packPieces, failRows, recoverStuck, finishCheckIfDone, pieceChars, CHECK_QUESTION,
  MAX_ATTEMPTS, NEXT_CHECK_DAYS, ALREADY_CHECKING, REASONS, type PackRow,
} from '../../lib/handbookCheck.ts'
import { TOKENS_PER_CHAR, OPUS_HANDBOOK_BUDGET_TOKENS, budgetTokens } from '../../lib/hrAnswer.ts'
import { checkParts, partsNotChecked, type RowIn } from '../../lib/handbookCheckView.ts'
import { checkLine, readAgainNote, PART_NOT_CHECKED, HANDBOOKS_TAB_LINE, uploadLede } from '../../lib/handbooks.ts'
import { markNotFound, NOT_IN_HANDBOOK, NOT_IN_HANDBOOK_HREF } from '../../lib/hrAnswerWords.ts'

const row = (id: string, position: number, chars: number, checkId = 'c1'): PackRow => ({ id, checkId, kind: 'section', position, chars })

describe('THE SIZE RULE (owner, Baseline Step 1): the whole handbook when it fits, otherwise consecutive sections', () => {
  test('the default budget is Opus 5.5\'s one-call room for handbooks, at the documented 0.4 tokens a character', () => {
    const old = process.env.HR_HANDBOOK_BUDGET_TOKENS; delete process.env.HR_HANDBOOK_BUDGET_TOKENS
    try {
      assert.equal(OPUS_HANDBOOK_BUDGET_TOKENS, 650_000); assert.equal(TOKENS_PER_CHAR, 0.4)
      assert.equal(budgetTokens(), 650_000)
      assert.equal(pieceChars(), 1_625_000, 'about 1.6 million characters of handbook in one call')
    } finally { if (old !== undefined) process.env.HR_HANDBOOK_BUDGET_TOKENS = old }
  })
  test('the staging handbooks are each ONE piece by default (Cascade, 628,255 characters, is the largest)', () => {
    const cascade = Array.from({ length: 39 }, (_, i) => row(`s${i}`, i, Math.round(628_255 / 39)))
    assert.equal(packPieces(cascade, 1_625_000).length, 1)
  })
  test('above the size: consecutive sections up to it; a section longer than the size is alone', () => {
    const p = packPieces([row('a', 0, 10_000), row('b', 1, 20_000), row('c', 2, 15_000), row('d', 3, 50_000), row('e', 4, 100)], 40_000)
    assert.deepEqual(p.map((x) => x.map((r) => r.id)), [['a', 'b'], ['c'], ['d'], ['e']])
  })
  test('only neighbours: a gap in positions starts a new piece; two checks never share one', () => {
    const p = packPieces([row('a', 0, 10), row('c', 2, 10), row('x', 0, 10, 'c2')])
    assert.deepEqual(p.map((x) => x.map((r) => r.id)), [['a'], ['c'], ['x']])
  })
})

/** A stand-in database that records each update and answers selects from a fixed list. */
function fakeDb(selectRows: unknown[] = []) {
  const updates: Array<{ table: string; values: Record<string, unknown>; filters: string[] }> = []
  const from = (table: string) => {
    const filters: string[] = []
    let values: Record<string, unknown> | null = null
    const q: Record<string, unknown> = {}
    const chain = (name: string) => (...a: unknown[]) => { filters.push(`${name}:${a.join(',')}`); return q }
    for (const m of ['eq', 'lt', 'in', 'is', 'order', 'limit', 'neq', 'gte']) q[m] = chain(m)
    q.update = (v: Record<string, unknown>) => { values = v; updates.push({ table, values: v, filters }); return q }
    q.select = () => q
    q.then = (res: (v: unknown) => void) => res({ data: values ? [{ id: 'x', handbook_id: 'h1' }] : selectRows, error: null })
    return q
  }
  return { db: { from }, updates }
}

describe('a failed piece is retried once, then failed with its reason (the owner)', () => {
  test('first failure: back to the queue, no reason; second: failed, with the reason', async () => {
    const { db, updates } = fakeDb()
    const r = await failRows(db, [{ id: 'a', attempts: 1 }, { id: 'b', attempts: MAX_ATTEMPTS }], 'The answer did not parse')
    assert.deepEqual(r, { retried: 1, failed: 1 })
    assert.equal(updates[0].values.status, 'queued'); assert.equal(updates[0].values.failed_reason, null)
    assert.equal(updates[1].values.status, 'failed'); assert.equal(updates[1].values.failed_reason, 'The answer did not parse')
  })
  test('a crashed claim (checking, older than 15 minutes): put back once, then failed; guarded on the claim still being old', async () => {
    const { db, updates } = fakeDb([{ id: 'a', attempts: 1 }, { id: 'b', attempts: 2 }])
    await recoverStuck(db, Date.parse('2026-10-08T12:00:00Z'))
    assert.equal(updates[0].values.status, 'queued')
    assert.equal(updates[1].values.status, 'failed'); assert.equal(updates[1].values.failed_reason, REASONS.crashedTwice)
    assert.ok(updates[0].filters.includes('lt:claimed_at,2026-10-08T11:45:00.000Z'))
  })
  test('EVERY SECTION FAILED: failed, no checked_at or next_check_at — even when a "not covered" row (before the baseline) worked', async () => {
    const d = fakeDb([{ kind: 'section', status: 'failed' }, { kind: 'section', status: 'failed' }, { kind: 'not_covered', status: 'done' }])
    const r = await finishCheckIfDone(d.db, 'c1')
    assert.equal(r.status, 'failed')
    assert.ok(!d.updates.some((u) => u.table === 'handbooks'), 'the handbook is never marked checked')
  })
  test('a check whose rows all failed is failed and sets no next check; otherwise done, +90 days', async () => {
    const failedAll = fakeDb([{ kind: 'section', status: 'failed' }, { kind: 'not_covered', status: 'failed' }])
    assert.equal((await finishCheckIfDone(failedAll.db, 'c1')).status, 'failed')
    assert.ok(!failedAll.updates.some((u) => u.table === 'handbooks'))
    const mixed = fakeDb([{ kind: 'section', status: 'done' }, { kind: 'section', status: 'failed' }, { kind: 'not_covered', status: 'done' }])
    const fin = await finishCheckIfDone(mixed.db, 'c1')
    assert.equal(fin.status, 'done'); assert.equal(fin.done, 2)
    const hb = mixed.updates.find((u) => u.table === 'handbooks')!
    assert.equal(Date.parse(hb.values.next_check_at as string) - Date.parse(hb.values.checked_at as string), NEXT_CHECK_DAYS * 86_400_000)
  })
  test('still running: done_count only, no finish', async () => {
    const r = await finishCheckIfDone(fakeDb([{ kind: 'section', status: 'done' }, { kind: 'section', status: 'checking' }]).db, 'c1')
    assert.deepEqual(r, { finished: false, done: 1, total: 2 })
  })
})

describe('the routes and the migration', () => {
  const check = readFileSync('app/api/hr/handbooks/[id]/check/route.ts', 'utf8')
  const sweep = readFileSync('app/api/jobs/handbook-checks/route.ts', 'utf8')
  test('Check now: the preview switch before the session; the person reads the handbook; 409 with the owner\'s words; 202 and after()', () => {
    assert.ok(check.indexOf('hrPreviewOn()') < check.indexOf('requireCompany(request)'))
    assert.match(check, /await db\.from\('handbooks'\)\.select\('id'\)\.eq\('id', id\)\.maybeSingle\(\)/)
    assert.match(check, /if \(made\.reason === 'already'\) return NextResponse\.json\(\{ error: ALREADY_CHECKING \}, \{ status: 409 \}\)/)
    assert.equal(ALREADY_CHECKING, 'This handbook is already being checked.')
    assert.ok(check.indexOf('after(async') < check.indexOf('{ status: 202 }'))
  })
  test('the sweep: the preview switch first, then the cron secret; no vercel.json entry yet (step 10)', () => {
    assert.ok(sweep.indexOf('hrPreviewOn()') < sweep.indexOf('requireCronSecret(request)'))
    assert.ok(!readFileSync('vercel.json', 'utf8').includes('handbook-checks'))
  })
  test('migration 071 proves its rules on probe rows of its own, and removes them', () => {
    const m = readFileSync('supabase/migrations/071_handbook_check_runs.sql', 'utf8')
    assert.match(m, /insert into public\.companies \(name, industry, state\) values \('Migration 071 probe'/)
    assert.match(m, /exception when unique_violation then refused := true;/)
    assert.match(m, /delete from public\.companies where id = co;/)
    assert.match(m, /create unique index if not exists idx_handbook_checks_one_open\s+on public\.handbook_checks \(handbook_id\) where status in \('queued', 'checking'\);/)
  })
  test('Audits\' files are not touched by this step: the sweep is a copy', () => {
    assert.ok(!readFileSync('lib/handbookCheck.ts', 'utf8').includes("from './auditRun"))
  })
})

describe('A PIECE IS AN HR ANSWER (owner, Baseline Step 1)', () => {
  const engine = readFileSync('lib/handbookCheck.ts', 'utf8')
  test('the one question, word for word', () => {
    assert.equal(CHECK_QUESTION, "Check this handbook against the rules that apply to us. What needs to change, what's missing, and what's unclear?")
  })
  test('the answer route\'s own call: hrAnswerPrompt(), hrAnswerMessage with the company and the sections, no search limit, task hr_check', () => {
    assert.match(engine, /hrAnswerMessage\(company, handbooks, CHECK_QUESTION\)/)
    assert.match(engine, /const system = hrAnswerPrompt\(\)/)
    assert.match(engine, /ask\(system, messages, \{ task: 'hr_check', maxTokens: PIECE_MAX_TOKENS, ledger: \{ companyId, task: 'hr_check' \} \}\)/)
    assert.ok(!/maxSearches|outputSchema|hr-check\.ts|hr-not-covered\.ts|not_covered', section_id: null/.test(engine), 'no limit, no schema, no structured prompt, no separate "not covered" row')
  })
  test('at done, finishAnswer exactly as the answer route uses it, and the answer, its sources and its record stored (072)', () => {
    assert.match(engine, /finishAnswer\(ev\.answer\.text, ev\.answer\.sources, ev\.searched, blocks, used, ev\.cited \?\? \[\]\)/)
    assert.match(engine, /answer_text: text, answer_sources: fin\.sources, check_record: record/)
  })
  test('migration 072 proves its rules on probe rows of its own, and removes them', () => {
    const m = readFileSync('supabase/migrations/072_handbook_check_answers.sql', 'utf8')
    assert.match(m, /insert into public\.companies \(name, industry, state\) values \('Migration 072 probe'/)
    assert.match(m, /check \(answer_text is null or length\(btrim\(answer_text\)\) > 0\)/)
    assert.match(m, /delete from public\.companies where id = co;/)
  })
})

describe('THE CHECK ON SCREEN: its parts, the row, the words', () => {
  const r = (id: string, sec: string, status: string, answer: string | null = null): RowIn =>
    ({ id, section_id: sec, kind: 'section', status, word: null, answer_text: answer, answer_sources: answer ? [] : null })
  const pos = (id: string | null) => Number(String(id).slice(1))
  test('an answer starts a part; its piece\'s other rows join it; a run of failed rows is ONE part not checked', () => {
    const parts = checkParts([r('1', 's0', 'done', 'A.'), r('2', 's1', 'done'), r('3', 's2', 'failed'), r('4', 's3', 'failed'), r('5', 's4', 'done', 'B.'), r('6', 's5', 'cancelled')], pos, () => '', () => [])
    assert.deepEqual(parts.map((p) => p.kind === 'answer' ? p.text : p.kind), ['A.', 'failed', 'B.'])
    assert.equal(partsNotChecked(parts), 1)
  })
  test('a check stored before the baseline (no answers) is shown as it was stored, section by section', () => {
    const old = [{ ...r('1', 's0', 'done'), word: 'needs_change' }, r('2', 's1', 'failed')]
    const parts = checkParts(old, pos, (id) => `title ${id}`, (rid) => rid === '1' ? [{ title: 'F', why: null, what_to_change: 'X' }] : [])
    assert.deepEqual(parts, [
      { kind: 'legacy', title: 'title s0', word: 'needs_change', failed: false, findings: [{ title: 'F', why: null, what_to_change: 'X' }] },
      { kind: 'legacy', title: 'title s1', word: null, failed: true, findings: [] }])
    assert.equal(partsNotChecked(parts), 1)
  })
  test('the row (owner): not checked; checking; checked · read again; parts not checked in amber; a failed check', () => {
    const day = (iso: string) => iso.slice(0, 10)
    const words = (c: Parameters<typeof checkLine>[0]) => checkLine(c, day).map((p) => (p.amber ? `[${p.text}]` : p.text)).join(' · ')
    const base = { open: null, last: null, checkedAt: null, nextCheckAt: null }
    const done = { ...base, checkedAt: '2026-10-08T05:00:00Z', nextCheckAt: '2027-01-06T05:00:00Z' }
    assert.equal(words(base), 'Not checked yet')
    assert.equal(words({ ...base, open: { done: 3, total: 10 } }), 'Checking 3 of 10…')
    assert.equal(words({ ...done, last: { status: 'done', notChecked: 0 } }), 'Checked 2026-10-08 · read again 2027-01-06')
    assert.equal(words({ ...done, last: { status: 'done', notChecked: 1 } }), 'Checked 2026-10-08 · read again 2027-01-06 · [1 part not checked]')
    assert.equal(words({ ...done, last: { status: 'done', notChecked: 2 } }), 'Checked 2026-10-08 · read again 2027-01-06 · [2 parts not checked]')
    assert.equal(words({ ...base, last: { status: 'failed', notChecked: 1 } }), '[The check could not finish — press Check now to try again]')
  })
  test('the owner\'s words: the read-again note, a failed part, the two lines that were untrue', () => {
    assert.equal(readAgainNote('6 January 2027'), 'We will read this handbook again on 6 January 2027. Changed it before then? Add the new version, or press Check now.')
    assert.equal(PART_NOT_CHECKED, "We could not check this part. That's on our side, not yours. Press Check now to try again.")
    assert.equal(HANDBOOKS_TAB_LINE, 'Press Check now on a handbook to check it against the rules that apply to you.')
    assert.equal(uploadLede('Handbook.pdf'), 'Handbook.pdf. We read it in about a minute. It stays here in HR.')
    const page = readFileSync('app/hr/new/HrWorkspace.tsx', 'utf8')
    assert.ok(!page.includes('checked the night it arrives') && !page.includes('check it tonight'))
  })
  test('THE GREY MARK: the words stay, the mark becomes a grey note the shared renderer draws (and nothing else)', () => {
    assert.equal(NOT_IN_HANDBOOK, '(not a quote from your handbook)')
    assert.equal(markNotFound(`It says "a b c d e f" ${NOT_IN_HANDBOOK}.`), `It says "a b c d e f" [${NOT_IN_HANDBOOK}](#grey-note).`)
    // an answer stored with the first wording (staging, before the owner's answer) still draws its mark grey
    assert.equal(markNotFound('It says "a b c d e f" (not found in your handbook).'), 'It says "a b c d e f" [(not found in your handbook)](#grey-note).')
    const body = readFileSync('components/AnswerBody.tsx', 'utf8')
    assert.match(body, /export const GREY_NOTE_HREF = '#grey-note'/)
    assert.equal(NOT_IN_HANDBOOK_HREF, '#grey-note')
    assert.match(body, /if \(p\.href === GREY_NOTE_HREF\) return <span className="font-sans text-\[13px\] text-gray-400">\{p\.children\}<\/span>/)
  })
  test('the drawer draws each part with the Ask tab\'s own component; footer order Check now, Open, Add a newer version, Download, Delete', () => {
    const page = readFileSync('app/hr/new/HrWorkspace.tsx', 'utf8')
    assert.match(page, /<HrAnswerView body=\{body\} lines=\{x\.phase === 'done' \? lines : \[\]\} sources=\{x\.sources\} \/>/)
    assert.match(page, /<HrAnswerView \{\.\.\.\(\(\) => \{ const a = splitAppended\(p\.text\)/)
    const order = ['>Check now<', '>Open the handbook<', '>Add a newer version<', '>Download<', '>Delete<'].map((x) => page.lastIndexOf(x))
    assert.deepEqual([...order].sort((a, b) => a - b), order)
  })
})

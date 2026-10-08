/**
 * THE HANDBOOK CHECK — HR Step 8, part 1: packing, what code does with an answer (quotes, links, the final word,
 * dates, "not covered"), the retry rule, the prompts as accepted, the routes' guards, migration 071. No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  packPieces, decideWord, shapePiece, shapeNotCovered, failRows, recoverStuck, finishCheckIfDone,
  PIECE_CHARS, MAX_ATTEMPTS, NEXT_CHECK_DAYS, ALREADY_CHECKING, REASONS, type PackRow, type ShapedFinding,
} from '../../lib/handbookCheck.ts'
import type { Block, HandbookUsed } from '../../lib/hrAnswer.ts'

const row = (id: string, position: number, chars: number, checkId = 'c1'): PackRow => ({ id, checkId, kind: 'section', position, chars })

describe('packing: neighbours up to 40,000 characters, "not covered" alone', () => {
  test('neighbours go together while they fit; a long section is alone; not covered is last and alone', () => {
    const p = packPieces([row('a', 0, 10_000), row('b', 1, 20_000), row('c', 2, 15_000), row('d', 3, 50_000), row('e', 4, 100),
      { id: 'n', checkId: 'c1', kind: 'not_covered', position: Number.MAX_SAFE_INTEGER, chars: 0 }])
    assert.deepEqual(p.map((x) => x.map((r) => r.id)), [['a', 'b'], ['c'], ['d'], ['e'], ['n']])
    assert.equal(PIECE_CHARS, 40_000)
  })
  test('only neighbours: a gap in positions starts a new piece; two checks never share one', () => {
    const p = packPieces([row('a', 0, 10), row('c', 2, 10), row('x', 0, 10, 'c2')])
    assert.deepEqual(p.map((x) => x.map((r) => r.id)), [['a'], ['c'], ['x']])
  })
})

const f = (over: Partial<ShapedFinding>): ShapedFinding => ({ kind: 'change', title: 't', why: null, what_to_change: null,
  handbook_quote: null, quote_verified: null, page: null, sources: [], ...over })
const official = { url: 'https://www.oregon.gov/boli/sick', title: 'BOLI', official: true }

describe('THE FINAL WORD IS CODE\'S (the owner)', () => {
  test('needs_change only with a change that has a checked link', () => {
    assert.equal(decideWord('needs_change', [f({ sources: [official] })]).word, 'needs_change')
    assert.equal(decideWord('no_gap', [f({ sources: [official] })]).word, 'needs_change')
  })
  test('a change with no checked link becomes a question, and the section to_confirm — NEVER no_gap', () => {
    const d = decideWord('needs_change', [f({})])
    assert.equal(d.word, 'to_confirm')
    assert.equal(d.findings[0].kind, 'to_confirm')
    assert.match(d.findings[0].moved ?? '', /no checked link/)
    assert.equal(decideWord('needs_change', []).word, 'to_confirm')
  })
  test('open questions make it to_confirm; no_gap and company_choice stand only with nothing found; unknown is to_confirm', () => {
    assert.equal(decideWord('no_gap', [f({ kind: 'to_confirm' })]).word, 'to_confirm')
    assert.equal(decideWord('no_gap', []).word, 'no_gap')
    assert.equal(decideWord('company_choice', []).word, 'company_choice')
    assert.equal(decideWord(null, []).word, 'to_confirm')
  })
})

const TEXT = 'Employees accrue one hour of sick time for every 40 hours worked.\fThe company reviews this handbook every January.'
const block: Block = { id: 'S3', handbookId: 'h1', handbookName: 'Riverside', applies: 'every site', sectionId: 's3', title: 'Sick time', pageFrom: 4, pageTo: 5, stored: TEXT }
const used: HandbookUsed[] = [{ id: 'h1', name: 'Riverside', pages: null, text: '', isWord: false }]
const searched = [{ url: 'https://www.oregon.gov/boli/workers/pages/sick-time.aspx', title: 'Oregon Sick Time' }, { url: 'https://example-law-blog.com/sick', title: 'A blog' }]

describe('a piece\'s answer, checked', () => {
  const answer = { sections: [{ id: 'S3', word: 'needs_change', findings: [
    { kind: 'change', title: 'Accrual rate', quote: 'accrue one hour of sick time for every 40 hours', url: 'https://oregon.gov/boli/workers/pages/sick-time.aspx/', why: 'w', what_to_change: 'x' },
    { kind: 'change', title: 'Invented link', quote: 'Employees accrue one hour of sick time', url: 'https://www.oregon.gov/not-searched', why: 'w', what_to_change: 'x' },
    { kind: 'to_confirm', title: 'Made-up quote', quote: 'employees may carry over unlimited hours each year', url: '' },
  ], dates: [
    { title: 'Annual review', quote: 'The company reviews this handbook every January', date: '', repeats: true },
    { title: 'Invented date', quote: 'the handbook is reviewed on the first of June', date: '2027-06-01', repeats: false },
  ] }] }
  const r = shapePiece(answer, [block], used, searched)
  test('the quote is found in the section, with its page across the page break; a made-up quote is flagged', () => {
    assert.ok(r.ok); if (!r.ok) return
    const s = r.sections[0]
    assert.equal(s.findings[0].quote_verified, true); assert.equal(s.findings[0].page, 4)
    assert.equal(s.findings[2].quote_verified, false); assert.equal(s.failedQuotes, 1)
  })
  test('a link counts only when THIS call\'s search returned it, labelled official or other', () => {
    assert.ok(r.ok); if (!r.ok) return
    const s = r.sections[0]
    assert.deepEqual(s.findings[0].sources, [{ url: searched[0].url, title: 'Oregon Sick Time', official: true }])
    assert.deepEqual(s.findings[1].sources, []); assert.equal(s.droppedLinks, 1)
    assert.equal(s.findings[1].kind, 'to_confirm', 'the change with no checked link became a question')
    assert.equal(s.word, 'needs_change', 'one change kept its link')
  })
  test('a date is kept only when its quote checks', () => {
    assert.ok(r.ok); if (!r.ok) return
    assert.deepEqual(r.sections[0].dates, [{ title: 'Annual review', due_date: null, recurs: true, quote: 'The company reviews this handbook every January', page: 5 }])
    assert.equal(r.sections[0].droppedDates, 1)
  })
  test('a section the answer left out is reported missing; a shapeless answer is refused', () => {
    const two = shapePiece({ sections: [] }, [block], used, searched)
    assert.ok(two.ok); if (two.ok) assert.deepEqual(two.missing, ['S3'])
    assert.equal(shapePiece({ nope: 1 }, [block], used, searched).ok, false)
  })
})

describe('"not covered": only with an official link this call\'s search returned', () => {
  test('official and returned counts; other, invented or missing links go to "Still to confirm", with why', () => {
    const r = shapeNotCovered({ not_covered: [
      { title: 'Sick time policy', url: 'https://www.oregon.gov/boli/workers/pages/sick-time.aspx', why: 'w', what_to_add: 'a' },
      { title: 'Blog says', url: 'https://example-law-blog.com/sick', why: 'w', what_to_add: 'a' },
      { title: 'Invented', url: 'https://www.oregon.gov/never', why: 'w', what_to_add: 'a' },
      { title: 'No link', url: '', why: 'w', what_to_add: 'a' },
    ], to_confirm: [{ title: 'Headcount', url: '', why: 'w', what_would_settle_it: 's' }] }, searched)
    assert.ok(r.ok); if (!r.ok) return
    assert.deepEqual(r.findings.map((x) => [x.title, x.kind]), [['Sick time policy', 'not_covered'], ['Blog says', 'to_confirm'],
      ['Invented', 'to_confirm'], ['No link', 'to_confirm'], ['Headcount', 'to_confirm']])
    assert.match(r.findings[1].moved!, /not an official page/)
    assert.match(r.findings[2].moved!, /did not come from this call's search/)
    assert.match(r.findings[3].moved!, /no link given/)
    assert.equal(r.findings[0].what_to_change, 'a'); assert.equal(r.findings[4].what_to_change, 's')
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
  test('EVERY SECTION FAILED: failed, no checked_at or next_check_at — even when the "not covered" pass worked (the owner)', async () => {
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

describe('the prompts as the owner accepted them', () => {
  test('hr-check: the design\'s draft verbatim, with its JSON shape and the date', async () => {
    const { hrCheckPrompt } = await import('../../prompts/hr-check.ts')
    const p = hrCheckPrompt('2026-10-08')
    assert.ok(p.startsWith("You are an HR compliance specialist checking part of a small or mid-size US business's employee handbook against the rules that apply to it."))
    assert.ok(p.includes('- company_choice: it sets a policy that no rule requires or forbids.'))
    assert.ok(p.endsWith('"dates":[{"title":"","quote":"","date":"YYYY-MM-DD or empty","repeats":true}]}]}\nToday is 2026-10-08.'))
  })
  test('hr-not-covered: written policies only — no "notices", no posters', async () => {
    const { hrNotCoveredPrompt } = await import('../../prompts/hr-not-covered.ts')
    const p = hrNotCoveredPrompt('2026-10-08')
    assert.ok(p.includes('Find the written policies that the rules for this company require, and that none of its handbooks has a section for.'))
    assert.ok(p.includes('for the policies they say an employer like this must have in writing.'))
    assert.ok(p.includes('Leave out safety programs that the rules require as their own written programs, such as hazard communication, process safety management or emergency action plans; they are not handbook policies.'))
    assert.ok(!/notice|poster/i.test(p))
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

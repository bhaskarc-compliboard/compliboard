/**
 * HR CONVERSATIONS, THE CHECK RECORD, THE HR SEARCH LIMIT — HR Step 6b. No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { searchLimit } from '../../lib/ai.ts'
import { saveAssistantTurn } from '../../lib/conversation.ts'
import { finishAnswer, checkRecord, type Block, type HandbookUsed } from '../../lib/hrAnswer.ts'
import { NOT_ANSWERED, ASK_IT_AGAIN, ASKED_AGAIN_BELOW, NOT_SUMMARISED_HR, DELETE_CONVERSATION } from '../../lib/hrAnswerWords.ts'

const P1 = 'Harbor Kitchen policy. Employees accrue one hour of paid sick time for every thirty hours worked.'
const hb: HandbookUsed = { id: 'h1', name: 'Harbor Policy', pages: 1, text: P1, isWord: false, as: 'sections', versionOf: 'h0', addedAt: '2026-10-07' }
const blocks: Block[] = [{ id: 'H1', handbookId: 'h1', handbookName: 'Harbor Policy', applies: 'Every site', sectionId: 's1', title: '1. Sick time', pageFrom: 1, pageTo: 1, stored: P1 }]

describe('AI_SEARCH_MAX_HR', () => {
  const run = (v: string | undefined, f: () => unknown) => { const old = process.env.AI_SEARCH_MAX_HR; if (v === undefined) delete process.env.AI_SEARCH_MAX_HR; else process.env.AI_SEARCH_MAX_HR = v; try { return f() } finally { if (old === undefined) delete process.env.AI_SEARCH_MAX_HR; else process.env.AI_SEARCH_MAX_HR = old } }
  test('unset means NO LIMIT (null), as today; set, it is the limit; a bad value is no limit, said loudly', () => {
    assert.equal(run(undefined, () => searchLimit('AI_SEARCH_MAX_HR', null)), null)
    assert.equal(run('1', () => searchLimit('AI_SEARCH_MAX_HR', null)), 1)
    assert.equal(run('zero', () => searchLimit('AI_SEARCH_MAX_HR', null)), null)
  })
  test('the workspace\'s limits are unchanged', () => {
    const old = process.env.AI_SEARCH_MAX_HOWTO; delete process.env.AI_SEARCH_MAX_HOWTO
    try { assert.equal(searchLimit('AI_SEARCH_MAX_HOWTO', 6), 6) } finally { if (old !== undefined) process.env.AI_SEARCH_MAX_HOWTO = old }
  })
  test('the HR route passes it to the search, and only the HR route reads it', () => {
    assert.match(readFileSync('app/api/hr/answer/route.ts', 'utf8'), /const maxSearches = searchLimit\('AI_SEARCH_MAX_HR', null\) \?\? undefined/)
    assert.ok(!readFileSync('app/api/chat/route.ts', 'utf8').includes('AI_SEARCH_MAX_HR'))
  })
})

describe('the check record (migration 069)', () => {
  test('the WORKSPACE\'s insert is unchanged: no check_record key unless one is given', async () => {
    const rows: Array<Record<string, unknown>> = []
    const db = { from: () => ({ insert: (r: Record<string, unknown>) => { rows.push(r); return Promise.resolve({ error: null }) }, update: () => ({ eq: () => Promise.resolve({ error: null }) }) }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveAssistantTurn(db as any, { topicId: 't', companyId: 'c', text: 'x', sources: [], position: 2 })
    assert.deepEqual(Object.keys(rows[0]), ['topic_id', 'company_id', 'position', 'role', 'text', 'sources'])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await saveAssistantTurn(db as any, { topicId: 't', companyId: 'c', text: 'x', sources: [], position: 4, checkRecord: { version: 1 } })
    assert.deepEqual(rows[1].check_record, { version: 1 })
  })
  test('each handbook card says whether it came from a [H…] marker or a plain quote', () => {
    const r = finishAnswer('It says [H1: "Employees accrue one hour of paid sick time"] and "for every thirty hours worked. Employees accrue" no.', [], [], blocks, [hb], [])
    assert.deepEqual(r.origins, [{ n: 1, from: 'marker' }])
    const p = finishAnswer('It says "Employees accrue one hour of paid sick time for every".', [], [], blocks, [hb], [])
    assert.deepEqual(p.origins, [{ n: 1, from: 'plain' }])
    assert.equal(p.text, 'It says “Employees accrue one hour of paid sick time for every”[1].')
  })
  test('what it holds: handbooks given (id, name, version, how), the selection (6c), the wait, searched pages, cited passages, card origins, drops', () => {
    const done = finishAnswer('It says [H1: "Employees accrue one hour of paid sick time"].', [], [], blocks, [hb], [])
    const selections = [{ handbookId: 'big', name: 'Big', callOk: true, chosen: [{ sectionId: 's9', title: '9. Other', by: 'net' as const }], leftForBudget: [] }]
    const rec = checkRecord({ used: [hb], selections, budgetTokens: 50000, searched: [{ url: 'u', title: 't' }], citedPassages: 2, done, waitedSeconds: 12 })
    assert.deepEqual(rec, {
      version: 2,
      handbooks: [{ id: 'h1', name: 'Harbor Policy', version_of: 'h0', added_at: '2026-10-07', given_as: 'sections', pages: 1 }],
      selection: [{ handbook_id: 'big', name: 'Big', call_ok: true, chosen: [{ section_id: 's9', title: '9. Other', by: 'net' }], left_for_budget: [] }],
      waited_seconds: 12, budget_tokens: 50000, searched: [{ url: 'u', title: 't' }], cited_passages: 2,
      handbook_cards: [{ n: 1, from: 'marker' }],
      dropped: { handbook_quotes: 0, unchecked_quotes: 0, web_links: 0 },
      marked: { not_found_quotes: 0, unchecked_quotes: 0 },
    })
  })
  test('the migration verifies the column and who may use it, by reading', () => {
    const m = readFileSync('supabase/migrations/069_hr_answer_check_record.sql', 'utf8')
    assert.match(m, /add column if not exists check_record jsonb;/)
    for (const re of [/has_column_privilege\('authenticated', 'public\.turns', 'check_record', 'INSERT'\)/,
                      /has_column_privilege\('authenticated', 'public\.turns', 'check_record', 'UPDATE'\)/,
                      /has_column_privilege\('anon', 'public\.turns', 'check_record', 'SELECT'\)/]) assert.match(m, re)
  })
})

describe('the HR page\'s conversations', () => {
  const page = readFileSync('app/hr/new/HrWorkspace.tsx', 'utf8')
  test('a row opens the workspace\'s drawer; the drawer opens the topic through the unchanged route', () => {
    assert.match(page, /<ConversationList topics=\{topics\} running=\{\(\) => false\} onOpen=\{setConvDrawer\} \/>/)
    assert.match(page, /fetch\(`\/api\/topics\/\$\{t\.id\}`, \{ headers: await authHeaders\(\) \}\)/)
    assert.match(page, /readTopicList\(supabase, 'hr'\)/)
  })
  test('NOT ANSWERED is decided from the stored turns alone: a question with no answer after it', () => {
    assert.match(page, /const answer = turns\[i \+ 1\]\?\.role === 'assistant' \? turns\[i \+ 1\] : null/)
    assert.match(page, /phase: answer \? 'done' : 'not_answered'/)
    assert.equal(NOT_ANSWERED, 'Not answered.'); assert.equal(ASK_IT_AGAIN, 'Ask it again')
  })
  test('the owner\'s 6b answers: asked again below; the drawer\'s sentence; the handbook drawer\'s scrim; Stop logged as the person\'s', () => {
    assert.equal(ASKED_AGAIN_BELOW, 'Not answered. Asked again below.')
    assert.match(page, /exchanges\.slice\(xi \+ 1\)\.some\(\(y\) => y\.question\.trim\(\) === x\.question\.trim\(\)\)/)
    // Since step 10 summarises HR conversations overnight: the workspace's own sentence, word for word (owner).
    assert.equal(NOT_SUMMARISED_HR, "This one hasn't been summarised yet. The summary is written overnight, and the full conversation is here until then.")
    const ws = readFileSync('app/compliance/page.tsx', 'utf8').replace(/&apos;/g, "'").replace(/\s+/g, ' ')
    assert.ok(ws.includes(NOT_SUMMARISED_HR), 'the same words as the workspace\'s drawer')
    assert.match(page, /\{drawer && \(\s*<div className="no-print fixed inset-0 z-\[45\] bg-gray-900\/30" onClick=\{\(\) => setDrawer\(null\)\} \/>/)
    const route = readFileSync('app/api/hr/answer/route.ts', 'utf8')
    assert.match(route, /if \(request\.signal\.aborted\) \{ console\.log\('hr answer: stopped by the person'\); continue \}/)
    assert.ok(route.indexOf("stopped by the person'); continue") < route.indexOf("console.error('hr answer: stream error:'"))
  })
  test('the delete sheet\'s words (canvas board 11), and Download the summary only when one exists', () => {
    assert.deepEqual(DELETE_CONVERSATION, {
      title: 'Delete this conversation?',
      lede: 'This deletes the conversation and its summary for good. You cannot undo it.',
      note: 'Download the summary first if you may need it. Your handbooks and their checks stay.' })
    assert.match(page, /\{convDrawer\.summary && <button onClick=\{printDrawer\} className=\{OUTLINE\}>Download the summary<\/button>\}/)
    assert.match(page, /fetch\(`\/api\/topics\/\$\{convDrawer\.id\}`, \{ method: 'DELETE'/)
  })
})

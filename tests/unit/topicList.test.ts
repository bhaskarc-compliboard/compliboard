/**
 * THE CONVERSATIONS LIST, READ — `lib/topicList.ts`, HR Step 4a. The section is the read's one parameter.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readTopicList, toTopicRow, TOPIC_LIST_COLUMNS, TOPIC_SECTIONS, type TopicListRow } from '../../lib/topicList.ts'

/** A stand-in for the client that records every call made on the query. */
function fakeDb(rows: unknown[]) {
  const calls: Array<[string, ...unknown[]]> = []
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit']) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q }
  q.then = (res: (v: { data: unknown[] }) => unknown) => res({ data: rows })
  return { calls, db: { from: (t: string) => { calls.push(['from', t]); return q } } }
}

describe('readTopicList', () => {
  // EVERY SECTION, FROM THE ONE LIST THAT DEFINES THEM. It read `['workspace', 'hr']`, so the
  // read was never tested for the section that has been live since the Calendar shipped.
  for (const section of TOPIC_SECTIONS) {
    test(`reads topic_list_v for section '${section}', newest first, at most 60`, async () => {
      const { calls, db } = fakeDb([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await readTopicList(db as any, section)
      assert.deepEqual(calls, [
        ['from', 'topic_list_v'], ['select', TOPIC_LIST_COLUMNS], ['eq', 'section', section],
        ['order', 'last_turn_at', { ascending: false, nullsFirst: false }], ['order', 'created_at', { ascending: false }],
        ['limit', 60],
      ])
    })
  }
  test('rows are mapped to the page\'s shape', async () => {
    const row: TopicListRow = { id: 't1', title: 'x', summary: null, summarised_at: null, summary_source: null,
      delete_after: null, last_turn_at: null, created_at: '2026-10-07', has_report: false, turn_count: 2,
      question_count: 1, document_count: 0, first_document_name: null, checklist_id: null, checklist_total: 0,
      checklist_done: 0, summary_in_progress: false, checklist_in_progress: false }
    const { db } = fakeDb([row])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.deepEqual(await readTopicList(db as any, 'hr'), [toTopicRow(row)])
    assert.equal(toTopicRow(row).turnCount, 2)
  })
  test('the workspace reads its own section through it', () => {
    assert.match(readFileSync('app/compliance/page.tsx', 'utf8'), /readTopicList\(supabase, 'workspace'\)/)
  })
})

/**
 * *** THE SECTION WORDS ARE CHECKED AGAINST THE CONSTRAINT THAT POLICES THEM — new at
 * `docs/GAPS-PLAN.md` Part A step 1. ***
 *
 * `tests/unit/costLedger.test.ts` has done this for `ai_calls_task_check` since `document_scan` was
 * added and the CHECK refused it. Nothing did it for `topics.section`: the TypeScript union and the
 * database CHECK were two hand-kept lists with no test between them, and a section the code writes
 * and the constraint refuses is an INSERT that fails — after which `lib/ask/engine.ts` carries on
 * without a conversation rather than lose the answer, so the person gets an answer that is never
 * saved and only the server log says why.
 */
describe('the section words match the CHECK constraint', () => {
  test('TOPIC_SECTIONS is the list migration 091 actually writes', () => {
    const sql = readFileSync('supabase/migrations/091_each_chat_section_is_its_own.sql', 'utf8')
    const block = sql.match(/add constraint topics_section_is_known\n\s*check \(section in \(([\s\S]*?)\)\);/)
    assert.ok(block, 'the topics_section_is_known block did not parse out of 091')
    const inSql = [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual([...TOPIC_SECTIONS].sort(), inSql)
  })

  test('the night summary covers every one of them, from that same list', () => {
    // It carried its own copy and had been missing `calendar` since the Calendar shipped, so no
    // Calendar conversation was ever summarised at night (`docs/GAPS-PLAN.md` decision 10).
    const job = readFileSync('app/api/jobs/summarise/route.ts', 'utf8')
    assert.match(job, /const sections = \[\.\.\.TOPIC_SECTIONS\]/)
    // THE CODE WITHOUT ITS COMMENTS, because the comment beside that line QUOTES the old array to
    // say what it used to be — and a substring is not a call site (`calendarShell.test.ts:396`).
    // Written without this, the test failed on its own explanation, which is the right failure for
    // the wrong reason.
    const code = job.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/\['workspace', 'hr'\]/.test(code), 'the night job holds its own copy of the list again')
  })
})

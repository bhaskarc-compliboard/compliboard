/**
 * THE CONVERSATIONS LIST, READ — `lib/topicList.ts`, HR Step 4a. The section is the read's one parameter.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readTopicList, toTopicRow, TOPIC_LIST_COLUMNS, type TopicListRow } from '../../lib/topicList.ts'

/** A stand-in for the client that records every call made on the query. */
function fakeDb(rows: unknown[]) {
  const calls: Array<[string, ...unknown[]]> = []
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'limit']) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q }
  q.then = (res: (v: { data: unknown[] }) => unknown) => res({ data: rows })
  return { calls, db: { from: (t: string) => { calls.push(['from', t]); return q } } }
}

describe('readTopicList', () => {
  for (const section of ['workspace', 'hr'] as const) {
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

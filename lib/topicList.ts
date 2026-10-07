/**
 * THE CONVERSATIONS LIST, READ — shared by the Compliance Workspace and HR. HR Step 4a: the row types,
 * the columns and the mapping moved out of `app/compliance/page.tsx` unchanged; the read itself is one
 * function with the SECTION AS A PARAMETER (migration 066, decision 5): the workspace passes
 * 'workspace', HR passes 'hr', and neither list can show the other's conversations.
 *
 * Browser-safe: it imports a type and `LIST_CAP` only. The client is the caller's own (RLS applies).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { LIST_CAP } from './listWords.ts'

export interface TopicRow {
  id: string; title: string | null; summary: string | null
  summarised_at: string | null; summary_source: string | null
  delete_after: string | null; last_turn_at: string | null; created_at: string
  turnCount: number; checklistId: string | null
  /** From `topic_list_v` (migration 063) — Workspace Task 5, board 5. */
  questionCount: number; documentCount: number; firstDocumentName: string | null
  hasReport: boolean; checklistTotal: number; checklistDone: number
  /** A claim held and younger than ten minutes — migration 065, Workspace Stage 4. */
  summaryInProgress: boolean; checklistInProgress: boolean
}

/** One `topic_list_v` row, as the database returns it. */
export interface TopicListRow {
  id: string; title: string | null; summary: string | null
  summarised_at: string | null; summary_source: string | null
  delete_after: string | null; last_turn_at: string | null; created_at: string
  has_report: boolean; turn_count: number; question_count: number; document_count: number
  first_document_name: string | null; checklist_id: string | null; checklist_total: number; checklist_done: number
  summary_in_progress: boolean; checklist_in_progress: boolean
}

export const TOPIC_LIST_COLUMNS = 'id, title, summary, summarised_at, summary_source, delete_after, last_turn_at, created_at, '
  + 'has_report, turn_count, question_count, document_count, first_document_name, checklist_id, checklist_total, checklist_done, '
  + 'summary_in_progress, checklist_in_progress'

export const toTopicRow = (r: TopicListRow): TopicRow => ({
  id: r.id, title: r.title, summary: r.summary, summarised_at: r.summarised_at, summary_source: r.summary_source,
  delete_after: r.delete_after, last_turn_at: r.last_turn_at, created_at: r.created_at,
  turnCount: Number(r.turn_count ?? 0), checklistId: r.checklist_id,
  questionCount: Number(r.question_count ?? 0), documentCount: Number(r.document_count ?? 0),
  firstDocumentName: r.first_document_name, hasReport: !!r.has_report,
  checklistTotal: Number(r.checklist_total ?? 0), checklistDone: Number(r.checklist_done ?? 0),
  summaryInProgress: !!r.summary_in_progress, checklistInProgress: !!r.checklist_in_progress,
})

/** Which list a conversation belongs to — `topics.section` (migration 066). */
export type TopicSection = 'workspace' | 'hr'

/**
 * ONE SECTION'S CONVERSATIONS, NEWEST FIRST, AT MOST `LIST_CAP` — the read the workspace's
 * `loadTopics` made, with the section it filtered on now a parameter.
 */
export async function readTopicList(db: SupabaseClient, section: TopicSection): Promise<TopicRow[]> {
  const { data } = await db
    .from('topic_list_v')
    .select(TOPIC_LIST_COLUMNS)
    .eq('section', section)
    .order('last_turn_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(LIST_CAP)
  return ((data ?? []) as unknown as TopicListRow[]).map(toTopicRow)
}

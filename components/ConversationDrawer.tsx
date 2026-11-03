'use client'
/**
 * THE CONVERSATION DRAWER — `docs/GAPS-PLAN.md` Part A step 2 (decision 9).
 *
 * `app/calendar/page.tsx:942`–`:984` moved whole, plus the one thing the Calendar did not have:
 * **Delete.** HR has had it since step 6b (`app/hr/HrWorkspace.tsx:941` and the confirm sheet at
 * `:972`–`:986`); the Calendar had neither, and `docs/HANDOFF-FROM-CALENDAR.md` §8 recorded the gap.
 * One shared drawer cannot have it in one section and not the other, so the Calendar gains it —
 * the owner's yes, because a conversation a person can delete in one place and not another is a
 * surprise nobody can explain.
 *
 * *** THE ROUTE IS REUSED, NOT WRITTEN. *** `DELETE /api/topics/[id]` already does this for the
 * Workspace (`app/compliance/page.tsx:825`) and HR (`app/hr/HrWorkspace.tsx:404`). It is
 * section-blind — the word "section" appears nowhere in that file — and it is scoped by RLS: it
 * reads the row on the caller's own client, so another company's conversation is a 404 and not a
 * 403, and only then does the delete run as the service role, because `authenticated` holds no
 * DELETE on `topics` (migration 028) or `turns` (031).
 *
 * *** THE WORDS ARE THIS COMPONENT'S OWN, AND THEY ARE NOT HR'S. *** `lib/hrAnswerWords.ts`
 * `DELETE_CONVERSATION` says "Your handbooks and their checks stay", which is true of HR and
 * meaningless in the Calendar or in Documents. A shared drawer needs words that are true in every
 * section, so they are written below and nothing from `lib/hrAnswerWords.ts` is imported.
 *
 * *** AND THEY ARE TRUE OF WHAT THE DATABASE ACTUALLY DOES. *** Read from `pg_constraint` on
 * staging on 2 November, not from the route's comment, which is four weeks stale on one of them:
 *
 *   turns.topic_id           ON DELETE CASCADE    the questions and answers go
 *   topics row itself        deleted              the summary goes with it
 *   checklists.from_topic_id ON DELETE SET NULL   a checklist made from it stays
 *   documents.from_topic_id  ON DELETE SET NULL   a file attached in it stays
 *   fact_proposals.topic_id  ON DELETE SET NULL   the facts it proposed stay (migration 062)
 *
 * So the note says what stays, and it is a list a person can check.
 */
import { useEffect, useState } from 'react'
import type React from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import { Drawer, printDrawer } from '@/components/Drawer'
import { printDate } from '@/components/Drawer'
import { Sheet } from '@/components/Sheet'
import { ReportView, type SourceShape, type ReportLike } from '@/components/ReportView'
import { AnswerBody } from '@/components/AnswerBody'
import { displayTitle } from '@/lib/listWords'
import { conversationStatus, friendlyDate } from '@/lib/conversationStatus'
import { CLAIM_WORDS } from '@/lib/topicClaim'
import PausedNote from '@/components/PausedNote'
import type { TopicRow } from '@/lib/topicList'
import type { Banner } from '@/lib/billing'

/**
 * EVERY SENTENCE THIS DRAWER SAYS. Short sentences, plain words, true in every section. Quoted in
 * the step 2 report for the owner to read before it ships.
 */
export const DRAWER_WORDS = {
  title: 'Conversation',
  open: 'Open the conversation',
  summarise: 'Summarise this conversation',
  download: 'Download',
  delete: 'Delete',
  deleteTitle: 'Delete this conversation?',
  deleteLede: 'This removes the questions, the answers and the summary. You cannot undo it.',
  deleteNote:
    'Anything it led to stays: your documents, any checklist made from it, and any facts that came out of it.',
  deleteDownloadFirst: 'Download the summary first',
  deleteConfirm: 'Delete for good',
  deleteCancel: 'Cancel',
  deleteFailed: 'That could not be deleted. Nothing was changed. Please try again.',
} as const

export function ConversationDrawer({
  topic, companyName, paused, notSummarisedLine, sourceShape, reportWords,
  factsLine = null, onClose, onOpen, onSummarise, summaryRunning, onDeleted,
}: {
  topic: TopicRow
  companyName: string | null
  /** Step 18, decision 11. A PROP, never a read of its own. */
  paused: Banner | null
  /** What a conversation nobody has summarised yet says — the section's own sentence. */
  notSummarisedLine: string
  /** How a source is drawn in the report: the section passes `WEB_SOURCE` or its own shape. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceShape: SourceShape<any>
  /** The report's own headings, where a section has them (HR's "What to change"). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportWords?: any
  /** The line above a report saying facts are waiting. Null where a section has none. */
  factsLine?: React.ReactNode
  onClose: () => void
  onOpen: (t: TopicRow) => void
  onSummarise: (topicId: string) => void
  summaryRunning: boolean
  /** Called once the row is gone, so the page can re-read its list. */
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  /**
   * THE REPORT, READ WHEN THE DRAWER OPENS AND NOT BEFORE. `topic_list_v` carries WHETHER a report
   * exists (`hasReport`) and not the report itself, because a list of twenty conversations must not
   * carry twenty reports to show one — HR reads it the same way (`app/hr/HrWorkspace.tsx:447`).
   *
   * *** THIS READ MOVED OFF THE PAGE AND INTO THE DRAWER, which is its only reader. *** That is why
   * `tests/unit/calendarShell.test.ts` now names six relations on the Calendar page and not seven.
   */
  const [report, setReport] = useState<{ id: string; report: unknown | null } | null>(null)
  const topicId = topic.id
  const summarisedAt = topic.summarised_at
  useEffect(() => {
    let live = true
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase.from('topics').select('summary_report').eq('id', topicId).maybeSingle()
      if (live) setReport({ id: topicId, report: (data as { summary_report?: unknown } | null)?.summary_report ?? null })
    })()
    return () => { live = false }
  }, [topicId, summarisedAt])

  const cancelDelete = () => { if (deleteBusy) return; setDeleting(false); setDeleteFailed(false) }
  async function confirmDelete() {
    setDeleteBusy(true); setDeleteFailed(false)
    let ok = false
    try { ok = (await fetch(`/api/topics/${topic.id}`, { method: 'DELETE', headers: await authHeaders() })).ok }
    catch { ok = false }
    setDeleteBusy(false)
    if (!ok) { setDeleteFailed(true); return }
    setDeleting(false)
    onDeleted()
  }

  const mine = report?.id === topic.id ? report : null

  return (
    <>
      <div className="no-print fixed inset-0 z-[45] bg-gray-900/30" onClick={onClose} />
      <Drawer title={displayTitle(topic.title) ?? DRAWER_WORDS.title}
        sub={`${friendlyDate(topic.last_turn_at ?? topic.created_at)} · ${conversationStatus(topic, topic.turnCount > 0).label}`}
        company={companyName}
        printType="Summary report"
        printDates={topic.summarised_at
          ? `Summarised ${printDate(topic.summarised_at)}`
          : `Last message ${printDate(topic.last_turn_at ?? topic.created_at)}`}
        onClose={onClose}
        footer={
          <>
            {topic.turnCount > 0 && (
              <button onClick={() => onOpen(topic)}
                className="rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50">
                {DRAWER_WORDS.open}
              </button>
            )}
            <button onClick={() => onSummarise(topic.id)} disabled={summaryRunning || Boolean(paused)}
              className="ml-3 text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
              {summaryRunning ? CLAIM_WORDS.summary : DRAWER_WORDS.summarise}
            </button>
            <PausedNote banner={paused} />
            <button onClick={printDrawer} className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">
              {DRAWER_WORDS.download}
            </button>
            {/* HR's control, in HR's place and HR's colours (`app/hr/HrWorkspace.tsx:941`). */}
            <button onClick={() => { setDeleteFailed(false); setDeleting(true) }}
              className="ml-3 text-[14px] text-gray-400 hover:text-red-600">{DRAWER_WORDS.delete}</button>
          </>
        }>
        <div className="flex min-h-full flex-col">
          {summaryRunning
            ? <p className="text-[12px] text-gray-500">{CLAIM_WORDS.summary}</p>
            : mine?.report
            ? <ReportView key={topic.id} report={mine.report as ReportLike<never>}
                factsLine={factsLine} sourceShape={sourceShape} words={reportWords} />
            : topic.summary
            ? <AnswerBody text={topic.summary} sources={[]} />
            : <p className="text-[14px] leading-relaxed text-gray-600">{notSummarisedLine}</p>}
        </div>
      </Drawer>

      {/* ================= DELETING (HR's sheet, in this drawer's own words) ================= */}
      {deleting && (
        <Sheet onClose={cancelDelete} title={DRAWER_WORDS.deleteTitle} lede={DRAWER_WORDS.deleteLede}>
          <p className="text-[13px] leading-relaxed text-gray-600">{DRAWER_WORDS.deleteNote}</p>
          {deleteFailed && <p className="mt-3 text-[13px] text-amber-900">{DRAWER_WORDS.deleteFailed}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Only when there is a summary to download. */}
            {topic.summary && (
              <button onClick={printDrawer}
                className="rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50">
                {DRAWER_WORDS.deleteDownloadFirst}
              </button>
            )}
            {/* The one destructive action: an outline in red. */}
            <button onClick={confirmDelete} disabled={deleteBusy}
              className="rounded-md border border-[#B42318] px-3 py-1.5 text-[14px] font-medium text-[#B42318] hover:bg-red-50 disabled:opacity-50">
              {DRAWER_WORDS.deleteConfirm}
            </button>
            <button onClick={cancelDelete} autoFocus
              className="ml-auto text-[14px] text-gray-600 hover:text-gray-900 hover:underline">
              {DRAWER_WORDS.deleteCancel}
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

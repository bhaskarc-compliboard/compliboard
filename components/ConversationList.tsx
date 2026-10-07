/**
 * THE CONVERSATIONS LIST — the day-grouped list and its row, shared by the Compliance Workspace and HR.
 * HR Step 4a (`docs/HR-PLAN.md` decision 1): moved out of `app/compliance/page.tsx`, markup and words
 * unchanged, so the two sections' lists cannot drift. The page keeps the logic: what opens on a click
 * (`onOpen`) and whether a run is going on a conversation (`running`, the page's `inProgress`).
 */
'use client'

import React from 'react'
import { CLAIM_WORDS, type ClaimKind } from '@/lib/topicClaim'
import { groupByDay, listGroup, listWhen, summaryWords, displayTitle } from '@/lib/listWords'
import type { TopicRow } from '@/lib/topicList'

type Running = (t: TopicRow, kind: ClaimKind) => boolean

/** The rows grouped Today, This week, then by month; the page wraps it in its own spacing. */
export function ConversationList({ topics, running, onOpen }: {
  topics: TopicRow[]; running: Running; onOpen: (t: TopicRow) => void }) {
  return (
    <>
      {groupByDay(topics, (t) => listGroup(t.last_turn_at ?? t.created_at)).map((g, gi) => (
        <div key={g.day + gi} className={gi === 0 ? '' : 'mt-6'}>
          <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-400">{g.day}</p>
          <div className="divide-y divide-gray-100 border-y border-gray-100">
            {/*
              A LIST IS SCANNED; THE DRAWER IS WORKED FROM. The title is 13px and
              regular — it separates from the 12px gray-500 meta line by colour and
              size alone, which is how Finder, Drive and Dropbox set a filename, and
              it keeps these lists dense as they grow. The checklist drawer's item
              name stays 16px on purpose: that is reading text, and the two are
              allowed to differ.

              THE ROW HAS TO LOOK CLICKABLE. Grey text on a grey page with no response
              to the pointer gave no sign that a row opened anything. `-mx-3` with a
              matching `px-3` lets the hover fill sit slightly proud of the text
              WITHOUT moving the text, so titles stay aligned with the page column.
              The title turns green because the title is the thing you are aiming at.
              The Checklists row below is the same pattern.

              NO DELETE ON THE ROW — Workspace Task 3, board 7. Deleting is done from the
              drawer, where the thing is open in front of you and its confirmation can
              offer a download first. A Delete beside every row was one stray click from
              the browser's pop-up and no copy.
            */}
            {g.rows.map((t) => <ConversationRow key={t.id} t={t} running={running} onOpen={onOpen} />)}
          </div>
        </div>
      ))}
    </>
  )
}

/** One conversation: its title, and one grey line of when · questions · file · summary · checklist. */
export function ConversationRow({ t, running, onOpen }: { t: TopicRow; running: Running; onOpen: (t: TopicRow) => void }) {
  // ONE GREY LINE, ITS PARTS SEPARATED BY " · " — Workspace Task 5, board 5.
  const parts: React.ReactNode[] = [
    listWhen(t.last_turn_at ?? t.created_at),
    `${t.questionCount} question${t.questionCount === 1 ? '' : 's'}`,
  ]
  if (t.firstDocumentName) parts.push(
    <span key="file" className="inline-flex min-w-0 items-center gap-1">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
      <span className="truncate">{t.firstDocumentName}{t.documentCount > 1 ? ` +${t.documentCount - 1}` : ''}</span>
    </span>)
  // A RUN GOING SAYS SO, IN THE ROW'S OWN LINE — Workspace Stage 4.
  parts.push(running(t, 'summary') ? CLAIM_WORDS.summary : summaryWords(t))
  if (running(t, 'checklist')) parts.push(CLAIM_WORDS.checklist)
  else if (t.checklistId) parts.push(`Checklist ${t.checklistDone} of ${t.checklistTotal} done`)
  return (
    <div key={t.id} className="group -mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white">
      <button onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{displayTitle(t.title) ?? 'Untitled conversation'}</p>
        {/* NO COLOUR HERE. Amber is reserved for a real attention state and
            "not summarised yet" is the normal condition of anything asked
            today; green for a routine fact is the same mistake the other way. */}
        <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-gray-500">
          {parts.map((part, i) => (
            <React.Fragment key={i}>{i > 0 && <span aria-hidden="true">·</span>}{part}</React.Fragment>
          ))}
        </p>
      </button>
    </div>
  )
}

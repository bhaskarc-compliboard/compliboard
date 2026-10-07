'use client'
/**
 * THE HR WORKSPACE — the page shell, HR Step 4 (`docs/HR-PLAN.md` §2.1, decisions 1, 5, 18, 29, 30, 32).
 *
 * The Compliance Workspace's page with the company's handbooks as the evidence, built from the SAME shared
 * pieces and the workspace's own classes, so the two cannot drift: `Tabs`, `Empty`, `ConversationList`,
 * `PRIMARY`, the list words (`lib/listWords.ts`) and the conversation read (`lib/topicList.ts`, section 'hr').
 * Where markup is the workspace's inline markup — the box, the line under it, the counts line, the
 * retention line — its classes are copied from `app/compliance/page.tsx` character for character, and
 * `npm run measure` compares the two pages.
 *
 * *** THIS STEP READS AND SENDS NOTHING. *** It reads counts and lists (handbooks, HR's conversations, HR's
 * calendar dates) as the caller, under RLS. "Research this", the box's Enter, and both attach controls
 * make NO network request: the answer is step 6, the upload step 5. Every word on this page is the
 * owner's copy (HR Step 4 brief); the empty Conversations words are the workspace's own.
 */
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { Tabs } from '@/components/Tabs'
import { Empty } from '@/components/Empty'
import { ConversationList } from '@/components/ConversationList'
import { PRIMARY } from '@/components/buttonStyles'
import { HR_EXAMPLE_QUESTIONS } from '@/config/examples'
import { LIST_CAP, countOf, countWord, fmtDate } from '@/lib/listWords'
import { readTopicList, type TopicRow } from '@/lib/topicList'

type Tab = 'ask' | 'conversations' | 'handbooks' | 'dates'

interface HandbookRow { id: string; name: string; created_at: string }
interface DateRow { id: string; title: string; due_date: string }

/** The paperclip the workspace's attach line draws, at 13px in the line's own colour. */
const Pin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
)

/** The workspace's attach control: a quiet 12px grey underlined line with the pin. Sends nothing in this step. */
function AttachControl({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => { /* step 5 uploads; nothing is sent in step 4 */ }}
      className="inline-flex cursor-pointer items-center gap-1.5 text-left hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300">
      <Pin />
      <span className="underline">{label}</span>
    </button>
  )
}

export default function HrWorkspace() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('ask')
  const [box, setBox] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [handbooks, setHandbooks] = useState<HandbookRow[]>([])
  const [dates, setDates] = useState<DateRow[]>([])

  // The composer grows with its text, exactly as the workspace's does.
  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [box])

  // ---- reading: three lists, as the caller (RLS scopes each to the company) ----
  useEffect(() => {
    let live = true
    ;(async () => {
      const [t, h, d] = await Promise.all([
        // HR's conversations only — topics.section 'hr' (migration 066), the workspace's own read.
        readTopicList(supabase, 'hr'),
        // The current version of each handbook (decision 18; versions arrive in step 5).
        supabase.from('handbooks').select('id, name, created_at').eq('is_current', true)
          .order('created_at', { ascending: false }).limit(LIST_CAP),
        // HR's dates in the ONE calendar (decisions 29, 30): category 'hr'.
        supabase.from('calendar_events').select('id, title, due_date').eq('category', 'hr')
          .order('due_date', { ascending: true }).limit(LIST_CAP),
      ])
      if (!live) return
      setTopics(t)
      setHandbooks((h.data ?? []) as HandbookRow[])
      setDates((d.data ?? []) as DateRow[])
    })()
    return () => { live = false }
  }, [supabase])

  /** "Research this" and Enter: nothing is sent in this step. An empty box puts the cursor in it, as the workspace does. */
  const research = () => { composerRef.current?.focus() }
  const newConversation = () => { setTab('ask'); setBox('') }

  // "last asked" on the counts line: the most recent activity across HR's conversations, as the workspace counts it.
  const lastAsked = topics.reduce<string | null>((max, t) => {
    const at = t.last_turn_at ?? t.created_at
    return !max || at > max ? at : max
  }, null)

  return (
    <AppLayout>
      {/* The 900 column, the same as /compliance (`app/compliance/page.tsx`). */}
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="no-print pt-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">HR Workspace</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Ask about your handbooks. We check what they say against the rules that apply to you.
          </p>
        </div>

        <Tabs active={tab} onSelect={setTab}
          tabs={[
            { key: 'ask', label: 'Ask a question' },
            { key: 'conversations', label: 'Conversations' },
            { key: 'handbooks', label: `Handbooks${handbooks.length > 0 ? ` (${countOf(handbooks.length)})` : ''}` },
            { key: 'dates', label: `Dates${dates.length > 0 ? ` (${countOf(dates.length)})` : ''}` },
          ]}
          right={
            <button onClick={newConversation}
              className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span className="hidden sm:inline">New conversation</span>
            </button>
          } />

        {/* ================= ASK (the first visit; answers arrive in step 6) ================= */}
        {tab === 'ask' && (
          <div className="">
            <div className="no-print ">
              <div>
                <div className="relative rounded-xl border border-gray-200 bg-white focus-within:border-[var(--green)]">
                  <div className="flex items-end gap-2 p-3.5">
                    <textarea
                      ref={composerRef}
                      value={box}
                      onChange={(e) => setBox(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); research() } }}
                      rows={1}
                      className="max-h-36 min-h-[92px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[16px] text-gray-900 outline-none placeholder:text-[16px] placeholder:text-gray-400"
                    />
                  </div>
                  {/* The examples, as the workspace shows them: an overlay, gone the moment anything is typed; not clickable. */}
                  {!box && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-5">
                      {HR_EXAMPLE_QUESTIONS.map((e) => (
                        <p key={e.label} className="truncate text-[14px] text-gray-400">e.g. {e.question}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* One line under the box, the workspace's: the attach control left, ONE action right. No checklist in HR. */}
                <div className="mt-[10px] flex items-start justify-between gap-4">
                  <p className="min-w-0 text-[12px] text-gray-500">
                    <AttachControl label="Attach a file and ask about it against your handbooks" />
                  </p>
                  <div className="flex shrink-0 items-center gap-3">
                    <button onClick={research} className={PRIMARY}>
                      Research this
                    </button>
                  </div>
                </div>

                {/* The counts line, the workspace's style and its rules for zero. */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
                  <p className="text-[13px] text-gray-500">
                    {countWord(handbooks.length, 'handbook')}
                    {' · '}{countWord(topics.length, 'conversation')}
                    {topics.length > 0 ? ` · last asked ${fmtDate(lastAsked)}` : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= CONVERSATIONS ================= */}
        {tab === 'conversations' && (
          <div className="pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-nowrap">
              <p className="min-w-0 flex-1 text-[13px] text-gray-500">
                Full conversations are kept for 12 months after the last message. Summaries are kept until you
                delete them.
              </p>
            </div>
            {topics.length === 0 ? (
              <div className="mt-4"><Empty title="No conversations yet" note="Ask a question and it will appear here." /></div>
            ) : (
              <div className="mt-4">
                {/* Opening a conversation arrives in step 7; a row does nothing yet. */}
                <ConversationList topics={topics} running={() => false} onOpen={() => {}} />
              </div>
            )}
          </div>
        )}

        {/* ================= HANDBOOKS ================= */}
        {tab === 'handbooks' && (
          <div className="pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-nowrap">
              <p className="min-w-0 flex-1 text-[13px] text-gray-500">
                Each handbook is checked the night it arrives, then every 90 days. Changed one? Add the new version.
              </p>
              <p className="shrink-0 text-[12px] text-gray-500">
                <AttachControl label="Add a handbook" />
              </p>
            </div>
            {handbooks.length === 0 ? (
              <div className="mt-4">
                <Empty title="No handbooks yet" note="Add your employee handbook, and any site or state addendum. Your answers come from them." />
              </div>
            ) : (
              <div className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
                {handbooks.map((h) => (
                  <div key={h.id} className="-mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-gray-900">{h.name}</p>
                      <p className="mt-0.5 text-[12px] text-gray-500">{fmtDate(h.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= DATES ================= */}
        {tab === 'dates' && (
          <div className="pt-1">
            {dates.length === 0 ? (
              <Empty title="No dates yet" note="When a handbook check finds a date, you can add it to your calendar. It shows here." />
            ) : (
              <div className="divide-y divide-gray-100 border-y border-gray-100">
                {dates.map((d) => (
                  <div key={d.id} className="-mx-3 flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-gray-900">{d.title}</p>
                      <p className="mt-0.5 text-[12px] text-gray-500">{fmtDate(d.due_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

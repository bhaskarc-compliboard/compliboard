'use client'
/**
 * THE HR WORKSPACE — HR Step 4 (the shell) and Step 5a (adding and keeping handbooks).
 * `docs/HR-PLAN.md` §2.1, decisions 1, 5, 18, 24, 29, 30, 32.
 *
 * The Compliance Workspace's page with the company's handbooks as the evidence, built from the SAME shared
 * pieces and the workspace's own classes, so the two cannot drift: `Tabs`, `Empty`, `Sheet`, `Drawer`,
 * `ConversationList`, the button strings, the list words (`lib/listWords.ts`) and the conversation read
 * (`lib/topicList.ts`, section 'hr'). Where markup is the workspace's inline markup — the box, the line
 * under it, the counts line, the retention line, the choice sheet's buttons, the delete sheet — its classes
 * are copied from `app/compliance/page.tsx` character for character, and `npm run measure` compares them.
 *
 * WHAT IT SENDS. Step 5a: a handbook's file to storage at `handbookPath()` and its row through
 * `POST /api/handbooks`; a delete through `DELETE /api/handbooks`. Nothing is read by a model here — every
 * handbook stays 'uploaded' until step 5b. "Research this", the box's Enter and the Ask tab's attach line
 * still send nothing: the answer is step 6.
 *
 * Every word on this page is the owner's (HR Step 4 and 5a briefs, and his answers of 7 October), except
 * the failed delete, which is the workspace's own sentence.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { Tabs } from '@/components/Tabs'
import { Empty } from '@/components/Empty'
import { Sheet } from '@/components/Sheet'
import { Drawer } from '@/components/Drawer'
import { ConversationList } from '@/components/ConversationList'
import { PRIMARY, TEXT_ACTION } from '@/components/buttonStyles'
import { HR_EXAMPLE_QUESTIONS } from '@/config/examples'
import { ACCEPTED_FILE_TYPES } from '@/lib/acceptedFiles'
import { DOCUMENTS_BUCKET, handbookPath } from '@/lib/storage'
import { LIST_CAP, countOf, countWord, fmtDate } from '@/lib/listWords'
import { friendlyDate } from '@/lib/conversationStatus'
import { readTopicList, type TopicRow } from '@/lib/topicList'
import { statusWords, replacedAt, handbookList, type HandbookRow } from '@/lib/handbooks'

type Tab = 'ask' | 'conversations' | 'handbooks' | 'dates'

interface DateRow { id: string; title: string; due_date: string }
interface Site { id: string; name: string }

const HANDBOOK_COLUMNS = 'id, name, file_name, file_path, scope, entity_id, status, status_reason, version_of, is_current, created_at'

/** The owner's words (HR Step 5a). */
const SAVE_FAILED = 'We could not save this file. Nothing was added. Please try again.'
/** The owner's words (7 October 2026). No "try again": trying again would add a third version. */
const OLDER_NOT_REPLACED = 'The newer version was saved, but we could not mark the older one as replaced. Both are shown for now.'
/** The workspace's own sentence for a failed delete (`app/compliance/page.tsx`, the delete sheet). */
const DELETE_FAILED = 'That could not be deleted. Nothing was changed. Please try again.'

/** The paperclip the workspace's attach line draws, at 13px in the line's own colour. */
const Pin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
)

/** The workspace's attach control: a quiet 12px grey underlined line with the pin. */
function AttachControl({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick ?? (() => { /* the Ask tab's attach arrives with the answer, step 6 */ })} disabled={disabled}
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
  const fileInput = useRef<HTMLInputElement>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [allHandbooks, setAllHandbooks] = useState<HandbookRow[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [dates, setDates] = useState<DateRow[]>([])
  // Adding: the file waiting for its site choice, and the handbook a newer version replaces.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const versionOf = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // The drawer, and its delete sheet.
  const [drawer, setDrawer] = useState<HandbookRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  const current = allHandbooks.filter((h) => h.is_current)

  // The composer grows with its text, exactly as the workspace's does.
  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [box])

  // ---- reading, as the caller (RLS scopes every read to the company) ----
  const loadHandbooks = useCallback(async () => {
    const { data } = await supabase.from('handbooks').select(HANDBOOK_COLUMNS)
      .order('created_at', { ascending: false }).limit(LIST_CAP * 4)
    setAllHandbooks((data ?? []) as HandbookRow[])
  }, [supabase])

  useEffect(() => {
    let live = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = user
        ? await supabase.from('profiles').select('company_id').eq('id', user.id).maybeSingle()
        : { data: null }
      const co = (profile?.company_id as string | undefined) ?? null
      const [t, d, s, c] = await Promise.all([
        // HR's conversations only — topics.section 'hr' (migration 066), the workspace's own read.
        readTopicList(supabase, 'hr'),
        // HR's dates in the ONE calendar (decisions 29, 30): category 'hr'.
        supabase.from('calendar_events').select('id, title, due_date').eq('category', 'hr')
          .order('due_date', { ascending: true }).limit(LIST_CAP),
        supabase.from('entities').select('id, name').order('name'),
        co ? supabase.from('companies').select('name').eq('id', co).maybeSingle() : Promise.resolve({ data: null }),
      ])
      if (!live) return
      setCompanyId(co)
      setCompanyName((c.data as { name?: string } | null)?.name ?? null)
      setTopics(t)
      setDates((d.data ?? []) as DateRow[])
      setSites((s.data ?? []) as Site[])
      await loadHandbooks()
    })()
    return () => { live = false }
  }, [supabase, loadHandbooks])

  /** "Research this" and Enter: nothing is sent in this step. An empty box puts the cursor in it, as the workspace does. */
  const research = () => { composerRef.current?.focus() }
  const newConversation = () => { setTab('ask'); setBox('') }

  // ---- adding a handbook ----
  const pickFile = (olderId: string | null) => {
    versionOf.current = olderId
    setNotice(null)
    fileInput.current?.click()
  }

  /** Store the file at <company>/handbooks/<file>, then save its row. A row that fails takes its file back out. */
  const save = async (file: File, scope: 'company' | 'site', entityId: string | null) => {
    if (!companyId) { setNotice(SAVE_FAILED); return }
    setSaving(true)
    setNotice(null)
    const path = handbookPath(companyId, file.name)
    const olderId = versionOf.current
    try {
      const { error: upErr } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file)
      if (upErr) { setNotice(SAVE_FAILED); return }
      let res: Response | null = null
      try {
        res = await fetch('/api/handbooks', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(olderId
            ? { file_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, version_of: olderId }
            : { file_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, scope, entity_id: entityId }),
        })
      } catch { res = null }
      if (!res || !res.ok) {
        // The row was not saved: the stored file must not be left behind.
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
        setNotice(SAVE_FAILED)
        return
      }
      const json = await res.json().catch(() => ({}))
      if (json?.older_not_replaced) setNotice(OLDER_NOT_REPLACED)
      await loadHandbooks()
      if (olderId) setDrawer(null)
    } finally {
      versionOf.current = null
      setSaving(false)
    }
  }

  const onFileChosen = (file: File) => {
    // A newer version keeps the older one's site: no sheet.
    if (versionOf.current) { save(file, 'company', null); return }
    // Two or more sites: the person says which site it covers BEFORE anything is uploaded.
    if (sites.length >= 2) { setPendingFile(file); return }
    save(file, 'company', null)
  }

  // ---- the drawer ----
  const siteLabel = (h: HandbookRow) => h.scope === 'company' ? 'Every site'
    : (sites.find((s) => s.id === h.entity_id)?.name ?? 'Site removed')

  /** A signed address for the stored file, opened in a new tab. The tab is opened first, so no browser
   *  calls it a pop-up; the address arrives a moment later. */
  const openHandbook = async (h: HandbookRow) => {
    const w = window.open('', '_blank')
    const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(h.file_path, 60)
    if (w && data?.signedUrl) w.location.href = data.signedUrl
    else w?.close()
  }

  const cancelDelete = () => { setDeleting(false); setDeleteFailed(false) }
  const confirmDelete = async () => {
    if (!drawer) return
    setDeleteBusy(true)
    setDeleteFailed(false)
    try {
      const res = await fetch(`/api/handbooks?id=${encodeURIComponent(drawer.id)}`, { method: 'DELETE', headers: await authHeaders() })
      if (!res.ok) { setDeleteFailed(true); return }
      setDeleting(false)
      setDrawer(null)
      await loadHandbooks()
    } catch {
      setDeleteFailed(true)
    } finally {
      setDeleteBusy(false)
    }
  }

  // "last asked" on the counts line: the most recent activity across HR's conversations, as the workspace counts it.
  const lastAsked = topics.reduce<string | null>((max, t) => {
    const at = t.last_turn_at ?? t.created_at
    return !max || at > max ? at : max
  }, null)

  return (
    <AppLayout>
      {/* One file picker for the page, as the workspace has: "Add a handbook" and "Add a newer version" call it. */}
      <input ref={fileInput} type="file" className="hidden" accept={ACCEPTED_FILE_TYPES}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChosen(f); e.target.value = '' }} />

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
            { key: 'handbooks', label: `Handbooks${current.length > 0 ? ` (${countOf(current.length)})` : ''}` },
            { key: 'dates', label: `Dates${dates.length > 0 ? ` (${countOf(dates.length)})` : ''}` },
          ]}
          right={
            <button onClick={newConversation}
              className="-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-[14px] text-gray-500 hover:text-gray-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span className="hidden sm:inline">New conversation</span>
            </button>
          } />

        {/* The workspace's notice banner (`app/compliance/page.tsx`), for a save that failed. */}
        {notice && (
          <div className="no-print mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {notice}
            <button onClick={() => setNotice(null)} className="ml-3 text-xs underline">Dismiss</button>
          </div>
        )}

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
                    {countWord(current.length, 'handbook')}
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

        {/* ================= HANDBOOKS (canvas board 3) ================= */}
        {tab === 'handbooks' && (
          <div className="pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-nowrap">
              <p className="min-w-0 flex-1 text-[13px] text-gray-500">
                Each handbook is checked the night it arrives, then every 90 days. Changed one? Add the new version.
              </p>
              <p className="shrink-0 text-[12px] text-gray-500">
                <AttachControl label="Add a handbook" onClick={() => pickFile(null)} disabled={saving} />
              </p>
            </div>
            {current.length === 0 ? (
              <div className="mt-4">
                <Empty title="No handbooks yet" note="Add your employee handbook, and any site or state addendum. Your answers come from them." />
              </div>
            ) : (
              <div className="mt-4">
                {handbookList(allHandbooks, sites).map((g, gi) => (
                  <div key={g.key} className={gi === 0 ? '' : 'mt-6'}>
                    {/* A heading that carries a NAME takes the darker grey (`DESIGN.md` §4); the workspace list's heading otherwise. */}
                    <p className="mb-1 text-[12px] font-medium uppercase tracking-wide text-gray-700">{g.label}</p>
                    <div className="divide-y divide-gray-100 border-y border-gray-100">
                      {g.rows.map((h) => {
                        const older = !h.is_current
                        const couldNot = h.status === 'could_not_read'
                        return (
                          <div key={h.id} className="group -mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white">
                            <button onClick={() => { setNotice(null); setDrawer(h) }} className="min-w-0 flex-1 text-left">
                              <p className="truncate text-[13px] text-gray-900 group-hover:text-[var(--green)]">{h.name}</p>
                              {older ? (
                                // EVERY VERSION IS SHOWN (owner, 7 October): an older one under its current one, the words first.
                                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-gray-500">
                                  <span>Older version</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">{h.file_name}</span>
                                  {/* An older row no chain reaches has no newer version to date it by: no date is invented. */}
                                  {replacedAt(h, allHandbooks) && <><span aria-hidden="true">·</span><span>replaced {friendlyDate(replacedAt(h, allHandbooks))}</span></>}
                                </p>
                              ) : (
                                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-gray-500">
                                  <span className="truncate">{h.file_name}</span>
                                  <span aria-hidden="true">·</span>
                                  {/* Amber only on "Could not read": the one state that asks something of somebody. */}
                                  <span className={couldNot ? 'text-[var(--amber)]' : undefined}>{statusWords(h.status, h.status_reason)}</span>
                                  {/* A site that was deleted: the handbook keeps scope 'site' and says so (choosing arrives in polish, step 11). */}
                                  {g.removed && <><span aria-hidden="true">·</span><span>choose where it applies</span></>}
                                </p>
                              )}
                            </button>
                          </div>
                        )
                      })}
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

      {/* ================= THE HANDBOOK DRAWER (the shared 720 drawer) ================= */}
      {drawer && (
        <Drawer title={drawer.name}
          sub={drawer.is_current
            ? `${siteLabel(drawer)} · ${drawer.file_name} · added ${friendlyDate(drawer.created_at)}`
            : `Older version · ${siteLabel(drawer)} · ${drawer.file_name}${replacedAt(drawer, allHandbooks) ? ` · replaced ${friendlyDate(replacedAt(drawer, allHandbooks))}` : ''}`}
          company={companyName}
          onClose={() => setDrawer(null)}
          footer={
            <>
              <button onClick={() => openHandbook(drawer)} className={TEXT_ACTION}>Open the handbook</button>
              {/* A newer version is added to the CURRENT one only (owner, 7 October). */}
              {drawer.is_current && (
                <button onClick={() => pickFile(drawer.id)} disabled={saving} className={TEXT_ACTION}>Add a newer version</button>
              )}
              <button onClick={() => { setDeleteFailed(false); setDeleting(true) }}
                className="ml-auto text-[14px] text-gray-400 hover:text-red-600">Delete</button>
            </>
          }>
          {/* The check report fills this in step 8. */}
          <p className="text-[14px] leading-relaxed text-gray-600">This handbook has not been read yet.</p>
        </Drawer>
      )}

      {/* ================= WHICH SITE (the workspace's choice sheet) ================= */}
      {pendingFile && (
        <Sheet onClose={() => setPendingFile(null)} title="Which site does this handbook cover?"
          lede={`${pendingFile.name}. We read it in about a minute and check it tonight. It stays here in HR.`}>
          <button onClick={() => { const f = pendingFile; setPendingFile(null); save(f, 'company', null) }}
            className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40">
            <b className="block text-[14px] font-medium text-gray-900">Every site</b>
            <span className="mt-0.5 block text-[13px] text-gray-600">A company-wide handbook. It applies at every site.</span>
          </button>
          {[...sites].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
            <button key={s.id} onClick={() => { const f = pendingFile; setPendingFile(null); save(f, 'site', s.id) }}
              className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40">
              <b className="block text-[14px] font-medium text-gray-900">{s.name}</b>
              <span className="mt-0.5 block text-[13px] text-gray-600">Only this site.</span>
            </button>
          ))}
          {/* "Not now" drops the picked file: nothing has been uploaded, so nothing is left anywhere. */}
          <button onClick={() => setPendingFile(null)} className="mt-3 w-full py-2 text-[13px] text-gray-500 hover:text-gray-800">Not now</button>
        </Sheet>
      )}

      {/* ================= DELETING (canvas board 11b, the workspace's delete sheet) ================= */}
      {deleting && drawer && (
        <Sheet onClose={cancelDelete} title="Delete this handbook?"
          lede="This deletes the handbook and its check for good. You cannot undo it.">
          <p className="text-[13px] leading-relaxed text-gray-600">Conversations that used it stay.</p>
          {deleteFailed && (
            <p className="mt-3 text-[13px] text-amber-900">{DELETE_FAILED}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* OUTLINE's box in red: the one destructive action. */}
            <button onClick={confirmDelete} disabled={deleteBusy}
              className="rounded-md border border-[#B42318] px-3 py-1.5 text-[14px] font-medium text-[#B42318] hover:bg-red-50 disabled:opacity-50">
              Delete for good
            </button>
            <button onClick={cancelDelete} autoFocus className={`ml-auto ${TEXT_ACTION}`}>
              Cancel
            </button>
          </div>
        </Sheet>
      )}
    </AppLayout>
  )
}

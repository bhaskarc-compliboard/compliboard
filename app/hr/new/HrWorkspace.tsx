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
import { Drawer, printDrawer, printDate } from '@/components/Drawer'
import { ConversationList } from '@/components/ConversationList'
import { PRIMARY, TEXT_ACTION, OUTLINE } from '@/components/buttonStyles'
import { HR_EXAMPLE_QUESTIONS } from '@/config/examples'
import { ACCEPTED_FILE_TYPES } from '@/lib/acceptedFiles'
import { DOCUMENTS_BUCKET, handbookPath } from '@/lib/storage'
import { LIST_CAP, countOf, countWord, fmtDate, displayTitle } from '@/lib/listWords'
import { friendlyDate, conversationStatus } from '@/lib/conversationStatus'
import { readTopicList, type TopicRow } from '@/lib/topicList'
import {
  statusWords, handbookList, sectionCount, type HandbookRow, checkLine, HANDBOOKS_TAB_LINE, uploadLede, NOT_CHECKED_YET,
  checkingSections, readAgainNote, PART_NOT_CHECKED, CHECK_FAILED, earlierCheckHeading, LEGACY_WORD,
} from '@/lib/handbooks'
import { loadRowChecks, loadCheckView, type RowCheckState, type CheckView } from '@/lib/handbookCheckView'
import { AnswerBody, SourceList, type AnswerSource } from '@/components/AnswerBody'
import { ReportView, WEB_SOURCE, type SourceShape, type ReportLike } from '@/components/ReportView'
import { HR_AS_OF_LINE, whatToChangeHeading, thingsToChange, longDate } from '@/lib/summaryWords'
import { CLAIM_WORDS } from '@/lib/topicClaim'
import { printWithFrame } from '@/lib/printFrame'
import type { HrReportSource } from '@/lib/hrSummary'
import type { SummaryReport } from '@/lib/summaryReport'
import { Stages, type Step } from '@/components/Stages'
import { readAnswerStream, ndjsonLines } from '@/lib/answerStream'
import { markNotFound, readingWords, splitAppended, splitSuggested, hideHandbookMarkers, HR_COMPOSER_HINT, NOT_ANSWERED, ASK_IT_AGAIN, ASKED_AGAIN_BELOW, NOT_SUMMARISED_HR, DELETE_CONVERSATION } from '@/lib/hrAnswerWords'

type Tab = 'ask' | 'conversations' | 'handbooks' | 'dates'

/**
 * HR'S SOURCE SHAPE for the summary drawer (Step 7): a handbook passage is "<handbook> — <section>, page <p> · your
 * handbook" with no link, and in Sources the same line with its quote under it, as the answer's cards show it.
 * On paper the line prints whole. A web page is drawn exactly as the workspace draws it (`WEB_SOURCE`).
 */
const HR_SOURCE: SourceShape<HrReportSource> = {
  link: (src) => src.kind !== 'handbook' ? WEB_SOURCE.link(src) : (
    <span key={src.n} className="flex min-w-0 items-baseline text-[12.5px] text-gray-600">
      <span className="screen-only block truncate">[{src.n}] {src.title} · your handbook</span>
      <span className="print-only">[{src.n}] {src.title} · your handbook</span>
    </span>
  ),
  entry: (src) => src.kind !== 'handbook' ? WEB_SOURCE.entry(src) : (
    <span>
      <span className="text-gray-900">{src.title}</span>{' '}<span className="text-gray-400">· your handbook</span>
      {src.quote && <span className="mt-0.5 block italic text-gray-600">“{src.quote}”</span>}
    </span>
  ),
}
/** HR's words in the drawer (the owner, Step 7). */
const HR_REPORT_WORDS = { heading: whatToChangeHeading, perGroup: thingsToChange, asOf: HR_AS_OF_LINE }
/** The workspace's own sentence, copied (`app/compliance/page.tsx`). */
const SUMMARY_FAILED = 'That conversation could not be summarised just now. Nothing was changed. Please try again.'

/** One question and its answer on the Ask tab (the workspace's Exchange, HR's fields). */
interface HrExchange {
  id: string; question: string; text: string; sources: AnswerSource[]
  phase: 'sending' | 'searching' | 'writing' | 'done' | 'stopped' | 'stopped_early' | 'failed' | 'refused'
    /** Reopened (Step 6b): a stored question with no stored answer after it. */
    | 'not_answered'
  searches: number; reading: string; steps?: { list: Step[]; at: Step }; error?: string; refusal?: string
  /** Step 6c: the request ended without an answer (a reading failed, or the wait ran too long): its words. */
  notAnsweredWords?: string
}

interface DateRow { id: string; title: string; due_date: string }
interface Site { id: string; name: string }

const HANDBOOK_COLUMNS = 'id, name, file_name, file_path, scope, entity_id, status, status_reason, version_of, is_current, created_at, page_count, read_at, checked_at, next_check_at, handbook_sections(count)'

/** The owner's words (HR Step 5a). */
const SAVE_FAILED = 'We could not save this file. Nothing was added. Please try again.'
/** The owner's words (7 October 2026). No "try again": trying again would add a third version. */
const OLDER_NOT_REPLACED = 'The newer version was saved, but we could not mark the older one as replaced. Both are shown for now.'
/** The workspace's own sentence for a failed delete (`app/compliance/page.tsx`, the delete sheet). */
const DELETE_FAILED = 'That could not be deleted. Nothing was changed. Please try again.'
/** For a "Read it again" the server never started — Claude Code's sentence, accepted by the owner as written (7 October). */
const READ_FAILED = 'That reading could not be started. Nothing was changed. Please try again.'

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

/**
 * ONE HR ANSWER, DRAWN — the Ask tab's own markup, lifted so a handbook check's parts are drawn exactly as answers
 * (owner, Baseline Step 1). The answer's words are never changed: a quote the code could not find keeps its words and
 * gets the small grey mark (`markNotFound`, drawn by `components/AnswerBody.tsx`'s grey note).
 */
function HrAnswerView({ body, lines, sources }: { body: string; lines: string[]; sources: AnswerSource[] }) {
  return (
    <>
      {/* Suggested wording (owner, 6c) is drawn as a draft — Documents' draft look (components/DocumentReport.tsx) —
          never as a source, and it has no number. Kept for answers stored with the label; no new answer is asked for it. */}
      {splitSuggested(body).map((seg, si) => seg.draft ? (
        <div key={si} className="my-3 rounded-lg bg-gray-50 p-3">
          <p className="text-[12px] text-gray-500">Suggested wording</p>
          <div className="mt-2"><AnswerBody text={markNotFound(seg.text)} sources={sources} /></div>
        </div>
      ) : <AnswerBody key={si} text={markNotFound(seg.text)} sources={sources} />)}
      {/* The lines the server added (quotes marked, links not shown, the day-1 line): grey, after the answer. */}
      {lines.map((l) => <p key={l} className="mt-2 text-[13px] text-gray-500">{l}</p>)}
      <div className="sources-print"><SourceList sources={sources} /></div>
    </>
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

  // ---- "Read it again" (owner, 7 October): only for 'could_not_read' or 'uploaded' ----
  const [startingRead, setStartingRead] = useState(false)
  const readAgain = async (h: HandbookRow) => {
    setNotice(null); setStartingRead(true)
    try {
      const res = await fetch('/api/handbooks/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ id: h.id }),
      })
      // 409: a reading already holds it, or it is read — the reloaded list says which.
      if (!res.ok && res.status !== 409) setNotice(READ_FAILED)
    } catch { setNotice(READ_FAILED) }
    await loadHandbooks()
    setStartingRead(false)
  }

  // ---- reading, as the caller (RLS scopes every read to the company) ----
  const loadHandbooks = useCallback(async () => {
    const { data } = await supabase.from('handbooks').select(HANDBOOK_COLUMNS)
      .order('created_at', { ascending: false }).limit(LIST_CAP * 4)
    setAllHandbooks((data ?? []) as HandbookRow[])
  }, [supabase])

  // While any handbook is being read, look again every few seconds, so "Reading…" turns into its result.
  const anyReading = allHandbooks.some((h) => h.status === 'reading')
  useEffect(() => {
    if (!anyReading) return
    const t = setInterval(() => { void loadHandbooks() }, 3000)
    return () => clearInterval(t)
  }, [anyReading, loadHandbooks])

  // ---- THE CHECK (Baseline Step 1): each read handbook's check on its row, and its answers in its drawer ----
  // Read as the person (066: SELECT on the check tables). While a check is open, looked at again every 5 s, as the
  // summary is.
  const [rowChecks, setRowChecks] = useState<Record<string, RowCheckState>>({})
  const readIds = allHandbooks.filter((h) => h.status === 'read').map((h) => h.id).join(',')
  const loadChecks = useCallback(async () => {
    setRowChecks(await loadRowChecks(supabase, readIds ? readIds.split(',') : []))
  }, [supabase, readIds])
  useEffect(() => {
    let live = true
    ;(async () => {
      const r = await loadRowChecks(supabase, readIds ? readIds.split(',') : [])
      if (live) setRowChecks(r)
    })()
    return () => { live = false }
  }, [supabase, readIds])
  const [drawerCheck, setDrawerCheck] = useState<({ id: string } & CheckView) | null>(null)
  const drawerReadId = drawer && allHandbooks.find((h) => h.id === drawer.id)?.status === 'read' ? drawer.id : null
  const loadDrawerCheck = useCallback(async (id: string) => {
    setDrawerCheck({ id, ...(await loadCheckView(supabase, id)) })
  }, [supabase])
  useEffect(() => {
    if (!drawerReadId) return
    let live = true
    ;(async () => {
      const r = await loadCheckView(supabase, drawerReadId)
      if (live) setDrawerCheck({ id: drawerReadId, ...r })
    })()
    return () => { live = false }
  }, [drawerReadId, supabase])
  const [checkPressed, setCheckPressed] = useState(false)
  const anyChecking = checkPressed || Object.values(rowChecks).some((c) => c.open)
  useEffect(() => {
    if (!anyChecking) return
    const t = setInterval(() => {
      void loadHandbooks(); void loadChecks()
      if (drawerReadId) void loadDrawerCheck(drawerReadId)
      setCheckPressed(false)
    }, 5000)
    return () => clearInterval(t)
  }, [anyChecking, loadHandbooks, loadChecks, drawerReadId, loadDrawerCheck])
  const [checkNotice, setCheckNotice] = useState<string | null>(null)
  const [startingCheck, setStartingCheck] = useState(false)
  const checkNow = async (h: HandbookRow) => {
    setStartingCheck(true); setCheckNotice(null)
    try {
      const res = await fetch(`/api/hr/handbooks/${h.id}/check`, { method: 'POST', headers: await authHeaders() })
      const j = await res.json().catch(() => null)
      if (res.status !== 202) setCheckNotice(j?.error ?? 'We could not start the check just now. That is our side, not yours. Please try again.')
      setCheckPressed(true)
      await Promise.all([loadChecks(), loadDrawerCheck(h.id)])
    } finally {
      setStartingCheck(false)
    }
  }

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

  // ---- ASKING (Step 6a): POST /api/hr/answer, streamed, in the workspace's shape ----
  const [exchanges, setExchanges] = useState<HrExchange[]>([])
  const [askBusy, setAskBusy] = useState(false)
  const [topicId, setTopicId] = useState<string | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const askSeq = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const started = exchanges.length > 0
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [exchanges.length])
  const patch = (id: string, p: Partial<HrExchange>) => setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)))

  async function ask(question: string) {
    const q = question.trim()
    if (!q) { composerRef.current?.focus(); return }
    if (askBusy) return
    setBox(''); setNotice(null)
    const id = `x${++askSeq.current}`
    // The stages, each shown while it is TRUE: reading (the server's 'reading' event), checking (its
    // 'searching' events, counted), writing (the first text). No search, no checking stage.
    const steps = (at: Step, searched: boolean): HrExchange['steps'] =>
      ({ list: searched || at === 'hr_check' ? ['hr_read', 'hr_check', 'write'] : at === 'write' ? ['hr_read', 'write'] : ['hr_read', 'hr_check', 'write'], at })
    setExchanges((prev) => [...prev, { id, question: q, text: '', sources: [], phase: 'sending', searches: 0, reading: '' }])
    setAskBusy(true)
    const controller = new AbortController()
    inFlight.current = controller
    try {
      const res = await fetch('/api/hr/answer', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }), signal: controller.signal,
        body: JSON.stringify({ question: q, topicId,
          history: exchanges.filter((x) => x.phase === 'done' && x.text).map((x) => ({ question: x.question, answer: x.text, sources: x.sources })) }),
      })
      if (!(res.headers.get('content-type') ?? '').includes('x-ndjson')) {
        const json = await res.json().catch(() => null)
        if (json?.outcome === 'refused') { patch(id, { phase: 'refused', refusal: String(json.message ?? '') }); return }
        patch(id, { phase: 'failed', error: json?.error ?? 'That request could not be completed.' })
        return
      }
      // The 'reading' event is HR's own: read here, then every line goes on to the workspace's reader.
      let searched = false
      let waitEnded: string | null = null
      async function* tap(lines: AsyncIterable<string>) {
        for await (const line of lines) {
          try {
            const ev = JSON.parse(line)
            if (ev?.type === 'reading') patch(id, { reading: readingWords(ev.handbooks ?? []), steps: steps('hr_read', false) })
            // THE HONEST WAIT (Step 6c): the real progress, shown as the first stage until the reading is done.
            if (ev?.type === 'waiting') patch(id, { reading: String(ev.words ?? ''), steps: steps('hr_read', false) })
            if (ev?.type === 'not_answered') waitEnded = String(ev.message ?? '')
            if (ev?.type === 'searching') searched = true
          } catch { /* a half line: the reader skips it too */ }
          yield line
        }
      }
      const outcome = await readAnswerStream(tap(ndjsonLines(res.body!.getReader())),
        (p) => patch(id, { text: hideHandbookMarkers(p.text), searches: p.searches, phase: p.phase,
          steps: steps(p.phase === 'searching' ? 'hr_check' : p.text ? 'write' : 'hr_read', searched) }),
        () => controller.signal.aborted)
      if (waitEnded !== null) {
        // The server ended without an answer and said why: the words, and the turn is "Not answered".
        patch(id, { phase: 'not_answered', steps: undefined, notAnsweredWords: waitEnded })
      } else if (outcome.kind === 'done') {
        patch(id, { text: outcome.text, sources: outcome.sources as AnswerSource[], phase: 'done', steps: undefined })
        if (outcome.topicId) setTopicId(outcome.topicId)
      } else if (outcome.kind === 'stopped_by_user') patch(id, { text: hideHandbookMarkers(outcome.text), phase: 'stopped', steps: undefined })
      else if (outcome.kind === 'stopped_early') patch(id, { text: hideHandbookMarkers(outcome.text), phase: 'stopped_early', steps: undefined })
      else patch(id, { text: hideHandbookMarkers(outcome.text), phase: 'failed', steps: undefined, error: outcome.message })
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') patch(id, { phase: 'stopped', steps: undefined })
      else patch(id, { phase: 'failed', steps: undefined, error: 'The answer could not be completed.' })
    } finally {
      inFlight.current = null
      setAskBusy(false)
      setTopics(await readTopicList(supabase, 'hr'))
    }
  }
  const stop = () => { inFlight.current?.abort(); inFlight.current = null }

  // ---- CONVERSATIONS (Step 6b): the workspace's summary drawer, reopening and deleting ----
  const [convDrawer, setConvDrawer] = useState<TopicRow | null>(null)
  const [convDeleting, setConvDeleting] = useState(false)
  const [convDeleteBusy, setConvDeleteBusy] = useState(false)
  const [convDeleteFailed, setConvDeleteFailed] = useState(false)

  /** Loads the topic's stored turns onto the Ask tab, the workspace's way (`/api/topics/[id]`, unchanged). */
  async function openConversation(t: TopicRow) {
    setNotice(null)
    const res = await fetch(`/api/topics/${t.id}`, { headers: await authHeaders() })
    const j = await res.json().catch(() => null)
    if (!res.ok) { setNotice(j?.error ?? 'That conversation could not be opened. Please try again.'); return }
    const turns = (j.turns ?? []) as Array<{ role: string; text: string; sources: AnswerSource[] | null }>
    const rebuilt: HrExchange[] = []
    for (let i = 0; i < turns.length; i++) {
      if (turns[i].role !== 'user') continue
      // NOT ANSWERED, from the stored turns alone: a question with no answer after it.
      const answer = turns[i + 1]?.role === 'assistant' ? turns[i + 1] : null
      rebuilt.push({ id: `r${i}`, question: turns[i].text, text: answer?.text ?? '', sources: answer?.sources ?? [],
        phase: answer ? 'done' : 'not_answered', searches: 0, reading: '' })
    }
    setExchanges(rebuilt)
    setTopicId(t.id)
    setConvDrawer(null)
    setTab('ask')
  }

  async function confirmConvDelete() {
    if (!convDrawer) return
    setConvDeleteBusy(true); setConvDeleteFailed(false)
    let ok = false
    try { ok = (await fetch(`/api/topics/${convDrawer.id}`, { method: 'DELETE', headers: await authHeaders() })).ok } catch { ok = false }
    setConvDeleteBusy(false)
    if (!ok) { setConvDeleteFailed(true); return }
    if (topicId === convDrawer.id) { setExchanges([]); setTopicId(null) }
    setConvDeleting(false); setConvDrawer(null)
    setTopics(await readTopicList(supabase, 'hr'))
  }
  const cancelConvDelete = () => { if (convDeleteBusy) return; setConvDeleting(false); setConvDeleteFailed(false) }

  // ---- THE SUMMARY (Step 7): the workspace's press-and-wait, through HR's route ----
  // One wait per conversation: this tab's own press. The list's `summaryInProgress` covers anyone's run.
  const [summaryWait, setSummaryWait] = useState<{ topicId: string; before: string | null } | null>(null)
  const summaryRunning = (id: string | null) => !!id && (summaryWait?.topicId === id || !!topics.find((t) => t.id === id)?.summaryInProgress)
  async function summarise(id: string) {
    if (summaryRunning(id)) return
    setNotice(null)
    const before = topics.find((t) => t.id === id)?.summarised_at ?? null
    setSummaryWait({ topicId: id, before })
    let res: Response | null = null
    try { res = await fetch(`/api/hr/topics/${id}/summarise`, { method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }) }) } catch { res = null }
    const j = res ? await res.json().catch(() => null) : null
    if (res && (res.status === 202 || (res.status === 409 && j?.status === 'writing'))) { setTopics(await readTopicList(supabase, 'hr')); return }
    setNotice(j?.error ?? SUMMARY_FAILED)
    setSummaryWait(null)
  }
  // THE POLL — every 5 seconds while a summary is being written here or anywhere; when this tab's own claim
  // clears, its summary opens in the drawer, or the failure is said plainly (the workspace's behaviour).
  const summaryWatching = !!summaryWait || topics.some((t) => t.summaryInProgress)
  useEffect(() => {
    if (!summaryWatching) return
    const t = setInterval(async () => {
      const rows = await readTopicList(supabase, 'hr')
      setTopics(rows)
      setConvDrawer((d) => (d ? rows.find((r) => r.id === d.id) ?? d : d))
      setSummaryWait((w) => {
        if (!w) return w
        const row = rows.find((r) => r.id === w.topicId)
        if (!row || row.summaryInProgress) return w
        if (row.summarised_at && row.summarised_at !== w.before) setConvDrawer(row)
        else setNotice(SUMMARY_FAILED)
        return null
      })
    }, 5000)
    return () => clearInterval(t)
  }, [summaryWatching, supabase])

  // The drawer's report and the facts line's count, read as the caller (RLS), for the open conversation.
  const [convReport, setConvReport] = useState<{ id: string; report: SummaryReport | null; facts: number } | null>(null)
  const convDrawerId = convDrawer?.id ?? null
  const convDrawerSummarisedAt = convDrawer?.summarised_at ?? null
  useEffect(() => {
    if (!convDrawerId) return
    let live = true
    ;(async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase.from('topics').select('summary_report').eq('id', convDrawerId).maybeSingle(),
        supabase.from('fact_proposals').select('id', { count: 'exact', head: true }).eq('topic_id', convDrawerId).eq('status', 'proposed'),
      ])
      if (live) setConvReport({ id: convDrawerId, report: ((data as { summary_report?: SummaryReport | null } | null)?.summary_report) ?? null, facts: count ?? 0 })
    })()
    return () => { live = false }
  }, [convDrawerId, convDrawerSummarisedAt, supabase])
  /** "Research this" and Enter. An empty box puts the cursor in it, as the workspace does. */
  const research = () => { void ask(box) }
  const newConversation = () => { setTab('ask'); setBox(''); if (!askBusy) { setExchanges([]); setTopicId(null) } }

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
          <div className={started ? 'pt-1' : ''}>
            {exchanges.map((x, xi) => {
              const { body, lines } = splitAppended(x.text)
              // Asked again later in this conversation, word for word: the line says so and offers nothing.
              const askedAgain = x.phase === 'not_answered'
                && exchanges.slice(xi + 1).some((y) => y.question.trim() === x.question.trim())
              return (
                <div key={x.id} className="mb-8">
                  <div className="mb-5 flex justify-end">
                    <div className="max-w-[85%] rounded-2xl bg-gray-200 px-4 py-3 text-[16px] leading-relaxed text-gray-900">
                      <p>{x.question}</p>
                    </div>
                  </div>
                  {x.steps && x.phase !== 'done' && (
                    <Stages steps={x.steps} name={x.reading} count={x.searches} onStop={stop} />
                  )}
                  {x.text && (
                    <>
                      <HrAnswerView body={body} lines={x.phase === 'done' ? lines : []} sources={x.sources} />
                    </>
                  )}
                  {x.phase === 'refused' && <p className="text-[14px] text-gray-600">{x.refusal}</p>}
                  {x.phase === 'stopped_early' && (
                    <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
                      <b className="font-semibold">This answer stopped early.</b>{' '}
                      The answer stopped before it was finished, so what is above is incomplete. Nothing
                      was saved for it.
                      <button onClick={() => ask(x.question)}
                        className="ml-2 font-medium underline hover:no-underline">Try again</button>
                    </div>
                  )}
                  {x.phase === 'not_answered' && askedAgain && (
                    <p className="mt-2 text-[14px] text-gray-500">{ASKED_AGAIN_BELOW}</p>
                  )}
                  {x.phase === 'not_answered' && !askedAgain && (
                    <p className="mt-2 text-[14px] text-gray-500">
                      {x.notAnsweredWords ?? NOT_ANSWERED}
                      <button onClick={() => ask(x.question)} disabled={askBusy}
                        className="ml-2 font-medium underline hover:no-underline disabled:text-gray-300">{ASK_IT_AGAIN}</button>
                    </p>
                  )}
                  {x.phase === 'stopped' && (
                    <p className="mt-2 text-[14px] text-gray-500">
                      Stopped. {x.text ? 'What arrived is above — ' : ''}Ask again, or change the question.
                    </p>
                  )}
                  {x.phase === 'failed' && (
                    <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
                      {x.error} You can ask again, or rephrase the question.
                    </div>
                  )}
                </div>
              )
            })}
            <div ref={bottomRef} />

            {/* THE DOCKED COMPOSER, the workspace's markup, once a question has been asked. No attach and no
                action row yet (step 7). */}
            {started && (
              <div className="no-print mt-8">
                <div className="relative rounded-xl border border-gray-200 bg-white focus-within:border-[var(--green)]">
                  <div className="flex items-end gap-2 p-3.5">
                    <textarea
                      ref={composerRef}
                      value={box}
                      onChange={(e) => setBox(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(box) } }}
                      rows={1}
                      placeholder={HR_COMPOSER_HINT}
                      className="max-h-36 min-h-[92px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[16px] text-gray-900 outline-none placeholder:text-[16px] placeholder:text-gray-400"
                    />
                    {askBusy ? (
                      <button onClick={stop} title="Stop" aria-label="Stop"
                        className="rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-700">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
                      </button>
                    ) : (
                      <button onClick={() => ask(box)} title="Send" aria-label="Send" disabled={!box.trim()}
                        className="rounded-lg bg-[var(--green)] p-2 text-white hover:bg-[var(--green-ink)] disabled:opacity-40">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                {/* THE ACTION ROW (canvas board 10): "Summarise this conversation" green and first, then Download.
                    Disabled while a request is in flight, with the run's own words in place of the button's. */}
                {topicId && exchanges.some((x) => x.phase === 'done') && (
                  <div className="mt-[10px] flex flex-wrap items-center gap-5">
                    <button onClick={() => summarise(topicId)} disabled={askBusy || summaryRunning(topicId)}
                      className="text-[14px] font-medium text-[var(--green-ink)] hover:underline disabled:text-gray-300">
                      {summaryRunning(topicId) ? CLAIM_WORDS.summary : 'Summarise this conversation'}
                    </button>
                    <button onClick={() => printWithFrame({ company: companyName ?? '', type: 'Conversation' })}
                      disabled={askBusy} className={TEXT_ACTION}>
                      Download
                    </button>
                  </div>
                )}
                <p className="mt-2 text-[12px] text-gray-500">
                  One topic per conversation. When you are done, summarise it. Start a new conversation for the next topic.
                </p>
              </div>
            )}

            {!started && (
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
            )}
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
                {/* A row opens the workspace's summary drawer (Step 6b). No summary is written for HR until step 7. */}
                <ConversationList topics={topics} running={() => false} onOpen={setConvDrawer} />
              </div>
            )}
          </div>
        )}

        {/* ================= HANDBOOKS (canvas board 3) ================= */}
        {tab === 'handbooks' && (
          <div className="pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 sm:flex-nowrap">
              <p className="min-w-0 flex-1 text-[13px] text-gray-500">
                {HANDBOOKS_TAB_LINE}
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
                                  {/* When IT was added, never a "replaced" date (owner, 7 October): always true, even after a middle version is deleted. */}
                                  <span aria-hidden="true">·</span>
                                  <span>added {friendlyDate(h.created_at)}</span>
                                </p>
                              ) : (
                                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-gray-500">
                                  <span className="truncate">{h.file_name}</span>
                                  <span aria-hidden="true">·</span>
                                  {h.status === 'read' ? (
                                    // THE CHECK ON THE ROW (owner, Baseline Step 1): amber only where something needs the person.
                                    checkLine({ ...(rowChecks[h.id] ?? { open: null, last: null }), checkedAt: h.checked_at ?? null, nextCheckAt: h.next_check_at ?? null }, (iso) => friendlyDate(iso))
                                      .map((p, i) => (
                                        <span key={i} className="contents">
                                          {i > 0 && <span aria-hidden="true">·</span>}
                                          <span className={p.amber ? 'text-[var(--amber)]' : undefined}>{p.text}</span>
                                        </span>
                                      ))
                                  ) : (
                                    /* Amber only on "Could not read": the one state that asks something of somebody. */
                                    <span className={couldNot ? 'text-[var(--amber)]' : undefined}>{statusWords(h.status, h.status_reason, sectionCount(h))}</span>
                                  )}
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

      {/* ================= THE CONVERSATION DRAWER — the workspace's summary drawer, its markup and words ================= */}
      {convDrawer && (
        <div className="no-print fixed inset-0 z-[45] bg-gray-900/30" onClick={() => setConvDrawer(null)} />
      )}
      {convDrawer && (
        <Drawer title={displayTitle(convDrawer.title) ?? 'Conversation'}
          sub={`${friendlyDate(convDrawer.last_turn_at ?? convDrawer.created_at)} · ${conversationStatus(convDrawer, convDrawer.turnCount > 0).label}`}
          company={companyName}
          printType="Summary report"
          printDates={convDrawer.summarised_at
            ? `Summarised ${printDate(convDrawer.summarised_at)}`
            : `Last message ${printDate(convDrawer.last_turn_at ?? convDrawer.created_at)}`}
          onClose={() => setConvDrawer(null)}
          footer={
            <>
              {convDrawer.turnCount > 0 && (
                <button onClick={() => openConversation(convDrawer)} className={OUTLINE}>Open the conversation</button>
              )}
              <button onClick={printDrawer} className={`ml-auto ${TEXT_ACTION}`}>Download</button>
              <button onClick={() => { setConvDeleteFailed(false); setConvDeleting(true) }}
                className="ml-3 text-[14px] text-gray-400 hover:text-red-600">Delete</button>
            </>
          }>
          <div className="flex min-h-full flex-col">
            {(() => {
              const rep = convReport?.id === convDrawer.id ? convReport : null
              // THE FACTS LINE — the workspace's words and markup (`app/compliance/page.tsx`).
              const factsLine = rep?.facts ? (
                <div className="no-print flex items-center justify-between gap-4 border-y border-gray-200 py-3">
                  <p className="text-[14px] text-gray-600">
                    {rep.facts === 1 ? '1 fact from this conversation is waiting in Company information'
                      : `${rep.facts} facts from this conversation are waiting in Company information`}
                  </p>
                  <a href="/company-information" className="shrink-0 text-[14px] text-[var(--green-ink)] hover:underline">Review →</a>
                </div>
              ) : null
              if (summaryRunning(convDrawer.id)) return <p className="text-[12px] text-gray-500">{CLAIM_WORDS.summary}</p>
              if (rep?.report) {
                return <ReportView key={convDrawer.id} report={rep.report as unknown as ReportLike<HrReportSource>}
                  factsLine={factsLine} sourceShape={HR_SOURCE} words={HR_REPORT_WORDS} />
              }
              return convDrawer.summary
                ? <AnswerBody text={convDrawer.summary} sources={[]} />
                : <p className="text-[14px] leading-relaxed text-gray-600">{NOT_SUMMARISED_HR}</p>
            })()}
          </div>
        </Drawer>
      )}

      {/* ================= DELETING A CONVERSATION (canvas board 11, the workspace's delete sheet) ================= */}
      {convDeleting && convDrawer && (
        <Sheet onClose={cancelConvDelete} title={DELETE_CONVERSATION.title} lede={DELETE_CONVERSATION.lede}>
          <p className="text-[13px] leading-relaxed text-gray-600">{DELETE_CONVERSATION.note}</p>
          {convDeleteFailed && <p className="mt-3 text-[13px] text-amber-900">{DELETE_FAILED}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* "Download the summary" only when there is one to download (step 7 writes them). */}
            {convDrawer.summary && <button onClick={printDrawer} className={OUTLINE}>Download the summary</button>}
            <button onClick={confirmConvDelete} disabled={convDeleteBusy}
              className="rounded-md border border-[#B42318] px-3 py-1.5 text-[14px] font-medium text-[#B42318] hover:bg-red-50 disabled:opacity-50">
              Delete for good
            </button>
            <button onClick={cancelConvDelete} autoFocus className={`ml-auto ${TEXT_ACTION}`}>Cancel</button>
          </div>
        </Sheet>
      )}

      {/* ================= THE HANDBOOK DRAWER (the shared 720 drawer) ================= */}
      {/* The workspace's scrim behind it, as the conversation drawer has (owner, 6b answers). */}
      {drawer && (
        <div className="no-print fixed inset-0 z-[45] bg-gray-900/30" onClick={() => setDrawer(null)} />
      )}
      {drawer && (
        <Drawer title={drawer.name}
          sub={(() => {
            const h = allHandbooks.find((x) => x.id === drawer.id) ?? drawer
            const when = h.checked_at ? `checked ${friendlyDate(h.checked_at)}` : `added ${friendlyDate(h.created_at)}`
            return `${h.is_current ? '' : 'Older version · '}${siteLabel(h)} · ${h.file_name} · ${when}`
          })()}
          company={companyName}
          onClose={() => { setDrawer(null); setCheckNotice(null) }}
          footer={
            <>
              {/* The workspace's order: the outline action first (Check now, current and read only). */}
              {drawer.is_current && drawerReadId === drawer.id && (
                <button onClick={() => checkNow(drawer)} disabled={startingCheck || !!drawerCheck?.open} className={OUTLINE}>Check now</button>
              )}
              <button onClick={() => openHandbook(drawer)} className={TEXT_ACTION}>Open the handbook</button>
              {/* A newer version is added to the CURRENT one only (owner, 7 October). */}
              {drawer.is_current && (
                <button onClick={() => pickFile(drawer.id)} disabled={saving} className={TEXT_ACTION}>Add a newer version</button>
              )}
              {(() => {
                const st = allHandbooks.find((x) => x.id === drawer.id)?.status ?? drawer.status
                return (st === 'could_not_read' || st === 'uploaded') && (
                  <button onClick={() => readAgain(drawer)} disabled={startingRead} className={TEXT_ACTION}>Read it again</button>
                )
              })()}
              <button onClick={printDrawer} className={`ml-auto ${TEXT_ACTION}`}>Download</button>
              <button onClick={() => { setDeleteFailed(false); setDeleting(true) }}
                className="text-[14px] text-gray-400 hover:text-red-600">Delete</button>
            </>
          }>
          {(() => {
            const h = allHandbooks.find((x) => x.id === drawer.id) ?? drawer
            // EVERY VERSION TELLS THE TRUTH ABOUT ITSELF (owner, 7 October): the body follows this row's own
            // status, older or current — could not read says why, in the row's words and amber.
            if (h.status === 'could_not_read') {
              return <p className="text-[14px] leading-relaxed text-[var(--amber)]">{statusWords(h.status, h.status_reason)}</p>
            }
            if (h.status !== 'read' || drawerCheck?.id !== h.id) {
              return <p className="text-[14px] leading-relaxed text-gray-600">This handbook has not been read yet.</p>
            }
            const { open, last } = drawerCheck
            return (
              <div className="space-y-6">
                {checkNotice && <p className="text-[13px] text-[var(--amber)]">{checkNotice}</p>}
                {open && <p className="text-[13px] text-gray-500">{checkingSections(open.done, open.total)}</p>}
                {!open && !last && <p className="text-[14px] leading-relaxed text-gray-600">{NOT_CHECKED_YET}</p>}
                {last && (
                  <>
                    {open && last.finishedAt && (
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{earlierCheckHeading(longDate(last.finishedAt))}</h4>
                    )}
                    {last.status === 'failed'
                      ? <p className="text-[14px] leading-relaxed text-[var(--amber)]">{CHECK_FAILED}</p>
                      : h.next_check_at && <p className="text-[13px] text-gray-500">{readAgainNote(longDate(h.next_check_at))}</p>}
                    {last.parts.map((p, i) => p.kind === 'answer' ? (
                      // EACH PART IS DRAWN EXACTLY AS AN HR ANSWER (owner, Baseline Step 1).
                      <div key={i} className={i > 0 ? 'border-t border-gray-200 pt-6' : ''}>
                        <HrAnswerView {...(() => { const a = splitAppended(p.text); return { body: a.body, lines: a.lines } })()} sources={p.sources as AnswerSource[]} />
                      </div>
                    ) : p.kind === 'failed' ? (
                      <p key={i} className="text-[14px] leading-relaxed text-[var(--amber)]">{PART_NOT_CHECKED}</p>
                    ) : (
                      // A check stored before 8 October: shown as it was stored.
                      <div key={i}>
                        <p className="text-[14px] font-semibold text-gray-900">{p.title}
                          <span className={`ml-2 text-[12px] font-normal ${p.failed || p.word === 'needs_change' ? 'text-[var(--amber)]' : 'text-gray-500'}`}>
                            {p.failed ? 'Not checked' : LEGACY_WORD[p.word ?? ''] ?? ''}</span></p>
                        {p.findings.map((f, fi) => (
                          <div key={fi} className="mt-2">
                            <p className="text-[14px] text-gray-900">{f.title}</p>
                            {f.why && <p className="text-[13px] leading-relaxed text-gray-600">{f.why}</p>}
                            {f.what_to_change && <p className="text-[13px] leading-relaxed text-gray-600">{f.what_to_change}</p>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })()}
        </Drawer>
      )}

      {/* ================= WHICH SITE (the workspace's choice sheet) ================= */}
      {pendingFile && (
        <Sheet onClose={() => setPendingFile(null)} title="Which site does this handbook cover?"
          lede={uploadLede(pendingFile.name)}>
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

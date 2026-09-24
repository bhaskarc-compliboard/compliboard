'use client'
/**
 * THE COMPLIANCE WORKSPACE — rebuilt from `prototypes/compliance-workspace.html`, Run 3.
 * `DECISIONS.md` §126.
 *
 * *** THE PROTOTYPE IS THE SPEC. *** Where it and the old page differed, it won: the tabs, the
 * docking composer, the drawers, the row pattern and the vocabulary are all its. Where it is
 * silent — auth, storage paths, how a checklist item persists — the old page's behaviour is kept.
 *
 * REBUILT RATHER THAN PATCHED. The old page carried two tabs that no longer exist ("Create
 * action items", "Saved"), and a layout with no drawer. Patching would have left the removed
 * vocabulary in the file.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE DOES NOT DO
 *   · It does not touch a prompt or a pipeline switch (`CLAUDE.md` §3.1).
 *   · It does not read or write requirements, obligations or switches — except the ONE write a
 *     fact proposal makes, which goes through `/api/switches/answer`, the same route a person
 *     answering a question uses. Never the service role, never from a job (§108).
 * ---------------------------------------------------------------------------
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient, authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { AnswerBody, SourceList, type AnswerSource } from '@/components/AnswerBody'
import { EXAMPLE_QUESTIONS } from '@/config/examples'
import { displaySource } from '@/lib/sourceTitle'
import { readAnswerStream, ndjsonLines } from '@/lib/answerStream'
import { DOCUMENTS_BUCKET } from '@/lib/storage'
import {
  conversationStatus, progressLabel, progressPercent, friendlyDate,
} from '@/lib/conversationStatus'

type Tab = 'ask' | 'conversations' | 'checklists'

/** One exchange on screen. `text` grows as the stream arrives. */
interface Exchange {
  id: string
  question: string
  text: string
  sources: AnswerSource[]
  /** What the answer is doing right now, driven by the REAL stream events — never a timer. */
  phase: 'sending' | 'searching' | 'writing' | 'done' | 'stopped' | 'stopped_early' | 'failed'
  searches: number
  error?: string
  file?: { name: string; kind: string; classification: string | null; folder: string | null; unreadable: boolean; failure?: string }
}

interface TopicRow {
  id: string; title: string | null; summary: string | null
  summarised_at: string | null; summary_source: string | null
  delete_after: string | null; last_turn_at: string | null; created_at: string
  turnCount: number; checklistId: string | null
}

interface ChecklistRow {
  id: string; title: string | null; created_at: string
  total: number; done: number; fromConversation: number; added: number
}

interface ItemRow {
  id: string; name: string; description: string | null; why: string | null
  source_url: string | null; source_title: string | null
  origin: string | null; completed: boolean; category: string; sort_order: number
  parent_item_index: number | null
}

interface Proposal { id: string; switch_key: string; proposed_value: string; quote: string | null }

const MAX_STEPS_IN_FLIGHT = 3

export default function CompliancePage() {
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('ask')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  /**
   * THE FILE JUST ATTACHED, WAITING FOR THE QUESTION THAT GOES WITH IT — §129.
   *
   * An attach almost always comes BEFORE the question about it, and until Fix Round 2 the file
   * went to Documents and nowhere else: the next research call carried no trace of it and the
   * model said no file had come through. Only the ID is held, not the `File` — the route loads
   * the bytes from storage, so this still works after a reload and on a reopened conversation.
   */
  const [pendingDoc, setPendingDoc] = useState<{ id: string; name: string } | null>(null)

  // ---- the conversation on screen ----
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [topicId, setTopicId] = useState('')
  const [box, setBox] = useState('')
  const inFlight = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  /** The composer, so a click with an empty box puts the cursor there rather than doing nothing. */
  const composerRef = useRef<HTMLTextAreaElement>(null)

  // ---- lists ----
  const [topics, setTopics] = useState<TopicRow[]>([])
  const [checklists, setChecklists] = useState<ChecklistRow[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])

  // ---- drawers and sheets ----
  const [summaryDrawer, setSummaryDrawer] = useState<TopicRow | null>(null)
  const [listDrawer, setListDrawer] = useState<{ row: ChecklistRow; items: ItemRow[] } | null>(null)
  const [scopeFor, setScopeFor] = useState<string | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)

  // micro-steps, generated in the background — Run 1's rules, three at a time
  const [steps, setSteps] = useState<Record<string, ItemRow[]>>({})
  const [stepsPending, setStepsPending] = useState<Record<string, boolean>>({})
  const stepQueue = useRef<Array<{ checklistId: string; index: number; item: ItemRow }>>([])
  const stepStarted = useRef<Set<string>>(new Set())
  const stepRunning = useRef(false)

  const started = exchanges.length > 0

  // ------------------------------------------------------------------ loading
  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('company_id').maybeSingle()
      if (prof?.company_id) {
        setCompanyId(prof.company_id as string)
        // The printed header names the company. An id on a page handed to an inspector is worth
        // nothing; if the name cannot be read the header simply omits that line (Fix Round 1 E).
        const { data: co } = await supabase
          .from('companies').select('name').eq('id', prof.company_id as string).maybeSingle()
        if (co?.name) setCompanyName(co.name as string)
      }
    })()
  }, [supabase])

  const loadTopics = useCallback(async () => {
    const { data } = await supabase
      .from('topics')
      .select('id, title, summary, summarised_at, summary_source, delete_after, last_turn_at, created_at')
      .order('created_at', { ascending: false }).limit(60)
    const rows = (data ?? []) as Array<Omit<TopicRow, 'turnCount' | 'checklistId'>>
    // Turn counts decide "cleared" vs "kept" — the DATE only says when it may go, and between
    // the due date and the 03:30 run the conversation is still open. lib/conversationStatus.ts.
    const withCounts = await Promise.all(rows.map(async (t) => {
      const { count } = await supabase.from('turns').select('*', { count: 'exact', head: true }).eq('topic_id', t.id)
      const { data: cl } = await supabase.from('checklists').select('id').eq('from_topic_id', t.id).limit(1).maybeSingle()
      return { ...t, turnCount: count ?? 0, checklistId: (cl?.id as string) ?? null }
    }))
    setTopics(withCounts)
  }, [supabase])

  const loadChecklists = useCallback(async () => {
    const { data } = await supabase
      .from('checklists').select('id, title, created_at').order('created_at', { ascending: false }).limit(60)
    const rows = (data ?? []) as Array<{ id: string; title: string | null; created_at: string }>
    const withCounts = await Promise.all(rows.map(async (c) => {
      const { data: items } = await supabase
        .from('checklist_items').select('completed, origin').eq('checklist_id', c.id).is('parent_item_index', null)
      const list = (items ?? []) as Array<{ completed: boolean; origin: string | null }>
      return {
        ...c,
        total: list.length,
        done: list.filter((i) => i.completed).length,
        fromConversation: list.filter((i) => i.origin === 'conversation').length,
        added: list.filter((i) => i.origin === 'added').length,
      }
    }))
    setChecklists(withCounts)
  }, [supabase])

  const loadProposals = useCallback(async () => {
    const { data } = await supabase
      .from('fact_proposals').select('id, switch_key, proposed_value, quote')
      .eq('status', 'proposed').order('created_at', { ascending: true }).limit(20)
    setProposals((data ?? []) as Proposal[])
  }, [supabase])

  useEffect(() => {
    if (companyId) { loadTopics(); loadChecklists(); loadProposals() }
  }, [companyId, loadTopics, loadChecklists, loadProposals])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [exchanges.length])

  // ------------------------------------------------------------------ asking
  const patch = (id: string, p: Partial<Exchange>) =>
    setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)))

  async function ask(question: string, mode: 'research' | 'checklist') {
    const q = question.trim()
    if (!q || busy) return
    setBox('')
    setNotice(null)
    const id = `x${Date.now()}`
    setExchanges((prev) => [...prev, { id, question: q, text: '', sources: [], phase: 'sending', searches: 0 }])
    setBusy(true)
    const controller = new AbortController()
    inFlight.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        signal: controller.signal,
        body: JSON.stringify({
          question: q, mode, topicId,
          // Each earlier answer carries the sources its `[n]` markers point at. Without them a
          // later turn reads its own markers as references to nothing and says the sources were
          // never retrieved — which is false, and the summariser then archives the claim (§127).
          history: exchanges.filter((x) => x.phase === 'done' && x.text && !x.file)
            .map((x) => ({ question: x.question, answer: x.text, sources: x.sources })),
          // The attachment travels with the question it belongs to (§129). Sent once: the
          // route persists the link on the turn, and later turns are served from that.
          documentId: pendingDoc?.id ?? null,
        }),
      })

      // The route saves the user turn — with the document link on it — before it streams, so
      // once the response is here the attachment is persisted and this can be cleared. Clearing
      // it before the request would lose the link if the send failed; never clearing it would
      // attach the same file to every later question.
      if (res.ok) setPendingDoc(null)

      // The checklist path answers with one JSON body, not a stream.
      if (!(res.headers.get('content-type') ?? '').includes('x-ndjson')) {
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          patch(id, { phase: 'failed', error: json?.error ?? 'That request could not be completed.' })
          return
        }
        if (json?.topicId) setTopicId(String(json.topicId))
        patch(id, { phase: 'done', text: `**${json?.title ?? 'Checklist'}** — saved to your checklists.` })
        await loadChecklists()
        return
      }

      // THE STREAM IS READ THROUGH `lib/answerStream.ts`, WHICH KNOWS THE DIFFERENCE BETWEEN
      // A STREAM THAT ENDED AND A STREAM THAT FINISHED. The old loop here marked anything that
      // did not throw as `done`, which is how the 22 Sep hazmat answer showed four lines ending
      // mid-sentence with no message at all (`DECISIONS.md` §127).
      const outcome = await readAnswerStream(
        ndjsonLines(res.body!.getReader()),
        (p) => patch(id, { text: p.text, searches: p.searches, phase: p.phase }),
        () => controller.signal.aborted,
      )
      if (outcome.kind === 'done') {
        patch(id, { text: outcome.text, sources: outcome.sources, phase: 'done' })
        if (outcome.topicId) setTopicId(outcome.topicId)
      } else if (outcome.kind === 'stopped_by_user') {
        patch(id, { text: outcome.text, phase: 'stopped' })
      } else if (outcome.kind === 'stopped_early') {
        patch(id, { text: outcome.text, phase: 'stopped_early' })
      } else {
        patch(id, { text: outcome.text, phase: 'failed', error: outcome.message })
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        // The person stopped it. Keep what arrived; say nothing that sounds like a fault.
        setExchanges((prev) => prev.map((x) => (x.id === id ? { ...x, phase: 'stopped' } : x)))
      } else {
        patch(id, { phase: 'failed', error: 'The answer could not be completed.' })
      }
    } finally {
      inFlight.current = null
      setBusy(false)
      loadTopics()
    }
  }

  function stop() {
    inFlight.current?.abort()
    inFlight.current = null
  }

  function newConversation(carrySummary?: string) {
    stop()
    setExchanges([])
    setTopicId('')
    setBox(carrySummary ? `Carrying on from the last conversation.\n\nSummary so far: ${carrySummary}\n\n` : '')
    setNudgeDismissed(false)
    setTab('ask')
  }

  // ------------------------------------------------------------------ uploads
  /**
   * A FILE ATTACHED IN THE CONVERSATION — Run 2 Task 5's client half, corrected in Fix Round 1.
   *
   * Storage → the existing `/api/documents` row → the existing `/api/document-review`
   * classification. No parallel store, and none of those three routes is changed.
   *
   * *** TWO THINGS HERE WERE WRONG IN RUN 3 AND ARE FIXED, BOTH MINE. ***
   *   · The bucket was named `documents`; it is `company-documents`. `lib/storage.ts` now holds
   *     the name once so a sixth spelling cannot happen.
   *   · `/api/document-review` takes **multipart/form-data with the file itself**, not JSON. It
   *     answered 500 — `Content-Type was not one of "multipart/form-data"` — and the page read
   *     that as "we could not read your file", which blamed the document for our own mistake.
   *
   * EVERY FAILURE APPEARS IN THE CONVERSATION, at the point of the attach, never as a banner at
   * the top of the page: the person attached a file at a place in the conversation, and that is
   * where the answer about it belongs.
   */
  async function onFilePicked(file: File) {
    setAttachOpen(false)
    const id = `f${Date.now()}`
    const card = (patchCard: Partial<NonNullable<Exchange['file']>>, note?: string) =>
      setExchanges((prev) => [...prev, {
        id, question: `Attached ${file.name}`, text: note ?? '', sources: [], phase: 'done' as const, searches: 0,
        file: {
          name: file.name,
          kind: (file.name.split('.').pop() ?? 'file').toUpperCase(),
          classification: null, folder: null, unreadable: false, ...patchCard,
        },
      }])

    if (!companyId) {
      card({ unreadable: true, failure: 'We could not tell which company you are signed in to, so the file was not saved. Reload the page and try again.' })
      return
    }

    setWorking(`Uploading ${file.name}…`)
    try {
      const path = `${companyId}/compliance/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file)
      if (upErr) {
        card({ unreadable: true, failure: `We could not upload ${file.name} — the transfer did not complete on our side. Try again, or add it from the Documents screen.` })
        return
      }

      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: file.name, file_url: path, file_type: file.type, file_size: file.size,
          from_topic_id: topicId || null,
        }),
      })
      if (!docRes.ok) {
        card({ unreadable: true, failure: `${file.name} reached us but could not be saved to your documents. Try again, or add it from the Documents screen.` })
        return
      }

      // `/api/documents` answers `{ success: true }` and no id, so the row is read back by its
      // path — RLS-scoped, so this can only find the caller's own.
      const { data: doc } = await supabase
        .from('documents').select('id, folder_id').eq('file_url', path).maybeSingle()

      setWorking(`Reading ${file.name}…`)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_name', file.name)
      if (doc?.id) fd.append('document_id', String(doc.id))
      const revRes = await fetch('/api/document-review', {
        method: 'POST', headers: await authHeaders(), body: fd,
      })
      const review = await revRes.json().catch(() => null)

      if (!revRes.ok) {
        // §5.1 — the file IS saved, so say so; assert NOTHING about contents nobody read; and
        // offer the way on. An unsupported type is our limit, not the person's error.
        const unsupported = /unsupported file type/i.test(String(review?.error ?? ''))
        card({
          unreadable: true,
          failure: unsupported
            ? `It is saved to Documents, but we cannot read ${(file.name.split('.').pop() ?? 'that').toUpperCase()} files yet, so there is nothing we can tell you about what is in it. A PDF or a Word file we can read.`
            : `It is saved to Documents, but we could not read it well enough to rely on. A photo taken square-on in good light would do it, or the original PDF if you have one.`,
        })
        return
      }

      // *** THE LINE THE REBUILT PAGE WAS MISSING (§129). *** Uploading the file and filing it
      // is not attaching it to the conversation. Holding the id here is what makes the next
      // research call carry the document.
      if (doc?.id) setPendingDoc({ id: String(doc.id), name: file.name })

      card({
        classification: review?.review?.document_type ?? review?.data?.document_type ?? null,
        // The folder is only named when the document actually has one. Naming a folder nothing
        // put it in would be the product asserting a filing that did not happen.
        folder: doc?.folder_id ? (review?.data?.folder_name ?? null) : null,
      })
    } catch (e) {
      console.error('upload failed:', e)
      card({ unreadable: true, failure: `Something went wrong saving ${file.name} on our side. Try again, or add it from the Documents screen.` })
    } finally {
      setWorking(null)
    }
  }

  // ------------------------------------------------------------------ convert / summarise
  async function convert(scope: 'discussed' | 'complete') {
    const t = scopeFor
    setScopeFor(null)
    if (!t) return
    setWorking('Building the checklist…')
    try {
      const res = await fetch('/api/checklists/from-topic', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ topicId: t, scope }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'That conversation could not be turned into a checklist. Please try again.'); return }
      await loadChecklists()
      await openChecklist(String(j.checklistId))
    } finally { setWorking(null) }
  }

  async function summarise(t: string) {
    if (!t) { setNotice('There is no conversation to summarise yet. Ask a question first.'); return }
    setWorking('Writing the summary…')
    try {
      const res = await fetch(`/api/topics/${t}/summarise`, {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'That conversation could not be summarised just now. Please try again.'); return }
      await loadTopics()
      const { data } = await supabase.from('topics')
        .select('id, title, summary, summarised_at, summary_source, delete_after, last_turn_at, created_at')
        .eq('id', t).maybeSingle()
      if (data) {
        const { count } = await supabase.from('turns').select('*', { count: 'exact', head: true }).eq('topic_id', t)
        const { data: cl } = await supabase.from('checklists').select('id').eq('from_topic_id', t).limit(1).maybeSingle()
        setSummaryDrawer({
          ...(data as unknown as Omit<TopicRow, 'turnCount' | 'checklistId'>),
          turnCount: count ?? 0, checklistId: (cl?.id as string) ?? null,
        })
      }
    } finally { setWorking(null) }
  }

  // ------------------------------------------------------------------ conversations
  async function openConversation(t: TopicRow) {
    setWorking('Opening…')
    try {
      const res = await fetch(`/api/topics/${t.id}`, { headers: await authHeaders() })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'That conversation could not be opened. Please try again.'); return }
      const turns = (j.turns ?? []) as Array<{ role: string; text: string; sources: AnswerSource[] | null; stopped: boolean }>
      const rebuilt: Exchange[] = []
      for (let i = 0; i < turns.length; i++) {
        if (turns[i].role !== 'user') continue
        const answer = turns[i + 1]?.role === 'assistant' ? turns[i + 1] : null
        rebuilt.push({
          id: `r${i}`, question: turns[i].text,
          text: answer?.text ?? '', sources: answer?.sources ?? [],
          phase: turns[i].stopped ? 'stopped' : 'done', searches: 0,
        })
      }
      setExchanges(rebuilt)
      setTopicId(t.id)
      setSummaryDrawer(null)
      setNudgeDismissed(false)
      setTab('ask')
    } finally { setWorking(null) }
  }

  async function deleteConversation(t: TopicRow) {
    if (!confirm(`Delete "${t.title ?? 'this conversation'}"? The summary and the messages both go, and this cannot be undone.`)) return
    const res = await fetch(`/api/topics/${t.id}`, { method: 'DELETE', headers: await authHeaders() })
    if (!res.ok) { setNotice('That conversation could not be deleted. Please try again.'); return }
    if (topicId === t.id) { setExchanges([]); setTopicId('') }
    setSummaryDrawer(null)
    await loadTopics()
  }

  // ------------------------------------------------------------------ checklists
  async function openChecklist(id: string) {
    const { data: row } = await supabase.from('checklists').select('id, title, created_at').eq('id', id).maybeSingle()
    if (!row) { setNotice('That checklist could not be opened. Please try again.'); return }
    const { data: items } = await supabase
      .from('checklist_items')
      .select('id, name, description, why, source_url, source_title, origin, completed, category, sort_order, parent_item_index')
      .eq('checklist_id', id).order('sort_order')
    const all = (items ?? []) as ItemRow[]
    const parents = all.filter((i) => i.parent_item_index === null)
    const kids: Record<string, ItemRow[]> = {}
    for (const k of all.filter((i) => i.parent_item_index !== null)) {
      const key = `${id}-${k.parent_item_index}`
      ;(kids[key] ||= []).push(k)
    }
    setSteps((prev) => ({ ...prev, ...kids }))
    const r = row as unknown as { id: string; title: string | null; created_at: string }
    setListDrawer({
      row: {
        id, title: r.title, created_at: r.created_at,
        total: parents.length, done: parents.filter((i) => i.completed).length,
        fromConversation: parents.filter((i) => i.origin === 'conversation').length,
        added: parents.filter((i) => i.origin === 'added').length,
      },
      items: parents,
    })
    queueSteps(id, parents, kids)
  }

  async function toggleItem(item: ItemRow) {
    if (!listDrawer || !companyId) return
    const next = !item.completed
    setListDrawer((d) => d && ({
      ...d,
      items: d.items.map((i) => (i.id === item.id ? { ...i, completed: next } : i)),
      row: { ...d.row, done: d.row.done + (next ? 1 : -1) },
    }))
    // `.eq('company_id')` beside `.eq('id')` — RLS already restricts this, and the second
    // filter is what keeps that true if a policy is ever loosened.
    await supabase.from('checklist_items')
      .update({ completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq('id', item.id).eq('company_id', companyId)
    loadChecklists()
  }

  async function deleteChecklist(id: string) {
    if (!companyId) return
    if (!confirm('Delete this checklist? This cannot be undone.')) return
    await supabase.from('checklist_items').delete().eq('checklist_id', id).eq('company_id', companyId)
    await supabase.from('checklists').delete().eq('id', id).eq('company_id', companyId)
    setListDrawer(null)
    await loadChecklists()
  }

  /**
   * MICRO-STEPS IN THE BACKGROUND — Run 1's rules, unchanged: at most three in flight, never
   * repeated, never lost. The queue is built from what is ABSENT from storage each time a
   * checklist opens, so steps already saved are skipped forever and unfinished ones resume.
   */
  function queueSteps(checklistId: string, items: ItemRow[], loaded: Record<string, ItemRow[]>) {
    const missing = items
      .map((item, index) => ({ checklistId, index, item }))
      .filter(({ index }) => {
        const key = `${checklistId}-${index}`
        return !loaded[key] && !steps[key] && !stepStarted.current.has(key)
      })
    if (!missing.length) return
    for (const m of missing) stepStarted.current.add(`${m.checklistId}-${m.index}`)
    stepQueue.current.push(...missing)
    if (!stepRunning.current) void runStepQueue()
  }

  async function runStepQueue() {
    stepRunning.current = true
    const worker = async () => {
      for (;;) {
        const job = stepQueue.current.shift()
        if (!job) return
        const key = `${job.checklistId}-${job.index}`
        setStepsPending((p) => ({ ...p, [key]: true }))
        try {
          const res = await fetch('/api/chat', {
            method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              mode: 'substeps',
              question: `Main checklist item: "${job.item.name}"\nDescription: "${job.item.description ?? ''}"\n\nGenerate 3 to 6 specific micro-steps to complete this one item only. Every step must include a direct deep link (not a homepage), a time estimate, a cost, and what to prepare.`,
            }),
          })
          const json = await res.json().catch(() => null)
          // Steps inherit the parent's source and origin and carry none of their own (§125).
          const subs = ((json?.data?.must_do ?? []) as ItemRow[]).map((s) => ({
            ...s, source_url: job.item.source_url, source_title: job.item.source_title, origin: job.item.origin,
          }))
          setSteps((prev) => ({ ...prev, [key]: subs }))
        } catch {
          // One item failing must not stop the other two. Let the next open retry it.
          stepStarted.current.delete(key)
        } finally {
          setStepsPending((p) => ({ ...p, [key]: false }))
        }
      }
    }
    await Promise.all(Array.from({ length: MAX_STEPS_IN_FLIGHT }, worker))
    stepRunning.current = false
  }

  // ------------------------------------------------------------------ fact proposals
  async function saveProposal(p: Proposal) {
    setWorking('Saving…')
    try {
      // THE SAME ROUTE A PERSON ANSWERING A QUESTION USES. Never the service role, never from a
      // job — §108: a fact inferred from prose is proposed, and only a person's click writes it.
      const res = await fetch('/api/switches/answer', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ switch_id: p.switch_key, value: p.proposed_value }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setNotice(j?.error ?? 'We could not save that one — it may not match a fact we track yet. Nothing was changed.')
        return
      }
      await supabase.from('fact_proposals').update({ status: 'accepted' }).eq('id', p.id)
      await loadProposals()
    } finally { setWorking(null) }
  }

  async function dismissProposal(p: Proposal) {
    // 'rejected' is the stored value (migration 034's CHECK); "Not now" is what it is called on
    // screen. Rejecting is a status rather than a deletion — "we looked and said no" is worth
    // keeping, and a deleted proposal would be proposed again on the next nightly run.
    await supabase.from('fact_proposals').update({ status: 'rejected' }).eq('id', p.id)
    await loadProposals()
  }

  // ------------------------------------------------------------------ render
  const proposal = proposals[0] ?? null
  const answered = exchanges.filter((x) => x.phase === 'done' && !x.file).length
  const showNudge = answered >= 4 && !nudgeDismissed && !busy

  return (
    <AppLayout>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .sources-print a::after { content: " — " attr(href); font-size: 10px; color: #444; word-break: break-all; }

          /* ----------------------------------------------------------------------------
           * DOWNLOAD FROM A DRAWER PRINTS THE DRAWER, AND NOTHING ELSE — Fix Round 1 (E).
           *
           * A drawer is \`position: fixed\` in a 560px column over the page. Printing it gave
           * a clipped strip of the drawer AND the whole page behind it — the tab bar, the
           * other conversations, the composer. \`printDrawer()\` stamps this class on <body>
           * for the duration of the print dialog: the page is hidden, and the drawer stops
           * being a panel and becomes the document.
           * -------------------------------------------------------------------------- */
          body.printing-drawer .print-page { display: none !important; }
          body.printing-drawer .print-drawer {
            position: static !important; max-width: none !important; width: 100% !important;
            border: 0 !important; box-shadow: none !important; display: block !important;
          }
          /* The body scrolls on screen; on paper it must run to as many pages as it needs. */
          body.printing-drawer .print-drawer .drawer-body {
            overflow: visible !important; padding: 0 !important; flex: none !important;
          }
        }
        /* Touch has no hover, so Delete is always visible on a narrow screen. */
        @media (max-width: 820px) { .hover-del { opacity: 1 !important; } }
      `}</style>

      {/*
        775 AS A LITERAL, NOT `max-w-[var(--measure)]`, AND THE REASON IS A TRAP WORTH KNOWING.
        The token route looks identical and silently did nothing on localhost: Tailwind
        regenerated the utility `.max-w-[var(--measure)]{max-width:var(--measure)}` — it scans
        this file for classes — while the dev server kept serving a stale `globals.css` whose
        `:root` block still ended at `--radius`. So the rule referenced a variable that did not
        exist, the declaration was discarded, and the column ran the full 1290px.

        *** IT FAILS OPEN. *** An undefined custom property in a `max-width` does not fall back
        to something sensible or warn; it removes the constraint. The production build had the
        token and was fine, so this only ever appears in the one place we actually look at it.
        `--measure` stays defined in `globals.css` for `DESIGN.md` to point at; the number that
        has to survive a stale cache is written here.
      */}
      <div className="print-page mx-auto w-full max-w-[775px] px-4 pb-12 sm:px-6">
        <div className="no-print pt-6">
          {/* Serif at 28 reads heavier than sans at 24, so the weight comes off — the typeface
              carries the emphasis. font-normal is explicit rather than inherited. */}
          <h1 className="font-serif text-[28px] font-normal text-gray-900">Compliance Workspace</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Research the rules that apply to you, and turn what you find into action steps.
          </p>
        </div>

        <div className="no-print mt-5 flex items-end justify-between gap-4 border-b border-gray-200">
          <div className="flex gap-5">
            {([['ask', 'Ask a question'], ['conversations', 'Conversations'], ['checklists', 'Checklists']] as const)
              .map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`-mb-px border-b-2 pb-2.5 text-[14px] transition-colors ${
                    tab === k ? 'border-[var(--green)] font-medium text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                  {label}
                  {k === 'checklists' && checklists.length > 0 && (
                    <span className="ml-1.5 text-[12px] text-gray-500">{checklists.length}</span>
                  )}
                </button>
              ))}
          </div>
          <button onClick={() => newConversation()}
            className="mb-2 flex shrink-0 items-center gap-1.5 text-[14px] text-gray-500 hover:text-gray-900">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">New conversation</span>
          </button>
        </div>

        {notice && (
          <div className="no-print mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {notice}
            <button onClick={() => setNotice(null)} className="ml-3 text-xs underline">Dismiss</button>
          </div>
        )}

        {/* ================= ASK ================= */}
        {tab === 'ask' && (
          <div className="pt-6">
            {exchanges.map((x) => (
              <div key={x.id} className="mb-8">
                {/* The question was `text-[15px] font-medium` and nothing else, so in a long
                    thread it read as a slightly bold paragraph and vanished. Right-aligned in a
                    grey bubble it is findable when scrolling back. GREY, not green: green is
                    carrying state on this page — the active tab, the primary action — and every
                    question you have ever asked is not a state. */}
                {x.file ? <FileCard file={x.file} onRetry={() => setAttachOpen(true)} /> : (
                  <div className="mb-5 flex justify-end">
                    <p className="max-w-[85%] rounded-2xl bg-gray-200 px-4 py-3 text-[16px] leading-relaxed text-gray-900">{x.question}</p>
                  </div>
                )}

                {(x.phase === 'sending' || x.phase === 'searching' || (x.phase === 'writing' && !x.text)) && (
                  <Working phase={x.phase} searches={x.searches} onStop={stop} />
                )}

                {/* NO CARD. The thing you read was inside a bordered white rectangle on a grey
                    page, which framed it as a widget rather than as the answer. The prose, its
                    sources and its actions now sit on the page itself. */}
                {x.text && (
                  <>
                    <AnswerBody text={x.text} sources={x.sources} />
                    <div className="sources-print"><SourceList sources={x.sources} /></div>
                    {/* ONLY UNDER THE LAST EXCHANGE. Repeated per answer, a four-turn thread
                        carried twelve of these. An older answer does not need its own download
                        button and is still reachable from the Conversations drawer. */}
                    {x.phase === 'done' && !x.file && topicId && x.id === exchanges[exchanges.length - 1]?.id && (
                      <div className="no-print mt-4 flex flex-wrap items-center gap-3">
                        <button onClick={() => setScopeFor(topicId)}
                          className="rounded-lg border border-[var(--green)] px-3.5 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-[var(--green-wash)]">
                          Turn this into a checklist
                        </button>
                        <button onClick={() => summarise(topicId)}
                          className="px-1 text-[14px] text-gray-600 hover:text-gray-900 hover:underline">
                          Summarise this
                        </button>
                        <button onClick={() => window.print()}
                          className="px-1 text-[14px] text-gray-600 hover:text-gray-900 hover:underline">
                          Download
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* The amber stays — a stopped answer IS an attention state — but a filled box
                    on a page that no longer has any other boxes shouts. A left rule carries it. */}
                {x.phase === 'stopped_early' && (
                  <div className="mt-2 border-l-2 border-amber-400 pl-3 text-[14px] text-amber-900">
                    <b className="font-semibold">This answer stopped early.</b>{' '}
                    The connection to the model ended before the answer was finished, so what is above
                    is incomplete. Nothing was saved for it.
                    <button onClick={() => ask(x.question, 'research')}
                      className="ml-2 font-medium underline hover:no-underline">Try again</button>
                  </div>
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
            ))}

            {/* Unboxed for the same reason as the answer: on a page with no cards left, a card
                is the loudest thing on it. A hairline says "this is a new thought" quietly. */}
            {showNudge && (
              <div className="no-print mb-8 border-t border-gray-200 pt-4">
                <p className="text-[14px] leading-relaxed text-gray-600">
                  <b className="font-semibold">This one has covered a fair bit.</b>{' '}
                  Want me to wrap it up as a summary and start fresh? The new conversation carries the
                  summary forward, so nothing gets lost.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={async () => {
                      const t = topicId
                      await summarise(t)
                      const { data } = await supabase.from('topics').select('summary').eq('id', t).maybeSingle()
                      newConversation((data as { summary?: string } | null)?.summary ?? undefined)
                    }}
                    className="rounded-lg border border-[var(--green)] px-3.5 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-[var(--green-wash)]">
                    Wrap up and start fresh
                  </button>
                  <button onClick={() => setNudgeDismissed(true)}
                    className="px-1 text-[14px] text-gray-600 hover:text-gray-900 hover:underline">
                    Keep going
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />

            {/*
              THE COMPOSER IS THE LAST THING IN THE CONVERSATION, NOT A BAR BOLTED TO THE WINDOW.
              It was `fixed inset-x-0 bottom-0` with its own border and blur, so it floated over
              the footer band and covered the disclaimer — and it needed pb-32 on the page to
              reserve room for itself. Now it simply follows the last exchange, inside the page
              column, which means it lines up with the answers instead of spanning past them.
            */}
            <div className="no-print mt-8">
              <div>
                <div className="rounded-xl border border-gray-300 bg-white focus-within:border-emerald-500">
                  <div className="flex items-end gap-2 p-3.5">
                    <textarea
                      ref={composerRef}
                      value={box}
                      onChange={(e) => setBox(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(box, 'research') } }}
                      rows={1}
                      placeholder="Ask about a rule, or describe a job you need the steps for…"
                      className="max-h-36 flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-[16px] text-gray-900 outline-none placeholder:text-[16px] placeholder:text-gray-400"
                    />
                    {started && (
                      <>
                        <button onClick={() => setAttachOpen(true)} title="Attach a file" aria-label="Attach a file"
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
                        </button>
                        {busy ? (
                          <button onClick={stop} title="Stop" aria-label="Stop"
                            className="rounded-lg bg-gray-900 p-2 text-white hover:bg-gray-700">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
                          </button>
                        ) : (
                          <button onClick={() => ask(box, 'research')} title="Send" aria-label="Send" disabled={!box.trim()}
                            className="rounded-lg bg-[var(--green)] p-2 text-white hover:bg-[var(--green-ink)] disabled:opacity-40">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/*
                    THE EXAMPLES LIVE IN THE BOX. Under it they were a second row of bordered
                    shapes beneath a row of bordered buttons, and the third wrapped to its own
                    line. Inside the empty box they read as things you could have typed — which
                    is why this shows `e.question`, the whole sentence, and not `e.label`. The
                    label was written for a chip.

                    They go the moment there is text: the box is then doing its own job.

                    px-3.5 on the container and px-1.5 on the button mirrors the textarea's own
                    inset exactly, so an example starts on the same pixel as the placeholder it
                    is standing in for.
                  */}
                  {!started && !box.trim() && (
                    <div className="mt-2 px-3.5 pb-3.5">
                      {EXAMPLE_QUESTIONS.map((e) => (
                        <button key={e.label} onClick={() => ask(e.question, 'research')}
                          className="block w-full truncate px-1.5 py-0.5 text-left text-[14px] text-gray-400 hover:text-gray-700">
                          {e.question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/*
                  ATTACHING IS NOT A THIRD OUTCOME. Research and checklist are two things the
                  answer can be; attaching is something you do BEFORE you ask. Giving it equal
                  width and a border said the three were alternatives, which is false — and it
                  disagreed with the docked composer, where attach has always been a paperclip.

                  The gaps carry the grouping: 24px from the box, then 16px to the buttons, so
                  this line reads as belonging to the box above rather than to the row below.
                */}
                {!started && (
                  <button onClick={() => setAttachOpen(true)} disabled={busy}
                    className="mt-6 flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-800 disabled:opacity-40">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
                    Attach a lease, a policy, a permit, or anything you want checked against the rules.
                  </button>
                )}

                {/*
                  THE BUTTONS ARE A SIBLING OF THE BOX, NOT INSIDE IT. One rounded card holding
                  both the textarea and the actions read as a single heavy object; split, the
                  box is the thing you type in and the buttons are things you press. They size to
                  themselves and sit left: stretched across three columns they read as a segmented
                  control, one choice of three, which they are not.

                  *** AND THEY ARE NOT DISABLED ON AN EMPTY BOX. *** `!box.trim()` in the disabled
                  condition meant that on every first visit — the only state this screen has
                  before a question — the primary action rendered as a pale mint rectangle at 40%
                  opacity. Nothing on the page looked like the thing to do. A click with an empty
                  box puts the cursor in the box, which is the answer to "what do I do here";
                  nothing is sent and no route is called. `busy` still disables, because during a
                  request they genuinely cannot be pressed.
                */}
                {!started && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => { if (!box.trim()) { composerRef.current?.focus(); return } ask(box, 'research') }}
                      disabled={busy}
                      className="rounded-lg bg-[var(--green)] px-5 py-2.5 text-[14px] font-medium text-white hover:bg-[var(--green-ink)] disabled:opacity-40">
                      Research this
                    </button>
                    <button
                      onClick={() => { if (!box.trim()) { composerRef.current?.focus(); return } ask(box, 'checklist') }}
                      disabled={busy}
                      className="rounded-lg border border-[var(--green)] px-5 py-2.5 text-[14px] font-medium text-[var(--green)] hover:bg-[var(--green-wash)] disabled:opacity-40">
                      Make a checklist
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ================= CONVERSATIONS ================= */}
        {tab === 'conversations' && (
          <div className="pt-6">
            {proposal && (
              <div className="no-print mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[14px] leading-relaxed text-gray-800">
                  <b className="font-semibold">One thing from a recent conversation.</b>{' '}
                  It sounded like <b>{proposal.switch_key.replace(/_/g, ' ')}</b> is <b>{proposal.proposed_value}</b>.
                </p>
                {proposal.quote && <p className="mt-1 text-[13px] italic text-gray-600">“{proposal.quote}”</p>}
                <p className="mt-1 text-[13px] text-gray-600">Saving it means we stop asking, and your requirements get sharper.</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => saveProposal(proposal)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-700">Save it</button>
                  <button onClick={() => dismissProposal(proposal)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Not now</button>
                </div>
              </div>
            )}

            <p className="mb-4 text-[13px] leading-relaxed text-gray-500">
              Summaries are kept until you delete them. The full back-and-forth is cleared 7 days after a
              conversation is summarised. Anything you uploaded stays in Documents.
            </p>

            {topics.length === 0 ? (
              <Empty title="No conversations yet" note="Ask a question and it will appear here." />
            ) : (
              <div className="divide-y divide-gray-100 border-y border-gray-100">
                {topics.map((t) => {
                  const st = conversationStatus(t, t.turnCount > 0)
                  return (
                    <div key={t.id} className="group flex items-center gap-3 py-3">
                      <button onClick={() => setSummaryDrawer(t)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-[14px] text-gray-900">{t.title ?? 'Untitled conversation'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                          <span>{friendlyDate(t.last_turn_at ?? t.created_at)}</span>
                          <span className={st.state === 'not_summarised' ? 'text-amber-700' : 'text-emerald-700'}>{st.label}</span>
                        </div>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteConversation(t) }}
                        className="hover-del shrink-0 text-[12.5px] text-gray-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
                        Delete
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= CHECKLISTS ================= */}
        {tab === 'checklists' && (
          <div className="pt-6">
            {checklists.length === 0 ? (
              <Empty title="No checklists yet" note="Ask a question, then turn the answer into a checklist." />
            ) : (
              <div className="divide-y divide-gray-100 border-y border-gray-100">
                {checklists.map((c) => (
                  <div key={c.id} className="group flex items-center gap-3 py-3">
                    <button onClick={() => openChecklist(c.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[14px] text-gray-900">{c.title ?? 'Untitled checklist'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                        <span>{friendlyDate(c.created_at)}</span>
                        <span className="text-emerald-700">{progressLabel(c.total, c.done)}</span>
                        {(c.fromConversation > 0 || c.added > 0) && (
                          <span>{c.fromConversation} from the conversation · {c.added} newly checked</span>
                        )}
                      </div>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteChecklist(c.id) }}
                      className="hover-del shrink-0 text-[12.5px] text-gray-400 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {working && (
        <div className="no-print fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white shadow-lg">
          {working}
        </div>
      )}

      {(summaryDrawer || listDrawer) && (
        <div className="no-print fixed inset-0 z-40 bg-gray-900/30"
          onClick={() => { setSummaryDrawer(null); setListDrawer(null) }} />
      )}

      {summaryDrawer && (
        <Drawer title={summaryDrawer.title ?? 'Conversation'}
          sub={`${friendlyDate(summaryDrawer.last_turn_at ?? summaryDrawer.created_at)} · ${conversationStatus(summaryDrawer, summaryDrawer.turnCount > 0).label}`}
          company={companyName}
          onClose={() => setSummaryDrawer(null)}
          footer={
            <>
              {/* HONEST TO WHAT EXISTS: "Open the conversation" only while turns are there. */}
              {summaryDrawer.turnCount > 0 && (
                <button onClick={() => openConversation(summaryDrawer)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-emerald-700">
                  Open the conversation
                </button>
              )}
              {summaryDrawer.checklistId && (
                <button onClick={() => { const id = summaryDrawer.checklistId!; setSummaryDrawer(null); openChecklist(id) }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">
                  Open the checklist
                </button>
              )}
              <button onClick={printDrawer}
                className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">
                Download
              </button>
            </>
          }>
          {summaryDrawer.summary ? (
            <AnswerBody text={summaryDrawer.summary} sources={[]} />
          ) : (
            <p className="text-[14px] leading-relaxed text-gray-600">
              This one hasn&apos;t been summarised yet. The summary is written overnight, and the full
              conversation is here until then.
            </p>
          )}
          {summaryDrawer.summarised_at && summaryDrawer.turnCount === 0 && (
            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-[12.5px] text-gray-500">
              The messages in this conversation were cleared 7 days after it was summarised. The summary
              above is kept.
            </p>
          )}
        </Drawer>
      )}

      {listDrawer && (
        <Drawer title={listDrawer.row.title ?? 'Checklist'}
          sub={`${friendlyDate(listDrawer.row.created_at)} · ${listDrawer.row.fromConversation} from the conversation · ${listDrawer.row.added} newly checked`}
          company={companyName}
          onClose={() => setListDrawer(null)}
          footer={
            <>
              <button onClick={printDrawer}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50">Download</button>
              <button onClick={() => deleteChecklist(listDrawer.row.id)}
                className="ml-auto rounded-lg px-3 py-1.5 text-[13px] text-gray-400 hover:text-red-600">Delete</button>
            </>
          }>
          <div className="mb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progressPercent(listDrawer.row.total, listDrawer.row.done)}%` }} />
            </div>
            <p className="mt-1.5 text-[12px] text-gray-500">{progressLabel(listDrawer.row.total, listDrawer.row.done)}</p>
          </div>
          <div className="space-y-3">
            {listDrawer.items.map((item, i) => {
              const key = `${listDrawer.row.id}-${i}`
              const subs = steps[key]
              return (
                <div key={item.id} className={`rounded-lg border p-3 ${item.completed ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-2.5">
                    <button onClick={() => toggleItem(item)} aria-label="Mark done"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-[11px] ${
                        item.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}>
                      {item.completed && '✓'}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-gray-900">{item.name}</p>
                      {item.description && <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600">{item.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                        {item.origin && (
                          <span className={`rounded px-1.5 py-0.5 ${item.origin === 'conversation' ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                            {item.origin === 'conversation' ? 'from this conversation' : 'newly checked'}
                          </span>
                        )}
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 underline">
                            {displaySource(item.source_title ?? '', item.source_url).title}
                          </a>
                        )}
                      </div>
                      {/* A progress note, never part of the printed checklist (Fix Round 1 E). */}
                      {stepsPending[key] && !subs && (
                        <p className="no-print mt-2 text-[12px] italic text-gray-400">steps being written…</p>
                      )}
                      {subs && subs.length > 0 && (
                        <ol className="mt-2 list-decimal space-y-1 border-l-2 border-gray-100 pl-5">
                          {subs.map((s, n) => (
                            <li key={s.id ?? n} className="text-[12.5px] leading-relaxed text-gray-600">{s.name}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Drawer>
      )}

      {scopeFor && (
        <Sheet onClose={() => setScopeFor(null)} title="How much should this cover?"
          lede="A checklist that stops where the conversation stopped can read as though you're finished.">
          <button onClick={() => convert('discussed')}
            className="w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40">
            <b className="block text-[14px] font-medium text-gray-900">Just what we discussed</b>
            <span className="mt-0.5 block text-[13px] text-gray-600">Drawn from this conversation and the sources it cited — nothing else.</span>
          </button>
          <button onClick={() => convert('complete')}
            className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40">
            <b className="block text-[14px] font-medium text-gray-900">Everything on this subject</b>
            <span className="mt-0.5 block text-[13px] text-gray-600">The items we discussed, plus what we did not reach — those are checked now and marked as newly researched.</span>
          </button>
          <button onClick={() => setScopeFor(null)} className="mt-3 w-full py-2 text-[13px] text-gray-500 hover:text-gray-800">Not now</button>
        </Sheet>
      )}

      {attachOpen && (
        <Sheet onClose={() => setAttachOpen(false)} title="Attach a file"
          lede="Anything you upload is saved to your documents so you can find it later.">
          <input ref={fileInput} type="file" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFilePicked(f); e.target.value = '' }} />
          <button onClick={() => fileInput.current?.click()}
            className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-6 text-[14px] text-gray-600 hover:border-emerald-400 hover:bg-emerald-50/40">
            Choose a file from your computer
          </button>
          <button onClick={() => setAttachOpen(false)} className="mt-3 w-full py-2 text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
        </Sheet>
      )}
    </AppLayout>
  )
}

/* ------------------------------------------------------------------ pieces */

/**
 * THE WORKING STATE, DRIVEN BY REAL EVENTS.
 *
 * The prototype animated four fixed steps on a 520 ms timer. That is a fiction — it is not
 * reporting progress, it is filling silence (`CLAUDE.md` §5.1). These words come from the
 * stream: `searching` events are counted as they arrive, and `writing` means text has started.
 */
function Working({ phase, searches, onStop }: { phase: string; searches: number; onStop: () => void }) {
  const label = phase === 'searching'
    ? (searches <= 1 ? 'Checking a source…' : `Checking ${searches} sources…`)
    : phase === 'writing' ? 'Writing the answer…' : 'Working on it…'
  return (
    <div className="no-print flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
      <span className="text-[13px] text-gray-600">{label}</span>
      <button onClick={onStop} className="ml-auto text-[12.5px] text-gray-400 underline hover:text-gray-700">Stop</button>
    </div>
  )
}

function FileCard({ file, onRetry }: { file: NonNullable<Exchange['file']>; onRetry: () => void }) {
  return (
    <div className={`mb-3 flex items-start gap-3 rounded-xl border p-3 ${file.unreadable ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <span className="shrink-0 rounded bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">{file.kind}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-gray-900">{file.name}</p>
        {file.unreadable ? (
          <>
            {/* §5.1: the failure is OURS, nothing is asserted about contents nobody read, and a
                way forward is offered. */}
            <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
              {file.failure ?? 'We could not read this one well enough to rely on it. A photo taken square-on in good light would do it, or the original PDF if you have one. It is saved to Documents either way.'}
            </p>
            <button onClick={onRetry} className="mt-2 text-[12.5px] font-medium text-emerald-700 underline">
              Upload a clearer copy
            </button>
          </>
        ) : (
          <p className="mt-1 text-[13px] text-gray-600">
            {/*
              *** NO ARTICLE. *** This read "Read as a {classification}", and the classification
              comes from the model — "Employee Handbook Addendum", "Insurance Certificate",
              "SDS". Any fixed article is wrong for half of them, and the owner saw
              "Read as a Employee Handbook Addendum" on production. Choosing a/an by first
              letter would still be wrong for "an SDS" (a consonant that reads as a vowel) and
              for "a US EPA permit". A colon needs no article and cannot be wrong.
            */}
            {file.classification ? <>Read as: <b className="font-medium">{file.classification}</b>. </> : null}
            Saved to Documents{file.folder ? ` → ${file.folder}` : ''}.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * PRINTING A DRAWER PRINTS THE DRAWER — Fix Round 1 (E).
 *
 * `window.print()` from inside a drawer printed the drawer's 560px fixed column AND the whole
 * page behind it — tabs, the other conversations, the composer. The drawer is `position: fixed`,
 * so it also clipped at the first page. This stamps a class on <body> for the duration of the
 * dialog; the print rules in the page's <style> hide `.print-page` and let `.print-drawer` flow
 * as an ordinary document.
 *
 * `afterprint` is the honest place to take the class off — `print()` returns before the dialog
 * closes in some browsers — but the listener is removed either way so a second print is clean.
 */
function printDrawer() {
  const body = document.body
  const done = () => { body.classList.remove('printing-drawer'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  body.classList.add('printing-drawer')
  window.print()
  // A belt-and-braces removal: if `afterprint` never fires, the class must not survive the page.
  setTimeout(done, 1000)
}

function Drawer({ title, sub, children, footer, onClose, company }: {
  title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode
  onClose: () => void; company?: string | null
}) {
  return (
    <aside className="print-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-gray-200 bg-white shadow-2xl">
      {/*
        THE PRINTED HEADER. On screen this is not there at all; on paper it is the only thing
        that says whose document this is and when it was taken. A printed compliance page with
        no company and no date is not evidence of anything.
      */}
      <div className="hidden print:block border-b border-gray-300 pb-2 mb-4">
        {company && <p className="text-[13px] font-semibold text-gray-900">{company}</p>}
        <p className="text-[15px] font-medium text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-600">
          {sub ? `${sub} · ` : ''}Printed {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · CompliBoard
        </p>
      </div>
      <header className="no-print flex items-start justify-between gap-4 px-6 pt-5">
        <div className="min-w-0">
          <h2 className="text-lg font-medium leading-snug text-gray-900">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-gray-500">{sub}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="no-print rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      <div className="drawer-body flex-1 overflow-y-auto px-6 py-4">{children}</div>
      {footer && <footer className="no-print flex items-center gap-2 border-t border-gray-200 px-6 py-3">{footer}</footer>}
    </aside>
  )
}

function Sheet({ title, lede, children, onClose }: {
  title: string; lede?: string; children: React.ReactNode; onClose: () => void
}) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-medium text-gray-900">{title}</h3>
        {lede && <p className="mb-3 mt-1 text-[13px] leading-relaxed text-gray-600">{lede}</p>}
        {children}
      </div>
    </div>
  )
}

function Empty({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center">
      <b className="block text-[15px] font-medium text-gray-900">{title}</b>
      <span className="mt-1 block text-[13px] text-gray-500">{note}</span>
    </div>
  )
}

'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient, authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'
import { ACCEPTED_FILE_TYPES } from '@/lib/acceptedFiles'
import { GateAskCard } from '@/components/GateAskCard'
import type { GateAsk, GateAnswering } from '@/lib/determinationGate'
// `import type` only — it is erased at compile time, so lib/turnSigning's node:crypto import
// never reaches the browser bundle. The client only ever ECHOES a turn; it never builds one.
import type { SealedTurn } from '@/lib/turnSigning'
import { displayLines, inlineParts } from '@/lib/answerDisplay'

const STATUS_MESSAGES: Record<string, string[]> = {
  hazmat: [
    "Reading your company profile...",
    "Searching EPA federal regulations...",
    "Checking OSHA requirements...",
    "Reading DOT guidelines...",
    "Checking state and county regulations...",
    "Checking for recent regulation changes...",
    "Sorting must-do from good-to-have...",
    "Building your checklist..."
  ],
  food: [
    "Reading your company profile...",
    "Searching FDA food safety regulations...",
    "Checking state health department requirements...",
    "Reviewing local county health codes...",
    "Checking for recent regulation changes...",
    "Sorting must-do from good-to-have...",
    "Building your checklist..."
  ],
  waste: [
    "Reading your company profile...",
    "Searching EPA waste disposal regulations...",
    "Checking state environmental agency rules...",
    "Checking state and county regulations...",
    "Checking for recent regulation changes...",
    "Sorting must-do from good-to-have...",
    "Building your checklist..."
  ],
  shipping: [
    "Reading your company profile...",
    "Searching DOT transport regulations...",
    "Checking PHMSA requirements...",
    "Checking state transport regulations...",
    "Checking for recent regulation changes...",
    "Sorting must-do from good-to-have...",
    "Building your checklist..."
  ],
  hr: [
    "Reading your company profile...",
    "Checking federal employment law...",
    "Reading FLSA and FMLA guidelines...",
    "Checking state labor regulations...",
    "Checking for recent regulation changes...",
    "Sorting must-do from good-to-have...",
    "Building your checklist..."
  ],
  iso: [
    "Reading your company profile...",
    "Searching certification requirements...",
    "Checking ISO standards...",
    "Reading audit preparation guidelines...",
    "Checking for recent regulation changes...",
    "Sorting must-do from good-to-have...",
    "Building your checklist..."
  ],
  default: [
    "Reading your company profile...",
    "Searching federal regulations...",
    "Checking state and county regulations...",
    "Reading relevant agency guidelines...",
    "Checking for recent regulation changes...",
    "Sorting must-do from good-to-have...",
    "Building your checklist..."
  ]
}

function getStatusMessages(question: string): string[] {
  const q = question.toLowerCase()
  if (q.match(/hazmat|chemical|hf|acid|solvent|flammable|warehouse/)) return STATUS_MESSAGES.hazmat
  if (q.match(/food|restaurant|kitchen|catering|beverage|fda/)) return STATUS_MESSAGES.food
  if (q.match(/waste|disposal|manifest|generator|rcra/)) return STATUS_MESSAGES.waste
  if (q.match(/shipping|transport|carrier|freight|dot|placard/)) return STATUS_MESSAGES.shipping
  if (q.match(/employee|hr|handbook|leave|termination|fmla/)) return STATUS_MESSAGES.hr
  if (q.match(/iso|certification|audit|sqf|haccp/)) return STATUS_MESSAGES.iso
  return STATUS_MESSAGES.default
}

interface Provider {
  name: string
  type: string
  coverage: string
  note: string
}

interface ChecklistItem {
  id?: string
  name: string
  description: string
  why?: string
  source_url?: string
  /** The readable name of the source, beside the URL — the open shape asks for both (§123).
   *  Optional: every item stored before 22 Sep 2026 has none. */
  source_title?: string
  cost_note?: string
  providers?: Provider[]
  completed?: boolean
  time_estimate?: string
  what_you_need?: string
  is_determination?: boolean
  clarifying_questions?: string[]
  agency_name?: string
  search_hint?: string
}

interface ChecklistData {
  title: string
  safety_alert?: string
  must_do: ChecklistItem[]
  good_to_have: ChecklistItem[]
  follow_up_questions?: string[]
}

interface SavedChecklist {
  id: string
  question: string
  title: string
  created_at: string
  must_do_count: number
  completed_count: number
  research_answer: string | null
  research_sources: ResearchSource[] | null
  converted_to_checklist_id: string | null
}

/** What the answer cited. Mirrors `Source` in lib/ai.ts and `checklists.research_sources`. */
interface ResearchSource { n: number; title: string; url: string }

/**
 * ONE EXCHANGE IN THE CONVERSATION. `DECISIONS.md` §108, TODO M1.2e.
 *
 * *** `kind` IS DELIBERATELY WIDER THAN QUESTION-AND-ANSWER, AND THAT IS THE POINT. ***
 *
 * The page held five singular pieces of state — one answer, one sources array, one ask, one
 * question — and `handleSubmit` erased all of them before sending the next request. The turn
 * machinery underneath was already correct (M1.2d: turns held, signed and sent), so the model had
 * the conversation and **the person could not see it.**
 *
 * Two things coming later need a message that is NOT a reply to a question, and a list of
 * `{question, answer}` pairs would design both of them out:
 *
 *   'proposal'  M1.3c — "From yesterday's conversation, it sounds like you have 47 employees —
 *               should we save that?" It arrives unprompted, with no question above it.
 *   'notice'    M1.8 — a closed topic's summary, and §110's retention notice.
 *
 * Neither is built here. The discriminator costs one field now and an unpick later.
 */
type ExchangeKind = 'answer' | 'ask' | 'proposal' | 'notice'

interface Exchange {
  id: string
  kind: ExchangeKind
  /** What the person typed. Null for a message nobody asked for — a proposal or a notice. */
  question: string | null
  /**
   * The answer text. **A VALUE THAT CAN BE APPENDED TO**, so streaming (TODO 0.11) fills the
   * newest exchange rather than needing this rebuilt: today it is replaced once, later it grows.
   */
  text: string
  /** THIS answer's citations. Per-exchange because each answer cites its own sources (§106). */
  sources: ResearchSource[]
  /** The gate's question, when `kind === 'ask'`. Rendered in the flow, answered in the composer. */
  ask: GateAsk | null
  /** True while the request is in flight — this is the pending message at the foot of the list. */
  pending: boolean
}

const EXAMPLE_QUESTIONS = [
  "Ask anything about compliance, regulations or HR",
  "What permits do I need to operate my facility?",
  "How do I stay compliant with waste disposal rules?",
  "What safety training is required for my employees?",
  "How do I prepare for a regulatory inspection?",
  "What do I need for a quality certification?",
]

function CompliancePageInner() {
  const supabase = createClient()
  const [askQuestion, setAskQuestion] = useState('')
  const [createQuestion, setCreateQuestion] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null)
  const [data, setData] = useState<ChecklistData | null>(null)
  const [currentChecklistId, setCurrentChecklistId] = useState<string | null>(null)
  const [currentResearchId, setCurrentResearchId] = useState<string | null>(null)
  const [savedChecklists, setSavedChecklists] = useState<SavedChecklist[]>([])
  const [loading, setLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [chipIndex, setChipIndex] = useState(0)
  const [chipVisible, setChipVisible] = useState(true)
  const [askedQuestion, setAskedQuestion] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [tab, setTab] = useState<'ask' | 'create' | 'saved'>('ask')
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [expandedSteps, setExpandedSteps] = useState<Record<string, ChecklistItem[] | null | undefined>>({})
  const [stepsCache, setStepsCache] = useState<Record<string, ChecklistItem[]>>({})
  const [loadingSteps, setLoadingSteps] = useState<Record<string, boolean>>({})
  const queueRef = React.useRef<number[]>([])
  const processingRef = React.useRef(false)
  /** Every item index this page has begun generating steps for — the "never repeated" half. */
  const startedRef = React.useRef<Set<number>>(new Set())
  const dataRef = React.useRef<ChecklistData | null>(null)
  // `researchData` and `researchSources` are GONE. They were two of the five singulars the
  // page held, and `exchanges` carries both per answer now — the third answer's sources are the
  // third answer's, not whatever the last request happened to return.
  // THE SOURCES TRAVEL WITH THE ANSWER, EVERYWHERE IT GOES — live, saved and printed.
  // A "[3]" with no list behind it is worse than no marker: it looks like a citation and
  // cannot be followed. DECISIONS.md §106.
  /**
   * THE CONVERSATION, AS A PERSON SEES IT. Oldest first; the composer is below it.
   * Replaces the five singulars for the Ask tab. `data` (a checklist) is untouched — the Create
   * tab is sequenced after research and is not part of this change (`DECISIONS.md` §112).
   */
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  /** THE IN-FLIGHT ANSWER, so it can be stopped. Aborting this fetch aborts the route's
   *  request to the model — `app/api/chat/route.ts` passes `request.signal` into the SDK —
   *  so a stopped answer stops the billing and not just the rendering. R1 Task 5. */
  const inFlight = useRef<AbortController | null>(null)
  const stopAnswer = () => { inFlight.current?.abort(); inFlight.current = null }
  /** The foot of the list, so the newest exchange stays in view. */
  const bottomRef = useRef<HTMLDivElement>(null)
  // Which citation card is open. HOVER handles a laptop through CSS; this is the TAP path,
  // because a phone has no hover and a marker you cannot open is a marker you must scroll
  // away from to resolve. One at a time — a key of `${lineIndex}-${n}`.
  const [openCitation, setOpenCitation] = useState<string | null>(null)
  // This page had NO error state at all: a non-ok response set `data` to undefined and
  // showed a blank. Minimal addition — one string, cleared on each submit.
  const [errorMsg, setErrorMsg] = useState('')
  const [mode, setMode] = useState<'checklist' | 'research'>('checklist')
  // The determination gate stopped before producing anything and asked for one fact.
  // Held here rather than inside the answer, because an ask REPLACES the answer —
  // DECISIONS.md §34, docs/DETERMINATION-GATE.md §2.
  const [gateAsk, setGateAsk] = useState<GateAsk | null>(null)
  // *** THERE IS NO `critique` STATE. DECISIONS.md §97. ***
  // The critic's findings are quality control and never reach a customer; they are written to
  // critic_reviews / critic_findings server-side and are absent from the response body. A
  // variable kept only to be emptied is dead code, and NO STATE IS A STRONGER GUARD AGAINST
  // STALE OUTPUT THAN STATE KEPT EMPTY — there is nothing left for a later change to render.

  /**
   * THE CONVERSATION — M1.2c's turns, held where a person can reach them. GATE-HISTORY.md §10.
   *
   * *** IN REACT STATE AND NOWHERE ELSE. NOT localStorage. *** A turn list is the transcript in
   * claim form, and `WORKSPACE.md` §6.4 makes the transcript DISPOSABLE — §78 turns that into a
   * hard rule for the facts inside it, since a hypothetical "lives in the conversation and
   * nowhere else". Persisting it here would make the disposable thing durable by accident.
   *
   * THE COST, WHICH IS REAL AND WAS DECIDED RATHER THAN DISCOVERED: a reload loses the
   * conversation and starts a new topic. `DECISIONS.md` §96(e) — SEVERAL open topics per company,
   * and the option that resumes the old topic with an empty turn list was REFUSED, because a row
   * claiming to be the same conversation while the gate remembers none of it is a continuous
   * record with discontinuous content.
   *
   * The turns are OPAQUE to this component. Each is signed by the server and echoed back
   * untouched; editing one here would only make it fail to verify.
   */
  const [turns, setTurns] = useState<SealedTurn[]>([])
  const [topicId, setTopicId] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  // Determination helper state
  const [determinationAnswers, setDeterminationAnswers] = useState<Record<string, string[]>>({})
  const [determinationResults, setDeterminationResults] = useState<Record<string, string>>({})
  const [loadingDetermination, setLoadingDetermination] = useState<Record<string, boolean>>({})
  const [showDetermination, setShowDetermination] = useState<Record<string, boolean>>({})
  const [showStepsBanner, setShowStepsBanner] = useState(false)

  // Keep the newest exchange in view. Oldest-first with the composer at the foot means the
  // conversation grows downwards, and without this a long answer pushes the box off screen.
  useEffect(() => {
    if (exchanges.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [exchanges])

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)
      const { data: company } = await supabase
        .from('companies')
        .select('name, scan_result')
        .eq('id', profile.company_id)
        .single()
      if (company?.name) setCompanyName(company.name)
      if (company?.scan_result) setScanResult(company.scan_result)
    }
    loadProfile()
    loadSavedChecklists()
  }, [])

  useEffect(() => {
    const id = searchParams.get("id")
    if (id) loadChecklist(id)
  }, [searchParams])

  async function loadSavedChecklists() {
    // Company-scoped, not user-scoped: the compliance record belongs to the company,
    // so colleagues see the same checklists and research answers.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    if (!profile?.company_id) return
    const { data: checklists } = await supabase
      .from('checklists')
      .select('id, question, title, created_at, research_answer, research_sources, converted_to_checklist_id')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (!checklists) return

    const withCounts = await Promise.all(checklists.map(async (c) => {
      // Research answers have no checklist_items — skip the count queries entirely.
      if (c.research_answer) {
        return { ...c, must_do_count: 0, completed_count: 0 }
      }
      const { count: total } = await supabase
        .from('checklist_items')
        .select('*', { count: 'exact', head: true })
        .eq('checklist_id', c.id)
        .eq('category', 'must_do')
        .is('parent_item_index', null)
      const { count: completed } = await supabase
        .from('checklist_items')
        .select('*', { count: 'exact', head: true })
        .eq('checklist_id', c.id)
        .eq('category', 'must_do')
        .is('parent_item_index', null)
        .eq('completed', true)
      return { ...c, must_do_count: total || 0, completed_count: completed || 0 }
    }))
    setSavedChecklists(withCounts)
  }

  async function saveResearch(question: string, answer: string, sources: ResearchSource[]) {
    if (!userId || !companyId) return null
    const { data: research, error } = await supabase
      .from('checklists')
      .insert({
        company_id: companyId,
        user_id: userId,
        question,
        title: question.length > 80 ? question.slice(0, 80) + '…' : question,
        research_answer: answer,
        // Stored with the answer, not only returned live — migration 030.
        research_sources: sources.length > 0 ? sources : null,
      })
      .select()
      .single()
    if (error || !research) return null
    return research.id
  }

  function loadResearch(c: SavedChecklist) {
    // A SAVED ANSWER OPENS AS A ONE-EXCHANGE CONVERSATION, so the page has one shape whether
    // you asked just now or are re-reading something from last week.
    setExchanges([{
      id: `saved-${c.id}`, kind: 'answer', question: c.question,
      text: c.research_answer ?? '',
      sources: (c.research_sources as ResearchSource[] | null) ?? [],
      ask: null, pending: false,
    }])
    // *** A SAVED ANSWER IS NOT THE CONVERSATION IT CAME FROM. ***
    // Saved rows carry no `topic_id` — nothing in the database references `topics` at all — so
    // there is no conversation to resume. Carrying the live turns forward would append the next
    // question to whatever topic was open: a different conversation wearing this one's history.
    setTurns([])
    setTopicId('')
    setGateAsk(null)
    setAskedQuestion(c.question)
    // The composer stays EMPTY. It used to be refilled with the question you had just opened,
    // which is what made people type over it.
    setAskQuestion('')
    setMode('research')
    setData(null)
    setCurrentResearchId(c.id)
    setTab('ask')
  }

  async function saveChecklist(question: string, data: ChecklistData) {
    if (!userId || !companyId) return null
    const { data: checklist, error } = await supabase
      .from('checklists')
      .insert({
        company_id: companyId,
        user_id: userId,
        question,
        title: data.title,
        safety_alert: data.safety_alert || null,
      })
      .select()
      .single()
    if (error || !checklist) return null

    const items = [
      ...data.must_do.map((item, i) => ({
        checklist_id: checklist.id,
        company_id: companyId,
        category: 'must_do',
        name: item.name,
        description: item.description || '',
        why: item.why || null,
        source_url: item.source_url || null,
        cost_note: item.cost_note || null,
        providers: item.providers || [],
        sort_order: i,
        completed: false,
        parent_item_index: null,
      })),
      ...data.good_to_have.map((item, i) => ({
        checklist_id: checklist.id,
        company_id: companyId,
        category: 'good_to_have',
        name: item.name,
        description: item.description || '',
        why: item.why || null,
        source_url: item.source_url || null,
        sort_order: i,
        completed: false,
        parent_item_index: null,
      })),
    ]

    await supabase.from('checklist_items').insert(items)
    return checklist.id
  }

  async function saveSubItems(checklistId: string, parentIndex: number, subItems: ChecklistItem[]) {
    const res = await fetch('/api/substeps', {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        checklist_id: checklistId,
        parent_item_index: parentIndex,
        items: subItems,
      }),
    })
    const json = await res.json()
    return json.data || []
  }

  async function loadChecklist(checklistId: string) {
    const { data: checklist } = await supabase
      .from('checklists')
      .select('*')
      .eq('id', checklistId)
      .single()
    if (!checklist) return

    const { data: items } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('sort_order')
    if (!items) return

    const mustDo = items.filter(i => i.category === 'must_do' && i.parent_item_index === null)
    const goodToHave = items.filter(i => i.category === 'good_to_have' && i.parent_item_index === null)
    const subItems = items.filter(i => i.parent_item_index !== null)

    const checkState: Record<string, boolean> = {}
    mustDo.forEach((item, i) => { checkState[`must-${i}`] = item.completed })
    goodToHave.forEach((item, i) => { checkState[`nice-${i}`] = item.completed })
    subItems.forEach((item) => {
      checkState[`sub-${item.parent_item_index}-${item.sort_order}`] = item.completed
    })

    const restoredSteps: Record<string, ChecklistItem[] | null> = {}
    mustDo.forEach((_, i) => {
      const children = subItems.filter(s => Number(s.parent_item_index) === i)
      if (children.length > 0) {
        restoredSteps[`must-${i}`] = children.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          why: s.why,
          source_url: s.source_url,
          cost_note: s.cost_note,
          time_estimate: s.time_estimate,
          what_you_need: s.what_you_need,
          is_determination: s.is_determination,
          clarifying_questions: s.clarifying_questions || [],
          agency_name: s.agency_name,
          search_hint: s.search_hint,
          completed: s.completed,
        }))
      }
    })

    setData({
      title: checklist.title,
      safety_alert: checklist.safety_alert,
      must_do: mustDo.map(i => ({
        id: i.id,
        name: i.name,
        description: i.description,
        why: i.why,
        source_url: i.source_url,
        cost_note: i.cost_note,
        providers: i.providers,
      })),
      good_to_have: goodToHave.map(i => ({
        id: i.id,
        name: i.name,
        description: i.description,
        why: i.why,
        source_url: i.source_url,
      })),
    })
    setChecked(checkState)
    setExchanges([])
    setMode('checklist')
    const cacheOnly: Record<string, ChecklistItem[]> = {}
    Object.entries(restoredSteps).forEach(([k, v]) => { if (v) cacheOnly[k] = v })
    console.log('restoredSteps keys:', Object.keys(restoredSteps))
    console.log('subItems count:', subItems.length)
    console.log('cacheOnly keys:', Object.keys(cacheOnly))
    setStepsCache(cacheOnly)
    setExpandedSteps(cacheOnly)
    setAskedQuestion(checklist.question)
    setCreateQuestion(checklist.question)
    setCurrentChecklistId(checklistId)
    setTab('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleCheck(key: string, itemId?: string) {
    const newChecked = !checked[key]
    setChecked(prev => ({ ...prev, [key]: newChecked }))
    if (!itemId || !companyId) return
    // Same reasoning as deleteChecklist: `.eq('id')` alone was only ever safe because
    // RLS restricted this table to the caller's own rows.
    await supabase
      .from('checklist_items')
      .update({
        completed: newChecked,
        completed_at: newChecked ? new Date().toISOString() : null,
      })
      .eq('id', itemId)
      .eq('company_id', companyId)
  }

  async function handleGetSteps(itemIndex: number) {
    const key = `must-${itemIndex}`
    if (expandedSteps[key] && expandedSteps[key] !== null) {
      setExpandedSteps(prev => ({ ...prev, [key]: null }))
      return
    }
    if (stepsCache[key]) {
      setExpandedSteps(prev => ({ ...prev, [key]: stepsCache[key] }))
      return
    }
    // The background pool is normally already writing this item. Expanding it moves it to the
    // front of the queue so a person waiting on THIS item is served before the rest.
    prioritizeItem(itemIndex)
    startedRef.current.add(itemIndex)
    if (!processingRef.current && data) {
      void processQueue(queueRef.current, data, currentChecklistId)
    }
  }

  /**
   * MICRO-STEPS GENERATE IN THE BACKGROUND, AT MOST THREE AT A TIME.
   *
   * `DECISIONS.md` §123. They used to generate one at a time, only when a person expanded an
   * item, behind a banner — so the first click on every item waited for a model call.
   *
   * Now the list renders, and the steps are written behind it. The rules, and each one is a
   * property rather than a nicety:
   *
   *   NEVER REPEATED — `startedRef` holds every index this page has begun, and items whose
   *                    steps were restored from the database are never enqueued. A checklist
   *                    reopened ten times generates each item once, not ten times.
   *   NEVER LOST     — whatever is unfinished when the user leaves is enqueued again the next
   *                    time the checklist opens, because the enqueue is driven by what is
   *                    ABSENT from storage rather than by what happened in this session.
   *   AT MOST THREE  — three workers pulling from one queue. A checklist of twenty items would
   *                    otherwise open twenty concurrent model calls from one browser.
   *
   * An item with no steps yet shows "steps being written" (`loadingSteps[key]`), so the state
   * is visible rather than looking like an item that has none.
   */
  const MAX_IN_FLIGHT = 3

  async function processQueue(_queue: number[], checklistData: ChecklistData, checklistId: string | null) {
    if (processingRef.current) return
    processingRef.current = true

    const worker = async () => {
      for (;;) {
        const itemIndex = queueRef.current.shift()
        if (itemIndex === undefined) return
        const key = `must-${itemIndex}`
        if (stepsCache[key]) continue
        setLoadingSteps((prev) => ({ ...prev, [key]: true }))
        try {
          const item = checklistData.must_do[itemIndex]
          if (!item) continue

          const otherItems = checklistData.must_do
            .filter((_, idx) => idx !== itemIndex)
            .map((it) => '- ' + it.name)
            .join(', ')

          const prompt = `Main checklist item: "${item.name}"
Description: "${item.description}"
This is item ${itemIndex + 1} from a compliance checklist.
Other items already covered — do NOT overlap: ${otherItems}

Generate 3 to 6 specific micro-steps to complete this one item only.
Every step must include a direct deep link (not homepage), time estimate, cost, and what to prepare.`

          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: await authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ question: prompt, mode: 'substeps' }),
          })
          const json = await res.json()
          // MICRO-STEPS INHERIT THE PARENT'S SOURCES AND CARRY NONE OF THEIR OWN.
          // A step is a way of doing the item above it, not a separate claim, so a citation of
          // its own would be a second source for one obligation — and the two could disagree.
          const subItems: ChecklistItem[] = (json.data?.must_do || []).map((sub: ChecklistItem) => ({
            ...sub, source_url: item.source_url, source_title: item.source_title,
          }))

          setStepsCache((prev) => ({ ...prev, [key]: subItems }))

          if (checklistId && subItems.length > 0) {
            const saved = await saveSubItems(checklistId, itemIndex, subItems)
            if (saved && saved.length > 0) {
              const withIds = subItems.map((it: ChecklistItem, i: number) => ({ ...it, id: saved[i]?.id }))
              setStepsCache((prev) => ({ ...prev, [key]: withIds }))
            }
          }
        } catch (err) {
          // One item failing must not stop the other two workers or the rest of the queue.
          // It is left OUT of startedRef by the caller's finally below so the next open retries it.
          console.error(`micro-steps for item ${itemIndex} failed:`, err)
          startedRef.current.delete(itemIndex)
        } finally {
          setLoadingSteps((prev) => ({ ...prev, [key]: false }))
        }
      }
    }

    await Promise.all(Array.from({ length: MAX_IN_FLIGHT }, worker))
    processingRef.current = false
  }

  function prioritizeItem(itemIndex: number) {
    queueRef.current = [itemIndex, ...queueRef.current.filter(i => i !== itemIndex)]
  }

  /**
   * ENQUEUE WHAT IS MISSING, EVERY TIME THE CHECKLIST OPENS.
   *
   * The condition is ABSENCE FROM STORAGE, not "did this session generate it" — which is what
   * makes the two promises hold at once. An item whose steps were restored by `loadChecklist`
   * is already in `stepsCache` and is skipped forever (never repeated); an item that was still
   * being written when the user closed the tab is in neither `stepsCache` nor `startedRef` the
   * next time, so it is picked up (never lost).
   */
  useEffect(() => {
    if (!data?.must_do?.length) return
    const missing = data.must_do
      .map((_, i) => i)
      .filter((i) => !stepsCache[`must-${i}`] && !startedRef.current.has(i))
    if (!missing.length) return
    for (const i of missing) startedRef.current.add(i)
    queueRef.current = [...queueRef.current, ...missing]
    if (!processingRef.current) void processQueue(queueRef.current, data, currentChecklistId)
    // `stepsCache` is deliberately NOT a dependency: it changes on every completed item, and
    // re-running this on each one would re-enqueue while workers are mid-flight. The set of
    // items is decided when a checklist arrives, and `startedRef` carries the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentChecklistId])

  async function handleDeterminationSubmit(itemIndex: number, subIndex: number, sub: ChecklistItem) {
    const key = `det-${itemIndex}-${subIndex}`
    const answers = determinationAnswers[key] || []
    if (answers.some(a => !a.trim())) return

    setLoadingDetermination(prev => ({ ...prev, [key]: true }))

    try {
      const questions = sub.clarifying_questions || []
      const qaText = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || ''}`).join('\n')

      const prompt = `A business owner is completing this compliance step: "${sub.name}"
Context: ${sub.description}

They answered these clarifying questions:
${qaText}

Give them a specific direct answer — exactly what they need to do, which specific option applies to them, and the direct link to do it. Be concrete and decisive. 2-3 sentences maximum.`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ question: prompt, mode: 'research' }),
      })
      const json = await res.json()
      setDeterminationResults(prev => ({ ...prev, [key]: json.research || '' }))
    } catch (err) {
      console.error('Determination error:', err)
    } finally {
      setLoadingDetermination(prev => ({ ...prev, [key]: false }))
    }
  }

  async function deleteChecklist(checklistId: string) {
    if (!companyId) return
    // The company filter is not belt-and-braces here. Before the policies were widened
    // to company scope, RLS narrowed DELETE to the caller's own rows and `.eq('id')`
    // alone was safe. It is not any more: without this, deleting your own checklist and
    // deleting a colleague's are the same call.
    await supabase.from('checklists').delete().eq('id', checklistId).eq('company_id', companyId)
    setSavedChecklists(prev => prev.filter(c => c.id !== checklistId))
    if (currentChecklistId === checklistId) {
      setData(null)
      setCurrentChecklistId(null)
      setChecked({})
      setExpandedSteps({})
    }
  }

  function handlePrint() { window.print() }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadedFile(e.target.files?.[0] || null)
  }

  function removeFile() {
    setUploadedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setChipVisible(false)
      setTimeout(() => {
        setChipIndex(prev => (prev + 1) % EXAMPLE_QUESTIONS.length)
        setChipVisible(true)
      }, 400)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  /**
   * Answering a gate question, from the ask card.
   *
   * The ORIGINAL question is re-sent verbatim and `answering` rides alongside it. The gate
   * re-runs against question + new fact; there is no half-built answer to resume, because
   * the gate stopped before Stage 2. docs/DETERMINATION-GATE.md §5.2.
   */
  async function handleGateAnswer(answering: GateAnswering | null, file: File | null) {
    if (file) setUploadedFile(file)
    await handleSubmit(mode, askedQuestion, answering, file)
  }

  /**
   * SENDING FROM THE COMPOSER, when the gate has a question outstanding.
   *
   * The gate's ask is a message in the flow now, so the composer has two jobs: a new question,
   * or the answer to the one the gate asked. It cannot be both, and the outstanding ask decides
   * which — the person types in one box either way, which is the whole point of M1.2e.
   */
  async function sendFromComposer() {
    const typed = askQuestion.trim()
    if (!typed && !uploadedFile) return
    if (gateAsk) {
      setAskQuestion('')
      await handleGateAnswer(
        { switch_id: gateAsk.switch_id, fact: gateAsk.switch_id ?? gateAsk.question, value: typed },
        null,
      )
      return
    }
    await handleSubmit('research', typed)
  }

  async function handleSubmit(
    submitMode?: string,
    customQuestion?: string,
    answering?: GateAnswering | null,
    answerFile?: File | null,
  ) {
    const currentMode = (submitMode === 'research' || submitMode === 'checklist') ? submitMode : 'checklist'
    const q = customQuestion ?? (currentMode === 'checklist' ? createQuestion : askQuestion)
    if (!q.trim() && !uploadedFile && !answerFile) return
    setLoading(true)

    // *** THE CONVERSATION IS APPENDED TO, NOT ERASED. ***
    // This block used to open with setData(null) / setResearchData(null) / setGateAsk(null),
    // destroying the previous exchange BEFORE the request was even sent. That is why M1.2d's
    // turn machinery was invisible: the server had the conversation and the screen had one
    // answer. A pending exchange goes on the end now and is filled in when the response lands.
    //
    // ANSWERING THE GATE OPENS AN EXCHANGE TOO. The 'ask' already in the list STAYS — it is what
    // was said, and a conversation does not retract its own messages — and the reply appends
    // after it, the way a reply does.
    const pendingId = `x${Date.now()}`
    // WHAT THE PERSON TYPED ALWAYS APPEARS, including the answer to the gate's question.
    // `q` is the ORIGINAL question when answering — handleGateAnswer re-sends it verbatim — so
    // the typed value has to come from `answering.value`, or the reply they just gave shows up
    // nowhere and the conversation reads as if the gate answered itself.
    const spoken = answering ? answering.value : q
    if (currentMode === 'research') {
      setExchanges((prev) => [...prev, {
        id: pendingId, kind: 'answer', question: spoken, text: '', sources: [], ask: null, pending: true,
      }])
    }
    if (currentMode !== 'research') setData(null)
    setGateAsk(null)
    setMode(currentMode as 'checklist' | 'research')
    setChecked({})
    setCompletedSteps([])
    setExpandedSteps({})
    setExpandedDetails({})
    setDeterminationAnswers({})
    setDeterminationResults({})
    setShowDetermination({})
    setStepsCache({})
    setExpandedSteps({})
    setAskedQuestion(q)
    // THE COMPOSER CLEARS ON SEND. It never did — `grep setAskQuestion('')` returned nothing —
    // so the box kept the question you had just asked and you typed over it.
    if (currentMode === 'research' && !answering) setAskQuestion('')
    setCurrentChecklistId(null)
    const messages = getStatusMessages(q)
    const delays = [0, 700, 1400, 2100, 2800, 3500, 4200, 4900]
    messages.forEach((msg, i) => {
      setTimeout(() => {
        setCurrentStatus(msg)
        if (i > 0) setCompletedSteps(prev => [...prev, messages[i - 1]])
      }, delays[i])
    })
    setErrorMsg('')
    try {
      let res
      const controller = new AbortController()
      inFlight.current = controller
      const fileToSend = answerFile ?? uploadedFile
      if (fileToSend) {
        const formData = new FormData()
        formData.append('file', fileToSend)
        formData.append('question', q)
        formData.append('mode', currentMode)
        if (answering) formData.append('answering', JSON.stringify(answering))
        // THE FILE BRANCH TOO. This is the one that gets forgotten, and a conversation that
        // silently resets whenever somebody attaches a document is worse than no conversation.
        formData.append('turns', JSON.stringify(turns))
        formData.append('topicId', topicId)
        // /api/chat requires the session token since 11 Sep — it reads company_switches
        // for the determination gate, which is tenant data (TODO §0.8b).
        res = await fetch('/api/chat', { method: 'POST', body: formData, headers: await authHeaders(), signal: controller.signal })
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          // `turns` is sent even when empty: its PRESENCE is what tells the route this is a
          // conversation rather than a one-shot call, so a topic is opened. The two other
          // /api/chat callers on this page deliberately send neither field. GATE-HISTORY.md §10.2.
          // HISTORY, as plain question/answer pairs. The open baseline passes prior messages
          // to the model as conversation rather than as facts extracted from signed turns —
          // `DECISIONS.md` §123. `turns` is still sent so that turning RESEARCH_GATE back on
          // needs no client change; the route ignores it while the gate is off.
          body: JSON.stringify({ question: q, mode: currentMode, scanResult, answering: answering ?? null, turns, topicId,
                                 history: exchanges.filter((x) => x.kind === 'answer' && x.question && x.text)
                                                   .map((x) => ({ question: x.question, answer: x.text })) }),
          signal: controller.signal,
        })
      }
      // ------------------------------------------------------------------
      // THE STREAMED ANSWER — the open baseline's research path returns NDJSON, one event
      // per line, rather than a single JSON body. Text arrives as it is written.
      //
      // `reset` is the narration rule reaching the screen: the model may open by saying what
      // it is about to do and only then search. That opening is not the answer, so when the
      // first search starts the server says so and what has been shown is withdrawn.
      // `lib/ai.ts` `stripNarration` has the three recorded samples behind the rule.
      // ------------------------------------------------------------------
      if (res.ok && (res.headers.get('content-type') ?? '').includes('x-ndjson')) {
        const fill = (patch: Partial<Exchange>) => setExchanges((prev) => {
          const next = [...prev]
          const i = next.findIndex((x) => x.id === pendingId)
          if (i !== -1) next[i] = { ...next[i], ...patch }
          return next
        })
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let acc = ''
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            // A chunk can split a line in half; keep the remainder for the next read.
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.trim()) continue
              let ev: { type: string; [k: string]: unknown }
              try { ev = JSON.parse(line) } catch { continue }
              if (ev.type === 'text') { acc += String(ev.text ?? ''); fill({ text: acc, pending: false }) }
              else if (ev.type === 'reset') { acc = ''; fill({ text: '', pending: true }) }
              else if (ev.type === 'done') {
                acc = String(ev.research ?? acc)
                fill({ text: acc, sources: (ev.sources as ResearchSource[]) ?? [], pending: false })
              } else if (ev.type === 'error') {
                setErrorMsg(String(ev.message ?? 'That request could not be completed.'))
              }
            }
          }
        } catch (err) {
          // An abort is the user's own doing: keep what arrived, say nothing.
          if ((err as { name?: string })?.name !== 'AbortError') throw err
        } finally {
          reader.releaseLock?.()
          inFlight.current = null
        }
        if (!acc) setExchanges((prev) => prev.filter((x) => x.id !== pendingId))
        return
      }

      const json = await res.json()
      if (!res.ok) {
        // A conversation the server could not carry on with. CLEARING THE TURNS IS THE POINT:
        // the message says "start fresh", and without this the very next request would send the
        // same unusable turns and fail identically. GATE-HISTORY.md §10.4.
        if (json.conversation_reset) {
          setTurns([])
          setTopicId('')
        }
        // The pending exchange goes, or the list keeps a message that will never arrive.
        setExchanges((prev) => prev.filter((x) => x.id !== pendingId))
        setErrorMsg(json.error || 'That request could not be completed.')
        return
      }

      // *** APPEND THE TURN BEFORE BRANCHING ON THE OUTCOME. ***
      // GATE-HISTORY.md §8.4 rule 1: every exchange is a turn, INCLUDING an ask and including one
      // that asserts nothing. Putting this after the `ask` return below would drop exactly the
      // turns where the gate stopped to ask a question, and the turn numbers would then drift
      // from the conversation a person had.
      if (json.topicId) setTopicId(json.topicId as string)
      if (json.turn) setTurns(prev => [...prev, json.turn as SealedTurn])

      // An ask is a SUCCESSFUL outcome, not an error — it arrives as 200 and renders in the
      // flow as its own message, answered from the main composer rather than from a box of its
      // own. TODO M1.2e.
      if (json.outcome === 'ask' && json.ask) {
        setGateAsk(json.ask as GateAsk)
        if (currentMode === 'research') {
          setExchanges((prev) => {
            const next = [...prev]
            const i = next.findIndex((x) => x.id === pendingId)
            const asked: Exchange = { id: pendingId, kind: 'ask', question: spoken, text: '',
                                      sources: [], ask: json.ask as GateAsk, pending: false }
            if (i === -1) next.push({ ...asked, id: `x${Date.now()}` })
            else next[i] = asked
            return next
          })
        }
        return
      }
      if (currentMode === 'research') {
        const answerText = json.research || json.data?.title || 'No results'
        const answerSources = (json.sources as ResearchSource[] | undefined) ?? []
        // Fill the pending exchange, or — when this was the gate's question being answered —
        // append the answer after the 'ask' that is already in the list.
        setExchanges((prev) => {
          const next = [...prev]
          const i = next.findIndex((x) => x.id === pendingId)
          const filled: Exchange = { id: pendingId, kind: 'answer', question: spoken, text: answerText,
                                     sources: answerSources, ask: null, pending: false }
          if (i === -1) next.push({ ...filled, id: `x${Date.now()}` })
          else next[i] = filled
          return next
        })
        setCurrentResearchId(null)
        if (userId && answerText !== 'No results') {
          const researchId = await saveResearch(q, answerText, answerSources)
          setCurrentResearchId(researchId)
          await loadSavedChecklists()
        }
      } else {
        setData(json.data)
      }

      if (json.data && userId && currentMode === 'checklist') {
        const checklistId = await saveChecklist(q, json.data)
        if (checklistId) {
          setCurrentChecklistId(checklistId)
          if (currentResearchId) {
            try {
              await fetch('/api/link-research', {
                method: 'POST',
                headers: await authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ researchId: currentResearchId, checklistId }),
              })
            } catch (linkErr) {
              console.error('Failed to link research to checklist:', linkErr)
            }
            setCurrentResearchId(null)
          }
          const { data: savedItems } = await supabase
            .from('checklist_items')
            .select('id')
            .eq('checklist_id', checklistId)
            .eq('category', 'must_do')
            .is('parent_item_index', null)
            .order('sort_order')
          if (savedItems) {
            const updatedMustDo = json.data.must_do.map((item: ChecklistItem, i: number) => ({
              ...item, id: savedItems[i]?.id,
            }))
            const { data: savedGoodItems } = await supabase
              .from('checklist_items')
              .select('id')
              .eq('checklist_id', checklistId)
              .eq('category', 'good_to_have')
              .is('parent_item_index', null)
              .order('sort_order')
            const updatedGoodToHave = json.data.good_to_have.map((item: ChecklistItem, i: number) => ({
              ...item, id: savedGoodItems?.[i]?.id,
            }))
            setData({ ...json.data, must_do: updatedMustDo, good_to_have: updatedGoodToHave })
          }
          await loadSavedChecklists()

          if (json.data?.must_do?.length > 0) {
            const allIndices = json.data.must_do.map((_: ChecklistItem, i: number) => i)
            queueRef.current = [...allIndices]
            dataRef.current = json.data
            setTimeout(() => processQueue(allIndices, json.data, checklistId), 500)
          }
        }
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setCurrentStatus('')
      setCompletedSteps([])
    }
  }

  const mustDoneCount = Object.entries(checked).filter(([k, v]) => {
    const parts = k.split('-')
    return parts[0] === 'must' && parts.length === 2 && v
  }).length
  const totalMust = data?.must_do?.length || 0

  return (
    <AppLayout title="Compliance Workspace" didYouKnow={{ icon: '📋', text: 'CompliBoard generates detailed micro-steps for every compliance item — including time estimates, costs, and exactly what you need to prepare. For steps that require a decision, CompliBoard asks you two quick questions and tells you exactly what applies to your situation. Ask any compliance question in plain English and get a complete guided path from question to done.' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .print-header {
            display: flex !important;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #166534;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .sub-checklist { display: block !important; }
          /* ON PAPER A LINK'S HREF IS INVISIBLE. A printed source you cannot follow is a
             source in name only, so the URL is printed after the title. DECISIONS.md §106. */
          .source-link::after {
            content: " — " attr(href);
            font-size: 10px;
            color: #444;
            word-break: break-all;
          }
        }
        .print-only { display: none; }
      `}</style>

      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="print-only print-header">
          <div>
            <h1 style={{fontSize:'20px', fontWeight:'bold', color:'#166534'}}>CompliBoard</h1>
            <p style={{fontSize:'12px', color:'#6b7280'}}>Compliance Report</p>
            {companyName && <p style={{fontSize:'13px', fontWeight:'600', color:'#111827', marginTop:'4px'}}>{companyName}</p>}
          </div>
          <div style={{textAlign:'right', fontSize:'11px', color:'#6b7280'}}>
            <p>Generated: {new Date().toLocaleDateString()}</p>
            <p style={{marginTop:'4px', fontStyle:'italic', maxWidth:'300px'}}>{askedQuestion}</p>
          </div>
        </div>

        <div className="no-print mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Compliance Workspace</h1>
          <p className="text-sm text-gray-400">Research regulations and turn them into action steps</p>
        </div>

        <div className="no-print flex items-center gap-6 mb-5 border-b border-gray-200">
          <button onClick={() => setTab('ask')}
            className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${tab === 'ask' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Ask a question
          </button>
          <button onClick={() => setTab('create')}
            className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${tab === 'create' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Create action items
          </button>
          <button onClick={() => setTab('saved')}
            className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${tab === 'saved' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Saved{savedChecklists.length > 0 ? ` (${savedChecklists.length})` : ''}
          </button>
        </div>

        {tab === 'ask' && (
        <div>

        {/* ============================================================================
            THE CONVERSATION. Oldest first, composer below it. TODO M1.2e.

            Until 21 Sep this tab rendered ONE answer: `handleSubmit` erased the previous one
            before sending the next request, so M1.2d's turn machinery — turns held, signed and
            sent — was invisible to the person using it. The server had the conversation; the
            screen had the last reply.
            ============================================================================ */}
        <div className="space-y-6">
          {exchanges.map((x, xi) => (
            <div key={x.id}>
              {/* WHAT THE PERSON ASKED, above their answer. A proposal or a notice has no
                  question — see the `kind` comment on Exchange. */}
              {x.question && (
                <div className="flex justify-end mb-2">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-green-700 px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
                    {x.question}
                  </p>
                </div>
              )}

              {x.pending && (
                <div className="no-print rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="space-y-2">
                    {completedSteps.map((step) => (
                      <div key={step} className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-green-500">✓</span>{step}
                      </div>
                    ))}
                    {currentStatus && (
                      <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                        <span className="animate-spin inline-block">⟳</span>{currentStatus}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* THE GATE'S QUESTION, IN THE FLOW. It is not an error and not a modal — it is a
                  message, and it is answered from the composer at the bottom like anything else.
                  GateAskCard no longer carries an input of its own. */}
              {x.kind === 'ask' && x.ask && !x.pending && (
                <GateAskCard ask={x.ask} />
              )}

              {x.kind === 'answer' && !x.pending && x.text && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <div className="text-sm text-gray-700 leading-relaxed space-y-4">
                    {displayLines(x.text).map((line, i) => {
                      const inline = (text: string) => inlineParts(text).map((part, k) => {
                        if (part.kind === 'text') {
                          return <span key={k} dangerouslySetInnerHTML={{ __html:
                            part.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        }
                        // EACH ANSWER'S OWN SOURCES. Per-exchange, so the third answer's [2]
                        // opens the third answer's second source (DECISIONS.md §106, §107).
                        const src = x.sources.find((y) => y.n === part.n)
                        if (!src) return <span key={k}>{part.text}</span>
                        const key = `${x.id}-${i}-${part.n}`
                        const open = openCitation === key
                        return (
                          <span key={k} className="group relative inline-block align-baseline">
                            <button type="button" onClick={() => setOpenCitation(open ? null : key)}
                              aria-label={`Source ${part.n}: ${src.title}`}
                              className="align-super text-[10px] font-medium text-green-700 hover:text-green-900 cursor-pointer px-px">
                              [{part.n}]
                            </button>
                            <span className={`no-print absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg ${open ? 'block' : 'hidden'} group-hover:block`}>
                              <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Source {part.n}</span>
                              <span className="mt-1 block text-xs font-medium text-gray-800">{src.title}</span>
                              <a href={src.url} target="_blank" rel="noopener noreferrer"
                                 onClick={(e) => e.stopPropagation()}
                                 className="mt-2 inline-block text-xs text-green-700 hover:underline break-all">
                                Open source ↗
                              </a>
                            </span>
                          </span>
                        )
                      })
                      if (line.startsWith('## ') || line.startsWith('# ')) return (
                        <p key={i} className="text-xs font-bold uppercase tracking-widest text-green-700 mt-6 mb-1">{line.replace(/^#+ /, '')}</p>
                      )
                      if (line.startsWith('• ') || line.startsWith('- ')) return (
                        <p key={i} className="flex gap-2 text-gray-600"><span className="text-green-500 flex-shrink-0">•</span><span>{inline(line.replace(/^[•\-] /, ''))}</span></p>
                      )
                      if (line.trim() === '') return <div key={i} className="h-1" />
                      return <p key={i} className="text-gray-700">{inline(line)}</p>
                    })}
                  </div>

                  {/* SOURCES. Not `no-print`: on paper the list is the only way a citation
                      survives, because the hover card cannot print (§106, §107). */}
                  {x.sources.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Sources</p>
                      <ol className="space-y-1">
                        {x.sources.map((src) => (
                          <li key={src.n} className="text-xs text-gray-600 flex gap-2">
                            <span className="text-gray-400 flex-shrink-0">[{src.n}]</span>
                            <a href={src.url} target="_blank" rel="noopener noreferrer"
                               className="source-link text-green-700 hover:underline break-words">{src.title}</a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Only under the NEWEST answer: a checklist is built from one answer, and
                      offering it under every past reply would ask which one it meant. */}
                  {xi === exchanges.length - 1 && (
                    <div className="no-print mt-4 flex items-center gap-3">
                      <button
                        onClick={() => { setCreateQuestion(x.question ?? ''); setTab('create'); handleSubmit('checklist', x.question ?? '') }}
                        className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-green-600 bg-green-700 text-white hover:bg-green-800 transition-colors">
                        Create my action checklist →
                      </button>
                      <p className="text-xs text-gray-400">Get actionable steps based on this research</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* THE COMPOSER, BELOW THE CONVERSATION. It was above it, and the person typed over
            their last question every time. */}
        <div className="mt-6">
        <div className="no-print mb-3 relative">
          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white"
            rows={4}
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
          />
          {!askQuestion && (
            <div className="absolute inset-0 p-4 pointer-events-none flex flex-col gap-3">
              <p className="text-sm text-gray-400">e.g. I run a 50-person chemical warehouse in Oregon storing HF acid</p>
              <p className="text-sm text-gray-400">e.g. I run a hospice agency in Washington with 12 caregivers</p>
              <p className="text-sm text-gray-400">e.g. I&apos;m opening a second restaurant location in Portland</p>
            </div>
          )}
        </div>

        <div className="no-print mb-4">
          <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange} className="hidden" id="file-upload" />
          {!uploadedFile ? (
            <label htmlFor="file-upload"
              className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-500 hover:text-green-700 transition-colors">
              <span>📎</span>
              <span>Attach a file — upload a permit, SDS sheet, or any document and ask a question about it</span>
            </label>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-green-600">📄</span>
              <span className="text-sm text-green-700 truncate">{uploadedFile.name}</span>
              <button onClick={removeFile} className="text-gray-400 hover:text-red-500 text-sm ml-1">× remove</button>
            </div>
          )}
        </div>

        <div className="no-print flex items-center gap-3">
          <button
            onClick={sendFromComposer}
            disabled={loading}
            className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
            {loading ? 'Working...' : uploadedFile ? 'Ask about this file →' : 'Research this topic →'}
          </button>
        </div>

        {errorMsg && (
          <div className="no-print mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{errorMsg}</p>
          </div>
        )}

        {/* The determination gate asked for one fact and produced nothing else. This sits
            where the answer would have been — not above one, because an ask REPLACES the
            answer (docs/DETERMINATION-GATE.md §2, §5). */}
        </div>

        </div>
        )}

        {tab === 'create' && (
        <div>

        <div className="no-print mb-3 relative">
          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white"
            rows={4}
            value={createQuestion}
            onChange={(e) => setCreateQuestion(e.target.value)}
          />
          {!createQuestion && (
            <div className="absolute inset-0 p-4 pointer-events-none flex flex-col gap-3">
              <p className="text-sm text-gray-400">e.g. I run a 50-person chemical warehouse in Oregon storing HF acid</p>
              <p className="text-sm text-gray-400">e.g. I run a hospice agency in Washington with 12 caregivers</p>
              <p className="text-sm text-gray-400">e.g. I&apos;m opening a second restaurant location in Portland</p>
            </div>
          )}
        </div>

        <div className="no-print flex items-center gap-3">
          <button
            onClick={() => handleSubmit('checklist', createQuestion)}
            disabled={loading}
            className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
            {loading ? 'Working...' : 'Get my compliance checklist →'}
          </button>
        </div>

        {errorMsg && (
          <div className="no-print mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{errorMsg}</p>
          </div>
        )}

        {/* The determination gate asked for one fact and produced nothing else. This sits
            where the answer would have been — not above one, because an ask REPLACES the
            answer (docs/DETERMINATION-GATE.md §2, §5). */}
        {gateAsk && !loading && (
          <div className="no-print mb-4">
            <GateAskCard ask={gateAsk} onAnswer={handleGateAnswer} busy={loading} />
          </div>
        )}

        {/* *** THE CRITIC'S FINDINGS DO NOT RENDER HERE. DECISIONS.md §97. ***
            All four boxes are a RED-LINED DRAFT, and a customer receives the corrected document,
            not the corrections. Showing them made a correct, caught answer read as a wrong one:
            the critic withheld the 1200-A, and the customer saw it anyway, headlined as a
            removal. `CRITIC-PASS.md` §2.3's "surface, don't fix" is UNCHANGED in its reasoning —
            the evidence is kept, the audience changes. The page disclaimer carries what the
            unverified-figures box carried. */}

        {loading && (
          <div className="no-print mt-6 p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="space-y-2">
              {completedSteps.map((step) => (
                <div key={step} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-green-500">✓</span>{step}
                </div>
              ))}
              {currentStatus && (
                <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                  <span className="animate-spin inline-block">⟳</span>{currentStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {data && !loading && (
          <div className="mt-10 pt-8 border-t border-gray-100">
            {data.safety_alert && (
              <div className="mb-6 p-4 bg-amber-50 border-l-4 border-l-amber-500 border border-amber-100 rounded-xl flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">!</span>
                <div>
                  <p className="text-sm font-semibold text-amber-700 mb-1">Safety note</p>
                  <p className="text-sm text-amber-700">{data.safety_alert}</p>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-base font-semibold text-gray-900">{data.title}</h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {currentChecklistId && <span className="text-xs text-green-600">✓ Saved</span>}
                <button onClick={handlePrint}
                  className="no-print flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors whitespace-nowrap">
                  ⬇ Download PDF
                </button>
              </div>
            </div>

            {totalMust > 0 && (
              <div className="no-print mb-6 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(mustDoneCount / totalMust) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-400">{mustDoneCount} of {totalMust} done</span>
              </div>
            )}

            {showStepsBanner && (
              <div className="no-print mb-5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
                <span className="animate-spin inline-block text-blue-400 flex-shrink-0">⟳</span>
                <p className="text-xs text-blue-700">Your checklist is ready. We are building detailed micro-steps for each item — each takes about 25 seconds. Review your main steps while we work.</p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-green-700">✅ Must Do</span>
                <div className="flex-1 h-px bg-green-100"></div>
              </div>
              <div className="space-y-5">
                {data.must_do?.map((item, i) => {
                  const key = `must-${i}`
                  const isChecked = checked[key]
                  const isDetailOpen = expandedDetails[key]
                  const subItems = expandedSteps[key]
                  const isLoadingSteps = loadingSteps[key]

                  return (
                    <div key={i} className={`rounded-xl border transition-all ${isChecked ? 'opacity-60 bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
                      <div className="flex items-start gap-3 p-5">
                        <button
                          onClick={() => toggleCheck(key, item.id)}
                          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                          {isChecked && <span className="text-white text-xs">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              <span className="text-gray-400 font-normal mr-1">{i + 1}.</span>
                              {item.name}
                            </p>
                            {subItems ? (
                              <button
                                onClick={() => handleGetSteps(i)}
                                className="no-print flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300 transition-colors whitespace-nowrap">
                                ↑ Hide steps
                              </button>
                            ) : isLoadingSteps ? (
                              <span className="no-print flex-shrink-0 text-xs text-gray-400 flex items-center gap-1">
                                <span className="animate-spin inline-block">⟳</span> Generating micro-steps...
                              </span>
                            ) : stepsCache[key] ? (
                              <button
                                onClick={() => handleGetSteps(i)}
                                className="no-print flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors whitespace-nowrap">
                                ↓ Show steps
                              </button>
                            ) : queueRef.current.includes(i) || processingRef.current ? (
                              <span className="no-print flex-shrink-0 text-xs text-gray-300 flex items-center gap-1">
                                ⏳ Steps loading...
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{item.description}
                            {item.source_url && (
                              <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="no-print text-xs text-green-600 hover:text-green-800 underline ml-1.5">
                                ↗ Source
                              </a>
                            )}
                          </p>

                          <button
                            onClick={() => setExpandedDetails(prev => ({ ...prev, [key]: !prev[key] }))}
                            className="no-print mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                            {isDetailOpen ? '▲ Less detail' : '▼ More detail'}
                          </button>

                          {isDetailOpen && (
                            <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
                              {item.why && (
                                <p className="text-sm text-gray-600">{item.why}</p>
                              )}
                              {item.cost_note && (
                                <p className="text-xs text-amber-600 font-medium">💰 {item.cost_note}</p>
                              )}
                              {item.providers && item.providers.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Who to call:</p>
                                  <div className="space-y-1">
                                    {item.providers.map((p, j) => (
                                      <div key={j} className="flex items-center gap-2">
                                        <span className="text-xs">{p.coverage === 'local' ? '📍' : p.coverage === 'regional' ? '🗺️' : '🇺🇸'}</span>
                                        <span className="text-xs font-medium text-gray-700">{p.name}</span>
                                        <span className="text-xs text-gray-400">— {p.note}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {(subItems || isLoadingSteps) && (
                        <div className="sub-checklist border-t border-gray-100 bg-gray-50 rounded-b-xl px-4 py-4 ml-8 border-l-2 border-l-green-200">
                          {isLoadingSteps ? (
                            <p className="text-xs text-gray-400 animate-pulse">⟳ Generating micro-steps to complete this item...</p>
                          ) : subItems && subItems.length > 0 && (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Steps to complete this</p>
                              {subItems.map((sub, j) => {
                                const subKey = `sub-${i}-${j}`
                                const subChecked = checked[subKey]
                                const detKey = `det-${i}-${j}`
                                const isDetOpen = showDetermination[detKey]
                                const detResult = determinationResults[detKey]
                                const isDetLoading = loadingDetermination[detKey]

                                return (
                                  <div key={j} className={`py-2 transition-all ${subChecked ? 'opacity-50' : ''}`}>
                                    <div className="flex items-start gap-2.5">
                                      <button
                                        onClick={() => toggleCheck(subKey, sub.id)}
                                        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${subChecked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                                        {subChecked && <span className="text-white text-[9px]">✓</span>}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-800">
                                          <span className="text-green-600 font-semibold mr-1">{i + 1}.{j + 1}</span>
                                          {sub.name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>

                                        {/* Rich fields */}
                                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                                          {sub.time_estimate && (
                                            <span className="text-xs text-gray-400">⏱ {sub.time_estimate}</span>
                                          )}
                                          {sub.cost_note && (
                                            <span className="text-xs text-amber-600">💰 {sub.cost_note}</span>
                                          )}
                                          {sub.what_you_need && (
                                            <span className="text-xs text-gray-400">📋 {sub.what_you_need}</span>
                                          )}
                                        </div>

                                        {sub.agency_name && (
                                          <p className="text-xs text-gray-500 mt-1">🏛 {sub.agency_name}</p>
                                        )}
                                        {sub.search_hint && (
                                          
<a
                                            href={"https://www.google.com/search?q=" + encodeURIComponent(sub.search_hint)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-green-600 hover:text-green-800 underline mt-0.5 inline-block">
                                            Find this
                                          </a>
                                        )}

                                        {/* Determination helper */}
                                        {sub.is_determination && !detResult && (
                                          <div className="mt-2">
                                            <button
                                              onClick={() => setShowDetermination(prev => ({ ...prev, [detKey]: !prev[detKey] }))}
                                              className="text-xs text-green-700 hover:text-green-800 font-medium">
                                              Help me figure this out →
                                            </button>

                                            {isDetOpen && (
                                              <div className="mt-2 p-3 bg-white rounded-lg border border-green-100 space-y-2">
                                                {(sub.clarifying_questions || []).map((q, qi) => (
                                                  <div key={qi}>
                                                    <p className="text-xs text-gray-600 mb-1">{q}</p>
                                                    <input
                                                      type="text"
                                                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-500"
                                                      placeholder="Your answer..."
                                                      value={determinationAnswers[detKey]?.[qi] || ''}
                                                      onChange={(e) => {
                                                        const newAnswers = [...(determinationAnswers[detKey] || [])]
                                                        newAnswers[qi] = e.target.value
                                                        setDeterminationAnswers(prev => ({ ...prev, [detKey]: newAnswers }))
                                                      }}
                                                    />
                                                  </div>
                                                ))}
                                                <button
                                                  onClick={() => handleDeterminationSubmit(i, j, sub)}
                                                  disabled={isDetLoading}
                                                  className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50">
                                                  {isDetLoading ? '⟳ Working...' : 'Get my answer →'}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Determination result */}
                                        {detResult && (
                                          <div className="mt-2 bg-green-50 border border-green-100 border-l-4 border-l-green-500 rounded-xl p-4 overflow-hidden">
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <span className="w-4 h-4 rounded-full bg-green-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">✓</span>
                                              <p className="text-xs font-semibold text-green-700">CompliBoard Answer</p>
                                            </div>
                                            {detResult.split('\n').map((line: string, li: number) => {
                                              if (!line.trim()) return null
                                              const html = line
                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-green-700 underline break-all">$1</a>')
                                                .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-green-700 underline break-all">$1</a>')
                                              return <p key={li} className="text-xs text-gray-700 leading-relaxed mb-1 break-words" dangerouslySetInnerHTML={{__html: html}} />
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {data.good_to_have?.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-600">💡 Good to Have</span>
                  <div className="flex-1 h-px bg-blue-100"></div>
                </div>
                <div className="space-y-5">
                  {data.good_to_have?.map((item, i) => {
                    const key = `nice-${i}`
                    const isChecked = checked[key]
                    const isDetailOpen = expandedDetails[key]
                    return (
                      <div key={i} className={`rounded-xl border transition-all ${isChecked ? 'opacity-60 bg-gray-50 border-gray-100' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-start gap-3 p-5">
                          <button
                            onClick={() => toggleCheck(key, item.id)}
                            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}>
                            {isChecked && <span className="text-white text-xs">✓</span>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              <span className="text-gray-400 font-normal mr-1">{i + 1}.</span>
                              {item.name}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{item.description}
                              {item.source_url && (
                                <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                                  className="no-print text-xs text-green-600 hover:text-green-800 underline ml-1.5">
                                  ↗ Source
                                </a>
                              )}
                            </p>
                            {(item.why || item.cost_note) && (
                              <button
                                onClick={() => setExpandedDetails(prev => ({ ...prev, [key]: !prev[key] }))}
                                className="no-print mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                {isDetailOpen ? '▲ Less detail' : '▼ More detail'}
                              </button>
                            )}
                            {isDetailOpen && (
                              <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
                                {item.why && <p className="text-sm text-gray-600">{item.why}</p>}
                                {item.cost_note && <p className="text-xs text-amber-600 font-medium">💰 {item.cost_note}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <AIDisclaimer variant="full" className="mt-6" />

          </div>
        )}

        </div>
        )}

        {tab === 'saved' && (
        <div>
          {savedChecklists.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-4xl mb-4">📋</p>
              <p className="text-base font-medium text-gray-700 mb-1">Nothing saved yet</p>
              <p className="text-sm text-gray-400">Research answers and checklists you create will appear here.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-50">
                {savedChecklists.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => c.research_answer ? loadResearch(c) : loadChecklist(c.id)}>
                      <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</p>
                        {c.research_answer ? (
                          <p className="text-xs text-blue-500">
                            Answered{c.converted_to_checklist_id ? ' · → Checklist created' : ''}
                          </p>
                        ) : c.must_do_count > 0 ? (
                          <p className="text-xs text-green-600">{c.completed_count}/{c.must_do_count} done</p>
                        ) : null}
                      </div>
                    </div>
                    <button onClick={() => deleteChecklist(c.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}

      </div>
    </AppLayout>
  )
}

export default function CompliancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-sm text-gray-400">Loading...</p></div>}>
      <CompliancePageInner />
    </Suspense>
  )
}

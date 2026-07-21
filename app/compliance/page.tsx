'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'

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
  converted_to_checklist_id: string | null
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
  const [question, setQuestion] = useState('')
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
  const [showSaved, setShowSaved] = useState(false)
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [expandedSteps, setExpandedSteps] = useState<Record<string, ChecklistItem[] | null | undefined>>({})
  const [stepsCache, setStepsCache] = useState<Record<string, ChecklistItem[]>>({})
  const [loadingSteps, setLoadingSteps] = useState<Record<string, boolean>>({})
  const queueRef = React.useRef<number[]>([])
  const processingRef = React.useRef(false)
  const dataRef = React.useRef<ChecklistData | null>(null)
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [researchData, setResearchData] = useState<string | null>(null)
  const [mode, setMode] = useState<'checklist' | 'research'>('checklist')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  // Determination helper state
  const [determinationAnswers, setDeterminationAnswers] = useState<Record<string, string[]>>({})
  const [determinationResults, setDeterminationResults] = useState<Record<string, string>>({})
  const [loadingDetermination, setLoadingDetermination] = useState<Record<string, boolean>>({})
  const [showDetermination, setShowDetermination] = useState<Record<string, boolean>>({})
  const [showStepsBanner, setShowStepsBanner] = useState(false)

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: checklists } = await supabase
      .from('checklists')
      .select('id, question, title, created_at, research_answer, converted_to_checklist_id')
      .eq('user_id', user.id)
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

  async function saveResearch(question: string, answer: string) {
    if (!userId || !companyId) return null
    const { data: research, error } = await supabase
      .from('checklists')
      .insert({
        company_id: companyId,
        user_id: userId,
        question,
        title: question.length > 80 ? question.slice(0, 80) + '…' : question,
        research_answer: answer,
      })
      .select()
      .single()
    if (error || !research) return null
    return research.id
  }

  function loadResearch(c: SavedChecklist) {
    setResearchData(c.research_answer)
    setAskedQuestion(c.question)
    setQuestion(c.question)
    setMode('research')
    setData(null)
    setCurrentResearchId(c.id)
    setShowSaved(false)
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
      headers: { 'Content-Type': 'application/json' },
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
    setResearchData(null)
    setMode('checklist')
    const cacheOnly: Record<string, ChecklistItem[]> = {}
    Object.entries(restoredSteps).forEach(([k, v]) => { if (v) cacheOnly[k] = v })
    console.log('restoredSteps keys:', Object.keys(restoredSteps))
    console.log('subItems count:', subItems.length)
    console.log('cacheOnly keys:', Object.keys(cacheOnly))
    setStepsCache(cacheOnly)
    setExpandedSteps(cacheOnly)
    setAskedQuestion(checklist.question)
    setQuestion(checklist.question)
    setCurrentChecklistId(checklistId)
    setShowSaved(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleCheck(key: string, itemId?: string) {
    const newChecked = !checked[key]
    setChecked(prev => ({ ...prev, [key]: newChecked }))
    if (!itemId) return
    await supabase
      .from('checklist_items')
      .update({
        completed: newChecked,
        completed_at: newChecked ? new Date().toISOString() : null,
      })
      .eq('id', itemId)
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
    prioritizeItem(itemIndex)
    if (!processingRef.current && data) {
      processQueue(queueRef.current, data, currentChecklistId)
    }
  }

  async function processQueue(queue: number[], checklistData: ChecklistData, checklistId: string | null) {
    if (processingRef.current) return
    processingRef.current = true
    setShowStepsBanner(true)

    while (queueRef.current.length > 0) {
      const itemIndex = queueRef.current.shift()!
      const key = `must-${itemIndex}`

      const cached = stepsCache[key]
      if (cached) {
        setExpandedSteps(prev => ({ ...prev, [key]: cached }))
        continue
      }

      setLoadingSteps(prev => ({ ...prev, [key]: true }))

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
Every step must include a direct deep link (not homepage), time estimate, cost, and what to prepare.
Flag any step that requires the user to determine or choose something as is_determination true with 1-2 clarifying questions.`

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: prompt, mode: 'substeps' }),
        })
        const json = await res.json()
        const subItems: ChecklistItem[] = json.data?.must_do || []

        setStepsCache(prev => ({ ...prev, [key]: subItems }))

        if (checklistId && subItems.length > 0) {
          const saved = await saveSubItems(checklistId, itemIndex, subItems)
          if (saved && saved.length > 0) {
            const withIds = subItems.map((it: ChecklistItem, i: number) => ({ ...it, id: saved[i]?.id }))
            setStepsCache(prev => ({ ...prev, [key]: withIds }))
          }
        }
      } catch (err) {
        console.error('Queue error:', err)
      } finally {
        setLoadingSteps(prev => ({ ...prev, [key]: false }))
      }
    }
    processingRef.current = false
    setShowStepsBanner(false)
  }

  function prioritizeItem(itemIndex: number) {
    queueRef.current = [itemIndex, ...queueRef.current.filter(i => i !== itemIndex)]
  }

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
        headers: { 'Content-Type': 'application/json' },
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
    await supabase.from('checklists').delete().eq('id', checklistId)
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

  async function handleSubmit(submitMode?: string, customQuestion?: string) {
    const q = customQuestion || question
    const currentMode = (submitMode === 'research' || submitMode === 'checklist') ? submitMode : 'checklist'
    if (!q.trim() && !uploadedFile) return
    setLoading(true)
    setData(null)
    setResearchData(null)
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
    setCurrentChecklistId(null)
    const messages = getStatusMessages(q)
    const delays = [0, 700, 1400, 2100, 2800, 3500, 4200, 4900]
    messages.forEach((msg, i) => {
      setTimeout(() => {
        setCurrentStatus(msg)
        if (i > 0) setCompletedSteps(prev => [...prev, messages[i - 1]])
      }, delays[i])
    })
    try {
      let res
      if (uploadedFile) {
        const formData = new FormData()
        formData.append('file', uploadedFile)
        formData.append('question', q)
        formData.append('mode', currentMode)
        res = await fetch('/api/chat', { method: 'POST', body: formData })
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, mode: currentMode, scanResult }),
        })
      }
      const json = await res.json()
      if (currentMode === 'research') {
        const answerText = json.research || json.data?.title || 'No results'
        setResearchData(answerText)
        setCurrentResearchId(null)
        if (userId && answerText !== 'No results') {
          const researchId = await saveResearch(q, answerText)
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
                headers: { 'Content-Type': 'application/json' },
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

  async function handleFollowUp() {
    if (!followUpQuestion.trim()) return
    setFollowUpQuestion('')
    await handleSubmit(followUpQuestion)
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
        }
        .print-only { display: none; }
      `}</style>

      <div className="max-w-3xl mx-auto px-6 py-8">

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

        <div className="no-print mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Compliance Workspace</h1>
            <p className="text-sm text-gray-400">Ask any compliance question in plain English</p>
          </div>
          {savedChecklists.length > 0 && (
            <button onClick={() => setShowSaved(!showSaved)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors">
              📋 {showSaved ? 'Hide saved' : `Saved (${savedChecklists.length})`}
            </button>
          )}
        </div>

        {showSaved && savedChecklists.length > 0 && (
          <div className="no-print mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saved</p>
            </div>
            <div className="divide-y divide-gray-50">
              {savedChecklists.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
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
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="no-print mb-3">
          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white"
            rows={4}
            placeholder="Describe your situation in detail for the best results. Include your industry, state, what you are trying to do, and any specific chemicals or products involved. Example: I run a 50-person chemical warehouse in Oregon storing HF acid and want to add a new storage area."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div className="no-print mb-4">
          <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,image/*"
            onChange={handleFileChange} className="hidden" id="file-upload" />
          {!uploadedFile ? (
            <label htmlFor="file-upload"
              className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-400 hover:text-green-700 transition-colors">
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
          {!uploadedFile && (
            <button onClick={() => handleSubmit('research')} disabled={loading || !question.trim()}
              className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {loading ? 'Working...' : 'Research this topic →'}
            </button>
          )}
          <button
            onClick={() => handleSubmit(uploadedFile ? 'research' : 'checklist')}
            disabled={loading || (!question.trim() && !uploadedFile)}
            className={uploadedFile
              ? "bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
              : "border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-50"}>
            {loading ? 'Working...' : uploadedFile ? 'Ask about this file →' : 'Get my compliance checklist →'}
          </button>
        </div>

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

        {researchData && !loading && mode === 'research' && (
          <div className="mt-10 pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">{askedQuestion}</h2>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-sm text-gray-700 leading-relaxed space-y-4">
                {researchData.split('\n').map((line, i) => {
                  if (line.startsWith('## ') || line.startsWith('# ')) return (
                    <p key={i} className="text-xs font-bold uppercase tracking-widest text-green-700 mt-6 mb-1">{line.replace('## ', '').replace('# ', '')}</p>
                  )
                  if (line.startsWith('• ') || line.startsWith('- ')) return (
                    <p key={i} className="flex gap-2 text-gray-600"><span className="text-green-500 flex-shrink-0">•</span><span dangerouslySetInnerHTML={{__html: line.replace(/^[•\-] /, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}} /></p>
                  )
                  if (line.trim() === '') return <div key={i} className="h-1" />
                  return <p key={i} className="text-gray-700" dangerouslySetInnerHTML={{__html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}} />
                })}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => handleSubmit('checklist')}
                className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-green-600 bg-green-700 text-white hover:bg-green-800 transition-colors">
                Create my action checklist →
              </button>
              <p className="text-xs text-gray-400">Get actionable steps based on this research</p>
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

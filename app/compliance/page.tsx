'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

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

interface Step {
  title: string
  detail: string
  link: string
}

interface ChecklistItem {
  id?: string
  name: string
  description: string
  why?: string
  source_url?: string
  cost_note?: string
  providers?: Provider[]
  steps?: Step[]
  completed?: boolean
  // legacy fields
  required_by?: string
  recommended_by?: string
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
  const [data, setData] = useState<ChecklistData | null>(null)
  const [currentChecklistId, setCurrentChecklistId] = useState<string | null>(null)
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
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

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
        .select('name')
        .eq('id', profile.company_id)
        .single()
      if (company?.name) setCompanyName(company.name)
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
      .select('id, question, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (!checklists) return

    const withCounts = await Promise.all(checklists.map(async (c) => {
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
    // Delete existing sub-items for this parent
    await supabase
      .from('checklist_items')
      .delete()
      .eq('checklist_id', checklistId)
      .eq('parent_item_index', parentIndex)

    const items = subItems.map((item, i) => ({
      checklist_id: checklistId,
      category: 'must_do',
      name: item.name,
      description: item.description || '',
      why: item.why || null,
      source_url: item.source_url || null,
      cost_note: item.cost_note || null,
      sort_order: i,
      completed: false,
      parent_item_index: parentIndex,
    }))

    await supabase.from('checklist_items').insert(items)
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

    // Restore expanded steps
    const restoredSteps: Record<string, ChecklistItem[] | null> = {}
    mustDo.forEach((_, i) => {
      const children = subItems.filter(s => s.parent_item_index === i)
      if (children.length > 0) {
        restoredSteps[`must-${i}`] = children.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          why: s.why,
          source_url: s.source_url,
          cost_note: s.cost_note,
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
    setExpandedSteps(restoredSteps)
    setStepsCache(restoredSteps)
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

  async function handleGetSteps(itemIndex: number, itemName: string) {
    const key = `must-${itemIndex}`

    // Toggle off if visible — hide but keep in cache
    if (expandedSteps[key] && expandedSteps[key] !== null) {
      setExpandedSteps(prev => ({ ...prev, [key]: null }))
      return
    }

    // Restore from cache if previously loaded
    if (stepsCache[key]) {
      setExpandedSteps(prev => ({ ...prev, [key]: stepsCache[key] }))
      return
    }

    setLoadingSteps(prev => ({ ...prev, [key]: true }))

    try {
      const otherItems = data?.must_do
        ?.filter((_, idx) => idx !== itemIndex)
        ?.map((item, idx) => `- ${item.name}`)
        ?.join('\n') || ''

      const prompt = `The user has this compliance checklist item: "${itemName}"

Context: This is item #${itemIndex + 1} from a compliance checklist about: ${askedQuestion}

The main checklist already covers these other items separately — do NOT overlap with them:
${otherItems}

Give me a step-by-step sub-checklist for exactly how to complete THIS ONE ITEM ONLY.
3 to 6 concrete actionable steps. Each step must be something they can actually DO — a form to fill, a website to visit, a phone call to make, a document to prepare.
Stay focused only on completing "${itemName}". Do not include steps that belong to the other items listed above.
Return the same JSON format as a normal checklist but only the must_do array.`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt }),
      })
      const json = await res.json()
      const subItems: ChecklistItem[] = json.data?.must_do || []

      setExpandedSteps(prev => ({ ...prev, [key]: subItems }))
      setStepsCache(prev => ({ ...prev, [key]: subItems }))

      // Save to database if we have a checklist ID
      if (currentChecklistId && subItems.length > 0) {
        await saveSubItems(currentChecklistId, itemIndex, subItems)
        // Update IDs
        const { data: saved } = await supabase
          .from('checklist_items')
          .select('id, sort_order')
          .eq('checklist_id', currentChecklistId)
          .eq('parent_item_index', itemIndex)
          .order('sort_order')
        if (saved) {
          const withIds = subItems.map((item, i) => ({ ...item, id: saved[i]?.id }))
          setExpandedSteps(prev => ({ ...prev, [key]: withIds }))
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSteps(prev => ({ ...prev, [key]: false }))
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

  async function handleSubmit(customQuestion?: string) {
    const q = customQuestion || question
    if (!q.trim() && !uploadedFile) return
    setLoading(true)
    setData(null)
    setChecked({})
    setCompletedSteps([])
    setExpandedSteps({})
    setExpandedDetails({})
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
        res = await fetch('/api/chat', { method: 'POST', body: formData })
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        })
      }
      const json = await res.json()
      setData(json.data)

      if (json.data && userId) {
        const checklistId = await saveChecklist(q, json.data)
        if (checklistId) {
          setCurrentChecklistId(checklistId)
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

  const mustDoneCount = Object.entries(checked).filter(([k, v]) => k.startsWith('must-') && !k.startsWith('must-') === false && v && !k.includes('-') === false).filter(([k, v]) => {
    const parts = k.split('-')
    return parts[0] === 'must' && parts.length === 2 && v
  }).length
  const totalMust = data?.must_do?.length || 0

  return (
    <AppLayout title="Compliance Checklist">
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
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Compliance Checklist</h1>
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saved Checklists</p>
            </div>
            <div className="divide-y divide-gray-50">
              {savedChecklists.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadChecklist(c.id)}>
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</p>
                      {c.must_do_count > 0 && (
                        <p className="text-xs text-green-600">{c.completed_count}/{c.must_do_count} done</p>
                      )}
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
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white shadow-sm"
            rows={4}
            placeholder="e.g. What permits do I need to open a hazmat warehouse in Texas?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div className="no-print mb-4">
          <input ref={fileInputRef} type="file" accept=".pdf,image/*"
            onChange={handleFileChange} className="hidden" id="file-upload" />
          {!uploadedFile ? (
            <label htmlFor="file-upload"
              className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors bg-white">
              <span className="text-gray-400 text-lg">📎</span>
              <div>
                <p className="text-sm text-gray-500">Attach a file <span className="text-gray-400">(optional)</span></p>
                <p className="text-xs text-gray-400">PDF or image — audit reports, inspection findings, drum labels, SDS sheets</p>
              </div>
            </label>
          ) : (
            <div className="flex items-center gap-3 w-full border border-green-300 bg-green-50 rounded-xl px-4 py-3">
              <span className="text-green-600 text-lg">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">{uploadedFile.name}</p>
                <p className="text-xs text-green-600">Ready to analyse</p>
              </div>
              <button onClick={removeFile} className="text-gray-400 hover:text-red-500 text-lg">×</button>
            </div>
          )}
        </div>

        <div className="no-print mb-5 flex items-center gap-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium whitespace-nowrap">Example</p>
          <button onClick={() => setQuestion(EXAMPLE_QUESTIONS[chipIndex])}
            style={{ opacity: chipVisible ? 1 : 0, transition: 'opacity 0.4s ease' }}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors text-left bg-white">
            {EXAMPLE_QUESTIONS[chipIndex]}
          </button>
        </div>

        <div className="no-print">
          <button onClick={() => handleSubmit()} disabled={loading || (!question.trim() && !uploadedFile)}
            className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
            {loading ? 'Working...' : uploadedFile ? 'Analyse my document →' : 'Get my compliance checklist →'}
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

        {data && !loading && (
          <div className="mt-8">
            {data.safety_alert && (
              <div className="mb-6 p-4 bg-amber-50 border-l-4 border-l-amber-500 border border-amber-100 rounded-xl flex items-start gap-3">
                <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
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

            {/* MUST DO */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-green-700">✅ Must Do</span>
                <div className="flex-1 h-px bg-green-100"></div>
              </div>
              <div className="space-y-3">
                {data.must_do?.map((item, i) => {
                  const key = `must-${i}`
                  const isChecked = checked[key]
                  const isDetailOpen = expandedDetails[key]
                  const subItems = expandedSteps[key]
                  const isLoadingSteps = loadingSteps[key]

                  return (
                    <div key={i} className={`rounded-xl border transition-all ${isChecked ? 'opacity-60 bg-gray-50 border-gray-100' : i % 2 === 0 ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-200 shadow-sm'}`}>
                      {/* Main item row */}
                      <div className="flex items-start gap-3 p-4">
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
                            <button
                              onClick={() => handleGetSteps(i, item.name)}
                              disabled={isLoadingSteps}
                              className="no-print flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50 whitespace-nowrap">
                              {isLoadingSteps ? '...' : subItems ? '↑ Hide steps' : 'Give me the steps →'}
                            </button>
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

                          {/* Expandable detail */}
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

                      {/* Sub-steps accordion */}
                      {(subItems || isLoadingSteps) && (
                        <div className="sub-checklist border-t border-gray-100 bg-gray-50 rounded-b-xl px-4 py-3">
                          {isLoadingSteps ? (
                            <p className="text-xs text-gray-400 animate-pulse">Getting steps...</p>
                          ) : subItems && subItems.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Steps to complete this</p>
                              {subItems.map((sub, j) => {
                                const subKey = `sub-${i}-${j}`
                                const subChecked = checked[subKey]
                                return (
                                  <div key={j} className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${subChecked ? 'opacity-50 bg-white border-gray-100' : 'bg-white border-gray-200'}`}>
                                    <button
                                      onClick={() => toggleCheck(subKey, sub.id)}
                                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${subChecked ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                                      {subChecked && <span className="text-white text-[9px]">✓</span>}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-800">
                                        <span className="text-gray-400 mr-1">{i + 1}.{j + 1}</span>
                                        {sub.name}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>
                                      {sub.source_url && (
                                        <a href={sub.source_url} target="_blank" rel="noopener noreferrer"
                                          className="text-xs text-green-600 hover:text-green-800 underline mt-0.5 inline-block">
                                          ↗ {sub.source_url.replace('https://', '').split('/')[0]}
                                        </a>
                                      )}
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

            {/* GOOD TO HAVE */}
            {data.good_to_have?.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-600">💡 Good to Have</span>
                  <div className="flex-1 h-px bg-blue-100"></div>
                </div>
                <div className="space-y-3">
                  {data.good_to_have?.map((item, i) => {
                    const key = `nice-${i}`
                    const isChecked = checked[key]
                    const isDetailOpen = expandedDetails[key]
                    return (
                      <div key={i} className={`rounded-xl border transition-all ${isChecked ? 'opacity-60 bg-gray-50 border-gray-100' : i % 2 === 0 ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-200 shadow-sm'}`}>
                        <div className="flex items-start gap-3 p-4">
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

            {/* FOLLOW UP */}
            <div className="no-print mt-8 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Ask a follow-up question</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-white"
                  placeholder="e.g. Tell me more about item #3, or ask anything else..."
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFollowUp() }}
                />
                <button onClick={handleFollowUp} disabled={!followUpQuestion.trim()}
                  className="px-4 py-2.5 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                  Ask →
                </button>
              </div>
              {data.follow_up_questions && data.follow_up_questions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.follow_up_questions.map((q, i) => (
                    <button key={i} onClick={() => setFollowUpQuestion(q)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors bg-white">
                      → {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
              This checklist is for informational purposes only and is not legal advice. Always verify requirements with the relevant agencies.
            </p>
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

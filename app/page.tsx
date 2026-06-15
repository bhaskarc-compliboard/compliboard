'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_MESSAGES = [
  "Reading your question...",
  "Searching federal regulations...",
  "Checking state requirements...",
  "Reading agency guidelines...",
  "Checking for recent changes...",
  "Sorting must-do from good-to-have...",
  "Building your checklist...",
]

const FEATURE_CARDS = [
  { icon: "📋", text: "Exact steps — form numbers, phone numbers, what to prepare" },
  { icon: "💰", text: "Honest cost ranges for every step — no surprises" },
  { icon: "⏱", text: "Time estimates — plan your week around compliance" },
  { icon: "📞", text: "Who to call, what to say, and where to go" },
]

interface ChecklistItem {
  id?: string
  name: string
  description: string
  why?: string
  source_url?: string
  cost_note?: string
  time_estimate?: string
  what_you_need?: string
  agency_name?: string
  search_hint?: string
  is_determination?: boolean
}

interface ChecklistData {
  title: string
  safety_alert?: string
  must_do: ChecklistItem[]
  good_to_have: ChecklistItem[]
}

export default function HomePage() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSteps, setLoadingSteps] = useState(false)
  const [currentStatus, setCurrentStatus] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [visibleCards, setVisibleCards] = useState<number[]>([])
  const [checklist, setChecklist] = useState<ChecklistData | null>(null)
  const [microSteps, setMicroSteps] = useState<ChecklistItem[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [limitReached, setLimitReached] = useState(false)

  useEffect(() => {
    const count = parseInt(localStorage.getItem('cb_demo_count') || '0')
    setQuestionCount(count)
    if (count >= 3) setLimitReached(true)
  }, [])

  async function handleDemo() {
    if (!question.trim()) return
    if (limitReached) { router.push('/signup'); return }

    const newCount = questionCount + 1
    localStorage.setItem('cb_demo_count', String(newCount))
    setQuestionCount(newCount)
    if (newCount >= 3) setLimitReached(true)

    setLoading(true)
    setChecklist(null)
    setMicroSteps([])
    setCompletedSteps([])
    setVisibleCards([])
    setPanelOpen(false)

    // Status messages
    const delays = [0, 700, 1400, 2100, 2800, 3500, 4200]
    STATUS_MESSAGES.forEach((msg, i) => {
      setTimeout(() => {
        setCurrentStatus(msg)
        if (i > 0) setCompletedSteps(prev => [...prev, STATUS_MESSAGES[i - 1]])
      }, delays[i])
    })

    // Feature cards fade in during wait
    FEATURE_CARDS.forEach((_, i) => {
      setTimeout(() => {
        setVisibleCards(prev => [...prev, i])
      }, 8000 + i * 4000)
    })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, mode: 'checklist' }),
      })
      const json = await res.json()
      if (json.data) {
        setChecklist(json.data)
        setLoading(false)
        setCurrentStatus('')
        setCompletedSteps([])
        setVisibleCards([])
        setPanelOpen(true)

        // Now fetch micro-steps for item 1 only
        if (json.data.must_do?.length > 0) {
          setLoadingSteps(true)
          const item = json.data.must_do[0]
          const otherItems = json.data.must_do
            .slice(1)
            .map((it: ChecklistItem) => '- ' + it.name)
            .join(', ')

          const stepsPrompt = `Main checklist item: "${item.name}"
Description: "${item.description}"
This is item 1 from a compliance checklist.
Other items already covered — do NOT overlap: ${otherItems}

Generate 3 to 4 specific micro-steps to complete this one item only.
Every step must include a direct deep link, time estimate, cost, and what to prepare.`

          try {
            const stepsRes = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ question: stepsPrompt, mode: 'substeps' }),
            })
            const stepsJson = await stepsRes.json()
            if (stepsJson.data?.must_do) {
              setMicroSteps(stepsJson.data.must_do)
            }
          } catch (err) {
            console.error('Steps error:', err)
          } finally {
            setLoadingSteps(false)
          }
        }
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
      setCurrentStatus('')
    }
  }

  const remainingQuestions = 3 - questionCount

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-semibold tracking-tight">
            <span className="text-green-700">Compli</span><span className="text-orange-600">Board</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Sign in</a>
            <a href="/signup" className="bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-green-800 transition-colors">
              Start free trial →
            </a>
          </div>
        </div>
      </nav>

      {/* Slide-out panel */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
        style={{ opacity: panelOpen ? 1 : 0, pointerEvents: panelOpen ? 'auto' : 'none' }}
        onClick={() => setPanelOpen(false)}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-out"
        style={{ transform: panelOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {checklist && (
          <>
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
              <div>
                <p className="text-base font-semibold text-gray-900">{checklist.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{checklist.must_do?.length} compliance items found</p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {checklist.safety_alert && (
                <div className="mb-5 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-xl">
                  <p className="text-xs font-semibold text-amber-700 mb-1">⚠ Safety note</p>
                  <p className="text-xs text-amber-700">{checklist.safety_alert}</p>
                </div>
              )}

              <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-4">✅ Must Do</p>
              <div className="space-y-4">
                {checklist.must_do?.map((item, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="p-5">
                      <p className="text-sm font-semibold text-gray-900 mb-2">
                        <span className="text-gray-400 font-normal mr-1">{i + 1}.</span>
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{item.description}</p>
                      <div className="flex flex-wrap gap-3">
                        {item.cost_note && (
                          <span className="text-xs text-amber-600">💰 {item.cost_note}</span>
                        )}
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:text-green-800 underline">
                            ↗ Official source
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Micro-steps for item 1 only */}
                    {i === 0 && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                        {loadingSteps ? (
                          <div className="flex items-center gap-2">
                            <span className="animate-spin text-green-600 text-sm">⟳</span>
                            <p className="text-xs text-gray-500">Generating detailed steps...</p>
                          </div>
                        ) : microSteps.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Steps to complete this</p>
                            <div className="space-y-3">
                              {microSteps.map((step, j) => (
                                <div key={j} className="flex items-start gap-3">
                                  <span className="text-xs font-bold text-green-600 mt-0.5 flex-shrink-0">1.{j + 1}</span>
                                  <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-800 mb-0.5">{step.name}</p>
                                    <p className="text-xs text-gray-500 leading-relaxed mb-1">{step.description}</p>
                                    <div className="flex flex-wrap gap-3 mt-1">
                                      {step.time_estimate && <span className="text-xs text-gray-400">⏱ {step.time_estimate}</span>}
                                      {step.cost_note && <span className="text-xs text-amber-600">💰 {step.cost_note}</span>}
                                      {step.what_you_need && <span className="text-xs text-gray-400">📋 {step.what_you_need}</span>}
                                    </div>
                                    {step.agency_name && <p className="text-xs text-gray-500 mt-1">🏛 {step.agency_name}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <p className="text-xs text-gray-400">Full access includes detailed steps for every item →</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {checklist.good_to_have?.length > 0 && (
                <div className="mt-8">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-4">💡 Good to Have</p>
                  <div className="space-y-3">
                    {checklist.good_to_have?.map((item, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl p-5 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-900 mb-1">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky save banner */}
            <div className="border-t border-gray-100 px-8 py-5 bg-white">
              <p className="text-xs text-gray-500 mb-3">
                {limitReached
                  ? "You've used your 3 free questions. Sign up to keep going and save your checklists."
                  : `${remainingQuestions} free question${remainingQuestions === 1 ? '' : 's'} remaining — sign up to save this checklist and unlock full access.`
                }
              </p>
              <a href="/signup"
                className="block w-full bg-green-700 text-white text-sm font-medium py-3 rounded-xl text-center hover:bg-green-800 transition-colors">
                Save this checklist — 14 days free, no credit card →
              </a>
              <p className="text-xs text-gray-400 text-center mt-2">
                Full access: micro-steps for every item · document storage · deadline tracking
              </p>
            </div>
          </>
        )}
      </div>

      {/* Hero */}
      <section className="pt-24 pb-24 px-6" style={{background: "radial-gradient(ellipse at left center, #dcfce7 0%, #ffffff 45%, #f0fdf4 100%)"}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
              Your compliance assistant for small and medium businesses.
            </h1>
            <p className="text-lg text-gray-500 mb-8 max-w-lg leading-relaxed">
              CompliBoard helps you manage compliance requirements, documents, HR policies, and deadlines — all in one place.
            </p>
            <div className="flex items-center gap-4">
              <a href="/signup"
                className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                Start your free trial →
              </a>
              <p className="text-xs text-gray-400">14 days free · No credit card needed</p>
            </div>
          </div>

          {/* Coded product mock */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            {/* Browser bar */}
            <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-3 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">compliboard.com/compliance</div>
            </div>

            {/* Mock content */}
            <div className="p-5">
              {/* Safety alert */}
              <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl">
                <p className="text-xs font-semibold text-amber-700 mb-0.5">⚠ Safety note</p>
                <p className="text-xs text-amber-700 leading-relaxed">You store hazardous materials on site. These require immediate attention to emergency response planning, proper storage protocols, and employee training under OSHA 29 CFR 1910.1200.</p>
              </div>

              {/* Checklist title */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-900">Core Compliance — Portland Oregon Warehouse</p>
                <span className="text-xs text-green-600">✓ Saved</span>
              </div>

              {/* Must do label */}
              <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">✅ Must Do</p>

              {/* Item 1 — expanded with micro-steps */}
              <div className="border border-gray-200 rounded-xl mb-2 overflow-hidden">
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-900 mb-1">
                    <span className="text-gray-400 font-normal mr-1">1.</span>
                    Register for Oregon Business Identification Number
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">Obtain a BIN from Oregon Department of Revenue under ORS 314.610.</p>
                </div>
                <div className="bg-gray-50 border-t border-gray-100 px-3 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Steps to complete this</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <span className="text-xs font-bold text-green-600 flex-shrink-0">1.1</span>
                      <div>
                        <p className="text-xs font-medium text-gray-800">Determine if you need a BIN</p>
                        <p className="text-xs text-gray-400 mt-0.5">⏱ 10 min · 💰 Free · 📋 None needed</p>
                        <p className="text-xs text-gray-400">🏛 Oregon Department of Revenue</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs font-bold text-green-600 flex-shrink-0">1.2</span>
                      <div>
                        <p className="text-xs font-medium text-gray-800">Gather required business information</p>
                        <p className="text-xs text-gray-400 mt-0.5">⏱ 15 min · 💰 Free · 📋 EIN, business address</p>
                        <p className="text-xs text-gray-400">🏛 Oregon Department of Revenue</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs font-bold text-green-600 flex-shrink-0">1.3</span>
                      <div>
                        <p className="text-xs font-medium text-gray-800">Complete Oregon Combined Business Registration</p>
                        <p className="text-xs text-gray-400 mt-0.5">⏱ 20-30 min · 💰 Free · 📋 All info from step 1.2</p>
                        <p className="text-xs text-gray-400">🏛 Oregon Business Xpress</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Item 2 — collapsed */}
              <div className="border border-gray-200 rounded-xl mb-2 p-3">
                <p className="text-xs font-semibold text-gray-900">
                  <span className="text-gray-400 font-normal mr-1">2.</span>
                  Obtain Portland Business License
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Register with City of Portland Revenue Division under Portland City Code 7.02.</p>
              </div>

              {/* Item 3 — collapsed, slightly faded */}
              <div className="border border-gray-100 rounded-xl p-3 opacity-60">
                <p className="text-xs font-semibold text-gray-700">
                  <span className="text-gray-400 font-normal mr-1">3.</span>
                  Register for USDOT Number and Operating Authority
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live demo section */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3 text-center">Try it now — no account needed</p>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
            Ask any compliance question.
          </h2>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <textarea
              className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-gray-50"
              rows={3}
              placeholder="Example: I run a 20-person brewery in Portland Oregon with a taproom and I distribute to local bars. What compliance do I need?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDemo() } }}
            />

            {loading && (
              <div className="mt-5 space-y-1.5">
                {completedSteps.map((step) => (
                  <div key={step} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="text-green-500 flex-shrink-0">✓</span>{step}
                  </div>
                ))}
                {currentStatus && (
                  <div className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                    <span className="animate-spin inline-block flex-shrink-0">⟳</span>{currentStatus}
                  </div>
                )}

                {visibleCards.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-3">Here's what you'll see in your checklist:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {visibleCards.map(i => (
                        <div key={i} className="flex items-start gap-2.5 p-3 bg-green-50 rounded-xl border border-green-100">
                          <span className="text-sm flex-shrink-0">{FEATURE_CARDS[i].icon}</span>
                          <p className="text-xs text-green-800 leading-relaxed">{FEATURE_CARDS[i].text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              {limitReached ? (
                <div className="w-full">
                  <p className="text-xs text-gray-500 mb-2">You've used your 3 free questions.</p>
                  <a href="/signup"
                    className="block w-full bg-green-700 text-white text-sm font-medium py-2.5 rounded-xl text-center hover:bg-green-800 transition-colors">
                    Create your free account to continue →
                  </a>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleDemo}
                    disabled={loading || !question.trim()}
                    className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                    {loading ? 'Building your checklist...' : 'See my compliance checklist →'}
                  </button>
                  <p className="text-xs text-gray-400">
                    {remainingQuestions} free question{remainingQuestions === 1 ? '' : 's'} remaining
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1 — Checklist */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">Compliance Checklist</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Every step. Every agency. Every cost.</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">Ask any compliance question in plain English. Get a complete checklist with exact micro-steps — form numbers, phone numbers, time estimates, and honest cost ranges.</p>
            <ul className="space-y-3">
              {[
                "Specific micro-steps for every compliance item",
                "Direct links to official government sources",
                "Honest cost ranges — no surprises",
                "Logical sequence — prerequisites before actions",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-100 rounded-2xl aspect-video flex items-center justify-center">
            <p className="text-sm text-gray-400">Screenshot — Compliance Checklist</p>
          </div>
        </div>
      </section>

      {/* Feature 2 — Document scanning */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div className="bg-gray-100 rounded-2xl aspect-video flex items-center justify-center">
            <p className="text-sm text-gray-400">Screenshot — Document Review</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">Document Intelligence</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Upload once. We find the gaps.</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">Upload your permits, licenses, and compliance documents. CompliBoard reads them, identifies what's missing, flags what's expiring, and tells you exactly what action to take.</p>
            <ul className="space-y-3">
              {[
                "Automatic gap analysis against your industry requirements",
                "Expiry date extraction and calendar alerts",
                "Document review with action items",
                "Secure storage — only accessible by your account",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature 3 — Deadlines */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">Deadline Tracking</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Never miss a renewal. Never pay a late fee.</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">CompliBoard extracts compliance deadlines from your documents automatically and adds them to your calendar. Get alerted before anything expires.</p>
            <ul className="space-y-3">
              {[
                "Automatic date extraction from any document",
                "Compliance calendar with upcoming deadlines",
                "Monthly email summaries of what's coming due",
                "Recurring deadline tracking for annual renewals",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-100 rounded-2xl aspect-video flex items-center justify-center">
            <p className="text-sm text-gray-400">Screenshot — Compliance Calendar</p>
          </div>
        </div>
      </section>

      {/* Feature 4 — Onboarding scan */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div className="bg-gray-100 rounded-2xl aspect-video flex items-center justify-center">
            <p className="text-sm text-gray-400">Screenshot — Website Scan</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">Smart Onboarding</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">CompliBoard knows your business from day one.</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">Enter your website when you sign up. CompliBoard reads it, identifies your chemicals, certifications, and operations, and personalises every answer to your specific business.</p>
            <ul className="space-y-3">
              {[
                "Automatic business profile from your website",
                "Industry-specific compliance folders built instantly",
                "Personalised answers based on your actual operations",
                "Certifications pre-confirmed — no manual setup",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">Industries</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for small business across every industry</h2>
          <p className="text-gray-500 mb-12 max-w-xl mx-auto text-sm">CompliBoard adapts to your industry automatically. You get the exact compliance requirements for your business — not a generic template.</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: "⚗️", label: "Chemical Manufacturing" },
              { icon: "🍺", label: "Brewery & Bar" },
              { icon: "🍽️", label: "Restaurant & Food Service" },
              { icon: "🌿", label: "Cannabis" },
              { icon: "🚗", label: "Auto Body & Dry Cleaners" },
              { icon: "🌲", label: "Wood Products & Sawmills" },
              { icon: "🏗️", label: "Construction" },
              { icon: "🏥", label: "Healthcare & Hospice" },
            ].map((industry, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-5 text-center border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-colors cursor-default">
                <p className="text-2xl mb-2">{industry.icon}</p>
                <p className="text-xs font-medium text-gray-700">{industry.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, honest pricing.</h2>
          <p className="text-gray-500 mb-10 text-sm">No hidden fees. No per-user charges. One price for your whole business.</p>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="mb-6">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-2">Early Adopter</p>
              <div className="flex items-end justify-center gap-1 mb-1">
                <span className="text-5xl font-bold text-gray-900">$29</span>
                <span className="text-gray-400 mb-2">/month</span>
              </div>
              <p className="text-xs text-green-700 font-medium">Locked forever for the first 100 customers</p>
            </div>

            <ul className="space-y-3 mb-8 text-left">
              {[
                "Unlimited compliance checklists",
                "Document storage and gap analysis",
                "Deadline tracking and calendar alerts",
                "Monthly regulation change alerts",
                "HR document templates",
                "Smart onboarding from your website",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-500 flex-shrink-0">✓</span>{feature}
                </li>
              ))}
            </ul>

            <a href="/signup"
              className="block w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors text-center">
              Start your 14-day free trial →
            </a>
            <p className="text-xs text-gray-400 mt-3">No credit card needed. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 bg-green-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Stop guessing. Start knowing.</h2>
          <p className="text-green-100 mb-8 text-sm">Join small businesses across Oregon and Washington who use CompliBoard to stay compliant — without the stress.</p>
          <a href="/signup"
            className="inline-block bg-white text-green-700 px-8 py-3 rounded-xl text-sm font-semibold hover:bg-green-50 transition-colors">
            Start your free trial — no credit card needed →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <p className="text-sm font-semibold">
            <span className="text-green-700">Compli</span><span className="text-orange-600">Board</span>
          </p>
          <div className="flex items-center gap-6">
            <a href="/login" className="text-xs text-gray-400 hover:text-gray-600">Sign in</a>
            <a href="/signup" className="text-xs text-gray-400 hover:text-gray-600">Create account</a>
          </div>
          <p className="text-xs text-gray-400">© 2026 CompliBoard. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}

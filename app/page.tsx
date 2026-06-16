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
    if (limitReached) return

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

    const delays = [0, 700, 1400, 2100, 2800, 3500, 4200]
    STATUS_MESSAGES.forEach((msg, i) => {
      setTimeout(() => {
        setCurrentStatus(msg)
        if (i > 0) setCompletedSteps(prev => [...prev, STATUS_MESSAGES[i - 1]])
      }, delays[i])
    })

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
                        <span className="text-gray-400 font-normal mr-1">{i + 1}.</span>{item.name}
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{item.description}</p>
                      <div className="flex flex-wrap gap-3">
                        {item.cost_note && <span className="text-xs text-amber-600">💰 {item.cost_note}</span>}
                        {item.source_url && (
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:text-green-800 underline">↗ Official source</a>
                        )}
                      </div>
                    </div>
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

            <div className="border-t border-gray-100 px-8 py-5 bg-white">
              <p className="text-xs text-gray-500 mb-3">
                {limitReached
                  ? "You've used your 3 free questions. Sign up to keep going and save your checklists."
                  : `${remainingQuestions} free question${remainingQuestions === 1 ? '' : 's'} remaining — sign up to save this checklist and unlock full access.`
                }
              </p>
              <a href="/signup" className="block w-full bg-green-700 text-white text-sm font-medium py-3 rounded-xl text-center hover:bg-green-800 transition-colors">
                Save this checklist — 14 days free, no credit card →
              </a>
              <p className="text-xs text-gray-400 text-center mt-2">Full access: micro-steps for every item · document storage · deadline tracking</p>
            </div>
          </>
        )}
      </div>

      {/* Hero */}
      <section className="pt-20 pb-20 px-6" style={{background: "linear-gradient(to right, #dcfce7 0%, #ffffff 50%, #f0fdf4 100%)"}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">
              Your compliance assistant for small and medium businesses.
            </h1>
            <p className="text-base text-gray-500 mb-6 max-w-lg leading-relaxed">
              CompliBoard helps you manage compliance requirements, documents, HR policies, and deadlines — all in one place.
            </p>
            <div className="flex items-center gap-4">
              <a href="/signup" className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                Start your free trial →
              </a>
              <p className="text-xs text-gray-400">14 days free · No credit card needed</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-3 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">compliboard.com/compliance</div>
            </div>
            <div className="p-5">
              <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl">
                <p className="text-xs font-semibold text-amber-700 mb-0.5">⚠ Safety note</p>
                <p className="text-xs text-amber-700 leading-relaxed">You store hazardous materials on site. These require immediate attention to emergency response planning, proper storage protocols, and employee training under OSHA 29 CFR 1910.1200.</p>
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-900">Core Compliance — Portland Oregon Warehouse</p>
                <span className="text-xs text-green-600">✓ Saved</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">✅ Must Do</p>
              <div className="border border-gray-200 rounded-xl mb-2 overflow-hidden">
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-900 mb-1"><span className="text-gray-400 font-normal mr-1">1.</span>Register for Oregon Business Identification Number</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Obtain a BIN from Oregon Department of Revenue under ORS 314.610.</p>
                </div>
                <div className="bg-gray-50 border-t border-gray-100 px-3 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Steps to complete this</p>
                  <div className="space-y-2">
                    {[
                      {n:"1.1",name:"Determine if you need a BIN",time:"10 min",cost:"Free",agency:"Oregon Dept of Revenue"},
                      {n:"1.2",name:"Gather required business information",time:"15 min",cost:"Free",agency:"Oregon Dept of Revenue"},
                      {n:"1.3",name:"Complete Combined Registration online",time:"20-30 min",cost:"Free",agency:"Oregon Business Xpress"},
                    ].map(s => (
                      <div key={s.n} className="flex gap-2">
                        <span className="text-xs font-bold text-green-600 flex-shrink-0">{s.n}</span>
                        <div>
                          <p className="text-xs font-medium text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400">⏱ {s.time} · 💰 {s.cost}</p>
                          <p className="text-xs text-gray-400">🏛 {s.agency}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-900"><span className="text-gray-400 font-normal mr-1">2.</span>Obtain Portland Business License</p>
                <p className="text-xs text-gray-500 mt-0.5">Register with City of Portland Revenue Division under Portland City Code 7.02.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — clean strip */}
      <section className="py-16 px-6 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-7 gap-0 items-start">

            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">1</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Ask any compliance question</h3>
              <p className="text-xs text-gray-500 leading-relaxed">For any industry, any state.</p>
            </div>

            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
                <path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">2</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">We do the research</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Federal, state, and local regulations — sorted by priority.</p>
            </div>

            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
                <path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">3</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Get your checklist</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Every item with source links, cost estimates, and progress tracking.</p>
            </div>

            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
                <path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">4</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Detailed micro-steps</h3>
              <p className="text-xs text-gray-500 leading-relaxed">What to do, form numbers, time, cost estimates, and who to contact.</p>
            </div>

          </div>
        </div>
      </section>

      {/* Live demo section */}
      <section className="py-24 px-6" style={{background: '#f5f5f4'}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-start">
          <div className="pt-4">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-4">Try it free — no account needed</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">See CompliBoard in action.</h2>
            <p className="text-gray-500 leading-relaxed mb-4">Ask any compliance question. Get a complete checklist with every step you need to take — exact costs, time estimates, and direct links to official sources.</p>
            <p className="text-gray-500 leading-relaxed mb-8">Or research any topic to understand what a regulation means for your business before diving into the steps.</p>
            <p className="text-xs text-gray-400">3 free questions · No signup required</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col gap-2 mb-4">
              <p className="text-xs text-gray-400 mb-1">Try an example:</p>
              {[
                "I run a restaurant in Portland Oregon with 15 employees. What permits do I need?",
                "I have delivery drivers transporting hazardous materials. What are my DOT requirements?",
              ].map((example, i) => (
                <button key={i} onClick={() => setQuestion(example)}
                  className="text-left text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2 hover:bg-green-100 transition-colors">
                  {example}
                </button>
              ))}
            </div>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-gray-50"
              rows={3} placeholder="Or type your own question..."
              value={question} onChange={(e) => setQuestion(e.target.value)}
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
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              {limitReached ? (
                <div className="w-full">
                  <p className="text-xs text-gray-500 mb-2">You've used your 3 free questions.</p>
                  <a href="/signup" className="block w-full bg-green-700 text-white text-sm font-medium py-2.5 rounded-xl text-center hover:bg-green-800 transition-colors">
                    Create your free account to continue →
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button onClick={handleDemo} disabled={loading || !question.trim()}
                      className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50 whitespace-nowrap">
                      {loading ? 'Working...' : 'Get checklist →'}
                    </button>
                    <button onClick={() => { if (!question.trim() || loading) return; handleDemo() }} disabled={loading || !question.trim()}
                      className="border border-gray-200 text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                      Research this →
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 text-right">{remainingQuestions} free question{remainingQuestions === 1 ? '' : 's'} remaining</p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* DOCUMENT INTELLIGENCE SECTION */}
      <section className="bg-white pt-24 px-6 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-3xl font-bold text-green-700">Document Intelligence</p>
          </div>
          <div className="grid grid-cols-5 gap-0 items-start pb-10 border-b border-gray-100">
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">1</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Upload your documents</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Permits, licenses, SDS sheets, inspection reports — any compliance file.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">2</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Audit a folder or file</h3>
              <p className="text-xs text-gray-500 leading-relaxed">CompliBoard reads your documents and checks them against your industry requirements.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">3</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Get your compliance report</h3>
              <p className="text-xs text-gray-500 leading-relaxed">See exactly what you have, what needs updating, and what is missing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DOCUMENT INTELLIGENCE — headline + mock */}
      <section className="py-16 px-6" style={{background: '#FFFBF0'}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">Upload once. Know exactly where you stand.</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">Upload your compliance documents and CompliBoard audits them against your industry requirements — telling you exactly what you have, what's outdated, and what's missing before an inspector does.</p>
            <ul className="space-y-3">
              {[
                "Instant gap analysis against your industry requirements",
                "Flags outdated documents before they become violations",
                "Identifies missing permits, licenses, and safety records",
                "Stored securely — only accessible by your account",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900">📁 Healthcare › HIPAA Compliance</p>
                  <p className="text-xs text-gray-400">6 documents · Audited June 15, 2026</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-green-600 font-medium">✅ 3</span>
                  <span className="text-xs text-amber-500 font-medium">⚠ 1</span>
                  <span className="text-xs text-red-500 font-medium">✗ 2</span>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-gray-500 leading-relaxed filter blur-[3px] select-none">Portland Regional Medical Center HIPAA folder contains most core privacy documentation but is missing critical incident response records.</p>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-1.5">✅ Present</p>
                <div className="space-y-1">
                  {[
                    { name: "HIPAA_Privacy_Policy_v3.pdf", note: "Current — meets 45 CFR 164.520" },
                    { name: "CMS_Certification_Letter.pdf", note: "Valid through December 2026" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                      <span className="text-green-500 flex-shrink-0 text-xs">✓</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 filter blur-[2px] select-none">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1.5">⚠ Needs Review</p>
                <div className="px-2 py-1.5 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <span className="text-amber-500 text-xs flex-shrink-0">!</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">HIPAA_Risk_Assessment_2023.pdf</p>
                    <p className="text-xs text-gray-400 filter blur-[2px] select-none">Dated 2023 — annual review required under 45 CFR 164.308</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-1.5">✗ Missing</p>
                <div className="space-y-1">
                  {[
                    { name: "Breach Notification Procedures", priority: "HIGH" },
                    { name: "Workforce HIPAA Training Records", priority: "HIGH" },
                  ].map((item, i) => (
                    <div key={i} className="px-2 py-1.5 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                      <span className="text-red-400 text-xs flex-shrink-0">✗</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-gray-800">{item.name}</p>
                          <span className="text-xs text-red-500 font-semibold flex-shrink-0">{item.priority}</span>
                        </div>
                        <p className="text-xs text-gray-400 filter blur-[2px] select-none">Required under HIPAA Security Rule — liability exposure.</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE CALENDAR SECTION */}
      <section className="bg-white pt-24 px-6 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-3xl font-bold text-green-700">Compliance Calendar</p>
          </div>
          <div className="grid grid-cols-7 gap-0 items-start pb-10 border-b border-gray-100">
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">1</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Upload a document or add manually</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Any permit, license, or compliance document with a deadline.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">2</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Dates extracted automatically</h3>
              <p className="text-xs text-gray-500 leading-relaxed">CompliBoard reads your document and pulls every renewal and expiry date.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">3</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Added to your calendar</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Every deadline appears on your compliance calendar automatically.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">4</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Get alerted before every deadline</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Monthly summaries and alerts before anything expires or comes due.</p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE CALENDAR — headline + mock */}
      <section className="py-16 px-6" style={{background: '#F0F9FF'}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-start">

          {/* Left */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">Never miss a renewal. Never pay a late fee.</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">CompliBoard extracts compliance deadlines from your documents automatically and adds them to your calendar. Get alerted before anything expires.</p>
            <ul className="space-y-3">
              {[
                "Automatic date extraction from any document",
                "Overdue and upcoming deadline alerts",
                "Add to Google Calendar or Outlook in one click",
                "Recurring deadline tracking for annual renewals",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — calendar mock */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">

            {/* Alert banners */}
            <div className="grid grid-cols-2 gap-3 p-4 border-b border-gray-100">
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold text-red-700">⚠️ Overdue</p>
                <p className="text-xs text-red-600">3 deadlines past due</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-700">📅 Due in 30 days</p>
                <p className="text-xs text-amber-600">2 deadlines coming up</p>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="px-4 py-3">
              {/* Month header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">←</span>
                <p className="text-xs font-semibold text-gray-900">July 2026</p>
                <span className="text-xs text-gray-400">→</span>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <p key={d} className="text-center text-xs text-gray-400 py-1">{d}</p>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-y-1">
                {/* Row 1 — empty + 1-4 */}
                {[null,null,1,2,3,4,5].map((day, i) => (
                  <div key={i} className="h-10 flex flex-col items-center pt-1">
                    {day && <p className="text-xs text-gray-600">{day}</p>}
                  </div>
                ))}
                {/* Row 2 — 6-12, with event on 8 */}
                {[6,7,8,9,10,11,12].map((day) => (
                  <div key={day} className="h-10 flex flex-col items-center pt-1">
                    <p className="text-xs text-gray-600 mb-0.5">{day}</p>
                    {day === 8 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">ISO 9001...</p>}
                  </div>
                ))}
                {/* Row 3 — 13-19, with event on 15 */}
                {[13,14,15,16,17,18,19].map((day) => (
                  <div key={day} className="h-10 flex flex-col items-center pt-1">
                    <p className="text-xs text-gray-600 mb-0.5">{day}</p>
                    {day === 15 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">OSHA PSM...</p>}
                  </div>
                ))}
                {/* Row 4 — 20-26, with events on 20 and 22 */}
                {[20,21,22,23,24,25,26].map((day) => (
                  <div key={day} className="h-10 flex flex-col items-center pt-1">
                    <p className="text-xs text-gray-600 mb-0.5">{day}</p>
                    {day === 20 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">DEQ Air...</p>}
                    {day === 22 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">DOT Haz...</p>}
                  </div>
                ))}
                {/* Row 5 — 27-31 with event on 31 */}
                {[27,28,29,30,31,null,null].map((day, i) => (
                  <div key={i} className="h-10 flex flex-col items-center pt-1">
                    {day && <p className="text-xs text-gray-600 mb-0.5">{day}</p>}
                    {day === 31 && <p className="text-xs bg-green-100 text-green-800 px-1 rounded truncate w-full text-center leading-tight">EPA RMP...</p>}
                  </div>
                ))}
              </div>

              {/* This month list */}
              <div className="border-t border-gray-100 mt-3 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">This month</p>
                <div className="space-y-1.5">
                  {[
                    { name: "ISO 9001:2015 Surveillance Audit", date: "7/8/2026", days: "Due in 23 days" },
                    { name: "OSHA Process Safety Management Review", date: "7/15/2026", days: "Due in 30 days" },
                    { name: "Oregon DEQ Air Quality Permit Renewal", date: "7/20/2026", days: "Due in 35 days" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded border-2 border-gray-300 flex-shrink-0" />
                      <p className="text-xs text-gray-700 flex-1 truncate">{item.name}</p>
                      <span className="text-xs text-amber-600 flex-shrink-0">{item.days}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* HR SECTION */}
      <section className="bg-white pt-24 px-6 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-3xl font-bold text-green-700">Your HR Policy Assistant</p>
          </div>
          <div className="grid grid-cols-7 gap-0 items-start pb-10 border-b border-gray-100">
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">1</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Upload your handbook</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Your existing employee handbook — any format.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">2</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Ask any HR question</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Parental leave, sick days, termination process — anything.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">3</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Get the answer, gaps, and a draft policy</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Know what your handbook says, what's missing, and get a draft fix.</p>
            </div>
            <div className="flex justify-center pt-3">
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none"><path d="M0 7h24M18 1l6 6-6 6" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-9 h-9 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center mb-3">4</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Audit your handbook — see what's missing</h3>
              <p className="text-xs text-gray-500 leading-relaxed">Run a full audit against current regulations and close every gap.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HR — headline + mock */}
      <section className="py-16 px-6" style={{background: '#F7FEF9'}}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-start">

          {/* Left */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">Get answers from your own handbook.</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">Upload your employee handbook and ask any HR question. CompliBoard tells you what your policy says, flags what's missing, and drafts the language to fix it.</p>
            <ul className="space-y-3">
              {[
                "Answers grounded in your actual handbook",
                "Policy gap detection against federal and state law",
                "Draft policy language ready to implement",
                "Full handbook audit in one click",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{point}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — HR mock */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">

            {/* Question */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Ask a question</p>
              <p className="text-xs text-gray-800 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-3">An employee just told me he needs 12 weeks off to care for an ill parent. What does our handbook say about this and what are we required to provide under FMLA?</p>
              <div className="mt-3">
                <span className="bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg inline-block">Get answer from handbook →</span>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">

              {/* Answer */}
              <div className="border-l-4 border-gray-300 pl-3 py-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Answer from your handbook</p>
                <p className="text-xs text-gray-700 leading-relaxed">According to your handbook (Section 7.1), your company offers up to 8 weeks of unpaid leave per calendar year for qualifying family and medical reasons.</p>
                <p className="text-xs text-gray-400 leading-relaxed filter blur-[2px] select-none mt-1">However, your handbook explicitly states that federal FMLA does not apply to your company because you have 42 employees. Therefore, you are NOT federally required to provide FMLA leave.</p>
              </div>

              {/* Policy gaps */}
              <div className="border-l-4 border-amber-500 pl-3 py-1">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">⚠️ Policy gaps detected</p>
                <div className="space-y-1">
                  {[
                    "No policy covering care for parents or other family members",
                    "No guidance on leave requests that exceed the 8-week maximum",
                    "No state-specific family leave considerations",
                  ].map((gap, i) => (
                    <p key={i} className="text-xs text-gray-400 filter blur-[2px] select-none">• {gap}</p>
                  ))}
                </div>
              </div>

              {/* Draft policy */}
              <div className="border-l-4 border-green-500 pl-3 py-1">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">📝 Draft policy suggestion</p>
                <p className="text-xs text-gray-400 leading-relaxed filter blur-[2px] select-none">Extended Family Care Leave: Employees may request unpaid leave to care for a parent, grandparent, sibling, or other immediate family member with a serious health condition.</p>
                <p className="text-xs text-green-600 mt-1.5">↓ Download draft policy</p>
              </div>

            </div>
          </div>

        </div>
      </section>



      {/* WORKSPACE + PRICING — combined closing section */}
      <section className="py-24 px-6 bg-green-700">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-3xl font-bold text-white">Your Complete Compliance Workspace</p>
            <p className="text-green-100 mt-3 text-sm">Everything your business needs to stay compliant — in one place.</p>
          </div>

          <div className="grid grid-cols-2 gap-12 items-stretch">

            {/* Left — Pricing */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-6">Simple, honest pricing</p>

              <div className="mb-6">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-2xl text-gray-300 line-through font-medium">$49</span>
                  <span className="text-xs text-gray-400 mb-1">/month</span>
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-6xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-400 mb-2">/month</span>
                </div>
                <p className="text-xs text-green-700 font-medium">Early adopter price — locked forever</p>
              </div>

              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited compliance checklists with micro-steps",
                  "Document storage, audit and gap analysis",
                  "Deadline tracking and calendar alerts",
                  "HR handbook questions and policy drafts",
                  "Monthly regulation change summaries",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500 flex-shrink-0">✓</span>{feature}
                  </li>
                ))}
              </ul>

              <a href="/signup"
                className="block w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors text-center mb-3">
                Start your 14-day free trial →
              </a>
              <p className="text-xs text-gray-400 text-center">No credit card needed · Cancel anytime</p>
            </div>

            {/* Right — Dashboard mock */}
            <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col justify-center">
              {/* Top row — 3 cards */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { icon: '📋', title: 'Compliance Checklist', desc: 'Ask anything about regulations and get a step-by-step checklist' },
                  { icon: '👥', title: 'HR Help', desc: 'Get answers to HR and policy questions from your company handbook' },
                  { icon: '📁', title: 'Company Documents', desc: 'Upload, view and manage your compliance documents and checklists' },
                ].map((module, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-3xl mb-3">{module.icon}</p>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{module.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{module.desc}</p>
                  </div>
                ))}
              </div>
              {/* Bottom row — 2 cards */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: '📅', title: 'Calendar', desc: 'Track all your compliance deadlines and recurring dates' },
                  { icon: '⚙️', title: 'My Account', desc: 'Manage your profile, billing, and account settings' },
                ].map((module, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-3xl mb-3">{module.icon}</p>
                    <p className="text-sm font-semibold text-gray-900 mb-1">{module.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{module.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
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

'use client'

import { useState, useEffect, useRef } from 'react'

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
  name: string
  description: string
  why?: string
  required_by?: string
  recommended_by?: string
  source_url?: string
  cost_note?: string
  providers?: Provider[]
}

interface WhyNot {
  question: string
  answer: string
}

interface ChecklistData {
  title: string
  safety_alert?: string
  must_do: ChecklistItem[]
  good_to_have: ChecklistItem[]
  why_not?: WhyNot[]
  follow_up_questions?: string[]
}

const EXAMPLE_QUESTIONS = [
  "Ask anything about compliance, regulations or HR",
  "What permits do I need to operate my facility?",
  "How do I stay compliant with waste disposal rules?",
  "What safety training is required for my employees?",
  "How do I prepare for a regulatory inspection?",
  "What do I need for a quality certification?",
]

export default function Home() {
  const [question, setQuestion] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [data, setData] = useState<ChecklistData | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [chipIndex, setChipIndex] = useState(0)
  const [chipVisible, setChipVisible] = useState(true)
  const [whyNotOpen, setWhyNotOpen] = useState(false)
  const [askedQuestion, setAskedQuestion] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function toggleCheck(key: string) {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handlePrint() {
    window.print()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setUploadedFile(file)
  }

  function removeFile() {
    setUploadedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!question.trim() && !uploadedFile) return
    setLoading(true)
    setData(null)
    setChecked({})
    setCompletedSteps([])
    setWhyNotOpen(false)
    setAskedQuestion(question)
    const messages = getStatusMessages(question)
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
        formData.append('question', question)
        res = await fetch('/api/chat', {
          method: 'POST',
          body: formData,
        })
      } else {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        })
      }

      const json = await res.json()
      setData(json.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setCurrentStatus('')
      setCompletedSteps([])
    }
  }

  const doneCount = Object.values(checked).filter(Boolean).length
  const totalMust = data?.must_do?.length || 0

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          main { padding: 0 !important; }
          .print-container {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            padding: 20px !important;
          }
          .print-header {
            display: flex !important;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #166534;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
        }
        .print-only { display: none; }
      `}</style>

      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="print-container bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-2xl p-8">

          <div className="print-only print-header">
            <div>
              <h1 style={{fontSize:'20px', fontWeight:'bold', color:'#166534'}}>CompliBoard</h1>
              <p style={{fontSize:'12px', color:'#6b7280'}}>Compliance Report</p>
              {companyName && (
                <p style={{fontSize:'13px', fontWeight:'600', color:'#111827', marginTop:'4px'}}>{companyName}</p>
              )}
            </div>
            <div style={{textAlign:'right', fontSize:'11px', color:'#6b7280'}}>
              <p>Generated: {new Date().toLocaleDateString()}</p>
              <p style={{marginTop:'4px', fontStyle:'italic', maxWidth:'300px'}}>{askedQuestion}</p>
            </div>
          </div>

          <div className="no-print mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">CompliBoard</h1>
            <p className="text-gray-500 text-sm">Ask any compliance question in plain English</p>
          </div>

          <div className="no-print mb-3">
            <input
              type="text"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50 mb-2"
              placeholder="Your company name (optional — appears on PDF)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <textarea
              className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-gray-50"
              rows={4}
              placeholder="e.g. What permits do I need to open a hazmat warehouse in Texas?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div className="no-print mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            {!uploadedFile ? (
              <label
                htmlFor="file-upload"
                className="flex items-center gap-2 w-full border border-dashed border-gray-300 rounded-xl px-4 py-3 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
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
                  <p className="text-xs text-green-600">Ready to analyse — ask any question about this file below</p>
                </div>
                <button
                  onClick={removeFile}
                  className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none flex-shrink-0">
                  ×
                </button>
              </div>
            )}
            {uploadedFile && (
              <p className="text-xs text-gray-400 mt-2 pl-1">
                💡 Try asking: &quot;What corrective actions do I need?&quot; or &quot;Am I missing anything?&quot; or &quot;What are my biggest risks?&quot;
              </p>
            )}
          </div>

          <div className="no-print mb-5 flex items-center gap-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium whitespace-nowrap">Example</p>
            <button
              onClick={() => setQuestion(EXAMPLE_QUESTIONS[chipIndex])}
              style={{ opacity: chipVisible ? 1 : 0, transition: 'opacity 0.4s ease' }}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors text-left">
              {EXAMPLE_QUESTIONS[chipIndex]}
            </button>
          </div>

          <div className="no-print">
            <button onClick={handleSubmit} disabled={loading || (!question.trim() && !uploadedFile)}
              className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {loading ? 'Working...' : uploadedFile ? 'Analyse my document →' : 'Get my compliance checklist →'}
            </button>
          </div>

          {loading && (
            <div className="no-print mt-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
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
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-1">Safety first</p>
                    <p className="text-sm text-red-600">{data.safety_alert}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-4 mb-1">
                <h2 className="text-base font-semibold text-gray-900">{data.title}</h2>
                <button
                  onClick={handlePrint}
                  className="no-print flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors whitespace-nowrap flex-shrink-0">
                  ⬇ Download PDF
                </button>
              </div>

              {totalMust > 0 && (
                <div className="no-print mb-4 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(doneCount / totalMust) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{doneCount} of {totalMust} done</span>
                </div>
              )}

              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-green-700">✅ Must Do</span>
                  <div className="flex-1 h-px bg-green-100"></div>
                </div>
                <div className="space-y-3">
                  {data.must_do?.map((item, i) => (
                    <div key={i}
                      onClick={() => toggleCheck(`must-${i}`)}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked[`must-${i}`] ? 'opacity-50 bg-gray-50 border-gray-100' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked[`must-${i}`] ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                        {checked[`must-${i}`] && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                        {item.why && <p className="text-xs text-gray-400 mt-1 italic">{item.why}</p>}
                        {item.cost_note && <p className="text-xs text-amber-600 mt-1">💰 {item.cost_note}</p>}
                        {item.required_by && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <p className="text-xs text-gray-400">Required by: {item.required_by}</p>
                            {item.source_url && (
                              <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="no-print text-xs text-green-600 hover:text-green-800 underline ml-1">
                                ↗ View source
                              </a>
                            )}
                          </div>
                        )}
                        {item.providers && item.providers.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
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
                    </div>
                  ))}
                </div>
              </div>

              {data.good_to_have?.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-600">💡 Good to Have</span>
                    <div className="flex-1 h-px bg-blue-100"></div>
                  </div>
                  <div className="space-y-3">
                    {data.good_to_have?.map((item, i) => (
                      <div key={i}
                        onClick={() => toggleCheck(`nice-${i}`)}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked[`nice-${i}`] ? 'opacity-50 bg-gray-50 border-gray-100' : 'bg-gray-50 border-gray-200 hover:border-blue-300'}`}>
                        <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked[`nice-${i}`] ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                          {checked[`nice-${i}`] && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
                          {item.why && <p className="text-xs text-gray-400 mt-1 italic">{item.why}</p>}
                          {item.recommended_by && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <p className="text-xs text-gray-400">Recommended by: {item.recommended_by}</p>
                              {item.source_url && (
                                <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="no-print text-xs text-blue-500 hover:text-blue-700 underline ml-1">
                                  ↗ View source
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.why_not && data.why_not.length > 0 && (
                <div className="no-print mt-8">
                  <button
                    onClick={() => setWhyNotOpen(!whyNotOpen)}
                    className="flex items-center gap-2 w-full">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">❓ Common Questions</span>
                    <div className="flex-1 h-px bg-gray-100"></div>
                    <span className="text-xs text-gray-400">{whyNotOpen ? '▲' : '▼'}</span>
                  </button>
                  {whyNotOpen && (
                    <div className="mt-3 space-y-3">
                      {data.why_not.map((item, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <p className="text-sm font-semibold text-gray-700 mb-1">{item.question}</p>
                          <p className="text-sm text-gray-500">{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {data.follow_up_questions && data.follow_up_questions.length > 0 && (
                <div className="no-print mt-6">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">Refine your answer</p>
                  <div className="space-y-2">
                    {data.follow_up_questions.map((q, i) => (
                      <button key={i}
                        onClick={() => setQuestion(q)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                        → {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
                This checklist is for informational purposes only and is not legal advice. Always verify requirements with the relevant agencies.
              </p>
            </div>
          )}

        </div>
      </main>
    </>
  )
}

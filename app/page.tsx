'use client'

import { useState } from 'react'

const STATUS_MESSAGES: Record<string, string[]> = {
  hazmat: ["Reading your company profile...","Searching EPA hazmat regulations...","Checking OSHA requirements...","Reading DOT guidelines...","Sorting must-do from good-to-have...","Building your checklist..."],
  food: ["Reading your company profile...","Searching FDA food safety regulations...","Checking state health requirements...","Reading FSMA guidelines...","Sorting must-do from good-to-have...","Building your checklist..."],
  waste: ["Reading your company profile...","Searching EPA waste regulations...","Checking state environmental rules...","Reading RCRA guidelines...","Sorting must-do from good-to-have...","Building your checklist..."],
  shipping: ["Reading your company profile...","Searching DOT transport regulations...","Checking PHMSA requirements...","Reading 49 CFR guidelines...","Sorting must-do from good-to-have...","Building your checklist..."],
  hr: ["Reading your company profile...","Checking employment law...","Reading FLSA and FMLA guidelines...","Reviewing state labor regulations...","Sorting must-do from good-to-have...","Building your checklist..."],
  iso: ["Reading your company profile...","Searching certification requirements...","Checking ISO standards...","Reading audit guidelines...","Sorting must-do from good-to-have...","Building your checklist..."],
  default: ["Reading your company profile...","Searching federal regulations...","Checking state requirements...","Reading relevant guidelines...","Sorting must-do from good-to-have...","Building your checklist..."]
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

interface ChecklistItem {
  name: string
  description: string
  required_by?: string
  recommended_by?: string
}

interface ChecklistData {
  title: string
  must_do: ChecklistItem[]
  good_to_have: ChecklistItem[]
}

export default function Home() {
  const [question, setQuestion] = useState('')
  const [data, setData] = useState<ChecklistData | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  function toggleCheck(key: string) {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSubmit() {
    if (!question.trim()) return
    setLoading(true)
    setData(null)
    setChecked({})
    setCompletedSteps([])
    const messages = getStatusMessages(question)
    const delays = [0, 800, 1800, 2800, 3600, 4400]
    messages.forEach((msg, i) => {
      setTimeout(() => {
        setCurrentStatus(msg)
        if (i > 0) setCompletedSteps(prev => [...prev, messages[i - 1]])
      }, delays[i])
    })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
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

  const chips = [
    "What permits do I need for HF storage in Oregon?",
    "How do I legally dispose of hazardous waste?",
    "Shipping requirements for hazmat by road",
    "Help me prepare for ISO 9001 certification",
    "What OSHA training do my employees need?",
  ]

  const doneCount = Object.values(checked).filter(Boolean).length
  const totalMust = data?.must_do?.length || 0

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-2xl p-8">

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">CompliBoard</h1>
          <p className="text-gray-500 text-sm">Ask any compliance question in plain English</p>
        </div>

        <div className="mb-3">
          <textarea
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-gray-50"
            rows={4}
            placeholder="e.g. What permits do I need to open a hazmat warehouse in Texas?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {chips.map((chip) => (
            <button key={chip} onClick={() => setQuestion(chip)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
              {chip}
            </button>
          ))}
        </div>

        <button onClick={handleSubmit} disabled={loading}
          className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
          {loading ? 'Working...' : 'Get my compliance checklist →'}
        </button>

        {loading && (
          <div className="mt-6 p-5 bg-gray-50 rounded-xl border border-gray-200">
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
            <h2 className="text-base font-semibold text-gray-900 mb-1">{data.title}</h2>

            {totalMust > 0 && (
              <div className="mb-2 flex items-center gap-2">
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
                      {item.required_by && (
                        <p className="text-xs text-gray-400 mt-1">Required by: {item.required_by}</p>
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
                        {item.recommended_by && (
                          <p className="text-xs text-gray-400 mt-1">Recommended by: {item.recommended_by}</p>
                        )}
                      </div>
                    </div>
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
  )
}

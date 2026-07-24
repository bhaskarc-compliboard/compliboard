'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'

interface LineItem {
  requirement: string
  category: string | null
  prior_answer_context: string | null
  status: 'satisfied' | 'needs_info' | 'needs_work'
  matched_documents: { document_id: string; document_name: string }[]
  note: string
  fix: string | null
}

interface Audit {
  id: string
  source_type: string
  source_name: string
  line_items: LineItem[]
  readiness_satisfied: number
  readiness_needs_info: number
  readiness_needs_work: number
  created_at: string
}

type AuditResponse =
  | { type: 'question'; answer: string }
  | { type: 'needs_clarification'; clarifying_question: string }
  | Audit

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  satisfied: { label: 'Satisfied', dot: 'bg-green-500', text: 'text-green-700' },
  needs_info: { label: 'Needs a closer look', dot: 'bg-amber-400', text: 'text-amber-700' },
  needs_work: { label: 'Needs work', dot: 'bg-gray-400', text: 'text-gray-600' },
}

export default function AuditsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')

  const [question, setQuestion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AuditResponse | null>(null)

  const [pastAudits, setPastAudits] = useState<Audit[]>([])
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [rerunning, setRerunning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: company } = await supabase.from('companies').select('name, industry').eq('id', profile.company_id).single()
      if (company) { setCompanyName(company.name); setIndustry(company.industry || '') }

      await loadPastAudits(profile.company_id)
    }
    loadData()
  }, [])

  async function loadPastAudits(compId: string) {
    try {
      const res = await fetch(`/api/audits?company_id=${compId}`)
      const json = await res.json()
      setPastAudits(json.data || [])
    } catch (err) {
      console.error('Failed to load past audits:', err)
    }
  }

  function isFullAudit(r: AuditResponse): r is Audit {
    return 'id' in r
  }

  async function handleSubmit(overrideQuestion?: string) {
    const q = overrideQuestion ?? question
    if (!q.trim() && !file) return
    if (!companyId || !userId) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('question', q)
      if (file) formData.append('file', file)
      formData.append('company_id', companyId)
      formData.append('user_id', userId)
      formData.append('company_name', companyName)
      formData.append('industry', industry)

      const res = await fetch('/api/audits', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong')

      setResult(json.data)
      if (isFullAudit(json.data) && companyId) await loadPastAudits(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleBuildFullChecklist() {
    handleSubmit(`${question} — please run this as a full audit-ready checklist against this standard, not just an explanation.`)
  }

  async function handleRerun(audit: Audit) {
    if (!companyId || !userId) return
    setRerunning(audit.id)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('rerun_audit_id', audit.id)
      formData.append('company_id', companyId)
      formData.append('user_id', userId)
      formData.append('industry', industry)

      const res = await fetch('/api/audits', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Re-run failed')

      setResult(json.data)
      await loadPastAudits(companyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-run failed')
    } finally {
      setRerunning(null)
    }
  }

  async function handleDeleteAudit(id: string) {
    if (!confirm('Delete this audit report?')) return
    setDeleting(id)
    await fetch(`/api/audits?id=${id}`, { method: 'DELETE' })
    setPastAudits(prev => prev.filter(a => a.id !== id))
    if (result && isFullAudit(result) && result.id === id) setResult(null)
    setDeleting(null)
  }

  function toggleCategory(cat: string) {
    setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  function downloadPDF() {
    window.print()
  }

  const grouped = (result && isFullAudit(result))
    ? result.line_items.reduce<Record<string, LineItem[]>>((acc, li) => {
        const cat = li.category || 'Other'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(li)
        return acc
      }, {})
    : {}

  return (
    <AppLayout
      title="Audits"
      didYouKnow={{
        icon: '🛡️',
        text: 'Ask to be audited against a named standard, a template someone handed you, or a findings report — CompliBoard reads your real documents and never marks something satisfied without genuine evidence. A gap is safer than a false green.',
      }}
    >
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Audits</h1>
          <p className="text-sm text-gray-400">Ask to be audited against a standard, a template, or a findings report</p>
        </div>

        {pastAudits.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Past Audits</p>
            </div>
            <div className="divide-y divide-gray-50">
              {pastAudits.map(a => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setResult(a)}>
                    <p className="text-sm font-medium text-gray-900 truncate">{a.source_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString()} · {a.readiness_satisfied} satisfied · {a.readiness_needs_info} need a closer look · {a.readiness_needs_work} need work
                    </p>
                  </div>
                  <button onClick={() => handleRerun(a)} disabled={rerunning === a.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-50">
                    {rerunning === a.id ? 'Re-running...' : 'Re-run'}
                  </button>
                  <button onClick={() => handleDeleteAudit(a.id)} disabled={deleting === a.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50">
                    {deleting === a.id ? '...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl p-5 mb-6">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='e.g. "Audit us against ISO 9001", "Check us against this template", or "Tell me about SQF requirements"'
            className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white"
            rows={3}
          />
          <div className="flex items-center justify-between mt-3">
            <div>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" id="audit-file"
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {!file ? (
                <label htmlFor="audit-file" className="text-xs text-gray-400 hover:text-green-700 cursor-pointer transition-colors">
                  📎 Attach a template, findings report, or any document to check
                </label>
              ) : (
                <div className="flex items-center gap-2 text-xs text-green-700">
                  <span>📎 {file.name}</span>
                  <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-gray-400 hover:text-red-500">×</button>
                </div>
              )}
            </div>
            <button onClick={() => handleSubmit()} disabled={loading || (!question.trim() && !file)}
              className="bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {loading ? 'Working...' : 'Run audit →'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 text-center">
            <p className="text-sm text-gray-600">Reading your documents and checking each requirement carefully.</p>
            <p className="text-xs text-gray-400 mt-1">A new standard or a long template can take several minutes — this is thorough, not stuck.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {result && !isFullAudit(result) && result.type === 'question' && (
          <div className="bg-white rounded-xl p-5 mb-6">
            <p className="text-sm text-gray-700 leading-relaxed">{result.answer}</p>
            <button onClick={handleBuildFullChecklist} disabled={loading}
              className="mt-4 text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-50">
              Build the full audit-ready checklist for this →
            </button>
          </div>
        )}

        {result && !isFullAudit(result) && result.type === 'needs_clarification' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <p className="text-sm text-amber-900">{result.clarifying_question}</p>
          </div>
        )}

        {result && isFullAudit(result) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{result.source_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(result.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={downloadPDF} className="no-print text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                ↓ Download PDF
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-xl px-5 py-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">Satisfied</p>
                <p className="text-2xl font-semibold text-gray-700">{result.readiness_satisfied}</p>
              </div>
              <div className="bg-white rounded-xl px-5 py-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">Needs a closer look</p>
                <p className="text-2xl font-semibold text-gray-700">{result.readiness_needs_info}</p>
              </div>
              <div className="bg-white rounded-xl px-5 py-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1.5">Needs work</p>
                <p className="text-2xl font-semibold text-gray-700">{result.readiness_needs_work}</p>
              </div>
            </div>

            <AIDisclaimer variant="short" className="mb-4" />

            <div className="space-y-3">
              {Object.entries(grouped).map(([category, items]) => {
                const isOpen = !!openCategories[category]
                const needsWorkInCategory = items.filter(i => i.status === 'needs_work').length
                return (
                  <div key={category} className="bg-white rounded-xl overflow-hidden">
                    <button onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                      <span className="text-gray-300 text-xs flex-shrink-0">{isOpen ? '▼' : '▶'}</span>
                      <span className="text-sm font-bold uppercase tracking-wide text-gray-900">{category}</span>
                      <span className="text-xs text-gray-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      {needsWorkInCategory > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {needsWorkInCategory} need{needsWorkInCategory === 1 ? 's' : ''} work
                        </span>
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                        {items.map((li, i) => {
                          const style = STATUS_STYLES[li.status] || STATUS_STYLES.needs_work
                          return (
                            <div key={i} className="bg-gray-50 rounded-xl p-4">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
                              </div>
                              <p className="text-sm font-medium text-gray-900">{li.requirement}</p>
                              {li.matched_documents.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  📄 {li.matched_documents.map(d => d.document_name).join(', ')}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1.5">{li.note}</p>
                              {li.fix && (
                                <p className="text-xs text-green-700 mt-1.5"><span className="font-medium">Fix:</span> {li.fix}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!result && !loading && pastAudits.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center">
            <p className="text-4xl mb-4">🛡️</p>
            <p className="text-base font-medium text-gray-700 mb-1">No audits yet</p>
            <p className="text-sm text-gray-400">Ask above to check yourself against a standard, a template, or a findings report.</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

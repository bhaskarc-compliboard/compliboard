'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'

interface Handbook {
  id: string
  name: string
  file_url: string
  uploaded_at: string
}

interface HRResponse {
  answer: string
  gaps: string[]
  draft_policy: string | null
  disclaimer: string
}

export default function HRPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [handbooks, setHandbooks] = useState<Handbook[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState<HRResponse | null>(null)
  const [asking, setAsking] = useState(false)
  const [uploadingHandbook, setUploadingHandbook] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [tab, setTab] = useState<'ask' | 'audit' | 'saved'>('ask')
  const [resultTab, setResultTab] = useState<'audit' | 'saved'>('audit')
  const [auditing, setAuditing] = useState(false)
  const [auditResults, setAuditResults] = useState<{missing: string[], present: string[], draft_policies?: {section: string, draft: string}[]} | null>(null)
  const [selectedHandbookId, setSelectedHandbookId] = useState<string | null>(null)
  const [savedAudits, setSavedAudits] = useState<{id: string, handbook_name: string, present: string[], missing: string[], draft_policies: {section: string, draft: string}[], created_at: string}[]>([])

  async function loadSavedAudits(compId: string) {
    try {
      const res = await fetch(`/api/hr-audits?company_id=${compId}`)
      const json = await res.json()
      setSavedAudits(json.data || [])
    } catch (err) {
      console.error('Failed to load saved audits:', err)
    }
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (!profile?.company_id) { setLoading(false); return }
      setCompanyId(profile.company_id)
      loadSavedAudits(profile.company_id)
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single()
      if (company) setCompanyName(company.name)
      const res = await fetch(`/api/documents?user_id=${user.id}`)
      const json = await res.json()
      if (json.data) {
        const hbs = json.data.filter((d: Handbook & {category: string}) => d.file_url && d.file_url.includes('hr-handbooks'))
        setHandbooks(hbs)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleUploadHandbook() {
    if (!newFile || !companyId || !userId) return
    setUploadingHandbook(true)
    setUploadError('')
    try {
      const fileName = `${Date.now()}-${newFile.name}`
      const filePath = `${companyId}/hr-handbooks/${fileName}`
      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, newFile)
      if (uploadError) throw uploadError
      const dbRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id: userId,
          name: newFile.name,
          file_url: filePath,
          file_type: newFile.type || 'application/pdf',
          file_size: newFile.size,
          category: 'hr-handbooks',
          is_recurring: false,
          recurrence_period: null,
        }),
      })
      if (!dbRes.ok) throw new Error('Failed to save')
      const docsRes = await fetch(`/api/documents?user_id=${userId}`)
      const docsJson = await docsRes.json()
      if (docsJson.data) {
        setHandbooks(docsJson.data.filter((d: Handbook & {category: string}) => d.file_url && d.file_url.includes('hr-handbooks')))
      }
      setNewFile(null)
      setShowUpload(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingHandbook(false)
    }
  }

  async function handleAskQuestion() {
    if (!question.trim() || handbooks.length === 0) return
    setAsking(true)
    setResponse(null)
    try {
      const res = await fetch('/api/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          handbooks: handbooks.map(h => ({ file_url: h.file_url, name: h.name })),
          company_name: companyName,
          mode: 'ask',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResponse(json.data)
    } catch (err) {
      console.error(err)
      setResponse({
        answer: 'Unable to process your question. Please try again.',
        gaps: [],
        draft_policy: null,
        disclaimer: 'Answers are based on your company handbook.'
      })
    } finally {
      setAsking(false)
    }
  }

  async function handleAudit() {
    if (handbooks.length === 0) return
    const targetHandbook = handbooks.find(h => h.id === selectedHandbookId) || handbooks[0]
    setAuditing(true)
    setResultTab('audit')
    setAuditResults(null)
    try {
      const res = await fetch('/api/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: targetHandbook.file_url,
          company_name: companyName,
          mode: 'audit',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAuditResults(json.data)

      if (companyId && userId) {
        try {
          await fetch('/api/hr-audits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              userId,
              handbookName: targetHandbook.name,
              handbookFileUrl: targetHandbook.file_url,
              present: json.data.present || [],
              missing: json.data.missing || [],
              draftPolicies: json.data.draft_policies || [],
            }),
          })
          await loadSavedAudits(companyId)
        } catch (saveErr) {
          console.error('Failed to save audit:', saveErr)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAuditing(false)
    }
  }

  function downloadDraftPolicy(policy: string, topic: string) {
    const blob = new Blob([
      `${companyName} - Draft HR Policy\n`,
      `Topic: ${topic}\n`,
      `Generated: ${new Date().toLocaleDateString()}\n\n`,
      `DISCLAIMER: This is a draft policy generated by CompliBoard. Review with qualified HR counsel before implementing.\n\n---\n\n`,
      policy
    ], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `draft-policy-${topic.toLowerCase().replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AppLayout title="HR Help">
      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">HR Help</h1>
          <p className="text-sm text-gray-400">Get answers from your company handbook and identify policy gaps</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : (
        <div>

        <div className="flex items-center gap-6 mb-5 border-b border-gray-200">
          <button onClick={() => setTab('ask')}
            className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${tab === 'ask' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Ask a question
          </button>
          <button onClick={() => setTab('audit')}
            className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${tab === 'audit' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Audit handbook
          </button>
          <button onClick={() => setTab('saved')}
            className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${tab === 'saved' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Saved{savedAudits.length > 0 ? ` (${savedAudits.length})` : ''}
          </button>
        </div>

        {tab === 'ask' && (
        <div>
          {handbooks.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-sm text-gray-500 mb-3">Upload a handbook first to ask questions about it.</p>
              <button onClick={() => setTab('audit')}
                className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors">
                Go to Audit handbook →
              </button>
            </div>
          ) : (
          <div>
            <div className="mb-3 relative">
              <textarea
                className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white"
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              {!question && (
                <div className="absolute inset-0 p-4 pointer-events-none flex flex-col gap-3">
                  <p className="text-sm text-gray-400">e.g. What is our policy on parental leave?</p>
                  <p className="text-sm text-gray-400">e.g. How many sick days do employees get?</p>
                  <p className="text-sm text-gray-400">e.g. What is the disciplinary process?</p>
                </div>
              )}
            </div>
            <button onClick={handleAskQuestion} disabled={asking}
              className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {asking ? 'Checking your handbook...' : 'Get answer from handbook →'}
            </button>

            {asking && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="animate-spin inline-block">⟳</span>
                  Reading your handbook...
                </p>
              </div>
            )}

            {response && !asking && (
              <div className="mt-6 space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-gray-400 p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Answer from your handbook</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{response.answer}</p>
                </div>

                {response.gaps && response.gaps.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-amber-500 p-5 shadow-sm">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">⚠️ Policy gaps detected</p>
                    <ul className="space-y-1">
                      {response.gaps.map((gap, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="mt-1 flex-shrink-0">•</span>{gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {response.draft_policy && (
                  <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-green-500 p-5 shadow-sm">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">📝 Draft policy suggestion</p>
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{response.draft_policy?.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</p>
                    <button
                      onClick={() => downloadDraftPolicy(response.draft_policy!, question)}
                      className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors">
                      ↓ Download draft policy
                    </button>
                  </div>
                )}

                <AIDisclaimer variant="short" className="mt-1" />
              </div>
            )}
          </div>
          )}
        </div>
        )}

        {tab === 'audit' && (
        <div>

          {handbooks.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Run a full audit of your handbook to see which required policy sections are present and which are missing.
            </p>
            {handbooks.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Which handbook?</label>
                <select
                  value={selectedHandbookId || handbooks[0]?.id || ''}
                  onChange={(e) => setSelectedHandbookId(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-white">
                  {handbooks.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button onClick={handleAudit} disabled={auditing}
              className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {auditing ? 'Auditing your handbook...' : 'Run handbook audit →'}
            </button>

            {auditing && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <span className="animate-spin inline-block">⟳</span>
                  Reviewing your handbook...
                </p>
              </div>
            )}

            {auditResults && !auditing && resultTab === 'audit' && (
              <div className="mt-6 space-y-4">
                {auditResults.missing && auditResults.missing.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-400 p-5 shadow-sm">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">❌ Missing sections ({auditResults.missing.length})</p>
                    <ul className="space-y-2">
                      {auditResults.missing.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="mt-1 flex-shrink-0">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {auditResults.present && auditResults.present.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-green-500 p-5 shadow-sm">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">✓ Present sections ({auditResults.present.length})</p>
                    <ul className="space-y-2">
                      {auditResults.present.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="mt-1 flex-shrink-0">✓</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {auditResults.draft_policies && auditResults.draft_policies.length > 0 && (
                  <div className="space-y-3">
                    {auditResults.draft_policies.map((dp, i) => (
                      <div key={i} className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-green-500 p-5 shadow-sm">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">📝 Draft policy — {dp.section}</p>
                        <p className="text-sm text-gray-700 leading-relaxed mb-4">{dp.draft?.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</p>
                        <button
                          onClick={() => downloadDraftPolicy(dp.draft, dp.section)}
                          className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors">
                          ↓ Download draft policy
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <AIDisclaimer variant="short" className="mt-1" />
              </div>
            )}
          </div>
          )}

          <div className={handbooks.length > 0 ? "mt-8 pt-8 border-t border-gray-100" : ""}>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your handbooks</p>
            {handbooks.length > 0 && (
              <button onClick={() => setShowUpload(!showUpload)}
                className="text-xs text-green-700 hover:text-green-800 font-medium">
                {showUpload ? '× Cancel' : '+ Add handbook'}
              </button>
            )}
          </div>

          {handbooks.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden mb-4">
              <div className="divide-y divide-gray-50">
                {handbooks.map(h => (
                  <div key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <span>📋</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 break-words">{h.name}</p>
                      <p className="text-xs text-gray-400">{new Date(h.uploaded_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={async () => {
                      if (!confirm('Delete this handbook?')) return
                      await fetch('/api/documents?id=' + h.id + '&file_url=' + encodeURIComponent(h.file_url), { method: 'DELETE' })
                      setHandbooks(prev => prev.filter(x => x.id !== h.id))
                    }} className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(showUpload || handbooks.length === 0) && (
            <div className="mb-6">
              <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" id="handbook-upload"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
              {!newFile ? (
                <label htmlFor="handbook-upload"
                  className="flex items-center gap-3 w-full border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                  <span className="text-xl">📎</span>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Click to select your HR handbook</p>
                    <p className="text-xs text-gray-400">PDF files supported</p>
                  </div>
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mb-3">
                  <span>📋</span>
                  <p className="text-sm font-medium text-green-800 flex-1 truncate">{newFile.name}</p>
                  <button onClick={() => { setNewFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="text-gray-400 hover:text-red-500 text-lg">×</button>
                </div>
              )}
              {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
              <button onClick={handleUploadHandbook} disabled={uploadingHandbook}
                className="mt-3 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                {uploadingHandbook ? 'Uploading...' : 'Upload handbook →'}
              </button>
            </div>
          )}

          </div>

        </div>
        )}

        {tab === 'saved' && (
        <div>
          {savedAudits.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-4xl mb-4">📋</p>
              <p className="text-base font-medium text-gray-700 mb-1">No saved audits yet</p>
              <p className="text-sm text-gray-400">Run a handbook audit and it will be saved here.</p>
            </div>
          ) : (
          <div>
            <div className="bg-white rounded-xl overflow-hidden mb-6">
              <div className="divide-y divide-gray-50">
                {savedAudits.map(a => (
                  <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                      setAuditResults({ present: a.present, missing: a.missing, draft_policies: a.draft_policies })
                      setResultTab('saved')
                    }}>
                      <p className="text-sm font-medium text-gray-900 truncate">{a.handbook_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(a.created_at).toLocaleDateString()} · {a.present.length} present · {a.missing.length} missing
                      </p>
                    </div>
                    <button onClick={async () => {
                      if (!confirm('Delete this saved audit?')) return
                      await fetch('/api/hr-audits?id=' + a.id, { method: 'DELETE' })
                      setSavedAudits(prev => prev.filter(x => x.id !== a.id))
                    }} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {auditResults && resultTab === 'saved' && (
              <div className="space-y-4">
                {auditResults.missing && auditResults.missing.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-400 p-5 shadow-sm">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">❌ Missing sections ({auditResults.missing.length})</p>
                    <ul className="space-y-2">
                      {auditResults.missing.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="mt-1 flex-shrink-0">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {auditResults.present && auditResults.present.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-green-500 p-5 shadow-sm">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">✓ Present sections ({auditResults.present.length})</p>
                    <ul className="space-y-2">
                      {auditResults.present.map((item, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="mt-1 flex-shrink-0">✓</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {auditResults.draft_policies && auditResults.draft_policies.length > 0 && (
                  <div className="space-y-3">
                    {auditResults.draft_policies.map((dp, i) => (
                      <div key={i} className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-green-500 p-5 shadow-sm">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">📝 Draft policy — {dp.section}</p>
                        <p className="text-sm text-gray-700 leading-relaxed mb-4">{dp.draft?.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1")}</p>
                        <button
                          onClick={() => downloadDraftPolicy(dp.draft, dp.section)}
                          className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700 transition-colors">
                          ↓ Download draft policy
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
        )}

        </div>
        )}
      </div>
    </AppLayout>
  )
}

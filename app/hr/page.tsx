'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

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
  const [selectedHandbook, setSelectedHandbook] = useState<string | null>(null)
  const [response, setResponse] = useState<HRResponse | null>(null)
  const [asking, setAsking] = useState(false)
  const [uploadingHandbook, setUploadingHandbook] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [tab, setTab] = useState<'ask' | 'audit'>('ask')
  const [auditing, setAuditing] = useState(false)
  const [auditResults, setAuditResults] = useState<{missing: string[], present: string[]} | null>(null)

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
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single()
      if (company) setCompanyName(company.name)
      const res = await fetch(`/api/documents?user_id=${user.id}`)
      const json = await res.json()
      if (json.data) {
        const hbs = json.data.filter((d: Handbook & {category: string}) => d.category === 'hr-handbooks')
        setHandbooks(hbs)
        if (hbs.length > 0) setSelectedHandbook(hbs[0].id)
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
        const hbs = docsJson.data.filter((d: Handbook & {category: string}) => d.category === 'hr-handbooks')
        setHandbooks(hbs)
        if (hbs.length > 0) setSelectedHandbook(hbs[hbs.length - 1].id)
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

  async function getHandbookContent(handbookId: string): Promise<string> {
    const handbook = handbooks.find(h => h.id === handbookId)
    if (!handbook) return ''
    const { data } = await supabase.storage
      .from('company-documents')
      .download(handbook.file_url)
    if (!data) return ''
    return `[HR Handbook: ${handbook.name}]`
  }

  async function handleAskQuestion() {
    if (!question.trim() || !selectedHandbook) return
    setAsking(true)
    setResponse(null)
    try {
      const handbook = handbooks.find(h => h.id === selectedHandbook)
      if (!handbook) return
      const res = await fetch('/api/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          file_url: handbook.file_url,
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
    if (!selectedHandbook) return
    setAuditing(true)
    setAuditResults(null)
    try {
      const handbook = handbooks.find(h => h.id === selectedHandbook)
      if (!handbook) return
      const res = await fetch('/api/hr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: handbook.file_url,
          company_name: companyName,
          mode: 'audit',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAuditResults(json.data)
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
      `DISCLAIMER: This is a draft policy generated by CompliBoard. Review with qualified HR counsel before implementing.\n\n`,
      `---\n\n`,
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
      <div className="max-w-3xl mx-auto px-6 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">HR Help</h1>
          <p className="text-sm text-gray-400">Get answers from your company handbook and identify policy gaps</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : handbooks.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-base font-medium text-gray-700 mb-1">No HR handbook uploaded yet</p>
            <p className="text-sm text-gray-400 mb-6">Upload your company HR handbook to get started. We will answer HR questions directly from your policies.</p>
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
              Upload handbook
            </button>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your HR Handbooks</p>
                <button onClick={() => setShowUpload(!showUpload)}
                  className="text-xs text-green-700 hover:text-green-800 font-medium">
                  {showUpload ? '× Cancel' : '+ Add handbook'}
                </button>
              </div>
              <div className="space-y-2">
                {handbooks.map(h => (
                  <div key={h.id}
                    onClick={() => setSelectedHandbook(h.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedHandbook === h.id ? 'bg-green-50 border border-green-200' : 'border border-gray-100 hover:bg-gray-50'}`}>
                    <span className="text-lg">📋</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{h.name}</p>
                      <p className="text-xs text-gray-400">{new Date(h.uploaded_at).toLocaleDateString()}</p>
                    </div>
                    {selectedHandbook === h.id && <span className="text-xs text-green-600 font-medium">Active</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 mb-5 border-b border-gray-200 pb-4">
              <button onClick={() => setTab('ask')}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'ask' ? 'bg-green-700 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                Ask a question
              </button>
              <button onClick={() => setTab('audit')}
                className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'audit' ? 'bg-green-700 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                Audit handbook
              </button>
            </div>

            {tab === 'ask' && (
              <div>
                <div className="mb-4">
                  <textarea
                    className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-green-500 bg-white shadow-sm"
                    rows={3}
                    placeholder="e.g. What is our policy on parental leave? How many sick days do employees get? What is the disciplinary process?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </div>
                <button onClick={handleAskQuestion} disabled={asking || !question.trim()}
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
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Answer from your handbook</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{response.answer}</p>
                    </div>

                    {response.gaps && response.gaps.length > 0 && (
                      <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">⚠️ Policy gaps detected</p>
                        <ul className="space-y-1">
                          {response.gaps.map((gap, i) => (
                            <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                              <span className="mt-1 flex-shrink-0">•</span>
                              {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {response.draft_policy && (
                      <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">📝 Draft policy suggestion</p>
                          <button
                            onClick={() => downloadDraftPolicy(response.draft_policy!, question)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                            Download draft
                          </button>
                        </div>
                        <p className="text-sm text-blue-700 leading-relaxed">{response.draft_policy}</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 italic">{response.disclaimer}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'audit' && (
              <div>
                <p className="text-sm text-gray-500 mb-4">
                  Run a full audit of your handbook to see which required policy sections are present and which are missing.
                </p>
                <button onClick={handleAudit} disabled={auditing}
                  className="bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                  {auditing ? 'Auditing your handbook...' : 'Run handbook audit →'}
                </button>

                {auditing && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="animate-spin inline-block">⟳</span>
                      Reviewing your handbook against compliance requirements...
                    </p>
                  </div>
                )}

                {auditResults && !auditing && (
                  <div className="mt-6 space-y-4">
                    {auditResults.missing && auditResults.missing.length > 0 && (
                      <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-3">❌ Missing sections ({auditResults.missing.length})</p>
                        <ul className="space-y-2">
                          {auditResults.missing.map((item, i) => (
                            <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                              <span className="mt-1 flex-shrink-0">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {auditResults.present && auditResults.present.length > 0 && (
                      <div className="bg-green-50 rounded-xl border border-green-200 p-5">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">✓ Present sections ({auditResults.present.length})</p>
                        <ul className="space-y-2">
                          {auditResults.present.map((item, i) => (
                            <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                              <span className="mt-1 flex-shrink-0">✓</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 italic">
                      This audit is based on common HR policy requirements. Always verify with qualified HR counsel for your specific jurisdiction.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showUpload && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Upload HR Handbook</h2>
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" id="handbook-upload"
              onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
            {!newFile ? (
              <label htmlFor="handbook-upload"
                className="flex items-center gap-3 w-full border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                <span className="text-2xl">📎</span>
                <div>
                  <p className="text-sm text-gray-600">Click to select handbook</p>
                  <p className="text-xs text-gray-400">PDF recommended</p>
                </div>
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mb-3">
                <span className="text-xl">📋</span>
                <p className="text-sm font-medium text-green-800 flex-1 truncate">{newFile.name}</p>
                <button onClick={() => { setNewFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="text-gray-400 hover:text-red-500 text-lg">×</button>
              </div>
            )}
            {uploadError && <p className="text-sm text-red-600 mt-2">{uploadError}</p>}
            <button onClick={handleUploadHandbook} disabled={!newFile || uploadingHandbook}
              className="mt-4 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {uploadingHandbook ? 'Uploading...' : 'Upload handbook →'}
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  )
}

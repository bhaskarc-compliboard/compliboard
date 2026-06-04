'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { useRouter } from 'next/navigation'

interface Document {
  id: string
  name: string
  file_url: string
  file_type: string
  file_size: number
  category: string
  is_recurring: boolean
  recurrence_period: string | null
  uploaded_at: string
  regulation_tags: string[]
}

interface SavedChecklist {
  id: string
  question: string
  title: string
  created_at: string
  must_do_count?: number
  completed_count?: number
}

interface RegulationTemplate {
  id: string
  regulation_name: string
  folder_name: string
  what_it_covers: string
  documents_that_belong: string
  renewal_schedule: string
}

const CATEGORY_LABELS: Record<string, string> = {
  'audit-reports': 'Audit Reports',
  'sds-sheets': 'SDS Sheets',
  'inspection-findings': 'Inspection Findings',
  'permits': 'Permits',
  'training-records': 'Training Records',
  'hr-handbooks': 'HR Handbooks',
  'compliance-schedule': 'Compliance Schedule',
  'other': 'Other',
}

const PRESET_CATEGORIES = [
  { value: 'audit-reports', label: 'Audit Reports' },
  { value: 'sds-sheets', label: 'SDS Sheets' },
  { value: 'inspection-findings', label: 'Inspection Findings' },
  { value: 'permits', label: 'Permits' },
  { value: 'training-records', label: 'Training Records' },
  { value: 'hr-handbooks', label: 'HR Handbooks' },
  { value: 'compliance-schedule', label: 'Compliance Schedule (Excel)' },
  { value: 'other', label: 'Other' },
]

const RECURRENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(fileType: string, name: string): string {
  if (name.match(/\.(xlsx|xls|csv)$/i)) return '📊'
  if (fileType.includes('pdf') || name.endsWith('.pdf')) return '📄'
  if (fileType.includes('image')) return '🖼️'
  return '📎'
}

function formatCategory(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ')
}

function getChecklistStatus(completed: number, total: number): { dot: string; label: string } {
  if (total === 0) return { dot: 'bg-gray-300', label: '' }
  if (completed === 0) return { dot: 'bg-red-400', label: 'Not started' }
  if (completed === total) return { dot: 'bg-green-500', label: 'Complete' }
  return { dot: 'bg-amber-400', label: 'In progress' }
}

export default function DocumentsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'checklists' | 'uploaded' | 'regulations'>('checklists')
  const [documents, setDocuments] = useState<Document[]>([])
  const [checklists, setChecklists] = useState<SavedChecklist[]>([])
  const [regulations, setRegulations] = useState<RegulationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedRegulation, setSelectedRegulation] = useState<RegulationTemplate | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePeriod, setRecurrencePeriod] = useState('annually')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

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

      if (profile?.company_id) {
        setCompanyId(profile.company_id)

        const { data: company } = await supabase
          .from('companies')
          .select('industry, state')
          .eq('id', profile.company_id)
          .single()

        if (company) {
          const { data: regs } = await supabase
            .from('regulation_templates')
            .select('id, regulation_name, folder_name, what_it_covers, documents_that_belong, renewal_schedule')
            .eq('industry', company.industry)
            .eq('state', company.state)
            .order('regulation_name')
          if (regs) setRegulations(regs)
        }
      }

      const [docsRes, checklistsData] = await Promise.all([
        fetch(`/api/documents?user_id=${user.id}`),
        supabase
          .from('checklists')
          .select('id, question, title, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ])

      const docsJson = await docsRes.json()
      if (docsJson.data) setDocuments(docsJson.data)

      if (checklistsData.data) {
        const withCounts = await Promise.all(checklistsData.data.map(async (c) => {
          const { count: total } = await supabase
            .from('checklist_items')
            .select('*', { count: 'exact', head: true })
            .eq('checklist_id', c.id)
            .eq('category', 'must_do')
          const { count: completed } = await supabase
            .from('checklist_items')
            .select('*', { count: 'exact', head: true })
            .eq('checklist_id', c.id)
            .eq('category', 'must_do')
            .eq('completed', true)
          return { ...c, must_do_count: total || 0, completed_count: completed || 0 }
        }))
        setChecklists(withCounts)
      }

      setLoading(false)
    }
    loadData()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setUploadError('')
    if (f && f.name.match(/\.(xlsx|xls|csv)$/i)) setCategory('compliance-schedule')
  }

  function getAutoTags(cat: string, fileName: string): string[] {
    const tags: string[] = []
    const name = fileName.toLowerCase()
    if (cat === 'sds-sheets' || name.includes('sds') || name.includes('safety data')) {
      tags.push('OSHA HazCom', 'EPA Tier II')
    }
    if (cat === 'audit-reports' || name.includes('audit') || name.includes('inspection')) {
      tags.push('OSHA HazCom', 'OSHA PSM')
    }
    if (cat === 'permits' || name.includes('permit') || name.includes('license')) {
      tags.push('OSHA HazCom', 'Oregon DEQ')
    }
    if (cat === 'training-records' || name.includes('training')) {
      tags.push('OSHA HazCom', 'OSHA PSM')
    }
    if (cat === 'hr-handbooks' || name.includes('handbook') || name.includes('hr')) {
      tags.push('OSHA HazCom')
    }
    if (name.includes('waste') || name.includes('manifest') || name.includes('disposal')) {
      tags.push('Oregon DEQ', 'WA Ecology')
    }
    if (name.includes('shipping') || name.includes('hazmat') || name.includes('dot')) {
      tags.push('DOT HazMat')
    }
    if (name.includes('rmp') || name.includes('risk management')) {
      tags.push('EPA RMP')
    }
    if (name.includes('tier ii') || name.includes('tier2')) {
      tags.push('EPA Tier II')
    }
    if (name.includes('food') || name.includes('haccp') || name.includes('fsma')) {
      tags.push('FDA Food Safety')
    }
    if (name.includes('olcc') || name.includes('alcohol') || name.includes('cannabis') || name.includes('liquor')) {
      tags.push('OLCC License', 'OLCC Cannabis License')
    }
    return [...new Set(tags)]
  }

  async function handleUpload() {
    if (!file || !companyId || !userId) return
    const finalCategory = category === 'other' ? (customCategory.trim() || 'other') : category
    if (!finalCategory) { setUploadError('Please select a category'); return }

    setUploading(true)
    setUploadError('')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${companyId}/${finalCategory}/${fileName}`

      const { error: uploadErr } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file)
      if (uploadErr) throw uploadErr

      const autoTags = getAutoTags(finalCategory, file.name)

      const dbRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id: userId,
          name: file.name,
          file_url: filePath,
          file_type: file.type || fileExt || 'unknown',
          file_size: file.size,
          category: finalCategory,
          is_recurring: isRecurring,
          recurrence_period: isRecurring ? recurrencePeriod : null,
          regulation_tags: autoTags,
        }),
      })
      if (!dbRes.ok) throw new Error('Failed to save document record')

      const docsRes = await fetch(`/api/documents?user_id=${userId}`)
      const docsJson = await docsRes.json()
      if (docsJson.data) setDocuments(docsJson.data)

      setFile(null)
      setCategory('')
      setCustomCategory('')
      setIsRecurring(false)
      setShowUpload(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteDoc(doc: Document) {
    if (!confirm(`Delete ${doc.name}?`)) return
    setDeleting(doc.id)
    try {
      await fetch(`/api/documents?id=${doc.id}&file_url=${encodeURIComponent(doc.file_url)}`, { method: 'DELETE' })
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
    } catch (error) {
      console.error(error)
    } finally {
      setDeleting(null)
    }
  }

  async function handleDeleteChecklist(id: string, title: string) {
    if (!confirm(`Delete checklist "${title}"?`)) return
    setDeleting(id)
    await supabase.from('checklists').delete().eq('id', id)
    setChecklists(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  async function handleDownload(doc: Document) {
    const { data } = await supabase.storage
      .from('company-documents')
      .createSignedUrl(doc.file_url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function handleUploadClick() {
    setActiveTab('uploaded')
    setShowUpload(true)
    setSelectedRegulation(null)
  }

  const docCategories = Array.from(new Set(documents.map(d => d.category))).sort()
  const filteredDocs = selectedCategory === 'all'
    ? documents
    : documents.filter(d => d.category === selectedCategory)

  const tabs = [
    { key: 'checklists', label: 'Checklists', count: checklists.length },
    { key: 'uploaded', label: 'Uploaded Files', count: documents.length },
    { key: 'regulations', label: 'Regulations', count: regulations.length },
  ] as const

  return (
    <AppLayout title="Company Documents">
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Company Documents</h1>
            <p className="text-sm text-gray-400">Your compliance files, checklists, and regulation folders</p>
          </div>
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
            + Upload file
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedRegulation(null) }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-2 ${
                activeTab === tab.key
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : (
          <>
            {/* CHECKLISTS TAB */}
            {activeTab === 'checklists' && (
              <div>
                {checklists.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <p className="text-4xl mb-4">📋</p>
                    <p className="text-base font-medium text-gray-700 mb-1">No checklists yet</p>
                    <p className="text-sm text-gray-400 mb-6">Go to Compliance Checklist to generate your first one</p>
                    <button onClick={() => router.push('/compliance')}
                      className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                      Go to Compliance Checklist
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-50">
                      {checklists.map((c) => {
                        const status = getChecklistStatus(c.completed_count || 0, c.must_do_count || 0)
                        return (
                          <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                            <span className="text-2xl flex-shrink-0">📋</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                                {status.label && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                                    <span className="text-xs text-gray-400">{status.label}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-gray-400">{c.must_do_count} items</span>
                                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                                <span className="text-xs text-green-600">{c.completed_count}/{c.must_do_count} done</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => router.push(`/compliance?id=${c.id}`)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                                Open
                              </button>
                              <button onClick={() => handleDeleteChecklist(c.id, c.title)}
                                disabled={deleting === c.id}
                                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50">
                                {deleting === c.id ? '...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">
                      {checklists.length} checklist{checklists.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* UPLOADED FILES TAB */}
            {activeTab === 'uploaded' && (
              <div>
                {showUpload && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-gray-900">Upload a file</h2>
                      <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,image/*"
                          onChange={handleFileChange} className="hidden" id="file-upload" />
                        {!file ? (
                          <label htmlFor="file-upload"
                            className="flex items-center gap-3 w-full border border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                            <span className="text-2xl">📎</span>
                            <div>
                              <p className="text-sm text-gray-600">Click to select a file</p>
                              <p className="text-xs text-gray-400">PDF, images, Excel, or CSV</p>
                            </div>
                          </label>
                        ) : (
                          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                            <span className="text-xl">{getFileIcon(file.type, file.name)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-green-800 truncate">{file.name}</p>
                              <p className="text-xs text-green-600">{formatFileSize(file.size)}</p>
                            </div>
                            <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                              className="text-gray-400 hover:text-red-500 text-lg">×</button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-400">*</span></label>
                          <select
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}>
                            <option value="">Select category</option>
                            {PRESET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          {category === 'other' && (
                            <input type="text"
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50 mt-2"
                              placeholder="Enter category name"
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)} />
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Recurring</label>
                          <div className="flex items-center gap-3 mt-2">
                            <div onClick={() => setIsRecurring(!isRecurring)}
                              className={`w-10 h-6 rounded-full cursor-pointer transition-colors relative ${isRecurring ? 'bg-green-600' : 'bg-gray-200'}`}>
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isRecurring ? 'left-5' : 'left-1'}`} />
                            </div>
                            {isRecurring && (
                              <select
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none bg-gray-50"
                                value={recurrencePeriod}
                                onChange={(e) => setRecurrencePeriod(e.target.value)}>
                                {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
                      <button onClick={handleUpload} disabled={!file || !category || uploading}
                        className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                        {uploading ? 'Uploading...' : 'Upload file →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Category filter chips */}
                {documents.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <button onClick={() => setSelectedCategory('all')}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        selectedCategory === 'all'
                          ? 'bg-green-700 text-white border-green-700'
                          : 'border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700'
                      }`}>
                      All files
                    </button>
                    {docCategories.map(cat => (
                      <button key={cat} onClick={() => setSelectedCategory(cat)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          selectedCategory === cat
                            ? 'bg-green-700 text-white border-green-700'
                            : 'border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700'
                        }`}>
                        {formatCategory(cat)}
                      </button>
                    ))}
                  </div>
                )}

                {documents.length === 0 && !showUpload ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <p className="text-4xl mb-4">📁</p>
                    <p className="text-base font-medium text-gray-700 mb-1">No files uploaded yet</p>
                    <p className="text-sm text-gray-400 mb-6">Upload your first compliance document to get started</p>
                    <button onClick={() => setShowUpload(true)}
                      className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                      Upload a file
                    </button>
                  </div>
                ) : filteredDocs.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-50">
                      {filteredDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(doc.file_type, doc.name)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-xs text-gray-500">{formatCategory(doc.category)}</span>
                              <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</span>
                              <span className="text-xs text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                              {doc.is_recurring && <span className="text-xs text-green-600">🔄 {doc.recurrence_period}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => handleDownload(doc)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                              Download
                            </button>
                            <button onClick={() => handleDeleteDoc(doc)} disabled={deleting === doc.id}
                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50">
                              {deleting === doc.id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">
                      {filteredDocs.length} file{filteredDocs.length !== 1 ? 's' : ''} · Stored securely and only accessible by your account
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* REGULATIONS TAB */}
            {activeTab === 'regulations' && (
              <div>
                {selectedRegulation ? (
                  <div>
                    <button onClick={() => setSelectedRegulation(null)}
                      className="flex items-center gap-1 text-sm text-gray-400 hover:text-green-700 transition-colors mb-4">
                      ← Back to all regulations
                    </button>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="text-base font-semibold text-gray-900">{selectedRegulation.regulation_name}</h2>
                          <p className="text-xs text-gray-400 mt-0.5">{selectedRegulation.folder_name}</p>
                        </div>
                        <span className="text-2xl">📂</span>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-xl border-l-4 border-l-gray-300">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What it covers</p>
                          <p className="text-sm text-gray-700">{selectedRegulation.what_it_covers}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border-l-4 border-l-green-400">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Documents that belong here</p>
                          <p className="text-sm text-gray-700">{selectedRegulation.documents_that_belong}</p>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-xl border-l-4 border-l-amber-400">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Renewal &amp; reporting</p>
                          <p className="text-sm text-gray-700">{selectedRegulation.renewal_schedule}</p>
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400 mb-3">Files tagged to this regulation</p>
                        {documents.filter(d => d.regulation_tags?.includes(selectedRegulation.folder_name)).length === 0 ? (
                          <div className="text-center py-6">
                            <p className="text-sm text-gray-400 mb-3">No files tagged to this regulation yet</p>
                            <button onClick={handleUploadClick}
                              className="text-xs px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors">
                              Upload a file
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {documents.filter(d => d.regulation_tags?.includes(selectedRegulation.folder_name)).map(doc => (
                              <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <span>{getFileIcon(doc.file_type, doc.name)}</span>
                                <p className="text-sm text-gray-700 flex-1 truncate">{doc.name}</p>
                                <button onClick={() => handleDownload(doc)}
                                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                                  Download
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {regulations.length === 0 ? (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <p className="text-4xl mb-4">📂</p>
                        <p className="text-base font-medium text-gray-700 mb-1">No regulation folders found</p>
                        <p className="text-sm text-gray-400">Your regulation folders are set up based on your industry and state</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-gray-400 mb-4">
                          {regulations.length} regulation{regulations.length !== 1 ? 's' : ''} applicable to your business · Click any folder to see details and files
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {regulations.map((reg) => {
                            const fileCount = documents.filter(d => d.regulation_tags?.includes(reg.folder_name)).length
                            return (
                              <button key={reg.id} onClick={() => setSelectedRegulation(reg)}
                                className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-400 hover:shadow-md transition-all text-left w-full">
                                <span className="text-2xl flex-shrink-0">📂</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{reg.regulation_name}</p>
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{reg.what_it_covers.substring(0, 80)}...</p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${fileCount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                      {fileCount} file{fileCount !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

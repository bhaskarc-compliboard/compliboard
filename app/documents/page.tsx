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
}

interface SavedChecklist {
  id: string
  question: string
  title: string
  created_at: string
  must_do_count?: number
  completed_count?: number
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

export default function DocumentsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = useState<Document[]>([])
  const [checklists, setChecklists] = useState<SavedChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

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
      if (profile?.company_id) setCompanyId(profile.company_id)

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

      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file)
      if (uploadError) throw uploadError

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

  const docCategories = Array.from(new Set(documents.map(d => d.category))).sort()
  const allCategories = ['all', 'checklists', ...docCategories]

  const showChecklists = selectedCategory === 'all' || selectedCategory === 'checklists'
  const showDocs = selectedCategory === 'all' || (selectedCategory !== 'checklists')
  const filteredDocs = selectedCategory === 'all' || selectedCategory === 'checklists'
    ? documents
    : documents.filter(d => d.category === selectedCategory)

  const totalItems = (showChecklists ? checklists.length : 0) + (showDocs ? filteredDocs.length : 0)

  return (
    <AppLayout title="My Files">
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">My Files</h1>
            <p className="text-sm text-gray-400">Your compliance documents and saved checklists</p>
          </div>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
            {showUpload ? '× Cancel' : '+ Upload file'}
          </button>
        </div>

        {showUpload && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Upload a file</h2>
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
              {uploadError && (
                <p className="text-sm text-red-600">{uploadError}</p>
              )}
              <button onClick={handleUpload} disabled={!file || !category || uploading}
                className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload file →'}
              </button>
            </div>
          </div>
        )}

        {(documents.length > 0 || checklists.length > 0) && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {allCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-green-700 text-white border-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700'
                }`}>
                {cat === 'all' ? 'All files' : cat === 'checklists' ? 'Checklists' : formatCategory(cat)}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">Loading your files...</p>
          </div>
        ) : totalItems === 0 && !showUpload ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <p className="text-4xl mb-4">📁</p>
            <p className="text-base font-medium text-gray-700 mb-1">No files yet</p>
            <p className="text-sm text-gray-400 mb-6">Upload your first compliance document to get started</p>
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
              Upload a file
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {showChecklists && checklists.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <span className="text-2xl flex-shrink-0">📋</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                    <div className="grid grid-cols-4 gap-4 mt-1" style={{maxWidth:'480px'}}>
                      <span className="text-xs text-gray-500">Checklist</span>
                      <span className="text-xs text-gray-400">{c.must_do_count} items</span>
                      <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      <span className="text-xs text-green-600">{c.completed_count}/{c.must_do_count} done</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => router.push('/compliance')}
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
              ))}
              {showDocs && selectedCategory !== 'checklists' && filteredDocs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <span className="text-2xl flex-shrink-0">{getFileIcon(doc.file_type, doc.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <div className="grid grid-cols-4 gap-4 mt-1" style={{maxWidth:'480px'}}>
                      <span className="text-xs text-gray-500 truncate">{formatCategory(doc.category)}</span>
                      <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</span>
                      <span className="text-xs text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                      <span className="text-xs text-green-600">{doc.is_recurring ? '🔄 ' + doc.recurrence_period : ''}</span>
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
          </div>
        )}

        {totalItems > 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">
            {totalItems} item{totalItems !== 1 ? 's' : ''} · Files are stored securely and only accessible by your account
          </p>
        )}

      </div>
    </AppLayout>
  )
}

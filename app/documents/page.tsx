'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { useRouter } from 'next/navigation'
import { INDUSTRY_FOLDERS } from '@/lib/folderTemplates'

interface Document {
  id: string
  name: string
  file_url: string
  file_type: string
  file_size: number
  folder_id: string | null
  is_recurring: boolean
  recurrence_period: string | null
  uploaded_at: string
}

interface Folder {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
}

interface SavedChecklist {
  id: string
  question: string
  title: string
  created_at: string
  must_do_count?: number
  completed_count?: number
}

interface FolderGroup {
  label: string
  industry: string
  folders: Folder[]
}

const RECURRENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

const INDUSTRY_LABELS: Record<string, string> = {
  'chemical-manufacturing': 'Chemical Manufacturing',
  'food-beverage-manufacturing': 'Food & Beverage Manufacturing',
  'restaurant': 'Restaurant / Food Service',
  'cannabis': 'Cannabis',
  'auto-body-dry-cleaners': 'Auto Body / Dry Cleaners',
  'wood-products-sawmills': 'Wood Products / Sawmills',
  'construction': 'Construction',
  'healthcare': 'Healthcare',
  'hospice': 'Hospice',
  'other': 'Other',
}

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

function getChecklistStatus(completed: number, total: number): { dot: string; label: string } {
  if (total === 0) return { dot: 'bg-gray-300', label: '' }
  if (completed === 0) return { dot: 'bg-red-400', label: 'Not started' }
  if (completed === total) return { dot: 'bg-green-500', label: 'Complete' }
  return { dot: 'bg-amber-400', label: 'In progress' }
}

function groupFoldersByIndustry(folders: Folder[], primaryIndustry: string): FolderGroup[] {
  const assigned = new Set<string>()
  const groups: FolderGroup[] = []

  // Build ordered industry list — primary industry first
  const industryOrder = [primaryIndustry, ...Object.keys(INDUSTRY_FOLDERS).filter(k => k !== primaryIndustry && k !== 'other')]

  for (const industry of industryOrder) {
    const industryFolderNames = INDUSTRY_FOLDERS[industry] || []
    const matched = folders.filter(f => industryFolderNames.includes(f.name) && !assigned.has(f.id))
    if (matched.length > 0) {
      matched.forEach(f => assigned.add(f.id))
      groups.push({
        label: INDUSTRY_LABELS[industry] || industry,
        industry,
        folders: matched,
      })
    }
  }

  // Any remaining unmatched folders go to "Other Folders"
  const unassigned = folders.filter(f => !assigned.has(f.id))
  if (unassigned.length > 0) {
    groups.push({ label: 'Other Folders', industry: 'other', folders: unassigned })
  }

  return groups
}

export default function DocumentsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'checklists' | 'files'>('checklists')
  const [documents, setDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [checklists, setChecklists] = useState<SavedChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [primaryIndustry, setPrimaryIndustry] = useState<string>('other')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Folder navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Folder[]>([])

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePeriod, setRecurrencePeriod] = useState('annually')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Folder management
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [addingFolders, setAddingFolders] = useState(false)
  const [folderSuccess, setFolderSuccess] = useState('')
  const [showIndustryPicker, setShowIndustryPicker] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [folderError, setFolderError] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

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
        await loadFolders(profile.company_id)

        // Load primary industry
        const { data: company } = await supabase
          .from('companies')
          .select('industry')
          .eq('id', profile.company_id)
          .single()
        if (company?.industry) setPrimaryIndustry(company.industry)
      }

      await loadDocuments(user.id, null)
      await loadChecklists(user.id)
      setLoading(false)
    }
    loadData()
  }, [])

  async function loadFolders(cid: string) {
    const res = await fetch(`/api/folders?company_id=${cid}`)
    const json = await res.json()
    if (json.data) setFolders(json.data)
  }

  async function loadDocuments(uid: string, folderId: string | null) {
    const url = folderId
      ? `/api/documents?user_id=${uid}&folder_id=${folderId}`
      : `/api/documents?user_id=${uid}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.data) setDocuments(json.data)
  }

  async function loadChecklists(uid: string) {
    const { data } = await supabase
      .from('checklists')
      .select('id, question, title, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (!data) return

    const withCounts = await Promise.all(data.map(async (c) => {
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

  async function navigateToFolder(folder: Folder | null) {
    if (!userId) return
    if (folder === null) {
      setCurrentFolderId(null)
      setBreadcrumb([])
      await loadDocuments(userId, null)
    } else {
      setCurrentFolderId(folder.id)
      setBreadcrumb(prev => {
        const existing = prev.findIndex(f => f.id === folder.id)
        if (existing >= 0) return prev.slice(0, existing + 1)
        return [...prev, folder]
      })
      await loadDocuments(userId, folder.id)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setUploadError('')
  }

  async function handleUpload() {
    if (!file || !companyId || !userId) return
    setUploading(true)
    setUploadError('')
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${file.name}`
      const folderPath = currentFolderId || 'unfiled'
      const filePath = `${companyId}/${folderPath}/${fileName}`

      const { error: uploadErr } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file)
      if (uploadErr) throw uploadErr

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
          folder_id: currentFolderId,
          is_recurring: isRecurring,
          recurrence_period: isRecurring ? recurrencePeriod : null,
        }),
      })
      if (!dbRes.ok) throw new Error('Failed to save document record')

      await loadDocuments(userId, currentFolderId)
      setFile(null)
      setIsRecurring(false)
      setShowUpload(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleAddIndustryFolders() {
    if (!selectedIndustry) return
    setAddingFolders(true)
    setFolderSuccess('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/folders/industry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ industry: selectedIndustry }),
      })
      const json = await res.json()
      if (json.added === 0) {
        setFolderSuccess('All folders for this industry already exist.')
      } else {
        setFolderSuccess(`Added ${json.added} new folder${json.added === 1 ? '' : 's'}.`)
        if (companyId) loadFolders(companyId)
      }
      setShowIndustryPicker(false)
      setSelectedIndustry('')
    } catch (err) {
      console.error(err)
    } finally {
      setAddingFolders(false)
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !companyId) return
    setCreatingFolder(true)
    setFolderError('')
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          name: newFolderName.trim(),
          parent_id: currentFolderId,
          sort_order: folders.filter(f => f.parent_id === currentFolderId).length,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await loadFolders(companyId)
      setNewFolderName('')
      setShowNewFolder(false)
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  async function handleRenameFolder(id: string) {
    if (!renameValue.trim() || !companyId) return
    try {
      await fetch('/api/folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: renameValue.trim() }),
      })
      await loadFolders(companyId)
      setRenamingId(null)
      setRenameValue('')
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"?`)) return
    if (!companyId) return
    const res = await fetch(`/api/folders?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error)
      return
    }
    await loadFolders(companyId)
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

  // Folders at current level
  const currentFolders = folders.filter(f => f.parent_id === currentFolderId)

  // Files at current level
  const currentFiles = currentFolderId
    ? documents.filter(d => d.folder_id === currentFolderId)
    : documents.filter(d => d.folder_id === null)

  // Grouped folders — only at root level
  const folderGroups: FolderGroup[] = !currentFolderId
    ? groupFoldersByIndustry(currentFolders, primaryIndustry)
    : []

  const tabs = [
    { key: 'checklists', label: 'Checklists', count: checklists.length },
    { key: 'files', label: 'Company Files', count: folders.length },
  ] as const

  function renderFolder(folder: Folder) {
    return (
      <div key={folder.id} className={`group border border-gray-200 hover:border-green-400 transition-all ${viewMode === 'grid' ? 'bg-gray-50 rounded-xl' : 'bg-gray-50 rounded-xl'}`}>
        {renamingId === folder.id ? (
          <div className="p-3 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-500"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setRenamingId(null) }}
            />
            <button onClick={() => handleRenameFolder(folder.id)}
              className="text-xs px-2 py-1 rounded bg-green-700 text-white">✓</button>
            <button onClick={() => setRenamingId(null)}
              className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        ) : (
          <div>
            {viewMode === 'grid' ? (
              <div>
                <button
                  onClick={() => navigateToFolder(folder)}
                  className="w-full p-4 text-left flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{folder.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {documents.filter(d => d.folder_id === folder.id).length} files
                    </p>
                  </div>
                </button>
                <div className="px-4 pb-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
                    className="text-xs text-gray-400 hover:text-green-700 transition-colors">Rename</button>
                  <span className="text-gray-200">·</span>
                  <button onClick={() => handleDeleteFolder(folder.id, folder.name)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-base">📁</span>
                <button onClick={() => navigateToFolder(folder)} className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-700">{folder.name}</p>
                </button>
                <span className="text-xs text-gray-400 mr-2">{documents.filter(d => d.folder_id === folder.id).length} files</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
                    className="text-xs text-gray-400 hover:text-green-700 transition-colors">Rename</button>
                  <span className="text-gray-200">·</span>
                  <button onClick={() => handleDeleteFolder(folder.id, folder.name)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <AppLayout title="Company Documents">
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Company Documents</h1>
            <p className="text-sm text-gray-400">Your compliance files and saved checklists</p>
          </div>
          {activeTab === 'files' && (
            <button
              onClick={() => { setShowUpload(!showUpload); setShowNewFolder(false) }}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
              + Upload file
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
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

            {/* FILES TAB */}
            {activeTab === 'files' && (
              <div>
                {/* Upload panel */}
                {showUpload && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">Upload a file</h2>
                        {currentFolderId && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Uploading to: {folders.find(f => f.id === currentFolderId)?.name}
                          </p>
                        )}
                      </div>
                      <button onClick={() => { setShowUpload(false); setFile(null) }}
                        className="text-gray-400 hover:text-gray-600 text-lg">×</button>
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
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Recurring</label>
                        <div className="flex items-center gap-3">
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
                      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
                      <button onClick={handleUpload} disabled={!file || uploading}
                        className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                        {uploading ? 'Uploading...' : 'Upload file →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Breadcrumb + view toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => navigateToFolder(null)}
                      className={`text-sm transition-colors ${currentFolderId === null ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>
                      All Files
                    </button>
                    {breadcrumb.map((f, i) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <span className="text-gray-300 text-xs">›</span>
                        <button
                          onClick={() => navigateToFolder(f)}
                          className={`text-sm transition-colors ${i === breadcrumb.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>
                          {f.name}
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
                    <button onClick={() => setViewMode('grid')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
                      Grid
                    </button>
                    <button onClick={() => setViewMode('list')}
                      className={`px-2 py-1 rounded text-xs transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
                      List
                    </button>
                  </div>
                </div>

                {/* New folder input */}
                {showNewFolder && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📁</span>
                      <input
                        type="text"
                        autoFocus
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false) }}
                      />
                      <button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors disabled:opacity-50">
                        {creatingFolder ? '...' : 'Create'}
                      </button>
                      <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
                        className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                    </div>
                    {folderError && <p className="text-xs text-red-600 mt-2 pl-7">{folderError}</p>}
                  </div>
                )}

                {/* GROUPED FOLDERS — root level */}
                {!currentFolderId && currentFolders.length > 0 && (
                  <div className="space-y-6 mb-4">
                    {folderGroups.map((group, gi) => (
                      <div key={group.industry + gi}>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{group.label}</p>
                          <div className="flex-1 h-px bg-gray-100"></div>
                        </div>
                        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'space-y-1'}>
                          {group.folders.map(folder => renderFolder(folder))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* FLAT FOLDERS — inside a subfolder */}
                {currentFolderId && currentFolders.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Folders</p>
                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4' : 'space-y-1 mb-4'}>
                      {currentFolders.map(folder => renderFolder(folder))}
                    </div>
                  </div>
                )}

                {/* Add folder buttons */}
                {breadcrumb.length < 2 && (
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      onClick={() => { setShowNewFolder(true); setShowUpload(false) }}
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-green-700 transition-colors px-1">
                      <span>＋</span> New folder
                    </button>
                    <button
                      onClick={() => { setShowIndustryPicker(!showIndustryPicker); setFolderSuccess('') }}
                      className="flex items-center gap-2 text-xs text-gray-400 hover:text-green-700 transition-colors px-1">
                      <span>＋</span> Add industry folders
                    </button>
                  </div>
                )}

                {/* Industry folder picker */}
                {showIndustryPicker && (
                  <div className="mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-600 mb-2">Select an industry to add its compliance folders:</p>
                    <div className="flex items-center gap-2">
                      <select
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                        value={selectedIndustry}
                        onChange={(e) => setSelectedIndustry(e.target.value)}>
                        <option value="">Select industry...</option>
                        <option value="chemical-manufacturing">Chemical Manufacturing</option>
                        <option value="food-beverage-manufacturing">Food & Beverage Manufacturing</option>
                        <option value="restaurant">Restaurant / Food Service</option>
                        <option value="cannabis">Cannabis</option>
                        <option value="auto-body-dry-cleaners">Auto Body / Dry Cleaners</option>
                        <option value="wood-products-sawmills">Wood Products / Sawmills</option>
                        <option value="construction">Construction</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="hospice">Hospice</option>
                        <option value="other">Other</option>
                      </select>
                      <button
                        onClick={handleAddIndustryFolders}
                        disabled={addingFolders || !selectedIndustry}
                        className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                        {addingFolders ? 'Adding...' : 'Add folders'}
                      </button>
                      <button
                        onClick={() => { setShowIndustryPicker(false); setSelectedIndustry('') }}
                        className="text-gray-400 hover:text-gray-600 text-sm px-2">
                        Cancel
                      </button>
                    </div>
                    {folderSuccess && <p className="text-xs text-green-700 mt-2">{folderSuccess}</p>}
                  </div>
                )}

                {/* Files list */}
                {currentFiles.length > 0 && currentFolders.length > 0 && currentFolderId && (
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 mt-2">Files</p>
                )}
                {currentFiles.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-50">
                      {currentFiles.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(doc.file_type, doc.name)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                            <div className="flex items-center gap-4 mt-1">
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
                      {currentFiles.length} file{currentFiles.length !== 1 ? 's' : ''} · Stored securely and only accessible by your account
                    </p>
                  </div>
                ) : (
                  currentFolderId && (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No files in this folder yet</p>
                      <p className="text-xs text-gray-400 mt-1">Use the Upload button to add files here</p>
                    </div>
                  )
                )}

                {/* CompliBoard capability banner */}
                <div className="mt-16 pt-8 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">📂</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Did you know?</p>
                      <p className="text-sm text-gray-500 leading-relaxed">Upload your compliance documents once. CompliBoard reads them, extracts renewal dates, and adds them to your calendar automatically. Every month, CompliBoard checks if your documents are still current and alerts you 30 days before anything expires. You never miss a deadline again.</p>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

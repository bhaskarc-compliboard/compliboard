'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'
import { useRouter } from 'next/navigation'

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
  section: string
}

const RECURRENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

// Audit industry is shown as its slug directly (no hardcoded label map).

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

export default function DocumentsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'files' | 'log'>('files')
  const [documents, setDocuments] = useState<Document[]>([])
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [primaryIndustry, setPrimaryIndustry] = useState<string>('other')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Folder navigation — separate state for files vs hr tabs
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Folder[]>([])

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePeriod, setRecurrencePeriod] = useState('annually')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [extractDates, setExtractDates] = useState(true)
  const [extractingDates, setExtractingDates] = useState<string | null>(null)
  const [scanningDoc, setScanningDoc] = useState<string | null>(null)
  const [documentReviews, setDocumentReviews] = useState<any[]>([])
  const [pendingDates, setPendingDates] = useState<{title: string; date: string; description: string; is_recurring: boolean; recurrence_period: string | null}[]>([])
  const [selectedDates, setSelectedDates] = useState<Set<number>>(new Set())
  const [addingToCalendar, setAddingToCalendar] = useState(false)
  const [calendarSuccess, setCalendarSuccess] = useState('')

  // Folder management
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [folderError, setFolderError] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Audit state
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null)

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
        await loadDocumentReviews(profile.company_id)

        const { data: company } = await supabase
          .from('companies')
          .select('industry')
          .eq('id', profile.company_id)
          .single()
        if (company?.industry) setPrimaryIndustry(company.industry)
      }

      await loadDocuments(user.id, null)
        await loadAllDocuments(user.id)
      setLoading(false)
    }
    loadData()
  }, [])

  async function loadFolders(cid: string) {
    const res = await fetch(`/api/folders?company_id=${cid}`)
    const json = await res.json()
    if (json.data) setFolders(json.data)
  }

  async function loadAllDocuments(uid: string) {
    const res = await fetch(`/api/documents?user_id=${uid}`)
    const json = await res.json()
    if (json.data) setAllDocuments(json.data)
  }

  async function loadDocuments(uid: string, folderId: string | null) {
    const url = folderId
      ? `/api/documents?user_id=${uid}&folder_id=${folderId}`
      : `/api/documents?user_id=${uid}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.data) setDocuments(json.data)
  }

  async function loadDocumentReviews(cid: string) {
    const res = await fetch(`/api/document-review?company_id=${cid}`)
    const json = await res.json()
    if (json.data) setDocumentReviews(json.data)
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
    const selected = Array.from(e.target.files || [])
    setFiles(selected)
    setUploadError('')
  }

  async function handleUpload(targetFolderId: string | null) {
    if (files.length === 0 || !companyId || !userId) return
    setUploading(true)
    setUploadError('')
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`)
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${file.name}`
        const folderPath = targetFolderId || 'unfiled'
        const filePath = `${companyId}/${folderPath}/${fileName}`
        const { error: uploadErr } = await supabase.storage.from('company-documents').upload(filePath, file)
        if (uploadErr) throw uploadErr
        const dbRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId, user_id: userId, name: file.name,
            file_url: filePath, file_type: file.type || fileExt || 'unknown',
            file_size: file.size, folder_id: targetFolderId,
            is_recurring: isRecurring, recurrence_period: isRecurring ? recurrencePeriod : null,
          }),
        })
        if (!dbRes.ok) throw new Error(`Failed to save ${file.name}`)
      }
      await loadDocuments(userId, targetFolderId)
      await loadAllDocuments(userId)
      
      // Save reference before clearing state
      const uploadedFiles = [...files]
      setFiles([])
      setUploadProgress('')
      setIsRecurring(false)
      setShowUpload(false)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Extract dates if user opted in
      if (extractDates) {
        const lastFile = uploadedFiles[uploadedFiles.length - 1]
        if (lastFile) {
          try {
            const fd = new FormData()
            fd.append('file', lastFile)
            fd.append('file_name', lastFile.name)
            const dateRes = await fetch('/api/extract-dates', { method: 'POST', body: fd })
            const dateJson = await dateRes.json()
            if (dateJson.dates_found && dateJson.dates_found.length > 0) {
              setPendingDates(dateJson.dates_found)
              setSelectedDates(new Set(dateJson.dates_found.map((_: any, i: number) => i)))
            }
          } catch (err) {
            console.error('Date extraction error:', err)
          }
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  async function handleCreateFolder(section: string, parentId: string | null) {
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
          parent_id: parentId,
          sort_order: folders.filter(f => f.parent_id === parentId).length,
          section,
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
      await fetch('/api/folders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name: renameValue.trim() }) })
      await loadFolders(companyId)
      setRenamingId(null)
      setRenameValue('')
    } catch (err) { console.error(err) }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}"?`)) return
    if (!companyId) return
    const res = await fetch(`/api/folders?id=${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { alert(json.error); return }
    await loadFolders(companyId)
  }

  async function handleDeleteDoc(doc: Document) {
    if (!confirm(`Delete ${doc.name}?`)) return
    setDeleting(doc.id)
    try {
      await fetch(`/api/documents?id=${doc.id}&file_url=${encodeURIComponent(doc.file_url)}`, { method: 'DELETE' })
      setDocuments(prev => prev.filter(d => d.id !== doc.id))
      setAllDocuments(prev => prev.filter(d => d.id !== doc.id))
    } catch (error) { console.error(error) }
    finally { setDeleting(null) }
  }

  async function handleDownload(doc: Document) {
    const { data } = await supabase.storage.from('company-documents').createSignedUrl(doc.file_url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // Filtered folders by section
  async function handleAddToCalendar() {
    if (!companyId || !userId) return
    setAddingToCalendar(true)
    try {
      const toAdd = pendingDates.filter((_, i) => selectedDates.has(i))
      for (const d of toAdd) {
        await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            user_id: userId,
            title: d.title,
            description: d.description,
            due_date: d.date,
            category: 'compliance',
            is_recurring: d.is_recurring,
            recurrence_period: d.recurrence_period,
          }),
        })
      }
      setCalendarSuccess(`Added ${toAdd.length} date${toAdd.length !== 1 ? 's' : ''} to your calendar.`)
      setTimeout(() => {
        setPendingDates([])
        setSelectedDates(new Set())
        setCalendarSuccess('')
      }, 3000)
    } catch (err) {
      console.error('Calendar error:', err)
    } finally {
      setAddingToCalendar(false)
    }
  }

  async function handleScanDocument(doc: Document) {
    if (!companyId || !userId) return
    setScanningDoc(doc.id)
    try {
      const { data: urlData } = await supabase.storage.from('company-documents').createSignedUrl(doc.file_url, 60)
      if (!urlData?.signedUrl) throw new Error('Could not get file URL')
      const fileRes = await fetch(urlData.signedUrl)
      const blob = await fileRes.blob()
      const file = new File([blob], doc.name, { type: doc.file_type })
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_id', doc.id)
      fd.append('document_name', doc.name)
      fd.append('folder_id', doc.folder_id || '')
      fd.append('company_id', companyId)
      fd.append('user_id', userId)
      fd.append('industry', primaryIndustry)
      // Get folder and division names
      const folder = folders.find(f => f.id === doc.folder_id)
      const division = folder?.parent_id ? folders.find(f => f.id === folder.parent_id) : folder
      fd.append('folder_name', folder?.name || '')
      fd.append('division_name', division?.name || '')
      const res = await fetch('/api/document-review', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.data) {
        setDocumentReviews(prev => [json.data, ...prev.filter(r => r.document_id !== doc.id)])
        setActiveTab('log')
      } else {
        alert('Could not complete review. File type may not be supported.')
      }
    } catch (err) {
      console.error('Scan error:', err)
      alert('Scan failed. Please try again.')
    } finally {
      setScanningDoc(null)
    }
  }

  async function handleExtractDates(doc: Document) {
    if (!companyId || !userId) return
    setExtractingDates(doc.id)
    try {
      const { data } = await supabase.storage.from('company-documents').createSignedUrl(doc.file_url, 60)
      if (!data?.signedUrl) throw new Error('Could not get file URL')
      const fileRes = await fetch(data.signedUrl)
      const blob = await fileRes.blob()
      const file = new File([blob], doc.name, { type: doc.file_type })
      const fd = new FormData()
      fd.append('file', file)
      fd.append('file_name', doc.name)
      const dateRes = await fetch('/api/extract-dates', { method: 'POST', body: fd })
      const dateJson = await dateRes.json()
      if (dateJson.dates_found && dateJson.dates_found.length > 0) {
        setPendingDates(dateJson.dates_found)
        setSelectedDates(new Set(dateJson.dates_found.map((_: any, i: number) => i)))
      } else {
        alert('No compliance dates found in this document.')
      }
    } catch (err) {
      console.error('Date extraction error:', err)
    } finally {
      setExtractingDates(null)
    }
  }

  const fileFolders = folders.filter(f => f.section === 'files')

  const currentFileFolders = fileFolders.filter(f => f.parent_id === currentFolderId)
  const currentFiles = currentFolderId ? documents.filter(d => d.folder_id === currentFolderId) : documents.filter(d => {
    const filesFolderIds = fileFolders.map(f => f.id)
    return d.folder_id === null || !filesFolderIds.includes(d.folder_id || '')
  })

  const tabs = [
    { key: 'files', label: 'Company Files' },
    { key: 'log', label: 'Document Reviews' },
  ] as const

  // Counts files directly in this folder PLUS every file in any folder
  // nested underneath it, at any depth — a division's count should reflect
  // everything inside it, not just files sitting at the top level.
  function countFilesRecursive(folderId: string): number {
    const direct = allDocuments.filter(d => d.folder_id === folderId).length
    const childFolders = folders.filter(f => f.parent_id === folderId)
    const nested = childFolders.reduce((sum, child) => sum + countFilesRecursive(child.id), 0)
    return direct + nested
  }

  function renderFolder(folder: Folder, onNavigate: (f: Folder) => void, onAudit?: (f: Folder) => void) {
    return (
      <div key={folder.id} className={`group border border-gray-200 hover:border-green-400 transition-all ${viewMode === 'grid' ? 'bg-gray-50 rounded-xl' : 'bg-gray-50 rounded-xl'}`}>
        {renamingId === folder.id ? (
          <div className="p-3 flex items-center gap-2">
            <input type="text" autoFocus
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-500"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setRenamingId(null) }}
            />
            <button onClick={() => handleRenameFolder(folder.id)} className="text-xs px-2 py-1 rounded bg-green-700 text-white">✓</button>
            <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        ) : (
          <div>
            {viewMode === 'grid' ? (
              <div>
                <button onClick={() => onNavigate(folder)} className="w-full p-4 text-left flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{folder.name}</p>
                    {countFilesRecursive(folder.id) > 0 && <p className="text-xs text-gray-400 mt-0.5">{countFilesRecursive(folder.id)} files</p>}
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
                <button onClick={() => onNavigate(folder)} className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-700">{folder.name}</p>
                </button>
                <span className="text-xs text-gray-400 mr-2">{countFilesRecursive(folder.id)} files</span>
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

  function renderFileList(files: Document[]) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {files.map((doc) => (
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
                {documentReviews.find(r => r.document_id === doc.id) && (
                  <span className="text-xs text-green-600 font-medium">✓ Reviewed</span>
                )}
                <button onClick={() => handleExtractDates(doc)} disabled={extractingDates === doc.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-50">
                  {extractingDates === doc.id ? 'Extracting...' : 'Extract dates'}
                </button>
                <button onClick={() => handleScanDocument(doc)} disabled={scanningDoc === doc.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-blue-500 hover:text-blue-700 transition-colors disabled:opacity-50">
                  {scanningDoc === doc.id ? 'Reviewing...' : 'Review'}
                </button>
                <button onClick={() => handleDownload(doc)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">Download</button>
                <button onClick={() => handleDeleteDoc(doc)} disabled={deleting === doc.id} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50">{deleting === doc.id ? '...' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">
          {files.length} file{files.length !== 1 ? 's' : ''} · Stored securely and only accessible by your account
        </p>
      </div>
    )
  }

  function renderUploadPanel(targetFolderId: string | null, folderName?: string) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Upload files</h2>
            {folderName && <span className="text-xs text-green-600">→ {folderName}</span>}
          </div>
          <button onClick={() => { setShowUpload(false); setFiles([]) }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="space-y-3">
          <div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.pptx,.ppt,image/*" onChange={handleFileChange} className="hidden" id="file-upload" />
            {files.length === 0 ? (
              <label htmlFor="file-upload" className="flex items-center gap-3 w-full border border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                <span className="text-2xl">📎</span>
                <div>
                  <p className="text-sm text-gray-600">Click to select files</p>
                  <p className="text-xs text-gray-400">PDF, Word, PowerPoint, Excel, CSV, images · Select multiple</p>
                </div>
              </label>
            ) : (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <span className="text-xl">{getFileIcon(f.type, f.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 truncate">{f.name}</p>
                      <p className="text-xs text-green-600">{formatFileSize(f.size)}</p>
                    </div>
                  </div>
                ))}
                <button onClick={() => { setFiles([]); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                  Clear all
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div onClick={() => setIsRecurring(!isRecurring)} className={`w-8 h-5 rounded-full cursor-pointer transition-colors relative flex-shrink-0 ${isRecurring ? 'bg-green-600' : 'bg-gray-200'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${isRecurring ? 'left-4' : 'left-1'}`} />
              </div>
              <label className="text-xs text-gray-600 cursor-pointer" onClick={() => setIsRecurring(!isRecurring)}>Recurring</label>
              {isRecurring && (
                <select className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-none bg-gray-50" value={recurrencePeriod} onChange={(e) => setRecurrencePeriod(e.target.value)}>
                  {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div onClick={() => setExtractDates(!extractDates)} className={`w-8 h-5 rounded-full cursor-pointer transition-colors relative flex-shrink-0 ${extractDates ? 'bg-green-600' : 'bg-gray-200'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${extractDates ? 'left-4' : 'left-1'}`} />
              </div>
              <label className="text-xs text-gray-600 cursor-pointer" onClick={() => setExtractDates(!extractDates)}>Extract dates</label>
            </div>
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          {uploadProgress && <p className="text-sm text-green-700">{uploadProgress}</p>}
          <button onClick={() => handleUpload(targetFolderId)} disabled={files.length === 0 || uploading}
            className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
            {uploading ? uploadProgress || 'Uploading...' : `Upload ${files.length > 1 ? files.length + ' files' : 'file'} →`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <AppLayout title="Company Documents" didYouKnow={activeTab === 'log' ? { icon: '🔍', text: 'Every file you review gets a real compliance check — CompliBoard cites the specific regulation it checked against and gives you a fix for anything missing.' } : { icon: '📂', text: 'Upload your compliance documents once. CompliBoard reads them, extracts renewal dates, and adds them to your calendar automatically. Every month, CompliBoard checks if your documents are still current and alerts you 30 days before anything expires.' }}>
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Company Documents</h1>
            <p className="text-sm text-gray-400">Your compliance files and document reviews</p>
          </div>
          {activeTab === 'files' && (
            <button onClick={() => { setShowUpload(!showUpload); setShowNewFolder(false) }}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
              + Upload file
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-2 ${activeTab === tab.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {tab.label}
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
            {/* COMPANY FILES TAB */}
            {activeTab === 'files' && (
              <div>
                {showUpload && renderUploadPanel(currentFolderId, folders.find(f => f.id === currentFolderId)?.name)}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => navigateToFolder(null)} className={`text-sm transition-colors ${currentFolderId === null ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>Divisions</button>
                    {breadcrumb.map((f, i) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <span className="text-gray-300 text-xs">›</span>
                        <button onClick={() => navigateToFolder(f)} className={`text-sm transition-colors ${i === breadcrumb.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>{f.name}</button>
                      </span>
                    ))}
                    {breadcrumb.length < 2 && (
                      <button onClick={() => { setShowNewFolder(true); setShowUpload(false) }} className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-700 transition-colors px-2 py-1 rounded-lg border border-gray-200 hover:border-green-400 ml-2">
                        <span>＋</span> {currentFolderId === null ? 'New division' : 'New folder'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5">
                    <button onClick={() => setViewMode('grid')} className={`px-2 py-1 rounded text-xs transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>Grid</button>
                    <button onClick={() => setViewMode('list')} className={`px-2 py-1 rounded text-xs transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>List</button>
                  </div>
                </div>

                {showNewFolder && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📁</span>
                      <input type="text" autoFocus className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-500" placeholder="Folder name" value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder('files', currentFolderId); if (e.key === 'Escape') setShowNewFolder(false) }}
                      />
                      <button onClick={() => handleCreateFolder('files', currentFolderId)} disabled={creatingFolder || !newFolderName.trim()} className="text-xs px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors disabled:opacity-50">{creatingFolder ? '...' : 'Create'}</button>
                      <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                    </div>
                    {folderError && <p className="text-xs text-red-600 mt-2 pl-7">{folderError}</p>}
                  </div>
                )}

                {currentFolderId === null && currentFileFolders.length === 0 && currentFiles.length === 0 && !showUpload && (
                  <div>
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                      <button onClick={() => setShowUpload(true)}
                        className="flex-[1.5] bg-gray-50 border border-dashed border-gray-300 rounded-xl px-7 py-9 text-center hover:border-green-500 hover:bg-green-50 transition-colors">
                        <p className="text-3xl mb-2">📎</p>
                        <p className="text-base font-medium text-gray-800">Click to add your first file</p>
                        <p className="text-sm text-gray-500 mt-1.5 max-w-xs mx-auto">A permit, an SDS, a training record — watch CompliBoard check it in seconds.</p>
                      </button>

                      <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-5">
                        <p className="text-sm font-medium text-green-900 flex items-center gap-2">☁️ Never upload again</p>
                        <p className="text-xs text-green-800 mt-2 leading-relaxed">Connect your drive and CompliBoard always reads the latest version — no re-uploading, ever.</p>
                        <div className="flex flex-col gap-2 mt-3">
                          <button disabled className="text-xs text-center py-2 bg-white border border-green-200 rounded-lg text-green-800 opacity-60 cursor-not-allowed">Connect Google Drive — Soon</button>
                          <button disabled className="text-xs text-center py-2 bg-white border border-green-200 rounded-lg text-green-800 opacity-60 cursor-not-allowed">Connect OneDrive — Soon</button>
                        </div>
                        <p className="text-[11px] text-green-800 opacity-80 mt-3 leading-snug">🔒 Read-only. We never copy or store your files. You choose which folder.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                      <span className="text-gray-400">✉️</span>
                      <p className="text-xs text-gray-500 flex-1">Re-uploading is a pain. Soon you'll be able to just forward an updated file by email and we'll keep it current.</p>
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Soon</span>
                    </div>
                  </div>
                )}

                {currentFileFolders.length > 0 && (
                  <div className="mb-4">
                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'space-y-1'}>
                      {currentFileFolders.map(folder => renderFolder(folder, navigateToFolder))}
                    </div>
                  </div>
                )}

                {currentFiles.length > 0 && currentFileFolders.length > 0 && currentFolderId && (
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 mt-2">Files</p>
                )}
                {currentFiles.length > 0 ? renderFileList(currentFiles) : (
                  currentFolderId && (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No files in this folder yet</p>
                      <p className="text-xs text-gray-400 mt-1">Use the Upload button to add files here</p>
                    </div>
                  )
                )}


              </div>
            )}

            {/* COMPLIANCE LOG TAB */}
            {activeTab === 'log' && (
              <div>
                {documentReviews.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <p className="text-4xl mb-4">🔍</p>
                    <p className="text-base font-medium text-gray-700 mb-1">No document reviews yet</p>
                    <p className="text-sm text-gray-400 mb-6">Go to Company Files and click Review on any file</p>
                    <button onClick={() => setActiveTab('files')}
                      className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                      Go to Company Files
                    </button>
                  </div>
                ) : null}

                {/* Document Reviews Section */}
                {documentReviews.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <div className="mb-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Document Reviews</p>
                    </div>
                    {documentReviews.map((review) => {
                      const isExpanded = expandedAuditId === review.id
                      return (
                        <div key={review.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedAuditId(isExpanded ? null : review.id)}>
                            <span className="text-2xl flex-shrink-0">📄</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900 truncate">{review.document_name}</p>
                                {review.is_current === true && <span className="text-xs text-green-600 font-medium flex-shrink-0">✓ Current</span>}
                                {review.is_current === false && <span className="text-xs text-red-500 font-medium flex-shrink-0">⚠ Expired</span>}
                                {review.expiring_soon && <span className="text-xs text-amber-600 font-medium flex-shrink-0">⏰ Expiring soon</span>}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {review.document_type && `${review.document_type} · `}
                                {review.division_name && `${review.division_name} · `}
                                {new Date(review.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="text-gray-300 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                              <p className="text-sm text-gray-600 italic">{review.summary}</p>

                              <div className="grid grid-cols-2 gap-3">
                                {review.issued_by && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-400">Issued by</p>
                                    <p className="text-xs text-gray-700">{review.issued_by}</p>
                                  </div>
                                )}
                                {review.expiry_date && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-400">Expires</p>
                                    <p className={`text-xs font-medium ${review.expiring_soon ? 'text-amber-600' : review.is_current ? 'text-gray-700' : 'text-red-500'}`}>
                                      {new Date(review.expiry_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                      {review.days_until_expiry !== null && review.days_until_expiry >= 0 && ` (${review.days_until_expiry} days)`}
                                    </p>
                                  </div>
                                )}
                                {review.renewal_date && (
                                  <div>
                                    <p className="text-xs font-medium text-gray-400">Renewal deadline</p>
                                    <p className="text-xs text-gray-700">{new Date(review.renewal_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                  </div>
                                )}
                                {review.coverage && (
                                  <div className="col-span-2">
                                    <p className="text-xs font-medium text-gray-400">Coverage</p>
                                    <p className="text-xs text-gray-700">{review.coverage}</p>
                                  </div>
                                )}
                              </div>

                              {review.gaps?.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">⚠️ Gaps & Concerns</p>
                                  <div className="space-y-1">
                                    {review.gaps.map((gap: string, i: number) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <span className="text-xs text-amber-500 mt-0.5 flex-shrink-0">!</span>
                                        <p className="text-xs text-gray-700">{gap}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {review.action_items?.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">📋 Action Items</p>
                                  <div className="space-y-1">
                                    {review.action_items.map((item: string, i: number) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <span className="text-xs text-blue-500 mt-0.5 flex-shrink-0">→</span>
                                        <p className="text-xs text-gray-700">{item}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-2 flex items-center gap-3 border-t border-gray-100">
                                <button onClick={() => {
                                  const doc = documents.find(d => d.id === review.document_id)
                                  if (doc) handleScanDocument(doc)
                                }} disabled={scanningDoc === review.document_id}
                                  className="text-xs text-green-700 hover:text-green-800 font-medium transition-colors disabled:opacity-50">
                                  {scanningDoc === review.document_id ? '⟳ Re-scanning...' : '↺ Re-scan document'}
                                </button>
                                <span className="text-gray-200">·</span>
                                <button onClick={async () => {
                                  if (!confirm('Delete this review?')) return
                                  await fetch(`/api/document-review?id=${review.id}`, { method: 'DELETE' })
                                  setDocumentReviews(prev => prev.filter(r => r.id !== review.id))
                                }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete review</button>
                              </div>
                              <AIDisclaimer variant="short" className="mt-2" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Date extraction confirmation card */}
        {pendingDates.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-lg z-50 px-4">
            <div className="bg-white rounded-2xl border border-green-200 shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">📅 Dates found in your document</p>
                  <p className="text-xs text-gray-400 mt-0.5">Select which dates to add to your compliance calendar</p>
                </div>
                <button onClick={() => { setPendingDates([]); setSelectedDates(new Set()) }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
              </div>
              <div className="space-y-2 mb-4">
                {pendingDates.map((d, i) => (
                  <div key={i} onClick={() => {
                    const next = new Set(selectedDates)
                    if (next.has(i)) next.delete(i)
                    else next.add(i)
                    setSelectedDates(next)
                  }} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedDates.has(i) ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${selectedDates.has(i) ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                      {selectedDates.has(i) && <span className="text-white text-xs">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{d.title}</p>
                      <p className="text-xs text-green-700 font-medium">{new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              {calendarSuccess ? (
                <p className="text-sm text-green-700 font-medium text-center py-2">✅ {calendarSuccess}</p>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleAddToCalendar} disabled={selectedDates.size === 0 || addingToCalendar}
                    className="flex-1 bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                    {addingToCalendar ? 'Adding...' : `Add ${selectedDates.size} date${selectedDates.size !== 1 ? 's' : ''} to calendar →`}
                  </button>
                  <button onClick={() => { setPendingDates([]); setSelectedDates(new Set()) }}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:border-gray-300 transition-colors">
                    Skip
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

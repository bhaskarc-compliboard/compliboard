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
  section: string
}

interface SavedChecklist {
  id: string
  question: string
  title: string
  created_at: string
  must_do_count?: number
  completed_count?: number
}

interface AuditResult {
  summary: string
  present: { file_name: string; note: string }[]
  needs_review: { file_name: string; note: string }[]
  missing: { document: string; why: string; priority: string }[]
}

interface FolderAudit {
  id: string
  folder_id: string
  folder_name: string
  parent_folder_name: string | null
  industry: string
  file_names: string[]
  result_json: AuditResult
  created_at: string
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

export default function DocumentsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<'checklists' | 'files' | 'hr' | 'log'>('checklists')
  const [documents, setDocuments] = useState<Document[]>([])
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [checklists, setChecklists] = useState<SavedChecklist[]>([])
  const [audits, setAudits] = useState<FolderAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [primaryIndustry, setPrimaryIndustry] = useState<string>('other')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Folder navigation — separate state for files vs hr tabs
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<Folder[]>([])
  const [hrCurrentFolderId, setHrCurrentFolderId] = useState<string | null>(null)
  const [hrBreadcrumb, setHrBreadcrumb] = useState<Folder[]>([])

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

  // Audit state
  const [auditingFolderId, setAuditingFolderId] = useState<string | null>(null)
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
        await loadAudits(profile.company_id)
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

  async function loadChecklists(uid: string) {
    const { data } = await supabase
      .from('checklists')
      .select('id, question, title, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (!data) return
    const withCounts = await Promise.all(data.map(async (c) => {
      const { count: total } = await supabase.from('checklist_items').select('*', { count: 'exact', head: true }).eq('checklist_id', c.id).eq('category', 'must_do')
      const { count: completed } = await supabase.from('checklist_items').select('*', { count: 'exact', head: true }).eq('checklist_id', c.id).eq('category', 'must_do').eq('completed', true)
      return { ...c, must_do_count: total || 0, completed_count: completed || 0 }
    }))
    setChecklists(withCounts)
  }

  async function loadDocumentReviews(cid: string) {
    const res = await fetch(`/api/document-review?company_id=${cid}`)
    const json = await res.json()
    if (json.data) setDocumentReviews(json.data)
  }

  async function loadAudits(cid: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/audit?company_id=${cid}`, {
      headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
    })
    const json = await res.json()
    if (json.data) setAudits(json.data)
  }

  async function handleRunAudit(folder: Folder) {
    if (!companyId || !userId) return
    setAuditingFolderId(folder.id)
    try {
      const subFolderIds = folders.filter(f => f.parent_id === folder.id).map(f => f.id)
      const allFolderIds = [folder.id, ...subFolderIds]
      const allFiles = documents.filter(d => d.folder_id && allFolderIds.includes(d.folder_id))
      const fileNames = allFiles.map(f => f.name)
      const { data: { session } } = await supabase.auth.getSession()
      const parentFolder = folder.parent_id ? folders.find(f => f.id === folder.parent_id) : null
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ folder_id: folder.id, folder_name: folder.name, parent_folder_name: parentFolder?.name || null, industry: primaryIndustry, file_names: fileNames }),
      })
      const json = await res.json()
      if (json.data) {
        setAudits(prev => [json.data, ...prev.filter(a => a.folder_id !== folder.id)])
        setActiveTab('log')
        setExpandedAuditId(json.data.id)
      }
    } catch (err) {
      console.error('Audit error:', err)
    } finally {
      setAuditingFolderId(null)
    }
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

  async function navigateToHrFolder(folder: Folder | null) {
    if (!userId) return
    if (folder === null) {
      setHrCurrentFolderId(null)
      setHrBreadcrumb([])
      await loadDocuments(userId, null)
    } else {
      setHrCurrentFolderId(folder.id)
      setHrBreadcrumb(prev => {
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

  async function handleAddIndustryFolders() {
    if (!selectedIndustry) return
    setAddingFolders(true)
    setFolderSuccess('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/folders/industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ industry: selectedIndustry, parent_id: currentFolderId }),
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

  async function handleDeleteChecklist(id: string, title: string) {
    if (!confirm(`Delete checklist "${title}"?`)) return
    setDeleting(id)
    await supabase.from('checklists').delete().eq('id', id)
    setChecklists(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  async function handleDeleteAudit(id: string) {
    if (!confirm('Delete this audit report?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/audit?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token || ''}` } })
    setAudits(prev => prev.filter(a => a.id !== id))
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
  const hrFolders = folders.filter(f => f.section === 'hr')

  const currentFileFolders = fileFolders.filter(f => f.parent_id === currentFolderId)
  const currentHrFolders = hrFolders.filter(f => f.parent_id === hrCurrentFolderId)
  const currentFiles = currentFolderId ? documents.filter(d => d.folder_id === currentFolderId) : documents.filter(d => {
    const filesFolderIds = fileFolders.map(f => f.id)
    return d.folder_id === null || !filesFolderIds.includes(d.folder_id || '')
  })
  const currentHrFiles = hrCurrentFolderId ? documents.filter(d => d.folder_id === hrCurrentFolderId) : []

  const tabs = [
    { key: 'checklists', label: 'Checklists' },
    { key: 'files', label: 'Company Files' },
    { key: 'hr', label: 'HR Documents' },
    { key: 'log', label: 'Compliance Log' },
  ] as const

  function renderFolder(folder: Folder, onNavigate: (f: Folder) => void, onAudit?: (f: Folder) => void) {
    const isAuditing = auditingFolderId === folder.id
    const latestAudit = audits.find(a => a.folder_id === folder.id)

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
                    <p className="text-xs text-gray-400 mt-0.5">{allDocuments.filter(d => d.folder_id === folder.id).length} files</p>
                  </div>
                </button>
                <div className="px-4 pb-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
                    className="text-xs text-gray-400 hover:text-green-700 transition-colors">Rename</button>
                  {onAudit && (
                    <>
                      <span className="text-gray-200">·</span>
                      <button onClick={() => onAudit(folder)} disabled={isAuditing}
                        className="text-xs text-gray-400 hover:text-green-700 transition-colors disabled:opacity-50">
                        {isAuditing ? '⟳ Auditing...' : latestAudit ? 'Re-audit' : 'Audit'}
                      </button>
                    </>
                  )}
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
                <span className="text-xs text-gray-400 mr-2">{allDocuments.filter(d => d.folder_id === folder.id).length} files</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
                    className="text-xs text-gray-400 hover:text-green-700 transition-colors">Rename</button>
                  {onAudit && (
                    <>
                      <span className="text-gray-200">·</span>
                      <button onClick={() => onAudit(folder)} disabled={isAuditing}
                        className="text-xs text-gray-400 hover:text-green-700 transition-colors disabled:opacity-50">
                        {isAuditing ? '⟳ Auditing...' : latestAudit ? 'Re-audit' : 'Audit'}
                      </button>
                    </>
                  )}
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
    <AppLayout title="Company Documents" didYouKnow={activeTab === 'hr' ? { icon: '👥', text: 'Use the HR Help module to generate compliant HR policies for your state. Generated policies are saved directly to your HR Documents folder, ready to customize and share with employees.' } : activeTab === 'log' ? { icon: '🔍', text: 'Audit any compliance folder to get an instant gap report. CompliBoard checks your files against required documents for your industry and tells you exactly what is missing.' } : activeTab === 'checklists' ? { icon: '📋', text: 'Each compliance checklist includes detailed micro-steps with time estimates, costs, and direct links to the agencies you need. Everything in one place.' } : { icon: '📂', text: 'Upload your compliance documents once. CompliBoard reads them, extracts renewal dates, and adds them to your calendar automatically. Every month, CompliBoard checks if your documents are still current and alerts you 30 days before anything expires.' }}>
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Company Documents</h1>
            <p className="text-sm text-gray-400">Your compliance files, HR documents, and saved checklists</p>
          </div>
          {(activeTab === 'files' || activeTab === 'hr') && (
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
                              <button onClick={() => handleDeleteChecklist(c.id, c.title)} disabled={deleting === c.id}
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

            {/* COMPANY FILES TAB */}
            {activeTab === 'files' && (
              <div>
                {showUpload && renderUploadPanel(currentFolderId, folders.find(f => f.id === currentFolderId)?.name)}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button onClick={() => navigateToFolder(null)} className={`text-sm transition-colors ${currentFolderId === null ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>Divisions</button>
                    {breadcrumb.map((f, i) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <span className="text-gray-300 text-xs">›</span>
                        <button onClick={() => navigateToFolder(f)} className={`text-sm transition-colors ${i === breadcrumb.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>{f.name}</button>
                      </span>
                    ))}
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

                {currentFileFolders.length > 0 && (
                  <div className="mb-4">
                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'space-y-1'}>
                      {currentFileFolders.map(folder => renderFolder(folder, navigateToFolder, handleRunAudit))}
                    </div>
                  </div>
                )}

                {breadcrumb.length < 2 && (
                  <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => { setShowNewFolder(true); setShowUpload(false) }} className="flex items-center gap-2 text-xs text-gray-400 hover:text-green-700 transition-colors px-1">
                      <span>＋</span> {currentFolderId === null ? 'New division' : 'New folder'}
                    </button>
                    {currentFolderId !== null && (
                      <button onClick={() => { setShowIndustryPicker(!showIndustryPicker); setFolderSuccess('') }} className="flex items-center gap-2 text-xs text-gray-400 hover:text-green-700 transition-colors px-1">
                        <span>＋</span> Add industry folders
                      </button>
                    )}
                  </div>
                )}

                {showIndustryPicker && (
                  <div className="mb-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs font-medium text-gray-600 mb-2">Select an industry to add its compliance folders:</p>
                    <div className="flex items-center gap-2">
                      <select className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50" value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value)}>
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
                      <button onClick={handleAddIndustryFolders} disabled={addingFolders || !selectedIndustry} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">{addingFolders ? 'Adding...' : 'Add folders'}</button>
                      <button onClick={() => { setShowIndustryPicker(false); setSelectedIndustry('') }} className="text-gray-400 hover:text-gray-600 text-sm px-2">Cancel</button>
                    </div>
                    {folderSuccess && <p className="text-xs text-green-700 mt-2">{folderSuccess}</p>}
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

            {/* HR DOCUMENTS TAB */}
            {activeTab === 'hr' && (
              <div>
                {showUpload && renderUploadPanel(hrCurrentFolderId, hrFolders.find(f => f.id === hrCurrentFolderId)?.name)}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button onClick={() => navigateToHrFolder(null)} className={`text-sm transition-colors ${hrCurrentFolderId === null ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>All HR Documents</button>
                    {hrBreadcrumb.map((f, i) => (
                      <span key={f.id} className="flex items-center gap-1">
                        <span className="text-gray-300 text-xs">›</span>
                        <button onClick={() => navigateToHrFolder(f)} className={`text-sm transition-colors ${i === hrBreadcrumb.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-400 hover:text-green-700'}`}>{f.name}</button>
                      </span>
                    ))}
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
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder('hr', hrCurrentFolderId); if (e.key === 'Escape') setShowNewFolder(false) }}
                      />
                      <button onClick={() => handleCreateFolder('hr', hrCurrentFolderId)} disabled={creatingFolder || !newFolderName.trim()} className="text-xs px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors disabled:opacity-50">{creatingFolder ? '...' : 'Create'}</button>
                      <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
                    </div>
                    {folderError && <p className="text-xs text-red-600 mt-2 pl-7">{folderError}</p>}
                  </div>
                )}

                {currentHrFolders.length > 0 && (
                  <div className="mb-4">
                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'space-y-1'}>
                      {currentHrFolders.map(folder => renderFolder(folder, navigateToHrFolder))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 mb-4">
                  <button onClick={() => { setShowNewFolder(true); setShowUpload(false) }} className="flex items-center gap-2 text-xs text-gray-400 hover:text-green-700 transition-colors px-1">
                    <span>＋</span> New folder
                  </button>
                </div>

                {currentHrFiles.length > 0 ? renderFileList(currentHrFiles) : (
                  hrCurrentFolderId ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">No files in this folder yet</p>
                      <p className="text-xs text-gray-400 mt-1">Use the Upload button to add files here</p>
                    </div>
                  ) : (
                    currentHrFolders.length === 0 && (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                        <p className="text-4xl mb-4">👥</p>
                        <p className="text-base font-medium text-gray-700 mb-1">HR Documents</p>
                        <p className="text-sm text-gray-400">Store employee handbooks, HR policies, offer letters, and training records here.</p>
                      </div>
                    )
                  )
                )}


              </div>
            )}

            {/* COMPLIANCE LOG TAB */}
            {activeTab === 'log' && (
              <div>
                {audits.length === 0 && documentReviews.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <p className="text-4xl mb-4">🔍</p>
                    <p className="text-base font-medium text-gray-700 mb-1">No compliance reports yet</p>
                    <p className="text-sm text-gray-400 mb-6">Go to Company Files, click Review on any file, or hover over a folder and click Audit</p>
                    <button onClick={() => setActiveTab('files')}
                      className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                      Go to Company Files
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mb-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Folder Gap Reports</p>
                    </div>
                    {audits.map((audit) => {
                      const isExpanded = expandedAuditId === audit.id
                      const result = audit.result_json
                      return (
                        <div key={audit.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedAuditId(isExpanded ? null : audit.id)}>
                            <span className="text-2xl flex-shrink-0">📁</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {audit.parent_folder_name ? (
                                  <span>{audit.parent_folder_name} <span className="text-gray-400 font-normal">→</span> {audit.folder_name}</span>
                                ) : audit.folder_name}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{new Date(audit.created_at).toLocaleDateString()} · {INDUSTRY_LABELS[audit.industry] || audit.industry}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {result.present?.length > 0 && <span className="text-xs text-green-600">✅ {result.present.length}</span>}
                              {result.needs_review?.length > 0 && <span className="text-xs text-amber-600">⚠️ {result.needs_review.length}</span>}
                              {result.missing?.length > 0 && <span className="text-xs text-red-500">❌ {result.missing.length}</span>}
                              <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                              <p className="text-sm text-gray-600 italic">{result.summary}</p>

                              {result.present?.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">✅ Present</p>
                                  <div className="space-y-1">
                                    {result.present.map((item, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <span className="text-xs text-green-500 mt-0.5 flex-shrink-0">✓</span>
                                        <div>
                                          <p className="text-xs font-medium text-gray-700">{item.file_name}</p>
                                          <p className="text-xs text-gray-400">{item.note}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {result.needs_review?.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">⚠️ May Need Updating</p>
                                  <div className="space-y-1">
                                    {result.needs_review.map((item, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <span className="text-xs text-amber-500 mt-0.5 flex-shrink-0">!</span>
                                        <div>
                                          <p className="text-xs font-medium text-gray-700">{item.file_name}</p>
                                          <p className="text-xs text-gray-400">{item.note}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {result.missing?.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">❌ Missing</p>
                                  <div className="space-y-2">
                                    {result.missing.map((item, i) => (
                                      <div key={i} className="flex items-start gap-2">
                                        <span className={`text-xs mt-0.5 flex-shrink-0 font-semibold ${item.priority === 'high' ? 'text-red-500' : 'text-amber-500'}`}>
                                          {item.priority === 'high' ? '●' : '○'}
                                        </span>
                                        <div>
                                          <p className="text-xs font-medium text-gray-700">{item.document}</p>
                                          <p className="text-xs text-gray-400">{item.why}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-2 flex items-center gap-3 border-t border-gray-100">
                                <button
                                  onClick={() => { const folder = folders.find(f => f.id === audit.folder_id); if (folder) handleRunAudit(folder) }}
                                  disabled={auditingFolderId === audit.folder_id}
                                  className="text-xs text-green-700 hover:text-green-800 font-medium transition-colors disabled:opacity-50">
                                  {auditingFolderId === audit.folder_id ? '⟳ Re-auditing...' : '↺ Re-audit this folder'}
                                </button>
                                <span className="text-gray-200">·</span>
                                <button onClick={() => handleDeleteAudit(audit.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Delete report</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

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

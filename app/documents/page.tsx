'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'
import { useRouter, useSearchParams } from 'next/navigation'

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

function getFileIcon(fileType: string, name: string): string {
  if (name.match(/\.(xlsx|xls|csv)$/i)) return '📊'
  if (fileType.includes('pdf') || name.endsWith('.pdf')) return '📄'
  if (fileType.includes('image')) return '🖼️'
  return '📎'
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Loading...</div>}>
      <DocumentsPageContent />
    </Suspense>
  )
}

function DocumentsPageContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const paneContainerRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<'files' | 'log'>('files')
  const [documents, setDocuments] = useState<Document[]>([])
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [primaryIndustry, setPrimaryIndustry] = useState<string>('other')
  const [deleting, setDeleting] = useState<string | null>(null)

  // Two-pane folder tree navigation
  const [selectedFolderId, setSelectedFolderId] = useState<string>('unfiled')
  const [expandedDivisions, setExpandedDivisions] = useState<Set<string>>(new Set())
  const [paneWidth, setPaneWidth] = useState(220)
  const [resizing, setResizing] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'date'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
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
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [folderError, setFolderError] = useState('')

  // Move file
  const [movingDocId, setMovingDocId] = useState<string | null>(null)
  const [moreMenuDocId, setMoreMenuDocId] = useState<string | null>(null)

  // Audit state
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null)

  // Restore remembered pane width and expanded divisions
  useEffect(() => {
    const savedWidth = localStorage.getItem('cb-docs-pane-width')
    if (savedWidth) setPaneWidth(Number(savedWidth))
    const savedExpanded = localStorage.getItem('cb-docs-expanded-divisions')
    if (savedExpanded) {
      try { setExpandedDivisions(new Set(JSON.parse(savedExpanded))) } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('cb-docs-expanded-divisions', JSON.stringify(Array.from(expandedDivisions)))
  }, [expandedDivisions])

  // Pane resize drag handling
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizing || !paneContainerRef.current) return
      const rect = paneContainerRef.current.getBoundingClientRect()
      const newWidth = Math.min(360, Math.max(160, e.clientX - rect.left))
      setPaneWidth(newWidth)
    }
    function onMouseUp() {
      setResizing(false)
    }
    if (resizing) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizing])

  useEffect(() => {
    if (!resizing) localStorage.setItem('cb-docs-pane-width', String(paneWidth))
  }, [resizing, paneWidth])

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

        // If we arrived via a direct link to a specific review (e.g. from an
        // Audit result), jump straight to it instead of landing on Files.
        const reviewParam = searchParams.get('review')
        if (reviewParam) {
          setActiveTab('log')
          setExpandedAuditId(reviewParam)
        }

        const { data: company } = await supabase
          .from('companies')
          .select('industry')
          .eq('id', profile.company_id)
          .single()
        if (company?.industry) setPrimaryIndustry(company.industry)
      }

      await loadDocuments(user.id, 'unfiled')
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

  async function loadDocuments(uid: string, folderId: string) {
    const res = await fetch(`/api/documents?user_id=${uid}&folder_id=${folderId}`)
    const json = await res.json()
    if (json.data) setDocuments(json.data)
  }

  async function loadDocumentReviews(cid: string) {
    const res = await fetch(`/api/document-review?company_id=${cid}`)
    const json = await res.json()
    if (json.data) setDocumentReviews(json.data)
  }

  async function selectFolder(folderId: string) {
    if (!userId) return
    setSelectedFolderId(folderId)
    await loadDocuments(userId, folderId)
  }

  function toggleDivision(id: string) {
    setExpandedDivisions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSort(field: 'name' | 'date') {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
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
      await loadDocuments(userId, selectedFolderId)
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
      if (parentId) setExpandedDivisions(prev => new Set(prev).add(parentId))
      setNewFolderName('')
      setNewFolderParentId(undefined)
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
    if (selectedFolderId === id) await selectFolder('unfiled')
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

  async function handleMoveDocument(docId: string, targetFolderId: string | null) {
    await fetch('/api/documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId, folder_id: targetFolderId }),
    })
    setMovingDocId(null)
    if (userId) {
      await loadDocuments(userId, selectedFolderId)
      await loadAllDocuments(userId)
    }
  }

  async function handleDownload(doc: Document) {
    const { data } = await supabase.storage.from('company-documents').createSignedUrl(doc.file_url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

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
      const folder = folders.find(f => f.id === doc.folder_id)
      const division = folder?.parent_id ? folders.find(f => f.id === folder.parent_id) : folder
      fd.append('folder_name', folder?.name || '')
      fd.append('division_name', division?.name || '')
      const res = await fetch('/api/document-review', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.data) {
        setDocumentReviews(prev => [json.data, ...prev.filter(r => r.document_id !== doc.id)])
        setActiveTab('log')
        setExpandedAuditId(json.data.id)
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

  const tabs = [
    { key: 'files', label: 'Company Files' },
    { key: 'log', label: 'Document Reviews' },
  ] as const

  function countFilesRecursive(folderId: string): number {
    const direct = allDocuments.filter(d => d.folder_id === folderId).length
    const childFolders = folders.filter(f => f.parent_id === folderId)
    const nested = childFolders.reduce((sum, child) => sum + countFilesRecursive(child.id), 0)
    return direct + nested
  }

  const unfiledCount = allDocuments.filter(d => d.folder_id === null).length
  const divisions = folders.filter(f => f.section === 'files' && f.parent_id === null)
  const selectedFolderName = selectedFolderId === 'unfiled' ? 'Unfiled' : (folders.find(f => f.id === selectedFolderId)?.name || 'Unfiled')

  const sortedDocuments = [...documents].sort((a, b) => {
    const cmp = sortField === 'name'
      ? a.name.localeCompare(b.name)
      : new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
    return sortDir === 'asc' ? cmp : -cmp
  })

  const moveTargets = [
    { id: null as string | null, name: 'Unfiled' },
    ...folders.filter(f => f.section === 'files').map(f => ({ id: f.id as string | null, name: f.name })),
  ].sort((a, b) => (a.id === null ? -1 : b.id === null ? 1 : a.name.localeCompare(b.name)))

  return (
    <AppLayout title="Company Documents" didYouKnow={activeTab === 'log' ? { icon: '🔍', text: 'Every file you review gets a real compliance check — CompliBoard cites the specific regulation it checked against and gives you a fix for anything missing.' } : { icon: '📂', text: 'Upload your compliance documents once. CompliBoard reads them, extracts renewal dates, and adds them to your calendar automatically. Every month, CompliBoard checks if your documents are still current and alerts you 30 days before anything expires.' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Company Documents</h1>
            <p className="text-sm text-gray-400">Your compliance files and document reviews</p>
          </div>
          {activeTab === 'files' && (
            <div className="relative">
              <button onClick={() => setShowUploadMenu(!showUploadMenu)}
                className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                + Upload file / Connect drive
              </button>
              {showUploadMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUploadMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-20">
                    <button onClick={() => { setShowUpload(true); setShowUploadMenu(false) }}
                      className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                      <span>💻</span> From computer
                    </button>
                    <div className="w-full text-left px-4 py-3 text-sm text-gray-400 flex items-center gap-2 cursor-not-allowed border-t border-gray-50">
                      <span>☁️</span> Google Drive — soon
                    </div>
                    <div className="w-full text-left px-4 py-3 text-sm text-gray-400 flex items-center gap-2 cursor-not-allowed border-t border-gray-50">
                      <span>☁️</span> OneDrive — soon
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 mb-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`text-sm pb-3 font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
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
            {activeTab === 'files' && (
              <div ref={paneContainerRef} className="flex items-start">

                {/* LEFT PANE — folder tree */}
                <div style={{ width: paneWidth, flexShrink: 0 }} className="pr-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Folders</p>
                    <button onClick={() => { setNewFolderParentId(null); setNewFolderName('') }}
                      className="text-gray-400 hover:text-green-700 transition-colors text-sm leading-none" title="New division">+</button>
                  </div>

                  {newFolderParentId === null && (
                    <div className="mb-2 flex items-center gap-1">
                      <input type="text" autoFocus
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-green-500"
                        placeholder="Division name" value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder('files', null); if (e.key === 'Escape') setNewFolderParentId(undefined) }}
                      />
                      <button onClick={() => handleCreateFolder('files', null)} disabled={creatingFolder || !newFolderName.trim()}
                        className="text-xs px-2 py-1 rounded bg-green-700 text-white disabled:opacity-50">✓</button>
                      <button onClick={() => setNewFolderParentId(undefined)} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
                    </div>
                  )}
                  {folderError && newFolderParentId === null && <p className="text-xs text-red-600 mb-2">{folderError}</p>}

                  <button onClick={() => selectFolder('unfiled')}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors mb-0.5 ${selectedFolderId === 'unfiled' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <span>📄</span>
                    <span className="flex-1 text-left truncate">Unfiled{unfiledCount > 0 ? ` (${unfiledCount})` : ''}</span>
                  </button>

                  {divisions.map(div => {
                    const isExpanded = expandedDivisions.has(div.id)
                    const subfolders = folders.filter(f => f.parent_id === div.id)
                    const isSelected = selectedFolderId === div.id
                    const isRenaming = renamingId === div.id
                    return (
                      <div key={div.id} className="group">
                        {isRenaming ? (
                          <div className="flex items-center gap-1 px-2 py-1">
                            <input type="text" autoFocus
                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-green-500"
                              value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(div.id); if (e.key === 'Escape') setRenamingId(null) }}
                            />
                            <button onClick={() => handleRenameFolder(div.id)} className="text-xs px-2 py-1 rounded bg-green-700 text-white">✓</button>
                            <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                            <button onClick={() => toggleDivision(div.id)} className="text-gray-300 hover:text-gray-500 text-[10px] w-3 flex-shrink-0">
                              {isExpanded ? '▾' : '▸'}
                            </button>
                            <button onClick={() => selectFolder(div.id)}
                              className={`flex-1 flex items-center gap-2 text-left text-sm min-w-0 ${isSelected ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                              <span>📁</span>
                              <span className="truncate">{div.name}{countFilesRecursive(div.id) > 0 ? ` (${countFilesRecursive(div.id)})` : ''}</span>
                            </button>
                            <button onClick={() => { setNewFolderParentId(div.id); setNewFolderName(''); setExpandedDivisions(prev => new Set(prev).add(div.id)) }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-green-700 transition-opacity text-sm leading-none flex-shrink-0" title="New folder">+</button>
                          </div>
                        )}

                        {newFolderParentId === div.id && (
                          <div className="flex items-center gap-1 pl-6 pr-2 py-1">
                            <input type="text" autoFocus
                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-green-500"
                              placeholder="Folder name" value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder('files', div.id); if (e.key === 'Escape') setNewFolderParentId(undefined) }}
                            />
                            <button onClick={() => handleCreateFolder('files', div.id)} disabled={creatingFolder || !newFolderName.trim()}
                              className="text-xs px-2 py-1 rounded bg-green-700 text-white disabled:opacity-50">✓</button>
                            <button onClick={() => setNewFolderParentId(undefined)} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
                          </div>
                        )}
                        {folderError && newFolderParentId === div.id && <p className="text-xs text-red-600 pl-6 mb-1">{folderError}</p>}

                        {isExpanded && subfolders.map(sf => {
                          const sfSelected = selectedFolderId === sf.id
                          const sfRenaming = renamingId === sf.id
                          return (
                            <div key={sf.id} className="group/sf">
                              {sfRenaming ? (
                                <div className="flex items-center gap-1 pl-6 pr-2 py-1">
                                  <input type="text" autoFocus
                                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-green-500"
                                    value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(sf.id); if (e.key === 'Escape') setRenamingId(null) }}
                                  />
                                  <button onClick={() => handleRenameFolder(sf.id)} className="text-xs px-2 py-1 rounded bg-green-700 text-white">✓</button>
                                  <button onClick={() => setRenamingId(null)} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
                                </div>
                              ) : (
                                <div className={`flex items-center gap-1 pl-6 pr-2 py-1.5 rounded-lg transition-colors ${sfSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                  <button onClick={() => selectFolder(sf.id)}
                                    className={`flex-1 flex items-center gap-2 text-left text-sm min-w-0 ${sfSelected ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                                    <span className="truncate">{sf.name}{countFilesRecursive(sf.id) > 0 ? ` (${countFilesRecursive(sf.id)})` : ''}</span>
                                  </button>
                                  <div className="opacity-0 group-hover/sf:opacity-100 transition-opacity flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={() => { setRenamingId(sf.id); setRenameValue(sf.name) }} className="text-gray-400 hover:text-green-700 text-xs">Rename</button>
                                    <button onClick={() => handleDeleteFolder(sf.id, sf.name)} className="text-gray-400 hover:text-red-500 text-xs">Delete</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>

                {/* Resize divider */}
                <div
                  onMouseDown={() => setResizing(true)}
                  className="w-px bg-gray-200 hover:bg-green-400 active:bg-green-500 cursor-col-resize flex-shrink-0 self-stretch"
                  style={{ minHeight: '200px' }}
                />

                {/* RIGHT PANE — file list */}
                <div className="flex-1 min-w-0 pl-4">
                  {showUpload && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-gray-900">Upload files</h2>
                          <span className="text-xs text-green-600">→ {selectedFolderName}</span>
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
                        <button onClick={() => handleUpload(selectedFolderId === 'unfiled' ? null : selectedFolderId)} disabled={files.length === 0 || uploading}
                          className="w-full bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
                          {uploading ? uploadProgress || 'Uploading...' : `Upload ${files.length > 1 ? files.length + ' files' : 'file'} →`}
                        </button>
                      </div>
                    </div>
                  )}

                  {sortedDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-gray-400">No files in {selectedFolderName}</p>
                      <p className="text-xs text-gray-400 mt-1">Use the Upload button to add files here</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-100">
                        <span className="flex-shrink-0" style={{ width: '28px' }} />
                        <button onClick={() => toggleSort('name')} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                          Name {sortField === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                        </button>
                        <div className="flex-1" />
                        <button onClick={() => toggleSort('date')} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 w-20 text-right">
                          Date {sortField === 'date' && (sortDir === 'asc' ? '▲' : '▼')}
                        </button>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {sortedDocuments.map((doc) => {
                          const review = documentReviews.find(r => r.document_id === doc.id)
                          return (
                            <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                              <span className="text-lg flex-shrink-0">{getFileIcon(doc.file_type, doc.name)}</span>
                              <p className="text-sm text-gray-900 truncate flex-shrink-0" style={{ maxWidth: '380px' }}>{doc.name}</p>
                              {doc.is_recurring && <span className="text-xs text-green-600 flex-shrink-0">🔄 {doc.recurrence_period}</span>}

                              <div className="relative flex-shrink-0">
                                <button onClick={() => setMoreMenuDocId(moreMenuDocId === doc.id ? null : doc.id)}
                                  className="text-gray-400 hover:text-gray-700 text-xs px-1 leading-none transition-colors">▾</button>
                                {moreMenuDocId === doc.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setMoreMenuDocId(null)} />
                                    <div className="absolute left-0 mt-1 w-40 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                                      <button onClick={() => handleExtractDates(doc)} disabled={extractingDates === doc.id}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                                        {extractingDates === doc.id ? 'Extracting...' : 'Extract dates'}
                                      </button>
                                      <button onClick={() => handleScanDocument(doc)} disabled={scanningDoc === doc.id}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 border-t border-gray-50">
                                        {scanningDoc === doc.id ? 'Reviewing...' : 'Review'}
                                      </button>
                                      <button onClick={() => handleDownload(doc)}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-50">
                                        Download
                                      </button>
                                      <button onClick={() => { setMoreMenuDocId(null); setMovingDocId(doc.id) }}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-50">
                                        Move
                                      </button>
                                      <button onClick={() => handleDeleteDoc(doc)} disabled={deleting === doc.id}
                                        className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 border-t border-gray-50">
                                        {deleting === doc.id ? 'Deleting...' : 'Delete'}
                                      </button>
                                    </div>
                                  </>
                                )}
                                {movingDocId === doc.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setMovingDocId(null)} />
                                    <div className="absolute left-0 mt-1 w-48 max-h-64 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-20">
                                      {moveTargets.map(t => (
                                        <button key={t.id ?? 'unfiled'} onClick={() => handleMoveDocument(doc.id, t.id)}
                                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors truncate">
                                          {t.name}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>

                              <div className="flex-1" />

                              {review && (
                                <button onClick={() => { setActiveTab('log'); setExpandedAuditId(review.id) }}
                                  className="text-xs text-green-600 font-medium hover:text-green-800 hover:underline transition-colors whitespace-nowrap flex-shrink-0">
                                  ✓ Reviewed {new Date(review.created_at).toLocaleDateString()}
                                </button>
                              )}
                              <span className="text-xs text-gray-400 flex-shrink-0 w-20 text-right">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">
                        {sortedDocuments.length} file{sortedDocuments.length !== 1 ? 's' : ''} · Stored securely and only accessible by your account
                      </p>
                    </div>
                  )}
                </div>
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
                                  const doc = documents.find(d => d.id === review.document_id) || allDocuments.find(d => d.id === review.document_id)
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

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

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

export default function DocumentsPage() {
  const supabase = createClient()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function loadDocuments() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const res = await fetch(`/api/documents?user_id=${user.id}`)
      const json = await res.json()
      if (json.data) setDocuments(json.data)
      setLoading(false)
    }
    loadDocuments()
  }, [])

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete ${doc.name}?`)) return
    setDeleting(doc.id)
    try {
      const res = await fetch(`/api/documents?id=${doc.id}&file_url=${encodeURIComponent(doc.file_url)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== doc.id))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setDeleting(null)
    }
  }

  async function handleDownload(doc: Document) {
    const { data } = await supabase.storage
      .from('company-documents')
      .createSignedUrl(doc.file_url, 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const docCategories = Array.from(new Set(documents.map(d => d.category))).sort()
  const categories = ['all', 'checklists', ...docCategories]
  const filtered = selectedCategory === 'all'
    ? documents
    : documents.filter(d => d.category === selectedCategory)

  return (
    <AppLayout title="My Files">
      <div className="max-w-4xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">My Files</h1>
            <p className="text-sm text-gray-400">View and manage your uploaded compliance documents</p>
          </div>
          <a href="/upload"
            className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
            + Upload file
          </a>
        </div>

        {documents.length > 0 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-green-700 text-white border-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-700'
                }`}>
                {cat === 'all' ? 'All files' : cat === 'checklists' ? 'Checklists' : (CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' '))}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">Loading your files...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <p className="text-4xl mb-4">📁</p>
            <p className="text-base font-medium text-gray-700 mb-1">No files yet</p>
            <p className="text-sm text-gray-400 mb-6">Upload your first compliance document to get started</p>
            <a href="/upload"
              className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
              Upload a file
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {filtered.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <span className="text-2xl flex-shrink-0">{getFileIcon(doc.file_type, doc.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <div className="grid grid-cols-4 gap-4 mt-1" style={{maxWidth:'480px'}}>
                      <span className="text-xs text-gray-500 truncate">{CATEGORY_LABELS[doc.category] || doc.category.charAt(0).toUpperCase() + doc.category.slice(1).replace(/-/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</span>
                      <span className="text-xs text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                      <span className="text-xs text-green-600">{doc.is_recurring ? '🔄 ' + doc.recurrence_period : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deleting === doc.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50">
                      {deleting === doc.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">
            {filtered.length} file{filtered.length !== 1 ? 's' : ''} · Files are stored securely and only accessible by your account
          </p>
        )}

      </div>
    </AppLayout>
  )
}

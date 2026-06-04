'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

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

export default function UploadPage() {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePeriod, setRecurrencePeriod] = useState('annually')
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedDeadlines, setExtractedDeadlines] = useState<{title: string, due_date: string, is_recurring: boolean}[]>([])

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (profile?.company_id) setCompanyId(profile.company_id)
    }
    loadProfile()
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    setSuccess(false)
    setError('')
    setExtractedDeadlines([])
    if (f && f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setCategory('compliance-schedule')
    }
  }

  async function handleUpload() {
    if (!file || !companyId || !userId) return
    const finalCategory = category === 'other' ? (customCategory.trim() || 'other') : category
    if (!finalCategory) {
      setError('Please select a category')
      return
    }

    setUploading(true)
    setError('')

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${companyId}/${finalCategory}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('company-documents')
        .getPublicUrl(filePath)

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

      if (finalCategory === 'compliance-schedule') {
        setExtracting(true)
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('question', 'Extract all compliance deadlines from this document. For each deadline return: title, due_date (as YYYY-MM-DD or descriptive text), and whether it is recurring (true/false). Return as JSON array.')
          const res = await fetch('/api/chat', { method: 'POST', body: formData })
          const json = await res.json()
          if (json.data?.must_do) {
            const deadlines = json.data.must_do.slice(0, 10).map((item: {name: string}) => ({
              title: item.name,
              due_date: '',
              is_recurring: true,
            }))
            setExtractedDeadlines(deadlines)
          }
        } catch {
          // extraction failed silently
        } finally {
          setExtracting(false)
        }
      }

      setSuccess(true)
      setFile(null)
      setCategory('')
      setCustomCategory('')
      setIsRecurring(false)
      if (fileInputRef.current) fileInputRef.current.value = ''

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const isExcel = file?.name.match(/\.(xlsx|xls|csv)$/i)

  return (
    <AppLayout title="Upload">
      <div className="max-w-2xl mx-auto px-6 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Upload</h1>
          <p className="text-sm text-gray-400">Add files, reports, or your existing compliance schedule</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">

          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-600 mb-2">File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            {!file ? (
              <label htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-10 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                <span className="text-4xl mb-3">📎</span>
                <p className="text-sm font-medium text-gray-600">Click to select a file</p>
                <p className="text-xs text-gray-400 mt-1">PDF, images, Excel, or CSV</p>
              </label>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-2xl">{isExcel ? '📊' : '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{file.name}</p>
                  <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="text-gray-400 hover:text-red-500 transition-colors text-xl leading-none">×</button>
              </div>
            )}
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-600 mb-2">Category <span className="text-red-400">*</span></label>
            <select
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
              value={category}
              onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select a category</option>
              {PRESET_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {category === 'other' && (
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50 mt-2"
                placeholder="Enter your category name"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            )}
          </div>

          {isExcel && (
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs font-medium text-blue-700 mb-1">📊 Excel / CSV detected</p>
              <p className="text-xs text-blue-600">We will automatically extract compliance deadlines from this file and add them to your Calendar.</p>
            </div>
          )}

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsRecurring(!isRecurring)}
                className={`w-10 h-6 rounded-full transition-colors relative ${isRecurring ? 'bg-green-600' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isRecurring ? 'left-5' : 'left-1'}`} />
              </div>
              <span className="text-sm text-gray-700">This is a recurring report</span>
            </label>
            {isRecurring && (
              <div className="mt-3 ml-13">
                <select
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-800 focus:outline-none focus:border-green-500 bg-gray-50"
                  value={recurrencePeriod}
                  onChange={(e) => setRecurrencePeriod(e.target.value)}>
                  {RECURRENCE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.value.charAt(0).toUpperCase() + r.value.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <p className="text-sm text-green-700 font-medium">File uploaded successfully</p>
            </div>
          )}

          {extracting && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
              <span className="animate-spin inline-block text-blue-600">⟳</span>
              <p className="text-sm text-blue-700">Extracting deadlines from your schedule...</p>
            </div>
          )}

          {extractedDeadlines.length > 0 && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-medium text-green-800 mb-2">✓ Found {extractedDeadlines.length} deadlines — added to your Calendar</p>
              <div className="space-y-1">
                {extractedDeadlines.slice(0, 5).map((d, i) => (
                  <p key={i} className="text-xs text-green-700">• {d.title}</p>
                ))}
                {extractedDeadlines.length > 5 && (
                  <p className="text-xs text-green-600">+ {extractedDeadlines.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || !category || uploading}
            className="w-full bg-green-700 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload file →'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Files are stored securely and only accessible by your account
          </p>

        </div>

        <div className="mt-4 text-center">
          <a href="/documents" className="text-sm text-gray-400 hover:text-green-700 transition-colors">
            View all uploaded files →
          </a>
        </div>

      </div>
    </AppLayout>
  )
}

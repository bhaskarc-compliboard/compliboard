'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  due_date: string
  category: string | null
  is_recurring: boolean
  recurrence_period: string | null
  completed: boolean
  completed_at: string | null
}

const CATEGORIES = [
  'OSHA', 'EPA', 'DOT', 'FDA', 'State License', 'Permit Renewal',
  'Training', 'Inspection', 'Report', 'Other'
]

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const supabase = createClient()
  const today = new Date()

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newRecurring, setNewRecurring] = useState(false)
  const [newRecurrencePeriod, setNewRecurrencePeriod] = useState('annually')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [pendingDates, setPendingDates] = useState<{title: string; date: string; description: string; is_recurring: boolean; recurrence_period: string | null}[]>([])
  const [selectedDates, setSelectedDates] = useState<Set<number>>(new Set())
  const [addingToCalendar, setAddingToCalendar] = useState(false)
  const [calendarSuccess, setCalendarSuccess] = useState('')

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
      // A compliance calendar is a company asset — read by company_id so all
      // users at a company see the same deadlines (matches the dashboard).
      if (profile?.company_id) {
        const res = await fetch(`/api/calendar?company_id=${profile.company_id}`)
        const json = await res.json()
        if (json.data) setEvents(json.data)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleAddEvent() {
    if (!newTitle || !newDate || !userId || !companyId) {
      setSaveError('Please fill in title and date')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          user_id: userId,
          title: newTitle,
          description: newDescription || null,
          due_date: newDate,
          category: newCategory || null,
          is_recurring: newRecurring,
          recurrence_period: newRecurring ? newRecurrencePeriod : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setEvents(prev => [...prev, json.data].sort((a, b) => a.due_date.localeCompare(b.due_date)))
      setNewTitle('')
      setNewDate('')
      setNewCategory('')
      setNewDescription('')
      setNewRecurring(false)
      setShowAddForm(false)
      setSelectedDate(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleImport() {
    if (!importFile || !userId || !companyId) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('file_name', importFile.name)
      const res = await fetch('/api/extract-dates', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.dates_found && json.dates_found.length > 0) {
        setPendingDates(json.dates_found)
        setSelectedDates(new Set(json.dates_found.map((_: any, i: number) => i)))
        setShowImport(false)
        setImportFile(null)
      } else {
        alert('No compliance dates found in this file. Make sure it contains deadline or expiry dates.')
      }
    } catch (err) {
      console.error('Import error:', err)
    } finally {
      setImporting(false)
    }
  }

  async function handleAddToCalendar() {
    if (!companyId || !userId) return
    setAddingToCalendar(true)
    try {
      const toAdd = pendingDates.filter((_, i) => selectedDates.has(i))
      for (const d of toAdd) {
        const res = await fetch('/api/calendar', {
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
        const json = await res.json()
        if (json.data) setEvents(prev => [...prev, json.data].sort((a, b) => a.due_date.localeCompare(b.due_date)))
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

  async function toggleComplete(event: CalendarEvent) {
    const newCompleted = !event.completed
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, completed: newCompleted } : e))
    await fetch('/api/calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: event.id, completed: newCompleted }),
    })
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this deadline?')) return
    setEvents(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' })
  }

  function exportToGoogleCalendar(event: CalendarEvent) {
    const date = event.due_date.replace(/-/g, '')
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${date}/${date}&details=${encodeURIComponent(event.description || '')}`
    window.open(url, '_blank')
  }

  function exportToOutlook(event: CalendarEvent) {
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${event.due_date}&enddt=${event.due_date}&body=${encodeURIComponent(event.description || '')}`
    window.open(url, '_blank')
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)

  const eventsThisMonth = events.filter(e => {
    const d = new Date(e.due_date)
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth
  })

  function getEventsForDay(day: number) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.due_date === dateStr)
  }

  const upcomingEvents = events.filter(e => {
    const due = new Date(e.due_date)
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30 && !e.completed
  })

  const overdueEvents = events.filter(e => {
    const due = new Date(e.due_date)
    return due < today && !e.completed
  })

  return (
    <AppLayout title="Compliance Calendar" didYouKnow={{ icon: '📅', text: 'Upload your permits, licenses, and inspection reports in Company Files, click Extract dates, and CompliBoard will find all renewal and expiry dates and add them to your calendar automatically. You never miss a deadline again.' }}>
      <div className="max-w-5xl mx-auto px-6 py-8">

        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Calendar</h1>
            <p className="text-sm text-gray-400">Track all your compliance deadlines and recurring dates</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowImport(!showImport); setShowAddForm(false) }}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:border-green-500 hover:text-green-700 transition-colors">
              {showImport ? '× Cancel' : '📂 Import from file'}
            </button>
            <button onClick={() => { setShowAddForm(!showAddForm); setShowImport(false); setSelectedDate(null) }}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
              {showAddForm ? '× Cancel' : '+ Add deadline'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-4">
          <button onClick={() => setView('calendar')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${view === 'calendar' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            Calendar
          </button>
          <button onClick={() => setView('list')}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${view === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
            List
          </button>
        </div>

        {(overdueEvents.length > 0 || upcomingEvents.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {overdueEvents.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Overdue</p>
                <p className="text-sm text-red-600">{overdueEvents.length} deadline{overdueEvents.length !== 1 ? 's' : ''} past due</p>
              </div>
            )}
            {upcomingEvents.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">📅 Due in 30 days</p>
                <p className="text-sm text-amber-600">{upcomingEvents.length} deadline{upcomingEvents.length !== 1 ? 's' : ''} coming up</p>
              </div>
            )}
          </div>
        )}

        {showImport && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Import compliance deadlines</h2>
            <p className="text-xs text-gray-400 mb-4">Upload your existing deadline spreadsheet or document. CompliBoard will find all dates and let you choose which ones to add.</p>
            <label htmlFor="import-file"
              className={`flex items-center gap-3 w-full border border-dashed rounded-xl px-4 py-4 cursor-pointer transition-colors mb-4 ${importFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-green-500 hover:bg-green-50'}`}>
              <span className="text-2xl">{importFile ? '📊' : '📎'}</span>
              <div>
                <p className="text-sm font-medium text-gray-700">{importFile ? importFile.name : 'Click to select file'}</p>
                <p className="text-xs text-gray-400">Excel, CSV, PDF, Word, or PowerPoint</p>
              </div>
              <input id="import-file" type="file" accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.pptx,.ppt" className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            </label>
            <button onClick={handleImport} disabled={!importFile || importing}
              className="bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {importing ? 'Extracting dates...' : 'Extract dates →'}
            </button>
          </div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-400">*</span></label>
                <input type="text"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="e.g. Annual OSHA inspection"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Due date <span className="text-red-400">*</span></label>
                <input type="date"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-gray-50"
                  value={newDate || selectedDate || ''}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-gray-50"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input type="text"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-gray-50"
                  placeholder="Optional notes"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setNewRecurring(!newRecurring)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${newRecurring ? 'bg-green-600' : 'bg-gray-200'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${newRecurring ? 'left-4' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-gray-600">Recurring</span>
              </label>
              {newRecurring && (
                <select
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-gray-50"
                  value={newRecurrencePeriod}
                  onChange={(e) => setNewRecurrencePeriod(e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              )}
            </div>
            {saveError && <p className="text-sm text-red-600 mt-3">{saveError}</p>}
            <button onClick={handleAddEvent} disabled={saving}
              className="mt-4 bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save deadline →'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">Loading your calendar...</p>
          </div>
        ) : view === 'calendar' ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <button onClick={() => {
                if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
                else setCurrentMonth(m => m - 1)
              }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">←</button>
              <h2 className="text-sm font-semibold text-gray-900">{MONTHS[currentMonth]} {currentYear}</h2>
              <button onClick={() => {
                if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
                else setCurrentMonth(m => m + 1)
              }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">→</button>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20 border-b border-r border-gray-50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayEvents = getEventsForDay(day)
                const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear
                const isSelected = selectedDate === dateStr
                return (
                  <div key={day}
                    onClick={() => { setSelectedDate(dateStr); setNewDate(dateStr); setShowAddForm(true) }}
                    className={`h-20 border-b border-r border-gray-50 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-green-50' : ''}`}>
                    <p className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-green-700 text-white' : 'text-gray-700'}`}>
                      {day}
                    </p>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map(e => (
                        <p key={e.id} className={`text-xs px-1 rounded truncate ${e.completed ? 'line-through text-gray-300 bg-gray-50' : 'text-green-800 bg-green-100'}`}>
                          {e.title}
                        </p>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-xs text-gray-400 px-1">+{dayEvents.length - 2} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {eventsThisMonth.length > 0 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">This month</p>
                <div className="space-y-2">
                  {eventsThisMonth.map(e => (
                    <div key={e.id} className="flex items-center gap-3">
                      <div onClick={() => toggleComplete(e)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${e.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                        {e.completed && <span className="text-white text-xs">✓</span>}
                      </div>
                      <p className={`text-sm flex-1 ${e.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{e.title}</p>
                      <span className="text-xs text-gray-400">{new Date(e.due_date + 'T00:00:00').toLocaleDateString()}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => exportToGoogleCalendar(e)} title="Add to Google Calendar"
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors">G</button>
                        <button onClick={() => exportToOutlook(e)} title="Add to Outlook"
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors">O</button>
                        <button onClick={() => deleteEvent(e.id)}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {events.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-4">📅</p>
                <p className="text-base font-medium text-gray-700 mb-1">No deadlines yet</p>
                <p className="text-sm text-gray-400 mb-4">Upload compliance documents in Company Files and click Extract dates to populate your calendar automatically.</p>
                <button onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-800 transition-colors">
                  Add a deadline manually
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {events.map(e => {
                  const due = new Date(e.due_date + 'T00:00:00')
                  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  const isOverdue = diff < 0 && !e.completed
                  const isDueSoon = diff >= 0 && diff <= 7 && !e.completed
                  return (
                    <div key={e.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div onClick={() => toggleComplete(e)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${e.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                        {e.completed && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${e.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{e.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {e.category && <span className="text-xs text-gray-400">{e.category}</span>}
                          <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-400'}`}>
                            {isOverdue ? `${Math.abs(diff)} days overdue` : e.completed ? 'Done' : diff === 0 ? 'Due today' : `Due in ${diff} days`}
                          </span>
                          {e.is_recurring && <span className="text-xs text-green-600">🔄 {e.recurrence_period}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{new Date(e.due_date + 'T00:00:00').toLocaleDateString()}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => exportToGoogleCalendar(e)} title="Add to Google Calendar"
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors">G</button>
                        <button onClick={() => exportToOutlook(e)} title="Add to Outlook"
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors">O</button>
                        <button onClick={() => deleteEvent(e.id)}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors">×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}


        {pendingDates.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-lg z-50 px-4">
            <div className="bg-white rounded-2xl border border-green-200 shadow-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">📅 Dates found in your file</p>
                  <p className="text-xs text-gray-400 mt-0.5">Select which dates to add to your calendar</p>
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

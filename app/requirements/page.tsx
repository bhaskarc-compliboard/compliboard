'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import AIDisclaimer from '@/components/AIDisclaimer'

interface RequirementTemplate {
  id: string
  category: string | null
  requirement_name: string
  citation: string | null
  cadence: string | null
  applies: string
  trigger_plain: string | null
  entity_type: string
  evidence_description: string | null
  fails_if: string | null
  priority: string
  layer: string
  jurisdiction_state: string | null
  jurisdiction_county: string | null
}

interface Obligation {
  id: string
  status: string
  due_date: string | null
  last_verified_at: string | null
  notes: string | null
  entity_id: string | null
  requirement_templates: RequirementTemplate
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  standard: 'bg-gray-50 text-gray-500 border-gray-200',
}

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  missing: { label: 'Missing', dot: 'bg-red-400', text: 'text-red-600' },
  at_risk: { label: 'At risk', dot: 'bg-amber-400', text: 'text-amber-600' },
  expiring_soon: { label: 'Expiring soon', dot: 'bg-amber-400', text: 'text-amber-600' },
  satisfied: { label: 'Satisfied', dot: 'bg-green-500', text: 'text-green-600' },
  not_applicable: { label: 'Not applicable', dot: 'bg-gray-300', text: 'text-gray-400' },
  unconfirmed: { label: 'Unconfirmed — may apply', dot: 'bg-blue-400', text: 'text-blue-600' },
}

type FilterKey = 'all' | 'needs_attention' | 'unconfirmed' | 'satisfied'

export default function RequirementsPage() {
  const supabase = createClient()
  const [companyName, setCompanyName] = useState('')
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<FilterKey>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()
      if (!profile?.company_id) {
        setLoading(false)
        return
      }
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', profile.company_id)
        .single()
      if (company?.name) setCompanyName(company.name)

      try {
        const res = await fetch(`/api/obligations?company_id=${profile.company_id}`)
        const json = await res.json()
        if (json.error) {
          setError(json.error)
        } else {
          setObligations(json.data || [])
        }
      } catch (err) {
        setError('Could not load requirements.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const needsAttention = obligations.filter((o) => o.status === 'missing' || o.status === 'at_risk' || o.status === 'expiring_soon')
  const unconfirmed = obligations.filter((o) => o.status === 'unconfirmed')
  const satisfied = obligations.filter((o) => o.status === 'satisfied')

  const filtered = obligations.filter((o) => {
    if (filter === 'needs_attention') return o.status === 'missing' || o.status === 'at_risk' || o.status === 'expiring_soon'
    if (filter === 'unconfirmed') return o.status === 'unconfirmed'
    if (filter === 'satisfied') return o.status === 'satisfied'
    return true
  })

  const grouped = filtered.reduce<Record<string, Obligation[]>>((acc, o) => {
    const cat = o.requirement_templates?.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(o)
    return acc
  }, {})

  return (
    <AppLayout
      title="Requirements"
      didYouKnow={{
        icon: '📚',
        text: 'This list is matched automatically from a master requirements database for your industry and state. Items marked "Unconfirmed" could not be determined from your profile alone — a website being silent about something is never treated as proof it does not apply. Confirm those in passing as you go, or they will resolve on their own as you upload documents.',
      }}
    >
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Requirements</h1>
          <p className="text-sm text-gray-400">
            {companyName ? `Every requirement matched to ${companyName}` : 'Every requirement matched to your business'}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        ) : obligations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <p className="text-4xl mb-4">📚</p>
            <p className="text-base font-medium text-gray-700 mb-1">No requirements matched yet</p>
            <p className="text-sm text-gray-400">Requirements are matched automatically once your industry and state are set.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-semibold text-red-600">{needsAttention.length}</p>
                <p className="text-xs text-gray-400 mt-1">Need attention</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-semibold text-blue-500">{unconfirmed.length}</p>
                <p className="text-xs text-gray-400 mt-1">Unconfirmed</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-semibold text-green-600">{satisfied.length}</p>
                <p className="text-xs text-gray-400 mt-1">Satisfied</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-semibold text-gray-700">{obligations.length}</p>
                <p className="text-xs text-gray-400 mt-1">Total</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {([
                ['all', 'All'],
                ['needs_attention', 'Needs attention'],
                ['unconfirmed', 'Unconfirmed'],
                ['satisfied', 'Satisfied'],
              ] as [FilterKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    filter === key
                      ? 'border-green-600 bg-green-50 text-green-700 font-medium'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-8">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{category}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="space-y-3">
                    {items.map((o) => {
                      const rt = o.requirement_templates
                      const isOpen = expanded[o.id]
                      const statusStyle = STATUS_STYLES[o.status] || STATUS_STYLES.missing
                      return (
                        <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${PRIORITY_STYLES[rt?.priority] || PRIORITY_STYLES.standard}`}>
                                  {rt?.priority || 'standard'}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                  <span className={`text-xs font-medium ${statusStyle.text}`}>{statusStyle.label}</span>
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{rt?.requirement_name}</p>
                              {rt?.citation && <p className="text-xs text-gray-400 mt-0.5">{rt.citation}</p>}
                              {rt?.applies === 'conditional' && rt?.trigger_plain && (
                                <p className="text-xs text-blue-600 mt-1.5 italic">{rt.trigger_plain}</p>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => setExpanded((prev) => ({ ...prev, [o.id]: !prev[o.id] }))}
                            className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {isOpen ? '▲ Less detail' : '▼ More detail'}
                          </button>

                          {isOpen && (
                            <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
                              {rt?.cadence && (
                                <div>
                                  <p className="text-xs font-medium text-gray-400">How often</p>
                                  <p className="text-xs text-gray-700">{rt.cadence}</p>
                                </div>
                              )}
                              {rt?.evidence_description && (
                                <div>
                                  <p className="text-xs font-medium text-gray-400">What proves this</p>
                                  <p className="text-xs text-gray-700">{rt.evidence_description}</p>
                                </div>
                              )}
                              {rt?.fails_if && (
                                <div>
                                  <p className="text-xs font-medium text-gray-400">Fails even if the document exists, if</p>
                                  <p className="text-xs text-gray-700">{rt.fails_if}</p>
                                </div>
                              )}
                              {o.notes && (
                                <div>
                                  <p className="text-xs font-medium text-gray-400">Why CompliBoard thinks this</p>
                                  <p className="text-xs text-gray-700">{o.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <AIDisclaimer variant="full" className="mt-8" />
          </>
        )}
      </div>
    </AppLayout>
  )
}

'use client'

/**
 * TO CONFIRM — one queue, both sources. Documents Run 5.
 *
 * *** NOTHING ABOUT A COMPANY IS WRITTEN SILENTLY (§108). *** A scan that reads "42 employees at
 * the Portland facility" proposes it; a person confirms it; only then is it a fact. The nightly
 * conversation summariser has been writing proposals since Run 2 and until now there was no
 * screen and no route that could accept one, so every proposal ever made has been sitting
 * unanswered. This is the door.
 *
 * *** THREE AT A TIME, NEVER MORE. *** `WORKSPACE.md` §7.5. A queue of forty is a queue nobody
 * opens; three is a thing somebody finishes on the way to something else.
 *
 * THE ORDER IS STATED ON THE PAGE. A queue ranked by a rule nobody can see is one people scroll
 * past looking for the thing they recognise.
 *
 * The same route backs the report drawer's Confirm and Not right, so a fact answered in either
 * place reads answered in both.
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

interface Proposal {
  id: string
  switch_key: string
  proposed_value: string
  quote: string | null
  locator: string | null
  basis: string
  affects: string | null
  quote_verified: boolean | null
  created_at: string
  is_switch: boolean
  from: { kind: 'document' | 'conversation'; title: string; locator: string | null }
}

const SHOW = 3

export default function ToConfirmPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[14px] text-gray-400">Loading…</div>}>
      <ToConfirmContent />
    </Suspense>
  )
}

function ToConfirmContent() {
  const [rows, setRows] = useState<Proposal[]>([])
  const [ranking, setRanking] = useState('')
  const [loading, setLoading] = useState(true)
  const [shown, setShown] = useState(SHOW)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/to-confirm', { headers: await authHeaders() })
      if (!res.ok) return
      const j = await res.json()
      setRows(j.proposals ?? [])
      setRanking(j.ranking ?? '')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function answer(id: string, verdict: 'accepted' | 'rejected', why?: string) {
    setBusy(true)
    try {
      const res = await fetch('/api/to-confirm', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ proposal_id: id, verdict, reason: why }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not save that just now.'); return }
      setNotice(verdict === 'accepted'
        ? (j.wrote === 'company_switches'
            ? 'Confirmed, and recorded against the question it answers.'
            : 'Confirmed.')
        : null)
      setRejecting(null); setReason('')
      await load()
      // The queue shrinks under you; keep three on screen rather than leaving a gap.
      setShown(SHOW)
    } finally { setBusy(false) }
  }

  const visible = rows.slice(0, shown)

  return (
    <AppLayout>
      <div className="print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6">
        <div className="pt-6">
          <h1 className="font-serif text-[28px] font-normal text-gray-900">To confirm</h1>
          <p className="mt-1 text-[14px] text-gray-500">
            Things we read in your documents and heard in your conversations. Nothing here is
            recorded about your company until you say so.
          </p>
        </div>

        {notice && (
          <p className="mt-4 rounded-lg bg-[var(--green-wash)] px-3 py-2 text-[13px] text-gray-800">{notice}</p>
        )}

        {loading ? (
          <p className="mt-8 text-[14px] text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-[14px] text-gray-500">
            Nothing waiting. When we read a document or summarise a conversation, anything we
            think is true about your company turns up here first.
          </p>
        ) : (
          <>
            {/* THE RANKING, SAID OUT LOUD. */}
            <p className="mt-5 border-b border-gray-200 pb-3 text-[12px] text-gray-500">
              {rows.length} waiting · {ranking}
            </p>

            <div>
              {visible.map((p) => (
                <div key={p.id} className="border-b border-gray-100 py-4">
                  <p className="text-[14px] text-gray-900">
                    {p.switch_key.replace(/_/g, ' ')}: <span className="font-medium">{p.proposed_value}</span>
                    {p.basis === 'inferred' && (
                      <span className="ml-1.5 text-[12px] font-normal text-gray-400">inferred</span>
                    )}
                  </p>

                  {p.affects && <p className="mt-0.5 text-[13px] text-gray-600">{p.affects}</p>}

                  {p.quote && (
                    <p className="mt-1 text-[12px] italic text-gray-500">“{p.quote}”</p>
                  )}
                  {/* KEPT AND FLAGGED, NEVER DROPPED — the person about to agree is the one who
                      needs to know the words were not found in the file. */}
                  {p.quote_verified === false && (
                    <p className="text-[12px] text-[var(--amber)]">quote not found in the file</p>
                  )}

                  <p className="mt-1 text-[12px] text-gray-400">
                    From {p.from.kind === 'document' ? 'the document' : 'the conversation'}{' '}
                    <span className="text-gray-500">{p.from.title}</span>
                    {p.from.locator ? ` · ${p.from.locator}` : ''}
                    {p.is_switch && ' · answers one of the questions we ask about your company'}
                  </p>

                  {rejecting === p.id ? (
                    <div className="mt-2 rounded-lg bg-gray-50 p-2.5">
                      <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                        placeholder="Why is this not right?"
                        className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-[13px]" />
                      <div className="mt-1.5 flex items-center gap-3">
                        <button disabled={!reason.trim() || busy}
                          onClick={() => answer(p.id, 'rejected', reason.trim())}
                          className="text-[13px] text-[var(--green)] disabled:text-gray-300">Save</button>
                        <button onClick={() => { setRejecting(null); setReason('') }}
                          className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-4">
                      <button disabled={busy} onClick={() => answer(p.id, 'accepted')}
                        className="text-[13px] text-[var(--green)] disabled:text-gray-300">Confirm</button>
                      <button onClick={() => setRejecting(p.id)}
                        className="text-[13px] text-gray-600 underline hover:text-gray-900">Not right</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {rows.length > shown && (
              <button onClick={() => setShown((n) => n + SHOW)}
                className="mt-4 text-[13px] text-gray-600 underline hover:text-gray-900">
                Show more ({rows.length - shown} left)
              </button>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

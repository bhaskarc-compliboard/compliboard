'use client'

/**
 * TO CONFIRM — one queue, both sources, one row per question. Documents Run 5, regrouped Run 6.
 *
 * *** NOTHING ABOUT A COMPANY IS WRITTEN SILENTLY (§108). *** A scan that reads "42 employees at
 * the Portland facility" proposes it; a person confirms it; only then is it a fact. The nightly
 * conversation summariser has been writing proposals since Run 2 and until Run 5 there was no
 * screen and no route that could accept one.
 *
 * *** ONE CONFIRMATION PER FACT, NOT PER READING — RUN 6. ***
 * The first real queue had 69 rows from seven documents, and `facility_address` was in it twice
 * because two documents state it. Confirming it twice is the product asking the same question
 * and calling it two questions. So a key appears once, with every source that proposed it listed
 * underneath — the document and where in it, or the conversation — and one Confirm settles it.
 *
 * When the sources disagree the buttons change: no Confirm, because the product does not know
 * which is right and picking one quietly is the thing this whole screen exists not to do. The
 * person chooses the value, and the choice must be one a source actually proposed.
 *
 * *** THREE AT A TIME, NEVER MORE. *** `WORKSPACE.md` §7.5. A queue of forty is a queue nobody
 * opens; three is a thing somebody finishes on the way to something else. And the line above
 * them says how many readings sit behind the three, because "3 of 24 questions" and "3 questions
 * from 69 readings" are different promises about how long this will take.
 *
 * THE ORDER IS STATED ON THE PAGE. A queue ranked by a rule nobody can see is one people scroll
 * past looking for the thing they recognise.
 *
 * The same route backs the report drawer's Confirm and Not right — by proposal id there, because
 * the drawer is answering one document's reading and must not accept another's unseen.
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { authHeaders } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'

interface Source {
  proposal_id: string
  value: string
  quote: string | null
  quote_verified: boolean | null
  locator: string | null
  basis: string
  affects: string | null
  created_at: string
  from: { kind: 'document' | 'conversation'; title: string; locator: string | null }
}

interface FactKey {
  key: string
  is_switch: boolean
  sources: Source[]
  source_count: number
  value: string | null
  agree: boolean
  affects: string | null
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
  const [keys, setKeys] = useState<FactKey[]>([])
  const [proposalCount, setProposalCount] = useState(0)
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
      setKeys(j.keys ?? [])
      setProposalCount(j.proposal_count ?? 0)
      setRanking(j.ranking ?? '')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function answer(key: string, verdict: 'accepted' | 'rejected', opts?: { why?: string; value?: string }) {
    setBusy(true)
    try {
      const res = await fetch('/api/to-confirm', {
        method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key, verdict, reason: opts?.why, value: opts?.value }),
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

  const visible = keys.slice(0, shown)
  const sourcesBehind = visible.reduce((n, k) => n + k.source_count, 0)

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
        ) : keys.length === 0 ? (
          <p className="mt-8 text-[14px] text-gray-500">
            Nothing waiting. When we read a document or summarise a conversation, anything we
            think is true about your company turns up here first.
          </p>
        ) : (
          <>
            {/* THE RANKING, SAID OUT LOUD — and how many readings the three on screen came from,
                because a queue that says "24" while quietly holding 69 readings has told you the
                wrong thing about how long it will take. */}
            <p className="mt-5 border-b border-gray-200 pb-3 text-[12px] text-gray-500">
              {keys.length} to answer, from {proposalCount} {proposalCount === 1 ? 'reading' : 'readings'} ·{' '}
              {ranking}
            </p>
            <p className="mt-2 text-[12px] text-gray-400">
              The {visible.length === 1 ? 'one' : visible.length} below {visible.length === 1 ? 'has' : 'have'}{' '}
              {sourcesBehind} {sourcesBehind === 1 ? 'source' : 'sources'} behind {visible.length === 1 ? 'it' : 'them'}.
            </p>

            <div className="mt-1">
              {visible.map((k) => (
                <div key={k.key} className="border-b border-gray-100 py-4">
                  <p className="text-[14px] text-gray-900">
                    {k.key.replace(/_/g, ' ')}
                    {k.value !== null ? (
                      <>: <span className="font-medium">{k.value}</span></>
                    ) : (
                      <span className="ml-1.5 text-[13px] text-[var(--amber)]">
                        — the sources do not agree
                      </span>
                    )}
                  </p>

                  {k.affects && <p className="mt-0.5 text-[13px] text-gray-600">{k.affects}</p>}

                  {/* EVERY SOURCE, NOT A COUNT. "Two documents say this" is a claim; the two
                      documents with the words they say it in is the evidence for it, and the
                      person confirming is the one entitled to see it. */}
                  <ul className="mt-1.5 space-y-1">
                    {k.sources.map((s) => (
                      <li key={s.proposal_id} className="text-[12px] text-gray-500">
                        <span className="text-gray-400">
                          {s.from.kind === 'document' ? 'Document' : 'Conversation'}:{' '}
                        </span>
                        <span className="text-gray-600">{s.from.title}</span>
                        {s.from.locator ? ` · ${s.from.locator}` : ''}
                        {/* The value is repeated per source ONLY when they differ. Printing it
                            three times identically is noise; printing it when it changes is the
                            whole disagreement. */}
                        {!k.agree && <> — <span className="font-medium text-gray-800">{s.value}</span></>}
                        {s.basis === 'inferred' && <span className="ml-1 text-gray-400">(inferred)</span>}
                        {s.quote && <span className="block pl-4 italic text-gray-400">“{s.quote}”</span>}
                        {/* KEPT AND FLAGGED, NEVER DROPPED — the person about to agree is the one
                            who needs to know the words were not found in the file. Null is not
                            false: a scanned page has no text to check against, and says nothing. */}
                        {s.quote_verified === false && (
                          <span className="block pl-4 text-[var(--amber)]">quote not found in the file</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {k.is_switch && (
                    <p className="mt-1 text-[12px] text-gray-400">
                      Answers one of the questions we ask about your company.
                    </p>
                  )}

                  {rejecting === k.key ? (
                    <div className="mt-2 rounded-lg bg-gray-50 p-2.5">
                      <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                        placeholder="Why is this not right?"
                        className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-[13px]" />
                      <p className="mt-1 text-[12px] text-gray-400">
                        This answers {k.source_count === 1 ? 'the one source' : `all ${k.source_count} sources`} above.
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <button disabled={!reason.trim() || busy}
                          onClick={() => answer(k.key, 'rejected', { why: reason.trim() })}
                          className="text-[13px] text-[var(--green)] disabled:text-gray-300">Save</button>
                        <button onClick={() => { setRejecting(null); setReason('') }}
                          className="text-[13px] text-gray-500 hover:text-gray-800">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                      {k.agree ? (
                        <button disabled={busy} onClick={() => answer(k.key, 'accepted')}
                          className="text-[13px] text-[var(--green)] disabled:text-gray-300">Confirm</button>
                      ) : (
                        // NO SINGLE CONFIRM WHEN THEY DISAGREE. One button per value, so the
                        // choice is made on purpose rather than by whichever scan ran last.
                        [...new Set(k.sources.map((s) => s.value))].map((v) => (
                          <button key={v} disabled={busy}
                            onClick={() => answer(k.key, 'accepted', { value: v })}
                            className="text-[13px] text-[var(--green)] disabled:text-gray-300">
                            Confirm “{v}”
                          </button>
                        ))
                      )}
                      <button onClick={() => setRejecting(k.key)}
                        className="text-[13px] text-gray-600 underline hover:text-gray-900">Not right</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {keys.length > shown && (
              <button onClick={() => setShown((n) => n + SHOW)}
                className="mt-4 text-[13px] text-gray-600 underline hover:text-gray-900">
                Show more ({keys.length - shown} left)
              </button>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

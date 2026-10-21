'use client'

/**
 * THE PEOPLE TAB — My Account step 7, board 2 (`ACCOUNT-PLAN.md` decision 6).
 *
 * Who can sign in, one row each; the per-person monthly-email switch; an invitation by email; and
 * Remove behind the shared sheet. The shared pieces are imported, never copied:
 * `components/DashboardSection.tsx` for the heading and its right-hand action,
 * `components/Sheet.tsx` for the one confirmation, `components/buttonStyles.ts` for the buttons.
 *
 * *** THE SWITCH IS ON YOUR OWN ROW AND NOWHERE ELSE, AND THE DATABASE IS WHY. ***
 * `profiles`' UPDATE policy is `auth.uid() = profiles.id` (migration 080) and 082's column grant
 * adds `calendar_email` to the three a person may write. So a person may change their own and no
 * one else's — that is not a rule this component invented and it is not one it could relax. On a
 * colleague's row the same words are drawn as a statement rather than a control, because board 2
 * shows the state of everyone's and hiding it would leave the question "is Dev getting these?"
 * unanswerable by the person who can actually ask Dev.
 *
 * *** THE ADDRESSES COME FROM A ROUTE, NOT FROM A TABLE. *** `profiles` has no email column; the
 * address is on the login in `auth.users`, reachable only with the service-role key, which must
 * never be in browser code (§3.5). `GET /api/people` is that one named lookup.
 */
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import DashboardSection from './DashboardSection'
import { Sheet } from './Sheet'
import { PRIMARY, TEXT_ACTION } from './buttonStyles'
import { authHeaders } from '@/lib/supabase'
import {
  PEOPLE_HEADING, INVITE_ACTION, YOU_PILL, INVITED_PILL, REMOVE, RESEND, CANCEL_INVITE,
  INVITE_TITLE, INVITE_LEDE, INVITE_PLACEHOLDER, INVITE_SEND,
  calendarEmailLine, joinedLine, invitedLine, personName, removeTitle, REMOVE_LEDE,
  CALENDAR_EMAIL_LABEL, ON, OFF,
  type PersonRow, type InvitationRow,
} from '@/lib/peopleView'

const PILL = 'rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600'
const ACTION = 'shrink-0 text-[13px] text-[var(--green-ink)] hover:underline disabled:text-gray-300'
const ROW = 'flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4'
const ROW_LAST = 'flex items-start justify-between gap-4 px-5 py-4'
const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-900 ' +
  'focus:border-[var(--green)] focus:outline-none'

export function PeopleTab({ db }: { db: SupabaseClient }) {
  const [people, setPeople] = useState<PersonRow[] | null>(null)
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [draft, setDraft] = useState('')
  const [removing, setRemoving] = useState<PersonRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/people', { headers: await authHeaders() })
      if (!res.ok) { setPeople([]); return }
      const j = await res.json()
      setPeople((j?.people ?? []) as PersonRow[])
      setInvitations((j?.invitations ?? []) as InvitationRow[])
    } catch {
      // The list simply does not appear. An error about our own machinery is not the person's.
      setPeople([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  /** A person's own switch. One column, one row — the policy allows nothing else. */
  async function setMyCalendarEmail(id: string, on: boolean) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    const { error } = await db.from('profiles').update({ calendar_email: on }).eq('id', id)
    setBusy(false)
    if (error) { setNotice('We could not change that just now.'); return }
    setPeople((rows) => (rows ?? []).map((p) => (p.id === id ? { ...p, calendar_email: on } : p)))
  }

  async function invite(email: string, resend = false) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email, resend }),
      })
      const j = await res.json().catch(() => null)
      // The route's own sentence, every time. Each refusal is one sentence a person can act on
      // (`lib/peopleView.ts`), so there is nothing to translate here.
      if (!res.ok) { setNotice(j?.error ?? 'We could not send that invitation just now.'); return }
      setDraft('')
      setInviting(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function withdraw(id: string) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/invitations', {
        method: 'PATCH',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not withdraw that invitation just now.'); return }
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove(person: PersonRow) {
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(person.id)}`, {
        method: 'DELETE', headers: await authHeaders(),
      })
      const j = await res.json().catch(() => null)
      setRemoving(null)
      if (!res.ok) { setNotice(j?.error ?? 'We could not remove that person just now.'); return }
      await load()
    } finally {
      setBusy(false)
    }
  }

  // Nothing at all until the list has been read. An empty card would be a claim that a company has
  // nobody in it, and every company has at least the person reading the page.
  if (people === null) return null

  const rows = [...people.map((p) => ({ kind: 'person' as const, p })),
                ...invitations.map((i) => ({ kind: 'invite' as const, i }))]

  return (
    <>
      <DashboardSection heading={PEOPLE_HEADING} />
      {notice && <p className="mb-3 text-[13px] text-[var(--amber)]">{notice}</p>}

      <div className="rounded-xl border border-gray-200 bg-white">
        {rows.map((row, i) => {
          const last = i === rows.length - 1
          if (row.kind === 'person') {
            const p = row.p
            return (
              <div key={p.id} className={last ? ROW_LAST : ROW}>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[14px] text-gray-900">
                    {personName(p.full_name, p.email)}
                    {p.is_you && <span className={PILL}>{YOU_PILL}</span>}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">
                    {[p.email, joinedLine(p.created_at)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[13px]">
                  {p.is_you ? (
                    // The control, on the one row the policy permits.
                    <button type="button" disabled={busy} className={ACTION}
                      onClick={() => setMyCalendarEmail(p.id, !p.calendar_email)}>
                      {CALENDAR_EMAIL_LABEL}: {p.calendar_email ? ON : OFF}
                    </button>
                  ) : (
                    // The same words as a statement. A colleague's setting is theirs to change.
                    <span className="text-gray-500">{calendarEmailLine(p.calendar_email)}</span>
                  )}
                  {!p.is_you && (
                    <button type="button" disabled={busy} className={ACTION}
                      onClick={() => setRemoving(p)}>{REMOVE}</button>
                  )}
                </div>
              </div>
            )
          }
          const inv = row.i
          return (
            <div key={inv.id} className={last ? ROW_LAST : ROW}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] text-gray-900">
                  {inv.email}
                  <span className={PILL}>{INVITED_PILL}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-gray-500">{invitedLine(inv.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[13px]">
                <button type="button" disabled={busy} className={ACTION}
                  onClick={() => invite(inv.email, true)}>{RESEND}</button>
                <button type="button" disabled={busy} className={ACTION}
                  onClick={() => withdraw(inv.id)}>{CANCEL_INVITE}</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* The invite card, board 2's own words. Opened by the heading's action or shown outright
          when a company is one person with nobody invited — which is every company on its first
          day, and the one moment the control should not be behind a click. */}
      {(inviting || rows.length <= 1) ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-[14px] font-medium text-gray-900">{INVITE_TITLE}</p>
          <p className="mt-1 text-[12.5px] leading-5 text-gray-500">{INVITE_LEDE}</p>
          <div className="mt-3 flex max-w-[480px] items-center gap-2">
            <input type="text" value={draft} disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={INVITE_PLACEHOLDER} aria-label="Email address" className={FIELD} />
            <button type="button" disabled={busy || !draft.trim()}
              className={`shrink-0 whitespace-nowrap ${PRIMARY}`}
              onClick={() => invite(draft.trim())}>{INVITE_SEND}</button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <button type="button" className={ACTION} onClick={() => setInviting(true)}>{INVITE_ACTION}</button>
        </div>
      )}

      {removing && (
        <Sheet title={removeTitle(personName(removing.full_name, removing.email))}
          lede={REMOVE_LEDE}
          onClose={() => setRemoving(null)}>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy} className={PRIMARY}
              onClick={() => remove(removing)}>{REMOVE}</button>
            <button type="button" className={TEXT_ACTION}
              onClick={() => setRemoving(null)}>Cancel</button>
          </div>
        </Sheet>
      )}
    </>
  )
}

export default PeopleTab

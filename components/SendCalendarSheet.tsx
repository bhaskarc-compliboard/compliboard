'use client'
/**
 * SEND TO YOUR CALENDAR — board 11 (Calendar step 8b part 3, decision 20; `DECISIONS.md` §193).
 *
 * Four choices over one secret address: Google, Outlook, copy it, or take a file that will not
 * update. The subscription link is `GET /api/calendar/feed?t=<token>`, the one route in the
 * product with no session behind it, and the sheet's job is to say so plainly before anybody
 * copies it anywhere.
 *
 * *** THE DOWNLOAD IS MADE HERE, FROM THE ROWS THE PAGE ALREADY HAS, THROUGH THE SAME GENERATOR
 * THE FEED USES *** (`lib/calendarIcs.ts`). Not a second fetch and not a second set of rules: a
 * download that disagreed with the subscription would be two answers to "what is on my calendar".
 */
import { useEffect, useState } from 'react'
import { authHeaders } from '@/lib/supabase'
import { Sheet } from '@/components/Sheet'
import { buildIcs, SKIPPED_LINE } from '@/lib/calendarIcs'
import type { CalendarRow } from '@/lib/calendarView'

/** Board 11's words. */
const LEDE = 'Your calendar app follows a link and stays in step: a date we add, confirm or remove '
  + 'shows there within a day. Anyone with the link can read your dates, so treat it like a password.'
/** The owner's line, 16 October 2026: what the link does NOT carry. */
export const NOTE_STAYS_OUT =
  'Your own notes on a date are never in the link or the file — only the date, where it came from '
  + 'and the line we read it from.'
const LINK_FAILED = 'We could not make that link just now. Nothing has changed — please try again.'

/** Google's and Outlook's "add a calendar by address" pages. Neither is an API and neither costs. */
const googleSubscribe = (url: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`
const outlookSubscribe = (url: string, name: string) =>
  `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`

const CALNAME = 'CompliBoard — compliance dates'

/** Board 11's row: a name, a sentence under it, the whole thing one target. */
function Choice({ title, note, onClick, href }: {
  title: string; note: string; onClick?: () => void; href?: string
}) {
  const inner = (<>
    <span className="block text-[14px] font-medium text-gray-900">{title}</span>
    <span className="mt-0.5 block text-[12.5px] leading-relaxed text-gray-500">{note}</span>
  </>)
  const cls = 'block w-full rounded-lg border border-gray-200 px-3.5 py-3 text-left hover:border-gray-300 hover:bg-gray-50'
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
    : <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

export function SendCalendarSheet({ rows, onClose }: {
  /** The live rows the tab is showing — the download is built from these. */
  rows: CalendarRow[]
  onClose: () => void
}) {
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // The token is made on first open if the company has none — one POST, behind the session.
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const res = await fetch('/api/calendar/feed-token', {
          method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }),
        })
        const j = await res.json().catch(() => null)
        if (!live) return
        if (!res.ok || !j?.token) { setError(j?.error ?? LINK_FAILED); return }
        setLink(`${window.location.origin}/api/calendar/feed?t=${j.token}`)
      } catch { if (live) setError(LINK_FAILED) }
    })()
    return () => { live = false }
  }, [])

  const skipped = buildIcs(rows, { name: CALNAME, now: new Date() }).skipped.length

  function download() {
    const { text } = buildIcs(rows, { name: CALNAME, now: new Date(), baseUrl: window.location.origin })
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'compliboard-calendar.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Sheet title="Keep this calendar in Google or Outlook" lede={LEDE} onClose={onClose}>
      <p className="-mt-1 mb-3 text-[12.5px] leading-relaxed text-gray-500">{NOTE_STAYS_OUT}</p>

      {error && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{error}</p>
      )}

      <div className="space-y-2">
        {link && (<>
          <Choice title="Google Calendar" href={googleSubscribe(link)}
            note="Opens Google Calendar with the link ready to add as a subscribed calendar." />
          <Choice title="Outlook" href={outlookSubscribe(link, CALNAME)}
            note="Opens Outlook with the link ready to add as a subscribed calendar." />
          <Choice title={copied ? 'Copied' : 'Copy the link'}
            note="For Apple Calendar or any other app that can follow a calendar link."
            onClick={() => {
              navigator.clipboard.writeText(link)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }} />
        </>)}
        {!link && !error && <p className="text-[13px] text-gray-400">Making your link…</p>}
        <Choice title="Download a copy (.ics)" onClick={download}
          note="Every date as of today, as a file. It will not update." />
      </div>

      {/* Decision 30: a date we cannot place is left out, and the sheet says how many rather than
          letting somebody find a short calendar later and wonder. */}
      {skipped > 0 && <p className="mt-3 text-[12.5px] leading-relaxed text-gray-500">{SKIPPED_LINE(skipped)}</p>}

      <div className="mt-4 text-center">
        <button onClick={onClose} className="text-[13px] text-gray-500 hover:text-gray-900">Not now</button>
      </div>
    </Sheet>
  )
}

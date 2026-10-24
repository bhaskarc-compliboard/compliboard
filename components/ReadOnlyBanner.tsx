'use client'

/**
 * THE ONE BAND ABOVE THE TOP BAR — board 8, `ACCOUNT-PLAN.md` decision 11, My Account step 18.
 *
 * *** DECISION 14 KEEPS THE SIDEBAR AND THE SHARED FRAME UNTOUCHED BY THIS SECTION, AND THIS IS THE
 * ONE DRAWN EXCEPTION. *** So it is a slot and nothing more: `AppLayout` renders it, or renders
 * nothing, above the header. It does not know what page it is on, it changes no spacing that
 * survives its own absence, and `SidebarContent` and `NAV_ITEMS` are not touched at all.
 *
 * `no-print`, like the header. A band saying "your trial has ended" at the top of every exported
 * report would contradict the very sentence it is printing — decision 11's promise is that
 * everything is still here to READ AND DOWNLOAD, and a watermarked download is not that.
 */

import { useState } from 'react'
import { authHeaders } from '@/lib/supabase'
import type { Banner } from '@/lib/billing'

export default function ReadOnlyBanner({ banner }: { banner: Banner }) {
  const [busy, setBusy] = useState(false)

  async function go() {
    if (busy) return
    setBusy(true)
    try {
      // A card is ADDED at checkout and CHANGED in the portal, and `bannerFor` has already decided
      // which this company needs from whether Stripe knows them. One button, two doors.
      const res = await fetch(`/api/billing/${banner.action}`, {
        method: 'POST',
        headers: await authHeaders(),
      })
      const json = await res.json().catch(() => null)
      // §5.1: if we cannot send them to Stripe, say so as OUR problem and leave them where they
      // are. Never a dead button and never a silent one.
      if (!res.ok || !json?.url) {
        alert(json?.error ?? "We couldn't open the payment page just now. Please try again in a moment.")
        setBusy(false)
        return
      }
      window.location.href = json.url
    } catch {
      alert("We couldn't open the payment page just now. Please try again in a moment.")
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      data-testid="read-only-banner"
      data-kind={banner.kind}
      className="no-print bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-amber-900">{banner.text}</p>
      <button
        onClick={go}
        disabled={busy}
        className="shrink-0 text-sm font-medium bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
      >
        {busy ? 'Opening…' : banner.button}
      </button>
    </div>
  )
}

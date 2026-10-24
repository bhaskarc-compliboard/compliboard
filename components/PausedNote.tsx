'use client'

/**
 * THE SAME SENTENCE, BESIDE THE CONTROL THAT IS PAUSED — My Account step 18, decision 11.
 *
 * ---- WHY THIS EXISTS WHEN THE 402 ALREADY SAYS IT ------------------------------------------------
 *
 * The server's 402 is the layer that cannot be bypassed, and every section already renders it:
 * each call site does `if (!res.ok) show json?.error`, so the refusal's sentence appears today with
 * no change to any section file. **This is the second layer, and it is the kinder one** — it tells
 * somebody the button will not work BEFORE they press it, rather than after.
 *
 * ---- AND IT IS ONE SHARED THING, ON PURPOSE -----------------------------------------------------
 *
 * The brief asked for ONE way to show this across every section. So: no section writes its own
 * wording, no section restyles it, and nothing moves. It renders in the flow where that control's
 * existing helper text already renders, adds no wrapper and no spacing of its own beyond a margin,
 * and disappears entirely when access is full — so a paying company's screen is byte-identical to
 * what it was before step 18.
 */

import type { Banner } from '@/lib/billing'

export default function PausedNote({ banner }: { banner: Banner | null }) {
  if (!banner) return null
  return (
    <p data-testid="paused-note" className="text-xs text-amber-800 mt-1.5">
      {banner.text}
    </p>
  )
}

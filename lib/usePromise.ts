/**
 * WHAT A CLIENT PAGE MAY PROMISE — the browser half of `lib/emailPromise.ts`.
 *
 * The rule lives on the server (`/api/promise`), because it reads `EMAIL_FROM`, which the browser
 * cannot see. This hook asks for the answer and hands it to the page.
 *
 * *** IT STARTS AT `false`, AND THAT IS THE SAFE DIRECTION. *** Until the answer arrives — and if it
 * never arrives, because the request failed — the page simply does not make the promise. A sentence
 * that appears a moment late is nothing; a sentence promising an email that cannot be sent is the
 * thing decision 21 exists to stop (`CLAUDE.md` §5.1). So a failed read is NOT treated as a yes,
 * which is `docs/FIX-LIST-FAILURES.md` R2 pointed the other way: here the empty answer is the
 * cautious one, and it is still never mistaken for a fact.
 */
'use client'

import { useEffect, useState } from 'react'

export function useMonthlyEmailPromised(): boolean {
  const [yes, setYes] = useState(false)
  useEffect(() => {
    let live = true
    fetch('/api/promise')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j?.monthlyEmail === true) setYes(true) })
      .catch(() => { /* stays false: we do not promise what we could not confirm */ })
    return () => { live = false }
  }, [])
  return yes
}

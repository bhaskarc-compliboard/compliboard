/**
 * WHAT COMPANY INFORMATION IS WAITING FOR, SHARED WITH ANYTHING THAT DRAWS A SUMMARY.
 * `docs/GAPS-PLAN.md` Part E step E2b item 1 (the owner, 4 November 2026).
 *
 * *** WHY A CONTEXT AND NOT A PROP. *** A summary's *Still to confirm* item links to the exact
 * waiting question only when its key is **actually waiting** — a link to a question somebody has
 * already answered is a link to nothing. The one place that already knows is `AppLayout`, which
 * reads `/api/to-confirm` once per page load for the sidebar badge and re-reads it on the event
 * the Company information page fires after a write. Threading that set through six renderers and
 * `ConversationDrawer` would be six props for one optional line; asking for it again in the
 * drawer would be a request per summary opened.
 *
 * So the layout provides what it already has, and `components/ReportView.tsx` takes it. Outside a
 * layout — a test, a story — the default is empty, which means no per-item link at all, which is
 * exactly the state E2b item 1 asks for until a key is both present and waiting.
 */
'use client'

import { createContext, useContext } from 'react'

const WaitingKeysContext = createContext<ReadonlySet<string>>(new Set())

export const WaitingKeysProvider = WaitingKeysContext.Provider

/** The switch keys this company has waiting. Empty when nothing is, or nothing has said. */
export function useWaitingKeys(): ReadonlySet<string> {
  return useContext(WaitingKeysContext)
}

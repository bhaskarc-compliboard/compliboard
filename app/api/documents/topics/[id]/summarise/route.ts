// "SUMMARISE THIS CONVERSATION" FOR A DOCUMENTS CONVERSATION — Part A step 4b (decision 15).
//
// *** THE BODY IS SHARED: `lib/ask/summariseRoute.ts`. *** This is the first of the two routes
// decision 15 names (Audits' is the second). The Workspace's, HR's and the Calendar's three copies
// are deliberately left alone until F7 moves them — changing three live sections' routes to prove
// a helper works is not what the helper is for.
//
// *** THE SESSION AND THE GATE ARE WRITTEN HERE, NOT IN THE HELPER, and that is not duplication
// for its own sake. *** `scripts/check-schema-contracts.js` check 3 reads THIS FILE'S TEXT for
// `requireAccess(`: a paid route whose gate lived in a helper would typecheck and fail the
// contract check, which is the check doing exactly its job.
import { NextRequest, NextResponse, after, connection } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { summariseSection } from '@/lib/ask/summariseRoute'

import { requireAccess } from '@/lib/requireAccess'
export const maxDuration = 800

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  // Decision 11: after the trial, or after the grace, this company may read and
  // download everything and spend nothing. 402 with one plain sentence.
  const paused = await requireAccess(authed.auth)
  if (paused) return paused
  const { db, companyId } = authed.auth

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No conversation id given.' }, { status: 400 })

  return summariseSection({
    db, admin: supabaseAdmin, companyId, section: 'documents', topicId: id,
    // `after` from `next/server`, so closing the tab loses nothing: on Vercel it is built on
    // `waitUntil` and extends the invocation up to `maxDuration` (`CLAUDE.md` §3.11).
    after: (work) => after(work),
  })
}

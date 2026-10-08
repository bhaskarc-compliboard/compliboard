// "SUMMARISE THIS CONVERSATION" FOR AN HR CONVERSATION — HR Step 7 (DECISIONS §172).
//
// The workspace's route (`app/api/topics/[id]/summarise/route.ts`), copied in its order and its safety:
// the claim before any model call (`lib/topicClaim.ts`), 202 at once, the work in `after()` so closing the tab
// loses nothing, the save conditional on still holding the claim, and the claim released in a `finally`.
// The ONE writer is the workspace's (`lib/summaryReport.ts` summariseTopic) with kind 'hr': HR's prompt, the
// turns without their grey lines, handbook passages kept as sources, HR's words in the plain text. Ledger
// 'summarise', as the workspace's.
//
// *** BEHIND THE PREVIEW SWITCH, and HR's conversations only. *** 404 unless HR_PREVIEW=1 (decision 32),
// before the session is read; a conversation that is not section 'hr' is a 404 too, as one of another company
// is, so ids cannot be probed and the workspace's summaries are never written by HR's writer.
import { NextRequest, NextResponse, after, connection } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { hrPreviewOn } from '@/lib/hrPreview'
import { loadTurns } from '@/lib/conversation'
import { summariseTopic } from '@/lib/summaryReport'
import { claimTopic, releaseTopic, withinClaimTime, CLAIM_WORDS } from '@/lib/topicClaim'

export const maxDuration = 800

const NOT_FOUND = 'That conversation was not found.'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  if (!hrPreviewOn()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { db, companyId } = authed.auth

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No conversation id given.' }, { status: 400 })

  try {
    const { data: topic, error } = await db.from('topics').select('id, title, section').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!topic || topic.section !== 'hr') return NextResponse.json({ error: NOT_FOUND }, { status: 404 })

    const turns = await loadTurns(db, id)
    if (turns.length === 0) {
      return NextResponse.json({ error: 'There are no messages in this conversation to summarise yet. Ask a question first.' }, { status: 409 })
    }

    const claim = await claimTopic(db, id, 'summary')
    if (!claim.ok) {
      return NextResponse.json({ status: 'writing', message: `${CLAIM_WORDS.summary} It is already being written.` }, { status: 409 })
    }

    after(async () => {
      try {
        const result = await withinClaimTime(summariseTopic(db, supabaseAdmin, {
          topicId: id, companyId, title: topic.title ?? null, turns, source: 'user', kind: 'hr',
          guard: { claimedAt: claim.claimedAt, summarisedAt: claim.summarisedAt },
        }), 'summary')
        if (!result.ok) console.error(`hr summarise ${id}: ${result.error}`)
        else console.log(`hr summarise ${id}: ${result.report.applies.reduce((n, g) => n + g.items.length, 0)} item(s), `
          + `${result.report.sources.length} source(s), ${result.proposed} fact(s) proposed; basis: `
          + result.checks.map((c) => `${c.name}=${c.found} kept[${c.kept}] dropped[${c.dropped}]`).join('; '))
      } catch (e) {
        console.error(`hr summarise ${id} failed:`, e)
      } finally {
        await releaseTopic(db, id, 'summary', claim.claimedAt)
      }
    })
    return NextResponse.json({ status: 'started' }, { status: 202 })
  } catch (e) {
    console.error('POST /api/hr/topics/[id]/summarise failed:', e)
    return NextResponse.json({ error: 'That conversation could not be summarised just now. Please try again.' }, { status: 500 })
  }
}

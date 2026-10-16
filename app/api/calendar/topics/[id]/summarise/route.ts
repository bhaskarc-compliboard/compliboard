// "SUMMARISE THIS CONVERSATION" FOR A CALENDAR CONVERSATION — Calendar step 10b.
//
// `app/api/hr/topics/[id]/summarise/route.ts` in its order and its safety, with one word changed:
// the claim before any model call (`lib/topicClaim.ts`), 202 at once, the work in `after()` so
// closing the tab loses nothing, the save conditional on still holding the claim, and the claim
// released in a `finally`.
//
// *** THE ONE WORD IS THE SECTION, AND IT IS WHY THIS ROUTE EXISTS AT ALL. *** A conversation that
// is not section 'calendar' is a 404, as one of another company is, so ids cannot be probed and
// HR's summaries are never written by the Calendar's caller. The writer itself is the workspace's
// (`lib/summaryReport.ts` through `lib/ask/engine.ts` `summarise`), with the workspace's kind:
// HR's kind is for handbook cards and HR's wording, and a calendar conversation has neither.
import { NextRequest, NextResponse, after, connection } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { loadTurns } from '@/lib/conversation'
import { summarise } from '@/lib/ask/engine'
import { claimTopic, releaseTopic, withinClaimTime, CLAIM_WORDS } from '@/lib/topicClaim'

export const maxDuration = 800

const NOT_FOUND = 'That conversation was not found.'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { db, companyId } = authed.auth

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No conversation id given.' }, { status: 400 })

  try {
    const { data: topic, error } = await db.from('topics').select('id, title, section').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!topic || topic.section !== 'calendar') return NextResponse.json({ error: NOT_FOUND }, { status: 404 })

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
        const result = await withinClaimTime(summarise(db, supabaseAdmin, {
          section: 'calendar', topicId: id, companyId, title: topic.title ?? null, turns, source: 'user',
          guard: { claimedAt: claim.claimedAt, summarisedAt: claim.summarisedAt },
        }), 'summary')
        if (!result.ok) console.error(`calendar summarise ${id}: ${result.error}`)
        else console.log(`calendar summarise ${id}: ${result.report.applies.reduce((n, g) => n + g.items.length, 0)} item(s), `
          + `${result.report.sources.length} source(s), ${result.proposed} fact(s) proposed`)
      } catch (e) {
        console.error(`calendar summarise ${id} failed:`, e)
      } finally {
        await releaseTopic(db, id, 'summary', claim.claimedAt)
      }
    })

    return NextResponse.json({ status: 'writing', message: CLAIM_WORDS.summary }, { status: 202 })
  } catch (e) {
    console.error(`calendar summarise ${id}:`, e)
    return NextResponse.json({ error: 'That conversation could not be summarised just now. Nothing was changed.' }, { status: 500 })
  }
}

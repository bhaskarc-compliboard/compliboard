/**
 * ONE CONVERSATION, REOPENED — `DECISIONS.md` §125, Run 2 Task 1.
 *
 * GET /api/topics/<id> returns a topic and its turns in order, so the page can reload a
 * conversation and carry on from it.
 *
 * *** IT CONNECTS AS THE CALLER, NOT AS THE SERVICE ROLE. *** `CLAUDE.md` §3.6: `requireCompany`
 * builds a client from the request's own token, so RLS applies and the policies written in
 * migration 031 are what decide whether these rows come back. Nothing here filters by a
 * company id taken from the request.
 *
 * A topic belonging to another company returns **404, not 403** — the same rule the documents
 * route follows, so ids cannot be probed by watching which error comes back.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { loadTurns } from '@/lib/conversation'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { db } = authed.auth

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No conversation id given.' }, { status: 400 })

  try {
    // RLS decides this, not a filter written here. `maybeSingle` rather than `single` so a row
    // the caller may not see is a clean 404 instead of a thrown error.
    const { data: topic, error } = await db
      .from('topics')
      .select('id, title, status, summary, summarised_at, summary_source, last_turn_at, delete_after, created_at')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!topic) {
      return NextResponse.json({ error: 'That conversation was not found.' }, { status: 404 })
    }

    const turns = await loadTurns(db, id)

    // WHAT THE TRANSCRIPT'S ABSENCE MEANS IS SAID, NOT LEFT TO BE GUESSED (§5.1). A summarised
    // topic whose turns have been cleared is not an empty conversation and must not read as one.
    const cleared = turns.length === 0 && Boolean(topic.summarised_at)
    return NextResponse.json({
      topic,
      turns,
      transcript_cleared: cleared,
      note: cleared
        ? 'The messages in this conversation were cleared 7 days after it was summarised. The summary below is kept.'
        : null,
    })
  } catch (e) {
    console.error('GET /api/topics/[id] failed:', e)
    return NextResponse.json(
      { error: 'That conversation could not be opened. Please try again.' },
      { status: 500 },
    )
  }
}

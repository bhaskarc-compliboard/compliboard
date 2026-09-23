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
import { requireCompany, supabaseAdmin } from '@/lib/auth'
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

/**
 * DELETE /api/topics/<id> — the conversation, and everything in it.
 *
 * *** OWNERSHIP IS CHECKED AS THE CALLER; THE DELETE RUNS AS THE SERVICE ROLE. ***
 * `authenticated` holds INSERT, SELECT and UPDATE on `topics` and deliberately **no DELETE**
 * (migration 028), and no DELETE on `turns` either (031) — a user cannot quietly remove part of
 * a transcript the kept summary still describes. Deleting the WHOLE conversation is a different
 * act, and it is the customer's right, so it happens here as one named statement after RLS has
 * already decided they may see the row.
 *
 * `turns` and `fact_proposals` carry `topic_id … ON DELETE CASCADE`, so they go with it. The
 * checklist made from it does NOT: `checklists.from_topic_id` is ON DELETE SET NULL (migration
 * 033), because the checklist is the kept artifact and the transcript is the disposable one.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { db } = authed.auth

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No conversation id given.' }, { status: 400 })

  try {
    // RLS decides this. A topic belonging to another company is a 404, not a 403.
    const { data: topic, error } = await db.from('topics').select('id').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!topic) return NextResponse.json({ error: 'That conversation was not found.' }, { status: 404 })

    // Counted before it goes, so the response can say what was removed rather than only that
    // something was.
    const { count: turnCount } = await db
      .from('turns').select('*', { count: 'exact', head: true }).eq('topic_id', id)

    const { error: delErr } = await supabaseAdmin.from('topics').delete().eq('id', id)
    if (delErr) throw new Error(delErr.message)

    return NextResponse.json({ deleted: true, turns_deleted: turnCount ?? 0 })
  } catch (e) {
    console.error('DELETE /api/topics/[id] failed:', e)
    return NextResponse.json(
      { error: 'That conversation could not be deleted. Please try again.' },
      { status: 500 },
    )
  }
}

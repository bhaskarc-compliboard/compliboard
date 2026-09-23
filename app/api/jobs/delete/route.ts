/**
 * THE NIGHTLY DELETER — `DECISIONS.md` §110, §116, §125. Run 2 Task 4.
 *
 * Clears transcripts that are due. **The topic row and its summary survive**; only `turns` go.
 *
 * ---------------------------------------------------------------------------
 * TWO CONDITIONS, AND THE SECOND ONE IS THE POINT
 *
 *   1. `delete_after < now`  — the normal path. The summariser set it to summarised_at + 7 days.
 *
 *   2. THE BACKSTOP: `last_turn_at` older than 30 days AND no summary at all.
 *
 * Without (2), a summariser outage makes transcripts PERMANENT. Nothing would ever stamp
 * `delete_after`, so nothing would ever be due, and the retention promise on screen would
 * quietly become false for every conversation held during the outage — with no error anywhere,
 * because each job "succeeded" at deleting the zero rows it found.
 *
 * **A retention promise that depends on another job having run is not a retention promise.**
 * The backstop is what makes it one.
 * ---------------------------------------------------------------------------
 *
 * NO OTHER LOGIC LIVES HERE. It does not summarise, does not extract, does not tidy topics. A
 * deletion job that also does something else is one whose blast radius has to be re-read every
 * time either half changes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { supabaseAdmin } from '@/lib/auth'

export const maxDuration = 800

/** The backstop window: a transcript nobody summarised is still cleared after this. */
const BACKSTOP_DAYS = 30

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response

  const run = await startJobRun(supabaseAdmin, 'delete')
  const errors: Array<{ topic: string; error: string }> = []
  const removed: Array<{ topic: string; turns: number; reason: 'due' | 'backstop' }> = []
  let turnsDeleted = 0

  try {
    const now = new Date().toISOString()
    const backstopBefore = new Date(Date.now() - BACKSTOP_DAYS * 86400_000).toISOString()

    const { data: due, error: e1 } = await supabaseAdmin
      .from('topics').select('id').lt('delete_after', now).not('delete_after', 'is', null)
    if (e1) throw new Error(`listing due topics: ${e1.message}`)

    const { data: stranded, error: e2 } = await supabaseAdmin
      .from('topics').select('id')
      .is('summarised_at', null)
      .not('last_turn_at', 'is', null)
      .lt('last_turn_at', backstopBefore)
    if (e2) throw new Error(`listing stranded topics: ${e2.message}`)

    const targets = [
      ...(due ?? []).map((t) => ({ id: t.id as string, reason: 'due' as const })),
      ...(stranded ?? [])
        .filter((t) => !(due ?? []).some((d) => d.id === t.id))
        .map((t) => ({ id: t.id as string, reason: 'backstop' as const })),
    ]

    for (const target of targets) {
      try {
        // Counted before deleting, so the log says what was removed rather than what is left.
        const { count, error: cErr } = await supabaseAdmin
          .from('turns').select('*', { count: 'exact', head: true }).eq('topic_id', target.id)
        if (cErr) throw new Error(`counting turns: ${cErr.message}`)

        const { error: dErr } = await supabaseAdmin.from('turns').delete().eq('topic_id', target.id)
        if (dErr) throw new Error(`deleting turns: ${dErr.message}`)

        // The topic and its summary stay. `delete_after` is cleared so a topic cannot be
        // "deleted" twice and appear in tomorrow's log having removed nothing.
        const { error: uErr } = await supabaseAdmin
          .from('topics').update({ delete_after: null }).eq('id', target.id)
        if (uErr) throw new Error(`clearing delete_after: ${uErr.message}`)

        removed.push({ topic: target.id, turns: count ?? 0, reason: target.reason })
        turnsDeleted += count ?? 0
      } catch (e) {
        errors.push({ topic: target.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
  } catch (e) {
    errors.push({ topic: '(run)', error: e instanceof Error ? e.message : String(e) })
  }

  // BY TOPIC ID AND COUNT — gate two is "did it run, and what did it remove", and a total with
  // no breakdown cannot answer a customer asking about their own conversation.
  const counts = {
    topics_cleared: removed.length,
    turns_deleted: turnsDeleted,
    by_topic: removed,
  }
  await run.finish(counts, errors)
  return NextResponse.json({ job: 'delete', run: run.id, ...counts, errors })
}

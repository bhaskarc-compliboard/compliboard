/**
 * THE NIGHTLY DELETER — `DECISIONS.md` §110, §116, §125; the rule replaced in Workspace Task 2.
 *
 * Clears transcripts that are due. **The topic row and its summary survive**; only `turns` go.
 *
 * ---------------------------------------------------------------------------
 * THE RULE, AND IT LIVES IN `lib/retention.ts`, NOT HERE
 *
 *   A topic's turns are due 12 months after its LAST TURN. They are cleared only if the topic
 *   has a summary written at or after that last turn. A due topic without one is SKIPPED, and
 *   the nightly summariser — whose candidates are exactly "never summarised" and "spoken to since
 *   the summary" — writes it first. No conversation loses its turns with nothing kept.
 *
 * This replaces `delete_after < now` (stamped as summarised_at + 7 days by the summariser) and the
 * 30-day backstop that cleared UNSUMMARISED topics. The backstop existed so a summariser outage
 * could not make transcripts permanent; under the 12-month rule an outage leaves a topic skipped
 * and visible in `job_runs` as `skipped_no_summary`, which is the honest failure — a conversation
 * kept too long — rather than the silent one, a conversation lost with no summary.
 * ---------------------------------------------------------------------------
 *
 * NO OTHER LOGIC LIVES HERE. It does not summarise, does not extract, does not tidy topics. A
 * deletion job that also does something else is one whose blast radius has to be re-read every
 * time either half changes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { supabaseAdmin } from '@/lib/auth'
import { clearingCutoff, clearingDecision } from '@/lib/retention'

export const maxDuration = 800

/**
 * VERCEL CRON CALLS WITH GET — `Authorization: Bearer <CRON_SECRET>` (`lib/cronSecret.ts`). The same
 * job as POST, which stays for a person running it by hand with `x-cron-secret`. Workspace Stage 4 Part 3.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response

  const run = await startJobRun(supabaseAdmin, 'delete')
  const errors: Array<{ topic: string; error: string }> = []
  const removed: Array<{ topic: string; turns: number }> = []
  const skippedNoSummary: string[] = []
  let turnsDeleted = 0

  try {
    const now = new Date()
    // Only topics past the line come back; the per-topic decision is `clearingDecision`'s.
    const { data: old, error: e1 } = await supabaseAdmin
      .from('topics').select('id, last_turn_at, summarised_at, summary')
      .not('last_turn_at', 'is', null)
      .lt('last_turn_at', clearingCutoff(now).toISOString())
    if (e1) throw new Error(`listing topics past the retention line: ${e1.message}`)

    for (const topic of old ?? []) {
      const id = topic.id as string
      try {
        const decision = clearingDecision(topic, now)
        if (decision === 'keep') continue
        if (decision === 'skip_no_summary') { skippedNoSummary.push(id); continue }

        // *** THE COUNT IS WHAT THIS RUN DELETED, READ BACK FROM THE DELETE ITSELF. *** It used to be
        // counted first and deleted second, so two runs alive at once — Vercel "can also occasionally
        // invoke the same scheduled run more than once" — would each count the same turns and each log
        // the topic as cleared. Now the second run's delete returns no rows and it logs nothing.
        // A topic already cleared on an earlier night has none, and is not logged again.
        const { data: gone, error: dErr } = await supabaseAdmin.from('turns').delete().eq('topic_id', id).select('id')
        if (dErr) throw new Error(`deleting turns: ${dErr.message}`)
        const count = gone?.length ?? 0
        if (!count) continue

        removed.push({ topic: id, turns: count })
        turnsDeleted += count
      } catch (e) {
        errors.push({ topic: id, error: e instanceof Error ? e.message : String(e) })
      }
    }
  } catch (e) {
    errors.push({ topic: '(run)', error: e instanceof Error ? e.message : String(e) })
  }

  // BY TOPIC ID AND COUNT — gate two is "did it run, and what did it remove", and a total with
  // no breakdown cannot answer a customer asking about their own conversation. The skipped ids are
  // listed too: a topic kept past its date because nobody summarised it is a fact worth seeing.
  const counts = {
    topics_cleared: removed.length,
    turns_deleted: turnsDeleted,
    by_topic: removed,
    skipped_no_summary: skippedNoSummary,
  }
  await run.finish(counts, errors)
  return NextResponse.json({ job: 'delete', run: run.id, ...counts, errors })
}

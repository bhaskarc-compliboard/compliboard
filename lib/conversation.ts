/**
 * CONVERSATIONS THAT PERSIST — `DECISIONS.md` §125, Run 2.
 *
 * Until now a conversation lived for the length of the browser tab. This is the half that
 * writes it down: each exchange saved as it completes, the topic's clocks kept current, and the
 * counters that record what happened rather than what still exists.
 *
 * ---------------------------------------------------------------------------
 * WHO WRITES WHAT, AND WHY IT IS SPLIT
 *
 *   turns, topics    THE CALLER'S OWN CLIENT. `CLAUDE.md` §3.6 — routes connect as the caller,
 *                    so RLS applies and a bug cannot write into another company. `authenticated`
 *                    holds INSERT+SELECT on turns and INSERT+SELECT+UPDATE on topics, which is
 *                    exactly what this needs and nothing more.
 *
 *   usage_counters   THE SERVICE ROLE, as a named carve-out. `authenticated` holds SELECT only,
 *                    deliberately: a counter a customer can write is not a measurement.
 *
 *   turns.stopped    THE SERVICE ROLE, for the same shape of reason: `authenticated` holds no
 *                    UPDATE on turns, so a user cannot rewrite what the transcript says they
 *                    asked. See `markTurnStopped`.
 * ---------------------------------------------------------------------------
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Source } from './ai.ts'

/** The caller's client — built per request from their token. Never cached (§3.6). */
type Db = SupabaseClient<any, any, any>

export interface TurnRow {
  id: string
  position: number
  role: 'user' | 'assistant'
  text: string
  sources: Source[] | null
  stopped: boolean
  created_at: string
  /** The document attached to this turn, if any — migration 039, §129. */
  document_id: string | null
  /** A copy of its name, kept so the transcript survives the document's deletion. */
  document_name: string | null
}

/**
 * A NEW TURN CLEARS THE CLOCKS. An active conversation is never summarised or deleted under
 * someone — that is the promise, and this is the one line that keeps it.
 *
 * `idle_at` and `delete_after` go back to NULL, `last_turn_at` moves forward. A conversation
 * someone returns to on day six is not cleared on day seven.
 */
export async function touchTopic(db: Db, topicId: string): Promise<void> {
  const { error } = await db
    .from('topics')
    .update({ idle_at: null, delete_after: null, last_turn_at: new Date().toISOString() })
    .eq('id', topicId)
  if (error) throw new Error(`touchTopic(${topicId}): ${error.message}`)
}

/**
 * The next position in a topic, 1-based.
 *
 * Read-then-write, and the race is handled by the DATABASE rather than here: migration 031 puts
 * a unique index on (topic_id, position), so two concurrent submits produce a refused insert
 * rather than two turn 3s. That refusal is loud and recoverable; a silent duplicate would make
 * the transcript read as though the person said the same thing twice.
 */
export async function nextPosition(db: Db, topicId: string): Promise<number> {
  const { data, error } = await db
    .from('turns').select('position').eq('topic_id', topicId)
    .order('position', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`nextPosition(${topicId}): ${error.message}`)
  return (data?.position ?? 0) + 1
}

/** The question, saved when it arrives — before the answer is known, and whatever happens to it. */
export async function saveUserTurn(
  db: Db, args: { topicId: string; companyId: string; text: string; position: number
                  documentId?: string | null; documentName?: string | null },
): Promise<string> {
  const { data, error } = await db.from('turns').insert({
    topic_id: args.topicId, company_id: args.companyId,
    position: args.position, role: 'user', text: args.text,
    // The attachment, if this turn carried one (migration 039, §129). The NAME is stored
    // beside the id on purpose: deleting the document sets the id null and the transcript has
    // to keep saying what was attached.
    document_id: args.documentId ?? null,
    document_name: args.documentName ?? null,
  }).select('id').single()
  if (error) throw new Error(`saveUserTurn: ${error.message}`)
  await touchTopic(db, args.topicId)
  return data.id as string
}

/** The answer, saved when the stream ends, with the sources it cited. */
export async function saveAssistantTurn(
  db: Db,
  args: { topicId: string; companyId: string; text: string; sources: Source[]; position: number },
): Promise<void> {
  const { error } = await db.from('turns').insert({
    topic_id: args.topicId, company_id: args.companyId,
    position: args.position, role: 'assistant', text: args.text,
    sources: args.sources.length ? args.sources : null,
  })
  if (error) throw new Error(`saveAssistantTurn: ${error.message}`)
  await touchTopic(db, args.topicId)
}

/**
 * THE USER STOPPED IT. The question stays; no answer row is written.
 *
 * A stopped answer is not a question answered — so the counter does not move either (the route
 * increments only on a completed stream). Marking the user's turn rather than writing an empty
 * assistant turn keeps the transcript honest: the conversation shows a question that was asked
 * and abandoned, which is what happened.
 *
 * *** SERVICE ROLE, AND THE REASON IS THE GRANT I CHOSE. ***
 * Migration 031 gives `authenticated` SELECT and INSERT on `turns` and deliberately NOT UPDATE:
 * a user who can update a turn can rewrite what the transcript says they asked, and the summary
 * kept beside it would then disagree with it. So this one field is set by the service role, as a
 * named statement (`CLAUDE.md` §3.6), rather than by widening the grant.
 *
 * **Found by measurement, not by review:** the first version passed the caller's client and the
 * route logged `permission denied for table turns` on every stopped answer while the abort itself
 * looked fine. `stopped` stayed false and nothing on screen said so.
 */
export async function markTurnStopped(admin: Db, turnId: string): Promise<void> {
  const { error } = await admin.from('turns').update({ stopped: true }).eq('id', turnId)
  if (error) throw new Error(`markTurnStopped(${turnId}): ${error.message}`)
}

/**
 * A TITLE IS THE FIRST QUESTION, VERBATIM, UNTIL A SUMMARY EXISTS.
 *
 * Verbatim and not a model-written title: a generated one costs a call and a wait before the
 * first answer, and gets it wrong often enough to be worse than the words the person typed.
 * Truncated only for the column, never reworded.
 */
export function titleFromQuestion(question: string): string {
  const one = question.replace(/\s+/g, ' ').trim()
  return one.length <= 200 ? one : one.slice(0, 197) + '…'
}

/** Set the title on the first turn only — a later question must not rename the conversation. */
export async function setTitleIfFirst(db: Db, topicId: string, question: string): Promise<void> {
  const { data } = await db.from('topics').select('title').eq('id', topicId).maybeSingle()
  const current = String(data?.title ?? '').trim()
  if (current && current !== 'New conversation') return
  const { error } = await db.from('topics').update({ title: titleFromQuestion(question) }).eq('id', topicId)
  if (error) throw new Error(`setTitleIfFirst(${topicId}): ${error.message}`)
}

/** A topic's transcript, in order, for reopening it. */
export async function loadTurns(db: Db, topicId: string): Promise<TurnRow[]> {
  const { data, error } = await db
    .from('turns')
    .select('id, position, role, text, sources, stopped, created_at, document_id, document_name')
    .eq('topic_id', topicId).order('position', { ascending: true })
  if (error) throw new Error(`loadTurns(${topicId}): ${error.message}`)
  return (data ?? []) as TurnRow[]
}

/**
 * COUNTERS NEVER GO DOWN, AND ARE NEVER DERIVED FROM ROWS THAT CAN BE DELETED.
 *
 * Transcripts are cleared after seven days and checklists can be deleted; a `count(*)` would
 * fall on both, and tell a customer who asked forty questions that they asked six. These record
 * events.
 *
 * *** SERVICE ROLE, AS A NAMED STATEMENT (`CLAUDE.md` §3.6). *** `authenticated` holds SELECT
 * only on `usage_counters` on purpose — a counter a tenant can write is not a measurement. This
 * is the one write, and `admin` is passed in rather than built here so the route's own
 * service-role client is the only one in play.
 *
 * The increment is an upsert plus an atomic add, not read-modify-write: two answers completing
 * together must produce +2, and a JS read-then-write would produce +1.
 */
export async function bumpCounter(
  admin: Db, companyId: string, field: 'questions_answered' | 'checklists_created',
): Promise<void> {
  // The row may not exist yet. Create it at zero, ignore the conflict if a concurrent call won.
  const { error: seedErr } = await admin
    .from('usage_counters').insert({ company_id: companyId }).select('company_id')
  // 23505 is unique_violation — the row already existed, which is the normal case.
  if (seedErr && seedErr.code !== '23505') throw new Error(`bumpCounter seed: ${seedErr.message}`)

  const { error } = await admin.rpc('increment_usage_counter', {
    p_company_id: companyId, p_field: field,
  })
  if (error) throw new Error(`bumpCounter(${field}): ${error.message}`)
}

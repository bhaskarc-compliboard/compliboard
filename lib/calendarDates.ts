/**
 * ONE WRITER FOR EVERY DATE — `docs/CALENDAR-PLAN.md` decisions 7 and 8, `DECISIONS.md` §185.
 *
 * Every section that puts a date on the calendar calls `addDate`: Documents after a reading and from
 * its report's button, Audits from a date finding, the Workspace and HR summaries, and "Add a date".
 * Nothing inserts into `calendar_events` directly, for three reasons the map proved:
 *
 *   · B7 — Audits' button was a NAVIGATION carrying a title and a day, so the saved date had no
 *     document and no finding, and pressing it twice made two rows;
 *   · B8 — Documents' button checks `calendar_event_id` and THEN inserts, so two presses that cross
 *     both pass the check and insert twice;
 *   · B4 — every repeating date was written `'annually'` whatever the document said.
 *
 * *** THE KEY IS THE WHOLE MECHANISM (decision 7). *** `date_key` says what a date IS. Migration 073
 * puts `unique (company_id, date_key)` on the table, so a second write of the same date is refused by
 * the DATABASE, not by a check this code did first. `addDate` inserts and reads the refusal — a
 * compare-and-set, the shape the parked HR route already used
 * (`parked/hr-check-structured:app/api/hr/handbook-dates/[id]/calendar/route.ts:49–57`), and the shape
 * check-then-insert is not.
 *
 * *** THE KEY'S PARTS, AND WHY. *** Settled against staging's 36 current dates in step 3a:
 *   · (document, day) alone collides 3 times in 36, and one collision is DATED — a fire-extinguisher
 *     certificate whose 6-year internal maintenance and monthly visual inspection both fall on
 *     2026-10-31. Keying on the day alone would merge two real obligations and lose one.
 *   · Adding the normalised source line gives 36 distinct of 36.
 *   · And the line is the STABLE part: re-reading `13-company-self-check.docx` renamed a deadline
 *     completely ("Report any items marked N to the Plant Manager" -> "Report unchecked items to Plant
 *     Manager") while the normalised line was byte-identical. A title is not a key; the line is.
 *
 * *** THE WRITE-TIME RULE THAT COULD NOT BE A CONSTRAINT. *** A date must carry the link its `source`
 * names. That was written as a CHECK in 073 and the migration's own verify block refused it: a cascaded
 * `ON DELETE SET NULL` re-checks the row, so the constraint made deleting a conversation or a document
 * impossible. `HOW-WE-BUILD.md` §3 — some invariants cannot be constraints and need a named owner.
 * **This file is that owner**, in `requiredLink`, and `tests/unit/calendarDates.test.ts` holds it. The
 * database keeps the half that is true for ever: `date_key like source || ':%'`.
 */
import { normaliseForQuote } from './documentScan.ts'
import { nextOccurrence, today, type HowOften } from './calendarDate.ts'

export type DateSource = 'document' | 'conversation' | 'audit' | 'hand' | 'handbook'
export type DateState = 'not_confirmed' | 'confirmed' | 'done' | 'rejected' | 'withdrawn'
export type { HowOften }

export const DATE_SOURCES: DateSource[] = ['document', 'conversation', 'audit', 'hand', 'handbook']
export const DATE_STATES: DateState[] = ['not_confirmed', 'confirmed', 'done', 'rejected', 'withdrawn']

/** Every column a caller ever reads back. `counts_as_due` is the database's own (073, decision 5). */
export const DATE_COLUMNS =
  'id, company_id, user_id, title, description, due_date, source, state, rejected_reason, '
  + 'is_recurring, repeats_every, line_verified, counts_as_due, entity_id, document_id, '
  + 'document_deadline_id, topic_id, audit_finding_id, handbook_id, date_key, completed_at, created_at'

export interface CalendarDate {
  id: string
  company_id: string
  user_id: string | null
  title: string
  description: string | null
  due_date: string | null
  source: DateSource
  state: DateState
  rejected_reason: string | null
  is_recurring: boolean | null
  repeats_every: HowOften | null
  line_verified: boolean | null
  counts_as_due: boolean | null
  entity_id: string | null
  document_id: string | null
  document_deadline_id: string | null
  topic_id: string | null
  audit_finding_id: string | null
  handbook_id: string | null
  date_key: string
  completed_at: string | null
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/** Postgres's unique-violation code. A refusal here is the key doing its job, not an error. */
const UNIQUE_VIOLATION = '23505'

/**
 * The line a key is built from, normalised.
 *
 * *** IT IS `normaliseForQuote`, THE RULE THAT ALREADY EXISTS *** (`lib/documentScan.ts:194`): tags
 * out, lower case, letters and digits only. HR's handbook quotes use it and so does the scan's own
 * quote check, by the owner's decision of 7 October that there is ONE normalisation rule. A second
 * rule here would mean a date's identity and its quote check disagreed about what the same sentence is.
 *
 * Capped at 200 characters. A key is an identity, not a copy of the document: the first 200 normalised
 * characters of a deadline's line are far past the point where two different obligations still match,
 * and an unbounded key would put a paragraph in an index.
 */
export function normaliseLine(line: string | null | undefined): string {
  if (!line) return ''
  return normaliseForQuote(String(line)).slice(0, 200)
}

export interface KeyParts {
  source: DateSource
  /** The thing the date belongs to: the document, the conversation, the handbook, the finding. */
  refId: string | null
  /** The day, or null for a repeat whose day nobody has given us yet. */
  day: string | null
  /** The source line or quote the date rests on. */
  line: string | null
  /** Only for `hand`: the row's own id, so a person's dates never collide with each other. */
  ownId?: string | null
}

/**
 * What a date IS, as one string. The database refuses two rows in one company with the same one.
 *
 * `hand` is deliberately NOT content-keyed: a person pressing Save is the authority on whether this is
 * a second date, so a hand date keys on its own id and two identical ones are allowed. Every other
 * source is content-keyed, because every other source can be re-run.
 *
 * `no-day` rather than an empty part, so a dateless repeat and a date whose day is the empty string can
 * never produce the same key.
 */
export function dateKey(parts: KeyParts): string {
  const { source, refId, day, line } = parts
  if (source === 'hand') return `hand:${parts.ownId ?? crypto.randomUUID()}`
  return `${source}:${refId ?? 'none'}:${day ?? 'no-day'}:${normaliseLine(line)}`
}

export interface AddDateArgs {
  companyId: string
  userId?: string | null
  source: DateSource
  title: string
  /** A `YYYY-MM-DD` day, or null for a repeat with no day (073 requires `repeats` then). */
  day: string | null
  /** The line or quote this date rests on. It becomes the key and the row's description. */
  line?: string | null
  /** Whether the document's own line was found in it (decision 5). Null = no text to check against. */
  lineVerified?: boolean | null
  state: DateState
  repeats?: boolean
  every?: HowOften | null
  entityId?: string | null
  documentId?: string | null
  documentDeadlineId?: string | null
  topicId?: string | null
  auditFindingId?: string | null
  handbookId?: string | null
  /** Overrides the computed key. Only the tests and a migration-style backfill pass this. */
  key?: string
}

export type AddResult =
  | { created: true; date: CalendarDate }
  /** The same date is already there. Not an error: this is what the key is for. */
  | { created: false; reason: 'already'; date: CalendarDate }
  /** A person said no to this exact date. A later reading must not raise it again (decision 6). */
  | { created: false; reason: 'rejected_before'; date: CalendarDate }
  /** The caller's own mistake — a missing link, a bad state. Never shown to a customer as-is. */
  | { created: false; reason: 'refused'; error: string }

/**
 * THE INVARIANT A CHECK CONSTRAINT COULD NOT HOLD: a date must carry the link its source names.
 * Returns the missing field's name, or null when the date is well-formed.
 */
export function requiredLink(args: Pick<AddDateArgs,
  'source' | 'documentId' | 'topicId' | 'auditFindingId' | 'handbookId'>): string | null {
  switch (args.source) {
    case 'document': return args.documentId ? null : 'documentId'
    case 'conversation': return args.topicId ? null : 'topicId'
    case 'audit': return args.auditFindingId ? null : 'auditFindingId'
    case 'handbook': return args.handbookId ? null : 'handbookId'
    case 'hand': return null          // a person is the provenance
    default: return 'source'
  }
}

/** The ref a key uses for each source: the thing the date belongs to, not the row it was read from. */
function refFor(args: AddDateArgs): string | null {
  switch (args.source) {
    case 'document': return args.documentId ?? null
    case 'conversation': return args.topicId ?? null
    // The DOCUMENT, not the finding: an audit date about a permit is about that permit, and keying on
    // the finding would make every audit run's copy of the same date a new date.
    case 'audit': return args.documentId ?? args.auditFindingId ?? null
    case 'handbook': return args.handbookId ?? null
    default: return null
  }
}

/**
 * Add one date, or say what was already there.
 *
 * COMPARE-AND-SET, NOT CHECK-THEN-INSERT. It inserts first and reads a `23505` as "already" — so two
 * presses that cross cannot both win, which is the defect B8 recorded in Documents' own button. The
 * row that is already there is then read back and returned, because every caller needs to show it
 * ("On your calendar", "Not right: …").
 */
export async function addDate(db: Db, args: AddDateArgs): Promise<AddResult> {
  const missing = requiredLink(args)
  if (missing) {
    return { created: false, reason: 'refused',
      error: `a ${args.source} date needs ${missing}` }
  }
  if (!args.title?.trim()) return { created: false, reason: 'refused', error: 'a date needs a title' }
  if (!DATE_STATES.includes(args.state)) {
    return { created: false, reason: 'refused', error: `"${args.state}" is not a state` }
  }
  // 073's `calendar_events_dateless_must_repeat`, said here so the caller gets a sentence rather than
  // a constraint name.
  if (!args.day && !args.repeats) {
    return { created: false, reason: 'refused', error: 'a date with no day must be a repeating one' }
  }

  const key = args.key ?? dateKey({
    source: args.source, refId: refFor(args), day: args.day, line: args.line ?? null,
  })

  const row = {
    company_id: args.companyId,
    user_id: args.userId ?? null,
    title: args.title.trim().slice(0, 500),
    description: args.line ? String(args.line).slice(0, 2000) : null,
    due_date: args.day,
    source: args.source,
    state: args.state,
    is_recurring: !!args.repeats,
    // NEVER DEFAULTED TO 'yearly'. B4: the old code wrote 'annually' for every repeat and staging's
    // only repeats are monthly. A repeat whose period nobody has said stays null and the person is
    // asked (decision 9).
    repeats_every: args.every ?? null,
    line_verified: args.lineVerified ?? null,
    entity_id: args.entityId ?? null,
    document_id: args.documentId ?? null,
    document_deadline_id: args.documentDeadlineId ?? null,
    topic_id: args.topicId ?? null,
    audit_finding_id: args.auditFindingId ?? null,
    handbook_id: args.handbookId ?? null,
    date_key: key,
  }

  const { data, error } = await db.from('calendar_events').insert(row).select(DATE_COLUMNS).single()
  if (!error) return { created: true, date: data as CalendarDate }
  if (error.code !== UNIQUE_VIOLATION) {
    return { created: false, reason: 'refused', error: error.message }
  }

  // The key refused it. Read back what is there, so the caller can say which of the two it is.
  const { data: existing } = await db.from('calendar_events')
    .select(DATE_COLUMNS).eq('company_id', args.companyId).eq('date_key', key).maybeSingle()
  if (!existing) {
    // The row is there (the index said so) and this caller cannot see it. That is RLS, not absence,
    // and saying "already" would be a guess about a row we were refused.
    return { created: false, reason: 'refused', error: 'that date already exists and is not readable here' }
  }
  const date = existing as CalendarDate
  return date.state === 'rejected'
    ? { created: false, reason: 'rejected_before', date }
    : { created: false, reason: 'already', date }
}

/**
 * Dates from the same document on the same day, whatever their source (decision 7, the owner's answer
 * of 9 October).
 *
 * *** THIS IS SHOWN, NEVER ACTED ON. *** Audits may offer a date Documents has already added, and the
 * two have no shared line to key on — `lib/audit.ts:176` does not even read `source_line`, and a
 * finding's `quote` is the model's own words. A soft match on (document, day) would therefore tell a
 * person "already on your calendar" about a DIFFERENT obligation: staging holds the proof, a
 * fire-extinguisher certificate with two unrelated deadlines on 2026-10-31. So the match is never used
 * to suppress a write. It is handed to the screen, which says what is already there and lets the
 * person decide.
 */
export async function siblingsOnDay(db: Db, args: {
  companyId: string; documentId: string; day: string; exceptId?: string
}): Promise<CalendarDate[]> {
  const { data } = await db.from('calendar_events')
    .select(DATE_COLUMNS)
    .eq('company_id', args.companyId)
    .eq('document_id', args.documentId)
    .eq('due_date', args.day)
    .in('state', ['not_confirmed', 'confirmed', 'done'])
    .order('created_at')
  return ((data ?? []) as CalendarDate[]).filter((d) => d.id !== args.exceptId)
}

export type ChangeResult =
  | { ok: true; date: CalendarDate }
  | { ok: false; error: string; status: 404 | 400 }

/** One ownership read, once, for every change below. 404 rather than 403 so ids cannot be probed. */
async function mine(db: Db, companyId: string, id: string): Promise<CalendarDate | null> {
  const { data } = await db.from('calendar_events')
    .select(DATE_COLUMNS).eq('id', id).eq('company_id', companyId).maybeSingle()
  return (data as CalendarDate) ?? null
}

const NOT_FOUND = { ok: false as const, error: 'That date was not found.', status: 404 as const }

/**
 * Confirm a date, optionally settling the two things a document date cannot know: its day, and how
 * often it repeats (decision 9). Confirming is also what puts a date whose line we could not find onto
 * the month — decision 5's "until confirmed" — which the database's `counts_as_due` does by itself.
 */
export async function confirmDate(db: Db, args: {
  companyId: string; id: string; day?: string | null; every?: HowOften | null
}): Promise<ChangeResult> {
  const row = await mine(db, args.companyId, args.id)
  if (!row) return NOT_FOUND
  const day = args.day ?? row.due_date
  const every = args.every ?? row.repeats_every
  if (!day && !row.is_recurring) {
    return { ok: false, error: 'That date needs a day before it can be confirmed.', status: 400 }
  }
  const patch: Record<string, unknown> = { state: 'confirmed', rejected_reason: null }
  if (args.day !== undefined) patch.due_date = day
  if (args.every !== undefined) patch.repeats_every = every
  const { data, error } = await db.from('calendar_events')
    .update(patch).eq('id', args.id).eq('company_id', args.companyId).select(DATE_COLUMNS).single()
  if (error) return { ok: false, error: error.message, status: 400 }
  return { ok: true, date: data as CalendarDate }
}

/**
 * "Not right" — kept, never deleted, with the reason on the row (decision 6).
 *
 * The reason is REQUIRED, and 073 refuses a rejected row without one. It is what the next reading is
 * measured against: `addDate` returns `rejected_before` for the same key, so the same date is not
 * raised again.
 */
export async function rejectDate(db: Db, args: {
  companyId: string; id: string; reason: string
}): Promise<ChangeResult> {
  if (!args.reason?.trim()) {
    return { ok: false, error: 'Please say why this date is not right.', status: 400 }
  }
  const row = await mine(db, args.companyId, args.id)
  if (!row) return NOT_FOUND
  const { data, error } = await db.from('calendar_events')
    .update({ state: 'rejected', rejected_reason: args.reason.trim().slice(0, 2000) })
    .eq('id', args.id).eq('company_id', args.companyId).select(DATE_COLUMNS).single()
  if (error) return { ok: false, error: error.message, status: 400 }
  return { ok: true, date: data as CalendarDate }
}

/**
 * Tick a date done — and if it repeats, make the next one (decision 9).
 *
 * *** THE DONE ONE STAYS. *** One row per occurrence, so "we did this in January and again in
 * February" is the history the product exists to keep. The next occurrence is a NEW row with its own
 * key (the day is part of the key), added through `addDate` so it cannot duplicate one that is already
 * there — which is what happens when a person ticks two months' worth in one sitting.
 *
 * A repeat with no "how often" makes no next one: there is nothing to roll forward by, and guessing
 * 'yearly' is exactly B4.
 */
export async function markDone(db: Db, args: {
  companyId: string; userId?: string | null; id: string
}): Promise<{ ok: true; done: CalendarDate; next: CalendarDate | null; why?: string }
  | { ok: false; error: string; status: 404 | 400 }> {
  const row = await mine(db, args.companyId, args.id)
  if (!row) return NOT_FOUND
  const { data, error } = await db.from('calendar_events')
    .update({ state: 'done', completed: true, completed_at: new Date().toISOString() })
    .eq('id', args.id).eq('company_id', args.companyId).select(DATE_COLUMNS).single()
  if (error) return { ok: false, error: error.message, status: 400 }
  const done = data as CalendarDate

  if (!done.is_recurring) return { ok: true, done, next: null }
  if (!done.repeats_every) {
    return { ok: true, done, next: null, why: 'nobody has said how often this repeats' }
  }
  if (!done.due_date) return { ok: true, done, next: null, why: 'this repeat has no day yet' }
  const nextDay = nextOccurrence(done.due_date, done.repeats_every)
  if (!nextDay) return { ok: true, done, next: null, why: 'the next day could not be worked out' }

  const added = await addDate(db, {
    companyId: args.companyId, userId: args.userId ?? done.user_id,
    source: done.source, title: done.title, day: nextDay,
    line: done.description, lineVerified: done.line_verified,
    // *** THE NEXT ONE IS CONFIRMED, WHATEVER ITS SOURCE. *** The person agreed that this obligation
    // repeats and then ticked it done; asking them to confirm the same recurring date every month
    // would be a queue that never empties, which is the failure decision 3 is built to avoid.
    state: 'confirmed',
    repeats: true, every: done.repeats_every,
    entityId: done.entity_id, documentId: done.document_id,
    documentDeadlineId: done.document_deadline_id, topicId: done.topic_id,
    auditFindingId: done.audit_finding_id, handbookId: done.handbook_id,
  })
  return { ok: true, done, next: added.created ? added.date : (added.reason === 'refused' ? null : added.date) }
}

/**
 * Withdraw the NOT-CONFIRMED dates of readings and versions that are no longer current (decision 4).
 *
 * *** MARKED, NEVER DELETED, and a CONFIRMED date is never touched *** — a person said it was right,
 * and the product does not overrule them because a newer reading did not mention it. That is the same
 * rule `saveScan` already follows for gaps nobody re-raised (`lib/documentScan.ts` Run 7's
 * `not_seen_at`).
 *
 * WHAT MAKES A DATE STALE: its `document_deadline_id` is not in `document_dates_current_v` — the view
 * 073 created, which is the current reading of a document no confirmed newer version supersedes. The
 * link is what makes this a join rather than a rebuilt key, and is why it is on the table at all.
 *
 * A date with NO deadline link is left alone: it came from a person, a conversation or an audit, and
 * nothing about a document reading makes it stale.
 */
export async function withdrawStale(db: Db, args: {
  companyId: string; documentId?: string
}): Promise<{ withdrawn: number; ids: string[] }> {
  let live = db.from('document_dates_current_v').select('deadline_id').eq('company_id', args.companyId)
  if (args.documentId) live = live.eq('document_id', args.documentId)
  const { data: currentRows, error: liveErr } = await live
  // *** AN ERROR IS NOT AN EMPTY LIST. *** If the view cannot be read, every date would look stale and
  // this would withdraw the lot. So a failure withdraws nothing and says so.
  if (liveErr) throw new Error(`the current dates could not be read: ${liveErr.message}`)
  const keep = new Set(((currentRows ?? []) as Array<{ deadline_id: string }>).map((r) => r.deadline_id))

  let q = db.from('calendar_events')
    .select('id, document_deadline_id')
    .eq('company_id', args.companyId)
    .eq('source', 'document')
    .eq('state', 'not_confirmed')
    .not('document_deadline_id', 'is', null)
  if (args.documentId) q = q.eq('document_id', args.documentId)
  const { data: mineRows, error } = await q
  if (error) throw new Error(`the calendar could not be read: ${error.message}`)

  const stale = ((mineRows ?? []) as Array<{ id: string; document_deadline_id: string }>)
    .filter((r) => !keep.has(r.document_deadline_id))
  if (!stale.length) return { withdrawn: 0, ids: [] }

  const ids = stale.map((r) => r.id)
  const { error: upErr } = await db.from('calendar_events')
    .update({ state: 'withdrawn' })
    .in('id', ids).eq('company_id', args.companyId).eq('state', 'not_confirmed')
  if (upErr) throw new Error(`the stale dates could not be withdrawn: ${upErr.message}`)
  return { withdrawn: ids.length, ids }
}

/** The three tabs' reads, in one place so the page and the email cannot disagree. */
export async function listDates(db: Db, args: {
  companyId: string; view: 'board' | 'to_confirm' | 'all'
}): Promise<CalendarDate[]> {
  let q = db.from('calendar_events').select(DATE_COLUMNS).eq('company_id', args.companyId)
  if (args.view === 'board') q = q.eq('counts_as_due', true)
  if (args.view === 'to_confirm') q = q.eq('state', 'not_confirmed')
  const { data } = await q.order('due_date', { ascending: true, nullsFirst: false }).order('title')
  return (data ?? []) as CalendarDate[]
}

/** Today, in the calendar's zone. Re-exported so a caller needs one import. */
export { today }

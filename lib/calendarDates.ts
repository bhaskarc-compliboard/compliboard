/**
 * EVERY DATE IN THE PRODUCT GOES THROUGH HERE — Calendar step 5 (`docs/CALENDAR-PLAN.md` decisions
 * 5, 6, 8, 11, 13, 23; §2.6 is the contract). Migration 073 is the table.
 *
 * *** SECTIONS THAT FIND A DATE CALL `proposeDate()` AND KEEP NO CALENDAR LOGIC OF THEIR OWN. ***
 * That is decision 6, and the reason is the one the read-only map found: before this, two writers
 * each built their own `calendar_events` row with their own vocabulary — `category: 'document'` in
 * one (`app/api/document-actions/route.ts:143`) and `category: 'compliance'` in the other
 * (`app/calendar/page.tsx:210`), against a column with no CHECK (map B1). A second writer is a
 * second set of rules nobody is comparing.
 *
 * *** NO NEXT-DATE LOGIC LIVES HERE. *** `next_due` is computed by `calendar_v` at read time, which
 * is migration 049's rule for `significant_date`: a derived date stored is a date that goes stale
 * the first time its anchor moves. Nothing in this file does date arithmetic, and nothing should.
 *
 * *** THE INVARIANT: AT MOST ONE LIVE ROW PER (company, document, lower(title)). ***
 * Live means `dismissed_by is null and replaced_by is null`. The database holds half of it — the
 * partial unique index `idx_calendar_events_company_document_title_due` refuses the SAME date twice
 * — and this file holds the other half, which no constraint can see: a date that MOVED supersedes
 * the one it replaces rather than sitting beside it. Readers filter on `replaced_by is null`.
 *
 * Called with the CALLER'S OWN client wherever a session exists, so RLS applies and a row of
 * another company is simply not there; with the service role only where there is no session (the
 * document scan). It never reads `profiles` and never derives a company: `companyId` is passed in,
 * from a verified session or from the row being scanned (`CLAUDE.md` §3.6).
 */

type Db = { from: (t: string) => any }   // eslint-disable-line @typescript-eslint/no-explicit-any

/** Migration 073's `calendar_events_period_is_known`. NULL is "repeats, how often not known yet". */
export const PERIODS = ['month', 'quarter', '6 months', 'year', '2 years'] as const
export type Period = (typeof PERIODS)[number]

/** Migration 073's `calendar_events_source_is_known` — where the date came from. */
export const SOURCES = ['document', 'audit', 'handbook', 'rule', 'person'] as const
export type DateSource = (typeof SOURCES)[number]

/** Migration 073's `calendar_events_status_is_known`. */
export const STATUSES = ['proposed', 'confirmed', 'dismissed'] as const
export type DateStatus = (typeof STATUSES)[number]

/**
 * A SOURCE A PERSON SPOKE FOR IS CONFIRMED THE MOMENT IT IS MADE (§2.6).
 * `person` is somebody typing a date; `rule` is the chat offering one and the person pressing it.
 * Both are a person saying "yes, this applies to us", which is exactly what confirming means — so
 * making them `proposed` would put a person's own date in the queue asking them to confirm it.
 * Everything a MACHINE read — a document, an audit, a handbook — arrives `proposed`.
 */
export const CONFIRMED_SOURCES: readonly DateSource[] = ['person', 'rule']

export interface ProposeInput {
  companyId: string
  source: DateSource
  title: string
  /** `YYYY-MM-DD`, or null for a repeating date whose day is not known (decision 12). */
  dueOn: string | null
  recurs: boolean
  /**
   * The person's own note, NOT the line a document said it in — that is `sourceLine`. §2.6 keeps
   * `description` as a column and the drawer shows it, and a date somebody typed has nowhere else
   * to put the note they typed with it. Beyond §2.6's signature list, and said so in the step report.
   */
  description?: string | null
  sourceLine?: string | null
  sourceUrl?: string | null
  sourcePage?: string | null
  documentId?: string | null
  deadlineId?: string | null
  auditFindingId?: string | null
  handbookId?: string | null
  entityId?: string | null
  addedBy?: string | null
  /** Overrides the source's default. `dismissed` is never a starting status — that is `dismissDate`. */
  status?: 'proposed' | 'confirmed'
}

/**
 * `created`  — a new row.
 * `existing` — this exact date is already on the calendar and was left alone.
 * `replaced` — the date MOVED: a new row, and every live row with the same title superseded.
 * `revived`  — a date a later reading had superseded has come back, because the newest reading of
 *              the document found it again (the owner, 15 October).
 */
export type ProposeOutcome = 'created' | 'existing' | 'replaced' | 'revived'
export interface ProposeResult { id: string; outcome: ProposeOutcome }

/** The dedupe key's title half, matching the index's `lower(title)` over the trimmed value stored. */
export const normaliseTitle = (t: string): string => t.trim().toLowerCase()

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

/** One row as the dedupe needs it. */
interface Sibling {
  id: string; title: string; due_date: string | null
  status: string; dismissed_by: string | null; replaced_by: string | null
}

/**
 * *** EVERY CONTRACT VIOLATION THROWS, AND THAT IS DELIBERATE. ***
 * Each caller is server code: the scan, an audit run, a route that has already validated its body.
 * A bad value here is a programming error, not a person's mistake, and the one thing it must not do
 * is become a silent absence — `HOW-WE-BUILD.md` §3, validate the structure of what you extracted
 * BEFORE writing it. A date that does not parse must not be quietly dropped to null, because a
 * calendar with a missing date looks exactly like a document that set none.
 */
function check(input: ProposeInput): void {
  if (!input.companyId) throw new Error('proposeDate: no companyId')
  if (!(SOURCES as readonly string[]).includes(input.source)) {
    throw new Error(`proposeDate: "${input.source}" is not a source (${SOURCES.join(', ')})`)
  }
  if (!input.title || !input.title.trim()) throw new Error('proposeDate: a date needs a title')
  if (input.dueOn !== null && !DATE_SHAPE.test(input.dueOn)) {
    throw new Error(`proposeDate: "${input.dueOn}" is not a YYYY-MM-DD date`)
  }
  // Migration 073's `calendar_events_date_or_recurs`, said here so the message names the rule
  // rather than arriving as a Postgres constraint string three layers away from the caller.
  if (input.dueOn === null && input.recurs !== true) {
    throw new Error('proposeDate: a one-off date must have a day; only a repeating date may have none')
  }
  if (input.status && input.status !== 'proposed' && input.status !== 'confirmed') {
    throw new Error(`proposeDate: "${input.status}" is not a starting status; removing a date is dismissDate()`)
  }
}

/** The rows that share this date's document and title — the dedupe set, in one query. */
async function siblingsOf(db: Db, companyId: string, documentId: string, title: string): Promise<Sibling[]> {
  // `source = 'document'` because that is the partial unique index's own WHERE: a row that cites a
  // document from some other source is not in the key and must not be superseded by one that is.
  const { data, error } = await db.from('calendar_events')
    .select('id, title, due_date, status, dismissed_by, replaced_by')
    .eq('company_id', companyId).eq('document_id', documentId).eq('source', 'document')
  if (error) throw new Error(`calendar_events: ${error.message}`)
  const key = normaliseTitle(title)
  return ((data ?? []) as Sibling[]).filter((r) => normaliseTitle(r.title ?? '') === key)
}

/** `replaced_by = winner` on every sibling but the winner that a PERSON has not dismissed. */
async function supersede(db: Db, sibs: Sibling[], winnerId: string): Promise<void> {
  // A person's dismissal is never touched (rule b). Rows already superseded ARE re-pointed, so
  // `replaced_by` always names the row that is live now rather than the next link in a chain.
  const ids = sibs.filter((r) => r.id !== winnerId && !r.dismissed_by).map((r) => r.id)
  if (!ids.length) return
  const { error } = await db.from('calendar_events').update({ replaced_by: winnerId }).in('id', ids)
  if (error) throw new Error(`calendar_events: ${error.message}`)
}

export async function proposeDate(db: Db, input: ProposeInput): Promise<ProposeResult> {
  check(input)
  const status: DateStatus = input.status
    ?? (CONFIRMED_SOURCES.includes(input.source) ? 'confirmed' : 'proposed')

  const row: Record<string, unknown> = {
    company_id: input.companyId,
    source: input.source,
    title: input.title.trim(),
    description: input.description ?? null,
    due_date: input.dueOn,
    recurs: input.recurs === true,
    status,
    source_line: input.sourceLine ?? null,
    source_url: input.sourceUrl ?? null,
    source_page: input.sourcePage ?? null,
    document_id: input.documentId ?? null,
    deadline_id: input.deadlineId ?? null,
    audit_finding_id: input.auditFindingId ?? null,
    handbook_id: input.handbookId ?? null,
    entity_id: input.entityId ?? null,
    added_by: input.addedBy ?? null,
  }
  // A row born confirmed names its confirmer, or the drawer would show "confirmed" by nobody and
  // `confirmed_at` would be null on exactly the dates a person is most sure of.
  if (status === 'confirmed' && input.addedBy) {
    row.confirmed_by = input.addedBy
    row.confirmed_at = new Date().toISOString()
  }

  const insert = async (): Promise<string> => {
    const { data, error } = await db.from('calendar_events').insert(row).select('id').single()
    if (error) throw new Error(`calendar_events: ${error.message}`)
    return data.id as string
  }

  // *** THE DEDUPE IS FOR DOCUMENT DATES ONLY, AND IT NEEDS THE DOCUMENT. ***
  // Decision 13: the key is the document, never the scan, because `document_deadlines` rows are
  // written per scan (map B2) so a re-read makes a new row for the same real-world date. A date
  // from any other source is a new row every time — two people may type the same reminder.
  if (input.source !== 'document' || !input.documentId) {
    return { id: await insert(), outcome: 'created' }
  }

  const sibs = await siblingsOf(db, input.companyId, input.documentId, input.title)
  const same = sibs.find((r) => (r.due_date ?? null) === input.dueOn)

  if (same) {
    // *** (b) A DATE A PERSON REMOVED NEVER COMES BACK (the owner, 15 October). ***
    // Whatever the reading says. The person gave a reason; a later scan finding the same line is
    // not new information about their decision, and resurrecting it would quietly overrule them.
    if (same.dismissed_by) return { id: same.id, outcome: 'existing' }

    // *** (a) A DATE ONLY SUPERSEDED COMES BACK, BECAUSE THE LATEST READING IS THE TRUTH. ***
    // The permit said 15 November, a re-read said 18 July and superseded it, and today's reading
    // says 15 November again — most likely the middle reading was wrong. The row returns as
    // `proposed` (a person confirms it, as they would any reading), its `replaced_by` is cleared,
    // and everything that had superseded it is superseded BY it, so the invariant still holds.
    if (same.replaced_by) {
      const { error } = await db.from('calendar_events')
        .update({ status: 'proposed', replaced_by: null }).eq('id', same.id)
      if (error) throw new Error(`calendar_events: ${error.message}`)
      await supersede(db, sibs, same.id)
      return { id: same.id, outcome: 'revived' }
    }
    return { id: same.id, outcome: 'existing' }
  }

  // No row for this exact day: the date MOVED. The new one is created and the old ones superseded
  // — never deleted (decision 11), so "we were told 18 July and then 15 November" stays readable.
  const wasLive = sibs.some((r) => !r.dismissed_by && !r.replaced_by)
  const id = await insert()
  await supersede(db, [...sibs, { id, title: input.title, due_date: input.dueOn, status, dismissed_by: null, replaced_by: null }], id)
  return { id, outcome: wasLive ? 'replaced' : 'created' }
}

// ---------------------------------------------------------------------------------------------
// WHAT A PERSON DOES TO A DATE. `{ status, json }`, as `lib/handbookSave.ts` returns, so a route
// is three lines and the words live here with the rule they belong to.
// ---------------------------------------------------------------------------------------------

export type ActResult = { status: number; json: Record<string, unknown> }

/** 404 and never 403, so an id cannot be probed by watching which error comes back (§3.6). */
const NOT_FOUND: ActResult = { status: 404, json: { error: 'That date was not found.' } }

const ROW_COLUMNS = 'id, status, dismissed_by, dismissed_reason, confirmed_by, confirmed_at, recurs, period'

async function load(db: Db, id: string) {
  const { data, error } = await db.from('calendar_events').select(ROW_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  return data as { id: string; status: string; dismissed_by: string | null; recurs: boolean } | null
}

export async function confirmDate(db: Db, id: string, userId: string): Promise<ActResult> {
  if (!id) return { status: 400, json: { error: 'No date given.' } }
  const row = await load(db, id)
  if (!row) return NOT_FOUND
  // A removed date is not re-confirmed into existence: the person who removed it gave a reason,
  // and the honest way back is to add the date again (§5.1 — say what they can do next).
  if (row.status === 'dismissed') {
    return { status: 409, json: { error: 'That date was removed. Add it again if you need it back.' } }
  }
  const { data, error } = await db.from('calendar_events')
    .update({ status: 'confirmed', confirmed_by: userId, confirmed_at: new Date().toISOString() })
    .eq('id', id).select(ROW_COLUMNS).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  if (!data) return NOT_FOUND
  return { status: 200, json: { date: data } }
}

export async function dismissDate(db: Db, id: string, userId: string, reason: string): Promise<ActResult> {
  if (!id) return { status: 400, json: { error: 'No date given.' } }
  // A REASON IS REQUIRED, as it is for dismissing a gap (`app/api/document-actions/route.ts:84–86`)
  // and for the same reason: the reason is what stops a later reading proposing it again, and
  // "doesn't apply" with no sentence is how a real date gets buried.
  if (!reason || !String(reason).trim()) {
    return { status: 400, json: { error: 'Please say why this date is not right.' } }
  }
  const row = await load(db, id)
  if (!row) return NOT_FOUND
  const { data, error } = await db.from('calendar_events')
    .update({ status: 'dismissed', dismissed_by: userId, dismissed_at: new Date().toISOString(),
              dismissed_reason: String(reason).trim().slice(0, 2000) })
    .eq('id', id).select(ROW_COLUMNS).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  if (!data) return NOT_FOUND
  return { status: 200, json: { date: data } }
}

export async function setPeriod(db: Db, id: string, period: string | null): Promise<ActResult> {
  if (!id) return { status: 400, json: { error: 'No date given.' } }
  // null is a real answer — "it repeats, we do not know how often yet" (decision 23), which is what
  // a document scan gives us, so clearing the period must always be allowed.
  const value = period === null || period === '' ? null : period
  if (value !== null && !(PERIODS as readonly string[]).includes(value)) {
    return { status: 400, json: { error: `"${value}" is not how often a date can repeat.` } }
  }
  const row = await load(db, id)
  if (!row) return NOT_FOUND
  const { data, error } = await db.from('calendar_events')
    .update({ period: value }).eq('id', id).select(ROW_COLUMNS).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  if (!data) return NOT_FOUND
  return { status: 200, json: { date: data } }
}

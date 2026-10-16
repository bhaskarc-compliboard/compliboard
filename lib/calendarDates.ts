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
 * Live means `status in ('proposed','confirmed') and replaced_by is null`. The database holds half
 * of it — the partial unique index `idx_calendar_events_company_document_title_due` refuses the
 * SAME date twice — and this file holds the other half, which no constraint can see: a date that
 * MOVED supersedes the one it replaces rather than sitting beside it. Readers filter on
 * `replaced_by is null` and, since step 6b, on the status.
 *
 * *** AND THE TEST FOR LIVE IS `status`, NOT `dismissed_by` — Calendar step 6b. ***
 * It used to be `dismissed_by is null`, which read as the same thing and is not:
 * `calendar_events_dismissed_by_fkey` is `ON DELETE SET NULL`, so deleting the person who removed
 * a date would turn their decision into an absence and the next reading would revive a date
 * somebody took off the calendar on purpose. A rule that depends on a nullable column staying
 * non-null is a rule with an expiry date. `confirmed_by`, `dismissed_by` and `withdrawn_at` are
 * the record of WHO and WHEN; `status` is the test for WHETHER.
 *
 * *** THE CURRENT READING WINS — decision 29 (the owner, 15 October 2026). ***
 * Reading a document again withdraws every PROPOSED date from that document's earlier readings
 * that this reading did not propose again, and a finished audit of an agency does the same for
 * that agency's earlier runs. `withdrawUnseenDocumentDates` and `withdrawAuditDatesNotMatchedBy`
 * at the foot of this file are the whole of it; the reasoning is in migration 075's header and in
 * `docs/CALENDAR-PLAN.md` §2.3. A WITHDRAWN ROW IS NOT A PERSON'S DISMISSAL: if a later reading
 * proposes the same title and day again it comes back (`revived`), where a dismissed one never
 * does (rule b).
 *
 * *** AND FOR AN AUDIT DATE THE WHOLE RULE IS HERE, BECAUSE NO INDEX CAN HOLD IT. ***
 * The index is partial on `source = 'document'`. An audit finding's id changes with every run, so
 * there is nothing stable to key on in the database; the key is (company, lower(title), day) among
 * LIVE audit rows, and a match moves `audit_finding_id` to the newest finding instead of inserting.
 * `auditSiblingsOf` below. One obligation found by three DEQ runs is one date on the calendar.
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

/**
 * Migration 073's `calendar_events_status_is_known`, widened by 075 (step 6b).
 * `withdrawn` is the product saying "the reading this came from no longer says it" — never a
 * person. It is told apart from `dismissed` in the DATA because the two behave differently: a
 * withdrawn date comes back if a later reading proposes it again, a dismissed one never does.
 */
export const STATUSES = ['proposed', 'confirmed', 'dismissed', 'withdrawn'] as const
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
 * `existing` — this exact date is already on the calendar and was left alone. (For an audit source,
 *              `audit_finding_id` is moved to the newest finding, which is the one write.)
 * `replaced` — the date MOVED: a new row, and every live row with the same title superseded.
 * `revived`  — a date an earlier reading had superseded, or that a later reading had WITHDRAWN
 *              (step 6b), has come back, because the newest reading found it again.
 */
export type ProposeOutcome = 'created' | 'existing' | 'replaced' | 'revived'
export interface ProposeResult { id: string; outcome: ProposeOutcome }

/** The dedupe key's title half, matching the index's `lower(title)` over the trimmed value stored. */
export const normaliseTitle = (t: string): string => t.trim().toLowerCase()

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

/** One row as the dedupe needs it. */
interface Sibling {
  id: string; title: string; due_date: string | null
  status: string; replaced_by: string | null
}

const SIBLING_COLUMNS = 'id, title, due_date, status, replaced_by'

/**
 * A ROW A PERSON WOULD SEE TODAY. Not dismissed (their decision), not withdrawn (a reading we have
 * replaced), not superseded (a date that moved). The same three the step-6b `calendar_v` applies,
 * said once here so the two cannot drift apart.
 */
const isLive = (r: Sibling): boolean =>
  r.status !== 'dismissed' && r.status !== 'withdrawn' && !r.replaced_by

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
    .select(SIBLING_COLUMNS)
    .eq('company_id', companyId).eq('document_id', documentId).eq('source', 'document')
  if (error) throw new Error(`calendar_events: ${error.message}`)
  const key = normaliseTitle(title)
  return ((data ?? []) as Sibling[]).filter((r) => normaliseTitle(r.title ?? '') === key)
}

/**
 * THE AUDIT TWIN OF `siblingsOf`, AND IT EXISTS BECAUSE NO INDEX CAN DO THIS ONE.
 *
 * 073's partial unique index covers `source = 'document'` only, and deliberately: a document date's
 * identity is the DOCUMENT it came from (decision 13). An audit finding has no such anchor — every
 * run writes new `audit_findings` rows, so `audit_finding_id` changes every time the same agency is
 * audited again, and an index keyed on it would let one obligation land on the calendar once per
 * audit. "The permit expires on 15 November" found by three DEQ runs is one date, not three.
 *
 * So the key for an audit date is what a person would call the same date: this company, the same
 * title, the same day. Read for every status and settled below — a superseded row is history, a
 * dismissed one is a decision and a withdrawn one is a reading we have replaced — and against
 * `source = 'audit'`, because a document's row and an audit's row for the same obligation are two
 * different pieces of evidence and the drawer opens each differently.
 */
async function auditSiblingsOf(db: Db, companyId: string, title: string, dueOn: string | null): Promise<Sibling[]> {
  const { data, error } = await db.from('calendar_events')
    .select(SIBLING_COLUMNS)
    .eq('company_id', companyId).eq('source', 'audit')
  if (error) throw new Error(`calendar_events: ${error.message}`)
  const key = normaliseTitle(title)
  return ((data ?? []) as Sibling[]).filter((r) =>
    normaliseTitle(r.title ?? '') === key && (r.due_date ?? null) === dueOn)
}

/** `replaced_by = winner` on every sibling but the winner that is still the product's own to move. */
async function supersede(db: Db, sibs: Sibling[], winnerId: string): Promise<void> {
  // A person's dismissal is never touched (rule b). Nor is a WITHDRAWN row (step 6b): it is
  // already not current and `withdrawn_at` says why, so writing a second, weaker reason over a
  // precise one buys nothing. Rows already superseded ARE re-pointed, so `replaced_by` always
  // names the row that is live now rather than the next link in a chain.
  const ids = sibs
    .filter((r) => r.id !== winnerId && r.status !== 'dismissed' && r.status !== 'withdrawn')
    .map((r) => r.id)
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

  // *** AN AUDIT DATE IS DEDUPED IN CODE, BECAUSE THE INDEX CANNOT SEE IT (Calendar step 6). ***
  // Same company, same title, same day, source 'audit', and the row must be LIVE. On a match the
  // row is left exactly as it is except for one thing: `audit_finding_id` moves to the NEWEST
  // finding, so the drawer opens the audit a person last ran rather than one from September. That
  // is the only write, and it is the point — without it the calendar would keep pointing at a
  // finding whose run is three audits old.
  if (input.source === 'audit') {
    const sibs = await auditSiblingsOf(db, input.companyId, input.title, input.dueOn)
    // A person's dismissal is final here as it is for a document (rule b): matched, untouched,
    // and `audit_finding_id` is NOT moved — re-pointing a row somebody removed would quietly
    // revive it in every screen that reads the finding.
    const dismissed = sibs.find((r) => r.status === 'dismissed')
    if (dismissed) return { id: dismissed.id, outcome: 'existing' }
    const live = sibs.find(isLive)
    if (live) {
      if (input.auditFindingId) {
        const { error } = await db.from('calendar_events')
          .update({ audit_finding_id: input.auditFindingId }).eq('id', live.id)
        if (error) throw new Error(`calendar_events: ${error.message}`)
      }
      return { id: live.id, outcome: 'existing' }
    }
    // A WITHDRAWN AUDIT DATE COMES BACK WHEN A LATER RUN SAYS IT AGAIN — step 6b. The last run of
    // this agency did not match it, so it was withdrawn; this one found it, which is the audit's
    // own `revived`. The finding moves to the newest one with it, as it would for a live row.
    const withdrawn = sibs.find((r) => r.status === 'withdrawn' && !r.replaced_by)
    if (withdrawn) {
      const patch: Record<string, unknown> = { status: 'proposed', withdrawn_at: null }
      if (input.auditFindingId) patch.audit_finding_id = input.auditFindingId
      const { error } = await db.from('calendar_events').update(patch).eq('id', withdrawn.id)
      if (error) throw new Error(`calendar_events: ${error.message}`)
      return { id: withdrawn.id, outcome: 'revived' }
    }
    return { id: await insert(), outcome: 'created' }
  }

  // *** THE INDEX-BACKED DEDUPE IS FOR DOCUMENT DATES ONLY, AND IT NEEDS THE DOCUMENT. ***
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
    if (same.status === 'dismissed') return { id: same.id, outcome: 'existing' }

    // *** (a) A DATE ONLY SUPERSEDED OR WITHDRAWN COMES BACK, BECAUSE THE LATEST READING IS THE
    // TRUTH. *** The permit said 15 November, a re-read said 18 July and superseded it, and
    // today's reading says 15 November again — most likely the middle reading was wrong. The row
    // returns as `proposed` (a person confirms it, as they would any reading), its `replaced_by`
    // and `withdrawn_at` are cleared, and everything that had superseded it is superseded BY it,
    // so the invariant still holds. Withdrawn joins superseded here and nowhere else: step 6b
    // withdraws a date this reading did not say, and this is the same reading saying it again.
    if (same.status === 'withdrawn' || same.replaced_by) {
      const { error } = await db.from('calendar_events')
        .update({ status: 'proposed', replaced_by: null, withdrawn_at: null }).eq('id', same.id)
      if (error) throw new Error(`calendar_events: ${error.message}`)
      await supersede(db, sibs, same.id)
      return { id: same.id, outcome: 'revived' }
    }
    return { id: same.id, outcome: 'existing' }
  }

  // No row for this exact day: the date MOVED. The new one is created and the old ones superseded
  // — never deleted (decision 11), so "we were told 18 July and then 15 November" stays readable.
  const wasLive = sibs.some(isLive)
  const id = await insert()
  await supersede(db, [...sibs, { id, title: input.title, due_date: input.dueOn, status, replaced_by: null }], id)
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
  // `withdrawn_at: null` because a person's decision outranks a re-read (step 6b). A stale page
  // can still hold a row the newest reading withdrew; somebody pressing Confirm on it is saying
  // the date is real, and a confirmed row is never withdrawn again. Leaving the stamp set would
  // make the row say it was both confirmed and withdrawn, with nothing to say which came last.
  const { data, error } = await db.from('calendar_events')
    .update({ status: 'confirmed', confirmed_by: userId, confirmed_at: new Date().toISOString(),
              withdrawn_at: null })
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
              dismissed_reason: String(reason).trim().slice(0, 2000), withdrawn_at: null })
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

// ---------------------------------------------------------------------------------------------
// *** THE CURRENT READING WINS — decision 29 (the owner, 15 October 2026). ***
//
// A date's identity cannot rest on the model repeating its own words, and the measurement that
// settled it is in migration 075's header: three Opus 5.5 readings of one certificate turned
// three obligations into NINE live rows, `created 3, existing 0` three times out of three. Nothing
// in `proposeDate` is wrong — the title is prose, and `prompts/document-scan.ts` is never shown
// the dates already on file, so the model cannot match wording nobody told it about.
//
// So the rule Documents has run for FACTS since 29 September (`lib/documentScan.ts`) now runs for
// dates: reading a document again withdraws every proposed date from its earlier readings that the
// new reading did not propose again. A finished audit of an agency does the same for that agency's
// earlier runs.
//
// *** WHAT IS NEVER TOUCHED, AND IT IS ONE FILTER: `status = 'proposed'`. ***
//   · `confirmed` — a person said yes. Their decision outranks a re-read, in both directions.
//   · `dismissed` — a person said no, with a reason (rule b). It stays dismissed and is never
//     re-proposed, which is why a withdrawn row has to be a DIFFERENT word in the data: a
//     withdrawn date comes back when a later reading says it again, a dismissed one never does.
//   · `withdrawn` — already not current; re-stamping `withdrawn_at` would move a date that did
//     not change.
//   · `replaced_by is not null` — superseded, with a precise reason on the row already.
//
// *** AND THERE IS NO TRANSACTION, WHICH IS A TRADE AND NOT AN OVERSIGHT. ***
// PostgREST gives one statement per request: the facts rule has no transaction either, nor do
// `siblingsOf` + `supersede`, which have shipped that way since step 5. The UPDATE is atomic in
// itself; what is not atomic is the gap between the filing loop and it. A failure in that gap
// leaves the old rows LIVE — a person sees one date too many rather than one too few, which is
// the direction a compliance calendar should fail in. The `.eq('status', 'proposed')` restated on
// the UPDATE closes the other window: somebody pressing Confirm between the select and the write
// keeps their confirmation.
// ---------------------------------------------------------------------------------------------

/** The one write both rules share. Returns the ids actually withdrawn, read back from the row. */
async function withdraw(db: Db, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const { data, error } = await db.from('calendar_events')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .in('id', ids).eq('status', 'proposed').select('id')
  if (error) throw new Error(`calendar_events withdraw: ${error.message}`)
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
}

/**
 * EVERY PROPOSED DATE OF THIS DOCUMENT THAT THIS READING DID NOT PROPOSE AGAIN.
 *
 * `keepIds` is how "did not propose again" is decided, and it needs no new bookkeeping:
 * `proposeDate` returns `{ id, outcome }` on ALL FOUR outcomes — `created`, `existing`, `replaced`
 * and `revived` — so the id of the row each date landed on is already in the caller's hand. The
 * reading's own rows are the keep list; everything else proposed for this document is a sentence
 * this reading stopped saying.
 *
 * Scoped to ONE document (`.eq('document_id', documentId)`), for the reason the facts rule gives:
 * only two different DOCUMENTS can disagree. A document does not disagree with itself, and another
 * document's reading of the same obligation is not ours to retract.
 */
export async function withdrawUnseenDocumentDates(
  db: Db, companyId: string, documentId: string, keepIds: string[],
): Promise<string[]> {
  const { data, error } = await db.from('calendar_events')
    .select('id, replaced_by')
    .eq('company_id', companyId).eq('document_id', documentId)
    .eq('source', 'document').eq('status', 'proposed')
  if (error) throw new Error(`calendar_events: ${error.message}`)
  const keep = new Set(keepIds)
  const ids = ((data ?? []) as Array<{ id: string; replaced_by: string | null }>)
    .filter((r) => !keep.has(r.id) && !r.replaced_by)
    .map((r) => r.id)
  return withdraw(db, ids)
}

export interface AuditWithdrawInput {
  companyId: string
  /** `audit_sections.title` for the sections of this run that are DONE. The title IS the agency. */
  agencies: string[]
  runId: string
  /** This run's `audit_runs.created_at`, so two interleaved runs cannot withdraw each other's work. */
  runCreatedAt: string
}

/**
 * THE AUDIT HALF, AND IT IS RESOLVED FROM THE DATA BECAUSE NO IN-MEMORY SET CAN SPAN A RUN.
 *
 * A run is many sections across many route invocations, so there is no `keepIds` to collect. There
 * does not need to be: `proposeDate`'s audit branch RE-POINTS `audit_finding_id` to the newest
 * finding whenever it matches (`:229` and `lib/auditRun.ts` always passes it). So a live audit row
 * still pointing at a finding from an EARLIER run of an agency this run just finished is precisely
 * a row this run did not match.
 *
 * It walks from the calendar OUTWARDS — the company's live audit rows, then their findings, then
 * those findings' sections and runs — never from the audit history inwards. Driving it the other
 * way would put every finding of every earlier run in an `.in()` list; this way the work scales
 * with the size of the calendar.
 *
 * THREE GUARDS, each for a case that would otherwise withdraw something it should not:
 *   · `kind === 'agency'` on the earlier runs. A TEMPLATE run's sections are checklist sections,
 *     not agencies (`createRun`), so one that happened to be titled "Oregon DEQ" would otherwise
 *     withdraw that agency's dates. This had to come from the code: staging holds only agency runs.
 *   · only the DONE sections supply agency names (the caller's job). A section that could not
 *     complete read nothing, and silence is not a withdrawal — the audit twin of the
 *     `could_not_read` guard in `lib/documentScan.ts`.
 *   · `created_at` strictly earlier than this run's, and never this run's own id.
 */
export async function withdrawAuditDatesNotMatchedBy(
  db: Db, input: AuditWithdrawInput,
): Promise<string[]> {
  if (!input.agencies.length) return []

  const { data: cand, error } = await db.from('calendar_events')
    .select('id, audit_finding_id, replaced_by')
    .eq('company_id', input.companyId).eq('source', 'audit').eq('status', 'proposed')
  if (error) throw new Error(`calendar_events: ${error.message}`)
  const rows = ((cand ?? []) as Array<{
    id: string; audit_finding_id: string | null; replaced_by: string | null }>)
    .filter((r) => r.audit_finding_id && !r.replaced_by)
  if (!rows.length) return []

  const findingIds = [...new Set(rows.map((r) => r.audit_finding_id as string))]
  const { data: finds, error: fErr } = await db.from('audit_findings')
    .select('id, run_id, section_id').in('id', findingIds)
  if (fErr) throw new Error(`audit_findings: ${fErr.message}`)
  const findings = (finds ?? []) as Array<{ id: string; run_id: string; section_id: string | null }>
  if (!findings.length) return []

  const sectionIds = [...new Set(findings.map((f) => f.section_id).filter(Boolean))] as string[]
  const runIds = [...new Set(findings.map((f) => f.run_id).filter(Boolean))]
  const [{ data: secs, error: sErr }, { data: runs, error: rErr }] = await Promise.all([
    sectionIds.length
      ? db.from('audit_sections').select('id, title').in('id', sectionIds)
      : Promise.resolve({ data: [], error: null }),
    runIds.length
      ? db.from('audit_runs').select('id, kind, created_at').in('id', runIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (sErr) throw new Error(`audit_sections: ${sErr.message}`)
  if (rErr) throw new Error(`audit_runs: ${rErr.message}`)

  // The agency is matched the way a title is matched everywhere else in this file — trimmed and
  // case-folded — so "Oregon DEQ" and "Oregon DEQ " are one agency.
  const wanted = new Set(input.agencies.filter(Boolean).map(normaliseTitle))
  const agencyOf = new Map(((secs ?? []) as Array<{ id: string; title: string | null }>)
    .map((x) => [x.id, normaliseTitle(x.title ?? '')]))
  const runById = new Map(((runs ?? []) as Array<{ id: string; kind: string; created_at: string }>)
    .map((x) => [x.id, x]))
  const findingById = new Map(findings.map((f) => [f.id, f]))

  const ids = rows.filter((r) => {
    const f = findingById.get(r.audit_finding_id as string)
    if (!f || !f.section_id) return false
    const run = runById.get(f.run_id)
    if (!run || run.kind !== 'agency') return false
    if (run.id === input.runId) return false
    if (!(run.created_at < input.runCreatedAt)) return false
    const agency = agencyOf.get(f.section_id)
    return !!agency && wanted.has(agency)
  }).map((r) => r.id)

  return withdraw(db, ids)
}

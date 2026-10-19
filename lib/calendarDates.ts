/**
 * EVERY DATE IN THE PRODUCT GOES THROUGH HERE — Calendar step 5 (`docs/CALENDAR-PLAN.md` decisions
 * 5, 6, 8, 11, 13, 23; §2.6 is the contract). Migration 073 is the table.
 *
 * *** SECTIONS THAT FIND A DATE CALL `proposeDate()` AND KEEP NO CALENDAR LOGIC OF THEIR OWN. ***
 * That is decision 6, and the reason is the one the read-only map found: before this, two writers
 * each built their own `calendar_events` row with their own vocabulary — `category: 'document'` in
 * one (`app/api/document-actions/route.ts:143`) and `category: 'compliance'` in the other
 * (the old `/calendar` page, :210 as it stood before step 7 replaced that file), against a column
 * with no CHECK (map B1). A second writer is a
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
    /**
     * *** DECISION 31 (the owner, 16 October 2026): AN AUDIT DATE THAT IS THE SAME DATE AS A
     * DOCUMENT'S ATTACHES TO IT RATHER THAN ADDING A SECOND ROW. ***
     *
     * The key is the DOCUMENT and the DAY, deliberately not the title. An audit of an agency
     * reads the same permit the document scan read, and the two describe the obligation in
     * different words — "Six-year internal maintenance for units W-3 and L-1" beside "Six-year
     * internal maintenance interval for unit W-3 (ABC dry chemical, 20 lb, manufactured 2020)".
     * Those are one date on a calendar and were two rows on it. The title is what drifts (§189);
     * the document and the day are what the two readings agree on.
     *
     * The row stays what it is — a document date, with the document's own line in the drawer —
     * and gains `audit_finding_id`, so the audit that confirmed it is one click away. The
     * outcome is `existing`, which is the truth: this date was already on the calendar.
     *
     * *** OPTION 1, THE OWNER'S CHOICE: THE RULE ONLY, NO RECONCILIATION. *** This runs AFTER
     * the audit-sibling lookup above, so a re-run of an agency still matches its own earlier
     * audit row and existing pairs are left exactly as they are. Collapsing a pair that is
     * already on screen would change the identity of a row that conversations, emails and links
     * already point at. New pairs are not created from here on; the ones on staging stay until
     * somebody removes one.
     *
     * It runs BEFORE the withdrawn-audit revival below, and that order is the decision: if an
     * earlier run's audit row was withdrawn and the document's own row is live, reviving the
     * audit row would rebuild the pair this rule exists to prevent.
     */
    if (input.documentId && input.dueOn) {
      const { data, error } = await db.from('calendar_events')
        .select(SIBLING_COLUMNS)
        .eq('company_id', input.companyId).eq('source', 'document')
        .eq('document_id', input.documentId).eq('due_date', input.dueOn)
      if (error) throw new Error(`calendar_events: ${error.message}`)
      // A LIVE row only: a dismissed one is a person's decision (rule b) and a superseded one is
      // history — attaching to either would quietly bring it back into every live reader.
      const onDocument = ((data ?? []) as Sibling[]).find(isLive)
      if (onDocument) {
        if (input.auditFindingId) {
          const { error: writeError } = await db.from('calendar_events')
            .update({ audit_finding_id: input.auditFindingId }).eq('id', onDocument.id)
          if (writeError) throw new Error(`calendar_events: ${writeError.message}`)
        }
        return { id: onDocument.id, outcome: 'existing' }
      }
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

const ROW_COLUMNS = 'id, status, dismissed_by, dismissed_reason, confirmed_by, confirmed_at, recurs, period, due_date'

async function load(db: Db, id: string) {
  const { data, error } = await db.from('calendar_events').select(ROW_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  return data as {
    id: string; status: string; dismissed_by: string | null; recurs: boolean; due_date: string | null
  } | null
}

/**
 * THE PERIOD RULES, IN ONE PLACE — Calendar step 9.
 *
 * `setPeriod` had both of them inline, and then `confirmDate` grew the one-call case the queue
 * needs (`{ action: 'confirm', period }` — confirm this repeating date AND say how often, in one
 * press). Two copies of "what may a period be" is two answers: the queue could have accepted a word
 * the drawer refuses, or written a period onto a one-off the drawer would not. The sentences are
 * the ones the owner approved at step 8a, unchanged.
 *
 * `null` is always allowed, including on a one-off: it means "nothing is claimed" (decision 23),
 * and it is how a row written before step 8a's guard gets tidied.
 */
export function periodProblem(value: string | null, recurs: boolean): string | null {
  if (value === null) return null
  if (!(PERIODS as readonly string[]).includes(value)) {
    return `"${value}" is not how often a date can repeat.`
  }
  if (!recurs) {
    return 'That date happens once, so it has no "how often". Say that it repeats first.'
  }
  return null
}

/** What a caller sent as a period, as a value this file understands. '' is null, as it always was. */
const periodValue = (period: string | null): string | null => (period === null || period === '' ? null : period)

/**
 * CONFIRM A DATE — and, since step 9, optionally say how often it repeats IN THE SAME CALL.
 *
 * `period` is `undefined` for "do not touch it", which is what the drawer's Confirm sends and what
 * every caller before step 9 meant. The queue's row picker sends a word, or `null` for "I don't
 * know yet" — which confirms the date and leaves the period null on purpose, so it stays in the
 * strip with its decision-30 line rather than acquiring a frequency nobody read.
 *
 * ONE UPDATE, NOT TWO. The queue confirms a repeating date and its period together; writing them
 * as two statements would leave a window in which the date is confirmed and the period is not, and
 * a failure in the second would be invisible to the person who pressed one button.
 */
export async function confirmDate(
  db: Db, id: string, userId: string, period?: string | null,
): Promise<ActResult> {
  if (!id) return { status: 400, json: { error: 'No date given.' } }
  const row = await load(db, id)
  if (!row) return NOT_FOUND
  const alsoPeriod = period !== undefined
  const value = alsoPeriod ? periodValue(period as string | null) : null
  if (alsoPeriod) {
    const problem = periodProblem(value, (row as { recurs: boolean }).recurs)
    if (problem) return { status: 400, json: { error: problem } }
  }
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
              withdrawn_at: null, ...(alsoPeriod ? { period: value } : {}) })
    .eq('id', id).select(ROW_COLUMNS).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  if (!data) return NOT_FOUND
  return { status: 200, json: { date: data } }
}

/**
 * *** CONFIRM EVERY DATE IN ONE GROUP — Calendar step 9, the queue's "Confirm all from this
 * document". ***
 *
 * THE IDS ARE THE ONES THE PERSON COULD SEE WHEN THEY PRESSED IT, and that is the rule, not an
 * implementation detail. The alternative — "confirm everything for this document" as a filter on
 * the server — would confirm a date that arrived between the page loading and the click: a reading
 * that finished thirty seconds ago would have its dates confirmed by somebody who never saw them,
 * with their name on it. So the caller sends the ids it drew, this function touches exactly those,
 * and a row that arrived since stays in the queue where somebody can look at it.
 *
 * THE RULES, ALL FOUR FROM THE BRIEF:
 *   · at most `CONFIRM_MANY_MAX` ids in one call;
 *   · every id must be the caller's company's, or the WHOLE call is 404 and nothing is written —
 *     one foreign id does not quietly confirm the other nineteen, and 404 rather than 403 so a
 *     stranger cannot learn which ids exist (§3.6). Tenancy is RLS's answer here, not a
 *     `company_id` filter written in this file: `db` is the caller's own client, so a row of
 *     another company is simply absent from the read;
 *   · a row already confirmed is left alone and counted — pressing the button twice is not an
 *     error, and re-stamping `confirmed_by` would rewrite who said yes;
 *   · a dismissed or withdrawn row is skipped and counted, because a person's removal is not
 *     undone by a bulk press (rule b) and a withdrawn row is one the newest reading no longer
 *     says at all.
 *
 * ONE UPDATE for all of them, so the numbers the queue shows afterwards are one answer and not a
 * partial one.
 */
export const CONFIRM_MANY_MAX = 200

export async function confirmMany(db: Db, ids: unknown, userId: string): Promise<ActResult> {
  const given = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && !!x) : []
  const wanted = [...new Set(given)]
  if (wanted.length === 0) return { status: 400, json: { error: 'No dates given.' } }
  if (wanted.length > CONFIRM_MANY_MAX) {
    return {
      status: 400,
      json: { error: `That is more than ${CONFIRM_MANY_MAX} dates at once. Confirm them a group at a time.` },
    }
  }

  const { data, error } = await db.from('calendar_events').select('id, status').in('id', wanted)
  if (error) throw new Error(`calendar_events: ${error.message}`)
  const found = (data ?? []) as Array<{ id: string; status: string }>
  // *** NOTHING IS WRITTEN WHEN ONE ID IS NOT OURS. *** The read above ran as the caller under RLS,
  // so "not found" covers another company's id, a deleted one and a typo alike, and says which it
  // was to nobody.
  if (found.length !== wanted.length) {
    return { status: 404, json: { error: 'Some of those dates were not found. Nothing was changed.' } }
  }

  const toConfirm = found.filter((r) => r.status === 'proposed').map((r) => r.id)
  const already = found.filter((r) => r.status === 'confirmed').length
  const skipped = found.length - toConfirm.length - already
  if (toConfirm.length === 0) {
    return { status: 200, json: { confirmed: 0, already, skipped, ids: [] } }
  }
  const { data: done, error: writeError } = await db.from('calendar_events')
    .update({ status: 'confirmed', confirmed_by: userId, confirmed_at: new Date().toISOString(),
              withdrawn_at: null })
    .in('id', toConfirm).select('id')
  if (writeError) throw new Error(`calendar_events: ${writeError.message}`)
  const confirmedIds = ((done ?? []) as Array<{ id: string }>).map((r) => r.id)
  return { status: 200, json: { confirmed: confirmedIds.length, already, skipped, ids: confirmedIds } }
}

export async function dismissDate(db: Db, id: string, userId: string, reason: string): Promise<ActResult> {
  if (!id) return { status: 400, json: { error: 'No date given.' } }
  /**
   * *** THE REASON IS OPTIONAL — the owner, Calendar step 8a (board 8). ***
   *
   * It was required, and refused with 400 "Please say why this date is not right." The reasoning
   * was Documents': a dismissed GAP needs a sentence, because the reason is what stops a later
   * reading proposing it again. **That is not how a calendar date works.** What stops the same
   * document proposing this date again is that a PERSON removed it — `dismissed_by` set, which
   * `proposeDate`'s rule (b) and step 6b's withdrawal both honour whatever any later reading says.
   * The sentence was never load-bearing here; it was a toll on the one irreversible action in the
   * section, and a toll on removing a date is how a wrong date stays on a calendar.
   *
   * So: nothing typed is accepted, `dismissed_reason` is left NULL rather than stored as '', and
   * who and when are recorded exactly as before. A reason given still shows in the history.
   */
  const given = String(reason ?? '').trim()
  const row = await load(db, id)
  if (!row) return NOT_FOUND
  const { data, error } = await db.from('calendar_events')
    .update({ status: 'dismissed', dismissed_by: userId, dismissed_at: new Date().toISOString(),
              dismissed_reason: given ? given.slice(0, 2000) : null, withdrawn_at: null })
    .eq('id', id).select(ROW_COLUMNS).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  if (!data) return NOT_FOUND
  return { status: 200, json: { date: data } }
}

export async function setPeriod(db: Db, id: string, period: string | null): Promise<ActResult> {
  if (!id) return { status: 400, json: { error: 'No date given.' } }
  // null is a real answer — "it repeats, we do not know how often yet" (decision 23), which is what
  // a document scan gives us, so clearing the period must always be allowed.
  const value = periodValue(period)
  const row = await load(db, id)
  if (!row) return NOT_FOUND
  /**
   * *** A ONE-OFF DATE HAS NO "HOW OFTEN", AND SAYING SO IS THIS ROUTE'S JOB — step 8a. ***
   *
   * Nothing in the database refuses it: `period` is a plain nullable column with a CHECK on its
   * WORDS only, and `calendar_events_date_or_recurs` is about the day, not the period. So a period
   * written onto a row with `recurs = false` stored perfectly well and meant nothing — `calendar_v`
   * only reaches for `step_months` when `recurs` is true, so `next_due` would not move and the
   * drawer would show "every year" on a date that happens once. A value stored that no reader
   * honours is worse than a refusal: it reads back as a fact.
   *
   * Clearing it is always allowed, including on a one-off — that is how a row written before this
   * guard gets tidied, and null already means "nothing is claimed".
   */
  const problem = periodProblem(value, row.recurs)
  if (problem) return { status: 400, json: { error: problem } }
  const { data, error } = await db.from('calendar_events')
    .update({ period: value }).eq('id', id).select(ROW_COLUMNS).maybeSingle()
  if (error) throw new Error(`calendar_events: ${error.message}`)
  if (!data) return NOT_FOUND
  return { status: 200, json: { date: data } }
}

// ---------------------------------------------------------------------------------------------
// *** THE DAY A PERSON MAY SET — Calendar step 14b, decision 32, migration 079. ***
//
// A repeating date whose day WAS read is a date: migration 079 puts it on the grid. A repeating
// date whose day was NOT read is a question, and this is the answer to it — the drawer's
// "Set the day", beside "Set how often".
//
// *** IT WRITES ONLY FROM NULL, AND THAT RULE IS IN THE DATABASE TOO. *** `due_date` carries what
// a document said, quoted beside it in `source_line`; a person who may rewrite it may rewrite the
// evidence. So migration 079 grants `update (due_date)` and 078's trigger refuses the change —
// `calendar_person_day_refusal`. This function is the same rule said in a sentence a person can
// read, for the same reason `setPeriod` answers a one-off in words rather than letting a
// constraint do it: a 23514 from PostgREST is not a message to a human being.
// ---------------------------------------------------------------------------------------------

/** The sentence BOTH ends refuse with; a test holds that migration 079 carries it word for word. */
export const DAY_ALREADY_SET =
  'This date already has a day. A day that has been set is not changed here — remove '
  + 'the date and add one with the day you want.'
/** Not a shape the database could store as a date. Said before the write, not after it. */
export const NEED_A_REAL_DAY = 'Please give the day as a date, for example 2026-11-20.'
/** The partial unique index meeting an identical date on the same document (073:§5). */
export const DAY_IS_A_DUPLICATE =
  'That document already has this date on that day. Open it from the list instead of adding a second one.'

/**
 * `YYYY-MM-DD`, AND A DAY THAT REALLY EXISTS. The regex alone accepts 2026-02-31, which Postgres
 * refuses with a 22008 nobody can read; the round-trip through UTC is what catches it here.
 */
export function dayProblem(value: string): string | null {
  const day = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NEED_A_REAL_DAY
  const d = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day) return NEED_A_REAL_DAY
  return null
}

export async function setDay(db: Db, id: string, day: string): Promise<ActResult> {
  if (!id) return { status: 400, json: { error: 'No date given.' } }
  const problem = dayProblem(day)
  if (problem) return { status: 400, json: { error: problem } }
  const row = await load(db, id)
  if (!row) return NOT_FOUND
  // The row already has one. Read from the row rather than trusted from the screen: the page that
  // offered "Set the day" may have been open since before somebody else set it.
  if (row.due_date) return { status: 409, json: { error: DAY_ALREADY_SET } }
  const { data, error } = await db.from('calendar_events')
    .update({ due_date: day.trim() }).eq('id', id).select(ROW_COLUMNS).maybeSingle()
  // 23505 is the partial unique index on (company, document, lower(title), day): giving this date
  // that day would make it the twin of one already filed. A sentence, not a constraint name.
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { status: 409, json: { error: DAY_IS_A_DUPLICATE } }
    }
    throw new Error(`calendar_events: ${error.message}`)
  }
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

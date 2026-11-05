/**
 * NIGHT WATCH — THE ELEVEN COUNTS, AS PURE FUNCTIONS OVER ROWS.
 * `docs/GAPS-PLAN.md` decision 75 (the owner, 4 November 2026).
 *
 * *** IT CALLS NOTHING AND READS NOTHING. *** The route (`app/api/jobs/quality/route.ts`) does
 * every read and hands the rows here; every counter below is a function from rows to hits. That is
 * the shape `lib/topicClaim.ts`, `lib/documentList.ts` and `lib/summaryReport.ts` already have, and
 * it is what lets `tests/unit/quality.test.ts` put a row that SHOULD match and a row that should
 * NOT through each of the eleven without a database.
 *
 * *** AND IT IMPORTS NOTHING THAT CAN REACH `lib/ai.ts`. *** Decision 75: the job never calls a
 * model. The only import is `lib/askWords.ts`, which imports nothing at all. This is not a promise
 * in a comment — `scripts/check-schema-contracts.js` CHECK 3 computes the transitive closure of
 * every API route and fails the build if a route that can reach the Anthropic SDK does not call
 * `requireAccess`. The job's route reaches nothing, so it never enters that set and `PAID_COUNT`
 * stays 23. **The no-cost claim is a build-time assertion, not a grep.**
 *
 * ---------------------------------------------------------------------------
 * THE FOUR RULES THAT ARE EASY TO GET WRONG, STATED BEFORE THE CODE
 *
 * 1. **A COUNT THAT CANNOT SEE A PRESENCE IS NOT A CHECK** (`CLAUDE.md` §9a). Every one of the
 *    eleven was run against all of staging before it was written down, and ten of them found
 *    something. The two that read zero — `word_against_attachments` and `stuck_reading` — are
 *    zero for reasons that are written at each one, and the handle counter's zero on turns is
 *    trustworthy only because the SAME regex found 57 presences on findings.
 *
 * 2. **A STRUCTURED FIELD BEATS A STRING IN THE TEXT.** `refused_quotes` reads
 *    `check_record.quotes_found_in_nothing` rather than counting the marker sentence in the
 *    answer. Measured on staging: the two agree on 191 of 192 answers and disagree on one, where
 *    the structured field says 1 and the marker is absent from the stored text. **A wording change
 *    silently zeroes a marker count; it cannot touch a number.** The marker count is kept beside
 *    it so that a disagreement is itself visible.
 *
 * 3. **THE DAY IS THE OWNER'S DAY, NOT THE SERVER'S.** Vercel's cron is UTC, so a job at 13:30 UTC
 *    reading `created_at::date = current_date - 1` would cover Tuesday 16:00 to Wednesday 16:00
 *    Pacific and call it Wednesday. `pacificWindow` below is why it does not.
 *
 * 4. **TEN OF THE ELEVEN READ YESTERDAY. ONE READS NOW.** `stuck_reading` is a question about this
 *    moment and is marked `scope: 'now'` in `lib/qualityWords.ts`, and the email says so, because
 *    a "right now" number inside a list of yesterday's numbers is a number nobody can act on.
 * ---------------------------------------------------------------------------
 */
import { NOT_IN_WHAT_WE_HAVE } from './askWords.ts'
import { COUNTERS } from './qualityWords.ts'

// ===========================================================================
// THE ROWS THE ROUTE READS. Every field below was read from the live staging schema
// (`information_schema.columns`) while the map was written, never from memory:
// `documents` has `name` and not `file_name`; `audit_runs` has `agency_label` and not `agencies`;
// `audit_sections.documents_read` is a `uuid[]` and not jsonb.
// ===========================================================================

export interface TurnRow {
  id: string; topic_id: string; company_id: string; role: string; text: string | null
  sources: unknown; check_record: unknown; created_at: string
}
export interface TopicRow {
  id: string; company_id: string; section: string; title: string | null
  summary: string | null; summary_report: unknown; summarised_at: string | null
}
export interface RunRow {
  id: string; company_id: string; kind: string | null; scope: string | null
  agency_label: string | null; template_document_id: string | null; created_at: string
}
export interface SectionRow {
  id: string; run_id: string; company_id: string; ordinal: number | null; title: string | null
  status: string | null; model: string | null; could_not_complete_reason: string | null
  raw_text: string | null; json_parsed: boolean | null; documents_read: string[] | null
}
export interface FindingRow {
  id: string; run_id: string; company_id: string; word: string | null; title: string | null
  basis: string | null; what_to_do: string | null; locator: string | null
  document_id: string | null; quote: string | null; quote_verified: boolean | null
  handle_error: boolean | null
}
export interface ScanRow {
  id: string; document_id: string | null; company_id: string; status: string | null
  model: string | null; could_not_read_reason: string | null; ai_call_id: string | null
  scanned_at: string | null
}
export interface AiCallRow {
  id: string; company_id: string | null; task: string | null; model: string | null
  cost_usd: number | string | null; created_at: string
}
export interface DocumentRow {
  id: string; company_id: string; name: string | null; status: string | null
  reading_since: string | null
}
export interface JobRunRow { id: string; job: string; started_at: string | null; finished_at: string | null }

/** One thing to look at: what it is, whose it is, and where a person can open it. */
export interface Hit {
  /** The row's own id — the thing a person pastes into a query. */
  id: string
  /** Whose it is. Every hit has one, which is what lets the report be split per company. */
  company_id: string
  /** One short line a person can read without opening anything. */
  what: string
  /** Where it opens in the product, or null when nothing opens it — see `hrefFor`. */
  href: string | null
}

// ===========================================================================
// THE PACIFIC DAY. The owner's answer to S-8.
// ===========================================================================

const LA = 'America/Los_Angeles'

/** The Pacific wall clock at an instant, as fields. `hourCycle: 'h23'` so midnight is '00'. */
function laParts(at: Date): Record<string, string> {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: LA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23',
  })
  const out: Record<string, string> = {}
  for (const p of f.formatToParts(at)) if (p.type !== 'literal') out[p.type] = p.value
  return out
}

/** The Pacific calendar day an instant falls in, as `YYYY-MM-DD`. */
export function pacificDayString(at: Date): string {
  const p = laParts(at)
  return `${p.year}-${p.month}-${p.day}`
}

/**
 * Midnight Pacific on a given day, as a UTC instant.
 *
 * *** THE OFFSET IS FOUND, NOT ASSUMED. *** Pacific is UTC−8 or UTC−7 depending on the date, and
 * the cron fires at a fixed UTC time, so the offset changes under the job twice a year. The loop
 * tries each candidate and keeps the one whose Pacific clock actually reads 00:00 on that day.
 * Seven and eight first because they are the two real answers; six and nine are there so a zone
 * database change is a visible failure rather than a silently wrong window.
 */
export function pacificMidnightUtc(day: string): string {
  const base = Date.parse(`${day}T00:00:00Z`)
  if (Number.isNaN(base)) throw new Error(`pacificMidnightUtc: ${day} is not a date`)
  for (const hours of [7, 8, 6, 9]) {
    const cand = new Date(base + hours * 3_600_000)
    const p = laParts(cand)
    if (`${p.year}-${p.month}-${p.day}` === day && p.hour === '00' && p.minute === '00') {
      return cand.toISOString()
    }
  }
  throw new Error(`pacificMidnightUtc: could not place midnight in ${LA} on ${day}`)
}

/**
 * The window the job reads: the whole of the previous PACIFIC day.
 *
 * Yesterday is found by stepping back from NOON rather than from midnight, so the one hour that
 * exists twice and the one that does not exist at all — the two DST changeovers — cannot move the
 * answer by a day.
 */
export function pacificWindow(now: Date): { day: string; from: string; to: string } {
  const today = pacificDayString(now)
  const day = pacificDayString(new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000))
  return { day, from: pacificMidnightUtc(day), to: pacificMidnightUtc(today) }
}

// ===========================================================================
// WHERE A HIT OPENS. Only the links the product actually reads.
// ===========================================================================

/**
 * *** A CONVERSATION CANNOT BE DEEP-LINKED TODAY, AND THAT IS SAID RATHER THAN FAKED. ***
 *
 * Grepped before writing this: the only parameters any page reads are `?run=`
 * (`app/audits/page.tsx:297`), `?document=` (`app/documents/page.tsx:283`,
 * `app/compliance/page.tsx:180`) and `?checklist=` (`app/compliance/page.tsx:187`). **There is no
 * `?topic=` on any page.** So a conversation hit links to its section's own page and carries the
 * topic id in its words, for a person to paste. Inventing a parameter nothing reads is D15's
 * defect — a link that lands nowhere — and this file will not add a ninth one.
 */
export const SECTION_PATHS: Readonly<Record<string, string>> = {
  workspace: '/compliance', hr: '/hr', calendar: '/calendar',
  documents: '/documents', audits_chat: '/audits',
}

export const runHref = (runId: string): string => `/audits?run=${runId}`
export const documentHref = (documentId: string): string => `/documents?document=${documentId}`
export const sectionHref = (section: string | null): string | null =>
  SECTION_PATHS[String(section ?? '')] ?? null

// ===========================================================================
// THE HANDLE REGEX — one copy, used on turns, on findings and on summaries.
//
// `D<n>` is `lib/audit.ts:244`'s `nextHandle()`; `AF<n>` is `lib/ask/passages.ts:81`'s
// `ATTACHED_PREFIX`. The word boundaries matter: without the leading one, the "D1" inside a word
// would count. Copied from the artifact, not composed (`CLAUDE.md` §9a).
//
// *** ⚡ AND THE FIRST DIGIT MAY NOT BE A ZERO, WHICH IS NOT FUSSINESS — IT IS EPA. ***
// The first real walk of this page showed a hit reading *"an audit finding says D002"* on a
// Cascade row whose `what_to_do` is **"D002 corrosive waste is a common waste stream at chemical
// plants"**. `D002` is the EPA hazardous-waste code for corrosivity, not a document handle — the
// audit was talking about chemistry and this counter called it a leak.
//
// `nextHandle()` counts from 1 and never pads, so a handle cannot begin with a zero; EPA's D-codes
// (D001–D043) are always three digits and always padded. One character of regex separates them
// completely. **Measured over every finding on staging before it was changed: 57 hits became 56,
// and the single row that dropped is the D002 one.** Nothing else moved.
// ===========================================================================
export const HANDLE_RE = /\b(?:AF|D)[1-9]\d{0,2}\b/g

export function handlesIn(text: string | null | undefined): string[] {
  if (!text) return []
  return [...new Set(String(text).match(HANDLE_RE) ?? [])]
}

// ===========================================================================
// 1 — ANSWERS WITH NO SOURCE
//
// Measured over all of staging: 91 — documents 40, audits_chat 30, calendar 13, workspace 8. They
// are not refusals; one is 968 characters listing four DEQ documents by name and number with
// nothing stored to point at. **And it is already a before/after on E2d**: of the answers written
// after E2d landed, audits_chat was 2 of 21 and documents 0 of 18.
//
// A `stopped` turn is NOT excluded. An answer the person interrupted still stored what it stored,
// and whether that is worth a source is exactly the judgement the row ids are for.
// ===========================================================================
const sourceCount = (v: unknown): number => (Array.isArray(v) ? v.length : 0)

export function answersNoSource(turns: TurnRow[], sectionOf: Map<string, TopicRow>): Hit[] {
  const out: Hit[] = []
  for (const t of turns) {
    if (t.role !== 'assistant') continue
    if (sourceCount(t.sources) > 0) continue
    const topic = sectionOf.get(t.topic_id)
    out.push({
      id: t.id, company_id: t.company_id,
      what: `${topic?.section ?? 'unknown section'} · ${(t.text ?? '').length} characters · `
          + `conversation ${t.topic_id}`,
      href: sectionHref(topic?.section ?? null),
    })
  }
  return out
}

// ===========================================================================
// 2 — QUOTES THAT MATCHED NOTHING
//
// Rule 2 above: the structured field, with the marker count beside it.
//
// *** AND HR IS READ HERE, WHICH IS (m)'s ANSWER. *** HR runs on its own engine and stores its own
// answers — but it stores them in `turns`, with `topics.section = 'hr'`
// (`app/api/hr/answer/route.ts:66` opens the topic, `:242` saves the turn). So count 1 above needs
// nothing added for HR at all. **Count 2 does**, because HR's own check writes a different key:
// `check_record.marked.not_found_quotes` and `.dropped.handbook_quotes` (`lib/hrAnswer.ts:583`),
// where the shared engine writes `quotes_found_in_nothing`. Both are read below, so HR is watched
// from the day its first conversation exists — **and nothing in HR was changed to make it
// watchable**, which is what the owner asked for.
// ===========================================================================
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}
const at = (v: unknown, ...path: string[]): unknown => {
  let cur: unknown = v
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

/** How many quotes this answer's own check could not find. The shared engine's key, then HR's. */
export function refusedOn(turn: TurnRow): number {
  const shared = num(at(turn.check_record, 'quotes_found_in_nothing'))
  const hr = num(at(turn.check_record, 'marked', 'not_found_quotes'))
  return Math.max(shared, hr)
}

/** The same thing counted in the stored text, for the disagreement in rule 2. */
export function markersOn(turn: TurnRow): number {
  const text = turn.text ?? ''
  if (!text) return 0
  return text.split(NOT_IN_WHAT_WE_HAVE).length - 1
}

export function refusedQuotes(turns: TurnRow[], sectionOf: Map<string, TopicRow>): Hit[] {
  const out: Hit[] = []
  for (const t of turns) {
    if (t.role !== 'assistant') continue
    const refused = refusedOn(t)
    const markers = markersOn(t)
    if (refused === 0 && markers === 0) continue
    const topic = sectionOf.get(t.topic_id)
    out.push({
      id: t.id, company_id: t.company_id,
      what: `${topic?.section ?? 'unknown section'} · `
          + `${refused} quote${refused === 1 ? '' : 's'} matched nothing`
          + (refused === markers ? '' : ` · the stored text shows ${markers}, which disagrees`)
          + ` · conversation ${t.topic_id}`,
      href: sectionHref(topic?.section ?? null),
    })
  }
  return out
}

// ===========================================================================
// 3 — A HANDLE WRITTEN AT A PERSON
//
// Three places, because the audit writes the hazard and the chat inherits it (W5's own note).
// `quote` is NEVER read: `lib/auditRun.ts:801`–`:802` puts the three prose fields through
// `nameDocumentHandles` and deliberately leaves a quote alone, because a quote is word for word or
// it is nothing. Counting handles in a quote would ask the fix to break the rule it protects.
//
// Measured over all of staging: 0 in turns, **57 in findings**, 0 in summaries. The 57 are the
// pre-E0 leak, and they are what makes the two zeroes trustworthy.
// ===========================================================================
export function handlesAtAPerson(
  turns: TurnRow[], findings: FindingRow[], topics: TopicRow[], sectionOf: Map<string, TopicRow>,
): Hit[] {
  const out: Hit[] = []
  for (const t of turns) {
    if (t.role !== 'assistant') continue
    const hs = handlesIn(t.text)
    if (!hs.length) continue
    const topic = sectionOf.get(t.topic_id)
    out.push({ id: t.id, company_id: t.company_id,
      what: `an answer in ${topic?.section ?? 'an unknown section'} says ${hs.join(', ')}`,
      href: sectionHref(topic?.section ?? null) })
  }
  for (const f of findings) {
    const hs = handlesIn([f.title, f.basis, f.what_to_do, f.locator].filter(Boolean).join(' '))
    if (!hs.length) continue
    out.push({ id: f.id, company_id: f.company_id,
      what: `an audit finding says ${hs.join(', ')} — ${(f.title ?? '').slice(0, 70)}`,
      href: runHref(f.run_id) })
  }
  for (const p of topics) {
    const hs = handlesIn([p.summary, p.summary_report ? JSON.stringify(p.summary_report) : null]
      .filter(Boolean).join(' '))
    if (!hs.length) continue
    out.push({ id: p.id, company_id: p.company_id,
      what: `a summary in ${p.section} says ${hs.join(', ')}`,
      href: sectionHref(p.section) })
  }
  return out
}

// ===========================================================================
// 4 — AUDIT SECTIONS LOST TO BROKEN JSON
// `lib/auditRun.ts:504` is the writer: `raw_text: raw.slice(0, 20000), json_parsed: false`.
// The first 200 characters go in the report, as the brief asked, because the shape of the raw text
// is what says whether the model narrated, refused or was cut off.
// ===========================================================================
export function sectionsUnparsed(sections: SectionRow[]): Hit[] {
  return sections.filter((s) => s.json_parsed === false).map((s) => ({
    id: s.id, company_id: s.company_id,
    what: `${(s.title ?? 'a section').slice(0, 50)} · ${s.status ?? 'no status'} · `
        + `${s.model ?? 'no model'} · ${s.could_not_complete_reason ?? 'no reason given'} · `
        + `raw: ${JSON.stringify((s.raw_text ?? '').slice(0, 200))}`,
    href: runHref(s.run_id),
  }))
}

// ===========================================================================
// 5 — A FINDING WHOSE WORD AND ATTACHMENTS DISAGREE  (the owner's answer to S-2)
//
// Four arms, none of which reads prose:
//   · a word that claims a document answers the line, with no document attached
//   · a quote on such a finding that failed its own check
//   · `handle_error`, which the run sets when the model named a handle that resolves to nothing
// All four read 0 on staging today, which is the right answer and not a broken check: the live
// CHECK allows five words and `nothing_on_file WITH a document attached` — 116 rows — is
// deliberately NOT one of the arms, because it is correct (the document is the related log; the
// specific record asked for is what is absent). Sampled three; all three read correctly.
// ===========================================================================
const CLAIMS_A_DOCUMENT = new Set(['on_file', 'on_file_gaps', 'stale'])

export function wordAgainstAttachments(findings: FindingRow[]): Hit[] {
  const out: Hit[] = []
  for (const f of findings) {
    const claims = CLAIMS_A_DOCUMENT.has(String(f.word ?? ''))
    const reasons: string[] = []
    if (claims && !f.document_id) reasons.push(`word is "${f.word}" and no document is attached`)
    if (claims && f.quote && f.quote_verified === false) reasons.push('its quote failed the check')
    if (f.handle_error === true) reasons.push('it named a handle that resolves to nothing')
    if (!reasons.length) continue
    out.push({ id: f.id, company_id: f.company_id,
      what: `${reasons.join('; ')} — ${(f.title ?? '').slice(0, 70)}`,
      href: runHref(f.run_id) })
  }
  return out
}

// ===========================================================================
// 6 — READINGS THAT FAILED BEFORE THE MODEL WAS CALLED
// `(not called)` is `lib/documentScan.ts`'s placeholder for a scan that never reached the model.
// An honest refusal lands here too — B1's `.doc`, B4's locked PDF — and that is correct: the count
// is "a reading that cost nothing and produced nothing", and whether it was right is a judgement.
// 8 on staging: 2 on 24 October, 4 on 3 November, 2 on 4 November.
// ===========================================================================
export function readWithoutTheModel(scans: ScanRow[], nameOf: Map<string, string>): Hit[] {
  return scans
    .filter((s) => s.status === 'could_not_read' && s.model === '(not called)')
    .map((s) => ({
      id: s.id, company_id: s.company_id,
      what: `${nameOf.get(String(s.document_id)) ?? s.document_id ?? 'a document'} · `
          + `${s.could_not_read_reason ?? 'no reason stored'}`,
      href: s.document_id ? documentHref(s.document_id) : null,
    }))
}

// ===========================================================================
// 7 — PAID READINGS NO READING CLAIMS  (the owner's answer to S-3)
//
// The brief asked for "an `ai_calls` row within 5s of a failed scan with no scan id". Measured,
// that found 4 rows and **the newest was a false positive**: B2's deliberately corrupt
// `half-sent-photo.heic`, refused before any model call, which matched only because the sweep was
// reading a DIFFERENT document for the same company inside the same five seconds.
//
// So the anchor has no clock and no company in it: **a `document_scan` call that no stored reading
// claims.** 7 rows on staging, **$0.8170**, the three W2 readings among them. `cost_usd` rides on
// each hit, as the owner asked.
// ===========================================================================
export interface CostHit extends Hit { cost_usd: number | null }

export function paidAndUnclaimed(calls: AiCallRow[], claimed: Set<string>): CostHit[] {
  return calls
    .filter((c) => c.task === 'document_scan' && !claimed.has(c.id))
    .map((c) => {
      const cost = c.cost_usd === null ? null : Number(c.cost_usd)
      return {
        id: c.id, company_id: String(c.company_id ?? ''),
        cost_usd: cost !== null && Number.isFinite(cost) ? cost : null,
        what: `${c.model ?? 'no model'} · `
            + `${cost !== null && Number.isFinite(cost) ? `$${cost.toFixed(4)}` : 'not priced'} · `
            + `${c.created_at}`,
        href: null,   // a ledger row opens nowhere in the product, and saying so beats a dead link
      }
    })
}

// ===========================================================================
// 8 — SUMMARIES WITH NO SOURCES, ON A CONVERSATION THAT HAD THEM
//
// 3 on staging, and the newest is from 5 November at 16:33 UTC — **under two hours before E2f
// landed at 18:21 UTC**. It is the B4-renumbering shape E2f replaced with `sources: all`. After
// E2f this is structurally impossible for a new summary, which makes this count **the regression
// detector for E2f** rather than a live tally. That is a reason to keep it, not to drop it.
// ===========================================================================
export function summaryWithoutSources(topics: TopicRow[], turnsByTopic: Map<string, TurnRow[]>): Hit[] {
  const out: Hit[] = []
  for (const p of topics) {
    if (!p.summary_report || typeof p.summary_report !== 'object') continue
    const listed = at(p.summary_report, 'sources')
    if (sourceCount(listed) > 0) continue
    const had = (turnsByTopic.get(p.id) ?? []).filter((t) => sourceCount(t.sources) > 0).length
    if (had === 0) continue
    out.push({ id: p.id, company_id: p.company_id,
      what: `${p.section} · ${(p.title ?? 'no title').slice(0, 60)} · `
          + `${had} turn${had === 1 ? '' : 's'} carried sources and the summary lists none`,
      href: sectionHref(p.section) })
  }
  return out
}

// ===========================================================================
// 9 — A TEMPLATE AUDIT THAT READ ITS OWN TEMPLATE
//
// 16 on staging: 13 on 3 November and 3 on 4 November — and all three of those belong to one run
// whose `scope` reads literally "E0 BEFORE: Audit us against the attached template", which is E0's
// own before-tree. **Nothing from any run made after decision 49 landed.** So this counter already
// confirms the fix holds, which is the job it is being given. `scope` is in the words for exactly
// that reason: a deliberate measurement must be readable as one.
// ===========================================================================
export function templateReadItself(runs: RunRow[], sections: SectionRow[]): Hit[] {
  const byRun = new Map(runs.map((r) => [r.id, r]))
  const out: Hit[] = []
  for (const s of sections) {
    const run = byRun.get(s.run_id)
    if (!run?.template_document_id) continue
    if (!(s.documents_read ?? []).includes(run.template_document_id)) continue
    out.push({ id: s.id, company_id: s.company_id,
      what: `run ${run.id} · section ${s.ordinal ?? '?'} ${(s.title ?? '').slice(0, 40)} · `
          + `read its own template ${run.template_document_id}`
          + (run.scope ? ` · scope: ${run.scope.slice(0, 60)}` : ''),
      href: runHref(run.id) })
  }
  return out
}

// ===========================================================================
// 10 — DOCUMENTS STUCK READING  (the owner's answer to S-4)
//
// *** THIS IS A CRON-LIVENESS CHECK WEARING A DOCUMENT'S CLOTHES, AND THE WORDS SAY SO. ***
// `app/api/jobs/scan-documents/route.ts:101` sets `STUCK_AFTER_MS = 900_000` — fifteen minutes —
// and rule 3 at `:152` frees anything older at the top of every cycle, every five minutes. So
// nothing can be stuck for an hour unless the sweep has stopped. 0 rows on staging, which is the
// correct answer; `pulse` below is the half that can actually tell you why.
// ===========================================================================
export const STUCK_FOR_MS = 3_600_000

export function stuckReading(documents: DocumentRow[], now: Date): Hit[] {
  const cutoff = now.getTime() - STUCK_FOR_MS
  return documents
    .filter((d) => d.reading_since && Date.parse(d.reading_since) < cutoff)
    .map((d) => ({
      id: d.id, company_id: d.company_id,
      what: `${d.name ?? 'a document'} · ${d.status ?? 'no status'} · claimed `
          + `${Math.floor((now.getTime() - Date.parse(String(d.reading_since))) / 60_000)} minutes ago`,
      href: documentHref(d.id),
    }))
}

/** The jobs' pulse — S-4's second half, and what `docs/RELEASE.md:65` asks a person to do by hand. */
export interface Pulse { job: string; last_started: string | null; minutes_ago: number | null; open_rows: number }

export function pulse(runs: JobRunRow[], now: Date): Pulse[] {
  const byJob = new Map<string, Pulse>()
  for (const r of runs) {
    const cur = byJob.get(r.job) ?? { job: r.job, last_started: null, minutes_ago: null, open_rows: 0 }
    if (r.started_at && (!cur.last_started || r.started_at > cur.last_started)) {
      cur.last_started = r.started_at
      cur.minutes_ago = Math.floor((now.getTime() - Date.parse(r.started_at)) / 60_000)
    }
    if (!r.finished_at) cur.open_rows++
    byJob.set(r.job, cur)
  }
  return [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job))
}

// ===========================================================================
// 11 — AUDIT RUNS STARTED TWICE WITHIN A MINUTE  (W3's shape)
//
// Two runs on one company inside 60 seconds with the same agency label and the same template.
// 10 on staging: 2 on 15 October, 7 on 3 November (W3's $0.49 pair among them) and 1 on
// 4 November, which is E0's deliberate before/after re-run 46 seconds apart. **A person re-running
// on purpose is indistinguishable from a double press**, so `scope` is in the words and the count
// shows the pair rather than claiming a defect.
// ===========================================================================
export const APART_MS = 60_000

export function duplicateRuns(runs: RunRow[]): Hit[] {
  const sorted = [...runs].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const same = (a: RunRow, b: RunRow) =>
    a.company_id === b.company_id
    && (a.agency_label ?? '') === (b.agency_label ?? '')
    && (a.template_document_id ?? '') === (b.template_document_id ?? '')
  const out: Hit[] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      const apart = Date.parse(b.created_at) - Date.parse(a.created_at)
      if (apart > APART_MS) break
      if (!same(a, b)) continue
      out.push({ id: b.id, company_id: b.company_id,
        what: `${Math.round(apart / 1000)}s after ${a.id} · ${a.kind ?? 'run'} · `
            + `${a.agency_label ?? a.template_document_id ?? 'no label'}`
            + (a.scope ? ` · scope: ${a.scope.slice(0, 60)}` : ''),
        href: runHref(b.id) })
    }
  }
  return out
}

// ===========================================================================
// WHAT YESTERDAY COST — `scripts/cost-report.js`'s shape, which is the one count that already
// existed. **Its two holes come with it**, because a total that quietly omits them is worse than
// no total: `unpriced` is the rows whose model is not in `config/pricing.ts` (cost null, which is
// NOT zero), and `over_2x` is a task above twice its own seven-day average.
// ===========================================================================
export interface CostByTask { task: string; calls: number; usd: number; unpriced: number; avg7: number; over_2x: boolean }
export interface CostByCompany { company_id: string; calls: number; usd: number }
export interface Cost {
  calls: number; usd: number; unpriced: number
  by_task: CostByTask[]
  top_companies: CostByCompany[]
}

const usdOf = (c: AiCallRow): number => {
  const n = c.cost_usd === null ? NaN : Number(c.cost_usd)
  return Number.isFinite(n) ? n : 0
}
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000

export function cost(day: AiCallRow[], prior7: AiCallRow[]): Cost {
  const avg7 = new Map<string, number>()
  for (const c of prior7) {
    avg7.set(String(c.task), (avg7.get(String(c.task)) ?? 0) + usdOf(c))
  }
  for (const [k, v] of avg7) avg7.set(k, v / 7)

  const byTask = new Map<string, CostByTask>()
  const byCompany = new Map<string, CostByCompany>()
  let calls = 0
  let usd = 0
  let unpriced = 0
  for (const c of day) {
    calls++
    usd += usdOf(c)
    if (c.cost_usd === null) unpriced++
    const t = String(c.task)
    const row = byTask.get(t)
      ?? { task: t, calls: 0, usd: 0, unpriced: 0, avg7: round4(avg7.get(t) ?? 0), over_2x: false }
    row.calls++
    row.usd += usdOf(c)
    if (c.cost_usd === null) row.unpriced++
    byTask.set(t, row)
    const co = String(c.company_id ?? '')
    const crow = byCompany.get(co) ?? { company_id: co, calls: 0, usd: 0 }
    crow.calls++
    crow.usd += usdOf(c)
    byCompany.set(co, crow)
  }
  const tasks = [...byTask.values()].map((r) => ({
    ...r, usd: round4(r.usd), over_2x: r.avg7 > 0 && r.usd > 2 * r.avg7,
  })).sort((a, b) => b.usd - a.usd)
  const companies = [...byCompany.values()].map((r) => ({ ...r, usd: round4(r.usd) }))
    .sort((a, b) => b.usd - a.usd).slice(0, 5)
  return { calls, usd: round4(usd), unpriced, by_task: tasks, top_companies: companies }
}

// ===========================================================================
// THE WHOLE REPORT, FROM ONE DAY'S ROWS.
// ===========================================================================

export interface Input {
  now: Date
  turns: TurnRow[]
  turnsOfSummarised: TurnRow[]
  topicsById: Map<string, TopicRow>
  summarisedTopics: TopicRow[]
  runs: RunRow[]
  sections: SectionRow[]
  findings: FindingRow[]
  scans: ScanRow[]
  documentNames: Map<string, string>
  callsDay: AiCallRow[]
  callsPrior7: AiCallRow[]
  claimedCallIds: Set<string>
  stuckDocuments: DocumentRow[]
  jobRuns: JobRunRow[]
}

export interface Report {
  hits: Record<string, Hit[]>
  cost: Cost
  pulse: Pulse[]
}

/** Every counter, run once. The route does no counting of its own. */
export function buildReport(input: Input): Report {
  const turnsByTopic = new Map<string, TurnRow[]>()
  for (const t of input.turnsOfSummarised) {
    const list = turnsByTopic.get(t.topic_id) ?? []
    list.push(t)
    turnsByTopic.set(t.topic_id, list)
  }
  const summaryTopicsForHandles = input.summarisedTopics
  const hits: Record<string, Hit[]> = {
    answers_no_source: answersNoSource(input.turns, input.topicsById),
    refused_quotes: refusedQuotes(input.turns, input.topicsById),
    handles_at_a_person: handlesAtAPerson(
      input.turns, input.findings, summaryTopicsForHandles, input.topicsById),
    sections_unparsed: sectionsUnparsed(input.sections),
    word_against_attachments: wordAgainstAttachments(input.findings),
    read_without_the_model: readWithoutTheModel(input.scans, input.documentNames),
    paid_and_unclaimed: paidAndUnclaimed(input.callsDay, input.claimedCallIds),
    summary_without_sources: summaryWithoutSources(input.summarisedTopics, turnsByTopic),
    template_read_itself: templateReadItself(input.runs, input.sections),
    stuck_reading: stuckReading(input.stuckDocuments, input.now),
    duplicate_runs: duplicateRuns(input.runs),
  }
  return { hits, cost: cost(input.callsDay, input.callsPrior7), pulse: pulse(input.jobRuns, input.now) }
}

/**
 * HOW MANY THINGS TO LOOK AT — the `n` in the email's subject.
 * **The cost and the pulse always show and never count**, because a number that is always there
 * is not a thing to look at, and a subject line that says "2" on a quiet day teaches a person to
 * ignore the subject line.
 */
export function thingsToLookAt(hits: Record<string, Hit[]>): number {
  return COUNTERS.filter((c) => (hits[c.key] ?? []).length > 0).length
}

/** The per-company split, plus the one `company_id = null` totals row that holds no ids. */
export interface DayRow {
  date: string
  company_id: string | null
  counts: Record<string, unknown>
  rows: Record<string, Hit[]>
}

export function splitByCompany(day: string, report: Report): DayRow[] {
  const companies = new Set<string>()
  for (const c of COUNTERS) for (const h of report.hits[c.key] ?? []) if (h.company_id) companies.add(h.company_id)
  for (const c of report.cost.top_companies) if (c.company_id) companies.add(c.company_id)

  const out: DayRow[] = []
  for (const company of [...companies].sort()) {
    const counts: Record<string, unknown> = {}
    const rows: Record<string, Hit[]> = {}
    for (const c of COUNTERS) {
      const mine = (report.hits[c.key] ?? []).filter((h) => h.company_id === company)
      counts[c.key] = mine.length
      if (mine.length) rows[c.key] = mine
    }
    const mineCost = report.cost.top_companies.find((t) => t.company_id === company)
    counts.cost = { calls: mineCost?.calls ?? 0, usd: mineCost?.usd ?? 0 }
    out.push({ date: day, company_id: company, counts, rows })
  }

  const totals: Record<string, unknown> = {}
  for (const c of COUNTERS) totals[c.key] = (report.hits[c.key] ?? []).length
  totals.cost = report.cost
  totals.pulse = report.pulse
  totals.things_to_look_at = thingsToLookAt(report.hits)
  // The totals row spans companies, so it carries NO ids — enforced by migration 095's own CHECK.
  out.push({ date: day, company_id: null, counts: totals, rows: {} })
  return out
}

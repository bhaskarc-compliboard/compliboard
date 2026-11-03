/**
 * WHAT AN ANSWER MAY OFFER TO DO — Calendar step 10a.
 *
 * An offer is the one piece of an answer that is not prose: a structured thing the person can
 * accept with one click. Calendar's only offer is **add this date to the calendar** (decision 17:
 * a date a person adds is confirmed at once, with their name on it), acted on in 10b through
 * `proposeDate` with `source: 'rule'`. **Audits' only offer is `run_audit`** — start the audit
 * the answer is about — added 3 November 2026 (`docs/GAPS-PLAN.md` decisions 41 and 43).
 *
 * *** THE TWO KINDS ARE CHECKED DIFFERENTLY ON PURPOSE, and the rule below says why at the
 * branch. *** The paragraph after this one is about `add_date` and holds for it unchanged.
 *
 * *** AN OFFER IS CHECKED LIKE A CITATION, AND DROPPED LIKE ONE. *** The owner's rule for this
 * step: an offer whose `source_url` this call's web search did not return is dropped, and the drop
 * is counted. The reason is the reason the whole check exists — an offer carries a date into the
 * customer's calendar, so "where did this come from" must be answerable, and a URL the model
 * remembered is not an answer. `findReturned` is the same function the link check uses, so an
 * offer cannot be more trusted than a citation of the same page.
 *
 * THE FORMAT IS A FENCED BLOCK, and that is a decision rather than a default. The alternatives
 * were a tool call (another round trip, and the answer is already streaming) and a sentence parsed
 * out of the prose (which cannot be told from a sentence ABOUT an offer). A fenced block is
 * removed from what the person reads, so a model that writes two of them, or writes one badly, is
 * visible in the counts rather than on the screen.
 */
import { findReturned } from '../howTo.ts'

export const OFFER_KINDS = ['add_date', 'run_audit'] as const
export type OfferKind = (typeof OFFER_KINDS)[number]

/** Calendar's offer, in the shape `proposeDate` takes (`lib/calendarDates.ts`). */
export interface AddDateOffer {
  kind: 'add_date'
  title: string
  /** A one-off's day, or null for a date that repeats. */
  due_on: string | null
  recurs: boolean
  /** One of `PERIODS`, or null for "it repeats and how often was not read" (decision 23). */
  period: string | null
  /** A site id, or null for the whole company. Checked against the company's own sites in 10b. */
  site: string | null
  source_url: string
  source_line: string
}

/**
 * *** AUDITS' ONE OFFER — the owner, 3 November 2026 (`docs/GAPS-PLAN.md` decisions 41 and 43). ***
 *
 * "Do you want me to run the Oregon DEQ audit?" The model PROPOSES; the press starts the run in
 * `app/audits/page.tsx` through the same `POST /api/audit-runs` the Audit button calls.
 *
 * `agency` is a label the company's own documents produced, or `'all'`. `attached` says the
 * offer is about the file the person put on THIS turn — a marker and not an id, because **the
 * model is never shown the file's id** and asking for one got a passage handle three times in
 * step 6a's eighteen runs. The code fills the id in, from what it already holds.
 */
export interface RunAuditOffer {
  kind: 'run_audit'
  /** An agency label, or 'all'. Null when the offer is about the attached file. */
  agency: string | null
  /** True when the offer is to audit against the file attached on this turn. */
  attached: boolean
}

export type Offer = AddDateOffer | RunAuditOffer

export interface ParsedOffers {
  /** The answer with every offer block removed, ready to be shown. */
  text: string
  offers: Offer[]
  /** Blocks that were not usable, counted by why — never shown, always reported. */
  dropped: { notJson: number; unknownKind: number; badShape: number; unverifiedLink: number }
}

const FENCE = /```offer\s*\n([\s\S]*?)```/g

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null)

/**
 * Pull every offer out of the answer, check each one, and hand back the text without them.
 *
 * `allowed` is the brief's list: a section that offers nothing gets every block dropped as an
 * unknown kind, which is right — the engine must not act on an offer a section never declared.
 */
export function parseOffers(
  text: string, allowed: readonly OfferKind[], searched: Array<{ url: string; title: string }>,
): ParsedOffers {
  const offers: Offer[] = []
  const dropped = { notJson: 0, unknownKind: 0, badShape: 0, unverifiedLink: 0 }
  const out = text.replace(FENCE, (_whole, body: string) => {
    let raw: unknown
    try { raw = JSON.parse(body) } catch { dropped.notJson++; return '' }
    const o = (raw ?? {}) as Record<string, unknown>
    const kind = str(o.kind)
    if (!(allowed as readonly string[]).includes(kind)) { dropped.unknownKind++; return '' }
    if (kind === 'add_date') {
      const title = str(o.title)
      const recurs = o.recurs === true
      const due_on = day(o.due_on)
      const source_url = str(o.source_url)
      const source_line = str(o.source_line)
      // The product's own rule, not a style check: a date that happens once needs a day
      // (decision 12, migration 073's `calendar_events_date_or_recurs`), and an offer with no
      // title is a button with nothing on it.
      if (!title || (!due_on && !recurs) || !source_url) { dropped.badShape++; return '' }
      // THE SAME CHECK AS A CITATION: this call's search must have returned the page.
      if (!findReturned(source_url, searched)) { dropped.unverifiedLink++; return '' }
      offers.push({
        kind: 'add_date', title, due_on, recurs,
        period: str(o.period) || null,
        site: str(o.site) || null,
        source_url, source_line,
      })
      return ''
    }
    /**
     * *** THE LINK CHECK DOES NOT APPLY TO THIS KIND, AND THAT IS THE OWNER'S DECISION 43, NOT AN
     * OVERSIGHT. *** `add_date` above carries a date out of a regulation into a customer's
     * calendar, so "where did this come from" must be answerable and `findReturned` answers it.
     * A `run_audit` offer carries nothing out of the web: it starts a run over the company's own
     * documents, and there is no page to verify. Demanding a `source_url` here would drop every
     * valid offer — which is exactly what it did for three of step 6a's eighteen.
     *
     * What IS checked, and in code rather than here, is the only thing that can be wrong in a way
     * that matters: the agency. `lib/ask/auditsBrief.ts` `checkRunAuditOffer` holds it against
     * `lib/audit.ts` `auditAgenciesFor` — the company's own labels — exactly as
     * `app/api/audit-runs/route.ts:122`–`:134` refuses anything else. This function cannot do it,
     * because it is given no company.
     */
    if (kind === 'run_audit') {
      const agency = str(o.agency)
      const attached = o.attached === true
      // One or the other, never neither: an offer naming nothing is a button with nothing behind it.
      if (!agency && !attached) { dropped.badShape++; return '' }
      offers.push({ kind: 'run_audit', agency: agency || null, attached })
      return ''
    }
    dropped.unknownKind++
    return ''
  })
  // Two blank lines where a block was removed read as a gap; one paragraph break is the most
  // anything should leave behind.
  return { text: out.replace(/\n{3,}/g, '\n\n').trim(), offers, dropped }
}

/** For the log and the report: "1 offer; dropped 1 (its link was not in this call's search)". */
export function offerLine(p: ParsedOffers): string {
  const why = [
    p.dropped.notJson ? `${p.dropped.notJson} not readable as JSON` : '',
    p.dropped.unknownKind ? `${p.dropped.unknownKind} of a kind this section does not offer` : '',
    p.dropped.badShape ? `${p.dropped.badShape} missing something it needs` : '',
    p.dropped.unverifiedLink ? `${p.dropped.unverifiedLink} whose link was not in this call's search` : '',
  ].filter(Boolean)
  return `${p.offers.length} offer(s)${why.length ? `; dropped ${why.join(', ')}` : ''}`
}

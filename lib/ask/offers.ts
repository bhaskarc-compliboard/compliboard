/**
 * WHAT AN ANSWER MAY OFFER TO DO — Calendar step 10a.
 *
 * An offer is the one piece of an answer that is not prose: a structured thing the person can
 * accept with one click. Calendar's only offer is **add this date to the calendar** (decision 17:
 * a date a person adds is confirmed at once, with their name on it), acted on in 10b through
 * `proposeDate` with `source: 'rule'`.
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

export const OFFER_KINDS = ['add_date'] as const
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

export type Offer = AddDateOffer

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

/**
 * THE CONFIRM QUEUE'S SHAPE AND WORDS — Calendar step 9, board 7 (`docs/calendar-boards.html`).
 *
 * Grouped by WHERE THE DATE CAME FROM, because that is how the work arrives: one reading of one
 * permit proposes seven dates, and a person who has just uploaded that permit wants to say "yes,
 * all of those" once. Board 7's note puts it plainly — every row here is already on the Calendar
 * tab; this tab only shortens the work.
 *
 * *** IT IS A FILE OF ITS OWN BECAUSE THE ORDER AND THE PHRASES ARE RULES, NOT MARKUP. ***
 * Which group comes first, which row comes first inside it, what a repeating date with no period
 * says, and which ids "Confirm all" sends are each a decision with a reason, and a decision written
 * inline in JSX is a decision nothing tests. The component (`components/DateQueue.tsx`) draws what
 * this returns.
 *
 * NOTHING HERE READS THE DATABASE and nothing here does date arithmetic: the rows arrive from
 * `calendar_v` through `readCalendarRows` (`lib/calendarView.ts`), which is the one filter the tab
 * counts and the sidebar badge share (`lib/calendarCounts.ts`), and `next_due` is the view's.
 */
import {
  type CalendarRow, longDay, dayOf, hasNoDay, siteWords, PERIOD_LABEL,
} from './calendarView.ts'
import { KIND_WORD } from './documentStatus.ts'

/**
 * *** THE QUEUE IS THE `proposed` ROWS OF THE SAME LIVE SET, AND NOTHING ELSE. ***
 * `lib/calendarCounts.ts` `countsFrom` counts exactly this for the tab label and the sidebar badge
 * (`rows.filter(r => r.status === 'proposed')`), so the list and the two numbers cannot disagree:
 * one read, one filter, three readers.
 */
export const waitingRows = (rows: CalendarRow[]): CalendarRow[] =>
  rows.filter((r) => r.status === 'proposed')

/** What the product knows about the document a group's dates were read from, when it still exists. */
export interface DocumentHead {
  kind: string | null
  /** When the reading that proposed these dates ran — `document_index_v.scanned_at`. */
  scanned_at: string | null
}

// ---------------------------------------------------------------------------------------------
// THE WORDS — the owner's, from the step 9 brief and board 7.
// ---------------------------------------------------------------------------------------------

/** Board 7's line under the tabs. */
export const QUEUE_BAR =
  'These dates are already on your calendar. Confirm the ones that are right; tell us when one is not.'

/** The empty state, the owner's words. It is only ever drawn after the read has answered. */
export const QUEUE_EMPTY_TITLE = 'Nothing waiting'
export const QUEUE_EMPTY_NOTE =
  'When a reading finds a date, it lands here for you to confirm or set right.'

/**
 * A REPEATING DATE WHOSE FREQUENCY WAS NEVER READ (decisions 23 and 30). It goes where the date
 * would go, because there is no date to put there: `calendar_v` cannot compute `next_due` without a
 * period, so the row genuinely has no day to show, and the picker beside Confirm is the way out.
 */
export const HOW_OFTEN_UNREAD = "how often wasn't read"
export const PERIOD_UNREAD = `repeats — ${HOW_OFTEN_UNREAD}`
/** Repeating, how often known, no anchor to count from — decision 12's honest state. */
export const NO_DAY_YET = 'repeats, no day yet'

/**
 * *** THE SECOND SECTION — "Needs a day or how often" (decision 32, Calendar step 14b). ***
 *
 * The month grid and the list show dates and nothing else; a row with no day at all is not a date
 * yet, it is a question, and this is where the product asks it. Grouped by source exactly as the
 * queue above is, because the work arrives the same way: one reading of one permit leaves five
 * dates needing a day.
 *
 * *** ITS ROWS ARE NOT THE QUEUE'S ROWS, AND THE OVERLAP IS DELIBERATE (the owner, 19 October). ***
 * The queue is the `proposed` rows and asks "is this right?"; this section is every LIVE row with
 * no day — proposed OR confirmed — and asks "when?". A proposed row with no day is in both,
 * because both questions are open about it. The TAB'S COUNT stays the queue's; this section
 * carries its own, so neither number can be read as the other.
 */
export const NEEDS_WHEN_HEADING = (n: number) => `Needs a day or how often (${n})`
export const NEEDS_WHEN_NOTE =
  'These repeat, and nothing in the reading said when. Open one to set the day, or how often it repeats.'
/** The anchor the month and the list's foot line points at. */
export const NEEDS_WHEN_ID = 'needs-a-day'

/** The row's two actions, board 7. "Not right" opens board 8's sheet; neither word is negotiable. */
export const CONFIRM = 'Confirm'
export const NOT_RIGHT = 'Not right'

/** The picker's last choice, which confirms the date and leaves the period null on purpose. */
export const DONT_KNOW_YET = "I don't know yet"
export const HOW_OFTEN = 'How often?'

/** What a group's button says, by where its dates came from — the owner's words for step 9. */
export const CONFIRM_ALL: Record<string, string> = {
  document: 'Confirm all from this document',
  audit: 'Confirm all from this audit',
  handbook: 'Confirm all from this handbook',
  rule: 'Confirm all from the chat',
}
export const confirmAllLabel = (kind: string): string => CONFIRM_ALL[kind] ?? 'Confirm all'

/** A failed write, said beside the row that failed, with the row left exactly where it was. */
export const ROW_FAILED = 'We could not change that date just now. Nothing has changed.'
export const GROUP_FAILED = 'We could not confirm those dates just now. Nothing has changed.'

// ---------------------------------------------------------------------------------------------
// ONE ROW
// ---------------------------------------------------------------------------------------------

/**
 * WHAT GOES WHERE THE DATE GOES — the brief's three cases, in its own words.
 *
 *   · a one-off, or a repeating date with a period: the day, and how often when it also repeats
 *     ("1 March 2027, every year" — board 7's own shape);
 *   · repeating with no period: `PERIOD_UNREAD`, plus the anchor when there is one, because an
 *     anchor we HAVE must not be hidden by a frequency we do not;
 *   · repeating with a period and no anchor: `NO_DAY_YET`.
 *
 * A one-off always has a day — migration 073's `calendar_events_date_or_recurs` refuses one
 * without — so the first case cannot come back empty for a one-off.
 */
export function queueWhen(row: CalendarRow): string {
  if (!row.recurs) return longDay(row.next_due ?? row.due_date)
  if (!row.period) {
    // *** THE DAY FIRST, SINCE STEP 14b (the owner). *** It read "repeats — how often wasn't read,
    // from 20 Aug": true, and it buried the one thing this row now has. Migration 079 puts that
    // date on the grid, so the queue says the day the grid shows and then what is still unknown.
    // With no day at all there is nothing to lead with, and the old sentence is the whole answer.
    const day = longDay(row.next_due ?? row.due_date)
    return day ? `${day}, ${HOW_OFTEN_UNREAD}` : PERIOD_UNREAD
  }
  const day = longDay(row.next_due)
  const how = PERIOD_LABEL[row.period] ?? ''
  if (!day) return NO_DAY_YET
  return how ? `${day}, ${how}` : day
}

/**
 * THE REST OF THE ROW'S META LINE, in board 7's order: the page it was read from, then the site.
 *
 * *** THE SITE ONLY WITH MORE THAN ONE SITE *** — decision 24, and `siteWords` is 8a's own rule,
 * imported rather than restated, so the queue and the list say the same thing or neither does.
 * The quoted line is NOT here: it is drawn as a quotation by the component, which is what board 7
 * does with it.
 */
export function queueMeta(row: CalendarRow, siteCount: number): string[] {
  const out: string[] = []
  if (row.source_page) out.push(`Page ${row.source_page}`)
  const site = siteWords(row, siteCount)
  if (site) out.push(site)
  return out
}

/** A repeating date with no period is the one row that gets a picker beside Confirm. */
export const needsPeriod = (row: CalendarRow): boolean => row.recurs && !row.period

// ---------------------------------------------------------------------------------------------
// THE GROUPS
// ---------------------------------------------------------------------------------------------

export interface QueueGroup {
  /** Stable across a reload, so a half-confirmed group does not jump about: the source's own id. */
  key: string
  /** `document | audit | handbook | rule | …` — what the button at the end of the heading says. */
  kind: string
  heading: string
  rows: CalendarRow[]
}

/**
 * WHICH GROUP A ROW BELONGS TO. The source's own id, so two readings of the same document are one
 * group and two documents are never merged by having the same title.
 *
 * An audit row has no run id on it — `calendar_v` carries `audit_finding_id`, and a finding's id
 * changes with every run — so the key is the view's `source_title`, which IS the run: migration
 * 075 builds it as the agency label and the run's date. Grouping by the finding would put every
 * date in a group of its own, which is the opposite of what this tab is for.
 */
export function groupKeyOf(row: CalendarRow): string {
  switch (row.source) {
    case 'document': return `document:${row.document_id ?? 'gone'}`
    case 'audit': return `audit:${row.source_title ?? row.audit_finding_id ?? 'unknown'}`
    case 'handbook': return `handbook:${row.handbook_id ?? 'gone'}`
    case 'rule': return 'rule:'
    default: return `other:${row.source}`
  }
}

/**
 * THE GROUP'S HEADING — the brief's list: a document says its title, its kind word and when it was
 * read; an audit says the agency and the run's date; a handbook says its name.
 *
 * *** DECISION 30 WHEREVER A PART IS MISSING, AND NEVER A GUESS. *** A document that has been
 * deleted leaves `source_title` null (the view's LEFT JOIN found nothing), and a document whose
 * row we could not read leaves `kind` and `scanned_at` unknown — so each part is left out and the
 * heading says what it does know. "read ‹day›" is `document_index_v.scanned_at`, the day the
 * reading that proposed these dates ran.
 */
export function groupHeading(row: CalendarRow, head?: DocumentHead | null): string {
  if (row.source === 'audit') {
    return row.source_title ? `Audit: ${row.source_title}` : 'An audit'
  }
  if (row.source === 'handbook') {
    return row.source_title ? `Handbook: ${row.source_title}` : 'A handbook'
  }
  if (row.source === 'rule') return 'From the chat'
  if (row.source !== 'document') return 'Added by hand'
  if (!row.source_title) return 'A document that has been deleted'
  const parts = [row.source_title]
  const kind = head?.kind ? KIND_WORD[head.kind] ?? head.kind : ''
  if (kind) parts.push(kind)
  const read = dayOf(head?.scanned_at) ? longDay(head?.scanned_at) : ''
  if (read) parts.push(`read ${read}`)
  return parts.join(' · ')
}

/** "3 dates" — board 7's own tail on the heading. */
export const groupCount = (n: number): string => `${n} ${n === 1 ? 'date' : 'dates'}`

/**
 * THE SORT, BOTH LEVELS, FROM THE BRIEF: groups soonest-date first, and inside a group by date with
 * the undated repeating rows last.
 *
 * A group's date is the SOONEST day any of its rows has. A group whose rows all lack a day has no
 * date at all and sorts last — it is not "soon", and putting it first because its key sorts early
 * would push real deadlines down the page. Ties break on the heading so the order is stable
 * between reloads rather than left to the order rows came back in.
 */
export function queueGroups(
  rows: CalendarRow[], heads: Record<string, DocumentHead> = {},
): QueueGroup[] {
  return groupRows(waitingRows(rows), heads)
}

/**
 * *** THE ROWS THE SECOND SECTION SHOWS: every LIVE row with no day at all. ***
 * `hasNoDay` is `lib/calendarView.ts`'s, imported rather than restated, so the rows this section
 * shows are exactly the rows the two views leave out and the foot line counts — one definition,
 * three readers. After migration 079 that means a REPEATING row whose day was never read; a
 * one-off cannot be here at all (073's `calendar_events_date_or_recurs`).
 */
export const needsWhenRows = (rows: CalendarRow[]): CalendarRow[] => rows.filter(hasNoDay)

/** The same grouping, the same order, over that set. */
export function needsWhenGroups(
  rows: CalendarRow[], heads: Record<string, DocumentHead> = {},
): QueueGroup[] {
  return groupRows(needsWhenRows(rows), heads)
}

/** The grouping itself, over whichever set of rows is being shown. */
function groupRows(list: CalendarRow[], heads: Record<string, DocumentHead>): QueueGroup[] {
  const by = new Map<string, CalendarRow[]>()
  for (const r of list) {
    const k = groupKeyOf(r)
    if (!by.has(k)) by.set(k, [])
    by.get(k)!.push(r)
  }
  const groups: QueueGroup[] = [...by.entries()].map(([key, list]) => {
    const first = list[0]
    return {
      key,
      kind: first.source,
      heading: groupHeading(first, first.document_id ? heads[first.document_id] : null),
      rows: list.slice().sort((a, b) => {
        const da = dayOf(a.next_due)
        const db = dayOf(b.next_due)
        if (!da && !db) return a.title.localeCompare(b.title)
        if (!da) return 1          // a date with no day goes last, inside its group
        if (!db) return -1
        return da.localeCompare(db) || a.title.localeCompare(b.title)
      }),
    }
  })
  const soonest = (g: QueueGroup): string => {
    const days = g.rows.map((r) => dayOf(r.next_due)).filter(Boolean).sort()
    return days[0] ?? ''
  }
  return groups.sort((a, b) => {
    const sa = soonest(a)
    const sb = soonest(b)
    if (!sa && !sb) return a.heading.localeCompare(b.heading)
    if (!sa) return 1
    if (!sb) return -1
    return sa.localeCompare(sb) || a.heading.localeCompare(b.heading)
  })
}

/**
 * *** THE IDS "CONFIRM ALL" SENDS ARE THE ONES ON THE SCREEN. ***
 *
 * The owner's rule, and the whole reason the route takes ids rather than a document: a date that
 * arrived after this page was drawn is not confirmed by somebody who never saw it. This is one line
 * and it is a function anyway, because it is the rule — `components/DateQueue.tsx` passes what it
 * rendered, and `tests/unit/calendarQueue.test.ts` holds it.
 */
export const idsShown = (group: QueueGroup): string[] => group.rows.map((r) => r.id)

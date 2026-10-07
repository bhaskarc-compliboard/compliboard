/**
 * THE LIST WORDS — how a list of conversations and checklists says how many, when and what, shared by
 * the Compliance Workspace and HR. HR Step 4a (`docs/HR-PLAN.md` decision 1): moved out of
 * `app/compliance/page.tsx` character for character, so the two sections' lists cannot drift.
 *
 * *** BROWSER-SAFE: THIS FILE IMPORTS NOTHING. *** Client pages read it; `tests/unit/clientImports.test.ts`
 * covers every client file's imports, and `tests/unit/listWords.test.ts` holds what each helper says.
 */

/**
 * HOW MANY CONVERSATIONS AND CHECKLISTS ONE LOAD READS — Task 2b. It was the literal 60 in two
 * places. One name, used by both reads and by the counts line, which says "60+" when a list holds
 * exactly this many: a full read means there may be more, and a bare "60" would be a count we do
 * not have.
 */
export const LIST_CAP = 60
/** "47", or "60+" for a read that came back full. The one rule, for the counts line and the tab. */
export const countOf = (n: number) => (n >= LIST_CAP ? `${LIST_CAP}+` : String(n))
/** "1 conversation", "47 conversations", "60+ conversations". */
export const countWord = (n: number, word: string) =>
  `${countOf(n)} ${word}${n === 1 ? '' : 's'}`

/**
 * A CONVERSATION'S TITLE, AS SHOWN — Workspace Task 3. Titles are stored as typed (the first
 * question, verbatim — `lib/conversation.ts` `titleFromQuestion`), so many start lowercase. This
 * upper-cases the FIRST character only when it is a lowercase letter and leaves every other
 * character exactly as it is. Display only: the stored title and every other section (To-confirm
 * shows the same titles) are untouched. A title starting with a quote, a digit or anything else
 * that is not a lowercase letter — "'m opening…" — is left alone; null stays null so each caller's
 * fallback still applies.
 */
export const displayTitle = (title: string | null): string | null =>
  title && /^\p{Ll}/u.test(title) ? title.charAt(0).toUpperCase() + title.slice(1) : title

/**
 * THE CONVERSATIONS LIST'S DATES — Workspace Task 5, board 5. A row says WHEN in the shortest way that
 * is still exact for its age, and rows are grouped Today, This week, then by month.
 * "This week" is the six days before today; older is a month heading.
 */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
export const daysAgo = (iso: string, now: Date) => Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000)

/** "Today", "This week", or "September 2026". */
export function listGroup(iso: string, now: Date = new Date()): string {
  const days = daysAgo(iso, now)
  if (days <= 0) return 'Today'
  if (days <= 6) return 'This week'
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** "3:42 pm" today; "Wed 30 Sep" this week; "18 Sep 2025" before that. */
export function listWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const days = daysAgo(iso, now)
  if (days <= 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
  if (days <= 6) return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** What the conversation's summary is, in the words the row uses. */
export function summaryWords(t: { summarised_at: string | null; turnCount: number }): string {
  if (!t.summarised_at) return 'Not summarised yet'
  return t.turnCount > 0 ? 'Summary ready' : 'Summary only — the full conversation was cleared'
}

/** How Audits writes a date — `app/audits/page.tsx:189–194`, copied: "30 September 2026". */
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * GROUP BY THE DAY, RATHER THAN PRINTING IT ON EVERY ROW.
 *
 * Both lists repeated "Yesterday" down the whole column — a line per row saying the same
 * thing, which is a date you cannot scan and a line you cannot use. The rows keep the order
 * they arrived in; this only buckets consecutive rows that share the label `friendlyDate`
 * already produces, so a list that is not sorted by date still renders truthfully.
 */
export function groupByDay<T>(rows: T[], dateOf: (row: T) => string): Array<{ day: string; rows: T[] }> {
  const out: Array<{ day: string; rows: T[] }> = []
  for (const row of rows) {
    const day = dateOf(row)
    const last = out[out.length - 1]
    if (last && last.day === day) last.rows.push(row)
    else out.push({ day, rows: [row] })
  }
  return out
}

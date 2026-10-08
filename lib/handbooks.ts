/**
 * HANDBOOKS, THE PURE PART — HR Step 5a (`docs/HR-PLAN.md` decision 18). Browser-safe: it imports only
 * `lib/storage.ts`'s constant. Read by `app/api/handbooks/route.ts` and the HR page; held by
 * `tests/unit/handbooks.test.ts`.
 */
import { HANDBOOKS_PREFIX } from './storage.ts'

/** "Employee Handbook 2026.pdf" → "Employee Handbook 2026": the extension off, nothing else changed. */
export function nameFromFile(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

/** True only for exactly <companyId>/handbooks/<one file name> — the path `handbookPath()` builds. */
export function isOwnHandbookPath(path: string, companyId: string): boolean {
  const parts = String(path).split('/')
  return parts.length === 3 && parts[0] === companyId && parts[1] === HANDBOOKS_PREFIX && parts[2].length > 0
}

export type HandbookStatus = 'uploaded' | 'reading' | 'read' | 'could_not_read'

/** The row's status in the owner's words (HR Step 5a). 5b only sets the status; the words are here. */
/**
 * "1 section", "2 sections"; "1 page", "2 pages" — `lib/listWords.ts` countWord's plural rule. Not countWord
 * itself: it caps at LIST_CAP (60) for lists, and a 120-page handbook must not read "60+ pages".
 */
export const counted = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Why a handbook could not be read — the owner's words (HR Step 5b), shown after "Could not read — ". */
export const READ_REASONS = {
  scan: "This looks like a scan, and we can't read its text. Please upload the original PDF or the Word file.",
  kind: "We can't read this kind of file yet. Please upload a PDF or a Word file.",
  noPages: 'This file has no pages we can read.',
  ours: 'Something went wrong at our end while reading it. Press Read it again.',
} as const

export function statusWords(status: string, reason: string | null, sectionCount?: number | null): string {
  if (status === 'uploaded') return 'Waiting to be read'
  if (status === 'reading') return 'Reading…'
  if (status === 'read') return sectionCount == null ? 'Read' : `Read · ${counted(sectionCount, 'section')}`
  if (status === 'could_not_read') return `Could not read — ${reason ?? ''}`.trim()
  return status
}

export interface HandbookRow {
  id: string; name: string; file_name: string; file_path: string
  scope: 'company' | 'site'; entity_id: string | null
  status: string; status_reason: string | null
  version_of: string | null; is_current: boolean; created_at: string
  /** Step 5b: set when read. `handbook_sections` is PostgREST's embedded count. */
  page_count?: number | null; read_at?: string | null; handbook_sections?: Array<{ count: number }>
  /** Set when a check finishes done (migration 066); the row and the drawer print them. */
  checked_at?: string | null; next_check_at?: string | null
}

/** How many sections a read handbook has, from the list's embedded count. */
export const sectionCount = (h: HandbookRow): number | null => h.handbook_sections?.[0]?.count ?? null

/** A section's pages in the drawer: "pages 6–7", or "page 6" for one page; nothing for a Word file. */
export function pagesWords(from: number | null, to: number | null): string | null {
  if (from == null) return null
  return to == null || to === from ? `page ${from}` : `pages ${from}–${to}`
}

/** The older versions of a current handbook, newest older first: down its `version_of` chain, never a
 *  current row (if a second write failed, both are current and each shows as its own handbook). */
export function olderVersions(current: HandbookRow, all: HandbookRow[]): HandbookRow[] {
  const byId = new Map(all.map((h) => [h.id, h]))
  const out: HandbookRow[] = []
  const seen = new Set([current.id])
  let at = current.version_of
  while (at && byId.has(at) && !seen.has(at)) {
    seen.add(at)
    const h = byId.get(at)!
    if (!h.is_current) out.push(h)
    at = h.version_of
  }
  return out
}

/** Which group a row belongs in: "every", a site id, or "removed" (scope 'site' whose site is gone). */
function groupKey(h: HandbookRow, sites: Array<{ id: string }>): string {
  if (h.scope === 'company') return 'every'
  return h.entity_id && sites.some((s) => s.id === h.entity_id) ? h.entity_id : 'removed'
}

/**
 * THE HANDBOOKS LIST, AS THE TAB SHOWS IT — every row, nothing silently dropped (owner, 7 October 2026).
 *   · Groups: "Every site" first, then each site by name, then "Site removed". Empty groups are left out.
 *   · In a group: each current handbook, then its older versions (newest older first).
 *   · THEN ANY OLDER ROW NO CHAIN REACHES — not current, and no current version's chain leads to it — so a
 *     person can still see it and delete it. However it happened, it is never hidden.
 */
export function handbookList(all: HandbookRow[], sites: Array<{ id: string; name: string }>):
    Array<{ key: string; label: string; removed: boolean; rows: HandbookRow[] }> {
  const current = all.filter((h) => h.is_current)
  const reached = new Set<string>()
  for (const c of current) { reached.add(c.id); for (const o of olderVersions(c, all)) reached.add(o.id) }
  const loose = all.filter((h) => !reached.has(h.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const order = [
    { key: 'every', label: 'Every site', removed: false },
    ...[...sites].sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ key: s.id, label: s.name, removed: false })),
    { key: 'removed', label: 'Site removed', removed: true },
  ]
  return order.map((g) => ({
    ...g,
    rows: [
      ...current.filter((h) => groupKey(h, sites) === g.key).flatMap((h) => [h, ...olderVersions(h, all)]),
      ...loose.filter((h) => groupKey(h, sites) === g.key),
    ],
  })).filter((g) => g.rows.length > 0)
}

// ---------------------------------------------------------------------------------------------------------
// THE CHECK'S WORDS — HR Baseline Step 1 (8 October 2026). Marked (owner) where they are the owner's.
// ---------------------------------------------------------------------------------------------------------

/** "Choose where it applies" (HR Step 11a): the site sheet's lede for a handbook whose site was removed (proposed). */
export const siteRemovedLede = (name: string) => `${name}. Its site was removed. Which site does it cover now?`
export const CHOOSE_WHERE = 'Choose where it applies'

/** The Handbooks tab's line and the upload sheet's lede: the owner's words, restored by HR Step 10's nightly check. */
export const HANDBOOKS_TAB_LINE = 'Each handbook is checked the night it arrives, then every 90 days. Changed one? Add the new version.'
export const uploadLede = (file: string) => `${file}. We read it in about a minute and check it tonight. It stays here in HR.`

/** The row's line after the file name, each part with whether it is amber (owner). */
export type LinePart = { text: string; amber?: boolean }
export function checkLine(c: {
  open: { done: number; total: number } | null
  last: { status: 'done' | 'failed'; notChecked: number } | null
  checkedAt: string | null; nextCheckAt: string | null
}, date: (iso: string) => string): LinePart[] {
  if (c.open) return [{ text: `Checking ${c.open.done} of ${c.open.total}…` }]
  if (!c.last) return [{ text: 'Not checked yet' }]
  // The words accepted for a check that could not finish (every part failed): amber, and what to do.
  if (c.last.status === 'failed') return [{ text: 'The check could not finish — press Check now to try again', amber: true }]
  const parts: LinePart[] = [{ text: c.checkedAt ? `Checked ${date(c.checkedAt)}` : 'Checked' }]
  if (c.nextCheckAt) parts.push({ text: `read again ${date(c.nextCheckAt)}` })
  if (c.last.notChecked > 0) parts.push({ text: `${c.last.notChecked} part${c.last.notChecked === 1 ? '' : 's'} not checked`, amber: true })
  return parts
}

/** The drawer (owner, unless marked). */
export const NOT_CHECKED_YET = 'Not checked yet.'
export const checkingSections = (done: number, total: number) => `Checking ${done} of ${counted(total, 'section')}…`
export const readAgainNote = (date: string) =>
  `We will read this handbook again on ${date}. Changed it before then? Add the new version, or press Check now.`
export const PART_NOT_CHECKED = "We could not check this part. That's on our side, not yours. Press Check now to try again."
/** Proposed (Step 8 part 2): the whole check failed, in the drawer; and the earlier check's heading while one runs. */
export const CHECK_FAILED = "We could not finish checking this handbook. That's on our side, not yours. Press Check now to try again."
export const earlierCheckHeading = (date: string) => `Your last check · ${date}`
/** On an OLDER version's drawer, in EVERY case — in place of the read-again note and of "Not checked yet" (owner, Step 9). */
export const OLDER_VERSION_NOTE = 'This is an older version. Only the current version is checked.'
/** A check stored before 8 October: its sections' words, as they were shown (owner, Step 8). */
export const LEGACY_WORD: Record<string, string> = {
  needs_change: 'Needs a change', no_gap: 'No gap found', to_confirm: 'To confirm', company_choice: 'Company choice',
}

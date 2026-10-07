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
export function statusWords(status: string, reason: string | null): string {
  if (status === 'uploaded') return 'Waiting to be read'
  if (status === 'reading') return 'Reading…'
  if (status === 'read') return 'Read'
  if (status === 'could_not_read') return `Could not read — ${reason ?? ''}`.trim()
  return status
}

export interface HandbookRow {
  id: string; name: string; file_name: string; file_path: string
  scope: 'company' | 'site'; entity_id: string | null
  status: string; status_reason: string | null
  version_of: string | null; is_current: boolean; created_at: string
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

/** When an older version was replaced: the moment the version that names it was saved. Null if none does. */
export function replacedAt(older: HandbookRow, all: HandbookRow[]): string | null {
  return all.find((h) => h.version_of === older.id)?.created_at ?? null
}

/** Current handbooks grouped as the tab shows them: "Every site" first, then each site by name, then
 *  "Site removed" (scope 'site' whose site was deleted). Empty groups are left out. */
export function groupBySite(current: HandbookRow[], sites: Array<{ id: string; name: string }>):
    Array<{ key: string; label: string; removed: boolean; rows: HandbookRow[] }> {
  const groups: Array<{ key: string; label: string; removed: boolean; rows: HandbookRow[] }> = []
  const every = current.filter((h) => h.scope === 'company')
  if (every.length) groups.push({ key: 'every', label: 'Every site', removed: false, rows: every })
  for (const s of [...sites].sort((a, b) => a.name.localeCompare(b.name))) {
    const rows = current.filter((h) => h.scope === 'site' && h.entity_id === s.id)
    if (rows.length) groups.push({ key: s.id, label: s.name, removed: false, rows })
  }
  const removed = current.filter((h) => h.scope === 'site' && (!h.entity_id || !sites.some((s) => s.id === h.entity_id)))
  if (removed.length) groups.push({ key: 'removed', label: 'Site removed', removed: true, rows: removed })
  return groups
}

/**
 * A HANDBOOK CHECK, READ FOR THE SCREEN — HR Baseline Step 1 (8 October 2026).
 *
 * The page reads the check's rows AS THE PERSON (066: SELECT on every check table, RLS on company) and this file
 * turns them into what the Handbooks row and the drawer show. Since the baseline a check is a list of PARTS: each
 * part is one stored HR answer (072's answer_text, answer_sources), or one failed stretch of sections. A check
 * stored before 8 October has no answers; it is shown as it was stored — its sections, their words and findings —
 * so nothing anybody saw is lost. `checkParts` is pure: the row's count is computed in code from stored rows.
 *
 * No model module here: the page imports it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export interface PartSource { n: number; title: string; url: string; label?: string; kind?: string; quote?: string }
export type CheckPart =
  | { kind: 'answer'; text: string; sources: PartSource[] }
  | { kind: 'failed' }
  /** A check from before 8 October: one section, its word and its findings, as stored. */
  | { kind: 'legacy'; title: string; word: string | null; failed: boolean; findings: Array<{ title: string; why: string | null; what_to_change: string | null }> }

export interface RowIn { id: string; section_id: string | null; kind: string; status: string; word: string | null; answer_text: string | null; answer_sources: PartSource[] | null }

/**
 * THE PARTS OF ONE CHECK, in handbook order. An answer row starts a part; a done row without an answer belongs to
 * the part before it (it was in the same call); a run of failed rows is ONE part that could not be checked; a
 * cancelled row is nobody's. A check with no answer at all is from before the baseline: shown section by section.
 */
export function checkParts(rows: RowIn[], position: (sectionId: string | null) => number,
  title: (sectionId: string | null) => string, findingsOf: (rowId: string) => Array<{ title: string; why: string | null; what_to_change: string | null }>): CheckPart[] {
  const ordered = rows.filter((r) => r.kind === 'section' && r.status !== 'cancelled').sort((a, b) => position(a.section_id) - position(b.section_id))
  // A check from before the baseline has words on its rows and no answers. A baseline check whose every part failed
  // has neither: it is NOT drawn section by section (owner, 8 October) — its failed parts fold into one, below.
  if (!ordered.some((r) => r.answer_text) && ordered.some((r) => r.word != null)) {
    return ordered.map((r) => ({ kind: 'legacy' as const, title: title(r.section_id), word: r.word, failed: r.status === 'failed', findings: findingsOf(r.id) }))
  }
  const parts: CheckPart[] = []
  for (const r of ordered) {
    if (r.status === 'failed') {
      if (parts[parts.length - 1]?.kind !== 'failed') parts.push({ kind: 'failed' })
    } else if (r.answer_text) {
      parts.push({ kind: 'answer', text: r.answer_text, sources: r.answer_sources ?? [] })
    }
  }
  return parts
}

/** A check that failed shows only the failed-check line (owner, 8 October): no parts under it. */
export const partsToShow = (status: 'done' | 'failed', parts: CheckPart[]): CheckPart[] => (status === 'failed' ? [] : parts)

export const partsNotChecked = (parts: CheckPart[]) => parts.filter((p) => p.kind === 'failed' || (p.kind === 'legacy' && p.failed)).length

interface CheckIn { id: string; handbook_id: string; status: string; done_count: number; section_count: number; created_at: string; finished_at: string | null }
const CHECK_COLUMNS = 'id, handbook_id, status, done_count, section_count, created_at, finished_at'
const ROW_COLUMNS = 'id, check_id, section_id, kind, status, word, answer_text, answer_sources'

/** The newest open check, and the newest finished one that was not cancelled. */
function pick(checks: CheckIn[]) {
  return {
    open: checks.find((c) => c.status === 'queued' || c.status === 'checking') ?? null,
    last: checks.find((c) => c.status === 'done' || c.status === 'failed') ?? null,
  }
}

export interface RowCheckState {
  open: { done: number; total: number } | null
  last: { status: 'done' | 'failed'; notChecked: number } | null
}

/** For the Handbooks rows: per handbook, its open check's progress, and how many parts of its last check failed. */
export async function loadRowChecks(db: Db, handbookIds: string[]): Promise<Record<string, RowCheckState>> {
  const out: Record<string, RowCheckState> = {}
  if (!handbookIds.length) return out
  const { data } = await db.from('handbook_checks').select(CHECK_COLUMNS).in('handbook_id', handbookIds).order('created_at', { ascending: false })
  const checks = (data ?? []) as CheckIn[]
  const lasts: CheckIn[] = []
  for (const id of handbookIds) {
    const { open, last } = pick(checks.filter((c) => c.handbook_id === id))
    out[id] = { open: open ? { done: open.done_count, total: open.section_count } : null,
      last: last ? { status: last.status === 'failed' ? 'failed' : 'done', notChecked: 0 } : null }
    if (last) lasts.push(last)
  }
  if (lasts.length) {
    const [{ data: rows }, { data: secs }] = await Promise.all([
      db.from('handbook_check_sections').select(ROW_COLUMNS).in('check_id', lasts.map((c) => c.id)),
      db.from('handbook_sections').select('id, position').in('handbook_id', lasts.map((c) => c.handbook_id)),
    ])
    const pos = new Map(((secs ?? []) as Array<{ id: string; position: number }>).map((s) => [s.id, s.position]))
    for (const c of lasts) {
      const mine = ((rows ?? []) as Array<RowIn & { check_id: string }>).filter((r) => r.check_id === c.id)
      out[c.handbook_id].last!.notChecked = partsNotChecked(checkParts(mine, (id) => pos.get(id ?? '') ?? 1e9, () => '', () => []))
    }
  }
  return out
}

export interface CheckView {
  open: { done: number; total: number } | null
  last: { status: 'done' | 'failed'; finishedAt: string | null; parts: CheckPart[] } | null
}

/** For the drawer: the open check's progress, and the last finished check as its parts. */
export async function loadCheckView(db: Db, handbookId: string): Promise<CheckView> {
  const { data } = await db.from('handbook_checks').select(CHECK_COLUMNS).eq('handbook_id', handbookId).order('created_at', { ascending: false })
  const { open, last } = pick((data ?? []) as CheckIn[])
  const openOut = open ? { done: open.done_count, total: open.section_count } : null
  if (!last) return { open: openOut, last: null }
  const [{ data: rows }, { data: secs }, { data: finds }] = await Promise.all([
    db.from('handbook_check_sections').select(ROW_COLUMNS).eq('check_id', last.id),
    db.from('handbook_sections').select('id, position, title').eq('handbook_id', handbookId),
    db.from('handbook_findings').select('check_section_id, title, why, what_to_change, created_at').eq('check_id', last.id).order('created_at'),
  ])
  const sec = new Map(((secs ?? []) as Array<{ id: string; position: number; title: string | null }>).map((s) => [s.id, s]))
  const parts = checkParts((rows ?? []) as RowIn[], (id) => sec.get(id ?? '')?.position ?? 1e9,
    (id) => sec.get(id ?? '')?.title ?? 'Untitled section',
    (rowId) => ((finds ?? []) as Array<{ check_section_id: string; title: string; why: string | null; what_to_change: string | null }>)
      .filter((f) => f.check_section_id === rowId).map((f) => ({ title: f.title, why: f.why, what_to_change: f.what_to_change })))
  const status = last.status === 'failed' ? 'failed' as const : 'done' as const
  return { open: openOut, last: { status, finishedAt: last.finished_at, parts: partsToShow(status, parts) } }
}

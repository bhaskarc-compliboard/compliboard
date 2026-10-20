/**
 * WHAT AN AUDIT RUN IS CALLED — lifted out of `app/audits/page.tsx` at Dashboard step 6, so the
 * Dashboard's "Recent audits" and the Audits page's "Past audits" cannot call the same run two
 * different things.
 *
 * Moved, not rewritten: `runName` is `app/audits/page.tsx`'s own expression and `checklistTitle`
 * is its own function, both with their reasoning intact. The Audits page now imports them, which
 * is the point — this file exists because the project has already paid for the alternative once.
 * `lib/documentStatus.ts` carries the note about the FOUR copies of `KIND_WORD` that disagreed
 * about whether a supplier's document is a "Supplier document" or a "Supplier's document".
 *
 * Nothing here reads a database. A caller that has a template run's document title passes it; a
 * caller that does not passes nothing and gets the fallback, which is deliberately a noun and
 * never an id.
 */

/** What a multi-agency run is called, and the fallback when an agency run has no label. */
export const ALL_AGENCIES = 'All agencies'

/** The least a run can be called. Never an id, and never `ALL_AGENCIES` — see `runName`. */
export const A_CHECKLIST = 'your checklist'

/** As much of an `audit_runs` row as naming it needs. */
export interface NameableRun {
  kind: string
  scope: string | null
  agency_label: string | null
  section_count: number
  template_document_id: string | null
}

/**
 * The checklist's own title, from the document it is. Falls back to the run's scope and then to a
 * plain noun — never to an id, and never to "All agencies", which is what a template run's
 * `agency_label` is empty of (Audits Run 5a, item 3).
 */
export function checklistTitle(run: Pick<NameableRun, 'scope'>, documentTitle?: string | null): string {
  return documentTitle ?? run.scope ?? A_CHECKLIST
}

/**
 * *** A TEMPLATE RUN IS NAMED BY ITS CHECKLIST. *** Its `agency_label` is null — its questions
 * came from a form — and the fallback used to read "All agencies", which is the one thing it is
 * not.
 *
 * An agency run against several agencies at once is "All agencies"; against one, it is that
 * agency's own label.
 */
export function runName(run: NameableRun, documentTitle?: string | null): string {
  if (run.kind === 'template') return `Against ${checklistTitle(run, documentTitle)}`
  return run.section_count > 1 ? ALL_AGENCIES : (run.agency_label ?? ALL_AGENCIES)
}

/** The columns `runName` and the Dashboard's row need from `audit_runs`. */
export const AUDIT_RUN_ROW_COLUMNS =
  'id, kind, scope, agency_label, section_count, template_document_id, entity_id, status, finished_at, created_at'

/**
 * *** "DONE" IS A STATUS, AND A DISMISSED RUN IS STILL DONE — decision 7. ***
 * `audit_runs.status` is one of `queued`, `running`, `done` (migration's `audit_runs_status_check`,
 * `docs/SCHEMA.md`). Dismissing is a separate column, `dismissed_at`, and it means "stop showing me
 * the banner", not "this did not happen". The work was done, so the run counts.
 */
export const AUDIT_DONE = 'done'

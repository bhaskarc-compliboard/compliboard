/**
 * THE BUTTONS — one file for the four class strings the workspace uses (HR Step 3a, `docs/HR-PLAN.md`
 * decision 1; `DESIGN.md` §4 says one file "is owed (§7)"). Moved out of `app/compliance/page.tsx`
 * character for character; the workspace and HR import them from here, so the two can never drift.
 *
 * They were copied from Audits (Workspace layout, Task 2): where `DESIGN.md` and Audits disagreed,
 * Audits won. **Audits, Company information and the report components still keep their own copies**
 * (`app/audits/page.tsx:155–157` `ACTION_PRIMARY`; `app/company-information/page.tsx:137`; inline in
 * `components/AuditReport.tsx` and `components/DocumentReport.tsx`). Decision 1 does not touch them;
 * they are for the app-wide sweep.
 */

/** `app/audits/page.tsx:155–157`, ACTION_PRIMARY. */
export const PRIMARY =
  'cursor-pointer rounded-md bg-[var(--green)] px-4 py-2 text-[14px] font-medium text-white ' +
  'hover:bg-[var(--green-ink)] disabled:cursor-not-allowed disabled:opacity-50'
/** PRIMARY's box, outlined. Used ONLY beside PRIMARY on the first visit, so the pair is one size. */
export const SECONDARY_LARGE =
  'cursor-pointer rounded-md border border-[var(--green)] px-4 py-2 text-[14px] font-medium text-[var(--green)] ' +
  'hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50'
/** `components/AuditReport.tsx:656`, the footer's "Audit again". */
export const OUTLINE =
  'rounded-md border border-[var(--green)] px-3 py-1.5 text-[14px] font-medium text-[var(--green)] hover:bg-green-50 disabled:opacity-50'
/** `components/AuditReport.tsx:660`, the footer's text actions. */
export const TEXT_ACTION = 'text-[14px] text-gray-600 hover:text-gray-900 hover:underline disabled:text-gray-300'

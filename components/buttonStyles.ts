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
/**
 * *** PRIMARY AT THE HERO'S SIZE — public pages step 15. ***
 *
 * The public homepage's one button is PRIMARY in every respect but its size: 13px/22px of
 * padding and 15px text, because a 14px button sized for a toolbar reads as a control on a page
 * whose headline is 60px serif. It is a STRING HERE rather than three classes added at the call
 * site, because `px-4` and `px-[22px]` are the same Tailwind utility twice and which one wins is
 * decided by the order Tailwind happens to emit them in, not by the order they are written in —
 * a button that is the right size today and the wrong size after an unrelated build.
 *
 * 15px is on the scale (`DESIGN.md` §1 — the seventh size, set deliberately), so this adds a
 * size of button, not a size of type. Nothing in the app uses it; the public pages do.
 */
export const PRIMARY_LARGE =
  'cursor-pointer rounded-md bg-[var(--green)] px-[22px] py-[13px] text-[15px] font-medium text-white ' +
  'hover:bg-[var(--green-ink)] disabled:cursor-not-allowed disabled:opacity-50'
/**
 * *** PRIMARY AT A DRAWN CARD'S SIZE — public pages step 16. ***
 *
 * The same button again, smaller: 7px/12px of padding and 13px text, because the public pages'
 * cards are drawings of the app at about two-thirds scale and a 14px button inside one reads as
 * the page's button rather than the card's. A STRING HERE for the reason PRIMARY_LARGE is one —
 * `px-4` and `px-3` are the same utility twice, and which of them wins is decided by the order
 * Tailwind emits them in, not the order they are written in.
 *
 * On the public pages it is worn by a <span>, not a button, and the call site adds
 * `pointer-events-none`: the card is a picture, and a hover state on a picture is a promise.
 */
export const PRIMARY_SMALL =
  'cursor-pointer rounded-md bg-[var(--green)] px-3 py-[7px] text-[13px] font-medium text-white ' +
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

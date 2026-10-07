/**
 * THE HR PREVIEW SWITCH — HR Step 4 (`docs/HR-PLAN.md` decision 32).
 *
 * The new HR page lives at /hr/new and exists ONLY where `HR_PREVIEW=1` is set: the owner's own
 * `.env.local`, never Vercel. So on production /hr/new is a 404, and every HR route added before the
 * release answers 404 the same way. In step 11 the page moves to /hr, old HR is deleted, and this goes.
 *
 * *** A SERVER VARIABLE, READ AT REQUEST TIME. *** Not `NEXT_PUBLIC_`: a public variable is inlined into
 * the browser bundle at build. Callers `await connection()` first (Next 16,
 * `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`), so the value is read when
 * the page is requested, not frozen when it is built. Exactly '1' turns it on; anything else is off.
 */
export function hrPreviewOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.HR_PREVIEW === '1'
}

/**
 * /hr/new — THE NEW HR PAGE, BEHIND THE PREVIEW SWITCH (HR Step 4, `docs/HR-PLAN.md` decision 32).
 *
 * A SERVER page: it decides whether the page exists at all, then renders the client body. Without
 * `HR_PREVIEW=1` in the server's environment it is a 404 — on production, where the variable is never
 * set, /hr/new does not exist. `connection()` makes the check run per request, not at build.
 * Old HR (`app/hr/page.tsx`) is untouched; the sidebar still points there, and nothing links here.
 */
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { hrPreviewOn } from '@/lib/hrPreview'
import HrWorkspace from './HrWorkspace'

export default async function HrNewPage() {
  await connection()
  if (!hrPreviewOn()) notFound()
  return <HrWorkspace />
}

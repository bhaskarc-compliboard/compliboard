/**
 * /hr — THE HR WORKSPACE (HR Step 13, the go-live; `docs/HR-PLAN.md`, `docs/TEST-AT-FINISH-LINE.md` HR H).
 *
 * The page built behind the preview switch at /hr/new, now at /hr for everyone. Old HR (decision 15) is retired:
 * its page body, `/api/hr`, `/api/hr-audits` and its prompt are deleted; the `hr_audits` table stays, in account
 * delete and export. The body is the client component; the email's `?handbook=<id>` link opens its drawer.
 */
import HrWorkspace from './HrWorkspace'

export default function HrPage() {
  return <HrWorkspace />
}

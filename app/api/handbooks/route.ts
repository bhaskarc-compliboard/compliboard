// HR's handbooks — saving one, and deleting one. HR Step 5a (`docs/HR-PLAN.md` decisions 18, 24, 32).
//
// A handbook is HR's own row in `handbooks` (migration 066), NEVER a `documents` row: it does not appear in
// Company Documents, the Documents sweep, the dashboard or Audits (decision 18). The file is in the same
// bucket at <company>/handbooks/<file>, two levels (`lib/storage.ts` handbookPath), so migration 002's
// storage policies and account delete's storage walk cover it unchanged.
//
// THE PATTERN IS app/api/documents/route.ts: requireCompany(), the caller's own client (`authed.db`) so RLS
// applies to the row AND the storage object, the company and the uploader taken from the session — never
// from the body — and a 404, not a 403, for any id that is not this company's.
//
// READING (step 5b): right after a row is saved, the handbook is claimed ('reading') and read in `after()`,
// so the reading survives the tab closing — `lib/handbookStart.ts` starts it, `lib/handbookRead.ts` has the
// claim, the order and the one write. "Read it again" is `app/api/handbooks/read`.
import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { DOCUMENTS_BUCKET } from '@/lib/storage'
import { saveHandbookRow, setHandbookSite } from '@/lib/handbookSave'
import { deleteHandbookVersion } from '@/lib/handbookDelete'
import { startReading } from '@/lib/handbookStart'

// The reading runs after the reply, up to this long (Vercel `waitUntil`); copied from the summarise route.
export const maxDuration = 800

// POST — save the row for a file already stored at handbookPath().
//   { file_path, file_name, mime_type, size_bytes, scope, entity_id }        a new handbook
//   { file_path, file_name, mime_type, size_bytes, version_of }              a newer version of one (keeps its name, scope and site)
export async function POST(request: NextRequest) {
  await connection()
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    // The two writes, and why their order matters, are in `lib/handbookSave.ts`.
    const result = await saveHandbookRow(db, companyId, userId, await request.json())
    if (result.json.older_not_replaced) console.error('handbooks: newer version saved, older still current:', result.json.id)
    if (result.status === 200 && typeof result.json.id === 'string') {
      // Claimed BEFORE the reply, so the row already says "Reading…" when the page reloads its list.
      await startReading(db, companyId, result.json.id)
    }
    return NextResponse.json(result.json, { status: result.status })
  } catch (error) {
    console.error('handbooks POST failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save handbook' }, { status: 500 })
  }
}

// PATCH { id, scope, entity_id } — "Choose where it applies" (HR Step 11a): a handbook whose site was deleted is
// given a site again, or every site; its older versions with it, so the versions stay together (`lib/handbookSave.ts`).
export async function PATCH(request: NextRequest) {
  await connection()
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth
    const result = await setHandbookSite(db, companyId, await request.json())
    return NextResponse.json(result.json, { status: result.status })
  } catch (error) {
    console.error('handbooks PATCH failed:', error)
    return NextResponse.json({ error: 'We could not save where it applies just now. Please try again.' }, { status: 500 })
  }
}

// DELETE ?id= — the row and its stored file. Its sections, checks, findings and dates go with the row
// (ON DELETE CASCADE, migration 066); a calendar event made from one of its dates stays, unlinked
// (ON DELETE SET NULL). Older versions stay, each its own row; when the current one goes, the version it
// replaced becomes current again, and a newer version that named this one now names the one before it.
export async function DELETE(request: NextRequest) {
  await connection()
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    // The order of the four writes, and why the chain is relinked first, is in `lib/handbookDelete.ts`.
    const result = await deleteHandbookVersion(db, DOCUMENTS_BUCKET, companyId, id)
    return NextResponse.json(result.json, { status: result.status })
  } catch (error) {
    console.error('handbooks DELETE failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete handbook' }, { status: 500 })
  }
}

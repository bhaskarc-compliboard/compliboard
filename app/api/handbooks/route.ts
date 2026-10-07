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
// *** BEHIND THE PREVIEW SWITCH. *** Every handler answers 404 unless HR_PREVIEW=1 (decision 32), before it
// reads the session, so on production — where the variable is never set — this route does not exist.
//
// Nothing here reads the file. Every handbook is saved at status 'uploaded'; reading it is step 5b.
import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { hrPreviewOn } from '@/lib/hrPreview'
import { DOCUMENTS_BUCKET } from '@/lib/storage'
import { saveHandbookRow } from '@/lib/handbookSave'

const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 })

// POST — save the row for a file already stored at handbookPath().
//   { file_path, file_name, mime_type, size_bytes, scope, entity_id }        a new handbook
//   { file_path, file_name, mime_type, size_bytes, version_of }              a newer version of one (keeps its name, scope and site)
export async function POST(request: NextRequest) {
  await connection()
  if (!hrPreviewOn()) return notFound()
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    // The two writes, and why their order matters, are in `lib/handbookSave.ts`.
    const result = await saveHandbookRow(db, companyId, userId, await request.json())
    if (result.json.older_not_replaced) console.error('handbooks: newer version saved, older still current:', result.json.id)
    return NextResponse.json(result.json, { status: result.status })
  } catch (error) {
    console.error('handbooks POST failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save handbook' }, { status: 500 })
  }
}

// DELETE ?id= — the row and its stored file. Its sections, checks, findings and dates go with the row
// (ON DELETE CASCADE, migration 066); a calendar event made from one of its dates stays, unlinked
// (ON DELETE SET NULL). Older versions stay, each its own row; when the current one goes, the version it
// replaced becomes current again, and a newer version that named this one now names the one before it.
export async function DELETE(request: NextRequest) {
  await connection()
  if (!hrPreviewOn()) return notFound()
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: row } = await db.from('handbooks')
      .select('id, company_id, file_path, version_of, is_current').eq('id', id).maybeSingle()
    if (!row || row.company_id !== companyId) return NextResponse.json({ error: 'Handbook not found' }, { status: 404 })

    // The file first, as Documents does: if storage refuses, nothing in the database has changed.
    const { error: removeError } = await db.storage.from(DOCUMENTS_BUCKET).remove([row.file_path])
    if (removeError) throw removeError

    // Keep the version chain whole: whatever named this one as its older version now names the one before.
    const { error: relinkErr } = await db.from('handbooks').update({ version_of: row.version_of }).eq('version_of', id)
    if (relinkErr) throw relinkErr

    const { error: delErr } = await db.from('handbooks').delete().eq('id', id).eq('company_id', companyId)
    if (delErr) throw delErr

    // The current one went: the version it replaced is current again.
    if (row.is_current && row.version_of) {
      const { error: curErr } = await db.from('handbooks').update({ is_current: true }).eq('id', row.version_of)
      if (curErr) throw curErr
    }
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('handbooks DELETE failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete handbook' }, { status: 500 })
  }
}

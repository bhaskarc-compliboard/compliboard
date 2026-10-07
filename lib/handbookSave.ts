/**
 * SAVING A HANDBOOK'S ROW — HR Step 5a (`docs/HR-PLAN.md` decisions 8, 18). Called by
 * `app/api/handbooks/route.ts` with the caller's own client (RLS applies); held by
 * `tests/unit/handbookSave.test.ts` with a stand-in client, which is how the second write's failure is
 * proved — that write happens on the server, where no browser can make it fail.
 *
 * A NEWER VERSION keeps the handbook's NAME and its scope and site, all read from the older row, never the
 * body (owner, 7 October 2026). Only its file — `file_name`, `file_path` — is new.
 *
 * TWO WRITES, IN THIS ORDER: the newer row is saved first, then the older one stops being current. If the
 * second fails, both stay current and both are shown, and the person is told (`OLDER_NOT_REPLACED`). Neither
 * is ever lost.
 */
import { nameFromFile, isOwnHandbookPath } from './handbooks.ts'

type Db = { from: (t: string) => any }   // eslint-disable-line @typescript-eslint/no-explicit-any

export interface SaveBody {
  file_path?: string; file_name?: string; mime_type?: string | null; size_bytes?: number | null
  scope?: string; entity_id?: string | null; version_of?: string | null
}
export type SaveResult = { status: number; json: Record<string, unknown> }

export async function saveHandbookRow(db: Db, companyId: string, userId: string, body: SaveBody): Promise<SaveResult> {
  const { file_path, file_name, mime_type, size_bytes, version_of } = body
  if (!file_path || !file_name) return { status: 400, json: { error: 'Missing file_path or file_name' } }
  // The row may only point at this company's own handbooks folder, two levels deep.
  if (!isOwnHandbookPath(file_path, companyId)) return { status: 403, json: { error: 'File path does not belong to your company' } }

  let name = nameFromFile(String(file_name))
  let scope: 'company' | 'site'
  let entityId: string | null
  let olderId: string | null = null

  if (version_of) {
    const { data } = await db.from('handbooks').select('id, name, scope, entity_id').eq('id', version_of).maybeSingle()
    if (!data) return { status: 404, json: { error: 'That handbook was not found.' } }
    olderId = data.id
    name = data.name                       // the handbook keeps its name
    scope = data.scope
    entityId = data.entity_id
  } else {
    scope = body.scope === 'site' ? 'site' : 'company'
    entityId = scope === 'site' ? (body.entity_id ?? null) : null
    if (scope === 'site') {
      if (!entityId) return { status: 400, json: { error: 'A site handbook needs its site.' } }
      const { data: site } = await db.from('entities').select('id').eq('id', entityId).eq('company_id', companyId).maybeSingle()
      if (!site) return { status: 404, json: { error: 'Site not found' } }
    }
  }

  const { data: inserted, error } = await db.from('handbooks').insert({
    company_id: companyId, name, file_path, file_name,
    mime_type: mime_type ?? null, size_bytes: typeof size_bytes === 'number' ? size_bytes : null,
    scope, entity_id: entityId, version_of: olderId, is_current: true, status: 'uploaded', uploaded_by: userId,
  }).select('id').single()
  if (error) throw error

  if (olderId) {
    const { error: oldErr } = await db.from('handbooks').update({ is_current: false }).eq('id', olderId)
    if (oldErr) return { status: 200, json: { id: inserted.id, older_not_replaced: true } }
  }
  return { status: 200, json: { id: inserted.id } }
}

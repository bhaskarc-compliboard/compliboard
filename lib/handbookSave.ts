/**
 * SAVING A HANDBOOK'S ROW — HR Step 5a (`docs/HR-PLAN.md` decisions 8, 18). Called by
 * `app/api/handbooks/route.ts` with the caller's own client (RLS applies); held by
 * `tests/unit/handbookSave.test.ts` with a stand-in client, which is how the second write's failure is
 * proved — that write happens on the server, where no browser can make it fail.
 *
 * A NEWER VERSION keeps the handbook's NAME and its scope and site, all read from the older row, never the
 * body (owner, 7 October 2026). Only its file — `file_name`, `file_path` — is new.
 *
 * *** THE OLDER VERSION IS NOT SWITCHED OFF HERE — fix list H4, root R5, Job E. ***
 *
 * It used to be: the newer row went in `is_current: true` and the older one was set `is_current: false` in
 * the same request, **before the new file had been read.** If that read then failed — a scan, a .doc, a rate
 * limit — a company with one handbook was told *"None of your handbooks could be read"*
 * (`lib/hrAnswerWords.ts`), because answers use current versions only (`lib/hrAnswer.ts:119`); the older
 * version's open check was cancelled as replaced (`lib/handbookCheck.ts:290`); and the nightly job checked
 * neither, because it wants a version that is current AND read (`:550`). The company's handbook was still
 * there and still readable. Nothing could reach it.
 *
 * So the switch happens where the new version succeeds: `lib/handbookRead.ts`, on the write that sets
 * `status: 'read'`. Until then **both are current**, which is a state this product already supports and
 * already renders — `olderVersions` skips a current row, so the list shows the two side by side — and the
 * one in use is the one that can be read. R5's rule in one line: switch over once the new thing has
 * succeeded, never before.
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

  // No second write. `version_of` records which version this replaces; `lib/handbookRead.ts` is what
  // retires it, once this file has been read.
  return { status: 200, json: { id: inserted.id, replaces: olderId } }
}

/**
 * "CHOOSE WHERE IT APPLIES" — HR Step 11a. A handbook whose site was deleted keeps scope 'site' with no site (066), so
 * it never silently becomes company-wide; this is where the person says where it applies now. Sets scope and site on
 * the handbook AND every older version below it (the version_of chain), so the versions stay together. As the person
 * (RLS: their own rows); a site must be this company's (a 404 otherwise, as for a handbook of another company).
 */
/** The refusal for an older version (proposed words, for the owner's yes). */
export const ONLY_CURRENT_MOVES = 'Only the current version of a handbook can be given a site. Open the current version and choose there.'

export async function setHandbookSite(db: Db, companyId: string, body: { id?: string; scope?: string; entity_id?: string | null }): Promise<SaveResult> {
  const { id } = body
  if (!id) return { status: 400, json: { error: 'Missing id' } }
  const scope: 'company' | 'site' = body.scope === 'site' ? 'site' : 'company'
  const entityId = scope === 'site' ? (body.entity_id ?? null) : null
  if (scope === 'site') {
    if (!entityId) return { status: 400, json: { error: 'A site handbook needs its site.' } }
    const { data: site } = await db.from('entities').select('id').eq('id', entityId).eq('company_id', companyId).maybeSingle()
    if (!site) return { status: 404, json: { error: 'Site not found' } }
  }
  const { data: start } = await db.from('handbooks').select('id, version_of, is_current').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!start) return { status: 404, json: { error: 'That handbook was not found.' } }
  // Only from the NEWEST version in the chain (owner, Step 11a): the walk goes DOWN the chain, so starting from
  // an older version would leave the newer ones on no site and split the versions.
  //
  // *** THE TEST IS THE CHAIN, NOT `is_current` — H4, Job E. *** Between an upload and its reading both
  // versions are current, and `is_current` would then let a person set the site from the older one, which is
  // exactly the split this guard exists to prevent. "Newest" means nothing names it as the version it
  // replaces.
  const { data: newer } = await db.from('handbooks').select('id').eq('company_id', companyId)
    .eq('version_of', start.id).limit(1).maybeSingle()
  if (newer) return { status: 400, json: { error: ONLY_CURRENT_MOVES } }
  // The handbook, then each older version it names, down the chain (a guard against a loop in bad data).
  const ids: string[] = [start.id]
  let next: string | null = start.version_of
  while (next && !ids.includes(next) && ids.length < 100) {
    const { data: older } = await db.from('handbooks').select('id, version_of').eq('id', next).eq('company_id', companyId).maybeSingle()
    if (!older) break
    ids.push(older.id); next = older.version_of
  }
  const { data: updated, error } = await db.from('handbooks').update({ scope, entity_id: entityId }).in('id', ids).select('id')
  if (error) throw error
  return { status: 200, json: { updated: (updated ?? []).length, ids } }
}

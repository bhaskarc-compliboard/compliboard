/**
 * DELETING ONE HANDBOOK VERSION — HR Step 5a (`docs/HR-PLAN.md` decisions 8, 18). Called by
 * `app/api/handbooks/route.ts` with the caller's own client (RLS applies to the row AND the stored file);
 * held by `tests/unit/handbookDelete.test.ts` with a stand-in client.
 *
 * IN THIS ORDER, and why:
 *   1. The stored file. If storage refuses, nothing in the database has changed.
 *   2. THE CHAIN, KEPT WHOLE: whatever named this version as its older one now names this version's own older
 *      one. Without it, deleting a MIDDLE version would leave the newer one's `version_of` cleared by
 *      ON DELETE SET NULL, and nothing would point to the oldest version any more.
 *   3. The row. Its sections, checks, findings and dates cascade (migration 066); calendar events stay, unlinked.
 *   4. If it was the current version, the version it replaced is current again.
 */
type Db = { from: (t: string) => any; storage: { from: (b: string) => any } }   // eslint-disable-line @typescript-eslint/no-explicit-any

export type DeleteResult = { status: number; json: Record<string, unknown> }

export async function deleteHandbookVersion(db: Db, bucket: string, companyId: string, id: string): Promise<DeleteResult> {
  const { data: row } = await db.from('handbooks')
    .select('id, company_id, file_path, version_of, is_current').eq('id', id).maybeSingle()
  // 404, not 403, so ids cannot be probed.
  if (!row || row.company_id !== companyId) return { status: 404, json: { error: 'Handbook not found' } }

  const { error: removeError } = await db.storage.from(bucket).remove([row.file_path])
  if (removeError) throw removeError

  const { error: relinkErr } = await db.from('handbooks').update({ version_of: row.version_of }).eq('version_of', id)
  if (relinkErr) throw relinkErr

  const { error: delErr } = await db.from('handbooks').delete().eq('id', id).eq('company_id', companyId)
  if (delErr) throw delErr

  if (row.is_current && row.version_of) {
    const { error: curErr } = await db.from('handbooks').update({ is_current: true }).eq('id', row.version_of)
    if (curErr) throw curErr
  }
  return { status: 200, json: { deleted: true } }
}

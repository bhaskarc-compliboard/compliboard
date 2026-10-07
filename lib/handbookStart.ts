/**
 * START A HANDBOOK'S READING — HR Step 5b. One place, so the two ways in cannot drift: right after a
 * handbook is saved (`app/api/handbooks/route.ts` POST) and "Read it again" (`app/api/handbooks/read`).
 *
 * The claim is taken BEFORE the reply (so the list already says "Reading…" when the page reloads it), and
 * the reading runs in `after()`, so it survives the tab closing (CLAUDE.md §3.11). Server-only.
 */
import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './auth.ts'
import { DOCUMENTS_BUCKET } from './storage.ts'
import { claimReading, readHandbook, modelOutline } from './handbookRead.ts'

type Db = SupabaseClient<any, any, any>   // eslint-disable-line @typescript-eslint/no-explicit-any

/** True if this call took the claim and the reading was started; false if a reading already holds it. */
export async function startReading(db: Db, companyId: string, id: string): Promise<boolean> {
  const claimedAt = await claimReading(db, id)
  if (!claimedAt) return false
  after(async () => {
    const outcome = await readHandbook({ db, admin: supabaseAdmin, bucket: DOCUMENTS_BUCKET, outline: modelOutline(companyId) },
      companyId, id, claimedAt)
    console.log(`handbooks: reading ${id}: ${outcome}`)
  })
  return true
}

// "CHECK NOW" — HR Step 8, part 1 (the owner's answers to the Step 8 design).
//
// One press, one check: the check and its rows are written, 202 at once, and `after()` starts the sweep so the
// first pieces begin without waiting for a cron. The rest is the sweep's (`lib/handbookCheck.ts` sweepChecks).
//
// *** The person's session first. *** The handbook is read AS THE PERSON,
// so another company's id is a 404 like an unknown one. The check is written with the service-role client — a
// NAMED STATEMENT (CLAUDE.md §3.6): 066 grants a person SELECT only on the check tables, because the server
// writes them, as `app/api/audit-runs/route.ts` writes audit runs.
//
// *** A SECOND PRESS IS REFUSED BY THE DATABASE *** (071's idx_handbook_checks_one_open), not by a lookup two
// tabs could both pass: createCheck reads the unique violation and this route answers 409 with the owner's words.
import { NextRequest, NextResponse, after, connection } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { createCheck, sweepChecks, ALREADY_CHECKING, NOT_READ_YET, ONLY_NEWEST } from '@/lib/handbookCheck'

export const maxDuration = 800

const NOT_FOUND = 'That handbook was not found.'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connection()
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { db, companyId, userId } = authed.auth

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No handbook id given.' }, { status: 400 })

  try {
    // As the person: RLS decides whether this handbook is theirs.
    const { data: mine, error } = await db.from('handbooks').select('id').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!mine) return NextResponse.json({ error: NOT_FOUND }, { status: 404 })

    const made = await createCheck(supabaseAdmin, { companyId, handbookId: id, reason: 'on_demand', requestedBy: userId })
    if (!made.ok) {
      if (made.reason === 'already') return NextResponse.json({ error: ALREADY_CHECKING }, { status: 409 })
      if (made.reason === 'not_read') return NextResponse.json({ error: NOT_READ_YET }, { status: 409 })
      if (made.reason === 'not_current') return NextResponse.json({ error: ONLY_NEWEST }, { status: 409 })
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 })
    }

    after(async () => {
      try {
        const r = await sweepChecks(supabaseAdmin)
        console.log(`handbook check ${made.checkId}: kicked sweep — ${r.pieces} piece(s), ${r.rows_done} row(s) done, `
          + `${r.retried} to retry, ${r.failed} failed, ${r.checks_finished} check(s) finished`)
      } catch (e) {
        console.error('kicked handbook sweep failed:', e)
      }
    })
    return NextResponse.json({ status: 'started', check_id: made.checkId, rows: made.rows }, { status: 202 })
  } catch (e) {
    console.error(`handbook check ${id} could not start:`, e)
    return NextResponse.json({ error: 'We could not start the check just now. That is our side, not yours. Please try again.' }, { status: 500 })
  }
}

/**
 * DELETE /api/people/[id] — REMOVE A PERSON FROM THE COMPANY.
 *
 * *** REMOVING A PERSON MEANS REMOVING THEIR LOGIN, AND NOTHING ELSE. ***
 * `profiles.id` IS the `auth.users` id (migration 001; `/api/signup` inserts the profile with
 * `authData.user.id`), and `profiles` cascades from the login. So one `auth.admin.deleteUser` takes
 * the login and the profile together, and leaves every row the person ever wrote exactly where it
 * is — the documents they uploaded, the questions they answered, the audits they ran. That is what
 * the sheet promises in board 2's words: *"What they did here stays."* `/api/account` DELETE is the
 * other thing, and it is on a different tab behind a typed company name.
 *
 * *** TWO REFUSALS, AND THEY ARE DIFFERENT MISTAKES. ***
 *   · You may not remove YOURSELF here. A person who meant to leave has no way back in afterwards,
 *     and the thing they probably meant — deleting the company — is a deliberate flow of its own.
 *   · The LAST person at a company may not be removed by anybody. A company with no login is
 *     unreachable: nobody can sign in to fix it, download the data or delete it, and every row
 *     stays there forever with no way to ask us to remove it. Today the first rule implies the
 *     second (you cannot remove yourself, so you cannot empty a company of one) — it is enforced
 *     separately anyway, because the day roles or an admin remover arrive, the implication stops
 *     holding and this would be the failure nobody re-derived.
 *
 * The service role does the deletion, for the reason `/api/account` DELETE holds it: `deleteUser`
 * is an admin API call and there is no policy a person could satisfy instead. Everything that
 * decides WHETHER to delete is read as the caller first.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { CANNOT_REMOVE_SELF, CANNOT_REMOVE_LAST, REMOVE_FAILED } from '@/lib/peopleView'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  try {
    const { id } = await context.params

    if (id === userId) {
      return NextResponse.json({ error: CANNOT_REMOVE_SELF }, { status: 400 })
    }

    // Tenancy on the id BEFORE it reaches an admin call, and 404 rather than 403 so an id cannot be
    // probed by watching which error comes back (§3.6). Read as the caller, so the policy decides.
    const { data: target } = await db
      .from('profiles').select('id').eq('id', id).eq('company_id', companyId).maybeSingle()
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { count } = await db
      .from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    // A count that could not be read is not a number, and refusing is the safe half of the choice:
    // a wrong "go ahead" here leaves a company nobody can sign in to.
    if (typeof count !== 'number' || count <= 1) {
      return NextResponse.json({ error: CANNOT_REMOVE_LAST }, { status: 400 })
    }

    // The login goes, and `profiles` with it by cascade. Named statement, service role, because
    // `deleteUser` is an admin API call (§3.6).
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) {
      console.error('[/api/people/[id]] deleteUser failed:', error.message)
      return NextResponse.json({ error: REMOVE_FAILED }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[/api/people/[id]] failed:', error)
    return NextResponse.json({ error: REMOVE_FAILED }, { status: 500 })
  }
}

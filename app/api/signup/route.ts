import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Headcount arrives from a form as a string, or not at all. Anything that is not a
// whole number — '', undefined, a band like '26-75' from an older client — is NULL,
// not a guess. Every employment threshold in the library is a number (Oregon sick time
// at 10, OFLA at 25, FMLA at 50), so a band cannot be resolved and a fabricated number
// is worse than an admitted gap. DECISIONS.md §21.1.
function toHeadcount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

// Signup's only job: create the account and save the company + industry info.
// No folder or file creation of any kind — structure appears later from what the
// user actually does (guided demo, uploads, drive connection). Impose nothing.
export async function POST(request: NextRequest) {
  try {
    const { email, password, companyName, industry, state, county, city, employeeCount, websiteUrl, scanResult } = await request.json()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) throw authError
    if (!authData.user) throw new Error('Signup failed')

    /**
     * *** O5 (fix list §4, Job E4): THERE WAS NO WAY BACK. ***
     *
     * The login is created first, then the company, then the profile — and if either of the last
     * two failed, the login was left behind with **no company and no profile**. `requireCompany`
     * finds no `profiles` row for it, so the person can sign in and reach nothing; and signing up
     * again answers **"already registered"**, because the login exists. A dead end, from one
     * refused insert, with no way out that does not involve us.
     *
     * The order cannot be changed — `profiles.id` IS the login's id, so the login must exist
     * first — so what is added is the way back: each failure undoes what this request made, newest
     * first, and the person is told to try again. `auth.admin.deleteUser` is the one call that can,
     * and it is the same call `/api/account` DELETE uses (§3.6's named-statement rule).
     *
     * An undo that itself fails is LOUD: the half-made account is named in the log with both ids,
     * because that is the one case somebody has to clear by hand.
     */
    const undoLogin = async (why: string) => {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(authData.user!.id)
      if (error) {
        console.error(`SIGNUP LEFT A LOGIN WITH NO COMPANY — clear it by hand: `
          + `user ${authData.user!.id} (${email}). ${why}. The undo also failed: ${error.message}`)
      }
    }

    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        industry,
        state,
        county,
        city,
        // Headcount is an integer, never a band (DECISIONS.md §21.1, migration 006).
        // Signup does not ask for it, so it is genuinely unknown here — write NULL and
        // mean it. This used to write '' into a text column on every account created,
        // which is a value nobody chose and no threshold can be resolved against.
        employee_count: toHeadcount(employeeCount),
        website_url: websiteUrl || null,
        scan_result: scanResult || null,
      })
      .select()
      .single()
    if (companyError) {
      await undoLogin(`the company row was refused: ${companyError.message}`)
      throw companyError
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: authData.user.id, company_id: companyData.id, full_name: '' })
    if (profileError) {
      // The company row goes too: nobody is in it, and a company with no profile is a row that
      // every per-company sweep would pick up for ever.
      const { error: coErr } = await supabaseAdmin.from('companies').delete().eq('id', companyData.id)
      if (coErr) {
        console.error(`SIGNUP LEFT AN EMPTY COMPANY — clear it by hand: company ${companyData.id} `
          + `(${companyName}). ${coErr.message}`)
      }
      await undoLogin(`the profile was refused: ${profileError.message}`)
      throw profileError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}

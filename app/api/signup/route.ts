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
    if (companyError) throw companyError

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: authData.user.id, company_id: companyData.id, full_name: '' })
    if (profileError) throw profileError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}

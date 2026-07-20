import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      .insert({ name: companyName, industry, state, county, city, employee_count: employeeCount, website_url: websiteUrl || null, scan_result: scanResult || null })
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

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getFolders } from '@/lib/folderTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const INDUSTRY_LABELS: Record<string, string> = {
  'chemical-manufacturing': 'Chemical Manufacturing',
  'food-beverage-manufacturing': 'Food & Beverage Manufacturing',
  'restaurant': 'Restaurant / Food Service',
  'cannabis': 'Cannabis',
  'auto-body-dry-cleaners': 'Auto Body / Dry Cleaners',
  'wood-products-sawmills': 'Wood Products / Sawmills',
  'construction': 'Construction',
  'healthcare': 'Healthcare',
  'hospice': 'Hospice',
  'other': 'General',
}

const HR_FOLDERS = [
  'Employee Handbook',
  'HR Policies',
  'Offer Letters & Templates',
  'Training Records',
  'Employee Records',
]

const COMPLIANCE_LOG_FOLDERS = [
  'Folder Gap Reports',
  'Document Reviews',
  'Monthly Summaries',
]

export async function POST(request: NextRequest) {
  try {
    const { email, password, companyName, industry, state, county, city, employeeCount } = await request.json()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) throw authError
    if (!authData.user) throw new Error('Signup failed')

    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({ name: companyName, industry, state, county, city, employee_count: employeeCount })
      .select()
      .single()
    if (companyError) throw companyError

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: authData.user.id, company_id: companyData.id, full_name: '' })
    if (profileError) throw profileError

    // Create the default division folder named after their industry
    const divisionName = INDUSTRY_LABELS[industry] || 'General'
    const { data: divisionFolder, error: divisionError } = await supabaseAdmin
      .from('company_folders')
      .insert({
        company_id: companyData.id,
        name: divisionName,
        parent_id: null,
        sort_order: 0,
        section: 'files',
      })
      .select()
      .single()
    if (divisionError) throw divisionError

    // Create compliance folders inside the division
    const complianceFolders = getFolders(industry)
    const complianceInserts = complianceFolders.map((name, i) => ({
      company_id: companyData.id,
      name,
      parent_id: divisionFolder.id,
      sort_order: i,
      section: 'files',
    }))

    const { error: complianceError } = await supabaseAdmin
      .from('company_folders')
      .insert(complianceInserts)
    if (complianceError) throw complianceError

    // Create HR folders
    const hrInserts = HR_FOLDERS.map((name, i) => ({
      company_id: companyData.id,
      name,
      parent_id: null,
      sort_order: i,
      section: 'hr',
    }))
    const { error: hrError } = await supabaseAdmin
      .from('company_folders')
      .insert(hrInserts)
    if (hrError) throw hrError

    // Create Compliance Log folders
    const logInserts = COMPLIANCE_LOG_FOLDERS.map((name, i) => ({
      company_id: companyData.id,
      name,
      parent_id: null,
      sort_order: i,
      section: 'log',
    }))
    const { error: logError } = await supabaseAdmin
      .from('company_folders')
      .insert(logInserts)
    if (logError) throw logError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}

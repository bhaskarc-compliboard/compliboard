import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getFolders } from '@/lib/folderTemplates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const complianceFolders = getFolders(industry)
    const allFolderInserts = [
      ...complianceFolders.map((name, i) => ({
        company_id: companyData.id,
        name,
        parent_id: null,
        sort_order: i,
        section: 'files',
      })),
      ...HR_FOLDERS.map((name, i) => ({
        company_id: companyData.id,
        name,
        parent_id: null,
        sort_order: i,
        section: 'hr',
      })),
      ...COMPLIANCE_LOG_FOLDERS.map((name, i) => ({
        company_id: companyData.id,
        name,
        parent_id: null,
        sort_order: i,
        section: 'log',
      })),
    ]

    const { error: folderError } = await supabaseAdmin
      .from('company_folders')
      .insert(allFolderInserts)
    if (folderError) throw folderError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Signup failed' },
      { status: 500 }
    )
  }
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const INDUSTRY_FOLDERS: Record<string, string[]> = {
  'chemical-manufacturing': [
    'OSHA Safety',
    'SDS Sheets',
    'Environmental',
    'Shipping & Transport',
    'Permits & Licenses',
    'Training Records',
    'Inspection Reports',
    'Emergency Plans',
    'Waste Management',
  ],
  'restaurant': [
    'Food Safety',
    'Health Permits',
    'Alcohol License',
    'OSHA Safety',
    'Training Records',
    'Inspection Reports',
    'HR Documents',
  ],
  'food-beverage-manufacturing': [
    'Food Safety (FSMA/HACCP)',
    'OSHA Safety',
    'Environmental',
    'Permits & Licenses',
    'Training Records',
    'Inspection Reports',
    'Supplier Records',
  ],
  'cannabis': [
    'License & Permits',
    'Inventory Records',
    'OSHA Safety',
    'Pesticide Records',
    'Training Records',
    'Inspection Reports',
    'Security Plans',
  ],
  'auto-body-dry-cleaners': [
    'Hazardous Waste',
    'Air Quality',
    'OSHA Safety',
    'Permits & Licenses',
    'Training Records',
    'Inspection Reports',
    'Chemical Inventory',
  ],
  'wood-products-sawmills': [
    'OSHA Machinery Safety',
    'Air Quality',
    'Shipping & Transport',
    'Permits & Licenses',
    'Training Records',
    'Inspection Reports',
    'Equipment Records',
  ],
  'construction': [
    'OSHA Safety',
    'Permits & Licenses',
    'Training Records',
    'Inspection Reports',
    'Contracts',
    'Equipment Records',
    'HR Documents',
  ],
  'healthcare': [
    'HIPAA Compliance',
    'Licenses & Certifications',
    'OSHA Safety',
    'Training Records',
    'Inspection Reports',
    'HR Documents',
    'Insurance',
  ],
  'other': [
    'OSHA Safety',
    'Permits & Licenses',
    'Training Records',
    'Inspection Reports',
    'HR Documents',
    'General Documents',
  ],
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, companyName, industry, state, county, city, employeeCount } = await request.json()

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) throw authError
    if (!authData.user) throw new Error('Signup failed')

    // Create company
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        industry,
        state,
        county,
        city,
        employee_count: employeeCount,
      })
      .select()
      .single()
    if (companyError) throw companyError

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        company_id: companyData.id,
        full_name: '',
      })
    if (profileError) throw profileError

    // Create pre-populated folders based on industry
    const folders = INDUSTRY_FOLDERS[industry] || INDUSTRY_FOLDERS['other']
    const folderInserts = folders.map((name, index) => ({
      company_id: companyData.id,
      name,
      parent_id: null,
      sort_order: index,
    }))

    const { error: folderError } = await supabaseAdmin
      .from('company_folders')
      .insert(folderInserts)
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

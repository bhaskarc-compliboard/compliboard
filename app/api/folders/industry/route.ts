import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getFolders, INDUSTRY_FOLDERS } from '@/lib/folderTemplates'

const supabase = createClient(
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
  'other': 'Other',
}

export async function POST(request: NextRequest) {
  try {
    const { industry, parent_id } = await request.json()
    if (!industry) {
      return NextResponse.json({ error: 'Industry required' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = profile.company_id

    // Check existing folders at this level (root or inside a division)
    const existingQuery = supabase
      .from('company_folders')
      .select('name')
      .eq('company_id', companyId)

    if (parent_id) {
      existingQuery.eq('parent_id', parent_id)
    } else {
      existingQuery.is('parent_id', null)
    }

    const { data: existing } = await existingQuery
    const existingNames = new Set((existing || []).map(f => f.name))

    const folders = getFolders(industry)
    const toAdd = folders.filter(name => !existingNames.has(name))

    if (toAdd.length > 0) {
      const sortQuery = supabase
        .from('company_folders')
        .select('sort_order')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: false })
        .limit(1)

      if (parent_id) {
        sortQuery.eq('parent_id', parent_id)
      } else {
        sortQuery.is('parent_id', null)
      }

      const { data: existingAll } = await sortQuery
      const startOrder = existingAll?.[0]?.sort_order + 1 || existing?.length || 0

      const inserts = toAdd.map((name, i) => ({
        company_id: companyId,
        name,
        parent_id: parent_id || null,
        sort_order: startOrder + i,
        section: 'files',
      }))

      await supabase.from('company_folders').insert(inserts)
    }

    return NextResponse.json({
      added: toAdd.length,
      industryLabel: INDUSTRY_LABELS[industry] || industry,
    })
  } catch (error) {
    console.error('Add industry folders error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

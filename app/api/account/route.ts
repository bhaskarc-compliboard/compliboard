import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id, full_name')
      .eq('id', user_id)
      .single()

    if (!profile?.company_id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', profile.company_id)
      .single()

    return NextResponse.json({ data: { ...company, full_name: profile.full_name } })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user_id, full_name, companyName, industry, state, county, city, employeeCount } = await request.json()
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', user_id)
      .single()

    if (!profile?.company_id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { error: companyError } = await supabaseAdmin
      .from('companies')
      .update({
        name: companyName,
        industry,
        state,
        county,
        city,
        employee_count: employeeCount,
      })
      .eq('id', profile.company_id)

    if (companyError) throw companyError

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name })
      .eq('id', user_id)

    if (profileError) throw profileError

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', user_id)
      .single()

    if (profile?.company_id) {
      await supabaseAdmin.from('checklist_items')
        .delete()
        .in('checklist_id',
          (await supabaseAdmin.from('checklists').select('id').eq('company_id', profile.company_id)).data?.map(c => c.id) || []
        )
      await supabaseAdmin.from('checklists').delete().eq('company_id', profile.company_id)
      await supabaseAdmin.from('documents').delete().eq('company_id', profile.company_id)
      await supabaseAdmin.from('calendar_events').delete().eq('company_id', profile.company_id)
      await supabaseAdmin.from('profiles').delete().eq('id', user_id)
      await supabaseAdmin.from('companies').delete().eq('id', profile.company_id)
    }

    await supabaseAdmin.auth.admin.deleteUser(user_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}

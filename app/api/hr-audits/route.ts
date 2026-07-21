import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Saves and lists HR handbook audit results. Runs server-side with the admin
// key, same pattern as /api/link-research, so it isn't affected by row-level
// security on this table.

export async function POST(request: NextRequest) {
  try {
    const { companyId, userId, handbookName, handbookFileUrl, present, missing, draftPolicies } = await request.json()
    if (!companyId || !userId || !handbookFileUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('hr_audits')
      .insert({
        company_id: companyId,
        user_id: userId,
        handbook_name: handbookName || 'Handbook',
        handbook_file_url: handbookFileUrl,
        present: present || [],
        missing: missing || [],
        draft_policies: draftPolicies || [],
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('hr-audits save failed:', error)
    return NextResponse.json({ error: 'Failed to save audit' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('hr_audits')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('hr-audits list failed:', error)
    return NextResponse.json({ error: 'Failed to load audits' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.from('hr_audits').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('hr-audits delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete audit' }, { status: 500 })
  }
}

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id, user_id, title, description, due_date, category, is_recurring, recurrence_period } = body

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({ company_id, user_id, title, description, due_date, category, is_recurring, recurrence_period })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const user_id = searchParams.get('user_id')
    if (!company_id && !user_id) return NextResponse.json({ error: 'Missing company_id or user_id' }, { status: 400 })

    // A compliance calendar is a COMPANY asset — prefer company_id so all users
    // at a company see the same deadlines. user_id kept for backward compatibility
    // until the calendar page is migrated to company_id.
    let query = supabaseAdmin
      .from('calendar_events')
      .select('*')
      .order('due_date', { ascending: true })
    query = company_id ? query.eq('company_id', company_id) : query.eq('user_id', user_id)

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, completed } = body

    const { error } = await supabaseAdmin
      .from('calendar_events')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

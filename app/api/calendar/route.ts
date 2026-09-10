// Compliance calendar: deadlines and recurring events.
//
// Every handler derives the company from the verified session via requireCompany().
// This route writes with the service-role key, which bypasses RLS, so these checks are
// its only tenant boundary. It previously took company_id and user_id from a query
// parameter or the request body and never checked a session — so any caller could read
// another company's deadlines, write events into their calendar, or delete any event by
// id. Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

// Loads one event and confirms it belongs to this company. Returns null otherwise —
// callers turn that into a 404, never a 403, so event ids cannot be probed.
async function ownedEvent(id: string, companyId: string) {
  const { data } = await supabaseAdmin
    .from('calendar_events')
    .select('id, company_id')
    .eq('id', id)
    .single()
  if (!data || data.company_id !== companyId) return null
  return data
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId } = authed.auth

    const body = await request.json()
    const { title, description, due_date, category, is_recurring, recurrence_period } = body
    if (!title || !due_date) {
      return NextResponse.json({ error: 'Missing title or due_date' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({
        company_id: companyId,
        user_id: userId,
        title, description, due_date, category, is_recurring, recurrence_period,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

// A compliance calendar is a COMPANY asset — everyone at the company sees the same
// deadlines. The user_id parameter is gone along with company_id: it let any caller read
// any person's calendar, and it also meant two people at one company saw different
// deadlines, which is not what a compliance calendar is for.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const body = await request.json()
    const { id, completed } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (!(await ownedEvent(id, companyId))) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('calendar_events')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (!(await ownedEvent(id, companyId))) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

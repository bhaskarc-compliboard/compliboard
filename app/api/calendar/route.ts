// Compliance calendar: deadlines and recurring events.
//
// Every handler derives the company from the verified session via requireCompany().
// CONVERTED OFF THE SERVICE-ROLE KEY (§0.9). Every query runs through `authed.db`, which
// acts as the caller under RLS, so the database enforces tenancy alongside the checks
// below rather than trusting them. It previously took company_id and user_id from a query
// parameter or the request body and never checked a session — so any caller could read
// another company's deadlines, write events into their calendar, or delete any event by
// id. Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

// Loads one event and confirms it belongs to this company. Returns null otherwise —
// callers turn that into a 404, never a 403, so event ids cannot be probed.
//
// Takes the client rather than reaching for a module-level one, because the client now
// carries the caller's token and must not be shared between requests. Under RLS this
// lookup would return nothing for another company's row anyway; the explicit check stays
// so the 404 is deliberate rather than incidental.
async function ownedEvent(db: SupabaseClient, id: string, companyId: string) {
  const { data } = await db
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
    const { companyId, userId, db } = authed.auth

    const body = await request.json()
    const { title, description, due_date, category, is_recurring, recurrence_period } = body
    if (!title || !due_date) {
      return NextResponse.json({ error: 'Missing title or due_date' }, { status: 400 })
    }

    const { data, error } = await db
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
    const { companyId, db } = authed.auth

    const { data, error } = await db
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
    const { companyId, db } = authed.auth

    const body = await request.json()
    const { id, completed } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (!(await ownedEvent(db, id, companyId))) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { error } = await db
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
    const { companyId, db } = authed.auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (!(await ownedEvent(db, id, companyId))) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { error } = await db
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

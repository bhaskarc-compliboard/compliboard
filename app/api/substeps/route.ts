// Replaces the sub-steps under one checklist item.
//
// The company comes from the verified session via requireCompany(). This route writes
// with the service-role key, which bypasses RLS, so this check is its only tenant
// boundary. It previously took checklist_id from the request body and deleted and
// rewrote that checklist's items with no ownership check at all — any caller could
// wipe and replace part of any company's checklist.
// Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

// Checklist generation can run long, especially for a large/complex request.
export const maxDuration = 800

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const { checklist_id, parent_item_index, items } = await request.json()

    if (!checklist_id || parent_item_index === undefined || !items) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: checklist } = await supabaseAdmin
      .from('checklists')
      .select('id, company_id')
      .eq('id', checklist_id)
      .single()

    // 404 rather than 403, so checklist ids cannot be probed.
    if (!checklist || checklist.company_id !== companyId) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    // Delete existing sub-items for this parent
    await supabaseAdmin
      .from('checklist_items')
      .delete()
      .eq('checklist_id', checklist_id)
      .eq('parent_item_index', parent_item_index)

    // Insert new sub-items
    const rows = items.map((item: any, i: number) => ({
      checklist_id,
      category: 'must_do',
      name: item.name,
      description: item.description || '',
      why: item.why || null,
      source_url: item.source_url || null,
      cost_note: item.cost_note || null,
      time_estimate: item.time_estimate || null,
      what_you_need: item.what_you_need || null,
      is_determination: item.is_determination || false,
      clarifying_questions: item.clarifying_questions || [],
      agency_name: item.agency_name || null,
      search_hint: item.search_hint || null,
      sort_order: i,
      completed: false,
      parent_item_index,
    }))

    const { data, error } = await supabaseAdmin
      .from('checklist_items')
      .insert(rows)
      .select('id, sort_order')

    if (error) {
      console.error('Substeps insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Substeps route error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

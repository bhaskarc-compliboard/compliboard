// Replaces the sub-steps under one checklist item.
//
// CONVERTED OFF THE SERVICE-ROLE KEY (§0.9). Every query runs through `authed.db`, which
// acts as the caller under RLS. It previously took checklist_id from the request body and
// deleted and rewrote that checklist's items with no ownership check at all — any caller
// could wipe and replace part of any company's checklist.
//
// The delete-then-insert here is worth a note: under RLS a delete that the policy refuses
// removes ZERO rows rather than erroring, so the ownership check above it is what makes
// the refusal explicit. Belt and braces, and the braces are the ones doing the talking.
// Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'

// Checklist generation can run long, especially for a large/complex request.
export const maxDuration = 800

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { checklist_id, parent_item_index, items } = await request.json()

    if (!checklist_id || parent_item_index === undefined || !items) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: checklist } = await db
      .from('checklists')
      .select('id, company_id')
      .eq('id', checklist_id)
      .single()

    // 404 rather than 403, so checklist ids cannot be probed.
    if (!checklist || checklist.company_id !== companyId) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    // Delete existing sub-items for this parent
    await db
      .from('checklist_items')
      .delete()
      .eq('checklist_id', checklist_id)
      .eq('parent_item_index', parent_item_index)
      .eq('company_id', companyId)

    // Insert new sub-items
    const rows = items.map((item: any, i: number) => ({
      checklist_id,
      company_id: companyId,
      category: 'must_do',
      name: item.name,
      description: item.description || '',
      why: item.why || null,
      source_url: item.source_url || null,
      cost_note: item.cost_note || null,
      time_estimate: item.time_estimate || null,
      what_you_need: item.what_you_need || null,
      // Always false / empty since 11 Sep. SUBSTEPS_PROMPT no longer emits either field:
      // both were ADDITIVE question slots, asked AFTER the step had been written, which is
      // the determination gate inverted (DECISIONS.md §34). Questions now come only from
      // lib/determinationGate.ts, before the answer.
      //
      // The two COLUMNS remain on checklist_items and are now always false and empty.
      // Dropping them is a migration and a separate piece of work — TODO 2.2 records it —
      // so they are written explicitly here rather than left to a default that would hide
      // the fact that nothing populates them.
      is_determination: false,
      clarifying_questions: [],
      agency_name: item.agency_name || null,
      search_hint: item.search_hint || null,
      sort_order: i,
      completed: false,
      parent_item_index,
    }))

    const { data, error } = await db
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

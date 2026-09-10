// Links a saved research answer to the checklist it was converted into.
//
// CONVERTED OFF THE SERVICE-ROLE KEY (§0.9). The update runs through `authed.db`, which
// acts as the caller under RLS, so the database enforces tenancy alongside the checks
// below. It previously took both ids from the request body and updated whatever row they
// named — any caller could rewrite the link on any company's research answer, and point
// it at a checklist belonging to someone else.
//
// Worth noting: this route only became convertible with migration 004. `checklists` had
// no UPDATE policy at all before that, which is precisely why the write had to go through
// the key that ignores policies.
// Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

// Loads one checklists row and confirms it belongs to this company. Takes the client
// rather than reaching for a module-level one: it carries this request's token.
async function ownedChecklist(db: SupabaseClient, id: string, companyId: string) {
  const { data } = await db
    .from('checklists')
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
    const { companyId, db } = authed.auth

    const { researchId, checklistId } = await request.json()
    if (!researchId || !checklistId) {
      return NextResponse.json({ error: 'Missing researchId or checklistId' }, { status: 400 })
    }

    // Both ends are checked. Checking only the row being updated would still allow it
    // to be pointed at another company's checklist. 404 rather than 403, so ids cannot
    // be probed.
    if (!(await ownedChecklist(db, researchId, companyId)) || !(await ownedChecklist(db, checklistId, companyId))) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    const { error } = await db
      .from('checklists')
      .update({ converted_to_checklist_id: checklistId })
      .eq('id', researchId)
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('link-research failed:', error)
    return NextResponse.json({ error: 'Failed to link' }, { status: 500 })
  }
}

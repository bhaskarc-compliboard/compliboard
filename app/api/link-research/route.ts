// Links a saved research answer to the checklist it was converted into.
//
// The company comes from the verified session via requireCompany(). This route writes
// with the service-role key, which bypasses RLS, so this check is its only tenant
// boundary. It previously took both ids from the request body and updated whatever row
// they named — any caller could rewrite the link on any company's research answer, and
// point it at a checklist belonging to someone else.
// Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

// Loads one checklists row and confirms it belongs to this company.
async function ownedChecklist(id: string, companyId: string) {
  const { data } = await supabaseAdmin
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
    const { companyId } = authed.auth

    const { researchId, checklistId } = await request.json()
    if (!researchId || !checklistId) {
      return NextResponse.json({ error: 'Missing researchId or checklistId' }, { status: 400 })
    }

    // Both ends are checked. Checking only the row being updated would still allow it
    // to be pointed at another company's checklist. 404 rather than 403, so ids cannot
    // be probed.
    if (!(await ownedChecklist(researchId, companyId)) || !(await ownedChecklist(checklistId, companyId))) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
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

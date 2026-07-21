import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Links a saved research answer to the checklist it was converted into.
// Runs server-side with the admin key so it isn't affected by row-level
// security policies on the checklists table (the only place we update an
// existing row there, so we can't assume client-side updates are permitted).
export async function POST(request: NextRequest) {
  try {
    const { researchId, checklistId } = await request.json()
    if (!researchId || !checklistId) {
      return NextResponse.json({ error: 'Missing researchId or checklistId' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('checklists')
      .update({ converted_to_checklist_id: checklistId })
      .eq('id', researchId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('link-research failed:', error)
    return NextResponse.json({ error: 'Failed to link' }, { status: 500 })
  }
}

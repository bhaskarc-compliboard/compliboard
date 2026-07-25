import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Checklist generation can run long, especially for a large/complex request.
export const maxDuration = 800

export async function POST(request: NextRequest) {
  try {
    const { checklist_id, parent_item_index, items } = await request.json()

    if (!checklist_id || parent_item_index === undefined || !items) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Delete existing sub-items for this parent
    await supabase
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

    const { data, error } = await supabase
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

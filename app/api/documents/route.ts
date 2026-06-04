import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id, user_id, name, file_url, file_type, file_size, category, is_recurring, recurrence_period } = body

    const { error } = await supabaseAdmin
      .from('documents')
      .insert({
        company_id,
        user_id,
        name,
        file_url,
        file_type,
        file_size,
        category,
        is_recurring,
        recurrence_period,
      })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Document insert error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save document' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('user_id', user_id)
      .order('uploaded_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const file_url = searchParams.get('file_url')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (file_url) {
      await supabaseAdmin.storage
        .from('company-documents')
        .remove([file_url])
    }

    const { error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    )
  }
}

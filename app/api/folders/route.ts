import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('company_folders')
      .select('*')
      .eq('company_id', company_id)
      .order('sort_order')
      .order('name')

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch folders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id, name, parent_id, sort_order } = body
    if (!company_id || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('company_folders')
      .insert({
        company_id,
        name,
        parent_id: parent_id || null,
        sort_order: sort_order || 0,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create folder' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name } = body
    if (!id || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('company_folders')
      .update({ name })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rename folder' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Check if folder has files
    const { count } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Folder contains files. Move or delete files first.' },
        { status: 400 }
      )
    }

    // Check if folder has sub-folders
    const { count: subCount } = await supabaseAdmin
      .from('company_folders')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', id)

    if (subCount && subCount > 0) {
      return NextResponse.json(
        { error: 'Folder contains sub-folders. Delete them first.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('company_folders')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete folder' },
      { status: 500 }
    )
  }
}

// Folder tree for company documents.
//
// Every handler derives the company from the verified session via requireCompany().
// This route writes with the service-role key, which bypasses RLS, so these checks are
// its only tenant boundary. It previously took company_id from a query parameter or the
// request body and never checked a session — so any caller could list, create inside,
// rename or delete another company's folders. Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

// Loads one folder and confirms it belongs to this company. Returns null otherwise —
// callers turn that into a 404, never a 403, so folder ids cannot be probed.
async function ownedFolder(id: string, companyId: string) {
  const { data } = await supabaseAdmin
    .from('company_folders')
    .select('id, company_id, name')
    .eq('id', id)
    .single()
  if (!data || data.company_id !== companyId) return null
  return data
}

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const { data, error } = await supabaseAdmin
      .from('company_folders')
      .select('*')
      .eq('company_id', companyId)
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
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const body = await request.json()
    const { name, parent_id, sort_order } = body
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

    // A parent folder, if given, must be one of this company's. Without this a folder
    // could be hung inside another company's tree.
    if (parent_id && !(await ownedFolder(parent_id, companyId))) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('company_folders')
      .insert({
        company_id: companyId,
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
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const body = await request.json()
    const { id, name } = body
    if (!id || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    if (!(await ownedFolder(id, companyId))) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('company_folders')
      .update({ name })
      .eq('id', id)
      .eq('company_id', companyId)

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
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (!(await ownedFolder(id, companyId))) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Refuse to delete a folder that still holds files. The count is scoped to this
    // company as well — an unscoped count could be satisfied by another company's rows.
    const { count } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', id)
      .eq('company_id', companyId)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Folder contains files. Move or delete files first.' },
        { status: 400 }
      )
    }

    const { count: subCount } = await supabaseAdmin
      .from('company_folders')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', id)
      .eq('company_id', companyId)

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
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete folder' },
      { status: 500 }
    )
  }
}

// Every handler here derives company_id and user_id from the verified session token via
// requireCompany(), never from a query parameter or a request body.
//
// CONVERTED OFF THE SERVICE-ROLE KEY (§0.9). Queries and storage both run through
// `authed.db`, which acts as the caller under RLS, so the database enforces tenancy
// alongside the checks below rather than relying on them alone — see CLAUDE.md §3.6.
//
// The storage side matters as much as the tables: migration 002 scoped the bucket by
// company prefix, and this is the route that now actually runs under those policies
// instead of past them.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'

const BUCKET = 'company-documents'

// POST creates a document row for a file already uploaded to storage.
//
// company_id and user_id are taken from the session. Any values the client sends for
// those two fields are ignored — previously they were written straight through, so a
// caller could file a document into any company.
export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json()
    const { name, file_url, file_type, file_size, folder_id, is_recurring, recurrence_period } = body

    if (!name || !file_url) {
      return NextResponse.json({ error: 'Missing name or file_url' }, { status: 400 })
    }

    // The storage path always begins with the owning company's id (see migration
    // 002). Refuse to record a row pointing at another company's prefix.
    if (String(file_url).split('/')[0] !== companyId) {
      return NextResponse.json({ error: 'File path does not belong to your company' }, { status: 403 })
    }

    // A destination folder, if given, must be one of this company's folders.
    if (folder_id) {
      const { data: folder } = await db
        .from('company_folders')
        .select('id')
        .eq('id', folder_id)
        .eq('company_id', companyId)
        .single()
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    const { error } = await db
      .from('documents')
      .insert({
        company_id: companyId,
        user_id: userId,
        name,
        file_url,
        file_type,
        file_size,
        folder_id: folder_id || null,
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

// GET lists the caller's company documents.
//
// The user_id query parameter is gone. It let any caller read any user's documents
// by guessing an id, and it also meant two people at the same company could not see
// each other's files — the listing is now company-scoped, which is what the product
// intends. folder_id is still honoured as a filter.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { searchParams } = new URL(request.url)
    const folder_id = searchParams.get('folder_id')

    let query = db
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })

    if (folder_id) {
      if (folder_id === 'unfiled') {
        query = query.is('folder_id', null)
      } else {
        query = query.eq('folder_id', folder_id)
      }
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Document fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// PATCH moves a document to a different folder.
//
// Both ends are checked: the document must belong to the caller's company, and so
// must the destination folder. Checking only one of the two still allows a document
// to be pulled into, or pushed out of, someone else's folder tree.
export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const body = await request.json()
    const { id, folder_id } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Source: the document must be ours. 404 rather than 403 so the endpoint cannot
    // be used to probe which document ids exist.
    const { data: doc } = await db
      .from('documents')
      .select('id, company_id')
      .eq('id', id)
      .single()
    if (!doc || doc.company_id !== companyId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Destination: a null folder_id means "unfiled", which is always allowed. Any
    // other value must be one of this company's folders.
    if (folder_id) {
      const { data: folder } = await db
        .from('company_folders')
        .select('id')
        .eq('id', folder_id)
        .eq('company_id', companyId)
        .single()
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    const { error } = await db
      .from('documents')
      .update({ folder_id: folder_id || null })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Document move error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to move document' },
      { status: 500 }
    )
  }
}

// DELETE removes one document row and its stored file.
//
// Every fact this handler acts on is derived from the verified session token or from
// the document row itself — never from a query parameter. The previous version took
// `file_url` straight off the URL and passed it to the service-role storage client,
// so any caller could delete any path in the bucket, and it never checked who was
// asking.
//
// `file_url` is deliberately no longer read from the query string. Callers may still
// send it; it is ignored.
export async function DELETE(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Load the row and confirm it is theirs. A row whose company_id is null also
    // fails this comparison, which is the safe direction to fail.
    const { data: doc } = await db
      .from('documents')
      .select('id, company_id, file_url')
      .eq('id', id)
      .single()
    if (!doc || doc.company_id !== companyId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // The storage path comes from the row we just authorised, not from the URL.
    if (doc.file_url) {
      const { error: removeError } = await db.storage
        .from(BUCKET)
        .remove([doc.file_url])
      if (removeError) throw removeError
    }

    const { error } = await db
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Document delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    )
  }
}

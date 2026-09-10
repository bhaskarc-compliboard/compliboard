// AI review of one uploaded document: dates, coverage, gaps, action items.
//
// Every handler derives the company from the verified session via requireCompany().
// This route writes with the service-role key, which bypasses RLS, so these checks are
// its only tenant boundary. It previously took company_id and user_id from the form and
// company_id from a query parameter, and never checked a session — so any caller could
// read another company's reviews, file a review into their company, or delete any review
// by id. Reference: app/api/documents/route.ts.

import { reviewDocument } from '@/lib/documentReview'
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

// A document review with search enabled can occasionally run long.
export const maxDuration = 800

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId } = authed.auth

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentId = (formData.get('document_id') as string) || ''
    const documentName = (formData.get('document_name') as string) || ''
    const folderId = (formData.get('folder_id') as string) || ''
    const folderName = (formData.get('folder_name') as string) || ''
    const divisionName = (formData.get('division_name') as string) || ''

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    // If the review is being attached to an existing document, that document must be
    // this company's — otherwise a review row could be hung off someone else's file.
    if (documentId) {
      const { data: doc } = await supabaseAdmin
        .from('documents')
        .select('id, company_id')
        .eq('id', documentId)
        .single()
      // 404 rather than 403, so ids cannot be probed.
      if (!doc || doc.company_id !== companyId) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }
    }

    if (folderId) {
      const { data: folder } = await supabaseAdmin
        .from('company_folders')
        .select('id, company_id')
        .eq('id', folderId)
        .single()
      if (!folder || folder.company_id !== companyId) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    // Industry feeds the review prompt, so it is read from the company record rather
    // than accepted from the caller. Free text arriving from a request and landing
    // inside a prompt is a way to influence the model's instructions, not just a label.
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('industry')
      .eq('id', companyId)
      .single()
    const industry = (company?.industry || '').trim()

    const buffer = await file.arrayBuffer()
    const result = await reviewDocument({
      buffer, fileType: file.type, fileName: file.name,
      documentId, documentName, folderId, folderName, divisionName,
      companyId, userId, industry,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Document review error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Review failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    const { data, error } = await supabaseAdmin
      .from('document_reviews')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
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

    const { data: review } = await supabaseAdmin
      .from('document_reviews')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!review || review.company_id !== companyId) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('document_reviews')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

import { reviewDocument } from '@/lib/documentReview'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentId = formData.get('document_id') as string || ''
    const documentName = formData.get('document_name') as string || ''
    const folderId = formData.get('folder_id') as string || ''
    const folderName = formData.get('folder_name') as string || ''
    const divisionName = formData.get('division_name') as string || ''
    const companyId = formData.get('company_id') as string || ''
    const userId = formData.get('user_id') as string || ''
    const industry = formData.get('industry') as string || ''

    if (!file || !companyId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const result = await reviewDocument({
      buffer, fileType: file.type, fileName: file.name,
      documentId, documentName, folderId, folderName, divisionName, companyId, userId, industry,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Document review error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Review failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('document_reviews')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
  }
}

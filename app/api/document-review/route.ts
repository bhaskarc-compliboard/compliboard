import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import officeParser from 'officeparser'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REVIEW_PROMPT = `You are a compliance document reviewer. Analyze this document and return a structured review.

You must respond ONLY with a valid JSON object. No other text. No markdown. No backticks.

Use this exact structure:
{
  "document_type": "Type of document (e.g. Business License, OSHA Permit, SDS Sheet, Inspection Report)",
  "issued_by": "Name of issuing agency or organization",
  "issue_date": "YYYY-MM-DD or null if not found",
  "expiry_date": "YYYY-MM-DD or null if not found",
  "renewal_date": "YYYY-MM-DD or null if not found",
  "is_current": true or false (is this document currently valid?),
  "expiring_soon": true or false (expires within 90 days?),
  "days_until_expiry": number or null,
  "coverage": "One sentence describing what this document authorizes or covers",
  "gaps": ["List of missing items, outdated info, or compliance concerns"],
  "action_items": ["List of specific actions the company should take"],
  "summary": "2-3 sentence plain English summary of the document status"
}

If you cannot determine a field, use null. Be specific and practical in gaps and action_items.
Today's date is ${new Date().toISOString().split('T')[0]}.`

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

    const fileType = file.type
    const fileName = file.name.toLowerCase()
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const isImage = fileType.startsWith('image/')
    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf')
    const isWord = fileType.includes('wordprocessingml') || fileType.includes('msword') || fileName.endsWith('.docx') || fileName.endsWith('.doc')
    const isPowerPoint = fileType.includes('presentationml') || fileType.includes('powerpoint') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')

    let messageContent: Anthropic.MessageParam['content']

    if (isPDF) {
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as any,
        { type: 'text', text: `File name: ${documentName}\nFolder: ${folderName}\nDivision: ${divisionName}\nIndustry: ${industry}\n\nReview this compliance document.` },
      ]
    } else if (isImage) {
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        },
        { type: 'text', text: `File name: ${documentName}\nFolder: ${folderName}\nDivision: ${divisionName}\nIndustry: ${industry}\n\nReview this compliance document.` },
      ]
    } else if (isWord) {
      const nodeBuffer = Buffer.from(buffer)
      const result = await mammoth.convertToHtml({ buffer: nodeBuffer })
      messageContent = [
        { type: 'text', text: `File name: ${documentName}\nFolder: ${folderName}\nDivision: ${divisionName}\nIndustry: ${industry}\n\n${result.value}\n\nReview this compliance document.` },
      ]
    } else if (isPowerPoint) {
      const nodeBuffer = Buffer.from(buffer)
      const ast = await (officeParser as any).parseOffice(nodeBuffer)
      const text = ast.toText()
      messageContent = [
        { type: 'text', text: `File name: ${documentName}\nFolder: ${folderName}\nDivision: ${divisionName}\nIndustry: ${industry}\n\n${text}\n\nReview this compliance document.` },
      ]
    } else {
      return NextResponse.json({ error: 'Unsupported file type for review' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: REVIEW_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const review = JSON.parse(cleaned)

    // Save to document_reviews table
    const { data, error } = await supabaseAdmin
      .from('document_reviews')
      .insert({
        company_id: companyId,
        user_id: userId,
        document_id: documentId || null,
        document_name: documentName,
        folder_id: folderId || null,
        folder_name: folderName,
        division_name: divisionName,
        document_type: review.document_type,
        issued_by: review.issued_by,
        issue_date: review.issue_date,
        expiry_date: review.expiry_date,
        renewal_date: review.renewal_date,
        is_current: review.is_current,
        expiring_soon: review.expiring_soon,
        days_until_expiry: review.days_until_expiry,
        coverage: review.coverage,
        gaps: review.gaps || [],
        action_items: review.action_items || [],
        summary: review.summary,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data, review })
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

import { askAIJson } from '@/lib/ai'
import { hrAskPrompt, hrAuditPrompt } from '@/prompts/hr'
import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function downloadAsContentBlock(file_url: string) {
  const { data: fileData, error } = await supabaseAdmin.storage
    .from('company-documents')
    .download(file_url)
  if (error || !fileData) return null

  const arrayBuffer = await fileData.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const isPDF = file_url.endsWith('.pdf') || file_url.includes('.pdf')

  return isPDF
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 } }
}

export async function POST(request: NextRequest) {
  try {
    const { question, file_url, handbooks, company_name, mode } = await request.json()

    if (mode === 'ask') {
      // Ask mode reads ALL of the company's handbooks so the answer is accurate
      // even if it lives in a handbook other than the most recent one — and so
      // conflicting handbooks can be flagged rather than silently picked between.
      if (!handbooks || handbooks.length === 0) {
        return NextResponse.json({ error: 'No handbooks provided' }, { status: 400 })
      }

      const contentBlocks: Array<Record<string, unknown>> = []
      for (const hb of handbooks as { file_url: string; name: string }[]) {
        const block = await downloadAsContentBlock(hb.file_url)
        if (!block) continue // skip a handbook that fails to load rather than fail the whole question
        contentBlocks.push({ type: 'text', text: `Handbook: "${hb.name}"` })
        contentBlocks.push(block)
      }
      if (contentBlocks.length === 0) {
        return NextResponse.json({ error: 'Could not load any handbook' }, { status: 400 })
      }
      contentBlocks.push({ type: 'text', text: `HR Question: ${question}` })

      const parsed = await askAIJson(hrAskPrompt(company_name), contentBlocks, { maxTokens: 2000 })
      return NextResponse.json({ data: parsed })
    }

    // Audit mode: a single, specifically-selected handbook (unchanged behavior)
    const block = await downloadAsContentBlock(file_url)
    if (!block) {
      return NextResponse.json({ error: 'Could not load handbook' }, { status: 400 })
    }
    const userMessage = 'Audit this HR handbook. Identify what policy sections are present and what important sections are missing.'
    const parsed = await askAIJson(hrAuditPrompt(), [block, { type: 'text', text: userMessage }], { maxTokens: 3000 })
    return NextResponse.json({ data: parsed })
  } catch (error) {
    console.error('HR API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

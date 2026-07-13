import { askAIJson } from '@/lib/ai'
import { hrAskPrompt, hrAuditPrompt } from '@/prompts/hr'
import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { question, file_url, company_name, mode } = await request.json()

    const { data: fileData, error } = await supabaseAdmin.storage
      .from('company-documents')
      .download(file_url)

    if (error || !fileData) {
      return NextResponse.json({ error: 'Could not load handbook' }, { status: 400 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const isPDF = file_url.endsWith('.pdf') || file_url.includes('.pdf')
    const mediaType = isPDF ? 'application/pdf' : 'image/jpeg'

    let systemPrompt = ''
    let userMessage = ''

    if (mode === 'ask') {
      systemPrompt = hrAskPrompt(company_name)
      userMessage = `HR Question: ${question}`
    } else {
      systemPrompt = hrAuditPrompt()
      userMessage = 'Audit this HR handbook. Identify what policy sections are present and what important sections are missing.'
    }

    const docContent = isPDF
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 } }

    const parsed = await askAIJson(
      systemPrompt,
      [docContent, { type: 'text', text: userMessage }],
      { maxTokens: 2000 }
    )
    return NextResponse.json({ data: parsed })
  } catch (error) {
    console.error('HR API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
      systemPrompt = `You are an HR compliance assistant for ${company_name}. Answer HR questions based ONLY on the provided company handbook.

Respond with valid JSON only:
{
  "answer": "Direct answer based on the handbook. If not covered, say so clearly.",
  "gaps": ["Policy sections missing that would help answer this question"],
  "draft_policy": "Brief draft policy if there is a significant gap, otherwise null",
  "disclaimer": "Answers are based on your company handbook. Always verify with qualified HR counsel."
}`
      userMessage = `HR Question: ${question}`
    } else {
      systemPrompt = `You are an HR compliance auditor. Review the handbook and identify required policy sections.

Respond with valid JSON only:
{
  "present": ["Policy sections that ARE present"],
  "missing": ["Important sections MISSING — focus on: Anti-harassment, EEO, FMLA, ADA, Workplace safety, Disciplinary procedures, At-will employment, PTO/leave, Code of conduct, Confidentiality, Overtime/pay policies"]
}`
      userMessage = 'Audit this HR handbook. Identify what policy sections are present and what important sections are missing.'
    }

    const docContent = isPDF
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 } }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [docContent, { type: 'text', text: userMessage }]
      }]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return NextResponse.json({ data: parsed })
  } catch (error) {
    console.error('HR API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

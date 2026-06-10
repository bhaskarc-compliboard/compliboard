import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const AUDIT_PROMPT = `You are CompliBoard, a compliance assistant for small businesses in the United States.

You are auditing a compliance document folder for a business. Based on the folder name, industry, and list of file names provided, generate a gap analysis report.

You must respond ONLY with a valid JSON object. No other text. No markdown. No backticks. Just raw JSON.

Use this exact structure:
{
  "summary": "One sentence summary of the audit result",
  "present": [
    {
      "file_name": "exact file name from the list",
      "note": "one sentence on why this looks good or what it covers"
    }
  ],
  "needs_review": [
    {
      "file_name": "exact file name from the list",
      "note": "one sentence on why this may need updating — old date in name, unclear name, may be outdated"
    }
  ],
  "missing": [
    {
      "document": "name of missing document type",
      "why": "one sentence on why this is typically required for this folder type and industry",
      "priority": "high or medium"
    }
  ]
}

RULES:
- Only reference file names that were actually provided in the list
- For missing items, suggest documents commonly required for this specific folder type and industry
- Flag files with years older than 3 years as needing review
- Flag files with vague names like "document1.pdf" or "scan.pdf" as needing review
- Keep all language plain English — writing for a business owner not a lawyer
- Missing items should be specific and actionable, not generic
- Maximum 5 missing items — focus on the most important gaps
- If the folder looks complete, say so in the summary and keep missing array empty`

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { folder_id, folder_name, industry, file_names } = await request.json()
    if (!folder_id || !folder_name || !industry) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    if (!profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const fileList = file_names?.length > 0
      ? file_names.join('\n')
      : 'No files uploaded yet'

    const prompt = `Folder name: ${folder_name}
Industry: ${industry}
Files in this folder:
${fileList}

Audit this folder and identify what is present, what may need updating, and what is missing.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: AUDIT_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)

    // Save audit report
    const { data: audit, error: saveError } = await supabase
      .from('folder_audits')
      .insert({
        company_id: profile.company_id,
        user_id: user.id,
        folder_id,
        folder_name,
        industry,
        file_names: file_names || [],
        result_json: result,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Save audit error:', saveError)
      return NextResponse.json({ error: 'Failed to save audit' }, { status: 500 })
    }

    return NextResponse.json({ data: audit })
  } catch (error) {
    console.error('Audit error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('folder_audits')
      .select('*')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Get audits error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabase.from('folder_audits').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete audit error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

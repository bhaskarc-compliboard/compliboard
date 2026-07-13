import { createClient } from '@supabase/supabase-js'
import { askAIJson } from '@/lib/ai'
import { AUDIT_PROMPT } from '@/prompts/audit'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { folder_id, folder_name, parent_folder_name, industry, file_names } = await request.json()
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

    const prompt = `Division: ${parent_folder_name || 'N/A'}
Folder name: ${folder_name}
Industry: ${industry}
Files in this folder:
${fileList}

Audit this folder and identify what is present, what may need updating, and what is missing.`

    const result = await askAIJson(AUDIT_PROMPT, prompt, { maxTokens: 2000 })

    // Save audit report
    const { data: audit, error: saveError } = await supabase
      .from('folder_audits')
      .insert({
        company_id: profile.company_id,
        user_id: user.id,
        folder_id,
        folder_name,
        parent_folder_name: parent_folder_name || null,
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

import { askAIJson, type AIContent } from '@/lib/ai'
import { auditClassifyPrompt, auditGenerateStandardPrompt, auditMatchPrompt } from '@/prompts/audit'
import { reviewDocument } from '@/lib/documentReview'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import officeParser from 'officeparser'

// Audits can genuinely take several minutes (a full standard's worth of
// requirements, auto-indexing multiple documents, batched matching). 800s
// is the highest stable, generally-available ceiling on Vercel Pro/Enterprise
// without enrolling in the extended-duration beta.
export const maxDuration = 800

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MATCH_BATCH_SIZE = 40

interface LineItem {
  requirement: string
  category?: string
  prior_answer_context?: string | null
}

interface MatchResult {
  requirement: string
  status: 'satisfied' | 'needs_info' | 'needs_work'
  matched_documents: { document_id: string; document_name: string }[]
  note: string
  fix: string | null
}

// Turns an attached file into AIContent for the classify call. Same
// PDF/image/Word/PowerPoint branching as reviewDocument, but feeding the
// classify prompt rather than the review prompt.
async function fileToContent(file: File, extraText: string): Promise<AIContent> {
  const fileType = file.type
  const fileName = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const isImage = fileType.startsWith('image/')
  const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf')
  const isWord = fileType.includes('wordprocessingml') || fileType.includes('msword') || fileName.endsWith('.docx') || fileName.endsWith('.doc')
  const isPowerPoint = fileType.includes('presentationml') || fileType.includes('powerpoint') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')

  if (isPDF) {
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
      { type: 'text', text: extraText },
    ]
  } else if (isImage) {
    return [
      { type: 'image', source: { type: 'base64', media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } },
      { type: 'text', text: extraText },
    ]
  } else if (isWord) {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
    return [{ type: 'text', text: result.value + '\n\n' + extraText }]
  } else if (isPowerPoint) {
    const ast = await (officeParser as any).parseOffice(Buffer.from(buffer))
    return [{ type: 'text', text: ast.toText() + '\n\n' + extraText }]
  }
  throw new Error('Unsupported file type')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('audits')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load audits' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabaseAdmin.from('audits').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete audit' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const rerunAuditId = formData.get('rerun_audit_id') as string | null
    const companyId = formData.get('company_id') as string
    const userId = formData.get('user_id') as string
    const industry = (formData.get('industry') as string) || ''

    if (!companyId || !userId) {
      return NextResponse.json({ error: 'Missing company_id or user_id' }, { status: 400 })
    }

    let lineItems: LineItem[]
    let standardTemplateId: string | null = null
    let companyTemplateId: string | null = null
    let sourceType: string
    let sourceName: string

    if (rerunAuditId) {
      // Re-run: skip classification entirely, reuse the saved checklist,
      // re-match against whatever documents exist right now. Old match
      // results are discarded — this is a fresh, independent snapshot.
      const { data: priorAudit, error: priorErr } = await supabaseAdmin
        .from('audits')
        .select('*')
        .eq('id', rerunAuditId)
        .single()
      if (priorErr || !priorAudit) {
        return NextResponse.json({ error: 'Could not find the audit to re-run' }, { status: 404 })
      }
      lineItems = (priorAudit.line_items || []).map((li: any) => ({
        requirement: li.requirement,
        category: li.category,
        prior_answer_context: li.prior_answer_context,
      }))
      standardTemplateId = priorAudit.standard_template_id
      companyTemplateId = priorAudit.company_template_id
      sourceType = priorAudit.source_type
      sourceName = priorAudit.source_name
    } else {
      const question = (formData.get('question') as string) || ''
      const file = formData.get('file') as File | null
      const companyName = (formData.get('company_name') as string) || ''

      // --- Step 1: classify + extract ---
      const classifyText = `User request: ${question}`
      const classifyContent: AIContent = file
        ? await fileToContent(file, classifyText)
        : [{ type: 'text', text: classifyText }]

      const classified = await askAIJson(
        auditClassifyPrompt(companyName, industry),
        classifyContent,
        { maxTokens: 16000, enableWebSearch: true, temperature: 0.1 }
      )

      if (classified.type === 'question' || classified.type === 'needs_clarification') {
        return NextResponse.json({ data: classified })
      }

      lineItems = classified.line_items || []
      sourceType = classified.type
      sourceName = classified.source_name || 'Audit'

      // --- Step 2: branch by type — check cache FIRST for named standards, so a
      // cache hit never pays the expensive full-enumeration cost ---
      if (classified.type === 'named_standard') {
      const { data: cached } = await supabaseAdmin
        .from('standard_templates')
        .select('*')
        .ilike('standard_name', sourceName)
        .maybeSingle()

      if (cached) {
        // Cache hit — skip the expensive generation call entirely.
        lineItems = cached.line_items
        standardTemplateId = cached.id
      } else {
        // Cache miss — only now do we pay for the full enumeration.
        const generated = await askAIJson(
          auditGenerateStandardPrompt(sourceName),
          [{ type: 'text', text: `Generate the checklist for "${sourceName}" now.` }],
          { maxTokens: 16000, enableWebSearch: true, temperature: 0.1 }
        )
        lineItems = generated.line_items || []
        const { data: saved, error: saveErr } = await supabaseAdmin
          .from('standard_templates')
          .insert({ standard_name: sourceName, source: 'ai_generated', line_items: lineItems })
          .select()
          .single()
        if (saveErr) throw saveErr
        standardTemplateId = saved.id
      }
      } else if (classified.type === 'template') {
        const { data: saved, error: saveErr } = await supabaseAdmin
          .from('company_templates')
          .insert({ company_id: companyId, source_name: sourceName, line_items: lineItems })
          .select()
          .single()
        if (saveErr) throw saveErr
        companyTemplateId = saved.id
      }
      // 'findings' — used as-is, nothing cached
    }

    // --- Step 3: auto-index any unreviewed company documents ---
    const { data: docs } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
    const { data: existingReviews } = await supabaseAdmin
      .from('document_reviews')
      .select('id, document_id, document_name, coverage, summary, is_current, expiring_soon, expiry_date')
      .eq('company_id', companyId)

    const reviewedIds = new Set((existingReviews || []).map(r => r.document_id).filter(Boolean))
    const candidates: { document_id: string; document_name: string; description: string; review_id: string }[] = []

    function withCurrencyStatus(coverage: string, isCurrent: boolean | null, expiringSoon: boolean | null, expiryDate: string | null): string {
      const base = coverage || 'No description available.'
      if (isCurrent === false) {
        return `EXPIRED / NOT CURRENT (as of ${expiryDate || 'an earlier date'}) — ${base}`
      }
      if (expiringSoon) {
        return `EXPIRING SOON (${expiryDate || 'soon'}) — ${base}`
      }
      return base
    }

    for (const r of existingReviews || []) {
      candidates.push({
        document_id: r.document_id,
        document_name: r.document_name,
        description: withCurrencyStatus(r.coverage || r.summary || '', r.is_current, r.expiring_soon, r.expiry_date),
        review_id: r.id,
      })
    }

    for (const doc of docs || []) {
      if (reviewedIds.has(doc.id)) continue
      try {
        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from('company-documents')
          .download(doc.file_url)
        if (dlError || !fileData) continue
        const buffer = await fileData.arrayBuffer()
        const { data: newReview } = await reviewDocument({
          buffer, fileType: doc.file_type, fileName: doc.name,
          documentId: doc.id, documentName: doc.name,
          companyId, userId, industry,
        })
        if (newReview) {
          candidates.push({
            document_id: doc.id,
            document_name: doc.name,
            description: withCurrencyStatus(newReview.coverage || newReview.summary || '', newReview.is_current, newReview.expiring_soon, newReview.expiry_date),
            review_id: newReview.id,
          })
        }
      } catch (err) {
        console.error(`Auto-index failed for ${doc.name}, skipping:`, err)
      }
    }

    // --- Step 4: batched matching ---
    const allResults: MatchResult[] = []
    for (let i = 0; i < lineItems.length; i += MATCH_BATCH_SIZE) {
      const batch = lineItems.slice(i, i + MATCH_BATCH_SIZE)
      const matchInput = {
        line_items: batch.map(li => ({ requirement: li.requirement, category: li.category })),
        documents: candidates.map(c => ({ document_id: c.document_id, document_name: c.document_name, description: c.description })),
      }
      const matched = await askAIJson(
        auditMatchPrompt(),
        [{ type: 'text', text: JSON.stringify(matchInput) }],
        { maxTokens: 6000, temperature: 0.1 }
      )
      allResults.push(...(matched.results || []))
    }

    // --- Step 5: merge line items with match results, compute readiness in code ---
    const merged = lineItems.map(li => {
      const match = allResults.find(r => r.requirement === li.requirement)
      return {
        requirement: li.requirement,
        category: li.category || null,
        prior_answer_context: li.prior_answer_context || null,
        status: match?.status || 'needs_info',
        matched_documents: (match?.matched_documents || []).map((md: any) => {
          const candidate = candidates.find(c => c.document_id === md.document_id)
          return { ...md, review_id: candidate?.review_id || null }
        }),
        note: match?.note || 'Could not be matched — treat as needing review.',
        fix: match?.fix || null,
      }
    })

    const readinessSatisfied = merged.filter(m => m.status === 'satisfied').length
    const readinessNeedsInfo = merged.filter(m => m.status === 'needs_info').length
    const readinessNeedsWork = merged.filter(m => m.status === 'needs_work').length

    // --- Step 6: save the frozen audit run ---
    const { data: audit, error: auditErr } = await supabaseAdmin
      .from('audits')
      .insert({
        company_id: companyId,
        user_id: userId,
        source_type: sourceType,
        source_name: sourceName,
        standard_template_id: standardTemplateId,
        company_template_id: companyTemplateId,
        line_items: merged,
        readiness_satisfied: readinessSatisfied,
        readiness_needs_info: readinessNeedsInfo,
        readiness_needs_work: readinessNeedsWork,
      })
      .select()
      .single()

    if (auditErr) throw auditErr

    return NextResponse.json({ data: audit })
  } catch (error) {
    console.error('Audit engine error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Audit failed' }, { status: 500 })
  }
}

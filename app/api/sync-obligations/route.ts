import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { askAIJson } from '@/lib/ai'
import { resolveObligationsPrompt } from '@/prompts/resolve-obligations'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TemplateRow {
  id: string
  applies: string
  requirement_name: string
  trigger_plain: string | null
}

interface ResolutionResult {
  id: string
  decision: 'applies' | 'does_not_apply' | 'unknown'
  rationale: string
}

interface ObligationRow {
  company_id: string
  entity_id: null
  requirement_template_id: string
  status: string
  resolved_by: string | null
  resolution_rationale: string | null
}

const BATCH_SIZE = 40

async function resolveBatch(
  batch: TemplateRow[],
  company_id: string,
  profileContext: string
): Promise<ObligationRow[]> {
  const batchInput = batch.map((t) => ({
    id: t.id,
    requirement_name: t.requirement_name,
    trigger_plain: t.trigger_plain,
  }))

  let results: ResolutionResult[] = []
  try {
    results = await askAIJson<ResolutionResult[]>(
      resolveObligationsPrompt(),
      `COMPANY PROFILE:\n${profileContext}\n\nREQUIREMENTS TO EVALUATE:\n${JSON.stringify(batchInput, null, 2)}`,
      { maxTokens: 4000, temperature: 0.1 }
    )
  } catch (err) {
    console.error('Obligation resolution batch failed, defaulting batch to unconfirmed:', err)
  }

  const resultMap = new Map(results.map((r) => [r.id, r]))

  return batch.map((t) => {
    const result = resultMap.get(t.id)
    if (!result) {
      return {
        company_id,
        entity_id: null,
        requirement_template_id: t.id,
        status: 'unconfirmed',
        resolved_by: 'ai_inferred',
        resolution_rationale: 'No resolution returned — defaulted to unconfirmed for safety.',
      }
    }
    const status =
      result.decision === 'applies'
        ? 'missing'
        : result.decision === 'does_not_apply'
        ? 'not_applicable'
        : 'unconfirmed'
    return {
      company_id,
      entity_id: null,
      requirement_template_id: t.id,
      status,
      resolved_by: 'ai_inferred',
      resolution_rationale: result.rationale || null,
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_id } = body
    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('industry, scan_result')
      .eq('id', company_id)
      .single()

    if (companyError) throw companyError
    if (!company?.industry) {
      return NextResponse.json({ error: 'Company has no industry set' }, { status: 400 })
    }

    const state = (company.scan_result as Record<string, unknown> | null)?.state as string | undefined

    let templateQuery = supabaseAdmin
      .from('requirement_templates')
      .select('id, applies, requirement_name, trigger_plain')
      .eq('industry', company.industry)

    templateQuery = state
      ? templateQuery.or(`jurisdiction_state.is.null,jurisdiction_state.eq.${state}`)
      : templateQuery.is('jurisdiction_state', null)

    const { data: templates, error: templatesError } = await templateQuery
    if (templatesError) throw templatesError
    if (!templates || templates.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0, total: 0 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('obligations')
      .select('requirement_template_id')
      .eq('company_id', company_id)
      .is('entity_id', null)

    if (existingError) throw existingError
    const existingIds = new Set((existing || []).map((o) => o.requirement_template_id))

    const newTemplates = (templates as TemplateRow[]).filter((t) => !existingIds.has(t.id))
    const universal = newTemplates.filter((t) => t.applies === 'universal')
    const conditional = newTemplates.filter((t) => t.applies !== 'universal')

    const universalRows: ObligationRow[] = universal.map((t) => ({
      company_id,
      entity_id: null,
      requirement_template_id: t.id,
      status: 'missing',
      resolved_by: null,
      resolution_rationale: null,
    }))

    const profileContext = JSON.stringify(company.scan_result || {}, null, 2)

    const batchPromises: Promise<ObligationRow[]>[] = []
    for (let i = 0; i < conditional.length; i += BATCH_SIZE) {
      const batch = conditional.slice(i, i + BATCH_SIZE)
      batchPromises.push(resolveBatch(batch, company_id, profileContext))
    }
    const batchResults = await Promise.all(batchPromises)
    const conditionalRows = batchResults.flat()

    const rowsToInsert: ObligationRow[] = [...universalRows, ...conditionalRows]

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('obligations').insert(rowsToInsert)
      if (insertError) throw insertError
    }

    const summary = {
      created: rowsToInsert.length,
      skipped: templates.length - rowsToInsert.length,
      total: templates.length,
      universal: universal.length,
      conditional_resolved: {
        missing: conditionalRows.filter((r) => r.status === 'missing').length,
        not_applicable: conditionalRows.filter((r) => r.status === 'not_applicable').length,
        unconfirmed: conditionalRows.filter((r) => r.status === 'unconfirmed').length,
      },
    }

    return NextResponse.json(summary)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync obligations' },
      { status: 500 }
    )
  }
}

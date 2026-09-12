import { askAIJson, type AIContent } from '@/lib/ai'
import { auditClassifyPrompt, auditGenerateStandardPrompt, auditMatchPrompt } from '@/prompts/audit'
import { reviewDocument } from '@/lib/documentReview'
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { gate, type GateAnswering } from '@/lib/determinationGate'
import { parseDocumentToBlocks, type DocumentParseFailure } from '@/lib/documentContent'

// THIS ROUTE IS A POOR FIT FOR SERVERLESS, AND maxDuration IS NOT THE FIX.
//
// One request does: classify (with web search), generate a full standard on a cache miss,
// review every unreviewed document one at a time, then match every requirement in batches.
// Several minutes, several model calls, unbounded in the number of documents.
//
// 800s is already the highest stable ceiling on Vercel without the extended-duration beta,
// and it was raised once to work around exactly this. Raising it again is not a fix; it is
// the same workaround with a bigger number.
//
// The fix is the background worker in Phase 5. BizPulses hit this identical wall and
// solved it by moving the work out of the request entirely — PATTERNS.md §5: "It is
// separate from Vercel because classify + N extraction calls + reconcile routinely exceed
// any serverless timeout." When this moves there it will use the SERVICE-ROLE KEY again,
// legitimately and for the same reason /api/signup does: a background job has no user
// session to run as. The conversion below is superseded at that point, not wrong.
//
// UNTIL THEN, a specific hazard. `authed.db` carries the caller's token, pinned at request
// start with autoRefreshToken:false. A token has a finite life. If one expired mid-run,
// reads would return empty rather than error, storage downloads would fail — and the
// `continue` in the auto-index loop below skips a document whose download fails, with no
// error and no record of the skip. The audit would then finish successfully, with
// readiness counts computed correctly in code from a document set that had quietly shrunk.
// Plausible numbers, wrong input. See TODO.md — reporting unreadable documents is recorded
// as work in its own right, because that `continue` predates this conversion.
export const maxDuration = 800

// CONVERTED OFF THE SERVICE-ROLE KEY (§0.9), with ONE deliberate exception marked below.
// Everything runs through `authed.db`, the caller's own client under RLS — reads, writes
// and storage downloads alike. The single statement still using the admin client is the
// shared-standard cache insert, and the comment there explains why it must stay.
//
// It previously took company_id straight from a query parameter or form field and never
// checked the session at all. Reference: app/api/documents/route.ts.

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
// Turns the uploaded file into content for the classify prompt. The parsing itself lives
// in lib/documentContent.ts — this only adds the instruction text, which is the part that
// differs per route.
//
// It used to read PDF, image, Word and PowerPoint and throw a bare
// `new Error('Unsupported file type')` for anything else, which the catch below turned
// into a 500 saying "Something went wrong". Excel and CSV were never handled at all.
async function fileToContent(
  file: File,
  extraText: string
): Promise<{ ok: true; content: AIContent } | { ok: false; failure: DocumentParseFailure }> {
  const parsed = await parseDocumentToBlocks(await file.arrayBuffer(), file.name, file.type)
  if (!parsed.ok) return { ok: false, failure: parsed.failure }
  return { ok: true, content: [...parsed.blocks, { type: 'text', text: extraText }] as AIContent }
}

// Lists this company's saved audits. The company_id parameter is gone — it let any
// caller read any company's audit history.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { data, error } = await db
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

// Deletes one audit, after confirming it belongs to the caller's company. Previously
// any id could be deleted by anyone.
export async function DELETE(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: audit } = await db
      .from('audits')
      .select('id, company_id')
      .eq('id', id)
      .single()

    // 404 rather than 403, so the endpoint cannot be used to discover which ids exist.
    if (!audit || audit.company_id !== companyId) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const { error } = await db
      .from('audits').delete().eq('id', id).eq('company_id', companyId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete audit' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const formData = await request.formData()
    const rerunAuditId = formData.get('rerun_audit_id') as string | null

    // company_name and industry feed the classify prompt, so they are read from the
    // company record rather than accepted from the caller. Free text arriving from a
    // request and landing inside a prompt is a way to influence the model's
    // instructions, not just a label.
    const { data: company } = await db
      .from('companies')
      .select('name, industry')
      .eq('id', companyId)
      .single()
    const companyName = company?.name || ''
    const industry = (company?.industry || '').trim()

    // Industry is not optional here. It goes into the classify prompt, and classifying
    // "what does this company have to do" against a blank industry produces an answer
    // anchored to nothing — the enumerate-from-nothing failure this product exists to
    // avoid (CLAUDE.md §3.3). Better to stop and say the profile is incomplete than to
    // return a confident audit built on no industry at all.
    if (!industry) {
      return NextResponse.json(
        {
          error:
            'Your company profile is incomplete: no industry is set. An audit is built ' +
            'from the rules that apply to your industry, so it cannot run without one. ' +
            'Set your industry in My Account, then try again.',
        },
        { status: 400 }
      )
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
      const { data: priorAudit, error: priorErr } = await db
        .from('audits')
        .select('*')
        .eq('id', rerunAuditId)
        .single()
      // Same 404 for "does not exist" and "not yours" — re-running someone else's audit
      // would have rebuilt it against this company's documents and saved it here.
      if (priorErr || !priorAudit || priorAudit.company_id !== companyId) {
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

      // --- Step 1: classify + extract ---
      const classifyText = `User request: ${question}`
      let classifyContent: AIContent = [{ type: 'text', text: classifyText }]
      if (file) {
        const loaded = await fileToContent(file, classifyText)
        if (!loaded.ok) {
          // 400 and the reason, not a 500 saying "Something went wrong".
          return NextResponse.json(
            { error: loaded.failure.message, document_failed: loaded.failure },
            { status: 400 }
          )
        }
        classifyContent = loaded.content
      }

      // ------------------------------------------------------------------
      // STAGE 1 — the determination gate, BEFORE classification rather than after.
      //
      // Classification is itself an AI call that enumerates; gating after it means paying
      // for the enumeration and then discarding it. outputType is always 'checklist' here:
      // an audit is a list of things somebody will do, with hours attached, so the stricter
      // threshold applies — ask if the CONTENT OF ANY STEP would change (WORKSPACE.md §4.3).
      //
      // auditClassifyPrompt's own `needs_clarification` path stays for now and collapses
      // into this one later. Removing it first would leave this route with no gate at all
      // for the window in between, which is worse than briefly having two.
      // docs/DETERMINATION-GATE.md §3.4, §4.3.
      // ------------------------------------------------------------------
      const answeringRaw = formData.get('answering') as string | null
      let answering: GateAnswering | null = null
      if (answeringRaw) {
        try { answering = JSON.parse(answeringRaw) as GateAnswering } catch { answering = null }
      }

      const g = await gate({
        question,
        documentBlocks: Array.isArray(classifyContent) ? classifyContent : [],
        companyId,
        outputType: 'checklist',
        db,
        answering,
      })
      if (g.outcome === 'ask') {
        return NextResponse.json({ outcome: 'ask', ask: g.ask })
      }

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
      // Read under the caller's token: standard_templates is SELECT USING (true).
      const { data: cached } = await db
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
        // The shared parsed-standard cache. READ under the caller's token above; WRITE
        // with the admin client here, and that asymmetry is deliberate — do not "tidy" it
        // to one client.
        //
        // standard_templates is reference data shared by every company: one parsed copy of
        // OSHA 1910.1200 serves all of them, which is what makes the marginal cost of a new
        // customer fall (DECISIONS.md §1). It has SELECT USING (true) and no write policy
        // at all.
        //
        // Giving it an INSERT policy would let any authenticated user write into the cache
        // every other company reads — poisoning shared regulatory content from an ordinary
        // session, with no tenant boundary to catch it because there is no tenant column.
        // So the write stays privileged and stays here, one statement, on the cache-miss
        // path only.
        //
        // If you are converting this file further: this is the line that must not move.
        const { data: saved, error: saveErr } = await supabaseAdmin
          .from('standard_templates')
          .insert({ standard_name: sourceName, source: 'ai_generated', line_items: lineItems })
          .select()
          .single()
        if (saveErr) throw saveErr
        standardTemplateId = saved.id
      }
      } else if (classified.type === 'template') {
        const { data: saved, error: saveErr } = await db
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
    const { data: docs } = await db
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
    const { data: existingReviews } = await db
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
        const { data: fileData, error: dlError } = await db.storage
          .from('company-documents')
          .download(doc.file_url)
        if (dlError || !fileData) continue
        const buffer = await fileData.arrayBuffer()
        const { data: newReview } = await reviewDocument({
          buffer, fileType: doc.file_type, fileName: doc.name,
          documentId: doc.id, documentName: doc.name,
          companyId, userId, industry,
          db, // write the review under RLS, same client as everything else here
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
    const { data: audit, error: auditErr } = await db
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

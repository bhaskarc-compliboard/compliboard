// DRAFT THE MISSING SECTION — Documents Run 5.
//
// POST { document_id, gap_id }
//
// *** THE ONE ACTION IN THE REPORT DRAWER THAT COSTS MONEY. *** Task `document_draft`, on the
// PROSE tier (`AI_MODEL_PROSE`), because writing a section in a document's own voice decides
// nothing — the gap already said what is missing and which rule asks for it. The ledger row
// carries the company and its id is stored on the gap, so a person looking at a draft weeks later
// can find what it cost.
//
// ONLY ON A GAP THE SCAN MARKED `draftable`. That flag is the model's own answer to "could the
// missing text be written from what this document already says", and it is the difference between
// drafting a reporting procedure from the plan's own contacts and inventing a floor plan. Where
// it is false the drawer does not offer the action, and this route refuses it rather than
// trusting the button.
//
// *** NOTHING IS WRITTEN INTO THE PERSON'S FILE. *** The draft is stored on the gap and shown in
// the drawer for them to copy. The document in storage is never touched.
//
// A SECOND REQUEST REPLACES THE FIRST, and the response says so, so the drawer can tell them
// rather than silently swapping the text under their cursor.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { askAI, modelForTask } from '@/lib/ai'
import { parseDocumentToBlocks } from '@/lib/documentContent'
import { draftPrompt } from '@/prompts/document-draft'

export const maxDuration = 800
const BUCKET = 'company-documents'

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  let body: { document_id?: string; gap_id?: string }
  try { body = await request.json() } catch { body = {} }
  const documentId = String(body.document_id ?? '').trim()
  const gapId = String(body.gap_id ?? '').trim()
  if (!documentId || !gapId) {
    return NextResponse.json({ error: 'Give a document_id and a gap_id.' }, { status: 400 })
  }

  try {
    const { data: doc } = await db.from('documents')
      .select('id, name, file_url, file_type').eq('id', documentId).maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const { data: gap } = await db.from('document_gaps')
      .select('id, document_id, title, description, fix, citation, draftable, status, draft_text')
      .eq('id', gapId).maybeSingle()
    if (!gap || gap.document_id !== documentId) {
      return NextResponse.json({ error: 'Gap not found' }, { status: 404 })
    }
    if (gap.status === 'dismissed') {
      return NextResponse.json({ error: 'That gap has been dismissed.' }, { status: 409 })
    }
    // THE FLAG IS CHECKED HERE, NOT ONLY IN THE UI. A button is a suggestion; this is the rule.
    if (!gap.draftable) {
      return NextResponse.json({
        error: 'This one needs something only you have — a floor plan, a name, a number we have '
             + 'not been told — so there is nothing we could write for you that would be worth pasting.',
      }, { status: 409 })
    }

    const { data: row } = await db.from('document_index_v')
      .select('title, kind').eq('document_id', documentId).maybeSingle()
    const { data: company } = await db.from('companies')
      .select('name, industry, state').eq('id', companyId).maybeSingle()

    // The document itself, as blocks — the same parser the scan uses, so a PDF goes whole and
    // Word arrives as HTML. The draft has to match the document's voice, and it cannot do that
    // from a summary of it.
    const { data: blob, error: dlError } = await db.storage.from(BUCKET).download(doc.file_url)
    if (dlError || !blob) {
      return NextResponse.json({
        error: 'We could not fetch the stored file, so there is nothing to write from.',
      }, { status: 502 })
    }
    const parsed = await parseDocumentToBlocks(await blob.arrayBuffer(), doc.name, doc.file_type)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.failure.message }, { status: 422 })
    }

    const replaced = !!gap.draft_text
    const startedAt = new Date().toISOString()
    const system = draftPrompt({
      company: {
        name: company?.name ?? 'this company',
        industry: company?.industry ?? null,
        state: company?.state ?? null,
      },
      document: { title: row?.title ?? doc.name, kind: row?.kind ?? null },
      gap: {
        title: gap.title, description: gap.description,
        fix: gap.fix, citation: gap.citation,
      },
    })

    const text = await askAI(system, [
      ...parsed.blocks,
      { type: 'text', text: 'Write the missing section described above.' },
    ] as never, {
      task: 'document_draft',
      maxTokens: 4000,
      // NO WEB SEARCH. The draft's whole instruction is to write from what the document already
      // says; a search would be the model reaching past its anchor (§3.3) for prose that is
      // supposed to come from the file in front of it.
      ledger: { companyId, task: 'document_draft' },
    })

    if (!text?.trim()) {
      return NextResponse.json({
        error: 'The draft came back empty. This is usually temporary — try again in a moment.',
      }, { status: 502 })
    }

    // The ledger row for this call, found by time the same way `saveScan` does it, because
    // `recordAICall` is deliberately not awaited. Saved with a null link rather than delayed.
    let aiCallId: string | null = null
    for (let attempt = 0; attempt < 5 && !aiCallId; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 250))
      const { data: call } = await db.from('ai_calls')
        .select('id').eq('company_id', companyId).eq('task', 'document_draft')
        .gte('created_at', startedAt).order('created_at', { ascending: false }).limit(1).maybeSingle()
      aiCallId = call?.id ?? null
    }

    const { error } = await supabaseAdmin.from('document_gaps').update({
      draft_text: text.trim(),
      draft_created_at: new Date().toISOString(),
      draft_ai_call_id: aiCallId,
    }).eq('id', gapId)
    if (error) throw new Error(error.message)

    return NextResponse.json({
      draft_text: text.trim(),
      draft_created_at: new Date().toISOString(),
      model: modelForTask('document_draft'),
      // The drawer says "this replaced the draft from <date>" rather than swapping the text
      // silently under somebody who may have been part way through copying it.
      replaced,
    })
  } catch (e) {
    console.error('POST /api/document-draft failed:', e)
    return NextResponse.json(
      { error: 'We could not write that draft just now. Please try again.' }, { status: 500 })
  }
}

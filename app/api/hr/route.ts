// HR handbook question-answering and auditing.
//
// CONVERTED OFF THE SERVICE-ROLE KEY (§0.9). Reads and storage downloads both run through
// `authed.db`, which acts as the caller under RLS. That closes the gap this header used to
// describe: the storage policies from migration 002 scope the bucket by company prefix,
// and this route was reaching past them with a key that ignores them. It now runs under
// them, so a handbook belonging to another company is unreadable at the storage layer as
// well as refused by the checks below.
//
// The previous version took `file_url` (audit mode) and `handbooks[].file_url` (ask
// mode) straight from the request body and handed them to storage.download(). Any path
// in the bucket could be named, and its contents came back through the AI's answer.
// That was the last remaining way to read another company's files after 002.
//
// Now the caller sends DOCUMENT IDS. Each row is loaded, checked against the company
// derived from the session, and the storage path is taken from the authorised row —
// the caller never supplies a path at all. Reference: app/api/documents/route.ts.

import { askAIJson } from '@/lib/ai'
import { hrAskPrompt, hrAuditPrompt } from '@/prompts/hr'
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'company-documents'

type OwnedDocument = { id: string; name: string; file_url: string; file_type: string | null }

// Why a document could not be read. Both are shown to the user, because a handbook
// silently missing from an answer makes that answer look more complete than it is.
type LoadFailure = {
  id: string
  name: string
  reason: 'unsupported_format' | 'download_failed'
  message: string
}

// The model is only sent PDFs and images. Anything else — .docx above all — would
// previously be base64'd and labelled image/jpeg, which is not a format the model can
// read; it produced confident nonsense rather than an error.
const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp',
}

function extensionOf(path: string): string {
  const base = path.split('?')[0]
  const dot = base.lastIndexOf('.')
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase()
}

// Returns a content block, or a described failure. Never returns a block for a format
// the model cannot actually read.
async function loadContentBlock(
  db: SupabaseClient,
  doc: OwnedDocument
): Promise<{ block: Record<string, unknown> } | { failure: LoadFailure }> {
  const ext = extensionOf(doc.file_url)
  const isPDF = ext === 'pdf' || (doc.file_type || '').includes('pdf')
  const imageType = IMAGE_TYPES[ext]

  if (!isPDF && !imageType) {
    return {
      failure: {
        id: doc.id,
        name: doc.name,
        reason: 'unsupported_format',
        message: `"${doc.name}" is a ${ext ? '.' + ext : 'file of unknown'} format, which cannot be read here. Only PDFs and images can be. Re-upload it as a PDF to include it.`,
      },
    }
  }

  const { data: fileData, error } = await db.storage.from(BUCKET).download(doc.file_url)
  if (error || !fileData) {
    return {
      failure: {
        id: doc.id,
        name: doc.name,
        reason: 'download_failed',
        message: `"${doc.name}" could not be downloaded (${error?.message ?? 'no response from storage'}). This is usually temporary — try again.`,
      },
    }
  }

  const base64 = Buffer.from(await fileData.arrayBuffer()).toString('base64')

  return {
    block: isPDF
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: imageType, data: base64 } },
  }
}

/**
 * Turn caller-supplied document ids into rows this company actually owns.
 *
 * Returns the rows in the order requested, or null if ANY id is missing or belongs to
 * someone else. Failing the whole request rather than quietly dropping the bad ids
 * matters twice over: a caller must not be able to learn which ids exist by watching
 * what comes back, and an answer built from a silently smaller set of handbooks would
 * look complete while being wrong.
 */
async function loadOwnedDocuments(db: SupabaseClient, ids: string[], companyId: string): Promise<OwnedDocument[] | null> {
  const unique = Array.from(new Set(ids))
  if (unique.length === 0) return null

  const { data, error } = await db
    .from('documents')
    .select('id, name, file_url, file_type')
    .in('id', unique)
    .eq('company_id', companyId)

  if (error) throw error

  const found = new Map((data || []).map((d: OwnedDocument) => [d.id, d]))
  if (found.size !== unique.length) return null

  return unique.map((id) => found.get(id) as OwnedDocument)
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const body = await request.json()
    const { question, document_ids, document_id, mode } = body

    // The company name feeds the prompt, so it is read from the database rather than
    // taken from the request. A caller-supplied name is free text arriving inside a
    // prompt — a way to influence the model's instructions, not just a label.
    const { data: company } = await db
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()
    const companyName = company?.name ?? ''

    if (mode === 'ask') {
      // Ask mode reads ALL of the company's handbooks so the answer is accurate
      // even if it lives in a handbook other than the most recent one — and so
      // conflicting handbooks can be flagged rather than silently picked between.
      if (!Array.isArray(document_ids) || document_ids.length === 0) {
        return NextResponse.json({ error: 'No handbooks provided' }, { status: 400 })
      }

      const docs = await loadOwnedDocuments(db, document_ids, companyId)
      if (!docs) {
        // 404, not 403: a caller should not be able to discover which ids exist by
        // telling apart "does not exist" from "not yours".
        return NextResponse.json({ error: 'Handbook not found' }, { status: 404 })
      }

      const contentBlocks: Array<Record<string, unknown>> = []
      const documentsRead: Array<{ id: string; name: string }> = []
      const documentsFailed: LoadFailure[] = []

      for (const doc of docs) {
        const result = await loadContentBlock(db, doc)
        if ('failure' in result) {
          documentsFailed.push(result.failure)
          continue
        }
        contentBlocks.push({ type: 'text', text: `Handbook: "${doc.name}"` })
        contentBlocks.push(result.block)
        documentsRead.push({ id: doc.id, name: doc.name })
      }

      // Outcome 4: nothing loaded. No answer at all — an answer built from no documents
      // would be general HR knowledge wearing their policy's clothes.
      if (documentsRead.length === 0) {
        return NextResponse.json(
          {
            error: documentsFailed.length
              ? `None of your handbooks could be read. ${documentsFailed.map((f) => f.message).join(' ')}`
              : 'Could not load any handbook',
            documents_failed: documentsFailed,
          },
          { status: 400 }
        )
      }

      contentBlocks.push({ type: 'text', text: `HR Question: ${question}` })

      const parsed = await askAIJson(
        hrAskPrompt(companyName, documentsRead.map((d) => d.name)),
        contentBlocks,
        { maxTokens: 2000 }
      )

      // The model decides outcomes 1 and 2 (answered / not_covered). The route decides
      // outcome 3 — which documents it managed to read — and reports it alongside, so a
      // partial answer is never presented as a complete one.
      return NextResponse.json({
        data: {
          ...(parsed as Record<string, unknown>),
          documents_read: documentsRead,
          documents_failed: documentsFailed,
        },
      })
    }

    // Audit mode: a single, specifically-selected handbook.
    if (!document_id) {
      return NextResponse.json({ error: 'No handbook selected' }, { status: 400 })
    }

    const docs = await loadOwnedDocuments(db, [document_id], companyId)
    if (!docs) {
      return NextResponse.json({ error: 'Handbook not found' }, { status: 404 })
    }

    const result = await loadContentBlock(db, docs[0])
    if ('failure' in result) {
      return NextResponse.json({ error: result.failure.message, documents_failed: [result.failure] }, { status: 400 })
    }
    const block = result.block
    const userMessage = 'Audit this HR handbook. Identify what policy sections are present and what important sections are missing.'
    const parsed = await askAIJson(hrAuditPrompt(), [block, { type: 'text', text: userMessage }], { maxTokens: 3000 })
    return NextResponse.json({ data: parsed })
  } catch (error) {
    console.error('HR API error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

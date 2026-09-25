// A CHECKLIST FROM A GAP — Documents Run 5.
//
// POST { document_id, gap_id }        one gap
// POST { document_id, all: true }     every open gap, one section each
//
// *** IT GOES THROUGH THE EXISTING CHECKLIST ENGINE. *** Same `askAIJson`, same `checklists` and
// `checklist_items` tables, same shape the workspace's drawer already renders, same
// `checklists_created` counter. A checklist made from a permit and one made from a conversation
// are the same object with a different provenance, and building a second kind would mean two
// renderers, two progress calculations and two things to keep in step.
//
// LEDGER TASK `checklist`, not a new one. The existing tier already covers "turn a piece of
// reasoning into actions", and splitting the ledger by where the reasoning came from would make
// the cost report answer a question nobody asks. The draft is a genuinely different job and gets
// its own task; this is not.
//
// WHAT IT DOES NOT DO. It does not touch the gap's status, does not mark anything resolved, and
// does not write to `obligations`. Making a list of what to do about a gap is not doing it.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { askAIJson } from '@/lib/ai'
import { CHECKLIST_FROM_GAPS } from '@/prompts/document-checklist'

export const maxDuration = 800

interface Item { name?: string; description?: string; why?: string; gap?: string }
interface Built { title?: string; must_do?: Item[]; good_to_have?: Item[] }

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  let body: { document_id?: string; gap_id?: string; all?: boolean }
  try { body = await request.json() } catch { body = {} }
  const documentId = String(body.document_id ?? '').trim()
  const gapId = body.gap_id ? String(body.gap_id).trim() : null
  const wantAll = body.all === true
  if (!documentId || (!gapId && !wantAll)) {
    return NextResponse.json({ error: 'Give a document_id and either a gap_id or all: true.' }, { status: 400 })
  }

  try {
    // RLS decides visibility; another company's document is a 404, not a 403.
    const { data: doc } = await db.from('document_index_v')
      .select('document_id, title, kind, agencies, site_name')
      .eq('document_id', documentId).maybeSingle()
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    let q = db.from('document_gaps')
      .select('id, ordinal, title, description, fix, citation, citation_url, locator')
      .eq('document_id', documentId).eq('status', 'open').order('ordinal')
    if (gapId) q = q.eq('id', gapId)
    const { data: gaps } = await q
    if (!gaps?.length) {
      // §5.1: say what is true and what can be done, never an empty success.
      return NextResponse.json({
        error: gapId
          ? 'That gap is not open, so there is nothing to make a checklist from.'
          : 'There are no open gaps on this document.',
      }, { status: 409 })
    }

    const gapBlock = gaps.map((g, i) =>
      `GAP ${i + 1}: ${g.title}\n` +
      (g.description ? `What is missing: ${g.description}\n` : '') +
      (g.fix ? `What it needs: ${g.fix}\n` : '') +
      (g.citation ? `The rule: ${g.citation}\n` : '') +
      (g.locator ? `Where: ${g.locator}\n` : '')
    ).join('\n')

    const built = await askAIJson<Built>(
      CHECKLIST_FROM_GAPS,
      `THE DOCUMENT: ${doc.title}${doc.kind ? ` (${doc.kind})` : ''}\n`
      + `${doc.site_name ? `Site: ${doc.site_name}\n` : ''}\n${gapBlock}`,
      { maxTokens: 8000, task: 'judgement', ledger: { companyId, task: 'checklist' } },
    )

    const clean = (items: Item[] | undefined, category: 'must_do' | 'good_to_have') =>
      (items ?? []).filter((i) => String(i?.name ?? '').trim()).map((i) => ({
        name: String(i.name).trim().slice(0, 300),
        description: String(i.description ?? '').trim(),
        why: String(i.why ?? '').trim(),
        category,
        // `document`, new in migration 050. An item written from a gap in a permit did not come
        // from a conversation, and origin records where it came FROM.
        origin: 'document' as const,
        // The document is the source, and it is OURS — no URL, because there is no public page
        // to link to. `source_title` names it so the item can say where it came from.
        source_title: gaps.length > 1 && i.gap ? `${doc.title} — ${i.gap}` : doc.title,
        source_url: null,
      }))

    const mustDo = clean(built?.must_do, 'must_do')
    const good = clean(built?.good_to_have, 'good_to_have')
    if (!mustDo.length && !good.length) {
      return NextResponse.json(
        { error: 'Nothing in this gap could be turned into steps. Try the draft instead.' }, { status: 422 })
    }

    const title = String(built?.title ?? '').trim().slice(0, 160)
      || (gapId ? gaps[0].title.slice(0, 160) : `${doc.title} — ${gaps.length} gaps`)

    // *** WRITTEN BY THE SERVER. *** `checklists` and `checklist_items` are writable by
    // `authenticated`, so `db` would work — but the document link and the origin are OUR record
    // of where this came from, and the route that proved the gap belongs to this company is the
    // one that should write it. Consistent with §132 rather than a new rule.
    const { data: checklist, error: cErr } = await supabaseAdmin.from('checklists').insert({
      company_id: companyId, user_id: userId, title,
      question: gapId
        ? `From a gap in ${doc.title}: ${gaps[0].title}`.slice(0, 500)
        : `From ${gaps.length} open gaps in ${doc.title}`.slice(0, 500),
      document_id: documentId,
      // Only when it is ONE gap. A checklist covering five gaps belongs to the document, and
      // pinning it to whichever gap happened to be first would put its progress on that row alone.
      document_gap_id: gapId ?? null,
    }).select('id').single()
    if (cErr) throw new Error(`creating the checklist: ${cErr.message}`)

    const rows = [...mustDo, ...good].map((r, i) => ({
      ...r, checklist_id: checklist.id, company_id: companyId, sort_order: i,
    }))
    const { error: iErr } = await supabaseAdmin.from('checklist_items').insert(rows)
    if (iErr) throw new Error(`writing the items: ${iErr.message}`)

    return NextResponse.json({
      checklistId: checklist.id, title,
      gaps: gaps.length,
      counts: { must_do: mustDo.length, good_to_have: good.length },
    })
  } catch (e) {
    console.error('POST /api/document-checklist failed:', e)
    return NextResponse.json(
      { error: 'We could not make a checklist from that just now. Please try again.' }, { status: 500 })
  }
}

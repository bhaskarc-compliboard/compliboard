// TO CONFIRM — one queue, both sources. Documents Run 5.
//
// GET  → the pending proposals, ranked, with where each came from
// POST → Confirm or Not right, and the same route the drawer uses
//
// *** ONE QUEUE, BECAUSE IT IS ONE ROW. *** `fact_proposals` already holds both: the nightly
// summariser writes one carrying a topic and a turn; a document scan writes one carrying a
// document and a locator. A fact confirmed in the report drawer and the same fact confirmed here
// are the same row changing state, so neither place can disagree with the other and nobody
// confirms twice.
//
// *** NOTHING HAS EVER CONSUMED A PROPOSAL UNTIL NOW. *** The summariser has been writing them
// since Run 2 and there was no accept path at all — no route, no screen. So this is the first
// code that turns one into a fact, and it has to handle both destinations:
//
//   · the key names one of the 95 SWITCHES → the existing declared-fact path, exactly as a
//     person answering the question in the workspace would. `company_switches` is what the
//     obligation engine reads and resolution is deterministic against it (§3.2); a second way in
//     would be a second source of truth.
//   · anything else → `company_facts` (migration 050), which computes nothing and exists so the
//     next scan can be shown it and so nobody is asked the same thing twice.
//
// THE RANKING IS STATED ON THE PAGE, not left as a mystery — a queue whose order nobody can
// explain is a queue people scroll past.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

/** Proposals with an "affects" line first, then documents before conversations, then newest. */
export const RANKING_LINE =
  'Ranked by what each answer unblocks: the ones we can say something about first, '
  + 'then what we read in a document, then the newest.'

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { data: proposals } = await db.from('fact_proposals')
      .select('*').eq('company_id', companyId).eq('status', 'proposed')
      .order('created_at', { ascending: false }).order('id', { ascending: false })

    const rows = proposals ?? []
    const docIds = [...new Set(rows.map((r) => r.document_id).filter(Boolean))]
    const topicIds = [...new Set(rows.map((r) => r.topic_id).filter(Boolean))]

    const [docs, topics, switches] = await Promise.all([
      docIds.length
        ? db.from('document_index_v').select('document_id, title').in('document_id', docIds)
        : { data: [] },
      topicIds.length
        ? db.from('topics').select('id, title').in('id', topicIds)
        : { data: [] },
      // Which keys name a switch decides where a confirmation goes, and the page says so on the
      // row rather than surprising somebody after they click.
      db.from('switches').select('id').in('id', [...new Set(rows.map((r) => r.switch_key))]),
    ])
    const docTitle = Object.fromEntries((docs.data ?? []).map((d) => [d.document_id, d.title]))
    const topicTitle = Object.fromEntries((topics.data ?? []).map((t) => [t.id, t.title]))
    const isSwitch = new Set((switches.data ?? []).map((s) => s.id))

    const ranked = rows
      .map((r) => ({
        ...r,
        from: r.document_id
          ? { kind: 'document' as const, title: docTitle[r.document_id] ?? 'a document', locator: r.locator }
          : { kind: 'conversation' as const, title: topicTitle[r.topic_id ?? ''] ?? 'a conversation', locator: null },
        is_switch: isSwitch.has(r.switch_key),
      }))
      .sort((a, b) => {
        // 1. an "affects" line — the proposals we can say something about
        const aff = Number(!!b.affects) - Number(!!a.affects)
        if (aff) return aff
        // 2. documents before conversations
        const src = Number(!!b.document_id) - Number(!!a.document_id)
        if (src) return src
        // 3. newest
        return String(b.created_at).localeCompare(String(a.created_at))
      })

    return NextResponse.json({ proposals: ranked, count: ranked.length, ranking: RANKING_LINE })
  } catch (error) {
    console.error('to-confirm GET:', error)
    return NextResponse.json({ error: 'We could not load what needs confirming.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const proposalId = String(body?.proposal_id ?? '').trim()
    const verdict = body?.verdict
    const reason = body?.reason ? String(body.reason).slice(0, 2000) : null
    if (!proposalId || !['accepted', 'rejected'].includes(verdict)) {
      return NextResponse.json({ error: 'Expected a proposal_id and a verdict.' }, { status: 400 })
    }
    // A REASON IS REQUIRED TO REJECT, here and in the drawer, for the same reason: "not right"
    // with no sentence is a finding buried rather than answered.
    if (verdict === 'rejected' && !reason?.trim()) {
      return NextResponse.json({ error: 'Please say why this is not right.' }, { status: 400 })
    }

    const { data: p } = await db.from('fact_proposals')
      .select('*').eq('id', proposalId).maybeSingle()
    if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (verdict === 'rejected') {
      const { error } = await supabaseAdmin.from('fact_proposals')
        .update({ status: 'rejected', rejected_reason: reason }).eq('id', proposalId)
      if (error) throw error
      return NextResponse.json({ ok: true, wrote: 'nothing' })
    }

    // ---- accepted ----
    const { data: sw } = await db.from('switches')
      .select('id, scope, value_type, allowed_values').eq('id', p.switch_key).maybeSingle()

    if (sw) {
      // THE EXISTING DECLARED-FACT PATH, NOT A COPY OF IT. `/api/switches/answer` writes the
      // determination and the switch row together under a composite FK, refuses a site-scoped
      // fact with no site, checks the enum, and recomputes obligations. Reimplementing any of
      // that here would be a second way into `company_switches` that drifts from the first.
      const res = await fetch(new URL('/api/switches/answer', request.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: request.headers.get('authorization') ?? '',
        },
        body: JSON.stringify({ switch_id: p.switch_key, value: p.proposed_value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // The proposal stays proposed. A fact half-written is worse than one still pending.
        return NextResponse.json(
          { error: err?.error ?? 'We could not record that answer.' }, { status: res.status })
      }
      await supabaseAdmin.from('fact_proposals').update({ status: 'accepted' }).eq('id', proposalId)
      return NextResponse.json({ ok: true, wrote: 'company_switches', switch_id: p.switch_key })
    }

    // Not a switch: `company_facts`, one row per company and key, the newest confirmation
    // replacing the last, carrying the proposal and the document it came from.
    const { error: fErr } = await supabaseAdmin.from('company_facts').upsert({
      company_id: companyId,
      key: p.switch_key,
      // *** NOT `JSON.stringify`. *** `value` is jsonb and supabase-js already serialises what
      // it is given, so stringifying first stored the string INSIDE a JSON string —
      // "\"4410 NW Front Avenue\"" rather than "4410 NW Front Avenue". Caught by reading the
      // row back after the first confirmation rather than trusting the 200.
      value: p.proposed_value,
      basis: p.basis ?? 'read',
      source_document_id: p.document_id ?? null,
      source_proposal_id: proposalId,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    }, { onConflict: 'company_id,key' })
    if (fErr) throw fErr
    await supabaseAdmin.from('fact_proposals').update({ status: 'accepted' }).eq('id', proposalId)
    return NextResponse.json({ ok: true, wrote: 'company_facts', key: p.switch_key })
  } catch (error) {
    console.error('to-confirm POST:', error)
    return NextResponse.json({ error: 'We could not save that just now.' }, { status: 500 })
  }
}

// COMPANY INFORMATION — the page's one read, and its three writes. Task 0, commit 2.
//
// *** NO MODEL CALL LIVES HERE, AND THAT IS THE POINT OF THE PAGE. ***
// Everything on "Company information" is something a person said or confirmed. If this route ever needs
// `lib/ai.ts` it has stopped being the settled record and become another thing that guesses.
//
// THE READ is `buildCompanyContext` (Task 0, commit 1) plus presentation metadata. The context
// function is the one assembly of "who is this company" and is NOT re-implemented here; what this
// route adds is the stuff a SCREEN needs and a PROMPT must never see:
//   · `switches.domain`, `value_type`, `allowed_values` — to group by topic, render a value in
//     plain words, and offer the right editor. Reference data about the question, not about the
//     company.
//   · the carrier proposal's `locator` — where in the document the fact was read.
// Both are deliberately outside `lib/companyContext.ts`: putting them there would widen what every
// prompt's context query selects for the benefit of one screen.
//
// THE WRITES are three, and each one reuses a path that already exists rather than inventing a
// second way in (§3.2: resolution is deterministic against `company_switches`, so a second writer
// would be a second source of truth):
//   · `company`   — name, industry, city, state on `companies`. On the CALLER'S client: authenticated
//                   holds SELECT/INSERT/UPDATE on `companies` and RLS scopes it to their own row.
//   · `declared`  — proxied to `/api/switches/answer`, exactly as `/api/to-confirm` does it. That
//                   route writes the determination and the switch row under a composite FK, refuses
//                   a site-scoped fact with no site, checks the enum, and recomputes obligations.
//   · `confirmed` — `company_facts` on the SERVICE ROLE after ownership is proved, because
//                   `authenticated` holds SELECT only there (migration 056 asserts it).
//
// *** THE QUEUE IS NOT HERE. *** "Waiting for you" reads and writes `/api/to-confirm`, unchanged.
// One confirm path, one place it lives; a copy on this page would drift from the drawer's.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { buildCompanyContext } from '@/lib/companyContext'

/** The fourteen `switches.domain` values as words a person reads. Nothing is invented: these are
 *  the domains in `supabase/seed-data/switches.json`, and an unknown one falls through as itself
 *  rather than being dropped into an "Other" bucket that hides it. */
const TOPIC_WORDS: Record<string, string> = {
  employment: 'Employment', chemicals: 'Chemicals', workplace: 'Workplace', waste: 'Waste',
  air: 'Air', water: 'Water', fire: 'Fire', tanks: 'Tanks', transport: 'Transport',
  exposure: 'Exposure', equipment: 'Equipment', regimes: 'Regimes', profile: 'Profile',
  jurisdiction: 'Jurisdiction',
}

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const ctx = await buildCompanyContext(db, companyId, {
      parts: ['company', 'declared', 'confirmed'],
    })

    // The question's own metadata, for grouping and for the editor. Ordered, like every read that
    // feeds a rendering.
    const ids = [...new Set(ctx.parts.declared.map((d) => d.switchId))].sort()
    const { data: swRows } = ids.length
      ? await db.from('switches')
          .select('id, domain, value_type, allowed_values').in('id', ids).order('id')
      : { data: [] }
    const meta = Object.fromEntries((swRows ?? []).map((s: Record<string, unknown>) =>
      [s.id as string, s]))

    // Where in the document each confirmed fact was read. One query for all of them.
    const propIds = [...new Set(ctx.parts.confirmed.map((f) => f.sourceProposalId).filter(Boolean))].sort()
    const { data: propRows } = propIds.length
      ? await db.from('fact_proposals')
          .select('id, locator').in('id', propIds as string[]).order('id')
      : { data: [] }
    const locatorById = Object.fromEntries((propRows ?? []).map((p: Record<string, unknown>) =>
      [p.id as string, (p.locator as string) ?? null]))

    // *** WAITING IS COUNTED IN PROPOSALS, NOT KEYS, AND THE HEADER SAYS SO. ***
    // The sidebar badge counts QUESTION LINES (what the page shows); this number is the raw count
    // of pending readings, which is what "M waiting" in the header means. The two differ on purpose
    // and each is labelled where it appears.
    const { count: waiting } = await db.from('fact_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'proposed')

    return NextResponse.json({
      company: ctx.parts.company,
      declared: ctx.parts.declared.map((d) => {
        const m = (meta[d.switchId] ?? {}) as Record<string, unknown>
        const domain = (m.domain as string) ?? null
        return {
          ...d,
          domain,
          topic: domain ? (TOPIC_WORDS[domain] ?? domain) : 'Other',
          valueType: (m.value_type as string) ?? null,
          allowedValues: (m.allowed_values as string[]) ?? [],
        }
      }),
      confirmed: ctx.parts.confirmed.map((f) => ({
        ...f,
        locator: f.sourceProposalId ? (locatorById[f.sourceProposalId] ?? null) : null,
      })),
      counts: {
        // SETTLED is both tables, because both are things a person has settled. The header says
        // "N facts settled" and a reader counting the rows on the page must arrive at the same N.
        settled: ctx.parts.declared.length + ctx.parts.confirmed.length,
        declared: ctx.parts.declared.length,
        confirmed: ctx.parts.confirmed.length,
        waiting: waiting ?? 0,
      },
    })
  } catch (error) {
    console.error('GET /api/company-information failed:', error)
    return NextResponse.json(
      { error: 'We could not load your company just now. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const action = String(body?.action ?? '')

    // ------------------------------------------------------------------
    // 1. THE COMPANY ROW — name, industry, city, state.
    // ------------------------------------------------------------------
    if (action === 'company') {
      const patch: Record<string, string | null> = {}
      for (const field of ['name', 'industry', 'city', 'state'] as const) {
        if (body[field] === undefined) continue
        const v = String(body[field] ?? '').trim()
        // A NAME IS REQUIRED AND THE REST MAY BE EMPTIED. Blanking the name would leave every
        // report and every email with nothing to head it; blanking a city is a person telling us
        // they do not want to say, and NULL means that honestly (§21.1's rule about '' vs null).
        if (field === 'name' && !v) {
          return NextResponse.json(
            { error: 'Your company needs a name — it heads every report and every email we send.' },
            { status: 400 })
        }
        patch[field] = v || null
      }
      if (!Object.keys(patch).length) {
        return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
      }
      // The caller's own client. RLS scopes the update to their company, so the `eq` is the
      // second lock rather than the only one.
      const { error } = await db.from('companies').update(patch).eq('id', companyId)
      if (error) throw error
      return NextResponse.json({ ok: true, changed: Object.keys(patch) })
    }

    // ------------------------------------------------------------------
    // 2. A DECLARED FACT — through `/api/switches/answer`, never around it.
    // ------------------------------------------------------------------
    if (action === 'declared') {
      const switchId = String(body?.switch_id ?? '').trim()
      const value = body?.value === undefined || body?.value === null ? '' : String(body.value).trim()
      const entityId = body?.entity_id ? String(body.entity_id) : null
      if (!switchId || !value) {
        return NextResponse.json({ error: 'Expected a switch_id and a value.' }, { status: 400 })
      }
      // THE SAME PROXY `/api/to-confirm` USES, and for the same reason recorded there: that route
      // writes `switch_determinations` and `company_switches` together under a composite FK,
      // enforces the site rule and the enum, sets `user_locked` so a later determination cannot
      // overwrite a person, and recomputes obligations so the answer visibly moves something.
      // Reimplementing any of it here would be a second way into `company_switches`.
      const res = await fetch(new URL('/api/switches/answer', request.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: request.headers.get('authorization') ?? '',
        },
        body: JSON.stringify({ switch_id: switchId, value, entity_id: entityId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        return NextResponse.json(
          { error: j?.error ?? 'We could not record that answer.' }, { status: res.status })
      }
      return NextResponse.json({ ok: true, wrote: 'company_switches', ...j })
    }

    // ------------------------------------------------------------------
    // 3. A CONFIRMED FACT — a person typing over what a document said.
    // ------------------------------------------------------------------
    if (action === 'confirmed') {
      const key = String(body?.key ?? '').trim()
      const value = String(body?.value ?? '').trim()
      const entityId = body?.entity_id ? String(body.entity_id) : null
      if (!key || !value) {
        return NextResponse.json({ error: 'Expected a key and a value.' }, { status: 400 })
      }

      // OWNERSHIP FIRST, ON THE CALLER'S CLIENT, BEFORE THE SERVICE ROLE TOUCHES ANYTHING.
      // The row must already exist: this action EDITS a settled fact, it does not invent one. A
      // key nobody has confirmed is a 404 rather than a new row, so this cannot become a second
      // way to write a fact that skipped the queue.
      const existing = await db.from('company_facts')
        .select('id, key, entity_id').eq('company_id', companyId).eq('key', key)
      if (existing.error) throw existing.error
      const row = (existing.data ?? []).find((r: Record<string, unknown>) =>
        ((r.entity_id as string) ?? null) === entityId)
      // 404, not 403, so a key cannot be probed by watching which error comes back (§3.6).
      if (!row) return NextResponse.json({ error: 'Fact not found' }, { status: 404 })

      // A site was named: it must be this company's. The composite FK from migration 055 would
      // refuse another company's site anyway; this turns a 23503 into a sentence.
      if (entityId) {
        const { data: site } = await db.from('entities')
          .select('id').eq('id', entityId).eq('company_id', companyId).maybeSingle()
        if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
      }

      // *** `basis: 'declared'`, AND `source_document_id: null`. Migration 056. ***
      //
      // The person typed this. `read` would claim the words are in a document and `inferred` that a
      // model worked them out, and both would be false — which is why 056 exists rather than this
      // picking the least wrong of two.
      //
      // *** THE PROPOSAL ROW IS NOT TOUCHED, AND IT IS THE HISTORY. *** `fact_proposals` keeps the
      // accepted row with what the document said, its quote and its locator, so "the permit said
      // 42 and somebody corrected it to 38" is still answerable from the database. What this drops
      // is the POINTER from the fact to that row: a fact a person typed does not have a document
      // source or a carrier proposal, and leaving either set would make the record claim a
      // provenance the value no longer has. The trail runs the other way, from
      // `fact_proposals.switch_key`.
      const { error } = await supabaseAdmin.from('company_facts').upsert({
        company_id: companyId,
        key,
        entity_id: entityId,
        value,
        basis: 'declared',
        source_document_id: null,
        source_proposal_id: null,
        // The as-of date belonged to the document. A value a person typed is true as of now, and
        // saying "as of 2021" over their own words would be the record contradicting them.
        as_of: null,
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      }, { onConflict: 'company_id,key,entity_id' })
      if (error) throw error
      return NextResponse.json({ ok: true, wrote: 'company_facts', key })
    }

    return NextResponse.json(
      { error: 'Expected an action of company, declared or confirmed.' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/company-information failed:', error)
    return NextResponse.json(
      { error: 'We could not save that just now. Please try again.' }, { status: 500 })
  }
}

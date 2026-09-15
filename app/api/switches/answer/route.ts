/**
 * POST /api/switches/answer — A PERSON ESTABLISHES A FACT.
 *
 * Phase 7.2a, and the first thing in this codebase that writes a `company_switches` row from a
 * request. Until now every switch value came from `scripts/seed-multisite-fixture.js`.
 *
 * *** THREE WRITES, IN ONE ORDER, AND THE ORDER IS THE POINT. ***
 *
 *   1. switch_determinations  — the append-only history. Written FIRST because
 *   2. company_switches       — carries `(determined_from, evidence_class)` as a COMPOSITE FK
 *                               back to it (migration 017), so the denormalised copy cannot
 *                               drift from the determination it came from.
 *   3. obligations            — recomputed, because a fact that moves nothing is a fact nobody
 *                               can see moved.
 *
 * *** IT DOES NOT CLOSE THE LOOP SILENTLY. *** The response carries `unblocked` and the
 * obligation delta, because §54 says one answer unlocks one level and `CHEMICAL-OR-WA.md` §6.4
 * says the number of things an answer moves is what makes a person willing to give another.
 *
 * *** A HYPOTHETICAL NEVER REACHES HERE. *** §78: a fact invented for a question — "the Arizona
 * facility would have 12 employees" — is not a fact about this company and is not stored
 * anywhere. It lives in the conversation the gate reads. This route writes only what a person
 * states about their own operation, today.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { fromUserAnswer } from '@/lib/switchDetermination'
import { newlyUnblocked, establishedFrom, type SwitchRow, type Established } from '@/lib/switchAsk'
import { switchesIn, type Expression } from '@/lib/appliesExpression'
import { writeObligations } from '@/lib/obligationWriter'

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    const body = await request.json().catch(() => null)
    const switchId = typeof body?.switch_id === 'string' ? body.switch_id : null
    const rawValue = body?.value
    const entityId = typeof body?.entity_id === 'string' ? body.entity_id : null
    if (!switchId || rawValue === undefined || rawValue === null || rawValue === '') {
      return NextResponse.json({ error: 'switch_id and value are required.' }, { status: 400 })
    }
    // Text, always. `company_switches.value` is text for every switch and the coercion happens
    // at read time in `coerceFact` — one place, not two (§43).
    const value = String(rawValue)

    const { data: sw } = await db
      .from('switches')
      .select('id, scope, value_type, allowed_values, question_plain, determination_source, depends_on_switch, depends_on_value')
      .eq('id', switchId).maybeSingle()
    if (!sw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // --- the two refusals, both before any write ---

    // A SITE-SCOPED FACT CANNOT BE WRITTEN WITHOUT A SITE. The CHECK constraint would refuse
    // it anyway; refusing here names the problem instead of surfacing a constraint. And
    // defaulting to the primary site is forbidden — §20, WORKSPACE v3.3.
    if (sw.scope === 'site' && !entityId) {
      return NextResponse.json(
        { error: 'This question is about one site. Tell us which one.' }, { status: 400 })
    }
    if (entityId) {
      const { data: site } = await db
        .from('entities').select('id').eq('id', entityId).eq('company_id', companyId).maybeSingle()
      if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (sw.value_type === 'enum' && (sw.allowed_values ?? []).length > 0
        && !(sw.allowed_values as string[]).includes(value)) {
      return NextResponse.json(
        { error: `"${value}" is not one of the accepted answers.` }, { status: 400 })
    }

    // --- what was true before, for the delta and for §49's overwrite history ---
    const { data: beforeRows } = await db
      .from('company_switches').select('switch_id, entity_id, value, state').eq('company_id', companyId)
    const { data: allSwitches } = await db.from('switches').select('id, scope, value_type, allowed_values, question_plain, determination_source, depends_on_switch, depends_on_value')
    const valueTypeOf = Object.fromEntries((allSwitches ?? []).map((x) => [x.id, x.value_type]))
    // Same one definition as the ask route and `splitFacts` — §43.
    const before: Established = establishedFrom(beforeRows ?? [], valueTypeOf)
    const priorRow = (beforeRows ?? []).find(
      (r) => r.switch_id === switchId && (r.entity_id ?? null) === entityId)

    const det = fromUserAnswer(switchId, value, sw.question_plain ?? switchId,
      priorRow ? { value: priorRow.value, at: null } : null)

    // --- 1. the determination, first, because the switch row points AT it ---
    const { data: determination, error: detErr } = await db
      .from('switch_determinations')
      .insert({
        company_id: companyId, entity_id: entityId, switch_id: switchId,
        value: det.value, evidence_class: det.evidenceClass, confidence: det.confidence,
        source: det.source, reasoning: det.reasoning,
        document_id: null, locator: null, quote: null,
      })
      .select('id, evidence_class').single()
    if (detErr) throw new Error(`Could not record your answer: ${detErr.message}`)

    // --- 2. the switch value, pinned to that determination by the composite FK ---
    const { error: csErr } = await db
      .from('company_switches')
      .upsert({
        company_id: companyId, entity_id: entityId, switch_id: switchId, scope: sw.scope,
        value: det.value, state: 'known', source: det.source,
        evidence_class: determination.evidence_class, determined_from: determination.id,
        determined_at: new Date().toISOString(), basis: det.basis,
        user_locked: true,   // a person said it; determination may not overwrite it (v3.2)
      }, { onConflict: 'company_id,switch_id,entity_id' })
    if (csErr) throw new Error(`Could not record your answer: ${csErr.message}`)

    // --- 3. recompute, so the answer visibly moves something ---
    const after: Established = { ...before }
    after[entityId ? `${switchId}@${entityId}` : switchId] = value

    const { data: obsBefore } = await db
      .from('obligations').select('status').eq('company_id', companyId).is('applicable_to', null)
    const countBy = (rows: Array<{ status: string }> | null) => {
      const o: Record<string, number> = {}
      for (const r of rows ?? []) o[r.status] = (o[r.status] ?? 0) + 1
      return o
    }
    const statusBefore = countBy(obsBefore)

    const written = await writeObligations(db, companyId)
    const statusAfter = countBy(written.obligations.map((o) => ({ status: o.status })))

    // --- what this answer unlocked. ONE LEVEL, never a cascade (§54) ---
    const { data: reqs } = await db
      .from('requirement_templates').select('id, applies_expression').is('effective_to', null)
    const requirementSwitches = (reqs ?? []).map((r) => ({
      requirementId: r.id,
      switchIds: r.applies_expression ? switchesIn(r.applies_expression as unknown as Expression) : [],
    }))
    const unblocked = newlyUnblocked(
      (allSwitches ?? []) as SwitchRow[], before, after, requirementSwitches, entityId)

    return NextResponse.json({
      written: true,
      switch_id: switchId,
      entity_id: entityId,
      evidence_class: determination.evidence_class,
      state: 'known',
      unblocked,
      obligations: { before: statusBefore, after: statusAfter, persisted: written.persisted },
    })
  } catch (error) {
    console.error('[/api/switches/answer] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'We could not record your answer.' },
      { status: 500 },
    )
  }
}


/**
 * GET /api/switches/ask — WHAT WE CAN USEFULLY ASK THIS COMPANY NEXT.
 *
 * Phase 7.2a. `lib/switchAsk.ts` has had six exports and six tests since 13 September and
 * **no production caller** — this is the caller (`AUDIT-CHECKS.md` check 29). Nothing in
 * `app/` has ever written or read a `company_switches` row through a request; Test Alpha's
 * 16 facts came from `scripts/seed-multisite-fixture.js`.
 *
 * *** IT RETURNS THREE STATES, NOT ONE LIST. *** `DECISIONS.md` §58.2 and `WORKSPACE.md` v3.5:
 *
 *   askable   — parent known, or no parent. The queue.
 *   blocked   — parent not established. SHOWN, greyed, with what blocks it.
 *   excluded  — parent came back FALSE. ABSENT ENTIRELY, not listed as blocked.
 *
 * A site with no hazardous chemicals is not *pending* a lead-exposure answer; that question
 * does not exist for them. `askableSwitches()` drops excluded rows on its own, so "excluded"
 * is expressed here as absence rather than as a field — which is the point.
 *
 * ORDERING IS THE DEPENDENCY GRAPH, NEVER A PREFERENCE. `only_a_person` first (a question no
 * document will ever answer deserves different weight from one an upload might), then
 * `affects` descending — the transitive count is what makes a person willing to answer
 * (`CHEMICAL-OR-WA.md` §6.4).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { askableSwitches, establishedFrom, type SwitchRow } from '@/lib/switchAsk'
import { switchesIn, type Expression } from '@/lib/appliesExpression'

export async function GET(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    // The site to ask about. Absent means company-scoped questions only — NOT a default to
    // the primary site, which is the failure DECISIONS.md §20 exists to prevent: a
    // company-wide answer to a per-site question is wrong at every site but one, confidently.
    const entityId = request.nextUrl.searchParams.get('entity_id')

    if (entityId) {
      // Tenancy on the parameter, before it reaches a query. 404 rather than 403 so an id
      // cannot be probed by watching which error comes back (CLAUDE.md §3.6).
      const { data: site } = await db
        .from('entities').select('id').eq('id', entityId).eq('company_id', companyId).maybeSingle()
      if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [{ data: switches, error: swErr }, { data: values, error: csErr }, { data: reqs, error: rtErr }] =
      await Promise.all([
        db.from('switches').select('id, scope, value_type, allowed_values, question_plain, determination_source, depends_on_switch, depends_on_value'),
        db.from('company_switches').select('switch_id, entity_id, value, state').eq('company_id', companyId),
        db.from('requirement_templates').select('id, applies_expression').is('effective_to', null),
      ])
    if (swErr) throw new Error(swErr.message)
    if (csErr) throw new Error(csErr.message)
    if (rtErr) throw new Error(rtErr.message)

    // ONE definition of "established", shared with `splitFacts` through `isEstablished()`.
    // A local copy here would be a third one, and §43 exists because this rule was got wrong
    // once already.
    const valueTypeOf = Object.fromEntries((switches ?? []).map((x) => [x.id, x.value_type]))
    const est = establishedFrom(values ?? [], valueTypeOf)

    // Which switches any live requirement actually names. A switch no condition references
    // cannot move an obligation, so asking about it spends a question for nothing — and 12 of
    // the 95 are in that state (TODO 6.4d).
    const requirementSwitches = (reqs ?? []).map((r) => ({
      requirementId: r.id,
      switchIds: r.applies_expression ? switchesIn(r.applies_expression as unknown as Expression) : [],
    }))

    const asks = askableSwitches(
      (switches ?? []) as SwitchRow[], est, requirementSwitches, entityId,
    )

    const ready = asks.filter((a) => a.blocked_by.length === 0)
    const blocked = asks.filter((a) => a.blocked_by.length > 0)

    // A person first, then by what answering unblocks. Never alphabetical, never by id.
    const rank = (a: typeof asks[number], b: typeof asks[number]) =>
      Number(b.only_a_person) - Number(a.only_a_person) || b.affects - a.affects
    ready.sort(rank)
    blocked.sort(rank)

    return NextResponse.json({
      entityId,
      ready,
      blocked,
      // No total, and deliberately: a count of "questions remaining" asserts a denominator
      // the coverage strip says we do not have (§58.3). The lists are their own count.
    })
  } catch (error) {
    console.error('[/api/switches/ask] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'We could not work out what to ask you next.' },
      { status: 500 },
    )
  }
}


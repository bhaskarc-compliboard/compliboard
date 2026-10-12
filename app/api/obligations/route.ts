import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { writeObligations, previousIndustryOf } from '@/lib/obligationWriter'
import { holdNote, industryWords, type Hold, type HoldNote } from '@/lib/obligationHold'
import { mustRow, mustRows, mustCount } from '@/lib/mustRead'

/**
 * GET /api/obligations — M6's only data source.
 *
 * *** IT RESOLVES LAZILY: if this company's obligations have never been computed, this request
 * computes and stores them. *** `DECISIONS.md` §60. Not at signup, because writing at signup
 * decides what a company sees before they have told us anything, and that is M7's decision.
 * Lazy leaves M7 free to trigger a write at signup later; eager takes the choice away.
 *
 * SYNCHRONOUS. Measured: 1.1 ms of compute, ~243 ms of round trips, 221 obligations for a
 * two-site company. Backgrounding it would settle the worker's contract before Phase 5 is
 * specced. `lib/obligationWriter.ts` records what would change that answer.
 *
 * ONE ENDPOINT, ONE SHAPE. M6 is the only consumer, and a second endpoint would be two
 * contracts for one question.
 *
 * *** WHAT THIS NO LONGER RETURNS, AND WHY IT MATTERS THAT IT IS GONE FROM HERE TOO. *** The
 * previous version returned `counts: { total, missing, satisfied }` — a numeric aggregate, of
 * two statuses that cannot occur under the current enum. `DECISIONS.md` §58.3 forbids the
 * screen rendering one, and `lib/requirementsView.ts` is where that is enforced — but a count
 * the route still computes is one `const` away from reappearing on a page. It is removed at
 * the source.
 */
export async function GET(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    // A15's shape (E4): "Company not found" from a failed read is a claim about their own
    // company, and `.single()` reports a missing row and a broken query the same way — so
    // `maybeSingle` tells them apart, as `lib/obligationWriter.ts` does for the same reason (W1).
    const company = mustRow<{ id: string; industry: string | null; state: string | null
                              obligations_computed_at: string | null
                              obligations_hold: Hold | null }>('your company', await db
      .from('companies')
      .select('id, industry, state, obligations_computed_at, obligations_hold')
      .eq('id', companyId)
      .maybeSingle())

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    // NULL means NEVER COMPUTED, which is a different state from "computed and nothing
    // applies" — and a row count cannot tell them apart (migration 022).
    let computedAt = company.obligations_computed_at
    // *** D2: A HELD RECOMPUTE IS NOT A COMPUTATION, AND THE PAGE STILL LOADS. *** `held` comes
    // back when the recompute would have closed all of the open list or more than half of it: the
    // rows are untouched, the hold is recorded (migration 083), and the note below asks the person.
    let hold: Hold | null = company.obligations_hold ?? null
    if (!computedAt) {
      const written = await writeObligations(db, companyId)
      computedAt = written.computedAt
      hold = written.held ?? hold
    }

    // TWO QUERIES, JOINED IN CODE — not one embed.
    //
    // `obligation_evidence_state` is a VIEW with no foreign-key relationship behind it, and
    // PostgREST can only embed what a FK describes. Writing it as an embed typechecks, reads
    // naturally, and fails at request time. Caught by `npm run check:schema`, which validates
    // query strings against the generated types precisely because tsc cannot see into them
    // (CLAUDE.md §3.6).
    const { data: rows, error } = await db
      .from('obligations')
      .select('id, entity_id, requirement_template_id, status, resolution_rationale, determined_by, requirement_templates(requirement_name, citation, category, agency_id), entities(name)')
      .eq('company_id', companyId)
      .is('applicable_to', null)
    if (error) throw new Error(error.message)

    // *** W6 (root R2, Job E4): A FAILED EVIDENCE READ MADE EVERY OWED ROW SAY "NOTHING YET." ***
    // The page's line for a requirement with no evidence is "Nothing yet. No document has been
    // linked to this requirement." — true when there is none, and a flat untruth for all of them at
    // once when the read failed. `obligation_evidence_state` is the view that filters expiry so no
    // consumer can forget it (§3.2); reading it as empty says every requirement is unproven.
    const [evidenceRes, agencyRes] = await Promise.all([
      db.from('obligation_evidence_state')
        .select('obligation_id, live_evidence, expired_evidence, contradicting_evidence, next_expiry')
        .eq('company_id', companyId),
      db.from('agencies').select('id, short_name'),
    ])
    const evidenceFor = Object.fromEntries(
      mustRows<Record<string, unknown>>('what you have shown for each requirement', evidenceRes)
        .map((e) => [e.obligation_id as string, e]))
    const agencyName = Object.fromEntries(
      mustRows<{ id: string; short_name: string }>('the regulators', agencyRes)
        .map((a) => [a.id, a.short_name]))

    const shaped = (rows ?? []).map((o) => {
      const rt = o.requirement_templates as unknown as {
        requirement_name: string; citation: string | null; category: string | null
        agency_id: string | null
      }
      const ev = evidenceFor[o.id] ?? null
      const det = (o.determined_by ?? {}) as { switches_missing?: string[]; inventory_missing?: string[] }
      return {
        obligationId: o.id,
        requirementName: rt.requirement_name,
        citation: rt.citation ?? '',
        agency: rt.agency_id ? (agencyName[rt.agency_id] ?? null) : null,
        category: rt.category,
        status: o.status,
        resolutionRationale: o.resolution_rationale ?? '',
        siteName: (o.entities as unknown as { name: string } | null)?.name ?? null,
        liveEvidence: ev?.live_evidence ?? 0,
        expiredEvidence: ev?.expired_evidence ?? 0,
        contradictingEvidence: ev?.contradicting_evidence ?? 0,
        nextExpiry: ev?.next_expiry ?? null,
        evidenceNames: [] as string[],
        factsNeeded: det.switches_missing ?? [],
        inventoryNeeded: det.inventory_missing ?? [],
      }
    })

    // The coverage strip's inputs. Facts about the LIBRARY, not about this customer —
    // which is the distinction §58.3 draws, and the only numbers this response carries.
    // W6's second half: the coverage strip. "0 requirements are loaded" is a statement about the
    // LIBRARY, and `mustCount` also refuses a null count with no error.
    const [reqCount, agencyCount, verifiedCount, swCount, swDocCount] = await Promise.all([
      db.from('requirement_templates').select('*', { count: 'exact', head: true }).is('effective_to', null),
      db.from('agencies').select('*', { count: 'exact', head: true }),
      db.from('requirement_templates').select('*', { count: 'exact', head: true }).is('effective_to', null).eq('status', 'verified'),
      db.from('switches').select('*', { count: 'exact', head: true }),
      db.from('switches').select('*', { count: 'exact', head: true }).eq('determination_source', 'documents'),
    ])

    /**
     * *** THE NOTE ON TOP, WHEN A RECOMPUTE IS HELD — D2.1. ***
     *
     * Composed here rather than on the page for the same reason every other sentence on this screen
     * is (`lib/requirementsView.ts`'s header): a rule about wording is testable only where the
     * wording is produced. The two extra reads happen ONLY when something is held, which is rare
     * and never on the ordinary path.
     *
     * `industry_has_library` is also what the empty state needs (D2.4), and it is on the hold — so
     * when nothing is held the library is asked once, by industry, and the answer is a count.
     */
    let note: HoldNote | null = null
    let industryHasLibrary = true
    if (hold) {
      const library = mustRows<{ id: string; industries: string[] | null }>('the requirement library',
        await db.from('requirement_templates').select('id, industries').is('effective_to', null))
      const was = previousIndustryOf(
        (rows ?? []).map((o) => o.requirement_template_id as string), library, company.industry)
      note = holdNote(hold, industryWords, was)
      industryHasLibrary = hold.industry_has_library
    } else if (!shaped.length) {
      // Nothing open and nothing held: the empty state has to say whether zero is a finding about
      // this company or the library's silence about their industry (D2.4). Counted, not fetched.
      industryHasLibrary = mustCount('requirements for your industry', await db
        .from('requirement_templates').select('*', { count: 'exact', head: true })
        .is('effective_to', null).contains('industries', [company.industry ?? ''])) > 0
    }

    return NextResponse.json({
      rows: shaped,
      /** D2: the note, its buttons, and what the empty state may claim. Null when nothing is held. */
      hold: note ? { ...note, heldAt: hold?.held_at ?? null } : null,
      industryHasLibrary,
      coverage: {
        requirements: mustCount('the requirement library', reqCount),
        agencies: mustCount('the regulators', agencyCount),
        verified: mustCount('the verified requirements', verifiedCount),
        switchesTotal: mustCount('the facts we track', swCount),
        switchesFromDocuments: mustCount('the facts read from documents', swDocCount),
      },
      computedAt,
    })
  } catch (error) {
    // *** LOG IT SERVER-SIDE, WITH THE STACK. *** On 13 Sep this route returned a 500 whose
    // cause was a one-line Postgres refusal, and the dev log carried `500 in 645ms` and
    // nothing else — the message was in the response body and nowhere a developer looks.
    // Returning an error to the caller is not recording it. DECISIONS.md §63.
    console.error('[/api/obligations] failed:', error)

    // §5.1 — plain language, and never a claim about data we did not read.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'We could not work out your requirements.' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/obligations — THE PERSON'S ANSWER TO A HELD RECOMPUTE (the owner's decision **D2.3**).
 *
 *   { action: 'confirm' }  "Yes, they no longer apply"  — the recompute runs, and every row it
 *                          closes records that this login asked for it, on today's date
 *                          (migration 081).
 *   { action: 'keep' }     "Keep them"                  — the note goes, the list stays open, and
 *                          nothing is closed. The next recompute will ask again, because nothing
 *                          about their answers has changed — which is the honest outcome, not a
 *                          loop: it asks only when a recompute happens.
 *
 * "No, change my industry back" is not here. It is a link to Company information, where the
 * industry is changed the way it is changed everywhere else; a second path for one field would be
 * two places for the same write.
 *
 * *** IT REFUSES WHEN NOTHING IS HELD. *** A confirm with no hold would reconcile the list without
 * anybody having been asked — the dead end's mirror image, and a close a person did not ask for.
 */
export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, userId, db } = authed.auth

  try {
    const body = await request.json().catch(() => null)
    const action = String(body?.action ?? '')
    if (action !== 'confirm' && action !== 'keep') {
      return NextResponse.json({ error: 'Expected action "confirm" or "keep".' }, { status: 400 })
    }

    const company = mustRow<{ obligations_hold: Hold | null }>('your company', await db
      .from('companies').select('obligations_hold').eq('id', companyId).maybeSingle())
    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    if (!company.obligations_hold) {
      return NextResponse.json(
        { error: 'There is nothing waiting for you to confirm. Reload the page to see your current requirements.' },
        { status: 409 })
    }

    if (action === 'keep') {
      const { error } = await db.from('companies').update({ obligations_hold: null }).eq('id', companyId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, closed: 0, kept: company.obligations_hold.would_close })
    }

    // CONFIRM. The recompute is run again rather than the held numbers being acted on: the stored
    // hold is a record of one moment, and what closes must be what is true now.
    const written = await writeObligations(db, companyId, { confirmedBy: userId })
    return NextResponse.json({
      ok: true,
      closed: Number(written.persisted.closed ?? 0),
      computedAt: written.computedAt,
    })
  } catch (error) {
    console.error('[/api/obligations POST] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'We could not record that just now.' },
      { status: 500 })
  }
}

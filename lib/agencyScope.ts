/**
 * WHICH AGENCIES HAVE JURISDICTION OVER THIS COMPANY.
 *
 * Stage 2 of the runtime pipeline (CHEMICAL-OR-WA.md §5.2) is NOT BUILT. This is not it: it
 * returns every agency with jurisdiction over the company's primary site and industry, and
 * makes no judgement about which are relevant to a particular question. That judgement IS
 * Stage 2, and it is the part that does not exist.
 *
 * WHY THAT IS THE RIGHT SHAPE FOR NOW, and not a stopgap. The critic's question 6 asks what
 * is CONSPICUOUSLY ABSENT. A list that is too broad produces a false positive a human can
 * dismiss; a missing list produces a silent gap nobody sees. Those costs are not symmetrical.
 * docs/CRITIC-PASS.md §5.
 *
 * WHEN STAGE 2 EXISTS the list narrows and this function's callers do not change — same name,
 * same shape, populated from a query instead of the whole jurisdiction. That is the identical
 * arrangement as `gate.resolved`, and for the identical reason: the golden cases keep
 * asserting across the swap.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ScopedAgency {
  short_name: string
  name: string
}

export async function agenciesInScopeFor(
  companyId: string,
  db: SupabaseClient<any, any, any>
): Promise<ScopedAgency[]> {
  // Jurisdiction comes from the SITE, not the company — DECISIONS.md §20, and migration 010
  // guarantees every company has a primary one.
  const { data: site } = await db
    .from('entities')
    .select('state, county, city')
    .eq('company_id', companyId)
    .eq('is_primary', true)
    .maybeSingle()

  const { data: company } = await db
    .from('companies')
    .select('industry')
    .eq('id', companyId)
    .maybeSingle()

  const industry = (company as { industry?: string } | null)?.industry
  if (!industry) return []

  const s = site as { state?: string; county?: string; city?: string } | null

  const { data: agencies } = await db
    .from('agencies')
    .select('short_name, name, jurisdiction_level, jurisdiction_state, jurisdiction_county, jurisdiction_city, industries')
    .contains('industries', [industry])

  return (agencies ?? []).filter((a: any) => {
    switch (a.jurisdiction_level) {
      case 'federal': return true
      case 'state':   return !!s?.state && a.jurisdiction_state === s.state
      case 'county':  return !!s?.county && a.jurisdiction_county === s.county
      case 'city':    return !!s?.city && a.jurisdiction_city === s.city
      // `local` matches on state alone: which fire district or sewer authority covers an
      // address is not derivable from the address, and is asked (DECISIONS.md §25.2).
      // A generic row is the honest state.
      //
      // *** AND CORRECTED 21 OCTOBER 2026: this used to read "asked rather than geocoded",
      // which implied the levels above it ARE geocoded. None of them is. *** Nothing in this
      // codebase geocodes an address; `state` and `city` are typed at signup and `county` is
      // never asked for at all (`app/signup/page.tsx:174` sends `county: ''`, which migration
      // 010:84 turns into NULL), so THE `county` BRANCH ABOVE CANNOT MATCH FOR ANY COMPANY
      // CREATED THROUGH SIGNUP — every county-level agency is silently out of scope. The full
      // chain is written out in lib/determinationGate.ts' jurisdiction block. My Account step 6
      // adds the Census Geocoder behind its own variable; this comment says what is true until
      // then, and the behaviour here is deliberately unchanged.
      case 'local':   return !!s?.state && a.jurisdiction_state === s.state
      default:        return false
    }
  }).map((a: any) => ({ short_name: a.short_name, name: a.name }))
}

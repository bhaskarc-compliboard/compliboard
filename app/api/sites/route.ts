/**
 * THE SITES A PERSON ADDS AND EDITS — My Account step 6 (`ACCOUNT-PLAN.md` decisions 4, 16).
 *
 * POST adds a site, PATCH edits one. Both do the same two things in the same order: **geocode the
 * address, then write the row as the caller.**
 *
 * *** AS THE CALLER, NEVER THE SERVICE ROLE. *** `authed.db` throughout. Migration 082 is the
 * boundary and this route is not allowed to step round it: a person may insert `company_id,
 * entity_type, name, address, postal_code, state, county, city, fire_authority` and update all but
 * the first two, `is_primary` is in neither grant, and `entities_insert`'s WITH CHECK demands
 * `company_id = auth_company_id() and entity_type = 'site' and is_primary = false`. So the
 * interesting failures here come back from Postgres rather than from an `if` in this file, which is
 * `CLAUDE.md` §3.6's whole argument. `company_id` is the session's (`requireCompany`), never the
 * body's.
 *
 * *** WHY A ROUTE AT ALL, when the page could insert through its own client. *** The geocoder. It
 * is an outbound call to a third party with a URL in a variable and a timeout, and doing it in the
 * browser would put the service's shape, its benchmark and its failure modes into a client bundle —
 * and let a person choose what the geocoder "returned". Decision 4 says state and county are read
 * from the address and never typed; that is only true if the person is not the one reading them.
 *
 * *** AND THE ONE RULE THAT MATTERS MOST: state, county, city and postal_code COME FROM THE
 * GEOCODER OR THEY COME FROM NOWHERE. *** On a match they are written from the geocoder and the
 * body's own values for them are ignored entirely. On no match they are written NULL — including
 * on an edit, where the old county belonged to the OLD address and keeping it would be the product
 * asserting that a new address sits in a county nobody resolved (`CLAUDE.md` §3.2: jurisdiction is
 * part of the match key, and serving the wrong county is a silent, dangerous failure). The site is
 * still saved either way, with the name and the address exactly as typed, and the person is told.
 *
 * The one exception a person is allowed: **a typed county, when the geocoder did not match.**
 * Decision 4 says state and county are read from the address — that is the rule, and a customer who
 * knows their own county should not be stopped by a service that has never heard of their road. It
 * is accepted ONLY when nothing was resolved, so it can never overwrite a resolved county.
 *
 * > *** AND THE ROW DOES NOT SAY WHERE IT CAME FROM. A GAP, RECORDED FOR 083. ***
 * > `entities` has no provenance column, and 082's grants give a person seven columns —
 * > `name, address, postal_code, state, county, city, fire_authority` — none of which is a source.
 * > `details` is jsonb and would hold it, but it is in neither the INSERT nor the UPDATE grant, so a
 * > person cannot write it and this route runs as the person. The brief for this step says not to
 * > add a column, so a typed county is stored in `county` **indistinguishable from a resolved one**.
 * > That is a real loss: `lib/determinationGate.ts` labels a site's county `ai_from_profile`, and
 * > for a typed one that label is now wrong in the other direction. Migration 083 should add
 * > `entities.county_source` (`geocoded` | `typed`) and backfill it `geocoded`, and the gate should
 * > read it. Until then this comment is the record.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { geocodeAddress, NOT_FOUND_SENTENCE, type GeocodeResult } from '@/lib/geocode'

/** What a person may send. Anything else in the body is ignored rather than refused. */
interface SiteBody {
  id?: unknown
  name?: unknown
  address?: unknown
  /** Accepted only when the geocoder found nothing. See the header. */
  county?: unknown
}

/** The columns the page reads back. `is_primary` is read, never written. */
const SITE_COLUMNS =
  'id, name, address, postal_code, state, county, city, is_primary, entity_type, created_at'

const NAME_REQUIRED = 'A site needs a name — something you would call it, like "Portland plant".'
const ADDRESS_REQUIRED = 'A site needs an address, so we can work out which rules reach it.'
const NOT_FOUND_SITE = 'Not found'
const WRITE_FAILED = 'We could not save that site just now. Nothing was changed.'

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * The four address-derived columns, from one geocode result. A miss is four NULLs and not four
 * absent keys: on an edit the columns must be CLEARED, and a patch that omitted them would leave
 * the old address's county on the new address.
 */
function placeColumns(geo: GeocodeResult, typedCounty: string) {
  if (geo.matched) {
    return { state: geo.state, county: geo.county, city: geo.city, postal_code: geo.postal_code }
  }
  return { state: null, county: typedCounty || null, city: null, postal_code: null }
}

/** What the drawer needs to say: did it resolve, and if not, the one sentence plus the county box. */
function geocodeReport(geo: GeocodeResult) {
  return {
    matched: geo.matched,
    // The reason is OURS, for a log and for a report. The person is shown `message`.
    reason: geo.matched ? null : geo.reason,
    message: geo.matched ? null : NOT_FOUND_SENTENCE,
    // The box is offered whenever nothing was resolved — including when the geocoder is switched
    // off, where it is the only way a county is ever known.
    ask_county: !geo.matched,
  }
}

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    const body = (await request.json().catch(() => null)) as SiteBody | null
    const name = text(body?.name)
    const address = text(body?.address)
    if (!name) return NextResponse.json({ error: NAME_REQUIRED }, { status: 400 })
    if (!address) return NextResponse.json({ error: ADDRESS_REQUIRED }, { status: 400 })

    const geo = await geocodeAddress(address)

    // `entity_type: 'site'` because the policy demands it; `is_primary` is NOT sent, because it is
    // in no grant and its column default is false (migration 007:343) — which is what the policy
    // then checks. `company_id` is the session's.
    const { data, error } = await db
      .from('entities')
      .insert({
        company_id: companyId,
        entity_type: 'site',
        name,
        address,
        ...placeColumns(geo, text(body?.county)),
      })
      .select(SITE_COLUMNS)
      .single()

    if (error) {
      console.error('[/api/sites POST] insert refused:', error.message)
      return NextResponse.json({ error: WRITE_FAILED }, { status: 400 })
    }
    return NextResponse.json({ site: data, geocode: geocodeReport(geo) })
  } catch (err) {
    console.error('[/api/sites POST] failed:', err)
    return NextResponse.json({ error: WRITE_FAILED }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    const body = (await request.json().catch(() => null)) as SiteBody | null
    const id = text(body?.id)
    const name = text(body?.name)
    const address = text(body?.address)
    if (!id) return NextResponse.json({ error: NOT_FOUND_SITE }, { status: 404 })
    if (!name) return NextResponse.json({ error: NAME_REQUIRED }, { status: 400 })
    if (!address) return NextResponse.json({ error: ADDRESS_REQUIRED }, { status: 400 })

    // Tenancy on the id before it reaches a write, and 404 rather than 403 so an id cannot be
    // probed by watching which error comes back (§3.6). RLS would refuse the update anyway; this is
    // what makes the refusal say the right thing.
    const { data: current } = await db
      .from('entities').select('id, address, is_primary')
      .eq('id', id).eq('company_id', companyId).maybeSingle()
    if (!current) return NextResponse.json({ error: NOT_FOUND_SITE }, { status: 404 })

    /**
     * *** AN UNCHANGED ADDRESS IS NOT RE-GEOCODED, AND THAT IS NOT AN OPTIMISATION. ***
     * Renaming a site would otherwise call the service, and on a timeout `placeColumns` would
     * write four NULLs — so the Census Bureau having a bad minute would silently strip the county
     * off a site whose address nobody touched. The address is the only thing those four columns
     * are derived from, so if it did not move, they do not either.
     */
    const addressChanged = text(current.address) !== address
    const patch: Record<string, unknown> = { name, address }
    let geo: GeocodeResult | null = null
    if (addressChanged) {
      geo = await geocodeAddress(address)
      Object.assign(patch, placeColumns(geo, text(body?.county)))
    } else if (text(body?.county)) {
      /**
       * The person typed a county on a site whose address has not changed — the case where the
       * geocoder missed earlier and they are now telling us. Accepted ONLY while the county is
       * still unresolved, re-read here rather than trusted from the page, so a typed value can
       * never overwrite a geocoded one.
       */
      const { data: row } = await db
        .from('entities').select('county').eq('id', id).eq('company_id', companyId).maybeSingle()
      if (!row?.county) patch.county = text(body?.county)
    }

    const { data, error } = await db
      .from('entities').update(patch)
      .eq('id', id).eq('company_id', companyId)
      .select(SITE_COLUMNS)
      .single()

    if (error) {
      console.error('[/api/sites PATCH] update refused:', error.message)
      return NextResponse.json({ error: WRITE_FAILED }, { status: 400 })
    }
    return NextResponse.json({
      site: data,
      // Nothing was geocoded because nothing needed to be: the drawer then says nothing new about
      // the address, rather than claiming a fresh match it did not make.
      geocode: geo ? geocodeReport(geo) : null,
    })
  } catch (err) {
    console.error('[/api/sites PATCH] failed:', err)
    return NextResponse.json({ error: WRITE_FAILED }, { status: 500 })
  }
}

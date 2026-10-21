/**
 * AN ADDRESS IN, A STATE AND A COUNTY OUT — My Account step 6 (`ACCOUNT-PLAN.md` decisions 4, 16).
 *
 * *** WHY THIS FILE EXISTS AT ALL. *** `DECISIONS.md` §25 has said since September that a site's
 * state and county "come from geocoding". Nothing geocoded anything: signup asked for a state in a
 * dropdown and a city in a text box, `app/signup/page.tsx:174` sent `county: ''` for every account
 * ever created, and `create_primary_site` turned that empty string into NULL. So every company's
 * main site had a NULL county, and `lib/agencyScope.ts`'s county branch had nothing to match on.
 * `DECISIONS.md` §207 A has the whole chain. This is the thing that was being described.
 *
 * *** THE SERVICE: THE CENSUS BUREAU'S OWN GEOCODER. *** `geocoding.geo.census.gov`, free, no key,
 * no account, and it is the authority the FIPS codes come from — so a county it returns is not a
 * third party's opinion about a boundary, it is the boundary. Read from the service itself on
 * 21 October 2026 rather than assumed:
 *
 *   GET /geocoder/geographies/onelineaddress
 *       ?address=<one line>&benchmark=Public_AR_Current&vintage=Current_Current
 *       &format=json&layers=States,Counties
 *
 *   { "result": { "input": {...},
 *                 "addressMatches": [ { "matchedAddress": "1221 SW 4TH AVE, PORTLAND, OR, 97204",
 *                                       "coordinates": { "x": …, "y": … },
 *                                       "addressComponents": { "zip": "97204", "city": "PORTLAND",
 *                                                              "state": "OR", … },
 *                                       "geographies": {
 *                                         "States":   [ { "NAME": "Oregon",   "STUSAB": "OR", … } ],
 *                                         "Counties": [ { "NAME": "Multnomah County",
 *                                                         "BASENAME": "Multnomah", … } ] } } ] } }
 *
 * `benchmark=Public_AR_Current` and `vintage=Current_Current` are both the service's own
 * `isDefault: true` entries, read from `/geocoder/benchmarks` and `/geocoder/vintages` the same day.
 * **An address that does not match returns `addressMatches: []` and HTTP 200**, not an error — the
 * first address tried here, a real industrial street in Portland, came back empty. So "no match" is
 * the ordinary case and must read as information, never as a failure.
 *
 * *** THE FORMATS ARE THE DATABASE'S, NOT THE SERVICE'S, AND THEY WERE READ FROM IT. *** On staging:
 * `entities.state` is the full name (`'Oregon'`, never `'OR'`), `entities.county` is the bare name
 * with no "County" (`'Multnomah'`), `entities.city` is title case (`'Portland'`). So state comes
 * from the States layer's `NAME`, county from the Counties layer's `BASENAME` — both already in the
 * right shape — and the city from `addressComponents.city`, which arrives SHOUTING (`'PORTLAND'`)
 * and is title-cased here. Writing `'OR'` or `'Multnomah County'` would be a row that no
 * jurisdiction match can see, which is `CLAUDE.md` §3.2's silent failure.
 *
 * *** AND THE PRODUCT NEVER FAILS BECAUSE THIS IS DOWN. *** `GEOCODER_URL` set to an empty string
 * disables it and every address comes back `{ matched: false, reason: 'disabled' }`; a timeout, a
 * refused connection or a body that does not parse all come back the same shape with their own
 * reason. A site is always saved — with its name and the address as typed — and the person is told
 * plainly, in `NOT_FOUND_SENTENCE`, and offered the county box. `CLAUDE.md` §5.1: never assert
 * anything about an address we did not successfully resolve, and never imply the person typed it
 * wrong.
 */

/** What the caller gets when an address resolved. Any field may still be null: an address can match
 *  while a layer is missing, and a null here means "not resolved", never "empty". */
export interface GeocodeMatch {
  matched: true
  /** The full state name, e.g. `Oregon` — the format `entities.state` holds. */
  state: string | null
  /** The bare county name, e.g. `Multnomah` — no "County", the format `entities.county` holds. */
  county: string | null
  /** Title-cased, e.g. `Portland`. */
  city: string | null
  postal_code: string | null
  /** The service's own normalised line, kept for the record and shown to nobody. */
  matched_address: string | null
}

/**
 * Why nothing came back. Each one is a different thing to say to a person, and lumping them
 * together is how "no dates found" came to be shown for a file nobody could read (§5.1's worked
 * example, `DECISIONS.md` §27).
 */
export type GeocodeMissReason =
  /** `GEOCODER_URL` is empty: the product is running deliberately without a geocoder. */
  | 'disabled'
  /** Nothing was typed. */
  | 'blank'
  /** The service answered, and said it does not know this address. The ordinary case. */
  | 'no_match'
  /** It did not answer in time. */
  | 'timeout'
  /** It could not be reached, or answered with an HTTP error. */
  | 'unreachable'
  /** It answered with something this code cannot read — a shape change, or an outage page. */
  | 'unreadable'

export interface GeocodeMiss {
  matched: false
  reason: GeocodeMissReason
}

export type GeocodeResult = GeocodeMatch | GeocodeMiss

/**
 * THE SENTENCE A PERSON SEES, and it is the same one for every reason above.
 *
 * Deliberately: "our geocoder timed out" is our problem described in our words, and the person can
 * do nothing with it. What they CAN do is check the address or tell us the county, so that is what
 * it says. The reason is kept on the server side of the response for us.
 */
export const NOT_FOUND_SENTENCE =
  'We could not find that address — check it, or tell us the county.'

/** The Census Bureau's one-line endpoint. `GEOCODER_URL` overrides it; an empty string disables. */
export const CENSUS_ONELINE_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress'

/** Long enough for a cold service, short enough that a person saving a site is not left waiting. */
export const GEOCODE_TIMEOUT_MS = 8000

export interface GeocodeOptions {
  /** Defaults to `process.env.GEOCODER_URL ?? CENSUS_ONELINE_URL`. An empty string disables. */
  baseUrl?: string
  timeoutMs?: number
  /** Injected by the unit tests, which hand it recorded responses. */
  fetchImpl?: typeof fetch
}

/**
 * `PORTLAND` → `Portland`, `MOUNT ANGEL` → `Mount Angel`. The authority's value, cased for a page.
 *
 * A letter after an apostrophe is capitalised, which is right for `O'FALLON` → `O'Fallon` and
 * **wrong for `COEUR D'ALENE`**, which comes out `Coeur D'Alene`. Getting both right needs a list of
 * exceptions per place name, which is inventing a fact about somebody's town; getting neither right
 * leaves `O'fallon`. So the limitation is written down rather than papered over. It is cosmetic: the
 * city is shown on the address line and is matched against nothing — all 33 rows in `agencies` have
 * a null `jurisdiction_city` (read on 21 October 2026), so `lib/agencyScope.ts`'s city branch has
 * nothing to compare to in either case.
 */
export function titleCaseCity(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s'\-/.])([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase())
}

/**
 * Geocode one address. Never throws: every failure is a `GeocodeMiss`, because a site must be
 * saveable whatever this service is doing.
 */
export async function geocodeAddress(
  address: string,
  opts: GeocodeOptions = {},
): Promise<GeocodeResult> {
  const line = (address ?? '').trim()
  if (!line) return { matched: false, reason: 'blank' }

  const base = opts.baseUrl ?? process.env.GEOCODER_URL ?? CENSUS_ONELINE_URL
  // *** AN EMPTY VARIABLE IS A DECISION, NOT A MISCONFIGURATION. *** It is how the product is run
  // with no geocoder at all — every address is "not matched" and every site still saves.
  if (!base.trim()) return { matched: false, reason: 'disabled' }

  const url = new URL(base)
  url.searchParams.set('address', line)
  url.searchParams.set('benchmark', 'Public_AR_Current')
  url.searchParams.set('vintage', 'Current_Current')
  url.searchParams.set('format', 'json')
  url.searchParams.set('layers', 'States,Counties')

  const doFetch = opts.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? GEOCODE_TIMEOUT_MS)
  let res: Response
  try {
    res = await doFetch(url.toString(), { signal: controller.signal, headers: { accept: 'application/json' } })
  } catch (err) {
    // An abort and a refused connection arrive the same way and are different things to record.
    const aborted = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
    return { matched: false, reason: aborted ? 'timeout' : 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) return { matched: false, reason: 'unreachable' }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { matched: false, reason: 'unreadable' }
  }
  return readCensusBody(body)
}

/**
 * The parser, separate so the tests can hand it a recorded body with no fetch at all.
 *
 * *** A SHAPE IT CANNOT READ IS `unreadable`, NEVER `no_match`. *** §9a: a check that cannot see
 * anything looks exactly like a check that found nothing. If the service changes its response, this
 * must say so rather than quietly reporting that every address in America is unknown.
 */
export function readCensusBody(body: unknown): GeocodeResult {
  const result = (body as { result?: unknown } | null)?.result
  if (!result || typeof result !== 'object') return { matched: false, reason: 'unreadable' }
  const matches = (result as { addressMatches?: unknown }).addressMatches
  if (!Array.isArray(matches)) return { matched: false, reason: 'unreadable' }
  if (matches.length === 0) return { matched: false, reason: 'no_match' }

  const m = matches[0] as {
    matchedAddress?: unknown
    addressComponents?: { zip?: unknown; city?: unknown }
    geographies?: Record<string, unknown>
  }
  const geo = m.geographies ?? {}
  const states = Array.isArray(geo['States']) ? (geo['States'] as Array<Record<string, unknown>>) : []
  const counties = Array.isArray(geo['Counties']) ? (geo['Counties'] as Array<Record<string, unknown>>) : []

  const state = str(states[0]?.['NAME'])
  // BASENAME, not NAME: NAME is "Multnomah County" and the column holds "Multnomah".
  const county = str(counties[0]?.['BASENAME'])
  const rawCity = str(m.addressComponents?.city)
  const zip = str(m.addressComponents?.zip)

  return {
    matched: true,
    state,
    county,
    city: rawCity ? titleCaseCity(rawCity) : null,
    postal_code: zip,
    matched_address: str(m.matchedAddress),
  }
}

/** A string that is actually there, or null. `''` is not an answer. */
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * THE GEOCODER — My Account step 6 (`ACCOUNT-PLAN.md` decisions 4, 16; `DECISIONS.md` §207 A).
 *
 * *** THE TWO BODIES ARE RECORDED, NOT WRITTEN. *** `tests/fixtures/geocode/*.json` are the Census
 * Bureau's own replies, saved from two real calls on 21 October 2026. A hand-written body would
 * test this parser against what I believed the service returns, which is exactly the mistake the
 * three "comes from geocoding" comments were (`DECISIONS.md` §207 A). If the service changes shape,
 * re-record them and this file will say what broke.
 *
 * The no-match body is the one that matters most: it is **HTTP 200 with an empty
 * `addressMatches`**, so "we do not know this address" is a successful call, and any code that
 * treated a 200 as a match would write NULLs and claim they were resolved.
 *
 * Nothing here reaches the network. `geocodeAddress` takes `fetchImpl`, so a timeout is an abort
 * this file performs and the empty-variable case is a string this file passes.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  geocodeAddress, readCensusBody, titleCaseCity,
  NOT_FOUND_SENTENCE, CENSUS_ONELINE_URL, GEOCODE_TIMEOUT_MS,
} from '../../lib/geocode.ts'

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/geocode/${name}.json`, import.meta.url), 'utf8'))

/** A fetch that answers with one recorded body and records what it was asked for. */
function recordedFetch(body: unknown, init: { ok?: boolean; throws?: Error } = {}) {
  const calls: string[] = []
  const impl = (async (url: string | URL) => {
    calls.push(String(url))
    if (init.throws) throw init.throws
    return {
      ok: init.ok ?? true,
      json: async () => body,
    } as unknown as Response
  }) as unknown as typeof fetch
  return { impl, calls }
}

describe('the geocoder: a real address', () => {
  test('Portland City Hall resolves to Oregon and Multnomah, in the column formats', async () => {
    const { impl } = recordedFetch(fixture('census-match-portland'))
    const r = await geocodeAddress('1221 SW 4th Ave, Portland, OR 97204', { fetchImpl: impl })
    assert.equal(r.matched, true)
    if (!r.matched) return
    // *** THE FORMATS, WHICH ARE THE WHOLE POINT. *** 'Oregon' not 'OR'; 'Multnomah' not
    // 'Multnomah County'. A row in either of the wrong shapes is invisible to
    // `lib/agencyScope.ts`, which compares `a.jurisdiction_state === s.state` exactly.
    assert.equal(r.state, 'Oregon')
    assert.equal(r.county, 'Multnomah')
    assert.equal(r.city, 'Portland')          // the body says PORTLAND
    assert.equal(r.postal_code, '97204')
    assert.equal(r.matched_address, '1221 SW 4TH AVE, PORTLAND, OR, 97204')
  })

  test('the request carries the service\'s own default benchmark, vintage and both layers', async () => {
    const { impl, calls } = recordedFetch(fixture('census-match-portland'))
    await geocodeAddress('1221 SW 4th Ave, Portland, OR 97204', { fetchImpl: impl })
    assert.equal(calls.length, 1)
    const u = new URL(calls[0])
    assert.equal(`${u.origin}${u.pathname}`, CENSUS_ONELINE_URL)
    assert.equal(u.searchParams.get('benchmark'), 'Public_AR_Current')
    assert.equal(u.searchParams.get('vintage'), 'Current_Current')
    assert.equal(u.searchParams.get('format'), 'json')
    // Without the States layer there is no full state name, and without Counties no county at all.
    assert.equal(u.searchParams.get('layers'), 'States,Counties')
    assert.equal(u.searchParams.get('address'), '1221 SW 4th Ave, Portland, OR 97204')
  })
})

describe('the geocoder: every way it comes back with nothing', () => {
  test('an address it does not know is HTTP 200 with an empty list — no_match, not a failure', async () => {
    const body = fixture('census-no-match')
    assert.equal(body.result.addressMatches.length, 0)   // the fixture is what this claims it is
    const { impl } = recordedFetch(body)
    const r = await geocodeAddress('2140 NW Yeon Ave, Portland, OR 97210', { fetchImpl: impl })
    assert.deepEqual(r, { matched: false, reason: 'no_match' })
  })

  test('an empty GEOCODER_URL disables it, and nothing is fetched at all', async () => {
    const { impl, calls } = recordedFetch(fixture('census-match-portland'))
    const r = await geocodeAddress('1221 SW 4th Ave, Portland, OR 97204', { baseUrl: '', fetchImpl: impl })
    assert.deepEqual(r, { matched: false, reason: 'disabled' })
    assert.equal(calls.length, 0, 'a disabled geocoder must not call anything')
  })

  test('a timeout is a timeout, not a no-match', async () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    const { impl } = recordedFetch(null, { throws: abort })
    const r = await geocodeAddress('1221 SW 4th Ave, Portland, OR 97204', { fetchImpl: impl, timeoutMs: 5 })
    assert.deepEqual(r, { matched: false, reason: 'timeout' })
  })

  test('a refused connection is unreachable, and an HTTP error is too', async () => {
    const down = await geocodeAddress('x street, Portland, OR', {
      fetchImpl: recordedFetch(null, { throws: new TypeError('fetch failed') }).impl,
    })
    assert.deepEqual(down, { matched: false, reason: 'unreachable' })
    const five00 = await geocodeAddress('x street, Portland, OR', {
      fetchImpl: recordedFetch({}, { ok: false }).impl,
    })
    assert.deepEqual(five00, { matched: false, reason: 'unreachable' })
  })

  test('nothing typed is blank, and no call is made', async () => {
    const { impl, calls } = recordedFetch(fixture('census-match-portland'))
    assert.deepEqual(await geocodeAddress('   ', { fetchImpl: impl }), { matched: false, reason: 'blank' })
    assert.equal(calls.length, 0)
  })

  test('*** A SHAPE IT CANNOT READ IS `unreadable`, NEVER `no_match` ***', () => {
    // §9a: a check that cannot see anything looks exactly like a check that found nothing. If the
    // service ever answers with an outage page or a renamed field, this must not report that every
    // address in America is unknown.
    assert.deepEqual(readCensusBody(null), { matched: false, reason: 'unreadable' })
    assert.deepEqual(readCensusBody({}), { matched: false, reason: 'unreadable' })
    assert.deepEqual(readCensusBody({ result: {} }), { matched: false, reason: 'unreadable' })
    assert.deepEqual(readCensusBody('<html>down for maintenance</html>'), { matched: false, reason: 'unreadable' })
    // ...and an EMPTY list, which is the service working, is not unreadable.
    assert.deepEqual(readCensusBody({ result: { addressMatches: [] } }), { matched: false, reason: 'no_match' })
  })

  test('a match whose layers are missing is still a match, with nulls that mean "not resolved"', () => {
    const r = readCensusBody({
      result: { addressMatches: [{ matchedAddress: '1 A ST, X, OR, 97000', addressComponents: { city: 'X', zip: '97000' }, geographies: {} }] },
    })
    assert.equal(r.matched, true)
    if (!r.matched) return
    assert.equal(r.state, null)
    assert.equal(r.county, null)
    assert.equal(r.city, 'X')
  })
})

describe('the city, cased for a page', () => {
  test('the authority SHOUTS and the page does not', () => {
    assert.equal(titleCaseCity('PORTLAND'), 'Portland')
    assert.equal(titleCaseCity('MOUNT ANGEL'), 'Mount Angel')
    assert.equal(titleCaseCity('WINSTON-SALEM'), 'Winston-Salem')
    assert.equal(titleCaseCity('ST. HELENS'), 'St. Helens')
  })
  test("the known limitation is recorded rather than papered over", () => {
    // O'Fallon comes out right and Coeur d'Alene does not. Both are asserted so that a later
    // change which fixes one and breaks the other cannot pass silently.
    assert.equal(titleCaseCity("O'FALLON"), "O'Fallon")
    assert.equal(titleCaseCity("COEUR D'ALENE"), "Coeur D'Alene")
  })
})

describe('what a person is told', () => {
  test('one sentence for every reason, and it blames nobody', () => {
    assert.equal(NOT_FOUND_SENTENCE, 'We could not find that address — check it, or tell us the county.')
    // §5.1: never assert anything about something we did not read, and never imply the person is
    // at fault. It says "check it", which is something they can do, and offers us as the other way.
    assert.ok(!/invalid|wrong|bad|error|failed/i.test(NOT_FOUND_SENTENCE))
  })
  test('the timeout is long enough to be a real answer and short enough to be a wait', () => {
    assert.ok(GEOCODE_TIMEOUT_MS >= 3000 && GEOCODE_TIMEOUT_MS <= 15000)
  })
})

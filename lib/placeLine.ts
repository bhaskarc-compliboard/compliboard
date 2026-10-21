/**
 * ONE SITE, AS ONE LINE — moved out of `lib/companyContext.ts` at My Account step 6b.
 *
 * *** IT MOVED BECAUSE A THIRD COPY HAD ALREADY APPEARED, AND IT WAS VISIBLY WRONG. ***
 * `companyContext` carries this function's own history: it was exported in the first place because
 * `lib/audit.ts` had a copy of the same join and therefore the same defect. `app/company-information/
 * page.tsx` has had a third copy inline since it was written — and it could not import the shared
 * one, because `lib/companyContext.ts` imports `node:crypto` and never reaches a browser.
 *
 * Nobody noticed, because until My Account step 6 every `entities.address` on staging was NULL:
 * with no address there is nothing for the city, county and state to duplicate, and the join read
 * correctly by accident. The moment the geocoder started filling addresses, that page began
 * printing *"1221 SW 4th Ave, Portland, OR 97204, Portland, Multnomah County, Oregon"* — the city
 * twice, in the Sites list and in the company block's address line.
 *
 * So the function lives here now, in a file that imports nothing and can be read by both sides, and
 * `lib/companyContext.ts` re-exports it so its own callers are untouched. The body is moved
 * verbatim: a diff that mixes a move with an edit is a diff nobody can review, and this one feeds a
 * prompt (`CLAUDE.md` §3.1).
 */

/**
 * The place a site is, with nothing said twice.
 *
 * Each component is dropped when the address already carries it. A site with no address is
 * unchanged, which is what keeps the fixtures' blocks byte-identical.
 */
export function siteWhere(s: { address: string | null; city: string | null; county: string | null; state: string | null }): string {
  const addr = (s.address ?? '').trim()
  const has = (v: string | null) => !!v && addr.toLowerCase().includes(v.trim().toLowerCase())
  return [
    addr || null,
    has(s.city) ? null : s.city,
    s.county && !has(s.county) ? `${s.county} County` : null,
    has(s.state) ? null : s.state,
  ].filter(Boolean).join(', ')
}

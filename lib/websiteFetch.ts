/**
 * FETCHING A COMPANY'S OWN WEBSITE — My Account step 13, `ACCOUNT-PLAN.md` decision 9.
 *
 * The homepage and up to four pages it links to whose path looks like about, contact, locations,
 * facilities or company. Text only, capped per page and in total. Nothing here calls a model; this
 * file decides WHAT the model is shown, and `prompts/website-read.ts` decides what it is asked.
 *
 * *** IT IS A REWRITE OF `app/api/scan-website/route.ts`'s SWEEP, NOT A REUSE, AND THE REASON IS
 * SECURITY. *** `docs/TODO.md:1075` assessed that route as a **blind SSRF**: it took `url` from an
 * unauthenticated request body, prepended `https://`, and fetched it plus **sixteen guessed
 * subpaths** — "one unauthenticated request is up to 17 outbound fetches from your infrastructure
 * to a destination the caller picks", with no scheme check and nothing blocking private or
 * link-local ranges. It was left open deliberately because fixing it meant deciding an auth story
 * for a pre-login surface. **Step 12 decided it**: there is no pre-login surface any more. The host
 * comes out of `companies.website_url`, written by `/api/signup` after `normaliseWebsite` has
 * reduced it to a bare hostname, and the read runs for a company that exists. So the fix is in
 * scope now, and this file carries it:
 *
 *   1. **https only.** No scheme comes from input — one is prepended here and nothing else is
 *      accepted, so `file:`, `gopher:` and a port on a plain host cannot be reached.
 *   2. **No IP literals**, v4 or v6. `normaliseWebsite`'s hostname pattern accepts `169.254.169.254`
 *      — digits and dots are a legal hostname — so the check has to be here.
 *   3. **Every hostname is resolved and every address checked** against loopback, private,
 *      link-local, CGNAT and the reserved ranges, before anything is fetched. A host that resolves
 *      into one of them is refused and recorded as `blocked_host`, not as "unreachable": we know
 *      exactly what happened and saying otherwise would be a guess.
 *   4. **Redirects are followed by hand, three at most, and each hop is checked again** — a public
 *      host that 302s to `http://169.254.169.254/` is the standard way round a check made once.
 *   5. **Caps everywhere**: bytes off the wire, characters into the prompt, seconds per page and
 *      seconds in total, so a slow or enormous site cannot hold a function open.
 *
 * *** WHAT IT STILL DOES NOT CLOSE, SAID PLAINLY. *** DNS rebinding — a host that answers the
 * resolve with a public address and the connection with a private one — remains possible, because
 * `fetch` resolves again on its own and Node gives no supported way to pin the socket to the
 * address we checked. Closing it means an agent with a custom `lookup`, which is its own change.
 * The window is one request to a host the customer typed, with the body never returned to anyone;
 * it is narrower than what the old route had and it is not nothing. Recorded rather than inherited.
 */
import { lookup } from 'node:dns/promises'

// ---- THE CAPS, all in one place so the report can state them ----
/** The homepage plus four. */
export const MAX_PAGES = 5
/** One page's own time limit. */
export const PER_PAGE_MS = 8_000
/** Everything, including DNS and redirects. A signup's walk cannot wait longer than this. */
export const TOTAL_MS = 25_000
/** Bytes read off the wire per page before we stop reading. ~400 KB of HTML is a very large page. */
export const MAX_BYTES = 400_000
/** Characters of extracted text kept per page… */
export const PER_PAGE_CHARS = 6_000
/** …and in total, across every page. At ~4 characters a token this is about 6,000 input tokens. */
export const TOTAL_CHARS = 24_000
/** Redirect hops followed, each re-checked. */
export const MAX_REDIRECTS = 3

/** Which pages are worth having, best first. The homepage is always first and is not in this list. */
const WANTED: Array<{ name: string; re: RegExp }> = [
  { name: 'about',      re: /(^|\/)(about|about-us|who-we-are|our-story)(\/|$|\.html?$)/i },
  { name: 'locations',  re: /(^|\/)(locations?|facilities|plants|where-we-are)(\/|$|\.html?$)/i },
  { name: 'contact',    re: /(^|\/)(contact|contact-us|get-in-touch)(\/|$|\.html?$)/i },
  { name: 'company',    re: /(^|\/)(company|corporate|our-company)(\/|$|\.html?$)/i },
]

export type FetchFailure =
  | 'blocked_host'      // an IP literal, or a name that resolves somewhere private
  | 'unreachable'       // DNS said nothing, or the connection failed
  | 'not_found'         // the homepage answered 4xx/5xx
  | 'nothing_readable'  // it answered, and there was no text worth reading
  | 'too_slow'          // the total budget ran out before the homepage was read

export interface FetchedPage { url: string; text: string; bytes: number }
export type SiteRead =
  | { ok: true; pages: FetchedPage[] }
  | { ok: false; reason: FetchFailure }

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE HOST CHECK
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** An IPv4 or IPv6 literal, in any of the forms a URL may carry one. */
export function isIpLiteral(host: string): boolean {
  const h = host.trim().replace(/^\[|\]$/g, '')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true
  if (/^\d+$/.test(h)) return true                       // 2130706433 is 127.0.0.1
  if (/^0x[0-9a-f]+$/i.test(h)) return true
  return h.includes(':')                                  // every IPv6 form has one
}

/** Is this address one nobody outside our own network should be able to make us talk to? */
export function isPrivateAddress(address: string, family: number): boolean {
  if (family === 4) {
    const p = address.split('.').map(Number)
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
    const [a, b] = p
    if (a === 0 || a === 10 || a === 127) return true                       // this network, private, loopback
    if (a === 169 && b === 254) return true                                 // link-local, and the metadata endpoint
    if (a === 172 && b >= 16 && b <= 31) return true                        // private
    if (a === 192 && b === 168) return true                                 // private
    if (a === 192 && b === 0) return true                                   // IETF protocol assignments
    if (a === 100 && b >= 64 && b <= 127) return true                       // carrier-grade NAT
    if (a === 198 && (b === 18 || b === 19)) return true                    // benchmarking
    if (a >= 224) return true                                               // multicast and reserved
    return false
  }
  const h = address.toLowerCase()
  if (h === '::' || h === '::1') return true                                // unspecified, loopback
  if (h.startsWith('fc') || h.startsWith('fd')) return true                 // unique local
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true  // link-local
  // ::ffff:10.0.0.1 — an IPv4 address wearing an IPv6 coat.
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) return isPrivateAddress(mapped[1], 4)
  return false
}

/** Resolve a hostname and say whether every address it has is one we may talk to. */
export async function hostIsReachable(host: string): Promise<'ok' | FetchFailure> {
  if (isIpLiteral(host)) return 'blocked_host'
  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    return 'unreachable'
  }
  if (!addresses.length) return 'unreachable'
  // EVERY address, not the first: a name with one public and one private answer is a name that
  // reaches the private one half the time.
  return addresses.some((a) => isPrivateAddress(a.address, a.family)) ? 'blocked_host' : 'ok'
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE FETCH
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Read a response body up to `MAX_BYTES`, then stop. */
async function readCapped(res: Response): Promise<{ html: string; bytes: number }> {
  const reader = res.body?.getReader()
  if (!reader) return { html: '', bytes: 0 }
  const chunks: Uint8Array[] = []
  let bytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      bytes += value.byteLength
      if (bytes >= MAX_BYTES) { await reader.cancel().catch(() => {}); break }
    }
  }
  return { html: new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks)), bytes }
}

/** What one attempt did. The caller needs the difference: only `no_connect` earns an http retry. */
export type PageResult =
  | { kind: 'ok'; html: string; bytes: number; url: string }
  | { kind: 'status'; status: number }   // it answered, and the answer was not a page
  | { kind: 'no_connect' }               // nothing answered at all: DNS, TLS, refused, timed out
  | { kind: 'blocked' }                  // a hop pointed somewhere we will not go

/**
 * One page: checked host, followed redirects by hand, capped body.
 *
 * `redirect: 'manual'` rather than the default, so every hop's host goes through the same check the
 * first one did. A fetch that follows redirects itself checks the host once and then goes wherever
 * it is sent, which is the standard way round a check made once.
 *
 * *** A REQUEST THAT STARTED AS https NEVER HOPS DOWN TO http. *** `allowHttp` is set only by the
 * caller's explicit http retry (see `readSite`), so a site that answers on https cannot be talked
 * into sending us its pages in clear by returning a 302. The downgrade has to be our decision,
 * taken once, for a host that would otherwise be unreadable.
 */
async function fetchPage(url: string, deadline: number, allowHttp = false): Promise<PageResult> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (Date.now() > deadline) return { kind: 'no_connect' }
    let u: URL
    try { u = new URL(current) } catch { return { kind: 'blocked' } }
    if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) return { kind: 'blocked' }
    if (await hostIsReachable(u.hostname) !== 'ok') return { kind: 'blocked' }

    const timeout = Math.min(PER_PAGE_MS, Math.max(0, deadline - Date.now()))
    if (timeout <= 0) return { kind: 'no_connect' }
    let res: Response
    try {
      res = await fetch(u.toString(), {
        redirect: 'manual',
        headers: {
          // Says who we are and why. A site that wishes to refuse us can, and that is correct.
          'User-Agent': 'CompliBoard/1.0 (+https://compliboard.com; reading the site you gave us at signup)',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(timeout),
      })
    } catch {
      return { kind: 'no_connect' }
    }

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      if (!next) return { kind: 'status', status: res.status }
      current = new URL(next, u).toString()
      continue
    }
    if (!res.ok) return { kind: 'status', status: res.status }
    const type = res.headers.get('content-type') ?? ''
    if (type && !/text\/html|application\/xhtml/i.test(type)) return { kind: 'status', status: res.status }
    const { html, bytes } = await readCapped(res)
    return { kind: 'ok', html, bytes, url: u.toString() }
  }
  return { kind: 'status', status: 310 }   // too many hops: it answered, it just never arrived
}

/**
 * HTML to the words a reader would see.
 *
 * `<br>` and block tags become newlines BEFORE the tags go, or a three-line address on the contact
 * page arrives as one run of words with no separator and the model has to guess where the street
 * ends. That is the one place in this file where the formatting matters to the answer.
 */
export function pageText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|address|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim()
}

/**
 * *** THE SAME MENU ON EVERY PAGE IS NOT FOUR FACTS, IT IS ONE. ***
 *
 * Measured on `jostchemical.com`, 22 October: three pages, 11,049 characters, of which roughly
 * 2,000 per page were the identical navigation — so more than half the budget was one menu, read
 * three times, and the pages that cost the most to fetch contributed the least. This drops any
 * line already kept from an EARLIER page.
 *
 * It compares against what was KEPT, not against what was fetched, and that is the whole of the
 * care needed here: a homepage cut off at `PER_PAGE_CHARS` loses its footer, and if the comparison
 * used the full text, the identical footer on page two — carrying the company's address — would be
 * dropped as a repeat and the address would be in neither. Comparing against the kept text means
 * the first SURVIVING copy of a line is always the one that stays.
 */
function dropRepeats(text: string, seen: Set<string>): string {
  const out: string[] = []
  for (const line of text.split('\n')) {
    const key = line.trim().toLowerCase()
    if (key && seen.has(key)) continue
    out.push(line)
  }
  return out.join('\n').replace(/\n\s*\n\s*\n+/g, '\n\n').trim()
}

/** Remember every line of a page we are keeping, so later pages do not repeat it. */
function remember(text: string, seen: Set<string>): void {
  for (const line of text.split('\n')) {
    const key = line.trim().toLowerCase()
    if (key) seen.add(key)
  }
}

/** The internal links worth following, best first, at most `MAX_PAGES - 1` of them. */
export function wantedLinks(html: string, base: string): string[] {
  let origin: URL
  try { origin = new URL(base) } catch { return [] }
  const found = new Map<string, string>()        // name -> url, first one wins
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    let u: URL
    try { u = new URL(m[1], origin) } catch { continue }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') continue
    // Same site only. A link to a parent group's website is a different company.
    if (u.hostname !== origin.hostname) continue
    // The link keeps its own scheme — it used to be forced to https, which on an http-only site
    // turned every subpage into a connection that cannot be made. `fetchPage` is what decides
    // whether http is allowed at all, and it decides it from how the homepage was reached.
    u.hash = ''
    const path = u.pathname
    if (path === '/' || path === '') continue
    for (const w of WANTED) {
      if (w.re.test(path) && !found.has(w.name)) found.set(w.name, u.toString())
    }
  }
  return WANTED.map((w) => found.get(w.name)).filter((x): x is string => Boolean(x)).slice(0, MAX_PAGES - 1)
}

/**
 * Read a site. One host in, up to five pages of text out, or one reason why not.
 *
 * The homepage decides everything: if it cannot be read there is nothing to follow, and the walk
 * falls to the address screen with the host named. The other pages are a bonus — one that 404s or
 * times out is simply not in the list, because a contact page that is missing is not a failure.
 */
export async function readSite(host: string, now: () => number = Date.now): Promise<SiteRead> {
  const deadline = now() + TOTAL_MS
  const clean = host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!clean) return { ok: false, reason: 'unreachable' }

  const reachable = await hostIsReachable(clean)
  // A host that resolves nowhere may still be a site: `normaliseWebsite` strips a leading `www.`
  // (it is noise in a domain shown to a person) and SOME SITES ONLY SERVE `www`. Measured on 22
  // October: `thatcherco.com` threw `fetch failed` while `www.thatcherco.com` answered 200. So a
  // blocked host is refused outright — that answer is about safety and does not get a second
  // chance — and an unreachable one is tried once more with the `www.` the person's own address
  // bar would have put back.
  if (reachable === 'blocked_host') return { ok: false, reason: 'blocked_host' }
  const canWww = !clean.startsWith('www.') && await hostIsReachable(`www.${clean}`) === 'ok'
  if (reachable !== 'ok' && !canWww) return { ok: false, reason: 'unreachable' }

  /**
   * *** THE ORDER OF ATTEMPTS, AND WHY http IS LAST AND CONDITIONAL. ***
   *
   * https on the host, then https on `www.` (an apex that RESOLVES can still refuse the connection
   * while `www` serves the site — that is `thatcherco.com`, measured), and only then, **only if
   * nothing has answered at all**, the same two over http.
   *
   * The condition is the whole of the rule: a site that answered 403 or 404 on https is not
   * retried in clear, because it is not a site that cannot do https — it is a site that said no.
   * `thatcherco.com` is the case this exists for: it serves `http 200` and no https whatsoever,
   * and it is exactly the kind of small manufacturer this product is sold to.
   *
   * *** THE CAVEAT, RECORDED RATHER THAN GLOSSED (the owner, step 13 stop). *** An http fetch is
   * plaintext: anyone on the path can see which site we read and can change what we are shown. We
   * accept that here because the body is never returned to anyone — it is summarised by a model
   * into a proposal that a person then confirms line by line — and because the alternative is
   * telling a customer we cannot read their website when their browser can. It is not a secret
   * and it is not trusted. The scheme is never taken from input, the host and address checks run
   * on every hop exactly as they do on https, and no https request can be redirected down into it.
   */
  const attempts: Array<{ url: string; http: boolean }> = []
  if (reachable === 'ok') attempts.push({ url: `https://${clean}/`, http: false })
  if (canWww) attempts.push({ url: `https://www.${clean}/`, http: false })
  const httpAttempts: Array<{ url: string; http: boolean }> = []
  if (reachable === 'ok') httpAttempts.push({ url: `http://${clean}/`, http: true })
  if (canWww) httpAttempts.push({ url: `http://www.${clean}/`, http: true })

  let home: Extract<PageResult, { kind: 'ok' }> | null = null
  let answered = false          // something gave us a status: do NOT fall back to http
  let blocked = false
  for (const a of [...attempts, ...httpAttempts]) {
    if (now() > deadline) break
    if (a.http && answered) break
    const r = await fetchPage(a.url, deadline, a.http)
    if (r.kind === 'ok') { home = r; break }
    if (r.kind === 'status') answered = true
    if (r.kind === 'blocked') blocked = true
  }
  if (!home) {
    if (now() > deadline) return { ok: false, reason: 'too_slow' }
    if (answered) return { ok: false, reason: 'not_found' }
    return { ok: false, reason: blocked ? 'blocked_host' : 'unreachable' }
  }

  const homeText = pageText(home.html)
  if (homeText.length < 120) return { ok: false, reason: 'nothing_readable' }

  const seen = new Set<string>()
  const first = homeText.slice(0, PER_PAGE_CHARS)
  remember(first, seen)
  const pages: FetchedPage[] = [{ url: home.url, text: first, bytes: home.bytes }]
  let budget = TOTAL_CHARS - first.length

  // A subpage is fetched over whatever scheme the homepage actually came back on, and over
  // nothing else: `new URL(home.url)` is the page we read, not the address we started from.
  const overHttp = new URL(home.url).protocol === 'http:'
  for (const link of wantedLinks(home.html, home.url)) {
    if (pages.length >= MAX_PAGES || budget <= 500 || now() > deadline) break
    const page = await fetchPage(link, deadline, overHttp)
    if (page.kind !== 'ok') continue
    const t = dropRepeats(pageText(page.html), seen)
    // A page that is ONLY the menu and the footer has nothing left after the repeats go, and that
    // is the right answer: it had nothing of its own to say.
    if (t.length < 120) continue
    const kept = t.slice(0, Math.min(PER_PAGE_CHARS, budget))
    remember(kept, seen)
    pages.push({ url: page.url, text: kept, bytes: page.bytes })
    budget -= kept.length
  }
  return { ok: true, pages }
}

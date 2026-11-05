/**
 * MAKING A SOURCE READABLE — Run 3, `DECISIONS.md` §126.
 *
 * A citation's title comes from whatever the page called itself, and search results carry three
 * kinds of rubbish that reach the screen as a link nobody can identify:
 *
 *   1. **A bare domain** — `osha.gov`, `www.epa.gov`. True, and useless: every source on the
 *      answer then reads the same.
 *   2. **A PDF header read by OCR** — `FO D SAFETY`, `HAZAR OUS WASTE`. Letters are dropped, so
 *      it is recognisably broken and recognisably not a title.
 *   3. **A date-stamped file name** — `policy-2024-03-11-final-v2`, `DEQ_20240311_rev3`.
 *
 * *** THE FALLBACK IS DERIVED FROM THE URL, NEVER INVENTED. *** The last meaningful path segment
 * of a government URL is almost always the subject — `/laws-regs/hazardous-waste-generators` —
 * and turning that into words is a transformation of something the source actually said. Writing
 * a title from the page's *contents* would be the product asserting what a document is called,
 * which is the shape §6 keeps out of the UI.
 *
 * When the URL yields nothing either, the domain is returned — honest, and no worse than what
 * arrived.
 */

/** Words that carry no subject, so a segment made only of these is skipped. */
const NOISE = new Set([
  'index', 'default', 'home', 'page', 'pages', 'en', 'us', 'html', 'htm', 'pdf', 'php', 'aspx',
  'view', 'content', 'files', 'file', 'document', 'documents', 'download', 'downloads', 'sites',
  'sites-default', 'media', 'assets', 'static', 'docs', 'doc', 'www',
])

/** `www.` and other leading service labels are noise in a domain shown to a person. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return String(url ?? '').replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '')
  }
}

/**
 * Is this title unusable as a label?
 *
 * Deliberately conservative: a real title that trips this loses nothing but its own wording, and
 * is replaced by a URL-derived one that is still true. A junk title that survives is a link a
 * person cannot identify.
 */
export function isJunkTitle(title: string, url: string): boolean {
  const t = String(title ?? '').trim()
  if (!t) return true

  const host = hostOf(url)
  const bare = t.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
  // 1. THE BARE DOMAIN, with or without a scheme or a trailing slash.
  if (host && bare.toLowerCase() === host.toLowerCase()) return true
  // A domain plus nothing but a path is the same problem.
  if (host && bare.toLowerCase().startsWith(host.toLowerCase() + '/')) return true

  // 2. A PDF/OCR HEADER. A letter is dropped mid-word, so the word splits and leaves a piece
  // behind that is not a word: "FO D SAFETY", "HAZAR OUS WASTE".
  //
  // *** THE THRESHOLD IS TWO LETTERS, NOT THREE, AND THAT IS DELIBERATE. *** Three would catch
  // EPA, DOT, GHS, SDS and OSHA's own siblings — real acronyms that belong in a real title. So
  // a one- or two-letter piece counts, plus a short list of ENGLISH SUFFIXES that can only be
  // the tail of a broken word and are not acronyms anywhere: "HAZAR OUS" splits that way.
  //
  // **This is a heuristic and it is deliberately conservative.** It catches the shapes we have
  // seen and will not catch every OCR break; the cost of a miss is one ugly title, and the cost
  // of over-reaching is a correct title thrown away — so it errs towards leaving titles alone.
  const SPLIT_TAILS = new Set(['OUS', 'ING', 'TION', 'SION', 'MENT', 'ENCE', 'ANCE', 'ITY', 'IVE'])
  const words = t.split(/\s+/)
  const upperish = t === t.toUpperCase() && /[A-Z]/.test(t)
  if (upperish && words.length >= 2) {
    const broken = words.filter((w) => /^[A-Z]{1,2}$/.test(w) || SPLIT_TAILS.has(w)).length
    if (broken > 0) return true
  }

  // 3. A DATE-STAMPED FILE NAME. A date plus separators and no sentence.
  const looksLikeFilename = /[_-]/.test(t) && !/\s/.test(t)
  const hasDate = /(19|20)\d{2}[-_]?\d{2}[-_]?\d{2}|\b(19|20)\d{2}\b/.test(t)
  if (looksLikeFilename && hasDate) return true
  // …and the extension-bearing form, with or without a date: `guidance_v2.pdf`.
  if (/^[\w-]+\.(pdf|docx?|xlsx?|html?)$/i.test(t)) return true

  // ------------------------------------------------------------------------------------
  // 3b. THE SAME FILE NAME WITH ITS SEPARATORS ALREADY TURNED INTO SPACES — Fix Round 1 (E).
  //
  // The rule above requires `[_-]` AND no whitespace, so it saw none of these. All three are
  // real, all three reached the screen, and all three are in `tests/unit/sourceTitle.test.ts`:
  //
  //   "2017 labor standards ord quick chart 11 15 17"     seattle.gov  (the owner's example)
  //   "registration process brochure 04 06 2018 final"    phmsa.dot.gov
  //   "J:\SHARED\PERMITS\Forms\Baseline Monitoring Report.doc Rev. 02/27/01w"   sandiego.gov
  //
  // *** THE GUARD IS THE CAPITALISATION, AND IT IS WHAT KEEPS THIS SAFE. *** A date run alone
  // would condemn real titles: "6-2-30: CATEGORICAL INDUSTRIAL USER REPORTING REQUIREMENTS"
  // and "Fall Protection in Construction OSHA 3146-05R 2015" both carry number runs and are
  // perfectly good titles. A page that a person wrote a title for capitalises it. A file name
  // that lost its underscores does not — so this fires only on an all-lowercase string.
  const dateRun = /\b\d{1,4}[ _-]\d{1,2}[ _-]\d{2,4}\b/.test(t)
  const noCapitals = t === t.toLowerCase()
  if (dateRun && noCapitals) return true

  // 3c. A FILESYSTEM PATH THAT ESCAPED INTO THE TITLE — a drive letter or a UNC share. The
  // document's own properties leak these; they name a folder on somebody's PC, not a subject.
  if (/^[a-z]:\\/i.test(t) || /\\\\/.test(t) || (t.includes('\\') && /\.(doc|docx|pdf|xls|xlsx)\b/i.test(t))) return true

  return false
}

/** `hazardous-waste-generators` → `Hazardous waste generators`. */
function humanise(segment: string): string {
  const words = decodeURIComponent(segment)
    .replace(/\.[a-z0-9]{2,5}$/i, '')          // a trailing extension
    .replace(/[_+]/g, '-')
    .split('-')
    .filter((w) => w && !/^\d+$/.test(w))       // bare numbers carry no subject
  if (!words.length) return ''
  const text = words.join(' ').replace(/\s+/g, ' ').trim()
    // A segment can hold spaces of its own — `2017 labor standards ord_quick chart_11-15-17` —
    // so the bare-number filter above never sees the year or the trailing stamp. Strip a leading
    // year and any trailing run of numbers, or the derived title repeats what made the original
    // unreadable (Fix Round 1 E).
    .replace(/^(19|20)\d{2}\s+/, '')
    .replace(/[\s_-]+\d{1,4}(?:[\s_-]+\d{1,4})*$/, '')
    .trim()
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The title to show for a source: the one it gave, unless that is unusable.
 *
 * Returns `{ title, host, derived }` — `derived` is true when the title came from the URL, so a
 * caller can render it differently if it ever wants to. Nothing today does; it is there so the
 * fact is available rather than lost.
 */
export function displaySource(rawTitle: string, url: string): { title: string; host: string; derived: boolean } {
  const host = hostOf(url)
  const given = String(rawTitle ?? '').trim()
  if (!isJunkTitle(given, url)) return { title: given, host, derived: false }

  let path: string[] = []
  try { path = new URL(url).pathname.split('/').filter(Boolean) } catch { /* no URL to read */ }

  // Walk from the end: the last meaningful segment is the subject.
  for (let i = path.length - 1; i >= 0; i--) {
    const seg = path[i]
    const bare = seg.replace(/\.[a-z0-9]{2,5}$/i, '').toLowerCase()
    if (NOISE.has(bare)) continue
    const words = humanise(seg)
    // One short word is not a title — `/p/`, `/a/`. Two characters of subject is not a subject.
    if (words.length >= 4) return { title: words, host, derived: true }
  }

  return { title: host || given || 'Source', host, derived: true }
}

/**
 * *** WHAT A SUMMARY'S SOURCE POINTS AT — `docs/GAPS-PLAN.md` Part E step E2, decision 63. ***
 *
 * A source inside a summary opens IN PLACE: a document's reading swaps the drawer, an audit opens
 * its report page, a web page opens a new tab as it always has. Which of the three it is can only
 * be told from the address, and the two shapes are written by the briefs, not guessed here:
 *
 *   `/documents?document=<uuid>`  `lib/ask/documentsBrief.ts:331` and `lib/ask/auditsBrief.ts:420`
 *   `/audits?run=<uuid>`          `lib/ask/auditsBrief.ts:326` and `:390`
 *   `/calendar?date=<uuid>`       `lib/ask/calendarBrief.ts:141`
 *
 * *** THE THIRD SHAPE ARRIVED AT E2b, AND ITS ABSENCE HAD A COST. *** E2a knew two, and the
 * E2b-check found the one conversation that used the third: a Calendar answer cited a date it had
 * read, `passageKey` called it a web page with no url, and `gatherSources` dropped it — so the
 * summary of a conversation about dates carried no date.
 *
 * **A stored source carries the address in one of two fields**, and both are read: `url` is the
 * web one, and `href` is what a passage carries — read off staging, a document passage in a turn
 * is `{ kind: 'passage', label: 'your document', href: '/documents?document=…', url: '' }`.
 *
 * Anything else — including anything that is not ours and anything malformed — is `web`, which is
 * the safe answer: it opens in a new tab and nothing in the app is swapped for it.
 */
export type SourceTarget =
  | { kind: 'document'; id: string; url: string }
  | { kind: 'audit'; id: string; url: string }
  | { kind: 'date'; id: string; url: string }
  | { kind: 'web'; id: null; url: string }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export function sourceTarget(src: { url?: string | null; href?: string | null }): SourceTarget {
  const raw = String(src?.href || src?.url || '').trim()
  const doc = new RegExp(`^/documents\\?document=(${UUID})$`, 'i').exec(raw)
  if (doc) return { kind: 'document', id: doc[1], url: raw }
  const run = new RegExp(`^/audits\\?run=(${UUID})$`, 'i').exec(raw)
  if (run) return { kind: 'audit', id: run[1], url: raw }
  const date = new RegExp(`^/calendar\\?date=(${UUID})$`, 'i').exec(raw)
  if (date) return { kind: 'date', id: date[1], url: raw }
  return { kind: 'web', id: null, url: raw }
}

/**
 * *** KEEPING A SOURCE THAT IS ONE OF OURS — E2a, decision 63 made reachable, 4 November 2026. ***
 *
 * `lib/summaryReport.ts` `gatherSources` keys a source by its URL and **drops any source that has
 * none** unless the caller supplies `keyWithoutUrl`. Only HR did (a handbook passage,
 * `lib/hrSummary.ts`), so a document or an audit cited in a Workspace, Calendar, Documents or
 * Audits conversation — which carries its address in `href` and an EMPTY `url` — never reached a
 * summary at all. E2 built the in-place swap for a source that could not arrive; this is the three
 * lines that let it.
 *
 * **It is keyed by what it points AT**, so the same document cited three times is one numbered
 * source, which is what a web page cited three times already is.
 *
 * *** AND IT CHANGES WHAT THE MODEL IS SHOWN, WHICH IS WHY IT IS THE OWNER'S CALL (§3.1). ***
 * The summariser's numbered list now includes the company's own documents, exactly as HR's has
 * included handbooks since Step 7. Authorised in the E2a brief.
 */
export function passageKey(s: Record<string, unknown>): string | null {
  const t = sourceTarget(s as { url?: string | null; href?: string | null })
  return t.kind === 'web' ? null : `${t.kind}:${t.id}`
}

/** The list line the model reads. A web page keeps its URL; one of ours says what it is. */
export function passageLineOf(s: { n: number; title: string; url?: string | null; label?: unknown }): string {
  const label = typeof s.label === 'string' && s.label.trim() ? s.label : 'your own records'
  return s.url ? `${s.n}. ${s.title} — ${s.url}` : `${s.n}. ${s.title} — ${label}`
}

/**
 * What every section that is not HR passes to the summariser. `keepFields` is not optional here:
 * without it the kept source is rebuilt as `{ n, title, url }` and the `href` — the whole point —
 * is thrown away on the way in.
 */
export const PASSAGE_SOURCES = { keyWithoutUrl: passageKey, keepFields: true, lineOf: passageLineOf }

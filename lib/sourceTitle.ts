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

/**
 * THE CHECK THAT RUNS BEFORE ANYTHING IS SHOWN OR STORED — Calendar step 10a.
 *
 * *** THIS IS `lib/hrAnswer.ts`'s CHECK WITH THE HANDBOOKS TAKEN OUT OF IT, COPIED AND NOT MOVED. ***
 * HR goes on running its own (`finishAnswer`, `checkQuote`, `checkPlainQuotes`), untouched; this is
 * the same algorithm over a neutral `Passage` — a piece of text the answer was given, whatever
 * section it came from. When HR moves onto the engine after the Calendar's release the two become
 * one and HR's copy goes (`HANDOFF-CODE.md` §7).
 *
 * WHAT IT ENFORCES, and neither half is advisory:
 *
 *   · A WEB LINK the answer cites must be one THIS CALL'S SEARCH RETURNED (`findReturned`).
 *     A citation of anything else is removed and counted. The model cannot cite from memory.
 *   · A QUOTED PASSAGE must be found, word for word under the shared normalisation, in one of the
 *     passages the answer was given, or in a web page this call cited. Otherwise it is marked, in
 *     the product's own words, and counted. The code never rewrites the model's sentence.
 *
 * The normalisation is the shared one (`normaliseForQuote`, `lib/documentScan.ts`) and the six-word
 * floor is HR's: below six words a "quote" is a phrase, and a phrase matching proves nothing.
 */
import type { Source, CitedPassage } from '../ai.ts'
import { normaliseForQuote } from '../documentScan.ts'
import { findReturned, labelFor } from '../howTo.ts'

/** Roughly how many tokens a character costs on the current tokenizer — `lib/hrAnswer.ts`'s figure. */
export const TOKENS_PER_CHAR = 0.4
export const QUOTE_MIN_WORDS = 6
export const tokensOf = (text: string): number => Math.ceil(text.length * TOKENS_PER_CHAR)

/**
 * ONE PIECE OF TEXT THE ANSWER WAS GIVEN, and what a card made from it should say.
 *
 * `id` is what the model writes in a marker — "C3", "D1", "F2" — a letter for the kind and a
 * number. The letter is the section's choice; the engine only requires that ids are unique and
 * match `PASSAGE_ID`.
 */
export interface Passage {
  id: string
  /** The card's title: "Air permit 26-2841 · the line this date was read from". */
  title: string
  /** What the person is told this passage IS: "your calendar", "a reading of your document". */
  label: string
  /** The text a quote is checked against, exactly as stored. */
  text: string
  /** Where clicking the card should go, when there is somewhere: /calendar?date=…, /documents… */
  href?: string | null
  /** What this passage is called in a sentence — the date's own title. Falls back to `title`. */
  shortName?: string
}

export interface AskWebSource { n: number; kind: 'web'; title: string; url: string; label: 'official' | 'other' }
export interface AskPassageSource {
  n: number; kind: 'passage'; title: string; url: ''; label: string
  passage_id: string; quote: string; href: string | null
}
export type AskSource = AskWebSource | AskPassageSource

/** A passage id as the model may write it: one or two capitals and a number. */
export const PASSAGE_ID = /^[A-Z]{1,2}\d{1,3}$/

/**
 * `[3]` — a web citation; `[C2: "the quoted words"]` — a passage quote; `[C2]` — a passage with no
 * quote, which is dropped (a card with nothing in it says nothing). The leading whitespace is
 * captured so a dropped marker does not leave a double space behind, exactly as HR does it.
 */
const MARKER = /\[(\d{1,2})\]|\s?\[([A-Z]{1,2}\d{1,3})(?::\s*["“]([^"”\]]*)["”][^\]\n]*)?\]/g
/** A plain quoted passage: checked too, because a model that stops writing markers must not stop being checked. */
const PLAIN_QUOTE = /["“]([^"”\n]{1,800}?)["”]/g

/** The words a quote found in nothing carries. The product's own voice, never a code. */
export const NOT_IN_WHAT_WE_HAVE = '(we could not find these words in what we have on file)'

/** Where a normalised quote starts in the raw text — HR's `normalisedWithMap`, copied. */
export function normalisedWithMap(raw: string): { norm: string; at: number[] } {
  let norm = ''
  const at: number[] = []
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '<') { const close = raw.indexOf('>', i); if (close !== -1) { i = close; continue } }
    const l = c.toLowerCase()
    if (/[a-z0-9]/.test(l) && l.length === 1) { norm += l; at.push(i) }
  }
  return { norm, at }
}

/** The claimed passage first, then every other — a quote may be right about the words and wrong about the place. */
export function checkQuote(quote: string, claimedId: string, passages: Passage[]): Passage | null {
  if (quote.trim().split(/\s+/).filter(Boolean).length < QUOTE_MIN_WORDS) return null
  const q = normaliseForQuote(quote)
  if (q.length < 8) return null
  const claimed = passages.find((p) => p.id === claimedId)
  for (const p of [...(claimed ? [claimed] : []), ...passages.filter((x) => x !== claimed)]) {
    // A passage with nothing stored to quote (a date whose reading kept no line) can never match:
    // `''.includes(q)` is false for any real quote, and this says so out loud.
    if (!p.text) continue
    if (normalisedWithMap(p.text).norm.includes(q)) return p
  }
  return null
}

export interface CheckedAnswer {
  text: string
  sources: AskSource[]
  /** Markers whose quote was in no passage: removed from the text and counted. */
  droppedQuotes: number
  /** Citations of a page this call's search did not return: removed and counted. */
  droppedLinks: number
  /** Plain quotes found in neither the passages nor a cited web page: kept, marked, counted. */
  notFound: number
}

/**
 * AT DONE: check, number, count. The order is HR's — plain quotes first (so a quote the model wrote
 * without a marker still becomes a card), then the markers, numbered together by first appearance.
 */
export function finishAnswer(
  text: string, cited: Source[], searched: Array<{ url: string; title: string }>,
  passages: Passage[], webPassages: CitedPassage[] = [],
): CheckedAnswer {
  const kept: string[] = []
  // A marker is masked while plain quotes are checked, or the quote inside it would be checked twice.
  const masked = text.replace(/\[[A-Z]{1,2}\d{1,3}(?::\s*["“][^"”\]]*["”][^\]\n]*)?\]/g, (m) => {
    kept.push(m); return `\u0000${kept.length - 1}\u0000`
  })
  let notFound = 0
  const nOf = (url: string) => cited.find((s) => s.url === url)?.n
  const plain = masked.replace(PLAIN_QUOTE, (whole: string, inner: string, at: number, all: string) => {
    if (inner.trim().split(/\s+/).filter(Boolean).length < QUOTE_MIN_WORDS) return whole
    const hit = checkQuote(inner, '', passages)
    if (hit) return `[${hit.id}: "${inner.trim()}"]`
    // A web page's own words, if this call cited the page the passage came from.
    const q = normaliseForQuote(inner)
    const web = webPassages.find((p) => normaliseForQuote(p.citedText).includes(q))
    const n = web ? nOf(web.url) : undefined
    if (n) {
      const after = all.slice(at + whole.length)
      return new RegExp(`^[.,;:!?)]*\\s*\\[${n}\\]`).test(after) ? whole : `${whole}[${n}]`
    }
    notFound++
    return `${whole} ${NOT_IN_WHAT_WE_HAVE}`
  })
  const unmasked = plain.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)])

  const sources: AskSource[] = []
  const webNew = new Map<number, number | null>()
  const quoteNew = new Map<string, number>()
  let droppedQuotes = 0
  let droppedLinks = 0
  const byOld = new Map(cited.map((s) => [s.n, s]))

  const out = unmasked.replace(MARKER, (whole, webN: string | undefined, pid: string | undefined, quote: string | undefined) => {
    if (webN) {
      const old = Number(webN)
      if (!webNew.has(old)) {
        const s = byOld.get(old)
        const hit = s ? findReturned(s.url, searched) : undefined
        if (!s || !hit) { webNew.set(old, null); droppedLinks++ }
        else { const n = sources.length + 1; webNew.set(old, n); sources.push({ n, kind: 'web', title: s.title, url: s.url, label: labelFor(s.url) }) }
      }
      const n = webNew.get(old)
      return n == null ? '' : `[${n}]`
    }
    const hit = quote ? checkQuote(quote, pid ?? '', passages) : null
    const lead = /^\s/.test(whole) ? whole[0] : ''
    if (!hit) { droppedQuotes++; return lead === ' ' ? '' : lead }
    const key = `${hit.id}|${normaliseForQuote(quote!)}`
    let n = quoteNew.get(key)
    if (!n) {
      n = sources.length + 1
      quoteNew.set(key, n)
      sources.push({ n, kind: 'passage', title: hit.title, url: '', label: hit.label,
        passage_id: hit.id, quote: quote!.trim(), href: hit.href ?? null })
    }
    // The quote stays where the model put it, then its number — staging, 7 October: the model writes
    // the marker in the quote's own place, so the number alone read as a footnote to nothing.
    return `${lead}“${quote!.trim()}”[${n}]`
  })
  // LAST, after the numbering: anything still carrying an internal id is named instead.
  return { text: replacePassageIds(out, passages), sources, droppedQuotes, droppedLinks, notFound }
}

/**
 * *** AN INTERNAL ID NEVER REACHES THE PERSON — HR 6c's rule, and a real run proved the Calendar
 * needs it too. *** The first Haiku run of step 10a answered *"we have this on your calendar as
 * dates C6 and C7"* and *"on your calendar as dates C1–C5"*: C6 is the engine's own handle for a
 * passage, meaningless to anybody reading it, and it had gone through the check untouched because
 * the check only looks at markers and quotes.
 *
 * So, as `lib/hrAnswer.ts` `replaceBlockIds` does for H12: after the markers are numbered, any
 * bare id left in the text becomes the thing it names. An id the answer was never given is left
 * exactly as written — there is nothing true to put in its place.
 */
export function replacePassageIds(text: string, passages: Passage[]): string {
  const byId = new Map(passages.map((p) => [p.id, p.shortName ?? p.title]))
  /**
   * A RANGE FIRST, AND IT IS NOT PEDANTRY: the same run wrote "on your calendar as confirmed
   * dates C1–C5", and five titles spliced into that sentence is worse than the ids were. A range
   * is the model counting, so the replacement counts: "…as confirmed dates (5 of them)".
   */
  /**
   * AND A LIST IS A RANGE WRITTEN OUT. The next run wrote "(C1, C2, C3, C4, C5)" instead, and
   * five long titles spliced into one parenthesis is the thing the range rule exists to avoid.
   * Three or more ids in a row collapse the same way; two keep their names, which reads well.
   */
  const listed = text.replace(/\b[A-Z]{1,2}\d{1,3}(?:\s*(?:,|and)\s*[A-Z]{1,2}\d{1,3}){2,}/g, (whole) => {
    const ids = whole.match(/[A-Z]{1,2}\d{1,3}/g) ?? []
    return ids.every((i) => byId.has(i)) ? `${ids.length} of them` : whole
  })
  const ranged = listed.replace(/\b([A-Z]{1,2})(\d{1,3})\s*[–—-]\s*\1?(\d{1,3})\b/g,
    (whole, letter: string, from: string, to: string) => {
      const a = Number(from)
      const b = Number(to)
      if (!byId.has(`${letter}${a}`) || !byId.has(`${letter}${b}`) || b <= a) return whole
      return `(${b - a + 1} of them)`
    })
  return ranged.replace(/\b(dates?\s+|passages?\s+)?([A-Z]{1,2}\d{1,3})\b/g, (whole, word: string | undefined, id: string) => {
    const name = byId.get(id)
    return name ? `${word ?? ''}${name}` : whole
  })
}

/** For a follow-up turn: each source put back behind its number, so the model sees what it cited. */
export function appendSources(answer: string, sources?: AskSource[] | null): string {
  if (!answer) return answer
  const list = (sources ?? []).map((s) => s.kind === 'web'
    ? `[${s.n}] ${s.title} — ${s.url}`
    : `[${s.n}] ${s.title} — “${s.quote}”`)
  return list.length ? `${answer}\n\n${list.join('\n')}` : answer
}

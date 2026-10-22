/**
 * TWO READS OF THE SAME WEBSITE, SIDE BY SIDE — My Account step 15, the owner's test, part B.
 *
 * `ACCOUNT-PLAN.md` decision 9 says the website read runs on `AI_MODEL_WEBSITE`, *"Opus 5.5 to
 * start; Sonnet 5.5 compared at the test"*. This is the comparing: the DRAWING of it, kept apart
 * from the running of it so that what the owner sees can be tested without a model.
 *
 * *** IT SHOWS WHAT THE PRODUCT WOULD SHOW, NOT WHAT THE MODEL SAID. *** Every card below is a
 * `WebsiteProposal` — the output of `parseProposal`, which drops an invented NAICS code, refuses a
 * reply that is not in shape and turns "" into nothing. Comparing raw answers would compare two
 * things neither of which a customer can ever see.
 */
import type { WebsiteProposal } from '../prompts/website-read.ts'

/** What one model's run cost and took. `costUsd` is null for a model not in `config/pricing.ts`. */
export interface RunMeta {
  model: string
  seconds: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  /** Set when the call itself failed: the card is that sentence and nothing else. */
  error?: string | null
}

export const CARD_WIDTH = 56
export const MAX_HOSTS = 8
/** The two the plan names. A third would be another column and another bill. */
export const COMPARE_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'] as const

/** `(none)` rather than a blank, so a missing answer is visibly an answer. */
const NONE = '(none)'

/** Fold a line to `width`, breaking on spaces, so a sentence can sit in a column. */
export function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const out: string[] = []
  let line = ''
  for (const w of words) {
    if (!line) { line = w; continue }
    if (line.length + 1 + w.length <= width) { line += ' ' + w; continue }
    out.push(line)
    line = w
  }
  out.push(line)
  // A single word longer than the column is cut rather than allowed to break the layout.
  return out.flatMap((l) => (l.length <= width ? [l] : (l.match(new RegExp(`.{1,${width}}`, 'g')) ?? [l])))
}

/**
 * One card, in the words the walk's screen 1 uses.
 *
 * The NAICS line carries OUR title and never the model's — `parseProposal` already threw the
 * model's away — which is the whole point of showing it here: the owner is comparing which model
 * picked a code that survived validation, not which wrote a prettier title.
 */
export function cardLines(proposal: WebsiteProposal | null, meta: RunMeta, width = CARD_WIDTH): string[] {
  const out: string[] = []
  out.push(meta.model)
  out.push('-'.repeat(Math.min(width, meta.model.length + 8)))
  if (meta.error) {
    out.push(...wrap(`REFUSED: ${meta.error}`, width))
    return out
  }
  if (!proposal) {
    out.push(...wrap('The answer was not in shape, so nothing is proposed.', width))
    out.push('')
    out.push(...wrap(timing(meta), width))
    return out
  }
  // Every indented line is wrapped to `width - 2`, because `indent` adds the two back. Getting
  // this wrong is how a column quietly becomes 58 characters wide and the second card shifts.
  const body = width - 2
  out.push('Name')
  out.push(...wrap(proposal.name ?? NONE, body).map(indent))
  out.push('What you do')
  out.push(...wrap(proposal.what_you_do ?? NONE, body).map(indent))
  out.push('NAICS')
  out.push(...wrap(
    proposal.naics_code ? `${proposal.naics_code} — ${proposal.naics_title ?? ''}`.trim() : NONE,
    body).map(indent))
  out.push(`Addresses (${proposal.addresses.length})`)
  if (!proposal.addresses.length) out.push(indent(NONE))
  for (const a of proposal.addresses) {
    out.push(...wrap(`${a.label ? `${a.label}: ` : ''}${a.address}`, body).map(indent))
  }
  out.push('Note')
  out.push(...wrap(proposal.notes ?? NONE, body).map(indent))
  out.push('')
  out.push(...wrap(timing(meta), width))
  return out
}

const indent = (s: string) => `  ${s}`

/**
 * "9.1s · 4,023 in / 554 out · $0.0272" — or, for a model we have no price for, the tokens and a
 * sentence saying so. `config/pricing.ts` prices an unlisted model as **null on purpose**: a model
 * id that resolves at the API and prices as zero is the one failure mode that leaves a total
 * looking healthy, so this says it out loud instead.
 */
export function timing(meta: RunMeta): string {
  const n = (x: number) => x.toLocaleString('en-US')
  const money = meta.costUsd === null
    ? 'cost unknown — this model is not in config/pricing.ts'
    : `$${meta.costUsd.toFixed(4)}`
  return `${meta.seconds.toFixed(1)}s · ${n(meta.inputTokens)} in / ${n(meta.outputTokens)} out · ${money}`
}

/**
 * *** THE TWO CARDS ARE ALIGNED BLOCK BY BLOCK, NOT LINE BY LINE. ***
 *
 * Zipping the two columns row by row puts "NAICS" on the left beside "Addresses" on the right as
 * soon as one sentence wraps to three lines and the other to two — and the owner is comparing
 * NAICS to NAICS. So each labelled block is padded to the height of its partner, and the two stay
 * shoulder to shoulder all the way down.
 */
export function cardBlocks(proposal: WebsiteProposal | null, meta: RunMeta, width = CARD_WIDTH): string[][] {
  const lines = cardLines(proposal, meta, width)
  const blocks: string[][] = []
  for (const line of lines) {
    // A heading starts at column 0 and is not the rule under the model name; everything else
    // belongs to the block above it.
    const isHeading = line.length > 0 && !line.startsWith(' ')
    if (isHeading || !blocks.length) blocks.push([line])
    else blocks[blocks.length - 1].push(line)
  }
  return blocks
}

/** Two cards, block beside block. */
export function sideBySideBlocks(left: string[][], right: string[][], width = CARD_WIDTH, gap = 4): string[] {
  const out: string[] = []
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i] ?? []
    const r = right[i] ?? []
    const rows = Math.max(l.length, r.length)
    for (let j = 0; j < rows; j++) {
      out.push(`${(l[j] ?? '').padEnd(width)}${' '.repeat(gap)}${r[j] ?? ''}`.trimEnd())
    }
  }
  return out
}

/** Two cards in two columns, padded so the second starts at the same place on every row. */
export function sideBySide(left: string[], right: string[], width = CARD_WIDTH, gap = 4): string[] {
  const rows = Math.max(left.length, right.length)
  const out: string[] = []
  for (let i = 0; i < rows; i++) {
    const l = (left[i] ?? '').padEnd(width)
    const r = right[i] ?? ''
    out.push(`${l}${' '.repeat(gap)}${r}`.trimEnd())
  }
  return out
}

/** What was fetched, above the two cards: the product's own caps, in the product's own words. */
export function pagesHeader(host: string, pages: Array<{ url: string; chars: number }>): string[] {
  const total = pages.reduce((n, p) => n + p.chars, 0)
  return [
    `=== ${host} — ${pages.length} page(s), ${total.toLocaleString('en-US')} characters`,
    ...pages.map((p) => `    ${String(p.chars).padStart(5)}  ${p.url}`),
    '',
  ]
}

/**
 * A host the product could not read prints the PRODUCT'S own reason, not a new sentence: these are
 * the words a customer would be shown, and the point of this run is to see what they would see.
 */
export function unreadableHeader(host: string, reason: string, sentence: string): string[] {
  return [`=== ${host} — could not be read (${reason})`, `    ${sentence}`, '']
}

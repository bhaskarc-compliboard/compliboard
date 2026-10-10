/**
 * ONE FRAME FOR EVERY EMAIL THE PRODUCT SENDS — Calendar B5 (boards 14 and 15, decision 11).
 *
 * The owner, 9 October 2026, looking at the four plain-text emails: *"this does not look like coming
 * from a very professional company."* He was right. Four emails, four shapes, no letterhead, nothing
 * saying who sent it or why it arrived — the monthly calendar email, Documents' batch email, the
 * audit-finished email and the handbook-check email.
 *
 * *** THE ONE RULE THIS FILE EXISTS FOR: HTML AND PLAIN TEXT ARE MADE FROM THE SAME OBJECT. ***
 * Every email client that refuses HTML shows the text part, and the usual way that goes wrong is two
 * bodies written side by side: one gets a new line, the other does not, and the plain-text reader
 * quietly gets an older email for months. Here a section is described ONCE, as data, and rendered
 * twice. A section that is not in the object is in neither part, and there is no way to add one to
 * only one of them.
 *
 * **Each section's words stay its own.** This file holds no sentence about dates, audits, documents
 * or handbooks — only the frame around them, plus the "why you got this" line, which is the one
 * sentence in an email that is not about the work.
 *
 * ── WHY IT IS WRITTEN THE WAY IT IS ────────────────────────────────────────────────────────────
 * Email HTML is not web HTML. It is read by Outlook (which renders with Word), Gmail (which strips
 * `<style>` blocks and anything it does not like), and twenty others. So:
 *
 *   - **Every style is inline.** A `<style>` block is removed by Gmail's web client.
 *   - **Tables, not flexbox or grid.** Outlook's engine supports neither.
 *   - **600px wide.** The width every client has handled since the 1990s; wider gets cut off.
 *   - **No images and no web fonts.** An image is blocked by default and shows a broken box, so a
 *     logo that is a picture is a broken box in most inboxes on first open. **The wordmark is TEXT**
 *     (the owner's: no square, "Compli" in the app's green and "Board" in orange), which means it
 *     renders everywhere, costs nothing to load, and survives dark mode.
 *   - **System fonts only**, with Georgia for the title: a serif that is actually installed on
 *     Windows, macOS, iOS and Android, so the title looks the same as the app's instead of falling
 *     back to Times.
 *   - **One green button**, because an email with four links has no call to action. Buttons are
 *     `<a>` with padding, not `<button>`, which does nothing in an inbox.
 */

/** The app's green, and the wordmark's orange (the owner, 9 October 2026 — `docs/DESIGN.md` Brand). */
export const BRAND_GREEN = '#2F7D52'
export const BRAND_ORANGE = '#F94300'

const INK = '#1a1a1a'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'
const PAPER = '#f6f7f6'
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"

/** One row of a list: a lead (usually a day), the thing itself, and optional quieter parts. */
export interface EmailRow {
  lead?: string | null
  main: string
  meta?: string | null
  /** A short state word — "not confirmed". Quieter still, and never alarming. */
  tag?: string | null
}

/** A link or a button. `textLabel` keeps the plain-text wording when it differs from the HTML's. */
export interface EmailAction { label: string; href: string; textLabel?: string }

export type EmailBlock =
  /**
   * The three counts across the top (board 14). **HTML ONLY, deliberately.**
   * The plain-text part carries the same numbers in its own headings — "Due this month (2):" —
   * and the owner's rule for board 14 is that the text keeps its own order and words. So this is
   * a second PRESENTATION of numbers the text already states, not a section missing from it; the
   * frame's test knows about it by name rather than by accident.
   */
  | { kind: 'counts'; items: Array<{ n: number; label: string }> }
  /**
   * The grey panel at the foot: what to do, as one green button, with a quieter text link beside
   * it. One button per email (board 14) — two calls to action are none.
   */
  | { kind: 'panel'; text?: string; button: EmailAction; link?: EmailAction }
  | { kind: 'para'; text: string }
  /** A quieter paragraph: the gentle reminder, the "not legal advice" lines. */
  | { kind: 'note'; text: string }
  /**
   * `heading` is the PLAIN-TEXT heading and stays exactly as each section wrote it
   * ("Due this month (2):"). `htmlHeading` is the quiet uppercase label the HTML uses instead
   * ("DUE THIS MONTH") — no colon, no count, because the count is in the strip above it.
   */
  | { kind: 'list'; heading: string; htmlHeading?: string; rows: EmailRow[]; more?: string | null }
  /** ONE LINK PER SECTION (board 12), never one per row: in plain text that is a wall of addresses. */
  | { kind: 'link'; label: string; href: string }

export interface EmailContent {
  /** The company this is about, shown under the wordmark. */
  company: string
  /** The serif title, the one line that says what this email is. */
  title: string
  blocks: EmailBlock[]
  /** The single green button. Omitted when a `panel` block carries it instead. */
  button?: EmailAction | null
  /** Quiet lines above the footer rule — the "not legal advice" kind. */
  footnotes?: string[]
  /**
   * WHY THIS ARRIVED, in one sentence. Required, and not optional on purpose: three of the four
   * emails had no such line, and an email with no explanation of why it reached you is the one
   * people mark as spam — which takes the other three down with it, since they share a sender.
   */
  why: string
  /**
   * A staging banner. When `NOTIFY_TEST_TO` redirects an email, the people it WOULD have gone to are
   * named at the top, so a test send is never mistaken for the real thing.
   */
  banner?: string | null
}

// ── PLAIN TEXT ────────────────────────────────────────────────────────────────────────────────
/** `  5 November · Monthly EHS self-check · Portland plant · not confirmed` */
function textRow(r: EmailRow): string {
  return '  ' + [r.lead, r.main, r.meta, r.tag].filter(Boolean).join(' · ')
}

export function renderText(c: EmailContent): string {
  const out: string[] = []
  if (c.banner) out.push(c.banner, '')
  // *** THE PLAIN-TEXT LETTERHEAD. ***
  // Caught by `tests/unit/emailFrame.test.ts`, which asserts that everything in the content object
  // reaches BOTH parts: the HTML had the wordmark and the company's name at the top and the text
  // part named the company nowhere at all. For three of the four emails that meant a plain-text
  // reader could not tell which of their companies it was about — which is the exact drift between
  // the two bodies this file exists to make impossible, found on the first run of the test.
  out.push(`CompliBoard — ${c.company}`, c.title, '')
  for (const b of c.blocks) {
    // The counts strip is HTML-only: the text says the same numbers in its headings.
    if (b.kind === 'counts') continue
    if (b.kind === 'panel') {
      if (b.text) out.push(b.text, '')
      out.push(`${b.button.textLabel ?? b.button.label}: ${b.button.href}`, '')
      if (b.link) out.push(`${b.link.textLabel ?? b.link.label}: ${b.link.href}`, '')
      continue
    }
    if (b.kind === 'para' || b.kind === 'note') { out.push(b.text, '') }
    else if (b.kind === 'list') {
      out.push(b.heading)
      for (const r of b.rows) out.push(textRow(r))
      if (b.more) out.push('  ' + b.more)
      out.push('')
    } else {
      out.push(`${b.label}: ${b.href}`, '')
    }
  }
  if (c.button) out.push(`${c.button.textLabel ?? c.button.label}: ${c.button.href}`, '')
  for (const f of c.footnotes ?? []) out.push(f)
  if (c.footnotes?.length) out.push('')
  out.push(c.why)
  return out.join('\n')
}

// ── HTML ──────────────────────────────────────────────────────────────────────────────────────
/**
 * *** EVERY STRING FROM OUTSIDE GOES THROUGH THIS. ***
 * A company called `Smith & Sons <Portland>` would otherwise break the markup, and a document title
 * is whatever a customer named their file. There is no sanitiser in an inbox to catch it later.
 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A URL used in `href`. Anything that is not plainly http(s) becomes the app's own origin. */
function safeHref(href: string): string {
  return /^https?:\/\//i.test(href) ? esc(href) : '#'
}

function htmlRow(r: EmailRow): string {
  const lead = r.lead
    ? `<span style="color:${INK};font-weight:600;white-space:nowrap">${esc(r.lead)}</span> &nbsp;`
    : ''
  const meta = r.meta ? `<span style="color:${MUTED}"> · ${esc(r.meta)}</span>` : ''
  // The state word is quieter than the date, never red, and never alarming: all we know is what the
  // row says (§185c).
  const tag = r.tag
    ? `<span style="color:${MUTED};font-size:13px"> · ${esc(r.tag)}</span>`
    : ''
  return `<tr><td style="padding:7px 0;border-bottom:1px solid ${LINE};font:400 15px/1.45 ${SANS};color:${INK}">`
    + `${lead}${esc(r.main)}${meta}${tag}</td></tr>`
}

/** The green button, used by the footer button and by a panel. */
function htmlButton(a: EmailAction): string {
  return `<a href="${safeHref(a.href)}" style="display:inline-block;padding:11px 22px;`
    + `background:${BRAND_GREEN};color:#ffffff;font:600 15px/1 ${SANS};`
    + `text-decoration:none;border-radius:8px">${esc(a.label)}</a>`
}

function htmlBlock(b: EmailBlock): string {
  if (b.kind === 'counts') {
    // A table, not flexbox: Outlook. Equal columns by percentage so two or three both sit right.
    const w = Math.floor(100 / Math.max(b.items.length, 1))
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `
      + `style="margin:0 0 22px;border-collapse:separate;border-spacing:8px 0"><tr>`
      + b.items.map((i) => `<td width="${w}%" style="background:${PAPER};border:1px solid ${LINE};`
        + `border-radius:10px;padding:12px 14px;text-align:center">`
        + `<div style="font:700 24px/1.1 ${SANS};color:${INK}">${i.n}</div>`
        + `<div style="margin-top:3px;font:400 12px/1.35 ${SANS};color:${MUTED}">${esc(i.label)}</div>`
        + `</td>`).join('')
      + `</tr></table>`
  }
  if (b.kind === 'panel') {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `
      + `style="margin:4px 0 20px;background:${PAPER};border:1px solid ${LINE};border-radius:12px">`
      + `<tr><td style="padding:16px 18px">`
      + (b.text ? `<p style="margin:0 0 12px;font:400 14px/1.5 ${SANS};color:${INK}">${esc(b.text)}</p>` : '')
      + htmlButton(b.button)
      + (b.link ? `<a href="${safeHref(b.link.href)}" style="margin-left:16px;color:${MUTED};`
        + `font:400 14px/1 ${SANS};text-decoration:underline">${esc(b.link.label)}</a>` : '')
      + `</td></tr></table>`
  }
  if (b.kind === 'para') {
    return `<p style="margin:0 0 16px;font:400 15px/1.55 ${SANS};color:${INK}">${esc(b.text)}</p>`
  }
  if (b.kind === 'note') {
    return `<p style="margin:0 0 16px;font:400 14px/1.55 ${SANS};color:${MUTED}">${esc(b.text)}</p>`
  }
  if (b.kind === 'link') {
    return `<p style="margin:0 0 16px;font:400 15px/1.55 ${SANS}">`
      + `<a href="${safeHref(b.href)}" style="color:${BRAND_GREEN};text-decoration:underline">${esc(b.label)}</a></p>`
  }
  const more = b.more
    ? `<tr><td style="padding:7px 0;font:400 14px/1.45 ${SANS};color:${MUTED}">${esc(b.more)}</td></tr>`
    : ''
  return `<p style="margin:0 0 6px;font:600 12px/1.4 ${SANS};color:${MUTED};`
    + `text-transform:uppercase;letter-spacing:.04em">${esc(b.htmlHeading ?? b.heading)}</p>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" `
    + `style="margin:0 0 20px;border-collapse:collapse">${b.rows.map(htmlRow).join('')}${more}</table>`
}

export function renderHtml(c: EmailContent): string {
  const banner = c.banner
    ? `<tr><td style="padding:10px 32px;background:#fef9c3;font:400 13px/1.4 ${SANS};color:#713f12">`
      + `${esc(c.banner)}</td></tr>`
    : ''
  const button = c.button ? `<tr><td style="padding:8px 0 4px">${htmlButton(c.button)}</td></tr>` : ''
  const footnotes = (c.footnotes ?? []).length
    ? `<p style="margin:20px 0 0;font:400 13px/1.5 ${SANS};color:${MUTED}">`
      + (c.footnotes ?? []).map(esc).join('<br>') + `</p>`
    : ''

  // `role="presentation"` keeps a screen reader from announcing the layout tables as data tables.
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-font-smoothing:antialiased">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER}">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:14px;overflow:hidden">
${banner}
<tr><td style="padding:26px 32px 0">
  <p style="margin:0;font:700 19px/1 ${SANS};letter-spacing:-.01em">
    <span style="color:${BRAND_GREEN}">Compli</span><span style="color:${BRAND_ORANGE}">Board</span></p>
  <p style="margin:5px 0 0;font:400 13px/1.4 ${SANS};color:${MUTED}">${esc(c.company)}</p>
</td></tr>
<tr><td style="padding:18px 32px 0">
  <h1 style="margin:0 0 18px;font:400 23px/1.3 ${SERIF};color:${INK}">${esc(c.title)}</h1>
  ${c.blocks.map(htmlBlock).join('\n  ')}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">${button}</table>
  ${footnotes}
</td></tr>
<tr><td style="padding:22px 32px 26px">
  <div style="border-top:1px solid ${LINE};padding-top:14px">
    <p style="margin:0;font:400 12px/1.5 ${SANS};color:${MUTED}">${esc(c.why)}</p>
  </div>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

/**
 * The pair, from one object. **This is the only function the four emails call** — `renderHtml` and
 * `renderText` are exported for the tests and for nothing else, because calling one without the
 * other is exactly the drift this file exists to prevent.
 */
export function renderEmail(c: EmailContent): { html: string; text: string } {
  return { html: renderHtml(c), text: renderText(c) }
}

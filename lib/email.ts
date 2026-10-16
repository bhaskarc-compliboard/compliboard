/**
 * THE ONE EMAIL TEMPLATE — Calendar step 11 (decision 25; board 10 in `docs/calendar-boards.html`).
 *
 * Every product email is the same object: a title, a lede, grouped rows, one button, a footer.
 * This file turns that object into the HTML a person sees and the plain text their client falls
 * back to — **both from the same shape, so the two can never say different things.** A second
 * author for the text version is how an email ends up with a link in one half and not the other.
 *
 * *** WHY A TEMPLATE AT ALL, when three emails already exist. *** `lib/documentBatch.ts`,
 * `lib/auditNotify.ts` and `lib/handbookCheckNotify.ts` each build their own plain-text body by
 * pushing strings into an array. That was right for one email and is wrong for four: the product's
 * footer, its wordmark, what a link looks like and what a row looks like are now decided in four
 * places. **The three are NOT moved in this step** (decision 25's follow-up, `HANDOFF-CODE.md` §7);
 * nothing in their files is touched here.
 *
 * *** HTML EMAIL IS NOT HTML. *** Inline styles only, tables for layout, no stylesheet, no flexbox,
 * no CSS variable: Outlook and Gmail strip or ignore all of it. The 600px card, the padding and the
 * colours are board 10's, written out by hand because the board's own CSS cannot travel.
 *
 * It calls nothing and reads nothing — a pure function, so `tests/unit/email.test.ts` can render a
 * fixed shape and read both halves.
 */

/** One line in an email: what it says, what it says underneath, and where it goes. */
export interface EmailRow {
  primary: string
  secondary?: string
  /** An absolute URL. A relative one would be dead in a mail client. */
  href?: string
}

export interface EmailSection {
  heading?: string
  rows: EmailRow[]
}

export interface EmailShape {
  title: string
  lede: string
  sections: EmailSection[]
  button?: { label: string; href: string }
  /** One paragraph each, in order. The last word the email says. */
  footer: string[]
}

/** The product's colours, as `app/globals.css` and board 10 have them. */
export const BRAND = {
  green: '#2F7D52',
  orange: '#F94300',
  ink: '#14171A',
  inkSoft: '#6B7280',
  inkFaint: '#9CA3AF',
  line: '#E5E7EB',
  page: '#F7F8FA',
} as const

const esc = (s: string): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The wordmark, as the app draws it (`components/AppLayout.tsx:269`): two words, two colours, one
 * weight. Not an image — an image is what a mail client blocks by default, and a product whose
 * name does not appear until somebody presses "show images" is a product that looks like spam.
 */
const wordmark = () =>
  `<span style="font-size:18px;font-weight:600;letter-spacing:-0.01em">`
  + `<span style="color:${BRAND.green}">Compli</span><span style="color:${BRAND.orange}">Board</span></span>`

const rowHtml = (r: EmailRow): string => {
  const primary = r.href
    ? `<a href="${esc(r.href)}" style="color:${BRAND.ink};text-decoration:none">${esc(r.primary)}</a>`
    : esc(r.primary)
  return `<tr><td style="padding:9px 0;border-top:1px solid ${BRAND.line};font-size:14px;line-height:20px;color:${BRAND.ink}">`
    + primary
    + (r.secondary ? `<br><span style="font-size:12px;color:${BRAND.inkSoft}">${esc(r.secondary)}</span>` : '')
    + '</td></tr>'
}

const sectionHtml = (s: EmailSection): string =>
  (s.heading
    ? `<p style="margin:22px 0 6px;font-size:12px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:#374151">${esc(s.heading)}</p>`
    : '')
  + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-bottom:1px solid ${BRAND.line}">`
  + s.rows.map(rowHtml).join('')
  + '</table>'

/**
 * THE PLAIN-TEXT TWIN. Every row, every link and every footer line, in the same order — a client
 * that shows this instead of the HTML must not get a shorter email, only a plainer one. The link
 * is written out in full, because in plain text there is nothing to click through to.
 */
function renderText(shape: EmailShape): string {
  const out: string[] = [shape.title, '', shape.lede, '']
  for (const s of shape.sections) {
    if (s.heading) out.push(s.heading.toUpperCase(), '')
    for (const r of s.rows) {
      out.push(`  ${r.primary}`)
      if (r.secondary) out.push(`    ${r.secondary}`)
      if (r.href) out.push(`    ${r.href}`)
    }
    out.push('')
  }
  if (shape.button) out.push(`${shape.button.label}: ${shape.button.href}`, '')
  out.push(...shape.footer)
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function renderHtml(shape: EmailShape): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(shape.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};-webkit-font-smoothing:antialiased">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.page}">
<tr><td align="center" style="padding:32px 12px 40px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#FFFFFF;border:1px solid ${BRAND.line};border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <tr><td style="padding:22px 32px 18px;border-bottom:1px solid ${BRAND.line}">${wordmark()}</td></tr>
  <tr><td style="padding:24px 32px 28px">
    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;line-height:30px;color:${BRAND.ink}">${esc(shape.title)}</h1>
    <p style="margin:6px 0 0;font-size:14px;line-height:20px;color:${BRAND.inkSoft}">${esc(shape.lede)}</p>
    ${shape.sections.map(sectionHtml).join('\n    ')}
    ${shape.button
      ? `<a href="${esc(shape.button.href)}" style="display:inline-block;margin-top:24px;padding:10px 18px;background:${BRAND.green};color:#FFFFFF;font-size:14px;font-weight:500;border-radius:6px;text-decoration:none">${esc(shape.button.label)}</a>`
      : ''}
  </td></tr>
  <tr><td style="padding:16px 32px 20px;border-top:1px solid ${BRAND.line};font-size:12px;line-height:18px;color:${BRAND.inkFaint}">
    ${shape.footer.map((f) => `<p style="margin:0 0 8px">${esc(f)}</p>`).join('\n    ')}
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

/** One email, both ways. Nothing else in the product renders an email body. */
export function renderEmail(shape: EmailShape): { html: string; text: string } {
  return { html: renderHtml(shape), text: renderText(shape) }
}

/**
 * The footer lines every product email ends with — the two the existing three carry in their own
 * words, said once. A section adds its own line BEFORE these (the Calendar's decision-18 line).
 */
export const FOOTER_NOT_LEGAL_ADVICE =
  'This is not legal advice; when in doubt, ask the agency.'
export const footerBecauseMember = (company: string): string =>
  `You get this because you are a member of ${company} on CompliBoard.`

/**
 * ====================================================================================
 * THE SANDBOX SENDER CANNOT REACH A CUSTOMER — Calendar step 14.
 * ====================================================================================
 *
 * Every product email today is sent `from: 'CompliBoard <onboarding@resend.dev>'`. That is
 * **Resend's shared sandbox address**, not a CompliBoard one: it exists so a new account can send
 * before it owns a domain, and the domain it claims to come from is not ours. The monthly calendar
 * email is the first of the four that goes to EVERY person at EVERY company on a schedule nobody
 * presses — `0 14 1 * *` — so the first of the month is the first moment the product can mail a
 * customer with nobody watching.
 *
 * *** SO THE RULE IS A GUARD AND NOT A NOTE IN A RUNBOOK. *** A runbook step is something a person
 * can forget on the 31st; this is something the code refuses on the 1st. On production, with the
 * sandbox sender still in place, the job claims nothing, sends nothing, says why in the log and
 * writes the refusal onto its `job_runs` row. Off production it is inert, so the laptop and the
 * isolated server are unchanged and every test still exercises the real path.
 *
 * *** IT IS A PURE FUNCTION OF TWO STRINGS *** so it can be tested without an environment and
 * without a mail client, and so the other three senders (`lib/documentBatch.ts`,
 * `lib/auditNotify.ts`, `lib/handbookCheckNotify.ts`) can adopt it by calling it — one line each.
 * **They have NOT adopted it in this step, deliberately:** all three already send from this address
 * on production today, so switching the guard on for them would silence three emails that work.
 * They take it in the same commit that moves all four `from:` lines to the verified domain, where
 * it is inert from the moment it lands. `docs/RELEASE.md`'s calendar section is that commit's
 * runbook; `docs/HANDOFF-CODE.md` §7 carries it as owed.
 */
export const SANDBOX_SENDER = 'onboarding@resend.dev'

/** The `from:` on every product email today. One line to change when the domain is verified. */
export const SANDBOX_FROM = `CompliBoard <${SANDBOX_SENDER}>`

/**
 * The refusal sentence, or null when there is nothing to refuse. Production is the exact word
 * `production` in `VERCEL_ENV`, which Vercel sets itself on every deployment and which exists
 * nowhere else — a laptop, a test and the isolated server all read `undefined` and pass.
 */
export function sandboxSenderRefusal(from: string, vercelEnv: string | undefined): string | null {
  if ((vercelEnv ?? '').trim() !== 'production') return null
  if (!from.toLowerCase().includes(SANDBOX_SENDER)) return null
  return `the sender is still ${SANDBOX_SENDER}, Resend's shared sandbox address, and this is `
    + 'production. Verify the CompliBoard domain in Resend and change the from: line '
    + '(docs/RELEASE.md, the calendar section). Nothing was claimed and nothing was sent.'
}

/**
 * THE PRINT FRAME — the canvas feature boards, board 10. Pure, so it is unit-tested
 * (`tests/unit/printFrame.test.ts`); `components/Drawer.tsx` `printDrawer()` writes it into the page
 * for the length of one print and removes it after.
 */

/** A string as a CSS `content` value: quotes and backslashes escaped, line breaks flattened. */
export function cssString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`
}

/**
 * *** THE PRINT FRAME — the canvas feature boards, board 10. ***
 *
 * Every printed drawer gets the same frame, drawn in the PAGE MARGINS with CSS page margin boxes
 * (`@top-left`, `@bottom-right`, …; Chrome 131 and later):
 *   · top of every page: the company (10px, uppercase, grey, spaced) left, the document type right,
 *     a hairline under them;
 *   · bottom of every page: a hairline, "Prepared with CompliBoard" left, "Page n of N" right —
 *     counted by the browser's own page counters, so the number is the real one, never a guess.
 *
 * *** AND IT IS WHAT TURNS OFF THE BROWSER'S OWN HEADER AND FOOTER. *** Chrome draws its date, title,
 * URL and page numbers in those same margins when "Headers and footers" is ticked. A page that puts
 * its own content in the margin boxes takes the margins over, and Chrome then draws nothing of its
 * own there — measured with the setting forced on (`DECISIONS.md` §160). So nothing here depends on
 * the person's print settings.
 *
 * *** THE SIDE MARGINS ARE 10mm, AND THAT IS MEASURED, NOT CHOSEN. *** At 16mm the right edge of
 * every printed drawer was clipped ("4 things to d…"), in Chrome 154, whatever the capture's own
 * margins were; at 10mm — just inside Chrome's own default of 0.4in — nothing is. Wider side margins
 * cut text off the page; keep them at or under 10mm. Top and bottom carry the frame and are wider.
 *
 * A margin box holds ONE run of text in ONE style, so "CompliBoard" cannot be set in a heavier
 * weight than "Prepared with" in the same box. The whole line is one style.
 *
 * It is written at print time, because a margin box can only hold literal text and the company
 * differs per user; `printDrawer` adds it before the dialog and removes it after.
 */
/**
 * *** THE ONE SENTENCE AT THE FOOT OF EVERY PAGE — decision 64, 4 November 2026. ***
 *
 * It was three sentences in three places: the report page's lede said *"Every line below points at
 * a document, or says what we do not see. None of it is a verdict on whether the company
 * complies."*, the binder's cover said *"Prepared with CompliBoard. …"* over again, and the
 * printed footer said *"Prepared with CompliBoard"* on its own. A reader met the same promise
 * twice before the first row and a third time at the bottom of every sheet.
 *
 * So it is said ONCE, where it belongs: at the foot, on every page, in the one place the product
 * speaks in its own voice about what the page is. **The cover and the lede now carry nothing in
 * CompliBoard's voice at all** — they carry the auditor's title, the dates and the counts, which
 * are facts about the audit.
 *
 * "and it is not legal advice; check before you act" is the app's own standing line
 * (`components/AppLayout.tsx`), brought onto the paper, where the footer is the only thing a
 * printed page has.
 */
export const PREPARED_LINE =
  'Prepared with CompliBoard. Every line points at a document, or says what we do not see. '
  + 'It is not a verdict on whether the company complies, and it is not legal advice; check before you act.'

/**
 * *** `white-space: nowrap` ON THE PAGE NUMBER, AND WHY IT IS THERE. ***
 * Decision 64's sentence is long, and a CSS margin box takes its share of the page width from its
 * neighbours: the first capture of the 24-page binder printed *"Page 1 of / 24"* across two lines
 * at the bottom right. The sentence itself fits — it wraps to two lines at the bottom left and
 * reads fine — but the page number is the one thing on a printed sheet that must stay on one.
 * (This note is out here because the CSS below is a template literal: a backtick inside it ends
 * the string, and every word of it would be shipped in the stylesheet of every printed page.)
 */
export function printFrameCss({ company, type }: { company: string; type: string }): string {
  const box = "font-family: plexSans, 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; color: #6B7280;"
  const top = `${box} font-size: 10px; vertical-align: bottom; padding-bottom: 6px; border-bottom: 0.5pt solid #D1D5DB;`
  const bottom = `${box} font-size: 9.5px; color: #9CA3AF; vertical-align: top; padding-top: 6px; border-top: 0.5pt solid #D1D5DB;`
  return `@media print {
  @page {
    margin: 20mm 10mm 18mm 10mm;
    @top-left { content: ${cssString(company)}; ${top} text-transform: uppercase; letter-spacing: 0.06em; text-align: left; }
    @top-center { content: ""; ${top} }
    @top-right { content: ${cssString(type)}; ${top} text-align: right; }
    @bottom-left { content: ${cssString(PREPARED_LINE)}; ${bottom} text-align: left; }
    @bottom-center { content: ""; ${bottom} }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); ${bottom} text-align: right; white-space: nowrap; }
  }
}`
}

/** "4 October 2026" — every date on paper is absolute. Never "Today" or "Yesterday". */
export function printDate(iso: string | Date | null | undefined): string {
  if (!iso) return ''
  const d = iso instanceof Date ? iso : new Date(String(iso).length === 10 ? `${iso}T00:00:00` : String(iso))
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * PRINT WITH THE FRAME — the one path every framed print takes: the four drawers (`printDrawer`,
 * `components/Drawer.tsx`) and the workspace conversation's Download (`app/compliance/page.tsx`).
 * Writes the frame for this print, stamps `bodyClass` if given (the drawers use `printing-drawer`),
 * prints, and takes both away after — on `afterprint`, or after a second if that never fires.
 * Browser-only; nothing here runs on import.
 */
export function printWithFrame(frame: { company: string; type: string }, bodyClass?: string): void {
  const body = document.body
  const style = document.createElement('style')
  style.setAttribute('data-print-frame', '')
  style.textContent = printFrameCss(frame)
  document.head.appendChild(style)
  const done = () => {
    if (bodyClass) body.classList.remove(bodyClass)
    style.remove()
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  if (bodyClass) body.classList.add(bodyClass)
  window.print()
  // A belt-and-braces removal: if `afterprint` never fires, nothing may survive the print.
  setTimeout(done, 1000)
}

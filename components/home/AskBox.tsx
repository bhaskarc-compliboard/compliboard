/**
 * THE ASK BOX — the product's own box, as it appears on every panel
 * (`docs/PUBLIC-PAGES-PLAN.md` decision 10: the left side is the moment and the MOVE, and the
 * move is the sentence the person typed).
 *
 * It holds NO WORDS OF ITS OWN (§2 rule 6). Every panel passes its own typed sentence, so the box
 * can be restyled once for nine panels without touching a single sentence.
 *
 * *** IT IS A PICTURE OF THE BOX, NOT A FORM. *** A <div>, and the send control is a
 * <span role="img">, not a <button>. A homepage that draws a text box and a send button people
 * can click and that then does nothing is a worse first impression than no box at all — and a
 * real <button> would also be reached by the Tab key, so a keyboard visitor would land on a
 * control with nothing behind it. `role="img"` with a label says what it is to a screen reader:
 * a picture of the send control, not the control.
 *
 * The arrow is an inline stroke SVG and `aria-hidden`: the label is on the span that holds it, so
 * the picture is announced once, not twice.
 */

export default function AskBox({
  typed,
  attach,
  label,
}: {
  /** The sentence shown as typed into the box. The panel's own words. */
  typed: string
  /** The small grey line under it, with the paperclip. Optional — not every panel attaches. */
  attach?: string
  /** What the send control is called, for a screen reader: the panel's verb ("Audit"). */
  label: string
}) {
  return (
    <div className="w-full max-w-[520px] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] px-4 pt-4 pb-3 shadow-[0_1px_2px_rgba(20,23,26,.05)]">
      <p className="text-[16px] text-[var(--ink)]">{typed}</p>

      {/* The attach line and the send control share one row; `justify-between` with an empty
          placeholder keeps the control on the right when a panel passes no attach line. */}
      <div className="mt-3 flex items-center justify-between gap-3">
        {attach ? (
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-[14px] w-[14px] shrink-0"
            >
              <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" />
            </svg>
            <span className="truncate">{attach}</span>
          </span>
        ) : (
          <span />
        )}

        <span
          role="img"
          aria-label={label}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[var(--green)]"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[16px] w-[16px]"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </span>
      </div>
    </div>
  )
}

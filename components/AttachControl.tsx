/**
 * THE ATTACH SLOT — the quiet line with the paperclip that sits under the ask box and at the right
 * of a list's heading row. Lifted out of `app/hr/HrWorkspace.tsx` (:105–120) CHARACTER FOR
 * CHARACTER at Calendar step 7, for the same reason `Tabs` and `Empty` were lifted out of the
 * workspace at HR Step 3a: the Calendar needs the same piece, and a copy of it is a copy that
 * drifts. HR's three call sites are unchanged — they pass `onClick` and `disabled` exactly as
 * before, and what the browser draws for them is the markup that was in that file.
 *
 * `href` is the one thing added, and it is added because the Calendar's slot is a LINK: until step 8
 * the Calendar has no uploader of its own, so "Add a document" goes to Company Documents, where the
 * upload control is. A link that navigates must be an `<a>` — a button with a `router.push` cannot
 * be opened in a new tab, and middle-clicking it does nothing, which is the kind of small lie the
 * report drawers' `<a href>` lines were written to avoid (`DECISIONS.md` §187).
 *
 * One or the other: `href` draws a link, `onClick` draws a button. Both would be a control whose
 * behaviour depends on which handler fires first.
 */
'use client'

/** The paperclip the attach line draws, at 13px in the line's own colour. */
const Pin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="shrink-0" aria-hidden="true"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.2a1.83 1.83 0 0 1-2.59-2.6l8.49-8.48" /></svg>
)

/** The workspace's attach control: a quiet 12px grey underlined line with the pin. */
export function AttachControl(
  { label, onClick, href, disabled }:
  { label: string; onClick?: () => void; href?: string; disabled?: boolean },
) {
  if (href) {
    return (
      <a href={href}
        className="inline-flex cursor-pointer items-center gap-1.5 text-left hover:text-gray-800">
        <Pin />
        <span className="underline">{label}</span>
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex cursor-pointer items-center gap-1.5 text-left hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300">
      <Pin />
      <span className="underline">{label}</span>
    </button>
  )
}

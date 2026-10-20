/**
 * A SECTION HEADING ON THE DASHBOARD — board 1's `.sect`, written once at step 6 and used by
 * Upcoming, Recent audits and (at step 7) the three questions.
 *
 * It is one piece rather than three copies for the reason `components/Tabs.tsx` is one piece: the
 * heading carries a way out of the section on the right, and three hand-written copies of "a serif
 * 20 on the left, a green link on the right, baseline-aligned" drift the moment one of them is
 * adjusted. The board's own numbers: 20px serif at weight 400, the action 13px in the dark green,
 * aligned on the baseline, 36px above and 8px below.
 *
 * The caller owns the words, both of them. Nothing here is a default — a heading with no action is
 * written by leaving `action` out, not by passing an empty one.
 */
import type React from 'react'

export function DashboardSection({ heading, action, href, quiet }: {
  heading: string
  /** The words on the right, e.g. "Open the Calendar →". Left out, nothing is drawn there. */
  action?: string
  href?: string
  /** A grey note in the action's place, for a section whose way out is not a link (step 7). */
  quiet?: React.ReactNode
}) {
  return (
    <div className="mt-9 mb-2 flex items-baseline justify-between gap-4">
      <h2 className="font-serif text-[20px] font-normal text-gray-900">{heading}</h2>
      {action && href && (
        <a href={href} className="shrink-0 whitespace-nowrap text-[13px] text-[var(--green-ink)] hover:underline">
          {action}
        </a>
      )}
      {!action && quiet && <span className="shrink-0 text-[12px] text-gray-400">{quiet}</span>}
    </div>
  )
}

export default DashboardSection

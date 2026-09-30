/**
 * *** THE LAST TWO STRINGS THAT NAMED WHAT DOES THE READING — changed 30 September 2026, Run 4a. ***
 *
 * `HANDOFF-AUDITS.md` §5.0: the product reads, finds, asks and says, and never names what does the
 * reading. The global footer was changed in Run 3b; these two were listed then and left, because
 * they are on pages that run did not review. They say the same three things — what the answers come
 * from, that they can be wrong, and to check — with the product as the subject.
 *
 * The component keeps its filename. A rename would touch two pages' imports for no gain, and
 * §15.8's rule about stable filenames is the same instinct: the name is a handle, not a claim.
 */
'use client'

interface AIDisclaimerProps {
  /** 'full' = the complete sentence, for app screens.
   *  'short' = the one-line version, for PDF footers and email footers. */
  variant?: 'full' | 'short'
  className?: string
}

export default function AIDisclaimer({ variant = 'full', className = '' }: AIDisclaimerProps) {
  if (variant === 'short') {
    return (
      <p className={`text-xs text-gray-400 ${className}`}>
        For information only, not legal or professional advice. Check before you act.
      </p>
    )
  }

  return (
    <div
      className={`rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 ${className}`}
    >
      Answers are drawn from your documents and current regulatory sources. They can be wrong; check
      before you act.
    </div>
  )
}

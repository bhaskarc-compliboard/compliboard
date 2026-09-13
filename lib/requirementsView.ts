/**
 * THE REQUIREMENTS SCREEN — the text, as functions.
 *
 * Spec: `docs/REQUIREMENTS-SCREEN.md`. Decisions: `DECISIONS.md` §21.3 (the four states), §58
 * (the six display contracts), §58.1 (why OWED and SHOWN never combine).
 *
 * *** WHY THE SENTENCES LIVE HERE AND NOT IN A COMPONENT. *** Every rule this screen carries is
 * a rule about what it SAYS — never a verdict, never a count, never "satisfied", an empty
 * evidence line rendered as a fact rather than a warning. A rule about wording is testable only
 * where the wording is produced. In a component it is testable only by rendering React, and the
 * assertion that matters most (§58.3, no numeric aggregates) then has to inspect markup.
 *
 * So the page composes these; it does not phrase anything itself.
 */

export type ObligationStatus = 'applies' | 'does_not_apply' | 'undetermined' | 'unknown'

export interface RequirementRow {
  requirementName: string
  citation: string
  agency: string | null
  category: string | null
  status: ObligationStatus
  /** Verbatim from `obligations.resolution_rationale`. NEVER summarised (§56.2's failure, in UI). */
  resolutionRationale: string
  siteName: string | null
  liveEvidence: number
  expiredEvidence: number
  contradictingEvidence: number
  nextExpiry: string | null
  evidenceNames: string[]
}

export interface RenderedRow {
  title: string
  subtitle: string
  /** "OWED" | "NOT OWED" | "UNRESOLVED" | "NOT YET KNOWN" */
  verdictLabel: string
  verdictText: string
  /** Present ONLY for `applies`. The second, independent fact (§58.1). */
  shownLabel?: string
  shownText?: string
  /** A fact, not a warning. `false` when there is simply no evidence yet. */
  shownIsWarning: boolean
  action?: string
}

const sub = (r: RequirementRow) =>
  [r.citation, r.agency ?? '(no agency)', r.category].filter(Boolean).join(' · ')

/**
 * What has been SHOWN. Separate from whether it is OWED, and never merged with it.
 *
 * *** "Nothing yet" IS NOT A WARNING. *** On day one it is true of every applicable requirement,
 * and dressing it as amber would make the honest default look like a failure. It becomes a
 * warning only when something was shown and then stopped counting.
 */
export function renderShown(r: RequirementRow): { text: string; isWarning: boolean; action?: string } {
  if (r.contradictingEvidence > 0) {
    return { text: `A linked document contradicts this.${r.evidenceNames.length ? '  ' + r.evidenceNames[0] : ''}`,
             isWarning: true }
  }
  if (r.liveEvidence === 0 && r.expiredEvidence > 0) {
    return { text: `The only document linked expired${r.nextExpiry ? ` on ${r.nextExpiry}` : ''}.`,
             isWarning: true, action: 'Link a current document' }
  }
  if (r.liveEvidence === 0) {
    return { text: 'Nothing yet. No document has been linked to this requirement.',
             isWarning: false, action: 'Link a document' }
  }
  const names = r.evidenceNames.slice(0, 2).join(', ')
  return { text: `${names}${r.nextExpiry ? ` — valid until ${r.nextExpiry}` : ''}.`, isWarning: false }
}

// ---------------------------------------------------------------------------
// THREE ROOTS, NOT ONE RENDERER WITH A SWITCH.
//
// *** A COMPONENT RENDERING THREE STATES MAKES THEM READ AS VARIATIONS OF ONE THING, AND THEY
// ARE NOT. *** "This is owed and nothing has been shown", "this is not owed and here is why"
// and "we cannot say yet, here is the question" are three different sentences a customer acts
// on differently. Sharing a body invites them to converge — a shared badge, a shared status
// word — and converging is the collapse §58.1 blocked M6 to prevent.
//
// Each root below is free to diverge. The dispatcher exists only so a caller with a mixed list
// does not have to switch.
// ---------------------------------------------------------------------------

const base = (r: RequirementRow) => ({ title: r.requirementName, subtitle: sub(r), shownIsWarning: false })

/** OWED and SHOWN, always both. An applies row without the evidence panel is a bare assertion. */
export function renderApplies(r: RequirementRow): RenderedRow {
  const shown = renderShown(r)
  return {
    ...base(r),
    verdictLabel: 'OWED',
    verdictText: (r.siteName ? `Yes — at ${r.siteName}. ` : 'Yes. ') + r.resolutionRationale,
    // *** UNCONDITIONAL. *** Not "when there is evidence". The panel saying "nothing yet" is
    // the whole point: without it the row asserts an obligation and stops, and the reader
    // finishes the sentence with "and you have done it".
    shownLabel: 'SHOWN',
    shownText: shown.text,
    shownIsWarning: shown.isWarning,
    action: shown.action,
  }
}

/** The reason IS the content. Verbatim — paraphrasing is §56.2 one layer out. */
export function renderDoesNotApply(r: RequirementRow): RenderedRow {
  return { ...base(r), verdictLabel: 'NOT OWED', verdictText: r.resolutionRationale,
           action: "That's wrong — fix" }
}

/** Answerable. The question, not a gap (§58.2). */
export function renderUnknown(r: RequirementRow): RenderedRow {
  return { ...base(r), verdictLabel: 'NOT YET KNOWN', verdictText: r.resolutionRationale,
           action: 'Answer the question' }
}

/** A dead end. NO action — offering a question the product cannot ask is §21.3's collapse. */
export function renderUndetermined(r: RequirementRow): RenderedRow {
  return { ...base(r), verdictLabel: 'UNRESOLVED', verdictText: r.resolutionRationale }
}

export function renderRow(r: RequirementRow): RenderedRow {
  switch (r.status) {
    case 'applies':        return renderApplies(r)
    case 'does_not_apply': return renderDoesNotApply(r)
    case 'unknown':        return renderUnknown(r)
    case 'undetermined':   return renderUndetermined(r)
    default: {
      const unreachable: never = r.status
      throw new Error(`renderRow: unhandled status ${String(unreachable)}`)
    }
  }
}

/**
 * The three peer sections, in order. `DECISIONS.md` §58.4 plus the ordering decision:
 * the ACTIONABLE section sits second, above the one that can only be read.
 */
export const SECTIONS = [
  { key: 'applies',        label: 'What you owe' },
  { key: 'unknown',        label: 'What we need to know' },
  { key: 'does_not_apply', label: "What you don't" },
] as const

/**
 * The section heading. NO COUNT.
 *
 * *** "35 requirements apply to you" ASSERTS A DENOMINATOR WE DO NOT HAVE. *** 35 of what? Of a
 * library where 0 of 200 rows have been checked against a published source and 42 of 95 facts
 * have no determination path — which is precisely what the coverage strip exists to say. A
 * count on the heading quietly contradicts the strip three inches above it.
 *
 * An earlier version returned `${label} (${count})` and argued that a section SIZE is
 * navigation rather than a claim. The argument is reasonable and it loses to a simpler one:
 * **the list underneath is its own count, and a person can see how long it is.** The
 * navigation-weight concern §58.4 raised is solved by the section EXISTING, not by a number on
 * it. `DECISIONS.md` §58.3.
 */
export function sectionLabel(key: (typeof SECTIONS)[number]['key']): string {
  const s = SECTIONS.find((x) => x.key === key)
  if (!s) throw new Error(`sectionLabel: unknown section ${key}`)
  return s.label
}

export function sectionBlurb(key: (typeof SECTIONS)[number]['key']): string {
  switch (key) {
    case 'does_not_apply':
      // The section LABEL already carries the count. Repeating it here was caught by the
      // no-aggregate test on its first run — redundant, and one more place for a number to
      // drift out of step with the list beneath it.
      return `Requirements we can show you are NOT subject to, each with the reason. ` +
             `This is the half of a compliance answer that is usually missing.`
    case 'unknown':
      return `Questions you can answer. Each one settles requirements immediately.`
    case 'applies':
      return `Requirements that reach your business, and what has been shown for each.`
  }
}

/**
 * The coverage strip. `CLAUDE.md` §6.
 *
 * TWO TRUE FACTS, neither of which is the misreading. "33 agencies mapped, none verified"
 * beside 199 machine-evaluable conditions sounds like nothing exists. These do not — and
 * neither overstates.
 *
 * The switch line is 7.2d and it belongs HERE: 42 of 95 facts having no determination path is a
 * property of the PRODUCT, the same class as "none verified". Repeated on each unanswered
 * question it would read as an apology, once per row, for something that is not that row's fault.
 */
export function renderCoverageStrip(x: {
  requirements: number; agencies: number; verified: number
  switchesTotal: number; switchesFromDocuments: number
  /** True when this company has no obligations yet. Suppresses the qualifier. */
  nothingAsserted?: boolean
}): string[] {
  // *** WITH NOTHING ASSERTED THERE IS NOTHING TO QUALIFY. *** "None has been checked against
  // its published source" is a caveat on a claim, and on an empty screen no claim has been
  // made. Showing it there reads as an apology for work that has not been attempted.
  if (x.nothingAsserted) {
    return [`${x.requirements} requirements are loaded, across ${x.agencies} agencies.`]
  }
  const lines = [
    `${x.requirements} requirements are loaded, across ${x.agencies} agencies.`,
    x.verified === 0
      ? `None has been checked against its published source yet.`
      : `${x.verified} have been checked against their published source.`,
    `Of the ${x.switchesTotal} facts this list is decided from, ${x.switchesFromDocuments} can be ` +
      `established from your documents. The other ${x.switchesTotal - x.switchesFromDocuments} ` +
      `need a question or are not yet wired.`,
  ]
  return lines
}

/**
 * The empty state. `CLAUDE.md` §5.1 — an empty state is a claim and it has to be true.
 *
 * *** ZERO OBLIGATIONS MEANS RESOLUTION HAS NOT RUN. IT DOES NOT MEAN NOTHING APPLIES. ***
 * "You're all set" is the omniscient status tracker in its purest form: a compliance position
 * asserted by a screen that has computed nothing.
 */
export function renderEmptyState(): string {
  return 'We have not worked out your requirements yet. This is not a result — nothing has been ' +
         'computed for your business so far.'
}

/**
 * THE EXAMPLE QUESTIONS UNDER THE OPENING BOX — Run 3.
 *
 * *** THIS FILE IS THE OWNER'S TO EDIT. *** It is config, not code: the examples are
 * per-vertical, they change as the product moves from chemical manufacturing to the next
 * vertical, and changing them must never need a developer or a deploy of anything but this file.
 *
 * They are NOT a prompt and they are NOT a switch (`CLAUDE.md` §3.1) — each one is simply typed
 * into the box for the person, exactly as written, when they click it.
 *
 * THREE. The prototype shows three and the line is meant to fit on one row at 820px; a fourth
 * wraps and reads as a menu rather than as a nudge.
 */
export interface ExampleQuestion {
  /** The short words on the button. */
  label: string
  /** What is actually put in the box. Written as a person would type it. */
  question: string
}

export const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  {
    label: 'Second restaurant in Seattle, 25 staff',
    question: "We're opening a second restaurant in Seattle with about 25 staff. What do we need on food handler permits and paid sick leave?",
  },
  {
    label: 'Hospice caregivers driving to patients',
    question: "California hospice agency, 12 caregivers driving to patients' homes. How do mileage and overtime work?",
  },
  {
    label: 'Roofing crew and fall protection',
    question: '40-person roofing contractor in Texas. What do we owe on fall protection and safety training?',
  },
]

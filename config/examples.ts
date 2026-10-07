/**
 * THE EXAMPLE QUESTIONS IN THE OPENING BOX — rewritten for Workspace layout Task 2b.
 *
 * *** THIS FILE IS THE OWNER'S TO EDIT. *** It is config, not code: the examples are
 * per-vertical, they change as the product moves from one vertical to the next, and changing them
 * must never need a developer or a deploy of anything but this file.
 *
 * WHAT THEY ARE NOW: GUIDANCE, NOT BUTTONS. On the first visit, before anything is asked, the three
 * `question`s are shown inside the empty box as grey lines, each prefixed "e.g." — the way the
 * Audits box shows its examples. They go the moment anything is typed.
 *
 *   · They are NOT clickable. Seeing one, or clicking on one, types nothing and sends nothing.
 *   · They are NOT a prompt and NOT a switch (`CLAUDE.md` §3.1) — nothing here reaches a model.
 *
 * THREE. Each is one line in the box and is cut with an ellipsis if it is longer, so a short
 * sentence a person would actually type reads better than a long one.
 *
 * `label` is a short name for each example. The page uses it only as the list key; it is not
 * shown on screen.
 */
export interface ExampleQuestion {
  /** A short name for the example. Not shown; used as the list key. */
  label: string
  /** The sentence shown in the box after "e.g.". Written as a person would type it. */
  question: string
}

export const EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  {
    label: 'Safe storage of acids and solvents',
    question: 'We store acids and solvents at our plant. What do we need for safe storage?',
  },
  {
    label: 'Opening a cannabis dispensary',
    question: "We're opening a cannabis dispensary in Oregon. What licenses do we need?",
  },
  {
    label: 'Hospice nurses and mileage',
    question: "Our hospice nurses drive to patients' homes. How do we pay for mileage?",
  },
]

/**
 * HR'S EXAMPLES — the same shape and the same rules as the workspace's above (HR Step 4, the owner's
 * words). Shown in the HR page's empty box, each prefixed "e.g." by the page; not clickable, not a
 * prompt. `EXAMPLE_QUESTIONS` above is the workspace's and is unchanged.
 */
export const HR_EXAMPLE_QUESTIONS: ExampleQuestion[] = [
  {
    label: 'Sick time for a grandparent',
    question: 'An employee wants sick time to care for her grandmother. Do we allow it?',
  },
  {
    label: 'The last paycheck after quitting',
    question: 'What does our handbook say about the last paycheck when someone quits?',
  },
  {
    label: 'Overtime against state rules',
    question: "Does our overtime policy match our state's rules?",
  },
]

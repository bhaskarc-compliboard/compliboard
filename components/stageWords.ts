/**
 * THE STAGES' WORDS — HR Step 3a. Pure, and in a `.ts` file so `tests/unit/sharedPieces.test.ts` can
 * import them (a `.tsx` file cannot be loaded by the test runner). `components/Stages.tsx` draws them.
 */

/**
 * Each is shown while it is TRUE, driven by the request it names, never by a timer (Workspace Task 4,
 * board 3):
 *   save   the storage upload and POST /api/documents
 *   read   POST /api/document-scan, awaited
 *   check  POST /api/chat, until the first answer text arrives
 *   write  while that text streams
 */
export type Step = 'save' | 'read' | 'check' | 'write'
  // HR Step 6a, additive: the workspace never uses these, so nothing it shows changes. `name` carries
  // the whole "Reading <handbooks>" line, and `count` the number of sources checked so far.
  | 'hr_read' | 'hr_check'

/** The words for each stage, as board 3 has them. */
export const stageWords = (step: Step, name: string, count = 0) =>
  step === 'hr_read' ? name
    : step === 'hr_check' ? `Checking the rule at the agency — ${count} ${count === 1 ? 'source' : 'sources'}`
    : step === 'save' ? 'Saving the file'
    : step === 'read' ? `Reading ${name}`
    : step === 'check' ? 'Checking it against your question'
    : 'Writing the answer'

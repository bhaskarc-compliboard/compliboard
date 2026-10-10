// Refuses a test run that has quietly narrowed itself.
//
// `HOW-WE-BUILD.md` §3: a validator that has only ever said PASS is untested — and a suite
// that has stopped running half its cases still says PASS. A stray `.only` narrows a run to
// one test and reports green; a `.skip` removes a case and reports green with a count nobody
// reads. Neither is a failure anywhere, which is what makes it the harness's own version of
// check 14's weaker-than-its-assertion problem.
//
// Three guards, all cheap:
//   1. no `.only` anywhere in the suite
//   2. zero skipped, zero todo in the run
//   3. the total is not BELOW the recorded floor — a suite may grow, never silently shrink
//
// The floor is committed. Raising it is a deliberate edit; failing to raise it after adding
// tests costs nothing, so the guard cannot become an obstacle.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

// 493 -> 504 on 25 Sep: two for the AI_SCAN_STRUCTURED switch (a near miss like "flase" must
// leave the schema ON, never quietly drop it) and nine for chooseSignificantDate, which took the
// one field the page hangs off away from the model after it dated a 2021 plan "Renewal 1 January
// 2026" — a date that appears nowhere in the document.
//
// 489 -> 493 on 25 Sep: four more in extractJsonText.test.ts for the one failure no extractor
// can fix — an unescaped quote inside a string value — and for the JSON schema that replaced
// the extractor as the mechanism on the scan path.
//
// 473 -> 489 on 25 Sep: tests/unit/extractJsonText.test.ts, 16 tests covering the balanced-brace
// scan. Ten of them are real model responses copied verbatim into tests/fixtures/json-extraction/
// — the five answers Documents Run 2 discarded, the two Run 1 discarded, and three that always
// parsed and must keep coming out byte-identical.
//
// 444 -> 426 on 23 Sep: `lib/answerDisplay.ts` and its 18 tests were DELETED on the owner's
// decision. Run 3's `AnswerBody` replaced it and `grep -rn answerDisplay app lib components`
// returned only the file itself — the suite was exercising code nothing shipped. Lowering the
// floor is exactly the deliberate act this guard exists to force somebody to make in writing.
//
// 509 -> 528 on 26 Sep, post-release: 19 tests for the three things the first production scan found.
// Seven say a refused MODEL CALL is not a file we could not open, and the negative one among them is
// the one that matters — a `TypeError` of our own must NOT be reported to a customer as a refusal by
// Anthropic. Six price `claude-opus-5-5` exactly, and refuse to let it inherit Opus 5's price by
// resembling it. Six cover the schema flattening Opus 5's grammar limit forced: the flat keys, the
// nested keys still reading, and a COUNT of object shapes — because nine was refused, seven is
// accepted, and the next person to add a nested field needs the build to say so rather than
// production.
//
// *** 544 SINCE TASK 0, COMMIT 1: sixteen for the company context's renderer. ***
// Raised deliberately, which is what this constant exists to force. Three of the sixteen are the
// point: a two-site company's declared facts each carry their site, and the BARE form — `Employees
// at this site = 1` beside `= 6`, which is what the gate's block actually rendered before this
// commit — is asserted to appear nowhere. The rest cover parts selection (a caller gets only what
// it asked for, so `sha256` fingerprints the send rather than the store), the declared/confirmed
// distinction, and that an empty section says "not the same as nothing applies" instead of going
// quiet (§5.1 applied to a prompt rather than a screen).
//
// *** 559 SINCE TASK 0, COMMIT 2. *** One more on the company context — the two link ids added for
// the Company information page must render to a byte-identical block, or every stored `prompt_sha256`
// moves for a uuid no model can act on. And fourteen on `questionLines`, which decides what a
// person is ASKED: that three facts from one reading are one question, that a key two documents
// both propose cannot be filed under either, that a disagreement is always lifted out of its
// document group — including the invisible case, where the sources agree with each other and
// contradict something already settled — and that the order is what a question unblocks rather
// than when it arrived.
// *** 1024 SINCE CALENDAR JOB A, A3 (the owner, 9 October 2026). ***
// The floor is now RAISED AT EVERY CHECKPOINT to the count that just ran, by the owner's instruction:
// a floor of 559 under 1024 tests cannot see 450 of them vanish, which is the one thing this number
// exists to notice. 559 -> 1020 at A2 (the day helper's 24 and the date writer's 36) -> 1024 at A3
// (the four that pin the defect A3's replay found: a re-read's "already" must RE-POINT the calendar
// row at the new reading, or withdrawStale takes a live date off the month) -> 1031 at A3b (the seven
// on the calendar step itself: a reading that COULD NOT READ the document must never withdraw a date,
// and a reading that read it and found none still must) -> 1034 at A3c (the three on migration 075's
// code path: the report reads the current-dates view and never document_deadlines, the writer reads
// the same view, and the grey line about an earlier reading is drawn only when the route sets it)
// -> 1035 at A4 (an AUDIT date re-points at the newer run's finding: the key is the DOCUMENT, so a
// re-run got "already" and the row kept the first run's finding id — found by A4's own screenshot,
// which showed "Add to calendar" on a date that was already there) -> 1038 at A3d (the three on
// migration 076's screens: the Documents row and the report drawer each say which reading their
// title, agency and dates came from, and the audit's agency filter is the column 076 keeps alive)
// -> 1044 at A3e (the sweep, pinned by file: every reader of a document's CONTENT takes the readable
// reading, the ONE watcher keeps the current scan or the drawer spins for ever, HR's handbooks are a
// different table and were not touched, and the helper refuses to read an error as "never read")
// -> 1046 at A3e's addition (the label prune, which DELETES, and the audit's "found wrong with it:
// nothing", which is a statement in a prompt rather than an absence) -> 1066 at A5 (the monthly
// email: board 12's words and order, the opt-out line held back until My Account has the switch,
// one sender for all four emails, and R2/R3 — a read that fails sends NOTHING, never an email
// saying "nothing is due this month") -> 1071 at A5b (board 12's words as the owner approved them,
// and the rule that NOTHING says "overdue" or "not done" about a date — all we know is the day has
// gone by, because people record what they did in their own calendar and not in ours, §185c)
// -> 1072 at A6 (a day outside the current year shows its year: a passed date can sit unticked for
// a year, and a bare "20 August" then points at the wrong one).
const FLOOR = 1097

const files = readdirSync('tests/unit').filter((f) => f.endsWith('.test.ts'))
const only = files.filter((f) => /\b(test|describe|it)\.only\b/.test(readFileSync(`tests/unit/${f}`, 'utf8')))
if (only.length) {
  console.error(`\n  test-guard: .only found in ${only.join(', ')} — the suite would report green having run almost nothing.\n`)
  process.exit(1)
}

let out = ''
try {
  out = execFileSync('node', ['--test', 'tests/unit/*.test.ts'], { encoding: 'utf8' })
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
process.stdout.write(out)

const n = (k) => Number((out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')) ?? [])[1] ?? 0)
const problems = []
if (n('skipped')) problems.push(`${n('skipped')} skipped`)
if (n('todo')) problems.push(`${n('todo')} todo`)
if (n('tests') < FLOOR) problems.push(`${n('tests')} tests, below the recorded floor of ${FLOOR}`)

if (problems.length) {
  console.error(`\n  test-guard: ${problems.join(' · ')}\n` +
    `  A suite may grow. It may not silently shrink.\n`)
  process.exit(1)
}
console.log(`  test-guard: ${n('tests')} tests, 0 skipped, 0 todo, floor ${FLOOR}. OK`)

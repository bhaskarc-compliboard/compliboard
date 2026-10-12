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
// 1336 -> 1339 after Job E, for the forty files the job itself committed by accident:
// `lib/auditRun 5.ts` beside `lib/auditRun.ts`, and thirty-nine more, made by the stash-and-restore
// cycles that proved each failure on the old code. Nothing imported them, Next did not route them,
// and nothing went red — but seven were STALE copies of pre-fix code, and the three tests that walk
// `app/`, `components/` and `lib/` with readdirSync were sweeping them as if they shipped. Caught by
// hand once mid-job (71963a9, two files) and missed in the three commits after it, which is why it
// is now a check: tests/unit/noStrayCopies.test.ts, proved against a planted copy.
//
// 1339 -> 1357 at E10's first checkpoint, for the three items of the independent read that break the
// NORMAL path and were proved failing first: N1, one clock for "how far the summary read" and "when
// the last turn was" (`oneClock.test.ts`, six cases built from real staging timestamps — three of
// them failed on the shipped code); N4, a note on an audit run is not "the audit could not be done"
// (`noteIsNotAnEmptyState.test.ts`, which also corrects two assertions in `auditWords.test.ts` that
// pinned the defect); and N8, the copyright line that was deleted from every page on screen
// (`footerCopyright.test.ts`).
//
// 1357 -> 1378 at E10's second checkpoint, N5 and N6: one version of a handbook answers a question
// and is checked. `oneVersionPerChain.test.ts` (18) holds the two rules — a successful read retires
// every OLDER version in its chain, not only its parent, and whatever is current, one version per
// chain is used, the newest that can be used — through all three ways a chain forks (A, B, C) and
// through the window where a version is half-extracted. `handbookRead.test.ts` gains three (the
// retire step walking the chain, a failed chain read leaving the reading intact, and the plain
// two-version case unchanged).
//
// 1378 -> 1401 at E10's third checkpoint, N7 and the owner's decision D2: a big drop in the
// requirements waits for a person. `obligationHold.test.ts` (21) holds the internal threshold at its
// edges — all of the open list, or MORE than half, so one of two never asks — and every customer
// sentence the owner wrote, including that none of them leaks the rule and that the false "Nothing
// has been changed" is gone. `obligationWriterReads.test.ts` keeps all of W1's guarantees and turns
// the throw into a hold: nothing reconciled, nothing stamped, and a person's confirmation recording
// who asked.
//
// 1401 -> 1422 at E10's fourth checkpoint, N2, N3 and the owner's decision D1: the system never
// closes a finding because the newer audit went quiet. `auditAgain.test.ts` (21) holds all four
// parts — plain facts first on the SAVED kind, a wrong-kind link ignored and counted, "Now on file"
// as the only close an audit makes, the group a person closes and can REOPEN, and the three counts
// that are never added together. `auditMatcher.test.ts` keeps every one of A1's four faults and has
// four assertions rewritten where D1 supersedes them, each with the reason in place.
//
// 1422 -> 1444 at E10's fifth checkpoint, the owner's decision D3 and S12: long answers.
// `longAnswers.test.ts` (22) holds `pause_turn` continuing up to three times as ONE answer with one
// ledger row, the 32,000 ceiling for the two answers that get it and nothing else moving, the
// conversation an incomplete first answer keeps, the handbook check splitting a piece instead of
// repeating it and then WAITING rather than re-queuing nightly, `stop_reason` on every row with no
// default, S12's put-back matching a row the claim never reached — and, read from 80 stored golden
// calls with no paid run, that nothing comes near 32,000 while the AUDIT task reaches its own
// 16,000 on Opus in five of nine runs, which is reported to the owner rather than changed.
//
// 1444 -> 1468 at E10's sixth checkpoint: **R7**, a loud failure with no way back, across all three
// sweeps and both pages (items S1-S15 of the independent read). `sweepRecovery.test.ts` (23) is the
// test the rule itself demands — "a test per sweep injects a failure and shows the next run
// recovering" — because what made this class invisible is that nobody had ever made one of those
// reads fail. It drives the handbook sweep through a real statement timeout and asserts the run
// survives it; and it pins, per item, every claim being freed, every sweep catching per company,
// every state a throw leaves behind having a rule that moves it on, and both pages showing their
// failure line instead of an empty state.
const FLOOR = 1468

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

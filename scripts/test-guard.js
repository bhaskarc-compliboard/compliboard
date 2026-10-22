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
// *** 559 -> 1634 ON 22 OCTOBER 2026, MY ACCOUNT STEP 12. ***
//
// The floor had not been raised since Task 0, and the suite has roughly tripled since: the
// Calendar, HR, the Dashboard and My Account all added tests and none of them moved this number,
// because failing to raise it "costs nothing" and so nobody did. That is true of one step and
// false of twenty — a guard set at a third of the real count would have let two thirds of the
// suite be deleted and still said OK, which is precisely the silent shrinking it exists to catch.
//
// 1634 is what `npm test` reported on the day, with 0 skipped, 0 todo and 0 failing, including
// step 12's 47 new tests in tests/unit/signup.test.ts (describes counted as tests, as node reports them). Raising it is the deliberate edit the
// guard's header asks for; lowering it ever again is the same deliberate act in the other
// direction, and it goes in writing here with its reason, as the 444 -> 426 note above does.
// 1634 -> 1669 on 22 October 2026, My Account step 13: 34 in tests/unit/websiteRead.test.ts and
// one in costLedger.test.ts. More than half of the 34 are the SSRF guard — which IP literals and
// which address ranges the website read refuses to fetch — because `DECISIONS.md` §45 says a
// compensating control must be named and tested or it is a belief, and `docs/TODO.md:1075` is the
// assessment that named this one.
// 1669 -> 1715 on 22 October 2026, My Account step 14: 46 in tests/unit/walk.test.ts — the words
// against board 7, the screen the person is on, and the one that matters most, that "Yes, that's
// us" saves THE FIELDS rather than the proposal. `planSaves` returns the steps as a value for
// exactly that reason: an order you can read is an order a test can check.
// 1715 -> 1742 on 22 October 2026, My Account step 15: 27 in tests/unit/websiteCompare.test.ts.
// The one they exist for is the money line — `config/pricing.ts` prices a model it does not list
// as NULL on purpose, and `claude-sonnet-5-5` is not in that table, so the owner's comparison has
// to SAY it could not price the call rather than print $0.0000 beside a real bill.
// 1742 -> 1746 on 22 October 2026: four for Sonnet 5.5's price, read off the published page the
// same day. Its row was added because `npm run website:compare` runs it against Opus 5.5 and an
// unlisted model prices as null — tokens with no money beside a real bill.
// 1746 -> 1763 on 22 October 2026, My Account step 15's two findings from the owner's own walk:
// the sentence shown whole, the standard category in words, and — the one that matters — exactly
// three questions however they are answered. The walk had copied the Dashboard's rule, where a
// skip deliberately does not count, into a screen with three slots.
const FLOOR = 1763

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

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
// *** 1763 -> 1803 on 23 October 2026, My Account step 17 (Stripe): 26 in billing.test.ts and 14 in
// stripeWebhook.test.ts. *** The ones they exist for are the places this would have gone wrong
// quietly rather than loudly:
//   - trialEndFor's MIDDLE case. Stripe refuses a Checkout `trial_end` under 48 hours out ("The
//     `trial_end` date has to be at least 2 days in the future", said by Stripe itself at the step
//     17 sandbox run), so a person adding a card on day 13 of 14 gets a 400 and cannot add a card
//     AT ALL — at the moment they most want to. Three tests pin the floor and one pins the reason
//     it is a floor and not an omission: omitting `trial_end` there would charge them on day 13.
//   - accessFor on `past_due` versus `unpaid` with no `payment_failed_at`. The two differ in one
//     fact and they are the opposite verdicts, and the fact is Stripe's: past_due is still being
//     retried, unpaid is "no subsequent invoices will be attempted". Being kind to the second
//     would be full access for ever to a company Stripe has given up collecting from.
//   - every status word reaching a branch, and a NINTH word Stripe has not invented yet being
//     refused BY NAME. Migration 087 keeps the column `text` and not an ENUM so such a value can
//     be recorded; these say it must also be safe.
//   - the three Stripe fields that are not where an older memory of that API puts them: the invoice
//     has no top-level `subscription`, the subscription has no top-level `current_period_end`, and
//     an unexpanded payment method is an id string. Each would have stored nothing, for ever, with
//     nothing failing.
// *** 1803 -> 1892 on 23 October 2026, My Account step 18 (the read-only state): 51 in
// accessGate.test.ts, 18 more in billing.test.ts, 20 in readOnlyUi.test.ts. *** The ones they
// exist for:
//   - THE FOUR SWEEPS, RUN FOR REAL, two companies at a time. Three of the four had never been
//     executed by any test: their sweep reached a module-scope client, and a route file could not
//     be imported by `node --test` at all. Both are fixed (`sweep(admin = supabaseAdmin)` and
//     tests/unit/resolveNextServer.mjs), and the assertion is a DEEP-EQUAL on the read-only
//     company's row before and after — because decision 11 promises nothing is failed, marked or
//     deleted, and only comparing the state can show that. The first run of these found a real
//     bug: `audit-sections` still passed `supabaseAdmin` to `runSection`, so the injected client
//     did not reach the work.
//   - scan-documents' STALL. Its read-only fixture is deliberately the OLDEST document. With the
//     old `limit(1)` pick plus a `continue`, that test hangs until BUDGET_MS while every paying
//     company starves; if it ever hangs again, that is why.
//   - the grace, which is the case the whole design turns on: `accessFor` returns **full** during
//     decision 11's seven days, so the banner has to render while access is still full, and the
//     controls must NOT be disabled. Two functions (`bannerFromRow`, `pausedFromRow`) exist only
//     to keep those apart, and a test asserts each takes the opposite view of the same row.
//   - "0 more days" never reaching a person: `graceDaysLeft` is honest arithmetic and hits 0 (and
//     goes negative), and `bannerFor` clamps to 1 with the singular handled.
//   - the §9a control on `splitByAccess`: that it can return a NON-EMPTY allowed list. A splitter
//     which skipped everything would satisfy almost every other assertion in that file.
//   - DECISION 14, as a snapshot: NAV_ITEMS and SidebarContent are pinned by length AND content
//     hash. "Nothing else in the layout changed" is the promise step 18 made; this is what makes
//     breaking it fail the build. Editing the sidebar later is a deliberate edit of two constants.
// *** 1892 -> 1939 on 23 October 2026, My Account step 19 (the Billing tab): 47 in
// billingView.test.ts. *** The ones they exist for:
//   - EVERY status reaching a named pill, including a ninth word Stripe has not invented yet and
//     an `active` subscription whose first `current_period_end` has not landed. Both are states
//     nobody can produce by hand, and both would otherwise render a blank line where a customer
//     expects to be told what they are paying.
//   - the grace saying a NUMBER and never zero, and never saying anything has stopped: access is
//     still FULL for decision 11's seven days, so a tab that read "Read-only" there would
//     contradict the gate and take back days the product promised in writing.
//   - `daysUntil` counting CALENDAR days. `ceil(elapsed / 24h)` reads as equivalent and returns 9
//     on BOTH the 21st and the 22nd for a trial ending at noon on the 30th, and it made the
//     "Ends today" branch unreachable dead code that looked as though it worked. Found by writing
//     the test, not by reading the function.
//   - `payment_method_collection: 'if_required'` asserted on the real session object rather than
//     grepped out of the route — a source-text match passes on a commented-out line. It is also
//     pinned ON A TRIALLING SESSION, where a card IS still collected: if that were ever inverted,
//     nobody on a trial would give us a card and every one of them would lapse on day 15.
// *** 1939 -> 1943 on 24 October 2026, My Account step 20 (the fix the owner's walk forced). ***
// Small in count, and the most expensive four tests in the file to have been missing:
//   - `payment_method_collection` is `always` for BOTH trial cases and `if_required` only when
//     there is no trial, with a guard that FAILS NAMING THE CONSEQUENCE if the two are swapped
//     ("every trial customer will lapse on day 15 having pressed Add a card and been told it
//     worked"). Step 19's test asserted the parameter was CARRIED on a trialling session; it was,
//     the test passed, and the value it carried was the wrong one. A test that asserts a value is
//     not a test that the value is correct — `DECISIONS.md` §217 A, `TESTING.md`.
//   - the card-line fallback's input. `cardLineFrom` was always right; the PORT handed it an id
//     string, because expanding `customer` does not expand the payment method on it. The shallow
//     expand is now asserted absent, because its return would kill the fallback again silently.
// *** 1943 -> 1944 on 24 October 2026, My Account step 20, second finding from the walk. ***
// One test, and it is the middle of three states nobody had thought to separate: a company with a
// Stripe CUSTOMER but no SUBSCRIPTION. A customer exists the moment checkout is OPENED, so an
// abandoned session put a person there permanently — and the old rule sent them to the portal,
// where a card can be attached that no webhook reports and nothing will ever charge. Its message
// names that: "a company with no subscription is being sent to the portal: it can add a card
// there that nothing will charge and no webhook reports, and it can never actually subscribe."
// `DECISIONS.md` §218.
// *** 1944 -> 1959 on 24 October 2026, My Account step 20, third finding from the walk. ***
// The five states of a scheduled cancellation, the webhook mapping BOTH ways, and the Cancel tab's
// three wordings. The ones they exist for:
//   - CLEARING. `cancel_at` is written even when null, which is the opposite of the card rule
//     beside it: a card line is only ever added (a shape we failed to read must not erase a real
//     card), but a cancellation's ABSENCE is a fact Stripe is telling us, and it is the only way
//     "Don't cancel subscription" reaches the page. A conditional write would leave somebody who
//     changed their mind reading "Cancels on 7 November" for ever.
//   - that the STATUS does not move. Stripe keeps `trialing` while a cancellation is scheduled, so
//     a page reading only the status cannot tell a cancelling company from a happy one — which is
//     how it came to tell a cancelled customer with a card on file to add a card.
//   - and `receiveStripeEvent` itself, driven for the first time with a stub port and a fake
//     database. Before this the webhook's MAPPING had no test at all; only its pure helpers did.
//
// 1959 -> 2000, 27 October 2026 (My Account step 20, the reconcile — `DECISIONS.md` §220).
// 40 of the 41 are `tests/unit/stripeReconcile.test.ts`, three of them added after the staging run
// found two defects no test had asked about: a self-cancelling effect cleanup that hung the page on
// "Finishing up…" for ever, and a soft reload that left the read-only band above a repaired tab. Three of them are the ones to keep:
//   - THE RACE, run as a race. The stub port writes what a webhook would have written in between
//     the reconcile's read of the row and its own update, which is the actual sequence the
//     `.is('stripe_subscription_id', null)` guard exists for. Asserting that the guard is spelled
//     correctly would not have proved it.
//   - THE ABSENCE. A customer with no subscription at Stripe (somebody who abandoned Checkout)
//     leaves the mirror byte-for-byte as it was, compared as a whole row rather than column by
//     column, so a future patch cannot quietly add a write on that path.
//   - ONE MAPPING. What the reconcile wrote is compared with `columnsFromFacts(facts)` — the
//     webhook's own function — so a second copy of the Stripe->us mapping fails the build.
//
// 2000 -> 2040, 27 October 2026 (My Account step 20, what this company pays — migration 090,
// `DECISIONS.md` §221). The owner's coupon walk: FOUNDER100 (100% off, forever) produced a live
// subscription and the Billing tab said "$199 a month, charged to the card below" beside "No card
// yet · Add a card". Three false statements about money in one card. Of the 40:
//   - FIVE SUITES, one per state the brief names — no discount, 100% forever, a partial discount, a
//     discount with an end, and the card-nagging suppression. Each asserts the SENTENCE, because
//     the sentence is what was wrong; asserting the column would have passed all along.
//   - `once` IS NOT `forever`, and only `coupon.duration` knows. Stripe leaves `discount.end` null
//     for both, so a page keying on the date would show a one-off discount as permanent and never
//     ask for a card. §217's "forever coupons only" is the rule; this is the net under it.
//   - A DISCOUNT HAS NO TOP-LEVEL `coupon`, and `expand: ['discounts']` leaves `source.coupon` an id
//     string. Both read off the live FOUNDER100 subscription, both silent failures if wrong — the
//     company would simply be told it owes the list price. §217 D's defect in a new place.
//   - THE LIST PRICE IS NOT A FALLBACK for an amount we did not read, which is the finding in one
//     assertion. It also caught an old fixture in this very suite that asserted "charged to the card
//     below" for a company with no card.
//
// 2040 -> 2063, 27 October 2026 (My Account step 20, the stale mirror — `DECISIONS.md` §222).
// §220's reconcile only ever filled a BLANK mirror, so a missed `invoice.paid` on a subscription we
// already knew about left a paying customer at `past_due` with the grace counting down to a
// lock-out. Of the 23, four are worth knowing about:
//   - EACH QUALIFYING STATE TRIGGERS AND EACH SETTLED ONE DOES NOT, one test per status, plus the
//     §9a control that `reconcileNeeded` can return null for five real rows AND each of its four
//     reasons for four others. A rule that answered "check" to everything would pass most of this
//     file and put a Stripe call on every Billing-tab load in the product.
//   - THE RACE ON AN EXISTING SUBSCRIPTION, which `.is(null)` could not guard at all — driven by a
//     stub port that writes what `invoice.paid` would write in between our read and our update.
//     *** It passed while the guard did nothing: `fakeSupabase` hands back the LIVE row, so the
//     comparison read the mutated value. The snapshot in `reconcileFromStripe` is the fix. ***
//   - `past_due` -> `active` CLEARS THE ANCHOR EXACTLY AS THE WEBHOOK WOULD, asserted by running
//     both paths on two databases and comparing the rows column for column.
//   - THE RECORD NAMES THE STATE THAT EARNED THE QUESTION. It did not at first: the route asked
//     `reconcileNeeded` again afterwards, and a repair settles the row, so every record said "the
//     mirror looked wrong". Found by reading a row the staging run had written.
// 2063 -> 2073, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 1, each chat section its own).
//   Ten: four in tests/unit/askEngine.test.ts for `sectionRuns` — every section's tier, ledger word
//   and search cap, and that a section with no chat THROWS rather than quietly billing HR; three
//   more rows in tests/unit/topicList.test.ts's loop, which read `['workspace', 'hr']` and so had
//   never tested the read for `calendar`, live since 19 October; and two new ones there that nothing
//   had before — `TOPIC_SECTIONS` against the CHECK constraint that polices it (`costLedger.test.ts`
//   has had that pairing since `document_scan`; `topics.section` never did), and the night job
//   reading that one list instead of its own copy, which had been missing `calendar` all along.
// 2073 -> 2090, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 2, the shared chat screen).
//   Seventeen, all in tests/unit/askScreen.test.ts: that no HR word reached the two lifted files
//   by import OR by copy (with one named exception, a Delete title two sections should agree on),
//   that the action row is the owner's three in the owner's order with the first gated off until
//   step 5, that the attach slot draws a link, that the drawer's Delete calls the route that
//   already existed and says true things about what survives a delete (checked against migration
//   062, not against a comment), and the two rules the lift is only safe because of — types only
//   from lib/ask, and the shared screen knowing nothing about dates.
// 2090 -> 2100, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 3, the attached file).
//   Ten in tests/unit/askEngine.test.ts, all on the two pure pieces the engine owns: the ORDER the
//   blocks go into the message (this turn's file, then the earlier ones, then the words), the cap
//   sentence, the "could not be read back" sentence, what the context event says about a block it
//   deliberately does not price, that the turn remembers the file and the document remembers the
//   conversation, and that the brief did not gain a sixth field for any of it.
//   `lib/attachedDocument.ts` is NOT re-tested here: it has its own file and the engine calls it.
// 2100 -> 2120, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 3, the upload in the chat).
//   Twenty: seven in tests/unit/askScreen.test.ts (the picker branch, one file and never a folder,
//   the chip and its x, the Workspace's own default question for a file with no words, the id on
//   the request, and the read-only case where the upload still works and the screen says so), and
//   thirteen in the new tests/unit/chatUpload.test.ts at the fetch seam — the three calls in
//   order, the company-prefixed unfiled path, from_topic_id only with a topic, every failure a
//   sentence and never a throw, and the one that matters most: the reading is ASKED FOR and NOT
//   WAITED ON, proved by the upload returning before the request is even made.
// 2120 -> 2121, 2 November 2026 (step 3's own defect, found on staging).
//   One: check_record must carry the SAME block list the context event carried. The event named
//   the attached file and the record did not, because the record re-derived its list from
//   packed.blocks, which an attachment is not one of. An answer that read a document its own
//   record does not mention is the single failure that record exists to prevent, and it was found
//   by reading the stored row rather than the code.
// 2121 -> 2135, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 4a, the shared reading packer).
//   Fourteen in tests/unit/readings.test.ts, on the three rules the packer carries and each of
//   which a real run paid for: what is left out is NAMED, every item SHOWN gets a passage even
//   when there is nothing in it to quote, and the cap is asked BEFORE an item is added. Plus the
//   two that hold the Calendar to what it always did - it calls the shared packer, and a document
//   deleted since its date was filed no longer leaves a hole in the ids.
const FLOOR = 2135

const files = readdirSync('tests/unit').filter((f) => f.endsWith('.test.ts'))
const only = files.filter((f) => /\b(test|describe|it)\.only\b/.test(readFileSync(`tests/unit/${f}`, 'utf8')))
if (only.length) {
  console.error(`\n  test-guard: .only found in ${only.join(', ')} — the suite would report green having run almost nothing.\n`)
  process.exit(1)
}

let out = ''
try {
  // `--import` loads tests/unit/resolveNextServer.mjs, which teaches plain Node two things the
  // bundler already knows: the bare specifier `next/server`, and the `@/` path alias. Without it
  // no route file can be imported by a test at all — which is why three of the four cron sweeps
  // had never been executed by one before My Account step 18.
  out = execFileSync('node', ['--import', './tests/unit/resolveNextServer.mjs', '--test', 'tests/unit/*.test.ts'], { encoding: 'utf8' })
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

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
// 2135 -> 2160, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 4a, the Documents brief).
//   Twenty-five in tests/unit/documentsBrief.test.ts, at the database seam so the whole packer
//   runs with no database and no model. The one that matters most is THE INDEX IS WHOLE: a chat
//   shown half a company's documents would say "you do not hold that" about a document sitting in
//   the list, which is CLAUDE.md 5.1's worked example happening in a new place. Plus: a failed
//   read throws rather than looking like an empty company; what is cut is the least important
//   status and it is SAID; extracted_text is in no block and is not even asked for; and the
//   naming rule matches title, file name, kind, agency and subject and nothing else.
// 2160 -> 2170, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 4a-test, the quote fix).
//   Ten. Nine in tests/unit/askEngine.test.ts on decision 22a: an attached file's own text is now
//   a passage, so a quote taken out of the PDF stops being marked "we could not find these words
//   in what we have on file" (photographed at shots/step3-bubble.png). The one that earns its
//   place most is the OPPOSITE case - a file with no text still marks the quote, which is what
//   proves these tests can see the defect at all rather than passing on a change that did
//   nothing. Plus: A is the engine's letter and no brief may take it, every carried file gets a
//   named handle even with nothing in it to quote, the files with no text are named in the
//   message, and a section that attaches nothing sends byte-for-byte what it always sent.
//   One in tests/unit/documentsBrief.test.ts: the three honesty sentences the Calendar's real
//   runs bought, now this section's too - eight sentences became eleven.
// 2170 -> 2177, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 4b, the prompt and the index line).
//   Seven in tests/unit/documentsBrief.test.ts. Five are the quotable index line, and the one that
//   earns its place is THE DEFECT, PROVED BY RUNNING THE NORMALISER: an index line is one
//   self-closing tag, normalisedWithMap skips everything between < and >, so all twelve of
//   Cascade's I passages normalised to the empty string and a quoted title could never match one.
//   Six of 36 measured runs therefore told a person we could not find the title of a document in
//   their own list. Plus the half that can break quietly - the block the MODEL is sent is still the
//   tagged line, byte for byte, and the plain copy must never reach the message. Two more hold the
//   two sentences 4b measured into existence (a name is not a quote; no offer without a button).
// 2177 -> 2212, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 4b, Documents gets the chat).
//   Thirty-five in the new tests/unit/documentsPage.test.ts, all on source text because Node
//   cannot import a .tsx - the Calendar's way, and exactly as strong as what it asserts: it can
//   prove the tab row, the derivation and the relation list; it cannot prove a click, and that is
//   checkpoint 5's walk. The ones that earn their place are the three that would fail SILENTLY:
//   the report drawer must stay OUTSIDE the tab bodies or a ?document= link opens nothing; the two
//   hidden file inputs must stay outside them or the chat's uploader and the toolbar's Add files
//   both point at an unmounted ref and the picker quietly does nothing; and the tab count must be
//   hidden while the read is in flight, not only at zero, or the page states a fact it has not
//   checked. Plus: the page's reads are still its own two and topic_list_v only through the shared
//   reader, no HR word reached it, and the chat's sentences are in lib/documentsWords.ts rather
//   than typed into the page - which the brief reads too, so screen and model cannot disagree.
// 2212 -> 2234, 2 November 2026 (`docs/GAPS-PLAN.md` Part A step 5, the checklist from any chat).
//   Twenty-two. Twelve in tests/unit/askScreen.test.ts on decision 8: the press, the claim word
//   (the SHARED one, not a second copy), the Workspace's own 202-or-409-building rule read and
//   copied rather than written again, a new checklist told apart from one the conversation already
//   had, and ONE poll watching both the summary and the checklist rather than a second interval.
//   The one that earns its place is the quiet failure: a build whose claim clears with nothing new
//   must SAY so, or "Checklist being built…" sits on the screen for ever (5.1, never silent).
//   One more holds the route section-blind, because decision 8 rests on that and nothing else.
//   Ten in the new tests/unit/conversationList.test.ts, the one shared piece this step changed.
//   FOUR pages render that row and three are on the forbidden list, so each rule there is a rule
//   about three sections at once: the link goes through the one shared address, a build still
//   shows the claim word and is NOT a link, the click does not also open the conversation, and the
//   wrapper that had to stop being a <button> kept everything a button gave - role, tabIndex,
//   Enter and Space with Space preventDefaulted so it does not scroll instead.
// 2234 -> 2273, 3 November 2026 (`docs/GAPS-PLAN.md` Part A step 6a, the Audits brief measured).
//   Thirty-nine, all in the new tests/unit/auditsBrief.test.ts, at the database seam: a stand-in
//   client answers every read the packer makes, so the whole thing runs with no database, no model
//   and no network. Three of them earn their place and the rest hold the shape.
//   ONE: an `expected` row is a SUGGESTION, not a finding. Nine of Cascade's 34 open rows are
//   suggestions carrying the word nothing_on_file, and packed bare they read as nine more things
//   the company failed to file - the packer making the upgrade the prompt forbids the model from
//   making. Found by reading the packed block back, not by thinking about it.
//   TWO: a run line normalises to the EMPTY STRING, because normalisedWithMap skips everything
//   between < and >, so without runPlain no quote of it could ever match and a person would be
//   told we cannot find words that are in front of them. Documents paid for that lesson at
//   4a-test, six of 36 runs; this is the same shape, so the test runs the normaliser rather than
//   trusting that somebody remembered.
//   THREE: the one offer is checked against the company's OWN agency labels, in code. The model
//   proposes and never decides: an agency this company does not hold, or a file the person did not
//   attach on this turn, is dropped before the card is drawn.
//   And one that is a tripwire rather than a test: `offers` is [] and lib/ask/offers.ts must not
//   know the word run_audit, because step 6a may not edit that shared file. The day 6b adds it,
//   this test is what makes somebody set auditsBrief.offers in the same commit.
// 2273 -> 2318, 3 November 2026 (`docs/GAPS-PLAN.md` Part A step 6b, Audits gets the chat).
//   Forty-five. Thirty-two in the new tests/unit/auditsPage.test.ts and six in askScreen's, and
//   the rest are three shared files re-pointed deliberately.
//   THE LOOKER IS WHY MOST OF THEM EXIST. It decides, in code and with no model call, whether a
//   sentence starts an audit or gets answered - which is the product's first rule in one function
//   (CLAUDE.md section 1: what's missing is a database query and never an AI guess). The two
//   cases that earn their place are the two that must NOT start a run: "Do we have all our
//   permits?" contains "all", and "Are we ready for an Oregon OSHA inspection?" contains an
//   agency label, and the old box would have audited on both. The audit word comes first now
//   (decision 38) and a test holds each.
//   AND A GREP, BECAUSE A DELETED CONTROL COMES BACK BY ACCIDENT: submitAsk, attachChecklist,
//   runningTemplate, landedTemplate, seenTemplate and the dead /compliance link are gone, and one
//   POST starts an agency run rather than two.
//   The merged tab: an earlier run appears under its agency (read off the SECTIONS, because an
//   "all agencies" run carries every label in one string), a template run has a row of its own,
//   and every line Past audits carried - the closed count, the person's scope, the amber
//   did-not-finish - came with it rather than being lost in the fold.
//   The offer press: checked against the company's OWN labels before any POST, resolved to the
//   file the PAGE holds rather than any id the model wrote, and marked before the call so it
//   cannot be pressed twice.
//   Three re-pointed on purpose. askEngine: the attached-file handle is AF and not A, because an
//   auditor's checklist numbers its own lines A1..A5 and the person was reading "line
//   12-auditor-checklist-deq-air.docx" - measured in three runs of three, in the Documents brief
//   as well as the Audits one. auditDrawer: three tabs, with the 20 October hotfix's five rules
//   kept word for word and a sixth added for the derived tab. documentsBrief: the same handle.
//   AND TEN MORE, 3 November 2026, after the walk: a QUESTION about an audit was starting one.
//   "What did the last Oregon DEQ audit find about the scrubber log?" has the audit word AND an
//   agency label, and the looker read it as a command - the harness refused the paid route and
//   that is the only reason it was seen. Decision 38's rule is necessary and not sufficient, so
//   a command is now an imperative: a question mark or a leading question word makes it a
//   question. Seven sentences are held to going to the model, four imperatives to still starting
//   a run, and the two signals are tested on their own.
//
// 2328 -> 2336, 3 November 2026 (GAPS-PLAN Part B step B0, decision 46). EIGHT MORE, and both
//   halves cost money while they were open. Five on lib/documentScan.ts: doc_date_kind was the
//   one identity word sent to the database unchecked, so a sixth word made the INSERT throw and
//   the whole paid reading was lost - three documents, two companies, one evening, and the row
//   that landed said the model had never been called about a call that had just cost $0.114168.
//   An unrecognised word is now 'unknown', said out loud, with the word itself still in raw_text.
//   Three on components/AskScreen.tsx: the screen is busy from the moment a section is asked to
//   look at the sentence, because it was not, and the owner pressed Ask twice during the six
//   seconds POST /api/audit-runs spends extracting a checklist and bought two identical audits.
//
// 2336 -> 2365, 3 November 2026 (GAPS-PLAN Part B step B1, decision 51). TWENTY-NINE MORE, all in
//   tests/unit/fileTypes.test.ts, and the first four are the ones that matter in six months: the
//   accepted list in lib/acceptedFiles.ts and the branches in lib/documentContent.ts are read out
//   of BOTH FILES and compared, so neither can grow or lose a type without the other. That exact
//   drift is what B1 closed - the picker offered .doc, .ppt and (through image/*) HEIC, TIFF and
//   BMP; the reader CLAIMED .doc and .ppt and handed them to parsers that read the modern formats
//   only; so the polite sentence written for an unreadable file was unreachable and a customer who
//   uploaded a 1998 Word file was told "Something went wrong at our end". The rest hold the
//   sentences themselves (one per refused type, on a real fixture, through runDocumentScan), the
//   different sentence an ACCEPTED type gets when it will not open, the folder path's skipped line
//   by type, and that all four pickers plus the chat's own chokepoint read the one constant. The
//   drift guard is shown to fail on a doctored copy of the reader.
// 2365 -> 2385, 3 November 2026 (GAPS-PLAN Part B step B2, decisions 52 and 53). TWENTY-ONE in
//   tests/unit/imageConvert.test.ts and one fewer in fileTypes.test.ts, where nine assertions were
//   EDITED rather than added to: B1 refused .heic, .tif/.tiff and .bmp politely and nine tests held
//   it to that; B2 reads all five by converting each to a JPEG inside Vercel, so those assertions
//   described a product that no longer exists. None was deleted - .doc and .ppt are still held to
//   the same rule, and what moved is which types we cannot read.
//
//   The new ones run real decoders on real files, because the three things that go wrong here are
//   all invisible to a stand-in: a decoder that is not built in (sharp's prebuilt libvips cannot
//   decode a HEIC at all and cannot read a BMP), a channel order that is backwards (bmp-ts returns
//   ARGB and a photograph read as RGBA is perfectly legible and blue), and a page silently dropped
//   from a multi-page TIFF. The ceiling is held too: an 81-megapixel image is refused FROM ITS
//   HEADER in under half a second, because heic-decode allocates width*height*4 with no scaled
//   decode and a 48-megapixel photograph measured 1,036 MB of peak memory.
//
// 2385 -> 2395, 3 November 2026 (B2's second half). TEN more, all about the converted copy being
//   STORED rather than computed and dropped. The one that matters in a year is the first: the key
//   is `<company>/converted/<document>.jpg` and the test counts the slashes, because account
//   delete walks `<company>/` and exactly ONE folder down and a file at a third level would
//   survive a deletion a customer asked for. The rest: a re-read overwrites its own copy rather
//   than leaving the old one behind (no timestamp in the key, upsert on the upload); a storage
//   refusal leaves converted_url NULL and never fails the reading that has already been paid for;
//   the copy rides all THREE of runDocumentScan's post-parse returns, including the one where the
//   API refused the request, because the conversion happened either way; saveScan stores it after
//   the status so a slow upload cannot leave a row saying "Reading…"; and "Open the file" hands
//   over the copy when there is one, because a HEIC downloads and shows nothing on Windows.
//
// 2395 -> 2414, 3 November 2026 (GAPS-PLAN Part B step B4, decision 54). NINETEEN in
//   tests/unit/officeFormats.test.ts, and NOT ONE of them needed a new dependency. officeparser
//   has been installed since the PowerPoint branch was written and its own refusal sentence names
//   everything it reads - docx, pptx, xlsx, odt, odp, ods, pdf, rtf, md, html, csv - so six
//   formats were sitting there unused while VISION-DOCUMENTS.md planned converters for them. B2
//   found that sentence while proving .ppt could never be read; B4 collects what it named.
//
//   The two that matter in a year: an EMPTY .md or .html throws nothing at all and is still a
//   failure, because sending the model an empty text block is asking it to read a document
//   nobody gave it; and a PASSWORD-PROTECTED PDF is refused before the model call. That second
//   one was costing a full call on a file nobody could open - proved by running it, the parser
//   returned ok:true with 1,420 base64 bytes and text:'' while the log said "No password given".
//   The library already knew and the catch threw the answer away.
//
// 2414 -> 2460, 4 November 2026 (GAPS-PLAN Part E step E0, decisions 47-49, 59, 60 and W5).
//   FORTY-SIX in tests/unit/auditWords.test.ts, about one walk rather than one patch. On
//   3 November the owner ran his own auditor's checklist against his own documents and found two
//   things in the report: four of ten lines came back ON_FILE - green - while the sentence under
//   each listed what was missing, and six of ten wrote a bare D6, D9, D12 at him.
//
//   The first was not a wrong answer. prompts/audit-agency.ts TOLD the model so, in a paragraph
//   headed "ON FILE MEANS A DOCUMENT ANSWERS IT, EVEN IN PART". The audit had no word for "on
//   file, with gaps", so four greens were the only honest thing it could say. A fifth word,
//   on_file_gaps, now exists in nine files and one CHECK constraint, and the test that matters in
//   a year is the one asserting the five as a SORTED LIST rather than a membership: a word added
//   to the audit and not to the chat fails there instead of reaching somebody as a raw
//   on_file_gaps on a pill.
//
//   The second is tested on the six leaking lines' REAL TEXT, read back out of staging. Real text
//   has the shapes nobody would invent - "D6 is on file", "The reading of D1 proposes", "D9 and
//   D10 are blank checklist templates", "D7 (ACDP 26-0192-ST)" - and across all 425 findings on
//   staging the leak is 51 in what_to_do, 4 in locator and ZERO in quote, which is why the sweep
//   deliberately does not touch a quote.
//
//   And one defect found by reading two files together rather than by any test: the email's
//   "...and n more" is nothing_on_file + stale - attention.length, so widening the attention list
//   without widening that sum prints "...and -2 more". Nothing reads a finished run's email text.
//
// 2460 -> 2461, 4 November 2026 (E0a, the owner's three sentences). ONE test, and it is a counter
//   rather than a matcher, which is the point. `auditTemplatePrompt` returns [ROLE, HONESTY,
//   SHAPE_T] and NEVER includes SHAPE, so every rule about the five words has to be written twice,
//   once in each shape. E0 did not know that: it put the tie-break in SHAPE only and then reported
//   that sentence, in GAPS-PLAN 8, as the likely cause of a TEMPLATE line going wrong - a sentence
//   the model producing that line had never been shown. So the new assertions count occurrences
//   (2 of the stale sentence, 2 of the practice sentence) instead of matching one, and a rule that
//   lands in one shape fails here rather than in a measurement three weeks later.
//
// 2461 -> 2487, 4 November 2026 (GAPS-PLAN Part E step E1, decisions 50 and 55-60). TWENTY-SIX,
//   twenty-two of them in tests/unit/auditPage.test.ts, and three of those are about failures that
//   would have been invisible until a customer hit them:
//
//   THE PRINT. app/globals.css:138 is `body.printing-drawer .print-page { display: none }`, and
//   display:none on an ancestor cannot be undone by a descendant. The audit report is a PAGE now,
//   and rendered inside the page container it would have printed A BLANK SHEET - the one failure
//   a printed compliance page must not have. The test asserts the report is a SIBLING of that
//   container, and asserts the CSS rule itself, so the day somebody tidies the report back inside
//   it the suite says why they cannot.
//
//   THE PRINT FRAME. visibleDrawer() read `aside.print-drawer` and the page is a <section>, so a
//   print from the report would have carried no company and no document type in its running
//   header. One selector, and nothing on screen would ever have shown it.
//
//   THE ELLIPSIS (W9, decision 58). The auditor's line is stored WHOLE - longest 235 characters
//   against a 1000 cap, measured on staging - so the ellipsis was ours alone, a `truncate` class.
//   The test reads the row's own markup rather than a rendered string, because there is no
//   renderer here and the class is the whole of the defect.
//
// 2487 -> 2513, 4 November 2026 (GAPS-PLAN Part E step E1a - board 1's LAYOUT, not only its
//   colours). TWENTY-SIX, all in tests/unit/auditPage.test.ts, and the group that earns its keep
//   is the PALETTE's single source. The same word is drawn three times on one page - in the strip,
//   in the counts under it, and as the row's own pill - and until E1a those were three unrelated
//   pieces of styling. Three copies of a colour drift, and the one that drifts is the one nobody
//   is looking at. So one test reads the eight hex values out of docs/audit-report-boards.html
//   (they must be the board's own), one greps app/ lib/ components/ and fails if any file but the
//   palette carries them, and one proves all three places read WORD_TINT by name.
//
//   AND THE PILLS MUST SURVIVE THE PRINTER. A browser drops background colours on paper by
//   default, so without `print-color-adjust: exact` the ten strip cells and every word pill print
//   as identical white capsules - on the copy that goes to an inspector. One CSS rule, scoped to
//   one class, asserted here because nothing on screen would ever show it.
//
//   Three display defects were found by the same reading and are pinned by their own tests: the
//   read-only note was rendered TWICE on the checklist report and NOT AT ALL on the agency report
//   (commit 10786ee put both copies in one branch); "Not right" on the run had nowhere to put the
//   answer on the checklist report; and "Download the documents" called the raw files the report.
//
// 2513 -> 2540, 4 November 2026 (GAPS-PLAN Part C - THE BINDER, decision 61). TWENTY-SEVEN, and
//   the new ones are a different KIND of test from most of this file: `lib/auditRows.ts` is pure,
//   so the numbering a binder's tabs depend on is checked by NUMBERING SOME FINDINGS rather than
//   by matching a regular expression against the source. "Document 3, page 1" on a row and the
//   third tab behind the report are the same rule, run.
//
//   `pageFromLocator` is tested against the column's own shapes, read off staging: "page 1,
//   header table", "Pages 1-2, August and September 2026 tables", "Section 1, page 2",
//   "next six-year maintenance due dates shown on page 1". A locator naming no page gives the
//   document alone - inventing "page 1" would send an inspector to the wrong sheet.
//
//   AND ONE THE WALK FOUND, WHICH NO SHAPE TEST WOULD HAVE: a Word document's stored text is
//   mammoth's HTML (`lib/documentContent.ts:421`), so the binder printed "</p><h1>7. Non-routine
//   tasks</h1><p>" to an inspector. `plainTextOf` converts it - never renders it, because that
//   would put a customer's own markup into the page - and `&amp;` is decoded LAST, or an entity
//   that spells a tag would become one.
const FLOOR = 2540

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

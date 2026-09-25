# Decision Record
**Version:** 102 · **Updated:** 23 September 2026
**Supersedes:** version 101 (23 Sep). Adds **§130 — build on the cheapest model, and the
micro-steps that kept buying themselves.** `.env.local` runs Haiku for prose, judgement, substeps
and summary; production is unset and therefore unchanged. **Haiku refuses `output_config.effort`
with a 400** — `temperature` in a mirror — so `modelAcceptsEffort()` drops it. And the $2 of
`substeps` nobody ordered: a generated micro-step never reached storage, so every page load
re-bought them. Fixed by persisting them, proved by three opens showing 7 calls then 0 then 0. Adds **§129 — FIX ROUND 2**, two bugs from the owner's
first test on production. An attached file reached Documents and never reached the model: the old
page sent the file WITH the question, the rebuilt page's `onFilePicked` ends at `card(…)`, and
`/api/chat` never lost the ability to read a file — it stopped being given one. The document now
travels by ID and is carried on **every** turn of the conversation, which reverses this section's
own first design: sending only the review summary on later turns made a turn **retract a correct
finding**. **Migration 039 is additive and production needs it before the code ships.**
**Supersedes:** version 100 (23 Sep). **§128's prices were corrected by the owner the same day**
— Opus 5 is $5/$25 per million, not $15/$75; Sonnet 5 is $2/$10, not $3/$15. Every cost figure
written before that is an overestimate of ~2.8×, the ledger rows were deliberately NOT repriced,
and the reconstruction of the $5.33 session **no longer holds**: at correct prices it accounts
for $1.32 of it, not $4.02. Adds **§128 — the owner's decisions on Fix Round 1, and
where the money goes.** Effort is `medium` by default for research and checklist; a typo in
`AI_EFFORT` now falls back to medium rather than buying the expensive tier. `RESEARCH_PROVENANCE`
moves the sources sentence into the SYSTEM prompt, which is the only place it cannot be disowned
— two of three runs then stand by their citations, against none before. **The check itself was
wrong twice before it was right**, both times calling correct behaviour a defect. And the cost
ledger: `ai_calls` writes a row at every call **with the prices it was costed at**, because a
total recomputed later is not what anything cost. The first 58 rows say research is 84% of the
bill and, more usefully, that **input is 62% of it** — what we send, not what comes back. Opus 5
costs **6.5×** Sonnet 5 per answer and finds one more golden fact in four. Version 100: version 99 (23 Sep). Adds **§127 — FIX ROUND 1, the owner's 22-23 September test
pass.** Nine defects found by USING the product, **every one with a green `npm run check` behind
it**. A stream that ends is not a stream that finished. "Bucket not found" was neither of the two
proposed causes — it was a wrong name in code — and checking it found that **no migration creates
the bucket at all** (037; recorded beside §98 and §118 as the same class). History now carries its
sources on every replay path, **and that is not sufficient**: asserting the provenance in the
appended heading made the third turn deny categorically, because history is replayed as plain text
with the tool-use blocks stripped, so the two real fixes are the owner's call. A citation marker
is rewritten into an inline link so a table survives it. R1.3 ships behind `RESEARCH_SPECIALIST`,
default off. The summary's "the specialist" came from the transcript's own label as much as from
the prompt. Version 99: version 98 (23 Sep). Adds **§126 — RUN 3, the page rebuilt from the prototype.**
Markdown is rendered (remark-gfm, a new dependency), citation markers open a card, junk source
titles fall back to a URL-derived name, and the working state is driven by real stream events
rather than a timer. A row decides "cleared" from whether turns exist, never from the date, so it
cannot claim a deletion that has not happened. `GateAskCard` is archived with the limitation
recorded: **the page does not handle `outcome: 'ask'`, so the gate cannot simply be switched back
on before R1.5.** Version 98: Adds **§125 — RUN 2, conversations that persist and the
nightly jobs.** Supersedes **§110** (7 days from summarising, not 15 from the conversation) and
closes three of **§116**'s four release gates. Turns, counters that record events rather than
inventory, conversion with a `discussed` guarantee enforced in code, and two cron-protected jobs
with a **30-day backstop** so a summariser outage cannot make transcripts permanent. The from-zero
restore refused migration 031's own verify block — a zero-row probe raises nothing — which is §98
catching this run's work. Version 97: Adds **§124 — R1.2 step one: prefer official sources, behind
`RESEARCH_PREFER_GOV`.** One sentence appended after the role sentence in both prompts when on,
byte-for-byte unchanged when off. **A preference, not a prohibition** — it permits a non-official
source with a disclosure, because a list of things not to do is the fence §113 found subtracts.
On locally for comparison; **it reaches production only if the owner's comparison says it beats
the current output.** Version 96: Adds **§123 — RUN 1, the open baseline, both outputs.**
*"this section needs no barrier between Claude and an answer."* Six config switches, all default
off; one open streaming call with search available and the model deciding; history as plain pairs
with signed turns ignored while the gate is off; the checklist cut to a shape and nothing else;
micro-steps in the background, three at a time, never lost and never repeated. **The narration
rule is positional, not linguistic**, from three recorded samples. Abort reaches the SDK, proved
from the log. Closes `TODO.md` 0.11 for this path. Version 95: **§117 is ANSWERED** — every module ships in the first release,
no compromise, and the remaining gate items happen once just before launch. Adds **§122 — production
is on 030**, applied 22 Sep after a pre-flight that derived the pending set as exactly 029 and 030;
both catalogs re-read afterwards and both objects checked on production. The migration gap is closed
and **catch-up is no longer paired with credential rotation, which is still outstanding.**
Version 94: **§98's owed reset is CLOSED** — `npm run db:restore` ran to
completion on staging, all 31 migrations from zero and every data count matching its source file.
Adds **§121 — a script the quality gate cannot see was broken for seven days.** `npm run preflight`
could not parse; `git log` puts the break at `d0eb1f5`, 15 Sep, unescaped backticks inside a
template. **`npm run check` executes 2 of this repo's 22 scripts** — `tsconfig.json`'s `include`
has no `**/*.js` pattern — so a green gate said nothing about it for a week.
Version 93: version 92 (22 Sep). Adds **§120 — the documented restore order was never
executable.** 0.10 put the expressions at step 5 and the switches at step 6, and the expressions
reference the switches: from zero that is **216 errors**, exactly the number of switch references
the file contains. `load-switches.js` reads nothing any other step produces, so the two are
swapped; every other adjacency was checked against the loaders and holds. It survived eleven days
because **every previous run had the switches already present** — an order that has only ever run
incrementally has not been tested. Version 92: version 91 (22 Sep). Adds **§119 — a parser that hunts for punctuation can be fooled
by punctuation.** The from-zero restore applied all 31 migrations, proving the chain builds the
schema from nothing, then died in `schema-doc.js`, which parsed from the first `{` in the CLI's
output — and against the CLI's drawn-table rendering that brace is inside `agencies.industries`'
default, `'{}'::text[]`. Reproduced, then fixed by pinning `-o json` **and** parsing the whole
reply. `db:restore` gains `--from N`, gated on re-reading every skipped step's own checks.
Version 91: version 90 (21 Sep). Adds **§118 — the worksheet is the library, and requirement
content never goes in a migration.** The owner's decision on `TODO.md` 6.3c, plus the standing rule
that stops the recurrence: migration 013 put eleven requirement rows inside a migration, they
existed in no seed file, and a from-zero rebuild lost them silently while 013's own verification
passed on the empty table. The worksheet is regenerated from the live library — 205 rows, dateless
filename — by a new `scripts/export-requirements.js`. Version 90: version 89 (21 Sep). Adds **§113 — THE OPEN BASELINE.** A five-question benchmark
against raw Claude and ChatGPT with no context found CompliBoard weaker on most: **the pipeline
subtracts.** Research runs one open call in production — the gate, facts block, frame/scenario
blocks and long prompt **switched off but not deleted**, each a config switch, so **the release
mechanism and the experiment framework are the same thing.** R&D rebuilds upward, each piece
shipping only if it beats the step before. The lesson, learned twice: **a structure built ahead of
the model constrains it.** Adds **§114** the module-by-module loop and its three kinds of gap
(schema / data / truth), **§115** benchmarks use an **incognito** chat, **§116** chat history is
**gated**, not deferred, and **§117** release timing is **open** and the owner's. Version 89: Adds **§111 — a checklist is a HYBRID**, deciding `TODO.md`
item 6 and resolving **§68**: the AI writes it but **starts from the obligations that apply**,
matched items are **linked** so completing one counts on both sides, and anything beyond them is a
**labelled suggestion**. A pure view cannot answer a hypothetical or anything outside the 205
rows; a pure artifact is today's defect. Adds **§112 — checklists come AFTER research**, as their
own section: the Create tab is untouched by sequencing rather than by a blocker, because the
hybrid starts from facts the research path is still changing. Version 88: Adds **§110 — conversations are kept for FIFTEEN DAYS**,
superseding §108's *discard after processing*: two tiers (automatic history, deliberate saves),
download by print-to-PDF, a prominent notice, and **three requirements** — deletion on day 16 must
actually happen **with a check that it ran** (§101's shape, pointed at a promise), account deletion
takes chat history **immediately**, and it is **real customer data**, which puts it in the privacy
policy and makes the eight-credential rotation gate live. **§65 gains a TWELFTH instance, mine:**
`M1.2d` reported as unbuilt when it was built, committed in `71c2a4d` and measured by me the same
day — **a plan trusted over the program it describes.** Version 87: Adds **§108 — conversational fact extraction moves
overnight.** Facts inferred from free prose are read from whole conversations after the fact and
**proposed to the customer**, not written. The gate, the gate's prior turns, and the direct ask
path all stay live. **The reason is judgment, not load**: the same fact carried two labels in one
conversation, and whole-conversation reading also resolves corrections. **Reverses §96(a) for
conversational facts** (the ask path keeps it) and **reverses *nothing is stored*** — a transcript
is raw evidence, not a fact, so §78 is untouched. **M1.3 as specced is superseded.** Adds **§109 —
the testing plan, deferred**: many fields, related and unrelated, because everything so far was
tuned on **one shape**, and the second shape was met once and handled worse. Version 86: Adds **§107 — a citation you can reach where the claim is.**
Markers become hover/tap cards carrying the source and a link; **the Sources list stays because a
card cannot print.** Records the formatting defects as **one cause, four shapes** — and that **two
of the four were REPORTED BUT NOT REPRODUCED** in three re-runs, so the mechanism is a hypothesis
pinned by tests, while a **fourth was found by the verification itself** and recurs in 2 of 3
runs. Opens an item that is **not to be acted on**: the answer varies between runs — length,
source count, where the customer applies, and in one run **1200-A and 1200-Z contradicting each
other inside one paragraph.** Version 85: Adds **§106 — every stray line break was a dropped
citation.** With web search on the answer arrives split one block per cited span; `lib/ai.ts`
joined them with `"\n"` and discarded each block's `citations`, so a sentence broke mid-way and
the full stop landed on its own line. **The ragged edges were where the sources used to be.**
Prose now joins with nothing, markers sit after the punctuation like footnotes, one number per
source, and a Sources list closes the answer — **stored with it** (migration 030,
`research_sources jsonb`), because a saved answer that lost its sources lost what *cite
generously* was for. Version 84: Adds **§105 — the M1.9 release criterion**: the research
answer must be **comparable to ChatGPT's and Claude's with no context**, and meeting it is the
stopping condition. Not better on every point — §102 records that the three bare models each won
different criteria. **Completeness of fact capture is explicitly NOT in the bar**: answering well
without every fact does no harm, answering worse than a free chat does. Records **three deferrals**
— the multi-case hypothetical matrix, Block D's same-place hypothetical, and complete fact
capture — as untested cases rather than defects. Version 83: Adds **§104 — the worked example was cleaner than the rule.**
A hand-typed example of a renderer's output agreed with the intent and not with the rule: the
measured run tagged Arizona `stated_in_question`, so the rule put it in the BUSINESS block while
the example showed it in neither. **Render the example from code** — an example is a checker, and
by hand it checks only that the author can restate their intention (check 14, and the second
instance in one day after §65's eleventh). Running it also found a defect nobody predicted: the
business's own fact **migrated into the scenario** whenever the scenario named the same switch.
**Routing is now by the FRAME, not the label** — the same fact carried two different labels in one
conversation. And **a new facility ADDS to the business**: split by `switches.scope`, with the
combined figure stated (47 + 12 = 59, crossing FMLA at 50) where *"do not reconcile the two"* had
forbidden it. Version 82: Adds **§103 — the frame is computed and the answer never
sees it.** `g.frame` reaches the topic title, the turn signature and the HTTP response, and
**never `messageContent`**. Measured on staging: hypothetical facts do **not** stop at the gate —
they arrive in `resolved.known` and render under *WHAT IS ALREADY ESTABLISHED ABOUT THIS COMPANY*
followed by *Treat these as settled*, so **a facility that does not exist is described as settled
fact about the business.** §78 made that structural for storage and nothing made it structural for
the prompt. Third instance of §101's shape, and the hardest to see: the field is populated and
plausible, and only the one consumer that matters is missing. Version 81: **§102 gains the other three answers, scored** — Claude
first and CompliBoard last without argument, but **ChatGPT and Gemini fail in opposite directions
and do not rank cleanly**: on the No Exposure Certification, the thing that decides whether any of
the answer applies, ChatGPT misses and Gemini catches. **The reissue and the 30 November deadline
are separated** — two of four caught the first, none caught the second. **§65 gains an ELEVENTH
instance, mine**: a data loss that did not happen. A hand-rolled PDF extractor could not read a
page boundary and the limit was recorded as *"not recoverable from the file"* — **a tool's blind
spot presented as a property of the evidence.** Version 80: Adds **§102 — the template made the model worse than the
bare model.** On one question CompliBoard was the weakest of four answers and **the only one that
knew the company**: the trigger overstated, the 1200-Z reissue missing, the **No Exposure
Certification absent** — the omission that could mean the whole answer does not apply — and seven
unsourced figures. **The cause is the six fixed sections**: a slot is a demand, and the model
fills every one. **A template narrows the OUTPUT the way a filter narrows the input** — §77 item
2 in a direction it did not anticipate. Research output becomes **free-flowing**, and the bar is
recorded: **beat the bare model, or the product adds nothing on research.** Version 79: Adds **§101 — a field nothing reads.** M1.2b was ✅ and
claimed the gate returns `needsWebSearch`; **it does not and never did.** §65's seventh shape — a
thing described as shipped — with a **new mechanism**: 7.2a survived by repetition, this survived
because **an unread return value meets no caller, no type error and no test.** A field nothing
reads is a claim nothing can check. Version 78: Adds **§100 — a hard 500 is a defect, not slowness**, and
fixes it: `lib/ai.ts`'s ceiling now comes from the SDK's own formula (`client.js:671`) rather than
from a chosen 32000, so the truncation retry cannot double past **21333** and crash before
sending. **The honest behaviour at the limit already existed** — a truncated review records
`complete: false` and still writes its row. Streaming is `TODO.md` **0.11**: it removes the
ceiling and answers §92's 58.9 s together. Version 77: Adds **§99 — two corrections found by PROVING the write, and
a 500 that is not ours.** `dispositionOf` was wrong twice, both the same conflation §97 exists
about: **`disposition` is the ITEM'S fate, not the finding's severity.** Both were caught by a
probe that compares each stored row against **the answer the customer actually received** — a
probe that could fail. And `/api/chat` checklist mode **can 500**: the critic's 12000-token budget
doubles on truncation (`ai.ts:152`) and the SDK then refuses the non-streaming request outright.
Reported, not fixed — §3.1. Version 76: Adds **§98 — the chain rebuilds the SCHEMA, not the
database.** `db:reset` produces a correct, **empty** one: the library lives in load scripts, not
migrations, so a usable staging database is **eight steps**, and **one refusal leaves `switches`
at zero rows and every later check passes vacuously.** Records the 029 reset as **OWED** with the
accepted risk (029 is additive), and names the precondition — `TODO.md` 0.10, the restore as one
command. Version 75: **§65 gains a TENTH instance — `§80a`, the fourth
cross-reference**, and the first composed citation attached to a **correct** finding, which
removes the only cue that would prompt anyone to check it. Adds **§97 — the critic's findings are ours, not the
customer's.** All four boxes come off every customer view: they are a **red-lined draft**, and a
customer receives the corrected document. Found by a browser test where the critic had correctly
withheld the wrong permit and **the customer saw it anyway, headlined as a removal** — a caught
error reading as a shipped one. **Revises how `CRITIC-PASS.md` §2.3's *surface, don't fix* is
applied, not its reasoning:** the evidence is kept, the audience changes — which forces the
storage §7.1 asked for and nobody built, since the critique is **persisted nowhere today.** Two tables, not one — **a clean review writes no finding row
and drops out of §7.1's denominator.** And **unrendered is not private**: `critique` comes out of
both response bodies, because a payload readable in devtools is output that reached the customer.
Version 74: Adds **§96 — M1's order reverses, and FIVE decisions about
the first writer.** **73 of 95 switches are site-scoped** (read from the live table; the documents
said 70), the conversation has no concept of a site, so **M1.3 first builds a writer for 22 facts
whose call shape changes when the site arrives.** A conversation surface precedes both — the
browser sends no `topicId` and nothing creates a `topics` row, so **M1.2c is real over HTTP and
inert to a person.** Four decisions: a stated fact is stored **immediately** (§6.1 superseded),
the write path takes a **`KnownFact` rather than a pair** so `source` reaches the enum and
**Postgres refuses a hypothetical with no rule to remember**, the person-only filter **may not
widen**, and a null-switch fact is **held in the turn, never written**. **(e) closes §9.4 the day
M1.2d flagged it: SEVERAL open topics per company** — §87's threads, and one-open-topic becomes
one colleague blocking another. A third option is **refused on the record** — a reload resuming
the open topic with an empty turn list is *a continuous record with discontinuous content.*
Version 73: Adds **§94** — a defect that **reproduces itself as the
library grows**: Oregon rows citing 29 CFR went **49 → 60** while `citation_federal_analogue`
stayed at 0, because migration 013's splits gave eleven children the federal citation in the wrong
field. **The mechanism is the finding, not the count** — 6.4's worklist grows with the library.
Says what would stop it (a rule at the split, then a CHECK) without building it. Adds **§95** — my
own §81 instance, inside the sweep checking for them: a stricter test labelled with a check
number, reporting a failure that was not one. **The rule now has instances on both sides.**
Version 72 added **§93** — drift **caught by comparing dates, not by
reading**. Three documents sat at 12 September while eleven migrations and three gate changes
landed; two described live behaviour wrongly. `CRITIC-PASS.md` was **not wrong about the outcome
but about the reason and the permanence**; `DETERMINATION-GATE.md` showed a `GateResult` the code
no longer has. Fixed by **pointing rather than restating** — one authoritative description per
thing. Now `AUDIT-CHECKS.md` check 31. Version 71 added **§92** — **the conversation is a minute long and that
is a PRODUCT problem**, filed as a different category from everything else this week. Four
measurements now: critic 36.4 s / 28.7 s narrowed, gate 9.9 s → 8.7 s with more context, and
**/api/chat over HTTP at 58.9 s then 29.0 s — gate plus answer, no critic.** Nothing is wrong; the
thing is slow. Records what is NOT the answer on evidence (narrowing, tuning, removing a stage)
and that the real options — streaming, an honest wait, or the worker — are product decisions, one
of which reverses D25. Version 70 added **§91** — M1.2c wired and run over HTTP: **the first
time anything from M1.2b onward has been reachable.** Turn 1 with no turns sent returns a signed
turn; turn 2 sends it back and the gate does not re-ask what turn 1 established. **All four
attacks refused with 400 over the wire**, including §90's omission — a genuine signed turn
refused because the SET is incomplete. **Check 29's three sub-shapes are closed**; `lib/` is down
from four unreached modules to two. §90 also gains a correction: **a MAC chain buys nothing
against truncation**, so the trade-off as originally put did not exist. Version 69 added **§90** — **a signature proves ISSUANCE, not
COMPLETENESS.** A client could send turns 1, 2 and 4, dropping the correction, and every turn
would verify: forgery by **omission** rather than authorship. Caught in review before any code.
Fixed by a contiguity assertion. Records that **a MAC chain would not catch truncation either** —
a truncation is a valid prefix — and that truncation is **accepted** because it is
indistinguishable from ordinary loss. M1.2c ships with **14 tests, every one an attack**.
Version 68 added **§89** — **`answering` is already forgeable**: a client
can POST `employee_count = 5000` today and the gate treats it as established, with no validation
beyond a `JSON.parse`. Blast radius stated exactly — **not a tenancy breach and not a persisted
lie**, but a wrong answer to the person who forged it. **Turns will be SIGNED** (HMAC, nothing
stored, §78 preserved), decided now because it is **free now and a contract change later**.
Records why marking-without-signing fails — **a client that can forge a turn can forge the label**
— and that signing adds an **eighth credential** to a rotation list of seven that is already
overdue. Version 67 added **§87** — `refersToTurn` means a different thing per
kind (elaboration → the ANSWER turn, refinement → the turn that ASSERTED THE FACT), **settled
before anything reads it**, because two later readers would each pick the reading their use
implied and neither would know — §71's shape before it exists, for the cost of a paragraph.
Verified on a conversation where the two readings diverge. Adds **§88** — **four names wrong on
one side of a string boundary**, all invisible to the compiler: **assert on the VALUE, not the
shape**, because a `null` that should be a number passes every structural test there is.
Version 66 added **§86** — M1.2 built. All four kinds classified
correctly on the first run, **`because` reads as reasoning rather than guessing**, and §8.4's
contract held: 4 exchanges → 4 turns including a fact-free elaboration, the superseded turn
stayed, nothing stored. **§4.1's correction is exercised** — a topic carrying two unrelated
questions, two frames, no confusion; the reversal condition did not fire. **And a field was always
null**: the prompt asks `refers_to_turn`, the normaliser read `refersToTurn`. Fourth name-across-a-
boundary defect this week, all four invisible to the type system. Version 65 added **§85** — **classification folds into the gate**, and
`WORKSPACE.md` §4.1's "one cheap classification call" is **superseded**: §77 settled the research
path at two calls three days after §4.1 was written, and the gate already holds the question, the
prior turns and the frame. The input-size objection is **measured and unsupported twice** (§76,
§83). Answers the three accumulation questions: a superseded turn **stays and collapses**, **every
exchange is a turn** including one asserting no fact, and **a new question does NOT close a
topic** — coupling them makes every topic one question long. Version 64 added **§84** — M1.2b built, and the first multi-turn
conversation this product has had. **`confined_spaces_present = true [hypothetical]` sits beside
`false [user_set]` with no conflict** — the false-green failure prevented rather than argued
about. The gate did not re-ask a fact from an earlier turn; a within-conversation contradiction
resolved as a correction. **`answering` stays and its HANDLING folds** — it was the handling that
made two places, not the field. **Turn-one tense is one pass and did not resist.** Records the
**prompt edit** plainly (§3.1) and leaves one thing OPEN: nothing bounds how a hypothetical frame
spends the one blocking question. Version 63 added **§83** — the trimming measurement, run before M1.2b was
built. **The bound holds** (9 fact lines from a 12-turn topic, ceiling is a line per switch per
frame) **and the motivation was wrong**: the gate got **1.3 s FASTER with 7.7× the context**, so
"unbounded context is a latency regression" is not supported — the same input-size intuition §76
already disproved for the critic. **Trimming stands on correctness, not cost**: a fact must arrive
labelled, because prose forces the model to infer modality from a verb. Version 62 added **§82** — **M1.2b before M1.2**, because classification's
three categories map exactly onto the three things the gate's history must carry: built in the
wrong order, M1.2 classifies from PROSE while M1.2b later produces STRUCTURE and nothing
reconciles them — §71 and §24's shape a third time. Adds **`hypothetical` as a sixth
`FactSource`**: reusing `stated_in_question` collapses two dimensions — **where a fact came from**
and **whether it is true** — and the collapse is invisible because every hypothetical does arrive
stated in a question. Records the trimming rule **as a design claim, unmeasured**, and the two
kinds of contradiction that must not be collapsed. Version 61 added **§81** — the two measurements, kept apart: **21 applies
of 200 CREATED** (a company with no obligations has no before) and **closed 5 / opened 5 /
unchanged 195 MOVED** against a non-empty baseline. **Neither is 19 or 23**; both of those were
expectations written before the endpoints existed. And **two guard probes passed for the wrong
reason** — one tripped an earlier guard, one used the caller's own entity — which is check 14's
subject again. **A guard test must fail when the guard is removed**, and the error body is the
evidence, not the status code. Version 60 added **§80** — **`declared`: a person is not a document.**
The four evidence classes all describe how a DOCUMENT supports a claim; a person is not on that
scale and is the strongest source in the product, so `declared` ranks **4, above `stated`**.
§24.1's rule was unexpressible until now, which is why `fromUserAnswer()` borrowed a word meaning
something else. **Third instance of §63's class and the sharpest: the module's own test asserted
what its database refuses**, both written 13 Sep, nothing putting them in one process for two
days. **Check 29's unrouted list is a queue of latent defects, not a tidy-up.** Version 59 added
**§79** — two findings from one refactor. The duplicated
`Established` builder **checked `value !== ''` and never consulted the value type**, so a `number`
switch holding `"abc"` would be **established to the ask path and unknown to the resolver**: a
question disappearing with nothing moving. **§43 demonstrated rather than predicted**, caught by
the refactor rather than by review or the suite, because each copy reads correctly alone. And
`switchesIn()` **already existed** at `appliesExpression.ts:224` with a doc comment naming this
use — **the check is not "should this be shared" but "does it already exist"**. Version 58: §65
gained a **seventh** composed assertion and it is a
different failure from the six before it: **7.2a described as shipped**, with a duration, a row
count and a second environment accumulated across several messages. **Production has never held a
switch value or an obligation.** The figure traces to `TESTING.md` Case A, which says **19** and is
a specification whose own header says it cannot run — a spec remembered as a result — and nothing
produced 23 at all. The first six were single assertions caught in one exchange; this was a
**repeated claim that was never challenged because each retelling agreed with the last.**
**Self-consistency is not evidence**, and work was planned on top of it. Version 57 added **§78** — **hypothetical facts are not stored**, anywhere. M1.2b gives the gate prior turns, so the hypothetical is already in the conversation it
reads; storing it too would put one fact in two places under different rules — **the two-systems
problem, now found three times** (§71 checklists vs obligations, §24 `scan_result` vs the site,
and this one, avoided). The lifecycle falls out of `WORKSPACE.md` §6.4: transcripts are
disposable, so the hypothetical dies with the topic. **`topics` needs no facts column.**
Version 56 added **§77**, the research path: **gate, then answer — two AI
calls, nothing else.** The critic is **dropped from research** (a conversation self-corrects; the
cost — most users will not ask — is accepted knowingly) and stays at the checklist boundary.
Nothing narrows the model. **The library is INVISIBLE**: per-claim verification badges are
withdrawn as wrong, because *marking something "from our verified library" is a product claim,
not provenance* — a citation shifts the burden to the source, a badge shifts it to us. Cite
generously, since citations are now the only catch. Web search and frame detection fold into the
gate; the gate gains prior turns. Version 55 added **§76** — the measurement. Narrowing 33 agencies to 4
buys **7.7 s (36.4 -> 28.7 s, 21%)** and costs **three coverage findings** (9,9,9 -> 6,6,6;
blocking held at 2 throughout). **The agency list is not what costs 36 seconds**, so Stage 2 does
not fix the latency it was proposed for, and §74's "Stage 2 stops being deferrable" is
**withdrawn**. `CRITIC-PASS.md` §5's asymmetry is now measured rather than argued. Version 54
added **§75** — Stage 2 stopped before any spec. §5.2
specifies a **model call**, so narrowing the critic means **adding an AI call to remove input from
a later one**; `CRITIC-PASS.md` §5 **already decided this trade in writing the other way**, and the
reversal was proposed without noticing the decision existed; and a **third option the design does
not consider** — `requirement_templates.agency_id` already partitions the library, so retrieval
names its own agencies with no AI call, inverting Stages 2 and 3. Records the failure direction:
too narrow is a gap **the critic cannot see**, and the obligations spine that would catch it is
not connected to either answer route (§71). Version 53 added **§74** — the critic timed before M1 is built, not
after: **36.4 s mean, 33.2–42.2 s, n=3**, critic alone, against a ~30 s conversational budget.
**Over, so Stage 2 stops being deferrable.** The 84 s from 12 Sep is not contradicted — that was a
272-item audit and this is a five-item checklist, so the critic costs ~36 s small and ~84 s large.
Do not tune the prompt or drop the tier: the cost is the input, all 33 agencies, because Stage 2
does not exist. Version 52 added **§73** — what the critic sees of a conversation.
**Prior ANSWERS, never prior FINDINGS**: feeding the critic its own earlier judgements is the
self-agreement failure the stage exists to prevent, one level out. Names the failure the fix
creates — a wrong prior assertion becomes anchoring context — and the mitigation: prior
assertions are labelled claims under review, not established facts. §65 gains the **provenance
test** that replaces the plausibility framing (*which artifact would have produced this
number?*) and a **sixth** composed assertion, a section citation written rather than read back.
Version 51 added **§72** — 6.4b stays deferred and `regulated_substances`
stays unseeded, because **moving thresholds into a table turns a visible problem into an invisible
one**: a wrong literal is readable on the renderer, which is how the circular switches were found,
and a wrong join is not. Deleting the table was refused on the code — its INNER JOIN is the only
source of a `true`. Records the **24 requirements carrying a numeric threshold literal** (27
clauses, 14 distinct pairs, **no CAS numbers anywhere**) as model-derived and unverified, the same
standing as the citations and 6.7's job. Version 50 added **§71** — the audit engine and the requirement library
were **never connected**: `/api/audits` and `/api/chat` contain zero references to
`requirement_templates` or `obligations` and generate their own lists from a standard name. **No
company has ever held both kinds of row**, so the two have never had the chance to disagree,
which is harder to notice than a contradiction. Corrects §68 on both counts: item 6 is *decide
what a checklist IS*, not *stop writing them*, and the accrual argument does not hold — the 235
production items carry **zero** completions. Version 49 added **§68–§70**. §68: two records of *what you must do*
already exist and the populations are inverted — **production holds 235 AI-generated
`checklist_items` and 0 computed obligations**; the reconciliation goes on the GATE because it
accumulates customer rows, not because it is hard to reverse. §69: reversibility decides WHEN a
decision must be right — ask what accumulates while it stands, not how hard it is to undo. §70: a
third failure class — **code that runs constantly, returns a defensible answer every time, and has
never taken its real path.** `substance_inventory()` is called 12 times per recompute and
short-circuits on its first branch; 15 conditions depend on it. Version 48 added **§67** — the critic pass had no test because it could
not be IMPORTED by one: `@/lib/...` is resolved by the bundler and by `tsc` but not by Node's
loader, which is what runs the suite. A module that cannot be imported will not be tested, and
the absence looks exactly like a backlog item. 24 assertions added; three more files are still in
that state and all three are on M1's path. The latency — 84 s, 37–151 s — is untouched and is the
real M1 risk. Version 47 added **§66** — the second question to ask of every stored
derived value: not only *what recomputes it* but **what rebuilds it when the table it lives on is
replaced.** Migration 007 did exactly that to `agency_id` on 10 Sep and it was repopulated on 11
Sep; the gap was one day and was named in the migration's own header. **Every derived column that
is recomputed by code is correct; all three that are not have failed or are failing.** Records the
fourth composed finding, whose new shape is that it was a RETRACTION — a self-correction is not
self-verifying. The general form was right and only the specifics were invented, for the fourth
time. Version 46 added **§65** — the three fabrications of 13 September in one
place, with the rule stated once and extended: **a composed filename is a described artifact, not
a copied one.** Each was settled by one `grep`, one query or one `ls`. Records that the third
arrived as an ABORT rather than a request, that aborting was right regardless, and that twice now
a wrong mechanism has carried a correct principle. Version 45 added **§64** — Cases E, F, G and I pass and the mechanism is
sound; **the content is not.** A ten-minute domain read of the rendered screen found three shapes
of wrong rule that 199 expression reviews did not, and the sweep it prompted found worse: **22 of
216 switch clauses can never be true**, so **a large-quantity generator receives zero
hazardous-waste obligations** and is told so confidently. 6.4 now carries a full item-by-item
revision of `applies_expression`. Version 44 added **§63** — the obligation writer had never once run
through its own route. It was proved by a script holding the service-role key, which set
`obligations_computed_at` and made every later request skip the write; the route connects as
`authenticated`, which held EXECUTE on neither function it calls, and returned 500 for every
uncomputed company — all ten on production. **A measurement carries the identity it was taken
under.** Fixed by granting the caller and validating identity inside the function, not by handing
the route a service-role client. Version 43 added **§62** — the lazy, synchronous obligation write,
recorded at last (it was decided in session and never written down), together with a finding
from the production pre-flight: migration 022 cites **§60** for that decision, **§60 did not
exist when 022 was written**, and the section it now points at is the rule about not writing from
what the record would contain. §60's failure mode, mine, in the commit immediately before §60.
A cross-reference is written only to a section already present in the file. Version 42 added **§61** — an `unknown` row's action is chosen from what
it is actually missing, never fixed by its status: a button with nothing behind it is worse than
no button. Twelve of 136 rows offered "Answer the question" with no question behind them, and
**the test asserted that as the contract and passed** — `resolve()` was right, the renderer was
right, and only their composition was wrong, which is the case for the screen preceding
verification. Two corrections recorded with it: the count is 12 and not 13, and the mechanism
described (a switch not naming itself) does not exist — all 72 missing switches name themselves
with zero `company_switches` rows present. Version 41 added **§60** — a finding is recorded from the artifact that
produced it, never from a description of work; if a defect is asserted and the place it was
observed cannot be named, it did not happen. Recorded after a defect was narrated into existence
with an invented figure attached, and refused. The escalation is the point: a wrong NAME is
caught by a list, a wrong DESCRIPTION by reading the file, and a wrong FINDING by nothing at all
once it is in the record. The real defect the loop then surfaced — 12 of 136 unknown rows naming
no fact — is recorded with the command output that produced it. Version 40 added **§59** — removing an exception from a check is a test
of what is underneath it, not a tightening. The no-aggregate test's header carve-out was
reverted, and an assertion that the newly-unexcused strings were actually caught **failed**: the
detector could not see `What you owe (40)` at all. The exception had been hiding both the case it
excused and what the check would have done with it. Version 39 added **§58** — 7.3 is built BEFORE M6, and the reason is not
schema but what the screen would say: `does_not_apply` and `unknown` rows can each say something
honest and complete, while an `applies` row says "this applies to you" and then nothing, because
the design deliberately never gave that column a second axis. Forty such rows read as a
compliance position. Plus five display contracts settled before pixels: questions not gaps, no
numeric aggregates (asserted by a test), `does_not_apply` as a peer section, no citation link
until verified, one page. Version 38 added **§57** — the five name-and-contents substitutions of
the last two days as ONE entry, because they are one failure: a value retyped or recalled at a
hop where it could have been copied. Three are the owner's hand-off, two of those after the rule
was extended to cover that step; one is mine and is the only one no name check could catch. The
rule is restated as a practice at every hop, including the hand-off, and the reversal condition
names the fix worth building if a sixth occurs. Version 37 added **§56** — a migration does one thing and its filename
says what (018 was briefly two unrelated changes; the half not in the name was the security fix,
and it went invisible in a hand-off), and **§46 extends from NAMES to CONTENTS**: a pre-flight
that names a migration correctly and describes it wrongly is worse than one that gets the name
wrong, because the name check passes and the operator approves a migration having been told it
does something else. Version 36 added **§46.3** — the extended pre-flight rule fired
correctly on its first real test, and caught something the original could not: a correctly
spelled name for a file that did not exist. Only subtracting the applied set from the directory
tells that apart from a correctly spelled name for a real one. Version 35 added **§55** — the whole-company recompute measured rather
than noted: 221 obligation rows touched per answer for a 2-site company, 19 of them changed,
**10.6× amplification**, and ~2,652 rows over a twelve-question session. Accepted for now, with
the reason it is not fixed stated as a correctness argument rather than a scheduling one: a
narrowed payload cannot distinguish "no longer applies" from "not sent", and the per-switch
obligation index that would make a partial recompute safe is derivable but unbuilt. Version 34
added **§53** — §51 constrains the SOURCE, not the switch: a
user stating a fact is not an inference, so the ask path writes every switch a person answers
including those on the propose-don't-write list, and reading §51 as a property of the switch
would have made the second-highest-leverage question in the product unaskable. It also corrects
the ask path's candidate set — offering only the 29 `user_answer` switches would never offer
`hazardous_chemicals_present`, which is seeded `documents`. And **§54** — one answer unlocks one
level of the dependency graph and stops, because without a recompute the first interaction
returns nothing, and with recursion it becomes the cascade the gate spec already refuses.
Version 33 added **§50** (`basis` is jsonb with a rendered sentence,
following 4.1's `determined_by` precedent — migration 018), **§51** (a proposal is not produced
until something can accept it; the ten propose-don't-write switches produce nothing, and this
blocks M6.1 rather than gapping 7.2a), and **§52** (the second dependency question — *what does
this decide on behalf of something that does not exist* — is now a step in the loop, after it
found four accidental contracts of which three would have been invisible until something
downstream broke). Version 32 added §49: an overwritten fact carries what it overwrote.
The overwrite is correct — a newer stated value outranks an older one — but a value that flips
silently leaves a requirement list that changes silently, and for a fact whose family gates 35
requirements that is the whole explanation somebody is looking for. Version 31 added §48: validate the STRUCTURE of an identifier before
writing it, never after. §45 protects the direction we can see — an identifier matching nothing
makes a requirement unreachable. §48 protects the one we cannot: a transposed digit is
syntactically valid and semantically absent, and it can land on a different real substance,
producing a confident answer about a chemical the site does not hold. Generalised to every
structural property checkable without a reference lookup. Version 30: **§38.2's entity_type
table is corrected** — it carried
194-era counts and the library has been 200 live rows since migration 013. Proportions and
decision unchanged. Recorded separately from the 7.2 build because someone reaching for that
table while building would have sized the scope flattening against a library that no longer
exists. Version 29: **§46 gains 46.1 and 46.2.** A pre-flight must list what
the TOOL will list — the set difference between the directory and the target's migration
history — because a migration written earlier in the same session for different work is in the
directory, absent from the history, and not on the author's mind. And 46.2 records the cost of
an abort raised on a correct run: three in one session, all cheap, all correct to raise, all
finding nothing — and each one spending a little of the guard that only works while an
unexpected result is rare. Version 28: **§20 gains its demonstration.** Its central claim — a
per-site fact defaulted to the primary site is wrong at five of six facilities, confidently —
had never been tested, because every company in either database had one site. A second site
now exists on staging and five requirements resolve differently at the two sites of one
company; `Oregon sick time` flips from `does_not_apply` to `applies` on the strength of the
second facility alone, with the company-scoped branch false at both. Recorded as evidence, not
as a passing test. Version 27 added §47: "replace" means **close and insert**, and the
function is named `close_and_replace_obligations` because the old name is what carried delete
semantics in from the sibling project. The transaction mechanism ports from BizPulses; the
retention policy does not, because BizPulses always wants the latest data for a period and
CompliBoard wants the history. Version 26 was the documentation sweep: **§43 and §45 gain the reversal
conditions they were missing** — every decision from §41 to §46 now states one, per
`HOW-WE-BUILD.md` §7. §43's records that the renderer is reversible only if the stored form
becomes readable enough to check directly, and explicitly NOT by better validation, since all
three faults it caught were well-formed. §45's records that the `unknown` asymmetry cannot be
reverted at any volume of inconvenience, because it is `CLAUDE.md` §3.2 applied to one
function. Version 25 added §46: a pre-flight names files exactly as they appear
on disk, read from the directory — because approximate filenames make every file list look
unexpected and so defeat the abort guard on production; recorded with the origin of the wrong
names left as unknown rather than guessed at. Version 24 added §45: an unidentified chemical now makes
`substance_inventory()` return NULL rather than false — found by checking a compensating
control that turned out not to exist in the data and would not have worked if it had, because
a guard above a clause cannot see why the clause said no. The general rule: a compensating
control has to be named and tested, or it is a belief. Version 23 added §43 (`applies_expression` is nested JSON and the
renderer ships with it — store the structure, review the sentence; plus the three faults
building the renderer found in its first twenty rows) and §44 (a threshold in an expression
must appear in the rule's own text in that unit, or the expression asserts a number nobody
wrote down — which caught a figure imported from a neighbouring rule on its first run; §44.1
generalises it to a proxy with a fabricated magnitude, §44.2 rules out a clause true of every
company, §44.3 makes "broader where the vocabulary cannot narrow" a standing rule for the
class, and §44.4 gives the test that distinguishes a real split from a wrong one).
Version 22 added §41 (the gate established facts the generating call
never received — `g.resolved` went into the HTTP response and nowhere else, so one model
produced an OHIO minimum-wage branch for an Oregon site the gate already knew; fixed, and
fifteen blocking findings on that case became three) and §42 (Sonnet against Opus on
generation, measured with the critic held constant: Opus better on transport-shaped answers,
~3× slower, and the default unchanged — plus the tier split that argues for building
identification and expansion as separate stages). Version 21 added §39 (the critic reports and never regenerates — a
silent fix destroys the evidence, and a self-healing loop means no failure is ever found; it
runs on every answer because the 2.5L failure was two sentences about labels and any
complexity heuristic skips exactly the case it exists for) and §40 (two model facts taken from
memory and wrong: `claude-opus-4-1` does not exist on this account, and the Claude 5 family
rejects `temperature` outright — a latent 400 across six call sites that routing surfaced
rather than caused). Version 20 added §36 (the §2.4 switch list was written before the
library: 6 of its switches nothing uses, 30 facts it lacks that 48 requirements need, and
banded `employee_count` cannot express 3 of the 7 thresholds — including the 15 that gates the
ADA, Title VII and the PWFA), §37 (tanks are the inventory and gallons are computed; no CHECK
can catch a dependency cycle, so the loader walks the graph) and §38 (exposure switches are
annual not static; the five-entity-type to two-scope flattening is a recorded approximation;
`outdoor_work` splits because its name encoded an assumption Oregon's heat rule does not make).
Version 19 added §35, two corrections to the determination-gate spec
found while building it: the `/api/chat` authentication closes **one** of §0.8b's four
undocumented routes rather than four, and the gate as specced could not see the worksite's
jurisdiction — it would have asked for an address every company has already given us. **Only
the PROCEED-path golden case could have caught the second**, which is the transferable half:
testing only the direction you are building for finds nothing about the direction you are
not. Version 18 added §34, **a correction to §4**: the checklist schema
did not lack a slot for "I need one more fact first" — it had an ADDITIVE one, positioned
after the answer, so the fix §4 implies was already in place when the failure happened.
Additive and alternative are different things that look identical in a schema. The fix is a
discriminated union, and the two additive slots are removed rather than left beside it.
Version 17 added §33, a near miss: a mapping rule reading
`29 CFR → OSHA` would have filed six employment requirements — the FLSA, FMLA, ERISA, Title
VII, the PWFA and EEO-1 — under the wrong regulator, silently, because a requirement under a
wrong agency looks entirely normal. Caught by projecting the mapping read-only over all 194
rows and reading the result by target rather than by count. The rule: a CFR title is not an
agency, the part is. Version 16 added §32: Washington's agencies wait for the
Washington library rather than loading now as permanently-`not_built` coverage rows — a gap
is only information when somebody expected the thing to be there, and the reversal condition
is the day the first Washington requirement is written. Version 15 added §29 (an unmatched requirement is a library
candidate, never a new version — a version claims the law changed, a candidate claims only
that a model said something), §30 (the customer-facing "what changed" diff is M6 work,
answerable from the validity windows rather than computed at resolution time) and §31 (the
two plans keep their separate phase numbering; the mapping table stays). Version 14 added
§28, what actually feeds a document prompt: one
shared parser for every route, and the two findings behind it — `/api/chat` answered from
the filename alone for formats its own file pickers offered, and `/api/hr` excluded `.docx`
from every HR answer while telling the user the format was unreadable, when the parsers had
existed all along and the restriction was a workaround for a mislabelled file. Version 13
added §27, how the product speaks when something fails
— polite, plain, honest about whose problem it is, never asserting anything about a document
it did not read, always saying what to do next. The operative rule goes in `CLAUDE.md` §5.1
beside the error-handling rules it extends; `WORKSPACE.md` §10.8 is the same rule scoped to
signup and is referenced rather than duplicated. The worked example is an alert that told a
user to check a file for dates after refusing to read it. Version 12 added §26: the invite flow becomes `MODULES` M8 —
Account, a new and eighth module. It had been floating between Phase 0 and Phase 1
(TODO.md numbering),
scheduled by nothing precisely because it depends on nothing. The cost of waiting is now
recorded rather than implicit — records written under a shared login stay ambiguous forever,
so deferring costs a window of history rather than a late feature. Version 11 added §25, where jurisdiction comes from: state, county
and city are **geocoded** from the address against the US Census Bureau Geocoder rather than
typed or inferred — a deterministic lookup against an authoritative source outranks both a
stated value and an AI one, which strengthens §24.1 — and a geocode failure leaves
jurisdiction unknown and asks rather than substituting. Fire authority is **asked**, because
fire districts do not follow county lines and the customer has been inspected by one.
Version 10 added §24, the match key: the company's stated address
is authoritative and an AI website scan never is — a derived value silently outranked a
stated one for months and cost most companies their state-level requirements — and the
match key's implementation belongs to Phase 4's resolution engine, with Phase 1 (TODO.md
numbering) landing its
inputs. Version 9 added §23, taken while building the six new tables:
multi-value switches decompose into one switch per substance rather than becoming an array
or jsonb — `applies_expression` is the test, since a requirement gated on lead cannot say
"one of the values in this array is lead" — which takes the switch count from ~46 to ~59;
and `topics` is deliberately not built, because two of `WORKSPACE.md`'s open questions
decide its columns and it is the furthest of the six from a caller. Version 8 added §22, the decisions taken while building the
requirements data-pass worksheet: what `priority` actually means (the test is whether the
business stops when an inspector finds it missing, and a third of the library being
`critical` means nothing is), `produces_switch` as the name of a switch rather than a
renamed boolean, `source` becoming `generated_by` with two values, and `cadence_type` left
free text until the pass shows what it needs. **§22.3 also corrects a misreading carried in
`CHEMICAL-OR-WA.md` §4.4**: the 174/11/3 model split was a sequential build log, not one
enumeration with two validators — what it carries is a convergence signal, and that is why no
fourth model was run. Version 7 added §21, the four enum decisions settled before
migration 006: `employee_count` becomes an integer rather than a band, `layer` becomes
jurisdiction-only with `contractual` moved to its own `source_type` axis,
`obligations.status` follows the spec's four states rather than the code's five, and
`category` becomes a ten-value obligation type holding the shape of the duty and nothing
else. Two data questions are flagged inside §21.2 and one inside §21.3 — deliberately not
guessed — all three were answered the same day and §21.2 and §21.3 now carry the answers:
`jurisdiction_layer` gains `local` and becomes nullable, and `missing` is not a status at all
but a query over `obligation_evidence`. §21.3's `satisfied` state was renamed `applies` the
same day, before any code used it — the four states answer *does this apply*, not *have I
done it*. Version 6 added §19 and §20. **§19 corrects §17.5** — `memberships`
is not a prerequisite for user management; several people at one company already works on
`profiles.company_id`, and what is missing is an invite flow. `memberships` answers a
different question, one person across several companies, and moves to multi-site. §17.4's
reasoning is corrected in place and §17.5 is marked half-superseded; the half that survives
is "do not stockpile the feature." **§20 records the multi-facility decision** — the data
structure goes into the Phase 1 (TODO.md numbering) rebuild, the interface does not, and
site is a property of
data rather than of people. Version 5 added §18, the decision to order the plan horizontally
first and vertically last — the phases now hold only infrastructure, and every module moved
to a final `MODULES` section in `BUILD-PLAN.md` and `TODO.md`. Version 4 added §17, the decisions behind the second tenancy
layer: RLS as an enforcement layer rather than a formality, `auth_company_id()` as the one
place tenancy lives, the shared-cache carve-out, one user per company for release one with
the audit-trail cost stated, separating the schema migration from the multi-user feature,
and the verification standard. §16 updated to reflect that the routes are now converted.
Version 3 superseded version 2 (10 Sep) — §15.7 is marked superseded and §15.8 replaces it:
document versions now live inside each file, not in its filename. §13 drops the Technical
Due Diligence row — that document has been deleted and every finding that mattered is
carried into this one; a fresh assessment will be made later. Version 2 superseded
version 1 (9 Sep), whose content is carried forward except where noted. §15 records the
decisions of 9–10 September, §16 the state of the security work. Also supersedes
conflicting statements in earlier planning documents.

**Companions:** `CHEMICAL-OR-WA.md` (the full design) · `BUILD-PLAN.md` (the phased plan
and why the order is the order) · `TODO.md` (the task-level to-do) · `WORKSPACE.md`
(conversation model, fact capture, topic lifecycle) · `CLAUDE.md` at the repo root (the
working rules for sessions)

---

## 1. Corporate structure

**Decision: one company, one codebase, one P&L. Vertical *brands*, not vertical *companies*.**

The proposal to split CompliBoard into ~10 industry-specific companies was considered and rejected for build-time. Reasons:

- Multiples are convex in revenue. Ten businesses at $300K ARR sell at 2–3× if they sell at all; one at $3M sells at 6–8×. Splitting ARR ten ways drops every unit below the threshold where strategic buyers engage.
- Engineering was never the cost. Ten go-to-market motions, support queues, entities, and data rooms for a solo founder means zero of them done well.
- A shared codebase poisons diligence. The second buyer is purchasing a dependency on a seller who still owns nine competing products. The first sale is clean; sales 2–10 are structurally harder and must be disclosed.
- Ten entities destroy the `standard_templates` cross-customer cache — the one place where marginal cost falls as the customer base grows.
- Segment ≠ problem. CompliBoard solves one problem: *proving compliance with real evidence instead of guesses*. Food vs. chemical vs. cannabis is market segmentation.

**What is done instead:** per-industry landing pages, vertical-specific content and templates, industry-tagged customer cohorts. All the marketing benefit, none of the structural cost.

**Carve-out remains an exit-time option.** If a chemical buyer wants only the chemical book, it is sold as an asset: that vertical's customers, contracts, brand, and requirement library, plus a perpetual source licence and a scoped non-compete. Carve-outs are cheap at exit and expensive to maintain for years beforehand.

**Reversal condition:** if two verticals turn out to be genuinely different *products* — different data model, workflow, buyer, sales cycle — not the same engine with different content. Decide from evidence after real customers in two verticals, not up front.

---

## 2. The Requirements architecture — four layers

**Decision: adopt the four-layer model. Layer 3 is code, never AI.**

| Layer | What | Owner | Producer |
|---|---|---|---|
| 1. Library | What the law requires, by industry + jurisdiction | Global | AI generates, human verifies |
| 2. Switches | **90** facts about this company *(§36; ~46 was the pre-library estimate)* | Per company or per site | AI determines, user overrides |
| 3. Obligations | Which library rows apply | Per company | **Code — pure calculation** |
| 4. Evidence | Which documents prove each obligation | Per obligation | AI matches, stored as rows |

Once the law is known (L1) and the company is known (L2), applicability is arithmetic. That single move makes the spine deterministic, instant, free to recompute, and fully explainable.

### 2.1 Jurisdiction goes in the match key

> ⚠️ **The paragraph below was wrong and is corrected in §24. Kept, not rewritten, because
> the correction is more instructive than a clean statement would be.** The deleted route
> did *not* match on industry alone — it filtered on `jurisdiction_state`, taken from an
> unverified AI website scan rather than the customer's address. That blob was null for 7
> of 10 companies, so most silently received **federal rows only**: the failure direction
> is UNDER-serving, not the over-serving described here. **94 of 192** active rows are
> Oregon-specific, not 90 of 188. The complete six-case rule is in `CHEMICAL-OR-WA.md` §3.2
> and the source-of-truth decision in §24.1 and §25.1.

Today the obligation-matching logic matches `.eq('industry', ...)` alone. (It lived in `app/api/sync-obligations`, deleted 9 Sep as an orphaned route with zero callers; the matching rule is what carries the bug and it is still to be rebuilt.) 90 of 188 chemical rows are Oregon-specific. A Texas chemical manufacturer is currently served Oregon SoS registration, CR2K, and Oregon OSHA. That is a **confidently wrong requirement** — the dangerous failure direction.

Resolution filters on: `federal OR (state AND matching) OR (county AND matching) OR (city AND matching)`.

**Corollary:** 95 federal rows serve every state. Chemical Oregon → Washington is an ~87-row job, not 188.

### 2.2 Switches are the product

182 of 188 chemical requirements are conditional; only 6 are universal. The requirement list is not the product — **applicability determination is the product.**

26 AI judgments per company instead of 188, reusable, explainable, correctable, and shared across verticals (employee count and fleet apply to cannabis and brewery too).

### 2.3 The `unknown` state is a safety feature

Four switch states: known-true → applies · known-false → not-applicable *with contradicting evidence recorded* · **unknown → undetermined, never "doesn't apply"** · needs_user → surfaced as a question.

Absence of evidence never produces a clear. This is the never-false-green principle encoded in the data model rather than only in a prompt.

### 2.4 Evidence lives in rows, not JSON

`obligation_evidence` resolves three findings that look unrelated in diligence: no resolution tracking, dashboard can only show issues climbing, and audits recompute from scratch. All three are the same problem — evidence links buried in a frozen JSON column.

---

## 3. Schema changes forced by the second vertical

Cannabis was used as the stress test. Six of eight core mechanisms survived unchanged. Five changes are required, and the first two must happen **before any new library rows are loaded**:

1. **Switch hierarchy** — `depends_on_switch` / `depends_on_value`. A switch whose parent condition isn't met is `not_applicable`, a fifth state distinct from `unknown`. Only `unknown` surfaces as a user question. *(Painful to retrofit — do first.)*
2. **`industries` becomes an array** — one row, many industries. Cannabis extraction and chemical blending share Oregon OSHA and fire code rows. One row, one verification, one update. *(Also painful to retrofit.)*
3. **New cadence types** — `continuous` (Metrc seed-to-sale) and `pre_approval` (OLCC packaging/label approval, $100/application, blocking, per-SKU). Forces `entity_scope` to include `product`.
4. **Per-agency review interval** — OLCC moves quarterly or faster; EPA annually; SoS rarely. Change-monitor frequency follows the regulator's velocity. Add agency bulletins as a monitored source class, not just rule registers.
5. **`jurisdiction_level = city` made real** — decorative in chemical, load-bearing in cannabis (local opt-outs, buffer distances, local licensing).

**Left unchanged:** four layers, `applies_expression` (simple AND/OR is sufficient), `scope_rules`, `produces_switch`, the six-stage runtime, verification by fact class.

---

## 4. The demonstrated failure mode, and the fix

Live test — *"minimum labeling requirement for 2.5L bottles and for the case"* — scored **B−**:

- **Critical error:** asserted each bottle needs DOT proper shipping name, UN number, and hazard class. Wrong. Six bottles in a case is a combination packaging; DOT marking and labeling attach to the outer package. Inner packagings are not separately marked or labelled. Six sub-steps and $650–1,800 of cost estimates were built on a requirement that does not exist as stated.
- Invented premise in the title ("your own vehicles" — never stated by the user)
- Miscitation (49 CFR 172.315 is limited-quantity marking, not net quantity)
- Packing group — the determination the entire answer depends on — absent
- Missing: UN specification packaging, hazmat employee training, shipping papers

**Root causes, only one of which is model capability:**

1. **Output schema foreclosed the right answer.** No slot for "I need one more fact first." A model asked to fill a checklist fills the checklist.
2. **Autoregressive lock-in.** The wrong headline got elaborated, not corrected.
3. **Substep expansion legitimised an unverified premise.** Expansion received requirement #1 as given.
4. **Effort inverted.** Six sub-steps on label procurement; one sentence each on the correct requirements.

**The governing principle that came out of it:**

> AI reasons excellently *against an artifact* and enumerates unreliably *from nothing.* Artifact-anchored tests scored ~99% against paid consultant work. The unanchored test scored B−. Never let the model enumerate from nothing — always give it a document, an agency scope, a library row, or a draft to critique.

### 4.1 Four stable model weaknesses, and the compensations

| Weakness | Compensation |
|---|---|
| Negative knowledge — better at "must do X" than "X doesn't apply here" | `scope_rules` as first-class content; critic question 3 |
| Regime/object boundaries — which rule attaches to which object | Explicit object + regime fields in identification |
| Specific numerics — dates, fees, thresholds go stale | `verification_flags`; primary-source retrieval; never generated at runtime |
| Under-asking — enumerates branches rather than requesting one fact | Determination gate with an explicit "ask" output path |

---

## 5. The six-stage runtime pipeline

```
User question
  1  Determination gate   what facts decide this? → if blocking fact missing, ASK. Stop.
  2  Agency scoping       which agencies have jurisdiction?
  3  Library retrieval    pull matching rows — THE ANCHOR
  4  Identification       which apply? object + regime stated. temp 0.1
  5  Critic pass          adversarial, fresh context, sees only output
  6  Expansion            sub-steps and costs, only on survivors
```

**Stage 1 alone would have prevented most of the test failure** — packing group determines UN number, hazard class, LQ eligibility, packaging spec, and label. "Upload the SDS" resolves all of it.

**Stage 5 is the highest-value addition.** Critique is cheap and reliable; generation is expensive and fragile. Applied to the failed test it catches the combination-packaging error, the missing determination, the invented premise, the penalty figure, and the omissions.

**Model tier allocation:** strong for determination gate and identification, **strongest for the critic**, cheap for agency scoping and expansion. Currently the same capability is spent on judgment and on prose.

**Temperature:** checklist generation currently runs at default because it is treated as conversational. Identification is a judgment call. Quality-affecting — spec before changing.

---

## 6. Coverage is data, not a code branch

**Decision: no `if (industry === 'cannabis')` anywhere. Ever.**

```
industry_coverage
  industry, jurisdiction_state, agency_id
  status         not_built | generated | verified
  row_count, last_verified_at
```

One table routes the pipeline, renders the coverage strip, and *is* the library build queue.

**Three tiers of anchoring:**

| Tier | Anchor | Quality |
|---|---|---|
| 1 | Full library | Best |
| 2 | Agency list only | Substantially better than nothing |
| 3 | Nothing | What produced the B− |

Stage 3 returns rows or returns nothing; Stage 4's prompt swaps the anchor accordingly. Same code path, same critic, same display. **The day OLCC rows land, cannabis answers improve automatically — no deploy, no flag.**

**`library_candidates`** captures every requirement produced without a library, with `times_seen` and user feedback. A real cannabis operator using the product for six months produces a usage-ranked, operator-validated build queue. The design partner becomes the library generator.

---

## 7. Vertical sequencing

**Decision: chemical library first. Cannabis served by the engine, not the library.**

### Why not cannabis first, despite the live lead

**The decisive argument — verification.** The quality model is *AI generates, human verifies.* Bhaskar is the human. Chemical/hazmat expertise makes chemical rows verifiable on sight. Cannabis rows are not. Building vertical #1 where the verification step cannot be performed defeats the purpose of vertical #1.

**Market economics.** ~2,400–2,500 active Oregon licences splitting ~$944M–$1B total. Retail median price per gram at the lowest since legalisation. Basket size down 20.8% since March 2021. Operators exiting and selling licences. Small TAM (10% penetration ≈ $600K ARR ceiling), weak willingness to pay under 280E, and involuntary churn as a structural feature.

**Maintenance burden peaks where verification capacity is lowest.** THC caps and packaging restrictions being reintroduced; OLCC Compliance Education Bulletin CE2-2601 effective 1 September 2026 defining a new Metrc process for secondary lab sample results. Constant churn.

**Exit thesis.** Cannabis software M&A is depressed with a small, cash-constrained buyer pool. Chemical/EHS has deep, well-capitalised strategic buyers. Warm relationships (High Purity Products, Cascade Columbia, Tarr, Columbus Chemical) are all chemical.

### What happens with the cannabis lead instead

Served **now** by the runtime engine at tier-2 anchoring, as a paying design partner — not a committed vertical.

- Cannabis agency list (~8 rows): OLCC, Oregon OSHA, ODA, DOR, Water Resources, DEQ, local fire, local jurisdiction. **One afternoon, and it moves cannabis from tier 3 to tier 2.**
- Runtime fixes (Stages 1 and 5) benefit them and every other vertical
- They are the golden-file source and library-candidate validator
- Coverage strip states plainly that no verified library exists yet

### The salesperson changes the verification picture

One of the three commission-only salespeople worked in cannabis manufacturing for several years and owned a small operation. **This partially closes the cannabis verification gap** — he can review generated OLCC rows in his licence type and say whether they are wrong.

Limits, and they matter: he can verify his own licence type, not the full rule set; not Washington; not anything that changed after he left. Tag rows with *who* verified and *when* — his `verified` and Bhaskar's are not the same claim and must not look identical in the database.

---

## 8. The first cannabis prospect

Six facilities across Oregon and Washington, targeted by the ex-operator salesperson.

**Decision: separate account per facility. Land on Oregon first.**

Separate `company` records per facility means jurisdiction resolves correctly per site automatically — no `entities` multiplication required for V1, and Washington facilities simply don't onboard until the Washington library exists.

**Known limitations of the workaround, to plan around rather than discover:**
- Company-level documents (HazCom program, SOPs, training curriculum, ISO cert, insurance) must be uploaded per account, or sites show gaps for documents that exist
- No roll-up view — six dashboards, no company-wide picture, which is what the cheque signer wants
- Six accounts at $199 = $1,194/month in a distressed market. **Decide the discount floor before the call, not in it.**

**Two things to establish in the first conversation:**
1. **Are the six facilities one licence holder or separate licence entities?** Cannabis frequently uses separate entities per licence for regulatory and tax reasons. If legally separate, separate accounts is *correct*, not a workaround, and the shared-document problem largely disappears.
2. **Are they a processor?** If they run hydrocarbon or CO₂ extraction, their highest-consequence obligations — flammable storage, LEL monitoring, ventilation, room classification, hot work, confined space, HazCom, boilers — are Bhaskar's own domain, verifiable personally, and already being built for chemical. Almost all cannabis compliance software is Metrc-adjacent; nobody covers the side where a fire marshal shuts an extraction room down. That is the wedge.

**Land on one or two Oregon facilities, not all six.** Closeable this quarter, manageable setup, honest scope, and it reveals whether the multi-account approach actually annoys them before anything is built around it.

---

## 9. Verification and the checking agent

**Decision: verify by fact class, not row by row. Ground truth is primary-source retrieval, never a model vote.**

Do not review 188 rows. Review, in order:
1. Every specific date, deadline, fee, and numeric threshold — the demonstrated failure class
2. Every `disputed` item
3. Every `critical` priority citation
4. Every row in the OR/WA divergence table
5. Every `scope_rules` entry — models are systematically weak on exclusions

~50–60 rows per state out of ~190. Days of focused work, not months.

### The shadow-testing design

Production runs the engine; staging runs the library; compare. **But data isolation is not independence.** The library is Claude-generated and live answers are Claude-generated — agreement is one witness speaking twice.

- **The checker must run on a different model** (GPT or Gemini)
- **Tiebreaker is primary-source retrieval** — eCFR, Federal Register, Oregon OAR/ORS, Washington WAC/RCW
- **Normalise before comparing** — prose cannot be diffed against a table
- **Weight toward the valuable disagreements:** *in answer, not in library* = library gap (actionable); *both, different specific* = one is wrong and it's resolvable (highest value)
- **Seed known-bad rows.** An unsupervised agent's failure mode is gradually finding nothing and reporting clean. If the checker misses the seeds, the checker is broken.
- **Human spot-check the checker's judgments**, not the library. Twenty adjudications per quarter.

### Change monitoring

Detection is deterministic retrieval (Federal Register API, eCFR, Oregon SoS bulletins, WA Code Reviser WSR filings, agency bulletin pages). Impact assessment is AI. Never ask a model "what changed recently."

Versioning is what makes it useful: *"Row 47 is superseded effective 03/01/2027. 23 customers were shown the prior obligation. Here they are."* The second sentence is the product.

---

## 10. Onboarding

**Governing rule: never ask what can be derived from the address, the website, a public database, or a document they already have.**

| Source | User cost | Switches resolved |
|---|---|---|
| Address | Zero | ~5 (state, county, fire authority, WA air authority, sewer district) |
| Public databases | Zero | ~8, including the hardest ones |
| Website scan | Zero | ~10 |
| Documents | One upload | ~20 |
| Direct questions | High | **Target 6–8** |

**Public databases are the most under-used input available.** EPA RCRAInfo returns the EPA ID and generator category — one of the hardest and most consequential switches. ECHO/FRS returns permits and violation history. FMCSA SAFER returns DOT number and hazmat authority. Oregon DEQ / WA Ecology return state permits. **OLCC publishes the full licensee list** — for cannabis this delivers licence type, endorsements, and production tier for free, which is the master switch and most of its children.

**Ask for documents, not answers.** "Upload your last six manifests" is a five-minute task for a shipping clerk. "What is your generator category?" produces a wrong answer from the same person.

Onboarding is progressive: 3 signup fields → background scan → **confirm screen** (correcting is easier than answering) → ~7 questions → skippable document requests → dashboard with a completeness meter → in-context asks when a question touches an unknown switch.

---

## 11. Where retrieval belongs

**Decision: primary-source retrieval happens at table creation and continuously thereafter — never as prose in a design document.**

A document saying "the deadline is March 1" goes stale silently and carries no check date. The same fact as a row with `citation_url`, `citation_quote`, and `source_checked_at` is auditable, re-checkable by the change monitor, and displays a verification badge.

Two live retrievals proved the value:

- **CFATS is still lapsed.** CISA states that as of 28 July 2023 Congress allowed the statutory authority for the CFATS program (6 CFR Part 27) to expire and CISA cannot enforce compliance. A generator working from training data would publish Top-Screen and Site Security Plan obligations as live requirements. **Maintain a standing "confirm status before publishing" list.**
- **Oregon CR2K confirmed and now citable.** OAR 837-085-0090(2): a covered employer who possessed a reportable hazardous substance in the previous calendar year must submit a Hazardous Substance Report by March 1 of the following year. ORS 453.317 adds "or within 60 days after the State Fire Marshal mailed the survey, whichever is later." Reportable quantities: 500 lb solid / 500 gal liquid / 500 cu ft gas; 500 lb or the TPQ (whichever is less) for EHS; 10 lb / 5 gal / 20 cu ft for highly toxic materials and explosives. Federal EPCRA 312 is generally 10,000 lb — **Oregon is roughly 20× stricter.**

Also caught: the Office of the State Fire Marshal separated from Oregon State Police into its own agency around 2023–24. Both URL structures remain live.

---

## 12. Codebase

**Decision: modify the existing repository. Do not fork.**

- Nearly every change is **additive** — new tables alongside existing ones, new pipeline alongside the existing chat route. The Requirements module is already hidden from navigation, so the work happens behind it with nothing user-facing breaking.
- A fork is a rewrite that doesn't admit it. The working parts (`lib/ai.ts`, the two-tier cache, the audit engine, document review, the design system) would be copied and immediately diverge.
- The live demo (CB-Test-1) and Vercel deployment stay intact; small fixes keep shipping while the big work happens on a branch.
- Git already provides what a fork provides.
- The existing migration author designed `entities`, `obligation_evidence`, `corrections`, and `agencies` **correctly**. They are unused, not wrong. This is finishing something started, not replacing something broken.

**Reversal condition:** if the existing schema actively fights the new tables. It doesn't.

**Development moves to Claude Code.** It reads before writing (removing the reason for the never-patch-JSX rule), writes migrations as files, and handles multi-file changes that broke under the two-terminal workflow.

**The standing quality rule survives the tooling change.** Anything touching prompts, temperature, model choice, what data feeds a prompt, truncation, extraction schemas, batching, or matching logic is discussed before it is written.

---

## 13. Project document decisions

| Document | Verdict |
|---|---|
| `CHEMICAL-OR-WA.md` | **Keep.** The master design document. |
| `CompliBoard-Requirements-chemical-manufacturing.xlsx` *(on disk; recorded here originally as `CompliBoardChemicalRequirementsMERGEDv2.xlsx`)* | **Superseded 11 Sep.** It was the single source for the 188 rows; the library now lives in the database (194 rows, 192 active) and the worksheet that loaded it is `supabase/seed-data/REQUIREMENTS-FILLED-2026-09-11.xlsx`. Keep as provenance. Richest artifact: 188 rows, the 9-item VERIFY hit list, 26 switches, 18-row fixed-date calendar, and a `Layer` column that already encodes agency ("Oregon OSHA", "Federal DOT"). The normalised columns from the separate intake file — `jurisdiction_level` (95 federal / 87 state / 3 county / 3 contractual), `jurisdiction_state` (90 Oregon), `is_determination` (9 yes), `applies` (182 conditional / 6 universal), `source` (174 gpt / +11 claude / +3 gemini — a sequential build log, not authorship; see §22.3) — have since been merged into it. |
| `CompliBoard-Requirements-Module-Definition.md` | **Delete.** Fully absorbed into the Chemical OR/WA spec, which contains everything in it plus the regulatory map, runtime architecture, display, verification, and onboarding. Two overlapping specs will drift. |
| `CompliBoard-Requirement-Template.xlsx` *(that is the name on disk)* | **Delete.** 18-column intake template superseded by a schema with ~15 additional fields (`applies_expression`, `scope_rules`, `agency_id`, `citation_url`, `citation_quote`, `produces_switch`, verification and versioning columns). Keeping it invites loading data in the obsolete shape. **Superseded in fact on 10 Sep by `REQUIREMENTS-TEMPLATE.xlsx` (below), which is the shape that was missing.** The file is still on disk at the repo root as `CompliBoard-Requirement-Template.xlsx`; deleting it is §0.7 housekeeping. |
| `REQUIREMENTS-TEMPLATE.xlsx` | **Keep, and treat as working state rather than a document.** Generated 10 Sep from the 188 production rows in the column order the rebuilt table will load in, with the six rows decided in §21.2 pre-filled and `category` deliberately empty. It is the worksheet for the re-categorisation and splitting pass (§21.4), not a specification — when the pass is loaded, the database becomes the source of truth again and this file is a record of how it got there. Regenerate rather than hand-edit if it drifts. |

---

## 14. Standing principles

- **Applicability determination is the product**, not the requirement list.
- **Never let the model enumerate from nothing.** Artifact, agency scope, library row, or draft to critique — always something.
- **False negatives are far more dangerous than false positives.** Never mark not-applicable without positive contradicting evidence.
- **Absence of evidence never produces a clear.** `unknown` → undetermined, never "doesn't apply."
- **Readiness counts are computed in code**, never by AI.
- **Expired evidence can never satisfy a requirement** — enforced in prompt *and* in code.
- **Rows are versioned, never edited in place.** Audits pin to a library version and stay reproducible.
- **Never delete an obligation** — mark it. "We were subject to this from March 2024 to January 2026" is the history the product exists to preserve.
- **Fix bugs at the source, never patch queries.**
- **Coverage is stated honestly.** "Local fire ◐partial · ODA ○not built" is more credible than any completeness claim.
- **Scanning is per industry, never per customer.**
- **One platform, infinite verticals** — marketing is the only layer where verticals diverge.

---

## 15. Decisions of 9–10 September 2026

Made during the session that closed the service-role holes. Each carries the condition
under which it would be reversed.

### 15.1 Local development points at staging. Production keys stay off the laptop.

**Decision:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` in a developer's `.env.local` hold **staging** values.
Production values live in the hosting platform's own environment settings under the same
names, and are not needed on a laptop for the app to run.

**Reasoning.** `npm run dev` runs the same code as production, including routes that
delete a company, its files and its logins. Twice in one day a dev server was running
against production with those routes live in it. Nothing went wrong, which is not the
same as nothing being wrong. Assume any locally-running server will eventually be clicked
in. A separate, related reason: a production service-role key sitting in a file on a
laptop is the thing that ends up in a zip — four keys already leaked that way on 9 Sep.

The migration scripts are deliberately the exception: `npm run db:migrate` targets
staging, `npm run db:migrate:prod` targets production behind a typed confirmation, and
those genuinely do need production credentials present locally to ship a migration.

**Reversal condition:** if staging ever stops being a faithful copy of production's
schema, developing against it starts producing changes that do not apply cleanly. At that
point fix staging, not the rule. The rule itself reverses only if the destructive routes
are removed from the app entirely.

### 15.2 Data export before account deletion is a requirement, not a nicety.

**Decision:** `/api/account/export` returns everything a company owns as one JSON file,
and the delete flow puts it in front of the user before they can proceed.

**Reasoning.** This product's entire value is holding a customer's compliance position —
what applies to them, what they have proven, what is missing. A customer who cancels and
finds their record simply gone has been harmed in the specific way the product promised to
prevent. Portability is also what makes deletion honest: "we delete everything, and here
is everything first" is a complete offer. Deleting without it is a hostage position, and
for a product sold on trustworthiness that is a strategic error, not just an unkindness.

The export deliberately describes uploaded files rather than embedding them — hundreds of
megabytes of PDFs in a JSON file helps nobody — and says so in plain language, including
that the files must be downloaded separately before deletion because deletion removes them.

**Reversal condition:** none foreseen. If the export ever becomes a vector — a way to pull
another tenant's data — the fix is to scope it correctly, not to remove it.

### 15.3 Irreversible destructive actions need a typed confirmation, not just a session.

**Decision:** deleting an account requires the exact company name in the request body. A
valid session is necessary and not sufficient. `npm run db:migrate:prod` requires the
operator to type `PRODUCTION` in a real terminal, and refuses to run unattended.

**Reasoning.** A session proves who is asking. It does not prove they meant it. The two
failure modes that matter here — a stray repeated request, and a person clicking through a
dialog they have stopped reading — are both defeated by having to type something specific
that cannot be guessed from the UI. The cost is a few seconds on an action taken once in
the life of an account.

This is why the migration script's TTY check was left in place even after it blocked an
agent-run migration: the guard doing its job inconveniently is the guard working.

**Reversal condition:** if a confirmation is ever bypassed in practice — copy-pasted from
a runbook without being read — it has stopped being a decision point and needs replacing
with something else, not weakening.

### 15.4 Library architecture: ONE requirements table, tagged by domain.

**Decision:** all regulatory requirements live in one table, tagged by domain —
`employment`, `environmental`, `transport`, `fire`, `licensing`. Modules are **views over
rows**, not separate systems. HR Help, the compliance calendar and the audit engine read
the same table with different filters.

**The test for whether a new domain needs its own system: does it need different
*columns*, or just different *rows*?** If the answer is rows, it is a tag. Employment law
needs jurisdiction, citation, cadence, applicability and evidence — exactly what chemical
manufacturing needs. It is rows.

**Reasoning.** The four-layer model in §2 only works if applicability is arithmetic over
one set of rows. A second requirements table means a second resolution engine, a second
verification workflow, a second definition of `unknown`, and two places for the safety
properties to drift apart. The cross-customer cache dies too — the thing that makes
marginal cost fall as customers are added.

**Reversal condition:** a domain that genuinely needs different columns — a different
notion of what a requirement *is*, not just different content. Judge it from a real
attempt to model it, not from the fact that it feels like a different subject.

### 15.5 Employment law is library #2, ahead of cannabis.

**Decision:** the second library is employment law, not cannabis Oregon. This reorders
§7 (vertical sequencing) — cannabis moves behind it.

**Reasoning.** Employment law applies to **every** vertical and does not fragment by
industry. A chemical manufacturer, a cannabis processor and a brewery have the same FMLA,
ADA, EEO, wage-and-hour and handbook obligations, differing by state and headcount, which
are switches already modelled. So the rows are reusable across the entire customer base
rather than serving one segment, and it exercises the domain-tagging decision in 15.4 with
a domain that is genuinely different in subject and identical in shape.

It also fits what exists: the HR module already reads handbooks and audits them against an
implied set of required policies. That implied set is exactly the library, currently living
inside a prompt instead of in the database where it can be verified, versioned and cited.

Cannabis remains the wedge for *new customers* — the §8 prospect and the extraction/
fire-code overlap are unchanged. It is second in the library queue, not deprioritised
commercially.

**Reversal condition:** a signed cannabis customer who needs OLCC coverage to onboard.
Revenue in hand beats sequencing on paper.

### 15.6 Working rule: gap-closing and feature work do not mix in one session.

**Decision:** a session that sets out to close a defect closes that defect. A real defect
found while closing it belongs in the same session; a redesign does not.

**Reasoning.** The route-hardening work of 9 Sep touched twelve routes and four documents.
Every change was of one kind — derive identity from the session — which is what made it
reviewable, testable against a single repeated test script, and describable in one commit
message. The `.docx`-as-JPEG bug was found while fixing `/api/hr` and fixed in the same
session: it was a live defect in the code being touched. Rewriting the HR answer flow to
cite sources was *not* done until it was asked for separately, because it changes what the
product asserts.

The distinction: a defect makes existing behaviour wrong. A redesign makes existing
behaviour different. Only the first belongs in a gap-closing session.

**Reversal condition:** none. If a defect cannot be fixed without a redesign, that is the
signal to stop and plan the redesign, not to do it inline.

### 15.7 Document versioning ~~in the filename~~ — **SUPERSEDED same day by 15.8**

**Original decision (9 Sep):** every substantially updated document gets a version number
in its filename and a header stating what it supersedes; the superseded file is deleted.

**Reasoning at the time.** Two overlapping to-do lists existed simultaneously on 9 Sep
(`CompliBoard-TODO.md` and `CompliBoard-TODO-v2.md`), and a to-do item was logged into the
wrong one. `CLAUDE.md` §2 pointed at `CompliBoard-Build-Plan-v2.md` after v3 existed. Both
are the same failure: a reader cannot tell which document is live, so they read the stale
one and act on it.

**What was wrong with it.** The diagnosis was right and the remedy was backwards. Deleting
the superseded file was the correct half and survives into 15.8. Putting the version in the
*filename* is what caused both incidents in the first place: a version in the name means
every update renames the file, and every rename breaks every reference to it. Kept, it
would have guaranteed more of exactly the drift it was written to prevent.

Left in place rather than edited away, because a decision record that quietly rewrites its
own mistakes is worth less than one that shows them.

### 15.8 Document versioning: version **inside** the file, filename stable.

**Decision:** version numbers go inside each document, in a header block. Filenames never
change. Every document in `docs/` carries:

```
# <Title>
**Version:** <n> · **Updated:** <date>
**Supersedes:** <what changed in this version, or "—">
```

To update a document: edit in place, raise the version, say what changed. The filename
stays put. Superseded *content* is replaced, not kept alongside.

Applied 10 Sep: `CompliBoard-Decisions-v2.md` → `DECISIONS.md`,
`CompliBoard-TODO-v2.md` → `TODO.md`, `CompliBoard-Build-Plan-v3.md` → `BUILD-PLAN.md`,
`CompliBoard-Chemical-OR-WA-Vertical-Spec.md` → `CHEMICAL-OR-WA.md`,
`CompliBoard-Compliance-Workspace-Design-v2.md` → `WORKSPACE.md`,
`BIZPULSES-PATTERNS.md` → `PATTERNS.md`. All renamed with `git mv` so history follows.

**Reasoning.** A reference written once should stay correct forever. Under the old rule,
every update forced a chase across every other document, `CLAUDE.md`, and code comments —
and anything missed pointed at a file that either no longer existed or, worse, still did
and was stale. Two drift incidents in a single day is enough evidence. The version is still
recorded; it is recorded where updating it costs nothing.

Git holds the full history of every version. That is what it is for.

**Reversal condition:** if a document ever needs two versions live at once — a published
spec a customer is working against, alongside a draft revision — that is the case
filenames-with-versions actually solves. Handle it then, for that document only, and say
so in its header. Do not reintroduce it as a general rule.

---

## 16. Where the security work stands after 9–10 September

Recorded so the next session does not have to re-derive it.

**Closed.** The storage policies now scope by company prefix (migration 002, applied to
production 9 Sep after a full rehearsal on staging). Every API route that touches company
data derives `company_id` from the verified session token; none reads it from a parameter
or body. Three orphaned routes were deleted rather than hardened. Two prompt-injection
paths — `company_name` and `industry` arriving from the request — were closed.

**Also closed since this section was first written.** Migration 003 moved `checklists`,
`checklist_items` and `calendar_events` to company scope and retired `folder_audits`.
Migration 004 gave every table a full set of policies, centralised the tenancy rule in
`auth_company_id()`, and revoked the not-logged-in role's grants. Migration 005 let
colleagues see each other. Then the routes were converted to run **as the caller**, so the
policies apply rather than being bypassed: ten routes on the caller's token, four holding
the admin client for a named statement each, four touching no database. All five migrations
are live in production. §17 records the decisions behind that work.

**Known and recorded, not fixed:** an empty model response becomes a raw 500 through
`askAIJson`; the monthly-summary route was deleted (it had never run — nothing scheduled
it); four orphaned storage files sit under a prefix matching no company; and the audit
engine drops a document from its basis when the download fails, with no error and no
record — observed live on 10 Sep producing a confident readiness figure from one readable
document out of eight.
---

## 17. Decisions of 10 September 2026 — the second tenancy layer

### 17.1 RLS is the second enforcement layer, not a formality.

**Decision:** every table carries a complete set of policies, and routes connect as the
requesting user so those policies actually apply. Application checks stay; the database
now enforces the same rule independently.

**Reasoning.** Before this, every route derived `company_id` from the verified session and
scoped its own queries — correctly, and verifiably so. But all of them connected with the
service-role key, which ignores RLS entirely. That is *one* layer, and it is a layer made
of remembering: it holds for exactly as long as every future route, written by anyone, in
a hurry, remembers to add `.eq('company_id', companyId)` to every query. The failure is
silent and the reviewer of that future pull request has to notice an absence.

Policies do not need remembering. A route that forgets its filter returns the caller's own
rows anyway; a route that names another company's row gets nothing back. The check moves
from something a person must do each time to something the database does every time.

Both layers are kept. The application check produces a clean 404 and never reveals whether
an id exists; the policy is the backstop when the check is missing or wrong.

**Reversal condition:** if RLS ever measurably costs more than it is worth — a hot path
where the policy subquery dominates, on a table where the application check is provably
sufficient. Measure it; do not assume it. No such case exists today.

### 17.2 `auth_company_id()`, SECURITY DEFINER, is where tenancy lives.

**Decision:** one function returns the caller's company, read from `profiles` with definer
rights. Every company-scoped policy calls it. 59 of 65 policies do, as of 11 Sep — the
count grows with every company-scoped table and is read from the database, never recalled.

**Reasoning.** The same subquery — `company_id in (select company_id from profiles where
id = auth.uid())` — had been written into twenty policies and all four storage policies.
Every copy read `profiles`, and `profiles` had its own RLS, so all of them silently
depended on one policy on a different table. Narrowing that one policy would have denied
everything, everywhere, including every file, with no error naming `profiles`. It would
have looked like the data had vanished.

Definer rights break that chain: the function reads `profiles` regardless of the policies
on `profiles`, so tenancy no longer hangs off a rule nobody thinks about when editing it.
Writing it once also means the rule can be corrected in one place.

`search_path` is pinned — a SECURITY DEFINER function without one is the standard Postgres
hijack.

**Reversal condition:** the function's signature is the constraint. It returns a single
`uuid`, so a person belongs to one company — note that this is the *only* thing
`profiles.company_id` restricts; several people sharing a company is unaffected (§19). *If*
`memberships` is ever needed, the function must return a set or take an active-company
parameter, and 59 policies change with it. That is a planned migration, not a reversal — but
it is the reason this decision has a cost, and the cost grows with the number of policies.

### 17.3 `standard_templates` keeps a privileged write. Named, not habitual.

**Decision:** the shared parsed-standard cache is readable by any authenticated user and
writable only by the service role. `/api/audits` holds the admin client for that single
insert, with a comment saying so and saying not to remove it.

**Reasoning.** One parsed copy of OSHA 1910.1200 serves every company — that shared cache
is the one place where marginal cost falls as customers are added (§1). So the table has no
tenant column, and there is nothing to scope a write policy *by*. An INSERT policy would
let any authenticated user write content into a cache every other company reads: poisoned
regulatory material, from an ordinary session, with no tenant boundary to catch it.

**The general rule this sets:** a route may hold the admin client for a *named statement*
with a comment explaining why. It may not hold it out of habit. All four remaining
admin-client routes name their statement.

**Reversal condition:** if the cache ever becomes per-company — different companies wanting
different parses of the same standard — it gains a tenant column and this carve-out
disappears with it.

### 17.4 One user per company for release one. Shared logins tolerated.

**Decision:** ship with `profiles.company_id` as it is. A company has one login. Early
customers who need two people sharing may share one.

**Reasoning.** User management does not exist — there is no way to add a person to an
existing company or remove one (see the feature item in `TODO.md`). Building it means an
invite/remove flow, and that is not what stands between here and a first customer.

> **Corrected 10 Sep.** This paragraph originally said building it "means the `memberships`
> migration and a whole invite/remove flow." The migration half is wrong — see §19. Several
> people at one company already works on `profiles.company_id`; only the flow is missing.
> The decision here is unchanged, but its *reason* is smaller than it was written: this is
> deferred because the feature is not the most valuable week available, **not** because a
> migration blocks it.

**The cost, stated so it is not discovered later:** a shared login weakens the audit trail.
Every write attributes to one person, so "who marked this obligation complete, and when" —
which is part of what a compliance record *is* — becomes "someone at this company did".
For a product sold on proving compliance with real evidence, that is a real limitation, not
a cosmetic one. It is acceptable for early customers who know it; it is not acceptable
indefinitely, and it should be said out loud during those sales conversations rather than
discovered during an audit.

**Reversal condition:** the first customer who needs two named people with separate
accountability. That is not a nice-to-have request — it is the product's core claim.

### 17.5 The schema migration goes early; the multi-user feature ships on its own timeline. — **half SUPERSEDED same day by §19**

**Original decision:** separate the two. Move `profiles.company_id` to `memberships`
**before real customer data exists**, because that is when it is nearly free. Build and ship
the invite/list/remove feature whenever it is genuinely next.

**What survives, and it is the better half.** *Do not stockpile the feature.* Writing invite
and removal flows now and leaving them unreleased means code that has never met a real user,
ageing against a schema that keeps moving. **Code written and not released is not tested — it
is only compiled.** Build the feature when it is next, and ship it when it is built.

**What is wrong:** the premise that the `memberships` migration has to happen at all, let
alone first. It was written on the belief that `profiles.company_id` means one person per
company. It means one *company* per person — several people can share a `company_id` today,
and do. **§19 replaces this half.** The migration is not cheap-now-expensive-later work that
must be raced ahead of the first customer; it is work for a customer shape nobody has yet.

### 17.6 Verification standard: compare rows against the service role, never HTTP status.

**Decision:** any change to who can see what is verified by comparing per-table row counts —
and where practical exact id sets — under the caller's token against the same query run
with the service role. Joined tables are checked separately. Seed enough rows first that a
subset failure is visible.

**Reasoning.** RLS is a filter, not a gate. A read that is too narrow returns `[]` with a
perfectly good 200; a partially-blocked join returns the right number of rows with empty
content inside them. Neither errors. "The route returned 200" and "the route returned the
right data" are unrelated statements, and only the second one matters.

This was not theoretical. The export route would have silently dropped every colleague from
a customer's data export — right shape, right status, fewer people — and only a count
comparison would have caught it. Testing with one row per table would not have caught it
either, which is why seeding comes first.

Writes are the safe direction: a refused insert errors loudly with `42501`. A refused
*update* or *delete* changes zero rows and returns success, so those are verified by
re-reading the row, not by the response.

**Reversal condition:** none. If a cheaper check is proposed, the question to ask is what
silent narrowing it would catch.

---

## 18. The plan is ordered horizontally first, vertically last

**Decision, 10 September 2026: the phases in `BUILD-PLAN.md` and `TODO.md` hold only
horizontal work — schema, the runtime pipeline, resolution, the worker, library data,
observability. Every vertical slice moves to a single final section, `MODULES`, worked one
module at a time: Compliance Workspace, Audits, HR, Documents, Calendar, Dashboard,
Onboarding and signup.**

**Reasoning.** The plan had one vertical slice sitting inside the horizontal sequence — the
Compliance Workspace, at Phase 3 — and it was scheduled *ahead of* the determination gate,
the critic pass, `company_switches` and the resolution engine, all of which are inputs to
it. A module built while its own foundations are still being poured is a module built
twice. Screens had the same problem at Phase 8, one step removed: a screens phase is not a
unit of work, it is seven modules' worth of screens filed together because they are all
made of pixels.

The second half matters more. **The other six modules had no phase at all.** Their findings
were real, specific and already written down — the audit engine silently dropping documents
it cannot read, HR checking a handbook against eleven hardcoded words with no jurisdiction,
the calendar extracting dates from PDFs instead of reading cadence from obligations — but
they lived scattered through `TODO.md` as *debts*, filed under whichever gap-closing session
happened to surface them. A debt is something you might pay. Planned work is something you
will do. Most of those items are not debts; they are the product.

**The cost is admitted openly: the plan is now longer.** That is the honest shape. The
phases were short because infrastructure is smaller than product, and the previous ordering
made the plan look nearly finished by keeping most of the remaining work out of it.

**What stayed a phase.** The employment law library moved *back* into the phases (6c → 6b).
A library is horizontal: employment obligations are read by the HR module and also belong in
a chemical manufacturer's obligation list, because they employ people. Same table, tagged
`domain = employment` (§4 of this record, and the architecture note in M3). Modules are
views over rows; a body of law is not a module.

**What does not wait for its turn.** M2(a) — the audit engine dropping any document it fails
to download, silently, then computing readiness correctly from a smaller input — is live in
production, was observed in a real run on 10 Sep (two satisfied, one needs-info, computed
from one readable document out of eight), and is half a day. Correctness bugs in shipped
code are not module work. Being last in the plan is not a licence to leave something wrong.

**Phases are not renumbered.** Phase 3 and Phase 8 are now gaps in `TODO.md`, Phase 7 in
`BUILD-PLAN.md`. Both documents and this one reference phases by number in dozens of places
(`7.3`, `2.6`, `5.2`, `6.7`); renumbering would break every reference silently, which is the
same failure mode §15.8 records for versioned filenames. Two gaps in a sequence is the
cheaper cost, and the gaps are explained in place.

**Reversal condition.** If a customer commitment requires one module end-to-end before the
horizontal work is finished, this ordering is what gets traded — deliberately, with the
rebuild cost stated, and with the affected module's dependencies named. The failure to avoid
is drifting into module work because it is more visible than schema work, which is exactly
what a plan with a vertical slice at Phase 3 invited.

---

## 19. `memberships` is not a prerequisite for user management — correcting §17.5

**Decision, 10 September 2026: `memberships` leaves the gate. It is recorded under multi-site
(Phase 11+ / F5) and nowhere else. The gate keeps key rotation and the Phase 1 schema
rebuild.**

**What was wrong.** The gate said *"the `memberships` migration is a prerequisite for user
management"*, and §17.5 was built on the same belief. Both read `profiles.company_id` as
"one person per company." It is the other direction: **one company per person.** Several
`profiles` rows can carry the same `company_id`, and colleagues at one company work today —
proven on staging on 10 Sep, where Test Alpha Chemical had two users and each saw the other's
checklists, which is exactly what migrations 003–005 were built to do.

**What is actually missing is the invite flow.** `/api/signup` creates a **new company** on
every call, so no route adds a second person to an existing one. That is why every company
has exactly one member — construction, not schema. A feature, not a migration.

**What `memberships` is actually for: one person across several companies.** A consultant
serving two clients, or an operator spanning facilities held as separate accounts. Real, but
rare, and nobody has that shape yet. It belongs with multi-site.

**Why the error mattered enough to record.** The two pieces of work are wildly different
sizes. The invite flow is a feature that can ship in any week. `memberships` changes
`auth_company_id()` from returning a `uuid` to returning a set or taking an active-company
parameter, and **59 of 65 policies plus four storage policies** are rewritten with it. Filing
them together made a cheap, valuable feature look blocked by an expensive migration — which
is exactly the reasoning that defers a feature indefinitely without anyone deciding to.

**The general lesson: check the direction of a one-to-many before planning around it.** The
claim was never tested against the schema. Two rows in a table would have settled it, and did.

**Reversal condition:** the first customer who is genuinely one person across two companies —
a consultant, or an owner with two entities under separate accounts. Then `memberships` is
required, and it is its own migration with its own rehearsal, never a step inside another
feature.

---

## 20. Multi-facility: build the structure in Phase 1 (TODO.md numbering), and site is a property of data

**Decision, 10 September 2026: the multi-site data structure goes into the Phase 1 schema
rebuild (`TODO.md` 1.6, `BUILD-PLAN.md` 2.8). The interface does not — it stays in `MODULES`,
built only if a customer asks. One account per facility remains the near-term answer.**

**The design lives in `CHEMICAL-OR-WA.md` §6.6**, which is where someone building multi-site
looks first. This section is the decision and its reasoning; that one is the shape.

**Why the structure now.** One company with facilities in several places is normal in
chemical manufacturing, and **their requirement lists genuinely differ by site** — different
OSHA citations, different waste rules, a different air authority. The six-facility cannabis
prospect is one business with six sites, not six legal entities. A schema whose only unit of
compliance is "the company" is wrong for both, and it is wrong quietly: it produces one
obligation list where there should be six.

**What goes in:** `entities` seeded with one site per company at signup — *including
single-site customers*, so nothing is special-cased afterwards · `entity_id` on `documents`
and `obligation_evidence` (`obligations` already has it) · a `scope` column on `switches`,
`company` or `site`, with a nullable `entity_id` on `company_switches` · site names the
operator recognises (`CompanyA-Hillsboro`, not `Site 2`).

The scope column is the one that has to be right. Employee count and ISO certification are
company-wide; generator category, air permit tier and underground storage tanks are per-site.
A company-wide answer to a per-site switch is not approximately right — it is wrong at five
of six facilities, and it is wrong in the direction of a confident answer.

> ### ✅ DEMONSTRATED PREVENTED — 12 September 2026
>
> This section's central claim — *"a company-wide answer to a per-site switch is wrong at five
> of six facilities, and it is wrong in the direction of a confident answer"* — had never been
> tested against anything, because **every company in either database had exactly one site**,
> and a resolver that silently answered company-wide would have passed every test we had.
>
> A second site was created for Test Alpha Chemical on staging
> (`scripts/seed-multisite-fixture.js`) — Portland, Multnomah County, `fire_authority` NULL so
> the county fallback is exercised too — with all seven site-scoped facts deliberately
> different from Hillsboro's. **Five requirements then resolved differently at the two sites
> of one company**, each one a permit the regulator issues per facility:
>
> | Requirement | Hillsboro | Portland |
> |---|---|---|
> | 1200-Z industrial stormwater permit | applies | does_not_apply |
> | Chemical storage compatibility / segregation | applies | does_not_apply |
> | Clean Air Act Title V permit | applies | does_not_apply |
> | Confined spaces — identification and signage | applies | does_not_apply |
> | Oregon Air Contaminant Discharge Permit | applies | does_not_apply |
>
> **And the mixed-scope case, which is the sharper evidence.** `Oregon sick time` reads
> *"10+ Oregon employees OR 6+ with a Portland location"* — one company-scoped operand, one
> site-scoped. With `employee_count = 7` the company branch is **false at both sites**, so the
> entire difference comes from the site-scoped operand:
>
> ```
> Hillsboro alone  ->  does_not_apply
> both sites       ->  applies          (entity_id = NULL — ONE company obligation)
> ```
>
> Hillsboro has 1 employee; Portland has 6 and is in Portland. **Adding a site added an
> obligation and removed none.** A resolver defaulting to the primary site would have told
> this company it does not owe Oregon sick leave — confidently, with no error and no
> indication that a second facility had not been considered.
>
> That last sentence is why this is recorded as **evidence rather than as a passing test**.
> The test asserts the behaviour; this records that the failure mode §20 named is real, is
> reachable with ordinary data, and is now closed. Mutation #8 in `scripts/mutation-check.js`
> reintroduces it deliberately — evaluating the primary site only — and five tests refuse it.

**⚡ The design rule, because this is the decision that could go wrong: site is a property of
DATA, not of PEOPLE.** A permit belongs to a site. A user belongs to the *company* and sees
everything in it. *"Which site am I looking at"* is a **filter** — a dropdown, roll-up being
"all sites" — and never a permission.

Per-user site access is the tempting alternative and it is a trap. It makes the simple case
(one site, one person) complicated, it turns a dropdown into a permissions system with an
inheritance model and an admin screen, and every query then has to resolve *"which sites may
this person see"* before it can ask anything useful. If a customer later asks that the
Hillsboro manager not see Seattle's findings, **that is a separate permissions feature**,
priced and built as one — not pre-built for a customer who has not asked.

**The cost of the interim, stated so it is a choice.** One account per facility works, and:
company-level documents get uploaded once per account and age independently; there is no
roll-up, so nobody can ask *"where are we exposed across all six?"*; and consolidating later
means **merging live customer accounts** and deciding which copy of a shared document is
authoritative — a data migration on real records with a customer waiting.

**The trade in numbers.** One day of extra design in Phase 1, taking it from about a week to
about a week and a half. Two to three weeks to retrofit after customer data exists, because
it reaches resolution, switches, evidence, documents and every screen at once. This is the
same argument as the gate (§18, and the gate at the top of `TODO.md`) applied to one specific
column set.

**Reversal condition:** if the structure turns out to complicate the single-site path in
practice — the common case for early customers — simplify the *interface*, not the schema.
The seeded default site exists precisely so the single-site case never has to know it is
there. If it starts leaking into queries or screens, that is a sign the default is not being
applied consistently, not that the structure was wrong.

---

## 21. Phase 1 enum decisions — 10 September 2026

Four decisions settled before migration 006. Each replaces a `text` column, or the plan
for one, with a fixed vocabulary. They are recorded together because they share a reason:
**a bare `text` column is a promise nobody checks.** The database holds one vocabulary, the
application code holds another, and the design documents hold a third — that is not a
hypothetical, it is what §21.3 found. An enum makes the disagreement a compile error and a
constraint violation instead of a silent sort to the bottom of a list.

### 21.1 `employee_count` becomes an integer, not a band

**Decision: store the actual number. Band at render time if a UI wants bands.**

**Reasoning.** The app offers `1-25 / 26-75 / 76-200 / 200+`. Every one of those straddles a
statutory threshold:

| Band | What it crosses |
|---|---|
| `1-25` | Oregon sick time at **10**, and lands exactly on OFLA at **25** |
| `26-75` | FMLA at **50** |
| `76-200` | EEO-1 and WARN at **100** |

**A company stored as `26-75` cannot be resolved for FMLA at all** — the answer is not in
the data. No amount of downstream logic recovers it, because the information was destroyed
at write time. Every employment threshold in the library derives from a number; a band is a
lossy projection of that number chosen for a dropdown's convenience.

Bands are a *display* choice. They can be computed from an integer whenever a screen wants
one. An integer cannot be computed from a band.

**This travels as one unit and cannot be split** — the column type, `/api/signup` (which
hardcodes `employeeCount: ''` on every account created), `/api/account` PUT, and the
`<select>` in `app/account/page.tsx`. Split any of them and signup writes a value the schema
rejects, which fails account creation outright.

**What is lost in the conversion, stated plainly:** the eight existing companies holding a
band become `NULL`, because a band cannot be converted into a number without inventing one.
All ten rows are our own test data (`CB-Test-1`, `ZZ Throwaway Test`); two already held an
empty string. Nothing real is lost, and doing this after a customer exists would mean asking
them to re-enter it.

**Reversal condition:** none for the storage decision. If a customer genuinely refuses to
give a number, the answer is a nullable integer and an `undetermined` switch — not a band.

### 21.2 `layer` is jurisdiction only; `contractual` moves to its own axis

**Decision: `layer` becomes `federal | state | county | city`. A new `source_type` —
`statutory | contractual` — carries whether a government imposed the duty.**

**Reasoning.** `contractual` was never a jurisdiction level. It answers *who imposed this*,
not *which government's law reaches here* — a different question on a different axis, folded
into one column because both felt like "where does this come from". A contractual obligation
still has a jurisdiction; it is simply not imposed by a legislature. ISO 9001 does not stop
applying at the Oregon border.

Keeping them in one column makes two things impossible: filtering "everything Oregon
requires of us" without accidentally including a registrar's contract terms, and filtering
"everything a customer contract obliges us to" at all.

**The vocabulary, settled 10 September:**

```
jurisdiction_layer   federal | state | county | city | local     -- NULLABLE
requirement_source_type   statutory | contractual
```

Two data questions were raised against the 188 rows and both are now answered.

**`layer` is nullable, because three rows have no jurisdiction at all.** ISO 9001, ISO 14001
and NACD Responsible Distribution become `source_type = contractual`, and all three carry
`jurisdiction_state = NULL`. Defaulting them to `federal` would assert that **US federal law
requires ISO 9001**, which is false and is the kind of false statement this product exists
not to make. A registrar contract is not territorial. `source_type = contractual` with
`layer = NULL` reads correctly and is the only combination that does.

**`local` is added, and it is not `city`.** Three rows are `layer = county` while
`jurisdiction_county` is NULL in all 188 — *fire-code hazardous-material permits*, *chemical
storage compatibility / segregation*, *emergency lighting / exit sign testing*, all Oregon
Fire Code. `city` would be wrong: **a rural fire protection district is not a city**, and
Oregon has many. `local` means *the authority having jurisdiction, resolved per site* — which
is also the honest answer, because which fire authority applies depends on the address and
cannot be known from the requirement row.

**That is the same fact that drives §20 and `TODO.md` 1.6.** Two plants of one company can
sit under different fire authorities, so a `local` row cannot be resolved at company level at
all — it resolves per site or not at all. The fire code is where multi-facility stops being a
convenience and becomes a correctness requirement, and it is the first place in the library
where a company-wide answer is simply wrong.

**006 creates both types and converts neither column**, because the six rows still have to be
edited. The conversion goes with the data pass.

### 21.3 `obligations.status` follows the spec: four states

**Decision: `applies | does_not_apply | undetermined | unknown`. The spec wins over the
code, because `CLAUDE.md` §3.2 is a safety property and the code is not.**

**Renamed from `satisfied` to `applies` the same day, before anything used it.** The four
states answer **one** question — *does this apply to me?* Naming a state `satisfied`
answers a different question — *have I done it?* — and mixing the two in one column is
exactly what produces a false green. Whether an obligation is satisfied is a **join against
`obligation_evidence`, never a column**, and the original name invited every future reader
to skip that join. It also fixes the pairing: `applies` / `does_not_apply` is a clean
opposition, where `satisfied` / `does_not_apply` was two axes wearing one name.

**Reasoning.** Three vocabularies exist today and no two agree:

| Where | Values |
|---|---|
| The data | `missing` 249 · `unconfirmed` 127 |
| `app/api/obligations/route.ts` | `missing`, `at_risk`, `expiring_soon`, `satisfied`, `not_applicable` |
| `CLAUDE.md` §3.2 and the design | `unknown`, `does_not_apply` |

`unconfirmed` is **34% of every obligation row** and appears in neither the code nor the
spec, so it falls through a `|| 9` fallback and sorts silently to the bottom of the
requirements list. It maps to `undetermined`.

`at_risk` and `expiring_soon` are dropped. They are **derived from evidence expiry, not
stored states** — computing them from `obligation_evidence.valid_until` gives one answer;
storing them gives two answers that drift apart the moment a certificate lapses and nothing
re-runs. `CLAUDE.md` §3.2 requires expired evidence to fail a requirement in code, and a
stored `at_risk` flag is exactly the stale copy that lets it pass.

`not_applicable` (code) and `does_not_apply` (spec) are the same state. The spec's name
wins because §3.2 is written in those words: *"`unknown` never resolves to
`does_not_apply`."*

**The two rank maps in `/api/obligations` change with it, and must be derived from the
generated enum rather than hand-written**, so that a future rename is a compile error rather
than a silent re-sort. Hand-written maps are how `unconfirmed` came to sort last without
anyone noticing.

**`missing` is not a status, and that is why it had no mapping.** It describes an obligation
that **applies and has no evidence** — which is `satisfied = false`, and that is a **query
over `obligation_evidence`, not a stored state.** Storing it duplicates a fact the evidence
table already holds, and a duplicate of a derived fact is a stale copy waiting to happen,
the same reason `at_risk` and `expiring_soon` are absent. The 249 rows map to `applies`
with no evidence rows behind them; 007 rebuilds them regardless.

**The boundary between `undetermined` and `unknown`, because they sound alike and are not:**

| State | Meaning | What can be done about it |
|---|---|---|
| `undetermined` | **We asked and could not resolve it.** The trigger condition is ambiguous, or it needs human judgment | **A dead end.** Nothing the product can ask will settle it — it needs a person |
| `unknown` | **We lack the input.** A switch the requirement depends on is unset | **A question we can put to the user.** Resolvable by asking, or by a document |

The distinction is operationally the whole point: `unknown` populates the switches screen
and the in-context asks, and it clears itself as documents arrive. `undetermined` never
clears on its own and must surface as an open question with a reason attached. Collapsing
them would either flood the user with questions that have no answer, or bury the ones that
do. **Neither ever resolves to `does_not_apply`** — `CLAUDE.md` §3.2, absence of evidence
never produces a clear.

**Why the rename was worth doing immediately rather than at 007.** The first draft of this
decision kept `satisfied`, and the flag against it was that 249 rows would then read
`satisfied` with no evidence behind them — so anything reading `obligations.status` without
joining `obligation_evidence` reports a false green. That is the omniscient status tracker
(`CLAUDE.md` §6) arriving through a column name rather than through a bad answer.

The cost of fixing it was one line in a migration that had not been applied. The cost at 007
would have been the same line plus every call site written against the old name in between,
and the cost after a customer sees a screen built on it is a conversation about why a
requirement said satisfied. **A name that invites a mistake is a defect, and it is cheapest
in the hour it is written.**

The rule that survives the rename: **satisfaction is a join, never a column read.**

### 21.4 `category` becomes obligation type: ten values

**Decision:** `permit | written_program | training | recordkeeping | monitoring |
reporting | physical_control | certification | credential | fees_taxes`

**Reasoning: the current 26 values are three different axes in one column.**

| Axis | Example values | Where it belongs |
|---|---|---|
| Subject matter | `Hazardous waste`, `Air emissions`, `Water` | `agency_id` — the regulator already implies the subject |
| Entity and cadence | the four `Per-` values (`Per-chemical duties`, `Per-person clocks`, …) — 19 rows | `entity_scope` and `cadence_type`, both already separate columns |
| **Shape of the duty** | `Registrations & permits`, `Written safety programs`, `Certifications` | **This, and only this, is what `category` should hold** |

What kind of thing you must *do* is the one axis that has no other home, and it is the axis
that determines what evidence satisfies the row.

**Tested against three other verticals before settling.** Cannabis, hospice and brewery fit
the same ten without forcing. Pre-approval regimes — cannabis label approval, brewery COLA,
TSCA premanufacture notice — are `permit` in type and `pre_approval` in cadence; the cadence
column already carries that distinction, so it does not need an eleventh type.

**`credential` is the tenth and is deliberately distinct from `certification`.** A credential
belongs to a *person* — a CDL hazmat endorsement, first aid/CPR, a cannabis worker permit.
A certification belongs to an *organisation* — ISO 9001, NACD Responsible Distribution. They
expire differently, they are evidenced differently, and when one lapses a different set of
people is affected.

**One category per requirement, and where that is impossible the row is under-decomposed.**
The silica standard is `training` and `monitoring` and `written_program` and
`recordkeeping` — which means it is four requirements written as one. Four cadences, four
evidence types and four ways to fail cannot share one status. **Splitting is the fix, not a
multi-valued column.** Splitting also lets each piece name its actual enforcing agency,
which they do not always share.

**Not part of 006: re-categorising and splitting the 188 rows.** That is chemical judgment,
done against a template by the owner. 006 creates the enum; the data pass follows, and
`requirement_templates.category` stays `text` until it is done.

---

## 22. Decisions taken during the requirements data pass — 10 September 2026

### 22.1 What `priority` means

**Decision: the test is what happens if this is missing when an inspector arrives.**

| Value | The business consequence |
|---|---|
| `critical` | **The business stops.** Licence revoked, plant shut, operations halted. |
| `high` | A fine, an enforcement action, or a finding at inspection. |
| `standard` | A real obligation whose lapse is procedural. |

**Reasoning.** The column has existed since the library was loaded and has never had a
written definition anywhere — not in the spec, not in the build plan, not in a comment.
Three values, 188 rows, no rule. It is also the **first sort key on the requirements
screen**, so an undefined column has been deciding what every customer sees at the top of
their list.

The test is deliberately about **consequence, not about how serious the rule sounds.** A
regulation can be important, well known, and heavily written about, and still not stop the
business if it lapses. What a customer needs at the top of the list is what closes their
doors, and that is a narrower set than what feels urgent.

**62 of 188 rows are currently `critical` — a third of everything. If a third is critical,
nothing is.** A ranking that flags a third of the list as maximum severity carries no
information and trains the reader to ignore it. Re-rating happens as part of the data pass,
against the definition above rather than against the impression each rule makes.

**Reversal condition:** if re-rating against this test still leaves a quarter or more of the
library `critical`, the test is not discriminating and needs a fourth value or a tighter
`critical` — not a re-interpretation of the same three.

### 22.2 `produces_switch` is a name, not a flag

**Decision: `produces_switch` holds the NAME of the switch a row determines.
`is_determination` stays as it is — the boolean.**

**Reasoning.** They answer different questions and both are needed. `is_determination` says
*this row determines something*; `produces_switch` says *what*. The resolution engine needs
the second, because determining a value is useless unless it knows where to write it back.
Collapsing them into one column would leave a boolean that flags 9 rows and no way to act on
any of them.

`produces_switch` **stays empty through this pass.** The switch library does not exist until
6.2, so there are no names to reference yet; filling it now would mean inventing identifiers
that the switch library then has to match. `is_determination` is carried across so the 9
rows stay findable when there is something to point them at.

### 22.3 `source` becomes `generated_by`, with two values

**Decision: rename `source` to `generated_by` and collapse `claude | gpt | gemini` to
`ai | manual`.**

**Reasoning.** The model name drives no decision. Nothing in the product treats a GPT row
differently from a Claude row, and nothing should: **trust is carried by
`verification_status`** — `generated | disputed | verified` — which is independent of origin.
A manual row can be unverified. An AI row can be primary-source verified. Origin and trust
are two axes, and only one of them belongs in a column that anything reads.

The rename also removes a live trap: `source` and `source_type` sit next to each other in the
same table with unrelated meanings and near-identical names. One is where a row came from,
the other is whether a government imposes it.

**The correction that goes with it, because the old column was being read wrongly.** The
174 / 11 / 3 split was recorded as evidence that the file was "substantially one enumeration
with two validators, not three independent generations." **That is wrong.** The merge was
**sequential, not competitive**: GPT generated first (174 rows), Claude ran next and added 11
GPT had missed, Gemini ran last and added 3 the other two had missed. All three lists were
merged. Nothing was chosen between, and no row was discarded in favour of a rival. The column
is a **build log** — which model first contributed a row the others lacked.

**What survives, and it is worth more than what it replaces: 174, then +11, then +3 is a
convergence signal.** Each additional model found dramatically less than the one before it,
and a curve that flattens that hard is evidence the enumeration is close to complete.

The evidence is **weak but real.** Weak because three models trained on overlapping corpora
can share a blind spot, and a requirement none of them knows about produces exactly this
curve too. Real because the drop is that steep: if substantial territory were missing, the
third model would not have found only three rows.

**That curve is the reason a fourth model was not run.** Expected yield is roughly one row,
and one row does not change a decision. The residual risk is the shared blind spot, and
another model of the same kind is the wrong instrument for it — that is closed by
primary-source retrieval against each agency's own published scope (§11, and
`CHEMICAL-OR-WA.md` §4.5), which is where the effort goes instead.

**Reversal condition:** if a customer or an inspection turns up a requirement none of the
three models produced, the convergence reading is weakened and the agency-by-agency retrieval
pass moves ahead of other library work.

### 22.4 `cadence_type` stays free text until the pass says what it needs

**Decision: leave `cadence_type` unconstrained through the data pass. It becomes an enum
afterwards, from the values actually used.**

**Reasoning.** The vocabulary is not known. `CHEMICAL-OR-WA.md` §2.2 offers
`one_time | annual | quarterly | monthly | on_trigger | maintain_current`, and the 188 rows
hold roughly 180 distinct prose cadences of a complexity that list plainly does not cover —
*"PHA every 5 years; audit every 3; refresher ≤3; incident investigation within 48 hours"*.

**An enum guessed before the work is an enum that gets fought.** The values reached for while
categorising 188 real requirements are better evidence for the vocabulary than a list written
in advance, and the cost of waiting is one migration. The cost of guessing wrong is either a
vocabulary nobody can express the data in, or a `other` value that swallows the hard cases —
which is the same as having no column.

`cadence` itself — the prose — is kept regardless and is never replaced by `cadence_type`.
It is 100% populated and irreducible.

---

## 23. Decisions taken building the six new tables — 11 September 2026

### 23.1 Multi-value switches decompose. No arrays, no jsonb.

**Decision: `substance_exposure_above_action_level` becomes one switch per substance —
`exposure_lead`, `exposure_benzene`, `exposure_silica`, `exposure_hexavalent_chromium`,
`exposure_formaldehyde`, and the rest. `company_switches.value` stays `text`.**

**Reasoning: they are not one fact.** Each substance has its own action level, its own
standard, and its own requirement set. Lead at 30 µg/m³ and silica at 25 µg/m³ are different
numbers in different regulations enforced on different schedules. Calling them one switch
because they share a sentence in a design document is a formatting observation, not a
modelling one.

**`applies_expression` is the test that settles it.** A requirement gated on lead exposure
has to say *"`exposure_lead` is true"*. With an array it would have to say *"one of the
values in this array is `lead`"* — which is a string search inside a column, in a resolution
engine whose entire purpose is that applicability is a deterministic query and never a
guess. Every requirement that gates on a substance would carry that search, and each one is
a place to get the matching subtly wrong.

**The switches screen settles it a second time.** `CHEMICAL-OR-WA.md` §6.4 shows one fact
per row, each with its own basis, confidence and "affects N requirements". *"Which
substances are you above the action level for"* is one question with fourteen answers, and
it cannot show a basis — the basis for lead is a lead air-sampling result and the basis for
silica is a different document entirely.

**It also makes switches map one-to-one with the rows they gate.** The fourteen substance
standards are already fourteen separate rows in `requirement_templates`. One switch each
means the gate and the requirement line up exactly, instead of fourteen requirements sharing
one switch whose value has to be unpacked.

**The count:** approximately 46 switches becomes approximately **59**. That is the real
number and always was; 46 was 45 plus one bundle.

**Reversal condition:** if a future switch genuinely has several simultaneous values that no
requirement ever reads individually — a list nothing gates on, kept only for display — then
an array column is right for that switch. It is not right for this one, and the test is
whether `applies_expression` ever needs to look inside.

### 23.2 `topics` is deliberately not built

**Decision: five of the six new tables are built in migration 008. `topics` waits.**

**Reasoning.** It is the only one of the six whose *shape* depends on an unresolved design
question rather than on unwritten code. `WORKSPACE.md` §9 lists five open questions and two
of them decide columns and constraints:

- **Concurrency** (§9.4) — one open topic per company, or several? One is a partial unique
  index on `(company_id) where status = 'open'`. Several is no index. This is not
  deferrable after the fact: if several are allowed and users create several, adding the
  constraint later means closing somebody's open work.
- **Summary format** (§9.3) — what is worth keeping once the transcript is gone. That is
  the content of the column that *is* the table's durable output.

It is also the furthest of the six from a caller: the Compliance Workspace is M1, the last
section of the plan, behind the determination gate, the critic pass, `company_switches` and
the resolution engine. Building it now locks in a guess that nothing will exercise for
months, and the usual cheap-now argument does not apply — there is no data to migrate around
later, because the table would be empty the entire time.

**Already decided for when it is built, so it is not re-litigated:** *"discarding the
transcript"* (§6.1) means **nulling the column and keeping the row**, never deleting the
row. A discarded transcript must still leave behind the fact that a topic existed, when it
closed, and why — otherwise "was this ever asked?" becomes unanswerable, and `close_reason`
(user closed it / a checklist closed it / inactivity closed it) reads very differently to a
user depending on which it was.

**Reversal condition:** the Workspace work starting. At that point both open questions get
answered by the people building the screen, which is the right moment for them.

---

## 24. The match key — 11 September 2026

### 24.1 The company's stated address is authoritative. A website scan never is.

**Decision: jurisdiction comes from `companies.state/county/city` and
`entities.state/county/city`. `companies.scan_result` is never read for it, by anything.**

**Reasoning, and it is not hypothetical.** The deleted `app/api/sync-obligations` read the
company's state from `scan_result->>'state'` — the output of an AI website scan — rather
than from the address the customer typed. Three things followed, and all three were live:

- **`scan_result` is null for 7 of 10 production companies.** For those the jurisdiction
  filter fell back to "federal only" and **silently dropped all 94 Oregon requirements**.
  Under `CLAUDE.md` §3.2 that is the safer direction — absence of evidence producing less,
  not more — but the customer is still told less than they owe with no indication.
- **The two sources already disagree on a real row.** `CB-Test 2` is Oregon by address and
  **Washington** by scan. It would have been matched against Washington, of which the
  library holds nothing, and received only federal rows.
- **A derived value silently outranked a stated one for months**, and nobody could see it
  happening, because the failure mode of a too-narrow filter is fewer rows and a 200.

**The general rule this earns: a value a person stated outranks a value a model inferred,
wherever both exist.** A scan is useful for *proposing* an answer — M7's teaching
confirmation is exactly that — but the thing resolution reads must be the answer the
customer has seen and accepted. That is also what makes a wrong jurisdiction correctable:
the user can fix an address; they cannot fix a JSON blob they have never been shown.

**Reversal condition:** none for the ordering. If a scan ever becomes the only available
source — a signup that captures no address at all — then the correct behaviour is an
**unknown** jurisdiction and an asked question, not a silent substitution.

### 24.2 The match key's implementation is Phase 4, not Phase 1 (TODO.md numbering)

**Decision: Phase 1 lands the match key's INPUTS. The rule itself is written down now and
implemented in Phase 4.1, inside the resolution engine.**

**Reasoning.** Phase 4.1 is *"jurisdiction + switches + library version → obligations,
deterministic"*. The match key is three-quarters of that sentence, and 4.4 makes *"state X
never receives state-Y requirements"* a required test **of the engine**. Building it in
Phase 1 means building it against an engine that does not exist and then building it again.

**It belongs in code as a pure predicate, never as a SQL filter.** §3.2 requires resolution
to be deterministic and computed in code; a predicate can be tested without a database; and
a too-narrow SQL filter fails by **returning fewer rows with a perfectly good 200**, which
is precisely how the original defect survived for months. Load candidates with a
deliberately broad query, narrow in tested code, so that a wrong query errs toward a
superset where the code catches it.

**What Phase 1 landed instead:** jurisdiction columns on `entities` (migration 009), which
made `local` and `city` resolvable at all — they were unresolvable for every company
because a site had no way to say where it was; the source-of-truth decision above; and the
complete six-case rule in `CHEMICAL-OR-WA.md` §3.2, so Phase 4 inherits it.

**Still missing, and named so it is not forgotten:** signup hardcodes `county: ''` and
never asks. `jurisdiction_layer = 'county'` is a value the rule must serve, so until the M7
signup rework captures a full address, no county-scoped requirement can resolve for anyone.

**Reversal condition:** if resolution turns out to need a database-side filter for
performance — it will not at a few thousand library rows — the predicate stays the
definition and the SQL becomes an optimisation that must be a proven superset of it.

---

## 25. Where jurisdiction comes from — 11 September 2026

**Recorded, not built.** The implementation belongs to M7, where signup is reworked.

### 25.1 State, county and city come from geocoding the address

**Decision: geocode the address. Not AI, and not the user typing a county name.**

The **US Census Bureau Geocoder** does this with **no API key and effectively unlimited
use**, returning the matched address, city, state, state FIPS, county and county FIPS. It
is the authoritative source for exactly this question, and it is free.

**Why not AI.** This is a lookup with a **known correct answer**. A model would be right
most of the time and wrong occasionally, **with no signal on which** — and jurisdiction is
the match key. A wrong county silently changes which requirements apply, which is the
failure mode this product exists to prevent, arriving through the one field that decides
everything downstream. `CLAUDE.md` §3.3 is the general form of this: the model reasons well
against an artifact and enumerates unreliably from nothing. An address lookup is not
reasoning against an artifact; it is a database query someone else already runs.

**This is stronger than §24.1, and supersedes its ordering for these three fields.** That
decision said a stated value outranks an inferred one. This one says: **a deterministic
lookup against an authoritative source outranks both.** A customer typing "Washington
County" is a stated value and can still be wrong — people mistype, and people in Portland
routinely do not know which of three counties their address falls in.

**The failure path is part of the decision and must be built.** Census downtime is common
enough that commercial geocoders market themselves specifically against it. So:

> **A geocode failure leaves jurisdiction UNKNOWN and asks. It never silently substitutes.**

Same rule as a missing address (§24.1's reversal condition). An unknown jurisdiction means
the state- and county-scoped requirements show as **undetermined** — open questions with a
reason — rather than resolving against a guess. A retry, a queue, and a visible "we could
not confirm your county" are all acceptable; quietly falling back to what the user typed,
or to a model, is not.

**Reversal condition:** if the Census Geocoder's match rate proves too low for real
customer addresses — rural sites and new construction are the usual gap — the answer is a
second authoritative geocoder as a fallback, not a model. The rule is authoritative source
or unknown.

### 25.2 Fire authority is asked, not derived

**Decision: ask the user. One field, at onboarding.**

**Geocoding does not solve this, and the three `local` fire-code requirements depend on
it.** Fire districts do not follow county or city lines. **Tualatin Valley Fire & Rescue
spans Washington, Clackamas and Multnomah counties** — so knowing a site is in Hillsboro,
Washington County, Oregon does not tell you who inspects it. That is precisely why
`entities.fire_authority` exists as a **fourth independent fact** alongside state, county
and city, rather than being derived from them.

**Why asking is right here, when it is wrong for the other three.** The user knows the
answer with high confidence and can give it instantly: **a fire marshal has visited them.**
Their inspection reports have a letterhead. This is the rare compliance fact where the
customer is the authoritative source, and asking costs one field.

**Do not infer it with AI.** Fire district boundaries are exactly the fact class that goes
stale and gets confidently wrong — districts merge, annex and redraw, and a model trained
on a 2023 corpus will state a 2019 boundary with full confidence. `CLAUDE.md` §6 lists
this class as needing a verification badge; a field with a badge that nobody checks is
worse than an empty field that asks.

**When it is unknown, the three `local` requirements show as undetermined.** They do not
resolve against a guessed authority, and they do not silently disappear. Undetermined is
the honest state and it is already what `obligation_status` is built for (§21.3).

**Two options rejected, and why:**

| Option | Why not |
|---|---|
| **A curated per-metro lookup table** | Accurate where it is built and **silent where it is not** — a company outside a covered metro gets a confident empty answer, which is indistinguishable from "no fire authority applies". The failure is invisible, which is the disqualifying property. It may earn a place later as a *suggestion* the user confirms, never as a source of truth. |
| **AI with web search** | Belongs to the `verification_flags` class — a generated answer needing primary-source confirmation before anything relies on it. Putting it in the match key means the flag is never seen, because resolution does not read flags. If it is worth searching for, it is worth the user confirming, and the user already knows. |

**Reversal condition:** a customer with many sites for whom asking per site is genuinely
burdensome. Then a lookup table becomes worth building — as a **pre-fill the user
confirms**, with unknown still meaning unknown.

---

## 26. The invite flow is a module, not a floating feature — 11 September 2026

**Decision: user management becomes `MODULES` M8 — Account. It was sitting between Phase 0
and Phase 1 (TODO.md numbering), belonging to neither and scheduled by nothing.**

**Reasoning.** It has no dependency on any phase — §19 established that it needs no
migration, because several people at one company already works on `profiles.company_id`.
Something that depends on nothing cannot be ordered by its dependencies, so it was never
next, and a thing that is never next is never built.

Placing it as a module makes it comparable to the other seven: it competes for a slot on
value rather than drifting because nothing blocks it. That is also the honest reading of
§17.4 — it was deferred because it is not the most valuable week available, which is a
judgement that should be re-made against a list rather than assumed each time.

**Account is a new module, and the eighth.** There was no Account module to add it to; the
existing `/api/account` and `/api/account/export` work and are verified, so M8 is
substantially this one feature plus whatever that pair accumulates.

**The cost of waiting is recorded in M8.2 rather than left implicit**, because it is the
kind of cost that is invisible until it is permanent: shared logins are accepted, every
write records one person's id regardless of who acted, and **records created that way stay
ambiguous forever.** Shipping the invite flow later fixes every subsequent row and no
earlier one. So the price of deferring is not a late feature — it is a window of the
customer's history that cannot be reconstructed, in a product whose value is the
reconstruction.

**Reversal condition:** the first customer who needs two named people with separate
accountability. §17.4 already names that as the trigger, and it is not a nice-to-have
request — it is the product's core claim.

---

## 27. How the product speaks when something fails — 11 September 2026

**Decision: every message the user sees is polite, plain, and honest about whose problem it
is. The operative rule lives in `CLAUDE.md` §5.1, beside the error-handling rules it
extends.**

- When the failure is the product's — a file it cannot read, a service that did not
  respond, a parse that failed — **say so plainly and never imply the user did something
  wrong.**
- **Never assert anything about a document the product did not successfully read.**
- **Always tell the user what they can do next**, if there is anything.
- **Error messages, empty states and refusals alike.** An empty state is a message.

### Why in `CLAUDE.md` §5 and not §3

§3 holds the non-negotiables about **code**: secrets, the security boundary, migrations,
the AI call site. This is a rule about **what the product says**, and §5 is already the
error-handling section — *"never silent"*, `response_message` in plain language always
written on success and failure, `error_message` technical. §5.1 is the tone-and-ownership
half of the rule §5 already half-states. Filing it under §3 would separate it from the
mechanism it governs.

It is in `CLAUDE.md` at all, rather than only here, because that file is read at the start
of every session and this needs to be in the room while the message is being written — not
looked up afterwards. This section holds the reasoning; that one holds the rule.

**`WORKSPACE.md` §10.8 is the same rule, scoped.** It works out per-case wording for the
three signup-scan failures and opens with *"two of these are the product's problem, not the
user's, and should not read as the user failing."* §5.1 generalises it; §10.8 stays the
worked pattern. Neither duplicates the other.

### The worked example, and why it is worth keeping

> `alert('No compliance dates found in this file. Make sure it contains deadline or expiry dates.')`

Shown by `/calendar` for a document that `/api/extract-dates` had **rejected before any
date-finding ran.** In one sentence it:

1. **asserted a fact about contents nobody had read** — there may well have been dates in it;
2. **implied the user's file was the problem**, when the product's own format support was;
3. **told them to go and check something that was never the cause.**

**The cause was structural, not careless wording.** "No dates in it" and "could not read it"
came back as an identical empty array, so the caller *could not* tell them apart — the
honest message was unavailable at the point it needed to be said. That is the general shape
of this failure: **a message lies because the data behind it cannot express the truth.**

So the rule has a design consequence, not only an editorial one: **when a call can fail in
ways that need different things said, the response has to carry which.** Fixed 11 Sep by
adding `extraction_failed` with a `reason`, and by giving the generic `catch` its own
`reason: 'extraction_error'` so "something broke at our end" is distinguishable from both
the others.

**Reversal condition:** none. If following it ever produces a message that is accurate and
useless — "something went wrong, there is nothing you can do" — the answer is to make the
failure actionable, not to soften the message into a claim that is not true.

---

## 28. What actually feeds a document prompt — 11 September 2026

**Decision: one shared parser, `lib/documentContent.ts`, feeds every route that sends a
document to the model. Excel, CSV, text, Word and PowerPoint are converted to text and
sent. Formats that cannot be read produce a described failure, never a silent omission.**

This is a `CLAUDE.md` §3.1 change — *"what data or context feeds a prompt"* — and it is the
largest one this project has made. It is recorded here because §3.1 says such changes are
discussed first, and because the two findings behind it are worth more than the fix.

### 28.1 `/api/chat` answered from the filename alone

For every upload that was not a PDF or an image, the route fell through to:

```js
messageContent = 'File name: ' + fileName + '\n\nUser question: ' + userQuestion
```

**The document's contents never reached the model.** The answer came back confident,
well-formatted and built from a filename.

**What makes this more than a missing branch: the file pickers actively offered those
formats.** `/compliance` offered `.xlsx .xls .csv .doc .docx`; `/upload` offered
`.xlsx .xls .csv`. A user was invited to upload a spreadsheet, did so, asked a question
about it, and was answered by a model that had been told only what the file was called.
Nothing in the product said otherwise. The fallback branch was the oldest code in the
route and had simply never been revisited when the pickers were widened.

**The general shape, which is the part to carry forward: an `else` branch that produces a
plausible result is more dangerous than one that throws.** A throw gets found on the first
test. A plausible result gets found when somebody wonders why an answer about a
spreadsheet never mentions anything in the spreadsheet.

### 28.2 `/api/hr` excluded `.docx` and blamed the format

`/api/hr` accepted PDFs and images only. Everything else was refused with:

> *"…which cannot be read here. Only PDFs and images can be. Re-upload it as a PDF."*

**The parsers existed the entire time.** `/api/extract-dates` had been reading Word, Excel,
CSV and PowerPoint for as long as `/api/hr` had been rejecting them, and `/api/audits` read
Word and PowerPoint successfully. The restriction was a **workaround for one specific bug**
— a `.docx` had once been base64'd and labelled `image/jpeg`, which produced confident
nonsense — and the workaround was then written into the code comment as though it were a
property of the format.

**Most handbooks are `.docx`.** So the HR module's core input was the one thing it refused,
the user was told their file was unreadable, and the true cause — a mislabelled upload,
fixed long ago — was invisible. A workaround that is documented as a limitation stops
looking like a bug and starts looking like a design.

**The rule this earns:** when a format, a feature or a case is disabled as a workaround,
**record it as a workaround with the cause**, not as a property of the thing disabled. The
comment is what tells the next person whether to fix it or respect it.

### 28.3 Four copies of the same branching, no two alike

`/api/chat`, `/api/audits`, `/api/extract-dates` and `/api/hr` each carried their own
version. `extract-dates` read five formats, `audits` four, `hr` two, `chat` effectively two
with a silent fallback. **Four copies is four chances to disagree, and they took all four.**
`lib/documentContent.ts` is now the only implementation; `lib/acceptedFiles.ts` holds the
picker list so the three file inputs cannot drift apart again.

`text/plain` is new — it existed in none of the four, which is why a `.txt` reached the
model as a filename and nothing else.

**Reversal condition:** if a format proves to parse badly enough to be worse than refusing
it — a scanned PDF-in-Word, say — it may be removed from the accepted list. It must then be
removed from `ACCEPTED_FILE_TYPES` too, so the picker stops offering it, and the reason
recorded here. Disabling it in the parser alone recreates §28.1 exactly.

---

## 29. An unmatched requirement is a library candidate, not a new version

**Decision, 11 September 2026: when the pipeline produces a requirement that is not in the
library, it is written to `library_candidates`. It is NOT written to
`requirement_templates` as a new row, and it is NOT written as a new version of an
existing row.**

**Reasoning.** The two look similar and mean opposite things.

**A version** (`version + 1`, `supersedes_id`, `effective_to` on the old row) asserts that
**the law changed** — that a rule we had recorded is now superseded by a different rule. It
is a claim about the world, it goes into the match key, and an audit pinned to a version
stays reproducible against it (§3.2).

**A candidate** asserts only that **a model said something we do not have a row for.**
That is a statement about our coverage, not about the law. It has no citation anybody has
checked, no jurisdiction anybody has confirmed, and no verification status a person has
set.

**Writing a candidate as a version would put unverified model output into the library
under a version number**, where the versioning machinery would then treat it as
authoritative: it would resolve into obligations, appear in a customer's requirement list,
and be indistinguishable from a row somebody had actually verified. That is the omniscient
status tracker (`CLAUDE.md` §6) arriving through the back door of a schema field.

`library_candidates` exists precisely so the pipeline has somewhere honest to put these:
`times_seen` counts how often one is produced, `normalized_name` dedupes across phrasings,
and the queue becomes usage-ranked demand research (§6). A candidate becomes a
requirement only by a person promoting it — `promoted_to_requirement_id` records when that
happens.

**Reversal condition:** none for the direction. If promotion ever needs to be automatic —
it should not — the gate is `verification_status`, never the absence of a check.

---

## 30. A customer-facing "what changed" view is M6 work, not pipeline work

**Decision, 11 September 2026: the diff a customer sees — what changed in their
obligations since last time — belongs to M6 (Dashboard). It is not part of the resolution
engine and must not be computed at resolution time.**

**Reasoning.** The data to answer it already exists once Phase 1's columns are populated.
`obligations` carries `applicable_from` and `applicable_to`, so "what became applicable"
and "what stopped applying" are a query over a date range. `obligation_evidence` carries
`valid_until`, so "what expired" is another. Nothing needs to be computed and stored at
resolution time, and storing it would be a derived copy — the same mistake §21.3 rejected
for `at_risk` and `expiring_soon`.

**Why M6 and not Phase 4.** Resolution's job is to produce the current list, deterministically
(§3.2). A diff is a *presentation* of two states of that list. Putting it in the engine
would give the engine a second responsibility and a reason to keep history in a shape
convenient for display rather than for correctness.

**What M6 must get right when it is built:** the diff is the honest half of the dashboard.
A number that only climbs is a progress bar; **"three things became required this month and
one certificate expired" is the sentence a customer actually needs**, and it is only
possible because obligations are never deleted (§3.2) and carry a validity window.

**Reversal condition:** if the query proves too slow to run per page load at real data
volumes — unlikely at a few hundred obligations per company — the answer is a materialised
view or a cache with an explicit staleness window, not a column written by the resolution
engine.

---

## 31. The two plans keep their separate phase numbering — 11 September 2026

**Decision: `TODO.md` and `BUILD-PLAN.md` are NOT renumbered. The mapping table at the top
of both stays, and is the fix.**

They agree on Phase 0 and Phase 4 and on nothing else. Most sharply, **phases 1 and 2 are
swapped**: `TODO.md` Phase 1 is the schema rebuild and `BUILD-PLAN.md` Phase 2 is; `TODO.md`
Phase 2 is the runtime pipeline and `BUILD-PLAN.md` Phase 1 is.

**Reasoning — three things, and the third is the one that decided it.**

**The risk is flagged, at the top of both files, and has misled no one.** The mapping table
is the first thing either document shows, above the gate in one and above Part A in the
other. Every phase reference written since has been correct.

**`BUILD-PLAN.md` alone carries 53 `Phase N` references**, and `TODO.md` and this record
carry more. Renumbering means rewriting all of them and every cross-document citation that
points at them. The mapping is one table read once; the churn is a few hundred edits, each
of which can be wrong.

**A renumbering pass during Phase 2's checkbox work is exactly where reference errors get
planted.** Phase 2 is the runtime pipeline — dozens of items ticked off across both files
over days. Doing a global renumber in the middle of that means every edit lands in a
document whose numbering is in motion, and a reference typed against the old scheme reads
as valid. `DECISIONS.md` §15.8 records the same failure from versioned filenames: renaming
breaks every reference silently, and silence is the problem.

**Reversal condition — and it is a real one, not a formality: unify them the first time the
mapping actually misleads somebody.** Not the first time someone finds it awkward. A wrong
phase acted on, a task started in the wrong document, a reference written against the wrong
scheme — any of those, and the churn becomes worth paying. The table's whole justification
is that it works; if it stops working it has no other defence.

**Interim mitigation applied the same day:** the ambiguous bare `Phase N` references in this
record are tagged `(TODO.md numbering)` so a reader need not resolve them from context.
Records written before the two schemes diverged in usage all meant `TODO.md`'s.

---

## 32. Washington agencies wait for the Washington library — 11 September 2026

**Decision: Phase 2.1 loads Oregon and federal agencies only. None of
`CHEMICAL-OR-WA.md` §1.4's Washington regulators — L&I/DOSH, Ecology, Revenue, the
rest — goes into `agencies`, and therefore none appears in `industry_coverage`.**

**Reasoning, and it cuts against the table's own default.** `industry_coverage` exists to
show gaps: a `not_built` row for an agency we have not covered is the honest, useful row,
and §1.1's second job — "a thinly-covered agency in a known list is a visible gap" — argues
for loading every regulator we can name, covered or not. By that reasoning Washington
belongs in.

It does not, for one reason: **the coverage strip's job is showing gaps in what we are
trying to serve.** The library holds 93 Oregon state rows and **zero** Washington rows, and
no Washington library is scheduled this quarter. A dozen permanently-`not_built` Washington
rows would make the strip longer without making it truer — the reader learns "we have not
built Washington", which they already knew from the fact that Washington is not sold. A gap
is only information when somebody was expecting the thing to be there.

**Reversal condition — specific and near: they go in the day the Washington library starts.**
Not when a Washington customer signs up, not when §1.4 is reviewed. The moment the first
Washington requirement row is written, its regulator must already exist as a row or the
requirement has nowhere to point, so the agency load is the first step of that work rather
than a follow-up to it.

**One thing to carry forward when that happens.** §1.4 records that Washington is a State
Plan state like Oregon, that its dangerous-waste program under WAC 173-303 is *broader than
federal RCRA*, and that its PSM rule is not a copy of 29 CFR 1910.119. Those are row-level
facts belonging in each Washington agency's `notes`, exactly as the Oregon State Plan fact
sits on the `OR-OSHA` row rather than in a prompt template (`CLAUDE.md` §7).

---

## 33. A CFR title is not an agency — the part is. A near miss, 11 September 2026

**What happened.** The Part C mapping table assigned a regulator to each of 194
requirements from the pair `(jurisdiction_layer, citation)`. One of its rules read
`federal + "29 CFR" → OSHA`. It was reviewed, approved, and wrong.

**Title 29 is the whole of Labor, not OSHA.** OSHA occupies parts 1904, 1910, 1915, 1917,
1918, 1926 and 1928. The rest of the title is other agencies entirely:

| 29 CFR | Belongs to |
|---|---|
| part 516 | wage and hour — **DOL** |
| part 825 | FMLA — **DOL** |
| part 2520 | ERISA reporting — **DOL** |
| part 1602 | EEO-1 — **EEOC** |
| part 1636 | Pregnant Workers Fairness Act — **EEOC** |

**Six requirements would have been filed under the Occupational Safety and Health
Administration**: the FLSA, the FMLA, ERISA, Title VII, the PWFA and EEO-1 reporting.

**Why it would not have been caught.** *A requirement under a wrong agency looks entirely
normal.* Nothing complains. The foreign key is valid, the row renders, the count is right,
`npm run check` passes, and no constraint in the database expresses "the FMLA is not an OSHA
rule." The failure surfaces only at Stage 2, where the agency frame bounds what the model is
asked to enumerate — so a chemical company asking about workplace safety would have been
served ERISA obligations under the OSHA heading, and a question about family leave would
have found nothing under Labor. **It is silent in exactly the way `CHEMICAL-OR-WA.md` §1.1
says agency framing is supposed to prevent.**

**How it WAS caught, and this is the transferable part.** The mapping was **projected over
all 194 rows read-only, and the result read agency by agency, before a single row was
written.** The projection showed six employment statutes sitting under `OSHA`, which is
visible in one line of output and invisible in a rule that looks right. The same pass caught
a second error — a Paid Leave rule swallowing a BOLI posters requirement.

**Two rules follow.**

**1. A CFR title is not an agency; the part is.** Any rule keyed on a bare title —
`29 CFR`, `21 CFR`, `40 CFR`, `49 CFR` — is wrong unless the title happens to have one
occupant. 49 CFR is DOT but splits: parts 100-185 are PHMSA, 350-399 are FMCSA. 21 CFR
covers both FDA and DEA. Write the part.

**2. Project before assigning, and read the projection by target rather than by count.**
"187 of 194 assigned" was true of the broken mapping and of the fixed one. The error was
only visible in *which rows landed where*. A total is not a check.

**Reversal condition:** none. This is a finding, not a preference. The narrower rule costs
nothing — rule 21 now matches zero rows, because every piece of OSHA content in this library
sits on an Oregon row, and that is a true fact about the library rather than a broken rule.

---

## 34. Correction to §4: the schema did not lack a question slot — it had the wrong kind

**Decided 11 September 2026. §4's account of the 2.5L root cause is wrong in a way that would
have produced the wrong fix.**

**What §4 says.** Root cause 1: *"Output schema foreclosed the right answer. No slot for 'I
need one more fact first.' A model asked to fill a checklist fills the checklist."*

**What is actually in the schema.** `prompts/checklist.ts` has carried a question slot the
whole time:

```
"follow_up_questions": [
  "A specific follow-up question that would make this checklist more tailored to their situation"
]
```

And `SUBSTEPS_PROMPT` carries another — a per-step `is_determination` flag with a
`clarifying_questions[]` array beside it.

**So the fix §4 implies — "add a question array" — was already done, and the failure happened
anyway.**

### 34.1 Additive and alternative are different things that look the same in a schema

Both are *a place to put a question*. They mean opposite things.

**An ADDITIVE slot sits after the answer** and means *"produce the checklist, then suggest
refinements."* `follow_up_questions`' own description says so: questions that *"would make
this checklist more tailored."* Substeps is sharper still — its questions are asked **after
the step has been written**, which is the gate inverted.

**An ALTERNATIVE slot replaces the answer** and means *"do not produce the checklist; this is
what I need first."*

A model filling an additive slot has already written the checklist by the time it reaches the
question. **The second half of the sentence cannot undo the first half** — that is root cause
2, autoregressive lock-in, and an additive question slot feeds it rather than fighting it.

**The one gate-shaped output in this codebase was built for something else.**
`auditClassifyPrompt` returns `type: "needs_clarification"` with a single
`clarifying_question`, and `app/api/audits/route.ts` short-circuits on it. That is Stage 1 in
miniature, arrived at accidentally while classifying audit requests — and it is the shape 2.2
generalises rather than invents.

### 34.2 The fix is a discriminated union, not a field

`outcome: 'ask' | 'answer'`, mutually exclusive at the top level. Not `ask` alongside
`must_do`: a model that populates both produces a checklist with a question above it, which is
the 2.5L failure with a banner on it.

**And `follow_up_questions` and `clarifying_questions` are REMOVED rather than left in place.**
Two places to put a question, with different meanings, means the model uses both. The
`needs_clarification` path in `auditClassifyPrompt` stays until the gate is wired into
`/api/audits`, then collapses into it — removing it first would leave that route with no gate
at all.

### 34.3 The transferable lesson

**When a schema permits the wrong answer, the fix is usually removing a field rather than
adding one.** The same move appears twice more in the gate spec: the checklist path gets **no**
`conditional_on` field, so hedging becomes unrepresentable rather than discouraged; and `ask`
is an **object** rather than an array, so the one-question cap is structural rather than
instructed.

Each is the same idea — *make the wrong output impossible to express* — and each replaces an
instruction a model under pressure can reinterpret. `DECISIONS.md` §27 reached the same
conclusion from the other end: when a call can fail in ways needing different messages, the
response must carry which, because a shared empty result makes the two indistinguishable.

**Reversal condition:** none for the union. If a genuine need appears for an answer that also
asks — it should not — it is a second request, not a second field.

**What §4 keeps.** Its other three root causes stand unchanged, and its governing principle —
excellent against an artifact, unreliable from nothing — is the most load-bearing sentence in
this record. Only the first root cause is restated.

---

## 35. Two corrections to the determination-gate spec, both found by building it

**11 September 2026. Both errors were mine, both were in `DETERMINATION-GATE.md` v1, and
both were caught between writing the spec and finishing the code.**

### 35.1 The `/api/chat` authentication closes ONE route, not four

**What the spec said:** adding `requireCompany()` to `/api/chat` "closes four of the six
routes named in `TODO.md` §0.8b as a side effect."

**What is true:** §0.8b names six routes with no session check. Two — `/api/industries` and
`/api/signup` — are **documented deliberate exceptions** (§0.9), because both serve the
pre-login signup page. That leaves **four undocumented**: `/api/chat`, `/api/extract-dates`,
`/api/feedback`, `/api/scan-website`. This work closes **`/api/chat`. One of four.**

**Still open, and worth naming rather than leaving inside a corrected count:**
`/api/scan-website` still takes a URL from an unauthenticated request body and fetches it
plus sixteen guessed subpaths — the blind SSRF in §0.8b. `/api/feedback` still interpolates
caller input straight into an HTML email body with no escaping, and still sends from the
project's Resend account. `/api/extract-dates` still takes an anonymous model call.

**Why it matters beyond the arithmetic:** the instruction that followed said "verify the four
§0.8b routes it closes", which is my error propagating into somebody else's plan. **A wrong
count in a security record reads as progress and is the kind of thing nobody re-derives.**
`AUDIT-CHECKS.md` check 11 exists for exactly this class — every count a document asserts,
re-measured — and this is its first live example.

### 35.2 The gate could not see where the worksite is — and only the PROCEED test would have caught it

**What the spec said the gate reads:** the question, the uploaded document, `company_switches`
for established facts, and `switches` for the vocabulary. It listed `requirement_templates`
as deliberately excluded and argued that case at length.

**What it omitted:** `entities`. **Jurisdiction — state, county, city — is not in
`company_switches` and never will be**, because it is a property of a *site* rather than of a
company (§20), and it has lived on `entities` since migration 009.

**The consequence, had it shipped:** the gate would have asked *"where is your worksite?"* —
a fact **migration 010 guarantees every company already has**, and one that §25 says comes
from **geocoding rather than from asking**. That is `DETERMINATION-GATE.md` §7's persistence
failure — the gate asking for something already established — arriving on day one, for **the
single most frequently determining fact in the product**. Jurisdiction is in the match key
for every requirement the library holds.

**How it was caught, and this is the part worth keeping.** It was not caught by review, by
typechecking, or by the acceptance test. **It was caught by writing the second golden case —
the one that proves the gate does NOT ask when it should not.**

Case 001 tests the ask direction. It passed with the bug present, and would have kept
passing: a gate that asks too much still asks for the SDS. **Only a case asserting "this
question must NOT produce a question" could surface a gate that asks for something it already
knows.**

> **Testing only the direction you are building for finds nothing about the direction you are
> not.**

The 2.2 work was entirely about making the product ask. Every instinct while building it was
pointed at the ask path: the prompt, the schema, the card, the round trip, the acceptance
criterion inherited from `DECISIONS.md` §4. The proceed path was the afterthought — and it
was the only thing that could find this.

**The general form, which applies well beyond this gate:** where a feature exists to make
something happen, the test that matters most is usually the one asserting it does *not*
happen in the ordinary case. A spam filter is tested by the mail that must arrive. A gate is
tested by the question it must not ask. `TESTING.md` (c) says the same thing about
consistency probes — *both answers cannot be right* is checkable without knowing which is.

**Reversal condition:** none. Both are corrections of fact. The standing rule is the second
one: **every gate-like feature gets a negative case in the golden set, written at the same
time as the positive one, not afterwards.**

---

## 36. The switch list was written before the library, and the library wins — 11 September 2026

**`CHEMICAL-OR-WA.md` §2.4 proposed 46 switches. Reading all 188 `trigger_condition` prose
strings in `requirement_templates` found that the list is wrong in both directions.**

| | |
|---|---|
| Requirements expressible with §2.4's list (+ §23.1's substance split) | **140 of 188** |
| Requirements needing a fact no switch covers | **48** |
| §2.4 switches no requirement uses | **6** |
| Facts needed that §2.4 has no switch for | **30** |

**The shape of the gap matters more than the count. Two whole classes were missing:**

**The equipment layer.** The library holds **23 requirements with `entity_type = 'equipment'`** —
forklifts, cranes, slings, ladders, fall arrest, sprinklers, extinguishers, alarms, emergency
respirators, hazardous piping. §2.4 proposed **not one switch for any of them.** They are the
cheapest facts in the whole list, mostly answerable by walking the floor, and they gate 23
requirements.

**The employment layer.** §2.4 was written for a chemical plant. The library carries a full
Oregon and federal employment layer — 16 BOLI rows, 6 DOL, 5 EEOC, plus IRS, USCIS, Paid
Leave Oregon, Workers' Comp and OregonSaves. Those need `has_employees`,
`nonexempt_employees`, `has_group_health_plan`, `sponsors_erisa_plan`, `federal_contractor`
and `uses_noncompete_agreements` — none a chemical fact, all required.

**Seeded: 90 switches.** *(95 as of 12 Sep — Phase 6.3 added the five its own conditions needed. The reasoning below is unchanged.)*

### 36.1 `employee_count` is a number, and bands do not merely lose precision

**§2.4 proposed bands: 1-10 / 11-19 / 20-24 / 25-49 / 50-99 / 100+.**

The trigger prose names **seven** distinct thresholds: **6, 10, 15, 20, 25, 50, 100.** A band
can only answer a threshold that falls on a band **boundary**. Three do not:

| Threshold | Falls | Gates |
|---|---|---|
| **6** | inside 1-10 | four Oregon accommodation and leave rows |
| **10** | inside 1-10 | the OSHA 300 log, the Emergency Action Plan, the Fire Prevention Plan |
| **15** | inside 11-19 | **the ADA, Title VII, and the Pregnant Workers Fairness Act** |

**A company in the 11-19 band is unresolvable against three federal discrimination statutes.**
That is not a rounding error — bands do not make the answer less precise, they make it
unavailable. `companies.employee_count` has been `integer` since migration 006, which
converted the text bands rather than inventing numbers from them.

**And it splits.** Oregon sick time reads *"10+ Oregon employees or 6+ with a Portland
location"* — enterprise and site in one sentence. WARN reads *"covered loss at a single
site"*. One switch cannot be both, so `employee_count` is company-scoped and
`site_employee_count` is site-scoped, and a row needing the site number names it in
`applies_expression`.

### 36.2 `naics_code` is not a switch

Five triggers turn on industry — TRI's "covered NAICS", the OSHA 300 log's "listed
industries" and "Appendix B", NESHAP subparts, categorical pretreatment. It still does not
become a switch. **`AUDIT-CHECKS.md` check 9 already names four free-text columns holding
industry strings with no shared list and no foreign key between any of them.** A fifth is
the wrong direction. It reads from `companies.industry` through
`determination_source = 'profile'`.

### 36.3 The six unused switches stay, and are marked

`multi_site` · `multi_state` · `owns_vs_leases_facility` · `hot_work_welding` ·
`spray_finishing` · `high_piled_storage`

Each carries **`SEEDED BUT UNUSED … DO NOT REMOVE AS DEAD WEIGHT`** in its `notes`, because
a future reader sweeping for unused rows would otherwise be right to delete them.

`multi_site` and `multi_state` become load-bearing the moment a customer has a second site or
crosses a state line, and migration 010 already gives every company a site row so the
structure is waiting. **The three fire switches are more interesting: they are the
`LOCAL-FIRE` coverage gap arriving from a second direction.** §1.3 names hot work, spray
finishing and high-piled storage as fire permit types; `LOCAL-FIRE` holds 3 library rows
against a much larger real scope (TODO 6.5a). The switches have nothing to gate because the
requirements were never written, not because the facts do not matter.

**Reversal condition — for the list, not for the method: replace the seed file wholesale
whenever the library grows a layer it does not cover.** The failure this records is not that
somebody chose 46 badly; it is that the list was written *before* the thing it describes.
The same will be true of the next vertical: a cannabis library will need switches nothing
here anticipates, and the correct move is to read its trigger prose and extend the seed, not
to reason about cannabis from first principles. **Derive from the library, never propose to
it.** The six unused switches come out only if a deliberate decision says the requirements
behind them will never be written — never as part of a sweep for dead rows.

---

## 37. `aboveground_storage_tanks` is the inventory; the gallons are computed — 11 September 2026

**The dependency direction, and the check that makes it enforceable.**

Two switches each have a locally correct reason to depend on the other:

- `oil_storage_aboveground_gallons` cannot be known without knowing the tanks. → depends on
  `aboveground_storage_tanks`.
- The AST inspection requirement's trigger reads **"ASTs subject to SPCC"**, which argues
  `aboveground_storage_tanks` depends on the SPCC quantity. → depends the other way.

**Read in isolation, both are right. Together they cycle.**

**Decision: tanks are the INVENTORY fact and gallons are COMPUTED from it. One edge, one
direction.** The AST requirement's "subject to SPCC" condition belongs in
`applies_expression` — it is a condition on the *requirement*, not a dependency between
*facts*. A switch dependency answers "which fact do I need first"; you need the tanks first,
always.

### 37.1 No constraint can catch a cycle, so the loader does

`switches_no_self_dependency` checks `depends_on_switch IS DISTINCT FROM id`. **That stops
`A → A` and nothing else.** `A → B → A` satisfies every foreign key, satisfies that CHECK on
both rows, and is accepted by the database.

A cycle is not expressible as a CHECK — detecting one needs recursion and a CHECK sees one
row at a time. A trigger with a recursive CTE would work and would re-walk the whole graph on
every write; `switches` is written by exactly one thing. **So the check lives in
`scripts/load-switches.js`, walks the graph depth-first, reports the whole cycle rather than
"a cycle exists", and refuses the file rather than loading half of it.**

**Why a cycle is worse than it sounds:** it makes the graph unwalkable. Nothing can decide
which fact to establish first, so the determination gate would either loop or pick
arbitrarily — and picking arbitrarily is the failure that looks like working software.

**Proven by seeding one**, per `AUDIT-CHECKS.md`'s standard — `--prove-cycle-check` runs four
cases in memory: the real file (0 cycles), **the real pair reversed** (refused), a three-node
cycle (refused, showing it walks the graph rather than comparing pairs), and a four-deep
chain with no cycle (correctly allowed, so it is not just flagging depth).

**Reversal condition on the DIRECTION:** if a requirement is ever written whose trigger turns
on the SPCC quantity in order to establish whether tanks exist — which would be strange, and
is the only thing that would justify the other arrow — the edge flips and the AST condition
moves out of `applies_expression`. Nothing in the current library asks for that.

**No reversal condition on the CHECK.** A cyclic dependency graph is unwalkable, not merely
untidy: nothing can decide which fact to establish first, so the gate would either loop or
pick arbitrarily — and picking arbitrarily is the failure that looks like working software.
If the check ever becomes expensive enough to matter (it is O(n) over ~90 rows), it moves to
a trigger with a recursive CTE. It does not get removed.

---

## 38. Switch scope and volatility — three decisions and one recorded approximation

### 38.1 `exposure_*` is `annual`, not `static`

**`static` asserts that a fact does not change. Exposure changes whenever the process does.**
Every substance standard in the library mandates periodic monitoring — *"initial and periodic;
annual training; medical at least every two years"* — and **a lead result from four years ago
is not evidence of today's exposure.** Fourteen switches become things that expire, which is
the point: an expired switch reverts to `unknown`, and `unknown` is honest where a stale
`false` is a false green.

### 38.2 The scope flattening is a decision, not an oversight

**`requirement_templates.entity_type` has five values. `switch_scope` has two.**

| entity_type | live rows | resolves to |
|---|---|---|
| `organization` | 104 | `company` |
| `chemical` | 27 | `site` |
| `person` | 26 | `site` |
| `equipment` | 24 | `site` |
| `site` | 19 | `site` |

*Re-measured 12 Sep 2026, both environments. The previous table read 98 / 27 / 27 / 23 / 19 —
194 rows, the library as it stood before migration 013 split three requirements into eleven.
The proportions are unchanged and so is the decision; the counts were stale by one migration.*

**`person`, `equipment` and `chemical` all resolve to the site where they are.** This is
lossy and deliberate, and it is written down here so that a future session reads it as a
decision rather than as something nobody noticed.

**Where the loss actually bites: the 14 `exposure_*` switches.** Exposure is a property of
**a person doing a task** — the lead standard turns on whether *this worker* is above the
action level, not whether the site is. `switch_scope` cannot express that. Site is the honest
floor: "is anyone at this site above the action level" is weaker than the standard, and it is
the strongest thing the schema can hold. **Recorded rather than absorbed**, because the day a
customer asks why a warehouse worker is being asked about lead, this is the answer.

**Reversal condition:** if a requirement ever needs per-person resolution — a medical
surveillance roster, say — `switch_scope` gains a third value and `company_switches` gains a
person reference. That is a migration, not a workaround.

### 38.3 The scopes settled, and the two that moved

`owns_fleet` and `cdl_drivers` are **company**-scoped: a fleet is an enterprise asset and
FMCSA registration is enterprise-level. Per-vehicle facts belong to the equipment layer.

**`entity_county` is dropped entirely.** Migration 009 put the authoritative county on
`entities`, and a switch would be a fifth free-text place for a jurisdiction to disagree with
itself. The gate reads it from `entities` directly (§35.2).

**`outdoor_work` splits into `heat_exposure_area` and `wildfire_smoke_exposure`, and the name
was the bug.** §2.4 justified one switch as covering "heat and wildfire smoke rules". Oregon's
heat rule triggers on **"work area heat index reaches 80°F"** — *indoor areas included*. The
name `outdoor_work` encoded an assumption the rule does not make, and **a foundry with no
outdoor work would have been told the heat rule did not apply to it.** They are also two
separate rules with separate triggers and separate controls, and Washington's thresholds
differ from Oregon's on both.

---

## 39. The critic reports; it never regenerates — 12 September 2026

**Decision: Stage 5 surfaces findings and code applies them by severity. It never loops back
and never regenerates, and this holds after Stage 4 exists.**

`CHEMICAL-OR-WA.md` §5.2 says *"material error → one loop back to identification"*.
Identification is not built, so today the only thing to loop back to is the whole generating
call. But the decision is not about what is available.

**A silent fix destroys the evidence.** `TESTING.md` (b) says the golden set grows by one
entry per failure found. **A self-healing loop means no failures are ever found** — the suite
stops growing, and quality comes to depend on a loop nobody measures. The 2.5L failure is in
the golden set *because* somebody saw it.

Three further reasons: a regenerate has nothing new to work with, so it is `DECISIONS.md` §4's
autoregressive lock-in dressed as a fix; the finding is more useful to a plant manager than
the fix (*"this assumes you ship in your own vehicles — you didn't say that"*); and two model
calls agreeing is agreement, which `TESTING.md` (c) already names as not verification.

**Three outcomes, decided in code from severity, never by the critic choosing to loop:**
`blocking` withholds the item and says why — **an empty checklist with a reason is more honest
than a second guess**; `qualifying` shows beside the answer; `coverage` surfaces as a gap.

**Reversal condition:** if a blocking finding is ever produced at a rate that makes checklists
routinely empty, the answer is better generation or a stricter gate, not a repair loop.

### 39.1 It runs on every answer, gated only by output type

`checklist` and `audits` always · `research` not until it is structured · `substeps` never.

**The complexity threshold is rejected, and the reason is the failure itself: the 2.5L case
was two sentences about labels.** Fluent, confident, well-structured, and wrong about the
central fact. **Any complexity heuristic skips exactly the case the critic exists for** — and
"only on complex answers" asks the model to judge its own output, which is the same class of
thing as a model setting its own `verified` flag.

**And the anchoring threshold runs it MORE where the library is thin** — every cannabis
question (25 coverage rows at `row_count = 0`) and every question hitting the six empty Oregon
agencies. That is backwards from the cost instinct and correct on the merits: the thinner the
anchor, the closer the answer is to free enumeration.

**Cost, measured:** ~44s on a verified-correct answer and ~100s on the 15-item 2.5L artifact,
on the strongest tier. That is a real addition to a 42-second generation.

---

## 40. Two model facts that were taken from memory and were wrong — 12 September 2026

Both were found by running the thing, both in one sitting, and both are recorded because the
second is a latent bug that predates the work that surfaced it.

### 40.1 `claude-opus-4-1` does not exist on this account

The first version of the critique tier named it as the strongest model. The first run returned
`404 not_found_error`. **Probed rather than recalled**, 12 Sep: `claude-opus-5`,
`claude-sonnet-5`, `claude-fable-5-1`, `claude-haiku-4-5-20251001` and `claude-sonnet-4-5` all
answer; `claude-opus-4-1` and `claude-opus-4-20250514` do not, the latter being past
end-of-life. The tier is `claude-opus-5`.

**The rule:** a model identifier is a fact about an account, not about the world. Check it the
way a constraint name is checked (`CLAUDE.md` §3.7) — from the thing itself, never from
memory or from a prior migration file.

### 40.2 The Claude 5 family REJECTS `temperature`, and six call sites pass it

Not ignores — a **400**: `` `temperature` is deprecated for this model. ``

```
claude-opus-5              REJECTS      claude-haiku-4-5-20251001  accepts
claude-sonnet-5            REJECTS      claude-sonnet-4-5          accepts
claude-fable-5-1           REJECTS
```

**This was a latent bug before task routing existed, and routing only surfaced it.** Six call
sites pass `temperature: 0.1` — the determination gate, both audit classify calls, the audit
match call, document review. **Setting `AI_MODEL=claude-sonnet-5`, which reads like an
ordinary upgrade, would have 400'd every one of them** and left the gate returning nothing on
a route that had no way to say so.

**Fixed by dropping the parameter for models that do not take it, not by erroring.**
Temperature 0.1 means *be deterministic*; those models are deterministic by default, so the
intent survives and only the knob is gone. Logged once per call so it is greppable rather than
silent. Matched on the major version immediately after the tier name, so `claude-sonnet-4-5`
and `claude-haiku-4-5-…` are correctly excluded.

### 40.3 A thinking model spends the answer budget on thinking

The spec proposed `maxTokens: 3000` for the critic. On `claude-opus-5` that returned **no text
at all** — one empty `thinking` block and `stop_reason: max_tokens`. Thinking is drawn from
the same budget as the answer. `askAI`'s automatic doubling would have recovered it at the
cost of two wasted calls per review; the budget is 12,000 instead.

**A reviewer that reasons before answering is exactly what the tier was chosen for. The budget
has to pay for the reasoning as well as the findings.**

---

## 41. The gate established facts the generator never saw — 12 September 2026

**A pipeline bug, found by a model comparison rather than by a bug report.**

The determination gate runs, establishes what is known about the company, and returns
`g.resolved`. **That object went into the HTTP response and nowhere else.** The generating
call received `buildSystemPrompt(mode, scanResult)` and the raw question. Nothing about what
the gate had just determined reached the model writing the answer.

**So the product was asking the model to answer questions it had already answered for
itself.**

### 41.1 How it surfaced

A benchmark comparing two models on generation. Case 003 asks *"what minimum wage do we have
to pay at our Hillsboro plant?"* for a company whose primary site the gate resolves to
**Hillsboro, Washington County, Oregon**.

**One model produced an Ohio minimum-wage branch** — *"Pay Ohio minimum wage if plant is in
Hillsboro, Ohio"*. Hillsboro, Ohio is a real place. **The other refused to name a rate at all**,
titling its answer *"Jurisdiction Not Yet Confirmed"* and asking the user which state the plant
was in.

**Both were reasonable answers to a question nobody had told them was settled.** And both were
marked `blocking` by the critic — correctly, because the critic *was* given the established
facts and could see that the answer asked for one of them.

**That asymmetry is what made the bug visible: the critic saw the facts, the generator did
not.** Without a stage that reviews the output against what was known, nothing would have
distinguished "the model guessed" from "the model was not told".

### 41.2 The fix, and what it measured

`g.resolved.known` is now written into the generating call by
`establishedFactsBlock()` — **the same module the gate uses to phrase them, so a fact does not
change shape as it moves between stages.**

Case 003, re-run twice on each model, before and after:

| | blocking, before | blocking, after |
|---|---|---|
| `claude-sonnet-4-5` | 3, 3 | **1, 1** |
| `claude-opus-5` | 4, 5 | **0, 1** |

**Fifteen blocking findings became three.** Every "Jurisdiction Not Yet Confirmed" title became
*"Minimum Wage Requirements for Hillsboro, Oregon"*. The Ohio branch did not recur.

**And the three that remain are real, which is the better outcome than zero.** Two say Oregon's
Portland-metro rate is keyed to the **Metro urban growth boundary, not to county membership**,
and nobody has established which side of it Hillsboro sits on — a genuine missing fact, and one
`site_employee_count`'s neighbours in the switch library do not yet cover. The third says
Oregon requires the *greater* of daily or weekly overtime for manufacturing establishments.
**The noise cleared and the signal stayed.**

### 41.3 Why this is quality-affecting and was still the right call

Changing what data feeds a prompt is `CLAUDE.md` §3.1's first category and normally requires
discussion before it happens. It was discussed: the benchmark produced the evidence, the
finding was reported, and the change was directed. **Recorded here because the next version of
this — feeding the critic's findings back into a regeneration — is the one to refuse
(§39).**

**Reversal condition:** none for passing established facts. If a fact turns out to be wrong,
the error belongs upstream in determination, and the answer being confidently wrong for the
stated reason is better than being confidently wrong for an invented one.

---

## 42. Sonnet against Opus on generation, as measured — 12 September 2026

**Recorded as a measurement, not a decision. The default is unchanged: generation stays on
`claude-sonnet-4-5`.**

Three cases, two models, two runs each. **The critic was held constant on `claude-opus-5` in
all twelve runs** — it is the instrument, and an instrument that changes between measurements
measures nothing.

### 42.1 Opus is better on transport-shaped generation

| case | Sonnet blocking | Opus blocking |
|---|---|---|
| 001 — 2.5L bottles | 1, 4 | **1, 0** |
| 002 — isopropyl drums, SDS attached | 1, 1 | **0, 0** |

**Case 002 is the clean signal: Sonnet blocking in both runs, Opus in neither.** Sonnet's two
errors were real — a "Packing Group II marking" that 49 CFR 172.301 does not require, and the
duplicate-labelling rule applied below its 64-cubic-foot trigger.

**On case 001, Sonnet run 2 reproduced the founding failure verbatim** — the hazard label and
the 172.301 marking attached to the inner bottles rather than the outer case, plus UN-spec
packaging demoted to "good to have". Sonnet run 1 did not. **Opus made it in neither run.**

**Run-to-run variance is large: Sonnet went 1 → 4 on the same question.** One run of one case
would have shown nothing. Two runs is still small — but *"Sonnet reproduced the founding
failure and Opus did not, on the case built to elicit it"* is not a close call.

### 42.2 And it is roughly three times slower on the longest call the user waits on

| case | Sonnet | Opus |
|---|---|---|
| 001 | 29s, 39s | **127s, 115s** |
| 002 | 37s, 35s | **95s, 108s** |
| 003 | 21s, 22s | 52s, 67s |

**It compounds with the critic, which is already on Opus.** A case-001 request today is ~39s
generate + ~81s critique ≈ **2 minutes**. On Opus generation it is ~127 + ~151 ≈ **4.6
minutes**. Nobody waits 4.6 minutes for a checklist.

**Both facts are true at once, and that is the record: better answers, unusable latency.** It
is a product decision and not a quality one, and it should be revisited when either the latency
changes or the pipeline stops asking one model to do judgement and prose in a single call
(§42.4).

### 42.3 The shape to watch if the generator ever changes

**Every Sonnet blocking finding on the transport cases was a SCOPE error** — question 3, a rule
attached to the wrong physical object or a threshold applied below its trigger. That is exactly
the failure class the critic's five item-level questions were written against.

**Opus's one blocking finding across both transport cases was PROCEDURAL** — *an SDS sealed
inside the case does not satisfy 49 CFR 172.602; emergency response information must accompany
the shipping paper.* Not a scope error at all.

One instance is not a pattern. **But if the generator ever changes, the critic's questions must
be re-examined rather than assumed**, because they may be tuned to the previous model's failure
modes and simply stop finding things. **A critic that suddenly finds less is indistinguishable
from a generator that suddenly got better**, and only re-examining the questions tells them
apart.

### 42.4 The tier split this argues for: identification versus expansion

**Not work to do now — an argument for building Stages 4 and 6 separately when they are built.**

`CHEMICAL-OR-WA.md` §5.2 already separates them: **Stage 4 identification** decides which
requirements apply, to which physical object, under which regime, at temperature 0.1; **Stage 6
expansion** writes sub-steps, costs and contacts for the survivors. Today neither exists and
one call does both.

**The hard judgement is worth Opus; the prose after it is not.** Every finding in this
benchmark was about identification — wrong object, wrong threshold, wrong regime. None was
about the quality of the sub-step prose. So the latency objection in §42.2 is an argument
against Opus doing *both jobs in one call*, not against Opus.

Split them and the tiers already exist: `judgement` on the stronger model for a short
structured call, `prose` on the cheaper one for the long narrative. **That is the reason to
build them as two stages rather than one, recorded before either is written.**

**Reversal condition for the default:** revisit when Stage 4 and Stage 6 are separate, or when
the latency gap narrows. Not before — the measurement holds either way and the arithmetic is
the same.

---

## 43. `applies_expression` is nested JSON, and the renderer ships with it — 12 September 2026

**Decision: the format is nested JSON in `requirement_templates.applies_expression`; the
review artifact is one line of English produced by `render()` in `lib/appliesExpression.ts`.
Both are built in 6.3, not one then the other.**

**Why not a small DSL, which reads better.** A DSL needs a parser, a grammar, error messages
and a test suite — for 194 expressions that never exceed two levels of nesting. A malformed
DSL string is detectable only at evaluation time; malformed JSON fails on insert. And
`CLAUDE.md` §3.2 requires resolution to be deterministic, so a hand-written parser is the
most likely place for that to quietly stop being true. Postgres can also query inside jsonb —
*"which requirements reference `exposure_lead`"* is a containment query rather than a string
search, which is exactly what the determination gate's eventual swap needs.

**So: store the structure, review the sentence.** The owner is the verification step, and a
format that has to be parsed by a human before it can be checked makes that step theatre.
Same arrangement that already worked twice — the agency mapping reviewed as a table and
stored as JSON, the switch seed reviewed as a per-domain listing and stored as JSON.

### 43.1 Three-valued evaluation is the part that is not about format

`evaluate()` returns `true | false | unknown`. **An unset switch produces `unknown`, never
`false`** — `CLAUDE.md` §3.2, absence of evidence never produces a clear.

The truth table is deliberate and is the most dangerous thing in the file to get wrong:
**`unknown AND false` is `false`** (one branch already fails, so the conjunction cannot
succeed) but **`unknown AND true` is `unknown`** (we genuinely cannot say). Same shape for
OR, inverted. `substance_inventory()` returns SQL `NULL` for a site with no inventory for the
identical reason: a site that has not been asked is not a site determined to be below the
threshold.

### 43.2 What building the renderer found, in its first twenty rows

**Three faults, none of which a review of the JSON would have surfaced:**

1. **An expression referenced `worksite_city`, a switch that does not exist.** The Oregon
   sick-time rule turns on *"6+ with a Portland location"*, and the draft invented a switch to
   say so — after §38.3 had deliberately dropped `entity_county` so that jurisdiction would
   not become a fifth free-text place to disagree with itself. Caught by `switchesIn()`
   reporting a reference the seeded vocabulary did not contain. **Fixed by adding a
   `jurisdiction` node type**: site state, county and city are read from `entities`, not from
   a switch, and the format now has somewhere to say that.
2. **Enum clauses rendered worse than the raw identifier** — *"flammable liquids at or above
   the fire-code maximum is at_or_above_maq"*, the gloss and the enum value both. An `as`
   gloss now replaces the whole clause rather than renaming its subject.
3. **An expression had been written for a row that no longer exists** — `Process Safety
   Management`, retired by migration 013's split into five. Expressions must be written after
   splits land, not before.

**This is the argument for building the renderer before the 194 rather than after**, and it
is an argument from evidence rather than from taste: the JSON for all three faults was
well-formed, correctly typed, and wrong. *(Final count: 205 rows, 200 live, 199 conditions —
the renderer was built against the first twenty and carried the other 179.)* The general form
of the move is now `HOW-WE-BUILD.md` §3: build the review artifact before the bulk work.

**Reversal condition.** If the stored form ever becomes readable enough that a person can check
it directly — a flat DSL string rather than nested JSON — the renderer stops earning its keep
and the structure should be stored in the readable form instead. That is a real possibility for
a condition of two or three clauses; it is not one for the seven-clause conditions in this set.
The test is whether a reviewer would rather read the stored value than the rendered sentence.
**What would NOT reverse it: the loader getting better at validation.** Validation proves a
condition is well-formed. Every one of the three faults was well-formed.

---

## 44. A threshold in an expression must appear in the rule's own text, in that unit

**Decision, 12 September 2026: every number in an `applies_expression` must be findable in
that requirement's own `trigger_condition` or `citation`. If it is not, the expression is
asserting a number nobody wrote down.**

**The classic way to get this wrong is a unit conversion.** A threshold written in pounds,
restated in gallons, requires assuming a density — and **density is a property of one product,
not of the rule.** 260 gallons "is" 2,200 lb only for a specific liquid; for another it is not,
and the expression then triggers at the wrong quantity for every company holding anything else.
The same error one level up is what made `or_cr2k_threshold` a stand-in rather than a fact:
Oregon's rule is *5 gallons liquid, 10 pounds solid, 20 cubic feet gas*, which is three
dimensions and cannot be one number. Migration 013 stores `unit` beside `max_quantity` and
`substance_inventory()` compares only `lb` rows for precisely this reason.

**A second way, less obvious and caught on the first run: importing a threshold from a
neighbouring rule.** `thresholdsIn()` flagged **1,320** in `Oil Facility Response Plan
determination` — a real figure, from 40 CFR 112.1, belonging to the **SPCC Plan** row and not
to this one, whose own trigger reads *"SPCC facility meets substantial-harm criteria or EPA
requires plan"*. The number is correct about the world and wrong about the rule, which is the
hardest kind of wrong to see by reading.

**It also flagged 250** in the 20–249 employee band, where the rule text says `20-249` and the
expression said `< 250`. **That one is arguably fine and is still worth the flag** — writing
`<= 249` uses the rule's own number and costs nothing.

**Enforced by `thresholdsIn()`** in `lib/appliesExpression.ts`, which returns every numeric
literal an expression asserts, so the comparison can run in `npm run check` rather than
depending on a reviewer noticing.

**Reversal condition:** none. If a rule genuinely requires a derived number, the derivation
belongs in a named function with its assumptions stated — not inline in an expression where it
looks like a quotation.

### 44.1 The general form: a proxy is permitted; a proxy with a fabricated magnitude is not

**Strengthened 12 September 2026.** The rule above covers two forms — a unit conversion and a
number borrowed from a neighbouring rule. There is a third, and it is the most defensible-
looking of the three because the *proxy itself* is legitimate.

A rule says *"used in greater than 1% concentration"*. The vocabulary has no concentration
fact, so the expression substitutes a quantity — and invents a magnitude to go with it. **The
substitution is fine. The magnitude is fabricated**, because the rule names no quantity at all,
and the number now looks quoted when nothing quoted it.

**The full rule, in three parts:** a threshold in an expression must appear in the rule's own
text, **in that unit**, and **as that quantity**.

**What to do instead.** Use the proxy at its honest strength — *does the site hold this
substance at all* — and put the condition the vocabulary cannot reach into `scope_rules`,
marked as unresolvable from current data. That produces an expression that is broader than the
rule and says so (§44.3), rather than one that is narrower than the rule by an amount nobody
chose.

### 44.2 A clause true of every company is not a condition

**A conjunct that cannot be false constrains nothing and reads as though it does.** The way it
arises is an enum clause listing every allowed value — `business_type is one of [manufacturer,
blender, repackager, distributor, toll_processor]` — which looks like a restriction to a
business kind and is satisfied by every row that has a business type at all.

**It is worse than redundant: it makes an expression look more considered than it is**, and a
reviewer reading the rendered line sees a constraint being applied. Two expressions carried
this and both are now reduced to their real condition.

**The test:** if removing a clause changes no company's answer, it is not a clause.

### 44.3 Where the vocabulary cannot narrow, be deliberately BROADER — and say so

**Standing rule for a whole class, not a note on one row.**

Several requirements turn partly on a fact the vocabulary does not hold — most often NAICS
industry membership, which `DECISIONS.md` §36.2 deliberately kept out of the switch library.
`Electronic submission of Form 300A` reaches establishments *in a listed industry*;
`NSPS/NESHAP applicability` turns on source category, HAP, capacity and construction date.

**In every such case the expression omits the narrowing condition rather than approximating
it, and therefore triggers more often than the rule does.**

**That is the safe direction and it is the same argument as `CRITIC-PASS.md` §5's agency
list: a condition that is too broad produces a false positive a person can dismiss; a
condition that is too narrow produces a silent gap nobody sees.** Those costs are not
symmetrical, and the asymmetry is what decides it rather than a preference for caution.

**Two obligations follow from choosing this direction.** The row's `confidence` must record
that it over-triggers, so the breadth is a known property rather than a surprise. And the
resolution engine must be able to say *why* an obligation applied — because "we could not
check the industry" is a different sentence from "your industry is listed", and a user shown
the second when the first is true has been misled.

### 44.4 Two obligations that always co-trigger are one obligation

**The rule that distinguishes a real split from a wrong one**, recorded because the judgement
is easy to get backwards in either direction.

**Split when the two have different CLOCKS.** The boiler row split into registration, operating
certificate and periodic inspection because each runs on its own schedule and each can fail
while the others hold. The silica row split for the same reason — assessment, written plan,
medical surveillance and training are four schedules.

**Do not split when the trigger, the cadence and the evidence all arrive together.** Two
obligations that always become due at the same moment, on the same fact, evidenced by the same
document, are one obligation wearing two names — and splitting them doubles a company's
apparent burden without telling it anything new.

**The test, in order:** same trigger? same cadence? does the evidence arrive together? **All
three yes → one row.** Any one no → candidate for a split.

**Checked against the three splits in migration 013**, since the rule is worth nothing if it
is not applied to one's own work: `Electronic OSHA` has three *different triggers* (20-249,
100+, 250+). `PSM`'s five share a trigger but have five different clocks — before operation,
five years, inspection intervals, before change, three years. `Confined spaces` differs on both
— identification triggers on *containing* a space, entry and rescue on *entering* one, and the
clocks are initial, per-entry and annual. All three clear the test.

---

## 45. An unidentified chemical makes the answer unknown — 12 September 2026

**Found by checking a claim that a compensating control already existed. It did not, and the
control that was proposed would not have worked.**

### 45.1 The claim, and why it fails

The claim: every `substance_inventory()` expression sits beneath `hazardous_chemicals_present`,
so a wrong CAS number makes a requirement **unreachable** rather than **wrongly cleared** —
and that is why the CAS-matching risk is tolerable.

**Two things are wrong with it.**

**It is not true of the data.** **0 of the 15** inventory-backed expressions carry that guard.
`EPCRA emergency-planning notification` is `{ inventory: 'ehs' }` and nothing else; all five
PSM rows are `{ inventory: 'psm' }` bare.

**And adding the guard would not produce the claimed protection.** With
`hazardous_chemicals_present = true` and a CAS that matches nothing, the conjunction evaluates
`true AND false` = **false**. The guard only changes the answer when the guard itself is
unknown. **The protection has to live inside the function, where the missing identification is
visible — not in a conjunct above it, which cannot see why the inner clause said no.**

### 45.2 The hole this exposed, which is real

`company_chemicals.cas_number` is deliberately nullable: a company can record *"parts washer
solvent"* before anybody identifies it, and recording that is better than recording nothing.
But the function joins on CAS.

**So a site with ten identified chemicals and one unidentified drum had inventory rows, took
the `else` branch, and returned FALSE — which reads as determined not to apply.** A mistyped
but well-formed CAS does the same: `67-63-1` for `67-63-0` passes the format CHECK, matches no
row, and drops that substance silently out of every threshold test.

**That is a silent wrong clear, which is the one failure class this product exists not to
have.** An unidentified drum is absence of evidence, and `CLAUDE.md` §3.2 says absence of
evidence never produces a clear.

### 45.3 The fix, and the one thing it must not do

Migration 014 makes `substance_inventory()` return **NULL when any row in the site's inventory
is unevaluable** — no CAS, a CAS matching no known substance, no quantity, no unit, or a unit
that cannot be compared.

**But a positive answer is checked FIRST and survives an incomplete inventory.** If a known
substance is already over its own threshold, an unidentified drum elsewhere cannot make that
untrue. Without that ordering, every partially-identified site would go `unknown` and the table
would be useless until somebody had identified everything — which is never. **The asymmetry is
deliberate: an incomplete inventory can still say yes, and can no longer say no.**

Five behavioural tests in the migration, each constructing its case: empty → NULL, one row
below threshold → **false**, add an unidentified drum → **NULL**, raise a known substance over
its threshold → **true despite the drum**, unmatched CAS → **NULL**.

### 45.4 The rule this generalises to

**A compensating control has to be named and tested, or it is a belief.** This one was
plausible, widely assumed in the reasoning around it, false in the data, and would not have
worked if implemented. The three failures are independent and each is easy to make alone.

**Where a design tolerates a risk because something else catches it, the something else is
part of the design** and belongs in `AUDIT-CHECKS.md` with a query that proves it still holds
— not in a comment asserting that it does. That is check 18.

**Reversal condition, and it is narrower than it looks.** The asymmetry — positive checked
first, so an incomplete inventory can still answer `true` but can no longer answer `false` —
would be revisited only if sites in practice carry so many unidentified rows that
`substance_inventory()` returns `unknown` for nearly everyone, making the 15 conditions that
depend on it useless in a different way. **The fix then would be to improve identification, not
to restore the clear.** Reverting to `false`-on-unevaluable is not available at any volume of
inconvenience: `CLAUDE.md` §3.2 is that absence of evidence never produces a clear, and this
decision is that rule applied to one function. **What would legitimately change the shape:**
once `regulated_substances` is seeded (TODO 6.4b), a row whose CAS matches nothing is more
likely a typo than an unlisted substance, and it may be worth distinguishing *unidentified*
from *unrecognised* so the UI can ask a sharper question. Both still return `unknown`.

---

## 46. A pre-flight names files exactly as they appear on disk — 12 September 2026

**The decision.** Any hand-off that lists files for the owner to act on — pending migrations
above all — names them by reading the directory, not by recalling what the work was called
while it was being done. `ls supabase/migrations/`, pasted. Not "the company_chemicals
migration", not a number remembered from a plan, not two logical pieces written as two files
when they shipped as one.

**Why, and it is not tidiness.** `HOW-WE-BUILD.md` §4 makes an unexpected file list at the
production prompt a signal to **abort**. That guard has fired twice and both times found a real
defect. Its value is entirely in its precision: it works only while an unexpected list is rare.

A pre-flight that paraphrases filenames makes *every* list look unexpected. The first false
alarm costs a reconciliation. The second costs patience. **By the third the list stops being
read**, and the guard is gone at precisely the moment it would have caught something — the
failure is silent, and it lands on production. A guard that cries wolf is worse than no guard,
because an absent guard is at least known to be absent.

**The incident.** A hand-off for migrations 013 and 014 named them `014_company_chemicals.sql`
and `015_requirement_splits.sql`. The owner stopped and demanded a read-only reconciliation,
which was the correct call and cost nothing — production was untouched and still on 012.

Nothing was wrong with the migrations. Measured, not recalled:

| Question | Answer |
|---|---|
| Do those two filenames exist? | No — not on disk, not in any commit, not in any doc, script or comment |
| Was `013_chemical_inventory` renamed from something? | No. `git log --follow --name-status` over `supabase/migrations/` shows **zero `R` entries** in the project's whole history; every migration appears once as `A` |
| Where is the "missing" split migration? | It is **section 4 of `013_chemical_inventory.sql`** — three splits at lines 404, 462 and 559, with a verification block at 606 |
| Where did the two names come from? | **Not established.** They appear nowhere in the repo, and a scan of the full session transcript found them only in the owner's own message |

**That last row is recorded as unknown on purpose.** The names fit the shape of a plan in which
the inventory and the splits were two migrations at 014 and 015, above a different 013 — but no
such plan exists in this repo, and writing "it came from an earlier plan" would be inventing a
provenance to make the record tidy. §44.1's rule about fabricated magnitudes applies to
history as well as to thresholds: a plausible origin nobody can point at is still a made-up one.

**The general form.** This is the same failure as writing a summary from recollection rather
than from the database, which has now happened twice about migration state. Recollection is
fine for reasoning and unfit for identifiers. **Anything a reader will compare character by
character — a filename, a row count, a ref, a hash — is copied from the thing itself.**

**Reversal condition.** If the pending-file list is ever generated by the migration script
itself and quoted verbatim into the hand-off, this rule becomes redundant for migrations —
the machine cannot paraphrase. It would still stand for every other hand-off that names a file.

### 46.1 A pre-flight lists what the TOOL will list — the DIFF, not the directory

**Extension, 12 September 2026, after §46's first test.** §46 said a pre-flight names files
exactly as they appear on disk. That is necessary and it is not sufficient. **The number that
matters is not what is in the directory — it is what is in the directory and NOT in the target
database's migration history.** Those are different questions, and only the second one is what
`db:migrate:prod` will actually apply.

**So the pre-flight computes a set difference and prints the result**, rather than printing a
directory listing beside a head version and leaving the subtraction to the reader:

```sql
-- against the TARGET database
select version, name from supabase_migrations.schema_migrations order by version;
```
```
pending = ls(supabase/migrations/)  MINUS  applied(target)
```

**Why this is more than tidiness.** A directory listing is a fact about the repository; the
pending set is a fact about the *relationship* between the repository and one database, and it
changes when either side moves. A migration written earlier in the same session — for a
different piece of work, already shown, already approved, still unapplied because nobody said
yes — is in the directory, absent from the history, and **not on the author's mind**. Reading
the directory gets its name right. Only the diff guarantees it is in the list at all.

### 46.2 The guard fired on a correct run, and that is the cost being recorded

**What happened.** The pre-flight named both pending files correctly —
`015_obligation_provenance_comments.sql` and `016_close_and_replace_obligations.sql`, matching
`ls` character for character, with production's head read from its own history table. The abort
was raised against a third name, `015_close_and_replace_obligations.sql`, which is 015's number
spliced onto 016's name and **exists nowhere: not on disk, not in any commit on any branch.**
Verified, along with the transcript: that string was never written by the author of the
pre-flight. Nothing was wrong, and nothing was applied.

**That is the third abort in one session on a name or a count that corresponds to nothing** —
after `014_company_chemicals.sql` / `015_requirement_splits.sql` (§46) and three counts that
matched neither database. **Every one was cheap, correct to raise, and found nothing.**

**And that is precisely what is being recorded here, because it is the expensive part.** The
abort costs a reconciliation. What it spends is the guard: `HOW-WE-BUILD.md` §4 makes an
unexpected file list a reason to STOP, and that instruction works only while an unexpected list
is rare. **A guard that fires on correct runs stops being read** — not by decision, but by
attrition — and it stops being read shortly before the run where it would have mattered. A
false alarm is not free just because it resolves quickly.

**The symmetric obligation, then, and it applies to whoever raises the alarm as much as to
whoever writes the pre-flight:** re-read the artifact before raising the discrepancy. `ls
supabase/migrations/` is one command and it is available to both sides. §46 states this for the
author; `HOW-WE-BUILD.md` §3 states it for anyone running a check. **What this session
demonstrates is that the two are the same rule**, and that the side raising the alarm has the
cheaper check available — because the author has to be right about everything, and the
challenger only has to run `ls`.

---

## 47. "Replace" means close and insert — the BizPulses pattern does not transfer whole — 12 September 2026

**The decision.** The atomic function is **`close_and_replace_obligations`**, not
`replace_obligations`. Inside one transaction it **closes** obligations that have changed or
gone away by setting `applicable_to`, and **inserts** the new ones. **It contains no `DELETE`.**

**The name is part of the decision.** `TODO.md` 4.2 called it `replace_obligations` and
specified *"DELETE+INSERT in one transaction"*. That name is what carried the delete
semantics across from `PATTERNS.md` §4 in the first place, and a name is what the next person
sees before they read anything else. Renaming it is how the reconciliation survives being
read by someone who only ever sees the function signature.

**What transfers from BizPulses and what does not.** The transaction mechanism ports intact:
one stored function, all-or-nothing, with an in-SQL ownership guard that `RAISE EXCEPTION`s
if a row does not belong to the caller's company — the database enforcing the invariant even
though the only caller bypasses RLS. **The retention policy does not port at all, and the
reason is a difference in what each product is for:**

| | BizPulses | CompliBoard |
|---|---|---|
| The rows are | a derived extract of an uploaded spreadsheet | the record of what a company was subject to |
| Re-running means | the latest data for a period replaces the old | a new version of a continuing history |
| Deleting a row loses | nothing — re-upload reproduces it | **the date a company became subject to a rule, which is not recoverable from anything** |

*"We were subject to this from March 2024 to January 2026"* is the sentence the product
exists to be able to say. `CLAUDE.md` §3.2: obligations are never deleted, only marked.

**Migration 007 already settled this and said so in its own header** — the contradiction
between 4.2's DELETE+INSERT and §3.2's never-delete was spotted then, and `applicable_from` /
`applicable_to` are the resolution. This section records it in the decision log because a
reason living only in a migration header is a reason nobody will find.

**The schema enforces it, which is what makes this more than a convention:**

```
idx_obligations_one_open  UNIQUE (company_id, entity_id, requirement_template_id)
                          NULLS NOT DISTINCT WHERE (applicable_to IS NULL)
```

**`NULLS NOT DISTINCT` is the load-bearing clause.** Without it, `entity_id IS NULL` — every
company-level obligation, which is the common case — would compare unequal to itself and the
index would permit unlimited duplicates. With it, *at most one open obligation per (company,
entity, requirement)* is a database guarantee rather than a hope, and **close-before-insert
is not a style preference: the reverse order is rejected by the index.**

**The four cases, and the first one is the common one:**

| Case | Action |
|---|---|
| Open row exists, status unchanged | Touch `last_verified_at`. **No new row.** |
| Open row exists, status changed | `applicable_to = CURRENT_DATE` on the old, insert the new |
| No open row, in the new set | Insert |
| Open row, absent from the new set | `applicable_to = CURRENT_DATE`. **Never a replacement, never a delete.** |

**Idempotence is a requirement, not a nicety.** A resolver that always closes and reopens
produces one row per run per requirement, and the history that justified this whole design
becomes unreadable noise within a week of a nightly recompute. That is the first case above
and it has its own test.

**A same-day change twice** yields `applicable_from = applicable_to = CURRENT_DATE`, a
zero-length window. The `obligations_window` CHECK permits it (`>=`, not `>`). That is
deliberate: refusing it would make the second recompute of a day fail, and an obligation that
was open for no time is a true statement about a mistake that was corrected.

**Reversal condition.** If obligation history is ever moved to a separate append-only audit
table, `obligations` could become a current-state table and a genuine replace would be
correct. That trade is worth considering only when the window columns are demonstrably the
wrong shape for a real query someone needs — not for tidiness, and **not because the
reconciliation is more code than a DELETE.** It is more code on purpose.

---

## 48. Validate the STRUCTURE of an identifier before writing it, never after — 12 September 2026

**The decision.** Any identifier carrying a check digit has it verified **before** the value
reaches the database. Not on read, not in a nightly sweep, not by the foreign key. Before the
write. Today that is CAS registry numbers in `lib/sdsExtraction.ts`; the rule is general and
applies to every identifier of this shape the product ever ingests — EPA IDs, DOT numbers, UN
numbers, NAICS codes, EINs.

**Why the foreign key is not enough, and this is the whole argument.** `DECISIONS.md` §45
established that a CAS matching nothing in `regulated_substances` makes the row unevaluable, so
`substance_inventory()` returns `unknown` and the requirement becomes **unreachable rather than
wrongly cleared**. That is the safe failure, it is already handled, and it is the one people
think of.

**It is not the failure that matters.** A transposed digit is **syntactically valid and
semantically absent** — it is a well-formed CAS that is simply not the substance in front of
you. And a transposition can land on a *different real substance*:

```
7664-93-9   sulfuric acid          valid
7664-39-3   hydrofluoric acid      valid
```

Two digits apart, both in the reference table, wildly different thresholds. That row does not
produce `unknown`. It produces a **confident, correctly-typed, foreign-key-satisfying answer
about a chemical the site does not hold** — and every downstream layer treats it as established
fact, because by every structural test available it is one.

> **§45 protects the direction we can see. This protects the direction we cannot.**
>
> An unmatched identifier announces itself by matching nothing. A *mis*-matched identifier
> announces nothing at all, and the more complete the reference data becomes, the more likely a
> typo is to land on something real. **The check improves with our data; the risk it guards
> against grows with our data too.**

**Why a check digit specifically.** It is arithmetic rather than judgement, costs nothing, needs
no reference data, and catches most transpositions — the single most common transcription error
and the one most likely to produce another valid identifier. It cannot catch everything, and it
does not need to: it converts a class of silent wrong answers into a class of loud absences,
which is the trade `CLAUDE.md` §3.2 asks for everywhere else.

**What happens to a value that fails.** It is stored as **NULL**, never as-is, and **the raw
string goes into `basis`** so a person can correct it. The row itself is **kept** — dropping the
component would make the site look cleaner than it is, which is the false green this whole
design exists to prevent (§45).

**This is the model for the rest of Phase 7.2, and it generalises past identifiers:**

> **Validate the structure of what you extracted before writing it, not after.** A value that is
> well-formed and wrong is indistinguishable from a value that is well-formed and right, once it
> is in the database. Every structural property that can be checked without a reference lookup —
> a check digit, a date that parses, a number inside its own permitted range, an enum value in
> its own allowed list, a quote that appears in the document it is quoted from — is checked at
> the boundary, and a failure produces an absence rather than a value.

**Reversal condition:** none for the check itself. If an identifier standard is ever adopted
that has no check digit, the rule degrades to the other structural checks above rather than
being waived. **What would NOT justify waiving it: the extraction model getting better.** A
better model makes fewer transcription errors; it does not make a transposed digit detectable
any other way.

*Numbered 48 rather than 53: §47 was the highest section in the file, and 53 would have left
§48–52 as gaps that a future cross-reference could point at.*

### 46.3 The extended rule fired correctly, on its first real test — 13 September 2026

**§46.1 said a pre-flight must list what the TOOL will list — the set difference between the
directory and the target's migration history — rather than naming files from the directory.
Its first real test was a case where the two answers differed, and the diff was right.**

A hand-off called for shipping "migration 018". **The directory contained no 018.** Reading the
directory alone would have produced either a confused report or, worse, a plausible-looking list
built from the highest number present. The diff answered flatly:

```
on disk : 18        applied on prod : 18
PENDING = on disk MINUS applied:   (none)
count pending: 0
```

**Zero pending is a fact about the relationship between the repo and one database, and it was
the truth**: 017 had gone up two turns earlier and nothing had been written since. The
instruction was acting on a migration that had been *specified* in §50 and never *created* —
and the diff made that visible in one line rather than after an attempted push.

**What this adds to §46 and §46.1.** The first three firings were about names that did not match
a file. **This one was about a file that did not exist at all**, which the name-checking rule
could not have caught: a correctly-spelled name for a non-existent file reads exactly like a
correctly-spelled name for a real one. **Only subtracting the applied set from the directory
distinguishes them.**

The migration was then written, which is the right outcome — but it was written *knowing* it did
not exist, rather than discovered missing by a failing push.

---

## 49. An overwritten fact carries what it overwrote — 12 September 2026

**The decision.** When a person answers the same question twice and changes the answer,
`company_switches.basis` records the previous value and the date: *"User stated false on
2026-09-12, previously true. Question: …"*. Re-answering with the same value is not a change and
gets no such clause.

**The overwrite itself is correct and is not what this is about.** `DECISIONS.md` §24.1 — a
stated value outranks an inferred one, and a newer stated value outranks an older one. A person
correcting their own answer should win, immediately, over everything.

**What was missing is that nobody could tell it had happened.** A switch value that silently
flips leaves a requirement list that silently changes, and the two are separated by however long
it takes someone to notice. For a fact like `hazardous_chemicals_present` — 8 requirements
directly and **35 through the 21 switches that depend on it** — that is not a detail. It is the
whole explanation for why somebody's compliance list looked different on Tuesday.

**Why `basis` and not only the history table.** `switch_determinations` holds the full chain
regardless (§47's shape), and it is the right place for an audit. But an audit is something you
go and do; **`basis` is the sentence displayed next to the value on the switches screen**, and
the question "why did my list change" is asked by someone looking at that screen, not by someone
opening a history table they do not know exists. The cost is one string concatenation.

**The general form, and it is the reason this is a decision rather than a nicety:**

> **A correction and an unexplained change look identical after the fact.** Where a value may be
> overwritten by an authority that is allowed to overwrite it, the record of what it replaced
> travels with the new value — not in a separate table that has to be sought out.

**Reversal condition.** If the switches screen ever shows the determination chain inline — every
claim ever made about a fact, in order — this becomes redundant duplication and should be
dropped rather than maintained in two places. Until then the row is the only surface a person
sees, and it has to carry its own history.

---

## 50. `basis` is structured, and the sentence is rendered from it — 12 September 2026

**The decision.** `company_switches.basis` becomes **jsonb**, not text. The human sentence is
produced by a renderer from the structure, never stored instead of it.

**The precedent is 4.1's and this follows it deliberately.** `obligations.determined_by` is
jsonb for exactly this reason, stated in migration 007's own header: *"resolution_rationale is
free text and cannot answer either question that matters operationally — which obligations must
be recomputed when one switch changes, and what turns on a given switch."* `basis` faces the
same two questions one layer down — *which switches rest on this document*, and *what did we
read to conclude this* — and prose answers neither.

**And it is the same call as §43 for `applies_expression`, for the same two reasons.** A format
that must be parsed by a human before it can be checked makes verification theatre; a format
that must be parsed by a regex before it can be queried makes M6's provenance panel a string
search. **Store the structure, review the sentence.**

```
{ "v": 1,
  "kind": "user_answer" | "document" | "computed",
  "at": "2026-09-12",
  "question": "…",            // user_answer
  "previous_value": "true",   // user_answer, on a change only — §49
  "document_id": "uuid",      // document
  "locator": "Permit cover page",
  "quote": "…verbatim…",
  "reasoning": "…",           // implied / inferred only
  "computed_from": ["…"] }    // computed
```

**What this buys that a string does not:** *"show me every switch whose basis is this document"*
is a containment query rather than a `LIKE`; a quote can be re-checked against the document it
names character by character (`docs/SWITCH-DETERMINATION.md` §6); and when a document is
superseded, every value resting on it is findable.

**Consequence, stated rather than discovered: this is a migration.** `basis` is `text` today.
Changing it is migration 018 and it must convert the rows that exist, not drop them.

**Reversal condition.** If a basis ever needs to hold something genuinely unstructured — a
paragraph of human judgement with no fields — the structure gains a `note` field rather than the
column reverting to text. **What would NOT reverse it: the renderer being more code than a
string concatenation.** That was the argument against §43's renderer too, and the renderer
caught a logical inversion and a fabricated threshold in its first twenty rows.

---

## 51. A proposal is not produced until something can accept it — 12 September 2026

**The decision.** Phase 7.2a writes only the switch values it is entitled to write. For the
**ten** switches on the propose-don't-write list (`docs/SWITCH-DETERMINATION.md` §5), a
determination that would need confirmation is **not produced and not stored anywhere.**

**This sounds wasteful and it is the honest option.** Nothing in the product can accept a
proposal today. The two places it could be put are both worse than not producing it:

| Option | Why it is worse |
|---|---|
| A row in `switch_determinations` with no status | The `outcome` column was specced and not built (migration 017), so a proposal would be **indistinguishable from a determination that lost the precedence ladder** — and it would sit in a queue with no consumer, which is a backlog that looks like data |
| Surface it through the ask path | **A proposal is not a question.** A question has no evidence behind it; a proposal has evidence and a value and is asking to be confirmed. Conflating them means the user is asked something the product already believes it knows, with no way to show them why |

**Where a proposal actually belongs: M6.1, the verification section.** That screen's job is
precisely *"here is what we concluded — correct it"*, which is the accept surface a proposal
needs. **So this is recorded as BLOCKING M6.1**, not as a gap in 7.2a.

**What 7.2a does instead:** the propose-path switches are simply left unestablished, and the
`absent`/undetermined machinery already reports that honestly. A customer sees "we have not
established this" rather than a silent guess or an unread queue.

**Reversal condition.** The moment M6.1 exists — or any surface that can show evidence and take
a yes — proposals are produced and this decision is spent. **It is a sequencing decision, not a
position on proposals**, and it should not be cited later as an argument against them.

---

## 52. The second dependency question, and why it is now a step — 12 September 2026

**The decision.** Before any item is built, two questions are asked, not one:

1. **What does this need that does not exist?** — the ordinary dependency check.
2. **What does this decide on behalf of something that does not exist yet?**

**The second is new and it is the one that pays.** A dependency check on Phase 7.2a found four
accidental decisions, and **three of them would have been invisible until something downstream
broke on them:**

| | Would have been discovered |
|---|---|
| A second ask-card contract, when `DETERMINATION-GATE.md`'s is already shipped and live on two routes | When M1 tried to render both |
| A response shape omitting **"affects N requirements"**, which `CHEMICAL-OR-WA.md` §6.4 calls *"the number that makes a user willing to correct a switch"* | When M6 built the switches screen and found the field absent |
| A home for proposals chosen inside a one-day route task, on behalf of M1, M6 and M7 | When whoever built the accept UI inherited a store nobody had agreed |
| `basis` as prose | When M6 tried to query it |

**The pattern this generalises.** `DECISIONS.md` §34 records a `follow_up_questions` field that
made the determination gate impossible — a field shaped before the thing that would use it. §2
of this project's own switch seed records a `determination_source` column answering the wrong
question. **Both are the same failure: a contract set by whoever got there first, with no
argument, because nobody noticed a contract was being set.**

**Question 1 failing means building against a guess. Question 2 failing means building a guess
FOR SOMEBODY ELSE**, who will discover it when it is expensive to change.

**Reversal condition:** none. If the second question ever returns "nothing" for several items in
a row, that is evidence the remaining work is genuinely independent, not evidence the step is
unnecessary — and it costs one paragraph to ask.

---

## 53. §51 constrains the SOURCE, not the switch — 13 September 2026

**The decision.** §51 — *a proposal is not produced until something can accept it* — governs
what an AI may write **from inference**. It says nothing about what a **person** may establish.
A user stating a fact is not an inference, so the ask path writes every switch a user answers,
**including switches on the propose-don't-write list.**

**Why the two lists do not conflict.** `hazardous_chemicals_present` is on both, for different
reasons that are both correct:

| List | Reason |
|---|---|
| propose-don't-write (§5 of the spec) | A wrong `false` inferred from a website scan **hides 35 requirements** — 8 directly and 27 more through the 21 switches that carry it as `depends_on_switch` |
| highest-leverage question | It is the second-highest transitive leverage in the whole vocabulary, behind only `has_employees` |

**Reading §51 as a property of the SWITCH would have made the second-highest-leverage question
in the product unaskable** — the product would refuse to let a customer tell it something,
because a model might have got it wrong. That is the failure, and it is not a small one.

`DECISIONS.md` §24.1 already settles the ordering: **a stated value outranks an inferred one.**
`fromUserAnswer()` writes `evidence_class = 'stated'` and `user_locked = true` precisely because
a person said it. §51's caution is about evidence strength, and a statement is the strongest
evidence class there is.

**The general form:**

> **A constraint on how a fact may be ESTABLISHED is not a constraint on the fact.** The same
> switch can be unwritable from inference and writable from a statement. A rule that reads as a
> property of the thing, when it is really a property of the route to the thing, removes
> capability nobody meant to remove.

**And the measurement forced a correction to the ask path's candidate set.** Only **2** of the
ten propose-don't-write switches are seeded `determination_source = 'user_answer'`
(`cdl_drivers`, `owns_fleet`). `hazardous_chemicals_present` is seeded `documents`. **So an ask
path that offered only the 29 `user_answer` switches would never offer the highest-leverage
question in the vocabulary** — the same mistake one layer down.

**`determination_source` answers "which kind of source is AUTHORITATIVE for this fact". It does
not say "the user may not be asked".** So the ask path's candidate set is *every switch that is
unestablished and whose dependencies are satisfied*, with `user_answer` switches ranked first
because **nothing else will ever establish those** — not because the others are off-limits.

**Reversal condition.** If a switch is ever genuinely unanswerable by a person — a computed
figure like `hazwaste_generator_category`, which is a monthly calculation rather than a fact
anyone holds — it is excluded from the ask path **by being computed**, not by appearing on §51's
list. That exclusion is a property of the switch and belongs in `determination_source`.

---

## 54. One answer unlocks one level, and then stops — 13 September 2026

**The decision.** `POST /api/switches/answer` recomputes the askable set and returns the
questions that answer **newly unblocked** — one level of the dependency graph, not a cascade.
The next answer starts a new cycle.

**Why it recomputes at all.** The product's proposition is *answer a question, watch your list
move*. 21 switches carry `hazardous_chemicals_present` as `depends_on_switch`, and 7 carry
`has_employees`. **Without a recompute, the very first thing a user does returns an empty next
list** — the children only become askable once the parent is known — and the first interaction
in the product produces nothing visible. That is precisely the failure the ask path exists to
prevent.

**Why exactly one level and not recursion.** Two reasons, and the second is the one already
written down:

- **A single answer unlocking a chain three deep reads as the product stalling.** The user
  answers once and watches a queue grow; nothing about that feels like progress.
- **`DETERMINATION-GATE.md` already warns about this**: *"at most one blocking question"*, and
  *"you may ask one. Not two, not 'one, and also'."* A cascade from one click is the
  too-much-asking failure that spec was written against, arriving by a different door.

**The shape:**

```
answer → write → recompute the askable set → return ONLY the newly unblocked → stop
```

**What "newly unblocked" means precisely:** a switch that was blocked before this answer and is
not blocked after it. Not "everything askable now" — that would return the whole remaining
queue on every call and the one-level bound would be cosmetic.

**Reversal condition.** If measurement ever shows users abandoning at the second or third
question because each answer surfaces only one or two more, the bound is the thing to revisit —
**by widening the returned set, never by recursing.** The distinction matters: returning more of
the *current* level is a display decision; following the graph further is the cascade this
decision refuses.

---

## 55. The whole-company recompute, as a measured number — 13 September 2026

**The decision: accept the write amplification for now, and record it as a figure rather than
as a note, so the point at which it stops being acceptable is arguable rather than felt.**

**Measured 13 Sep, Test Alpha Chemical, 2 sites, one answer (`has_employees = true`):**

| | |
|---|---|
| Obligation rows in the payload | **221** |
| Rows whose status actually changed | **19** |
| Rows closed **and** inserted (2 writes each) | 38 |
| Rows touched only for `last_verified_at` | **202** |
| **Write amplification** | **10.6× unchanged rows per changed row** |

**Over a twelve-question session, if every answer recomputes: ~2,652 obligation rows touched,
of which at most ~228 change** — and that is an upper bound, because later answers change fewer
than the first.

**Nothing pays this cost today.** No route calls `close_and_replace_obligations`; `obligations`
is 0 rows in both environments. This is recorded before the first caller exists, not after.

**What the fix would be.** Write only the changed row, and recompute only the obligations that
switch touches. Both halves are straightforward in isolation.

**Why it is not being done now, and this is the substantive part:**

1. **`close_and_replace_obligations` is whole-company by design, and that design is load-bearing
   (§47).** Its contract is *"here is the complete set; reconcile it"*, which is what makes the
   fourth case — an obligation that has left the set entirely — detectable at all. A partial
   call cannot distinguish *"this requirement no longer applies"* from *"this requirement was
   not in the payload you sent"*, and the difference is an obligation silently staying open
   forever. **Narrowing the payload would trade a 10.6× write cost for a correctness hole.**
2. **A partial recompute needs to know which obligations one switch touches.** That is derivable
   from `applies_expression` — the switch's family, transitively, exactly as `transitiveAffects()`
   already computes for the ask path — **but it is not built**, and building it inside a route
   task would be a third consumer of a derivation that has no owner.

**When this stops being acceptable**, stated so it is checkable rather than a matter of taste:
when a single company's obligation count times a session's answer count makes the recompute
visible in the request path. At 221 rows it is not. **At ten sites it is 1,105 rows per answer**,
and the arithmetic is linear in sites — so the trigger is a multi-site customer, not a busy one.

**Reversal condition.** Build the per-switch obligation index first, as its own thing with its
own tests, and only then narrow the recompute. **Narrowing the payload without it is the
correctness hole above**, and "it was slow" is not a reason to accept one.

---

## 56. A migration does one thing — and a pre-flight copies CONTENTS, not just names — 13 September 2026

**Two decisions, from one failure, and they are the same failure at two levels.**

### 56.1 A migration does one thing, and its filename says what

**Migration 018 was briefly written as two unrelated changes in one file** — `basis` becoming
jsonb (§50) and a REVOKE closing `AUDIT-CHECKS.md` check 22 — on the reasoning that two
twelve-line changes are cheaper as one migration than as two, and that the chain gets replayed
from zero on every `db:reset`.

**That was a false economy, and the cost arrived within the hour.** A migration with two
purposes has **two honest names**. The filename can carry one. `018_basis_is_structured` is a
correct name for the first half; `018_revoke_substance_inventory_from_public` is a correct name
for the second. **Neither is wrong, and the half not in the name is invisible to everyone who
only reads the file list** — which is what a pre-flight is.

**And the half that vanished was the security fix.** That is not a coincidence: the basis change
is what the session had been discussing, so it is what the filename described, and a REVOKE that
closes a recorded finding disappeared behind it.

**So: one migration, one thing, and the filename names it.** Split into
`018_basis_is_structured.sql` and `019_revoke_substance_inventory_execute.sql`. The saving the
combined file bought was one file. The cost was that the migration could not be referred to
unambiguously for the rest of its life.

**Reversal condition:** none for genuinely unrelated changes. **Two changes may share a migration
when neither is comprehensible without the other** — a column and the constraint that makes it
safe, a table and its policies. The test is not size; it is whether one filename can honestly
describe both.

### 56.2 §46 extended: a pre-flight copies a file's CONTENTS, not only its NAME

**§46 and §46.1 govern names.** §46 says a filename is copied from the directory, never recalled.
§46.1 says the list is the *diff* between directory and applied history, not the directory.
**Both were followed here, and both passed.** The diff ran, reported `count pending: 1`, and
named `018_basis_is_structured.sql` correctly.

**The error was one level down: describing what the file DOES from session context rather than
from the file.** The migration had two halves; the half named was the one discussed most
recently; the half written earlier vanished from the description.

> **A pre-flight that names a migration correctly and describes it wrongly is WORSE than one
> that gets the name wrong.** A wrong name fails the check — the operator looks at `ls`, sees no
> such file, and stops. **A right name with a wrong description passes every check there is**,
> and the operator approves a migration having been told it does something else.

**So the rule extends:** the same copy-don't-recall discipline that applies to a filename applies
to the **summary of what it does**. A pre-flight that says what a migration changes reads the
file — `grep -E '^(alter|create|revoke|grant|drop|comment|insert|update)' <file>` is enough —
and lists every statement class it finds. **The description is derived from the file, exactly as
the name is derived from the directory.**

**Why this is a distinct failure from §46's three.** Those were a NAME substituted for a NAME —
a paraphrase, catchable by comparing against `ls`. This was a file's CONTENTS summarised from
memory. Nothing in the name check could have caught it, because the name was right.

**Reversal condition:** none. If a migration ever becomes too large to summarise from its own
statements, that is 56.1 telling you it does more than one thing.

---

## 57. Five instances in two days: the rule is right, the practice is the problem — 13 September 2026

**Recorded as one entry because they are one failure**, and counting them separately made each
look like an isolated slip rather than a pattern with a single cause.

| # | What was substituted | Whose | Caught by |
|---|---|---|---|
| 1 | `014_company_chemicals.sql` · `015_requirement_splits.sql` — names for files that never existed | owner's hand-off | `ls` |
| 2 | Counts (692 objects, 76 switches, 11 unused) matching neither database | owner's hand-off | re-measuring |
| 3 | `015_close_and_replace_obligations.sql` — 015's number on 016's name | owner's hand-off | `ls` |
| 4 | **A file's CONTENTS** summarised from session context rather than read | mine | being asked to prove a constraint that was not there |
| 5 | `018_revoke_substance_inventory_from_public.sql` — a correct name for half a file, retyped after the pre-flight had named it right | owner's hand-off | `ls` |

**Three are the owner's, two of those after the rule was extended to cover exactly that step.**
Recorded plainly because a rule that is only ever broken by one side is a rule about that side,
and this one is not: instance 4 is mine, and it is the one no name check could have caught.

### What the five have in common

> **Every one is a value that was RETYPED or RECALLED at a step where it could have been COPIED.**

Not one is a failure of the rule, and not one would have survived a `grep`. The directory was
always right. The diff was always right. **The failure is always at a hop** — from the directory
to a report, from a report to a hand-off, from a file to a description of it.

### So the rule is stated as a practice, at every hop

**Names and file contents are COPIED, never retyped or recalled, at every step between the
directory and the prompt — including the hand-off.**

That last clause is the one instances 3 and 5 broke, and it is the step §46's extension was
written for. **A hand-off is not commentary on a pre-flight; it is a hop, and it is the last one
before something irreversible happens.** The asymmetry noted in §46.2 still holds and cuts the
other way here: the author must be right about everything, the challenger need only run `ls` —
**and so must whoever writes the instruction, because it is the same one command.**

### Why instance 4 is the one worth fearing

Instances 1, 2, 3 and 5 all fail the check. Somebody lists the directory, finds no such file,
and stops — which is what happened every time, at a cost of one reconciliation each.

**Instance 4 passes every check there is.** The name was right, the diff was right,
`count pending: 1` was right. Only the *description* of what the file did was wrong, and nothing
in the process compares a description to anything. §56.2 is the fix — a pre-flight greps the
statements out of the file — and it is the only one of the five that needed a new mechanism
rather than more care.

### The standing cost, restated because it is the reason any of this matters

`HOW-WE-BUILD.md` §4 makes an unexpected file list a reason to **stop**. That instruction works
only while an unexpected list is rare. **Five false alarms in two days is not rare.** Each one
was cheap and correct to raise and found nothing wrong — and each spent a little of the only
guard standing between a hand-off and production.

**Reversal condition:** none. If the hand-off is ever generated from the pre-flight's own output
rather than retyped — the operator pasting the block rather than describing it — instances 3 and
5 become impossible and this reduces to §56.2 alone. **That is the fix worth building if a sixth
occurs.**

---

## 58. 7.3 comes before M6, and five display contracts settled with it — 13 September 2026

### 58.1 The reorder, and the reason it is not about schema

**Decision: `obligation_evidence` (7.3) is built BEFORE M6, reversing the order both plans imply.**

**The reason is not that the list needs evidence rows to render — it does not.** `obligations`
joined to `requirement_templates` is sufficient, and that was the finding. **The reason is what
the screen would SAY.**

| Row | What it can say |
|---|---|
| `does_not_apply` | *"This does not apply to you, and here is why: `industrial_stormwater` = false."* Honest, complete, carried by `resolution_rationale` |
| `unknown` | *"We cannot say yet — these facts would settle it."* Honest, carried by `determined_by.switches_missing` |
| **`applies`** | *"This applies to you."* **And then nothing.** |

**There is nowhere to say anything further, because the design never gave `applies` a second
axis.** `obligation_status` answers *does this apply* and deliberately not *have you done it* —
§21.3 removed the name `satisfied` for exactly that reason, and put the second question in a
join against `obligation_evidence`.

**So a screen listing 40 `applies` rows with no evidence column reads as a compliance position.**
A user sees a requirement asserted against their company with nothing qualifying it, and reads
either *"and you have done it"* or, at best, cannot distinguish a satisfied requirement from one
nobody has looked at. **That is the omniscient status tracker (`CLAUDE.md` §6) arriving through
the one column the design never gave a status to** — and it arrives most convincingly precisely
because every row on the list is true.

**The other two states are safe alone; `applies` is not.** That asymmetry is the whole argument,
and it is invisible until you ask what each row renders as a sentence.

**Reversal condition:** if M6 ever ships before 7.3 for a reason that outweighs this, the
`applies` section must carry an explicit *"we have not checked whether you have done this"* on
every row — not a footnote, per row. That is uglier than waiting, which is why waiting wins.

### 58.2 `undetermined` and `unknown` render as QUESTIONS, not gaps

**Not a presentation choice — rendering them as gaps discards structure that already exists.**
`determined_by.switches_missing` names the blocking switches; `switches.question_plain` holds
the wording for all 95; 7.2a's ask endpoint already orders them and says what each unblocks.
**The data IS a question.** A screen showing "72 unknown" as a list of gaps throws away three
fields to produce a worse sentence.

This also fixes M6.1's framing before it is built: *"an inbox that gets quiet, not a burn-down"*
is already its spec, and M6 must match it rather than contradict the screen above it.

### 58.3 No numeric aggregates anywhere in M6, and a TEST asserts it

**Decision: no counts, no percentages, no totals. And it is asserted, not just written down.**

The rule already existed — numbers are gated on library verification (6.7) — but **M6 is where
it gets tested, and a count is the easiest thing in the world to add without noticing it is a
claim.** `app/requirements/page.tsx` already renders `count: satisfied.length` today, of a state
that no longer exists; nobody added that maliciously, and nobody caught it either.

**So a test fails if a numeric aggregate appears in the requirements view.** Cheap, and it is
the only thing that stops the next person adding one. **"40 requirements apply" and "you are 40%
covered" are one CSS class apart**, and the second is the anti-pattern this product removed once
already.

### 58.4 `does_not_apply` is a PEER SECTION — equal in navigation, not on screen

108 `does_not_apply` above 40 `applies` buries what the user came for. Making it a filter buries
the product's most defensible output — requirements a company can *demonstrate* they are not
subject to, each with the fact that ruled it out.

**Peer section: equal weight in the navigation, not equal weight on the screen.** M1 inherits
this framing, because a chat answer citing *"you are not subject to X"* must look consistent
with the list.

### 58.5 No citation link until the citation is verified

0 of 200 rows carry a `citation_url` and 0 are `verified`. **A link to a rule nobody has checked
asserts that somebody checked it** — and `CLAUDE.md` §6 requires that a verified row and a
generated row not look the same. **A linked citation is what verified looks like.** Until 6.7,
the citation renders as text.

### 58.6 One page, not two

A separate switches page is a second place to answer the same question with a different flow,
and M6.1 would make a third. The requirements list, the questions and the verification section
are one surface.

**Reversal condition** for 58.4 and 58.6 together: if a real user cannot find the
`does_not_apply` section from the navigation, that is evidence about the navigation, not an
argument for a separate page.

---

## 59. Removing an exception is a test of what is underneath it — 13 September 2026

**The decision.** A check does not carry a pattern-shaped exception. Where an allowance is
genuinely needed, it is an **identity** — the exact strings one named function produces — never a
regex a future line could be written to match.

**Why, and the second reason is the one worth having.**

**The first is the obvious one: an exception is a precedent.** §58.3's no-aggregate test briefly
allowlisted three section headings — `What you owe (40)` and friends — on the argument that a
section SIZE is navigation rather than a claim. The argument is reasonable and it loses, because
**the next count added has something to point at.** §58.3 exists precisely because a count is the
easiest thing in the world to add without noticing it is a claim, and a test that permits a
category of the failure it was written to prevent has stopped being the thing that prevents it.

> ### **The second: an exception is a place nobody looks hard — and this one was concealing that the check could not see the string it was excusing.**
>
> When the allowlist was removed, an assertion proving the detector could still catch the
> excused lines **failed**. The pattern looked for a number followed by `%`, `of N`,
> `requirements`, `items`, `complete` or `covered`. **`What you owe (40)` matched none of them.**
>
> The carve-out had never been the thing protecting that heading. **The detector could not see it
> either**, and nobody had checked, because the line was on the allowlist and therefore not
> something the test was thought to be about.

**So: removing an exception is not a tightening. It is a test of what is underneath it**, and it
should be treated as one — with an assertion that the newly-unexcused case is actually caught,
rather than an assumption that it now falls through to a check that works.

**The general form:**

> **An exception in a check hides two things: the case it excuses, and whatever the check would
> have done with that case.** The second is invisible for exactly as long as the exception
> stands, and is discovered only by removing it.

This is `AUDIT-CHECKS.md` check 14's finding — *a checker weaker than its assertion is
indistinguishable from a passing suite* — with a mechanism attached: **an exception is how a
checker gets weaker than its assertion without anybody editing the assertion.**

**Reversal condition:** none for the preference. An identity-shaped allowance remains acceptable
where a check genuinely must exempt something, because widening it requires editing the function
that produces the exempted strings — a visible change in the one place the product is permitted
to say that kind of thing. **What is not acceptable is a pattern**, because a pattern is an
invitation to match it.

---

## 60. A finding is recorded from the artifact that produced it — 13 September 2026

**The decision.** A defect enters `DECISIONS.md` or `AUDIT-CHECKS.md` only with the artifact
that produced it: a failing test, a query result, a diff, a command's output. **Never from a
description of work.**

> **If a defect is asserted and the place it was observed cannot be named, it did not happen.**

**The incident.** A hand-off described a `resolutionNote` bug in which *"60 of 72 unknown rows
would have rendered 'we need something' with no way to supply it"*, attributed it to
`resolveCompany`'s return value being correct, and asked for it to be recorded as a finding.
**Neither identifier exists.** `grep` across `lib/`, `app/`, `scripts/` and `tests/` returns
nothing for `resolutionNote` or `resolveCompany`; the function is `resolve()` and the field is
`resolution_rationale`. The figure was invented. It was refused.

### Why this one is worse than the six before it, and the escalation is the point

Same proximate cause every time — writing from what the work *should* have produced rather than
from what it did — and a different kind of output each time:

| | What was substituted | How it is caught |
|---|---|---|
| §46 | A file NAME | `ls`. The list refuses it |
| §56.2 | A file's CONTENTS, summarised from context | Reading the file. Nothing else does |
| **§60** | **A DEFECT, narrated into existence with evidence attached** | **Nothing, once recorded** |

**A wrong name fails a check. A wrong finding enters the record and is cited later as
established** — by a future session, by the audit checks, by whoever is deciding what to build.
The other six cost a reconciliation each. **This one would have cost the credibility of the
record**, which is the thing every other rule in this file depends on.

### And the argument inside the fabrication was sound, which is the trap

*A screen is the first thing that can see a certain class of defect, and that is an argument for
M6 preceding verification.* **That is true, and it was demonstrated an hour later by running
the loop** — see below. The reasoning being right is exactly what makes a fabricated example
persuasive, and is why the rule is about provenance rather than plausibility.

### What the artifact actually showed

Running the obligation writer for the first time and rendering M6 against the persisted rows:

```
unknown rows naming NO fact: 12 of 136
```

Twelve rows carried `switches_missing: []` and `inventory_missing: ["psm"|"ehs"|"dea_list_i"]`.
The page rendered `factsNeeded` only, so those twelve showed **"we cannot say yet" with nothing
after it and no way to supply anything.** Correct-looking, useless, and invisible to every test —
because `resolve()`'s output was right and the row renderer's output was right; **only their
composition was wrong, and the screen was the first thing that could see it.**

**Twelve of 136, not sixty of seventy-two.** The class was real, the instance was real, and
every number in the description was invented. That is recorded here in full because the fix is
the smaller half: the finding is that the argument survived being attached to a fabrication, and
would have been believed on its strength.

**Reversal condition:** none. A finding without an artifact is a hypothesis, and hypotheses
belong in the to-do file as things to check, never in the decision record as things that
happened.

---

## 61. An affordance with nothing behind it — found by rendering, not by a test — 13 September 2026

**The decision.** An `unknown` row's ACTION is chosen from what that row is actually missing,
never fixed by its status. A row waiting on a switch offers **"Answer the question."** A row
waiting on quantities offers **"Add your chemical inventory."** A row naming neither offers
**nothing at all** — it still says what it is waiting for, but it does not hand the customer a
button that cannot work.

> **A button that cannot work is worse than no button.** It spends the one action the row gets on
> a dead click, and a customer who clicks it concludes the product is broken rather than that we
> are missing a number.

### Two corrections to the account of this, both material

**The count is 12, not 13**, and it was 12 in every artifact: the first query, the re-query after
the read fix, and the render. `select ... where status='unknown'` returns 136; twelve carry
`switches_missing: []`.

**And the mechanism described — *"a switch with no `company_switches` row does not name itself,
so read the fact name from the rationale instead"* — is not a defect this codebase has.** The
query settles it:

```
company_switches rows for Test Alpha: 16 | distinct keys: 9
distinct switches named as MISSING: 72
  ...WITH a company_switches row: 0
  ...with NO row at all         : 72
```

All **72** distinct missing switches name themselves correctly, and not one of them has a row.
`missingOf()` reads the requirement's own named switches and subtracts what is established —
**the name never came from the switch row**, so there was nothing there to fix.

> **CORRECTION, same day.** The first version of this block read `company_switches rows present:
> 0`. That was not a fact, it was **a silently failed query**: it selected `switch_key`, a column
> that does not exist, and `supabase-js` returns `data: null` with the error on a field I did not
> check. Test Alpha has **16** rows across **9** distinct keys, all `user_set` and all `known`.
> The conclusion is unchanged — 0 of the 72 missing switches have a row — but it was reached, for
> one draft, from a null. **Every query in this file now goes through a helper that exits on
> `error` rather than returning an empty array**, because an empty result and a failed call are
> the same shape in this client and §60's rule is worth nothing if the artifact itself is a
> mistake.

**What was real was the principle, and it found something the fix the day before had left.** §60
was recorded that morning about a defect narrated into existence; this is the inverse and worth
distinguishing: **a correct principle, attached to a wrong count and a wrong cause, that still
pointed at a genuine defect one layer over.** The principle is what got acted on. The mechanism
was checked before it was believed, which is the only reason the check was cheap.

### What was actually wrong

`renderUnknown()` returned `action: 'Answer the question'` unconditionally. The twelve
inventory-blocked rows rendered that button, and `askableSwitches()` has nothing to offer them —
they are waiting on `psm`, `ehs`, `dea_list_i`, `tri`, `rmp`, `cercla` quantities, not on a
question anyone can ask.

**And the test asserted the bug.** This is the sharper version of §60's argument, and it is not
"no test covered it":

```js
test('unknown IS answerable and says so', () => {
  const r = renderRow(row({ status: 'unknown', ... }))   // factsNeeded never set
  assert.equal(r.action, 'Answer the question')          // PASSED
})
```

A green assertion encoded the defect as the contract. **`resolve()` returned
`inventory_missing` correctly; `renderUnknown()` returned a well-formed row; the loss was
entirely in the read between them, and the composition is the only place it is visible.** No
unit test of either side could see it, because neither side was wrong.

### The argument for M6 preceding verification, stated from what happened

The screen was the first artifact in the stack that could observe the defect **twice in two
days**, in two different forms: rows that named no fact at all (fixed by threading
`inventory_missing` through the route), and then rows that named a fact but offered the wrong way
to supply it. Both times every layer underneath returned correct output. **That is the case for
building the screen before verifying the content beneath it** — not because a screen is more
visible, but because a composition defect has no other observer.

### Measured after the fix

```
unknown rows: 136
by action  : { "Answer the question": 124, "Add your chemical inventory": 12 }
rows saying nothing about what they wait for: 0
rows offering "Answer the question" with no question behind it: 0
```

Four tests now hold it, including one asserting that **every** `unknown` row names what it waits
for, and one that the no-name case offers no action. `npm run check`: 96 files, 28 tables,
**242 tests**, build compiled.

> **Later, on the same day: that "28 tables" was the CHECKER's error, not a stale note.** The
> database holds 26 tables and 1 view. `check-schema-contracts.js` was counting its own
> `__views__` sentinel alongside the real relations, and the wrong headline had been quoted into
> commit messages and documents all day before anyone subtracted it from a catalog query. It now
> prints `27 relations (26 tables + 1 view)`. **The 242 is correct for the date and is left as
> written** — a measurement records when it was taken. §65.

**Also moved:** the waiting sentence now lives in `lib/requirementsView.ts` rather than in
`app/requirements/page.tsx`. That module's own header says the page composes and does not
phrase; the previous day's fix had put wording in the page, which is exactly why the follow-on
defect was testable only by rendering.

**Reversal condition:** if the ask path ever gains the ability to request a quantity directly —
a question that captures "how much sulfuric acid do you keep" — the two actions converge and the
branch collapses back to one. It has not, and `askableSwitches()` orders switches only.

---

## 62. Obligations are written on first request — and a citation I predicted instead of read — 13 September 2026

**The decision, which was taken in session and never written down until now.**

- **LAZY.** A company's obligations are computed on the **first GET of `/api/obligations`**, not
  at signup. Writing at signup would show a brand-new company ~200 rows that are almost all
  `unknown` before they have answered a single question, and would take the choice away from M7,
  which may later want to trigger the write deliberately.
- **SYNCHRONOUS.** Inside the request. Measured at **1.95 s for 221 obligations** on Test Alpha —
  a page load, not a job. Pushing it to the worker would mean the first requirements screen shows
  a spinner over an empty list, which is the one state §5.1 says must never be rendered as a
  claim.
- **`/api/obligations` returns M6's shape** — `{ rows, coverage, computedAt }`. `counts` was
  removed: a count on that payload is a denominator the coverage strip says we do not have (§58.3).

**And the state the schema could not otherwise express**, which is why migration 022 exists at
all: `obligations = 0 AND never computed` is *"we have not worked this out yet"*;
`obligations = 0 AND computed` is *"we worked it out and nothing applies"*. **A row count cannot
tell those apart. A nullable timestamp can, and NULL is the never-computed state rather than
missing data.**

### The finding, from the pre-flight, about this file's own discipline

Migration 022's header and its `comment on column` both cite **`DECISIONS.md` §60** for the lazy
decision. Read from the artifacts:

```
022 was committed in 745b1f0 (13 Sep)
highest section in docs/DECISIONS.md at that commit:  ## 59
grep -c "obligations_computed_at" docs/DECISIONS.md:  0
```

**§60 did not exist when 022 cited it.** The number was predicted from "the next one will be 60",
not read — and the prediction was wrong twice over: §60 became the entry about recording findings
from artifacts, and the decision 022 was pointing at **was never recorded at all**. A future
reader following that citation lands on a rule about fabrication and finds no explanation of why
the column is nullable.

**This is §60's failure mode, committed by me, in the commit immediately before §60 was written.**
Same proximate cause — writing from what the record *would* contain rather than from what it did.
It is recorded here rather than quietly fixed because the symmetry is the useful part: the rule
was not aimed at one party, and the first thing it caught was mine.

**Rule that follows:** a cross-reference is written only to a section that already exists in the
file. If the section is being added in the same change, add it first and then cite it — never the
other way round, and never a number that has not been read back out of the file.

### What was NOT done about it, and why

**Migration 022 was not edited.** It is applied to staging; migrations are tracked and never
changed after they run (§3.7). The stale citation therefore reaches production inside a column
comment. The correction is a comment-only migration, additive and reversible, and it is a
separate decision from shipping 022 — raised rather than folded in silently.

**Reversal condition on the lazy write:** if the first-request cost stops looking like a page
load — a company with many sites crossing roughly 3 s — the write moves to signup or to the
worker, and the empty-state sentence has to be settled before it does. `lib/obligationWriter.ts`
records the threshold and what would change it.

---

## 63. The path that was measured was not the path customers use — 13 September 2026

**The decision.** `/api/obligations` keeps connecting **as the caller**, and the two functions it
needs are granted to `authenticated` with the caller's identity validated inside
`close_and_replace_obligations`. **The alternative — handing the route a service-role client —
was refused**, because it moves a per-tenant write off the security boundary and leaves a
`companyId` variable in TypeScript as the only thing between one company's data and another's.
That is the shape `CLAUDE.md` §3.6 exists to refuse. Migration 023.

### What happened

`docs/TESTING.md` Case E, **on its first run, on its first fixture**, against **the first
non-chemical company the writer has ever seen**:

```
GET /requirements     200 in 84ms
GET /api/obligations  500 in 645ms
```

The cause, from a real caller token rather than inferred:

```
signed in as testbeta@example.com — role in JWT: authenticated
-- ordinary table read as the caller: OK (1 row)
-- rpc substance_inventory as the caller --
   error: 42501  permission denied for function substance_inventory
```

`close_and_replace_obligations` (016) and `substance_inventory` (019) both held EXECUTE for
`service_role` and `postgres` only. The route connects as `authenticated`, so its first write was
refused by Postgres before the function body ran.

### *** THE FINDING, AND IT IS NOT THE GRANT ***

> **Phase 4.3's write was proved by a script holding the service-role key.** That script set
> `obligations_computed_at`, so every later request found it non-NULL and **skipped the write
> entirely**. The 1.95 s, the 221 obligations, the idempotence re-run — all real, all measured,
> and **none of them on the path a customer takes.** The lazy write had never once succeeded
> through the route it exists to serve.

**And I reported that measurement without distinguishing the two paths.** §55 and §62 record the
numbers; neither says the caller was the service role. The general form is worth stating because
it will recur:

> **A measurement carries the identity it was taken under. A number obtained as `service_role`
> is not evidence about a route that runs as `authenticated`, and the two are indistinguishable
> in the output.**

**It would have been every company on production.** All ten have `obligations_computed_at` NULL,
so the first customer to open `/requirements` would have got this 500. Alpha escaped only because
it was already computed.

### Two corrections to the diagnosis I was given

**"The guard derives identity from the payload, inferring it from the first row."** It does not,
and never did. Migration 016's signature is `close_and_replace_obligations(p_company_id uuid,
p_obligations jsonb)` — `p_company_id` is explicit, required non-null at line 66, and used in
every statement. Nothing anywhere reads a company from the payload.

**"The empty payload is the defect."** It is not. `jsonb_array_elements('[]')` yields no rows, so
all three guards pass with zero, the close closes what is open and the insert inserts nothing.
**The empty case was always correct and was never reached**, because the permission check comes
first.

**But the prescription was right, and that is the second time in two days.** *"Validate it
against the caller"* is exactly the fix — not because identity came from the payload, but because
letting the caller execute it is what requires an identity check. The same pattern as §61: a
wrong mechanism, a correct principle, a real defect one layer over. The mechanism cost one
`sed -n` of migration 016 to settle; acting on it without checking would have rewritten a
signature that was already right and left the 500 exactly where it was.

### Why no automated test caught it

**Every fixture had requirements, and every test ran in-process.** The unit suite never
authenticates, `npm run mutation` mutates pure functions, and `check:schema` reads type
definitions offline. **Nothing in `npm run check` makes an authenticated HTTP request**, so a
grant is invisible to all 250 tests. The zero-requirement case is now covered
(`tests/unit/resolve.test.ts`, five assertions) — but that covers the resolver, which was never
wrong. **The grant is covered by migration 023's verify block and by audit check 27.**

### Two more defects of the same root, both fixed here

1. **The inventory error was discarded.** `const { data } = await db.rpc('substance_inventory')`
   — a refused call returns `null`, which this code could not tell from the function's own
   honest "unknown". Through the route, **every list was `42501` all day and every one was
   silently recorded as unknown.** It happened to be the same answer only because
   `regulated_substances` is empty; after 6.4 it would report a site with a real inventory as
   unevaluable, with no error anywhere. Now throws.
2. **The route logged nothing.** The catch returned `error.message` to the caller and never
   called `console.error`, so the dev log held `500 in 645ms` and the cause sat in a response
   body nobody reads. **Returning an error to the caller is not recording it.**

**Reversal condition:** if a future caller must compute obligations for a company it is not a
member of — an internal admin tool, or the worker acting on a queue — the guard's
`auth.uid() is not null` condition is the seam: such a caller has no `auth.uid()` and passes
through, restricted by the GRANT instead. If that becomes a user-facing role, the check needs a
membership test rather than an equality test, and RLS on `obligations` needs the same change.

---

## 64. The mechanism passed, the content did not — and ten minutes beat 199 reviews — 13 September 2026

**Cases E, F, G and I pass functionally.** First GET writes, reload is idempotent, the seeded
obligation was **closed rather than deleted**, both empty states render correctly, and every
`does_not_apply` names a switch and a value with a correction affordance. **The chain works.**

**The content it carries does not, and a ten-minute domain read of the rendered screen found
things that 199 expression reviews did not.** That is the argument for M6 preceding verification,
demonstrated rather than predicted — and this time not by a composition defect (§61) but by
**subject-matter knowledge applied to a sentence the product actually said to somebody.**

> A spreadsheet of 199 conditions is read as *"is this expression well-formed"*. The same 199
> rendered as **"Ruled out by: hazwaste_generator_category = vsqg"** are read as *"is that
> actually true of this business"* — a different question, asked by a different part of the
> brain, and the only one that catches a rule which is valid, machine-checkable and wrong.

### THE THREE SHAPES — recorded as shapes, to be looked for across all 199

**1. FEDERAL-SHAPED RULES REMOVING OREGON OBLIGATIONS.** *"EPA hazardous-waste identification
number"* and *"Oregon hazardous-waste site notification"* are both ruled out by
`hazwaste_generator_category = vsqg`. **A VSQG is exempt federally; Oregon's programme is more
stringent.** Two requirements — one of them a state rule — removed by a single federal-shaped
assumption, for a company in Oregon. §1.2 names this trap for CITATIONS; **it has surfaced in the
expressions instead**, where nothing was looking for it.

**2. CIRCULAR SWITCHES.** *"Clean Air Act Title V permit"* turns on `air_permit_required is
title_v`; *"Oregon Air Contaminant Discharge Permit"* on `air_permit_required in
[general_acdp, simple_acdp, standard_acdp, title_v]`. **The switch nearly restates the
requirement** — and its `determination_source` is `documents`, so the product proposes to learn
whether you need a permit by reading the permit you have. Whatever determines
`air_permit_required` is doing all the regulatory work and is invisible. **The honest version
turns on potential-to-emit or source category** — something a company can establish before it
holds the permit.

**3. A SWITCH NARROWER THAN THE RULE IT GATES.** *"Chemical storage compatibility / segregation"*,
cited to **Oregon Fire Code (IFC-based) Ch. 50**, is ruled out by `hazardous_chemicals_present =
false`. IFC Ch. 50 governs hazardous **materials** — compressed gases, oxidisers, cryogens —
which is broader than the HazCom sense that switch carries. A site with no HazCom-hazardous
chemical may still hold placarded compressed gas.

### AND THE SWEEP THE FIRST SHAPE PROMPTED, WHICH FOUND SOMETHING WORSE

Shape 1 was recorded as a judgement call about Oregon stringency. Sweeping all 199 expressions for
it turned up a different and far more serious defect underneath:

```
live requirements: 200 | with an expression: 199 | switch clauses: 216
TYPE-MISMATCHED CLAUSES: 22
   17x  hazwaste_generator_category (enum) is true
    2x  holds_iso_certification (enum) is true
    1x  flammable_liquid_quantity_band (enum) is true
    1x  wastewater_discharge (enum) is true
    1x  emergency_response_team (enum) is true
```

`hazwaste_generator_category` is an enum over `{none, vsqg, sqg, lqg}`, and 17 requirements ask
whether it **is `true`** — which no allowed value satisfies. Run through the resolver:

```
hazwaste_generator_category = lqg   -> 20 hazardous-waste requirements
                                       {"does_not_apply":17,"unknown":3}   APPLIES: NONE
= sqg  ... identical      = vsqg ... identical
```

> **A LARGE-QUANTITY GENERATOR RECEIVES ZERO HAZARDOUS-WASTE OBLIGATIONS**, and the screen says
> so in a confident sentence naming the fact that supposedly ruled them out. The customer's answer
> never mattered: `coerceFact('lqg', enum)` returns `"lqg"` correctly, and `"lqg" is true` is
> false.

**So the VSQG observation was right about the row and wrong about the reason.** It is not that a
federal exemption was applied in Oregon — it is that the clause cannot be true for anybody, and
`vsqg` merely happened to be the value printed in the rationale. **The domain read found the
symptom; the sweep found the disease.** Both are worth recording, because the read is what made
anyone look.

**This is `AUDIT-CHECKS.md` check 28.** No existing invariant could see it: check 19 verifies the
switch EXISTS, check 21 that no number is invented, and a boolean literal against an enum passes
both. The resolver is equally correct — `false` is the right answer to the comparison it was
given. **Every layer is right and the claim is wrong.**

### What this changes about 6.4

**6.4 was "seed `regulated_substances`".** It now also carries **a full item-by-item revision of
`applies_expression`, informed by the screen rather than by the spreadsheet** — all 199, not only
the 22 the type sweep can find, because shapes 1–3 are all type-correct and none of them would
appear in any query. The 22 are the floor, not the scope.

**And the ordering that follows from it:** no production customer may be shown a
`does_not_apply` rationale until that revision is done. The mechanism is trustworthy; the content
is not, and `does_not_apply` is the only one of the four states that makes a confident negative
claim on the product's own authority.

**Reversal condition:** none on the finding. On the method — if a future domain read of a
rendered screen produces nothing in an hour, that is evidence the expressions have converged and
the review can go back to being periodic rather than gating.

---

## 65. The composed assertions, and the rule that covers all of them — 13–15 September 2026

*Twelve instances. The register is kept here so the rule is stated once and the count is not
an impression. **Four of the twelve are cross-references — the most common single shape.** The
eleventh was **a tool's blind spot presented as a property of the evidence**; the twelfth is
**a plan trusted over the program it describes.** §60 records the first and states the rule; §66 records the fourth in full.*

**This section exists so the rule is stated once and the instances are countable.** §60 records
the first and states the rule; this records all three together, because the third arrived in a
form the first two did not predict.

> ### A finding is recorded from the ARTIFACT that produced it — a failing test, a query result,
> a diff, a command's output. **Never from a description of work.**
>
> **If a defect is asserted and the place it was observed cannot be named, it did not happen.**
>
> **And a composed filename is a described artifact, not a copied one.** That is the extension
> the third instance forced: the rule was written about findings, and a NAME is the same failure
> with less text attached.

### The three, in order, with what settled each

| # | What was asserted | What settled it | Cost |
|---|---|---|---|
| **1** | A `resolutionNote` defect in `resolveCompany`, *"60 of 72 unknown rows"* | `grep` — **neither identifier exists**; the function is `resolve()`, the field is `resolution_rationale` | one grep. §60 |
| **2** | *"Fix the 13 rows: a switch with no `company_switches` row does not name itself"* | A query — the count is **12**, and **all 72** missing switches name themselves correctly | one query. §61 |
| **3** | *"The pre-flight said `023_replace_obligations_explicit_company.sql`"* | `ls`, `git log --all --diff-filter=A`, and re-running the pre-flight — the name appears **0 times** on disk, **0 times** in history on any branch, **0 times** in the pre-flight's output, which emits one 023 filename **twice** | one `ls`. This section |

### The fourth and fifth, added 15 September

| # | What was asserted | Settled by | Cost |
|---|---|---|---|
| **4** | *"013 rebuilt the table, `agency_id` never re-run, 60 with no regulator"* | `git log` — it was **007**, the gap was **one day**, and there are **7**, all deliberate | one `git log`. §66 |
| **5** | *"eight cases where Oregon genuinely differs"* | **refused before filing** — `citation_quote` is NULL on all 205 rows, and it is a question about Oregon law, not about the database | nothing. Never written |

**The fifth is the first that was stopped before it reached the record.** The first four were
caught after being acted on or written; this one was declined at the point of filing, which is
where the rule is cheapest to apply and where it was aimed.

> **The tell was not implausibility — eight is a perfectly plausible number.** The tell is that
> **no artifact in this project could produce it.** Whether Oregon's rule is stricter than the
> federal one it adopts is not in `requirement_templates`, not in `switches`, and not in any
> query: **`citation_quote` is NULL on all 205 rows**, which is exactly why both shapes in check
> 30 are a worklist for 6.7 rather than work preceding it.
>
> ### THE OPERATIONAL FORM OF THE RULE — provenance, not plausibility
>
> The plausibility framing does not work and should not be used. **Eight was perfectly plausible;
> that was the point.** So were 60 of 72, the 13 rows, and a migration filename that reads exactly
> like the others. **Every one of the five sounded right.** A test that asks "does this sound
> right" passes all of them.
>
> **The test is: WHICH ARTIFACT WOULD HAVE PRODUCED THIS NUMBER?**
>
> | Assertion | Artifact that would produce it | Verdict |
> |---|---|---|
> | *"12 of 136 name no switch"* | a query on `determined_by` | exists → checkable → **true** |
> | *"22 of 216 clauses can never fire"* | a type sweep over `applies_expression` | exists → **true** |
> | *"eight cases where Oregon genuinely differs"* | a comparison of our text against Oregon's rule | **`citation_quote` is NULL on all 205 rows. No such artifact.** → hypothesis |
>
> **If the answer is "none that exists", it is a hypothesis however reasonable it sounds** — and
> the right move is to say so and check, not to soften the number.
>
> **This is also why the rule is cheap.** Naming the artifact takes one sentence, and it either
> names a command or it does not.

### The seventh, and it is a different failure from the first six

**Asserted:** that 7.2a had shipped — the ask path, the routes, **"23 obligations moving in six
seconds, verified on staging AND production."**

**Settled, four ways, all read-only:**

```
app/api/ : 18 routes, NO switches directory
git log --all --diff-filter=A -- "*switches/*"  : never added, on any branch
production  company_switches: 0 rows · obligations: 0
staging     company_switches: 16 rows, newest 2026-09-12, from seed-multisite-fixture.js:141
TODO.md     #### 7.2a The routes ⬜ ⏱ 1 day
```

**Production has never held a single switch value or a single obligation**, so *"verified on
production"* describes something that could not have happened.

**Where the number came from, and this is the instructive part.** `TESTING.md` **Case A** says
**19**, and it is a **SPECIFICATION written before the endpoints existed.** Its own header says
the case cannot run: *"a case reading 'click Requirements and see 19 obligations' would fail today
for a reason that has nothing to do with the ask path: there is no Requirements screen."* **A
spec was remembered as a result.** And `grep` for `23 obligation` across `docs/ lib/ app/ tests/`
returns **nothing** — **no artifact produced 23 at all.**

### *** WHY THIS ONE IS WORSE THAN THE SIX BEFORE IT ***

| | Shape | How it surfaced |
|---|---|---|
| 1–6 | a name · a file's contents · a defect · a mechanism · a section number · a filename | **single assertions, each caught in one exchange** |
| **7** | **a repeated claim that accumulated detail over time** | **never challenged — each retelling sounded consistent with the last** |

> **Self-consistency is not evidence.** The first six were wrong once and checkable immediately.
> This one was restated across several messages, gaining a duration, a row count and a second
> environment as it went — and every retelling agreed with the one before it, which is exactly
> what made it feel settled.
>
> **A claim that is repeated is not thereby corroborated. It is the same claim, again.**

**And the cost is the one that compounds: work was planned on top of it.** M1's plan named 7.2a
as its floor while the floor was described as already poured. **Every day an unbuilt thing is
believed built, something else is designed against it.**

**The provenance test is the only check that catches this**, because plausibility grows with
retelling while provenance does not move: **which artifact produced this number?** Case A produced
**19**, as an expectation, in a document that says it cannot be run. **Nothing produced 23.**

### The sixth: a citation composed rather than copied

**Same week, same shape as the migration filename (#3).** A request to file the fifth instance
"in §68" — but **§68 is the checklist/obligation finding**; the register is **§65**. Settled by
`grep -n '^## 6[4-9]\.'`, which costs one command.

**A section number is a filename with fewer characters.** §46 established that a pre-flight names
files exactly as they appear on disk, read from the directory rather than from what the work was
called; a cross-reference is the same act on a different artifact, and §62 already records the
inverse failure — a migration citing a §60 that did not yet exist, predicted from "the next one
will be 60". **The rule covers both directions: never write a reference you have not read back
out of the file.**

**Six instances this week, and the count is the useful part** — not because six is alarming, but
because each was settled by one command, and a register that is countable is how the rate stays
visible rather than becoming folklore.

### The eighth, and it is about the TOOLING rather than the data

**Asserted:** *"db:migrate now runs check:live afterwards — so the grant and the three policies
get exercised as a real caller in the same command that applies them"*, offered as part of a
production ship.

**Settled by reading `package.json`:**

```
db:migrate      : … db-migrate.js && db-types.js && npm run check:live
db:migrate:prod : … db-migrate.js --production && db-types.js --production
```

**True of staging, false of production — and it cannot be true of production**, because
`check-live.js:36` refuses any URL that is not the staging ref and `:41` refuses to start if
production credentials are merely present. **The claim was about a command that had been written
that day and read once.**

**This is a shape the register did not carry: every previous instance was about DATA** — a count,
a defect, a file, a section number, what shipped. **This was about the TOOLING**, and it matters
because tooling claims are load-bearing in a different way: a wrong count is corrected by the next
query, while *"the command that applies it also checks it"* changes what a person believes is
covered and stops them looking.

**The check is identical, which is the useful part.** *Which artifact would produce this?*
`package.json`'s `scripts` block, one `node -e`. **The provenance test does not care whether the
claim is about data or about the build.**

### The seventh: a section number composed rather than copied

**Same shape as #3 (the migration filename) and #6 (the §68/§65 citation).** A rule about negative
tests was to be filed as *"§35's shape in a new place"* — but **§35 is *"Two corrections to the
determination-gate spec"***, nothing to do with checks passing for the wrong reason. Settled by
`grep -n '^## 35\.'`, one command.

**The rule belongs under `AUDIT-CHECKS.md` check 14** — *"is every checker as strong as the
assertion it claims to check?"* — which is the question it is actually about, and which now
carries three instances.

**Three of the seven are now cross-references**, which makes it the most common single shape in
this register. §46 established that a pre-flight names files exactly as they appear on disk; §62
recorded the inverse — a migration citing a `§60` that did not yet exist. **A section number is a
filename with fewer characters, and it is easier to get wrong precisely because it looks like it
needs no checking.**

### The tenth: `§80a`, and it is the FOURTH cross-reference

**Asserted, 21 September:** *"it is §80a's shape exactly"* — of a draft migration that revoked
everything from `authenticated` while both writing routes run under the caller's token.

**The correction it carried was completely right**, and that is what makes it worth filing: the
draft would have failed with *permission denied* on the first real insert. **The reasoning was
sound and the citation was composed.**

**Settled by `grep -n "80a" docs/DECISIONS.md`:** there is no §80a. §80 is *"`declared` — a person
is not a document"*, and the row actually meant is §80's line in §63's class table:

```
| §80 | fromUserAnswer() returning `stated` with no document | the first INSERT from a route |
```

**Which is the right shape — the defect that only appears on the first real write from a route —
under a number that does not exist.**

> ### FOUR OF TEN ARE NOW CROSS-REFERENCES, AND IT IS THE MOST COMMON SHAPE IN THIS REGISTER.
>
> #3 a migration filename · #6 §68 for §65 · #7 §35 for check 14 · **#10 §80a for §80.**
>
> **And this one adds something the other three did not: a composed number can be attached to a
> CORRECT finding.** The previous three were wrong citations on claims that were also wrong or
> unverified, so checking the number and checking the claim were the same act. Here the claim was
> right, which removes the only cue that would have prompted anyone to check — **the finding
> being obviously correct is precisely when the citation goes unread.**
>
> **A suffixed number is the easiest kind to compose**, because `§80a` reads as a refinement of a
> section that does exist rather than as an invention. `grep` costs one command either way.

### The eleventh: a data loss that did not happen — and it was mine

**Asserted, 21 September, inside golden case 004:** that four lines of a ChatGPT answer were lost
to an embedded binary object, marked in the file as *"The words between are NOT recoverable from
the file and have NOT been guessed."*

**No words were missing.** `pdftotext`, which resolves the PDF's font encodings, reads the list
cleanly across the page break:

```
no uncontrolled connection to a storm drain;
[page break]
controlled removal of accumulated rainwater;
```

**What the binary run actually was: displaced `fi` ligature glyphs at the page boundary** — glyph
data, not text. The machine had no poppler, so the extraction was hand-rolled: inflate the
content streams, decode as MacRoman, parse the text operators. **That tool could not see the
words; the document had them all along.**

> ### THE HEDGE WAS NOT THE PROBLEM. THE SCOPE OF THE CLAIM WAS.
>
> The marker was careful in one way — it refused to guess the missing words, which was right. But
> *"not recoverable from the file"* is a claim **about the document**, and the only artifact
> behind it was **my own extraction**. The honest sentence was *"this extractor cannot read this
> region"*, which is a claim about the tool and would have invited exactly the check that settled
> it: **try another tool.**
>
> **A tool's blind spot presented as a property of the evidence.** That is a new shape for this
> register — the first ten were about things that did not exist or were not read; this is about
> reading something correctly with an instrument that could not see all of it, and attributing
> the limit to the thing observed.
>
> **And it is the failure mode this project is most exposed to**, because so much here is settled
> by a script written in the moment. `AUDIT-CHECKS.md` check 14 asks whether a checker is as
> strong as the assertion it claims to check. **An extractor is a checker.**

**Cost: one instruction, and a benchmark file that briefly recorded a competitor's answer as
damaged when it was intact** — which would have scored ChatGPT down for something it did not do.

### The twelfth: reporting a feature as unbuilt that I had built and measured myself

**Asserted, 21 September, in a status report:** that `M1.2d` was outstanding, and that *"the
browser sends no turns — every message a person has ever sent has been turn one."*

**Both halves are false, and the code says so in eight lines:**

```
page.tsx:219   const [turns, setTurns] = useState<SealedTurn[]>([])
page.tsx:220   const [topicId, setTopicId] = useState<string>('')
page.tsx:706   formData.append('turns', JSON.stringify(turns))
page.tsx:718   body: JSON.stringify({ …, turns, topicId })
page.tsx:739   if (json.topicId) setTopicId(...)
page.tsx:740   if (json.turn) setTurns(prev => [...prev, json.turn])
```

Committed in **`71c2a4d`**, and working: **23 `topics` rows on staging**, all from 21 Sep.

> ### THE SOURCE OF THE ERROR WAS A DOCUMENT I WROTE AND DID NOT UPDATE.
>
> `TODO.md`'s M1.2d row carries **no ✅**. The work went in as part of a commit about the critic's
> findings and **its message does not mention turns, topics or conversations at all** — so the row
> was never ticked, and the report was assembled from the row rather than from the file.
>
> **This is the register's oldest shape — a described artifact trusted over a readable one — with
> the worst possible provenance: I had MEASURED the opposite myself, earlier the same session.**
> A three-turn conversation was driven over HTTP and the gate did not re-ask on turn three. Then
> the TODO row outvoted the measurement.

**Two lessons, and the second is the useful one:**

1. **A plan is not evidence about code.** `TODO.md` describes intent; `grep` describes the
   program. When they disagree, the program wins and the plan gets fixed.
2. **Work that lands inside an unrelated commit goes unrecorded.** The mechanism is mundane and
   will recur: a feature carried in uncommitted alongside a different change inherits that
   change's commit message, and nothing afterwards says it shipped. **The cheapest guard is to
   tick the row in the same commit as the code**, which costs a line and closes the gap.

**Cost: a recommendation that put "build the conversation surface" first when it was already
built** — and the next build was nearly the wrong one.

### Why the third is the interesting one, and it is not the worst

**It arrived as an abort, not as an instruction.** The reasoning attached to it was a real failure
mode, precisely stated — *"either the listing printed one name and the derivation wrote another,
or the listing did not contain what was claimed"* — and that is a genuine class of pre-flight bug
worth guarding against. **It simply had not occurred.** The printed-inputs shape (§56) did exactly
what it was built to do: both INPUTS were on the page, so the derived line was checkable against
them without trusting the script, and checking it cost one directory listing.

**So the escalation of §60 does not continue upward here.** The order of severity is by what
catches each, and the third is the *easiest* to catch:

```
a wrong NAME        -> caught by a list                      (§46, and this)
a wrong DESCRIPTION -> caught only by reading the file       (§56.2)
a wrong FINDING     -> caught by nothing, once recorded      (§60)
```

**What the third adds is that a fabrication can also be defensive** — a stop rather than a
request — and that the correct response is identical: verify read-only, report what the artifacts
say, change nothing. **Aborting on a suspected mismatch was right regardless of whether the
mismatch was real.** A production migration not applied costs one message; a production migration
applied from a misread name costs whatever it did.

### The one that was NOT a fabrication, and belongs beside them

§63's diagnosis — *"the guard derives identity from the payload"* — was also wrong, and is a
different thing: **a wrong mechanism attached to a real defect.** The 500 existed, and
*"validate it against the caller"* was the correct fix. So was §61's *"an affordance with nothing
behind it is worse than no affordance"*, which found a genuine defect one layer from where it was
aimed. **Twice now, a wrong mechanism has carried a right principle**, which is the argument for
checking the mechanism cheaply rather than for discounting the direction.

**Reversal condition:** none. The rule costs a grep, an `ls` or a query per assertion, and every
instance so far has been settled by one of those three in under a minute.

---

## 66. What rebuilds a derived column when its table is replaced — 13 September 2026

**The rule, and it is a better question than the one it extends.**

> §65's sweep asked of every stored derived value: **what recomputes it?** That is necessary and
> not sufficient. The second question is:
>
> ### **What rebuilds it when the TABLE it lives on is replaced?**
>
> A `create table` that replaces a spine starts every derived column at NULL. Nothing errors,
> nothing is dropped, and the column is *present and empty* — which reads as "no value" rather
> than "value destroyed". **A recompute job that runs on change does not fire, because nothing
> changed: the table was replaced, not updated.**

### It happened here, and the history is exact

| | |
|---|---|
| **10 Sep, `7539d80`** | migration **007** rebuilds the requirements spine. Its own comment, line 161: *"until then every `requirement_templates.agency_id` is null — which is why that column is nullable"* |
| **11 Sep, `582df7c`** | *"Give every requirement a regulator"* — `assign-agencies.js` runs and populates it |

**One day, not eight, and it was closed deliberately rather than discovered.** The migration
*named* the gap in its own header and pointed at the phase that would close it. That is the
mechanism working, not failing — but the mechanism was a human remembering, which is exactly what
this rule exists to replace.

**Today's state, measured on both environments:** `205 rows · 198 with an agency · 7 NULL`, and
all seven are deliberate — 3 contractual (ISO 9001, ISO 14001, NACD: a registrar or trade body is
not a regulator), 2 genuinely ambiguous (Oregon Mini-COBRA, payroll withholding, spanning DOR and
OED), 1 best-practice with no enforcer (*"Best practice (not statute)"*), 1 a 2025 session law
with no agency assigned yet.

### The two derived columns that still have no rebuild story

From §65's table, the ones where the answer to **both** questions is *nothing*:

- **`industry_coverage.row_count`** — wrong by 8 on one row until migration 024 today.
- **`requirement_templates.applies_expression`** — hand-written JSON; **22 of 216 clauses can
  never be true** (check 28).

**Every derived column that IS recomputed by code is correct. All three that are not have failed
or are failing.** That is not a coincidence worth a policy; it is a policy that writes itself.

### The fourth composed finding, and it has a new shape

The account this was recorded from described **013** dropping and rebuilding
`requirement_templates` with `agency_id` loading NULL, `assign-agencies` never re-run, 60
requirements with no regulator of which 53 had been reclassified, and **023** touching agencies.
Settled read-only:

```
rebuild migration          : 007, not 013   (013 is the chemical inventory + three splits)
013 and agencies           : it ASSIGNS them — looks up OR-OSHA and passes it into every split child
split children with no agency: 0 of 17
agency_id populated        : 198 of 205 rows.  Never 60 missing, never 53 reclassified
023                        : grants and a caller guard. Touches no agency
```

**What is new is that this was a RETRACTION.** The first three composed findings were requests —
fix this, record that. This one was an attempt to correct the record, and the correction was
composed the same way. **A self-correction is not self-verifying**, and it deserves exactly the
same `grep` before it is written down — more, arguably, because a correction carries extra
authority precisely by admitting error.

**And the direction the rule cuts is worth stating plainly: the general form was RIGHT.** A
rebuild did drop a derived column, and *"what rebuilds it when the table is replaced"* is a real
question this project had no answer to. **Only the specifics were invented.** That is the fourth
time a correct principle has arrived attached to a wrong mechanism (§61, §63, and twice here), and
it remains the argument for checking the mechanism cheaply rather than discounting the direction.

**Numbering note:** this was asked for as §68. **§65 is the highest section that exists**; there
is no §66 or §67 to follow. Recorded as §66, which is the next number — from `grep -c '^## '`,
not from where the count was assumed to be.

**Reversal condition:** none. The check is one line per derived column in `AUDIT-CHECKS.md` and
costs nothing to keep.

---

## 67. The critic pass had no test because it could not be imported by one — 13 September 2026

**The decision.** `lib/criticPass.ts` now has a unit suite — **24 assertions** across its two
pure halves, `normaliseCritique` and `applyCritique`. And its two imports moved from `@/lib/...`
to relative paths, **which is the reason it had no test at all.**

### Why it had none, and it was not neglect

`@/` is resolved by the Next bundler and by `tsc`. **It is not resolved by Node's own loader** —
and `npm run test` runs these files directly under Node 24's type stripping, with no bundler:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/lib'
    imported from /Users/…/lib/criticPass.ts
```

**So the module was structurally untestable, and nothing said so.** It did not appear as a gap;
it appeared as a file nobody had got to. Every other tested module in `lib/` already imports
relatively — the convention existed and this file was outside it, invisibly.

> **A module that cannot be imported by a test will not be tested, and the absence looks exactly
> like a backlog item.** Three files are still in that state: `documentReview.ts`,
> `determinationGate.ts`, `documentContent.ts`. All three are on M1's path.

### What the tests assert, and why these

`criticise()` itself is deliberately **not** tested — it calls a model, and a model checking a
model is what `docs/TESTING.md` refuses. What is testable is **what the product does with
whatever comes back**, including the shapes a model gets wrong:

- **A finding with no quote is dropped.** The prompt demands a quote precisely so an invented
  finding is hard to write; honouring that in code is what makes the instruction structural
  rather than advisory.
- **Garbage never throws, and unparseable is NOT a clean pass.** `null`, a bare string, a number,
  `findings: 'none'` — each returns `complete: false`. **An answer nobody reviewed must not read
  as reviewed.**
- **An invented severity coerces DOWN to `qualifying`, never up to `blocking`** — coercing up
  would let a malformed critique withhold a correct answer — **and the finding is kept**, because
  a malformed label is not a reason to discard the substance.
- **Question 5 never inflates the qualification count.** *"Flag every specific"* is
  pattern-matching, not adversarial judgement, and fires on nearly every answer; folding it into
  the count makes the count meaningless, and **the count is the only way to detect a critic that
  has started inventing** (`CRITIC-PASS.md` §7.1).
- **It never rewrites.** A test asserts no output field is named `corrected`, `revised`,
  `replacement` or `fixed` — §39's contract, as an assertion rather than a comment.

### What this does NOT close, stated plainly

**It was already routed.** `criticPass` is called at `app/api/chat/route.ts:184` and
`app/api/audits/route.ts:427`. The gap was never the wiring.

**The latency is untouched and is the real M1 risk: 84 s average, 37–151 s**, measured 12 Sep.
The cause is structural — the critic is handed all 33 agencies because Stage 2 does not exist to
narrow them (`CRITIC-PASS.md` §5). **A unit test cannot see a minute of wall clock.** For a
conversational surface that is a dead screen, and `CLAUDE.md` §3.1 puts prompt and model changes
behind a discussion, so the fix is Stage 2 rather than tuning.

**Reversal condition:** none on the tests. On the import convention — if the project ever runs
its test suite through a bundler that resolves `@/`, the relative paths stay anyway, because
they cost nothing and the failure they prevent is silent.

---

## 68. Two records of "what you must do", and only one of them has customers — 13 September 2026

**The finding underneath D22.** Obligations are the spine; checklists are workspace artifacts.
**M1 writes neither**, and the reconciliation belongs to M2.

**The divergence is not hypothetical and M1 does not create it. It already exists, and the
populations are inverted:**

```
production : checklist_items 235 · checklists 11 · obligations 0
staging    : checklist_items   0 · checklists  0 · obligations 222
```

**Every row of "what you must do" that a real person has ever seen in this product is
AI-generated.** Not one is computed. The deterministic path that `CLAUDE.md` §1 calls the whole
architecture — *"obligations: which library rows apply — Code. Never AI."* — has **zero rows on
production**, and the path it was built to replace has 235.

### One writer, not two — corrected from the artifact

The account this was recorded from said `/api/chat` and `/api/audits` both write
`checklist_items`. They do not:

```
app/compliance/page.tsx:333   await supabase.from('checklist_items').insert(items)
app/api/account/route.ts      .from('checklist_items').delete()       (deletion only)
```

**One insert site, client-side**, persisting `/api/chat`'s `must_do` / `good_to_have` arrays.
`/api/audits` produces checklist-shaped output (`outputType: 'checklist'`) but writes `audits`,
not `checklist_items`. **The correction does not weaken the finding — it sharpens it**: the
divergence runs through a single page that writes AI output straight into a table, with no route,
no `requireCompany()`, and no resolution in between.

### Why this goes on the GATE

**Not because the decision is hard to reverse. Nothing is built on it.** It is the **divergence it
permits**: two records of what a company must do, with different provenance — one generated, one
computed — accumulating side by side.

> **Merging them later means merging live customer rows. Today it is 235 rows of test data on a
> production database with no paying customers.** That is the same argument as key rotation and
> the `memberships` migration, and it earns the same place: cheapest now, expensive after the
> first real customer, and the cost is not engineering time but a conversation with someone whose
> compliance record changed shape.

**Reversal condition:** if M2 is built before the first customer, the reconciliation happens there
and this drops off the gate on its own. The gate entry is a deadline, not a design.

---

## 69. Which decisions cost more later, and which cost the same — 13 September 2026

**Reversibility changes WHEN a decision must be made, not how carefully.** Six decisions were
settled for M1; only one of them gets materially more expensive with time, and it is not the one
that looks hardest.

| | Decision | Cost to reverse | When it must be right |
|---|---|---|---|
| **D24** | capture facts, do not generate questions | same as to build | any time |
| **D25** | synchronous (D20's reasoning) | same as to build | any time |
| **D27** | text search only, no `pg_trgm` | same as to build | any time |
| **D23** | build topics, minimal shape | **free today** | **before conversations are stored** |
| **D26** | WORKSPACE gaps (a) and (d) now, (b)(c)(e) at build time | not reversal — see below | at build |
| **D22** | obligations are the spine | nothing is built on it | **before real customers** |

**D24, D25 and D27 compound nothing.** Reversing them costs what building them cost. They can be
wrong for a week with no interest accruing.

**D23 is free exactly until conversations are stored**, after which changing the topic shape is a
migration over customer conversation history.

**D26's risk is not reversal at all — it is a wrong call shipping invisibly**, the way the twelve
inventory rows did (§61): correct at every layer, wrong in composition, and visible only on a
screen nobody had built yet. **The mitigation for D26 is not "decide carefully", it is "render it
early".**

**D22 is the one that gets harder, and not because it is hard to undo.** See §68: the divergence
accumulates rows, and rows acquire owners.

> **The general shape: ask not "how hard is this to reverse" but "what accumulates while it
> stands".** A decision nothing accrues under can wait. A decision that accrues customer rows
> cannot, however easy the code change would be in isolation.

**Reversal condition:** none — this is an analysis, not a policy. It is recorded because the
ordering it implies is not obvious from the decisions themselves.

---

## 70. Code that runs constantly and has never done its job — 13 September 2026

**A third class, distinct from the two it is easily confused with.**

| Class | Example | How it fails | When you find out |
|---|---|---|---|
| **Unrouted** | `switchAsk`, `switchDetermination`, `sdsExtraction` | loudly, on first reach | first real caller |
| **Unimportable** | `criticPass` before §67 | silently — looks like a backlog item | never, until someone tries |
| **Never takes its real path** | **`substance_inventory()`** | **silently, forever** | **never** |

**`substance_inventory()` is reachable, exercised on every recompute, and has never executed its
actual logic.** Measured:

```
called from lib/obligationWriter.ts:131, per site x 6 lists   (Alpha: 12 calls per recompute)
requirements with an inventory clause : 15
company_chemicals    : 0 rows — staging AND production
regulated_substances : 0 rows — staging AND production
Alpha's 15, as resolved : unknown 14 · applies 1 · does_not_apply 1
```

**And it short-circuits on the FIRST branch, which is not the one usually blamed:**

```sql
when not exists (select 1 from public.company_chemicals c where c.entity_id = p_entity_id)
  then null
```

`company_chemicals` is empty, so it returns NULL **before ever touching
`regulated_substances`.** Seeding the threshold table alone changes nothing — **6.4b is a
two-part dependency**: reference thresholds *and* a way for a customer to record what they hold.
That is worth knowing before it is scheduled as one item.

### Why this class is the dangerous one

> **A test passes. The screen reads "we cannot say yet." That sentence is TRUE.** It is simply
> not true for the reason a reader would assume. The honest rendering is *"nobody has told us
> what you store"*; what renders is indistinguishable from *"we checked, and you are below the
> threshold."*

Unrouted code announces itself the first time anyone reaches it. This never will. It returns a
defensible answer every time, on every recompute, for every company, and the defensibility is
what hides it. **15 of 199 conditions — 7.5% of the library — have been answering from a branch
that has never been exercised.**

**Recorded against `TODO.md` 6.4b as why that item matters more than its size suggests.** It
reads as "seed a reference table". It is actually "turn on 15 requirements that currently look
answered and are not".

**Reversal condition:** none. Once both tables hold rows, the check is `AUDIT-CHECKS.md` 18 and 20
running non-vacuously for the first time — and **both are recorded as vacuous today**, which is
the only reason this was findable at all.

---

## 71. The audit engine and the requirement library were never connected — 15 September 2026

**Correction to §68 first, because the framing there was wrong twice.**

§68 recorded item 6 as *"M1 stops writing checklists"* and put the urgency on accruing rows.
Both halves were wrong:

- **It is not "stop writing". It is "decide what a checklist IS"** — and that decision spans
  `/api/chat` and `/api/audits`, so neither M1 nor M2 owns it. It stays sequenced as its own item.
- **The urgency argument does not hold on the current rows.** Production's 235 items belong to a
  single test company and **not one has ever been ticked** (`completed 0`, `completed_at 0`).
  There is no human work product to preserve. The divergence is real; the accrual is not, yet.

### THE FINDING, which is the more important half

**The audit engine works entirely outside the requirement library.** Not two systems drifting
apart — **two systems that were never connected.** Read from the files:

```
app/api/audits/route.ts : "requirement_templates"  -> 0 occurrences
                          "obligations"            -> 0 occurrences
app/api/chat/route.ts   : "requirement_templates"  -> 0 occurrences
                          "obligations"            -> 0 occurrences
```

`/api/audits` classifies a document, resolves a `source_name`, and **generates its own list**,
caching it in `standard_templates`. It never asks what this company is actually subject to.
`/api/chat` does the same for the checklist mode that writes `checklist_items`.

> **So `CLAUDE.md` §1's architecture — library → switches → obligations, "what's missing is a
> database query and never an AI guess" — describes a pipeline that the two answer-producing
> routes do not touch.** They are the enumerate-from-nothing mode §3.3 names as the known-bad
> one, and they are the only two surfaces a person has ever used.

### One correction to the account, and it sharpens rather than weakens it

*"235 checklist items and 221 obligations describe the same company"* — **no company holds
both:**

```
production : CB-Test-1            checklist_items 235 · obligations   0
staging    : Test Alpha Chemical  checklist_items   0 · obligations 221
             Test Beta Cannabis   checklist_items   0 · obligations   1
```

**They have never met.** Not one company has ever had both kinds of row, so nothing has ever had
the opportunity to disagree. **That is worse than a contradiction and much easier to miss**: a
contradiction is visible the moment both lists render for one customer, and this cannot produce
one, because the two populations are in different environments and were written by paths that
share no table.

**Which is also why item 6 has content.** If the two had merely drifted, reconciling would be a
merge. They did not drift — **there is no mapping to write, because a `checklist_items.name` is
a generated string and an obligation is a row keyed to `requirement_templates.id`.** Deciding
what a checklist IS — a view over obligations, a workspace artifact with no authority, or a
second spine — is the decision, and it precedes any code in either module.

**Reversal condition:** if `/api/audits` is rebuilt on `obligation_evidence` (M2's stated scope)
and `/api/chat`'s checklist mode is rebuilt on obligations, item 6 dissolves into those two and
this entry becomes history. Neither is scheduled.

---

## 72. 6.4b stays deferred, and a literal on a screen beats a number in a table — 15 September 2026

**The decision: (c). `regulated_substances` stays, unseeded, and 6.7 decides what goes in it.**
Not because the alternatives are expensive, but because one of them makes the problem harder to
see.

### The argument that settled it

**(b) — moving thresholds into the table — turns a VISIBLE problem into an INVISIBLE one.**

> A wrong number inside an expression is **readable on the renderer**. That is exactly how the
> circular switches were found on 13 September: ten minutes of domain reading of rendered rows,
> against 199 expression reviews that had found nothing (§64). **Moved into a reference table, the
> same wrong number becomes a join nobody renders** — correct-looking, unauditable by eye, and
> reachable only by someone who thinks to query it.

That is the §61 shape one level out: the failure is not that the value is wrong, it is that
nothing can *see* it is wrong. **The library's current weakness is that its numbers are
unverified. Hiding them behind a join does not verify them; it removes the one check that has
actually worked.**

**(a) — deleting the table — was refused on the code.** The `regulated_substances` join is an
INNER JOIN inside branch 2 and it is *the* source of every `true` the function can return:

```sql
join public.regulated_substances r on r.cas_number = c.cas_number
...
when 'psm' then r.is_psm_listed and c.max_quantity >= r.psm_threshold_lb
```

It is read again in branch 3, where a CAS **absent** from the table is one of three things that
force `unknown` instead of `false`. Delete it and the function loses its positive path *and* a
guard against a false negative.

### The 24 thresholds, and their real status

**24 of the 199 live requirements carry a numeric threshold literal; 27 clauses in total, 14
distinct (switch, value) pairs.** Counted, not estimated:

```
 3x employee_count >= 50      3x employee_count >= 20      3x employee_count >= 15
 3x employee_count >= 6       3x employee_count >= 10      2x site_employee_count >= 250
 2x employee_count >= 100     2x oil_storage_aboveground_gallons >= 1320
 1x site_employee_count >= 20/100/6   1x ghg_emissions_tco2e >= 2500 / >= 25000
 1x employee_count >= 25
```

**None of them is a substance threshold, and there are no CAS numbers in any expression** —
`grep` across all 199 returns zero. Every inventory clause is `{"inventory": "<list>"}` and
nothing else.

> **They are not wrong because they are literals. They are unverified because nobody has read the
> rule.** `verified_at` and `source_checked_at` are NULL on all 205 rows; these 24 numbers have
> exactly the same standing as the 200 citations beside them — **model-derived, plausible, and
> unchecked against a published source.** That is precisely what 6.7 exists to fix, and it is why
> the thresholds and the citations should be verified in the same pass rather than treated as
> separate problems.

### What 6.4b becomes

**Deferred behind a writer for `company_chemicals`.** The reference data is inert until something
records what a customer holds: `substance_inventory()` short-circuits on branch 1
(`not exists company_chemicals`) and never reaches the threshold join. Seeding EPA tables today
changes no screen.

**And the constraint that governs any future seeding: a list is seeded COMPLETE or not at all.**
A partially-seeded list reaches branch 4 — every row identified, quantified, none over threshold —
and returns a **definite `false`**, which is the one direction `CLAUDE.md` §3.2 forbids.

**Reversal condition:** if 6.7 establishes the thresholds from primary sources and a
`company_chemicals` writer exists, (b) becomes arguable again — because a verified number in a
table with `source_url` and `source_checked_at` beside it is *better* provenance than a literal.
The objection is to moving unverified numbers out of sight, not to the table.

---

## 73. What the critic sees of a conversation — 15 September 2026

**⚡ `CLAUDE.md` §3.1 — this changes what feeds a prompt, so the decision is written before the
code.** `WORKSPACE.md` §4.2 requires it: *"the critic must see what the answer is built on, not
only the latest turn. If turn one asserted the bottle needs DOT labels and turn three asks about
font size, a critic seeing only turn three will happily validate a font size inside a false
premise."*

**Today `CriticInput` carries** `question`, `answer`, `questionSet`, `establishedFacts`,
`declaredUnknowns`, `agenciesInScope`, `factsReliedOn` — **and no field for anything from a prior
turn.** So §4.2 is unsatisfiable as the interface stands.

### The question that had to be settled first: prior ANSWERS or prior FINDINGS?

**They are different inputs and they fail differently.**

| | What it is | What it catches | How it fails |
|---|---|---|---|
| **Prior answers** | what the product ASSERTED in earlier turns | turn 3 validated inside turn 1's false premise — **exactly §4.2's case** | more input, more tokens, more chance of anchoring on a wrong premise as context |
| **Prior findings** | what the CRITIC concluded in earlier turns | apparently: repeated mistakes | **the critic reads its own past judgement and agrees with it** |

**The decision: PRIOR ANSWERS. Never prior findings.**

> **`CRITIC-PASS.md`'s founding rule is that the critic sees only the OUTPUT, never the
> instructions that produced it, because a reviewer reading those is reviewing its own reasoning
> and will agree with it.** Feeding it its own earlier findings is that same failure one level
> out — the reviewer reviewing its own review. It would produce agreement, and **agreement is not
> verification.**
>
> A critic told *"you previously found this answer sound"* has been handed a reason to find the
> next one sound. A critic told *"the product previously asserted X"* has been handed something to
> attack, which is the whole job.

### What it sees, precisely

**Added:** `priorAssertions` — the **claims** of earlier turns in the same topic, not their prose.
For a checklist answer that is the `must_do` item names; for a research answer, the assertion
sentence. **Trimmed to claims for the same reason `factsReliedOn` is an extraction rather than the
document** — passing the whole thing lets the critic re-derive the answer and then confirm it,
which is the failure this stage exists to avoid.

**Deliberately withheld, and each for a stated reason:**

| Withheld | Why |
|---|---|
| The critic's own prior findings | self-agreement — the rule above |
| The prompts that produced any turn | `CRITIC-PASS.md`'s founding rule, unchanged |
| The user's prior phrasings | the claim is what can be wrong; how it was asked is not |
| Turns from other topics | a topic is the unit; cross-topic context is noise with a cost |

### The failure this creates, named in advance

**A wrong prior assertion becomes context, and context anchors.** If turn 1 was wrong and the
critic is shown it as a premise, the critic may accept it and go on to review turn 3 against it —
**the precise failure §4.2 describes, reintroduced by the fix for §4.2.**

**The mitigation is that prior assertions are labelled as CLAIMS UNDER REVIEW, not as
established facts** — the same distinction `establishedFacts` already draws, which carries what
the gate *determined* rather than what the model *said*. A critic that can attack a prior
assertion is doing its job; one that treats it as given has been mis-fed.

**This is a prompt change as well as a field**, and prompts live in `prompts/`, never inline.

### Not built, and sequenced inside M1

M1.2's follow-up classification is what makes a "prior turn in the same topic" addressable at all,
so this lands after it and before M1.5 renders anything.

**Reversal condition:** if Stage 2 lands and narrows the agency list, the critic's input shrinks
enough that passing prior assertions in full prose becomes affordable, and the trimming is worth
re-arguing. Not before — the critic is already the most expensive call in the product.

---

## 74. The critic timing, measured before M1 rather than after — 15 September 2026

**Measured 15 September 2026, calling `criticise()` directly with a realistic checklist answer and
the live agency list from staging. Three runs, real API calls.**

```
agencies passed to the critic: 33   (Stage 2 does not exist to narrow this)

  run 1: 33.7s   findings 9 (blocking 2, q5 2)  complete=true
  run 2: 42.2s   findings 9 (blocking 2, q5 2)  complete=true
  run 3: 33.2s   findings 9 (blocking 2, q5 1)  complete=true

  n=3  mean 36.4s  min 33.2s  max 42.2s
```

### It is over the threshold, so Stage 2 stops being deferrable

**36.4 s mean against a ~30 s budget for a conversational turn, and that is the critic ALONE** —
the gate is 6–10 s and the generating call ~30 s on top. **A turn in M1 is a minute-plus of dead
screen**, and §5's rule is that nothing may show an infinite spinner.

**The 84 s recorded on 12 September is not reproduced**, and the difference is worth stating
rather than treating either number as wrong: that figure came from `/api/audits` across 12 runs on
a 272-item ISO standard. **This is a five-item checklist.** So the honest reading is that the
critic costs **~36 s at the small end and ~84 s on a large audit**, and the small end is what M1
will feel.

**Why the number was worth getting before building rather than after:** it is a *number*, not a
judgement, it cost three API calls, and it changes M1's shape. **Measuring it after M1.5 renders
would have meant discovering it in front of a user** — the same class as the 500 Case E found on
its first fixture (§63).

### What does NOT follow from it

**Do not tune the prompt or lower the model tier.** `CRITIC-PASS.md` §5 is explicit: the cost is
**the input**, because the critic is handed **all 33 agencies** since Stage 2 does not exist to
narrow them to the ones a question touches. **Narrowing the input is the fix.** Tuning the prompt
trades review quality for latency, which is the wrong trade in a product sold on trustworthiness,
and `CLAUDE.md` §3.1 puts both behind a discussion anyway.

**And the finding count is stable across runs — 9, 9, 9 with 2 blocking each time.** That matters
independently: `CRITIC-PASS.md` §7.1 records that the count is the only way to detect a critic
that has started inventing, and a stable count on identical input is the baseline that check
would be measured against. **Question 5 varied (2, 2, 1), which is exactly why §7.1 separates it
out of the count.**

**Reversal condition:** if Stage 2 lands and the agency list narrows from 33 to the few a question
actually touches, re-run this measurement before concluding anything about M1's shape. The
threshold is the turn, not the stage.

---

## 75. Stage 2 reverses a written decision, and it is not obviously a query — 15 September 2026

**Stopped before any spec.** §74's timing made Stage 2 look like the obvious next item. Reading
the spec and the critic's own decision record changed that, and three corrections go on the record
before anything is built.

### 1. §5.2 specifies a MODEL CALL, not a query

`CHEMICAL-OR-WA.md` §5.2, verbatim:

```
Activity: [question]
Company: [state, county, industry, relevant switches]
Available agencies for this jurisdiction: [list from §1.2-1.4]

Which agencies have jurisdiction over this activity? For each, state
in one line what its interest is. Do not enumerate requirements.
```

**So "narrow the critic's input" means adding an AI call in order to remove input from a later AI
call.** The latency arithmetic is not obviously favourable, and the 36.4 s measurement does not by
itself justify the work. **The spec was not read before the work was proposed** — by either of us;
it was proposed from a latency number and accepted from the same.

### 2. `CRITIC-PASS.md` §5 already decided this trade, in writing, the other way

> *"a list that is too broad produces a false positive a human can dismiss, while a missing list
> produces a silent gap nobody sees. Those are not symmetrical costs."*

**Stage 2 reverses that**, and the reversal was proposed without anyone noticing a decision
existed. That is allowed — §5 was written before there was a latency number, and new evidence is
the right reason to reopen a decision. **What is not allowed is reversing it silently**, which is
what would have happened had the spec gone straight to code.

### 3. The library route is a third option the design does not consider

`requirement_templates.agency_id` **already partitions the library** — OR-OSHA 61, EPA 52, BOLI
16, PHMSA 15, OR-DEQ 11 live rows. **A retrieval that pulls candidate requirements names its own
agencies as a side effect, with no AI call at all.** That inverts §5.2's Stage 2 and Stage 3:
retrieve first, derive scope from what was retrieved.

**It may be better than both options.** It removes a call rather than adding one, it is
deterministic, and it makes the agency list a *consequence* of the anchor rather than a
*constraint* on it — which is closer to `CLAUDE.md` §3.3's rule that every stage must have an
anchor.

**Also found, and it makes a query-based narrowing more plausible than expected:**
`agencies.agency_type` is populated on **all 33 rows** across 11 values — `labor` 9,
`environmental` 4, `licensing` 4, `transport` 3, `fire` 3, `workplace_safety` 2,
`business_registry` 2, `product_safety` 2, `tax` 2, `trade` 1, `security` 1. **What does not
exist in any form is a mapping from an activity to an `agency_type`.**

### What Stage 2 would decide on behalf of things that do not exist

- **Stage 3 inherits its output as a RETRIEVAL FILTER** — §5.2: *"Query `requirement_templates` on
  industry + jurisdiction + the agencies from Stage 2."* A wrongly-excluded agency does not merely
  go unmentioned; **its library rows are never fetched.** Building Stage 2 alone fixes Stage 3's
  contract before Stage 3 is specced.
- **M6's coverage strip** reads `industry_coverage` — 56 rows, company-wide and
  question-independent. Stage 2 creates a **second, per-question notion of scope.** *"We cover 33
  agencies"* and *"this answer touched 4"* are different claims and must not render as one.

### The failure direction, which is the part that bounds the decision

**Narrowing too far produces a gap the critic cannot see, because the critic only knows what it
was given.** If Stage 2 drops PHMSA from a shipping question: Stage 3 retrieves no PHMSA rows, the
answer contains no transport requirements, and **question 6 asks "for each agency with
jurisdiction, was it addressed?" — with PHMSA absent from the list.** The omission is not missed;
it is **outside the question being asked.** The answer is internally consistent, complete against
its own frame, and wrong.

**What bounds it today: nothing.** The obligations spine would be the natural backstop — a PHMSA
obligation exists whether or not a conversation mentions it — but §71 established that
`/api/chat` and `/api/audits` contain **zero references** to `requirement_templates` or
`obligations`. **The backstop is not connected**, so narrowing currently has no floor.

| | Too broad | Too narrow |
|---|---|---|
| Cost | a false positive | **a silent gap** |
| Who catches it | a human reading the answer | **nobody** |
| Latency | 36.4 s | faster |

**Stage 2 trades a visible cost for an invisible one to buy latency.** That may still be right —
a minute of dead screen is a real product failure — but it is not an optimisation, and it should
not be described as one.

**Reversal condition:** the measurement in §76 decides whether the 33-agency list is what costs
36 s at all. If it is not, Stage 2 buys nothing and this entry closes the question.

---

## 76. Narrowing the agency list buys 7.7 seconds and costs three findings — 15 September 2026

**The measurement §75 asked for. Identical input to §74's baseline — same question, same answer,
same established facts, same declared unknowns — with the ONLY change being 4 hand-picked
agencies (OR-OSHA, OR-DEQ, EPA, BOLI) instead of all 33.**

```
NARROW (4 agencies)   n=3  mean 28.7s  min 22.4s  max 35.5s
BASELINE (33)         n=3  mean 36.4s  min 33.2s  max 42.2s

DELTA: -7.7s  (21% faster)

findings: baseline 9, 9, 9  (blocking 2 each)
          narrow   6, 6, 6  (blocking 2, 2, 2 — coverage-q6 2, 2, 2)
```

### What it settles: the agency list is NOT what costs 36 seconds

**Eight times fewer agencies buys 21% — and the narrow run still takes 28.7 s, which is still at
the ~30 s conversational budget with the gate and the generating call on top.** The critic is
expensive because it is a large reasoning call over a whole answer, not because of the list.

> **So Stage 2 does not fix the latency problem it was proposed to fix.** A turn stays
> minute-plus. **The premise of §74's "Stage 2 stops being deferrable" does not survive the
> measurement**, and that conclusion is withdrawn.

**And the residual variance says the same thing.** The narrow runs spread 22.4–35.5 s — a 13 s
range on identical input — which overlaps the baseline's range. **Run-to-run variance is
comparable to the entire effect of removing 29 agencies.** Three runs cannot separate them
further, and a larger sample would be measuring the API, not the design.

### The second finding, which is the more interesting one

**The finding count dropped from 9 to 6, and it was stable at both sizes** — 9,9,9 then 6,6,6.
**Blocking held at 2 in every run of both.** So:

- **The three lost findings are coverage findings** — question 6, *"for each agency with
  jurisdiction, was it addressed?"*. Narrow kept 2 coverage findings in all three runs; broad
  found 3 more.
- **Nothing blocking was lost.** The severity that withholds an item from the answer was
  identical across both.

> **This is `CRITIC-PASS.md` §5's asymmetry, measured rather than argued.** Narrowing removed
> three observations about agencies that were not addressed, and the critic **cannot report on an
> agency it was not given.** The 7.7 s was bought with exactly the currency §5 warned about: *"a
> missing list produces a silent gap nobody sees."*
>
> Whether those three were real gaps or false positives is not knowable from this run — **and
> that is the point.** With the broad list a human can read them and dismiss them. With the narrow
> list they do not exist to be read.

### What follows

**Stage 2 is not worth building for latency.** 7.7 s does not move a minute-plus turn under a
threshold, and it costs the coverage findings that are the critic's distinctive contribution.

**If Stage 2 is built, it must be for a different reason** — Stage 3's retrieval filter, which is
a correctness argument rather than a speed one, and which §75 notes can be served by the **library
route** with no AI call at all.

**And the real latency question is now open and unanswered:** the critic is ~29 s on a five-item
checklist with four agencies. **If a conversational turn must be under 30 s, the critic cannot be
synchronous in a conversation at all**, and that is a question about D25 rather than about Stage
2. Not decided here; measured and recorded.

**Reversal condition:** if the critic's input ever grows to dominate its cost — a 272-item audit
is the known case at ~84 s — narrowing becomes worth re-measuring for that path specifically. It
is the small-conversation path this measurement covers.

---

## 77. The research path: two AI calls, and the library stays invisible — 15 September 2026

**Decided 15 September 2026. Not built.** This revises `CHEMICAL-OR-WA.md` §5.2 **for the research
path only**. The audit path is untouched and must stay untouched — see the last section.

> ### THE SHAPE: **gate, then answer. Two AI calls. Nothing else.**
> No agency scoping. No library filter. No classification that can exclude. No critic.

### What survives from §5.2, measured rather than assumed

| Stage | Fate |
|---|---|
| **1 — Gate** | **Survives, and grows.** It never read the library (`determinationGate.ts:332`), so nothing about it inverts |
| **2 — Agency scoping** | **Dropped.** §76 measured it: 7.7 s for three lost coverage findings |
| **3 — Library retrieval as FILTER** | **Inverted.** Enrichment, and invisible |
| **4 — Identification** | **Dropped for research.** It presupposes a retrieved candidate set |
| **5 — Critic** | **Dropped for research.** Kept at the checklist boundary |
| **6 — Expansion** | **Survives** |

**Nothing built depended on the inverted stages.** The gate and the critic are both independent of
retrieval — `CriticInput` carries no library rows, and `/api/chat` and `/api/audits` contain zero
references to `requirement_templates` or `obligations` (§71). **§5.2 is cited in five comments and
one golden-case provenance note, and enforced by no type, no route and no test.** `criticPass.ts:77`
has already departed from it once on its own reasoning.

---

### 1. The critic is DROPPED from research. Not deferred — dropped.

**A conversation self-corrects in a way a one-shot answer does not.** The user can challenge a
claim in the next turn, and that is the mechanism this project itself has run on.

**The critic stays at the CHECKLIST boundary** — where an answer becomes steps with hours and
costs attached, and the user can no longer challenge it mid-flight.

> **The cost, accepted deliberately and recorded so nobody later discovers it as a defect: most
> users will not ask.** An error in a research answer survives until somebody challenges it, and
> most never will. **That is the trade, it is made knowingly, and it is made for research only.**

**This also removes the dependency §76 opened.** No worker, no async critic, no reopening of D25.
The turn is gate + answer and nothing waits.

### 2. Nothing narrows the model

**No agency scoping, no library filter, no bucket classification that excludes.** The model
decides scope, because that is what it does reliably — the consultant tests scored ~99% anchored
and B− unanchored, and the B− answer **named the right agencies** and missed a packaging detail.
Territory right, details wrong.

**And the library cannot know what it is missing.** A gap in it is indistinguishable from a rule
that does not exist, so retrieval returning nothing is ambiguous in a way the system cannot
resolve. **Narrowing the model to the library inherits that ambiguity silently.**

### 3. *** THE LIBRARY IS INVISIBLE TO THE USER — and the earlier proposal was wrong ***

**Recorded as a correction.** An earlier proposal in this session had every answer mark each claim
as `✓ library, verified` / `◐ library, generated` / `○ model knowledge`. **That was wrong, and the
reason is not cosmetic.**

> **Marking something "from our verified library" is a PRODUCT CLAIM, not provenance.** If it is
> then wrong, the failure is **a broken library** rather than a model mistake — and the library is
> the thing being sold.
>
> **A citation shifts the burden to the source. A badge saying we verified this shifts it to us.**

So: **no per-claim badges, no library labelling, no three-mark display.** The library's job is to
**raise internal accuracy silently**. Where a library row and the model's recollection differ,
**the row wins and the user never learns why.**

**And this does nothing today, which must be said plainly rather than implied.** `citation_quote`
is NULL on all 205 rows and `source_checked_at` on all 205 — **no row carries source text, so
there is nothing to correct a recollection with.** Enrichment becomes real at **6.7**. **Today
research is two calls and the library is untouched.**

### 4. The answer cites generously

**Every source that bears on a claim, not one authoritative source per point.**

**It is a prompt instruction, not a stage.** The model already knows its sources while it is
writing; asking it to justify afterwards is the expensive version and produces post-hoc
rationalisation rather than provenance.

**Why generously: citations are now the ONLY mechanism by which a wrong answer is caught.** The
critic is gone from this path. More cited surface means more places a wrong recollection is
visibly wrong to a reader who checks one.

### 5. A page-level disclaimer, not per-assertion marking

**The research surface carries one statement: verify against the cited source.**

**This is consistent rather than a compromise.** The whole surface is unverified, so nothing on it
claims to be checked — which is exactly the honesty the per-assertion marking was reaching for,
without the product claim §3 refuses.

### 6. Web search, decided by the GATE

**`lib/ai.ts` already supports it** (`enableWebSearch`, wired at `ai.ts:137`) and **two paths
already use it** — `documentReview.ts:73` and `/api/audits` at lines 252 and 282. **The gate and
the critic explicitly set it false; the chat answer path does not enable it at all.**

**The gate decides.** It is already reading the question closely, so *"is this about something
recent, or outside the model's training window"* is **one more field it returns, not another
call.**

### 7. The gate sees prior turns

**Today it does not.** `gate()` takes `{ question, documentBlocks, companyId, outputType, db,
answering }` — **no conversation history**, so each turn is independent and it can re-ask what was
established two turns ago.

**That is the "minimise asking within a topic" problem, and it is a smaller fix than
classification.** What the gate needs is **the conversation**, not a taxonomy.

> **A bucket or tag classification is NOT wanted if it can exclude anything — that is narrowing by
> another name.** If the gate returns what a question is about, it is **context with no
> authority**.

### 8. Frame detection folds into the gate

**Jurisdiction of the question, tense, subject** — returned by the gate, not by a separate call.

**The Arizona case is what this exists for and it must work.** An Oregon chemical company asks
about a solvent facility in Arizona:

- **Their switches are FALSE because they do not handle solvents TODAY**, and that must not
  exclude anything.
- **Arizona library rows do not exist**, and the Oregon rows are actively wrong for the question.
- **The answer must be about Arizona.**

**A hypothetical fact does NOT write to `company_switches`.** It is not a fact about the company.
Where it lives is open — probably the topic (M1.1) — and that is a decision M1.1 must make rather
than inherit.

### Kept from the earlier proposal

**Company facts as CONTEXT, never as a filter.** *"Which of this company's facts does this
question touch"* is the more useful retrieval and **works in Arizona, where the requirement
library is useless**: *"you have 47 employees and no current solvent handling, so the Arizona
facility would be your first."* No requirement row contains that sentence. **47 employees is true
whatever the question is; `handles_solvents = false` must exclude nothing.**

---

### THE RECORD: why research and audit must never be unified

**Someone will propose it, and the argument will sound good** — both answer compliance questions,
both call the model, both produce a list.

> **Research ENRICHES a model answer with library support. Audit ASSERTS from the library and uses
> the model to match evidence. They have opposite directions of authority, and merging them means
> one of the two loses its.**

| | Research | Audit |
|---|---|---|
| Source of truth | the model, quietly corrected by the library | the library, evidenced by documents |
| Library silent | **say nothing and proceed** — it is unverified either way | **cannot proceed** — an assertion with no basis |
| Wrong output | an unverified claim on a page that says so | **a false compliance status** |
| Jurisdiction | the **question's** | the **company's** |
| Tense | often hypothetical | always present |
| Critic | **none** — the user challenges | **required** |

**The failure mode, named in advance: unify them and the library becomes OPTIONAL for audit**,
because research will have taught the system that a library gap is survivable. **`CLAUDE.md` §3.3's
known-bad mode is free enumeration, and audit is precisely where it must never happen.** The day an
audit says *"no library coverage, here is the model's view"*, the product has become the thing it
was built to replace.

**And the inverse is as bad:** make research assert from the library only, and the Arizona question
returns nothing — or worse, returns Oregon.

**§71 is the evidence this is not theoretical:** neither route touches the library today, and the
reconciliation is item 6. **Unifying them would resolve item 6 in the wrong direction** — by making
both paths equally unanchored, rather than by deciding what each is entitled to assert.

**Reversal condition on the critic's absence:** if a research error ever reaches a customer
decision and is traced to an unchallenged claim, the trade in §1 is what failed, and the answer is
the checklist boundary moving earlier — not a critic added back into the conversation.

---

## 78. Hypothetical facts are not stored — 15 September 2026

**A fact that belongs to a hypothetical is never written anywhere.** Not to `company_switches`,
not to `topics`, not to a new table. It lives in the conversation and nowhere else.

### Why, and the reasoning is that the alternative recreates a problem this project keeps finding

**M1.2b gives the gate prior turns.** So *"the Arizona facility would have 12 employees"* is
**already in the conversation the gate reads.** Storing it separately would put the same fact in
two places under different rules — **and that is the two-systems problem, which this codebase has
now produced three times:**

| | Two records of the same thing | Recorded |
|---|---|---|
| 1 | `checklist_items` vs `obligations` — two answers to *"what must you do"*, neither connected to the library | **§71** |
| 2 | `companies.scan_result` vs `entities.state/county/city` — jurisdiction from an AI website scan rather than the site; **`scan_result` is null for 7 of 10 production companies** | **§24** |
| 3 | a stored hypothetical vs the conversation that produced it | **this entry, avoided** |

**Each of the first two cost a reconciliation, and the second is still open.** The third is
avoided for free by not creating it.

### The lifecycle falls out rather than needing design

`WORKSPACE.md` §6.4 already settles the lifespans: **transcripts are disposable — closed and
discarded.** A hypothetical belongs to the exploration that produced it, so **when the topic closes
and the transcript goes, the hypothetical goes with it.**

> **Nobody should inherit *"the Arizona facility has 12 employees"* into a conversation six weeks
> later about something else.** A stored hypothetical would do exactly that, and it would be
> indistinguishable from a real fact at the point of use — which is the false-green direction.

**The cost, stated plainly:** the gate re-reads the turns rather than reading a stored value.
**That is not re-inference in any expensive sense — it is what conversation context is**, and the
gate is 6–10 s with or without it.

### What it simplifies

**`topics` needs no facts column.** M1.1's shape gets smaller, not larger: company, title, status,
opened/closed, summary. **A decision that removes a column is worth more than one that adds a
well-designed one.**

**Reversal condition:** if a hypothetical is ever needed **outside** its topic. No case can
currently be named. **If one appears, the fix is promoting it to a real fact deliberately — a user
action, not a storage decision.** That distinction is the whole of it: a fact becomes real when
somebody says it is, not when a system decides to keep it.

---

## 79. §43 demonstrated, and a duplication that was avoidable before it was written — 15 September 2026

**Two findings from one refactor, both caught only because the copies were forced into one.**

### 1. The `Established` copy was already wrong, and would have been silently wrong

**The canonical rule consults the VALUE TYPE** (`lib/resolve.ts:193`):

```ts
export function isEstablished(state: string, raw: string | null | undefined, valueType: SwitchValueType): boolean {
  return state === 'known' && coerceFact(raw, valueType) !== null
}
```

**The duplicated copy in both new routes checked only `state === 'known'` and `value !== ''`.** It
never looked at the type.

> **A `number` switch holding `"abc"` would have been ESTABLISHED to the ask path and UNKNOWN to
> the resolver.** The queue would believe a question answered and stop asking it; the engine would
> treat the fact as missing and leave every requirement that depends on it `unknown`. **A customer
> would see a question disappear and nothing move.**

**This is §43 demonstrated rather than predicted.** §43 exists because
`company_switches.value` is text for every switch and `'true' === true` is false — it was written
after that rule was got wrong once. **The third copy got it wrong again, in a new way, in code
written by someone who had read §43 the same day.**

**And the shape is the one that matters: each copy reads correctly in isolation.** Nothing
compares them. There is no test that could have failed, because both behaviours are defensible
until you put them side by side. **It was caught by the refactor, not by review and not by the
suite** — the two copies had to become one before the difference between them became visible.

**Now one export**, `establishedFrom()` in `lib/switchAsk.ts`, sharing `isEstablished()` with
`splitFacts`. **Zero copies of the rule remain.**

### 2. `switchesIn()` already existed — the cheaper lesson

`lib/appliesExpression.ts:224`, with a doc comment naming this exact use:

```ts
/** Every switch id an expression references. Used to validate against the seeded
 *  vocabulary before an expression is stored, and to answer "what would break if this
 *  switch changed". */
export function switchesIn(e: Expression): string[]
```

**A second walker was written anyway, twice, in two routes.** It was then correctly identified as
duplication to be lifted into `lib/` — **which is the right instinct applied one step too late.**

> **The check is not "should this be shared". It is "does it already exist".**
>
> The first question produces a good refactor after the fact. The second produces no code at all.
> **The expensive version is writing it, noticing, and lifting it; the cheap version is one
> `grep` before writing.**

**This is `AUDIT-CHECKS.md` check 29's inverse.** That check asks what exists and is called by
nothing. This is the other failure with the same cause — **not knowing what is already in `lib/`**
— and the same one-command fix.

**Reversal condition:** none on either. Both are now single exports and the suite covers them
through their callers.

---

## 80. `declared` — a person is not a document, and the third instance of §63's class — 15 September 2026

### The vocabulary had no word for its strongest source

`evidence_class` was `stated | implied | inferred | absent`. **All four describe how a DOCUMENT
supports a claim** — they are one scale, and migration 017's own comment says so: *"`stated` and
`implied` mean 'this document says/implies it', so they require a document AND the text that does
it."*

**A person telling us directly is not on that scale.** It is a different kind of source, and it is
the strongest one in the product. Lacking a word, `fromUserAnswer()` borrowed `stated` — and the
database refused it the first time a route tried:

```
new row for relation "switch_determinations" violates check constraint
"switch_determinations_stated_needs_evidence"
```

**The ranking change is the point, not a side effect.** §24.1 settled that a stated value outranks
an inferred one, which has always implied that **a person outranks both** — and the vocabulary
could not express it. That is exactly why a person's answer had to borrow a word meaning something
else.

```
RANK, before (13-15 Sep):   stated 3 · implied 2 · inferred 1
RANK, after  (026):         declared 4 · stated 3 · implied 2 · inferred 1
```

**Two alternatives refused, and the reasons outlast the choice:**

- **Widen the constraint** to exempt `source = 'user_set'` — admits a case the vocabulary cannot
  express, and **the constraint stops meaning what its comment says.** A constraint that no longer
  matches its own explanation is worse than none: it reads as enforced.
- **Use `inferred`** — wrong on its face. It is the **weakest** class, and §24.1 already ranked it
  below `stated`. A person's answer is the strongest evidence in the system.

**`declared`, not `asserted`.** *Asserted* reads as a claim somebody is **making**; *declared* reads
as a fact somebody is **supplying** — and the word will sit in a table next to `inferred`, where
the reader is already weighing how much to believe.

**And it may not carry a document** (027). If a document is the source, the class is `stated`,
`implied` or `inferred` — **otherwise `declared` becomes the class that escapes every evidence
rule, which is how a vocabulary rots.** Both halves are proved by violating them, per §3.7.

**Two migrations for one change, and it is a Postgres rule rather than a style choice:**
`ALTER TYPE ... ADD VALUE` must commit before the value can be named, so 026 adds the word and 027
is the first statement allowed to use it.

### THE THIRD INSTANCE OF §63'S CLASS, AND THE SHARPEST

| | What was unreachable | How it surfaced |
|---|---|---|
| **§63** | `close_and_replace_obligations`, `substance_inventory` — `service_role` only | 500 on the first real GET |
| **§79** | the duplicated `Established` builder, ignoring value type | the refactor forced two copies into one |
| **§80** | `fromUserAnswer()` returning `stated` with no document | the first INSERT from a route |

> **What makes this one sharpest: the module's own TEST asserted the behaviour its database
> refuses.**
>
> ```js
> test('evidence_class is stated — a person stating it IS a statement', () => {
>   assert.equal(d.evidenceClass, 'stated')      // passed, for two days
> ```
>
> Both were written on **13 September**. Both are internally consistent. **Nothing put them in the
> same process for two days**, because `lib/switchDetermination.ts` had four exports, four tests
> and **no production caller.**

**`AUDIT-CHECKS.md` check 29's unrouted-module list is the leading indicator for this class, and it
has now produced three findings in one sitting.** That changes what the list is:

> **It is not a list of things to tidy. It is a queue of latent defects**, each of which will fail
> on the day something first reaches it — and every one of them reads as finished work until then.
> `switchAsk`, `sdsExtraction` and `basis` are still on it.

**Reversal condition:** none on `declared`. On the class — when check 29's list is empty, the
leading indicator stops indicating and becomes a regression check.

---

## 81. Two measurements, and two probes that passed for the wrong reason — 15 September 2026

### The two figures, and they are different measurements

**7.2a ran over HTTP for the first time on 15 September**, as `testgamma@example.com` against
staging. Two distinct things were measured and **they must not be conflated**:

| | Measurement | What it is |
|---|---|---|
| **Creation** | `opened 200, closed 0, unchanged 0` — **21 applies of 200 created** | A company with **no obligations** answers its first question. There is no before, so nothing *moves*; the list comes into existence |
| **Delta** | `closed 5, opened 5, unchanged 195` — **5 moved `unknown` → `applies`** | A company that **already has obligations** answers another (`owns_fleet = true`). `unknown 178 → 173`, `applies 21 → 26` |

**Neither is 19 and neither is 23.** 19 was `TESTING.md` Case A's own expectation, written before
the endpoints existed, in a document whose header says the case cannot run. **23 appears in no
artifact at all** (§65, seventh instance). Both were expectations; **these two are the first
measurements**, and they replace them rather than being reconciled against them.

**The delta is the one Case A was written to observe and could not** — its precondition
(*"a company with nothing established"*) guarantees the creation case. `TESTING.md` v16 records
the split into A1 (creation) and A2 (movement).

### THE PROBES THAT PASSED FOR THE WRONG REASON

Eight guards were probed over the wire. Six tested what they claimed. **Two returned the expected
status code for the wrong reason, and both would have been recorded as passing:**

| Probe, as labelled | What actually happened |
|---|---|
| *"enum value not allowed"* — `air_permit_required = banana` | `air_permit_required` is **site-scoped**, so the **site guard fired first**: `400 This question is about one site.` **The enum guard was never reached.** |
| *"entity_id of another company"* — `e2624d93…` | That id is **Gamma's own primary site**. `200`, correctly. **The tenancy guard was never tested.** |

Re-run with a **company-scoped** enum switch (`business_type`) and one of **Alpha's** entities:

```
enum value not allowed (company-scoped)   HTTP 400  "banana" is not one of the accepted answers.
GET  ask,    entity_id belonging to Alpha HTTP 404  Not found
POST answer, entity_id belonging to Alpha HTTP 404  Not found
POST answer, Gamma's own site             HTTP 200  written: true
Alpha's switch count afterwards           16, unchanged
```

### The rule, and it is about NEGATIVE tests specifically

> **A guard test must FAIL when the guard is removed.** If it still passes, it was testing
> something else.
>
> **And a probe that trips an EARLIER guard has tested the earlier guard.** Ordered guards make
> this easy to do by accident: every one of them returns a refusal, the refusal looks like the
> one expected, and the status code agrees.

**This is `AUDIT-CHECKS.md` check 14's subject — *is every checker as strong as the assertion it
claims to check?* — in a new place.** It has now appeared three times:

- **Check 8** queried bucket `documents`; the bucket is `company-documents`. Zero rows read as
  clean, against a bucket that does not exist. **Four orphaned customer files on production.**
- **Check 20** passes vacuously on an empty table, and **says so** — which is the correct form.
- **These two probes**, passing on the wrong guard.

**The cheapest discipline for a negative test: construct the input so that ONLY the guard under
test can refuse it.** For an enum probe that means a switch with no site requirement; for a
tenancy probe it means an id that genuinely belongs elsewhere. **Checking which guard produced
the refusal is not optional — the message is the evidence, not the status code.**

**Reversal condition:** none. This costs reading the error body instead of the status code.

### POSTSCRIPT — 028 refused itself, and the reason is §3.6's trap

Migration 028 (`topics`) **failed its own verify block on first apply**:

```
ERROR: MIGRATION 028 FAILED: authenticated holds DELETE on a table whose rows are
closed, not deleted.
```

**The migration granted `select, insert, update` and never granted DELETE.** It arrived anyway,
from the default ACL — `pg_default_acl` on this database reads
`authenticated=arwdDxtm/postgres`, where `d` is DELETE, **on every table created in `public`
before a single grant statement runs.**

> **Granting does not REMOVE what the default already handed out.** `revoke all ... from
> authenticated` then granting the three is the only way to end up with the set the migration
> names. `CLAUDE.md` §3.6 records this for `anon`; **it is equally true of `authenticated`, and
> that half was not written down.**

**The whole file rolled back — the table did not exist afterwards** — which is the
transaction-per-file behaviour working, and the verify block doing precisely what §3.7 asks of
one.

**Two more things caught in the same pass, both by checks rather than by review:**

- **`check:live` left a probe row behind on every run.** `switch_determinations` is append-only,
  so `authenticated` cannot delete its own probe — **four rows had accumulated**, found by the
  check's own "left behind" message. Cleanup now uses the service role for append-only tables.
- **`check:schema` refused `topics`** as carrying `company_id` and named in neither of
  `/api/account`'s deletion lists — **the third new table this check has caught.** Added to
  `DELETED_BY_CASCADE_OR_PARENT` with the reason read from `pg_constraint`: `ON DELETE CASCADE`,
  and **0 inbound foreign keys**, so it is a leaf and the cascade can strand nothing.

---

## 82. M1.2b before M1.2, and `hypothetical` as a sixth source — 15 September 2026

**Not built. Decided before code, because it changes what the gate may assert.**

### 1. THE REORDERING — M1.2b (the gate gains prior turns) precedes M1.2 (classification)

`BUILD-PLAN`'s order puts classification first. **It is wrong, and the weak version of why is
"the context does not exist yet."** The strong version:

> **M1.2's three categories map exactly onto the three things M1.2b must carry.**
>
> | Classification asks | It needs |
> |---|---|
> | is this a **refinement** of the last answer? | the prior **assertion** |
> | is this a **correction** of a fact? | the prior **fact** |
> | is this a **new question**? | the **frame** — a jurisdiction change makes it new regardless of wording |
>
> **So built in the wrong order, M1.2 classifies from PROSE while M1.2b later produces
> STRUCTURE, and nothing reconciles them.** Two systems, one fact.

**That is §71 and §24's shape a third time** — `checklist_items` vs `obligations`, and
`companies.scan_result` vs the site's own jurisdiction, which is **still null for 7 of 10
production companies**. Both cost a reconciliation. This one is avoided by an ordering change that
costs nothing today.

### 2. `hypothetical` — a sixth `FactSource`, and the reason is sharper than §80's

`FactSource` is `user_set | ai_from_documents | ai_from_profile | computed | stated_in_question`.
The obvious move is to reuse `stated_in_question` for a hypothetical, since every hypothetical
does arrive stated in a question.

**Refused, and the reason is a step beyond §80:**

> **`stated_in_question` and `hypothetical` are DIFFERENT DIMENSIONS.** `stated_in_question` says
> **where a fact came from**. `hypothetical` says **whether it is true**.
>
> *"We have 12 employees"* and *"the Arizona facility would have 12"* are **both stated in the
> question** and differ in **modality, not provenance**.

**Reusing the label collapses two axes, and the collapse is invisible precisely because every
hypothetical happens to arrive stated in a question.** §80 was a missing word; **this is a word
that means something adjacent enough to look right**, which is harder to notice and identical in
consequence.

**The failure direction is false green:** a hypothetical read as real resolves obligations for a
facility that does not exist.

**And it makes the frame (§77 item 8) LOAD-BEARING rather than informational.** The gate returns
jurisdiction, tense and subject; **tense is what marks a fact hypothetical at the moment it is
captured**, so the next turn receives it already labelled rather than re-inferring it from a modal
verb. *"Would have"* versus *"have"* is one word, and asking a model to catch it reliably every
turn is the enumerate-from-nothing failure in miniature.

**Reversal condition, and it is recorded so the next reader knows this was CHOSEN rather than
overlooked:** if a hypothetical ever arrives from somewhere other than the question, one value
stops being sufficient and **source and tense need separating into two fields.** No such case can
be named today — a document states what IS — so the conflation of "from the question" and "not
true yet" is accepted deliberately, with this paragraph as the trigger to revisit.

### 3. TRIMMING — the rule stands, the reason was wrong

**The claim:** prior turns reduce to **claims, not prose**, before the gate sees them — the shape
`answering` already uses (`{switch_id, fact, value}`, never the sentence typed) and the shape §73
settled for the critic.

> ### ⚠ CORRECTED IN PLACE, 15 Sep. THE ORIGINAL MOTIVATION IS WITHDRAWN.
>
> This section first argued: *"the gate is 6–10 s and its cost is input; an unbounded context is a
> latency regression that arrives gradually and is attributed to the model."* **That is not
> supported.** Measured (§83):
>
> ```
>   gate, turn 1  (97 chars):  9.9s
>   gate, turn 12 (748 chars): 8.7s        DELTA -1.3s with 7.7x the context
> ```
>
> **The gate got FASTER.** The latency argument is removed rather than annotated, because a
> withdrawn reason left standing gets cited.

**THE RULE SURVIVES ON CORRECTNESS.** A fact must arrive **labelled**: prose forces the model to
infer modality from a verb — *"would have 12"* versus *"have 12"* — and `[hypothetical]` is
explicit. **That is the whole reason, and it is sufficient.**

> ### AND THE CONSEQUENCE IS A STANDING DISCIPLINE, NOT A NOTE.
>
> **If labelling is the feature, collapsing is incidental.**
>
> - **Carry every turn's facts, labelled.**
> - **Collapse only where a later value supersedes an earlier one in the same frame.**
> - **Add NO further trimming for size.** Not a summary, not a window, not a turn cap.
>
> Any future trimming must be justified by something other than input size, and by a number
> (see §82.5).

### 4. CONTRADICTION — two kinds, and the collapse is the likely failure

**Same input, different meaning, and nothing in the schema distinguishes them:**

| | What it is | What happens |
|---|---|---|
| **Within a conversation** — turn 1 says 12, turn 4 says 40 | a **correction**. A person revising themselves | **The later turn wins.** §49's overwrite history records what it replaced |
| **Between the conversation and `company_switches`** — the stored fact says 12, this turn says 40 | **v3.2's conflict**. A determination disagreeing with a `user_locked` value | **It must reach the user.** Shown, never silently resolved |

**The collapse to guard against: treating both as "the newer value wins."** That is right for the
first and **wrong for the second**, where the stored value may be a person's locked answer and the
new one an aside in a hypothetical. **A conversation must not silently overwrite an established
fact**, and §78 is exactly why the risk exists — hypotheticals live in the transcript the gate
reads, so an unlabelled one looks like a correction.

**Reversal condition:** none on the distinction. If the two ever need the same handling, that is a
finding about `user_locked`, not about conversations.

---

### 82.5 THE INPUT-SIZE PRIOR — twice unsupported, and once it cost three findings

**The intuition that more input costs latency has now been measured twice and been wrong both
times:**

| | The design it justified | Measured |
|---|---|---|
| **§76** | Stage 2, narrowing the critic's 33 agencies | **7.7 s saved, 3 coverage findings lost.** The list was never what cost 36 s |
| **§83** | trimming the gate's conversation history | **1.3 s FASTER with 7.7× the context** |

**§76's is the expensive one: the narrowing was nearly built, and it would have traded a visible
cost for an invisible one** — `CRITIC-PASS.md` §5's asymmetry, which was already written down.

> ### THE PRIOR: a design justified by INPUT SIZE needs a number BEFORE it is built, not after.
>
> It is cheap — three API calls settled §76, two settled §83 — and the intuition is unreliable
> enough that it should not survive to a spec unmeasured. **This is §74's lesson generalised:**
> there the number was cheap and was nearly got late; here it is a whole class of reasoning that
> keeps failing the same way.

---

## 83. The trimming measurement — the bound holds, the motivation was wrong — 15 September 2026

**§82 recorded the trimming rule as a design claim and named what would test it: a real topic of
ten or more turns, with the gate's input size and latency recorded per turn. Run before M1.2b was
built, per §74's lesson.**

### The bound — confirmed, and it is modest

A realistic 12-turn topic (the Arizona case), claims collapsed by `(switch_id, frame)`:

```
  turn │ fact lines │ claims chars │ prose chars │ ratio
     1 │          2 │          137 │         132 │ 1.04
     4 │          4 │          254 │         324 │ 0.78
     8 │          6 │          354 │         551 │ 0.64
    12 │          9 │          537 │         810 │ 0.66

  AFTER 12 TURNS: 9 fact lines from 11 facts asserted (2 collapsed — restatements)
```

**The ceiling is a line per switch per frame, not a line per turn** — 9 lines at 12 turns. But
**claims are only ~34% smaller than prose at this scale**, and at one turn they are *larger*. The
bound is real and the saving is not dramatic.

### *** THE LATENCY CLAIM WAS WRONG, AND IT WAS THE REASON GIVEN ***

Real gate calls, Test Gamma Solvents:

```
  turn 1  — no history           chars  97   mean 9.9s  [10.6, 9.3]   -> ask
  turn 12 — claims appended      chars 748   mean 8.7s  [8.7, 8.6]    -> proceed, 14 known

  DELTA: -1.3s for 651 extra characters
```

> **The gate got FASTER with 7.7× the context.** Input size is not what drives its latency at this
> scale, so **"an unbounded context is a latency regression" — §82's stated motivation — is not
> supported.** The same shape as §76, where narrowing the critic's agency list bought 7.7 s and
> cost three findings: **the input-size intuition was wrong there too.**

**So the trimming rule survives on a different justification, and the change matters:**

| | |
|---|---|
| **Rejected** | *trim because context is expensive* — measured, and it is not |
| **Stands** | **trim because a fact must arrive LABELLED.** Prose forces the model to infer modality from a verb; a claim line carries `[hypothetical]` explicitly (§82). **Correctness, not cost.** |

**And the run showed the labelled block working:** turn 1 **asked**; turn 12 with the claims block
**proceeded with 14 known facts.** The gate absorbed the conversation and stopped asking — which
is the "do not ask twice" property `DETERMINATION-GATE.md` §5.2 exists for, demonstrated across
turns for the first time.

### Two things caught in the same run

### §67's PREDICTION, CONFIRMED — recorded as a prediction met, not as a fix

`lib/determinationGate.ts` **could not be imported**: `@/lib/...` is resolved by the bundler and by
`tsc`, **not by Node's loader**, which is what ran the measurement.

**§67 named three files still in that state — `documentReview.ts`, `determinationGate.ts`,
`documentContent.ts` — and said "all three on M1's path."** That was written on 15 September.
**One of the three blocked the first piece of M1 work attempted, the same day.**

> **The prediction is the finding.** A module that cannot be imported does not announce itself; it
> reads as a file nobody has got to. §67 said so, named the three, and the register was right
> within hours. All three are now relative imports.

**What makes this worth recording rather than fixing quietly:** check 29's unrouted list and
§67's unimportable list are both **leading indicators**, and this is the first time one of them
has been checked against an outcome. **It predicted correctly**, which is the argument for keeping
such lists rather than treating them as tidy-ups.

**A probe named a field that does not exist.** My harness printed `ask -> "undefined"` because it
read `ask.fact`; `GateAsk` carries `question`. **Checked before reporting it as a defect** — it
was the probe, not the gate. That is check 14's rule applied to a measurement rather than a test.

**Reversal condition:** if a topic ever runs long enough that context size does move gate latency,
the bound becomes a cost argument as well as a correctness one. At 12 turns it is not.

---

## 84. M1.2b built — three things settled by contact, one left open — 15 September 2026

**Built 15 September 2026 against `docs/GATE-HISTORY.md`. Four demonstrations, from the first
multi-turn conversation this product has ever had.**

### ⚡ THE PROMPT CHANGED. Recorded plainly rather than left to be discovered.

`CLAUDE.md` §3.1 puts prompt edits behind discussion. **This one happened**, and the record should
say so:

`OUTPUT_INSTRUCTION` in `lib/determinationGate.ts` gains **the `frame` block** (jurisdiction,
tense, subject, with the rule that the frame describes THE QUESTION and not the company),
**`hypothetical` in the source list**, and **a do-not-re-ask rule** naming the conversation block.

**It was necessary rather than convenient:** `normaliseFrame` reads `raw.frame`, and without the
prompt asking for one it would default to `present` with no jurisdiction on every call —
**the feature would be inert and would look like it worked.** It is within `GATE-HISTORY.md` §2 as
specified, so it is an edit made under an approved spec rather than an unreviewed one. **It is
still a prompt edit, and this paragraph exists so nobody finds it by `git blame` in a month.**

### 1. `answering` STAYS — and the reasoning is about the handling, not the field

**The test put to it:** does keeping both `answering` and `priorTurns` produce two places carrying
one fact?

**The answer is no, and the reason is sharper than the test:** they are **different turns, not two
records of one.** `priorTurns` is turns 1..N−1; `answering` is the fact supplied in **this** turn,
in reply to the ask this call is re-entering.

> **What produced two places was the OLD HANDLING, not the field.** `answering` was pushed
> straight into `known` — the same list as facts read from `company_switches` — while conversation
> facts would have gone somewhere else. **So the handling folds and the field stays:** `answering`
> becomes the last turn of the conversation and goes through `collapseTurns` with everything else.
> **One code path produces facts; one place collapses them.**

**And the duplicate case needs no special handling.** If a client ever sends the same fact in both,
`answering` is the later turn and wins — **which is §82.4's correction rule applying, not an
exception carved for it.** A rule that covers a case it was not written for is usually the right
rule.

### 2. TURN-ONE TENSE — one pass, one direction. It did not resist.

**Settled by contact rather than by reasoning**, which is what it was flagged for. The apparent
circularity — the gate returns the frame *and* labels facts by it — is that **both outputs come
from the same call, not that either depends on the other.**

**Turn 1 returned `tense=hypothetical, jurisdiction=Phoenix, Arizona` on its first call**, from a
company whose own state is Oregon. Nothing needed the frame before the frame existed.

### 3. THE FOUR DEMONSTRATIONS

```
company: Test Gamma Solvents, Oregon
real facts on file: confined_spaces_present=false · has_employees=true · owns_fleet=true

turn 1  frame: Phoenix, Arizona · hypothetical · "a solvent blending facility"
        ask -> "Would this facility have employees, or would it be owner-operated only?"
turn 2  proceed (2 known)
turn 3  proceed — 4 facts asserted collapse to 3 lines; employee_count now 40 (turn 3)
turn 4  "Would we need a confined space program there?" -> proceed (3 known)
```

**(a) THE FALSE-GREEN FAILURE PREVENTED RATHER THAN ARGUED ABOUT.**
`confined_spaces_present = true [hypothetical]` sits in the conversation while
`confined_spaces_present = false` remains the company's established fact. **Same switch, opposite
values, no conflict** — different frames, so `collapseTurns` keeps both. **This is the thing the
labelling was built for, and it is the first time it has been shown rather than described.**

**(b) NO RE-ASKING.** Turn 4 asked about confined spaces, established in turn 1, and the gate
**proceeded**. `DETERMINATION-GATE.md` §5.2's do-not-ask-twice property, holding across turns for
the first time.

**(c) A JURISDICTION THAT IS NOT THE COMPANY'S**, visible in the frame on every turn.

**(d) A WITHIN-CONVERSATION CONTRADICTION RESOLVED AS A CORRECTION.** Turn 2 says 12, turn 3 says
40, same frame — **turn 3 wins.** Distinct from a contradiction against `company_switches`, which
is v3.2's conflict and is not what happened.

### 4. OPEN — how a hypothetical frame spends the one blocking question

**Not a defect, and not something to fix from one observation.**

Turn 1 asked *"would this facility have employees?"* from a company where `has_employees` is
already `true`. **Treating those as different facts is correct — it is the distinction working.**
The hypothetical facility's headcount is genuinely unknown.

> **But the gate now has a new way to spend its one blocking question: asking about something that
> does not exist.** `DETERMINATION-GATE.md`'s rule is at most one blocking question, paired with
> what it unlocks. **Nothing currently bounds how a hypothetical frame spends it**, and whether
> that question was the one a person would have asked first is unsettled from a single run.

**What would settle it: several multi-turn hypothetical conversations, read for whether the first
question is the one a person would have asked.** Three or four topics, different subjects, read by
somebody who knows the domain — the same instrument that found the library defects in §64, and for
the same reason: **it is a judgement about whether a question is worth asking, and no query can
make it.**

**Reversal condition:** none on the three settled items. On the open one — if a domain read finds
the first question reliably well chosen, this closes as a non-issue; if it finds the gate spending
its question on the hypothetical when the real operation had a blocking gap, that is a rule about
frame precedence and belongs in the prompt.

---

## 85. Classification folds into the gate, and a new question does not close a topic — 15 September 2026

**Not built. Two decisions, both reversing something written, both marked rather than done by
implementation — which is §75's failure and the reason this was asked rather than proceeded with.**

### 1. `WORKSPACE.md` §4.1's "one cheap classification call" is SUPERSEDED

**The three kinds stand** — Elaboration, Refinement, New question. **The separate call does not.**

> **§77 settled the research path at TWO AI calls: gate, then answer, nothing else.** §4.1 was
> written **three days earlier**. A classification call is a third, and it contradicts a decision
> made after it.

**Folding is right rather than merely cheaper, and the reason is that the gate already holds
everything classification needs** — the question, the prior turns, and the frame. **§77 items 6–8
folded web search and frame detection in for exactly that reason**, and this is the same argument
applied to the same call.

**And the objection that more input costs the gate latency is measured and unsupported, twice:**

| | Measured |
|---|---|
| **§76** | narrowing the critic's 33 agencies bought **7.7 s and cost three coverage findings** |
| **§83** | the gate ran **1.3 s FASTER with 7.7× the context** |

§82.5 already records that as a prior: **a design justified by input size needs a number before it
is built.** Here the numbers exist and point the other way.

### 2. THE THREE ACCUMULATION QUESTIONS, ANSWERED

**(a) A superseded turn STAYS and collapses.** It falls out of §83's discipline — collapse only
where a later value supersedes an earlier one **in the same frame**. A refinement that recomputes
does not remove the turn that produced the old value; the turn stays and its fact is superseded by
the newer one. **Already consistent, previously unstated. Now stated.**

**(b) EVERY EXCHANGE IS A TURN**, including an elaboration that asserts no fact.

> **"Turn 4" must mean the fourth exchange, which is what a person means by it.** If turns counted
> only fact-bearing exchanges, turn numbers would stop matching the conversation and **every later
> reader inherits the mismatch** — a rendered transcript, a summary, a support conversation about
> "what did it say on turn 4".
>
> A turn with empty `facts` costs one line in the frame header and nothing else.

**(c) A NEW QUESTION DOES NOT CLOSE A TOPIC — and this corrects §4.1's implication.**

> **"Not a follow-up to the previous answer" and "a new topic" are different things.** Someone
> asking about shipping and then about storage has asked **two questions in one topic**.

- **Classification returns `new_question` as a SIGNAL** — it means the full pipeline runs rather
  than an expansion, and nothing more.
- **Closing a topic is a separate act:** the user, inactivity, or whatever M1.8 specifies.
- **Coupling them means every topic is one question long, which is not a conversation.**

**Accumulating across a question switch is safe under the frame mechanism**: different frames
collapse separately and render labelled, so the gate sees both sets and knows which is which. §83
measured the cost of the extra context and it is nothing.

**Reversal condition:** if a real multi-question topic produces a gate that confuses two questions'
facts **despite** the frames, couple them after all. That is a finding about whether the frame is
a strong enough separator, and it needs a real conversation to produce it.

### Why both were marked rather than implemented

**§75 records the failure this avoids:** Stage 2 was proposed, and it reversed
`CRITIC-PASS.md` §5's written trade **without anyone noticing a decision existed.** It was caught
because the spec was read before the code was written.

**A decision reversed by implementation leaves two documents that disagree and no record of which
won.** `WORKSPACE.md` §4.1 now carries the supersede block and §4.1a, so a reader who starts there
— which is what `docs/README.md` sends them to do — finds the current decision rather than the
1 September one.

---

## 86. M1.2 built — four kinds, two questions in one topic, and a field that was always null — 15 September 2026

**Built 15 September 2026 as specified in `GATE-HISTORY.md` §8. Classification is two fields on
the gate's result, not a third AI call (§85).**

### All four kinds, one conversation, two unrelated questions

```
turn 1  kind=first         refersToTurn=null  Phoenix, Arizona / hypothetical
        because: No earlier turns in this conversation.
turn 2  kind=elaboration   refersToTurn=1     Phoenix, Arizona / hypothetical
        because: Asks for MORE detail about air permitting … without asserting any new fact
                 or changing any established fact.
turn 3  kind=refinement    refersToTurn=1     Phoenix, Arizona / hypothetical
        because: The employee count for the hypothetical facility changed from 12 to 40,
                 requiring recomputation of any thresholds that depend on employee count.
turn 4  kind=new_question  refersToTurn=null  Portland, Oregon / present
        because: The subject changed from a hypothetical Arizona facility to the existing
                 Oregon operation, and the question is about storage rather than employment.
```

**`because` is reasoning rather than guessing**, and that was the field's purpose. Turn 3 names
**what it compared** — *"changed from 12 to 40"* — rather than restating the label. Turn 4 names
**both axes that changed**, jurisdiction and subject. A guess would have paraphrased the question.

### §8.4's contract, checked rather than asserted

```
turns appended               : 4   (4 exchanges = 4 turns, including the fact-free elaboration)
turn 2 facts                 : 0   (empty, and it is still a turn)
employee_count after collapse: 40 (turn 3)
turn 1 still present?        : YES — the superseded turn STAYS
distinct frames              : 2
facts stored anywhere?       : 3 rows in company_switches — UNCHANGED by this conversation
```

### *** THE CORRECTION TO §4.1, EXERCISED ***

**A topic now carries two unrelated questions with both sets of facts visible and correctly
framed** — which had never been run, and was §85's reversal condition waiting to fire:

```
turn 1  Phoenix, Arizona   HYPOTHETICAL  "a solvent blending facility"
          handles_solvents = true        [hypothetical]
turn 3  Phoenix, Arizona   HYPOTHETICAL  "a solvent blending facility"
          employee_count   = 40          [hypothetical]
turn 4  Portland, Oregon   PRESENT       "drum storage at the Oregon plant"
          drum_storage     = true        [stated_in_question]
```

**The gate did not confuse them.** Two frames, collapsed separately, rendered labelled — and the
Oregon turn correctly came back `tense=present` while the Arizona turns stayed `hypothetical`.
**The reversal condition did not fire**, so §85's decision stands: a new question is a signal, not
a topic boundary.

### THE DEFECT: a field that was always null

**All four kinds classified correctly on the first run, and `refersToTurn` was `null` on every
one of them** — including elaboration and refinement, where it must point somewhere.

**The prompt asks for `refers_to_turn`. The normaliser read `refersToTurn`.**

```
prompt      line 252:  "refers_to_turn": 3 or null,
normaliser  line 518:  typeof f.refersToTurn === 'number' ...   // always undefined
```

> **A field that is ALWAYS null looks exactly like a field that is legitimately empty.** Nothing
> failed. The classification was correct throughout, the type checked, 274 tests passed, and the
> one output that carries *which* turn is being followed up on carried nothing.

**It was caught by running all four kinds and noticing that the one which must point somewhere
pointed nowhere.** After the fix: `elaboration → 1`, `refinement → 1`, `new_question → null`.

**This is the same class as `switch_key` (§61's correction), `chemical_name` in `check:live`, and
`ask.fact` in the timing harness — a name that is wrong on one side of a boundary.** Four
instances this week, and **every one of them was invisible to the type system**, because the
boundary is JSON from a model or a database rather than a function signature.

**The general form, and it is narrower and more useful than "check your field names":**

> **When one side of a boundary is a string — a prompt, a query, a JSON payload — the compiler
> cannot see the other side. The only check is to exercise the path and assert on the VALUE, not
> on the shape.** A `null` that should be a number passes every structural test there is.

**Reversal condition:** none. The fallback reads `refers_to_turn` first and `refersToTurn` second,
so a future prompt that changes case does not silently reintroduce it.

---

## 87. `refersToTurn` means a different thing per kind, settled before anything reads it — 15 September 2026

| kind | points at |
|---|---|
| **`elaboration`** | the turn whose **ANSWER** is being elaborated |
| **`refinement`** | the turn that **ASSERTED THE FACT** being superseded |
| **`first`** | null |
| **`new_question`** | null |

**Different semantics, and that is correct rather than a compromise.** An elaboration is about an
**answer**; a refinement is about a **fact**. One field, meaning defined by the kind it
accompanies.

### Why settled NOW and not when the two diverge

**They coincide whenever the fact was asserted in the turn that produced the answer — which is
most of the time.** M1.2's first run had `elaboration → 1` and `refinement → 1` and could not tell
the readings apart.

> **Nothing reads `refersToTurn` today.** So two later readers would each pick the reading their
> own use implied — **rendering wants the answer turn; recomputation wants the fact turn** — and
> **neither would know the other had chosen differently.**
>
> **That is §71's shape before it exists.** Two systems carrying one field with two meanings,
> discovered when they disagree rather than when they are written. §71 (`checklist_items` vs
> `obligations`) and §24 (`scan_result` vs the site's jurisdiction, **still null for 7 of 10
> production companies**) each cost a reconciliation. **This costs a paragraph.**

**The ambiguity is the kind that becomes expensive**, and the cost of removing it is zero while no
caller exists. That is the whole argument.

### The model is TOLD, not left to infer

The prompt names the rule per kind and gives the worked case:

```
refinement    the turn that ASSERTED THE FACT now being superseded — NOT the turn whose
              answer changes. If turn 2 said "12 people" and turn 7 says "40",
              refers_to_turn is 2.
```

**Verified on a conversation where the two readings diverge** — turn 2 asserts the fact, turn 3
answers on it, turn 4 supersedes it:

```
refinement: refersToTurn=2
  fact turn   = 2 (where employee_count=12 was asserted)   <- the RULE
  answer turn = 3 (the most recent answer)
  because: The user corrected the employee count from 12 to 40, superseding the fact
           asserted in turn 2.
VERDICT: follows the per-kind rule
```

**`because` names the turn explicitly**, which is what makes the field auditable rather than
decorative.

---

## 88. Four names wrong on one side of a string boundary — 15 September 2026

**A class, recorded once rather than four times.**

| | The name | Where it broke | How it presented |
|---|---|---|---|
| 1 | `switch_key` | a query against `company_switches`, whose column is `switch_id` | **`data: null` read as "zero rows"** — a conclusion drawn from a failed query (§61's correction) |
| 2 | `chemical_name` | `check:live`'s probe against `company_chemicals`, whose column is `substance_name` | the check failed loudly — **the only one of the four that did** |
| 3 | `ask.fact` | a timing harness reading `GateAsk`, which carries `question` | printed `ask -> "undefined"`, **nearly recorded as a gate defect** |
| 4 | `refersToTurn` | the follow-up normaliser, against a prompt asking for `refers_to_turn` | **`null` on all four kinds, every run** — classification correct throughout (§86) |

**Every one was invisible to the compiler**, because the other side of the boundary is **a string**
— a column name inside `.select()`, a field name in JSON from a model. `CLAUDE.md` §3.6 already
records this for database columns (*"a column name inside `.select('x')` is a string literal —
`tsc` and the generated types cannot see into it"*). **These four show the same hole exists
wherever a model's JSON is parsed**, and `scripts/check-schema-contracts.js` covers only the
database half.

### The general form

> **When one side of a boundary is a string — a prompt, a query, a JSON payload — the compiler
> cannot see the other side. The only check is to exercise the path and assert on the VALUE, not
> on the shape.**
>
> **A `null` that should be a number passes every structural test there is.** So does an empty
> array that should have rows, and so does a `false` that should be `true`. Three of the four
> above produced a value that was structurally perfect and semantically empty, and **only the one
> that hit a NOT NULL constraint announced itself.**

**What this does not claim:** that more types would help. `FollowUp.refersToTurn` was correctly
typed `number | null` and the defect was that `null` is a legal value of that type. **The type was
right and the wire was wrong**, which is exactly the case types cannot catch.

**What would catch it, and it is what caught all four:** running the path and asserting the value
is what it should be — `refersToTurn === 2`, not `typeof refersToTurn`. `npm run check:live` is
this discipline for database writes; nothing yet does it for model output, and the golden cases
are the closest thing.

**Reversal condition:** none. If a future change makes model output type-checked end to end — a
schema validated at the boundary with Zod, which `CLAUDE.md` §5 already asks for — three of these
four become compile-time or parse-time errors and this class shrinks to the database half.

---

## 89. `answering` is already forgeable, and turns will be signed — 15 September 2026

### 1. THE EXPOSURE THAT EXISTS TODAY, independent of anything being built

**`/api/chat` takes a fact from the request body and hands it to the gate with no validation
beyond a `JSON.parse`:**

```
app/api/chat/route.ts:73    answering = body.answering || null;
app/api/chat/route.ts:58    try { answering = JSON.parse(answeringRaw) } catch { answering = null }
app/api/chat/route.ts:128   answering,          // straight into gate()
```

**A client can POST `{"answering": {"fact": "employee_count", "value": "5000"}}` and the gate
treats it as established.** That is live now.

**The real blast radius, stated exactly rather than inflated:**

| | |
|---|---|
| **Not a tenancy breach** | `company_id` comes from `requireCompany()` at `route.ts:35`, never from the body (§3.6). A forged fact cannot reach another company |
| **Not a persisted lie** | `/api/chat` contains **no `insert`, `upsert` or `update`** — grep returns nothing. A forged fact cannot become a `company_switches` row through this route |
| **It IS** | **a wrong answer to the person who forged it**, with no marker that its premises were supplied rather than established |

**Two ways that matters even so:** a user pasting a shared conversation, or a client bug replaying
stale turns, produces a confidently wrong compliance answer — and *"the user only harms
themselves"* is a weak defence in a product sold on being right.

> **M1.2c does not create this. It multiplies it** — from one fact per request to a whole
> conversation.

### 2. THE DECISION: turns are SIGNED

The server returns each turn with an HMAC; the client sends it back; the server verifies before
the gate sees it. **Nothing is stored** — §78 is preserved exactly, the client still holds the
conversation, and the server refuses a turn it did not issue.

**Why now rather than later, and it is the argument that has settled three other things this
week:**

> **It is free now and a contract change later.** There are no clients — `/api/chat` does not pass
> turns at all. Building M1.2c with signing costs an HMAC; **retrofitting it means changing a
> shipped request shape.** Same argument as `topics` (§69: free today, a migration over customer
> conversations tomorrow), `entity_id`, and `memberships`.

**Why (3) — "mark it and trust it less" — was rejected specifically:**

> **A client that can forge a turn can forge the source label on it.** Marking a fact as
> client-supplied only helps if the mark itself cannot be edited, which requires signing — **at
> which point signing is doing the work and the mark is decoration.**

**And (2), keeping turns server-side, contradicts §78** for hypotheticals specifically: it is the
two-systems problem §78 was written to avoid.

### 3. IT ADDS AN EIGHTH CREDENTIAL, AND THE LIST IS ALREADY OVERDUE

**A signing secret is a new credential on a gate item that currently reads "Key rotation. Seven
credentials." and has been deferred repeatedly.** Four leaked in a zip on 9 Sep; both database
passwords were printed to a terminal on 10 Sep; **the production service-role key was printed in
full on 12 Sep and is the most sensitive of the seven, because the service role bypasses RLS
entirely.**

> **Recorded now rather than discovered at rotation.** An eighth credential does not make the
> rotation harder in proportion — it makes it one item longer — but **a list that grows while it
> waits is a list that is being deferred into something bigger**, and that is the mechanism by
> which this kind of work never happens.

**The mitigation that costs nothing: the signing secret is born rotated.** It is created after the
other seven are rotated, or it joins them in the same pass. It is the only one of the eight that
has never leaked, and it should stay that way by being the last one created rather than the first
one forgotten.

**Reversal condition:** if the product ever gains a shared-conversation feature — one person
sending another a topic — signing becomes load-bearing for a second reason, and option (4), doing
nothing, stops being arguable at all.

---

## 90. A signature proves issuance, not completeness — 15 September 2026

**Caught in review of §9's spec, before any code was written.**

### The attack the spec was missing

**Each turn is signed individually and `turn` is inside the MAC. So a client can send turns 1, 2
and 4 — dropping turn 3, where a correction happened — and every remaining turn verifies.**

> **That is forgery by OMISSION rather than by authorship, and it is the more useful attack.**
> Keep *"12 employees"* from turn 2; drop the turn where it became 40. **Nothing is forged**,
> nothing fails to verify, and the gate reasons from a fact the user corrected.

**Signing was specified against forgery by authorship and did not address it.** Demonstrated:

```
server issued 3 turns: employee_count 12 -> 40 (corrected in turn 2)
client sends turns 1 and 3 — both genuine, both signed by us, turn 2 dropped
RESULT: REFUSED — turns are not contiguous

  turn 1 alone : 1 turn verified          <- each was legitimately issued
  turn 3 alone : refused                  <- the SET is what is checked
```

**The fix is a contiguity assertion — exactly `1..N`, no gaps, no repeats — and it costs one
comparison.** It also catches reordering and duplication, which the MAC does not.

### *** A MAC CHAIN WOULD NOT FIX TRUNCATION EITHER, AND THIS IS THE PART WORTH KEEPING ***

The natural next thought is to chain the MACs — `sig_n = HMAC(secret, canonical_n || sig_{n-1})` —
so the set proves its own order. **It would catch reordering and insertion. It would not catch
truncation.**

> **A truncation is a VALID PREFIX.** Turns 1–3 chain correctly whether or not a turn 4 was ever
> issued. **Chains prevent reordering and insertion; they do not prevent stopping early.**
>
> ### AND THIS CORRECTS THE TRADE-OFF AS IT WAS PUT.
>
> The chain was offered as *"the option that would catch both, at more cost"* — a choice between
> catching omission cheaply and catching **both** expensively. **There was no such choice.** A
> chain catches omission, which contiguity already catches for one comparison, and **buys nothing
> against truncation.**
>
> So the decision was never "is truncation worth the extra cost" — **it was "truncation cannot be
> caught by any signing scheme without server state", which is a different question with a
> different answer.** Recorded because the trade-off as described would have made accepting
> truncation look like a budget decision, when it is a structural one.
>
> **Catching truncation requires the server to know the expected head**, which means state — and
> the whole scheme exists because §78 says nothing is stored.

**So the chain is not worth its cost here**: contiguity gets the case that matters for one
comparison, and the case it misses is the one a chain also misses.

### Why truncation is ACCEPTED, and the reason is about the user rather than the maths

| | |
|---|---|
| **Omission in the middle** | has **no legitimate counterpart.** A client has no reason to hold turns 1, 2 and 4 and not 3. It is only producible deliberately — so refusing it costs nothing honest |
| **Truncation** | is **indistinguishable from ordinary loss** — a closed tab, a failed response, a reload before the turn landed. **A client that legitimately never received turn 4 sends exactly what an attacker sends** |

**Refusing truncation would refuse the honest case equally**, and there is no signal that separates
them. It is also close to what a user can already do by starting a fresh conversation — the
difference being that starting over carries **no** stale facts while truncating carries **some**,
which is why it is accepted rather than dismissed.

**If it ever needs closing, the cheapest form is a counter, not a chain.** `topics` exists and has
no `last_turn` column; adding one and refusing any conversation whose highest turn is below it
catches truncation exactly. **§78 does not forbid it** — §78 forbids storing hypothetical **facts**,
and a turn counter is not a fact. **Not proposed now**, because the legitimate-loss case would then
need a recovery path, and that is a product decision rather than a security one.

### What M1.2c shipped with

`lib/turnSigning.ts` — `sealTurn`, `verifyTurns`, `BadConversation`. **14 tests, every one an
attack**, and each changes exactly ONE thing from a valid conversation and asserts on the **reason**
rather than on the fact that something threw (check 14, §81).

- Editing a value, inventing a turn, changing the **frame**, renumbering — all refused by signature
- **Another company's session and a different topic id** — refused, because `company` and `topic`
  are inside the MAC rather than checked afterwards
- **Omission, reordering, duplication** — refused by contiguity, and one test asserts that the
  dropped-turn set's members each verify individually, **proving the signature is not what caught
  it**
- **Truncation accepted**, with the test naming it as the documented gap
- **A short or missing secret refuses to sign** — a default secret is a signature that proves
  nothing and **reads as verified**

**And one Node constraint, the same family as §67:** `constructor(public readonly reason: string)`
is a TypeScript parameter property and **Node's type stripping rejects it**, which is what runs the
suite. Declared and assigned explicitly instead. The suite runs the real files rather than a build
of them, and that keeps producing small surprises of this shape.

**Reversal condition:** if a shared-conversation feature ever lets one person send another a topic,
truncation stops being indistinguishable from loss — the sender knows what they sent — and the
counter becomes worth adding.

---

## 91. M1.2c wired — the loop closed, over HTTP — 15 September 2026

**The route change and the conversation contract, built and run as a signed-in user against
staging. This is the first time anything from M1.2b onward has been REACHABLE.**

### Turn 1 — no turns sent

```
HTTP 200  58.9s
followUp : {"kind":"first","refersToTurn":null,"because":"No earlier turns in this conversation."}
frame    : {"jurisdiction":{"state":"Arizona","city":"Phoenix"},"tense":"hypothetical",
            "subject":"a solvent blending facility"}
turn     : turn=1  facts=2  sig=db4820dccc4aff3e…
```

**Absence is not failure** — no `turns` field, a normal first turn, and a signed turn comes back.
The gate attributed two facts to the question: `business_type = blend` and
`hazardous_chemicals_present = true`, both `[stated_in_question]`.

### Turn 2 — sending turn 1 back

```
HTTP 200  29.0s
followUp : {"kind":"elaboration","refersToTurn":1,
            "because":"Asks for MORE detail about OSHA requirements for the hypothetical
                       Arizona facility already being discussed, asserting no new facts."}
turn     : turn=2   (the SERVER numbered it)
gate re-asked anything from turn 1? no — proceeded
```

**The gate did not re-ask what turn 1 established**, and `refersToTurn` points at 1 — which is the
field that was `null` on every call two commits ago (§86).

### The attacks, over the wire and not in a test

```
edited fact value                     HTTP 400  "We could not verify this conversation."
invented turn with a made-up sig      HTTP 400  "We could not verify this conversation."
OMISSION — turn 2 alone, genuine      HTTP 400  "We could not verify this conversation."
replayed into a different topic       HTTP 400  "We could not verify this conversation."
unmodified turns 1 and 2              HTTP 200  outcome=ask
```

**The third is §90's attack**, refused in production code rather than in a unit test: turn 2 is a
turn the server issued and signed, and it is refused **because the set is incomplete**.

**And the server log distinguishes the reasons while the response does not:**

```
[/api/chat] conversation rejected: "a turn did not verify"      topic: 433562a2-…
[/api/chat] conversation rejected: "turns are not contiguous"   topic: 433562a2-…
[/api/chat] conversation rejected: "a turn did not verify"      topic: 00000000-…
```

**One message to the caller, four distinct reasons in the log, and the topic id rather than the
turn contents.** A verification error that narrates its reasoning to the client is a tool for
finding the field the MAC does not cover.

### Check 29's three sub-shapes, closed

```
priorTurns    app/ callers: app/api/chat/route.ts
followUp      app/ callers: app/api/chat/route.ts, app/compliance/page.tsx
turnSigning   app/ callers: app/api/chat/route.ts
```

**`lib/` is down from four modules with no production caller to ONE** — `sdsExtraction`, waiting
on M4's document surface, deliberately. `folderTemplates` was **deleted**: 0 references anywhere,
and git says why (`e1d3182` *"remove all background folder creation"*, `bd25159` *"contradicted the
impose-no-folders decision"*). **It was the residue of a feature deliberately removed, not
something waiting to be wired**, and listing a dead module beside a deliberate deferral makes the
list worth less — one entry is a queue, two of different kinds is a pile.

> **This was three inert modules from one piece of work**, which is what made stopping before the
> route wrong: `priorTurns`, `followUp` and `turnSigning` were each correct, tested, and reachable
> by nothing. **The check that names them is what made that visible**, and it has now been useful
> twice — once as a leading indicator (§83) and once as a stopping rule.

### One thing measured that is not a defect but should not be forgotten

**Turn 1 took 58.9 s and turn 2 took 29.0 s** on the research path. §74 measured the critic alone
at 36.4 s and §76 showed narrowing its input does not help. **The research path drops the critic
entirely (§77)**, so these numbers are gate plus answer — and the first turn is roughly twice the
second because the frame and the facts are being established from nothing.

**A minute for the first turn of a conversation is a product problem, not a correctness one**, and
it is the same open question §76 left: whether a synchronous answer is viable at all, which is
about D25 rather than about anything built here.

---

## 92. The conversation is a minute long, and that is a PRODUCT problem — 15 September 2026

**Filed as a different category from everything else this week, because it is one.**

### The measurements

| | | |
|---|---|---|
| **§74** | critic alone, 5-item checklist, 33 agencies | **36.4 s** (33.2–42.2, n=3) |
| **§76** | critic alone, same input, **4** agencies | **28.7 s** — narrowing bought 7.7 s and cost 3 findings |
| **§83** | gate alone, turn 1 vs turn 12 | **9.9 s → 8.7 s** — *faster* with 7.7× the context |
| **§91** | **/api/chat, research, over HTTP, as a signed-in user** | **turn 1: 58.9 s · turn 2: 29.0 s** |

**§91's two are gate plus answer with NO critic** — §77 drops it from the research path entirely.
So a minute is the honest cost of the path as designed, not the cost of something that can be
switched off.

**Turn 1 is roughly twice turn 2** because the frame, the subject and the facts are all being
established from nothing; turn 2 reuses them.

### Why this is a different category from the rest of this week

**Everything else recorded since 13 September is a correctness finding** — a wrong claim, an
unreachable module, a name wrong across a boundary, a check that passed for the wrong reason.
**Each had a right answer and was fixed.**

> **This one has no defect.** The gate is correct, the answer is correct, the signing is correct,
> and the conversation takes a minute. **Nothing is wrong; the thing is slow.**
>
> **It is filed as a product problem so it stops being re-derived as a technical one.** Twice now
> a latency intuition has produced a design proposal that measurement killed — Stage 2 (§76) and
> the trimming rule's motivation (§83), and §82.5 records that as a standing prior.

### What is NOT the answer, on evidence rather than opinion

- **Not narrowing the input.** Measured twice, both times unsupported: §76 bought 7.7 s and lost
  three coverage findings; §83 got *faster* with 7.7× more.
- **Not tuning the prompt or dropping a model tier.** `CRITIC-PASS.md` §5 and `CLAUDE.md` §3.1 —
  and the critic is not even on this path.
- **Not removing a stage.** There are two calls. §77 already removed everything removable.

### What the answer actually is, and it is a product decision

**Either the answer streams, or the wait is made honest, or the work moves off the request.**

1. **Stream the answer.** A minute of prose arriving is not a minute of blank screen. Changes
   `/api/chat`'s response shape and every caller.
2. **Make the wait honest** — `CLAUDE.md` §5: *no infinite spinner*. The gate's own output is a
   natural progress signal, since it finishes in ~9 s and knows what it is about to ask.
3. **Move it to the worker** — which reopens **D25** (synchronous) and needs Phase 5.

**All three are product decisions rather than engineering ones**, and D25 is a written decision, so
choosing (3) reverses it and must be reversed on the record rather than by implementation (§75).

**Reversal condition:** none — this is a measurement and a categorisation. It closes when a
product decision is taken, not when a number changes.

---

## 93. Drift caught by comparing dates, not by reading — 15 September 2026

**A version-and-line-count listing printed for a different purpose showed three documents stamped
12 September while eleven migrations and three gate changes had landed since.** Two of the three
described live behaviour wrongly.

| Document | What it said | Reality |
|---|---|---|
| **`CRITIC-PASS.md`** v2 | research gets the critic *"once it is structured"* — a **temporary** exclusion waiting on a `must_do[]` | §77 dropped it **permanently**, and for a different reason: **a conversation self-corrects**. The stage moved to the checklist boundary. **Fixed → v3** |
| **`DETERMINATION-GATE.md`** v4 | `GateResult` as `{outcome, resolved \| ask}` | The code returns `frame` and `followUp` too, and takes `priorTurns`. **0 mentions of any of the three.** **Fixed → v5** |
| **`INVENTORY.md`** v1 | a snapshot of counts | **Correct as history.** Kept, with the date raised into a block at the top |

### THE FINDING IS HOW IT WAS FOUND

> **By noticing DATES, not by reading content.** The three sat at 12 September in a table printed
> to answer a different question, and the gap was visible without opening any of them.

**Reading eighteen documents to find two that are wrong is expensive and nobody does it.**
Comparing two dates is free and narrows eighteen to three before anything is opened. It is now
`AUDIT-CHECKS.md` **check 31**, and running it today gives:

```
2026-09-10  PATTERNS.md
2026-09-12  DETERMINATION-GATE.md
2026-09-13  BUILD-PLAN.md · CRITIC-PASS.md · EVIDENCE-LINKING.md · INVENTORY.md
---
last change to lib/ app/ supabase/migrations/: 2026-09-15
```

**And the signal is not staleness.** `PATTERNS.md` is the oldest file here and is correct — it
describes a different codebase. **The signal is a document that has not moved while the thing it
describes HAS**, which is why the check compares two dates rather than reading one.

### The fix pattern matters as much as the fix

**`DETERMINATION-GATE.md` was fixed by POINTING, not by restating.** The gate's three new fields
live in `GATE-HISTORY.md`; that file now carries a table naming each and where it is described.

> **Two descriptions of one mechanism drift, and the drift is invisible.** That is the failure
> which produced this entry — and restating `priorTurns` in a second file would have created the
> next one. **One authoritative description per thing, a pointer from everywhere else.**

**And `CRITIC-PASS.md`'s correction is the subtler of the two**, worth naming because it would
have been easy to call it already right: **the file already excluded research.** It was not wrong
about the outcome. **It was wrong about the reason and about the permanence** — *"not until it is
structured"* implies the exclusion ends when the output gains a `must_do[]`, and §77's reason
never ends. A reader would have built toward a milestone that is not coming.

**Reversal condition:** none. The check costs two `git log` calls.

---

## 94. A defect that reproduces itself as the library grows — 15 September 2026

**Check 2's number moved, and the movement is the finding.**

```
Oregon rows citing 29 CFR              11 Sep: 49    15 Sep: 60
rows with citation_federal_analogue    11 Sep:  0    15 Sep:  0
```

**Migration 013 split three under-decomposed OR-OSHA requirements into eleven children, and every
child inherited the federal citation in the wrong field.** The column built to hold the state
citation — `citation_federal_analogue`, added by migration 007 so a row could say *"OAR
437-002-0360, which adopts 29 CFR 1910.1200"* — stayed empty while the population doing the wrong
thing grew by eleven.

> ### THE COUNT IS NOT THE FINDING. THE MECHANISM IS.
>
> **This defect reproduces itself every time the library grows.** A split copies its parent's
> citation; nothing looks at which field it lands in; and **6.4's worklist grows with the library
> rather than staying at 60.** A fix that corrects 60 rows and changes nothing else is a fix that
> has to be repeated after the next split.

### What would stop it, none of it built now

Three places, cheapest first:

1. **A rule in whatever writes a child row.** Migration 013's split block sets
   `agency_id`, `split_from_id` and the text by hand. **A split that copies a `29 CFR` citation
   onto a `state`-layer row should move it to `citation_federal_analogue` and put the OAR in
   `citation`** — at the point of writing, where the parent's intent is still known.
2. **A CHECK constraint**: a `state`-layer row whose `citation` matches `CFR` must have
   `citation_federal_analogue` non-null. **Cheap, and it would have refused all eleven children at
   insert.** It also refuses the 60 rows that exist, so it can only land after they are fixed —
   which is the right order and makes the constraint the thing that keeps them fixed.
3. **A standing check**, which is what exists today: check 2, hand-run, reporting a number that
   may only fall. **It is the weakest of the three because it reports rather than prevents**, and
   the growth from 49 to 60 is what a reporting-only check looks like when nothing acts on it.

**Recommended: (1) then (2).** The rule stops new instances; the constraint makes the stop
permanent and cannot be added until 6.4c has cleared the existing 60. **Not built now** — it is
6.4c's work and belongs with the revision rather than ahead of it.

---

## 95. My own instance of §81, inside the sweep that was checking for it — 15 September 2026

**Running the standing checks, I wrote a stricter test than check 2 and labelled it with check 2's
number.** It returned 2 rows and I reported them as a failure:

```
FAIL  2  Oregon requirements citing Oregon rules   — rows citing neither Oregon nor a CFR
```

**Check 2 does not ask that.** As written it asks how many Oregon state rows cite 29 CFR, and how
many rows carry a `citation_federal_analogue`. **My version invented a third question and inherited
the number's authority.**

**The two rows it found were not defects** — `OFC / NFPA 101` (Oregon Fire Code and an NFPA
standard) and `2025 session law, eff. Jan 1, 2026` (a law not yet codified into ORS). **Both are
correct citations that simply name neither an OAR nor a CFR.**

> **This is §81's shape — a probe that tests something other than what it claims — committed by me,
> inside a sweep whose purpose was running checks faithfully.** Caught by looking at the two rows
> before recording them, which is the one habit that works: **the finding had to survive being
> read.**
>
> **The rule now has instances on both sides of this conversation**, which is the useful form of
> it. A discipline only one party is held to is a performance; one that catches its author is a
> check.

**And the correct run found something better than the false failure would have been** — §94's
mechanism, which no version of my stricter query would have surfaced, because it depends on
comparing today's count against the one recorded four days ago.

---

## 96. M1's order reverses, and four decisions about the first writer — 21 September 2026

**M1.3 is the first thing in this codebase that would write a company fact from a conversation.
Everything below exists because a first writer decides things a later one only inherits.**

### THE ORDER CHANGED, AND THE REASON IS A COUNT

**`TODO.md` had M1.4 (site resolution) depending on M1.3 (fact capture). For the site-scoped
majority that dependency runs the other way**, and the number is the whole argument:

```
select scope, count(*) from public.switches group by scope;   -- staging, 21 Sep
  site     73
  company  22
```

- **73 of 95 switches are site-scoped**, and `/api/switches/answer` refuses every one of them
  without an `entity_id` — `route.ts`: *"This question is about one site. Tell us which one."*
- **The conversation has no concept of a site.** `WORKSPACE.md` v3.3 already said so; nothing has
  changed it.
- So **M1.3 built first is a writer that can address 22 of 95 facts** and whose call shape changes
  the moment the site arrives. That is building it twice, which is the thing `CLAUDE.md` §2's
  ordering rule exists to prevent.

**And a third item precedes both, which no row had:** `/api/switches/answer` has **zero callers**,
`app/compliance/page.tsx` sends neither `turns` nor `topicId`, and nothing creates a `topics` row
(`grep from('topics')` returns one cleanup in `scripts/check-live.js:84`). The chat route reads
`const newTurn = topicId ? sealTurn(...) : null` — **so in the browser today every turn is turn
one and no conversation exists.** M1.2c is real over HTTP and inert to a person.

| New order | |
|---|---|
| **1. M1.2d** | **The conversation surface** — M1.2c's missing half. Nothing in M1 is reachable by a user until it exists |
| **2. M1.4a** | **The single-site slice** — the one-site rule, and `entity_id` on the fact |
| **3. M1.3** | **Fact capture** |

> **The single-site rule is NOT a default to the primary site.** §20 forbids defaulting because a
> company-wide answer to a per-site question is *wrong at every site but one, confidently*. **When
> the company has exactly one `entities` row there is no second site to be wrong about** —
> the set of sites the answer could belong to has one member, so nothing is being assumed.
> `WORKSPACE.md` v3.3 already states it as *"never ask"*. **"Which site" and "all of them writes N
> rows" stay in M1.4** and are genuinely M1.4's problem.

### (a) A STATED FACT IS STORED IMMEDIATELY, NOT AT TOPIC CLOSE

> ### ⚠ NARROWED 21 September 2026 — §108. **This now applies to the ASK PATH ONLY.**
> A fact **inferred from free conversation** is no longer stored in real time at all: whole
> conversations are read overnight and what is found is **proposed**, not written. A person
> answering a direct question still writes at once, exactly as below.
>
> **The argument below survives and is met differently.** *"The value of a captured fact is the
> NEXT TURN"* is true — and the next turn already has it, because the gate sees prior turns with
> nothing stored. **What this section got wrong was treating "available to the next turn" and
> "written to `company_switches`" as one act.**

**Decision: the write happens at the turn that states the fact.**

**Topic close is too late, and the reason is what a captured fact is FOR.** Its value is the
**next turn** — the gate not re-asking what was just said — and every later conversation. A fact
held until close is a fact the rest of that conversation cannot use, which is the *"asks twice"*
failure `WORKSPACE.md` §5.2 exists to prevent, moved one level up.

**The cost objection does not survive measurement.** The whole `/api/switches/answer` POST — three
writes plus a full 200-row obligation recompute — is **0.5 s** on a fresh company (`TESTING.md`
Case A, measured 15 Sep). There is no budget argument for batching it to the end.

**`user_locked` is correct here, and it is not an overreach.** v3.2 defines the flag as *a person
decided*. **A person stating a fact IS a person deciding it** — the statement is the decision, and
nothing about saying it mid-conversation rather than in answer to a direct question makes it less
so.

#### The exception is INTERPRETATION, and it is a narrow one

> **"about fifty" is not 47.**
>
> **Confirm when the value had to be COERCED into the switch's type. Write directly when it did
> not.** A person saying *"yes"* to a boolean switch has been understood; a person saying *"about
> fifty"* to a number switch has been **interpreted**, and an interpretation written as
> `user_locked` is the product putting its own reading behind a person's name.

This is not a confidence tier and must not grow into one — see the superseded ladder below. It is
one mechanical test applied at the write boundary: **did the raw string survive into the stored
value, or did something decide what it meant?**

#### WHICH RESOLVES A CONTRADICTION, AND BOTH SIDES LOSE SOMETHING

| Source | What it said | Outcome |
|---|---|---|
| `WORKSPACE.md` §6.1 | *"Closing extracts facts before discarding. Any `user_stated` facts write to switches."* | **SUPERSEDED.** Close still writes the summary and discards the transcript; it has no facts left to extract |
| `TODO.md:1996` | *"Established facts write to `company_switches`… `user_stated` applies immediately"* | **Upheld** — this half was right |
| `TODO.md:1996` | *"…`ai_inferred` confirms before applying"* | **GOES.** This is `WORKSPACE.md` §5.2's three-tier ladder, which **v3.2 marked SUPERSEDED, not translated** — *a lock prevents a write; a gate delays one*, and the schema already prevents it |

**The instructive part is that the surviving half and the dead half sat in one four-line list**,
and the dead half carried vocabulary (`ai_inferred`) that exists in no enum in the schema. A
superseded scheme does not announce itself; it survives as the words a later list is written in.

### (b) THE WRITE PATH ACCEPTS A `KnownFact`, NOT A `{switch_id, value}` PAIR

**This is the one decision here that keeps §78 structural, and it is worth stating as a
mechanism rather than as a preference.**

**What protects a hypothetical from being stored today, precisely:**

| | Protection | Structural? |
|---|---|---|
| 1 | `company_switches.source` is the enum `switch_value_source` = `('ai_from_documents','ai_from_profile','user_set','computed')` — migration 008:77. **Neither `stated_in_question` nor `hypothetical` is a member** | **Yes. Postgres refuses it** |
| 2 | `writeObligations` reads `company_switches` and nothing else (`obligationWriter.ts:107`) | **Yes** |
| 3 | `/api/switches/answer` takes `{switch_id, value, entity_id}` and no frame, so a hypothetical cannot arrive labelled | **No — it holds only because nothing carries a fact across that boundary** |

**M1.3 is the thing that carries it, so protection 3 is the one it would break.**

> ### THE PAIR SHAPE STRIPS THE LABEL BEFORE THE DATABASE SEES IT.
>
> The enum refuses a **labelled** hypothetical. It cannot refuse a **stripped** one.
> `fromUserAnswer()` (`switchDetermination.ts:228`) hardcodes `source: 'user_set'` on everything
> it is handed. Map a gate fact into `{switch_id, value}`, post it, and the label is gone two
> function calls before Postgres is reached — **so "the Arizona facility would have 12 employees"
> is written as a fact a person set about their own company**, and nothing in the stack objects.

**Decision: the write path accepts the gate's `KnownFact`, which carries `source`.** A
`hypothetical` then reaches the enum and is refused by the database, with **no rule for anyone to
remember and nothing to forget at a mapping step.** That is what §78 means by structural, and the
alternative — M1.3 filters before posting — is precisely the remembered rule §78's reasoning
rejects.

### (c) M1.3 WRITES ONLY WHAT A PERSON STATED, AND THE FILTER MAY NOT WIDEN

`app/api/chat/route.ts:44` already does the right thing: `factsFromGate()` keeps **only**
`stated_in_question` and `hypothetical`. **The rest of the gate's `known` array is not a person
speaking** — `determinationGate.ts:410–412` pushes `ai_from_profile` worksite facts into the same
list, and `company_switches` rows come back through it too.

**M1.3 inherits that filter and must not widen it.** Widening it makes an AI determination a
second writer of `company_switches`, and **the moment a second writer exists the `user_locked`
conflict becomes real** rather than theoretical.

**Which is why 7.2c stays where it is, and the condition is stated so it can be checked:**
`grep -rn user_locked app lib scripts tests` returns exactly **one** production line —
`answer/route.ts:108`, which *sets* the flag — plus `decideOutcome`, which *reads* it and has
**zero callers outside its own module**. So today **the conflict M1.6 displays cannot occur**:
every writer is a person, and `decideOutcome` explicitly permits what the route does — *"A person
changing their own answer always wins, including over their earlier one."*

> **7.2c is scheduled before M1.6 and not before M1.3 — ON THE CONDITION IN (c).** If the filter
> ever widens, or any determination path gets a route, **7.2c becomes urgent that day** and this
> line is the thing to re-read.

### (d) A FACT WITH `switch_id: null` IS NOT WRITTEN — IT IS HELD IN THE TURN

The gate's own prompt produces these deliberately — `determinationGate.ts:351`: *"Use a switch_id
ONLY if the vocabulary below lists it. Otherwise null."* A conversational fact can therefore
arrive as a free-text label with no switch behind it.

**Decision: held in the turn, not dropped, and it does not reach the route.**

- **Held, because dropping it would make the gate re-ask it next turn** — the *"asks twice"*
  failure again. The conversation is the correct home for a fact with nowhere else to live, which
  is §78's own reasoning applied to a second case.
- **It already is held, and this costs nothing to keep.** `factsFromGate` filters on `source` and
  **not** on `switch_id`, so a null-switch fact is already carried onto the sealed turn and already
  renders in `renderConversation`. **The decision is a refusal at the write boundary, not a new
  mechanism.**
- **It does not reach the route.** `/api/switches/answer` refuses a missing `switch_id` with a 400
  anyway; sending one and catching the refusal would put a normal outcome through an error path.

**What this deliberately does NOT do:** it does not invent a switch, and it does not queue the
fact for a human to map later. **D24 — capture facts, do not generate questions.** A fact the
vocabulary cannot express is a signal about the vocabulary, and `AUDIT-CHECKS.md` check 28 is
where that belongs if it ever becomes a pattern.

### (e) SEVERAL OPEN TOPICS PER COMPANY — the fork M1.2d forces, closed the day it was flagged

**`WORKSPACE.md` §9.4 and `TODO.md` M1.0b are CLOSED. Several. No partial unique index.**

M1.0b recorded this as **not deferrable after the fact** — *"One is a partial unique index on
`(company_id) where status = 'open'`; several is the absence of one… adding the constraint later
means closing somebody's open work."*

**It is the right product, not only the smaller build:**

- **§87 settled that a new question does not close a topic**, so **topics carry threads.**
  Shipping in the morning and hiring in the afternoon are two of them, and one-open-topic makes
  starting the second require closing the first — asking a person to file their work before they
  have finished with it.
- **Two users, and one-open-topic becomes one person blocking another.** `CLAUDE.md` §3.6: several
  `profiles` sharing a `company_id` is *a normal, working state*. A constraint on `(company_id)`
  serialises colleagues with nothing to do with each other.

> **The asymmetry was the whole argument for "one", and it does not survive contact.** Relaxing is
> free and tightening closes somebody's open work — **but that only matters if we would ever
> tighten**, and no product wants a single open thread per company. The option the asymmetry
> protects is one we would never take.

#### The third option, REFUSED and recorded as refused

**A reload RESUMES the open topic with an empty turn list.** The row stays continuous; the
context does not.

> **It is a continuous record with discontinuous content.** The row claims to be the same
> conversation while the gate remembers none of it, so the summary M1.8 writes and the thread a
> person returns to both read one exploration where there were two — **and nothing on screen says
> the middle went missing.**
>
> **A thing claiming a continuity it does not have is what `CLAUDE.md` §5.1 and §6 exist to
> prevent**, and it is §9.3's shape exactly: dropping the turns and carrying on produces a
> correct-looking answer computed from nothing.
>
> **It is recorded because it looks tidy** — no empty rows, no new state — so a later reader
> optimising for either would arrive at it honestly. Considered, refused.

#### The pile of open topics is M1.8's work, not a defect

Every reload creates a row, turns die with React state, and **nothing closes a topic until M1.8**.
Open rows with null summaries accumulate, and that is the designed intermediate state:

**visible** (`select count(*) from topics where status='open'`) · **bounded to test data today**,
since no production company can reach the surface before M1.8 ships in the same module · and the
answer is **already designed, not new work** — `WORKSPACE.md` §6.1's **auto-close on inactivity**,
*"a topic idle for a week closes itself and says so."*

**What would make it a defect is an open row a person can see and cannot close.** That is M1.8's
acceptance condition, not a reason to hold M1.2d.

### Reversal conditions

| Decision | Reverses if |
|---|---|
| **(a) immediate** | the recompute stops being cheap — a company whose obligation count makes 0.5 s into seconds. **The figure is per-write and measured once, on 200 rows** |
| **(b) `KnownFact` shape** | nothing currently foreseeable. It costs one parameter and removes a class of defect |
| **(c) filter held narrow** | never as such — but it **expires** the moment a determination path gets a route, and then 7.2c precedes M1.6 rather than merely being scheduled before it |
| **(d) held, not written** | a real case appears for promoting a null-switch fact to a real one. §78's own reversal applies: **the fix is a deliberate user action, not a storage decision** |
| **(e) several open topics** | a named case for serialising a company's explorations. **Reversing means closing somebody's open work**, which is why it was decided rather than defaulted |

---

## 97. The critic's findings are ours, not the customer's — 21 September 2026

**Decision: no critic output reaches a customer. All four boxes come off every customer view.
The findings are kept, and their audience changes.**

### What went wrong, from the rows rather than from the spec

A browser test on 21 Sep produced a saved view showing the critic's full output — *"5 items were
removed from this answer"*, *"Not covered here"*, *"Worth knowing"*, *"5 specific figures … have
not been checked"* — sitting above a research answer it did not belong to.

**And the content of it is the argument.** The critic had withheld the **1200-A** permit, which is
the wrong permit for this site. **That is the critic working.** What the customer saw was a red
box headlining the 1200-A by name, with the reason it was removed — so **a correct answer, caught
and corrected, read as a wrong one.** The product did its job and then reported itself for it.

> ### A CUSTOMER RECEIVES THE CORRECTED DOCUMENT, NOT THE CORRECTIONS.
>
> All four boxes are a **red-lined draft.** Red-lining is quality control and quality control is
> ours. Handing it over does not make the product more honest — it makes a caught error
> indistinguishable from a shipped one, and it is the caught ones that fill the box.

### THIS REVISES HOW §2.3 IS APPLIED, NOT ITS REASONING

`CRITIC-PASS.md`'s rule is **surface, don't fix**: the critic *"reports and never regenerates — a
silent fix destroys the evidence, and a self-healing loop means no failure is ever found."*

**That reasoning is untouched and is the reason the findings must still be written down.** What it
was never about is *who reads them*. Surfacing preserves the evidence; it does not follow that the
evidence is a customer-facing feature. **The evidence is kept. The audience changes.**

**And nothing honest is lost by the removal.** The page disclaimer already says to verify against
the cited source, which is exactly what the unverified-figures box carried — `CLAUDE.md` §6's
requirement that unchecked figures carry a caveat is satisfied by the disclaimer, not by a count.

### THE WATCH ITEM, WHICH IS A REAL COST AND IS NOT AN ARGUMENT AGAINST THIS

**A removal can leave a hole where the right answer belonged.** The 1200-A came out and **nothing
put the 1200-Z in** — so the customer got a checklist quietly missing the permit they actually
need, and previously got a red box naming the wrong one.

> **That is an UPSTREAM QUALITY PROBLEM. It is not a reason to show the critic's working.**
> Showing a customer a removal notice does not give them the 1200-Z either; it gives them the
> 1200-A plus an explanation. The fix is generation that reaches the right permit, and §7.1's
> rate — **blocking findings as a share of answers** — is how we would know it is not.

### What is built

| | |
|---|---|
| 1 | **`CritiqueNotice` renders in no customer view.** Both call sites on `/compliance` |
| 2 | **Findings are persisted**, because `criticise()` runs in two routes and **is stored nowhere today** — it goes into the HTTP response and dies in React state. Removing the UI without a home DESTROYS the evidence §2.3 exists to preserve |
| 3 | **`critique` state is cleared on `loadResearch` and `loadChecklist`** — moot once nothing renders it, and kept anyway because stale state from one answer attached to another is the defect that produced this |
| 4 | **The checklist button builds from `askedQuestion`**, the question that produced the answer above it, not `askQuestion`, the live input box |

**§7.1 already asked for (2) and it was never built** — *"Log every finding: severity, question
number, whether it surfaced… It needs a rate, and nothing records one."* This decision makes the
storage necessary rather than merely advisable, and changes one field's meaning: **"whether it
surfaced" becomes what the CODE did with it** — withheld, kept, or counted — since nothing
surfaces to a customer any more.

### TWO TABLES, AND THE REASON IS THE DENOMINATOR

**The instruction was one table, one row per finding. It is two, and the second one is the
parent.** Both reasons are the failures §7.1's metric exists to catch:

| | |
|---|---|
| **The rate would be overstated by construction** | §7.1 asks for *"blocking findings as a share of **answers**"*. **A clean review writes no finding row and drops out of the denominator**, so a findings-only table computes the rate over reviews that found something — which is every review in the table. The number would look worst exactly when the critic is behaving |
| **`complete = false` with zero findings is indistinguishable from clean** | `lib/criticPass.ts:70` — *truncation and cleanliness are indistinguishable in an empty array*. A truncated review also writes no finding rows, so without a parent row the two are the same absence. **That is the distinction the flag was added for**, and a findings-only table throws it away at the moment of storage |

**So `critic_reviews` holds one row per `criticise()` call including the ones that found nothing,
and `critic_findings` hangs off it.** The rate is `blocking findings ÷ reviews where complete`.

### UNRENDERED IS NOT PRIVATE

**`critique` comes out of both HTTP response bodies in the same change** — `/api/chat` and
`/api/audits`.

Removing `CritiqueNotice` stops it being drawn. **It does not stop it being sent**: the applied
critique — every withheld item, every quote, every reason — still crosses to the browser and is
readable in devtools' network tab by anyone who opens it. §97 says no internal output reaches a
customer, and a payload they can read is output that reached them.

> **The distinction is worth stating because it is the one a UI change naturally misses.** The
> screen is what gets reviewed; the response body is not. Once the findings are written
> server-side the field has no reader at all — `grep critique app --include=*.tsx` returns
> nothing after this change — so removing it costs nothing and closes the gap.

**Reversal condition:** a customer for whom the red-lining is the product — an auditor or a
consultant reviewing our reasoning rather than acting on it. **That is a different surface with a
different login, not a box on the answer page.**

---

## 98. The chain rebuilds the schema, not the database — 21 September 2026

> ### THE THIRD MEMBER OF THIS CLASS IS A STORAGE BUCKET — §127, 23 September 2026.
>
> `company-documents` is created by no migration. Migration 002 writes four policies **against a
> bucket the chain does not build**, so a from-zero database has the policies and nothing for
> them to apply to, and the first upload fails with `Bucket not found`. Same shape as this
> section one layer down: the chain rebuilds the schema, and the bucket is not in the schema.
> Migration 037 puts it there. Both live databases already had it, so on staging and production
> it is a no-op — it exists for the next database built from this chain.

**`npm run db:reset` produces a correct, EMPTY database. That is not what "rebuildable from
source" has been taken to mean in this project, and the difference was never written down.**

### The evidence, counted before the claim was made

| | Rows on staging | Restored by |
|---|---|---|
| `requirement_templates` | **205** | `load-requirements.js` + an `.xlsx` |
| `switches` | **95** | `load-switches.js` |
| `agencies` | **33** | `load-agencies.js` |
| `industry_coverage` | **56** | `assign-agencies.js` |
| `applies_expression` | on 205 rows | `load-expressions.js` |
| companies / profiles / entities | 3 / 4 / 4 | `seed-staging-testdata.js` |

**Only three migrations carry seed inserts at all** — 011 (agencies), 012 (thresholds), 013
(chemicals). Everything a question reasons against comes from scripts reading
`supabase/seed-data/`, which `drop table ... cascade` removes and `000 → latest` does not put
back.

> ### THE FAILURE MODE IS A CHECK THAT PASSES, NOT ONE THAT FAILS.
>
> One refusal in the middle of the restore — step 6 declining — leaves `switches` at **zero
> rows.** The determination gate then reads an empty vocabulary and asks nothing, `askableSwitches`
> returns an empty queue, and **every subsequent check succeeds against a database with no library
> in it.** `AUDIT-CHECKS.md` check 14 in its most expensive form: not a broken check, a vacuous
> one. Check 20 already documents the correct shape — it passes vacuously **and says so.**
>
> **And the gap is invisible because the reset itself always succeeds.** Nothing in the output of
> `db:reset` is wrong. It rebuilt exactly what it claims to rebuild.

### The decision, in two parts

**1. The reset for 029 is OWED, not skipped.** `npm run db:migrate` applied it, so §3.7's
guarantee — the chain builds a database from nothing — is **unmet for 029 and recorded as such.**

**The accepted risk, stated so it can be judged rather than trusted:** 029 is **additive** — two
new tables, three new enums, one FK to `companies`, no `ALTER` of an existing object, nothing
dropped. **The class of defect a from-zero run catches is ordering and collision**, and both
defects found on 11 September were of that kind. An additive migration at the end of the chain has
almost no surface for either. **Almost is not none, which is what the owed reset is for.**

**2. The precondition is a command, not a date.** `TODO.md` **0.10**: one `npm run db:restore`
that runs the eight steps in order, prints a row count after each, and **refuses to continue when
a step produces zero rows.**

> **A rule that is expensive to obey is a rule that gets skipped, and §3.7 has now been skipped
> once.** The fix is not restating the rule — it is making it cheap. **Once the restore is one
> command a reset stops being something to avoid**, and then it is exercised **deliberately, on
> its own, watched** — not folded into shipping something else, because a reset nobody is
> watching is a reset that teaches nothing.

**Reversal condition:** none for the finding. The owed reset closes when 0.10 exists and is run.

---

> ### ✅ CLOSED — 22 September 2026. The reset was owed, and it has been paid.
>
> `npm run db:restore` ran to completion on staging. **All 31 migrations applied from zero** —
> `CLAUDE.md` §3.7's guarantee, that the chain builds a database from nothing, demonstrated rather
> than believed for the first time since the project started. Then all seven data steps ran and
> every count matched the file it came from.
>
> **Re-read from the catalog on 22 September, after the run, not copied from the run's own output:**
>
> ```
> requirement_templates 205 · agencies 33 · industry_coverage 56 · switches 95 · edges 40
> applies_expression 199 · companies 3 · entities 4 · company_switches 16 · migrations 31
> ```
>
> `schema:doc` regenerated clean and `check:live` is green. **029 and 030 are no longer migrations
> that have never been built from nothing.**
>
> **It took three runs, and each failure was a real defect the incremental path had hidden:**
> the library the seed files could no longer rebuild (§118), a catalog parser that hunted for a
> brace (§119), and a documented step order that had never been executable (§120). **None of the
> three was found by anything except running it from zero**, which is the argument this section
> made in advance.


---

## 99. Two corrections found by proving the write, and a 500 that is not mine — 21 September 2026

**§97's storage was built and then driven as a signed-in user through `/api/chat` checklist mode
on staging. Three things came out of the proving that the building did not produce.**

### 1. THE SAME CONFLATION, TWICE MORE, ONE LAYER DOWN EACH TIME

`dispositionOf` records what the code did with a finding. It was wrong twice, and **both are the
defect §97 was written about** — the page that told a user an item was removed and then listed
the figures inside it as unverified.

| | The rule | What the rows said | Why |
|---|---|---|---|
| **v1** | `question === 5` tested **first** | `q5 blocking counted` on an item the route had **deleted** | `applyCritique` filters `blocking` and `question === 5` **independently**, so a finding lands in **both**. Testing q5 first hid the deletion |
| **v2** | `severity === 'blocking' && withheld.has(item)` | `q3 qualifying kept` and `q4 qualifying kept` on an item that **did not ship** | **Several findings name the same item**, and the route filters by item NAME. Only one of them has to be blocking for the item to go |

> ### `disposition` IS ABOUT THE ITEM'S FATE, NOT ABOUT THIS FINDING'S SEVERITY.
> If the item did not ship, every finding naming it says so. **Severity is already its own
> column**, and asking one field to carry both is what produced the original screen.

**Both were found by a probe that could fail**, and that is the transferable part. The probe
asserts each stored `disposition` against the answer the customer actually received:

```
disposition vs the answer actually returned: 2 MISMATCH(ES)
    q3 qualifying kept   item="Install ANSI-compliant plumbed eyewash sta"  <-- recorded kept but is NOT in the answer
```

**Neither version would have been caught by reading the rows.** `q3 qualifying kept` is a
perfectly reasonable-looking row; it is only wrong relative to a document it was not stored
beside. §81's rule, in a new place: **a probe that cannot fail has tested nothing** — and the
thing that made this one able to fail was comparing the record against the artifact rather than
against the code that wrote it.

**The rule now lives in `lib/criticPass.ts`, not `lib/criticRecord.ts`**, and the reason is §67:
`criticRecord` imports `@/lib/auth` for the admin client, and a `@/` alias cannot be resolved by
Node's type stripping, **which is what runs the test suite.** The module is untestable by
construction, so the one piece of it with a defect worth a test moved to the module that has one.
**Five tests, and the first two fail under the two rules they replace** — verified by restoring
each and watching the suite go red.

### 2. `/api/chat` CHECKLIST MODE CAN 500, AND IT IS NOT THE CRITIC'S FAULT

**Reproduced three times on a broad question. The server log (`HOW-WE-BUILD.md` §3b) says:**

```
Full error: Error: Streaming is required for operations that may take longer than 10 minutes.
```

**The mechanism, from the lines:** `lib/criticPass.ts:213` budgets the critic at
`maxTokens: 12000` on `task: 'critique'`, the strongest tier. `lib/ai.ts:152` doubles the budget
and retries whenever `stop_reason === 'max_tokens'` — `12000 → 24000`, ceiling 32000. **At that
size the SDK refuses a non-streaming request outright**, so a checklist large enough to truncate
turns into an HTTP 500 after ~200 seconds rather than into a longer answer.

> **The retry that exists to rescue a truncated answer is what produces the failure.** It is not
> a timeout and not a model error: nothing was sent. The refusal is a client-side guard on the
> estimated duration.

**NOT FIXED, DELIBERATELY.** Streaming, token limits and retry logic are all `CLAUDE.md` §3.1 —
they change what feeds a prompt and what comes back. **This is a report.** Two things are worth
knowing when it is picked up: the narrow-question run succeeded at **145 s**, so the ceiling is
close to ordinary use rather than exotic; and this is a **hard 500 on the customer path**, which
is a different class from §92's slowness.

### 3. What the proof actually established, stated without stretching it

| | |
|---|---|
| A real signed-in user's checklist request writes a review row | **yes** — 3 reviews, 42 findings, all via `/api/chat` |
| `critique` is absent from the response body | **yes** — `response keys: outcome, data, gate, frame, followUp, turn, topicId` |
| The caller cannot read or write the tables | **yes** — `permission denied` on both SELECT and INSERT under the user's own token |
| Every stored disposition matches the shipped answer | **yes** — `ALL 10 CONSISTENT`, after two corrections |
| `withheld` itself is exercised end to end | **in the earlier run**, not the final one — the last answer withheld nothing. The unit tests cover it; the HTTP evidence for it is the run before |

**The last row is stated because it would be easy to imply otherwise.** A green final run is not
evidence for a branch that run never entered.

---

## 100. A hard 500 is a defect, not slowness — 21 September 2026

**§99 reported it. This fixes it, and the distinction from §92 is the reason it was not left to
wait for streaming.**

| | |
|---|---|
| **§92** | The research path takes ~60 s. **A product problem**: the answer arrives, and it is correct |
| **§100** | Checklist mode returns **HTTP 500** after ~200 s. **A defect**: the answer never arrives, and nothing tells the user why |

> **Slowness is a thing to improve. A crash on the customer's path is a thing to stop.** They are
> not points on one scale, and treating the 500 as "the slow one, worse" would have parked it
> behind a change it does not depend on.

### The ceiling, read from the SDK rather than chosen

`@anthropic-ai/sdk` `client.js:671`, `calculateNonstreamingTimeout`:

```js
const maxTime     = 60 * 60 * 1000          // 60 minutes
const defaultTime = 60 * 10 * 1000          // 10 minutes
const expectedTime = (maxTime * maxTokens) / 128000
if (expectedTime > defaultTime) throw 'Streaming is required for operations that may take
                                        longer than 10 minutes.'
```

Solving for the largest value that does not throw: **21333**. Evaluated rather than inferred —
21333 passes, 21334 throws.

**`lib/ai.ts` had `HARD_CEILING = 32000`, and the retry DOUBLES on truncation.** The critic asks
for 12000, so one truncation took it to **24000 — past the ceiling — and the SDK threw before
sending anything.** Not a timeout and not a model error: no request was made.

**The clamp applies to the caller's own `maxTokens` too**, with a warning, because a call that
asks for 24000 outright fails identically. `/api/audits` passes 16000 and is unaffected.

### THE HONEST BEHAVIOUR AT THE LIMIT ALREADY EXISTED

**A truncated review is a solved problem and a crashed request is not.** `normaliseCritique`
(`criticPass.ts:267`) returns `complete: false` on every failure path — the distinction that
exists because *truncation and cleanliness are indistinguishable in an empty array* — and
`recordCritique` writes the `critic_reviews` row **with `complete: result.complete` before it
checks whether there are any findings**, so a truncated review still lands as a row that says so.
`complete: false` is asserted in `tests/unit/criticPass.test.ts`.

> **A critic that stops at its limit and records that it stopped is correct. One that crashes the
> customer's request is not.** The cap does not lose information; it converts a 500 into the
> `complete: false` the schema was built to carry.

**Proved on the question that produced the 500 three times** — broad hazardous-waste, Test Gamma,
as a signed-in user: **HTTP 200 in 197.1 s**, a fourth `critic_reviews` row, 20 more findings.
*(That run came back `complete: true`, so the truncated path is proved by its two pieces — the
tested `normaliseCritique` and the two lines that write the row first — and has not been observed
end to end. Stated because a green run is not evidence for a branch it did not enter.)*

### Streaming is the real fix, and it is its own item

`TODO.md` **0.11**. It removes this ceiling rather than avoiding it, **and it answers §92 at the
same time**: seeing text arrive is the honest response to a long wait, where a spinner for 58.9
seconds is not. **One change, two problems, and neither of them is this one** — which is why this
cap shipped first.

---

## 101. A field nothing reads — `needsWebSearch`, claimed for six days — 21 September 2026

**`TODO.md` M1.2b was marked ✅ DONE on 15 September and said the gate *"Returns
jurisdiction-of-question, tense, subject, and `needsWebSearch`"*. The field does not exist and
never did.**

### Settled by reading, two ways

```
GateResult =
  | { outcome: 'proceed'; resolved: GateResolved; frame: Frame; followUp: FollowUp }
  | { outcome: 'ask';     ask: GateAsk;           frame: Frame; followUp: FollowUp }

grep -rn "needsWebSearch|web_search|enableWebSearch" lib/determinationGate.ts lib/gateContext.ts
  -> determinationGate.ts:373   enableWebSearch: false
```

**The one match is the gate turning web search OFF for its own call** — the opposite of a flag it
returns for somebody else. The three other things M1.2b claimed did ship: prior turns, the frame,
and the follow-up classification.

### THIS IS §65's SEVENTH SHAPE — a thing DESCRIBED AS SHIPPED

The seventh instance was **7.2a described as shipped**, with a duration, a row count and a second
environment. **The shape repeats. The mechanism that hid it does not**, and the new mechanism is
the part worth recording:

| | Why it survived |
|---|---|
| **§65 #7** — 7.2a | **repetition.** Each retelling agreed with the last, so self-consistency read as corroboration |
| **This one** | **nothing read the field.** There was no caller to fail, no type error, no test to go red. A claim about an output that has no consumer **cannot be falsified by running the code** |

> ### A FIELD NOTHING READS IS A CLAIM NOTHING CAN CHECK.
>
> Every other kind of drift in this project eventually meets a caller: a renamed column breaks a
> query (`check-schema-contracts`), a missing grant produces a 500 on the first real request
> (§63), a wrong evidence class is refused by a CHECK (§80). **An unread return value meets
> nothing.** It would have sat in a ✅ row until somebody tried to use it — which is exactly what
> happened, six days later, while specifying the thing that needed it.
>
> **And the ✅ is what made it expensive rather than merely wrong.** §65 #7's lesson was *every
> day an unbuilt thing is believed built, something else is designed against it.* §77 item 6 —
> *web search, decided by the gate* — was treated as available when the research answer was being
> planned.

**The check that catches it is the same one as always, applied to a field rather than a count:
which artifact would show this exists?** For a return value that is `grep` on the type, and it
costs one command.

**Corrected rather than annotated:** M1.2b's row now says what shipped and what did not, and the
web-search flag is carried into **M1.9**, where it has a reader — `docs/RESEARCH-ANSWER.md` §4.
**It is not "done" anywhere until the research call reads it.**

**Reversal condition:** none. This is a correction.

---

## 102. The template made the model worse than the bare model — 21 September 2026

**The same stormwater question went to ChatGPT, Gemini and Claude with no context, and to
CompliBoard with the company loaded. CompliBoard's answer was the weakest of the four — the only
one that knew who was asking.**

### The four failures, read out of the stored answer

*The comparison is the owner's; the four failures below were verified against the row CompliBoard
actually produced (`checklists` on staging, the 21 Sep stormwater answer), not taken on report.*

| | | Evidence |
|---|---|---|
| **The trigger is overstated** | *"The permit requirement isn't based on company size or number of drums — if you're doing this activity, you need the permit"* | in the answer, verbatim. It states outdoor exposure as sufficient, which drops both the sector gating and the way out |
| **The 1200-Z reissue is missing** | effective **1 July 2026**, with an **SWPCP update due 30 November 2026** | `grep -i "2026|reissue|November 30"` → the three `SWPCP` matches are generic mentions of the plan. **No date anywhere** |

> ### CORRECTION, 21 Sep, after the three unassisted answers were read.
> **The reissue and the SWPCP deadline are two different misses, and only one of them is
> CompliBoard's alone.**
>
> | | Named the **1 July 2026 reissue** | Named the **30 Nov 2026 SWPCP deadline** |
> |---|---|---|
> | ChatGPT | **yes** | no |
> | Gemini | no | no |
> | Claude | **yes**, and says to replace old guidance | no |
> | CompliBoard | no | no |
>
> **Two of four caught the reissue; none of the four caught the deadline.** So the reissue is a
> real CompliBoard failure against a bar two competitors clear, and the deadline is a gap in the
> whole field — stated separately because merging them would credit the benchmark with finding
> something it did not.
| **No Exposure Certification omitted** | the route by which a facility needs **no permit at all** | `grep -ci "no exposure"` → **0** |
| **Unsourced figures** | `$59,973` · `$565` · `$25,000` · `$100` · `$500` · `$2,000` · `$5,000` | **seven figures, two links**, and neither link is attached to a figure — both are DEQ landing pages |

> **The omission that matters most is the third.** The other three make the answer worse. **The No
> Exposure Certification is the one that could mean the whole answer does not apply**, and a
> compliance product that omits the exemption while listing the penalties has got the asymmetry
> exactly backwards.

### THE CAUSE IS THE TEMPLATE, AND THE HEADINGS ARE THE PROOF

`prompts/checklist.ts:88–93` names six sections. The stored answer contains all six, in order, and
then **invents more to fill them**:

```
## WHAT THIS MEANS FOR YOU      ## COMMON MISCONCEPTIONS
## WHO IT APPLIES TO            ## WHAT HAPPENS IF YOU IGNORE IT
## THE KEY FACTS                ## USEFUL RESOURCES
                                   ### Where to Buy Compliance Equipment
                                   ### Consultant Help
```

**A fixed section is a slot, and a model fills every slot it is given.** *"What happens if you
ignore it"* is a demand for penalties, so penalties arrive — seven of them, none sourced. *"Useful
resources"* is a demand for links, so links arrive, including a section on where to buy equipment
that nobody asked about. **The three unassisted answers addressed the question and stopped.**

> ### A TEMPLATE NARROWS THE OUTPUT THE WAY A FILTER NARROWS THE INPUT.
>
> **This confirms §77 item 2 — *nothing narrows the model* — in a direction that section did not
> anticipate.** §77 was about what the model is SHOWN: do not pre-filter the library, do not hand
> it a candidate set, because the narrowing happens before it reasons. **The template does the
> same damage on the way out**, and it was not recognised as the same thing because it looks like
> formatting.
>
> **And it explains why the first version of this product, which trusted the model with no
> background at all, produced better research than the version that knows the company.** The
> background was never the problem.

**One claim NOT verified here:** that the figures change between runs. The mechanism is confirmed
— nothing in `RESEARCH_PROMPT` requires a source for a number, and seven figures carry none — but
run-to-run variance was not measured, because the two stored answers are to different questions.
**It is measurable, and the benchmark below is where it gets measured.**

### DECISION — research output is FREE-FLOWING

**No fixed sections. The model answers the question asked, in whatever shape the answer needs.**

**What stays, because none of it restricts reasoning:**

| | |
|---|---|
| **The gate** | stopping only on a **genuinely blocking** fact |
| **Citations as it goes** | §77 item 4 |
| **Web search** | when the gate says the question touches something recent — §77 item 6, **which is unbuilt** (§101) |
| **The page-level disclaimer** | §77 item 5 |
| **The company's facts** | in context, **and USED — reasoned from, not listed** |

**The last one is a change, not a restatement.** `establishedFactsBlock` (`lib/gateContext.ts`)
currently ends: *"Treat these as settled. Do not ask the user to confirm them, do not branch on
them, and do not answer for a jurisdiction other than the one named here."* **Every clause says
what NOT to do with a fact. None says to reason from it** — which is why the background went
unused in an answer that had it.

### THE BENCHMARK — the research-quality bar, stated so it can be failed

> ### CompliBoard must beat the bare model with no context, on the same question.
> **If it does not, the product adds nothing on research.**

**The unassisted ChatGPT answer ended by asking four questions:** what the facility makes, virgin
or spent solvent, quantity, and where the pad drains. **CompliBoard already knew the first.** Its
answer should have opened from it — *"you're a chemical manufacturer, so you're in a covered
category"* — and asked only what it genuinely lacked.

**And the fourth is the one that decides whether any of it applies** — where the pad drains. That
is the owner's domain judgement, and it is the shape of a good gate question: not a fact to fill a
field, but the fact the answer turns on.

**Made repeatable:** the same question through the bare model and through CompliBoard, side by
side. First case is the stormwater question, `tests/golden/004-stormwater-bare-vs-compliboard.json`,
holding all four answers. **It is recorded as `awaiting-inputs` until the three unassisted answers
are pasted in — they are the owner's and are not reconstructible.**

### THE OTHER THREE, SCORED — and the ranking does not come out cleanly

**Accepted 21 September, after the three unassisted answers were read in full**
(`tests/golden/004-stormwater-bare-vs-compliboard.json`).

| | No Exposure Certification | 1 July 2026 reissue | Trigger stated correctly | Specifics sourced |
|---|---|---|---|---|
| **ChatGPT** | **miss** | yes | yes — *"does not by itself automatically mean you need a 1200-Z permit"* | yes, largely by restraint |
| **Gemini** | **catch** | **miss** | not addressed | partial |
| **Claude** | catch | yes, and says to replace old guidance | yes | yes — 40 CFR 112, 264/265, the 1,320-gal threshold |
| **CompliBoard** | miss | miss | **no** | **no** — 7 figures, 2 unattached links |

**Claude is first and CompliBoard is last, both without argument.** CompliBoard is also the
**longest** — 1010 words against 420–611 — which is the template showing up as length.

> ### CHATGPT AND GEMINI FAIL IN OPPOSITE DIRECTIONS AND DO NOT RANK CLEANLY.
>
> **On the criterion that decides whether any of the answer applies — the No Exposure
> Certification — ChatGPT misses it and Gemini catches it.** ChatGPT names the *sector gate*,
> which is a different mechanism and does not tell a reader they might need no permit at all.
> ChatGPT is better on currency, on stating the trigger and on asking the right questions;
> Gemini is better on the one thing that could make the rest moot.
>
> **Recorded because the first reading had them ordered**, and an ordered pair invites *"be like
> ChatGPT"* when the actual lesson is that the best answer in the room would have had to combine
> two of them.

**And the two currency misses are NOT the same miss:**

| | 1 July 2026 reissue | 30 November 2026 SWPCP deadline |
|---|---|---|
| caught by | **ChatGPT, Claude** | **nobody** |

**The reissue is a real CompliBoard failure against a bar two competitors clear. The deadline is a
gap across the whole field** — and saying so separately matters, because merging them would
credit the benchmark with finding something it did not.

**Reversal condition:** a measured comparison where the free-flowing answer is worse than the
templated one on the same question. **That is what the benchmark is for**, and it is the only
thing that should reverse this.

---

## 103. The frame is computed and the answer never sees it — 21 September 2026

**§101's shape, a third time, and this one is worse than a missing field: the frame EXISTS, is
correct, and is read by everything except the stage that needs it.**

### Confirmed in `app/api/chat/route.ts`

`g.frame` is used at **line 273** (the topic title), **line 284** (the sealed turn) and **lines
313 / 322 / 376** (the HTTP response). **It is never added to `messageContent`.** The only thing
folded into the answer call is `establishedBlock`, lines 301–305. So the model writing the answer
is told what is established and **never told what the question is about**.

### And the second half, which was NOT what anyone predicted

The expectation was that hypotheticals stop at the gate. **They do not.** Measured on staging,
signed in, 21 Sep:

```
turn 1  "We are thinking about opening a solvent blending facility in Phoenix, Arizona.
         It would have 12 employees and permit-required confined spaces."

frame           state=Arizona  tense=hypothetical  subject="a solvent blending facility"

resolved.known  — WHICH IS EXACTLY WHAT establishedFactsBlock RENDERS INTO THE ANSWER CALL
    entity_state = Arizona                 [stated_in_question]
    site_employee_count = 12               [hypothetical]
    confined_spaces_present = true         [hypothetical]
    business_type = blend                  [hypothetical]
    has_employees = true                   [hypothetical]
    hazardous_chemicals_present = true     [hypothetical]
```

**Those six lines reach the answer under the heading `WHAT IS ALREADY ESTABLISHED ABOUT THIS
COMPANY`, followed by `Treat these as settled.`**

> ### A FACILITY THAT DOES NOT EXIST IS DESCRIBED TO THE MODEL AS SETTLED FACT ABOUT THE BUSINESS.
>
> **§78 made this structural for `company_switches`** — the writer takes no frame, so a
> hypothetical cannot be stored — and `GATE-HISTORY.md` §3 records that as the protection.
> **Nothing made it structural for the PROMPT**, and the prompt is where the answer comes from.
> §78 looked at storage; this is one stage further down.

**The prompt permits it explicitly.** `determinationGate.ts:344` tells the model
*`"source" is one of: user_set, ai_from_documents, ai_from_profile, computed, stated_in_question,
hypothetical`* — and that list governs the `known` array of **both** outcomes, `resolved` and
`ask`.

### WHAT DID NOT REPRODUCE, STATED BECAUSE IT WOULD BE EASY TO CLAIM IT DID

The predicted failure was *"it answers no, for Oregon, about a hypothetical Arizona facility."*
**In this run it would not have.** Turn 2's `resolved.known` came back holding
`confined_spaces_present = true [hypothetical]` and `entity_state = Arizona` — and **none of
Gamma's real switch values at all**, including the real `confined spaces = false`. So the
jurisdiction line would have pointed at Arizona and the confined-space fact would have been the
hypothetical one.

**One run is one observation.** What `resolved.known` contains is the model's choice, and a run
where a real fact and a hypothetical one appear together is not ruled out by anything — it is
exactly what §78's *"employee_count appears twice — 47 `[user_set]` and 12 `[hypothetical]` — and
they do not conflict"* describes. **The defect is that the two are indistinguishable once they
are in that block, not that a specific sentence came out wrong.**

### The same shape as §101, and the precedents are nameable

| | Computed | Read by |
|---|---|---|
| **§101** `needsWebSearch` | never — the field does not exist | nothing. **Claimed shipped for six days** |
| **§86** `refersToTurn` | yes | nothing — *"a field that was always null"* |
| **§103** `frame` | **yes, and correctly** | the topic title, the turn signature, the HTTP response — **not the answer** |

> **The third is the hardest to notice**, because the field is populated, plausible and visibly
> in use. `grep frame` returns hits. **Nothing is missing except the one consumer that matters**,
> and no test fails for the absence of a consumer.

### The fix, and it is two blocks rather than one rule

**Hypotheticals stay out of the facts block — that part of the design was right.** They reach the
answer **separately**, as the scenario being asked about, carrying the frame's jurisdiction, tense
and subject. And the facts block's jurisdiction restriction — *"do not answer for a state other
than the one named here"* — is **removed from the facts block and rebuilt from the frame**, because
the frame is the thing that knows what the QUESTION is about, while the facts block only knows
where the business is.

**Why two blocks rather than a label:** *"[hypothetical]"* inside a list headed *WHAT WE ALREADY
KNOW ABOUT THIS BUSINESS* is a contradiction the model must resolve, and **the heading wins**.
Splitting the list moves the decision into the renderer, where it is structural, and the model is
never asked to hold two meanings for one heading. `RESEARCH-PROMPT-DRAFT.txt` Block C.

**Acceptance condition, per §101: a reader.** Not done when the frame is returned — done when the
code that builds `messageContent` reads it, and an Arizona conversation answers for Arizona.

**Reversal condition:** none. This is a defect.

---

## 104. The worked example was cleaner than the rule — 21 September 2026

**A rule was written, a worked example of its output was typed out by hand, and the example
agreed with what the rule was MEANT to do. Running the rule disagreed with both — in under a
minute, on the first input.**

### The rule, and what the example showed

`RESEARCH-PROMPT-DRAFT.txt` draft 2 said Block B — the business's facts — *"removes facts tagged
`hypothetical`"* and keeps the rest. The hand-written example beneath it showed Portland, Oregon,
and no Arizona anywhere.

**But the measured run tagged Arizona `stated_in_question`, not `hypothetical`** — and
`stated_in_question` facts belong in Block B by design; that is how the stormwater drums appear
there. **So the rule as written puts "worksite = Arizona" into the business's facts.** The example
showed it in neither block. It had vanished.

> ### THE EXAMPLE DEPICTED A RENDERER THAT DID NOT EXIST, AND HID THE ONE FACT THAT WOULD HAVE
> ### EXPOSED THE RULE.
>
> Not by carelessness about the wording — by writing the output I intended rather than the output
> the rule produces. **A hand-written example is an assertion about code, and it was the only
> evidence offered for the rule working.**

### And running it found a second defect nobody had predicted

Routing on the fact's identity alone **moved the business's own fact into the scenario** whenever
the scenario mentioned the same switch:

```
  ABOUT THE NEW SITE …
    Permit-required confined spaces = false     <- THE BUSINESS'S REAL ANSWER
    Permit-required confined spaces = true      <- the scenario's
```

The business block silently lost `confined spaces = false`, and the scenario contradicted itself.
**The fix is one clause** — a fact the business *established* is never a scenario fact, only
something *stated* in a hypothetical-framed turn is — and it is now pinned by a regression test
that fails without it (`tests/unit/gateContextAnswer.test.ts`).

### THE RULE THIS PRODUCES

> **Render the example from code. A worked example produced by hand shows the author's intent, and
> the whole purpose of an example is to show the behaviour.**

**It is `AUDIT-CHECKS.md` check 14 again — *is every checker as strong as the assertion it claims
to check?*** An example is a checker: it is offered as evidence that a rule does what it says.
Typed out by hand it checks nothing except that the author can restate their own intention.

**And it is the second time in one day.** §65's eleventh instance was a hand-rolled PDF extractor
whose blind spot was recorded as a property of the document. **Both are the same failure: an
artifact produced in the moment, trusted as evidence about something else.** The difference is
that this one cost nothing, because the rule had not shipped — which is the argument for
rendering examples early rather than at review.

### Why the routing changed, in one line of evidence

**The label is not reliable enough to route on**, and the measurement is the whole proof: in ONE
conversation about the same Arizona facility, `entity_state = Arizona` came back
**`stated_in_question` on turn 1 and `hypothetical` on turn 2.** The frame said
`tense: hypothetical` both times.

**So the frame routes and the label is printed for the reader.** A turn whose frame is hypothetical
describes the scenario; every fact stated in that turn belongs to it, whatever each is tagged.

### The other correction: a new facility ADDS to the business

Draft 2 told the model *"do not reconcile the two"*. **Right for site facts, wrong for company
facts** — a new facility is not a different business, and the instruction suppressed the most
useful thing an expansion answer can say.

**Split by `switches.scope`, which already exists:**

| | |
|---|---|
| **site-scoped** scenario fact | governs the new site for this question; the business's other sites keep their own values |
| **company-scoped** scenario fact | describes the business once the facility exists — adds to it, and where it is a number the totals change |
| **a per-site number with an enterprise-wide counterpart** | the answer must state the combined figure |

**The third row is not derivable from `scope`.** `scope` says which thing a number describes, not
that two numbers are the same quantity at two levels — so `site_employee_count → employee_count`
is a named pair in the renderer, with `CLAUDE.md` §1's reason beside it. **One member today.**
Rendered, it produces: *"the business already has Employees, enterprise-wide = 47. Adding this
facility takes the enterprise-wide total to 59."* Which is the FMLA threshold at 50, found by
arithmetic the previous instruction forbade.

**Reversal condition:** none for the rule about examples. The routing reverses if a frame turns out
to be less reliable than the label, which would be visible as a scenario fact landing in the
business block.

---

## 105. The M1.9 release criterion, and what is deliberately not in it — 21 September 2026

> ### CompliBoard's research answer must be COMPARABLE to ChatGPT's and Claude's answering the
> ### same question with no context. Not better on every point — comparable.
>
> **Meeting it is the stopping condition for M1.9.** Refinement stops here.

### Why comparable rather than better

**§102 found CompliBoard the weakest of four on the same question, and it was the only one that
knew the company.** That is the failure that matters, and it is asymmetric:

| | |
|---|---|
| A question answered **well without every fact** | does no harm |
| A question answered **worse than a free chat** | is the product failing at the thing it charges for |

**So the gate is answer quality against the bare models, and nothing else.** A bar of *better on
every point* would be a bar nobody can call, and calling it is the whole purpose — §102 also
records that Claude and ChatGPT and Gemini each won different criteria, so "best" is not a single
ordering.

### COMPLETENESS OF FACT CAPTURE IS EXPLICITLY NOT IN THE BAR

**M1.3 captures facts; M1.9 answers questions. Only the second is gated.** A research answer that
never learns the company's generator category is not thereby a bad answer — it is an answer with a
question in it, which §77 item 4 and the bare-model comparison both treat as correct behaviour.
**Fact capture is a later improvement, measured by what it unblocks, not by coverage.**

**This is worth stating because the opposite is the natural assumption** — the product's whole
architecture is about knowing the company, so "know more" reads as "answer better". §102 is the
counter-example: CompliBoard knew the most and answered the worst.

### DEFERRED — not solved, and each returns only when a real question shows it failing

**Recorded so they are findable, and so nobody re-derives them as new discoveries.**

| | What is deferred | What brings it back |
|---|---|---|
| **1** | **The multi-case matrix of hypotheticals** — past tense (*"when we had a second site"*), two jurisdictions in one question, an industry change rather than a site, a future change in the SAME place | A real question where the frame gets one of these wrong. The Arizona case is one point in that space and is the only one built for |
| **2** | **Block D's same-place hypothetical.** `jurisdictionLine` compares the frame's state to the business's and says *"do not answer for Oregon"* only when they differ. A hypothetical Oregon site produces *"Answer for Oregon. That is the jurisdiction this question is about"* — true, but it does not carry that the question is about a facility that does not exist. **The scenario block carries that; the jurisdiction line does not** | An answer that treats a same-state hypothetical as present-tense |
| **3** | **Complete fact capture about the company** | The bar above, once answer quality is settled. It is a later improvement by decision, not by oversight |

**None of the three is a defect today.** Each is a case the design has not been tested against,
which is a different thing, and saying so is the point of recording them.

**Reversal condition for the bar itself:** a customer for whom a bare model is not the
alternative — someone who would not have asked ChatGPT. **No such customer has been named**, and
until one is, the free chat is what this product is measured against.

---

## 106. Every stray line break was a dropped citation — 21 September 2026

**The research answer looked broken: a sentence, a line break, then ", and" alone on a line; a
lone "." under a deadline. It was not a formatting bug in the sense of styling. Each break was a
citation being thrown away.**

### The cause, from the API's own output

With web search on, the answer does not arrive as one text block. It arrives split — **one block
per cited span**, with the connective tissue in blocks of its own. Dumped from a real response on
21 Sep:

```
 6  text len=85  citations=0  "**Effective date.** Oregon DEQ's current 1200-Z "
 7  text len=80  citations=1  "took effect July 1, 2026, replacing the prior ve…"
 8  text len=2   citations=0  ". "
```

`lib/ai.ts` filtered to `type === 'text'`, took `block.text`, and **joined with `"\n"`** — so a
line break landed between "…prior version" and ". ", and the citation on block 7 was discarded
with the rest of the object.

> ### THE BREAKS AND THE MISSING SOURCES WERE THE SAME DEFECT, WHICH IS WHY IT LOOKED LIKE STYLING.
> A reader sees ragged text. What is actually happening is that the thing holding the answer
> together — where each claim came from — is being deleted on the way out, and the ragged edges
> are where it used to be.

### The fix, in three parts

| | |
|---|---|
| **Prose** | adjacent text blocks join with **nothing**. Paragraph breaks come only from the model's own text — block 16 of that dump begins `".\n\n**No exposure…"` — never from a block boundary |
| **Markers** | a number at the end of the cited span, **shifted past the punctuation that follows**, the way a footnote sits. One number per source however often it is cited, deduplicated by URL |
| **Sources** | a numbered list at the end, title and link, in marker order |

**`reassemble()` is a pure function with the real blocks as its test data** (§104: render the
example from code). `askAI` is unchanged for its six existing callers and delegates to
`askAIWithCitations`, which the research path uses.

### THE SOURCES BELONG TO THE SAVED ANSWER, NOT THE RESPONSE

Migration **030** adds `checklists.research_sources jsonb`.

**Fixing the renderer alone would have fixed the live view and nothing else.** A research answer
is saved, read back days later, and printed. **The markers survive on their own — they are
characters in the prose — and a `[3]` with no list behind it is worse than no marker at all: it
looks like a citation and cannot be followed.**

`jsonb` rather than a table because a source has no life of its own: never shared between
answers, never queried across rows, never updated, and it dies with the answer. §78's reasoning
in the small — do not create a second place for something with exactly one owner.

**And on paper a link's href is invisible**, so the print stylesheet prints the URL after the
title. A printed source you cannot follow is a source in name only.

### One residual case, fixed in the RENDERER rather than the text

Live output contained `**Stormwater permit**Because you have industrial activity…`. The `[1]`
marker sits at the end of the *next* sentence, which places the block boundary between the
heading and the word — **so the model emitted no newline there, and inventing one at a block
boundary is exactly what this entry removed.**

**The old `"\n"` join set that line right by accident while breaking sentences everywhere else.**
So the split is done at display time: a bold run that opens a line and is followed immediately by
more text renders as a heading plus a paragraph. **The stored text stays the model's, verbatim.**

### What was verified, and the one thing that was not

| | |
|---|---|
| Re-run as `testgamma` over HTTP | **0** punctuation-only lines, **0** lines opening with a comma, 6 markers, **0** markers before their punctuation |
| Markers against sources | every marker has a source and every source has a marker, 1–6 |
| The saved version | written under the user's own token with RLS applied, read back through the same `select` the saved list uses: **answer identical, all 6 sources present, array order preserved.** The `jsonb` round trip reorders object keys and nothing else — checked rather than assumed |
| **Print to PDF** | **NOT EXERCISED.** What was verified is that the Sources block carries no `no-print` class and that the `@media print` rule printing the URL exists. **A browser print was not run**, and saying otherwise would be the §65 class |

**Reversal condition:** none for the prose join. If a provider ever returns text blocks that are
genuinely separate paragraphs with no newline of their own, the join would need a rule — nothing
observed suggests it.

---

## 107. A citation you can reach where the claim is — 21 September 2026

**The markers landed in the prose in §106 and the list landed at the bottom. Matching `[4]` to
the fourth entry means scrolling away from the sentence you were reading, and on a phone that is
the end of reading it.**

### What was built

**A marker is now a thing, not three characters.** Hovering it on a laptop or tapping it on a
phone opens a small card at the claim: the source's title and a link that opens it.

**The Sources list stays, and the reason is paper.** A hover card cannot print. On a printed PDF
the list is the only way a citation survives, so: **card for screen, list for paper.** The card
carries `no-print`; the list deliberately does not.

**Tap is not an afterthought.** A phone has no hover, and a marker that only responds to a
pointer is a marker a phone user must scroll away from to resolve — which is the problem this
entry exists to fix. The card opens on click and closes on a second click, one at a time.

### THE FORMATTING DEFECTS — one cause, now three shapes

§106 joined the API's text blocks with nothing, because a break invented at a block boundary put
a lone full stop on its own line. **The cost runs the other way: where the model itself omitted a
separator, the pieces run together.** The old `"\n"` join set those cases right by accident while
breaking sentences everywhere else.

| Shape | Seen as | Provenance |
|---|---|---|
| A bold heading welded to the sentence after it | `**Stormwater permit**Because you have…` | **captured live**, §106 |
| A markdown heading beginning mid-line, `##` showing | `…triggers the requirement.## Stormwater Permit` | **reported, NOT reproduced** |
| A line opening with a lone colon | under *No-Exposure Option* | **reported, NOT reproduced** |
| A sentence boundary with no space | `…Environmental Quality.You need an NPDES 1200-Z…` | **found while verifying** — and in **2 of 3** earlier captured runs |

> ### TWO OF THE FOUR WERE NOT REPRODUCED, AND THAT IS RECORDED RATHER THAN GLOSSED.
>
> **Three re-runs of the same question produced neither the mid-line heading nor the lone colon.**
> The mechanism is therefore a **hypothesis** — the same missing separator at a block boundary —
> pinned by unit tests written against the reported strings rather than against a captured run.
> **If the real cause is something else, those tests still pass and the defect returns.**

**The fourth shape was found by the verification rather than by the report**, which is the
argument for running the thing rather than reasoning about it (§104). It recurs: 2 of 3 earlier
runs carry it.

**All four are repaired at DISPLAY time. The stored text stays the model's, verbatim** —
`lib/answerDisplay.ts`, no imports so the test suite can load it (§67), and idempotent, which is
asserted.

**The space rule is deliberately narrow:** the character before the stop must be lowercase or a
digit, so `U.S.Code` and `1.5` are untouched. **And it inserts a space, never a paragraph break** —
a space is certainly right; a break would be a guess about structure the model did not express.

### OPEN — the answer varies between runs, including on what the customer should DO

**Not to act on. To measure across more questions before anyone changes anything.**

Four runs of the identical stormwater question, same user, same company, minutes apart:

| | |
|---|---|
| Length | 2260 · 2523 · 3237 · 3364 characters |
| Sources | 5 · 6 · 7 · 10 |
| **Where you apply** | *"In Hillsboro, Clean Water Services acts as DEQ's agent… so you apply through them, not directly to DEQ"* — and another run routing the application through DEQ's own system, and one mentioning Clean Water Services not at all |
| **Which permit** | one run opened *"Oregon requires an NPDES **1200-A** permit"* and then, in the next sentence, *"You need an NPDES **1200-Z** stormwater permit"* — **two different permits contradicting each other inside one paragraph** |

> **The last row is the serious one and it is CONTENT, not formatting.** A reader told to apply in
> the wrong place has been sent somewhere. The variance in length and source count is expected of
> a model; **a self-contradiction inside one answer is not**, and neither is the application route
> changing between runs.
>
> **One question is not a measurement.** `TESTING.md`'s golden set exists for exactly this, and
> golden case 004 now has the four answers to compare against. **The next step is more questions,
> not a prompt change** — §105 stopped refinement on the strength of one question and this would
> be the same error in the other direction.

**Reversal condition:** none for the card. The display rules reverse individually if any is shown
to mangle correct output — each is one function with its own tests.

---

## 108. Conversational fact extraction moves overnight — 21 September 2026

> ### Facts inferred from free conversation are no longer extracted in real time. Conversations
> ### are read after the fact — overnight, when load is low — and what is found is **proposed to
> ### the customer**, not written.

### What stays live, and why each one has to

| | |
|---|---|
| **The gate** | It decides what THIS answer needs, **now**. There is nothing to defer |
| **Prior turns inside one conversation** | The gate already sees them (M1.2b), so a fact said in turn 2 is used in turn 4 **with nothing stored**. The within-conversation case is already solved and is untouched |
| **The direct ask path (7.2a)** | A person answering a direct question is **clean evidence**, not an interpretation — and moving their requirement list at once is the whole purpose of asking |

**So what moves is one thing only: inferring, from free prose, that something is true of the
company.**

### THE REASON IS JUDGMENT, NOT LOAD

**Real time forces the decision fact by fact, turn by turn.** That has already gone wrong, and
the evidence is in this record:

```
turn 1   entity_state = Arizona   [stated_in_question]
turn 2   entity_state = Arizona   [hypothetical]
```

**The same fact, the same facility, two labels, in one conversation** (§104). Reading the whole
conversation at once, the Arizona facility is plainly hypothetical throughout — **the judgment is
easier with the whole thing in view than it is one turn at a time.**

**Three things follow from reading the whole:**

- **Corrections resolve themselves.** *"47 employees"* then *"actually 52"* yields the settled
  value. In real time the first write happens before the correction exists.
- **Modality is decided once.** The frame-routing and label-consistency machinery §103 and §104
  built exists to make a per-turn decision survive; most of it leaves the live path.
- **The live path gets smaller**, which is the load argument, and it is the weakest of the three.

### WHAT THIS REVERSES

**1. §96 decision (a) — *"A STATED FACT IS STORED IMMEDIATELY, NOT AT TOPIC CLOSE"* — is reversed
for CONVERSATIONAL facts.** They now wait for the overnight read.

§96(a)'s argument was that *the value of a captured fact is the NEXT TURN* — and **that argument
survives and is satisfied differently**: the next turn already has the fact, because the gate sees
prior turns without anything being stored. **What §96(a) got wrong is that it treated "available
to the next turn" and "written to `company_switches`" as the same act.** They are not.

**The ask path keeps §96(a) exactly.** A person answering a direct question still writes at once,
still `user_locked`, still recomputes. §96(a) is narrowed, not struck.

**2. *"The caller owns the turn list; nothing is stored"* (`GATE-HISTORY.md` §8.4 rule 3) is
reversed.** A conversation that is to be read overnight must **exist server-side until it is
read**. Kept until processed, then discarded.

> ### THIS DOES NOT BREACH §78, AND THE DISTINCTION IS THE WHOLE OF IT.
>
> §78 says **a hypothetical FACT is never written anywhere** — *"not to `company_switches`, not
> to `topics`, not to a new table."* **A transcript is not a fact. It is the raw evidence a fact
> might later be drawn from**, and the thing §78 forbids is recording *"the Arizona facility has
> 12 employees"* as something true of this company.
>
> **That remains forbidden, and the extractor is what enforces it** — it reads the whole
> conversation and decides what is true, which is precisely the judgment §78 was protecting.
>
> `WORKSPACE.md` §6.4 — *transcripts are disposable* — also survives: **kept until processed,
> then discarded** is a disposal schedule, not permanence.

### EXTRACTED FACTS ARE PROPOSED, NEVER WRITTEN

**Reading a transcript and concluding *"they have 47 employees"* is the AI's interpretation of
what somebody said, and it can misread.** So the next session asks:

> *"From yesterday's conversation, it sounds like you have 47 employees — should we save that?"*

**One tap to confirm.** The source label travels with the proposal, so **§96(b) still holds for
whatever finally writes it**: the write path takes a labelled fact and the database refuses what
it should refuse.

> **This is the difference between the two paths, stated once:** the ask path has clean evidence —
> a person answered the question that was put to them. The extractor has an interpretation. **An
> interpretation gets confirmed; evidence does not need to be.**

### THE COST, STATED RATHER THAN DISCOVERED

**A new conversation the same day will not know facts from an earlier one until the overnight
read.** Accepted.

*(Within one conversation nothing is lost — that is the gate's prior turns. The gap is strictly
across conversations, within one day.)*

### IMPLEMENTATION — it does not need the worker

**A nightly script reading the day's conversations is the first version.** `CLAUDE.md` §4's
worker is where it ends up, and waiting for the worker would defer this behind infrastructure it
does not require.

### CONSEQUENCE FOR THE PLAN

**M1.3 as specced — *"The conversation writes `company_switches` through 7.2a's route"* — is
SUPERSEDED.** Its replacement is three pieces:

1. **Retaining conversations until processed**, then discarding them
2. **The overnight extractor**, reading whole conversations
3. **The proposal-and-confirm surface**, where a reading becomes a fact by one tap

**Reversal condition:** a customer case where same-day cross-conversation knowledge matters enough
to pay for per-turn judgment. **None has been named**, and the Arizona labels are the evidence
against paying for it.

---

## 109. The testing plan, deferred on purpose — 21 September 2026

**Once the compliance workspace is complete, it is tested with questions from many fields — some
compliance, some not. Not written now.**

| | What it tests |
|---|---|
| **Related questions** | whether it is good at compliance |
| **UNRELATED questions** | **whether it knows when it is out of its depth and says so** |

**The second is the one nobody writes**, and it is the one `CLAUDE.md` §6 is about: a product that
answers confidently outside what it knows is the omniscient-status-tracker failure in a new place.

### WHY THIS IS DEFERRED RATHER THAN SKIPPED — everything so far was tuned on almost nothing

**Every decision in this record about answer quality rests on very few examples, mostly of ONE
SHAPE.**

| Shape | The example |
|---|---|
| **One fact decides everything** | golden 001, *"Minimum labelling requirement for 2.5L bottles and for the case — THE ORIGINAL FAILURE"*, and the 2.5L nitric-acid research answer beside it. **The gate asks the one question, and the answer follows** |
| **Several facts each decide a PART** | the stormwater question — permit coverage, spill containment, and fire code, each turning on something different |

**The second shape was met once, and the product handled it worse.** Measured: on the stormwater
question **the gate did not stop to ask anything**, and the answer assumed where the pad drains.
**ChatGPT, with no context at all, asked:**

> *"Where does the pad's rainwater go — storm drain, ditch/creek, UIC/drywell, sanitary sewer, or
> does it infiltrate on-site?"*

**That is the fact that decides whether any of the answer applies**, and the product with a
determination gate did not ask for it while the bare model did.

> ### ONE DATA POINT IS NOT A PATTERN, AND ACTING ON IT WOULD REPEAT THE MISTAKE JUST AVOIDED.
>
> §105 stopped refinement on the strength of one question; §107 declined to change the prompt on
> the strength of one contradictory answer. **Redesigning the gate because of one stormwater
> question is the same error in the other direction.**
>
> **A spread of questions is exactly what settles it** — whether the gate systematically
> under-asks on multi-fact questions, or whether this was one question.

**Reversal condition:** none — this is a plan, not a constraint. What would move it EARLIER is a
second instance of the same shape failing the same way.

---

## 110. Conversations are kept for fifteen days — 21 September 2026

**Supersedes "discard after processing" in §108 / `TODO.md` M1.3a.**

### Two tiers, and the user's rule is one sentence

| | |
|---|---|
| **CHAT HISTORY** | **Automatic and temporary.** Every conversation, kept **15 days**, shown as a history the user can return to |
| **SAVED** | **Deliberate and permanent.** The answers a person chose to keep |

> **If it matters, save it or download it.**

**DOWNLOAD is print-to-PDF**, as already settled for anything leaving the product: a clean print
view of the whole conversation, sources included. **No PDF generation.** §106 already put the
Sources list outside `no-print` and prints each URL after its title, so the machinery exists.

**NOTICE is prominent, on the history list AND on each conversation:** conversations are cleared
after 15 days; save or download anything you want to keep. **Nobody should discover a deletion
they were not warned about.**

### Why fifteen days rather than the morning after

**Discarding overnight is a poor experience, and in compliance a person returns to a conversation
because they are about to act on it** — the permit application is tomorrow, the inspector is next
week. A product that deletes the reasoning the night before is one they stop using for anything
that matters.

**And it gives the overnight extractor room.** §108's extractor now has fifteen nights to read a
conversation rather than one, **so a failed run can simply retry** instead of losing the
conversation it failed on.

**§78 is untouched.** A retained transcript is **evidence, not a fact** — the same distinction
§108 drew. What may never be written is *"the Arizona facility has 12 employees"* as something
true of this company.

### WHAT IT BRINGS WITH IT — three REQUIREMENTS, not notes

#### (a) Deletion on day 16 must actually happen, and something must check that it ran

> **A retention promise nothing enforces is a claim on screen that is not true.**

**This is §101's shape exactly** — a field nothing reads is a claim nothing can check — pointed at
a promise instead of a return value. The screen will say *"cleared after 15 days"*, and if the job
silently stops, **nothing fails, nothing 500s, no test goes red, and the text stays on the page
being wrong.**

So the requirement is two things, not one: **the deletion job, and a check that answers *did it
run and what did it remove*.** `AUDIT-CHECKS.md` is where the second lives — its bar is *a wrong
answer would reach a customer and nothing else would notice*, which this meets precisely.

#### (b) Account deletion takes chat history IMMEDIATELY

**Not after fifteen days. At once, with the rest of the company's data.**

`scripts/check-schema-contracts.js` already enforces that `/api/account` DELETE names every table
carrying a `company_id` — it caught `critic_reviews` and `critic_findings` on the day they were
created. **A conversations table must be named there too**, and the checker will refuse the build
if it is not. That is the mechanism; it needs no new rule.

#### (c) IT IS REAL CUSTOMER DATA, AND TWO THINGS FOLLOW

1. **The 15-day rule belongs in the privacy policy, not only on screen.** A retention period
   stated in the interface and nowhere else is not a policy.
2. **It makes key rotation more pressing.** `TODO.md`'s gate — *these land before the first real
   customer document* — lists **eight credentials, seven of them leaked**. Retained conversations
   **are** customer content: a person describing their site, their chemicals, their headcount.
   **The gate was always "before real customer data", and this is what creates it.**

**Reversal condition:** a retention period a customer or a regulator requires to be different.
Fifteen days is a product judgement, not a legal one, and nothing in this record claims otherwise.

---

## 111. A checklist is a HYBRID — item 6 decided, §68 resolved — 21 September 2026

**The three options were: a view over obligations, a workspace artifact with no authority, or a
second spine** (`DECISIONS.md` §71, `WORKSPACE.md` v3.6). **It is none of the three as stated. It
is a hybrid, and the hybrid is what makes both questions answerable.**

> ### The AI writes the checklist, but STARTS FROM the obligations that apply to the question.
>
> **Items that match an obligation are LINKED to it** — completing one counts on both sides, so
> work done in the checklist is visible on the Requirements screen.
>
> **Anything the AI adds beyond the obligations is marked a SUGGESTION, not a requirement.**

### Why the hybrid over the other two

| | Why it fails |
|---|---|
| **A pure view over obligations** | **cannot answer anything outside the library.** A hypothetical Arizona facility, or any question the **205 live requirement rows** do not cover, has no obligation to be a view of — and the product would simply go blank on the questions people actually ask |
| **A pure workspace artifact** | **is what exists now, and it is the defect.** It can contradict the Requirements screen, and **work ticked off in a checklist is invisible to the obligation it fulfils** |

**The hybrid handles both *"what do I owe"* and *"what if we expanded"*.** Where no obligation
matches — a hypothetical, or a question outside the library — **every item is a labelled
suggestion**, which is honest about what it is rather than silently presenting a guess as a
requirement.

### THIS RESOLVES §68, AND THE COST OF DELAY IS STILL ACCRUING

§68's measurement stands and is the reason this cannot drift:

```
production : checklist_items 235 · checklists 11 · obligations 0
staging    : checklist_items   0 · checklists  0 · obligations 222
```

**Every row of "what you must do" a real person has ever seen in this product is AI-generated.**
The implementation stays on the *before real customers* list, and the reason is arithmetic:
**every checklist created before it is built is another record that may disagree with the
obligations**, and 235 already exist.

**What this decides for the schema, stated so it is not rediscovered:** a checklist item needs a
nullable link to an obligation and a flag for what it is. A NULL link is not a defect — it is the
suggestion case, and it must be **visibly** a suggestion rather than an unlinked requirement.

**Reversal condition:** a library complete enough that an unmatched item means the answer is
wrong rather than that the library is thin. **205 rows against one vertical is not that**, and the
suggestion label is what carries the honesty until it is.

---

## 112. Checklists come after research, as their own section — 21 September 2026

**Research first: the conversation, the answer, fact handling. Then checklists, built on top.**

**The Create tab is untouched until that section begins.** It is no longer waiting on a decision —
§111 settled what a checklist is — it is **sequenced**, which is a different and weaker reason to
leave something alone, and worth recording as such so nobody reads the silence as a blocker.

**Why this order.** The hybrid in §111 starts from *the obligations that apply to the question* —
and which obligations apply is decided by facts the conversation captures. **A checklist built
before the research path is settled is a checklist built on facts that arrive by a route still
being changed.** §102, §103, §106 and §107 all changed the research path in one day; the Create
tab would have been rebuilt against each of them.

**What it costs:** the 235 production checklist rows keep accruing. **Named rather than
discovered** — §111 records that cost and this section accepts it for the length of one module.

---

## 113. THE OPEN BASELINE — the pipeline subtracts, so it is switched off — 21 September 2026

**Scope: research mode only. Status: DECIDED, NOT BUILT.**

### The benchmark that forced it

**Five questions, each asked of raw Claude and ChatGPT with no context, and of CompliBoard:**
a Seattle restaurant · a California hospice · Texas roofing · Oregon cannabis · Ohio hazmat
freight. **CompliBoard was weaker on most.**

§102 found this once on one question and the answer was to remove the template. **This is the
finding again, wider, and the diagnosis is no longer about one prompt.**

### The diagnosis — each piece subtracts

| | |
|---|---|
| **The prompt narrows the model** | *"Answer the question you were asked. Nothing else"*, plus prohibitions, is a fence. §102 said a template narrows the OUTPUT; a list of things not to do narrows it too, and less visibly |
| **Search leads instead of checking** | with search on by default the model searches first and writes from what it finds — so answers **mirror vendor pages**. §106's citations made this visible: the federal claims cited containment vendors while the Oregon ones cited DEQ |
| **The gate blocks too readily** | and through a **chemical-manufacturing** switch vocabulary. **The cannabis question was withheld entirely over a butane threshold** — a vocabulary built for one vertical refusing a question from another |
| **Nothing offers to help further** | the bare models end by offering the next thing. §109 already recorded ChatGPT asking four questions where the product asked none |

### The decision

> ### Research runs an OPEN BASELINE in production: one call to the current Sonnet, a
> ### one-sentence role, web search available with **the model** deciding, prior messages as
> ### history. Sources and the disclaimer stay.
>
> **Switched off: the gate, the facts block, the frame and scenario blocks, and the long prompt.**

**THE PIPELINE IS NOT DELETED. Each piece becomes a configuration switch.** Production runs all
off; staging runs whatever R&D is testing. **Rollback is one config value.**

> **The release mechanism and the experiment framework are the same thing.** That is the point of
> doing it with switches rather than by deleting code: there is no separate "experiment branch" to
> keep alive, and no rebuild when a piece earns its way back.

### R&D builds up from the baseline, one piece at a time

**Each ships only if it beats the step before it.**

| | |
|---|---|
| **1** | **Search that VERIFIES rather than leads**, preferring government sources |
| **2** | **Specialist behaviour, and a specific offer** of what to do next |
| **3** | **Company facts** |
| **4** | **The gate, with a much higher bar** — block only when an answer without the fact would be *wrong*, and ask in plain language |

**The gate is last, not first.** It is the piece with the most evidence against it and the most
machinery behind it, and both of those are reasons to re-earn it rather than to assume it.

### THE LESSON, RECORDED AS THE OWNER'S AND LEARNED TWICE

> **A structure built ahead of the model constrains it.**

**The requirement table was abandoned for the same reason** — a shape decided before the thing
that had to fill it. **This is the second time**, and the second time is what makes it a rule
rather than an anecdote. It is in `HOW-WE-BUILD.md` §11.

**The baseline is wide open; everything on top must measurably beat it.**

**Reversal condition:** a benchmark where a pipeline piece beats the baseline. **That is not a
reversal of this decision — it is the mechanism this decision installs**, and the only thing that
reverses it is the same measurement going the other way.

---

## 114. Module by module, and the loop that gets a module done — 21 September 2026

**All modules ship. No compromise. One at a time.**

### The loop

| | |
|---|---|
| **1** | **The owner writes his user-view vision** for the module — what a person sees and does |
| **2** | **Chat checks it against the system** and sorts every gap into exactly one of three kinds |
| **3** | **Chat builds an artifact** the owner iterates on, to a **pre-agreed finish line** |
| **4** | **The artifact FILE goes into the repo** — not a description of it |
| **5** | **Chat writes one complete brief** |
| **6** | **Chat runs long against the brief, checking its own work**, stopping only for a product decision, a production migration, and the end |
| **7** | **Chat reviews at midpoint and finish only** |

### THE THREE KINDS OF GAP, and sorting them is the whole value of step 2

| | What it means | What happens |
|---|---|---|
| **SCHEMA gap** | the schema is wrong, **not the vision** | migrate |
| **DATA gap** | the structure is fine; the data is absent or untrusted | content work — **and the screen stays truthful meanwhile** |
| **TRUTH gap** | **no system can honestly know this** | **push back on the vision** |

> **The third is the one a chat will not volunteer unless it is asked for.** A model handed a
> vision will find a way to build it, and *"nothing can honestly know that"* is the answer that
> looks like refusal. `CLAUDE.md` §6 is the same rule pointed at output; this points it at scope.

**And the DATA row's second half is load-bearing:** a screen over absent data must say the data is
absent. That is the omniscient-status-tracker anti-pattern, which has been removed from this
product once already.

**Recorded in `HOW-WE-BUILD.md` §12 as the method.**

---

## 115. Benchmarks use an INCOGNITO chat — 21 September 2026

**Raw Claude in an incognito window, plus ChatGPT. Not a normal chat.**

**A normal chat carries the owner's memory, and it contaminated earlier baselines** — a "bare
model with no context" that has been told about this project for weeks is not bare. The
comparison in §102 and the five-question benchmark in §113 both depend on the other side genuinely
knowing nothing.

> **It is the cheapest possible control and it was being skipped by default**, because a logged-in
> chat is the one already open.

**Golden case 004 records the conditions per answer for this reason** — *"No log in, no
background. Just asked on the web app"* — and those words are now a requirement rather than a note.

---

## 116. Chat history is decided and not in the first release — 21 September 2026

**§110 stands. It does not ship with the first release.**

**It ships only when all four are true:**

1. **The day-16 deletion job exists**
2. **It is checked** — something answers *did it run, and what did it remove*
3. **Account deletion removes chat history immediately**
4. **The privacy policy says so**

> **§110 recorded (a), (b) and (c) as requirements. This records that they are RELEASE GATES, not
> follow-ups.** The difference matters: a requirement can ship late, and a gate cannot. A retention
> promise on screen with no enforcement behind it is a false statement to a customer, and the
> product would be making it on day one.

**What ships instead:** conversations live for the length of the page, as they do today. **No
history list, and therefore no promise to break.**

---

## 117. Release timing — ANSWERED 22 September 2026: every module ships in the first release

**Two options, and nothing in this record decides between them:**

| | |
|---|---|
| **Release now**, improve module by module | customers see it sooner and shape it; every module ships into something live |
| **Release after every module's pass** | nothing is seen until all of it is good |

**This is recorded as OPEN rather than resolved because it is a business judgement about who the
first customers are and what they are promised** — not something derivable from the code. §113's
baseline makes either viable, which is part of why it was worth doing.

**What would decide it:** who the first ten customers are, and whether they are being sold a
finished product or are helping build one.

---

> ### ✅ ANSWERED — 22 September 2026. THE SECOND OPTION. **EVERY MODULE SHIPS IN THE FIRST
> ### RELEASE. NO COMPROMISE.**
>
> The owner's decision. Not release-now-and-improve: the first release is the whole product, built
> one module at a time until every one of them passes, in the loop `HOW-WE-BUILD.md` §12 describes.
>
> **And it settles the shape of the remaining gate work.** Credential rotation and anything else
> still on `TODO.md`'s GATE happen **once, just before launch** — a single pass, rather than items
> repeatedly re-scheduled against a release date that keeps moving. §114's *"all modules ship, no
> compromise, one at a time"* is now the release plan and not only the build method.

---

## 118. The worksheet is the library, and content never goes in a migration — 22 September 2026

> ### AND THE SAME CLASS AGAIN, IN STORAGE — §127, 23 September 2026.
>
> This section's rule is that **content never goes in a migration**. The `company-documents`
> bucket looked like content by that rule — migration 000 says so in its own words, *"a ROW in
> `storage.buckets`, i.e. data, not structure"* — and was left out. It is not content: it is the
> container, it is named in code, and migration 002's policies are written against it. Migration
> 037 deliberately revises 000 on this one row, and says why in its header. The distinction this
> section draws still holds; the bucket was simply on the wrong side of it.

**The owner's decision, on `TODO.md` 6.3c: THE WORKSHEET IS AUTHORITATIVE, regenerated from the
live library.** And with it a standing rule, which is the half that stops this recurring:

> ### REQUIREMENT CONTENT CHANGES GO THROUGH THE WORKSHEET AND `load-requirements.js`.
> ### NEVER THROUGH A MIGRATION.
>
> A migration changes the SHAPE of the library. The worksheet is its CONTENT. Migration 013 put
> content in a migration, and that is precisely how the seed files and the databases diverged.

### What went wrong, with the lines

Migration **013** split three requirements into **eleven children** and retired the parents. It
finds its parents by name:

```
013_chemical_inventory.sql:419   select id into parent_id from public.requirement_templates
                                  where requirement_name = '…' and effective_to is null;
013_chemical_inventory.sql:421   if parent_id is not null then
```

On a from-zero run the chain has not loaded any library yet — `load-requirements.js` runs *after*
the migrations, at step 2 of `npm run db:restore`. So `parent_id` is NULL, the block is skipped,
and **013 does nothing.** Its own verification block (lines 600-622) then passes on the empty
table: zero orphan children, zero live parents. **§98's failure mode exactly — a check that
passes, not one that fails.**

**013 predicted this itself, at line 388**, and pointed at a `TODO.md` row that did not exist:
*"the worksheet is no longer a complete source, and which of the two is authoritative now needs
deciding. TODO 6.3c."* Nine days later `npm run db:restore` refused its first run over it.

**Measured on both databases before deciding anything** — `select count(*) … join … on
c.split_from_id = p.id`, run against each:

| | total | retired | children | with expression |
|---|---|---|---|---|
| staging | 205 | 5 | 17 | 199 |
| production | 205 | 5 | 17 | 199 |

Identical, and the worksheet held **194**. The eleven rows were serving real customers on
production while existing in no file that could rebuild them.

### Why the worksheet and not the database

| | Cost |
|---|---|
| **Worksheet authoritative** *(chosen)* | The load path stays one file and one script. `load-requirements.js` already round-trips every column a split uses, `split_from` by name included |
| Database authoritative | The restore grows a step that re-applies content migrations after the library loads — a migration's effect then lives in two places, and every future content migration has to remember |

### What was done

- **`scripts/export-requirements.js`** — the other direction of the loader. One SELECT, one file.
  It takes its column list and its Reference/Notes sheets **off the worksheet it replaces**, so the
  shape is never retyped, and it checks every round-trip rule the loader enforces before writing.
- **`supabase/seed-data/REQUIREMENTS.xlsx`** — 205 rows, 5 parents carrying `effective_to`, 17
  children carrying `split_from` by name, all 205 carrying their database ids. **The date is gone
  from the filename** (`CLAUDE.md` §2: filenames are stable, the version lives in the header).
  The old `REQUIREMENTS-FILLED-2026-09-11.xlsx` is deleted; git keeps it.
- **`agency_id` and `applies_expression` are exported BLANK, on purpose.** `assign-agencies.js`
  owns one and `applies-expressions.json` owns the other. A value in the worksheet would be a
  second source of truth — the very failure being cleaned up — and `agency_id` would also invert
  the load order, since requirements load at step 2 and agencies do not exist until step 3.
- **Proved before anything destructive:** `load-requirements.js` in dry run against the *populated*
  table, which is its strict RELOADING mode — every id in the file must exist in the database and
  every row in the database must appear in the file. **205 rows read, 0 errors**, 17 warnings, all
  of them the loader's own "has both an id and a split_from … treated as an existing row that
  records its origin". Then `db:restore`'s read-only pre-flight: every library line reads
  **now = sources rebuild**, 205 = 205, and the three seed files agree with each other.

**Two comments still name the old filename** — `007_requirements_spine_rebuild.sql:20` and
`013_chemical_inventory.sql:389`. **Applied migrations are not edited.** Both are true of the day
they were written, and the rename is recorded here instead.

**Reversal condition:** a requirement change that genuinely cannot be expressed in the worksheet —
one that needs a column the sheet has no place for. That is a schema change, which is a migration's
job, and the content still follows in the worksheet afterwards.

---

## 119. A parser that hunts for punctuation can be fooled by punctuation — 22 September 2026

**The owner ran `npm run db:restore`. All 31 migrations applied from zero — `CLAUDE.md` §3.7's
guarantee, proved for the first time, and the thing §98's owed reset existed to establish.** Then
step 1 died in `scripts/schema-doc.js`, which runs *after* the schema is already correct, and steps
2-8 never ran. **Staging was left with a full schema and no library: §98's vacuous-pass state, for
real.**

### The cause, reproduced rather than inferred

`scripts/schema-doc.js` was **the only `supabase db query` call site in the repo that parsed output
without `-o json`** — checked at every call site; the other nine all pass `--agent no -o json`, and
`db-migrate.js:317` uses `-f` and `:370` is `db push`, neither of which parses. Without the flag the
CLI picks the rendering, and the renderings are not all JSON:

```
$ npx supabase db query --linked --agent no  "select column_default …"
┌────────────────┐
│ column_default │
├────────────────┤
│ '{}'::text[]   │
└────────────────┘

$ npx supabase db query --linked --agent auto "select column_default …"
{ "boundary": "…", "rows": [ { "column_default": "'{}'::text[]" } ] }
```

The parser was `out.indexOf('{')` then `JSON.parse(out.slice(i))`. **Against the drawn table the
first `{` is inside a DATA VALUE.** Forcing that rendering through the real function reproduces the
owner's crash exactly:

```
SyntaxError: Unexpected non-whitespace character after JSON at position 2
    at q (scripts/schema-doc.js:50:15)
{}'::text[]                         │ NULL │ …
```

The value is **`agencies.industries`, default `'{}'::text[]`** — the first brace-bearing value in
`information_schema.columns` ordered by `table_name`, which is why the `columns` query at line 59 is
where it landed.

> **Why it had never happened before is a HYPOTHESIS, not a finding.** The rendering is chosen by
> the CLI's own agent auto-detection, and in this sandbox it chooses the JSON envelope every time —
> all 14 catalog queries return `firstBrace@0`, nothing before, everything parses. **I could not
> reproduce the owner's conditions**; I could only reproduce the mechanism, by pinning the rendering
> the crash implies. What is certain is that the format was never pinned, so it was always free to
> change underneath.

### The fix, and the part that generalises

1. **Pin the rendering** — `--agent no -o json`, as every other script already did.
2. **Parse the whole string. Never search for a brace.**

> ### THE SECOND ONE IS THE REAL FIX.
> A parser that locates its payload by hunting for punctuation can always be fooled by punctuation
> in the data. One that parses the entire reply cannot, whatever a column default happens to
> contain. Pinning the flag closes today's case; not hunting closes the class.

3. **An unrecognised payload now throws.** `.rows ?? []` turned anything unexpected into *"no
   rows"*, and a schema document that silently omits a table it could not read is worse than one
   that was never written. *(Whether that path could actually fire is unproven — a failing query
   exits 1, so `execFileSync` throws first. It is closed as softness, not filed as a defect.)*

**Not affected:** `scripts/run-golden.js:216` uses the same first-`{`/last-`}` shape, but on **model
output**, where tolerating narration around the object is the intended behaviour (`CLAUDE.md` §3.4).
Different input, not the CLI, and it catches and reports rather than crashing.

### And the restore is now resumable

**Re-running the whole reset to recover would destroy a correct schema to rebuild the identical
schema.** `npm run db:restore -- --from N` starts at step N — and does **not** take the operator's
word for where that is. **Every check belonging to a skipped step is re-read first, and one failure
refuses the resume:** the counts that would have proved a step succeeded are exactly the counts that
prove it need not run. Verified both ways — `--from 5` against the empty library of that moment
(staging was mid-restore; it is fully loaded now) refuses and
names all four unmet checks; `--from 2` passes the gate on `migrations applied 31 = 31` and starts
the loop at step 2.

**Resuming is never a way past a failure.** It is a way not to repeat work the database can still
prove was done.

**Reversal condition:** if a step is ever added whose success leaves no observable count, the gate
cannot vouch for it and `--from` must refuse to skip past it.

---

## 120. The documented restore order was never executable — 22 September 2026

**`npm run db:restore -- --from 2` loaded steps 2, 3 and 4 clean — 205 requirement rows, 33
agencies, 56 coverage rows, 198 carrying an agency. Step 5 then failed with 216 errors, every one
of them the same sentence, and nothing was written.**

```
  0 switches · 200 live requirements
  216 error(s). NOTHING WILL BE WRITTEN:
    x [0] "…": references switch "…", which is not seeded.
```

### The cause, read off the loaders rather than inferred

`TODO.md` 0.10 numbered the steps **expressions at 5, switches at 6** — and the expressions
reference the switches:

```
scripts/load-expressions.js:70   switches = new Set(query('select id from public.switches')…)
scripts/load-expressions.js:87   if (!switches.has(s)) errors.push(`…references switch "${s}", which is not seeded.`)
```

**216 is not approximately right, it is exact.** Counted with the loader's own `switchesIn` from
`lib/appliesExpression.ts`, with the same `if (!x.expression) continue` guard the loader applies
at `:84`, `applies-expressions.json` makes **216 switch references** across its 199 expressions.
With `switches` at zero rows, every one of them fails at `:87`.

### Does the dependency run the other way too? No — and that is what makes a swap safe

**`scripts/load-switches.js` reads three things and none of them comes from another step:**
`information_schema.columns` (179), the enum catalog (181), and `public.switches` itself (187).
`grep -n "requirement_templates\|agencies\|applies_expression"` over that file returns **only
comments and console output** — no query. So the edge is one-way, and the fix is to swap them.

### Every other adjacency, checked the same way

| step | needs | the line |
|---|---|---|
| 2 requirements | schema only | enums / `requirement_templates` / `information_schema` (109/114/115) |
| 3 agencies | schema only | enum catalog, `agencies` (112/118) |
| 4 assign | 2 and 3 | `agencies` (95), **dies if empty** (110); `requirement_templates` (96) |
| 5 switches | **nothing** | (179/181/187) |
| 6 expressions | 5 and 2 | `public.switches` (70), live `requirement_templates` (71) |
| 7 test accounts | schema only | `companies` (48) |
| 8 multi-site | 5 and 7 | `companies` (38), `switches` (51) |

**Exactly one of the eight edges was wrong.** The rest hold as written.

### Why it survived from 11 September to 22 September

> ### AN ORDER THAT HAS ONLY EVER RUN INCREMENTALLY HAS NOT BEEN TESTED.
>
> Every previous run of these loaders happened against a database that **already had the 95
> switches in it** — seeded once on 11-12 September and never dropped since. `load-expressions.js`
> found its vocabulary every time, so the fact that nothing in the order guaranteed it was
> invisible. **The order was written down, agreed, quoted in two documents, and had never once
> been executed from zero.**
>
> This is `DECISIONS.md` §98's argument arriving at its own author: applying things incrementally
> proves they worked once, in one order, from one starting state. It is also §113's shape — a
> structure built ahead of the thing that had to run it.

**Fixed in both places at once**, because a list that disagrees with the code is how this happened:
`scripts/db-restore.js`'s STEPS array and `TODO.md` 0.10 now carry the same order, and the code
carries the line numbers above as a comment so the next person does not have to re-derive them.

**Two older passages say "step 6" for the switch step** — `DECISIONS.md` §98 and
`HOW-WE-BUILD.md` §4. Both were true when written; §4 is live guidance and now says step 5, and
§98 stays as the dated record it is.

**Reversal condition:** none. The dependency is a fact about what the loaders read.

---

## 121. A script the quality gate cannot see was broken for seven days — 22 September 2026

**`npm run preflight` crashed before reading anything.** Production was not queried and nothing was
applied.

```
scripts/preflight-prod.js:81
console.log(`\n  Both lists are above. The subtraction is checkable without trusting this script.
SyntaxError: missing ) after argument list
```

### Broken when written, or broken later? Later — and the commit is nameable

`git log --follow` gives the file exactly two commits:

| commit | when | parses as ESM? |
|---|---|---|
| `e87b249` | 13 Sep 11:48 — *"Make the pre-flight show its working"* | **yes** |
| `d0eb1f5` | 15 Sep 14:04 — *"Ship four migrations, and add a check that runs as the person who will run it"* | **no** |

The diff shows exactly what did it — a closing line replaced by a multi-line template containing
**unescaped backticks**:

```
+  RUN `npm run check:live` BEFORE APPLYING ANY OF THESE.
+    write, then checks anon is refused. `npm run check` cannot see a missing grant or policy —
```

The inner backtick closes the template, and `npm run check:live` is then parsed as code. Fixed by
escaping the four inner backticks; the text on screen is unchanged.

> **A measurement I got wrong first, recorded because the method is the point.** My first pass
> checked both historical versions with `node --check` on copies in a scratch directory and
> reported that **both parsed**. They do — *as CommonJS*. This package is `"type": "module"`, so
> `npm run preflight` parses the file as ESM, where the same bytes fail. **The first result was an
> artifact of where I put the file, not a fact about the file.** Re-run as `.mjs`, the history is
> unambiguous.

### What it does NOT invalidate

`HOW-WE-BUILD.md` §4 records the pre-flight holding on **13 September** — a production apply
aborted on a reported filename mismatch. **That is two days before the break, and the 13 Sep
version parses.** The account stands. *(The repo cannot pin the hour, so "the event followed the
11:48 commit that created the file" is an assumption, not a measurement — but no version of this
file has ever existed that both predates the account and fails to parse.)*

**Re-run on 22 September after the fix, it works**: both lists printed in full (31 on disk, 29
applied), orphans none, and the derived pending set is exactly `029_critic_findings.sql` and
`030_research_sources.sql`.

### The general finding, which is bigger than one file

> ### `npm run check` EXECUTES TWO OF THIS REPO'S TWENTY-TWO SCRIPTS.

`check` is `typecheck && check:schema && test && build`. It *runs* `check-schema-contracts.js` and
`test-guard.js`, so a syntax error in either fails the gate. **The other twenty are invisible to
it:**

- `tsconfig.json` sets `allowJs: true`, but its `include` lists `**/*.ts`, `**/*.tsx`, `**/*.mts`
  and the `.next` type folders — **no `**/*.js` pattern at all.** `scripts/*.js` are outside the
  program, so `tsc --noEmit` never opens them.
- `test-guard.js` runs `node --test tests/unit/*.test.ts`. No test imports a script.
- `next build` compiles `app/`, `lib/`, `components/` — not `scripts/`.

**The proof is this session:** `npm run check` was run green many times between 15 and 22 September
with a script in the repo that could not be parsed. A green gate said nothing about it, because the
gate had never looked.

**Swept today: `node --check` over all 24 tracked `.js`/`.mjs` files — 0 broken** after the fix. So
this was the only one, and that is measured rather than assumed.

**Proposed, NOT built** (it changes the commit gate, so it is the owner's call): a `check:syntax`
step running `node --check` over `git ls-files '*.js' '*.mjs'`. It needs no credentials and no
network, runs in about a second, and would have failed on 15 September instead of on 22 September in
front of a production migration.

**Reversal condition:** if scripts move to TypeScript and land inside `tsconfig.json`'s `include`,
the separate syntax step becomes redundant.

---

## 122. Production is on 030 — 22 September 2026

**A dated fact, not a decision.** Recorded because `STATUS.md` and the hand-offs have carried
*"staging is two ahead of production"* since 21 September, and it is no longer true.

**The owner ran `npm run preflight`** — itself unparseable until the same day (§121) — which printed
both inputs in full and derived the pending set as exactly **`029_critic_findings.sql`** and
**`030_research_sources.sql`**, with no orphans. Then `npm run db:migrate:prod`, typed
`PRODUCTION`, both applied; `db:types` regenerated from production, `git status --porcelain` empty
and `npm run typecheck` green.

**Re-read from both catalogs afterwards rather than taken from the run's own output:**

```
staging     {"latest": "030", "migs": 31}    29 tables in public
production  {"latest": "030", "migs": 31}    29 tables in public
```

**And the objects the two migrations were supposed to create were checked ON PRODUCTION**, because
a migration recorded as applied is not the same claim as an object existing (§3.7's own argument):

```
select count(*) from information_schema.tables
 where table_schema='public' and table_name in ('critic_reviews','critic_findings');   -- 2
select count(*) from information_schema.columns
 where table_schema='public' and table_name='checklists' and column_name='research_sources'; -- 1, nullable
```

**The library is identical either side** — 205 requirement rows, 5 retired, 17 split children, 199
carrying an expression, 33 agencies, 56 coverage rows, 95 switches, 40 edges.

**What has NOT changed, and it is still the thing that matters most:** production holds **235
AI-written `checklist_items` and 0 computed obligations**, and **0 `company_switches`**. Two new
tables and a nullable column do not move that. §68 and §111.

> **The pairing to stop making:** production catch-up and credential rotation have travelled
> together in every hand-off. **Catch-up is done. Rotation is not**, and nothing in this week's
> database work touched it — seven leaked credentials plus the born-rotated eighth, now scheduled
> for a single pass just before launch under §117.

---

## 123. RUN 1 — the open baseline, both outputs — 22 September 2026

**The owner's principle, verbatim:**

> ### "this section needs no barrier between Claude and an answer."

In code that means: the system prompt is **one sentence of role**. No gate, no facts block, no
scenario block, no critic, no prohibitions, no template. Web search available and **the model**
decides. Prior messages as history.

**Three things are not barriers and stay:** file parsing, citation reassembly, and — for
checklists only — a structured output shape, because the UI has to tick, count and store items.
**A shape is a container, not a fence.**

### The six switches — `lib/pipelineConfig.ts`

`RESEARCH_GATE` · `RESEARCH_FACTS_BLOCK` · `RESEARCH_LONG_PROMPT` · `CHECKLIST_GATE` ·
`CHECKLIST_CRITIC` · `CHECKLIST_LONG_PROMPT`. All boolean, **all default OFF**, read from env.

> **All six have a READER, checked rather than assumed** — §9a: a field nothing reads is a claim
> nothing can check. Two of them did not when first written: `RESEARCH_FACTS_BLOCK` and
> `CHECKLIST_CRITIC` were declared and consumed nowhere, because the open path skips the block
> they gate. Both are now read inside the gate-on path, so turning the gate back on gets the
> pieces one at a time rather than all of them together. `CHECKLIST_CRITIC` off means the critic
> call is **not made** — it is the most expensive call in the product at 84 s average, and
> running it to discard the answer would pay all of that for nothing.
>
> **`RESEARCH_FACTS_BLOCK` covers both modes on purpose.** The block is assembled once, from one
> `splitForAnswer` call, whichever mode is running. A second name would imply the two could be
> set independently when there is one block and one place it is added.
Production runs all off; staging runs whatever R&D is testing; **rollback is one env value.**

> **OFF MEANS THE CODE PATH IS NOT ENTERED**, not entered and its output discarded. The route
> branches *before* the gate block, not after it. A gate that runs and is ignored still costs the
> latency, still spends the tokens, and still logs as though it decided something.

The resolved state is logged **once per process**, with the raw string beside each value:
`RESEARCH_GATE=ture` and `RESEARCH_GATE=True ` both resolve to OFF and only one of them is what
somebody meant. Only the exact string `true` turns a piece on.

### The history decision

**With the gate off, signed turns are ignored.** Turn signing (§89–§91) exists so a client cannot
edit the conversation **the gate reads**, because the gate treats a prior turn's facts as
established. With the gate off nothing is established from history — it goes to the model as text
and is weighed like any other context. **The signature protects nothing on this path**, and
requiring it would refuse a conversation for failing a check with no subject. The client still
sends `turns`, so turning `RESEARCH_GATE` back on needs no client change.

History travels as plain `{question, answer}` pairs. Verified end to end: ask about propane
storage, then *"What did I just ask about?"* — the answer names propane.

### THE NARRATION RULE, AND THE EVIDENCE

With search attached the model often opens by saying what it is about to do, and `reassemble`
concatenates every text block — so that narration became the top of the answer and of what we
store. **Three real streamed calls were recorded before any rule was written** (`lib/ai.ts`
carries the full dump):

```
SAMPLE 1  Oregon cannabis / butane        0 text "I'll help you understand the licensing…"
                                          1-3 server_tool_use · 4-6 web_search_tool_result
                                          7+ text  (the answer, 35 blocks)
SAMPLE 2  workers' comp                   0 text "I'd be happy to help you understand…"   [whole answer]
SAMPLE 3  SDS vs container label          0 text "I'll help you understand the differences…" [whole answer]
```

> ### A text block is narration IF AND ONLY IF a `server_tool_use` appears ANYWHERE AFTER IT.
> ### The answer is the text that follows the LAST search. No tool use, nothing is dropped.
>
> **Positional, not linguistic.** Samples 2 and 3 open with the same words sample 1 narrates with
> and they are the entire answer — a phrasing heuristic would have deleted both. Fifteen tests run
> against the recorded sequences, and replacing the rule with a linguistic one fails four of them.

> ### ⚠ CORRECTED 22 Sep — THE FIRST VERSION SHIPPED AND LEAKED. SEARCHING IS NOT ONE ROUND.
>
> The rule first written here read *"before the FIRST `server_tool_use`"*. **Two more sequences
> were recorded on `claude-opus-5` at `effort: max`** — the same Seattle restaurant question,
> twice — and the second one narrates **three times**:
>
> ```
>  1  text  "I'll research the current requirements across federal, state, county…"
>  2-5  server_tool_use · 6-9 result
> 11  text  "Let me check the Seattle-specific city requirements and employer obligations."
> 12-15 server_tool_use · 16-19 result
> 21  text  "Let me verify the employer registration requirements and a couple of remaining local items."
> 22,23 server_tool_use
> 27+ text  the answer — "Opening a restaurant in Seattle means clearing four layers…"
> ```
>
> **Blocks 11 and 21 sit after the first search, so the first version kept them** and the answer a
> customer read began *"Let me check the Seattle-specific city requirements…"*. The model searches,
> writes a line about what it will look at next, and searches again.
>
> **Three verbs for one behaviour across the five samples — "I'll help", "I'll look up", "Let me
> check", "Let me verify", "I'll research" — which is the second argument for being positional.**
> A regression test reproduces the old rule against sample 5 and asserts that it leaks, so the
> defect cannot come back unnoticed.
>
> **Checked, because the wider rule drops more:** in both recorded Seattle dumps, **zero** cited
> text blocks precede the last search (25 and 65 citations respectively all fall after it), so
> nothing cited is lost. Driven through the route afterwards, the answer carried **32 sources**.

**In a stream you cannot know a block was narration until the search follows it**, so the text is
emitted and then withdrawn with a `reset` event. Buffering the opening instead would mean **not
streaming at all** for every answer that does not search — which is most of them. Confirmed
through the real route: the searched benchmark question fired **1** reset, the two unsearched
fired **0**.

**The limit, stated rather than discovered later:** if a model ever writes real content, *then*
searches, this drops it. Nothing in three samples does that — pre-search text was one block
carrying zero citations every time — and a fourth sample that breaks it is the signal to narrow
the rule.

### The checklist shape, cut

`cost_note`, `providers` and `safety_alert` are **gone from the prompt**. They are slots, and
§113's finding is that the model fills every slot it is given: the cost slot produced dollar
ranges with nothing behind them, the provider slot produced where-to-buy sections nobody asked
for. **They stay OPTIONAL in the type** because 235 stored items on production carry them and
must still render. What the shape asks for is what the screen reads: a title, the two lists, and
per item a name, a description, a why, and where it came from.

### Micro-steps generate in the background

The list renders; the steps are written behind it. **At most three in flight** — a twenty-item
checklist would otherwise open twenty concurrent calls from one browser. An item shows *"steps
being written"* until its steps land.

**Never lost, never repeated**, and both hold because the enqueue condition is **absence from
storage** rather than "did this session generate it": restored items are skipped forever, and an
item still being written when the user leaves is picked up next time. **Micro-steps inherit the
parent item's sources and carry none of their own** — a step is a way of doing the item above it,
not a separate claim, and a citation of its own would be a second source for one obligation that
could disagree with the first.

### Streaming, and what it closed

`askAIOpenStream` takes a system string, a messages array, an `AbortSignal` that reaches the SDK
request, and returns a stream. This closes **`TODO.md` 0.11 for this path**: the 21333-token
non-streaming ceiling `askAIWithCitations` has to clamp to is gone, and §92's 58.9 s of silence
is answered by text arriving as it is written. `askAIWithCitations` is unchanged for every
existing caller.

**Abort reaches the SDK, proved rather than asserted.** Client aborts at 2001 ms; the server logs
the SDK's own abort event — `AI: upstream aborted after 1729ms (sdk.aborted=true, err=Error)` —
so the request to Anthropic was cancelled, not merely unread.

### Measured on staging, all switches off

| question | wall clock | output tokens | searches | sources |
|---|---|---|---|---|
| Oregon cannabis extraction / butane | **33.1 s** | 1398 | 3 | 8 |
| "Do I need workers' comp insurance?" | **6.2 s** | 250 | 0 | 0 |
| SDS versus container label (HazCom) | **11.3 s** | 568 | 0 | 0 |

First text arrives at **1.3–2.8 s** in every case. **All three finish far inside the 800 s
function limit**, so the extra stop condition was not reached. **The answers themselves are the
owner's to judge against an incognito chat (§115); nothing here scores them.**

**Reversal condition:** §113's, unchanged — a benchmark where a pipeline piece beats the
baseline. That is the mechanism this installs, not a reversal of it.

---

## 124. R1.2 step one — prefer official sources, behind a switch — 22 September 2026

**The first piece measured back on top of the open baseline.** §113 switched six pieces off to
reach that baseline; this is the opposite direction, and the rule §113 installed governs it:
**it ships only if it beats the baseline on the owner's comparison.**

### What it is

`RESEARCH_PREFER_GOV`, default OFF, in `lib/pipelineConfig.ts`. When ON, one sentence is appended
**after the role sentence** in both the research and the checklist system prompts, and nothing
else changes:

> When you cite sources, prefer official ones: the regulation itself, or the government agency or
> regulator that enforces it. Use another source only when no official one covers the point, and
> say so.

### Why this sentence and not a rule

§113's diagnosis included *"search leads instead of checking, so answers mirror vendor pages"* —
made visible by §106's citations, where **the federal claims cited containment vendors while the
Oregon ones cited DEQ.** That is the defect this addresses.

> ### IT IS A PREFERENCE, NOT A PROHIBITION.
>
> It says what to prefer and **permits the alternative with a disclosure**. A sentence forbidding
> non-government sources would be a fence, and §113's whole finding is that a list of things not
> to do narrows the model less visibly than a template does. A test asserts the wording carries no
> prohibition verb, so that a later edit cannot quietly turn the preference into a rule.

**One switch covers both modes** although the name says RESEARCH. It is one sentence about how to
cite, and citing differently in the two outputs of the same section would be the product
contradicting itself.

### Where it sits in the checklist prompt, and why that matters

**After the role sentence, before the shape** — the shape has to stay last, because it ends with
the instruction about what `must_do` and `good_to_have` mean. A test pins that the prompt still
ends on the format instruction.

### The property the tests actually defend

Not *"does the sentence appear"*. **It is that with the switch OFF the prompt is byte-for-byte
what it was.** A comparison of on against off is worthless if turning it off also changed
something else, and a prompt drifting by a newline is exactly the difference nothing else in the
suite would catch. Seven tests, including every near-miss spelling of `true` — `ture`, `yes`,
`on`, `1`, `TRUE ` — all of which must read as off.

### Status

**ON in `.env.local` for local comparison. NOT set on staging or production.** It ships to
production only if the owner's comparison says it beats the current output — that is §113's
mechanism, not an extra hurdle for this piece.

**Reversal condition:** the comparison going the other way, or the sentence changing what is cited
without changing whether the citation is right. **Preferring a government source is not the same
as being correct**, and if the measured effect is that answers look more official rather than
being more accurate, this is worth less than it appears.

---

## 125. RUN 2 — conversations that persist, and the nightly jobs — 22-23 September 2026

**A conversation used to live for the length of the browser tab.** `topics` recorded that one had
happened; nothing recorded what was said. This is the run that writes it down, ages it, reads it
overnight, and clears it.

### What this supersedes, named rather than implied

| | Was | Is |
|---|---|---|
| **§110** | transcripts kept **15 days** from the conversation | **7 days from SUMMARISING.** The clock starts when the summary exists, because the summary is what makes the transcript disposable |
| **§116** | chat history **deferred** out of the first release behind four gates | **Three of the four gates are BUILT** (§117: every module ships). The fourth — the privacy policy — is the owner's |
| **§110** | — | **Summaries and checklists are kept until the user deletes them.** Only the transcript is disposable |

### The turns table, and the two columns that stay separate

`summarised_at` says the summary exists; `delete_after` says the transcript may go. **One combined
`expires_at` would either delete transcripts that were never summarised, or keep them forever
during a summariser outage.** Both halves are visible instead.

**A new turn clears `idle_at` and `delete_after` and moves `last_turn_at`.** An active
conversation is never summarised or deleted under someone — a person returning on day six is not
cleared on day seven.

**A title is the first question, verbatim,** until a summary exists. A model-written title costs a
call and a wait before the first answer and gets it wrong often enough to be worse than the words
the person typed.

**A stopped answer is not a question answered.** The question is saved and marked `stopped`; no
assistant row is written; the counter does not move.

### Counters record events, not inventory

> ### THEY NEVER GO DOWN, AND ARE NEVER DERIVED FROM ROWS THAT CAN BE DELETED.

Transcripts are cleared after seven days and checklists can be deleted. A `count(*)` would fall on
both and tell a customer who asked forty questions that they asked six. Micro-steps are not
counted — they expand an item of a checklist already counted.

The increment is a database function because PostgREST cannot express `col = col + 1`, and two
answers completing together would otherwise produce +1 instead of +2. **Its `EXECUTE` is revoked
from `PUBLIC` in the same migration** — the thing migration 013 did not do and migration 019 had
to come back for (`AUDIT-CHECKS.md` check 22).

### Conversion: scope, and a guarantee that is enforced rather than asked for

`scope=discussed` promises **every item's source is one the conversation already cited**. The
prompt asks for that; the prompt is a request. So after the call every item's `source_url` is
compared against the URLs actually cited in the topic's turns, and **an item citing anything else
is dropped and counted in the response.**

> **Dropping rather than blanking the source is the stricter and the honest choice.** An item with
> its source removed still claims to have been discussed, and now has nothing behind it.

`scope=complete` adds what the conversation did not reach, marked `origin = 'added'` with its own
sources. **Measured on staging:** discussed produced 16 items, all `origin=conversation`, none
citing an outside source; complete produced 29, of which 2 were added and cite their own.

**§111 stays deferred.** Nothing here links an item to an obligation. `origin` is provenance, not
authority.

### The nightly jobs — Vercel Cron, two protected routes, no worker

**They refuse when `CRON_SECRET` is UNSET, not when it mismatches.** The tempting shape —
`if (secret && given !== secret) refuse` — opens the route to everyone on a deploy where the secret
was never set, and looks exactly like a route that is working. They answer **404, not 401**, so an
anonymous caller cannot confirm the route exists, and the comparison is length-safe.

**One `job_runs` row per run**, opened before the work and closed after, so a crash leaves a row
with a null `finished_at` rather than an absence indistinguishable from "cron never fired". That is
§116's second gate — *did it run, and what did it remove* — answerable from the database.

**The summariser never writes `company_switches`** (§108). Candidate facts land in
`fact_proposals` with the quote they came from, copied at write time because the turn it points at
will be deleted. **A user's own summary is never overwritten unless turns are newer than it** —
proved both ways on staging: intact after a run, re-summarised after a new turn, and the three
facts from that turn landed as proposals.

**One topic failing does not stop the others.** Each is its own try/catch and its own entry in
`errors`; a run that processed 40 of 41 topics is a successful run with one recorded error.

### THE BACKSTOP, which is the part that makes the promise real

> ### The deleter also clears any transcript older than 30 days with NO SUMMARY AT ALL.
>
> Without it, **a summariser outage makes transcripts permanent.** Nothing would ever stamp
> `delete_after`, so nothing would ever be due, and every nightly run would report success at
> deleting the zero rows it found while the retention promise on screen quietly became false.
>
> **A retention promise that depends on another job having run is not a retention promise.**

### What the from-zero restore caught — in my own migration

Migration 031 tested its CHECK constraint by violating it, which §3.7 asks for. The probe was
`insert … select id from public.companies limit 1` — and **on an empty database that inserts zero
rows, which raises nothing.** The probe "succeeded", control fell through to the failure `raise`,
and the migration refused itself on a fresh chain after passing on a populated one an hour earlier.

**§98's argument arriving at this run's own work.** Fixed by guarding on a company existing; the
other five new migrations were audited for the same shape and were already guarded. The restore
then completed: **37 migrations from zero, all eight steps, every count matching its source.**

### A gap Run 1 left, found by running the code

The checklist shape asks for `source_title` and `ChecklistItem` declares it — **and the column was
never added.** Every write since has silently dropped it, because PostgREST ignores unknown keys on
an insert rather than refusing. It surfaced only when a route named the field explicitly. Migration
036.

**Reversal condition:** the 7 days, if customers are found returning to conversations later than
that. Nothing else here is a preference — the backstop, the enforcement and the counters are
properties, and losing any of them makes a statement on screen false.

---

## 126. RUN 3 — the page, rebuilt from the prototype — 23 September 2026

**`prototypes/compliance-workspace.html` was the spec, and where it and the page differed it
won.** The tabs, the docking composer, the drawers, the row pattern and the vocabulary are its.
Where it was silent — auth, storage paths, how an item persists — the old page's behaviour is kept.

**Rebuilt rather than patched**, because the layout, tabs, drawers and vocabulary all changed at
once. Two tabs are gone: *Create action items* and *Saved*.

### What was wrong before, and is not now

| | |
|---|---|
| **Markdown was not rendered** | Run 1's answers showed raw `\|` pipes and stray asterisks. `react-markdown` **plus `remark-gfm`** — the plugin is what turns a pipe table into a table; react-markdown alone leaves the pipes. A new dependency, small, and named here because §8 says stack additions are flagged |
| **Citation markers had nothing behind them** | `[n]` now opens a card with title, domain and link. **The markers are split out of the text BEFORE markdown runs** — walking the rendered DOM for `[n]` would also rewrite a number inside a code block or a URL |
| **Junk source titles reached the screen** | A bare domain, an OCR'd PDF header, a date-stamped file name. `lib/sourceTitle.ts` replaces them **from the URL path, never from the page's contents** — deriving from the path transforms something the source said; writing from the contents would be the product asserting what a document is called |
| **The working state was a timer** | The prototype animated four fixed steps every 520 ms. **That is a fiction** (§5.1) — it reports nothing. The words now come from the stream: `searching` events counted as they arrive, `writing` when text starts |

### The OCR detector took two passes, and the second is the interesting one

A one-or-two-letter fragment catches `FO D SAFETY`. It does **not** catch `HAZAR OUS WASTE`,
where the piece left behind is three letters — and widening to three would have caught **EPA,
DOT, GHS and SDS**, real acronyms in real titles. So it also matches a short list of English
suffixes that can only be the tail of a broken word. **There is a test asserting those four
acronyms survive**, because that is the regression the wider rule would have caused.

> It is a heuristic and says so. It errs towards **leaving titles alone**: the cost of a miss is
> one ugly title, and the cost of over-reaching is a correct title thrown away.

### A row must not claim a deletion that has not happened

`conversationStatus` decides *"back-and-forth cleared"* from **whether turns exist**, not from
whether `delete_after` has passed. The date says when the transcript MAY go; the nightly deleter
says when it DID. Between the due date and the next 03:30 run the conversation is still open, and
a row reading "cleared" would hide a working **Open the conversation** button for up to a day.

**The drawer footer follows the same rule** — *Open the conversation* only while turns exist,
*Open the checklist* only if one was made. A button that cannot do what it says is worse than an
absent one.

### Touch has no hover

`Delete` appears on hover on a row, and is **always visible below 820px**. A destructive action
whose only affordance is a hover is unreachable on a phone — not hidden, unreachable.

### Fact proposals write through the user's own path

*Save it* posts to **`/api/switches/answer`** — the same route a person answering a direct
question uses. **Never the service role, never from a job** (§108). *Not now* sets the status to
`rejected` rather than deleting: "we looked and said no" is worth keeping, and a deleted proposal
would be proposed again on the next nightly run. The screen says "Not now"; the column says
`rejected`, which is migration 034's own vocabulary.

### What is archived, and the limitation that comes with it

**`components/GateAskCard.tsx` → `components/archive/`.** Only the old page used it. Archived
rather than deleted for §113's reason: a piece behind a switch must be there when the switch is
turned back on.

> ### ⚠ THE REBUILT PAGE DOES NOT HANDLE `outcome: 'ask'`.
>
> With `RESEARCH_GATE` or `CHECKLIST_GATE` on, the route answers with a question and the page
> renders nothing useful for it. Both are off in production and on staging and have been since
> Run 1. **Re-wiring it is part of R1.5**, which revisits the gate at a much higher bar — the
> gate is not simply switched back on before then. Recorded here so it is a known limitation
> rather than a surprise.

### What proves what

`npm run check:live` covers the **routes**: a conversation saved and reopened, counters, stop,
both conversion scopes, `GET /api/topics/<id>`, summarise marking `summary_source=user`, and
DELETE removing the turns. **It cannot judge whether an answer reads as an answer** — the
markdown, the source titles, whether stop feels immediate, whether a cleared transcript reads as
the product working or as loss. Those are `TESTING.md`'s ten manual actions, and they are the
owner's pass before this ships.

**Reversal condition:** none for the rebuild. The prototype is the agreed design; a change to it
is a change to the design, not a reversal of this.

---

## 127. FIX ROUND 1 — the owner's 22-23 September test pass — 23 September 2026

**Nine defects found by using the product, not by running it.** Every one had a green
`npm run check` behind it. That is the finding this section is really about: the gate answers
*"does the code build and behave"*, and none of these nine were about that.

### A — an answer stopped, and nothing said so

On 22 September a hazmat question returned four lines, ended mid-sentence at *"Pin that"*, and
**stopped with no message**. The owner opened a new conversation to carry on.

The evidence, and the two halves agree:

```
turns row 4e981a5f   position 1 · role=user · stopped=TRUE · NO assistant row
dev log 05:39        no ERROR, no exception — nothing threw
```

**The server knew the answer had not completed. The client did not.**
`app/compliance/page.tsx:241` read:

```ts
x.phase !== 'done' && x.phase !== 'failed' ? { ...x, phase: 'done' } : x
```

A reader that finished **without a `done` event** fell out of the loop, threw nothing, and the
partial text was marked complete — shown with its action buttons and no warning.

> ### A STREAM THAT ENDS IS NOT A STREAM THAT FINISHED.
> The only thing that means finished is the `done` event. A dropped connection, a killed
> upstream and a proxy timeout all end the reader just as quietly as success does.

The loop is now `lib/answerStream.ts`, extracted so it can be tested against a stream that stops
early without a browser or a real network failure — eleven tests, one of which reproduces the old
rule and shows it calling a truncated stream `done`. Any outcome that is not `done` now renders a
visible line saying the answer stopped early, a **Try again** button, and a composer returned to
ready. Nothing is saved for it, and the line says so.

### B — "Bucket not found" was NEITHER of the two proposed causes

The brief offered two: never created on staging, or dropped by `db:restore`. **Both were wrong,**
and the databases say so:

```
staging      company-documents   created 2026-09-09 20:07:02+00
production   company-documents   created 2026-06-03 18:55:13+00
```

The bucket was there the whole time on both. **The cause was a wrong name in code** — Run 3's
rewritten `onFilePicked` wrote `storage.from('documents')` where the bucket is
`company-documents`. `lib/storage.ts` now holds the name once, so a sixth spelling cannot happen.

Checking it, though, found a real defect underneath: **no migration creates the bucket.**
Migration 002 writes four storage policies against a bucket the chain does not build, so a
from-zero database gets the policies and nothing for them to apply to — and the first upload
fails with exactly the error the owner saw, for a different reason. Migration 037 creates it
idempotently and verifies it is private and policied. It **deliberately revises migration 000**,
which called the bucket *"a ROW in `storage.buckets`, i.e. data, not structure"*; a bucket is the
container, it is named in code, and its policies are in the chain. **Same class as §98 and
§118**, recorded in both.

### C — history must carry its sources, and that is NOT SUFFICIENT

A third turn wrote: *"My previous two answers carried numbered citation markers, but I didn't
actually retrieve and verify those sources in this conversation."* **False** — both came from real
searches — and the nightly summariser then wrote the false claim into the summary, where it
outlives the transcript that would disprove it.

The cause was plain: history was replayed as text still carrying `[1]` and `[2]` with **no list
of what they referred to**. The model was being accurate about the context it had. Every path that
replays a conversation now appends the numbered list — the page's own history, the chat route's
stored-turn fallback, and **both summarisers**, which is where the falsehood got archived.

**That fixed the stated defect and did not fix the question.** Three runs of the same three-turn
sequence, same switches, varying only the heading of the appended list:

| Run | Heading | What turn three said |
|---|---|---|
| 1 | *"Sources cited in this answer:"* | *"I ran the searches **this time**. … Assume I made it up."* |
| 2 | *"Sources retrieved by web search while writing this answer…"* | *"**I did not run any searches before those two answers.** I wrote them from memory and then appended source lists formatted to look like retrieved citations."* |
| 3 | *"Sources cited in this answer:"* — the neutral one again, via `check:live` | *"## Direct answer: no. **I did not run a search before either of those answers.** I wrote the citation markers and URLs from memory and formatted…"* |

> ### ⚠ CORRECTION, MADE BEFORE THIS WAS FILED.
>
> On runs 1 and 2 alone this section said *"asserting the provenance made the denial
> categorical"*. **Run 3 refutes that**: the neutral heading produced a denial every bit as flat
> as the assertive one. One observation per heading was not a comparison, and it should not have
> been written as one. **The heading is not the variable.** What the three runs agree on is that
> the model will not vouch for its own earlier searching, whatever the list above it says.

**And the reason bounds what ANY wording can achieve.** History is replayed as plain assistant
**text**. The `server_tool_use` and `web_search_tool_result` blocks from the original exchange are
not stored and cannot be replayed, so the transcript contains no evidence that a search ever
happened. A provenance sentence sitting inside the model's own turn is a claim it can inspect and
disown — and it does. **No heading fixes that, which is why the two real fixes below are the only
ones on offer.**

So the neutral heading is kept — **because it claims less, not because it measured better** — and
pinned by test so the stronger claim is not reintroduced by someone who has not read this. The
remaining gap is the owner's to decide, not mine to close unilaterally. Two ways to close it:

1. **A line of system prompt** stating that earlier turns in this conversation were produced with
   search enabled and their sources are listed under each. Said by the operator rather than by
   the model about itself. This is a §3.1 prompt change.
2. **Store and replay the tool-use blocks**, so the evidence is actually in the context. Larger,
   and the honest fix.

`npm run check:live` runs the three-turn sequence every time and prints the model's own words.
**It currently FAILS, and it stays in.** `AUDIT-CHECKS.md`'s standard is that a check is recorded
with the answer on the day it was run, including where that answer is bad.

### D — a citation marker in a table cell cut the table in half

`AnswerBody` split the answer on `[n]` and handed each piece to the markdown renderer separately.
That is fine in a paragraph and wrong in a table, because **a table is a block and half a block is
not a table.** The real roofing answer, rendered through the old path:

```
<table> count: 1     <tr> count: 3  (a header and three rows)     literal pipes in the prose: 5
```

`lib/citations.ts` rewrites each marker into an ordinary inline markdown link — `[1]` becomes
`[1](#cb-cite-1)` — before parsing. A link is legal inside a table cell, a heading and a list
item, so the block survives; `AnswerBody` renders one markdown tree and turns links with that
href into the source card. Same fixtures, after:

```
roofing     <table>=1  <tr>=4 (expected 4)  markers=2  leaked pipes=0
wastewater  <table>=1  <tr>=5 (expected 5)  markers=3  leaked pipes=0
```

Fixtures are the roofing answer and the two wastewater answers from the test pass, pulled out of
`turns` on staging, plus the control: the wastewater answer whose tables carry no markers, which
must come back byte-identical. What is **not** rewritten is as important: a fenced code block, an
inline code span, and anything already link syntax.

The same render found a second defect and fixed it: every element carried
`node="[object Object]"`, react-markdown's mdast node spread into the DOM.

### E — print, and a title nobody could read

A drawer is `position: fixed` in a 560px column over the page, so **Download printed the drawer
clipped at one page AND the whole page behind it.** `printDrawer()` stamps a class on `<body>`
for the duration of the dialog; the page is hidden and the drawer becomes the document, with a
print-only header naming **the company, the title and the date**. A printed compliance page with
no company and no date is not evidence of anything. *"steps being written…"* is a progress note
and is now `no-print`.

The source-title cleaner had a gap of exactly one condition. Rule 3 required a `[_-]` **and no
whitespace**, so a file name whose separators had already become spaces walked straight through:

| Reached the screen as | Now shows |
|---|---|
| `2017 labor standards ord quick chart 11 15 17` | Labor standards ord quick chart |
| `registration process brochure 04 06 2018 final` | Registration process brochure final |
| `J:\SHARED\PERMITS\Forms\Baseline Monitoring Report.doc Rev. 02/27/01w` | Baseline monitoring report |

**The guard is capitalisation, and it is what keeps the rule safe.** A date run alone would
condemn `6-2-30: CATEGORICAL INDUSTRIAL USER REPORTING REQUIREMENTS` and `Fall Protection in
Construction OSHA 3146-05R 2015` — both real, both good titles. A person who titled a page
capitalised it; a file name that lost its underscores did not. Five real titles are in the suite
asserting they survive.

### F — R1.3, behind `RESEARCH_SPECIALIST`

Four sentences, verbatim from the owner, appended after the role sentence and after
`PREFER_GOV_SOURCES` when that is also on. Same standing as §124: **on locally for comparison,
unset in production, and it ships only if the owner's comparison says it beats the baseline.**
No prohibition verb — every sentence says what to do.

With the switch off the prompts are byte-identical, asserted for both modes and for all four
combinations of the two switches, which are independent and ordered: who you are, how to cite,
how to answer. R1.2's own tests now clear `RESEARCH_SPECIALIST` before asserting, or they would
have been measuring two switches and calling it one.

### I — the summary named a third party, and the CAUSE WAS THE DATA

The summary read *"the specialist laid out…"*. The person reading it is the person who had the
conversation; telling them what a third party said turns their own record into a report about
someone else.

It came from two places and fixing only the prompt would have left it half done: the prompt
opened *"a conversation between a compliance specialist and the owner"*, **and the transcript
labels every answer `SPECIALIST:`** — built in both summarise routes. The label is the strongest
signal in the input and no instruction outweighs the data. Both now read `ANSWER:`. Measured on
the same conversation, before and after:

> **BEFORE** — "…When you questioned the citations, **the specialist** acknowledged the first two
> answers were written from memory…"
>
> **AFTER** — "…Note that part of **the second answer** was unreliable: the claimed fee increase
> and electronic-only payment mandate were never finalized…"

### G — five golden facts, and the one that was supposed to fail

`scripts/golden-facts.js`, `npm run golden:facts`. **On demand, never in `npm run check`** —
every case is a real web-searching answer on the prose model. The five questions are **the
owner's own, copied out of `topics` on staging**, not paraphrases.

Run once on `claude-opus-5`, effort `high`, `RESEARCH_PREFER_GOV` and `RESEARCH_SPECIALIST` both on:

| Case | Wall | Output tokens | Facts |
|---|---|---|---|
| `seattle-restaurant` | 109.5s | 5,902 | ✅ 14 days · ✅ 1 hour/40 hours · ✅ tier across both locations · ✅ plan review |
| `california-hospice` | 93.6s | 6,407 | ✅ travel between patients is hours worked |
| `texas-roofing` | 109.0s | 7,586 | ✅ 6 feet |
| `oregon-butane` | 68.8s | 4,991 | ✅ the moratorium / HB 4121 |
| `ohio-hazmat` | 66.5s | 4,494 | 🆕 **MCS-150** · ✅ hazmat registration |

**8 passed · 0 failed · 1 newly passing.**

> ### THE EXPECTED FAILURE PASSED, AND IT STAYS ON THE LIST ANYWAY.
>
> `ohio-hazmat` missed MCS-150 on 22 September; on 23 September it named it. **One observation.**
> These are presence checks on a model's prose and they vary run to run — see H, where the same
> Seattle question scored 4/4, 3/4 and 3/4 at one effort level with nothing changed between runs.
> Flipping the expectation on a single pass would trade a quiet known gap for a suite that goes
> red at random. **Passing is never silent** — the runner prints `🆕 FIXED` and says to update the
> list — so neither state hides. Flip it when it has passed across several runs.

**The harness's own first run was wrong, and that is worth recording.** It read `answer.research`
and reported every fact missing on a perfectly good answer. `research` is the name of the field in
the ROUTE's NDJSON event; `AIAnswer` is `{ text, sources }`. A checker that reports FAIL on
`undefined` is the failure mode `run-golden.js`'s own header warns about, arriving from the other
direction.

### H — effort `high` against `medium`, three runs each

Same question, same switches, same model. Nothing changed but `output_config.effort`, confirmed
at the request level: three calls logged `{"effort":"high"}` and three `{"effort":"medium"}`.

| | run 1 | run 2 | run 3 | **mean** |
|---|---|---|---|---|
| **high** — wall | 102.2s | 73.4s | 62.9s | **79.5s** |
| **high** — output tokens | 7,784 | 4,862 | 4,472 | **5,706** |
| **high** — facts | 3/4 | 4/4 | 3/4 | **3.3/4** |
| **medium** — wall | 42.5s | 42.2s | 51.5s | **45.4s** |
| **medium** — output tokens | 3,047 | 3,203 | 3,664 | **3,305** |
| **medium** — facts | 4/4 | 3/4 | 3/4 | **3.3/4** |

**Medium was 43% faster and used 42% fewer output tokens, and scored the same on facts.**

> ### BUT THE FACT SCORES DO NOT SEPARATE THE TWO LEVELS, AND SHOULD NOT BE READ AS IF THEY DO.
>
> Each level varies by a whole fact between its own runs, and the misses are **different facts
> each time** — `high` dropped the accrual rate once and the tier rule once; `medium` dropped the
> 14-day food-handler deadline twice. Three runs against a ±1 spread cannot tell 3.3 from 3.3.
>
> The misses are **real omissions, not a brittle checker**: a seventh run at medium covered the
> deadline and the check passed on the ordinary wording — *"A worker can work up to 14 days before
> getting the card if you provide food safety training in the meantime[1]"*.
>
> **What these six runs do establish is the cost side, and it is not marginal:** the same question,
> answered to the same measured standard, for a little over half the time and well under two
> thirds of the output. **Nothing was changed. The owner decides.**

**Reversal condition:** F is reversed by unsetting the switch — that is what it is for. C's
neutral heading is reversed the moment the tool-use blocks are stored, which removes the reason
for it. Nothing else here is a preference; they are defects, and the tests are the record.

---

## 128. THE OWNER'S DECISIONS ON FIX ROUND 1, AND WHERE THE MONEY GOES — 23 September 2026

Four decisions taken on §127's findings, then the cost work that followed from the effort one.

### 1. Effort is `medium` for research and checklist

`DEFAULT_EFFORT` in `lib/ai.ts`, not only in `.env.local`, so the code default and the
environment agree rather than one silently overriding the other. It governs `askAIOpenStream`
and nothing else, so the gate, the critic and the audits are untouched.

**An unreadable `AI_EFFORT` now falls back to `medium`, not to the API's `high`.** A typo must
not silently buy the expensive tier — which is what the previous behaviour did.

### 2. `RESEARCH_PROVENANCE` — and the sentence had to move to the SYSTEM prompt

§127 C established that the model would not vouch for the sources of its own earlier turns, and
that **no wording inside the assistant turn could fix it**: history is replayed as plain text
with the `web_search_tool_result` blocks stripped, so a claim sitting in its own turn is one it
can inspect and disown.

The sentence is now in the system prompt, after the role:

> Numbered sources in earlier answers in this conversation came from web searches run at the
> time; treat them as real.

**It is permitted only because it is true.** `reassemble()` builds `sources` solely from the
citations the API attaches to search-grounded blocks, so a stored source is by construction a
page the tool returned. This tells the model a fact about data it cannot see; it does not ask it
to assume something convenient.

**Three runs through `check:live`'s own step, switch on — two stood by their sources, one did not:**

| Run | Verdict | What turn three said |
|---|---|---|
| 1 | ✓ | *"Yes — I re-checked the main ones just now and they hold up. But three of them weren't the best sources I could have given you…"* |
| 2 | ✓ | *"Yes — they were real search results, but two details in my last answer were more precise than the sources supported."* |
| 3 | ✗ | *"I can't personally vouch for them, because I didn't run a search in this conversation — those two answers were written from memory."* |

Before the switch, three runs denied categorically. **It is better and it is not reliable**, and
the step stays in `check:live` recording that.

> ### THE CHECKER WAS WRONG TWICE BEFORE IT WAS RIGHT, AND BOTH WAYS FLATTERED NOBODY.
>
> **First**, it failed a run whose previous answer genuinely had **zero sources** — the model
> said *"the second answer cited nothing, I wrote it from memory"*, **which was true**, and the
> check scored a correct answer as the defect. It now SKIPS when the previous answer cited
> nothing: a question with no subject cannot be passed or failed.
>
> **Second**, it failed three runs that opened *"Yes, they hold up"* and went on to caveat two
> citations, on a regex catching "not" within sixty characters of "verify". **A caveat is not a
> denial** — an answer distinguishing what it verified from what it did not is the product
> working. It also demanded the answer repeat a *hostname*, when "PHMSA administers it" names
> the source perfectly well.
>
> It now fails on the recorded denial, passes on an affirmation, and prints anything else for a
> person to read. `AUDIT-CHECKS.md` check 14's rule — a checker weaker or wronger than its
> assertion — arriving in the harness written to enforce it.

### 3. `lib/answerDisplay.ts` deleted, with its 18 tests

Orphaned by Run 3's `AnswerBody`. The test-guard floor refused the shrink until it was lowered
deliberately in writing, which is exactly what that guard is for.

### 4. Golden facts run three times per question

A single run of a presence check on a model's prose is an anecdote. The runner prints a **fact
stability table** — a hit rate per fact — because a mean hides the difference between 3/3 and 2/3.

---

## J — WHERE THE MONEY GOES

### J.1 The ledger

`ai_calls` (migration 038), one row per call, **written at the call**: company, task, model,
effort, input and output tokens, searches, wall clock, and a cost.

> ### THE PRICES GO ON THE ROW, AND THAT IS THE WHOLE DIFFERENCE BETWEEN A LEDGER AND A REPORT.
>
> `price_input_per_m`, `price_output_per_m` and `price_per_search` are copied from
> `config/pricing.ts` onto each row. If a price changes, or the owner corrects one they had
> wrong, **every historical total would otherwise move silently** — and the only question this
> table exists to answer is a question about the past.

`cost_usd` is nullable. **NULL means "not priced", never "free"** — a model missing from the
price table records its tokens and no cost, because inventing a number for it would put a
fiction in the one place meant to be fact.

> ### ⚠ AND THE PRICES BELOW WERE WRONG. CORRECTED BY THE OWNER, 23 SEPTEMBER 2026.
>
> The table was flagged in `config/pricing.ts` as unverified, and it was: **Opus 5 was listed at
> $15/$75 per million and is $5/$25; Sonnet 5 was listed at $3/$15 and is $2/$10.** Sonnet 4.5
> and Haiku 4.5 were right. `claude-opus-5-5` ($4/$20) and the bare `claude-haiku-4-5` alias were
> added — an id that resolves at the API and prices as null here would record its tokens with no
> cost, which is the quiet way a total goes wrong.
>
> **Every J figure written before this is an overestimate of about 2.8×**, and the conclusions
> that moved are marked below. `PRICES_VERIFIED_ON` now carries the date and `PRICE_CORRECTIONS`
> records what changed and **that it was a correction rather than a vendor price change** — a
> row costed at a superseded-but-real price recorded what was actually spent; a row costed from
> a wrong table records a number nobody was ever charged. `npm run cost` prints which it is.
>
> **The rows were NOT repriced.** Migration 038 stores the price on the row on purpose, and that
> decision holds even when the stored price was mistaken: the fix is a note, which is what this
> is, plus the corrected column the report now prints beside the stored one.

### J.2 The $5.33 session, reconstructed

**No logs survive** — that session's output went to a terminal, not to disk. So the
reconstruction is from the rows it left plus ratios measured today on the same task shapes.

**Measured** (topic `9055d102`, 15:00–15:35): 5 questions, **4 answers**, 32,395 characters of
answer text, 34 sources, one 31-item checklist, one 1,252-character summary.

**Calibration, from 50 paired research calls today** — and the first number is a finding in its
own right:

| | |
|---|---|
| **2.03 visible characters per billed output token** | Plain prose is ~4. **About half the output bill is reasoning tokens you never see**, so estimating cost from visible text understates it roughly twofold |
| **~4,506 input tokens per source retrieved** | Search results are injected into context and billed as input |

| Task | in ≈ | out ≈ | at the WRONG prices | **at the corrected prices** | how |
|---|---|---|---|---|---|
| research | 153,204 | 15,958 | $3.60 | **$1.18** | 4 answers, 34 sources — estimated |
| convert | 1,014 | 4,730 | $0.38 | **$0.13** | measured, scaled by item count |
| summarise | 1,200 | 250 | $0.04 | **$0.01** | measured, repriced at Opus 5, its tier then |
| **TOTAL** | | | $4.02 | **$1.32** | against **$5.33** actually billed |

> ### THE CORRECTION BREAKS THIS RECONSTRUCTION, AND SAYING SO IS THE POINT.
>
> At the wrong prices the estimate came to $4.02 against $5.33 billed — 75% accounted for, which
> read as a good reconstruction with a modest gap. **At the corrected prices it comes to $1.32,
> which accounts for a quarter of the bill.** The shape of the estimate did not change; the
> conclusion drawn from it did, and the earlier one was luck.
>
> So the honest statement is now: **the $5.33 is NOT reconstructed.** The split by task is still
> informative — research dominates either way — but the absolute figures do not reach the bill,
> and the candidates named below (effort `high`, a stopped answer, uncounted micro-steps) now
> have to account for **$4.01 rather than $1.31**, which is far more than they plausibly do.
> Something else in that session spent money that these rows do not show. **The ledger exists so
> that this question is never again answered by reconstruction**, and `scripts/golden-facts.js`
> now writes rows for the same reason.

**Research is ~90% of it.** The $1.31 gap is unaccounted and the honest candidates are named:
that session ran at effort `high` (the calibration is from `medium`, so the output side is a
lower bound), one question produced no answer and a stopped stream still bills upstream, and
micro-steps calls are not in the estimate at all.

### The finding a per-task split hides

Across the 58 calls in the ledger's first hours:

At the corrected prices, across 59 calls:

| | | |
|---|---|---|
| **input** | **$5.51** | **58.7%** — what we SEND: prompt, history, and search results |
| output | $3.11 | 33.1% — what comes back, reasoning included |
| search | $0.77 | 8.2% — unchanged by the correction, so its share nearly tripled |

Stored on the rows: $26.61. **At the corrected prices the same calls are $9.39** — the token
counts are measured and right; the money on those rows was an estimate that was wrong.

**The expensive half is the half we control.** Every source retrieved is ~4,500 tokens of input
on every subsequent turn that replays it.

### J.3 Routing by task

`AI_MODEL_SUBSTEPS` and `AI_MODEL_SUMMARY`, both defaulting to `claude-sonnet-5`. Micro-steps
expand an item already on screen and a summary reads a transcript that already exists; neither
decides what the law requires and neither searches. They were on the research tier only because
no other tier existed.

| task | tier | resolved | set by |
|---|---|---|---|
| research | prose | `claude-opus-5` | `AI_MODEL_PROSE` |
| checklist | judgement | `claude-opus-5` | `AI_MODEL_JUDGEMENT` |
| **substeps** | **substeps** | **`claude-sonnet-5`** | **code default** |
| **summarise** | **summary** | **`claude-sonnet-5`** | **code default** |
| convert | judgement | `claude-opus-5` | `AI_MODEL_JUDGEMENT` |
| gate | judgement | `claude-opus-5` | `AI_MODEL_JUDGEMENT` |
| critic | critique | `claude-opus-5` | code default |

### J.4 Opus 5 against Sonnet 5 — same question, same switches, same effort

Three runs each, Seattle, `medium`, `RESEARCH_PREFER_GOV` + `RESEARCH_SPECIALIST` +
`RESEARCH_PROVENANCE` all on. **No default model was changed.**

| | Opus 5 medium | Sonnet 5 medium |
|---|---|---|
| golden facts | **11 / 12** (3.7 per run) | **8 / 12** (2.7 per run) |
| per-run facts | 4/4 · 4/4 · 3/4 | 2/4 · 2/4 · 4/4 |
| wall clock, mean | 50.7s | **24.2s** |
| output tokens, mean | 3,446 | 2,253 |
| cost per run at the wrong prices | $0.7573 | $0.1161 |
| **cost per run, CORRECTED** | **$0.2658** | **$0.0841** |

Repriced from the recorded token counts — the same runs, not new ones. Three of the six had
their input tokens derived from the printed cost, and each derivation was checked by
recomputing the original figure from it.

**Opus 5 costs 3.2× as much and finds one more fact per run** — at the wrong prices it read as
6.5×, so the correction roughly halves the penalty for choosing Opus. Stability differs too: Opus held
3/3 on three of the four facts and 2/3 on the fourth; **Sonnet held 2/3 on all four**, which is
the shape of a model that is close but not settled.

For reference, §127 H's Opus 5 `medium` runs (two switches, before provenance, uncosted) scored
the same 3.3–3.7 range, so the switch did not move the fact count either way.

**Reversal condition:** decisions 1 and 2 are reversed by their own switch or constant — that is
what they are for. The ledger is not reversible in the same sense: if `config/pricing.ts` turns
out to be wrong, the fix is to correct it going forward, because past rows deliberately keep the
prices they were costed at.

---

## 129. FIX ROUND 2 — an attached file never reached the model — 23 September 2026

Two bugs from the owner's first test on production. **Item 1 needs migration 039 on production
before the code ships**; item 2 does not.

### 1 — the file reached Documents and never reached the model

The owner attached a policy PDF in a research conversation. The card rendered, the `documents`
row and its review were written, the Documents screen showed the full scan — and the next
question got *"no file has come through"*. Everything on screen was right; the model's context
was empty.

**The two lines.**

The old page sent the file WITH the question, in the same `/api/chat` call:

```
app/compliance/page.tsx @ a5587af^   (before the Run 3 rebuild)
  const fileToSend = answerFile ?? uploadedFile
  if (fileToSend) {
    const formData = new FormData()
    formData.append('file', fileToSend)
    …
    res = await fetch('/api/chat', { method: 'POST', body: formData, … })
```

The rebuilt page uploads, files, reviews, renders — and stops:

```
app/compliance/page.tsx   `onFilePicked`, last statement
  card({ classification: review?.review?.document_type ?? …, folder: … })
```

**`/api/chat` never lost the ability to read a file. It stopped being given one.** The route's
multipart branch and `parseDocumentToBlocks` were untouched by the rebuild and still work — the
one call site that used them went away.

### What the model receives now

**The document itself, as a native block.** For a PDF that is the **raw PDF, base64, as a
`document` block** — not extracted text. It is the same representation `lib/documentReview.ts`
already sends, so the conversation reads exactly what the review read. The fixture parses as
`kind: pdf`, one document block.

**Sent by ID, not re-posted as bytes.** The page holds the document's id, not the `File`; the
route loads it from storage as the caller. That is what makes it survive a reload and work on a
reopened conversation, which re-posting the bytes could not.

> ### AND IT IS CARRIED ON EVERY LATER TURN, WHICH IS THE OPPOSITE OF THE FIRST DESIGN.
>
> The first version sent only the review's summary on later turns, to save input tokens
> (§128 J put input at ~59% of the bill). **Measured on this fixture, two turns:**
>
> | turn | |
> |---|---|
> | 1 — *"What is this document?"* | named the 180-day waiting period as an error |
> | 2 — *"what did it get wrong about the waiting period?"* | *"That item does not appear in the list of problems identified in the document, and I can't confirm … that the policy contained a waiting period at all. I shouldn't have stated it as one of its errors."* |
>
> **It retracted a true finding.** The review's `gaps` array is lossy and the model reasonably
> read the injected list as definitive. A conversation that tells the customer its own correct
> answer was a mistake is worse than an expensive one.
>
> So the document travels with the conversation, capped at three, and the review text is now
> introduced as *"an earlier automated review described it as…"* under a heading that says the
> files themselves are attached and the notes are **not a complete list**. With the fix, the same
> turn 2 answers: *"the addendum says … after 180 days … Seattle's ordinance caps the wait on use
> at 90 days, so 180 is double the legal maximum"* — no retraction.
>
> **The cost is real and is not hidden:** every research turn in a topic with an attachment
> re-sends that document. This fixture is 4.4 KB. A long scanned PDF is thousands of input tokens
> per page, per turn. A size threshold is deliberately NOT invented here — the right one is a
> product decision, and a silently truncated document is the failure this section exists to end.

### Migration 039 — additive, and production needs it

`turns.document_id` (`ON DELETE SET NULL`) and `turns.document_name`.

> ### TWO COLUMNS, BECAUSE A TRANSCRIPT MUST SURVIVE THE DOCUMENT'S DELETION.
> `document_name` is a COPY. *"You attached Harbor-Kitchen-Employee-Policy-2026.pdf and I found
> seven problems in it"* stays true after the file is removed from Documents. With only a foreign
> key, deleting the document would silently rewrite history to *"you attached nothing"* — hence
> SET NULL rather than CASCADE, and hence the copy.

Both columns are nullable and every existing row is valid with both NULL, which is exactly what a
turn with no attachment is. The verify block **reads the delete rule out of `pg_constraint`**
rather than trusting the DDL, because CASCADE here would mean deleting a document erases the
conversation about it.

### The test, and what it proves

`npm run check:live -- --only attachment` drives the whole path as `testgamma`: upload →
`documents` row → review → ask, with `tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf`.

**Every assertion is a statement the fixture actually makes**, read out of the PDF rather than
taken from the brief — 25 at Ballard, 31 at Fremont, a 30-day card window, cards "issued per
establishment", a 180-day wait, 24-hour carryover, find-your-own-cover, a tip credit, $20.76.
Each is deliberately wrong in it, and an answer that never reached the document cannot produce
them.

```
✓ attachment/review   read as "Employee Handbook Addendum"
✓ attachment/tier     Tier 2, counted across both locations (25 + 31 = 56)
✓ attachment/errors   named 7 of 7
✓ attachment/persist  turn 1 carries "Harbor-Kitchen-Employee-Policy-2026.pdf"
```

> **One honest qualification on the tier.** The check requires "Tier 2" and the arithmetic, and
> both are present — but the answer is more careful than the brief was: it notes that Seattle
> counts **FTE, not headcount**, so 56 people could still average under 49 FTE, and it names the
> fact it would need to settle it. That is the product working as §3.3 intends, and the check is
> worded to accept it rather than to demand a flat assertion that would be less true.

### 2 — "Read as a Employee Handbook Addendum"

One site, `app/compliance/page.tsx`, now **"Read as: {classification}"**.

No article is used rather than choosing between *a* and *an*, because choosing correctly is not a
vowel test: *an SDS* starts with a consonant and *a US EPA permit* starts with a vowel. A colon
cannot be wrong. The classification comes from the model and is unbounded, so any fixed article
is wrong for some of its output.

**Reversal condition:** none for either. Both are defects; the tests are the record. The carry
rule is the one thing here that is a judgement — if re-sending documents proves too expensive on
real files, the reversal is a size threshold or an explicit "re-attach" control, and the
measurement to justify it is already in `ai_calls`.

---

## 130. BUILD ON THE CHEAPEST MODEL, AND THE MICRO-STEPS THAT KEPT BUYING THEMSELVES — 24 September 2026

Two things, and the second is why the first was asked for.

### The rule

**Build and test on the cheapest model. The real model is for judging output only.**
`CLAUDE.md` §3.4a. `.env.local` points `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT`,
`AI_MODEL_SUBSTEPS` and `AI_MODEL_SUMMARY` at `claude-haiku-4-5`; production is untouched because
those variables are **unset** there and it runs the code defaults.

A build session asks *"does this render"*, not *"is this true"*. The expensive model answers the
second question, and `npm run golden:facts -- --model claude-opus-5` is the one place that asks it.

> ### THE TRAP: `effort` IS REFUSED BELOW THE 5 FAMILY, AND IT IS `temperature` IN A MIRROR.
>
> Probed with one-token calls rather than recalled:
>
> ```
> claude-haiku-4-5 + output_config.effort = low|medium|high|xhigh|max
>   -> 400 invalid_request_error: "This model does not support the effort parameter."
> ```
>
> There is no "lowest level it accepts" — it accepts none. §3.4 already records that the 5 family
> **refuses `temperature`**; this is the same fact from the other side. `DEFAULT_EFFORT` is
> `medium` and the open call sent it unconditionally, so pointing the models at Haiku would have
> **400'd every research and checklist call**. `modelAcceptsEffort()` drops it, exactly as
> temperature is dropped, and logs that it did.

`DEV_MAX_SEARCHES=2` caps `web_search.max_uses` whenever `NODE_ENV` is not production. Every
source retrieved is ~4,500 input tokens replayed on each later turn (§128 J).

**No test hardcodes a model.** `scripts/run-golden.js` fell back to a literal `claude-sonnet-4-5`
in three places while reading `AI_MODEL` — a variable no task tier uses — so it ran the gate on a
model nobody had chosen. It resolves through `modelForTask('judgement')` now.

### Why it was asked for: micro-steps that regenerated on every page load

During the 23-24 September layout passes, **`substeps` went from zero ledger rows to 65 and cost
about $2 — in sessions that created no checklist and asked no question.**

The enqueue is `app/compliance/page.tsx:494`, the last statement of `openChecklist`, and it was
never the bug. The bug was one layer down:

> ### A GENERATED MICRO-STEP NEVER REACHED STORAGE.
> `runStepQueue` ended at `setSteps(...)` — React state — and nothing wrote the rows back to
> `checklist_items`. So `loaded`, which `openChecklist` reads from the database on every open,
> was empty every time; every item looked missing every time; and `stepStarted` is a `useRef`
> that dies with the page. **Opening a checklist after a reload re-bought all of it.**

The comment above `queueSteps` had claimed "never repeated, never lost" since Run 1. It was true
of the queue and false of the system, because the thing the queue consulted was never written.

**The fix is persistence, not another guard.** Steps are inserted as `checklist_items` rows with
`parent_item_index` set — the shape `openChecklist` already reads back — so the three existing
guards finally do what they always claimed. A failed write logs and clears `stepStarted`, so the
item can be retried rather than stranded with steps nobody can see again.

**Proved by opening the same checklist three times, each on a fresh page load:**

| | substeps calls | ledger total | sub-steps in storage |
|---|---|---|---|
| start | — | 166 | 0 |
| open #1 | **7** (one per item) | 173 | **41** |
| open #2 | **0** | 173 | 41 |
| open #3 | **0** | 173 | 41 |

Those seven ran on `claude-haiku-4-5` at about **$0.007 each**. Every `substeps` call writes an
`ai_calls` row — company, model, tokens, cost — so the next time this happens the ledger says so
on the day rather than two design passes later.

**Reversal condition:** the model rule is reversed by unsetting four variables — that is what it
is for. The persistence fix is not a preference and is not reversible: a generated step that is
not written down is a step that will be bought again.

---

## 131. DOCUMENTS, RUNS D-0 TO 2b — 25 September 2026

Documents, Runs D-0 to 2b (25 Sep 2026). The document scan is a new path, lib/documentScan.ts, one open model call with its own task 'document_scan' and variable AI_MODEL_DOCUMENT_SCAN falling back to the judgement tier; the old review path is untouched and still feeds the audit engine and the compliance attach card until they are rewired. Migrations 040 to 042 carry the contract: documents.status and source, document_scans, document_gaps, document_conditions, document_deadlines, company_labels, fact_proposals with document_id and a one-source CHECK, calendar_events.document_id, basis read-or-inferred on gaps and facts, and cited_sources distinct from billed searches. Measured: a scan's cost is almost entirely search rounds re-billing the context, not the document; one paid answer in five was being discarded by extractJsonText, fixed by a balanced-brace scan with the discarded answers as regression fixtures; the ledger counted refused searches, fixed to the API's billed count; a quote the model paraphrased is kept and flagged, never dropped; label feedback works only when one company's scans run one after another. Golden documents: six specs with answer keys written by the chat, seven fixtures rendered from their text and verified against the PDF text layer, judged by must-contain and must-not, never by count. Haiku's quality results are recorded and not acted on; the model bake-off comes after the module works.

---

## 132. DOCUMENTS, RUN 3 — 25 September 2026

Documents, Run 3 (25 Sep 2026). The Documents page reads document_index_v, one row per document joined to its current scan, folder and site, with display_status computed in SQL by kind and date. Uploads scan one after another through /api/document-scan; the Review button and the separate date-extraction call are gone from the page. The scan's JSON is constrained by a schema sent as output_config.format; the API refused the first shape three times (additionalProperties must be false; at most 24 optional fields; too many nullable fields), so every field is required and the empty string is the empty answer, mapped to null before storage. Scan rows are written only by the server: authenticated holds SELECT and no INSERT on the document_* tables, because RLS can say "your company" and cannot say "only the server", and these rows are the product's claim that a file was read; saveScan runs on the service role after ownership is proved on the caller's client. A document that fails before a scan row exists reads could_not_read, never Queued: a conclusion beats an absence. Four of seven fixtures lost their agency and one program turned current the moment the schema landed; recorded, not acted on, and the schema is now a switch so the bake-off can measure it.

---

## 133. DOCUMENTS, RUN 4 — 25 September 2026

Documents, Run 4 (25 Sep 2026). The report drawer is the workspace's drawer with ten sections read off six tables in one request; every action in it is free of model calls. Corrections are rows, never edits: document_corrections holds old and new values with a reason, the view prefers the newest correction field by field including in display_status, and the next scan is shown them as context. A dismissed gap is closed with its reason on the row and is read by the next scan; it never counts toward open gaps and is never deleted. Only a date whose kind is expiry may expire (048). The scan records which output path ran, and AI_SCAN_STRUCTURED turns the schema off only on the exact string false. Three defects found by the fixtures: an expiry matched by source line, an issue date read as an expiry, and fact quote checks computed and dropped, fixed by 047.

# Testing
**Version:** 5 · **Updated:** 12 September 2026
**Supersedes:** version 4 (12 Sep). Records the question-7 variance — the gate's
`non_blocking_unknowns` came back with three entries, then two, then zero on the same case —
as a (c) consistency probe rather than a bug to solve now. And replaces the recalled
"readiness numbers differed between runs" with the measured version from
`baseline-outputs/audits.json`: six audits of the same 272-item standard for the same company,
satisfied ranging 6 to 21. Version 4: (b) is no longer future — `npm run golden` exists, with
three cases and four verdicts of which SKIP is never a pass. Version 3 added the **2.2 manual
set** — including the unbuilt-industry
case, where a clean gate and an unanchored answer look identical on screen, because "do we know
enough about YOU" and "do we know enough about your INDUSTRY" are different questions and 2.2
answers only the first. Records that the golden runner now exists as `npm run golden`.
Version 2: golden-file case 001 gains two assertions beyond the
original one: the answer must draw on **no Oregon agency** (Reno to Philadelphia is entirely
federal — 22 of 192 live rows are in scope), and it must **say that origin and destination
state requirements are not covered** (neither Nevada nor Pennsylvania is in the library).
Records that assertion 2 was unfalsifiable before Phase 2.1 and is a `WHERE` clause now.

**Status: (a) is a standing obligation and starts now. (b) is specced in `TODO.md` 2.8 with
two cases written. (c) is not built and is deliberately bounded.**
**Related:** `AUDIT-CHECKS.md` · `HOW-WE-BUILD.md` §2 · `TODO.md` 2.8 · `CLAUDE.md` §3.10

---

## Why this file exists

Three different things get called "testing" here and they answer three different questions.
Conflating them is how a product ends up with a green build and a wrong answer.

| | Question | Who runs it | What it can conclude |
|---|---|---|---|
| **(a) Manual** | Is the right answer also a **convincing** one? | The owner, as a user | Anything — including things no script can see |
| **(b) Golden files** | Did the answer **change**? | CI, after any prompt/model/matching change | Only that output moved, and where |
| **(c) Unattended** | Is the system **self-consistent**? | An overnight agent | Consistency and shape. **Never truth.** |

`npm run check` is none of these. It answers *"does the code compile, pass its unit tests and
build"*. `AUDIT-CHECKS.md` is a fourth thing again — *"is the data behind the answers in a
state we would defend"*.

---

# (a) MANUAL — what the owner does as a user

**Two per feature, always, and the second one is the one that matters.**

**The perfect case.** Everything present, nothing missing, the happy path. It is not asking
*"is the answer correct"* — code review and golden files cover that. It is asking **"is the
right answer also a convincing one?"** A technically correct answer that a plant manager
would not act on has failed. Does it say which regulator, which document, what to do next?
Would somebody being inspected next week feel helped or hedged at?

**The edge case.** A missing document. An expired permit. Two handbooks that contradict each
other. A switch nobody has set. **Does the product say so, or does it paper over?** This is
where `CLAUDE.md` §5.1 and §6 are actually enforced — the rule that the product never asserts
anything about a document it did not read, and that `unknown` stays `unknown`.

**The edge case is where domain knowledge does work no script replicates.** A test script
knows whether a field is null. It does not know that a combination package's inner bottles
are not separately labelled, that an Oregon customer must be shown OAR 437 rather than 29
CFR, or that "we're below the Tier II threshold" does not answer the Oregon CR2K question.
Those errors are fluent, confident and invisible to every automated check on this page. They
are visible to somebody who has been inspected.

### This is a standing obligation, not a suggestion

**Every major piece of work ends with a short numbered list of things to click and ask** —
added to this file, in the same session, before the commit. It is step 12 of
`HOW-WE-BUILD.md` §2's loop.

Two per feature. Numbered. Specific enough to follow without thinking: which page, what to
type, what should come back. "Check the agency stuff works" is not a test.

---

# (b) AUTOMATED REGRESSION — the golden-file set

**`npm run golden`. Built 11 September 2026; `TODO.md` 2.8. Cases live in `tests/golden/`.**

**Status, 12 September: three cases, two of them exercising the determination gate.** 001 (the
2.5L bottle) proves it asks; 003 (Oregon minimum wage) proves it does **not** ask when the
facts are there; 002 predates the gate and is skipped by the runner with a reason rather than
counted as a pass.

**Run after every prompt change, model upgrade, temperature change, or change to requirements
matching** — i.e. everything in `CLAUDE.md` §3.1. Those are precisely the changes whose
effects are invisible in a diff.

**What a golden file is:** a saved question, the full response, the model and temperature, and
a `system_prompt_sha256` so a prompt edit is detectable rather than deniable. Plus `expected`
facts, each labelled by how well it is known — `primary-source-retrieved` or `unverified`.

**What it concludes: only that the output moved, and where.** A golden file cannot tell you
the new answer is worse. A human reads the diff. That is the point — it makes change
*visible*, which is the thing prompt work otherwise lacks entirely.

**The runner exists as of 11 September: `npm run golden`.** It reads every case in
`tests/golden/`, runs it against staging, and reports per-assertion PASS / FAIL / HUMAN / SKIP.
Three things about it are deliberate:

- **It rebuilds the gate prompt from `lib/determinationGate.ts` rather than holding a copy.**
  A copy would drift, and the drift would be silent because the tests would keep passing
  against the stale copy.
- **An assertion with no checker reports SKIP, never PASS.** A runner that silently passed
  what it could not check would be worse than no runner — `AUDIT-CHECKS.md`'s standard.
- **Assertions a script cannot judge report HUMAN** — "does it say Nevada and Pennsylvania are
  not covered" is read by a person, not matched by a regex.

The `system_prompt_sha256` in each case is a tripwire: when the prompt changes, the run says
so loudly and tells you every stored expectation was written against the old one. *(Proven by
falsifying a recorded hash and confirming it fired, then restoring it.)*

**Four verdicts, and three of them are not "pass".** `PASS` · `FAIL` · **`HUMAN`** for an
assertion a script cannot judge — *"does it say Nevada and Pennsylvania are not covered"* —
and **`SKIP`** for one with no checker implemented. **A SKIP is never reported as a pass**, and
the run says how many there were: a suite that silently passed what it could not check would
be the worst version of this file.

**It grows by one entry per failure found.** Every real-world wrong answer becomes a case, so
the same mistake cannot return quietly. Case 001 is the **2.5L bottle** — the original
failure, where the model enumerated past a missing packing group and attached $650–1,800 of
costs to a requirement that did not exist as stated. Case 002 is DOT shipping for isopropyl
alcohol drums, with two of seven facts checked against live eCFR text.

---

## Case 001 — three assertions, not one
*Spec extended 11 September 2026. The file is not written yet; `tests/golden/` holds only 002.*

**The shipment is Reno to Philadelphia. That is entirely federal.** DOT hazmat is 49 CFR and
applies in every state, so **the only library rows in scope are PHMSA's 15 and FMCSA's 7** —
22 of 192 live rows. The company is Oregon-based, and for this question **its jurisdiction is
irrelevant**: the goods never touch Oregon.

**Assertion 1 — the original one.** The gate asks for the SDS instead of enumerating past the
missing packing group. Packing group determines UN number, hazard class, limited-quantity
eligibility, packaging spec and label — five of the six things that went wrong.

**Assertion 2 — NEW. The answer must not draw on any Oregon agency.**

If Stage 2 returns all 31 Oregon-chemical agencies and the determination gate starts asking
Oregon OSHA questions about a Nevada-to-Pennsylvania shipment, **that is the same failure as
serving Oregon requirements to a Texas company, arriving from the other direction.** §3.2's
rule — *jurisdiction is always part of the match key* — is usually read as "do not under-serve
by getting the state wrong". This is the over-serving face of it: the state is right about the
company and wrong about the question, and the result is a plant manager working through
Oregon heat-illness and wildfire-smoke obligations before shipping a box.

**The check:**

```sql
-- Oregon-agency rows that a correct answer to case 001 must NOT cite.
select t.requirement_name, a.short_name
  from public.requirement_templates t join public.agencies a on a.id = t.agency_id
 where a.jurisdiction_level in ('state', 'county', 'city', 'local')
   and t.effective_to is null;          -- 91 rows today: 88 Oregon state, 3 Oregon local
```

**Assertion 3 — NEW. The answer must state that origin and destination state requirements are
not covered.**

**Neither Nevada nor Pennsylvania is in the library.** It holds 94 live Oregon rows and 98
federal ones, and nothing else. So the honest answer covers the federal rules **and says
plainly that state requirements at origin and destination are not covered.**

That is the coverage strip doing its job on a question where **the gap is real**, rather than
implying completeness by silence. An answer that gives the 49 CFR obligations and stops,
saying nothing about Nevada or Pennsylvania, reads as complete and is not — and it fails
`CLAUDE.md` §6 in the quietest available way, by omission rather than by assertion.

### Why this is 2.1 paying off in a way nobody planned

**Assertion 2 was unfalsifiable four days ago and is a `WHERE` clause today.**

Before Part C, every requirement had `agency_id = NULL`. "The answer drew on Oregon material
it should not have" was a judgement somebody had to make by reading the output and
recognising the content — which means it was only catchable by someone who already knew the
Oregon library well enough to spot a row from it. There was no column to test.

`agency_id` was assigned to serve Stage 2's scoping — bounding what the model is asked to
enumerate. It turns out to also make **the negative case checkable**: not "did the right rows
appear" but **"did the wrong ones stay out"**, which is the harder half and the one that
degrades silently. The same column answers both, and only one of them was the reason for
building it.

The general shape is worth keeping: **a structural column added for retrieval usually makes
some previously-editorial assertion mechanical.** It is the argument for finishing 6.5a — the
six empty agencies — ahead of things that look more visible.

### One document disagrees, and it is worth reading before writing the file

`CHEMICAL-OR-WA.md` §5.2, describing Stage 2 for this exact question, says:

> *"For the shipping question: DOT/PHMSA (transport), OSHA/state plan (workplace labeling),
> FMCSA (own fleet), and possibly the state fire authority for storage before shipment."*

That names **a state plan and a state fire authority as in scope**, which reads as a
contradiction of assertion 2. **It is not, and the reconciliation is the useful part:** §5.2
is written generically, and the state plan it means is *the state where the work happens*. For
a shipment originating in Reno that is **Nevada's** programme, not Oregon's — and Nevada is
not in the library, which is assertion 3.

So the precise rule is not "no workplace regime is in scope for a shipping question". It is
**"no *Oregon* agency is in scope for a shipment that never enters Oregon."** If case 001 is
ever rewritten as an Oregon-origin shipment, assertion 2 inverts and Oregon OSHA becomes
required rather than forbidden. **Write the case with the origin stated explicitly**, because
the assertion depends entirely on it.

---

# (c) UNATTENDED EXPLORATION — the overnight agent

Not built. **The boundary below is the whole design**, because it is what decides whether an
overnight run is useful or dangerous.

### It CAN

- **Run the golden files** and report which moved.
- **Run the audit sweep continuously** — every check in `AUDIT-CHECKS.md`, on a schedule,
  against staging. **Check 13 (the switch dependency graph) is the best-shaped one for this**:
  it needs no regulatory knowledge, it has a single correct answer, and the failure it detects
  is invisible to every other tool.
- **Property-test for CONSISTENCY without knowing the truth.** This is the largest and least
  obvious category, and it needs no regulatory knowledge at all:
  - the same question twice → the same answer
  - the same question phrased two ways → the same answer
  - **one fact changed → only the parts that depend on it move.** Change the state and the
    federal obligations should be identical. Change the employee count and the transport
    answer should not budge. A diff that spreads beyond the dependency is a finding.
  - a determination resolved → the requirements gated on it change, and nothing else does
- **Adversarially probe the known failure shapes** and confirm the product **asks** rather
  than guesses: a missing determination (does Stage 1 request the SDS?), an unreadable
  document (does it say it could not read it, per §5.1?), an unset switch (does it stay
  `unknown`?), expired evidence (does it refuse to satisfy?).

### It CANNOT

**Validate regulatory content. Not partly, not with a confidence score, not "flagging items
for review".**

An overnight run reporting *"194 requirements verified"* would be the **omniscient status
tracker in a lab coat** — the named anti-pattern of this project (`CLAUDE.md` §6), arriving
with a timestamp and a progress bar to make it look like process. A model checking another
model's regulatory output produces agreement, and agreement is not verification.

**Verification is the human step and stays one.** `AUDIT-CHECKS.md` check 1 is the reason,
and it is not an abstraction: **0 of 194 rows carry a `citation_url`, a `citation_quote`, or a
`source_checked_at`, and 0 are at `status = 'verified'`.** There is no artifact behind any of
them. An agent has nothing to check *against* — which is `CLAUDE.md` §3.3 exactly: excellent
against an artifact, unreliable from nothing. The overnight agent is the unanchored case by
construction.

What it may do at the edge of this line: **retrieve** a primary source and report that the
text does not contain what the row claims. That is retrieval, not judgement, and the output
is a queue for a person — never a `verified` flag.

### The question-7 input varies run to run, and that is a consistency probe waiting to happen

*Recorded 12 September 2026. Noted, not solved.*

The determination gate returns `non_blocking_unknowns`, and Stage 5's question 7 — *"does any
statement assume a fact the user did not provide?"* — checks the answer against it. **On the
same question, the same case and the same temperature, that list came back with three entries,
then two, then zero.**

**A critic asserting against a list that varies run to run is asserting against something
unstable.** It is not wrong on any single run; it is differently right each time, which is
harder to notice and harder to test. Whether this matters depends on how much weight question
7 ends up carrying — on the 2.5L artifact the critic found the unstated assumptions from the
answer text alone, without needing the list.

**This is (c)'s probe, not a bug report:** ask the same question twice and compare the
declared unknowns. Both answers cannot be right about what was left open.

### Why consistency testing earns its place here specifically

**The engine has a known consistency problem, and it is now measured rather than recalled.**
Readiness numbers differed between runs — recorded in the original diligence, before this
rebuild. **`baseline-outputs/audits.json` holds the evidence**: six audits of **ISO 9001:2015,
the same 272-item standard, the same company, across two days.**

| | satisfied | needs_info | needs_work | distinct documents cited |
|---|---|---|---|---|
| 24 Jul 16:17 | **6** | 49 | 217 | 11 |
| 24 Jul 16:45 | 9 | 54 | 209 | 16 |
| 24 Jul 17:26 | 7 | 26 | 239 | 15 |
| 25 Jul 16:57 | 15 | 74 | 183 | 18 |
| 25 Jul 17:03 | 13 | 68 | 191 | 19 |
| 25 Jul 17:04 | **21** | 69 | 182 | 19 |

**A 3.5× spread on the headline number, and 219 of 272 items citing no document at all in the
worst run.** Both cannot be right, and saying so needs no knowledge of ISO 9001 — which is
exactly why this class of test can run unattended. That is a system giving two answers
to one question, which needs no domain knowledge to detect and no regulatory truth to
adjudicate: **both answers cannot be right, and finding that costs nothing but machine
time.** `CLAUDE.md` §3.2 requires resolution to be deterministic — same inputs, identical
output, every time — so consistency testing is the direct check on a stated safety property,
and it is the one class of overnight work with no way to produce a false clean.

*(That finding predates this repository's documents and is carried in from the owner's
original diligence rather than read from the code. It should be re-measured against the
resolution engine once Phase 4.1 exists, and recorded here with a date.)*

---

# MANUAL TEST SET — 2.2, the determination gate
*Written 11 September 2026, the day it landed. `HOW-WE-BUILD.md` §2 step 12.*

**Unlike 2.1, this one you can see.** The gate runs on every `/api/chat` and `/api/audits`
request, and when it stops, a card appears where the answer would have been.

**Before you start:** confirm the dev server points at **staging** — you should be able to
sign in as *Test Alpha Chemical* (Hillsboro, Oregon) or *Test Beta Cannabis* (Portland).
`/api/chat` now requires a login, so a signed-out tab gets a 401 rather than an answer, and
that is the fix working rather than a bug.

### 1. The perfect case — does it ask, and is the question a good trade?

1. Sign in as **Test Alpha Chemical**. Go to `/compliance`, *Create* tab.
2. Ask, verbatim: **"We ship isopropyl alcohol from our Reno warehouse to a customer in
   Philadelphia, six 2.5L bottles to a case. What is the minimum labelling requirement for
   the bottles and for the case?"**
3. **Expected: an amber card, no checklist.** It should ask about the concentration or the
   packing group, offer to take the SDS, and list what that unlocks.
4. **The convincing test, not the correct one:** read the card as somebody with a shipment
   going out tomorrow. Does it read as a **trade** — *give me this, get those five things* —
   or as an obstacle? If the `unlocks` list is vague ("a more accurate answer"), the question
   is not earning itself.
5. **Type an answer in the box** — `II` — and send. You should get a checklist, not the same
   question again.
6. **Then upload an SDS instead** (`tests/golden/` case 002 has the text of one). The fact
   should now come from the document rather than from you.

### 2. The edge case — what the card looks like when it is WRONG

These are the four failure shapes. Each is worth deliberately provoking once.

1. **It asks twice for the same thing.** Answer the question, and if the same card comes
   back, that is the infinite-ask bug — **the one failure worse than a wrong answer**. The
   suppression rule in `lib/determinationGate.ts` is supposed to make this impossible; if you
   see it, stop and report it rather than working around it.
2. **It asks something it already knows.** Ask **"what minimum wage do we pay at our
   Hillsboro plant?"** If it asks where your site is, the gate has lost sight of `entities`
   (`DECISIONS.md` §35.2). It should answer.
3. **It asks three questions in one.** Read the question text: "What is the packing group,
   and do you use your own vehicles, and how many employees do you have?" is one `ask` object
   carrying three questions in a sentence. The schema caps the object, not the prose.
4. **It hedges in a checklist.** If a checklist step says *"if packing group II, order these;
   if III, order those"*, the gate let something through it should have asked about. The
   schema has no field for that, so it would arrive inside a `description` string.

### 3. The edge case with no gate opinion — an industry we have not built

**This is the one that is easy to miss, because everything on screen looks fine.**

1. Sign in as **Test Beta Cannabis**.
2. Ask anything real — **"what do we need in place to store and use butane for extraction?"**
3. **Expect a clean gate and a confident answer.** The gate will probably proceed: it knows
   the worksite is Portland, Oregon, and nothing about the question is missing a *company*
   fact.
4. **And the answer is unanchored.** All 25 of the cannabis coverage rows are at
   `row_count = 0`. **There is not one library row behind that answer** — it is the free
   enumeration mode `CLAUDE.md` §3.3 names as known-bad, and the gate has no opinion about it
   whatsoever.

**The two questions are different, and 2.2 only answers the first:**

| | Question | Answered by | State today |
|---|---|---|---|
| **About YOU** | do we know enough about this company and this shipment? | **the determination gate** (2.2) | ✅ built |
| **About YOUR INDUSTRY** | do we know enough about this vertical to answer at all? | **`industry_coverage`** (2.1) + the coverage strip (M6) | data exists, **nothing renders it** |

A gate that passes cleanly means *"nothing about you is missing"*. It does **not** mean
*"this answer is anchored"*. Those are answered by different tables, and today only one of
them is wired to anything. **Until the coverage strip exists, a confident cannabis answer is
indistinguishable on screen from a confident chemical one**, and only the second has 187
requirements behind it.

Repeat step 2 as **Test Alpha Chemical** — same gate behaviour, 187 rows behind it instead of
zero, and **nothing on the screen tells you which you are looking at.** That difference is
what M6 has to make visible, and noticing it is the point of this test.

### 4. The proceed path, which is easy to forget to check

Ask three ordinary questions in a row as Test Alpha Chemical and count how many produce a
card. **If it is more than one, the gate is asking too much** — and that failure is invisible
one answer at a time, because each question looks justified on its own
(`DETERMINATION-GATE.md` §7). It is also the direction that loses users: people abandon a
product that interrogates them, and they do not file a bug first.

### What none of these can tell you

Whether the gate asked for the **right** fact. It asks one question confidently either way,
and a plausible wrong question — asking about employee count for a shipping question — reads
exactly like a good one. `tests/golden/` case 003 covers the specific case where employee
count must not block; everything else is judgement.

---

# MANUAL TEST SET — 2.1, the agency list
*Written 11 September 2026, the day it landed on both environments.*

**Read this first: 2.1 built a spine, not a screen.** 33 agencies, 187 assignments and 56
coverage rows are all in the database and **nothing renders them.** `grep` finds no reader
for `agencies` or `industry_coverage` outside the loaders. So tests 1–2 are about whether the
foundation is real, and 3–4 are what to look for the moment M6 or the Workspace starts
displaying it.

**A test that "passes" today by showing nothing is not a pass — it is confirmation that the
UI work has not started.** That distinction is the point of writing these now.

### 1. The perfect case — does a company get the right regulators?

1. Confirm the dev server points at **staging** (`CLAUDE.md` §3.8 — staging company names
   differ from production's; you should see *Test Alpha Chemical* and *Test Beta Cannabis*).
2. Sign in as the chemical company. Ask the Workspace: **"Which agencies regulate my
   facility?"**
3. **Expected, once anything reads the table:** 31 agencies — 14 federal, 14 Oregon, 3 local.
   Oregon OSHA must be there. Federal OSHA may be, as baseline, but the answer must say
   **Oregon OSHA enforces**.
4. **The convincing test, not the correct one:** does the answer name the regulator in the
   words a plant manager uses — *"the DEQ inspection"*, *"the fire marshal visit"* — or does
   it list slugs? Does it say what each one wants from you?
5. **The one to watch for:** if the answer cites **29 CFR** to this Oregon company for a
   workplace-safety obligation, that is the §1.2 failure in production. The library still
   holds 49 rows whose `citation` is the federal analogue; the assignment is right and the
   *displayed citation* is not (`AUDIT-CHECKS.md` check 2).

### 2. The edge case — does it admit what it does not have?

1. As the chemical company, ask something that lands on an **empty** agency:
   **"What do I owe the Oregon Department of Revenue?"**
2. **`OR-DOR` is in scope and has ZERO requirements behind it.** The honest answer is *"Revenue
   regulates you and we have not built that coverage yet"*. The failure is a confident answer
   assembled from model memory with no library row behind it — §3.3's unanchored mode, which
   is exactly what the coverage strip exists to prevent.
3. Repeat as the **cannabis** company with anything at all. **All 25 of its coverage rows are
   at 0.** Every answer it gives today is unanchored. Does the product say so?
4. Ask about the **Corporate Activity Tax** specifically. If a confident answer comes back
   with a threshold and a filing date, that is a fabricated specific: it is not in the
   library, so it came from the model, and §6 says a number like that must carry a
   verification badge.
5. **Then ask the same two questions twice, in different words.** Any difference between the
   answers is a finding on its own (see (c) above) and needs no regulatory knowledge to call.

### 3. The edge case that has no UI yet — the coverage strip

The strip described in `CLAUDE.md` §6 —
`OSHA ✓verified · DEQ ✓verified · Local fire ◐partial · ODA ○not built` — **does not exist.**
When it is built, the manual test is:

1. **Every one of the 56 rows must render as `not built`.** Not one is `generated` or
   `verified`, because no requirement in the library has been checked against a source.
2. **The 32 empty rows must be visible**, not filtered out. A strip that shows only the
   agencies with content is the omniscient status tracker with a display filter.
3. `OR-OSHA` must read **53**, not 54 — the retired silica parent is excluded
   (`AUDIT-CHECKS.md` check 4).

### 4. The edge case to try the day requirements render — split rows

1. Find the **silica** requirement for the chemical company. There are **five** rows: one
   retired parent and four live children.
2. **The customer must see four, not five.** If the retired parent appears, a superseded rule
   is being shown alongside its replacements and the customer cannot tell they are the same
   obligation.
3. Same shape for the **boiler** requirement: one retired parent, two live children, **two**
   shown.

### What none of these four can tell you

Whether the 187 assignments are **right**. A requirement filed under the wrong agency renders
perfectly, counts correctly and reads normally — `DECISIONS.md` §33 records six that nearly
were. The only defences are the mapping table being readable by a person and the projection
being read by target before it was applied. **No manual test recovers that**, which is why
the review happened before the write rather than after.

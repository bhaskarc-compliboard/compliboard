# Testing
**Version:** 2 · **Updated:** 11 September 2026
**Supersedes:** version 1 (11 Sep). Golden-file case 001 gains two assertions beyond the
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

Specced in `TODO.md` 2.8. Lives in `tests/golden/`.

**Run after every prompt change, model upgrade, temperature change, or change to requirements
matching** — i.e. everything in `CLAUDE.md` §3.1. Those are precisely the changes whose
effects are invisible in a diff.

**What a golden file is:** a saved question, the full response, the model and temperature, and
a `system_prompt_sha256` so a prompt edit is detectable rather than deniable. Plus `expected`
facts, each labelled by how well it is known — `primary-source-retrieved` or `unverified`.

**What it concludes: only that the output moved, and where.** A golden file cannot tell you
the new answer is worse. A human reads the diff. That is the point — it makes change
*visible*, which is the thing prompt work otherwise lacks entirely.

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
  against staging.
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

### Why consistency testing earns its place here specifically

**The engine has a known consistency problem.** Readiness numbers differed between runs —
recorded in the original diligence, before this rebuild. That is a system giving two answers
to one question, which needs no domain knowledge to detect and no regulatory truth to
adjudicate: **both answers cannot be right, and finding that costs nothing but machine
time.** `CLAUDE.md` §3.2 requires resolution to be deterministic — same inputs, identical
output, every time — so consistency testing is the direct check on a stated safety property,
and it is the one class of overnight work with no way to produce a false clean.

*(That finding predates this repository's documents and is carried in from the owner's
original diligence rather than read from the code. It should be re-measured against the
resolution engine once Phase 4.1 exists, and recorded here with a date.)*

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

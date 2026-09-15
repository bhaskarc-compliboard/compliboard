# Testing
**Version:** 16 · **Updated:** 15 September 2026
**Supersedes:** version 15 (13 Sep). **Case A has a defect in its own precondition** — a company
with nothing established cannot show a count MOVING, only a list being CREATED, so the case cannot
observe what it was written for. Run for the first time on a new fixture (Test Gamma Solvents):
**21 applies of 200 created, 0.5 s, 7 questions unblocked.** That is the fresh-company figure; **a
genuine delta figure does not exist yet.** Case A should split into A1 (creation) and A2
(movement). Version 15: The 4.3/M6 manual set is recorded as **RUN, by a person, in a
browser** — not as written. It found two things no automated check could, on its first attempt:
**Case E crashed on its first fixture** (a 500 for every uncomputed company, which on production
was all ten), and **Case G's domain half surfaced the 22 clauses that can never be true.**
Version 14: Records Case F **in the data** — Beta ends at open 0, closed 1,
the seeded obligation closed rather than deleted — and that Beta resolving to zero made Case I's
second empty state render **for the first time**, which was unreachable before 023. Version 13: Records the **first run: E, F, G and I pass functionally.**
Case E found a 500 on its first fixture (migration 023), and **Case G's domain half found the
library defect that 199 expression reviews had missed** — the argument for the manual set,
demonstrated. Version 12: Adds the **manual set for Phase 4.3 and M6** — five cases,
**and the visual half 7.2a deferred is now written**, marked `SEE` rather than merged into that
section. Case E carries an ordering trap that is real and unrecoverable: the first GET is what
fires the lazy write, so opening the screen destroys the before-state. Case F is the only fixture
in the project where a hand-made obligation meets the writer, and tests that history is closed
rather than deleted. Case G's second half is the one no script can do — whether a fact is actually
sufficient to rule a requirement out. Records what none of them can tell you: **0 of 205
requirement templates have been checked against a published source.** Version 11: The **7.2a manual set is narrowed to API and state**, with
the visual half explicitly deferred to M6 and the reason stated in the set itself: a case that
always fails for a reason unrelated to what it tests trains whoever runs it to skip failures.
Version 10 added the **manual set for Phase 7.2a**, written before the UI
exists so it tests what was meant rather than what got built — four cases, each naming what it
is blocked on, and each with what the failure looks like. Case A is the one that matters: one
answer must unblock two questions AND move 19 obligations in the same interaction, and the four
distinct ways that goes wrong have four distinct causes. Version 9 added **`npm run test`'s three
guards** — no `.only`, nothing
skipped, and a committed floor the total may rise above but never fall below, both refusals
proved by breaking the suite. Records the actual count history (**167**, never 100 or 106) so
the question does not have to be re-asked. And records that the **golden document cases are
blocked on a decision, not on effort**: a case needs a committed document and the only
candidates are customer-uploaded files. Version 8 added **`npm run mutation`** — nine deliberate breakages of
the resolution engine, all nine caught, because a suite that has only ever passed is
consistent with a suite that asserts nothing. Records what a wrong implementation looks like
for each property, which is the part a passing test cannot tell you. Version 7 added **the expression layer's three invariants** — a new
class, because they are tests of a body of DATA and a violation is silent: a condition naming a
switch nobody defined is valid JSON that evaluates to `unknown` forever. Records that the
manual test for this layer is a read rather than a click, and the two known-failing cases kept
visible on purpose. Version 6 supersedes version 5 (12 Sep). Adds an assertion CLASS rather than a case — every
threshold in an expression must be quoted from the rule's own text, never derived — which
caught a figure imported from a neighbouring rule on its first run. Version 5 recorded the
question-7 variance — the gate's
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
federal — 22 of 200 live rows are in scope), and it must **say that origin and destination
state requirements are not covered** (neither Nevada nor Pennsylvania is in the library).
Records that assertion 2 was unfalsifiable before Phase 2.1 and is a `WHERE` clause now.

**Status: (a) is a standing obligation and starts now. (b) is specced in `TODO.md` 2.8 with
two cases written. (c) is not built and is deliberately bounded.**

---

## The suite may grow. It may not silently shrink — `npm run test`

Added 12 September 2026. `npm run test` is `scripts/test-guard.js`, which runs the suite and
then refuses three things:

| Guard | Refuses |
|---|---|
| **no `.only`** | a stray `.only` narrows a run to one test and reports **green** |
| **0 skipped, 0 todo** | a skipped case disappears into a count nobody reads |
| **a committed floor** | the total may rise above it, never fall below |

**Both refusals were proved by breaking the suite on purpose**, then restoring it:

```
test-guard: .only found in jurisdiction.test.ts — the suite would report green
            having run almost nothing.
test-guard: 1 skipped
```

**Why this is the harness doing the thing the checks exist to prevent.** Check 14 records that a
checker weaker than its assertion is indistinguishable from a passing suite. A narrowed *run* is
the same failure one level up: nothing errors, nothing is red, and the only signal is a number
in a summary line. `HOW-WE-BUILD.md` §3's rule — a validator that has only ever said PASS is
untested — applies to the runner as much as to anything it runs.

**On the count itself**, recorded because it was queried: the suite has been **1 → 37 → 58 →
119 → 133 → 164 → 167**, each step after adding tests, and three consecutive runs on 12 Sep gave
**167 · 0 skipped · 0 todo**. Per file: `appliesExpression` 58 · `jurisdiction` 24 · `resolve`
40 · `sdsExtraction` 14 · `switchDetermination` 31. **No run in this project has reported 100 or
106.** The floor is committed so the question does not have to be re-asked.

---

## Manual set — Phase 7.2a, the ask path

*HOW-WE-BUILD step 12. Written 13 September 2026, while the work was fresh.*

> ### ⚠️ THIS SET IS DELIBERATELY PARTIAL, AND IT IS NOT INCOMPLETE.
>
> **It tests the API and the state change. It does NOT test what a user sees.** Every case below
> is verified by calling an endpoint and querying a table — not by clicking a screen — because
> **the screen does not exist and belongs to M6.**
>
> **Why that distinction is made explicitly rather than left implied.** A case reading *"click
> Requirements and see 19 obligations"* would fail today for a reason that has nothing to do
> with the ask path: there is no Requirements screen. A manual set carrying cases that always
> fail trains whoever runs it to skip failures, and a skipped failure is how a real one survives.
>
> **So the visual half is deferred to M6's manual set, not dropped.** When M6 lands, each case
> below gains a "and the screen shows" half. The next person adding here should add API-and-state
> cases to this section and visual cases to M6's — **and should not merge them**, because the two
> halves fail for different reasons and get fixed by different people.

### Case A — the first answer. THE ONE THAT MATTERS.

**Do this.** A company with nothing established.

```
GET  /api/switches/ask                       → note the first question and `remaining`
POST /api/switches/answer  { has_employees, true }
GET  /api/switches/ask                       → compare
```

**Perfect — four assertions, all from the API and the database:**

1. The POST returns `written: true`, `evidence_class: 'stated'`, `state: 'known'`.
2. **Its `unblocked` array has exactly two entries** — `employee_count` and
   `site_employee_count`, which depend on `has_employees`.
3. `select count(*) from company_switches where switch_id='has_employees'` is **1**, with
   `user_locked = true` and a `basis` whose `kind` is `user_answer`.
4. **The obligation count moves.** Against the real library, `has_employees = true` moves
   **19 obligations** from `unknown` to `applies` for a two-site company:
   `select status, count(*) from obligations where company_id = … group by status`.

**What it looks like when it is wrong — four symptoms, four different causes:**

| Symptom | Cause |
|---|---|
| `unblocked` is **empty** | The recompute did not run. Children only become askable once the parent is known (§54) — the exact failure the recompute exists to prevent, and the first interaction in the product returns nothing |
| `unblocked` has two entries but `obligations` is unchanged | The answer was written and `close_and_replace_obligations` was not called. **`obligations_stale: true` in the response is the honest signal**; a caller ignoring it serves a stale list with no warning |
| `unblocked` has **more than two** | The unlock cascaded. §54 is one level — a grandchild from one click is the too-much-asking failure `DETERMINATION-GATE.md` refuses |
| The obligation count **falls** | **Stop.** Adding a fact can only settle an open question. Measured across every pair of states: **zero** `applies → does_not_apply` transitions |

### Case B — blocked, and excluded, are different

```
GET /api/switches/ask     → with nothing established
```

**Perfect:** the response contains blocked questions **with a non-empty `blocked_by`** naming
the switch they wait on, alongside the answerable ones. `remaining` counts both.

**Wrong:** blocked questions are absent from the payload. A caller cannot distinguish *"six
questions exist"* from *"thirty exist and six are answerable"*, and the ordering — which comes
from the dependency graph, not from a preference — becomes invisible.

**The edge case, and this is where domain knowledge does work no script replicates.**

```
POST /api/switches/answer  { hazardous_chemicals_present, false }
GET  /api/switches/ask
```

The **21 switches that depend on it must be absent entirely — not blocked.** A site with no
hazardous chemicals is not *pending* a lead-exposure answer; the question does not apply to it.
Returning them as blocked puts them back in the queue the moment anything else changes. A
chemical-industry reader sees this instantly; a test counting payload length does not.

### Case C — changing an answer you already gave

```
POST /api/switches/answer  { hazardous_chemicals_present, true }
POST /api/switches/answer  { hazardous_chemicals_present, false }
select basis from company_switches where switch_id = 'hazardous_chemicals_present';
```

**Perfect:** `basis->>'previous_value'` is `'true'`, `basis->>'kind'` is `user_answer`, and
`basis->>'question'` holds the question as asked. **The previous value is a FIELD, not a
sentence** — so *"which switches did this customer change this week"* is a query (§49, §50).

**Wrong, and the second is worse:**

- No `previous_value`. A requirement list that moved has no explanation on the row, and a
  correction is indistinguishable from an unexplained change.
- **A later document overwrites it.** A person's answer is `user_locked` and no automatic pass
  may replace it — **and that is enforced in one library module and nowhere in the database.**
  Zero policies, zero constraints, zero triggers reference `user_locked` (check 24, `TODO.md`
  7.2c). **Until that trigger exists this case is the only thing standing between a stated fact
  and an inference**, so it is run after every change to any route that writes
  `company_switches`.

### Case D — a question that must never be asked

```
GET /api/switches/ask   → assert `hazwaste_generator_category` is absent
```

It is a monthly calculation, not a fact anyone holds. **Wrong:** it appears. A user asked to
state their generator category will guess, and a guess stored as `stated` with
`user_locked = true` outranks every later calculation.

---

## Manual set — Phase 4.3 (the obligation writer) and M6 (the requirements screen)

*HOW-WE-BUILD step 12. Written 13 September 2026, after both landed on staging and 022 landed on
production.*

> ### THE VISUAL HALF IS NO LONGER DEFERRED.
>
> 7.2a's set above is API-and-state only, and says so, because the screen did not exist. **It does
> now.** Each case below that carries a **`SEE`** block is the half that was owed. They are written
> here rather than merged into 7.2a's section for the reason that section gives: the two halves
> fail for different reasons and get fixed in different files.

**Both fixtures are on staging. Confirm the dev server points at staging before starting** —
the two company names below do not exist on production (`CLAUDE.md` §3.8).

| Fixture | Facts | Entities | Obligations | Computed |
|---|---|---|---|---|
| **Test Alpha Chemical** | 16, all `user_set` | 2 | 221 open | yes |
| **Test Beta Cannabis** | 0 | 1 | 1 open, hand-seeded | **never** |

---

### Case E — the first GET writes the list. THE ONE THAT MATTERS FOR 4.3.

> **⚠️ ORDER MATTERS, AND THE TRAP IS REAL: LOOKING IS WHAT FIRES IT.** The write happens on the
> first `GET /api/obligations`, so **step 1 must be run before anything opens the screen.** Open
> `/requirements` for Beta first and the before-state is gone, unrecoverably, and the case can
> only be run again by reverting `obligations_computed_at` to NULL by hand.

**Do this.** Log in as **Test Beta Cannabis** — the company that has never been computed.

```sql
-- 1. BEFORE. Run this FIRST.
select obligations_computed_at,
       (select count(*) from obligations o where o.company_id = c.id) as obligations
  from companies c where c.name = 'Test Beta Cannabis';
-- expect: NULL, 1
```

```
-- 2. Now open /requirements. Time it roughly — it computes inside the request.
```

```sql
-- 3. AFTER.
select status, count(*) from obligations
 where company_id = (select id from companies where name = 'Test Beta Cannabis')
   and applicable_to is null group by status;
```

**Perfect — five assertions:**

1. `obligations_computed_at` is **no longer NULL**.
2. The page returned in a few seconds, not a minute. **Alpha's 221 took 1.95 s across 2 entities**
   (`DECISIONS.md` §62). Beta has one entity and should be faster. **If this feels like a wait
   rather than a page load, that is the reversal condition in §62 arriving — report the number.**
3. **Reload the page. The counts do not change and nothing is re-opened:**
   ```sql
   select count(*) from obligations
    where company_id = (…) and applicable_to = current_date;   -- the closures from this reload
   ```
   A second run must report `opened: 0, unchanged: N`. **If the numbers grow on every reload,
   `close_and_replace_obligations` is inserting rather than matching**, and every refresh is
   quietly doubling a customer's compliance record.
4. **A cannabis company must not receive Oregon chemical-manufacturing rows.** Jurisdiction and
   industry are both part of the match key (`CLAUDE.md` §3.2), and this is the fixture that can
   catch it, because Alpha cannot:
   ```sql
   select count(*) from obligations o join requirement_templates r on r.id = o.requirement_template_id
    where o.company_id = (…) and not ('cannabis' = any(r.industries));   -- expect 0
   ```
5. **`resolved_by` is `computed_by_code` on every row.** Never `ai`. One query settles it, and it
   is the §3.2 line the whole architecture rests on:
   ```sql
   select resolved_by, count(*) from obligations where company_id = (…) group by 1;
   ```

**`SEE` — the screen, same interaction:** three section headings with **no counts in them**, a
coverage strip stating what is verified and what is not, and — because Beta has answered nothing —
**the questions section is the largest.** If `applies` is the largest section for a company with
zero recorded facts, something is asserting obligations from no evidence.

| Symptom | Cause |
|---|---|
| `computed_at` set, obligations still 1 | The write ran and wrote nothing. Beta's industry has no library rows — a real, reportable coverage gap, not a bug. Check `industry_coverage` before filing it |
| Counts grow on every reload | The uniqueness index is not matching. §16's `UNIQUE … NULLS NOT DISTINCT` is what makes a NULL `entity_id` collide with another NULL; if that index is gone, every reload duplicates |
| Any row with `resolved_by = 'ai'` | **Stop and report.** Layer 3 is code. This is the one failure in this file that is not a bug but an architectural breach |
| Chemical requirements on a cannabis company | The match key lost industry or jurisdiction. Silent and dangerous — §3.2 names it explicitly |

---

### Case F — the pre-existing obligation must be CLOSED, never deleted

**Why this case exists.** Beta carries **one obligation that predates the writer** — *"Adverse-reaction
allegation records"*, `status = applies`, `resolution_rationale` NULL, seeded by hand. The lazy
write in Case E runs `close_and_replace_obligations` over it. **This is the only fixture in the
project where a hand-made row meets the writer**, and it tests the property the product is sold on:

> *"We were subject to this from March 2024 to January 2026"* is the history the product exists to
> preserve. **Obligations are marked, never deleted** (`CLAUDE.md` §3.2).

**Do this.** After Case E, against Beta:

```sql
select status, applicable_from, applicable_to, resolution_rationale
  from obligations o join requirement_templates r on r.id = o.requirement_template_id
 where o.company_id = (…) and r.requirement_name = 'Adverse-reaction allegation records';
```

**Perfect — the row is STILL THERE.** Exactly one of two shapes, and both are correct:

- **Superseded** — two rows: the old one with `applicable_to = today`, and a new open one.
- **Closed** — one row with `applicable_to = today` and no replacement, because the requirement
  is not in Beta's resolved set.

**Wrong — and this one is silent:** the query returns **zero rows.** The history was destroyed and
nothing anywhere records that it existed. **There is no DELETE policy on `obligations` and the
function contains no DELETE**, so a zero here means something outside both is removing rows and
must be found before anything else ships.

---

### Case G — every claim on the screen traces to a fact, and `does_not_apply` names it

**Do this.** Log in as **Test Alpha Chemical** and open `/requirements`. Open the
**`does_not_apply`** section and read ten rows.

**Perfect.** Every one reads in this shape, with a real switch name and a real value:

```
Ruled out by: industrial_stormwater = false.
Ruled out by: hazwaste_generator_category = vsqg.
Ruled out by: air_permit_required = none.
```

**39 of 39 do this today.** The assertion is not "most of them" — **it is every one**, because a
`does_not_apply` with no named fact is the one thing §3.2 forbids outright: a clear produced by
absence of evidence rather than by contradicting evidence.

```sql
-- the machine-checkable half of the same assertion
select count(*) from obligations
 where company_id = (…) and status = 'does_not_apply' and applicable_to is null
   and resolution_rationale !~ '^Ruled out by: [a-z_]+ = ';   -- expect 0
```

**And the domain half, which is the part no query can do.** Pick the three rows whose switch you
know best and ask: **is that fact actually sufficient to rule that requirement out?**
`industrial_stormwater = false` removing a DEQ 1200-Z obligation is right. The same fact removing a
spill-response requirement would be wrong, and would look identical on screen. **This is the
case where domain knowledge does work no script replicates** — it is the reason the manual set
exists at all.

| Symptom | Cause |
|---|---|
| A row says only *"does not apply"* with no fact | The rationale is being generated instead of composed. §3.2's rule is that the evidence is **recorded**, not described |
| A rationale names a switch that is not in the list of 95 | The trigger references a fact the library does not carry. That is audit check 19, and it is a library defect surfacing as a screen symptom |
| A fact rules out something it should not | **The most valuable failure in this file.** Nothing automated can find it. Report the requirement and the switch — the fix is in `applies_expression`, not in code |

---

### Case H — the twelve rows waiting on quantities, and the button behind them

**Why this case exists.** It shipped wrong twice in two days, both times found by looking at the
screen and by nothing else (`DECISIONS.md` §61, audit check 26). **`resolve()` was correct both
times.**

**Do this.** As Alpha, open the questions section and find the rows for **DEA List I chemical
registration**, **PSM — management of change**, **EPCRA emergency-planning notification**.

**Perfect — three assertions, all visual:**

1. Each says **"Waiting on your chemical inventory — we need the quantities you keep on site, not
   just the safety data sheets."**
2. Its button says **"Add your chemical inventory"**, not "Answer the question".
3. **Scroll the whole questions section: no row anywhere says "we cannot say yet" and then stops.**
   Every one names something. `124 + 12 = 136`, and the third bucket is empty.

**Why the wording is worth reading rather than skimming.** A customer who uploads their entire SDS
binder and sees nothing move concludes the product is broken. **The sentence exists to say the
upload was not wasted and a different thing is needed** — quantities are not in an SDS. If it
reads as a complaint about their file, it is wrong (§5.1).

| Symptom | Cause |
|---|---|
| A row says "Waiting on:" with nothing after it | `factsNeeded` is empty and `inventoryNeeded` is not being read. This is the exact defect of 13 Sep, returned |
| Those rows offer "Answer the question" | The action is fixed by status again rather than chosen from what is missing |
| A row names neither | **The interesting one.** A requirement's trigger names a fact that is in no question list and no inventory list — a library gap, not a screen bug. Report the requirement name |

---

### Case I — the empty state, which is TWO claims and only one of them can be true

**Why this case exists.** `renderEmptyState()` took no argument until 13 Sep and always said *"we
have not worked out your requirements yet."* That was true while nothing wrote obligations. **After
4.3 it is false for the case that matters**: a company whose resolution genuinely produces nothing
would be told nothing had been computed. §5.1 — an empty state is a claim and it has to be true.

**Do this.** There is no fixture for the second state, and **making one is the point of the case**:

```sql
-- a company that has been computed and resolved to nothing.
-- Create it on STAGING ONLY, by signing up a business in an industry with no library rows.
select industry, jurisdiction, status from industry_coverage order by status;
```

**Perfect:**

- A company **never computed** reads *"We have not worked out your requirements yet. This is not a
  result."*
- A company **computed with zero rows** reads *"We worked out your requirements and found none that
  apply to you. That is a result… please tell us if it looks wrong."*
- **Neither ever reads as a clean bill of health.** No "compliant", no "all set", no "no action
  needed". The omniscient status tracker is a named anti-pattern here and was removed once already
  (`CLAUDE.md` §6).

**And the invitation to disagree is not politeness.** Zero applicable requirements for a real
manufacturer is far more likely to be our coverage gap than their good fortune, and the sentence
has to make that easy to say.

---

### ⛔ CASE A HAS A DEFECT IN ITS OWN PRECONDITION — 15 September 2026

**Case A's precondition is *"a company with nothing established"*. Its assertion is *"the
obligation count moves"*. Those cannot both hold.**

Run for the first time on **Test Gamma Solvents** — chemical-manufacturing, Oregon, zero facts,
created 15 Sep because neither existing fixture matched (Alpha had already answered
`has_employees`; Beta matches zero library rows):

```
BEFORE: facts 0 · obligations 0 {}
POST { has_employees, true }   as testgamma@example.com, 0.5s
  obligations AFTER : 200  {"unknown":178,"applies":21,"undetermined":1}
  persisted         : {"closed":0,"opened":200,"received":200,"unchanged":0,"open_total":200}
  UNBLOCKED (one level, §54): 7
  ask: READY 43 -> 49 · BLOCKED 38 -> 31
```

> **On a company with no obligations, one answer does not MOVE a count — it CREATES the list.**
> `opened: 200, unchanged: 0, closed: 0`. There is no before to differ from, so **the case cannot
> observe the thing it was written to observe.**

**Two numbers, and they must not be conflated:**

| | |
|---|---|
| **21 of 200 created** | the **fresh-company** figure. Measured 15 Sep. First measurement of anything here |
| **a genuine delta** | **does not exist yet.** No measurement has ever shown `closed`/`opened` against a non-empty baseline |

**Neither replaces 19 or 23**, and neither of those was ever a measurement: 19 is this case's own
expectation, written before the endpoints existed; 23 appears in no artifact at all
(`DECISIONS.md` §65, seventh instance).

**THE FIX IS TO THE CASE.** A case testing *"what does one answer move"* needs a company that
**already has obligations**. **Test Gamma is now that company** — it has been computed once — so
the case is runnable in its intended form on the **next** answer, not this one. Case A should be
split:

- **A1 — the first answer.** Precondition: nothing established. Asserts **creation** — a list
  comes into existence, `opened = N`, `closed = 0`, and `unblocked` is non-empty.
- **A2 — a subsequent answer.** Precondition: obligations already computed. Asserts **movement** —
  `closed` and `opened` both non-zero against a known baseline.

### RESULT — RUN, 13 September 2026, in a browser, by a person

> **This set is recorded as RUN, not as written.** The distinction is the point of the file: a
> manual set that has never been executed is a plan, exactly as an audit check with no recorded
> answer is a plan (`AUDIT-CHECKS.md`). **Two of the five found something no automated check
> could, on the first attempt.**

**What it found, and neither was predicted:**

**1. Case E crashed on its first fixture.** `/api/obligations` returned **500 in 645 ms** for the
first non-chemical company the writer had ever seen. The route connects as the caller;
`close_and_replace_obligations` and `substance_inventory` were `service_role`-only, so the first
write was refused by Postgres. **It had never run through its own route** — Phase 4.3's 1.95 s and
221 obligations were measured by a script holding the service-role key, which set
`obligations_computed_at` and made every later request skip the write. **On production that was
all ten companies.** Fixed by migration 023. `DECISIONS.md` §63.

**2. Case G's domain half surfaced two library-quality shapes.** Ten minutes of reading the
rendered rows found three kinds of wrong rule that 199 expression reviews had not, and the sweep
it prompted found **22 of 216 switch clauses that can never be true** — a large-quantity generator
receives **zero** hazardous-waste obligations and is told so in a confident sentence.
`DECISIONS.md` §64, `AUDIT-CHECKS.md` check 28, work is `TODO.md` 6.4c.

**Neither is reachable by any automated check**, and both were found on the first run. That is the
argument for this file, demonstrated rather than asserted.

### RESULT — first run, 13 September 2026

**Cases E, F, G and I: PASS, functionally.** Run in the browser against staging by the owner,
after migration 023.

| Case | Result |
|---|---|
| **E** — first GET writes the list | **pass** — the write fired on first GET, the reload was idempotent |
| **F** — pre-existing obligation closed, never deleted | **pass** — the seeded row was **closed**, not removed |
| **G** — every claim traces to a fact | **pass mechanically** — every `does_not_apply` names a switch and a value, with a correction affordance. **See below for the domain half** |
| **I** — the empty state is two claims | **pass** — both sentences render correctly |
| **H** — the twelve inventory rows | not re-run; last measured 124 / 12 / 0 on Alpha |

**Case F, proved in the data rather than on screen.** Beta after the run: **open 0, closed 1.**
The hand-seeded *"Adverse-reaction allegation records"* row carries `applicable_to`, not deletion.
And Beta resolves to **zero** obligations — all 200 live library rows are
`chemical-manufacturing` — so Case I's second sentence, *"we worked it out and found none that
apply"*, **rendered for the first time.** It had never been reachable before 023, because the
route returned 500 before it could be shown.

**Case E found the 500 that migration 023 fixed** — on its first run, its first fixture, against
the first non-chemical company the writer had ever seen (`DECISIONS.md` §63).

> ### AND CASE G's SECOND HALF DID EXACTLY WHAT IT WAS WRITTEN TO DO.
>
> The case says: *"this is the case where domain knowledge does work no script replicates."*
> **Ten minutes of reading the rendered rows found three shapes of wrong rule that 199 expression
> reviews had not**, and the sweep it prompted found that **22 of 216 switch clauses can never be
> true** — a large-quantity generator receives zero hazardous-waste obligations and is told so
> confidently. `DECISIONS.md` §64, `AUDIT-CHECKS.md` check 28, and the work is `TODO.md` 6.4c.
>
> **This is the argument for the manual set, demonstrated rather than asserted.** Every automated
> check passed. The mechanism was correct at every layer. What was wrong was a claim about the
> world, and the only instrument that detects that is a person who knows the subject, reading a
> sentence the product actually said.

### What none of these five can tell you

- **Whether the requirement rows themselves are right.** Every case above tests that the machinery
  resolves, persists and renders correctly. **`verified_at` is set on 0 of 205 requirement
  templates and `source_checked_at` on 0** — so a perfectly-resolved obligation may still point at
  a rule that misstates the law. The coverage strip says this on every screen; these cases do not
  test it and cannot.
- **Whether the switch values are true.** 16 facts, all `user_set`. If a customer answers wrongly,
  everything downstream is confidently wrong and every case here still passes.
- **What happens at scale.** 2 entities, 221 obligations. §62's reversal condition is about a
  company with many more.
- **Anything about production.** No production company has computed obligations
  (`obligations_computed_at` is NULL for all 10). Every case here runs on staging.

---

## Golden document cases — specified, blocked on one decision

`docs/SWITCH-DETERMINATION.md` §6 has the full shape. Summarised here because this is where
someone looks for what a test is:

```
tests/golden-documents/<case>/
  source.pdf          the document, committed
  extracted.txt       the text the pipeline produced, FROZEN
  expected.json       human-written once, never regenerated
```

Four assertions, **the first two needing no AI**: `basis` is a literal substring of
`extracted.txt` · `must_not_determine` has no hits · `must_determine` matches on switch, value
and class · `max_determinations` caps enthusiasm.

**⛔ Not built, and the blocker is a decision rather than effort.** A case needs a committed
document, and the only realistic candidates are production files belonging to test companies —
including `HF_Acid_SDS_2024.pdf`, whose review is a complete FMLA analysis with a headcount of
42 and which would be the strongest negative control available. **Whether customer-uploaded
files may enter the repository is not a decision to take quietly**, so the directory does not
exist yet. Synthetic documents are the safe alternative and prove less.

---

## Proving the tests can fail — `npm run mutation`

Added 12 September 2026, with the first test suite in the codebase.

**`HOW-WE-BUILD.md` §3: a validator that has only ever said PASS is untested.** That applies
to a test suite more than to anything else it was written about, because every property this
suite guards **fails silently** — a wrong answer is a requirement quietly leaving a customer's
list, not an error anyone sees. A green suite is not evidence that the properties hold. It is
consistent with the tests asserting nothing at all.

`npm run mutation` breaks the engine nine ways, runs the suite against each, records which
tests caught it, restores the file and verifies it byte-identical. **Each mutation is a
plausible implementation, not obvious junk** — the comparison inverted, the default flipped, a
guard dropped. The shapes a reviewer reads past.

| # | Property | What a wrong implementation looks like | Caught by |
|---|---|---|---|
| 1 | `unknown` never becomes `does_not_apply` | `verdict === true ? applies : does_not_apply` — one line, typechecks, every unanswered requirement leaves the list | **6** |
| 2 | `not(unknown)` is `unknown` | `return !v`. Reads correctly in English; `!'unknown'` is `false` | **3** |
| 3 | `any_of(false, unknown)` is `unknown` | Dropping the unknown check — equivalent to `||` with a coercion | **12** |
| 4 | `all_of(true, unknown)` is `unknown` | The mirror. Over-includes rather than clears, so less dangerous — still asserts what nobody said | **12** |
| 5 | A NULL expression is `undetermined`, never skipped | `if (!expr) continue` — the most natural line anyone would write | **2** |
| 6 | Jurisdiction is decided **before** the expression | Treating out-of-jurisdiction as unproven rather than contradicted. §24's incident: fewer rows and a 200 | **2** |
| 7 | A fact counts only when it is **readable** | `return t === 'true'`. Turns every unreadable answer into a confident FALSE | **2** |
| 8 | A company-level expression is evaluated across **all** sites | Evaluating the primary site only. Cheaper, obvious, and wrong at five of six facilities — `DECISIONS.md` §20 | **5** |
| 9 | `determined_by` names the facts that are missing | Leaving the array empty. Every status stays correct; the ask list silently becomes nothing | **2** |

**All nine caught, 12 Sep 2026. Baseline and post-run both 119/119.**

**It is NOT in `npm run check`, on purpose.** It edits source files and runs the suite ten
times; a gate that rewrites the working tree is a gate nobody will trust under a git conflict.
**Run it whenever the evaluator, the resolver or the jurisdiction predicate changes** — and
treat a surviving mutation as a failing build, because that property is untested whatever the
suite says.

**Two mutations are worth reading even if you never run it.** #4 is the only one that errs
toward over-inclusion, which is why it is listed below #3 despite failing the same number of
tests — direction matters more than count. And #9 breaks nothing a user would see: every
status stays correct, and the only casualty is the answer to *"what would we have to ask"*.
That is the shape of defect this file exists for.

---

## The expression layer is a new class of invariant

Added 12 September 2026, with Phase 6.3. **These are not tests of code and not tests of a
model — they are tests of a body of data, and they fail in a way no type-checker and no build
can see.** A condition that names a switch nobody defined is still valid JSON, still loads,
and still evaluates: it just evaluates to `unknown` forever, so the requirement it guards
becomes permanently unanswerable and nothing anywhere reports an error.

They belong here and in `AUDIT-CHECKS.md` (checks 19–21) for different reasons: **the loader
enforces them at write time, and the audit checks ask whether they are still true afterwards.**
A row can be edited in the database without going through the loader; the second question is
not the first question asked twice.

| Invariant | Why a violation is silent | Enforced where |
|---|---|---|
| **Every switch id named by a condition exists** | An unknown switch has no value, so the clause is `unknown`; `unknown AND true = unknown` and the requirement never resolves either way. No error, no log, no failed query. | `load-expressions.js` refuses the file · `AUDIT-CHECKS.md` check 19 |
| **Every CAS in a company's inventory is in `regulated_substances`** | A CAS matching nothing used to make `substance_inventory()` return `false` — a clear, produced by not looking. Migration 014 makes it `unknown` instead. The invariant now guards the *data quality* question rather than the safety one. | FK `company_chemicals.cas_number → regulated_substances` · migration 014's own semantics · check 20 |
| **No threshold appears that is absent from the rule's own text, in that unit** | A number that looks authoritative and is not. The one that shipped came from a *neighbouring* rule, so it was real, correctly typed, and wrong for this requirement. | `load-expressions.js` warns per row · `DECISIONS.md` §44 · check 21 |

**The manual test for this layer is not a click — it is a read.** `npm run expressions` prints
every non-high-confidence condition as an English sentence next to the rule's own trigger
prose. **The test is: does the sentence say what the prose says?** Two people can do this
without a database. It is the only test in this file that a domain expert can run better than
an engineer, which is exactly `HOW-WE-BUILD.md` §1's argument for keeping the roles apart.

**Two known-failing cases to keep visible rather than fix quietly:**
1. `NSPS/NESHAP/MACT applicability screen` **under-triggers** — gated on holding an air permit,
   and an unpermitted source can still be subject. This is the one that fails in the dangerous
   direction. `TODO.md` 6.4a.
2. `Employee handbook, current version controlled` has **no condition at all** and is live. Any
   test asserting "every live requirement has a condition" must expect 199, not 200, until
   `TODO.md` 6.4c decides whether a best-practice row belongs in a legal library.
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

### An assertion class, not a case: thresholds must be quoted, not derived

*Added 12 September 2026. `DECISIONS.md` §44.*

**Any number in an `applies_expression` must appear in that requirement's own
`trigger_condition` or `citation`, in that unit.** If it does not, the expression is asserting
a number nobody wrote down.

This is a **class** rather than a case: it runs over every expression rather than over one
input, and it needs no model call. `thresholdsIn()` in `lib/appliesExpression.ts` returns every
numeric literal an expression asserts; comparing that list against the row's own text is a
string search.

**Two ways it fails, and the second is the one a reviewer cannot see:**

- **A unit conversion.** A threshold written in pounds restated in gallons requires assuming a
  density, and density belongs to a product rather than to a rule.
- **A number imported from a neighbouring rule.** Caught on the first run: **1,320** appeared
  in `Oil Facility Response Plan determination`, a real figure from 40 CFR 112.1 belonging to
  the **SPCC Plan** row. Correct about the world, wrong about the rule.

**It runs in `npm run check`, not in `npm run golden`** — it asserts a property of the library
rather than of an answer, so it belongs with the static checks and costs nothing to run.

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
22 of 200 live rows. *(Re-measured 12 Sep: PHMSA 15, FMCSA 7, unchanged by migration 013's
splits, which touched OSHA and confined-space rows only. The denominator moved 192 → 200.)* The company is Oregon-based, and for this question **its jurisdiction is
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
and it is not an abstraction: **0 of 200 live rows carry a `citation_url`, a `citation_quote`, or a
`source_checked_at`, and 0 are at `status = 'verified'`** — re-measured 12 Sep, and the
numerators did not move when the denominator went 194 → 200, because splitting a row cannot
give it a source its parent never had.** There is no artifact behind any of
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
3. **Expected, once anything reads the table:** 33 agencies — 14 federal, 16 Oregon, 3 local.
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

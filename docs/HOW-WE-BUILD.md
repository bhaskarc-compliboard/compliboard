# How We Build CompliBoard

**Version:** 16 · **Updated:** 22 September 2026
**Supersedes:** version 15 (21 Sep). §4's worked example renumbered: the switch step is **5**, not
6, since the from-zero run found the documented order was never executable (`DECISIONS.md` §120).
Version 15: version 14 (21 Sep). Adds **§11 — a structure built ahead of the model constrains
it**, learned twice (the requirement table, then the research pipeline): **the baseline is wide
open and everything on top must measurably beat it**, enforced by making every pipeline piece a
config switch so the release mechanism and the experiment framework are one thing. Adds **§12 —
the module loop**, its **three kinds of gap** (schema / data / **truth**, the last of which a chat
will not volunteer unless asked), and the rule that **benchmarks use an incognito chat** because a
normal one carries memory that contaminated earlier baselines. Version 14: **§4 gains the limit of the rebuild claim: the chain rebuilds
the SCHEMA from zero and nothing else.** The library — 205 requirements, 95 switches, 33 agencies,
the mapping and the expressions — lives in **load scripts, not migrations**, so a usable staging
database is **eight steps** after a reset and one refusal leaves an empty `switches` table that
makes every later check pass vacuously rather than fail. Records a **reset OWED** for migration
029, with the accepted risk stated (029 is additive) and the precondition named: **the restore
must be one command first.** Version 13: Adds **§3b — where the server log is on Next 16**:
`console.error` in a route goes to `.next/dev/logs/next-development.log`, **not** to the terminal
running `npm run dev`. It cost a wrong conclusion on 15 Sep and will cost the next one too.
Version 12: Adds **§5a, the standing rule for whoever is DIRECTING the
work** rather than for Claude Code: *before you assert a cause, point at the line that says it; if
you can't, call it a hypothesis and have it checked; never hand over a record to file that you
haven't seen evidence for.* Four composed findings in one session, each settled by one command —
and **three of the four carried a correct principle attached to a wrong mechanism**, so the
mitigation is catching rather than preventing. Version 11: Adds **§3a, the found-by-rendering class** — a defect where
every layer returns correctly and the loss is downstream, so no unit test can see it and a screen
is the first instrument that can. **Demonstrated twice on 13 Sep**: a composition defect whose unit
test asserted the bug and passed, and a content defect that ten minutes of domain reading found
after 199 expression reviews had not. The argument for building the screen before verifying the
content beneath it, now demonstrated rather than predicted. §4's pre-flight section records that
**the printed-inputs shape held the one time it was tested** — an abort on a reported filename
mismatch, settled by one `ls` and one `git log`, with the name appearing zero times anywhere.
Version 10: §4 gains **the required shape of a production pre-flight** —
it prints both inputs in full and derives the pending list in front of the reader, as
`npm run preflight`. Six naming failures in two days survived four tightenings of the rule,
because the problem was never the rule: a summary written from context was wearing the costume
of a check. The general form — **a check that reports its CONCLUSION is a summary; a check that
reports its INPUTS is a check** — applies to every check in `AUDIT-CHECKS.md`. Version 9: §3
gains *measure before writing "acceptable for now"* — the
recompute cost was a note until it was asked for as a figure, and the figure took a minute while
the note would have been re-litigated by whoever read it next. Version 8: **§2's loop gains step
0: two dependency questions, not
one.** The second — *what does this decide on behalf of something that does not exist yet* —
found four accidental contracts on Phase 7.2a, three of which would have surfaced only when a
downstream module broke on them. Version 7: §3 gains *validate the structure of what you extracted
before writing it* — from the CAS check digit, where the dangerous identifier is not the one
that matches nothing but the one that matches something else. §7 gains the hand-off case: §46
has now fired three times, each further from the artifact than the last, and the third had a
correct pre-flight and an altered copy. Version 6: §3 gains *build the review artifact before the bulk work* —
the renderer that caught a logical inversion and a fabricated threshold in its first twenty
rows, and would have caught neither built afterwards. §8's gate gains a seventh credential.
Version 5: §3 gains the rule that a check compares against the artifact
and never against a remembered number, with the three false alarms in one session that earned it
— and the correction that the "Oregon sick-time split" invoked for one of them does not exist.
§4 gains the rule that a pre-flight names files exactly as
they appear on disk, read from the directory — because approximate filenames make every file
list look unexpected and so defeat the abort guard that protects production; §7 cross-references
it as the same class as writing a summary from recollection. Version 3 added: §3 gains three rules earned since — read a derived result
by target rather than by total; test the direction you are not building; some invariants
cannot be constraints and need a named owner. §10 is brought current. Version 2 added **step
12 to the loop** — write the manual tests,
two per feature, into `docs/TESTING.md` before the commit. A standing obligation, not a
suggestion.
**Who this is for:** the next session, human or AI, picking this up cold.

`CLAUDE.md` holds the rules. This holds the *method* — how work actually gets done here, why it is shaped this way, and what it has already caught. Read it before the first task of a session.

---

## 1. The three roles, and why they stay separate

| | Does | Never does |
|---|---|---|
| **Chat** | Design, decisions, reviewing reports, writing instructions | Touch the repo or either database |
| **Claude Code** | Reads code, writes code, runs migrations against staging, tests, commits | Apply migrations to production, invent regulatory content, decide product questions |
| **The owner** | Decides, supplies domain judgment, runs production migrations, presses every irreversible button | Write code |

**The separation is the safety mechanism, not an accident of tooling.**

Chat has no ability to break anything, so it can be wrong cheaply. Claude Code can break things, so its work is reviewed before it runs. The owner does the irreversible steps personally, so no automated path reaches production data.

This has been tested: the migration script's TTY guard — written by Claude Code — now blocks Claude Code from applying production migrations. That is the design working, not a bug.

**Chat's job on a report is to read it critically, not to approve it.** Three times in three days Claude Code flagged something it had got wrong or could not prove; each time the flag was worth more than the result.

---

## 2. The loop

```
0. TWO dependency questions     What does this NEED that does not exist?
                                What does this DECIDE for something that does not exist?
1. Read-only investigation      "Report and stop. Change nothing."
2. Review the report            Decide what is a real finding vs. a guess
3. Decide the open questions    Product judgment — the owner's, not Claude Code's
4. Write it                     "Write only. Show me the SQL/diff first."
5. Review the diff              Before it runs anywhere
6. Apply to staging             Claude Code, with the target ref printed
7. Verify by measurement        Row counts, object counts, impossible writes
8. Apply to production          The OWNER runs it and types the confirmation
9. Verify production            Same checks, against the other database
10. Update the docs             Same session, not later
11. Commit and push             Plain-language messages
12. Write the manual tests      Two per feature, into TESTING.md, before the commit
```

**Step 0's SECOND question is the new one, and it is the one that pays.** The first is the
ordinary dependency check: depending on something built is ordering, depending on something
unbuilt is building against a guess. **The second asks what this item settles on behalf of
something nobody has built yet** — and an item can depend on nothing unbuilt and still fix a
contract three future modules will inherit without argument.

Asked of Phase 7.2a it found four such contracts, and **three would have been invisible until
something downstream broke on them**: a second ask-card format when one is already shipped and
live on two routes; a response shape omitting the *"affects N requirements"* count the design
calls the number that makes a user willing to correct a switch; a home for proposals chosen
inside a one-day route task on behalf of three modules; and `basis` as prose, discovered when
M6 tried to query it.

**This project has the failure twice already.** `follow_up_questions` was a field shaped before
the thing that would use it, and it made the determination gate impossible (`DECISIONS.md` §34).
`determination_source` was a column named before the question was asked, and it answers the
wrong one. Both are the same shape: **a contract set by whoever arrived first, with no argument,
because nobody noticed a contract was being set.** `DECISIONS.md` §52.

**Step 12 is a standing obligation, not a suggestion.** Every major piece of work ends with a
short numbered list of things to click and ask — **two per feature: the perfect case and the
edge case** — written into `docs/TESTING.md` in the same session. The perfect case asks
whether the right answer is also a *convincing* one; the edge case asks what happens when a
document is missing, a permit expired, two handbooks disagree or a switch is unset. **The edge
case is where domain knowledge does work no script replicates** — a test script knows whether
a field is null, it does not know that an Oregon customer must be shown OAR 437 rather than 29
CFR. Written at the end, while the work is fresh, because a list written a week later tests
what was remembered rather than what was built.

**Step 1 is not optional and is the highest-value step in the loop.** Every significant finding in this project came from a read-only investigation before anything was written — the unauthenticated account-deletion route, the open storage bucket, the audit engine silently dropping documents, `/api/industries` broken in production, the migration chain that could not build from zero.

**Steps 4 and 5 exist because writing is cheap and wrong writing is expensive.** Claude Code produces a correct-looking migration fast. Reading it before it runs costs one exchange and has caught real errors: a regex that read `26-75` as `26`, a policy pointed at the wrong client on an irreversible path, a CHECK that passed on NULL.

---

## 3. Verification: the standard is measurement, not status codes

**This is the single most important section here.**

The failure mode this product keeps producing is not an error. It is a plausible answer built on less than it should have been. Stated as a rule:

> **The failure is always something that looks like it worked.**

Every fault found in three days had that shape:

| Fault | What it looked like |
|---|---|
| Audit engine dropped 7 of 8 documents | `satisfied=2 needs_info=1` — a plausible readiness number |
| Storage policies checked only the bucket | Policies named "own files", passing every review |
| `/api/industries` selecting a dropped column | `npm run check` passed; query strings are not type-checked |
| `array_length` on an empty array | A CHECK constraint that accepted everything |
| Migration chain never built from zero | Applied incrementally for months, apparently fine |
| Seed script not idempotent | Second run half-created a company, reported success |
| `corrections` not in the deletion list | Rows survive a deletion, orphaned, silently |
| `29 CFR → OSHA` in a mapping table | 187 of 194 assigned — true of the broken mapping and the fixed one |
| The gate could not read `entities` | It asks for an address; every question it asks is defensible |
| A cycle between two switch dependencies | Both edges locally correct, foreign keys satisfied |
| Banded `employee_count` | A value for every company; three statutes unanswerable |
| `row_count` counting retired rows | Internally consistent, matched its own projection |

**So verification rules:**

**Never verify by HTTP status.** RLS is a filter, not a gate. A read that is too narrow returns `[]` with a 200. Writes fail loudly; reads fail quietly.

**Compare row counts against the service role, per table, before and after.** That is the only thing that catches a silent narrowing.

**Check joins separately.** A blocked join returns the right row count with null content.

**Seed enough rows that a subset failure is visible.** With one row each, a silent narrowing looks identical to success. This was caught mid-test once and the test re-run.

**Attempt the impossible writes.** A constraint that exists has not been shown to refuse anything. Use values someone would plausibly write — `medium` for priority, `facility` for site, the old value from a previous migration — not obvious junk.

**Check the constraints are not too strict, either.** A company that stops and restarts an activity must still be representable.

**Compare schemas object-for-object, not by generated types.** An identical types file proves only what the generator emits. It says nothing about indexes, policies, constraints or triggers. Production and staging are compared across all of them — **currently 798 objects, 0 differences, the two outputs byte-identical.** *(673, then 619, now 798: three runs, three censuses, none comparable to the others and none of them a regression. The census is now a file — `supabase/census.sql` — because a count whose definition is not stored cannot tell drift from rewording, and telling those apart is the only reason the check exists. `AUDIT-CHECKS.md` check 10.)*

**A validator that has only ever said PASS is untested.** Run it against deliberately broken input and confirm it refuses. This was done with eight mutations of the requirements worksheet, and since with a deliberately corrupted `row_count`, a falsified prompt hash, and a dependency cycle fed to the loader that refuses them.

**Read a derived result BY TARGET, not by total.** Added 12 Sep. A mapping assigning a regulator to 194 requirements reported *187 assigned* both before and after a rule that would have filed six employment statutes under the workplace-safety regulator. The total was identical; only *which rows landed where* differed. **A count is not a check** — it is the one number a wrong answer is most likely to get right.

**Test the direction you are NOT building.** Added 12 Sep. Every instinct while building the determination gate pointed at making it ask: the prompt, the schema, the card, the acceptance criterion. The case that found the real bug was the one asserting it must **not** ask — a gate that could not see the company's own site would have asked for an address every customer had already given, and the ask-path test passed throughout. Where a feature exists to make something happen, the test that matters most is usually the one asserting it does not happen in the ordinary case.

**Some invariants cannot be constraints, and those need a named owner.** Added 12 Sep. A dependency cycle needs recursion to detect and a CHECK sees one row at a time; a `row_count` matching the live library needs a join. Both live in loaders that refuse the whole file. **The test for whether something can be a constraint is not whether it is important.**

**A check compares against the artifact, not against a remembered number.** Added 12 Sep, after
three false alarms in one session — all from the same move. The rule §7 states for *summaries*
("written from the database, not from recollection") applies with more force to *verification*,
because a verification is the thing that is supposed to catch drift. **A remembered number that
is one version stale does not fail quietly — it raises an alarm, and a false alarm costs more
than the check saved.**

| The check | Compared against | The artifact it should have compared against |
|---|---|---|
| Production's migration list | A hand-off naming `014_company_chemicals.sql` and `015_requirement_splits.sql` | `ls supabase/migrations/` — which lists `013_chemical_inventory.sql` and `014_unidentified_chemicals_are_unknown.sql`, and shows the splits are section 4 of 013 |
| Production's switch count | 101 switches / 44 edges, carried from an investigation report | The dry run printed on screen: `95 switches · 0 new · 0 changed`, matching `switches.json` at 95/40 and both databases at 95/40 |
| Production's requirement count | A summary predating migration 013 | The database: 205 rows / 200 live, after 013's three splits took 194/192 to 205/200 |

Each cost a full read-only reconciliation, and all three found nothing wrong. **Three in one
session is a pattern, not an incident.** The cost is not the reconciliations — it is that the
abort guard on production (§4) only works while an unexpected result is rare, and each false
alarm spends some of that.

*One correction earned by the third reconciliation, kept because §7 says a record that quietly
rewrites its own mistakes is worth less:* the stale summary was attributed to "the Oregon
sick-time split". **There is no Oregon sick-time split.** `Oregon sick time` is a single live row
and has never been split; the library's five split parents are Boiler and pressure-vessel,
Respirable crystalline silica, and 013's three — Electronic OSHA injury-data submission, Process
Safety Management, and Permit-required confined spaces. The stale number was real; the reason
given for it was itself recalled.

**The operative form is short.** Before raising a discrepancy, re-read the thing — `ls` the
directory, re-read the dry run still on screen, re-run the count. It costs one command, and it
is cheaper than being right for the wrong reason.

**Measure before writing "acceptable for now".** Added 13 Sep. A whole-company recompute on
every answer was flagged as acceptable-for-now in a report, as a note with no number attached.
Asked to make it a figure, the measurement took one script and about a minute: **221 obligation
rows touched per answer, 19 of them actually changed, 10.6× amplification, ~2,652 rows over a
twelve-question session.**

**The note cost more than the measurement would have.** A number is arguable — it has a
threshold ("linear in sites; at ten sites it is 1,105 rows per answer") and therefore a date at
which it stops being acceptable. A note is not arguable; it is a feeling, and feelings about
performance are re-litigated from scratch by whoever reads them next.

**So "acceptable for now" is not a conclusion — it is a prompt to go and measure**, and the
measurement is almost always cheaper than the sentence it would have replaced. The same applies
to "probably fine", "small enough to ignore" and "we can optimise later". Each of those is a
claim with a number behind it that nobody has looked up. `DECISIONS.md` §55.

**And measuring it changed nothing about the decision, which is the point.** The recompute is
still whole-company, for the correctness reason in §55 — a narrowed payload cannot tell "no
longer applies" from "not sent". What changed is that the trade is now written down with its
trigger condition, instead of being a reassurance that would have to be re-earned.

**Validate the STRUCTURE of what you extracted before writing it, not after.** Added 12 Sep,
from the CAS check digit. A value that is well-formed and wrong is indistinguishable from one
that is well-formed and right once it is in the database — and the dangerous case is not the
identifier that matches nothing, which announces itself, but the one that **matches something
else**. `7664-93-9` is sulfuric acid, `7664-39-3` is hydrofluoric acid: two digits apart, both
valid, both in the reference table, wildly different thresholds. A transposition satisfies the
foreign key and every structural test available. **So every property checkable without a
reference lookup gets checked at the boundary** — a check digit, a date that parses, a number
inside its permitted range, an enum value in its allowed list, **a quote that appears in the
document it is quoted from** — and a failure produces an absence rather than a value.
`DECISIONS.md` §48.

**Build the review artifact BEFORE the bulk work, not after.** Added 12 Sep. Writing 200
machine-evaluable conditions is the kind of work nobody can review as JSON, so a renderer was
built first — one that turns a stored condition back into an English sentence — and the loader
was made to print that sentence for every condition it was not confident about. **In its first
twenty rows it caught a logical inversion and a threshold that appears in no rule**: a clause
reading the TSCA Inventory backwards, and a number carried in from a neighbouring rule
(`DECISIONS.md` §43, §44). Built afterwards, it would have caught neither — a renderer run over
finished work produces 200 plausible sentences, and nobody reads 200 plausible sentences
looking for the two that are wrong. **The artifact's value is that it exists while the work is
still being decided**, so each sentence is read once, at the moment its author can still
remember why they wrote it. The same shape as step 12's manual tests: written while fresh, or
written about what was remembered.

---

## 3a. THE FOUND-BY-RENDERING CLASS — a defect every test passes

**A defect where every layer returns correctly and the loss is in what happens between them.** No
unit test can see it, because no unit is wrong. **A screen is the first instrument that can.**

**Demonstrated twice on 13 September, and neither was predicted:**

**1. The composition defect.** 12 of Test Alpha's 136 `unknown` rows named no fact and offered a
question nothing could answer. `resolve()` returned `inventory_missing` correctly; `renderUnknown()`
returned a well-formed row correctly. **Only the join between them was wrong** — and the unit test
asserted the defect as the contract and passed, because it never set `factsNeeded`. Found by
rendering the persisted rows. `DECISIONS.md` §61.

**2. The content defect.** Cases E, F, G and I passed; the mechanism was sound at every layer.
**Ten minutes of domain reading of the rendered rows then found three shapes of wrong rule that
199 expression reviews had not**, and the sweep it prompted found that 22 of 216 switch clauses
can never be true — **a large-quantity generator receives zero hazardous-waste obligations and is
told so in a confident sentence.** `DECISIONS.md` §64, check 28.

> **The two are the same class at different depths.** In the first the code was right and the
> composition was wrong. In the second the code AND the composition were right and **the claim
> about the world was wrong.** Neither is reachable by testing the parts, because in both cases
> every part passes its own test — and in both cases the failure was legible in one sentence the
> moment it was rendered for a person.

**What follows for the order of work.** This is the argument for **building the screen before
verifying the content beneath it**, and it is now demonstrated rather than predicted. A screen is
not the last step of a module; it is the cheapest available instrument for a class of defect that
has no other observer. When the choice is between more unit coverage of a correct function and
rendering the output for somebody who knows the subject, **render it**.

**And the corollary, which is the uncomfortable half:** a passing suite says nothing about this
class. 250 tests were green the whole time. `npm run check` cannot make an authenticated request
(§63), cannot compare a literal's type to a switch's (§64), and cannot read a sentence and ask
whether it is true of a real business. **Those are three separate blind spots and only the first
is closeable by writing more tests.**

---

## 3b. WHERE THE SERVER LOG IS, ON NEXT 16

**`console.error` in a route does NOT go to the terminal running `npm run dev`.** Next 16 writes
its own structured log:

```
.next/dev/logs/next-development.log
```

**This cost a wrong conclusion on 15 September.** A route's rejection path logged four errors;
grepping the terminal output found none, and *"the console.error did not reach this log"* was
nearly recorded as a defect. The lines were there, in the other file, as JSON:

```json
{"level":"ERROR","message":"[/api/chat] conversation rejected: \"turns are not contiguous\" ..."}
```

**It will cost the next one too**, which is why it is here rather than in a commit message. When a
route's logging appears to be missing, check that file before concluding anything.

---

## 4. The two databases

**Staging and production are separate Supabase projects in different regions.** They must stay structurally identical; the object comparison is how that is known rather than assumed.

**Local development points at staging.** `NEXT_PUBLIC_SUPABASE_URL`, the anon key and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` are staging's. This is not a preference. The dev server ran for six hours pointed at production while hot-reloading an untested account-deletion route — one click from destroying live data.

**Production credentials do not live on the laptop.** Vercel holds what the deployed app needs. The migration script reaches production through `SUPABASE_PROD_*` variables; the loader needs two more that are **expected to be blank** and set only for the duration of a load, then cleared. The loader refuses without them and prints a reminder to clear them.

**Migrations are forward-only and the chain is proven.** `npm run db:reset` rebuilds staging from nothing and runs `000 → latest`. **Run it after adding any migration.** Incremental application hides defects: two were found the first time the chain ran end to end, and neither was reachable any other way.

> ### ⚠ THE CHAIN REBUILDS THE SCHEMA FROM ZERO AND NOTHING ELSE. — 21 September 2026
>
> **The sentence above is true of the STRUCTURE and false of anything you could test against**,
> and the distinction had never been written down. A reset leaves a correct, empty database.
>
> **The library is not in the migrations.** Only three carry seed inserts — 011 (agencies), 012
> (thresholds), 013 (chemicals). Everything a question actually reasons against comes from load
> scripts reading `supabase/seed-data/`:
>
> | | | Restored by |
> |---|---|---|
> | requirement_templates | **205** | `load-requirements.js` + an `.xlsx` |
> | switches | **95** | `load-switches.js` |
> | agencies | **33** | `load-agencies.js` |
> | industry_coverage | **56** | `assign-agencies.js` |
> | applies_expression | on 205 rows | `load-expressions.js` |
> | the three test companies | Alpha, Beta, Gamma | `seed-staging-testdata.js` |
> | Alpha's second site + 16 facts | | `seed-multisite-fixture.js` |
>
> **So a USABLE staging database is eight steps after a reset**, and on 21 September five of them
> had not been exercised in the session that was about to depend on them.
>
> **THE FAILURE MODE IS THE POINT, AND IT IS NOT INCONVENIENCE.** One refusal in the middle —
> the switch step declining, say (**step 5** since 22 Sep; it was 6 when this was written) —
> leaves `switches` at **zero rows**, and the determination gate reads an
> empty vocabulary and asks nothing. **Every check that follows then passes against a database
> with no library in it**, which is `AUDIT-CHECKS.md` check 14's subject in its most expensive
> form: not a check that fails, a check that succeeds vacuously on an empty table.
>
> **What makes this a finding rather than a chore:** *"the schema is rebuildable from source"* has
> been said in this project as though it meant the database is. It does not, and the gap is
> invisible precisely because the reset itself always succeeds.

#### ⬜ OWED: a reset, deferred 21 September 2026

**Migration 029 was applied with `npm run db:migrate`, not `db:reset`,** so §3.7's guarantee —
the chain builds a database from nothing — is **unmet for 029 and is recorded as owed rather
than quietly skipped.**

**The risk accepted, stated so it can be judged rather than trusted:** 029 is **additive** — two
new tables, three new enums, one foreign key to `companies`, and no ALTER of anything that
exists. It creates no column on a table another migration later reads, and drops nothing. The
class of defect a from-zero run catches is **ordering and collision** — the two found on 11
September were both of that kind — and an additive migration at the end of the chain has almost
no surface for either. **Almost is not none, and that is exactly what the owed reset settles.**

**THE PRECONDITION IS THE RESTORE COMMAND, NOT A CALENDAR.** The reset is deferred because the
restore is eight manual steps; it stops being deferred when it is one. **Then it is exercised
deliberately, on its own, not as a side effect of shipping the next thing** — a reset run in the
middle of another task is a reset nobody is watching.

**Production migrations are run by the owner, in a plain terminal, typing `PRODUCTION`.** The script prints the target ref, the staging ref for contrast, and the exact list of pending files.

### The required shape of a production pre-flight — `npm run preflight`

**It prints both INPUTS in full, then derives the pending list in front of you.**

```
INPUT 1 — supabase/migrations/, every file          (all 22, listed)
INPUT 2 — schema_migrations on <ref>, every row     (all 22, listed)
DERIVED — INPUT 1 minus INPUT 2                     (+ every statement grepped per file)
DERIVED — INPUT 2 minus INPUT 1
PENDING COUNT: n
```

**Why it is a script and not a discipline.** Six times in two days a migration name, a count, or
a description of what a file does was wrong somewhere between the directory and the prompt. The
naming rule was written (§46), extended to the diff (§46.1), extended to the hand-off (§46.2)
and extended to file contents (§56.2) — **and instances five and six happened after all four.**

> ### The problem was never the rule. A SUMMARY WRITTEN FROM CONTEXT WAS WEARING THE COSTUME OF A CHECK.
>
> *"I diffed the history against the directory and found one pending file"* is indistinguishable
> on the page from the same sentence written without having done it. **The reader cannot tell,
> because the only thing shown is the conclusion.** Tightening the rule about what the conclusion
> must contain cannot fix that — it makes a better-worded claim.

**So the general rule, and it reaches past pre-flights:**

> **A check that reports its CONCLUSION is a summary. A check that reports its INPUTS is a check.**

With both lists on screen the reader does the subtraction in one glance, and **no claim about
having done it is load-bearing.** The same test applies to every check in `AUDIT-CHECKS.md`:
check 10 prints object counts and a sha rather than "they match"; check 22 prints the grantees
rather than "no function is public"; `npm run audit:data` prints SKIP and what was missing rather
than a pass. Where a check reports only its verdict, it is a summary and should be rewritten.

**The reviewer's half is unchanged and is now cheap enough to be routine:** the two lists are
printed, so an unexpected pending set is visible without trusting anything.

> **An unexpected file count is the correct signal to abort — and twice it was.** Both times the cause was a real defect: a CLI output-shape bug, and a migration history that had not been read. If the count is expected to be unusual, it is stated *in advance* in the hand-off, never reasoned about at the prompt.

**And the guard is only as good as the names in the hand-off. A pre-flight names files exactly as they appear on disk, read from the directory rather than from what the work was called while it was being done.** Added 12 Sep. A hand-off for migrations 013 and 014 named them `014_company_chemicals.sql` and `015_requirement_splits.sql` — two files that have never existed here. The owner aborted, which was right; the reconciliation then found nothing wrong with the migrations at all. `git log --follow --name-status` shows zero rename entries over `supabase/migrations/` in the project's whole history, both files were added once under the names they carry, and the "missing" split migration is section 4 of `013_chemical_inventory.sql`. The origin of the two names could not be established from the repo or the session transcript, and that is recorded as unknown rather than guessed at.

**The cost is not the wasted reconciliation. It is the guard.** Its entire value is that an unexpected file list means *stop*. A pre-flight that paraphrases filenames — approximate numbering, a descriptive name for what the work was called while it was being done, two logical pieces written as two files when they shipped as one — makes every list look unexpected. The second false alarm is annoying; by the third the list stops being read, and the one real mismatch goes through. **A guard that cries wolf is worse than no guard, because no guard is at least known to be absent.**

This is the same class as writing a summary from recollection rather than from the database (§7). The fix is identical in shape: `ls` the directory and paste what it says. It costs one command.

> ### IT HELD, ON THE ONE OCCASION THAT TESTED IT — 13 Sep
>
> A production apply was aborted on a reported mismatch: *"the pre-flight said
> `023_replace_obligations_explicit_company.sql`, the prompt listed
> `023_caller_may_compute_own_obligations.sql`."* The reasoning attached was exactly the failure
> this section exists to catch — *"either the listing printed one name and the derivation wrote
> another, or the listing did not contain what was claimed."*
>
> **Neither had happened, and settling it took one `ls` plus one `git log`.** The name appears
> **0 times** on disk, **0 times** in git history on any branch, and **0 times** in the
> pre-flight's output — which emits exactly one 023 filename, twice, in the listing and in the
> derived line. `git log --follow` shows status `A`, never a rename; the file's sha256 is
> unchanged since the commit that shipped it to staging.
>
> **That is the shape working, not failing.** Both inputs were on the page, so the derived line
> was checkable against them in one glance, and the check cost a directory listing rather than a
> reconciliation. **And aborting was right regardless of whether the mismatch was real** — a
> migration not applied costs one message; a migration applied from a misread name costs whatever
> it does. `DECISIONS.md` §65 records it as the third fabrication and extends the rule: **a
> composed filename is a described artifact, not a copied one.**

---

## 5. What Claude Code must not do

**Never invent regulatory content.** Splitting a requirement means writing new cadence, evidence and trigger text — that is generating regulatory content and belongs to the verification pipeline, not to a spreadsheet fill. When the silica requirement was split, every child's text was *derived from the parent's own text*, and that was stated explicitly.

**Never decide a product question.** Whether colleagues see each other's checklists, whether `satisfied` is the right enum name, how the 26 categories map to ten — those come back as questions with the options laid out, not as decisions taken.

**Never guess a value it does not have.** Three requirement rows claimed county jurisdiction and named no county. The correct behaviour was to flag them, not to pick a county.

**Never proceed on an unverified premise.** The most instructive failure of the project: Claude Code established early that `.env.local` pointed at production, then reused that as a current fact after it had changed. The one check it ran could not have distinguished the two cases. It later said so plainly — *"stale premise, and a check that couldn't have falsified it."*

---

## 5a. THE STANDING RULE FOR WHOEVER IS DIRECTING THE WORK

*Added 13 September 2026. Every other section of this file is a rule for Claude Code. **This one
is not.***

> ### Before you assert a cause, point at the line that says it. If you can't, call it a
> hypothesis and have Claude Code check it. **Never hand Claude Code a record to file that you
> haven't seen evidence for.**

**The reason, measured: four composed findings in one session.** Each was a plausible mechanism
narrated rather than observed, and each was settled by a single command:

| | What was asserted | Settled by | Cost |
|---|---|---|---|
| 1 | a `resolutionNote` defect, *"60 of 72 unknown rows"* | `grep` — neither identifier exists | one grep |
| 2 | *"fix the 13 rows; a switch with no row does not name itself"* | a query — it is 12, and all 72 name themselves | one query |
| 3 | *"the pre-flight said `023_replace_obligations_explicit_company.sql`"* | `ls` + `git log` — 0 occurrences anywhere | one `ls` |
| 4 | *"013 rebuilt the table, `agency_id` never re-run, 60 with no regulator"* | it was 007, the gap was one day, and there are 7 | one `git log` |

### The mitigation is CATCHING, not preventing

**Three of the four carried a correct principle attached to a wrong mechanism** (§61, §63, §66) —
*an affordance with nothing behind it is worse than none*; *validate it against the caller*; *ask
what rebuilds a derived column when its table is replaced*. **All three found real defects.** A
rule aimed at suppressing the assertions would have suppressed the insights with them.

**So the rule is not "assert less". It is "assert, then check before it is written down".** The
check costs one command; the thing it prevents is a wrong finding entering the record and being
cited later as established (§60).

**And the fourth instance has the shape worth remembering: it was a RETRACTION.** A
self-correction is not self-verifying, and it carries extra authority precisely by admitting
error. It earns the same `grep` as the claim it corrects — arguably more.

---

## 6. Instruction style that works

**Say what not to do, not only what to do.** "Write only — show me the SQL first" and "report and stop" are load-bearing.

**Ask what breaks before changing anything.** Module by module, traced against real data rather than by reading code. This is how the storage migration was applied with confidence, and it found that all 38 production documents already had matching prefixes.

**Ask for the failure shape, not just the plan.** "What happens if this is subtly wrong — a silent empty result, an error, partial data?" decides how to verify. If the answer is "silent empty result", a status check is worthless.

**Name the cheapest thing to verify and start there.** Convert one route, prove the pattern, then widen. Ten routes were converted this way, one commit each.

**Give the reasoning, not just the decision.** Instructions that explain *why* produce better work and catch more of chat's own errors — twice, Claude Code corrected a stated premise because the reasoning did not survive contact with the data.

---

## 7. Documentation discipline

**The repo is authoritative. The Claude Project folder is a periodic copy.**

**Version numbers go inside files, never in filenames.** A version in the filename means every update breaks every reference to it. This caused three drift incidents in two days before the rule was made.

**Update the docs in the same session as the work.** Drift is not hypothetical here: two TODO files existed simultaneously, a design document was superseded by a copy with a different name, and `CLAUDE.md` §2 pointed at a filename that no longer existed.

**A decision record that quietly rewrites its own mistakes is worth less than one that shows them.** When a decision is reversed, the old one is marked superseded with what was wrong about it — §15.7 and §17.5 are both still there, annotated.

**Record the reasoning and the reversal condition.** A decision without a stated condition for revisiting it becomes dogma.

**Write from the database, not from recollection.** A summary claimed production was two migrations further along than it was. Both chat and Claude Code had it wrong. Summaries are built by querying.

**Name files from the directory, not from recollection either.** The same rule, applied to a hand-off rather than a summary — and with a sharper cost, because approximate filenames in a pre-flight defeat the abort guard that protects production. §4 has the incident.

**And the same rule governs verification, not only writing.** A check run against a remembered number is not a check. §3 has the rule and the three false alarms that earned it.

**It governs the HAND-OFF too, and that is where it fired third.** Added 12 Sep. §46 was
written for the pre-flight — the side that *produces* the file list. Its three firings have
walked steadily further from the artifact: first a pair of filenames that existed nowhere;
then a set of counts matching neither database; then, with the pre-flight demonstrably correct
and printed from `ls`, **a name altered between reading the pre-flight and acting on it**.
`014_company_chemicals.sql` · `015_close_and_replace_obligations.sql` ·
`017_company_chemicals_cas_trim.sql` — none of the three has ever existed, in any commit, on
any branch. **The artifact was right every time; the copy of it was not.** So the rule is not
"write pre-flights carefully", it is: *anything a reader will compare character by character is
copied from the thing itself, at every hop, including the last one.* The cheaper check belongs
to whoever raises the alarm — the author has to be right about everything, the challenger only
has to run `ls`.

---

## 8. The standing gate

> **These land before the first real customer document arrives.** After that, each costs a maintenance window and a rollback plan instead of an afternoon.

Currently: **key rotation** — seven credentials. Four from a zip shared on 9 Sep, both database passwords printed to a terminal on 10 Sep, and on 12 Sep the **production service-role key**, printed by a shell check written to say *set* or *blank* — `${VAR:+set}${VAR:-blank}` expands to the value when the variable is set. **That seventh one argues for rotating now rather than at the gate**, because the service role bypasses RLS entirely. Still one gate ITEM; seven credentials inside it.

The gate is easy to state and easy to slip past. A prospect signs, someone wants to try it, and the work does not get harder overnight — it gets harder gradually, which is how these get skipped permanently.

---

## 9. What we should do better

Honest list, not a formality.

**Tests do not exist.** `npm run check` is `typecheck && check:schema && build`. `CLAUDE.md` §3.10 promises `test` and there is no runner. **The resolution engine in Phase 4 must not ship without one** — it is pure logic with safety properties (`unknown` never yields `does_not_apply`; expired evidence never satisfies) that fail silently when broken. That is the class of bug a wrong comparison direction produces.

**No error monitoring.** If something breaks in production, nobody is told. The `/api/industries` outage was found by accident during unrelated work.

**No AI cost tracking.** `lib/ai.ts` returns token usage and nothing records it. Cost is currently invisible and unbounded.

**The dev server has no guard.** It has twice been one click from production. A startup check that prints which database it is pointed at — loudly — would cost minutes.

**Two dynamic `.from(variable)` call sites cannot be checked** by the schema-contract script, and one is the data-export route whose entire purpose is completeness. They are verified by hand after every rename, which is a process, not a guarantee.

**Staging data drifts.** Test companies, extra rows, probe records. `npm run db:reset` plus the seed script rebuilds it, but the discipline of doing so is not established.

**Chat writes summaries from memory.** It has been wrong about migration state, about what a column recorded, and about whether a feature needed a migration. Every summary that matters should be produced by Claude Code from the database.

---

## 11. A STRUCTURE BUILT AHEAD OF THE MODEL CONSTRAINS IT

**Learned twice, and the second time is what makes it a rule.** `DECISIONS.md` §113.

| | |
|---|---|
| **First** | the **requirement table** — a shape decided before the thing that had to fill it, and abandoned |
| **Second** | the **research pipeline** — a prompt, a fact block, a frame, a scenario block and a gate, all built before a benchmark said whether any of them helped. **Five questions against raw Claude and ChatGPT with no context: CompliBoard was weaker on most** |

> ### THE BASELINE IS WIDE OPEN. EVERYTHING ON TOP MUST MEASURABLY BEAT IT.
>
> Not *"is defensible"*, not *"is principled"* — **beats the step before it, on questions somebody
> actually asked.** A piece that cannot be shown to help is a piece that is narrowing the model
> while looking like care.

**The failure is hard to see from inside**, because every piece was added for a real reason and
each one reads well on its own. §102 removed a template for narrowing the output; §113 found the
prohibitions replacing it narrowed it too. **A fence built out of good reasons is still a fence.**

**How this is applied in practice, not as a slogan:** every pipeline piece is a **configuration
switch**, production runs with them off, and staging runs what is being tested. **The release
mechanism and the experiment framework are the same thing** — so a piece earning its way back is a
config change, and so is rolling it out again.

---

## 12. THE MODULE LOOP — how one module gets finished

**All modules ship. No compromise. One at a time.** `DECISIONS.md` §114.

| | |
|---|---|
| **1** | **The owner writes the user-view vision** — what a person sees and does |
| **2** | **Chat checks it against the system** and sorts every gap into one of the three kinds below |
| **3** | **Chat builds an artifact** the owner iterates on, to a **finish line agreed before it starts** |
| **4** | **The artifact FILE goes into the repo.** Not a description of it |
| **5** | **Chat writes one complete brief** |
| **6** | **Chat runs long against the brief and checks its own work**, stopping only for a product decision, a production migration, and the end |
| **7** | **Chat reviews at midpoint and finish only** |

### The three kinds of gap

| | Meaning | What happens |
|---|---|---|
| **SCHEMA** | the schema is wrong, **not the vision** | migrate |
| **DATA** | the structure is fine; the data is absent or untrusted | content work — **and the screen stays truthful in the meantime** |
| **TRUTH** | **no system can honestly know this** | **push back on the vision** |

> **The third will not be volunteered unless it is asked for.** A model handed a vision finds a way
> to build it, and *"nothing can honestly know that"* is the answer that looks like refusal. It is
> §5a's standing rule pointed at scope instead of at causes.

**And DATA's second half is the one that gets skipped:** a screen over absent data must say the
data is absent. That is the omniscient-status-tracker anti-pattern, removed from this product once
already.

### Benchmarks use an INCOGNITO chat

**Raw Claude in an incognito window, plus ChatGPT.** A normal chat carries the owner's memory and
**contaminated earlier baselines** — a bare model that has heard about this project for weeks is
not bare. `DECISIONS.md` §115.

---

## 10. What this method has actually produced

Four days, from a first read of the codebase:

- A storage bucket where any logged-in user could read and delete every file — found, fixed, verified with six cross-tenant tests
- An account-deletion route destroying an entire company from a URL with no authentication — found, fixed, confirmation-gated, tested five ways
- 17 of 21 routes trusting client-supplied identity — all closed, ten converted to run under the caller's own token
- Tenancy enforced in two independent layers, so a route that forgets a check now fails closed
- A schema rebuildable from source, proven by building it from nothing twice
- **205 requirement rows, 200 live**, categorised into ten obligation types, priority re-rated, splits mechanism proven and used five times — and **not one of the 11 rows added since is new regulatory content**, all of them children of three rows that were split
- **Fifteen migrations, two identical environments, 798 census objects, zero differences** — the outputs byte-identical, from a census that now lives in a file
- **33 regulators and 193 of 200 live requirements assigned to one** — and a near miss caught by projecting the mapping before applying it, which would otherwise have filed the FLSA, FMLA, ERISA, Title VII, the PWFA and EEO-1 under the Occupational Safety and Health Administration
- **A determination gate that asks for the one missing fact instead of guessing past it** — the failure that started the project, now a test that passes
- **95 switches derived from 188 requirement trigger strings**, against 46 proposed before the library existed: six nothing uses, thirty missing, and a banded headcount that would have made three federal statutes unanswerable
- **199 of 200 live requirements carry a machine-evaluable condition**, referencing 83 of the 95 switches with **none dangling** — and the 200th is empty on purpose, because nothing requires it
- **A coverage table that produced six empty Oregon regulators on the day it was filled**, including a state gross-receipts tax with no row behind it — none of them findable before, because "what is missing" had no shape to be asked against

**Nothing on that list was found by reading code alone.** All of it came from running something and measuring the result — and increasingly, from **measuring the thing the work was not about**: the proceed path, the rows that stayed out, the count nobody was watching.

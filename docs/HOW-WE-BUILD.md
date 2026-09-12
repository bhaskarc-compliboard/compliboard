# How We Build CompliBoard

**Version:** 3 · **Updated:** 12 September 2026
**Supersedes:** version 2 (11 Sep). §3 gains three rules earned since — read a derived result
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

**Compare schemas object-for-object, not by generated types.** An identical types file proves only what the generator emits. It says nothing about indexes, policies, constraints or triggers. Production and staging are compared across all of them — **currently 619 objects, 0 differences.** *(The earlier 673 was a differently-built census; see `AUDIT-CHECKS.md` check 10. Whichever census the check uses has to be the same one every time, or the count itself becomes the false alarm.)*

**A validator that has only ever said PASS is untested.** Run it against deliberately broken input and confirm it refuses. This was done with eight mutations of the requirements worksheet, and since with a deliberately corrupted `row_count`, a falsified prompt hash, and a dependency cycle fed to the loader that refuses them.

**Read a derived result BY TARGET, not by total.** Added 12 Sep. A mapping assigning a regulator to 194 requirements reported *187 assigned* both before and after a rule that would have filed six employment statutes under the workplace-safety regulator. The total was identical; only *which rows landed where* differed. **A count is not a check** — it is the one number a wrong answer is most likely to get right.

**Test the direction you are NOT building.** Added 12 Sep. Every instinct while building the determination gate pointed at making it ask: the prompt, the schema, the card, the acceptance criterion. The case that found the real bug was the one asserting it must **not** ask — a gate that could not see the company's own site would have asked for an address every customer had already given, and the ask-path test passed throughout. Where a feature exists to make something happen, the test that matters most is usually the one asserting it does not happen in the ordinary case.

**Some invariants cannot be constraints, and those need a named owner.** Added 12 Sep. A dependency cycle needs recursion to detect and a CHECK sees one row at a time; a `row_count` matching the live library needs a join. Both live in loaders that refuse the whole file. **The test for whether something can be a constraint is not whether it is important.**

---

## 4. The two databases

**Staging and production are separate Supabase projects in different regions.** They must stay structurally identical; the object comparison is how that is known rather than assumed.

**Local development points at staging.** `NEXT_PUBLIC_SUPABASE_URL`, the anon key and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` are staging's. This is not a preference. The dev server ran for six hours pointed at production while hot-reloading an untested account-deletion route — one click from destroying live data.

**Production credentials do not live on the laptop.** Vercel holds what the deployed app needs. The migration script reaches production through `SUPABASE_PROD_*` variables; the loader needs two more that are **expected to be blank** and set only for the duration of a load, then cleared. The loader refuses without them and prints a reminder to clear them.

**Migrations are forward-only and the chain is proven.** `npm run db:reset` rebuilds staging from nothing and runs `000 → latest`. **Run it after adding any migration.** Incremental application hides defects: two were found the first time the chain ran end to end, and neither was reachable any other way.

**Production migrations are run by the owner, in a plain terminal, typing `PRODUCTION`.** The script prints the target ref, the staging ref for contrast, and the exact list of pending files.

> **An unexpected file count is the correct signal to abort — and twice it was.** Both times the cause was a real defect: a CLI output-shape bug, and a migration history that had not been read. If the count is expected to be unusual, it is stated *in advance* in the hand-off, never reasoned about at the prompt.

---

## 5. What Claude Code must not do

**Never invent regulatory content.** Splitting a requirement means writing new cadence, evidence and trigger text — that is generating regulatory content and belongs to the verification pipeline, not to a spreadsheet fill. When the silica requirement was split, every child's text was *derived from the parent's own text*, and that was stated explicitly.

**Never decide a product question.** Whether colleagues see each other's checklists, whether `satisfied` is the right enum name, how the 26 categories map to ten — those come back as questions with the options laid out, not as decisions taken.

**Never guess a value it does not have.** Three requirement rows claimed county jurisdiction and named no county. The correct behaviour was to flag them, not to pick a county.

**Never proceed on an unverified premise.** The most instructive failure of the project: Claude Code established early that `.env.local` pointed at production, then reused that as a current fact after it had changed. The one check it ran could not have distinguished the two cases. It later said so plainly — *"stale premise, and a check that couldn't have falsified it."*

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

---

## 8. The standing gate

> **These land before the first real customer document arrives.** After that, each costs a maintenance window and a rollback plan instead of an afternoon.

Currently: **key rotation** — six credentials. Four from a zip shared on 9 Sep, plus both database passwords printed to a terminal on 10 Sep.

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

## 10. What this method has actually produced

Four days, from a first read of the codebase:

- A storage bucket where any logged-in user could read and delete every file — found, fixed, verified with six cross-tenant tests
- An account-deletion route destroying an entire company from a URL with no authentication — found, fixed, confirmation-gated, tested five ways
- 17 of 21 routes trusting client-supplied identity — all closed, ten converted to run under the caller's own token
- Tenancy enforced in two independent layers, so a route that forgets a check now fails closed
- A schema rebuildable from source, proven by building it from nothing twice
- 194 requirements categorised into ten obligation types, priority re-rated, splits mechanism proven
- **Thirteen migrations, two identical environments, 619 objects, zero differences**
- **33 regulators and 187 of 194 requirements assigned to one** — and a near miss caught by projecting the mapping before applying it, which would otherwise have filed the FLSA, FMLA, ERISA, Title VII, the PWFA and EEO-1 under the Occupational Safety and Health Administration
- **A determination gate that asks for the one missing fact instead of guessing past it** — the failure that started the project, now a test that passes
- **90 switches derived from 188 requirement trigger strings**, against 46 proposed before the library existed: six nothing uses, thirty missing, and a banded headcount that would have made three federal statutes unanswerable
- **A coverage table that produced six empty Oregon regulators on the day it was filled**, including a state gross-receipts tax with no row behind it — none of them findable before, because "what is missing" had no shape to be asked against

**Nothing on that list was found by reading code alone.** All of it came from running something and measuring the result — and increasingly, from **measuring the thing the work was not about**: the proceed path, the rows that stayed out, the count nobody was watching.

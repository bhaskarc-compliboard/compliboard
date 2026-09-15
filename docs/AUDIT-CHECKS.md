# Audit Checks
**Version:** 30 · **Updated:** 15 September 2026
**Supersedes:** version 29 (15 Sep). Check 14 gains a **third instance, about negative tests**: two
guard probes returned the expected status for the wrong reason — one tripped an earlier guard, one
used the caller's own entity (`DECISIONS.md` §81). **A guard test must fail when the guard is
removed**, and the error body is the evidence, not the status code. Version 29: Check 27's table half is **automated as `npm run check:live`**
— signs in as a real staging user, writes one row per tenant table a route will write, asserts anon
is refused, refuses production by ref, and runs after every `db:migrate`. **Its first run found a
column that does not exist on `company_chemicals`**, a write path nothing had ever exercised.
Version 28: **Check 27 now covers TABLES the caller must WRITE**, not only
functions it must execute — §63 found the function case and the same defect sat one table over,
invisible to the check as written: `switch_determinations` was SELECT-only to `authenticated`, so
the first user answer was impossible (§80). A grant without a policy and a policy without a grant
fail identically from the caller's side. Version 27: Adds **check 30** — is a state rule distinguishable from the
federal rule it exceeds? Two enumerable shapes: **4 rows** gated on a determination result wearing
the shape of a fact, and **21 state rows** whose expression is identical to a federal row's, of
which **14 are harmless tautologies and 7 are the defect** — an Oregon rule resolving exactly as
the federal one it should exceed, erring toward false green. **25 distinct rows of 205; 11 need
judgement.** Both findable by query, neither fixable without 6.7. Version 26: Adds **check 29** — what is reachable in principle and reached
by nothing? Kept as one class rather than scattered notes: **four modules, ~17 exports, ~60 tests,
zero requests**, which is the whole 7.2/7.2a surface. Distinguishes it from the two neighbouring
classes that fail differently — code reached for the first time by a user (§63) and code that
cannot be imported by a test (§67) — and from `substance_inventory`, which is reached and has never
taken its real path (§70). Version 25: **Check 8 is FAILING, and v24 recorded it as passing.** The
query named bucket `documents`; the bucket is `company-documents`, so it returned zero rows
against a bucket that does not exist and read as clean. Corrected: **4 orphaned customer files on
production and 4 on staging** — the same four TODO 0.7 has listed since 9 September, which the
check was written to catch and never could. **Two of the nine re-run checks were vacuous and only
one said so.** Version 24: **Nine of twenty-eight checks were in an UNKNOWN state after
six phases** — written, never run, indistinguishable on the page from the nineteen that had been.
All nine are now run against both environments: seven pass, check 9 fails because the check is too
strict (a `not_built` coverage row legitimately has nothing behind it), check 11 fails on four
stale counts, and check 20 passes vacuously. **Two were fixed** — check 4's `row_count` by
migration 024, check 27's grants by 023. Records the rule that keeps it from recurring: **a check
with a query and no recorded answer is a plan, not a check.** Version 23: Checks **27 and 28 now carry a PRODUCTION answer**, run there
after migration 023 rather than inferred from staging: 27 passes identically on both sides, and 28
returns **the same 22 mismatched clauses**, because it is the same library. Nobody has been shown
those wrong answers only because no production company has computed obligations — timing, not a
control. Version 22: Adds **check 28** — can every condition in the library ever be
TRUE? **22 of 216 switch clauses cannot**, 17 of them comparing the `hazwaste_generator_category`
enum with a boolean, so **a large-quantity generator receives zero hazardous-waste obligations**
and is told so with a confident sentence. Found by a ten-minute domain read of the rendered
screen, not by any of the three expression invariants, which check that the switch EXISTS but
never that the literal's type could match it. Version 21: Adds **check 27** — can the caller execute every function its
route calls? Both of `/api/obligations`'s were `service_role`-only while the route connects as the
caller, so every first GET was a 500; on production that is all ten companies. **No test in
`npm run check` makes an authenticated request**, so a grant is invisible to every one of the 250.
Version 20: Adds **check 26** — every unresolved requirement must offer
an action the product can actually deliver. Twelve of Test Alpha's 136 `unknown` rows name no
switch at all and offered a question nothing could answer; the unit test asserted that as the
contract and passed. The third bucket, naming neither a switch nor an inventory list, is empty
today and would be a library gap surfacing as a screen symptom. Version 19: Adds **check 25** — every view over a tenant table must run
as the caller. `obligation_evidence_state` shipped without `security_invoker` in migration 020
and would have shown every company every other company's evidence counts; 021 fixed it before it
reached production or any route. A view does not fail like a table: permission is not granted by
accident, the view quietly bypasses the policies on what it reads. Version 18: **Check 22 is
CLOSED for `substance_inventory`** — migration
019 revoked it — and re-run across every function in `public` rather than the one under
suspicion. Three still hold PUBLIC EXECUTE and all three are benign: two return `trigger` and
cannot be called at all, one is an IMMUTABLE helper a CHECK constraint depends on. The rule is
recorded so they are not re-raised. Version 17: **Check 20 is now SKIPPED rather than passing.** It was a
hard query against an empty table, which reports clean having examined nothing — check 14's
finding turned on this file. It is now a hard assertion behind an announced precondition, in
`npm run audit:data`, with checks 20b, 20c and 21 guarded the same way. "How to add a check"
gains the rule. Version 16: Check 10 re-run after migration 017: **840 objects each, 0
differences, byte-identical**, up 41 and every one attributable. Version 15 added **check 24** — `user_locked` has ZERO policies, ZERO
constraints and ZERO triggers behind it. It is enforced in one library module, which under
`CLAUDE.md` §3.6 is a route guard wearing a different coat: an honest `update company_switches`
from a future route under a user token would replace a person's stated fact with an inference,
and nothing would refuse it. Version 14 added **check 23** — what fraction of the switch vocabulary
can actually be populated. **42 of 95 switches, 44.2%, have no determination path even after
7.2 ships.** Recorded as a number rather than a note because it is a coverage claim of the same
kind the coverage strip makes, and nothing anywhere returned a figure for it. Version 13:
**Check 22's query is corrected to use `aclexplode`** —
its first version pattern-matched the ACL text for `=X/` and reported a false alarm on a
function whose grants were correct, because `postgres=X/postgres` contains that substring too.
Caught by running the check against a known-good function. Check 10 re-run after 015 and 016:
**799 objects, 0 differences, byte-identical.** Version 12 added **check 22** — function EXECUTE grants, where
Postgres's default is PUBLIC and `CLAUDE.md` §3.6's "not granting is not denying" applies one
layer down without being written down. `substance_inventory` is open to PUBLIC and leaks
nothing only because a TABLE grant stops it. **And the check must read `pg_proc.proacl`:
`information_schema.role_routine_grants` is caller-filtered and returns zero rows here, so a
check written against it passes vacuously — which migration 016's own verification block
does.** Version 11: **Check 12 is FAILING on both environments** — migration
013 split three OR-OSHA requirements into eleven and nothing recounted the coverage rows, so
`row_count` reads 53 where the live count is 61. Recorded as a bad answer rather than fixed,
because it is a data change to production. Adds **checks 19–21**, the expression layer's
invariants: every switch a condition names exists (a missing one is valid JSON that evaluates
to `unknown` forever, with no error anywhere), every inventory CAS is one we hold thresholds
for (vacuous today, and recorded as vacuous), and no condition asserts a number the rule does
not say. Version 10: check 10 is re-run after Phase 6.3 and **the census itself is
now a file** — `supabase/census.sql` — because the check had produced three different totals (673,
619, 798) from three ad-hoc censuses, and a count with no stored definition behind it cannot tell
drift from rewording. Version 9 added **check 18** — does an incomplete chemical inventory
still refuse to clear a requirement? Written because a compensating control that was assumed
turned out to be absent from the data and unworkable as described. Version 8 added **check 17** — does every fact a stage establishes
reach the stage downstream that needs it? A value returned to the client looks exactly like a
value that is wired up, and no type-checker distinguishes them. Version 7 added **check 15** — which models accept the parameters we
send, after finding that the Claude 5 family rejects `temperature` outright and that a one-line
`AI_MODEL` change would have 400'd six call sites at once — and **check 16**, whether two runs
of the same audit agree, which measures the consistency claim the original diligence made:
six runs of one 272-item standard, `satisfied` ranging 6 to 21. Version 6 added **check 14** — a test harness whose checks are weaker
than its assertions is indistinguishable from a passing suite, which is worse than one that
skips, because a SKIP is visible and a partial match prints green. Three such checkers found
and fixed; fixing one of them exposed the runner rebuilding the gate's context instead of
importing it. Version 5 added **check 13**, the switch dependency graph — a new
class of invariant, being a property of the shape of a set of rows rather than of any single
row, and one no CHECK constraint can express. Version 4 gave check 10 its post-6.2 result — 619 objects
each, 0 differences, plus the row and graph comparison. Version 3 added **checks 5–12, specified and not built** — array
foreign keys Postgres cannot enforce, the one-primary-site invariant, split lineage, orphaned
storage objects, industry-slug agreement across four free-text columns, staging/production
drift, the numbers documents assert, and the `ON DELETE SET NULL` blast radius. Adds the
standard that a sweep which has only ever said "clean" is untested, and records why
`npm run audit` is written **after** Phase 2. Version 2 added check 4, `row_count` must count
only live requirements — written because migration 011's column comment said "live" and the
first implementation counted retired rows anyway. A comment is not a constraint.

**Status: the checks are written down and run by hand. Only `npm run audit:data` automates any
of them — checks 14, 20 and 21.**

> ### ⚠️ NINE OF TWENTY-EIGHT WERE IN AN UNKNOWN STATE — measured 13 September 2026
>
> After six phases of migrations, **checks 5, 6, 7, 8, 9, 10, 11, 12 and 20 carried no recorded
> answer at all.** Not a failing answer — no answer. They were written, never run, and nothing
> distinguished them on the page from the nineteen that had been.
>
> **All nine were run on 13 Sep against both environments.** Seven passed, two failed, and one of
> the failures had been sitting on production since 12 September.
>
> **What would keep it from recurring, in order of cost:**
>
> 1. **Every check carries an `**Answer, <date>:**` line or it is not a check.** A check with a
>    query and no answer is a plan. This is free and is the rule from here.
> 2. **Extend `npm run audit:data`.** It covers 3 of 28. Checks 4, 5, 6, 7, 9, 12 and 19 are pure
>    SQL against one database and need no judgement — they could run in the same command today.
> 3. **The remainder need judgement and stay by hand** — 10 (two databases), 11 (reads documents),
>    16 (two runs of an audit), 23 (a percentage that may only fall).
>
> **The deeper cause is the one §60 names:** a check's recorded answer is the only evidence it was
> ever run, and nine of them had none while reading as though they were part of a working set.
**Related:** `TODO.md` Phase 6 (observability) · `DECISIONS.md` · `CHEMICAL-OR-WA.md` §7 (verification)

---

## What this file is for

`npm run check` answers *"does the code still build and behave"*. **Nothing answers *"is what
we are telling customers actually true"*.** This file holds that second set of questions.

Each check is a question, the query that answers it, and **the answer on the date it was
last actually run** — not the answer somebody expects. Where the answer is bad, it says so
plainly, because a check whose failing result is recorded as a to-do somewhere else is a
check nobody reads.

These are not tests in the `npm run check` sense and must not be bolted onto it. A failing
audit check does not mean a commit is wrong; it means the **library** is in a state somebody
needs to know about. Phase 6 is where they get a dashboard. Until then they are run by hand
and the answers are written here.

**Every number below was read from the database on the date given, on staging, which is
object-for-object identical to production — **798 objects, 0 differences, re-verified 12 Sep**
after migrations 013 and 014 and the expression load. The two census outputs are byte-identical
(sha256 `859e7199bfd964cb…` on both sides). (Earlier censuses reported 673 and 619; those were
differently-built questions, not losses — which is why the census now lives in
`supabase/census.sql` instead of being rewritten each time. See check 10.)**

---

## 1. Does anything in the library point at a primary source?

**Question.** For each requirement, can a person open the rule it claims to be citing?

```sql
select count(*) filter (where citation is null)                    as no_citation,
       count(*) filter (where citation_url is null)                as no_url,
       count(*) filter (where citation_quote is null)              as no_quote,
       count(*) filter (where source_checked_at is null)           as never_checked
  from public.requirement_templates;
```

**Answer, 11 September 2026 — and it is the worst answer in this file:**

| | |
|---|---|
| rows with a citation | **200 of 200 live** |
| rows with a `citation_url` | **0 of 200** |
| rows with a `citation_quote` | **0 of 200** |
| rows with a `source_checked_at` | **0 of 200** |
| rows at `status = 'verified'` | **0 of 200** — all 200 are `generated` |
| rows with `citation_federal_analogue` | **0 of 200** |

*Re-measured 12 September 2026 on both environments. The denominator moved from 194 to 200
live rows because migration 013 split three requirements into eleven; the numerators did not
move at all, because splitting a row cannot give it a source its parent never had.*

**Every requirement in the library names a rule and NOT ONE links to it.** No row carries
the text it is asserting, and no row records a date on which a human opened the source.

**Why this is the sharpest available statement of what `status = 'generated'` means.** The
enum value reads as a mild caveat — *a model wrote this, a person has not signed it off.*
The columns say something harder: **there is no artifact behind any of these rows at all.**
Not an unchecked link — no link. `CLAUDE.md` §3.3 is the rule this bumps against: the model
reasons excellently against an artifact and enumerates unreliably from nothing, and today
the library is the output of the second mode for all 205 rows.

**What it does NOT mean.** It does not mean the citations are wrong. Spot checks against
live eCFR text during the golden-file work found the ones checked to be accurate. It means
**nobody can tell which are accurate without repeating that work**, and the product has no
way to show a customer which is which — which is precisely what §6 says must be visible.

**Fix:** Phase 6. The unit of work is one agency at a time, because §1.1's fourth job is that
agency makes verification finite: *"verify 188 requirements" has no finish line; "verify the
41 DEQ rows" does.* Part C's assignment (11 Sep) is what makes that partition possible —
before it, every row was in one undifferentiated pile.

---

## 2. Are Oregon requirements citing Oregon rules?

**Question.** Oregon is an OSHA-approved State Plan state. Does the citation shown to an
Oregon customer name the authority that actually enforces?

```sql
select count(*) from public.requirement_templates
 where jurisdiction_layer = 'state' and jurisdiction_state = 'Oregon'
   and citation ~ '29 CFR';

select count(*) from public.requirement_templates
 where citation_federal_analogue is not null;
```

**Answer, 11 September 2026:**

| | |
|---|---|
| Oregon rows citing 29 CFR | **49** |
| rows with `citation_federal_analogue` set | **0 of 200 live** — re-measured 12 Sep |

**The column built for exactly this stands empty while 49 rows do the thing it exists to
prevent.** `citation_federal_analogue` was added in migration 007 so a requirement could say
*"this is OAR 437-002-0360, which adopts 29 CFR 1910.1200"* — the state citation in
`citation`, the federal origin recorded beside it. Instead the federal citation is in
`citation` and the state one is nowhere.

Most of the 49 are honest about it in prose — `29 CFR § 1910.1051 as adopted by Oregon
OSHA` — which is the right fact in the wrong field. Prose in a citation column cannot be
rendered as a link, cannot be checked by a script, and is not what a state inspector expects
to be shown.

**This is not an agency-assignment problem and was not fixed by Part C.** The assignment is
correct: rule 1 of `supabase/seed-data/agency-mapping.json` routes all 49 to `OR-OSHA`, not
to federal OSHA. What remains wrong is the *citation shown to the customer*.

**Fix:** Phase 6, alongside check 1, and the two are one pass per row — opening the OAR
source to record a `citation_url` is the same visit that establishes the OAR citation.

---

## 3. Does any coverage claim outrun the library behind it?

**Question.** `industry_coverage` renders the coverage strip. Does every `verified` row have
a person, a date, and requirements behind it?

```sql
select status, count(*), count(*) filter (where verified_by is null) as no_person,
       count(*) filter (where row_count = 0) as no_rows
  from public.industry_coverage group by status;
```

**Answer, 11 September 2026:** the table is **empty** in both environments; the cross product
lands with Part C. Two constraints now make the bad row impossible rather than merely
unlikely — `industry_coverage_verified_has_rows` (migration 008) and
`industry_coverage_verified_has_a_verifier` (migration 011, tested by violation).

**The one thing still soft:** `row_count` is a plain integer that nothing recomputes, so it
is a claim the library does not have to honour — and because `verified_has_rows` reads
`row_count > 0`, a typed number is also what would let a `verified` row exist over zero
requirements. Migration 011 §6b records this and the column comment says **derived, never
typed**. Re-check this whenever anything new writes to that table.

---

## 4. Does `row_count` count only LIVE requirements?

**The rule.** For every coverage row, `row_count` must equal the number of
`requirement_templates` rows that are assigned to that agency, carry that industry, **and
have `effective_to IS NULL`.**

```sql
with truth as (
  select a.short_name as sn, i.ind as industry, count(t.id) as n
    from public.agencies a
    cross join lateral unnest(a.industries) as i(ind)
    left join public.requirement_templates t
           on t.agency_id = a.id
          and t.industries @> array[i.ind]
          and t.effective_to is null        -- <<< THE WHOLE CHECK IS THIS LINE
   group by 1, 2)
select a.short_name, c.industry, c.row_count as stored, tr.n as live
  from public.industry_coverage c
  join public.agencies a on a.id = c.agency_id
  join truth tr on tr.sn = a.short_name and tr.industry = c.industry
 where c.row_count <> tr.n;     -- must return zero rows
```

**Answer, 11 September 2026:** zero rows. `sum(row_count)` across all 56 coverage rows was
**185**, against **192** live requirements of which **185** carried an agency — the other 7
being the deliberate NULLs.

> ### ⛔ **FAILING as of 12 September 2026, on BOTH environments. One row.**
>
> | agency | industry | stored | live |
> |---|---|---|---|
> | **OR-OSHA** | chemical-manufacturing | **53** | **61** |
>
> **Cause, and it is not mysterious: migration 013 split three requirements and nothing
> recounted the coverage rows.** Electronic OSHA injury-data submission became 3, Process
> Safety Management became 5, Permit-required confined spaces became 3 — all OR-OSHA, all
> chemical-manufacturing, a net **+8**, which is exactly the gap. `sum(row_count)` is still
> 185 against **193** live rows carrying an agency.
>
> **Why this is the check working rather than the check being noise.** `row_count` is what the
> product shows a customer when it says how much of an agency it covers. Nothing else in the
> system reads it, so nothing else would have noticed it drifting — no constraint, no build, no
> test. It was caught by a documentation sweep two days after it broke, which is later than it
> should have been and is still the only thing that caught it.
>
> **The fix is a recount, not an edit**, and it belongs with whatever writes coverage rows —
> a migration that splits requirements must recount the coverage rows it touched, or the
> recount must be a step the loader owns. **Filed as `TODO.md` 6.4f. Not fixed in this sweep:
> it is a data change to production and belongs in its own reviewed step.**

**Why this check exists, and it is the reason this file exists at all.**

The first implementation of the coverage cross product **counted retired rows.** It stored
`OR-OSHA = 54` and `OR-BCD = 3`; the true live counts are 53 and 2. The two extras are split
parents — `Respirable crystalline silica exposure standard` and `Boiler and pressure-vessel
registration/inspection` — each superseded by children and retired on 11 Sep.

**Migration 011's own column comment already said what the rule was:**

> *'How many **live** requirement_templates rows stand behind this coverage claim. DERIVED,
> NEVER TYPED…'*

**The intent was documented and the code did not honour it, and nothing noticed.** A comment
is not a constraint. Nothing in the database, the type system or `npm run check` can read an
English word in a column comment and enforce it — and the wrong number was internally
consistent, matched its own projection exactly, and passed every check the script had. **The
gap between a documented intent and an enforced one is precisely what this file exists to
close**, and this is the first entry that was written because that gap had already opened.

**It also does not stay small.** Library rows are versioned, never edited in place
(`CLAUDE.md` §3.2), so **retired rows accumulate forever while live ones do not**. Every
split, every superseded row, every corrected requirement adds one to the overstatement and
takes nothing away. Two today, on a library of 200; the error only ever grows, and it grows
fastest during exactly the work — Phase 6's agency-by-agency verification pass — that
produces the most splits. An error that shrinks can be left; this one had to be caught before
it was inherited.

**Now enforced** in `scripts/assign-agencies.js`: the query above runs after every write and
`die()`s on any row, so a stored `row_count` that disagrees with the live library stops the
run rather than being reported later. Tested by violating it on staging — `OR-OSHA` was set
back to 54 by hand and the check reported `stored 54, live 53` — per `CLAUDE.md` §3.7, a
check nobody has tried to break is a comment.

**Related, and not the same thing:** retired rows DO keep their `agency_id`. A row is
retired, never deleted, so that an audit pinned to it stays reproducible — and that audit
must still be able to say which regulator the requirement belonged to. Provenance is the
reason the row survives; coverage is a statement about what the library can tell a customer
today. The two questions have different answers and the schema holds both.

---

# Checks 5–12 — SPECIFIED, NOT BUILT

*Added 11 September 2026. None of these has been run. Each states the question, the query
that would answer it, and **why nothing else catches it** — that last part is the entry fee.*

---

## 5. Does every `secondary_agency_ids[]` entry point at a real agency?

```sql
select t.requirement_name, x.bad_id
  from public.requirement_templates t
  cross join lateral unnest(t.secondary_agency_ids) as x(bad_id)
 where not exists (select 1 from public.agencies a where a.id = x.bad_id);
```

**Why nothing else catches it.** `agency_id` has a foreign key. `secondary_agency_ids` is a
bare `uuid[]` and **Postgres cannot enforce element-level foreign keys on an array** — there
is no syntax for it. So an invented, mistyped or stale UUID sits in that array, matches
nothing at query time, raises no error, and simply means the second regulator silently
vanishes from the answer. The column is empty on all 200 live rows today, which is exactly why
this should be written before anything fills it.

---

## 6. Does every company have exactly one primary site?

```sql
select c.id, c.name, count(e.id) filter (where e.is_primary) as primaries
  from public.companies c left join public.entities e on e.company_id = c.id
 group by c.id, c.name having count(e.id) filter (where e.is_primary) <> 1;
```

**Why nothing else catches it.** It is **true by trigger today and checked by nothing
tomorrow.** Migration 010's `create_primary_site` fires on insert into `companies`, and a
partial unique index stops a second primary — so the invariant holds for every path that
exists *now*. It does not hold against a direct service-role insert that bypasses nothing
but happens to fail halfway, a future migration that disables the trigger, or a restore from
a backup taken before 010. TODO 1.6 promised this invariant so that **no downstream code ever
has to ask whether a company has a site**; every reader that trusts it is a reader that
breaks silently if it stops being true.

---

## 7. Is the split lineage intact?

```sql
-- a child pointing at a parent that is still live
select c.requirement_name as child, p.requirement_name as parent
  from public.requirement_templates c join public.requirement_templates p on p.id = c.split_from_id
 where p.effective_to is null;

-- a retired row with no children and nothing superseding it
select t.requirement_name
  from public.requirement_templates t
 where t.effective_to is not null
   and not exists (select 1 from public.requirement_templates c where c.split_from_id = t.id)
   and not exists (select 1 from public.requirement_templates c where c.supersedes_id  = t.id);
```

**Why nothing else catches it.** Both halves are silent in opposite directions. A child
pointing at a **live** parent means the same obligation is served twice — the customer sees
the parent *and* its four children and cannot tell they are the same rule. A retired row with
**no** children means a requirement was removed from the library with nothing put in its
place, which looks identical to a deliberate retirement. Two retired parents today (silica,
boiler); both are correct, and the check exists for the third.

---

## 8. Are there storage objects under a prefix matching no company?

```sql
-- THE BUCKET IS `company-documents`. It is not called `documents`, and this query said
-- `documents` from the day it was written until 13 Sep — so it returned zero rows against a
-- bucket that does not exist and READ AS A PASS. See the answer below.
select o.name, split_part(o.name, '/', 1) as prefix
  from storage.objects o
 where o.bucket_id = 'company-documents'
   and not exists (select 1 from public.companies c where c.id::text = split_part(o.name, '/', 1));
```

> ### ⛔ **FAILING — 13 September 2026, BOTH environments.**
>
> ```
> production : 52 objects in company-documents, 4 ORPHANED   (prefix fcde1027-4504-4adb-8a3e-a0d415275fd5)
> staging    :  4 objects in company-documents, 4 ORPHANED
> ```
>
> **And it was reported as PASSING earlier the same day.** The query named bucket `documents`;
> the bucket is `company-documents`. There is no bucket called `documents`, so the check
> returned zero rows and read as clean — **against a bucket that does not exist.**
>
> **This is check 14's own subject, in this file, about this file:** *is every checker as strong
> as the assertion it claims to make?* A check that names a non-existent object passes forever
> and is indistinguishable on the page from one that has been satisfied. It is the same class as
> `CLAUDE.md` §3.7's NULL-swallowing CHECK constraint, and the same class as check 20 passing
> vacuously on an empty table — except that one is **recorded** as vacuous and this one was not.
>
> **The four orphans on production are the four TODO 0.7 has listed since 9 September.** They
> were found by accident then, the check was written to catch them, and the check never could.
> They are customer files with no owner, no policy that matches, and no route that lists them.

**Why nothing else catches it.** **Four already existed in production and were found by
accident** (TODO 0.7). Storage is scoped by a path prefix, not by a foreign key — nothing
relates a file to a company except a string, so deleting a company leaves its files behind
and nothing reports it. An orphan is customer data with no owner, no access policy that
matches, and no route that lists it: invisible in the product and present on disk. This is
the one check on this page that is a **privacy** question rather than a correctness one.

---

## 9. Do the industry slugs agree across the tables that join on them?

```sql
select distinct i.ind as slug_in_library
  from public.requirement_templates t cross join lateral unnest(t.industries) as i(ind)
 where not exists (select 1 from public.industry_coverage c where c.industry = i.ind)
union all
select distinct c.industry
  from public.industry_coverage c
 where not exists (select 1 from public.requirement_templates t cross join lateral unnest(t.industries) as i(ind)
                    where i.ind = c.industry);
```

**Why nothing else catches it.** `requirement_templates.industries[]`, `industry_coverage.industry`,
`agencies.industries[]` and `companies.industry` are **four free-text columns with no shared
list and no foreign key between any of them.** `chemical-manufacturing` against
`chemical_manufacturing` produces a coverage row describing a set of requirements that does
not exist, and both sides look perfectly healthy in isolation. The signup dropdown is built
by flattening `industries[]` at runtime, so a typo also silently creates a new industry a
customer can select and nothing serves. `cannabis` was first written during the Phase 2.1
agency load and is currently carried by 25 agency rows and **zero** requirements — so the
second half of this query already has something to say.

---

## 10. Do production and staging still match, object for object?

Run the census on both and diff: tables, columns with type/nullability/default, constraints
with definitions, indexes, policies with their `USING` and `WITH CHECK`, triggers, functions,
enum values, table ACLs and RLS flags.

**Why nothing else catches it.** Migrations are applied to the two databases at different
times by different commands, and **a migration that half-applied to one leaves no marker
saying so.** Drift shows up later as a query that works locally and 400s in production — the
`/api/industries` failure in §0.4 was exactly that shape and nothing noticed for a day. Last
run 11 Sep after Phase 2.1: **615 objects each, 0 differences**, plus 23 tables with
identical ACLs and RLS flags and `anon` holding nothing on either side.

**Run again 11 Sep after Phase 6.2: 619 objects each, 0 differences**, plus 90 switches
compared row-for-row across 13 fields (id, label, scope, value_type, volatility,
determination_source, jurisdiction_variant, allowed_values, thresholds, question_plain,
domain, both dependency columns and a hash of notes) with 0 differences, the same 35
dependency edges as a set in both directions, and the same graph depth map — 55 roots and 35
children on each side.

**Run again 12 Sep after Phase 7.2's schema — migration 017 on both environments: 840 objects
each, 0 differences, byte-identical (sha256 `6ecf7467ec5ee534…`).** Up 41 from 799, all
attributable to 017: one table, its columns, constraints, indexes, one policy, four enum values.

**Run 12 Sep after Phase 4.1 — migrations 015 and 016 on both environments: 799 objects
each, 0 differences, the two outputs byte-identical (sha256 `2407ffbcebcddc66…`).** The count
moved 798 → 799 for one reason and the census can say which: `g_function` 5 → 6,
`close_and_replace_obligations`. **That is the point of storing the census in a file** — a
count that moves by one and can be attributed is information; the same count arrived at by
retyping the query is noise.

**Run 12 Sep after Phase 6.3 — migrations 013 and 014 and the expression load:**

| Compared | Staging | Production | Differences |
|---|---|---|---|
| Schema objects (`supabase/census.sql`) | 798 | 798 | **0** — outputs byte-identical, same sha256 |
| ↳ tables · columns · constraints · indexes | 25 · 367 · 107 · 74 | same | 0 |
| ↳ policies · triggers · functions · enum values | 70 · 13 · 5 · 87 | same | 0 |
| ↳ table ACLs · RLS flags | 25 · 25 | same | 0 |
| `requirement_templates`, keyed on `requirement_name` | 205 rows / 200 live / 199 expressions | same | **0** — same sha256 |
| `switches`, 13 fields row-for-row | 95 / 40 edges / 6 with thresholds | same | **0** |
| Dependency graph walked | 95 nodes reached, 55 roots, 40 children, max depth 1, no cycle | same | **0** |
| `company_chemicals` · `regulated_substances` | exists, 0 rows · 0 rows | same | 0 |
| Switch ids referenced by an expression | 83 referenced, **0 dangling**, 12 unreferenced | same | 0 |

**The census is now `supabase/census.sql`**, and that is the substantive change. This check had
produced **673**, then **619**, now **798** — three numbers from three censuses written from
scratch, none of them a regression and none of them comparable to the others. Its own note
already said the census must be the same one every time; it was not, because it existed only as
a query someone retyped. A number whose definition is not stored cannot distinguish drift from
rewording, and this check exists to detect drift.

*Two traps the file now documents, both hit while writing it:* the Supabase CLI takes SQL as a
positional argument, so a file starting with `--` comments is parsed as flags — the command
prints its own help, the pipeline compares **two empty outputs and reports them identical**, and
the check passes having checked nothing. Hence `/* */`, and hence **assert a non-zero object
count before trusting a clean diff**. And UUID primary keys are generated independently in each
database, so joining `requirement_templates` on `id` across environments reports 34 spurious
differences; the natural key is `requirement_name`, which is unique per live/retired state (0
duplicates on both sides, verified).

---

## 11. Is every count asserted in a document still true?

The documents assert numbers constantly: 205 requirements, 200 live, 33 agencies, 56
coverage rows, 71 policies, 64 through `auth_company_id()`, 615 objects, 49 Oregon rows
citing 29 CFR. Each is a claim with a date. This check re-derives them and reports the ones
that have moved.

**Why nothing else catches it.** **`STATUS.md` has been wrong about migration state twice**,
both times written from recollection rather than read from the database, and both times
caught only because a pre-flight happened to run. A number in a document is a measurement
that stops being re-taken the moment it is written down, and it decays silently — nobody
reads a document to check its arithmetic. This check is why every number in this file carries
the date it was read.

Start with `STATUS.md`, this file, and `TODO.md`'s Phase 2 inheritance block, because those
three are the ones acted on.

---

## 12. Does every `agency_id` point at an agency that still exists?

```sql
select t.requirement_name, t.agency_id
  from public.requirement_templates t
 where t.agency_id is not null
   and not exists (select 1 from public.agencies a where a.id = t.agency_id);

-- and the near miss the FK allows:
select a.short_name, count(t.id) as orphaned_if_deleted
  from public.agencies a left join public.requirement_templates t on t.agency_id = a.id
 group by 1 having count(t.id) > 0;
```

**Why nothing else catches it.** The foreign key is **`ON DELETE SET NULL`**. Deleting an
agency therefore **silently un-assigns every requirement pointing at it** rather than
refusing — 53 requirements would quietly lose their regulator if somebody removed the
`OR-OSHA` row, and the only symptom is a coverage number dropping. The first query can only
fire if the FK itself is ever dropped; **the second is the one that matters**, because it
shows the blast radius *before* a delete rather than after. `scripts/load-agencies.js`
already refuses to delete agencies for this reason and reports them instead.

---

## 13. Is the switch dependency graph still acyclic, and does every edge resolve?

**A new class of invariant, added 12 September 2026 with Phase 6.2.** The first thing in this
schema whose correctness is a property of the *shape of a set of rows* rather than of any
single row.

```sql
-- (a) every depends_on_switch points at a switch that exists
select s.id, s.depends_on_switch from public.switches s
 where s.depends_on_switch is not null
   and not exists (select 1 from public.switches p where p.id = s.depends_on_switch);

-- (b) every switch is reachable from a root. An unreachable one is in a cycle.
with recursive walk as (
  select id from public.switches where depends_on_switch is null
  union all
  select s.id from public.switches s join walk w on s.depends_on_switch = w.id)
select (select count(*) from walk) as reachable, (select count(*) from public.switches) as total;

-- (c) every company_switches row's (switch_id, scope) matches what switches declares
select cs.id, cs.switch_id, cs.scope from public.company_switches cs
  join public.switches s on s.id = cs.switch_id
 where s.scope <> cs.scope;
```

**Answer, re-measured 12 September 2026, both environments:** 0 dangling edges · **95 of 95
reachable** · 0 scope mismatches · **40 edges** · 55 roots and 40 children, max depth 1, and the
two depth maps compared row for row with 0 differences.

**Why nothing else catches it.** `switches_no_self_dependency` checks
`depends_on_switch IS DISTINCT FROM id` — **that stops `A → A` and nothing else.** `A → B → A`
satisfies both rows' CHECK, satisfies the foreign key, and is accepted. **A cycle is not
expressible as a CHECK constraint at all** — detecting one needs recursion and a CHECK sees
one row at a time.

And a cycle is not untidy, it is **unwalkable**: nothing can decide which fact to establish
first, so the determination gate would either loop or pick arbitrarily. Picking arbitrarily is
the failure that looks like working software.

**Query (c) is the one that will eventually matter most.** The composite FK
`(switch_id, scope) → switches(id, scope)` enforces it *at write time* — verified in both
directions on 12 Sep, a site-only switch claimed as `company` and a company-only switch
claimed as `site` were each refused. But **if a switch's own `scope` is ever changed after
values exist**, the FK is checked against the new row and existing `company_switches` rows can
be left describing a scope their switch no longer declares. Run (c) after any change to
`switches.scope`.

**Owner:** `scripts/load-switches.js` walks the graph before writing and again from the
database afterwards, and refuses the whole file on a cycle. **Proven by seeding one** —
`--prove-cycle-check` runs the real file (0), the real tanks/gallons pair reversed (refused),
a three-node cycle (refused), and a four-deep acyclic chain (allowed).

---

## 14. Is every checker as strong as the assertion it claims to check?

> ### THREE INSTANCES NOW, AND THE THIRD IS ABOUT NEGATIVE TESTS — 15 Sep
>
> | | What passed, and why it should not have |
> |---|---|
> | **Check 8** | queried bucket `documents`; the bucket is `company-documents`. **Zero rows against a bucket that does not exist, read as clean.** Four orphaned customer files on production |
> | **Check 20** | passes vacuously on an empty table — **and says so.** This is the correct form |
> | **Two guard probes** (§81) | returned the expected status code **for the wrong reason** |
>
> **The third is the one worth generalising.** Probing `air_permit_required` for a bad enum value
> returned `400` — from the **site-scope guard**, which fires first. Probing "another company's
> entity" used the caller's **own** entity and returned `200`, correctly. **Both would have been
> recorded as passing.**
>
> **A guard test must FAIL when the guard is removed. A probe that trips an EARLIER guard has
> tested the earlier guard.** Ordered guards make this easy to do by accident: every one returns a
> refusal, and the status codes agree.
>
> **Construct the input so only the guard under test can refuse it, and read the error BODY —
> the status code is not the evidence.**



**Added 12 September 2026, after a checker reported PASS on a partial match.** This one is
about the test harness rather than the data, and it earns its place for the reason at the head
of this file: **a wrong answer here reaches a customer and nothing else notices** — because
the thing that would normally notice is the suite, and the suite is what is broken.

**The class:** *a test harness whose checks are weaker than its assertions is indistinguishable
from a passing suite.*

It is worse than a harness that skips, and the difference matters. A SKIP is **visible** — the
run prints a count and says it is not a pass. A checker that tests half its assertion prints
**green**, and green is the strongest signal a suite can send.

**How to run it.** For every `expected[]` entry in `tests/golden/*.json`, compare the case's own
`checkable` field against what `scripts/run-golden.js` implements, and ask *does the checker
test everything the assertion names?*

**Answer, 12 September 2026 — 23 assertions audited:**

| | |
|---|---|
| implemented and matching | 13 |
| **implemented but WEAKER than the assertion** | **3 — all now fixed** |
| checkable field naming the wrong layer | 1 — the case text was reworded, not the checker |
| marked HUMAN (a person reads the answer) | 7 |
| no checker, reported SKIP | 7 |

**The three that were weaker:**

1. **`gate-asks-for-packing-group`** — the case asserts *"artifact matches /SDS|safety data
   sheet/ AND question matches /packing group/"*. The checker searched the whole `ask` object
   for the string "packing group" and never looked at `artifact` at all. **It produced a real
   false pass**: a run whose `artifact` was `null` and whose question never mentioned an SDS
   was reported green.
2. **`jurisdiction-counts-as-known`** — the case requires a fact matching
   `/worksite (state|county|city)/` **with** `source = 'ai_from_profile'`. The checker tested
   the two conditions against the whole blob separately, so any fact could satisfy the first
   while a different entry satisfied the second.
3. **`answer-may-hedge-here`** — the case names the compile-time assertion
   `_ChecklistMayNotHedge` by id. The checker grepped the two interfaces and never checked the
   assertion existed, so deleting it would have left this green while removing the only thing
   making the absence *enforced* rather than merely current.

### 14.1 And fixing one of them found a second, larger bug

Strengthening `gate-asks-for-packing-group` turned it red — **four runs out of four**, which
ruled out variance. Isolating it found the cause was not the gate:

**`scripts/run-golden.js` was building its own version of the gate's context.** Its own header
says it rebuilds the *prompt* from `lib/determinationGate.ts` rather than holding a copy,
because *"a copy of the prompt would be a copy that drifts — and the drift would be silent,
because the tests would keep passing against the stale copy."* It then **hand-rolled the
context** and that copy drifted exactly as the comment predicted: it emitted `id: label` per
switch, where the module emits the `ask as:` wording and the `only if` dependency.

**Ninety bare id-and-label lines pushed the model toward bare questions naming no artifact.**
So the runner was measuring a gate the routes do not use, and reporting PASS on it.

**Fixed structurally rather than by patching the copy:** the context builder moved to
`lib/gateContext.ts` — **a file with no imports at all**, so a plain Node script can load it
through native type stripping and cannot resolve a `@/` path alias. Both the module and the
runner now import the same function, and neither builds its own. Verified: neither file
contains a vocabulary-building loop any more.

**The general rule this leaves:** *a harness may rebuild nothing. Whatever it needs from the
code under test, it imports.* Rebuilding the prompt from source was the right instinct applied
to half the input.

---

## 15. Does every model this project can be pointed at accept the parameters we send it?

**Added 12 September 2026, after finding a one-line environment change that would have taken
out six call sites at once.**

```
For each model in {AI_MODEL, AI_MODEL_CRITIQUE, AI_MODEL_JUDGEMENT, AI_MODEL_PROSE}
and each model those could plausibly be set to:
  send a 4-token request WITH temperature, and one WITHOUT.
  Record which are accepted.
```

**Answer, 12 September 2026, probed against this account:**

| Model | `temperature` |
|---|---|
| `claude-opus-5` | **REJECTS** — 400 `` `temperature` is deprecated for this model `` |
| `claude-sonnet-5` | **REJECTS** |
| `claude-fable-5-1` | **REJECTS** |
| `claude-sonnet-4-5` | accepts |
| `claude-haiku-4-5-20251001` | accepts |
| `claude-opus-4-1` | **does not exist on this account** — 404 |
| `claude-opus-4-20250514` | does not exist; past end-of-life |

**Why nothing else catches it.** `npm run check` type-checks the *shape* of `AskAIOptions` and
has no idea which values a given model will refuse. There is no test that calls a model. And
the failure is **not** at build time or deploy time — it is at the first request after
somebody changes an environment variable.

**Six call sites pass `temperature: 0.1`:** the determination gate, both `/api/audits` classify
calls, the audit match call, and document review. **`AI_MODEL=claude-sonnet-5` reads like
ordinary maintenance** and would have 400'd every one of them — the gate returning nothing on
a route with no way to say so, and every audit failing at classification. **It would have been
found as a production incident, by a customer.**

**Now handled, not merely known:** `lib/ai.ts` drops the parameter for models that do not
accept it rather than letting the call fail, and logs once so the drop is greppable. Matched on
the major version immediately after the tier name, so `claude-sonnet-4-5` and
`claude-haiku-4-5-…` are correctly excluded — their major version is 4.

**Run this check before any model change, and add a row.** The parameters a model accepts are
part of its contract, and **that contract is a fact about an account rather than about the
world** — checked the way a constraint name is checked (`CLAUDE.md` §3.7), from the thing
itself, never from memory. `claude-opus-4-1` was named from memory in the first draft of the
task routing and does not exist.

---

## 16. Do two runs of the same audit agree with each other?

**Added 12 September 2026. The original diligence said readiness numbers differed between
runs; this is that claim, measured.**

```sql
select company_id, source_name, count(*) as runs,
       min(readiness_satisfied) as min_sat, max(readiness_satisfied) as max_sat,
       min(readiness_needs_work) as min_work, max(readiness_needs_work) as max_work
  from public.audits
 group by company_id, source_name
having count(*) > 1;
```

**Answer, from `baseline-outputs/audits.json` — six audits of ISO 9001:2015, the same 272-item
standard, the same company, across two days in July:**

| | satisfied | needs_info | needs_work | distinct documents cited |
|---|---|---|---|---|
| 24 Jul 16:17 | **6** | 49 | 217 | 11 |
| 24 Jul 16:45 | 9 | 54 | 209 | 16 |
| 24 Jul 17:26 | 7 | 26 | 239 | 15 |
| 25 Jul 16:57 | 15 | 74 | 183 | 18 |
| 25 Jul 17:03 | 13 | 68 | 191 | 19 |
| 25 Jul 17:04 | **21** | 69 | 182 | 19 |

**A 3.5× spread on the headline number.** In the worst run, **219 of 272 items cite no document
at all**.

**Why nothing else catches it — and this is the part that matters.** Each run is internally
consistent: the counts are computed in code from that run's own verdicts (`CLAUDE.md` §3.2),
so every number is arithmetically correct. Read one audit and there is nothing wrong with it.
**The error is only visible across runs**, and nothing in the product ever looks across runs.

**The critic cannot help here, and it is worth saying why.** Stage 5 reviews **one output**. It
has no access to the previous run and no way to know the previous run disagreed. It will
correctly report that a verdict is built on 11 documents out of a larger set — and it did, on
the worst run — but *"the same question answered twice gives different answers"* is a property
of a **pair** of outputs. **Consistency is observable only by a probe across runs**, which is
`TESTING.md` (c)'s category and needs no regulatory knowledge: both answers cannot be right.

**What this does NOT tell us:** which run is closer to correct. It tells us at most one is, and
probably neither. `CLAUDE.md` §3.2 requires resolution to be deterministic — same inputs,
identical output — so once the resolution engine exists (4.1) this check becomes a hard
assertion rather than an observation. **Until then it is the sharpest measurement of the
product's central problem that exists.**

---

## 17. Does every fact the gate establishes reach the call that needs it?

**Added 12 September 2026, after a fact the product already had failed to reach the model
writing the answer.**

```
For each stage that produces facts, and each stage downstream of it:
  is the producing stage's output actually passed, or only returned to the client?
```

**Answer, 12 September 2026:** `gate.resolved.known` now reaches the generating call in
`/api/chat` and is written by the same function the gate uses. **Before the fix it went into
the HTTP response and nowhere else.**

**Why nothing else catches it.** `g.resolved` was referenced, typed, returned and rendered —
so it is not dead code, and no linter or type-checker has an opinion about whether a value
that *is* used is used *everywhere it should be*. The symptom was a model giving a reasonable
answer to a question it had not been told was settled: **asked about "our Hillsboro plant" it
branched on Hillsboro, OHIO**, for a company whose Oregon site the gate had already resolved.
That reads as a model failure and is a plumbing failure.

**It was found by a model comparison, not by a test** — and only because the critic *was*
given the facts and flagged the answer for asking about one of them. **The asymmetry is what
made it visible.** `DECISIONS.md` §41.

**Run this whenever a stage is added.** The pipeline has six stages specified and two built;
each new one produces something, and the question *"who downstream needs this, and do they
get it?"* has to be asked deliberately, because a value that is returned to the client looks
exactly like a value that is wired up.

---

## 18. Does an incomplete chemical inventory still refuse to clear a requirement?

**Added 12 September 2026. `DECISIONS.md` §45.** This is the check for a compensating control,
and it exists because the last one that was assumed rather than tested turned out to be absent
from the data **and** unable to work as described.

```sql
-- Sites whose inventory contains a row nothing can evaluate.
select e.id as entity_id, count(*) as unevaluable_rows
  from public.company_chemicals c
  join public.entities e on e.id = c.entity_id
 where c.cas_number is null
    or not exists (select 1 from public.regulated_substances r where r.cas_number = c.cas_number)
    or c.max_quantity is null or c.unit is null
 group by e.id;

-- For each of those, every list must answer NULL unless a known substance is already over
-- its own threshold. Anything answering FALSE is a silent wrong clear.
select e.id,
       public.substance_inventory(e.id,'ehs')  as ehs,
       public.substance_inventory(e.id,'tri')  as tri,
       public.substance_inventory(e.id,'psm')  as psm
  from public.entities e;
```

**Answer, 12 September 2026:** `company_chemicals` is empty in both environments, so there is
nothing to check yet — **and that is exactly when to write the check rather than after the
first customer inventory arrives.** The behaviour is proven instead by migration 014's five
constructed cases.

**Why nothing else catches it.** A `false` from an inventory test is indistinguishable from a
`false` from a genuine determination. Both render as "does not apply"; neither raises an error;
the row count is right either way. **The only way to tell them apart is to know whether every
row in the inventory could be evaluated**, and nothing in the product surfaces that today.

**And the rule behind it, which outlives this table: where a design tolerates a risk because
something else catches it, the something else is part of the design.** It gets a name, a query
here, and a test — or it is a belief, and beliefs do not hold under a customer's data.

---

# The standard for these checks

**A sweep that has only ever said "clean" is untested.** It is indistinguishable from a
sweep that is querying the wrong column, filtering everything out, or silently erroring into
an empty result — and it will keep saying "clean" through all three. `CLAUDE.md` §3.7 says
this about constraints; it is truer of checks, which have no database enforcing them.

**So every check on this page must be seeded with known-bad state and confirmed to fire
before it is trusted.** Check 4 was proven this way: `OR-OSHA`'s stored `row_count` was set
back to 54 by hand on staging, the query was run, and it reported `stored 54, live 53` before
the correct value was restored. That took two minutes and is the difference between a check
and a decoration.

Where the bad state cannot be created safely — check 8's orphaned storage objects, for
instance — create it on staging, never on production, and record in this file which
environment the proof was run in.

---

# `npm run audit` comes AFTER Phase 2

**Deliberately, and not because of effort.** Half the invariants worth checking describe
things that do not exist yet:

- **Resolution is not built** (Phase 4.1). The safety properties in `CLAUDE.md` §3.2 are the
  most important things this file will ever check — `unknown` never resolving to
  `does_not_apply`, expired evidence never satisfying a requirement, readiness computed in
  code and never by AI — and **not one of them can be checked today**, because `obligations`
  is empty in both environments and nothing writes to it.
- **Evidence is empty.** `obligation_evidence` has no rows, so every check about expiry,
  contribution and confidence has nothing to run against.
- **The runtime pipeline is Phase 2.** Determination gate, critic pass, agency scoping — the
  behaviours most worth asserting are being written now and their shape is not settled.

Writing the runner now would fix its structure around the third of the checks that happen to
be expressible today, and that third is the least important. **Build it once, after Phase 2,
against the full set.** Until then these are run by hand and the answers are written here
with their dates — which is slower, and is not the same as not doing them.

---

## 19. Does every switch a condition names actually exist?

```sql
with used as (
  select distinct trim(both '"' from
           jsonb_path_query(applies_expression, 'lax $.**.switch')::text) as s
    from public.requirement_templates
   where applies_expression is not null)
select s from used
 where s not in (select id from public.switches);   -- must return zero rows
```

**Answer, 12 September 2026, both environments:** zero rows. **83 distinct switches referenced,
0 dangling**, 12 switches referenced by nothing (4 of those are context rather than triggers —
`TODO.md` 6.4d).

**Why nothing else catches it.** A condition naming a switch nobody defined is **valid JSON**.
It loads, it stores, it evaluates — to `unknown`, forever. And `unknown` is the correct,
designed answer for a fact we do not have, so the requirement it guards simply never resolves
in either direction and **no error is raised anywhere**. There is no foreign key to lean on:
the switch id lives inside a `jsonb` document, not in a column. `npm run check` cannot see into
it, and the golden-file set would not either, because the pipeline behaves *correctly* given a
missing fact.

`load-expressions.js` refuses the whole file on an unknown switch, which closes the write path.
**This check exists because the write path is not the only path** — a row can be updated in the
database directly, and a switch can be renamed or deleted after the conditions were written.
The loader asks "is this file valid"; this asks "is the library still consistent".

---

## 20. Is every CAS number in a customer's inventory one we hold thresholds for?

```sql
select c.id, c.cas_number
  from public.company_chemicals c
  left join public.regulated_substances r on r.cas_number = c.cas_number
 where c.cas_number is not null and r.cas_number is null;   -- must return zero rows

-- and, separately, the size of the unevaluable population:
select count(*) filter (where cas_number is null)            as unidentified,
       count(*) filter (where max_quantity is null
                          or unit is null or unit <> 'lb')   as unquantified,
       count(*)                                              as total
  from public.company_chemicals;
```

> ### ⊘ **SKIPPED, not passed — 13 September 2026.** `npm run audit:data`
>
> ```
> ⊘ SKIP  check 20   every inventory CAS is in regulated_substances
>         company_chemicals holds 0 rows — there is no inventory to check.
>         This check has still never refused anything; it is UNTESTED, not passing.
> ```
>
> **This check used to report a pass.** It was a hard query against an empty table, which
> returns zero rows and therefore "clean" — and a check that cannot fail is indistinguishable
> from one that is passing. That is check 14's own finding turned on this file.
>
> **It is now a hard assertion behind a precondition**, and the precondition announces itself
> when it does not hold. The runner's exit line separates the two states the old form conflated:
> `0 passed · 0 failed · 4 SKIPPED`, followed by *"4 check(s) NEVER RAN. They are untested, not
> passing."* **A skipped check that says so is honest; a soft one that always passes is not.**
>
> Three checks were added alongside it, all guarded the same way: **20b** the unevaluable
> proportion of an inventory (a product signal — if most of a customer's chemicals are
> unidentified, every threshold answer is `unknown` and the product is honest and useless at
> once), **20c** every stored CAS against its own check digit (§48, and deliberately
> reimplemented in the script so it can refuse a row even if `lib/` changes), and **21** that
> `stated`/`implied` determinations carry the quote and document their class requires.

**Previous answer, 12 September 2026, both environments:** zero rows — **vacuously, because
`company_chemicals` holds 0 rows and `regulated_substances` holds 0 rows.** Seeding the
reference table is `TODO.md` 6.4b. **A vacuous pass is recorded as vacuous**; this check has
never refused anything and by the standard in "How to add a check" is therefore untested.

**Why it exists anyway, and why the second query matters more than the first.** The first query
is largely guarded by a foreign key (`company_chemicals.cas_number → regulated_substances`), so
it should stay at zero by construction. **The second query is the one with no constraint behind
it**, because `cas_number` is *deliberately nullable*: a site can tell us it has a drum of
"parts washer solvent" before anyone works out what is in it, and recording that is better than
recording nothing. Migration 014 makes such a row return `unknown` rather than `false`
(`DECISIONS.md` §45).

**So the number to watch is not a violation count — it is a proportion.** If most of a
customer's inventory is unidentified, every threshold question they ask comes back `unknown`,
and the product is honest and useless at the same time. That is a *product* signal, not a data
error, and no other check would surface it.

---

## 21. Does any condition assert a number the rule does not say?

```
npm run expressions        # dry run; warns per row, refuses nothing
```

**Answer, 12 September 2026:** **2 warnings out of 199 conditions**, both known and both
recorded with their reasoning:

| Requirement | Number | Status |
|---|---|---|
| `Electronic submission of Form 300A — 20-249 employees` | `250` | The rule's text says "20-249"; the condition says `< 250`. The same boundary written as an exclusive bound — **accepted** |
| `Oil Facility Response Plan determination` | `1320` | 1,320 gallons is the SPCC threshold and is stored on `oil_storage_aboveground_gallons`; it does not appear in **this row's** trigger prose — **accepted, flagged medium** |

**Why nothing else catches it.** A fabricated threshold is **not a bug in any sense a machine
can detect**: the JSON is well-formed, the type is right, the switch exists, and the number is
usually a real number from a real regulation. The one that shipped was imported from a
*neighbouring* rule — correct in its own context, wrong here. `DECISIONS.md` §44 is the rule
(a threshold must appear in the rule's own text, in that unit) and §44.1 generalises it: a
proxy is permitted, a proxy with a fabricated magnitude is not.

**This check is a warning and not a refusal on purpose.** The two above are legitimate and a
hard failure would train people to bypass it. **The test of the check is not that it returns
zero — it is that every non-zero answer has a name, a reason and a decision beside it**, which
is what the table is.

---

## 22. Does any function in `public` hold EXECUTE for a role that should not have it?

```sql
-- aclexplode, NOT a LIKE on the ACL text. grantee = 0 IS PUBLIC, unambiguously.
select p.proname,
       case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join lateral aclexplode(p.proacl) a on true
 where n.nspname = 'public'
   and (p.proacl is null                         -- NULL acl = DEFAULT = PUBLIC holds EXECUTE
     or (a.privilege_type = 'EXECUTE' and a.grantee = 0))
 order by p.proname;
```

> **⚠️ Do NOT pattern-match the ACL text for this.** The first version of this check used
> `proacl::text like '%=X/%'` and reported **PUBLIC can execute `close_and_replace_obligations`**
> — a false alarm, because `postgres=X/postgres` also contains `=X/`. Only an entry whose
> grantee is *empty* is PUBLIC, which in text means a leading `=`, and a `like` that gets that
> right is one nobody will read correctly six months from now. `aclexplode` says what it means.
> **Caught by running the check against a function whose grants were known-correct** — the
> negative control that `HOW-WE-BUILD.md` §3 asks for, which is the only reason it was not
> written into this file as a finding.

**Answer, 12 September 2026 — re-measured with `aclexplode` on BOTH environments, identical:
one function, `substance_inventory`.**

| Function | EXECUTE held by | Verdict |
|---|---|---|
| `close_and_replace_obligations` | `postgres`, `service_role` | ✅ correct — migration 016 revokes explicitly. **PUBLIC holds nothing** |
| `auth_company_id` | `postgres`, `anon`, `authenticated`, `service_role` | ✅ intentional — every RLS policy calls it |
| **`substance_inventory`** | `postgres`, `service_role` | ✅ **CLOSED 13 Sep by migration 019.** PUBLIC, anon and authenticated all revoked |

> ### Re-run 13 September 2026, across EVERY function rather than the one under suspicion.
> Three still hold PUBLIC EXECUTE, and **all three are benign — for two different reasons, both
> worth writing down so the next person does not re-raise them:**
>
> | Function | Returns | Why the grant is inert or required |
> |---|---|---|
> | `set_updated_at` | **`trigger`** | A function returning `trigger` **cannot be called directly** — Postgres refuses it outside a trigger context. Used by 12 triggers. The grant is unreachable |
> | `create_primary_site` | **`trigger`** | Same. Used by 1 trigger |
> | `array_is_ascending(numeric[])` | `bool` | IMMUTABLE, SECURITY INVOKER, **takes an array and touches no table** — its body reads `generate_subscripts`, not data. It backs migration 012's CHECK on `switches.thresholds`, so **anyone permitted to write that table must be able to execute it**. Revoking it would break the constraint for every writer |
>
> **So check 22 now passes**, and the rule it leaves behind is sharper than "no function may be
> public": *a function may hold PUBLIC EXECUTE when it is unreachable (returns `trigger`) or
> when it reads no data and a constraint depends on it.* Anything else that appears in this
> query is a finding.

**It leaks nothing today, and that is luck rather than design.** The function is `SECURITY
INVOKER` and reads `company_chemicals`, on which `anon` holds no grant at all, so an
unauthenticated call returns nothing. **The protection is a table grant, not the function
grant** — exactly the compensating-control shape `DECISIONS.md` §45 says must be named and
tested or it is a belief. Revoking it is `TODO.md` 4.2b.

**Why nothing else catches it.** `CLAUDE.md` §3.6 records "not granting is not denying" for
tables; **the same default exists for functions and is not written down anywhere** — Postgres
grants EXECUTE on every new function to PUBLIC, so a `create function` with no revoke is open
by default. `npm run check` cannot see it, and RLS does not apply to a function body.

> ### ⚠️ THE QUERY ABOVE READS `pg_proc.proacl` ON PURPOSE. DO NOT USE `information_schema.role_routine_grants`.
>
> **That view is filtered to roles the CALLER belongs to**, and it returns **zero rows** here —
> so a check written against it passes vacuously, finds nothing, and reports clean. It is the
> same trap that produced the 673-object census in check 10, one layer down.
>
> **Migration 016's own grant-verification block uses that view**, found immediately after
> applying it: its "has anything leaked?" half can only ever find nothing, and its
> "can service_role execute?" half passed only because the migration runs as `postgres`, who
> does see the grants. The ACL it was checking is in fact correct — verified independently
> with the query above — so nothing shipped wrong. **The check was weaker than its assertion,
> which is check 14's category applied to SQL.** The migration is not being edited after the
> fact; the correction is this check, and `TODO.md` 4.2b carries the revoke that will re-verify
> properly.

---

## 23. What fraction of the switch vocabulary can we actually populate?

```sql
select determination_source,
       count(*) as switches,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
  from public.switches group by 1 order by switches desc;
```

**Answer, 12 September 2026, both environments.**

| `determination_source` | Switches | What populates it | Built? |
|---|---|---|---|
| `documents` | **53** | Phase 7.2's determination pass | being built |
| `user_answer` | **29** | An ask path | ⬜ |
| `profile` | **11** | Signup collecting the field | ⬜ |
| `computed_by_requirement` | **2** | 6.3b wiring `produces_switch` | ⬜ |

> ### **42 of 95 switches — 44.2% of the vocabulary — have NO determination path even after 7.2 ships.**

**This is a coverage number and it belongs with the other coverage numbers.** `CLAUDE.md` §6
says the product states plainly what is verified, partial and not built, and this is the same
claim one layer down: *what fraction of the facts our own model is built on can we actually
find out?* Someone should be able to ask that and get an answer rather than a note.

**Three things the number makes visible that prose did not:**

- **The document pass is the majority of the vocabulary but not the majority of the value.**
  53 switches are document-sourced and they touch 88 of 199 requirements. The 29 `user_answer`
  switches touch 36 and **fully resolve 31**. So 25 questions buy 31 requirements — about 1.2
  each, which is an honest and modest return, and worth knowing before anyone designs a
  25-question onboarding form.
- **The 11 `profile` switches are the highest-leverage group and the smallest.** `has_employees`
  and `employee_count` alone gate 49 requirements transitively, and nothing collects either.
- **4 of the 29 `user_answer` switches are referenced by no requirement at all**, so an ask path
  built over the whole set would ask four questions that change nothing.

**Why nothing else catches it.** Every other check in this file asks whether what we have is
right. This one asks how much of it we can ever have. A vocabulary can be complete, consistent,
acyclic and fully expressed in the library — all of which is true today — and still be
unpopulatable for 44% of its entries, with no query anywhere returning a number about it.

**Re-run after any phase that adds a determination path**, and expect the figure to move in one
direction only. If it ever rises, a switch was added without deciding how it gets answered.

---

## 24. Is `user_locked` protected by anything other than the application?

```sql
-- policies that mention it
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'company_switches'
   and (qual like '%user_locked%' or with_check like '%user_locked%');

-- constraints or triggers that mention it
select conname from pg_constraint
 where conrelid = 'public.company_switches'::regclass
   and pg_get_constraintdef(oid) like '%user_locked%';
select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where c.relname = 'company_switches' and not t.tgisinternal;
```

**Answer, 12 September 2026, both environments: ZERO policies, ZERO constraints, ZERO triggers.**

`company_switches_update` reads, in full:

```
USING       (company_id = auth_company_id())
WITH CHECK  (company_id = auth_company_id())
```

**It checks tenancy and nothing else.** Any authenticated caller may update any row of their own
company, including one a person has locked. **`user_locked` is enforced entirely in
`lib/switchDetermination.ts`, and only for callers that go through it.**

**Why this is the shape of gap worth a standing check.** The rule is real, it is written down
(`DECISIONS.md` §24.1, §49), and it is obeyed by the one module that exists today. The failure
mode is not that the rule is wrong — it is **a route written six months from now, by someone who
does not know the rule exists, doing an honest `update company_switches set value = …` under a
user token.** Nothing refuses it. RLS passes, the types pass, `npm run check` passes, and a
person's stated fact is replaced by an inference with no error anywhere.

`CLAUDE.md` §3.6 is explicit that **RLS is the security boundary and route guards are a UX
affordance**. A rule that lives only in one library module is a route guard wearing a different
coat.

**The fix, when it is done, is a trigger rather than a policy** — a policy cannot compare the old
row to the new one, and the rule is *"you may not change `value` on a row where `user_locked` is
true unless you are also setting it from a `user_set` source"*, which is a statement about the
transition. Filed as `TODO.md` 7.2c.

**Until then this check is the control**, and it must be re-run whenever a route gains write
access to `company_switches`. A non-zero answer to any of the three queries means the gap has
been closed and this check should record how.

---

## 25. Does every view over a tenant table run as the CALLER?

```sql
select c.relname, array_to_string(c.reloptions, ',') as options
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'v'
   and not coalesce(array_to_string(c.reloptions,',') like '%security_invoker=on%', false);
   -- must return zero rows
```

**Answer, 13 September 2026, both environments: zero rows.** One view exists,
`obligation_evidence_state`, and it carries `security_invoker=on`.

**Why this check exists: it shipped wrong one migration ago.** Migration 020 created the view
with no option set. **Postgres defaults a view to the VIEW OWNER's rights**, so RLS on
`obligations` and `obligation_evidence` was evaluated as `postgres` rather than as the caller —
and `authenticated` holds SELECT on it. Every company would have seen every other company's
evidence counts. Fixed by 021 before it reached production or any route.

> ### This is `CLAUDE.md` §3.6's trap one object further out, and it is worse.
> §3.6 records that a new table in `public` starts life with `anon` holding everything — *"not
> granting is not denying"*. **A view fails differently: permission is not granted by accident,
> the view QUIETLY BYPASSES the policies on what it reads.** The base tables' policies were
> correct and irrelevant, because nothing was consulting them. A table with a missing REVOKE is
> at least visible in a grants query; a view with a missing option looks identical to a correct
> one.

**Why nothing else catches it.** 020's own behavioural block tested what the view **counts**,
and a view counts correctly whoever it is counting for. `npm run check` cannot see it. The RLS
policies it bypasses all exist and all pass their own tests.

**It was found only because three assumptions were listed to be verified by measurement before
the migration went to production, rather than the migration being declared finished when its own
tests passed.** The other two were fine. That is the argument for the list.

---

## 26. Does every unresolved requirement offer an action the product can actually deliver?

```sql
select o.status,
       coalesce(jsonb_array_length(o.determined_by->'switches_missing'), 0)  as switches,
       coalesce(jsonb_array_length(o.determined_by->'inventory_missing'), 0) as inventory,
       count(*)
  from public.obligations o
 where o.status = 'unknown' and o.applicable_to is null
 group by 1,2,3 order by 4 desc;
```

**Read it as: any row with `switches = 0` is NOT answerable by a question.** `askableSwitches()`
orders switches and has nothing to offer such a row, so a screen that shows it "Answer the
question" is offering a button that cannot work.

**Answer, 13 September 2026, staging, Test Alpha Chemical:** 136 `unknown` rows — **124 name a
switch, 12 name only an inventory list** (`psm`, `ehs`, `dea_list_i`, `tri`, `rmp`, `cercla`),
**0 name neither.** Rendered through `renderRow`: 124 offer *"Answer the question"*, 12 offer
*"Add your chemical inventory"*, **0 offer a question with nothing behind it, and 0 say nothing
about what they are waiting for.**

**Production: not run — no company there has computed obligations** (`obligations_computed_at`
is NULL everywhere; migration 022 adds the column). This check becomes meaningful there on the
first real customer, and that is when it must be run, not before.

**Why this check exists and why nothing else catches it.** `renderUnknown()` returned
*"Answer the question"* unconditionally for every `unknown` row. **The unit test asserted exactly
that and passed** — it never set `factsNeeded`, so the defect was the contract. `resolve()`
produced `inventory_missing` correctly; the renderer produced a well-formed row; **only the
composition was wrong, and a composition defect has no observer below the screen.** Found by
rendering the real persisted rows. `DECISIONS.md` §61.

**And it will fail again for a different reason, which is why it is a standing check rather than
a fixed test.** The third bucket — `switches = 0 AND inventory = 0` — is empty today and becomes
non-empty the moment a requirement's trigger names a fact the switch library does not carry. That
is a **library** defect surfacing as a **screen** symptom, and this query is the only place the
two are visible at once.

---

## 27. Can the CALLER execute every function a route calls as the caller?

```sql
select p.proname,
       bool_or(pg_get_userbyid(a.grantee) = 'authenticated') as authenticated_may_execute,
       bool_or(a.grantee = 0 or pg_get_userbyid(a.grantee) = 'anon') as anon_or_public_may
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join lateral aclexplode(coalesce(p.proacl, '{}')) a on a.privilege_type = 'EXECUTE'
 where n.nspname = 'public'
 group by p.proname order by 1;
```

> ### ⚠ EXTENDED 15 SEP — THIS COVERS TABLES TOO, AND IT DID NOT.
>
> §63 found the FUNCTION case. **The same defect exists one table over**, and the check as written
> could not see it: `switch_determinations` held **SELECT only** for `authenticated`, with one
> SELECT policy and no INSERT — so a person could read their own determination history and never
> add to it, which made the first user answer impossible (§80, migration 025).
>
> **The shape to look for: a table granted SELECT to `authenticated` and WRITTEN by a route that
> runs as the caller.** Run this alongside the function query:
>
> ```sql
> select t.table_name,
>        bool_or(g.privilege_type = 'INSERT') as authenticated_may_insert,
>        (select count(*) from pg_policies p
>           where p.schemaname='public' and p.tablename=t.table_name and p.cmd='INSERT') as insert_policies
>   from information_schema.tables t
>   left join information_schema.role_table_grants g
>     on g.table_schema='public' and g.table_name=t.table_name and g.grantee='authenticated'
>  where t.table_schema='public' and t.table_type='BASE TABLE'
>  group by t.table_name order by 1;
> ```
>
> **A grant without a policy and a policy without a grant both fail**, and they fail identically
> from the caller's side — `permission denied` either way. Check both columns, not one.
>
> ### AND IT IS NOW AUTOMATED — `npm run check:live`, 15 Sep
>
> A check run by hand is a check that stops being run. `scripts/check-live.js` signs in as a real
> staging user, writes one row per tenant table a route will write, and asserts **anon is
> refused** — then deletes the probe row. **It refuses production by ref before it does anything**,
> and refuses to start if production credentials are merely present in the environment.
>
> **Wired into `npm run db:migrate`**, so every staging migration is followed by it, and named in
> the production pre-flight. **First run found a second defect immediately**: the probe for
> `company_chemicals` named a column that does not exist (`chemical_name`; it is
> `substance_name`) — which is the same class as everything else here, a write path nothing had
> ever exercised.
>
> ```
>   ✓ switch_determinations      authenticated can write
>   ✓ switch_determinations      anon refused (42501)
>   ✓ company_chemicals          authenticated can write
>   ✓ company_chemicals          anon refused (42501)
> ```
>
> **Why a separate command rather than part of `npm run check`:** it needs credentials and writes
> rows, and the suite must stay runnable offline with none. The cost is that it can be skipped —
> which is why `db:migrate` runs it rather than leaving it to discipline.

> **Append-only tables are the exception and must stay one:** `switch_determinations` has INSERT
> and deliberately no UPDATE or DELETE, and `obligations` has no DELETE policy at all (§3.2).
> **Absence there is the design, not a gap** — migration 025's verify block asserts the absence so
> a later widening cannot happen silently.

**Read it as two questions at once.** Every function a route calls through `requireCompany()`'s
client must be `true` in column 2. Column 3 is the one that needs judgement, and the rule is
**not** "always false" — it is:

> **No function that reads or writes TENANT DATA may be callable by `anon` or PUBLIC.** Trigger
> functions and pure helpers may be, and are: a trigger function cannot usefully be invoked
> directly, and a helper that touches no table has nothing to leak.

**Answer, 13 September 2026, staging, after migration 023 — the full output, all six:**

| function | authenticated | anon/PUBLIC | verdict |
|---|---|---|---|
| `close_and_replace_obligations` | **true** | **false** | correct — writes tenant rows |
| `substance_inventory` | **true** | **false** | correct — reads tenant rows |
| `auth_company_id` | true | **true** | **correct, and deliberate.** Policies are evaluated as `anon` during signup, before a session exists. It is `SECURITY DEFINER` and returns the CALLER's own company, so an `anon` caller gets NULL |
| `create_primary_site` | true | true | trigger function — fires on `companies` insert; direct invocation does nothing useful |
| `set_updated_at` | true | true | trigger function |
| `array_is_ascending` | true | true | pure helper, touches no table |

> **This table is the query's real output, not the expected one.** A first draft of this check
> recorded `auth_company_id` as `anon = false` and asserted a blanket "no exceptions" rule — both
> written from what the rule ought to be rather than from what the database returned, and both
> wrong. Running it produced four functions the blanket rule would have flagged, none of which is
> a defect. **A check whose recorded answer is an expectation is not a check** (`DECISIONS.md`
> §60).

**Answer on PRODUCTION, 13 September 2026, after 023 — re-run, not assumed:**

```
close_and_replace_obligations   authenticated: true   anon/PUBLIC: false
substance_inventory             authenticated: true   anon/PUBLIC: false
auth_company_id                 authenticated: true   anon/PUBLIC: true   (deliberate, see above)
create_primary_site / set_updated_at / array_is_ascending   anon: true   (triggers + pure helper)
```

**Identical to staging, six functions on both sides.**

**Why this check exists.** Both functions were `service_role`-only, and `/api/obligations`
connects **as the caller**. Every first GET returned `42501 permission denied` — on production
that would have been all ten companies, every one of them a first customer. `DECISIONS.md` §63.

> ### Why nothing in `npm run check` can find this, and that is structural.
> **Not one of the 250 tests makes an authenticated HTTP request.** The unit suite runs pure
> functions in-process, `npm run mutation` mutates those same functions, `check:schema` reads
> type definitions offline with no credentials, and `next build` compiles. **A grant is invisible
> to all of them**, and so is every other thing that only differs between "called as the service
> role" and "called as a signed-in person".
>
> **The writer had been measured — 1.95 s, 221 obligations, idempotent on re-run — entirely as
> `service_role`.** Those numbers were real and described a path no customer takes. A measurement
> carries the identity it was taken under.

**The second half, which this query does not answer.** A granted function can still be wrong
about *which* company the caller may act for. `close_and_replace_obligations` now raises
`caller belongs to company X, not Y` when they differ, verified live as a signed-in user, with
the other company's obligation count unchanged at 221 afterwards. **RLS is what makes it safe;
the guard is what makes it legible** — without it a cross-tenant call is a silent zero-row
update.

---

## 28. Can every condition in the library ever be TRUE?

**Not "is it right" — can it fire at all.** A clause comparing a literal of the wrong type to a
switch is not a wrong answer; it is a requirement that is permanently `does_not_apply` for every
customer, and it looks identical on screen to an honest exclusion.

```sql
-- the switch clauses and the switch they name, side by side
select r.requirement_name, r.jurisdiction_layer, c.value->>'switch' as sw,
       s.value_type, s.allowed_values, c.value->>'op' as op, c.value->'value' as literal
  from public.requirement_templates r
  cross join lateral jsonb_path_query(r.applies_expression, '$.**{0 to 8}?(@.switch != null)') c(value)
  left join public.switches s on s.id = c.value->>'switch'
 where r.effective_to is null
   and (
     (s.value_type = 'enum'    and jsonb_typeof(c.value->'value') = 'boolean')
  or (s.value_type = 'boolean' and jsonb_typeof(c.value->'value') <> 'boolean')
  or (s.value_type = 'number'  and jsonb_typeof(c.value->'value') <> 'number')
  or (s.id is null)
   );   -- must return zero rows
```

**Answer, 13 September 2026, staging: 22 clauses across 22 requirements. This is the worst
content defect found in the project so far.**

```
live requirements: 200 | with an expression: 199 | switch clauses: 216
TYPE-MISMATCHED CLAUSES: 22

   17x  hazwaste_generator_category (enum) is true
    2x  holds_iso_certification (enum) is true
    1x  flammable_liquid_quantity_band (enum) is true
    1x  wastewater_discharge (enum) is true
    1x  emergency_response_team (enum) is true

by layer: { federal: 15, state: 4, local: 1, none: 2 }
```

`hazwaste_generator_category` is an enum over `{none, vsqg, sqg, lqg}`. Seventeen requirements ask
whether it **is `true`**, which no allowed value can satisfy. **Consequence, proved by running the
resolver rather than argued:**

```
hazwaste_generator_category = lqg
  hazardous-waste requirements resolved: 20 -> {"does_not_apply":17,"unknown":3}
  APPLIES: NONE
hazwaste_generator_category = sqg    ... identical
hazwaste_generator_category = vsqg   ... identical
```

> **A LARGE-QUANTITY GENERATOR — the most heavily regulated waste category there is — receives
> ZERO hazardous-waste obligations, and the screen tells them so in a confident sentence naming
> the fact that ruled it out.** `LQG contingency plan`, `LQG personnel training`, `Manifest and
> authorized transporter`, `Land Disposal Restrictions`: all cleared, for everyone, always. The
> value of the switch is irrelevant — `coerceFact('lqg', enum)` returns `"lqg"` correctly, and
> `"lqg" is true` is false, so the answer never depended on the customer at all.

**Why nothing else catches it.** `applies_expression`'s three existing invariants check that every
switch NAMED exists (check 19) and that no condition asserts a number the rule does not state
(check 21). **Neither compares the literal's TYPE to the switch's `value_type`** — the expression
is well-formed JSON naming a real switch, so it passes both. The resolver is equally blameless:
three-valued logic on a false comparison is `false`, which is the correct answer to the question
it was asked. **Every layer is right and the claim is wrong**, which is the same shape as
`DECISIONS.md` §61 one level further out.

**And it is a silent FALSE, not an unknown** — the direction that matters. `CLAUDE.md` §3.2 says
absence of evidence must never produce a clear; this is worse, because it is *presence* of
evidence producing a clear that contradicts the evidence.

**Answer on PRODUCTION, 13 September 2026 — the same query, run there:**

```
mismatched_clauses: 22
```

**Identical, because it is the same library** — 205 rows, byte-identical across both environments.
No production customer has computed obligations yet, **so nobody has been told this. That is
timing, not a control**, and it is why `TODO.md` 6.4c gates showing `does_not_apply` to anyone.

---

## The 13 September sweep — nine unknown checks, run

*All nine against BOTH environments. Results identical on staging and production unless noted.*

| # | Check | Result |
|---|---|---|
| 5 | `secondary_agency_ids[]` all point at a real agency | **PASS** — 0 rows |
| 6 | every company has exactly one primary site | **PASS** — 0 rows |
| 7a | no child pointing at a still-live parent | **PASS** — 0 rows |
| 7b | no retired row without a child or successor | **PASS** — 0 rows |
| 8 | storage objects under a prefix matching no company | **FAIL — 4 orphans on each environment.** Reported PASS earlier the same day because the query named a bucket that does not exist; corrected below |
| 9 | industry slugs agree across joining tables | **FAIL** — 1 row: `cannabis` |
| 10 | production vs staging, object for object | **PASS** — **852 objects each, sha256 identical** |
| 11 | every count asserted in a document still true | **FAIL** — see below |
| 12 | every `agency_id` points at a live agency | **PASS** — 0 rows |
| 20 | every inventory CAS is one we hold thresholds for | **PASS, VACUOUSLY** — `company_chemicals` is empty |

> **Two of these ten were vacuous, and only one said so.** Check 20 is recorded as vacuous
> because the table is visibly empty. **Check 8 was vacuous and read as clean**, because a
> wrong bucket name and a genuinely empty result are the same zero. **A check that cannot
> distinguish "nothing to find" from "looked in the wrong place" is not yet a check** — and the
> cheapest fix is the one check 14 already prescribes: assert the population is non-zero before
> asserting the exceptions are zero.

**Check 9's failure is the check being too strict, not drift.** `cannabis` has 25
`industry_coverage` rows, all `not_built`, and zero library rows — which is the documented state.
**A coverage row whose status is `not_built` legitimately has nothing behind it**, and the check
needs that exemption or it fails permanently.

**Check 11 genuinely fails.** Four counts in current document text had gone stale — `65 policies`
and `23 tables` in STATUS, `65 policies` in this file and in BUILD-PLAN, `31 agencies` in two
places. **Live: 71 policies, 26 tables, 33 agencies, 64 policies calling `auth_company_id()`.** Six
policies and three tables arrived across migrations 017–023 and no document moved.

> **And the sweep itself produced a wrong number, which is worth keeping.** A first pass counted
> `64` as `49`, because the predicate was `qual || coalesce(with_check,'')` — **`qual` is NULL on
> every INSERT-only policy, and NULL concatenated with anything is NULL**, so those policies
> silently fell out of the count. `coalesce(qual,'') || coalesce(with_check,'')` returns 64. The
> same NULL-swallowing shape as `array_length()` on an empty array (`CLAUDE.md` §3.7), in a
> counting query rather than a constraint. *(The naive form of this check produces ~53 hits,
most of them legitimate subsets — "the 21 switches that depend on it". It needs a human pass, and
that is why it stays by hand.)*

### The two that were fixed

**Check 4 — `row_count`.** OR-OSHA read **53** against a live **61**, on both environments, since
12 September. Cause: migration 013 split three OR-OSHA requirements into eleven — 3 retired, 11
live, **net +8** — and nothing recounted. **Migration 024 recomputes it and is idempotent**;
staging passes, and `sum(row_count)` is now 193, matching the 193 live rows that carry an agency.
**Not yet on production.**

> **Why the recount was not automatic, which is the finding rather than the fix.** `row_count` is
> a **derived number written by hand**, and it has now been wrong **twice for unrelated reasons** —
> once at birth (migration 011's comment said "live" and the first implementation counted retired
> rows; *a comment is not a constraint*) and once when the library moved underneath a correct
> value. **Nothing recomputes it, so correctness is a property of whoever last remembered.** 024
> fixes today's value and does **not** make the column self-maintaining; a trigger is the real fix
> and is a separate decision. `DECISIONS.md` §66.

**And it is not rendered.** `/api/obligations:102` builds M6's coverage strip from live
`count: 'exact'` queries, not from this column. **No customer has been shown 53.**

**Check 27 — the caller's EXECUTE grants**, fixed by migration 023 and now passing on both sides.

---

## 29. What is reachable in principle and reached by nothing?

**A class, not three separate notes.** Code that is correct, tested, and has no caller is a
different defect from code that is wrong — it fails on the day someone first reaches it, and
until then it reads on every page as finished work.

```
# every exported callable in lib/, and who imports the module it lives in
for f in lib/*.ts; do
  name=$(basename "$f" .ts)
  prod=$(grep -rl "from '@/lib/$name'\|from './$name.ts'" app lib components | grep -v "^$f$")
  test=$(grep -rl "lib/$name.ts" tests)
  [ -z "$prod" ] && echo "NO PRODUCTION CALLER: $f  (tests: ${test:-none})"
done
```

**Answer, 15 September 2026 — derived by grep, not recalled. 69 exported callables in `lib/`:**

| Module | Exports only a test calls | Reached in production? |
|---|---|---|
| `lib/switchAsk.ts` | 6 of 6 | **No** |
| `lib/switchDetermination.ts` | 4 of 4 | **No** |
| `lib/sdsExtraction.ts` | 4 of 4 | **No** |
| `lib/basis.ts` | 3 | **No** — only via `switchDetermination`, itself unreached |
| `lib/folderTemplates.ts` | — | **Dead.** 0 internal uses, 0 external, 0 tests |

**Four modules, ~17 exports, roughly 60 tests, and no request has ever reached any of them.** That
is the whole 7.2/7.2a surface: `/api/switches/ask` and `/api/switches/answer` do not exist, and
**nothing in `app/` has ever written a `company_switches` row** — Test Alpha's 16 facts came from
`scripts/seed-multisite-fixture.js:141`.

**All 18 routes have a caller. All 6 database functions are reached** — including the three with
no app/lib caller, which are reached by the database itself: `set_updated_at` by 12 triggers,
`create_primary_site` by 1, `array_is_ascending` by 1 CHECK constraint. **Checked rather than
assumed**, because "no caller in the code" and "no caller at all" are different questions.

### Why this is a check and not a to-do

**It has already produced two distinct failures this session**, and they failed differently:

- **`close_and_replace_obligations` was reached for the first time by a user** and returned 500 for
  every uncomputed company — the write had only ever run as `service_role` (§63).
- **`criticPass` had no test because it could not be IMPORTED by one** — `@/lib/...` is resolved by
  the bundler and by `tsc` but not by Node's loader. It looked like a backlog item (§67).

> **And the third kind is not on this list, which is the point of keeping them apart.**
> `substance_inventory()` is reached, exercised on every recompute, and has **never taken its real
> path** because `company_chemicals` is empty (§70). Unreached code fails loudly on first contact.
> That one never will.

**Three files remain unimportable by a test** — `documentReview.ts`, `determinationGate.ts`,
`documentContent.ts` — all three on M1's path.

---

## 30. Is a state rule distinguishable from the federal rule it exceeds?

**Two shapes, both enumerable by query, both on the 6.7 worklist.** This is the check that turns
*"several rules look suspect"* — an impression from ten minutes of domain reading — into a number
that can be re-run after 6.7 changes anything.

### (a) A DETERMINATION RESULT wearing the shape of a fact

```sql
select requirement_name, jurisdiction_layer, applies_expression
  from public.requirement_templates
 where effective_to is null
   and applies_expression::text like '%air_permit_required%'
   and applies_expression::text not like '%ghg_emissions%';
```

**Answer, 15 September 2026: 4 rows.** `Clean Air Act Title V permit`, `Title V monitoring and
compliance certification`, `Oregon Air Contaminant Discharge Permit`, `NSPS/NESHAP/MACT
applicability screen`.

> **The defect is not circularity, and "circular" was the wrong word.** `air_permit_required` is a
> **determination result**, not an observable fact: something worked out the answer, and the
> expression reads that answer instead of the inputs that produced it. Its
> `determination_source` is `documents` — so the product proposes to learn whether you need a
> permit by reading the permit you already hold. **The honest expression turns on
> potential-to-emit or source category**, which a company can establish before any permit exists.

**The distinction that keeps this check honest:** `has_employees` gating an employment requirement
is also definitional, and is **harmless** — a tautology that costs nothing, because the fact and
the requirement are genuinely the same question. A determination result is different: **there is a
computation behind it, and the expression has hidden it.**

### (b) A state rule whose expression is identical to its federal counterpart

```sql
select r.requirement_name, r.applies_expression
  from public.requirement_templates r
 where r.effective_to is null and r.jurisdiction_layer = 'state'
   and exists (select 1 from public.requirement_templates f
                where f.effective_to is null and f.jurisdiction_layer = 'federal'
                  and f.applies_expression::text = r.applies_expression::text);
```

**Answer, 15 September 2026: 21 state rows**, over **4 distinct expressions** and 4 switches:

```
state=14 federal= 3   has_employees is true              <- definitional, harmless
state= 3 federal= 2   hazardous_chemicals_present is true
state= 2 federal=15   hazwaste_generator_category is true
state= 2 federal= 1   nonexempt_employees is true
```

**14 are the harmless tautology. 7 are the defect:**

| Requirement | Switch |
|---|---|
| Annual Oregon generator report | `hazwaste_generator_category` |
| Oregon hazardous-waste site notification | `hazwaste_generator_category` |
| Workplace Hazard Communication program | `hazardous_chemicals_present` |
| SDS on file, current, 16-section GHS format | `hazardous_chemicals_present` |
| Manufacturer/importer classification, SDS, shipped labels | `hazardous_chemicals_present` |
| Manufacturing daily overtime | `nonexempt_employees` |
| Meal and rest periods | `nonexempt_employees` |

> **An Oregon state-plan rule resolves identically to the federal rule it is supposed to exceed.**
> Where Oregon is stricter, the stricter rule is **invisible to the resolver** — and the error runs
> in the **false-green direction**, because a company exempt federally is cleared of the Oregon
> obligation too. The VSQG case found on 13 September is one instance; it is not the pattern.
>
> ### The wider bound is the more useful figure, and it says this query sees a SLICE.
>
> **60 state rows cite a CFR** — Oregon adopting a federal standard — and **39 of those carry no
> Oregon-specific clause at all.** The 21 above are only those with a **federal twin** whose
> expression is byte-identical; a state row that adopts a federal standard and has no federal
> counterpart in the library is invisible to this query and just as wrong.
>
> **So 21 is a floor, not a population.** The comparison the query can make is
> expression-to-expression; the comparison that matters is expression-to-rule, and nothing in the
> database supports it — **`citation_quote` is NULL on all 205 rows.**

### The two things that matter more than the counts

**1. Both shapes are findable by QUERY.** The library's defects of this kind are **enumerable**,
not only discoverable by a person who knows the subject. That is what makes them trackable across
6.7 rather than re-found each time somebody reads a screen.

**2. Neither shape can be FIXED without 6.7.** Correcting an Oregon expression means knowing what
Oregon's rule actually says, and **`citation_quote` is NULL on all 205 rows**. So these are a
**worklist for 6.7, not work that precedes it.**

**Distinct union of both shapes: 25 rows of 205** — no overlap, since shape (a) uses
`air_permit_required` and none of shape (b)'s four switches is that. **Excluding the 14 harmless
tautologies: 11 rows** need a judgement call.

---

## How to add a check

> ### And a check must be able to FAIL, or say that it could not run.
>
> Added 13 Sep. A hard query against an empty table returns zero rows and reports clean, which
> is the same output as a check that examined everything and found nothing wrong. **Write the
> assertion hard and guard it on its precondition**: if the data it needs is absent, print SKIP
> and name what was missing. `npm run audit:data` does this for the checks that need live rows,
> and its summary line distinguishes *passed* from *never ran*. A soft assertion is worse than
> no check, because it occupies the place where a check would go.

A check earns its place here if a wrong answer would reach a customer and **nothing else
would notice**. That is the test. A check that duplicates a database constraint belongs in
the constraint; a check that duplicates `npm run check` belongs there. What goes here is the
class of failure where every automated thing passes and the product is still saying
something untrue.

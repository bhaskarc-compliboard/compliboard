# Audit Checks
**Version:** 16 · **Updated:** 12 September 2026
**Supersedes:** version 15 (12 Sep). Check 10 re-run after migration 017: **840 objects each, 0
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

**Status: the checks are written down and run by hand. None of them runs automatically yet.**
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
select o.name, split_part(o.name, '/', 1) as prefix
  from storage.objects o
 where o.bucket_id = 'documents'
   and not exists (select 1 from public.companies c where c.id::text = split_part(o.name, '/', 1));
```

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
coverage rows, 65 policies, 59 through `auth_company_id()`, 615 objects, 49 Oregon rows
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

**Answer, 12 September 2026, both environments:** zero rows — **vacuously, because
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
| **`substance_inventory`** | **`PUBLIC`**, `anon`, `authenticated`, `postgres`, `service_role` | 🟡 migration 013 created it with no revoke |

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

## How to add a check

A check earns its place here if a wrong answer would reach a customer and **nothing else
would notice**. That is the test. A check that duplicates a database constraint belongs in
the constraint; a check that duplicates `npm run check` belongs there. What goes here is the
class of failure where every automated thing passes and the product is still saying
something untrue.

# Audit Checks
**Version:** 4 · **Updated:** 11 September 2026
**Supersedes:** version 3 (11 Sep). Check 10 gains its 11 Sep post-6.2 result — 619 objects
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
object-for-object identical to production (673 objects, 0 differences, verified 11 Sep).**

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
| rows with a citation | **194 of 194** |
| rows with a `citation_url` | **0 of 194** |
| rows with a `citation_quote` | **0 of 194** |
| rows with a `source_checked_at` | **0 of 194** |
| rows at `status = 'verified'` | **0 of 194** — all 194 are `generated` |

**Every requirement in the library names a rule and NOT ONE links to it.** No row carries
the text it is asserting, and no row records a date on which a human opened the source.

**Why this is the sharpest available statement of what `status = 'generated'` means.** The
enum value reads as a mild caveat — *a model wrote this, a person has not signed it off.*
The columns say something harder: **there is no artifact behind any of these rows at all.**
Not an unchecked link — no link. `CLAUDE.md` §3.3 is the rule this bumps against: the model
reasons excellently against an artifact and enumerates unreliably from nothing, and today
the library is the output of the second mode for all 194 rows.

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
| rows with `citation_federal_analogue` set | **0 of 194** |

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

**Answer, 11 September 2026:** zero rows. `sum(row_count)` across all 56 coverage rows is
**185**, against **192** live requirements of which **185** carry an agency — the other 7 are
the deliberate NULLs.

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
takes nothing away. Two today, on a library of 192; the error only ever grows, and it grows
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
vanishes from the answer. The column is empty on all 194 rows today, which is exactly why
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

*Note on the number:* an earlier comparison after migration 010 reported **673** objects.
That was a differently-built census, not a regression — it counted grants through
`information_schema.role_table_grants`, which filters to roles the caller belongs to and
returns nothing here. **Whichever census this check settles on, it must be the same one every
time, or the count itself becomes a false alarm.**

---

## 11. Is every count asserted in a document still true?

The documents assert numbers constantly: 194 requirements, 192 active, 33 agencies, 56
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

## How to add a check

A check earns its place here if a wrong answer would reach a customer and **nothing else
would notice**. That is the test. A check that duplicates a database constraint belongs in
the constraint; a check that duplicates `npm run check` belongs there. What goes here is the
class of failure where every automated thing passes and the product is still saying
something untrue.

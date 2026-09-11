# Audit Checks
**Version:** 1 · **Updated:** 11 September 2026
**Supersedes:** nothing. New file.

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

## How to add a check

A check earns its place here if a wrong answer would reach a customer and **nothing else
would notice**. That is the test. A check that duplicates a database constraint belongs in
the constraint; a check that duplicates `npm run check` belongs there. What goes here is the
class of failure where every automated thing passes and the product is still saying
something untrue.

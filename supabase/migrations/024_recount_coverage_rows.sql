-- ============================================================
-- COMPLIBOARD — MIGRATION 024: RECOUNT industry_coverage.row_count
-- ============================================================
--
-- WHY.  `AUDIT-CHECKS.md` check 4 has been FAILING on both environments since 12 September.
-- One row is wrong, by eight:
--
--     agency    industry                 stored   live
--     OR-OSHA   chemical-manufacturing   53       61
--
-- CAUSE, and it is not a mystery.  Migration 013 split three under-decomposed OR-OSHA
-- requirements into eleven children — Electronic OSHA injury-data submission into 3, Process
-- Safety Management into 5, permit-required confined spaces into 3. Three parents retired,
-- eleven children live: **net +8 live rows for OR-OSHA.** `row_count` is a plain integer that
-- nothing recomputes, so it kept the number it was seeded with.
--
-- *** WHY THE RECOUNT WAS NOT AUTOMATIC, WHICH IS THE ACTUAL FINDING. ***
--
-- **`row_count` is a DERIVED number that is WRITTEN BY HAND, and a derived number written by
-- hand drifts the moment anything upstream changes.** It has now been wrong twice, for two
-- different reasons:
--
--   1. At birth — migration 011's column comment said "live rows" and the first implementation
--      counted retired ones too. That is what check 4 was written for. **A comment is not a
--      constraint.**
--   2. Now — the value was correct when written and the library moved underneath it.
--
-- The two failures share no code and one shared cause: **nothing recomputes it, so correctness
-- is a property of whoever last remembered.** This migration fixes today's value. It does NOT
-- make the number self-maintaining; a trigger on `requirement_templates` is the real fix and is
-- a separate decision, deliberately not folded in here (§56.1, a migration does one thing).
--
-- NOT URGENT, AND SAID PLAINLY: **nothing renders this column.** `/api/obligations` builds M6's
-- coverage strip with live `count: 'exact'` queries against `requirement_templates`, not from
-- `industry_coverage.row_count`. No customer has been shown 53. The defect is a wrong number in
-- the database, not a wrong number on a screen.
--
-- IDEMPOTENT. Recomputes from the library every time; running it twice changes nothing.
-- ============================================================

update public.industry_coverage c
   set row_count = (
     select count(*)::int
       from public.requirement_templates t
      where t.agency_id = c.agency_id
        and c.industry = any(t.industries)
        and t.effective_to is null)
 where c.row_count <> (
     select count(*)::int
       from public.requirement_templates t
      where t.agency_id = c.agency_id
        and c.industry = any(t.industries)
        and t.effective_to is null);

-- ------------------------------------------------------------
-- VERIFY — check 4's own query, as the migration's refusal condition.
-- ------------------------------------------------------------
do $$
declare bad bigint; total bigint;
begin
  select count(*) into bad
    from public.industry_coverage c
    join lateral (select count(*)::int as n
                    from public.requirement_templates t
                   where t.agency_id = c.agency_id
                     and c.industry = any(t.industries)
                     and t.effective_to is null) tr on true
   where c.row_count <> tr.n;
  if bad > 0 then
    raise exception 'MIGRATION 024 FAILED: % coverage row(s) still disagree with the library.', bad;
  end if;

  select sum(row_count) into total from public.industry_coverage;
  raise notice 'MIGRATION 024 OK: every coverage row matches the library; sum(row_count) = %.', total;
end $$;

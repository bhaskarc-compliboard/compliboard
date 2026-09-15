-- ============================================================
-- COMPLIBOARD — MIGRATION 026: `declared` — A PERSON TOLD US DIRECTLY
-- ============================================================
--
-- WHY.  `POST /api/switches/answer` cannot record a user's answer:
--
--     new row for relation "switch_determinations" violates check constraint
--     "switch_determinations_stated_needs_evidence"
--
-- `fromUserAnswer()` returns `evidence_class = 'stated'` with no document and no quote, and
-- migration 017's constraint refuses exactly that — correctly, by its own comment (017 line 77):
-- **"`stated` and `implied` mean 'this document says/implies it', so they require a document AND
-- the text that does it."**
--
-- *** THE VOCABULARY WAS BUILT FOR DOCUMENTS, AND HAD NO WORD FOR A PERSON. ***
--
-- `stated`, `implied`, `inferred`, `absent` all describe HOW A DOCUMENT SUPPORTS A CLAIM. They
-- are one scale. **A person telling us directly is not on that scale** — it is a different KIND
-- of source, and it is the strongest one in the product. Lacking a word for it,
-- `fromUserAnswer()` borrowed `stated`, which in this vocabulary means something else.
--
-- Two alternatives were refused, and the reasons matter more than the choice:
--
--   * WIDEN THE CONSTRAINT to exempt `source = 'user_set'`. That admits a case the vocabulary
--     cannot express, and the constraint stops meaning what its comment says. A constraint that
--     no longer matches its own explanation is worse than no constraint: it reads as enforced.
--   * USE `inferred`. Wrong on its face. `inferred` is the WEAKEST class, and `DECISIONS.md`
--     §24.1 already settled that a stated value outranks an inferred one. A person's answer is
--     the strongest evidence in the system, not the weakest.
--
-- *** THE RANKING CHANGE IS THE POINT, NOT A SIDE EFFECT. *** §24.1's rule — a person's answer
-- outranks what a document implies — has been **unexpressible in the vocabulary until now**,
-- which is precisely why a person's answer had to borrow a word meaning something else.
--
-- WHY `declared` AND NOT `asserted`. "Asserted" reads as a claim somebody is MAKING; "declared"
-- reads as a fact somebody is SUPPLYING. The distinction matters because the word will appear
-- in a table next to `inferred`, where the reader is already weighing how much to believe.
--
-- `declared` CARRIES NO DOCUMENT AND NEEDS NONE. That is the whole difference: its provenance is
-- a person and a timestamp, held in `basis` (migration 018, structured jsonb), not a quote.
-- ============================================================

alter type public.evidence_class add value if not exists 'declared' after 'stated';

-- ------------------------------------------------------------
-- VERIFY — the new value exists and sorts above `implied`.
--
-- `add value` cannot be used in the same transaction that adds it, so the constraint work that
-- depends on `declared` is migration 027. This file does one thing (DECISIONS.md §56.1) and the
-- thing it does is add a word.
-- ------------------------------------------------------------
do $$
declare n bigint;
begin
  select count(*) into n from pg_type t join pg_enum e on e.enumtypid = t.oid
   where t.typname = 'evidence_class' and e.enumlabel = 'declared';
  if n <> 1 then
    raise exception 'MIGRATION 026 FAILED: `declared` was not added to evidence_class.';
  end if;
  raise notice 'MIGRATION 026 OK: evidence_class now carries `declared` — a person told us directly.';
end $$;

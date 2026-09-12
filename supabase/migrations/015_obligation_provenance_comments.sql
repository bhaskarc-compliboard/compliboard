-- ============================================================
-- COMPLIBOARD — MIGRATION 015: WHAT resolved_by AND determined_by ARE FOR
-- ============================================================
--
-- WHY THIS EXISTS
--
-- `obligations.resolved_by` is `text NOT NULL default 'ai_inferred'` with NO CHECK
-- constraint. Its vocabulary — `user_stated`, `evidence_linked`, `ai_inferred` — is written
-- down in `WORKSPACE.md` §187, and Phase 4.1 adds a fourth, `computed_by_code`. A vocabulary
-- with no constraint behind it and no comment on the column is a convention that survives
-- exactly as long as everyone who read the document is still on the project.
--
-- SO WHY NOT A CHECK CONSTRAINT, WHICH WOULD ACTUALLY ENFORCE IT. Because the set is still
-- growing — M7's teaching confirmation and the worker will both add values — and a CHECK on
-- a growing enum-like column is the churn `CLAUDE.md` §3.7 warns about, requiring every
-- prior value to be restated on each change. A comment costs nothing and is read by anyone
-- who inspects the table. **This is a deliberate trade and it is worth naming as one: the
-- comment DOCUMENTS the convention, it does not ENFORCE it.** If a wrong value ever reaches
-- this column in production, the answer is to promote it to an ENUM, not to add a CHECK.
--
-- AND THE PAIR OF COLUMNS IS EASY TO MIX UP, WHICH IS THE OTHER HALF OF THE REASON.
-- `resolved_by` (text) says HOW. `determined_by` (jsonb) says WHAT WITH. They sound alike,
-- they sit next to each other, and the one that looks like it holds a label holds a
-- document. Migration 007's header explains why `determined_by` is jsonb: free text cannot
-- answer "which obligations must be recomputed when one switch changes", and that question
-- is operational rather than cosmetic.
--
-- THIS MIGRATION ADDS COMMENTS AND NOTHING ELSE. No column is added, altered or dropped;
-- no data is touched. It is safe to run against a database with live obligations.
-- ============================================================

comment on column public.obligations.resolved_by is
  $c$HOW this obligation was resolved, not who by. Vocabulary (WORKSPACE.md §187, extended
by Phase 4.1): `computed_by_code` — the resolution engine evaluated applies_expression
against established facts; `user_stated` — a person asserted it; `evidence_linked` — a
document established it; `ai_inferred` — a model proposed it, and per §187 that one must be
CONFIRMED BEFORE APPLYING, especially where it would REMOVE an obligation. No CHECK
constraint on purpose: the set is still growing. If a wrong value ever appears here, promote
this to an ENUM rather than adding a CHECK. See DECISIONS.md §47.$c$;

comment on column public.obligations.determined_by is
  $c$WHAT the answer was computed FROM — the machine-readable half, where resolution_rationale
is the sentence a human reads. Written by the resolution engine as
{jurisdiction:{layer,match,decided_by}, switches[], switches_missing[], inventory[],
inventory_missing[], sites_considered[]}. It exists to answer two questions prose cannot:
WHICH OBLIGATIONS MUST BE RECOMPUTED when one switch changes, and WHAT TURNS ON a given
switch. `switches_missing` is also the ask list — the facts that would settle a row sitting
at `unknown`. Migration 007 chose jsonb over text for exactly this.$c$;

comment on column public.obligations.resolution_rationale is
  $c$The sentence a person reads: why this row says what it says. Free text, and deliberately
not the place to store structure — determined_by carries that. For a row at `undetermined`
this must state WHY nothing could be computed, because `undetermined` means a dead end
needing a person and a dead end with no reason attached cannot be actioned.$c$;

-- ------------------------------------------------------------
-- VERIFY — a comment that was not attached is a comment nobody will find.
-- ------------------------------------------------------------
do $$
declare missing text;
begin
  select string_agg(a.attname, ', ')
    into missing
    from pg_attribute a
   where a.attrelid = 'public.obligations'::regclass
     and a.attname in ('resolved_by', 'determined_by', 'resolution_rationale')
     and col_description(a.attrelid, a.attnum) is null;

  if missing is not null then
    raise exception 'MIGRATION 015 FAILED: no comment on %', missing;
  end if;

  raise notice 'MIGRATION 015 OK: resolved_by, determined_by and resolution_rationale are documented.';
end $$;

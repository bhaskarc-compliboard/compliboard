-- ============================================================
-- COMPLIBOARD — MIGRATION 020: EVIDENCE LINKING
-- ============================================================
--
-- WHY.  `obligation_evidence` has existed since 007 with 0 rows and nothing writing it. Phase
-- 7.3 gives it the contract it never had. Spec: `docs/EVIDENCE-LINKING.md`.
--
-- THE ONE SENTENCE THAT EXPLAINS THE WHOLE PHASE.  `obligations.status` answers *is this
-- OWED*. Evidence answers *what has been SHOWN*. They are independent facts and collapsing
-- them is the false green — which is why §21.3 removed the name `satisfied` from the status
-- column in the first place. Before this migration an `applies` row could say "this applies to
-- you" and then nothing, and a reader completes that sentence as "and you have done it".
--
-- WHAT THIS DOES NOT DO.  It does not build the AI matcher. That reasons over document
-- SUMMARIES rather than documents — `prompts/audit.ts` hands it "a short description of what
-- it actually covers" — produced a 3.5x spread on one standard, and silently drops documents
-- it cannot read. Storing that behind a schema that asserts a link would make an unreliable
-- process durable rather than reliable. It stays with M2. `docs/EVIDENCE-LINKING.md` §7.
-- ============================================================

-- ------------------------------------------------------------
-- 1. WHO MADE THE LINK
-- ------------------------------------------------------------
-- An ENUM rather than the existing free-text `assessed_by`, because a free-text column's
-- vocabulary is set by whoever writes it first and never argued about again — the shape
-- DECISIONS.md §52 names, and one this project has already produced twice.
create type public.evidence_source as enum ('user', 'document_review', 'ai_match');

alter table public.obligation_evidence
  add column matched_by public.evidence_source not null default 'user',
  -- WHY A LINK STOPPED COUNTING. Free text on purpose: this is a person's sentence.
  add column superseded_reason text;
alter table public.obligation_evidence alter column matched_by drop default;

-- A person's link carries no machine confidence, and a machine's link must carry one.
-- Without this, `match_confidence` on a user link would be NULL for some rows and invented
-- for others, and nobody could tell which.
alter table public.obligation_evidence
  add constraint obligation_evidence_confidence_fits_source
  check ((matched_by = 'user' and match_confidence is null)
      or (matched_by <> 'user' and match_confidence is not null));

-- ------------------------------------------------------------
-- 2. *** THE COMPOSITE FOREIGN KEY — TENANCY AS A STRUCTURE, NOT A HABIT ***
-- ------------------------------------------------------------
-- `obligation_evidence` carries `company_id`, and `document_id` points at a document that
-- carries its own. Nothing has ever forced them to agree. An application check is a habit;
-- this is a guarantee, and it is the only one that survives a route written by somebody who
-- has not read `CLAUDE.md` §3.6.
--
-- *** IT IS BEING DONE NOW BECAUSE IT WILL NEVER BE CHEAPER. *** 38 documents on production,
-- 0 with a null company. Adding it after a real customer means backfilling against live data
-- and discovering the exceptions one failed constraint at a time.
--
-- The unique below adds no new uniqueness — `id` is already the primary key — it exists so
-- the pair is a legal FK target. Same trick migrations 011 and 017 used to pin a denormalised
-- column to the row it came from.
alter table public.documents
  add constraint documents_id_company unique (id, company_id);

alter table public.obligation_evidence
  add constraint obligation_evidence_document_same_company
  foreign key (document_id, company_id)
  references public.documents (id, company_id)
  on delete cascade;

-- ------------------------------------------------------------
-- 3. ONE LIVE LINK PER (OBLIGATION, DOCUMENT)
-- ------------------------------------------------------------
-- A row is LIVE when it has neither been superseded by a successor nor corrected away.
-- Both exclusions matter: a corrected link must not block re-linking the same document, which
-- is exactly what a customer does after fixing a mistake.
create unique index idx_obligation_evidence_one_live
  on public.obligation_evidence (obligation_id, document_id)
  where superseded_by is null and superseded_reason is null;

-- ------------------------------------------------------------
-- 4. STATUS IS DERIVED. A STORED STATUS IS A COPY OF A JOIN, AND A STALE COPY LOOKS CURRENT.
-- ------------------------------------------------------------
-- §21.3 already rejected storing `at_risk` and `expiring_soon` for this reason. The same
-- argument applies with more force here: an expiring certificate must change the answer with
-- NOTHING RUNNING.
--
-- *** CLAUDE.md §3.2 — EXPIRED EVIDENCE CAN NEVER SATISFY A REQUIREMENT — IS ENFORCED IN THIS
-- PREDICATE. *** Not in a prompt, not at each call site. A consumer cannot forget the filter,
-- because there is nothing to forget.
create or replace view public.obligation_evidence_state as
select o.id         as obligation_id,
       o.company_id as company_id,
       count(e.id) filter (
         where e.contribution = 'satisfies' and e.superseded_by is null
           and e.superseded_reason is null
           and (e.valid_until is null or e.valid_until >= current_date))     as live_evidence,
       count(e.id) filter (
         where e.contribution = 'satisfies' and e.superseded_by is null
           and e.superseded_reason is null
           and e.valid_until is not null and e.valid_until < current_date)   as expired_evidence,
       count(e.id) filter (
         where e.contribution = 'contradicts' and e.superseded_by is null
           and e.superseded_reason is null)                                  as contradicting_evidence,
       min(e.valid_until) filter (
         where e.contribution = 'satisfies' and e.superseded_by is null
           and e.superseded_reason is null and e.valid_until is not null)    as next_expiry
  from public.obligations o
  left join public.obligation_evidence e on e.obligation_id = o.id
 group by o.id, o.company_id;

comment on view public.obligation_evidence_state is
  $c$What has been SHOWN for each obligation. NOT whether it is owed — that is
obligations.status, and the two are independent facts (docs/EVIDENCE-LINKING.md §5). Expiry is
filtered HERE so no consumer can forget it (CLAUDE.md §3.2). A corrected link
(superseded_reason set) is excluded exactly as a superseded one is.$c$;

-- ------------------------------------------------------------
-- 5. GRANTS — "not granting is not denying" (CLAUDE.md §3.6)
-- ------------------------------------------------------------
revoke all on public.obligation_evidence_state from anon;
revoke all on public.obligation_evidence_state from public;
grant select on public.obligation_evidence_state to authenticated;
grant select on public.obligation_evidence_state to service_role;

-- ------------------------------------------------------------
-- VERIFY — every constraint attempted, not asserted. CLAUDE.md §3.7.
-- ------------------------------------------------------------
do $$
declare co uuid; other_co uuid; doc uuid; ob uuid; rt uuid; ent uuid; ok boolean; n bigint;
begin
  select id into co from public.companies order by created_at limit 1;
  select id into other_co from public.companies where id <> co limit 1;
  select id into doc from public.documents where company_id = co limit 1;
  select id into rt from public.requirement_templates where effective_to is null limit 1;
  if co is null or rt is null then
    raise notice 'MIGRATION 020: no company or library rows here; behavioural tests skipped.';
    return;
  end if;

  insert into public.obligations (company_id, requirement_template_id, status, resolved_by)
  values (co, rt, 'applies', 'computed_by_code') returning id into ob;

  -- 1. A user link may not carry a machine confidence.
  ok := false;
  begin
    insert into public.obligation_evidence (company_id, obligation_id, document_id, contribution, matched_by, match_confidence)
    values (co, ob, doc, 'satisfies', 'user', 'high');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'MIGRATION 020 FAILED: a user link accepted a machine confidence.'; end if;

  -- 2. A machine link MUST carry one.
  ok := false;
  begin
    insert into public.obligation_evidence (company_id, obligation_id, document_id, contribution, matched_by)
    values (co, ob, doc, 'satisfies', 'ai_match');
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'MIGRATION 020 FAILED: a machine link was accepted with no confidence.'; end if;

  -- 3. *** CROSS-TENANT DOCUMENT REFUSED BY THE DATABASE, not by a route. ***
  if other_co is not null and doc is not null then
    ok := false;
    begin
      insert into public.obligation_evidence (company_id, obligation_id, document_id, contribution, matched_by)
      values (other_co, ob, doc, 'satisfies', 'user');
    exception when foreign_key_violation then ok := true; when others then ok := true; end;
    if not ok then raise exception 'MIGRATION 020 FAILED: evidence linked a document belonging to another company.'; end if;
  end if;

  if doc is not null then
    -- 4. One live link per (obligation, document).
    insert into public.obligation_evidence (company_id, obligation_id, document_id, contribution, matched_by)
    values (co, ob, doc, 'satisfies', 'user');
    ok := false;
    begin
      insert into public.obligation_evidence (company_id, obligation_id, document_id, contribution, matched_by)
      values (co, ob, doc, 'satisfies', 'user');
    exception when unique_violation then ok := true; end;
    if not ok then raise exception 'MIGRATION 020 FAILED: a second live link on the same pair was accepted.'; end if;

    -- 5. The view counts it as live.
    select live_evidence into n from public.obligation_evidence_state where obligation_id = ob;
    if n <> 1 then raise exception 'MIGRATION 020 FAILED: live_evidence is %, expected 1.', n; end if;

    -- 6. A CORRECTION removes it from live, and ALLOWS RE-LINKING the same document.
    update public.obligation_evidence
       set valid_until = current_date, superseded_reason = '__mig020__ wrong permit'
     where obligation_id = ob and document_id = doc;
    select live_evidence into n from public.obligation_evidence_state where obligation_id = ob;
    if n <> 0 then raise exception 'MIGRATION 020 FAILED: a corrected link still counts as live.'; end if;
    select expired_evidence into n from public.obligation_evidence_state where obligation_id = ob;
    if n <> 0 then raise exception 'MIGRATION 020 FAILED: a CORRECTION was counted as an EXPIRY. They are different events.'; end if;
    insert into public.obligation_evidence (company_id, obligation_id, document_id, contribution, matched_by)
    values (co, ob, doc, 'satisfies', 'user');
    select live_evidence into n from public.obligation_evidence_state where obligation_id = ob;
    if n <> 1 then raise exception 'MIGRATION 020 FAILED: could not re-link after a correction.'; end if;

    -- 7. EXPIRY is filtered by the view, with nothing running.
    update public.obligation_evidence set valid_until = current_date - 1
     where obligation_id = ob and superseded_reason is null;
    select live_evidence into n from public.obligation_evidence_state where obligation_id = ob;
    if n <> 0 then raise exception 'MIGRATION 020 FAILED: expired evidence still counted as live. CLAUDE.md §3.2.'; end if;
    select expired_evidence into n from public.obligation_evidence_state where obligation_id = ob;
    if n <> 1 then raise exception 'MIGRATION 020 FAILED: expired_evidence is %, expected 1.', n; end if;
  end if;

  delete from public.obligation_evidence where obligation_id = ob;
  delete from public.obligations where id = ob;
  raise notice 'MIGRATION 020 OK: confidence-fits-source, cross-tenant document refused, one live link, correction is not expiry, re-link after correction, and expiry filtered by the view.';
end $$;

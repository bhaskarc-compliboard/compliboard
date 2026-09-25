-- 046 — A REJECTED FACT KEEPS THE SENTENCE THAT REJECTED IT.
--
-- WHY THIS IS NOT PART OF 045. That migration is applied. Editing an applied migration makes the
-- file disagree with what ran, and the from-zero replay is the only thing that proves the chain
-- builds a database from nothing — a chain whose files have been rewritten after the fact proves
-- nothing at all. So this is its own number.
--
-- WHY IT EXISTS. The drawer's "Not right" on a proposed fact requires one line of reason, the
-- same as on a gap, and `fact_proposals` had nowhere to put it: id, company_id, topic_id,
-- switch_key, proposed_value, from_turn_id, quote, status, created_at, updated_at, document_id,
-- locator, source, basis. Asking somebody to explain and then discarding what they wrote is
-- worse than not asking. The vision's rule is close, never delete, WITH THE REASON.
--
-- `document_gaps` already has `dismissed_reason` for exactly this; this is the same column on the
-- other half of the queue, named for what it records rather than copied for symmetry — a gap is
-- dismissed, a fact is rejected, and those are different verbs on the screen.

begin;

alter table public.fact_proposals
  add column if not exists rejected_reason text;

comment on column public.fact_proposals.rejected_reason is
  'Why a person said this proposed fact is not right. Required by the route when status becomes '
  'rejected; null on everything else. The proposal is kept, never deleted.';

do $$
declare
  co uuid; tp uuid; fp uuid; got text;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 046: no company on this database, probe skipped.';
    return;
  end if;
  insert into public.topics (company_id, title) values (co, 'migration-046-probe') returning id into tp;
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value)
    values (co, tp, 'probe_key', 'probe') returning id into fp;

  -- It starts null: a proposal nobody has answered has no reason, and null says that.
  if (select rejected_reason from public.fact_proposals where id = fp) is not null then
    raise exception 'MIGRATION 046 FAILED: rejected_reason did not start null.';
  end if;

  update public.fact_proposals
     set status = 'rejected', rejected_reason = 'We have no critical operations to shut down.'
   where id = fp;
  select rejected_reason into got from public.fact_proposals where id = fp;
  if got is null then raise exception 'MIGRATION 046 FAILED: the reason did not store.'; end if;

  delete from public.topics where id = tp;
  raise notice 'MIGRATION 046: a rejected proposal keeps its reason.';
end $$;

commit;

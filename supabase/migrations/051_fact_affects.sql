-- 051 — "WHAT THIS AFFECTS" WAS BEING COMPUTED AND DROPPED, LIKE THE QUOTE CHECK BEFORE IT.
--
-- `prompts/document-scan.ts` asks for it on every fact — "one line saying what it affects" —
-- `ScanFact` carries it, `normaliseScan` normalises it, and `saveScan` then writes the proposal
-- without it. The same shape as `quote_verified` in migration 047, found the same way: building
-- the screen that needed to read it.
--
-- IT IS NOT DECORATION. The vision's rule for the queue is that "every proposal says in one line
-- what it is for — 'this affects which OSHA rules apply to you'", and it is half of what makes a
-- queue worth opening rather than a list of trivia. It is also the first key of the To confirm
-- ranking: a proposal we can say something about is worth somebody's tap before one we cannot.
--
-- Nullable, because a proposal from the nightly conversation summariser has never had one and a
-- model may legitimately not offer it. Null means "we could not say what this is for", which is
-- exactly the thing the ranking should put last.

begin;

alter table public.fact_proposals
  add column if not exists affects text;

comment on column public.fact_proposals.affects is
  'One line on what this fact changes for the company, from the scan. Null when nothing said — '
  'which is what the To confirm queue ranks last, because a proposal nobody can explain is the '
  'one a person should be asked about least eagerly.';

do $$
declare
  co uuid; tp uuid; fp uuid;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 051: no company on this database, probe skipped.';
    return;
  end if;
  insert into public.topics (company_id, title) values (co, 'migration-051-probe') returning id into tp;

  -- It starts null: an unanswered question, not an empty answer.
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value)
    values (co, tp, 'probe_key', 'x') returning id into fp;
  if (select affects from public.fact_proposals where id = fp) is not null then
    raise exception 'MIGRATION 051 FAILED: affects did not start null.';
  end if;

  update public.fact_proposals
     set affects = 'This affects which OSHA rules apply to you.' where id = fp;
  if (select affects from public.fact_proposals where id = fp) is null then
    raise exception 'MIGRATION 051 FAILED: affects did not store.';
  end if;

  delete from public.topics where id = tp;
  raise notice 'MIGRATION 051: a proposal can say what it is for.';
end $$;

commit;

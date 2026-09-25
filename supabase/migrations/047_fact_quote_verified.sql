-- 047 — THE QUOTE CHECK WAS BEING RUN AND THROWN AWAY.
--
-- `normaliseScan` calls `verifyQuote()` on every fact — it strips tags and punctuation and asks
-- whether the model's quoted words are actually in the extracted text — and then `saveScan`
-- writes the fact to `fact_proposals` without it. `document_gaps` has kept `quote_verified` since
-- migration 040; the other half of the same check has been computed and discarded ever since.
--
-- WHY IT MATTERS MORE ON A FACT THAN ON A GAP. A fact is a claim ABOUT THE COMPANY that a person
-- is being asked to confirm — "42 employees at the Portland facility" — and confirming it writes
-- it into what the product believes. The quote is the evidence offered for it. A quote that is
-- not in the file is a paraphrase at best, and the person confirming deserves to be told that
-- before they agree. Found building Run 4's drawer, which had nowhere to read it from.
--
-- NULL IS NOT FALSE, and the three-way distinction is the whole point:
--   true   the words are in the file
--   false  they are not — shown in amber, kept, never dropped
--   null   there was nothing to check against. A PDF goes to the model whole as a document
--          block and yields no extractable text locally, so most rows are legitimately null.
--          Storing null as false would accuse the model of inventing every quote in every PDF.

begin;

alter table public.fact_proposals
  add column if not exists quote_verified boolean;

comment on column public.fact_proposals.quote_verified is
  'Whether the quote was found word for word in the text we could extract. NULL means there was '
  'nothing to check against (a PDF read as a document block), which is not the same as false.';

do $$
declare
  co uuid; tp uuid; a uuid; b uuid; c uuid;
begin
  select id into co from public.companies limit 1;
  if co is null then
    raise notice 'MIGRATION 047: no company on this database, probe skipped.';
    return;
  end if;
  insert into public.topics (company_id, title) values (co, 'migration-047-probe') returning id into tp;

  -- All three states are storable and distinguishable.
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, quote_verified)
    values (co, tp, 'probe_true', 'x', true) returning id into a;
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value, quote_verified)
    values (co, tp, 'probe_false', 'x', false) returning id into b;
  insert into public.fact_proposals (company_id, topic_id, switch_key, proposed_value)
    values (co, tp, 'probe_null', 'x') returning id into c;

  if (select quote_verified from public.fact_proposals where id = a) is not true then
    raise exception 'MIGRATION 047 FAILED: true did not store.';
  end if;
  if (select quote_verified from public.fact_proposals where id = b) is not false then
    raise exception 'MIGRATION 047 FAILED: false did not store.';
  end if;
  -- *** AND THE ONE THAT WOULD BE EASY TO GET WRONG: unset stays NULL, never false. ***
  if (select quote_verified from public.fact_proposals where id = c) is not null then
    raise exception 'MIGRATION 047 FAILED: an unchecked quote defaulted to something other than null.';
  end if;

  delete from public.topics where id = tp;
  raise notice 'MIGRATION 047: true, false and null are all storable and distinct.';
end $$;

commit;

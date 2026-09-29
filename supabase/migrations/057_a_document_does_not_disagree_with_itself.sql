-- 057 — A DOCUMENT DOES NOT DISAGREE WITH ITSELF
--
-- Task 0, commit 4, from the 29 September smoke test on the live site.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS SEEN, AND WHERE THE ROWS CAME FROM
--
-- The Company information page asked a person to choose between
--
--     "Yes, kept in the front office"      and      "Yes — an AED kept in the front office"
--
-- for one fact key — **both proposed by the same Emergency Action Plan**, one per reading. The queue
-- lifted it out as "we have two different answers", which is the correct thing to do with two
-- disagreeing sources and the wrong thing to be shown: only two different DOCUMENTS can disagree. A
-- document does not disagree with itself; its latest reading is what it says.
--
-- The cause was `lib/documentScan.ts` `saveScan`, which withdrew a pending proposal only when the new
-- reading went SILENT about its key. A key the new reading restated in different words kept both
-- rows. That was deliberate — the comment argued for it, on the grounds that "38 instead of 42" is a
-- changed proposal rather than a withdrawn one — which is why it survived three runs. The code rule
-- is changed in the same commit as this migration: re-reading a document now withdraws every pending
-- proposal from its earlier readings.
--
-- ---------------------------------------------------------------------------
-- WHY A MIGRATION AS WELL AS A CODE FIX
--
-- The code fix only helps the NEXT reading. The rows are already there, and they are on production:
-- read on 29 September through the Supabase CLI's own connection, SELECT only —
--
--     01-eap-chemical.pdf   scanned 2026-09-27 21:55:51   4 pending proposals older than that scan
--     04-fsp-food.pdf       scanned 2026-09-28 01:24:49   1
--
-- Five rows, and the first four are the pair the smoke test found. Left alone they stay in the queue
-- for ever, because nothing re-reads a document on its own: the sweep only takes `status = 'uploaded'`
-- and those two documents are `read`. So the fix has to reach backwards once.
--
-- Staging had **zero**, because it was reset on 28 September and each document has been read once.
-- The same query was run there first with its filter dropped, to prove it returns rows when rows
-- exist rather than reporting an absence it could not have seen.
--
-- ---------------------------------------------------------------------------
-- WHAT IT TOUCHES, AND WHAT IT MUST NOT
--
-- EXACTLY the rows the new rule would have withdrawn: `status = 'proposed'`, belonging to a document
-- that has a current scan, created BEFORE that scan ran.
--
--   · a proposal from the CURRENT reading            — untouched, it is still the question
--   · a CONFIRMED proposal                           — untouched, a person's decision outranks a
--                                                      re-read, and the accepted row is the history a
--                                                      corrected fact points back to (migration 056)
--   · a REJECTED proposal                            — untouched, and it teaches the next scan
--   · a proposal on a document with NO current scan   — untouched, nothing has replaced its reading
--   · a proposal from a CONVERSATION (topic_id)       — untouched; it has no document to re-read
--
-- `withdrawn` is not `rejected`, and the drawer's wording keeps them apart. The label changed in this
-- commit too, because the old one stopped being true: it read "No longer proposed by the latest
-- reading", which is false for a key the latest reading DOES restate. It now reads "From an earlier
-- reading of this document", which is true both when the new reading is silent and when it restates.
-- ===========================================================================

begin;

-- The one statement. Written once, and the verify block below runs the SAME shape against probe rows
-- rather than re-describing it.
update public.fact_proposals fp
   set status = 'withdrawn'
  from public.document_scans s
 where s.document_id = fp.document_id
   and s.is_current
   and fp.status = 'proposed'
   and fp.created_at < s.scanned_at;

-- ===========================================================================
-- VERIFY. Probe rows on a THROWAWAY company (the pattern 052, 053, 055 and 056 set), and the
-- assertions are the four things that must NOT move, not only the one that must.
-- ===========================================================================
do $$
declare
  co uuid; doc uuid; doc2 uuid; sc uuid;
  older_pending uuid; current_pending uuid; older_accepted uuid; older_rejected uuid;
  unscanned_pending uuid;
  n int;
begin
  insert into public.companies (name, industry, state)
       values ('Migration 057 probe', 'chemical-manufacturing', 'OR') returning id into co;

  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'migration-057-probe.pdf', 'probe/057', 'application/pdf') returning id into doc;
  -- A second document with NO scan at all, to prove the statement needs a current scan to act.
  insert into public.documents (company_id, name, file_url, file_type)
       values (co, 'migration-057-unscanned.pdf', 'probe/057b', 'application/pdf') returning id into doc2;

  insert into public.document_scans (document_id, company_id, kind, status, scanned_at, is_current)
       values (doc, co, 'program', 'gaps_found', now() - interval '1 hour', true) returning id into sc;

  -- Older than the current scan, still pending: the ONE row that must move.
  insert into public.fact_proposals
         (company_id, document_id, source, switch_key, proposed_value, status, created_at)
       values (co, doc, 'document', 'aed_location', 'Yes, kept in the front office', 'proposed',
               now() - interval '2 hours') returning id into older_pending;
  -- From the current reading: must stay pending, or the fix withdraws the question it just asked.
  insert into public.fact_proposals
         (company_id, document_id, source, switch_key, proposed_value, status, created_at)
       values (co, doc, 'document', 'aed_location', 'Yes — an AED kept in the front office', 'proposed',
               now() - interval '30 minutes') returning id into current_pending;
  -- Older AND confirmed: a person decided, and a re-read does not undecide it.
  insert into public.fact_proposals
         (company_id, document_id, source, switch_key, proposed_value, status, created_at)
       values (co, doc, 'document', 'employee_count', '42', 'accepted',
               now() - interval '2 hours') returning id into older_accepted;
  -- Older AND rejected: stays rejected, because it teaches the next scan.
  insert into public.fact_proposals
         (company_id, document_id, source, switch_key, proposed_value, status, created_at, rejected_reason)
       values (co, doc, 'document', 'shift_pattern', 'three shifts', 'rejected',
               now() - interval '2 hours', 'we run two') returning id into older_rejected;
  -- Pending on a document nobody has scanned: nothing has replaced its reading.
  insert into public.fact_proposals
         (company_id, document_id, source, switch_key, proposed_value, status, created_at)
       values (co, doc2, 'document', 'facility_address', 'somewhere', 'proposed',
               now() - interval '2 hours') returning id into unscanned_pending;

  -- THE SAME STATEMENT AS ABOVE.
  update public.fact_proposals fp
     set status = 'withdrawn'
    from public.document_scans s
   where s.document_id = fp.document_id
     and s.is_current
     and fp.status = 'proposed'
     and fp.created_at < s.scanned_at;

  if (select status from public.fact_proposals where id = older_pending) <> 'withdrawn' then
    raise exception 'MIGRATION 057 FAILED: a pending proposal older than the current scan was not withdrawn.';
  end if;
  if (select status from public.fact_proposals where id = current_pending) <> 'proposed' then
    raise exception 'MIGRATION 057 FAILED: it withdrew a proposal from the CURRENT reading — that is the question, not a leftover.';
  end if;
  if (select status from public.fact_proposals where id = older_accepted) <> 'accepted' then
    raise exception 'MIGRATION 057 FAILED: it touched a CONFIRMED proposal. A person''s decision outranks a re-read.';
  end if;
  if (select status from public.fact_proposals where id = older_rejected) <> 'rejected' then
    raise exception 'MIGRATION 057 FAILED: it touched a REJECTED proposal.';
  end if;
  if (select status from public.fact_proposals where id = unscanned_pending) <> 'proposed' then
    raise exception 'MIGRATION 057 FAILED: it withdrew a proposal on a document with no current scan.';
  end if;

  -- And nothing else moved: exactly one of the five probe rows changed.
  select count(*) into n from public.fact_proposals
   where company_id = co and status = 'withdrawn';
  if n <> 1 then
    raise exception 'MIGRATION 057 FAILED: expected exactly 1 withdrawn probe row, found %.', n;
  end if;

  -- ---- privileges, READ BACK. An UPDATE migration must not have moved a grant. ----
  if has_table_privilege('anon', 'public.fact_proposals', 'SELECT')
     or has_table_privilege('anon', 'public.fact_proposals', 'UPDATE') then
    raise exception 'MIGRATION 057 FAILED: anon holds a privilege on fact_proposals.';
  end if;
  if not has_table_privilege('authenticated', 'public.fact_proposals', 'SELECT') then
    raise exception 'MIGRATION 057 FAILED: authenticated cannot read fact_proposals.';
  end if;

  delete from public.companies where id = co;
  raise notice 'MIGRATION 057 OK: a pending proposal older than the current scan is withdrawn; the current reading''s, a confirmed one, a rejected one and one on an unscanned document are all untouched.';
end $$;

commit;

-- ============================================================
-- COMPLIBOARD — MIGRATION 016: close_and_replace_obligations
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Phase 4.1 computes a company's obligations in code. Until now nothing wrote them, and the
-- obvious way to write them — delete the old ones, insert the new ones — is forbidden:
-- CLAUDE.md §3.2 says obligations are never deleted, only marked. "We were subject to this
-- from March 2024 to January 2026" is the sentence this product exists to be able to say,
-- and it is not recoverable from anything once the row is gone.
--
-- TODO 4.2 specified `replace_obligations` as "DELETE+INSERT in one transaction", inherited
-- from a sibling project whose rows were a derived extract of an uploaded spreadsheet — there,
-- re-uploading reproduces everything and deleting loses nothing. Here the rows ARE the record.
-- The transaction mechanism ports; the retention policy does not. DECISIONS.md §47.
--
-- *** THE NAME IS PART OF THE DECISION. *** `replace_` is what carried the delete semantics
-- across in the first place, and a function name is what the next person reads before they
-- read anything else.
--
-- WHAT "REPLACE" MEANS HERE. Four cases, and the first is the common one:
--
--   open row, status unchanged   -> touch last_verified_at. NO NEW ROW.
--   open row, status changed     -> set applicable_to on the old, insert the new
--   no open row, in the new set  -> insert
--   open row, gone from the set  -> set applicable_to. No replacement, no delete.
--
-- IDEMPOTENCE IS A REQUIREMENT, NOT A NICETY. A function that always closes and reopens
-- writes one row per requirement per run, and a nightly recompute turns the history that
-- justified this whole design into noise within a week.
--
-- CLOSE BEFORE INSERT IS NOT A STYLE PREFERENCE. `idx_obligations_one_open` is UNIQUE on
-- (company_id, entity_id, requirement_template_id) WHERE applicable_to IS NULL, with NULLS
-- NOT DISTINCT — so every company-level obligation (entity_id NULL, the common case) collides
-- with itself. Insert-then-close is rejected by the index.
--
-- SECURITY INVOKER, NOT DEFINER. The function has no reason to hold rights the caller lacks:
-- its only caller is the worker or a route holding the service role, which already bypasses
-- RLS. A DEFINER function here would be a standing privilege escalation with no purpose.
-- The ownership guard is therefore raised IN SQL — the database enforces the tenancy
-- invariant even though the only caller could ignore it. That is the half of the BizPulses
-- pattern that does transfer.
--
-- AND `REVOKE ... FROM PUBLIC` IS NOT OPTIONAL. Postgres grants EXECUTE on a new function to
-- PUBLIC by default — the same surprise CLAUDE.md §3.6 records for tables, where "not
-- granting is not denying". Without the revoke, `anon` could call this.
-- ============================================================

create or replace function public.close_and_replace_obligations(
  p_company_id   uuid,
  p_obligations  jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bad        bigint;
  v_closed     bigint;
  v_touched    bigint;
  v_opened     bigint;
  v_open_total bigint;
begin
  if p_company_id is null then
    raise exception 'close_and_replace_obligations: p_company_id is required';
  end if;
  if p_obligations is null or jsonb_typeof(p_obligations) <> 'array' then
    raise exception 'close_and_replace_obligations: p_obligations must be a JSON array, got %',
      coalesce(jsonb_typeof(p_obligations), 'null');
  end if;

  -- ----------------------------------------------------------
  -- GUARDS. All of them run BEFORE anything is written, so a refused call leaves the
  -- company's obligations exactly as they were rather than half-closed.
  -- ----------------------------------------------------------

  -- 1. TENANCY. A site id belonging to another company must never be written into this
  --    company's obligations. Checked here rather than in the caller because the caller
  --    holds the service role and RLS will not check it for them.
  select count(*) into v_bad
    from jsonb_array_elements(p_obligations) x
    left join public.entities e on e.id = nullif(x->>'entity_id', '')::uuid
   where nullif(x->>'entity_id', '') is not null
     and (e.id is null or e.company_id <> p_company_id);
  if v_bad > 0 then
    raise exception 'close_and_replace_obligations: % obligation(s) name an entity that does not belong to company %',
      v_bad, p_company_id;
  end if;

  -- 2. The requirement must exist. The FK would catch this on insert, but only AFTER the
  --    close has run — and the error would name a constraint rather than the problem.
  select count(*) into v_bad
    from jsonb_array_elements(p_obligations) x
    left join public.requirement_templates rt on rt.id = (x->>'requirement_template_id')::uuid
   where rt.id is null;
  if v_bad > 0 then
    raise exception 'close_and_replace_obligations: % obligation(s) name a requirement_template that does not exist', v_bad;
  end if;

  -- 3. The payload must not contain the same (entity, requirement) twice. The unique index
  --    would reject it, but from inside a half-applied statement.
  select count(*) into v_bad from (
    select (x->>'requirement_template_id')::uuid as rtid, nullif(x->>'entity_id','')::uuid as eid
      from jsonb_array_elements(p_obligations) x
     group by 1, 2 having count(*) > 1) d;
  if v_bad > 0 then
    raise exception 'close_and_replace_obligations: payload names the same (entity, requirement) % time(s) over', v_bad;
  end if;

  create temporary table _incoming on commit drop as
  select (x->>'requirement_template_id')::uuid            as rtid,
         nullif(x->>'entity_id', '')::uuid                as eid,
         (x->>'status')::public.obligation_status         as status,
         coalesce(nullif(x->>'resolved_by',''), 'computed_by_code') as resolved_by,
         x->>'resolution_rationale'                       as rationale,
         coalesce(x->'determined_by', '{}'::jsonb)        as determined_by
    from jsonb_array_elements(p_obligations) x;

  -- ----------------------------------------------------------
  -- CLOSE. Anything open that is not in the new set with the SAME status. Rows whose status
  -- is unchanged are deliberately excluded and survive untouched — that is idempotence.
  -- ----------------------------------------------------------
  update public.obligations o
     set applicable_to = current_date,
         updated_at    = now()
   where o.company_id = p_company_id
     and o.applicable_to is null
     and not exists (
       select 1 from _incoming i
        where i.rtid = o.requirement_template_id
          and i.eid is not distinct from o.entity_id
          and i.status = o.status);
  get diagnostics v_closed = row_count;

  -- ----------------------------------------------------------
  -- TOUCH. The unchanged ones. "We checked and it still holds" is a different fact from
  -- "we established it", and only this one updates.
  -- ----------------------------------------------------------
  update public.obligations o
     set last_verified_at = now(),
         updated_at       = now()
   where o.company_id = p_company_id
     and o.applicable_to is null
     and exists (
       select 1 from _incoming i
        where i.rtid = o.requirement_template_id
          and i.eid is not distinct from o.entity_id
          and i.status = o.status);
  get diagnostics v_touched = row_count;

  -- ----------------------------------------------------------
  -- INSERT. Whatever has no open row left — the genuinely new, and the ones just closed
  -- because their status changed.
  -- ----------------------------------------------------------
  insert into public.obligations
    (company_id, entity_id, requirement_template_id, status, applicable_from,
     resolved_by, resolution_rationale, determined_by)
  select p_company_id, i.eid, i.rtid, i.status, current_date,
         i.resolved_by, i.rationale, i.determined_by
    from _incoming i
   where not exists (
     select 1 from public.obligations o
      where o.company_id = p_company_id
        and o.applicable_to is null
        and o.requirement_template_id = i.rtid
        and o.entity_id is not distinct from i.eid);
  get diagnostics v_opened = row_count;

  select count(*) into v_open_total
    from public.obligations
   where company_id = p_company_id and applicable_to is null;

  drop table _incoming;

  return jsonb_build_object(
    'closed', v_closed, 'unchanged', v_touched, 'opened', v_opened,
    'open_total', v_open_total, 'received', jsonb_array_length(p_obligations));
end $$;

comment on function public.close_and_replace_obligations(uuid, jsonb) is
  $c$Writes one company's obligations atomically. CLOSES rows that changed or went away by
setting applicable_to, and INSERTS the new ones — it contains no DELETE, because obligations
are history and CLAUDE.md §3.2 forbids deleting them. Unchanged rows are touched, not
reopened, so a repeat run writes nothing. Close runs before insert because
idx_obligations_one_open rejects the other order. Ownership is checked in SQL: the only
caller holds the service role and RLS will not check it for them. DECISIONS.md §47.$c$;

-- ------------------------------------------------------------
-- GRANTS. Postgres gives EXECUTE on a new function to PUBLIC by default — "not granting is
-- not denying", CLAUDE.md §3.6. Without the revoke below, an unauthenticated caller could
-- rewrite any company's obligations by guessing a uuid.
-- ------------------------------------------------------------
revoke all on function public.close_and_replace_obligations(uuid, jsonb) from public;
revoke all on function public.close_and_replace_obligations(uuid, jsonb) from anon;
revoke all on function public.close_and_replace_obligations(uuid, jsonb) from authenticated;
grant execute on function public.close_and_replace_obligations(uuid, jsonb) to service_role;

-- ------------------------------------------------------------
-- VERIFY — every claim above, attempted rather than asserted.
-- ------------------------------------------------------------
do $$
declare
  co uuid; ent uuid; other_ent uuid; rt1 uuid; rt2 uuid;
  res jsonb; n bigint; st public.obligation_status;
begin
  select id into co from public.companies order by created_at limit 1;
  select id into ent from public.entities where company_id = co and entity_type = 'site' limit 1;
  select id into other_ent from public.entities where company_id <> co limit 1;
  select id into rt1 from public.requirement_templates where effective_to is null order by requirement_name limit 1;
  select id into rt2 from public.requirement_templates where effective_to is null and id <> rt1 order by requirement_name limit 1;

  if co is null or rt1 is null or rt2 is null then
    raise notice 'MIGRATION 016: no company or library rows here; behavioural tests skipped.';
    return;
  end if;

  if exists (select 1 from public.obligations where company_id = co) then
    raise notice 'MIGRATION 016: company % already has obligations; behavioural tests skipped to avoid touching real data.', co;
    return;
  end if;

  -- 1. FIRST RUN inserts.
  res := public.close_and_replace_obligations(co, jsonb_build_array(
    jsonb_build_object('requirement_template_id', rt1, 'entity_id', null, 'status', 'applies',
                       'resolution_rationale', '__mig016__ one', 'determined_by', '{"switches":[]}'::jsonb),
    jsonb_build_object('requirement_template_id', rt2, 'entity_id', null, 'status', 'unknown',
                       'resolution_rationale', '__mig016__ two', 'determined_by', '{}'::jsonb)));
  if (res->>'opened')::int <> 2 or (res->>'open_total')::int <> 2 then
    raise exception 'MIGRATION 016 FAILED: first run opened %, total % (expected 2, 2). %', res->>'opened', res->>'open_total', res;
  end if;

  -- 2. IDEMPOTENCE — the same payload again must write NO new row.
  res := public.close_and_replace_obligations(co, jsonb_build_array(
    jsonb_build_object('requirement_template_id', rt1, 'entity_id', null, 'status', 'applies',
                       'resolution_rationale', '__mig016__ one', 'determined_by', '{"switches":[]}'::jsonb),
    jsonb_build_object('requirement_template_id', rt2, 'entity_id', null, 'status', 'unknown',
                       'resolution_rationale', '__mig016__ two', 'determined_by', '{}'::jsonb)));
  if (res->>'opened')::int <> 0 or (res->>'closed')::int <> 0 or (res->>'unchanged')::int <> 2 then
    raise exception 'MIGRATION 016 FAILED: a repeat run was not idempotent — %', res;
  end if;
  select count(*) into n from public.obligations where company_id = co;
  if n <> 2 then
    raise exception 'MIGRATION 016 FAILED: repeat run left % rows, expected 2. History is churning.', n;
  end if;

  -- 3. A STATUS CHANGE closes the old and opens a new one. NOTHING IS DELETED.
  res := public.close_and_replace_obligations(co, jsonb_build_array(
    jsonb_build_object('requirement_template_id', rt1, 'entity_id', null, 'status', 'applies',
                       'resolution_rationale', '__mig016__ one', 'determined_by', '{"switches":[]}'::jsonb),
    jsonb_build_object('requirement_template_id', rt2, 'entity_id', null, 'status', 'applies',
                       'resolution_rationale', '__mig016__ two now applies', 'determined_by', '{}'::jsonb)));
  if (res->>'closed')::int <> 1 or (res->>'opened')::int <> 1 then
    raise exception 'MIGRATION 016 FAILED: a status change should close 1 and open 1 — %', res;
  end if;
  select count(*) into n from public.obligations where company_id = co;
  if n <> 3 then
    raise exception 'MIGRATION 016 FAILED: after a status change there should be 3 rows (2 open, 1 closed), found %.', n;
  end if;
  if not exists (select 1 from public.obligations
                  where company_id = co and requirement_template_id = rt2
                    and applicable_to is not null and status = 'unknown') then
    raise exception 'MIGRATION 016 FAILED: the superseded obligation was not preserved with its window.';
  end if;

  -- 4. *** undetermined -> does_not_apply MUST NOT HAPPEN SILENTLY. ***
  --    The engine may produce it; the point of this check is that the transition is
  --    RECORDED as two rows with a window, never as an in-place edit that erases the
  --    fact that we once did not know.
  res := public.close_and_replace_obligations(co, jsonb_build_array(
    jsonb_build_object('requirement_template_id', rt1, 'entity_id', null, 'status', 'undetermined',
                       'resolution_rationale', '__mig016__ dead end', 'determined_by', '{}'::jsonb)));
  res := public.close_and_replace_obligations(co, jsonb_build_array(
    jsonb_build_object('requirement_template_id', rt1, 'entity_id', null, 'status', 'does_not_apply',
                       'resolution_rationale', '__mig016__ now cleared', 'determined_by', '{}'::jsonb)));
  if not exists (select 1 from public.obligations
                  where company_id = co and requirement_template_id = rt1
                    and status = 'undetermined' and applicable_to is not null) then
    raise exception 'MIGRATION 016 FAILED: an undetermined obligation became does_not_apply with no closed row behind it. The claim would be unauditable.';
  end if;

  -- 5. A ROW THAT LEAVES THE SET IS CLOSED, NOT DELETED.
  select count(*) into n from public.obligations where company_id = co and applicable_to is null;
  if n <> 1 then
    raise exception 'MIGRATION 016 FAILED: expected 1 open row after rt2 left the payload, found %.', n;
  end if;
  if not exists (select 1 from public.obligations where company_id = co and requirement_template_id = rt2) then
    raise exception 'MIGRATION 016 FAILED: a requirement that stopped applying was DELETED rather than closed.';
  end if;

  -- 6. TENANCY. Another company's site must be refused, and refused before any write.
  if other_ent is not null then
    select count(*) into n from public.obligations where company_id = co;
    begin
      res := public.close_and_replace_obligations(co, jsonb_build_array(
        jsonb_build_object('requirement_template_id', rt1, 'entity_id', other_ent, 'status', 'applies',
                           'resolution_rationale', '__mig016__ cross tenant', 'determined_by', '{}'::jsonb)));
      raise exception 'MIGRATION 016 FAILED: a cross-tenant entity_id was ACCEPTED.';
    exception when others then
      if sqlerrm like 'MIGRATION 016 FAILED%' then raise; end if;
    end;
  end if;

  -- 7. *** ATOMICITY — fail the INSERT halfway and confirm the close rolled back with it. ***
  --    The close statement runs before the insert, so a mid-insert failure is precisely the
  --    case where obligations could be left closed-but-not-replaced: the company's whole list
  --    would silently empty. A transaction rolling back is the sort of thing that is assumed
  --    to work and never demonstrated, so it is demonstrated here, with an injected fault
  --    the guards above deliberately cannot pre-empt.
  create function pg_temp.__mig016_poison() returns trigger language plpgsql as $t$
  begin
    if new.resolution_rationale = '__mig016__ poison' then
      raise exception '__mig016__ injected failure during INSERT';
    end if;
    return new;
  end $t$;
  create trigger __mig016_poison before insert on public.obligations
    for each row execute function pg_temp.__mig016_poison();

  begin
    res := public.close_and_replace_obligations(co, jsonb_build_array(
      jsonb_build_object('requirement_template_id', rt2, 'entity_id', null, 'status', 'applies',
                         'resolution_rationale', '__mig016__ poison', 'determined_by', '{}'::jsonb)));
    raise exception 'MIGRATION 016 FAILED: the poisoned insert did not raise.';
  exception when others then
    if sqlerrm like 'MIGRATION 016 FAILED%' then raise; end if;
  end;

  drop trigger __mig016_poison on public.obligations;

  -- The payload dropped rt1 and would have closed it. If the close survived the rolled-back
  -- insert, rt1 is now closed and nothing replaced it — the failure this test exists for.
  select count(*) into n from public.obligations where company_id = co and applicable_to is null;
  select status into st from public.obligations
   where company_id = co and requirement_template_id = rt1 and applicable_to is null;
  if n <> 1 or st is distinct from 'does_not_apply' then
    raise exception 'MIGRATION 016 FAILED: a failed insert left % open row(s), rt1 status %. The close did not roll back with it — obligations were closed and not replaced.', n, st;
  end if;

  -- Clean up: the behavioural tests own every row they made.
  delete from public.obligations where company_id = co and resolution_rationale like '__mig016__%';
  if exists (select 1 from public.obligations where resolution_rationale like '__mig016__%') then
    raise exception 'MIGRATION 016 FAILED: test rows survived.';
  end if;

  raise notice 'MIGRATION 016 OK: insert, idempotence, status change, undetermined->does_not_apply windowing, close-not-delete, tenancy refusal, and INSERT-failure rollback all verified.';
end $$;

-- ------------------------------------------------------------
-- VERIFY — the grants, which are the half that fails silently.
-- ------------------------------------------------------------
do $$
declare leaked text;
begin
  select string_agg(grantee, ', ')
    into leaked
    from information_schema.role_routine_grants
   where specific_schema = 'public'
     and routine_name = 'close_and_replace_obligations'
     and grantee in ('PUBLIC', 'anon', 'authenticated');
  if leaked is not null then
    raise exception 'MIGRATION 016 FAILED: EXECUTE still held by %. Anyone could rewrite a company''s obligations.', leaked;
  end if;

  if not exists (
    select 1 from information_schema.role_routine_grants
     where specific_schema = 'public' and routine_name = 'close_and_replace_obligations'
       and grantee = 'service_role' and privilege_type = 'EXECUTE') then
    raise exception 'MIGRATION 016 FAILED: service_role cannot execute the function.';
  end if;

  raise notice 'MIGRATION 016 OK: EXECUTE is service_role only.';
end $$;

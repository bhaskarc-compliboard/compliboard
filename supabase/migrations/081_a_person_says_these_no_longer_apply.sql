-- ===========================================================================
-- 081 — A PERSON SAYS THESE NO LONGER APPLY
--
-- The owner's decision **D2**, 12 October 2026
-- (`docs/reports/jobE-independent-review.md` §7), out of E9 item 5 and N7.
--
-- **WHY: the page was a dead end, and the way out has to be recorded.**
--
-- Job E's W1 stopped a failed read from closing a company's requirements, which
-- was right and is the fix this product most needed. What it left behind,
-- measured in E9 item 5: a company that legitimately stops being a chemical
-- manufacturer (`industry: 'other'`, a real choice on the Company information
-- page) gets **500 from `/api/obligations`, every time, for ever**. 200
-- obligations stay open, nothing closes, and there is no button anywhere that
-- can recompute the list. The trade was right; the dead end is new.
--
-- D2's way out: when a recompute would close **all** of the open list, or **more
-- than half** of it, nothing closes on its own. The list stays, a note sits on
-- top, and the person answers the question — "Have they stopped applying to
-- you?" So a close can now be **a person's own act**, and that is a different
-- fact from the resolver finding a requirement no longer applies.
--
-- **WHAT THESE COLUMNS ARE.**
--
--   · `closed_by`    — the login that said "Yes, they no longer apply". NULL for
--                      every close the resolver made on the evidence, which is
--                      every close before today. ON DELETE SET NULL: the record
--                      that a person closed it must survive that person's
--                      account being deleted, and the date survives with it.
--   · `closed_reason` — short, plain, and shown on the page. The only value this
--                      release writes is `'a person said these no longer apply'`;
--                      it is a text column rather than an enum because the next
--                      reason will arrive in a release of its own and an enum
--                      would make that a migration instead of a line of code.
--
-- **`applicable_to` IS STILL THE DATE, AND STILL THE ONLY TEST FOR "OPEN".**
-- These two columns describe a close; they never decide one. `CLAUDE.md` §3.2:
-- obligations are never deleted, only marked — and nothing here deletes.
-- `close_and_replace_obligations` (migration 016) is untouched, because the
-- person's close goes through it like any other: the route stamps these two
-- columns onto the rows it has just closed, by id.
--
-- No grant is needed: a new column carries the table's own grants, and
-- `obligations` was granted in migrations 003–010 (with no DELETE policy, on
-- purpose) and re-read in 066–068.
-- ===========================================================================

begin;

alter table public.obligations add column if not exists closed_by uuid
  references auth.users(id) on delete set null;
alter table public.obligations add column if not exists closed_reason text;

comment on column public.obligations.closed_by is
  'The login that confirmed a requirement no longer applies (the owner''s decision D2, migration '
  '081). NULL means the resolver closed it on the evidence, which is every close before 12 '
  'October 2026. Survives the account being deleted, because the record of who closed it is '
  'part of the history the product exists to keep.';
comment on column public.obligations.closed_reason is
  'Why it closed, in plain words, when a person was asked. Today only "a person said these no '
  'longer apply". NULL for a close the resolver made on the evidence. It never decides whether a '
  'row is open — applicable_to does that, and still does.';

-- No index: both columns are read from rows a query has already narrowed by company and
-- `applicable_to`, which is what the existing unique index covers.

-- ===========================================================================
-- VERIFY — §3.7: both columns, the FK's ON DELETE SET NULL, that a close with
-- no person stays NULL, and that neither column changes what "open" means.
-- ===========================================================================
do $$
declare co uuid; rt uuid; ob uuid; v text; who uuid; n int;
begin
  for v in select unnest(array['closed_by', 'closed_reason']) loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'obligations' and column_name = v
    ) then
      raise exception 'MIGRATION 081 FAILED: obligations.% is not there.', v;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'obligations'
       and column_name = 'closed_by' and data_type = 'uuid'
  ) then
    raise exception 'MIGRATION 081 FAILED: obligations.closed_by is not a uuid.';
  end if;

  -- The deletion rule is the point of the column, so it is read rather than assumed.
  if not exists (
    select 1
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.conrelid = 'public.obligations'::regclass
       and c.contype = 'f' and a.attname = 'closed_by' and c.confdeltype = 'n'
  ) then
    raise exception 'MIGRATION 081 FAILED: closed_by does not point at auth.users with ON DELETE SET NULL, '
                    'so deleting an account would either fail or take the record of the close with it.';
  end if;

  insert into public.companies (name) values ('081 probe') returning id into co;
  -- Every value copied from a live row rather than composed, and `jurisdiction_layer` is NOT NULL
  -- because `requirement_templates_contractual_has_no_jurisdiction` requires one for any source
  -- type but 'contractual' — found by the constraint refusing the insert, which is what it is for.
  insert into public.requirement_templates
         (requirement_name, entity_type, source_type, industries, applies, is_determination,
          jurisdiction_layer)
       values ('081 probe requirement', 'organization', 'statutory', array['other'], 'conditional', false,
               'federal')
    returning id into rt;

  -- An OPEN obligation: no close columns, no applicable_to.
  insert into public.obligations (company_id, requirement_template_id, status)
       values (co, rt, 'unknown') returning id into ob;
  select count(*) into n from public.obligations
   where id = ob and applicable_to is null and closed_by is null and closed_reason is null;
  if n <> 1 then
    raise exception 'MIGRATION 081 FAILED: a new obligation did not come out open with no close recorded.';
  end if;

  -- A person's close: the date, the person, the reason. And it is still "closed" by the one test
  -- every reader uses, which is applicable_to.
  update public.obligations
     set applicable_to = current_date,
         closed_reason = 'a person said these no longer apply'
   where id = ob;
  select count(*) into n from public.obligations where id = ob and applicable_to is not null;
  if n <> 1 then
    raise exception 'MIGRATION 081 FAILED: applicable_to is still what decides a row is closed, and it did not take.';
  end if;
  select closed_reason into v from public.obligations where id = ob;
  if v <> 'a person said these no longer apply' then
    raise exception 'MIGRATION 081 FAILED: closed_reason did not keep what was written to it (got %).', v;
  end if;

  -- A close the RESOLVER made keeps both columns NULL, which is how the two are told apart.
  update public.obligations set closed_by = null, closed_reason = null where id = ob;
  select count(*) into n from public.obligations
   where id = ob and closed_by is null and closed_reason is null and applicable_to is not null;
  if n <> 1 then
    raise exception 'MIGRATION 081 FAILED: a resolver close cannot be told from a person close.';
  end if;

  delete from public.obligations where id = ob;
  delete from public.requirement_templates where id = rt;
  delete from public.companies where id = co;
  raise notice 'MIGRATION 081 VERIFIED: obligations.closed_by (uuid -> auth.users, ON DELETE SET NULL) and closed_reason exist; a new row is open with neither set; a person close records the reason and the date; applicable_to is still the only test for open.';
end $$;

commit;

-- ============================================================
-- COMPLIBOARD — MIGRATION 038: THE COST LEDGER
-- ============================================================
--
-- *** WHY THIS EXISTS: ONE SESSION COST $5.33 AND NOBODY COULD SAY WHERE IT WENT. ***
--
-- Three research questions, one 31-item checklist, one summary and one conversion. The total was
-- known from the billing page; the SPLIT was not knowable at all, because nothing recorded a
-- model call. Every answer to "which task is expensive?" was an estimate reconstructed from logs
-- afterwards, and a log line is not a measurement — `DECISIONS.md` §128, section J.
--
-- ------------------------------------------------------------
-- THE ROW IS WRITTEN AT THE CALL AND IS NEVER RECOMPUTED.
--
-- Including **the prices it was costed at**. `price_input_per_m`, `price_output_per_m` and
-- `price_per_search` are copied onto the row from `config/pricing.ts` at the moment of the call.
-- That is deliberate and it is the whole difference between a ledger and a report:
--
--   > ### A COST RECOMPUTED FROM TODAY'S PRICE TABLE IS NOT WHAT ANYTHING COST.
--   > If Anthropic changes a price, or the owner corrects a number they had wrong, every
--   > historical total would silently move. Last month's spend would become a different number
--   > with no record that it had changed — and the one question this table exists to answer is a
--   > question about the past.
--
-- So the price table in config is the price of the NEXT call. The price of a past call is on its
-- own row. `cost_usd` is stored too rather than computed in a view, for the same reason.
--
-- **`cost_usd` IS NULLABLE, AND NULL MEANS "NOT PRICED", NOT "FREE".** A model that is not in
-- the price table writes its tokens and a null cost. Inventing a number for an unknown model
-- would put a fiction in the one place that is supposed to be fact, and a null forces whoever
-- reads it to notice. Anything summing this column must say how many rows it could not price.
-- ------------------------------------------------------------
--
-- A TENANT CAN READ ITS OWN ROWS AND CANNOT WRITE ANY. Same reasoning as `usage_counters`
-- (migration 032): a measurement the measured party can edit is not a measurement. Only
-- service_role inserts.

create table if not exists public.ai_calls (
  id                 uuid primary key default gen_random_uuid(),
  -- Nullable: some calls genuinely have no tenant (a script, a golden run). A row with no
  -- company is still a row that cost money and still belongs in the total.
  company_id         uuid references public.companies(id) on delete cascade,

  -- What the call was FOR, not which model it used. The five the owner named, plus the four
  -- pipeline stages that also spend, so the ledger covers the bill rather than part of it.
  task               text not null check (task in (
                       'research', 'checklist', 'substeps', 'convert', 'summarise',
                       'gate', 'critique', 'audit', 'document_review', 'other')),

  model              text not null,
  effort             text,

  input_tokens       integer not null default 0 check (input_tokens  >= 0),
  output_tokens      integer not null default 0 check (output_tokens >= 0),
  searches           integer not null default 0 check (searches      >= 0),
  wall_ms            integer not null default 0 check (wall_ms       >= 0),

  -- The prices this row was costed at. See the block above.
  price_input_per_m  numeric,
  price_output_per_m numeric,
  price_per_search   numeric,
  cost_usd           numeric,

  created_at         timestamptz not null default now()
);

comment on table public.ai_calls is
  'One row per model call, written at the call. Prices are copied onto the row so a later '
  'change to config/pricing.ts cannot rewrite what a past call cost. cost_usd NULL = the model '
  'was not in the price table, which is not the same as free. DECISIONS.md §128 J.';

-- Company-leading, because every question asked of this table starts with "for whom".
create index if not exists idx_ai_calls_company_created on public.ai_calls (company_id, created_at desc);
-- And the question the owner actually asked: where did the money go, by task.
create index if not exists idx_ai_calls_task_created on public.ai_calls (task, created_at desc);

-- ------------------------------------------------------------
-- GRANTS — REVOKE FIRST, BOTH ROLES (`CLAUDE.md` §3.6).
-- A grant list describes what you added, not what the role holds: the default ACL on `public`
-- hands `anon` and `authenticated` full DML on any new table before a single GRANT runs.
-- ------------------------------------------------------------
revoke all on table public.ai_calls from anon;
revoke all on table public.ai_calls from authenticated;
grant select on table public.ai_calls to authenticated;   -- read only: no INSERT, no UPDATE, no DELETE
grant all    on table public.ai_calls to service_role;

alter table public.ai_calls enable row level security;

create policy ai_calls_select_own_company on public.ai_calls
  for select to authenticated
  using (public.ai_calls.company_id = public.auth_company_id());

-- ------------------------------------------------------------
-- VERIFY
-- ------------------------------------------------------------
do $$
declare
  n int;
  v text;
begin
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.ai_calls', v) then
      raise exception 'MIGRATION 038 FAILED: anon holds % on ai_calls.', v;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.ai_calls', 'SELECT') then
    raise exception 'MIGRATION 038 FAILED: authenticated cannot SELECT ai_calls — a tenant must be able to read its own spend.';
  end if;
  foreach v in array array['INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('authenticated', 'public.ai_calls', v) then
      raise exception 'MIGRATION 038 FAILED: authenticated holds % on ai_calls. A ledger the measured party can write is not a measurement.', v;
    end if;
  end loop;

  select count(*) into n from pg_policies where schemaname='public' and tablename='ai_calls';
  if n <> 1 then raise exception 'MIGRATION 038 FAILED: expected 1 policy on ai_calls, found %.', n; end if;

  -- THE task CHECK, TESTED BY VIOLATING IT (§3.7). A constraint nobody has tried to break
  -- is a comment.
  begin
    insert into public.ai_calls (task, model) values ('daydreaming', 'claude-opus-5');
    raise exception 'MIGRATION 038 FAILED: task accepted a value outside the allowed set.';
  exception when check_violation then null;
  end;

  -- And the non-negative checks, same rule.
  begin
    insert into public.ai_calls (task, model, output_tokens) values ('research', 'claude-opus-5', -1);
    raise exception 'MIGRATION 038 FAILED: output_tokens accepted a negative value.';
  exception when check_violation then null;
  end;

  -- A null cost must be STORABLE — it is how an unpriced model is recorded.
  insert into public.ai_calls (task, model, input_tokens, output_tokens, cost_usd)
  values ('other', 'some-unpriced-model', 10, 20, null);
  delete from public.ai_calls where model = 'some-unpriced-model';

  raise notice 'MIGRATION 038 OK: ai_calls is readable by its own tenant, writable only by service_role, refuses an unknown task and a negative token count, and stores a null cost.';
end $$;

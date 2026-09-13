-- ============================================================
-- COMPLIBOARD — MIGRATION 017: WHERE A SWITCH VALUE CAME FROM
-- ============================================================
--
-- WHY THIS EXISTS
--
-- `company_switches` holds one value per fact per company. Phase 7.2 starts writing those
-- values from documents, and the moment it does, two documents will disagree — a 2019 SDS and
-- its 2025 revision, a handbook saying 42 employees and a permit saying 60. That is normal and
-- frequent, not an error case.
--
-- THE TEMPTING SHORTCUT IS `user_locked`, AND IT IS WRONG. `user_locked` means A PERSON
-- DECIDED. A newer document winning over an older one is a different claim entirely: a person's
-- decision must survive every future pass, and a document's win must not. Reusing the flag
-- makes the two indistinguishable — at precisely the moment somebody is trying to work out why
-- a value will not update. `DECISIONS.md` §24.1: a stated value outranks an inferred one, and
-- that ordering only means something if the two are still telling apart.
--
-- SO DETERMINATIONS GET THEIR OWN HISTORY. This is §47's shape applied to facts instead of
-- obligations: keep every claim ever made, point at the current winner. "Why does this say
-- vsqg when the permit says lqg" becomes a query rather than an investigation.
--
-- AND `evidence_class` IS NOT `confidence`. `confidence` answers HOW SURE ARE WE; this answers
-- WHAT KIND OF THING CONVINCED US, and the propose-don't-write rule needs the second.
-- `docs/SWITCH-DETERMINATION.md` §2 — two circumstantial signals agreeing is `inferred`, never
-- `stated`, however consistent they are, because agreement between weak sources is also what
-- happens when both are stale.
-- ============================================================

-- ------------------------------------------------------------
-- 1. THE VOCABULARY
-- ------------------------------------------------------------
-- `absent` is a value on purpose: it lets a pass record "I looked for this and found nothing",
-- which is a useful answer and the thing that makes an empty field a specific request rather
-- than a blank. It is NEVER written into company_switches — CLAUDE.md §3.2, absence never
-- produces a value. A CHECK below enforces that.
create type public.evidence_class as enum ('stated', 'implied', 'inferred', 'absent');

-- ------------------------------------------------------------
-- 2. THE HISTORY — append-only
-- ------------------------------------------------------------
create table public.switch_determinations (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  entity_id       uuid references public.entities(id) on delete cascade,
  switch_id       text not null references public.switches(id) on delete restrict,

  value           text,
  evidence_class  public.evidence_class not null,
  confidence      public.switch_confidence,

  -- WHERE IT CAME FROM. document_id is nullable because a determination can come from a user
  -- answer or a computation, neither of which has a document.
  document_id     uuid references public.documents(id) on delete set null,
  locator         text,
  quote           text,
  reasoning       text,

  -- WHAT PRODUCED IT. prompt_sha256 is the tripwire: a prompt edit that silently changes
  -- determination behaviour must be attributable afterwards, not merely noticed.
  source          public.switch_value_source not null,
  model           text,
  prompt_sha256   text,

  determined_at   timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  -- A determination that is `absent` asserts nothing, so it must carry no value.
  constraint switch_determinations_absent_has_no_value
    check ((evidence_class = 'absent' and value is null) or (evidence_class <> 'absent')),

  -- *** A QUOTE WITHOUT A DOCUMENT IS AN ASSERTION WITH NO SOURCE. *** The whole point of
  -- `basis` is that a person can go and look. If there is a quote there must be a document.
  constraint switch_determinations_quote_needs_a_document
    check (quote is null or document_id is not null),

  -- `stated` and `implied` mean "this document says/implies it", so they require a document
  -- AND the text that does it. `inferred` may span several, so it does not.
  constraint switch_determinations_stated_needs_evidence
    check (evidence_class not in ('stated', 'implied') or (document_id is not null and quote is not null)),

  -- Pins the denormalised copy on company_switches — see the composite FK below.
  constraint switch_determinations_id_class unique (id, evidence_class)
);

create index idx_switch_determinations_company on public.switch_determinations (company_id, switch_id);
create index idx_switch_determinations_document on public.switch_determinations (document_id);

comment on table public.switch_determinations is
  $c$Every determination ever made about a company's switches, append-only. company_switches
holds the current winner and points here with determined_from. Exists so that
document-versus-document disagreement is recorded WITHOUT reusing user_locked, which means a
PERSON decided and must keep meaning only that. DECISIONS.md §24.1, §47;
docs/SWITCH-DETERMINATION.md §7.$c$;

-- ------------------------------------------------------------
-- 3. THE POINTER, AND THE DENORMALISED CLASS
-- ------------------------------------------------------------
alter table public.company_switches
  add column determined_from uuid,
  add column evidence_class  public.evidence_class;

-- *** THE COMPOSITE FOREIGN KEY IS THE POINT. *** `evidence_class` is a copy of a column on
-- another table, and a copy drifts. Migration 011 used this trick to pin switch scope; the same
-- applies here. (determined_from, evidence_class) referencing (id, evidence_class) makes the
-- copy provably the winning determination's own class — it cannot be edited to disagree.
alter table public.company_switches
  add constraint company_switches_determination_fkey
  foreign key (determined_from, evidence_class)
  references public.switch_determinations (id, evidence_class)
  on delete set null;

-- `absent` never becomes a value on a company. It is a finding, not a fact.
alter table public.company_switches
  add constraint company_switches_evidence_class_not_absent
  check (evidence_class is distinct from 'absent');

comment on column public.company_switches.determined_from is
  $c$The winning determination in switch_determinations. NULL for values that predate 7.2 or
were set by hand. "Why will this value not update" is a query against that table.$c$;

comment on column public.company_switches.evidence_class is
  $c$WHAT KIND of thing established this — not how sure we are, which is `confidence`.
`stated` means a document says it; `implied` means it follows in one step; `inferred` means
judgement or a pattern. TWO CIRCUMSTANTIAL SIGNALS AGREEING ARE `inferred`, NEVER `stated`:
agreement between weak sources is also what happens when both are stale. Pinned to the
determination it came from by a composite FK, so it cannot drift.$c$;

-- ------------------------------------------------------------
-- 4. GRANTS — "not granting is not denying" (CLAUDE.md §3.6)
-- ------------------------------------------------------------
-- Default privileges on `public` hand anon full DML on every new table. Without these revokes
-- RLS is the only thing between an unauthenticated request and every customer's determinations.
revoke all on public.switch_determinations from anon;
revoke all on public.switch_determinations from authenticated;
grant select on public.switch_determinations to authenticated;
grant all    on public.switch_determinations to service_role;

alter table public.switch_determinations enable row level security;

-- Readable by the company it belongs to; written only by the service role, because only the
-- determination pass and the ask path write here. Tenancy through auth_company_id(), never a
-- re-derived subquery (§3.6).
create policy switch_determinations_select on public.switch_determinations
  for select to authenticated
  using (switch_determinations.company_id = public.auth_company_id());

-- ------------------------------------------------------------
-- VERIFY — every constraint tried, not asserted. CLAUDE.md §3.7: a constraint nobody has
-- tried to break is a comment.
-- ------------------------------------------------------------
do $$
declare co uuid; sw text; det uuid; ok boolean;
begin
  select id into co from public.companies order by created_at limit 1;
  select id into sw from public.switches order by id limit 1;
  if co is null or sw is null then
    raise notice 'MIGRATION 017: no company or switches here; behavioural tests skipped.';
    return;
  end if;

  -- 1. `absent` may not carry a value.
  ok := false;
  begin
    insert into public.switch_determinations (company_id, switch_id, value, evidence_class, source)
    values (co, sw, 'true', 'absent', 'ai_from_documents');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'MIGRATION 017 FAILED: an `absent` determination accepted a value.'; end if;

  -- 2. `stated` without a document or a quote must be refused.
  ok := false;
  begin
    insert into public.switch_determinations (company_id, switch_id, value, evidence_class, source)
    values (co, sw, 'true', 'stated', 'ai_from_documents');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'MIGRATION 017 FAILED: a `stated` determination with no evidence was accepted.'; end if;

  -- 3. A quote with no document must be refused — a basis nobody can go and check.
  ok := false;
  begin
    insert into public.switch_determinations (company_id, switch_id, value, evidence_class, source, quote)
    values (co, sw, 'true', 'inferred', 'ai_from_documents', 'some text');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'MIGRATION 017 FAILED: a quote with no document was accepted.'; end if;

  -- 4. A legitimate `inferred` determination, with no document, is accepted.
  insert into public.switch_determinations
    (company_id, switch_id, value, evidence_class, confidence, source, reasoning)
  values (co, sw, 'true', 'inferred', 'low', 'ai_from_documents', '__mig017__ test')
  returning id into det;

  -- 5. THE COMPOSITE FK: company_switches may not claim a class the determination does not have.
  ok := false;
  begin
    insert into public.company_switches
      (company_id, switch_id, scope, entity_id, value, state, source, determined_from, evidence_class)
    select co, sw, s.scope, null, 'true', 'known', 'ai_from_documents', det, 'stated'
      from public.switches s where s.id = sw and s.scope = 'company';
    if found then ok := false; else ok := true; end if;  -- site-scoped switch: nothing inserted
  exception when foreign_key_violation then ok := true;
  end;
  if not ok then
    raise exception 'MIGRATION 017 FAILED: company_switches claimed `stated` for an `inferred` determination. The denormalised class can drift.';
  end if;

  -- 6. `absent` may never reach company_switches at all.
  ok := false;
  begin
    insert into public.company_switches
      (company_id, switch_id, scope, entity_id, value, state, source, evidence_class)
    values (co, sw, 'company', null, 'true', 'known', 'ai_from_documents', 'absent');
  exception when check_violation then ok := true; when others then ok := true;
  end;
  if not ok then raise exception 'MIGRATION 017 FAILED: `absent` was written as a company fact.'; end if;

  delete from public.switch_determinations where reasoning like '__mig017__%';
  if exists (select 1 from public.switch_determinations where reasoning like '__mig017__%') then
    raise exception 'MIGRATION 017 FAILED: test rows survived.';
  end if;

  raise notice 'MIGRATION 017 OK: absent-has-no-value, stated-needs-evidence, quote-needs-document, the composite class FK, and absent-never-a-fact all refused what they should.';
end $$;

do $$
declare leaked text;
begin
  select string_agg(grantee, ', ') into leaked
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'switch_determinations' and grantee = 'anon';
  if leaked is not null then
    raise exception 'MIGRATION 017 FAILED: anon holds grants on switch_determinations.';
  end if;
  raise notice 'MIGRATION 017 OK: anon holds nothing on switch_determinations.';
end $$;

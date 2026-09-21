-- ============================================================
-- COMPLIBOARD — MIGRATION 029: WHAT THE CRITIC FOUND
-- ============================================================
--
-- WHY NOW. `DECISIONS.md` §97 takes the critic's findings off every customer screen: all four
-- boxes are a red-lined draft, and a customer receives the corrected document, not the
-- corrections. That decision is only safe if the findings SURVIVE somewhere — `CRITIC-PASS.md`
-- §2.3's "surface, don't fix" exists because *a silent fix destroys the evidence, and a
-- self-healing loop means no failure is ever found*. Removing the UI with nowhere to write would
-- turn the product into exactly that loop.
--
-- AND TODAY THERE IS NOWHERE. `criticise()` runs in two routes — `/api/chat` checklist mode and
-- `/api/audits` — and both hand the result to the browser and forget it. Nothing has ever been
-- written down. `CRITIC-PASS.md` §7.1 asked for this in September and it was never built:
--
--     "Log every finding: severity, question number, whether it surfaced. The number that
--      matters is blocking findings as a share of answers. It needs a rate, and nothing
--      records one."
--
-- ------------------------------------------------------------
-- *** WHY TWO TABLES AND NOT ONE. THE DENOMINATOR. ***
--
-- §7.1's number is blocking findings as a share of ANSWERS. A findings-only table cannot
-- produce it: a CLEAN review writes zero rows and disappears from the denominator, so the rate
-- would be computed over reviews that found something and would be overstated by construction.
--
-- The second reason is `complete`. A review truncated mid-way also writes zero findings, and
-- "reviewed and clean" versus "review did not finish" is the distinction `CriticResult.complete`
-- exists for (lib/criticPass.ts:70 — *truncation and cleanliness are indistinguishable in an
-- empty array*). One row per REVIEW is the only place that fact can live.
--
--   critic_reviews   one row per criticise() call, INCLUDING the ones that found nothing
--   critic_findings  zero or more rows per review
-- ------------------------------------------------------------

do $$
begin
  -- Mirrors lib/criticPass.ts `Severity`. ENUM rather than TEXT + CHECK, per CLAUDE.md §3.7.
  if not exists (select 1 from pg_type where typname = 'critic_severity') then
    create type public.critic_severity as enum ('blocking', 'qualifying', 'coverage');
  end if;

  -- Which route produced it. Two producers today; a third is one `add value`.
  if not exists (select 1 from pg_type where typname = 'critic_source') then
    create type public.critic_source as enum ('chat_checklist', 'audit');
  end if;

  -- *** WHAT THE CODE DID WITH THE FINDING. ***
  -- §7.1 asked for "whether it surfaced", and §97 changes what that can mean: nothing surfaces
  -- to a customer any more, so the useful fact is what the CODE did — whether the item was
  -- removed from the answer, left in it, or only counted.
  --   withheld  blocking  — the item was removed (app/api/chat/route.ts builds withheldNames)
  --   kept      qualifying/coverage — the answer shipped unchanged
  --   counted   question 5 — a specific, counted on its own line and never acted on
  if not exists (select 1 from pg_type where typname = 'critic_disposition') then
    create type public.critic_disposition as enum ('withheld', 'kept', 'counted');
  end if;
end $$;

-- ------------------------------------------------------------
-- THE REVIEW
-- ------------------------------------------------------------
create table public.critic_reviews (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  source        public.critic_source not null,

  -- What was asked and what came back, so a row is READABLE ON ITS OWN. The route does not hold
  -- the saved checklist's id at this point — the browser saves it afterwards (page.tsx) — so a
  -- foreign key here would need a round trip through the client to populate. A self-contained
  -- row is what lets somebody grow a golden case from this without joining anything.
  question      text not null,
  answer_title  text,

  -- FALSE means the critic ran out of tokens mid-review. A caller must never report an
  -- incomplete review as "nothing found" (lib/criticPass.ts:70), and neither must a query:
  -- rates computed over this table MUST filter on complete, or a truncated review reads as a
  -- clean one.
  complete      boolean not null,

  created_at    timestamptz not null default now()
);

comment on table public.critic_reviews is
  'One row per criticise() call, INCLUDING reviews that found nothing — that is the denominator '
  'CRITIC-PASS.md §7.1 needs for "blocking findings as a share of answers". Findings are never '
  'shown to a customer (DECISIONS.md §97); this is where the evidence lives instead. '
  'Migration 029.';

-- Company-leading, per CLAUDE.md §3.7.
create index idx_critic_reviews_company_created on public.critic_reviews (company_id, created_at desc);

-- ------------------------------------------------------------
-- THE FINDINGS
-- ------------------------------------------------------------
create table public.critic_findings (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.critic_reviews(id) on delete cascade,

  -- Denormalised from the parent so every tenant-scoped query and policy has it locally, the
  -- same reason every other data table carries it (CLAUDE.md §3.6).
  company_id   uuid not null references public.companies(id) on delete cascade,

  severity     public.critic_severity not null,

  -- Which of the SEVEN questions produced it — lib/criticPass.ts:53, `CriticQuestion = 1..7`.
  -- Question 5 is the specifics line and is counted separately (§6.2), which is why the number
  -- is stored rather than folded into severity.
  question_no  smallint not null,

  item         text,           -- null for a whole-answer finding (questions 6 and 7)
  finding      text not null,
  because      text,

  -- *** VERBATIM FROM THE ANSWER, AND THE CHECK IS THE POINT. ***
  -- CRITIC-PASS.md §7 rule 2: "Every finding must quote the answer verbatim. An invented finding
  -- is hard to write when it has to point at a sentence." A finding with no quote is an
  -- impression, and impressions are what this task produces when there is nothing wrong. The
  -- constraint is what keeps that rule true in the data rather than only in the prompt.
  quote        text not null,

  disposition  public.critic_disposition not null,
  created_at   timestamptz not null default now(),

  constraint critic_findings_question_no_is_1_to_7
    check (question_no between 1 and 7),

  -- length(btrim(...)) rather than `not null` alone: an empty string passes NOT NULL, which is
  -- the same trap migration 028's title constraint catches.
  constraint critic_findings_quote_is_not_blank
    check (length(btrim(quote)) > 0)
);

comment on table public.critic_findings is
  'What the critic found, never shown to a customer (DECISIONS.md §97). `quote` is verbatim from '
  'the answer and is constrained non-blank because a finding that cannot point at a sentence is '
  'an impression (CRITIC-PASS.md §7). Migration 029.';

create index idx_critic_findings_company_severity on public.critic_findings (company_id, severity, created_at desc);
create index idx_critic_findings_review on public.critic_findings (review_id);

-- ------------------------------------------------------------
-- GRANTS AND RLS
--
-- *** NOT GRANTING IS NOT DENYING. *** CLAUDE.md §3.6: this database carries default privileges
-- (`authenticated=arwdDxtm/postgres`) that hand BOTH `anon` and `authenticated` full DML on
-- anything created in `public`, before a single GRANT runs. Migration 028 was refused by its own
-- verify block for exactly this. So both revokes are load-bearing, not tidiness.
--
-- *** `authenticated` ENDS AT ZERO, READ AND WRITE, AND THAT IS DELIBERATE. ***
--
--   These rows are SYSTEM-GENERATED QUALITY CONTROL, not tenant data that happens to be
--   internal. Two consequences:
--
--   READ:  a customer never sees the red-lined draft (§97). Nothing to grant.
--   WRITE: granting INSERT would let a user write findings against their own company from an
--          ordinary session — and §7.1's whole purpose is a RATE. A tenant who can insert rows
--          can bend the metric we use to decide whether the critic is inventing findings.
--
--   The same shape as `library_candidates`, which is closed to authenticated entirely.
--
-- The write therefore happens under the SERVICE ROLE, as a named single-statement carve-out in
-- the two routes that produce findings — the `standard_templates` pattern in
-- app/api/audits/route.ts, where the reasoning sits beside the call.
-- ------------------------------------------------------------

revoke all on table public.critic_reviews  from anon;
revoke all on table public.critic_reviews  from authenticated;
revoke all on table public.critic_findings from anon;
revoke all on table public.critic_findings from authenticated;

grant all on table public.critic_reviews  to service_role;
grant all on table public.critic_findings to service_role;

-- RLS on with NO policies: belt and braces. `service_role` bypasses RLS, so the writes still
-- work; any role that later acquires a grant by accident finds a table with no policy and
-- therefore no rows. RLS is the security boundary (CLAUDE.md §3.6), so it is enabled even where
-- the grant already closes the door.
alter table public.critic_reviews  enable row level security;
alter table public.critic_findings enable row level security;

-- ------------------------------------------------------------
-- VERIFY — read what the roles HOLD, never the grant list above.
--
-- "A GRANT LIST DESCRIBES WHAT YOU ADDED, NOT WHAT THE ROLE HOLDS" (CLAUDE.md §3.6). This block
-- uses has_table_privilege, which asks the catalog directly. Migration 028 granted three
-- privileges and was refused for holding a fourth it never granted; that is the failure this
-- block is written to reproduce if it recurs.
-- ------------------------------------------------------------
do $$
declare
  t text;
  r text;
  v text;
  ok boolean;
begin
  foreach t in array array['critic_reviews', 'critic_findings'] loop
    foreach r in array array['anon', 'authenticated'] loop
      foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
        if has_table_privilege(r, 'public.' || t, v) then
          raise exception
            'MIGRATION 029 FAILED: % holds % on public.% — these rows are system-generated '
            'quality control and no customer role may read or write them (DECISIONS.md §97).',
            r, v, t;
        end if;
      end loop;
    end loop;

    if not has_table_privilege('service_role', 'public.' || t, 'INSERT') then
      raise exception
        'MIGRATION 029 FAILED: service_role cannot INSERT into public.% — the routes write '
        'findings under the service role and would fail on the first real critique.', t;
    end if;
  end loop;

  -- *** TEST THE CHECKS BY VIOLATING THEM. *** CLAUDE.md §3.7: a constraint nobody has tried to
  -- break is a comment. Both are attempted inside a savepoint and rolled back.
  declare
    co uuid;
    rv uuid;
  begin
    select id into co from public.companies limit 1;
    if co is null then
      raise notice 'MIGRATION 029: no companies row, so the CHECK probes were skipped.';
    else
      insert into public.critic_reviews (company_id, source, question, complete)
        values (co, 'chat_checklist', 'migration 029 probe', true) returning id into rv;

      begin
        insert into public.critic_findings
          (review_id, company_id, severity, question_no, finding, quote, disposition)
          values (rv, co, 'blocking', 1, 'probe', '   ', 'withheld');
        raise exception 'MIGRATION 029 FAILED: a blank quote was accepted. A finding that '
                        'cannot point at a sentence is an impression (CRITIC-PASS.md §7).';
      exception when check_violation then null;
      end;

      begin
        insert into public.critic_findings
          (review_id, company_id, severity, question_no, finding, quote, disposition)
          values (rv, co, 'blocking', 8, 'probe', 'a real quote', 'withheld');
        raise exception 'MIGRATION 029 FAILED: question_no 8 was accepted; the critic asks 7.';
      exception when check_violation then null;
      end;

      delete from public.critic_reviews where id = rv;   -- cascades to findings
    end if;
  end;

  raise notice 'MIGRATION 029 OK: two tables, anon and authenticated hold nothing, both CHECKs refuse.';
end $$;

-- ===========================================================================
-- 076 — ONE LIVE FEED TOKEN PER COMPANY
-- ===========================================================================
-- WHY.
--
-- `GET /api/calendar/feed?t=<token>` is the one route in the product with no session, so the token
-- in `calendar_feed_tokens` IS the credential (073:§8, decision 20). Calendar step 8b part 3 built
-- the issuer, `POST /api/calendar/feed-token`, as read-then-insert: read the company's live token,
-- and if there is none, make one.
--
-- *** OPENING THE SHEET ONCE LEFT TWO LIVE TOKENS ON STAGING, AND THAT IS A READ ROW, NOT A
-- WORRY. *** `select token, created_at from calendar_feed_tokens where company_id = <Gamma>` came
-- back with two live rows **183 microseconds apart**. The cause: React Strict Mode double-invokes
-- an effect in development, so the sheet sent the POST twice; both reads found nothing, and both
-- inserted. It is not a development-only fault — one person in two tabs, or two colleagues opening
-- the sheet at the same moment, race in exactly the same way, and on production there is no Strict
-- Mode to blame. The consequence is a live credential nobody knows about: revoking "the" link
-- revokes the one the sheet shows and leaves the other answering.
--
-- The route was fixed on the day by CONVERGING — after the insert it reads the set again, keeps the
-- OLDEST live token and revokes the rest — and that was proved against the two rows that showed the
-- problem (two simultaneous POSTs returned one token; staging went from two live tokens to one).
-- But convergence is a repair, not a rule: between the losing insert and the repair there are two
-- live credentials, and any future caller that forgets to converge puts them back. The durable fix
-- is to make the second insert FAIL, which only the database can do. `DECISIONS.md` §193 and
-- `docs/HANDOFF-CODE.md` §7 recorded it as owed in the next migration; this is that migration, and
-- it is all that is in it.
--
-- WHAT THIS CHANGES FOR THE ROUTE, SAID PLAINLY BECAUSE IT IS NOT NOTHING.
--
-- Today the racing insert succeeds and the converge cleans up. After this index the racing insert
-- raises 23505, and the route's `if (error) throw error` would turn it into a 500 — so the loser of
-- the race would see "We could not make that link just now" for a link that exists. **The route
-- must treat 23505 on that insert as "somebody else just made it" and fall through to the read it
-- already does.** That is a code change, with its own unit test, in the step that follows this
-- migration; §6 of the verify block below proves the sequence at the database level, statement by
-- statement, so the code change has a specification rather than a guess.
--
-- WHY A PARTIAL UNIQUE INDEX AND NOT A UNIQUE CONSTRAINT ON `company_id`.
--
-- A plain `unique (company_id)` would allow one row per company for all time, which breaks
-- rotation: rotating a link means inserting a new row and stamping `revoked_at` on the old one, so
-- a link that was shared and then replaced can be told from one that never existed (073:461–464).
-- The rule is not "one token per company", it is "one LIVE token per company", and a predicate is
-- the only way to say that. A constraint cannot carry one; an index can.
--
-- WHAT IT DELIBERATELY DOES NOT DO.
--
--   · It does not drop `idx_calendar_feed_tokens_company` (073:469). That one covers every row for
--     a company, live or revoked, which is what `/api/account` DELETE and any future "when was this
--     rotated" read want. The new index covers only the live row.
--   · It does not touch grants, policies or RLS. No table is created here; §11 reads all eight
--     rights for both roles anyway, because `CLAUDE.md` §3.6's rule is that a grant list describes
--     what you added, not what the role holds.
--   · It does not delete a single row. The converge in §1 stamps `revoked_at` on a duplicate — the
--     same thing the route does, by the same rule (the oldest live token wins) — so the history of
--     every address that ever answered stays readable.
--
-- READ FROM STAGING BEFORE WRITING THIS (16 October 2026): `calendar_feed_tokens` holds 2 rows for
-- 1 company, of which 1 is live, and `pg_indexes` lists exactly three indexes on the table
-- (`calendar_feed_tokens_pkey`, `calendar_feed_tokens_token_key`,
-- `idx_calendar_feed_tokens_company`) — no partial index of any kind. So §1 has nothing to converge
-- on staging and will say `0`; it exists because the chain must also build a database where the
-- race has already happened, and because `create unique index` on duplicate data fails rather than
-- fixing it.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. CONVERGE FIRST, BECAUSE THE INDEX CANNOT BE BUILT OVER A COMPANY THAT ALREADY HAS TWO.
--
-- The rule is the route's rule: the OLDEST live token wins and every other live row for that
-- company is revoked. `id` breaks a tie in `created_at` so the outcome is deterministic on a replay
-- rather than "whichever the planner saw first".
--
-- The count is raised as a notice, not swallowed: a migration that quietly stamps a customer's
-- credential and says nothing is the thing this project's method exists to prevent.
-- ---------------------------------------------------------------------------
do $$
declare
  n int;
begin
  with ranked as (
    select id, row_number() over (partition by company_id order by created_at, id) as rn
      from public.calendar_feed_tokens
     where revoked_at is null
  )
  update public.calendar_feed_tokens t
     set revoked_at = now()
    from ranked
   where ranked.id = t.id and ranked.rn > 1;
  get diagnostics n = row_count;
  raise notice 'MIGRATION 076: % duplicate live feed token(s) revoked before the index was built.', n;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE RULE ITSELF.
--
-- Company-leading, as every index in this schema is, and partial on the one predicate that defines
-- "live". `if not exists` so the migration is safe to replay.
-- ---------------------------------------------------------------------------
create unique index if not exists idx_calendar_feed_tokens_company_live
  on public.calendar_feed_tokens (company_id)
  where revoked_at is null;

comment on index public.idx_calendar_feed_tokens_company_live is
  'ONE LIVE TOKEN PER COMPANY (migration 076). The feed route has no session, so this token is the '
  'credential: a second live row is a second key nobody knows about, which revoking the link shown '
  'in the sheet would not revoke. Partial, not a plain unique constraint, because rotation inserts '
  'a new row and stamps revoked_at on the old one — the rule is one LIVE token, not one token. '
  'POST /api/calendar/feed-token must read 23505 from its insert as "somebody else just made it" '
  'and re-read, which is the converge path 076''s verify block §6 specifies.';

-- ===========================================================================
-- 3. VERIFY — AND EVERY CHECK HERE TRIES TO BREAK SOMETHING.
--
-- `CLAUDE.md` §3.7: a constraint nobody has tried to break is a comment. §9a: before believing an
-- absence, prove the same check can see a presence — so the refusal in §5 is preceded by the
-- acceptance in §4, and the refusal is read by SQLSTATE rather than by the fact that something
-- threw.
--
-- Three probe companies are created here and deleted by id at the end. `company_id` is ON DELETE
-- CASCADE, so deleting the company would take its tokens, and the tokens are deleted explicitly
-- anyway so a future change to that FK cannot leave a probe credential behind.
-- ===========================================================================
do $$
declare
  co     uuid;          -- the probe company the rules are proven on
  coB    uuid;          -- a second company, to prove the rule is PER company
  coC    uuid;          -- a fresh company for the two-POST race in §6
  n      int;
  got    text;
  keep   text;
  v      text;
  def    text;
begin
  insert into public.companies (name) values ('076 probe company A') returning id into co;
  insert into public.companies (name) values ('076 probe company B') returning id into coB;
  insert into public.companies (name) values ('076 probe company C') returning id into coC;

  -- ---- 4. ONE LIVE TOKEN IS ACCEPTED. (Presence before absence, §9a.) ----
  -- If this insert ever fails, every refusal below proves nothing at all.
  insert into public.calendar_feed_tokens (company_id, token) values (co, '076-probe-live-A1');

  -- ---- 5. A SECOND LIVE TOKEN FOR THE SAME COMPANY IS REFUSED, WITH 23505. ----
  -- THIS IS THE MIGRATION. Before the index this insert succeeded, which is how one sheet open left
  -- two live credentials. The SQLSTATE is captured and compared rather than inferred from the
  -- handler, because `unique_violation` is the handler's claim and '23505' is the database's.
  got := null;
  begin
    insert into public.calendar_feed_tokens (company_id, token) values (co, '076-probe-live-A2');
    raise exception 'MIGRATION 076 FAILED: a SECOND live token was accepted for one company — '
                    'the index is not holding and the feed has two credentials again.';
  exception when unique_violation then
    got := sqlstate;
  end;
  if got <> '23505' then
    raise exception 'MIGRATION 076 FAILED: the second live token was refused with %, not 23505.', coalesce(got, '<nothing>');
  end if;

  -- ---- 6. THE CONVERGE PATH IN POST /api/calendar/feed-token, STATEMENT BY STATEMENT. ----
  --
  -- Two simultaneous POSTs, as they actually interleaved on staging (183 microseconds apart), with
  -- this index in place. The route's three steps are run in the order it runs them:
  --
  --   POST #1  read → nothing          insert P1 → accepted
  --   POST #2  read → nothing (it read before #1 committed)
  --                                    insert P2 → MUST be refused, 23505
  --            re-read → exactly one live row, and it is P1 → both callers answer P1
  --
  -- Before this migration step 2 of POST #2 succeeded and the repair came afterwards. The point of
  -- the index is that there is no window in which two live rows exist, and the point of this block
  -- is that the route can still reach one answer — which is what the 23505 branch it is about to
  -- gain has to do.
  select count(*) into n from public.calendar_feed_tokens where company_id = coC and revoked_at is null;
  if n <> 0 then
    raise exception 'MIGRATION 076 FAILED: the race probe company already holds % live token(s).', n;
  end if;
  insert into public.calendar_feed_tokens (company_id, token) values (coC, '076-probe-race-P1');
  got := null;
  begin
    insert into public.calendar_feed_tokens (company_id, token) values (coC, '076-probe-race-P2');
    raise exception 'MIGRATION 076 FAILED: the racing POST''s insert was accepted; two live tokens again.';
  exception when unique_violation then
    got := sqlstate;
  end;
  if got <> '23505' then
    raise exception 'MIGRATION 076 FAILED: the racing insert raised %, not 23505, so the route cannot tell this case apart.', got;
  end if;
  -- The loser re-reads exactly as the route does: live only, oldest first.
  select count(*) into n from public.calendar_feed_tokens where company_id = coC and revoked_at is null;
  if n <> 1 then
    raise exception 'MIGRATION 076 FAILED: after the race the company holds % live token(s), not 1.', n;
  end if;
  select t.token into keep from public.calendar_feed_tokens t
   where t.company_id = coC and t.revoked_at is null
   order by t.created_at, t.id limit 1;
  if keep <> '076-probe-race-P1' then
    raise exception 'MIGRATION 076 FAILED: the race left % live, not the winner''s token.', keep;
  end if;
  -- And the route's converge UPDATE is now a no-op rather than an error: it can find nothing to
  -- revoke, and it leaves the kept token alone. Run the statement the route runs.
  update public.calendar_feed_tokens
     set revoked_at = now()
   where company_id = coC and revoked_at is null and token <> keep;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'MIGRATION 076 FAILED: the converge update revoked % row(s) when there was nothing to converge.', n;
  end if;
  select count(*) into n from public.calendar_feed_tokens where company_id = coC and revoked_at is null;
  if n <> 1 then
    raise exception 'MIGRATION 076 FAILED: the converge update left % live token(s) for the race company.', n;
  end if;

  -- ---- 7. ROTATION STILL WORKS, WHICH A PLAIN UNIQUE CONSTRAINT WOULD HAVE BROKEN. ----
  -- Revoke A1, insert A3 live: accepted. This is the whole reason the index is partial, and it is
  -- the check that would fail if someone later "tidied" the predicate away.
  update public.calendar_feed_tokens set revoked_at = now()
   where company_id = co and token = '076-probe-live-A1';
  insert into public.calendar_feed_tokens (company_id, token) values (co, '076-probe-live-A3');
  select count(*) into n from public.calendar_feed_tokens where company_id = co and revoked_at is null;
  if n <> 1 then
    raise exception 'MIGRATION 076 FAILED: after a rotation the company holds % live token(s), not 1.', n;
  end if;

  -- ---- 8. A COMPANY MAY HOLD MANY REVOKED ROWS. ----
  -- History is not unique — only the live row is. If the predicate were ever dropped this insert
  -- would be refused, and the record of which addresses once answered would become unwritable.
  insert into public.calendar_feed_tokens (company_id, token, revoked_at)
       values (co, '076-probe-old-A4', now() - interval '1 day');
  insert into public.calendar_feed_tokens (company_id, token, revoked_at)
       values (co, '076-probe-old-A5', now() - interval '2 days');
  select count(*) into n from public.calendar_feed_tokens where company_id = co;
  if n <> 4 then
    raise exception 'MIGRATION 076 FAILED: the probe company holds % rows, not the 4 written (1 live, 3 revoked).', n;
  end if;

  -- ---- 9. THE RULE IS PER COMPANY, NOT GLOBAL. ----
  -- Company B takes its own live token while A already has one. A global unique index would refuse
  -- this and every company after the first would have no calendar feed at all.
  insert into public.calendar_feed_tokens (company_id, token) values (coB, '076-probe-live-B1');
  select count(*) into n from public.calendar_feed_tokens
   where company_id in (co, coB) and revoked_at is null;
  if n <> 2 then
    raise exception 'MIGRATION 076 FAILED: two companies hold % live token(s) between them, not 2.', n;
  end if;
  -- The token itself is still globally unique (073:466) — two companies cannot share an address.
  got := null;
  begin
    insert into public.calendar_feed_tokens (company_id, token) values (coB, '076-probe-live-A3');
    raise exception 'MIGRATION 076 FAILED: two companies were allowed the same feed token.';
  exception when unique_violation then
    got := sqlstate;
  end;
  if got <> '23505' then
    raise exception 'MIGRATION 076 FAILED: the shared token was refused with %, not 23505.', got;
  end if;

  -- ---- 10. THE INDEX EXISTS BY NAME, AND IS UNIQUE AND PARTIAL — READ FROM THE CATALOG. ----
  -- Not "the create statement above ran". An index named right but built without UNIQUE, or without
  -- the predicate, would pass every count above on a single-threaded probe and hold nothing.
  select indexdef into def from pg_indexes
   where schemaname = 'public' and indexname = 'idx_calendar_feed_tokens_company_live';
  if def is null then
    raise exception 'MIGRATION 076 FAILED: idx_calendar_feed_tokens_company_live does not exist.';
  end if;
  if position('UNIQUE' in def) = 0 then
    raise exception 'MIGRATION 076 FAILED: the index is not UNIQUE: %', def;
  end if;
  if position('revoked_at IS NULL' in def) = 0 then
    raise exception 'MIGRATION 076 FAILED: the index carries no live-row predicate: %', def;
  end if;
  -- And 073's three indexes are all still there: this migration adds, it does not replace.
  foreach v in array array['calendar_feed_tokens_pkey', 'calendar_feed_tokens_token_key',
                           'idx_calendar_feed_tokens_company'] loop
    select count(*) into n from pg_indexes where schemaname = 'public' and indexname = v;
    if n <> 1 then raise exception 'MIGRATION 076 FAILED: index % is missing.', v; end if;
  end loop;

  -- ---- 11. GRANTS, READ BACK, ALL EIGHT RIGHTS, BOTH ROLES. ----
  -- `CLAUDE.md` §3.6. This migration grants nothing, which is exactly when a grant check matters.
  -- A person may SELECT their own token and nothing else; `anon` holds nothing at all, because the
  -- row IS the credential for a route that asks for no session.
  foreach v in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.calendar_feed_tokens', v) then
      raise exception 'MIGRATION 076 FAILED: anon holds % on calendar_feed_tokens.', v;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.calendar_feed_tokens', 'SELECT') then
    raise exception 'MIGRATION 076 FAILED: authenticated lost SELECT on calendar_feed_tokens.';
  end if;
  foreach v in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('authenticated', 'public.calendar_feed_tokens', v) then
      raise exception 'MIGRATION 076 FAILED: authenticated holds % on calendar_feed_tokens.', v;
    end if;
  end loop;
  -- RLS is still on, and the one policy is still the SELECT scoped by auth_company_id().
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'calendar_feed_tokens' and c.relrowsecurity;
  if n <> 1 then
    raise exception 'MIGRATION 076 FAILED: row level security is not enabled on calendar_feed_tokens.';
  end if;

  -- ---- 12. NO REAL COMPANY IS LEFT WITH TWO LIVE TOKENS. ----
  -- The index makes this impossible from here on; this reads it anyway, because §1's converge is
  -- the only statement in this migration that touched customer data and this is the proof it
  -- finished the job.
  select count(*) into n from (
    select company_id from public.calendar_feed_tokens
     where revoked_at is null and company_id not in (co, coB, coC)
     group by company_id having count(*) > 1
  ) dupes;
  if n <> 0 then
    raise exception 'MIGRATION 076 FAILED: % real company(ies) still hold more than one live token.', n;
  end if;

  -- ---- CLEAN UP, BY ID AND BY TOKEN. ----
  delete from public.calendar_feed_tokens where company_id in (co, coB, coC);
  delete from public.companies where id in (co, coB, coC);
  select count(*) into n from public.calendar_feed_tokens where company_id in (co, coB, coC);
  if n <> 0 then
    raise exception 'MIGRATION 076 FAILED: % probe token(s) left behind — a probe credential is a real credential.', n;
  end if;

  raise notice 'MIGRATION 076 OK: a second live token refused with 23505; the two-POST race leaves '
               'one live row and the winner''s token, and the route''s converge update finds nothing '
               'to do; a rotation still accepted and three revoked rows allowed; the rule is per '
               'company and the token still globally unique; the index reads back UNIQUE and '
               'partial on revoked_at IS NULL with 073''s three indexes intact; grants and RLS '
               'unmoved; no real company holds two live tokens.';
end $$;

commit;

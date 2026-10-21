-- =================================================================================================
-- 082 — THE COMPANY, ITS SITES, AND WHO CAN SIGN IN.
-- =================================================================================================
--
-- WHY.
--
-- `docs/ACCOUNT-MACHINERY.md` (commit 5f3b940) read My Account from the code and found a page that
-- collects facts nothing reads and offers no way to do the three things a company actually needs:
-- add a second site, let a colleague sign in, and stop a monthly email. `docs/ACCOUNT-PLAN.md`
-- answers that in fourteen decisions and `docs/account-boards.html` draws it. This migration is the
-- ground under boards 1, 1b and 2 — step 5 of the plan, and the only step that touches the schema
-- before the page is rebuilt.
--
-- Six things, in the order a reader needs them:
--
--   1. The facts a company keeps about itself — what it does, its website, its NAICS code, which
--      requirements library it is served, and when its trial began.
--   2. The company NAME closed to a person, at the grant level, from both doors (decision 1).
--   3. SITES a person may add, edit and remove — except the main one, and except a site that
--      something is attached to (decision 4).
--   4. INVITATIONS, so a second person can sign in without us creating them a company (decision 6).
--   5. The monthly calendar email as a PER-PERSON switch (decision 6).
--   6. A verify block that tries to break all five.
--
-- *** WHAT THIS MIGRATION DELIBERATELY DOES NOT DO. ***
--
--   · It does not fill `state` or `county` from a street address. Nothing in this repository
--     geocodes anything — the comments at `lib/determinationGate.ts:424` and `:439` say state and
--     county "come from GEOCODING" and `DECISIONS.md` §25, and no such code exists: `app/signup/
--     page.tsx:174` sends `county: ''` for every account ever created, and `create_primary_site`
--     (migration 010:81) turns that into NULL. The address columns are already on `entities`
--     (migration 009:57-60). Filling them is a later step, once the owner has picked a source.
--   · It does not touch the sidebar or `components/AppLayout.tsx` (decision 14).
--   · It does not add a route. `/api/invitations`, `/join` and the rebuilt Company tab are steps 6
--     and 7. A grant with no reader is a claim nothing checks (§9a) — these grants have readers
--     coming in the next two steps, and the verify block below is what checks them meanwhile.
--
-- *** AND THE ONE THING THE BRIEF ASKED FOR THAT IS NOT HERE, ON PURPOSE. ***
--
-- Step 5 asked for `website text null`. **`companies.website_url` already exists** — it is in the
-- live schema (`docs/SCHEMA.md`, the `companies` column list) and `app/api/signup/route.ts:50`
-- writes it. Adding `website` beside it would give one fact two columns and two answers, which is
-- the shape of the mistake `CLAUDE.md` §3.6's rename rule exists to stop. So this migration REUSES
-- `website_url` and adds no second column. Renaming it to `website` is a one-line sweep
-- (`app/api/signup/route.ts:50` is its only reader) and is the owner's call at the stop.
-- =================================================================================================


-- =================================================================================================
-- 1. THE FACTS A COMPANY KEEPS ABOUT ITSELF.
--
-- `what_you_do` is TYPED, never picked (decision 3). The board shows suggestions underneath it from
-- the NAICS titles, and "Keep what I typed" is always the last one — so the text a person wrote is
-- what is stored, and `naics_code` is filled only when they took a suggestion. Two columns because
-- they answer two different questions: one is what this business calls itself, the other is what a
-- standard list calls it, and conflating them loses the first.
--
-- `library` is the one column on this table a person never sees. `industry` is the vertical a
-- customer chose at signup and reads back on the page; `library` is which set of requirement rows
-- we actually serve them, and today that is `chemical` for everybody. They are separate because the
-- day we sell a second vertical, a cannabis extractor and a chemical blender share most of a
-- library and must not share an industry label. No CHECK constraint on it: verticals are data, not
-- code (`CLAUDE.md` §7), and a CHECK would mean a migration per vertical.
--
-- `trial_started_at` is when the clock started, and it is NOT `created_at`. They are the same value
-- for every company that exists today, which is why the backfill is a coalesce — but part C's
-- billing has to be able to extend a trial without lying about when the account was made.
-- =================================================================================================

alter table public.companies add column if not exists what_you_do      text;
alter table public.companies add column if not exists naics_code       text;
alter table public.companies add column if not exists library          text not null default 'chemical';
alter table public.companies add column if not exists trial_started_at timestamptz;

comment on column public.companies.what_you_do is
  'What this business does, IN ITS OWN WORDS, typed by a person on the Company tab (ACCOUNT-PLAN '
  'decision 3). Suggestions from the NAICS titles are offered underneath and anything typed is '
  'kept, so this is never a code and never a dropdown value. Feeds the company context a prompt '
  'is anchored on; it is not a match key.';

comment on column public.companies.naics_code is
  'The NAICS code, filled ONLY when the person took one of the suggestions offered under '
  '`what_you_do` (decision 3). NULL means they typed something of their own, which is the normal '
  'case and is not a gap to be filled in later by guessing.';

comment on column public.companies.library is
  'Which requirement library this company is served: `chemical` for every customer today. '
  '*** NEVER SHOWN TO A PERSON AND NEVER EDITABLE BY ONE. *** It is not in the column grant '
  'below. `industry` is what the customer calls their business and is theirs to change; this is '
  'what we serve them and is ours. Decision 3. Verticals are data, so no CHECK (CLAUDE.md §7).';

comment on column public.companies.trial_started_at is
  'When this company''s trial clock started. Set at signup from part B of ACCOUNT-PLAN onward; '
  'backfilled to `created_at` for every company that existed before this migration. Separate from '
  '`created_at` because part C must be able to extend a trial without restating when the account '
  'was made. Not editable by a person.';

-- Every company that exists today started its trial when it was created, because nothing else was
-- ever true. `coalesce` because `companies.created_at` is NULLABLE on this schema.
update public.companies
   set trial_started_at = coalesce(created_at, now())
 where trial_started_at is null;


-- =================================================================================================
-- 2. THE COMPANY NAME, CLOSED TO A PERSON — BOTH DOORS AT ONCE.
--
-- Decision 1: the name is tied to the company id and everything hangs on it — every report heading,
-- every email subject, the export filename (`app/api/account/export/route.ts:165` slugifies it),
-- and the typed confirmation that deletes the account (`app/api/account/route.ts:351` compares
-- against it). A wrong name is fixed by us.
--
-- *** TWO DOORS, AND A ROUTE GUARD WOULD ONLY CLOSE ONE. *** Both of these write `companies.name`
-- as the signed-in person, through their own RLS client:
--
--     app/api/account/route.ts:100-110         PUT  — name, industry, state, county, city,
--                                                     employee_count
--     app/api/company-information/route.ts:175 POST — action 'company': name, industry, city, state
--
-- Closing it in one route leaves the other open, and closing it in both leaves the next route open.
-- RLS is the security boundary and a route guard is a UX affordance (`CLAUDE.md` §3.6), so the
-- column is closed in the catalog, once, for every caller that is not the service role.
--
-- A GRANT CAN SAY THIS, so there is no trigger here. 078 and 079 reach for a refusal trigger only
-- where a grant cannot express the rule ("once, from nothing", "this move but not that one"). "This
-- column, never" is exactly what a column-level grant is for, and Postgres refuses it before any
-- trigger runs.
--
-- WHAT STAYS WRITABLE, AND WHY EACH ONE:
--
--   industry                 `app/api/company-information/route.ts:157` writes it today and step 6
--                            does not replace that page. It is part of the resolution match key, so
--                            whether a person should be able to change their own vertical is a
--                            real question — it is the owner's, and it is asked at the stop, not
--                            answered here by quietly removing it.
--   state, county, city      Same door, same line. Decision 4 moves what the PAGE shows to the main
--                            site's address, but these columns are still the company's own and
--                            migration 009:68 calls `companies.state` "the authoritative source for
--                            the company itself". Retiring them is a separate, later change with
--                            its own sweep.
--   what_you_do, naics_code  Decision 3. This is the point of them.
--   website_url              Board 1's website line has a Change button.
--   obligations_computed_at  *** NOT A PERSON'S FIELD, AND IT HAS TO BE IN THIS LIST ANYWAY. ***
--                            `lib/obligationWriter.ts:164` stamps it, and it is called with the
--                            CALLER'S OWN client from `app/api/obligations/route.ts:45` and
--                            `app/api/switches/answer/route.ts:125`. Leave it out and every
--                            signed-in person's first resolution fails with "permission denied for
--                            column". The honest fix is to move that one statement to the service
--                            role as a named statement (§3.6); until then the grant stays and this
--                            comment is the record of why.
--
-- WHAT IS NOW CLOSED: `name` (decision 1) · `employee_count` (decision 5 retires it; nothing reads
-- it but `app/account/page.tsx:86`) · `library` and `trial_started_at` (ours, §1 above) ·
-- `chemicals`, `extra_profile`, `scan_result`, `pre_completed_items`, `created_at`, `id` — no route
-- has ever written any of them as a person. `scan_result` will need a grant when part B's website
-- read lands; it does not get one now, because a grant with no reader is a claim nothing checks.
--
-- REVOKE THEN GRANT, as §3.6 requires: the table-wide UPDATE goes first, because a grant list
-- describes what you added and not what the role holds.
-- =================================================================================================

revoke update on table public.companies from authenticated;
grant update (
  industry, state, county, city,
  what_you_do, naics_code, website_url,
  obligations_computed_at
) on table public.companies to authenticated;

-- And `anon` holds nothing here, which §6c reads back rather than assumes.
revoke all on table public.companies from anon;


-- =================================================================================================
-- 3. SITES — WHAT A PERSON MAY DO TO THEM.
--
-- *** READ THIS FIRST: THE GRANTS WERE ALREADY OPEN AND NOTHING USED THEM. ***
--
-- `entities` today grants `authenticated` table-wide DELETE, INSERT, SELECT and UPDATE, and carries
-- all four company-scoped policies (`docs/SCHEMA.md`, the `entities` section). And yet
-- `grep -rn "from('entities')" app lib` finds not one insert, update or delete — every site that
-- exists was made by `create_primary_site` (migration 010:69), the AFTER INSERT trigger on
-- `companies`. The same grep finds eleven `entities` inserts under `supabase/migrations/`, so it
-- can see a presence and its silence on `app/` is a real absence (§9a).
--
-- So this section does not open sites up. It NARROWS what was already open, to exactly the moves
-- board 1b offers, and leaves the rest where a grant can refuse it.
--
--   a person MAY   add a site for their own company — a name and an address, nothing else
--                  edit its name and its address
--                  remove it
--   a person MAY NOT  decide which site is the main one, at insert or at update
--                     remove the main site
--                     remove a site that something is attached to (see the refusal below)
--
-- "WHICH SITE IS MAIN" IS CLOSED BY A GRANT, NOT A TRIGGER. `is_primary` is in neither the INSERT
-- nor the UPDATE list, so a new site defaults to `false` (migration 007:343's column default) and an
-- existing one cannot be promoted. The partial unique index `idx_entities_one_primary` is the
-- second lock, and the INSERT policy's WITH CHECK is the third — three locks because the main site
-- is what `lib/determinationGate.ts:437` reads to know where the business IS, and a company with
-- the wrong main site gets the wrong jurisdiction silently.
--
-- `entity_type` IS in the insert list, because the column is NOT NULL with no default, and the
-- INSERT policy pins it to 'site' — a person adds plants, not chemicals or equipment.
--
-- `updated_at` is NOT in the update list and does not need to be: `set_updated_at`
-- (migration 006:379) assigns `new.updated_at` inside a BEFORE trigger, and column privileges are
-- checked against the SET list of the statement, not against what a trigger does to NEW.
-- =================================================================================================

revoke insert on table public.entities from authenticated;
grant insert (
  company_id, entity_type, name,
  address, postal_code, state, county, city, fire_authority
) on table public.entities to authenticated;

revoke update on table public.entities from authenticated;
grant update (
  name,
  address, postal_code, state, county, city, fire_authority
) on table public.entities to authenticated;

revoke all on table public.entities from anon;

-- The INSERT policy says the three things the grant cannot: the company is theirs, it is a site,
-- and it is not the main one. Explicit WITH CHECK, fully-qualified columns (§3.6).
drop policy if exists entities_insert on public.entities;
create policy entities_insert on public.entities
  for insert to authenticated
  with check (
    public.entities.company_id = public.auth_company_id()
    and public.entities.entity_type = 'site'
    and public.entities.is_primary = false
  );


-- -------------------------------------------------------------------------------------------------
-- 3b. AND WHAT REMOVING A SITE WOULD DESTROY — THE RULE, AS A FUNCTION.
--
-- *** THIS IS THE DANGEROUS ONE, AND IT IS WHY THE DELETE IS NOT SIMPLY LEFT OPEN. ***
--
-- Fourteen foreign keys point at `entities` (`docs/SCHEMA.md`, the `entities` "Pointed at by"
-- block). SEVEN of them are ON DELETE CASCADE, and one of those seven is `obligations.entity_id`:
--
--     audit_runs.entity_id            CASCADE          calendar_events.entity_id      SET NULL
--     company_chemicals.entity_id     CASCADE          document_reviews.entity_id     SET NULL
--     company_facts.entity_id         CASCADE          document_scans.entity_id       SET NULL
--     company_switches.entity_id      CASCADE          documents.entity_id            SET NULL
--     obligation_evidence.entity_id   CASCADE          entities.parent_entity_id      SET NULL
--     obligations.entity_id           CASCADE          fact_proposals.entity_id       SET NULL
--     switch_determinations.entity_id CASCADE          handbooks.entity_id            SET NULL
--
-- `obligations` has NO DELETE POLICY, on purpose, and migration 007:711 raises if one ever appears,
-- because `CLAUDE.md` §3.2 says obligations are marked and never deleted — "we were subject to this
-- from March 2024 to January 2026" is the history the product exists to keep. **A referential
-- cascade does not consult an RLS policy.** So without this guard, a person pressing "Remove this
-- site" in board 1b's drawer destroys obligation rows that no policy in the database will let them
-- delete directly, along with their evidence, their switch determinations (append-only, §3.6) and
-- their audit history. One click, no warning, nothing to restore from.
--
-- The seven SET NULL relations are the opposite case and are deliberately allowed to detach:
-- migration 009:106 chose SET NULL for exactly this reason — "deleting a SITE must not delete the
-- permits that were filed for it ... the document survives and becomes company-wide; the fact of
-- which site it belonged to is what is lost, and that is the lesser loss."
--
-- THE RULE, THEREFORE: a site may be removed while removing it would destroy nothing. The seven
-- cascade relations are counted; if any has a row, the removal is refused with a sentence naming
-- what is attached. Board 1b already counts those things in the drawer header ("4 dates on the
-- calendar · 1 audit · 3 site questions answered"), so the person is told before they press it and
-- the refusal is the second line of defence rather than the first.
--
-- *** SECURITY DEFINER, AND THAT IS THE WHOLE POINT. *** A count run as the person would be
-- filtered by each table's own RLS. `switch_determinations` is append-only to a person and
-- `obligations` has no DELETE policy — if a person cannot SELECT a row, the count comes back 0, the
-- refusal does not fire, and the cascade destroys it anyway. A check that cannot see a presence
-- looks exactly like a check that found nothing (§9a), and here that mistake is silent data loss.
-- So the counts are taken with definer rights, `search_path` is pinned, and EXECUTE is taken off
-- PUBLIC — the same discipline as `auth_company_id()`.
-- -------------------------------------------------------------------------------------------------

create or replace function public.site_removal_refusal(p_entity_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_main  boolean;
  n_obl    int;
  n_ev     int;
  n_det    int;
  n_sw     int;
  n_fact   int;
  n_chem   int;
  n_audit  int;
  parts    text[] := '{}';
begin
  select e.is_primary into is_main from public.entities e where e.id = p_entity_id;
  -- The row is already gone, or never was. There is nothing to refuse, and inventing a refusal
  -- here would make a re-run of a successful delete look like a failure.
  if not found then return null; end if;

  if is_main then
    return 'This is your main site, so it cannot be removed. Its address is your company''s '
        || 'address. Edit it instead, or write to us if the company has moved.';
  end if;

  select count(*) into n_obl   from public.obligations            where entity_id = p_entity_id;
  select count(*) into n_ev    from public.obligation_evidence    where entity_id = p_entity_id;
  select count(*) into n_det   from public.switch_determinations  where entity_id = p_entity_id;
  select count(*) into n_sw    from public.company_switches       where entity_id = p_entity_id;
  select count(*) into n_fact  from public.company_facts          where entity_id = p_entity_id;
  select count(*) into n_chem  from public.company_chemicals      where entity_id = p_entity_id;
  select count(*) into n_audit from public.audit_runs             where entity_id = p_entity_id;

  -- Said in the customer's words, not the schema's: a person reading this has never heard of
  -- `switch_determinations`. §5.1 — plain, honest about whose problem it is, and it says what they
  -- can do next.
  if n_obl   > 0 then parts := parts || format('%s requirement%s',        n_obl,   case when n_obl   = 1 then '' else 's' end); end if;
  if n_ev    > 0 then parts := parts || format('%s piece%s of evidence',  n_ev,    case when n_ev    = 1 then '' else 's' end); end if;
  if n_audit > 0 then parts := parts || format('%s audit%s',              n_audit, case when n_audit = 1 then '' else 's' end); end if;
  if n_sw    > 0 then parts := parts || format('%s answered question%s',  n_sw,    case when n_sw    = 1 then '' else 's' end); end if;
  if n_det   > 0 then parts := parts || format('%s recorded finding%s',   n_det,   case when n_det   = 1 then '' else 's' end); end if;
  if n_fact  > 0 then parts := parts || format('%s confirmed fact%s',     n_fact,  case when n_fact  = 1 then '' else 's' end); end if;
  if n_chem  > 0 then parts := parts || format('%s chemical%s',           n_chem,  case when n_chem  = 1 then '' else 's' end); end if;

  if cardinality(parts) > 0 then
    return 'This site still has ' || array_to_string(parts, ', ')
        || ' attached to it, and removing the site would delete them for good. Move or remove '
        || 'those first, or write to us and we will do it with you.';
  end if;

  return null;
end $$;

comment on function public.site_removal_refusal is
  'Whether a site may be removed: NULL when it may, else the sentence to refuse with. Refuses the '
  'MAIN site always, and any site with a row in one of the seven ON DELETE CASCADE relations that '
  'point at entities — obligations above all, which CLAUDE.md §3.2 says are never deleted and '
  'which a referential cascade would destroy without consulting an RLS policy. SECURITY DEFINER '
  'because a count filtered by the caller''s own RLS would come back 0 for exactly the rows a '
  'person cannot see, and a refusal that cannot see a presence is not a refusal (§9a). A function '
  'rather than a block inside the trigger so migration 082 can prove every case without a login. '
  'My Account step 5.';

revoke all on function public.site_removal_refusal(uuid) from public;
grant execute on function public.site_removal_refusal(uuid) to authenticated, service_role;

-- -------------------------------------------------------------------------------------------------
-- 3c. THE GATE. The rule applies to `authenticated` and to nothing else.
--
-- `current_user` and not `auth.role()`, for 078:109's reason: the JWT's claim is what the caller
-- sent, and the role the database is running as is what the database can be sure of. PostgREST does
-- `set local role authenticated` for a person's request and `service_role` for the server's.
-- SECURITY INVOKER (the default) so `current_user` is the caller's.
--
-- *** AND THIS PASS-THROUGH IS LOAD-BEARING, NOT A CONVENIENCE. *** `/api/account` DELETE removes
-- the company with the service role (`app/api/account/route.ts:427-429`), and that cascades to
-- `entities`. If this guard applied to every caller, a company holding one obligation could never
-- be deleted — the customer's own "delete my account" would fail at the last step, after its files
-- were already gone. §6j deletes a company with a site and an attached fact to prove it still works.
-- -------------------------------------------------------------------------------------------------

create or replace function public.entities_guard_person_delete()
returns trigger
language plpgsql
as $$
declare
  refusal text;
begin
  if current_user <> 'authenticated' then return old; end if;
  refusal := public.site_removal_refusal(old.id);
  if refusal is not null then
    raise exception using errcode = 'check_violation', message = refusal;
  end if;
  return old;
end $$;

drop trigger if exists entities_person_delete on public.entities;
create trigger entities_person_delete
  before delete on public.entities
  for each row execute function public.entities_guard_person_delete();


-- =================================================================================================
-- 4. INVITATIONS — HOW A SECOND PERSON GETS IN.
--
-- `docs/ACCOUNT-MACHINERY.md` §E1: there is no way for a second person to join a company today.
-- `auth.admin.createUser` appears once, in `/api/signup`, which creates a NEW company every time,
-- so two colleagues signing up are two companies that cannot see each other's work. `CLAUDE.md`
-- §3.6 has said for a month that what is missing is an invite route, not a schema change — this is
-- the one table that route needs.
--
-- *** THE TOKEN IS A CREDENTIAL, SO A PERSON MAY NEITHER WRITE IT NOR READ IT. ***
--
-- `/join?t=<token>` has no session, exactly like `/api/calendar/feed?t=` (migration 073:§8), so the
-- token IS the credential. Two column grants say it, and neither is a policy, because RLS is
-- row-level and this is a column:
--
--     grant select (every column EXCEPT token)   — a person sees who is invited, never the link
--     grant insert (every column EXCEPT token)   — the DATABASE fills it, so there is no moment at
--                                                  which the inviter knows it
--
-- This is where it diverges from 076's precedent deliberately. `calendar_feed_tokens.token` has no
-- default and is generated in Node (`randomBytes(32).toString('base64url')`,
-- `app/api/calendar/feed-token/route.ts:44`). That works there because the route issuing the token
-- is also the one allowed to know it. Here the inviter must NOT know it, so the default has to be
-- in the database. Two `gen_random_uuid()`s concatenated: 64 hex characters, ~244 bits from the
-- same CSPRNG, and no extension — `pgcrypto`'s `gen_random_bytes` is used nowhere in this schema
-- and is not assumed to be installed.
--
-- HOW /join CONSUMES IT, IN STEP 7, IN TWO SENTENCES. `GET /join?t=<token>` reads the row with the
-- SERVICE ROLE — the one credential that can see the token, and a named statement in §3.6's sense —
-- refusing anything cancelled, accepted, or past `expires_at`, and shows the email it was sent to
-- so the person knows which account they are joining. On submit it creates the login with
-- `auth.admin.createUser` at the password they chose, inserts the `profiles` row with the
-- invitation's `company_id`, stamps `accepted_at`, and signs them in — in that order, so a failure
-- leaves an unaccepted invitation that still works rather than a login with no company, which is
-- the dead account `/api/signup` can still produce today (ACCOUNT-MACHINERY §B3).
--
-- NO DELETE, for anyone but the service role: an invitation is CANCELLED, not deleted, so "who
-- invited whom and what happened" survives. Same rule as obligations, one step smaller.
-- =================================================================================================

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  email        text not null,
  -- 64 hex characters from gen_random_uuid()'s CSPRNG. NOT in the insert grant: a person cannot
  -- choose it, and NOT in the select grant: a person cannot read it back.
  token        text not null unique
                 default replace(gen_random_uuid()::text, '-', '')
                      || replace(gen_random_uuid()::text, '-', ''),
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  cancelled_at timestamptz
);

comment on table public.invitations is
  'An invitation for one email address to join one company. The token is the credential for '
  '/join, which has no session: a person may neither write it nor read it (column grants below), '
  'and only the service role sees it, to put it in the email. Cancelled, never deleted. '
  'ACCOUNT-PLAN decision 6, My Account step 5.';

comment on column public.invitations.token is
  'The credential in the /join link. 64 hex characters, ~244 bits, filled by the DATABASE so that '
  'the person doing the inviting never knows it. Excluded from both the select and the insert '
  'grant for `authenticated`; readable only by the service role.';

comment on column public.invitations.expires_at is
  'Seven days from when it was sent (board 2: "the link is good for 7 days"). /join refuses a row '
  'past this, and "Send the link again" in step 7 inserts a NEW invitation rather than extending '
  'this one, so what was sent and when stays true.';

comment on column public.invitations.cancelled_at is
  'When someone at the company withdrew the invitation. The only column a person may UPDATE, and '
  'only from NULL — invitation_person_move_refusal refuses un-cancelling and refuses cancelling an '
  'invitation that was already accepted.';

create index if not exists idx_invitations_company on public.invitations (company_id);

-- One LIVE invitation per email per company — the same "live, not total" shape as migration 076's
-- feed-token index, and for the same reason: re-inviting after a cancellation is a normal thing to
-- do, so the index must not count the dead rows.
create unique index if not exists idx_invitations_company_email_live
  on public.invitations (company_id, lower(email))
  where accepted_at is null and cancelled_at is null;

comment on index public.idx_invitations_company_email_live is
  'ONE LIVE INVITATION PER EMAIL PER COMPANY. Lowercased, because a person retyping an address '
  'with different capitals means the same person. Partial, so cancelling and re-inviting works.';

alter table public.invitations enable row level security;

-- REVOKE THEN GRANT, BOTH ROLES. Since migration 068 `postgres`'s default privileges on public
-- grant `anon` and `authenticated` nothing, but `supabase_admin`'s still grant both everything for
-- objects IT creates, `postgres` cannot change those, and a redundant REVOKE costs nothing
-- (§3.6). §6i reads all eight rights back for both roles rather than trusting these lines.
revoke all on table public.invitations from anon;
revoke all on table public.invitations from authenticated;

grant select (id, company_id, email, invited_by, created_at, expires_at, accepted_at, cancelled_at)
  on table public.invitations to authenticated;
grant insert (company_id, email, invited_by, expires_at)
  on table public.invitations to authenticated;
grant update (cancelled_at)
  on table public.invitations to authenticated;

drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations
  for select to authenticated
  using (public.invitations.company_id = public.auth_company_id());

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (
    public.invitations.company_id = public.auth_company_id()
    and public.invitations.invited_by = auth.uid()
  );

drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations
  for update to authenticated
  using (public.invitations.company_id = public.auth_company_id())
  with check (public.invitations.company_id = public.auth_company_id());

-- No DELETE policy, and no DELETE grant. Deliberate, and §6i proves both.

-- -------------------------------------------------------------------------------------------------
-- 4b. THE TWO RULES A GRANT CANNOT SAY — 078/080's shape, for 080's reason.
--
-- `grant update (cancelled_at)` says which column. It cannot say "from NULL only". Without this, a
-- person can clear `cancelled_at` and bring a withdrawn invitation back to life — the link was
-- emailed and still works — or cancel one that has already been accepted, which would read as "that
-- person was never invited" beside a login that exists.
-- -------------------------------------------------------------------------------------------------

create or replace function public.invitation_person_move_refusal(
  old_cancelled timestamptz, new_cancelled timestamptz,
  accepted      timestamptz
) returns text
language sql
immutable
as $$
  select case
    when old_cancelled is not null and new_cancelled is null
      then 'That invitation was withdrawn. Invite the person again if you need to.'
    when accepted is not null and new_cancelled is distinct from old_cancelled
      then 'That person has already joined, so there is no invitation left to withdraw. '
        || 'Remove them from the People list instead.'
    else null
  end;
$$;

comment on function public.invitation_person_move_refusal is
  'The moves a PERSON may make on an invitation, as a pure function of the old and new '
  'cancellation stamp and the acceptance stamp: NULL when the move is one the product offers, else '
  'the sentence to refuse with. The column grant says only `cancelled_at`; this says "from NULL, '
  'and not once it has been accepted". A function rather than a block inside the trigger so '
  'migration 082 can prove every case without a login (080''s shape). My Account step 5.';

create or replace function public.invitations_guard_person_update()
returns trigger
language plpgsql
as $$
declare
  refusal text;
begin
  if current_user <> 'authenticated' then return new; end if;
  refusal := public.invitation_person_move_refusal(old.cancelled_at, new.cancelled_at, old.accepted_at);
  if refusal is not null then
    raise exception using errcode = 'check_violation', message = refusal;
  end if;
  return new;
end $$;

drop trigger if exists invitations_person_update on public.invitations;
create trigger invitations_person_update
  before update on public.invitations
  for each row execute function public.invitations_guard_person_update();

drop trigger if exists set_updated_at on public.invitations;
-- No `updated_at` column on this table and no trigger for one: an invitation is created, cancelled
-- or accepted, and each of those has its own stamp. A generic "last touched" would say less.


-- =================================================================================================
-- 5. THE MONTHLY CALENDAR EMAIL, PER PERSON.
--
-- `app/api/jobs/calendar-month/route.ts:104` sends to EVERY `profiles` row with a `company_id`, and
-- `docs/ACCOUNT-MACHINERY.md` §E1 recorded the consequence: there is no opt-out of any kind. On a
-- company with four logins that is four unstoppable emails a month, and the first one a customer
-- cannot stop is the last one they trust.
--
-- Default TRUE, because the email is the product working and a silent default of off would mean
-- nobody ever sees it. NOT NULL, so "did not say" cannot become a third state the job has to guess
-- at. Board 2 draws it as "Monthly calendar email: on" on each person's row.
--
-- The switch is the PERSON'S OWN: `profiles`' UPDATE policy is `auth.uid() = id` (migration
-- 080:398), so a colleague cannot turn off somebody else's email, and the column grant below is
-- what lets them turn off their own. The job reads it in step 7 — `select id, company_id,
-- full_name` at `:104` becomes `select id, company_id, full_name, calendar_email`, filtered.
-- =================================================================================================

alter table public.profiles
  add column if not exists calendar_email boolean not null default true;

comment on column public.profiles.calendar_email is
  'Whether this person gets the monthly calendar email (ACCOUNT-PLAN decision 6, board 2). TRUE by '
  'default because the email is the product working; NOT NULL so the job never has to guess what '
  '"not said" means. Read by app/api/jobs/calendar-month from step 7 onward. A person may set '
  'their own and nobody else''s — profiles'' UPDATE policy is auth.uid() = id.';

-- 080:393 granted (full_name, welcomed_at). Restated in full rather than added to, because there is
-- no "grant one more column" — a second GRANT would be a second list to keep in step with this one.
revoke update on table public.profiles from authenticated;
grant update (full_name, welcomed_at, calendar_email) on table public.profiles to authenticated;


-- =================================================================================================
-- 6. VERIFY — AND EVERY CHECK HERE TRIES TO BREAK SOMETHING.
--
-- *** WHAT THIS BLOCK CAN AND CANNOT PROVE, SAID OUT LOUD — 078:160's split, for 078's reason. ***
--
-- It proves the RULES exhaustively, because each is a function of a few values and needs no login.
-- It proves the GRANTS from the catalog, column by column, because `CLAUDE.md` §3.6's rule is that
-- a grant list describes what you added and only a read says what a role holds. It proves the
-- STRUCTURE — triggers where they say they are, policies that exist, defaults that fire.
--
-- It CANNOT prove "a person is refused", because becoming `authenticated` here would also have to
-- satisfy `auth_company_id()`, which reads a `profiles` row whose id is a real login in
-- `auth.users` — a migration has no session and must not invent one. No migration in this chain
-- has ever done so (`grep -rn "set local role" supabase/migrations/` returns one COMMENT, in 078).
-- **The person's half is proved by `check:live` as a real signed-in person**, in step 6 or 7.
--
-- *** AND FOR THE SAME REASON THERE IS NO THROWAWAY PERSON HERE. *** Step 5's brief asked this
-- block to insert "a throwaway company, person, site and invitation". A `profiles` row needs an
-- `auth.users` row (`profiles.id → auth.users`, ON DELETE CASCADE), which is a login, which is the
-- thing a migration must not invent. The company, the site and the invitation ARE inserted and
-- deleted below; the person's part is the catalog read at §6k and `check:live` after it.
-- =================================================================================================

do $$
declare
  co      uuid;
  site2   uuid;
  inv     uuid;
  tok     text;
  n       int;
  ok      text;
  refusal text;
begin
  -- ---- 6a. THE NEW COLUMNS ARE THERE, WITH THE DEFAULTS CLAIMED FOR THEM. ----
  foreach ok in array array['what_you_do', 'naics_code', 'library', 'trial_started_at'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'companies' and column_name = ok) then
      raise exception 'MIGRATION 082 FAILED: companies.% was not created.', ok;
    end if;
  end loop;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'companies'
                    and column_name = 'library' and is_nullable = 'NO'
                    and column_default like '%chemical%') then
    raise exception 'MIGRATION 082 FAILED: companies.library is not NOT NULL defaulting to chemical.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name = 'calendar_email' and is_nullable = 'NO'
                    and column_default = 'true') then
    raise exception 'MIGRATION 082 FAILED: profiles.calendar_email is not NOT NULL defaulting to true.';
  end if;
  -- And the duplicate the brief's wording invited is NOT here.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'companies' and column_name = 'website') then
    raise exception 'MIGRATION 082 FAILED: companies.website exists beside website_url — one fact, two columns.';
  end if;

  -- ---- 6b. THE TRIAL BACKFILL LEFT NOBODY OUT. ----
  select count(*) into n from public.companies where trial_started_at is null;
  if n <> 0 then
    raise exception 'MIGRATION 082 FAILED: % company(ies) have no trial_started_at.', n;
  end if;
  select count(*) into n from public.companies
   where created_at is not null and trial_started_at <> created_at;
  if n <> 0 then
    raise exception 'MIGRATION 082 FAILED: % company(ies) were backfilled to something other than created_at.', n;
  end if;

  -- ---- 6c. THE COMPANY NAME IS CLOSED, AND THE EIGHT THAT STAY OPEN ARE OPEN. ----
  -- has_COLUMN_privilege, not has_table_privilege: once only column grants remain,
  -- has_table_privilege(.., 'UPDATE') is FALSE for the whole table, which is why profiles shows no
  -- UPDATE in docs/SCHEMA.md despite 080's grant. Asking the table would prove nothing here.
  foreach ok in array array['name', 'employee_count', 'library', 'trial_started_at',
                            'chemicals', 'extra_profile', 'scan_result', 'pre_completed_items',
                            'created_at', 'id'] loop
    if has_column_privilege('authenticated', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 082 FAILED: a person can still write companies.%.', ok;
    end if;
  end loop;
  foreach ok in array array['industry', 'state', 'county', 'city', 'what_you_do', 'naics_code',
                            'website_url', 'obligations_computed_at'] loop
    if not has_column_privilege('authenticated', 'public.companies', ok, 'UPDATE') then
      raise exception 'MIGRATION 082 FAILED: authenticated lost UPDATE on companies.%, which a route writes.', ok;
    end if;
  end loop;
  -- The table-wide grant really is gone, and the service role really does still hold it, because
  -- a wrong name is fixed by us.
  if has_table_privilege('authenticated', 'public.companies', 'UPDATE') then
    raise exception 'MIGRATION 082 FAILED: the table-wide UPDATE on companies survived the revoke.';
  end if;
  if not has_column_privilege('service_role', 'public.companies', 'name', 'UPDATE') then
    raise exception 'MIGRATION 082 FAILED: the service role cannot fix a wrong company name.';
  end if;
  -- Nothing else moved on companies.
  if not has_table_privilege('authenticated', 'public.companies', 'SELECT') then
    raise exception 'MIGRATION 082 FAILED: authenticated lost SELECT on companies.';
  end if;
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.companies', ok) then
      raise exception 'MIGRATION 082 FAILED: anon holds % on companies.', ok;
    end if;
  end loop;

  -- ---- 6d. A SITE: WHAT A PERSON MAY WRITE, AND WHAT DECIDES WHICH ONE IS MAIN. ----
  foreach ok in array array['name', 'address', 'postal_code', 'state', 'county', 'city', 'fire_authority'] loop
    if not has_column_privilege('authenticated', 'public.entities', ok, 'UPDATE') then
      raise exception 'MIGRATION 082 FAILED: a person cannot edit entities.%.', ok;
    end if;
    if not has_column_privilege('authenticated', 'public.entities', ok, 'INSERT') then
      raise exception 'MIGRATION 082 FAILED: a person cannot set entities.% on a new site.', ok;
    end if;
  end loop;
  foreach ok in array array['is_primary', 'company_id', 'parent_entity_id', 'details', 'entity_type',
                            'created_at', 'updated_at', 'id'] loop
    if has_column_privilege('authenticated', 'public.entities', ok, 'UPDATE') then
      raise exception 'MIGRATION 082 FAILED: a person can still change entities.% on an existing site.', ok;
    end if;
  end loop;
  foreach ok in array array['is_primary', 'parent_entity_id', 'details', 'created_at', 'updated_at', 'id'] loop
    if has_column_privilege('authenticated', 'public.entities', ok, 'INSERT') then
      raise exception 'MIGRATION 082 FAILED: a person can set entities.% on a new site.', ok;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.entities', 'DELETE') then
    raise exception 'MIGRATION 082 FAILED: a person cannot remove a site at all.';
  end if;
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.entities', ok) then
      raise exception 'MIGRATION 082 FAILED: anon holds % on entities.', ok;
    end if;
  end loop;
  -- The INSERT policy carries all three clauses, not just the tenant one.
  select pg_get_expr(pol.polwithcheck, pol.polrelid) into ok
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
   where c.relname = 'entities' and pol.polname = 'entities_insert';
  if ok is null then
    raise exception 'MIGRATION 082 FAILED: entities_insert has no WITH CHECK.';
  end if;
  if ok not like '%is_primary%' or ok not like '%entity_type%' or ok not like '%auth_company_id%' then
    raise exception 'MIGRATION 082 FAILED: entities_insert does not pin tenant, type and is_primary: %', ok;
  end if;

  -- ---- 6e. A THROWAWAY COMPANY, ITS MAIN SITE, AND A SECOND ONE. ----
  insert into public.companies (name, city, state)
       values ('082 probe company', 'Probeville', 'OR') returning id into co;

  -- The main site is the trigger's, not ours: prove signup's path still works.
  select count(*) into n from public.entities where company_id = co and is_primary;
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: create_primary_site made % main site(s), expected 1.', n;
  end if;
  select count(*) into n from public.entities
   where company_id = co and is_primary and name = '082 probe company — Probeville';
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: the main site is not named from the company and its city.';
  end if;

  insert into public.entities (company_id, entity_type, name, address, postal_code, state, county, city)
       values (co, 'site', '082 probe second site', '1 Probe Way', '97210', 'OR', 'Multnomah', 'Portland')
    returning id into site2;

  -- A site added this way is NOT the main one, by the column default, with no help from the caller.
  if (select is_primary from public.entities where id = site2) then
    raise exception 'MIGRATION 082 FAILED: a site added without naming is_primary came out main.';
  end if;
  -- And the index refuses a second main one outright.
  begin
    update public.entities set is_primary = true where id = site2;
    raise exception 'MIGRATION 082 FAILED: a company was allowed two main sites.';
  exception when unique_violation then null;
  end;
  update public.entities set is_primary = false where id = site2;

  -- Editing the name and the address is the whole of what board 1b's drawer offers.
  update public.entities set name = '082 probe renamed', address = '2 Probe Way' where id = site2;
  if (select name from public.entities where id = site2) <> '082 probe renamed' then
    raise exception 'MIGRATION 082 FAILED: a site could not be renamed.';
  end if;

  -- ---- 6f. THE REMOVAL RULE, EVERY CASE OF IT. ----
  -- The main site: refused, always, with nothing attached to it.
  refusal := public.site_removal_refusal((select id from public.entities where company_id = co and is_primary));
  if refusal is null then
    raise exception 'MIGRATION 082 FAILED: the main site may be removed.';
  end if;
  if refusal not like '%main site%' then
    raise exception 'MIGRATION 082 FAILED: the main-site refusal does not say which site it is about: %', refusal;
  end if;

  -- An empty second site: allowed. *** THIS IS THE PRESENCE THAT MAKES THE ABSENCE ABOVE MEAN
  -- SOMETHING (§9a). *** Without it, a function that refused everything would pass every check here.
  if public.site_removal_refusal(site2) is not null then
    raise exception 'MIGRATION 082 FAILED: a site with nothing attached could not be removed: %',
      public.site_removal_refusal(site2);
  end if;

  -- Attach one row in a CASCADE relation and the same site becomes un-removable.
  insert into public.company_facts (company_id, entity_id, key, value)
       values (co, site2, '082_probe_fact', '"yes"'::jsonb);
  refusal := public.site_removal_refusal(site2);
  if refusal is null then
    raise exception 'MIGRATION 082 FAILED: a site with a confirmed fact on it could be removed, and the fact would have gone with it.';
  end if;
  if refusal not like '%confirmed fact%' then
    raise exception 'MIGRATION 082 FAILED: the refusal does not name what is attached: %', refusal;
  end if;

  -- Take it away again and the site is removable once more: the rule tracks the data, not a flag.
  delete from public.company_facts where company_id = co and key = '082_probe_fact';
  if public.site_removal_refusal(site2) is not null then
    raise exception 'MIGRATION 082 FAILED: removing the attached fact did not make the site removable again.';
  end if;
  -- A site that is already gone refuses nothing, so a re-run of a successful delete is not a failure.
  if public.site_removal_refusal(gen_random_uuid()) is not null then
    raise exception 'MIGRATION 082 FAILED: a site that does not exist produced a refusal.';
  end if;

  delete from public.entities where id = site2;
  select count(*) into n from public.entities where id = site2;
  if n <> 0 then
    raise exception 'MIGRATION 082 FAILED: a removable site was not removed.';
  end if;

  -- ---- 6g. AN INVITATION: THE DATABASE FILLS THE TOKEN, AND IT IS NOT READABLE BY A PERSON. ----
  insert into public.invitations (company_id, email) values (co, 'Probe@Example.COM') returning id into inv;
  select token, expires_at::date - created_at::date into tok, n from public.invitations where id = inv;
  if tok is null or length(tok) <> 64 or tok !~ '^[0-9a-f]{64}$' then
    raise exception 'MIGRATION 082 FAILED: the token default produced %, not 64 hex characters.', coalesce(tok, 'NULL');
  end if;
  if n <> 7 then
    raise exception 'MIGRATION 082 FAILED: an invitation expires in % days, not 7.', n;
  end if;
  -- One LIVE invitation per email per company, case-insensitively.
  begin
    insert into public.invitations (company_id, email) values (co, 'probe@example.com');
    raise exception 'MIGRATION 082 FAILED: a second live invitation to the same address was accepted.';
  exception when unique_violation then null;
  end;
  -- Cancel it and the address may be invited again.
  update public.invitations set cancelled_at = now() where id = inv;
  insert into public.invitations (company_id, email) values (co, 'probe@example.com');
  select count(*) into n from public.invitations where company_id = co;
  if n <> 2 then
    raise exception 'MIGRATION 082 FAILED: re-inviting a cancelled address gave % rows, expected 2.', n;
  end if;

  -- ---- 6h. THE INVITATION RULE, EVERY CASE OF IT. ----
  if public.invitation_person_move_refusal(null, now(), null) is not null then
    raise exception 'MIGRATION 082 FAILED: a person could not withdraw a live invitation.';
  end if;
  if public.invitation_person_move_refusal(null, null, null) is not null then
    raise exception 'MIGRATION 082 FAILED: leaving an invitation alone was refused.';
  end if;
  if public.invitation_person_move_refusal(now(), null, null) is null then
    raise exception 'MIGRATION 082 FAILED: a withdrawn invitation could be brought back to life.';
  end if;
  if public.invitation_person_move_refusal(null, now(), now()) is null then
    raise exception 'MIGRATION 082 FAILED: an accepted invitation could be withdrawn.';
  end if;
  if public.invitation_person_move_refusal(now(), now(), now()) is not null then
    raise exception 'MIGRATION 082 FAILED: leaving an accepted, cancelled invitation alone was refused.';
  end if;

  -- ---- 6i. THE TOKEN AND THE TABLE, READ FROM THE CATALOG. ----
  if has_column_privilege('authenticated', 'public.invitations', 'token', 'SELECT') then
    raise exception 'MIGRATION 082 FAILED: a person can read an invitation token.';
  end if;
  if has_column_privilege('authenticated', 'public.invitations', 'token', 'INSERT') then
    raise exception 'MIGRATION 082 FAILED: a person can choose an invitation token.';
  end if;
  if not has_column_privilege('service_role', 'public.invitations', 'token', 'SELECT') then
    raise exception 'MIGRATION 082 FAILED: the service role cannot read the token, so /join cannot work.';
  end if;
  foreach ok in array array['id', 'company_id', 'email', 'invited_by', 'created_at',
                            'expires_at', 'accepted_at', 'cancelled_at'] loop
    if not has_column_privilege('authenticated', 'public.invitations', ok, 'SELECT') then
      raise exception 'MIGRATION 082 FAILED: a person cannot see invitations.%, which board 2 shows.', ok;
    end if;
  end loop;
  foreach ok in array array['company_id', 'email', 'invited_by', 'expires_at'] loop
    if not has_column_privilege('authenticated', 'public.invitations', ok, 'INSERT') then
      raise exception 'MIGRATION 082 FAILED: a person cannot set invitations.% when inviting.', ok;
    end if;
  end loop;
  if not has_column_privilege('authenticated', 'public.invitations', 'cancelled_at', 'UPDATE') then
    raise exception 'MIGRATION 082 FAILED: a person cannot withdraw an invitation.';
  end if;
  foreach ok in array array['id', 'company_id', 'email', 'token', 'invited_by', 'created_at',
                            'expires_at', 'accepted_at'] loop
    if has_column_privilege('authenticated', 'public.invitations', ok, 'UPDATE') then
      raise exception 'MIGRATION 082 FAILED: a person can rewrite invitations.%.', ok;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.invitations', 'DELETE') then
    raise exception 'MIGRATION 082 FAILED: a person can delete an invitation; they are cancelled, not deleted.';
  end if;
  -- 075:388's sweep, and 068's reason: `supabase_admin`'s default privileges on public still grant
  -- both roles everything for objects it creates, and MAINTAIN is the right three of our checks were
  -- blind to. A new table starts life holding whatever those defaults gave it, so the REVOKE above
  -- is read back rather than trusted.
  foreach ok in array array['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('authenticated', 'public.invitations', ok) then
      raise exception 'MIGRATION 082 FAILED: authenticated holds % on invitations.', ok;
    end if;
  end loop;
  foreach ok in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
    if has_table_privilege('anon', 'public.invitations', ok) then
      raise exception 'MIGRATION 082 FAILED: anon holds % on invitations.', ok;
    end if;
  end loop;
  if not exists (select 1 from pg_class where relname = 'invitations' and relrowsecurity) then
    raise exception 'MIGRATION 082 FAILED: RLS is not enabled on invitations.';
  end if;
  select count(*) into n from pg_policy pol join pg_class c on c.oid = pol.polrelid
   where c.relname = 'invitations';
  if n <> 3 then
    raise exception 'MIGRATION 082 FAILED: invitations has % policies, expected 3 and no DELETE policy.', n;
  end if;

  -- ---- 6j. AND THE CUSTOMER CAN STILL DELETE THEIR ACCOUNT. ----
  -- *** THE CHECK THIS WHOLE SECTION EXISTS FOR. *** /api/account DELETE removes the company with
  -- the service role, which cascades to entities and fires the removal guard. A company holding a
  -- site WITH an attached fact is the case that would fail if the guard applied to every caller.
  insert into public.entities (company_id, entity_type, name)
       values (co, 'site', '082 probe doomed site') returning id into site2;
  insert into public.company_facts (company_id, entity_id, key, value)
       values (co, site2, '082_probe_doomed', '"yes"'::jsonb);
  if public.site_removal_refusal(site2) is null then
    raise exception 'MIGRATION 082 FAILED: the doomed site is not actually protected, so the test below proves nothing.';
  end if;
  delete from public.companies where id = co;
  select count(*) into n from public.entities where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 082 FAILED: % site(s) outlived the company, so a deletion leaves rows behind.', n;
  end if;
  select count(*) into n from public.invitations where company_id = co;
  if n <> 0 then
    raise exception 'MIGRATION 082 FAILED: % invitation(s) outlived the company.', n;
  end if;

  -- ---- 6k. THE PERSON'S OWN SWITCH, AND 080'S GRANT NOT BROKEN BY RESTATING IT. ----
  foreach ok in array array['full_name', 'welcomed_at', 'calendar_email'] loop
    if not has_column_privilege('authenticated', 'public.profiles', ok, 'UPDATE') then
      raise exception 'MIGRATION 082 FAILED: a person cannot write profiles.%.', ok;
    end if;
  end loop;
  foreach ok in array array['id', 'company_id', 'created_at'] loop
    if has_column_privilege('authenticated', 'public.profiles', ok, 'UPDATE') then
      raise exception 'MIGRATION 082 FAILED: a person can write profiles.%.', ok;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'MIGRATION 082 FAILED: the table-wide UPDATE on profiles came back.';
  end if;

  -- ---- 6l. THE TRIGGERS ARE WHERE AND WHAT THEY SAY THEY ARE. ----
  -- tgtype bits: 1 ROW, 2 BEFORE, 8 DELETE, 16 UPDATE. AFTER is "not BEFORE".
  select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'entities' and t.tgname = 'entities_person_delete'
     and (t.tgtype & 2) = 2 and (t.tgtype & 8) = 8 and (t.tgtype & 1) = 1;
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: the site guard is not a BEFORE DELETE row trigger on entities.';
  end if;
  select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'invitations' and t.tgname = 'invitations_person_update'
     and (t.tgtype & 2) = 2 and (t.tgtype & 16) = 16 and (t.tgtype & 1) = 1;
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: the invitation guard is not a BEFORE UPDATE row trigger.';
  end if;
  -- create_primary_site is untouched: signup still gets a site in the same statement.
  select count(*) into n from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relname = 'companies' and t.tgname = 'create_primary_site';
  if n <> 1 then
    raise exception 'MIGRATION 082 FAILED: create_primary_site is gone from companies.';
  end if;
  -- The counter is SECURITY DEFINER, or it under-counts exactly the rows a person cannot see.
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'site_removal_refusal' and p.prosecdef) then
    raise exception 'MIGRATION 082 FAILED: site_removal_refusal is not SECURITY DEFINER, so its counts are RLS-filtered.';
  end if;
  -- PUBLIC holding EXECUTE on a definer-rights row counter is anyone counting anyone's rows.
  -- 080:664's query shape, because `has_function_privilege('public', ...)` is not a thing: PUBLIC
  -- is not a role in pg_roles, and asking for it by name errors. `grantee = 0` is PUBLIC,
  -- unambiguously.
  if exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    left join lateral aclexplode(p.proacl) a on true
    where ns.nspname = 'public' and p.proname = 'site_removal_refusal'
      and (p.proacl is null or (a.privilege_type = 'EXECUTE' and a.grantee = 0))
  ) then
    raise exception 'MIGRATION 082 FAILED: PUBLIC holds EXECUTE on site_removal_refusal.';
  end if;
  if not has_function_privilege('authenticated', 'public.site_removal_refusal(uuid)', 'EXECUTE') then
    raise exception 'MIGRATION 082 FAILED: a person cannot call site_removal_refusal, so the drawer cannot ask before it offers Remove.';
  end if;

  raise notice 'MIGRATION 082 OK: four company facts added and the trial backfilled; the company '
    'name closed to a person at both doors with eight columns still open; a site addable, '
    'editable and removable but never the main one and never one with rows attached; invitations '
    'with a token no person can read or choose; the monthly email a per-person switch; and a '
    'company with a protected site still deletable by the service role. The PERSON''S half of '
    'every rule above is proved by check:live, not here.';
end $$;

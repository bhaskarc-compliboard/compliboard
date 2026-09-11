-- ============================================================
-- COMPLIBOARD — MIGRATION 009: A SITE CAN SAY WHERE IT IS
-- ============================================================
--
-- WHY THIS EXISTS
--
-- `entities` has no jurisdiction columns at all — id, company_id, entity_type, name,
-- parent_entity_id, is_primary, details, created_at, updated_at. A site cannot say which
-- state, county or city it is in.
--
-- *** THAT MAKES TWO OF THE FIVE JURISDICTION LAYERS UNRESOLVABLE FOR EVERY COMPANY. ***
--
-- `jurisdiction_layer` permits federal | state | county | city | local. A `local` row
-- resolves against the authority having jurisdiction at THE SITE — a city fire marshal, a
-- county fire marshal, or a rural fire protection district, depending on the address
-- (DECISIONS.md §21.2). A `city` row needs the site's city. Neither can be answered from
-- `companies`, because two plants of one company can sit under different fire authorities
-- — which is the whole argument of DECISIONS.md §20.
--
-- The three Oregon Fire Code rows in the library are `local` today. They are the first
-- rows that cannot be resolved at company level, and right now they cannot be resolved at
-- all. This migration gives them somewhere to resolve against.
--
-- Cheap now: `entities` holds a handful of seeded test sites. Expensive later: every
-- customer would have to be asked for the address of every facility, after the fact.
--
-- WHAT THIS MIGRATION DOES
--
--   1. Jurisdiction columns on entities — the site's own address
--   2. entity_id on documents, document_reviews and calendar_events (TODO 1.6's remainder)
--   3. A backfill pointing existing rows at each company's primary site
--
-- WHAT IT DOES NOT DO: make entity_id NOT NULL anywhere. Signup does not create a site
-- yet, so a NOT NULL would break account creation — the same coupling that made
-- employee_count a five-place change. The constraint follows the signup change, not the
-- other way round.
-- ============================================================


-- ------------------------------------------------------------
-- 1. WHERE A SITE IS
--
-- Deliberately the same column NAMES as `companies` (state, county, city) rather than the
-- `jurisdiction_*` prefix used on requirement_templates. These are an address; those are a
-- match key. Resolution reads a site's address and compares it against a requirement's
-- jurisdiction, and keeping the two vocabularies distinct is what stops someone writing
-- `entity.jurisdiction_state = template.jurisdiction_state` and thinking that is the whole
-- rule — it is not, because `local` compares against the fire authority, not the state.
--
-- All nullable. A chemical or a piece of equipment is an entity too and has no address;
-- only sites do. A CHECK requiring an address on entity_type='site' is deliberately NOT
-- added here, because the seeded default site is created at signup from a company that may
-- not have been asked for a full address yet.
-- ------------------------------------------------------------

alter table public.entities add column if not exists state       text;
alter table public.entities add column if not exists county      text;
alter table public.entities add column if not exists city        text;
alter table public.entities add column if not exists address     text;
alter table public.entities add column if not exists postal_code text;

-- The authority having jurisdiction for fire code, where it is known and is not simply the
-- city or the county — a rural fire protection district has its own name and is neither.
-- This is what a `local` requirement actually resolves against.
alter table public.entities add column if not exists fire_authority text;

comment on column public.entities.state is
  'The SITE''s address, not the company''s. They differ the moment a company has two '
  'plants, and CHEMICAL-OR-WA.md §6.6 is built on that. companies.state stays the '
  'authoritative source for the company itself — DECISIONS.md §24.1.';

comment on column public.entities.fire_authority is
  'Named authority for jurisdiction_layer = local, where it is neither the city nor the '
  'county — an Oregon rural fire protection district, for instance. The three Oregon Fire '
  'Code rows in the library are the first that need it.';

create index if not exists idx_entities_jurisdiction on public.entities (state, county, city);


-- ------------------------------------------------------------
-- 2. entity_id ON THE REMAINING COMPANY DATA — TODO 1.6
--
-- 007 put entity_id on obligation_evidence and left three tables named in 1.6 without it.
--
--   documents          a permit belongs to the plant it was issued for
--   document_reviews   a review is about a document, so it inherits the document's site;
--                      without the column the two can disagree about location
--   calendar_events    an air permit renewal belongs to the plant holding the permit
--
-- NULLABLE, and null means company-wide rather than unknown: the corporate ISO certificate
-- and the written HazCom program genuinely belong to the company and not to a site.
-- ------------------------------------------------------------

alter table public.documents
  add column if not exists entity_id uuid references public.entities(id) on delete set null;
alter table public.document_reviews
  add column if not exists entity_id uuid references public.entities(id) on delete set null;
alter table public.calendar_events
  add column if not exists entity_id uuid references public.entities(id) on delete set null;

-- ON DELETE SET NULL, not CASCADE, and the difference matters. Deleting a SITE must not
-- delete the permits that were filed for it — a closed plant's records are exactly the
-- history a compliance product exists to keep (CLAUDE.md §3.2). The document survives and
-- becomes company-wide; the fact of which site it belonged to is what is lost, and that is
-- the lesser loss.

create index if not exists idx_documents_entity on public.documents (entity_id);
create index if not exists idx_document_reviews_entity on public.document_reviews (entity_id);
create index if not exists idx_calendar_events_entity on public.calendar_events (entity_id);


-- ------------------------------------------------------------
-- 3. BACKFILL — point existing rows at each company's primary site, and give each
--    company's primary site the company's own address.
--
-- Only where a primary site already exists. Companies without one keep null entity_id,
-- which reads as company-wide and is the truthful answer until signup creates the site.
-- ------------------------------------------------------------

update public.entities e
   set state  = coalesce(e.state,  c.state),
       county = coalesce(e.county, nullif(c.county, '')),
       city    = coalesce(e.city,   nullif(c.city, ''))
  from public.companies c
 where e.company_id = c.id
   and e.entity_type = 'site'
   and e.is_primary;


-- ------------------------------------------------------------
-- 4. VERIFY
-- ------------------------------------------------------------

do $$
declare missing text;
begin
  select string_agg(x.t || '.' || x.c, ', ') into missing
  from (values
    ('entities','state'), ('entities','county'), ('entities','city'),
    ('entities','address'), ('entities','postal_code'), ('entities','fire_authority'),
    ('documents','entity_id'), ('document_reviews','entity_id'), ('calendar_events','entity_id')
  ) as x(t, c)
  where not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = x.t and column_name = x.c
  );
  if missing is not null then
    raise exception 'MIGRATION 009: missing column(s): %', missing;
  end if;

  -- entity_id must stay nullable everywhere until signup creates a site. A NOT NULL here
  -- would break account creation, which is the coupling employee_count already taught us.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and column_name = 'entity_id' and is_nullable = 'NO'
       and table_name in ('documents','document_reviews','calendar_events','obligations','obligation_evidence')
  ) then
    raise exception 'MIGRATION 009: an entity_id is NOT NULL. Signup does not create a site yet.';
  end if;

  raise notice 'MIGRATION 009 OK: sites can state their jurisdiction; entity_id on documents, reviews and calendar.';
end $$;

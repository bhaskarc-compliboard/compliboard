-- ============================================================
-- COMPLIBOARD — MIGRATION 037: THE BUCKET THE CHAIN NEVER BUILT
-- ============================================================
--
-- *** THIS DELIBERATELY REVISES A DECISION MIGRATION 000 MADE, SO THE REASON IS HERE. ***
--
-- 000 says, in its own words:
--
--   "The `company-documents` bucket itself is a ROW in storage.buckets, i.e. data, not
--    structure. It is therefore not in this file. Staging has no bucket, so one must be created
--    there before storage policies can be tested against anything. Flagged rather than smuggled
--    in as an INSERT."
--
-- That reasoning was sound about DATA. It is wrong about THIS row, and the difference is what
-- depends on it: **migration 002's storage policies are written against a bucket that the chain
-- does not create.** A from-zero build produces the policies and nothing for them to apply to,
-- and the first upload fails with `Bucket not found` — the same shape as §98 (the chain rebuilds
-- the schema, not the database) and §118 (content that lived only in a migration), one layer
-- down in the storage schema.
--
-- A bucket is not a customer's data. It is the container their data lives in, it is named in
-- code, and its policies are in this chain. It belongs here.
--
-- ------------------------------------------------------------
-- WHAT THIS IS NOT
--
-- It is NOT the cause of the 23 September upload failure. That was a wrong name in
-- `app/compliance/page.tsx` — `documents` instead of `company-documents` — written during Run 3,
-- and `lib/storage.ts` now holds the name once so a sixth spelling cannot happen. Both staging
-- and production HAVE the bucket and always did:
--
--   staging     company-documents  created 2026-09-09 20:07:02+00
--   production  company-documents  created 2026-06-03 18:55:13+00
--
-- So on both live databases this migration is a no-op. It exists for the NEXT project built from
-- this chain, and for `npm run db:restore` to be able to say the bucket is there.
-- ------------------------------------------------------------

-- IDEMPOTENT BY CONFLICT, not by a prior SELECT: two concurrent applies of the same chain would
-- both pass a `if not exists` check and one would then fail on the primary key.
insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do nothing;

-- *** NOT PUBLIC, AND THAT IS THE WHOLE SECURITY MODEL. ***
-- A public bucket serves every object to anyone with the URL, and migration 002's policies would
-- then be decoration. If a row already existed and was public — it is not, on either database,
-- checked above — this corrects it rather than leaving it.
update storage.buckets set public = false where id = 'company-documents' and public is true;

-- ------------------------------------------------------------
-- VERIFY — including that the policies migration 002 wrote have something to apply to.
-- ------------------------------------------------------------
do $$
declare
  n int;
begin
  select count(*) into n from storage.buckets where id = 'company-documents';
  if n <> 1 then
    raise exception 'MIGRATION 037 FAILED: the company-documents bucket was not created.';
  end if;

  select count(*) into n from storage.buckets where id = 'company-documents' and public is false;
  if n <> 1 then
    raise exception 'MIGRATION 037 FAILED: the bucket is PUBLIC. Every object would be served to anyone with the URL.';
  end if;

  -- Migration 002 replaced 000's three unscoped policies with four company-scoped ones. If the
  -- bucket exists and those are missing, the chain has produced storage with no boundary at all.
  select count(*) into n from pg_policies where schemaname = 'storage' and tablename = 'objects';
  if n = 0 then
    raise exception 'MIGRATION 037 FAILED: no policies on storage.objects — the bucket would be unguarded.';
  end if;

  raise notice 'MIGRATION 037 OK: company-documents exists, is private, and storage.objects carries % policy/policies.', n;
end $$;

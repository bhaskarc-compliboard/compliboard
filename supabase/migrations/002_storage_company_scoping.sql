-- ============================================================
-- COMPLIBOARD — MIGRATION 002: SCOPE STORAGE POLICIES BY COMPANY
-- ============================================================
--
-- WHY THIS EXISTS
--
-- The three policies migration 001-era work left on storage.objects test exactly
-- one condition: bucket_id = 'company-documents'. They test nothing about who owns
-- the file. Their names — "Users can view own files", "Users can upload to own
-- folder", "Users can delete own files" — describe an ownership check that the SQL
-- never performed. The practical effect in production today is that any
-- authenticated user of the application can read, and delete, every file in the
-- bucket, including documents belonging to other companies. As of the 2026-09-09
-- production snapshot in CURRENT-SCHEMA.md that is 52 objects across 7 companies.
--
-- This is the failure CLAUDE.md §3.6 is written to prevent: RLS is the security
-- boundary, and here the boundary was decorative. A compliance product whose
-- customers' permits, SDS sheets and HR handbooks are mutually readable is not
-- sellable, so this is repaired before anything else is built on top of the bucket.
--
-- WHY IT CAN BE FIXED WITH POLICY CHANGES ALONE
--
-- The object paths are already laid out correctly. Every upload site in the app
-- builds the path as `${companyId}/${folder}/${filename}` —
--   app/documents/page.tsx:254, app/upload/page.tsx:82, app/hr/page.tsx:91
-- — and companyId there is read from profiles.company_id for the signed-in user,
-- not from the user id. Verified against production: of the 7 distinct first path
-- segments, 6 match a row in companies.id and none match a profiles.id. So the
-- first segment already IS the tenant key; the policies simply never consulted it.
-- No file has to be moved or renamed.
--
-- WHAT THIS MIGRATION DOES
--
-- Drops the three misleading policies by their exact current names and recreates
-- four — SELECT, INSERT, UPDATE, DELETE — each requiring both the bucket and a
-- first path segment that resolves to the caller's own company. INSERT and UPDATE
-- get an explicit WITH CHECK so a row cannot be written, or updated, into a state
-- that the policy would not have permitted; UPDATE carries both USING (which rows
-- may be targeted) and WITH CHECK (what they may become), which is what stops a
-- file being renamed out of one company's prefix and into another's.
--
-- An UPDATE policy is added where none existed before. Supabase Storage performs a
-- move or rename as an UPDATE on storage.objects, so without one those operations
-- are denied outright — and with an unscoped one they would be a second way to
-- cross the tenant boundary.
--
-- TWO THINGS TO KNOW BEFORE APPLYING
--
-- 1. Four objects under the prefix fcde1027-4504-4adb-8a3e-a0d415275fd5 belong to
--    no row in companies — an orphan left behind when a company was deleted
--    (storage objects are not reached by the ON DELETE CASCADE on
--    documents.company_id). After this migration those four become unreachable to
--    every ordinary session, which is the correct outcome; they are still visible
--    to the service role and should be cleaned up separately.
--
-- 2. (storage.foldername(name))[1]::uuid raises an error, rather than simply
--    failing to match, if an object's first path segment is ever not a valid uuid.
--    Every one of the 7 prefixes in production today is a valid uuid, so this is
--    safe as written. If a malformed path is ever created the comparison can be
--    made total by comparing text instead of casting:
--        (storage.foldername(name))[1] IN (
--          SELECT profiles.company_id::text FROM public.profiles
--          WHERE profiles.id = auth.uid()
--        )
--
-- This migration changes policies only. No object is moved, renamed or deleted,
-- and no table is altered. It is reversible by restoring the three original
-- bucket-only policies, though doing so would restore the exposure.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Remove the existing bucket-only policies.
--    These three names are taken verbatim from the production catalog
--    (pg_policies, schema 'storage', table 'objects') as recorded in
--    CURRENT-SCHEMA.md. There is no existing UPDATE policy to drop.
-- ------------------------------------------------------------

drop policy if exists "Users can view own files"       on storage.objects;
drop policy if exists "Users can upload to own folder" on storage.objects;
drop policy if exists "Users can delete own files"     on storage.objects;

-- ------------------------------------------------------------
-- 2. Recreate them, scoped to the caller's company.
--
--    storage.foldername(name) splits the object path on '/' and returns the
--    directory segments as a text[]; element [1] is the first segment, which is
--    the company_id the upload sites write. auth.uid() is the user id carried in
--    the verified JWT — it cannot be supplied by the client as a parameter.
-- ------------------------------------------------------------

create policy "Company members can view their company files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(storage.objects.name))[1]::uuid in (
      select profiles.company_id from public.profiles where profiles.id = auth.uid()
    )
  );

create policy "Company members can upload to their company folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'company-documents'
    and (storage.foldername(storage.objects.name))[1]::uuid in (
      select profiles.company_id from public.profiles where profiles.id = auth.uid()
    )
  );

-- USING decides which existing rows may be targeted; WITH CHECK decides what they
-- are allowed to become. Both are required here: without WITH CHECK a file could be
-- renamed from the caller's own prefix into another company's.
create policy "Company members can update their company files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(storage.objects.name))[1]::uuid in (
      select profiles.company_id from public.profiles where profiles.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'company-documents'
    and (storage.foldername(storage.objects.name))[1]::uuid in (
      select profiles.company_id from public.profiles where profiles.id = auth.uid()
    )
  );

create policy "Company members can delete their company files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'company-documents'
    and (storage.foldername(storage.objects.name))[1]::uuid in (
      select profiles.company_id from public.profiles where profiles.id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. Verification — run these by hand after applying, against STAGING first.
--
--    Expect exactly four rows, all scoped, none bucket-only:
--
--      select policyname, cmd, qual, with_check
--      from pg_policies
--      where schemaname = 'storage' and tablename = 'objects'
--      order by policyname;
--
--    Then, signed in as a real user, confirm a listing of the bucket returns only
--    that user's own company prefix. RLS on storage.objects is already enabled in
--    production, so no enable statement is needed here.
-- ------------------------------------------------------------

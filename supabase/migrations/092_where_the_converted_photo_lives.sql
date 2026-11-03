-- =================================================================================================
-- 092 — WHERE THE CONVERTED PHOTO LIVES: ONE NULLABLE COLUMN ON `documents`.
-- =================================================================================================
--
-- WHY.
--
-- `docs/GAPS-PLAN.md` Part B step B2, the owner's decisions 52 and 53 of 3 November 2026. The
-- product now reads an iPhone HEIC, a scanner's TIFF and a BMP, by converting each to a JPEG
-- inside Vercel before the model call (`lib/imageConvert.ts`). The converted copy is **stored
-- beside the original, and the original is never altered** — which is what
-- `docs/VISION-DOCUMENTS.md` decided on 27 September and what the binder (Part C step C1) will
-- need, because a HEIC cannot be put behind a tab sheet in a PDF.
--
-- Nothing on `documents` could point at that copy, and this is that pointer.
--
-- *** WHY A COLUMN AND NOT A DERIVED KEY. *** The key could have been computed from the document's
-- id and never stored. It would then be impossible to tell "this was converted" from "this never
-- needed converting" without asking storage, once per row, on every page that draws a list. A
-- nullable column answers it for nothing, and NULL is the honest word for the great majority of
-- documents — every PDF, every spreadsheet, and every JPEG that was already small enough to send
-- as it is.
--
-- *** WHY TWO LEVELS AND NOT THREE. *** The value is `<company_id>/converted/<document_id>.jpg`.
-- `app/api/account/route.ts` `listCompanyObjects` lists `<company>/` and then each folder exactly
-- ONE level down, so a file at a third level would survive a deletion a customer asked for —
-- `lib/storage.ts` records this and `tests/unit/storage.test.ts` holds it. `converted` is a
-- sibling of `handbooks` and `unfiled`, not a child of one.
--
-- NOTHING ELSE CHANGES. No constraint, no index, no backfill: every existing row keeps NULL,
-- which is true of every one of them — nothing had been converted before this migration existed.
-- `documents` already carries RLS and grants from migrations 003-010 and 053, and a new column on
-- an existing table inherits both, so there is nothing to revoke or grant here (`CLAUDE.md` §3.6's
-- REVOKE-then-GRANT shape is for a new TABLE).

begin;

alter table public.documents
  add column if not exists converted_url text;

comment on column public.documents.converted_url is
  'Storage key of the JPEG we converted this document to so a model could read it, at '
  '<company_id>/converted/<document_id>.jpg. NULL when nothing was converted — every PDF, every '
  'spreadsheet, and every photo already small enough to send as it is. The original is never '
  'altered. Written by the two reading paths that own the row (app/api/jobs/scan-documents and '
  'app/api/document-scan); read by "Open the file" and, later, by the binder. GAPS-PLAN B2.';

-- ---- VERIFY, BY READING THE CATALOG RATHER THAN TRUSTING THE STATEMENT ABOVE. ----
-- `CLAUDE.md` §3.7: a migration's result is taken from the database, never from its exit code.
do $$
declare
  t text;
  nullable text;
  n bigint;
begin
  select data_type, is_nullable into t, nullable
    from information_schema.columns
   where table_schema = 'public' and table_name = 'documents' and column_name = 'converted_url';

  if t is null then
    raise exception 'MIGRATION 092 FAILED: documents.converted_url was not created.';
  end if;
  if t <> 'text' then
    raise exception 'MIGRATION 092 FAILED: documents.converted_url is % and should be text.', t;
  end if;
  if nullable <> 'YES' then
    raise exception 'MIGRATION 092 FAILED: documents.converted_url must be nullable — NULL is the '
      'honest value for every document that needed no conversion.';
  end if;

  -- Every existing row is NULL, which is the only correct state: nothing has been converted yet.
  select count(*) into n from public.documents where converted_url is not null;
  if n <> 0 then
    raise exception 'MIGRATION 092 FAILED: % row(s) already carry a converted_url, which no code '
      'had written when this migration ran.', n;
  end if;

  raise notice 'MIGRATION 092 OK: documents.converted_url exists, is text, is nullable, and is '
    'NULL on every one of the % existing rows.', (select count(*) from public.documents);
end $$;

commit;

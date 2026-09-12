/* ============================================================
   COMPLIBOARD — THE SCHEMA CENSUS

   WHY THIS FILE EXISTS. AUDIT-CHECKS.md check 10 compares production and staging
   object for object, and its own note says the census "must be the same one every
   time, or the count itself becomes a false alarm." It has now produced three
   different totals — 673, 619 and 798 — not because anything drifted, but because
   the census was rewritten from scratch each time it was run. A census that lives
   in chat is not a census; it is a number with no definition behind it. This is the
   definition. Run it against both databases and diff the two outputs; the count means
   something because it is the SAME question asked twice.

     npx supabase db query --project-ref <ref> --linked -o json "$(cat supabase/census.sql)"

   THE COMMENT BLOCK IS /* */ AND NOT -- ON PURPOSE. The Supabase CLI takes the SQL as
   a positional argument, so a string beginning with `--` is parsed as a flag and the
   command silently prints its own help instead of running. The pipeline then compares
   two EMPTY outputs and reports them identical — a passing check that checked nothing.

   WHAT IT DELIBERATELY DOES NOT USE. `information_schema.role_table_grants` filters to
   roles the caller belongs to and returns nothing here, which is what produced the 673.
   Table ACLs are read from `pg_class.relacl` instead, which is not caller-dependent.

   WHAT IS COMPARED: tables · columns with type, nullability and default · constraints
   with their definitions · indexes with their definitions · policies with roles, USING
   and WITH CHECK · triggers · functions by body hash · enum values with their order ·
   table ACLs · RLS and force-RLS flags.

   NOT COMPARED, on purpose: row data (the two databases hold different companies), and
   object OIDs and UUID primary keys — those are generated independently per database,
   so comparing requirement_templates by `id` across environments reports 34 spurious
   differences, which is its own false alarm. Key on requirement_name instead.

   ALWAYS ASSERT A NON-ZERO COUNT before trusting a clean diff.
   ============================================================ */

select kind || ' :: ' || obj as line from (
  select 'a_table'::text as kind, c.relname::text as obj
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p','v','m')
  union all
  select 'b_column', c.relname||'.'||a.attname||' '||format_type(a.atttypid,a.atttypmod)||' '||
         (case when a.attnotnull then 'NOTNULL' else 'NULLABLE' end)||' def='||coalesce(pg_get_expr(d.adbin,d.adrelid),'-')
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
   where n.nspname='public' and a.attnum>0 and not a.attisdropped and c.relkind in ('r','p')
  union all
  select 'c_constraint', conrelid::regclass::text||'.'||conname||' '||pg_get_constraintdef(oid)
    from pg_constraint where connamespace='public'::regnamespace
  union all
  select 'd_index', indexname||' '||indexdef from pg_indexes where schemaname='public'
  union all
  select 'e_policy', tablename||'.'||policyname||' cmd='||cmd||' roles='||array_to_string(roles,'+')||
         ' using='||coalesce(qual,'-')||' check='||coalesce(with_check,'-')
    from pg_policies where schemaname='public'
  union all
  select 'f_trigger', c.relname||'.'||t.tgname||' '||pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and not t.tgisinternal
  union all
  select 'g_function', p.proname||'('||pg_get_function_identity_arguments(p.oid)||') body_md5='||md5(p.prosrc)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  union all
  select 'h_enum', t.typname||'.'||e.enumlabel||' ord='||e.enumsortorder::text
    from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace
   where n.nspname='public'
  union all
  select 'i_acl', c.relname||' acl='||coalesce(array_to_string(c.relacl,','),'-')
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p')
  union all
  select 'j_rls', c.relname||' rls='||c.relrowsecurity::text||' force='||c.relforcerowsecurity::text
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p')
) x order by 1

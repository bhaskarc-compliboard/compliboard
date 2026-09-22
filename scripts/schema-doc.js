// GENERATES docs/SCHEMA.md FROM THE LIVE DATABASE.
//
//   node --env-file=.env.local scripts/schema-doc.js              STAGING (default)
//   node --env-file=.env.local scripts/schema-doc.js --production PRODUCTION (read-only)
//
// *** WHY THIS IS A SCRIPT AND NOT A DOCUMENT SOMEBODY MAINTAINS. ***
//
// Every hand-written summary of this schema has drifted. `CLAUDE.md` said 23 tables when there
// were 27, and `~46` switches when 95 were seeded; `AUDIT-CHECKS.md` counted a storage bucket that
// does not exist. The pattern is not carelessness — it is that a summary is a COPY, and a copy of
// a moving thing is wrong by default (`DECISIONS.md` §43).
//
// So this reads the catalog and writes the file. It runs inside `npm run db:migrate`, which means
// the document cannot be stale by more than one migration.
//
// IT READS THE DATABASE, NOT THE MIGRATIONS. The migration files say what was intended; the
// catalog says what is there. Those have differed — migration 028 was refused by its own verify
// block and left no table behind, and `pg_default_acl` grants privileges no GRANT statement
// mentions (`CLAUDE.md` §3.6).
//
// The "used by" column comes from the REPO — every table named in a `.from(...)` call across
// app/, lib/ and scripts/ — because no catalog knows which route touches a table.
//
// (Written that way on purpose: `check-schema-contracts` reads every quoted table name in the
// repo and validates it against the generated types, and it rightly flagged an illustrative one
// in this comment. A checker that can be talked out of a finding is not a checker.)

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const isProd = process.argv.includes('--production')

// --- the target, printed before anything runs (HOW-WE-BUILD.md §4) ---
const stagingUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const stagingRef = stagingUrl.replace('https://', '').split('.')[0]
const ref = isProd ? (process.env.SUPABASE_PROD_REF ?? '') : stagingRef
if (!ref) {
  console.error(`\n  REFUSED: no project ref for ${isProd ? 'production' : 'staging'}.\n`)
  process.exit(1)
}
const label = isProd ? 'PRODUCTION' : 'staging'
console.log(`\n  schema-doc: reading ${label} (${ref})\n`)

// *** THE FLAGS ARE LOAD-BEARING. DO NOT DROP THEM. ***
//
// This function used to pass NEITHER `-o json` NOR `--agent`, which left the RENDERING up to
// the CLI's own agent auto-detection — and the two renderings are not both JSON:
//
//   --agent no   (no -o json)   a box-drawing TABLE:   | '{}'::text[]   |
//   --agent yes / auto          a JSON envelope:       {"boundary":…,"rows":[…]}
//   --agent no -o json          a BARE ARRAY:          [{…},…]           <- what we ask for
//
// It then parsed from `out.indexOf('{')` to the end of the string. Against the table rendering
// the first `{` is INSIDE A DATA VALUE, so JSON.parse was handed table text:
//
//   SyntaxError: Unexpected non-whitespace character after JSON at position 2
//     at q (scripts/schema-doc.js:50:15)      <- called from the `columns` query below
//   {}'::text[]                         │ NULL   │ …
//
// The value is `agencies.industries`, whose default is `'{}'::text[]` — the first
// brace-bearing value in information_schema.columns ordered by table_name. That crash killed
// step 1 of `npm run db:restore` on 22 September AFTER all 31 migrations had applied, leaving
// staging with a full schema and no library: DECISIONS.md §98's vacuous-pass state exactly.
//
// Two changes, and the second is the one that makes punctuation irrelevant for good:
//
//   1. PIN the rendering with `--agent no -o json`, as every other script here already does.
//      scripts/schema-doc.js was the only call site parsing output without `-o json`.
//   2. PARSE THE WHOLE STRING. Never search for a brace. A parser that hunts for punctuation
//      can always be fooled by punctuation in the data; one that parses the entire payload
//      cannot, whatever a column default happens to contain.
//
// And an unrecognised payload THROWS rather than returning []. `.rows ?? []` turned anything
// unexpected into "no rows", and a schema document that silently omits a table it could not
// read is worse than one that is not written at all.
function q(sql) {
  let out
  try {
    out = execFileSync('npx',
      ['supabase', 'db', 'query', '--project-ref', ref, '--linked', '--agent', 'no', '-o', 'json', sql],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    // stderr is captured rather than discarded: without it a failure reads only
    // "Command failed", which says nothing about which catalog query broke or why.
    const detail = String(err?.stderr || err?.stdout || err?.message || '').trim().split('\n').slice(0, 4).join('\n    ')
    throw new Error(`Catalog query failed on ${label} (${ref}):\n    ${detail}\n  SQL: ${sql.trim().split('\n')[0]}…`)
  }
  let parsed
  try {
    parsed = JSON.parse(out)
  } catch (err) {
    throw new Error(
      `Could not parse the catalog reply as JSON: ${err.message}\n` +
      `  SQL: ${sql.trim().split('\n')[0]}…\n` +
      `  First 200 bytes: ${JSON.stringify(out.slice(0, 200))}\n` +
      `  If this looks like a drawn table rather than JSON, the -o json flag has been lost.`)
  }
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows
  throw new Error(
    `Unrecognised payload from \`supabase db query\` — expected an array or an object with a ` +
    `rows array, got keys: ${JSON.stringify(Object.keys(parsed ?? {}))}. Refusing to treat it as ` +
    `an empty result.`)
}

// ---------------------------------------------------------------- the catalog
const tables = q(`select c.relname as name, obj_description(c.oid) as comment, c.relrowsecurity as rls,
       (select count(*) from pg_class c2 where false) as x
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' order by 1`)

const columns = q(`select table_name, column_name, data_type, udt_name, is_nullable, column_default,
       col_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, ordinal_position) as comment
  from information_schema.columns where table_schema='public' order by table_name, ordinal_position`)

const fks = q(`select con.conrelid::regclass::text as child, a.attname as col,
       con.confrelid::regclass::text as parent,
       case con.confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'r' then 'RESTRICT'
            when 'a' then 'NO ACTION' when 'd' then 'SET DEFAULT' else con.confdeltype::text end as on_delete
  from pg_constraint con
  join unnest(con.conkey) with ordinality k(attnum, ord) on true
  join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.attnum
 where con.contype='f' and con.connamespace='public'::regnamespace order by 1,2`)

const pks = q(`select con.conrelid::regclass::text as tbl, string_agg(a.attname, ', ' order by k.ord) as cols
  from pg_constraint con
  join unnest(con.conkey) with ordinality k(attnum, ord) on true
  join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.attnum
 where con.contype='p' and con.connamespace='public'::regnamespace group by 1 order by 1`)

const checks = q(`select conrelid::regclass::text as tbl, conname as name, pg_get_constraintdef(oid) as def
  from pg_constraint where contype='c' and connamespace='public'::regnamespace order by 1,2`)

const policies = q(`select tablename as tbl, policyname as name, cmd, roles::text as roles,
       coalesce(qual,'') as using_expr, coalesce(with_check,'') as check_expr
  from pg_policies where schemaname='public' order by 1,3,2`)

const grants = q(`select table_name as tbl, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privs
  from information_schema.role_table_grants
 where table_schema='public' and grantee in ('anon','authenticated','service_role')
 group by 1,2 order by 1,2`)

const indexes = q(`select tablename as tbl, indexname as name, indexdef as def
  from pg_indexes where schemaname='public' order by 1,2`)

const enums = q(`select t.typname as name, string_agg(e.enumlabel, ' | ' order by e.enumsortorder) as values
  from pg_type t join pg_enum e on e.enumtypid=t.oid
  join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by 1 order by 1`)

const funcs = q(`select p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as returns,
       case p.prosecdef when true then 'SECURITY DEFINER' else 'security invoker' end as security,
       obj_description(p.oid) as comment
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' order by 1`)

const views = q(`select c.relname as name, obj_description(c.oid) as comment
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('v','m') order by 1`)

const triggers = q(`select c.relname as tbl, t.tgname as name, p.proname as fn,
       case when (t.tgtype & 2) > 0 then 'BEFORE' else 'AFTER' end as timing
  from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not t.tgisinternal order by 1,2`)

const counts = q(`select relname as tbl, n_live_tup as approx_rows
  from pg_stat_user_tables where schemaname='public' order by 1`)

const migrations = q(`select version from supabase_migrations.schema_migrations order by version`)

// ------------------------------------------------- who touches what, from the repo
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules' && e !== '.next') walk(p, out) }
    else if (/\.(ts|tsx|js)$/.test(e)) out.push(p)
  }
  return out
}
const usage = {}   // table -> Set of files
for (const f of [...walk('app'), ...walk('lib'), ...walk('scripts')]) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/\.from\(['"]([a-z_]+)['"]\)/g)) {
    (usage[m[1]] ??= new Set()).add(f)
  }
}

// MODULE MAP: which part of the product each file belongs to. Derived from the path, not guessed.
const moduleOf = (f) =>
  f.startsWith('app/api/') ? `route ${f.replace('app/api/', '').replace('/route.ts', '')}`
  : f.startsWith('app/') ? `screen ${f.split('/')[1]}`
  : f.startsWith('lib/') ? `lib ${f.split('/')[1].replace(/\.ts$/, '')}`
  : `script ${f.split('/')[1].replace(/\.js$/, '')}`

const MODULES = [
  ['Compliance Workspace (M1) — research, conversations, checklists',
   ['topics', 'checklists', 'checklist_items', 'critic_reviews', 'critic_findings']],
  ['Requirements (the deterministic spine)',
   ['requirement_templates', 'switches', 'company_switches', 'switch_determinations', 'obligations',
    'obligation_evidence', 'agencies', 'industry_coverage', 'library_candidates', 'corrections']],
  ['Documents and evidence',
   ['documents', 'document_reviews', 'company_folders', 'company_templates', 'standard_templates']],
  ['Audits (M2)', ['audits', 'hr_audits']],
  ['Chemicals and substances', ['company_chemicals', 'regulated_substances']],
  ['Tenancy and accounts', ['companies', 'profiles', 'entities']],
  ['Calendar', ['calendar_events']],
  ['Worker queue', ['jobs']],
]

// ---------------------------------------------------------------- render
const by = (rows, key) => rows.reduce((m, r) => ((m[r[key]] ??= []).push(r), m), {})
const colsBy = by(columns, 'table_name'), fkBy = by(fks, 'child'), fkTo = by(fks, 'parent')
const ckBy = by(checks, 'tbl'), polBy = by(policies, 'tbl'), grBy = by(grants, 'tbl')
const ixBy = by(indexes, 'tbl'), trBy = by(triggers, 'tbl')
const pkBy = Object.fromEntries(pks.map(r => [r.tbl, r.cols]))
const cntBy = Object.fromEntries(counts.map(r => [r.tbl, r.approx_rows]))
const L = []
const p = (s = '') => L.push(s)

p('# The Database')
p('')
p(`**GENERATED — do not edit.** \`node --env-file=.env.local scripts/schema-doc.js\`, and it runs`)
p('inside `npm run db:migrate`, so it cannot be stale by more than one migration.')
p('')
p(`**Read from:** ${label} (\`${ref}\`) · **on** ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`)
p(`**Migrations applied:** ${migrations.length} — \`${migrations[0]?.version}\` to \`${migrations[migrations.length - 1]?.version}\``)
p('')
p('*Every figure here was read from the catalog of that database. Nothing is copied from the')
p('migration files, which say what was intended rather than what is there — and the two have')
p('differed (`CLAUDE.md` §3.6: default privileges grant what no GRANT statement mentions).*')
p('')
p('---')
p('')
p('## What this database is for')
p('')
p('CompliBoard tells a business what it must do to be compliant and proves it against their real')
p('documents. The schema has one organising idea, and it is worth holding while reading the rest:')
p('')
p('> **`requirement_templates` is what the law requires. `switches` is the vocabulary of facts a')
p('> business can have. `company_switches` is this business\'s answers. `obligations` is which')
p('> requirements therefore apply — computed in code, never by a model.**')
p('')
p('Everything else is either evidence that an obligation is met, a working surface over those four,')
p('or tenancy. **Tenancy is `company_id` on every data table and RLS on all of them** — never a')
p('`user_id`, and never enforced in a route alone.')
p('')
p('## Which module uses which tables')
p('')
const claimed = new Set()
for (const [name, tbls] of MODULES) {
  const present = tbls.filter(t => colsBy[t])
  present.forEach(t => claimed.add(t))
  if (present.length === 0) continue
  p(`**${name}**`)
  p('')
  for (const t of present) {
    const files = [...(usage[t] ?? [])].map(moduleOf)
    const uniq = [...new Set(files)]
    p(`- \`${t}\` — ${cntBy[t] ?? 0} rows · ${uniq.length ? 'touched by ' + uniq.slice(0, 5).join(', ') + (uniq.length > 5 ? `, +${uniq.length - 5} more` : '') : '**no code reads or writes it**'}`)
  }
  p('')
}
const unclaimed = Object.keys(colsBy).filter(t => !claimed.has(t) && tables.some(x => x.name === t))
if (unclaimed.length) {
  p(`**Not assigned to a module above:** ${unclaimed.map(t => `\`${t}\``).join(', ')}`)
  p('')
}
p('---')
p('')
p('## Every table')
p('')
for (const t of tables) {
  const name = t.name
  p(`### \`${name}\``)
  p('')
  if (t.comment) p(`${t.comment}`), p('')
  const files = [...new Set([...(usage[name] ?? [])].map(moduleOf))]
  p(`**Rows:** ${cntBy[name] ?? 0} · **RLS:** ${t.rls ? 'enabled' : '⚠ NOT ENABLED'} · **Primary key:** \`${pkBy[name] ?? '—'}\``)
  p('')
  p(files.length ? `**Read or written by:** ${files.map(f => `\`${f}\``).join(', ')}`
                 : '**Read or written by: NOTHING in app/, lib/ or scripts/.**')
  p('')
  p('| Column | Type | Null | Default |')
  p('|---|---|---|---|')
  for (const c of colsBy[name] ?? []) {
    const type = c.data_type === 'USER-DEFINED' ? `\`${c.udt_name}\` (enum)` : c.data_type
    p(`| \`${c.column_name}\` | ${type} | ${c.is_nullable === 'YES' ? 'yes' : 'no'} | ${c.column_default ? '`' + String(c.column_default).slice(0, 40) + '`' : '—'} |`)
  }
  p('')
  const out = fkBy[name] ?? [], inc = fkTo[name] ?? []
  if (out.length) { p('**Points at:**'); p(''); out.forEach(f => p(`- \`${f.col}\` → \`${f.parent}\` — ON DELETE ${f.on_delete}`)); p('') }
  if (inc.length) { p('**Pointed at by:**'); p(''); inc.forEach(f => p(`- \`${f.child}.${f.col}\` — ON DELETE ${f.on_delete}`)); p('') }
  if (ckBy[name]?.length) { p('**Constraints:**'); p(''); ckBy[name].forEach(c => p(`- \`${c.name}\` — \`${c.def}\``)); p('') }
  const g = grBy[name] ?? []
  p('**Grants** *(read from the catalog — a grant list says what was added, not what a role holds):*')
  p('')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const r = g.find(x => x.grantee === role)
    p(`- \`${role}\` — ${r ? r.privs : '**nothing**'}`)
  }
  p('')
  const pol = polBy[name] ?? []
  if (pol.length) {
    p('**RLS policies:**')
    p('')
    p('| Policy | For | Roles | USING | WITH CHECK |')
    p('|---|---|---|---|---|')
    pol.forEach(x => p(`| \`${x.name}\` | ${x.cmd} | ${x.roles.replace(/[{}]/g, '')} | ${x.using_expr ? '`' + x.using_expr.slice(0, 60) + '`' : '—'} | ${x.check_expr ? '`' + x.check_expr.slice(0, 60) + '`' : '—'} |`))
    p('')
  } else if (t.rls) {
    p('**RLS is enabled and there are NO policies** — so no role without a bypass can see a row.')
    p('')
  }
  if (trBy[name]?.length) { p('**Triggers:** ' + trBy[name].map(x => `\`${x.name}\` (${x.timing} → \`${x.fn}\`)`).join(', ')); p('') }
  if (ixBy[name]?.length) { p('**Indexes:** ' + ixBy[name].map(x => `\`${x.name}\``).join(', ')); p('') }
}
p('---')
p('')
p('## Enums')
p('')
p('| Type | Values |')
p('|---|---|')
enums.forEach(e => p(`| \`${e.name}\` | ${e.values} |`))
p('')
p('## Functions')
p('')
for (const f of funcs) {
  p(`### \`${f.name}(${f.args})\``)
  p('')
  p(`**Returns** \`${f.returns}\` · **${f.security}**`)
  p('')
  if (f.comment) p(f.comment), p('')
}
p('## Views')
p('')
if (views.length === 0) p('*None.*'), p('')
for (const v of views) { p(`### \`${v.name}\``); p(''); if (v.comment) p(v.comment), p('') }
p('## Triggers')
p('')
p('| Table | Trigger | When | Function |')
p('|---|---|---|---|')
triggers.forEach(t => p(`| \`${t.tbl}\` | \`${t.name}\` | ${t.timing} | \`${t.fn}\` |`))
p('')
p('## Migrations applied, in order')
p('')
p('```')
migrations.forEach(m => p(m.version))
p('```')
p('')

writeFileSync('docs/SCHEMA.md', L.join('\n'))
console.log(`  docs/SCHEMA.md written — ${tables.length} tables, ${enums.length} enums, ` +
            `${funcs.length} functions, ${views.length} views, ${triggers.length} triggers, ` +
            `${migrations.length} migrations.\n`)

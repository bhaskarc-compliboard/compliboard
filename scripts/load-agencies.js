// Loads supabase/seed-data/agencies.json into public.agencies. Phase 2.1.
//
//   node scripts/load-agencies.js                          validate + dry run (DEFAULT)
//   node scripts/load-agencies.js --apply                  apply to STAGING
//   node scripts/load-agencies.js --apply --production     apply to PRODUCTION
//
// SAME SHAPE AS scripts/load-requirements.js, deliberately: validate the whole file first,
// dry run by default, one statement to write, prove it landed afterwards. Two people
// reading two loaders should not have to learn two habits.
//
// WHAT IS DIFFERENT, AND IT IS THE POINT OF THIS SCRIPT:
//
// THIS ONE IS IDEMPOTENT. The requirements loader inserts into an empty table and refuses a
// populated one, because a library row carries an id that obligations pin to. Agencies are
// the opposite case — the list GROWS, a row's notes get corrected, and re-running must be
// safe and boring. So this upserts on the NATURAL KEY:
//
//     (short_name, jurisdiction_level, jurisdiction_state)
//
// which is exactly the unique constraint migration 011 added. An existing agency is
// UPDATED IN PLACE AND KEEPS ITS id, which is what lets requirement_templates.agency_id
// (Part C) survive a re-run of this script. If ids were reminted, every assignment would
// silently detach.
//
// *** NULLS NOT DISTINCT IS WHAT MAKES THAT WORK FOR THE FEDERAL ROWS. *** All 14 federal
// agencies have jurisdiction_state = NULL. Under a plain UNIQUE, NULL <> NULL, so the
// conflict arbiter would match nothing and every run would INSERT 14 more EPAs. Migration
// 011's `unique nulls not distinct` is the only reason a second run of this script is a
// no-op rather than a corruption.
//
// THE SAFE FAILURE. If the ON CONFLICT arbiter ever fails to match for some other reason,
// the result is a REFUSED INSERT from the unique constraint — loud, nothing written — not a
// quiet duplicate. That ordering is deliberate: a duplicated agency splits its
// industry_coverage into two half-rows that each look complete (CHEMICAL-OR-WA.md §1.1),
// which is the one failure here that no error message would ever announce.

import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "readline";
import { execFileSync } from "child_process";

const FILE = "supabase/seed-data/agencies.json";

// ---------------------------------------------------------------------------
// Target selection. Copied from load-requirements.js on purpose: each branch reads only
// its own variables, and there is no fallback in either direction. A typo in a flag must
// fail, never silently pick the other project.
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const isProduction = args.includes("--production");

const target = isProduction
  ? { label: "PRODUCTION", ref: process.env.SUPABASE_PROD_REF, varName: "SUPABASE_PROD_REF" }
  : { label: "staging", ref: process.env.SUPABASE_PROJECT_REF, varName: "SUPABASE_PROJECT_REF" };

function die(msg) { console.error(`\n  ${msg}\n`); process.exit(1); }

if (!existsSync(FILE)) die(`File not found: ${FILE}`);
if (!target.ref) die(`${target.varName} is not set, so the ${target.label} target cannot be resolved.`);

// Checked here, before anything is read or queried. Identical reasoning to
// load-requirements.js: SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_ROLE_KEY are EXPECTED
// TO BE BLANK in normal operation (CLAUDE.md §3.8). This is not a guard against an
// attacker; it is a guard against forgetting to clear a production service-role key off a
// laptop that also runs `npm run dev`.
if (isProduction && isApply) {
  const missing = ["SUPABASE_PROD_URL", "SUPABASE_PROD_SERVICE_ROLE_KEY"]
    .filter((v) => !String(process.env[v] ?? "").trim());
  if (missing.length) {
    die(`Cannot load to PRODUCTION: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set.\n\n` +
        `  Both are EXPECTED TO BE BLANK in normal operation — CLAUDE.md §3.8. A laptop points at\n` +
        `  staging, and production credentials live in the hosting platform's own settings.\n\n` +
        `  To load production, set both in .env.local for the duration of this one command, then\n` +
        `  CLEAR THEM AGAIN.\n\n` +
        `  Names only, never values, in anything you paste anywhere:\n` +
        `    SUPABASE_PROD_URL=https://<prod-ref>.supabase.co\n` +
        `    SUPABASE_PROD_SERVICE_ROLE_KEY=<from the dashboard, Settings -> API>`);
  }
}

function query(sql) {
  const out = execFileSync("npx", ["supabase", "db", "query", "--project-ref", target.ref,
                                   "--linked", "--agent", "no", "-o", "json", sql],
                           { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error("Unrecognised JSON shape from `supabase db query`; refusing to guess.");
}

console.log(`\n  File   : ${FILE}`);
console.log(`  Target : ${target.ref}   (${target.label})`);
console.log(`  Mode   : ${isApply ? "APPLY" : "dry run — nothing will be written"}\n`);

// ---------------------------------------------------------------------------
// Read the file.
// ---------------------------------------------------------------------------
let doc;
try { doc = JSON.parse(readFileSync(FILE, "utf8")); }
catch (e) { die(`${FILE} is not valid JSON: ${e.message}`); }
const rows = doc.agencies;
if (!Array.isArray(rows) || rows.length === 0) die(`${FILE} has no "agencies" array.`);

// ---------------------------------------------------------------------------
// The live vocabulary and the live column list. Read from the DATABASE CATALOG, never
// from a list written here — a list written here is a copy, and a copy drifts.
// ---------------------------------------------------------------------------
console.log("  Reading the live vocabulary and current rows…");
let levels, cols, existingRows;
try {
  levels = new Set(query(`select e.enumlabel as val from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'jurisdiction_layer'`).map((r) => r.val));
  cols = new Set(query(`select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'agencies'`).map((r) => r.column_name));
  existingRows = query(`select id::text as id, short_name, jurisdiction_level::text as lvl,
    coalesce(jurisdiction_state, '') as st, name, agency_type,
    coalesce(array_to_string(industries, ','), '') as inds, coalesce(notes, '') as notes,
    coalesce(review_interval, '') as ri
    from public.agencies`);
} catch (e) {
  die(`Could not read the database: ${e.message}`);
}
const key = (sn, lvl, st) => `${sn}|${lvl}|${st ?? ""}`;
const existing = new Map(existingRows.map((r) => [key(r.short_name, r.lvl, r.st), r]));
console.log(`  jurisdiction_layer: ${[...levels].join(", ")}`);
console.log(`  agencies currently holds ${existing.size} row(s)\n`);

// ---------------------------------------------------------------------------
// VALIDATION. Everything is collected; nothing short-circuits. A file with eleven
// problems should report eleven, not the first one.
// ---------------------------------------------------------------------------
const errors = [];
const warnings = [];
const at = (i) => `agencies[${i}] ${rows[i]?.short_name ? `"${rows[i].short_name}"` : "(no short_name)"}`;

const seen = new Map();
for (const [i, r] of rows.entries()) {
  // Required fields. short_name and jurisdiction_level are NOT NULL in the database since
  // migration 011; catching them here gives a row number instead of a Postgres error.
  for (const f of ["short_name", "name", "agency_type", "jurisdiction_level"]) {
    if (!String(r[f] ?? "").trim()) errors.push(`${at(i)}: ${f} is empty. It is required.`);
  }

  // Unknown columns. A typo like "jurisdiction_lvl" would otherwise be dropped silently by
  // PostgREST-shaped payloads or rejected with an opaque message.
  for (const f of Object.keys(r)) {
    if (!cols.has(f)) errors.push(`${at(i)}: "${f}" is not a column on agencies.`);
  }

  const lvl = String(r.jurisdiction_level ?? "").trim();
  if (lvl && !levels.has(lvl)) {
    errors.push(`${at(i)}: jurisdiction_level "${lvl}" is not a value of jurisdiction_layer (${[...levels].join(", ")}).`);
  }

  // The same rule migration 011's CHECK enforces, restated here so the failure names the
  // row rather than arriving as constraint violation on an insert of 33.
  const st = r.jurisdiction_state ?? null;
  if (lvl === "federal" && st !== null) {
    errors.push(`${at(i)}: federal agencies must have jurisdiction_state = null. A federal agency pinned to one state matches that state and misses every other.`);
  }
  if (["state", "county", "city", "local"].includes(lvl) && !st) {
    errors.push(`${at(i)}: jurisdiction_level "${lvl}" requires a jurisdiction_state. Without one the row matches no company in the Stage 2 query — it is invisible, not erroneous.`);
  }
  if (lvl === "county" && !r.jurisdiction_county) errors.push(`${at(i)}: jurisdiction_level = county but no jurisdiction_county.`);
  if (lvl === "city" && !r.jurisdiction_city) errors.push(`${at(i)}: jurisdiction_level = city but no jurisdiction_city.`);

  // industries[] is what makes §7 "verticals are data, not code" true. An agency serving
  // nobody is a row the pipeline will never retrieve.
  if (!Array.isArray(r.industries) || r.industries.length === 0) {
    errors.push(`${at(i)}: industries is empty. An agency tagged to no industry is never retrieved by Stage 2.`);
  }

  // The natural key, checked in the FILE before the database ever sees it.
  const k = key(r.short_name, lvl, st);
  if (seen.has(k)) errors.push(`${at(i)}: duplicate natural key (short_name, jurisdiction_level, jurisdiction_state) — also ${at(seen.get(k))}.`);
  else seen.set(k, i);

  if (r.url) {
    warnings.push(`${at(i)}: url is set. Every row ships with url = null on purpose — see the _readme in ${FILE} and TODO 2.1. If this link was checked against the live page in this session, ignore this.`);
  }
  if (!String(r.notes ?? "").trim()) {
    warnings.push(`${at(i)}: no notes. Not required, but notes is what Stage 2 reads to say what an agency's interest is.`);
  }
}

// A short_name reused across jurisdictions is legal and sometimes right; flag it so it is
// a choice rather than an accident.
const byShort = new Map();
for (const r of rows) (byShort.get(r.short_name) ?? byShort.set(r.short_name, []).get(r.short_name)).push(r);
for (const [sn, rs] of byShort) {
  if (rs.length > 1) warnings.push(`short_name "${sn}" is used by ${rs.length} rows at different jurisdictions. Legal, but check it is intended.`);
}

if (warnings.length) {
  console.log(`  ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`    · ${w}`);
  console.log("");
}
if (errors.length) {
  console.log(`  ${errors.length} error(s). NOTHING WILL BE WRITTEN:\n`);
  for (const e of errors) console.log(`    ✗ ${e}`);
  console.log("");
  process.exit(1);
}
console.log("  File is valid.\n");

// ---------------------------------------------------------------------------
// THE DIFF. This is the interesting output of a dry run and the reason a dry run is the
// default: reading it is the point of running it.
// ---------------------------------------------------------------------------
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const isNew = [], changed = [], unchanged = [];
for (const r of rows) {
  const cur = existing.get(key(r.short_name, r.jurisdiction_level, r.jurisdiction_state));
  if (!cur) { isNew.push(r); continue; }
  const fields = [];
  if (!same(cur.name, r.name)) fields.push("name");
  if (!same(cur.agency_type, r.agency_type)) fields.push("agency_type");
  if (!same(cur.inds, (r.industries ?? []).join(","))) fields.push("industries");
  if (!same(cur.notes, r.notes ?? "")) fields.push("notes");
  if (!same(cur.ri, r.review_interval ?? "")) fields.push("review_interval");
  if (fields.length) changed.push([r, fields]); else unchanged.push(r);
}
const orphans = existingRows.filter((e) => !seen.has(key(e.short_name, e.lvl, e.st)));

const line = "  " + "─".repeat(72);
console.log(line);
console.log(`  ${rows.length} agencies in the file · ${isNew.length} new · ${changed.length} changed · ${unchanged.length} unchanged`);
console.log(line + "\n");

const show = (r) => `${String(r.jurisdiction_level).padEnd(8)} ${String(r.short_name).padEnd(13)} ${String(r.agency_type).padEnd(17)} [${(r.industries ?? []).join(", ")}]`;
if (isNew.length) { console.log("  NEW:"); for (const r of isNew) console.log(`    +  ${show(r)}`); console.log(""); }
if (changed.length) { console.log("  CHANGED:"); for (const [r, f] of changed) console.log(`    ~  ${show(r)}   (${f.join(", ")})`); console.log(""); }

// An agency in the database and not in the file. NOT deleted — an agency with requirements
// or coverage rows pointing at it cannot be removed casually, and `agency_id` is
// ON DELETE SET NULL, so a delete here would silently un-assign requirements rather than
// refuse. Reported and left alone.
if (orphans.length) {
  console.log("  IN THE DATABASE BUT NOT IN THE FILE — left alone, never deleted:");
  for (const o of orphans) console.log(`    ?  ${o.lvl.padEnd(8)} ${o.short_name.padEnd(13)} ${o.name}`);
  console.log("     Deleting an agency sets requirement_templates.agency_id to NULL rather than");
  console.log("     refusing (ON DELETE SET NULL), so removing one silently un-assigns its");
  console.log("     requirements. If one of these should go, delete it deliberately and check");
  console.log("     what pointed at it first.\n");
}

if (!isApply) {
  console.log(line);
  console.log("  Dry run only. Nothing was written.");
  console.log(`  To apply:  node scripts/load-agencies.js --apply` + (isProduction ? " --production" : ""));
  console.log(line + "\n");
  process.exit(0);
}

if (isProduction) {
  console.log("\n  *** PRODUCTION LOAD ***");
  console.log("  This is the agency list Stage 2 bounds every customer answer against.");
  console.log("  Type PRODUCTION and press Enter to proceed. Anything else aborts.\n");
  if (!process.stdin.isTTY) die("Aborted: no interactive terminal. Production loads are never run unattended.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question("  > ", res));
  rl.close();
  if (answer.trim() !== "PRODUCTION") die("Aborted. Nothing was written.");
}

// ---------------------------------------------------------------------------
// WRITE — one upsert, all rows or none.
// ---------------------------------------------------------------------------
const url = isProduction ? process.env.SUPABASE_PROD_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = isProduction ? process.env.SUPABASE_PROD_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !svc) die(`No URL/service-role key for ${target.label}. This writes reference data, which only the service role may do.`);
if (!url.includes(target.ref)) die(`The ${target.label} URL points at ${url.replace("https://", "").split(".")[0]}, not ${target.ref}. Refusing to write to a project the flags did not choose.`);

const db = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });

// No `id` is ever sent. A new row gets one from gen_random_uuid(); an existing row KEEPS
// THE ONE IT HAS, because ON CONFLICT DO UPDATE updates in place. That is what lets
// requirement_templates.agency_id survive a re-run of this script.
const payload = rows.map((r) => ({
  short_name: r.short_name,
  name: r.name,
  agency_type: r.agency_type,
  jurisdiction_level: r.jurisdiction_level,
  jurisdiction_state: r.jurisdiction_state ?? null,
  jurisdiction_county: r.jurisdiction_county ?? null,
  jurisdiction_city: r.jurisdiction_city ?? null,
  industries: r.industries,
  review_interval: r.review_interval ?? null,
  url: r.url ?? null,
  phone: r.phone ?? null,
  address: r.address ?? null,
  contact_email: r.contact_email ?? null,
  notes: r.notes ?? null,
}));

console.log(`\n  Upserting ${payload.length} rows in one statement on (short_name, jurisdiction_level, jurisdiction_state)…`);
const { error } = await db
  .from("agencies")
  .upsert(payload, { onConflict: "short_name,jurisdiction_level,jurisdiction_state" });
if (error) {
  die(`UPSERT REFUSED — nothing was written: ${error.message}${error.details ? "\n  " + error.details : ""}\n\n` +
      `  If this says the ON CONFLICT specification did not match a unique index, migration 011\n` +
      `  has not been applied to ${target.label}. Apply it first: the constraint is what makes\n` +
      `  this script idempotent, and without it a second run would duplicate every federal row.`);
}

// ---------------------------------------------------------------------------
// PROVE IT LANDED — and prove re-running did not duplicate anything.
// ---------------------------------------------------------------------------
const after = query(`select
  (select count(*) from public.agencies)                                            as total,
  (select count(*) from public.agencies where jurisdiction_level = 'federal')       as federal,
  (select count(*) from public.agencies where jurisdiction_level = 'state')         as state,
  (select count(*) from public.agencies where jurisdiction_level = 'local')         as local,
  (select count(*) from public.agencies where industries @> array['chemical-manufacturing']) as chem,
  (select count(*) from public.agencies where industries @> array['cannabis'])      as cann,
  (select count(*) from public.agencies where cardinality(industries) = 0)          as no_industry,
  (select count(*) from (select short_name from public.agencies group by short_name having count(*) > 1) d) as dup_short`)[0];

const expect = {
  total: rows.length + orphans.length,
  federal: rows.filter((r) => r.jurisdiction_level === "federal").length,
  state: rows.filter((r) => r.jurisdiction_level === "state").length,
  local: rows.filter((r) => r.jurisdiction_level === "local").length,
  chem: rows.filter((r) => r.industries.includes("chemical-manufacturing")).length,
  cann: rows.filter((r) => r.industries.includes("cannabis")).length,
};

console.log("\n  Loaded:");
console.log(`    ${after.total} agencies        (expected ${expect.total})`);
console.log(`    ${after.federal} federal · ${after.state} state · ${after.local} local`);
console.log(`    ${after.chem} serve chemical-manufacturing · ${after.cann} serve cannabis`);
console.log(`    ${after.no_industry} with no industry   (must be 0)`);
console.log(`    ${after.dup_short} short_name(s) appearing more than once`);

const bad = [];
for (const k of ["total", "federal", "state", "local", "chem", "cann"]) {
  if (Number(after[k]) !== expect[k]) bad.push(`${k}: database ${after[k]}, file ${expect[k]}`);
}
if (Number(after.no_industry) !== 0) bad.push("an agency has no industry");
if (bad.length) die(`LOADED, BUT THE RESULT DOES NOT MATCH THE FILE: ${bad.join("; ")}. Investigate before trusting it.`);

console.log(`\n  Load complete on ${target.label}. Safe to re-run — this upserts on the natural key.`);
console.log("  industry_coverage is NOT populated here; that is the second half of Part C.\n");

if (isProduction) {
  console.log("  " + "=".repeat(72));
  console.log("  NOW CLEAR THE PRODUCTION CREDENTIALS FROM .env.local:");
  console.log("");
  console.log("      SUPABASE_PROD_URL=");
  console.log("      SUPABASE_PROD_SERVICE_ROLE_KEY=");
  console.log("");
  console.log("  They are expected to be blank (CLAUDE.md §3.8). This machine also runs");
  console.log("  `npm run dev`, which serves routes that delete a company and its files —");
  console.log("  a live key left in place is how an ordinary local click reaches production.");
  console.log("  " + "=".repeat(72) + "\n");
}

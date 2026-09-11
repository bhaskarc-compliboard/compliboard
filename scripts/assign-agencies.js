// Assigns requirement_templates.agency_id from supabase/seed-data/agency-mapping.json,
// then builds the industry_coverage cross product. Phase 2.1, Part C.
//
//   node scripts/assign-agencies.js                       project + dry run (DEFAULT)
//   node scripts/assign-agencies.js --apply               apply to STAGING
//   node scripts/assign-agencies.js --apply --production  apply to PRODUCTION
//
// WHY THIS IS A SCRIPT WITH A DATA FILE AND NOT A MODEL CALL.
//
// Assigning a regulator to a requirement is a lookup, not a judgement. The inputs are the
// row's jurisdiction_layer and its citation; the output is one of 33 agencies. A model
// asked to do it would be right most of the time and wrong invisibly — and a requirement
// filed under the wrong agency LOOKS ENTIRELY NORMAL. Nothing downstream complains: the
// foreign key is valid, the row renders, the count is right. So the mapping is a table a
// person can read, in a file, under version control, and this script only applies it.
//
// *** READ THE PROJECTION BY TARGET, NOT BY TOTAL. *** DECISIONS.md §33: a rule reading
// `29 CFR -> OSHA` would have filed the FLSA, the FMLA, ERISA, Title VII, the PWFA and
// EEO-1 under the Occupational Safety and Health Administration, because Title 29 is the
// whole of Labor. "187 of 194 assigned" was true of that broken mapping AND of the fixed
// one. The error was visible only in which rows landed where. That is why the dry run
// prints every agency's rows and not just its count.
//
// IDEMPOTENT. Re-running assigns the same agency to the same row. It works off the
// agencies' natural keys (short_name, jurisdiction_level, jurisdiction_state), which
// scripts/load-agencies.js preserves across re-runs, so ids never move under it.

import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "readline";
import { execFileSync } from "child_process";

const MAP_FILE = "supabase/seed-data/agency-mapping.json";

const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const isProduction = args.includes("--production");
const verbose = args.includes("--verbose");

const target = isProduction
  ? { label: "PRODUCTION", ref: process.env.SUPABASE_PROD_REF, varName: "SUPABASE_PROD_REF" }
  : { label: "staging", ref: process.env.SUPABASE_PROJECT_REF, varName: "SUPABASE_PROJECT_REF" };

function die(msg) { console.error(`\n  ${msg}\n`); process.exit(1); }

if (!existsSync(MAP_FILE)) die(`File not found: ${MAP_FILE}`);
if (!target.ref) die(`${target.varName} is not set, so the ${target.label} target cannot be resolved.`);

// Same production guard as the other two loaders, for the same reason: not a guard against
// an attacker, a guard against leaving a production service-role key on a laptop that also
// runs `npm run dev`. CLAUDE.md §3.8.
if (isProduction && isApply) {
  const missing = ["SUPABASE_PROD_URL", "SUPABASE_PROD_SERVICE_ROLE_KEY"]
    .filter((v) => !String(process.env[v] ?? "").trim());
  if (missing.length) {
    die(`Cannot assign on PRODUCTION: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set.\n\n` +
        `  Both are EXPECTED TO BE BLANK in normal operation — CLAUDE.md §3.8.\n` +
        `  Set them for the duration of this one command, then CLEAR THEM AGAIN.\n\n` +
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

console.log(`\n  Mapping: ${MAP_FILE}`);
console.log(`  Target : ${target.ref}   (${target.label})`);
console.log(`  Mode   : ${isApply ? "APPLY" : "dry run — nothing will be written"}\n`);

// ---------------------------------------------------------------------------
// Read the mapping and the two tables it joins.
// ---------------------------------------------------------------------------
let rules;
try { rules = JSON.parse(readFileSync(MAP_FILE, "utf8")).rules; }
catch (e) { die(`${MAP_FILE} is not valid JSON: ${e.message}`); }
if (!Array.isArray(rules) || !rules.length) die(`${MAP_FILE} has no "rules" array.`);

// Regexes are compiled up front. A rule that cannot compile must stop the run before
// anything is assigned, not throw halfway through 194 rows.
for (const r of rules) {
  try { r._re = new RegExp(r.citation); }
  catch (e) { die(`Rule ${r.n} has an invalid regex ${JSON.stringify(r.citation)}: ${e.message}`); }
}

let agencies, reqs;
try {
  agencies = query(`select id::text as id, short_name from public.agencies`);
  reqs = query(`select id::text as id, requirement_name as nm,
                       coalesce(jurisdiction_layer::text, '') as lay,
                       coalesce(citation, '') as cite,
                       coalesce(agency_id::text, '') as current_agency_id,
                       coalesce(jurisdiction_state, '') as st,
                       coalesce(effective_to::text, '') as retired_on,
                       industries
                  from public.requirement_templates order by requirement_name`);
} catch (e) {
  die(`Could not read the database: ${e.message}`);
}

const idByShort = new Map(agencies.map((a) => [a.short_name, a.id]));
if (!agencies.length) {
  die(`agencies is empty on ${target.label}. Run scripts/load-agencies.js --apply first —\n` +
      `  there is nothing for a requirement to point at.`);
}

// Every agency a rule names must exist. A rule pointing at a short_name that is not in the
// table would otherwise assign NULL and look identical to "no rule matched".
const unknownTargets = [...new Set(rules.filter((r) => r.agency && !idByShort.has(r.agency)).map((r) => r.agency))];
if (unknownTargets.length) {
  die(`The mapping names ${unknownTargets.length} agenc(y/ies) that do not exist on ${target.label}:\n` +
      `    ${unknownTargets.join(", ")}\n\n` +
      `  A rule pointing at a missing agency assigns nothing and is indistinguishable from\n` +
      `  a row no rule matched. Add them to supabase/seed-data/agencies.json and reload.`);
}

console.log(`  ${agencies.length} agencies · ${reqs.length} requirements · ${rules.length} rules\n`);

// ---------------------------------------------------------------------------
// PROJECT. First match wins, in file order.
// ---------------------------------------------------------------------------
const byAgency = new Map();      // short_name -> [req]
const deliberateNull = [];       // [rule, req] — matched a rule that assigns nothing
const unmatched = [];            // no rule matched at all

for (const r of reqs) {
  const rule = rules.find((x) => (x.layer === null || x.layer === r.lay) && x._re.test(r.cite));
  if (!rule) { unmatched.push(r); continue; }
  if (!rule.agency) { deliberateNull.push([rule, r]); continue; }
  if (!byAgency.has(rule.agency)) byAgency.set(rule.agency, []);
  byAgency.get(rule.agency).push(r);
  r._agency = rule.agency;
  r._rule = rule.n;
}

const assigned = [...byAgency.values()].reduce((n, v) => n + v.length, 0);
const line = "  " + "─".repeat(74);

console.log(line);
console.log(`  ${assigned} assigned across ${byAgency.size} agencies · ${deliberateNull.length} deliberate NULL · ${unmatched.length} unmatched`);
console.log(line + "\n");

// Sorted by size so the big buckets — where a systematic mis-mapping would live — are read
// first. --verbose prints every row; the default prints the small buckets in full and the
// large ones as a sample, because an unread wall of 194 lines is not a review.
for (const [ag, rows] of [...byAgency.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const live = rows.filter((r) => !r.retired_on).length;
  const note = live === rows.length ? "" : `   (${live} live, ${rows.length - live} retired — coverage counts ${live})`;
  console.log(`  ${String(rows.length).padStart(3)}  ${ag}${note}`);
  const show = verbose || rows.length <= 8 ? rows : rows.slice(0, 4);
  for (const r of show) console.log(`         r${String(r._rule).padStart(2)} [${r.lay}] ${r.nm}${r.retired_on ? `   << RETIRED ${r.retired_on}, not counted in coverage` : ""}`);
  if (show.length < rows.length) console.log(`         … ${rows.length - show.length} more (--verbose to see them)`);
}

// THE NULLS ARE PRINTED EVERY RUN, ON PURPOSE. They are expected, which is exactly how a
// list stops being read — and two of them are library-quality problems that will not fix
// themselves. An expected gap that nobody looks at is an unexamined gap.
console.log(`\n${line}`);
console.log(`  STAYING NULL — ${deliberateNull.length} rows, every run, so they do not become invisible by being expected:`);
console.log(line);
for (const [rule, r] of deliberateNull) {
  console.log(`    [${(r.lay || "none").padEnd(7)}] ${r.nm}`);
  console.log(`              ${r.cite}`);
  console.log(`              rule ${rule.n}: ${rule.why.split(". ")[0]}.`);
}

if (unmatched.length) {
  console.log(`\n  ${unmatched.length} MATCHED NO RULE AT ALL — these need a rule or a hand assignment:`);
  for (const r of unmatched) console.log(`    [${(r.lay || "none").padEnd(7)}] ${r.nm}\n              ${r.cite}`);
}

// ---------------------------------------------------------------------------
// THE COVERAGE CROSS PRODUCT.
//
// Every (industry x jurisdiction x applicable agency), not only the combinations that have
// requirements behind them. A table listing what we have covered says nothing about what we
// have missed — CHEMICAL-OR-WA.md §1.1: "a thinly-covered agency in a known list is a
// visible gap." Federal OSHA lands here at 0 rows and status not_built, which is exactly
// the row this table exists to show.
//
// jurisdiction_state on a coverage row mirrors the AGENCY's jurisdiction: NULL for a
// federal agency, the state for a state or local one. The unique key is NULLS NOT DISTINCT
// so the federal rows are one-per-agency rather than one-per-run.
//
// row_count is COMPUTED HERE from the projection, never typed. Migration 011 §6b: nothing
// recomputes it, so a hand-written value is a claim the library does not have to honour,
// and because the verified_has_rows CHECK reads row_count > 0, a typed number is what would
// let a 'verified' row exist over zero requirements.
// ---------------------------------------------------------------------------
const INDUSTRIES = ["chemical-manufacturing", "cannabis"];
const agencyRows = query(`select id::text as id, short_name, jurisdiction_level::text as lvl,
                                 coalesce(jurisdiction_state,'') as st, industries
                            from public.agencies order by short_name`);

const coverage = [];
for (const ind of INDUSTRIES) {
  for (const a of agencyRows) {
    const inds = Array.isArray(a.industries) ? a.industries : String(a.industries ?? "").replace(/[{}]/g, "").split(",").filter(Boolean);
    if (!inds.includes(ind)) continue;
    // How many requirements this projection puts under this agency FOR THIS INDUSTRY —
    // *** LIVE ROWS ONLY. A RETIRED ROW MUST NOT BE COUNTED. ***
    //
    // A retired row (effective_to set) is a row that was superseded or split. It KEEPS its
    // agency_id — see the note at the assignment step — but it is not part of what the
    // library can tell a customer today, and row_count is what the coverage strip renders.
    // Counting it inflates coverage by one for every split we have ever done: two today
    // (the boiler parent and the silica parent), and the number only grows, because
    // library rows are versioned rather than edited (CLAUDE.md §3.2) so retired rows
    // accumulate forever while live ones do not.
    //
    // Migration 011's own column comment already said "how many LIVE requirement_templates
    // rows stand behind this coverage claim". The intent was recorded and the first
    // implementation did not honour it. Caught in review before the production apply.
    const n = (byAgency.get(a.short_name) ?? []).filter((r) => {
      if (r.retired_on) return false;
      const ri = Array.isArray(r.industries) ? r.industries : String(r.industries ?? "").replace(/[{}]/g, "").split(",").filter(Boolean);
      return ri.includes(ind);
    }).length;
    coverage.push({
      industry: ind,
      jurisdiction_state: a.lvl === "federal" ? null : (a.st || null),
      agency_id: a.id,
      status: "not_built",          // NOTHING IS 'generated' OR 'verified' HERE. See below.
      row_count: n,
      _short: a.short_name,
    });
  }
}

// *** EVERY COVERAGE ROW LANDS AS not_built, INCLUDING THE ONES WITH 54 REQUIREMENTS. ***
// That is not a placeholder and it is not pessimism. `generated` and `verified` are claims
// about whether somebody checked the content, and AUDIT-CHECKS.md check 1 answers that for
// the whole library: 0 of 194 rows carry a citation_url, a citation_quote or a
// source_checked_at, and 0 are at status = 'verified'. Coverage cannot be further along
// than the requirements underneath it. row_count records what exists; status records what
// has been checked; conflating them is the omniscient status tracker (CLAUDE.md §6).
const withRows = coverage.filter((c) => c.row_count > 0).length;
console.log(`\n${line}`);
console.log(`  INDUSTRY_COVERAGE cross product: ${coverage.length} rows`);
console.log(line);
for (const ind of INDUSTRIES) {
  const rows = coverage.filter((c) => c.industry === ind);
  console.log(`\n  ${ind} — ${rows.length} agencies, ${rows.filter((r) => r.row_count > 0).length} with requirements behind them:`);
  for (const c of rows.sort((a, b) => b.row_count - a.row_count || a._short.localeCompare(b._short))) {
    const flag = c.row_count === 0 ? "   <- visible gap" : "";
    console.log(`      ${String(c.row_count).padStart(3)}  ${c._short.padEnd(13)} ${(c.jurisdiction_state ?? "(federal)").padEnd(10)} not_built${flag}`);
  }
}
console.log(`\n  ${coverage.length - withRows} of ${coverage.length} coverage rows have NOTHING behind them. That is the point of the table.`);
console.log("  All rows land at status = not_built — no row in the library is verified (AUDIT-CHECKS.md check 1).");

if (!isApply) {
  console.log(`\n${line}`);
  console.log("  Dry run only. Nothing was written.");
  console.log(`  To apply:  node scripts/assign-agencies.js --apply` + (isProduction ? " --production" : ""));
  console.log(line + "\n");
  process.exit(0);
}

if (isProduction) {
  console.log("\n  *** PRODUCTION ASSIGNMENT ***");
  console.log("  This decides which regulator every requirement is filed under, and therefore");
  console.log("  what Stage 2 bounds a customer's answer to.");
  console.log("  Type PRODUCTION and press Enter to proceed. Anything else aborts.\n");
  if (!process.stdin.isTTY) die("Aborted: no interactive terminal. Production loads are never run unattended.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question("  > ", res));
  rl.close();
  if (answer.trim() !== "PRODUCTION") die("Aborted. Nothing was written.");
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------
const url = isProduction ? process.env.SUPABASE_PROD_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = isProduction ? process.env.SUPABASE_PROD_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !svc) die(`No URL/service-role key for ${target.label}.`);
if (!url.includes(target.ref)) die(`The ${target.label} URL points at ${url.replace("https://", "").split(".")[0]}, not ${target.ref}. Refusing to write to a project the flags did not choose.`);
const db = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });

// RETIRED ROWS ARE ASSIGNED AN AGENCY, DELIBERATELY. A row with effective_to set is not
// deleted and never will be — CLAUDE.md §3.2, library rows are versioned, never edited in
// place, so that an audit pinned to a version stays reproducible. An audit that resolved
// against the silica parent last year must still be able to say WHICH REGULATOR that
// requirement belonged to; a NULL agency on a retired row would make last year's answer
// less explicable than it was at the time. Provenance is the whole reason the row survives.
// What retired rows must NOT do is count toward coverage — see the row_count filter above.
//
// One UPDATE per agency rather than one per row: 24 statements instead of 187, and each one
// is a whole agency's worth of rows moving together. A partial failure leaves some agencies
// assigned and others not, which the verification below detects and reports rather than
// glossing — and because the mapping is idempotent, the fix is to re-run.
console.log(`\n  Assigning agency_id for ${assigned} requirements in ${byAgency.size} statements…`);
for (const [ag, rows] of byAgency) {
  const { error } = await db
    .from("requirement_templates")
    .update({ agency_id: idByShort.get(ag) })
    .in("id", rows.map((r) => r.id));
  if (error) die(`UPDATE for ${ag} failed: ${error.message}\n  Some agencies may already be assigned. Re-run — this script is idempotent.`);
}

// The NULLs are written as NULL explicitly rather than left alone, so a row that USED to
// have an agency and no longer matches a rule is cleared rather than silently keeping a
// stale assignment. That is the difference between a mapping and an accumulation.
const nullIds = [...deliberateNull.map(([, r]) => r.id), ...unmatched.map((r) => r.id)];
if (nullIds.length) {
  const { error } = await db.from("requirement_templates").update({ agency_id: null }).in("id", nullIds);
  if (error) die(`Clearing agency_id on ${nullIds.length} unassigned rows failed: ${error.message}`);
}

console.log(`  Upserting ${coverage.length} industry_coverage rows…`);
const { error: covErr } = await db
  .from("industry_coverage")
  .upsert(coverage.map(({ _short, ...c }) => c), { onConflict: "industry,jurisdiction_state,agency_id" });
if (covErr) {
  die(`industry_coverage upsert refused — agency_id assignments above DID land: ${covErr.message}\n` +
      `  ${covErr.details ?? ""}\n  Re-run to finish; both halves are idempotent.`);
}

// ---------------------------------------------------------------------------
// PROVE IT — against the projection, per agency, refusing to claim success on a mismatch.
// ---------------------------------------------------------------------------
const actual = query(`select a.short_name as sn, count(t.id)::int as n
  from public.agencies a left join public.requirement_templates t on t.agency_id = a.id
 group by a.short_name`);
const actualBy = new Map(actual.map((r) => [r.sn, Number(r.n)]));

const mismatches = [];
for (const [ag, rows] of byAgency) {
  if (actualBy.get(ag) !== rows.length) mismatches.push(`${ag}: projected ${rows.length}, database ${actualBy.get(ag) ?? 0}`);
}
for (const [sn, n] of actualBy) {
  if (n > 0 && !byAgency.has(sn)) mismatches.push(`${sn}: projected 0, database ${n}`);
}

const totals = query(`select
   (select count(*) from public.requirement_templates)                          as total,
   (select count(agency_id) from public.requirement_templates)                  as with_agency,
   (select count(*) from public.industry_coverage)                              as coverage,
   (select count(*) from public.industry_coverage where status <> 'not_built')  as cov_claimed,
   (select coalesce(sum(row_count),0) from public.industry_coverage)            as cov_rowsum`)[0];

console.log("\n  Result:");
console.log(`    ${totals.with_agency} of ${totals.total} requirements have an agency   (projected ${assigned})`);
console.log(`    ${Number(totals.total) - Number(totals.with_agency)} left NULL              (projected ${deliberateNull.length + unmatched.length})`);
console.log(`    ${totals.coverage} industry_coverage rows        (projected ${coverage.length})`);
console.log(`    ${totals.cov_claimed} coverage rows claiming more than not_built   (must be 0)`);

// Recompute every row_count straight from the library, with the live filter, and compare to
// what was stored. This is the check that would have caught the retired-row bug had it
// existed before the bug did.
const recount = query(`with truth as (
    select a.short_name as sn, i.ind as industry, count(t.id) as n
      from public.agencies a
      cross join lateral unnest(a.industries) as i(ind)
      left join public.requirement_templates t
             on t.agency_id = a.id and t.industries @> array[i.ind] and t.effective_to is null
     group by 1, 2)
  select a.short_name as sn, c.industry as ind, c.row_count::int as stored, tr.n::int as live
    from public.industry_coverage c
    join public.agencies a on a.id = c.agency_id
    join truth tr on tr.sn = a.short_name and tr.industry = c.industry
   where c.row_count <> tr.n`);
for (const r of recount) mismatches.push(`row_count ${r.ind}/${r.sn}: stored ${r.stored}, live rows ${r.live}`);

if (Number(totals.with_agency) !== assigned) mismatches.push(`total assigned: projected ${assigned}, database ${totals.with_agency}`);
if (Number(totals.coverage) !== coverage.length) mismatches.push(`coverage rows: projected ${coverage.length}, database ${totals.coverage}`);
if (Number(totals.cov_claimed) !== 0) mismatches.push(`${totals.cov_claimed} coverage row(s) are not not_built`);

if (mismatches.length) {
  die(`APPLIED, BUT THE DATABASE DOES NOT MATCH THE PROJECTION:\n    ${mismatches.join("\n    ")}\n\n` +
      `  Do not trust the assignment until this is explained. Re-running is safe.`);
}

console.log(`\n  Every agency's count matches the projection exactly. Assignment complete on ${target.label}.`);
console.log("  Obligations are NOT regenerated — that is Phase 4.1 and it does not exist yet.\n");

if (isProduction) {
  console.log("  " + "=".repeat(72));
  console.log("  NOW CLEAR THE PRODUCTION CREDENTIALS FROM .env.local:\n");
  console.log("      SUPABASE_PROD_URL=");
  console.log("      SUPABASE_PROD_SERVICE_ROLE_KEY=\n");
  console.log("  They are expected to be blank (CLAUDE.md §3.8).");
  console.log("  " + "=".repeat(72) + "\n");
}

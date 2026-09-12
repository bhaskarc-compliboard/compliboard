// Loads supabase/seed-data/switches.json into public.switches. Phase 6.2.
//
//   node scripts/load-switches.js                          validate + dry run (DEFAULT)
//   node scripts/load-switches.js --apply                  apply to STAGING
//   node scripts/load-switches.js --apply --production     apply to PRODUCTION
//   node scripts/load-switches.js --prove-cycle-check      seed a deliberate cycle and
//                                                          confirm the check refuses it
//
// Same shape as load-agencies.js: validate everything first, dry run by default, one
// statement to write, prove it landed. Idempotent on the primary key, so an existing switch
// is updated in place and keeps every company_switches row pointing at it.
//
// *** WHY THIS SCRIPT CONTAINS A GRAPH WALK. ***
//
// `switches.depends_on_switch` is a self-referencing foreign key, and the only constraint
// on it is `switches_no_self_dependency`, which checks `depends_on_switch IS DISTINCT FROM
// id`. That stops A -> A. IT DOES NOT STOP A -> B -> A: both rows exist, both foreign keys
// resolve, and Postgres accepts it.
//
// A cycle cannot be expressed as a CHECK constraint — detecting one needs recursion, and a
// CHECK sees one row at a time. It could be a trigger with a recursive CTE, but a trigger
// fires per statement and would have to re-walk the whole graph on every write; this table
// is written by exactly one thing, which is this file. So the check lives here, and it
// refuses the whole file rather than loading half of it — the same rule as
// load-requirements.js.
//
// THE PAIR THAT NEARLY CYCLED, because it shows the failure is not theoretical:
// `oil_storage_aboveground_gallons` cannot be known without knowing the tanks, so it
// depends on `aboveground_storage_tanks`. And the AST inspection requirement's trigger
// reads "ASTs subject to SPCC", which argues the reverse. Both readings are locally
// correct. DECISIONS.md §37 settles the direction; this check is what makes the settlement
// enforceable rather than remembered.

import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "readline";
import { execFileSync } from "child_process";

const FILE = "supabase/seed-data/switches.json";

const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const isProduction = args.includes("--production");
const proveCycle = args.includes("--prove-cycle-check");

const target = isProduction
  ? { label: "PRODUCTION", ref: process.env.SUPABASE_PROD_REF, varName: "SUPABASE_PROD_REF" }
  : { label: "staging", ref: process.env.SUPABASE_PROJECT_REF, varName: "SUPABASE_PROJECT_REF" };

function die(msg) { console.error(`\n  ${msg}\n`); process.exit(1); }

if (!existsSync(FILE)) die(`File not found: ${FILE}`);
if (!target.ref) die(`${target.varName} is not set, so the ${target.label} target cannot be resolved.`);

if (isProduction && isApply) {
  const missing = ["SUPABASE_PROD_URL", "SUPABASE_PROD_SERVICE_ROLE_KEY"]
    .filter((v) => !String(process.env[v] ?? "").trim());
  if (missing.length) {
    die(`Cannot load to PRODUCTION: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set.\n\n` +
        `  Both are EXPECTED TO BE BLANK in normal operation — CLAUDE.md §3.8. Set them for the\n` +
        `  duration of this one command, then CLEAR THEM AGAIN.\n\n` +
        `    SUPABASE_PROD_URL=https://<prod-ref>.supabase.co\n` +
        `    SUPABASE_PROD_SERVICE_ROLE_KEY=<dashboard -> Settings -> API>`);
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

let doc;
try { doc = JSON.parse(readFileSync(FILE, "utf8")); }
catch (e) { die(`${FILE} is not valid JSON: ${e.message}`); }
const rows = doc.switches;
if (!Array.isArray(rows) || rows.length === 0) die(`${FILE} has no "switches" array.`);

// ---------------------------------------------------------------------------
// THE CYCLE CHECK. Depth-first walk over depends_on_switch, reporting the whole cycle
// rather than just "a cycle exists" — a two-node cycle is easy to see and a five-node one
// is not, and the fix needs to know which edge to reverse.
// ---------------------------------------------------------------------------
export function findCycles(list) {
  const parent = new Map(list.map((s) => [s.id, s.depends_on_switch || null]));
  const cycles = [];
  const state = new Map(); // id -> 'visiting' | 'done'

  for (const start of parent.keys()) {
    if (state.get(start)) continue;
    const path = [];
    let node = start;
    while (node && !state.get(node)) {
      state.set(node, "visiting");
      path.push(node);
      node = parent.get(node) ?? null;
    }
    if (node && state.get(node) === "visiting") {
      // We walked back into the path we are building: everything from `node` onward is the cycle.
      const cycle = path.slice(path.indexOf(node));
      cycles.push([...cycle, node]);
    }
    for (const p of path) state.set(p, "done");
  }
  return cycles;
}

// ---------------------------------------------------------------------------
// PROVING THE CYCLE CHECK FIRES.
//
// AUDIT-CHECKS.md's standard: a sweep that has only ever said "clean" is untested — it is
// indistinguishable from one that is walking the wrong field, and it will keep saying
// "clean" through that too. This check has only ever run against a file with no cycle in
// it, so it has to be shown refusing one.
//
// Runs entirely in memory, BEFORE any database read, and touches nothing.
// ---------------------------------------------------------------------------
if (proveCycle) {
  console.log("  PROVING THE CYCLE CHECK — in memory, no database, nothing written.\n");

  const clean = findCycles(rows);
  console.log(`  1. the real seed file (${rows.length} switches, ${rows.filter((s) => s.depends_on_switch).length} edges)`);
  console.log(`     cycles found: ${clean.length}   ${clean.length === 0 ? "✅ acyclic, as expected" : "❌ " + clean.map((c) => c.join(" -> ")).join("; ")}`);

  // The two-node case, which is the one the database permits: A -> B -> A satisfies every
  // foreign key and switches_no_self_dependency, because neither row points at itself.
  // This is the exact pair described in DECISIONS.md §37.
  const two = JSON.parse(JSON.stringify(rows));
  const tanks = two.find((s) => s.id === "aboveground_storage_tanks");
  tanks.depends_on_switch = "oil_storage_aboveground_gallons";
  tanks.depends_on_value = "true";
  const twoCycles = findCycles(two);
  console.log(`\n  2. the real pair, reversed — "ASTs subject to SPCC" read as a switch dependency`);
  console.log(`     aboveground_storage_tanks -> oil_storage_aboveground_gallons -> aboveground_storage_tanks`);
  console.log(`     cycles found: ${twoCycles.length}   ${twoCycles.length ? "✅ REFUSED" : "❌ MISSED — the check does not work"}`);
  for (const c of twoCycles) console.log(`       ${c.join(" -> ")}`);

  // A three-node cycle, to show it is a real graph walk and not a pairwise comparison.
  const three = JSON.parse(JSON.stringify(rows));
  const a = three.find((s) => s.id === "respirator_use");
  const b = three.find((s) => s.id === "emergency_respirators_present");
  const c3 = three.find((s) => s.id === "confined_spaces_present");
  a.depends_on_switch = "confined_spaces_present"; a.depends_on_value = "true";
  c3.depends_on_switch = "emergency_respirators_present"; c3.depends_on_value = "true";
  void b;
  const threeCycles = findCycles(three);
  console.log(`\n  3. a three-node cycle, to show it walks the graph rather than comparing pairs`);
  console.log(`     cycles found: ${threeCycles.length}   ${threeCycles.length ? "✅ REFUSED" : "❌ MISSED"}`);
  for (const c of threeCycles) console.log(`       ${c.join(" -> ")}`);

  // And a long chain that does NOT cycle, so the check is not just flagging any depth.
  const chain = [
    { id: "x1", depends_on_switch: "x2" }, { id: "x2", depends_on_switch: "x3" },
    { id: "x3", depends_on_switch: "x4" }, { id: "x4", depends_on_switch: null },
  ];
  const chainCycles = findCycles(chain);
  console.log(`\n  4. a four-deep chain with no cycle — the negative control`);
  console.log(`     cycles found: ${chainCycles.length}   ${chainCycles.length === 0 ? "✅ correctly allowed" : "❌ FALSE POSITIVE"}`);

  const ok = clean.length === 0 && twoCycles.length > 0 && threeCycles.length > 0 && chainCycles.length === 0;
  console.log(`\n  ${ok ? "The cycle check refuses a cycle and permits a chain." : "THE CYCLE CHECK IS NOT WORKING."}\n`);
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------------------
// VALIDATION. Everything collected; nothing short-circuits.
// ---------------------------------------------------------------------------
let cols, enums, existing;
console.log("  Reading the live vocabularies and current rows…");
try {
  cols = new Set(query(`select column_name from information_schema.columns
    where table_schema='public' and table_name='switches'`).map((r) => r.column_name));
  const enumRows = query(`select t.typname as ty, e.enumlabel as val
    from pg_type t join pg_enum e on e.enumtypid=t.oid
    join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname like 'switch%'`);
  enums = {};
  for (const e of enumRows) (enums[e.ty] ||= new Set()).add(e.val);
  existing = new Map(query(`select id, label, scope::text as scope from public.switches`).map((r) => [r.id, r]));
} catch (e) {
  die(`Could not read the database: ${e.message}`);
}

if (!cols.has("thresholds")) {
  die(`switches has no \`thresholds\` column on ${target.label}.\n` +
      `  That arrives with migration 012. Apply it first — the seed carries thresholds for\n` +
      `  6 numeric switches and they are what makes the gate's proximity confirmation possible.`);
}
console.log(`  ${Object.keys(enums).length} switch vocabularies · ${existing.size} switches currently in the table\n`);

const errors = [];
const warnings = [];
const seen = new Map();
const at = (i) => `switches[${i}]${rows[i]?.id ? ` "${rows[i].id}"` : ""}`;

for (const [i, s] of rows.entries()) {
  for (const f of ["id", "label", "scope", "value_type", "determination_source", "volatility"]) {
    if (!String(s[f] ?? "").trim()) errors.push(`${at(i)}: ${f} is required and is empty.`);
  }
  for (const f of Object.keys(s)) if (!cols.has(f)) errors.push(`${at(i)}: "${f}" is not a column on switches.`);

  if (seen.has(s.id)) errors.push(`${at(i)}: duplicate id, also ${at(seen.get(s.id))}.`);
  else seen.set(s.id, i);

  // Enum values checked against the LIVE CATALOG, never a list written here.
  const chk = (field, ty) => {
    const v = String(s[field] ?? "").trim();
    if (v && enums[ty] && !enums[ty].has(v))
      errors.push(`${at(i)}: ${field} "${v}" is not a value of ${ty} (${[...enums[ty]].join(", ")}).`);
  };
  chk("scope", "switch_scope");
  chk("value_type", "switch_value_type");
  chk("determination_source", "switch_determination_source");
  chk("volatility", "switch_volatility");

  if (s.value_type === "enum" && (!Array.isArray(s.allowed_values) || s.allowed_values.length === 0))
    errors.push(`${at(i)}: value_type is enum but allowed_values is empty. The database refuses this too (switches_enum_has_values), but a row number is more use than a constraint name.`);
  if (s.value_type !== "enum" && Array.isArray(s.allowed_values) && s.allowed_values.length > 0)
    warnings.push(`${at(i)}: allowed_values set on a non-enum switch. Harmless, and probably a mistake.`);

  // Thresholds: the migration 012 rules, restated so a failure names the switch.
  if (s.thresholds != null) {
    if (s.value_type !== "number")
      errors.push(`${at(i)}: thresholds set but value_type is "${s.value_type}". Only a number carries thresholds — the numbers would never be consulted.`);
    if (!Array.isArray(s.thresholds) || s.thresholds.some((n) => typeof n !== "number"))
      errors.push(`${at(i)}: thresholds must be an array of numbers.`);
    else {
      for (let k = 1; k < s.thresholds.length; k++)
        if (s.thresholds[k] <= s.thresholds[k - 1])
          errors.push(`${at(i)}: thresholds must be ascending and distinct — ${s.thresholds[k - 1]} then ${s.thresholds[k]}. Everything downstream reads them positionally.`);
    }
  } else if (s.value_type === "number") {
    warnings.push(`${at(i)}: a number switch with no thresholds. Nothing can then tell whether its value is near anything — see DETERMINATION-GATE.md §11.`);
  }

  // The dependency pair is all-or-nothing, and the target must exist in THIS file.
  const hasSw = !!s.depends_on_switch, hasVal = !!s.depends_on_value;
  if (hasSw !== hasVal)
    errors.push(`${at(i)}: depends_on_switch and depends_on_value must both be set or both null.`);
  if (s.depends_on_switch === s.id)
    errors.push(`${at(i)}: depends on itself.`);

  if (!String(s.question_plain ?? "").trim())
    warnings.push(`${at(i)}: no question_plain. The gate then writes the question itself, so the same fact gets asked three different ways across three sessions.`);
}

for (const [i, s] of rows.entries()) {
  if (s.depends_on_switch && !seen.has(s.depends_on_switch))
    errors.push(`${at(i)}: depends_on_switch "${s.depends_on_switch}" is not in this file.`);
}

// THE CYCLE CHECK, run over the file before anything is written.
const cycles = findCycles(rows);
for (const c of cycles) {
  errors.push(
    `DEPENDENCY CYCLE: ${c.join(" -> ")}\n` +
    `    No constraint can catch this. switches_no_self_dependency stops A -> A only; a\n` +
    `    cycle through two or more rows satisfies every foreign key and is accepted by the\n` +
    `    database. A cycle makes the graph unwalkable: nothing can decide which fact to\n` +
    `    establish first, so the gate would either loop or pick arbitrarily.\n` +
    `    Decide which of these is the INVENTORY fact and which is COMPUTED from it, and\n` +
    `    reverse the other edge — DECISIONS.md §37 for the worked example.`);
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
console.log("  File is valid. Dependency graph is acyclic.\n");

// ---------------------------------------------------------------------------
// THE SHAPE OF WHAT IS ABOUT TO LAND
// ---------------------------------------------------------------------------
const line = "  " + "─".repeat(76);
const count = (f) => rows.reduce((m, s) => ((m[s[f]] = (m[s[f]] || 0) + 1), m), {});
const isNew = rows.filter((s) => !existing.has(s.id));
const changed = rows.filter((s) => existing.has(s.id) &&
  (existing.get(s.id).label !== s.label || existing.get(s.id).scope !== s.scope));
const orphans = [...existing.keys()].filter((id) => !seen.has(id));

console.log(line);
console.log(`  ${rows.length} switches · ${isNew.length} new · ${changed.length} changed · ${rows.length - isNew.length - changed.length} unchanged`);
console.log(line);
const show = (label, o) => console.log(`  ${label.padEnd(14)} ${Object.entries(o).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
show("scope", count("scope"));
show("value_type", count("value_type"));
show("volatility", count("volatility"));
show("source", count("determination_source"));
console.log(`  thresholds     ${rows.filter((s) => s.thresholds).length} numeric switches carry them`);
console.log(`  dependencies   ${rows.filter((s) => s.depends_on_switch).length} edges, ${cycles.length} cycles`);
console.log(`  unused         ${rows.filter((s) => /SEEDED BUT UNUSED/.test(s.notes ?? "")).length} marked seeded-but-unused`);
console.log(line + "\n");

const byDomain = {};
for (const s of rows) (byDomain[s.domain ?? "(none)"] ||= []).push(s);
for (const [dom, list] of Object.entries(byDomain)) {
  console.log(`  ${dom.toUpperCase()}  (${list.length})`);
  for (const s of list) {
    const dep = s.depends_on_switch ? `  ←${s.depends_on_switch}=${s.depends_on_value}` : "";
    const th = s.thresholds ? `  [${s.thresholds.join(", ")}]` : "";
    console.log(`     ${s.scope.padEnd(8)}${s.volatility.padEnd(8)}${s.value_type.padEnd(9)}${s.id}${th}${dep}`);
  }
  console.log("");
}

if (orphans.length) {
  console.log(`  IN THE DATABASE BUT NOT IN THE FILE — left alone, never deleted (${orphans.length}):`);
  for (const o of orphans) console.log(`     ${o}`);
  console.log(`     Deleting a switch sets depends_on_switch to NULL on its children rather than`);
  console.log(`     refusing, and company_switches rows would lose their target. Remove one`);
  console.log(`     deliberately, after checking what points at it.\n`);
}

if (!isApply) {
  console.log(line);
  console.log("  Dry run only. Nothing was written.");
  console.log(`  To apply:  node scripts/load-switches.js --apply` + (isProduction ? " --production" : ""));
  console.log(line + "\n");
  process.exit(0);
}

if (isProduction) {
  console.log("\n  *** PRODUCTION LOAD ***");
  console.log("  This is the vocabulary of facts the product will ask customers about.");
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
if (!url || !svc) die(`No URL/service-role key for ${target.label}. This writes reference data, which only the service role may do.`);
if (!url.includes(target.ref)) die(`The ${target.label} URL points at ${url.replace("https://", "").split(".")[0]}, not ${target.ref}. Refusing to write to a project the flags did not choose.`);
const db = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });

// TWO PASSES, and the order is load-bearing. depends_on_switch is a foreign key to this
// same table, so a single insert can violate it depending on row order. Pass 1 writes every
// row with the dependency NULL; pass 2 sets the dependencies once every target exists.
const payload = rows.map((s) => ({
  id: s.id, label: s.label, scope: s.scope, value_type: s.value_type,
  allowed_values: s.allowed_values ?? [], thresholds: s.thresholds ?? null,
  question_plain: s.question_plain ?? null, determination_source: s.determination_source,
  volatility: s.volatility, jurisdiction_variant: !!s.jurisdiction_variant,
  depends_on_switch: null, depends_on_value: null,
  domain: s.domain ?? null, notes: s.notes || null,
}));

console.log(`\n  Pass 1 — upserting ${payload.length} switches with dependencies unset…`);
const { error: e1 } = await db.from("switches").upsert(payload, { onConflict: "id" });
if (e1) die(`UPSERT REFUSED — nothing was written: ${e1.message}${e1.details ? "\n  " + e1.details : ""}`);

const withDeps = rows.filter((s) => s.depends_on_switch);
console.log(`  Pass 2 — setting ${withDeps.length} dependency edges…`);
for (const s of withDeps) {
  const { error } = await db.from("switches")
    .update({ depends_on_switch: s.depends_on_switch, depends_on_value: s.depends_on_value })
    .eq("id", s.id);
  if (error) die(`Setting the dependency for "${s.id}" failed: ${error.message}\n  Pass 1 landed; re-run to finish. This script is idempotent.`);
}

// ---------------------------------------------------------------------------
// PROVE IT
// ---------------------------------------------------------------------------
const after = query(`select
  (select count(*) from public.switches)                                   as total,
  (select count(*) from public.switches where scope = 'site')              as site,
  (select count(*) from public.switches where scope = 'company')           as company,
  (select count(*) from public.switches where thresholds is not null)      as with_thresholds,
  (select count(*) from public.switches where depends_on_switch is not null) as with_deps,
  (select count(*) from public.switches where volatility <> 'static')      as non_static,
  (select count(*) from public.switches where question_plain is null)      as no_question`)[0];

console.log("\n  Loaded:");
console.log(`    ${after.total} switches            (expected ${rows.length + orphans.length})`);
console.log(`    ${after.site} site · ${after.company} company`);
console.log(`    ${after.with_thresholds} carry thresholds    (expected ${rows.filter((s) => s.thresholds).length})`);
console.log(`    ${after.with_deps} dependency edges    (expected ${withDeps.length})`);
console.log(`    ${after.non_static} non-static          (expected ${rows.filter((s) => s.volatility !== "static").length})`);
console.log(`    ${after.no_question} with no question_plain`);

// And re-walk the graph as the DATABASE holds it, not as the file described it. A partial
// pass 2 would leave a different graph from the one that was validated.
const live = query(`select id, depends_on_switch from public.switches`);
const liveCycles = findCycles(live.map((r) => ({ id: r.id, depends_on_switch: r.depends_on_switch })));

const bad = [];
if (Number(after.total) !== rows.length + orphans.length) bad.push(`row count: database ${after.total}, expected ${rows.length + orphans.length}`);
if (Number(after.with_thresholds) !== rows.filter((s) => s.thresholds).length) bad.push("threshold count");
if (Number(after.with_deps) !== withDeps.length) bad.push(`dependency count: database ${after.with_deps}, file ${withDeps.length}`);
if (liveCycles.length) bad.push(`the LIVE graph contains ${liveCycles.length} cycle(s): ${liveCycles.map((c) => c.join(" -> ")).join("; ")}`);
if (bad.length) die(`LOADED, BUT THE RESULT DOES NOT MATCH THE FILE: ${bad.join("; ")}. Investigate before trusting it.`);

console.log(`\n  Dependency graph re-walked from the database: acyclic.`);
console.log(`  Load complete on ${target.label}. Safe to re-run.`);
console.log("  company_switches is NOT populated here — that is determination at runtime, not a seed.\n");

if (isProduction) {
  console.log("  " + "=".repeat(72));
  console.log("  NOW CLEAR THE PRODUCTION CREDENTIALS FROM .env.local:\n");
  console.log("      SUPABASE_PROD_URL=");
  console.log("      SUPABASE_PROD_SERVICE_ROLE_KEY=\n");
  console.log("  They are expected to be blank (CLAUDE.md §3.8).");
  console.log("  " + "=".repeat(72) + "\n");
}

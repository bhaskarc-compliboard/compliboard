// Loads a filled requirements worksheet into requirement_templates.
//
//   node scripts/load-requirements.js <file.xlsx>                    validate + dry run
//   node scripts/load-requirements.js <file.xlsx> --apply            apply to STAGING
//   node scripts/load-requirements.js <file.xlsx> --apply --production   apply to PRODUCTION
//
// THE RULE THIS SCRIPT EXISTS FOR: validate everything, then write, and never the
// other way round. Every check below runs against the whole file before a single row
// is sent. One failure anywhere refuses the entire file. There is no partial load and
// no --force, because a half-applied library is worse than an unapplied one — the rows
// that landed look identical to the rows that were always there, and nothing on the
// screen says which is which.
//
// A dry run is the DEFAULT. Applying takes a second, explicit command. That is
// deliberate: the interesting output of this script is the diff, and reading it is the
// point of running it.
//
// Enum values are checked against the LIVE DATABASE CATALOG, never against a list
// written here. A list written here is a copy, and a copy drifts — the whole reason
// migration 006 exists is that hand-kept vocabularies had already drifted three ways.

import { readFileSync, existsSync } from "fs";
import { createInterface } from "readline";
import { execFileSync } from "child_process";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Target selection. Same strict separation as scripts/db-migrate.js: each branch
// reads only its own variables, and there is no fallback in either direction.
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const isApply = args.includes("--apply");
const isProduction = args.includes("--production");

const target = isProduction
  ? { label: "PRODUCTION", ref: process.env.SUPABASE_PROD_REF, varName: "SUPABASE_PROD_REF" }
  : { label: "staging", ref: process.env.SUPABASE_PROJECT_REF, varName: "SUPABASE_PROJECT_REF" };

if (!file) die("Usage: node scripts/load-requirements.js <file.xlsx> [--apply] [--production]");
if (!existsSync(file)) die(`File not found: ${file}`);
if (!target.ref) die(`${target.varName} is not set, so the ${target.label} target cannot be resolved.`);

function die(msg) { console.error(`\n  ${msg}\n`); process.exit(1); }

function query(sql) {
  const out = execFileSync("npx", ["supabase", "db", "query", "--project-ref", target.ref,
                                   "--linked", "--agent", "no", "-o", "json", sql],
                           { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const parsed = JSON.parse(out);
  // The CLI emits two shapes depending on agent detection. Handle both, and treat
  // anything else as a failure rather than as an empty result — reading an unknown
  // payload as "no rows" is what cost two aborted production migrations on 10 Sep.
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error("Unrecognised JSON shape from `supabase db query`; refusing to guess.");
}

console.log(`\n  File   : ${file}`);
console.log(`  Target : ${target.ref}   (${target.label})`);
console.log(`  Mode   : ${isApply ? "APPLY" : "dry run — nothing will be written"}\n`);

// ---------------------------------------------------------------------------
// Read the sheet.
// ---------------------------------------------------------------------------
const wb = XLSX.read(readFileSync(file), { type: "buffer" });
if (!wb.SheetNames.includes("Requirements")) die('No sheet named "Requirements" in this workbook.');
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Requirements"], { defval: "" });
if (rows.length === 0) die("The Requirements sheet has no rows.");

const S = (r, f) => String(r[f] ?? "").trim();
const has = (r, f) => S(r, f) !== "";

// ---------------------------------------------------------------------------
// The live vocabularies, and the ids that are actually in the database.
// ---------------------------------------------------------------------------
console.log("  Reading the live vocabularies and current rows…");
let vocab, dbIds, tableCols;
try {
  const enumRows = query(`select t.typname as ty, e.enumlabel as val
    from pg_type t join pg_enum e on e.enumtypid=t.oid
    join pg_namespace n on n.oid=t.typnamespace where n.nspname='public'`);
  vocab = {};
  for (const e of enumRows) (vocab[e.ty] ||= new Set()).add(e.val);
  dbIds = new Set(query("select id::text as id from public.requirement_templates").map((r) => r.id));
  tableCols = new Set(query(`select column_name from information_schema.columns
    where table_schema='public' and table_name='requirement_templates'`).map((r) => r.column_name));
} catch (e) {
  die(`Could not read the database: ${e.message}`);
}
console.log(`  ${Object.keys(vocab).length} vocabularies, ${dbIds.size} rows currently in requirement_templates\n`);

// ---------------------------------------------------------------------------
// VALIDATION. Everything is collected; nothing short-circuits. A file with eleven
// problems should report eleven, not the first one — otherwise fixing it is eleven
// round trips.
// ---------------------------------------------------------------------------
const errors = [];
const warnings = [];
const at = (i) => `row ${i + 2}`; // +2: header is row 1, sheets are 1-indexed

const byName = new Map();
for (const [i, r] of rows.entries()) {
  const n = S(r, "requirement_name");
  if (!n) { errors.push(`${at(i)}: requirement_name is empty.`); continue; }
  if (byName.has(n)) errors.push(`${at(i)}: duplicate requirement_name "${n}" (also ${at(byName.get(n))}). It is the key rows are matched on, so it must be unique.`);
  else byName.set(n, i);
}

const enumCol = {
  category: "obligation_type", entity_type: "entity_scope", applies: "applies_mode",
  priority: "requirement_priority", status: "verification_status",
  source_type: "requirement_source_type", jurisdiction_layer: "jurisdiction_layer",
};
const REQUIRED = ["requirement_name", "category", "entity_type", "source_type",
                  "citation", "applies", "priority", "status", "generated_by", "industries", "version"];
const DATE_COLS = ["effective_from", "effective_to", "verified_at", "source_checked_at"];

const seenIds = new Map();
let retiredParents = [], children = [], newRows = [], updates = [];

for (const [i, r] of rows.entries()) {
  const name = S(r, "requirement_name") || "(unnamed)";
  const isChild = has(r, "split_from");
  const isRetired = has(r, "effective_to");

  for (const f of REQUIRED) if (!has(r, f)) errors.push(`${at(i)} "${name}": ${f} is empty and is required.`);

  // Enum values, against the catalog.
  for (const [col, ty] of Object.entries(enumCol)) {
    const v = S(r, col);
    if (v === "") continue;
    if (!vocab[ty]) { errors.push(`${at(i)}: no such type ${ty} in the database — is migration 006 applied to ${target.label}?`); continue; }
    if (!vocab[ty].has(v)) errors.push(`${at(i)} "${name}": ${col} = "${v}" is not a permitted value. Allowed: ${[...vocab[ty]].join(", ")}.`);
  }
  if (has(r, "generated_by") && !["ai", "manual"].includes(S(r, "generated_by")))
    errors.push(`${at(i)} "${name}": generated_by = "${S(r,'generated_by')}" — must be ai or manual.`);

  // jurisdiction_layer may be blank ONLY on a contractual row, and a contractual row
  // must be blank. A registrar contract is not territorial (DECISIONS.md §21.2).
  const layer = S(r, "jurisdiction_layer"), stype = S(r, "source_type");
  if (layer === "" && stype !== "contractual")
    errors.push(`${at(i)} "${name}": jurisdiction_layer is blank but source_type is "${stype}". Blank is valid only where source_type = contractual.`);
  if (stype === "contractual" && layer !== "")
    errors.push(`${at(i)} "${name}": source_type is contractual but jurisdiction_layer = "${layer}". A contract has no jurisdiction — leave it blank.`);
  if (layer === "county" && !has(r, "jurisdiction_county"))
    errors.push(`${at(i)} "${name}": jurisdiction_layer = county but jurisdiction_county is empty. Which county?`);
  if (layer === "city" && !has(r, "jurisdiction_city"))
    errors.push(`${at(i)} "${name}": jurisdiction_layer = city but jurisdiction_city is empty. Which city?`);
  if (layer === "state" && !has(r, "jurisdiction_state"))
    errors.push(`${at(i)} "${name}": jurisdiction_layer = state but jurisdiction_state is empty.`);

  for (const c of DATE_COLS)
    if (has(r, c) && !/^\d{4}-\d{2}-\d{2}$/.test(S(r, c)))
      errors.push(`${at(i)} "${name}": ${c} = "${S(r,c)}" is not a YYYY-MM-DD date.`);

  if (has(r, "version") && !/^\d+$/.test(S(r, "version")))
    errors.push(`${at(i)} "${name}": version = "${S(r,'version')}" must be a whole number.`);

  // id: present means it must be a real row; blank means it must be a split child.
  const id = S(r, "id");
  if (id) {
    if (seenIds.has(id)) errors.push(`${at(i)} "${name}": id ${id} also appears at ${at(seenIds.get(id))}.`);
    else seenIds.set(id, i);
    if (!dbIds.has(id)) errors.push(`${at(i)} "${name}": id ${id} is not in requirement_templates on ${target.label}. Ids are not invented here.`);
    if (isChild) warnings.push(`${at(i)} "${name}": has both an id and a split_from. Treated as an existing row that records its origin, not as a new row.`);
  } else {
    if (!isChild) errors.push(`${at(i)} "${name}": id is blank and split_from is empty. A new row must say which row it was split from.`);
    newRows.push(i);
  }

  if (isRetired) retiredParents.push(i);
  if (isChild) children.push(i);
  if (id && !isRetired) updates.push(i);
}

// --- the two split rules -----------------------------------------------------
// A child must name a parent that EXISTS in this file and is RETIRED. A child
// pointing at a live parent means the split was left half-done: the duty would be
// counted twice, once under the parent and once under the child.
for (const i of children) {
  const parentName = S(rows[i], "split_from");
  const name = S(rows[i], "requirement_name");
  if (!byName.has(parentName)) {
    errors.push(`${at(i)} "${name}": split_from names "${parentName}", which is not a requirement_name anywhere in this file.`);
    continue;
  }
  const p = rows[byName.get(parentName)];
  if (!has(p, "effective_to"))
    errors.push(`${at(i)} "${name}": split_from names "${parentName}", but that row has no effective_to — it is still live. A split is only finished when the parent is retired, otherwise the duty is counted twice.`);
  if (parentName === name)
    errors.push(`${at(i)} "${name}": split_from names itself.`);
}

// A retired parent must have at least one child. Retiring a row with nothing
// replacing it silently deletes a requirement from the library.
for (const i of retiredParents) {
  const name = S(rows[i], "requirement_name");
  const kids = children.filter((c) => S(rows[c], "split_from") === name);
  if (kids.length === 0)
    errors.push(`${at(i)} "${name}": effective_to is set but no row names it in split_from. Retiring a requirement with nothing replacing it removes it from the library — if that is intended, it is a deletion and not a split.`);
  else if (kids.length === 1)
    warnings.push(`${at(i)} "${name}": retired with only ONE child. A one-to-one split is a rename; check that is what you meant.`);
}

// --- nothing lost ------------------------------------------------------------
const fileIds = new Set([...seenIds.keys()]);
for (const id of dbIds)
  if (!fileIds.has(id))
    errors.push(`Row ${id} exists in requirement_templates on ${target.label} but appears nowhere in this file. Every existing row must be accounted for — this load replaces the library, so an absent row would be silently dropped.`);

// --- can the target even take this? -----------------------------------------
const need = ["source_type", "jurisdiction_layer", "generated_by", "scope_rules",
              "effective_from", "effective_to", "supersedes_id", "version",
              "cadence_type", "cadence_anchor", "produces_switch", "industries",
              "jurisdiction_city", "evidence_types"];
const missingCols = need.filter((c) => !tableCols.has(c));

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------
const line = "  " + "-".repeat(74);
console.log(line);
console.log(`  ${rows.length} rows read.`);
console.log(`    ${updates.length} existing rows to update`);
console.log(`    ${retiredParents.length} rows to retire (effective_to set)`);
console.log(`    ${newRows.length} new rows from splits`);
console.log(`    ${rows.length - retiredParents.length} would be active after loading`);
console.log(line);

if (warnings.length) {
  console.log(`\n  ${warnings.length} warning(s) — these do not block a load:\n`);
  for (const w of warnings) console.log(`    ~ ${w}`);
}

if (errors.length) {
  console.log(`\n  ${errors.length} ERROR(S). THE FILE IS REFUSED IN FULL — nothing was written.\n`);
  for (const e of errors.slice(0, 40)) console.log(`    x ${e}`);
  if (errors.length > 40) console.log(`    … and ${errors.length - 40} more.`);
  console.log("\n  Fix the file and run again. There is no partial load on purpose.\n");
  process.exit(1);
}

console.log("\n  VALIDATION PASSED — every check, on every row.\n");

// --- the diff ---------------------------------------------------------------
const dist = (f, subset) => {
  const d = {};
  for (const r of subset ?? rows) { const k = S(r, f) || "(blank)"; d[k] = (d[k] || 0) + 1; }
  return Object.entries(d).sort((a, b) => b[1] - a[1]);
};
const active = rows.filter((r) => !has(r, "effective_to"));

console.log("  Category — empty before this pass, now (active rows only):");
for (const [k, n] of dist("category", active)) console.log(`    ${String(n).padStart(4)}  ${k}`);

console.log("\n  Priority — before: critical 62 / high 96 / standard 30");
console.log("             after (active rows only):");
for (const [k, n] of dist("priority", active)) console.log(`    ${String(n).padStart(4)}  ${k}`);

console.log("\n  Jurisdiction layer (active rows only):");
for (const [k, n] of dist("jurisdiction_layer", active)) console.log(`    ${String(n).padStart(4)}  ${k}`);

const ct = dist("cadence_type", active).filter(([k]) => k !== "(blank)");
console.log(`\n  cadence_type — free text this pass, ${ct.length} distinct value(s) used:`);
if (ct.length === 0) console.log("    (none used — nothing to build the enum from yet)");
for (const [k, n] of ct) console.log(`    ${String(n).padStart(4)}  ${k}`);

console.log("\n  Splits:");
for (const i of retiredParents) {
  const name = S(rows[i], "requirement_name");
  console.log(`    RETIRE  ${name}   (effective_to ${S(rows[i], "effective_to")})`);
  for (const c of children.filter((c) => S(rows[c], "split_from") === name))
    console.log(`      + NEW  [${S(rows[c], "category").padEnd(16)}] ${S(rows[c], "requirement_name")}`);
}

// ---------------------------------------------------------------------------
// APPLY — or say precisely why it cannot happen yet.
// ---------------------------------------------------------------------------
if (missingCols.length) {
  console.log(`\n${line}`);
  console.log(`  THE FILE IS VALID. THE TARGET SCHEMA IS NOT READY FOR IT.\n`);
  console.log(`  requirement_templates on ${target.label} is missing ${missingCols.length} of the columns`);
  console.log(`  this file carries:\n`);
  console.log(`    ${missingCols.join(", ")}\n`);
  console.log("  Those columns arrive with migration 007, the spine rebuild. Until then this");
  console.log("  file can be validated but not loaded, and --apply will refuse.\n");
  console.log("  This is the right order: the worksheet proves what 007 has to support.\n");
  if (isApply) process.exit(1);
  process.exit(0);
}

if (!isApply) {
  console.log(`\n${line}`);
  console.log("  Dry run only. Nothing was written.");
  console.log(`  To apply:  node scripts/load-requirements.js ${file} --apply` + (isProduction ? " --production" : ""));
  console.log(line + "\n");
  process.exit(0);
}

if (isProduction) {
  console.log("\n  *** PRODUCTION LOAD ***");
  console.log("  This replaces the requirement library that customers are served from.");
  console.log("  Type PRODUCTION and press Enter to proceed. Anything else aborts.\n");
  if (!process.stdin.isTTY) die("Aborted: no interactive terminal. Production loads are never run unattended.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question("  > ", res));
  rl.close();
  if (answer.trim() !== "PRODUCTION") die("Aborted. Nothing was written.");
}

die("Apply is not implemented yet — it is written with migration 007, against the " +
    "schema that exists then. Validation and the dry run are complete and are what " +
    "this file is for today.");

// WRITES THE REQUIREMENT WORKSHEET FROM THE LIVE LIBRARY.
//
//   node --env-file=.env.local scripts/export-requirements.js            dry run
//   node --env-file=.env.local scripts/export-requirements.js --write    replace the worksheet
//
// The other direction of scripts/load-requirements.js, and it exists because the two
// directions stopped agreeing. DECISIONS.md §118: migration 013 split three requirements
// into eleven children INSIDE A MIGRATION, so those eleven rows lived in the database and
// in a .sql file and in no seed file. A from-zero rebuild lost them silently — 013 looks
// its parents up by name in a table the chain has not loaded yet, finds nothing, and its
// own verification block then passes on the empty table.
//
// THE STANDING RULE THAT CAME OUT OF IT: requirement content changes go through the
// worksheet and load-requirements.js, never through a migration. This script exists to
// make the worksheet true again after that rule was broken once — not as a routine step.
// If you find yourself running it, ask what put content in a migration.
//
// ---------------------------------------------------------------------------
// TWO COLUMNS ARE DELIBERATELY EXPORTED BLANK, AND THAT IS THE POINT.
//
//   agency_id           owned by scripts/assign-agencies.js  (restore step 4)
//   applies_expression  owned by supabase/seed-data/applies-expressions.json (step 5)
//
// Both are absent from the worksheet today and both must stay absent. Writing them here
// would put a second source of truth in the file — the exact failure this script is
// cleaning up — and agency_id would also break the load order, since requirements load at
// step 2 and the agencies they would point at do not exist until step 3.
// ---------------------------------------------------------------------------
//
// READ-ONLY against the database. It issues one SELECT and writes one file.

import { readFileSync, readdirSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_DIR = join(ROOT, "supabase/seed-data");
const OUT = join(SEED_DIR, "REQUIREMENTS.xlsx");

const args = process.argv.slice(2);
const write = args.includes("--write");
const isProduction = args.includes("--production");

const die = (m) => { console.error(`\n  ${m}\n`); process.exit(1); };

const ref = isProduction ? process.env.SUPABASE_PROD_REF : process.env.SUPABASE_PROJECT_REF;
if (!ref) die(`${isProduction ? "SUPABASE_PROD_REF" : "SUPABASE_PROJECT_REF"} is not set.`);

// THE COLUMN LIST IS THE OLD WORKSHEET'S, IN ITS ORDER, READ OFF THE OLD WORKSHEET.
// Not typed here: a hand-typed list is a copy of a header row, and the header row is what
// scripts/load-requirements.js reads by name. Whatever file is in seed-data now defines
// the shape of the file this writes.
const existing = readdirSync(SEED_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));
if (existing.length !== 1) {
  die(`Expected exactly one .xlsx in ${relative(ROOT, SEED_DIR)}, found ${existing.length}: ${existing.join(", ")}\n` +
      `  This script takes its column list and its Reference/Notes sheets from the file it replaces.`);
}
const SRC = join(SEED_DIR, existing[0]);
const srcBook = XLSX.read(readFileSync(SRC), { type: "buffer" });
if (!srcBook.SheetNames.includes("Requirements")) die(`No "Requirements" sheet in ${existing[0]}.`);
const COLUMNS = XLSX.utils.sheet_to_json(srcBook.Sheets["Requirements"], { header: 1 })[0].map(String);
const srcRows = XLSX.utils.sheet_to_json(srcBook.Sheets["Requirements"], { defval: "" });

// category_current is the pre-enum human category. It exists ONLY in the worksheet —
// `requirement_templates` has no such column — so it cannot be exported from the database
// and is instead carried across by requirement_name. Rows the old file never had come out
// blank rather than guessed.
const categoryCurrent = new Map(
  srcRows.map((r) => [String(r.requirement_name ?? "").trim(), String(r.category_current ?? "").trim()]));

console.log(`\n  Source : ${ref}   (${isProduction ? "PRODUCTION" : "staging"})`);
console.log(`  Shape  : ${relative(ROOT, SRC)} — ${COLUMNS.length} columns, ${srcRows.length} rows`);
console.log(`  Out    : ${relative(ROOT, OUT)}`);
console.log(`  Mode   : ${write ? "*** WRITE ***" : "dry run — nothing will be written"}\n`);

const out = execFileSync("npx", ["supabase", "db", "query", "--project-ref", ref, "--linked",
                                 "--agent", "no", "-o", "json",
  `select r.*, p.requirement_name as split_from_name
     from public.requirement_templates r
     left join public.requirement_templates p on p.id = r.split_from_id
    order by r.requirement_name`],
  { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const parsed = JSON.parse(out);
const live = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : null;
if (live === null) die("Unrecognised JSON shape from `supabase db query`; refusing to guess.");
if (!live.length) die("The library is EMPTY on this target. There is nothing to export.");

// ---------------------------------------------------------------------------
// One database row -> one sheet row, in the loader's own conventions.
//
// Every rule below is the inverse of a line in scripts/load-requirements.js. Arrays are
// semicolon-joined because `arr()` splits on ";". Booleans are TRUE/FALSE because `bool()`
// accepts "TRUE" and the old file used it. Blank means NULL because `nul()` reads "" as
// null — and a cell holding the four characters "null" would load as the STRING "null".
// ---------------------------------------------------------------------------
const arr = (v) => (Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v));
const txt = (v) => (v === null || v === undefined ? "" : String(v));

const rows = live.map((r) => {
  const cell = {};
  for (const col of COLUMNS) {
    switch (col) {
      case "split_from":         cell[col] = txt(r.split_from_name); break;
      case "category_current":   cell[col] = categoryCurrent.get(String(r.requirement_name).trim()) ?? ""; break;
      case "is_determination":   cell[col] = r.is_determination ? "TRUE" : "FALSE"; break;
      case "industries":
      case "secondary_agency_ids":
      case "evidence_types":     cell[col] = arr(r[col]); break;
      // Owned elsewhere — see the header. Exported blank on purpose.
      case "agency_id":
      case "applies_expression": cell[col] = ""; break;
      default:                   cell[col] = txt(r[col]); break;
    }
  }
  return cell;
});

// ---------------------------------------------------------------------------
// PROVE IT ROUND-TRIPS, BEFORE IT IS WRITTEN.
//
// Every one of these is a rule load-requirements.js enforces. Checking them here means a
// refusal costs a re-run of this script rather than a refused restore with the library
// already replaced.
// ---------------------------------------------------------------------------
const problems = [];
const byName = new Map(rows.map((r, i) => [r.requirement_name, i]));
if (byName.size !== rows.length) problems.push("duplicate requirement_name — it is the key rows are matched on.");

for (const [i, r] of rows.entries()) {
  const at = `row ${i + 2} "${r.requirement_name}"`;
  if (!r.id) problems.push(`${at}: no id. Every exported row carries its database identity.`);
  if (r.split_from) {
    const p = rows[byName.get(r.split_from)];
    if (!p) problems.push(`${at}: split_from "${r.split_from}" names no row in this file.`);
    else if (!p.effective_to) problems.push(`${at}: its parent "${r.split_from}" is not retired.`);
  }
  if (r.effective_to && !rows.some((x) => x.split_from === r.requirement_name))
    problems.push(`${at}: retired with no child naming it — that is a deletion, not a split.`);
  for (const d of ["effective_from", "effective_to", "verified_at", "source_checked_at"])
    if (r[d] && !/^\d{4}-\d{2}-\d{2}$/.test(r[d])) problems.push(`${at}: ${d} = "${r[d]}" is not YYYY-MM-DD.`);
  if (r.version && !/^\d+$/.test(String(r.version))) problems.push(`${at}: version "${r.version}" is not a whole number.`);
  if (!["ai", "manual"].includes(r.generated_by)) problems.push(`${at}: generated_by = "${r.generated_by}".`);
  const layer = r.jurisdiction_layer, stype = r.source_type;
  if (layer === "" && stype !== "contractual") problems.push(`${at}: jurisdiction_layer blank but source_type is "${stype}".`);
  if (stype === "contractual" && layer !== "") problems.push(`${at}: contractual row carries jurisdiction_layer "${layer}".`);
  if (layer === "county" && !r.jurisdiction_county) problems.push(`${at}: layer county, no jurisdiction_county.`);
  if (layer === "city" && !r.jurisdiction_city) problems.push(`${at}: layer city, no jurisdiction_city.`);
  if (layer === "state" && !r.jurisdiction_state) problems.push(`${at}: layer state, no jurisdiction_state.`);
}

const retired = rows.filter((r) => r.effective_to).length;
const children = rows.filter((r) => r.split_from).length;
const noCatCurrent = rows.filter((r) => !r.category_current).length;

console.log(`  ${rows.length} rows · ${retired} retired · ${children} carrying split_from · ${rows.length - retired} live`);
console.log(`  ${noCatCurrent} row(s) with no category_current (not in the old worksheet; the column is worksheet-only)`);
console.log(`  agency_id and applies_expression exported BLANK by design — steps 4 and 5 own them\n`);

if (problems.length) {
  console.log(`  ${problems.length} PROBLEM(S). NOTHING WAS WRITTEN:\n`);
  for (const p of problems.slice(0, 40)) console.log(`    x ${p}`);
  if (problems.length > 40) console.log(`    … and ${problems.length - 40} more.`);
  console.log("");
  process.exit(1);
}
console.log("  Every round-trip rule load-requirements.js enforces: passed.\n");

if (!write) {
  console.log(`  Dry run only. To write:  node --env-file=.env.local scripts/export-requirements.js --write\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// WRITE. Reference and Notes are carried over from the file being replaced — they are the
// human half of this artifact (what each enum means, how to fill a row) and nothing in the
// database can regenerate them.
// ---------------------------------------------------------------------------
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows, { header: COLUMNS }), "Requirements");

for (const name of srcBook.SheetNames) {
  if (name === "Requirements") continue;
  const grid = XLSX.utils.sheet_to_json(srcBook.Sheets[name], { header: 1, defval: "" });
  if (name === "Notes") {
    grid.push([""], ["REGENERATED FROM THE LIVE LIBRARY — see DECISIONS.md §118"],
      [`Written by scripts/export-requirements.js from ${ref} on ${new Date().toISOString().slice(0, 10)}.`],
      ["Migration 013 split three requirements into eleven children inside a migration, so those"],
      ["eleven rows existed in the database and in no seed file, and a from-zero rebuild lost them."],
      ["This file now carries all of them, parents retired and children naming their parent."],
      [""],
      ["THE RULE: requirement content changes go through this worksheet and load-requirements.js,"],
      ["never through a migration."],
      [""],
      ["agency_id and applies_expression are blank on purpose. scripts/assign-agencies.js and"],
      ["supabase/seed-data/applies-expressions.json own them; a value here would be a second source."]);
  }
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), name);
}

XLSX.writeFile(book, OUT);
console.log(`  Wrote ${relative(ROOT, OUT)} — ${rows.length} rows, ${book.SheetNames.length} sheets (${book.SheetNames.join(", ")}).`);
if (existsSync(SRC) && SRC !== OUT) {
  console.log(`\n  ${relative(ROOT, SRC)} is now the OLD file and must be deleted — scripts/db-restore.js`);
  console.log(`  refuses to guess between two worksheets. Git keeps it.\n`);
}

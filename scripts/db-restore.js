// REBUILDS STAGING FROM SOURCE, IN ONE COMMAND.
//
//   npm run db:restore
//
// TODO.md 0.10; DECISIONS.md §98. `npm run db:reset` produces a correct, EMPTY database —
// the chain rebuilds the SCHEMA, not the DATABASE. Everything a question reasons against
// (the requirement library, the agencies, the switches, the expressions) comes from
// scripts reading supabase/seed-data/, and `drop table … cascade` removes all of it.
// Putting it back was eight commands, which is why a reset was avoided, which is why §3.7
// was skipped once. A rule that is expensive to obey is a rule that gets skipped. This
// makes it cheap.
//
// ---------------------------------------------------------------------------
// IT VERIFIES AFTER EVERY STEP AND REFUSES TO CONTINUE ON ZERO ROWS.
//
// That is the requirement, not a nicety. §98: a refusal at step 6 leaves `switches` empty,
// the determination gate reads an empty vocabulary, and every check that follows PASSES
// VACUOUSLY — against a database with no library in it. A restore that stops loudly in the
// middle is worth more than one that completes quietly.
//
// EVERY EXPECTED NUMBER IS READ FROM THE SEED FILES. Not one is typed here. A hardcoded 95
// is a copy, and a copy drifts (DECISIONS.md §43) — the drift would be silent, because a
// restore comparing a wrong number against itself agrees with itself. Where a step has no
// honest file-derived expectation, it says so and guards only against zero.
// ---------------------------------------------------------------------------
//
// STAGING ONLY, AND THERE IS NO FLAG THAT CHANGES THAT. It does not accept --production,
// it refuses if the target ref is SUPABASE_PROD_REF, and it refuses if the migration
// target and the write target are not the same project. Step 1 refuses production twice
// more on its own account (scripts/db-migrate.js, by flag and by ref), and every loader
// requires --production explicitly, which this never passes.

import { readdirSync, readFileSync, existsSync } from "fs";
import { spawnSync, execFileSync } from "child_process";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

import { PLAN } from "./fixtures/staging-testdata.js";
import { COMPANY_FACTS, SITE_FACTS } from "./fixtures/multisite.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_DIR = join(ROOT, "supabase/seed-data");
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");
const rel = (p) => relative(ROOT, p);

const OK = "  OK";
let stepNo = 0;

function die(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

function rule(char = "─") {
  console.log("  " + char.repeat(76));
}

// ---------------------------------------------------------------------------
// 0. REFUSE PRODUCTION, BEFORE ANYTHING IS READ OR RUN.
//
// Three independent refusals, because each catches a different mistake: a typed flag, a
// .env.local pointed at the wrong project, and a .env.local where the migration target
// and the write target have drifted apart. The third is not hypothetical paranoia —
// step 1 migrates by SUPABASE_PROJECT_REF and steps 2-8 write by
// NEXT_PUBLIC_SUPABASE_URL. If those two name different projects, this command resets one
// database and seeds another, and both halves look like they worked.
// ---------------------------------------------------------------------------

const prodFlag = process.argv.slice(2).find((a) => /^--prod/i.test(a));
if (prodFlag) {
  die(`REFUSED: "${prodFlag}" is not a flag this command has.\n\n` +
      `  db:restore drops every table in the public schema and reloads the library and the\n` +
      `  test fixtures. There is no circumstance in which that is the right thing to do to\n` +
      `  production — the data IS the product. Staging is what this is for.`);
}

const stagingRef = process.env.SUPABASE_PROJECT_REF;
const prodRef = process.env.SUPABASE_PROD_REF;
const writeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const writeRef = writeUrl.replace("https://", "").split(".")[0];

if (!stagingRef) die("SUPABASE_PROJECT_REF is not set, so there is no target to restore.");
if (!writeRef) die("NEXT_PUBLIC_SUPABASE_URL is not set, so the loaders have nowhere to write.");

if (prodRef && stagingRef === prodRef) {
  die(`REFUSED: SUPABASE_PROJECT_REF and SUPABASE_PROD_REF are the same project (${prodRef}).\n\n` +
      `  Staging and production must be separate Supabase projects. Fix .env.local.`);
}
if (prodRef && writeRef === prodRef) {
  die(`REFUSED: NEXT_PUBLIC_SUPABASE_URL points at ${writeRef}, which is SUPABASE_PROD_REF.\n\n` +
      `  The loaders write through that URL. Fix .env.local.`);
}
if (writeRef !== stagingRef) {
  die(`REFUSED: the two halves of this command target different projects.\n\n` +
      `    step 1 migrates  ${stagingRef}   (SUPABASE_PROJECT_REF)\n` +
      `    steps 2-8 write  ${writeRef}   (NEXT_PUBLIC_SUPABASE_URL)\n\n` +
      `  One database would be emptied and a different one seeded, and both halves would\n` +
      `  report success. Fix .env.local so both name the same project.`);
}

const REF = stagingRef;

// ---------------------------------------------------------------------------
// Reading the database. The Supabase CLI rather than the JS client, because some of what
// this asks for is catalog (CLAUDE.md §3.7) and because it needs no service-role key.
// ---------------------------------------------------------------------------

function query(sql) {
  const out = execFileSync(
    "npx",
    ["supabase", "db", "query", "--project-ref", REF, "--linked", "--agent", "no", "-o", "json", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const parsed = JSON.parse(out);
  // Two shapes, decided by the CLI's agent detection. Anything else is a failure and not
  // an empty result — reading an unknown payload as "no rows" is how a populated database
  // reports zero (scripts/db-migrate.js, extractRows).
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
  throw new Error("Unrecognised JSON shape from `supabase db query`; refusing to guess.");
}

/** One scalar, as a number. Throws rather than returning 0 when the query returns nothing. */
function scalar(sql) {
  const rows = query(`select (${sql})::int as n`);
  if (!rows.length || rows[0].n === null || rows[0].n === undefined) {
    throw new Error(`No value came back for: ${sql}`);
  }
  return Number(rows[0].n);
}

// ---------------------------------------------------------------------------
// 1. THE SOURCES, AND WHAT THEY SAY THE ANSWER SHOULD BE.
//
// Every expectation below is a number computed from a file on disk, with the file named
// beside it so the operator can go and look. Nothing is typed.
// ---------------------------------------------------------------------------

function readJson(name) {
  const path = join(SEED_DIR, name);
  if (!existsSync(path)) die(`Seed file missing: ${rel(path)}`);
  return { path, data: JSON.parse(readFileSync(path, "utf8")) };
}

// The worksheet is found, not named. One .xlsx in seed-data is the library; two is an
// ambiguity the operator has to resolve, and zero is a missing source. Naming a filename
// here would be a fifth place the date in REQUIREMENTS-FILLED-<date>.xlsx has to be kept
// right (CLAUDE.md §9a: copy names from the artifact, never compose one).
const xlsxNames = readdirSync(SEED_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));
if (xlsxNames.length === 0) die(`No .xlsx in ${rel(SEED_DIR)} — the requirement library has no source.`);
if (xlsxNames.length > 1) {
  die(`${xlsxNames.length} .xlsx files in ${rel(SEED_DIR)}:\n` +
      xlsxNames.map((f) => `    - ${f}`).join("\n") +
      `\n\n  Which one is the library? Leave exactly one here and archive the rest.`);
}
const XLSX_PATH = join(SEED_DIR, xlsxNames[0]);
const wb = XLSX.read(readFileSync(XLSX_PATH), { type: "buffer" });
if (!wb.SheetNames.includes("Requirements")) die(`No sheet named "Requirements" in ${rel(XLSX_PATH)}.`);
const sheet = XLSX.utils.sheet_to_json(wb.Sheets["Requirements"], { defval: "" });
const cell = (r, f) => String(r[f] ?? "").trim();

const agenciesFile = readJson("agencies.json");
const switchesFile = readJson("switches.json");
const expressionsFile = readJson("applies-expressions.json");

const agencies = agenciesFile.data.agencies;
const switches = switchesFile.data.switches;
const expressions = expressionsFile.data;

// The coverage cross product is (industry x agency), for every agency that serves that
// industry. The industries come out of agencies.json itself — the union of what the
// agencies claim to serve — rather than from a list typed here. scripts/assign-agencies.js
// holds the same list as a literal (INDUSTRIES, line 197); if the two ever disagree, this
// reports a mismatch at step 4, which is the point of computing it rather than copying it.
const industries = [...new Set(agencies.flatMap((a) => a.industries ?? []))];
const coverageRows = industries.reduce(
  (n, ind) => n + agencies.filter((a) => (a.industries ?? []).includes(ind)).length, 0);

const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

const EXPECT = {
  migrations:   { n: migrationFiles.length,                              from: rel(MIGRATIONS_DIR) + "/*.sql" },
  requirements: { n: sheet.length,                                       from: rel(XLSX_PATH) + " — Requirements sheet" },
  agencies:     { n: agencies.length,                                    from: rel(agenciesFile.path) },
  coverage:     { n: coverageRows,                                       from: rel(agenciesFile.path) + ` — ${industries.length} industries x their agencies` },
  expressions:  { n: expressions.filter((x) => x.expression).length,     from: rel(expressionsFile.path) + " — entries carrying an expression" },
  switches:     { n: switches.length,                                    from: rel(switchesFile.path) },
  switchEdges:  { n: switches.filter((s) => s.depends_on_switch).length, from: rel(switchesFile.path) + " — depends_on_switch" },
  companies:    { n: PLAN.length,                                        from: "scripts/fixtures/staging-testdata.js" },
  profiles:     { n: PLAN.reduce((t, c) => t + c.people.length, 0),      from: "scripts/fixtures/staging-testdata.js" },
  facts:        { n: COMPANY_FACTS.length + Object.values(SITE_FACTS).flat().length,
                                                                         from: "scripts/fixtures/multisite.js" },
};
// Every company gets a primary site from migration 010's trigger; the multisite fixture
// adds exactly one more.
EXPECT.entitiesAfter7 = { n: EXPECT.companies.n, from: EXPECT.companies.from + " — one primary site each (migration 010)" };
EXPECT.entitiesAfter8 = { n: EXPECT.companies.n + 1, from: EXPECT.companies.from + " + scripts/fixtures/multisite.js — one added site" };

console.log(`\n  RESTORE — ${REF}   (staging)\n`);
rule("=");
console.log("  THE SOURCES, AND THE COUNT EACH ONE SAYS TO EXPECT");
rule("=");
for (const [key, e] of Object.entries(EXPECT)) {
  console.log(`  ${String(e.n).padStart(5)}  ${key.padEnd(15)} ${e.from}`);
}

// ---------------------------------------------------------------------------
// 2. ARE THE SOURCES CONSISTENT WITH EACH OTHER?
//
// Checked BEFORE anything is dropped, because the alternative is finding out at step 5 —
// with the library already replaced and the expressions refused, leaving staging with a
// library and no applies_expression on any row. The restore would have destroyed more than
// it rebuilt and stopped halfway with no way back.
// ---------------------------------------------------------------------------

console.log("");
rule("=");
console.log("  DO THE SOURCES AGREE WITH EACH OTHER?");
rule("=");

const liveInSheet = new Set(sheet.filter((r) => cell(r, "effective_to") === "")
                                 .map((r) => cell(r, "requirement_name")));
const switchIds = new Set(switches.map((s) => s.id));

const orphanExpressions = expressions.filter((x) => !liveInSheet.has(x.requirement));

function switchesIn(expr, found = new Set()) {
  if (!expr || typeof expr !== "object") return found;
  if (typeof expr.switch === "string") found.add(expr.switch);
  for (const v of Object.values(expr)) {
    if (Array.isArray(v)) v.forEach((c) => switchesIn(c, found));
    else if (v && typeof v === "object") switchesIn(v, found);
  }
  return found;
}
const unknownSwitches = new Set();
for (const x of expressions) {
  for (const s of switchesIn(x.expression)) if (!switchIds.has(s)) unknownSwitches.add(s);
}

const inconsistencies = [];
if (orphanExpressions.length) {
  inconsistencies.push(
    `${orphanExpressions.length} of ${expressions.length} entries in ${rel(expressionsFile.path)} name a\n` +
    `  requirement that ${rel(XLSX_PATH)} does not carry as live:\n` +
    orphanExpressions.map((x) => `      - ${x.requirement}`).join("\n") + "\n\n" +
    `  Step 5 (load-expressions.js) validates every entry against the live library and\n` +
    `  refuses the whole file on one failure. It would refuse AFTER step 2 had already\n` +
    `  replaced the library.`);
}
if (unknownSwitches.size) {
  inconsistencies.push(
    `${unknownSwitches.size} switch id(s) referenced by an expression are not in\n` +
    `  ${rel(switchesFile.path)}: ${[...unknownSwitches].join(", ")}`);
}

if (inconsistencies.length) {
  console.log(`  ${inconsistencies.length} problem(s).\n`);
  for (const i of inconsistencies) console.log(`  ✗ ${i}\n`);
} else {
  console.log("  The worksheet, the expressions and the switches agree.");
}

// ---------------------------------------------------------------------------
// 3. WHAT IS THERE NOW, AND WHAT WILL COME BACK.
//
// The projection the operator needs before typing RESET. Three kinds of row:
//
//   LIBRARY   — rebuilt from seed-data. If the sources rebuild FEWER rows than are there
//               now, the difference exists in no file and will not come back. THAT IS A
//               REFUSAL, not a warning: it is the one loss this command cannot undo.
//   FIXTURES  — rebuilt from scripts/fixtures. Test data; a difference is expected and is
//               reported, not refused.
//   EVERYTHING ELSE — destroyed, and nothing rebuilds it. Reported so the number is seen
//               before it is destroyed rather than discovered afterwards.
// ---------------------------------------------------------------------------

console.log("");
rule("=");
console.log("  WHAT IS ON STAGING NOW, AND WHAT THE SOURCES WILL REBUILD");
rule("=");

const LIBRARY = [
  ["requirement_templates", "select count(*) from public.requirement_templates", EXPECT.requirements],
  ["  with an expression", "select count(*) from public.requirement_templates where applies_expression is not null", EXPECT.expressions],
  ["agencies", "select count(*) from public.agencies", EXPECT.agencies],
  ["industry_coverage", "select count(*) from public.industry_coverage", EXPECT.coverage],
  ["switches", "select count(*) from public.switches", EXPECT.switches],
];
const FIXTURES = [
  ["companies", "select count(*) from public.companies", EXPECT.companies],
  ["profiles", "select count(*) from public.profiles", EXPECT.profiles],
  ["entities", "select count(*) from public.entities", EXPECT.entitiesAfter8],
  ["company_switches", "select count(*) from public.company_switches", EXPECT.facts],
];

let unrebuildable = [];
console.log("  LIBRARY — rebuilt from supabase/seed-data/");
for (const [label, sql, expect] of LIBRARY) {
  const now = scalar(sql);
  const flag = now > expect.n ? `  <- ${now - expect.n} WOULD NOT COME BACK` : "";
  console.log(`    ${label.padEnd(24)} now ${String(now).padStart(5)}   sources rebuild ${String(expect.n).padStart(5)}${flag}`);
  if (now > expect.n) unrebuildable.push([label.trim(), now, expect.n]);
}
console.log("\n  FIXTURES — rebuilt from scripts/fixtures/ (test data; a difference is expected)");
for (const [label, sql, expect] of FIXTURES) {
  const now = scalar(sql);
  console.log(`    ${label.padEnd(24)} now ${String(now).padStart(5)}   sources rebuild ${String(expect.n).padStart(5)}`);
}

// Everything else with rows in it. Nothing puts these back, and saying so before the reset
// is the difference between an accepted cost and a discovery.
const accountedFor = new Set(["requirement_templates", "agencies", "industry_coverage", "switches",
                              "companies", "profiles", "entities", "company_switches"]);
const tables = query(
  `select table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE' order by table_name`
).map((r) => r.table_name).filter((t) => !accountedFor.has(t));

const counts = tables.length
  ? query("select " + tables.map((t) => `(select count(*) from public.${t})::int as "${t}"`).join(", "))[0]
  : {};
const populated = Object.entries(counts).filter(([, n]) => Number(n) > 0);
console.log("\n  EVERYTHING ELSE — destroyed by step 1, and nothing rebuilds it");
if (populated.length === 0) {
  console.log("    (nothing — every other table is already empty)");
} else {
  for (const [t, n] of populated.sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(24)} ${String(n).padStart(5)} row(s) destroyed`);
  }
}

if (unrebuildable.length || inconsistencies.length) {
  console.log("");
  rule("=");
  console.log("  REFUSED — NOTHING HAS BEEN TOUCHED");
  rule("=");
  for (const [table, now, rebuild] of unrebuildable) {
    console.log(`\n  ${table}: ${now} rows on staging, ${rebuild} in the sources. ${now - rebuild} row(s) exist in\n` +
                `  no seed file, so this command cannot put them back.`);
  }
  if (inconsistencies.length && !unrebuildable.length) {
    console.log("\n  The seed files contradict each other (above). A restore built on them would\n" +
                "  stop partway through with the library already replaced.");
  }
  console.log(
    "\n  A restore is only a restore if the sources hold everything it is about to destroy.\n" +
    "  Make the sources complete, then run this again. There is deliberately no flag that\n" +
    "  proceeds anyway: the whole value of this command is that its output can be trusted\n" +
    "  the day somebody runs it in a hurry.\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 4. THE EIGHT STEPS.
// ---------------------------------------------------------------------------

/**
 * One step: a command, and the counts that prove it did what it claims.
 *
 * `checks` is a list of [label, sql, expectation]. An expectation is either one of the
 * EXPECT entries (an exact number and the file it came from) or the string "nonzero",
 * which guards against emptiness where no file yields an honest exact number. It is used
 * once, and the note at step 4 says why.
 */
const STEPS = [
  {
    title: "the migration chain, from 000, against an empty database",
    cmd: ["npm", ["run", "db:reset"]],
    interactive: true,
    checks: [["migrations applied", "select count(*) from supabase_migrations.schema_migrations", EXPECT.migrations]],
  },
  {
    title: "the requirement library",
    cmd: ["node", ["--env-file=.env.local", "scripts/load-requirements.js", rel(XLSX_PATH), "--apply"]],
    checks: [["requirement_templates", "select count(*) from public.requirement_templates", EXPECT.requirements]],
  },
  {
    title: "the agencies",
    cmd: ["node", ["--env-file=.env.local", "scripts/load-agencies.js", "--apply"]],
    checks: [["agencies", "select count(*) from public.agencies", EXPECT.agencies]],
  },
  {
    title: "agency assignment and the coverage cross product",
    cmd: ["node", ["--env-file=.env.local", "scripts/assign-agencies.js", "--apply"]],
    checks: [
      ["industry_coverage", "select count(*) from public.industry_coverage", EXPECT.coverage],
      // No file-derived exact number, on purpose. How many rows get an agency is the
      // OUTPUT of agency-mapping.json's rules applied to the worksheet's citations, and
      // recomputing it here would be a second implementation of the matcher — which can
      // drift from the real one and report a mismatch that is this script's fault.
      // §43 is about copied numbers; a copied algorithm is worse. Guard against zero,
      // print the number, and let scripts/assign-agencies.js's own projection be read.
      ["requirements with an agency", "select count(*) from public.requirement_templates where agency_id is not null", "nonzero"],
    ],
  },
  {
    title: "the applies expressions",
    cmd: ["node", ["--env-file=.env.local", "scripts/load-expressions.js", "--apply"]],
    checks: [["rows with an expression", "select count(*) from public.requirement_templates where applies_expression is not null", EXPECT.expressions]],
  },
  {
    title: "the switch vocabulary",
    cmd: ["node", ["--env-file=.env.local", "scripts/load-switches.js", "--apply"]],
    checks: [
      ["switches", "select count(*) from public.switches", EXPECT.switches],
      ["depends_on_switch edges", "select count(*) from public.switches where depends_on_switch is not null", EXPECT.switchEdges],
    ],
  },
  {
    title: "the staging test accounts",
    cmd: ["node", ["--env-file=.env.local", "scripts/seed-staging-testdata.js"]],
    checks: [
      ["companies", "select count(*) from public.companies", EXPECT.companies],
      ["profiles", "select count(*) from public.profiles", EXPECT.profiles],
      ["entities", "select count(*) from public.entities", EXPECT.entitiesAfter7],
    ],
  },
  {
    title: "Alpha's second site and its facts",
    cmd: ["node", ["--env-file=.env.local", "scripts/seed-multisite-fixture.js", "--apply"]],
    checks: [
      ["entities", "select count(*) from public.entities", EXPECT.entitiesAfter8],
      ["company_switches", "select count(*) from public.company_switches", EXPECT.facts],
    ],
  },
];

// Step 1 is interactive and stays that way (TODO.md 0.10): it drops every table on
// staging, and a human types RESET. Checked here rather than at the top so the projection
// above — which is entirely read-only — is printed even when there is no terminal.
if (!process.stdin.isTTY) {
  die("Step 1 (npm run db:reset) needs a terminal to type RESET into, and there is none.\n\n" +
      "  Everything above is read-only and ran. Nothing was dropped. Run this again from an\n" +
      "  interactive shell to go further.");
}

function stop(stepIndex, why) {
  console.log("");
  rule("=");
  console.log(`  STOPPED AT STEP ${stepIndex + 1} OF ${STEPS.length}`);
  rule("=");
  console.log(`\n  ${why}\n`);
  console.log(`  Steps ${stepIndex + 2}-${STEPS.length} did NOT run. The database is part-way through a restore and\n` +
              `  should not be used until this is resolved — §98: an empty library does not fail,\n` +
              `  it passes vacuously.\n`);
  process.exit(1);
}

for (const [i, step] of STEPS.entries()) {
  stepNo = i + 1;
  const [bin, args] = step.cmd;
  console.log("");
  rule("=");
  console.log(`  STEP ${stepNo}/${STEPS.length} — ${step.title}`);
  console.log(`  $ ${bin} ${args.join(" ")}`);
  rule("=");

  const run = spawnSync(bin, args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (run.error) stop(i, `The command could not be run: ${run.error.message}`);
  if (run.status !== 0) stop(i, `The command exited ${run.status}. Its own output is above.`);

  console.log("");
  rule();
  let failed = null;
  for (const [label, sql, expect] of step.checks) {
    let got;
    try {
      got = scalar(sql);
    } catch (e) {
      failed = `Could not read the count for "${label}": ${e.message}`;
      console.log(`  ${label.padEnd(28)} ??    UNREADABLE`);
      continue;
    }
    if (expect === "nonzero") {
      console.log(`  ${label.padEnd(28)} ${String(got).padStart(5)}   expected: more than 0 (no file-derived count — see the note in this script)`);
      if (got === 0) failed = `"${label}" came back ZERO.`;
    } else {
      const verdict = got === expect.n ? OK : "  MISMATCH";
      console.log(`  ${label.padEnd(28)} ${String(got).padStart(5)}   expected ${String(expect.n).padStart(5)}   ${expect.from}${verdict}`);
      if (got !== expect.n) failed = `"${label}": got ${got}, the sources say ${expect.n}.`;
      else if (got === 0) failed = `"${label}" is ZERO, and so is the expectation. A source file is empty.`;
    }
  }
  rule();
  if (failed) stop(i, failed);
}

console.log("");
rule("=");
console.log(`  RESTORE COMPLETE — ${REF} (staging)`);
rule("=");
console.log(`\n  All ${STEPS.length} steps ran and every count matched its source file.\n`);
console.log("  What this did NOT rebuild, because nothing seeds it: documents, checklists,");
console.log("  topics, obligations, audits, jobs and every other per-company row. Logins and");
console.log("  uploaded files survive — they live in the auth and storage schemas, which a");
console.log("  reset does not touch.\n");
console.log("  Next: npm run check:live, which signs in as a real fixture and drives routes as");
console.log("  that user. The 329 tests in `npm run check` make no authenticated request.\n");

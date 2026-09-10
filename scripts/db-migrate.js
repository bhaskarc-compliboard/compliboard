// Applies pending Supabase migrations to ONE of two databases.
//
//   npm run db:migrate        -> STAGING      (default, no flag, no confirmation)
//   npm run db:migrate:prod   -> PRODUCTION   (requires --production and a typed confirmation)
//
// The two environments are kept strictly apart. Staging reads SUPABASE_PROJECT_REF /
// SUPABASE_DB_PASSWORD / SUPABASE_POOLER_HOST; production reads SUPABASE_PROD_REF /
// SUPABASE_PROD_DB_PASSWORD / SUPABASE_PROD_POOLER_HOST. There is NO fallback in
// either direction — if a variable for the chosen target is missing, this exits and
// says which one. A missing production password must never quietly become a staging
// run, and a missing staging password must never quietly become a production run.
// That silent substitution is exactly the accident this script exists to prevent.
//
// Uses the SESSION POOLER rather than the direct DB host, because the direct host
// only has an IPv6 address and is unreachable from most networks. The session
// pooler has IPv4, supports full transactions, and is safe for migrations.
// Username format for the pooler is postgres.{project_ref}.
//
// Find your exact pooler host in:
//   Supabase dashboard -> Settings -> Database -> Connection string -> Session pooler
// It looks like: aws-0-us-west-2.pooler.supabase.com  (the region part varies)
//
// Note: the connection string is passed to the Supabase CLI as a command-line
// argument, so the password is briefly visible to anyone who can list processes on
// this machine. That is acceptable on a developer laptop and not on a shared box.

import { execSync } from "child_process";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "../supabase/migrations");

const isProduction = process.argv.includes("--production");

// --new-project is the ONLY way to proceed against production without a readable
// migration history. It exists for a genuinely fresh project that has never had a
// migration applied, where there is no history table to read yet. It is not a way
// past a failed check — see appliedVersions().
const isNewProject = process.argv.includes("--new-project");

// ---------------------------------------------------------------------------
// 1. Pick the target. Each branch reads only its own variables.
// ---------------------------------------------------------------------------

const target = isProduction
  ? {
      label: "PRODUCTION",
      ref: process.env.SUPABASE_PROD_REF,
      password: process.env.SUPABASE_PROD_DB_PASSWORD,
      poolerHost: process.env.SUPABASE_PROD_POOLER_HOST,
      required: [
        ["SUPABASE_PROD_REF", "dashboard -> Settings -> General -> Reference ID"],
        ["SUPABASE_PROD_DB_PASSWORD", "dashboard -> Settings -> Database -> Database password"],
        ["SUPABASE_PROD_POOLER_HOST", "dashboard -> Settings -> Database -> Connection string -> Session pooler"],
      ],
    }
  : {
      label: "staging",
      ref: process.env.SUPABASE_PROJECT_REF,
      password: process.env.SUPABASE_DB_PASSWORD,
      poolerHost: process.env.SUPABASE_POOLER_HOST,
      required: [
        ["SUPABASE_PROJECT_REF", "dashboard -> Settings -> General -> Reference ID"],
        ["SUPABASE_DB_PASSWORD", "dashboard -> Settings -> Database -> Database password"],
        ["SUPABASE_POOLER_HOST", "dashboard -> Settings -> Database -> Connection string -> Session pooler"],
      ],
    };

const missing = target.required.filter(([name]) => !process.env[name]);
if (missing.length) {
  console.error(`\nCannot run: ${missing.length} required value(s) missing from .env.local ` +
                `for the ${target.label} target.\n`);
  for (const [name, where] of missing) console.error(`  - ${name}   (${where})`);
  console.error("\nNothing was applied. This script never substitutes values from the " +
                "other environment.\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Refuse configurations where the two environments are not actually separate.
// ---------------------------------------------------------------------------

const stagingRef = process.env.SUPABASE_PROJECT_REF;
const prodRef = process.env.SUPABASE_PROD_REF;

if (stagingRef && prodRef && stagingRef === prodRef) {
  console.error("\nCannot run: SUPABASE_PROJECT_REF and SUPABASE_PROD_REF are the same " +
                "project.\n\nStaging and production must be separate Supabase projects, or " +
                "there is no safe\nplace to test a migration before customers see it. Fix " +
                ".env.local and try again.\n");
  process.exit(1);
}

if (!isProduction && prodRef && target.ref === prodRef) {
  console.error("\nCannot run: the default (staging) target is pointing at the production " +
                "project.\n\nSUPABASE_PROJECT_REF matches SUPABASE_PROD_REF. If you mean to " +
                "change production,\nrun: npm run db:migrate:prod\n");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Work out which migrations are actually pending, so the operator confirms
//    against a real list rather than a vague warning.
// ---------------------------------------------------------------------------

const dbUrl = `postgresql://postgres.${target.ref}:${encodeURIComponent(target.password)}@${target.poolerHost}:5432/postgres`;

function localMigrations() {
  try {
    return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return [];
  }
}

/**
 * Strip credentials out of anything before it is printed.
 *
 * The connection string is passed to the CLI as a command-line argument, so a failed
 * command echoes the whole thing back in its error — password included. Printing that
 * raw put a live production database password on a terminal on 10 Sep. Every path that
 * surfaces an error from a command built with dbUrl must go through this.
 */
function redact(text) {
  return String(text ?? "")
    .replace(/(postgresql:\/\/[^:@\s]+:)[^@\s]*(@)/g, "$1<redacted>$2")
    .replace(new RegExp(escapeForRegex(target.password), "g"), "<redacted>");
}

function escapeForRegex(literal) {
  return String(literal ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  // Synchronous pause without a dependency. This script is deliberately linear.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readAppliedVersions() {
  const out = execSync(
    `npx supabase db query --db-url "${dbUrl}" -o json ` +
      `"select version from supabase_migrations.schema_migrations order by version"`,
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
  );
  return new Set((JSON.parse(out).rows || []).map((r) => r.version));
}

/**
 * Read the versions already recorded on the remote.
 *
 * Returns { ok: true, versions } or { ok: false, error }. The distinction matters:
 * a FAILED read is not the same as an EMPTY history, and treating them alike is what
 * produced a production prompt offering to apply the baseline over a live database.
 * The caller decides what an unreadable history means; this function does not guess.
 *
 * Retries once, because a single pooler blip should not need a human.
 */
function appliedVersions() {
  try {
    return { ok: true, versions: readAppliedVersions() };
  } catch (first) {
    console.log("  Could not read the remote migration history. Retrying once in 3s…");
    sleep(3000);
    try {
      const versions = readAppliedVersions();
      console.log("  Retry succeeded.\n");
      return { ok: true, versions };
    } catch (second) {
      return { ok: false, error: second };
    }
  }
}

const local = localMigrations();
const applied = appliedVersions();
const pending = applied.ok
  ? local.filter((f) => !applied.versions.has(f.match(/^\d+/)?.[0] ?? f))
  : local; // only ever shown on a path that has decided an unread history is acceptable

// ---------------------------------------------------------------------------
// 4. Production requires the operator to type the word, every time.
// ---------------------------------------------------------------------------

if (isProduction) {
  console.log("\n" + "=".repeat(64));
  console.log("  *** PRODUCTION MIGRATION ***");
  console.log("=".repeat(64));
  console.log(`  Target project ref : ${target.ref}`);
  console.log(`  Staging ref        : ${stagingRef || "(not set)"}   <- NOT the target`);
  console.log(`  Pooler host        : ${target.poolerHost}`);
  console.log("=".repeat(64));

  // An unreadable history is a STOP on this path, not a warning.
  //
  // The old behaviour listed every local migration as pending and asked the operator to
  // confirm. On 10 Sep that produced a production prompt offering to apply the baseline
  // and the spine over a live database — a list the script itself did not trust, shown
  // to a human as though it did. The operator aborted, correctly. Nobody should be asked
  // to confirm a list built from a failed check.
  if (!applied.ok) {
    if (!isNewProject) {
      console.error("\n  STOPPING: could not read the remote migration history, and a retry\n" +
                    "  also failed.\n");
      console.error("  Without it there is no way to tell which migrations are already applied,\n" +
                    "  so there is no honest list to show you. This is usually transient — a\n" +
                    "  pooler blip or a rate limit. Wait a moment and run the command again.\n");
      console.error("  If this project is genuinely NEW and has never had a migration applied,\n" +
                    "  there is no history table to read yet. In that case, and only that case:\n" +
                    "    npm run db:migrate:prod -- --new-project\n");
      console.error(`  Underlying error: ${redact(applied.error?.message?.split("\n")[0] ?? applied.error)}\n`);
      console.error("  Nothing was applied.\n");
      process.exit(1);
    }

    console.log("\n  --new-project given, and the remote migration history could not be read.\n" +
                "  Proceeding on the assumption that this project has never had a migration\n" +
                "  applied. EVERY local migration below will be attempted, including the\n" +
                "  baseline. If this project already has data, abort now.");
  }

  console.log(`\n  Migrations about to be applied (${pending.length}):\n`);
  if (pending.length === 0) {
    console.log("    (none — the database is already up to date)\n");
    console.log("  Nothing to do. Exiting without connecting.\n");
    process.exit(0);
  }
  for (const f of pending) console.log(`    - ${f}`);

  console.log("\n  This changes the live database that customers use.");
  console.log("  Type PRODUCTION and press Enter to proceed. Anything else aborts.\n");

  if (!process.stdin.isTTY) {
    console.error("  Aborted: no interactive terminal, so the confirmation cannot be typed.\n" +
                  "  Production migrations are never applied unattended.\n");
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question("  > ", resolve));
  rl.close();

  if (answer.trim() !== "PRODUCTION") {
    console.error("\n  Aborted. Nothing was applied.\n");
    process.exit(1);
  }
  console.log("\n  Confirmed. Applying to production…\n");
} else {
  console.log(`\nTarget project: ${target.ref}   (${target.label})`);
  if (!applied.ok) {
    // Staging keeps warn-and-proceed on purpose. It is a testing database; a false
    // start costs a re-run, and the CLI consults the remote history itself before
    // applying anything. Production gets the stricter treatment above.
    console.log("Could not read the remote migration history, even after a retry.");
    console.log("Listing every local migration; the Supabase CLI will decide what to apply.");
  }
  console.log(`Migrations pending: ${pending.length}${pending.length ? " — " + pending.join(", ") : ""}`);
  console.log("\nApplying migrations…\n");
}

// Wrapped, because an uncaught execSync failure prints the whole failed command —
// connection string and password included — as part of Node's stack trace.
try {
  execSync(`npx supabase db push --db-url "${dbUrl}"`, { stdio: "inherit" });
} catch (err) {
  console.error(`\nMigration failed: ${redact(err?.message?.split("\n")[0] ?? err)}`);
  console.error("Nothing further was applied. Fix the cause and run the command again.\n");
  process.exit(1);
}

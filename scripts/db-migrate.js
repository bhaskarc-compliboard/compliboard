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
import { readdirSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
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

// --reset wipes every object in the public schema and re-runs the whole chain from 000.
// It exists to answer one question that no incremental run can: does this chain, applied
// to an empty database, reproduce what it claims to? Until it has been run once, "the
// migrations are complete" is a belief, not a fact — and every migration added makes it a
// more expensive belief to check.
const isReset = process.argv.includes("--reset");

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
// 2b. --reset AND --production IS NOT A COMBINATION. IT IS A MISTAKE.
//
// Checked here, before anything else can happen, and phrased as impossible rather than
// discouraged. There is no legitimate reason to wipe production: the data is the product,
// and a reset that "proves the chain" against production proves it by destroying every
// customer's compliance record. Nothing downstream should ever have to ask whether this
// combination was intended.
// ---------------------------------------------------------------------------

if (isReset && isProduction) {
  console.error("\n  REFUSED: --reset and --production cannot be used together.\n");
  console.error("  --reset destroys every table and every row in the public schema. There is no");
  console.error("  circumstance in which that is the right thing to do to production — the data IS");
  console.error("  the product. If you are trying to prove the migration chain reproduces itself,");
  console.error("  that is what staging is for:\n");
  console.error("      npm run db:reset\n");
  process.exit(1);
}

// A second, independent check on the same mistake, by ref rather than by flag — in case
// the staging variables are ever pointed at the production project by accident.
if (isReset && prodRef && target.ref === prodRef) {
  console.error(`\n  REFUSED: --reset was asked to wipe ${target.ref}, which is SUPABASE_PROD_REF.\n`);
  console.error("  The flags said staging; the environment says production. Fix .env.local.\n");
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

/**
 * Pull the result rows out of `supabase db query -o json`, whichever shape it used.
 *
 * The CLI emits TWO different JSON shapes for the same command, decided by its agent
 * detection (`--agent auto|yes|no`, CLI 2.117.0):
 *
 *   --agent no   ->  a BARE ARRAY:  [{"version":"000"}, …]
 *   --agent yes  ->  a WRAPPED OBJECT: {"boundary":"…","rows":[…],"warning":"…"}
 *                    (an envelope marking the contents as untrusted data)
 *   --agent auto ->  whichever, depending on whether it thinks a program is calling it
 *
 * The old parser read `parsed.rows` only. Against the bare array that is `undefined`,
 * and `(parsed.rows || [])` turned a perfectly good answer into an empty set — so a
 * production database with three migrations recorded reported zero, and every local
 * migration looked pending. It did that silently, because nothing had thrown.
 *
 * Returns the rows, or null when the payload is NEITHER shape. Null means failure, and
 * callers must treat it as such: an unrecognised payload is not an empty result.
 */
function extractRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.rows)) return parsed.rows;
  return null;
}

/**
 * *** `--read-only` IS WHY THIS WORKS, AND ITS ABSENCE STOPPED A PRODUCTION RUN DEAD.
 * Added 5 November 2026. ***
 *
 * The Supabase CLI now refuses any statement it has not been told is safe. With `-o json` it
 * cannot prompt, and with `stdio[0] = "ignore"` below it has no stdin either, so it decides it is
 * being driven by a program and refuses outright. The real message — which this script THREW AWAY,
 * see the next paragraph — is:
 *
 *   Confirmation required: Run a SQL statement (target: custom Postgres (…pooler…:5432)).
 *   This run can't ask because it is running in agent mode. Nothing was changed.
 *   This is an agent run: ask the user before re-running with --yes.
 *   For a read-only statement, pass --read-only instead.
 *
 * Measured against production on 5 November 2026, the same statement twice: **without the flag,
 * exit 1 and the text above; with it, 91 rows, 000 … 090.** Of the CLI's two ways out, `--yes`
 * says "whatever this is, do it" and `--read-only` says "refuse anything that is not a read" — so
 * a function whose whole job is to READ takes the second. `CLAUDE.md` §3.7 wants a production
 * query to be SELECT-only, and the server is a better place to enforce that than this file's good
 * intentions. `scripts/preflight-prod.js` was fixed the same way on the same night.
 *
 * *** AND THE STDERR IS PRINTED, REDACTED, RATHER THAN DISCARDED. ***
 * `stdio[2]` was `"pipe"` with nothing ever reading it, so every word above was thrown away and
 * the owner's failed production run reported only `Command failed`, twice, then "could not read
 * the remote migration history". A refusal that names its own fix is worthless if nobody sees it.
 *
 * It is printed through `redact()` rather than inherited: Node builds its error `message` from the
 * whole failed command, **password included**, which is how a live production password reached a
 * terminal on 10 September. Inheriting the stream would hand the CLI's output straight to the
 * console and bypass the one function that exists to stop that. Piped-and-redacted keeps both
 * rules: nothing is swallowed, and nothing leaks.
 */
function runReadOnlyQuery(sql, what) {
  try {
    return execSync(
      `npx supabase db query --db-url "${dbUrl}" --read-only -o json ${sql}`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (err) {
    const detail = redact(err?.stderr || err?.stdout || "").trim();
    if (detail) {
      console.error(`\n  The CLI refused the ${what} read. Its own words:\n`);
      for (const line of detail.split("\n")) console.error(`    ${line}`);
      console.error("");
    }
    throw err;
  }
}

function readAppliedVersions() {
  const out = runReadOnlyQuery(
    `"select version from supabase_migrations.schema_migrations order by version"`,
    "migration history"
  );
  const parsed = JSON.parse(out);
  const rows = extractRows(parsed);
  if (rows === null) {
    throw new Error(
      "Unrecognised payload from `supabase db query -o json` — expected a bare array " +
      "or an object with a rows array, got keys: " + JSON.stringify(Object.keys(parsed ?? {}))
    );
  }
  return new Set(rows.map((r) => r.version));
}

/**
 * How many tables exist in the target's public schema.
 *
 * Used only to sanity-check an empty migration history on production. Returns null if
 * it cannot be determined, which the caller treats as "cannot rule out a contradiction".
 */
function publicTableCount() {
  try {
    const out = runReadOnlyQuery(
      `"select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace ` +
        `where n.nspname='public' and c.relkind='r'"`,
      "public table count"
    );
    const rows = extractRows(JSON.parse(out));
    if (!rows || rows.length === 0) return null;
    return Number(rows[0].n);
  } catch (err) {
    // Returning null still means "cannot rule out a contradiction", which is the contract the
    // caller relies on. What changed on 5 November is that the reason is no longer silent: this
    // catch swallowed the same confirmation refusal as the history read above, so a run could be
    // told "an unknown number of tables" with no hint that a FLAG was the problem.
    console.error(`  (could not count public tables: ${redact(err?.message?.split("\n")[0] ?? err)})`);
    return null;
  }
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

// ---------------------------------------------------------------------------
// 3b. THE RESET ITSELF
//
// Runs before the pending-migration list is computed, so that list is built against the
// emptied database and comes out as "all of them" rather than "none".
//
// *** IT DROPS EVERY OBJECT IN public, NOT THE SCHEMA ITSELF. That is deliberate. ***
//
// `drop schema public cascade` is the more obvious way to write this and it is wrong here.
// The schema carries DEFAULT PRIVILEGES — pg_default_acl rows owned by both `postgres` and
// `supabase_admin` — which decide what grants a newly created table gets. Those are part of
// how Supabase sets a project up; they are NOT created by any migration in this chain. So:
//
//   * they are out of scope for what a reset is supposed to prove, and
//   * dropping the schema deletes them, and this connection is `postgres`, which is not a
//     member of `supabase_admin` and therefore CANNOT put that half back.
//
// The result would be a staging project permanently and invisibly unlike production, in a
// way the object-for-object comparison does not even look at. Dropping the contents and
// keeping the container proves exactly the same thing with none of that.
//
// The migration history lives in supabase_migrations.schema_migrations, a different schema
// again, so it has to be cleared explicitly or the chain would consider itself already
// applied to a database with no tables in it.
// ---------------------------------------------------------------------------

if (isReset) {
  const counts = publicTableCount();
  console.log(`\n  *** RESET: ${target.ref}   (${target.label}) ***\n`);
  console.log("  EVERY TABLE AND EVERY ROW IN THE public SCHEMA WILL BE DESTROYED.");
  console.log(`  ${typeof counts === "number" ? counts : "an unknown number of"} tables, and everything in them.`);
  console.log("  Then migrations 000 onwards run against the empty database.\n");
  console.log("  What survives, because it lives in another schema: auth.users (logins keep");
  console.log("  working), storage.objects (uploaded files stay), and the storage bucket.");
  console.log("  What does not: companies, profiles, documents rows, the library — everything.\n");
  console.log("  Type RESET and press Enter to proceed. Anything else aborts.\n");

  if (!process.stdin.isTTY) {
    console.error("  Aborted: no interactive terminal, so the confirmation cannot be typed.\n");
    process.exit(1);
  }
  const rlr = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rlr.question("  > ", resolve));
  rlr.close();
  if (answer.trim() !== "RESET") {
    console.error("\n  Aborted. Nothing was dropped.\n");
    process.exit(1);
  }

  // ONE statement, not several. `supabase db query -f` sends the file as a single
  // prepared statement, and Postgres refuses more than one command in one of those
  // ("cannot insert multiple commands into a prepared statement"). So everything —
  // including clearing the history table — lives inside a single DO block. It is also
  // better this way: one statement is one transaction, so a reset either happens
  // completely or not at all, rather than leaving a half-dropped schema behind.
  const resetSql = `
do $$
declare r record;
begin
  -- Tables first; cascade takes their constraints, indexes, policies and triggers,
  -- including the storage-schema policies that reference public.profiles.
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;

  for r in select viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;

  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;

  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typtype in ('e','c','d') loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;

  for r in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('drop sequence if exists public.%I cascade', r.sequencename);
  end loop;

  -- NOT public, and that is the point. The chain also writes policies onto
  -- storage.objects (000 creates three, 002 replaces them with four), and those survive
  -- anything that only clears public — the bucket-only ones do not reference public at
  -- all, so not even CASCADE reaches them. Leaving them behind means the next run of 000
  -- collides with its own output. A reset has to return the project to a state the chain
  -- can build from, which means every schema the chain writes to, not just the main one.
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;

  -- Without this the chain believes it has already been applied to an empty database.
  delete from supabase_migrations.schema_migrations;
end $$;
`;

  const sqlPath = join(tmpdir(), `compliboard-reset-${Date.now()}.sql`);
  writeFileSync(sqlPath, resetSql);
  console.log("\n  Dropping…\n");
  try {
    // `--yes`: the CLI refuses an unconfirmed statement (5 November 2026, the same wall that
    // stopped the history read above). This path is a RESET, which has already made a person type
    // a confirmation into this script a few lines up, and which refuses production by flag and
    // again by ref — there is no combination of arguments that resets production.
    execSync(`npx supabase db query --db-url "${dbUrl}" --yes -f "${sqlPath}"`, { stdio: "inherit" });
  } catch (err) {
    console.error(`\n  Reset failed: ${redact(err?.message?.split("\n")[0] ?? err)}`);
    console.error("  The database may be partly dropped. Re-run the reset before anything else.\n");
    process.exit(1);
  } finally {
    try { unlinkSync(sqlPath); } catch { /* best effort */ }
  }
  console.log("\n  public is empty and the migration history is cleared.");
  console.log("  Applying the full chain from 000…\n");
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

  // An EMPTY history on production is treated exactly like an unreadable one.
  //
  // "Zero migrations applied" is only a fact for a genuinely new project. Against a
  // database that already has tables it is a contradiction, and acting on it means
  // offering to apply the baseline over live data. The script cannot tell the two apart
  // on its own, so it refuses and makes the operator say which it is.
  const historyEmpty = applied.ok && applied.versions.size === 0;

  if (historyEmpty && !isNewProject) {
    const tables = publicTableCount();
    console.error("\n  STOPPING: the remote migration history is EMPTY.\n");
    if (tables === null) {
      console.error("  Could not determine whether the target database already has tables, so\n" +
                    "  a contradiction cannot be ruled out.\n");
    } else if (tables > 0) {
      console.error(`  This is a contradiction: the history says nothing has ever been applied,\n` +
                    `  but the target's public schema already contains ${tables} table(s). One of\n` +
                    `  those two things is wrong, and proceeding would offer to apply the baseline\n` +
                    `  over a database that already has data.\n`);
    } else {
      console.error("  The target's public schema is also empty, which is consistent with a new\n" +
                    "  project — but say so explicitly rather than letting the script assume it.\n");
    }
    console.error("  If this project is genuinely NEW and has never had a migration applied:\n" +
                  "    npm run db:migrate:prod -- --new-project\n");
    console.error("  Nothing was applied.\n");
    process.exit(1);
  }

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
  } else if (historyEmpty) {
    const tables = publicTableCount();
    console.log("\n  --new-project given, and the remote migration history is empty.\n" +
                "  EVERY local migration below will be attempted, including the baseline.");
    if (tables !== null && tables > 0) {
      console.log(`\n  WARNING: the target's public schema already contains ${tables} table(s).\n` +
                  "  That contradicts an empty history. Abort unless you are certain.");
    }
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

// *** `--yes` ON STAGING ONLY, AND NEVER ON PRODUCTION — 3 November 2026 (GAPS-PLAN B2). ***
//
// The Supabase CLI gained a consent gate of its own and refuses to apply anything when it detects
// that a program rather than a person is calling it:
//
//   HostedMutationConsentRequiredError — "Confirmation required: Apply 1 migration … This run
//   can't ask because it is running in agent mode. Nothing was changed."
//
// On STAGING that gate contradicts this script's own documented design — the header above says
// `npm run db:migrate -> STAGING (default, no flag, no confirmation)` — and protects nothing that
// is not already protected: by the time execution reaches this line the script has refused every
// production ref, named the target out loud, and listed exactly what is pending. So staging
// passes `--yes` and the run completes.
//
// *** CHANGED 5 NOVEMBER 2026 BY THE OWNER: `--yes` IS NOW PASSED ON PRODUCTION TOO. ***
//
// The superseded rule, kept because this is the project's convention and because it is the kind of
// decision that should be reversible by reading why it was made:
//
//   > ON PRODUCTION IT IS NOT PASSED, deliberately, and that is the whole point of the split.
//   > `CLAUDE.md` §3.7: *"The production guard is never automated, by anyone."* A production run
//   > has already typed a confirmation into THIS script; the CLI's own prompt is a second pair of
//   > eyes on the same irreversible act, and a flag that silenced it would be this file quietly
//   > deciding that one gate is enough. If a production push ever needs `--yes`, that is a
//   > person's decision made at a keyboard, not a constant in a script.
//
// *** THE LAST SENTENCE IS HOW THIS CHANGE IS ALLOWED TO HAPPEN: it IS the owner's decision, made
// at a keyboard, in the brief of 5 November 2026. *** His words: *"the human gate is the typed word
// PRODUCTION, which the script asks for BEFORE any apply, and that must stay exactly where it
// is."* And it does stay, untouched, at the bottom of this file: the run prints `*** PRODUCTION
// MIGRATION ***`, lists every pending file, **refuses outright when stdin is not a TTY** so the
// confirmation can never be piped in, and aborts unless the word typed is exactly `PRODUCTION`.
// §3.7's own wording — *"`npm run db:migrate:prod` and its typed confirmation stay a human
// action"* — names that gate, and that gate is what survives.
//
// *** AND ONE THING WORTH KNOWING BEFORE REVERSING IT. *** The flag is NOT what broke the owner's
// run on 5 November; the history read's missing `--read-only` was, and the push was never reached.
// This line's stdio is `"inherit"`, so unlike the reads the CLI gets a real stdin and CAN prompt —
// which is why the old shape worked for as long as it did. The argument for the flag is therefore
// not "it is broken" but "two prompts for one act, one of them outside this script's control, is a
// gate nobody reads twice". To put the second pair of eyes back, delete `--yes ` from the first
// branch; nothing else depends on it.
// One string, not a ternary with two identical branches: the split this line used to carry is
// recorded above rather than mimed in code that reads as though it still varies.
const push = `npx supabase db push --yes --db-url "${dbUrl}"`;

// Wrapped, because an uncaught execSync failure prints the whole failed command —
// connection string and password included — as part of Node's stack trace.
try {
  execSync(push, { stdio: "inherit" });
} catch (err) {
  console.error(`\nMigration failed: ${redact(err?.message?.split("\n")[0] ?? err)}`);
  console.error("Nothing further was applied. Fix the cause and run the command again.\n");
  process.exit(1);
}

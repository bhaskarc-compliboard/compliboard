// Generates the TypeScript description of the database schema.
//
//   npm run db:types        -> from STAGING     (default)
//   npm run db:types -- --production            -> from PRODUCTION
//   npm run db:migrate      -> runs this afterwards against staging
//   npm run db:migrate:prod -> runs this afterwards against production
//
// IMPORTANT: this runs automatically after every db:migrate, and the two must never
// be separated. Both Supabase clients are constructed as createClient<Database>(...),
// so these generated types are what turn a misspelled or stale column name into a
// compile error instead of a runtime PostgREST 400.
//
// Which database the types come from matters. A types file generated from a database
// that has drifted from the one the app actually talks to is worse than having none,
// because typecheck then passes while describing a schema that does not exist. Generate
// from the environment you just migrated, and keep the two databases in step.
//
// If this step fails (usually a missing SUPABASE_ACCESS_TOKEN), fix it and run
// npm run db:types manually BEFORE writing any new database queries.
//
// Uses the Supabase Management API (--project-id) — no Docker needed.
// Generate a personal access token at: https://supabase.com/dashboard/account/tokens
// (It is account-level, not project-level, so one token covers both projects.)

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const isProduction = process.argv.includes("--production");

// Each branch reads only its own ref. No fallback in either direction, for the same
// reason as db-migrate.js: a missing value must never silently become the other
// environment.
const target = isProduction
  ? { label: "PRODUCTION", ref: process.env.SUPABASE_PROD_REF, varName: "SUPABASE_PROD_REF" }
  : { label: "staging", ref: process.env.SUPABASE_PROJECT_REF, varName: "SUPABASE_PROJECT_REF" };

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!accessToken) {
  console.error(
    "\nCannot run: SUPABASE_ACCESS_TOKEN is not set in .env.local.\n" +
    "Generate a personal access token at:\n" +
    "  https://supabase.com/dashboard/account/tokens\n" +
    "Then add SUPABASE_ACCESS_TOKEN=your_token to .env.local\n"
  );
  process.exit(1);
}

if (!target.ref) {
  console.error(
    `\nCannot run: ${target.varName} is not set in .env.local, and it is required ` +
    `for the ${target.label} target.\n\nNo types were written. This script never ` +
    `substitutes the other environment's project.\n`
  );
  process.exit(1);
}

const stagingRef = process.env.SUPABASE_PROJECT_REF;
const prodRef = process.env.SUPABASE_PROD_REF;
if (stagingRef && prodRef && stagingRef === prodRef) {
  console.error("\nCannot run: SUPABASE_PROJECT_REF and SUPABASE_PROD_REF are the same " +
                "project.\nStaging and production must be separate. Fix .env.local and try again.\n");
  process.exit(1);
}

// CompliBoard is a single Next.js app, not a monorepo, so the generated types
// live in lib/ alongside the Supabase client that consumes them.
const outDir  = join(__dirname, "../lib");
const outFile = join(outDir, "database.types.ts");

console.log(`\nGenerating TypeScript types from ${target.label} (${target.ref})…\n`);

const types = execSync(
  `npx supabase gen types typescript --project-id ${target.ref} --schema public`,
  {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
  }
);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, types);

console.log(`Types written to lib/database.types.ts (source: ${target.label})`);
console.log("Run npm run typecheck to confirm no column-name mismatches.\n");

// Generates TypeScript types from the live Supabase schema.
// Run via: npm run db:types
//
// IMPORTANT: this runs automatically after every npm run db:migrate, and the two
// must never be separated. Both Supabase clients are constructed as
// createClient<Database>(...), so these generated types are what turn a misspelled
// or stale column name into a compile error instead of a runtime PostgREST 400.
//
// If this step fails (usually a missing SUPABASE_ACCESS_TOKEN), fix it and run
// npm run db:types manually BEFORE writing any new database queries. Otherwise
// the types describe a schema that no longer exists and typecheck starts lying.
//
// Uses the Supabase Management API (--project-id) — no Docker needed.
// Generate a personal access token at: https://supabase.com/dashboard/account/tokens
// (It is account-level, not project-level.)

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef  = process.env.SUPABASE_PROJECT_REF;

if (!accessToken) {
  console.error(
    "\nError: SUPABASE_ACCESS_TOKEN is not set in .env.local.\n" +
    "Generate a personal access token at:\n" +
    "  https://supabase.com/dashboard/account/tokens\n" +
    "Then add SUPABASE_ACCESS_TOKEN=your_token to .env.local\n"
  );
  process.exit(1);
}

if (!projectRef) {
  console.error("\nError: SUPABASE_PROJECT_REF is not set in .env.local.\n");
  process.exit(1);
}

// CompliBoard is a single Next.js app, not a monorepo, so the generated types
// live in lib/ alongside the Supabase client that consumes them.
const outDir  = join(__dirname, "../lib");
const outFile = join(outDir, "database.types.ts");

console.log(`Generating TypeScript types from project ${projectRef}…\n`);

const types = execSync(
  `npx supabase gen types typescript --project-id ${projectRef} --schema public`,
  {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
  }
);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, types);

console.log("Types written to lib/database.types.ts");
console.log("Run npm run typecheck to confirm no column-name mismatches.\n");

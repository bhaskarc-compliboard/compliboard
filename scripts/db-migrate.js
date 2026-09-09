// Applies all pending Supabase migrations to the target database.
// Run via: npm run db:migrate   (which also regenerates types afterwards)
//
// Which database it talks to is decided by SUPABASE_PROJECT_REF in .env.local.
// Point it at the staging ref to test a migration, at the production ref to ship it.
// Nothing here is hardcoded to one project on purpose — CompliBoard needs two
// environments so library changes can be tested before customers see them.
//
// Uses the SESSION POOLER rather than the direct DB host, because the direct host
// only has an IPv6 address and is unreachable from most networks. The session
// pooler has IPv4, supports full transactions, and is safe for migrations.
// Username format for the pooler is postgres.{project_ref}.
//
// Find your exact pooler host in:
//   Supabase dashboard -> Settings -> Database -> Connection string -> Session pooler
// It looks like: aws-0-us-west-2.pooler.supabase.com  (the region part varies)

import { execSync } from "child_process";

const password   = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const poolerHost = process.env.SUPABASE_POOLER_HOST;

const missing = [];
if (!password)   missing.push("SUPABASE_DB_PASSWORD  (dashboard -> Settings -> Database -> Database password)");
if (!projectRef) missing.push("SUPABASE_PROJECT_REF  (dashboard -> Settings -> General -> Reference ID)");
if (!poolerHost) missing.push("SUPABASE_POOLER_HOST  (dashboard -> Settings -> Database -> Connection string -> Session pooler)");

if (missing.length) {
  console.error("\nMissing required values in .env.local:\n");
  for (const m of missing) console.error("  - " + m);
  console.error("");
  process.exit(1);
}

// Safety rail: say out loud which database is about to change, and pause
// briefly if it is production. A migration applied to the wrong project is
// the kind of mistake that is very hard to undo.
const isProd = projectRef === process.env.SUPABASE_PROD_REF;
console.log(`\nTarget project: ${projectRef}${isProd ? "   *** PRODUCTION ***" : "   (non-production)"}`);

if (isProd) {
  console.log("Applying migrations to PRODUCTION in 5 seconds. Ctrl+C to cancel.\n");
  execSync("sleep 5");
}

const dbUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${poolerHost}:5432/postgres`;

console.log("Applying migrations…\n");
execSync(`npx supabase db push --db-url "${dbUrl}"`, { stdio: "inherit" });

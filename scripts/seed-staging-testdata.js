// Recreates the staging test accounts after `npm run db:reset`.
//
//   node --env-file=.env.local scripts/seed-staging-testdata.js
//
// A reset clears the public schema, which takes companies and profiles with it. It does
// NOT touch the auth schema, so the logins themselves survive with their passwords —
// testalpha@example.com, testbeta@example.com, testalpha2@example.com still work. What is
// missing afterwards is the public-side half: the company rows, and the profile rows that
// tie a login to a company.
//
// Two companies, three people. Alpha has two, which is the arrangement the tenancy tests
// need: they prove a colleague can see a colleague's work while Beta sees neither.
//
// STAGING ONLY. It refuses to run against anything else, by ref, before it writes.

import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "amzsavsrabrlcprltpom";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.replace("https://", "").split(".")[0];
if (ref !== STAGING_REF) {
  console.error(`\n  REFUSED: NEXT_PUBLIC_SUPABASE_URL points at "${ref}", not staging (${STAGING_REF}).`);
  console.error("  This creates test companies called CB-Test-*. It has no business anywhere else.\n");
  process.exit(1);
}
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Emails, not ids: an id changes if a login is ever recreated, an email does not.
const PLAN = [
  {
    company: { name: "Test Alpha Chemical", industry: "chemical-manufacturing",
               state: "Oregon", county: "Washington", city: "Hillsboro", employee_count: 42 },
    // Not a city and not a county — the case `local` exists for. Belongs to the SITE, so
    // it sits outside `company`: `companies` has no such column and never should.
    site: { fire_authority: "Tualatin Valley Fire & Rescue" },
    people: [
      { email: "testalpha@example.com",  full_name: "Alpha Owner" },
      { email: "testalpha2@example.com", full_name: "Alpha Colleague" },
    ],
  },
  {
    company: { name: "Test Beta Cannabis", industry: "cannabis",
               state: "Oregon", county: "Multnomah", city: "Portland", employee_count: 8 },
    people: [{ email: "testbeta@example.com", full_name: "Beta Owner" }],
  },
];

const { data: users, error: uErr } = await db.auth.admin.listUsers({ perPage: 200 });
if (uErr) { console.error("  Could not list auth users:", uErr.message); process.exit(1); }
const idByEmail = new Map(users.users.map((u) => [u.email, u.id]));

console.log(`\n  Target: ${ref} (staging)\n`);

// Idempotent on purpose. This runs after every `npm run db:reset`, and sooner or later it
// runs twice — at which point a plain insert half-succeeds: a new company and its
// trigger-created site land, then the profile insert fails on the primary key because the
// auth user already has one, leaving an orphan company behind. Clearing first makes a
// second run a no-op rather than a mess. Deleting the company cascades to its profiles and
// entities.
for (const { company } of PLAN) {
  const { data: existing } = await db.from("companies").select("id").eq("name", company.name);
  for (const row of existing ?? []) {
    // profiles.company_id is ON DELETE NO ACTION, not CASCADE — so the company delete
    // FAILS while a profile points at it, rather than cascading. Deleting the profiles
    // first is required, and not checking the error is how the first version of this
    // looked like it worked: the delete quietly failed, the old company survived, and the
    // next insert collided on profiles_pkey.
    const { error: pErr } = await db.from("profiles").delete().eq("company_id", row.id);
    if (pErr) { console.error(`  Could not clear profiles for ${company.name}: ${pErr.message}`); process.exit(1); }
    const { error: cErr } = await db.from("companies").delete().eq("id", row.id);
    if (cErr) { console.error(`  Could not clear ${company.name}: ${cErr.message}`); process.exit(1); }
  }
}

for (const { company, people, site } of PLAN) {
  const missing = people.filter((p) => !idByEmail.has(p.email));
  if (missing.length) {
    console.error(`  No auth user for ${missing.map((m) => m.email).join(", ")}.`);
    console.error("  Create the login first — this script only rebuilds the public-side rows.\n");
    process.exit(1);
  }

  // employee_count is an integer now (migration 006). A band would be refused.
  const { data: co, error: cErr } = await db.from("companies").insert(company).select("id, name").single();
  if (cErr) { console.error(`  Creating ${company.name} failed: ${cErr.message}`); process.exit(1); }
  console.log(`  ${co.name}  (${co.id.slice(0, 8)})  employee_count=${company.employee_count}`);

  for (const p of people) {
    const { error: pErr } = await db.from("profiles")
      .insert({ id: idByEmail.get(p.email), company_id: co.id, full_name: p.full_name });
    if (pErr) { console.error(`    ${p.email} failed: ${pErr.message}`); process.exit(1); }
    console.log(`    ${p.email.padEnd(26)} ${p.full_name}`);
  }

  // TODO 1.6: every company gets a primary site at signup, single-site ones included, so
  // nothing downstream has to ask whether a company has sites. Signup does not do this
  // yet; the test data should still look like what signup will produce.
  // The site already exists: migration 010 creates one in the same statement as the
  // company, named and located from the company's own columns. So this UPDATES rather than
  // inserts — inserting would hit the one-primary-per-company index, which is the right
  // failure but a confusing one to read.
  //
  // fire_authority is the only thing the trigger cannot derive: it is neither the city nor
  // the county, and for Hillsboro it is a rural fire district covering several of both.
  // That is the case `jurisdiction_layer = local` exists for.
  const { error: eErr } = await db.from("entities")
    .update({ fire_authority: site?.fire_authority ?? null })
    .eq("company_id", co.id).eq("is_primary", true);
  // Read the name back rather than printing the one this script used to construct — the
  // trigger owns it now, and a log that states a name nothing set is the kind of quietly
  // wrong output this project keeps finding.
  const { data: seeded } = await db.from("entities")
    .select("name, state, county, city, fire_authority")
    .eq("company_id", co.id).eq("is_primary", true).single();
  if (eErr) console.log(`    (could not set fire_authority: ${eErr.message})`);
  console.log(`    primary site: ${seeded.name}  (${seeded.city}, ${seeded.county} County, ${seeded.state}` +
              `${seeded.fire_authority ? "; " + seeded.fire_authority : ""})`);
}
console.log("\n  Done. Passwords are unchanged — the auth schema is never touched by a reset.\n");

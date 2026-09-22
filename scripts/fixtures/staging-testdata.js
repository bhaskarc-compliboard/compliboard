// THE STAGING TEST ACCOUNTS — the data, separated from the script that writes it.
//
// Lifted out of scripts/seed-staging-testdata.js unchanged on 22 September 2026, for one
// reason: `npm run db:restore` has to print the row count it EXPECTED after the seeding
// step, and DECISIONS.md §43 — a number copied into a second place is a number that
// drifts. The restore reads this module; the seeder writes from it. One definition.
//
// Nothing here talks to a database. Importing it must stay free of side effects, because
// the restore imports it before it has decided whether to touch anything at all.

// Emails, not ids: an id changes if a login is ever recreated, an email does not.
export const PLAN = [
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
  {
    // *** ADDED 21 SEP, AND IT EXISTED FOR SIX DAYS WITH NO SCRIPT BEHIND IT. ***
    //
    // Test Gamma Solvents was created on 15 September by an ad-hoc script that was not
    // committed, so `grep -rn Gamma scripts/ supabase/` returned NOTHING while the company,
    // its site and 208 obligations sat on staging. A reset would have destroyed it and left
    // testgamma@example.com signing in to a login with no profile and no company — every call
    // failing to find a company, which reads as a broken product rather than as missing
    // fixtures. Shape read back off the live rows before this was written, not remembered.
    //
    // WHY IT EXISTS AT ALL, since Alpha and Beta look similar: `TESTING.md` Case A1 needs a
    // company with NOTHING ESTABLISHED. Alpha had already answered `has_employees`, and Beta
    // matches zero library rows (cannabis, not chemical), so neither could show a first answer
    // creating an obligation list. Gamma is chemical-manufacturing with no facts at all.
    //
    // employee_count is deliberately NULL. A number here is a fact established before anybody
    // asked, which is exactly what the case's precondition forbids.
    company: { name: "Test Gamma Solvents", industry: "chemical-manufacturing",
               state: "Oregon", county: "Multnomah", city: "Portland", employee_count: null },
    people: [{ email: "testgamma@example.com", full_name: "Gamma Tester" }],
  },
];

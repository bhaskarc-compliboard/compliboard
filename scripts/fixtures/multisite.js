// THE MULTI-SITE FIXTURE — the data, separated from the script that writes it.
//
// Lifted out of scripts/seed-multisite-fixture.js unchanged on 22 September 2026, for the
// same reason as scripts/fixtures/staging-testdata.js: `npm run db:restore` prints the
// count it expected after this step, and "16 facts" typed into a second file is a copy
// that drifts (DECISIONS.md §43). 16 is COMPANY_FACTS + both SITE_FACTS lists, counted
// from here.
//
// No database access. Importing this must stay free of side effects.

export const SITE = {
  name: 'Test Alpha Chemical — Portland',
  entity_type: 'site',
  state: 'Oregon', county: 'Multnomah', city: 'Portland',
  // NULL on purpose: exercises jurisdictionMatch case 5's county fallback, which the
  // Hillsboro site (which has a named fire authority) does not.
  fire_authority: null,
  is_primary: false,   // idx_entities_one_primary is UNIQUE (company_id) WHERE is_primary
}

/** Company-scoped: one answer for the business. */
export const COMPANY_FACTS = [
  ['has_employees', 'true'],
  ['employee_count', '7'],   // under 10 — so Oregon sick time CANNOT fire on the company branch
]

/** Site-scoped: different at each site, which is the whole point. */
export const SITE_FACTS = {
  'Test Alpha Chemical — Hillsboro': [
    ['site_employee_count', '1'],
    ['hazardous_chemicals_present', 'true'],
    ['onsite_laboratory', 'true'],
    ['confined_spaces_present', 'true'],
    ['hazwaste_generator_category', 'lqg'],
    ['air_permit_required', 'title_v'],
    ['industrial_stormwater', 'true'],
  ],
  'Test Alpha Chemical — Portland': [
    ['site_employee_count', '6'],   // 6+ AND Portland -> sick time fires on the SITE branch
    ['hazardous_chemicals_present', 'false'],
    ['onsite_laboratory', 'false'],
    ['confined_spaces_present', 'false'],
    ['hazwaste_generator_category', 'vsqg'],
    ['air_permit_required', 'none'],
    ['industrial_stormwater', 'false'],
  ],
}

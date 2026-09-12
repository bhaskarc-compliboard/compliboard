// A SECOND SITE FOR TEST ALPHA CHEMICAL — staging only.
//
//   node --env-file=.env.local scripts/seed-multisite-fixture.js            dry run
//   node --env-file=.env.local scripts/seed-multisite-fixture.js --apply    write it
//
// WHY THIS EXISTS. `DECISIONS.md` §20: "A company-wide answer to a per-site switch is not
// approximately right — it is wrong at five of six facilities, and it is wrong in the
// direction of a confident answer." Nothing has ever demonstrated that working, because
// every company in either database has exactly one site. A resolver that silently answered
// company-wide would pass every test we have.
//
// The two sites are deliberately DIFFERENT on every site-scoped fact, so a resolver that
// collapses them produces visibly wrong output rather than subtly wrong output.
//
// REFUSES PRODUCTION by ref and by flag. This is test data and it belongs nowhere near a
// customer database.

import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !svc) { console.error('Missing staging credentials'); process.exit(1) }
if (process.argv.includes('--production') || (process.env.SUPABASE_PROD_REF && url.includes(process.env.SUPABASE_PROD_REF))) {
  console.error('REFUSED: this seeds test data and must never touch production.'); process.exit(1)
}
const db = createClient(url, svc, { auth: { persistSession: false } })
const ref = url.replace('https://', '').split('.')[0]

const SITE = {
  name: 'Test Alpha Chemical — Portland',
  entity_type: 'site',
  state: 'Oregon', county: 'Multnomah', city: 'Portland',
  // NULL on purpose: exercises jurisdictionMatch case 5's county fallback, which the
  // Hillsboro site (which has a named fire authority) does not.
  fire_authority: null,
  is_primary: false,   // idx_entities_one_primary is UNIQUE (company_id) WHERE is_primary
}

/** Company-scoped: one answer for the business. */
const COMPANY_FACTS = [
  ['has_employees', 'true'],
  ['employee_count', '7'],   // under 10 — so Oregon sick time CANNOT fire on the company branch
]

/** Site-scoped: different at each site, which is the whole point. */
const SITE_FACTS = {
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

console.log(`\n  Target : ${ref}   (STAGING)`)
console.log(`  Mode   : ${apply ? '*** APPLY ***' : 'dry run — nothing will be written'}\n`)

const { data: company } = await db.from('companies').select('id, name').eq('name', 'Test Alpha Chemical').single()
if (!company) { console.error('Test Alpha Chemical not found'); process.exit(1) }

const { data: existing } = await db.from('entities')
  .select('id, name, city, is_primary').eq('company_id', company.id).eq('entity_type', 'site')
console.log(`  ${company.name} currently has ${existing.length} site(s):`)
for (const e of existing) console.log(`    · ${e.name}  (${e.city}${e.is_primary ? ', primary' : ''})`)

const already = existing.find((e) => e.name === SITE.name)
console.log(`\n  WOULD ${already ? 'REUSE (already present)' : 'INSERT'} entity:`)
console.log(`    ${SITE.name} — ${SITE.city}, ${SITE.county} County, ${SITE.state}`)
console.log(`    fire_authority: NULL (exercises the county fallback) · is_primary: false`)

const { data: switches } = await db.from('switches').select('id, scope, value_type, allowed_values')
const byId = Object.fromEntries(switches.map((s) => [s.id, s]))

let planned = 0
console.log(`\n  WOULD WRITE company_switches:\n`)
console.log(`    COMPANY scope`)
for (const [id, value] of COMPANY_FACTS) {
  const sw = byId[id]
  if (!sw) { console.error(`    UNKNOWN SWITCH ${id}`); process.exit(1) }
  if (sw.scope !== 'company') { console.error(`    ${id} is ${sw.scope}-scoped, not company`); process.exit(1) }
  console.log(`      ${id.padEnd(30)} = ${String(value).padEnd(10)} (${sw.value_type})`)
  planned++
}
for (const [siteName, facts] of Object.entries(SITE_FACTS)) {
  console.log(`\n    SITE scope — ${siteName}`)
  for (const [id, value] of facts) {
    const sw = byId[id]
    if (!sw) { console.error(`    UNKNOWN SWITCH ${id}`); process.exit(1) }
    if (sw.scope !== 'site') { console.error(`    ${id} is ${sw.scope}-scoped, not site`); process.exit(1) }
    if (sw.allowed_values?.length && !sw.allowed_values.includes(value)) {
      console.error(`    ${id} = ${value} is not in ${sw.allowed_values.join('|')}`); process.exit(1)
    }
    console.log(`      ${id.padEnd(30)} = ${String(value).padEnd(10)} (${sw.value_type})`)
    planned++
  }
}
console.log(`\n  ${planned} switch value(s). Every site-scoped one DIFFERS between the two sites.`)

if (!apply) {
  console.log(`\n  Dry run only. Nothing was written.`)
  console.log(`  To apply:  node --env-file=.env.local scripts/seed-multisite-fixture.js --apply\n`)
  process.exit(0)
}

let siteId = already?.id
if (!siteId) {
  const { data, error } = await db.from('entities')
    .insert({ company_id: company.id, ...SITE }).select('id').single()
  if (error) { console.error('INSERT entities failed:', error.message); process.exit(1) }
  siteId = data.id
  console.log(`\n  inserted entity ${siteId}`)
}

const idOf = Object.fromEntries([...existing, { id: siteId, name: SITE.name }].map((e) => [e.name, e.id]))
const rows = [
  ...COMPANY_FACTS.map(([switch_id, value]) => ({
    company_id: company.id, switch_id, scope: 'company', entity_id: null,
    value, state: 'known', source: 'user_set', confidence: 'high',
    basis: 'Multi-site fixture — scripts/seed-multisite-fixture.js',
  })),
  ...Object.entries(SITE_FACTS).flatMap(([siteName, facts]) =>
    facts.map(([switch_id, value]) => ({
      company_id: company.id, switch_id, scope: 'site', entity_id: idOf[siteName],
      value, state: 'known', source: 'user_set', confidence: 'high',
      basis: 'Multi-site fixture — scripts/seed-multisite-fixture.js',
    }))),
]
const { error } = await db.from('company_switches')
  .upsert(rows, { onConflict: 'company_id,switch_id,entity_id' })
if (error) { console.error('UPSERT company_switches failed:', error.message); process.exit(1) }

const { count } = await db.from('company_switches')
  .select('*', { count: 'exact', head: true }).eq('company_id', company.id)
console.log(`  wrote ${rows.length} switch value(s); company now has ${count}\n`)

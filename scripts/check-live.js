#!/usr/bin/env node
/**
 * npm run check:live — DOES THIS WORK FOR THE PERSON WHO WILL RUN IT?
 *
 * *** THE PROPERTY THIS TESTS IS NOT "IS THIS CODE CORRECT". *** It is: does the path work when
 * executed by an `authenticated` session against the real schema? Those are different questions,
 * and `npm run check` answers only the first — none of its 274 tests makes an authenticated
 * request. They run in-process, as nobody, against no database.
 *
 * THREE DEFECTS IN ONE SITTING CAME FROM THAT GAP, and all three had passing tests:
 *
 *   §63  close_and_replace_obligations was service_role-only  -> 500 on the first real GET
 *   §80a switch_determinations had SELECT but no INSERT       -> the first user answer impossible
 *   §80b fromUserAnswer returned `stated` with no document    -> refused by a CHECK, while its
 *                                                                own unit test asserted it
 *
 * Every one was invisible because **nothing had ever run the path as the person who will run it.**
 *
 * *** IT REFUSES PRODUCTION, BY REF, BEFORE IT DOES ANYTHING. *** This writes rows. There is no
 * flag, no environment variable and no argument that points it at production.
 *
 * WHAT IT ASSERTS, per tenant table a route will eventually write:
 *   1. a signed-in user CAN write their own company's row   (grant + policy both present)
 *   2. `anon` CANNOT                                        (the boundary is real, not assumed)
 *
 * A grant without a policy and a policy without a grant fail identically from the caller's side —
 * `permission denied` either way — so both directions are checked. AUDIT-CHECKS.md check 27.
 */
import { createClient } from '@supabase/supabase-js'

const STAGING_REF = 'amzsavsrabrlcprltpom'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!url.includes(STAGING_REF)) {
  console.error(`\n  REFUSED: ${url || '(no url)'} is not staging.\n`)
  console.error('  check:live writes rows. It runs against staging and nowhere else.\n')
  process.exit(1)
}
if (process.env.SUPABASE_PROD_URL || process.env.SUPABASE_PROD_SERVICE_ROLE_KEY) {
  console.error('\n  REFUSED: production credentials are present in the environment.')
  console.error('  Clear SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_ROLE_KEY and run again.\n')
  process.exit(1)
}

const FIXTURE = { email: 'testgamma@example.com', password: process.env.CHECK_LIVE_PASSWORD ?? 'gamma@2026' }

const pub = createClient(url, anonKey, { auth: { persistSession: false } })
const { data: session, error: signInError } = await pub.auth.signInWithPassword(FIXTURE)
if (signInError) {
  console.error(`\n  Could not sign in as ${FIXTURE.email}: ${signInError.message}`)
  console.error('  This check needs a staging fixture login. Set CHECK_LIVE_PASSWORD if it changed.\n')
  process.exit(1)
}
const token = session.session.access_token
const asUser = createClient(url, anonKey, {
  auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
})
const asAnon = createClient(url, anonKey, { auth: { persistSession: false } })

const { data: me } = await asUser.from('profiles').select('company_id').single()
const companyId = me.company_id
const { data: site } = await asUser.from('entities').select('id').eq('is_primary', true).maybeSingle()

console.log(`\n  check:live — staging (${STAGING_REF}), signed in as ${FIXTURE.email}\n`)

let failures = 0
/** One tenant table a route will eventually write. Probe rows are removed by `cleanup`. */
const CASES = [
  {
    table: 'switch_determinations',
    row: { company_id: companyId, switch_id: 'has_employees', value: 'true',
           evidence_class: 'declared', source: 'user_set', reasoning: 'check:live probe' },
    cleanup: (db, id) => db.from('switch_determinations').delete().eq('id', id),
    note: '§80a — had SELECT and no INSERT until migration 025',
  },
  {
    table: 'company_chemicals',
    row: { company_id: companyId, entity_id: site?.id ?? null, substance_name: 'check:live probe' },
    cleanup: (db, id) => db.from('company_chemicals').delete().eq('id', id),
    note: 'nothing has ever written this from a request — sdsExtraction is unrouted (check 29)',
  },
]

for (const c of CASES) {
  // 1. the signed-in caller must be able to write.
  const { data: written, error: userErr } = await asUser.from(c.table).insert(c.row).select('id').maybeSingle()
  if (userErr) {
    console.log(`  ✗ ${c.table.padEnd(26)} authenticated CANNOT write — ${userErr.code} ${userErr.message}`)
    console.log(`      ${c.note}`)
    failures++
  } else {
    console.log(`  ✓ ${c.table.padEnd(26)} authenticated can write`)
    // 2. anon must not.
    const { error: anonErr } = await asAnon.from(c.table).insert(c.row)
    if (!anonErr) {
      console.log(`  ✗ ${c.table.padEnd(26)} ANON CAN WRITE — the boundary is not there`)
      failures++
    } else {
      console.log(`  ✓ ${c.table.padEnd(26)} anon refused (${anonErr.code})`)
    }
    if (written?.id) await c.cleanup(asUser, written.id)
  }
}

console.log()
if (failures > 0) {
  console.error(`  check:live FAILED — ${failures} problem(s). These are invisible to npm run check.\n`)
  process.exit(1)
}
console.log(`  check:live: ok — ${CASES.length} tenant table(s), each writable by a signed-in user and refused to anon.\n`)

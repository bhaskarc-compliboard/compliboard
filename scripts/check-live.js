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

// *** NO DEFAULT, AND NO LITERAL. THE SAME SHAPE AS `TURN_SIGNING_SECRET`. ***
//
// This read `?? 'gamma@2026'` until 21 September — a working password for a real login,
// committed to the repository. `CLAUDE.md` §3.5: never write a password into a code file, and
// that rule has no staging exemption, because the exemption is how the pattern spreads to a
// file where the stakes are different.
//
// A default is worse than an absent value in the same way a default signing secret is: it makes
// the check appear to work while depending on something nobody declared. It also hid the
// password from a search of the places a password is DOCUMENTED, which cost a needless reset of
// a live fixture login on 21 September — the value was in the repo the whole time, in a file
// nobody thinks of as holding one.
//
// It REFUSES rather than falling back, so a missing value is a visible stop, not a mystery
// 'Invalid login credentials' from Supabase.
const fixturePassword = process.env.CHECK_LIVE_PASSWORD
if (!fixturePassword) {
  console.error('\n  REFUSED: CHECK_LIVE_PASSWORD is not set.')
  console.error('  This check signs in as a real staging fixture, and its password is not stored')
  console.error('  in this file. Put it in .env.local (gitignored) and run again.\n')
  process.exit(1)
}

const FIXTURE = { email: 'testgamma@example.com', password: fixturePassword }

const pub = createClient(url, anonKey, { auth: { persistSession: false } })
const { data: session, error: signInError } = await pub.auth.signInWithPassword(FIXTURE)
if (signInError) {
  console.error(`\n  Could not sign in as ${FIXTURE.email}: ${signInError.message}`)
  console.error('  CHECK_LIVE_PASSWORD is set but wrong, or the fixture login was changed.\n')
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
    // Append-only: `authenticated` holds INSERT and SELECT and no DELETE by design (025), so the
    // probe row cannot be removed as the user. Without this the check accumulated a row per run
    // — found on its second run, by its own "left behind" message.
    cleanupNeedsServiceRole: true,
  },
  {
    table: 'topics',
    row: { company_id: companyId, title: 'check:live probe' },
    cleanup: (db, id) => db.from('topics').delete().eq('id', id),
    note: 'added with migration 028, in the same change — adding a table here after the fact is how one gets missed',
    // `authenticated` holds no DELETE on `topics` (a topic is closed, not deleted), so the probe
    // row is removed with the service role rather than as the user. The check is about whether
    // the CALLER can write, not whether it can tidy up after itself.
    cleanupNeedsServiceRole: true,
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
    if (written?.id) {
      const cleaner = c.cleanupNeedsServiceRole
        ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
        : asUser
      const { error: delErr } = await c.cleanup(cleaner, written.id)
      if (delErr) console.log(`      (probe row ${written.id} left behind: ${delErr.message})`)
    }
  }
}

console.log()
if (failures > 0) {
  console.error(`  check:live FAILED — ${failures} problem(s). These are invisible to npm run check.\n`)
  process.exit(1)
}
console.log(`  check:live: ok — ${CASES.length} tenant table(s), each writable by a signed-in user and refused to anon.\n`)

/**
 * THE COMPANY THE OWNER SIGNS INTO FOR THE CARD WALK — My Account step 20 setup.
 *
 *   npm run stripe:fixture             create it (or print the one that exists)
 *   npm run stripe:fixture -- --reset  delete it and make a fresh one, back in its trial
 *   npm run stripe:fixture -- --clean  delete it
 *
 * A real company on STAGING, made through the real signup path, so it is not a special case:
 * `create_company_for_login` (migration 084) is the same function `/api/signup` calls, which means
 * the fixture gets the same defaults, the same primary site and the same trial as any customer.
 *
 * It is in **Trial, with no card**, which is where the walk starts. It carries its own tagged
 * email so nothing of the owner's other fixtures is disturbed, and `--reset` puts it back to the
 * beginning after a card has been added.
 *
 * The password is the one already in `.env.local` as `CHECK_LIVE_PASSWORD` — the same one the
 * other staging fixtures use. It is deliberately NOT printed here.
 */

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const EMAIL = 'bhaskar+step20@gmail.com'
const COMPANY = 'Step 20 Card Walk'

if (!existsSync('.env.local')) { console.error('\n  run this from the project root\n'); process.exit(1) }
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].trim()
}
const need = (n) => process.env[n] || (() => { console.error(`\n  ${n} is not set in .env.local\n`); process.exit(1) })()
const URL_ = need('NEXT_PUBLIC_SUPABASE_URL')
const PASSWORD = need('CHECK_LIVE_PASSWORD')
const db = createClient(URL_, need('SUPABASE_SERVICE_ROLE_KEY'))

const args = process.argv.slice(2)
const RESET = args.includes('--reset')
const CLEAN = args.includes('--clean')
const PORT = process.env.PORT ?? '3000'

const userOf = async () => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  return data.users.find((u) => u.email === EMAIL) ?? null
}

async function destroy() {
  const u = await userOf()
  if (u) {
    const { data: p } = await db.from('profiles').select('company_id').eq('id', u.id).maybeSingle()
    if (p?.company_id) {
      await db.from('companies').delete().eq('id', p.company_id)
      console.log('  deleted the company (its rows cascade)')
    }
    await db.auth.admin.deleteUser(u.id)
    console.log(`  deleted the login ${EMAIL}`)
  } else console.log('  nothing to delete')
}

if (CLEAN || RESET) { console.log('\n  clearing the previous fixture:'); await destroy() }
if (CLEAN) { console.log(); process.exit(0) }

let user = await userOf()
if (!user) {
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  })
  if (error) { console.error(`\n  could not create the login: ${error.message}\n`); process.exit(1) }
  user = data.user
  console.log(`\n  created the login ${EMAIL}`)
}

let { data: prof } = await db.from('profiles').select('company_id').eq('id', user.id).maybeSingle()
if (!prof?.company_id) {
  // The SAME function `/api/signup` calls, so this company is not a special case.
  const { data: companyId, error } = await db.rpc('create_company_for_login', {
    p_user_id: user.id, p_company_name: COMPANY, p_website: null,
  })
  if (error || typeof companyId !== 'string') {
    console.error(`\n  create_company_for_login failed: ${error?.message ?? 'no id returned'}\n`); process.exit(1)
  }
  prof = { company_id: companyId }
  console.log(`  created the company "${COMPANY}" through the real signup path`)
}

const { data: c } = await db.from('companies')
  .select('id, name, trial_ends_at, subscription_status, card_brand, card_last4, stripe_customer_id, stripe_subscription_id')
  .eq('id', prof.company_id).single()

const days = Math.round((Date.parse(c.trial_ends_at) - Date.now()) / 86400000)
console.log('\n  ┌─ SIGN IN AS ─────────────────────────────────────────────────────────┐')
console.log(`     URL        http://localhost:${PORT}/login`)
console.log(`     Email      ${EMAIL}`)
console.log('     Password   the same as the other staging fixtures —')
console.log('                CHECK_LIVE_PASSWORD in your .env.local. Not printed here.')
console.log(`     Then       http://localhost:${PORT}/account?tab=billing`)
console.log('  └──────────────────────────────────────────────────────────────────────┘')
console.log('\n  the company as it stands')
console.log(`    name                 ${c.name}`)
console.log(`    id                   ${c.id}`)
console.log(`    trial_ends_at        ${c.trial_ends_at}  (${days} days)`)
console.log(`    subscription_status  ${c.subscription_status ?? '(null)'}`)
console.log(`    card                 ${c.card_brand ?? '(none)'} ${c.card_last4 ?? ''}`)
console.log(`    stripe_customer_id   ${c.stripe_customer_id ?? '(none)'}`)
console.log(`    stripe_subscription  ${c.stripe_subscription_id ?? '(none)'}`)
if (c.subscription_status || c.stripe_customer_id) {
  console.log('\n  ⚠ this fixture has been through a walk already.')
  console.log('    `npm run stripe:fixture -- --reset` puts it back in a clean trial.')
} else {
  console.log('\n  Trial, no card, no Stripe customer — the walk starts here.')
}
console.log()

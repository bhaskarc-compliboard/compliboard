// Runs the resolution engine against a company on STAGING and prints what it produces.
// READ-ONLY: it writes nothing. Obligations are not persisted until
// close_and_replace_obligations exists (DECISIONS §47).
//
//   node --env-file=.env.local scripts/resolve-dryrun.js "Test Alpha Chemical"
//
// The number this exists to produce is the UNKNOWN breakdown: which facts we would have to
// establish before any of this turns into an answer. That list is the input to Phase 7.2.

import { createClient } from '@supabase/supabase-js'
import { resolve, coerceFact, isEstablished } from '../lib/resolve.ts'

const name = process.argv[2] ?? 'Test Alpha Chemical'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !svc) { console.error('Missing staging credentials in .env.local'); process.exit(1) }
const db = createClient(url, svc, { auth: { persistSession: false } })

const ref = url.replace('https://', '').split('.')[0]
console.log(`\n  Target : ${ref}   (STAGING)`)
console.log(`  Company: ${name}`)
console.log(`  Mode   : read-only — nothing is written\n`)

const { data: company } = await db.from('companies')
  .select('id, name, state, county, city, industry').eq('name', name).single()
if (!company) { console.error(`No company named ${name}`); process.exit(1) }

const { data: sites } = await db.from('entities')
  .select('id, name, state, county, city, fire_authority, is_primary')
  .eq('company_id', company.id).eq('entity_type', 'site')

const { data: rows } = await db.from('requirement_templates')
  .select('id, requirement_name, jurisdiction_layer, jurisdiction_state, jurisdiction_county, jurisdiction_city, entity_type, industries, applies_expression')
  .is('effective_to', null)

const { data: switches } = await db.from('switches').select('id, scope, value_type')
const scopeOf = Object.fromEntries(switches.map((s) => [s.id, s.scope]))

const { data: cs } = await db.from('company_switches')
  .select('switch_id, scope, entity_id, value, state').eq('company_id', company.id)

// A fact counts as established only when state = 'known' AND the value is READABLE.
// `company_switches.value` is text for every switch, so it has to be coerced back to the
// switch's own type: `'true' === true` is false in JavaScript, and an uncoerced boolean
// would read as a confident NO rather than as an unanswered question.
const valueTypeOf = Object.fromEntries(switches.map((s) => [s.id, s.value_type]))
const companyFacts = {}
const siteFacts = Object.fromEntries(sites.map((s) => [s.id, {}]))
let ignoredNotKnown = 0
for (const row of cs ?? []) {
  const vt = valueTypeOf[row.switch_id]
  if (!vt || !isEstablished(row.state, row.value, vt)) { ignoredNotKnown++; continue }
  const target = row.scope === 'site' && row.entity_id ? siteFacts[row.entity_id] : companyFacts
  if (target) target[row.switch_id] = coerceFact(row.value, vt)
}

// substance_inventory(entity_id, list), asked once per site per list and cached.
const LISTS = ['ehs', 'tri', 'psm', 'rmp', 'cercla', 'dea_list_i']
const invCache = new Map()
for (const s of sites) {
  for (const list of LISTS) {
    const { data } = await db.rpc('substance_inventory', { p_entity_id: s.id, p_list: list })
    invCache.set(`${s.id}|${list}`, data === null ? 'unknown' : data)
  }
}

const result = resolve({
  company,
  sites: sites.map((s) => ({
    id: s.id, name: s.name, isPrimary: s.is_primary,
    state: s.state, county: s.county, city: s.city, fireAuthority: s.fire_authority,
  })),
  requirements: rows.map((r) => ({
    id: r.id, name: r.requirement_name, layer: r.jurisdiction_layer,
    state: r.jurisdiction_state, county: r.jurisdiction_county, city: r.jurisdiction_city,
    entityType: r.entity_type, industries: r.industries ?? [],
    appliesExpression: r.applies_expression,
  })),
  companyFacts, siteFacts,
  inventory: (siteId, list) => invCache.get(`${siteId}|${list}`) ?? 'unknown',
})

const obs = result.obligations
const by = (p) => obs.filter(p).length
const line = '  ' + '─'.repeat(72)

console.log(`  ${sites.length} site(s) · ${rows.length} live library rows · ${cs?.length ?? 0} switch answers` +
            `${ignoredNotKnown ? ` (${ignoredNotKnown} ignored: not state='known')` : ''}`)
console.log(`  ${result.skippedOtherIndustry} row(s) skipped as another industry's\n`)
console.log(line)
console.log(`  ${obs.length} OBLIGATIONS`)
console.log(line)
for (const st of ['applies', 'does_not_apply', 'unknown', 'undetermined']) {
  const n = by((o) => o.status === st)
  const pct = obs.length ? ((n / obs.length) * 100).toFixed(1).padStart(5) : '  0.0'
  console.log(`  ${st.padEnd(16)} ${String(n).padStart(4)}   ${pct}%`)
}
console.log(line)

const unknown = obs.filter((o) => o.status === 'unknown')
const missSwitch = unknown.filter((o) => o.determinedBy.switches_missing.length > 0)
const missInv = unknown.filter((o) => o.determinedBy.inventory_missing.length > 0)
const missBoth = unknown.filter((o) => o.determinedBy.switches_missing.length > 0 && o.determinedBy.inventory_missing.length > 0)
const missJuris = unknown.filter((o) => o.determinedBy.switches_missing.length === 0 && o.determinedBy.inventory_missing.length === 0)

console.log(`\n  WHY ${unknown.length} ARE UNKNOWN — the list of what we would have to ask`)
console.log(line)
console.log(`  naming a missing SWITCH            ${String(missSwitch.length).padStart(4)}`)
console.log(`  naming a missing CHEMICAL INVENTORY${String(missInv.length).padStart(4)}`)
console.log(`  naming BOTH                        ${String(missBoth.length).padStart(4)}`)
console.log(`  naming neither (jurisdiction)      ${String(missJuris.length).padStart(4)}`)
console.log(line)

const freq = {}
for (const o of unknown) for (const s of o.determinedBy.switches_missing) freq[s] = (freq[s] ?? 0) + 1
const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1])
console.log(`\n  ${ranked.length} DISTINCT FACTS UNBLOCK ${unknown.length} REQUIREMENTS.`)
console.log(`  The twenty with the widest reach — this is the Phase 7.2 question order:\n`)
for (const [s, n] of ranked.slice(0, 20)) {
  console.log(`    ${String(n).padStart(3)}  ${s.padEnd(36)} ${scopeOf[s] ?? '?'}`)
}

const invFreq = {}
for (const o of unknown) for (const i of o.determinedBy.inventory_missing) invFreq[i] = (invFreq[i] ?? 0) + 1
if (Object.keys(invFreq).length) {
  console.log(`\n  Chemical-inventory lists that cannot answer:\n`)
  for (const [i, n] of Object.entries(invFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  substance_inventory(..., '${i}')`)
  }
}

const applies = obs.filter((o) => o.status === 'applies')
if (applies.length) {
  console.log(`\n  APPLIES (${applies.length}) — decided with no facts established:\n`)
  for (const o of applies) console.log(`    · ${o.requirementName}`)
}
const dna = obs.filter((o) => o.status === 'does_not_apply')
if (dna.length) {
  console.log(`\n  DOES_NOT_APPLY (${dna.length}) — every one needs evidence behind it:\n`)
  for (const o of dna.slice(0, 20)) console.log(`    · ${o.requirementName}  — ${o.resolutionRationale.slice(0, 70)}…`)
  if (dna.length > 20) console.log(`    … and ${dna.length - 20} more`)
}
// PER-SITE — the thing §20 says must work and nothing had demonstrated.
const perSite = obs.filter((o) => o.entityId !== null)
if (perSite.length) {
  console.log(`\n  PER-SITE OBLIGATIONS — ${sites.length} site(s)`)
  console.log(line)
  const nameOf = Object.fromEntries(sites.map((s) => [s.id, s.name]))
  for (const s of sites) {
    const mine = perSite.filter((o) => o.entityId === s.id)
    const n = (st) => mine.filter((o) => o.status === st).length
    console.log(`  ${s.name.padEnd(34)} applies ${String(n('applies')).padStart(3)} · ` +
      `does_not_apply ${String(n('does_not_apply')).padStart(3)} · unknown ${String(n('unknown')).padStart(3)}`)
  }
  console.log(line)
  // The demonstration: same requirement, same company, DIFFERENT answer by site.
  const byReq = {}
  for (const o of perSite) (byReq[o.requirementName] ??= {})[o.entityId] = o.status
  const differing = Object.entries(byReq).filter(([, m]) => new Set(Object.values(m)).size > 1)
  console.log(`\n  ${differing.length} REQUIREMENT(S) RESOLVE DIFFERENTLY AT DIFFERENT SITES`)
  console.log(`  — a company-wide answer would be wrong at one of them:\n`)
  for (const [name, m] of differing) {
    console.log(`    ${name}`)
    for (const [id, st] of Object.entries(m)) console.log(`        ${(nameOf[id] ?? id).padEnd(34)} ${st}`)
  }
}

const und = obs.filter((o) => o.status === 'undetermined')
if (und.length) {
  console.log(`\n  UNDETERMINED (${und.length}) — dead ends needing a person:\n`)
  for (const o of und) console.log(`    · ${o.requirementName}`)
}
console.log('')

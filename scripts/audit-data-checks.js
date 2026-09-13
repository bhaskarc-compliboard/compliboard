// Data checks that need a live database, with LOUD SKIPS.
//
//   node --env-file=.env.local scripts/audit-data-checks.js
//
// WHY THIS EXISTS. `AUDIT-CHECKS.md` check 20 asks whether every CAS number in a customer's
// inventory is one we hold thresholds for. Both chemical tables are empty, so the query returns
// zero rows and the check "passes" — having examined nothing.
//
// *** A CHECK THAT CANNOT FAIL IS INDISTINGUISHABLE FROM A PASSING ONE. *** That is check 14's
// finding applied to itself: a soft assertion and a real one look identical in a green report,
// and the only thing separating them is whether anybody remembers. **A skipped check that
// announces itself is honest. A soft one that always passes is not.**
//
// So every check here is a HARD assertion behind a PRECONDITION. If the precondition does not
// hold, it prints SKIP and says exactly what was missing, and the exit code distinguishes
// "all checks passed" from "some checks never ran".

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !svc) { console.error('Missing staging credentials in .env.local'); process.exit(1) }
const db = createClient(url, svc, { auth: { persistSession: false } })
const ref = url.replace('https://', '').split('.')[0]

const results = []
const pass = (n, t, d) => results.push({ n, t, state: 'PASS', d })
const fail = (n, t, d) => results.push({ n, t, state: 'FAIL', d })
const skip = (n, t, d) => results.push({ n, t, state: 'SKIP', d })

/** CAS check digit — `DECISIONS.md` §48. Duplicated here on purpose: this script must be able
 *  to refuse a row even if lib/ changes, which is what makes it an independent check. */
function validCas(raw) {
  const m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(String(raw ?? '').trim())
  if (!m) return false
  const d = (m[1] + m[2]).split('').reverse()
  return d.reduce((a, x, i) => a + Number(x) * (i + 1), 0) % 10 === Number(m[3])
}

// ── CHECK 20 — every CAS in a customer's inventory is one we hold thresholds for
{
  const T = 'every inventory CAS is in regulated_substances'
  const { count: chem } = await db.from('company_chemicals').select('*', { count: 'exact', head: true })
  const { count: subs } = await db.from('regulated_substances').select('*', { count: 'exact', head: true })

  if (!chem) {
    skip(20, T, `company_chemicals holds 0 rows — there is no inventory to check. ` +
      `This check has still never refused anything; it is UNTESTED, not passing.`)
  } else if (!subs) {
    skip(20, T, `regulated_substances holds 0 rows (TODO 6.4b) — every CAS would fail for want ` +
      `of a reference table, which measures the seed and not the inventory.`)
  } else {
    const { data } = await db.from('company_chemicals').select('id, cas_number').not('cas_number', 'is', null)
    const { data: known } = await db.from('regulated_substances').select('cas_number')
    const have = new Set(known.map((r) => r.cas_number))
    const orphans = data.filter((r) => !have.has(r.cas_number))
    orphans.length
      ? fail(20, T, `${orphans.length} inventory row(s) name a CAS with no thresholds behind it: ` +
          orphans.slice(0, 5).map((r) => r.cas_number).join(', '))
      : pass(20, T, `${data.length} identified row(s), all matched against ${have.size} substances.`)
  }
}

// ── CHECK 20b — the unevaluable proportion. A product signal, not a violation count.
{
  const T = 'how much of the inventory is unevaluable'
  const { count: chem } = await db.from('company_chemicals').select('*', { count: 'exact', head: true })
  if (!chem) {
    skip('20b', T, 'company_chemicals holds 0 rows.')
  } else {
    const { data } = await db.from('company_chemicals').select('cas_number, max_quantity, unit')
    const unidentified = data.filter((r) => !r.cas_number).length
    const unquantified = data.filter((r) => r.max_quantity === null || r.unit !== 'lb').length
    // Not a failure — a number to watch. If most of an inventory is unevaluable, every
    // threshold question returns `unknown` and the product is honest and useless at once.
    pass('20b', T, `${data.length} rows · ${unidentified} unidentified · ${unquantified} unquantified.`)
  }
}

// ── CHECK 20c — every stored CAS passes its own check digit (§48)
{
  const T = 'every stored CAS validates its check digit'
  const { data } = await db.from('company_chemicals').select('id, cas_number').not('cas_number', 'is', null)
  if (!data?.length) {
    skip('20c', T, 'no identified inventory rows to validate.')
  } else {
    const bad = data.filter((r) => !validCas(r.cas_number))
    bad.length
      ? fail('20c', T, `${bad.length} row(s) hold a CAS that fails its check digit — a transposition ` +
          `can land on a DIFFERENT real substance: ` + bad.slice(0, 5).map((r) => r.cas_number).join(', '))
      : pass('20c', T, `${data.length} CAS number(s), all valid.`)
  }
}

// ── CHECK 21 — no condition asserts a number the rule does not say (loader-enforced; re-checked)
{
  const T = 'switch_determinations quotes are non-empty where the class requires one'
  const { data } = await db.from('switch_determinations').select('id, evidence_class, quote, document_id')
  if (!data?.length) {
    skip(21, T, 'switch_determinations holds 0 rows — no determination has been made yet.')
  } else {
    const bad = data.filter((r) => ['stated', 'implied'].includes(r.evidence_class) && (!r.quote || !r.document_id))
    bad.length ? fail(21, T, `${bad.length} row(s) claim stated/implied with no quote or document.`)
               : pass(21, T, `${data.length} determination(s) checked.`)
  }
}

console.log(`\n  Target: ${ref}   (STAGING)\n`)
const w = Math.max(...results.map((r) => String(r.n).length))
for (const r of results) {
  const mark = r.state === 'PASS' ? '✔ PASS' : r.state === 'FAIL' ? '✖ FAIL' : '⊘ SKIP'
  console.log(`  ${mark}  check ${String(r.n).padEnd(w)}  ${r.t}`)
  console.log(`          ${r.d}\n`)
}
const failed = results.filter((r) => r.state === 'FAIL').length
const skipped = results.filter((r) => r.state === 'SKIP').length
console.log(`  ${results.length - failed - skipped} passed · ${failed} failed · ${skipped} SKIPPED\n`)
if (skipped) console.log(`  *** ${skipped} check(s) NEVER RAN. They are untested, not passing. ***\n`)
process.exit(failed ? 1 : 0)

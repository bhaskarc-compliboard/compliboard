// MUTATION CHECK — prove the safety tests can fail.
//
//   node scripts/mutation-check.js
//
// WHY. `HOW-WE-BUILD.md` §3: a validator that has only ever said PASS is untested. This is
// the first test suite in the codebase and every property it guards fails SILENTLY — a wrong
// answer here is a requirement quietly leaving a customer's list, not an error anyone sees.
// A green suite is not evidence. A suite that refuses nine deliberate breakages is.
//
// Each mutation is a plausible implementation, not obvious junk: the comparison inverted, the
// default flipped, a guard dropped — the shapes a reviewer would read past. For each one this
// records what a wrong implementation would have LOOKED like and which tests caught it.
//
// Every mutation is restored and the file verified byte-identical before the next runs.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const MUTATIONS = [
  {
    n: 1,
    property: 'unknown never becomes does_not_apply',
    file: 'lib/resolve.ts',
    looksLike: 'The binary branch. `verdict === true ? applies : does_not_apply` — one line, ' +
               'typechecks, and every unanswered requirement leaves the customer\'s list.',
    find: "      } else {\n        // UNKNOWN, not undetermined.",
    into: "      } else if (false) {\n        // UNKNOWN, not undetermined.",
    also: { find: "      } else if (verdict === false) {", into: "      } else if (verdict !== true) {" },
  },
  {
    n: 2,
    property: 'not(unknown) is unknown',
    file: 'lib/appliesExpression.ts',
    looksLike: '`return !v`. Reads correctly in English. `!\'unknown\'` is false in JavaScript, ' +
               'so every negated unanswered fact becomes a confident no.',
    find: "  return v === 'unknown' ? 'unknown' : !v",
    into: "  return !v as Truth",
  },
  {
    n: 3,
    property: 'any_of(false, unknown) is unknown — the OR table',
    file: 'lib/appliesExpression.ts',
    looksLike: 'Dropping the unknown check so OR falls through to false. Equivalent to writing ' +
               'the disjunction with `||` and coercing: an unanswered branch reads as settled.',
    find: "  if (vals.some((v) => v === 'unknown')) return 'unknown'\n  return false",
    into: "  return false",
  },
  {
    n: 4,
    property: 'all_of(true, unknown) is unknown — the AND table',
    file: 'lib/appliesExpression.ts',
    looksLike: 'The mirror: AND falls through to true. Errs toward over-inclusion rather than ' +
               'a false green, which is why it ranks below 3 — but it still asserts what nobody said.',
    find: "  if (vals.some((v) => v === 'unknown')) return 'unknown'\n  return true",
    into: "  return true",
  },
  {
    n: 5,
    property: 'a NULL expression is undetermined, never skipped',
    file: 'lib/resolve.ts',
    looksLike: '`if (!expr) continue`. The most natural line anyone would write. The requirement ' +
               'is absent from the list and indistinguishable from one that does not apply.',
    find: "      if (!r.appliesExpression) {\n        determinedBy.unresolvable_reason = 'no_expression'",
    into: "      if (!r.appliesExpression) {\n        continue\n        determinedBy.unresolvable_reason = 'no_expression'",
  },
  {
    n: 6,
    property: 'jurisdiction is decided before the expression',
    file: 'lib/resolve.ts',
    looksLike: 'Treating an out-of-jurisdiction row as merely unproven rather than contradicted — ' +
               'or, in its worse form, letting a true expression override the address. ' +
               'This is §24\'s incident: fewer rows, or wrong rows, and a 200 either way.',
    find: "      if (match === false) {",
    into: "      if (false) {",
  },
  {
    n: 7,
    property: 'a fact counts only when it is READABLE — text out of the database',
    file: 'lib/resolve.ts',
    looksLike: "`return t === 'true'`. The shorthand everyone writes. It turns every unreadable " +
               "answer — 'yes', 'Y', '1' — into a confident FALSE instead of an unanswered question.",
    find: "      if (lower === 'true') return true\n      if (lower === 'false') return false\n      return null // NOT false. An unreadable answer is an unanswered question.",
    into: "      return lower === 'true'",
  },
  {
    n: 8,
    property: 'a company-level expression is evaluated across ALL sites',
    file: 'lib/resolve.ts',
    looksLike: 'Evaluating the primary site only. Cheaper, obvious, and wrong at five of six ' +
               'facilities — §20 exactly. A statute owed because of one plant is never surfaced.',
    find: "      const against = perSite ? [target as Site] : orderedSites",
    into: "      const against = perSite ? [target as Site] : orderedSites.slice(0, 1)",
  },
  {
    n: 9,
    property: 'determined_by names the facts that are missing',
    file: 'lib/resolve.ts',
    looksLike: 'Leaving the array empty. Every status is still correct; the answer to "what ' +
               'would we have to ask" silently becomes nothing, and 7.2 has no work queue.',
    find: "      determinedBy.switches_missing = [...missingSwitches].sort()",
    into: "      determinedBy.switches_missing = []",
  },
]

const run = () => {
  try {
    const out = execFileSync('node', ['--test', 'tests/unit/*.test.ts'], { encoding: 'utf8' })
    return { out, ok: true }
  } catch (e) {
    return { out: (e.stdout ?? '') + (e.stderr ?? ''), ok: false }
  }
}

const counts = (out) => {
  const g = (k) => Number((out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')) ?? [])[1] ?? 0)
  return { tests: g('tests'), pass: g('pass'), fail: g('fail') }
}

const caught = (out) =>
  [...out.matchAll(/^\s*✖ (.+?) \(\d/gm)].map((m) => m[1])
    .filter((t) => !t.startsWith('tests/')).slice(0, 3)

console.log('\n  MUTATION CHECK — proving the safety suite can fail\n')
const base = run()
if (!base.ok) { console.error('  BASELINE IS ALREADY FAILING. Fix that first.\n' + base.out); process.exit(1) }
const b = counts(base.out)
console.log(`  baseline: ${b.pass}/${b.tests} passing\n`)

let allCaught = true
for (const m of MUTATIONS) {
  const original = readFileSync(m.file, 'utf8')
  let mutated = original
  for (const step of [m, ...(m.also ? [m.also] : [])]) {
    if (mutated.split(step.find).length - 1 !== 1) {
      console.error(`  #${m.n}: anchor not unique in ${m.file}`); process.exit(1)
    }
    mutated = mutated.replace(step.find, step.into)
  }
  writeFileSync(m.file, mutated)
  const r = run()
  writeFileSync(m.file, original)
  if (readFileSync(m.file, 'utf8') !== original) { console.error('RESTORE FAILED'); process.exit(1) }

  const c = counts(r.out)
  const ok = c.fail > 0
  if (!ok) allCaught = false
  console.log(`  ${ok ? '✔' : '✘ NOT CAUGHT'}  #${m.n}  ${m.property}`)
  console.log(`        wrong impl looks like: ${m.looksLike}`)
  console.log(`        result: ${c.fail} test(s) failed, ${c.pass} still passing`)
  if (c.fail) console.log(`        first caught by: ${caught(r.out).join(' · ')}`)
  console.log('')
}

const after = run()
console.log(`  every file restored; suite back to ${counts(after.out).pass}/${counts(after.out).tests} passing`)
console.log(`\n  ${allCaught ? 'ALL NINE MUTATIONS CAUGHT.' : '*** SOME MUTATIONS SURVIVED — those properties are untested. ***'}\n`)
process.exit(allCaught && after.ok ? 0 : 1)

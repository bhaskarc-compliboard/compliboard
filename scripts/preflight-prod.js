// PRODUCTION PRE-FLIGHT — prints its INPUTS, then derives the pending list in front of you.
//
//   npm run preflight
//
// WHY THIS IS A SCRIPT AND NOT A PARAGRAPH.  Six times in two days a migration name, a count,
// or a description of what a file does was wrong between the directory and the prompt. The
// naming rule was tightened twice and instances five and six happened afterwards.
//
// *** THE PROBLEM WAS NEVER THE RULE. A SUMMARY WRITTEN FROM CONTEXT WAS WEARING THE COSTUME
// OF A CHECK. *** A report that says "I diffed the history against the directory and found one
// pending file" is indistinguishable, on the page, from one that says it without having done
// it — and the reader has no way to tell, because the only thing shown is the conclusion.
//
// So this prints BOTH LISTS IN FULL and then the subtraction. The reader can do the diff
// themselves in one glance, and no claim about having diffed them is load-bearing.
//
//   A check that reports its CONCLUSION is a summary.
//   A check that reports its INPUTS is a check.
//
// READ-ONLY. It queries the migration history and lists a directory. It applies nothing.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'

const ref = process.env.SUPABASE_PROD_REF
if (!ref) { console.error('SUPABASE_PROD_REF is not set'); process.exit(1) }

const line = (c = '─') => console.log('  ' + c.repeat(74))

console.log(`\n  PRODUCTION PRE-FLIGHT`)
console.log(`  TARGET REF : ${ref}`)
console.log(`  PROD_URL   : ${process.env.SUPABASE_PROD_URL ? 'SET' : 'blank'}   ` +
            `PROD_KEY : ${process.env.SUPABASE_PROD_SERVICE_ROLE_KEY ? 'SET' : 'blank'}`)

// ---- INPUT 1, printed in full -------------------------------------------------
const onDisk = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
console.log(`\n  INPUT 1 — supabase/migrations/, every file (${onDisk.length}):`)
line()
for (const f of onDisk) console.log('    ' + f)

// ---- INPUT 2, printed in full -------------------------------------------------
let applied = []
try {
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--project-ref', ref, '--linked',
    '--agent', 'no', '-o', 'json',
    "select version || '_' || name as f from supabase_migrations.schema_migrations order by 1"],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  applied = JSON.parse(out).map((r) => r.f + '.sql')
} catch {
  console.error('\n  REFUSED: could not read the migration history. Nothing is claimed.\n')
  process.exit(1)
}
if (!applied.length) { console.error('\n  REFUSED: history came back empty.\n'); process.exit(1) }

console.log(`\n  INPUT 2 — supabase_migrations.schema_migrations on ${ref}, every row (${applied.length}):`)
line()
for (const f of applied) console.log('    ' + f)

// ---- THE SUBTRACTION, derived from the two printed lists ----------------------
const appliedSet = new Set(applied)
const diskSet = new Set(onDisk)
const pending = onDisk.filter((f) => !appliedSet.has(f))
const orphan = applied.filter((f) => !diskSet.has(f))

console.log(`\n  DERIVED — INPUT 1 minus INPUT 2:`)
line('═')
if (!pending.length) console.log('    (nothing pending)')
for (const f of pending) {
  console.log(`    ${f}`)
  const src = readFileSync(`supabase/migrations/${f}`, 'utf8').split('\n')
  const stmts = src
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /^\s*(alter|create|revoke|grant|drop|comment|insert|update|delete)\s/i.test(l))
  console.log(`      — ${stmts.length} statement(s), grepped from the file:`)
  for (const [n, l] of stmts) console.log(`          ${String(n).padStart(4)}: ${l.trim()}`)
}
console.log(`\n  DERIVED — INPUT 2 minus INPUT 1 (applied but absent from disk):`)
console.log(orphan.length ? orphan.map((f) => '    ' + f).join('\n') : '    (none)')
line('═')
console.log(`  PENDING COUNT: ${pending.length}`)
console.log(`\n  Both lists are above. The subtraction is checkable without trusting this script.\n`)

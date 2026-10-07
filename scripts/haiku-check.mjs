/**
 * THE HAIKU CHECK — CLAUDE.md §3.4a, HR Step 5b.
 *
 * Prints what EVERY task tier in lib/ai.ts resolves to in THIS process's environment, and exits 1 if any
 * is not Haiku. Run by `npm run haiku` before the command it guards; runnable alone to see the table.
 *
 * It asks lib/ai.ts itself (`modelForTask`), for every task named in its `AITask` type, rather than
 * reading variables: a tier's fallback chain lives in the code, and only the code can say where it lands.
 * Run with `--env-file=.env.local`, as the npm scripts are, so the table shows what wins over the file.
 */

import { HAIKU, aiTasks } from './haiku-names.mjs'
import { modelForTask } from '../lib/ai.ts'

const rows = aiTasks().map((task) => ({ task, model: modelForTask(task) }))
const bad = rows.filter((r) => r.model !== HAIKU)
console.log(`haiku check — every tier in lib/ai.ts must resolve to ${HAIKU}:`)
for (const r of rows) console.log(`  ${r.model === HAIKU ? '✓' : '✗'} ${r.task.padEnd(15)} ${r.model}`)
if (bad.length) {
  console.error(`haiku check: REFUSED — ${bad.length} tier(s) not on ${HAIKU}: ${bad.map((r) => `${r.task}=${r.model}`).join(', ')}`)
  process.exit(1)
}
console.log(`haiku check: ${rows.length} of ${rows.length} tiers on ${HAIKU}`)


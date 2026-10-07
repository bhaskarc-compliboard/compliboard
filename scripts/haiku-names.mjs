/**
 * The two names the Haiku guard needs, READ OUT OF THE CODE rather than typed (CLAUDE.md §9a):
 *   HAIKU     — the Haiku id, from the code's own constant in scripts/bakeoff-audit-report.js.
 *   modelVars — every model variable lib/ai.ts reads (AI_MODEL and every AI_MODEL_*), so a tier added
 *               later is covered without anybody remembering to add it here.
 *   aiTasks   — every task in lib/ai.ts's `AITask` type.
 */
import { readFileSync } from 'node:fs'
const root = new URL('..', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

const haiku = read('scripts/bakeoff-audit-report.js').match(/^const HAIKU = '([^']+)'/m)
if (!haiku) throw new Error('haiku guard: the HAIKU constant was not found in scripts/bakeoff-audit-report.js')
export const HAIKU = haiku[1]

export function modelVars() {
  return [...new Set(read('lib/ai.ts').match(/process\.env\.(AI_MODEL\w*)/g).map((m) => m.slice('process.env.'.length)))].sort()
}

export function aiTasks() {
  const t = read('lib/ai.ts').match(/export type AITask =([^\n]+)/)
  if (!t) throw new Error('haiku guard: `export type AITask` was not found in lib/ai.ts')
  return [...t[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
}

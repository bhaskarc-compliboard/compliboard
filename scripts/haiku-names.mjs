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

/**
 * *** IT REFUSES AN EMPTY LIST, AND THAT IS NOT BELT-AND-BRACES. ***
 *
 * This reads ONE line and takes the FIRST match, so two edits to `lib/ai.ts` make it read no tiers:
 * wrapping the union onto a second line, or writing the declaration's opening words in a comment
 * earlier in that file. On 2 November the second one happened for real, while this very hazard was
 * being written up: `npm run haiku:check` printed "0 of 0 tiers on claude-haiku-4-5" and **exited 0**.
 * A guard that passes because it found nothing is worse than no guard — `npm run haiku -- <command>`
 * would have let a build run spend Opus money with a green check beside it.
 *
 * So zero is a loud stop. `lib/ai.ts` has had at least fourteen tiers since October; it will never
 * legitimately have none. `CLAUDE.md` §9a: when a check reports an absence, prove it can see a
 * presence first.
 */
export function aiTasks() {
  const src = read('lib/ai.ts')
  const t = src.match(/export type AITask =([^\n]+)/)
  if (!t) throw new Error('haiku guard: the AITask declaration was not found in lib/ai.ts')
  const tasks = [...t[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  if (!tasks.length) {
    throw new Error(
      'haiku guard: the AITask declaration was found but holds no tiers, so this guard can see '
      + 'nothing and would pass on everything. Either the union was wrapped onto a second line, or '
      + 'a comment earlier in lib/ai.ts repeats the declaration\'s opening words and was matched '
      + 'instead. Matched: ' + JSON.stringify(t[0].slice(0, 120)))
  }
  return tasks
}

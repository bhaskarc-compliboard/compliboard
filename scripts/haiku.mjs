/**
 * `npm run haiku -- <command…>` — RUN A COMMAND WITH EVERY MODEL ON HAIKU. CLAUDE.md §3.4a, HR Step 5b.
 *
 * The owner's laptop (.env.local) runs every model on Opus, so his own tests show real quality. Claude
 * Code builds on Haiku, and does it HERE, in the command's own environment — never by editing .env.local.
 * Both Node's --env-file and Next's own loader leave a variable already set in the environment alone, so
 * what is set here wins over the file.
 *
 *   1. Sets AI_MODEL and every AI_MODEL_* that lib/ai.ts reads to the code's Haiku id.
 *   2. Runs scripts/haiku-check.mjs in that environment, with .env.local loaded as the npm scripts load it.
 *      It prints every tier and exits 1 if any is not Haiku — and then the command NEVER starts.
 *   3. Runs the command.
 *
 * HAIKU_GUARD_TEST_OVERRIDE=NAME=value is applied AFTER step 1, for one purpose: proving step 2 refuses.
 */
import { spawnSync, spawn } from 'node:child_process'
import { HAIKU, modelVars } from './haiku-names.mjs'

const cmd = process.argv.slice(2)
if (!cmd.length) { console.error('usage: npm run haiku -- <command…>'); process.exit(2) }

const env = { ...process.env }
for (const v of modelVars()) env[v] = HAIKU
const override = process.env.HAIKU_GUARD_TEST_OVERRIDE
if (override) { const i = override.indexOf('='); env[override.slice(0, i)] = override.slice(i + 1) }
delete env.HAIKU_GUARD_TEST_OVERRIDE

const check = spawnSync(process.execPath, ['--env-file-if-exists=.env.local', 'scripts/haiku-check.mjs'], { env, stdio: 'inherit' })
if (check.status !== 0) { console.error(`haiku guard: NOT starting: ${cmd.join(' ')}`); process.exit(1) }

console.log(`haiku guard: starting: ${cmd.join(' ')}`)
const child = spawn(cmd[0], cmd.slice(1), { env, stdio: 'inherit' })
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 1))
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s))

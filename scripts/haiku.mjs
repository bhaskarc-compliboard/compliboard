/**
 * `npm run haiku -- <command…>` — RUN A COMMAND WITH EVERY MODEL ON HAIKU. CLAUDE.md §3.4a, HR Step 5b.
 *
 * The owner's laptop (.env.local) runs every model on Opus, so his own tests show real quality. Claude
 * Code builds on Haiku, and does it HERE, in the command's own environment — never by editing .env.local.
 * Both Node's --env-file and Next's own loader leave a variable already set in the environment alone, so
 * what is set here wins over the file.
 *
 *   1. Sets AI_MODEL and every AI_MODEL_* that lib/ai.ts reads to the code's Haiku id — and, unless the command's
 *      own environment already sets it, HR_HANDBOOK_BUDGET_TOKENS to HAIKU_HANDBOOK_BUDGET_TOKENS (below).
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

/**
 * THE HANDBOOK SIZE ON HAIKU (the owner, 8 October 2026). HR's default sends handbooks whole up to what fits in one
 * call on claude-opus-5-5 (`lib/hrAnswer.ts` OPUS_HANDBOOK_BUDGET_TOKENS, 650,000), but Haiku 4.5's context window is
 * 200K tokens (its overview page, platform.claude.com/docs/en/models/haiku-4-5/overview). Room for handbooks on Haiku:
 *
 *   200,000 − 32,000 (the answer, twice, for one retry) − 10,000 (instructions, tool prompt, company, question)
 *           − 20,000 (the conversation so far, on a test)  − 50,000 (2 searches × 25,000: DEV_MAX_SEARCHES is 2)
 *         =  88,000 Haiku tokens of handbook text
 *         ≈ 322,000 characters at Haiku's own 0.273 tokens a character (measured, HR Step 6 design point 6)
 *         ≈ 129,000 tokens as the budget counts them (0.4 a character, `lib/hrAnswer.ts` TOKENS_PER_CHAR)
 *         → 120,000, rounded down. Measured on 8 October at this value: HR answers read about 170,000 tokens in all.
 */
export const HAIKU_HANDBOOK_BUDGET_TOKENS = '120000'

const env = { ...process.env }
for (const v of modelVars()) env[v] = HAIKU
// A command that sets its own size (a test of the parts) keeps it.
if (!process.env.HR_HANDBOOK_BUDGET_TOKENS) env.HR_HANDBOOK_BUDGET_TOKENS = HAIKU_HANDBOOK_BUDGET_TOKENS
const override = process.env.HAIKU_GUARD_TEST_OVERRIDE
if (override) { const i = override.indexOf('='); env[override.slice(0, i)] = override.slice(i + 1) }
delete env.HAIKU_GUARD_TEST_OVERRIDE

const check = spawnSync(process.execPath, ['--env-file-if-exists=.env.local', 'scripts/haiku-check.mjs'], { env, stdio: 'inherit' })
if (check.status !== 0) { console.error(`haiku guard: NOT starting: ${cmd.join(' ')}`); process.exit(1) }

console.log(`haiku guard: starting: ${cmd.join(' ')}`)
const child = spawn(cmd[0], cmd.slice(1), { env, stdio: 'inherit' })
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 1))
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s))

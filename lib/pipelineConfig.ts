/**
 * EVERY PIPELINE PIECE IS A SWITCH. — `TODO.md` R1.1, `DECISIONS.md` §113.
 *
 * A five-question benchmark against raw Claude and ChatGPT found CompliBoard weaker on most,
 * and the diagnosis was that each piece of the pipeline subtracts: the prompt fences the model,
 * search leads instead of checking, the gate blocks too readily through a chemical-manufacturing
 * vocabulary, and nothing offers to help further.
 *
 * *** THE PIPELINE IS NOT DELETED. IT IS SWITCHED OFF. ***
 *
 * > The release mechanism and the experiment framework are the same thing.
 *
 * That is the whole reason this is config rather than a branch or a deletion: there is no
 * separate experiment branch to keep alive, nothing to rebuild when a piece earns its way back,
 * and **rollback is one environment value.** Production runs every switch OFF; staging runs
 * whatever R&D is testing.
 *
 * ---------------------------------------------------------------------------
 * OFF MEANS THE CODE PATH IS NOT ENTERED.
 *
 * Not "entered and its output discarded". A gate that runs and has its answer thrown away still
 * costs the latency, still spends the tokens, and still appears in the logs as though it decided
 * something. Worse, it keeps the piece's failure modes live while removing the evidence that they
 * fired. Every consumer of this module must branch BEFORE the work, never after it.
 * ---------------------------------------------------------------------------
 *
 * EVERY SWITCH DEFAULTS TO OFF, AND THE DEFAULT IS THE PRODUCT'S BEHAVIOUR. An unset variable is
 * not a missing configuration to be warned about — it is the open baseline, which is what
 * production runs. A variable is only ever set to turn a piece ON for a measurement.
 */

/** §113's six, switched OFF to reach the baseline — plus the pieces R1.2 onward measures
 *  back ON, one at a time. Names match the environment variables exactly. */
export type PipelineSwitch =
  | 'RESEARCH_GATE'
  | 'RESEARCH_FACTS_BLOCK'
  | 'RESEARCH_LONG_PROMPT'
  | 'CHECKLIST_GATE'
  | 'CHECKLIST_CRITIC'
  | 'CHECKLIST_LONG_PROMPT'
  // R1.2 step one. NOT one of §113's six — those switch pieces OFF to reach the baseline;
  // this is the first piece being measured back ON, and it ships only if it beats the
  // baseline on the owner's comparison. `DECISIONS.md` §124.
  | 'RESEARCH_PREFER_GOV'
  // R1.3. Same standing as RESEARCH_PREFER_GOV: measured back on, ships only if the owner's
  // comparison says so. `DECISIONS.md` §128.
  | 'RESEARCH_SPECIALIST'

export const PIPELINE_SWITCHES: readonly PipelineSwitch[] = [
  'RESEARCH_GATE',
  'RESEARCH_FACTS_BLOCK',
  'RESEARCH_LONG_PROMPT',
  'CHECKLIST_GATE',
  'CHECKLIST_CRITIC',
  'CHECKLIST_LONG_PROMPT',
  'RESEARCH_PREFER_GOV',
  'RESEARCH_SPECIALIST',
] as const

/**
 * ONE SPELLING OF TRUE, AND EVERYTHING ELSE IS FALSE.
 *
 * Deliberately strict. A permissive reader that accepts "yes", "on" and "1" also accepts
 * "flase" and "ture" as false, silently — and a switch that silently reads false is
 * indistinguishable from one that was never set. The only value that turns a piece on is the
 * exact string `true`, case-insensitively, after trimming. Anything else is off, and
 * `describe()` below prints what it actually saw so a typo is visible in the log rather than
 * inferred from behaviour.
 */
function readSwitch(name: PipelineSwitch): boolean {
  return String(process.env[name] ?? '').trim().toLowerCase() === 'true'
}

/**
 * Read one switch. Called at the decision point, not cached at module load, so a test can set
 * the environment and a serverless instance that is reused across a config change sees the new
 * value rather than the one it booted with.
 */
export function pipelineSwitch(name: PipelineSwitch): boolean {
  return readSwitch(name)
}

/** Every switch, resolved now. */
export function pipelineConfig(): Record<PipelineSwitch, boolean> {
  return Object.fromEntries(
    PIPELINE_SWITCHES.map((s) => [s, readSwitch(s)]),
  ) as Record<PipelineSwitch, boolean>
}

/**
 * A single line naming every switch, its resolved value, and the raw string behind it.
 *
 * The raw value is included on purpose: `RESEARCH_GATE=True ` and `RESEARCH_GATE=ture` both
 * resolve to OFF, and only one of those is what somebody meant. Printing the resolved value
 * alone would make a typo look like a deliberate setting.
 */
export function describePipelineConfig(): string {
  const parts = PIPELINE_SWITCHES.map((s) => {
    const raw = process.env[s]
    const on = readSwitch(s)
    const shown = raw === undefined ? 'unset' : JSON.stringify(raw)
    return `${s}=${on ? 'ON' : 'off'}(${shown})`
  })
  const anyOn = PIPELINE_SWITCHES.some(readSwitch)
  return `pipeline: ${anyOn ? 'MODIFIED BASELINE' : 'OPEN BASELINE (all off)'} · ${parts.join(' · ')}`
}

/**
 * Log the resolved state ONCE per process, so a deploy's mode is in the logs rather than
 * reconstructed from behaviour afterwards.
 *
 * Module-level state is the right scope here: one serverless instance is one process, and the
 * question this answers — "what was this instance running?" — is a per-instance question. It is
 * called from the route rather than at import time so that importing the module for a test does
 * not write to the log.
 */
let logged = false
export function logPipelineConfigOnce(): void {
  if (logged) return
  logged = true
  console.log(describePipelineConfig())
}

/** Test seam: lets a unit test assert the once-only behaviour without a new process. */
export function __resetPipelineConfigLogForTests(): void {
  logged = false
}

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Content can be plain text, or Claude-style blocks (PDF, image, text)
export type AIContent = string | any[]

/**
 * WHAT THIS CALL IS FOR. Model routing is by TASK, never by a model name at the call site —
 * `CLAUDE.md` §3.4: model and task routing are private constants inside this module.
 *
 * The tiers exist because of a measured asymmetry, not a cost preference:
 * **critique is cheap and reliable; generation is expensive and fragile.** A model reviewing a
 * written artifact has an anchor (§3.3); a model producing an answer from a question has none.
 * Running the critic on the same tier as the thing it reviews gives up the whole advantage —
 * which is why `docs/CRITIC-PASS.md` §0 calls this a prerequisite rather than a refinement.
 *
 * `DECISIONS.md` §5 allocates them:
 *   judgement — the determination gate and identification. Decisions, not prose.
 *   critique  — THE STRONGEST. Stage 5. The one pass whose whole job is finding what is wrong.
 *   prose     — sub-step expansion and narrative. Cheap; nothing here decides anything.
 *   default   — everything not yet classified, so an unrouted call is loud in a grep and
 *               not silently downgraded.
 */
export type AITask = 'judgement' | 'critique' | 'prose' | 'default'

export interface AskAIOptions {
  maxTokens?: number
  /** Prefer `task`. A literal model name here is an escape hatch and overrides routing. */
  model?: string
  /** What this call is for. Routes to a tier — see AITask. */
  task?: AITask
  /** Lower = more consistent/deterministic, higher = more varied.
   *  Default (unset) uses the API's own default, which favors variety —
   *  fine for conversational answers, too loose for yes/no judgment calls.
   *  Pass a low value (e.g. 0.1) for anything deciding a status or fact. */
  temperature?: number
  /** Gives Claude the web_search tool for this call. Claude decides for
   *  itself whether a given fact is stable (answer from knowledge) or
   *  time-sensitive/specific (verify live) — no hardcoded trigger list.
   *  This is a server-side tool: Anthropic runs the search and returns the
   *  final answer in this same call, no second round-trip needed. */
  enableWebSearch?: boolean
}

/**
 * TASK → MODEL. Private to this module, per CLAUDE.md §3.4.
 *
 * Each is overridable by environment so a tier can be moved without a deploy, and each falls
 * back to AI_MODEL and then to a named default — so a missing variable degrades to the
 * current behaviour rather than to an error or to an empty model string.
 */
const TASK_MODELS: Record<AITask, () => string> = {
  // The strongest tier. Stage 5 reviews an artifact for errors that reached a customer;
  // it is the last thing between a wrong answer and somebody acting on it.
  //
  // VERIFIED REACHABLE ON THIS ACCOUNT, 12 Sep, not taken from memory: the first version of
  // this line said `claude-opus-4-1`, which returned 404 `not_found_error` on the first run.
  // Probed instead — opus-5, sonnet-5, fable-5-1, haiku-4-5 and sonnet-4-5 all answer;
  // opus-4-1 and opus-4-20250514 do not (the latter is past end-of-life).
  critique:  () => process.env.AI_MODEL_CRITIQUE  || process.env.AI_MODEL || 'claude-opus-5',
  // Decisions rather than prose: the determination gate, identification, classification.
  judgement: () => process.env.AI_MODEL_JUDGEMENT || process.env.AI_MODEL || 'claude-sonnet-4-5',
  // Narrative expansion. Nothing here decides applicability.
  prose:     () => process.env.AI_MODEL_PROSE     || process.env.AI_MODEL || 'claude-sonnet-4-5',
  default:   () => process.env.AI_MODEL           || 'claude-sonnet-4-5',
}

/** Exported for the golden runner, which must call the same model the route would. */
export function modelForTask(task: AITask = 'default'): string {
  return TASK_MODELS[task]()
}

/**
 * *** THE CLAUDE 5 FAMILY REJECTS `temperature` OUTRIGHT. ***
 *
 * Not "ignores it" — a 400: `invalid_request_error: \`temperature\` is deprecated for this
 * model.` Probed against this account on 12 September:
 *
 *   claude-opus-5              REJECTS temperature
 *   claude-sonnet-5            REJECTS temperature
 *   claude-fable-5-1           REJECTS temperature
 *   claude-haiku-4-5-20251001  accepts
 *   claude-sonnet-4-5          accepts
 *
 * THIS WAS A LATENT BUG BEFORE TASK ROUTING EXISTED, and routing only surfaced it. Six call
 * sites pass `temperature: 0.1` — the determination gate, both audit classify calls, the
 * audit match call, document review. Setting `AI_MODEL=claude-sonnet-5`, which reads like an
 * ordinary upgrade, would have 400'd every one of them and left the gate returning nothing.
 *
 * So the parameter is DROPPED rather than passed, for models that do not take it. Dropping is
 * right rather than erroring: temperature 0.1 means "be deterministic", and these models are
 * deterministic by default — the intent survives, only the knob is gone. It is logged once
 * per call so it is greppable rather than silent.
 *
 * Matched on the major version immediately after the tier name, so `claude-sonnet-4-5` and
 * `claude-haiku-4-5-...` are correctly excluded — their major version is 4.
 */
export function modelAcceptsTemperature(model: string): boolean {
  return !/^claude-[a-z]+-5(?:[.-]|$)/.test(model)
}

/**
 * THE PIPE.
 * Takes instructions (a prompt) + something to work on, sends it to
 * whichever model is configured, returns the answer as text.
 * Every AI call in CompliBoard goes through here. Never duplicate this.
 */
export async function askAI(
  systemPrompt: string,
  content: AIContent,
  options: AskAIOptions = {}
): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'claude'
  let maxTokens = options.maxTokens ?? 2000
  const HARD_CEILING = 32000
  const MAX_RETRIES = 2

  if (provider === 'claude') {
    const model = options.model || modelForTask(options.task)
    const wantsTemperature = options.temperature !== undefined
    const sendTemperature = wantsTemperature && modelAcceptsTemperature(model)
    if (wantsTemperature && !sendTemperature) {
      console.warn(`AI: dropping temperature=${options.temperature} — ${model} does not accept it. The model is deterministic by default, so the intent is preserved.`)
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const message = await anthropic.messages.create({
        // A literal `model` wins, then the task tier, then the single AI_MODEL. Before
        // 12 Sep this line was `options.model || AI_MODEL || 'claude-sonnet-4-5'` — one
        // model for everything, including the critic.
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: content as any }],
        ...(sendTemperature ? { temperature: options.temperature } : {}),
        ...(options.enableWebSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search' }] } : {}),
      } as any)

      // With tools enabled, the response can include search/tool-use blocks
      // before the actual answer — concatenate every text block, in order,
      // rather than assuming the first block is the answer.
      const text = message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')

      // stop_reason is the deterministic signal for truncation — not a guess.
      // If the response was genuinely cut off by the token budget, retry with
      // a bigger one automatically rather than surface a broken result and
      // wait for a human to manually raise a number after the fact.
      if ((message as any).stop_reason === 'max_tokens' && maxTokens < HARD_CEILING && attempt < MAX_RETRIES) {
        maxTokens = Math.min(maxTokens * 2, HARD_CEILING)
        console.warn(`AI response truncated (stop_reason=max_tokens), retrying with maxTokens=${maxTokens}`)
        continue
      }

      return text
    }
    return ''
  }

  throw new Error(`Unknown AI_PROVIDER: "${provider}". Supported: claude`)
}

/**
 * Same as askAI, but for when we expect JSON back.
 * Strips markdown fences and parses. Used by review, extract-dates, audit.
 */
export async function askAIJson<T = any>(
  systemPrompt: string,
  content: AIContent,
  options: AskAIOptions = {}
): Promise<T> {
  const raw = await askAI(systemPrompt, content, options)
  let cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  // With web search enabled, Claude sometimes narrates what it's about to do
  // ("I'll search for...") in a text block before the actual JSON answer.
  // Extract just the JSON object/array itself, tolerating any narration
  // wrapped around it, rather than assuming the whole response is pure JSON.
  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')
  const start = firstBrace === -1 ? firstBracket : (firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket))
  if (start > 0) {
    const isObject = cleaned[start] === '{'
    const end = isObject ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']')
    if (end > start) {
      cleaned = cleaned.slice(start, end + 1)
    }
  }

  return JSON.parse(cleaned) as T
}

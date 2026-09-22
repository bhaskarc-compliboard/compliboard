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

/** One thing the answer cited. Deduplicated by URL — one source, one number. */
export interface Source {
  n: number
  title: string
  url: string
}

export interface AIAnswer {
  text: string
  sources: Source[]
}

/**
 * REASSEMBLE THE PROSE, AND KEEP THE CITATIONS.
 *
 * *** WHY THIS EXISTS: THE API SPLITS A SENTENCE INTO SEVERAL TEXT BLOCKS. ***
 *
 * With web search on, one paragraph comes back as many blocks — one per cited span, with the
 * uncited connective tissue in blocks of its own. Dumped from a real response:
 *
 *    6  text len=85  citations=0  "**Effective date.** Oregon DEQ's current 1200-Z "
 *    7  text len=80  citations=1  "took effect July 1, 2026, replacing the prior ve…"
 *    8  text len=2   citations=0  ". "
 *
 * **Joining those with "\n" put a line break inside a sentence and left the full stop on a line
 * of its own** — which is exactly what a customer saw: a lone "." under a deadline, a ", and"
 * stranded on its own line. Every stray break was a dropped citation.
 *
 * **So: join with NOTHING.** Adjacent text blocks are one continuous passage. Paragraph breaks
 * come only from the model's own text — block 16 above begins ".\n\n**No exposure…" — never from
 * a block boundary.
 *
 * *** AND THE MARKER GOES AFTER THE PUNCTUATION, THE WAY A FOOTNOTE DOES. ***
 * The cited span ends at the end of block 7, but the sentence ends in block 8. A marker placed
 * at the block boundary would read "…prior version[1]. " instead of "…prior version.[1]". The
 * shift below moves it past any punctuation that immediately follows.
 */
export function reassemble(content: Array<Record<string, unknown>>): AIAnswer {
  // A private-use sentinel: it cannot occur in model prose, so moving it past punctuation
  // afterwards cannot disturb the text itself.
  const OPEN = '', CLOSE = ''
  const byUrl = new Map<string, Source>()
  let out = ''

  for (const block of content) {
    if (block.type !== 'text') continue
    out += String(block.text ?? '')
    const citations = (block.citations ?? []) as Array<{ url?: string; title?: string }>
    // THE SAME SOURCE CITED TWICE GETS ONE NUMBER. Dedupe by URL, in first-seen order.
    const ns: number[] = []
    for (const c of citations) {
      if (!c?.url) continue
      let src = byUrl.get(c.url)
      if (!src) {
        src = { n: byUrl.size + 1, title: (c.title || c.url).trim(), url: c.url }
        byUrl.set(c.url, src)
      }
      if (!ns.includes(src.n)) ns.push(src.n)
    }
    for (const n of ns) out += `${OPEN}${n}${CLOSE}`
  }

  // Move each marker past punctuation that follows it, repeatedly — ". " and ".)" both occur.
  let prev: string
  do {
    prev = out
    out = out.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}([.,;:!?)\\]]+)`, 'g'), '$2' + OPEN + '$1' + CLOSE)
  } while (out !== prev)

  // Collapse a run of adjacent markers into one bracket group: [1][2] -> [1][2] is fine to read,
  // but [1] [2] with a space is not what a footnote looks like, so they stay tight.
  out = out.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'), '[$1]')

  return { text: out, sources: [...byUrl.values()] }
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
  return (await askAIWithCitations(systemPrompt, content, options)).text
}

/**
 * The same call, keeping the sources.
 *
 * `askAI` returns only the prose and every existing caller is unchanged. The research answer
 * uses this one, because **a saved answer that has lost its sources has lost the thing
 * "cite generously" was for** (`DECISIONS.md` §77 item 4).
 */
export async function askAIWithCitations(
  systemPrompt: string,
  content: AIContent,
  options: AskAIOptions = {}
): Promise<AIAnswer> {
  const provider = process.env.AI_PROVIDER || 'claude'
  /**
   * *** THE CEILING IS THE SDK'S, AND IT IS READ FROM THE SDK RATHER THAN CHOSEN. ***
   *
   * `@anthropic-ai/sdk` refuses a NON-STREAMING request it estimates could run past ten
   * minutes — `client.js:671`, `calculateNonstreamingTimeout`:
   *
   *     const maxTime     = 60 * 60 * 1000          // 60 minutes
   *     const defaultTime = 60 * 10 * 1000          // 10 minutes
   *     const expectedTime = (maxTime * maxTokens) / 128000
   *     if (expectedTime > defaultTime) throw 'Streaming is required for operations that
   *                                            may take longer than 10 minutes.'
   *
   * Solving it: maxTokens > 600000 * 128000 / 3600000 = 21333.33, so **21333 is the largest
   * value that does not throw** and 21334 does. Checked by evaluating the expression, not by
   * reading the sentence.
   *
   * WHY IT WAS 32000 AND WHY THAT WAS A DEFECT. The retry below DOUBLES the budget when a
   * response is truncated. The critic asks for 12000 (`criticPass.ts`), so one truncation took
   * it to 24000 — past the ceiling — and **the SDK threw before sending anything.** That
   * surfaced as an HTTP 500 on `/api/chat` checklist mode after ~200 s, on the customer's path.
   * `DECISIONS.md` §99, §100.
   *
   * **A budget that cannot be sent is not a budget.** The clamp applies to the caller's own
   * value too: a call that ASKS for 24000 would crash in exactly the same way.
   *
   * THE HONEST BEHAVIOUR AT THE LIMIT ALREADY EXISTS. A response that is still truncated at
   * 21333 returns with `stop_reason === 'max_tokens'` and the critic records
   * `complete: false` — which `lib/criticPass.ts` exists to carry, because *truncation and
   * cleanliness are indistinguishable in an empty array*. **A review that stops at its limit
   * and says so is correct; one that crashes the request is not.**
   *
   * Streaming removes this ceiling entirely and is `TODO.md` 0.11 — it is the real fix, and it
   * is a separate change because it also answers §92's 58.9 s first turn.
   */
  const SDK_NONSTREAMING_MAX_TOKENS = 21333
  let maxTokens = Math.min(options.maxTokens ?? 2000, SDK_NONSTREAMING_MAX_TOKENS)
  if ((options.maxTokens ?? 0) > SDK_NONSTREAMING_MAX_TOKENS) {
    console.warn(
      `AI: maxTokens ${options.maxTokens} exceeds the SDK's non-streaming ceiling ` +
      `(${SDK_NONSTREAMING_MAX_TOKENS}); clamped. A larger budget needs streaming — TODO 0.11.`)
  }
  const HARD_CEILING = SDK_NONSTREAMING_MAX_TOKENS
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

      // With tools enabled, the response can include search/tool-use blocks before the actual
      // answer, AND the answer itself arrives split across many text blocks. `reassemble` joins
      // them into continuous prose and keeps the citations — see its comment for the block dump
      // that forced it.
      const answer = reassemble(message.content as unknown as Array<Record<string, unknown>>)

      // stop_reason is the deterministic signal for truncation — not a guess.
      // If the response was genuinely cut off by the token budget, retry with
      // a bigger one automatically rather than surface a broken result and
      // wait for a human to manually raise a number after the fact.
      if ((message as any).stop_reason === 'max_tokens' && maxTokens < HARD_CEILING && attempt < MAX_RETRIES) {
        maxTokens = Math.min(maxTokens * 2, HARD_CEILING)
        console.warn(`AI response truncated (stop_reason=max_tokens), retrying with maxTokens=${maxTokens}`)
        continue
      }

      return answer
    }
    return { text: '', sources: [] }
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
  return JSON.parse(extractJsonText(raw)) as T
}

/**
 * PULL THE JSON OUT OF A REPLY THAT MAY HAVE PROSE AROUND IT.
 *
 * Exported so the open call's checklist path uses this exact logic rather than a second copy
 * of it — `CLAUDE.md` §3.4: JSON extraction tolerant of narration lives in this module and is
 * not reimplemented at a call site.
 */
export function extractJsonText(raw: string): string {
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

  return cleaned
}

/* ===========================================================================
 * THE OPEN CALL — `TODO.md` R1.0, `DECISIONS.md` §113.
 *
 * > "this section needs no barrier between Claude and an answer."
 *
 * One system sentence of role, the conversation as history, web search available with the
 * MODEL deciding whether to use it, and a stream. No gate, no facts block, no scenario block,
 * no critic, no prohibitions, no template — those are switches now (`lib/pipelineConfig.ts`),
 * and production runs them off.
 *
 * This does NOT replace `askAIWithCitations`; that stays for every existing caller. Research
 * and checklist move here because they are the two paths §113 measured.
 * =========================================================================== */

/** One turn. `content` may carry document blocks, so it is the same shape `askAI` accepts. */
export interface OpenMessage {
  role: 'user' | 'assistant'
  content: AIContent
}

/**
 * What the caller sees while the answer is being written.
 *
 * `reset` is the interesting one and it exists because of the narration rule below: in a stream
 * you cannot know a text block was narration until a search follows it. So the text is emitted
 * as it arrives and withdrawn if it turns out to have been narration. The alternative —
 * buffering the opening text until the message ends — would mean NOT STREAMING AT ALL for every
 * answer that does not search, which is most of them (samples 2 and 3 below).
 */
export type OpenStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'reset' }
  | { type: 'searching'; query: string | null }
  | { type: 'done'; answer: AIAnswer; stopReason: string | null; outputTokens: number | null }
  | { type: 'error'; message: string }

/**
 * *** THE NARRATION RULE, AND THE EVIDENCE IT CAME FROM. ***
 *
 * With web search available the model often opens by saying what it is about to do. That
 * narration is not the answer, and concatenating every text block — which `reassemble` does —
 * puts it at the top of what the customer reads and what we store.
 *
 * THREE SAMPLES, recorded 22 Sep from real streamed calls with the tool attached, one system
 * sentence, no other context. Block sequences, in order:
 *
 *   SAMPLE 1  "Oregon cannabis extraction lab using butane — licenses and safety"
 *     0  text                    len=126  cites=0  "I'll help you understand the licensing and safety requiremen"
 *     1  server_tool_use                           query="Oregon cannabis extraction lab butane license requ…"
 *     2  server_tool_use                           query="Oregon cannabis butane extraction safety regulatio…"
 *     3  server_tool_use                           query="Oregon OLCC cannabis processor license extraction"
 *     4  web_search_tool_result  results=9
 *     5  web_search_tool_result  results=9
 *     6  web_search_tool_result  results=9
 *     7  text                    len=198  cites=0  "Based on my research, here's what you need to know about ope"
 *     8  text                    len=185  cites=1  "The processing of marijuana items is subject to regulation b"
 *     …  (35 more text blocks, the answer)
 *
 *   SAMPLE 2  "Do I need workers' comp insurance?"        — no search
 *     0  text                    len=1194 cites=0  "I'd be happy to help you understand whether you need workers"
 *
 *   SAMPLE 3  "SDS versus container label under OSHA HazCom" — no search
 *     0  text                    len=3355 cites=0  "I'll help you understand the differences between Safety Data"
 *
 * **Samples 2 and 3 are why the rule cannot be "drop an opening block that sounds like
 * narration".** Those openings read exactly like sample 1's — *"I'll help you understand…"* —
 * and they are the entire answer. A phrasing heuristic would have deleted both.
 *
 * > ### THE RULE: a text block is narration IF AND ONLY IF a `server_tool_use` block appears
 * > ### LATER in the same response. No tool use, nothing is dropped.
 *
 * It is positional, not linguistic, so it cannot be fooled by how a sentence is worded.
 *
 * **The limit, stated rather than discovered later:** if a model ever writes real answer content,
 * *then* searches, this drops that content. Nothing in three samples does that — in all three the
 * pre-search text is a single block carrying **zero citations** — but it is the assumption this
 * rests on, and a fourth sample that breaks it is the signal to make the rule narrower.
 */
export function stripNarration(
  content: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const firstToolUse = content.findIndex((b) => b.type === 'server_tool_use')
  if (firstToolUse === -1) return content
  return content.filter((b, i) => !(i < firstToolUse && b.type === 'text'))
}

/** The open answer: narration removed, then the existing reassembly — prose joined, citations numbered. */
export function openAnswer(content: Array<Record<string, unknown>>): AIAnswer {
  return reassemble(stripNarration(content))
}

export interface OpenCallOptions {
  task?: AITask
  model?: string
  maxTokens?: number
  /** Reaches the SDK request itself, so an abort stops the upstream call and the billing. */
  signal?: AbortSignal
  /** Default true. The MODEL decides whether to search; this only makes the tool available. */
  enableWebSearch?: boolean
}

/**
 * STREAMING IS REQUIRED HERE, NOT OPTIONAL.
 *
 * `askAIWithCitations` clamps to 21333 tokens because the SDK refuses a NON-streaming request it
 * estimates could exceed ten minutes (see its comment: `client.js:671`). **Streaming removes that
 * ceiling rather than working around it**, which is `TODO.md` 0.11's first half. Its second half —
 * §92's 58.9 s of silence — is answered by the same change: text arrives as it is written, which
 * is the honest alternative to a progress animation over a call that is not reporting progress.
 */
export async function* askAIOpenStream(
  system: string,
  messages: OpenMessage[],
  options: OpenCallOptions = {},
): AsyncGenerator<OpenStreamEvent> {
  if (!messages.length) throw new Error('askAIOpenStream: messages is empty')
  if (messages[messages.length - 1].role !== 'user') {
    throw new Error('askAIOpenStream: the last message must be from the user')
  }

  const model = options.model || modelForTask(options.task ?? 'prose')
  const stream = anthropic.messages.stream(
    {
      model,
      max_tokens: options.maxTokens ?? 8000,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content as any })),
      ...(options.enableWebSearch === false
        ? {}
        : { tools: [{ type: 'web_search_20250305', name: 'web_search' }] }),
    },
    // The AbortSignal goes to the REQUEST, not just to our reading of it. Without this an
    // abort stops the rendering and leaves the upstream call running and billing.
    options.signal ? { signal: options.signal } : undefined,
  )

  // Events are pushed by the SDK's callbacks and pulled by this generator's consumer. The queue
  // is what bridges the two; without it a slow consumer would drop events.
  const queue: OpenStreamEvent[] = []
  let done = false
  let failed: Error | null = null
  let wake: (() => void) | null = null
  const push = (e: OpenStreamEvent) => { queue.push(e); wake?.(); wake = null }

  let sawToolUse = false
  let emittedText = false

  stream.on('streamEvent', (event: any) => {
    if (event.type === 'content_block_start') {
      const b = event.content_block
      if (b?.type === 'server_tool_use') {
        // THE NARRATION RULE, applied live. Anything already shown was narration: withdraw it.
        if (!sawToolUse && emittedText) push({ type: 'reset' })
        sawToolUse = true
        push({ type: 'searching', query: typeof b.input?.query === 'string' ? b.input.query : null })
      }
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const text = String(event.delta.text ?? '')
      if (text) { emittedText = true; push({ type: 'text', text }) }
    }
  })
  const startedAt = Date.now()
  stream.on('error', (err: any) => { failed = err instanceof Error ? err : new Error(String(err)); done = true; wake?.(); wake = null })
  stream.on('abort', (err: any) => {
    // *** THE UPSTREAM REQUEST ENDED, AND THIS LINE IS THE EVIDENCE. ***
    // An abort that only stops the rendering leaves the model generating and the account
    // billing. This fires from the SDK's own abort event, so its presence in the log means the
    // HTTP request to Anthropic was cancelled — not that we stopped reading it.
    console.warn(`AI: upstream aborted after ${Date.now() - startedAt}ms ` +
                 `(sdk.aborted=${(stream as { aborted?: boolean }).aborted}, err=${(err as { name?: string })?.name ?? 'none'})`)
    failed = err instanceof Error ? err : new Error('aborted'); done = true; wake?.(); wake = null
  })

  const finalPromise = stream.finalMessage()
    .then((m) => m)
    .catch((e) => { failed = e instanceof Error ? e : new Error(String(e)); return null })
    .finally(() => { done = true; wake?.(); wake = null })

  while (true) {
    while (queue.length) yield queue.shift()!
    if (done) break
    await new Promise<void>((resolve) => { wake = resolve })
  }
  while (queue.length) yield queue.shift()!

  const final = await finalPromise
  if (failed) { yield { type: 'error', message: (failed as Error).message }; return }
  if (!final) { yield { type: 'error', message: 'The model returned no message.' }; return }

  yield {
    type: 'done',
    answer: openAnswer(final.content as unknown as Array<Record<string, unknown>>),
    stopReason: (final as any).stop_reason ?? null,
    outputTokens: (final as any).usage?.output_tokens ?? null,
  }
}

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
import { recordAICall, describeCost, type LedgerTask } from './costLedger.ts'

export type AITask = 'judgement' | 'critique' | 'prose' | 'default' | 'substeps' | 'summary' | 'document_scan' | 'document_draft'

/**
 * What a caller passes so its call lands in the cost ledger (`DECISIONS.md` §128 J).
 *
 * *** IT IS OPTIONAL, AND AN OMITTED LEDGER IS A CALL THAT IS NOT COUNTED. *** That is a real
 * hole and it is deliberate rather than hidden: wiring it into every historical call site at
 * once would have touched the audits, the gate and document review in the same change as the
 * measurement. `scripts/cost-report.js` prints which tasks have never written a row, so the
 * hole is visible in the output rather than discovered by a total that looks too small.
 */
export interface LedgerRef {
  /** From the verified session, never from a client parameter. Null for a script. */
  companyId: string | null
  task: LedgerTask
}

export interface AskAIOptions {
  maxTokens?: number
  /** Prefer `task`. A literal model name here is an escape hatch and overrides routing. */
  model?: string
  /** What this call is for. Routes to a tier — see AITask. */
  task?: AITask
  /** Records this call in the cost ledger. Omitted = not counted; see LedgerRef. */
  ledger?: LedgerRef
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
  /**
   * A JSON schema the answer must conform to — `output_config.format`, structured outputs.
   *
   * *** THIS MAKES THE JSON VALID AT THE SOURCE, WHICH IS WHERE IT SHOULD HAVE BEEN. ***
   * `extractJsonText` exists because a model asked for JSON in prose sometimes writes prose
   * around it, an extra closing brace, or — Documents Run 2b, case 04 run 3 — an unescaped
   * quotation mark inside a string value:
   *
   *     "quote": "Cool cooked beans from 135°F to 70°F…" vs. "The blast chiller operator…"
   *
   * That one is unrecoverable by any extractor: the string ends at the second quote and what
   * follows is a syntax error. A schema removes the class rather than the instance.
   *
   * Measured before use (`npm run probe:structured`, 25 Sep, claude-haiku-4-5): accepted alone,
   * accepted ALONGSIDE the server-side web_search tool, and accepted with a scan-shaped schema
   * carrying nested objects, arrays of objects and nullable fields. The raw text came back as
   * bare JSON in all three.
   *
   * `extractJsonText` stays on every path regardless. It is now a fallback rather than the
   * mechanism, and a fallback that is never exercised is one nobody finds out has rotted.
   */
  outputSchema?: Record<string, unknown>
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
  // *** ELABORATION, NOT RESEARCH — `DECISIONS.md` §128 J.3. ***
  // Micro-steps expand one item of a checklist the customer is already looking at, and a summary
  // reads a transcript that already exists. Neither decides what the law requires and neither
  // searches; both were running on the research tier because there was no other tier to put them
  // on. Defaulting them to Sonnet 5 is the owner's decision, made from the ledger.
  substeps:  () => process.env.AI_MODEL_SUBSTEPS  || process.env.AI_MODEL || 'claude-sonnet-5',
  summary:   () => process.env.AI_MODEL_SUMMARY   || process.env.AI_MODEL || 'claude-sonnet-5',
  // *** READING A DOCUMENT IS A JUDGEMENT TASK, AND IT GETS ITS OWN NAME. ***
  // The old review passes no task at all, so it lands on `default` — which no AI_MODEL_* variable
  // can steer, and which on production resolves to sonnet-4-5 because the bare AI_MODEL is not
  // among the Vercel variables. That is how the most expensive call in the product ended up on a
  // model nobody had chosen. This one is named, so it can be pointed anywhere without moving
  // everything else, and it falls back to the judgement tier rather than to `default`.
  document_scan: () => process.env.AI_MODEL_DOCUMENT_SCAN || TASK_MODELS.judgement(),
  // *** DRAFTING IS PROSE, NOT JUDGEMENT. *** Writing the missing section of an emergency plan
  // in the document's own voice decides nothing about what the law requires — the gap already
  // said what is missing and why. It is the cheapest tier that can write, which is the point.
  document_draft: () => process.env.AI_MODEL_DOCUMENT_DRAFT || TASK_MODELS.prose(),
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
 * *** AND THE MIRROR IMAGE: `output_config.effort` IS REJECTED BY MODELS BELOW THE 5 FAMILY. ***
 *
 * Probed on 24 September with one-token calls, not recalled:
 *
 *   claude-haiku-4-5 + effort=low|medium|high|xhigh|max
 *     -> 400 invalid_request_error: "This model does not support the effort parameter."
 *
 * So it is the temperature trap pointing the other way. `temperature` is refused by the 5
 * family and accepted below it; `effort` is accepted by the 5 family and refused below it.
 * Setting `AI_MODEL_PROSE=claude-haiku-4-5` — which the standing build-on-the-cheap-model rule
 * does — would otherwise 400 EVERY research and checklist call, because `DEFAULT_EFFORT` is
 * `medium` and the open call sends it unconditionally.
 *
 * Dropped rather than errored, for the same reason temperature is: effort asks for more
 * reasoning, and a model that has no such control is simply answering at its own depth. The
 * intent survives; only the knob is gone. Logged per call so it is greppable.
 */
export function modelAcceptsEffort(model: string): boolean {
  return /^claude-[a-z]+-5(?:[.-]|$)/.test(model)
}

/**
 * A cap on how many searches one answer may run, OUTSIDE PRODUCTION ONLY.
 *
 * A single research answer can run four or more searches, and §128 J measured every retrieved
 * source at ~4,500 input tokens replayed on each later turn. While building the layout there is
 * no reason to pay for real breadth — the answer only has to have the right SHAPE. Unset or
 * unreadable means no cap, and production never reads this at all.
 */
/**
 * IS THE SCAN'S SHAPE ENFORCED BY THE API, OR ASKED FOR IN PROSE?
 *
 * *** ON BY DEFAULT, AND A SWITCH BECAUSE THE BAKE-OFF HAS TO BE ABLE TO MEASURE IT. ***
 * The schema landed in Run 3 and four of seven golden fixtures lost their agency in the same
 * change, and one program turned `current`. Nobody has established whether that was the schema
 * constraining the model or Haiku being Haiku, and the only way to find out is to run the same
 * documents both ways. A change you cannot turn off is a change you cannot attribute.
 *
 * `AI_SCAN_STRUCTURED=false` sends no `output_config` at all and leaves `extractJsonText` as the
 * mechanism, which is exactly what Runs 1 and 2 ran on. Anything else — unset, "true", nonsense
 * — is on, because the safe default is the one where the JSON is valid at the source.
 *
 * Production reads this like any other variable; unset there means on.
 */
export function scanStructuredOutput(): boolean {
  return (process.env.AI_SCAN_STRUCTURED ?? '').trim().toLowerCase() !== 'false'
}

export function devMaxSearches(): number | null {
  if (process.env.NODE_ENV === 'production') return null
  const raw = Number(process.env.DEV_MAX_SEARCHES)
  return Number.isInteger(raw) && raw > 0 ? raw : null
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

    // Accumulated ACROSS retries: a truncated first attempt was paid for, and a ledger that
    // records only the attempt that succeeded understates every call that had to retry.
    let ledgerIn = 0, ledgerOut = 0, ledgerSearches = 0
    const ledgerStarted = Date.now()

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
        // `output_config` carries the schema. `effort` is not sent from this path at all
        // (see the note above §`modelAcceptsEffort`), so the two never have to be merged here.
        ...(options.outputSchema
          ? { output_config: { format: { type: 'json_schema', schema: options.outputSchema } } }
          : {}),
        ...(options.enableWebSearch
          ? { tools: [{ type: 'web_search_20250305', name: 'web_search',
                        ...(devMaxSearches() ? { max_uses: devMaxSearches() } : {}) }] }
          : {}),
      } as any)

      // With tools enabled, the response can include search/tool-use blocks before the actual
      // answer, AND the answer itself arrives split across many text blocks. `reassemble` joins
      // them into continuous prose and keeps the citations — see its comment for the block dump
      // that forced it.
      const answer = reassemble(message.content as unknown as Array<Record<string, unknown>>)

      // Counted from the RESPONSE, not from whether the tool was offered: `enableWebSearch` only
      // makes the tool available and the model decides. Billing follows what it did.
      ledgerIn += (message as any).usage?.input_tokens ?? 0
      ledgerOut += (message as any).usage?.output_tokens ?? 0
      // *** THE API'S OWN COUNT, NOT THE BLOCK COUNT. ***
      // A search the `max_uses` cap refuses still produces a `web_search_tool_result` block —
      // one carrying `{"type":"web_search_tool_result_error","error_code":"max_uses_exceeded"}`
      // instead of results. Counting blocks therefore BILLS THE REFUSALS. Measured twice on
      // 25 September with max_uses=2: the model issued 3 `server_tool_use`, the third came back
      // as that error, and `usage.server_tool_use.web_search_requests` said 2 — which is the
      // number Anthropic charges the per-search fee on, and so the number `lib/costLedger.ts`
      // must multiply. `scripts/probe-search-count.js` prints all three side by side.
      // The `+=` stays: a retry is real extra spend, and both attempts are on the same row.
      const apiSearches = (message as any).usage?.server_tool_use?.web_search_requests
      ledgerSearches += typeof apiSearches === 'number' ? apiSearches
        : (message.content as Array<{ type?: string }> ?? [])
            .filter((b) => b?.type === 'web_search_tool_result').length

      // stop_reason is the deterministic signal for truncation — not a guess.
      // If the response was genuinely cut off by the token budget, retry with
      // a bigger one automatically rather than surface a broken result and
      // wait for a human to manually raise a number after the fact.
      if ((message as any).stop_reason === 'max_tokens' && maxTokens < HARD_CEILING && attempt < MAX_RETRIES) {
        maxTokens = Math.min(maxTokens * 2, HARD_CEILING)
        console.warn(`AI response truncated (stop_reason=max_tokens), retrying with maxTokens=${maxTokens}`)
        continue
      }

      if (options.ledger) {
        const row = {
          companyId: options.ledger.companyId, task: options.ledger.task,
          model, effort: null, inputTokens: ledgerIn, outputTokens: ledgerOut,
          searches: ledgerSearches, wallMs: Date.now() - ledgerStarted,
        }
        console.log(describeCost(row))
        void recordAICall(row)      // not awaited: bookkeeping never delays the answer
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

  // *** A BALANCED SCAN, NOT `lastIndexOf`. ***
  //
  // The previous version took everything from the first opener to the LAST closer in the
  // string. That is right whenever the model's own braces balance, and wrong the moment they
  // do not — and the way they fail is always the same: one extra `}` after the object is
  // already complete. Measured over Documents Run 2, five of eighteen stored answers ended
  //
  //     "could_not_read": { "reason": null, "way_forward": null }
  //       }
  //     }
  //
  // with one closer too many. `lastIndexOf` swept that stray brace in, `JSON.parse` refused
  // the whole thing, and five complete, correct readings — kind, status, gaps, facts, every
  // top-level key present — were thrown away and charged for. 28% of the answers bought.
  //
  // Walking to the FIRST opener's matching closer ends at the end of the value and ignores
  // whatever follows, whether that is a stray brace, a closing fence, or a paragraph of advice.
  // Strings are honoured so a `}` inside `"way_forward"` text cannot close the object, and
  // backslash escapes are honoured so a `\"` inside a string cannot end it — a quote inside a
  // quoted regulatory sentence is common and would otherwise unbalance the count.
  //
  // Text that already parsed is unaffected: for a response whose braces balance, the matching
  // closer IS the last one, so this produces the identical slice.
  if (start >= 0) {
    const open = cleaned[start]
    const close = open === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i]
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { if (inString) escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    // An unterminated value — the model was cut off mid-object — has no matching closer. Fall
    // back to the old sweep rather than returning nothing, so a truncated answer still reaches
    // `JSON.parse` and fails there with its own message, the way it did before.
    if (end === -1) end = cleaned.lastIndexOf(close)
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
  // `inputTokens` and `searches` are here for the cost report (§128 J): output tokens alone
  // cannot price a call, and on these answers the input side is the larger half of the bill.
  | { type: 'done'; answer: AIAnswer; stopReason: string | null; outputTokens: number | null
      inputTokens: number | null; searches: number }
  | { type: 'error'; message: string }

/**
 * *** THE NARRATION RULE, AND THE EVIDENCE IT CAME FROM. ***
 *
 * With web search available the model often says what it is about to do. That narration is not
 * the answer, and concatenating every text block — which `reassemble` does — puts it at the top
 * of what the customer reads and what we store.
 *
 * FIVE RECORDED SEQUENCES, 22 Sep 2026, real streamed calls with the tool attached and the one
 * sentence of role. Samples 1-3 on `claude-sonnet-4-5`; 4 and 5 on `claude-opus-5` at
 * `effort: max`.
 *
 *   SAMPLE 1  "Oregon cannabis extraction lab using butane"        — searched once
 *     0  text            len=126  "I'll help you understand the licensing and safety requiremen…"
 *     1-3 server_tool_use · 4-6 web_search_tool_result
 *     7+ text  (the answer, 35 blocks)
 *
 *   SAMPLE 2  "Do I need workers' comp insurance?"                 — no search
 *     0  text            len=1194 "I'd be happy to help you understand whether you need workers…"   [whole answer]
 *
 *   SAMPLE 3  "SDS versus container label under OSHA HazCom"       — no search
 *     0  text            len=3355 "I'll help you understand the differences between Safety Data…"  [whole answer]
 *
 *   SAMPLE 4  "small restaurant in Seattle — licenses and permits" — TWO search rounds
 *     0  thinking · 1 text len=46 "I'll look up the current requirements for you."
 *     2,3 server_tool_use · 4,5 result · 6 thinking · 7,8 server_tool_use · 9,10 result
 *     12+ text  (the answer, from "Opening a restaurant in Seattle means clearing four layers…")
 *
 *   SAMPLE 5  the same question again                             — THREE search rounds
 *     1   text len=94 "I'll research the current requirements across federal, state, county…"
 *     2-5   server_tool_use · 6-9 result
 *     11  text len=77 "Let me check the Seattle-specific city requirements and employer obligations."
 *     12-15 server_tool_use · 16-19 result
 *     21  text len=93 "Let me verify the employer registration requirements and a couple of remaining local items."
 *     22,23 server_tool_use
 *     27+ text  (the answer, from "Opening a restaurant in Seattle means clearing four layers…")
 *
 * *** SAMPLE 5 BROKE THE FIRST VERSION OF THIS RULE, WHICH SHIPPED. *** That version read
 * *"narration is a text block before the FIRST `server_tool_use`"*, and against sample 5 it
 * dropped block 1 and kept blocks 11 and 21 — so the answer a customer read began *"Let me check
 * the Seattle-specific city requirements…"*. **Searching is not one round.** The model searches,
 * writes a line about what it will look at next, and searches again; every one of those lines sits
 * after the first tool use.
 *
 * > ### THE RULE: a text block is narration IF AND ONLY IF a `server_tool_use` appears ANYWHERE
 * > ### AFTER IT. The answer is the text that follows the LAST search. No tool use, nothing is
 * > ### dropped.
 *
 * **Still positional, not linguistic**, and samples 2 and 3 are still why: they open with the same
 * words samples 1, 4 and 5 narrate with — *"I'll help you understand…"* — and they are the entire
 * answer. A phrasing heuristic would delete both. It would also have missed sample 5's block 11,
 * which says "Let me check" where sample 4 says "I'll look up" and the first Seattle run said
 * "Let me verify" — three verbs for one behaviour.
 *
 * **The limit, stated rather than discovered later:** if a model ever writes real answer content,
 * *then* searches again, this drops that content. In all five samples every pre-search text block
 * carries **zero citations** and is one or two sentences of intent, while every answer block after
 * the last search is longer or cited — but that is a description of five recordings, not a
 * guarantee, and a sample that breaks it is the signal to narrow the rule rather than widen it.
 */
export function stripNarration(
  content: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  // The LAST search, not the first. `findLastIndex` rather than `findIndex` is the whole fix.
  let lastToolUse = -1
  for (let i = 0; i < content.length; i++) {
    if (content[i].type === 'server_tool_use') lastToolUse = i
  }
  if (lastToolUse === -1) return content
  return content.filter((b, i) => !(i < lastToolUse && b.type === 'text'))
}

/** The open answer: narration removed, then the existing reassembly — prose joined, citations numbered. */
export function openAnswer(content: Array<Record<string, unknown>>): AIAnswer {
  return reassemble(stripNarration(content))
}

/**
 * REASONING EFFORT. `output_config.effort`, GA, no beta header.
 *
 * *** THE PARAMETER NAME AND ITS PLACE WERE READ, NOT RECALLED. *** It is
 * `output_config: { effort }` — NESTED, not a top-level `effort` field — from
 * `@anthropic-ai/sdk` `resources/messages/messages.d.ts`: `OutputConfig.effort` at line 829,
 * `MessageCreateParams.output_config?: OutputConfig` at line 2052. Confirmed against the API on
 * 22 Sep with one-token calls on `claude-sonnet-5`: `max`, `xhigh` and `high` all accepted.
 *
 * The five levels are the SDK's own union, in order. Default is `high` when the field is
 * omitted, so setting `high` and omitting it are the same request.
 *
 * NOT the same thing as `thinking`. On this model family `thinking.budget_tokens` is removed —
 * it returns a 400 — and thinking runs adaptively whether or not it is named. Effort is what
 * controls depth now, which is why the old budget-token concept has nothing to set here.
 */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORT_LEVELS)[number]

/**
 * The effort this process runs at, from `AI_EFFORT`.
 *
 * Unset means the field is not sent at all, which is the API's own default (`high`). An
 * UNRECOGNISED value is a loud warning and then the same absence — never a silent downgrade,
 * because a typo that quietly halves the reasoning depth is indistinguishable from the model
 * getting worse.
 */
/**
 * *** THE DEFAULT IS `medium`, AND IT IS A DELIBERATE DEFAULT RATHER THAN THE API's. ***
 *
 * The API's own default is `high`. The owner's decision on Fix Round 1 H moved research and
 * checklist to `medium`, on six measured runs of the same question, same switches, same model:
 *
 *   high     mean 79.5s · 5,706 output tokens · 3.3/4 golden facts
 *   medium   mean 45.4s · 3,305 output tokens · 3.3/4 golden facts
 *
 * **43% faster and 42% fewer output tokens.** The fact scores did NOT separate the two levels —
 * each varied by a whole fact between its own runs — so this buys a measured cost saving against
 * an unmeasured quality difference, which is the trade the owner made knowingly (`DECISIONS.md`
 * §128).
 *
 * `effortFromEnv` governs `askAIOpenStream` and nothing else, so this moves research and
 * checklist and leaves the gate, the critic and the audits exactly where they were.
 *
 * An unreadable value falls back to this default too — NOT to the API's — because a typo
 * silently buying the expensive tier is the failure this is meant to make impossible.
 */
export const DEFAULT_EFFORT: Effort = 'medium'

export function effortFromEnv(): Effort | null {
  const raw = String(process.env.AI_EFFORT ?? '').trim().toLowerCase()
  if (!raw) return DEFAULT_EFFORT
  if ((EFFORT_LEVELS as readonly string[]).includes(raw)) return raw as Effort
  console.warn(`AI: AI_EFFORT=${JSON.stringify(process.env.AI_EFFORT)} is not one of ` +
               `${EFFORT_LEVELS.join(', ')} — falling back to ${DEFAULT_EFFORT}.`)
  return DEFAULT_EFFORT
}

export interface OpenCallOptions {
  task?: AITask
  model?: string
  maxTokens?: number
  /** Overrides `AI_EFFORT` for this call. */
  effort?: Effort
  /** Reaches the SDK request itself, so an abort stops the upstream call and the billing. */
  signal?: AbortSignal
  /** Default true. The MODEL decides whether to search; this only makes the tool available. */
  enableWebSearch?: boolean
  /** Records this call in the cost ledger. Omitted = not counted; see LedgerRef. */
  ledger?: LedgerRef
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
  const wantedEffort = options.effort ?? effortFromEnv()
  const effort = wantedEffort && modelAcceptsEffort(model) ? wantedEffort : null
  if (wantedEffort && !effort) {
    console.warn(`AI: dropping effort=${wantedEffort} — ${model} does not accept it. The model answers at its own depth, so the intent is preserved.`)
  }
  const searchCap = devMaxSearches()
  // The exact parameter, in the log, so what was SENT is recoverable from a request days later
  // rather than inferred from the answer's length.
  console.log(`AI: open call model=${model} ` +
              `output_config=${effort ? JSON.stringify({ effort }) : '(omitted)'}` +
              `${searchCap ? ` web_search.max_uses=${searchCap}` : ''}`)
  const stream = anthropic.messages.stream(
    {
      model,
      max_tokens: options.maxTokens ?? 8000,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content as any })),
      ...(effort ? { output_config: { effort } } : {}),
      ...(options.enableWebSearch === false
        ? {}
        : { tools: [{ type: 'web_search_20250305', name: 'web_search',
                      ...(searchCap ? { max_uses: searchCap } : {}) }] }),
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
  let searches = 0   // for the ledger: what the model actually ran, not what was offered

  stream.on('streamEvent', (event: any) => {
    if (event.type === 'content_block_start') {
      const b = event.content_block
      if (b?.type === 'server_tool_use') {
        // THE NARRATION RULE, applied live. Anything already shown was narration: withdraw it.
        if (!sawToolUse && emittedText) push({ type: 'reset' })
        sawToolUse = true
        searches++
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

  // *** THE LEDGER ROW IS WRITTEN HERE, ON THE COMPLETED STREAM, AND NOWHERE ELSE. ***
  // A stream that failed or was aborted still cost something upstream, but `finalMessage()`
  // gives no usage for it — there is no honest number to write, so no row is written and the
  // reconciliation in §128 J.2 is explicit that aborted answers are missing from the ledger.
  // Inventing a cost for a call whose token counts nobody has would be the exact failure this
  // table exists to end.
  if (options.ledger) {
    const row = {
      companyId: options.ledger.companyId, task: options.ledger.task, model,
      effort: effort ?? null,
      inputTokens: (final as any).usage?.input_tokens ?? 0,
      outputTokens: (final as any).usage?.output_tokens ?? 0,
      // *** BILLED SEARCHES, WHICH IS NOT THE SAME AS SEARCHES THE USER WATCHED GO OUT. ***
      // `searches` above counts `server_tool_use` blocks, because that is what drives the
      // "Searching: …" line on screen and the user genuinely saw those queries issued. But a
      // query the `max_uses` cap refuses is issued and never runs, and Anthropic does not
      // charge for it: `usage.server_tool_use.web_search_requests` is the billed number.
      // The screen keeps the attempted count; the ledger takes the billed one.
      searches: (final as any).usage?.server_tool_use?.web_search_requests ?? searches,
      wallMs: Date.now() - startedAt,
    }
    console.log(describeCost(row))
    void recordAICall(row)
  }

  yield {
    type: 'done',
    answer: openAnswer(final.content as unknown as Array<Record<string, unknown>>),
    stopReason: (final as any).stop_reason ?? null,
    outputTokens: (final as any).usage?.output_tokens ?? null,
    inputTokens: (final as any).usage?.input_tokens ?? null,
    searches,
  }
}

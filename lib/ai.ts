import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Content can be plain text, or Claude-style blocks (PDF, image, text)
export type AIContent = string | any[]

export interface AskAIOptions {
  maxTokens?: number
  model?: string
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
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const message = await anthropic.messages.create({
        model: options.model || process.env.AI_MODEL || 'claude-sonnet-4-5',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: content as any }],
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
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

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
  const maxTokens = options.maxTokens ?? 2000

  if (provider === 'claude') {
    const message = await anthropic.messages.create({
      model: options.model || process.env.AI_MODEL || 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: content as any }],
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    })
    return message.content[0].type === 'text' ? message.content[0].text : ''
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
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(cleaned) as T
}

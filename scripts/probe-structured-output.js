#!/usr/bin/env node
// CAN THE SCAN ASK FOR VALID JSON AT THE SOURCE? — Documents Run 3, preamble (a).
//
//   npm run probe:structured
//
// `@anthropic-ai/sdk` 0.100.0 exposes `output_config.format` as a `json_schema`. The scan needs
// it ALONGSIDE the server-side `web_search` tool, and the scan runs on whatever
// AI_MODEL_DOCUMENT_SCAN resolves to — today `claude-haiku-4-5`, which already refuses
// `output_config.effort` outright. So "the SDK has the field" answers nothing on its own.
//
// Three calls, smallest first, each reporting exactly what came back:
//   1. schema alone
//   2. schema + web_search
//   3. schema + web_search, with the real scan schema's shape (nested objects, arrays of
//      objects, nullable fields) — the thing that would actually be sent
//
// Costs three tiny Haiku calls and writes nothing anywhere.

import Anthropic from '@anthropic-ai/sdk'
import { modelForTask, devMaxSearches } from '../lib/ai.ts'

if (!process.env.ANTHROPIC_API_KEY) { console.error('\n  ANTHROPIC_API_KEY is not set.\n'); process.exit(1) }
const model = modelForTask('document_scan')
const cap = devMaxSearches()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const searchTool = { type: 'web_search_20250305', name: 'web_search', ...(cap ? { max_uses: cap } : {}) }

console.log(`\n  model : ${model}`)
// The SDK does not export its own package.json, so read the declared range instead.
const declared = JSON.parse((await import('node:fs')).readFileSync('package.json', 'utf8'))
console.log(`  sdk   : @anthropic-ai/sdk ${declared.dependencies['@anthropic-ai/sdk']}\n`)

const SIMPLE = {
  type: 'object',
  properties: { answer: { type: 'string' }, confident: { type: 'boolean' } },
  required: ['answer', 'confident'],
  additionalProperties: false,
}

// The shapes the scan actually needs: a nested object, an array of objects, a nullable string.
const SCAN_LIKE = {
  type: 'object',
  properties: {
    identity: {
      type: 'object',
      properties: { kind: { type: 'string' }, title: { type: 'string' }, agencies: { type: 'array', items: { type: 'string' } } },
      required: ['kind', 'title', 'agencies'],
      additionalProperties: false,
    },
    summary: { type: 'string' },
    significant_date: { type: ['string', 'null'] },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, quote: { type: ['string', 'null'] }, basis: { type: 'string', enum: ['read', 'inferred'] } },
        required: ['title', 'quote', 'basis'],
        additionalProperties: false,
      },
    },
  },
  required: ['identity', 'summary', 'significant_date', 'gaps'],
  additionalProperties: false,
}

async function probe(label, body) {
  try {
    const m = await anthropic.messages.create(body)
    const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    let parses = false
    try { JSON.parse(text); parses = true } catch { /* reported below */ }
    console.log(`  ${label}`)
    console.log(`    OK — stop_reason ${m.stop_reason}, ${text.length} chars, raw text parses as JSON: ${parses}`)
    console.log(`    searches billed: ${m.usage?.server_tool_use?.web_search_requests ?? 0}`)
    console.log(`    first 140: ${JSON.stringify(text.slice(0, 140))}\n`)
    return { ok: true, parses }
  } catch (e) {
    console.log(`  ${label}`)
    console.log(`    REFUSED — ${e.status ?? '?'} ${String(e.message).slice(0, 300)}\n`)
    return { ok: false }
  }
}

const base = { model, max_tokens: 700 }

const r1 = await probe('1. output_config.format alone', {
  ...base,
  messages: [{ role: 'user', content: 'Is the Oregon DEQ an environmental agency? Answer briefly.' }],
  output_config: { format: { type: 'json_schema', schema: SIMPLE } },
})

const r2 = await probe('2. output_config.format + web_search', {
  ...base,
  messages: [{ role: 'user', content: 'What is the current Oregon DEQ air permit renewal deadline rule? Look it up.' }],
  tools: [searchTool],
  output_config: { format: { type: 'json_schema', schema: SIMPLE } },
})

const r3 = await probe('3. the scan-shaped schema + web_search', {
  ...base,
  max_tokens: 1500,
  messages: [{ role: 'user', content: 'Describe an Oregon DEQ air contaminant discharge permit as if reading one. Look up the rule if you need to.' }],
  tools: [searchTool],
  output_config: { format: { type: 'json_schema', schema: SCAN_LIKE } },
})

console.log('  VERDICT')
console.log(`    schema alone                 : ${r1.ok ? 'accepted' : 'REFUSED'}`)
console.log(`    schema + web_search          : ${r2.ok ? 'accepted' : 'REFUSED'}`)
console.log(`    scan-shaped schema + search  : ${r3.ok ? 'accepted' : 'REFUSED'}`)
console.log(`\n  Usable for the scan: ${r1.ok && r2.ok && r3.ok ? 'YES' : 'NO'}\n`)

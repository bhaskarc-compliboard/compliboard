#!/usr/bin/env node
// WHAT DOES THE API ACTUALLY RETURN WHEN max_uses IS 2 — Documents Run 2, part 5b.
//
//   npm run probe:searches
//
// The ledger has rows reading `searches 4` on calls sent with `web_search.max_uses = 2`, and
// there are two different numbers it could have been counting:
//
//   · `usage.server_tool_use.web_search_requests` — the API's own count, which is what
//     Anthropic bills the per-search fee on;
//   · the number of `web_search_tool_result` blocks in the content, which is what
//     `lib/ai.ts` counts today.
//
// This makes ONE call with the tool capped at 2, prints every content block type in order,
// both numbers, and the usage object verbatim, so the answer comes from the response rather
// than from reasoning about it. It also prints what `lib/ai.ts` WOULD have recorded.
//
// Staging-only by construction: it writes nothing anywhere. It costs one Haiku call.

import Anthropic from '@anthropic-ai/sdk'
import { modelForTask, devMaxSearches } from '../lib/ai.ts'

if (!process.env.ANTHROPIC_API_KEY) { console.error('\n  ANTHROPIC_API_KEY is not set.\n'); process.exit(1) }

const cap = devMaxSearches()
const model = modelForTask('document_scan')
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

console.log(`\n  model              : ${model}`)
console.log(`  web_search.max_uses: ${cap ?? '(no cap)'}   (from DEV_MAX_SEARCHES, via lib/ai.ts devMaxSearches())`)

// A question that cannot be answered without looking several things up, so the model has
// every reason to use the tool more than twice if the cap does not hold it.
const question = 'For an Oregon chemical distributor: what is the current Oregon DEQ Standard '
  + 'Air Contaminant Discharge Permit renewal application deadline rule, what is the current '
  + 'annual fee, and what is the current OSHA emergency action plan rule number? Look each one '
  + 'up separately and cite the page you used for each.'

const started = Date.now()
const message = await anthropic.messages.create({
  model,
  max_tokens: 2000,
  system: 'Answer briefly. Use the web_search tool for anything that may have changed.',
  messages: [{ role: 'user', content: question }],
  tools: [{ type: 'web_search_20250305', name: 'web_search', ...(cap ? { max_uses: cap } : {}) }],
})

const blocks = message.content
console.log(`\n  wall               : ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(`  stop_reason        : ${message.stop_reason}`)

console.log(`\n  CONTENT BLOCKS, IN ORDER`)
blocks.forEach((b, i) => {
  const extra = b.type === 'server_tool_use' ? `  query: ${JSON.stringify(b.input?.query ?? null)}`
    : b.type === 'web_search_tool_result' ? (Array.isArray(b.content)
        ? `  results: ${b.content.length}`
        // The error block is the whole point: it is how a refused search looks, and a refused
        // search must not be billed. Printed verbatim rather than summarised.
        : `  NOT A RESULT: ${JSON.stringify(b.content)}`)
    : b.type === 'text' ? `  ${String(b.text).replace(/\s+/g, ' ').slice(0, 60)}…` : ''
  console.log(`    ${String(i).padStart(2)}  ${b.type}${extra}`)
})

const serverToolUseBlocks = blocks.filter((b) => b.type === 'server_tool_use').length
const resultBlocks = blocks.filter((b) => b.type === 'web_search_tool_result').length
const apiCount = message.usage?.server_tool_use?.web_search_requests ?? null

console.log(`\n  THE THREE NUMBERS`)
console.log(`    usage.server_tool_use.web_search_requests : ${apiCount}`)
console.log(`    web_search_tool_result blocks            : ${resultBlocks}   <- what lib/ai.ts counts today`)
console.log(`    server_tool_use blocks                   : ${serverToolUseBlocks}   <- what askAIOpenStream counts`)

console.log(`\n  usage, verbatim:`)
console.log('    ' + JSON.stringify(message.usage, null, 2).split('\n').join('\n    '))

const agree = new Set([apiCount, resultBlocks, serverToolUseBlocks].filter((x) => x != null)).size === 1
console.log(`\n  The three ${agree ? 'AGREE' : 'DO NOT AGREE'} on this call.`)
if (cap) console.log(`  The cap was ${cap}; the API says it ran ${apiCount}.`)
console.log('')

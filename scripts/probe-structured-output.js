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
// Four calls, smallest first, each reporting exactly what came back:
//   1. schema alone
//   2. schema + web_search
//   3. schema + web_search, with the real scan schema's SHAPE (nested objects, arrays of
//      objects, nullable fields) — a hand-written stand-in
//   4. *** THE ACTUAL `SCAN_JSON_SCHEMA` THE SCAN SENDS. *** — added 26 September 2026
//
// ---------------------------------------------------------------------------
// *** WHY 4 EXISTS, AND WHY 3 WAS NOT ENOUGH. ***
//
// Probe 3 is a stand-in, and `prompts/document-scan.ts` already records what that cost: all three
// of the API's schema rules were found by sending the REAL schema from the page, not by this
// script, because the stand-in "happened to satisfy the first and was small enough to miss the
// other two". On 26 September it happened a fourth time — the first production scan on
// `claude-opus-5` came back
//
//     400 The compiled grammar is too large, which would cause performance issues.
//         Simplify your tool schemas or reduce the number of strict tools.
//
// on a schema this script had reported usable. A probe that tests a copy of the thing tests the
// copy. Probe 4 imports `SCAN_JSON_SCHEMA` itself, so it cannot drift from what production sends.
//
// *** AND IT TAKES A MODEL, BECAUSE THE LIMIT IS PER MODEL. *** The same schema is accepted on
// `claude-haiku-4-5` and refused on `claude-opus-5`. Reading the verdict off whatever
// AI_MODEL_DOCUMENT_SCAN happens to be set to answers the question for one model and looks like it
// answered it for all of them.
//
//   npm run probe:structured                              the configured tier (today: Haiku)
//   npm run probe:structured -- --model claude-opus-5     the model production runs the scan on
//   npm run probe:structured -- --schema-only             skip the three paid calls; only probe 4
//
// A refused call is not billed, so `--schema-only` against a schema that 400s costs nothing.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk'
import { modelForTask, devMaxSearches } from '../lib/ai.ts'
import { SCAN_JSON_SCHEMA } from '../prompts/document-scan.ts'

if (!process.env.ANTHROPIC_API_KEY) { console.error('\n  ANTHROPIC_API_KEY is not set.\n'); process.exit(1) }
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
// An explicit --model wins; otherwise the tier, exactly as the scan itself resolves it. No literal
// model id anywhere in this file — `CLAUDE.md` §3.4a, and the bug that rule was written for.
const model = arg('--model') || modelForTask('document_scan')
const schemaOnly = process.argv.includes('--schema-only')
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

/**
 * HOW BIG THE SCHEMA IS, IN THE TERMS THE API'S OWN REFUSALS USE.
 *
 * Printed rather than guessed at, because "simplify your schema" is not a number and the three
 * limits found so far were all counts: optional parameters (24), union-typed parameters (30), and
 * now a compiled grammar whose limit is not published. So this prints what CAN be counted, and the
 * probe below prints whether it was accepted. Neither is inferred from the other.
 */
function measure(schema) {
  let objects = 0, props = 0, enums = 0, enumMembers = 0, unions = 0, arrays = 0, descriptions = 0
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (typeof n.description === 'string') descriptions++
    if (Array.isArray(n.enum)) { enums++; enumMembers += n.enum.length }
    if (Array.isArray(n.type)) unions++
    if (n.type === 'array') arrays++
    if (n.type === 'object' && n.properties) {
      objects++
      const keys = Object.keys(n.properties)
      props += keys.length
      for (const k of keys) walk(n.properties[k])
    }
    if (n.items) walk(n.items)
  }
  walk(schema)
  return { objects, props, enums, enumMembers, unions, arrays, descriptions,
           bytes: JSON.stringify(schema).length }
}

const m = measure(SCAN_JSON_SCHEMA)
console.log('  SCAN_JSON_SCHEMA, counted from the object itself:')
console.log(`    objects ${m.objects} · properties ${m.props} · arrays ${m.arrays}`)
console.log(`    enums ${m.enums} (${m.enumMembers} members) · union types ${m.unions} · descriptions ${m.descriptions}`)
console.log(`    serialised ${m.bytes} bytes\n`)

const base = { model, max_tokens: 700 }

const r1 = schemaOnly ? { ok: null } : await probe('1. output_config.format alone', {
  ...base,
  messages: [{ role: 'user', content: 'Is the Oregon DEQ an environmental agency? Answer briefly.' }],
  output_config: { format: { type: 'json_schema', schema: SIMPLE } },
})

const r2 = schemaOnly ? { ok: null } : await probe('2. output_config.format + web_search', {
  ...base,
  messages: [{ role: 'user', content: 'What is the current Oregon DEQ air permit renewal deadline rule? Look it up.' }],
  tools: [searchTool],
  output_config: { format: { type: 'json_schema', schema: SIMPLE } },
})

const r3 = schemaOnly ? { ok: null } : await probe('3. the scan-shaped schema + web_search', {
  ...base,
  max_tokens: 1500,
  messages: [{ role: 'user', content: 'Describe an Oregon DEQ air contaminant discharge permit as if reading one. Look up the rule if you need to.' }],
  tools: [searchTool],
  output_config: { format: { type: 'json_schema', schema: SCAN_LIKE } },
})

// 4. THE REAL ONE. Asked for the smallest possible answer — the question is whether the schema is
// ACCEPTED, and a full reading would cost real money to learn the same thing. max_tokens is low and
// the document is one sentence; a refusal happens before any of that is billed.
const r4 = await probe('4. THE REAL SCAN_JSON_SCHEMA + web_search', {
  ...base,
  max_tokens: 2000,
  messages: [{ role: 'user', content:
    'Read this one-line document: "Air Contaminant Discharge Permit 12-3456, Oregon DEQ, expires '
    + '2027-04-30." Fill in what you can and leave the rest empty.' }],
  tools: [searchTool],
  output_config: { format: { type: 'json_schema', schema: SCAN_JSON_SCHEMA } },
})

const say = (r) => r.ok === null ? 'skipped' : r.ok ? 'accepted' : 'REFUSED'
console.log('  VERDICT')
console.log(`    model                        : ${model}`)
console.log(`    schema alone                 : ${say(r1)}`)
console.log(`    schema + web_search          : ${say(r2)}`)
console.log(`    scan-shaped schema + search  : ${say(r3)}`)
console.log(`    *** REAL SCAN_JSON_SCHEMA    : ${say(r4)}`)
// The real schema is the only one of the four that decides anything, so it is the only one the
// verdict reads. A stand-in that passes while the real schema 400s is the failure this line closes.
console.log(`\n  Usable for the scan on ${model}: ${r4.ok ? 'YES' : 'NO'}\n`)
process.exit(r4.ok ? 0 : 1)

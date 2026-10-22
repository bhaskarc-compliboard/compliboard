// ---------------------------------------------------------------------------
// npm run website:compare -- <host> [more hosts]      THE OWNER'S TEST, PART B
//
// My Account step 15. `ACCOUNT-PLAN.md` decision 9: the website read runs on `AI_MODEL_WEBSITE`,
// "Opus 5.5 to start; Sonnet 5.5 compared at the test". This is that comparison.
//
// For each host: fetch ONCE with `lib/websiteFetch.ts` — the same pages, the same caps, the same
// host and address checks the product uses — then send the same prompt to both models and print
// the two cards side by side, with what each took and cost underneath.
//
//   npm run website:compare -- jostchemical.com
//   npm run website:compare -- jostchemical.com pvschemicals.com columbuschemical.com
//
// *** RUN IT WITHOUT THE HAIKU GUARD. *** Every other model-capable command of Claude Code's goes
// through `npm run haiku --` (CLAUDE.md §3.4a). This one must NOT: it names `claude-opus-5-5` and
// `claude-sonnet-5-5` as literals, because comparing the two is the whole job, and the guard would
// have nothing to pin — it sets AI_MODEL_* variables, which this script never reads. So running it
// spends real money on purpose. **This is the owner's command, not Claude Code's.**
//
// *** IT WRITES NOTHING. *** No database row, no `ai_calls` entry, no file. The ledger is for what
// the PRODUCT spends serving a customer (`DECISIONS.md` §128 J); a bake-off between two models is
// the owner's own spend and would be counted twice if it landed there. That is the precedent
// `scripts/probe-structured-output.js` set, and this follows it — including importing the SDK
// directly, which `CLAUDE.md` §3.4's rule does not cover (it names `app`, `lib` and `components`,
// and its verification grep searches exactly those three).
//
// It runs from the `compliboard-code` folder and reads the laptop's `.env.local` for
// `ANTHROPIC_API_KEY`. It needs no database credentials at all.
//
// Cap: 8 hosts a run. Sixteen calls is already a real bill, and a list longer than that is a
// different kind of test.
// ---------------------------------------------------------------------------
import Anthropic from '@anthropic-ai/sdk'
import { readSite } from '../lib/websiteFetch.ts'
import { couldNotRead } from '../lib/walkView.ts'
import {
  WEBSITE_SYSTEM, websitePrompt, WEBSITE_JSON_SCHEMA, parseProposal,
} from '../prompts/website-read.ts'
import {
  cardBlocks, sideBySideBlocks, pagesHeader, unreadableHeader, COMPARE_MODELS, MAX_HOSTS, CARD_WIDTH,
} from '../lib/websiteCompare.ts'
import { estimateCost } from '../lib/costLedger.ts'

const hosts = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!hosts.length) {
  console.error('\n  usage: npm run website:compare -- <host> [more hosts]\n')
  process.exit(2)
}
if (hosts.length > MAX_HOSTS) {
  console.error(`\n  ${hosts.length} hosts; the cap is ${MAX_HOSTS} a run (${hosts.length * 2} model calls would be billed).\n`)
  process.exit(2)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n  ANTHROPIC_API_KEY is not set. Run this from compliboard-code, where .env.local has it.\n')
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MAX_TOKENS = 1500

/**
 * One model, one read. The call is the shape `lib/ai.ts` sends for the `website` task and nothing
 * more: model, max_tokens, system, one user message, and the schema. No temperature (the 5 family
 * refuses it), no effort, no tools — the product's read has no search tool and neither has this.
 */
async function readWith(model, host, pages) {
  const started = Date.now()
  try {
    const m = await anthropic.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: WEBSITE_SYSTEM,
      messages: [{ role: 'user', content: websitePrompt(host, pages) }],
      output_config: { format: { type: 'json_schema', schema: WEBSITE_JSON_SCHEMA } },
    })
    const text = (m.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
    let proposal = null
    try { proposal = parseProposal(JSON.parse(text)) } catch { proposal = null }
    const usage = {
      model,
      inputTokens: m.usage?.input_tokens ?? 0,
      outputTokens: m.usage?.output_tokens ?? 0,
      searches: 0,
    }
    return {
      proposal,
      meta: {
        model,
        seconds: (Date.now() - started) / 1000,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: estimateCost(usage).costUsd,
        error: null,
      },
    }
  } catch (e) {
    return {
      proposal: null,
      meta: {
        model, seconds: (Date.now() - started) / 1000, inputTokens: 0, outputTokens: 0,
        costUsd: null, error: `${e.status ?? ''} ${e.message ?? e}`.trim(),
      },
    }
  }
}

console.log(`\n  ${hosts.length} host(s) · ${COMPARE_MODELS.join(' vs ')} · nothing is written anywhere\n`)

let billed = 0
for (const host of hosts) {
  const site = await readSite(host)
  if (!site.ok) {
    // The product's own reason AND the product's own sentence — `couldNotRead` is what the walk's
    // first screen says when a read fails — so what is printed here is what a customer would see.
    for (const line of unreadableHeader(host, site.reason, couldNotRead(host))) console.log(line)
    continue
  }
  for (const line of pagesHeader(host, site.pages.map((p) => ({ url: p.url, chars: p.text.length })))) {
    console.log(line)
  }

  // In parallel: the two calls are independent and the owner is waiting.
  const [a, b] = await Promise.all(COMPARE_MODELS.map((m) => readWith(m, host, site.pages)))
  for (const r of [a, b]) billed += r.meta.costUsd ?? 0
  for (const line of sideBySideBlocks(
    cardBlocks(a.proposal, a.meta, CARD_WIDTH), cardBlocks(b.proposal, b.meta, CARD_WIDTH), CARD_WIDTH)) {
    console.log(line)
  }
  console.log('')
}

console.log(`  priced calls came to $${billed.toFixed(4)}; any model missing from config/pricing.ts is not in that figure.\n`)

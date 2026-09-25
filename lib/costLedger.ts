/**
 * THE COST LEDGER — `DECISIONS.md` §128 J.
 *
 * One row per model call, written at the call. The pricing arithmetic is here and pure so it can
 * be tested without a database or an API key; the write is a single function so no call site
 * invents its own shape.
 *
 * *** THE PRICES GO ON THE ROW. *** `estimateCost` returns the prices it used alongside the
 * total, and `recordAICall` stores both. A cost recomputed later from a changed price table is
 * not what the call cost — migration 038's header has the reasoning.
 *
 * *** AND A WRITE THAT FAILS MUST NEVER FAIL THE ANSWER. *** This is bookkeeping attached to the
 * customer's request path. If the insert throws — a missing table on a database that has not run
 * 038, a network blip — the answer the customer is waiting for still has to arrive. Every failure
 * here is logged and swallowed, which is the one place in this codebase where swallowing is
 * right, and it is why the reconciliation in §128 J.2 compares row counts against the log rather
 * than assuming the ledger is complete.
 */
import { MODEL_PRICES, PRICE_PER_SEARCH, type ModelPrice } from '../config/pricing.ts'

/** The tasks migration 038's CHECK constraint allows. Kept in step with it by hand and by test. */
export type LedgerTask =
  | 'research' | 'checklist' | 'substeps' | 'convert' | 'summarise'
  | 'gate' | 'critique' | 'audit' | 'document_review' | 'document_scan' | 'other'

export const LEDGER_TASKS: readonly LedgerTask[] = [
  'research', 'checklist', 'substeps', 'convert', 'summarise',
  'gate', 'critique', 'audit', 'document_review', 'document_scan', 'other',
] as const

export interface CallUsage {
  model: string
  inputTokens: number
  outputTokens: number
  searches: number
}

export interface CostEstimate {
  /** US dollars, or null when the model is not in the price table. NEVER zero for unknown. */
  costUsd: number | null
  priceInputPerM: number | null
  priceOutputPerM: number | null
  pricePerSearch: number
}

/** The price for a model id, or null. Exact match only — see `config/pricing.ts`. */
export function priceFor(model: string): ModelPrice | null {
  return MODEL_PRICES[model] ?? null
}

/**
 * What a call cost, from its own token counts.
 *
 * An unknown model returns `costUsd: null` **with its prices null too**, so the row records that
 * it could not be priced rather than recording a price of zero. A caller summing these must
 * count the nulls; `scripts/cost-report.js` does.
 */
export function estimateCost(usage: CallUsage): CostEstimate {
  const price = priceFor(usage.model)
  if (!price) {
    return { costUsd: null, priceInputPerM: null, priceOutputPerM: null, pricePerSearch: PRICE_PER_SEARCH }
  }
  const input = (Math.max(0, usage.inputTokens) / 1_000_000) * price.inputPerM
  const output = (Math.max(0, usage.outputTokens) / 1_000_000) * price.outputPerM
  const search = Math.max(0, usage.searches) * PRICE_PER_SEARCH
  return {
    costUsd: input + output + search,
    priceInputPerM: price.inputPerM,
    priceOutputPerM: price.outputPerM,
    pricePerSearch: PRICE_PER_SEARCH,
  }
}

export interface LedgerRow extends CallUsage {
  companyId: string | null
  task: LedgerTask
  effort: string | null
  wallMs: number
}

/**
 * Write one row. Never throws.
 *
 * *** IT BUILDS ITS OWN CLIENT RATHER THAN IMPORTING `supabaseAdmin`. *** It used to import
 * `./auth.ts` lazily, and that file imports `next/server` — which resolves under Next's bundler
 * and NOWHERE ELSE. Every call made from a plain Node script therefore logged its cost line and
 * then failed to write the row, with the failure swallowed by the catch below exactly as
 * designed. Found on 25 September when `npm run scan` produced cost lines and no `ai_calls`
 * rows. The client is built here, from the same two variables, with no Next dependency.
 *
 * Service role is correct and is a named statement (`CLAUDE.md` §3.6): `authenticated` holds no
 * INSERT on this table on purpose, because a ledger the measured party can write is not a
 * measurement. Built lazily and cached so importing this module for a unit test — which has no
 * credentials — does not construct anything.
 */
type LedgerDb = { from: (t: string) => { insert: (rows: unknown) => Promise<{ error: { message: string } | null }> } }
let cached: LedgerDb | null = null
async function ledgerClient(): Promise<LedgerDb> {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('no Supabase credentials for the cost ledger')
  // A dynamic import, not `require`: this file is an ES module and `require` is not defined in
  // one — which is how the first attempt at this fix failed, swallowed by the same catch.
  const { createClient } = await import('@supabase/supabase-js')
  cached = createClient(url, key, { auth: { persistSession: false } }) as unknown as LedgerDb
  return cached
}
export async function recordAICall(row: LedgerRow): Promise<void> {
  try {
    const cost = estimateCost(row)
    const { error } = await (await ledgerClient()).from('ai_calls').insert({
      company_id: row.companyId,
      task: row.task,
      model: row.model,
      effort: row.effort,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      searches: row.searches,
      wall_ms: row.wallMs,
      price_input_per_m: cost.priceInputPerM,
      price_output_per_m: cost.priceOutputPerM,
      price_per_search: cost.pricePerSearch,
      cost_usd: cost.costUsd,
    })
    if (error) console.error(`cost ledger: could not record ${row.task} on ${row.model}: ${error.message}`)
  } catch (e) {
    console.error('cost ledger: could not record a call:', e instanceof Error ? e.message : String(e))
  }
}

/** A human line for a log, so a call's cost is greppable even if the insert failed. */
export function describeCost(row: LedgerRow): string {
  const c = estimateCost(row)
  const usd = c.costUsd === null ? 'UNPRICED' : `$${c.costUsd.toFixed(4)}`
  return `cost: ${row.task} ${row.model}${row.effort ? `/${row.effort}` : ''} ` +
    `in=${row.inputTokens} out=${row.outputTokens} searches=${row.searches} ` +
    `${(row.wallMs / 1000).toFixed(1)}s ${usd}`
}

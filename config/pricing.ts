/**
 * WHAT A MODEL CALL COSTS — `DECISIONS.md` §128 J.
 *
 * *** THIS FILE IS THE OWNER'S TO EDIT. *** It is config, not code: prices change, they are
 * published by Anthropic rather than derived by us, and correcting one must never need a
 * developer. Nothing here decides behaviour — it only prices what already happened.
 *
 * ---------------------------------------------------------------------------
 * ⚠ THESE NUMBERS HAVE NOT BEEN VERIFIED AGAINST THE PRICING PAGE BY THIS SESSION.
 *
 * They are the published list prices as understood at the time of writing, and **every figure
 * in the cost ledger scales linearly with them.** If a number here is wrong, every total
 * downstream is wrong by the same factor and nothing else in the system will notice.
 *
 * **Check these first, before trusting any total.** A wrong price here is the single cheapest
 * way to make the whole ledger lie.
 * ---------------------------------------------------------------------------
 *
 * A model that is NOT in this table is priced as `null`, never as zero — see `lib/costLedger.ts`.
 * Its tokens are still recorded. Null means "not priced"; it does not mean free.
 */

export interface ModelPrice {
  /** US dollars per million INPUT tokens. */
  inputPerM: number
  /** US dollars per million OUTPUT tokens. */
  outputPerM: number
}

/** Per-search cost for the server-side `web_search` tool, in US dollars. */
export const PRICE_PER_SEARCH = 0.01

/**
 * Keys are the exact model ids sent to the API — the same strings `lib/ai.ts` resolves. An id
 * not listed here prices as null rather than matching a prefix: `claude-opus-5` and a future
 * `claude-opus-5-1` are different products and guessing that they cost the same is exactly the
 * kind of invented number this table exists to keep out.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5':             { inputPerM: 15, outputPerM: 75 },
  'claude-sonnet-5':           { inputPerM: 3,  outputPerM: 15 },
  'claude-sonnet-4-5':         { inputPerM: 3,  outputPerM: 15 },
  'claude-haiku-4-5-20251001': { inputPerM: 1,  outputPerM: 5 },
}

/**
 * WHAT A MODEL CALL COSTS — `DECISIONS.md` §128 J.
 *
 * *** THIS FILE IS THE OWNER'S TO EDIT. *** It is config, not code: prices change, they are
 * published by Anthropic rather than derived by us, and correcting one must never need a
 * developer. Nothing here decides behaviour — it only prices what already happened.
 *
 * ---------------------------------------------------------------------------
 * ✅ VERIFIED BY THE OWNER AGAINST ANTHROPIC'S PRICING PAGE, 23 SEPTEMBER 2026.
 *
 * The figures below are checked, not assumed. The previous version of this file carried
 * unverified numbers and said so; those were wrong — Opus 5 was listed at three times its real
 * price and Sonnet 5 at 1.5 times. **Every figure in the cost ledger scales linearly with this
 * table**, which is why it was flagged rather than quietly trusted, and why the correction
 * changed conclusions rather than decimals: the Opus-to-Sonnet cost ratio fell from 5:1 to 2.5:1.
 *
 * Re-check on any price announcement. Correcting a number here changes what the NEXT call is
 * costed at and **leaves every past row alone** — see `PRICES_VERIFIED_ON` below.
 * ---------------------------------------------------------------------------
 *
 * A model that is NOT in this table is priced as `null`, never as zero — see `lib/costLedger.ts`.
 * Its tokens are still recorded. Null means "not priced"; it does not mean free.
 *
 * *** PAST ROWS ARE NEVER REPRICED. *** `ai_calls` copies these numbers onto each row at the
 * call (migration 038). A row written before this correction still carries the prices it was
 * costed at, because what a call cost is a fact about the past and editing it would make last
 * month's spend a different number with no record that it moved. `npm run cost` detects rows
 * priced at a superseded rate and says so in its own output.
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
  'claude-opus-5':             { inputPerM: 5, outputPerM: 25 },
  'claude-opus-5-5':           { inputPerM: 4, outputPerM: 20 },
  'claude-sonnet-5':           { inputPerM: 2, outputPerM: 10 },
  'claude-sonnet-4-5':         { inputPerM: 3, outputPerM: 15 },
  // Both spellings of Haiku 4.5 are listed. The dated id is what `lib/ai.ts` sends today and
  // the bare alias is what a person types — an id that resolves at the API and prices as null
  // here would record its tokens with no cost, which is the quiet way a total goes wrong.
  'claude-haiku-4-5-20251001': { inputPerM: 1, outputPerM: 5 },
  'claude-haiku-4-5':          { inputPerM: 1, outputPerM: 5 },
}

/**
 * The day the table above was last checked against the published price list, by a person.
 *
 * `npm run cost` prints it, so a report always says how old its prices are rather than leaving
 * the reader to assume they are current.
 */
export const PRICES_VERIFIED_ON = '2026-09-23'

/**
 * Corrections to this table, newest first — so a report can say WHY a stored price differs from
 * the current one, which is not the same question as whether it differs.
 *
 * *** A PRICE THAT CHANGED AND A PRICE THAT WAS WRONG ARE DIFFERENT THINGS. *** When Anthropic
 * changes a price, a row costed at the old one records what was actually spent and is correct
 * forever. When this table was simply WRONG, a row costed from it records a number nobody was
 * ever charged — the tokens are right, the money is not. Both leave the row alone; only the
 * second means the stored total was never real, and a reader has to be told which they are
 * looking at.
 */
export interface PriceCorrection {
  /** ISO timestamp: rows written BEFORE this carry the superseded numbers. */
  on: string
  /** `correction` = this table was wrong. `change` = the vendor changed the price. */
  kind: 'correction' | 'change'
  note: string
}

export const PRICE_CORRECTIONS: PriceCorrection[] = [
  {
    on: '2026-09-23T18:40:00Z',
    kind: 'correction',
    note: 'Opus 5 was listed at $15/$75 and is $5/$25; Sonnet 5 was listed at $3/$15 and is '
        + '$2/$10. The original figures were never verified against the price list and were '
        + 'flagged as unverified in this file. Rows written before this carry a cost NOBODY WAS '
        + 'CHARGED — their tokens are right and their money is an overestimate of about 2.8x.',
  },
]

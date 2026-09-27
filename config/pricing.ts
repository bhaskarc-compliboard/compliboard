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

/**
 * Per-search cost for the server-side `web_search` tool, in US dollars.
 *
 * **$10 per 1,000 searches, and it is NOT per model** — the same figure for Opus, Sonnet and Haiku,
 * which is why it sits here rather than in `ModelPrice`. Confirmed 26 September 2026 against
 * `PRICE_SOURCE_URL` below: *"Web search is available on the Claude API for $10 per 1,000 searches,
 * plus standard token costs for search-generated content."* A search the API refuses is not billed,
 * which is why `lib/ai.ts` counts `usage.server_tool_use.web_search_requests` and not result blocks.
 */
export const PRICE_PER_SEARCH = 0.01

/**
 * Where the numbers in this file come from. Kept next to them so a re-check is a click, not a search.
 *
 * The page carries more than this table does — 5-minute and 1-hour cache writes, cache reads, the
 * Batch API's 50%, fast mode. **None of those are priced here, because `ai_calls` does not record
 * the tokens they would apply to**: migration 038 stores input, output and searches, so a cache read
 * arrives as an ordinary input token and is costed as one. That is an overestimate, never an
 * underestimate, and it is the direction to be wrong in — but it is a known limit of this table and
 * not a rounding error.
 */
export const PRICE_SOURCE_URL = 'https://platform.claude.com/docs/en/about-claude/pricing'

/**
 * Keys are the exact model ids sent to the API — the same strings `lib/ai.ts` resolves. An id
 * not listed here prices as null rather than matching a prefix: `claude-opus-5` and a future
 * `claude-opus-5-1` are different products and guessing that they cost the same is exactly the
 * kind of invented number this table exists to keep out.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5':             { inputPerM: 5, outputPerM: 25 },
  // OPUS 5.5 — $4/$20, re-checked against PRICE_SOURCE_URL on 26 September 2026, which lists it as
  // "Claude Opus 5.5 … $4 / MTok … $20 / MTok" and gives the API id `claude-opus-5-5` on the models
  // overview page. It was already in this table at these figures from the owner's 23 September pass
  // and **nothing moved**, so there is no PRICE_CORRECTIONS entry: a row that was right stays right,
  // and inventing a correction would say a past total had been wrong when it had not.
  // It is CHEAPER than Opus 5 — $4/$20 against $5/$25 — so a future move of the judgement tier to it
  // lowers the ledger rather than raising it. (Its cache reads are 0.05x rather than 0.1x, which this
  // table cannot express; see PRICE_SOURCE_URL's note above.)
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
 * The day the table above was last checked against the published price list, **by a person**.
 *
 * `npm run cost` prints it, so a report always says how old its prices are rather than leaving
 * the reader to assume they are current.
 *
 * *** IT DID NOT MOVE ON 26 SEPTEMBER, AND THAT IS DELIBERATE. *** Claude Code re-checked the Opus
 * 5.5 and web-search figures against `PRICE_SOURCE_URL` that day and found them unchanged — the
 * comments on those two entries record it, with the sentences the page actually carries. Advancing
 * this date would claim the OWNER had checked the WHOLE table that day, which is what the date
 * means and is not what happened. An agent re-reading one row is not the same event as a person
 * verifying the table, and the file's own header says which of the two this constant is for.
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

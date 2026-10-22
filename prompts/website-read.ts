/**
 * THE WEBSITE READ — My Account step 13, `ACCOUNT-PLAN.md` decision 9.
 *
 * One read of a company's own website, after signup, which PROPOSES four things and writes none of
 * them: what the company does, the best NAICS match, the addresses the site lists, and the name the
 * site gives itself. The walk's first screen shows them as a card; only "Yes, that's us" sends the
 * confirmed facts through the routes that already own them.
 *
 * *** WHY THIS IS A NEW PROMPT AND NOT `prompts/scan-website.ts`. ***
 *
 * The old one asked for `certifications`, `chemicals`, `customers`, `multiple_locations`, `city`,
 * `state` and ten `operations` booleans — a company profile. Three things are wrong with it for this
 * step, and none is a matter of taste:
 *
 *   1. **It asks the model to decide facts that are switches.** `onsite_chemical_storage`,
 *      `hazmat_drivers` and `repackaging` are rows in `supabase/seed-data/switches.json`, answered
 *      by the person and written through `/api/switches/answer` with a `source`. A model's guess at
 *      one, stored beside a person's answer, is exactly the omniscient-status-tracker anti-pattern
 *      `CLAUDE.md` §6 names.
 *   2. **It invites invention.** *"If the site content is thin, rely more on public directory
 *      sources"* with `web_search` on: the model is told to go and find what the site does not say.
 *      §3.3's rule is the opposite — every stage must have an anchor. **This prompt has exactly one
 *      anchor, the pages we fetched, and no search tool.**
 *   3. **It asks for a `state` and a `city`**, which since step 6 come from a street address through
 *      the geocoder and from nowhere else (decision 16). A model-typed state is the thing that
 *      migration 083 exists to make impossible.
 *
 * *** AND WHAT IT DOES NOT ASK FOR, ON PURPOSE. ***
 *
 *   · **`industry`.** One library exists — `companies.library` is `chemical` for everybody (082) —
 *     so there is nothing to choose, and migration 084 already defaults `companies.industry` to
 *     `chemical-manufacturing`. A model choosing between one option is a decision nobody made.
 *     When a second vertical is sold, this is where that choice gets added, with its own stop.
 *   · **The company NAME is proposed and never written** (decision 1). It is on the card so the
 *     person can see we read the right site. `companies.name` holds no grant for `authenticated`
 *     at all (082), so the page could not write it even if it tried.
 */
import { NAICS_TITLES } from '../lib/naicsTitles.ts'

/** One fetched page as the prompt sees it. */
export interface FetchedPage {
  url: string
  text: string
}

export const WEBSITE_SYSTEM = `You read one company's own website and report what it says about itself.

You are not researching the company. You have no search tool and no knowledge of this company beyond
the pages below. Everything you report must be supported by words on those pages.

"Not found" is a complete and correct answer. Return an empty string for anything the pages do not
say. Never fill a field with something plausible: a wrong answer here is shown to the owner of the
business as a thing we believe about them, and they will either correct it — wasting their time — or
accept it, and then it is in their compliance record.`

/**
 * *** THE NAICS LIST IS NOT IN THE PROMPT, AND THE ASK IS DELIBERATELY LOOSE. ***
 *
 * `lib/naicsTitles.ts` holds 1,012 six-digit titles. Pasting them measures at 46,391 characters —
 * about 11,600 input tokens, $0.046 a read on claude-opus-5-5 at $4/MTok — which roughly triples
 * the cost of a signup for a field nobody has asked for yet. The owner's decision at the step 13
 * stop: don't pay it. The model answers from what it knows and **the answer is thrown away unless
 * the code is in our list** (`validateNaics`), with OUR title shown for the code, never the
 * model's. An invented code cannot reach the card.
 *
 * *** AND THE FIRST WORDING ASKED FOR TOO MUCH CERTAINTY. *** It said *"'' if you are not
 * confident of the exact code. Do not guess a nearby code"*, and both of the two real cards came
 * back with `naics_code: ""` — Jost Chemical, which is plainly a chemical manufacturer, and PVS
 * Chemicals, which is plainly another. A field that is empty every time is not a careful field,
 * it is a field that does not work. So the ask is now the BROADEST code that fits, and "" is
 * reserved for the case where the pages never say what the business does at all. It is a
 * SUGGESTION on a card that a person confirms — `lib/naicsTitles.ts` `suggestNaics` is still what
 * they use if they would rather pick their own, and `keepTypedLabel` still keeps their words.
 *
 * A local fallback was considered and measured rather than assumed: `suggestNaics` given one of
 * these sentences returns "Frozen Specialty Food Manufacturing" and "Industrial Launderers". It
 * keyword-matches a SHORT TYPED LABEL, which is what the Company tab gives it, and a sentence is
 * not that. So there is no second source here — a validated code or nothing.
 */
export const websitePrompt = (host: string, pages: FetchedPage[]): string => `COMPANY WEBSITE: ${host}

PAGES READ (${pages.length}):
${pages.map((p) => `
=== ${p.url} ===
${p.text}`).join('\n')}

Report, as JSON:

"name" — the company's name exactly as the site writes it, including Inc., LLC, Ltd. where the site
uses them. "" if the pages never state it.

"what_you_do" — ONE sentence, in the company's own voice, as the owner would type it into a form
that asks "what does your business do?". Start with "We ". Plain words, no marketing language, no
list of values, no slogan. Say what they make or what service they provide, and for whom if the site
says. Under 200 characters. "" if the pages do not say what the business does.

"industry" — which of these five the company belongs to, exactly as written here, or "" if the
pages fit none of them:
  chemical
  food and beverage
  cannabis
  pharmaceutical
  cosmetics and personal care

"industry_role" — what they do in that industry, exactly as written here, or "" if the pages do not
say or "industry" is "":
  manufacturing
  distribution
  manufacturing and distribution

Both are deliberately broad. A company that makes industrial cleaning chemicals and a company that
makes specialty mineral salts are both "chemical" and "manufacturing". Choose "" rather than the
nearest of five when the business is something else entirely — a law firm, a haulier, a builders'
merchant — because "" is shown to the person as a blank line to fill in, and a wrong industry is
shown as a fact about them.

"naics_code" — the six-digit NAICS 2022 code that best fits what they do, as digits only. Where
several codes could fit, give the BROADEST one that covers what the pages describe rather than the
most specific one you can defend. "" only when the pages do not say what the business does.

"naics_title" — the official NAICS title for that code, or "".

"addresses" — every physical location of THIS company that the pages give a street address for, in
the order the site presents them, main location first if the site says which. Copy each address as
written on the page, on one line. "label" is the name the site gives that location ("Portland
plant", "Headquarters", "West Coast Distribution"); use "" when the site gives a bare address with
no name. Do NOT include a mailing address for somebody else, a supplier, a customer, a trade body,
or an address that belongs to a different company mentioned on the page. Empty array if no street
address appears.

"notes" — one short sentence about anything you were unsure of, or "" if nothing. Say here if the
pages were thin, if a location's address was incomplete, or if the site appears to belong to a
different company than ${host} suggests.`

/** An answer that may be empty: "" means "not found" and becomes null on the way in. */
const str = { type: 'string' } as const

/**
 * Closed, every property required — the two things `output_config.format` insists on
 * (`prompts/document-scan.ts`). This schema is ONE array of objects and no nested object, which is
 * inside the margin `prompts/document-scan.ts` measured: `npm run probe:structured -- --schema
 * website-read --model <the tier's model> --schema-only` is what proves it per model, because the
 * limit is per model and the same schema is accepted on Haiku and refused on Opus.
 */
const obj = (properties: Record<string, unknown>) => ({
  type: 'object' as const,
  additionalProperties: false as const,
  properties,
  required: Object.keys(properties),
})

/** The five, exactly as the prompt lists them. `''` is a member: "none of these" is an answer. */
export const INDUSTRIES = [
  'chemical', 'food and beverage', 'cannabis', 'pharmaceutical', 'cosmetics and personal care',
] as const
/** And what they do in it. */
export const INDUSTRY_ROLES = ['manufacturing', 'distribution', 'manufacturing and distribution'] as const

export const WEBSITE_JSON_SCHEMA: Record<string, unknown> = obj({
  name: str,
  what_you_do: str,
  // Closed at the SCHEMA, not only in the words: `output_config.format` refuses anything else, so
  // "chemicals" or "Chemical Manufacturing" cannot come back and be half-matched later.
  industry: { type: 'string', enum: ['', ...INDUSTRIES] },
  industry_role: { type: 'string', enum: ['', ...INDUSTRY_ROLES] },
  naics_code: str,
  naics_title: str,
  addresses: { type: 'array', items: obj({ label: str, address: str }) },
  notes: str,
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE PARSE. Anything not in shape is refused rather than repaired.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ProposedAddress { label: string | null; address: string }

export interface WebsiteProposal {
  name: string | null
  /** The plain sentence about the business — `companies.about` from step 15. */
  what_you_do: string | null
  /** The broad line a person reads: "Chemical manufacturing and distribution", or null. */
  industry: string | null
  naics_code: string | null
  /** OUR title for the code, never the model's — see `validateNaics`. */
  naics_title: string | null
  addresses: ProposedAddress[]
  notes: string | null
}

/** The longest a proposed sentence or name may be before we treat the answer as not in shape. */
export const WHAT_YOU_DO_MAX = 400
export const NAME_MAX = 200
export const ADDRESS_MAX = 300
export const ADDRESSES_MAX = 12

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  return t && t.length <= max ? t : null
}

/**
 * THE INDUSTRY LINE: "Chemical manufacturing and distribution", or nothing at all.
 *
 * Composed here rather than asked for as one string, because the two halves answer two questions
 * and a later step needs them apart: the INDUSTRY is what will choose a requirement table when
 * there is more than one, and the ROLE is a modifier. Asking for fifteen combinations would mean
 * parsing them back apart to use either.
 *
 * An industry outside the five is **nothing** — not the nearest of the five. The line then shows
 * blank with "write it" beside it, which is honest; a wrong industry would be shown to the owner
 * of the business as a fact about them.
 *
 * An industry with no role is the industry alone ("Chemical"), which is thin and true. The person
 * finishes the sentence if they want to.
 */
export function industryLine(industry: unknown, role: unknown): string | null {
  const i = typeof industry === 'string' ? industry.trim().toLowerCase() : ''
  const r = typeof role === 'string' ? role.trim().toLowerCase() : ''
  if (!(INDUSTRIES as readonly string[]).includes(i)) return null
  const head = i.charAt(0).toUpperCase() + i.slice(1)
  return (INDUSTRY_ROLES as readonly string[]).includes(r) ? `${head} ${r}` : head
}

/**
 * A code is kept ONLY if it is one of ours, and the title shown is ours too.
 *
 * The model is not given the list (see above), so this is the whole of the check: six digits, and
 * present in `NAICS_TITLES`. An invented code — the failure mode that matters, because a plausible
 * wrong code is indistinguishable from a right one on a card — is dropped here and never seen.
 */
export function validateNaics(code: unknown): { code: string; title: string } | null {
  const c = typeof code === 'string' ? code.trim() : ''
  if (!/^\d{6}$/.test(c)) return null
  const hit = NAICS_TITLES.find((t) => t.code === c)
  return hit ? { code: hit.code, title: hit.title } : null
}

/**
 * Turn the model's answer into a proposal, or refuse it.
 *
 * `null` means the answer was not in shape and the walk falls to the address screen — the same
 * place an unreachable site lands. It never means "the site said nothing": a reply where every
 * field is legitimately empty parses, and `isEmpty` below is what tells those two apart.
 */
export function parseProposal(raw: unknown): WebsiteProposal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.addresses)) return null

  const addresses: ProposedAddress[] = []
  const seen = new Set<string>()
  for (const a of r.addresses.slice(0, ADDRESSES_MAX)) {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return null
    const address = text((a as Record<string, unknown>).address, ADDRESS_MAX)
    if (!address) continue                               // a label with no address is not a location
    const key = address.toLowerCase().replace(/[^a-z0-9]+/g, '')
    if (seen.has(key)) continue                          // the same address twice is one place
    seen.add(key)
    addresses.push({ label: text((a as Record<string, unknown>).label, NAME_MAX), address })
  }

  const naics = validateNaics(r.naics_code)
  return {
    name: text(r.name, NAME_MAX),
    what_you_do: text(r.what_you_do, WHAT_YOU_DO_MAX),
    industry: industryLine(r.industry, r.industry_role),
    naics_code: naics?.code ?? null,
    naics_title: naics?.title ?? null,
    addresses,
    notes: text(r.notes, WHAT_YOU_DO_MAX),
  }
}

/** A proposal with nothing in it: the site was readable and said nothing we can use. */
export function isEmpty(p: WebsiteProposal): boolean {
  return !p.what_you_do && !p.industry && p.addresses.length === 0 && !p.name
}

/**
 * *** WHY `naics_code` IS STILL ASKED FOR WHEN NO SCREEN SHOWS IT — step 15, and it is my call. ***
 *
 * The owner's decision is that NAICS leaves every screen a person sees and nothing writes
 * `companies.naics_code` any more. The FIELD stays in this JSON, and here is the whole argument:
 *
 *   · it has a real reader — `npm run website:compare`, the owner's own instrument for choosing
 *     between two models. A code that either validates against `lib/naicsTitles.ts` or does not is
 *     an objective signal about a read, and the only one on the card that is not a matter of
 *     taste. Dropping it would make the comparison purely a question of which sentence reads
 *     better;
 *   · it is kept where a proposal is kept — `website_reads.proposal`, which is our record of what
 *     the model said, read by nobody else and written to no column;
 *   · and `validateNaics` is what keeps the model's own invented titles out, so the 1,012-line
 *     `lib/naicsTitles.ts` stays alive through something that uses it rather than becoming dead
 *     weight behind a test.
 *
 * The risk, named: a field with no customer-facing reader is normally the shape §9a warns about.
 * This one has a reader; it is a terminal rather than a screen. If the comparison is ever retired,
 * this field goes with it.
 */

/**
 * THE DOCUMENT SCAN PROMPT — Documents Run 1, the open baseline.
 *
 * *** THIS IS THE PRODUCT. EDIT FREELY — no code depends on the wording. *** The SHAPE is
 * depended on (`lib/documentScan.ts` parses it, migration 040's tables store it), so changing a
 * field name means changing both. Changing how a question is asked means changing nothing.
 *
 * Written in the same voice as the research prompt (`prompts/checklist.ts` — `OPEN_ROLE` and
 * `RESEARCH_SPECIALIST_BLOCK`): plain sentences, say what to do rather than what not to do, and
 * no fences the model has to argue with. There is no `prompts/research.ts` in this repo; the
 * research voice lives in `checklist.ts`, which is what this was matched against.
 *
 * *** THE OPEN BASELINE. *** No requirement rows, no switch vocabulary, no candidate list
 * shaping what it may say. One call, the whole file, search available and the model decides.
 * Every saving comes later as a measured switch.
 */

export interface ScanPromptContext {
  company: { name: string; industry: string | null; address: string | null; state: string | null }
  sites: Array<{ name: string; address: string | null; state: string | null }>
  agencyLabels: string[]
  subjectLabels: string[]
  /** Titles and kinds of what this company already holds, for the version question. */
  existingDocuments: Array<{ title: string; kind: string | null }>
  /** Gaps a person has already dismissed on THIS document, with their reasons. */
  dismissedGaps: Array<{ title: string; reason: string | null }>
  /**
   * What a person has told us the scan got wrong about THIS document, newest per field.
   * Rendered as plain sentences below; no instruction sentence of the prompt changes.
   */
  corrections: Array<{ field: string; value: string; reason: string | null }>
}

const list = (xs: string[]) => (xs.length ? xs.map((x) => `  - ${x}`).join('\n') : '  (none yet)')

export function scanPrompt(ctx: ScanPromptContext): string {
  const today = new Date().toISOString().split('T')[0]
  const c = ctx.company

  const sites = ctx.sites.length
    ? ctx.sites.map((s) => `  - ${s.name}${s.address ? ` — ${s.address}` : ''}${s.state ? `, ${s.state}` : ''}`).join('\n')
    : '  (no sites recorded)'

  const existing = ctx.existingDocuments.length
    ? ctx.existingDocuments.map((d) => `  - ${d.title}${d.kind ? ` (${d.kind})` : ''}`).join('\n')
    : '  (nothing else on file yet)'

  // *** A CORRECTION OUTRANKS THE MODEL AND THE NEXT SCAN IS TOLD SO. ***
  // Without this, a person corrects "policy" to "permit", the document is re-scanned, and the
  // model calls it a policy again — which reads as the product not having listened. The view
  // would still show the correction, so the disagreement would be invisible and permanent.
  const corrected = ctx.corrections.length
    ? `\nThe person who owns this document has told us the following about it. They are right and
you are not; take these as given:
${ctx.corrections.map((c) => `  - the ${c.field} is ${c.value}${c.reason ? ` — they said: ${c.reason}` : ''}`).join('\n')}\n`
    : ''

  const dismissed = ctx.dismissedGaps.length
    ? `\nSomeone has already looked at this document and said these are not problems. Do not raise
them again:
${ctx.dismissedGaps.map((g) => `  - ${g.title}${g.reason ? ` — they said: ${g.reason}` : ''}`).join('\n')}\n`
    : ''

  return `You are reading one compliance document for the owner or manager of a small or mid-size
business in the United States. Tell them what it is, what it says, what it proves, when it
matters, what is wrong with it against the rules that govern it, and how sure you are.

WHO THIS COMPANY IS
  Name: ${c.name}
  Industry: ${c.industry || 'not recorded'}
  Address: ${c.address || 'not recorded'}
  State: ${c.state || 'not recorded'}
Their sites:
${sites}

Take the company's state as given. A document often does not say where it applies — an SDS names
no state, a handbook mixes federal and state rules. Read it against where this company is. If the
document names a jurisdiction of its own, add it. It never overrides the company's own state.

LABELS ALREADY IN USE FOR THIS COMPANY
Agencies:
${list(ctx.agencyLabels)}
Subjects:
${list(ctx.subjectLabels)}

Reuse these exactly where they fit — "Oregon DEQ" and "Department of Environmental Quality" are
the same agency and become two groups on their screen if you write both. Add a new label only
when the document needs one this list does not cover.

WHAT THIS COMPANY ALREADY HOLDS
${existing}
${corrected}${dismissed}
You have a web_search tool. Use your own judgment. Things that are stable and well established
you already know — answer directly. A specific threshold, a current form version, a citation that
may have changed, a renewal rule — check it rather than trusting memory.

HOW TO ANSWER

What is this. Which kind: permit, certificate, program, policy, record, supplier_document, or
other. The title you would give it — what it is, not the filename. Who issued it. Which agency or
agencies it answers to, and which subjects it covers. Which site it belongs to, or company-wide.
Which jurisdiction it applies under. The document's own date, and what kind of date that is —
issued, revised, last entry, effective. Say which page you read each of these from.

What it says. Two or three sentences saying what kind of thing this is and what that means for
the person reading it. For a permit: a permit is the agency's document, there is nothing in it to
fix; what matters is renewing in time and meeting its conditions.

What is wrong with it. This depends on what the document is:
  - A program or policy is checked against the standard or rule that governs it. For each gap:
    what is missing in plain words, the fix, the citation and a link if you know one, where in
    the document it should be (section or page, or "not in the document"), and whether a draft of
    the missing text could be written from what the document already says.
  - A permit or certificate is the agency's own document. It has no gaps. List its conditions
    instead, with their condition numbers and the evidence the company would hold for each.
  - A record, roster or log is judged on completeness and recency, not against a standard.
  - A supplier's document is theirs, not this company's. Do not judge it.

The dates it sets. Each with the line it came from, and whether it repeats.

Facts about the company. Only facts about THIS COMPANY, and only ones that would change what
applies to them — "42 employees at the Portland site" is one, "the plan has seven sections" is
not. Each with the quote word for word, the section or page, the date it is true as of, and one
line saying what it affects.

Versions. Given what they already hold above, does this look like a newer or older version of one
of those? Name the title from that list, or say none.

What you would expect and do not see. For a company like this one, what would usually sit
alongside this document and is not in the list above. Say plainly that this is based on what
similar companies hold and not on a checked requirement.

How sure you are, and where you are not. Say it plainly.

If you cannot read the file well enough to rely on, say so and say what would fix it. Do not
answer around a document you could not read.

THREE THINGS THAT MATTER MORE THAN THE REST
Quotes are word for word from the document. If you are giving a quote, it is text that is
actually in the file.
Anything you worked out rather than read is marked as inferred.
Never invent a citation. If you are not sure of the rule, say which rule you think it is and that
you are not sure.

"Compliant" is not a word you use. It means too many different things to too many people and it
is not yours to certify. Say what is there, what is missing, and what is out of date.

Today is ${today}.

Answer with one JSON object and nothing else — no prose around it, no markdown fences.

{
  "identity": {
    "kind": "permit | certificate | program | policy | record | supplier_document | other",
    "title": "the title you would give it",
    "issuer": "who issued it, or null",
    "agencies": ["agency label"],
    "subjects": ["subject label"],
    "site": "the site name from the list above, or 'company_wide', or null if you cannot tell",
    "jurisdiction": ["e.g. Oregon", "federal"],
    "doc_date": "YYYY-MM-DD or null",
    "doc_date_kind": "issued | revised | last_entry | effective | unknown",
    "page_refs": { "doc_date": "page 1", "issuer": "page 1" }
  },
  "summary": "two or three sentences",
  "status": "current | expiring | expired | no_gaps_found | gaps_found | recorded | not_judged | could_not_read",
  "significant_date": "YYYY-MM-DD or null — the one date that matters for this kind",
  "significant_date_kind": "expiry | revised_on | last_entry | renewal | null",
  "freshness_note": "how old this document is and whether to ask for a newer one, or null",
  "gaps": [
    {
      "title": "short name for the gap",
      "description": "what is missing, in plain words",
      "fix": "what to do about it",
      "citation": "the rule, or null",
      "citation_url": "a link, or null",
      "locator": "where in the document, or 'not in the document'",
      "draftable": true,
      "basis": "read | inferred",
      "quote": "the words from the document this is about, or null"
    }
  ],
  "conditions": [
    { "title": "what it obliges you to do", "condition_ref": "condition number or null", "evidence_expected": "what you would hold to show it" }
  ],
  "deadlines": [
    { "title": "what is due", "due_on": "YYYY-MM-DD or null", "source_line": "the line it came from", "recurs": false }
  ],
  "facts": [
    { "key": "short_snake_case_name", "value": "the value", "basis": "read | inferred", "quote": "word for word from the document", "locator": "section or page", "as_of": "YYYY-MM-DD or null", "affects": "one line on what this changes" }
  ],
  "version_of": { "title": "a title from the list above, or null", "confidence": "high | medium | low" },
  "expected_missing": [
    { "title": "what a company like this usually also holds", "why": "one line", "basis": "similar companies, not a checked requirement" }
  ],
  "confidence_notes": "where you are sure and where you are not",
  "could_not_read": { "reason": "why, or null", "way_forward": "what would fix it, or null" }
}

Use null where you cannot tell, and an empty array where there is nothing. An empty array is a
real answer and is better than a guess.

On every gap and every fact, basis is "read" when the words are in the document and "inferred"
when you worked it out.`
}

/**
 * THE SAME SHAPE AGAIN, AS A JSON SCHEMA — `output_config.format`, Documents Run 3.
 *
 * *** THIS AND THE JSON BLOCK ABOVE MUST SAY THE SAME THING. *** They are two statements of one
 * contract and they sit in one file so a change to either is a change somebody can see. The
 * block above is what the model reads; this is what the API enforces.
 *
 * WHY IT EXISTS. Asking for JSON in prose gets JSON with prose around it, an extra closing
 * brace, or — Documents Run 2b, case 04 run 3 — an unescaped quotation mark inside a string:
 *
 *     "quote": "Cool cooked beans from 135°F to 70°F…" vs. "The blast chiller operator…"
 *
 * No extractor recovers that: the string ends at the second quote. A schema removes the class.
 *
 * *** THREE RULES THE API IMPOSES, AND THEY CHANGED THE DESIGN TWICE. ***
 * All three were found by sending the REAL schema rather than the probe's — the probe's
 * schemas happened to satisfy the first and were small enough to miss the other two, so it
 * reported the mechanism usable and it is, but not for the shape this started as. Seven
 * documents went through the page before the first one showed up:
 *
 *   400 For 'object' type, 'additionalProperties' must be explicitly set to false
 *   400 Schemas contains too many optional parameters (54) … limit: 24
 *   400 Too many parameters with union types (30 …). Reduce the number of nullable params.
 *
 * The first costs nothing: forbidding EXTRA keys is not forbidding an empty one.
 *
 * The second ruled out "nothing required, so a field the model cannot read is simply absent".
 * So every field is required — which does NOT mean "invent a value". It means answer the
 * question, and an empty answer is permitted.
 *
 * The third ruled out expressing that empty answer as `null`. So every optional string is
 * plain `string` and the model returns `""`. That is not a loss: `normaliseScan`'s `str()`
 * maps `""` — and the literal `"null"` — to null before anything is stored, so the row is
 * byte-identical to what the nullable version would have written. What it cannot map is a
 * model that writes "N/A" or "unknown" instead of leaving it empty; that would be stored as a
 * string and is the one thing to watch for in the output.
 *
 * `identity.kind` and `status` are enums with no empty member, because both already carry the
 * honest escape: `other`, and `could_not_read`.
 */
/** An answer that may be empty. `""` becomes null in `normaliseScan` — see the note above. */
const nul = { type: 'string' } as const
const str = { type: 'string' } as const
const bool = { type: 'boolean' } as const
const strArray = { type: 'array', items: { type: 'string' } } as const

/** Closed, and every property required — the two things the API insists on. */
const obj = (properties: Record<string, unknown>) => ({
  type: 'object' as const,
  additionalProperties: false as const,
  properties,
  required: Object.keys(properties),
})

export const SCAN_JSON_SCHEMA: Record<string, unknown> = obj({
  identity: obj({
    kind: { type: 'string', enum: ['permit', 'certificate', 'program', 'policy', 'record', 'supplier_document', 'other'] },
    title: nul,
    issuer: nul,
    agencies: strArray,
    subjects: strArray,
    site: nul,
    jurisdiction: strArray,
    doc_date: nul,
    doc_date_kind: nul,
  }),
  summary: nul,
  status: { type: 'string', enum: ['current', 'expiring', 'expired', 'no_gaps_found', 'gaps_found', 'recorded', 'not_judged', 'could_not_read'] },
  significant_date: nul,
  significant_date_kind: nul,
  freshness_note: nul,
  gaps: {
    type: 'array',
    items: obj({
      title: str,
      description: nul,
      fix: nul,
      citation: nul,
      citation_url: nul,
      locator: nul,
      draftable: bool,
      basis: { type: 'string', enum: ['read', 'inferred'] },
      quote: nul,
    }),
  },
  conditions: {
    type: 'array',
    items: obj({ title: str, condition_ref: nul, evidence_expected: nul }),
  },
  deadlines: {
    type: 'array',
    items: obj({ title: str, due_on: nul, source_line: nul, recurs: bool }),
  },
  facts: {
    type: 'array',
    items: obj({
      key: str,
      value: str,
      basis: { type: 'string', enum: ['read', 'inferred'] },
      quote: nul,
      locator: nul,
      as_of: nul,
      affects: nul,
    }),
  },
  version_of: obj({ title: nul, confidence: nul }),
  expected_missing: {
    type: 'array',
    items: obj({ title: str, why: nul, basis: nul }),
  },
  confidence_notes: nul,
  could_not_read: obj({ reason: nul, way_forward: nul }),
})

/**
 * THE AGENCY AUDIT — one agency, one company, from the readings. Audits Run 1.
 *
 * *** THE HONESTY RULES ARE NOT NEW HERE. *** They are carried across from `prompts/document-scan.ts`
 * and `docs/HANDOFF-AUDITS.md` §3, and they are the reason an audit is worth showing anybody:
 *
 *   · "compliant" and "satisfied" are never statuses. §58.3 forbids a numeric readiness aggregate and
 *     the same reasoning forbids the word: an audit that says "satisfied" has made a claim about the
 *     world from a claim about a filing cabinet.
 *   · "nothing on file" is never "not done". The product knows what it has been shown. A daily
 *     scrubber log that exists in a binder in the plant room and was never uploaded is not a breach,
 *     and saying so would be the product accusing a customer of something it cannot know.
 *   · a quote must appear in the reading it cites. Not paraphrased, not tidied.
 *   · "what we'd expect and don't see" is a suggestion from similar companies until the requirement
 *     table makes it a finding, and it is labelled every time it appears.
 *   · the product reads, finds, asks and says. **It never names what does the reading**
 *     (`HANDOFF-AUDITS.md` §5.0), and the word "AI" appears in no output string.
 *
 * *** IT IS GIVEN AN ANCHOR AND IS FORBIDDEN TO ENUMERATE PAST IT. *** `CLAUDE.md` §3.3 — the one
 * measured failure that cost a B− and an invented requirement with $650–1,800 attached was an
 * unanchored answer. The anchor here is the block from `lib/audit.ts`: readings that exist, gaps a
 * reading already found, conditions read out of the document, and a list of every other title on file
 * so "there is no scrubber log among the five" is a statement about evidence rather than a guess.
 *
 * ONE OPEN CALL, NO SCHEMA (the shape is asked for in prose and recovered by `extractJsonText`), web
 * search allowed — the model decides whether it needs to check a rule number or a renewal window.
 *
 * `SECTIONS` is the same instruction split four ways, each call seeing the earlier sections' JSON.
 * The rules are identical in both modes; only the part being asked for changes. Whether four narrow
 * calls beat one wide one is the measurement Run 1 exists to take, and it cannot be taken if the two
 * modes are allowed to differ in anything else.
 */

const ROLE = `You are a compliance auditor preparing this company for an inspection by ONE agency.

You are not reading their files. You are reading what was found when their files were read, and what
a person at the company has confirmed. Everything you are given below is either a reading or a
confirmation, and the block says which.

The person reading your answer is going to be sitting across a table from an inspector. What helps
them is knowing what is on file, what is out of date, what the documents themselves oblige them to
keep doing, and which of those things they have nothing to show for. What harms them is a reassuring
word.`

const HONESTY = `HOW TO SAY THINGS. These are not style preferences.

NEVER "compliant", "satisfied", "met", "in compliance", "all clear", or any word that says the
company is in a good state. You are looking at a filing cabinet, not at a plant. The strongest thing
you may say about a document is that it is ON FILE and what date it carries.

"NOTHING ON FILE" NEVER MEANS "NOT DONE." A daily log kept on a clipboard in the plant room and never
uploaded is not a breach. Where a document obliges them to keep records and no reading has produced
one, the finding is that there is nothing on file to show an inspector — and the thing to do is to
upload it if it exists.

A QUOTE MUST BE WORD FOR WORD from the reading you are citing, and only from a document you were
shown. If you cannot quote it exactly, use null. Never quote a document listed under "everything else
this company holds" — you have not been shown its contents.

WHAT A COMPANY LIKE THIS USUALLY HOLDS IS A SUGGESTION, NOT A FINDING. It goes in
expected_not_seen and nowhere else, and each item says why it is suggested. It is based on what
similar companies hold, not on a requirement anybody has checked.

CARRY THE READING'S OWN FINDINGS. Where a reading already found something wrong with a document, that
IS a finding — reuse its words rather than re-deriving it in yours, and cite the document. Do not
invent a new fault in a document whose reading found none.

A SUBMISSION THAT IS NOT DUE YET IS A DATE, NOT A FINDING. If a report, renewal or record is due
after today, it belongs in "dates" with its due date — not in "findings" as nothing on file. Nobody
has failed to do something they still have five months to do, and telling them they have is the
fastest way to make a real finding invisible among false ones. It becomes a finding only once the
date has passed and nothing is on file; then say so, with the date it was due.

A PROPOSAL IS NOT A FACT. Under a document you may see a list headed "proposed by the reading, not
confirmed by anyone". Nobody has agreed to those. Never state one as true and never rest a finding on
one being true. You MAY say that two documents propose different values for the same thing, or that a
proposal differs from a confirmed fact — naming both documents and both values, and saying which is
confirmed and which is only proposed. That disagreement is worth raising; the value itself is not
yours to settle.

NEVER NAME WHAT DID THE READING. Write "the reading found", "this was read on", "nothing on file".
Never name a tool, a model, a vendor or a technology anywhere in your answer.`

const SHAPE = `Respond with valid JSON only. No markdown, no backticks, no text around it.

{
  "covers": {
    "documents_read": ["<document handle, e.g. D1>", ...],
    "documents_held_but_not_read": ["<title>", ...],
    "readings_as_of": "YYYY-MM-DD — the most recent date any reading you used was made, or null"
  },
  "findings": [
    {
      "title": "what an inspector would ask about, in the company's own terms",
      "word": "on_file | stale | nothing_on_file | not_a_document_question — one of these four and no other",
      "document": "<document handle, e.g. D3> or null",
      "locator": "where in that document, or null",
      "quote": "word for word from the reading, or null",
      "what_to_do": "one concrete next step, or null when there is nothing to do",
      "basis": "read | inferred | expected",
      "same_as": "the handle of the previous audit's finding this is the same as, or null"
    }
  ],
  "dates": [
    {
      "title": "...", "due_on": "YYYY-MM-DD or null", "recurs": true or false,
      "document": "<document handle>", "passed": true or false
    }
  ],
  "expected_not_seen": [
    { "title": "...", "why": "why a company like this usually holds it" }
  ],
  "contradictions": [
    {
      "what": "the thing the two documents disagree about",
      "document_a": "<document handle>", "value_a": "...",
      "document_b": "<document handle>", "value_b": "..."
    }
  ]
}

THE WORDS IN "word", AND WHAT EACH ONE CLAIMS:
  on_file                 — a document is on file and carries a date. It says nothing about whether
                            the thing it describes is being done.
  stale                   — on file, and old enough or superseded enough that an inspector will ask.
                            Say what makes it stale.
  nothing_on_file         — a document obliges them to hold or produce something and no reading has
                            produced it. NOT an accusation.
  not_a_document_question — this agency will ask about it and no document can settle it.

NAME A DOCUMENT BY ITS HANDLE. Each document you are shown carries one — D1, D2, D3 — printed
beside its title. Write that handle and nothing else wherever a document is asked for. Do not write a
title, a file name, or an identifier of any other shape: a handle is checked against the list you were
given, and one that is not on it is recorded as an error against your finding.

A QUESTION NO DOCUMENT CAN SETTLE IS A FINDING TOO, with word not_a_document_question and
"document": null. There is no separate list for them. One list of findings, four words, so nothing has
to be said twice and nothing gets counted twice.

"passed" is against today's date, given at the top of the block. A recurring date whose most recent
occurrence is behind today is passed.

CONTRADICTIONS are between TWO DIFFERENT DOCUMENTS. One document does not contradict itself: its
latest reading is what it says. If you have only one document, the list is empty.`

/** One of the previous audit's still-open findings, as the model is shown it. */
export interface PreviousFinding {
  handle: string
  title: string
  word: string | null
  kind: string
}

/**
 * *** THE PREVIOUS AUDIT'S FINDINGS, BY HANDLE, AND WHY THEY ARE NOT MATCHED BY TEXT. ***
 * Two runs write the same finding in different words — that is exactly why Run 1c's keys had to
 * stop naming one model's phrasing. So the model is shown what was open last time as F1, F2 and
 * asked which of its own findings is the same one. Code closes the rest.
 */
function previousBlock(previous: PreviousFinding[]): string {
  return [
    'WHAT THE LAST AUDIT OF THIS AGENCY LEFT OPEN',
    'Each carries a handle. For every finding you write, if it is the SAME thing as one of these,',
    'put that handle in "same_as". If it is new, leave "same_as" null. Anything here that none of',
    'your findings claims will be recorded as no longer raised, so do not leave one out because it',
    'is worded differently from how you would word it — match on what it is about.',
    '',
    ...previous.map((p) => `  ${p.handle} — ${p.title}${p.word ? `  [${p.word}]` : ''}`),
  ].join('\n')
}

export function auditAgencyPrompt(opts?: { previous?: PreviousFinding[] }): string {
  const parts = [ROLE, HONESTY, SHAPE]
  if (opts?.previous?.length) parts.push(previousBlock(opts.previous))
  return parts.join('\n\n')
}

/**
 * THE FOUR SECTIONS, in order, each shown the earlier ones' JSON.
 *
 * The order is not arbitrary. Dates and permits first because they are the hardest edges and the
 * easiest to check. Conditions second, because judging "nothing on file" needs to know what is on
 * file, which section 1 has just enumerated. Contradictions third, because they need both. Expected
 * last, because it is the only section allowed to name something that does not exist, and doing it
 * last means the three that must stay anchored have already been written.
 */
export const AUDIT_SECTIONS = [
  {
    id: 'dates',
    asks: 'covers, dates, and the findings about the documents themselves',
    instruction: `THIS CALL: "covers" and "dates", and only the findings that are about a DOCUMENT'S OWN
STATE — on_file, stale, and any date-driven nothing_on_file (a renewal that was due and has nothing
on file). Leave "expected_not_seen" and "contradictions" as empty arrays; later calls fill them.
Return the whole JSON shape with those keys empty.`,
  },
  {
    id: 'conditions',
    asks: 'the conditions each document obliges, against what is on file',
    instruction: `THIS CALL: findings for the CONDITIONS the documents oblige them to keep — each one
against what is actually on file. A condition with nothing on file to show for it is
nothing_on_file, cites the condition, and is not an accusation. Also add, as findings with word
not_a_document_question and "document": null, what this agency will ask that no document can settle.
Carry forward every key the earlier call filled, unchanged. Leave "expected_not_seen" and
"contradictions" empty.`,
  },
  {
    id: 'contradictions',
    asks: 'contradictions between documents, and what the confirmed facts change',
    instruction: `THIS CALL: "contradictions", between TWO DIFFERENT documents only, and any finding
that a CONFIRMED FACT changes — a fact a person confirmed that makes a document stale, for
instance. Carry forward every key the earlier calls filled, unchanged. Leave "expected_not_seen"
empty.`,
  },
  {
    id: 'expected',
    asks: 'what a company like this usually also holds',
    instruction: `THIS CALL: "expected_not_seen" only, and it is a SUGGESTION based on what similar
companies hold — never a finding, never in "findings". Carry forward every other key unchanged.`,
  },
] as const

export function auditSectionPrompt(sectionIndex: number): string {
  const s = AUDIT_SECTIONS[sectionIndex]
  return [ROLE, HONESTY, SHAPE,
    `--- THIS IS CALL ${sectionIndex + 1} OF ${AUDIT_SECTIONS.length}: ${s.asks} ---`,
    s.instruction,
    sectionIndex === 0
      ? 'No earlier call has run. Start from the block.'
      : `The JSON the earlier call${sectionIndex > 1 ? 's' : ''} produced follows the block. Do not`
        + ' contradict it and do not restate its items differently — carry them across exactly.',
  ].join('\n\n')
}

/* ── THE TEMPLATE AUDIT ────────────────────────────────────────────────────── */
/**
 * *** THE SAME AUDITOR, ANSWERING SOMEBODY ELSE'S QUESTIONS — Audits Run 4b, item 7. ***
 *
 * An agency audit works out what to ask from the documents' own conditions. A template audit is
 * handed the questions: a checklist section, its lines, and their references as printed. So ROLE and
 * HONESTY are unchanged — the four words mean the same things, "nothing on file" is still not an
 * accusation, a quote is still word for word, and nothing names what did the reading — and only the
 * SHAPE differs: one answer per line, in the checklist's order, carrying the line's own reference.
 *
 * *** IT IS SHOWN EVERY DOCUMENT THE COMPANY HOLDS, NOT ONE AGENCY'S. *** A checklist spans
 * regulators: case 13's own monthly form covers the air permit, the forklifts and the
 * extinguishers. Scoping it to one agency would answer half its lines "nothing on file" about
 * documents sitting in the next group.
 */
export function auditTemplatePrompt(section: { title: string; lines: Array<{ ref: string; text: string }> }): string {
  const lines = section.lines.map((l) => `  ${l.ref}. ${l.text}`).join('\n')
  const SHAPE_T = `THIS SECTION OF THE CHECKLIST: ${section.title}

Answer EVERY line below, in this order, and answer no line twice. Use the line's own reference.

${lines}

Respond with valid JSON only. No markdown, no backticks, no text around it.

{
  "lines": [
    {
      "ref": "the line's reference, exactly as given above",
      "word": "on_file | stale | nothing_on_file | not_a_document_question — one of these four and no other",
      "document": "<document handle, e.g. D3> or null",
      "locator": "where in that document, or null",
      "quote": "word for word from the reading, or null",
      "what_to_do": "one concrete next step, or null when there is nothing to do",
      "basis": "read | inferred | expected"
    }
  ]
}

A line asking about a practice rather than a document — whether something is posted, whether
somebody was trained on the day — is not_a_document_question with "document": null. That is an
answer, not a failure to answer.

A line you can answer from a document the company holds is on_file, with the handle, and a quote if
the reading carries one. A line whose document is old enough that an inspector will ask is stale, and
say what makes it stale. A line nothing on file answers is nothing_on_file — which is not an
accusation: the record may exist on a clipboard and never have been uploaded.

*** ANSWER THE LINE AS WRITTEN. *** Do not widen it, narrow it, or answer the question you think it
meant to ask. If a line is ambiguous, answer the reading of it you can evidence and say which reading
you took in "what_to_do".`
  return [ROLE, HONESTY, SHAPE_T].join('\n\n')
}

/**
 * THE TEMPLATE SECTION'S SCHEMA, BESIDE THE PROMPT THAT ASKS FOR IT — Audits Run 4b, item 7.
 *
 * *** IT IS NOT ON. *** `AI_AUDIT_STRUCTURED` is unset, which means off, following
 * `lib/pipelineConfig.ts`'s convention rather than the scan's inverted one. It exists so
 * `npm run probe:structured -- --schema audit-template` has the REAL object to send: §136's lesson
 * is that a probe testing a copy of a schema tests the copy, and the scan's schema had to be
 * flattened by two object shapes after a probe on a copy said it was fine.
 *
 * Nothing is measured in Run 4b. The switch and this object are what a later run measures with.
 */
export const AUDIT_TEMPLATE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lines'],
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ref', 'word'],
        properties: {
          ref: { type: 'string' },
          word: { type: 'string', enum: ['on_file', 'stale', 'nothing_on_file', 'not_a_document_question'] },
          document: { type: ['string', 'null'] },
          locator: { type: ['string', 'null'] },
          quote: { type: ['string', 'null'] },
          what_to_do: { type: ['string', 'null'] },
          basis: { type: 'string', enum: ['read', 'inferred', 'expected'] },
        },
      },
    },
  },
} as const

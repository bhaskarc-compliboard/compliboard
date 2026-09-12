# The Determination Gate — Stage 1
**Version:** 3 · **Updated:** 11 September 2026
**Supersedes:** version 2 (11 Sep). Adds **§11, proximity confirmation — specified, not
built**: confirming a numeric switch whose value sits near a threshold the current question
depends on. Not a blocking question — the gate asks when a fact is missing, this speaks when
a fact is present but fragile. Version 2 was the same day. Two corrections found while building: the
`/api/chat` change closes **one** of §0.8b's four undocumented routes, not four; and the gate
must read the primary site's jurisdiction from `entities`, which v1 omitted — without it the
gate asks where the worksite is, a fact every company already has.

**Status: SPEC. Nothing here is built.**
**Implements:** `TODO.md` 2.2 · `CHEMICAL-OR-WA.md` §5.2 Stage 1 · `WORKSPACE.md` §4.3
**Decisions:** `DECISIONS.md` §4 (the failure), §34 (the correction to §4)

Everything in this document is quality-affecting under `CLAUDE.md` §3.1 — prompt, output
schema, temperature, and what data feeds it. It is specified here, reviewed, and only then
written.

---

## 0. What the gate is, and the one thing it must not become

**Before anything is enumerated, decide what facts the answer depends on, whether we have
them, and whether a missing one changes the answer materially. If one does, ASK — and
produce nothing else.**

It is not a validator, not a form, and not a router. It runs once, before Stage 2, and its
only two outcomes are *proceed* and *ask*.

**The thing it must not become is a questionnaire.** A gate that asks three questions before
every answer has reproduced the intake form this product was sold as replacing.
`WORKSPACE.md` §4.4 promises the opposite — *the first conversation asks a few questions;
every conversation afterwards asks almost none*. Section 7 is the bound on that, and it is
part of the spec rather than a later refinement.

**Decided 11 September, and recorded here because it shapes everything below:**

1. **`/api/chat` gains `requireCompany()` as part of 2.2**, not as deferred security work. A
   gate that cannot read `company_switches` cannot avoid re-asking.

   *Corrected 11 Sep: an earlier draft of this line said it closes **four** of §0.8b's six
   routes. **It closes one.** §0.8b names six routes with no session check; two —
   `/api/industries` and `/api/signup` — are documented deliberate exceptions, leaving four
   undocumented: `/api/chat`, `/api/extract-dates`, `/api/feedback`, `/api/scan-website`.
   This work closes `/api/chat` only. **`/api/scan-website`'s blind SSRF and
   `/api/feedback`'s unescaped email interpolation are untouched**, and `/api/extract-dates`
   still takes an anonymous model call.*
2. **`follow_up_questions` and `clarifying_questions` are removed** — see §3.4 and
   `DECISIONS.md` §34.
3. **Sequence is 2.2 → 6.2 → 2.3.** The gate is built against empty `switches` and
   `company_switches` first, because that is the **permanent** case for scoped product facts,
   not a temporary one (§8).

---

## 1. The prompt

One prompt. One variable block, selected by `outputType`. **Not two prompts** — two prompts
drift apart and the drift is invisible.

**Parameters:** `temperature: 0.1` · `maxTokens: 1500` · `enableWebSearch: false` · strongest
model tier (`DECISIONS.md` §5 allocates strong-model budget to the gate and the critic).

**Web search is off, deliberately.** The gate decides what facts are *missing*; it does not
look anything up. A gate with search will research its way around a blocking fact and return
`proceed` on a guess — which is the exact failure it exists to prevent, arriving with
citations attached.

### 1.1 The shared body

```
You are the determination gate for CompliBoard. You run BEFORE any answer is produced.

Your only job is to decide whether the answer depends on a fact we do not have.
You do NOT answer the question. You do NOT list requirements. You do NOT research.
If you find yourself writing what the user should do, you have left your job.

WHAT YOU ARE GIVEN
  The user's question.
  The document they uploaded, if any.
  Facts already established about this company, with how each was established.
  The vocabulary of facts this product knows how to ask about.

  Any of the last three may be empty. Empty means "not established" — it never
  means "false", "none" or "not applicable".

WHAT TO DO
  1. Name the facts that DETERMINE the answer to this question. Not facts that
     would be nice to have — facts the answer is a function of.
  2. For each, mark it known or unknown. A fact is known only if it appears in
     the established facts, is stated in the question, or is legible in the
     uploaded document. A fact you can infer confidently is NOT known.
  3. For each unknown, decide whether it is BLOCKING. See the threshold below.
  4. If nothing is blocking, return outcome "proceed" and list what you resolved
     and what remains unknown but non-blocking.
  5. If something is blocking, return outcome "ask" with EXACTLY ONE question —
     the one that unlocks the most.

THE ONE QUESTION
  You may ask one. Not two, not "one, and also". If two facts are blocking, ask
  for the artifact that resolves both, or ask the one that determines the other.

  Pair it with what it unlocks. "Upload the SDS and I can give you the exact
  packing group, UN number, and whether limited quantity applies" is a trade
  someone can evaluate. "What is the packing group?" is an obstacle.

  Prefer an ARTIFACT over an interrogation. A document the user already has beats
  a question they have to research. If an artifact would resolve it, name the
  artifact.

  State what you would assume if they do not answer. If that assumption is
  reasonable, the fact was not blocking — return "proceed" instead.

WHAT IS NOT BLOCKING
  A fact that changes the wording but not the substance.
  A fact you would state conditionally in an answer (see the threshold below).
  A fact already established, even if established by inference, as long as it is
  recorded with its source.
  Anything you want in order to be more helpful rather than more correct.

  Asking is expensive. A question the user abandons is worse than an answer that
  hedges honestly.
```

### 1.2 Threshold variant — `outputType: "answer"`

```
THRESHOLD FOR THIS REQUEST — ANSWER

  Ask only if the answer BRANCHES MATERIALLY on the missing fact.

  An answer may hedge. "If packing group II, then X; if III, then Y" is a complete
  and honest answer, and you should prefer it to a question whenever the branches
  are few and each is genuinely usable.

  Blocking means: the branches are so different that stating them all would be
  useless or misleading, OR the fact determines five or more downstream facts, OR
  one branch says "this does not apply to you at all" and another says "this is a
  critical obligation".

  When you proceed with an unknown, you MUST list it in non_blocking_unknowns and
  the answer will state its conditionality. An unknown that is neither asked about
  nor declared is the failure this gate exists to prevent.
```

### 1.3 Threshold variant — `outputType: "checklist"`

```
THRESHOLD FOR THIS REQUEST — CHECKLIST

  Ask if the CONTENT OF ANY STEP would change.

  This is stricter than for an answer, and the reason is not stylistic. A checklist
  is a list of things a person will actually do, with hours and dollars attached.
  It is the expensive place to be wrong.

  A checklist MAY NOT HEDGE. There is no field in the checklist schema for a
  conditional step, and that absence is deliberate. You cannot write "if PG II,
  order these labels; if PG III, order those". If you cannot say which, the only
  honest move available to you is to ask.

  A checklist request may ask a question before producing anything. That is correct
  behaviour, not friction.

  Blocking means: any step's action, cost, deadline, form number, or applicability
  would differ depending on the missing fact.
```

### 1.4 The output instruction (shared, last)

```
Return ONE JSON object and nothing else. It has exactly one of two shapes,
chosen by "outcome". Never both. Never an answer with a question attached —
that is the failure mode this gate was built to remove.
```

---

## 2. The output union, as it would be typed

`lib/determinationGate.ts`:

```ts
/** How a fact came to be known. Mirrors company_switches.source (migration 008). */
export type FactSource =
  | 'user_set'          // the user told us, in this or an earlier session
  | 'ai_from_documents' // read out of an uploaded document
  | 'ai_from_profile'   // derived from the company profile
  | 'computed'          // derived from other switches
  | 'stated_in_question'// said in this question and nowhere else — NOT persisted

export interface KnownFact {
  /** switches.id when the fact is in the vocabulary; null for a scoped product fact. */
  switch_id: string | null
  fact: string
  value: string
  source: FactSource
}

export interface UnknownFact {
  switch_id: string | null
  fact: string
  /** Why it does not block: what the answer will say conditionally instead. */
  stated_conditionally_as: string
}

export interface GateAsk {
  /** One sentence. The single blocking question. */
  question: string
  /** The artifact that would resolve it, e.g. "the SDS for this product". Null if none. */
  artifact: string | null
  /** What answering unlocks. MUST be non-empty — see §7. */
  unlocks: string[]
  /** switches.id if the fact is in the vocabulary. Null until 6.2 seeds it, and null
   *  forever for scoped product facts like packing group. */
  switch_id: string | null
  /** Why this fact blocks rather than hedges. One sentence. */
  why_blocking: string
  /** What the product WOULD have assumed. If this reads as reasonable, it was not
   *  blocking. Exists to make a weak block visible to a reviewer. */
  assumed_if_unanswered: string
  /** What we already have, so the user is not asked for it and can see we know it. */
  known: KnownFact[]
}

export interface GateResolved {
  known: KnownFact[]
  non_blocking_unknowns: UnknownFact[]
}

export type GateResult =
  | { outcome: 'proceed'; resolved: GateResolved }
  | { outcome: 'ask'; ask: GateAsk }
```

And the wire shape each route returns:

```ts
/** 200. The gate passed; `data` is whatever that route already returned, unchanged. */
type AnswerResponse = { outcome: 'answer'; data: unknown; gate: GateResolved }

/** 200, NOT an error. An ask is a successful outcome. */
type AskResponse = { outcome: 'ask'; ask: GateAsk }
```

**Three things about this type that are the point of it.**

**`outcome` is a discriminated union, not a field on the answer.** If `ask` were a key
alongside `must_do`, a model that populates both produces a checklist with a question above
it — the 2.5L failure with a banner on top. `outcome` makes the two mutually exclusive at the
type level, and TypeScript will not let a caller read `data` without narrowing.
`app/audits/page.tsx`'s existing `isFullAudit(result)` guard is the same pattern, already
working in this codebase.

**An ask is `200`, not `4xx`.** It is a successful outcome of a well-formed request. A `400`
would put it through every caller's error path and render it as a red banner, which is the
wrong thing to show somebody who has been asked a reasonable question.

**`unlocks` is `string[]` and `ask` is a single object.** The cap of one question is enforced
by the **shape**, not by the prompt. A model cannot return two questions because there is
nowhere to put the second.

---

## 3. The two schema changes

### 3.1 `conditional_on` is ADDED to the answer path

`RESEARCH_PROMPT` returns prose today, so the addition is to the structured answer the
research path will return once it is structured, and to any answer-mode output:

```jsonc
{
  "conditional_on": [
    {
      "fact": "packing group",
      "branches": [
        { "value": "II",  "then": "UN specification packaging, hazard label on the outer package" },
        { "value": "III", "then": "limited quantity provisions may apply; see 49 CFR 173.150" }
      ]
    }
  ]
}
```

**Why it must exist.** §1.2 tells the model that an answer may hedge and should prefer hedging
to asking when the branches are few and usable. **A prompt that permits hedging with no field
to hedge in produces a hedge buried in prose**, where nothing can count it, no critic can
check it, and no golden file can assert on it. `conditional_on` makes the hedge a first-class,
inspectable thing — which is also what lets Stage 5 answer its own question 7, *"does any
statement assume a fact the user did not provide?"*, against a list instead of by re-derivation.

### 3.2 `conditional_on` is DELIBERATELY ABSENT from the checklist path

`CHECKLIST_PROMPT` gains **no** conditional field. Not an empty one, not an optional one.

**This is the load-bearing half of §4.3's "stricter for checklists".** Tell a model to be
stricter and it will be, until it is under pressure from a question it cannot fully answer —
and then "stricter" is a word in a paragraph that can be reinterpreted. **Remove the hedge
from the schema and the only remaining honest move is to ask.** Hedging in a checklist becomes
unrepresentable rather than discouraged.

It is the same structural trick as the `ask` path itself, applied one level down: the fix for
"a model asked to fill a checklist fills the checklist" is not a better instruction, it is a
schema in which the wrong answer cannot be written.

### 3.3 What this means for the checklist's existing fields

`must_do[].description`, `cost_note` and the rest stay exactly as they are. A step is
unconditional or it is not in the list.

### 3.4 `follow_up_questions` and `clarifying_questions` are REMOVED

Three question slots exist today, and none of them is a gate:

| Where | Field | When it fires |
|---|---|---|
| `CHECKLIST_PROMPT` | `follow_up_questions[]` | **after** the checklist |
| `SUBSTEPS_PROMPT` | `is_determination` + `clarifying_questions[]` | **after** the step |
| `auditClassifyPrompt` | `type: 'needs_clarification'` + `clarifying_question` | **instead of** the answer ✅ |

**Only the third is gate-shaped**, and it is the one built for a different reason.
`SUBSTEPS_PROMPT` is the sharpest case: it has a per-step `is_determination` flag whose
questions are asked **after the step has been written**, which is the gate inverted.

All three of the first two go. Leaving them beside a new `ask` path gives the model two places
to put a question with different meanings, and it will use both. `DECISIONS.md` §34 records
why this is a correction to §4 rather than a tidy-up.

**`auditClassifyPrompt`'s `needs_clarification` stays until the gate is wired into
`/api/audits`, then collapses into it.** Removing it first would leave that path with no gate
at all, which is worse than having two.

---

## 4. `gate()`, and the three lines each route becomes

### 4.1 The signature

```ts
// lib/determinationGate.ts — the ONLY place this module's AI call lives.

export interface GateInput {
  question: string
  /** Parsed blocks from lib/documentContent.ts. Empty when no file was uploaded. */
  documentBlocks: AIContent
  /** From requireCompany(). Needed to read company_switches. */
  companyId: string
  /** The caller declares this. The model never decides how strict to be about itself. */
  outputType: 'answer' | 'checklist'
  /** The caller's own client, so RLS applies. Never hoisted, never cached. */
  db: SupabaseClient<Database>
}

export async function gate(input: GateInput): Promise<GateResult>
```

**`outputType` is a parameter, not an inference.** A model choosing its own strictness is the
same class of thing as a model setting its own `verified` flag.

**`db` is the caller's token-scoped client**, per `CLAUDE.md` §3.6 — the gate reads
`company_switches`, which is tenant data.

**Every AI call stays inside this module.** `/api/chat` currently hand-rolls
`JSON.parse(responseText.replace(/```json\n?/g, ''))` at line 76; if the gate's parsing leaks
into a route the same way, the §9 swap touches both routes instead of one file.

### 4.2 `/api/chat` — what it becomes

Today, lines 68–78:

```ts
const responseText = await askAI(systemPrompt, messageContent, { maxTokens: 6000 });
if (mode === 'research') return NextResponse.json({ research: responseText });
const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
return NextResponse.json({ data: JSON.parse(cleaned) });
```

After — three lines inserted before the existing call, and the existing call unchanged:

```ts
const g = await gate({ question: userQuestion, documentBlocks: parsed.blocks,
                       companyId: authed.auth.companyId,
                       outputType: mode === 'checklist' ? 'checklist' : 'answer',
                       db: authed.auth.db })
if (g.outcome === 'ask') return NextResponse.json({ outcome: 'ask', ask: g.ask })
// …existing askAI call, unchanged…
return NextResponse.json({ outcome: 'answer', data: parsed, gate: g.resolved })
```

**Plus the prerequisite, which is not three lines.** `requireCompany()` at the top, in the
`app/api/documents/route.ts` pattern, and `askAIJson` replacing `askAI` + hand-rolled parse.

### 4.3 `/api/audits` — what it becomes

The gate goes **before** `auditClassifyPrompt` at line 215, not after. Classification is
already an AI call that can enumerate; gating after it means paying for the enumeration and
then discarding it.

```ts
const g = await gate({ question: userQuestion, documentBlocks: classifyContent,
                       companyId: authed.auth.companyId, outputType: 'checklist',
                       db: authed.auth.db })
if (g.outcome === 'ask') return NextResponse.json({ outcome: 'ask', ask: g.ask })
// …existing askAIJson classify call, unchanged…
```

`outputType` is always `'checklist'` here. An audit is a list of things somebody will do.

---

## 5. What the ask renders as

### 5.1 The shape on screen

Not a red error. Not a modal. A card in the answer position, where the answer would have been:

```
┌──────────────────────────────────────────────────────────────┐
│  One thing first                                              │
│                                                               │
│  What's the packing group for this product?                   │
│                                                               │
│  The quickest way is to upload the SDS — section 14 has it.   │
│                                                               │
│  That gets you:                                               │
│    · the UN number                                            │
│    · the hazard class                                         │
│    · whether limited quantity applies                         │
│    · the packaging specification                              │
│    · which label goes on the outer package                    │
│                                                               │
│  [ Upload the SDS ]   [ or type the answer          ] [ → ]   │
│                                                               │
│  What we already have: Oregon · chemical manufacturing ·      │
│  ships by common carrier                                      │
└──────────────────────────────────────────────────────────────┘
```

**Field to element:** `question` is the heading line · `artifact` becomes the upload button's
label and the hint sentence · `unlocks[]` is the bulleted list, and it is the reason the
question reads as a trade rather than an obstacle · `known[]` is the footer, which quietly
demonstrates the product is not asking things it already knows.

**`assumed_if_unanswered` and `why_blocking` are not rendered.** They are for golden files and
for a reviewer reading logs. Showing the user what we would have guessed invites them to
accept the guess, which defeats the gate.

### 5.2 Answering in place — the part that matters

**A question with nowhere to put the answer is worse than no question.** The card carries two
inputs and both must round-trip the ask's context, or the second request arrives as a bare
new question and the gate blocks again on the same fact — an infinite loop the user
experiences as the product being stupid.

The client keeps the `ask` object and re-submits with it:

```ts
POST /api/chat
{
  question: "<the ORIGINAL question, verbatim>",
  answering: {
    switch_id: "dot_packing_group" | null,
    fact: "packing group",
    value: "II"                      // typed answer
  }
  // or the same, as multipart with a file, when they upload the artifact instead
}
```

**Three rules for the round trip:**

1. **The original question is re-sent verbatim.** The gate re-runs against question + new
   fact. It does not resume a half-built answer, because there is no half-built answer — the
   gate stopped before Stage 2.
2. **`answering` enters the gate as a `KnownFact` with `source: 'user_set'`**, and the gate
   must treat it as known. If the same fact blocks twice in a row, that is a bug and the
   second ask must be suppressed in favour of proceeding with the stated assumption — an
   infinite ask is the one failure worse than a wrong answer.
3. **If `switch_id` is non-null, the answer is persisted** to `company_switches` with
   `source = 'user_set'` and `user_locked = true`, so it is never asked again. **If it is
   null — the scoped product fact case — it is used for this request and not stored.** A
   packing group belongs to a shipment, not to a company, and writing it to
   `company_switches` would make it a permanent property of the business. That distinction is
   `WORKSPACE.md` §5, scoped answers versus soft switches, and §9.5 records that it is still
   an open question whether a repeated scoped answer should ever become a default. **Until
   that is decided, it is not stored.**

Uploading the artifact takes the existing multipart path. The file goes through
`lib/documentContent.ts`, the blocks are given to the gate, and the fact is now legible in
the document rather than asserted by the user — which is a better source and is recorded as
`ai_from_documents`.

---

## 6. What the gate reads

| Source | Purpose | State today |
|---|---|---|
| the question | scoped facts stated in it | — |
| the uploaded document | facts legible in it | — |
| **`entities` (primary site)** | **state, county, city — the jurisdiction** | **10 rows, one per company** |
| `company_switches` | what is already established | **0 rows** |
| `switches` | vocabulary, `question_plain`, `depends_on_switch` | **0 rows** |
| `requirement_templates` | **NOT READ. Stage 3's job.** | 194 rows |

> **`entities` was missing from this list in v1 of this spec, and building golden case 003
> found it.** The gate read `company_switches` and `switches` only — so it could not see
> where the worksite *is*, and would have asked "where is your site?", a fact **migration 010
> guarantees every company already has** and `DECISIONS.md` §25 says comes from geocoding
> rather than from asking. That is §7's persistence failure arriving on day one, for the
> single most frequently determining fact in the product.
>
> It is not a switch and should not become one: jurisdiction is a property of a **site**
> (§20), it lives on `entities` from migration 009, and it is the one fact that is always
> established. It enters as `KnownFact` with `source: 'ai_from_profile'` — the company gave
> an address, not a county, and the county was derived.

**The library is deliberately not read.** Retrieving rows to decide what to ask is Stage 3 at
Stage 1, and it inverts the pipeline — selecting rows before knowing the facts that select
them, then reasoning about which might not apply.

**The cost of being wrong is asymmetric, which is what settles it.** Including the rows makes
the gate a second identification pass — slow, expensive on every question, and asking about
lead exposure because a lead row was retrieved rather than because the question was about
lead. **That failure is invisible**: every question it asks is defensible in isolation.
Excluding the rows risks missing a blocking fact only a library row knew about — and **that
failure is caught downstream**, by the critic pass's question 4, *"what determination does it
depend on? Was that determination made, or assumed?"* One is caught and one is not.

---

## 7. The bound on asking too much

**Four bounds, in descending order of how much work each actually does.**

1. **One question, enforced by the schema.** `ask` is an object, not an array. Costs nothing,
   does the most.
2. **`unlocks[]` must be non-empty.** A question with a thin payoff becomes hard to justify
   inside the schema itself.
3. **Persistence.** A question answered is never asked again — `company_switches` with
   `user_locked = true`. **This is the one that does not work yet**, because that table is
   empty and nothing writes to it until §5.2's rule is implemented.
4. **`assumed_if_unanswered`.** Forcing the model to write the sentence makes a weak block
   visible.

**How we would know it was happening.** Not from inside a single answer — every individual
question looks justified. It needs a rate across sessions, and **nothing records one today.**

- **Log every gate outcome**: the question, `switch_id`, `outputType`, and whether the user
  answered, uploaded, or abandoned. **The number that matters is the abandon rate after an
  ask**, not the ask rate. Three questions people answer is fine; one question people walk
  away from is not.
- **Asks per session should fall over time** (§4.4). **If it is flat, persistence is broken** —
  the gate is asking what it already knows. Same symptom as asking too much, different bug.
- **`TESTING.md` (c)'s consistency probe covers this today**: ask the same question twice. If
  the second run asks what the first one answered, the memory is not working.

**What is deliberately NOT done: a cap on asks per session in code.** That converts "we asked
too much" into "we guessed silently on question four" — the failure this gate removes, with a
counter in front of it.

---

## 8. Empty tables, and why that is the permanent case

```
switches                                   0 rows
company_switches                           0 rows
requirement_templates.produces_switch      0 of 194
requirement_templates.applies_expression   0 of 194
requirement_templates.is_determination     9 of 194
```

**Correction to the Phase 2.1 report:** I stated there that determinations name the switch
they produce. They do not — all 9 `is_determination` rows have `produces_switch = NULL`. That
link is 6.2/6.3 work and does not exist.

**The empty-vocabulary path is not a temporary fallback.** The 2.5L blocker — packing group —
is a fact about **a product in a shipment**, not about a company. It will never be in
`switches` no matter how well seeded. So the gate must always be able to reason about a
blocking fact it has no vocabulary entry for, and building that case first means building the
permanent one first.

**What is genuinely lost until 6.2, precisely:**

- **`switches.question_plain` — the wording.** Without it the model writes the question itself
  each time, so one fact gets asked three different ways across three sessions. A consistency
  defect the overnight agent would flag.
- **`switches.depends_on_switch` — the order.** Without it the gate can ask about the PSM
  threshold before establishing that any listed substance is handled. `WORKSPACE.md`'s
  v3-needed block names this as gap 5.
- **`company_switches.user_locked` — "stop asking me this."** Without it every session asks
  afresh, which is §7's bound 3 not working.

**So: build 2.2 now, then 6.2, then 2.3.** The gate is testable against the 2.5L case with
both tables empty, because that case's blocker is scoped. Everything about *not re-asking*
needs the seed, and the critic pass should be built against a gate that has real inputs.

---

## 9. Making the eventual version a swap

Once `applies_expression` names switches directly (6.3), blocking facts come from the
retrieved rows by **query** rather than by reasoning. Five things make that a swap rather
than a rewrite, and all five are cheap now:

1. **One interface, two implementations.** Routes call `gate()` and never learn which is
   behind it. `switch_id` is in the contract from day one and is `null` until 6.2.
2. **No AI call leaks into a route.** Everything inside `lib/determinationGate.ts`, the way
   `lib/ai.ts` is the only Anthropic call site.
3. **Return the reasoning inputs, not just the verdict.** `resolved.known` and
   `non_blocking_unknowns` get populated from a query later, with the same names and shapes —
   **so golden files keep asserting across the swap.** Without this, the swap invalidates
   every stored case.
4. **Make the AI implementation emit what the query will emit.** Ask the model for
   `switch_id` where it can name one, free text where it cannot. The swap becomes "the same
   field, better populated". *(And while `switches` is empty the model has no vocabulary to
   name from — a concrete reason to pull 6.2 forward.)*
5. **Build the AI path as the second half of the final sentence.** The end state is *query the
   expressions, then ask the model about what the question and document raise that the
   expressions do not cover.* The two coexist permanently, because expressions will never
   cover scoped product facts. Build the second clause now and the first is prepended later.

**What would make it a rewrite instead:** the gate inline in `/api/chat`; a boolean-plus-string
return; asking the model for prose rather than ids; or letting the `ask` shape differ between
the two routes. All four are cheaper now and expensive in Phase 6.

---

## 11. PROXIMITY CONFIRMATION — specified, NOT built

*Added 11 September 2026 with Phase 6.2. Nothing here is implemented.*

**The gate asks when a fact is MISSING. This asks when a fact is PRESENT BUT FRAGILE.**

They are different operations and must not be conflated. A blocking question stops the
pipeline and produces nothing; a proximity confirmation **does not stop anything** — the
answer is produced either way. It is a sentence shown alongside the work, not instead of it.

### 11.1 Trigger — three conditions, all required

1. A **numeric** switch has a value.
2. The **current question depends on it**.
3. The value **sits near one of that switch's thresholds** (migration 012).

**Condition 2 is the one that keeps this from becoming noise.** The same company at 47
employees asking about hazmat labelling must not be asked about headcount — the answer does
not turn on it, and asking anyway is the product talking about itself. Proximity matters only
when a nearby threshold is in play **for this question**.

### 11.2 "Near" is proportional, not fixed

**Three away from 50 is 6% and meaningful. Three away from 10 is 30%, and a twelve-person
shop hiring two is a normal week.** A fixed window is wrong at both ends of the range —
too noisy on small numbers, too quiet on large ones.

**Proposed rule: within 10% of a threshold, floored at 1 and capped at 10.**

```
near(value, t) :=  |value − t| ≤ max(1, min(10, 0.10 × t))
```

| Threshold | Window | Fires at | Why that is right |
|---|---|---|---|
| 6 | ±1 | 5, 6, 7 | a 6-person shop is one hire from four Oregon accommodation rules |
| 10 | ±1 | 9–11 | tight, because small numbers move by ones |
| 15 | ±1.5 | 14–16 | the ADA/Title VII/PWFA line |
| 25 | ±2.5 | 23–27 | OFLA |
| 50 | ±5 | 45–55 | **FMLA and the ACA — 47 fires, which is the case that motivated this** |
| 100 | ±10 | 90–110 | WARN, EEO-1 |
| 1,000 kg | ±10 (capped) | 990–1,010 | LQG. The cap matters: 10% of 1,000 is 100, and 900 kg is not near 1,000 in any useful sense — it is a different generator category with a month's headroom |

**The cap is doing more work than the floor.** Without it, `ghg_emissions_tco2e` at 25,000
would fire anywhere from 22,500 — a 2,500-tonne window, which is the *entire* Oregon
threshold. Percentage windows grow with the number and confidence does not.

**Reversal condition:** if the fire rate proves too high in practice, tighten the percentage
before touching the floor or cap. The floor exists so small thresholds work at all.

### 11.3 Behaviour — confirm, do not ask

> **"I have 47 employees on file — is that still right? FMLA applies at 50, so this answer
> depends on it."**

Two seconds to answer, and **it makes the reasoning visible**, which is the thing a checklist
never does. A checklist says *do this*; this says *here is the number I am using and here is
what turns on it*. The second is what a person can actually check.

Rendered as a single line above the answer, with the value inline and editable. **Not the
`GateAskCard`** — that component means "I have stopped". This one means "here is what I used".

### 11.4 Once per session, with one exception

Confirm on the **first dependent question**, then treat the value as fresh for the rest of
that session. Confirm again next session.

**Asking four times in ten minutes about a number the product already has reads as not
listening**, and it is §7's too-much-asking failure wearing a friendlier face — worse, in a
way, because each individual confirmation is polite and reasonable.

**The exception: if they CHANGED it, re-anchor explicitly on the next dependent question
rather than silently.** Somebody who has just said 47 is now 52 is *engaged with the number*,
and the next answer turning on it should say so — *"using 52 employees, which you just
updated"*. Silently carrying the new value is correct arithmetic and poor conversation: the
user cannot tell whether the correction landed.

### 11.5 On confirmation — the write, and why the date matters as much as the value

```
company_switches: value        = the confirmed number
                  source       = 'user_set'
                  user_locked  = true
                  determined_at = now()        ← FRESH, and this is the half that gets missed
                  expires_at   = now() + volatility window
```

**Confirming does not only correct the number, it re-dates it.** Without a fresh
`determined_at`, a value the user just confirmed still expires on the original schedule — so
a number confirmed today could go stale next week because it was first recorded a year ago.
That reads as broken, and it is the kind of broken nobody reports because it looks like
ordinary staleness.

**Then every obligation turning on that switch recomputes.** One confirmation, dozens of
obligations corrected — which is the whole argument for resolution being a deterministic
query (§3.2) rather than something re-reasoned per answer.

### 11.6 This is general, and headcount is only the first instance

| Switch | Thresholds | Volatility |
|---|---|---|
| `employee_count` | 6, 10, 15, 20, 25, 50, 100 | annual |
| `site_employee_count` | 6, 10 | annual |
| `hazwaste_nonacute_kg_per_month` | 100, 1,000 | **monthly — by regulation** |
| `hazwaste_acute_kg_per_month` | 1 | monthly |
| `oil_storage_aboveground_gallons` | 1,320, 42,000 | static |
| `ghg_emissions_tco2e` | 2,500, 25,000 | annual |

**Generator category is the sharpest case, not headcount.** It is monthly *by regulation* —
`Monthly generator-category determination` is a requirement in its own right, and `Episodic
generation` exists because a generator temporarily crosses a line. A site at 950 kg/month
crossing 1,000 becomes an LQG with a contingency plan, personnel training, a biennial report
and weekly inspections. **That is the confirmation most worth making, and it recurs twelve
times a year.**

### 11.7 What is NOT specified here

- **The component.** M1's.
- **Whether a confirmation counts against §7's ask budget.** It should not — it is not an
  ask — but the logging in §7 must distinguish the two or the rate becomes meaningless.
- **`tier2_epcra_threshold`, `or_cr2k_threshold` and `psm_rmp_threshold` are boolean and
  cannot use this**, because their thresholds are **per chemical** rather than per site. A
  single site-level quantity cannot express "10,000 lb of any one hazardous chemical", and
  one switch per chemical is unbounded. That is the open modelling question §23.1's reversal
  condition anticipates, and it is 6.3's to answer.

---

## 10. Deliberately not specified here

- **The reply-box component itself.** §5 specifies the contract and the round trip; the
  markup is M1 work and belongs to the Workspace.
- **Whether a repeated scoped answer becomes a durable default.** `WORKSPACE.md` §9.5, open.
  Until it is decided, scoped answers are not stored (§5.2 rule 3).
- **Logging schema for gate outcomes.** §7 says what must be measured. Where it lands is Phase
  9 observability, and a `jobs`-style table is probably wrong for it.
- **`RESEARCH_PROMPT` becoming structured.** It returns prose today; `conditional_on` applies
  to it only once it does not.

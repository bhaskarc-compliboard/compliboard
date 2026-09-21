# The Research Answer — M1.9

**Version:** 2 · **Updated:** 21 September 2026
**Supersedes:** version 1 (21 Sep). **§7a carries four corrections from the owner's reading**, one
of them a defect this spec did not see: **the answer never receives the frame, and hypothetical
facts reach it mislabelled as established** (`DECISIONS.md` §103). Adds a **scenario block** and a
**frame-driven jurisdiction line**; **only facts that bear** on the question may be used; **never
invent a source**, with a benchmark criterion to measure it; and **web search defaults ON** for
research rather than the gate opting in. Where §3 and §4 conflict with §7a, **§7a wins**.
**Status: SPECIFIED, NOT BUILT.** Decisions: `DECISIONS.md` §102 (the template made the model
worse than the bare model), §101 (`needsWebSearch` does not exist), §77 (the research path).

⚡ **`CLAUDE.md` §3.1 — prompt edits, what data feeds a prompt, and web_search on/off. All three.**
Specified before code for that reason, like the gate and the critic were.

---

## 1. What is wrong, in one paragraph

`RESEARCH_PROMPT` names six sections. A fixed section is a slot, and the model fills every slot
it is given — so *"what happens if you ignore it"* produces penalties whether or not any are
known, and *"useful resources"* produces links, including, in the answer that prompted this, a
section on **where to buy compliance equipment**. The three unassisted models, asked the same
question with no context at all, answered it and stopped. **The template is the difference, and
it made the answer worse.**

> **A template narrows the OUTPUT the way a filter narrows the INPUT.** §77 item 2 said *nothing
> narrows the model* and meant what the model is shown. This is the same damage on the way out,
> and it went unrecognised because it looks like formatting.

---

## 2. THE REWRITTEN PROMPT, IN FULL

Replaces `prompts/checklist.ts:82–99` — the whole of `RESEARCH_PROMPT`.

```
You are CompliBoard, answering a compliance question for a small business in the United States.

Answer the question you were asked. Nothing else.

*** THERE IS NO TEMPLATE AND NO REQUIRED SECTIONS. ***
Give the answer the shape it needs. A question with one answer gets a paragraph. A question
that turns on a distinction gets that distinction first. If a heading helps the reader, use
one; if it does not, do not invent one to fill.

You will be shown what is already established about this business. Those are PREMISES. Reason
from them — start where they put you, and say what follows from them for this business
specifically. Do not restate them back as a summary, and do not hedge across possibilities
they have already settled.

*** SAY WHAT WOULD MAKE THIS NOT APPLY. ***
Exemptions, thresholds, certifications and ways out are part of the answer, not a caveat on
it. If there is a route by which this business needs to do nothing, that route is the most
useful sentence in the answer and it goes near the top. An answer that lists obligations and
omits the exemption has told the reader the expensive half.

*** EVERY SPECIFIC CARRIES ITS SOURCE, OR IT DOES NOT APPEAR. ***
A date, a fee, a threshold, a form number, a deadline or a penalty must be followed by where
it comes from — the rule, the permit, the agency page. If you do not have a source for a
number, do not give the number. Say what determines it and where to look it up.
A figure with no source is worse than no figure: it is actionable and wrong.

*** WHAT YOU DO NOT KNOW. ***
If the answer turns on something you were not told, say so plainly and say what difference it
makes. Do not assume the common case and do not answer for every case at once. One or two
genuine questions at the end are worth more than a paragraph covering both branches.
Do not ask about anything already established above.

How to write:
- For a business owner with no legal background. Plain English, no legalese, no hedging
  language that avoids committing to an answer you do have.
- Be specific where you have grounds to be and explicitly uncertain where you do not.
- Lead with the answer. The reasoning follows it; it does not build up to it.
- Length follows the question. Do not pad a short answer to look thorough.

Only answer compliance, regulatory, HR policy, or benefits questions.
```

**What was deliberately NOT carried over from the old prompt:**

| Old line | Why it goes |
|---|---|
| The six section headings | §102. The whole finding |
| *"Structure your response clearly with these sections"* | there is no structure to impose |
| *"Be direct and specific — no vague generalities"* | kept in substance, but paired with *"and explicitly uncertain where you do not"* — the old half alone is an instruction to be confident, which is what produced `$59,973` |

---

## 3. THE FACTS BLOCK — premises, not a list to be careful around

### What it says today

`lib/gateContext.ts`, `establishedFactsBlock`:

```
WHAT IS ALREADY ESTABLISHED ABOUT THIS COMPANY:
  worksite state = Oregon   [established by: ai_from_profile]

Treat these as settled. Do not ask the user to confirm them, do not branch on them, and
do not answer for a jurisdiction other than the one named here.
```

> ### EVERY CLAUSE SAYS WHAT NOT TO DO WITH A FACT. NOT ONE SAYS TO REASON FROM IT.
>
> "Do not ask", "do not branch", "do not answer for another jurisdiction" — three prohibitions
> and no instruction. **That is why the background went unused in an answer that had it**, and
> why the bare models, told nothing, produced better answers than the one told everything.
>
> *"Do not branch on them"* is the worst of the three, because a reader can take it as **do not
> reason from them.** What it meant was *do not hedge across a possibility these have settled.*

### What it says instead

```
WHAT WE ALREADY KNOW ABOUT THIS BUSINESS — these are premises. Reason from them.

  This business is a chemical manufacturer.                      [they told us]
  Its worksite is in Hillsboro, Washington County, Oregon.       [from their profile]
  It stores solvent drums outdoors, uncovered.                   [they told us, in this conversation]

Start from these. Work out what they mean for this question and say it — "you are a chemical
manufacturer, so you are in a covered sector" is the kind of sentence these exist to produce.

They are settled. Do not ask the user to confirm them. Do not answer for a state other than
the one named here, and do not write out the alternatives these rule out.

If the answer still turns on something not listed here, say so — that is a real gap, not a
reason to hedge.
```

**Three changes, each doing one thing:**

1. **Facts are written as SENTENCES, not `key = value`.** `worksite state = Oregon` is a field;
   *"Its worksite is in Hillsboro, Washington County, Oregon"* is a premise. The model is being
   asked to reason, and `=` is not how a premise is stated.
2. **An instruction to use them, with a worked example of the sentence they should produce.**
   The example is the ChatGPT comparison's lesson made concrete: CompliBoard knew what the
   facility makes and never said so.
3. **The prohibitions survive but stop being the whole message**, and *"do not branch on them"*
   is rewritten as *"do not write out the alternatives these rule out"*, which is what it meant.

**Provenance is rendered in English** — `[they told us]`, `[from their profile]`, `[from a
document you uploaded]` — because `[established by: ai_from_profile]` is an enum leaking into a
prompt. The mapping is one function beside the renderer, and `CLAUDE.md` §6 requires a
document-derived value and a person's answer not to look alike.

**Unchanged:** this block is built by **one function used by both the gate and the generating
call** (§43), and the golden runner imports it rather than rebuilding it.

---

## 4. `needsWebSearch` — built for real this time

**§101: the field does not exist. `GateResult` has `outcome`, `resolved`/`ask`, `frame`,
`followUp`, and nothing else.** It was marked shipped for six days and survived because nothing
read it.

### The gate decides

One more field on the gate's existing JSON output — **not a second call**, the same fold that
put classification into the gate (§85):

```ts
export interface GateResult {
  …
  /** Does answering this well require something more current than training data?
   *  DECIDED BY THE GATE because the gate is already reading the question (§77 item 6). */
  needsWebSearch: boolean
  /** One sentence. For the record and for a person reading why the call was made. */
  webSearchBecause: string | null
}
```

Added to the gate prompt:

```
"needs_web_search": true | false,
"web_search_because": "one sentence, or null"

Set needs_web_search TRUE when answering well depends on something that changes and may have
changed recently: a permit that gets reissued, a fee, a filing deadline, a threshold, a form
version, an agency programme. Set it FALSE for a question about a rule that is stable, or one
answerable entirely from the documents and facts you were shown.
When in doubt, TRUE — a search that was not needed costs seconds; an answer built on a
superseded permit costs the customer.
```

> **The stormwater question is the worked example.** The 1200-Z was reissued effective **1 July
> 2026** with an **SWPCP update due 30 November 2026**, and the stored answer contains neither —
> `grep -i "2026|reissue|November 30"` finds only generic mentions of the plan. **A permit that
> gets reissued is exactly the class this flag exists for.**

### The research call reads it

```ts
const responseText = await askAI(systemPrompt, messageContent, {
  maxTokens: 6000,
  task: 'prose',
  enableWebSearch: g.needsWebSearch,   // <- the reader §101 says must exist
})
```

**`askAI` already supports it** — `lib/ai.ts:137` attaches `web_search_20250305` when the option
is set. Three call sites already pass it; the research call passes nothing today, which is
`TODO.md` M1.0.

> ### THE ACCEPTANCE CONDITION IS A READER, NOT A FIELD.
> §101's finding is that an unread return value meets no caller, no type error and no test.
> **So this is not done when the gate returns it. It is done when the research call reads it and
> a run shows a search happening** — recorded in §6 below as one of the two things that must be
> observed.

---

## 5. The citation instruction

**In the prompt above, not a post-processing step**, because a citation attached afterwards is a
citation nobody checked against the sentence it supports.

> **EVERY SPECIFIC CARRIES ITS SOURCE, OR IT DOES NOT APPEAR.**

**Three properties, each deliberate:**

- **It is a bar on the SPECIFIC, not a request for a bibliography.** The old *"USEFUL RESOURCES"*
  section produced two DEQ landing pages and seven unattached dollar figures. A link at the
  bottom is not a source for a number in the middle.
- **The fallback is stated, so the rule is followable.** *"Say what determines it and where to
  look it up."* A rule with no compliant way to say "I don't know the fee" is a rule that gets
  broken silently.
- **It names the reason:** *a figure with no source is worse than no figure: it is actionable and
  wrong.* `CLAUDE.md` §6 — specific dates, fees and thresholds that have not been primary-source
  checked are exactly the class that must carry verification.

**Not doing per-assertion verification badges.** §77 item 5 settles that: one page-level
disclaimer, not marking every sentence. The prompt-level bar and the page disclaimer are the two
halves, and neither is a badge.

---

## 6. Golden cases — which change, and how they are re-run

### What breaks, and what does not

**`scripts/run-golden.js` asserts CONTENT, never STRUCTURE.** Assertions are `must_appear` facts
with an id; there is no checker anywhere that looks at a heading. **So removing the six sections
breaks no assertion mechanically.**

| Case | Effect |
|---|---|
| `001-2.5l-bottles-labelling` | **gate case** — `gate` block only, no answer assertions. **Unaffected** |
| `003-oregon-minimum-wage-proceed` | **gate case.** **Unaffected** |
| `002-dot-shipping-isopropyl-drums` | **answer case.** Its `must_appear` facts — UN1219, Hazard Class 3, Packing Group II, UN-spec packaging — are things a correct answer states in any shape. **Assertions should still pass; the recorded baseline WILL move** |

**The prompt hash is the tripwire that fires.** The runner records a sha256 of the reassembled
prompt so stored results become suspect when it changes. **This change is exactly what that
mechanism is for**, and the correct response is to re-record deliberately, not to suppress it.

### How they are re-run

```
npm run golden                 # every case, against staging — expect 002's hash to differ
npm run golden -- 002          # read the new answer against the old, by eye
npm run golden -- --record     # ONLY after a person has read the diff
```

**`--record` is not run first.** A golden file's only job is telling you the output moved; a
runner that re-records before anybody looks has deleted the thing it exists to show
(`TESTING.md` (b)).

### The two things that must be OBSERVED, not inferred

1. **A web search actually happens** on a question the gate flags — §101's whole lesson is that a
   field with no demonstrated reader is a claim nothing can check.
2. **The free-flowing answer beats the templated one on the same question** — the benchmark, §7.

---

## 7. THE BENCHMARK — beat the bare model, or add nothing

> ### CompliBoard must beat the bare model with no context, on the same question.
> **If it does not, the product adds nothing on research.** `DECISIONS.md` §102.

**The comparison, made repeatable rather than done once:** the same question through the bare
model and through CompliBoard, side by side, with the unassisted answers from other assistants
alongside.

**First case:** `tests/golden/004-stormwater-bare-vs-compliboard.json`, the stormwater question,
holding all four answers.

**It is `awaiting-inputs`, and that is not a placeholder to be filled in later by guessing.**
Three of the four answers are the owner's and are **not reconstructible** — writing plausible
ones would produce a benchmark that measures nothing, which is §65's whole subject. The case
carries CompliBoard's answer, read out of the database, and three empty slots.

**What the case scores, and it is a person scoring it:**

| | |
|---|---|
| **Did it open from what it knew?** | CompliBoard knew the facility is a chemical manufacturer. The bare model had to ask |
| **Did it ask only what it lacked?** | four questions were asked of the bare model; one of them CompliBoard already had |
| **Did it name the way out?** | the No Exposure Certification — absent from CompliBoard's answer, and it decides whether any of it applies |
| **Is it current?** | the 1200-Z reissue, 1 July 2026, and the 30 November 2026 SWPCP deadline |
| **Is every specific sourced?** | seven figures, two links, none attached |
| **Do the specifics change between runs?** | **not yet measured.** Same question twice; the mechanism is confirmed, the variance is not |

**The last row is the one nobody has done**, and it is the cheapest of the six.

---

## 7a. CORRECTIONS FROM THE OWNER'S READING OF DRAFT 1 — 21 September 2026

**Four changes. The first is a defect this spec did not see; the other three are the spec being
wrong in ways that would have shipped.**

### The bug — §103. The answer never sees the frame, and hypotheticals reach it mislabelled

**§3 above said the facts block is where the company's facts arrive, and said nothing about the
frame.** `g.frame` reaches the topic title, the turn signature and the HTTP response and **never
`messageContent`** — so the answer is told what is established and never told what the question is
about.

**And draft 1 asserted hypotheticals "stop at the gate". Measured, they do not:** they arrive in
`resolved.known` and render under *WHAT IS ALREADY ESTABLISHED ABOUT THIS COMPANY*, followed by
*Treat these as settled*. `DECISIONS.md` §103 has the run.

**The fix is a third block, not a rule.** `RESEARCH-PROMPT-DRAFT.txt` Block C — the scenario,
carrying the frame's jurisdiction, tense and subject, with the hypothetical-sourced facts moved
out of the facts block by the renderer. Block D is the jurisdiction line, generated from the
frame, replacing §3's *"do not answer for a state other than the one named here"* — which is wrong
whenever the question is about somewhere else.

### Change 1 — the facts list must not become a new template

**§3's *"reason from them, say what follows for this business"* can be read as *address each
premise*** — and a list of facts is then a list of slots, which is §102's finding wearing
different clothes. A stormwater answer that mentions the vehicles and the confined spaces has
been templated by the facts rather than by the headings.

**Added: use only the facts that bear on this question, and say nothing about the rest** — in
both the system prompt and the facts block, because it is a rule about reading the list and a
rule about writing the answer.

### Change 2 — the sourcing rule creates an incentive to invent a source

*"Every specific carries its source, or it does not appear"* is right and it has a failure mode:
**a fabricated OAR or CFR citation is worse than an unsourced figure, because it looks checked and
stops the reader looking.**

**The rule stays. Two things are added:** an explicit *never invent the source* clause with a
compliant way to be vague (*"Oregon DEQ's industrial stormwater permit" with no number is
honest*), and **a benchmark criterion** — `are-the-cited-sources-real`, golden case 004. It is the
one criterion no amount of reading the answers can settle: somebody has to open the citations.

### Change 3 — web search DEFAULTS ON for research

**§4 above had the gate opt IN, and that is backwards.** The gate cannot know the 1200-Z was
reissued — **not knowing is the condition being detected**, so asking the model whether anything
has changed asks it something it cannot answer.

**Research runs with search ON; the gate may turn it OFF for a clearly timeless question.** The
failure directions are unequal: search off on a changed rule produced the stale answer this
benchmark found; search on unnecessarily costs seconds.

**`needsWebSearch` still has to be read** — the reader is the acceptance condition, §101, and now
§103 as well.

---

## 8. What this does NOT change

- **The gate.** Same behaviour, one extra output field. It still stops only on a genuinely
  blocking fact.
- **Checklist mode.** `ChecklistAnswer` is a JSON contract with a schema and a critic behind it.
  **Checklists are structured on purpose** — §102 is about prose, and a checklist that invented
  its own shape would break `checklist_items`.
- **The critic.** Still not on the research path (§77 item 1), still at the checklist boundary.
- **The disclaimer.** §77 item 5, unchanged, and now carrying what the removed
  unverified-figures box used to carry (§97).

# The Critic Pass — Stage 5
**Version:** 2 · **Updated:** 12 September 2026
**Supersedes:** version 1 (12 Sep), same day. **Built.** Adds §11, why the jurisdictional list
lives in `lib/agencyScope.ts` rather than in the critic.

**Status: BUILT 12 September 2026** — live on `/api/chat` checklist mode and `/api/audits`.
Acceptance met against the frozen 2.5L artifact; negative control held on case 002.
**Implements:** `TODO.md` 2.3 · `CHEMICAL-OR-WA.md` §5.2 Stage 5
**Sits downstream of:** `DETERMINATION-GATE.md` (Stage 1)
**Decisions:** `DECISIONS.md` §4 (the failure), §34 (the correction), §39 (this stage)

Everything here is quality-affecting under `CLAUDE.md` §3.1 — prompt, schema, temperature,
model tier, and what data feeds it. Specified, reviewed, and only then written.

---

## 0. What it is, and the asymmetry it rests on

**A fresh call that sees only the output, asked to find what is wrong with it.**

> **Critique is cheap and reliable; generation is expensive and fragile.** A model reviewing a
> written artifact is in its strongest mode — it has an anchor (`CLAUDE.md` §3.3). A model
> producing an answer from a question has none.

Applied to the failure that started this project, this pass catches the combination-packaging
error, the missing packing group, the invented "own vehicles" framing, the penalty figure, and
three omissions — **five of the six things §4 found wrong.**

**Prerequisite, and it is not optional: `TODO.md` 2.5, model-tier routing.** `lib/ai.ts:43`
reads `options.model || process.env.AI_MODEL || 'claude-sonnet-4-5'` — **one model for
everything.** Running the critic on the same tier as generation gives up the asymmetry the
whole stage rests on. **2.5 is step one of this work**, not a parallel task.

---

## 1. What the critic sees, and what is withheld

### 1.1 The rule

**If the critic sees the prompt that produced the answer, it is reviewing its own reasoning
and will agree with it.** That is why §5.2 says *fresh call*. It is not a preference.

### 1.2 Passed

| Field | Why |
|---|---|
| `question` | verbatim. Without it, "does this answer the question?" is unanswerable |
| `answer` | the `data` object exactly as returned |
| `facts_relied_on` | a short extraction of what the answer used from any uploaded document — **not the document** |
| `established_facts` | `gate.resolved.known[]` — question 4 |
| `declared_unknowns` | `gate.resolved.non_blocking_unknowns[]` — question 7 |
| `agencies_in_scope` | the jurisdictional list. See §5 |

### 1.3 WITHHELD — four things, and the fourth is the subtle one

1. **`systemPrompt` / `buildSystemPrompt(mode, scanResult)`.** It carries `CHECKLIST_PROMPT`'s
   structure, its `CRITICAL RULES`, and — when `scanResult` is present — the company profile
   block telling the model to *"reference these specifics directly in your answers"*. A critic
   reading that is reading the instructions it is meant to audit against.
2. **`gate.ask.assumed_if_unanswered`.** `DETERMINATION-GATE.md` §5.1 withholds this from the
   *user* because showing the guess invites accepting it. It applies with more force here: it
   is the generating pass's own justification for proceeding.
3. **The raw `documentBlocks`.** Passing the SDS lets the critic check a claim against its
   source — the anchored mode. It also lets the critic re-derive the answer and then confirm
   it. **Pass the extraction, not the document; and if the extraction is wrong, that is a
   finding.**
4. **`mode`.** A critic told "this is a checklist" critiques it as a checklist. It is told what
   the **user** asked for, never what the pipeline decided to produce.

### 1.4 The structural guarantee

`criticise()` takes a typed input object **with no field for the generating prompt.** Today the
critic would be constructed inside the same function that holds `systemPrompt` in a local
variable, and nothing but discipline would stop a later edit passing it "for context". The
same argument that put `gate()` behind a module boundary applies: **make the wrong input
unrepresentable**, which is `DECISIONS.md` §34's transferable lesson applied a second time.

---

## 2. Where it goes

**`lib/criticPass.ts`**, shared — two routes, one behaviour, and `lib/ai.ts`,
`lib/documentContent.ts` and `lib/gateContext.ts` all exist because more than one caller needed
the same thing and each had grown its own.

**But the shape is not symmetrical with the gate.** The gate has one input shape; the critic
has several outputs to review, and two question sets.

| Path | Output | Criticised? |
|---|---|---|
| `/api/chat` **checklist** | `ChecklistAnswer` | **Yes.** The shape §5.2 was written against and the shape the 2.5L failure took |
| `/api/chat` **research** | **a prose string** | **No, until it is structured.** "Which physical object does this attach to" has no `must_do[]` to iterate. `DETERMINATION-GATE.md` §10 |
| `/api/chat` **substeps** | micro-steps of one item | **Never.** It expands an item already criticised; re-criticising pays twice for one judgement — the same argument that leaves substeps ungated |
| `/api/audits` | `line_items[]` with `status`, `note`, `fix` | **Yes, and arguably the higher-value one** |

**`/api/audits` is the stronger case for this stage than `/api/chat` is.** `STATUS.md` records
its live defect: `satisfied=2 needs_info=1` computed from **one readable document out of
eight**, seven dropped silently. A plausible readiness number on a wrong basis is exactly what
a critic asking *"what is this conclusion built on?"* catches.

**It is a different question set.** The §5.2 seven are about requirements-as-stated; the
audit's failure is about evidence-as-matched. **One module, two question sets, selected by the
caller** — the same shape as the gate's `outputType`.

**Sequencing inside `/api/audits`:** the critic runs **before** the audit row is written at
`route.ts:417`. Otherwise the first thing a customer sees is a saved readiness count the critic
then contradicts.

---

## 3. The prompt

`temperature: 0.1` · `maxTokens: 3000` · `enableWebSearch: false` · **strongest tier** (2.5).

Search is off for the same reason it is off in the gate: the critic judges an artifact against
itself and against what was established. A critic that researches is generating.

### 3.1 The body

```
You are reviewing a compliance answer for errors, before it is shown to a small
business owner who will act on it. Be adversarial. Look for what is wrong.

You did not write this answer and you have not seen the instructions that produced
it. Do not reconstruct them. Review what is in front of you.

WHAT YOU ARE GIVEN
  The question the user asked, in their words.
  The answer produced.
  The facts that were established before the answer was written, and how each
    was established.
  The facts that were NOT established and were knowingly left open.
  The agencies with jurisdiction over this company.

FOR EACH ITEM IN THE ANSWER
  1. PHYSICAL OBJECT. What does this requirement attach to — the bottle, the case,
     the pallet, the vehicle, the site, the person, the record? Is that correct?
  2. REGIME. Transport, workplace, environmental, fire, tax? Is that the right
     regime for that object?
  3. SCOPE. Does the rule actually reach this object, or does it attach to
     something one level up or down? A rule about a package is not a rule about
     what is inside it.
  4. DETERMINATION. What fact does this depend on? Check it against the
     established facts you were given. If it is not there, the answer assumed it.
  5. SPECIFICS. Flag every date, fee, threshold, penalty figure and form number.
     Every one. This is not a judgement call.

THEN, ACROSS THE WHOLE ANSWER
  6. COVERAGE. For each agency with jurisdiction: was it addressed? What
     obligation of that agency is conspicuously absent?
  7. ASSUMPTIONS. Does any statement assume a fact the user did not provide and
     that is not in the established facts?

QUOTE WHAT YOU ARE TALKING ABOUT
  Every finding must carry the exact text from the answer that it is about. If you
  cannot point at a specific sentence, you do not have a finding — you have an
  impression, and impressions are what this task produces when there is nothing
  wrong.

FINDING NOTHING IS A VALID AND EXPECTED RESULT
  Most correct answers produce zero errors and one or two unverified specifics.
  Returning empty arrays is a successful review, not a failed one. Do not
  manufacture a finding to have something to say.
```

### 3.2 The audit variant — `questionSet: 'evidence'`

Replaces items 1–5 for `/api/audits`, where the question is not *is this requirement stated
correctly* but *is this verdict supported*:

```
FOR EACH LINE ITEM
  1. BASIS. What is the verdict built on? Which documents were actually read?
  2. COVERAGE OF EVIDENCE. How many documents were available and how many were
     used? A verdict from a subset is a verdict on a subset.
  3. EXPIRY. Does any document relied on carry a date that has passed?
  4. SPECIFICITY. Does the document cited actually address this requirement, or
     merely mention the same words?
  5. SPECIFICS. Flag every date, fee, threshold and form number.
```

**Item 2 exists because of the known defect**, and it is the reason this variant is worth
building: seven of eight documents dropped with no error and no record.

---

## 4. The output schema

```ts
export type Severity = 'blocking' | 'qualifying' | 'coverage'

export interface Finding {
  severity: Severity
  /** Which of the seven questions produced it. Question 5 is counted separately — see §6. */
  question: 1|2|3|4|5|6|7
  /** VERBATIM from the answer. A finding with no quote is not a finding. */
  quote: string
  /** Which item it is about, by name. Null for a whole-answer finding (6, 7). */
  item: string | null
  /** One sentence. What is wrong. */
  finding: string
  /** One sentence. Why it is wrong — the rule, the scope, the missing fact. */
  because: string
}

export interface CriticResult {
  findings: Finding[]
  /** True when the critic reviewed every item. False when it ran out of tokens — which
   *  must never be reported as "nothing found". */
  complete: boolean
}
```

**One array, not §5.2's four.** `errors[] omissions[] unverified_specifics[] assumptions[]` is
four buckets a model feels obliged to fill; `severity` and `question` carry the same
information as fields, and an empty array is one thing to leave empty rather than four.

**`complete` exists because truncation and cleanliness are indistinguishable in an empty
array.** `CLAUDE.md` §5 in its most literal form.

---

## 5. Question 6 gets the full jurisdictional list, now

§5.2 says *"agencies identified as having jurisdiction: [list from Stage 2]"*. **Stage 2 does
not exist.** Phase 2.1 built the list anyway: `agencies` and `industry_coverage` are populated
in both environments, and the scoping query returns 31 agencies for an Oregon chemical company.

**Decision: pass the full jurisdictional list now rather than waiting for Stage 2.**

**Two reasons.** The critic's job is to notice what is *conspicuously absent* — and **a list
that is too broad produces a false positive a human can dismiss, while a missing list produces
a silent gap nobody sees.** Those are not symmetrical costs. And it makes case 001's two Phase
2.1 assertions machine-checkable today, which is worth more than precision.

**When Stage 2 exists the list narrows, and the same field is populated from a query — same
name, same shape, so the golden cases survive the swap.** That is the identical arrangement as
`gate.resolved`, and for the identical reason.

---

## 6. Severity, and what happens to a finding

### 6.1 Surface, do not fix

**The critic never regenerates. It never loops. Code decides what happens, from severity.**

| Severity | What happens |
|---|---|
| **`blocking`** | **The item is withheld from the answer and the reason is shown.** Not a regeneration |
| **`qualifying`** | Shown beside the answer. This is what `conditional_on` and `note` are for |
| **`coverage`** | Surfaced as a gap — the same sentence the coverage strip will one day show |

**The critic outputs severity. The caller decides the threshold.** If every answer produces
three `qualifying` findings, the display rule can require `blocking` without touching the
prompt — and the findings are still logged, so the rate stays measurable.

**An empty checklist with a reason is more honest than a second guess.**

### 6.2 Question 5 is counted separately

*"Flag every specific"* is pattern-matching, not adversarial judgement, and it will fire on
nearly every answer. **Folding it into a findings count makes the count meaningless.** It is
`qualifying` by construction and reported on its own line.

---

## 7. The failure mode of a critic that always finds something

**A reviewer told to "be adversarial" will produce findings whether or not any exist.** A
product that appends caveats to every answer is one nobody reads — and here it is worse than
usual, because **over-firing does not look like a bug. It looks like rigour, and it will be
defended.**

**Four bounds, and the first two do most of the work:**

1. **The prompt states that finding nothing is expected**, and names the rate: *most correct
   answers produce zero errors and one or two unverified specifics.*
2. **Every finding must quote the answer verbatim.** An invented finding is hard to write when
   it has to point at a sentence. Same structural move as `unlocks[]` on the gate's ask.
3. **Severity is the critic's; the threshold is the caller's** (§6.1).
4. **Question 5 counted separately** (§6.2).

### 7.1 How we would know it was happening

Not from any single answer — every individual finding will look reasonable. It needs a rate,
and nothing records one.

- **Log every finding: severity, question number, whether it surfaced.** The number that
  matters is **`blocking` findings as a share of answers.** Above roughly one in ten, either
  generation is very bad or the critic is inventing.
- **The clean signal: run the critic against known-correct outputs.** A critic that finds a
  blocking error in a verified-correct answer is **measurably wrong** — no regulatory knowledge
  needed, the same trick as `TESTING.md` (c)'s consistency probes. **Golden case 002 is that
  control** (§9).
- **Caveat density**, which is what a user notices first. If a typical checklist ships with
  more critique text than checklist, nobody reads either.

---

## 8. Cost, and why it runs on everything

### 8.1 Measured

| | |
|---|---|
| Gate | **6–10 s** (1,500 tokens, temp 0.1) |
| Checklist generation | **42 s** on golden case 002 (6,000 tokens) |
| Critic, estimated | **15–30 s** |

**Roughly 30–50% added wall-clock on a checklist.** A 42-second question becomes 60–80.

### 8.2 It runs on everything, with output type as the only gate

**`checklist` and `audits` always · `research` not until structured · `substeps` never.**

**The complexity threshold is rejected, and this is the reason to record:** the 2.5L failure
was **two sentences about labels.** It was fluent, confident, well-structured, and wrong about
the central fact. **Any complexity heuristic skips exactly the case the critic exists for** —
and "only on complex answers" asks the model to judge its own output, which is the same class
of thing as a model setting its own `verified` flag.

**And the anchoring threshold runs it MORE where the library is thin** — every cannabis
question (all 25 coverage rows at `row_count = 0`) and every question hitting the six empty
Oregon agencies. **That is backwards from the cost instinct and correct on the merits**: the
thinner the anchor, the closer the answer is to free enumeration, which is the known-bad mode.

**What is not done:** letting the generating call declare confidence and skipping the critic
when it is high. Confident and wrong is the failure mode.

---

## 9. The acceptance test

### 9.1 The 2.5L artifact exists, frozen, and is runnable today

`baseline-outputs/`, exported from **production on 9 September**:

```
checklists.json      id 13278765-d09a-4844-b20b-2d1393813d97   created 2026-07-21
  question: "I am sending 2.5L bottles from reno to Philadelphia. Each case will have
             6 bottles. What is minimum labeling requirement fro each bottle and also
             for the case?"
  title:    "DOT Hazmat Labeling Requirements for Shipping Chemicals in Your Own Vehicles"
checklist_items.json  15 items, 6 of them sub-steps of item 0
```

**Every error `DECISIONS.md` §4 names is present and machine-findable in it:**

| §4's finding | In the artifact | Critic question |
|---|---|---|
| **Combination-packaging error** | *"Each 2.5L bottle must display the proper shipping name, UN identification number, and hazard class/division as required by 49 CFR 172.301"* | **3** |
| **Invented premise — "own vehicles"** | in the title | **7** |
| **Invented premise — "your cleaning product"** | six sub-steps; the user never said what it was | **7** |
| **Miscitation of 49 CFR 172.315** | used for net-quantity marking | **5** |
| **Packing group absent** | the string never appears | **4** |
| **Penalty figure `$96,624 per violation`** | in `safety_alert` | **5** |
| Missing hazmat employee training · UN spec packaging · shipping papers | all three confirmed absent | **6** |

**Acceptance: the critic returns at least one `blocking` finding on question 3 quoting the
per-bottle marking sentence.** That is the single error §4 calls critical, and it is the one
that carried $650–1,800 of cost estimates on a requirement that does not exist as stated.

**Two sibling checklists in the same export** — nitric acid, same Reno→Philadelphia route —
give a second and third instance of the same question shape, for free.

### 9.2 Case 002 is the negative control, and it is not optional

`tests/golden/002-dot-shipping-isopropyl-drums.json` has a **recorded `run.response`** and its
expected facts were checked against live eCFR text.

**The critic must find nothing `blocking` in it.**

Without this, a critic that flags everything passes §9.1 perfectly. It is the identical lesson
to `DECISIONS.md` §35.2: **testing only the direction you are building for finds nothing about
the direction you are not** — and that finding came from precisely this arrangement, one case
each way.

### 9.3 Case 001's two Phase 2.1 assertions become machine-checkable

Both are currently `HUMAN` in the runner. **The critic is what could change that:**

- *"the answer must draw on no Oregon agency"* — question 6, against the jurisdictional list.
- *"the answer must state that Nevada and Pennsylvania are not covered"* — question 6 again,
  as a coverage omission.

### 9.4 One more case worth adding: the audit defect

`baseline-outputs/audits.json` should hold the `satisfied=2 needs_info=1` run computed from one
readable document of eight. That exercises the **evidence** question set (§3.2) rather than the
requirements one, and it is the live defect `STATUS.md` records.

---

## 11. `lib/agencyScope.ts` — why the jurisdictional list has its own file

**Added during the build, not in the spec by name.** §5 decided the critic gets the full
jurisdictional list; it did not say where that list comes from.

**It is not inside `criticPass.ts`, deliberately.** Building the list means reading `entities`
for the primary site, `companies` for the industry, and `agencies` for the jurisdiction match —
three tables and a five-branch filter on `jurisdiction_level`. Putting that in the critic
couples a stage of the runtime pipeline to the schema, and the next caller that needs the same
list would either import from the critic or grow a second copy. `lib/gateContext.ts` exists for
the same reason and learned it the hard way (`AUDIT-CHECKS.md` check 14).

**Its header says plainly what it is NOT: Stage 2.** It returns every agency with jurisdiction
over the company's site and industry and **makes no judgement about which are relevant to a
particular question.** That judgement is Stage 2, and Stage 2 does not exist.

**When Stage 2 exists, the list narrows and no caller changes** — same function name, same
return shape, populated from a question-scoped query instead of the whole jurisdiction. The
identical arrangement as `gate.resolved`, and for the identical reason: the golden cases keep
asserting across the swap.

**It earned its place on the first run.** Against the 2.5L artifact the critic returned a
`coverage` finding that **Oregon OSHA has jurisdiction over the established Hillsboro worksite
and is never mentioned; the answer cites only the federal standard** — `CHEMICAL-OR-WA.md`
§1.2's State Plan trap, caught because the list was there to be checked against.

---

## 10. Deliberately not specified here

- **Questions 1 and 2 cannot be checked, only inferred.** Nothing in `ChecklistItem` carries a
  physical object or a regime — §5.2's Stage 4 was to make the model *state* them, and Stage 4
  is not built. The critic can infer both from prose, but it is inferring rather than checking,
  and that should be said out loud rather than discovered later.
- **The display component.** M1 and M6.
- **The logging schema for findings.** §7.1 says what must be measured; where it lands is
  Phase 9.
- **Whether a `blocking` finding should also write a `library_candidates` row** when the
  omission is a requirement we do not hold. Plausible, and it couples two stages that are
  better kept apart until both exist.

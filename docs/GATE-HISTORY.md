# M1.2b — The Gate Gains a Conversation

**Version:** 5 · **Updated:** 15 September 2026
**Supersedes:** version 4 (15 Sep). Adds **§8.2a** — `refersToTurn` means a different thing per
kind (an elaboration points at an ANSWER, a refinement at the turn that ASSERTED THE FACT), settled
now because nothing reads it yet and two later readers would each pick the reading their use
implied (`DECISIONS.md` §87).
**Supersedes:** version 3 (15 Sep). Adds **§8 — M1.2, classification folded into the gate** as two
fields rather than a third AI call (`DECISIONS.md` §85), with **§8.4's caller contract that M1.3
onwards inherits**: every exchange is a turn, a superseded turn stays, and a new question does not
close the topic.
**Supersedes:** version 2 (15 Sep). **BUILT** — §6a records the four demonstrations. Turn-one tense
and the `answering` question are settled by contact; one item stays open.
**Supersedes:** version 1 (15 Sep). §4's measurement is **run**: the bound holds, and the latency
motivation is **withdrawn** — the gate got faster with 7.7× the context (`DECISIONS.md` §83).
**Status: SPECIFIED, NOT BUILT.** Decisions: `DECISIONS.md` §82 (the reordering, `hypothetical`,
the trimming claim, the two contradictions), §77 (the research path), §78 (hypotheticals are not
stored). Implements `WORKSPACE.md` v3 and `TODO.md` M1.2b.

⚡ **`CLAUDE.md` §3.1 — this changes what feeds a prompt.** Specified before code for that reason.

---

## 1. The problem, stated from the code

`gate()` takes `{ question, documentBlocks, companyId, outputType, db, answering }`
(`lib/determinationGate.ts:255`). **There is no conversation.** Each turn is independent, so the
gate can re-ask what was established two turns ago, and *"is this a refinement of the last
answer"* has no last answer to compare against.

**`answering` is the existing one-turn carry-back** and is the shape to generalise
(`determinationGate.ts:314`):

```ts
if (answering) {
  known.push({ switch_id, fact, value, source: 'user_set' })
}
// "The fact the user just supplied in answer to a previous ask. It enters as known with
//  source user_set, which is what stops the gate blocking twice on the same fact."
```

**One fact becomes many. That is the whole change.**

---

## 2. What the gate receives

```ts
export interface GateInput {
  question: string
  documentBlocks: AIContent
  companyId: string
  outputType: 'answer' | 'checklist'
  db: SupabaseClient
  answering?: GateAnswering | null

  /** NEW — the conversation so far, as CLAIMS. Never prose. §82's design claim. */
  priorTurns?: PriorTurn[]
}

/** One earlier turn, reduced to what it asserted. */
export interface PriorTurn {
  turn: number
  /** Facts asserted in that turn, already labelled. The gate never re-derives these. */
  facts: ConversationFact[]
  /** The frame that turn was answered under. A change of frame is what makes a later
   *  question NEW rather than a follow-up (§77 item 8). */
  frame: Frame
}

export interface ConversationFact {
  switch_id: string | null
  fact: string
  value: string
  /** SIX values now. `hypothetical` is the sixth and it is a different AXIS from the
   *  other five — see §3. */
  source: FactSource
}

export interface Frame {
  /** The jurisdiction of the QUESTION, which need not be the company's. */
  jurisdiction: { state?: string | null; county?: string | null; city?: string | null }
  /** `present` — the operation as it is. `hypothetical` — a facility, product or
   *  transaction that does not exist yet. THIS IS WHAT MARKS A FACT HYPOTHETICAL AT THE
   *  MOMENT IT IS CAPTURED. */
  tense: 'present' | 'hypothetical'
  /** What the question is about. CONTEXT WITH NO AUTHORITY — it may not exclude anything
   *  (§77 item 7). */
  subject: string | null
}
```

**`priorTurns` is optional.** A first turn has none, and the gate must behave exactly as it does
today when it is absent — that is what keeps the three golden cases asserting across the change
(the same arrangement as `gate.resolved` and `agenciesInScope`).

---

## 3. `hypothetical` — the sixth source, and how it renders

```ts
export type FactSource =
  | 'user_set'
  | 'ai_from_documents'
  | 'ai_from_profile'
  | 'computed'
  | 'stated_in_question'
  | 'hypothetical'        // NEW
```

> ### IT IS A DIFFERENT AXIS FROM THE OTHER FIVE, AND THAT IS THE POINT.
>
> The first five say **where a fact came from**. `hypothetical` says **whether it is true.**
>
> *"We have 12 employees"* and *"the Arizona facility would have 12"* are **both stated in the
> question.** They differ in **modality, not provenance** — so reusing `stated_in_question`
> collapses two dimensions, and the collapse is invisible because every hypothetical does arrive
> stated in a question. `DECISIONS.md` §82.

### How it renders in the context block

`buildGateContext` already writes `${fact} = ${value}   [${source}]`. The hypothetical is a
**labelled line, not prose the model must parse.** A conversation about an Arizona facility
reaches the gate like this:

```
ESTABLISHED FACTS ABOUT THIS COMPANY:
  has_employees = true            [user_set]
  employee_count = 47             [user_set]
  handles_solvents = false        [user_set]

FACTS STATED IN THIS CONVERSATION:
  turn 1  jurisdiction=Arizona  tense=HYPOTHETICAL  subject="a solvent blending facility"
    facility_state = Arizona      [hypothetical]
    employee_count = 12           [hypothetical]
  turn 3  jurisdiction=Arizona  tense=HYPOTHETICAL
    handles_solvents = true       [hypothetical]

THE USER'S QUESTION:
  Would we need an air permit for it?
```

**Three things that block follow from the rendering alone:**

1. **`employee_count` appears twice — 47 `[user_set]` and 12 `[hypothetical]` — and they do not
   conflict.** One is the company; one is a facility that does not exist. **Collapsing them is the
   false-green failure**, and the labels are what prevent it.
2. **`handles_solvents = false [user_set]` must not exclude anything**, because the question is
   about a facility that would handle them. §77: switches are context, never a filter.
3. **The jurisdiction of the question is Arizona**, and the company is Oregon. The answer is about
   Arizona.

### What must NOT happen

- **A `[hypothetical]` fact never reaches `company_switches`.** §78 — it is not a fact about the
  company. The answer route (`/api/switches/answer`) is the only writer and it takes no frame, so
  this is structural rather than a rule to remember.
- **A `[hypothetical]` fact never resolves an obligation.** `writeObligations` reads
  `company_switches` and nothing else, so this is also structural.
- **The gate must not re-ask a fact already stated hypothetically** — that is the *"asks twice"*
  failure §5.2 exists to prevent, and it applies within a frame.

---

## 4. Trimming — a DESIGN CLAIM, unmeasured

**The rule: carry CLAIMS, not prose**, bounded by the vocabulary rather than by turn count.

**The claim:** a 40-turn topic produces at most a few dozen fact lines, because facts collapse by
`(switch_id, frame)` — a value restated in turn 9 replaces the one from turn 4 rather than adding
to it.

> ### MEASURED 15 SEP — THE BOUND HOLDS AND THE MOTIVATION WAS WRONG. `DECISIONS.md` §83.
>
> ```
>   turn 12: 9 fact lines from 11 asserted · claims 537 chars vs prose 810 (0.66)
>   gate, turn 1  (97 chars):  9.9s -> ask
>   gate, turn 12 (748 chars): 8.7s -> proceed, 14 known      DELTA -1.3s
> ```
>
> **The gate got FASTER with 7.7× the context.** So *"unbounded context is a latency regression"*
> is **not supported**, and the rule below stands on **correctness** instead: a fact must arrive
> **labelled**, because prose forces the model to infer modality from a verb. The saving in size
> is real but modest — claims are ~34% smaller at 12 turns and *larger* at one.

**What is NOT carried, each for a stated reason:**

| Withheld | Why |
|---|---|
| the user's prose | the claim is what can be wrong; the wording is not |
| the product's prior answers | that is the critic's input (§73), and the critic is **not on the research path** at all (§77) |
| turns from other topics | a topic is the unit; cross-topic context is noise with a latency cost |
| facts superseded within the same frame | the later value replaces the earlier — see §5 |

---

## 5. Contradiction — two kinds, and they must not be collapsed

| | Example | Handling |
|---|---|---|
| **Within the conversation** | turn 1 says 12, turn 4 says 40, same frame | **A correction. The later turn wins.** §49's overwrite history records what it replaced |
| **Between the conversation and `company_switches`** | stored `employee_count = 47 [user_set]`, this turn says 40 | **v3.2's conflict. It must reach the user.** Shown, never silently resolved |

> **The collapse to guard against is "the newer value wins" applied to both.** Right for the
> first. **Wrong for the second**, where the stored value may be a person's locked answer and the
> new one an aside inside a hypothetical.
>
> **A conversation must never silently overwrite an established fact.** §78 is why the risk
> exists: hypotheticals live in the transcript the gate reads, so an *unlabelled* one looks
> exactly like a correction.

**And a contradiction ACROSS frames is neither.** `employee_count = 47 [user_set]` and
`employee_count = 12 [hypothetical]` are **not in conflict at all** — they describe different
things, and treating them as a contradiction is the same collapse from the other direction.

---

## 6. What M1.2 inherits

Classification's three categories map onto three fields of what is specified above:

| Category | Reads |
|---|---|
| **refinement** | `priorTurns[].facts` — the prior assertion, already labelled |
| **correction** | the same, plus the §5 distinction to decide which kind |
| **new question** | `priorTurns[].frame` — **a jurisdiction or tense change makes it new regardless of wording** |

**That mapping is why M1.2b precedes M1.2** (§82). Built the other way, classification re-derives
from prose what this specification already carries as structure, and the two disagree.

---

## 6a. BUILT — 15 September 2026, `DECISIONS.md` §84

**Four demonstrations from the first multi-turn conversation this product has had**, run against
staging as Test Gamma Solvents, an **Oregon** company:

```
turn 1  frame: Phoenix, Arizona · hypothetical · "a solvent blending facility"
        ask -> "Would this facility have employees, or would it be owner-operated only?"
turn 3  4 facts asserted collapse to 3 lines; employee_count 12 -> 40 (a correction)
turn 4  "Would we need a confined space program there?" -> PROCEED, not re-asked
```

**`confined_spaces_present = true [hypothetical]` alongside `false [user_set]` — same switch,
opposite values, no conflict.** That is §3's rendering doing its job, and it is the false-green
failure prevented rather than described.

**Two of §7's three open items are now settled by contact:** turn-one tense is one pass and did
not resist; `answering` stays with its handling folded into `collapseTurns`. **§4's measurement is
run** (§83) — the bound holds, the latency motivation is withdrawn.

**Still open: how a hypothetical frame spends the one blocking question.** §84 §4.

## 8. M1.2 — CLASSIFICATION, FOLDED INTO THE GATE

*Specified 15 September 2026. **Not built.** `DECISIONS.md` §85; `WORKSPACE.md` §4.1 as superseded
and §4.1a.*

### 8.1 It is not a call. It is two more fields.

`WORKSPACE.md` §4.1 said *"one cheap classification call decides."* **That is superseded.** §77
settled the research path at two AI calls, and the gate already has the question, the prior turns
and the frame — **everything classification needs.** So the gate returns it.

```ts
export type FollowUpKind = 'first' | 'elaboration' | 'refinement' | 'new_question'

export type GateResult =
  | { outcome: 'proceed'; resolved: GateResolved; frame: Frame; followUp: FollowUp }
  | { outcome: 'ask';     ask: GateAsk;          frame: Frame; followUp: FollowUp }

export interface FollowUp {
  kind: FollowUpKind
  /** ONE FIELD, MEANING DEFINED BY THE KIND. See §8.2a — the two readings are different
   *  on purpose and the model is TOLD which, not left to infer it. */
  refersToTurn: number | null
  /** One sentence, for the record and for a person reading why the pipeline did what it did.
   *  Never rendered to the user as-is. */
  because: string
}
```

**`first` is a fourth value and it is not a follow-up at all** — it is what turn 1 returns.
Without it, `kind` would have to lie on the first turn, and §77's rule that a first turn behaves
exactly as before this existed would be untestable.

### 8.2 What each kind means, and what the caller runs

| kind | Means | Caller runs |
|---|---|---|
| **`first`** | no prior turns | the full path — gate, then answer |
| **`elaboration`** | *"explain step 3"*, *"where do I buy those"* — asks for more about an answer already given, asserts no new fact | **expansion against the existing answer.** No re-answer |
| **`refinement`** | *"what if it's PG III"*, *"we use a carrier"* — a fact changed | **re-answer.** §4.1: *refinement recomputes; it does not append* — adding a correction underneath leaves the wrong answer on screen above it |
| **`new_question`** | not a follow-up to the previous answer | the full path — **and the topic stays open** (§4.1a) |

### 8.2a `refersToTurn` — ONE FIELD, FOUR MEANINGS, DEFINED BY THE KIND

| kind | `refersToTurn` points at |
|---|---|
| **`elaboration`** | the turn whose **ANSWER** is being elaborated |
| **`refinement`** | the turn that **ASSERTED THE FACT** being superseded |
| **`first`** | null |
| **`new_question`** | null |

**Different semantics, and that is correct rather than a compromise.** An elaboration is about an
**answer**; a refinement is about a **fact**. They coincide whenever the fact was asserted in the
turn that produced the answer — which is most of the time, and is why one run cannot tell them
apart.

> ### WHY THIS IS SETTLED NOW RATHER THAN WHEN THE TWO DIVERGE
>
> **Nothing reads `refersToTurn` today.** So two later readers would each pick the reading their
> own use implied — **rendering wants the answer turn; recomputation wants the fact turn** — and
> **neither would know the other had chosen differently.**
>
> **That is §71's shape before it exists**: two systems carrying one field with different
> meanings, discovered when they disagree rather than when they are written. §71 and §24 each cost
> a reconciliation. This costs a paragraph.

**The model is TOLD which, not left to infer it** — the prompt names the rule per kind and gives
the worked case: *"If turn 2 said '12 people' and turn 7 says '40', refers_to_turn is 2."*

### 8.3 *** A NEW QUESTION DOES NOT CLOSE THE TOPIC ***

**This is the correction to §4.1's implication and it is the part most likely to be
re-collapsed.**

> *"Not a follow-up to the previous answer"* and *"a new topic"* are **different things.** Someone
> asking about shipping and then about storage has asked **two questions in one topic.**

- `new_question` is a **SIGNAL**: run the full pipeline rather than an expansion. Nothing more.
- **Closing a topic is a separate act** — the user, inactivity, or whatever M1.8 specifies.
- **Coupling them means every topic is one question long, which is not a conversation.**

**Turns keep accumulating across the switch**, and that is safe because of the frame: two
questions produce two frames, `collapseTurns` keys on `(switch_id, frame)` so they collapse
separately, and both render labelled. §83 measured the cost of the extra context and it is
nothing.

### 8.4 What a caller does — the contract M1.3 onwards inherits

**This is the part that outlives M1.2**, because every later module reads turns that this
decides how to write.

```ts
// 1. Call the gate with everything so far.
const r = await gate({ question, documentBlocks, companyId, outputType, db, priorTurns: turns })

// 2. ALWAYS append a turn. EVERY EXCHANGE IS A TURN (§85.2b) — including an elaboration
//    that asserts nothing. "Turn 4" must mean the fourth exchange, which is what a person
//    means by it. A turn with no facts costs one line.
turns.push({
  turn: turns.length + 1,
  frame: r.frame,
  facts: factsFrom(r),        // may be empty. That is normal, not a skip.
})

// 3. Branch on the kind. This is the ONLY thing followUp decides.
switch (r.followUp.kind) {
  case 'elaboration':  return expand(previousAnswer, r.followUp.refersToTurn)
  case 'refinement':   return answerAgain()   // recompute, never append (§4.1)
  case 'first':
  case 'new_question': return answerAgain()   // and DO NOT close the topic (§8.3)
}
```

**Three rules the contract carries, each stated because a later reader would otherwise choose
differently:**

1. **Append before branching.** The turn exists whatever the kind — otherwise an elaboration
   vanishes from the history and turn numbers drift from the conversation.
2. **A superseded turn STAYS.** A refinement recomputes the answer; it does not delete the turn
   that carried the old fact. `collapseTurns` supersedes the *fact* within its frame and leaves
   the turn (§85.2a).
3. **The caller owns the turn list; nothing is stored.** §78 — a hypothetical is never written
   anywhere, and `topics` has no facts column. The list lives for the length of the conversation
   and dies with the transcript (`WORKSPACE.md` §6.4).

### 8.5 What this does NOT decide

- **When a topic closes.** M1.8. §8.3 only says classification does not decide it.
- **What an elaboration renders against.** It needs the previous answer, which the caller holds
  and the gate never sees — the gate reads claims, not answers (§4, and §73 for the critic's
  version of the same rule).
- **Whether `followUp` should be persisted.** It should not be, on §78's reasoning, but nothing
  yet reads it a second time so the question has not arisen.

## 7. Open, and not decided here

1. **Who assigns `tense`?** The gate returns the frame, so the gate marks a fact hypothetical as
   it captures it. But the FIRST turn's frame is decided by the same call that uses it — the gate
   reads the question, decides tense, and labels the facts in one pass. **Whether that is one call
   or a self-referential problem is a build-time question**, and it is the only part of this
   specification I would expect to change on contact.
2. **Does `answering` survive, or fold into `priorTurns`?** They are the same mechanism at
   different sizes. Folding is cleaner; keeping both is smaller. Not decided.
3. **The measurement in §4** should run before this ships, not after — it is the §74 lesson, where
   a number that changed a design was cheap to get and was nearly got late.

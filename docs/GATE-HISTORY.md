# M1.2b — The Gate Gains a Conversation

**Version:** 2 · **Updated:** 15 September 2026
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

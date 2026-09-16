# The Compliance Workspace — M1

**Version:** 5 · **Updated:** 15 September 2026
**Supersedes:** version 4 (15 Sep). **Two stale claims that research runs the six-stage pipeline are struck** — §3's opening line and §4.1's table row — leaving `DECISIONS.md` §77 authoritative: research is gate, then answer. The table row is recorded as instructive: v4 struck the sentence beneath it and left the cell above, so a correction left a contradiction inside what it corrected.
**Supersedes:** version 3 (15 Sep). §4.1's **"one cheap classification call" is SUPERSEDED** — classification folds into the determination gate, because §77 settled the research path at two AI calls and the gate already holds everything classification needs (`DECISIONS.md` §85). Adds **§4.1a: a new question does NOT close a topic.** Previously, v3: **Supersedes:** version 2 (11 Sep). **The five gaps are RESOLVED as decisions**, stated against
the schema migration 008 actually built rather than described as problems — which is what made v2
unusable. Adds **v3.6**: §6's terminal object is provisional, because D22 settles that M1 writes
neither obligations nor checklists and v2's entire topic lifecycle closes onto a checklist. A
topic closes onto a **topic summary**; checklists are **out of scope for M1**; the real decision
is `TODO.md` item 6. §5.2's three-tier confirmation scheme is **superseded** by `user_locked`
plus `source`, not translated into it. Read v3.1–v3.6 before §5, §6 or §7 — where they conflict,
v3 wins.

---

## v3 — THE FIVE GAPS, RESOLVED

*Resolved 15 September 2026. **v2's block listed these as gaps and v2 was unusable for exactly
that reason** — a list of what a document gets wrong is not a document. Each of the five below is
now a DECISION stated against the schema that exists, with the behaviour migration 008 actually
has. Where the old §5.2, §6 and §7 conflict with these, these win.*

### v3.1 An established fact can un-establish itself — `expires_at`

**The schema:** `switches.volatility` is `static | annual | monthly`, and
`company_switches.expires_at` is a timestamp. **48 of 95 switches are non-static.** `expires_at`
is currently NULL on every row, because nothing has ever set it.

**The decision.** **An expired switch reads as `unknown`, never as its last value.** A stale
`false` is a false green, which is the failure this product exists to prevent (`CLAUDE.md` §3.2).

**What the conversation does with it, which v2 had no state for:**

- An expired fact is **not** a fact the user must re-answer before anything else can proceed. It
  re-enters the ask queue at its normal position.
- The product **says what it used to be and when it lapsed**: *"You told us in March that you had
  no confined spaces. That answer is a year old and this one changes — is it still true?"*
  **Re-confirming is one tap and is recorded as a new answer**, not as an edit of the old one
  (§49's overwrite history).
- **It never silently reverts.** A requirement that moves from `does_not_apply` back to `unknown`
  because a fact expired is shown as a change, with the expiry as its reason.

**Not built.** Nothing reads `expires_at`; no code sets it. This is the only one of the five with
no implementation at all, and it is M1 work.

### v3.2 `user_locked` is an overwrite lock, not a confirmation gate

**The schema:** `company_switches.user_locked boolean`, plus `source` with four values —
`ai_from_documents`, `ai_from_profile`, `user_set`, `computed`.

**The decision. v2's §5.2 three-tier confirmation scheme is SUPERSEDED, not translated.** The two
mechanisms are different: **a lock prevents a write; a gate delays one.** The schema already
prevents the write.

- A person's answer sets `user_locked = true`. **Determination never overwrites a locked value** —
  it records what it would have concluded, in `switch_determinations`, and surfaces the
  disagreement.
- **The conversation shows the conflict rather than resolving it silently:** *"Your SDS file
  suggests you hold a listed substance above the PSM threshold. You told us otherwise in June.
  Which is right?"*
- **`source` is what the UI renders**, not confidence. A value from a document and a value from a
  person must not look the same (`CLAUDE.md` §6).

**Partially built.** `lib/switchDetermination.ts` implements the precedence ladder and is
**unreached by any route** (check 29). **And the lock has no database enforcement**: check 24
shows **zero policies, zero constraints, zero triggers** reference `user_locked`, so today it is a
library rule wearing the coat of a boundary. TODO 7.2c.

### v3.3 A site-scoped fact cannot be captured without a site

**The schema:** `company_switches` carries a composite FK on `(switch_id, scope)` and a CHECK
requiring `entity_id` when `scope = 'site'`. **70 of 95 switches are site-scoped.** The insert is
**refused** without a site — it is a hard failure, not a degradation.

**The decision. The conversation must establish WHICH SITE before it can capture a site-scoped
fact, and defaulting to the primary site is forbidden.** `DECISIONS.md` §20: a company-wide answer
to a per-site question is wrong at every site but one, confidently.

**How that reads, and it is a feature rather than friction:**

- **One site:** never ask. The company has one `entities` row and it is used silently.
- **Several sites:** the question carries the site — *"At the Portland plant, do you have confined
  spaces?"* — and the answer writes one row per site answered, not one row for the company.
- **"All of them" is an accepted answer** and writes N rows, each attributable. It is not a
  company-scoped row.
- `employee_count` and `site_employee_count` exist as two switches for this reason, and Oregon's
  sick-time rule reads both in one sentence.

**Built in the resolver** (`obligationWriter.splitFacts`). **Absent from the conversation**, which
has no concept of a current site.

### v3.4 Answering one requirement can change what else is required, mid-topic

**The schema:** `requirement_templates.is_determination boolean` — **9 live rows carry it.** Some
requirements determine switches rather than being satisfied by evidence.

**The decision. The list rewriting itself mid-conversation is CORRECT behaviour and must be
shown, not hidden.**

- When an answer changes a determination, the product **says what moved**: *"That makes you a
  Small Quantity Generator. Six requirements just became applicable and two no longer apply."*
- **It never silently re-orders the remaining questions.** §54 governs: one answer unlocks one
  level and then stops, so a grandchild question does not appear from a single click.
- A `does_not_apply` produced this way **names the fact that produced it**, like every other one —
  `Ruled out by: <switch> = <value>` (39 of 39 do this today).

**Built.** `is_determination` is read by `/api/substeps` and `app/compliance`; the recompute and
the one-level unlock are in `switchAsk.newlyUnblocked()`, **unreached by any route**.

### v3.5 Questions have a dependency order and asking in the wrong one wastes them

**The schema:** `switches.depends_on_switch` and `depends_on_value`. **40 of 95 switches have a
parent; the graph is acyclic, max depth 1, verified from both databases (check 13).**

**The decision. The ask order comes from the dependency graph, never from a preference**, and the
three states are distinct and all rendered:

| State | Meaning | Shown? |
|---|---|---|
| **Askable** | parent known, or no parent | Yes — this is the queue |
| **Blocked** | parent not yet established | **Yes, greyed**, with what blocks it |
| **Excluded** | parent came back **false** | **No — it disappears entirely** |

**A site with no hazardous chemicals is not *pending* a lead-exposure answer; that question does
not exist for them.** Collapsing blocked and excluded is the distinction §58.2 forbids.

**Built.** `lib/switchAsk.ts` — `askableSwitches`, `blockedBy`, `isExcluded`, `transitiveAffects`,
`newlyUnblocked` — **6 exports, 6 tested, 0 production callers.** The routes are TODO 7.2a and are
M1's floor.

---

## v3.6 §6's TERMINAL OBJECT IS PROVISIONAL AND THE DECISION LIVES ELSEWHERE

> ### Read this before §6. **A topic currently closes onto a TOPIC SUMMARY, and that is a
> placeholder.** What a topic *should* close onto depends on a decision that has not been made:
> **what a checklist IS.** That decision is `TODO.md` item 6 and `DECISIONS.md` §71, it is
> deliberately deferred, and §6 below is written as though checklists are still a first-class
> persistent object — **which they are not.**

**Why §6 could not simply be rewritten.** D22 settles that **M1 writes neither obligations nor
checklists.** v2's §6 is built entirely on checklists as the terminal object:

```
§6.2  "Creating a checklist closes the topic. A checklist is a decision."
§6.4  Checklists | Closed, saved, flagged when facts change      <- one of the four objects
§6.5  "What the user returns to: Open checklists, closed topics, and their company profile."
```

Under D22 none of that can happen. **So the provisional decision, stated as a decision:**

- **A topic closes onto a topic summary.** Facts captured, questions answered, what moved.
- **Checklists are OUT OF SCOPE for M1.** M1 does not create, close, flag or regenerate one.
- **§6.3's "a later fact would have changed a completed checklist" has no subject in M1** and is
  held, not deleted — it becomes correct again the moment item 6 decides what a checklist is.
- **§6.4's four objects become three** for M1: switches, topic summaries, transcripts.

**Why this is a resolution and not another gap description.** It names what happens, it is
actionable today, and it states the dependency in the text rather than leaving a reader to
discover the contradiction. **v2 was unusable because it described what was wrong and stopped.**
The difference is that someone can build M1 from this paragraph.

**And the alternative was worse:** writing §6 as though checklists still exist would encode a
contradiction with a settled decision, which outlasts a placeholder and is harder to find.

**What unblocks it:** item 6 — whether a checklist is a view over obligations, a workspace
artifact with no authority, or a second spine. Until then §6's lifecycle is correct in shape and
provisional in its terminal object.

---


## 1. What this module is

The Compliance Workspace is where a user asks a compliance question and gets an answer, and where an answer becomes an actionable checklist. It is the part of the product salespeople demo and the part customers use daily.

**Three entry paths, one engine:**
1. Ask a question → get an answer
2. Convert an answer into an execution checklist
3. Request a checklist directly, without asking a question first

~~All three run the same six-stage runtime pipeline.~~ **SUPERSEDED — `DECISIONS.md` §77.**
**Research is TWO AI calls: gate, then answer.** The six-stage pipeline in `CHEMICAL-OR-WA.md`
§5.2 is the **audit** path and remains as written there. What is still true of all three: the
difference between them is how strictly the determination gate fires (§4.3).

---

## 2. The problem being fixed

Today the workspace answers once. The user cannot reply. That is a half-conversation, and it breaks the fix we are building.

The determination gate lets CompliBoard **ask** for a missing fact — "what packing group?" A system that can ask and cannot hear the answer is worse than one that never asks. Follow-up is not a separate feature; it is the other half of the same mechanism.

The failed 2.5L bottle test is the case in point: the answer went wrong because the model guessed at packing group instead of asking, then built six sub-steps and $650–1,800 of cost estimates on the guess.

---

## 3. The conversation model

### 3.1 The governing analogy, and its limit

A working conversation: some points are taken, some are explored and discarded. Both happen, and the system must treat them differently.

**Facts get established.** "We use a common carrier." These stick. Everything downstream assumes them.

**Ideas get explored and dropped.** "What if we bought our own trucks?" These belong in the transcript and must influence nothing.

**If both are treated the same way — as context fed to the next call — discarded ideas keep steering answers.** That is the failure mode of long chat threads: something rejected on turn three quietly shapes turn thirty.

### 3.2 The rule

> **Established facts write to switches. Exploration stays in the transcript. The transcript is disposable.**

| User says | Treatment |
|---|---|
| "We use a common carrier" | Writes `owns_fleet` / shipment mode. `source = user_stated`, `user_locked = true`. Permanent. |
| "What if we bought our own trucks?" | Hypothetical. Answered from transcript. Writes nothing. |

Phrasing usually distinguishes them. When it does not, **confirm before writing** — one tap. Getting this wrong in the confident direction silently removes obligations.

**Every conversationally-derived fact records `basis`: the actual sentence the user said.** That sentence is shown on the verification surface and is what makes a wrong capture correctable.

### 3.3 Why this matters more than it looks

A chat where facts evaporate at session end is a nicer interface. A chat where facts become permanent company knowledge **is the onboarding mechanism**, arriving through the door people actually walk through.

Users abandon forms. They answer questions asked in context, when the consequence is visible.

---

## 4. Handling a follow-up

### 4.1 Three kinds, classified before anything expensive runs

> ### ⚠ SUPERSEDED IN PART — 15 September 2026. `DECISIONS.md` §85.
>
> **The three kinds stand. "One cheap classification call" does not.** Classification is **folded
> into the determination gate** and is not a separate call.
>
> **What superseded it:** `DECISIONS.md` **§77**, which settled the research path at **two AI
> calls — gate, then answer, nothing else.** §4.1 was written three days earlier, and a third call
> contradicts it.
>
> **Why folding is right rather than merely cheaper:** the gate **already has the question, the
> prior turns and the frame** — everything classification needs. §77 items 6–8 folded web search
> and frame detection in for the same reason. And the objection that more input costs the gate
> latency was **measured twice and found unsupported**: §76 (narrowing the critic bought 7.7 s and
> cost three findings) and §83 (**the gate ran 1.3 s FASTER with 7.7× the context**).
>
> **Marked rather than done silently**, because reversing a written decision by implementation is
> §75's exact failure.


| Type | Example | What runs |
|---|---|---|
| **Elaboration** | "Explain step 3." "Where do I buy UN-spec boxes?" | Expansion only, against the existing answer |
| **Refinement** | "What if it's PG III?" "We use a carrier." | Update the fact, then re-run identification → critic → expansion |
| **New question** | Unrelated topic | ~~Full six-stage pipeline~~ → **the full research path: gate, then answer** (§77). And it does **not** close the topic — §4.1a |

~~One cheap classification call decides.~~ **SUPERSEDED — the GATE decides (`DECISIONS.md` §85).**
The rest stands in spirit: re-running the whole path on every follow-up is slow and wasteful —
though for research the path is two calls rather than six stages.

> ### THE TABLE ROW ABOVE IS THE INSTRUCTIVE ONE.
> When §4.1 was superseded on 15 Sep, **the sentence beneath the table was struck and the cell
> above it was not.** A correction left a contradiction inside the thing it was correcting, and it
> survived a cross-document check the same day because the check looked for *"cheap classification
> call"* and the stale claim said *"six-stage pipeline"*. **Correcting a passage means reading the
> whole passage, not the sentence that prompted it.**

**Refinement recomputes; it does not append.** The answer was built on a fact that changed. Adding a correction underneath leaves the wrong answer on screen above it.

### 4.1a A NEW QUESTION DOES NOT CLOSE A TOPIC

*Added 15 September 2026. `DECISIONS.md` §85.*

**"Not a follow-up to the previous answer" and "a new topic" are different things.** Someone asking
about shipping and then about storage has asked **two questions in one topic**.

- **Classification returns `new_question` as a SIGNAL.** It means the full pipeline runs rather
  than an expansion — nothing more.
- **Closing a topic is a separate act:** the user, inactivity, or whatever M1.8 specifies.
- **Coupling them means every topic is one question long, which is not a conversation.**

**Accumulating across a question switch is safe under the frame mechanism.** Different frames
collapse separately and render labelled, so the gate sees both sets and knows which is which
(`GATE-HISTORY.md` §3). §83 measured the extra context and it costs nothing.

**Reversal condition:** if a real multi-question topic produces a gate that confuses two questions'
facts despite the frames, couple them after all.

### 4.2 The critic still runs

Anything regenerated goes through the critic pass. A follow-up answer can be wrong in exactly the way the first one was.

**Critical:** the critic must see what the answer is *built on*, not only the latest turn. If turn one asserted the bottle needs DOT labels and turn three asks about font size, a critic seeing only turn three will happily validate a font size inside a false premise. Autoregressive lock-in gets worse across turns, not better.

### 4.3 The determination gate is stricter for checklists

An answer can hedge: "if PG II then X, if PG III then Y."

A checklist cannot. It is a list of things a person will actually do, with hours and dollars attached. The checklist path is the expensive place to be wrong.

| Output | Gate threshold |
|---|---|
| **Answer** | Ask only if the answer branches materially |
| **Checklist** | Ask if any step's *content* would change |

**A checklist request may ask questions back before producing anything.** That is correct behaviour, not friction.

### 4.4 Research is cheaper by the second question

Not only because prior answers exist — because **the facts exist.** By the time someone asks for a checklist, the Q&A has already established packing group, carrier, employee count, generator category. The checklist reads them rather than asking again.

The intended experience: the first conversation asks a few questions; every conversation afterwards asks almost none.

---

## 5. Scoped questions vs. soft switches

### 5.1 The trucks case is a scope problem, not a switch problem

A company can own trucks *and* use carriers. Both answers are true. The temptation is a "soft switch" — ask before applying.

**That loses the durable fact.** `owns_fleet = true` stays true whether or not today's shipment uses the trucks, and it carries standing obligations: DOT number, driver qualification files, drug and alcohol testing, hours of service. Those exist on days when everything ships by carrier.

**Two facts, not one soft one:**

| Fact | Scope | Determines |
|---|---|---|
| `owns_fleet = true` | Durable | Whether FMCSA obligations exist at all |
| Mode for *this* shipment | Per-question | Which requirements apply to this shipment |

When a durable fact permits multiple answers, the determination gate asks the **scoped** question rather than re-asking the fact:

> "You operate your own fleet and also use carriers. For this shipment — own trucks, common carrier, or both?"

The answer is context for this question. It overwrites nothing.

### 5.2 Where "ask before applying" IS right

A different distinction: **confident vs. provisional**, not soft vs. hard.

| `resolved_by` | Behaviour |
|---|---|
| `user_stated` | Applies immediately |
| `evidence_linked` | Applies immediately, basis recorded |
| `ai_inferred` | **Confirm before applying**, especially when it would remove an obligation |

An inference that silently deletes requirements is the false-green failure. Surface it at the moment it matters.

---

## 6. Topic lifecycle

### 6.1 Topics close

A research topic ends with an explicit close: CompliBoard writes a summary, saves it, and discards the transcript.

**Tell the user the real reason, politely:** past conversations pollute future answers. A closed topic keeps a bad premise from propagating. Had the 2.5L conversation continued eight more turns, every turn would have compounded the wrong bottle-labeling premise.

**Closing extracts facts before discarding.** Any `user_stated` facts write to switches. The durable part survives; the noise does not.

**Auto-close on inactivity.** People do not close things. A topic idle for a week closes itself and says so — otherwise month-old open threads produce exactly the pollution being prevented.

> ### ⚠ PROVISIONAL — see v3.6. Under D22, **M1 writes no checklists**, so §6.2–§6.5 below
> describe a terminal object M1 does not create. **A topic closes onto a TOPIC SUMMARY.** What a
> checklist is remains `TODO.md` item 6. The lifecycle's shape is right; its terminal object is
> pending.

### 6.2 Creating a checklist closes the topic

A checklist is a decision. Revisiting the reasoning behind it is a new question.

### 6.3 When a later fact would have changed a completed checklist

**Flag it. Do not auto-regenerate.**

A checklist someone is halfway through executing must not change under them. But they must know it is affected.

> ⚠ *Your generator category changed to LQG. This checklist was built when you were an SQG — 4 steps may no longer be correct.* [Review] [Regenerate]

### 6.4 The four objects

| Object | Lifespan |
|---|---|
| **Switches** (company facts) | Permanent, correctable |
| **Topic summaries** | Closed, saved, read-only |
| **Checklists** | Closed, saved, flagged when facts change |
| **Transcripts** | **Disposable** — closed and discarded |

Conversation is a working mode, not an archive.

### 6.5 What the user returns to

Not a list of chats. Open checklists, closed topics, and their company profile. **The conversation is how those things get made, not a thing to browse.**

---

## 7. Showing what we know

### 7.1 Framing

Never called "switches" in the UI. That is our word for the plumbing.

> **"Here's what we understand about your business. Correct anything wrong."**

### 7.2 Why it must be visible

**A wrong fact silently deletes obligations.** If CompliBoard believes you use a carrier and you do not, the whole FMCSA branch disappears. The user sees a clean list, not a gap. That is the exact false-green failure the product exists to prevent, and the only defence is showing what was concluded.

**It is the cheapest correction point in the product.** One wrong fact affects twenty requirements. Thirty seconds of the user's time buys accuracy nowhere else available.

**It proves the product reasons rather than recites.** "This applies because you have more than ten employees and you're a small quantity generator" is a different product from a list of rules.

### 7.3 What it is not

Not a form. Not a settings page. Not forty-six questions.

### 7.4 Surface 1 — In context, before an answer

Show **only the facts this question depends on.** Shipping labels → carrier mode, packing group, hazard class. Not employee count.

A wall of facts before every answer becomes noise people scroll past. When the two facts on screen are the two the answer hangs on, people actually check them.

> *This assumes you're using a common carrier for this shipment. If you're using your own trucks, tell me and I'll redo it.*

### 7.5 Surface 2 — Dashboard verification section

**Three at a time. Never more.** More reads as homework.

**Ranked by consequence** — the questions that unblock the most, ranked internally. Not alphabetical, not arrival order.

> **Do you store more than 10,000 lb of any listed chemical?**
> [Answer] · [Upload your chemical inventory]

**Numbers are gated on library verification (§7.7).**

### 7.6 Surface 3 — Onboarding confirm screen

Pre-filled from address, public records, and the website scan. **Correcting is easy; answering forty-six questions is not.**

### 7.7 Numbers are gated on verification status

**Do not display requirement counts until the underlying library is `verified`.**

"That resolved 11 requirements" asserts a known denominator. Before verification, what is known is how many rows are in a table — not the same thing. A confident number over unverified content is the "omniscient status tracker" anti-pattern, already removed once from this product.

| Stage | Feedback |
|---|---|
| **Now** (library `generated`) | "Thanks — that helped. A few more answers and your requirements list will be much more complete." |
| **After verification** | "Thanks — that resolved 11 requirements. Your list went from 34 to 45." |

Same for dashboard ranking: rank by consequence internally, do not display the count.

Turning numbers on becomes a real product moment when it arrives alongside a coverage strip saying the content has been checked.

### 7.8 Unknowns are prominent

Facts that could not be determined are open questions with consequences, not blanks:

> **We couldn't determine whether you store more than 10,000 lb of any listed chemical.**
> Several requirements stay unresolved until we know.
> [Upload your chemical inventory] · [Tell me]

### 7.9 The empty state is the good state

> **Nothing to verify right now.**
> We're confident about your compliance profile. We'll ask if something changes or if we need more detail.

This is a reward, and it explains what the section is for in a way a list of questions never does.

### 7.10 The count does not burn down to zero

It falls as facts are answered and documents arrive. Three things push it back up, and this is correct behaviour, not failure:

- **Volatile facts expire** — generator category is re-determined monthly. Expiry reverting to `unknown` rather than holding a stale value *is* the never-false-green rule working.
- **New library rows introduce new questions** — finishing the Oregon DEQ layer adds requirements depending on facts nobody has been asked about.
- **The business changes** — new site, new chemical, crossing an employee threshold.

Frame it as an inbox that gets quiet, not a burn-down. Otherwise the first time it goes 2 → 5 it looks broken.

---

## 8. Build order within the module

1. Determination gate with an **ask** output path *(runtime, ⚡)*
2. Critic pass *(runtime, ⚡)*
3. Follow-up classification: elaboration / refinement / new question *(⚡)*
4. Fact capture from conversation → `company_switches` with `basis` *(⚡)*
5. In-context fact display before an answer
6. Topic close: summary written, facts extracted, transcript discarded
7. Checklist path with the stricter gate threshold
8. Dashboard verification section, three at a time, no numbers
9. Stale-checklist flagging when a fact changes
10. Numbers enabled — **gated on library verification**

Items 1–4 are quality-affecting and specced before writing.

---

## 9. Open questions

*Numbered explicitly 11 Sep. They were an ordered list, so `§9.3` and `§9.4` already
resolved by ordinal — but nothing on the page said so, and two documents cite those
targets. Numbering them is cheaper than rewriting the citations, and makes the next
citation unambiguous.*

**§9.1 Ambiguous fact capture** — how aggressively to confirm before writing. Too eager is annoying; too permissive silently records wrong facts.

**§9.2 Auto-close interval** — a week? Longer for checklists in progress?

**§9.3 Topic summary format** — what is worth keeping once the transcript is gone.

**§9.4 Concurrent topics** — one open topic at a time, or several? Several means the pollution problem returns across topics.

**§9.5 Scoped answers reused** — if a user says "common carrier for this shipment" three times, does that become a durable default?

---

## 10. Signup and industry classification

*Added 10 Sep 2026. Supersedes the industry dropdown, which is removed.*

### 10.1 The dropdown is removed

The industry dropdown was built when the assumption was that AI would generate everything on the fly. With a requirement library, it is actively wrong:

**It is circular.** `/api/industries` derives its list from `SELECT DISTINCT industry FROM requirement_templates`. It can only offer verticals already built. A chemical manufacturer signing up when only cannabis is loaded sees "cannabis" — or, with an empty table, sees nothing and cannot complete signup at all.

**It cannot express a gap.** A company describing itself as something not yet built has no way to say so — and that is exactly the signal most worth capturing.

### 10.2 But free text alone is worse

The industry string is now a **match key**, not a label. It decides which requirement library applies.

A chemical *distributor* and a chemical *manufacturer* face materially different obligations. Manufacturing brings TSCA, air permitting, process safety, and TRI into scope; distribution largely does not. Someone who blends and repackages but types "chemical distributor" would receive a wrong requirement set **that looks correct**.

> **Self-description is a compliance judgment the user is not equipped to make.** Same reason we do not ask them their hazardous waste generator category.

### 10.3 The model: ask what they do, then classify

Free text is the **seed**. The website scan is the **evidence**. The classification is an **inference, shown with its basis** — never a silent decision.

Industry is a switch. The master one. Same treatment as every other: `basis` recorded, `resolved_by = ai_inferred`, user-correctable, visible on the profile screen.

The confirmation teaches as well as classifies:

> **You look like chemical manufacturing.** Blending and repackaging counts as manufacturing under most rules even though you don't synthesise anything — that matters, because it brings TSCA and air permitting into scope that pure distribution wouldn't.
>
> Sound right?  [Yes]  [No, we only distribute]  [Something else]

That is the product demonstrating expertise on turn one, and it makes the classification correctable in a way a dropdown never was.

### 10.4 Industry is not one value

A chemical company that manufactures, distributes, and runs a fleet is all three. `requirement_templates.industries[]` already anticipates this; the company side must match:

```
primary_industry
secondary_activities[]
```

This is also how the cannabis processor works cleanly — **cannabis by licence, chemical manufacturing by activity.** Both requirement sets apply. Under a dropdown you would pick one and silently lose half their obligations.

### 10.5 Signup asks for very little

**Email · password · website · address.**

**The address is required, not optional.** The website says what they do; the address decides *which body of law reaches them* — state, county, fire authority, and in Washington which regional clean air agency holds air permitting authority. That is the jurisdiction spine and it is not derivable from a website.

Everything else comes from the scan, public records, and later questions.

### 10.6 Do not block signup on the scan

Thirty seconds of spinner immediately after signup is a poor first impression, and the classification is something the user might get wrong anyway — blocking on it reproduces the dropdown problem in a new costume.

**Let them in. Run the scan in the background** (a natural first job for the worker). Surface the result as the first thing they see:

> **We had a look at your website.** Here's what we understand about your business — correct anything wrong.

The confirm screen arrives as a welcome, not a form.

### 10.7 No website is a different evidence path, not a degraded one

A small blender or single-location processor may genuinely have no site. Company name plus address still drives the **public records lookups**, which are keyed on name and address, not on having a website:

- **EPA RCRAInfo** → EPA ID and hazardous waste generator category
- **EPA ECHO / FRS** → permits, inspections, violation history
- **FMCSA SAFER** → DOT number, fleet, hazmat authority
- **OLCC licensee list** → cannabis licence type, endorsements, production tier
- **Oregon DEQ / WA Ecology** → state permits

Several of the hardest switches arrive free without a website at all.

### 10.8 Three failure modes, three different messages

The wording matters — two of these are the product's problem, not the user's, and should not read as the user failing.

**a) No website, declared at signup.** Ask for the description up front, alongside name and address. Neutral, expected.

**b) Website unreachable — broken link, parked domain, typo.** They *expected* this to work. Offer the correction first, because a typo is more likely than a genuine absence:

> **We couldn't reach yourcompany.com.** Check the address, or tell me what your business does and I'll work from that.

**c) Website reachable but uninformative** — a brochure site reading "quality solutions since 1987":

> **Your site didn't tell us much about your operations.** In a sentence or two — what does your business make or do?

### 10.9 The scan must judge sufficiency, not just extract

A scan returning a company name and nothing else is a *technically successful* scan and a useless one.

**The scan output needs a confidence signal:** did we learn what they actually do, or only that they exist? Below a threshold, ask (§10.8c). Without this, case (c) is indistinguishable from success and the user is silently classified on nothing.

### 10.10 An unbuilt vertical is a lead, not a failure

> "We do powder coating and metal finishing"

Not an error. A **library gap with a real prospect attached.** It writes to `library_candidates`, and the honest response is the coverage strip doing its job at signup:

> We don't have a verified requirement library for metal finishing yet. We can still answer your questions from current regulations — you'll see exactly what's covered and what isn't.

**This turns the signup form into demand research.** After twenty signups you know which vertical to build next from evidence rather than guesswork.

### 10.11 Why asking little works

The value of asking few questions at signup is that the ones you *do* ask arrive later, **in context, with the reason visible**:

> To answer this properly I need to know roughly how much hazardous waste you ship per month. Upload six months of manifests and I'll work it out, or just tell me.

People answer that. They abandon the signup-form version.

### 10.12 Consequences for the build

- ⬜ Remove the industry dropdown and `/api/industries`, or repurpose the route
- ⬜ Signup collects email, password, website, address only
- ⬜ Address required; geocode at signup for state, county, city, fire and air authority
- ⬜ Scan runs as a background job, not inline
- ⬜ Scan output carries a **sufficiency confidence**, not just extracted fields
- ⬜ Industry stored as `primary_industry` + `secondary_activities[]`, with `basis` and `resolved_by`
- ⬜ Classification presented as a teaching confirmation, correctable
- ⬜ Three distinct fallback messages (§10.8)
- ⬜ Unmatched industries write to `library_candidates`
- ⬜ Public-records lookups run on name + address, independent of the website

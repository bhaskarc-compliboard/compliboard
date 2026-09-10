# Compliance Workspace Design
**Version:** 2 · **Updated:** 10 September 2026
**Supersedes:** version 1 (9 Sep), deleted. Adds §10, signup and industry classification.

**Status: design agreed. Not built.**
**Related:** `DECISIONS.md` · `CHEMICAL-OR-WA.md` (six-stage runtime, §5) · `BUILD-PLAN.md`

---

## 1. What this module is

The Compliance Workspace is where a user asks a compliance question and gets an answer, and where an answer becomes an actionable checklist. It is the part of the product salespeople demo and the part customers use daily.

**Three entry paths, one engine:**
1. Ask a question → get an answer
2. Convert an answer into an execution checklist
3. Request a checklist directly, without asking a question first

All three run the same six-stage runtime pipeline. The difference is only how strictly the determination gate fires (§4.3).

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

| Type | Example | What runs |
|---|---|---|
| **Elaboration** | "Explain step 3." "Where do I buy UN-spec boxes?" | Expansion only, against the existing answer |
| **Refinement** | "What if it's PG III?" "We use a carrier." | Update the fact, then re-run identification → critic → expansion |
| **New question** | Unrelated topic | Full six-stage pipeline |

One cheap classification call decides. Running all six stages on every follow-up is slow and wasteful.

**Refinement recomputes; it does not append.** The answer was built on a fact that changed. Adding a correction underneath leaves the wrong answer on screen above it.

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

1. **Ambiguous fact capture** — how aggressively to confirm before writing. Too eager is annoying; too permissive silently records wrong facts.
2. **Auto-close interval** — a week? Longer for checklists in progress?
3. **Topic summary format** — what is worth keeping once the transcript is gone.
4. **Concurrent topics** — one open topic at a time, or several? Several means the pollution problem returns across topics.
5. **Scoped answers reused** — if a user says "common carrier for this shipment" three times, does that become a durable default?

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

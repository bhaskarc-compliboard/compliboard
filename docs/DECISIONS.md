# Decision Record
**Version:** 20 · **Updated:** 11 September 2026
**Supersedes:** version 19 (11 Sep). Adds §36 (the §2.4 switch list was written before the
library: 6 of its switches nothing uses, 30 facts it lacks that 48 requirements need, and
banded `employee_count` cannot express 3 of the 7 thresholds — including the 15 that gates the
ADA, Title VII and the PWFA), §37 (tanks are the inventory and gallons are computed; no CHECK
can catch a dependency cycle, so the loader walks the graph) and §38 (exposure switches are
annual not static; the five-entity-type to two-scope flattening is a recorded approximation;
`outdoor_work` splits because its name encoded an assumption Oregon's heat rule does not make).
Version 19 added §35, two corrections to the determination-gate spec
found while building it: the `/api/chat` authentication closes **one** of §0.8b's four
undocumented routes rather than four, and the gate as specced could not see the worksite's
jurisdiction — it would have asked for an address every company has already given us. **Only
the PROCEED-path golden case could have caught the second**, which is the transferable half:
testing only the direction you are building for finds nothing about the direction you are
not. Version 18 added §34, **a correction to §4**: the checklist schema
did not lack a slot for "I need one more fact first" — it had an ADDITIVE one, positioned
after the answer, so the fix §4 implies was already in place when the failure happened.
Additive and alternative are different things that look identical in a schema. The fix is a
discriminated union, and the two additive slots are removed rather than left beside it.
Version 17 added §33, a near miss: a mapping rule reading
`29 CFR → OSHA` would have filed six employment requirements — the FLSA, FMLA, ERISA, Title
VII, the PWFA and EEO-1 — under the wrong regulator, silently, because a requirement under a
wrong agency looks entirely normal. Caught by projecting the mapping read-only over all 194
rows and reading the result by target rather than by count. The rule: a CFR title is not an
agency, the part is. Version 16 added §32: Washington's agencies wait for the
Washington library rather than loading now as permanently-`not_built` coverage rows — a gap
is only information when somebody expected the thing to be there, and the reversal condition
is the day the first Washington requirement is written. Version 15 added §29 (an unmatched requirement is a library
candidate, never a new version — a version claims the law changed, a candidate claims only
that a model said something), §30 (the customer-facing "what changed" diff is M6 work,
answerable from the validity windows rather than computed at resolution time) and §31 (the
two plans keep their separate phase numbering; the mapping table stays). Version 14 added
§28, what actually feeds a document prompt: one
shared parser for every route, and the two findings behind it — `/api/chat` answered from
the filename alone for formats its own file pickers offered, and `/api/hr` excluded `.docx`
from every HR answer while telling the user the format was unreadable, when the parsers had
existed all along and the restriction was a workaround for a mislabelled file. Version 13
added §27, how the product speaks when something fails
— polite, plain, honest about whose problem it is, never asserting anything about a document
it did not read, always saying what to do next. The operative rule goes in `CLAUDE.md` §5.1
beside the error-handling rules it extends; `WORKSPACE.md` §10.8 is the same rule scoped to
signup and is referenced rather than duplicated. The worked example is an alert that told a
user to check a file for dates after refusing to read it. Version 12 added §26: the invite flow becomes `MODULES` M8 —
Account, a new and eighth module. It had been floating between Phase 0 and Phase 1
(TODO.md numbering),
scheduled by nothing precisely because it depends on nothing. The cost of waiting is now
recorded rather than implicit — records written under a shared login stay ambiguous forever,
so deferring costs a window of history rather than a late feature. Version 11 added §25, where jurisdiction comes from: state, county
and city are **geocoded** from the address against the US Census Bureau Geocoder rather than
typed or inferred — a deterministic lookup against an authoritative source outranks both a
stated value and an AI one, which strengthens §24.1 — and a geocode failure leaves
jurisdiction unknown and asks rather than substituting. Fire authority is **asked**, because
fire districts do not follow county lines and the customer has been inspected by one.
Version 10 added §24, the match key: the company's stated address
is authoritative and an AI website scan never is — a derived value silently outranked a
stated one for months and cost most companies their state-level requirements — and the
match key's implementation belongs to Phase 4's resolution engine, with Phase 1 (TODO.md
numbering) landing its
inputs. Version 9 added §23, taken while building the six new tables:
multi-value switches decompose into one switch per substance rather than becoming an array
or jsonb — `applies_expression` is the test, since a requirement gated on lead cannot say
"one of the values in this array is lead" — which takes the switch count from ~46 to ~59;
and `topics` is deliberately not built, because two of `WORKSPACE.md`'s open questions
decide its columns and it is the furthest of the six from a caller. Version 8 added §22, the decisions taken while building the
requirements data-pass worksheet: what `priority` actually means (the test is whether the
business stops when an inspector finds it missing, and a third of the library being
`critical` means nothing is), `produces_switch` as the name of a switch rather than a
renamed boolean, `source` becoming `generated_by` with two values, and `cadence_type` left
free text until the pass shows what it needs. **§22.3 also corrects a misreading carried in
`CHEMICAL-OR-WA.md` §4.4**: the 174/11/3 model split was a sequential build log, not one
enumeration with two validators — what it carries is a convergence signal, and that is why no
fourth model was run. Version 7 added §21, the four enum decisions settled before
migration 006: `employee_count` becomes an integer rather than a band, `layer` becomes
jurisdiction-only with `contractual` moved to its own `source_type` axis,
`obligations.status` follows the spec's four states rather than the code's five, and
`category` becomes a ten-value obligation type holding the shape of the duty and nothing
else. Two data questions are flagged inside §21.2 and one inside §21.3 — deliberately not
guessed — all three were answered the same day and §21.2 and §21.3 now carry the answers:
`jurisdiction_layer` gains `local` and becomes nullable, and `missing` is not a status at all
but a query over `obligation_evidence`. §21.3's `satisfied` state was renamed `applies` the
same day, before any code used it — the four states answer *does this apply*, not *have I
done it*. Version 6 added §19 and §20. **§19 corrects §17.5** — `memberships`
is not a prerequisite for user management; several people at one company already works on
`profiles.company_id`, and what is missing is an invite flow. `memberships` answers a
different question, one person across several companies, and moves to multi-site. §17.4's
reasoning is corrected in place and §17.5 is marked half-superseded; the half that survives
is "do not stockpile the feature." **§20 records the multi-facility decision** — the data
structure goes into the Phase 1 (TODO.md numbering) rebuild, the interface does not, and
site is a property of
data rather than of people. Version 5 added §18, the decision to order the plan horizontally
first and vertically last — the phases now hold only infrastructure, and every module moved
to a final `MODULES` section in `BUILD-PLAN.md` and `TODO.md`. Version 4 added §17, the decisions behind the second tenancy
layer: RLS as an enforcement layer rather than a formality, `auth_company_id()` as the one
place tenancy lives, the shared-cache carve-out, one user per company for release one with
the audit-trail cost stated, separating the schema migration from the multi-user feature,
and the verification standard. §16 updated to reflect that the routes are now converted.
Version 3 superseded version 2 (10 Sep) — §15.7 is marked superseded and §15.8 replaces it:
document versions now live inside each file, not in its filename. §13 drops the Technical
Due Diligence row — that document has been deleted and every finding that mattered is
carried into this one; a fresh assessment will be made later. Version 2 superseded
version 1 (9 Sep), whose content is carried forward except where noted. §15 records the
decisions of 9–10 September, §16 the state of the security work. Also supersedes
conflicting statements in earlier planning documents.

**Companions:** `CHEMICAL-OR-WA.md` (the full design) · `BUILD-PLAN.md` (the phased plan
and why the order is the order) · `TODO.md` (the task-level to-do) · `WORKSPACE.md`
(conversation model, fact capture, topic lifecycle) · `CLAUDE.md` at the repo root (the
working rules for sessions)

---

## 1. Corporate structure

**Decision: one company, one codebase, one P&L. Vertical *brands*, not vertical *companies*.**

The proposal to split CompliBoard into ~10 industry-specific companies was considered and rejected for build-time. Reasons:

- Multiples are convex in revenue. Ten businesses at $300K ARR sell at 2–3× if they sell at all; one at $3M sells at 6–8×. Splitting ARR ten ways drops every unit below the threshold where strategic buyers engage.
- Engineering was never the cost. Ten go-to-market motions, support queues, entities, and data rooms for a solo founder means zero of them done well.
- A shared codebase poisons diligence. The second buyer is purchasing a dependency on a seller who still owns nine competing products. The first sale is clean; sales 2–10 are structurally harder and must be disclosed.
- Ten entities destroy the `standard_templates` cross-customer cache — the one place where marginal cost falls as the customer base grows.
- Segment ≠ problem. CompliBoard solves one problem: *proving compliance with real evidence instead of guesses*. Food vs. chemical vs. cannabis is market segmentation.

**What is done instead:** per-industry landing pages, vertical-specific content and templates, industry-tagged customer cohorts. All the marketing benefit, none of the structural cost.

**Carve-out remains an exit-time option.** If a chemical buyer wants only the chemical book, it is sold as an asset: that vertical's customers, contracts, brand, and requirement library, plus a perpetual source licence and a scoped non-compete. Carve-outs are cheap at exit and expensive to maintain for years beforehand.

**Reversal condition:** if two verticals turn out to be genuinely different *products* — different data model, workflow, buyer, sales cycle — not the same engine with different content. Decide from evidence after real customers in two verticals, not up front.

---

## 2. The Requirements architecture — four layers

**Decision: adopt the four-layer model. Layer 3 is code, never AI.**

| Layer | What | Owner | Producer |
|---|---|---|---|
| 1. Library | What the law requires, by industry + jurisdiction | Global | AI generates, human verifies |
| 2. Switches | ~46 facts about this company | Per company | AI determines, user overrides |
| 3. Obligations | Which library rows apply | Per company | **Code — pure calculation** |
| 4. Evidence | Which documents prove each obligation | Per obligation | AI matches, stored as rows |

Once the law is known (L1) and the company is known (L2), applicability is arithmetic. That single move makes the spine deterministic, instant, free to recompute, and fully explainable.

### 2.1 Jurisdiction goes in the match key

> ⚠️ **The paragraph below was wrong and is corrected in §24. Kept, not rewritten, because
> the correction is more instructive than a clean statement would be.** The deleted route
> did *not* match on industry alone — it filtered on `jurisdiction_state`, taken from an
> unverified AI website scan rather than the customer's address. That blob was null for 7
> of 10 companies, so most silently received **federal rows only**: the failure direction
> is UNDER-serving, not the over-serving described here. **94 of 192** active rows are
> Oregon-specific, not 90 of 188. The complete six-case rule is in `CHEMICAL-OR-WA.md` §3.2
> and the source-of-truth decision in §24.1 and §25.1.

Today the obligation-matching logic matches `.eq('industry', ...)` alone. (It lived in `app/api/sync-obligations`, deleted 9 Sep as an orphaned route with zero callers; the matching rule is what carries the bug and it is still to be rebuilt.) 90 of 188 chemical rows are Oregon-specific. A Texas chemical manufacturer is currently served Oregon SoS registration, CR2K, and Oregon OSHA. That is a **confidently wrong requirement** — the dangerous failure direction.

Resolution filters on: `federal OR (state AND matching) OR (county AND matching) OR (city AND matching)`.

**Corollary:** 95 federal rows serve every state. Chemical Oregon → Washington is an ~87-row job, not 188.

### 2.2 Switches are the product

182 of 188 chemical requirements are conditional; only 6 are universal. The requirement list is not the product — **applicability determination is the product.**

26 AI judgments per company instead of 188, reusable, explainable, correctable, and shared across verticals (employee count and fleet apply to cannabis and brewery too).

### 2.3 The `unknown` state is a safety feature

Four switch states: known-true → applies · known-false → not-applicable *with contradicting evidence recorded* · **unknown → undetermined, never "doesn't apply"** · needs_user → surfaced as a question.

Absence of evidence never produces a clear. This is the never-false-green principle encoded in the data model rather than only in a prompt.

### 2.4 Evidence lives in rows, not JSON

`obligation_evidence` resolves three findings that look unrelated in diligence: no resolution tracking, dashboard can only show issues climbing, and audits recompute from scratch. All three are the same problem — evidence links buried in a frozen JSON column.

---

## 3. Schema changes forced by the second vertical

Cannabis was used as the stress test. Six of eight core mechanisms survived unchanged. Five changes are required, and the first two must happen **before any new library rows are loaded**:

1. **Switch hierarchy** — `depends_on_switch` / `depends_on_value`. A switch whose parent condition isn't met is `not_applicable`, a fifth state distinct from `unknown`. Only `unknown` surfaces as a user question. *(Painful to retrofit — do first.)*
2. **`industries` becomes an array** — one row, many industries. Cannabis extraction and chemical blending share Oregon OSHA and fire code rows. One row, one verification, one update. *(Also painful to retrofit.)*
3. **New cadence types** — `continuous` (Metrc seed-to-sale) and `pre_approval` (OLCC packaging/label approval, $100/application, blocking, per-SKU). Forces `entity_scope` to include `product`.
4. **Per-agency review interval** — OLCC moves quarterly or faster; EPA annually; SoS rarely. Change-monitor frequency follows the regulator's velocity. Add agency bulletins as a monitored source class, not just rule registers.
5. **`jurisdiction_level = city` made real** — decorative in chemical, load-bearing in cannabis (local opt-outs, buffer distances, local licensing).

**Left unchanged:** four layers, `applies_expression` (simple AND/OR is sufficient), `scope_rules`, `produces_switch`, the six-stage runtime, verification by fact class.

---

## 4. The demonstrated failure mode, and the fix

Live test — *"minimum labeling requirement for 2.5L bottles and for the case"* — scored **B−**:

- **Critical error:** asserted each bottle needs DOT proper shipping name, UN number, and hazard class. Wrong. Six bottles in a case is a combination packaging; DOT marking and labeling attach to the outer package. Inner packagings are not separately marked or labelled. Six sub-steps and $650–1,800 of cost estimates were built on a requirement that does not exist as stated.
- Invented premise in the title ("your own vehicles" — never stated by the user)
- Miscitation (49 CFR 172.315 is limited-quantity marking, not net quantity)
- Packing group — the determination the entire answer depends on — absent
- Missing: UN specification packaging, hazmat employee training, shipping papers

**Root causes, only one of which is model capability:**

1. **Output schema foreclosed the right answer.** No slot for "I need one more fact first." A model asked to fill a checklist fills the checklist.
2. **Autoregressive lock-in.** The wrong headline got elaborated, not corrected.
3. **Substep expansion legitimised an unverified premise.** Expansion received requirement #1 as given.
4. **Effort inverted.** Six sub-steps on label procurement; one sentence each on the correct requirements.

**The governing principle that came out of it:**

> AI reasons excellently *against an artifact* and enumerates unreliably *from nothing.* Artifact-anchored tests scored ~99% against paid consultant work. The unanchored test scored B−. Never let the model enumerate from nothing — always give it a document, an agency scope, a library row, or a draft to critique.

### 4.1 Four stable model weaknesses, and the compensations

| Weakness | Compensation |
|---|---|
| Negative knowledge — better at "must do X" than "X doesn't apply here" | `scope_rules` as first-class content; critic question 3 |
| Regime/object boundaries — which rule attaches to which object | Explicit object + regime fields in identification |
| Specific numerics — dates, fees, thresholds go stale | `verification_flags`; primary-source retrieval; never generated at runtime |
| Under-asking — enumerates branches rather than requesting one fact | Determination gate with an explicit "ask" output path |

---

## 5. The six-stage runtime pipeline

```
User question
  1  Determination gate   what facts decide this? → if blocking fact missing, ASK. Stop.
  2  Agency scoping       which agencies have jurisdiction?
  3  Library retrieval    pull matching rows — THE ANCHOR
  4  Identification       which apply? object + regime stated. temp 0.1
  5  Critic pass          adversarial, fresh context, sees only output
  6  Expansion            sub-steps and costs, only on survivors
```

**Stage 1 alone would have prevented most of the test failure** — packing group determines UN number, hazard class, LQ eligibility, packaging spec, and label. "Upload the SDS" resolves all of it.

**Stage 5 is the highest-value addition.** Critique is cheap and reliable; generation is expensive and fragile. Applied to the failed test it catches the combination-packaging error, the missing determination, the invented premise, the penalty figure, and the omissions.

**Model tier allocation:** strong for determination gate and identification, **strongest for the critic**, cheap for agency scoping and expansion. Currently the same capability is spent on judgment and on prose.

**Temperature:** checklist generation currently runs at default because it is treated as conversational. Identification is a judgment call. Quality-affecting — spec before changing.

---

## 6. Coverage is data, not a code branch

**Decision: no `if (industry === 'cannabis')` anywhere. Ever.**

```
industry_coverage
  industry, jurisdiction_state, agency_id
  status         not_built | generated | verified
  row_count, last_verified_at
```

One table routes the pipeline, renders the coverage strip, and *is* the library build queue.

**Three tiers of anchoring:**

| Tier | Anchor | Quality |
|---|---|---|
| 1 | Full library | Best |
| 2 | Agency list only | Substantially better than nothing |
| 3 | Nothing | What produced the B− |

Stage 3 returns rows or returns nothing; Stage 4's prompt swaps the anchor accordingly. Same code path, same critic, same display. **The day OLCC rows land, cannabis answers improve automatically — no deploy, no flag.**

**`library_candidates`** captures every requirement produced without a library, with `times_seen` and user feedback. A real cannabis operator using the product for six months produces a usage-ranked, operator-validated build queue. The design partner becomes the library generator.

---

## 7. Vertical sequencing

**Decision: chemical library first. Cannabis served by the engine, not the library.**

### Why not cannabis first, despite the live lead

**The decisive argument — verification.** The quality model is *AI generates, human verifies.* Bhaskar is the human. Chemical/hazmat expertise makes chemical rows verifiable on sight. Cannabis rows are not. Building vertical #1 where the verification step cannot be performed defeats the purpose of vertical #1.

**Market economics.** ~2,400–2,500 active Oregon licences splitting ~$944M–$1B total. Retail median price per gram at the lowest since legalisation. Basket size down 20.8% since March 2021. Operators exiting and selling licences. Small TAM (10% penetration ≈ $600K ARR ceiling), weak willingness to pay under 280E, and involuntary churn as a structural feature.

**Maintenance burden peaks where verification capacity is lowest.** THC caps and packaging restrictions being reintroduced; OLCC Compliance Education Bulletin CE2-2601 effective 1 September 2026 defining a new Metrc process for secondary lab sample results. Constant churn.

**Exit thesis.** Cannabis software M&A is depressed with a small, cash-constrained buyer pool. Chemical/EHS has deep, well-capitalised strategic buyers. Warm relationships (High Purity Products, Cascade Columbia, Tarr, Columbus Chemical) are all chemical.

### What happens with the cannabis lead instead

Served **now** by the runtime engine at tier-2 anchoring, as a paying design partner — not a committed vertical.

- Cannabis agency list (~8 rows): OLCC, Oregon OSHA, ODA, DOR, Water Resources, DEQ, local fire, local jurisdiction. **One afternoon, and it moves cannabis from tier 3 to tier 2.**
- Runtime fixes (Stages 1 and 5) benefit them and every other vertical
- They are the golden-file source and library-candidate validator
- Coverage strip states plainly that no verified library exists yet

### The salesperson changes the verification picture

One of the three commission-only salespeople worked in cannabis manufacturing for several years and owned a small operation. **This partially closes the cannabis verification gap** — he can review generated OLCC rows in his licence type and say whether they are wrong.

Limits, and they matter: he can verify his own licence type, not the full rule set; not Washington; not anything that changed after he left. Tag rows with *who* verified and *when* — his `verified` and Bhaskar's are not the same claim and must not look identical in the database.

---

## 8. The first cannabis prospect

Six facilities across Oregon and Washington, targeted by the ex-operator salesperson.

**Decision: separate account per facility. Land on Oregon first.**

Separate `company` records per facility means jurisdiction resolves correctly per site automatically — no `entities` multiplication required for V1, and Washington facilities simply don't onboard until the Washington library exists.

**Known limitations of the workaround, to plan around rather than discover:**
- Company-level documents (HazCom program, SOPs, training curriculum, ISO cert, insurance) must be uploaded per account, or sites show gaps for documents that exist
- No roll-up view — six dashboards, no company-wide picture, which is what the cheque signer wants
- Six accounts at $199 = $1,194/month in a distressed market. **Decide the discount floor before the call, not in it.**

**Two things to establish in the first conversation:**
1. **Are the six facilities one licence holder or separate licence entities?** Cannabis frequently uses separate entities per licence for regulatory and tax reasons. If legally separate, separate accounts is *correct*, not a workaround, and the shared-document problem largely disappears.
2. **Are they a processor?** If they run hydrocarbon or CO₂ extraction, their highest-consequence obligations — flammable storage, LEL monitoring, ventilation, room classification, hot work, confined space, HazCom, boilers — are Bhaskar's own domain, verifiable personally, and already being built for chemical. Almost all cannabis compliance software is Metrc-adjacent; nobody covers the side where a fire marshal shuts an extraction room down. That is the wedge.

**Land on one or two Oregon facilities, not all six.** Closeable this quarter, manageable setup, honest scope, and it reveals whether the multi-account approach actually annoys them before anything is built around it.

---

## 9. Verification and the checking agent

**Decision: verify by fact class, not row by row. Ground truth is primary-source retrieval, never a model vote.**

Do not review 188 rows. Review, in order:
1. Every specific date, deadline, fee, and numeric threshold — the demonstrated failure class
2. Every `disputed` item
3. Every `critical` priority citation
4. Every row in the OR/WA divergence table
5. Every `scope_rules` entry — models are systematically weak on exclusions

~50–60 rows per state out of ~190. Days of focused work, not months.

### The shadow-testing design

Production runs the engine; staging runs the library; compare. **But data isolation is not independence.** The library is Claude-generated and live answers are Claude-generated — agreement is one witness speaking twice.

- **The checker must run on a different model** (GPT or Gemini)
- **Tiebreaker is primary-source retrieval** — eCFR, Federal Register, Oregon OAR/ORS, Washington WAC/RCW
- **Normalise before comparing** — prose cannot be diffed against a table
- **Weight toward the valuable disagreements:** *in answer, not in library* = library gap (actionable); *both, different specific* = one is wrong and it's resolvable (highest value)
- **Seed known-bad rows.** An unsupervised agent's failure mode is gradually finding nothing and reporting clean. If the checker misses the seeds, the checker is broken.
- **Human spot-check the checker's judgments**, not the library. Twenty adjudications per quarter.

### Change monitoring

Detection is deterministic retrieval (Federal Register API, eCFR, Oregon SoS bulletins, WA Code Reviser WSR filings, agency bulletin pages). Impact assessment is AI. Never ask a model "what changed recently."

Versioning is what makes it useful: *"Row 47 is superseded effective 03/01/2027. 23 customers were shown the prior obligation. Here they are."* The second sentence is the product.

---

## 10. Onboarding

**Governing rule: never ask what can be derived from the address, the website, a public database, or a document they already have.**

| Source | User cost | Switches resolved |
|---|---|---|
| Address | Zero | ~5 (state, county, fire authority, WA air authority, sewer district) |
| Public databases | Zero | ~8, including the hardest ones |
| Website scan | Zero | ~10 |
| Documents | One upload | ~20 |
| Direct questions | High | **Target 6–8** |

**Public databases are the most under-used input available.** EPA RCRAInfo returns the EPA ID and generator category — one of the hardest and most consequential switches. ECHO/FRS returns permits and violation history. FMCSA SAFER returns DOT number and hazmat authority. Oregon DEQ / WA Ecology return state permits. **OLCC publishes the full licensee list** — for cannabis this delivers licence type, endorsements, and production tier for free, which is the master switch and most of its children.

**Ask for documents, not answers.** "Upload your last six manifests" is a five-minute task for a shipping clerk. "What is your generator category?" produces a wrong answer from the same person.

Onboarding is progressive: 3 signup fields → background scan → **confirm screen** (correcting is easier than answering) → ~7 questions → skippable document requests → dashboard with a completeness meter → in-context asks when a question touches an unknown switch.

---

## 11. Where retrieval belongs

**Decision: primary-source retrieval happens at table creation and continuously thereafter — never as prose in a design document.**

A document saying "the deadline is March 1" goes stale silently and carries no check date. The same fact as a row with `citation_url`, `citation_quote`, and `source_checked_at` is auditable, re-checkable by the change monitor, and displays a verification badge.

Two live retrievals proved the value:

- **CFATS is still lapsed.** CISA states that as of 28 July 2023 Congress allowed the statutory authority for the CFATS program (6 CFR Part 27) to expire and CISA cannot enforce compliance. A generator working from training data would publish Top-Screen and Site Security Plan obligations as live requirements. **Maintain a standing "confirm status before publishing" list.**
- **Oregon CR2K confirmed and now citable.** OAR 837-085-0090(2): a covered employer who possessed a reportable hazardous substance in the previous calendar year must submit a Hazardous Substance Report by March 1 of the following year. ORS 453.317 adds "or within 60 days after the State Fire Marshal mailed the survey, whichever is later." Reportable quantities: 500 lb solid / 500 gal liquid / 500 cu ft gas; 500 lb or the TPQ (whichever is less) for EHS; 10 lb / 5 gal / 20 cu ft for highly toxic materials and explosives. Federal EPCRA 312 is generally 10,000 lb — **Oregon is roughly 20× stricter.**

Also caught: the Office of the State Fire Marshal separated from Oregon State Police into its own agency around 2023–24. Both URL structures remain live.

---

## 12. Codebase

**Decision: modify the existing repository. Do not fork.**

- Nearly every change is **additive** — new tables alongside existing ones, new pipeline alongside the existing chat route. The Requirements module is already hidden from navigation, so the work happens behind it with nothing user-facing breaking.
- A fork is a rewrite that doesn't admit it. The working parts (`lib/ai.ts`, the two-tier cache, the audit engine, document review, the design system) would be copied and immediately diverge.
- The live demo (CB-Test-1) and Vercel deployment stay intact; small fixes keep shipping while the big work happens on a branch.
- Git already provides what a fork provides.
- The existing migration author designed `entities`, `obligation_evidence`, `corrections`, and `agencies` **correctly**. They are unused, not wrong. This is finishing something started, not replacing something broken.

**Reversal condition:** if the existing schema actively fights the new tables. It doesn't.

**Development moves to Claude Code.** It reads before writing (removing the reason for the never-patch-JSX rule), writes migrations as files, and handles multi-file changes that broke under the two-terminal workflow.

**The standing quality rule survives the tooling change.** Anything touching prompts, temperature, model choice, what data feeds a prompt, truncation, extraction schemas, batching, or matching logic is discussed before it is written.

---

## 13. Project document decisions

| Document | Verdict |
|---|---|
| `CHEMICAL-OR-WA.md` | **Keep.** The master design document. |
| `CompliBoard-Requirements-chemical-manufacturing.xlsx` *(on disk; recorded here originally as `CompliBoardChemicalRequirementsMERGEDv2.xlsx`)* | **Superseded 11 Sep.** It was the single source for the 188 rows; the library now lives in the database (194 rows, 192 active) and the worksheet that loaded it is `supabase/seed-data/REQUIREMENTS-FILLED-2026-09-11.xlsx`. Keep as provenance. Richest artifact: 188 rows, the 9-item VERIFY hit list, 26 switches, 18-row fixed-date calendar, and a `Layer` column that already encodes agency ("Oregon OSHA", "Federal DOT"). The normalised columns from the separate intake file — `jurisdiction_level` (95 federal / 87 state / 3 county / 3 contractual), `jurisdiction_state` (90 Oregon), `is_determination` (9 yes), `applies` (182 conditional / 6 universal), `source` (174 gpt / +11 claude / +3 gemini — a sequential build log, not authorship; see §22.3) — have since been merged into it. |
| `CompliBoard-Requirements-Module-Definition.md` | **Delete.** Fully absorbed into the Chemical OR/WA spec, which contains everything in it plus the regulatory map, runtime architecture, display, verification, and onboarding. Two overlapping specs will drift. |
| `CompliBoard-Requirement-Template.xlsx` *(that is the name on disk)* | **Delete.** 18-column intake template superseded by a schema with ~15 additional fields (`applies_expression`, `scope_rules`, `agency_id`, `citation_url`, `citation_quote`, `produces_switch`, verification and versioning columns). Keeping it invites loading data in the obsolete shape. **Superseded in fact on 10 Sep by `REQUIREMENTS-TEMPLATE.xlsx` (below), which is the shape that was missing.** The file is still on disk at the repo root as `CompliBoard-Requirement-Template.xlsx`; deleting it is §0.7 housekeeping. |
| `REQUIREMENTS-TEMPLATE.xlsx` | **Keep, and treat as working state rather than a document.** Generated 10 Sep from the 188 production rows in the column order the rebuilt table will load in, with the six rows decided in §21.2 pre-filled and `category` deliberately empty. It is the worksheet for the re-categorisation and splitting pass (§21.4), not a specification — when the pass is loaded, the database becomes the source of truth again and this file is a record of how it got there. Regenerate rather than hand-edit if it drifts. |

---

## 14. Standing principles

- **Applicability determination is the product**, not the requirement list.
- **Never let the model enumerate from nothing.** Artifact, agency scope, library row, or draft to critique — always something.
- **False negatives are far more dangerous than false positives.** Never mark not-applicable without positive contradicting evidence.
- **Absence of evidence never produces a clear.** `unknown` → undetermined, never "doesn't apply."
- **Readiness counts are computed in code**, never by AI.
- **Expired evidence can never satisfy a requirement** — enforced in prompt *and* in code.
- **Rows are versioned, never edited in place.** Audits pin to a library version and stay reproducible.
- **Never delete an obligation** — mark it. "We were subject to this from March 2024 to January 2026" is the history the product exists to preserve.
- **Fix bugs at the source, never patch queries.**
- **Coverage is stated honestly.** "Local fire ◐partial · ODA ○not built" is more credible than any completeness claim.
- **Scanning is per industry, never per customer.**
- **One platform, infinite verticals** — marketing is the only layer where verticals diverge.

---

## 15. Decisions of 9–10 September 2026

Made during the session that closed the service-role holes. Each carries the condition
under which it would be reversed.

### 15.1 Local development points at staging. Production keys stay off the laptop.

**Decision:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` in a developer's `.env.local` hold **staging** values.
Production values live in the hosting platform's own environment settings under the same
names, and are not needed on a laptop for the app to run.

**Reasoning.** `npm run dev` runs the same code as production, including routes that
delete a company, its files and its logins. Twice in one day a dev server was running
against production with those routes live in it. Nothing went wrong, which is not the
same as nothing being wrong. Assume any locally-running server will eventually be clicked
in. A separate, related reason: a production service-role key sitting in a file on a
laptop is the thing that ends up in a zip — four keys already leaked that way on 9 Sep.

The migration scripts are deliberately the exception: `npm run db:migrate` targets
staging, `npm run db:migrate:prod` targets production behind a typed confirmation, and
those genuinely do need production credentials present locally to ship a migration.

**Reversal condition:** if staging ever stops being a faithful copy of production's
schema, developing against it starts producing changes that do not apply cleanly. At that
point fix staging, not the rule. The rule itself reverses only if the destructive routes
are removed from the app entirely.

### 15.2 Data export before account deletion is a requirement, not a nicety.

**Decision:** `/api/account/export` returns everything a company owns as one JSON file,
and the delete flow puts it in front of the user before they can proceed.

**Reasoning.** This product's entire value is holding a customer's compliance position —
what applies to them, what they have proven, what is missing. A customer who cancels and
finds their record simply gone has been harmed in the specific way the product promised to
prevent. Portability is also what makes deletion honest: "we delete everything, and here
is everything first" is a complete offer. Deleting without it is a hostage position, and
for a product sold on trustworthiness that is a strategic error, not just an unkindness.

The export deliberately describes uploaded files rather than embedding them — hundreds of
megabytes of PDFs in a JSON file helps nobody — and says so in plain language, including
that the files must be downloaded separately before deletion because deletion removes them.

**Reversal condition:** none foreseen. If the export ever becomes a vector — a way to pull
another tenant's data — the fix is to scope it correctly, not to remove it.

### 15.3 Irreversible destructive actions need a typed confirmation, not just a session.

**Decision:** deleting an account requires the exact company name in the request body. A
valid session is necessary and not sufficient. `npm run db:migrate:prod` requires the
operator to type `PRODUCTION` in a real terminal, and refuses to run unattended.

**Reasoning.** A session proves who is asking. It does not prove they meant it. The two
failure modes that matter here — a stray repeated request, and a person clicking through a
dialog they have stopped reading — are both defeated by having to type something specific
that cannot be guessed from the UI. The cost is a few seconds on an action taken once in
the life of an account.

This is why the migration script's TTY check was left in place even after it blocked an
agent-run migration: the guard doing its job inconveniently is the guard working.

**Reversal condition:** if a confirmation is ever bypassed in practice — copy-pasted from
a runbook without being read — it has stopped being a decision point and needs replacing
with something else, not weakening.

### 15.4 Library architecture: ONE requirements table, tagged by domain.

**Decision:** all regulatory requirements live in one table, tagged by domain —
`employment`, `environmental`, `transport`, `fire`, `licensing`. Modules are **views over
rows**, not separate systems. HR Help, the compliance calendar and the audit engine read
the same table with different filters.

**The test for whether a new domain needs its own system: does it need different
*columns*, or just different *rows*?** If the answer is rows, it is a tag. Employment law
needs jurisdiction, citation, cadence, applicability and evidence — exactly what chemical
manufacturing needs. It is rows.

**Reasoning.** The four-layer model in §2 only works if applicability is arithmetic over
one set of rows. A second requirements table means a second resolution engine, a second
verification workflow, a second definition of `unknown`, and two places for the safety
properties to drift apart. The cross-customer cache dies too — the thing that makes
marginal cost fall as customers are added.

**Reversal condition:** a domain that genuinely needs different columns — a different
notion of what a requirement *is*, not just different content. Judge it from a real
attempt to model it, not from the fact that it feels like a different subject.

### 15.5 Employment law is library #2, ahead of cannabis.

**Decision:** the second library is employment law, not cannabis Oregon. This reorders
§7 (vertical sequencing) — cannabis moves behind it.

**Reasoning.** Employment law applies to **every** vertical and does not fragment by
industry. A chemical manufacturer, a cannabis processor and a brewery have the same FMLA,
ADA, EEO, wage-and-hour and handbook obligations, differing by state and headcount, which
are switches already modelled. So the rows are reusable across the entire customer base
rather than serving one segment, and it exercises the domain-tagging decision in 15.4 with
a domain that is genuinely different in subject and identical in shape.

It also fits what exists: the HR module already reads handbooks and audits them against an
implied set of required policies. That implied set is exactly the library, currently living
inside a prompt instead of in the database where it can be verified, versioned and cited.

Cannabis remains the wedge for *new customers* — the §8 prospect and the extraction/
fire-code overlap are unchanged. It is second in the library queue, not deprioritised
commercially.

**Reversal condition:** a signed cannabis customer who needs OLCC coverage to onboard.
Revenue in hand beats sequencing on paper.

### 15.6 Working rule: gap-closing and feature work do not mix in one session.

**Decision:** a session that sets out to close a defect closes that defect. A real defect
found while closing it belongs in the same session; a redesign does not.

**Reasoning.** The route-hardening work of 9 Sep touched twelve routes and four documents.
Every change was of one kind — derive identity from the session — which is what made it
reviewable, testable against a single repeated test script, and describable in one commit
message. The `.docx`-as-JPEG bug was found while fixing `/api/hr` and fixed in the same
session: it was a live defect in the code being touched. Rewriting the HR answer flow to
cite sources was *not* done until it was asked for separately, because it changes what the
product asserts.

The distinction: a defect makes existing behaviour wrong. A redesign makes existing
behaviour different. Only the first belongs in a gap-closing session.

**Reversal condition:** none. If a defect cannot be fixed without a redesign, that is the
signal to stop and plan the redesign, not to do it inline.

### 15.7 Document versioning ~~in the filename~~ — **SUPERSEDED same day by 15.8**

**Original decision (9 Sep):** every substantially updated document gets a version number
in its filename and a header stating what it supersedes; the superseded file is deleted.

**Reasoning at the time.** Two overlapping to-do lists existed simultaneously on 9 Sep
(`CompliBoard-TODO.md` and `CompliBoard-TODO-v2.md`), and a to-do item was logged into the
wrong one. `CLAUDE.md` §2 pointed at `CompliBoard-Build-Plan-v2.md` after v3 existed. Both
are the same failure: a reader cannot tell which document is live, so they read the stale
one and act on it.

**What was wrong with it.** The diagnosis was right and the remedy was backwards. Deleting
the superseded file was the correct half and survives into 15.8. Putting the version in the
*filename* is what caused both incidents in the first place: a version in the name means
every update renames the file, and every rename breaks every reference to it. Kept, it
would have guaranteed more of exactly the drift it was written to prevent.

Left in place rather than edited away, because a decision record that quietly rewrites its
own mistakes is worth less than one that shows them.

### 15.8 Document versioning: version **inside** the file, filename stable.

**Decision:** version numbers go inside each document, in a header block. Filenames never
change. Every document in `docs/` carries:

```
# <Title>
**Version:** <n> · **Updated:** <date>
**Supersedes:** <what changed in this version, or "—">
```

To update a document: edit in place, raise the version, say what changed. The filename
stays put. Superseded *content* is replaced, not kept alongside.

Applied 10 Sep: `CompliBoard-Decisions-v2.md` → `DECISIONS.md`,
`CompliBoard-TODO-v2.md` → `TODO.md`, `CompliBoard-Build-Plan-v3.md` → `BUILD-PLAN.md`,
`CompliBoard-Chemical-OR-WA-Vertical-Spec.md` → `CHEMICAL-OR-WA.md`,
`CompliBoard-Compliance-Workspace-Design-v2.md` → `WORKSPACE.md`,
`BIZPULSES-PATTERNS.md` → `PATTERNS.md`. All renamed with `git mv` so history follows.

**Reasoning.** A reference written once should stay correct forever. Under the old rule,
every update forced a chase across every other document, `CLAUDE.md`, and code comments —
and anything missed pointed at a file that either no longer existed or, worse, still did
and was stale. Two drift incidents in a single day is enough evidence. The version is still
recorded; it is recorded where updating it costs nothing.

Git holds the full history of every version. That is what it is for.

**Reversal condition:** if a document ever needs two versions live at once — a published
spec a customer is working against, alongside a draft revision — that is the case
filenames-with-versions actually solves. Handle it then, for that document only, and say
so in its header. Do not reintroduce it as a general rule.

---

## 16. Where the security work stands after 9–10 September

Recorded so the next session does not have to re-derive it.

**Closed.** The storage policies now scope by company prefix (migration 002, applied to
production 9 Sep after a full rehearsal on staging). Every API route that touches company
data derives `company_id` from the verified session token; none reads it from a parameter
or body. Three orphaned routes were deleted rather than hardened. Two prompt-injection
paths — `company_name` and `industry` arriving from the request — were closed.

**Also closed since this section was first written.** Migration 003 moved `checklists`,
`checklist_items` and `calendar_events` to company scope and retired `folder_audits`.
Migration 004 gave every table a full set of policies, centralised the tenancy rule in
`auth_company_id()`, and revoked the not-logged-in role's grants. Migration 005 let
colleagues see each other. Then the routes were converted to run **as the caller**, so the
policies apply rather than being bypassed: ten routes on the caller's token, four holding
the admin client for a named statement each, four touching no database. All five migrations
are live in production. §17 records the decisions behind that work.

**Known and recorded, not fixed:** an empty model response becomes a raw 500 through
`askAIJson`; the monthly-summary route was deleted (it had never run — nothing scheduled
it); four orphaned storage files sit under a prefix matching no company; and the audit
engine drops a document from its basis when the download fails, with no error and no
record — observed live on 10 Sep producing a confident readiness figure from one readable
document out of eight.
---

## 17. Decisions of 10 September 2026 — the second tenancy layer

### 17.1 RLS is the second enforcement layer, not a formality.

**Decision:** every table carries a complete set of policies, and routes connect as the
requesting user so those policies actually apply. Application checks stay; the database
now enforces the same rule independently.

**Reasoning.** Before this, every route derived `company_id` from the verified session and
scoped its own queries — correctly, and verifiably so. But all of them connected with the
service-role key, which ignores RLS entirely. That is *one* layer, and it is a layer made
of remembering: it holds for exactly as long as every future route, written by anyone, in
a hurry, remembers to add `.eq('company_id', companyId)` to every query. The failure is
silent and the reviewer of that future pull request has to notice an absence.

Policies do not need remembering. A route that forgets its filter returns the caller's own
rows anyway; a route that names another company's row gets nothing back. The check moves
from something a person must do each time to something the database does every time.

Both layers are kept. The application check produces a clean 404 and never reveals whether
an id exists; the policy is the backstop when the check is missing or wrong.

**Reversal condition:** if RLS ever measurably costs more than it is worth — a hot path
where the policy subquery dominates, on a table where the application check is provably
sufficient. Measure it; do not assume it. No such case exists today.

### 17.2 `auth_company_id()`, SECURITY DEFINER, is where tenancy lives.

**Decision:** one function returns the caller's company, read from `profiles` with definer
rights. Every company-scoped policy calls it. 59 of 65 policies do, as of 11 Sep — the
count grows with every company-scoped table and is read from the database, never recalled.

**Reasoning.** The same subquery — `company_id in (select company_id from profiles where
id = auth.uid())` — had been written into twenty policies and all four storage policies.
Every copy read `profiles`, and `profiles` had its own RLS, so all of them silently
depended on one policy on a different table. Narrowing that one policy would have denied
everything, everywhere, including every file, with no error naming `profiles`. It would
have looked like the data had vanished.

Definer rights break that chain: the function reads `profiles` regardless of the policies
on `profiles`, so tenancy no longer hangs off a rule nobody thinks about when editing it.
Writing it once also means the rule can be corrected in one place.

`search_path` is pinned — a SECURITY DEFINER function without one is the standard Postgres
hijack.

**Reversal condition:** the function's signature is the constraint. It returns a single
`uuid`, so a person belongs to one company — note that this is the *only* thing
`profiles.company_id` restricts; several people sharing a company is unaffected (§19). *If*
`memberships` is ever needed, the function must return a set or take an active-company
parameter, and 59 policies change with it. That is a planned migration, not a reversal — but
it is the reason this decision has a cost, and the cost grows with the number of policies.

### 17.3 `standard_templates` keeps a privileged write. Named, not habitual.

**Decision:** the shared parsed-standard cache is readable by any authenticated user and
writable only by the service role. `/api/audits` holds the admin client for that single
insert, with a comment saying so and saying not to remove it.

**Reasoning.** One parsed copy of OSHA 1910.1200 serves every company — that shared cache
is the one place where marginal cost falls as customers are added (§1). So the table has no
tenant column, and there is nothing to scope a write policy *by*. An INSERT policy would
let any authenticated user write content into a cache every other company reads: poisoned
regulatory material, from an ordinary session, with no tenant boundary to catch it.

**The general rule this sets:** a route may hold the admin client for a *named statement*
with a comment explaining why. It may not hold it out of habit. All four remaining
admin-client routes name their statement.

**Reversal condition:** if the cache ever becomes per-company — different companies wanting
different parses of the same standard — it gains a tenant column and this carve-out
disappears with it.

### 17.4 One user per company for release one. Shared logins tolerated.

**Decision:** ship with `profiles.company_id` as it is. A company has one login. Early
customers who need two people sharing may share one.

**Reasoning.** User management does not exist — there is no way to add a person to an
existing company or remove one (see the feature item in `TODO.md`). Building it means an
invite/remove flow, and that is not what stands between here and a first customer.

> **Corrected 10 Sep.** This paragraph originally said building it "means the `memberships`
> migration and a whole invite/remove flow." The migration half is wrong — see §19. Several
> people at one company already works on `profiles.company_id`; only the flow is missing.
> The decision here is unchanged, but its *reason* is smaller than it was written: this is
> deferred because the feature is not the most valuable week available, **not** because a
> migration blocks it.

**The cost, stated so it is not discovered later:** a shared login weakens the audit trail.
Every write attributes to one person, so "who marked this obligation complete, and when" —
which is part of what a compliance record *is* — becomes "someone at this company did".
For a product sold on proving compliance with real evidence, that is a real limitation, not
a cosmetic one. It is acceptable for early customers who know it; it is not acceptable
indefinitely, and it should be said out loud during those sales conversations rather than
discovered during an audit.

**Reversal condition:** the first customer who needs two named people with separate
accountability. That is not a nice-to-have request — it is the product's core claim.

### 17.5 The schema migration goes early; the multi-user feature ships on its own timeline. — **half SUPERSEDED same day by §19**

**Original decision:** separate the two. Move `profiles.company_id` to `memberships`
**before real customer data exists**, because that is when it is nearly free. Build and ship
the invite/list/remove feature whenever it is genuinely next.

**What survives, and it is the better half.** *Do not stockpile the feature.* Writing invite
and removal flows now and leaving them unreleased means code that has never met a real user,
ageing against a schema that keeps moving. **Code written and not released is not tested — it
is only compiled.** Build the feature when it is next, and ship it when it is built.

**What is wrong:** the premise that the `memberships` migration has to happen at all, let
alone first. It was written on the belief that `profiles.company_id` means one person per
company. It means one *company* per person — several people can share a `company_id` today,
and do. **§19 replaces this half.** The migration is not cheap-now-expensive-later work that
must be raced ahead of the first customer; it is work for a customer shape nobody has yet.

### 17.6 Verification standard: compare rows against the service role, never HTTP status.

**Decision:** any change to who can see what is verified by comparing per-table row counts —
and where practical exact id sets — under the caller's token against the same query run
with the service role. Joined tables are checked separately. Seed enough rows first that a
subset failure is visible.

**Reasoning.** RLS is a filter, not a gate. A read that is too narrow returns `[]` with a
perfectly good 200; a partially-blocked join returns the right number of rows with empty
content inside them. Neither errors. "The route returned 200" and "the route returned the
right data" are unrelated statements, and only the second one matters.

This was not theoretical. The export route would have silently dropped every colleague from
a customer's data export — right shape, right status, fewer people — and only a count
comparison would have caught it. Testing with one row per table would not have caught it
either, which is why seeding comes first.

Writes are the safe direction: a refused insert errors loudly with `42501`. A refused
*update* or *delete* changes zero rows and returns success, so those are verified by
re-reading the row, not by the response.

**Reversal condition:** none. If a cheaper check is proposed, the question to ask is what
silent narrowing it would catch.

---

## 18. The plan is ordered horizontally first, vertically last

**Decision, 10 September 2026: the phases in `BUILD-PLAN.md` and `TODO.md` hold only
horizontal work — schema, the runtime pipeline, resolution, the worker, library data,
observability. Every vertical slice moves to a single final section, `MODULES`, worked one
module at a time: Compliance Workspace, Audits, HR, Documents, Calendar, Dashboard,
Onboarding and signup.**

**Reasoning.** The plan had one vertical slice sitting inside the horizontal sequence — the
Compliance Workspace, at Phase 3 — and it was scheduled *ahead of* the determination gate,
the critic pass, `company_switches` and the resolution engine, all of which are inputs to
it. A module built while its own foundations are still being poured is a module built
twice. Screens had the same problem at Phase 8, one step removed: a screens phase is not a
unit of work, it is seven modules' worth of screens filed together because they are all
made of pixels.

The second half matters more. **The other six modules had no phase at all.** Their findings
were real, specific and already written down — the audit engine silently dropping documents
it cannot read, HR checking a handbook against eleven hardcoded words with no jurisdiction,
the calendar extracting dates from PDFs instead of reading cadence from obligations — but
they lived scattered through `TODO.md` as *debts*, filed under whichever gap-closing session
happened to surface them. A debt is something you might pay. Planned work is something you
will do. Most of those items are not debts; they are the product.

**The cost is admitted openly: the plan is now longer.** That is the honest shape. The
phases were short because infrastructure is smaller than product, and the previous ordering
made the plan look nearly finished by keeping most of the remaining work out of it.

**What stayed a phase.** The employment law library moved *back* into the phases (6c → 6b).
A library is horizontal: employment obligations are read by the HR module and also belong in
a chemical manufacturer's obligation list, because they employ people. Same table, tagged
`domain = employment` (§4 of this record, and the architecture note in M3). Modules are
views over rows; a body of law is not a module.

**What does not wait for its turn.** M2(a) — the audit engine dropping any document it fails
to download, silently, then computing readiness correctly from a smaller input — is live in
production, was observed in a real run on 10 Sep (two satisfied, one needs-info, computed
from one readable document out of eight), and is half a day. Correctness bugs in shipped
code are not module work. Being last in the plan is not a licence to leave something wrong.

**Phases are not renumbered.** Phase 3 and Phase 8 are now gaps in `TODO.md`, Phase 7 in
`BUILD-PLAN.md`. Both documents and this one reference phases by number in dozens of places
(`7.3`, `2.6`, `5.2`, `6.7`); renumbering would break every reference silently, which is the
same failure mode §15.8 records for versioned filenames. Two gaps in a sequence is the
cheaper cost, and the gaps are explained in place.

**Reversal condition.** If a customer commitment requires one module end-to-end before the
horizontal work is finished, this ordering is what gets traded — deliberately, with the
rebuild cost stated, and with the affected module's dependencies named. The failure to avoid
is drifting into module work because it is more visible than schema work, which is exactly
what a plan with a vertical slice at Phase 3 invited.

---

## 19. `memberships` is not a prerequisite for user management — correcting §17.5

**Decision, 10 September 2026: `memberships` leaves the gate. It is recorded under multi-site
(Phase 11+ / F5) and nowhere else. The gate keeps key rotation and the Phase 1 schema
rebuild.**

**What was wrong.** The gate said *"the `memberships` migration is a prerequisite for user
management"*, and §17.5 was built on the same belief. Both read `profiles.company_id` as
"one person per company." It is the other direction: **one company per person.** Several
`profiles` rows can carry the same `company_id`, and colleagues at one company work today —
proven on staging on 10 Sep, where Test Alpha Chemical had two users and each saw the other's
checklists, which is exactly what migrations 003–005 were built to do.

**What is actually missing is the invite flow.** `/api/signup` creates a **new company** on
every call, so no route adds a second person to an existing one. That is why every company
has exactly one member — construction, not schema. A feature, not a migration.

**What `memberships` is actually for: one person across several companies.** A consultant
serving two clients, or an operator spanning facilities held as separate accounts. Real, but
rare, and nobody has that shape yet. It belongs with multi-site.

**Why the error mattered enough to record.** The two pieces of work are wildly different
sizes. The invite flow is a feature that can ship in any week. `memberships` changes
`auth_company_id()` from returning a `uuid` to returning a set or taking an active-company
parameter, and **59 of 65 policies plus four storage policies** are rewritten with it. Filing
them together made a cheap, valuable feature look blocked by an expensive migration — which
is exactly the reasoning that defers a feature indefinitely without anyone deciding to.

**The general lesson: check the direction of a one-to-many before planning around it.** The
claim was never tested against the schema. Two rows in a table would have settled it, and did.

**Reversal condition:** the first customer who is genuinely one person across two companies —
a consultant, or an owner with two entities under separate accounts. Then `memberships` is
required, and it is its own migration with its own rehearsal, never a step inside another
feature.

---

## 20. Multi-facility: build the structure in Phase 1 (TODO.md numbering), and site is a property of data

**Decision, 10 September 2026: the multi-site data structure goes into the Phase 1 schema
rebuild (`TODO.md` 1.6, `BUILD-PLAN.md` 2.8). The interface does not — it stays in `MODULES`,
built only if a customer asks. One account per facility remains the near-term answer.**

**The design lives in `CHEMICAL-OR-WA.md` §6.6**, which is where someone building multi-site
looks first. This section is the decision and its reasoning; that one is the shape.

**Why the structure now.** One company with facilities in several places is normal in
chemical manufacturing, and **their requirement lists genuinely differ by site** — different
OSHA citations, different waste rules, a different air authority. The six-facility cannabis
prospect is one business with six sites, not six legal entities. A schema whose only unit of
compliance is "the company" is wrong for both, and it is wrong quietly: it produces one
obligation list where there should be six.

**What goes in:** `entities` seeded with one site per company at signup — *including
single-site customers*, so nothing is special-cased afterwards · `entity_id` on `documents`
and `obligation_evidence` (`obligations` already has it) · a `scope` column on `switches`,
`company` or `site`, with a nullable `entity_id` on `company_switches` · site names the
operator recognises (`CompanyA-Hillsboro`, not `Site 2`).

The scope column is the one that has to be right. Employee count and ISO certification are
company-wide; generator category, air permit tier and underground storage tanks are per-site.
A company-wide answer to a per-site switch is not approximately right — it is wrong at five
of six facilities, and it is wrong in the direction of a confident answer.

**⚡ The design rule, because this is the decision that could go wrong: site is a property of
DATA, not of PEOPLE.** A permit belongs to a site. A user belongs to the *company* and sees
everything in it. *"Which site am I looking at"* is a **filter** — a dropdown, roll-up being
"all sites" — and never a permission.

Per-user site access is the tempting alternative and it is a trap. It makes the simple case
(one site, one person) complicated, it turns a dropdown into a permissions system with an
inheritance model and an admin screen, and every query then has to resolve *"which sites may
this person see"* before it can ask anything useful. If a customer later asks that the
Hillsboro manager not see Seattle's findings, **that is a separate permissions feature**,
priced and built as one — not pre-built for a customer who has not asked.

**The cost of the interim, stated so it is a choice.** One account per facility works, and:
company-level documents get uploaded once per account and age independently; there is no
roll-up, so nobody can ask *"where are we exposed across all six?"*; and consolidating later
means **merging live customer accounts** and deciding which copy of a shared document is
authoritative — a data migration on real records with a customer waiting.

**The trade in numbers.** One day of extra design in Phase 1, taking it from about a week to
about a week and a half. Two to three weeks to retrofit after customer data exists, because
it reaches resolution, switches, evidence, documents and every screen at once. This is the
same argument as the gate (§18, and the gate at the top of `TODO.md`) applied to one specific
column set.

**Reversal condition:** if the structure turns out to complicate the single-site path in
practice — the common case for early customers — simplify the *interface*, not the schema.
The seeded default site exists precisely so the single-site case never has to know it is
there. If it starts leaking into queries or screens, that is a sign the default is not being
applied consistently, not that the structure was wrong.

---

## 21. Phase 1 enum decisions — 10 September 2026

Four decisions settled before migration 006. Each replaces a `text` column, or the plan
for one, with a fixed vocabulary. They are recorded together because they share a reason:
**a bare `text` column is a promise nobody checks.** The database holds one vocabulary, the
application code holds another, and the design documents hold a third — that is not a
hypothetical, it is what §21.3 found. An enum makes the disagreement a compile error and a
constraint violation instead of a silent sort to the bottom of a list.

### 21.1 `employee_count` becomes an integer, not a band

**Decision: store the actual number. Band at render time if a UI wants bands.**

**Reasoning.** The app offers `1-25 / 26-75 / 76-200 / 200+`. Every one of those straddles a
statutory threshold:

| Band | What it crosses |
|---|---|
| `1-25` | Oregon sick time at **10**, and lands exactly on OFLA at **25** |
| `26-75` | FMLA at **50** |
| `76-200` | EEO-1 and WARN at **100** |

**A company stored as `26-75` cannot be resolved for FMLA at all** — the answer is not in
the data. No amount of downstream logic recovers it, because the information was destroyed
at write time. Every employment threshold in the library derives from a number; a band is a
lossy projection of that number chosen for a dropdown's convenience.

Bands are a *display* choice. They can be computed from an integer whenever a screen wants
one. An integer cannot be computed from a band.

**This travels as one unit and cannot be split** — the column type, `/api/signup` (which
hardcodes `employeeCount: ''` on every account created), `/api/account` PUT, and the
`<select>` in `app/account/page.tsx`. Split any of them and signup writes a value the schema
rejects, which fails account creation outright.

**What is lost in the conversion, stated plainly:** the eight existing companies holding a
band become `NULL`, because a band cannot be converted into a number without inventing one.
All ten rows are our own test data (`CB-Test-1`, `ZZ Throwaway Test`); two already held an
empty string. Nothing real is lost, and doing this after a customer exists would mean asking
them to re-enter it.

**Reversal condition:** none for the storage decision. If a customer genuinely refuses to
give a number, the answer is a nullable integer and an `undetermined` switch — not a band.

### 21.2 `layer` is jurisdiction only; `contractual` moves to its own axis

**Decision: `layer` becomes `federal | state | county | city`. A new `source_type` —
`statutory | contractual` — carries whether a government imposed the duty.**

**Reasoning.** `contractual` was never a jurisdiction level. It answers *who imposed this*,
not *which government's law reaches here* — a different question on a different axis, folded
into one column because both felt like "where does this come from". A contractual obligation
still has a jurisdiction; it is simply not imposed by a legislature. ISO 9001 does not stop
applying at the Oregon border.

Keeping them in one column makes two things impossible: filtering "everything Oregon
requires of us" without accidentally including a registrar's contract terms, and filtering
"everything a customer contract obliges us to" at all.

**The vocabulary, settled 10 September:**

```
jurisdiction_layer   federal | state | county | city | local     -- NULLABLE
requirement_source_type   statutory | contractual
```

Two data questions were raised against the 188 rows and both are now answered.

**`layer` is nullable, because three rows have no jurisdiction at all.** ISO 9001, ISO 14001
and NACD Responsible Distribution become `source_type = contractual`, and all three carry
`jurisdiction_state = NULL`. Defaulting them to `federal` would assert that **US federal law
requires ISO 9001**, which is false and is the kind of false statement this product exists
not to make. A registrar contract is not territorial. `source_type = contractual` with
`layer = NULL` reads correctly and is the only combination that does.

**`local` is added, and it is not `city`.** Three rows are `layer = county` while
`jurisdiction_county` is NULL in all 188 — *fire-code hazardous-material permits*, *chemical
storage compatibility / segregation*, *emergency lighting / exit sign testing*, all Oregon
Fire Code. `city` would be wrong: **a rural fire protection district is not a city**, and
Oregon has many. `local` means *the authority having jurisdiction, resolved per site* — which
is also the honest answer, because which fire authority applies depends on the address and
cannot be known from the requirement row.

**That is the same fact that drives §20 and `TODO.md` 1.6.** Two plants of one company can
sit under different fire authorities, so a `local` row cannot be resolved at company level at
all — it resolves per site or not at all. The fire code is where multi-facility stops being a
convenience and becomes a correctness requirement, and it is the first place in the library
where a company-wide answer is simply wrong.

**006 creates both types and converts neither column**, because the six rows still have to be
edited. The conversion goes with the data pass.

### 21.3 `obligations.status` follows the spec: four states

**Decision: `applies | does_not_apply | undetermined | unknown`. The spec wins over the
code, because `CLAUDE.md` §3.2 is a safety property and the code is not.**

**Renamed from `satisfied` to `applies` the same day, before anything used it.** The four
states answer **one** question — *does this apply to me?* Naming a state `satisfied`
answers a different question — *have I done it?* — and mixing the two in one column is
exactly what produces a false green. Whether an obligation is satisfied is a **join against
`obligation_evidence`, never a column**, and the original name invited every future reader
to skip that join. It also fixes the pairing: `applies` / `does_not_apply` is a clean
opposition, where `satisfied` / `does_not_apply` was two axes wearing one name.

**Reasoning.** Three vocabularies exist today and no two agree:

| Where | Values |
|---|---|
| The data | `missing` 249 · `unconfirmed` 127 |
| `app/api/obligations/route.ts` | `missing`, `at_risk`, `expiring_soon`, `satisfied`, `not_applicable` |
| `CLAUDE.md` §3.2 and the design | `unknown`, `does_not_apply` |

`unconfirmed` is **34% of every obligation row** and appears in neither the code nor the
spec, so it falls through a `|| 9` fallback and sorts silently to the bottom of the
requirements list. It maps to `undetermined`.

`at_risk` and `expiring_soon` are dropped. They are **derived from evidence expiry, not
stored states** — computing them from `obligation_evidence.valid_until` gives one answer;
storing them gives two answers that drift apart the moment a certificate lapses and nothing
re-runs. `CLAUDE.md` §3.2 requires expired evidence to fail a requirement in code, and a
stored `at_risk` flag is exactly the stale copy that lets it pass.

`not_applicable` (code) and `does_not_apply` (spec) are the same state. The spec's name
wins because §3.2 is written in those words: *"`unknown` never resolves to
`does_not_apply`."*

**The two rank maps in `/api/obligations` change with it, and must be derived from the
generated enum rather than hand-written**, so that a future rename is a compile error rather
than a silent re-sort. Hand-written maps are how `unconfirmed` came to sort last without
anyone noticing.

**`missing` is not a status, and that is why it had no mapping.** It describes an obligation
that **applies and has no evidence** — which is `satisfied = false`, and that is a **query
over `obligation_evidence`, not a stored state.** Storing it duplicates a fact the evidence
table already holds, and a duplicate of a derived fact is a stale copy waiting to happen,
the same reason `at_risk` and `expiring_soon` are absent. The 249 rows map to `applies`
with no evidence rows behind them; 007 rebuilds them regardless.

**The boundary between `undetermined` and `unknown`, because they sound alike and are not:**

| State | Meaning | What can be done about it |
|---|---|---|
| `undetermined` | **We asked and could not resolve it.** The trigger condition is ambiguous, or it needs human judgment | **A dead end.** Nothing the product can ask will settle it — it needs a person |
| `unknown` | **We lack the input.** A switch the requirement depends on is unset | **A question we can put to the user.** Resolvable by asking, or by a document |

The distinction is operationally the whole point: `unknown` populates the switches screen
and the in-context asks, and it clears itself as documents arrive. `undetermined` never
clears on its own and must surface as an open question with a reason attached. Collapsing
them would either flood the user with questions that have no answer, or bury the ones that
do. **Neither ever resolves to `does_not_apply`** — `CLAUDE.md` §3.2, absence of evidence
never produces a clear.

**Why the rename was worth doing immediately rather than at 007.** The first draft of this
decision kept `satisfied`, and the flag against it was that 249 rows would then read
`satisfied` with no evidence behind them — so anything reading `obligations.status` without
joining `obligation_evidence` reports a false green. That is the omniscient status tracker
(`CLAUDE.md` §6) arriving through a column name rather than through a bad answer.

The cost of fixing it was one line in a migration that had not been applied. The cost at 007
would have been the same line plus every call site written against the old name in between,
and the cost after a customer sees a screen built on it is a conversation about why a
requirement said satisfied. **A name that invites a mistake is a defect, and it is cheapest
in the hour it is written.**

The rule that survives the rename: **satisfaction is a join, never a column read.**

### 21.4 `category` becomes obligation type: ten values

**Decision:** `permit | written_program | training | recordkeeping | monitoring |
reporting | physical_control | certification | credential | fees_taxes`

**Reasoning: the current 26 values are three different axes in one column.**

| Axis | Example values | Where it belongs |
|---|---|---|
| Subject matter | `Hazardous waste`, `Air emissions`, `Water` | `agency_id` — the regulator already implies the subject |
| Entity and cadence | the four `Per-` values (`Per-chemical duties`, `Per-person clocks`, …) — 19 rows | `entity_scope` and `cadence_type`, both already separate columns |
| **Shape of the duty** | `Registrations & permits`, `Written safety programs`, `Certifications` | **This, and only this, is what `category` should hold** |

What kind of thing you must *do* is the one axis that has no other home, and it is the axis
that determines what evidence satisfies the row.

**Tested against three other verticals before settling.** Cannabis, hospice and brewery fit
the same ten without forcing. Pre-approval regimes — cannabis label approval, brewery COLA,
TSCA premanufacture notice — are `permit` in type and `pre_approval` in cadence; the cadence
column already carries that distinction, so it does not need an eleventh type.

**`credential` is the tenth and is deliberately distinct from `certification`.** A credential
belongs to a *person* — a CDL hazmat endorsement, first aid/CPR, a cannabis worker permit.
A certification belongs to an *organisation* — ISO 9001, NACD Responsible Distribution. They
expire differently, they are evidenced differently, and when one lapses a different set of
people is affected.

**One category per requirement, and where that is impossible the row is under-decomposed.**
The silica standard is `training` and `monitoring` and `written_program` and
`recordkeeping` — which means it is four requirements written as one. Four cadences, four
evidence types and four ways to fail cannot share one status. **Splitting is the fix, not a
multi-valued column.** Splitting also lets each piece name its actual enforcing agency,
which they do not always share.

**Not part of 006: re-categorising and splitting the 188 rows.** That is chemical judgment,
done against a template by the owner. 006 creates the enum; the data pass follows, and
`requirement_templates.category` stays `text` until it is done.

---

## 22. Decisions taken during the requirements data pass — 10 September 2026

### 22.1 What `priority` means

**Decision: the test is what happens if this is missing when an inspector arrives.**

| Value | The business consequence |
|---|---|
| `critical` | **The business stops.** Licence revoked, plant shut, operations halted. |
| `high` | A fine, an enforcement action, or a finding at inspection. |
| `standard` | A real obligation whose lapse is procedural. |

**Reasoning.** The column has existed since the library was loaded and has never had a
written definition anywhere — not in the spec, not in the build plan, not in a comment.
Three values, 188 rows, no rule. It is also the **first sort key on the requirements
screen**, so an undefined column has been deciding what every customer sees at the top of
their list.

The test is deliberately about **consequence, not about how serious the rule sounds.** A
regulation can be important, well known, and heavily written about, and still not stop the
business if it lapses. What a customer needs at the top of the list is what closes their
doors, and that is a narrower set than what feels urgent.

**62 of 188 rows are currently `critical` — a third of everything. If a third is critical,
nothing is.** A ranking that flags a third of the list as maximum severity carries no
information and trains the reader to ignore it. Re-rating happens as part of the data pass,
against the definition above rather than against the impression each rule makes.

**Reversal condition:** if re-rating against this test still leaves a quarter or more of the
library `critical`, the test is not discriminating and needs a fourth value or a tighter
`critical` — not a re-interpretation of the same three.

### 22.2 `produces_switch` is a name, not a flag

**Decision: `produces_switch` holds the NAME of the switch a row determines.
`is_determination` stays as it is — the boolean.**

**Reasoning.** They answer different questions and both are needed. `is_determination` says
*this row determines something*; `produces_switch` says *what*. The resolution engine needs
the second, because determining a value is useless unless it knows where to write it back.
Collapsing them into one column would leave a boolean that flags 9 rows and no way to act on
any of them.

`produces_switch` **stays empty through this pass.** The switch library does not exist until
6.2, so there are no names to reference yet; filling it now would mean inventing identifiers
that the switch library then has to match. `is_determination` is carried across so the 9
rows stay findable when there is something to point them at.

### 22.3 `source` becomes `generated_by`, with two values

**Decision: rename `source` to `generated_by` and collapse `claude | gpt | gemini` to
`ai | manual`.**

**Reasoning.** The model name drives no decision. Nothing in the product treats a GPT row
differently from a Claude row, and nothing should: **trust is carried by
`verification_status`** — `generated | disputed | verified` — which is independent of origin.
A manual row can be unverified. An AI row can be primary-source verified. Origin and trust
are two axes, and only one of them belongs in a column that anything reads.

The rename also removes a live trap: `source` and `source_type` sit next to each other in the
same table with unrelated meanings and near-identical names. One is where a row came from,
the other is whether a government imposes it.

**The correction that goes with it, because the old column was being read wrongly.** The
174 / 11 / 3 split was recorded as evidence that the file was "substantially one enumeration
with two validators, not three independent generations." **That is wrong.** The merge was
**sequential, not competitive**: GPT generated first (174 rows), Claude ran next and added 11
GPT had missed, Gemini ran last and added 3 the other two had missed. All three lists were
merged. Nothing was chosen between, and no row was discarded in favour of a rival. The column
is a **build log** — which model first contributed a row the others lacked.

**What survives, and it is worth more than what it replaces: 174, then +11, then +3 is a
convergence signal.** Each additional model found dramatically less than the one before it,
and a curve that flattens that hard is evidence the enumeration is close to complete.

The evidence is **weak but real.** Weak because three models trained on overlapping corpora
can share a blind spot, and a requirement none of them knows about produces exactly this
curve too. Real because the drop is that steep: if substantial territory were missing, the
third model would not have found only three rows.

**That curve is the reason a fourth model was not run.** Expected yield is roughly one row,
and one row does not change a decision. The residual risk is the shared blind spot, and
another model of the same kind is the wrong instrument for it — that is closed by
primary-source retrieval against each agency's own published scope (§11, and
`CHEMICAL-OR-WA.md` §4.5), which is where the effort goes instead.

**Reversal condition:** if a customer or an inspection turns up a requirement none of the
three models produced, the convergence reading is weakened and the agency-by-agency retrieval
pass moves ahead of other library work.

### 22.4 `cadence_type` stays free text until the pass says what it needs

**Decision: leave `cadence_type` unconstrained through the data pass. It becomes an enum
afterwards, from the values actually used.**

**Reasoning.** The vocabulary is not known. `CHEMICAL-OR-WA.md` §2.2 offers
`one_time | annual | quarterly | monthly | on_trigger | maintain_current`, and the 188 rows
hold roughly 180 distinct prose cadences of a complexity that list plainly does not cover —
*"PHA every 5 years; audit every 3; refresher ≤3; incident investigation within 48 hours"*.

**An enum guessed before the work is an enum that gets fought.** The values reached for while
categorising 188 real requirements are better evidence for the vocabulary than a list written
in advance, and the cost of waiting is one migration. The cost of guessing wrong is either a
vocabulary nobody can express the data in, or a `other` value that swallows the hard cases —
which is the same as having no column.

`cadence` itself — the prose — is kept regardless and is never replaced by `cadence_type`.
It is 100% populated and irreducible.

---

## 23. Decisions taken building the six new tables — 11 September 2026

### 23.1 Multi-value switches decompose. No arrays, no jsonb.

**Decision: `substance_exposure_above_action_level` becomes one switch per substance —
`exposure_lead`, `exposure_benzene`, `exposure_silica`, `exposure_hexavalent_chromium`,
`exposure_formaldehyde`, and the rest. `company_switches.value` stays `text`.**

**Reasoning: they are not one fact.** Each substance has its own action level, its own
standard, and its own requirement set. Lead at 30 µg/m³ and silica at 25 µg/m³ are different
numbers in different regulations enforced on different schedules. Calling them one switch
because they share a sentence in a design document is a formatting observation, not a
modelling one.

**`applies_expression` is the test that settles it.** A requirement gated on lead exposure
has to say *"`exposure_lead` is true"*. With an array it would have to say *"one of the
values in this array is `lead`"* — which is a string search inside a column, in a resolution
engine whose entire purpose is that applicability is a deterministic query and never a
guess. Every requirement that gates on a substance would carry that search, and each one is
a place to get the matching subtly wrong.

**The switches screen settles it a second time.** `CHEMICAL-OR-WA.md` §6.4 shows one fact
per row, each with its own basis, confidence and "affects N requirements". *"Which
substances are you above the action level for"* is one question with fourteen answers, and
it cannot show a basis — the basis for lead is a lead air-sampling result and the basis for
silica is a different document entirely.

**It also makes switches map one-to-one with the rows they gate.** The fourteen substance
standards are already fourteen separate rows in `requirement_templates`. One switch each
means the gate and the requirement line up exactly, instead of fourteen requirements sharing
one switch whose value has to be unpacked.

**The count:** approximately 46 switches becomes approximately **59**. That is the real
number and always was; 46 was 45 plus one bundle.

**Reversal condition:** if a future switch genuinely has several simultaneous values that no
requirement ever reads individually — a list nothing gates on, kept only for display — then
an array column is right for that switch. It is not right for this one, and the test is
whether `applies_expression` ever needs to look inside.

### 23.2 `topics` is deliberately not built

**Decision: five of the six new tables are built in migration 008. `topics` waits.**

**Reasoning.** It is the only one of the six whose *shape* depends on an unresolved design
question rather than on unwritten code. `WORKSPACE.md` §9 lists five open questions and two
of them decide columns and constraints:

- **Concurrency** (§9.4) — one open topic per company, or several? One is a partial unique
  index on `(company_id) where status = 'open'`. Several is no index. This is not
  deferrable after the fact: if several are allowed and users create several, adding the
  constraint later means closing somebody's open work.
- **Summary format** (§9.3) — what is worth keeping once the transcript is gone. That is
  the content of the column that *is* the table's durable output.

It is also the furthest of the six from a caller: the Compliance Workspace is M1, the last
section of the plan, behind the determination gate, the critic pass, `company_switches` and
the resolution engine. Building it now locks in a guess that nothing will exercise for
months, and the usual cheap-now argument does not apply — there is no data to migrate around
later, because the table would be empty the entire time.

**Already decided for when it is built, so it is not re-litigated:** *"discarding the
transcript"* (§6.1) means **nulling the column and keeping the row**, never deleting the
row. A discarded transcript must still leave behind the fact that a topic existed, when it
closed, and why — otherwise "was this ever asked?" becomes unanswerable, and `close_reason`
(user closed it / a checklist closed it / inactivity closed it) reads very differently to a
user depending on which it was.

**Reversal condition:** the Workspace work starting. At that point both open questions get
answered by the people building the screen, which is the right moment for them.

---

## 24. The match key — 11 September 2026

### 24.1 The company's stated address is authoritative. A website scan never is.

**Decision: jurisdiction comes from `companies.state/county/city` and
`entities.state/county/city`. `companies.scan_result` is never read for it, by anything.**

**Reasoning, and it is not hypothetical.** The deleted `app/api/sync-obligations` read the
company's state from `scan_result->>'state'` — the output of an AI website scan — rather
than from the address the customer typed. Three things followed, and all three were live:

- **`scan_result` is null for 7 of 10 production companies.** For those the jurisdiction
  filter fell back to "federal only" and **silently dropped all 94 Oregon requirements**.
  Under `CLAUDE.md` §3.2 that is the safer direction — absence of evidence producing less,
  not more — but the customer is still told less than they owe with no indication.
- **The two sources already disagree on a real row.** `CB-Test 2` is Oregon by address and
  **Washington** by scan. It would have been matched against Washington, of which the
  library holds nothing, and received only federal rows.
- **A derived value silently outranked a stated one for months**, and nobody could see it
  happening, because the failure mode of a too-narrow filter is fewer rows and a 200.

**The general rule this earns: a value a person stated outranks a value a model inferred,
wherever both exist.** A scan is useful for *proposing* an answer — M7's teaching
confirmation is exactly that — but the thing resolution reads must be the answer the
customer has seen and accepted. That is also what makes a wrong jurisdiction correctable:
the user can fix an address; they cannot fix a JSON blob they have never been shown.

**Reversal condition:** none for the ordering. If a scan ever becomes the only available
source — a signup that captures no address at all — then the correct behaviour is an
**unknown** jurisdiction and an asked question, not a silent substitution.

### 24.2 The match key's implementation is Phase 4, not Phase 1 (TODO.md numbering)

**Decision: Phase 1 lands the match key's INPUTS. The rule itself is written down now and
implemented in Phase 4.1, inside the resolution engine.**

**Reasoning.** Phase 4.1 is *"jurisdiction + switches + library version → obligations,
deterministic"*. The match key is three-quarters of that sentence, and 4.4 makes *"state X
never receives state-Y requirements"* a required test **of the engine**. Building it in
Phase 1 means building it against an engine that does not exist and then building it again.

**It belongs in code as a pure predicate, never as a SQL filter.** §3.2 requires resolution
to be deterministic and computed in code; a predicate can be tested without a database; and
a too-narrow SQL filter fails by **returning fewer rows with a perfectly good 200**, which
is precisely how the original defect survived for months. Load candidates with a
deliberately broad query, narrow in tested code, so that a wrong query errs toward a
superset where the code catches it.

**What Phase 1 landed instead:** jurisdiction columns on `entities` (migration 009), which
made `local` and `city` resolvable at all — they were unresolvable for every company
because a site had no way to say where it was; the source-of-truth decision above; and the
complete six-case rule in `CHEMICAL-OR-WA.md` §3.2, so Phase 4 inherits it.

**Still missing, and named so it is not forgotten:** signup hardcodes `county: ''` and
never asks. `jurisdiction_layer = 'county'` is a value the rule must serve, so until the M7
signup rework captures a full address, no county-scoped requirement can resolve for anyone.

**Reversal condition:** if resolution turns out to need a database-side filter for
performance — it will not at a few thousand library rows — the predicate stays the
definition and the SQL becomes an optimisation that must be a proven superset of it.

---

## 25. Where jurisdiction comes from — 11 September 2026

**Recorded, not built.** The implementation belongs to M7, where signup is reworked.

### 25.1 State, county and city come from geocoding the address

**Decision: geocode the address. Not AI, and not the user typing a county name.**

The **US Census Bureau Geocoder** does this with **no API key and effectively unlimited
use**, returning the matched address, city, state, state FIPS, county and county FIPS. It
is the authoritative source for exactly this question, and it is free.

**Why not AI.** This is a lookup with a **known correct answer**. A model would be right
most of the time and wrong occasionally, **with no signal on which** — and jurisdiction is
the match key. A wrong county silently changes which requirements apply, which is the
failure mode this product exists to prevent, arriving through the one field that decides
everything downstream. `CLAUDE.md` §3.3 is the general form of this: the model reasons well
against an artifact and enumerates unreliably from nothing. An address lookup is not
reasoning against an artifact; it is a database query someone else already runs.

**This is stronger than §24.1, and supersedes its ordering for these three fields.** That
decision said a stated value outranks an inferred one. This one says: **a deterministic
lookup against an authoritative source outranks both.** A customer typing "Washington
County" is a stated value and can still be wrong — people mistype, and people in Portland
routinely do not know which of three counties their address falls in.

**The failure path is part of the decision and must be built.** Census downtime is common
enough that commercial geocoders market themselves specifically against it. So:

> **A geocode failure leaves jurisdiction UNKNOWN and asks. It never silently substitutes.**

Same rule as a missing address (§24.1's reversal condition). An unknown jurisdiction means
the state- and county-scoped requirements show as **undetermined** — open questions with a
reason — rather than resolving against a guess. A retry, a queue, and a visible "we could
not confirm your county" are all acceptable; quietly falling back to what the user typed,
or to a model, is not.

**Reversal condition:** if the Census Geocoder's match rate proves too low for real
customer addresses — rural sites and new construction are the usual gap — the answer is a
second authoritative geocoder as a fallback, not a model. The rule is authoritative source
or unknown.

### 25.2 Fire authority is asked, not derived

**Decision: ask the user. One field, at onboarding.**

**Geocoding does not solve this, and the three `local` fire-code requirements depend on
it.** Fire districts do not follow county or city lines. **Tualatin Valley Fire & Rescue
spans Washington, Clackamas and Multnomah counties** — so knowing a site is in Hillsboro,
Washington County, Oregon does not tell you who inspects it. That is precisely why
`entities.fire_authority` exists as a **fourth independent fact** alongside state, county
and city, rather than being derived from them.

**Why asking is right here, when it is wrong for the other three.** The user knows the
answer with high confidence and can give it instantly: **a fire marshal has visited them.**
Their inspection reports have a letterhead. This is the rare compliance fact where the
customer is the authoritative source, and asking costs one field.

**Do not infer it with AI.** Fire district boundaries are exactly the fact class that goes
stale and gets confidently wrong — districts merge, annex and redraw, and a model trained
on a 2023 corpus will state a 2019 boundary with full confidence. `CLAUDE.md` §6 lists
this class as needing a verification badge; a field with a badge that nobody checks is
worse than an empty field that asks.

**When it is unknown, the three `local` requirements show as undetermined.** They do not
resolve against a guessed authority, and they do not silently disappear. Undetermined is
the honest state and it is already what `obligation_status` is built for (§21.3).

**Two options rejected, and why:**

| Option | Why not |
|---|---|
| **A curated per-metro lookup table** | Accurate where it is built and **silent where it is not** — a company outside a covered metro gets a confident empty answer, which is indistinguishable from "no fire authority applies". The failure is invisible, which is the disqualifying property. It may earn a place later as a *suggestion* the user confirms, never as a source of truth. |
| **AI with web search** | Belongs to the `verification_flags` class — a generated answer needing primary-source confirmation before anything relies on it. Putting it in the match key means the flag is never seen, because resolution does not read flags. If it is worth searching for, it is worth the user confirming, and the user already knows. |

**Reversal condition:** a customer with many sites for whom asking per site is genuinely
burdensome. Then a lookup table becomes worth building — as a **pre-fill the user
confirms**, with unknown still meaning unknown.

---

## 26. The invite flow is a module, not a floating feature — 11 September 2026

**Decision: user management becomes `MODULES` M8 — Account. It was sitting between Phase 0
and Phase 1 (TODO.md numbering), belonging to neither and scheduled by nothing.**

**Reasoning.** It has no dependency on any phase — §19 established that it needs no
migration, because several people at one company already works on `profiles.company_id`.
Something that depends on nothing cannot be ordered by its dependencies, so it was never
next, and a thing that is never next is never built.

Placing it as a module makes it comparable to the other seven: it competes for a slot on
value rather than drifting because nothing blocks it. That is also the honest reading of
§17.4 — it was deferred because it is not the most valuable week available, which is a
judgement that should be re-made against a list rather than assumed each time.

**Account is a new module, and the eighth.** There was no Account module to add it to; the
existing `/api/account` and `/api/account/export` work and are verified, so M8 is
substantially this one feature plus whatever that pair accumulates.

**The cost of waiting is recorded in M8.2 rather than left implicit**, because it is the
kind of cost that is invisible until it is permanent: shared logins are accepted, every
write records one person's id regardless of who acted, and **records created that way stay
ambiguous forever.** Shipping the invite flow later fixes every subsequent row and no
earlier one. So the price of deferring is not a late feature — it is a window of the
customer's history that cannot be reconstructed, in a product whose value is the
reconstruction.

**Reversal condition:** the first customer who needs two named people with separate
accountability. §17.4 already names that as the trigger, and it is not a nice-to-have
request — it is the product's core claim.

---

## 27. How the product speaks when something fails — 11 September 2026

**Decision: every message the user sees is polite, plain, and honest about whose problem it
is. The operative rule lives in `CLAUDE.md` §5.1, beside the error-handling rules it
extends.**

- When the failure is the product's — a file it cannot read, a service that did not
  respond, a parse that failed — **say so plainly and never imply the user did something
  wrong.**
- **Never assert anything about a document the product did not successfully read.**
- **Always tell the user what they can do next**, if there is anything.
- **Error messages, empty states and refusals alike.** An empty state is a message.

### Why in `CLAUDE.md` §5 and not §3

§3 holds the non-negotiables about **code**: secrets, the security boundary, migrations,
the AI call site. This is a rule about **what the product says**, and §5 is already the
error-handling section — *"never silent"*, `response_message` in plain language always
written on success and failure, `error_message` technical. §5.1 is the tone-and-ownership
half of the rule §5 already half-states. Filing it under §3 would separate it from the
mechanism it governs.

It is in `CLAUDE.md` at all, rather than only here, because that file is read at the start
of every session and this needs to be in the room while the message is being written — not
looked up afterwards. This section holds the reasoning; that one holds the rule.

**`WORKSPACE.md` §10.8 is the same rule, scoped.** It works out per-case wording for the
three signup-scan failures and opens with *"two of these are the product's problem, not the
user's, and should not read as the user failing."* §5.1 generalises it; §10.8 stays the
worked pattern. Neither duplicates the other.

### The worked example, and why it is worth keeping

> `alert('No compliance dates found in this file. Make sure it contains deadline or expiry dates.')`

Shown by `/calendar` for a document that `/api/extract-dates` had **rejected before any
date-finding ran.** In one sentence it:

1. **asserted a fact about contents nobody had read** — there may well have been dates in it;
2. **implied the user's file was the problem**, when the product's own format support was;
3. **told them to go and check something that was never the cause.**

**The cause was structural, not careless wording.** "No dates in it" and "could not read it"
came back as an identical empty array, so the caller *could not* tell them apart — the
honest message was unavailable at the point it needed to be said. That is the general shape
of this failure: **a message lies because the data behind it cannot express the truth.**

So the rule has a design consequence, not only an editorial one: **when a call can fail in
ways that need different things said, the response has to carry which.** Fixed 11 Sep by
adding `extraction_failed` with a `reason`, and by giving the generic `catch` its own
`reason: 'extraction_error'` so "something broke at our end" is distinguishable from both
the others.

**Reversal condition:** none. If following it ever produces a message that is accurate and
useless — "something went wrong, there is nothing you can do" — the answer is to make the
failure actionable, not to soften the message into a claim that is not true.

---

## 28. What actually feeds a document prompt — 11 September 2026

**Decision: one shared parser, `lib/documentContent.ts`, feeds every route that sends a
document to the model. Excel, CSV, text, Word and PowerPoint are converted to text and
sent. Formats that cannot be read produce a described failure, never a silent omission.**

This is a `CLAUDE.md` §3.1 change — *"what data or context feeds a prompt"* — and it is the
largest one this project has made. It is recorded here because §3.1 says such changes are
discussed first, and because the two findings behind it are worth more than the fix.

### 28.1 `/api/chat` answered from the filename alone

For every upload that was not a PDF or an image, the route fell through to:

```js
messageContent = 'File name: ' + fileName + '\n\nUser question: ' + userQuestion
```

**The document's contents never reached the model.** The answer came back confident,
well-formatted and built from a filename.

**What makes this more than a missing branch: the file pickers actively offered those
formats.** `/compliance` offered `.xlsx .xls .csv .doc .docx`; `/upload` offered
`.xlsx .xls .csv`. A user was invited to upload a spreadsheet, did so, asked a question
about it, and was answered by a model that had been told only what the file was called.
Nothing in the product said otherwise. The fallback branch was the oldest code in the
route and had simply never been revisited when the pickers were widened.

**The general shape, which is the part to carry forward: an `else` branch that produces a
plausible result is more dangerous than one that throws.** A throw gets found on the first
test. A plausible result gets found when somebody wonders why an answer about a
spreadsheet never mentions anything in the spreadsheet.

### 28.2 `/api/hr` excluded `.docx` and blamed the format

`/api/hr` accepted PDFs and images only. Everything else was refused with:

> *"…which cannot be read here. Only PDFs and images can be. Re-upload it as a PDF."*

**The parsers existed the entire time.** `/api/extract-dates` had been reading Word, Excel,
CSV and PowerPoint for as long as `/api/hr` had been rejecting them, and `/api/audits` read
Word and PowerPoint successfully. The restriction was a **workaround for one specific bug**
— a `.docx` had once been base64'd and labelled `image/jpeg`, which produced confident
nonsense — and the workaround was then written into the code comment as though it were a
property of the format.

**Most handbooks are `.docx`.** So the HR module's core input was the one thing it refused,
the user was told their file was unreadable, and the true cause — a mislabelled upload,
fixed long ago — was invisible. A workaround that is documented as a limitation stops
looking like a bug and starts looking like a design.

**The rule this earns:** when a format, a feature or a case is disabled as a workaround,
**record it as a workaround with the cause**, not as a property of the thing disabled. The
comment is what tells the next person whether to fix it or respect it.

### 28.3 Four copies of the same branching, no two alike

`/api/chat`, `/api/audits`, `/api/extract-dates` and `/api/hr` each carried their own
version. `extract-dates` read five formats, `audits` four, `hr` two, `chat` effectively two
with a silent fallback. **Four copies is four chances to disagree, and they took all four.**
`lib/documentContent.ts` is now the only implementation; `lib/acceptedFiles.ts` holds the
picker list so the three file inputs cannot drift apart again.

`text/plain` is new — it existed in none of the four, which is why a `.txt` reached the
model as a filename and nothing else.

**Reversal condition:** if a format proves to parse badly enough to be worse than refusing
it — a scanned PDF-in-Word, say — it may be removed from the accepted list. It must then be
removed from `ACCEPTED_FILE_TYPES` too, so the picker stops offering it, and the reason
recorded here. Disabling it in the parser alone recreates §28.1 exactly.

---

## 29. An unmatched requirement is a library candidate, not a new version

**Decision, 11 September 2026: when the pipeline produces a requirement that is not in the
library, it is written to `library_candidates`. It is NOT written to
`requirement_templates` as a new row, and it is NOT written as a new version of an
existing row.**

**Reasoning.** The two look similar and mean opposite things.

**A version** (`version + 1`, `supersedes_id`, `effective_to` on the old row) asserts that
**the law changed** — that a rule we had recorded is now superseded by a different rule. It
is a claim about the world, it goes into the match key, and an audit pinned to a version
stays reproducible against it (§3.2).

**A candidate** asserts only that **a model said something we do not have a row for.**
That is a statement about our coverage, not about the law. It has no citation anybody has
checked, no jurisdiction anybody has confirmed, and no verification status a person has
set.

**Writing a candidate as a version would put unverified model output into the library
under a version number**, where the versioning machinery would then treat it as
authoritative: it would resolve into obligations, appear in a customer's requirement list,
and be indistinguishable from a row somebody had actually verified. That is the omniscient
status tracker (`CLAUDE.md` §6) arriving through the back door of a schema field.

`library_candidates` exists precisely so the pipeline has somewhere honest to put these:
`times_seen` counts how often one is produced, `normalized_name` dedupes across phrasings,
and the queue becomes usage-ranked demand research (§6). A candidate becomes a
requirement only by a person promoting it — `promoted_to_requirement_id` records when that
happens.

**Reversal condition:** none for the direction. If promotion ever needs to be automatic —
it should not — the gate is `verification_status`, never the absence of a check.

---

## 30. A customer-facing "what changed" view is M6 work, not pipeline work

**Decision, 11 September 2026: the diff a customer sees — what changed in their
obligations since last time — belongs to M6 (Dashboard). It is not part of the resolution
engine and must not be computed at resolution time.**

**Reasoning.** The data to answer it already exists once Phase 1's columns are populated.
`obligations` carries `applicable_from` and `applicable_to`, so "what became applicable"
and "what stopped applying" are a query over a date range. `obligation_evidence` carries
`valid_until`, so "what expired" is another. Nothing needs to be computed and stored at
resolution time, and storing it would be a derived copy — the same mistake §21.3 rejected
for `at_risk` and `expiring_soon`.

**Why M6 and not Phase 4.** Resolution's job is to produce the current list, deterministically
(§3.2). A diff is a *presentation* of two states of that list. Putting it in the engine
would give the engine a second responsibility and a reason to keep history in a shape
convenient for display rather than for correctness.

**What M6 must get right when it is built:** the diff is the honest half of the dashboard.
A number that only climbs is a progress bar; **"three things became required this month and
one certificate expired" is the sentence a customer actually needs**, and it is only
possible because obligations are never deleted (§3.2) and carry a validity window.

**Reversal condition:** if the query proves too slow to run per page load at real data
volumes — unlikely at a few hundred obligations per company — the answer is a materialised
view or a cache with an explicit staleness window, not a column written by the resolution
engine.

---

## 31. The two plans keep their separate phase numbering — 11 September 2026

**Decision: `TODO.md` and `BUILD-PLAN.md` are NOT renumbered. The mapping table at the top
of both stays, and is the fix.**

They agree on Phase 0 and Phase 4 and on nothing else. Most sharply, **phases 1 and 2 are
swapped**: `TODO.md` Phase 1 is the schema rebuild and `BUILD-PLAN.md` Phase 2 is; `TODO.md`
Phase 2 is the runtime pipeline and `BUILD-PLAN.md` Phase 1 is.

**Reasoning — three things, and the third is the one that decided it.**

**The risk is flagged, at the top of both files, and has misled no one.** The mapping table
is the first thing either document shows, above the gate in one and above Part A in the
other. Every phase reference written since has been correct.

**`BUILD-PLAN.md` alone carries 53 `Phase N` references**, and `TODO.md` and this record
carry more. Renumbering means rewriting all of them and every cross-document citation that
points at them. The mapping is one table read once; the churn is a few hundred edits, each
of which can be wrong.

**A renumbering pass during Phase 2's checkbox work is exactly where reference errors get
planted.** Phase 2 is the runtime pipeline — dozens of items ticked off across both files
over days. Doing a global renumber in the middle of that means every edit lands in a
document whose numbering is in motion, and a reference typed against the old scheme reads
as valid. `DECISIONS.md` §15.8 records the same failure from versioned filenames: renaming
breaks every reference silently, and silence is the problem.

**Reversal condition — and it is a real one, not a formality: unify them the first time the
mapping actually misleads somebody.** Not the first time someone finds it awkward. A wrong
phase acted on, a task started in the wrong document, a reference written against the wrong
scheme — any of those, and the churn becomes worth paying. The table's whole justification
is that it works; if it stops working it has no other defence.

**Interim mitigation applied the same day:** the ambiguous bare `Phase N` references in this
record are tagged `(TODO.md numbering)` so a reader need not resolve them from context.
Records written before the two schemes diverged in usage all meant `TODO.md`'s.

---

## 32. Washington agencies wait for the Washington library — 11 September 2026

**Decision: Phase 2.1 loads Oregon and federal agencies only. None of
`CHEMICAL-OR-WA.md` §1.4's Washington regulators — L&I/DOSH, Ecology, Revenue, the
rest — goes into `agencies`, and therefore none appears in `industry_coverage`.**

**Reasoning, and it cuts against the table's own default.** `industry_coverage` exists to
show gaps: a `not_built` row for an agency we have not covered is the honest, useful row,
and §1.1's second job — "a thinly-covered agency in a known list is a visible gap" — argues
for loading every regulator we can name, covered or not. By that reasoning Washington
belongs in.

It does not, for one reason: **the coverage strip's job is showing gaps in what we are
trying to serve.** The library holds 93 Oregon state rows and **zero** Washington rows, and
no Washington library is scheduled this quarter. A dozen permanently-`not_built` Washington
rows would make the strip longer without making it truer — the reader learns "we have not
built Washington", which they already knew from the fact that Washington is not sold. A gap
is only information when somebody was expecting the thing to be there.

**Reversal condition — specific and near: they go in the day the Washington library starts.**
Not when a Washington customer signs up, not when §1.4 is reviewed. The moment the first
Washington requirement row is written, its regulator must already exist as a row or the
requirement has nowhere to point, so the agency load is the first step of that work rather
than a follow-up to it.

**One thing to carry forward when that happens.** §1.4 records that Washington is a State
Plan state like Oregon, that its dangerous-waste program under WAC 173-303 is *broader than
federal RCRA*, and that its PSM rule is not a copy of 29 CFR 1910.119. Those are row-level
facts belonging in each Washington agency's `notes`, exactly as the Oregon State Plan fact
sits on the `OR-OSHA` row rather than in a prompt template (`CLAUDE.md` §7).

---

## 33. A CFR title is not an agency — the part is. A near miss, 11 September 2026

**What happened.** The Part C mapping table assigned a regulator to each of 194
requirements from the pair `(jurisdiction_layer, citation)`. One of its rules read
`federal + "29 CFR" → OSHA`. It was reviewed, approved, and wrong.

**Title 29 is the whole of Labor, not OSHA.** OSHA occupies parts 1904, 1910, 1915, 1917,
1918, 1926 and 1928. The rest of the title is other agencies entirely:

| 29 CFR | Belongs to |
|---|---|
| part 516 | wage and hour — **DOL** |
| part 825 | FMLA — **DOL** |
| part 2520 | ERISA reporting — **DOL** |
| part 1602 | EEO-1 — **EEOC** |
| part 1636 | Pregnant Workers Fairness Act — **EEOC** |

**Six requirements would have been filed under the Occupational Safety and Health
Administration**: the FLSA, the FMLA, ERISA, Title VII, the PWFA and EEO-1 reporting.

**Why it would not have been caught.** *A requirement under a wrong agency looks entirely
normal.* Nothing complains. The foreign key is valid, the row renders, the count is right,
`npm run check` passes, and no constraint in the database expresses "the FMLA is not an OSHA
rule." The failure surfaces only at Stage 2, where the agency frame bounds what the model is
asked to enumerate — so a chemical company asking about workplace safety would have been
served ERISA obligations under the OSHA heading, and a question about family leave would
have found nothing under Labor. **It is silent in exactly the way `CHEMICAL-OR-WA.md` §1.1
says agency framing is supposed to prevent.**

**How it WAS caught, and this is the transferable part.** The mapping was **projected over
all 194 rows read-only, and the result read agency by agency, before a single row was
written.** The projection showed six employment statutes sitting under `OSHA`, which is
visible in one line of output and invisible in a rule that looks right. The same pass caught
a second error — a Paid Leave rule swallowing a BOLI posters requirement.

**Two rules follow.**

**1. A CFR title is not an agency; the part is.** Any rule keyed on a bare title —
`29 CFR`, `21 CFR`, `40 CFR`, `49 CFR` — is wrong unless the title happens to have one
occupant. 49 CFR is DOT but splits: parts 100-185 are PHMSA, 350-399 are FMCSA. 21 CFR
covers both FDA and DEA. Write the part.

**2. Project before assigning, and read the projection by target rather than by count.**
"187 of 194 assigned" was true of the broken mapping and of the fixed one. The error was
only visible in *which rows landed where*. A total is not a check.

**Reversal condition:** none. This is a finding, not a preference. The narrower rule costs
nothing — rule 21 now matches zero rows, because every piece of OSHA content in this library
sits on an Oregon row, and that is a true fact about the library rather than a broken rule.

---

## 34. Correction to §4: the schema did not lack a question slot — it had the wrong kind

**Decided 11 September 2026. §4's account of the 2.5L root cause is wrong in a way that would
have produced the wrong fix.**

**What §4 says.** Root cause 1: *"Output schema foreclosed the right answer. No slot for 'I
need one more fact first.' A model asked to fill a checklist fills the checklist."*

**What is actually in the schema.** `prompts/checklist.ts` has carried a question slot the
whole time:

```
"follow_up_questions": [
  "A specific follow-up question that would make this checklist more tailored to their situation"
]
```

And `SUBSTEPS_PROMPT` carries another — a per-step `is_determination` flag with a
`clarifying_questions[]` array beside it.

**So the fix §4 implies — "add a question array" — was already done, and the failure happened
anyway.**

### 34.1 Additive and alternative are different things that look the same in a schema

Both are *a place to put a question*. They mean opposite things.

**An ADDITIVE slot sits after the answer** and means *"produce the checklist, then suggest
refinements."* `follow_up_questions`' own description says so: questions that *"would make
this checklist more tailored."* Substeps is sharper still — its questions are asked **after
the step has been written**, which is the gate inverted.

**An ALTERNATIVE slot replaces the answer** and means *"do not produce the checklist; this is
what I need first."*

A model filling an additive slot has already written the checklist by the time it reaches the
question. **The second half of the sentence cannot undo the first half** — that is root cause
2, autoregressive lock-in, and an additive question slot feeds it rather than fighting it.

**The one gate-shaped output in this codebase was built for something else.**
`auditClassifyPrompt` returns `type: "needs_clarification"` with a single
`clarifying_question`, and `app/api/audits/route.ts` short-circuits on it. That is Stage 1 in
miniature, arrived at accidentally while classifying audit requests — and it is the shape 2.2
generalises rather than invents.

### 34.2 The fix is a discriminated union, not a field

`outcome: 'ask' | 'answer'`, mutually exclusive at the top level. Not `ask` alongside
`must_do`: a model that populates both produces a checklist with a question above it, which is
the 2.5L failure with a banner on it.

**And `follow_up_questions` and `clarifying_questions` are REMOVED rather than left in place.**
Two places to put a question, with different meanings, means the model uses both. The
`needs_clarification` path in `auditClassifyPrompt` stays until the gate is wired into
`/api/audits`, then collapses into it — removing it first would leave that route with no gate
at all.

### 34.3 The transferable lesson

**When a schema permits the wrong answer, the fix is usually removing a field rather than
adding one.** The same move appears twice more in the gate spec: the checklist path gets **no**
`conditional_on` field, so hedging becomes unrepresentable rather than discouraged; and `ask`
is an **object** rather than an array, so the one-question cap is structural rather than
instructed.

Each is the same idea — *make the wrong output impossible to express* — and each replaces an
instruction a model under pressure can reinterpret. `DECISIONS.md` §27 reached the same
conclusion from the other end: when a call can fail in ways needing different messages, the
response must carry which, because a shared empty result makes the two indistinguishable.

**Reversal condition:** none for the union. If a genuine need appears for an answer that also
asks — it should not — it is a second request, not a second field.

**What §4 keeps.** Its other three root causes stand unchanged, and its governing principle —
excellent against an artifact, unreliable from nothing — is the most load-bearing sentence in
this record. Only the first root cause is restated.

---

## 35. Two corrections to the determination-gate spec, both found by building it

**11 September 2026. Both errors were mine, both were in `DETERMINATION-GATE.md` v1, and
both were caught between writing the spec and finishing the code.**

### 35.1 The `/api/chat` authentication closes ONE route, not four

**What the spec said:** adding `requireCompany()` to `/api/chat` "closes four of the six
routes named in `TODO.md` §0.8b as a side effect."

**What is true:** §0.8b names six routes with no session check. Two — `/api/industries` and
`/api/signup` — are **documented deliberate exceptions** (§0.9), because both serve the
pre-login signup page. That leaves **four undocumented**: `/api/chat`, `/api/extract-dates`,
`/api/feedback`, `/api/scan-website`. This work closes **`/api/chat`. One of four.**

**Still open, and worth naming rather than leaving inside a corrected count:**
`/api/scan-website` still takes a URL from an unauthenticated request body and fetches it
plus sixteen guessed subpaths — the blind SSRF in §0.8b. `/api/feedback` still interpolates
caller input straight into an HTML email body with no escaping, and still sends from the
project's Resend account. `/api/extract-dates` still takes an anonymous model call.

**Why it matters beyond the arithmetic:** the instruction that followed said "verify the four
§0.8b routes it closes", which is my error propagating into somebody else's plan. **A wrong
count in a security record reads as progress and is the kind of thing nobody re-derives.**
`AUDIT-CHECKS.md` check 11 exists for exactly this class — every count a document asserts,
re-measured — and this is its first live example.

### 35.2 The gate could not see where the worksite is — and only the PROCEED test would have caught it

**What the spec said the gate reads:** the question, the uploaded document, `company_switches`
for established facts, and `switches` for the vocabulary. It listed `requirement_templates`
as deliberately excluded and argued that case at length.

**What it omitted:** `entities`. **Jurisdiction — state, county, city — is not in
`company_switches` and never will be**, because it is a property of a *site* rather than of a
company (§20), and it has lived on `entities` since migration 009.

**The consequence, had it shipped:** the gate would have asked *"where is your worksite?"* —
a fact **migration 010 guarantees every company already has**, and one that §25 says comes
from **geocoding rather than from asking**. That is `DETERMINATION-GATE.md` §7's persistence
failure — the gate asking for something already established — arriving on day one, for **the
single most frequently determining fact in the product**. Jurisdiction is in the match key
for every requirement the library holds.

**How it was caught, and this is the part worth keeping.** It was not caught by review, by
typechecking, or by the acceptance test. **It was caught by writing the second golden case —
the one that proves the gate does NOT ask when it should not.**

Case 001 tests the ask direction. It passed with the bug present, and would have kept
passing: a gate that asks too much still asks for the SDS. **Only a case asserting "this
question must NOT produce a question" could surface a gate that asks for something it already
knows.**

> **Testing only the direction you are building for finds nothing about the direction you are
> not.**

The 2.2 work was entirely about making the product ask. Every instinct while building it was
pointed at the ask path: the prompt, the schema, the card, the round trip, the acceptance
criterion inherited from `DECISIONS.md` §4. The proceed path was the afterthought — and it
was the only thing that could find this.

**The general form, which applies well beyond this gate:** where a feature exists to make
something happen, the test that matters most is usually the one asserting it does *not*
happen in the ordinary case. A spam filter is tested by the mail that must arrive. A gate is
tested by the question it must not ask. `TESTING.md` (c) says the same thing about
consistency probes — *both answers cannot be right* is checkable without knowing which is.

**Reversal condition:** none. Both are corrections of fact. The standing rule is the second
one: **every gate-like feature gets a negative case in the golden set, written at the same
time as the positive one, not afterwards.**

---

## 36. The switch list was written before the library, and the library wins — 11 September 2026

**`CHEMICAL-OR-WA.md` §2.4 proposed 46 switches. Reading all 188 `trigger_condition` prose
strings in `requirement_templates` found that the list is wrong in both directions.**

| | |
|---|---|
| Requirements expressible with §2.4's list (+ §23.1's substance split) | **140 of 188** |
| Requirements needing a fact no switch covers | **48** |
| §2.4 switches no requirement uses | **6** |
| Facts needed that §2.4 has no switch for | **30** |

**The shape of the gap matters more than the count. Two whole classes were missing:**

**The equipment layer.** The library holds **23 requirements with `entity_type = 'equipment'`** —
forklifts, cranes, slings, ladders, fall arrest, sprinklers, extinguishers, alarms, emergency
respirators, hazardous piping. §2.4 proposed **not one switch for any of them.** They are the
cheapest facts in the whole list, mostly answerable by walking the floor, and they gate 23
requirements.

**The employment layer.** §2.4 was written for a chemical plant. The library carries a full
Oregon and federal employment layer — 16 BOLI rows, 6 DOL, 5 EEOC, plus IRS, USCIS, Paid
Leave Oregon, Workers' Comp and OregonSaves. Those need `has_employees`,
`nonexempt_employees`, `has_group_health_plan`, `sponsors_erisa_plan`, `federal_contractor`
and `uses_noncompete_agreements` — none a chemical fact, all required.

**Seeded: 90 switches.**

### 36.1 `employee_count` is a number, and bands do not merely lose precision

**§2.4 proposed bands: 1-10 / 11-19 / 20-24 / 25-49 / 50-99 / 100+.**

The trigger prose names **seven** distinct thresholds: **6, 10, 15, 20, 25, 50, 100.** A band
can only answer a threshold that falls on a band **boundary**. Three do not:

| Threshold | Falls | Gates |
|---|---|---|
| **6** | inside 1-10 | four Oregon accommodation and leave rows |
| **10** | inside 1-10 | the OSHA 300 log, the Emergency Action Plan, the Fire Prevention Plan |
| **15** | inside 11-19 | **the ADA, Title VII, and the Pregnant Workers Fairness Act** |

**A company in the 11-19 band is unresolvable against three federal discrimination statutes.**
That is not a rounding error — bands do not make the answer less precise, they make it
unavailable. `companies.employee_count` has been `integer` since migration 006, which
converted the text bands rather than inventing numbers from them.

**And it splits.** Oregon sick time reads *"10+ Oregon employees or 6+ with a Portland
location"* — enterprise and site in one sentence. WARN reads *"covered loss at a single
site"*. One switch cannot be both, so `employee_count` is company-scoped and
`site_employee_count` is site-scoped, and a row needing the site number names it in
`applies_expression`.

### 36.2 `naics_code` is not a switch

Five triggers turn on industry — TRI's "covered NAICS", the OSHA 300 log's "listed
industries" and "Appendix B", NESHAP subparts, categorical pretreatment. It still does not
become a switch. **`AUDIT-CHECKS.md` check 9 already names four free-text columns holding
industry strings with no shared list and no foreign key between any of them.** A fifth is
the wrong direction. It reads from `companies.industry` through
`determination_source = 'profile'`.

### 36.3 The six unused switches stay, and are marked

`multi_site` · `multi_state` · `owns_vs_leases_facility` · `hot_work_welding` ·
`spray_finishing` · `high_piled_storage`

Each carries **`SEEDED BUT UNUSED … DO NOT REMOVE AS DEAD WEIGHT`** in its `notes`, because
a future reader sweeping for unused rows would otherwise be right to delete them.

`multi_site` and `multi_state` become load-bearing the moment a customer has a second site or
crosses a state line, and migration 010 already gives every company a site row so the
structure is waiting. **The three fire switches are more interesting: they are the
`LOCAL-FIRE` coverage gap arriving from a second direction.** §1.3 names hot work, spray
finishing and high-piled storage as fire permit types; `LOCAL-FIRE` holds 3 library rows
against a much larger real scope (TODO 6.5a). The switches have nothing to gate because the
requirements were never written, not because the facts do not matter.

---

## 37. `aboveground_storage_tanks` is the inventory; the gallons are computed — 11 September 2026

**The dependency direction, and the check that makes it enforceable.**

Two switches each have a locally correct reason to depend on the other:

- `oil_storage_aboveground_gallons` cannot be known without knowing the tanks. → depends on
  `aboveground_storage_tanks`.
- The AST inspection requirement's trigger reads **"ASTs subject to SPCC"**, which argues
  `aboveground_storage_tanks` depends on the SPCC quantity. → depends the other way.

**Read in isolation, both are right. Together they cycle.**

**Decision: tanks are the INVENTORY fact and gallons are COMPUTED from it. One edge, one
direction.** The AST requirement's "subject to SPCC" condition belongs in
`applies_expression` — it is a condition on the *requirement*, not a dependency between
*facts*. A switch dependency answers "which fact do I need first"; you need the tanks first,
always.

### 37.1 No constraint can catch a cycle, so the loader does

`switches_no_self_dependency` checks `depends_on_switch IS DISTINCT FROM id`. **That stops
`A → A` and nothing else.** `A → B → A` satisfies every foreign key, satisfies that CHECK on
both rows, and is accepted by the database.

A cycle is not expressible as a CHECK — detecting one needs recursion and a CHECK sees one
row at a time. A trigger with a recursive CTE would work and would re-walk the whole graph on
every write; `switches` is written by exactly one thing. **So the check lives in
`scripts/load-switches.js`, walks the graph depth-first, reports the whole cycle rather than
"a cycle exists", and refuses the file rather than loading half of it.**

**Why a cycle is worse than it sounds:** it makes the graph unwalkable. Nothing can decide
which fact to establish first, so the determination gate would either loop or pick
arbitrarily — and picking arbitrarily is the failure that looks like working software.

**Proven by seeding one**, per `AUDIT-CHECKS.md`'s standard — `--prove-cycle-check` runs four
cases in memory: the real file (0 cycles), **the real pair reversed** (refused), a three-node
cycle (refused, showing it walks the graph rather than comparing pairs), and a four-deep
chain with no cycle (correctly allowed, so it is not just flagging depth).

---

## 38. Switch scope and volatility — three decisions and one recorded approximation

### 38.1 `exposure_*` is `annual`, not `static`

**`static` asserts that a fact does not change. Exposure changes whenever the process does.**
Every substance standard in the library mandates periodic monitoring — *"initial and periodic;
annual training; medical at least every two years"* — and **a lead result from four years ago
is not evidence of today's exposure.** Fourteen switches become things that expire, which is
the point: an expired switch reverts to `unknown`, and `unknown` is honest where a stale
`false` is a false green.

### 38.2 The scope flattening is a decision, not an oversight

**`requirement_templates.entity_type` has five values. `switch_scope` has two.**

| entity_type | rows | resolves to |
|---|---|---|
| `organization` | 98 | `company` |
| `chemical` | 27 | `site` |
| `person` | 27 | `site` |
| `equipment` | 23 | `site` |
| `site` | 19 | `site` |

**`person`, `equipment` and `chemical` all resolve to the site where they are.** This is
lossy and deliberate, and it is written down here so that a future session reads it as a
decision rather than as something nobody noticed.

**Where the loss actually bites: the 14 `exposure_*` switches.** Exposure is a property of
**a person doing a task** — the lead standard turns on whether *this worker* is above the
action level, not whether the site is. `switch_scope` cannot express that. Site is the honest
floor: "is anyone at this site above the action level" is weaker than the standard, and it is
the strongest thing the schema can hold. **Recorded rather than absorbed**, because the day a
customer asks why a warehouse worker is being asked about lead, this is the answer.

**Reversal condition:** if a requirement ever needs per-person resolution — a medical
surveillance roster, say — `switch_scope` gains a third value and `company_switches` gains a
person reference. That is a migration, not a workaround.

### 38.3 The scopes settled, and the two that moved

`owns_fleet` and `cdl_drivers` are **company**-scoped: a fleet is an enterprise asset and
FMCSA registration is enterprise-level. Per-vehicle facts belong to the equipment layer.

**`entity_county` is dropped entirely.** Migration 009 put the authoritative county on
`entities`, and a switch would be a fifth free-text place for a jurisdiction to disagree with
itself. The gate reads it from `entities` directly (§35.2).

**`outdoor_work` splits into `heat_exposure_area` and `wildfire_smoke_exposure`, and the name
was the bug.** §2.4 justified one switch as covering "heat and wildfire smoke rules". Oregon's
heat rule triggers on **"work area heat index reaches 80°F"** — *indoor areas included*. The
name `outdoor_work` encoded an assumption the rule does not make, and **a foundry with no
outdoor work would have been told the heat rule did not apply to it.** They are also two
separate rules with separate triggers and separate controls, and Washington's thresholds
differ from Oregon's on both.

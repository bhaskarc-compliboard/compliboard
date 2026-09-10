# CompliBoard — Decision Record

**Date:** 9 September 2026
**Status:** Decisions made. Supersedes conflicting statements in earlier planning documents.
**Companion documents:**
- `CompliBoard-Chemical-OR-WA-Vertical-Spec.md` — the full design (regulatory map, data model, runtime, display, verification, onboarding)
- `CompliBoard-Technical-Due-Diligence.md` — the honest baseline of what exists today
- `CompliBoard-Build-Plan-v1.md` — the step-by-step execution list

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
| `CompliBoard-Technical-Due-Diligence.md` | **Keep.** The honest baseline. Pricing ($199 vs $99) and HIPAA-in-UI inconsistencies still need resolving. |
| `CompliBoard-Chemical-OR-WA-Vertical-Spec.md` | **Keep.** The master design document. |
| `CompliBoardChemicalRequirementsMERGEDv2.xlsx` | **Keep.** Richest artifact — 188 rows, the 9-item VERIFY hit list, 26 switches, 18-row fixed-date calendar, and a `Layer` column that already encodes agency ("Oregon OSHA", "Federal DOT"). |
| `CompliBoardRequirementschemicalmanufacturing.xlsx` | **Keep until migrated.** Complementary, not redundant — normalised `jurisdiction_level` (95 federal / 87 state / 3 county / 3 contractual), `jurisdiction_state` (90 Oregon), `is_determination` (9 yes), `applies` (182 conditional / 6 universal), `source` (174 gpt / 11 claude / 3 gemini). Delete once loaded into the new schema. |
| `CompliBoard-Requirements-Module-Definition.md` | **Delete.** Fully absorbed into the Chemical OR/WA spec, which contains everything in it plus the regulatory map, runtime architecture, display, verification, and onboarding. Two overlapping specs will drift. |
| `CompliBoardRequirementTemplate.xlsx` | **Delete.** 18-column intake template superseded by a schema with ~15 additional fields (`applies_expression`, `scope_rules`, `agency_id`, `citation_url`, `citation_quote`, `produces_switch`, verification and versioning columns). Keeping it invites loading data in the obsolete shape. |

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

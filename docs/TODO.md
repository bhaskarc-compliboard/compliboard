# Detailed To-Do
**Version:** 34 · **Updated:** 22 September 2026
**Supersedes:** version 33 (21 Sep). **0.10 is ✅ BUILT** — `npm run db:restore`, one command, every
expected count read from a seed file and four production refusals each tested by violating it. **Its
first run REFUSED before touching anything**, and the reason is a real finding: the seed files
rebuild **194** of the library's **205** rows, because migration 013's three splits are a no-op
against the empty table the chain hands them, and `applies-expressions.json` carries expressions for
exactly the 11 children the worksheet lacks. **`DECISIONS.md` §98's owed reset for 029 and 030 is
therefore NOT settled.** Adds **6.3c — which source is the library**, the row
`013_chemical_inventory.sql:393` has named since 12 September and which did not exist until now.
Version 33: Adds **R1 — the open baseline** (`DECISIONS.md` §113): a
five-question benchmark against raw Claude and ChatGPT found CompliBoard weaker on most, so
research ships as **one open call** with the gate, facts block, frame/scenario blocks and long
prompt **switched off behind config**, and R&D builds back up one measured piece at a time. Records
**chat history as GATED** for the first release (§116) and **release timing as OPEN** (§117). The
schema is now a **generated document** — `docs/SCHEMA.md`, written by `scripts/schema-doc.js` from
the live catalog inside `db:migrate`. Version 32: **M1.2e is ✅** — the conversation is on screen: exchanges
stack oldest-first, the composer sits at the bottom and clears on send, the gate's question is a
message answered in the same box, and each answer keeps its own sources. M1.2d's turn machinery is
visible to a person for the first time. Version 31: **Item 6 is DECIDED** (`DECISIONS.md` §111): a checklist is a
**hybrid** — written by the AI but starting from the obligations that apply, matched items linked
so completing one counts on both sides, everything else a **labelled suggestion**. This resolves
**§68**, and its implementation stays on the before-real-customers list because 235 production
rows already exist. **Checklists are sequenced AFTER research** (§112), so the Create tab is
untouched by sequencing rather than by a blocker. Version 30: **M1.2d is ✅ — it was built and committed in `71c2a4d` and
this row was never ticked**, which produced a status report recommending work already done
(`DECISIONS.md` §65, twelfth). Adds **M1.2e — the chat layout**, which is what is actually
missing: no stacked conversation has ever existed in 296 commits. **M1.3a becomes FIFTEEN-DAY
RETENTION** (§110) rather than discard-after-processing, carrying three requirements — an enforced
day-16 deletion **with a check**, immediate removal on account deletion, and **real customer data**,
which makes the credential-rotation gate live. Version 29: **M1.3 is SUPERSEDED** (`DECISIONS.md` §108): conversational
fact extraction **moves overnight** and what it finds is **proposed, not written**. Replaced by
**M1.3a** (retain a conversation until processed), **M1.3b** (the overnight extractor — a nightly
script before the worker), **M1.3c** (propose and confirm). **7.2a's ask path is unchanged and
still writes at once.** Records **§109's testing plan as deferred** — many fields, related and
unrelated, because everything so far was tuned on one shape. Version 28: **M1.2b's done-marker is CORRECTED**: the web-search flag it
claimed to return **does not exist on `GateResult`** and never did (§101) — §65's seventh shape,
a thing described as shipped, and it survived six days because **nothing read the field**. Adds
**M1.9 — the research answer rebuilt free-flowing** (§102): CompliBoard's answer was the weakest
of four on the same question, and the fixed-section template is the cause. Version 27: Adds **0.11 — stream the long AI calls.** It removes the
SDK's non-streaming ceiling that §100 could only cap below, **and** answers §92's 58.9 s: a
spinner over a 197-second call is the product saying nothing. Notes the hard part — the critic
must still finish before anything is shown, or a withheld item appears mid-stream and vanishes.
Version 26: Adds **0.10 — `npm run db:restore`, one command ahead of the
next migration.** A reset costs **eight steps** and is therefore avoided, which is why §3.7 was
deferred on 029; it must verify each step and **refuse to continue on zero rows**, because a
refusal at step 6 leaves an empty `switches` table and every later check passes vacuously.
Version 25: **No critic output reaches a customer** (`DECISIONS.md` §97)
— all four boxes come off every customer view, and the findings need a home because they are
**stored nowhere today**. Records **report readability** as a real problem held until answer
quality settles. Version 24: **M1's ORDER REVERSES** (`DECISIONS.md` §96). Two rows land
ahead of M1.3: **M1.2d, the conversation surface** — M1.2c is real over HTTP and **inert to a
person**, because the browser sends no `topicId` and nothing creates a `topics` row — and
**M1.4a, the single-site slice**, because **73 of 95 switches are site-scoped** (read from the
live table; the documents said 70) and M1.3 first would build a writer for 22 facts and change
its shape when the site arrives. **The detail section at the foot of M1 is SUPERSEDED IN FULL** —
it re-uses M1's numbers for six different tasks, so *"M1.3"* meant two things in one file.
Version 23: **7.2c is scheduled** — immediately before M1.6, which is its
only dependent. It sat outside M1 with nothing scheduling it, and check 24 shows `user_locked`
protected by **zero** policies, constraints or triggers. Version 22: **M1.2b, M1.2 and M1.2c are DONE** — the conversation loop is
closed and reachable over HTTP. The rotation gate's eighth credential now **exists**
(`TURN_SIGNING_SECRET`) and is the only one never leaked, so it is **born rotated**. Version 21: **7.2a is DONE** — both routes built and driven over real
HTTP as a signed-in user. **M1.1 is DONE and on production** (migration 028, `topics`, no facts
column per §78). **M1.2b now precedes M1.2** (§82) and is **specified** in `docs/GATE-HISTORY.md`,
with its trimming measurement already run (§83): the bound holds, the latency motivation is
withdrawn. The gate gains a sixth `FactSource`, **`hypothetical`**. Version 20: Adds **M1's build plan**, nine tasks against `WORKSPACE.md`
v3, with **7.2a named as its floor** — M1's central act is fact capture and no endpoint for it
exists. Records the two spec items still open: `expires_at` is unimplemented, and the critic
cannot see prior turns though §4.2 requires it. Version 19: Records **M1's six decisions (D22–D27) as SETTLED**, with the
cost-to-reverse and the date each must be right by, so the next session does not re-derive them.
**The GATE gains a second item** — the checklist/obligation reconciliation, because production
holds **235 AI-generated checklist rows and 0 computed obligations** and the divergence accrues
customer records (`DECISIONS.md` §68–§69). Version 18: Sweep. **7.2a, 7.3, M6 and 4.3 are complete and on both
environments** (000–023, 0 object differences), and the manual set has been run by a person for
the first time — Cases E, F, G and I pass. **What is next by dependency has changed now that a
screen exists**: it is no longer infrastructure but **6.4c, the library-quality revision**, which
gates showing `does_not_apply` to any customer — 22 of 216 clauses can never be true, plus three
type-correct shapes no query can find. The gate is still at one item. Version 17: Cases E, F, G and I **pass** — the mechanism is sound. Adds
**6.4c, the library-quality revision**, now the largest item in phase 6: **22 of 216 switch clauses
can never be true** (a large-quantity generator gets zero hazardous-waste obligations), plus three
type-correct shapes no query can find, all surfaced by a ten-minute domain read of the rendered
screen (`DECISIONS.md` §64). **Gates showing `does_not_apply` to any production customer.**
Version 16: **4.1, 4.3, 7.2, 7.2a, 7.3 and M6 are done and wired**;
version 15's headline — *"7.2's schema and logic are on both environments and no route calls
them"* — is no longer true. Migration **022 is on production**, both environments on 000–022 with
**0 object differences**. The chain runs end to end on staging: a question answered, 221
obligations persisted, the screen rendering them. **Next by dependency is 6.4** — seed
`regulated_substances`, the reference thresholds — because 12 of Test Alpha's 136 unanswered
requirements are blocked on a chemical inventory and no question can unblock them. Version 15: Documentation sweep, every count re-read. **7.2's schema and
logic are on both environments and no route calls them.** Adds a **phase index in this file's own
numbering with a state against each** — there is no Phase 3 or Phase 8 here, those are build-plan
numbers — and a **what-is-next-by-dependency** section, because resolution and determination both
work and a user can see neither. Records 7.2's measured result: three SDSs moved **zero**
obligations. Version 14 added M6's requirement that the coverage strip
**distinguish a profile from a default** — a company that has answered nothing resolves to 2
`applies`, both true, both the same answer every Oregon employer gets, and on screen
indistinguishable from a real profile. Named as a requirement because the failure it prevents
is the omniscient status tracker in its most convincing form: everything on the list is true.
Version 13: **Phase 6.3 is on BOTH environments and Phase 2 is
closed.** 205 requirement rows (200 live) carry 199 machine-evaluable conditions; 95 switches,
40 edges; 798 census objects, 0 differences. **4.1 is now the only thing between the library
and a working Requirements screen.** The six low-confidence conditions and the one deliberate
NULL are named as **6.4** work rather than left as loose ends, and the 12 switches no condition
references are classified rather than listed. Every count re-read from the database for this
version, not carried forward — `DECISIONS.md` §46. Version 12: **Phase 2's quality items are closed** — 2.3 done, the
measured per-stage latency recorded with the warning that the critic's cost is Stage 2's
absence rather than a tuning problem, and 4.1 marked as the next large piece with what it
inherits and the two things that block it. Version 11: **Phase 6.2 is on BOTH environments** — 619 objects each,
0 differences; 90 switches compared row-for-row across 13 fields with 0 differences, the same
35 edges and the same graph shape. *(Those counts were true of 6.2 and are superseded above;
the census that produced 619 is not the census that produces today's 798 — see
`AUDIT-CHECKS.md` check 10.)* Version 10 recorded **6.2 done on staging** — migration 012 adds
`switches.thresholds`, and 90 switches are seeded with 35 dependency edges and no cycles.
Adds **6.3a**, the open shape question (per-substance thresholds, which recur across four
switches and must be solved once), and **6.3b**, three `is_determination` corrections found
while seeding. Version 9: golden-file case 001 (2.8) gains two assertions — no
Oregon agency, and say what is not covered — checkable only because 2.1 assigned `agency_id`.
Version 8 recorded **Phase 2.1 done on BOTH environments** — 33 agencies,
187 of 194 requirements assigned, 56 coverage rows, verified identical staging-to-production.
Records the deferred service-role key rotation in the gate section. Version 7 recorded **Phase 2.1 done on staging** — 33 agencies, 187 of
194 requirements assigned a regulator, and the 56-row `industry_coverage` cross product.
2.1's cannabis list is corrected (it omitted EPA, PHMSA and federal OSHA, which made solvent
extraction invisible to Stage 2) and gains an open item to fill `agencies.url` against live
pages. **6.5a, 6.5b and 6.5c are new**: the six Oregon agencies the coverage table found
with zero requirements behind them, the two rows needing a decision rather than a generation
pass, and what the empty rows demonstrated about §1.1's claim. Version 6 recorded that Phase 1 is **complete** — migrations 006–010 on both
environments, verified identical at 673 objects. The gate drops to **one** item, key
rotation. Phase 2 is marked next with what it inherits, read from the database. A phase-number
mapping is added at the top because this file and `BUILD-PLAN.md` **swap phases 1 and 2**.
`/api/industries`, the invite feature (now M8 — Account) and the Phase 6 counts are corrected.

**Version 5** made three changes. **(1) Corrects the gate**, which claimed
the `memberships` migration was a prerequisite for user management. It is not — several
people at one company already works on `profiles.company_id`, proven on staging 10 Sep, and
what is missing is an invite flow. `memberships` moves out of the gate to Phase 11+
multi-site, where it answers its real question: one person across several companies. The
gate is now two items. **(2) Adds Phase 1.6**, the multi-facility structure — `entities`
seeded per company, `entity_id` on documents and evidence, a `scope` column on switches, and
the design rule that site is a property of data and not of people. Phase 1 goes to ~1.5
weeks. **(3) Rewrites the user-management feature** as something that needs no migration and
ships on its own timeline, with the cost of shared logins recorded.

**Version 4** restructured the phase order: the phases are now
horizontal only, and everything vertical moved into a new final `MODULES` section — seven
modules, each with the findings that were previously scattered through the document as
debts. The Compliance Workspace left Phase 3 (it was the only vertical slice among the
phases, scheduled ahead of the infrastructure it depends on); Screens left Phase 8 and was
distributed to the modules that own each screen; the audit-engine findings left §0.10; the
HR findings left Phase 6b; signup left Phase 8b. The employment law library stayed a phase,
renumbered 6c → 6b, because a library is horizontal. Version 3 added the gate at the top and
marked §0.9 complete; version 2 superseded version 1 (9 Sep). Supersedes the phase summaries
in `BUILD-PLAN.md` at task level — the build plan stays as the *why*, this is the *what next*.

**No fixed demo date.** Built properly, phase by phase, ready when it is ready.

---

> ### ⚠️ THE TWO PLANS NUMBER PHASES DIFFERENTLY. PHASES 1 AND 2 ARE SWAPPED.
>
> They agree on 0 and 4 and on nothing else. **"Start Phase 2" means opposite things in the
> two files**, so always say which document a phase number belongs to.
>
> | `TODO.md` | `BUILD-PLAN.md` | |
> |---|---|---|
> | Phase 0 — Foundation | Phase 0 — Foundation | agree |
> | **Phase 1 — Schema rebuild** ✅ | **Phase 2 — Schema extensions** | **swapped** |
> | **Phase 2 — The runtime pipeline** | **Phase 1 — Runtime fixes** | **swapped** |
> | Phase 4 — Resolution engine | Phase 4 — Resolution engine | agree |
> | Phase 5 — The worker | Phase 3 — The worker | differ |
> | Phase 6 — Library: chemical Oregon | Phase 5 — Library data | differ |
> | Phase 7 — Switches and evidence | Phase 6 — Switch determination | differ |
> | Phase 9 — Observability | Phase 8 — Observability | differ |
>
> **Neither is renumbered, deliberately.** Both documents and `DECISIONS.md` reference
> phases by number in dozens of places, and renumbering breaks every reference silently —
> the same failure `DECISIONS.md` §15.8 records for versioned filenames. The mapping is
> cheaper than the churn, but only if it is read, which is why it is at the top of both.
>
> **`TODO.md` is the one to follow for what to do next.** `BUILD-PLAN.md` is the *why* and
> the ordering; `TODO.md` is the *what next*, and it supersedes the build plan at task level.

---

## THIS FILE'S OWN PHASES, AND WHERE EACH STANDS

*Read from this file's own headings on 12 September 2026. **Every number here is `TODO.md`'s
numbering** — `BUILD-PLAN.md`'s differs for five of them, see the table above. There is no
`PHASE 3` and no `PHASE 8` in this file; those numbers exist only in the build plan.*

| `TODO.md` phase | State |
|---|---|
| **0 — Foundation** | 🟡 items open |
| **1 — Schema rebuild** | ✅ complete 11 Sep |
| **2 — The runtime pipeline** | ✅ quality items closed 12 Sep; 2.4, 2.6, 2.7 open |
| **4 — Resolution engine** | 🟡 **4.1 and 4.2 done 12 Sep**; 4.3, 4.4 open |
| **5 — The worker** | ⬜ not started *(= build plan's Phase 3)* |
| **6 — Library: chemical Oregon** | 🟡 6.1–6.3 done; **6.4 open**, 6.5–6.9 not started |
| **6b — Employment law library** | ⬜ not started |
| **7 — Switches and evidence** | 🟡 **7.2's schema and logic done 12 Sep, no route**; 7.1, 7.3, 7.4 open |
| **9 — Observability** | ⬜ not started *(= build plan's Phase 8)* |
| **10 — Cannabis Oregon** | ⬜ not started |
| **11+ — Later** | ⬜ |
| **MODULES M1–M8** | ⬜ the seven product modules, built last |

### M1 — THE BUILD PLAN ⬜ ⏱ ~8 days

> ### ⚠ M1.2b PRECEDES M1.2 — REORDERED 15 Sep, `DECISIONS.md` §82. Do not restore BUILD-PLAN's order.
> **Classification's three categories map exactly onto the three things the gate's history must
> carry** — a refinement needs the prior assertion, a correction needs the prior fact, a new
> question needs the frame. **Built in the wrong order, M1.2 classifies from PROSE while M1.2b
> later produces STRUCTURE, and nothing reconciles them.** Two systems, one fact — §71 and §24's
> shape a third time, and this one costs nothing to avoid.

*Written 15 September 2026 against `WORKSPACE.md` **v3**. Spec first, code second — the six
decisions and the five schema gaps are settled before any of this starts.*

> ### ⛔ M1 CANNOT START UNTIL 7.2a EXISTS.
> `/api/switches/ask` and `/api/switches/answer` **do not exist**, and **nothing in `app/` has
> ever written a `company_switches` row** — Test Alpha's 16 facts came from
> `scripts/seed-multisite-fixture.js:141`. Four modules (`switchAsk`, `switchDetermination`,
> `sdsExtraction`, `basis`) have ~17 exports, ~60 tests and **zero production callers** (check
> 29). **M1's central act is fact capture and there is no endpoint for it.** 7.2a is one day.

| # | Task | Depends on | ⏱ |
|---|---|---|---|
| **M1.0** | **7.2a's two routes** — the floor, not part of M1 | — | 1 d |
| **M1.1** ✅ | **DONE 15 Sep — migration 028, staging.** **Topics, minimal shape** (D23). `topics`: company, title, status, opened/closed, summary. **NO facts column** — §78: hypotheticals are not stored, so nothing here holds a fact. **Free today, not free once conversations are stored** (§69) | M1.0 | 1 d |
| **M1.2b** ⚠ | **PARTLY DONE 15 Sep** (§84), **corrected 21 Sep** (§101). ⚡ Shipped: **prior turns**, and a **frame** carrying jurisdiction-of-question, tense and subject (§77 items 7–8). **NOT shipped: the web-search flag** (§77 item 6). `GateResult` has `outcome`, `resolved`/`ask`, `frame`, `followUp` and **no `needsWebSearch`** — `grep -rn needsWebSearch lib app` returns only `determinationGate.ts:373`, which is the gate's own call setting `enableWebSearch: false`. **The row said it was returned for six days**, and nothing noticed because nothing read it. Carried into **M1.9** below | M1.1 | 1.5 d |
| **M1.2a** | ~~The critic's `priorAssertions` field~~ — **WITHDRAWN for research.** §77 drops the critic from the research path entirely; §73's decision survives and applies at the **checklist boundary**, which is where it is now needed | — | — |
| **M1.2c** ✅ | **DONE 15 Sep** (§91) — route wired, run over HTTP, four attacks refused. ⚡ **THE CONVERSATION LOOP** — the caller that feeds M1.2b and M1.2. `GATE-HISTORY.md` §8.4 specifies the contract and **assigns it to nobody**, which is why it was not a task: a contract with no owner is a specification of something that will not happen. **Turns are SIGNED** (§89). Until this exists, M1.2b and M1.2 are built, correct and **inert** | M1.2 | 1.5 d |
| **M1.2** ✅ | **DONE 15 Sep** (§86) — folded into the gate, not a third call. **Follow-up classification** (§4.1) — three kinds, classified before anything expensive runs | **M1.2b** | 1 d |
| **M1.2d** ✅ | **DONE — committed in `71c2a4d`, unmentioned in its own commit message, which is why this row went unticked until 21 Sep (`DECISIONS.md` §65, twelfth instance).** The browser holds turns (`page.tsx:219–220`) and sends them on **both** paths (`:706`, `:718`); the route creates the `topics` row and verifies `topicId` against a real one (`route.ts:191–281`); the turn is appended **before** the ask early-return (`:739–740`). **23 `topics` rows on staging.** **SEVERAL open topics per company** (§96e). What is NOT built is the STACKED LAYOUT — see M1.2e | M1.2c | 1.5 d |
| **M1.2e** ✅ | **DONE 21 Sep.** `exchanges: Exchange[]` replaces the five singulars; `handleSubmit` **appends** instead of erasing; composer **at the bottom, clearing on send**; the gate's ask is **a message in the flow answered from the composer** (`GateAskCard`'s own input is now optional and the Ask tab passes no `onAnswer`); **sources are per-exchange**. `kind` carries `'proposal'` and `'notice'` for M1.3c and M1.8. `text` is appendable for streaming (0.11). Dead follow-up code removed — it called `handleSubmit` with the **pre-2026 one-argument signature**, so it would have submitted the text as a MODE. Driven over HTTP: 3 exchanges stay, composer empty after each send, oldest first, one topic, sources **11 · 10** and not shared. **RECORDED, NOT BUILT**: chat history (§110) is **never** the Saved tab — Saved is permanent, history is cleared after 15 days; **saving the whole conversation needs a `topic_id`** — nothing references `topics` today — so save on an answer saves **that answer**, and opening a saved answer **clears the live turns** rather than resuming a topic it never belonged to. **Create tab untouched** (§112) | M1.2d | 2 d |
| **M1.4a** | **THE SINGLE-SITE SLICE of M1.4** — the one-site rule, and `entity_id` carried on the fact. **This is NOT a default to primary**: §20 forbids defaulting because a company-wide answer is *wrong at every site but one*, and **with one `entities` row there is no second site to be wrong about** — v3.3 already says *never ask*. **Ahead of M1.3 because 73 of 95 switches are site-scoped** and the route refuses every one without a site (§96) | M1.2d | 0.5 d |
| **M1.3** ⛔ | **SUPERSEDED 21 Sep — `DECISIONS.md` §108.** ~~The conversation writes `company_switches` in real time~~. **Facts inferred from free prose are extracted OVERNIGHT from whole conversations and PROPOSED, not written.** The reason is judgment, not load: the same fact was labelled `stated_in_question` on turn 1 and `hypothetical` on turn 2 of one conversation (§104), and reading the whole thing settles modality once and resolves corrections. **Replaced by M1.3a/b/c below.** Unchanged: the gate, the gate's prior turns, and **7.2a's ask path, which still writes at once** — a person answering a direct question is evidence, not an interpretation | — | — |
| **M1.3a** | **Retain a conversation for FIFTEEN DAYS** (`DECISIONS.md` §110 — supersedes *discard after processing*). **Two tiers**: chat history, automatic and temporary; saved, deliberate and permanent. **Download is print-to-PDF**, no generation. **Prominent notice** on the history list and on each conversation. Brings three REQUIREMENTS: **(a)** day-16 deletion must actually run, **with a check that it did** — a retention promise nothing enforces is §101's shape pointed at a claim on screen; **(b)** account deletion takes it **immediately**, and `check-schema-contracts` must refuse a conversations table missing from `/api/account` DELETE; **(c)** it is **real customer data** — the 15 days belong in the privacy policy, and it makes the **eight-credential rotation gate live**. Still no breach of §78: a transcript is evidence, not a fact | M1.2d | 1.5 d |
| **M1.3b** | **The overnight extractor** — reads whole conversations and decides what is true of the company. **A nightly script first; `CLAUDE.md` §4's worker is where it ends up** — waiting for the worker would defer this behind infrastructure it does not need | M1.3a | 1.5 d |
| **M1.3c** | **Propose and confirm.** *"From yesterday's conversation, it sounds like you have 47 employees — should we save that?"* One tap. **Reading a transcript is an INTERPRETATION and can misread**, so it is proposed, never written. The source label travels with the proposal, so §96(b) holds for whatever finally writes it | M1.3b | 1 d |
| **M1.4** | **Site resolution — the rest** (v3.3). **Several sites → the question carries the site**; *"all of them"* writes **N rows, each attributable**, never one company row. The one-site half is **M1.4a above** | M1.3c | 0.5 d |
| **M1.5** | **Show what we know** (§7) — facts in context before an answer, with `source` rendered so a document-derived value and a person's answer do not look alike | M1.3c | 1 d |
| **7.2c** 🔒 | **A trigger for `user_locked`** — scheduled here 15 Sep because it is M1.6's only dependency, sits **outside** M1, and nothing had scheduled it. `AUDIT-CHECKS.md` check 24: **zero policies, zero constraints, zero triggers** reference `user_locked`, so it is enforced in one library module — a route guard wearing a different coat (`CLAUDE.md` §3.6). **Must be a TRIGGER**: a policy cannot compare the old row to the new one, and the rule is about the transition | M1.3c | 0.5 d |
| **M1.6** | **Conflict display** (v3.2) — determination disagreeing with a locked value is **shown, never silently resolved**. **Needs 7.2c above**: showing a conflict is worth little while the lock it reports on is unenforced | **7.2c** | 0.5 d |
| **M1.7** | **"What moved" after an answer** (v3.4) — six became applicable, two no longer apply. One level only (§54) | M1.3c | 1 d |
| **M1.8** | **Topic close onto a topic summary** (v3.6, **provisional**) | M1.1 | 0.5 d |
| **M1.9** ⚡ | **THE RESEARCH ANSWER — free-flowing, and it must beat the bare model** (§102). `RESEARCH_PROMPT`'s six fixed sections go (`prompts/checklist.ts:88–93`); `establishedFactsBlock` is rewritten so facts are **premises reasoned from**, not a list to be careful around; **`needsWebSearch` is built for real** — the gate returns it and the research call reads it (§101). Spec: `docs/RESEARCH-ANSWER.md` | M1.2b | 2 d |

**RECORDED, NOT SCHEDULED — report readability.** *21 Sep.* **The answers work and are hard to
read.** Raised from a browser test, held deliberately: **it waits until answer quality is
settled.** Polishing the presentation of answers whose content we are still changing is effort
spent twice — and §97 has just changed what an answer contains, §92 has the research path at a
minute, and the 1200-A/1200-Z hole is open. **This is the label for a real problem, not a
deferral of it**: when it is scheduled the work is typography, hierarchy and length, and none of
it is blocked by anything technical today.

**Synchronous throughout (D25).** Same reasoning as D20: the gate is 6–10 s, the answer ~30 s.

> ### ⛔ MEASURED 15 SEP — THE CRITIC IS OVER BUDGET. **STAGE 2 DOES NOT FIX IT.**
> **Narrowing 33 agencies to 4 buys 7.7 s (36.4 -> 28.7 s) and costs three coverage findings**
> (`DECISIONS.md` §76). The list is not what costs 36 s. **Stage 2 is withdrawn as a latency fix**;
> if it is built it is for Stage 3's retrieval contract, and the library route may serve that with
> no AI call. **The open question is now D25 itself** — whether the critic can be synchronous in a
> conversation at all. Old note follows:
> **36.4 s mean, 33.2–42.2 s, n=3**, critic alone, on a five-item checklist with the live 33-agency
> list (`DECISIONS.md` §74). Against a ~30 s conversational turn, and the gate and the generating
> call sit on top of it. **Stage 2 — narrowing the agency list to the ones a question touches — is
> now an M1 dependency, not a deferred optimisation.** Do not tune the prompt or drop the model
> tier: the cost is the input (`CRITIC-PASS.md` §5), and both are §3.1 changes.

**Text search only (D27).** No `pg_trgm` until something is actually slow.

**What M1 does NOT do:** write obligations, write checklists, create or flag a checklist, or
render a numeric readiness count (numbers stay off until the library is verified — M6.1).

**The two spec items still open, both flagged in v3 rather than hidden:**

1. **`expires_at` has MOVED TO THE GATE** (item 2) — it is not an M1 gap. Every module that
   writes a fact is affected and the failure direction is false green.
2. **The critic cannot see prior turns — DECIDED, and no longer an M1 blocker.** §77 drops the
   critic from research; §73's decision applies at the checklist boundary instead. Previously: `DECISIONS.md` §73 settles what it
   sees (prior **answers**, as claims under review) and what is withheld (its own prior
   **findings**, which would be the reviewer reviewing its own review). Built as **M1.2a**.

---

### M1 — THE SIX DECISIONS ARE SETTLED. DO NOT RE-LITIGATE THEM.

*Settled 13 September 2026. Recorded here so the next session starts from them rather than
re-deriving them. Reasoning and reversal costs: `DECISIONS.md` §68, §69.*

| | Decision | Cost to reverse | Must be right by |
|---|---|---|---|
| **D22** | **Obligations are the spine; checklists are workspace artifacts. M1 writes NEITHER.** The reconciliation belongs to M2 | nothing is built on it | **before real customers — it is on the GATE** |
| **D23** | **Build topics, minimal shape.** | **free today** | **before conversations are stored** |
| **D24** | **Capture facts; do not generate questions.** | same as to build | any time |
| **D25** | **Synchronous** — D20's reasoning, unchanged | same as to build | any time |
| **D26** | **WORKSPACE gaps (a) and (d) as decisions now; (b), (c) and (e) at build time** | risk is not reversal — see below | at build |
| **D27** | **Text search only. No `pg_trgm`.** | same as to build | any time |

**D26's risk is a wrong call shipping invisibly**, the way the twelve inventory rows did (§61) —
correct at every layer, wrong in composition, visible only on a screen. **The mitigation is
rendering it early, not deciding it harder.**

**D22 is on the GATE** and the reason is in §68: production already holds **235 AI-generated
`checklist_items` across 11 checklists and 0 computed obligations**, while staging holds 0 and
222. The divergence exists, M1 does not create it, and it accrues rows. Merging later means
merging live customer records.

---

### What is genuinely next, BY DEPENDENCY rather than by number — rewritten 13 Sep

**The previous version of this section said: *"resolution works, determination works, and a user
can see neither. Two engines, no surface."* All four items it listed are done.** 7.2a shipped the
routes, M7's three questions are answerable through the ask path, M6 renders, and 4.3 writes. A
person has run the whole chain in a browser.

**The situation now, in one line: the machinery is trustworthy and the content it carries is
not.** And that inverts the ordering, because **the constraint is no longer structural.**

1. **6.4c — the library revision. THE ONLY THING THAT MATTERS.** 22 of 216 switch clauses can
   never be true; a large-quantity generator receives zero hazardous-waste obligations and is told
   so confidently. Plus three type-correct shapes no query can find. **Nothing else on this list
   is worth doing while the product's confident negatives are wrong**, because every other item
   makes those wrong answers reach more people, faster.
2. **6.4b — seed `regulated_substances`.** 15 requirements blocked on an empty reference table for
   **every customer at once**, with no question asked. This is also the 12 rows Alpha shows as
   *"waiting on your chemical inventory"* — the only unknown rows no question can unblock.
3. **6.4a — the six low-confidence conditions**, four of which are one missing input (NAICS).
4. **M7's onboarding.** `has_employees` and the two employee counts gate 53 requirements and are
   form fields, not documents — one question moved 19 obligations where three SDSs moved none.
   Cheap, and it is what makes a new company's first screen non-empty.

**What is NOT next, despite being numbered earlier:** 4.4, 5, 6.5–6.9, 7.1 and the remaining
modules. `DECISIONS.md` §18 — horizontal first — was written when the ground was moving; it
stopped, and the order is now set by *what makes the product's claims true* rather than by what is
unbuilt. **6.4c is a content problem, and it is the first time this project's critical path has
been one.**


## 🔧 0.10 `npm run db:restore` — ONE COMMAND, AHEAD OF THE NEXT MIGRATION ✅ **BUILT (22 Sep) — AND ITS FIRST RUN REFUSED**

*Recorded 21 September 2026. `HOW-WE-BUILD.md` §4; `DECISIONS.md` §98.*

**A reset currently costs eight steps and is therefore avoided, which is why `CLAUDE.md` §3.7 was
deferred on migration 029 rather than followed.** A rule that is expensive to obey is a rule that
gets skipped, and the fix is to make obeying it cheap — not to restate the rule.

```
1  npm run db:reset                                    (interactive, stays that way)
2  load-requirements.js <xlsx> --apply                 205 requirement_templates
3  load-agencies.js --apply                             33 agencies
4  assign-agencies.js --apply                           agency_id + 56 industry_coverage
5  load-expressions.js --apply                          applies_expression on 205 rows
6  load-switches.js --apply                             95 switches, 40 edges, acyclic
7  seed-staging-testdata.js                             Alpha, Beta, Gamma + primary sites
8  seed-multisite-fixture.js                            Alpha's 2nd site + 16 facts
```

**Two numbers in that list were estimates and are now measured.** The worksheet holds **194**
rows, not 205, and **199** of them carry an expression — the gap between 194 and the 205 on both
databases is the whole of the finding below. The other six lines came out exactly as written.

> ### IT VERIFIES AFTER EVERY STEP AND REFUSES TO CONTINUE ON ZERO ROWS.
>
> **That is the requirement, not a nicety.** A refusal at step 6 leaves `switches` empty, the gate
> reads an empty vocabulary, and **every check that follows passes vacuously** — `AUDIT-CHECKS.md`
> check 14's subject, on a database with no library in it. A restore that stops loudly at step 6
> is worth more than one that completes quietly.
>
> Each step prints its row count and the count it expected. **The expected numbers are read from
> the seed files, never hardcoded here** — a hardcoded 95 is a copy that drifts (§43).

**Then exercise it deliberately** — a reset run on its own, watched, not folded into shipping
something else. **That run is what settles the owed reset for 029.**

**STAGING ONLY.** Every loader already refuses production without `--production`, and step 1
refuses it twice (by flag and by ref). This command must not accept the flag at all.

### Built — `scripts/db-restore.js`, `npm run db:restore`

**Every expected number is computed from a file; not one is typed in the script.** The worksheet
is *found* in `supabase/seed-data/` rather than named, so the date in its filename is not a fifth
place to keep right — two `.xlsx` files there is a stop, not a guess. The two fixture datasets
moved out of their seeders into `scripts/fixtures/staging-testdata.js` and
`scripts/fixtures/multisite.js` so the restore can count them without running them; the seeders
import the same modules, so *"16 facts"* has one definition (§43).

**Four production refusals, each tested by violating it:** `--production` (or any `--prod…`
spelling) is not a flag it has · `SUPABASE_PROJECT_REF == SUPABASE_PROD_REF` · the write URL is
the production project · **and the migrate target and the write target are different projects**,
which would reset one database and seed another with both halves reporting success.

**One addition the entry above did not ask for: it projects before it destroys.** The row counts,
the source-consistency check and the census are read-only and run *before* step 1's `RESET` prompt.
Without that the first run would have replaced the library at step 2 and then been refused at
step 5, leaving staging with a library and `applies_expression` on nothing — destroying more than
it rebuilt and stopping with no way back.

### ⛔ THE FIRST RUN REFUSED, AND THE OWED RESET IS STILL OWED

*Run 22 September 2026. Nothing was touched — staging is still 205 / 430 / 33 at migration 030.*

> ### THE SEED FILES NO LONGER REBUILD THE LIBRARY. THEY REBUILD 194 OF ITS 205 ROWS.
>
> `REQUIREMENTS-FILLED-2026-09-11.xlsx` carries **194** rows. Migration **013** splits three of
> them into **11 children** and retires the parents — and on a from-zero run **013 does nothing**,
> because it looks its parents up by name (`013_chemical_inventory.sql:419`) in a table the chain
> has not loaded yet and guards on `if parent_id is not null` (line 421). Its own verification
> block then passes on the empty table: 0 orphans, 0 live parents. **§98's failure mode exactly —
> a check that passes, not one that fails.**
>
> **Two sources say it independently.** The count (205 on staging vs 194 in the worksheet), and
> `applies-expressions.json`, which carries expressions for **exactly those 11 children** — so
> step 5 would have refused the whole file on 11 errors regardless.

**Migration 013 wrote this down itself, at line 388:** *"NOTE FOR WHOEVER RELOADS THE LIBRARY:
THIS IS THE FIRST TIME `requirement_templates` DIVERGES FROM the worksheet … the worksheet is no
longer a complete source, and which of the two is authoritative now needs deciding. TODO 6.3c."*
**That row did not exist. It does now — 6.3c below.** The restore cannot proceed until it is
decided, and there is deliberately no flag that overrides it.

**So `TODO.md` 0.10 is built and `DECISIONS.md` §98's owed reset for 029 and 030 is NOT settled.**
The precondition for the reset was this command; the precondition for this command is a complete
source.

---

## 🔧 0.11 Stream the long AI calls ⬜ ⏱ 1 day

*Recorded 21 September 2026. `DECISIONS.md` §100 and §92.*

**One change, two problems, and they have been treated as unrelated.**

| | |
|---|---|
| **The ceiling** | The SDK refuses a non-streaming request over **21333** `maxTokens` (`client.js:671`). §100 capped the retry below it, which **avoids** the ceiling. Streaming **removes** it |
| **The wait** | §92: 58.9 s first turn, 29.0 s second, and the checklist path measured **197 s**. A spinner is the product saying nothing for three minutes |

> ### SEEING TEXT ARRIVE IS THE HONEST ANSWER TO A LONG WAIT.
>
> `CLAUDE.md` §5.1 — no infinite spinner. **A progress animation over a 197-second call is a
> fiction**: it is not reporting progress, it is filling silence. Streamed text is the real thing
> happening.

**Scope:** `lib/ai.ts` gains a streaming path; the long call sites adopt it — `/api/chat`
research and checklist, `/api/audits`. **The gate does not stream**: it returns a small JSON
object and its latency is not the problem.

⚡ **`CLAUDE.md` §3.1** — this changes how a prompt's output is consumed and interacts with the
truncation retry, so it is **specified before any code**, like the gate and the critic were.

**What it does NOT change:** the critic still runs to completion before anything is shown — §97,
the customer sees the corrected document, so a withheld item must never appear mid-stream and
then vanish. **Streaming the ANSWER and withholding by severity are compatible only if the
stream is held until the critic returns**, and working that out is most of this item.

---

## 📋 THE TESTING PLAN — DEFERRED ON PURPOSE ⬜

*Recorded 21 September 2026. `DECISIONS.md` §109. **Not written now.***

**Once the compliance workspace is complete, it is tested with questions from many fields — some
compliance, some not.**

| Related questions | whether it is good at compliance |
|---|---|
| **Unrelated questions** | **whether it knows when it is out of its depth and says so** |

**Why deferred rather than skipped:** everything decided so far about answer quality rests on very
few examples, **mostly one shape** — *one fact decides everything*, which is golden 001 and the
2.5L bottle case. **The stormwater question was the second shape** — *several facts each decide a
part* — and the product handled it worse: **the gate asked nothing**, and the answer assumed where
the pad drains, which is the fact that decides whether any of it applies. **ChatGPT, with no
context, asked for it.**

**One data point is not a pattern**, and redesigning the gate on it would repeat the error §105
and §107 both declined to make. A spread of questions is what settles whether the gate
systematically under-asks on multi-fact questions.

---

## 🔬 R1 — THE OPEN BASELINE, AND BUILDING BACK UP ⬜ ⚡

*Decided 21 September 2026. `DECISIONS.md` §113. **Research mode only. Not built.***

**A five-question benchmark against raw Claude and ChatGPT with no context — Seattle restaurant,
California hospice, Texas roofing, Oregon cannabis, Ohio hazmat freight — found CompliBoard weaker
on most.** The pipeline subtracts: the prompt fences the model, search leads instead of checking so
answers mirror vendor pages, the gate blocks too readily through a chemical-manufacturing
vocabulary (**the cannabis question was withheld entirely over a butane threshold**), and nothing
offers to help further.

| # | | |
|---|---|---|
| **R1.0** | **THE BASELINE, IN PRODUCTION.** One call to the current Sonnet, a one-sentence role, web search available with **the model** deciding, prior messages as history. Sources and disclaimer stay. **Off: the gate, the facts block, the frame and scenario blocks, the long prompt** | 1 d |
| **R1.1** | **EVERY PIECE BECOMES A CONFIG SWITCH.** Production all off; staging runs what R&D tests; **rollback is one config value.** The release mechanism and the experiment framework are the same thing | 1 d |
| **R1.2** | **Search that VERIFIES rather than leads**, preferring government sources | — |
| **R1.3** | **Specialist behaviour, and a specific offer** of what to do next | — |
| **R1.4** | **Company facts** | — |
| **R1.5** | **The gate, at a much higher bar** — block only when an answer without the fact would be **wrong**, and ask in plain language. **Last, because it has the most evidence against it and the most machinery behind it** | — |

**R1.2–R1.5 ship only if each beats the step before it, measured on real questions.** Benchmarks
use an **incognito** chat plus ChatGPT (§115) — a normal chat carries the owner's memory and
contaminated earlier baselines.

**This does not delete the pipeline.** Everything M1.9, §103, §106 and §107 built stays in the
repo behind a switch.

---

## 🔒 GATED — chat history does not ship in the first release ⬜

*`DECISIONS.md` §116. §110 stands; these are RELEASE GATES, not follow-ups.*

**All four must be true before the 15-day history is shown to anyone:**

1. the day-16 deletion job exists · 2. **something checks that it ran, and what it removed** ·
3. account deletion removes chat history **immediately** · 4. the **privacy policy** says so.

**Until then conversations live for the length of the page, as they do today — no history list, and
therefore no promise to break.** A retention promise on screen with nothing enforcing it is a false
statement to a customer.

---

## ❓ OPEN — release timing, and it is the owner's call ⬜

*`DECISIONS.md` §117.* **Release now and improve module by module, or after every module's pass.**
Not derivable from the code: it depends on who the first ten customers are and whether they are
being sold a finished product or helping build one. §113's baseline makes either viable.

---

## ⛔ GATE — THESE LAND BEFORE THE FIRST REAL CUSTOMER DOCUMENT

**Three items remain.** All are cheap right now and expensive the moment a real customer's
documents are in the database — after that first upload it costs a maintenance window, a
rollback plan, and a conversation with a customer about downtime.

**1. The checklist / obligation reconciliation.** *(Added 13 Sep — `DECISIONS.md` §68.)*
Two records of "what you must do" accumulate side by side with different provenance: **235
AI-generated `checklist_items` on production against 0 computed obligations.** Not here because
it is hard to reverse — nothing is built on it — but because **it accrues rows, and rows acquire
owners.** Today it is test data on a database with no paying customers; after the first one,
merging them is a conversation about somebody's compliance record changing shape. Belongs to M2;
this entry is the deadline, not the design.

**2. `expires_at` — a fact that cannot go stale is a false green waiting to happen.**
*(Added 15 Sep — `WORKSPACE.md` v3.1.)* **48 of 95 switches are non-static** (`annual` or
`monthly`), **0 rows carry an expiry, and nothing reads the column.** The decision is settled —
an expired switch reads as `unknown`, never as its last value — and **no code implements it.**
Here rather than in M1's task list because it is not an M1 gap: **every fact every module writes
is affected**, the failure direction is **false green**, and a stale `false` clearing a
requirement is indistinguishable on screen from an honest one. Cheapest before there is real data
to migrate, and invisible if it slips.

**3. Key rotation. EIGHT credentials.**
*(**Eighth, and it now EXISTS — `TURN_SIGNING_SECRET`, created 15 Sep with M1.2c.**
`DECISIONS.md` §89. **It is the only one of the eight that has never leaked**, and the rule that
keeps it that way is **born rotated**: it is rotated in this pass with the other seven, or it is
regenerated at the moment they are. A list that grows while it waits is a list being deferred into
something bigger — and this one has now grown.)*
Four leaked in a zip on 9 Sep. Both database passwords — production and staging — were
printed in full to a terminal on 10 Sep while fixing the migration script's error output.
The script redacts them now; the values are still out. **Seventh, added 12 Sep: the
PRODUCTION service-role key**, printed in full to a terminal while checking whether the
loader credentials were set — `${VAR:+set}${VAR:-blank}` prints the *value* when the variable
is set, which is the opposite of what the line was written to do. It is in a transcript, not in
any file, and nothing was committed. **It is the most sensitive of the seven, because the
service role bypasses RLS entirely** (`CLAUDE.md` §3.6) — so this one argues for rotating now
rather than waiting for the batch. The safe form of that check is `${VAR:+set}` with no `:-`
half. Rotating seven credentials against test data is a chore. Rotating them while customers
are working is an outage.

> ### ✅ Gate item 2 — the Phase 1 schema rebuild — CLOSED 11 September 2026
>
> Enums instead of bare text, versioning columns, `industries[]`, the switch hierarchy and
> the multi-facility structure. **Migrations 006–010, applied to both environments and
> verified identical at 673 objects with zero differences.** Everything that said "painful
> to retrofit" was done while the production tables still held only test rows we wrote
> ourselves.
>
> **Key rotation is the only thing left between here and a real customer document.**

> **Corrected 10 Sep — `memberships` was the third gate item and should not have been.**
> The claim was that `profiles.company_id` blocks user management. It does not. **Two people
> at one company already works on the current schema** — two `profiles` rows carrying the
> same `company_id` — and it was proven on staging on 10 Sep: Test Alpha Chemical had two
> users and each saw the other's checklists. Nothing structural prevents a colleague.
>
> What is missing is the **invite flow**: `/api/signup` creates a new company every time, so
> there is no path that adds a second person to an existing one. That is why every company
> has exactly one member. **A feature, not a migration.**
>
> `memberships` is needed for one thing only: **one person across several companies** — a
> consultant serving two clients, or someone spanning facilities held as separate accounts.
> Rare, and it belongs with multi-site, where it is now recorded (Phase 11+), with the
> `auth_company_id()` warning intact.
>
> The distinction matters because the two are not the same size. The invite flow is a
> feature that can ship any week. `memberships` rewrites 59 policies. Filing them together
> made the cheap one look blocked by the expensive one.

### Why this gate is written at the top

Because it is easy to state and easy to slip past. Nobody decides to skip it. What happens
is that a prospect signs, someone wants to try the product this week, one real document goes
in — and the migration does not become impossible overnight. **It becomes harder gradually,
which is exactly how work like this gets deferred permanently.** Every week after the first
upload, the argument for "we'll do it after this next thing" gets slightly better, and it
never stops getting better.

The trigger is not a date. It is **the first document belonging to someone who is not us.**

**Legend**
⚡ quality-affecting — spec before writing · 🔒 blocks later work · ⏱ effort, solo with Claude Code
✅ done · 🔄 in progress · ⬜ not started

**How this document is ordered.** Phases first — they are **horizontal**, infrastructure that
every part of the product stands on. Then `MODULES`, at the end — **vertical** slices, one
feature area at a time, built once the ground under them has stopped moving. The reasoning is
written out at the head of that section.

**There is no Phase 3 and no Phase 8.** Phase 3 was the Compliance Workspace and Phase 8 was
Screens; both were vertical and both moved into `MODULES`. The remaining phases are **not**
renumbered: this document and its companions reference phases by number in dozens of places
(`7.3`, `2.6`, `5.2`, `6.7`), and renumbering breaks every one of them silently. Two gaps in a
sequence is the cheaper cost.

---

## PHASE 0 — Foundation

Making the ground solid. Nothing here changes what a customer sees.

### 0.1 Environment and tooling ✅ DONE (9 Sep)
- ✅ `CLAUDE.md` in place, `@AGENTS.md` preserved
- ✅ `scripts/db-migrate.js` and `db-types.js`, project ref from env
- ✅ `package.json`: `typecheck`, `db:migrate`, `db:types`, `check`, `db:migrate:prod`
- ✅ Staging Supabase project created, West US
- ✅ Type generation working, `lib/database.types.ts` real
- ✅ Production migration gated behind a typed `PRODUCTION` confirmation
- ✅ `docs/` folder, five documents committed

### 0.2 Schema reproducibility ✅ DONE (9 Sep)
- ✅ `CURRENT-SCHEMA.md` — full production schema documented
- ✅ `000_baseline.sql` — 19 tables, 780 lines, reconstructed from catalogs
- ✅ Staging built from files alone, verified structurally identical to production
- ✅ Migration history recorded on both projects
- ✅ `baseline-outputs/` — 947 rows of AI output preserved before prompt changes

### 0.2b Local development points at staging ✅ DONE (10 Sep)
- ✅ `.env.local` app keys switched to staging; production keys removed from the laptop
- ✅ 188 `requirement_templates` loaded into staging (unblocks signup, profile save, obligation matching)
- ✅ Verified: My Account shows *Test Alpha Chemical*
- ⬜ Load `standard_templates` (1 row) so audits reuse the cache instead of regenerating

**Why:** the dev server ran for six hours pointed at production while hot-reloading a new, untested DELETE route. Local dev must never be one click from destroying production data.

### 0.3 Storage security ✅ DONE (9 Sep)
- ✅ Found: all three storage policies checked only `bucket_id` — any logged-in user could read and delete every file
- ✅ `002_storage_company_scoping.sql` — four policies, company-prefix scoped
- ✅ Tested on staging with two real users, six tests, all passed
- ✅ Impact traced module by module before applying — nothing broke
- ✅ Applied to production

### 0.4 🔒 Close the remaining service-role holes ✅ DONE (9 Sep)
The storage policies did not protect these — the service-role key bypasses RLS entirely. *(That was the state on 9 Sep. §0.9 has since converted the routes to run as the caller, so the policies now apply.)*

**Full route map completed 9 Sep.** 21 routes: 17 service-role, 2 session-verified, 9 taking identity from a client parameter. Every one is now closed, deleted, or confirmed safe.

**Fixed — identity now derived from the verified session via `requireCompany()`:**

- ✅ **`/api/documents`** — all four methods, ownership checks, destination checks. **Now the reference implementation** (`CLAUDE.md` §3.6).
- ✅ **`/api/account`** — the worst of them. DELETE took `user_id` from the URL with **no authentication of any kind** and destroyed the whole company: rows across 15 tables, the company record and the login. One request, one guessed id. Now session-derived, gated on typing the company name, and it deletes the storage files too (previously orphaned forever). Tested 5/5 on staging including the real irreversible delete.
- ✅ **`/api/account/export`** — new. Every row the company owns, one JSON file. Tenant-scoped both directions, verified by searching each export for the other company's ids and name.
- ✅ **`/api/hr`** — accepts document ids, not `file_url`; rejects the whole request if any id fails ownership. Was the last way to read another company's files after migration 002, because the service role bypasses the storage policies.
- ✅ **`/api/audits`** — `company_id` from a query parameter and an unscoped DELETE; re-running someone else's audit would have rebuilt it against this company's documents.
- ✅ **`/api/hr-audits`** — `companyId`/`userId` from the body, and `handbookFileUrl` too, so a saved record could point at another company's file.
- ✅ **Unscoped-delete family** — `/api/folders`, `/api/calendar`, `/api/document-review`. All were `DELETE ?id=<uuid>` → `.delete().eq('id', id)` with no company predicate. Folders also gained a parent-ownership check and company-scoped "folder not empty" counts.
- ✅ **`/api/substeps`, `/api/link-research`** — wrote to checklists keyed on a body id. Linking checks **both** ends; checking only the row being updated still allows a link into another company's checklist.
- ✅ **`/api/obligations`** — returned any company's full compliance position, the most sensitive list in the product, to anyone who knew the id.

**Confirmed safe, left as they are:** `/api/signup` (no session exists yet), `/api/industries` (shared library data, no tenant rows), `/api/chat`, `/api/extract-dates`, `/api/scan-website`, `/api/feedback` (no database, no service role).

> ⚠️ **That line answers a narrower question than it appears to. Corrected 11 Sep.**
> The pass asked *"does this route leak another tenant's data?"* — and for those six the
> answer is genuinely no. **It never asked "may a stranger call this?"** At the time none of
> the six had a session check, and nothing gated them: there is no `middleware.ts`, no
> `vercel.json`, and `next.config.ts` is empty, so every route handler is publicly
> addressable. "No database" is not the same as "safe". See §0.8b.
>
> **Updated 12 Sep: `/api/chat` now has one.** It was closed by Phase 2.2, because the
> determination gate has to read `company_switches` and a route that does not know who is
> asking cannot avoid re-asking — the security item and the functional prerequisite were the
> same work. **Three remain open: `/api/extract-dates`, `/api/feedback`,
> `/api/scan-website`.** `/api/signup` and `/api/industries` stay open deliberately (§0.9).
> `DECISIONS.md` §35.1 records that a spec draft claimed this closed four routes when it
> closed one.

**Deleted rather than fixed** — all three orphaned with zero callers:
`/api/folders/industry`, `/api/requirements`, `/api/sync-obligations`.
Confirmed before deleting: no `vercel.json`, no cron schedule anywhere in the repo, **no cron jobs configured in Vercel at all**, the marketing site is not in this repo, and no script or document holds a hardcoded URL. Hardening three routes nobody calls is worse than deleting them.
`CLAUDE.md` §3.6 previously named `/api/folders/industry` as the reference to copy — it now names `/api/documents`.

**Two prompt-injection paths closed along the way.** `company_name` and `industry` were arriving from the request body and going straight into prompts (`/api/hr`, `/api/audits`, `/api/document-review`). All three now read them from the company record. Caller-supplied free text landing inside a prompt is a way to lean on the model's instructions, not just a label.

**One real bug found while closing `/api/hr`:** any non-PDF was base64-encoded and labelled `image/jpeg`. A `.docx` handbook — the format handbooks usually arrive in — was passed to the model as an unreadable picture, and the model answered anyway. Confident output from nothing. Now only PDFs and real image types are sent; anything else is named to the user with the reason.

**Testing.** Every fix was exercised against staging with two real companies and real session tokens, not asserted from reading the code. For each route: no login → 401; own rows → own rows only; another company's id → 404 (never 403, so ids cannot be probed); delete of another company's row → 404 and the row verified intact by service role; write naming another company → landed in the caller's own company.

**Acceptance met:** no route derives tenant identity from a client parameter. Every service-role use is either a route with a verified session or a place where no session exists.

### 0.5 Tenancy consistency ✅ DONE (10 Sep) — migration 003, **applied to production**
Every data table now scopes by `company_id`, in the column and in the policy. Applied to
staging, tested with three logins across two companies, then applied to production and
verified there: 235 checklist items backfilled with zero nulls, twelve company-scoped
policies and none user-scoped, `folder_audits` gone (18 tables now, was 19), row counts
unchanged at 11 / 235 / 47, and history recording 000–003. Types regenerated from
production are byte-identical to the staging-generated file, which is the check that the
two databases have not drifted.

- ✅ `calendar_events` — route fixed 9 Sep; **RLS policies replaced 10 Sep**. All four verbs, company-scoped, explicit `WITH CHECK`. No runtime change: nothing reads this table from the browser, so this aligns the database with what the route already enforced and is what lets the route stop using the service-role key.
- ✅ `checklists` — company-scoped. Gained an **UPDATE policy**, which it never had; that absence is why linking a research answer to a checklist had to go through a service-role route.
- ✅ `checklist_items` — **gained a real `company_id` column**, backfilled from the parent (235 rows, 0 orphans) and set `NOT NULL` with an FK and index. Policies now scope on its own column instead of subquerying `checklists`. One less table whose RLS has to hold for this table's RLS to work — the same coupling that makes the storage policies fragile.
- ✅ `folder_audits` — **deleted**, see below.
- ⬜ `documents.company_id` is still nullable. Every ownership check written in 0.4 fails closed on a null, which is the safe direction, but the column should not permit it. Left for the Phase 1 schema rebuild rather than patched here.

**Colleagues now see each other's checklists.** That is the intent and it matches documents and the calendar — the compliance record is a company asset. It is a visible product change, not just an internal one.

**One hazard fixed in the same change, not after.** `deleteChecklist` in `app/compliance/page.tsx` deleted with `.eq('id', id)` and no ownership filter; `toggleCheck` updated a checklist item the same way. Both were safe *only* because RLS narrowed them to the caller's own rows. Widening the policies to company scope without adding an explicit company filter would have turned "delete my checklist" into "delete any colleague's checklist", reachable from the existing UI. Both now carry `.eq('company_id', companyId)`.

**folder_audits is retired, not deferred.** It inferred compliance from folder *names* — a folder called "DOT" with any file in it read as green. A filename is not evidence, and an expired permit filed in a correctly-named folder scored identically to a current one. That is the false-green failure the product exists to prevent, so it is deleted rather than re-scoped: table, three policies, three foreign keys, generated types, its entry in the account-delete list, and its references here. There was no page, component or nav entry. One production row destroyed — a scan result derived from folder names, not a customer document.

**`/api/cron/monthly-summary` deleted with it.** A third of the email was built on folder audits, and §0.8 established the route had never run — no `vercel.json`, no cron jobs configured in Vercel at all. Dead code calling dead code. `CRON_SECRET` is removed from `.env.example` too. A monthly summary is still wanted, but it should be written against obligations and evidence — what the company must do and what proves it — not against folder names. That belongs after Phase 4, when obligations are real.

> **Wording checked 11 Sep and it still holds** — with one thing now true that was not when
> it was written: obligations are no longer merely "not real yet", they are **empty in both
> environments**, because migration 007 dropped all 376 and nothing regenerates them until
> Phase 4.1. So "after Phase 4" is not a preference about quality, it is a hard dependency:
> there is nothing for a summary to be written against until the resolution engine exists.

### 0.6 Write policies on every table ✅ DONE (10 Sep) — migration 004, **applied to production**

Every table now has a full set of access rules, and the tenancy rule lives in one named
place instead of being re-derived in twenty of them.

- ✅ **`auth_company_id()`** — `SECURITY DEFINER`, `search_path` pinned, returns the
  caller's `company_id` from `profiles` with definer rights. Every company-scoped policy
  goes through it. **53 of 58 policies** use it; **0 reference `profiles` directly**, down
  from 19.
- ✅ **The five zero-policy tables** — `audits`, `company_templates`, `document_reviews`,
  `hr_audits` got the full four. `standard_templates` joined the reference tables
  (readable by any authenticated user, service-role writes only); it was the only one of
  the three missing its read policy, which is why checking the shared cache forced
  `/api/audits` onto the service-role key.
- ✅ **`documents`** — moved from `auth.uid() = user_id` to company scope, matching what
  its route has done since 9 Sep, and gained the UPDATE policy it never had. 38 rows,
  0 with a null company, nothing became invisible.
- ✅ **`obligations`, `obligation_evidence`, `entities`, `corrections`** — were SELECT
  only, now full. `obligations` has **no DELETE policy on purpose** (§3.2: obligations are
  never deleted, only marked).
- ✅ **`obligation_evidence` gained its own `company_id`** — backfilled, `NOT NULL`, FK,
  index. Without it, scoping meant another subquery into another protected table, which
  is the coupling this migration removes.
- ✅ **`companies` INSERT and `profiles` INSERT removed** — neither had a legitimate
  caller. Both happen in signup under the service role. Allowing a session to do either
  let anyone manufacture a company, or attach themselves to one by writing their own
  profile row.
- ✅ **`anon` revoked on all 18 tables** — 144 privileges to 0. It was denied by policy
  anyway, but one forgotten policy on a new table and it would have had everything. Now
  it is refused at the grant, before policies are consulted.

**Verified on production:** 58 policies / 0 via profiles / 53 via the function, no table
with RLS on and zero policies, anon privileges 0, every row count identical across all 18
tables, types byte-identical to the staging-generated file.

**Tested on staging with real logins at the browser's own surface** (anon key + user JWT,
not through the app): 12 tables show only the caller's rows, cross-company writes refused,
moving a row into another company refused by `WITH CHECK`, reference tables read but not
write, creating a company refused, and an unauthenticated caller refused outright.

**Not done here, deliberately: no route was converted off the service-role key.** Rules
first, proven; routes after. See 0.9.

### 0.9 Convert routes off the service-role key ✅ DONE (10 Sep)

Migrations 002–005 made the database able to enforce tenancy on its own. This made it do
so: routes now connect as the person making the request, so the policies apply instead of
being bypassed. Both layers are load-bearing — application code derives identity from the
session, and the database enforces it independently. A route that forgets a check now fails
closed rather than leaking.

**Final census — 18 routes.**

**On the caller's token (10):** `account/export`, `calendar`, `document-review`,
`documents`, `folders`, `hr`, `hr-audits`, `link-research`, `obligations`, `substeps`.

**Holding the admin client (4), each for a reason written into the file:**

| Route | Why it keeps the key |
|---|---|
| `account` | DELETE calls `auth.admin.deleteUser()`. Removing a login is an admin API, not a table write — no user token performs it at any privilege. GET and PUT are converted; the file holds both clients and says which is used where. |
| `audits` | One statement: the shared parsed-standard cache insert on a cache miss. That table is reference data with no tenant column and no write policy, deliberately — an INSERT policy would let any authenticated user write into a cache every other company reads. The read beside it *is* converted. |
| `industries` | Serves the signup page, which is public and has no session by definition. The requirements library is readable `to authenticated`, and 004 revoked anon's grants, so under a caller's token it returns nothing and the dropdown empties — which blocks signup. |
| `signup` | Creates the auth user, company and profile before any session exists. |

**No database at all (4):** `chat`, `extract-dates`, `scan-website`, `feedback`.

**`reviewDocument`'s fallback is gone.** That shared module used to build its own admin
client and fall back to it when a caller passed none. Both callers now pass one, so the
fallback was unreachable code that silently bypassed RLS — the kind that gets picked up
later by someone who does not know why it was there. The `db` parameter is **required**
now, so the compiler enforces it and a future caller cannot forget.

**The rule this established:** a route may keep the admin client for a *named statement*
with a comment explaining it. It may not keep it out of habit. Every one of the four above
names its statement.

**Verification standard used throughout** — see `DECISIONS.md` §17.6. Not HTTP status:
RLS is a filter, not a gate, so a read that is too narrow returns `[]` with a perfectly
good 200. Every conversion was checked by comparing per-table row counts, and usually exact
id sets, under the caller's token against the same query run with the service role, with
joined tables checked separately because a blocked join returns the right number of rows
with empty content.

### 0.8 Follow-ups from the Phase 1 rebuild ⬜

- ✅ **`/api/industries` was broken in production by migration 007, and nothing noticed.**
  007 replaced `industry text` with `industries text[]`; this route — **named as the only
  caller in 007's own header** — kept selecting the old column. PostgREST returned
  `42703: column requirement_templates.industry does not exist`, the catch turned it into
  a 500, and the signup dropdown came back empty. **An empty dropdown blocks signup**, on
  the one page with no session and no other way in. Fixed 11 Sep.

  **`npm run check` passed throughout.** A column name inside `.select()` is a string and
  the generated types cannot see into it — which is exactly what makes them valuable
  everywhere else. A column rename is therefore two changes: the migration, and a sweep of
  every query string naming that column.

  A sweep of all 57 source files against the live schema found this and nothing else. Two
  call sites use a **variable** table name (`/api/account/export`'s `byCompany()` and
  `/api/account` DELETE's table list) which neither the sweep nor the compiler can check;
  all 23 tables they name were verified by hand to carry `company_id`.

- ⬜ **The loader should reach production without a service-role key in `.env.local`.**
  `scripts/load-requirements.js` writes through PostgREST, so `--production` needs
  `SUPABASE_PROD_URL` and `SUPABASE_PROD_SERVICE_ROLE_KEY` — and `CLAUDE.md` §3.8 says
  both are expected to be **blank**, because a laptop points at staging and a live key
  sitting in a file on a machine that also runs `npm run dev` is how an ordinary local
  click reaches production. So loading production today means setting two secrets and
  remembering to clear them, and "remembering" is the weak part.

  `scripts/db-migrate.js` already has the answer: it reaches production through the
  **session pooler** using `SUPABASE_PROD_DB_PASSWORD`, which is a credential that has to
  be present locally anyway to ship a migration at all. The loader should do the same.
  Neither `psql` nor the `pg` package is installed, so this needs one of them added — a
  real change, deliberately **not** made in the middle of a production run.

  Until then the loader fails loudly when the variables are missing, names both, says
  they are meant to be blank, and prints a clear-them reminder on success. That is a
  guard against forgetting, not a substitute for the fix.

- ⬜ **The requirements screen is empty until Phase 4, and that is expected.**
  Migration 007 drops `obligations` — 376 rows in production, all of it derived output
  (188 templates × 2 companies) and all of it carrying the jurisdiction bug: matching was
  on an unverified AI scan blob rather than the customer's stated address, so most
  companies silently received federal rows only (1.4). Nothing
  regenerates those rows until the resolution engine exists in **Phase 4.1**.

  So after 007 lands, `/requirements` shows nothing and `/api/obligations` returns an
  empty list with a 200. **That is the schema being correct and the engine not being
  built yet — not a regression.** It belongs in `STATUS.md` the moment 1.5 writes it,
  as: *Requirements — not-yet-rebuilt, awaiting Phase 4.1.* Without that line, the first
  person to open the page after the rebuild reports a bug that isn't one.

---

### 0.8b 🔒 Six routes have no session check, and one of them fetches URLs for you ⬜
*Found 11 Sep by a read-only audit, after the route census had passed all six.*

`/api/chat`, `/api/extract-dates`, `/api/feedback`, `/api/scan-website`, `/api/industries`
and `/api/signup` have no `requireCompany`, no `getUser`, no token read. The last two are
**documented, deliberate exceptions** (§0.9). The first four are not — they were passed by
the census on the grounds that they touch no tables, which is true and is not the same
question. Nothing upstream gates them: no middleware, no `vercel.json`, empty
`next.config.ts`.

**None of the six can read or write another tenant's data.** The exposure is cost and
abuse, not leakage — which is why the tenancy pass did not flag it and why this is its own
item rather than a correction to that pass.

| Route | What an anonymous caller gets |
|---|---|
| `/api/chat` | a model call at `maxTokens: 6000`, **plus server-side parsing** of Excel/Word/PowerPoint since 11 Sep — the widening enlarged this surface |
| `/api/extract-dates` | a model call at `maxTokens: 1000` |
| `/api/scan-website` | a model call with **web search**, and up to 17 outbound fetches — see below |
| `/api/feedback` | **an email**, from your Resend account, to `FEEDBACK_EMAIL` |

**⚠️ `/api/scan-website` is the one to look at first.** It takes `url` from the request body,
prepends `https://` if absent, and fetches it **plus 16 guessed subpaths** (`/products`,
`/about`, …). No allowlist, no scheme check, nothing blocking private or link-local address
ranges. One unauthenticated request is up to 17 outbound fetches from your infrastructure to
a destination the caller picks.

**Assessed as BLIND SSRF, and the blindness is the only thing limiting it.** The fetched HTML
is not returned to the caller. It is stripped of tags, truncated to 4,000 characters, and
passed into a model prompt; the caller receives the model's *extracted fields*, not the page.
So exfiltrating a metadata endpoint or an internal page is not direct — it is mediated by a
model asked to describe a business. That is a real mitigation and it is **not a control**: it
narrows the channel rather than closing it, it depends on prompt behaviour rather than on a
check, and it does nothing at all about the requests themselves reaching internal hosts.
Timing and error differences remain observable, and the 10-second timeout bounds each fetch
but not the pattern.

`/api/feedback` additionally interpolates caller input straight into the HTML email body
(`${message}`, `${company}`) with no escaping.

**Not fixed here deliberately** — a fix means deciding an auth story for the pre-login
surface (`/api/scan-website` runs during signup, before a session exists, like
`/api/industries`), which is M7's territory, plus rate limiting, which is Phase 9. Recorded
so the decision is made rather than inherited.

---

### 0.7 Housekeeping ⬜ ⏱ 2 hours
- ⬜ Delete four orphaned storage files under a prefix matching no company
- ⬜ Remove unused deps: `ai`, `@ai-sdk/anthropic`
- ✅ `updated_at` trigger — **written in migration 006**, not yet applied. Five tables
  carry the column (`agencies`, `entities`, `obligations`, `requirement_templates`,
  `standard_templates`), not nine — `CURRENT-SCHEMA.md` says nine and is wrong
- ⬜ **`/api/folders` POST drops `section`.** `app/documents/page.tsx:307` sends it and
  the route never destructures it (`app/api/folders/route.ts:41`), so every folder made
  through the UI silently takes the column default `files`. The 20 `hr` and 12 `log`
  rows in production came from somewhere else. Same class as the HR upload bug below —
  a field the caller set, discarded with no error
- ⬜ **`/api/documents` POST drops `category`.** `app/hr/page.tsx:126` sends
  `category: 'hr-handbooks'`; `documents` has no such column and the route does not
  destructure it. HR handbook uploads land with no marker of what they are, which is
  part of why 13 of 38 documents have a null `folder_id`
- ⬜ Resolve pricing: $199 or $99
- ⬜ Remove HIPAA as a surfaced audit example
- ⬜ Fix `app/upload/page.tsx:89` — `getPublicUrl` on a private bucket, already broken
- ⬜ Add to docs: baseline exports go in git **only** while data is synthetic
- ⬜ **`supabase db query -o json` returns two different JSON shapes.** Which one depends
  on the CLI's agent detection (`--agent auto|yes|no`): a bare array `[{...}]` when it
  thinks a person is calling, a wrapped object `{"boundary":…,"rows":[…],"warning":…}`
  when it thinks a program is. Anything parsing that output must handle both, and must
  treat an unrecognised payload as a failure rather than as an empty result. This cost
  two aborted production migrations on 10 Sep: the parser read only the wrapped form, so
  in a human terminal it read a full history as empty and reported every migration as
  pending — silently, because nothing threw. Fixed in `scripts/db-migrate.js`; that is
  currently the only place in the repo that parses CLI JSON, and any new one has the same
  trap waiting.

- ⬜ **Deleting a route breaks `npm run check` until `.next/types` is cleared.** Next.js
  generates a route validator under `.next/types/` referencing every route file. Delete a
  route and the stale validator remains, so `tsc --noEmit` — which runs *before* `next
  build` in `npm run check` — fails with `TS2307: Cannot find module
  '../../app/api/<name>/route.js'`. Hit this deleting the three orphans on 9 Sep. Fix is
  `rm -rf .next/types`; the build regenerates it. Worth a line in the check script or a
  `predev`/`prebuild` clean so the next person does not lose ten minutes to it.

---

## PHASE 1 — Schema rebuild ✅ **COMPLETE 11 September 2026** ⏱ ~1.5 weeks

Production data is test data. Rebuild the schema correctly rather than patching it. Everything drops and reloads.

**This is gate item 2.** Every column below is cheap to add to empty tables and expensive to
add to a customer's. 1.6 is the clearest case in the phase and the most recent addition.

### Phase 1 is complete — 11 September 2026

All six items. **Migrations 006–010 are applied to BOTH staging and production**, as of
11 September. *(012 is the latest as of 12 September — see Phase 2 and 6.2.)*

**The two environments were verified identical at the close of Phase 1: 673 objects each, 0
differences** — columns, indexes, policies, constraints, enum values, functions, triggers,
grants and storage policies, compared in both directions.

*Still identical on 12 September after 013 and 014, at **798 objects**, the two census outputs
byte-identical. 673 → 619 → 798 are three differently-built censuses rather than losses or
gains; the census now lives in `supabase/census.sql` so a fourth number cannot be a fourth
question. `AUDIT-CHECKS.md` check 10.*

*This paragraph twice said production was further ahead than it was, both times written from
recollection and both times caught by a pre-flight or a comparison. It is now read from the
database.*

**Gate item 2 is closed.** Only key rotation remains before the first real customer document.

> **The production service-role key was echoed into a session transcript on 11 September,
> and rotation is DEFERRED to the gate batch rather than done immediately.**
>
> *What happened:* checking whether `SUPABASE_PROD_SERVICE_ROLE_KEY` was set during the
> Phase 2.1 production load, the check used a shell expansion that prints the value when it
> is non-empty rather than one that prints only "set" or "blank". The full JWT went into the
> terminal and the conversation. It was never written to a file, and `.env.local` is
> gitignored, so nothing reached the repository.
>
> *Why deferred rather than rotated now, and this is a judgement that could go the other
> way:* a service-role key bypasses RLS entirely, so the exposure is real. What it currently
> reaches is **ten seeded companies, no customer documents, and a requirement library that is
> public regulation**. Production holds nothing confidential today. Rotating now means
> rotating twice — once now and once in the gate batch with the other five credentials —
> and a key rotated in isolation is the kind that gets missed in the hosting platform's
> settings and takes the app down on a Friday.
>
> *The condition is not a date.* It rotates **with the rest, before the first real customer
> document reaches production**. If anything changes that timing — a pilot customer, a real
> upload, anything that makes production hold data somebody would mind losing — this rotates
> first and alone.
>
> *And the check itself is fixed:* test presence with `${VAR:+set}`, never with a form that
> can print the value. The three loaders already print only names, never values, in their
> own guidance.

**✅ Done, in production:** 1.1, and the library reloaded onto it.

- **Migration 006** — twelve enum types; six columns converted; `employee_count` from text
  bands to `integer` (all 10 companies became NULL, intended — §21.1); the `updated_at`
  trigger on five tables. Applied to production 11 Sep.
- **Migration 007** — the Requirements spine rebuilt: `agencies`, `requirement_templates`,
  `entities`, `obligations`, `obligation_evidence` dropped and recreated with the full
  column set. Applied to production 11 Sep.
- **The library loaded** — 194 rows, 192 active, 2 retired parents, 6 children with
  resolved lineage, 188 original ids preserved. The re-categorisation and splitting pass
  (§21.4) is complete and in production.
- Production and staging verified **identical across 480 schema objects**.

**⬜ What remains in Phase 1:**

| | | |
|---|---|---|
| **1.2** | The six new tables | ✅ **Five DONE 11 Sep** (migration 008, staging only): `switches`, `company_switches`, `industry_coverage`, `library_candidates`, `jobs`. `topics` deliberately deferred — see M1 |
| **1.3** | Rebuild staging from zero | ✅ **DONE 11 Sep.** `npm run db:reset` exists, and running it found two defects — see below |
| **1.4** | Make the match key's inputs correct and complete | Renamed 11 Sep. Sites can now state their jurisdiction (009) and the rule is written down; the **implementation moved to Phase 4.1**, where the engine that uses it lives |
| **1.5** | `STATUS.md` | ✅ **DONE 11 Sep** — at the repo root. One line per module with the date it was last actually checked, and `unknown` used where it is the true answer |
| **1.6** | Multi-facility wiring | ✅ **DONE 11 Sep** across 007–010. `entity_id` on all five tables; `switches.scope` with its composite FK and check (008); jurisdiction columns on `entities` (009); **every company now gets a primary site in the same statement that creates it**, and the 10 existing companies were backfilled (010) |

### ✅ 1.3 — the chain now builds a database from nothing, and it did not before

`npm run db:reset` drops every object in `public` (and the policies the chain owns on
`storage.objects`), clears the migration history, and runs 000→007 against the empty
result. It refuses `--production` outright, by flag and independently by ref, and requires
typing `RESET`.

**Running it for the first time broke twice, which is the entire value of having run it.**

**1. `001_step3_spine.sql` collided with `000_baseline.sql`.**
`ERROR: relation "requirement_templates" already exists`. 000 was reconstructed from
production's catalogs on 9 Sep, at which point 001 had long been applied — so everything
001 creates is already inside 000. Verified against a database with only 000 applied: 6 of
6 tables, 8 of 8 indexes, 6 of 6 RLS, 6 of 6 policies. 001 is now a **no-op that explains
itself**, kept rather than deleted so the numbering and the two databases' histories stay
honest.

**2. `000_baseline.sql` collided with its own previous run.**
`ERROR: policy "Users can delete own files" for table "objects" already exists`. 000
recreates three storage policies so that 002 has something to drop — but they live on
`storage.objects`, not in `public`, and the bucket-only ones reference nothing in `public`,
so not even `CASCADE` reaches them. 000 now drops-if-exists first, the way 002 always did,
and the reset clears storage policies too.

**Neither was reachable incrementally.** 001 was marked applied by hand before 000 existed,
so it had never been executed again; the storage collision needs 000 to run twice. Both
would have surfaced the first time anyone built a database from scratch — a new
environment, a disaster recovery, a second staging project — and would have looked like a
mystery rather than a known quantity.

**The proof, which is the point:** production (grown incrementally, migration by migration
since June) and staging (built from nothing by 000→007 on 11 Sep) compared across columns,
indexes, policies, constraints, enum values, functions, triggers, grants and storage
policies — **484 objects each, 0 differences.**

**The rule this earns:** *a chain that has only ever been applied incrementally is not known
to work. It is known to have worked once, in one order, from one starting state.* Run
`npm run db:reset` after adding a migration, not before shipping one.

### 1.1 🔒 Design the corrected schema ⚡ ⏱ 2 days
- ⬜ Postgres `ENUM` for every enum-like column, replacing bare `text`
- ⬜ `industries text[]` on requirements — one row, many verticals
- ⬜ Switch hierarchy: `depends_on_switch` / `depends_on_value`
- ⬜ Fifth state `not_applicable`, distinct from `unknown`
- ⬜ Jurisdiction columns: level, state, county, city
- ⬜ Versioning: `version`, `effective_from`, `effective_to`, `supersedes_id`
- ⬜ `scope_rules` — what a requirement does NOT cover, and its common misreading
- ⬜ `applies_expression jsonb`
- ⬜ Verification: `verification_status`, `verified_by`, `verified_at`, `citation_url`, `citation_quote`, `source_checked_at`
- ⬜ New cadence values: `continuous`, `pre_approval`
- ✅ `entity_scope` gains `product` — **verified 12 Sep**: the enum is `organization | site | chemical | equipment | person | product`. No requirement row uses `product` yet (104 organization, 27 chemical, 26 person, 24 equipment, 19 site), which is expected — it exists for the cannabis vertical.

### 1.2 New tables ⬜ ⏱ 2 days
- ⬜ `switches` — definitions with hierarchy
- ⬜ `company_switches` — value, `basis`, confidence, source, `user_locked`, `expires_at`
- ⬜ `industry_coverage` — industry × jurisdiction × agency → status
- ⬜ `library_candidates` — requirements produced without a library
- ⬜ `jobs` — the worker queue
- ⬜ `topics` — conversation topics, open/closed, with summaries

### 1.3 Rebuild ⬜ ⏱ 1 day
- ⬜ Write migrations, apply to staging, verify from scratch
- ⬜ Rebuild staging from zero — proves the migrations are complete
- ✅ Rebuilt production, reloaded the library (**194 rows, 192 active**), recreated test accounts

### 1.4 🔒 Make the match key's inputs correct and complete ⬜ ⏱ half day
*Renamed 11 Sep. The implementation moved to Phase 4.1 — see below.*

**94 of 192 active requirement rows are Oregon-specific** (91 at `layer = state`, plus the
3 fire-code rows at `layer = local`). Getting the match key wrong therefore decides roughly
half of what a customer is told.

**⚠️ THE DESCRIPTION ABOVE WAS WRONG IN FOUR DOCUMENTS. Corrected 11 Sep.**

The deleted route did **not** match on industry alone. It filtered on jurisdiction:

```js
templateQuery = state
  ? templateQuery.or(`jurisdiction_state.is.null,jurisdiction_state.eq.${state}`)
  : templateQuery.is('jurisdiction_state', null)
```

**The real defect is that `state` came from `scan_result->>'state'` — an unverified AI
website-scan blob — and not from `companies.state`, the address the customer gave us.**

Three consequences, and the direction is the opposite of what was recorded:

1. **`scan_result` is null for 7 of 10 production companies.** For those the filter falls
   to `jurisdiction_state is null`: **federal rows only, all 94 Oregon rows silently
   dropped.** The live failure is UNDER-serving, not over-serving. Per `CLAUDE.md` §3.2
   that is the safer direction, and it is still wrong — a company is told less than it
   owes and has no way to know.
2. **The two sources already disagree on a live row.** `CB-Test 2` is `Oregon` by address
   and `Washington` by scan. It would have been matched against Washington, of which the
   library holds zero rows, and received only the 95 federal ones.
3. **County, city and local were never considered at all** — only `jurisdiction_state`.

Over-serving is *possible* through the same hole (a scan claiming Oregon for a Texas
company) but no production row does it. The honest statement is: **the match key used a
derived, unverified jurisdiction in place of a stated one, and ignored three of the five
layers.** `${state}` was also interpolated straight into a PostgREST `.or()` string, so a
comma in the value would have broken the filter.

**Why it matters that the record was wrong:** it would have sent someone hunting for a
missing `.eq()` that was never missing, and left the actual cause — an AI artifact
silently outranking the customer's own address — in place. `DECISIONS.md` §24.1 settles
the source of truth.

### Why the implementation is Phase 4.1 and not Phase 1

Phase 4.1 is defined as *"Jurisdiction + switches + library version → obligations.
Deterministic."* **The match key is three-quarters of that sentence.** Writing it now means
writing it against a resolution engine that does not exist, then writing it again — and
4.4 makes *"state X never receives state-Y requirements"* a required test of that engine,
not of a route.

It belongs in `lib/resolution.ts` as a **pure predicate** — facts and rows in, rows out —
never as a SQL filter. Three reasons: §3.2 requires resolution to be deterministic and
computed in code; a predicate is testable without a database and a PostgREST `.or()` string
is not; and the failure mode of a too-narrow SQL filter is **fewer rows with a perfectly
good 200**, which is exactly what the deleted route did for months with nobody noticing.
Load candidates with a deliberately broad query and narrow in tested code, so that if the
SQL is ever wrong it is wrong in the superset direction where the code catches it.

### What Phase 1 lands instead — the inputs, not the rule

- ✅ **Jurisdiction columns on `entities`** (migration 009). A site had no way to say where
  it was, which made `local` and `city` requirements **unresolvable for every company**.
  The three Oregon Fire Code rows are the first that need it.
- ✅ **The authoritative-source decision** — `companies.state/county/city`, never
  `scan_result` (`DECISIONS.md` §24.1).
- ✅ **The full six-case match rule written into `CHEMICAL-OR-WA.md` §3.2**, including the
  two cases that had no rule at all, so Phase 4 inherits it rather than reinventing it.
- ⬜ **Address capture is still incomplete.** Signup hardcodes `county: ''` and never asks,
  yet `jurisdiction_layer = 'county'` is a value the match key must serve. Belongs with
  M7's signup rework, and until then no county-scoped requirement can resolve.

### 1.5 `STATUS.md` ⬜ ⏱ 1 hour
One line per module: working / broken / not-yet-rebuilt / verified-on-date. Prevents "broken and nobody noticed" during a rebuild.
**First line to write, already earned:** *Requirements — not-yet-rebuilt, awaiting Phase 4.1.*
Migration 007 dropped the 376 obligations and nothing regenerates them until resolution
exists, so the screen is empty by design. See §0.8.

### 1.6 🔒 Multi-facility structure ⚡ ⏱ 1 day
*Designed with 1.1, applied in 1.3. Numbered last because it was added last, not done last.*
**Design:** `CHEMICAL-OR-WA.md` §6.6. **Decision:** `DECISIONS.md` §20.

**One company with facilities in different places is normal in chemical manufacturing, and
their requirement lists genuinely differ by site** — different OSHA citations, different
waste rules, a different air authority. The six-facility cannabis prospect is not six legally
separate entities; it is one business with six sites. Treating "the company" as the only unit
of compliance is wrong for both.

**The near-term workaround stands: one account per facility** (`DECISIONS.md` §17.4). It
works today and it is the right call for release one. It also costs, and the cost is worth
writing down rather than discovering:

- Company-level documents — the corporate ISO certificate, the written HazCom program — get
  uploaded once per account, and each copy ages independently.
- There is no roll-up. Nobody can ask *"where are we exposed across all six?"*
- Consolidating later means **merging several live customer accounts** and deciding which
  copy of a shared document is authoritative. That is a data migration on real records with
  a customer waiting.

**So build the structure now and the interface later.** The structure is a day; retrofitting
it after customer data exists is two to three weeks, because it reaches resolution, switches,
evidence, documents and every screen at once.

- ⬜ **`entities` populated with one site per company at signup, always** — including for
  single-site customers. A default row means nothing is ever special-cased later: no
  `if (company has one site)` branch, no nullable-everywhere, and adding a second site is an
  insert rather than a migration. The table already exists with `entity_type` and
  `parent_entity_id`; it holds zero rows today.
- ⬜ **`entity_id` on `documents`, `obligations` and `obligation_evidence`.** `obligations`
  already has it (FK to `entities`, `ON DELETE CASCADE`); the other two do not.
- ⬜ **A `scope` column on `switches` — `company` or `site` — with a nullable `entity_id` on
  `company_switches`.** Employee count and ISO certification are company-wide. Generator
  category, air permit tier and underground storage tanks are per-site, and a company-wide
  answer to those is simply wrong at five of six facilities.
- ⬜ **Sites carry the nickname the operator actually uses** — `CompanyA-Hillsboro`, not
  `Site 2` or a generated label. A plant manager thinks *"the Hillsboro plant"*; if the
  product makes them translate that into an id, the product is harder to use than the
  spreadsheet it replaces.

**⚡ The design decision to record, because it is the one that could go wrong: site is a
property of DATA, not of PEOPLE.** A permit belongs to a site. A user belongs to the
*company* and sees everything in it. *"Which site am I looking at"* is a **filter** — a
dropdown, with roll-up as "all sites" — and never a permission.

The tempting alternative is per-user site access, and it is a trap. It makes the simple case
(one site, one person) complicated, it turns a dropdown into a permissions system with an
inheritance model and an admin screen, and every query then has to ask *"which sites may this
person see"* before it can ask anything useful. If a customer later asks that the Hillsboro
manager not see Seattle's findings, **that is a separate permissions feature**, priced and
built as one — not something to pre-build for a customer who has not asked.

**Not in this phase:** the site selector, the roll-up dashboard, per-site onboarding. Those
are interface, they live in `MODULES`, and they get built when a customer asks for them.

---

## PHASE 2 — The runtime pipeline ✅ **THE QUALITY ITEMS ARE CLOSED — 12 September 2026**

> **Where Phase 2 stands, 12 September 2026, read from both databases:**
> **2.1 ✅** 33 agencies · 187 of 194 requirements assigned · 56 coverage rows.
> **2.2 ✅** the determination gate, live on `/api/chat` and `/api/audits`, both directions
> verified by `npm run golden`.
> **2.3 ✅** the critic pass, live on both, acceptance met against the frozen 2.5L artifact
> and the negative control held.
> **2.5 🟡** task-based model routing done; token usage, the wider temperature audit and
> `scan-website` still open.
> **2.8 🟡** the runner exists as `npm run golden`; three cases.
> **Still open: 2.4, 2.6, 2.7.** **6.2 ✅ was pulled forward** so the critic was built against
> a gate with a real vocabulary behind it.
> Both environments on **000–014**, **798 census objects each, 0 differences** (byte-identical
> output, same sha256), **95 switches, 40 edges**, and **199 of 200 live requirements carrying
> a machine-evaluable condition**.
>
> ### What Phase 2 costs, measured — and which stage owns it
>
> | stage | measured | note |
> |---|---|---|
> | Stage 1, the gate | **6–10s** | the cheapest thing in the pipeline |
> | generation | **30s avg**, 21–39s | on `claude-sonnet-4-5`, the default |
> | Stage 5, the critic | **84s avg, 37–151s** | **more than the other two combined** |
>
> **The critic is the expensive stage, and the cause is structural.** It is handed **all 31
> agencies** with jurisdiction over the company, because **Stage 2 does not exist to narrow the
> list to the ones this question actually touches.** `docs/CRITIC-PASS.md` §5 chose that
> deliberately — a list too broad produces a false positive a human can dismiss, while a
> missing list produces a silent gap nobody sees.
>
> **🔴 DO NOT OPTIMISE THE CRITIC PROMPT OR DROP ITS TIER. Narrowing the input is the fix, and
> it is Stage 2's job (2.4 and Phase 4).** Tuning the prompt now optimises around a missing
> stage, and the gain is given back the moment that stage lands.
>
> *(An earlier note called this "the gate's 42-second cost". The gate is 6–10s; 42s was a single
> generation measurement recorded on 11 Sep. The expensive stage is the critic.)*

### What Phase 2 inherited — 11 September 2026

*Read from the database, not recalled.*

- **Two identical environments.** Staging and production both on migrations 000–010,
  verified object for object: **673 objects each, 0 differences in either direction.**
  *(Current as of 12 Sep: **000–012, 619 objects** under a differently-built census —
  `AUDIT-CHECKS.md` check 10. This block records what Phase 2 inherited on 11 Sep.)*
- **A migration chain proven from nothing.** `npm run db:reset` rebuilds staging empty and
  runs 000→010. Run it after adding a migration, not before shipping one.
- **A categorised library.** 194 rows, 192 active, 2 retired parents, 6 split children.
  Every row has one of ten obligation types and a jurisdiction layer. **94 of 192 are
  Oregon-specific**, which is why the match key decides roughly half of what a customer is
  told.
- **22 enum types**, 71 policies (64 through `auth_company_id()`), `anon` holding nothing.
- **Five tables ahead of their callers** — `switches`, `company_switches`,
  `industry_coverage`, `library_candidates`, `jobs` — all empty, all with no reader yet.
- **Every company has exactly one primary site**, and a trigger keeps that true for the
  next one.
- **The six-case match rule written down** (`CHEMICAL-OR-WA.md` §3.2) and **not
  implemented** — that is Phase 4.1, not this phase.
- **`npm run check` guards the query strings the compiler cannot see**
  (`scripts/check-schema-contracts.js`), written after a column rename broke signup in
  production with a green build.

**What Phase 2 does NOT inherit:** any obligations. The table is empty in both environments
and stays empty until the resolution engine exists in Phase 4.1. The requirements screen is
blank by design — `STATUS.md` says so, and it is not a regression.



Where answer quality actually changes. Everything here is ⚡.

### 2.1 🔒 Agency list ✅ **DONE (11 Sep) — applied to staging AND production**
Moves cannabis from *enumerate from nothing* to *bounded agency scope*. **Highest value per hour in the entire plan.**

**What landed:** migration 011 (uniqueness, NOT NULLs, the jurisdiction CHECK, the GIN index,
and the `verified`-needs-a-verifier CHECK, each tested by violation) · **33 agencies** ·
**187 of 194 requirements assigned a regulator** from a reviewable mapping table, 7
deliberately NULL · **56 `industry_coverage` rows**, all `not_built`. Both environments
verified identical: 615 objects, 0 differences, and 0 differences across agencies,
assignments and coverage compared row by row.

- ⬜ Chemical Oregon: Oregon OSHA, DEQ, OSFM, local fire, local sewer, SoS, DOR, BOLI, ODOT, ODA + federal OSHA-baseline, EPA, DOT/PHMSA, FMCSA
- ⬜ Cannabis Oregon: OLCC, Oregon OSHA, ODA, DOR, Water Resources, DEQ, local fire, local jurisdiction,
  **+ federal OSHA-baseline, EPA, DOT/PHMSA** — *corrected 11 Sep, see below*
- ⬜ Tag by industry via `industries[]`

> **CORRECTION, 11 September 2026 — the cannabis list omitted three federal agencies.**
> As originally written it named only state and local regulators. That makes **solvent
> extraction — the part of the cannabis vertical that *is* chemical manufacturing —
> invisible to Stage 2.** Extraction generates spent-solvent hazardous waste under RCRA
> (EPA), ships butane and ethanol under 49 CFR (DOT/PHMSA), and its workplace standards are
> the federal OSHA baseline that Oregon OSHA adopts under OAR 437. Omitting them undercuts
> the shared-library thesis (`CLAUDE.md` §7 — "cannabis extraction and chemical blending
> share OSHA and fire-code requirements") at the first opportunity to demonstrate it.
>
> **The industry slug is `cannabis`**, matching the only existing usage (`companies.industry`).
> Fixed here because this list is where the agency rows were built from.

- ⬜ **Fill `agencies.url` in a checked pass against live pages.** All 33 rows load with
  `url = NULL`, deliberately. A plausible URL can be produced for every agency from model
  memory, and that is exactly the problem: an unverified link is the fact class `CLAUDE.md`
  §6 says must carry a verification badge, and **`agencies` has no badge column — so an
  unverified URL has nowhere to declare itself as unverified.** Blank is the only honest
  state the table can currently express. Do it the way the golden-file citations were done:
  open each page in-session and record what it actually says.

### 2.2 Determination gate — Stage 1 ✅ **DONE (11 Sep) — live on both `/api/chat` and `/api/audits`**
Full spec: `docs/DETERMINATION-GATE.md`. Decisions: `DECISIONS.md` §34, §35.

- ✅ Classify: what facts decide this, which are known, which are blocking
- ✅ **An "ask" path** — and it is a **discriminated union**, not a field. `DECISIONS.md` §34
  corrects §4: the schema did not lack a question slot, it had an ADDITIVE one positioned
  after the answer. All three additive slots removed.
- ✅ At most one blocking question — enforced by the **shape** (`ask` is an object, not an
  array), always paired with a non-empty `unlocks`
- ✅ Stricter threshold for checklists — and the checklist schema has **no conditional
  field**, enforced at compile time in `lib/answerSchema.ts`, so hedging is unrepresentable
  rather than discouraged
- ✅ `/api/chat` authenticated as part of this, because the gate reads `company_switches`

**Acceptance MET, verified by `npm run golden` against staging:** the 2.5L bottle question
returns `outcome: 'ask'`, names the SDS, and lists five unlocks. And the **proceed** case
(003) verifies the other direction — it does not ask when the facts are there.

⬜ **Still open from 2.2:** `checklist_items.is_determination` and `.clarifying_questions` are
columns that nothing populates any more; dropping them is a migration. And the per-step
determination UI in `app/compliance/page.tsx` is dead for new checklists but live for saved
ones, so it cannot simply be deleted.

### 2.3 Critic pass — Stage 5 ✅ **DONE (12 Sep) — live on `/api/chat` checklist mode and `/api/audits`**
Fresh call, sees only the output, adversarial framing. Full spec: `docs/CRITIC-PASS.md`.
Decision: `DECISIONS.md` §39.

**Acceptance MET against the frozen 2.5L artifact** (`baseline-outputs/`, production, 21 Jul):
**13 findings, 7 blocking**, and all seven §4 errors caught — including the combination-packaging
error, quoted and explained. **Plus four §4 never named**: an asserted ISO 9001 certification
nobody established, staff assumed at a Reno workplace when the only established site is
Hillsboro, the wrong limited-quantity section (173.150 for a load called corrosive), and a
coverage finding that **Oregon OSHA has jurisdiction and is never mentioned** — §1.2's State
Plan trap, caught against the agency list 2.1 built.

**Negative control held: case 002, verified correct — 0 blocking.** Without it a critic that
flags everything passes the first test perfectly (`DECISIONS.md` §35.2).

⬜ **Open from 2.3:** questions 1 and 2 (physical object, regime) can only be *inferred* from
prose — nothing in `ChecklistItem` carries either, because making the model state them was
Stage 4 and Stage 4 is not built.

**What 2.3 inherits from 2.2:**
- **A gate that stops the pipeline**, so the critic never sees an answer built past a missing
  determination — which removes the largest class of thing it would otherwise have to catch.
- **`gate.resolved.non_blocking_unknowns` as a list.** Critic question 7 — *"does any
  statement assume a fact the user did not provide?"* — is checkable against a field rather
  than re-derived from prose. Populated by the model today and by a query after 6.3, with the
  same name and shape, which is what lets golden files survive that swap.
- **`conditional_on` on the answer path**, so a declared hedge is inspectable.
- **`npm run golden`**, so 2.3's cases are entries rather than transcripts.
- **95 switches and 193 agency assignments on 200 live rows**, so "what obligations of that agency are
  conspicuously absent" (critic question 6) is answerable against a real agency list.

**What 2.3 must not assume:** obligations are empty until 4.1, `company_switches` is empty
until determination writes to it, and **a clean gate does not mean an anchored answer** — a
cannabis customer gets `proceed` with zero library rows behind the result.

- ⬜ Physical object · regime · scope exclusions · assumed determinations · every date/fee/threshold · agency coverage · unstated assumptions
- ⬜ Must see what the answer is *built on*, not just the latest turn
- ⬜ Strongest model
- ⬜ Material error → one loop back to identification

**Acceptance:** catches the combination-packaging error in the saved 2.5L output.

### 2.4 Split identification from expansion ⚡ ⏱ 1 day
> **Measured argument for this, 12 Sep — `DECISIONS.md` §42.4.** A generation benchmark found
> **every** finding was about identification: wrong physical object, wrong threshold, wrong
> regime. **None** was about the quality of the sub-step prose. And the stronger model is
> ~3× slower, which today is an objection to it doing *both jobs in one call* rather than an
> objection to the model.
>
> Split them and the tiers already exist: `judgement` on the stronger model for a short
> structured call, `prose` on the cheaper one for the long narrative. **Build these as two
> stages for that reason, not only for the temperature difference.**

- ⬜ Identification at `temperature: 0.1`, stating physical object and regime per requirement
- ⬜ Only survivors get sub-steps and costs
- ⬜ Sub-steps go to determination and decision first, procurement second

### 2.5 `lib/ai.ts` improvements 🟡 **routing DONE (12 Sep); three items open** ⚡
- ✅ **Task-based model routing** — `judgement` · `critique` · `prose` · `default`, private to
  `lib/ai.ts` per `CLAUDE.md` §3.4, each overridable by environment and each falling back to
  `AI_MODEL`. Built as step one of 2.3: critique on the same tier as generation gives up the
  asymmetry the whole stage rests on.
- ⬜ Record token usage per call
- 🟡 **Temperature audit across every call site** — the incompatibility below is found and
  handled; the wider audit of *which* calls should carry a temperature at all is still open
- ⬜ Migrate `scan-website` back through `askAI()` (web search is now supported)
- ⬜ **Revisit the generation default when 2.4 lands.** `DECISIONS.md` §42 measures
  `claude-opus-5` as better on transport-shaped generation — case 002 clean, Sonnet blocking
  in both runs and Opus in neither — and ~3× slower. The default stays on
  `claude-sonnet-4-5` until identification and expansion are separate calls, at which point
  the arithmetic changes.

> ## 🔴 THE MODEL UPGRADE THAT WOULD HAVE BEEN A PRODUCTION INCIDENT
>
> **The Claude 5 family REJECTS `temperature` outright.** Not ignores — a **400**:
> `` invalid_request_error: `temperature` is deprecated for this model. ``
>
> | rejects | accepts |
> |---|---|
> | `claude-opus-5` · `claude-sonnet-5` · `claude-fable-5-1` | `claude-sonnet-4-5` · `claude-haiku-4-5-20251001` |
>
> **Six call sites pass `temperature: 0.1`:** the determination gate, both `/api/audits`
> classify calls, the audit match call, and document review.
>
> **`AI_MODEL=claude-sonnet-5` is a one-line environment change that reads like ordinary
> maintenance.** Before 12 Sep it would have taken out all six at once — the gate returning
> nothing on a route with no way to say so, and every audit failing at classification. **It
> would have been found as a production incident**, by a customer, on a Monday.
>
> **Handled in `lib/ai.ts`: the parameter is DROPPED for models that do not accept it**,
> rather than the call erroring. Temperature 0.1 means *be deterministic*, and those models
> are deterministic by default — the intent survives and only the knob is gone. Logged once
> per call so it is greppable rather than silent. `DECISIONS.md` §40.2, `AUDIT-CHECKS.md`
> check 15.
>
> **The transferable part:** a model upgrade is not a configuration change. The parameters a
> model accepts are part of its contract, and that contract is a fact about an account rather
> than about the world — checked the way a constraint name is checked (`CLAUDE.md` §3.7),
> from the thing itself. `claude-opus-4-1`, named from memory in the first draft of the
> routing, does not exist on this account at all.

### 2.6 Zod at the AI boundary ⬜ ⏱ 2 days
`askAIJson` returns `any` after a `JSON.parse`. A malformed extraction surfaces as a Postgres error rather than a per-field diagnosis.

**Found 9 Sep, live on staging — an empty model response becomes a raw 500.**
`JSON.parse` at `lib/ai.ts:107` runs unconditionally on whatever came back. The
truncation guard above it (line 63) only fires on `stop_reason === 'max_tokens'`, so a
response that is empty for any other reason is never caught: `JSON.parse('')` throws
`SyntaxError: Unexpected end of JSON input`, which propagates out of the route and
reaches the caller verbatim as `{"error": "Unexpected end of JSON input"}`.

- **Reproduction:** `POST /api/audits` with a question that classifies as a named
  standard, so the classify call runs with `enableWebSearch: true` at 16k max tokens.
  Failed after 37s against staging. Server log:
  `Audit engine error: SyntaxError: Unexpected end of JSON input`.
- **Not caused by the identity changes** made to that route the same day — the request
  got as far as the classify call, so session, company lookup and industry guard all
  passed. Very likely pre-existing; not proven by testing the prior code.
- Two things need fixing together: the guard must cover an empty or unparseable body,
  not only the truncation stop reason; and the failure must not surface as a bare parser
  string. See 2.7 — this is exactly the case where `error_message` should carry the
  first 3000 characters of the raw response so a bad extraction is diagnosable from the
  database days later, and `response_message` should say something an operator can act on.
- Logged, not investigated, by decision.

### 2.7 Two error messages ⬜ ⏱ half day
- ⬜ `response_message` — plain language, always written, success and failure
- ⬜ `error_message` — technical, with the first 3000 chars of raw model output on parse failures
- ⬜ Fix silent failures: storage upload, DB insert, export

### 2.8 Golden-file test set 🟡 **RUNNER BUILT (11 Sep) — `npm run golden`. Cases still growing.**
- ✅ Schema: input, expected, actual, matched, missed, extra
- ⬜ **Test #1 is the 2.5L bottle case with the correct answer written out** — and it now
  carries **three** assertions, not one. See `TESTING.md` "Case 001".
  - ⬜ the gate asks for the SDS rather than enumerating past the missing packing group
  - ⬜ **the answer draws on NO Oregon agency.** Reno→Philadelphia is entirely federal; only
    PHMSA's 15 and FMCSA's 7 rows are in scope. All 31 Oregon-chemical agencies returning
    from Stage 2 is the §3.2 jurisdiction failure arriving from the *over*-serving side
  - ⬜ **the answer states that origin and destination state requirements are not covered.**
    Neither Nevada nor Pennsylvania is in the library — 94 Oregon rows, 98 federal, nothing
    else — so silence about them implies a completeness we do not have
- ⬜ Add every failure found
- ⬜ Re-run after every prompt change or model upgrade

> **Assertion 2 is checkable only because of Phase 2.1, which was not why 2.1 was built.**
> Before `agency_id` was assigned, "the answer drew on Oregon material it should not have"
> was a judgement requiring somebody who already knew the Oregon library well enough to
> recognise a row from it. It is now a `WHERE` clause. The column was added to bound Stage 2's
> enumeration; it also made **the negative case** — did the wrong rows stay out — mechanical,
> and that is the half that degrades silently.

---

## PHASE 4 — Resolution engine

Pure code. No AI. The easiest piece, and the one that most needs tests.

### 4.1 Resolution function ⬅️ **THE NEXT LARGE PIECE** ⏱ 3 days
Jurisdiction + switches + library version → obligations. Deterministic.

**What 4.1 inherits from Phase 2 and 6.2 — most of its inputs now exist:**

| input | state |
|---|---|
| **the library** | **205 rows, 200 live**, every row categorised, **193 carrying a regulator** (7 deliberately NULL) |
| **jurisdiction** | on `entities`; one primary site per company, guaranteed by migration 010 |
| **the switch vocabulary** | **95 switches**, 40 dependency edges, acyclic (95 nodes reached, 55 roots, 40 children, max depth 1), 6 numeric with thresholds |
| **agency scope** | `lib/agencyScope.ts` — the jurisdictional list, already used by the critic |
| **coverage** | 56 rows, so an answer can say which agencies have nothing behind them |

**What it does NOT inherit, and this decides the order of work:**

- **`company_switches` is empty and stays empty until something writes to it.** The vocabulary
  exists; no company's *answers* do. Resolution reads values, not definitions — so 4.1 has a
  table to read and nothing in it. **Determination is the prerequisite, not the library.**
- **No requirement points at a primary source** — 0 of 200 live rows carry a `citation_url`, a
  quote or a checked date, and 0 are at `status = 'verified'`. That does not block resolution;
  it blocks anyone *trusting* its output.
- **The chemical reference table is empty.** `regulated_substances` holds 0 rows, so the 15
  conditions that call `substance_inventory()` return `unknown` rather than a verdict. Verified
  against the function body: with no inventory rows the first branch returns `null`, and with
  inventory but no reference data every row is unevaluable and lands on the same `null`.
  **There is no state in which the unseeded table produces a clear** — but 4.1 should expect
  those 15 to be open questions rather than answers on day one. Seeding it is 6.4b.

**`applies_expression` is no longer on this list — 6.3 landed on both environments on 12 Sep.**
199 of 200 live rows carry a condition, 83 distinct switches are referenced and none dangles.
6.3a was answered (per-substance thresholds live on `regulated_substances`, not on switches).

**So the honest sequence is now determination → 4.1**, and 4.1's three days are the
smallest part of it. `CLAUDE.md` §3.2's safety properties become testable for the first time
when it lands — **not one of them can be checked today**, because `obligations` is empty in
both environments and nothing writes to it.

### 4.2 Atomic `close_and_replace_obligations` ✅ **DONE (12 Sep) — migration 016, staging**
**Renamed from `replace_obligations`, and the rename is the decision** — `replace_` is what
carried DELETE semantics in from `PATTERNS.md` §4, and §3.2 forbids deleting obligations at
all. `DECISIONS.md` §47. Closes changed or departed rows by setting `applicable_to`, inserts
the new ones, in one transaction. **Half-written obligations are worse than stale ones.**

`SECURITY INVOKER` · `search_path = ''` · ownership guard raised in SQL · `REVOKE` from
PUBLIC/anon/authenticated, `GRANT EXECUTE` to `service_role` only (ACL verified against
`pg_proc.proacl`, not the caller-filtered view — see `AUDIT-CHECKS.md` check 22).

Seven behavioural tests in the migration, all verified live through the service role:
first-run insert · **idempotence** (a repeat writes nothing) · status change closes one and
opens one · **`undetermined` → `does_not_apply` leaves a closed row behind it**, so the claim
is auditable · a departed requirement is closed, never deleted · cross-tenant `entity_id`
refused before any write · **a fault injected mid-INSERT rolls the close back with it**, so a
failed recompute cannot leave a company's list closed-but-not-replaced.

#### 4.2b Revoke EXECUTE on `substance_inventory` from PUBLIC ⬜ ⏱ 10 min
Migration 013 created it with no revoke, and **Postgres grants EXECUTE on every new function
to PUBLIC by default** — `CLAUDE.md` §3.6's "not granting is not denying", which is recorded
for tables and not for functions. It leaks nothing today because `anon` holds no grant on
`company_chemicals`, so the protection is a *table* grant rather than the function grant —
the compensating-control shape §45 says must be named and tested. `AUDIT-CHECKS.md` check 22.
**Do it in the next migration that touches grants, and use `pg_proc.proacl` to verify.**

### 4.3 Determination chain ⬜ ⏱ 1 day
`produces_switch` writes back, re-resolve, cap at 3 passes.

### 4.4 🔒 First tests in the codebase ⬜ ⏱ 2 days
Vitest. The safety properties must be covered:
- ⬜ `unknown` never yields `does_not_apply`
- ⬜ expired evidence never yields `satisfied`
- ⬜ state X never receives state-Y requirements
- ⬜ resolution is idempotent
- ⬜ obligations are never deleted, only marked

Then `npm run check` becomes `typecheck && test && build`.

---

## PHASE 5 — The worker

### 5.1 Worker skeleton ⬜ ⏱ 3 days
`jobs` table as queue · poll loop · compare-and-set claim · per-job-type serialization · stuck-job clearing · progress messaging · cancel checkpoints.

**Never assume a single instance.** Fast lane (documents) separate from slow lane (library generation).

### 5.2 First job: `index_document` ⬜ ⏱ 3 days
Index on upload, not lazily during audit. By audit time every document is already indexed.

### 5.3 Deployment ⬜ ⏱ 1 day
Railway or similar. **The worker does not hot-reload** — restart after every change.

**Two hard limits:** the worker never publishes regulatory content (writes `generated` to a review queue). The determination gate and critic stay synchronous.

---

## PHASE 6 — Library: chemical Oregon

### 6.1 Migrate the rows ✅ **DONE in Phase 1 (11 Sep)**
Superseded by the Phase 1 rebuild. The library is **194 rows — 192 active, 2 retired
parents, 6 split children** — loaded into both environments from
`supabase/seed-data/REQUIREMENTS-FILLED-2026-09-11.xlsx`, every row categorised. It was 188
when this line was written.

### 6.2 Load the switches ✅ **DONE (11–12 Sep) — applied to staging AND production**

**What it verified, beyond the loader's own check:** the composite FK `(switch_id, scope)`
binds in **both** directions — a site-only switch claimed as `company` and a company-only
switch claimed as `site` were each refused. `site_scope_has_a_site` refused both a site
switch with no `entity_id` and a company switch with one. Both threshold CHECKs refused a
boolean carrying thresholds, an unsorted array and duplicates. Three positive controls were
accepted and cleaned up. 10 of 10 as expected, and `company_switches` back to 0.

**And the graph:** 0 dangling `depends_on_switch`, 90 of 90 reachable from a root (an
unreachable switch would mean a cycle), depths `{1: 55, 2: 35}` — a forest of shallow trees
two levels deep, identical on both databases.
**~59, not 46.** `substance_exposure_above_action_level` decomposed into one switch per
substance (`DECISIONS.md` §23.1) — each has its own action level, standard and requirement.
Definitions, hierarchy, jurisdiction variants, volatility. The `switches` table exists and
holds **0 rows**; this is what fills it.

⚠️ The seed will be a bulk insert with heterogeneous keys, which needs
`defaultToNull: false` — see the note in migration 008 beside `allowed_values`.

### 6.3 Write `applies_expression` for the active rows ✅ **DONE (12 Sep) — applied to staging AND production**

**199 of 200 live rows carry a machine-evaluable condition, in both environments,
byte-identical.** 83 distinct switches referenced, **0 dangling**, 0 retired rows carrying one.
The 200th is deliberately NULL and is named in 6.4 below.

Shipped: **migration 013** (`regulated_substances` keyed by CAS, `company_chemicals`
site-scoped, `substance_inventory()`, and three under-decomposed rows split into 11);
**migration 014** (an unidentified chemical makes the answer `unknown`, not `false` —
`DECISIONS.md` §45); **`lib/appliesExpression.ts`** (nested JSON, three-valued `evaluate()`,
and a renderer that ships with it); **`scripts/load-expressions.js`** (`npm run expressions`),
which refuses an unknown switch, a threshold not quoted from the rule's own text, and a clause
true of every company — and prints every non-high-confidence condition as English, because a
dry run nobody can read is a dry run nobody does.

**What it inherited from 6.2:**
- **90 switches with agreed ids** *(95 by the time 6.3 finished — 6.3 added the five its own
  expressions needed)*, derived from the 188 trigger strings these expressions
  will be written against — so the expression and the prose are talking about the same fact.
- **6 numeric switches carrying their thresholds**, so `15` lives in one place instead of
  being hard-coded into the ADA row, the Title VII row and the PWFA row — three places to get
  it wrong and nowhere to look it up.
- **35 dependency edges, acyclic** *(40 now)*, so an expression can rely on a parent fact being
  establishable first.
- **90 `question_plain` strings** *(95 now)*, so nothing has to invent the wording.
- **`employee_count` split company/site**, so an expression can say which one it means.

**What it must decide before it can finish:** 6.3a below. Four switches are boolean because
their thresholds are per-chemical, and no expression can be written for them until that shape
is chosen.

#### 6.3a ✅ THE OPEN SHAPE QUESTION — per substance, not per site — **ANSWERED 12 Sep**
*Raised 11 Sep by the 6.2 seed. Not a limitation to work around — a modelling problem that
recurs four times, and whatever 6.3 decides for one of them decides for all four.*

> **Answered by migration 013: the thresholds belong to the SUBSTANCE, not to the site.**
> `regulated_substances` is keyed by CAS number and carries EHS TPQ, TRI manufacture and
> otherwise-used, PSM, RMP and CERCLA RQ; `company_chemicals` records what a site holds;
> `substance_inventory(entity_id, list)` asks *does this site hold any one substance at or
> above ITS OWN threshold on this list?* One function, four questions, because all four are
> that same shape. **Keyed by CAS and not by name**, because "isopropanol", "isopropyl
> alcohol" and "IPA" are one chemical with three names and every published list — EHS
> Appendix A, TRI, PSM Appendix A — is published by CAS. `DECISIONS.md` §23.1's own reversal
> condition anticipated this case. The reference table is still empty; seeding it is 6.4b.

Four switches are **boolean because their thresholds are per CHEMICAL and a site-level
number cannot express them:**

| Switch | The threshold that will not fit |
|---|---|
| `tier2_epcra_threshold` | 10,000 lb **of any one hazardous chemical**, or the lower of 500 lb and the TPQ for an EHS |
| `ehs_above_tpq` | each extremely hazardous substance has **its own** threshold planning quantity |
| `tri_reportable` | 25,000 lb manufactured or processed, 10,000 lb otherwise used — **per listed chemical**, with much lower PBT and PFAS thresholds |
| `psm_rmp_threshold` | Appendix A lists **a threshold quantity per substance** |

Add TSCA Chemical Data Reporting, whose threshold is also per substance, and it is five.

**Why it cannot be solved the way §23.1 solved the last one.** `substance_exposure_above_action_level`
decomposed into 14 switches because the library holds exactly 14 substance standards — a
**closed** set. These are **open**: EPCRA's list is hundreds of substances, TRI's is
hundreds more, and both change. One switch per substance is unbounded, and §23.1's own
reversal condition anticipates exactly this case.

**Why it must be solved once rather than four times.** All four ask the same question — *does
this site hold substance X above quantity Y* — and four different answers would mean four
different shapes in `applies_expression`, four places for the resolution engine to get the
matching subtly wrong, and four screens showing the same fact differently.

Three shapes worth considering, none chosen: **(a)** a `company_chemicals` table — one row
per substance per site with a quantity, which `applies_expression` joins against; **(b)** a
switch per *regulatory list* rather than per substance, keeping the quantity in evidence;
**(c)** keep the booleans and make the determination requirement's own output the record.
**(a)** looks most likely and is the largest, because it is a new table in the spine.

**Blocked on nothing.** It needs a decision, not data.

#### 6.3b `is_determination` is wrong on three rows ⬜ **still open — re-measured 12 Sep**
*Found 11 Sep while seeding switches. Library-quality, not switch work — these live on
`requirement_templates`, which is why 6.2 did not touch them. 6.3 did not touch them either:
it writes `applies_expression` and nothing else.*

> **Measured 12 Sep on both environments: 9 of 200 live rows carry `is_determination = true`,
> `Monthly generator-category determination` is still `false`, and `produces_switch` is NULL on
> all 200.** So the second half of every item below — wiring a determination to the switch it
> produces — is unstarted across the whole library, not only on these three rows.

- ⬜ **`Monthly generator-category determination` should be flagged and is NOT.** It is the
  most determination-shaped row in the library: named "determination", monthly **by
  regulation**, and its output gates **16 other requirements** — more than any other switch.
  It should carry `is_determination = true` and `produces_switch = 'hazwaste_generator_category'`.
- ⬜ **`Pay statement expanded disclosures (2026)` should NOT be flagged.** It determines
  nothing. It is also the row whose citation is `2025 session law, eff. Jan 1, 2026`, already
  flagged as having no enforceable citation — one row with two problems.
- ⬜ **`Chemical storage compatibility / segregation` should NOT be flagged.** A `universal`
  row with no trigger prose at all; calling it a determination looks like a generator flag
  rather than a judgement.

- ⬜ **And `produces_switch` is NULL on all 9 currently-flagged rows.** The seed names what
  each should point at — `air_permit_required`, `industrial_stormwater`, `or_cr2k_threshold`,
  `business_type`, `hazardous_chemicals_present`, `hazardous_piping_present`,
  `has_group_health_plan`. Three of those switches did not exist before 6.2, which is its own
  evidence that the flag was set before the vocabulary existed.

### 6.3c WHICH SOURCE IS THE LIBRARY — the worksheet, or the database? ⬜ ⏱ half day

*Named by `supabase/migrations/013_chemical_inventory.sql:393` on 12 September and written here on
22 September, when `npm run db:restore` refused its first run over it.*

**The worksheet holds 194 rows. Staging and production hold 205.** The difference is 013's three
splits — 11 children, 3 parents retired — which exist in the migration file and in the two live
databases and **in no seed file.** A from-zero rebuild loses them silently, because 013 is a no-op
against the empty table the chain hands it (0.10 above has the lines).

| | What it means | Cost |
|---|---|---|
| **The worksheet is authoritative** | Regenerate it from the live library: 205 rows, the 3 parents carrying `effective_to`, the 11 children carrying `split_from` | The load path stays one file and one script, and `db:restore` works again |
| **The database is authoritative** | The restore grows a step that re-applies content migrations after the library loads | A migration's effect now lives in two places, and the next content migration has to remember |

**The first looks right** — `load-requirements.js` already round-trips every column the splits use,
including `split_from` by name — **but it is a decision about where the library lives, not a
refactor, so it is the owner's.** Until it is made, `npm run db:restore` refuses and the owed
reset for 029 and 030 stays owed.

**One loose end found beside it:** 013's comment says the splits added *"these nine"*; the rows say
**eleven** (3 + 3 + 5, `select p.requirement_name, count(c.id) … join … on c.split_from_id = p.id`).
The migration is applied and must not be edited; the number is recorded here instead.

### 6.4 Finish what 6.3 could not ⬜ ⏱ 3 days + 6.4c

**Named work, not loose ends.** 6.3 shipped 199 conditions and wrote down which of them it did
not trust. These are those, and each has a stated reason rather than a TODO.

#### 6.4a The six low-confidence conditions ⬜
Five over-trigger and one under-triggers. **Fix the under-triggering one first** — an answer
that is too broad is visible in the UI, an answer that is too narrow is silent.

| Requirement | What is wrong | Direction |
|---|---|---|
| **NSPS/NESHAP/MACT applicability screen** | Gated on holding an air permit. Applicability turns on source category, HAP, capacity and construction date — none of which is a switch, and an **unpermitted source can still be subject**. | ⚠️ **under-triggers** |
| Chemical Data Reporting | Written as an AND of manufacture and import; the rule is an OR. The volume threshold has no home — CDR thresholds are per substance and `regulated_substances` has no CDR column. | over |
| Electronic submission of Form 300A (20–249) | The "listed industry" half is NAICS and absent, so it fires for **every** 20–249 site. | over |
| Electronic submission of Forms 300 & 301 (100+) | Same gap — Appendix B membership is not expressible. | over |
| EPCRA §311 SDS/list | The 10,000 lb half has no inventory list behind it; a boolean stands in for half the test. | over |
| EPCRA Tier II | Same gap as §311. | over |

**Four of the six are one missing input: NAICS.** `companies.industry` exists and the evaluator
cannot reach it (`DECISIONS.md` §36.2 decided industry is not a switch). Deciding how a
condition reads industry closes 4 of these 6 and several of the 18 medium ones at once.

#### 6.4c LIBRARY-QUALITY REVISION — all 199 conditions, informed by the SCREEN ⬜ ⏱ 4–6 days
> ### This is now the largest item in phase 6 and it gates showing `does_not_apply` to anyone.

**Why it exists.** Cases E, F, G and I passed on 13 Sep — the mechanism is sound. **A ten-minute
domain read of the rendered rows then found three shapes of wrong rule that 199 expression
reviews had not** (`DECISIONS.md` §64). Reading a spreadsheet asks *"is this well-formed"*.
Reading **"Ruled out by: hazwaste_generator_category = vsqg"** on a screen asks *"is that actually
true of this business"*, and only the second question catches a rule that is valid,
machine-checkable and wrong.

**(i) The 22 clauses that can NEVER be true — the floor, and the only part a query can find.**
`AUDIT-CHECKS.md` check 28, run 13 Sep:

```
   17x  hazwaste_generator_category (enum) is true
    2x  holds_iso_certification (enum) is true
    1x  flammable_liquid_quantity_band (enum) is true
    1x  wastewater_discharge (enum) is true
    1x  emergency_response_team (enum) is true
```

**A large-quantity generator gets ZERO hazardous-waste obligations** and is told so in a confident
sentence — proved by running the resolver at `lqg`, `sqg` and `vsqg` and getting identical output.
**Fix these first: they are unambiguous, they are the most dangerous direction (a confident
FALSE), and they need no judgement.**

**(ii) The three shapes, which are type-correct and invisible to every query.** Look for each
across all 199, not only where it was noticed:

| Shape | Example found | What to look for |
|---|---|---|
| **Federal-shaped rule removing an Oregon obligation** | `EPA hazardous-waste ID` **and** `Oregon hazardous-waste site notification`, both cleared by `= vsqg`. A VSQG is exempt **federally**; Oregon is more stringent | Any clause where a federal exemption threshold gates a `state`-layer row. §1.2 names this trap for citations; it is in the expressions |
| **Circular switch** | `Title V permit` ← `air_permit_required is title_v`; `Oregon ACDP` ← `air_permit_required in [...]`, and its `determination_source` is `documents` — learn whether you need a permit by reading the permit you hold | Any switch whose name restates its requirement. Honest version turns on potential-to-emit or source category — something establishable **before** the permit exists |
| **Switch narrower than the rule it gates** | `Chemical storage compatibility / segregation`, cited to **Oregon Fire Code Ch. 50**, cleared by `hazardous_chemicals_present = false`. IFC Ch. 50 covers hazardous **materials** — compressed gases, oxidisers — broader than the HazCom sense | Any boolean switch standing in for a defined regulatory term. Compare the switch's `label` against the citation's own scope |

**(iii) The ordering rule that follows.** **No production customer may be shown a
`does_not_apply` rationale until (i) and (ii) are done.** Of the four states it is the only one
making a confident negative claim on the product's own authority; `unknown` and `undetermined`
are honest under a wrong condition, and `applies` over-triggers, which is visible and arguable.

**How to work it:** against the rendered screen with a real fixture, not the JSON. That is what
found all of this, and it is `DECISIONS.md` §64's reversal condition — when an hour of reading
turns up nothing, the review goes back to periodic.

#### HOUSEKEEPING — a stale citation inside an applied migration ⬜ ⏱ 10 min
Migration 022's header **and its `comment on column`** cite `DECISIONS.md` **§60** for the lazy
write. §60 did not exist when 022 was written — the number was predicted, not read — and the
section that took it is the rule about recording findings from artifacts. The decision 022 meant
is **§62**. The code reference in `lib/obligationWriter.ts` is corrected; **the column comment is
live on production and cannot be edited in place**, because migrations are never changed after
they run (`CLAUDE.md` §3.7). Fix is a comment-only migration re-issuing `comment on column`.
Deliberately NOT folded into 023 — a migration does one thing (`DECISIONS.md` §56.1).

#### 6.4b Seed `regulated_substances` ⬜
0 rows today. EHS TPQs, TRI thresholds, PSM Appendix A, RMP and CERCLA RQs, all keyed by CAS.
**15 of the 199 conditions cannot return a verdict until this exists.** Also closes the DEA
gap: `regulated_substances` holds no DEA threshold column, so `DEA List I chemical
registration` currently triggers on *presence* rather than on the cumulative twelve-month
quantity the rule names (`DECISIONS.md` §44.1 — inventing that number would be the exact
fault the rule forbids).

#### 6.4c The one deliberate NULL ⬜
`Employee handbook, current version controlled`, cited as **"Best practice (not statute)"**.
It has no condition because nothing requires it — there is no fact that makes it apply. **The
question is not what expression to write; it is whether a best-practice row belongs in a
library of legal obligations at all.** Either give it a non-legal row type that the resolver
skips, or retire it. Leaving it live with a NULL condition means resolution has to special-case
one row, which is how `if (industry === '...')` starts.

#### 6.4d The 12 switches no condition references ⬜ **mostly expected**
Measured 12 Sep, identical on both environments: 83 of the 95 switches are named by a
condition, **0 dangle**, and 12 are referenced by nothing. **That is not one problem.**

**Four are expected and need no work.** `entity_state`, `multi_site`, `multi_state` and
`owns_vs_leases_facility` are *context*, not triggers — they tell the pipeline and the UI which
jurisdiction and which sites are in play. A switch earns its place by being readable, not by
appearing in a condition. Leave them.

**Eight are real gaps, and each is the same gap:** a quantity or activity trigger whose
requirement currently tests something coarser, because the data underneath does not exist yet.

| Switch | What the condition tests instead, and what closes it |
|---|---|
| `ehs_above_tpq`, `tri_reportable` | `substance_inventory()` against an empty reference table — closes with **6.4b** |
| `hazwaste_nonacute_kg_per_month`, `hazwaste_acute_kg_per_month` | a generator-category boolean — closes with **6.3b** |
| `hot_work_welding`, `spray_finishing`, `high_piled_storage` | the fire-code rows are scoped by occupancy class, which is not a switch |
| `dea_list_chemicals` | presence of a DEA List I chemical rather than the cumulative 12-month quantity (`DECISIONS.md` §44.1) |

**None of these is fixed by editing a switch.** Each is fixed by the data or the decision named
in its row, which is why this sits under 6.4 rather than in 6.2.

#### 6.4g Two rows are `entity_type = 'site'` and should probably be `organization` ⬜
**A DATA question, not a resolver question.** Found 12 Sep by the first multi-site resolution
run, and the distinction matters because the tempting fix is in the wrong place.

**What the run showed.** 21 live requirements fan out to one obligation per site — 19 because
`entity_type = 'site'`, 3 because their jurisdiction layer is `city` or `local` (one row is
both). For a two-site company that is 21 requirements producing 42 rows. **Of the 19, only
two name an expression made entirely of company-scoped switches:**

| Requirement | Expression | Why it looks wrong |
|---|---|---|
| `USDOT number and motor-carrier registration` | `owns_fleet` (company) | A USDOT number is issued to the **carrier**, once. A second plant does not get a second number. |
| `PHMSA annual hazmat registration` | `ships_placardable_hazmat` (company) | One registration, one fee, one registrant per year. Per-facility is not a thing PHMSA offers. |

Both are federal registrations issued to a **legal entity**, not to a facility. The other 17
use at least one site-scoped switch and fan out correctly.

**⚡ WHY A DEDUP IN THE RESOLVER WOULD BE WRONG, and this is the point of recording it here.**
The symptom — identical obligations at every site — is easy to make disappear: collapse rows
whose expression names no site-scoped fact. **That would be a silent, general rule fixing two
specific rows of bad data, and it would break the case this product exists for.** A company
that genuinely needs *one air permit per facility* has expressions that are company-scoped in
form and per-site in law; `Clean Air Act Title V permit`, `Oregon Air Contaminant Discharge
Permit` and `1200-Z industrial stormwater permit` all resolved **differently at two sites of
one company** in the same run. A dedup rule cannot tell those from these, because the
difference is not in the expression — it is in what the regulator issues. **`entity_type` is
where that fact belongs, and it is a library-verification question (6.8), not a code change.**

Same class as 6.3b: a column on `requirement_templates` carrying the wrong value, fixed by
correcting the row rather than by teaching the engine to compensate.

#### 6.4e The 18 medium-confidence conditions ⬜
**Three shapes, not eighteen problems.** (1) A rule whose text conditions *whether a plan must
be written* read as *whether it applies* — EAP, Fire Prevention Plan, lactation space. (2) An
**event** trigger where no switch records the event — CERCLA RQ release, EPCRA release
notification; these say "could owe this", not "owes this". (3) NAICS again — pretreatment,
OSHA log, Paid Leave Oregon. Fix the three shapes and most of the eighteen move.

---

#### 6.4f ⛔ Recount `industry_coverage.row_count` — **a live defect, not a task** ⬜
**`AUDIT-CHECKS.md` check 12 is FAILING on both environments as of 12 Sep.** One row: OR-OSHA
× chemical-manufacturing stores **53** where the live count is **61**. Migration 013 split
three OR-OSHA requirements into eleven — a net +8 — and nothing recounted the coverage rows.

**This is customer-visible.** `row_count` is what the coverage strip uses to say how much of an
agency the product covers, so today it understates OR-OSHA by eight requirements. Nothing else
reads the column, which is exactly why nothing noticed for two days.

**The fix is a recount and it must not be a one-off UPDATE.** A migration that splits, retires
or adds requirements changes coverage counts as a side effect, and this will recur on 6.5 and
6.6. Either the recount becomes the last step of the loader that owns coverage rows, or
`row_count` stops being stored and becomes a view — **and the second option is worth the
argument**, because a stored count with no owner is a number that drifts silently, which is the
whole reason check 12 exists.

### 6.5 Federal layer, agency by agency ⬜ ⏱ 1 week
~95 rows serving every state forever.

### 6.6 Oregon layer, agency by agency ⬜ ⏱ 1 week
**Cite OAR 437, not 29 CFR.** Oregon is a State Plan state.

#### 6.6a The six Oregon agencies with ZERO requirements behind them ⬜
*Found 11 Sep by `industry_coverage`, the day it was first populated. Not a bug — this is
the table doing the job it was built for. See 6.5c.*

Every one of these is in scope for a chemical-manufacturing company in Oregon — the Stage 2
query returns them — and every one has **nothing to return at Stage 3**. `CHEMICAL-OR-WA.md`
§1.3 already names content for most of them, so this is a starting list rather than a
research task. **Work them in this order; the first is the one a customer would notice
missing.**

- ⬜ **`OR-DOR` — Oregon Department of Revenue. 0 rows.** The gap that matters most. The
  **Corporate Activity Tax** is an Oregon-specific *gross receipts* tax with its own
  registration and filing obligations above a receipts threshold. It is not an income tax,
  it has no equivalent in most states, and a model reasoning from other states will not
  produce it — §3.3's failure mode exactly. A chemical manufacturer over the threshold owes
  it and the library currently says nothing.
- ⬜ **`OED` — Oregon Employment Department. 0 rows.** Unemployment insurance registration
  and payroll reporting, ORS chapter 657 / OAR chapter 471. Note the one library row that
  touches this is `Oregon payroll withholding/unemployment accounts`, deliberately left
  unassigned because it spans Revenue *and* OED — see 6.5b.
- ⬜ **`ODA` — Oregon Department of Agriculture. 0 rows.** Pesticide and fertiliser
  registration and licensing; food safety licensing where applicable. Conditional on what
  the company formulates, so it may resolve to `does_not_apply` for many customers — but
  `unknown` and "we have no rows" are not the same thing, and today it is the second.
- ⬜ **`ODOT-MCTD` — ODOT Motor Carrier Transportation Division. 0 rows.** Intrastate motor
  carrier and hazmat transport. The library has 7 FMCSA rows for the interstate case and
  nothing for the intrastate one, which is the more likely shape for an Oregon SMB.
- ⬜ **`LOCAL-SEWER` — local sewer authority / POTW. 0 rows.** Industrial wastewater
  discharge permit or pretreatment authorisation, self-monitoring and reporting, slug
  discharge control plan. §1.3 names Portland BES and Clean Water Services.
- ⬜ **`LOCAL-GOV` — local city or county jurisdiction. 0 rows.** Business licence, zoning
  and conditional use, building and occupancy, local stormwater.

**`OSHA` (federal) is also at 0 and is NOT on this list.** Every piece of OSHA content sits
on an Oregon row citing 29 CFR as its analogue, correctly routed to `OR-OSHA` (54 rows). Its
zero is accurate rather than a gap — Oregon is a State Plan state and federal OSHA does not
enforce here.

**All 25 cannabis coverage rows are also at 0**, including `OLCC`. That is the whole
vertical, not a gap within one, and it belongs to a future library rather than to 6.6.

#### 6.6b Two rows that need a decision, not a generation pass ⬜
*Both surfaced by Part C's assignment on 11 Sep and left `agency_id = NULL` on purpose.*

- ⬜ **`Oregon payroll withholding/unemployment accounts`** — genuinely two regulators,
  Revenue for withholding and the Employment Department for unemployment. This is what
  `secondary_agency_ids[]` exists for; somebody has to say which is primary.
- ⬜ **`Oregon continuation coverage (Mini-COBRA)`, ORS 743B.347** — regulated by the **DCBS
  Division of Financial Regulation, which is not in `agencies`.** Either add the agency row
  or assign by hand. It was not invented during the load, deliberately.

#### 6.6c What the empty coverage rows demonstrated — 11 September 2026
*The first evidence for a claim the design has been asserting since `CHEMICAL-OR-WA.md` was
written.*

§1.1's second job for the agency frame reads:

> **"A missing requirement inside a free enumeration is invisible. A thinly-covered agency
> in a known list is a visible gap."**

That was a prediction. **On the day `industry_coverage` was first populated it produced the
list above without anybody looking for it** — 32 of 56 rows empty, six of them naming an
Oregon regulator with real obligations and no library rows.

**None of those six was findable before.** The library was 194 rows in one undifferentiated
pile; "what is missing" had no shape to be asked against, and the only way to notice the
Corporate Activity Tax was absent was to already know it existed. The gap did not become
smaller — it became **addressable**, because the question changed from "what have we
forgotten" to "which of these 33 agencies has nothing behind it".

**The mechanism is worth naming because it generalises:** the value is in the rows with
**nothing** in them. A coverage table listing only what has been covered would have shown 24
green rows and no information. The `not_built` default is not a placeholder awaiting real
data — it *is* the data, and building the cross product rather than only the populated
combinations is what made it so (`DECISIONS.md` §32 records the one case where a `not_built`
row is deliberately withheld, and why that case is different).

### 6.7 Primary-source retrieval ⬜ ⏱ 4 days
Every disputed item and flagged specific resolved by **retrieval, not model vote.** eCFR, Federal Register, Oregon OAR/ORS.

### 6.8 Human verification by fact class ⬜ ⏱ 4 days
Dates/fees/thresholds → disputed → critical citations → divergence-table rows → `scope_rules`. ~50–60 rows. Mark `verified` with date **and verifier**.

### 6.9 Standing "confirm before publishing" list ⬜ ongoing
**CFATS is entry #1** — lapsed since July 2023, verified live. Models state it as current with full confidence.

---

## PHASE 6b — Employment law library (Oregon & Washington) *(library #2)*

**Why it is a phase and not a module.** A library is horizontal: employment obligations are
read by the HR module (M3) *and* belong in a chemical manufacturer's overall obligation list,
because they employ people. Same table, tagged `domain = employment` — see M3 for that
argument in full.

**Why second, ahead of cannabis:** it applies to **every** vertical — chemical, cannabis, hospice, brewery. It is the one domain that does not fragment by industry, and it is smaller than chemical.

- ⬜ Agency list: BOLI · Oregon OSHA · Paid Leave Oregon · Oregon Employment Dept · WA L&I · WA PFML · WA ESD + federal DOL, EEOC, FMLA/ADA
- ⬜ Generate agency by agency, same bounded method as chemical
- ⬜ **OR/WA divergences are the high-risk rows:** OFLA vs WA leave, Paid Leave Oregon vs WA PFML, state-fund vs private workers' comp, Oregon CAT vs WA B&O, OAR vs WAC citations, minimum-wage tiers
- ⬜ Employee-count thresholds are the core switch: 10 / 25 / 50 / 100
- ⬜ Primary-source retrieval, then human verification by fact class
- ⬜ Tag rows `domain = employment`

---

## PHASE 7 — Switches and evidence

### 7.1 Public-records lookups ⬜ ⏱ 4 days
EPA RCRAInfo (**generator category, free**), ECHO, TRI, FMCSA SAFER, DEQ/Ecology, SoS, **OLCC licensee list** (cannabis license type, endorsements, tier — free).

### 7.2 Switch determination from documents 🟡 **SCHEMA AND LOGIC DONE (12 Sep) — NO ROUTE CALLS IT**
Spec: `docs/SWITCH-DETERMINATION.md`. One AI pass; every value logs `basis`, `evidence_class`,
confidence and source.

**Shipped to both environments:** migration 017 (`evidence_class`, the append-only
`switch_determinations` history, `company_switches.determined_from`, and a **composite FK pinning
the denormalised class to the determination it came from**) · `prompts/switch-determination.ts`
(seven forbidden inferences, exported so a golden case can assert each survives a prompt edit) ·
`lib/switchDetermination.ts` (the precedence ladder and §49's overwrite history) ·
`lib/sdsExtraction.ts` (§48's CAS check digit).

**⛔ NOT BUILT — verified on disk, not assumed:** no route reads or writes `company_switches` or
`switch_determinations`; the four files naming either are comments or the account-deletion list.
`tests/golden-documents/` does not exist.

> ### THE MEASURED RESULT, and it is not the one anybody expects
>
> Test Alpha Chemical, 2 sites, **221 obligations**:
>
> | | applies | does_not_apply | undetermined | unknown |
> |---|---|---|---|---|
> | nothing established | 3 | 0 | 1 | **217** |
> | **+ three SDSs extracted** | **3** | **0** | **1** | **217** |
> | + one confirmation | 12 | 0 | 1 | 208 |
> | + one answer (`has_employees`) | 31 | 0 | 1 | 189 |
> | + a realistic profile incl. falses | 40 | **108** | 1 | **72** |
>
> **Three SDSs moved ZERO obligations.** An SDS is written by the manufacturer, is identical for
> every customer, and carries no quantity — so every threshold test correctly returned `unknown`.
> One confirmation moved 9; one question moved 19. **The chemical library a customer is proudest
> of is worth less than one question**, and that needs saying before a demo rather than during one.
>
> **And nothing ever moved from `applies` to `does_not_apply`** — not once, across every pair of
> states. It cannot: establishing a fact nobody had only settles an open question. Moving a
> requirement *off* a list requires *correcting* a fact, not supplying one. So "assume it applies
> until ruled out" would not have left a handful of wrong entries — it would have shown this
> company **108 requirements it is not subject to, beside the 40 it is**, indistinguishable.

#### 7.2a The routes ✅ **DONE 15 Sep — both routes, driven over real HTTP**
`/api/switches/answer` first — the smallest, and the one whose behaviour is already tested.

#### 7.2b Golden document cases ⬜ **BLOCKED ON A DECISION, NOT ON EFFORT**
A case needs a committed `source.pdf`. The only realistic candidates are production files
belonging to test companies, including `HF_Acid_SDS_2024.pdf` — typed `Employee Handbook - Leave
Policy Section` with a full FMLA analysis, which would be the strongest negative control
available. **Whether customer-uploaded files may enter the repository is not a quiet decision.**

#### 7.2c 🔒 A trigger for `user_locked` ⬜ ⏱ half day
`AUDIT-CHECKS.md` check 24: **zero policies, zero constraints, zero triggers** reference
`user_locked`. It is enforced in one library module, which under `CLAUDE.md` §3.6 is a route
guard wearing a different coat. Must be a **trigger** — a policy cannot compare the old row to
the new one, and the rule is about the transition.

#### 7.2d Switch determination coverage — 42 of 95 have no path ⬜
**Measured 12 Sep: 53 of 95 switches are document-sourced. The other 42 — 44.2% of the
vocabulary — have no determination path even after 7.2 ships**: 29 need an ask path, 11 need
signup to collect the field, 2 need 6.3b's wiring. `AUDIT-CHECKS.md` check 23 is the standing
query, and the figure may only fall — if it rises, a switch was added without deciding how it
gets answered.

**Build the ask path for the 29 `user_answer` switches first and let it prove the pattern.**
Measured: 4 of the 29 are referenced by no requirement at all, and the other 25 fully resolve
**31** requirements. **25 questions buy 31 requirements** — about 1.2 each, with no head to
attack (`owns_fleet` 7 transitive, then 3, then a tail of 2s and 1s).

### 7.3 Normalize audit output into `obligation_evidence` ⚡ ⏱ 4 days
**One table resolves three findings:** no resolution tracking, dashboard-only-climbing, audits recomputing from scratch.

### 7.4 Evidence expiry in code ⬜ ⏱ half day
Currently a prompt rule only.

---

## PHASE 9 — Observability

- ⬜ Error tracking, app and worker
- ⬜ Worker heartbeat — today if the worker dies, nothing notices
- ⬜ AI cost tracking per company per task
- ⬜ Rate limiting

---

## PHASE 10 — Cannabis Oregon

- ⬜ **Start by tagging existing OSHA and fire-code rows with `cannabis`** — probably 30–50 rows already owned. Find what you have before generating.
- ⬜ Mine `library_candidates` — usage-ranked, operator-validated queue
- ⬜ OLCC layer (OAR 845 Div 25)
- ⬜ License-type switch hierarchy: producer / processor / wholesaler / retailer / laboratory, endorsements, tier, extraction method
- ⬜ Local layer deep for two or three traction jurisdictions, thin elsewhere and stated
- ⬜ Salesperson verification pass — his license type only, tagged with who and when
- ⬜ OLCC Compliance Education bulletins as a monitored source

**The wedge:** cannabis extraction *is* chemical manufacturing. Flammable storage, LEL monitoring, room classification, hot work, confined space, boilers. Almost every cannabis tool is Metrc-adjacent; nobody covers the side where a fire marshal shuts a room down.

---

## PHASE 11+ — Later

**Washington** — chemical (~90 rows, federal already serves it), then cannabis (near-full rebuild). Divergence table is the mandatory review list. **Generated independently, never seeded from Oregon.**

**Checking agent** — shadow comparison, different model, primary-source tiebreak, seeded known-bad rows, quarterly human spot-check of the checker's judgments.

**Change monitoring** — Federal Register + eCFR APIs, OAR/WAC, agency bulletins, per-agency review intervals.

**Multi-site** — the roll-up dashboard and the site selector, on the structure Phase 1.6 puts
in place. This is interface work; the schema is done by then.

**`memberships` lives here, and only here.** It is not needed for user management — several
people in one company already works on `profiles.company_id`, and what is missing there is
an invite flow, not a migration (see the feature item above, and the correction in the gate).
`memberships` solves exactly one problem: **one person across several companies** — a
consultant serving two clients, or someone spanning facilities that are held as separate
accounts. Rare enough to wait, and it only becomes necessary once a customer actually has
that shape.

⚠️ **`auth_company_id()` is the hard part, and it is bigger than it looks.** It returns a
single `uuid`. Under `memberships` a person can belong to several companies, so it must
either return a **set** (and every policy becomes `company_id IN (SELECT ...)`) or take an
**active-company** parameter (and something must carry that choice through every request).
**64 of 71 policies depend on that function**, plus the four storage policies. Plan it as its
own migration with its own rehearsal — never as a step inside another feature.

Note this is a genuinely large migration whichever day it happens. What changed on 10 Sep is
only that it is no longer *urgent*: it was in the gate as a prerequisite for user management,
which it is not.

**Platform** — Stripe, Drive OAuth, domain, Framer homepage, PDF export, `claude-sonnet-5` (⚡ golden-file pass before and after).

**Key rotation** — moved to the gate at the top, where it belongs. **Six credentials**, not four: the original zip leak on 9 Sep plus both database passwords printed to a terminal on 10 Sep.

---

## MODULES — the vertical slices, built last

Everything above this line is **horizontal**: schema, the runtime pipeline, resolution, the
worker, the library, observability. Each of those cuts across every module in the product.
Everything below is **vertical**: one module at a time, top to bottom, on ground that has
stopped moving.

### Why the plan was reordered

The Compliance Workspace used to sit at Phase 3, in the middle of the horizontal work. That
was wrong in two directions at once.

**It was the only vertical slice among the phases**, which meant it would have been built on
infrastructure still in motion — the determination gate, the critic pass, `company_switches`,
the resolution engine and the worker are all *inputs* to the Workspace, and all of them were
scheduled around it rather than before it. Building a module while its foundations are being
poured means building it twice.

**And the other six modules had no phase at all.** Their findings are real, specific and
already written down — the audit engine silently dropping documents, HR checking a handbook
against eleven hardcoded words, the calendar extracting dates instead of reading cadence —
but they lived scattered through this document as *debts*, filed under whatever gap-closing
session happened to surface them. A debt is something you might pay. Planned work is
something you will do. Most of these are not debts; they are the product.

**This makes the plan longer and more honest: most of the real product work lives in this
final section.** The phases before it are the ground it stands on, and they are short by
comparison because infrastructure is smaller than product.

**Each module below states what it depends on.** Those dependencies are horizontal phases,
and none of them are optional. A module started before its dependency lands is a module that
gets rebuilt.

**One exception, marked where it appears.** M2(a) — the audit engine silently dropping
documents it cannot read — is live in production today, is half a day's work, and should not
wait for its module's turn. Correctness bugs in shipped code are not module work.

---
### M1 — Compliance Workspace

**Design:** `docs/WORKSPACE.md` — the full spec, already written. Nothing below re-decides it.
**Depends on:** determination gate (2.2) · critic pass (2.3) · `company_switches` (1.2) ·
resolution engine (Phase 4). The Workspace is the *surface* over those four; without them it
is a chat box.

#### M1.0 `/api/chat` never enables web search ⬜
*Recorded 11 Sep.*

`askAI()` supports `enableWebSearch`, and three call sites use it: both `/api/audits`
classify calls and `lib/documentReview`. **`/api/chat` — the route the Workspace answers
through today — does not.** Every answer it gives comes from model knowledge alone, with no
live verification of a threshold, a fee, a form version or a citation.

That is exactly the fact class `CLAUDE.md` §6 says must carry a verification badge, and the
Workspace is where those answers are shown. Turning it on is one option flag; deciding
*when* it should fire is M1 design work and touches §3.1 (what data feeds a prompt), so it
is recorded rather than switched on.

#### M1.0b `topics` — the table is deliberately not built ⬜
*Recorded 11 Sep. `DECISIONS.md` §23.2.*

Five of the six Phase 1.2 tables landed in migration 008. `topics` did not, on purpose: it
is the only one whose **shape** waits on a design decision rather than on unwritten code,
and it is the furthest of the six from a caller — the Workspace is this section, the last
in the plan, behind the determination gate, the critic pass, `company_switches` and
resolution.

**Two of `WORKSPACE.md` §9's open questions decide columns, not screens:**

- **§9.4 concurrency** — one open topic per company, or several? One is a partial unique
  index on `(company_id) where status = 'open'`; several is the absence of one. **This is
  not deferrable after the fact.** If several are allowed and users create several, adding
  the constraint later means closing somebody's open work.
- **§9.3 summary format** — what is worth keeping once the transcript is gone. That is the
  content of the column that *is* this table's durable output.

**Already decided, so it is not re-argued when the time comes:** "discarding the
transcript" (§6.1) means **nulling the column and keeping the row**, never deleting the
row. A discarded transcript must still leave behind that a topic existed, when it closed
and why — `close_reason` distinguishes *you closed it*, *a checklist closed it* (§6.2) and
*it went stale* (§6.1), and those read very differently to the person who comes back to it.

> ### ⛔ SUPERSEDED IN FULL — 21 September 2026. **THE M1 TABLE ABOVE IS AUTHORITATIVE.**
>
> **The six `####` items below re-use M1's numbers for DIFFERENT TASKS**, and the collision is the
> danger rather than the staleness:
>
> | This section | The table above |
> |---|---|
> | M1.1 = follow-up classification | M1.1 = `topics` ✅, M1.2 = classification ✅ |
> | **M1.2 = fact capture** | **M1.3 = fact capture** |
> | M1.3 = scoped questions | M1.3 = fact capture |
> | M1.4 = topic lifecycle | M1.4 = site resolution |
> | M1.5 = in-context fact display | M1.5 = show what we know |
> | M1.6 = answer display | M1.6 = conflict display |
>
> **Someone reading "M1.3" gets one of two different tasks depending on where they look**, and
> four of these six are already ✅ under their other number.
>
> **And it carries superseded vocabulary.** M1.2's *"`ai_inferred` confirms before applying"* is
> `WORKSPACE.md` §5.2's three-tier ladder, which **v3.2 marked SUPERSEDED, not translated** — and
> `ai_inferred` is in no enum in the schema. `DECISIONS.md` §96(a).
>
> **Kept, not deleted, for one paragraph's worth of reason:** M1.0 and M1.0b below are **not
> superseded** — web search in `/api/chat` is still off, and M1.0b's `close_reason` reasoning is
> the only place that decision is written down. **§8's class, at document scale**: a correction
> that left a whole section standing beside it.

#### M1.1 Follow-up classification ⚡ ⏱ 2 days
- ⬜ Elaboration → expansion only
- ⬜ Refinement → update fact, re-run identification → critic → expansion
- ⬜ New question → full pipeline
- ⬜ **Refinement recomputes, never appends**

#### M1.2 Fact capture from conversation ⚡ ⏱ 3 days
- ⬜ Established facts write to `company_switches`; exploration stays in the transcript
- ⬜ Every capture records `basis` — the actual sentence the user said
- ⬜ `user_stated` applies immediately; `ai_inferred` confirms before applying
- ⬜ Confirm when ambiguous

#### M1.3 Scoped questions ⚡ ⏱ 1 day
When a durable fact permits multiple answers, ask the scoped question rather than re-asking the fact. *"You operate your own fleet and also use carriers. For this shipment — which?"* The answer is context, not an overwrite.

#### M1.4 Topic lifecycle ⬜ ⏱ 3 days
- ⬜ Explicit close: summary written, facts extracted, transcript discarded
- ⬜ Tell the user the real reason — past conversations pollute future answers
- ⬜ Auto-close on inactivity
- ⬜ Creating a checklist closes the topic
- ⬜ Flag stale checklists when a fact changes — **flag, never auto-regenerate**

#### M1.5 In-context fact display ⬜ ⏱ 2 days
Before an answer, show **only the facts this question depends on.** Not a wall.

#### M1.6 Answer display ⬜ ⏱ 2 days
Object tags `[the case]`, regime tags `[DOT — transport]`, verification badges. *(Was Phase 8 — Screens.)*

---
### M2 — Audits

**Depends on:** the worker (Phase 5) · `obligation_evidence` normalisation (7.3) · Zod at the
AI boundary (2.6) · the verified library (Phase 6).

**Readiness is rebuilt on evidence rows, not recomputed per run.** Today every audit
recomputes from scratch: it re-reviews documents, re-matches requirements, and produces a
number that has no relationship to the last one. 7.3 normalises audit output into
`obligation_evidence` so readiness becomes a query over stored rows — which is also what
makes resolution tracking and a dashboard that can go *down* possible.

**The whole engine moves to the worker.** See (b) below: this is the clearest case in the
codebase, and moving it returns the route to the service-role key legitimately.

**These findings were surfaced on 10 Sep while moving `/api/audits` off the service-role
key. None is caused by that conversion** — the first predates it and the rest are structural.
They were filed as §0.10, a gap-closing debt; they are module work and now live here.

**(a) A document that fails to download vanishes from the audit, silently. ⏱ half day**
**⚠️ This one does not wait for M2's turn — it is live in production and it is half a day.**
The auto-index loop does `if (dlError || !fileData) continue`. Any cause — a storage
policy, a missing object, a transient network failure, an expired token — drops that
document from the candidate set with no error, no log the user sees, and no record on the
saved audit. The matcher is then shown fewer documents, matches fewer requirements, and the
readiness counts are computed **correctly in code from a smaller input**. Plausible numbers,
wrong basis. `CLAUDE.md` §3.2 puts readiness in code precisely so it cannot be an AI guess;
that protection does nothing when the input quietly shrinks.

The audit should report which documents it could not read, exactly as `/api/hr` now does —
that route names the file and the reason and says the answer does not account for it. Same
treatment here: a `documents_failed` list on the saved audit, surfaced in the UI.

**⚠️ (a) IS NOT THEORETICAL — IT WAS OBSERVED IN A REAL RUN, 10 SEP.**
A re-run on staging returned `satisfied=2 needs_info=1 needs_work=0`. Entirely plausible
numbers. They were computed from **one reviewable document out of eight**: only two of that
company's documents had a real object behind them, one could be read, and the other seven
were dropped by the `continue` with no error, no log the user sees, and no record on the
saved audit.

**This is current production behaviour, not a test artifact.** The same code path runs in
production today. Any cause that makes a download fail — a missing object, a transient
error, a policy problem — silently removes that document from the basis of the answer, and
the readiness figure comes out looking exactly as confident as one built on the full set.

A confident readiness number built on a silently truncated document set is **the precise
failure this product exists to prevent** (`CLAUDE.md` §6, the omniscient status tracker;
§3.2, readiness computed in code so it cannot be guessed). Computing it correctly from
wrong input is not a defence. **Weight this accordingly when the audit engine is next
touched — it is the most consequential item in this section, not a tidy-up.**

**(a2) `matched_documents` can contain entries with no `document_id` at all.**
The same run produced a `matched_documents` array holding an entry whose `document_id` was
`None` — the model returned it that way. Harmless right now because nothing consumes that
array beyond display, but it is on the path to Phase 7.3, which normalises audit output
into `obligation_evidence`. Anything linking evidence from this array would either break on
the null or, worse, skip it silently and record less evidence than the audit found.

Both (a) and (a2) are the same underlying problem: **that array is trusted more than it
deserves.** One is missing entries nobody was told about, the other is malformed entries
nobody validated. Zod at the AI boundary (§2.6) covers the second; reporting unreadable
documents covers the first.

**(b) `/api/audits` is the clearest case for the Phase 5 worker. 🔒**
One request does classify (with web search), generate a full standard on a cache miss,
review every unreviewed document one at a time, and match every requirement in batches.
Minutes, several model calls, unbounded in document count. `maxDuration` is already at 800s
— the highest stable Vercel ceiling without the extended-duration beta — and was raised once
already to work around this. Raising it again is the same workaround with a bigger number.

`PATTERNS.md` §5: BizPulses runs its equivalent as a plain always-on Node process, "separate
from Vercel because classify + N extraction calls + reconcile routinely exceed any
serverless timeout." Same wall, same answer.

**When it moves, it returns to the service-role key legitimately** — a background job has no
user session to run as, the same reason `/api/signup` keeps it. The conversion done on 10 Sep
is superseded at that point, not wrong: it makes the route correct where it currently lives.

**(c) The user gets nothing for the duration of a multi-minute run. ⏱ folded into Phase 5**
No progress, no partial result, no indication anything is happening. BizPulses writes a
`progress_message` after classification and after each chunk, and the browser polls the row
to render it. Phase 5 solves this as a side effect of moving to a job row that can be
updated mid-flight — **record it now so the worker spec includes it**, rather than
rediscovering it after the worker ships without it.

**(d) Port BizPulses's atomic `replace_*` pattern. ⏱ with Phase 4**
DELETE and INSERT inside one transaction, with the ownership guard expressed in SQL, so a
failed refresh leaves the prior data intact rather than half-written. Wanted for
`replace_obligations` (Phase 4.2 already calls for exactly this) and for document re-review.

**One difference that must not be ported.** BizPulses always wants the latest data for a
period and discards what it replaces. CompliBoard often wants the history: obligations are
marked, never deleted (§3.2), and library rows are versioned rather than edited in place.
**The transaction mechanism ports; the retention policy does not.** Take the atomicity and
the in-SQL guard; keep our own rules about what survives.

---
### M3 — HR

**Depends on:** the employment law library (6b) — that is the whole story of this module.
Everything wrong with HR today is downstream of having no verified requirement rows to check
a handbook against.

**Findings from reading the code, 10 Sep. Design decided, nothing built.**

#### The architecture decision
**One requirements table, tagged by domain** — `employment`, `environmental`, `transport`, `fire`, `licensing`. Modules are *views over rows*, not separate systems.

Employment law is an independent **body of law** but not an independent **module**: it is read by HR *and* belongs in a chemical manufacturer's overall obligation list, because they employ people. A separate library would hide it from every vertical.

Two things only work this way:
- **Shared switches.** `employee_count` drives FMLA at 50, OFLA at 25, Oregon sick time at 10 — *and* OSHA recordkeeping thresholds. Determined once, used by both.
- **One company picture.** "What does this company owe?" must return chemical and employment obligations together.

**Test for a new domain:** does it need different *columns*, or just different *rows*? Employment needs the same columns. Same table.

#### What is wrong with HR today
- ⬜ **Audit reads ONE handbook; ask reads ALL of them.** Backwards. SMB reality is one large legacy handbook plus several later amendments, so auditing a single file reports sections "missing" that exist in another document.
- ⬜ **The "requirements" are eleven hardcoded words in a prompt** — anti-harassment, EEO, FMLA, ADA, and so on. No citations, no jurisdiction, no thresholds. FMLA is federal at 50+; Oregon has **OFLA** (25+, broader) and **Paid Leave Oregon** (nearly all employers). A handbook can pass "FMLA present" and miss both Oregon obligations. **A false green produced by a checklist that doesn't know which state it's in.**
- ⬜ **Employee count is never consulted**, so the audit cannot know what applies.
- ⬜ **`draft_policies` required for EVERY missing section** — the highest-risk tier (suggested legal language) shipping unconditionally with no citation, jurisdiction, or verification. **Turn off until a library exists.** Same for `draft_policy` in ask mode.
- ⬜ **Findings are a frozen JSON blob** (`present`/`missing`/`draft_policies` arrays). No per-finding row, no status, no `resolved_by`, no link to the document that closed it. The lifecycle below cannot be built on this shape.
- ⬜ **Ask and audit do not talk.** A question touching a known non-compliant section should report it; there are no finding rows to look up.

#### The intended design
Upload → scan the **whole handbook set** → store **findings as rows** → findings are the durable artifact → questions consult them → a finding stays open until a corrected document actually satisfies it.

- ⬜ Scan once at upload, not per question. Same fix as `obligation_evidence`: compute once, store as rows, query thereafter. Also makes repeat questions consistent.
- ⬜ A new upload **re-scans affected findings**; a finding closes only if the new document actually satisfies it. Never "a document arrived, assume it's fixed" — that is a false green produced by a file.
- ⬜ Record **which document closed a finding and when**. That is the evidence trail.
- ⬜ Report carries a coverage statement: "Reviewed against N employment requirements. X gaps, Y undetermined."
- ⬜ A user can dismiss a finding ("we're under 25 employees") — that writes back to `company_switches`, not just hiding the row.

#### Risk tiers for "here is the fix"
| Tier | What | Gate |
|---|---|---|
| 1 | Missing-section detection | Ship now — an absence is reliably detectable |
| 2 | Anchored comparison against a verified requirement row | **Needs the employment library** |
| 3 | Suggested policy language | Verified rows only, always framed as a draft for counsel |

**Three standing rules:** every finding cites the rule (no citation → no assertion) · never say "you are compliant", only what was checked and found · suggested language is visibly a draft, never a fix to accept.

#### Cheap and honest, available now
- ⬜ Audit reads all handbooks
- ⬜ Drop `draft_policies` / `draft_policy`
- ⬜ Label the output a **generic completeness check**, not a compliance finding

#### Already good in the code
- ✅ Conflict handling is in the ask prompt — names which handbook says what, does not silently pick
- ✅ Ask mode reads all handbooks so an answer in an older document is still found
- ✅ Four-outcome answer shape with citations *(written 10 Sep, untested)*

---
### M4 — Documents

**Depends on:** the worker (Phase 5, job type `index_document` is already 5.2) · the schema
rebuild (Phase 1) for the versioning columns.

**Findings not yet written up in the detail M2 and M3 have.** What is known:

- ⬜ **Review runs inline, per request, and the same document gets reviewed twice.**
  `lib/documentReview.ts` is called from the manual Review button *and* from the audit
  engine's auto-index step. It is a multi-second model call with a whole PDF in the
  payload, sitting in a serverless request. It is 5.2's job — **index once at upload,
  store the result, query it thereafter.** Same shape as `obligation_evidence` and the HR
  findings: compute once, store as rows, read many times.

- ⬜ **"What is this document about" is prose, not a key. ⏱ with Phase 1**
  The review prompt returns `document_type` and `regulation_reference` as free text —
  *"OSHA 29 CFR 1910.1200 (HazCom)"*, as specific as the model felt like being. Nothing
  joins that to a requirement row. Evidence matching currently re-reads the document
  because there is nothing indexed to match *against*. Indexing must produce something
  joinable — agency, citation, requirement ids — alongside the prose a human reads.

- ⬜ **Nothing records that one document supersedes another. ⏱ with Phase 1**
  The SMB reality named in M3 is one large legacy document plus a series of later
  amendments, and that is just as true of permits, SDS sheets and plans as it is of
  handbooks. Today an expired permit and its renewal are two equal rows; the product has
  no way to say the second replaced the first. Without it, "is this current?" is answered
  per file rather than per obligation, and a superseded document can still satisfy a
  requirement. `supersedes_id` is already in the Phase 1 schema work for library rows —
  customer documents need the same treatment, and the answer must survive into
  `obligation_evidence`.

- ⬜ **`app/documents/page.tsx` is 1,103 lines.** Split when the module is worked, not
  before — a rewrite ahead of the indexing change is a rewrite done twice.

- ⬜ **`companies.scan_result` is an untyped blob holding facts that now have a home.**
  *Recorded 11 Sep.* The column itself **is** migrated — it is in `000_baseline.sql:155` as
  `scan_result jsonb`. What was never migrated is its **contents**: state, chemicals,
  operations and certifications, written by `/api/scan-website` as free-form JSON with no
  schema, no validation, no `basis`, no confidence and no expiry.

  Those are switches. `company_switches` now exists (migration 008) and carries value,
  state, confidence, basis, source and `expires_at` for exactly these facts. So the blob is
  a parallel, weaker store of the same information — and it is the one that silently
  outranked the customer's stated address for months (`DECISIONS.md` §24.1).

  **Cross-reference: this is M7's to resolve, not M4's.** M7 reworks signup, which is what
  writes `scan_result` in the first place; §25.1 already decides that jurisdiction comes
  from geocoding rather than from the scan. Draining the blob into `company_switches` is
  part of that rework, and until it happens two stores of the same facts disagree by
  design.

- ⬜ **The file pickers are narrower than the routes behind them, and narrower than each
  other.** Once `/api/chat` reads every accepted file type correctly, `/upload` and
  `/compliance` still restrict their pickers to a smaller set than `/documents` offers —
  Word is missing from `/upload`, PowerPoint from both. Decide whether to widen them to
  match, and whether `/upload` survives as its own page once **M7's** onboarding flow
  exists, before doing so.

  Verified 11 Sep, every `accept=` in the app:

  | Page | `accept` | Gap |
  |---|---|---|
  | `/documents` | `.pdf .xlsx .xls .csv .docx .doc .pptx .ppt image/*` | the widest — the reference |
  | `/compliance` | `.pdf .xlsx .xls .csv .doc .docx image/*` | no PowerPoint |
  | `/upload` | `.pdf .xlsx .xls .csv image/*` | **no Word, no PowerPoint** |
  | `/calendar` | `.xlsx .xls .csv .pdf .docx .doc .pptx .ppt` | **no images**, though `/api/extract-dates` reads them |
  | `/audits` ×2 | `.pdf .doc .docx image/*` | no Excel, CSV or PowerPoint |
  | `/hr` | `.pdf image/*` | narrowest, and **correct** — `hr/route.ts` only accepts those two and says so |

  Only `/upload` and `/compliance` post to `/api/chat`, so only those two are affected by
  the route change. `/calendar` is the same *class* of defect against a different route and
  is worth fixing in the same pass. **`/hr` is not a gap** — its narrowness matches its
  route deliberately, and widening it would reintroduce the confident-nonsense bug that
  route's comments describe.

  ⚠️ **Widening a picker is not the whole fix.** `app/compliance/page.tsx` has no error
  handling on the chat path at all — no `res.ok` check and no error state in the component,
  so a 400 sets `data` to undefined and shows a blank. `app/upload/page.tsx:124` is a bare
  `catch {}` commented *"extraction failed silently"*. Until those display the message the
  route now returns, a rejected file looks like nothing happened.

- ⬜ `app/upload/page.tsx:89` calls `getPublicUrl` on a private bucket — already broken,
  already listed in §0.7. Fix it there, not here.

---
### M5 — Calendar

**Depends on:** the library (Phase 6, cadence lives on requirement rows) · resolution
(Phase 4, which says what applies) · `obligation_evidence` (7.3).

**The change: cadence comes from obligations, not from date extraction.**

Today `/api/extract-dates` sends a document to the model with a prompt asking it to find
"expiry dates, renewal dates, inspection due dates… maximum 10 dates per document," and
writes what comes back into `calendar_events`. The calendar is therefore a list of dates
somebody's paperwork happened to mention. It cannot know about an annual report that is due
whether or not any document says so, and it cannot tell a deadline that binds this company
from a date printed on a form.

A requirement row carries its own cadence, and resolution already determines which rows
apply. **The calendar becomes a query over obligations** — deterministic, complete, and
explainable back to a citation. `MERGEDv2` already contains a fixed-date calendar (6.1).

- ⬜ Calendar reads cadence from obligations ⏱ 2 days
- ⬜ **Extraction survives for exactly one job:** the date the law cannot know — *this*
  permit's expiry, *this* inspection's result. That is anchored to an artifact and is the
  mode the model is reliable in (`CLAUDE.md` §3.3). Enumerating a company's deadlines from
  a document is the unanchored mode.
- ⬜ Every calendar entry states its basis: the obligation and citation behind it, or the
  document the date was read from.
- ⬜ Decide what happens to the entries extraction has already written. They are not
  wrong, they are unsourced.

---
### M6 — Dashboard

**Depends on:** `obligation_evidence` (7.3) · the verified library (6.7) · `industry_coverage`.

**Real metrics only once evidence rows exist.** The dashboard today can only climb: there is
no stored evidence, so nothing can be un-satisfied, and a number that only goes up is not a
compliance measure — it is a progress bar. Once 7.3 writes evidence as rows, readiness is a
query, an expiring certificate makes the number **fall**, and the figure means something.

**Until then, no numbers.** `CLAUDE.md` §6 names the omniscient status tracker as an
anti-pattern and it was removed from this product once already. A percentage computed over
an unverified library is that anti-pattern wearing a chart.

- ⬜ Readiness computed in code from evidence rows — never AI, never a running total ⏱ 2 days
- ⬜ **Enable numbers — gated on library verification (6.7).** This is the gate, not a step.
- ⬜ Requirements page, grouped by agency ⏱ 4 days
- ⬜ Coverage strip from `industry_coverage` ⏱ 1 day — `OSHA ✓verified · DEQ ✓verified ·
  Local fire ◐partial · ODA ○not built`. A verified row and a generated row must not look
  the same.
- ⬜ 🔴 **The strip must distinguish A PROFILE from A DEFAULT.** Added 12 Sep, from the first
  real resolution run. A company that has answered nothing resolves to **2 `applies`** —
  `Business registration active with OR Secretary of State` and `Emergency lighting / exit
  sign testing` — because both turn on nothing but "the site is in Oregon", which we know
  from the address. **Those two are the answer for ANY Oregon employer.** They are correct,
  and on screen they are indistinguishable from a real profile: a user who signs up, uploads
  nothing, and sees two requirements cannot tell whether that is *their* answer or the
  default everyone gets.

  **This is not a resolution bug and must not be fixed in the engine.** Suppressing the two
  would be worse — they genuinely apply. The fix is that the screen says what it is standing
  on: *"2 requirements from your address alone. 197 more depend on facts nobody has supplied
  yet — the first four questions settle 79 of them."* Those numbers are already computed and
  stored: `determined_by.switches_missing` is per-row, and the status counts are a `group by`.

  **It is a named requirement, not a UI nicety, because the failure it prevents is the
  omniscient status tracker** (`CLAUDE.md` §6) — a screen asserting a compliance position
  before the evidence for it exists. A short list with no provenance is exactly that, and it
  is the most convincing form of it, because everything on the list is true.

#### M6.1 Verification section ⬜ ⏱ 2 days
*(Designed in `WORKSPACE.md`; it lives on the dashboard, so it is planned here.)*
- ⬜ Three at a time, never more
- ⬜ Ranked by consequence internally
- ⬜ **No numbers** until the library is verified
- ⬜ Empty state is the good state
- ⬜ Frame as an inbox that gets quiet, not a burn-down

---
### M7 — Onboarding and signup

**Depends on:** the worker (Phase 5 — the website scan becomes a background job) ·
`library_candidates` (1.2).

**Full design in `WORKSPACE.md` §10.** This is the first thing a customer ever sees and it
is currently a dropdown listing only the verticals already built — a signup form that can
only be completed by someone we have already decided to serve.

- ⬜ Remove the industry dropdown and `/api/industries` — it is circular, offering only verticals already built
- ⬜ Signup collects **email, password, website, address** only
- ⬜ **Address required** — it decides which body of law reaches them; not derivable from a website
- ⬜ **Geocode the address for state, county and city** — US Census Bureau Geocoder, no API
  key, effectively unlimited. Not typed by the user and not inferred by a model: it is a
  lookup with a known correct answer, and a wrong county silently changes which
  requirements apply. **A geocode failure leaves the jurisdiction unknown and asks — it
  never substitutes.** `DECISIONS.md` §25.1
- ⬜ **Ask for the fire authority. One field.** Geocoding cannot produce it — fire districts
  do not follow county lines, and Tualatin Valley Fire & Rescue spans three counties. The
  customer knows, because a fire marshal has visited them. Unknown means the three `local`
  fire-code requirements show undetermined rather than resolving against a guess.
  `DECISIONS.md` §25.2
- ⬜ **Capture `county`** — signup hardcodes `county: ''` today, so **no county-scoped
  requirement can resolve for anyone**. Geocoding is what fills it
- ⬜ Scan runs as a background job, not inline; do not block signup
- ⬜ Scan output carries a **sufficiency confidence**, not just extracted fields
- ⬜ `primary_industry` + `secondary_activities[]`, with `basis` and `resolved_by`
- ⬜ Classification presented as a **teaching confirmation**, correctable
- ⬜ Three distinct fallback messages: no website · unreachable · uninformative
- ⬜ Unmatched industries write to `library_candidates` — signup becomes demand research
- ⬜ Company profile screen — *"here's what we understand, correct anything wrong"* ⏱ 4 days
- ⬜ Onboarding: 3 fields → scan → confirm screen → ~7 questions → documents ⏱ 5 days

**Why classification is a teaching confirmation and not a form field.** The confirm screen is
the first time the product tells the customer what it thinks they are, and the first time
they can correct it. Getting that wrong is not a UX blemish — jurisdiction is part of the
match key (`CLAUDE.md` §3.2), so a misclassification serves the wrong body of law silently.

---

### M8 — Account

**Depends on:** nothing. That is the point of it being here rather than in a phase.

`/api/account` (GET, PUT, DELETE) and `/api/account/export` both work — converted to the
caller's token on 10 Sep and verified by comparing row counts against the service role.
Migration 005 exists because the export was silently dropping every colleague from a
customer's data export: right shape, right status, fewer people.

What is missing is everything to do with **who else is on the account**.

#### M8.1 Invite, list, remove ⬜ ⏱ estimate after reading BizPulses

*Moved here 11 Sep. It had been sitting between Phase 0 and Phase 1, belonging to neither
and scheduled by nothing.*

**Not a gap in the security work — a missing feature the security work made visible.**
**It needs no migration. It works on the schema that is in production today.**

There is no way to add a person to an existing company, and no way to remove one.

- **Nobody can be added.** The only path that creates a profile is `/api/signup`, and it
  creates a **new company** every time. A second person cannot be given access to an
  existing company at all. So the company-scoped visibility built in migrations 003 and
  004 currently has no users to be scoped *between* — every company has exactly one
  person, by construction. **By construction, not by schema:** two `profiles` rows sharing
  a `company_id` is a legal, working state. It was run on staging on 10 Sep — Test Alpha
  Chemical had two users and each saw the other's checklists, which is exactly the intent.
  What is missing is the route that creates the second row.
- **Nobody can be removed.** `profiles` has no DELETE policy and no route. The only
  deletion path is `/api/account` DELETE, which destroys the entire company.

**The consequence, stated plainly:** when an employee leaves, their login keeps working
indefinitely. They keep full read and write access to every document, audit, permit and
piece of evidence at that company, and can still delete things. For a product whose value
is holding a customer's compliance evidence trail, that is a real exposure.

**Policies do not fix this.** Migrations 002–005 make the database enforce that a person
sees only their own company's data. A departed employee is *still a legitimate member of
that company* as far as the database is concerned — their profile row still says so. RLS
is working exactly as designed and the wrong person is inside the boundary. No amount of
policy work closes it; only a way to revoke membership does.

**Scope**

- Invite a person to an existing company
- List who has access
- Remove access
- **Records created by a removed person must survive.** The compliance record is a company
  asset (`DECISIONS.md` §1, §14) — removing a person must not remove their document
  reviews, audits or checklists, or a departure silently deletes evidence. Practically:
  revoke the login and mark the profile inactive; never cascade a delete through their work.
- Decide whether roles are needed, or whether everyone at a company is equal

**Ships on its own timeline — and ships, rather than being stockpiled.** It is not gated on
any phase, so it can be built whenever a customer needs it. The rule is that it goes to real
users when it is built. **Code written and held back is code that has never been tested
against real use**, and an invite flow is exactly the kind of feature where the first real
attempt finds the problems — an email that does not arrive, a link that expires, an invitee
who already has an account with another company.

**Port from BizPulses rather than designing fresh** — it already has invite, list and remove,
and the flow is the valuable part. **But its `memberships` table is not the part to copy.**
That table solves a different problem: **one person across several organisations.** Our
problem is several people inside one company, and `profiles.company_id` expresses that fine.
`PATTERNS.md` §3 has its RLS pattern; note that we already improved on it — a `SECURITY
DEFINER` helper instead of the subquery repeated in every policy, and explicit `WITH CHECK`
rather than relying on Postgres reusing `USING`. Take the flow, not the schema.

**The cost of the interim, recorded so it is a choice and not an accident.** Until this
ships, early customers with more than one person share a login. That is tolerated
(`DECISIONS.md` §17.4) and it **weakens the audit trail**: every write records `user_id`, so
a shared login attributes every document upload, every checklist tick and every audit run to
one person. *"Who marked this complete, and when"* is part of what a compliance record is
for — it is the thing a regulator or an insurer asks. A shared login does not corrupt the
record, but it flattens it, and the flattened rows cannot be un-flattened afterwards.

**Prerequisite already done:** migration 005 gives `profiles` a company-scoped SELECT
policy — **applied to production 10 Sep** — which is what makes "list who has access"
possible at all. It changes nothing visible today: production has four companies with one
person each, so nobody has a colleague to see.

#### M8.2 The cost of waiting, taken knowingly ⚠️

**Early customers with more than one person share a login. That is accepted
(`DECISIONS.md` §17.4), and it has a price that should be visible rather than implicit.**

Every write records `user_id`. Under a shared login that is one person's id on every
document upload, every checklist tick, every audit run and every piece of evidence —
regardless of who actually did it.

**"Who marked this complete, and when" is not a nice-to-have for this product. It is a
large part of what a compliance record IS** — the question a regulator, an insurer or an
auditor asks first. A shared login does not corrupt the record; it **flattens** it.

And the flattening is permanent. **Records created under a shared login stay ambiguous
forever**, because the information was never captured — shipping the invite flow later
fixes every subsequent row and no earlier one. That is the real cost of deferring: not
that the feature is late, but that a window of the customer's history is ambiguous for the
life of the account.

**Taken knowingly.** The trade is that an invite flow is not what stands between here and a
first customer, and a customer who knows the limitation can work within it. It should be
said out loud during those conversations rather than discovered during an audit.

---

## Next three sessions

**Session A — close the remaining holes** (0.4, 0.5, 0.6, 0.9) — ✅ **done, 10 Sep**
All four landed. Migrations 002–005 are in production, every route derives the company from
the verified session, ten routes run under RLS on the caller's token, and the four that keep
the service-role key each carry a named reason. §0.7 housekeeping is what remains of Phase 0.

**Session B — schema rebuild** (1.1–1.6) ⏱ ~1.5 weeks
Design, migrate, rebuild staging from zero, rebuild production, jurisdiction in the match key,
multi-facility structure. **Do this before the first real customer document** — it is item 2
of the gate at the top.

**Session C — the runtime fixes** (2.1–2.4)
Agency list, determination gate, critic pass, split identification from expansion. **This is where answer quality changes.**

**Not yet: any module.** Everything in `MODULES` waits on B, C and the phases after them.
The single exception is M2(a) — the audit engine silently dropping documents it cannot read.
That is live, it is half a day, and it does not wait.

---

## Open decisions

1. Pricing — $199 or $99
2. Cannabis prospect — processor or not? one license entity or six?
3. What the other two salespeople are targeting. A single-site Oregon chemical manufacturer is the cheapest validation of this whole architecture, and the one you can verify personally.
4. Auto-close interval for topics
5. One open topic at a time, or several?
6. How aggressively to confirm before writing a fact

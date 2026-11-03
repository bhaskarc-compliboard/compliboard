# PENDING — everything this product still owes

**Version:** 2 · **Written:** 29 October 2026, by Claude Code at the close of My Account part C.
**Updated:** 2 November 2026, at `docs/GAPS-PLAN.md` Part A step 3: **S7 gains its number** — a carried attachment costs ~2,376 input tokens a turn, measured on Haiku. No row added or removed; the counts below stand at 49.
**Updated:** 2 November 2026, at `docs/GAPS-PLAN.md` Part A step 4b: **F12 and D15 CLOSED.** The Documents page has
the chat (three tabs, two routes, the index and the readings as its context) and it reads `?document=<id>`, so every
reading card and every fact link opens the report it names. Open items 49 → 47; known defects 15 → 14.
**Updated:** 2 November 2026, at `docs/GAPS-PLAN.md` Part A step 1: **D15 added** — a Calendar chat reading card's `/documents?document=<id>` link is read by nothing on the Documents page — so the count rises from 48 to 49 and the known defects from 14 to 15. **D5**'s line number corrected, `:533` → `:621`. Both from reading the code, not the docs.
**Updated:** 2 November 2026, at the close of the public pages (`docs/PUBLIC-PAGES-PLAN.md` step 35): **F12, chat
over documents**, added — it was the one release gate for the homepage with no id here (§5 of that plan said "add
one at step 35"). Three rows corrected where this build's own greps found them stale: **F4**'s "returns nothing",
**D2**'s line number, and a note under **F6**. Nothing else re-read; every other row keeps its date.
**Updated:** 3 November 2026, at `docs/GAPS-PLAN.md` Part A step 6b: **F5, F6 and D5 CLOSED, and F7 narrowed.**
The Audits page has the chat, its two routes and its one offer; its Ask box answers a question and starts an audit
from the same sentence, decided in code. **F6 was settled by running it, and it was wrong**: the template audit
finished in 43 seconds with 16 findings, so "returns 400 with a sentence saying it is not ready" has been untrue
for some time. F7 keeps only HR and the Compliance Workspace (decision 36). Open items 47 → 44; known defects
14 → 13.

**For:** anyone asking *"what is left?"* without reading nine files to find out.
**Gathered from**, not remembered: `docs/HANDOFF-FROM-ACCOUNT.md` §7 · `docs/HANDOFF-FROM-CALENDAR.md`
§7 · `docs/HANDOFF-FROM-DASHBOARD.md` §7 · `docs/HANDOFF-FROM-HR.md` §7 · `docs/HANDOFF-AUDITS.md` §8 ·
`docs/HANDOFF-CODE.md` §7 · `docs/HANDOFF-FOLDER-TEST.md` · `docs/WORKSPACE-PLAN.md` Stage 3 ·
`docs/TEST-AT-FINISH-LINE.md` · `docs/ACCOUNT-PLAN.md` · `STATUS.md`'s degraded rows · `docs/TODO.md` ·
`docs/DECISIONS.md` · `docs/HANDOFF-FROM-PUBLIC-PAGES.md` §5 and `docs/PUBLIC-PAGES-PLAN.md` §5 (F12).

> **Every line below traces to a file and, where it exists, a line number. Nothing here is invented.**
> Where an item is a *decision* rather than work, it says so. Where it is a *hypothesis* rather than a
> known defect, it says that too.
>
> **Sizes are rough and are for sequencing, not for promising**: *an hour* · *a day* · *a week*.

## How many, and the five to do first

**49 owed items**, plus 3 hypotheses that are not owed work and 7 things deliberately not built:

**12** unfinished features (F) · **15** known defects (D) · **7** security and limits (S) · **8**
waiting on the owner (O) · **7** deliberately not built (N) · **3** hypotheses (H).
12 + 15 + 7 + 8 + 7 = **49**; the three H rows are claims to settle, not work to do.
*(47 and 11 until 2 November 2026, when F12 was added; 48 and 14 until later the same day, when D15 was added; 49 and 15 until step 4b closed both.)*

| | do first | why this one |
|---|---|---|
| **1** | **Stripe live mode** (F1) | Billing is built, released and **inert**. Until this is done the product cannot take a single pound, and every other revenue question is hypothetical. It is a dashboard afternoon, not engineering |
| **2** | **The Resend sending domain's DNS** (S1) | **Four emails to customers are blocked on it**, the monthly one refuses to send on production by design, and the audit email already landed in a junk folder. It is a DNS job. It has been open since 16 October |
| **3** | **The scanner's invented switch keys** (D1) | **30 of 30 pending proposals on production name a key that does not exist**, and those names reach a customer's queue *and three prompts*. This is the only open defect that puts fabricated content in front of a customer |
| **4** | **`.doc` and `.ppt` cannot be read, and the picker offers them** (D2) | The product invites a file it then cannot open, and fails by exception rather than by the sentence written for exactly this. It is also the dependency under the binder (F4) |
| **5** | **The folder test** (F3) | Everything has been measured a piece at a time. **The product has never been judged on a folder the way a customer arrives with one**, and it is the first thing that will find what the piecemeal tests cannot |

Numbers 1 and 2 are not engineering at all. Number 3 is the biggest correctness risk in the product.
4 and 5 are the pair that would tell us what the product actually does with real mess.

---

# A. Unfinished features

| | what it is | recorded in | what it blocks or risks | size |
|---|---|---|---|---|
| **F1** | **Stripe live mode.** Six dashboard steps (product + price, webhook endpoint, its six events, the portal's default configuration, the secret key, the coupon and its promotion code) and three variables | `docs/RELEASE.md`, *"When Stripe live mode is ready"*; `docs/HANDOFF-FROM-ACCOUNT.md` §7.1 | **No money can be taken.** Checkout and the portal answer *"Card payment is not set up on this server yet"*. Every one of the six has a sandbox twin that does **not** carry over | a day |
| **F2** | **The sites screen.** `switch_scope` says **73 of 95 switches are per-site**, and an audit is scoped to a company | `docs/HANDOFF-AUDITS.md` §8.1 | **A two-site company gets one audit that is wrong for both.** A second plant has its own permit, generator category and forklifts | a week |
| **F3** | **The folder test.** The whole product judged on 20–40 files as a customer actually holds them, one folder a two-site company | `docs/HANDOFF-FOLDER-TEST.md` (written 1 Oct, *"the brief for the next chat"* — **that chat has not happened**) | The first real queue, the first real mess, and the first two-site judgement. Everything so far is measured a piece at a time | a week |
| **F4** | **The binder.** One PDF: a cover, each cited document as pages behind a tab sheet, the report at the back | `DECISIONS.md` §143 (line 10730); `docs/HANDOFF-AUDITS.md` §8.4 | **No binder code exists.** *(Corrected 2 November 2026: this read "`grep -rin binder app lib components scripts` returns nothing", which stopped being true the day the homepage shipped a panel about it — that grep now returns `components/home/BinderPanel.tsx`, `Hero.tsx`, `AuditPanel.tsx`, `QuestionPanel.tsx` and two lines of `app/page.tsx`, all of them words on a public page. Nothing under `app/api/`, `lib/` or `scripts/`.)* Depends on D2: built first, it produces a binder with holes. The owner's decision: it **replaces** the download button, *"Download the documents"* becomes *"Download the binder"*, one button not two | a week |
| ~~**F5**~~ | ~~The question path from the Audits box~~ — **CLOSED 3 November 2026** (`docs/GAPS-PLAN.md` Part A step 6b). The box takes both: `lib/auditsCommand.ts` `readCommand` looks at the sentence first, in code and with no model call, and only a sentence that is not an audit command reaches the model. *"Do we have all our permits?"* is answered where it was asked, by the Audits chat, from the audits and their findings. | `app/audits/page.tsx`, `lib/auditsCommand.ts`, `app/api/audits/answer/route.ts` | done | — |
| ~~**F6**~~ | ~~The template audit~~ — **CLOSED 3 November 2026 BY RUNNING IT, and the row was wrong.** One template audit against `tests/golden/audits/fixtures/12-auditor-checklist-deq-air.docx`, through the page's own three calls, as the Cascade person on the isolated Haiku server: **run `de251fbf-f838-45d8-a38a-11a8372e2ef6`, status done, 3 of 3 sections, 16 lines, 16 findings, 0 could-not-complete, 43 seconds, $0.0829**, every section `json_parsed = true` on `claude-haiku-4-5` and every finding carrying its checklist line (A1–A5, B1–B6, C1–C5). The attach control is not inert: one click fires `Page.fileChooserOpened`. **What this row claimed — "returns 400 with a sentence saying it is not ready" — was false, and three readings disagreeing could not settle it; running it could, which is what the row itself said.** | the run's rows, read back from staging with the CLI | done | — |
| **F7** | **HR and the Compliance Workspace move onto the shared chat engine** `lib/ask/` — **narrowed 3 November 2026: Audits has moved** (`docs/GAPS-PLAN.md` Part A step 6b), and HR and the Workspace stay on their own engines for rev 1 by the owner's decision 36. | `docs/HANDOFF-FROM-CALENDAR.md` §7.4, decision 28; `GAPS-PLAN.md` decision 36 | The link check, quote check, marker numbering and history rebuild exist **twice** today — HR's own and the engine's. A test holds that no engine file imports HR's, so the move is a deletion rather than an untangling. The homepage's gate mark is on `components/home/AuditPanel.tsx:2`, closed for the Audits panel. | rev 2 |
| **F8** | **The three existing emails onto the one template** (`lib/documentBatch.ts`, `lib/auditNotify.ts`, `lib/handbookCheckNotify.ts`) | `docs/HANDOFF-FROM-CALENDAR.md` §7.3, decision 25 | The footer, the wordmark, what a link looks like are decided in four places, and three of the four send **plain text only** | a day |
| **F9** | **Conversations in the data export.** `/api/account/export` reads **no `topics` and no `turns`** | `docs/ACCOUNT-PLAN.md` open question 2; `docs/HANDOFF-FROM-ACCOUNT.md` §7.4 | Board 5's *"and conversation, as files"* overstates what the file holds. The page's wording is already honest; the export is what must catch up | a day |
| **F10** | **A re-read button for the website read** | `DECISIONS.md` §210 (line 15145): *"A re-read button is owed and is not built"* | *"Read once"* is the route's rule, and **two of seven sites measured failed for temporary reasons**. A person who fixes their website is told *"we already tried"* | an hour |
| **F11** | **An email before a discount ends** | `DECISIONS.md` §221 F; `docs/HANDOFF-FROM-ACCOUNT.md` §7.6 | The Billing tab names the date twice. Nothing sends it, so a customer whose discount lapses finds out from a failed charge | a day |
| ~~**F12**~~ | ~~**Chat over documents.**~~ **CLOSED 2 November 2026** — `docs/GAPS-PLAN.md` Part A step 4b. `/documents` opens Ask a question; `lib/ask/documentsBrief.ts` packs every document's line whole and then the full reading of the ones the question names; `app/api/documents/answer` and `app/api/documents/topics/[id]/summarise` are the two routes; a quoted line becomes a card that opens that document's report. Measured before it shipped: 39 runs on Sonnet 5.5 with and without the context (step 4a-test) and three on Opus 5.5 (4a-compare). `components/home/DocumentsPanel.tsx:1` now says closed. **The homepage's own box still types nothing — that is the marketing page's, not this.** | — | — | done |

---

# B. Known defects

| | what it is | recorded in | what it risks | size |
|---|---|---|---|---|
| **D1** | **⚡ The scanner invents switch keys, and they reach a customer's queue AND three prompts.** On production, **30 of 30 pending proposals name a key that is not a switch** — 19 distinct invented names | `docs/HANDOFF-CODE.md` §7, row 1; `lib/documentScan.ts:1059`, `lib/companyContext.ts:357` | *"Waiting for you"* asks only about names the reading made up, and Confirm tries to write a switch that does not exist. The names also reach **every HR answer's and every document draft's context**. The fix is Documents' at the write; filtering the brief is a prompt input, so §3.1 makes it the owner's | a day |
| **D2** | **⚡ `.doc` and `.ppt` are offered and cannot be read.** `ACCEPTED_FILE_TYPES` includes both (`lib/acceptedFiles.ts:14`, read again 2 Nov — this said `:15`); `isWord` claims `.doc` (`lib/documentContent.ts:149`) and hands it to **mammoth, which reads `.docx` only**; `isPowerPoint` claims `.ppt` (`:150`) and the code's own comment says officeparser *"does not list [.ppt] as supported at all — it is left to fail as it always has"* | read from the code, 29 Oct. Related: `docs/HANDOFF-AUDITS.md` §8.4 | **The product invites a file it cannot open.** Worse, because both branches *claim* the file, it never reaches `describeUnsupported()` (`:85`) — the polite *"which cannot be read here… Re-upload it as a PDF"* sentence written for exactly this — and fails by exception instead. §5.1. The audit then holds the document unread, so the evidence has a hole nobody is told about | a day |
| **D3** | **A scanned PDF yields no text**, so quotes on it cannot be checked | `lib/documentContent.ts:64`, `:127` | The model still reads the image, but the quote check silently has nothing to check against. Named in the code; not surfaced to the person | a day |
| **D4** | **`/compliance?checklist=<id>` opens nothing** | `docs/HANDOFF-CODE.md` §7; `components/DocumentReport.tsx:701`, `:760` | Confirmed on screen with a real id and a non-existent one: no drawer, no notice, the parameter left in the URL | an hour |
| ~~**D5**~~ | ~~The Audits box's typed question is not carried to the workspace~~ — **CLOSED 3 November 2026 by removing the link** (decision 35). `app/audits/page.tsx:621` was a bare `href="/compliance"` that carried nothing the person had typed. There is nowhere to carry it to any more: the question is answered on the page it was asked on. | `app/audits/page.tsx`, the Ask tab | done | — |
| **D6** | **`conversation_reset` is sent by the route and read by no page** | `docs/HANDOFF-CODE.md` §7; `app/api/chat/route.ts:82` | *"Start fresh"* in the conversation-lost sentence does nothing — the conversation on screen is not cleared | an hour |
| **D7** | **The failed line can show a raw provider message** | `docs/HANDOFF-CODE.md` §7; `lib/ai.ts:833–834` via `app/api/chat/route.ts:382` | Every string that can reach `x.error` is listed there. **Unchanged by decision: the owner decides the wording** | an hour |
| **D8** | **Company information's literal `'FACTS_CHANGED'`** — the page dispatches the constant at `:201` and the *name of the constant* at `:318` | `docs/HANDOFF-FROM-CALENDAR.md` §7.5; `app/company-information/page.tsx:318` | That listener never fires, so the sidebar badge keeps a stale number after whichever write `:318` guards. **One line**, and it needs that page's own walk | an hour |
| **D9** | **A withdrawn date shows a fourth, unlinked line in both report drawers** | `docs/HANDOFF-CODE.md` §7 | Reads *"Not in the latest reading of this file"* as plain text with no link, because `calendar_v` does not return a withdrawn row. **Expected**, measured, and named | a day |
| **D10** | **`check:live`'s seeded reading drifts `usage_counters.files_read` upward on staging, every run** | `docs/HANDOFF-CODE.md` §7; `scripts/check-live.js:627`, `:725` | Cosmetic and staging-only, but a staging counter and a row count will never agree and nobody should read that as a bug | an hour |
| **D11** | **A checklist audit on the thinnest fixture is refused in prose on Haiku** | `docs/HANDOFF-AUDITS.md` §8.5; `prompts/audit-agency.ts:290` | `check:live` fails on it **and the failure is left standing** — a fixture tuned until the model complies measures the fixture | a day |
| **D12** | **Three site-scope questions cannot be answered Yes or No** (`air_toxics_program_applicable`, `exposure_vinyl_chloride`, `industrial_stormwater`) | `docs/HANDOFF-CODE.md` §7 | Each offers two alternatives, so Yes cannot say which half. Harmless today because site questions are asked nowhere — **owed to whoever asks a site question first**, with migration 081 §2 as the pattern | an hour |
| **D13** | **`/upload` is broken and unreachable.** `app/upload/page.tsx:89` calls `getPublicUrl` on a private bucket | `STATUS.md`, Upload rows; `docs/TODO.md` §0.7 | Nothing links to it; `/documents` is the upload surface. `INVENTORY-2026-09.md` proposes deleting the page. **A decision, not a fix** | an hour |
| **D14** | **Ten near-duplicate company names on production** | `docs/HANDOFF-CODE.md` §7; `docs/HANDOFF-FROM-DASHBOARD.md` §7.7 | A tidy-up, not a defect — but any per-company reading of production is hard to read and a demo would be embarrassing. Only `CB-Test-3` holds data | an hour |
| ~~**D15**~~ | ~~**A reading card in the Calendar chat lands nowhere.**~~ **CLOSED 2 November 2026** — `docs/GAPS-PLAN.md` Part A step 4b. `app/documents/page.tsx` reads `?document=<id>`, resolves it against the rows it has already read, and opens that report in the drawer; an id that matches nothing shows one plain line — *"That document is not on file. It may have been deleted."* — and never says WHICH of deleted, never-existed or another company's, because telling a stranger that an id exists is the probe §3.6 answers 404 to. **Walked live on the isolated Haiku server:** a real source card in a real answer, clicked, landed on the Documents tab with that permit's report open. Company information's fact links are mended by the same change, with no edit to that file. | — | — | done |

---

# C. Security and limits

| | what it is | recorded in | what it risks | size |
|---|---|---|---|---|
| **S1** | **⚡ The Resend sending domain's DNS.** All four senders use `onboarding@resend.dev`, Resend's **shared sandbox** address | `docs/HANDOFF-FROM-CALENDAR.md` §7.1; `docs/HANDOFF-CODE.md` §7 | **A release gate.** No SPF, DKIM or DMARC for compliboard.com; the audit email **already landed in junk** on 1 October. The monthly job **refuses to send on production** by design until this is done | an hour (plus DNS propagation) |
| **S2** | **`POST /api/signup` is unauthenticated and unthrottled** | `docs/HANDOFF-FROM-ACCOUNT.md` §7.9; `app/api/signup/route.ts` | No rate limit, no captcha, no email-verification gate before the walk — and **the walk kicks a paid website read**, so the cost is not only rows. It has never mattered because nobody knows the address | a day |
| **S3** | **`authenticated` holds table-level INSERT and DELETE on `profiles`** | `docs/HANDOFF-CODE.md` §7, row 2; migration 000 | **Closed by RLS today** — no INSERT or DELETE policy exists — so it is a grant that is not a hole. The same shape 080 closed for UPDATE. *A grant list says what was added, not what a role holds* | an hour |
| **S4** | **`service_role` holds all eight privileges on `stripe_events`**, not the three 087 grants | `DECISIONS.md` §223 C; `docs/HANDOFF-CODE.md` §7 | `postgres`'s default ACL (068) grants everything on creation. **Staging is byte-identical**, `anon` and `authenticated` hold nothing, and the webhook and reconcile are its only holders. Narrowing needs an explicit REVOKE | an hour |
| **S5** | **`GET /api/obligations` writes ~200 obligation rows on a first visit**, behind a page linked from nowhere | `docs/HANDOFF-CODE.md` §7, the parked items | Guarding the page alone leaves a writable endpoint behind it | a day |
| **S6** | **`expires_at` is set by nothing** on `company_switches` | `docs/HANDOFF-CODE.md` §7 | An expired fact must read `unknown`; **a stale `false` is a false green**, which is §3.2's territory | a day |
| **S7** | **Re-sending an attachment on every turn is unbounded in cost** | `docs/HANDOFF-CODE.md` §7; `lib/attachedDocument.ts`, `MAX_CARRIED_DOCUMENTS = 3`. **Measured 2 November 2026** at `docs/GAPS-PLAN.md` Part A step 3 | Correct but expensive on long PDFs. A size threshold was deliberately **not** invented; the measurement to justify one is in `ai_calls`. **⚡ THE NUMBER, AT LAST: ~2,376 INPUT TOKENS A TURN, EVERY TURN, for one 223 KB eight-page PDF** — 8,218 input tokens on a Calendar answer carrying it against 5,842 on the same question without it, both on Haiku, both read from `ai_calls`. At the cap of three files that is roughly 7,000 a turn before a word of context. **And it is now three sections' problem, not one:** the Compliance Workspace, the Calendar, and every section the shared chat reaches next. Whether a size cap is owed is the owner's call | a day |

---

# D. Waiting on the owner

*None of these is Claude Code's to decide.*

| | the decision | recorded in |
|---|---|---|
| **O1** | **The three parked items for the final check** — the confirmation queue's flag, the requirements route's guard, the invented keys in the shared brief | `docs/DASHBOARD-PLAN.md`, *"Parked for the final check"*; `docs/HANDOFF-CODE.md` §7 |
| **O2** | **Whether billing evidence should outlive a deleted company.** `stripe_events.company_id` is `ON DELETE CASCADE`, so deleting a company **destroys the record of what Stripe told us about its money** — the one thing that table exists for. **Seen for real:** resetting the step-20 fixture erased six delivered events and three reconcile rows | `docs/HANDOFF-FROM-ACCOUNT.md` §7.7; `DECISIONS.md` §223; migration 087 §5 |
| **O3** | **Whether `docs/RELEASE.md`'s generic procedure should carry a backup step**, as the Calendar and Account routines now do | `docs/HANDOFF-CODE.md` §7 |
| **O4** | **The wording of every failure message that can reach `x.error`** — several end with two instructions | `docs/HANDOFF-CODE.md` §7 (D7 above) |
| **O5** | **Two proposed HR switches**, yes or no, before they enter `HR-PLAN.md` | `docs/HANDOFF-FROM-HR.md` §7.6; `docs/TEST-AT-FINISH-LINE.md` |
| **O6** | **Whether `/upload` is deleted** (D13) | `docs/INVENTORY-2026-09.md`; `STATUS.md` |
| **O7** | **`docs/INVENTORY-2026-09.md` is 46% out of date and two living files point at it as current.** It says the repo holds *34 API routes and 14 pages*; it holds **63 and 17**. `HANDOFF-CODE.md:29` says to read it *"for every file's state and who calls what"*. Either re-take it, or change that one line — **it could not be archived, because the rule is not to archive what a live document points at** | read 29 Oct; `docs/archive/README.md`, the review of 29 October |
| **O8** | **Ten near-duplicate production companies** — delete the nine empty ones? (D14) | `docs/HANDOFF-CODE.md` §7 |

---

# E. Deliberately not built, with the condition that would change that

*These are not oversights. Each was decided against, with a written reason and a trigger.*

| | not built | the condition that makes it right | recorded in |
|---|---|---|---|
| **N1** | **The periodic reconcile sweep** — a cron that repairs a stale billing mirror before anybody notices | *Enough paying companies that "they will open the Billing tab" stops being true* — read off `check:live`'s billing-mirror question. Cost: a seventh cron, a Stripe call per candidate, rate-limit handling, and a new way to write billing columns with no person in the request | `DECISIONS.md` §222 G |
| **N2** | **A daily job that ends trials** | Nothing. The verdict is computed from timestamps at request time, so a trial that ends at 14:03 ends at 14:03. A nightly job would mean up to 24 hours of wrong state and a second source of truth | `DECISIONS.md` §213; struck at the step 17 stop |
| **N3** | **A rate limiter on the calendar feed token** | Nothing: a 256-bit token is not enumerable | `DECISIONS.md` (line 13275) |
| **N4** | **A unique index on `website_reads.company_id`** | The owner's answer at step 13. *"Read once"* is the route's rule instead — see F10 | `DECISIONS.md` §210 |
| **N5** | **Narrowing `service_role` on `stripe_events`** | A second holder of that key. Today it is the webhook and the reconcile (S4) | `DECISIONS.md` §223 C |
| **N6** | **The gate and critic switches on production** (`RESEARCH_GATE`, `CHECKLIST_GATE`) | Both default OFF and an unset variable *is* the off position. Turning either on needs the measurement in `TEST-AT-FINISH-LINE.md` first | `STATUS.md`, the gate row; `lib/pipelineConfig.ts` |
| **N7** | **A worker process** | Still none. The four crons plus `after()` cover today's work; the worker arrives when a job outlives a request's budget | `CLAUDE.md` §4; `docs/TODO.md` |

---

# F. Hypotheses — not defects, and not to be reported as such

| | the claim | what would settle it | recorded in |
|---|---|---|---|
| **H1** | **A lapsed `repeating` discount with no card reaches decision 11's grace.** We expect Stripe to raise the invoice, fail with no payment method, fire `invoice.payment_failed`, and start the seven days. **Half is observed** — a card that *fails* produces the event and the anchor. A subscription with **no payment method at all** is a different path and has not been walked | A test clock, a repeating coupon and no card, advanced past `discount_ends_at`. **It does not need live mode**, so it is the cheapest open question here. Until it is settled, §217's *"forever coupons only"* is load-bearing | `DECISIONS.md` §221 F, §223; `docs/TEST-AT-FINISH-LINE.md` |
| **H2** | **The three older emails may never have reached anybody but the owner.** The shared `onboarding@resend.dev` sender is normally limited to the account's own verified address | The Resend dashboard's logs. Nothing in this repository can tell delivered from accepted-then-dropped | `docs/HANDOFF-CODE.md` §7 |
| **H3** | **A third turn will not reliably stand by its citations.** 2 of 3 runs with `RESEARCH_PROVENANCE` on; 0 of 3 before | Storing and replaying the tool-use blocks — the structural fix | `docs/HANDOFF-CODE.md` §7; `DECISIONS.md` §128 |

---

## What is NOT on this list, and why

- **Document scan cost.** `STATUS.md` calls it *"the single biggest unknown in what this product
  costs to run"* and `HANDOFF-CODE.md` §6 carries it. It is a **measurement**, not owed work, and
  `ai_calls` is already recording what it needs.
- **The quality pass items** in `docs/WORKSPACE-PLAN.md` Stage 3 (the consistency check, "How do I
  do this?" proving a step's words, effort as a lever, copy-site blocking, `origin` on
  "everything on this subject"). They are five **prompt and model** questions, all §3.1
  quality-affecting, and they belong to one measured pass rather than to a to-do list. Five rows in
  `HANDOFF-CODE.md` §7 point at that file and say so.
- **Anything in `docs/archive/`.** Three of those files are the only written design for unbuilt work
  (`AUDIT-CHECKS.md`, `CHEMICAL-OR-WA.md`, `REQUIREMENTS-SCREEN.md`) and `archive/README.md` says so,
  but none of them is a commitment anybody has made.

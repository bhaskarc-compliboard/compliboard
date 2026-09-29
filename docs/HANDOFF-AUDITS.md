# HANDOFF — AUDITS

*Written 26 September 2026 by the Documents chat, on the day Documents rev 1 reached production. This is the first thing the Audits chat reads. It says what the section is for, how we work, what is already decided, what the code and both databases look like today, the design template every section follows, the structure of a reading report, and how a change reaches production. Where a fact is the owner's to supply, it is marked **OWNER**.*

---

## 1. What this chat is for

Build the Audits section, rev 1, on production. An audit is a by-product of Documents. Everything an audit needs already lives in the document readings: what each document is, what is wrong with it, what it obliges the company to keep doing, which dates it sets, which facts it proved, what a company like this usually holds and does not. The Audits section does not read files. It reads readings, and it says, per agency or per subject, where the company stands and what to do next.

The rules from Documents carry over unchanged: rev 1 is raw Claude plus the interface, no requirement table; the owner's vision comes first, in his own words, before any design; one instruction to Claude Code at a time, in a single code block; every model call writes a cost row; nothing about a company is written silently; unreadable or unknown is said out loud; "compliant" is never a status; build on Haiku, judge on the real model; every saving is a switch measured against the open baseline, never built into it.

**Finish line for rev 1 (draft, until the owner's vision revises it).** A person opens Audits and sees, grouped by agency and by subject, what the readings say: open gaps, passed deadlines, expired or expiring permits, conditions with no evidence on file, and what we would expect and do not see. They can open an audit report in the same drawer as a document report, make a checklist from it, print it, and correct it. The old audit engine (readiness numbers computed from `document_reviews`, documents silently dropped when unreadable) is retired. Every audit call writes a cost row. All of it on production, judged on the golden documents.

## 2. The method, in short

Three roles. **Chat** designs, decides with the owner, reads Claude Code's reports critically, writes one instruction at a time; it never touches the repo or either database. **Claude Code** reads and writes code, runs migrations against staging, tests, commits; it never applies anything to production, never invents regulatory content, never decides a product question; if it needs a decision it stops and asks with the fact it is missing. **The owner** decides product questions, supplies domain judgment, runs production migrations, and presses every irreversible button.

The loop, as it ran for Documents and should run here: the owner's vision first, in his words; the chat asks questions after, wearing two hats (data presentation, software); gaps sorted into schema, data or truth, with "later" named; the design drawn on the canvas and iterated until the owner says "that one"; the contract read off the screen, not the other way round; then runs of a day or two, each one instruction, each ending with a report and the session's cost; then release per RELEASE.md; then the bake-off on the real models. Measurement before building when a number is missing (Documents started with "why does a scan cost $1.10", not with a feature).

Reports are read critically. The chat corrects the record when a report states an inference as a fact or a wrong cause for a right effect (D-0's cost comparison, Run 2's "the probe settled it"). Hypotheses are checked, not asserted.

Every instruction names what to read first, what to build, what not to do, and the exact shape of the report. Every run ends with `npm run cost -- --since <date>`.

## 3. Standing rules (from DECISIONS, do not relitigate)

- **Best result first, no conditions.** The baseline is the strongest model, one open call, search allowed, no shortcuts however obvious. Savings are switches, measured on golden cases run three times.
- **Build on Haiku, judge on the real model.** `.env.local` is Haiku. Quality is not chased on Haiku; mechanical failures are.
- **Every model call writes a cost row** (`ai_calls`, via `ledger: { companyId, task }`), with its own task in `LEDGER_TASKS` and the CHECK constraint.
- **Facts are proposed, never written silently** (§108). One queue, `fact_proposals`, both sources; one question per key; confirmed anywhere is confirmed everywhere.
- **Close, never delete.** Dismissed, rejected, withdrawn, superseded, held: statuses, with reasons, never deletions. Delete exists only for a file the person uploaded.
- **Honest words.** No "compliant". No green for routine. No numeric readiness aggregate (§58.3: no score, no percentage, no "satisfied"). "What we'd expect and don't see" is labelled as based on similar companies until the requirement table makes it a finding. Progress shown on screen is what actually happened.
- **A conclusion beats an absence.** A row never says "Queued" for something that already failed (§132).
- **Derived values are computed when read**, in the view, never stored (the significant date, §134). Stored derived values went stale on the first rule fix.
- **Server-only writes for the model's conclusions.** RLS can say "your company"; it cannot say "only the server". Scan rows, corrections, batches, company facts are written on the service role after ownership is proved on the caller's client (§132).
- **One company's model calls run one after another, never in parallel**, so labels, keys and corrections feed forward (§135).
- **The scan (or the audit) is the matcher** for identity across re-reads: it is shown the previous findings with ids and says which are the same; string matching is the fallback (§135).
- **Claude Code may reset staging under a pty** (CLAUDE.md §3.7); the production guard is never automated.
- **RELEASE.md in `docs/` governs every release.** Migrations first, then variables, then code.
- **One company context, every section benefits from every other (decided 27 Sep 2026; vision doc, "One company context").** Everything a person confirms or corrects anywhere (declared switches, `company_facts`, `document_corrections`, labels and keys in use) is assembled by one function and every prompt in the product reads that block and nothing else for "who is this company". Nothing the model concluded on its own goes in it; pending proposals stay in the queue. It comes with a "Your company" screen where a person sees the same list and can change any line. *(The screen shipped on 28 September and is called **Company information** — `/company-information`. The wording of this rule is left as it was decided on 27 Sep; the name changed in Task 0 commit 3.)* Build the function and the screen before Audits reads anything, so Audits is the first section built on the rule. As it is built: fact keys gain a site scope, confirmed facts carry the as-of date of their source, and an alias table will map fact keys to switch keys when the requirement table returns.

## 4. What Documents provides to Audits

Read these tables; they are the audit's inputs. All in `docs/SCHEMA.md`, regenerated from staging.

| Table or view | What an audit reads from it |
|---|---|
| `document_index_v` | one row per document: kind, title, agencies[], subjects[], site, folder, doc_date, computed significant_date and kind, display_status (needs_work, expiring, expired, could_not_read, not_yet_read, current, recorded, on_file), open_gap_count, corrections applied |
| `document_scans` (current row per document) | summary, jurisdiction, expected_missing[], confidence notes, extracted_text, provenance (model, searches billed, cited_sources, prompt_sha256, ai_call_id, structured or extractor path) |
| `document_gaps` | title, description, fix, citation, locator, basis, quote_verified, draftable, status open/closed/dismissed/superseded with reason, not_seen_at, draft_text, superseded_by |
| `document_conditions` | what a permit or certificate obliges, condition_ref, evidence_expected |
| `document_deadlines` | title, due_on, source_line, recurs, calendar_event_id |
| `fact_proposals` (source document) | proposed facts with quote, locator, basis, affects, quote_verified, status proposed/accepted/rejected/withdrawn |
| `company_facts` | confirmed facts, one per company per key, with source document and proposal |
| `company_labels` | the agency and subject vocabulary in use for this company |
| `document_corrections` | what the person said the scan got wrong |
| `checklists` with `document_id`, `document_gap_id` | work already made from a gap, with progress |
| `document_batches`, `job_runs` | what was read when, and what the sweep did |

Two Audits-shaped tables exist from an earlier design and are empty: `obligation_evidence` (`valid_from`, `valid_until`, `superseded_by`, `matched_by`) and `switch_determinations`. Both are parked until the requirement table returns; do not write them in rev 1 unless the owner's vision says so.

What the old audit engine does today, and must stop doing: `app/api/audits/route.ts` loops over documents, calls `reviewDocument()` directly (the old review path, not the new scan), silently skips a document on any failure, matches against one-line coverage descriptions, and computes readiness numbers from `document_reviews`. Rev 1 of Audits reads `document_index_v` and the gap, condition and deadline tables instead, and retires that loop. `document_reviews` has no writer left in the app.

## 5. The design template (every section follows it)

Read `docs/DESIGN.md` in full; it is authoritative. The layout chat owns it; additions from a section go in as marked additions. What follows is the template as Documents applied it, so Audits and the Workspace match it exactly.

### 5.0 The rule about who is speaking

**The product never names what does the reading. It reads, finds, asks and says.**
*(Added 28 September 2026, Task 0 commit 2.)*

No screen, empty state, button or error says what performs a reading. "We read your permit", "this
is what we found", "is that still right?" — the product is the subject of every sentence. A person
confirming a fact about their own business is helped by the quote and the page it came from, never by
being told what read it; and a line that names the reader invites the reader to be argued with
instead of the fact.

This is not a euphemism. `CLAUDE.md` §6 requires a verified row and a generated row to look
different, and they do — through `basis`, `quote_verified`, "inferred", "these words were not found
in the file", and the amber that carries each. Those say **how sure we are**, which is what a person
can act on. What did the reading is not.

It applies hardest where the product is least sure, which is where the temptation is worst: an
apology that names a mechanism reads as the product blaming a component rather than owning a failure
(§5.1's worked example is the same instinct one step along). **`/company-information` is the first page held
to this rule end to end** and the assertion is in its manual set: the word does not appear on it.

### 5.1 Tokens
- Interface type: IBM Plex Sans. Reading and page titles: Source Serif 4.
- Page background cool grey (`#F7F8FA`), white surfaces, near-black ink (`#14171A`), soft ink (`#5B6470`), light grey for light headings and counts (`#8A929C`), hairline (`#E6E9ED`).
- One green (`#2F7D52`) for the primary action and the active state only. Amber (`#B7791F`) for attention. Grey for routine. Never green for routine.
- Radius small; hairlines instead of boxes; lists sit on the page background.

### 5.2 The shell
- 57px white header with the wordmark; 224px left sidebar with the section list, active item in green wash; "To confirm" carries a count badge.
- Reading surfaces are 775 wide (the Workspace). Working surfaces (Documents, Audits, Calendar) are 900: with the sidebar that leaves 78px margins at 1280, 121 at 1366, 158 at 1440. The drawer is 720.

### 5.3 A section page
1. Title in the serif at 28px, one line under it at 14px soft ink saying what the page is.
2. A controls row, hairline under it: filters on the left as "Label value ▾" dropdowns (Folder, Group by, Site when the company has more than one), the primary action on the right as the one filled green button ("Add files"), a tertiary text action beside it if needed ("Add a folder"). No form controls inside the list.
3. The list, grouped: group headings at 12px uppercase with the count in light grey after them. Headings that carry a name (Agency, Subject, Kind, Site, Folder) in the darker grey; headings that carry a state or a date (Status) in the light grey. Default grouping is status, "what needs me today" first. Group by None is the flat sortable table.
4. Rows, three columns, hairline between rows, no boxes: left, the reading's title at 13px and a 12px meta line (filename · folder · read <date> · N older versions); middle (230px), agency and kind · site; right (160px, right-aligned), the status word (amber for attention, grey for routine) and the date that matters under it at 12px. Rows with no value for the grouped column sit in a last group ("No agency yet"), never dropped. Could-not-read rows carry the reason as a second line and an "Upload a clearer copy" action. Groups over eight rows collapse to eight with "Show all N".
5. Under an Agency grouping only, one amber-wash line per group beginning "What we'd expect and don't see:" and ending "Based on what similar companies hold, not on a checked requirement.", three items and "and N more".
6. A banner at the top when a batch has finished, dismissable, the same summary as the email.

### 5.4 The drawer (the report)
- Opens from the right on row click, 720 wide, scrim over the dimmed page. Sticky header: 18px medium title, 13px sub line (kind · agency · site · filename · read <date>), a "Filed in ▾" control, close. Scrolling body. Footer with the button vocabulary: at most one outlined green button (the model-call action), the rest text actions, Download at the far right, Delete last and smallest.
- Section headings in the body at 12px uppercase; "Status" light, the rest dark (they name parts of the report).
- The summary in the serif at 17px; item names at 16px; descriptions at 15px; source lines and locators at 12px soft ink.
- Print: a print-only header (company | title | sub line | printed date | CompliBoard), chrome hidden, drawer static, text-only styling; the rules live in `globals.css`, one copy for every screen.

### 5.5 The report structure (the template for any reading)
The Documents report is the pattern for every report the product produces, including an audit report. Sections appear only when they have content, in this order:
1. **Status and the date that matters**, one line: the status word (amber or grey) · the count that qualifies it · the date with its kind.
2. **What this says**: two or three sentences in the serif saying what kind of thing this is and what that means for the reader. Written to be read once.
3. **The nudge**, amber wash, only when a rule produces one (freshness over three years for a program; a non-recurring deadline that has passed), always with the way forward as two text actions.
4. **What this is**: a two-column list of identity facts, each with where it came from (page, section, condition number), and one link: "Not right? Change what this is", opening an inline correction form that writes correction rows.
5. **Gaps**: numbered; each with title, description, "Fix." paragraph, citation as a link, locator, "inferred" after the title when the basis is inferred, then the actions in one line: Draft this section (when draftable), Make a checklist, Research this, Not right. A linked checklist shows as its title with "checklist made <date> · N of M done". Dismissed gaps under a "Dismissed" subheading with the reason; gaps from earlier readings under "From earlier readings"; a gap the latest reading did not mention carries "not seen in the latest reading".
6. **Dates this document sets**: title, date, source line, recurs; "Add to calendar" or "In your calendar"; a passed non-recurring date reads "Passed" in amber.
7. **Conditions to keep**: title, condition number, the evidence you would hold, "Add the log".
8. **Facts we found, please confirm**: the fact, the verbatim quote and its locator, "inferred" when inferred, "quote not found in the file" in amber when unverified; Confirm / Not right (reason required); confirmed reads as confirmed; withdrawn reads "no longer proposed by the latest reading".
9. **Versions**: each with issue date and upload date, "This version" / "Superseded", "Same document" / "Not the same document?".
10. **A quiet last line**: read on <date> · quotes are word for word and inferences are marked · N sources looked up · read by <model> · Not legal advice.
- For a reading that failed: the reason, the way forward, one action, nothing else.
- Footer: [Make a checklist for all N gaps] outlined · Open the file · Read it again · Delete this file · Download.

An audit report uses the same skeleton with the nouns changed: status by agency; what the readings say; the nudge for the most urgent passed date; what this covers (agency, subjects, sites, documents read, documents held or unread); findings in place of gaps (each pointing at the document and gap it came from); dates across documents; conditions with no evidence on file; facts the audit relied on; earlier audits in place of versions; the quiet last line.

### 5.6 The "To confirm" page and the queue
- 900 wide; title; one line; the ranking rule printed on the page; three at a time with "Show more"; each key once with every source under it; Confirm settles the key, or asks when sources disagree; Not right rejects the group with one reason. The sidebar count is keys, not rows.

### 5.7 Email and banner
- Subject "We've read your N documents". Body: the summary, one line per document needing attention, "On file and nothing to do: N", one link to the page from `NEXT_PUBLIC_APP_URL`. The email has nothing of its own; every line is a row in the index. The banner shows the same summary until dismissed.

## 6. The file structure (every section follows it)

```
app/<section>/page.tsx                      the page: controls row, grouped list, banner, opens the drawer
app/api/<section>-scan/route.ts             the model call route (requireCompany; ledger; never a 500 on model or parse failure)
app/api/<section>s/index/route.ts           the page's one read (a view)
app/api/<section>s/report/route.ts          the drawer's one read (everything a report needs, six tables, one request)
app/api/<section>-actions/route.ts          the free writes: corrections, dismissals, confirmations, versions, delete (one route, several verbs, ownership proved first)
app/api/<section>-checklist/route.ts        model-call actions each get their own route and ledger task
app/api/jobs/<section>-sweep/route.ts       the background sweep in the cron pattern (CRON_SECRET, job_runs, per-item errors, time budget, one company at a time)
lib/<section>Scan.ts                        buildContext, the call, normalise (trust nothing that comes back), verifyQuote, chooseSignificantDate, saveScan (server-only writes)
lib/<section>Batch.ts                       summariseBatch, notifyBatch
prompts/<section>-scan.ts                   the prompt, plain voice, "say what to do, not what not to do"; the JSON shape and its schema side by side; edit freely, no code depends on wording
prompts/<section>-draft.ts, -checklist.ts   one prompt per model-call action
components/Drawer.tsx                       the shared drawer shell
components/<Section>Report.tsx              the report body, sections in the order above
supabase/migrations/NNN_<what>.sql          one migration per change, opens with why, ends with a verify block that tries to break its own constraints and reads privileges back; probes use a throwaway company; additive except where stated
docs/SCHEMA.md                              regenerated, never hand-edited
tests/golden/<section>/README.md            how cases are judged
tests/golden/<section>/NN-<case>.md         spec: render-as, company context, DOCUMENT TEXT, ANSWER KEY (must, must-not, near misses)
tests/golden/<section>/fixtures/            rendered from the spec text, verified against the PDF text layer, timestamps pinned
tests/golden/<section>/cases/*.json         one per fixture, built from the answer key, never adding expectations the spec does not state
tests/golden/<section>/runs/<case>/         every run's full JSON, so a person can read what the model said
scripts/run-golden-<section>.js             npm run golden:<section> [-- prefix] [--times 3] [--from-runs] [--seed-only]; judges by concept, never by count; prints one table per case
scripts/render-golden-<section>.js          renders fixtures from spec text
scripts/<section>-scan.js                   run the scan on one file, N times, context rebuilt per run
docs/TESTING.md                             the manual set per run: perfect case and edge case per feature, run signed in against staging
docs/DECISIONS.md                           one entry per run, written by the chat from the report
docs/releases/<date>-<section>-rev1.md      the release note: commits, migrations with probe behaviour, variables, what changes on the day, smoke test
```

Shared code every section uses and must not copy: `lib/ai.ts` (askAIWithCitations, askAIJson, extractJsonText with the balanced-brace scan, modelForTask, the streaming path), `lib/costLedger.ts`, `lib/documentContent.ts` (parseDocumentToBlocks), `lib/jobAuth.ts`, `lib/auth.ts` (requireCompany, supabaseAdmin), `config/pricing.ts`.

## 7. What the code and both databases look like today (26 September 2026)

- **Migrations:** 000 through 054 on both staging and production; the chain builds from empty (proven twice on 26 Sep). `npm run db:restore` rebuilds staging in eight steps (library, fixtures) and must follow any reset; `npm run golden:docs -- --seed-only` re-seeds the three golden companies.
- **Production Vercel variables:** the six from June, the nine from 23 Sep (`CRON_SECRET`, `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT = claude-opus-5`, `AI_MODEL_SUBSTEPS`, `AI_MODEL_SUMMARY`, `AI_EFFORT`, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST`, `RESEARCH_PROVENANCE`), and from 26 Sep `NEXT_PUBLIC_APP_URL`, `AI_MODEL_DOCUMENT_SCAN = claude-opus-5`, `AI_SCAN_STRUCTURED = false`. `NOTIFY_TEST_TO` must never exist on production. The bare `AI_MODEL` is not set. **OWNER** confirms the values of the 23 Sep model variables if a section depends on them.
- **The scan:** `lib/documentScan.ts`, task `document_scan`, native document block for PDF and images, shared parser for the rest, extracted text kept for quote checks, web search on and uncapped in production (`DEV_MAX_SEARCHES=2` in dev), maxTokens 16000, JSON via the extractor (the schema is off on production: Opus 5 refuses it as "compiled grammar too large"; Haiku accepts it).
- **The sweep:** `/api/jobs/scan-documents`, cron `*/5 * * * *` on Vercel Pro, plus an `after()` kick-off at upload; 800s budget, stops starting new documents at 640s; stuck claims recovered at 900s; one company at a time. `LIVE_SCAN_MAX = 3`.
- **Cost:** a five-page program on Opus 5 with search uncapped, $0.517. On Sonnet 4.5 about $0.38; on Haiku with search capped at 2 about $0.05. Cost is not a product decision now; it informs the subscription price later.
- **Quality, recorded not acted on:** Haiku misses planted gaps and invents rule numbers with zero searches; Opus 5 found all three planted EAP gaps on its first production read. The bake-off (Opus 5.5, Sonnet 5, Haiku; schema on and off; search uncapped; seven fixtures × 3) has not run. Opus 5.5 needs a pricing row first.
- **Known debts touching Audits:** the old audit engine's loop and silent drop (above); `/api/extract-dates` has no auth check and no caller on the Documents page; `document_scans.entity_id` is not checked against the document's company; `job_runs.ok` is always true; fact keys are company-scoped and should be site-scoped.

## 8. Operations: what Claude Code may run, and how

- Local dev (`npm run dev`) points at staging via `.env.local`. Never at production.
- `npm run check` (typecheck, schema contracts, tests with a floor, build) before every commit. `npm run check:live` signs in as a fixture and drives routes against staging; it is the gate for any migration touching a tenant table.

  > **⚠ MORE THAN TWO OF ITS ASSERTIONS FAIL ON THE HAIKU TIER, AND THE SET IS NOT FIXED.**
  > *(Corrected 28 September 2026 from two runs; a third added 29 September.)* This bullet named two —
  > `attachment/tier` and `attachment/errors`, the content assertions that pass on production's
  > configuration. Measured:
  >
  > | assertion | run 1 | run 2 | run 3 |
  > |---|---|---|---|
  > | `convert complete` — expects both origins, Haiku returns `{"conversation": N}` only | ✗ | ✗ | ✗ |
  > | `attachment/errors` — named 2, then 3, then 4 of the policy's 5 errors | ✗ | ✗ | ✗ |
  > | `attachment/tier` — the 25 + 31 = 56 headcount | ✗ | **✓** | ✗ |
  >
  > Three runs: two fail every time, one fails two in three. `attachment/errors` got *closer* each
  > run (2, 3, 4 of 5) without passing, which is worth knowing — it is a threshold assertion on a
  > model's recall, not a binary about wiring.
  >
  > **So the honest statement is not "two" or "three" but "two reliably and a third intermittently",**
  > and `convert complete` is the one the documentation never named. It is a model-quality outcome
  > rather than a wiring fault, and that was checked rather than assumed:
  > `app/api/checklists/from-topic/route.ts` and `prompts/convert.ts` are untouched by Task 0, and
  > that route reads no company context — its prompts are constants.
  >
  > **And one line is neither a pass nor a failure:** `sources` reports `NEITHER a denial nor a clear
  > affirmation`, the standing third-turn citation defect in `HANDOFF-CODE.md` §7.
  >
  > Why this matters more than the count: a run reporting "3 problems" against a document saying "2
  > are expected" is a run somebody reads as green — and a *flapping* assertion is worse than a
  > failing one, because the first green run is the one that gets quoted.
- `npm run db:reset` and `npm run db:restore` on staging, under a pty, after any new migration; the result is read from `supabase_migrations.schema_migrations`, not from the command (twice the pty automation silently did nothing).
- `npm run golden:docs`, `npm run cost -- --since <date>`, `npm run preflight` (read-only against production; the only production access Claude Code has).
- Claude Code commits and does not push. A push to `main` deploys production. Migrations run on production only by the owner, via `npm run db:migrate:prod` and the word PRODUCTION.
- Before a long run, `/clear` Claude Code's context; the instruction carries its own reading list and the repo is the memory.

## 9. How a change reaches production

`docs/RELEASE.md`. Preconditions: `npm run check` green with the test count; `check:live` run on staging with every pending migration applied; the owner's manual tests from TESTING.md done against staging. Then: `npm run preflight` (the pending list must be exactly this release's migrations); `npm run db:migrate:prod` and the word PRODUCTION; variables on Vercel (Config type for anything readable; `NEXT_PUBLIC_*` before the push because it is baked into the build); `git status --porcelain && npm run typecheck`; `git push`; the smoke test on the live site, including the `ai_calls` row's model and cost and the `job_runs` row within five minutes. Rollback of code is a revert and a push; of a switch or model, one variable; of a migration, never (a new migration).

## 10. Parked, from Documents

**File types (vision doc, "File types"; one small run after the bake-off and before drive connection).** Eleven types read today (PDF, JPEG, PNG, GIF, WebP, .xlsx, .xls, CSV, text, .docx, .pptx). The picker also promises `.doc`, `.ppt` and `image/*`, and those fail on read (HEIC from every iPhone, TIFF from every scanner). To add: server-side conversion for HEIC/TIFF/BMP; `.eml`/`.msg` and `.zip` expanded into batches; `.md`/`.rtf` as text; honest refusals with export instructions for `.doc`/`.ppt`/Apple formats; PDFs over 100 pages or 32 MB split or text-read and said so; password-protected PDFs asked for, not failed generically; the picker's list generated from the parser's table; one fixture per type. The rule: every type the picker offers is one the product reads, or the picker does not offer it.

Drive connection (its own run when the owner's Google and Microsoft accounts exist). The requirement table's return (`evidence_types` on the library, canonical agencies, `switch_determinations` and `obligation_evidence` written, the seven "never infer" rules as measured switches). Chat over documents. Pinned views. Nested grouping. Site-scoped fact keys. A rule for gaps not seen twice. The structured-output schema simplified and measured. Prompt caching and Batch API as measured switches. The weekly email.

## 11. What only the owner can supply (ask before designing)

- **OWNER** The vision for Audits, in his own words, before any design: what an audit is to an EHS person and to an owner, what they do with it, how often, who sees it, whether it is per agency, per subject, per site, or all three; what "we're ready for an inspection" means to him; what he wants the first screen to answer.
- **OWNER** Whether an audit is a standing view over the readings (recomputed on every visit, no model call) or a dated report the person asks for (a model call, kept, with earlier audits as versions), or both. The Documents pattern suggests both: a standing page grouped by agency, and "Audit this agency" as the one model-call action that produces a report in the drawer.
- **OWNER** What the old audit screens are used for today (Audits, HR audits), and whether HR audits are part of Audits rev 1 or of HR.
- **OWNER** Golden cases for audits: which combinations of the seven golden documents make a good audit case, and what a correct audit must say about each. The chat writes the specs and answer keys; Claude Code renders and judges.
- **OWNER** Whether "ready for inspection" language is allowed anywhere; §58.3 says no numeric readiness, and the honest vocabulary is per agency: findings open, dates passed, conditions without evidence, expected and not seen.

## 12. First tasks

0. The company context, before anything reads for Audits: one function in `lib/` assembling declared switches, confirmed facts (with site scope and as-of date), corrections, labels and keys; every existing prompt builder (document scan, research, checklist, draft) switched to read it and nothing else for the company; a "Your company" page at 900 with the settled list and an edit per line — **built, and named Company information** (`/company-information`, Task 0 commit 3); golden runs re-run once on Haiku to show nothing mechanical changed. One run, its own DECISIONS entry.
1. The owner's vision, then questions, then the canvas: the Audits page (900, the template above), the audit report drawer (the report structure above with audit nouns), and where "Audit this agency" lives.
2. The contract, read off the drawer: what an audit row and an audit report store, in the same shape as `document_scans` and `document_gaps` (findings as rows with ids and a lifecycle; the audit as the matcher across re-runs).
3. Run 1: the audit as a script over the readings of one golden company, three times on Haiku, mechanics only; the old engine's loop retired in the same run or the next.
4. Then the page, the drawer, actions, and the sweep if audits are scheduled.
5. Release per RELEASE.md; then the bake-off across models for both the scan and the audit.

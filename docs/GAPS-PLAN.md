# Closing the gaps — the plan

**Version:** 27 · **Written:** 2 November 2026, by the gaps chat, after the owner's decisions and Claude Code's read-only map (reported in the terminal, 2 November; not a file).
**Supersedes:** nothing. This is the running plan for the work that makes the homepage's seven gate items true: `docs/HANDOFF-FROM-PUBLIC-PAGES.md` §5 (F1, F4, F6, F7, S1, D2, F12).
**For:** the owner, Claude Code, and the next chat. Updated at every step: a step is crossed off with the date and the commit, like `docs/PUBLIC-PAGES-PLAN.md`.
**The pictures:** `docs/documents-chat-boards.html` — six boards, in the Calendar boards' frame — and, for step 6, `docs/audits-chat-boards.html`, five boards in the same frame (draft 3, 3 November 2026). Its CSS is a mock-up and is never a source for the product's spacing, type or colour. Where a board and a step's brief disagree, the brief wins and the report says so.
**Updated:** 2 November 2026 — **Part A step 1 done** (§5). Four commits: `d14ac16` the plan and the boards, `877d67f` the four doc corrections, `29324c5` the engine and migration 091, `bfdbd67` the types and the schema doc. §8 gains three things the step found: the Haiku guard could pass while seeing no tiers at all, two HR tests pinned the old night-summary list, and Supabase CLI 3.0.0 broke the project's own migrate and schema-doc scripts.
**Updated:** 2 November 2026 — **Part A step 2 done** (§5). Two commits — `b93757c` the lift and `4431ee4` the proof — plus the staging trial parking, which the OWNER ran in Terminal 3 and which has no commit because it is data and not code. §7 gains the action row for the owner to pick. §8 gains what the step found: the Supabase CLI cannot write to staging through `--linked` at all, and the Calendar page no longer draws a paused note of its own.
**Updated:** 2 November 2026 — **Part A step 3 done** (§5). Three commits: `4c6652c` the engine's carry, `0c76344` the upload, `dafc786` the two defects the Haiku proof found. §3 records the two step-2 decisions now in force (the action row keeps Calendar's layout; the Delete sheet's words stand). §7 gains the paused sentence and S7's measured number. §8 gains three findings, one of which is a quality question for the owner.
**Updated:** 2 November 2026 — **Part A step 4a done** (§5), and step 4 split into 4a and 4b. Two commits: `7e6742b` the packer and the dump, `01feb15` the brief and the prompt. §3 records the four step-3 decisions. §7 gains what the owner reads next. §8 gains the one thing 4a could not do.
**Updated:** 2 November 2026 — **Part A step 4a-test done** (§5). Three commits: `6a4dae1` the eleven sentences and the quote fix, `67d6b45` the six keys and the probe, and the plan's own. **The verdict in one line: the brief and the prompt earn their tokens on five of six questions and are worth the 2.4× they cost, and the one place they are not ahead is a question about an attached file.** §8 gains three things the runs found, one of which corrects step 4a's own rendered sample. §7 gains the prompt changes the runs ask for.
**Updated:** 2 November 2026 — **Part A step 4a-compare done** (§5). One commit: `54f509c`. The owner's three prompt decisions and the index-passage decision are **YES** and are done in 4b, not in that run; the action row is struck from §7 as decided at step 2. `docs/TEST-AT-FINISH-LINE.md` gains **"Which model, per tier"** as a shared item, with this as its first data point.
**Updated:** 2 November 2026 — **Part A step 4b done** (§5), so **Part A's Documents work is finished** and only steps 5 and 6 remain. Four commits: `7d6662e` the thirteen sentences and the quotable index line, `0319c1a` the two routes and the shared summarise body, `31162e0` the page, and the plan's own. §3 gains decisions 24–27. §7 loses four items that are now answered. §8 gains two things the walk found. `docs/PENDING.md` F12 and D15 closed; `STATUS.md`'s Documents row says the page has the chat.
**Updated:** 2 November 2026 — **Part A step 5 done** (§5). Two commits: `7849018` the checklist from any chat, and the plan's own. §3 gains decisions 28–30 (the ?checklist= address, the row's wrapper, the Queued sentence). **The owner's own walk of 4b passed on Opus** — recorded on 4b's row. §8 gains the one thing this walk found, which was in the harness and not the product. **Only step 6 is left in Part A**, and it begins with the owner's board of the Audits box.
**Updated:** 3 November 2026 — **Part A step 6 MAPPED** (§5), read-only, and **F6 is settled by running it**: one template audit against `tests/golden/audits/fixtures/12-auditor-checklist-deq-air.docx` on the isolated Haiku server finished in 43 seconds — 3 sections, 16 lines, 16 findings, 0 could-not-complete, $0.0829 — and the rows were read back from staging with the CLI. `docs/PENDING.md` F6's "returns 400, not ready" is **wrong and has been wrong for a while**. §3 gains the owner's six decisions of 3 November (31–36). §5's step 6 row is rewritten to the three-tab design and split into 6a and 6b. §7 gains the HR line and four open questions. §8 gains what the map found — including **the one thing that cannot be built without editing a shared component**. One commit: the boards and this file.
**Updated:** 3 November 2026 — **Part A step 6a done** (§5). Two commits: `fdc83c3` the brief, the prompt, the words, the examples and the six keys written first, and the plan's own. §3 gains the owner's decisions **37–42**. **The verdict in one line: the Audits chat scores 57 of 64 against keys written before any run; the Documents chat on the same six questions scores 12, and on four of them it cannot score at all because it cannot see that the company has been audited.** It costs 1.44× and scores 4.75×. §7 loses the four answered questions and gains **two stops**: `lib/ask/offers.ts` must learn `run_audit`, and the engine's `A` handle collides with a checklist's own A1–A5 line labels. §8 gains five things the runs found.
**Updated:** 3 November 2026 — **Part A step 6b done, and PART A IS COMPLETE** (§5). Two commits: `cca74dc` the page, the looker, the merged tab, the two routes and the three shared edits, and the plan's own. §3 gains decisions **43–45**. The Audits page has three tabs; the box left the audits tab and the Ask box took its job. **The agency rows did not move: 0 differing pixels** over the whole group at −192px, with 14 on the bottom edge of two native dropdowns. §7's two stops are closed. §8 gains **two defects the walk found**, one of them in the rule the owner wrote: a QUESTION about an audit was starting one. Walked on Haiku for **$0.7136**.
**Updated:** 3 November 2026 — **PART A IS CLOSED, THE OWNER'S OWN WALK IS RECORDED, AND PARTS B TO E ARE MAPPED** (§5a). Read-only: no code, one commit, this file. The owner walked the finished product on Opus on his own dev server — a folder of eight synthetic documents, a ten-line auditor checklist on the paperclip, *"Audit us against the attached template"* typed into the Ask box — and **the audit scored 10 of 10 against his key and caught two errors in the key**. Nine things the walk found are W1–W9, every one of them read back from staging's own rows with the Supabase CLI's read-only connection. §7 gains **the audit's fifth word** as the first open question, with the whole map of where the word lives, plus the template-reads-its-own-template question and the legal-name question. §8 gains six findings, of which two are new product defects with a price on them: **a reading that failed on an unchecked field while its row says the model was never called** (three scans, two companies, one evening), and **six seconds of nothing on screen after a typed command, which bought a second identical audit for $0.49**. §5a writes Parts B (file formats), C (the binder), D (Resend, Stripe, the loose ends) and E (the display pass) as step tables with what exists today by file and line.
**Updated:** 4 November 2026 — **PART B IS COMPLETE. STEP B4 DONE: the six formats that were already free, and the PDF nobody can open (decision 54, commit `b35b78e`).** `officeparser` has been a dependency since the PowerPoint branch and its own refusal names everything it reads, so `.odt .ods .odp .rtf .md .html` cost **a branch and a fixture each** — no dependency, no converter, no service. **`READABLE_EXTENSIONS` 17 → 23.** `.html` becomes its **text, not its tags** (1,432 characters of markup → 612 of words); `isExcel` is narrowed from `spreadsheet` to `spreadsheetml`, because an ODS's media type contains the word and the old test claimed every one of them; and an **empty `.md` or `.html`, which throws nothing at all**, is now a failure rather than an empty block handed to the model. **The headline is what the product was paying for:** a password-protected PDF went to the model whole and base64'd — `ok: true`, 1,420 base64 bytes, `text: ''` — while the log said *"No password given"*. **The library already knew and the catch threw it away.** It is refused before the model call now, with the owner's sentence; read back from staging, `ai_call_id = null`. **B5 is closed by B2's map with no code** (every reading path checks access before any conversion, by line), **B3 was struck**, and `PENDING.md` **D2 is CLOSED**. `npm run check` **2,414 tests**, floor 2395 → 2414. D3 is answered and not built: two lines in one file, recorded as a Part E item. — *Previously:* **PART B STEP B2 DONE: the product reads a phone photo, a scan and a drum label, inside Vercel (decisions 52 and 53, commit `96d05ae`).** No conversion service: `libheif-js` is libheif compiled to WebAssembly and runs in Vercel's Node runtime, which is why **B3 is struck** and the container is rev 2 in §5b. `lib/imageConvert.ts` converts HEIC/HEIF (`heic-decode`, raw RGBA straight into sharp), TIFF (sharp, **one image block per page, capped at 20** — the API's own threshold) and BMP (`bmp-ts`; sharp can read neither BMP nor HEIC, both settled by running it), then puts every image through **one rule: rotate → 2,576 px inside → JPEG q80**, with a byte belt. An image already inside the caps is passed through untouched. **Anything over 50 megapixels is refused from its header in under half a second**, with a sentence that says the number, because `heic-decode` has no scaled decode and a 48-megapixel photograph measured **1,036 MB**; `vercel.json` gives the two reading routes 2048 MB for the same reason, and `/api/document-scan` — which had declared no ceiling at all — now says 800 like its siblings. **Walked on Haiku:** the drum label read and the reading named the chemical, the CAS number and both hazard statements; the paperclip answered a question about it; a 3-page TIFF read as three; a **real 48 MP JPEG** read with no rejection; a half-sent HEIC landed `could_not_read` with the fallback sentence. `npm run check` **2,395 tests**, floor 2365 → 2395. `docs/VISION-DOCUMENTS.md` corrected on both counts. **The converted copy is stored** at `<company>/converted/<documentId>.jpg` by `saveScan` — two levels, which is what account delete's walk needs — with migration 092 applied to staging and read back from the live schema, and *"Open the file"* handing over the copy when there is one. Proved on staging: the key landed, the copy is a real JPEG (`ffd8ff`, 230,573 bytes) and **the original is untouched** (192,356 bytes, brand `heic`). — *Previously:* **PART B STEP B1 DONE: the product now offers only the file types it can read, and says which type and what to do about the rest (decision 51, commit `a2e56e4`).** `lib/acceptedFiles.ts` is the one list — **twelve extensions, read off `lib/documentContent.ts`'s own branches, and no `image/*`** — and the one place the sentences live; `parseDocumentToBlocks` calls `refusalFor` as its **first statement**, 40 lines before any model call, so every picker and all three reading paths say one thing. `isWord` claims `.docx` only and `isPowerPoint` `.pptx` only; mammoth, officeparser and xlsx each have a `try`, and an **accepted** type that will not open gets its own different sentence. The folder picker — which can have no `accept` at all — drops what it cannot read **before anything is uploaded** and says *"1 file skipped: 1 old Word (.doc)"* with the sentence underneath. **Walked on Haiku as Cascade:** the folder, the paperclip, the Workspace, HR, and a `.doc` that reached the sweep anyway — which landed `could_not_read` with its own words, `model = '(not called)'` and **0 cost rows**, read back from staging. `npm run check` **2,365 tests**, floor 2336 → 2365; 29 new, the first four reading both the list and the reader and failing on drift. `PENDING.md` **D2 is narrowed to the converters, not closed**. §8 carries five findings, two of them fixed in the same commit. — *Previously:* **PART B STEP B0 DONE, and the owner's five decisions after the walk are §3's 46–50.** One commit of code, `43b304e`. Both fixes cost money while they were open. **The reader** sent `doc_date_kind` to the database unchecked while holding `kind` and `status` against their lists, so a sixth word made the INSERT throw and the whole paid reading was lost — three documents, two companies, one evening, and the row that landed said the model had never been called about a call that had just cost $0.114168. An unrecognised word is now `unknown`, said out loud, with the word itself still in `raw_text`; the constraint is unchanged; the three real failures were re-read on Haiku and **all three landed**. **The screen** set `busy` only on an `'ask'` verdict, so a section's look happened with the screen at rest and a second press went through: **a double press was 2 × `POST /api/audit-runs` before and 1 after**, photographed at 700 ms on two isolated servers. `npm run check` **2,336 tests**, floor 2328 → 2336. **§5a is reordered to the owner's addendum**: B0, the rest of B, then **E0 and E1 before C** so the binder is built once on the finished report, then the rest of E; what was Part D is now **§5b, pre-release work in a separate chat**, carrying the S1 correction. §8's W2 and W3 are closed with the fix and the proof, and three things B0 found and did not change are recorded there.
**Updated:** 4 November 2026 — **PART E STEP E0 DONE: the audit's words (decisions 47–49, 55–60 and W5).** **The audit has five words.** `on_file_gaps` — *"On file, gaps found"* — means a document answers the line AND what the document itself shows does not meet it in full; the four old words keep their meanings exactly. **The defect was never a wrong answer:** `prompts/audit-agency.ts` told the model *"ON FILE MEANS A DOCUMENT ANSWERS IT, EVEN IN PART"*, so four greens over four lists of gaps were the only honest thing it could say. **Measured, the owner's own checklist run on two trees on Haiku: 5 of 10 lines moved from `on_file` to `on_file_gaps` — A3, B2, B3 and B4 are exactly the four W4 named — and the run's sentence went from "4 things that need you" to "9 things that need you".** `documents_read` **12 → 11** (decision 49: a template run no longer reads its own template, excluded from BOTH lists); **handles at the person 1 → 0** (W5: `nameDocumentHandles` at save time, on `title`, `locator` and `what_to_do` and **never on `quote`**, tested on the six real leaking lines). **Decision 48 lives in the VIEW** — migration **093**, because *"the status the document would otherwise have"* is the six CASE arms underneath and only SQL can compute them — with `inferred_gap_count` appended last, since `calendar_v` depends on that view; migration **094** restates `audit_findings_word_check` whole. Both applied to staging and read back from the catalog. **It moves exactly one row on all of staging** (17 of 18 `gaps_found` scans have a gap read from the page) and nothing at all on the Clackamas company. `npm run check` exit 0, **2,460 tests**, floor 2414 → 2460; **46 new**. **Three things found and NOT fixed, because each needs one prompt sentence and that is the owner's (§3.1):** a permit expiring in 2028 now reads *"out of date"* (stable over two runs), the same pull puts the fifth word on a practice question, and one golden key is now out of date rather than wrong. §8 has all nine findings with their evidence. **E0 spent $0.9710 over 30 Haiku calls.**
**Updated:** 4 November 2026 — **PART E STEP E0a DONE: the three sentences E0 found and did not make.** All three in, and the measurement says **two of three worked.** ⚡ **E0's own diagnosis was wrong, and that is the finding worth keeping:** `auditTemplatePrompt` returns `[ROLE, HONESTY, SHAPE_T]` and **never includes `SHAPE`**, so E0 named a sentence the model had never been shown as the cause of its own defect. Every rule about the five words has to be written **twice**; both shapes now carry both sentences, the file says so at `prompts/audit-agency.ts:303`–`:317`, and the test counts the copies. **The "out of date" regression is closed** — A1 is no longer `stale` in either run — but it lands on **`on_file`** with `what_to_do: null`, not `on_file_gaps`: whether *"with the renewal application due date noted"* is being under-read is a question about the line, not the word. **`cascade-template-12` 12/17 → 14/17 must**: the widened A5 key passes and C2 and C3 moved, **C1 — the line sentence (2) names — did not**. ⚡ **And the run found something neither of us was looking for: 3 of 6 sections were lost to broken JSON**, every one the same shape on the same line — two quotes joined with `and` inside one `"quote"` field, on B2, which is the fifth word's own two-shortfall case. The product says so honestly and throws a paid section away. Not fixed: a repair in `extractJsonText` or a prompt line about one quote per line are both §3.1. **E0a spent $0.2846 over 12 Haiku calls.**
**Updated:** 4 November 2026 — **PART E STEP E0c DONE: one quote per finding** (the owner's brief called it E0b; `E0b` was already the boards row, so it is **E0c** in §5a). One sentence, in **both** shapes, counted by the test — *"One quote per finding. If two things in the document fall short, quote the one the word rests on and put the other in what_to_do, in your own words — never two quotes joined inside the quote field."* **It answers E0a's finding 4: 0 of 3 sections lost, from 3 of 6**, with `status = 'done'` and **`json_parsed = true`** read back from `audit_sections` on all three, and the regular expression that found every earlier failure matching nothing. **B2 — the line every failure happened on — now carries ONE quote**, the one the word rests on, and names the second operator in `what_to_do` in its own words; nothing was lost by quoting once. One run is not a proof and the finish line still counts it on Opus. **E0c spent $0.0824 over 4 Haiku calls.**
**Updated:** 4 November 2026 — **E2b: six fixes, from the E2b-check.** The check found that a Calendar conversation's every summary item said *"No source cited"* because the answer **paraphrased the attached permit** — *"before"* for *"prior to"* — and `checkQuote` refused it, so the permit was never a source at all. So: **an attached file is a source because it was attached** (every file the turn carries, no quote needed, `checkQuote` untouched and still strict); **`/calendar?date=` is the third address shape** E2a did not know, which is why a conversation about dates summarised with no dates; a `to_confirm` item may carry a **key**, chosen from the waiting list the prompt is now given and **dropped if it is not on it**; the per-item *Confirm it* link returns only for such a key; `lib/checklistConvert.ts` keeps the same sources a summary keeps; and Documents, Audits and the Calendar get the **plain as-of line** and are shown the **company block their own answers already receive**, so *Your situation* stops saying nothing came up about a company whose cabinet the product has read. One sentence in three answer prompts (§3.1, approved): quote an attached file character for character. **Measured on Haiku, $0.0323 over three calls:** the re-asked answer recorded the permit and **0 refused quotes** (2 and 1 before); the re-summary filled *Your situation* and produced two keyed items with live links. **It did not produce a cited source on every item — this Haiku run cited none — and that is said in §8 rather than claimed.** `npm run check` exit 0, **2,598 tests**, floor 2580 → 2598.

**Updated:** 4 November 2026 — **E2a: the three fixes to E2.** *Still to confirm* is **blue** (`#3B6FA6` on `#E6EFF9`) and **decision 62 is corrected in place with the owner's reason — amber means a document falls short, and a question is not a shortfall**. A **document or audit source is now kept** in every section's summary (`PASSAGE_SOURCES`, HR's shape with the address rule in place of the handbook rule), which closes E2's finding and makes decision 63's swap reachable: proved end to end with **one authorised Haiku summarise, $0.005782**, after which the stored summary's source is `/documents?document=7d6a4d4f…`, clicking it swaps the drawer for that reading with *"← Back to the summary"*, and back returns to the summary. And *Still to confirm* **leads somewhere**: its header and every item carry *"Confirm them/it on Company information →"*, and `app/company-information/page.tsx` gained **`?key=`**, which opens that exact waiting question — matched on the key the page already keys its questions by, never on words. **No item carries a key yet** (the prompt puts the key on a FACT), so every item links to the page today and both halves are tested. `npm run check` exit 0, **2,580 tests**, floor 2566 → 2580.

**Updated:** 4 November 2026 — **PART E STEP E2 DONE: the summary report is five cards, and the fold turns the right way up** (decisions 62–64). One file draws it in **six** places. *What applies* opens with the **first authority open** and the rest folded to their counts; *Still to confirm* (amber), *Not answered here* and *Sources* open folded with theirs, and Still to confirm's says what it means. **"Asked and not answered" is "Not answered here"**, each question carrying the owner's line. The colours are the audit report's palette, which moved to **`lib/reportPalette.ts`** — three readers in three sections. **The spacing is board 2's own arithmetic**, measured in both files: an item is `8px 0 10px 18px` over a 1px rule and an authority row is `10px 0 6px`, so item to item is **19px** and an authority row to its first item is **15px**. A source that points inside the product **opens in place** (decision 63): the four sections that own a reading drawer swap it with *"← Back to the summary"* and hide the summary rather than unmount it; HR does not, because a handbook passage has no reading to open. And the product **says it once, at the foot** (decision 64): the lede and the binder's cover carry nothing in CompliBoard's voice, and `PREPARED_LINE` is the one copy. **⚡ What the walk found that no reading would have: a document source cannot reach a summary at all today** — `gatherSources` keys on `url`, a document passage carries its address in `href` with `url: ''`, and only HR passes the option that keeps such a source, so four of the six sections drop them before a summary is written. The display is built and tested for the day that changes; the change itself is to what a summary CONTAINS and is §7's, not E2's. `npm run check` exit 0, **2,566 tests**, floor 2540 → 2566. **No model call: $0.0000.** `components/FoldRow.tsx` deleted.

**Updated:** 4 November 2026 — **PART C DONE: THE BINDER, and it is printed by the browser (decision 61).** `/audits?run=<id>&binder=1` — the cover, the report's rows each citing *"Document n, page p"*, then every cited document once, numbered by first citation, behind a header sheet: **PDFs drawn page by page with `pdfjs-dist` in the browser**, images and B2's converted copies inline, text-bearing originals as the stored `extracted_text`, a file that cannot be fetched as a page saying so and counted on the cover. **`lib/auditRows.ts` is the one source of the rows, the order and the numbering** — the report, its strip and the binder all read it, and the zip's hand-copy of `citationOrder` went with the zip. **No server build, no stored file, no migration, and no model call: $0.0000.** Measured on the isolated Haiku server: the Clackamas binder **19 printed pages, 1.36 MB, 9 seconds** to prepare 8 documents; the Cascade DEQ agency binder **27 pages, 2.96 MB, 9 seconds**. **Three things the walk found that no reading would have:** `/api/document-actions` wants `document_id` and the binder sent `documentId`, so **every** document came back as the missing-file page — honest sentence, wrong cause; a Word document's stored text is **mammoth's HTML**, so the binder printed `</p><h1>7. Non-routine tasks</h1>` to an inspector; and the card's control keyed on the top row, which on staging is a queued run, so it never appeared. `npm run check` exit 0, **2,540 tests**, floor 2513 → 2540. **PENDING F4 is CLOSED** and GATE F4 is off both homepage panels.

**Updated:** 4 November 2026 — **PART E STEP E1a DONE: the report page is board 1's LAYOUT, not only its colours** (commit below). Display only, no model, no stored word. **One named palette** (`WORD_TINT` / `WORD_INK`, the board's own eight hex values) read by the **strip**, the **counts** and the **row pill** — three copies of a colour was three copies that drift. The strip's cells **stretch the full width**; the counts sit **directly under it**, numbers bold in the word's ink, with *"10 lines · 3 sections · 11 documents read"* at the right-hand end, and the **"all" chip is gone** (pressing the one that is on shows them all). **One meta line** under the title, with *"you asked"* in it. Each row is board 1's **four fixed columns** — chevron · a tinted **132px pill** · the reference · the requirement whole · the document, right-aligned — **measured: one distinct column set across all ten rows, at 1280 and again at 700**. The open part is indented 192px, 24px left of the requirement as the board draws it; the suggestions are **one folded grey line** at the foot; the footer is the board's order with **"Download the files"** and *"Every audit is kept…"*. **`print-color-adjust: exact` is the only reason any of it reaches paper** — proved with `printToPDF` and **`printBackground: false`**, which is the printer with background graphics OFF: the pills still came out coloured. **Four display defects found by the same reading:** the read-only note was drawn **twice** on the checklist report and **not at all** on the agency one (commit `10786ee` put both copies in one branch); **"Not right" on the run had nowhere to put the answer** on the checklist report; the footer **broke four of its five actions mid-phrase** in the Calendar's 720px drawer, photographed; and the document column held all 260px while the requirement was squeezed to 149 at a narrow width. `npm run check` exit 0, **2,513 tests**, floor 2487 → 2513. **No model call: $0.0000.**

**Updated:** 4 November 2026 — **PART E STEP E1 DONE: the audit report is a PAGE** (decisions 50 and 55–60). Full width at **`/audits?run=<id>`** — the same address the email, the Dashboard, the report's own links and every bookmark already send, so **nothing was redirected and the 20 October hotfix is untouched**. `AuditReport` is **one body with two wrappers** (`chrome: 'page' | 'drawer'`), so the **Calendar is unchanged** and keeps its drawer by default. **Four tabs** (Ask a question · Conversations · Agency audits · Auditor checklists), with `audits` keeping its key so every old link lands where it did; **By template left the agency tab** and is board 3's card — one card per checklist, a table of its runs in fixed columns, *"since last run"* from `closed_count`, and **"Audit again against this checklist"**, which step 6b left off until the row could say whether the file still exists. It can. **The auditor's line is whole** (decision 58, W9 closed) — it was stored whole all along and the ellipsis was a `truncate` class — in three fixed, left-aligned columns, with a **ten-cell strip** on template runs only. **Three things would have failed silently:** the report inside `.print-page` prints a BLANK SHEET; `visibleDrawer()` read `aside.print-drawer` and the page is a `<section>`, so a print would have carried no company and no type; and **`template_lines` has been declared and never selected since step 6b**, so the line count has been missing from that row since the day it was written. **The agency rows: 0 differing pixels.** `npm run check` exit 0, **2,487 tests**, floor 2461 → 2487. **$0.0046.** Also in this step: `vercel.json`'s `functions.memory` **removed** — Fluid compute is on and Vercel was ignoring it — and `docs/RELEASE.md` now carries the truth, read from the dashboard: **Fluid compute on, Function CPU Standard, 1 vCPU and 2 GB for every function**, with the line that says the photo reading breaks first if that dial is ever lowered.
**Line numbers** are from Claude Code's map of 2 November, read at commit `2801faf`. Re-read before citing.

---

## 1. In one paragraph

CompliBoard should work like a very good employee: it gives you what you ask for. The chat is the door. Every section gets the same chat, with the same power, so a person never has to go to another section to get an answer. Each section's chat carries that section's own context. The shared engine (`lib/ask/`) exists already; Calendar is its only customer. This plan finishes the engine, lifts one shared chat screen out of Calendar's, and gives the chat to Documents first and then to Audits. HR and the Compliance Workspace are not touched: they work, and the Workspace's open answer is the baseline everything is measured against. After the chats come the other gaps: reading every file format, the binder, the Resend domain, Stripe live mode, and the homepage's gate walk. Those parts are added to this file when their turn comes.

---

## 2. The standing instruction for every coding job

The owner's, `docs/CALENDAR-PLAN.md` decision 26. It goes at the top of every instruction in this work:

> Before any change, find every file, query, view, job, test and page that reads or writes what you are about to touch — by searching the repository and reading the live staging schema, never from memory and never from the docs alone — and list them in your plan with what happens to each. After the change, re-run every touched section's free checks and walk one real customer path per touched section on Haiku. A change that breaks a section your plan did not name is a stop, not a fix.

And the rules that go with it: `CLAUDE.md` §3.1 (prompts and what feeds them are the owner's), §3.4a (build on Haiku through `npm run haiku --`; judge on Opus), §3.11, §9.1 and §9a. Production is read-only. Nothing is pushed without the owner's word. No model call in a job unless the brief says so for that job.

**Words on screens.** Every new sentence the product shows in this work is written in simple words and short sentences. Old sentences we touch are made simpler too. The owner reads them before they ship.

---

## 3. The decisions (the owner, 2 November 2026)

Each names its effect on other sections.

1. **Order: Documents first, then Audits.** Documents is the heart: audits read its readings, the binder is its documents behind tabs, the report is its report. *Effect: none.*
2. **HR and the Compliance Workspace are not moved onto the engine in this work.** The Workspace sends the model nothing but the question and the conversation; that is the owner's baseline (`DECISIONS.md` §113, §123) and stays as it is. HR's own engine works and stays. *Effect: none; `app/hr/**`, `app/api/hr/**`, `lib/hrAnswer.ts`, `app/compliance/page.tsx` and `app/api/chat/route.ts` are not edited.*
3. **One engine, each section's own instructions.** The engine does the machinery. Each section's brief says what its answers are written from. Documents' brief packs the documents' readings; Audits' brief packs the audit findings and the readings behind them. *Effect: none outside `lib/ask/`.*
4. **The chat looks the same everywhere.** One shared screen, lifted out of `components/CalendarAsk.tsx` the way the engine was lifted out of HR. Calendar renders the shared screen plus its own date offers. *Effect: Calendar changes files but not behaviour; proof is in step 2.*
5. **Documents' tabs:** Ask a question · Conversations · Documents (N). The Documents tab is today's page with nothing moved. The count is shown like Calendar's; nothing at zero. *Effect: Documents only.*
6. **"Add a document" in every chat uploads in place.** The file goes through Documents' own upload (storage, then `POST /api/documents`, the pattern of `app/audits/page.tsx` `attachChecklist`), lands in Documents unfiled, gets its own reading, and travels with the question. Calendar's "Add a document", a link today, becomes a real upload. **No folder upload in any chat**; folders stay on the Documents tab. *Effect: Calendar (the control changes; a Calendar answer can read an attached file for the first time — a quality change, measured on Opus); Documents' `?return=` loses its only caller and is kept, with a note.*
7. **Nothing on file yet (board 1b).** With no documents, the Ask tab shows one line under the box pointing to the Documents tab for files and folders. The line goes when the company has one document. *Effect: none.*
8. **The action row** in every section's chat: Turn this into a checklist · Summarise this conversation · Download. **A checklist made from any section's conversation lives in the Compliance Workspace's Checklists tab — that is its home.** The conversation's row in its own section links there. *Effect: `components/ConversationList.tsx` gains a link (shared file: HR's and Calendar's free checks re-run). No new tab, no migration.*
9. **Delete on the shared conversation drawer.** HR has it; Calendar does not. The shared drawer has it, so Calendar gains Delete. `DELETE /api/topics/[id]` already exists and is section-blind. *Effect: Calendar gains a control.*
10. **The night summary covers every section.** `app/api/jobs/summarise/route.ts:94` lists `['workspace', 'hr']` and skips Calendar. It gains `calendar` and every new section as it is added. *Effect: Calendar conversations start being summarised at night; that is the owner's yes.*
11. **Each chat is billed and modelled as itself.** New task words `documents` and `audits_chat` (`audit` is taken by the agency audit, `lib/ai.ts:133`). Each section gets its own search cap, `AI_SEARCH_MAX_<SECTION>`, unset meaning no cap, which is today's behaviour. *Effect: `lib/ai.ts`, `lib/costLedger.ts`, one migration restating two CHECKs; Calendar must resolve to the same tier and ledger word as today.*
12. **The attached file is handed in with the request, not written into the brief.** `AskContext` gains `documentId`; `checkBrief`'s five-field rule stays. The engine does for every section what `app/api/chat/route.ts:213–:284` does for the Workspace: load by id as the caller, carry on every later turn, cap at 3, say so when a file could not be re-read. The attachment is named in the context event as a block that is not priced. *Effect: `lib/ask/engine.ts`; `lib/attachedDocument.ts` read, not changed.*
13. **Landing on Documents.** The sidebar and the bare address open Ask a question. A link carrying `?add=`, `?return=` or `?document=` opens the Documents tab (`?document=<id>` with that document's report open). Four bare links gain a word in their own files: `app/audits/page.tsx:694`, `app/compliance/page.tsx:1651`, `lib/dashboardView.ts:185`, and the batch email `lib/documentBatch.ts:193`. *Effect: Audits, Workspace, Dashboard, the batch email — each section's free checks re-run.*
14. **The Documents chat answers from the readings, never the files**, except a file the person attaches. One line per document always; the full report for the documents a question names; the raw extracted text never; what did not fit is said out loud. Measured 2 November on staging: Cascade's 12 readings are 65,573 characters (~26,000 tokens, 22% of the 120,000 budget); at 40 documents full-reports-for-all would be 73%. *Effect: a shared reading packer in `lib/ask/readings.ts`, with Calendar's brief calling it so Calendar's bytes do not move.*
15. **One summarise route body, shared.** Documents' and Audits' summarise routes call a shared helper. HR's, the Workspace's and Calendar's three copies are left alone until F7 moves them. `requireCompany` and `requireAccess` stay written in each route file, because `scripts/check-schema-contracts.js` check 3 reads the route file's text. *Effect: none outside the new routes.*
16. **Drive connection is rev 1.5**, OneDrive first, days after release. For rev 1 the folder menu's grey "Connect your drive" stays as it is and no other section shows it. *Effect: none.*
18. **The action row keeps Calendar's layout** (the owner, 2 November 2026, from step 2's two photographs): the attach slot far
    left, the actions far right, `justify-between`. HR's — all three grouped in the flow — was the alternative and was not chosen.
    *Effect: `components/AskScreen.tsx` only; HR's own screen is untouched and keeps its own row.*
19. **The conversation drawer's Delete words stand as shipped** (the owner, 2 November 2026): *"This removes the questions, the
    answers and the summary. You cannot undo it."* and *"Anything it led to stays: your documents, any checklist made from it, and
    any facts that came out of it."* They are the drawer's own, not HR's, and the second is true of what the foreign keys do.
    *Effect: none; `components/ConversationDrawer.tsx` as built.*
20. **The paused sentence stands as shipped** (the owner, 2 November 2026): *"Your file is saved in Documents. It will be read,
    and you can ask about it, once you add a card."* **And a standing line that must stay true:** a paused company's file is
    stored and never read, because `/api/document-scan` calls `requireAccess` at `:53`. **When Part B's conversion service
    arrives it must not convert or read for a paused company either** — a converter that runs before the gate would spend money
    on a company we have told we are not spending money on. *Effect: Part B's design.*
21. **No size cap on carried files** (the owner, 2 November 2026; `PENDING.md` S7). The measured cost is **~2,376 input tokens a
    turn per file**, every turn, for one eight-page PDF. Re-measure after the folder test (F3), when a real customer's files are
    in front of us. *Effect: none now.*
22. **A quote from an attached file:** (a) the file's extracted text becomes a passage the quote check can match, so a true quote
    is not marked *"we could not find these words in what we have on file"*; (b) a file with no text — a photograph of a page —
    is one the model is told not to quote from, in its own words instead. **(b) is written** (`prompts/documents-answer.ts`
    `DOCUMENTS_NO_TEXT`) and waits for the owner with the rest of the prompt. **(a) is blocked** — see §8.
    *Effect: `lib/ask/engine.ts` and one line of `lib/attachedDocument.ts`.*
23. **The owner's Opus walk passed** (2 November 2026, Step 20 Card Walk, a real DEQ permit): the file was read in the background
    and its five dates were on the calendar by the second question, and the answer said where the file name, the permittee and a
    calculated date did not match. That is the §3.1 before/after for a Calendar answer reading a file. *Effect: none; step 3
    stands.*
24. **The three prompt changes and the index passages are built** (the owner, 2 November 2026, from 4a-test's 36 runs
    and 4a-compare's 3): `DOCUMENTS_GIVEN` ends with the Calendar's quoting clause; `DOCUMENTS_PLAIN_NAME` stops a
    document's title being written as a quote; and an `I` passage carries a plain-text copy of its own fields so a
    quoted title matches and becomes a card. **The normaliser is NOT changed** — HR and the Calendar check quotes
    through it too. *Effect: `prompts/documents-answer.ts` and `lib/ask/documentsBrief.ts` only.*
25. **A Documents chat does not offer in prose** (the owner, 2 November 2026). It offered in 18 of 36 measured runs
    — *"I can draft a short service request"* — and there is no button, so the person says yes to nothing.
    `DOCUMENTS_NO_OFFERS`: *"Do not offer to do things for the person. Say what they could do next."* Thirteen
    sentences in all. *Effect: Documents only; `offers` stays `[]`.*
26. **No size cap on carried files stands** (the owner, 2 November 2026; `PENDING.md` S7 keeps the measured ~2,376
    input tokens a turn). *Effect: none; struck from §7.*
27. **The action row is Calendar's** — settled at step 2 and struck from §7 at 4a-compare. *Effect: none.*

28. **`/compliance?checklist=<id>` is the address a checklist opens at** (the owner, 2 November 2026). It did not
    exist: the Workspace's tab was `useState` and it read only `?ask=` and `?document=`, so a link to a checklist
    had nowhere to land. **Six additive lines** in `app/compliance/page.tsx` read the parameter, switch to the
    Checklists tab, open that checklist and consume the parameter as the other two are consumed. The address
    itself is one string, `lib/checklistView.ts` `checklistHref`, so the two callers cannot drift.
    *Effect: `app/compliance/page.tsx` gains six lines and nothing else; its free checks and a page walk run.*
29. **The conversation row's wrapper is a `<div role="button">`** (the owner, 2 November 2026), because an `<a>`
    may not live inside a `<button>` and the browser swallows its click. `tabIndex={0}`, and Enter and Space both
    open it, Space `preventDefault`ed so it does not scroll instead. *Effect: `components/ConversationList.tsx`,
    which the Workspace, HR, the Calendar and Documents all render — its props did not change, so none of those
    four needed an edit.*
30. **The Queued sentence** (the owner, 2 November 2026, from 4b's walk): *"A file attached to this conversation is
    in the message and you can read it. Its line in the list may still say Queued; that says nothing about whether
    you can read it."* Fourteen sentences. *Effect: Documents only.*

31. **Audits gets THREE tabs, not four** (the owner, 3 November 2026): Ask a question · Conversations · Audits (N).
    Today's "Where you stand" and "Past audits" fold into ONE tab with two groups — **By agency** (today's rows
    exactly as they are: document count, last audit, count to look at, the Audit / Audit again button, the row
    opening to the latest findings, **plus that agency's earlier runs listed under the open row**, so nothing Past
    audits shows today is lost; the unplaced-documents list stays at the bottom of this group) and **By template**
    (one row per checklist audited against, the same shape, Audit again on the row). The hand-rolled two-button row
    (`app/audits/page.tsx:573`–`:587`) becomes `components/Tabs`. *Effect: Audits only. `components/Tabs.tsx` is
    imported, not edited; the Workspace, HR, the Calendar and Documents already render it and its props do not
    change.*
32. **The box leaves the Audits tab; typing happens on the Ask tab** (the owner, 3 November 2026). The Ask box takes
    audit commands AND questions: when the person presses Ask, **CODE looks first** — is this an audit command,
    which agency does it name, is a file attached? A command starts the audit exactly as today's box does (the same
    matching as `submitAsk`, `app/audits/page.tsx:437`–`:465`, no model call). Only a question that is not a command
    reaches the model. **The model never decides to start an audit.** *Effect: Audits' page — AND `components/AskScreen.tsx`,
    which today has no way to look at a sentence before it is sent. See §8; it is a stop.*
33. **The paperclip is the shared attach control with Audits' words** (the owner, 3 November 2026): *"Attach a
    template or checklist from your auditor"*. An attached file is **the template** when the words are an audit
    command, and **context for the answer** when they are a question. *Effect: none on the shared control —
    `attach.label` is already a prop (`components/AskScreen.tsx:175`).*
34. **The three example lines are the owner's** (3 November 2026), for `config/examples.ts`:
    *"Audit us against the attached template"* · *"Audit us against an agency, like Oregon DEQ"* ·
    *"Ask anything about whether you are audit ready"*. *Effect: `config/examples.ts` only.*
35. **The "Or ask a question in the Compliance Workspace" link goes** (the owner, 3 November 2026).
    `app/audits/page.tsx:621` is a bare `href="/compliance"` that carries nothing the person typed. The Audits chat
    answers the question where it was asked, so the link has nothing left to do. **`docs/PENDING.md` F5 and D5 close
    with this step.** *Effect: Audits only.*
36. **HR stays on its own engine for rev 1** (the owner, 3 November 2026). Moving `lib/hrAnswer.ts` onto `lib/ask/`
    is rev 2 work. *Effect: none; `PENDING.md` F7 stays open after this step and §7 carries the line.*

37. **`components/AskScreen.tsx` gains ONE optional prop** (the owner, 3 November 2026), `beforeAsk`, built in 6b
    and not in 6a. Every section that passes nothing behaves exactly as today, and a test holds that three of the
    four sections pass none. *Effect: `components/AskScreen.tsx`, rendered by the Calendar, Documents and (from 6b)
    Audits; all three get their free checks and a page walk.*
38. **The looker requires an audit word** (the owner, 3 November 2026). The word "audit" must be present before any
    agency, "everything" or "attached" matching happens — so *"Do we have all our permits?"* never starts a run,
    and *"Are we ready for DEQ?"* is a question. A command naming no agency gets today's one-click agency choices,
    in code (`app/audits/page.tsx:467`–`:468`). Built in 6b. *Effect: Audits only.*
39. **The command line under the question, and no email promise** (the owner, 3 November 2026). An agency:
    *"Starting the Oregon DEQ audit. It is on the Audits tab."* A template: *"Auditing against <file name> — <n>
    lines in <m> sections. It is on the Audits tab."* **A command creates no conversation row.** The words are in
    `lib/auditsWords.ts` and a test holds that neither line promises an email. *Effect: Audits only.*
40. **An attached template gets a reading like any other uploaded file** (the owner, 3 November 2026):
    `lib/chatUpload.ts` fires `/api/document-scan` and `attachChecklist` never did, so the same file costs one
    extra `document_scan` call. **Pay it** — otherwise a checklist sits in the Documents list saying "Not read yet"
    for ever, which is exactly what the F6 run left on Cascade's. *Effect: one more scan per attached template.*
41. **ONE offer, not none: `run_audit`** (the owner, 3 November 2026). When a question reads like a request to be
    audited, the answer may carry one card — *"Do you want me to run the Oregon DEQ audit?"* or *"Do you want me to
    audit against <file name>?"*. **The model proposes; the press starts the run in code**, with the same check the
    box uses (`lib/audit.ts` `auditAgenciesFor`): an agency the company does not hold is refused in code and never
    trusted from the model. 6a defined it and measured it — **18 blocks in 18 runs, 15 the code would accept, 0
    naming an agency the company does not hold**. 6b wires the press. *Effect: `lib/ask/offers.ts` needs three
    lines, which is a stop — §7.*
42. **The F6 run and its file stay on Cascade** (the owner, 3 November 2026), and 6a's Oregon DEQ agency run stays
    too. *Effect: Cascade holds 13 documents, not 12, and two audits where it had none. The Documents chat's index
    baseline moves 12 → 13; 4a-test's figures predate it.*

43. **`lib/ask/offers.ts` learns `run_audit`** (the owner, 3 November 2026), with the `source_url` check
    deliberately NOT applied to this kind: a run over the company's own documents has no page to verify, and
    demanding a link would drop every valid offer — which is what it did to three of step 6a's eighteen.
    `auditsBrief.offers` names it in the same commit, and the test that failed until both moved is the one that
    made them move together. *Effect: `lib/ask/offers.ts` is shared — the Calendar's `components/CalendarAsk.tsx`
    now filters to `add_date` before drawing, because `Offer` became a union; Calendar's free checks re-run.*
44. **`ATTACHED_PREFIX` becomes `'AF'`** (the owner, 3 November 2026), in `lib/ask/passages.ts`. One character,
    and it closes a collision for every section at once: an auditor's checklist numbers its own lines A1…A5, so
    `replacePassageIds` was rewriting *"line A1"* into the attached file's name. *Effect: the engine, and both
    prompts that name the handle by example (`prompts/documents-answer.ts` and `prompts/audits-answer.ts` now say
    `AF1`). Documents', the Calendar's and HR's free checks re-run; a test holds that a bare `A1` survives an
    answer and `AF1` is still replaced.*
45. **`prompts/audits-answer.ts` is approved as written, all nineteen sentences** (the owner, 3 November 2026),
    with one fix inside it: sentence 18 stops asking for a `document_id` the model is never shown. The block
    carries `attached: true` and no id, and `checkRunAuditOffer` resolves the file from what the page already
    holds for this turn. *Effect: `prompts/audits-answer.ts` and `lib/auditsOffer.ts` only.*

### The owner's decisions after the walk report, 3 November 2026 (commit `77ec7e4`)

46. **B0 now: the reader's missing check and the handed-command busy state** (the owner, 3 November 2026).
    The two things the walk found that cost money while they were open — W2 and W3 in §8 — are done before
    anything else in Part B. *Effect: `lib/documentScan.ts` reaches **every section that holds a document**
    (Documents, Audits, the Calendar, the Workspace, HR's handbooks); `components/AskScreen.tsx` is rendered
    by **the Calendar, Documents and Audits** and by neither HR nor the Workspace. Both re-checked below.*
47. **The audit gains a fifth word for a line that is on file with gaps underneath** (the owner, 3 November
    2026). His words on the screen: **"on file, gaps found"**; the stored value is Claude Code's to propose.
    **Built in E0, "the audit's words", not in B0.** *Effect: the whole map is in §7 — a migration, one
    prompt, `lib/auditRun.ts`'s `WORDS`, seven screens, the checklist's `NEEDS_PERSON`, the email, the
    golden set and three test files. The dashboard and the Calendar's `findingBlock` are untouched.*
48. **A document's status turns to Needs work only on a gap READ FROM THE PAGE** (the owner, 3 November
    2026). A gap the reader inferred and hedged leaves the status alone and shows as a note. A quality rule.
    **Built in E0 with 47.** *Effect: `lib/documentScan.ts`'s status, `document_index_v`'s `display_status`
    (migration 043 and its successors), and every surface that reads it — Documents, Audits, the Workspace,
    the Dashboard, the batch email.*
49. **A template run does not read its own template as evidence** (the owner, 3 November 2026):
    `template_document_id` is left out of `documents_read`, because the attached checklist is the question
    sheet and not the evidence. **Built in E0 with 47 and 48.** *Effect: `lib/audit.ts` `buildAuditInput`,
    which is called by `lib/auditRun.ts` only.*
50. **A template audit is reported row by row in the auditor's own order and numbering** (the owner,
    3 November 2026): one row per checklist line, **never regrouped by agency, word or document**, and a
    line that could not be answered is still a row. The drawer, the print and the binder all keep that
    order. *Effect: E0 and E1 draw it; **Part C packages it**, with the documents behind each row in the
    same order — which is why C now comes after E0 and E1 and not before them.*

### The owner's decision for Part B step B1, 3 November 2026

51. **The product offers only the file types it can read today, and a file it cannot read is told so in
    the reading's own words** (the owner, 3 November 2026) — **which type, and what to do instead, never
    *"Something went wrong at our end"*. The accepted list is ONE constant**; B2 and B3 each add their
    types back to it when their converter lands, so the picker, the reader and the FAQ can never
    disagree. *Effect: `lib/acceptedFiles.ts` is now that constant and the sentences with it, and
    `lib/documentContent.ts` calls it before it opens a byte — so **every** picker (Documents' files and
    folder, the Workspace, HR, the shared paperclip through `lib/chatUpload.ts`) and **all three**
    reading paths (`/api/document-scan`, `/api/document-rescan`, the sweep) say one thing. **Built
    3 November, `a2e56e4`.***

### The owner's decisions for Part B step B2, 3 November 2026

52. **No external conversion service** (the owner, 3 November 2026). `.doc` and `.ppt` stay refused for
    rev 1 with B1's sentence; **B3 is struck** and §5b records the container as rev 2. **The images are
    converted inside Vercel, in the same sweep that reads everything else**, and B2 adds `.heic`/`.heif`,
    `.tif`/`.tiff` and `.bmp` back to `lib/acceptedFiles.ts` — the one constant B1 made. *Effect: it
    overrules `docs/VISION-DOCUMENTS.md`'s *"HEIC (libheif) … cannot run there"*, which was wrong —
    `libheif-js` is libheif compiled to WebAssembly with nothing native to install. That document is
    corrected in B2's commit.*

53. **How, in five parts** (the owner, 3 November 2026, answering B2's map): **`heic-decode`**, raw RGBA
    straight into sharp — not `heic-convert`, which wraps it and then encodes a full-size JPEG in pure
    JavaScript that sharp must decode again (514 ms against 299 ms). **sharp for TIFF**, one image block
    per page, **capped at 20** — the API's own threshold, above which it applies a stricter per-image
    size limit to every image in the request. **`bmp-ts` for BMP**, because sharp cannot read one.
    **One resize rule for every image**: rotate → 2,576 px inside, no enlargement → JPEG q80, with a
    byte belt behind it. **The converted copy stored at `<company>/converted/<documentId>.jpg`**, the
    original never touched, `documents.converted_url` added by one migration. And **option (ii)**:
    refuse above 50 megapixels before decoding, with the fallback sentence, **and** set
    `functions.memory` in `vercel.json` for the two reading routes only. *Effect:
    `lib/imageConvert.ts` (new), `lib/documentContent.ts`, `lib/acceptedFiles.ts`, `vercel.json`,
    migration 092, and every section that takes a file.*

54. **`.zip` and email files are parked for rev 1.5** (the owner, 3 November 2026). When they come,
    each is one click: **a zip opens into the Documents list as its files**; **an email files its
    attachments as documents, with the email's date and sender noted**. Not now. And **B5 is closed
    by B2's map**: every reading path checks access before any conversion, so a paused company
    converts nothing — `app/api/jobs/scan-documents/route.ts:193`–`:194` (`loadBilling` and
    `splitByAccess`, before the claim at `:200` and the download at `:239`),
    `app/api/document-scan/route.ts:53`, `app/api/document-rescan/route.ts:48` and
    `app/api/chat/route.ts:126`, each `requireAccess` before anything. *Effect: B4 is trimmed to the
    six free formats and the password-protected PDF; §5b carries zip and email as rev 1.5.*

### The owner's decisions for Part E step E0, 4 November 2026 — the audit's words

*The boards are `docs/audit-report-boards.html` (draft 2, four boards). Boards 1, 2 and 4 are E0's
words on the page; board 3 is E1's.*

55. **The audit report is a PAGE, full width, not a drawer** (the owner, 4 November 2026). A
    document's reading opens as **the one drawer over it**, with *"Open the file"* at its foot.
    **Never a drawer inside a drawer.** The email's and the Dashboard's `?run=` links land on the
    page. *Effect: E1 builds it; recorded at E0 so the vocabulary and the page are decided together.
    `components/AuditReport.tsx`, `app/audits/page.tsx`, `app/calendar/page.tsx`, `lib/auditNotify.ts`'s
    link.*

56. **The Audits section has four tabs** (the owner, 4 November 2026): *Ask a question · Conversations
    · Agency audits · Auditor checklists*. **"Agency audits" is today's rows untouched.** "Auditor
    checklists" carries the line *"Checklists your auditors gave you, and every audit run against
    them."*: one white card per checklist, inside it a table of its runs (date · on file · gaps found ·
    out of date · not on file · since last run · *Open the report* · *Build the binder* on the latest),
    under it *"Audit again against this checklist"* and *"Open the auditor's file"*. **The binder is
    built from a run on this tab and nowhere else.** *Effect: E1. `app/audits/page.tsx`.*

57. **The binder numbers documents in order of first citation** (the owner, 4 November 2026), one tab
    per document however many rows cite it; rows cite *"Tab n, page p"*. The report page carries the
    **auditor's own title** for the checklist. *Effect: Part C. `lib/auditRun.ts` `sectionDocumentIds`
    is already that list.*

58. **Every row of a template report carries the auditor's line WHOLE** (the owner, 4 November 2026),
    word for word as printed, never truncated — with decision 50. *Effect: E1; and at E0 it is why the
    handle sweep does **not** touch a template finding's `title`, which IS the auditor's line.*

59. **ALIGNMENT, EVERYWHERE** (the owner, 4 November 2026). Status words and action links sit in
    **fixed, left-aligned columns** on every list and report in the app, so they line up down the page
    whatever sits beside them. **A column that drifts is a failure, photographed, not a style note.**
    Applies from E0's screens onward and is checked in every Part E job. *Effect at E0: four columns —
    `app/documents/page.tsx` (was `w-[160px] text-right`), `components/AuditReport.tsx`'s word column
    (was `shrink-0` with no width, so every title's left edge moved with the word beside it),
    `app/audits/page.tsx`'s document status and its Audit/Open actions.*

60. **The words, as the customer sees them** (the owner, 4 November 2026). A line's five: **On file ·
    On file, gaps found · Out of date · Nothing on file · Not a document question.** Suggestions
    (`expected` rows) carry a **sixth label, "Usually held — not seen"**, grey, folded by default,
    **never in the counts or the strip**. A document's status turns **"Needs work" only on a gap read
    from the page**; a document whose gaps are all inferred keeps its normal state (Current, Expiring,
    **Recorded**…) with **"n notes"** beside it, opening to the reader's own hedged words. *Effect:
    the nine files in E0's row, plus `lib/documentStatus.ts` and migration 093.*

61. **THE BINDER IS THE REPORT PAGE PRINTED, AND THE BROWSER MAKES IT** (the owner, 4 November
    2026, after Part C's half-one map). Not a server build and not a stored file: **no `pdf-lib`, no
    font embedding, no migration, no storage ceiling, no claim, no 202, no route.** In the app the
    page already IS the binder — each row links to its document, which opens in the drawer with
    *"Open the file"*. For the copy that leaves the app, **`/audits?run=<id>&binder=1`** lays out the
    cover; the report's rows in the auditor's order, each citing *"Document n, page p"*; then the
    cited documents ONCE each, numbered by first citation (decision 57), behind a header sheet. The
    person prints and saves as PDF. **What it costs, written down:** the original PDFs go in as
    rendered pages, so text inside them is not selectable in the result. **The server-built binder
    is rev 2** (§5b), wanted only if a customer ever needs the originals' own page objects or a
    stored copy. *Effect: Part C — `components/AuditBinder.tsx`, `lib/auditRows.ts`,
    `app/audits/page.tsx`, `components/AuditReport.tsx` (the footer), `components/home/AuditPanel.tsx`
    and `BinderPanel.tsx` (GATE F4 off both), `app/globals.css`. The zip route and its button are
    **deleted**.*

62. **THE SUMMARY REPORT IS FIVE CARDS, AND THE FOLD TURNS THE RIGHT WAY UP** (the owner,
    4 November 2026; `docs/summary-report-boards.html`). Each card has a coloured left edge and a
    tinted header, from the audit report's palette read from one place: *Your situation* grey ·
    *What applies* green · *Still to confirm* **blue** · *Not answered here* and *Sources* pale.
    **⚡ CORRECTED IN PLACE AT E2a, 4 November 2026: this said AMBER, and the colour is BLUE**
    (`#3B6FA6` on `#E6EFF9`, board 2's own `.s-con`). E2 built it amber because the decision said
    so and reported that the board disagreed; the owner corrected the decision rather than the
    board. **Amber means a document falls short** — it is the audit report's word for *on file,
    gaps found* and *out of date* — and a thing the conversation could not settle is not a
    shortfall, it is a question. **And since E2a the card leads somewhere** (the owner's addendum):
    its header line ends with *"Confirm them on Company information →"* and every item carries
    *"Confirm it on Company information →"* under its sentence, to the exact waiting question when
    the item names the key that page keys its questions by, and to the page when it does not.
    **What applies opens first with the FIRST authority open** and the rest folded to *"n things to
    do"*, Open all / Close all on the right; the other three open **folded**, each with its count on
    its header line, and Still to confirm's reads *"n things we could not settle from the
    documents"*. **"Asked and not answered" becomes "Not answered here"**, and every question under
    it carries *"this came up and the conversation did not settle it. Ask it on its own and we will
    answer."* Your situation carries the company facts the conversation gave; an attached file is a
    source like a document. *Effect: E2 — `components/ReportView.tsx` (ONE file, six renderers),
    `lib/summaryWords.ts`, `lib/reportPalette.ts`.*

63. **A SOURCE INSIDE A SUMMARY OPENS IN PLACE** (the owner, 4 November 2026). A **document**
    source swaps the drawer for that document's reading, with *"← Back to the summary"* at the top
    and the summary hidden beneath rather than unmounted, so closing it returns to where the
    person was — the Calendar's drawer-for-a-drawer swap, **never one inside the other**. An
    **audit** source opens the report page. A **web** source opens a new tab, as today. Nobody
    leaves the page. *Effect: E2 — `components/ReportView.tsx` (`onOpenSource`),
    `lib/sourceTitle.ts` (`sourceTarget`), `components/ConversationDrawer.tsx` (forwards it), and
    the four pages that own a reading drawer. **HR does not**, and that is a reason: its summary's
    sources are handbook passages, which have no reading to open.*

64. **THE PRODUCT SAYS IT ONCE, AT THE FOOT** (the owner, 4 November 2026). The audit report page's
    lede and the binder's cover each carried *"None of it is a verdict on whether the company
    complies"*, and the printed footer said *"Prepared with CompliBoard"* a third time. One
    sentence now, on every printed page and at the foot of the page on screen: *"Prepared with
    CompliBoard. Every line points at a document, or says what we do not see. It is not a verdict
    on whether the company complies, and it is not legal advice; check before you act."* **The
    cover and the lede carry nothing in CompliBoard's voice.** *Effect: E2 —
    `lib/printFrame.ts` (`PREPARED_LINE`), `components/AuditReport.tsx`, `components/AuditBinder.tsx`.*

**And the three that were decided at E0's map, on 4 November:** decision 48 lives **in the view**, not
in code, because *"the status the document would otherwise have"* is the six CASE arms underneath the
one being changed and only SQL can compute them (migration 093); **a record falls to Recorded, not
Current**, which is decision 60's own wording and not board 4's drawing; and decision 49 excludes the
template **from everything**, not only from `carries()` — the auditor's own checklist is not evidence
about the company, it is the question.

17. **Reading every file format (`.doc`, `.ppt`, HEIC, TIFF, the honest refusals) is its own part**, after the chats, as `docs/VISION-DOCUMENTS.md` "Where the converting runs" decided. The binder follows it. *Effect: later parts of this file.*

---

## 4. The boards

### `docs/documents-chat-boards.html` — Documents

1 · Ask a question, first visit · 1b · Ask a question, nothing on file yet · 2 · The answer, from the reports · 3 · A file attached, and the question about it · 4 · Conversations · 5 · Documents — today's page, unchanged. The conversation drawer and the delete sheet are HR's boards, not redrawn.

**Three example questions** (`config/examples.ts`, the owner's file; a starting point): "Which of our permits expire in the next 12 months?" · "What's missing from our emergency action plan, and how do we fix it?" · "Show me all our training records."

### `docs/audits-chat-boards.html` — Audits (draft 3, 3 November 2026)

Five boards, in the same frame. 1 · Ask a question, first visit · 2 · "What is our status on everything OSHA?" ·
3 · "I see gaps in three reports. How do I fix them?" · 4 · Audits — the home of every audit · 5 · Conversations.
The sample company is Willamette Vinegar Works and every answer on them is sample text in the product's voice.
The green boxes are decisions (now §3's 31–36); the notes band at the end says what the Audits chat is given, in
order, and is the source for 6a's brief.

**Three example lines** (`config/examples.ts`, the owner's, 3 November): "Audit us against the attached template" ·
"Audit us against an agency, like Oregon DEQ" · "Ask anything about whether you are audit ready".

### `docs/summary-report-boards.html` — the summary report (4 November 2026)

**Two boards, in the same frame, drawn on an Audits conversation's summary.** **1** the summary as
it opens — five cards, *What applies* first with the **first authority open** and the rest folded
to their counts, *Still to confirm* · *Not answered here* · *Sources* folded with theirs; **2** the
same summary with **every card opened**, which is the layout and the spacing reference. Its two
notes carry the owner's questions on the words and the colour. **Its CSS is a mock-up and is never
a source for the product's type or colour — with one exception, named in the brief: the SPACING of
an item and of an authority row, which E2 copied as arithmetic** (`.sr .item` is `8px 0 10px 18px`
and `.sr .auth` is `10px 0 6px`, so item to item is 19px and an authority row to its first item is
15px). **Where the board and decision 62 disagree, the brief won:** the board draws *Still to
confirm* blue and the decision says amber.

### `docs/audit-report-boards.html` — the audit report (draft 2, 4 November 2026)

**The owner's own run drawn as a page.** Four boards, in the Calendar boards' frame: **1** the report
as a full-width page, the Clackamas run with two rows open; **2** a document's reading as **the one
drawer over it**, with *"Open the file"* at its foot; **3** the Auditor checklists tab, one white card
per checklist with a table of its runs; **4** the Documents list with the new notes. **Boards 1, 2 and
4 are E0's words on the page; board 3 is E1's.** Every line is from the Clackamas Blending & Supply
run of 3 November, reworded only where the new vocabulary applies. Its CSS is a mock-up and is never
a source for the product's spacing, type or colour.

**Where the boards and the rows disagree, §8's findings 8 and 9 say so**: a record with only inferred
gaps falls to **Recorded**, not Current (decision 60's own words), and the respirator fit-test
record's one gap is read off the page with a verified quote, so it keeps **Needs work**.

---

## 5. Part A — the shared chat: the steps

| # | Step | What happens | The stop | Status |
|---|---|---|---|---|
| 0 | The map (read-only) | Claude Code read everything and proposed a plan; reported in the terminal, 2 November. This file records what was decided from it. | The owner's decisions (§3). | done 2 Nov |
| 1 | The engine runs each section as itself | `brief.section` picks the tier, the ledger task and the search cap (`lib/ask/engine.ts:157, :161, :164`). `documents` and `audits_chat` added to `AITask` (`lib/ai.ts:27`, kept on one line — the Haiku guard reads that line), `TASK_MODELS`, `LedgerTask`/`LEDGER_TASKS` (`lib/costLedger.ts:22–:49`), `TopicSection` (`lib/topicList.ts:55`). One migration restates `ai_calls_task_check` (085:167–:174) and `topics_section_is_known` (073:473–:475) whole, with the two new words. The night summariser's list gains `calendar`, `documents`, `audits_chat` (`app/api/jobs/summarise/route.ts:94`). `tests/unit/costLedger.test.ts:129–:134` re-pointed at the new migration; `tests/unit/topicList.test.ts:19` widened. The three doc corrections from the map (§8). | The report: `npm run haiku:check` 14 → 16 rows, read off the table; `npm run check`; the migration's verify block; one Calendar answer on the isolated Haiku server with `ai_calls.task = 'calendar'` and the same model as before. | **done 2 Nov** — `29324c5`, `bfdbd67`. The guard went 14 → 16 rows; `npm run check` 2073 tests, 0 failing; 091 applied to staging and both constraints read back from `pg_constraint` with the two new words; one Calendar answer on Haiku wrote `ai_calls` `task=calendar`, `model=claude-haiku-4-5`, `$0.007122`. **One thing could not be done as written:** the staging fixture's trial ended on 28 October, so the HTTP route answers 402 by design (decision 11 working) and the answer was made through `scripts/probe-calendar-answer.mjs`, which runs the same engine as the same signed-in person. Giving a staging fixture access again is a write to staging billing and the owner's call. |
| 2 | The shared chat screen | `components/AskScreen.tsx` lifted out of `components/CalendarAsk.tsx` with a `section`, its endpoints, words, examples, an attach slot, a thinking line and an `afterAnswer` slot. `CalendarAsk.tsx` keeps only the offers. The conversation drawer lifts to `components/ConversationDrawer.tsx` **with Delete** (decision 9). `app/calendar/page.tsx` keeps its frame, four tabs and date drawers. `tests/unit/calendarShell.test.ts:46–:47, :186–:198, :407–:416` and `readOnlyUi.test.ts:115, :128` edited on purpose. HR, the Workspace: not touched. | Two things the owner sees: (a) **the proof Calendar did not change** — the same question before and after, the assembled messages dumped to a file on the isolated server and diffed byte for byte, plus `check_record.context` compared; (b) **screenshots before and after** — first visit, an answer, an offer accepted, Conversations, the drawer — and the owner picks the action row's shape (HR's or Calendar's). | **done 2 Nov** — `b93757c`, `4431ee4`. `components/AskScreen.tsx` and `components/ConversationDrawer.tsx` lifted; `CalendarAsk.tsx` keeps only the offers; the conversation machinery is a hook in AskScreen, so the page's relations go 7 → 6 and the one read that moved is the drawer's own. **No shared piece was edited** (the addendum's rule). **The proof:** the same question twice, before and after, with the model's input dumped — 10 of 11 fields byte-identical, the one difference being the length and hash of turn 1's own prose; both `check_record`s identical field for field; the measured first-visit layout identical to the pixel. `npm run check` 2090 tests. The walk deleted a conversation and staging confirmed the topic and its turns were gone, with a control. All six pages that import a shared piece opened and photographed. **Two tests the brief did not name had to move and were named in the map first:** `stripeReconcile.test.ts:807`–`:820`. |
| 3 | The attached file, and "Add a document" as an upload | `AskContext.documentId` (decision 12). `lib/chatUpload.ts` copies `attachChecklist`'s steps 1–6, sends `from_topic_id` when the conversation exists, starts the reading without waiting for it, and does not upload folders. The screen's attach control becomes the upload; Calendar's `attachHref` gives way to it (`lib/ask/calendarBrief.ts:228–:229`; the comments at `lib/ask/brief.ts:58–:59` and `components/AttachControl.tsx:9–:10` updated in the same commit). `app/api/calendar/answer/route.ts` reads `documentId` off the body. | Three: the paused sentence (a read-only company attaches a file: upload works, the question is refused — the owner's words); **one real question on Opus, before and after**, because a Calendar answer can now read a whole file; and PENDING S7 (no size cap on carried files) is now a three-section item — the owner says whether a cap is owed. Proof: attach, ask, ask again (the file is still in the message), reload and ask a third time, delete the document and the transcript still names it; `ai_calls` input-token delta per turn in the report. | **done 2 Nov** — `4c6652c`, `0c76344`, `dafc786`. The engine carries a file for every section, calling `lib/attachedDocument.ts` rather than a second copy of it; `lib/chatUpload.ts` puts a file in through Documents' own path and asks for the reading without waiting; the Calendar's link is a picker. **Proved on Haiku against the fire-extinguisher fixture:** the answer gave the service date, the next annual date, the six-year date and the unit numbers — all four only in the PDF; a second turn with no file quoted it again; a third after a reload read its table rows. The cap's sentence reached the message AND `check_record`. Deleting the file left the transcript naming it and the next answer saying it could not be read again. **S7's number: ~2,376 input tokens a turn** (8,218 against a 5,842 baseline). **Two defects the proof found and fixed:** `check_record` did not carry the attached-file block, and a reopened conversation lost its paperclip. |
| 4 | Documents gets the chat | Tabs under the lede; the banner, the toolbar, PausedNote, the error line and the table move inside the Documents tab; the report drawer stays outside the tabs. `?tab=` in the address, derived from `?add=`/`?return=`/`?document=` (decision 13), and **`?document=<id>` opens that report** — which also mends the Calendar chat's reading cards and Company information's fact links (§8). `lib/ask/readings.ts` extracted from `calendarBrief.ts:151–:191`, Calendar calling it unchanged. `lib/ask/documentsBrief.ts` (decision 14), `prompts/documents-answer.ts`, `app/api/documents/answer/route.ts`, `app/api/documents/topics/[id]/summarise/route.ts` on the shared body (decision 15), `DOCUMENTS_EXAMPLE_QUESTIONS`, board 1b's line. The four bare links gain `?tab=documents`. `scripts/check-schema-contracts.js:286` `PAID_COUNT` 19 → 21. `scripts/check-live.js` probes. `components/home/DocumentsPanel.tsx:1`'s gate comment retired; PENDING F12 closed; STATUS's Documents row. | Three, in order: the prompt (`prompts/documents-answer.ts`, §3.1 — the owner reads every sentence); the three example questions; then the walk — Documents (ask, open a cited report from its card, upload in the chat), Calendar (one answer; `check_record.context` against step 2's baseline), Company information (the fact link), Audits and the Dashboard (their links land on the right tab). Screenshots of boards 1, 1b, 2, 3. | **4a done 2 Nov** — `7e6742b`, `01feb15`. **4b not started.** |
| 4a | The quote fix, the packer, the brief and the prompt | `lib/ask/readings.ts` extracted from `calendarBrief.ts:151`–`:191`, Calendar calling it with its own block and letter; `lib/ask/documentsBrief.ts` (the index whole, then the reports, never `extracted_text`); `prompts/documents-answer.ts`, eight sentences; `DOCUMENTS_EXAMPLE_QUESTIONS`; `ASK_DUMP_DIR` kept and documented in `docs/HOW-WE-BUILD.md` §3c. **No route, no page, no model call.** | **done 2 Nov** — `7e6742b`, `01feb15`. The Calendar's input proved unmoved: the 8,714-character message hashes to `29c86d97cf0136d7`, the value step 2 recorded. `npm run check` 2,160 tests. Rendered against Cascade's 23 real readings: 2,028 tokens of index, 15,118 of reports, 17,513 of a 120,000 budget. **ONE THING IS BLOCKED:** decision 3a needs `loadAttachedDocument` to return the extracted text it already computes and throws away (`lib/attachedDocument.ts:110`), and that file is on this step's forbidden list. One additive line; the owner's call. |
| 4a-test | The prompt measured, with and without | `prompts/documents-answer.ts` gains the Calendar's three honesty sentences (the ids rule, no rule number from memory, search before you begin) — eight becomes **eleven**. **Decision 22a built:** `lib/attachedDocument.ts` returns the `text` it already computes, `lib/ask/passages.ts` names `A` as the engine's letter, `lib/ask/engine.ts` turns every carried file into an `A` passage and names the files with no text. `scripts/probe-documents-answer.mjs`; `tests/golden/documents/chat/keys.md` and `runs/`. **No route, no page.** | Six keys written from the readings BEFORE any run, then 39 calls on `claude-sonnet-5-5` ($1.14 of a $3.00 budget): each question three times WITH everything and three times WITHOUT, the second being the Workspace's open answer. | **done 2 Nov** — `6a4dae1`, `67d6b45`. **A beats B on five of six**: 4/4, 6/6, 3/3, 2/2, 3/3 against 0/4, 3.7/6, 0/3, 0/3, 0/3, in every one of three runs. **Q6, a question about an attached file, is a tie on the key and a loss on the finding** — B caught the certificate's address disagreeing with the company's in 3 runs of 3, A in 1. **The strongest single result:** every rule number A wrote came out of a document it was given; B wrote one from memory with `searches=0` in 12 of 18 runs. **Decision 22a proved live:** a sentence in the file and in no reading matched `A1`, clean, as source [1]. **Three defects found** (§8), one of which corrects 4a's own sample. |
| 4a-compare | The same question on Opus 5.5 | Question 2 only, variant A only, three runs on `claude-opus-5-5`, everything else identical to `q2-A-1..3` (same fixture, same key, same probe, `DEV_MAX_SEARCHES=2`). **No code change, no prompt change.** | The owner reads the two best answers side by side and judges. | **done 2 Nov** — `54f509c`. **The key does not separate them: 6/6 in all three runs on both models, 0 invented, 0 must-nots.** Opus writes the one paragraph letter the reading verified and marks the rest as unchecked (2 of 3 runs); Sonnet carries the blanket hedge in 3 of 3 but never distinguishes the two. **Sonnet produced the only clickable source in six runs; Opus produced none** — both quote phrases under the six-word floor, so on Opus nothing in the answer can be checked or opened. Neither searched. **$0.0950 against $0.0445 an answer — 2.13× the cost and 1.74× the wall time** ($0.285 of a $1.00 budget). `docs/TEST-AT-FINISH-LINE.md` §"Which model, per tier" holds the table. |
| 4b | The page, the routes, the links, the walk | The tab row and `?tab=`; `?document=` read (closing `PENDING.md` D15); `app/api/documents/answer/route.ts` and the summarise route on a shared body (decision 15); the four bare links; `PAID_COUNT` 19 → 21; `check:live` probes; `components/home/DocumentsPanel.tsx`'s gate comment retired; `PENDING.md` F12 closed. | **The owner's yes on the prompt and the examples first**, then the walk: ask, open a cited report from its card, upload in the chat. | **done 2 Nov** — `7d6662e`, `0319c1a`, `31162e0`. Three tabs, with everything that was on the page inside the Documents tab and **proved unchanged to the pixel**: the table photographed before and after at 1280px is 0 differing pixels once the scrollbar is excluded, the whole body exactly 55px lower. **The letterbox walked live:** a real source card in a real answer, clicked, landed on the Documents tab with that permit's report open. Board 1b, board 3's paperclip and `from_topic_id`, board 4's drawer, the made-up id's one plain line, and the Audits and Dashboard links all walked on Haiku; `npm run check` 2,212 tests; every section's free checks green; all five shared-piece pages measured unmoved. **$0.0406 of Haiku.** **Two things the walk found** (§8), neither a defect in this step's code. **AND THE OWNER WALKED IT HIMSELF ON OPUS on 2 November and it passed** — six `documents` calls on `claude-opus-5-5` in the ledger between 05:17 and 05:37 UTC, plus one `document_scan`: the three example questions, a question about a document not on file, a question with a file attached, a click on a source card, and the Documents tab as before. |
| 5 | "Turn this into a checklist" from any section | The route already works from any section (`app/api/checklists/from-topic/route.ts` never reads the section). The shared action row shows the button; `components/ConversationList.tsx`'s "Checklist n of N done" becomes a link to the Workspace's Checklists tab (decision 8). | The owner clicks it from a Documents conversation and lands on the checklist. HR's and Calendar's free checks (shared file). | **done 2 Nov** — `7849018`. The machinery is the Workspace's, read and copied: the claim before any model call, 202-or-409-building, and the SAME 5-second poll the summary already uses. It lives in `useAskConversations`, not in the screen, so four sections share one rule. **The address did not exist and the owner's yes made it** (decision 28). **Walked on Haiku:** the button, "Checklist being built…", the ready line, and the row's link clicked in the Documents Conversations tab landing on `/compliance` with the Checklists tab active and that checklist open — 11 items, 9 must-dos. The Workspace's own row shows the link too, on real Test Gamma data. **$0.0446**, 4 calls. **One thing the walk found** (§8), in the harness and not the product. |
| 6 | Audits gets the chat | **Mapped read-only on 3 November and split into 6a and 6b below.** The owner's decisions 31–36 replace this row's old four-tab design. | | **mapped 3 Nov** |
| 6-F6 | F6 settled by running it | One template audit, the way the page runs one — storage, `POST /api/documents`, `POST /api/audit-runs { kind: 'template' }` — as `testcascade@example.com` against the isolated Haiku server on 3998, with `tests/golden/audits/fixtures/12-auditor-checklist-deq-air.docx`. No code change. | The rows, read back from staging with the CLI, read-only. | **done 3 Nov.** Run `de251fbf-f838-45d8-a38a-11a8372e2ef6`: **status done, 3 of 3 sections, 16 lines, 16 findings, 0 could-not-complete, 43 seconds**, every section `json_parsed = true` on `claude-haiku-4-5` with 13 documents read and 0 held unread. Summary: 8 on file, 5 nothing on file, 1 out of date, 2 not a document question, 8 needing a person. **Every finding carries its checklist line** (A1–A5, B1–B6, C1–C5). **Four ledger rows, $0.0829** — one `audit` call for the extraction ($0.0054) and one per section. The drawer opens at `/audits?run=<id>` and is titled *"Against 12-auditor-checklist-deq-air.docx"*; Past audits shows *"8 to look at · 3 of 3 sections"*. **So `PENDING.md` F6's "returns 400 with a sentence saying it is not ready" is wrong**, and the attach control is not inert: one click fires `Page.fileChooserOpened`. |
| 6a | The brief, the prompt, the examples and the offer, measured | `lib/ask/auditsBrief.ts` (the five blocks in the owner's order, importing Documents' own packers rather than copying them); `prompts/audits-answer.ts` (nineteen sentences — eleven of Documents' fourteen kept whole, three rewritten, five new); `lib/auditsWords.ts`; `AUDITS_EXAMPLE_QUESTIONS`; the `run_audit` offer and `checkRunAuditOffer`; `scripts/probe-audits-answer.mjs`; `tests/golden/audits/chat/`. **No route, no page, no shared piece edited.** | One Oregon DEQ agency audit on Haiku to give the fixture an agency run, then the keys written from the rows and **committed before the first model call**, then 36 runs on `claude-sonnet-5-5`. | **done 3 Nov** — `fdc83c3`. **A scores 57 of 64; the Documents chat on the same six questions scores 12, and on four of them it cannot score at all.** B opens three runs with *"There is no DEQ audit report on file"* about an audit run that morning; it answers *"No."* to "are we ready"; it goes through an attached checklist line by line itself once; and it is 34 days out on the permit clock in two runs of three, because with no audit to anchor on it counts from the reading date. **A broke no must-not in 18 runs and claimed to have run an audit in none.** The offer: **18 blocks in 18 runs, 15 the code would accept, 0 naming an agency the company does not hold.** **0 quotes found in nothing in 36 runs**, which `runPlain` and `indexPlain` are the reason for. **$1.9810** — A $1.1680, B $0.8131; A costs 1.44× and scores 4.75×. The one measure A loses: 6 source cards to B's 8, though 3 of A's are the first audit-finding cards this product has made. **Two stops** (§7) and five findings (§8). |
| 6-DEQ | The agency run 6a's fixture needed | One Oregon DEQ agency audit through `POST /api/audit-runs { kind: 'agency' }` — the call the Audit button makes — on the isolated Haiku server. No code change. | The rows, read back from staging with the CLI. | **done 3 Nov.** Run `4a6d2fa8-abdf-4a6a-84a7-b82a846987af`: **done, 1 of 1 section, 25 findings, 39 seconds**, `json_parsed = true` on `claude-haiku-4-5`, 5 documents read and 8 held unread. 9 real findings (3 out of date, 6 nothing on file), 7 dates, **9 suggestions**. One ledger row, **$0.0291**. |
| 6b | The page, the looker, the merged tab, the routes, the offer, the walk | Three tabs through `components/Tabs`; the box deleted and the Ask box given its job through `lib/auditsCommand.ts` `readCommand` (decisions 32, 38); the merged Audits tab with **By agency** — every row unmoved, plus *Earlier audits* under an open row — and **By template**; `app/api/audits/answer/route.ts` and `app/api/audits/topics/[id]/summarise/route.ts`; the offer's press; `app/audits/page.tsx:621`'s link removed (decision 35); `PAID_COUNT` 21 → 23; two `check:live` probes; the `GATE F7` mark on `components/home/AuditPanel.tsx`; `PENDING.md` F5, F6 and D5 closed and F7 narrowed; `STATUS.md`'s Audits row rewritten. **Three shared files edited** (decisions 37, 43, 44), each with every section it touches re-checked. | The pixel proof, the free checks of all five sections, and the walk. | **done 3 Nov** — `cca74dc`. **The agency rows did not move: 0 differing pixels** across the whole group (counts line through the four rows and the note) at an offset of −192px, columns 225–1264; the counts line and its two dropdowns moved −233px with **14 differing pixels**, all on the bottom edge of two OS-drawn `<select>`s. The 41px between the two offsets is the new BY AGENCY heading. `npm run check` **2,318 tests**; all five sections' free checks green. **Walked on Haiku, $0.7136, 17 calls:** a typed command started a run with **no `audits_chat` row in the ledger and no topic written**; a question was answered; the offer card appeared and its press started the OSHA run and could not be pressed twice; the attached template started a run AND fired its reading; a finding's source card opened the audit drawer; a checklist made from an Audits conversation landed in the Workspace; every old address landed where it did; a conversation was deleted and the row was gone from the database. **The walk found two defects** (§8), one of them in decision 38's own rule. |

**⚡ PART A IS COMPLETE — 3 November 2026.** Every section's chat is one engine and one screen: HR (its own engine, decision 36), the Compliance Workspace (its own, decision 2), the Calendar, Documents and Audits. A person never has to go to another section to get an answer, which is what §1 set out to do.

**AND THE OWNER WALKED IT HIMSELF, ON OPUS, ON 3 NOVEMBER.** Company *"Step 20 Card Walk"* on staging (`61b26cc0-0d28-411b-b2e4-943189363b08`), eight synthetic documents for a fictional Clackamas Blending & Supply LLC added as a folder, a ten-line auditor checklist attached with the paperclip, *"Audit us against the attached template"* typed into the Ask box, and the report read. **The audit scored 10 of 10 against the owner's own key and caught two errors in the key.** Every model call on `claude-opus-5-5`. Nine things the walk found are W1–W9 below; the facts of each are read from staging's rows and are in §8 (findings) and §7 (questions).

---

## 5a. Parts B to E — the map

Written 3 November 2026, read-only, from `grep` and the live staging schema. Each row's *what exists today* is a fact about the code, by file and line; *touches* is the map, not the work. **The order is the owner's, and it changed on 3 November after the walk** (the addendum): **B0 now** — the two fixes that cost money while they were open — then the rest of **B** (file formats), then **E0 and E1** (the audit's words and the audit report), then **C** (the binder, built once on the finished report), then the rest of **E**, then the finish line. What was Part D has moved to §5b: pre-release work, in a separate chat. **Everything below is unbuilt except B0.**

### Part B — reading every file format (`PENDING.md` D2, a release gate)

`docs/VISION-DOCUMENTS.md` §"File types" (27 September 2026) is the only written design. It specifies: eleven types that read today; a table of nine that should and do not; and **where the converting runs** — `sharp` for TIFF and BMP, `pdf-lib` for large PDFs, password detection, email parsing and zip expansion all inside Vercel, with **HEIC (libheif) and the old or Open Office formats (LibreOffice) in a small stateless container on Railway or Fly** (Gotenberg or a short Node service), the converted copy stored beside the original and the original never altered.

**What exists of that today: nothing.** `package.json` holds `mammoth`, `officeparser` and `xlsx` and no image or office converter — no `sharp`, no `pdf-lib`, no HEIC, no LibreOffice, no service. `grep -rn "sharp\|heic\|tiff\|libreoffice\|gotenberg\|pdf-lib" app lib scripts` returns **one line, and it is the word "sharper" in a comment** (`app/api/account/route.ts:212`).

| # | Step | What exists today, by file and line | Touches | Status |
|---|---|---|---|---|
| B0 | **The two small fixes the walk found** — the reader's missing check and the handed-command busy state (decision 46) | `lib/documentScan.ts` held `kind` and `status` against their lists and sent `doc_date_kind` through unchecked, so a sixth word made the INSERT throw and the whole paid reading was lost; `components/AskScreen.tsx` set `busy` only on an `'ask'` verdict, so a section's look happened with the screen at rest and a second press went through | `lib/documentScan.ts` (Documents, Audits, the Calendar, the Workspace, HR's handbooks); `components/AskScreen.tsx` (the Calendar, Documents, Audits — not HR, not the Workspace, by grep) | **done 3 Nov** — `43b304e`. An unrecognised `doc_date_kind` becomes `unknown`, is said out loud, and the word itself stays in `raw_text`; the screen is busy from the moment it calls `beforeAsk`. **Measured on the harness: a double press was 2 × `POST /api/audit-runs` before and 1 after.** The three real failures were re-read on Haiku and all three landed. `npm run check` 2,336 tests, floor 2328 → 2336 |
| B0a | The map of Parts B to E | The spec is `VISION-DOCUMENTS.md:165`–`:188`; the gap is `PENDING.md` D2 | — | **mapped 3 Nov** — `77ec7e4` |
| B1 | **The honest refusal, before any converter.** The picker stops promising what nothing reads, and a file that cannot be read gets the sentence written for it (decision 51) | `lib/acceptedFiles.ts:14` was `'.pdf,.xlsx,.xls,.csv,.txt,.doc,.docx,.ppt,.pptx,image/*'`, so `.doc`, `.ppt` and (through `image/*`) HEIC, TIFF and BMP were all offered. `lib/documentContent.ts:149` `isWord` claimed `.doc` and `:186`–`:191` handed it to **mammoth with no `try`**; `:150` `isPowerPoint` claimed `.ppt` and `:192`–`:199` handed it to `parseOffice`. Because both branches *claimed* the file, **`describeUnsupported` at `:85` was never reached** | `lib/acceptedFiles.ts`, `lib/documentContent.ts`, `lib/documentScan.ts`, `lib/chatUpload.ts`, and every picker: `app/documents/page.tsx` (files **and folder**), `app/compliance/page.tsx`, `app/hr/HrWorkspace.tsx`, `components/AskScreen.tsx` | **done 3 Nov** — `a2e56e4`. `lib/acceptedFiles.ts` is the one list (**twelve extensions**, read off the reader's own branches) and the one place the sentences live; `parseDocumentToBlocks` calls `refusalFor` as its **first statement**, 40 lines before `modelForTask`. `isWord` claims `.docx` only, `isPowerPoint` `.pptx` only, and `image/*` is gone. mammoth, officeparser and xlsx each have a `try`, and an **accepted** type that will not open gets its own different sentence. The folder path filters before anything is uploaded and says what it dropped, by type. **29 tests**, the first four reading both files and failing on drift; six real fixtures. Walked on Haiku — see §8 |

| B2 | **The images: HEIC, TIFF, BMP** — and one resize rule for every photograph (decisions 52 and 53) | `lib/documentContent.ts:76`–`:79` `IMAGE_TYPES` mapped **five** extensions and none of the three; `:143` `type.startsWith('image/')` passed a HEIC straight to the API, which refuses it. `sharp` was not a declared dependency | `lib/imageConvert.ts` (new), `lib/documentContent.ts`, `lib/acceptedFiles.ts`, `package.json`, `vercel.json`, migration 092, `app/api/document-scan/route.ts`, the golden fixture set | **done 3 Nov** — `96d05ae`. `heic-decode` → raw RGBA → sharp; TIFF one block per page capped at 20; `bmp-ts` for BMP; **rotate → 2,576 px inside → JPEG q80** for every image that fails a cap, and an image already inside them is passed through untouched. **50 MP refused from the header in under half a second**, with its own sentence. `sharp` and the two decoders are declared; `sharp` was already installed by Next. Walked on Haiku: a drum label's HEIC read and the reading named the chemical, the CAS number and both hazard statements; a 3-page TIFF read as three; a **real 48 MP JPEG** read with no rejection; a half-sent HEIC landed `could_not_read` with the fallback sentence. 21 new tests on real files, 9 edited. **The converted copy is stored**, at `<company>/converted/<documentId>.jpg` — two levels, which is what `app/api/account/route.ts`'s walk needs — by `saveScan`, after the status and never failing the reading. Migration 092 applied to staging and read back; *"Open the file"* hands over the copy when there is one. **Proved on staging:** the key landed, the copy is a real JPEG (`ffd8ff`, 230,573 bytes, `image/jpeg`) and **the original is untouched** — still 192,356 bytes with the `heic` brand on it |
| ~~B3~~ | ~~**The old binaries: `.doc` and `.ppt`** — the conversion service, or the refusal~~ **STRUCK 3 November 2026 (decision 52).** The refusal is what shipped, in B1, with a sentence per type. The container on Railway or Fly is **rev 2** and is recorded in §5b | — | — | **struck** — `.doc` and `.ppt` stay refused for rev 1. B2 proved the premise behind B3 was half wrong in any case: HEIC needed no container either |
| B4 | **The six free formats and the password-protected PDF** (decision 54 trimmed it: `.zip` and email are rev 1.5, in §5b) | `officeparser` has been a dependency since the PowerPoint branch and its own refusal names what it reads — *"docx, pptx, xlsx, odt, odp, ods, pdf, rtf, md, html, csv files only"*. Six were unused while `VISION-DOCUMENTS.md` planned converters for them. A locked PDF went to the model **whole and base64'd**: `ok: true`, 1,420 base64 bytes, `text: ''`, while the log said *"No password given"* — **the library already knew and the catch threw it away** | `lib/acceptedFiles.ts`, `lib/documentContent.ts`, `tests/unit/fileTypes.test.ts` (the drift guard), the fixture set | **done 3 Nov** — `b35b78e`. `.odt .ods .odp .rtf .md .html` read as text blocks, **17 → 23 extensions**, the `fileType` hint passed for all six (two of them cannot auto-detect from a buffer, and `pdfText`'s comment records that auto-detection does not survive the server build). `.html` becomes its **text, not its tags** — 1,432 characters of markup → 612 of words. `isExcel` narrowed `spreadsheet` → `spreadsheetml`, because an ODS's media type contains the word. **An empty `.md` or `.html` throws nothing and is a failure anyway.** The locked PDF is refused before the model call, with its own sentence, `ai_call_id = null` — read back from staging. 19 tests; the encrypted fixture is built from the specification and its maker is committed beside it |
| B5 | **A paused company converts nothing** (decision 11) | Already honoured one layer up, and B2's map checked all four paths rather than the one this row named | — | **closed 3 Nov by B2's map, no code needed** (decision 54). Every reading path checks access **before** any conversion: the sweep at `app/api/jobs/scan-documents/route.ts:193`–`:194` (`loadBilling`, `splitByAccess`) before the claim at `:200` and the download at `:239`; `/api/document-scan:53`; `/api/document-rescan:48`; and the paperclip's read through `/api/chat:126` — each `requireAccess` before anything. **And the conversion is 40 lines downstream of all of them**: `parseDocumentToBlocks` is `lib/documentScan.ts:655`, `modelForTask` is `:695`. B1's refusal runs in the browser before an upload, and costs nothing either |

> ### ⚡ PART B IS COMPLETE — 3 November 2026.
>
> **B0** the two fixes the walk found · **B1** the honest refusal · **B2** the images · ~~**B3**~~
> struck (decision 52; the container is rev 2) · **B4** the six free formats and the locked PDF ·
> **B5** closed by B2's map, no code needed. **`PENDING.md` D2 is CLOSED**: the picker, the reader
> and the sentences agree, and every type offered reads. What is left of the file-format work is
> **rev 1.5** (zip and email, §5b R1.5a) and **rev 2** (the `.doc`/`.ppt` container, §5b R2a),
> both the owner's decisions and neither a gate.
>
> **Twenty-three extensions read. Three that do not are refused by name, each with what to do
> instead**, and `shots/b4-walk2-locked-row.png` shows all three stacked — a `.doc`, a half-sent
> HEIC and a password-protected PDF — with not one *"Something went wrong at our end"* among them.

**The zip route's 4.5 MB question, answered by reading it.** `app/api/audit-runs/[id]/documents/route.ts` builds the whole archive in memory and returns it as one response body (`:208`, `new NextResponse(new Uint8Array(zip))`). **There is no size check anywhere in the file.** Vercel's serverless response limit is 4.5 MB, so an audit that read a dozen scanned PDFs returns a download that fails — and it fails as a 500 the person sees as *"We could not build that download just now"* (`components/AuditReport.tsx:657`), which is honest about the failure and silent about the cause. **This is the same wall Part C's binder hits, which is why the binder is stored and not streamed.**

**What a first customer path looked like — a `.doc` dropped in a folder, traced through the code, and CLOSED by B1 on 3 November:** the browser wrote the row (`app/documents/page.tsx:486`–`:490`) with `status: 'uploaded'`; the sweep claimed it and set `reading` (`app/api/jobs/scan-documents/route.ts:236`); `parseDocumentToBlocks` took the `isWord` branch and **mammoth threw**; the `catch` wrote `failedScan('Something went wrong at our end while reading this one.')`. **So the customer was told the product broke, when the truth was that the product cannot read that format and the picker should never have offered it.** Today the browser never uploads it — it says *"1 file skipped: 1 old Word (.doc)"* with the sentence underneath — and a `.doc` that reaches the sweep anyway lands `could_not_read` carrying *"This is the old Word format (.doc), which we cannot read yet. Save it as .docx or PDF and add it again."*, with `model = '(not called)'` and **no cost row**. Both walked and read back from staging; §8.

### Part E, first — the audit's words and the audit report (BEFORE the binder)

**Reordered 3 November 2026 (the owner's addendum): E0 and E1 come BEFORE Part C, so the binder is built once, on the finished report.** Boards first, before any code. The pixel method on every shared piece, and every section that draws the piece walked. The owner's shape for a finding, from W9: **one scannable row** (word pill · line · requirement · document) opening to three labelled parts — *What we found* · *The line we read* · *What to do* — with caveats, handles and *"that is a date, not a finding"* asides in a fourth fold, **Also noted**; and a **ten-cell coloured strip** at the top in place of the counts sentence.

| # | Step | The shared files it touches | The sections that render them, from `grep` | Status |
|---|---|---|---|---|
| E0 | **THE AUDIT'S WORDS** — four things in one job, because they are one vocabulary (decisions 47, 48, 49, 59, 60 and W5) | **(1)** the fifth word **`on_file_gaps`**, *"on file, gaps found"*: migration **094** restates `audit_findings_word_check` whole; `lib/auditRun.ts` `WORDS`, `NEAR_MISS` (+5), `RunSummary`, `summariseRun`, `attention`, `runSummaryLine`; `prompts/audit-agency.ts` (both shapes, the definitions, the tie-break, the JSON schema enum); `prompts/audits-answer.ts` `AUDITS_FOUR_WORDS` → **`AUDITS_FIVE_WORDS`**; `app/audits/page.tsx` (six edits); `components/AuditReport.tsx` (six); `lib/ask/auditsBrief.ts`; `lib/auditNotify.ts`; `app/api/audit-checklist/route.ts` `NEEDS_PERSON` **in** · **(2)** Needs work only on a gap read from the page (48): migration **093** in the VIEW, `inferred_gap_count` appended last, `lib/documentStatus.ts` `notesWord`, the Documents list, the drawer split in two, the chat brief · **(3)** a template run stops reading its own template (49) · **(4)** the handle leak (W5): `nameDocumentHandles`, at save time, on `title`, `locator` and `what_to_do` and never on `quote` | `lib/auditRun.ts`, `lib/audit.ts`, `lib/auditNotify.ts`, `lib/documentStatus.ts`, `lib/ask/auditsBrief.ts`, `lib/ask/documentsBrief.ts`, `prompts/audit-agency.ts`, `prompts/audits-answer.ts`, `components/AuditReport.tsx` (**Audits and the Calendar**), `components/DocumentReport.tsx` (**four sections**), `app/audits/page.tsx`, `app/documents/page.tsx`, `app/api/audit-checklist/route.ts`, `scripts/run-golden-audit.js`, `scripts/measure-audit-words.mjs` (new), two migrations | **done 4 Nov** — the same checklist run on two trees on Haiku: **5 of 10 lines moved from `on_file` to `on_file_gaps`**, `documents_read` **12 → 11**, handles at the person **1 → 0**, *"4 things that need you"* → *"9 things that need you"*. One regression found and reported, not fixed: A1 |
| E0a | **THE THREE SENTENCES E0 FOUND AND DID NOT MAKE** (the owner, 4 November) — the stale tie-break, the practice-question clause, and `cascade-template-12` A5's key | `prompts/audit-agency.ts` **in BOTH shapes**: `auditTemplatePrompt` returns `[ROLE, HONESTY, SHAPE_T]` and never sees `SHAPE`, so every rule about the five words has to be written twice — **E0 did not know that and named a sentence the model had never been shown as the cause of its own defect** · `tests/golden/audits/cases/cascade-template-12.json` A5 · `tests/unit/auditWords.test.ts` counts both copies | `prompts/audit-agency.ts`, one golden case, one test | **done 4 Nov** — **the "out of date" regression is closed** (A1 no longer stale, two runs), `cascade-template-12` **12/17 → 14/17 must**; but A1 lands on `on_file`, not `on_file_gaps`, C1 did not move, and **3 of 6 sections were lost to broken JSON**. §8 has all three |
| E0c | **ONE QUOTE PER FINDING** (the owner, 4 November) — the sentence that answers E0a's broken JSON. **The owner's brief called this E0b; that id was already taken by the boards row below, so it is E0c here and nowhere else.** | `prompts/audit-agency.ts` **in both shapes**, counted by `tests/unit/auditWords.test.ts` | `prompts/audit-agency.ts`, one test | **done 4 Nov** — **0 of 3 sections lost**, from 3 of 6; `json_parsed = true` on all three, read back from `audit_sections`. B2 now carries **one** quote and puts the second operator in `what_to_do` in its own words |
| E0b | The boards for E1 | `docs/audit-report-boards.html`, four boards in the Calendar boards' frame | — | **done 4 Nov** — the owner's, drawn on his own run; committed with E0. §4 records what each board is for |
| E1 | **THE AUDIT REPORT IS A PAGE** (decisions 50, 55–60) — the report full width at `/audits?run=<id>`, the four tabs, the Auditor checklists tab, the print | `components/AuditReport.tsx` — **one body, two wrappers** (`Shell`, `chrome: 'page' \| 'drawer'`); the strip (template runs only); the auditor's line **whole**, in three fixed columns; the open row's **two** labelled parts and **Also noted** · `app/audits/page.tsx` — four tabs, the report in the body **outside `.print-page`**, `ChecklistCards` · `components/Drawer.tsx` — `visibleDrawer()` reads `.print-drawer`, not `aside.print-drawer` · `app/api/audits/index/route.ts` — `template_lines`, declared since 6b and **never selected** | **`app/audits/page.tsx` and `app/calendar/page.tsx`** both render `AuditReport`; the Calendar is **unchanged** and takes the drawer by default | **done 4 Nov** — the agency rows **0 differing pixels**; `npm run check` exit 0, **2,487 tests**, floor 2461 → 2487; walked on Haiku for **$0.0046** |
| E1a | **THE REPORT PAGE IS BOARD 1'S LAYOUT** (the owner, 4 November) — the meta line, the full-width strip, the counts row, the four columns, the pill, the open row's indent, the suggestions line, the footer | `components/AuditReport.tsx` — `WORD_TINT`/`WORD_INK` (one palette, the board's own values), `Strip` full width, `WordFilter` → `Counts` with no "all" chip and the totals on the right, `FindingLine`'s **four fixed columns** and tinted pill, the fold at 192px, the suggestions as a grey line, the footer in the board's order with **"Download the files"** · `app/globals.css` — one new `.print-tint` rule, scoped to one class | **`app/audits/page.tsx` and `app/calendar/page.tsx`** both render `AuditReport`; neither file changed; the Calendar's drawer was **walked** and its footer fixed there | **done 4 Nov** — one distinct column set across all ten rows at 1280 **and** at 700; the tints proved on paper with `printBackground: false`; `npm run check` exit 0, **2,513 tests**, floor 2487 → 2513; **no model call, $0.0000** |

### Part C — the binder (`PENDING.md` F4, a release gate) — AFTER E0 and E1

**Reordered 3 November 2026 (the owner's addendum): the binder is built once, on the finished report, so E0 and E1 come first.** It packages the report in the auditor's own order with the documents behind each row in that same order (decision 50). **Stored, not streamed**, for the reason Part B's last paragraph gives. One PDF: a cover, each cited document as pages behind a tab sheet, the report at the back. It **replaces** the audit drawer's download — one button, not two (`DECISIONS.md` §143).

| # | Step | What exists today, by file and line | Touches | Status |
|---|---|---|---|---|
| C0 | The map | This row | — | **mapped 3 Nov** |
| C1 | **THE BINDER, PRINTED BY THE BROWSER** (decision 61 — the mapped server build is rev 2, §5b) | No binder code existed; the nearest thing was the zip, and `citationOrder` was written three times (the component, the strip's own flatMap, and a hand-copy in the zip route whose comment admitted it) | `lib/auditRows.ts` **(new, pure — the rows, the order, the numbering, the five words, the palette)** · `components/AuditBinder.tsx` **(new)** · `app/globals.css` (two print rules) · `types/pdfjs-dist.d.ts` · `package.json` (`pdfjs-dist` declared; it was in the tree as `officeparser`'s dependency) | **done 4 Nov** — Clackamas **19 pages, 1.36 MB, 9s**; Cascade DEQ **27 pages, 2.96 MB, 9s**. No model call, no server build, no migration |
| C2 | **The link replaces the button** | `components/AuditReport.tsx`'s footer said *"Download the files"*; `downloadDocuments` fetched the zip with `authHeaders()` and saved the blob | `components/AuditReport.tsx` (footer + `onPrintBinder`), `app/audits/page.tsx` (`&binder=1`, the card's control), **`app/api/audit-runs/[id]/documents/route.ts` DELETED** — rendered by **Audits and the Calendar**, so both sections' checks re-ran | **done 4 Nov** — "Print the binder" on the report footer, on the checklist card's **latest finished** run, and in the Calendar's drawer (which navigates, because a binder is a page). §143's one button, not two |
| C3 | **The homepage's gate comes off** | `components/home/AuditPanel.tsx:1` and `BinderPanel.tsx:1` both carried `GATE F4`; `WORDS.card.binder` was *'Download the binder'* | `components/home/AuditPanel.tsx`, `components/home/BinderPanel.tsx`, `docs/PENDING.md` F4 | **done 4 Nov** — both gate comments gone, both cards say **"Print the binder"**, F4 **CLOSED**. The cards stay pictures (spans), as Print and Audit again beside them always have been; two scene-only strings are recorded in §8 for step 12/33 |

### Part E, the rest — the display pass, after the binder

| # | Step | The shared files it touches | The sections that render them, from `grep` | Status |
|---|---|---|---|---|
| E2 | **THE SUMMARY REPORT: five cards, the fold the right way up, and a source that opens in place** (decisions 62–64) | `components/ReportView.tsx` **rewritten** — five cards, the first authority open, the counts on the header lines, board 2's own paddings; `lib/summaryWords.ts` (the renamed card and its line); `lib/reportPalette.ts` **(new — the palette moved out of `lib/auditRows.ts`, three readers now)**; `lib/sourceTitle.ts` `sourceTarget`; `components/ConversationDrawer.tsx` forwards `onOpenSource`; `lib/printFrame.ts` `PREPARED_LINE`; `components/FoldRow.tsx` **deleted** | **six renderers**: `app/compliance/page.tsx`, `app/hr/HrWorkspace.tsx`, `components/ConversationDrawer.tsx` and the three pages that mount it — `app/calendar/page.tsx`, `app/documents/page.tsx`, `app/audits/page.tsx` | **done 4 Nov** — the item and authority paddings are board 2's own, measured in both (`8px 0 10px 18px` / `10px 0 6px`, so 19px and 15px); walked on the Workspace and the Calendar with real summaries; `npm run check` exit 0, **2,566 tests**, floor 2540 → 2566. **No model call: $0.0000** |
| E2a | **THREE FIXES TO E2** (the owner, 4 November) — *Still to confirm* is **blue**, not amber; a **document or audit source is kept** in every section's summary; and the card **leads to Company information** | `lib/reportPalette.ts` (`CARD_CONFIRM`) · `lib/sourceTitle.ts` (`passageKey`, `passageLineOf`, `PASSAGE_SOURCES`) · `lib/summaryReport.ts` (every non-HR summary passes them) · `lib/summaryWords.ts` (`CONFIRM_LINK`, `CONFIRM_ONE`, `confirmHref`) · `components/ReportView.tsx` · `app/company-information/page.tsx` (**`?key=` opens that waiting question**) | the **six** renderers, and **Company information**, which gained its first query parameter | **done 4 Nov** — proved end to end on the isolated server: one Haiku summarise of a real Documents conversation, **$0.005782**, and the summary kept `/documents?document=7d6a4d4f…`; clicking it swapped the drawer for that reading with *← Back to the summary*, and back returned to the summary. `npm run check` exit 0, **2,580 tests**, floor 2566 → 2580 |
| E2b | **SIX FIXES, FROM THE E2b-CHECK** (the owner, 4 November) — the per-item link narrowed; a `key` on a to_confirm item; the checklist's sources; the third address shape; **an attached file is a source because it was attached**; and the as-of line and *Your situation* per section | `components/ReportView.tsx` · `components/WaitingKeys.tsx` **(new)** + `components/AppLayout.tsx` (the keys ride the read the badge already makes) · `prompts/summary-report.ts` (the item's `key`, the company block) · `lib/summaryReport.ts` (`allowedKeys`, `about`, `waiting`, `asOfLine`) · `lib/ask/engine.ts` (the carried files as sources; `SHOWN_THE_COMPANY`; `waitingQuestions`) · `lib/sourceTitle.ts` (`/calendar?date=`) · `lib/checklistConvert.ts` · `lib/summaryWords.ts` (`PLAIN_AS_OF`) · `prompts/documents-answer.ts` (`QUOTE_EXACTLY`, shared by Audits and the Calendar) | the **six** renderers, **Company information**, and **every section's answer and summary** — three prompts and one writer | **done 4 Nov** — measured on Haiku through the guard, **$0.0323 over three calls**: the re-asked answer recorded the permit as a source and **0 refused quotes** (2 and 1 before), and the re-summary fills *Your situation* and carries two keyed items whose links are live. **The summary's own source list is still empty, because this Haiku run cited nothing on any item** — said plainly in §8. `npm run check` exit 0, **2,598 tests**, floor 2580 → 2598 |
| E3 | **The answer body and the source cards** | `components/AnswerBody.tsx`, `lib/ask/passages.ts` | `app/compliance/page.tsx`, `app/hr/HrWorkspace.tsx`, `components/ConversationDrawer.tsx`, `components/AskScreen.tsx` — **and through AskScreen, the Calendar, Documents and Audits**. Seven surfaces in all | not started |
| E4 | **The document report drawer and the Documents page** — W1's progress line included | `components/DocumentReport.tsx`, `app/documents/page.tsx` (the banner `:979`–`:1017`, the controls `:1019`, the row words `lib/documentStatus.ts:86`–`:95`) | `DocumentReport` is rendered by **`app/calendar/page.tsx`, `app/audits/page.tsx`, `app/compliance/page.tsx` and `app/documents/page.tsx`** | not started |
| E5 | ~~The Enter-after-pick notice (W3)~~ **— done at B0, `43b304e`** — and **"Audit again" on a By template row**, which still waits for the row to say whether the template file still exists | `app/audits/page.tsx`'s By template group | Audits only | not started |

**After the rest of E: the finish line.** The Opus 5.5 against Sonnet 5.5 comparison (`docs/TEST-AT-FINISH-LINE.md`), then the gate walk — which is in §5b with the rest of the pre-release work.

---

## 5b. Not in this plan — pre-release, in a separate chat

**Moved out of §5a on 3 November 2026 (the owner's addendum).** These were Part D. None of them is display work and two of them are not engineering at all, so they are done beside this plan rather than inside it, before release. **The S1 correction stands and is the work:** `PENDING.md` says *"all four senders"*; there are **six**, and only two refuse on production, so `SANDBOX_FROM` is not one line to change.

| # | Step | What exists today, by file and line | Touches | Status |
|---|---|---|---|---|
| D0 | The map | This row | — | **mapped 3 Nov** — `77ec7e4` |
| **R1.5a** | **`.zip` and email files (`.eml`, `.msg`)** — parked for rev 1.5 on 3 November (decision 54), taken out of B4 | Nothing reads either. The only zip code in the repository **writes** one (`app/api/audit-runs/[id]/documents/route.ts:35`–`:94`, hand-rolled on `node:zlib` with no dependency). `VISION-DOCUMENTS.md`'s table asks for both | `lib/documentContent.ts`; `app/api/documents/route.ts` (a batch of one becomes a batch of n); `lib/documentBatch.ts`; `lib/acceptedFiles.ts` | **rev 1.5** — and the owner's shape for each: **a zip opens into the Documents list as its files; an email files its attachments as documents, with the email's date and sender noted.** One click each |
| **R2b** | **THE SERVER-BUILT BINDER** — mapped at Part C half one on 4 November 2026 and **not built**, because decision 61 took the browser instead. Wanted only if a customer needs the original PDFs' own page objects inside the file (text selectable, not rendered), or a copy stored for them rather than saved by them | **Nothing.** The map, measured rather than remembered, so rev 2 need not repeat it: **`pdf-lib` 1.17.1**, MIT, pure JS, **3.2 MB** as a bundler takes it (the 19 MB on npm is mostly source maps), **last published 12 May 2022**; it merges existing PDF pages (`copyPages`), places JPEG/PNG, and **attaches an original file** (`attach()`, confirmed in its own `.d.ts`). Its built-in fonts are WinAnsi and **throw** on anything outside it — run here: `WinAnsi cannot encode "→" (0x2192)`, which an SDS quote saying *"≥ 98%"* would hit. **`@pdf-lib/fontkit` embeds the woff2 this repository already ships** (`app/fonts/ibm-plex-sans/…-latin.woff2`), so no new font file; those subsets cover `· – — " " ° µ ± − ² ½ ' é ™` and **not** `→ ≥ ≤ ✓ Ω`, which need a substitution table and a count on the cover. The browser route (`@sparticuz/chromium`, **70 MB unpacked**) was rejected: it cannot merge PDFs, so it needs pdf-lib *as well*. Storage: `<company>/binders/<runId>.pdf`, two levels so account delete's walk removes it; `audit_runs.binder_path`/`binder_built_at`/`binder_started_at`/`binder_error`; a 120-second signed URL; claim → 202 → `after()`, like `lib/topicClaim.ts`. Sizes measured on staging: Clackamas **12 documents, 175 KB**; a realistic 12 with two 40-page scans ≈ **25 MB**, which is inside 2 GB of Fluid compute and **outside** Vercel's 4.5 MB response wall — hence stored, not streamed. **One number to read off the dashboard first:** the bucket's own `file_size_limit` is null, so the project's limit (Supabase's default is 50 MB) governs | a new route, `lib/auditBinder.ts`, one migration, `package.json` | **rev 2, not started** |
| **R2a** | **The conversion service — `.doc`, `.ppt` and the Open Office formats.** Was **B3**; struck from Part B on 3 November (decision 52) and recorded here as **rev 2** | Nothing. `docs/VISION-DOCUMENTS.md` specifies a small stateless container on Railway or Fly (Gotenberg, or a short Node service with LibreOffice). **B2 showed half that document's reasoning was wrong** — HEIC needed no container, because `libheif-js` is WebAssembly and runs in Vercel — but LibreOffice genuinely does not, so `.doc` and `.ppt` are the real remainder. They are refused today, by name, with what to save them as (B1) | a new service outside this repository; `lib/acceptedFiles.ts` (it would add `doc` and `ppt` back to `READABLE_EXTENSIONS` and delete two lines from `REFUSAL_WORDS`, and that is all the app changes); `docs/RELEASE.md`'s variable table | **rev 2** — not rev 1, on the owner's word |
| D1 | **The Resend sending domain** (`PENDING.md` S1). DNS, then one line per sender | **`PENDING.md` S1 says "all four senders". `grep` says SIX**, and only two of them refuse on production: `app/api/jobs/calendar-month/route.ts:203` (**refuses** — `sandboxSenderRefusal` at `:92`) · `app/api/invitations/route.ts:56` and `:149` (**refuses** — `invitationMailBlocked` at `:55`, which `lib/invitationEmail.ts:115` builds on `sandboxSenderRefusal`) · `app/api/feedback/route.ts:11` · `lib/auditNotify.ts:186` · `lib/documentBatch.ts:217` · `lib/handbookCheckNotify.ts:103`. The last four hold a literal `'CompliBoard <onboarding@resend.dev>'` and **send on production today**. The rule itself is `lib/email.ts:183`–`:189`; the one line to change is `SANDBOX_FROM` at `:176`, which only two of the six use | `lib/email.ts`, the six files above, `docs/RELEASE.md`'s variable table, `docs/PENDING.md` S1 (the count), `docs/PUBLIC-PAGES-PLAN.md` steps 31 and 32 | not started — **the owner's DNS, then an hour of code** |
| D2 | **Stripe live mode** (`PENDING.md` F1) | **The owner's hands:** six dashboard steps (product and price, the webhook endpoint and its six events, the portal's default configuration, the secret key, the coupon and its promotion code) — `docs/RELEASE.md`, *"When Stripe live mode is ready"*. **The code's:** nothing, and that is the point. `lib/stripe.ts:65` builds the client from `required('STRIPE_SECRET_KEY')` **inside a function, never at module scope** (the comment at `:10` says why), and the three call sites already answer honestly with no key: `app/api/billing/checkout/route.ts:134`, `app/api/billing/portal/route.ts:57`, `app/api/billing/reconcile/route.ts:92` — *"Card payment is not set up on this server yet."* The four variables are `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_API_VERSION`. `docs/ACCOUNT-MACHINERY.md` is the behaviour it switches on | Vercel's dashboard; `docs/RELEASE.md`; `docs/PENDING.md` F1; `PUBLIC-PAGES-PLAN.md` step 32 (the webhook address moves with the domain) | not started — **a dashboard afternoon, not engineering** |
| D3 | **The two `hello@compliboard.com` prints and the `/contact` form they wait on** | Both still there, re-read 3 November: `lib/signupView.ts:97` — *"Email hello@compliboard.com and we will clear it so you can try again"* — and `components/AppLayout.tsx:464`, a `mailto:` behind the signed-in footer's word **Contact**. The address **does not exist** (`PUBLIC-PAGES-PLAN.md` §7, answered 31 Oct). The public footer's printed copy came off at step 25a; `components/home/Footer.tsx:16` records it. **`app/contact/` does not exist** | `lib/signupView.ts`, `components/AppLayout.tsx`, a new `/contact` route, `docs/PUBLIC-PAGES-PLAN.md` step 30a — **which is blocked on the owner's answer to "where does the form deliver"** (that plan's §7) | not started |
| D4 | **The homepage's Documents sentence, and D1's invented switch keys** | The panel's gate is closed — `components/home/DocumentsPanel.tsx:1` says so — and the sentence left is *"The box on this panel is the marketing page's own and still types nothing; what it promised now exists behind the login."* That is a page decision, not code. **The invented switch keys are not:** `lib/documentScan.ts:1061` writes `switch_key: f.key.slice(0, 120)` into `fact_proposals` **with no check against the switches table**, and `lib/companyContext.ts:368`–`:371` reads those same proposed keys back into the shared context. On production **30 of 30 pending proposals name a key that is not a switch**, 19 distinct invented names (`PENDING.md` D1) | `lib/documentScan.ts`, `lib/companyContext.ts`, `components/CompanyQuestions.tsx`, `components/DashboardQuestions.tsx`, and **three prompts** — which makes the filter a §3.1 quality change and the owner's | not started — **the only open defect that puts fabricated content in front of a customer** |
| D5 | **The gate walk** (`PUBLIC-PAGES-PLAN.md` step 33), last | F6, F7 and chat-over-documents are closed; F4, F1, S1 and D2 are B, C and D above. Every `GATE` comment in `components/home/` is walked against the shipped product | `components/home/*.tsx`, `docs/PUBLIC-PAGES-PLAN.md`, `docs/PENDING.md` | not started |


## 6. What Part A touches outside its own files (the map, step 0)

| Section | Files | Why |
|---|---|---|
| Calendar | `components/CalendarAsk.tsx`, `app/calendar/page.tsx`, `lib/ask/calendarBrief.ts`, `app/api/calendar/answer/route.ts`, `tests/unit/calendarShell.test.ts` | the lift (2), the upload (3), the shared packer (4); behaviour proven unchanged at each |
| Audits | `app/audits/page.tsx:694` | one word on a bare link (4); then its own chat (6) |
| Compliance Workspace | `app/compliance/page.tsx:1651` | one word on a bare link (4). Nothing else |
| Dashboard | `lib/dashboardView.ts:185` | one word on a bare link (4) |
| Company information | `app/company-information/page.tsx:989` | its fact links start working when `?document=` is read (4); no edit |
| The batch email | `lib/documentBatch.ts:193` | one word on the "See them all" link (4); it is an email, so it cannot be fixed by a component |
| HR | none edited | shared files it renders change (`ConversationList.tsx`, `AttachControl.tsx`): its free checks re-run at 2, 3 and 5 |
| Shared | `lib/ai.ts`, `lib/costLedger.ts`, `lib/topicList.ts`, `app/api/jobs/summarise/route.ts`, `components/ConversationList.tsx`, `scripts/check-schema-contracts.js`, `scripts/check-live.js`, `scripts/haiku-names.mjs` (read: the one-line rule), `docs/SCHEMA.md` | as the steps say |

---

## 7. Open, waiting on the owner

### ~~⚡ THE FIRST OPEN QUESTION — the audit's four words hide gaps (W4)~~ — **ANSWERED AND BUILT, 4 November 2026 (E0, decision 47, migration 094)**

**The fifth word is `on_file_gaps`, shown as "On file, gaps found", amber, read second.** The map
below is kept exactly as it was written on 3 November, because it is what the owner decided from —
with two corrections E0 found while building it, marked. Measured on the same checklist run twice on
Haiku: **5 of 10 lines moved from `on_file` to `on_file_gaps`**, and the run's own sentence went from
*"4 things that need you"* to *"9 things that need you"*. §8 carries what else the two runs found.

**The two corrections to this map.** *(a)* It says *"One prompt serves both the agency and the
template run… there is no second audit prompt"* — **wrong**: `prompts/audit-agency.ts:292`
`auditTemplatePrompt` is a second prompt in the same file, with its own word list and its own
partial-answer rule, and THAT rule is what caused W4 (*"ON FILE MEANS A DOCUMENT ANSWERS IT, EVEN IN
PART"*). *(b)* It does not name `AUDIT_TEMPLATE_JSON_SCHEMA`, which carried the four words as a hard
`enum`; a four-word enum beside a five-word prompt is §136's trap waiting for
`AI_AUDIT_STRUCTURED` to be switched on. Both are fixed in E0's commit.


**The owner's walk, 3 November.** Four of the template audit's ten lines came back **`on_file`** while the sentence under them listed gaps. Read from staging, run `8707eea9-6c58-4c98-ab9d-4ec5825642cd`:

| line | word | what the body says |
|---|---|---|
| **B2** forklift certifications | `on_file` | *"It shows only two of them… evaluated within the last three years. Rohan Patel's three-year evaluation was due by 2 February 2026 and is overdue."* |
| **A3** hazard communication | `on_file` | *"Nothing separate on file records a review"* — and the owner's reading: no SDS on file for the blends |
| **B3** respirator fit tests | `on_file` | *"Two things are missing. First, the line also asks for medical evaluations…"* |
| **B4** weekly inspection log | `on_file` | *"The reading found two problems with the log…"* |

**The audit has no word for "on file, with gaps".** `on_file` is defined in the prompt as *"a document is on file and carries a date. It says nothing about whether…"* — so the model is right to use it, and the report is right to show it, and a person scanning the pills reads four greens that are not green. **The owner's proposed fifth word: `on file, gaps found`.**

**Where the word lives — the whole map, read from the live staging schema and `grep`, so the owner can see the size of it before deciding:**

| | |
|---|---|
| **the database** | `audit_findings_word_check` — `CHECK (word = ANY (ARRAY['on_file','stale','nothing_on_file','not_a_document_question']))`, read from `pg_constraint` on staging. Written by `supabase/migrations/058_the_audit_as_rows.sql:177`. A fifth word is a migration that restates the constraint whole. **And `audit_findings_expected_is_expected` (`058:209`) pins an `expected` row to `nothing_on_file`**, so the new word must be decided against that too |
| **the gate in code** | `lib/auditRun.ts:827` `const WORDS = [...]` and `normaliseWord` at `:829` — the one function that decides whether a model's word is kept or thrown away. `NEAR_MISS` at `:826` maps `expiring`/`expired` → `stale` and nothing else |
| **the prompt** | `prompts/audit-agency.ts:95` — *"one of these four and no other"* — and the definitions at `:124`–`:130`. **One prompt serves both the agency and the template run** (`lib/auditRun.ts:407` passes the `'*'` sentinel); there is no second audit prompt |
| **the page** | `app/audits/page.tsx:70`–`:71` (the summary type), `:107`–`:111` (the pills), `:128`–`:131` (the counts sentences), `:147` (the status words), `:197`–`:198` (what counts as needing a person), `:704` (the By-template count) |
| **the report and the print** | `components/AuditReport.tsx:85`–`:86`, `:103`–`:106` (the pills), `:109` `AMBER_WORD`, `:111` `WORD_ORDER`, `:125`–`:126`, `:231`, `:585` (what the checklist filter keeps), `:702`–`:704` (the filter chips) |
| **the chat** | `lib/ask/auditsBrief.ts:135`–`:140` `FINDING_WORD`, `:150`–`:161` the counts line, `:238` the `word=` attribute on every finding block. **The Calendar's `findingBlock` (`lib/ask/calendarBrief.ts:94`) carries no word at all** — it packs the title, the locator, the quote, the basis and the what-to-do — so the Calendar is untouched by a fifth word |
| **the prompt the chat uses** | `prompts/audits-answer.ts` `AUDITS_FOUR_WORDS` — its name is the count |
| **the email** | `lib/auditNotify.ts:32`–`:35` and the counts at `:119`–`:132` |
| **the checklist** | `app/api/audit-checklist/route.ts:22` — `NEEDS_PERSON = new Set(['nothing_on_file','stale','not_a_document_question'])`. **A fifth word must be decided into or out of this set, or "Make a checklist" quietly drops every gap-with-a-document** |
| **the dashboard** | **nothing.** `lib/dashboardView.ts` counts audits done (`:134`) and never reads a word |
| **the golden set** | `scripts/run-golden-audit.js`, `scripts/bakeoff-audit-report.js`, `tests/golden/audits/bakeoff/RESULTS.md` and `tables.md` (20 occurrences between them) |
| **the tests** | `tests/unit/auditsBrief.test.ts` (`:227` holds the four sorted keys, `:229`, `:248`), `tests/unit/documentsBrief.test.ts`, `tests/unit/documentsPage.test.ts` |

**It is a prompt change, a migration, a vocabulary change in seven screens and a decision about what "needs a person" means. It is not Claude Code's.**

### The other two product questions the walk raised

- ~~**W6 — a template run reads its own template, twice.**~~ **HALF ANSWERED AND BUILT, 4 November 2026 (E0, decision 49).** `buildAuditInput` takes `excludeDocumentId` and drops the run's own template out of **both** lists, and `runSection` passes `template_document_id` off the run row. Measured: `documents_read` **12 → 11** on the same checklist, read back from `audit_sections`. **(b) is still open and is rev 2:** the SECOND copy of that checklist is a different `documents` row (`40145b5e-7efa-4aff-9e9f-3e563af04d14`, uploaded with the folder) and nothing in decision 49 touches it, so a run can still remark on a blank checklist. Whether an attached checklist should be filed as a kind audits skip is the owner's, and it waits. *The original note follows.*
- **W6, as written on 3 November —** Proved: all three sections of run `8707eea9` list **both** copies of the checklist in `documents_read` (`511e8bcd`, the paperclip's, and `40145b5e`, the one that came in with the folder), and two of the ten findings say *"D9 and D10 are blank checklist templates: they list these records as expected but contain no records themselves."* **What the code does today, by line:** `lib/auditRun.ts:407` builds a template run with `buildAuditInput(db, companyId, '*')`; `lib/audit.ts:148`–`:150` makes `carries()` return `true` for every row when the label is `'*'`, so every document in `document_index_v` is packed. **`buildAuditInput`'s signature (`lib/audit.ts:122`–`:124`) is never told the `template_document_id`**, so the exclusion cannot be written without a new argument. Two questions, both the owner's: *(a)* should a template run exclude its own `template_document_id` from `documents_read`? *(b)* should an attached checklist be filed as a kind that audits skip — the scan already gives it `status = 'not_judged'` and the title *"…, blank template"*, so the signal exists?
- **W7 — the profile name against the legal name.** **`companies` has no legal-name column.** Read from the live schema: `name`, `about`, `what_you_do`, `naics_code`, `industry`, `state`, `county`, `city` and twenty billing columns — and nothing else that could hold *"Clackamas Blending & Supply LLC"*. The audit gets the name through `buildCompanyContext(db, companyId, { parts: ['company', …] })` at `lib/audit.ts:131`–`:133`. **It is smaller than it looked**: 2 of 10 lines on the first template run, 3 of 10 on the second, 1 of 19 on the agency run — not every line — and the two that do say it are doing the right thing (*"D5 is issued to 'Clackamas Blending & Supply LLC'… while the company profile says Step 20 Card Walk, so confirm how the two are related"*). The question is whether a `legal_name` is owed, or whether this is the test fixture being a test fixture.

### ⚡ TWO LATER PROMPT JOBS, RECORDED AT E1 (the owner, 4 November 2026)

**Both are §3.1 changes to what a prompt asks for, both are small, and both are the difference
between the boards and what the stored fields can give.** E1 built everything else the boards draw;
these two are what it could not, and it says so on the page rather than drawing a heading with
nothing under it.

- **A `what_we_found` field, so the row can carry THREE parts.** Board 1's open row is *What we
  found · The line we read · What to do*. There is no such column: `what_to_do` carries both, and
  the live rows prove it — B2's reads *"The roster is dated 1 October 2026 and lists four
  operators. It shows only two of them… **Have a qualified person evaluate him now.**"* E1 draws
  **two** labelled parts, because two is what the fields are. The job is one more key in both
  shapes of `prompts/audit-agency.ts`, one column on `audit_findings`, and `shapeFindings` /
  `shapeTemplateFindings` writing it. *Effect: `prompts/audit-agency.ts`, one migration,
  `lib/auditRun.ts`, `components/AuditReport.tsx`.*

- **Split the template's title from its issuer line.** Board 1 draws the checklist's title with the
  issuer beneath it — *"Northwest Supplier Assurance Program, revision 2026-03"*. The scan writes
  **one string**: *"Pre-Inspection Audit Checklist for Oregon chemical blending and distribution
  facilities (Northwest Supplier Assurance Program, revision 2026-03), blank template"*. E1 prints
  it whole, which is true. The job is a second field on the document scan — the issuer of a
  checklist, which `document_scans.issuer` already is for other kinds and which the scan prompt
  does not ask for on a blank template. *Effect: `prompts/document-scan.ts`, `lib/documentScan.ts`,
  `components/AuditReport.tsx`.*

**Neither blocks Part C.** The binder packages the report in the auditor's order; a third labelled
part and a split title change what a row prints, not what order the rows are in.

### Rev 2 — not rev 1, recorded so they are not lost

- **HR and the Compliance Workspace onto the shared engine** (`PENDING.md` F7, decision 36).
- **The "we" voice** across every section's words.
- **The drive connection** — rev 1.5, OneDrive first (decision 16).
- **The model-proposed audit from context** — the product noticing that an audit is worth running and offering it, rather than waiting to be asked.

### Everything below is from earlier steps; the struck items are answered.

- ~~**THE DOCUMENTS PROMPT AND THE THREE EXAMPLES**~~ — **answered: the owner read them and said yes, and step 4b
  built the three changes they asked for. THIRTEEN sentences now, and the examples are on the page.** Kept below as
  the record of what was measured. **Eleven** sentences
  in `prompts/documents-answer.ts` since 4a-test (the three the Calendar's real runs paid for were added), quoted
  in full in both reports. **They have now been run**, 39 times on `claude-sonnet-5-5` against Cascade's twelve
  real readings, with and without — and three side-by-side answers are in 4a-test's report for the owner to read
  himself.
- ~~**Decision 3a is blocked on one line**~~ — **the owner said yes, 2 November 2026, and it is built and proved
  live** (4a-test). `loadAttachedDocument` returns the text it already computes; `A` is the engine's letter; a
  sentence that is in the attached file and in no stored reading matched `A1` and came back clean as source [1].
  Nothing else in `lib/attachedDocument.ts` changed.
- ~~**THE THREE PROMPT CHANGES THE RUNS ASK FOR**~~ — **ANSWERED: the owner said YES to all three, 2 November
  2026, and they are built in 4b** (4a-compare changed no code and no prompt). The wording is kept here in full
  because 4b builds from it:
  (1) **`DOCUMENTS_GIVEN` gains the Calendar's quoting clause** — *"and quote the line it was read from when the
  exact words matter"* — because 36 runs produced **one** source and an answer with no source is an answer with
  nothing to click. (2) **`DOCUMENTS_WHICH_ONE` gains a sentence about quotation marks**: name a document in plain
  words or in bold, never inside quotation marks, which are only for words read out of a document. Six of 36 runs
  had a title marked *"we could not find these words in what we have on file"*. (3) **and the code half of the
  same defect** — make an index line quotable, or give the `I` passage a plain-text copy, because today it cannot
  match anything (§8). The wording is in step 4a-test's report.
- **The paused sentence for a chat upload — the owner's yes.** Shipped as: *"Your file is saved in Documents. It will be read, and
  you can ask about it, once you add a card."* It is shown ABOVE the 402, because the file really is saved and a bare refusal would
  read as though it were lost. In `components/AskScreen.tsx`'s `PAUSED_FILE_SAVED`, one place.
- ~~The Audits box board (step 6).~~ — **drawn: `docs/audits-chat-boards.html`, and the owner's six decisions are
  §3's 31–36.**
- **HR stays on its own engine for rev 1** (decision 36). `PENDING.md` F7 — HR, Audits and the Workspace onto
  `lib/ask/` — is **half closed** by this step: Audits moves, HR does not, and the Workspace was never in Part A
  (decision 2). F7 stays open for HR and the Workspace, and its mark goes on `components/home/AuditPanel.tsx:1` at 6b.

~~**The four questions step 6 cannot start without.**~~ — **all four answered by the owner on 3 November and
recorded as decisions 37, 39, 40 and 41.** The hook is a yes; the command's words are his; the extra reading is
paid for; and the chat gets ONE offer rather than none.

### ~~⚡ TWO STOPS 6b CANNOT START WITHOUT~~ — **both answered and both built, 3 November 2026**

**1. ~~`lib/ask/offers.ts` has to learn `run_audit`~~** — **decision 43, built in `cca74dc`.** The three lines
went in with the `source_url` check deliberately not applied to the kind, and `auditsBrief.offers` named it in
the same commit. The test that said *"offers is empty until `lib/ask/offers.ts` learns run_audit"* failed the
moment the shared file changed, which is what made the two move together; it now holds the finished state.
**`Offer` became a union**, which `components/CalendarAsk.tsx` had to narrow — the one consequence nobody
predicted, and it is three characters and a comment.

**2. ~~`ATTACHED_PREFIX` collides with a checklist's A1~~** — **decision 44, built in `cca74dc`.** `'A'` → `'AF'`,
and both prompts that named the handle by example say `AF1` now. A test holds that a bare `A1` in an answer
survives and `AF1` is still replaced.

### Smaller, and 6b's to fix in its own files

- **The offer asks the model for an id it is never given.** All three rejected blocks wrote
  `{"kind":"run_audit","document_id":"I7"}` — a passage handle where a uuid belongs, because the model has no
  uuid. `AUDITS_OFFER_FORMAT` should stop asking for one: the file is the one attached on this turn, so the block
  needs a marker (`"attached": true`) and the code fills in the id it already holds. *It is why key 3's offer point
  scored 0 of 3 while every other question's offer was accepted.*
- **A promise in the prose with no block behind it: 16 of 18 A runs.** `AUDITS_ONE_OFFER` says *"do not describe
  its fields in the prose"* and it is not holding. Less bad than Documents' version — here there IS a button and
  the prose usually matches the block — but worth one more clause.
- **Six source cards in 18 runs**, where B managed eight. The quoting clause was inherited from Documents and has
  not solved the shortage in either section.

---

## 8. Known defects and document drift recorded by the map (2 November)

### ⚡ What Part E step E2b did and found (4 November 2026)

**The E2b-check read one conversation — a Calendar question about an attached air permit whose
every summary item said "No source cited" — and the cause was not any of the three the brief
offered.** The permit says *"Renewal Application Due 60 days prior to expiration"*; the answer
wrote *"due 60 days before expiration"*; `checkQuote` is a containment match and refused the
paraphrase, so no source for the permit was ever recorded. The six fixes follow from that.

**1. The per-item link is narrowed.** It said the same words as the card's own header three or
four times down one card, and every copy went to the same page. It is drawn now only when the item
names a key **and that key is still waiting** — the one case where it says something the header
does not. The keys ride the read `components/AppLayout.tsx` already makes for the sidebar badge, a
context rather than six props (`components/WaitingKeys.tsx`): **no second request.**

**2. A `to_confirm` item can carry a key**, and the prompt is given the list to choose from:
*"Questions already waiting on Company information, with the key that settles each"*. **A key that
is not on that list is dropped by `checkReport`** — inventing one would send a person to the wrong
question, which is worse than sending them to the page. Measured: the re-summary came back with
`air_permit_number` and `permittee_legal_name`, both waiting, and both links are live.

**3. A checklist made from a conversation keeps the same sources a summary keeps.**
`lib/checklistConvert.ts` called `gatherSources(turns)` with no options — recorded at E2a as
untouched, and now one option, the same one.

**4. ⚡ THE THIRD ADDRESS SHAPE.** E2a knew `/documents?document=` and `/audits?run=`. The one
conversation the check examined cited a **calendar date** — `/calendar?date=<uuid>`,
`lib/ask/calendarBrief.ts:141` — which `passageKey` called a web page with no url and dropped. So
the summary of a conversation about dates carried no date. `sourceTarget` knows three shapes now;
the Calendar opens its own date drawer through `openDate`, and the other three sections navigate.

**5. ⚡ AN ATTACHED FILE IS A SOURCE BECAUSE IT WAS ATTACHED — and the walk corrected the first
build.** It read `files.attached`, the file attached on the turn being answered. In this very
conversation the permit was attached on turn 1 and the question that needed it was turn 3, so the
answer that used the permit still recorded nothing: **the same defect one turn later.** It is every
file the turn CARRIES now. Proved: the re-asked answer stored
`passage/the file you attached — Title_V_Air_Quality_Permit.pdf` beside its two calendar passages.
**`checkQuote` is untouched and still strict** — a paraphrase of a permit is exactly what it exists
to refuse.

**6. The as-of line and Your situation, per section.** The Workspace keeps *"Rules and tariffs
change"* — that section researches rules, and its summary has been measured saying so. Documents,
Audits and the Calendar get the plain line. And those three are now shown **the company block their
own answers already receive**, so a summary stops saying *"No details about your business came up
in this conversation"* about a company whose cabinet the product has read. Measured: *Your
situation* came back *"Step 20 Card Walk is a chemical manufacturer… permit ACDP 26-0192-ST…"*
where it had been empty. One sentence was added to the three answer prompts (§3.1, approved):
**quote an attached file character for character**, with the cost of not doing so written into it.

**⚡ WHAT THE MEASURE DID NOT SHOW, AND WHY.** The brief asked that the re-summary carry the permit
*"as a source on every item that used it"*. **It does not.** The turns now carry it — that half is
proved above and unit-tested — but a summary's source list is built from **what the ITEMS cite**
(`checkReport`, B4), and this Haiku run cited nothing on any of its four items. The Opus run of the
same conversation cited one source on one item of nine. **So the plumbing is fixed and the citing
is a model-quality question**, which is where the owner's Opus comparison belongs and not something
a display step can settle. The quote half DID move on Haiku: **0 refused quotes in the new answer,
against 2 and 1 in the two old ones.**

> **⚡ AND EVERY SUMMARY WRITTEN BEFORE `9000250` CARRIES NO DOCUMENT SOURCES.** `gatherSources`
> dropped them when those summaries were written; nothing backfills a stored report. **Re-summarising
> a conversation adds them** — the button a person already has. Said here because a customer looking
> at an old summary and a new one will see two different things and nothing on the screen explains it.

**Three Haiku calls through the guard, $0.0323 in all:** a summarise before item 5 was widened
($0.0084), the re-asked answer ($0.0159, 14,506 in / 277 out), and the re-summary ($0.0080).

### ⚡ What Part E step E2a did and found (4 November 2026)

**The three fixes the owner asked for, and what each turned out to be.**

**1. Still to confirm is BLUE, and the DECISION was corrected, not the board.** E2 drew it amber
because decision 62 said amber, and said out loud that board 2 drew it blue. The owner's reason for
the correction is the one worth keeping: **amber means a document falls short** — it is the audit
report's word for *on file, gaps found* and *out of date* — and a thing the conversation could not
settle is a question, not a shortfall. `#3B6FA6` on `#E6EFF9`. It is the one card whose edge is not
`border-l-current`: board 2's header text there is the ordinary dark grey, and `currentColor` would
have turned the heading blue with it.

**2. ⚡ THE SOURCE THAT COULD NOT ARRIVE NOW ARRIVES — and E2's finding is closed by three lines.**
`gatherSources` dropped every source without a `url`, and a document passage carries its address in
`href` with `url: ''`; only HR passed `keyWithoutUrl`. `PASSAGE_SOURCES` (`lib/sourceTitle.ts`) is
HR's shape with HR's handbook rule swapped for the address rule, and every section that is not HR
passes it. **Keyed by what it points at**, so one document cited three times is one numbered source.
**Proved end to end rather than asserted:** one Haiku summarise of a real Documents conversation on
the isolated server — **$0.005782**, 1,792 in, 798 out — and the stored summary's one source is
`/documents?document=7d6a4d4f-84a5-450d-a26e-9bf47e8edd36`. Clicking it swapped the drawer for that
document's reading with *"← Back to the summary"*, and back returned to the summary.

> **It changes what the model is shown, which is why it was the owner's to decide (§3.1).** The
> summariser's numbered list now carries the company's own documents, exactly as HR's has carried
> handbooks since Step 7, and the plain-text summary gets the same line rule so a document does not
> print as *"3. Title — "* with a dangling dash. **`lib/checklistConvert.ts` still calls
> `gatherSources(turns)` with no options**, so a checklist made from a conversation still drops a
> document passage. That is untouched and recorded here rather than changed on the way past.

**3. Still to confirm leads somewhere — and the per-item link has nothing to key on yet.**
The header line and every item carry the owner's words. Where they GO is matched on the page's own
key and never on words: `lib/confirmationQueue.ts` builds `one:<key>`, `dis:<key>` and a document
group of those same keys, and `/api/to-confirm` settles a KEY — so `?key=` is the only address that
can name one question, and `app/company-information/page.tsx` now reads it, opens the group if the
question is inside one, scrolls to it and marks it. **A key that is not waiting opens the page and
nothing else happens**, which is why the link needs no check before it is followed.

> **But no `to_confirm` item carries a key.** `prompts/summary-report.ts` asks for items of
> `{ name, what_to_do, basis, sources }` and for facts of `{ key, value, quote }`: the key lives on
> a FACT, and nothing joins a fact to an item except its wording — which the brief rightly forbids
> matching on. Read on staging: every stored `to_confirm` item is prose, and the reports carrying
> them have no facts at all. **So every item links to the page today**, `ReportItem.key` is optional
> and unset, and the exact-question link turns on the day `"key"` is added to that one prompt shape
> — a §3.1 decision. Both halves are tested, so the day it is added nothing else has to change.

### ⚡ What Part E step E2 found (4 November 2026) — THE SUMMARY REPORT

**1. ⚡ A DOCUMENT SOURCE CANNOT REACH A SUMMARY TODAY, SO DECISION 63 HAS NOTHING TO ACT ON YET.**
Read off staging, not assumed. A Documents answer's own source is
`{ kind: 'passage', label: 'your document', href: '/documents?document=<id>', url: '' }` — the
address is in **`href`**, and `url` is empty. `lib/summaryReport.ts` `gatherSources` keys a source
by `url` and falls back to `opts.keyWithoutUrl`, **which only `lib/hrSummary.ts` passes**; the
Workspace, the Calendar, Documents and Audits pass nothing, so a source with no `url` is dropped
before the summary is written. Counted on staging: of every stored summary, **0 sources are a
document or an audit** and every one is a web page; of every stored turn, 0 document passages have
survived into a summary. **So the swap is built, tested and unreachable by a customer**, and that
is said here rather than left to be discovered. Making it real is one option passed in three
places — a change to what a summary CONTAINS, not to how it is drawn, which is why E2 did not make
it. `sourceTarget` reads **both** fields already, so the day it changes, nothing else has to.

**2. The page number broke across two lines on the binder's cover.** Decision 64's sentence is
long, and a CSS margin box takes its share of the page width from its neighbours: *"Page 1 of /
24"*. Photographed, then fixed with `white-space: nowrap` on the one box that must stay one line.
**And the sentence itself fits** — it wraps to two lines at the bottom left and is readable, proved
with `printToPDF` on the 24-page binder.

**3. `components/FoldRow.tsx` had one caller, and E2 took it.** The card header and the authority
row each carry their own chevron now. It is deleted rather than left: a shared component with no
caller is a claim nothing checks (§9a), and `docs/HANDOFF-WORKSPACE.md` and
`docs/DASHBOARD-MACHINERY.md` both still name it as a shared piece — recorded here rather than
rewritten, because those files describe what the workspace was handed, not what it is today.

**What E2 deliberately did not do:** it did not change a word the model wrote (the sentences, the
items, the sources and the facts are the summariser's own); it did not touch HR's words, which
still win through `ReportWords`; and it gave HR no in-place swap, because an HR source is a
handbook passage that `HR_SOURCE` draws with no link at all — there is nothing to open.

**Where the board and the brief disagreed, the brief won:** board 2 draws *Still to confirm* in
blue (`#3B6FA6` on `#E6EFF9`) and decision 62 says amber. Amber is what the rest of the product
already means by *something needs a person*, and a fifth colour would be a fifth thing to learn.

**And one thing the boards are a source for, which no board file has been before:** the SPACING.
The brief asked for the gaps to match board 2, so `.sr .item`'s `8px 0 10px 18px` and `.sr .auth`'s
`10px 0 6px` were copied as arithmetic — 19px between two items, 15px between an authority row and
its first item — and both files' computed paddings were measured to prove it. Everything else in
that CSS remains a mock-up and no source for the product's type or colour.

### ⚡ What Part C found (4 November 2026) — THE BINDER, AND THREE THINGS THE WALK CAUGHT

**All three are things no amount of reading the code would have found, and two of them produced a
page that looked deliberate.**

**1. ⚡ EVERY DOCUMENT CAME BACK AS "could not be fetched", AND THE PAGE SAID SO POLITELY.**
The binder posted `{ documentId, action: 'file_url' }`; `app/api/document-actions/route.ts:45`
wants **`document_id`** and refuses anything else with a 400. So the first walk produced a binder
with **eight missing-file pages and "8 files could not be fetched" on the cover** — the sentence
§5.1 asks for, the count honest, and the cause one word in a body. *A failure path that works
perfectly is how a broken happy path hides.* The key is fixed and the comment on the line says why.

**2. ⚡ A WORD DOCUMENT'S STORED TEXT IS HTML, AND THE BINDER PRINTED THE TAGS.**
Photographed: *"…employment plus three years.`</p><h1>`7. Non-routine tasks and
contractors`</h1><p>`Before a non-routine task…"*. `lib/documentContent.ts:421` reads a `.docx`
with **`mammoth.convertToHtml`**, and that HTML is what `document_scans.extracted_text` holds —
confirmed on staging, where the Emergency Action Plan's text begins `<p>Emergency Action Plan and
Hazardous Waste Contingency Plan</p>`. **The reading was not changed**: what the extractor stores
is what the MODEL is shown, and that is a §3.1 decision with a golden set behind it. The binder
converts it (`plainTextOf` in `lib/auditRows.ts`) and **never renders it** — `dangerouslySetInnerHTML`
would put a customer's own markup into the page. One consequence, said plainly: **a table in a Word
document prints as its cells, one per line**, because what is stored is a table in HTML and the
binder flattens it. The original is on file, and the header sheet says the page is a text rendering.

**3. The card's binder control never appeared.** It keyed on the top row (`i === 0`), and the top
row of the Clackamas card on staging is a run that is **queued** — `b8d09885`, which no cron will
ever finish on an isolated server. A binder can only be made of an audit that finished, so the
control is on the newest **finished** run.

**What Part C deliberately did NOT do:** it did not change what a reading extracts (above); it did
not add a server build, a migration or a stored file (decision 61, with the measured map parked as
rev 2 in §5b); and it did not make the homepage's cards live — they are pictures of the product and
their three actions stay spans. **Two strings on `components/home/BinderPanel.tsx` are still the
scene's and not the product's**, recorded here rather than quietly changed: the typed line asks for
a binder in the chat (*"Build the binder for the Northwest Grocers supplier audit"*) and the product
builds one from a **button**; and *"PDF · 96 pages"* is a sample count. Both are words for step
12/33.

**And one thing the zip took with it.** `app/api/audit-runs/[id]/documents/route.ts` is deleted, so
the third copy of the citation-order rule is gone — the comment in it said *"computed the same way
`citationOrder` does in the drawer"*, which is the definition of a copy that will drift. The rule
lives once, in `lib/auditRows.ts`, and the report, the strip and the binder all read it.

### ⚡ What Part E step E1a found (4 November 2026) — THE LAYOUT, AND FOUR THINGS IN IT

**E1a is display only: no prompt, no stored word, no model call — $0.0000.** It put board 1's
layout on the page E1 made. Four of its findings are defects that were already shipped, and one is
a rule without which none of the colour reaches paper.

**1. ⚡ THE READ-ONLY NOTE WAS DRAWN TWICE ON ONE REPORT AND NOT AT ALL ON THE OTHER.**
`components/AuditReport.tsx` carried `<PausedNote banner={paused} />` on two consecutive lines, and
**both copies were inside the checklist branch**. `git log -S` puts it at commit `10786ee` — the
read-only step itself. On a paying account it is invisible (`PausedNote` returns null without a
banner), which is why nobody saw it; on a paused one the checklist report showed the panel twice
and **the agency report showed it not at all**, beside a disabled "Audit again" with nothing saying
why. One per branch now, and `tests/unit/auditPage.test.ts` counts them.
*Found by reading the file for the layout work, not by a test: `tests/unit/readOnlyUi.test.ts`
asserts the component CONTAINS the note, which both a double and a missing one satisfy.*

**2. "Not right" on the run had nowhere to put its answer on the checklist report.** The footer
button sets `reasonFor` to `'run'` on both reports and only the agency branch rendered the box, so
on a checklist report the press did nothing a person could see (`CLAUDE.md` §5 — never silent).

**3. The footer broke four of its five actions mid-phrase in the Calendar's 720px drawer.**
Photographed: *"Audit / again"*, *"Make a / checklist"*, *"Download the / files"*, *"Not / right"*.
Board 1's footer is `white-space: nowrap` across an 852px page; this report is also a drawer. The
five actions never break now, and the board's closing sentence — the one thing that is commentary —
is drawn on the page only.

**4. The document column held all 260px while the requirement was squeezed to 149.** `shrink` does
nothing when the row never overflows: the requirement is `flex-1 min-w-0`, so it gives up its own
width first. Measured at a 661px row. The column is capped at **28% of the row** now, which is a
share and not a width, so every row in one report still lands on one edge.

**5. ⚡ WITHOUT ONE CSS RULE, THE PICTURE DOES NOT REACH PAPER.** A browser drops background
colours when it prints. The strip and the five word pills ARE backgrounds, so a printed report —
the copy that goes to an inspector — would have carried ten identical white capsules.
`app/globals.css` gains `.print-tint { -webkit-print-color-adjust: exact; print-color-adjust:
exact; }`, scoped to that one class. **And a screenshot with the media emulated proves nothing
here:** Chrome paints backgrounds in emulated print media either way. The honest instrument is
`Page.printToPDF` with **`printBackground: false`** — the printer with "Background graphics" off —
and the pills came out coloured (`shots/e1a-print-no-backgrounds.pdf`).

**What the walk could not reach, said rather than implied:** no template run on staging carries a
`kind = 'expected'` row — all 182 of them belong to agency runs — so **the new folded grey
suggestions line on the checklist report was not walked**; it is held by its test and by board 1.
The same is true of a checklist line with **no answer at all**: every line of every template run on
staging has a word, so the dashed outline cell in the strip is drawn by no photograph here.

**Where the brief and board 1 disagree, and the brief won:** the board's counts are plain dark text
(`.counts b { color: var(--ink) }`); the brief says the palette is used by "the strip, the counts
and the row pills", so the COUNT takes the word's ink and the words after it stay muted — which is
how **board 3** draws the same five numbers on a checklist card. And board 1's meta line starts with
the issuer and revision, which **is not a field**: `document_index_v` has no issuer or revision
column and the scan writes one string, so the line starts at "audited" and the issuer stays inside
the title. That split is §7's later prompt job, recorded at E1 and unchanged.

### ⚡ What Part E step E1 found (4 November 2026) — THE REPORT IS A PAGE

**The owner's words for what E1 is: *the audit is a killer feature and the report is lost in a
jungle of words*.** It changed how a finished audit is SHOWN and nothing about how it is made — no
prompt, no stored word, and one model call in the whole step, the extraction the walk's *"Audit
again against this checklist"* paid for. **$0.0046.**

**1. ⚡ THE REPORT WOULD HAVE PRINTED A BLANK SHEET, AND NOTHING ON SCREEN WOULD HAVE SHOWN IT.**
`app/globals.css:138` is `body.printing-drawer .print-page { display: none !important }`, and
`display: none` on an ancestor cannot be undone by a descendant. The report is a page now, and the
obvious place to render it is inside the page's own container — which is inside `.print-page`. It
is a **sibling** of that container instead, and `tests/unit/auditPage.test.ts` asserts both the
sibling relationship **and the CSS rule itself**, so the day somebody tidies it back inside, the
suite says why they cannot.

**2. A print from the page would have carried no company and no document type.** `visibleDrawer()`
(`components/Drawer.tsx:37`) read **`aside.print-drawer`**, and the page renders as a `<section>`.
The running header of a printed compliance page would have been empty on both sides. One selector;
the ordering rule is unchanged and still right.

**3. ⚡ `template_lines` HAS BEEN DECLARED AND NEVER SELECTED SINCE STEP 6b.**
`app/audits/page.tsx:83` has carried it with the comment *"the checklist's own sections and lines,
for the By template row's '16 lines in 3 sections'"* — and
`app/api/audits/index/route.ts`'s select never named the column. **That row has always said just
"3 sections".** A select list is a string, which is the whole reason
`scripts/check-schema-contracts.js` exists; what it cannot catch is a column a caller WANTS and the
query never asks for. Board 3's card needed it and found it missing: the card now reads
**"10 lines in 3 sections"**, photographed.

**4. The auditor's line was being truncated by us alone.** Decision 58 says it is carried whole, and
it is **stored** whole — `template_text` and `title` are identical on all 148 template findings,
longest **235** characters against caps of 1000 and 2000, none at the cap. The ellipsis was a
`truncate` class. W9 is closed. The row underneath it, *"the full title, because the line above is
truncated"*, printed **the same string a second time** and is gone with it.

**5. A wrapped requirement started 37px to the LEFT of its own first line.** The reference was an
`inline-block` inside the requirement, so the second line wrapped to the REFERENCE's left edge.
Photographed, then made three cells — word · reference · requirement — all fixed and left-aligned
(decision 59). A `<button>` is `text-align: center` by default, which centred the second line of a
long document title **on the print**; that is one `text-left`, also photographed before and after.

**6. The pixel method: the agency rows did not move. 0 differing pixels**, x 300–1200 and y 300–600
at 1280 wide, with the scrollbar present in both shots. The first comparison said 22,821, and the
cause is worth writing down: the Agency audits tab is **shorter** now that By template has left it,
so the page stopped scrolling and the centred container moved 7px right — every glyph re-rasterised
at a half-pixel offset. **A pixel diff between a page that scrolls and one that does not is not a
layout comparison.** Re-shot with both scrolling, it is zero.

**7. What the boards ask for that the data cannot give, said on the page rather than drawn.** Board
1's open row has three labelled parts; `what_to_do` carries two of them, so E1 draws **two**. Board
1's title has an issuer line; the scan writes **one string**, so E1 prints it whole. Both are
recorded in §7 as later prompt jobs, with what each would cost. And **Also noted** carries only the
four things that ARE columns — `basis = 'inferred'`, an unverified quote, a handle that matched no
document, and a date that is not a finding — because the *"proposed, not confirmed"* asides board 1
shows are **prose inside `what_to_do`**, measured on the live rows.

**8. No binder control anywhere, hidden rather than greyed** (the owner's call). The precedent is
the Calendar's own rule, pinned in `tests/unit/calendarView.test.ts`: *"a date with no report HIDES
the tab rather than disabling it… a greyed tab promises something."* A test asserts the words
*"Build the binder"* appear nowhere until Part C writes them.

**9. The 6b leftover is answered: "Audit again against this checklist" is on the card.** Step 6b
left it off and said why — *"a button that fails with 'That file was not found' is worse than no
button. It waits for the row to say whether the file is still there."* **The row can say**:
`/api/audits/index` returns `documents` as the whole unfiltered `document_index_v`, so a
`template_document_id` missing from it is a file that is gone, and the card says so in words
instead of drawing a control. **No row on staging exercises that branch** — every template run's
file is still on file — so it is held by a test that reads the source and not by the walk, and that
is said here rather than implied.

**10. One thing the walk left behind.** *"Audit again against this checklist"* created run
`b8d09885-3a1a-4199-8fc3-600cdbd6e32d`, which is **queued and will stay queued**: its sections are
run by the five-minute cron, and nothing picks them up on an isolated server. The card shows it as
*"Running…"*, which is true. Every audit is kept, so it is not deleted.

### ⚡ What Part E step E0c found (4 November 2026) — ONE QUOTE PER FINDING, AND THE JSON HOLDS

The owner's one sentence, in both shapes, counted by the test:

> *"One quote per finding. If two things in the document fall short, quote the one the word rests on
> and put the other in what_to_do, in your own words — never two quotes joined inside the quote
> field."*

**One run of the Clackamas checklist on Haiku through the guard: 0 of 3 sections lost, from 3 of 6
across E0a's two runs.** Read back from `audit_sections`, not taken from the exit code: all three
`status = 'done'`, all three **`json_parsed = true`**, and the regular expression that found every
earlier failure — a closing quote followed by a bare word inside the `quote` field — **matches
nothing on any of the three**. Ten lines, `documents_read [11,11,11]`, handles at the person 0.

**And B2 — the line every failure happened on — does exactly what the sentence asked.** It is the
fifth word's own two-shortfall case: two of four forklift operators are past their evaluation date.

| | |
|---|---|
| **word** | `on_file_gaps` |
| **quote** | *"Rohan Patel's last evaluation was 2 February 2023. The three-year evaluation was due by 2 February 2026"* — **one quote, the one the word rests on** |
| **what_to_do** | *"Evaluate Rohan Patel **and Marcus Reed** on their authorized truck types (Rohan Patel on sit-down LP counterbalance; Marcus Reed on both sit-down LP counterbalance and walkie pallet jack); record separate evaluations for each truck type; update the roster with evaluation dates and do not permit operation without current evaluations."* — **the second operator, in the model's own words** |

Nothing was lost by quoting once: both operators are named, the action is more specific than
either earlier run's, and the object parses.

**What this does NOT settle.** One run is one run. The failure was 3 of 6 and is now 0 of 3, which
is the right direction and not a proof; the finish line counts it on Opus as question 2b
(`docs/TEST-AT-FINISH-LINE.md`). And the two words that moved on this run — B1 `stale` →
`on_file_gaps`, B4 `on_file_gaps` → `on_file` — are one run each side and are **not** attributed to
a sentence about quotes.

**E0c spent $0.0824 over 4 Haiku calls.**

### ⚡ What Part E step E0a found (4 November 2026) — THE THREE SENTENCES, AND WHAT THEY DID

The owner approved the three changes E0 found and did not make. All three are in. **Two of the three
did what they were for, one did not, and the run that measured them found something worse than any
of them.**

**1. ⚡ E0's OWN DIAGNOSIS WAS WRONG, AND THE FILE NOW SAYS WHY IT WILL NOT HAPPEN AGAIN.**
`auditTemplatePrompt` returns **`[ROLE, HONESTY, SHAPE_T]`** — it never includes `SHAPE`. So a
template run has never seen the word definitions, the tie-break or the handle rule written in
`SHAPE`. E0 put *"WHEN BOTH FIT, OUT OF DATE WINS"* in `SHAPE` and then named it, in this section, as
the likely cause of a **template** line calling a 2028 permit *"out of date"* — **a sentence the model
that wrote that line had never been shown.** The real cause was `SHAPE_T`'s own clause, *"A line
whose document is old enough that an inspector will ask is stale"*, with nothing beside it to say
what *old enough* means. Both shapes now carry both of the owner's sentences, a comment at
`prompts/audit-agency.ts:303`–`:317` says the two are separate strings, and
`tests/unit/auditWords.test.ts` **counts the occurrences** so the next rule cannot land in one place.

**2. The "out of date" regression is closed. A1 is not where the owner expected it.** Two runs on this
tree, both Haiku through the guard: **A1 comes back `on_file`**, document unchanged (the ACDP), with
**`what_to_do: null`** — the model saying in its own fields that nothing falls short. It is no longer
`stale`, which was the defect. The owner's criterion was `on_file_gaps`, and this is not that: the
line reads *"…on site, not expired, **with the renewal application due date noted**"*, and the model
is treating the printed expiry as noting it. **Whether that clause is being under-read is a question
about the line, not about the word, and it is the owner's.**

**3. Sentence (2) moved two practice lines of three, and not the one it was written for.**
`cascade-template-12`, one run in sections mode, against the same case's run of an hour earlier:

| line | before the sentences | after | the key wants |
|---|---|---|---|
| **A5** | `on_file_gaps` ✗ | `on_file_gaps` **✓** | *(key widened — change 3)* |
| **C2** | `nothing_on_file` ✗ | **✓** | `not_a_document_question` |
| **C3** | `nothing_on_file` ✗ | **✓** | `not_a_document_question` |
| **C1** | `on_file_gaps` ✗ | `on_file_gaps` **✗** | `not_a_document_question` |
| **C4** | `nothing_on_file` ✗ | `on_file` **✗** | `stale` or `not_a_document_question` |
| **B3** | ✓ | `on_file_gaps` **✗** | `nothing_on_file` or `stale` |

**12/17 → 14/17 must** (15/20 → 17/20 with the must-nots). **C1 is the line the sentence names** —
*"pressure drop within range **at the time of inspection**"* — and it did not move. B3 moved the other
way. One Haiku run each side, so B3 and C4 are inside the noise of this set; **C1 failing twice in a
row is not.**

**4. ⚡ AND THE THING NEITHER OF US WAS LOOKING FOR: 3 OF 6 SECTIONS WERE LOST TO BROKEN JSON.** Both
E0a runs of the Clackamas checklist lost a section, and the first lost two, where E0's three runs lost
none in nine. Every failure is the same shape, on the same line, read out of `audit_sections.raw_text`:

```
"quote": "Rohan Patel's last evaluation was 2 February 2023" and "Marcus Reed was certified and
last evaluated on 19 September 2023",
```

**Two quotes joined with `and` inside one JSON string field.** The model has two shortfalls to show on
B2 — the fifth word's own case — and splices both into `quote`, which ends the string early and
breaks the object. `extractJsonText` cannot recover it, the section is written
`could_not_complete` with the owner's sentence, and the answer is kept.

**What the product does about it today is honest and expensive:** the row says *"The audit came back
in a shape we could not read"* and the page offers to run that part again — so nobody is told a
wrong thing, and a section of a paid run is thrown away. **It is not fixed here:** a repair inside
`extractJsonText`, or a prompt line about one quote per line, are both §3.1 and neither is in the
owner's three sentences. **Whether this is E0a's doing or the fifth word's is not settled by six
sections**; what is settled is the shape, the line and the field. **⚠ ANSWERED AT E0c, the same
day**: the owner's one sentence — *"One quote per finding…"* — took it to **0 of 3 sections lost**,
with `json_parsed = true` read back on all three.

**E0a spent $0.2846 over 12 Haiku calls.**

### ⚡ What Part E step E0 found (4 November 2026) — THE AUDIT HAS FIVE WORDS

**The measurement, and it is the whole of E0 in one table.** The owner's own checklist, his own
documents, run once on the commit before the change and once on this tree, both on Haiku through the
guard, by `scripts/measure-audit-words.mjs` — the same harness file on both sides, each tree's own
`lib/` and `prompts/`. Run `19815fc9` (before) and `a7c049db` (after), read back from
`audit_findings`:

| line | BEFORE | AFTER | the document |
|---|---|---|---|
| A1 | `on_file` | **`stale`** | same |
| A2 | `on_file` | `on_file` | same |
| **A3** | `on_file` | **`on_file_gaps`** | same |
| A4 | `stale` | **`on_file_gaps`** | same |
| B1 | `stale` | `stale` | same |
| **B2** | `on_file` | **`on_file_gaps`** | same |
| **B3** | `on_file` | **`on_file_gaps`** | same |
| **B4** | `on_file` | **`on_file_gaps`** | same |
| C1 | `nothing_on_file` | `nothing_on_file` | — |
| C2 | `nothing_on_file` | `nothing_on_file` | — |

**A3, B2, B3 and B4 are exactly the four lines W4 named**, found again by a different model on a
different day. Every line kept the document it rested on. The run's own sentence went from
*"Your compliance audit across 3 agencies found **4 things that need you**"* to *"found **9 things
that need you**: 2 things with nothing on file, 5 things on file with gaps found, and 2 things out
of date."* **`documents_read` 12 → 11** (decision 49), and **handles at the person 1 → 0** (W5).
`npm run check` exit 0, **2,460 tests**, floor 2414 → 2460. **E0 spent $0.9710 over 30 Haiku calls.**

**1. ⚡ A1: A PERMIT THAT EXPIRES IN 2028 IS NOW CALLED "OUT OF DATE". Found, measured twice, NOT
fixed — it needs one prompt sentence and that is the owner's (§3.1).** The after run's own words:
*"This permit is current but will expire in approximately 21 months; plan renewal now"* — under the
word **out of date**. Stable across both after runs, so it is not variance.

  **Why, pointed at the line.** `on_file` was narrowed to *"a document is on file and carries a
  date, **and nothing the document shows falls short of what was asked**"*. Line A1 asks for the
  permit *"with the renewal application due date noted"*, and nothing on file notes it — the date
  was worked out. So the model correctly refuses `on_file`, and then picks the wrong neighbour.

  **⚠ CORRECTED AT E0a, AND THE CORRECTION IS THE INTERESTING PART.** This paragraph named the
  tie-break sentence *"WHEN BOTH FIT, OUT OF DATE WINS"* as the likely pull. **That sentence is in
  `SHAPE`, and a template run never sees `SHAPE`** — `auditTemplatePrompt` returns
  `[ROLE, HONESTY, SHAPE_T]`. The model that wrote A1 had never been shown it. The real pull was
  `SHAPE_T`'s own clause, *"A line whose document is old enough that an inspector will ask is
  stale"*. E0a's finding 1 has it, and the owner's sentence is now in **both** shapes.

  **The smallest honest change was one clause**, and at E0a the owner approved it: *"A document
  still inside its own dates is never stale, whatever is missing from it: that is on_file_gaps."*
  **It closed this**: A1 is no longer `stale` in either E0a run.

**2. The golden audit set has no prior `sections`-mode recording, so today's five numbers are a new
baseline and not a comparison.** Everything on disk before today is `whole` mode on **Opus**, 30
September. Today, Haiku, one run each: `cascade-deq` **20/22**, `cascade-fire` **7/9**, `cascade-osha`
**7/13**, `cascade-template-12` **15/20**, `cascade-template-13` **12/12**. The one near-comparable
point is template-13, which scored **10/12 on Haiku** on 1 October and **12/12** today — including
all three lines E0 widened. **`cascade-osha`'s six failures have nothing to do with a word:** its
nineteen findings are about fire extinguishers, so the keyword checks for the plan, the forklift log
and the SDS matched nothing. One Haiku run of an agency case is not evidence about E0.

**3. Of the fifteen golden failures, exactly two touch the new word, and one of them is the KEY being
out of date rather than the answer being wrong.** `cascade-template-12` **A5** — *"Deviation reports:
any deviation in the last 12 months notified within 24 hours…"* — came back `on_file_gaps` where the
key accepts only `nothing_on_file`, and the answer is right: the 2025 annual report records the
deviation and the notification evidence is what is missing, which is a document answering the line in
part. **The key was written when there was no word for that.** Widening it is the owner's call and it
is not done. **C1** is the other half of defect 1: *"Each scrubber operating with the associated line,
pressure drop within range **at the time of inspection**"* came back `on_file_gaps` where the key
wants `not_a_document_question`. Same shape as A1 — narrowing `on_file` pushes the model off green
and it lands on whichever neighbour is nearest. The second clause that would close it: *"A line about
what an inspector will see on the day is not_a_document_question even when a document bears on it."*
**⚠ Approved and made at E0a, and it did NOT close C1** — it moved C2 and C3 and left C1 where it
was. E0a's finding 3.

**4. §7's own map of W4 was wrong in two places, and both were load-bearing.** It said *"One prompt
serves both the agency and the template run… there is no second audit prompt."* There is:
`prompts/audit-agency.ts:292` `auditTemplatePrompt`, with its own word list **and its own
partial-answer rule** — *"ON FILE MEANS A DOCUMENT ANSWERS IT, EVEN IN PART"* — which is **the cause
of W4**. The model was not making a mistake; it was following that paragraph. And the map did not
name `AUDIT_TEMPLATE_JSON_SCHEMA`, which carried the four words as a hard `enum`: a four-word enum
beside a five-word prompt is §136's trap, waiting for `AI_AUDIT_STRUCTURED` to be switched on.

**5. The email would have printed "…and -2 more", and no test could have caught it.**
`lib/auditNotify.ts` computes it as `nothing_on_file + stale − attention.length`, and
`summariseRun`'s `attention` list gains the fifth word. Widening one without the other goes negative.
Found by reading the two files together while mapping; nothing in the product reads a finished run's
email text.

**6. ⚡ A RECORD'S GAPS WERE INVISIBLE IN ITS OWN DRAWER, AND ITS ROW SAID "Needs work".** Every gap
list in `components/DocumentReport.tsx` was behind `isProgram` — `kind === 'program' || kind ===
'policy'`. The Clackamas forklift roster is a **record** with **two gaps read from the page**: the row
said Needs work and opening it showed no gaps at all, so a person was told there was work and never
told what. Found by mapping decision 48 against board 2, which draws that roster's gaps. The gate is
now `hasFindings` — a document with something to show shows it, whatever kind it is.

**7. The template report counted suggestions among the findings.** `tCounts` ran `countsFor(openF)`,
and every `expected` row carries the word `nothing_on_file` (`audit_findings_expected_is_expected`,
058:209). A template run writes no expected rows today, so nothing was wrong on screen — but board 1
puts *"Usually held — not seen"* on this report, and the count would have been wrong the day E1
arrived. Fixed with decision 60's label, folded always.

**8. Decision 48 moves exactly one row on all of staging, and it moves nothing on the Clackamas
company.** 18 current scans carry `gaps_found`; **17 have at least one gap with `basis = 'read'`**.
The one that moves is Cascade's *"Spill Response Procedure — Caustic Soda"* (`spill-response.odt`),
6 inferred gaps and 0 read: **Needs work → On file, with 6 notes**, photographed. It shows **On
file** and not **Current** because it is a `program`, and `on_file` is the state it would otherwise
have — decision 60's own list says *"Current, Expiring, Recorded…"*, and board 4's drawing of
*Current* on two records does not follow from the view's arms.

**And board 4's picture does not match the rows in one more place, which is worth saying plainly.**
It shows the respirator fit-test record going from red to *"Current · 1 note"* on a hedged guess. Its
one gap is `basis = 'read'` with a verified quote — *"No PortaCount printout or test report
attached"* — so it stays **Needs work**. The owner's note of 4 November says B0 re-read that document
on Haiku and the board drew the older reading; nothing is wrong with the decision, only with that
one row of the picture.

**9. `basisOf` defaults a missing basis to `read`, and decision 48 therefore errs toward keeping
"Needs work".** `lib/documentScan.ts:62`'s own comment: *"Anything the model does not say is `read`,
which is the value that OVERSTATES a claim… the direction that gets noticed."* A model that never
labels an inference produces all-read gaps and the new rule never fires. That is the safe direction
and it is why the recorded golden document runs of 25 September — whose gaps carry no `basis` key at
all — are untouched by this change.

### ⚡ What Part B step B4 found (3 November 2026, `b35b78e`) — and PART B IS DONE

**The headline is what the product was paying for.** A password-protected PDF went to the model
**whole and base64'd**, and the money was spent on a file nobody could open. Proved by running it
before anything was changed: `parseDocumentToBlocks` returned `ok: true`, one `document` block of
**1,420 base64 bytes** and `text: ''`, while the server log said
`pdf text extraction failed … [OfficeParser]: No password given`. **The library already knew.**
`pdfText`'s catch — written to treat "no text" as never a failure, which is right for the three
cases its own comment lists — threw the fourth case away into a warning. It reads the verdict now,
the PDF never reaches the model, and the row carries the owner's sentence. Read back from staging:
`could_not_read`, `model = '(not called)'`, **`ai_call_id = null`**.

**And six formats were sitting there unused.** `officeparser` has been a dependency since the
PowerPoint branch, and its own refusal names everything it reads. `.odt`, `.ods`, `.odp`, `.rtf`,
`.md` and `.html` cost **a branch and a fixture each** — no dependency, no converter, no service —
while `docs/VISION-DOCUMENTS.md`'s table planned converters for them. B2 found the sentence; B4
collected what it named.

**Four things the building found.**

1. **`isExcel` claimed every `.ods`.** Its test was `type.includes('spreadsheet')`, and an ODS's
   media type is `application/vnd.oasis.opendocument.spreadsheet` — **the word is in it**. Exactly
   the shape of the `.doc` and `.ppt` claims B1 removed: a branch that claims a file it cannot
   read makes the sentence written for that file unreachable. Narrowed to `spreadsheetml`.
2. **An empty `.md` or `.html` throws nothing at all.** A corrupt `.odt`, `.ods` or `.odp` answers
   `invalid zip data` and is caught; an empty text file and a truncated `.rtf` come back with no
   text and no error, and the model would be handed an empty block to read. That is now a failure
   on the new branch. **The other branches are deliberately left alone** — what a `.docx` with no
   words should do is not B4's to decide, and is recorded rather than taken.
3. **Two of the six cannot be auto-detected from a buffer** — officeparser's own documentation:
   *"Formats like `md`, `html`, and `csv` have no magic bytes."* The hint is passed for all six
   anyway, because `pdfText`'s comment already records that auto-detection **does not survive the
   server build**: a call that works in a plain `node` script throws inside a route.
4. **The drift guard had to be taught a third mechanism.** The reader claims extensions through an
   `ext === '…'` in a branch, a key of `IMAGE_TYPES`, and now a key of `OFFICE_TEXT`. The guard
   caught B4's six as undeclared and failed, correctly, before it was widened — **a guard doing
   its job on the person who wrote it.** Its own note now says that a fourth mechanism added
   without teaching it would make it pass while the drift happens.

**What the walk proved, on Haiku, as Cascade.**

| | |
|---|---|
| 1. an `.odt` and an `.rtf` dropped as a folder | **both read**, `json_parsed = true`, both titled *"Spill Response Procedure — Caustic Soda"* from the documents' own words |
| 2. the password-protected PDF on the Documents tab | `could_not_read`, **`ai_call_id = null`**, and the row says *"This PDF is password-protected… Remove the password — in Preview or Acrobat, save a copy without it — and add it again."* `shots/b4-walk2-locked-row.png` shows it **above** a half-sent HEIC (B2) and a `.doc` (B1): **three honest refusals stacked, not one generic sentence among them** |
| 3. an `.html` page through the paperclip | the answer named the page and **quoted it word for word with a source marker** — *"Report any spill over 5 gallons to Oregon DEQ within 24 hours on 503-229-5696."* — then went past the document to the law and flagged four real gaps (the reporting threshold and channel, HAZWOPER training, the neutralisation hazard, the unverified spill kit). `shots/b4-walk3-html-answer.png` |

### ⚡ `PENDING.md` D3 — the scanned PDF, read and not built (B4 item 3)

**What happens today, by line.** A PDF with no text layer is still read: `lib/documentContent.ts`
sends it whole as a `document` block and `pdfText` returns `''`. `saveScan` writes
`extracted_text: scan.extracted_text || null` and `quotes_checked: 0`. `verifyQuote` returns
**null**, not false, and `components/DocumentReport.tsx:949`–`:954` draws **nothing** for null —
deliberately, and its own comment says why: *"A photograph of a page has no text to check against,
and saying either sentence about it would be a claim we cannot support in either direction."*

**So the person is told nothing — and the report meanwhile makes a claim that is not true for this
document.** `components/DocumentReport.tsx:1023`–`:1027`, the quiet last line, says
*"Quotes are word for word from the document and anything we worked out is marked inferred."*
On a scanned PDF nothing checked that, and the sentence is unqualified.

**The smallest honest change is two lines in one file**, and it needs no migration, no route
change and no model call:

- `components/DocumentReport.tsx:78`–`:81`, `interface Scan`, gains `quotes_checked: number | null`.
  **The data is already in the payload** — `app/api/documents/report/route.ts:36` selects `*` from
  `document_scans` — so nothing else moves.
- the quiet last line at `:1023` qualifies itself when `quotes_checked === 0` and the kind is
  `pdf`: *"These pages are a scan, so we could not check the quotes against the file."*

**A Part E item**, with the rest of the display work. Recorded on D3.

### ⚡ What Part B step B2 found (3 November 2026, `96d05ae`)

> **⚡ B2 READS THE PHOTOGRAPH.** HEIC, TIFF and BMP, converted inside Vercel. `PENDING.md` **D2 is
> narrowed again**: what remains is B4 (zip, email, the password-protected PDF, the page and size
> limits) and the rev 2 container for `.doc` and `.ppt`.

**Three things settled by running them, each of which a document asserted the other way.**

| claim | what happened when it was run |
|---|---|
| `VISION-DOCUMENTS.md:188`: *"HEIC (libheif) … cannot run there [Vercel]"* | **Wrong.** `libheif-js@1.23.5` is libheif compiled to **WebAssembly**, zero dependencies, nothing native. A 12-megapixel HEIC became a 2,576 px JPEG in **299 ms**. Corrected in the commit |
| sharp reads HEIF, so it reads HEIC | **Wrong.** `sharp@0.34.5` / libvips 8.17.3 answers a real HEIC with *"heif: Error while loading plugin: Support for this compression format has not been built in"*. It carries the ISO-BMFF container for AVIF and no HEVC decoder — which is still useful: it reads a HEIC's **dimensions** in about a millisecond, and that is what makes the 50-megapixel ceiling free |
| sharp reads everything an image library reads | **Wrong about BMP.** *"Input buffer contains unsupported image format"*; its read list is jpeg, png, webp, tiff, gif, svg, heif, raw. `bmp-ts` does it in 11 ms, and **returns ARGB, not RGBA** — settled by comparing channel means (`135, 114, 104` against `135, 115, 105`), because a photograph read in the wrong order decodes perfectly and is blue |

**And one claim in B2's own brief that the measuring contradicted, said plainly.** The brief asked for
the 48-megapixel walk to show *"the ledger's input tokens … about what a 1.5-megapixel image costs,
not more"*. **That was already true without us.** Read from the vision guide on 3 November: an
oversized image is **downscaled by the API, not rejected** — to a 1,568 px long edge on the standard
tier and 2,576 on the high-resolution one — and billed at the smaller size. The resize rule saves no
tokens. What it does buy is real and different: **over 8,000 px on an edge, or 10 MB base64, is an
`invalid_request_error` and not a downscale**, and a 48-megapixel photograph in 4:3 sits exactly on
that wall. So walk 4 is reported for no rejection and the dimensions capped, and for nothing else.

**What the walk proved, on Haiku, as the Cascade person.**

| | |
|---|---|
| 1. a drum label's HEIC on the Documents tab | **read**, `json_parsed = true`, and the reading named it: *"Sodium Hydroxide Solution, 50% — Drum Label"*, Northwest Alkali Products, the hazards and the precautions. `shots/b2-walk1-heic-read.png` |
| 2. the same HEIC through the paperclip, *"Is this label complete?"* | the answer named **the CAS number (1310-73-2), the pictogram, both hazard statements and both precautionary statements**, cross-referenced the SDS already on file, and asked a question rather than guessing. `shots/b2-walk2-answer.png` |
| 3. a 3-page TIFF | **read**, and the model described what was on the pages rather than inventing content |
| 4. a **real 48-megapixel JPEG** (8000 × 6000) | **read** — *"Weekly Scrubber Inspection Log"*, filed Oregon DEQ, *"Last entry 26 September 2026"* off the sheet. **No rejection; the dimensions capped at 2,576 × 1,932** |
| 5. a half-sent HEIC | `could_not_read`, `model = '(not called)'`, **0 cost rows**, and the row says *"This photo could not be opened. Share it as JPEG and add it again."* `shots/b2-walk5-fallback-row.png` shows it **beside** a `.doc`'s B1 sentence — two kinds of honest refusal, and neither is *"Something went wrong at our end"* |

**Four things B2 found and did NOT change.**

1. **The chat answered *"The label is complete for the basic required elements"* — and the signal word
   is missing.** The label carries no signal word, which 29 CFR 1910.1200(f)(1)(iii) requires; the
   answer listed everything present and asserted completeness without checking for it. **The reading
   was right about everything it could see and wrong about the one thing the question asked.** On
   Haiku; the owner judges quality on Opus. A prompt change is §3.1's, not B2's.
2. **The scan classified the drum label `supplier_document` and `not_judged`, so it looked for no
   gaps at all.** That is the product's own rule for somebody else's document — and a container label
   on your own drum is arguably **your** 1910.1200(f) obligation rather than the supplier's. Golden
   case 07's signal-word assertion was moved from `must` to `reported` for exactly this reason, with
   the reason written into the case. **A judgement change, so the owner's.**
3. **"Filled 12 August 2026" became `Revised 12 August 2026` on the row.** A fill date is not a
   revision. It is the right date and the wrong word for it, and it is `doc_date_kind`'s vocabulary —
   which B0 held to its five words and did not widen. Worth a sixth word, or not; the owner's.
4. **officeparser already reads `.odt`, `.odp`, `.ods`, `.rtf`, `.md` and `.html`** — its own refusal
   names them. Six rows of `VISION-DOCUMENTS.md`'s table are a branch and a fixture rather than a
   converter. **Recorded on B4**, not taken.

**B2's second half, 4 November 2026 — the copy is stored.** Migration 092 applied to staging with
`CHECK_LIVE_BASE_URL=http://localhost:3999 npm run db:migrate` and **read back from the live
schema**: `documents.converted_url`, `text`, nullable, with its comment, and `092` in
`supabase_migrations.schema_migrations`. The copy rides the scan to `saveScan` — the one function
that holds the admin client, the company and the document id at the same moment — and is written
**last, after the status**, so a slow upload cannot leave a row saying *"Reading…"* to somebody
watching. A storage refusal logs and leaves `converted_url` NULL, which is what NULL means.

**Read back off staging after one re-read on Haiku ($0.05945):**

| | |
|---|---|
| the key | `95f7167d-…/converted/9391b1b0-….jpg` — **three segments**, a sibling of `unfiled` and `golden` |
| the copy | **230,573 bytes, magic `ffd8ff`, `image/jpeg`** |
| **the original** | **untouched — 192,356 bytes, brand `heic`** |
| account delete | `list('<company>/')` returns `converted, golden, unfiled`; `list('<company>/converted')` returns the one file. The two-level walk finds it, which is the whole reason for the depth |

**And a second sighting of a defect B0 recorded and did not change.** This re-read wrote
`could_not_read_reason = '.'` on a scan whose status is `not_judged` and whose document says
`read` — B0 found the same shape as `'.none'` and recorded it: `str()` does not treat a bare
punctuation mark as nothing. Never shown (the page prints that column only when `display_status`
is `could_not_read`), still cosmetic, and now seen twice rather than once.

**And one guard that was crying wolf, fixed at source.** `npm run check` failed on
`scripts/check-schema-contracts.js` reporting **`.from('x') — no such table`** against
`Buffer.from('x')` in a test. Its dynamic-site scan already excluded `Buffer.from`, `Array.from`
and `storage.from` by name; the regex that does the actual checking never got the same guard. A
guard that cries wolf is a guard people learn to skip, and this one is believed precisely because
it has never been wrong. Excluded by name rather than allow-listed by receiver, so it cannot
quietly stop checking whichever client somebody adds next — and **shown to still catch a real
mistake**: a deliberate `.from('documentz')` was reported, and the file and relation counts (422,
61) did not move.

**And two things about the tools, not the product.** The Supabase CLI now refuses to apply a
migration when it detects a program calling it (`HostedMutationConsentRequiredError`), which
`scripts/db-migrate.js` predates — so migration 092 could not be applied in that session. **It was
applied on 4 November on the owner's say-so**, with `--yes` added to `scripts/db-migrate.js`
**for staging only** — never for production, because §3.7 says that guard is never automated and
the CLI's own prompt is the second pair of eyes on an irreversible act. And the walk's batch
email went to a **real address** (`bhaskarc@compliboard.com`): `lib/documentBatch.ts:217` is one of
the four senders §5b D1 records as holding a literal sandbox address and sending on production.

### ⚡ What Part B step B1 found and fixed, and what it found and did not (3 November 2026, `a2e56e4`)

> **⚡ B1 CLOSED THE PICKER'S PROMISE.** `PENDING.md` **D2 is narrowed, not closed**: the refusal is honest; the
> converters (B2, B3) are the part that remains.

**The six proofs, each read back rather than reasoned about.**

| | |
|---|---|
| `npm run check` | exit **0** · `check-schema-contracts: ok — 419 files, 61 relations` · `test-guard: 2365 tests, 0 skipped, 0 todo, floor 2365. OK` (floor 2336 → 2365) |
| the drift guard | `tests/unit/fileTypes.test.ts` reads `READABLE_EXTENSIONS` **and** the `const is…` block of `lib/documentContent.ts` and fails if either grows or loses a type the other has. Shown to fail on a doctored copy of the reader that re-adds `.doc` |
| the sentences | each refused type on a **real fixture** through `runDocumentScan` — the same function the sweep calls — lands `could_not_read` with its own words, `model = '(not called)'`, `json_parsed = false` |
| walk 1, the folder | a folder of one `.pdf` and one `.doc` on Cascade's Documents tab: **"1 file skipped: 1 old Word (.doc)"** with the sentence under it, while *"Reading 1 of 1: Harbor-Kitchen-Employee-Policy-2026.pdf"* runs beside it. The PDF then read on Haiku — `json_parsed true`, **15 of 17 quotes verified**, $0.07873. `shots/b1-walk1-folder-skipped.png` |
| walks 2 and 3, the pickers | the `.doc` through the Documents paperclip and through the Workspace's picker, and a **HEIC** through HR's: each refused with its own sentence and **`BLOCKED (0)` — nothing uploaded, no route called at all**. `shots/b1-walk2-paperclip-doc.png`, `b1-walk3-workspace-doc.png`, `b1-walk3b-hr-heic.png` |
| walk 4, the sweep | a `.doc` row inserted the way `POST /api/documents` writes one, then the real sweep: `{"companies":1,"read":0,"could_not_read":1,"errors":[]}` in 4.1 s. Read back from staging — `could_not_read_reason` is the `.doc` sentence **word for word**, `model = '(not called)'`, and **0 rows in `ai_calls`**. `shots/b1-walk4-sweep-row.png` |

**Five things B1 found. Two were fixed in the same commit; three are recorded and not changed.**

1. **FIXED — the row's own control said the wrong thing.** Under *"Save it as .docx or PDF and add it again"*
   the button said **"Upload a clearer copy"** — the instruction for a blurry photo, given to somebody whose
   file's sharpness was never the problem. Found by photographing walk 4, not by reading the code. Now
   **"Add it again"**, which is true of every reason, in all three places that draw it:
   `app/documents/page.tsx:825`, `components/DocumentReport.tsx:535`, `app/compliance/page.tsx:1795`.
2. **FIXED — `way_forward` was one generic line for every format** (`'A PDF or a Word file we can read.'`,
   `lib/documentScan.ts:671`). It is `null` now: the reason carries its own instruction. **It was never stored
   in any case** — read off the live staging schema, `document_scans` has `could_not_read_reason` and no column
   for a way forward, so the sentence a row keeps and the Documents list shows has always been `reason` alone.
3. **NOT CHANGED — `docs/VISION-DOCUMENTS.md` §"File types" says ELEVEN types read; the code says twelve
   extensions.** The document counts JPEG, PNG, GIF and WebP as four types and does not count `.jpg` and
   `.jpeg` twice. **Nothing is in dispute about which formats work**, so the code won and the disagreement is
   recorded in `lib/acceptedFiles.ts`'s own header rather than by editing a 27 September design document.
4. **NOT CHANGED — `app/upload/page.tsx` does not exist.** This file's own B1 row named it as a picker, and so
   does `DECISIONS.md`. `ls app/upload` → no such directory; `grep -rn 'type="file"' app components` returns
   **five inputs in four files** and `components/archive/GateAskCard.tsx`, which is archived and has no
   `accept` at all. `docs/CALENDAR-MACHINERY.md:439` is stale the same way: it records a hand-written
   `accept=".xlsx,.xls,…"` on the Calendar's import panel, and `app/calendar/page.tsx:862` now says *"This page
   has no file picker"*. **The test is what keeps the list right from here** — `tests/unit/fileTypes.test.ts`
   names the four live pickers and fails if any grows an `accept` of its own.
5. **NOT CHANGED — officeparser reads six formats nothing offers.** Its own refusal names them:
   *"OfficeParser currently supports docx, pptx, xlsx, odt, odp, ods, pdf, rtf, md, html, csv files only"*. So
   `.odt`, `.odp`, `.ods`, `.rtf`, `.md` and `.html` are **free** — a dependency already installed reads them.
   `VISION-DOCUMENTS.md`'s table asks for `.md` and `.rtf` "as text" and the Open formats "convert like the
   binaries", and that is more work than it needs to be. **For B4 to decide**, with one fixture each.

**And one thing the walk found about the harness, not the product.** The first run of `--attach` uploaded the
same PDF **twice**, 28 ms apart — two rows on staging, read back and deleted. It was the harness dispatching a
`change` event that `DOM.setFileInputFiles` had already fired. A harness that quietly doubles a write is a
harness that reports a defect that is its own, so `scripts/measure-layout.mjs` now reads the file count out of
a capture-phase listener and prints it, and three other silent no-ops behind that one CDP call are written up
beside it. **`--attach`, `--attach-any` and `--attach-folder` are new**, and they are the first thing in this
repository that can walk a chosen file through a screen at all — B2, B3 and B4 all need them.


### ⚡ What the OWNER's walk found (3 November 2026)

> **⚡ B0 CLOSED THE TWO THAT COST MONEY — 3 November 2026, commit `43b304e`.** Both are below with their
> original evidence intact; this is what was done and how it was proved.
>
> **W2 — `lib/documentScan.ts`.** `doc_date_kind` is now held against the five words the live CHECK allows,
> **in `status`'s shape and not `kind`'s** (`normaliseDocDateKind`, called at the `doc_date_kind:` line in
> `normaliseScanRaw`): `kind` falls back to `null` because a document whose kind we did not understand has
> no kind, but a date still exists when we cannot name what sort of date it is, and the schema already
> carries the word — **five current rows on staging hold `unknown` legitimately, because the prompt offers
> it.** An unrecognised word becomes `unknown` and is said out loud with `console.warn`, which is this
> file's own second channel for a value the product refused (the same choice, with the same reasoning, as
> the calendar counts, whose comment says plainly that `document_scans` has nowhere to put them and that
> `confidence_notes` is the model's own prose). **The raw word is kept in `document_scans.raw_text`** —
> where `kind`'s and `status`'s rejected words have always gone, because neither of them records its raw
> value anywhere else — so `select raw_text from document_scans` finds every drift and no column was added.
> **The constraint is unchanged.** *Proved two ways, because one would not do it:* five tests drive the real
> off-list word through `normaliseScan` and hold that the row lands with `unknown`, that the date itself
> survives, that the warn names the word and says where it is kept, and that the parsed answer `raw_text` is
> written from is left untouched; and **the three real failures were re-read on Haiku through the guard**
> (`npm run haiku -- npm run scan -- --document <id>`) and **all three landed** — `10-osha-300a-2025.pdf`
> scan `8e5c0a6d`, `08-deq-annual-report-2025.pdf` scan `2c774c55`, `Respirator_Fit_Test_Records_June_2026.pdf`
> scan `fc1d0f13`, every one `json_parsed = true`, `is_current = true`, `model = claude-haiku-4-5` and
> **`doc_date_kind = 'issued'`**, read back from staging. *Said plainly: all three re-reads happened to write
> a legal word, so they prove the path still works and they do **not** re-create the original failure — the
> original was Opus writing an off-list word, and the guarantee against it is the test, not the re-read.*
> **$0.1843 for the three** ($0.0455 + $0.0747 + $0.0641, all Haiku).
>
> **W3 — `components/AskScreen.tsx`.** The screen is busy from the moment it calls `beforeAsk` until the
> verdict returns: released on `'handled'` before the box and the chip are cleared, released and re-thrown on
> a throw so a section whose own work failed cannot freeze the screen with the words in it, and **left set on
> `'ask'`**, so `setBusy(true)` below is a no-op and the button never flickers back between the look and the
> request. The words stay in the box until the verdict, as before. Three tests, and one existing test edited
> on purpose (the handled arm now releases `busy` first). **Measured on the harness, before and after, the
> same command on two isolated Haiku servers — `77ec7e4` on 3997 and `43b304e` on 3998, both 16 of 16 tiers
> on `claude-haiku-4-5`:**
>
> | | at 700 ms, `shots/b0-*-700ms.png` | `POST /api/audit-runs` on a double press |
> |---|---|---|
> | **before** | the words in the box, the button a live green **Ask** | **2** |
> | **after** | the words still in the box, the button a disabled pale **Asking…** | **1** |
>
> The second press after the fix is the proof in one line of harness output: `--click "=Ask"` **found no
> button at all**, because the button no longer says Ask — and `--click "=Asking…"` then reported
> `clicked: Asking…` with the POST count still at one. `BLOCKED (0)` on both runs.
>
> **Two things B0 found and did NOT change, recorded rather than done:**
> · **`failedScan` writes `raw_text: ''`, and the model's raw text WAS available two statements earlier.**
> In the sweep, `const scan = await runDocumentScan(...)` is declared **inside** the `try`, so in the `catch`
> that calls `failedScan` it is out of scope. Keeping it is not one line — it needs the variable hoisted, a
> fourth parameter on `failedScan`, and four other call sites considered — so §5.1's *"fold in the raw
> response"* is still unmet on this path, and the technical detail lives only in `job_runs.errors`. **The same
> scope is why that row says `model: '(not called)'` about a call that had been made and billed.**
> · **The file now has two matching shapes.** `kind`, `status` and `doc_date_kind` match exactly;
> `basisOf` lowercases first. So `"Issued"` becomes `unknown` rather than `issued` — better than today, where
> it loses the whole reading, but not right. **Whether all three should match case-insensitively is one small
> decision for the owner**, and inventing it for one field under a fix would be the wrong way to take it.
> · *(A third, cosmetic, seen in the re-reads: Haiku wrote `could_not_read_reason = '.none'` on a scan whose
> status is `recorded`. `str()` does not treat `".none"` as nothing. It is never shown — the page only prints
> that column when `display_status` is `could_not_read` — so it is noted and not chased.)*

Company *"Step 20 Card Walk"*, `61b26cc0-0d28-411b-b2e4-943189363b08`, on **staging**. Every row below was read through the Supabase CLI's own read-only DB connection (`npx supabase db query --project-ref amzsavsrabrlcprltpom --linked --read-only`), **not** the service role. Production was not touched. W4, W6 and W7 are in §7 because they are decisions; these are the findings.

- **⚡ ~~W2~~ — FIXED 3 November 2026, `43b304e` (B0, decision 46). A READING FAILED BECAUSE OF AN UNCHECKED FIELD, NOT BECAUSE OF THE MODEL — AND THE ROW SAID THE MODEL WAS NEVER CALLED.** `Respirator_Fit_Test_Records_June_2026.pdf` (2.7 KB) needed *"Read it again"*. The scan row (`c11c6f56-b37c-45a3-9db0-842c73ae337e`) carries `status = 'could_not_read'`, `model = '(not called)'`, `raw_text` of **length 0**, and `could_not_read_reason` = *"Something went wrong at our end while reading this one."* **There is no `error_message` column on `document_scans`** — the technical detail goes to `job_runs`, and `job_runs` has it:
  > `{"document":"ad55343c-4152-4d1d-b1b2-956a813a6b93","error":"document_scans: new row for relation \"document_scans\" violates check constraint \"document_scans_doc_date_kind_check\""}`
  (run `f7b3ac1f-d465-46af-8b2f-9e3d6934f842`, `scan_documents`, 19:25:22 → 19:34:05 UTC.)
  **The cause is the reader, at one line.** `document_scans_doc_date_kind_check` allows `issued | revised | last_entry | effective | unknown`. `lib/documentScan.ts:319` writes `doc_date_kind: str(id.doc_date_kind)` — **the model's string, passed through with no list check** — while the line eight above it holds `kind` against `KINDS` (`:311`) and the line six below holds `status` against `STATUSES` (`:325`), with a comment there saying *"An unrecognised status is NOT quietly turned into something valid"*. `doc_date_kind` is the one of the three that was left open, and the database catches what the code did not.
  **And the model WAS called and paid for.** `ai_calls` `5cb96667-8f63-4cf4-a269-2b5bceee59e2`, 19:31:05 UTC, `claude-opus-5-5`, 9,527 in / 3,803 out, 42.4 s, **$0.114168** — two seconds before the scan row landed. The row saying `(not called)` is `lib/documentScan.ts:610`'s placeholder for a scan that never reached the model, and it is wrong whenever this path fires. **The re-read succeeded with `doc_date_kind = 'issued'`**, which is why pressing the button worked: the same prompt, a different word.
  **It is not one document.** The same constraint refused **three scans in one evening across two companies** — `10-osha-300a-2025.pdf` and `08-deq-annual-report-2025.pdf` on *Test Gamma Solvents* (run `c3e05ae5-bdd9-4282-9454-7d6ccf96212d`) as well as this one.

- **⚡ ~~W3~~ — FIXED 3 November 2026, `43b304e` (B0, decision 46). ENTER WORKED. NOTHING ON THE SCREEN DID — AND IT COST A SECOND AUDIT, $0.49.** Two template runs exist, six seconds apart: `8707eea9-6c58-4c98-ab9d-4ec5825642cd` at **19:38:23.010** and `45724268-c3e2-45c4-a2d0-75be0dcded04` at **19:38:29.020** — same `template_document_id`, same scope, same `extraction_ai_call_id`, identical summaries. **No `audits_chat` topic and no turn was written by either**: the company's only `audits_chat` topic is from 18:59, so the handled-command path did exactly what decision 39 asked. **Enter is not the defect, and cannot be:** `components/AskScreen.tsx:351`'s `onKeyDown` and the first-visit button at `:435` both call `ask(box)`, the same function with the same argument.
  **The gap is six seconds of nothing, and the clock proves it.** The extraction call `422052fd-bef0-46ae-8ea6-e9e99c2aa21b` ran **5,995 ms** and landed at 19:38:29.119 — so the POST the first press made was still in flight when the second press happened. During that window: `components/AskScreen.tsx:274` is awaiting `beforeAsk`, **`setBusy(true)` at `:283` has not run** (it is only reached when the verdict is `'ask'`), so the composer keeps the words, the button keeps saying **Ask** instead of **Asking…** (`:436`), and the guard at `:266` — `if (!q || busy)` — **cannot refuse the second press, because `busy` is false**. `app/audits/page.tsx:466` does set a `busy`, but it is the page's own and is read only at `:613`, `:981`, `:1009` and `:1381` — **all four inside the Audits tab**. The notice at `:820` is set at `:529`, after the POST returns.
  **Reproduced on the harness** (`npm run haiku -- npm run measure -- /audits --base http://localhost:3998 --as testcascade@example.com --wait 1500 --type "Audit us for Oregon DEQ" --click "=Ask" …`). The harness has no key-press action and cannot drive the file picker, so the agency command stands in for the template one — the same `beforeAsk` path, and the one that proves Enter is innocent is the two lines above. **`shots/w3-2-inflight-700ms.png`: 700 ms after the press, the sentence is still in the box, the Ask button is still green and enabled, no notice, tab still *Audits (6)*.** `shots/w3-3-after.png` on a warm route: the notice *"Audit us for Oregon DEQ" / Starting the Oregon DEQ audit. It is on the Audits tab. / Open the Audits tab*, and the tab at *Audits (7)*. **`BLOCKED (0)` and exactly one `POST /api/audit-runs` in both runs.**
  **The price of the missing in-flight state:** the duplicate run's three sections cost **$0.4924** on `claude-opus-5-5` (the first's cost $0.3657; the shared extraction $0.0236). **This is Part E job 5 and it is one line of state, not a redesign.**

- **W1. A FOLDER OF NINE FILES SHOWED NO PROGRESS FOR ELEVEN MINUTES, AND THE OWNER PRESSED "READ IT AGAIN" ON A FILE THAT WAS SIMPLY WAITING ITS TURN.** `document_batches` `c89e765c-7fea-4c96-a4b1-7016a56836c0`, created 19:23:39, `file_count 9`, `done_count 8`. The sweep reads **one document at a time**: the scans landed at 19:27:07, 19:27:35, 19:28:14, 19:29:39, 19:30:20, 19:31:07, 19:32:45, 19:33:25 and 19:34:03 — **10 minutes 24 seconds for nine files.** *It was working the whole time.*
  **What the page shows while that happens.** One row at a time does say *"Reading…"* (`lib/documentStatus.ts:95`, from the `status: 'reading'` the sweep writes at `app/api/jobs/scan-documents/route.ts:236`), and the page polls every ten seconds while anything is in flight (`app/documents/page.tsx:350`–`:354`). **But nothing at the top of the page says a batch is open or how far it has got**: the banner at `:979` is gated on `banner?.summary`, and a summary exists only once `finishBatchIfDone` has run. The table is sorted by title by default, so the single *"Reading…"* row is wherever the alphabet puts it among nine.
  **The behavioural proof.** Batch `a22180e3-50e7-41a4-bf25-1530aa55c0e1` was created at **19:25:22** — one minute 43 seconds into the sweep — holding one document, `Powered_Industrial_Truck_Operator_Certifications_2026.pdf`. `app/api/document-rescan/route.ts:77`–`:99` creates a batch of one and repoints `batch_id`, so that row **is a press of "Read it again"**. That document has exactly one scan (`b616dc32`, 19:34:03, **succeeded first time**). The owner re-queued a file that had never failed, because the page gave him no way to tell waiting from broken. The button is disabled only by `busy || rereading || paused` (`components/DocumentReport.tsx:432`), never by the document's own state.
  **Where the line goes, for Part E job 4:** an `else` arm of the same test at `app/documents/page.tsx:979`, in the same grey box, above the controls at `:1019` — a banner for an OPEN batch. **It needs no schema change and no new query**: `document_batches` already carries `file_count` and `done_count` (read from the live schema), and `/api/documents/index` already returns `in_flight`, which the page reads at `:324`.

- **W5. SIX OF THE TEN AUDIT LINES WRITE A BARE DOCUMENT HANDLE AT THE PERSON.** Counted with a regex over run `8707eea9`'s rows: `what_to_do` contains a bare `D<n>` on **6 of 10** lines (A1, A2, A3, A4, C1, C2); `basis` on **0 of 10**. Eight distinct handles leak — D1, D4, D5, D6, D7, D9, D10, D12 — in sentences like *"D6 is on file. It is an Oregon DEQ Simple Air Contaminant Discharge Permit…"* and *"D9 and D10 are blank checklist templates"*. `prompts/audit-agency.ts:81` already says **NEVER NAME WHAT DID THE READING**, and the handles are a different rule that is not holding. **This is the audit prompt's, not Part E's** — and it is worse than it looks, because step 6a already recorded that the chat is shown this stored text and may copy a handle out of it (§8, *"An audit's own stored `what_to_do` contains handles from the run that wrote it"*). The audit writes the hazard; the chat inherits it.

- **W8. THE READER IS RIGHT ABOUT ONE AND OVER-REACHING ABOUT THE OTHER — AND IT IS THE STATUS, NOT THE PROSE.** Both documents the owner's key called clean show **Needs work** (`display_status` `needs_work`, from `scan_status` `gaps_found`, read from `document_index_v`).
  **The Hazard Communication Program (`ec1dcf53`) earns it: 8 gaps, five of them `basis = 'read'`** — shipped-label elements missing precautionary statements and the company address (1910.1200(f)(1)); no in-plant container labelling (f)(6)–(7); no pipe labelling at all (OAR 437-002-0378); incomplete multi-employer provisions; training topics short of the rule's list. Two more are `inferred` and are the owner's own point: *"The inventory lists only 12 purchased raw materials… no finished blends or in-process intermediates are on the list"* and *"no procedure for classifying blends and writing their SDSs"*. **The reader is right.**
  **The Respirator Fit Test record (`ad55343c`) has exactly ONE gap, and it is `inferred` and hedged in its own words:** *"No PortaCount printout or test report attached… It may well be on file somewhere else."* **That one sentence is enough to make the whole document say Needs work.** The prose is honest; the status is the over-reach. **It is `gaps_found` being a single bucket**: one hedged inference and eight read-from-the-page faults produce the same word, and six of the walk's twelve documents now say Needs work. A §7 question for the display pass rather than a defect in the reading.

- **`PENDING.md` S1 says "all four senders". There are six.** Read 3 November: `app/api/feedback/route.ts:11`, `lib/auditNotify.ts:186`, `lib/documentBatch.ts:217` and `lib/handbookCheckNotify.ts:103` each hold a **literal** `'CompliBoard <onboarding@resend.dev>'` and send on production; only `app/api/jobs/calendar-month/route.ts:203` and `app/api/invitations/route.ts:149` refuse there, through `sandboxSenderRefusal` (`lib/email.ts:183`). **So `SANDBOX_FROM` at `lib/email.ts:176` is not "one line to change" — four of the six do not use it.** The row is corrected in Part D above rather than in `PENDING.md`, because the count is the work.

- ~~**W9 — the display findings, recorded as the owner gave them, for Part E.**~~ **CLOSED 4 November 2026 at E1**, item by item: the **ellipsis** is gone (the auditor's line is whole, and it was stored whole all along); the **requirement is no longer printed twice** — on a template finding `template_text` and `title` are the same string, so the "full title" line under the row was a second copy of it; the **centred document title** was a `<button>`'s default `text-align: center` and is one `text-left`, photographed on the print; the agency row's body is the same body but the report it opens is a page; and the *"documents this audit read"* duplicate is **W6's** — the checklist was in the list twice, and decision 49 took the run's own template out of it (12 → 11, E0). **What is NOT closed** is the Documents page's own pass (E4) and the summary-report fold (E2). *The original note follows.*
- **W9, as written on 3 November —** The agency row's body mixes documents, dates, the findings sentence and the suggestions paragraph in one grey column · the audit drawer's sub-item repeats the requirement text twice and centres the document title · the printed report truncates line titles with an ellipsis · the *"documents this audit read"* list has duplicates — **and W6 explains at least one of them: the checklist is in that list twice, once from the folder and once from the paperclip** · the Documents page needs the same pass · and the summary-report fold from 2 November. **The shape the owner wants** is in §5a Part E's header; the boards come before any code.

### What step 6's map found (3 November)


### What step 6b's walk found (3 November)

- **⚡ A QUESTION ABOUT AN AUDIT WAS STARTING ONE, AND IT IS DECISION 38's OWN RULE THAT LET IT.** The walk typed
  *"What did the last Oregon DEQ audit find about the scrubber log?"* and the harness refused a paid route:
  `BLOCKED (1): paid route: POST /api/audit-runs`. The sentence has the audit word AND an agency label, so the
  looker read it as a command — a plain question about an audit that had already happened would have started
  another, spending a call and writing rows nobody asked for. **It is the same failure decision 38 exists to
  prevent, pointing the other way.** Decision 38's rule is necessary and is not sufficient, so the looker gained a
  second: **a command is an imperative** — a sentence ending in a question mark, or opening with a question word,
  is a question. *The one sentence it gives away is "Can you audit us for DEQ?", which now reaches the model —
  and that is exactly what decision 41's offer card was built for, so the person presses once instead of typing
  twice.* Nine tests hold it, and **this is a change to a rule the owner wrote**, reported rather than buried.
- **The harness is what caught it, and only because it blocks paid routes by default.** A walk that let
  `/api/audit-runs` through would have shown an audit starting and read as a pass. `BLOCKED (1)` on a page that
  should have called nothing is the single most useful line `scripts/measure-layout.mjs` prints.
- **`Offer` becoming a union broke the Calendar's card, and the type checker said so immediately.** Adding
  `run_audit` to `lib/ask/offers.ts` (decision 43) made `offer.title` an error in
  `components/CalendarAsk.tsx`. The fix is a `.filter((o) => o.kind === 'add_date')` before the map, which
  changes no behaviour — `calendarBrief.offers` is `['add_date']` and `parseOffers` already drops the rest — and
  makes a fact about another file into a type guarantee. Recorded because a shared union is the kind of edit that
  looks additive and is not.
- **A template run's row is named by its READING's title the moment one exists, which is decision 40 paying for
  itself.** The F6 run's row said `12-auditor-checklist-deq-air.docx`, because `attachChecklist` asked for no
  reading. The walk's row says *"Oregon DEQ Air Contaminant Discharge Permit Compliance Inspection Checklist
  (Inspector's Field Form)"* — the scan landed 45 seconds after the upload and `titleOfTemplate` picked it up.
  §8's note from step 6 is closed by this.
- **Two free checks report failures that are not there unless they are run the way the guard runs them.**
  `scripts/test-guard.js` passes `--import ./tests/unit/resolveNextServer.mjs`, which teaches plain Node to
  resolve `next/server`; without it `accessGate.test.ts` reports three failures and `chatUpload.test.ts` five,
  none of them real. Both predate this step. **A free check run by hand is `node --import
  ./tests/unit/resolveNextServer.mjs --test <files>`**, and this file says so now because this programme runs
  free checks by hand at every step.
- **A pixel comparison through `sips -s format tiff` is wrong, quietly.** The first pass reported 20,036
  differing pixels in the fixed sidebar — a stripe every third row, which is a misaligned read and not a changed
  pixel. `length - w*h*4` is not where a TIFF's pixels begin. **BMP says where they begin in its own header**
  (bytes 10–13) and gives the padded row stride, so nothing is guessed; through BMP the same comparison is 0.
  *And a band compared at an OFFSET must exclude the fixed sidebar, or 142 columns of nav labels are reported as
  a difference in the rows.*

### What step 6a's 36 runs found (3 November)

- **⚡ AN `expected` ROW IS A SUGGESTION, NOT A FINDING — and the PACKER made the upgrade before any model could.**
  `audit_findings` holds three kinds in one table, and an `expected` row — *what a company like this usually holds
  and we do not see* — carries the word `nothing_on_file`. **Nine of Cascade's 34 open rows are suggestions.**
  Packed bare they read as nine more things the company failed to file, which is exactly what
  `prompts/audit-agency.ts` forbids the audit itself from implying (*"WHAT A COMPANY LIKE THIS USUALLY HOLDS IS A
  SUGGESTION, NOT A FINDING… it is labelled every time it appears"*) and what
  `app/audits/page.tsx:521` already counts separately. Found by reading the packed block back before the first
  run, fixed in `findingBlock`'s `this_is=` attribute and in the brief's ordering (suggestions last, so the budget
  protects the real findings). **The model then labelled them correctly in 9 of 9 runs where they appeared.**
- **⚡ `A1` MEANS TWO THINGS AND THE PERSON SEES THE WRONG ONE.** The engine's attached-file handle and an
  auditor's checklist line label are the same token, so *"line A1"* came out as *"line
  12-auditor-checklist-deq-air.docx"* in 3 of 3 runs of both variants. §7 carries the one-character fix and it is
  in a shared file, so it is a stop. **Documents has the same exposure** — nothing about this is Audits'.
- **An audit's own stored `what_to_do` contains handles from the run that wrote it.** One template finding reads
  *"Confirm current employee count … against the 42 recorded in D4"*. The chat is shown that text and may copy the
  handle out, which is why `AUDITS_IDS` names D4 specifically. No run did it in 18, but the hazard is in the rows.
- **The Documents chat tells a person something false about their own data, three times out of three.** Asked what
  the last DEQ audit found, it answers *"There is no DEQ audit report on file"* — the company ran one that
  morning. It is not the Documents brief misbehaving; it is a chat answering outside what it was given, which is
  the whole argument for a section having its own brief.
- **With no audit to anchor on, a chat counts days from the reading date.** Asked why the permit is marked out of
  date, the Documents brief answered *"46 days from today"* in 2 of 3 runs — 46 days from **14 October**, the
  reading. The Audits brief said **12 days**, which is right, because `runLine` carries the audit's own date.
- **`chatUpload.test.ts` fails when run on its own and passes under `npm run test`.** It reaches
  `lib/supabase.ts` `createClient`, which needs `NEXT_PUBLIC_SUPABASE_URL`, and `scripts/test-guard.js` supplies
  it. Not a defect and not new — it fails the same way at `f4beb0b` — but **a free check run without
  `--env-file=.env.local` reports five failures that are not there**, and this programme runs free checks by hand
  at every step.


- **⚡ `PENDING.md` F6 IS WRONG, AND RUNNING IT IS THE ONLY THING THAT COULD HAVE SAID SO.** F6 has said since
  September that the template audit *"returns 400 with a sentence saying it is not ready"* and that *"the attach
  control is inert and says so"*. Both are false. One run through the page's own three calls finished in 43 seconds
  with 16 findings, and one click on the control fires `Page.fileChooserOpened`. Three readings disagreed and none
  of them could settle it, which is exactly what the row itself said: *"Settled by running it… not by grep."*
  The row is corrected, and `STATUS.md`'s Audits row with it, at 6b.
- **⚡ THE COMMAND RECOGNISER CANNOT BE BUILT WITHOUT EDITING `components/AskScreen.tsx` — a stop, not a fix.**
  Decision 32 asks code to look at the sentence before it is sent. `ask()` is called from four places inside the
  screen and nothing can get between the press and the fetch; the file picker's result is the screen's own state.
  §7 question 1 carries the recommendation. This is the first time a section's need has reached a shared component
  since step 2's addendum, and it is reported rather than done.
- **A template run's row is named by its FILE NAME, not its title.** `runName` falls back to the document's title
  and there is none, because `attachChecklist` asks for no reading. The F6 run shows as *"Against
  12-auditor-checklist-deq-air.docx"* in Past audits and in the drawer's header. It is honest, and it is what the
  By template group (decision 31) will show unless §7 question 3 is answered yes.
- **`audit_findings.quote_verified` is NULL on all sixteen findings of the F6 run**, including the eight that carry
  a quote and a document. The column exists and nothing in the template path sets it. Not a defect this step
  creates and not one it fixes; recorded because an audit source card in the chat (6a) will want to know whether a
  quote was checked, and today the answer is "nobody asked".
- **Nothing outside the Audits page uses `?tab=`.** Read, not recalled: `grep -rn "tab=past|'past'" app lib
  components scripts tests` returns only `app/audits/page.tsx` and `tests/unit/auditDrawer.test.ts`. Every external
  link into the page is either bare `/audits` (`app/dashboard/page.tsx:346`, `lib/dashboardView.ts:192`,
  `components/AppLayout.tsx:61`) or `/audits?run=<id>` (`app/dashboard/page.tsx:373`, `lib/auditNotify.ts:162` — the
  email — `components/AuditReport.tsx:578`, `:842`, `:1196`, `scripts/bakeoff-audit-capture.mjs:158`). So the
  derived-tab rule has exactly two cases to get right: a bare `/audits` lands on Ask, and anything carrying `?run=`
  — or an old `?tab=past` or `?tab=stand` bookmark — lands on Audits.
- **The 20 October drawer hotfix must survive the merge, and one test pins its spelling.**
  `tests/unit/auditDrawer.test.ts:38` asserts `useState<'stand' | 'past'>(tabParam)` word for word, and `:56`
  asserts `if (k === 'tab') setTab(`. Both are re-pointed at 6b, deliberately. What must NOT move is why they
  exist: the state moves before the router, and an address with no parameters left is written with
  `history.replaceState`, because `router.replace` to the bare path of this prerendered route does not navigate on
  a production build.
- **Two comments carry line numbers that have moved.** `components/Tabs.tsx:5` says the tab row's classes are
  `app/audits/page.tsx:502–515`; they are at `:573`–`:587`. `app/dashboard/page.tsx:370` says `/audits` reads
  `?run=` at `:208` and draws the report at `:791`; they are at `:246` and `:862`. Both are corrected at 6b, in the
  commits that touch those lines.
- **The F6 run was kept, on purpose, and it moves one number.** Cascade now holds **13** documents, not 12 — the
  checklist is the thirteenth and shows as "Not read yet" — and has **one** audit run where it had none. Both are
  wanted: 6a's measurement needs an audit to pack, and a company with no audits cannot measure a chat about audits.
  The Documents chat's index baseline moves 12 → 13 with it, which the 4a-test figures do not. Say so before citing
  them again.


- **A reading card in the Calendar chat lands nowhere.** When a Calendar answer cites a document's stored reading (a card labelled "a reading of your document"), its link is `/documents?document=<id>` and the Documents page does not read that word (`app/documents/page.tsx` reads only `add` and `return`, `:185`, `:198`). A date card ("your calendar") is fine: it opens the date drawer, whose second tab shows the report. Company information's fact links (`:989`) have the same dead end. **Fixed in step 4** — the fix is on the Documents page; Calendar needs no change. To be added to `docs/PENDING.md` as a D row at step 1.
- **The night summary skips Calendar** (`app/api/jobs/summarise/route.ts:94`). Fixed in step 1.
- **`STATUS.md`'s Audits row** still says the template audit "returns 400, not ready" and the attach control is inert. The code has the template branch (`app/api/audit-runs/route.ts:47` onward) and a live button (`app/audits/page.tsx:616–:619`). The row is corrected at step 1 to say what `PENDING.md` F6 says: three readings disagree; settled by running it at step 6.
- **`PENDING.md` D5** points at `app/audits/page.tsx:533`; the dead `/compliance` link is at `:621`. Corrected at step 1.
- **`docs/HANDOFF-FROM-CALENDAR.md`** says thirteen model tiers; `lib/ai.ts:27` has fourteen. Corrected at step 1.
- **The Haiku guard reads `AITask` off one line** (`scripts/haiku-names.mjs:21`). If that line is wrapped, the guard silently stops seeing some tiers and a build run spends Opus money. Standing rule for this work: the union stays on one line, and every step that touches it reports the guard's row count.
- **The homepage's Documents panel** says the plan's two contacts "have both left since"; nothing in the product can know that. For the gate walk, not this part.
- **⚡ DECISION 3a IS BLOCKED ON ONE ADDITIVE LINE, and it is the owner's.** `parseDocumentToBlocks` computes a file's extracted text and `lib/documentContent.ts:52`–`:68` explains at length why — a PDF is parsed a second time precisely so a quote can be checked against it. **`loadAttachedDocument` then throws it away** (`lib/attachedDocument.ts:110`; `AttachedDocument` at `:68`–`:75` has no `text` field). So the passage decision 3a asks for cannot be built. The fix is additive and breaks nothing — `app/api/chat/route.ts` reads only `.id`, `.name`, `.blocks` and `.kind`: add `text: string` to the interface and `text: parsed.text` to the return. **The alternative, `document_scans.extracted_text`, needs no forbidden edit and costs no tokens (a passage is never sent to the model) but is NULL on the turn that matters most**, because the reading is fire-and-forget and the row is still Queued at the first question — and null forever for a paused company and for a scanned PDF (`PENDING.md` D3). Recommended: the one-liner.
- **⚡ THE WALK HARNESS CLICKED A ROW AND NOTHING HAPPENED, AND IT SAID IT HAD — found at step 5.**
  `scripts/measure-layout.mjs`'s `--click key=<id>` took the keyed element and its first `<button>` descendant.
  When `components/ConversationList.tsx`'s row stopped being a `<button>` (decision 29), there was no button to
  find, so it fell back to the OUTER row element — which has no handler. **The click landed, the harness printed
  `clicked: …`, and nothing happened.** The product was never affected: a person clicks the inner element, and the
  harness's text-matching path was never affected either, because `[role=button]` was already in its candidate
  list. Only the `key=` branch hardcoded `button`; it now reads `button, [role=button]`. *A silent no-op in a walk
  is the worst kind of harness failure — it looks exactly like a pass.* **And writing that comment broke the
  script once**, because it sits inside a browser template literal and one backtick ends the string — which is the
  trap the comment three lines above it already warns about, in those words.
- **⚡ A JUST-UPLOADED FILE IS IN THE MESSAGE AND SAYS "Queued" IN THE INDEX, AND THE MODEL BELIEVES THE INDEX.**
  Found by walking board 3 on Haiku. The person attaches a file and asks about it; the engine carries the whole PDF
  (`check_record`: `attached_passages: 1`, `attached_without_text: 0`, and "the attached file" in the context list) —
  but the file is also a brand-new row in the index, where its state is **Queued**, because the reading is
  fire-and-forget and has not finished. The answer opened: *"I can see the file you've attached is not yet readable
  in my system — it shows as 'Queued' in the document list."* **The plumbing is right and the sentence is wrong.**
  The fix is a prompt sentence (the attached file is in this message; its line in the list may still say Queued and
  that says nothing about whether you can read it), which is §3.1 and therefore the owner's. Not applied.
- **A Calendar answer on Haiku would not produce a reading card in two attempts**, so that one leg of 4b's walk was
  not clicked. It produced a **date** card instead (`C11`, "your calendar"). The mechanism was proved on the same
  page by the Documents chat's own card, whose href `lib/ask/documentsBrief.ts` builds with the same string
  `lib/ask/calendarBrief.ts:189` uses — `/documents?document=<id>` — clicked live and landing on the right report.
  What is unproven is only that *Haiku chooses to quote a reading in a Calendar answer*, which is model behaviour
  and not this step's code. **And one stream was cancelled by the walk script and wrote NO `ai_calls` row**, which is
  the ledger behaving as `npm run cost` says it does: an aborted stream has no token counts and inventing them would
  put a fiction in the one place meant to be fact.
- **⚡ STEP 4a's RENDERED SAMPLE WAS FOUR COMPANIES' DOCUMENTS IN ONE LIST, AND THE OWNER WAS SHOWN IT.**
  Found at 4a-test, before any run. **Cascade holds TWELVE documents, not 23.** Twenty-three is the row count of
  `document_index_v` **across every company on staging** — 8 Test Gamma, 12 Cascade, 2 Test Alpha, 1 Step 20 Card
  Walk — which is why 4a's sample had holes in its ids (I9, I11, I16) and why an "Employee Handbook Addendum: Food
  Safety Credentials" and an expired `ACDP 26-0192` appeared in a chemical manufacturer's list. **The packer was
  never wrong:** `document_index_v` is `security_invoker`, the brief reads it as the caller, and asked as the
  signed-in person it returns exactly Cascade's twelve. The sample was taken with the wrong client and the report
  built on it carried the wrong numbers. **Decision 14's own independent measurement said twelve all along.** The
  real figures, as the person: company 367 tokens, index 1,365 (12 lines), readings 10,200 (6 reports) — **11,932
  of 120,000**, not 17,513. *Lesson, and it is the §9a one in a new place: a context sample is measured as the
  person, or it is measuring something no customer will ever see.*
- **⚡ AN INDEX LINE CAN NEVER MATCH A QUOTE, BY CONSTRUCTION.** `lib/ask/passages.ts:79` `normalisedWithMap`
  skips everything between `<` and `>` — so a self-closing `<document .../>` line normalises to the **empty
  string**, and all twelve `I` passages are unquotable. Proved by running it:
  `normalisedWithMap('<document id="I1" document="Emergency Action Plan — Portland Facility" …/>')` returns `""`,
  while a `<report>` block's body normalises fine because it sits outside the tags. **What it costs:** the model
  writes a document's title in quotation marks — which `DOCUMENTS_WHICH_ONE` asks it to name — the plain-quote
  check treats six words in quotes as a quote, finds it in nothing, and the product says *"we could not find these
  words in what we have on file"* **about the title of a document sitting in the list.** Six of 36 runs, in B as
  well as A, so it is the engine's and not this section's. §7 carries the two fixes, and both are the owner's.
- **⚡ AN ANSWER WITH NO SOURCE HAS NOTHING TO CLICK — 1 source across 36 runs.** The Documents prompt never asks
  the model to quote; the Calendar's `CALENDAR_GIVEN` does (*"quote the line it was read from when the exact words
  matter"*) and `DOCUMENTS_GIVEN` has no equivalent. So no quote, so no passage card, so **step 4b's walk — "open
  a cited report from its card" — has nothing to open.** One sentence fixes it and §7 carries it.
- **The chat offers in prose what it has no button for — 18 of 36 runs.** *"I can draft a short service request to
  Rose City Fire Protection"*, *"Want me to write it?"*. `offers` is `[]` so `parseOffers` drops any fenced block,
  which is working as designed; the prose offer is not a block and reaches the person. The owner's open question
  in §7 about whether a Documents chat may offer anything is now a measured one: it already does, and nothing
  happens when the person says yes.
- **The model never searched — `searches=0` in all 39 runs**, with the context and without it. So
  `DOCUMENTS_SEARCH_FIRST` and `AI_SEARCH_MAX_DOCUMENTS` were never exercised, and the narration rule never
  withdrew anything. Worth knowing before anybody reads a search cap as proven.
- **`document_index_v` is migration 073's, not 044's.** `docs/GAPS-PLAN.md` and step 4a's brief both cite 044. The live view carries `correction_count`, `latest_confirmed_at`, `version_confirmed` and a significant-date lateral that 044 never had, and `display_status` now requires `significant_date_kind = 'expiry'` before calling a permit expired. Read it from staging, never from 044.
- **There is no per-document label.** `company_labels` is `(company_id, kind, label)` — the company's own vocabulary. The report route reads it company-wide. So a "which documents does this question name" rule cannot match on labels, and the Documents brief matches title, file name, kind word, agency and subject instead.
- **⚡ A QUOTE FROM AN ATTACHED FILE IS MARKED "we could not find these words in what we have on file" — a quality question for the owner, found at step 3.** The quote check (`lib/ask/passages.ts` `finishAnswer`) checks a quoted passage against `packed.passages`, which a section's brief builds — the calendar's dates, the readings behind them, the audit findings. **An attached document contributes no passages**, so a quote the model took straight out of the PDF can never match one, and the product tells the person it cannot find words that are demonstrably there. Photographed at `shots/step3-bubble.png`. It is not wrong — the check is honest about what it can see — but it reads as a failure. The two ways out are to give the attached document a passage (its extracted text, where there is any — `PENDING.md` D3 says a scanned PDF has none) or to leave a quote alone when a file is carried; **both change what the check does, so both are the owner's** (§3.1).
- **Nothing reads `Brief.words`, and nothing can.** `lib/ask/brief.ts` has a `words` object meant for the screens, but `lib/ask/calendarBrief.ts` imports the engine, which imports `lib/ai.ts` — so any component reading a brief fails `tests/unit/clientImports.test.ts`. Every section's screen words therefore live in a client-safe file and are passed in as props. Harmless today, and a trap for whoever writes the Documents brief at step 4 and reaches for `words`.
- **`loadTopicAttachments`'s cap bites at FIVE files, not four.** It excludes the file attached on this turn, so four files means exactly three carried and nothing omitted. Worth knowing before anybody tests the cap and concludes it is broken.
- **⚡ STAGING TRIALS ARE PARKED AT 2027-01-31 — the owner, 2 November 2026, run by him in Terminal 3.** Eleven of twelve companies; *Step 20 Card Walk* was skipped by the two null guards because it has a real subscription, and `accessFor` gives it `full / subscribed` anyway (`lib/billing.ts:146`–`:153`). The statement is `docs/RELEASE.md` Release C step 5's, word for word, including its reasoning: **an extension, never `subscription_status = 'active'`**, because faking the status would make the Billing tab promise a charge to a company with no card. `check:live`'s billing-mirror question is unaffected — it asks only about companies that HAVE a subscription (`scripts/check-live.js:2041`).
- **The Supabase CLI cannot write to staging through `--linked` AT ALL, whatever flag is passed.** `--yes` is accepted and the database still refuses: *"25006: cannot execute UPDATE in a read-only transaction"*. `supabase db query --help` says why — the `--remote` path needs the `database_write` scope and the token in `.env.local` has `database_read`. So a staging write is the owner's, in Terminal 3, which is where this one went.
- **The Calendar page no longer draws a paused note of its own**, and `tests/unit/readOnlyUi.test.ts` was changed to say so rather than to let a move through. Its two notes were inside the ask view and the conversation drawer; both are shared components now, and the page hands them the verdict. The test's list of files that SHOW the note is written out explicitly instead of being `PAGES` plus three, because those two sets stopped being the same thing.
- **⚡ The Haiku guard could pass while seeing no tiers at all — found and closed at step 1.** `scripts/haiku-names.mjs` reads the `AITask` declaration with one non-global regular expression and takes the FIRST match. Writing that declaration's opening words in a comment higher up the file therefore makes the regex match the comment, and `npm run haiku:check` printed **"0 of 0 tiers on claude-haiku-4-5" and exited 0** — a pass while seeing nothing, which would have let a build run spend Opus money with a green check beside it. It happened for real, while the hazard in the line above was being written up. The guard now refuses an empty list, and the refusal was shown to fail. **So the standing rule is wider than this file first said:** the union stays on one line AND nothing earlier in `lib/ai.ts` quotes its opening words.
- **Two HR tests pinned the night summary's old section list** — `tests/unit/hrAnswer.test.ts:276` and `tests/unit/hrGoLive.test.ts:53` both asserted `const sections = ['workspace', 'hr']`. Neither was in step 1's map, because that map searched `app` and `lib` and not `tests`. Both now assert what they meant — that HR is never left out — rather than that the list is short. **The lesson for every later step: search `tests/` as well as `app/` and `lib/` when a line is being changed.**
- **Supabase CLI 3.0.0 broke two of the project's own scripts, and a third is waiting.** It refuses to run a statement in an agent run unless told the statement only reads, or given `--yes`. `npm run db:migrate` therefore stopped at `db push` with *"Confirmation required… Nothing was changed"*, and `scripts/schema-doc.js` failed on every catalog query. Step 1 fixed schema-doc by passing `--read-only`, which states what that script always was. **`scripts/db-migrate.js` is NOT fixed and is the owner's call**, because that same file is the production path (`npm run db:migrate:prod`) and `CLAUDE.md` §3.7 says the production guard is never automated: any `--yes` there has to be staging-only and deliberate. Until then a staging migration is applied by hand with the staging ref printed. The CLI also deprecates `--linked` and `--project-ref` in favour of `--remote=<ref>`, so every script using them has a rename coming.

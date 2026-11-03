# Closing the gaps — the plan

**Version:** 10 · **Written:** 2 November 2026, by the gaps chat, after the owner's decisions and Claude Code's read-only map (reported in the terminal, 2 November; not a file).
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
| 6b | The page, the recogniser, the merged tab, the routes, the walk | Three tabs through `components/Tabs` (decision 31); the merged Audits tab with its two groups; the box moves to the Ask tab and the command recogniser runs in code before any model call and **requires the word "audit" first** (decisions 32 and 38), writing decision 39's line under the question and creating no conversation row; **the offer's press** (decision 41) with the three lines `lib/ask/offers.ts` needs for it; `components/AskScreen.tsx`'s one `beforeAsk` prop (decision 37); **the two 6a stops in §7 closed first**; `app/api/audits/answer/route.ts` and `app/api/audits/topics/[id]/summarise/route.ts` on the shared body (`lib/ask/summariseRoute.ts`); `?tab=` and the derived-tab rule that keeps every `?run=` link landing where it did; `app/audits/page.tsx:621`'s link removed (decision 35); `PAID_COUNT` 21 → 23; `check:live` probes; the `GATE F7` mark on `components/home/AuditPanel.tsx:1`, which carries only `GATE F4` today; `PENDING.md` F5 and D5 closed. | **The owner's yes on the prompt and the examples first** (6a), **and his answer to the AskScreen question in §7** — the recogniser cannot be built without it. Then the walk: an agency command, a question, a template command with a file, a source card clicked, and the Audits tab photographed against today's two tabs at the same width. | not started |

**Part B — reading every file format**, **Part C — the binder**, **Part D — Resend, Stripe, the gate walk**: written here when Part A is done.

---

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

### ⚡ TWO STOPS 6b CANNOT START WITHOUT — found by step 6a's own runs

**1. `lib/ask/offers.ts` has to learn `run_audit`, and 6a was not allowed to teach it.**
Decision 41 gives this chat one offer. 6a defined the whole of it — the shape, the card's words
(`lib/auditsWords.ts` `runAuditCardWords`) and the code-side check against the company's own agency labels
(`lib/ask/auditsBrief.ts` `checkRunAuditOffer`) — and **measured that the model writes the block: 18 of 18 runs,
15 of them in a shape the code would accept, none naming an agency the company does not hold.** What is missing is
three lines in the shared file, which 6a's own brief put on the stop list:

```ts
export const OFFER_KINDS = ['add_date', 'run_audit'] as const
export interface RunAuditOffer { kind: 'run_audit'; agency: string | null; document_id: string | null }
export type Offer = AddDateOffer | RunAuditOffer
// and, inside parseOffers, a branch that does NOT call findReturned:
if (kind === 'run_audit') {
  const agency = str(o.agency); const document_id = str(o.document_id)
  if (!agency && !document_id) { dropped.badShape++; return '' }
  offers.push({ kind: 'run_audit', agency: agency || null, document_id: document_id || null })
  return ''
}
```
**The `source_url` check must NOT apply to it.** `add_date` carries a date out of a regulation into a customer's
calendar, so "where did this come from" has to be answerable. This offer starts a run over the company's own
documents and there is no web page to verify; demanding a link would drop every valid offer. *Recommended: yes, in
6b, with `auditsBrief.offers` set in the same commit — `tests/unit/auditsBrief.test.ts` fails until both move.*

**2. ⚡ THE ENGINE'S `A` HANDLE COLLIDES WITH A CHECKLIST'S OWN A1–A5 LINE LABELS, AND IT IS SHOWING.**
An auditor's checklist numbers its lines A1…A5, B1…B6, C1…C5. `lib/ask/passages.ts` `ATTACHED_PREFIX` is `'A'`, so
a file attached to the conversation is passage **A1** — and `replacePassageIds` rewrites any bare `A1` in the
answer into that file's name. Measured on question 3, **3 of 3 runs in BOTH variants**: the model wrote *"line
A1"* and the person was shown *"line 12-auditor-checklist-deq-air.docx"*. It is the engine's, not this section's
— Documents has the same exposure the day somebody attaches a lettered checklist. *Recommended: `ATTACHED_PREFIX`
becomes `'AF'`, which `PASSAGE_ID` (`[A-Z]{1,2}\d{1,3}`) already allows and which no checklist labels a line with.
One character, in a shared file, so it is the owner's.*

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

### What step 6's map found (3 November)

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

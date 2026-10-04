# The Compliance Workspace — how it works, end to end

**Written:** 3 October 2026, Workspace feature work, Task 1. **Read-only.** Nothing was changed, fixed
or proposed. Every claim points at `file:line` or a query result; a claim that cannot is labelled
**HYPOTHESIS** with what would settle it.

`page` below means `app/compliance/page.tsx` as at commit `6a1382f`. `chat` means
`app/api/chat/route.ts`. Migrations are under `supabase/migrations/`.

---

## 0. What was read first, and the decision record

- `CLAUDE.md`, `docs/HANDOFF-WORKSPACE.md` (whole), `docs/HANDOFF-CODE.md` §6–§7 (lines 263–364),
  `docs/DESIGN.md` §7 (296–330), `docs/DECISIONS.md` §153 (10784).
- **Decision sections about the workspace, topics, turns, checklists, micro-steps, summaries or fact
  proposals** (heading line in `docs/DECISIONS.md`): §51 (3612), §53 (3673), §68 (4971), §73 (5254),
  §77 (5542), §78 (5722), §85 (6335), §86 (6410), §87 (6500), §89 (6602), §90 (6680), §91 (6779),
  §92 (6870), §96 (7057), §108 (8236), §110 (8396), §111 (8470), §112 (8519), §116 (8658),
  §125 (9307), §126 (9422), §127 (9503), §128 (9765), §129 (9982), §130 (10110), §153 (10784).
  Found by heading search plus a count of the words *workspace, topics, fact_proposal,
  checklist_items, micro-step, substeps, summarise* per section; §51 and §53 were added by hand
  because they govern proposals.
- **`docs/WORKSPACE.md` exists (v8, 21 September) and describes a different machine from the one
  built.** Its banner says *"the conversation model, fact capture, the topic lifecycle and the signup
  classification all shipped as designed"*, but its lifecycle is gate-driven: §6.1 closes topics and
  §6.2 *"Creating a checklist closes the topic"*. Today the gate is off (`chat:291–295`), nothing
  closes a topic (no writer of `topics.status`/`closed_at` exists in `app` or `lib`; the only reader is
  `chat:536–547`, on the gate path), and converting a conversation leaves it open
  (`app/api/checklists/from-topic/route.ts` writes no `topics` column). Its §6.4 "four objects" and
  §7's three surfaces are not built. It is a design record, not a description of the code.

---

## 1. The page's state

All of it lives in the browser. **Nothing in this list is itself saved**; where a value mirrors a row,
the row is named. "Lost on reload" means lost on reload *or* on leaving the page.

| Name | Line | Meaning | Mirrors a row? | Lost on reload |
|---|---|---|---|---|
| `tab` | 122 | Which of the three tabs is shown | No | Yes — always reopens on *Ask a question* |
| `companyId` | 123 | The caller's company, read from `profiles` (235–237) | `profiles.company_id` | Re-read |
| `companyName` | 124 | For the printed drawer header (240–242) | `companies.name` | Re-read |
| `pendingDoc` | 133 | A file attached and not yet asked about: `{id, name}` | The `documents` row exists; **the attachment to a question does not** | **Yes.** The id is gone; the document stays in Documents but is no longer "attached". (The comment at 130–131 means the *route* reloads bytes from storage; the page's hold on the id is not persisted.) |
| `exchanges` | 171 | The conversation on screen: question, answer text, sources, phase, error, file card | Questions/answers mirror `turns` (research path only). **File cards, failed/stopped-early messages and checklist confirmations do not** | Yes; reopening rebuilds Q/A pairs only (586–595) |
| `topicId` | 172 | The open conversation's id | `topics.id` | Yes — a reload starts a new conversation unless one is reopened |
| `box` | 173 | The composer's text | No | Yes |
| `inFlight` (ref) | 174 | The `AbortController` of the request in flight | No | Request is abandoned |
| `busy` | 175 | A question is in flight | No | Yes |
| `nudgeDismissed` | 176 | "Keep going" pressed | No | Yes |
| `bottomRef` (ref) | 177 | Scroll anchor | — | — |
| `composerRef` (ref) | 179 | The textarea, for focus and height | — | — |
| `topics` | 182 | Up to 60 conversations, each with a turn count and one checklist id | `topics`, `turns`, `checklists` | Re-read |
| `checklists` | 183 | Up to 60 checklists with counts | `checklists`, `checklist_items` | Re-read |
| `proposals` | 184 | Up to 20 pending fact proposals; **only `[0]` is shown** (805) | `fact_proposals` | Re-read |
| `summaryDrawer` | 187 | The conversation drawer's topic | `topics` row | Yes |
| `listDrawer` | 188 | The checklist drawer: row + top-level items | `checklists`, `checklist_items` | Yes |
| `scopeFor` | 189 | Topic id the scope sheet is open for | No | Yes |
| `notice` | 190 | The amber banner's sentence | No | Yes (and only then — see 4i) |
| `working` | 191 | The black toast ("Uploading…", "Saving…") | No | Yes |
| `fileInput` (ref) | 193 | The page-level `<input type=file>` (823) | — | — |
| `steps` | 196 | Micro-steps by `${checklistId}-${index}` | `checklist_items` with `parent_item_index` (727–737) | Re-read on open (623–628) |
| `stepsPending` | 197 | Which items show "steps being written…" | No | Yes |
| `stepQueue` (ref) | 198 | Items waiting for micro-steps | No | **Yes — queued, not-yet-started items are dropped** and regenerate on the next open |
| `stepStarted` (ref) | 199 | Keys already queued or running | No | Yes |
| `stepRunning` (ref) | 200 | The queue's three workers are running | No | Yes |

Derived, not state: `started` (202, any exchange exists — **a file card counts**), `proposal` (805),
`answered` (806), `showNudge` (807, four answers), `lastAsked` (810–813).

---

## 2. Every call the page makes

### 2a. Direct Supabase calls (browser client, the caller's session, RLS applies)

| Line | Table / store | Op | Purpose |
|---|---|---|---|
| 235 | `profiles` | select `company_id` | who the caller is |
| 240–241 | `companies` | select `name` | print header |
| 248–251 | `topics` | select, newest 60 | Conversations list |
| 256 | `turns` | count per topic | "cleared" vs "kept" |
| 257 | `checklists` | one id per topic by `from_topic_id` | "Open the checklist" |
| 264–265 | `checklists` | select, newest 60 | Checklists tab |
| 268–269 | `checklist_items` | top-level items per checklist | counts |
| 283–285 | `fact_proposals` | `status='proposed'`, **oldest first**, 20 | the proposal slot |
| 448 | storage `company-documents` (`lib/storage.ts`) | upload to `<company>/compliance/<ts>-<name>` (447) | attach |
| 469–470 | `documents` | select `id, folder_id` by `file_url` | find the row just written |
| 509–512 | `document_index_v` | select by `document_id` | the file card |
| 564–569 | `topics`, `turns`, `checklists` | re-read one topic | after Summarise |
| 615–620 | `checklists`, `checklist_items` | one checklist and all its items | open drawer |
| 652–654 | `checklist_items` | update `completed`, `completed_at` | tick |
| 661–662 | `checklist_items`, `checklists` | **delete** (errors not checked) | delete checklist |
| 727–737 | `checklist_items` | **insert** micro-steps | persist steps |
| 772 | `fact_proposals` | update `status='accepted'` (error not checked) | after Save it |
| 781 | `fact_proposals` | update `status='rejected'` (error not checked) | Not now |
| 995 | `topics` | select `summary` | Wrap up |

**Load cost.** `loadTopics` makes 1 + 2×N reads and `loadChecklists` 1 + N, so a full list is up to
121 + 61 round trips (255–259, 267–278). `loadTopics` reruns after every question (376).

### 2b. Routes

| Page line | Route | File | Method · request → response |
|---|---|---|---|
| 159 | `/api/documents/index` | `app/api/documents/index/route.ts` | GET → `{documents:[…]}` from `document_index_v` (:27–28) |
| 311 | `/api/chat` | `app/api/chat/route.ts` | POST JSON `{question, mode:'research'|'checklist', topicId, history:[{question,answer,sources}], documentId}` → research: NDJSON stream ending `{type:'done', research, sources, topicId, stopReason, outputTokens}` (455–457); checklist: JSON `{outcome:'answer', title, must_do, good_to_have…, topicId}` (398) |
| 454 | `/api/documents` | `app/api/documents/route.ts` | POST `{name, file_url, file_type, file_size, from_topic_id}` → `{success, id}` (131) — the page ignores the id and re-reads by path (467–470) |
| 478 | `/api/document-scan` | `app/api/document-scan/route.ts` | POST `{document_id}` → `{scan_id, status, kind, title, json_parsed, could_not_read}` (117–124) or `{status:'could_not_read', could_not_read:{reason, way_forward}}` (97, 153) |
| 542 | `/api/checklists/from-topic` | same | POST `{topicId, scope}` → `{checklistId, title, scope, from_topic_id, counts}` (164–178) |
| 558 | `/api/topics/:id/summarise` | `app/api/topics/[id]/summarise/route.ts` | POST → `{summary, summary_source:'user'}` (91) |
| 582 | `/api/topics/:id` | `app/api/topics/[id]/route.ts` | GET → `{topic, turns, transcript_cleared, note}` (48–55) |
| 606 | `/api/topics/:id` | same | DELETE → `{deleted, turns_deleted}` (104) |
| 710 | `/api/chat` | as above | POST `{mode:'substeps', question:<built at 714>}` → `{outcome:'answer', data}`; the page reads `data.must_do` (719) |
| 763 | `/api/switches/answer` | `app/api/switches/answer/route.ts` | POST `{switch_id, value}` — **no `entity_id`** → `{written, …, unblocked, obligations}` (138–146) |

### 2c. Per route: tables, client, model, prompt, switches, error strings

**`/api/chat`** — `requireCompany` (117), so `db` is the caller under RLS; `supabaseAdmin` for two
named statements: `bumpCounter` (396, 464; `lib/conversation.ts:177–190`) and `markTurnStopped`
(484; `lib/conversation.ts:126–129`).
- Reads: `documents` + storage (attached file, `lib/attachedDocument.ts:90–98`), `turns` (attachments
  `:177–181`; history `chat:330`), `document_scans`/`document_reviews` (`attachedDocument.ts:144–154`).
  On the gate path only: `topics` (536), `switches` (646), company context.
- Writes (open path, research only): `topics` insert with title (418–421), `turns` (426, 459 via
  `lib/conversation.ts:80`, `:99`), `topics` clocks (`conversation.ts:51–56`), `documents.from_topic_id`
  backfill (434–435), `topics.title` (438). **The checklist branch writes no `topics`, `turns`,
  `checklists` or `checklist_items` row** (368–399).
- Model tier / ledger: research → `prose`, ledger `research` (451–452); checklist → `judgement`, ledger
  `checklist` (376–377); substeps → `substeps`, ledger `substeps` (797–798). maxTokens 16000 on the
  open path, 6000 on substeps.
- Prompt file: `prompts/checklist.ts` — `buildSystemPrompt(mode, scanResult, {open:true})` (362)
  when the mode's `*_LONG_PROMPT` switch is off; `SUBSTEPS_PROMPT` (`prompts/checklist.ts:157`) for
  substeps. The substeps *user* message is written inline in the page (714).
- Switches (`lib/pipelineConfig.ts:40–51`, all default off): `RESEARCH_GATE`, `CHECKLIST_GATE`
  (291–292), `RESEARCH_LONG_PROMPT`, `CHECKLIST_LONG_PROMPT` (361), `RESEARCH_FACTS_BLOCK` (699),
  `CHECKLIST_CRITIC` (753), and inside the prompt `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST`,
  `RESEARCH_PROVENANCE` (`prompts/checklist.ts:330–332`). Env: `AI_MODEL_PROSE`,
  `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS` (`lib/ai.ts:104–112`), `AI_EFFORT` (`lib/ai.ts:711`),
  `DEV_MAX_SEARCHES` outside production (`lib/ai.ts:220–221`).
- Error strings: `lib/auth.ts:80` "Unauthorized", `:109` "Company not found"; 187 "No question or file
  provided"; 239 the file-parse message (multipart only); 382 the AI module's own message; 393 "The
  checklist came back in a shape we could not read. Please try again."; 477 "The answer stopped
  part-way through. Please try again."; 524/540/568 the conversation-lost sentence (77–79); 546 "This
  topic is closed…"; 606 "We could not start this conversation…"; 803 "Something went wrong" with
  `details: String(error)`. Page fallbacks: 338 "That request could not be completed.", 371 "The answer
  could not be completed.", and `lib/answerStream.ts:93`.

**`/api/documents` POST** — caller under RLS. Checks the path prefix (39–41), topic ownership (60–66).
Inserts `documents` with `status 'uploaded'`, `source 'upload'`, `from_topic_id` (98–126). No model.
Errors: "Missing name or file_url" (34), "File path does not belong to your company" (40), "That
conversation was not found." (64), the raw error message (135).

**`/api/document-scan`** — caller for reads and `documents.status` (67, 84, 151); **`supabaseAdmin`
for `saveScan`** (111): `document_scans`, gaps, conditions, deadlines, `fact_proposals` (withdraw
`lib/documentScan.ts:925–928`, insert `:933–957`), labels. Tier `document_scan`, ledger
`document_scan` (`lib/documentScan.ts:623`, `:639`, `:646`). Prompt `prompts/document-scan.ts`.
Env `AI_MODEL_DOCUMENT_SCAN` (falls back to judgement, `lib/ai.ts:120`), `AI_SCAN_STRUCTURED`
(`lib/ai.ts:216`, on unless "false"). Errors 57, 60, 71, 78, and the scan's own `could_not_read`.

**`/api/checklists/from-topic`** — caller under RLS for every read and write: `topics` (69–70),
`turns` (74), `checklists` insert with `from_topic_id` (147–152), `checklist_items` (158); admin only
for `bumpCounter` (161). Tier `judgement`, ledger `convert`, maxTokens 16000 (102–106). Prompts
`prompts/convert.ts` `CONVERT_DISCUSSED` (:35) / `CONVERT_COMPLETE` (:45). Errors 65, 72, 78–79 (409
"…cleared…"), 138 (422 "Nothing in this conversation could be turned into checklist items…"), 182.

**`/api/topics/:id/summarise`** — caller under RLS: `topics` read (48–49), `turns` (53), `topics`
update `summary, summarised_at, summary_source='user'` (84–88) — **not `delete_after`**, no proposals
(header 18–22). Tier `summary`, ledger `summarise`, `prompts/summarise.ts` (74–78). Env
`AI_MODEL_SUMMARY`. Errors 51 (404), 57 (409), 95.

**`/api/topics/:id` GET / DELETE** — GET as caller (33–43). DELETE: ownership read as caller (92), turn
count (98–99), **delete as `supabaseAdmin`** (101) because `authenticated` holds no DELETE on `topics`
(`028_topics.sql:120–121`). Errors "That conversation was not found." (40, 94), 59, 108.

**`/api/switches/answer`** — caller under RLS throughout. Reads `switches` (49–53) and **404s with
`{error:'Not found'}` when the key is not a switch id** (53); 400 *"This question is about one site.
Tell us which one."* for a site-scoped switch with no `entity_id` (60–63); enum check (69–73). Writes
`switch_determinations` (89–97), `company_switches` with `user_locked: true` (101–110), then recomputes
`obligations` via `writeObligations` (125). No model. Error 150 is the raw exception message.

---

## 3. The tables

All from the migrations; **not** re-read from a live catalog in this task.

| Table | Columns the section uses | Written by | `authenticated` holds | RLS |
|---|---|---|---|---|
| `topics` (`028_topics.sql`; clocks `031`) | `id, title, status, summary, summarised_at, summary_source, idle_at, extracted_at, delete_after, last_turn_at, created_at` | chat (insert 418, title 438, clocks via `conversation.ts:51–56`); summarise route (84); nightly job (`jobs/summarise:125–134`); deleter (`jobs/delete:78–79`) | SELECT, INSERT, UPDATE — **no DELETE** (`028:119–121`) | select/insert/update on `company_id = auth_company_id()` (`028:133–145`); no DELETE policy |
| `turns` (`031`; attachment cols `039`) | `topic_id, position, role, text, sources, stopped, document_id, document_name` | chat via `conversation.ts:80`, `:99`; `stopped` by admin (`:127`); deleted by `jobs/delete:73` (admin) | SELECT, INSERT — **no UPDATE, no DELETE** (`031:119–121`) | select/insert own company (`031:127–134`) |
| `checklists` (`000_baseline.sql:131–141`; `from_topic_id` `033:43`; `document_id`, `document_gap_id` `050:48–49`) | `id, title, created_at, from_topic_id` | from-topic (147, caller); `document-checklist:109` and `audit-checklist:57` (admin) | **Full DML incl. DELETE** — baseline `grant all` (`000:760`), only `anon` revoked (`004:399`) | four policies, own company (`004:150–158`) |
| `checklist_items` (`000:105–129`; `company_id` `003`; `origin` `033:25`, CHECK widened `050:59–61`; `source_title` `036:25`) | `name, description, why, source_url, source_title, origin, completed, completed_at, category, sort_order, parent_item_index` | from-topic (158); page micro-steps (727); page tick (652) | **Full DML incl. DELETE** (`000:759`, `004:398`) | four policies (`004:166–174`) |
| `fact_proposals` (`034`; `040`, `041`, `046`, `047`, `051`, `053`, `055`) | `id, switch_key, proposed_value, quote, status, created_at` (page); also `topic_id, document_id, source, entity_id` | nightly job (`jobs/summarise:158`, admin, `source` defaults `'conversation'`); document scan (`documentScan.ts:933`, admin, `source:'document'`); `run-golden-audit.js:820` (fixture) | SELECT, UPDATE — no INSERT, no DELETE (`034:93–100`) | select, update own company (`034:111–119`) |
| `documents` (link columns) | `from_topic_id` (`033:67`, FK SET NULL `033:72–73`) | `/api/documents` (108); backfill `chat:434` | — | — |
| `usage_counters` (`032`) | `questions_answered, checklists_created` | admin via `increment_usage_counter` (`035`) | SELECT only (`032:60–62`) | select own (`032:68–70`) |
| `job_runs` (`034:68–88`; job CHECK `058:261–263`) | one row per run | `lib/jobAuth.ts` `startJobRun` | nothing (`034:103–105`) | enabled, no policies |

**Keys and deletes that shape the flows.**
- `fact_proposals.topic_id` → topics **ON DELETE CASCADE** (`034:21`); `fact_proposals.document_id` →
  documents **ON DELETE CASCADE** (`040:173`).
- `fact_proposals.source` is `'conversation'|'document'`, default `'conversation'` (`040:175–176`), and
  exactly one of `topic_id`, `document_id` is set (`040:184–188`).
- `fact_proposals.status` ∈ proposed, accepted, rejected, withdrawn (`053:139–141`).
- **`fact_proposals.switch_key` has no FK to `switches`** — deliberate, per the comment at `034:22–26`.
  (The pattern `references\s+(public\.)?switches\b` finds real FKs at `008:151`, `008:259`, `017:46`, so
  the check can see one.)
- `checklists.from_topic_id` and `documents.from_topic_id` → topics ON DELETE SET NULL (`033:52–53`,
  `033:72–73`); `turns.document_id` → documents SET NULL (`039:40–41`).
- `checklist_items.checklist_id` → checklists CASCADE (`000:365`). `parent_item_index` is a bare
  integer with no FK or CHECK (`000:120`).

**Scheduled jobs** (`vercel.json`):

| Schedule (UTC) | Path | File | What it changes |
|---|---|---|---|
| `0 3 * * *` (`vercel.json:3`) | `/api/jobs/summarise` | `app/api/jobs/summarise/route.ts` | Topics idle ≥ 24h (39, 53, 58–64) unsummarised, or summarised with newer turns (66–76); skips `summary_source='user'` with no newer turns (82–87). Writes `summary`, `summary_source='nightly'`, `idle_at`, `extracted_at`, `delete_after = now + 7 days` (37, 125–134) and inserts `fact_proposals` (137–160). Admin client throughout. |
| `30 3 * * *` (`vercel.json:4`) | `/api/jobs/delete` | `app/api/jobs/delete/route.ts` | Deletes `turns` for topics with `delete_after < now` (48–49) or **unsummarised** and last turn > 30 days (33, 52–56); clears `delete_after` (78–79). Topic and summary stay. |

Both routes export **only `POST`** (`jobs/summarise:44`, `jobs/delete:35`) and authorise on the header
**`x-cron-secret`** (`lib/jobAuth.ts:33`, `:44`). See H1 in "Facts and hypotheses".

---

## 4. The flows

Each is a numbered chain. "Open path" means the gate switches are off, which is their default
(`lib/pipelineConfig.ts:13–51`) and is not set in `.env.local` (read: no `RESEARCH_GATE` /
`CHECKLIST_GATE` line).

### a. The first question in a new conversation
1. Typed into the box (1036–1037); **Research this** (1116), Enter (1038) or Send (1055) → `ask(box,'research')` (299).
2. Clears the box and the notice (302–303); appends an exchange in `sending` (305).
3. `fetch('/api/chat')` with `topicId:''`, `history:[]`, `documentId: pendingDoc?.id ?? null` (311–326).
4. `chat:117` `requireCompany` → body read (165–176) → no attachment → `priorAttachments=''` (214).
5. Gate off → open path (291–295); no stored history to load (328); messages = the question (358); open system prompt (362).
6. `topics` insert, `title = titleFromQuestion(userQuestion)` (418–421; `lib/conversation.ts:138–141`).
7. `saveUserTurn` position 1 (425–429; `conversation.ts:80–91`), which also clears `idle_at`/`delete_after` and sets `last_turn_at` (`:51–56`).
8. `setTitleIfFirst` — a no-op, the title is already set (438; `conversation.ts:145–147`).
9. Stream: `askAIOpenStream`, tier prose, ledger `research` (450–452); events forwarded (467).
10. On done: `{type:'done', …, topicId}` (455–457); `saveAssistantTurn` (459); `bumpCounter('questions_answered')` as admin (464).
11. Page: `readAnswerStream` (351–355) → `done` → text, sources, `setTopicId` (356–358) → `loadTopics()` (376).
12. Screen: the answer (936), sources (937), the action row under the newest answer (941–953).

**A follow-up.** Same chain with `topicId` set (316) and the client's done exchanges as `history`,
each with its sources (320–321). The route uses the client's history and does not read stored turns
(328). It carries earlier attachments in this topic, research only (220–226). It numbers the turn by
`nextPosition` (425; unique `(topic_id, position)`, `031:66`). The title is not touched (438). After
four answers the nudge appears (806–807, 983).

**Stopped:** Stop (1050 or 928) aborts (380–383); the route's `finally` marks the user turn
`stopped=true` as admin and writes no answer (483–486); the page shows "Stopped." (968–972).

### b. Attaching a file
**Before a question** (first visit):
1. Attach line (1102) → `fileInput.click()` → `onFilePicked` (823–824, 428).
2. Appends nothing yet; toast "Uploading…" (445).
3. Storage upload to `<company>/compliance/<ts>-<name>` (447–448).
4. `POST /api/documents` with `from_topic_id: null` because `topicId` is `''` (454–460) → `documents` row, `status 'uploaded'` (`documents/route.ts:98–126`).
5. Read the row back by `file_url` (469–470).
6. `POST /api/document-scan` (478–482) → scan runs, `saveScan` as admin writes scan, gaps and **`fact_proposals` with `source:'document'`, `topic_id: null`** (`documentScan.ts:933–957`).
7. `setPendingDoc` whether or not the scan read it (489).
8. The file card is appended as an exchange (430–438, 517–526) → **`started` becomes true** (202), so the first-visit line with **Make a checklist** and **Research this** disappears (1097) and the docked composer appears (1043). The **"Asking about ‹name› remove"** line shows (1025–1030).
9. The question: as 4a, with `documentId` (324). The route loads the file (205–206), puts its blocks first (248–259), saves the user turn with `document_id`/`document_name` (426–429), and **backfills `documents.from_topic_id`** where it is still null (433–436).
10. `pendingDoc` is cleared once the response is OK (332).

**During a conversation:** the paperclip (1045) → steps 3–8 with `from_topic_id: topicId` (459). The
next question carries it as in step 9. Every later research turn re-sends up to three of the topic's
attachments as document blocks (`attachedDocument.ts:191–204`; `chat:219–226`).

**Attaching and never asking.** What exists afterwards:
- a storage object at `<company>/compliance/…` (448);
- a `documents` row, `from_topic_id` null (attached before) or the topic id (attached during) (454–460);
- the scan's rows and any **document-sourced `fact_proposals`**, `topic_id` null (`documentScan.ts:933–957`);
- **no `turns` row** references it, so the conversation carries no record of it.

The file card and `pendingDoc` exist only in page state and are gone on reload. The document is
listed in Documents, and its proposals reach the workspace's proposal slot (4g).

### c. Arriving from Documents' "Research this"
1. `components/DocumentReport.tsx:737–739`: `window.location.href = /compliance?ask=<gap title. fix>&document=<id>`.
2. Page effect (151–168): `setBox(ask)` (156); `GET /api/documents/index` (159); finds the row by `document_id` (162); `setPendingDoc({id, name})` (163). If the request fails or the row is not found, **nothing is said** (160, 163).
3. `replaceState` drops the parameters (167).
4. Screen: the box holds the gap; "Asking about ‹name›" above it (1025–1030). Nothing is sent.
5. On **Research this**: as 4a with `documentId`. That document was uploaded through Documents, so `from_topic_id` is null, and **the route sets it to this conversation** (433–436).

### d. Checklists
**"Make a checklist" from the box** (first visit only, 1109–1113):
1. `ask(box,'checklist')` (1110, 299) → `POST /api/chat` with `mode:'checklist'` (316).
2. Route, open path (295): checklist branch (368) → `askAIOpenStream`, tier judgement, ledger `checklist` (370–377) → parse (387) → `bumpCounter('checklists_created')` (396) → `{outcome:'answer', …data, topicId: null}` (398).
3. **No `topics`, `turns`, `checklists` or `checklist_items` row is written** on this branch (368–399). Searching for `from('checklists')` and `from('checklist_items')` finds inserts only at `from-topic:147/158`, `audit-checklist:57/76`, `document-checklist:109/124` and page 727 (micro-steps). The search does find inserts, so it can see one.
4. Page: not NDJSON (335) → `topicId` absent, so not set (341) → the exchange reads **"‹title› — saved to your checklists."** (342) → `loadChecklists()` (343) finds nothing new.
5. The previous page did save it: `git show a5587af^:app/compliance/page.tsx` line 451 inserted `checklist_items` (and read/wrote `checklists` at 332–471). Commit `a5587af` ("Run 3: the page, rebuilt from the prototype") removed that insert.

**"Turn this into a checklist"** (943, only under the newest done answer with a `topicId`, 941):
1. Opens the scope sheet (943, 1410–1424).
2. Either choice → `convert(scope)` (1413/1418, 536) → `POST /api/checklists/from-topic {topicId, scope}` (542–546).
3. Route: topic (69–72) → turns (74; 409 if cleared, 75–81) → cited URLs from stored `turns.sources` (86–93) → model (102–106) → enforcement (108–135):
   - **`discussed`**: an item whose `source_url` is not one the conversation cited is dropped (118); every kept item is `origin:'conversation'` (120).
   - **`complete`**: nothing dropped; `origin` is `'conversation'` when its URL was cited or the model said so, otherwise `'added'` (120–121).
4. Insert `checklists` (title suffixed "— as discussed" / "— complete", 144–145; `from_topic_id`, 147–152) and `checklist_items` (155–159), as the caller. Counter (161).
5. Page: `loadChecklists` (549) → `openChecklist(checklistId)` (550) → drawer (1329).
6. On failure: `setNotice(j.error ?? …)` (548).

**Micro-steps.**
- **When they generate:** whenever a checklist drawer opens (614 → 639), for each top-level item with no stored steps, no in-memory steps and not already started (688–694). This applies to *any* checklist on the tab, including those made from a Documents gap or an Audit.
- **The cap in flight:** `MAX_STEPS_IN_FLIGHT = 3` (77), three workers draining one queue (701–755).
- **Each step is a `POST /api/chat`** `{mode:'substeps'}` with a user message composed at 714 → route 797–799, tier `substeps`, ledger `substeps`.
- **Where they are stored:** `checklist_items` rows with `parent_item_index = <the item's position among the top-level items>` and the parent's `source_url`, `source_title`, `origin`, `category` (727–737). They are read back by `openChecklist` (623–628).
- **Failures:** a failed write, or a failure in the call, removes the key from `stepStarted` so the next open retries (740–747). A failed call writes nothing.
- **Closing the drawer does not stop the queue** — nothing in `setListDrawer(null)` touches `stepQueue`.
- **Leaving the page drops anything still queued** (refs, 198–200).

### e. Summaries and clearing
**"Summarise this"** (946) → `summarise(topicId)` (554):
1. `POST /api/topics/:id/summarise` (558) → route reads turns (53) and calls `prompts/summarise.ts`, tier `summary` (74–78).
2. Update `summary`, `summarised_at`, `summary_source='user'` (84–88). **No `delete_after`, no proposals** (18–22).
3. Page: `loadTopics` (563); re-read the topic and open the summary drawer (564–573). Failure → notice (555, 562).

**The nightly summary:** §3's table. The proposals it writes carry `topic_id` and `from_turn_id` and
use free `key` names (`jobs/summarise:139–155`; `prompts/summarise.ts:41`, *"a short snake_case name
for the fact, e.g. employee_count or has_forklifts"*). The job does not pass the `switches` list to
the model: its input is the title plus the transcript (112–117).

**"Wrap up and start fresh"** (991–1000, shown after four answers):
1. `await summarise(t)` → as above.
2. Read `topics.summary` (995) → `newConversation(summary)` (385–392).
3. That stops any request, clears the exchanges and `topicId`, **puts *"Carrying on from the last conversation.\n\nSummary so far: ‹summary›\n\n"* into the box**, and switches to Ask.
4. Nothing is sent. When the person sends, that text is the first question, so **the new topic's title is *"Carrying on from the last conversation. Summary so far: …"*** (`chat:420`, `conversation.ts:138–141`, truncated at 200).

**The 7-day clearing:** §3's table. **A topic summarised by hand and never spoken to again is cleared
by neither job:**
- the summarise route sets no `delete_after` (summarise route 84–88);
- the nightly job skips it (`jobs/summarise:84–87`);
- the deleter's backstop takes only unsummarised topics (`jobs/delete:54`).

The status line reads *"Summarised · full conversation kept"* (`lib/conversationStatus.ts:47–50`),
while the Conversations tab says *"The full back-and-forth is cleared 7 days after a conversation is
summarised"* (1153–1154).

### f. Opening a conversation from the list
1. A row (1204) → `setSummaryDrawer(t)` → drawer (1288–1327): the summary, or "hasn't been summarised yet" (1312–1319); the cleared note when summarised with no turns (1320–1325).
2. **Open the conversation** shows only while turns exist (1296–1300) → `openConversation` (579) → `GET /api/topics/:id` (582).
3. Rebuild Q/A pairs from user/assistant turns; a stopped turn shows as `stopped` (586–595). `setTopicId`, close the drawer, Ask tab (596–600).
4. **An attached document on reopening:** the rebuilt exchanges carry no `file`, so **no file card and no document name is shown** (590–594 ignores `document_id`/`document_name`, though `loadTurns` returns them, `conversation.ts:156`). `pendingDoc` is untouched. The next research question re-sends up to three of the topic's attachments to the model (`chat:220–226`), so the model sees the file that the screen does not show.
5. The notice is not cleared by opening (579–602).

### g. Fact proposals
**Every source that writes one:**
- `app/api/jobs/summarise/route.ts:158` — admin; `topic_id`, `from_turn_id`, `source` default `'conversation'`.
- `lib/documentScan.ts:933–957` — `saveScan`, admin (called with `supabaseAdmin` from `document-scan/route.ts:111`, and from the sweep); `source:'document'`, `document_id`, `locator`, `basis`, `affects`, `quote_verified`, `as_of`, `entity_id`; **key is `f.key` from the model, or `'unnamed_fact'`** (`documentScan.ts:340`). The prompt shows the keys already in use and asks the model to reuse them, otherwise to add a new snake_case key (`prompts/document-scan.ts:137–142`, `:245`). It is not given the `switches` list.
- `scripts/run-golden-audit.js:820` — fixture only.
- `authenticated` cannot insert (`034:93–100`).

**How the page lists them:** `status = 'proposed'`, **no filter on `source`**, ordered `created_at`
ascending, limit 20 (283–286). It shows only the first (805), on the **Conversations** tab only
(1161), always headed **"One thing from a recent conversation."** (1164), with the key's underscores
turned into spaces (1165).

**"Save it"** → `POST /api/switches/answer {switch_id: switch_key, value: proposed_value}` (763–766).
- It can accept **only a key that is an `id` in `switches`** (route 49–53, else 404 `Not found`).
- For such a key, only a **company-scoped** switch, because the page sends no `entity_id` (765), and a site-scoped switch returns 400 (60–63).
- An enum switch also needs a value in `allowed_values` (69–73).
- On any non-OK response the page shows the route's `error` in the notice (767–770). So a 404 shows **"Not found"**.
- On OK it marks the proposal `accepted` with the caller's client (772) — `authenticated` holds UPDATE (`034:100`, policy `:116–119`).

**"Not now"** → `update status='rejected'` (781), no reason recorded; the error is not checked.

**How Documents confirms the same kind of fact:**
- **Company information / To confirm:** `POST /api/to-confirm` (`app/api/to-confirm/route.ts:229`) settles a **key** across all its pending proposals (260–264).
  - If the key is a switch, it calls the same `/api/switches/answer` (307–322), also without `entity_id`.
  - Otherwise it writes **`company_facts`** (333–369).
  - It then marks the proposals accepted as admin (329, 371). Rejecting requires a reason (246–248).
- **The report drawer:** `app/api/document-actions/route.ts:103–117` sets `status` as admin, one proposal at a time. Its comment at 118–119 says an accepted fact "changes state here and nothing else reads it yet".

**Can one proposal show in both places?** Yes.
- To confirm lists every `status='proposed'` row of the company, both sources (`to-confirm:74–76`).
- The workspace lists the same set (283–285).
- So the oldest pending proposal — of either source — appears on the workspace's Conversations tab and in the To confirm queue.

### h. Deleting
**A conversation** (1216 → `deleteConversation`, 604):
1. The browser's `confirm()` names the summary and messages (605).
2. `DELETE /api/topics/:id` → admin delete of the topic row (101).

| Goes | Stays |
|---|---|
| The `topics` row | Documents attached in it (`documents.from_topic_id` → **SET NULL**, `033:72–73`) |
| Its `turns` (cascade, `031_turns_and_topic_lifecycle.sql:36`) | Checklists converted from it (`checklists.from_topic_id` → SET NULL, `033:52–53`) and their items |
| **Its conversation-sourced `fact_proposals`, including accepted and rejected ones** (`034:21` cascade) | Document-sourced proposals; any `company_switches` row already saved from a proposal |

3. Page: clear the screen if it was the open one (608), close the drawer, reload topics (609–610). Failure → notice (607).

**A checklist** (1258 or the drawer's Delete, 1337 → `deleteChecklist`, 658):
1. `confirm()` (660).
2. Delete its items, then the checklist, as the caller (661–662) — `authenticated` holds DELETE (`000:759–760`, policies `004:157`, `004:173`). Errors are not checked.

What goes and what stays:
- **Goes:** every item and every micro-step. This includes checklists made from a Documents gap; the gap's "checklist made … n of m done" line in the report (`DocumentReport.tsx:699–703`) then has no row to show.
- **Stays:** the topic, the documents and the proposals.

### i. The notice banner
**Rendered** above the tabs' content, outside every `tab ===` block (904–909), so it shows on all three tabs.

**Every `setNotice` with text:**
- 548 — convert failed
- 555 — summarise with no topic
- 562 — summarise failed
- 584 — open conversation failed
- 607 — delete conversation failed
- 616 — checklist not found
- 769 — Save it refused (the route's `error`, or "We could not save that one — it may not match a fact we track yet. Nothing was changed.")

**Every place it clears:**
- 303 — at the start of any `ask()`, which happens only on the Ask tab;
- 907 — Dismiss.

`setTab` (889), `newConversation` (385–392) and `openConversation` (579–602) do not clear it. The
upload path never uses the notice; its failures go in the file card (424–426).

### j. How a conversation gets its title
1. On the open path, at topic creation: `titleFromQuestion(userQuestion)` (`chat:420`). It collapses whitespace, trims, and cuts to 197 characters plus "…" past 200 (`conversation.ts:138–141`). **It removes no leading character.**
2. `userQuestion = question.trim()` (`chat:179`). The page sends `q = question.trim()` (300), which is the box (1038/1055/1116).
3. `setTitleIfFirst` rewrites only an empty title or the literal "New conversation" (`conversation.ts:144–150`). Nothing writes "New conversation" today.
4. No summariser writes `title` (`jobs/summarise:125–134`, summarise route 84–88).
5. Gate path only (off): `topicTitle(frame.subject, …)` (`chat:92–95`, 601).
6. On screen: `t.title ?? 'Untitled conversation'` (1205); the drawer uses `?? 'Conversation'` (1289).

**So the stored title is the first turn's text, verbatim** (both from `userQuestion`, 420 and 426).

---

## 5. The links to other sections

| From → to | Where | What it does |
|---|---|---|
| Documents → workspace, "Research this" | `components/DocumentReport.tsx:737–739` | `?ask=` + `?document=`; page 151–168 |
| Documents → workspace, a gap's checklist | `DocumentReport.tsx:701`, `:760` | `/compliance?checklist=<id>` — **the page reads only `ask` and `document`** (152–154); nothing opens. Listed in `HANDOFF-CODE.md` §7 |
| Documents → checklists | `app/api/document-checklist/route.ts:109–124` (admin), `documentScan.ts:800–851` (re-links on re-scan) | Checklists with `document_id`/`document_gap_id`, no `from_topic_id`. **They appear on the workspace's Checklists tab** (264–265 has no filter) and get micro-steps when opened |
| Documents report reads checklists | `app/api/documents/report/route.ts:56` | Its gap lines show "n of m done" (`DocumentReport.tsx:699–703`) |
| Workspace → Documents, file card | page 1505–1506 | Text "Saved to Documents → ‹folder›" — **no link**, no document id kept in the card (48–53) |
| Workspace → `documents.from_topic_id` | `documents/route.ts:108`; `chat:434–435` | **Written, never read.** Searching `from_topic_id` across `app components lib scripts supabase/migrations` finds writers, the `checklists` column's readers, and the migration. No query reads `documents.from_topic_id`, and `document_index_v` does not carry it (the column appears in no migration after `033`) |
| Audits → workspace | `app/audits/page.tsx:535` | A plain `href="/compliance"`; the typed question is not carried (`HANDOFF-CODE.md` §7) |
| Workspace → facts & switches | page 763 → `/api/switches/answer` | Writes `switch_determinations`, `company_switches`, recomputes `obligations` (the only path from this page into Requirements) |
| Company information / To confirm ↔ workspace | `app/api/to-confirm/route.ts:74`, `app/api/company-information/route.ts:78`, `components/AppLayout.tsx` (sidebar badge) | Read the same `fact_proposals` pool; `lib/companyContext.ts:356–363` feeds pending and accepted keys to the next document scan |
| Requirements | — | The page reads no `requirement_templates`, `obligations` or `company_switches` (file header 17–19; grep of page: only the word "requirements" at 1168) |
| Dashboard | `app/dashboard/page.tsx:87`, `:99–100` | Counts **questions answered = checklists with `research_answer`**, which nothing writes (only reader and types reference it), so it counts none of the workspace's answers. **Checklists created** counts every checklist row, including Documents' and Audits'. `usage_counters`, which the workspace does bump, is read by no page (only `app/api/account/route.ts:199`, `:382`) |
| Account deletion / export | `app/api/account/route.ts:196–200`, `:361–364`, `:382`; `app/api/account/export/route.ts:84`, `:104` | Delete and export cover topics, turns, checklists, items, proposals, counters |
| Sidebar | `components/AppLayout.tsx:28` | The nav link |

---

## 6. What it costs

**Ledger read.** A read-only select of `ai_calls` on **staging**: host `amzsavsrabrlcprltpom`, not the
production ref `dsfwma…`; service-role key from `.env.local`; script in the scratchpad, deleted after.

```js
db.from('ai_calls').select('task, model, cost_usd, created_at').order('created_at')
```

It returned 159 rows, the same count `npm run cost` printed. **Every row is `claude-haiku-4-5` and
dated 1–3 October**, so the ledger holds no Opus/Sonnet history and nothing before 1 October.
`HANDOFF-CODE.md` §6 quotes 78 earlier rows that are no longer there; that staging was reset is a
hypothesis.

| Action | Route → ledger task | Tier → `.env.local` | Rows | Median | Worst |
|---|---|---|---|---|---|
| Research this / Send | `/api/chat` → `research` | prose → `claude-haiku-4-5` | 69 | $0.0214 | $0.0623 |
| Make a checklist (box) | `/api/chat` → `checklist` | judgement → `claude-haiku-4-5` | 9 | $0.0464 | $0.0506 |
| Turn into a checklist | `/api/checklists/from-topic` → `convert` | judgement → `claude-haiku-4-5` | 14 | $0.0030 | $0.0063 |
| Micro-steps, per item | `/api/chat` substeps → `substeps` | substeps → `claude-haiku-4-5` | 1 | $0.0084 | $0.0084 |
| Summarise this / Wrap up / nightly | summarise route, `jobs/summarise` → `summarise` (one task for both) | summary → `claude-haiku-4-5` | 6 | $0.0010 | $0.0011 |
| Attach a file (scan) | `/api/document-scan` → `document_scan` | `AI_MODEL_DOCUMENT_SCAN` unset locally → judgement → `claude-haiku-4-5` | 11 | $0.0717 | $0.1250 |
| Save it / Not now / delete / open / tick | — | no model | — | — | — |

**Reading the table:**
- Rows are not split by caller. `check:live` also writes `research`, `checklist`, `convert` and `summarise` rows (see §7), so these medians are staging traffic, not the page alone.
- A checklist made from the box costs a `checklist` call **and saves nothing** (4d).
- One opened checklist of *n* items costs *n* `substeps` calls, once.
- On production, `RELEASE.md`:
  - names `AI_MODEL_JUDGEMENT = claude-opus-5` (`docs/RELEASE.md:86`) and `AI_MODEL_DOCUMENT_SCAN = claude-opus-5-5` (`:84`);
  - lists `AI_MODEL_PROSE`, `AI_MODEL_SUBSTEPS` and `AI_MODEL_SUMMARY` as added on 23 September **without values** (`:77`).
- So the production model for research, micro-steps and summaries is not knowable from the repository. No production cost was read.

**Totals:** `npm run cost` before this task, **$3.31, 159 calls** (`2026-10-01T15:33:40` to
`2026-10-03T17:51:23`). The after reading is in the terminal report.

---

## 7. What tests cover it

**Unit** (`node --test tests/unit/*.test.ts`, via `scripts/test-guard.js:67`, `:76`):

| File | Lines | Covers |
|---|---|---|
| `tests/unit/attachedDocument.test.ts` | :38, :70, :81, :92 | `describeAttachments` and the carry cap |
| `tests/unit/answerStream.test.ts` | :17, :43, :65, :70, :80, :119 | stream outcomes |
| `tests/unit/historySources.test.ts` | :18, :44, :57 | sources appended to history |
| `tests/unit/conversationStatus.test.ts` | :16, :35, :48, :56, :64, :73 | status labels, progress, dates |
| `tests/unit/preferGov.test.ts` :38/:62/:90; `researchProvenance.test.ts` :27/:54/:85/:110; `researchSpecialist.test.ts` :79 | | prompt text of `prompts/checklist.ts` |
| `tests/unit/turnSigning.test.ts` | :28–116 | gate path only |

- **No unit test imports** `lib/conversation.ts`, `prompts/convert.ts`, `prompts/summarise.ts`, any route, or the page.

**`scripts/check-live.js`** (real routes, real model). Each step and what it checks:

| Step | Lines | Checks |
|---|---|---|
| research | 263–289 | an answer comes back |
| checklist | 295–308 | **shape only** — `must_do` exists; not that anything was saved |
| conversation | 336–345 | 2 turns saved |
| reload | 348–351 | prints the title, does not assert it |
| continue | 352–362 | follow-up on a reopened topic |
| counters | 369–370 | |
| stop | 375–388 | |
| convert, both scopes | 396–415 | |
| sources | 420–498 | |
| attachment | 550–637, 713–731 | attach then a **first** question only |
| topic GET | 742–746 | |
| summarise | 748–756 | `summary_source='user'` |
| topic DELETE | 760–774 | |
| history | 776–797 | |

- Nothing in it touches micro-steps, `fact_proposals`, `/api/switches/answer`, `/api/jobs/*`, or deleting a checklist.

**Golden sets:**
- `scripts/golden-facts.js` covers research prompt quality (`:144`), calling the model directly.
- `scripts/run-golden-docs.js` covers the scan, and so document-sourced proposals (`:52`, `:87`).
- **None covers the box checklist, convert, summarise, micro-steps, or conversation proposal extraction.**

**`docs/TESTING.md` manual sets:**
- Workspace layout WL-1…WL-10 (160–184). **WL-9, the proposal, is "not yet seen"** (181).
- Layout pass A1–D2 (421–480).
- Fix Round 2 R2-1/R2-2 (484–504).
- Fix Round 1 F1–F4 (508–523).
- R3 finish line 1–10 (547–573).
- R2 nightly / deleter / convert (586–624).
- R1 including micro-steps (628–666).
- Documents Run 5 #5 "Research this" (1987); Documents Run 6 #2 (2086).
- **No workspace set carries a "run by a person" result.** Lines 457 and 573 record that some cases were "checked against the new screen 3 October and still true as written".
- `scripts/measure-layout.mjs` measures layout only.

**Flows from part 4 that nothing tests** (no automated test, and no manual case run by a person):
- **4b**: attach during a conversation; attach and never ask.
- **4c**: arriving with `?ask=&document=`.
- **4d**:
  - that "Make a checklist" from the box *saves* anything;
  - micro-steps generation and persistence.
- **4e**: the nightly summary, Wrap up and start fresh, the 7-day clearing and the backstop.
- **4f**: reopening a conversation with an attachment.
- **4g**: Save it, Not now, and a proposal shown in two places.
- **4h**: deleting a checklist.
- **4i**: the notice banner.
- **4j**: the title.

The coverage map was compiled by a read-only helper; its key lines (`check-live.js:295–308`, :336–351;
`TESTING.md` 160, 177, 181, 457, 494, 504, 565, 573, 609, 616, 658, 665) were re-read here.

---

## 8. The defects, known and new

Each: what a person sees · the chain · FACT or HYPOTHESIS · other sections touched.

### The four `HANDOFF-CODE.md` §7 rows for the workspace (added 3 October)
**K1. `/compliance?checklist=<id>` opens nothing.**
- **Sees:** a link in a Documents report lands on the empty Ask tab.
- **Chain:** `DocumentReport.tsx:701`, `:760` → page 151–155 reads only `ask`/`document` and returns.
- **FACT.**
- **Touches:** Documents.

**K2. The Audits box's typed question is not carried.**
- **Sees:** the box is empty after the link.
- **Chain:** `app/audits/page.tsx:535` plain href.
- **FACT.**
- **Touches:** Audits.

**K3. The failed line can show a raw provider message, and messages end with two instructions.**
- **Sees:** a provider's own wording, then "You can ask again, or rephrase the question." (975).
- **Chain:** `chat:382` ← `lib/ai.ts` stream error; `chat:803` "Something went wrong" (+`details`).
- **FACT.**
- **Touches:** every page using `/api/chat`.

**K4. `conversation_reset` is sent and read by no page.**
- **Sees:** "start fresh" is suggested but the screen keeps the old conversation.
- **Chain:** `chat:82`; the page never reads it (search of the page for `conversation_reset` finds nothing; the route line proves the term is spelled that way).
- **FACT.**
- **Touches:** none beyond.

`HANDOFF-CODE.md` §7 also carries two older workspace rows, unchanged here: citations on a third turn
(`prompts/checklist.ts` `PROVENANCE_SENTENCE`) and re-sending attachments on every turn
(`lib/attachedDocument.ts`, `MAX_CARRIED_DOCUMENTS = 3`).

### Seen by the owner on the live site, 3 October

**(i) "Save it" shows "Not found."** Chat's reading is **CONFIRMED BY CODE**; whether *this* proposal
was a document's is settled in part 9.
- **Chain:** page 763–766 posts `switch_id: p.switch_key` → `switches/answer:49–53` returns 404 `{error:'Not found'}` when the key is not a `switches.id` → page 767–769 puts `j.error` in the notice, i.e. "Not found".
- **Keys are free text from both writers:**
  - the scan keeps the model's key or `'unnamed_fact'` (`documentScan.ts:340`, inserted at `:933–935` — the brief's ":933" is the insert);
  - the nightly job takes the model's `key` too (`jobs/summarise:150`);
  - neither prompt is given the `switches` list (`prompts/document-scan.ts:137–142`; `jobs/summarise:112–117`);
  - no FK constrains it (`034:22–26`).
- **Two further refusals the brief did not name:**
  - a **site-scoped** switch key returns 400 "This question is about one site. Tell us which one." because the page sends no `entity_id` (765; route 60–63) — 73 of 95 switches are site-scoped (`CLAUDE.md` §1);
  - an enum value outside `allowed_values` returns 400 (69–73).
- So "Save it" can succeed only for a company-scoped switch with a valid value.
- **A key Documents would accept goes nowhere from here.** Company information / To confirm writes a non-switch key to `company_facts` (`to-confirm:333–372`).
- **Touches:**
  - Documents / Company information (same rows, different outcome);
  - Requirements (the switch write recomputes obligations);
  - `to-confirm:315–322`, which also omits `entity_id`, so a site-scoped switch key is refused there too.

**(ii) "One thing from a recent conversation" for a fact read from a document.**
- **Chain:** the list query has no `source` filter (283–285); the heading is a fixed string (1164). The quote is shown, but no document name or link (1167).
- **FACT.**
- **Touches:** Documents (its proposals surface here with the wrong origin).

**(iii) The notice banner stays across tabs until Dismiss.**
- **Chain:** rendered outside the tab blocks (904–909); cleared only at 303 and 907; `setTab` (889) does not clear it.
- **FACT.**
- **Touches:** none beyond the page.

**(iv) The file card says "Saved to Documents" with no link.**
- **Chain:** `FileCard` renders text only (1505–1506). The card's `file` object has no document id (48–53), though `doc.id` is known at 469–489.
- **FACT.**
- **Touches:** Documents (no way to reach the report drawer from here).

**(v) A title reads "'m opening a second restaurant…".**
- **What the code does:** it cannot drop a leading character (4j).
  - The title and the first user turn come from the same `userQuestion` (`chat:420`, `:426`).
  - `titleFromQuestion` only collapses whitespace and truncates (`conversation.ts:138–141`).
- **HYPOTHESIS:** the text arrived at the route already missing its first character(s) — i.e. the first turn reads the same. Part 9 settles it: the stored title beside the first turn's text.
  - If they **match**, the loss is upstream of the route: the box or the keyboard.
  - If they **differ**, something else wrote the title, and nothing in the repository does.
- **Touches:** Conversations list, summary drawer, To confirm's source title (`to-confirm:87`, `:155`).

### New, found by this read

**N1. "Make a checklist" from the box saves nothing, and says it did.**
- **Sees:** "‹title› — saved to your checklists."; the Checklists tab does not gain it, and no conversation is created.
- **Chain:** 4d steps 1–5.
- **FACT** (code and git history; not run).
- The call is paid (ledger `checklist`), and `usage_counters.checklists_created` is bumped (`chat:396`) for a checklist that does not exist.
- **Touches:** Dashboard ("Checklists created" counts rows, so it is unaffected; the usage counter is wrong); `check:live`'s checklist step passes because it checks shape only.

**N2. A hand-made summary stops the 7-day clearing for good.**
- **Chain:** 4e — the route sets no `delete_after`; the nightly job skips the topic; the backstop excludes summarised topics.
- **FACT** (code).
- **Sees:** "Summarised · full conversation kept" indefinitely, against the retention line at 1153–1154.
- **Touches:** the retention promise; the account and export routes (more data kept than said).

**N3. "Wrap up and start fresh" titles the next conversation "Carrying on from the last conversation…".**
- **Chain:** 4e "Wrap up" 1–4.
- **FACT** (code).
- **Touches:** Conversations list.

**N4. Attaching first removes "Make a checklist".**
- **Chain:** the file card is an exchange, so `started` turns true (202) and the first-visit line (1097) goes.
- **FACT.**
- **Touches:** none beyond.

**N5. Reopening a conversation hides its attachments.**
- **Chain:** 4f step 4.
- **FACT.**
- **Touches:** the model still receives them (`chat:220–226`), so an answer can refer to a file the screen does not show.

**N6. "Research this" from Documents rewrites `documents.from_topic_id`.**
- A document uploaded in Documents gets the id of the first conversation that asked about it (`chat:433–436`).
- **FACT.**
- No reader exists today, so nothing shows it (part 5).
- **Touches:** Documents, if it ever reads the column as "came in from".

**N7. Deleting a conversation deletes its conversation-sourced proposals, accepted and rejected included.**
- **Chain:** `034:21` cascade; `topics/[id]:101`.
- **FACT.**
- This contradicts the reasoning at `034:97–98` ("rejecting is a status, not a disappearance").
- **Touches:** To confirm / Company information, and the history of a saved switch value, whose `company_switches` row stays.

**N8. Silent failures on the page.**
- Unchecked: the checklist delete (661–662), the proposal updates (772, 781) and the tick (652–654).
- Nothing is said when `?document=` finds no row (160–163).
- `/api/documents` returns `id` (131), but the page's comment says it does not (467–468) and re-reads by path.
- **FACT.**
- **Touches:** none beyond.

**N9. Micro-steps are bought for checklists the workspace did not make.**
- Opening any Documents- or Audits-made checklist from the tab generates steps (4d).
- **FACT** (code); the cost is per item.
- **Touches:** Documents, Audits (their checklists change shape after being opened here).

**N10. The proposal slot shows the oldest pending proposal, one at a time, from up to 20 read.**
- **Chain:** 283–286, 805.
- **FACT.** It is not wrong by itself; it is listed because it decides which proposal (i) and (ii) were about.

**H1. The nightly jobs may never be triggered by Vercel Cron.** **HYPOTHESIS.**
- Both routes export only `POST` (`jobs/summarise:44`, `jobs/delete:35`) and check `x-cron-secret` (`lib/jobAuth.ts:33`).
- **My understanding of Vercel Cron, which this repository cannot confirm:** it invokes the path with **GET** and sends `Authorization: Bearer <CRON_SECRET>`.
- **If so:** every scheduled call gets 405 or 404, no summary is written overnight, no proposal comes from a conversation, and nothing is ever cleared. Only document-sourced proposals would exist, which fits (i) and (ii).
- `docs/TESTING.md:2505–2510` fires the sweep by hand with `POST` and the header, which proves the route, not the trigger. `STATUS.md:237` marks the jobs working on 23 September without saying how they were triggered.
- **Settled by:**
  - any `topics.summary_source = 'nightly'` on production (part 9 reads the owner's);
  - production `job_runs` rows with `job` in (`summarise`, `delete`) — not company-scoped, so not read here;
  - the Vercel dashboard's cron log.
- **Touches:** every section that runs on cron: `scan-documents` and `audit-sections` share the trigger (`vercel.json:5–6`) — though uploads kick sweeps directly, per `HANDOFF-CODE.md:486–497`, so those may run by another door.

**Seen in passing, outside the workspace.**
- `lib/ai.ts:104` and `:106` default `judgement` and `prose` to `claude-sonnet-4-5`.
- `CLAUDE.md` §3.4a says the code defaults are Opus 5 and Sonnet 5.
- **FACT; not investigated.**

---

## 9. The owner's live account — production, read-only

Read on 3 October 2026 for `BhaskarC@compliboard.com`. Every statement is a `SELECT`, run through
`npx supabase db query --project-ref <SUPABASE_PROD_REF> --linked`. That is the Supabase CLI's own DB
connection (superuser), **not** the service role. The target ref was printed first: `dsfwma…`.
Everything after the first query is scoped to the company it returned.

```
SQL> select p.id as profile_id, p.company_id, c.name as company from public.profiles p
       join auth.users u on u.id = p.id left join public.companies c on c.id = p.company_id
      where lower(u.email) = lower('BhaskarC@compliboard.com')
 c2b9842b-84fa-4d9c-bb70-fc66d16b394d | 739a428f-1a0a-4531-8204-92ce75e4f878 | CB-Test-3
```

**Pending proposals, and whether each key is a switch:**
```
SQL> select fp.id, fp.source, fp.switch_key, fp.proposed_value, fp.document_id, fp.topic_id, fp.created_at,
            exists (select 1 from public.switches s where s.id = fp.switch_key) as key_is_a_switch
       from public.fact_proposals fp
      where fp.company_id = '739a428f-…' and fp.status = 'proposed' order by fp.created_at
 2c3d9176-… | document | powered_industrial_trucks_on_site | Yes – at least one propane forklift, Toyota 8FGU25, unit FL-2 | doc ab1a30d3-… | topic NULL | 2026-10-03 18:35:34 | false
 6006a05d-… | document | legal_entity_on_documents         | Evergreen Botanicals, LLC. This does not match CB-Test-3 or Willamette Valley Foods, Inc. | doc ca06b595-… | topic NULL | 2026-10-03 20:43:18 | false
```

**Topics since 23 September:**
```
SQL> select id, title, created_at, summary_source, summarised_at, delete_after from public.topics
      where company_id = '739a428f-…' and created_at >= '2026-09-23' order by created_at
 0622f2d3-… | 'm opening a second restaurant in Seattle with about 25 staff. What do I need for food handler permits and paid sick leave? | 2026-09-23 19:11:12 | NULL | NULL | NULL
 7e23648b-… | we are going to import 192 proof organi ethyl alcholo from Columbia. what were the regulations I have to comply?            | 2026-10-03 20:08:35 | user | 2026-10-03 20:18:45 | NULL
 00e27b4b-… | check the doc and tell me I am compliant?                                                                                   | 2026-10-03 20:43:06 | NULL | NULL | NULL
```

**The restaurant topic: title beside the first turn:**
```
SQL> select t.id, t.title, tu.position, tu.text from public.topics t join public.turns tu on tu.topic_id = t.id
      where t.company_id = '739a428f-…' and t.title ilike '%restaurant%' and tu.position = 1
 0622f2d3-… | title: 'm opening a second restaurant in Seattle … | 1 | text: 'm opening a second restaurant in Seattle …
```

**The forklift document.** Corrected statement: as first written, part 9 named `d.created_at`, and
`documents` has no such column. The query failed with `42703: column d.created_at does not exist`.
The date column is `uploaded_at` (`lib/database.types.ts:2082`). That was my composed name, which is
§9a's first rule broken.
```
SQL> select d.id, d.name, d.from_topic_id, d.uploaded_at,
            (select count(*) from public.turns tu where tu.document_id = d.id) as turns_referencing
       from public.documents d where d.company_id = '739a428f-…' and d.name ilike '%forklift%'
 ab1a30d3-… | 06a-forklift-log.pdf | from_topic_id NULL | 2026-10-03 18:34:29 | 0
```

### What this settles

- **(i) CONFIRMED.**
  - The proposal behind "Not found" was document-sourced. It is the oldest pending row, which is the one the page shows (page 283–285, 805).
  - Its key, `powered_industrial_trucks_on_site`, is **not** in `switches`.
  - It was read out of `06a-forklift-log.pdf` 65 seconds after upload.
  - Save posts that key to `/api/switches/answer`, which returns 404 `Not found` at `route.ts:53`.
  - The second pending proposal, `legal_entity_on_documents`, is not a switch either. Both would 404.
- **(ii) CONFIRMED.** Both pending proposals are `source = document`, and the page heads either one "One thing from a recent conversation."
- **(v) SETTLED: the first characters were lost before the route.**
  - The stored first turn reads `'m opening…` exactly as the title does.
  - Both come from the same `userQuestion` (`chat:420`, `:426`).
  - So the text arrived without its "I".
  - Where it was lost — the box, the keyboard, or a paste — is **not** knowable from the database. **HYPOTHESIS, unsettled**: it would take reproducing the typing on the page.
- **The forklift document was attached and never asked about, or uploaded through Documents.**
  - `from_topic_id` is null and no turn references it.
  - This is the "attach and never ask" state in 4b. Its proposal went to the workspace anyway.
- **N2 is live.**
  - Topic `7e23648b` was summarised by hand (`summary_source = user`) with `delete_after` NULL.
  - Under today's rules it would never be cleared.
- **H1 is consistent.** No topic here was ever summarised overnight.

---

## Facts and hypotheses

**FACTS (from code, migrations or a printed query):**
- K1–K4 and (i)–(iv).
- N1–N10.
- The ledger figures in part 6, from the staging query shown there.
- The schema in part 3.
  - It comes from the migration files, read line by line.
  - It was not re-read from a live catalog.

**HYPOTHESES, and what settles each:**
- **(i)** That the proposal the owner saved was document-sourced, with a key not in `switches` → part 9.
- **(v)** That the first character was lost before the route → part 9, title beside the first turn's text.
- **H1** That Vercel Cron never triggers the nightly jobs → `summary_source='nightly'` rows, production `job_runs`, or the Vercel cron log.
- **Staging reset** That staging's `ai_calls` lost its pre-1-October rows to a reset → `supabase_migrations` history timestamps on staging, or `job_runs`.
- **WORKSPACE.md** That it is a design record rather than a description (part 0). That is a reading, supported by the lines cited there.

## What I could not see, and why

- **Production model values** for research, micro-steps and summaries. `docs/RELEASE.md:77` names the variables without values, and the dashboard is not readable from here.
- **How Vercel Cron calls the jobs.** That is outside the repository (H1).
- **Live grants and policies.**
  - Part 3 is from the migration files.
  - `information_schema.role_table_grants` was not queried, because the brief allows production reads only for part 9's questions, and a staging catalog read was not needed to describe the code.
- **The page running.**
  - No flow was clicked; every chain is read from code.
  - Running them costs model calls, which this task forbids.
- **Who wrote any given ledger row.** `ai_calls` has no caller column in the select used, so page traffic and `check:live` traffic are mixed.
- **`fact_proposals` entity FK on delete.** The helper that read the migrations flagged `055:128–131` (SET NULL on a composite FK that includes the NOT NULL `company_id`) as a possible failure on deleting a site. It is outside the workspace, and was not checked.

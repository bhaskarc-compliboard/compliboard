# Handoff — the Compliance Workspace, element by element

**Version:** 5 · **Written:** 3 October 2026, at the close of the Workspace layout pass (Tasks 1, 2,
2b and 3). In the shape of `docs/HANDOFF-AUDITS.md` §5a.

> **4 October 2026: v5 is live on production.** The Task 6 release is pushed (`a701436`) and migration 064 is
> applied (`npm run preflight`: 65 on disk, 65 on production, `PENDING COUNT: 0`). The owner's live checks are in
> `docs/TESTING.md`, "Workspace Task 6", and `DECISIONS.md` §158.

> **Version 5, 4 October 2026 — Workspace feature Task 6 (`eec4d22`): the checklist in three groups and
> "How do I do this?".** §4 (the Checklists tab) and the checklist drawer in §5 are rewritten in place,
> marked *Changed 4 October 2026, Workspace Task 6*, with their lines at `eec4d22`.

> **Version 4, 4 October 2026 — Workspace feature Task 5 (`cfa3738`): the summary report and the
> Conversations list.** The list's groups, rows and search, and the summary drawer's report, are
> rewritten in place, marked *Changed 4 October 2026, Workspace Task 5*, with their lines at `cfa3738`.
>
> **Version 3, 3 October 2026 — Workspace feature Task 4 (`76f8c42`): files.** Every element Task 4 changed
> is rewritten in place and marked *Changed 3 October 2026, Workspace Task 4*, with its line at
> `76f8c42`. Elements marked for Task 3 keep their `2937b0b` lines, which have moved again.
>
> **Version 2, 3 October 2026 — Workspace feature Task 3 (`2937b0b`).** Every element Task 3 changed
> is rewritten in place and marked *Changed 3 October 2026*, with its line at `2937b0b`.
>
> **Line numbers of the elements Task 3 did NOT change are still those of `6a1382f`, and most have
> moved.** Read them as "near", and find the element by its words.

**What this is.** Every element of `/compliance` in order of appearance, as built: its words, its size,
its line in `app/compliance/page.tsx` (unless another file is named), and its measured position where a
run of `npm run measure` (`scripts/measure-layout.mjs`, 1280×900, on staging) has measured it.

**What it is not.** A claim about anything nobody saw. Each element says **measured** when a run
printed it, and **from code** when it was read from the file and has not been shown on screen. The
states that need a question sent or a file uploaded — Working, stopped, failed, the nudge, the file
card — have not been shown in this pass, because showing them costs a model call.

Two logins were used: `testgamma@example.com` (47 conversations, 14 checklists) and
`testcascade@example.com` (documents and audits; one conversation, created on 3 October by
something other than the measuring script — see the counts line).

---

## 1. The page, and the first visit

**The frame.** `AppLayout` (`components/AppLayout.tsx`): the 224px sidebar, the sticky header, and
the footer. The page column is `print-page mx-auto w-full max-w-[900px] px-4 pb-16 sm:px-6`.
**Measured:** column box 302–1202 (900), content edges 326–1178, with no vertical scrollbar; 295–1195
and 319–1171 with one.

**The title** (876). `Compliance Workspace`, serif 28, `font-normal`, gray-900. **Measured:** x=326
(no scrollbar), 319 (scrollbar).

**The line under it** (878). *"Research the rules that apply to you, and turn what you find into action
steps."* 14px, gray-500.

**The tabs** (885–902). Classes copied from `app/audits/page.tsx:488–501`: row `mb-5 mt-5 flex
items-center gap-6 border-b border-gray-200`; each tab `-mb-px border-b-2 pb-3 text-[14px]
font-medium`, active `border-[var(--green)] text-[var(--green-ink)]`, inactive `text-gray-500`.
`Ask a question` · `Conversations` · `Checklists (n)`. The count is inside the label, absent at none,
and reads `(60+)` when the read came back full (`countOf`, 87). `+ New conversation` at the right of
the row (900), 14px gray-500. Tab state is React state, not the URL. **Measured:** tab row 326–1178;
`Checklists (14)` as Gamma; `Checklists` as Cascade.

**The notice** (951). A route's error or the page's own refusal, with `Dismiss`. Amber-50 fill,
amber-200 border, `text-sm`. *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)* It now clears on a change of context:
- a tab change (`switchTab`, 431–434);
- New conversation (`newConversation`);
- opening a conversation (`openConversation`, its first line);
- and, as before, at the start of every question and on Dismiss.

It used to stay across all three tabs until Dismiss (machinery (iii)). **From code.**

**"Asking about" — removed; the staged-file chip replaces it.** *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)* The chip sits **inside the box,
above the text** (1118). It is `rounded bg-gray-100`, 13px gray-700, with the paperclip, the file name and an `×` labelled *"Remove the file"*.
- **Choosing a file only stages it** (`stageFile`, 605; state at 183): no upload, no `documents` row, no reading.
- One file at a time; choosing another replaces it.
- `×` clears it, and nothing is left anywhere.
- The file input now takes `lib/acceptedFiles.ts`' types (938).
- **Arriving from Documents' "Research this"** stages the already-saved document the same way (212).
- While a file is staged, the examples overlay is hidden (1170).

**Measured** as Gamma on the first visit:
- the chip at x=347–510, y=238–266, inside a box that starts at y=223;
- x=347 is where typed text starts;
- `Make a checklist` and `Research this` are still shown (machinery N4);
- after `×`, no request is made (`BLOCKED (0)`) and Gamma has 0 `documents` rows and 0 stored files.

**The box** (1032). `relative rounded-xl border border-gray-200 bg-white`, border green on focus. The
textarea is 16px, `min-h-[92px]`, grows with what is typed. **No placeholder on the first visit**
(1040). **Measured:** 326–1178, top y=223, bottom y=345, placeholder none; typed text starts at
x=347, first line top y=244.

**The examples** (1064–1081). An overlay from the top of the box, `pointer-events-none absolute
inset-0 flex flex-col gap-3 p-5` — copied from `app/audits/page.tsx:511–518`. Three lines from
`config/examples.ts`, 14px gray-400, each *"e.g. "* and the sentence, truncated to one line:

> e.g. We store acids and solvents at our plant. What do we need for safe storage?
> e.g. We're opening a cannabis dispensary in Oregon. What licenses do we need?
> e.g. Our hospice nurses drive to patients' homes. How do we pay for mileage?

**Measured:** first glyph of each at x=347 — **Δ0** from typed text; tops y=244, 274.7, 305.3. The
first line's centre is 254.5 against typed text's 256: 14px in a 21px line against 16px in a 24px
one, a difference only a decimal pixel would close. **Not clickable:** a click where an example sits
lands on the textarea, nothing is typed or sent (measured, `BLOCKED (0)`). **Gone on typing:** three
lines before, none after one character, three again when cleared (measured). Before 3 October an
example was a button that sent its sentence straight to research.

**The line under the box** (1098–1123). On the left, the attach control (1102–1106): the docked
composer's paperclip path at 13px, gap-1.5, then *"Attach a file and ask any compliance question about
it"*, 12px gray-500, underlined. **One click opens the file picker** — the page-level input (823). *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)* The
picked file is now **staged** as the chip in the box, not uploaded (attach line at 1232).
On the right, `Make a checklist` (`SECONDARY_LARGE`, 1112) and `Research this` (`PRIMARY`, 1118), gap
12px; with an empty box either puts the cursor in the box and sends nothing. **Measured:** attach line
x=326, y=355 (10px under the box), pin 13px at x=326, gap 6px; `Make a checklist` 907–1047 outlined;
`Research this` 1059–1178 filled; **the picker opened once on one click** (`--file-chooser`,
`Page.fileChooserOpened` fired 1).

**The counts line** (1132–1137). Audits' classes (`app/audits/page.tsx:576`, `:579`): 13px gray-500
over a hairline. First visit only. Built from what the page already loads; each read takes at most
`LIST_CAP` rows (60, line 85), and a full read is said as `60+` (`countWord`, 89). **Measured:**

> Gamma: *"47 conversations · 14 checklists · last asked 1 October 2026"*
> Cascade: *"1 conversation · 0 checklists · last asked 3 October 2026"*

The Cascade conversation was created at 17:51 UTC on 3 October (*"tell me what is missing in the
attached file"*). Every measuring run blocks writes and printed `BLOCKED (0)`, so it was not made by
the script; that it came from someone using the page is a hypothesis.

## 2. A conversation

Reached on screen by opening an existing one (Conversations → a row → `Open the conversation`).
**Measured:** column and tab row as above; the docked composer 319–1171, with its placeholder
*"Ask about a rule, or describe a job you need the steps for…"* (1040).

**The question** (1036). Right-aligned, `rounded-2xl bg-gray-200`, max 85% width, 16px. *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)* A question sent with a
file names it first, on a 13px gray-600 line with the paperclip (1037).

**The stages** (`Stages`, 1652; shown at 1050), for a question sent with a file. *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)* The words, while each request is running:
1. *Saving the file* — upload, then `POST /api/documents`;
2. *Reading ‹name›* — `POST /api/document-scan`, awaited;
3. *Checking it against your question* — `POST /api/chat`, until the first text;
4. *Writing the answer* — while the text streams.

How they look:
- done: a green tick and gray-500 text;
- now: a spinner and gray-900 text;
- to come: an empty circle and gray-400 text;
- plus a `Stop` link.

Which stages run:
- A saved document (arriving from Documents) shows only 3 and 4.
- The checklist path shows 1–3; it answers in one piece.
- No page count is ever shown: the scan returns none.

**If the file cannot be read**, nothing is asked (493): the unreadable card shows the scan's own reason,
the question goes back in the box, and the staged file is cleared.

**Measured** (one scan and one answer, Haiku, staging):
- the four stages in order, with reading for about 48 s;
- then the card and the answer;
- the unreadable fixture stopped after reading, with its question back in the box and no chat call.

**Working** (928; `Working`, 1440–1451). *"Working on it…"*, *"Checking a source…"*, *"Checking n
sources…"*, *"Writing the answer…"*, and `Stop`. A box: gray-200 border, white. Label 13px, `Stop`
12.5px. **From code.**

**The answer** (936). `AnswerBody` (`components/AnswerBody.tsx:118`): serif 17, leading 1.65, no box.
**The sources** (`components/AnswerBody.tsx:126–172`): heading `SOURCES` 11px, rows 13px. *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)*
- **They fold at three** (`SOURCES_SHOWN`, `:140`). Under a longer list, *"Show all N sources"*, 13px `--green-ink`, underlined, toggles to *"Show fewer"*. The state is per answer.
- **Every source still prints:** the folded rows are `hidden print:flex` (`:154`).
- **A citation marker's card reads the answer's full list** (`:101`, `:109`), so marker 6 shows source 6 while row 6 is folded.

**Measured** as Gamma on `320822cd` (6 sources):
- 3 rows visible and *"Show all 6 sources"*;
- 6 after clicking it; 3 after *"Show fewer"*;
- all 6 under print emulation;
- marker 6's card open on *"Seattle WA Revises Paid Sick Leave Ordinance"* with the list folded.

**The action row under the newest answer — removed.** *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)* It moved under the box; see *The conversation's
actions* below.

**Stopped early** (959–967). *"**This answer stopped early.** The answer stopped before it was
finished, so what is above is incomplete. Nothing was saved for it."* and `Try again`. 14px
amber-900 with an amber left rule. **From code.**

**Stopped by the person** (1088). *"Stopped. What arrived is above — Ask again, or change the
question."* 14px gray-500. *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)* With a file, the line says what is true at the stage where Stop was pressed (`ask()`, 437–600):

| Stage | Line |
|---|---|
| Saving | *"Stopped. The file is saved in Documents but was not read. Your question was not sent."* The save is allowed to finish first. **Measured.** |
| Reading | *"Stopped. Your question was not sent. The file is saved in Documents and is still being read there."* The scan request is not cancelled (486). **From code.** |
| Checking / writing | *"Stopped. The file is saved in Documents and was read."* plus the usual words. **From code.** |

**Failed** (973–977). *"‹error› You can ask again, or rephrase the question."* 14px amber-900, amber
left rule. Every string that can reach `‹error›` is listed in `HANDOFF-CODE.md` §7. **From code.**

**The wrap-up nudge — removed.** *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)* Gone:
- the nudge, `Wrap up and start fresh` and `Keep going`;
- `nudgeDismissed`, `answered` and `showNudge`;
- the `newConversation(carrySummary)` pre-fill. That pre-fill put *"Carrying on from the last conversation…"* in the box, and that text became the next conversation's title (machinery N3).

The one-topic line under the box replaces it.

**The docked composer**. The same box. The paperclip (1140, `aria-label="Attach a file"`)
opens the picker in one click — the file is now staged as the chip *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)*  — **measured**, `Page.fileChooserOpened` fired 1. `Send` (1055), green;
`Stop` (1050) while busy, gray-900.

**The conversation's actions, under the box** (1088–1118). *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)* Shown once the conversation has a finished
answer and a topic (`hasAnswer`, and 1100):
- `Turn this into a checklist` (1104): 14px, font-medium, `--green-ink`, no border or fill; opens the scope sheet;
- `Summarise this conversation` (1107): `TEXT_ACTION`;
- `Download`: `TEXT_ACTION`, `window.print()`.

The gap is 20px, and all three are disabled while a question is in flight.

**The one-topic line** (1115) sits under them, 12px gray-500, always shown with the docked composer:
*"One topic per conversation. When you are done, summarise it. Start a new conversation for the next
topic."*

**Measured** as Gamma on `320822cd`:
- composer bottom y=699; row 709–730;
- `Turn this into a checklist` x=319–474 (14px, weight 500, `--green-ink`);
- `Summarise this conversation` 494–676;
- `Download` 696–759;
- the line at y=738, 12px.

The first visit is unchanged: `Make a checklist` and `Research this` beside the box.

**The file card** (`AttachedCard`, 1683; shown at 1059), above the answer. *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)*
- Hairlines above and below, no box: the paperclip, the file name (14px, medium), one 12px gray-500 line *"Read · ‹kind› · Saved to Documents → ‹folder›"* (*"Saved to Documents"* when it is in no folder), and `Open the report` (`OUTLINE`) on the right.
- **Reopening a conversation brings the cards back** (663; machinery N5). One `document_index_v` read covers all of its documents.
- A document deleted since shows *"‹name› · This file was deleted from Documents"* and no button.
- **Measured:** *"06a-forklift-log.pdf · Read · Record · Saved to Documents · Open the report"* after the answer, and again on reopening.

**The unreadable card** (`FileCard`, 1728) is the old card's unreadable form, unchanged: the scan's reason and `Upload a clearer copy`, which stages a new file. *Its readable form is no longer reached (Task 4).*

**The Documents report, from the card** (1560). *(Changed 3 October 2026, Workspace Task 4, `76f8c42`.)* `components/DocumentReport`, mounted with the props
`/documents` gives it (`app/documents/page.tsx`, its `<DocumentReport` mount). The folder list is read
when it opens (243); "Move to…" sends the same `PATCH /api/documents` (703). Nothing inside it changed.
`onPickFile`:
- "Add a newer version" goes to `/documents`; the version upload lives there.
- "Upload a clearer copy" and "Add the log" stage a file in this box.

**Measured:** the drawer opened on *"Powered Industrial Truck Pre-Shift Inspection Log — September 2026"*.

## 3. The Conversations tab

**Measured** as Gamma: title x=319, column 295–1195, tab row 319–1171, footer text x=319.

**The retention line** (1185–1193), at the top. *"Full conversations are kept for 12 months after the last
message. Summaries are kept until you delete them."* *(Changed in Workspace Task 2, `6a77339`, the owner's
12-month rule.)* Audits' counts-line classes: 13px gray-500 over a hairline. **Seen.**

**The proposal card — removed.** *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)* Facts belong to Company information (the owner's decision), and the card's
`Save it` could only write a key that is a switch id. Production's two pending keys were not, so the
person saw *"Not found"* (machinery (i)).

Removed with it: the proposals state and its load, `saveProposal`, `dismissProposal`, and the page's
only call to `/api/switches/answer`.

**Measured:** with a pending proposal on Gamma, the tab shows no card.

**Group headings** (1392). 12px, uppercase, gray-400. *(Changed 4 October 2026, Workspace Task 5, `cfa3738`.)* From `listGroup` (195): *Today*, *This week* (the six days before today), then one heading per month (*September 2026*). **Seen** as Gamma: `TODAY`, `THIS WEEK`. No month heading was seen, because every staging conversation is less than a week old.

**Search** (input at 1378; state at 295; filter at 1011). *(Changed 4 October 2026, Workspace Task 5, `cfa3738`.)* Shown at the right of the retention line once there are more than 20 conversations. It filters as you type, by title and summary text. **It searches only the conversations loaded — at most 60 (`LIST_CAP`)** — and does not query the database. With no match it says *"No conversation's title or summary contains "…"."* **Measured** as Gamma (52 conversations): the box at x=947–1171, y=232; *ethanol* left 1 row.

**Rows** (built at 1417). Title 13px gray-900, green on hover. *(Changed 4 October 2026, Workspace Task 5, `cfa3738`.)* Under it, **one 12px gray-500 line**, its parts separated by " · ":
- **when** (`listWhen`, 203): today the time (*8:01 pm*); this week the day (*Thu 1 Oct*); older the date (*18 Sep 2025*);
- *N questions*;
- the first file's name with a paperclip, and *+N* for more;
- the summary (`summaryWords`, 212): *Summary ready*, *Not summarised yet*, or *Summary only — the full conversation was cleared*;
- *Checklist n of m done*, when the conversation has a checklist.

**The whole list is one read**: `topic_list_v`, migration 063 (`loadTopics`, 384). It was 1 + 2N.

**Measured** as Gamma: *"8:01 pm · 3 questions · Summary ready"*, *"5:07 pm · 1 question · Harbor-Kitchen-Employee-Policy-2026.pdf · Not summarised yet"*, *"5:06 pm · 3 questions · Not summarised yet · Checklist 0 of 7 done"*. The page load made one `GET /rest/v1/topic_list_v` for the list.

*(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)*
- **No Delete on the row.** Deleting is done from the drawer.
- **The title is shown with its first letter capitalised** when that letter is lowercase: `displayTitle`, 111–121, used at 1228. Nothing stored changes. A title starting with a quote or a digit is left as it is.

**Measured:** 0 Delete buttons on the rows; *"Check this policy against Seattle's paid sick leave rules"*,
stored as *"check…"*.

**Empty** (1177). *"No conversations yet"* / *"Ask a question and it will appear here."* A box (`Empty`,
1546; title 15px). **From code.**

## 4. The Checklists tab

*(Changed 4 October 2026, Workspace Task 6, `eec4d22`.)* **One read**: `checklist_list_v`, migration 064
(`loadChecklists`, 429). It was 1 + N. **Measured** as Gamma (19 checklists): one
`GET /rest/v1/checklist_list_v?select=id,title,created_at,total,done,must_total,must_done,from_conversation,added&order=created_at.desc&limit=60`,
and no `checklist_items` read (`npm run measure -- … --log /rest/v1/checklist`).

The same rows and day headings. The status line **counts Must do only**: *"n of m must-dos done"*
(`mustDoLabel`, 1478) — green only when every must-do is done — then *"n from the conversation · n newly checked"*. **No Delete on the row** *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)* — it
is in the checklist drawer. **Measured:** 0 Delete buttons on the rows. Empty:
*"No checklists yet"* / *"Ask a question, then turn the answer into a checklist."* (1235). **Rows
seen** in the checklist-drawer screenshot, under the scrim.

## 5. The drawers

Both are `components/Drawer.tsx`, unchanged by this pass: 720 wide, title 18px (`text-lg`, `:72`), sub
line 12.5px (`:73`), footer `border-t px-6 py-3` (`:80`), a print-only header with company, title and
date (`:62–68`).

**The summary drawer.** *(Changed 4 October 2026, Workspace Task 5, `cfa3738`.)* When the conversation has a report (`topics.summary_report`, read when the drawer opens, 445), the body is `ReportView` (1764; mounted at 1540). In this order:
1. the as-of line, 13px gray-500: *"What applies to you as of ‹date›, from this conversation. Rules and tariffs change. Check before you act."*;
2. **Your situation**, 15px;
3. **What applies**, grouped by authority (13px semibold heading). Each item: its name (15px, medium), what to do (14px, gray-600), and its sources as *[n] title* links, or *No source cited in the conversation* in gray-400;
4. **Still to confirm**, the same item shape;
5. **Asked and not answered**, a bullet list;
6. the facts line (Task 3's words, built at 996);
7. **Sources**, one numbered list with each host.

Section headings are 11px uppercase gray-400. The title is the generated one, at most 70 characters. **A conversation summarised before migration 063 has no report** and shows its summary text exactly as before, with the facts line at the foot. Download prints the report.

**Measured** as Gamma on the ethanol fixture: the report rendered after one Summarise; six screenshots scrolled the whole of it (`.next/shots/t5-drawer-report-1…6.png`, not committed).

The rest below is from Task 3 and earlier. Title: the conversation's, through `displayTitle` (1301), which the drawer
also prints in its header. Sub: *"‹date› · ‹status›"*. Body (no report): the
summary in serif 17, or *"This one hasn't been summarised yet. The summary is written overnight, and
the full conversation is here until then."* (1316). When the transcript is gone, a 12.5px note on a
gray-50 fill (1322). Footer: `Open the conversation` (`OUTLINE`, only while turns exist), `Open the
checklist` (`TEXT_ACTION`, only if one was made), `Download` (`TEXT_ACTION`, `ml-auto`). **Measured:**
545–1265 (720); title 18px, sub 12.5px; `Open the conversation` outlined at x=570, `Download` at
x=1178.

*(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)*
- **Footer.** `Delete` is added at the far right, after `Download`: 14px gray-400, as the checklist drawer's (1324). It opens the delete sheet (§6a). **Measured:** `Download` x=1117, `Delete` x=1200.
- **The facts line** (1350–1361), at the foot of the body, directly above the footer. The body is wrapped in a full-height column (1332) so the line can take `mt-auto`.
  - It shows only when this conversation has pending `fact_proposals`, counted as the caller under RLS (`drawerFacts`, 314; the read follows it).
  - It sits between hairlines and reads *"1 fact from this conversation is waiting in Company information"*, or *"N facts … are waiting…"*. No line at 0.
  - `Review →`, 14px `--green-ink`, goes to `/company-information`, the link behind the sidebar's badge (`components/AppLayout.tsx:41`).
  - **Measured** with one fixture proposal on Gamma, inserted on staging and then deleted: the line, then no line once the row was gone.

**The checklist drawer** (1571–1665). *(Changed 4 October 2026, Workspace Task 6, `eec4d22`; the canvas feature boards 8 and 9.)*
- **Title** the checklist's; **sub** (`checklistSub`, 2041): *"‹date› · N items from the conversation"*, or
  *"· n from the conversation · n newly checked"* when items were added, or *"· N items"*.
- **Progress counts Must do only**: the bar and *"n of N must-dos done"* (1588).
- **Three groups** (`groupItems`, `lib/checklistView.ts:56`; 1598), each headed 12px uppercase with its hint
  on the right; an empty group is not shown:
  - **Must do** — numbered, *"in the order to do them · N"*, **only for a checklist the workspace made**.
    A Documents or Audits checklist reads *"required · N"*, unnumbered (`madeInWorkspace`,
    `lib/checklistView.ts:42`: `checklists.document_id` set, or any item with `origin = 'document'`).
  - **Worth doing** — *"advice, not a legal rule · N"*.
  - **To confirm** — *"open questions · N"*.
- **Each item**: the checkbox (1611), the name 16px, the description 15px, then 12px gray: *from this
  conversation* / *newly checked*, and its sources as links. With none: *No source cited in the
  conversation* (from a conversation), *No source found* (added, link failed the search check), *No source
  given* (a box item). A Documents or Audits item shows its document or audit by name, unlinked. An
  added source on a host that is not official carries the "This comes from ‹host›…" line.
- **The tick checks its write** (`toggleItem`, 878). A refused or zero-row update takes the tick back and
  the notice says *"‹item› could not be marked done. Nothing was changed. Please try again."* **Measured**
  with writes blocked: the notice, and the count unchanged at 0 of 16.
- **"How do I do this?"** (1650), under every Must do and To confirm item: 13px `var(--green-ink)`,
  underlined. While researching (this tab's click, or `howto_started_at` in the database younger than
  10 minutes): a spinner and *"Looking this up — checking sources…"* (1645); a tab that did not click
  re-reads only those items every 5 seconds (932). After: `HowToSteps` (2058) — a grey left rule, *"How
  to do it · checked against N sources on ‹date›"*, the numbered steps each with *[n] title* and
  *· official source*, or the "This comes from ‹host›…" line; the note, if any; *"N steps could not be
  checked against a source, so they are not shown."* if any were dropped. Shown again on every later open
  with no call. A failed run shows the route's sentence under the item.
- **Micro-steps are gone**: never generated, never shown; the drawer reads top-level items only (838).
- Footer: `Download` (1577, prints all groups and any steps already researched; buttons and spinners are
  `no-print`) and `Delete`, as before.
- **Measured** as Gamma on the ethanol checklist and as Cascade on an Audits checklist:
  `.next/shots/t6-drawer-must-do.png`, `t6-drawer-worth-doing.png`, `t6-drawer-to-confirm.png`,
  `t6-researching.png`, `t6-item-with-steps.png`, `t6-checklists-tab.png`, `t6-drawer-audits.png`,
  `t6-tick-failed.png` (not committed). **The printed page was not looked at.**

## 6. The scope sheet

`Sheet` (1532), opened by `Turn this into a checklist` (1410–1425). Title *"How much should this
cover?"*, lede *"A checklist that stops where the conversation stopped can read as though you're
finished."* Two bordered choices — *"Just what we discussed"* / *"Drawn from this conversation and
the sources it cited — nothing else."* and *"Everything on this subject"* / *"The items we discussed,
plus what we did not reach — those are checked now and marked as newly researched."* — and `Not now`.
A 448px panel (`max-w-md`). **From code**; not opened in this pass.

## 6a. The delete sheets *(Changed 3 October 2026, Workspace Task 3, `2937b0b`.)*

The same `Sheet` (1604). **Escape now closes any sheet** (1607–1612), as a click outside always did. The
browser's `confirm()` is gone from the page.

The delete sheets are at 1469–1496; state at 206, functions at 646–743.

**For a conversation**, opened from the summary drawer's `Delete`:
- title *"Delete this conversation?"*;
- *"This deletes the conversation and its summary for good. You cannot undo it."*;
- *"Download the summary first if you may need it. Checklists, files and facts that came from it stay."*

**For a checklist**, from the checklist drawer's `Delete`:
- title *"Delete this checklist?"*;
- *"This deletes the checklist and every box you ticked, for good. You cannot undo it."*;
- *"Download it first if you may need it."*

**Buttons, left to right:**
1. `Download the summary` / `Download the checklist` (`OUTLINE`; prints the drawer beneath, as its own Download does);
2. `Delete for good` (1490; OUTLINE's box in `#B42318`; disabled while deleting);
3. `Cancel` (`TEXT_ACTION`, `ml-auto`, focused on open, 1492).

**On success**, the sheet and the drawer close and the list reloads.

**On failure**, the sheet stays, with *"That could not be deleted. Nothing was changed. Please try again."*
(1481). The checklist delete now checks both writes, items first, and does not touch the checklist if
the items fail.

**Measured** as Gamma:
- both sheets' words and buttons; the red border as `rgb(180, 35, 24)`; `Cancel` focused;
- Escape closes the sheet and leaves the drawer open;
- **a forced failure** (the measuring script fails the request in the browser) shows the line, and leaves the rows in place;
- **a real delete** of a throwaway conversation and a throwaway checklist, inserted on staging, removed both rows.

**The "Attach a file" sheet is gone** (Task 2b). Attaching is one click. Its sentence — *"Anything you
upload is saved to your documents so you can find it later."* — went with it.

---

## 7. The measurements

Task 2 and Task 3, `npm run measure` at 1280×900. Every run printed `BLOCKED (0)`. The 319/326
difference on each row is a 15px vertical scrollbar, present or not.

| Page | Title x | Column | Tab row | Footer text starts | Drawer |
|---|---|---|---|---|---|
| /compliance, first visit | 326 | 302–1202 (900) | 326–1178 | **326** | — |
| /compliance, Conversations | 319 | 295–1195 | 319–1171 | **319** | 545–1265 (720) |
| /compliance, a conversation | 319 | 295–1195 | 319–1171 | **319** | — |
| /documents | 319 | 295–1195 | none | **319** | 545–1265 (720) |
| /audits (Past tab) | 326 | 302–1202 | 326–1178 | **326** | 560–1280 (720) |
| /company-information | 319 | 295–1195 | none | **319** | none |

On the four template pages the title and the footer's text start at the same x.

The five other shell pages keep their own columns:

| Page | Title x | Footer text starts |
|---|---|---|
| /calendar | 248 | 326 |
| /requirements | 321 | 319 |
| /dashboard | 264 | 326 |
| /hr | 248 | 326 |
| /account | 385 | 319 |

Before the footer change it started at 357 (scrollbar) or 365 (none) on every page.

**The gate.** `npm run check`, 3 October: schema contracts ok (196 files, 47 relations); **559 tests,
559 pass, 0 fail**; `test-guard: 559 tests, 0 skipped, 0 todo, floor 559. OK`; build compiled.

---

## 8. Owed

**Behaviour** (also `HANDOFF-CODE.md` §7):

- `/compliance?checklist=<id>` opens nothing (`DocumentReport.tsx:701`, `:760`; the page reads only
  `ask` and `document`). The owner will look after this pass.
- The Audits box's typed question is not carried to the workspace (`audits/page.tsx:533`;
  `HANDOFF-AUDITS.md` §8 item 2).
- The failed line can show a raw provider message (`lib/ai.ts:833–834` via `route.ts:382`), and
  several messages end with two instructions.
- `conversation_reset` is sent by the route and read by no page.
- From Task 6: the consistency check (items depending on To confirm), the quote check for "How do I do
  this?", blocking copy sites from search, "Everything on this subject" re-adding discussed points,
  `check:live` probes for the new tables and route, and the print with how-to steps (`HANDOFF-CODE.md` §7).

**Design** (also `DESIGN.md` §7):

- the shared drawer's 18px title and 12.5px sub line (one change across three sections);
- the button strings copied in three pages (lift to one file);
- the boxes this pass left (Working, the empty states, the notice, the file card);
- the five pages with their own columns, so the footer doesn't line up with them.

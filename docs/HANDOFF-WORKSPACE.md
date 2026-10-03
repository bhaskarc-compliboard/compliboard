# Handoff — the Compliance Workspace, element by element

**Version:** 1 · **Written:** 3 October 2026, at the close of the Workspace layout pass (Tasks 1, 2,
2b and 3). In the shape of `docs/HANDOFF-AUDITS.md` §5a.

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

**The notice** (905). A route's error or the page's own refusal, with `Dismiss`. Amber-50 fill,
amber-200 border, `text-sm`. **From code.**

**"Asking about"** (1027). *"Asking about ‹file name› remove"*, 12px gray-500, the name gray-700.
Above the box, only when a document is attached before the question — arriving from "Research this"
in a Documents report, or after a pick. **Seen in Task 1** (*"Asking about 01-eap-chemical.pdf
remove"*), before this pass's other changes.

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
it"*, 12px gray-500, underlined. **One click opens the file picker** — the page-level input (823).
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

**The question** (923). Right-aligned, `rounded-2xl bg-gray-200`, max 85% width, 16px.

**Working** (928; `Working`, 1440–1451). *"Working on it…"*, *"Checking a source…"*, *"Checking n
sources…"*, *"Writing the answer…"*, and `Stop`. A box: gray-200 border, white. Label 13px, `Stop`
12.5px. **From code.**

**The answer** (936). `AnswerBody` (`components/AnswerBody.tsx:118`): serif 17, leading 1.65, no box.
**The sources** (937; `AnswerBody.tsx:130–151`): heading `SOURCES` 11px, rows 13px.

**The action row, under the newest answer only** (941–953). `Turn this into a checklist` (`OUTLINE`),
`Summarise this` and `Download` (`TEXT_ACTION`). **Seen** in the conversation screenshot.

**Stopped early** (959–967). *"**This answer stopped early.** The answer stopped before it was
finished, so what is above is incomplete. Nothing was saved for it."* and `Try again`. 14px
amber-900 with an amber left rule. **From code.**

**Stopped by the person** (968–972). *"Stopped. What arrived is above — Ask again, or change the
question."* 14px gray-500. **From code.**

**Failed** (973–977). *"‹error› You can ask again, or rephrase the question."* 14px amber-900, amber
left rule. Every string that can reach `‹error›` is listed in `HANDOFF-CODE.md` §7. **From code.**

**The wrap-up nudge** (983–1006), after four answers. *"**This one has covered a fair bit.** When
you're done with this topic, you could wrap it up as a summary and start a new one. The new
conversation carries the summary forward, so nothing gets lost."* 14px gray-600, hairline above.
`Wrap up and start fresh` (`OUTLINE`), `Keep going` (`TEXT_ACTION`). **From code.**

**The docked composer** (1032–1060). The same box. The paperclip (1045, `aria-label="Attach a file"`)
opens the picker in one click — **measured**, `Page.fileChooserOpened` fired 1. `Send` (1055), green;
`Stop` (1050) while busy, gray-900.

**The file card** (`FileCard`, 1474). *"Read as: ‹kind› — ‹title›. Saved to Documents → ‹folder›."*,
then agency and status, then the scan's summary; unreadable: the scan's own reason and `Upload a
clearer copy`, which now opens the picker directly. A box (gray-200, or amber when unreadable).
**From code.**

## 3. The Conversations tab

**Measured** as Gamma: title x=319, column 295–1195, tab row 319–1171, footer text x=319.

**The retention line** (1151–1156), at the top. *"Summaries are kept until you delete them. The full
back-and-forth is cleared 7 days after a conversation is summarised. Anything you uploaded stays in
Documents."* Audits' counts-line classes: 13px gray-500 over a hairline. **Seen.**

**The proposal** (1162–1174). No box: hairlines above and below (`border-y border-gray-200 py-3.5`).
*"**One thing from a recent conversation.** It sounded like ‹fact› is ‹value›."*, the quote in 13px
italic, *"Saving it means we stop asking, and your requirements get sharper."* `Save it` (`OUTLINE`),
`Not now` (`TEXT_ACTION`). **From code** — no fixture had a pending proposal.

**Day headings** (1182). 12px, uppercase, gray-400: from `friendlyDate` (`lib/conversationStatus.ts:80–92`): "Today", "Yesterday", then the date. **Seen:** `1 OCTOBER` (3 October), `TODAY` (Task 1, 1 October).

**Rows** (1204–1219). Title 13px gray-900, green on hover; status 12px gray-500 (`Not summarised
yet`, `Summarised · full conversation kept…`); `Delete` in a fixed `w-14` slot, 12px gray-300, asking
first (605). **Seen.**

**Empty** (1177). *"No conversations yet"* / *"Ask a question and it will appear here."* A box (`Empty`,
1546; title 15px). **From code.**

## 4. The Checklists tab

The same rows and day headings (1240–1262). The status line is *"n of m done"* — green only when every
item is done — then *"n from the conversation · n newly checked"*. `Delete` asks first (660). Empty:
*"No checklists yet"* / *"Ask a question, then turn the answer into a checklist."* (1235). **Rows
seen** in the checklist-drawer screenshot, under the scrim.

## 5. The drawers

Both are `components/Drawer.tsx`, unchanged by this pass: 720 wide, title 18px (`text-lg`, `:72`), sub
line 12.5px (`:73`), footer `border-t px-6 py-3` (`:80`), a print-only header with company, title and
date (`:62–68`).

**The summary drawer** (1289–1327). Title: the conversation's. Sub: *"‹date› · ‹status›"*. Body: the
summary in serif 17, or *"This one hasn't been summarised yet. The summary is written overnight, and
the full conversation is here until then."* (1316). When the transcript is gone, a 12.5px note on a
gray-50 fill (1322). Footer: `Open the conversation` (`OUTLINE`, only while turns exist), `Open the
checklist` (`TEXT_ACTION`, only if one was made), `Download` (`TEXT_ACTION`, `ml-auto`). **Measured:**
545–1265 (720); title 18px, sub 12.5px; `Open the conversation` outlined at x=570, `Download` at
x=1178.

**The checklist drawer** (1330–1407). Title: the checklist's. Sub: *"‹date› · n from the conversation
· n newly checked"*. A progress bar (1342) and *"n of m done"*. Items as rows: the checkbox (1365),
the name 16px (1371), the description 15px, origin and source 12px, the steps 14px in a numbered list
with a left rule (1395); *"steps being written…"* (1392) on screen only. Footer: `Download`
(`OUTLINE`), `Delete` (14px gray-400). **Measured** on `16b613cc` as Gamma: 545–1265 (720); one
checkbox, at x=570; body sizes 16px ×1, 15px ×1, 14px ×6, 12px ×2; `Download` outlined at x=570,
`Delete` at x=1200.

That checklist's six steps were generated once, on 3 October, on `claude-haiku-4-5`, with the
owner's approval: one `substeps` call, $0.01. Read back as Gamma: one item, six steps stored. A later
open made no call (`BLOCKED (0)` with every paid route blocked, and the steps on screen).

## 6. The scope sheet

`Sheet` (1532), opened by `Turn this into a checklist` (1410–1425). Title *"How much should this
cover?"*, lede *"A checklist that stops where the conversation stopped can read as though you're
finished."* Two bordered choices — *"Just what we discussed"* / *"Drawn from this conversation and
the sources it cited — nothing else."* and *"Everything on this subject"* / *"The items we discussed,
plus what we did not reach — those are checked now and marked as newly researched."* — and `Not now`.
A 448px panel (`max-w-md`). **From code**; not opened in this pass.

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

**Design** (also `DESIGN.md` §7):

- the shared drawer's 18px title and 12.5px sub line (one change across three sections);
- the button strings copied in three pages (lift to one file);
- the boxes this pass left (Working, the empty states, the notice, the file card);
- the five pages with their own columns, so the footer doesn't line up with them.

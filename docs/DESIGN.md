# DESIGN.md — how CompliBoard looks, and why

This is the layout template. The Compliance Workspace was rebuilt
against it screen by screen in September 2026; every other section
follows it. Read this before adding any screen.

The whole thing reduces to one idea: **the page is quiet so the content
can be loud.** Almost every rule below is a consequence of that.

## 1. Type

Two families, self-hosted in `app/fonts/` (with each family's OFL) and loaded in `app/layout.tsx`
via `next/font/local` — never `next/font/google`, which fetches from Google at build time and broke
two production builds on 3 October (vercel/next.js#99114); `tests/unit/fonts.test.ts` enforces it.
The CSS family names are `plexSans` and `sourceSerif` (Turbopack names a local family after its
call); the files, and so the glyphs, are the ones Google served:

- **IBM Plex Sans** (`--font-plex` → `--font-sans`) — the interface.
  Drawn as documentation type, so it reads institutional rather than
  startup. Has tabular numerals, which is why tables and data stay sans.
- **Source Serif 4** (`--font-source-serif` → `--font-serif`) — anything
  someone reads at length, and the page title.

Serif signals "this is a document"; sans signals "this is a control."
That distinction is the main reason the product doesn't feel like a chat
toy.

**The scale. Six sizes. Do not add a seventh.**

| px | font | used for |
|----|------|----------|
| 12 | sans | meta lines, fine print, day headings, Delete |
| 13 | sans | list row titles |
| 14 | sans | interface — tabs, nav, buttons, labels, links |
| 16 | sans | what you type, and item text in a drawer |
| 17 | serif | answer body, summary body |
| 28 | serif | page title, once per page |

Add one more to the table: **15px sans — description text inside a
drawer.** It sits between the 14px interface and the 16px item name it
explains, and it was set deliberately. Seven sizes, then.

Two sizes a pixel apart are not a deliberate difference — nobody can see
them, and everybody has to reason about them. No decimal pixels.

**What the code actually has today**, which is not yet the table:
14px ×29, 13px ×18, 12px ×9, 16px ×5, 15px ×4, 12.5px ×4, 11px ×3,
28px ×1, plus a 19px serif heading and a 10px citation marker in
AnswerBody. The off-scale ones are listed in §7. Treat the table as the
rule for anything new, and the leftovers as debt.

**Also there, and missing from that count until Workspace layout Task 1
(1 October 2026) read the files:** the **18px** drawer title
(`text-lg`, `components/Drawer.tsx:72` — every drawer in the product);
AnswerBody's **11px** source-card host (`components/AnswerBody.tsx:86`)
and "Sources" heading (`:134`), and its **10px** on the citation card's
"Source n" label (`:84`) and the printed marker (`:81`) as well as the
marker itself (`:77`); and the **15px** empty-state title outside any
drawer (`app/compliance/page.tsx`, `Empty`).

13 exists because a list is **scanned**, not read. File lists everywhere
sit at 13–14. A drawer is **worked from**, so its item text is 16. Those
two are allowed to differ; that difference is the point.

## 2. Colour

Tokens on `:root` in `app/globals.css`:

```
--page:        #F7F8FA
--surface:     #FFFFFF
--ink:         #14171A
--ink-soft:    #5B6470
--ink-faint:   #8A929C
--line:        #E6E9ED
--green:       #2F7D52
--green-ink:   #256541
--green-wash:  #EAF3ED
--amber:       #B7791F
--amber-wash:  #FDF6E7
--radius:      10px
--measure:     775px
```

`--measure` is defined and unused. The column width is a literal —
`max-w-[900px]` since 3 October 2026, `max-w-[775px]` before — because
the token silently produced no rule in dev. Do not reach for `--measure` until someone works out why.

**One green, and only where it means something.** Green marks state or
the primary action. It does not decorate. Specifically it is allowed on:
the active tab, the primary button, a completed checkbox, a progress bar
with progress in it, a citation marker, and a row title on hover.

It is not allowed on: a status that is merely routine, a count at zero, a
provenance pill, a user's own message. Every one of those was green once
and each made the colour mean less.

**Amber means attention, not information.** A stopped answer, a failure.
"Not summarised yet" is the normal condition of anything asked today and
is grey. A progress count of `0 of 21` is grey; it turns green only when
done equals total.

There is one theme. The `prefers-color-scheme: dark` block was deleted —
a dark theme nobody designed is worse than none.

## 3. Layout

**900px, and the Compliance Workspace is in it.** *(Changed 3 October
2026 by the owner's decision, Workspace layout.)* The workspace was the
one 775 page; it now takes the same column as Documents, Audits and
Company information — `max-w-[900px] px-4 pb-16 sm:px-6`, as
`app/audits/page.tsx:478` has it. The page title, tabs, content,
composer and the footer's contents share the column's two content edges.
Alignment on two edges instead of four is most of what makes a page look
deliberate.

**No page in the code is a 775 reading surface any more.** A grep for
775 in `app/` and `components/` finds the `--measure` token
(`app/globals.css:26`, still 775, still unused — §2) and comments,
nothing else. The paragraph below still says "reading surfaces stay at
775"; read that as the rule there was, not a page that exists. The five
pages outside the template — /calendar, /requirements, /dashboard, /hr,
/account — keep their own Tailwind widths (`max-w-6xl`, `4xl`, `5xl`,
`6xl`, `3xl`).

**The footer is in the column.** `components/AppLayout.tsx:306` is
`mx-auto w-full max-w-[900px] px-4 sm:px-6` — the page column's own box
and padding. Measured at 1280 on 3 October: the footer's text starts at
the page title's x on all four template pages (319 with a vertical
scrollbar, 326 without). On the five pages above it does not, because
their columns are not 900 (§7).

**Width, as an addition from the Documents section.** Reading surfaces
stay at 775; working surfaces — Documents, then Audits and Calendar —
are 900, because a row that carries a title, agency, kind, site, date
and status needs a third column and Group by None becomes a real table.
With the 224px sidebar this leaves 78px of margin at 1280, 121 at 1366
and 158 at 1440. The drawer stays at 720.

*The layout chat owns this file. This paragraph is the Documents
section's one addition to it.*

**No boxes.** This is the rule that did the most work. Answers, list
rows, checklist items, nudges and status notes all sit directly on the
page. Separation comes from hairlines (`divide-y divide-gray-100`) and
whitespace, not borders.

Three things keep a box, because each is a control you act on: the
composer, a drawer, and a modal sheet. Nothing else.

**Spacing.** Equal gaps above and below a group say the group is one
thing. Unequal gaps say what belongs to what. *(The example that stood
here — the attach line 24px under the composer and 16px above the
buttons — described the workspace before 3 October. The attach line now
sits 10px under the box, on one line with the buttons, as on Audits:
measured, box bottom y=345, attach line y=355.)*

## 4. The components

**Button vocabulary — Audits' strings are the standard.** *(3 October
2026, the owner: where this section and Audits disagreed, Audits won.)*
This section used to give the primary as `px-5 py-2.5` and the outline's
hover as `--green-wash`; the strings below are what ships.

1. *Primary* — `cursor-pointer rounded-md bg-[var(--green)] px-4 py-2
   text-[14px] font-medium text-white hover:bg-[var(--green-ink)]
   disabled:cursor-not-allowed disabled:opacity-50`.
   Source: `app/audits/page.tsx:155–157`, `ACTION_PRIMARY`. Sized to its
   own text, never full width.
2. *The outlined pair beside it* — the primary's box, outlined:
   `cursor-pointer rounded-md border border-[var(--green)] px-4 py-2
   text-[14px] font-medium text-[var(--green)] hover:bg-green-50
   disabled:cursor-not-allowed disabled:opacity-50`.
   `SECONDARY_LARGE`, `app/compliance/page.tsx:102`. Used only beside a
   primary, so the two are one size.
3. *Outline* — `rounded-md border border-[var(--green)] px-3 py-1.5
   text-[14px] font-medium text-[var(--green)] hover:bg-green-50
   disabled:opacity-50`. Source: `components/AuditReport.tsx:651`, the
   footer's "Audit again". The default for an action in a footer or under
   an answer.
4. *Text action* — `text-[14px] text-gray-600 hover:text-gray-900
   hover:underline disabled:text-gray-300`. Source:
   `components/AuditReport.tsx:655`. No border, no background.

**Copied page-locally, in three pages today:** `ACTION_PRIMARY` in
`app/audits/page.tsx:155` and `app/company-information/page.tsx:137`;
`PRIMARY`, `SECONDARY_LARGE`, `OUTLINE` and `TEXT_ACTION` in
`app/compliance/page.tsx:98–109`. Audits and Company information also
carry `ACTION_GREEN` (`:151`, `:132`), a 13px underlined green text action
this list does not name. One file for all of them is owed (§7).

Three bordered buttons in a row is three boxes. One outline and two text
actions says the same thing and shouts less.

**Rows** (conversations, checklists, and any list to come):
`-mx-3 px-3 py-2.5 rounded-lg hover:bg-white cursor-pointer`, hairline
between, grouped under a 12px uppercase day heading so the date isn't
repeated on every line. Title 13px `text-gray-900`, turning
`--green` on row hover. Meta 12px `text-gray-500`. Destructive actions
are always visible in a fixed `w-14` slot at `text-gray-300`, so every
title truncates at the same x — a control hidden until hover is a
control nobody finds.

**A heading that carries a name takes the darker grey of body text; a
heading that carries a state or a date stays light.** Same 12px
uppercase either way — this is weight, not a second heading style. A
name (Oregon DEQ, Permits, Portland, Gaps, Facts we found) is structure
you read down from; a state or a date is information, and the rows
underneath already repeat it. *(Added in Documents Run 6 at the owner's
direction. The layout chat owns this file — this line is recorded here
so the rule is in one place, not so this run takes the pen.)*

**Drawers.** `fixed inset-y-0 right-0 w-full max-w-[720px] z-50`, scrim
at `z-[45]` above the sticky header. 720 rather than 560 because these
hold reading text. Footer follows the button vocabulary.

**Checklist items.** Rows, not cards. The checkbox is the first child of
each row at a fixed size, so every checkbox sits at the same x and all
text indents to a common margin. That left column of checkboxes is what
makes a checklist feel like something you work through. Verified by
measuring: seven checkboxes, one distinct x.

**A question you asked** sits right, in `bg-gray-200`, `rounded-2xl`,
max 85% width, 16px. The answer runs full width underneath with no
container. That contrast is the entire navigation system for a long
thread — without it you cannot find where you asked something.

**The first-visit box, as Audits shows its own.** *(Workspace layout,
3 October 2026.)* The examples are guidance only: three grey lines
prefixed "e.g.", an overlay from the top of the box
(`pointer-events-none absolute inset-0 flex flex-col gap-3 p-5`, copied
from `app/audits/page.tsx:511–518`), with no placeholder behind them.
They are not clickable — a click lands on the box — and they go the
moment anything is typed. Measured: the first example's first glyph at
the same x as typed text (Δ0) and on the same line top; three lines
before typing, none after one character, three again when cleared. The
sentences live in `config/examples.ts`, which is the owner's to edit.
Once a conversation has started, the docked composer keeps its
placeholder.

Under the box, one line: the attach control on the left — the docked
composer's paperclip at 13px, then "Attach a file and ask any compliance
question about it", 12px, underlined — and the outlined pair and the
primary on the right. **One click opens the file picker**, from the line
and from the docked paperclip alike; there is no sheet in between.
Measured with `--file-chooser`: `Page.fileChooserOpened` fired once for
each. Under that, the counts line in Audits' own classes
(`app/audits/page.tsx:576`, `:579`).

**Patterns any section reuses — the workspace's, as they stand on 4 October 2026.** Copy these; do not
draw a second version of any of them. Line numbers are `app/compliance/page.tsx` at `fd2ddfa`.

- **The accordion summary** (`ReportView`, `:1982`; `DECISIONS.md` §159). A long report opens folded by its
  natural groups — in the workspace, one row per authority with *N things to do* at the right and a chevron.
  What a person must not miss is never folded (*Still to confirm*). *Open all* / *Close all* (`:2016`) sits
  beside the count heading. Every open starts folded; nothing is remembered. **Print is always fully open**,
  by print CSS, never by changing the screen.
- **One-line source links** (`OneLineLink`, `:1935`; `lib/checklistView.ts:172` `oneLineSource`). A source
  under an item is one line, *"[n] host · title"*, cut with *…*, the full title on hover; on paper, the full
  title and the full address. A site's own suffix (" | Site", a prefix before " :: ") is dropped; a statute's
  own " - " title stays.
- **In-progress states** (`lib/topicClaim.ts:42` `CLAIM_WORDS`; `DECISIONS.md` §161). Work that runs after
  the reply says so in words, never a spinner alone: *Summary being written…*, *Checklist being built…* — on
  the pressed button (greyed, disabled), in the list row's grey 12px line, and in the drawer in place of its
  body; *Looking this up — checking sources…* under a checklist item (`:1789`). The state comes from the
  database, so a reload or a second tab shows the same words. When the work clears with nothing new, one plain
  sentence says it could not be done and to try again.
- **The delete sheet** (`:1860`–`:1882`; `DECISIONS.md` §154's Task 3). Delete is never on a row; it is in the
  drawer, at the far right of the footer in grey, and opens the product's own sheet, never the browser's
  `confirm()`. The sheet says what goes and that it cannot be undone, offers **the download first** (an outline
  button), then **Delete for good** (the outline's box in red), then **Cancel**, which has the focus — so
  Enter does not delete. A failure keeps the sheet open with one plain line.
- **The staged file chip and its reading stages** (`DECISIONS.md` §155). Choosing a file only *stages* it, as a
  chip in the box with a remove control (`:1346`); nothing is uploaded or read until the question is sent. On
  send the real stages show, in order, as they happen (`stageWords`, `:2076`): *Saving the file*, *Reading
  ‹name›*, *Checking it against your question*, *Writing the answer*. A file that cannot be read stops the
  question, says why in the scan's own words, and puts the question back in the box.
- **The shared print frame** — §5.

## 5. Print

A printed page is evidence, so printing is a first-class output. `.no-print` hides controls.

**One print frame, one path** (`lib/printFrame.ts:70` `printWithFrame`; `DECISIONS.md` §160, 4 October 2026).
Every drawer prints through `components/Drawer.tsx` `printDrawer()` and the conversation through the page's
Download, and both go through `printWithFrame` — nothing prints by itself. On every page: **the company top
left and the document type top right** (*Summary report*, *Checklist*, *Document report*, *Audit report*,
*Conversation*) over a hairline; at the foot, a hairline, *Prepared with CompliBoard* and **Page n of N** (the
browser's own count). Page 1 has the title in the serif and one grey line of **absolute dates** — never
*Today* or *Yesterday*. The frame is drawn in CSS page margin boxes, so **the browser's own header and footer
are off** even with "Headers and footers" ticked. Side margins 10mm. The site header never prints. Measured in
Chrome 154 only.

**A new section prints through this frame and never a copy of it.** The app-wide sweep — every `window.print`,
`printDrawer` and print stylesheet onto the one frame — waits until every section has its new look
(`docs/WORKSPACE-PLAN.md`, "When every section is done").

Taking the boxes off made print better on its own, which is usually what it means when a print bug disappears
without anyone fixing print.

## 6. Building the next section

1. Page title in serif 28, one line of explanation in 14 grey.
2. Column at 900, centred. Footer contents in the same column.
3. Start with no boxes. Add one only for a control you act on.
4. Pick sizes from the six. If you need a seventh, you are wrong.
5. One green. Before using it, say out loud what state it means.
6. Lists get day groupings, 13px titles, always-visible destructive
   actions in a fixed slot.
7. Long reading text gets the serif at 17.
8. Buttons: one primary, and everything else outlined or text.
9. Check it prints.
10. Measure rather than look. **The harness is `npm run measure`**
    (`scripts/measure-layout.mjs`). It prints the title's x, the
    column's box and content edges, the tab row, the footer's content
    edges and text start, and — when one is open — the drawer's edges,
    title and sub sizes, footer actions, checkbox x positions and body
    text sizes; on a page with a composer, where typed text starts and
    where each overlay line's first glyph sits against it.
    - `<path>` — the page, default `/compliance`
    - `--as <email>` — the fixture login, default `testcascade@example.com`
    - `--width <px>` — default 1280; the height is 900
    - `--click "<text>"` — click the first visible control whose words
      (or, with none, aria-label) start with the text; repeatable
    - `--click key=<id>` — click the row whose React key is that id, for
      rows that share their words
    - `--wait <ms>` — the pause after load and after each click, default
      2500
    - `--shot <file>` — a screenshot
    - `--file-chooser` — intercept the file picker and print whether a
      click opened it
    It starts from a fresh profile with the cache off, **fails every
    request to a paid route and every write**, and prints `BLOCKED` with
    the list — an empty list is the evidence a run cost nothing and
    changed nothing. Screenshots: **`npm run
    check` wipes `.next/`** (`next build` clears it). *(Changed 4 October
    2026, the owner: **every task's screenshots go in `shots/` at the project
    root**, git-ignored — `--shot shots/<task>-<what>.png` — never `.next/shots/`.)* A selector scoped to a class alone will match
    things you did not mean and report a page fault that isn't one.

## 7. Known open, not layout

- **Generated titles.** Nine checklists begin with the same 45
  characters and the distinguishing words fall off the right edge. No
  font size fixes that. The rule for whoever owns generation: the
  distinguishing part goes first, the standard name last or not at all.
- **Cost of looking.** Opening a checklist drawer enqueues background
  micro-step generation. Roughly $2 across three design passes, none of
  it from model calls this work made. Screenshotting a UI should not
  cost money.
- **Small cleanups pending:** the send arrow is a lighter green than the
  buttons beside it; the nudge hairline crowds the line above it;
  micro-steps lost their left rule with the card and float slightly free
  of their parent; the progress bar at zero reads as an empty line
  rather than a bar at zero.
  **Off-scale type, four places at 12.5px** — the cleared-transcript
  note, Working's Stop button, FileCard's Try again, and the sub line
  under every drawer title. **Three at 11px** — the checkbox tick, the
  FileCard kind badge, and the drawer print-header date. The 12.5s go
  to 12 or 13. The 11s are inside components that were never part of
  this pass; check each before moving it, since the print-header date
  is on paper, not screen. AnswerBody's 19px serif heading and 10px
  citation marker are deliberate and stay.
- **Owed by the Workspace layout pass (3 October 2026):**
  - the shared drawer's 18px title and 12.5px sub line
    (`components/Drawer.tsx:72–73`) — one change, felt in three sections
    (the workspace, Documents, Audits);
  - the button strings copied in three pages (§4) — lift them to one file;
  - the boxes this pass left: Working, the empty states, the notice, the
    file card (`app/compliance/page.tsx`);
  - the five pages with their own columns (/calendar, /requirements,
    /dashboard, /hr, /account), so the footer, now in the 900 column,
    does not line up with them.
- **Phone.** Not designed. Desktop is the intended surface and phone
  widths mostly work. Revisit before anyone is asked to use it there.

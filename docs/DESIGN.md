# DESIGN.md — how CompliBoard looks, and why

This is the layout template. The Compliance Workspace was rebuilt
against it screen by screen in September 2026; every other section
follows it. Read this before adding any screen.

The whole thing reduces to one idea: **the page is quiet so the content
can be loud.** Almost every rule below is a consequence of that.

## 1. Type

Two families, loaded in `app/layout.tsx` via `next/font/google`:

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

`--measure` is defined and unused. The column width is the
`max-w-[775px]` literal, because the token silently produced no rule in
dev. Do not reach for `--measure` until someone works out why.

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

**775px.** One column width, everywhere, centred. Wider is unreadable
for serif body text; narrower wastes the screen. The page title, tabs,
content, composer and the footer's contents all share those two edges.
Alignment on two edges instead of four is most of what makes a page look
deliberate.

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
thing. Unequal gaps say what belongs to what — the attach line sits 24px
under the composer and 16px above the buttons, because it belongs to the
box, not to the buttons.

## 4. The components

**Button vocabulary.** Three levels, and a screen should not need a
fourth:

1. *Primary* — filled `--green`, white text, `px-5 py-2.5`, sized to its
   own text, never full width.
2. *Secondary* — outlined `--green`, green text, `hover:--green-wash`.
   This is the default for an action in a footer or under an answer.
3. *Tertiary* — plain text, `text-gray-600 hover:text-gray-900`,
   underline on hover. No border, no background.

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

## 5. Print

A printed page is evidence, so printing is a first-class output.
`.no-print` hides controls. `body.printing-drawer` hides `.print-page`
and promotes the drawer to the document. Drawers carry a print-only
header with company, title and date — a printed compliance page with no
company and no date is not evidence of anything.

Taking the boxes off made print better on its own, which is usually what
it means when a print bug disappears without anyone fixing print.

## 6. Building the next section

1. Page title in serif 28, one line of explanation in 14 grey.
2. Column at 775, centred. Footer contents in the same column.
3. Start with no boxes. Add one only for a control you act on.
4. Pick sizes from the six. If you need a seventh, you are wrong.
5. One green. Before using it, say out loud what state it means.
6. Lists get day groupings, 13px titles, always-visible destructive
   actions in a fixed slot.
7. Long reading text gets the serif at 17.
8. Buttons: one primary, and everything else outlined or text.
9. Check it prints.
10. Measure rather than look. There is a harness for this — a selector
    scoped to a class alone will match things you did not mean and
    report a page fault that isn't one.

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
- **Phone.** Not designed. Desktop is the intended surface and phone
  widths mostly work. Revisit before anyone is asked to use it there.

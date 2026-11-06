# docs/archive/

**Every file in this folder is kept for the record and is superseded by the file named beside it.**
Nothing here is a live instruction, and nothing here should be followed without checking the current
file first. Archived 28 September 2026.

**Why kept rather than deleted.** A design document is the record of what was intended before anything
existed, which is the only way to judge what was delivered — and a decision record that cites a
document nobody can open is a decision nobody can check. `DECISIONS.md` references several of these by
name and section.

---

## ⚡ REVIEW OF 29 OCTOBER 2026 — NOTHING WAS ADDED, AND HERE IS WHAT WAS CHECKED

> ### ⚡ RE-TESTED 6 NOVEMBER 2026, AFTER THE GAPS RELEASE. ONE FILE MOVED; EVERY OTHER BLOCKER STILL HOLDS.
>
> The whole table below was re-run against the repository, not recalled. **Every reason a file stayed in
> October is still true**: the five `*-MACHINERY.md` files are still cited from **6, 4, 4, 2 and 1 source
> files** (re-counted), `WORKSPACE-PLAN.md` is still cited five times from `HANDOFF-CODE.md`,
> `HANDOFF-FOLDER-TEST.md` still briefs a chat that has not happened, and `EVIDENCE-LINKING.md` is still
> the only written design for unbuilt work.
>
> **One file changed category: `INVENTORY-2026-09.md`.** Its content case got worse, not better — it
> counts **34 API routes and 14 pages** against today's **68 and 22**, so it now describes a codebase
> *half* the size rather than 46% of it. What let it move was not the content but the pointers: the two
> living files that called it current were rewritten first.
>
> **Deliberately NOT moved, and the reason recorded so the next housekeeping does not re-ask:** the five
> released plans — `ACCOUNT-PLAN.md`, `CALENDAR-PLAN.md`, `DASHBOARD-PLAN.md`, `HR-PLAN.md`,
> `PUBLIC-PAGES-PLAN.md` — and `GAPS-PLAN.md`. All six describe shipped work and all six are still cited
> by name from `docs/PENDING.md`, which gathers its rows from them. They move when `PENDING.md` is next
> rewritten, so the pointers and the moves happen in one change rather than leaving a dangling path for a
> week. `GAPS-PLAN.md` additionally holds §5b, the open pre-release list, and §3, the only home of
> decisions 1–76 until they were written into `DECISIONS.md` §224–§230.

Every file in `docs/` and the repository root was re-examined against three tests: **superseded by a
newer document**, **describing code that no longer exists**, or **a plan whose section has shipped
and whose truth now lives in a handoff or in `DECISIONS.md`**. The rule applied was the owner's:
*do not archive anything a live document still points at.*

**Nothing qualified.** The findings are worth keeping, because "we looked and the answer was no" is
only useful if it says what was looked at:

| candidate | why it looked stale | why it stayed |
|---|---|---|
| `HANDOFF-WORKSPACE-TO-HR.md` | A completed handoff — the HR chat it briefed finished, and `HANDOFF-FROM-HR.md` is its close-out. The same category as the two already here | **`HANDOFF-FROM-HR.md:39` says its §§6–8 "still apply to every section"**, and `HR-PLAN.md:340` points at the same sections. It is live guidance, not a spent brief |
| `HANDOFF-WORKSPACE.md` | A handoff for work that shipped on 4 October | `STATUS.md` points at it as the **element-by-element** reference for the live `/compliance` page. A live reference, not a brief |
| `WORKSPACE-PLAN.md` | A plan for a section that shipped | **`HANDOFF-CODE.md` cites it five times** as where open quality-pass items live — *"this row stays OPEN — see `docs/WORKSPACE-PLAN.md` Stage 3"*. It records unfinished work |
| ~~`INVENTORY-2026-09.md`~~ | **The strongest case on content.** It said the repo holds *34 API routes and 14 pages*; it held **63 and 17** | **⚡ THIS ONE HAS SINCE MOVED — 6 November 2026.** It stayed in October only because `HANDOFF-CODE.md:29` and `STATUS.md` pointed at it as current. **Those two pointers were rewritten first**, which is the order the rule requires, and the file is now in this folder with its row in the table below. `docs/PENDING.md` **O7**, which existed to record the contradiction, is closed by the move |
| the five `*-MACHINERY.md` files | Pre-build maps of code that has since changed | Each is **cited from code**: `ACCOUNT-MACHINERY` from 6 files, `WORKSPACE-MACHINERY` and `DASHBOARD-MACHINERY` from 4 each, `CALENDAR-MACHINERY` from 2, `HR-MACHINERY` from 1. Moving them breaks a path in a source comment |
| `HANDOFF-AUDITS.md` | A handoff for a section rebuilt on 30 September | Cited from **6 code files**, and its §8 is still the Audits section's live owed list |
| `HANDOFF-FOLDER-TEST.md` | Written 1 October as *"the brief for the next chat"* | **That chat has not happened.** It is pending work, not a spent brief — `PENDING.md` item |
| `EVIDENCE-LINKING.md` | *"Status: SPEC. Nothing here is built."* | The only written design for unbuilt work — the same reason three files already here were kept — and cited from a database column comment that reaches `SCHEMA.md` |
| the four `*-boards.html` | The owner's boards for sections now shipped | Each is cited from code and tests (`lib/accountView.ts`, `lib/dashboardView.ts`, `lib/calendarView.ts` and their tests) as the source of the exact words on screen |

> ### ⚠ WHAT THE REVIEW DID FIND WAS THAT **`docs/README.md`** WAS THE STALE FILE.
> The index had full, present-tense sections for **six of the eight files in this folder** — one of
> them telling a reader to *"consult it before starting work"* — and listed `CURRENT-SCHEMA.md`,
> deleted on 28 September. It also claimed, in its own version 17 note, to have **archived
> `HANDOFF-WORKSPACE.md`, `HANDOFF-WORKSPACE-TO-HR.md` and `HR-MACHINERY.md` on 19 October**; none
> of the three ever moved. **The 28 September archive moved the files and nobody updated the
> index.** Corrected on 29 October; `docs/README.md` is version 18.

---

## The nine, and what is current instead

*(Eight until 6 November 2026, when `INVENTORY-2026-09.md` joined them.)*

| Archived | Why it is here | Read instead |
|---|---|---|
| `HANDOFF-DOCUMENTS.md` | **Completed handoff.** Briefed the chat that built Documents; that chat finished and rev 1 reached production on 26 September | `VISION-DOCUMENTS.md`, `HANDOFF-AUDITS.md` §5–§6, `DECISIONS.md` §131–§140 |
| `HANDOFF-LAYOUT.md` | **Completed handoff.** Briefed the layout pass on the Compliance Workspace; finished 24 September, and its result is the template every surface since has followed | `DESIGN.md`, `HANDOFF-AUDITS.md` §5 |
| `INVENTORY.md` | Superseded. The surface inventory **by phase**, last read 15 September | `INVENTORY-2026-09.md` — the same ground **by file**, checked 28 September |
| `INVENTORY-2026-09.md` | **Superseded by arithmetic.** The file-by-file pass, checked 28 September 2026. It states *"the repo holds 34 API routes and 14 pages"*; **counted on 6 November 2026 the repo holds 68 API route files (`app/api/**/route.ts`), 22 pages (`app/**/page.tsx`), 227 modules under `lib/` and 96 migrations** — so every count, every "Current" verdict and every "nothing calls this" in it is a statement about a codebase half this size. Its *judgements* are still worth reading; its *numbers* are not | **`docs/SCHEMA.md`** for the database, generated by `npm run db:migrate` and therefore never stale by more than one migration; and for a file's state, **count the directory** — `find app/api -name route.ts`, `find app -name page.tsx`. `docs/HANDOFF-CODE.md` for what the code is for |
| `GATE-HISTORY.md` | **Built and shipped.** M1.2b, the record of how the determination gate gained a conversation | `DETERMINATION-GATE.md` for the gate as it stands |
| `BUILD-PLAN.md` | Superseded as a plan. Its phase ordering was right and is now recorded where it is enforced; its M4 section describes Documents as unbuilt | `TODO.md` for what is open, `HANDOFF-AUDITS.md` for the next section, `CLAUDE.md` §2 for the ordering rule |
| `AUDIT-CHECKS.md` | **Dated answers, none re-run since 22 September**, and it covers none of the five tables Documents added | `tests/golden/documents/bakeoff/2026-09-27-rejudged.md` for what has actually been measured; `TESTING.md` for what runs |
| `REQUIREMENTS-SCREEN.md` | **Design only, never built.** M6 | `TODO.md` MODULES, and `HANDOFF-AUDITS.md` for the section that comes first |
| `CHEMICAL-OR-WA.md` | **Design only, never built.** The first vertical's regulatory map and data model | `supabase/seed-data/switches.json` and `REQUIREMENTS.xlsx` are the data that exists; `CLAUDE.md` §1 already corrects its switch count from ~46 to 95 |

---

## ⚠ THREE OF THESE ARE NOT FINISHED WORK, AND SAYING SO IS THE POINT

Six of the eight are genuinely spent: two completed handoffs, a superseded inventory, a shipped
feature's history, and two designs for things that were built or replaced.

**`AUDIT-CHECKS.md`, `CHEMICAL-OR-WA.md` and `REQUIREMENTS-SCREEN.md` are different.** They are the
*only* written design for work that has not been done:

- **`AUDIT-CHECKS.md`** is the register of questions `npm run check` cannot answer — *"is what we are
  telling customers actually true, where nothing else would notice"*. Those questions did not stop
  being worth asking; they stopped being asked. The next Audits work should pull them forward.
- **`CHEMICAL-OR-WA.md`** is the whole design of the first vertical. Nothing has replaced it. The
  library and the 95 switches came out of it.
- **`REQUIREMENTS-SCREEN.md`** is M6, still on `TODO.md`.

**Being in this folder means "not current", not "not needed".** When that work starts, these come
back out — and `CLAUDE.md` §2's pointers were updated to these paths on 28 September so nothing
dangles in the meantime.

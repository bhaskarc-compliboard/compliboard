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
| `INVENTORY-2026-09.md` | **The strongest case on content.** It says the repo holds *34 API routes and 14 pages*; it holds **63 and 17**. It describes a codebase 46% of the current one | `HANDOFF-CODE.md:29` and `STATUS.md` both point at it as current — *"for every file's state and who calls what"*. Blocked by the rule, and recorded in `docs/PENDING.md` instead |
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

## The eight, and what is current instead

| Archived | Why it is here | Read instead |
|---|---|---|
| `HANDOFF-DOCUMENTS.md` | **Completed handoff.** Briefed the chat that built Documents; that chat finished and rev 1 reached production on 26 September | `VISION-DOCUMENTS.md`, `HANDOFF-AUDITS.md` §5–§6, `DECISIONS.md` §131–§140 |
| `HANDOFF-LAYOUT.md` | **Completed handoff.** Briefed the layout pass on the Compliance Workspace; finished 24 September, and its result is the template every surface since has followed | `DESIGN.md`, `HANDOFF-AUDITS.md` §5 |
| `INVENTORY.md` | Superseded. The surface inventory **by phase**, last read 15 September | `INVENTORY-2026-09.md` — the same ground **by file**, checked 28 September |
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

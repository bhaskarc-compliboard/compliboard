# docs/archive/

**Every file in this folder is kept for the record and is superseded by the file named beside it.**
Nothing here is a live instruction, and nothing here should be followed without checking the current
file first. Archived 28 September 2026.

**Why kept rather than deleted.** A design document is the record of what was intended before anything
existed, which is the only way to judge what was delivered — and a decision record that cites a
document nobody can open is a decision nobody can check. `DECISIONS.md` references several of these by
name and section.

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

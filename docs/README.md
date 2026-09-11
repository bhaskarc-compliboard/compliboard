# docs/

The written record of what CompliBoard is and why it is built the way it is.

Everything here is the source of truth. Where a document and someone's memory of a
past conversation disagree, the document wins. Where a document and the code disagree,
that is a finding worth raising, not something to quietly reconcile in either direction.

## How to use this folder

**Read the relevant document at the start of a session or a new feature.** Chat
conversations elsewhere do not carry over, and a summary of a decision is not the same
thing as the decision. Reading the section you are about to work in costs a minute and
prevents rebuilding something that was already settled — or, worse, silently reversing it.

If the owner refers to a decision "from our chat" that is not written down here, ask him
to add it rather than guessing what it was. A guess that lands in code becomes the new
de facto decision, and nobody notices until it is expensive.

**Not all of these files are present at any given time.** They are written and updated
by the owner and dropped in here. A missing file means "not written yet", not "does not
apply" — if you need something a missing document would have told you, ask.

## What belongs here

Filenames are stable. Versions live **inside** each file, in the header block — see
[Versioning](#versioning).

### `DECISIONS.md`
Every decision made and why, plus **the condition under which it would be reversed**.
That last part is what makes it more than a changelog: a decision recorded with its
reversal condition can be re-examined when the world changes, instead of being treated as
permanent because nobody remembers the reasoning.

### `BUILD-PLAN.md`
The phased plan — what is being built, in what order, and what is deliberately deferred.
Consult it before starting work so effort lands on the current phase rather than on
something scheduled for later or already dropped.

Part B is **horizontal** — schema, runtime, worker, resolution, library, observability —
and Part C is **vertical**: the eight product modules, built last, once the ground under
them has stopped moving. That split is the plan's main structural claim; the reasoning is
written at the head of Part C.

### `TODO.md`
The task-level to-do: what is done, what is in progress, what has not been started, phase
by phase. Where the build plan is the *why* and the ordering, this is the *what next*.

Same two-part shape as the build plan: numbered phases first, then `MODULES` (M1–M8) at
the end, each module carrying the findings behind it. **Most of the real product work is
in that final section** — the phases are short because infrastructure is smaller than
product. Read the ⛔ GATE at the top before planning anything: three pieces of work are
cheap today and expensive the moment a real customer's documents are in the database.

### `CHEMICAL-OR-WA.md`
The full design of the first vertical: regulatory map, data model, runtime pipeline,
display, verification, onboarding. The most detailed document here and the one to read
before touching requirements, obligations, or how results are shown. **Design only —
none of it is built.**

### `WORKSPACE.md`
The Compliance Workspace module: conversation model, fact capture, topic lifecycle, and
signup with industry classification. **Design agreed, not built.** Planned as M1 and M7 in
`TODO.md`'s `MODULES` section, after the phases they depend on.

### `PATTERNS.md`
Conventions carried over from the sibling Bizpulses project, with notes on **what to copy
and what not to**. The "what not to" half matters as much as the other; it records
patterns that were tried and found wanting, so they are not adopted again by default.
Note that its "this repo" wording refers to Bizpulses, which is TanStack Start — not
CompliBoard, which is Next.js.

## Versioning

**Version numbers go inside the file, never in the filename.**

Every document carries a header block:

```
# <Title>
**Version:** <n> · **Updated:** <date>
**Supersedes:** <what changed in this version, or "—">
```

To update a document: edit it in place, raise the version, say what changed in
**Supersedes**. The filename does not move.

**Why, concretely.** Versioned filenames were tried and caused two drift incidents in a
single day. Two to-do lists existed side by side — `CompliBoard-TODO.md` and
`CompliBoard-TODO-v2.md` — and a finding was written into the wrong one. `CLAUDE.md`
pointed at `CompliBoard-Build-Plan-v2.md` for a week after v3 existed. Both have the same
cause: a version in the filename means every update renames the file, and every rename
breaks every reference to it. The references then have to be chased across every other
document, `CLAUDE.md`, and the code comments — and any that are missed now point at a file
that either doesn't exist or, worse, still does and is stale.

A stable filename means a reference written once stays correct forever. The version is
still recorded; it is just recorded where updating it costs nothing.

Git holds the full history of every version. That is what it is for.

## What does not belong here

- Anything with a real key, password, or token in it.
- Generated output. `CURRENT-SCHEMA.md` (a snapshot of the live database) and
  `baseline-outputs/` (frozen AI output kept for comparison) live at the repo root
  because they are produced by tooling, not written by hand.
- **Data destined for the database.** Anything that will end up as rows lives in
  `supabase/seed-data/` — `load-chemical-requirements.sql`, and the filled requirement
  worksheets that `scripts/load-requirements.js` reads. It sits next to the migrations
  that shape the tables it loads into, and it is not part of the written record: once a
  worksheet is loaded, the database is the source of truth and the file is only the
  record of how it got there. The blank worksheet the pass starts from
  (`REQUIREMENTS-TEMPLATE.xlsx`) stays at the repo root, because it is generated *from*
  the database rather than destined for it.
- Rules for how the work is done. Those are in `CLAUDE.md` at the repo root, which is
  read automatically at the start of every session; this folder is the *subject matter*,
  not the working agreement.

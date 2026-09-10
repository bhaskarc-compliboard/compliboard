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

### `CompliBoard-Decisions-v1.md`
Every decision made and why, plus **the condition under which it would be reversed**.
Newest first. That last part is what makes it more than a changelog: a decision recorded
with its reversal condition can be re-examined when the world changes, instead of being
treated as permanent because nobody remembers the reasoning.

### `CompliBoard-Build-Plan-v3.md`
The phased task list — what is being built, in what order, and what is deliberately
deferred. Consult it before starting work so effort lands on the current phase rather
than on something scheduled for later or already dropped.

### `CompliBoard-TODO-v2.md`
The task-level to-do: what is done, what is in progress, what has not been started, phase
by phase. Where the build plan is the *why* and the ordering, this is the *what next*.
Supersedes `CompliBoard-TODO.md`, which was deleted — two overlapping to-do lists is the
drift this folder exists to prevent.

### `CompliBoard-Chemical-OR-WA-Vertical-Spec.md`
The full design of the first vertical: regulatory map, data model, runtime pipeline,
display, verification, onboarding. The most detailed document here and the one to read
before touching requirements, obligations, or how results are shown.

### `CompliBoard-Compliance-Workspace-Design.md`
The conversation model, fact capture, and topic lifecycle — how a working session with
the product is structured, how facts get captured from it, and how a topic moves from
open to settled.

### `BIZPULSES-PATTERNS.md`
Conventions carried over from a sibling project, with notes on **what to copy and what
not to**. The "what not to" half matters as much as the other; it records patterns that
were tried and found wanting, so they are not adopted again by default.

## What does not belong here

- Anything with a real key, password, or token in it.
- Generated output. `CURRENT-SCHEMA.md` (a snapshot of the live database) and
  `baseline-outputs/` (frozen AI output kept for comparison) live at the repo root
  because they are produced by tooling, not written by hand.
- Rules for how the work is done. Those are in `CLAUDE.md` at the repo root, which is
  read automatically at the start of every session; this folder is the *subject matter*,
  not the working agreement.

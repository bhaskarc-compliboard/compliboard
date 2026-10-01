# HANDOFF — THE FOLDER TEST

*Written 1 October 2026 (Audits Run 8b, item 7). The brief for the next chat.*

## What it is for

**The whole product judged on a folder, the way a customer arrives.** Everything so far has been
measured a piece at a time: seven golden documents, five audit cases, a probe with two files. A
customer does not arrive with a case. They arrive with a folder — thirty files, some of them
duplicates, one of them a photograph, two of them about a site nobody has told us exists — and drop
the lot in. **The folder test is the first time the product is asked the question it is actually
sold on**, and the first time a real queue will exist.

## The folders

`tests/golden/folders/<industry>/`, **twenty to forty files each, as a company would hold them** —
the real mix: a permit, a plan, a log with gaps, a certificate that has expired, a photograph of a
tag, a spreadsheet, two near-duplicates with different dates, a file that is not a compliance
document at all. Not tidied. The point is the mess.

**At least one folder is a two-site company.** `switch_scope` says 73 of the 95 switches are
per-site, an audit is scoped to a company, and **nothing in Audits has been judged on two sites**
(`HANDOFF-AUDITS.md` §10). A second plant with its own permit, its own generator category and its own
forklifts is where the current design is most likely to be wrong, so it is in the first test rather
than the second.

## The key

**`FOLDER.md` beside each folder, the owner's two lines per document:** what it is, and what was
planted in it. Two lines, in his words, because the domain judgement is his and writing it as a
spec first is how it stops being his.

**The chat turns those lines into the key**, in the golden-spec shape
(`tests/golden/documents/README.md`, `tests/golden/audits/README.md`): must-lines, must-nots, and the
AUDIT USE section saying what an audit must say once that document is on file. The chat writes the
key; it does not invent what is in the documents. Where a line is ambiguous it asks.

## The runner

One command, and it does what a customer does:

1. **Drop the folder as a batch** under a **fresh company** — `document_batches`, one upload, the
   way the box does it. Not twelve separate scans in a loop.
2. **Read it on `claude-opus-5-5`**, search uncapped, the schema as production has it.
3. **Run "Audit everything"** over the result, through the sweep and the cron, not in-process.
4. **Score readings and audits against the key**, and store every run on disk the way
   `tests/golden/audits/runs/` already does, so a figure is traceable six weeks later.

## What is actually being read for

**The owner reads the reports as the customer**, start to finish, and **the unplanted findings are
the ones to read.** The planted ones only prove the suite works. The rev 1 baseline already said
this: every configuration raised gaps the specs never mention — a missing chemical-spill procedure,
no OERS notification step, appendices referenced but absent — and those are plausibly the most
useful findings in the run, and the suite scores them zero either way.

## What it costs

**About ten dollars of reading per folder, and one or two of audits.** Thirty documents at the
baseline's per-scan price is most of it; an audit of everything over a dozen agencies is the rest.
Budget per folder, not per run, and store the runs so nobody pays twice to answer the same question.

## Before the queue exists, read three lines

**`docs/HANDOFF-CODE.md` §8a, "Before the first customer with a big folder".** Three hypotheses with
the file to open: what the sweeps do when the model refuses a call for rate limiting; how long the
sweep an upload kicks is allowed to live against the cron's 800 seconds; and what a backlog looks
like in `job_runs`. **None of the three has been tested under load because no load exists** — this is
the test that creates it. Not copied here; read it there, so there is one copy.

## How fixes happen

**One instruction at a time, to the section it belongs to.** A folder test finds things in Documents,
in Audits, in the Workspace and in the obligation engine all at once, and the temptation is a single
commit that touches all four. That is the change nobody can attribute. The folder test **produces a
list**; each item goes to its own section's next run, in that section's own words, with its own
golden case.

## The standing command

> **Before you assert a cause, point at the line that says it. If you can't, call it a hypothesis and
> check it. Never file a record you haven't seen evidence for. Every report ends with how this run's
> changes affect sections other than the one being built, by file.**

## Read these first

1. **`docs/HANDOFF-AUDITS.md`** — the state of the Audits section, and §5a, the page element by
   element, which is what the folder's reports will be read against.
2. **`docs/HANDOFF-CODE.md`** — the state of the code: migration state from the preflight, the model
   tiers and their variables, what `npm run check` does and does not cover, and §8a above.
3. **`docs/TESTING.md`** — the three kinds of test kept apart, and the hard line that the overnight
   agent **cannot validate regulatory content**, because a model checking a model produces agreement
   and agreement is not verification. The folder test is the manual set written large; the owner
   reading the reports is the verification, and nothing else is.

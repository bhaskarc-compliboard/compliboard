# Calendar Job B — the page: running report

Started 9 October 2026, evening. Staging and local only; nothing pushed. The plan is
`docs/CALENDAR-PLAN.md` version 5 (md5 `35aacdba3f33ca1d8d736346fa975cb8` as read); the boards are
"CompliBoard Calendar — the boards" 1–8 and 13–15; the decisions are `DECISIONS.md` §185 and §185a–c,
and Job A's record is §186.

**Ledger at the start of Job B: 345 calls, $19.02.** Job B's own spend is the difference from that,
and is reported as such. Cap $3.

---

## B0 — the two records Job A missed

**1. `CLAUDE.md` §3.12 — the owner's standing rule, for every chat.**

> "Every change must check if other sections are getting impacted. I burnt once before."

It points at `docs/CALENDAR-PLAN.md` §2.5's eight parts rather than copying them, says part 1 runs
after every checkpoint and all eight at the end of a job, and repeats that the impact check is
written **before** the code. It carries the new-code rule too: **check the error on every read, and
never show, email or act on a failed read as "nothing"** (`docs/FIX-LIST-FAILURES.md` R2 and R3,
which compound — a read fails, returns nothing, and the nothing is printed to a customer as a fact
about their own compliance). `docs/HOW-WE-BUILD.md` §3d gains a line pointing to it.

**2. `DECISIONS.md` §185 decision 2 — the correction, at the spot.** The "source's own link must be
set" CHECK was written, applied, and refused by migration 073's own verify block, with the output
quoted. A cascaded `ON DELETE SET NULL` re-checks every CHECK on the row, so the rule made deleting a
conversation, document or handbook impossible. `check (date_key like source || ':%')` plus `addDate`'s
write-time check stand instead. The note ends with what Job B owes: **the drawer says in plain words
when a source has been deleted, and never shows a dead link.**

---

## B1 — the impact check, before any code

In the shape of plan §2.6.

### Who calls `/api/extract-dates`, before it is retired (decision 17)

```
$ grep -rn "extract-dates" app lib components scripts tests | grep -v "^app/api/extract-dates/"
app/calendar/page.tsx:173      the ONE caller — the page's own "Import from file"
app/api/chat/route.ts:14       a COMMENT, listing it as one of four once-undocumented routes
lib/ai.ts:528                  a COMMENT about extractJsonText's users
lib/documentContent.ts:10,:13  COMMENTS about which routes parse a document
```

**One real caller, and it is the page this job replaces.** Nothing else in the app, no script and no
test calls the route; `prompts/extract-dates.ts` is imported only by the route itself. So retiring it
removes a door nothing else opens — but **four comments elsewhere name it** and would become wrong,
so they are corrected in the same commit rather than left to mislead the next reader.

### Every file this job touches, by section

| File | Section | What changes | How it is proved |
|---|---|---|---|
| `app/calendar/page.tsx` | **Calendar** | replaced: the shell, three tabs, month, list, To confirm, drawer, Add a date, print | boards 1–8, 13; `npm run measure` |
| `app/api/extract-dates/route.ts`, `prompts/extract-dates.ts` | **Calendar** | **deleted** (decision 17) | the grep above; `check:live` |
| `app/api/chat/route.ts:14`, `lib/ai.ts:528`, `lib/documentContent.ts:10,:13` | Workspace, shared | **comments only** — they name a route that will not exist | read after |
| `app/dashboard/page.tsx` | **Dashboard** | the calendar part onto `lib/calendarDate.ts`; `res.ok` checked; "Couldn't load" instead of a zero; "Files reviewed" counts a readable reading | fix list items 34, 35, 8 marked FIXED |
| `app/page.tsx` (80–95) | **Landing** | promise words (decision 21) — **proposed in the report, shipped only with the email** | the owner's yes |
| `app/account/page.tsx:390` | **My Account** | "Deadline reminders" → the true words | the owner's yes |
| `lib/emailFrame.ts` **(new)** | **shared — every email** | one HTML+text frame from one content object | a test per email |
| `lib/calendarNotify.ts` | Calendar | onto the frame | its own words unchanged, a test |
| `lib/documentBatch.ts` | **Documents** | onto the frame | Documents' free checks re-run |
| `lib/auditNotify.ts` | **Audits** | onto the frame | Audits' free checks re-run |
| `lib/handbookCheckNotify.ts` | **HR** | onto the frame | HR's free checks re-run |
| `app/api/feedback/route.ts` | — | **not changed**: it goes to the owner, not a customer | stated |
| `docs/DESIGN.md` | shared | a Brand section, the two wordmark colours | read after |

### Which sections' emails change

**Three, and all three are another section's:**

| Email | Section | Called from | Today |
|---|---|---|---|
| the batch email | **Documents** | `app/api/jobs/scan-documents/route.ts`, `app/documents/page.tsx` | plain text, **no "why you got this" line** |
| the audit email | **Audits** | `app/api/jobs/audit-sections/route.ts` | plain text, **no "why you got this" line** |
| the handbook-check email | **HR** | `lib/handbookCheck.ts` | plain text, **no "why you got this" line** |
| the monthly email | Calendar | `app/api/jobs/calendar-month/route.ts` | plain text, has its line (A5b) |

**Each section's words stay its own**; only the frame is new. Where an email has no "why you got
this" line — three of the four — **a line is proposed in this report for the owner's yes** rather
than invented, because it is the one sentence in the email that is not about the work.

### What this job does NOT touch

- **`lib/calendarDates.ts` and `lib/calendarDate.ts`** gain no writer. Every write on the page goes
  through `addDate`, `confirmDate`, `rejectDate`, `markDone`, `withdrawStale` as Job A built them.
- **No migration.** The schema is 073–076, unchanged.
- **The app's own header** (`components/AppLayout.tsx`) — the brand colours go into `DESIGN.md` and
  the email frame only, by the brief.
- **Workspace and HR pages.** Only their email bodies' frame changes.

### Stop items — effects not already in plan §2.6

**None.** §2.6 already carries the dashboard (decisions 15, 18), the promise words (21), the import's
retirement (17), and the email (11, with the frame added in version 5). The three other sections'
emails are decision 11's own scope.

---

# B6 — THE CROSS-SECTION GATE (plan §2.5, `CLAUDE.md` §3.12)

All eight parts, run at the end of Job B. **It caught two things**, both named below.

| # | section | what was checked | before | after | pass |
|---|---|---|---|---|---|
| 1 | all | `npm run check` after every checkpoint, floor only up | 1072 | **1097** | ✓ (floor 1072→1076→1081→1083→1085→1097) |
| 2 | Calendar | `calendar_events`, caller / service role | — | 5 / 6 | ✓ every row named below |
| 2 | Calendar | `document_deadlines` | — | 40 / 40 | ✓ untouched |
| 2 | Documents | `documents`, `document_scans`, `document_gaps`, `document_batches` | — | 12/12, 14/14, 25/25, 0/0 | ✓ identical both ways |
| 2 | Audits | `audit_runs`, `audit_findings`, `audit_run_sections` | — | 0/0, 0/0, 0/0 | ✓ — **and see the note** |
| 2 | HR | `handbooks`, `handbook_sections`, `handbook_checks`, `handbook_check_sections` | — | 1/14, 0/83, 0/31, 0/226 | ✓ tenancy, not loss |
| 2 | Workspace | `topics`, `topic_messages`, `checklists`, `checklist_items` | — | 0/86, 0/0, 0/7, 0/38 | ✓ tenancy |
| 2 | Company info | `companies`, `entities`, `profiles` | — | 1/6, 1/7, 1/5 | ✓ tenancy |
| 2 | Jobs | `job_runs`, `ai_calls` | — | **ERR**/31, 2/345 | ✓ by design, proved |
| 3 | HR, Documents | shared files changed, their free checks re-run | — | 7 files | ✓ |
| 4 | all 8 pages | loads, shows rows, `BLOCKED` printed | — | 8/8, **BLOCKED (0)** each | ✓ |
| 5 | all 7 cron jobs | run by hand, `job_runs` row written | — | 7× HTTP 200 | ✓ — **one slip, below** |
| 6 | all 5 emails | still send from the address they used before | `emailFrom()` | `emailFrom()` | ✓ unchanged |
| 7 | all | `CHECK_LIVE_BASE_URL=http://localhost:3999 npm run check:live` | 2 ✗ | **ok** | ✓ after a fix |
| 8 | all | which golden sets would move | — | **none** | ✓ reasoned below |

## Part 2 — every calendar row named

Service role sees 6; the signed-in caller sees 5. The difference is **tenancy, not a bug**: the sixth
belongs to `Test Gamma Solvents`. Read back from the database, not from what the job thinks it wrote:

```
Cascade Specialty Chemicals  document  not_confirmed  Next annual maintenance for all 14 units        <- Job A's A3 replay
Cascade Specialty Chemicals  document  not_confirmed  Six-year internal maintenance for W-3 and L-1   <- Job A's A3 replay
Cascade Specialty Chemicals  hand      confirmed      Air permit annual fee            hand:jobB-...  <- THIS JOB (B2 seed)
Cascade Specialty Chemicals  hand      confirmed      Fire extinguisher service        hand:jobB-...  <- THIS JOB (B2 seed)
Cascade Specialty Chemicals  hand      done           Scrubber inspection              hand:jobB-...  <- THIS JOB (B2 seed)
Test Gamma Solvents          handbook  confirmed      Open enrolment window            handbook:...   <- Job A
```

**This job's own writes: +4 seeded for the screenshots, −1 deleted by migration 077** (the
`hand` + `not_confirmed` row that started the owner's point 6). Net +3, all three visible above and
all three keyed `hand:jobB-`. Nothing else moved.

> **THREE TEST ROWS ARE STILL ON STAGING, DELIBERATELY** — they are what makes the B7 screenshots show
> a calendar with something in it. One statement removes them:
> `delete from public.calendar_events where date_key like 'hand:jobB-%';`

**`job_runs` is unreadable by the caller, and that is by design, not by this job.** Read rather than
assumed: `has_table_privilege('authenticated','public.job_runs','SELECT')` is **false** and the table
has **0 policies**. Migration 073 restated its `job_runs_job_check` CHECK and touched no grant.

**Audits has 0 rows on staging**, so the audit email's new frame has no live data behind it here. Its
render is a fixture (`scripts/calendar-b5-render.mjs`) and is labelled as one — **not** proof that a
real audit email renders, which needs an audit run.

## What the gate caught

**1 — migration 077 broke two of another section's `check:live` probes.**

```
✗ counts_as_due   a date with no day is not due — 23514 ... violates "calendar_events_hand_is_confirmed"
✗ counts_as_due   an unfound line is not due    — 23514 ... violates "calendar_events_hand_is_confirmed"
```

The probes built their rows from `mine`, a **hand** date, and set `state: 'not_confirmed'` — the exact
combination 077 made impossible. They were not wrong about `counts_as_due`; they were building a row
the product cannot make. Both now use a document-sourced base, and a `document:` key, because 073's
other CHECK requires `date_key like source || ':%'`. `check:live` back to **ok**.

*This is the gate doing its whole job.* `npm run check` was green the entire time — the constraint is
in the database and the probes are in a script, so nothing in Calendar's own tests could see it.

**2 — my own gate run sent a real email.**

Part 5 drives each cron job by hand. I used `GET ... ?dry=1`, and **`?dry=1` is honoured on POST, not
GET** — GET is the cron's own entry point and always sends. So `calendar-month` sent one monthly
email. It went to `NOTIFY_TEST_TO`, not to a customer, so no harm was done; it is recorded because a
gate that sends mail is a gate with a side effect, and the next person running part 5 should know.
The dry path was then proved correct (POST needs `x-cron-secret`, not `Authorization`):

```
dry_run: true   counts: {"companies":6,"sent":1,"nothing_to_say":5,"no_logins":0,"failed":0}
rendered, not sent: [ 'Your October dates: 1 due, 2 passed, 2 to confirm' ]
```

## Part 8 — no golden set moves, and why

The golden sets exercise `prompts/checklist` (`golden:facts`) and `prompts/audit-agency`
(`golden:audit`); `golden` and `golden:docs` name no prompt file. **This job edited no prompt, no
model, no parameter and nothing that builds a model's context.** The one `prompts/` file it touched,
`prompts/extract-dates.ts`, was **deleted** with the import route (decision 17) and appears in no
golden set. `lib/ai.ts` shows in the changed list and its diff is **one comment** — verified:

```
- * Strips markdown fences and parses. Used by extract-dates and the document scan; review and the
+ * Strips markdown fences and parses. Used by the document scan (extract-dates, its other caller, was
+ * deleted in Calendar Job B); review and the
```

## A correction to part 4, made at B7

**Part 4 was first run without `--base`, so every screenshot in this job up to that point was taken
against `http://localhost:3000` — the owner's own dev server — and not the isolated Haiku copy.**
`scripts/measure-layout.mjs` defaults to port 3000 and `scripts/with-server.sh` exports `BASE`; the
command has to be given it, and mine was not. Nothing was spent (the measure tool blocks every paid
route, and `BLOCKED (0)` held throughout) and the data is the same, since a dev machine points at
staging — but the shots were not evidence about the server they claimed to be about.

**And I reported "all eight pages load" from the `BLOCKED` line without opening eight of the images.**
That is the R2 mistake this report keeps catching in other people's code: `BLOCKED (0)` is printed
whether the page rendered or returned a 500. Part 4 is re-run here with `--base`, and the proof is
now the page's own measured title, not the absence of an error:

```
/compliance           "Compliance Workspace"              column 302–1202 (900)
/hr                   "HR Workspace"                      column 302–1202 (900)
/documents            "Documents"                         column 295–1195 (900)
/audits               "Audits"                            column 295–1195 (900)
/company-information  "Company information"               column 295–1195 (900)
/dashboard            "Cascade Specialty Chemicals, LLC"  (no .print-page, as before)
/calendar             "Calendar"                          column 302–1202 (900)
/account              "My Account"                        (no .print-page, as before)
```

**Two things the mistake exposed, both now fixed:**

1. **`scripts/with-server.sh` copied the tree without `--delete`**, so the copy kept every file this
   job had deleted — `app/api/extract-dates/route.ts` and `prompts/extract-dates.ts` were both still
   there. The copy was running code that no longer exists. `--delete` is now on, with `node_modules`,
   `.next` and `.git` protected and `${APP:?}` so the path can never expand to nothing.
2. **`npm run measure` is only against the isolated server if it is told so.** Every call in this
   report now carries `--base "$BASE"`.

> ### AND I BROKE THE OWNER'S DEV SERVER.
> `rm -rf .next` (to clear a stale Turbopack directory that was failing `next build`) deleted the
> build output from under the dev server running on port 3000. It has been answering **500** since.
> It is his process, so it is not mine to restart: **`npm run dev` again and it will recompile.**

## What is NOT proved

- **The audit email's frame has no live data behind it.** Staging holds 0 `audit_runs`, so
  `shots/calendar-jobB-email-audit.png` is a fixture render. The frame is shared and tested; what is
  untested is a real audit's content flowing through it.
- **The four emails were sent from `onboarding@resend.dev`**, Resend's test sender. Whether they
  arrive anywhere but the Resend account's own inbox is decision 22's gate, not this job's.
- **No email was opened in a real client.** The renders are Chromium. Outlook's Word engine is the
  one that breaks layouts, and nothing here has been through it.

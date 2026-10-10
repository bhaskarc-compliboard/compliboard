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

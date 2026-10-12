# E9 — did Job E break anything else?

**12 October 2026. Report only: no code was changed, nothing was committed, nothing was pushed.**
Every test script lived in a temporary folder outside the repository and was deleted at the end.
Everything ran against **staging** through an isolated server on port 3998, started under
`npm run haiku` (the guard printed **12 of 12 tiers on claude-haiku-4-5** before each run — the
owner's `.env.local` is now on Opus 5.5, so the guard is the only thing keeping this cheap).

**Spend: $0.0374** — 4 model calls, all Haiku (1 `hr_check`, 3 `audit`). Ledger **359 → 363 calls,
$19.09 → $19.13**. The cap was $0.50.

**Verdict in one line: Job E did not break the normal path — every page, every API and every
nightly job works for a brand-new company — but five real faults came out of this, three of them in
code Job E wrote or made reachable.**

---

## THE TWELVE ITEMS

| # | item | verdict |
|---|---|---|
| 1 | a brand-new company, every page/API/job | **PASS** |
| 2 | answers that stop short (S2) | **PASS**, and `stop_reason` is **not recorded** anywhere |
| 3 | Audit again (A1+O1) | **FINDING ×2** |
| 4 | a new handbook version (H4) | **FINDING** (one window), PASS on the rest |
| 5 | Requirements (W1) | **FINDING** |
| 6 | conversation lists (W7) | **PASS** |
| 7 | "Needs work" (079) | **PASS**, and it **corrects Job E's part-8 claim** |
| 8 | the JSON reader (S1) and HR-read | **PASS** |
| 9 | retries (D6, D7, O6) | **FINDING** on (a); PASS on (b) and (c) |
| 10 | signup (O5) and audit retry (O3) | **PASS** on both |
| 11 | every print path | **9 of 10 captured**; 1 not reachable headlessly |
| 12 | Job E's code diff | **written** |

---

### 1. A BRAND-NEW COMPANY — **PASS**

Two companies signed up on staging through the real `/api/signup`.

**(a) A brand-new company** (`E9 fresh`, 1 site, 0 documents, 0 handbooks, 0 conversations):

- **11 pages, all 200**, none containing "couldn't load", "could not be read", "Something went
  wrong", "Application error", "TypeError" or "ReadFailed": `/`, `/dashboard`, `/documents`,
  `/audits`, `/compliance`, `/hr`, `/requirements`, `/calendar`, `/company-information`, `/account`.
  `/to-confirm` answers **308 → `/company-information`**, which is a deliberate redirect, not a failure.
- **15 GET APIs, all 200**: `/api/account`, `/api/account/export`, `/api/audit-runs`,
  `/api/audits/index`, `/api/calendar`, `/api/calendar/dates`, `/api/company-information`,
  `/api/documents`, `/api/documents/index`, `/api/folders`, `/api/industries`, `/api/obligations`,
  `/api/promise`, `/api/switches/ask`, `/api/to-confirm`.
- **All 7 nightly jobs 200**, run by hand against this state.

**(b) A company with documents but no sites, no handbook and no conversations** (`E9 docsonly`; its
site row removed, two documents inserted, one `uploaded` and one `could_not_read`): same 11 pages,
same 15 APIs, same 7 jobs, all 200, no failure words. The sweep then picked the queued document up
(`companies: 1, could_not_read: 1`) and wrote a failed reading carrying D6's **FILE_GONE** wording
(`could_not_read_reason: "We could not fetch the stored file for this document."`, `model: "(not
called)"` — so nothing was spent) because the file genuinely was not in storage. That is D6's 404
branch behaving correctly on the normal path.

**Every read converted to `mustRow`/`mustRows` that uses `.single()`: there are none.** Of 168
`must*`/`tryRows` call sites in `app/`, `lib/` and `components/`: **112 list reads, 25
`.maybeSingle()`, 4 counts, 0 `.single()`**. This matters because `.single()` returns an *error* for
zero rows, so a `mustRow` wrapped round one would throw on a legitimately absent row.

For the 25 `.maybeSingle()` sites, zero rows is possible at **every one of them** (they are all
lookups by id or by a filter that may match nothing), and **all 25 handle the `null`** — 404, a
named throw, `if (x)`, or `x?.name ?? '…'`. Job E converted only **two** `.single()` reads, both
deliberately: `app/api/obligations/route.ts:16` (`null` → 404) and `lib/obligationWriter.ts:130`
(`null` → `throw new Error('Company not found')`), each with the reason in a comment beside it.

### 2. ANSWERS THAT STOP SHORT (S2) — **PASS**, and the ledger cannot answer the question

**`stop_reason` is not recorded.** `ai_calls` has 14 columns and none of them is a stop reason:
`company_id, cost_usd, created_at, effort, id, input_tokens, model, output_tokens,
price_input_per_m, price_output_per_m, price_per_search, searches, task, wall_ms`. No other table
has one either (`grep -nE "stop_reason|stopped_early|incomplete" lib/database.types.ts` returns
nothing). **So there is no production SELECT on `ai_calls` that answers this, and I have not run
one.** Staging counts by task are therefore the only thing available: `summarise 99, hr_check 115,
hr 92, research 27, convert 8, document_scan 5, audit 9, checklist 3, howto 1`.

**What IS recorded is the consequence**, on `turns.stopped`. On staging: **8 of 221 turns are
`stopped: true`** — so this has happened eight times already.

If the owner wants the production figure, this is the read-only SELECT — **one query, not run by
me**:

```sql
-- How often an answer has been abandoned or cut short, last 30 days.
-- stop_reason is not stored; `turns.stopped` is the recorded consequence.
select date_trunc('day', created_at) as day, count(*) filter (where stopped) as stopped,
       count(*) as turns
  from public.turns
 where created_at >= now() - interval '30 days'
 group by 1 order by 1 desc;
```

**What a person sees when an answer ends at `max_tokens`:**

- **Now:** the half-answer is still streamed to the screen — it is theirs — and beneath it the
  `stopped_early` block, which says the answer is incomplete, that **nothing was saved for it**, and
  offers **Try again** (`app/api/chat/route.ts:530–538`, `lib/answerStream.ts:125–133`).
- **After a reload:** the question is still there, **marked stopped, with no answer under it**. No
  assistant turn was written, the counter did not move, and the user's turn carries `stopped: true`
  (`lib/conversation.ts:134`), which the transcript renders as `phase: 'stopped'`
  (`app/compliance/page.tsx:762`). The transcript shows a question that was asked and abandoned,
  which is what happened.

### 3. AUDIT AGAIN (A1+O1) — **FINDING ×2**

Two real audits of **Oregon State Fire Marshal** on Cascade Specialty Chemicals, on Haiku, the
second linked to the first exactly as the button links it.

```
run 1  5175146f   done, 1/1 sections, 7 findings
run 2  bf75ca46   done, 1/1 sections, 8 findings
CARRIED 4    NEW 4    CLOSED 3
closed only because the title was worded differently:  0 of 3
```

**Closed by wording: none.** But three were closed for a worse reason.

**FINDING 3a — a finding is carried from a row of a DIFFERENT KIND, and the real match is closed as
"not raised by the newer audit".** The pairing is the model's own `same_as` handle
(`lib/auditRun.ts:1068–1073`), and **nothing checks that the previous row is the same kind as the
new one**:

| run 2 row | carries `same_as` → | which is |
|---|---|---|
| `[finding]` Monthly visual inspections of portable fire extinguishers | `c39c157d` | `[expected]` **Monthly inspection log or tag records from August 2025 to present** |
| `[finding]` Hydrostatic test records or schedule… | `5155c629` | `[expected]` Hydrostatic test records or schedule… |

Meanwhile run 1's **actual** `[finding] Monthly visual inspections of portable fire extinguishers`
(`93b27fdb`) was **closed with `closed_reason: "not raised by the newer audit"` — while run 2 raised
exactly that title.** The summary reports `carried: 4, closed: 3`; both are wrong in substance.

**FINDING 3b — `[date]` and `[expected]` rows are never carried, so every re-audit duplicates them.**

```
finding    run1=3  run2=4  carried=4  closed=1
date       run1=2  run2=2  carried=0  closed=2     <- both closed "not raised by the newer audit",
                                                      and both re-created in run 2 with IDENTICAL titles
expected   run1=2  run2=2  carried=0  closed=0     <- run 1's two stay OPEN and run 2 adds two more:
                                                      four open rows for two obligations
```

After one press of **Audit again**: one genuine finding closed with a false reason, two dates closed
with a false reason and immediately re-created, and two expected-documents duplicated. This is on
Haiku, and the pairing is the model's answer — a stronger model may pair better — but **the missing
kind check is in the code, not in the model**, and nothing stops it.

### 4. A NEW HANDBOOK VERSION (H4) — **FINDING** (one window), PASS on the rest

A new version of Gamma's 2-page `Harbor-Kitchen-Employee-Policy-2026`, read for real on Haiku, then
a second version pointed at a file that is not in storage (the forced failure). Measured at each
state: how many are **current**, how many are **used for answers**, how many are **due for a nightly
check**. *(Everything in this item was reverted afterwards — see "What is left on staging".)*

| state | shown as current | used for answers | due nightly | the list's own note |
|---|---|---|---|---|
| before | 1 | 1 (the old one) | 0 | — |
| uploaded, not yet read | **2** | **1 — the old, readable one** | 0 | *"in use while the new version is read"* |
| **DURING the reading** | 2 | **2 — BOTH versions** | 0 | *"in use while the new version is read"* |
| after it read | **1** | 1 (the new one) | 1 | — |
| after a forced failure | 2 | **1 — the readable one** | 1 | *"in use — the new version could not be read"* |

Four of the five states are exactly right, and the last row is H4's whole point working: the new
version could not be read, the previous one is still used, and the list says so in its own words.

**FINDING — during the reading window, BOTH versions of the same handbook are used for one answer.**
`lib/hrAnswer.ts:136` selects `extracted_text && (status === 'read' || status === 'reading')`. The
text is saved before the outline finishes, so between those two moments the new version and the old
version are both current and both have text: the model is handed the same handbook twice, the budget
is spent twice, and the two blocks carry the same name. It is the same shape as **HR-dup** (item 54,
which Job E fixed for sections) one level up, across versions, and H4 is what created the window in
which both are current.

**And it confirms E6's wording 3 is live, word for word.** With the failure in place, the answer's
own list reads:

```
USED      "Harbor-Kitchen-Employee-Policy-2026"   (801232a5)
NOT USED  "Harbor-Kitchen-Employee-Policy-2026" (could not be read: Something went wrong at our end…)
```

One name, two versions, nothing saying so — which is exactly the case wording 3 was drafted for.
**One thing the drafted wording would not fix:** staging also has two *unrelated* current handbooks
with that same name (`c6a147b9` and `801232a5`, different chains), and a clause naming the version
does not disambiguate those.

### 5. REQUIREMENTS (W1) — **FINDING**

**A company whose answers genuinely make nothing apply any more cannot load its requirements again —
ever.** Proved end to end on the realistic path (`industry: 'other'`, which is a real selectable
value — Willamette Valley Foods on staging carries it):

```
industry chemical-manufacturing  -> GET /api/obligations 200, 200 rows, open=200
industry other                   -> GET /api/obligations 500
   {"error":"We could not work out your requirements: the result came back with none at all,
     while 200 of yours are open. Closing them on that would be wrong, so nothing has been changed."}
   open=200 closed=0        (nothing was closed — the guard did its job)
attempt 2                        -> 500
attempt 3                        -> 500
```

The refusal is **right**: W1 exists so that an empty result never closes 200 obligations. But the
consequence is a **permanent 500** with no way through from the UI — the company's own Requirements
data can never be recomputed, and the only exit is for somebody to close those obligations by hand
(there is deliberately no DELETE policy on `obligations`). Before Job E this case silently closed all
200. The trade is correct on safety; the dead end is new, and the owner should decide what the page
should offer instead.

### 6. CONVERSATION LISTS (W7) — **PASS**

Through the shipping function `readTopicList(db, section)`, signed in as a real customer:

```
readTopicList(db,'hr')         -> 39 rows; sections present: ["hr"];        companies: 1
readTopicList(db,'workspace')  -> 28 rows; sections present: ["workspace"]; companies: 1
as this caller, every topic RLS allows: hr=39  workspace=28  section-null=0
```

No leakage either way and no unsectioned rows. **A note on the owner's "58":** staging holds **58 HR
conversations in total** (39 Test Gamma + 19 Test Alpha) and 28 Workspace. A Gamma user correctly
sees only Gamma's 39 — the other 19 belong to another company, and seeing them would be the bug.

### 7. "NEEDS WORK" (079) — **PASS**, and it corrects Job E's own part-8 claim

The audit input was built from the live view for **all five** audit golden fixtures and rendered
twice: once as it is now, and once with every document's `display_status` put back to what 076's
CASE would have produced (076 is 079's expression with one line removed, copied from the migration
body).

**Exactly one document on staging moved**, as migration 079 claimed:

```
OSHA Form 300A … Calendar Year 2025, Portland Facility
   kind=record scan=recorded open_gaps=2   076="recorded" -> 079="needs_work"
```

**Three lines differ across the five fixtures, all of them that one document:**

| fixture | lines | differing |
|---|---|---|
| `cascade-deq.json` | 216 | 0 |
| `cascade-fire.json` | 73 | 0 |
| `cascade-osha.json` | 346 | **1** — line 210 |
| `cascade-template-12.json` | 556 | **1** — line 310 |
| `cascade-template-13.json` | 556 | **1** — line 310 |

```
before 079:       kind: record · status: recorded · shown as: recorded
after  079:       kind: record · status: recorded · shown as: needs_work
```

**This corrects Job E's gate, part 8.** That part concluded "no golden set would move" from
`git diff -- prompts/` being empty. The audit golden set's input does not come from `prompts/` alone
— it is built from `document_index_v`, which 079 changed — so **`golden:audit`'s input has moved for
3 of its 5 cases**, and `prompt_sha256` with it. Whether the stored answers move cannot be known
without paying for a run. Nothing here affects `golden`, `golden:facts` or `golden:docs`.

### 8. THE JSON READER (S1) AND HR-READ — **PASS**

**S1.** Every stored raw model answer I could find — **28 of them**: 11 verbatim replies in
`tests/fixtures/json-extraction/`, 2 narration fixtures, and all 15 `document_scans.raw_text` rows on
staging — run through the **old** `extractJsonText` (from `0d1f62e`) and the **new** one:

```
28 identical, 0 different
```

The only behaviour that changed is the one the fix is about:

```
"I will check the permit first.[1]"   old = array(1)  ->  new = UNPARSEABLE   <-- CHANGED
"[1]"                                 old = array(1)  ->  new = array(1)      (same)
"[1, 2]"                              old = array(2)  ->  new = array(2)      (same)
"```json\n{\"a\":1}\n```[1]"          old = object    ->  new = object        (same)
```

Old: the citation marker became the answer, parsed cleanly, and an agency audit was saved as a clean
bill of health. New: the caller fails loudly. A reply that simply *is* an array is still an answer.

**HR-read.** No table stores the raw outline reply, so there is nothing to replay directly — instead
**11 real outlines were rebuilt from staging's own `handbook_sections`** and run through both
versions: **0 refused by the new guard** (1, 4, 6, 10 and 39 sections among them). The shapes that
changed are exactly the broken ones:

| reply | old | new |
|---|---|---|
| a good reply | kept 1 | kept 1 |
| an empty list (a short part with no boundary) | kept 0 | **kept 0 — still allowed, deliberately** |
| some good, some not | kept 1 | kept 1 (dropped 1, **logged**) |
| no `sections` field at all | kept 0 → **one untitled section holding the whole handbook** | **REFUSED** |
| `sections` is not a list | kept 0 | **REFUSED** |
| items that are not title+anchor | kept 0 | **REFUSED** |
| the reply is an array, or null, or `[1]` | kept 0 | **REFUSED** |

### 9. RETRIES (D6, D7, O6) — **FINDING** on (a), PASS on (b) and (c)

**(a) A permanent non-404 storage error never stops. FINDING.**
`app/api/jobs/scan-documents/route.ts:258–262`:

```ts
if (!fileIsMissing(dlError)) {
  console.error(`scan-documents: storage unreachable for ${doc.id}: …`)
  await supabaseAdmin.from('documents').update({ status: 'uploaded' }).eq('id', doc.id)
  continue
}
```

There is **no attempt counter** — `documents` has no such column — so a storage error that is
permanent but not a 404 retries for ever. The row also keeps its claim (`reading_since` is not
cleared here), so the next run's claim (`.eq('status','uploaded').is('reading_since', null)`) cannot
see it; rule 3 clears it 15 minutes later and the cycle repeats. The document says **"Queued"** to
the person indefinitely, its batch never finishes, and **the batch email therefore never goes** —
the same end state O6 was fixed for, reached a different way. Nothing is spent on the model, so it is
cheap; it is just permanent and silent.

**(b) A retried batch emails exactly once. PASS.** The batch is marked done by a compare-and-set
(`.update({status:'done'…}).neq('status','done')`, line ~389) which is **won before** the send; a
second caller matches nothing and returns. **Caveat:** because the done write comes first, a send
that *fails* is never retried — the failure is recorded in the run's `resend` field and the email
never goes.

**(c) The sweep cannot steal a reading in progress. PASS**, proved four ways on a real row:

| the row | sweep says | result |
|---|---|---|
| `reading`, claimed **just now** | `recovered=0` | **untouched** ✓ |
| `reading`, claimed **20 minutes ago** | `recovered=1` | recovered ✓ |
| `reading`, **no claim**, uploaded a day ago | `recovered=1` | recovered ✓ (O6's second leg) |
| `reading`, **no claim**, uploaded just now | `recovered=0` | **untouched** ✓ |

The window is 900s and the route's own `maxDuration` is 800s, so a legitimate reading cannot outlive
the window.

### 10. SIGNUP (O5) AND AUDIT RETRY (O3) — **PASS** on both

**(a) Signing up with an existing email deletes nothing.**

```
before: {"companies":1,"profiles":1,"obligations":200,"documents":0,"entities":1,"logins":1}
POST /api/signup -> 500 {"error":"A user with this email address has already been registered"}
after : {"companies":1,"profiles":1,"obligations":200,"documents":0,"entities":1,"logins":1}
stray companies left behind by the failed attempt: 0
```

Nothing of the existing account was touched, and O5's undo left no half-made company behind. (The
status is 500 where 409 would be more accurate — cosmetic, pre-existing.)

**(b) A section retry deletes only the failed attempt's own rows.** The route refuses a section that
finished (`400 — "The Oregon State Fire Marshal part finished, so there is nothing to run again."`),
so the section was forced to `could_not_complete` — the state O3 describes — and retried:

```
DELETED: 8   — every one of them run=bf75ca46 section=e8f55ded
rows deleted that did NOT belong to the retried section: 0
run 1's 7 rows: untouched
```

The delete is scoped to both ids (`.eq('section_id', sid).eq('run_id', id)`), so it cannot reach
another run. **One observation:** the re-run closed a *fourth* previous finding (run 1 went from
"closed 3, open 4" to "closed 4, open 3"), so two attempts at the same section close different sets.
That is the model's non-determinism, not a code defect, but it means "closed" is not reproducible.

### 11. PRINT — **9 of 10 paths captured**, in `shots/`

| path | shot | result |
|---|---|---|
| Dashboard | `e9-print-dashboard.png` | ✓ |
| Calendar | `e9-print-calendar.png` | ✓ |
| Company information | `e9-print-company-information.png` | ✓ |
| Documents page | `e9-print-documents.png` | ✓ |
| Audits page | `e9-print-audits.png` | ✓ |
| Documents report drawer | `e9-print-document-report.png` | ✓ |
| Workspace answer | `e9-print-workspace-answer.png` | ✓ |
| Checklist | `e9-print-checklist.png` | ✓ |
| Handbook check | `e9-print-handbook-check.png` | ✓ |
| **Audit report drawer** | — | **not captured**: it opens only by clicking a row, the headless clicker matches on "starts with", and nothing in the past-audits list starts with the agency name or the date. The Audits *page* prints fine. |

**Two things to know about these renders, neither a Job E regression:**

1. **The Workspace and HR pages print nearly blank with nothing open** (`e9-print-compliance.png`,
   `e9-print-hr.png`, 16,877 bytes each: only the disclaimer and the copyright). That is **by
   design** — the title block, tabs, composer and lists all carry `no-print`, because what is meant
   to print is an **answer**, not the page. With a conversation open the same page prints 267KB of
   real content. The disclaimer surviving is 35c working as specified.
2. **A drawer printed with Cmd+P is clipped** — `e9-print-workspace-answer.png` shows the drawer as a
   720px column with the conversation list visible behind it. This is the failure
   `app/globals.css:104–108` describes, and the product's own fix is the **Print button inside the
   drawer**, which stamps `body.printing-drawer` first; my renders set print media directly and so
   bypass it. A person who presses Cmd+P with a drawer open gets this clipped page.

### 12. THE CODE DIFF — **written**

`docs/reports/jobE-code.diff` — `git diff 0d1f62e HEAD -- app lib components supabase prompts`:
**5,862 lines, 61 files, +2,996 −586**. `prompts/` is confirmed untouched (the filter returns
nothing), so the diff contains no prompt change.

---

## FOUR MORE THINGS FOUND ALONG THE WAY

**X1 — 94 unchecked reads remain, in 37 files, and 8 have the destructive shape.** Job E's list was
54 named items and it closed them; this is the state of the rest of the codebase. The shape
`const { data } = await db…` with no `error` still appears 94 times. Triaging each by what happens
when the read fails:

- **86** either guard the falsy case (`if (!x) return 404`) or make no write afterwards. Those print
  a wrong sentence; they do not destroy anything.
- **8 fall through to a write.** The two that matter most:
  - **`lib/handbookSave.ts:104`, inside H4's own fix.** `setHandbookSite`'s newest-in-chain guard:
    `const { data: newer } = …; if (newer) return ONLY_CURRENT_MOVES`. A failed read makes `newer`
    null, the guard does not fire, and the scope and site are written **from an older version down
    the whole chain** — the exact split the guard exists to prevent, in the comment's own words. The
    chain walk below it (`:111`) has the same shape: a failed read silently truncates the chain and
    the update covers fewer versions than it should.
  - **`lib/conversation.ts:92`** (`setTitleIfFirst`), a file **not in Job E's sweep at all**: a
    failed title read makes `current` empty, so the function **renames an existing conversation** to
    the newest question — defeating the one thing its own comment promises ("a later question must
    not rename the conversation").
  - The other six: three in `app/api/account/route.ts` (the account-deletion path — a failed
    `profiles` read leaves the logins undeleted while the rows go; **that file is My Account's, moved
    to §4a by the owner's own answer**), `app/compliance/page.tsx:759`, `lib/calendarDates.ts:296`
    (a failed *update* is reported as "already", showing stale values), and
    `app/api/document-draft/route.ts:131` (benign and documented — the draft is saved with a null
    ledger link on purpose).

**X2 — `GET /api/jobs/calendar-month` ignores `?dry=1`, and I sent a real email.** The dry flag is
read only by **POST** (`route.ts:113`); the **GET** handler hardcodes `run(undefined, false)` and
never looks at the query string. My first harness called it as GET with `?dry=1` and got
`dry_run=false, sent: 1`. **Nothing reached a customer**: `.env.local` sets
`NOTIFY_TEST_TO=bhaskarc@compliboard.com`, so every send from this machine is redirected to the
owner's own address — he will have one monthly-calendar email dated today, and that is my doing, not
the product's. **Job E's gate was correct**: `scripts/fixlist-gate.sh:64` uses `-X POST`, and the
re-run on the POST door printed `dry_run=true`. The route is untouched by Job E (written in Calendar
A5/B10). Worth closing anyway: a flag that is silently ignored on one method is a trap.

**X3 — `/api/signup` does not validate `industry` against the library.** My first fixture sent the
display label `"Chemical Manufacturing"`; the library uses the slug `"chemical-manufacturing"`. The
company was created happily and **nothing will ever apply to it** (0 obligations against a 200-row
library). The signup page sends the slug, so this is not reachable from the UI — but the API accepts
anything.

**X4 — audit matching is not reproducible.** Two attempts at the same section closed different sets
of previous findings (3, then 4). `CLAUDE.md` §3.2 promises deterministic *resolution*; audit
carry/close depends on the model's `same_as` answer and is not deterministic. Worth saying out loud
because "closed" is a customer-visible claim.

---

## MY OWN MISTAKES IN THIS RUN, SO THEY ARE NOT READ AS THE PRODUCT'S

1. **I called the nightly jobs with the wrong door.** `lib/jobAuth.ts` is deliberate: **GET takes
   `Authorization: Bearer <secret>`, POST takes `x-cron-secret`**, and every refusal is an opaque
   **404**. My POST sent a Bearer header and got seven 404s that looked exactly like seven broken
   jobs — the same trap Job E's gate hit from the other side.
2. **I sent the real monthly email** (X2 above).
3. **My audit query named columns that do not exist** (`audit_run_id`, `audit_section_id`; they are
   `run_id` and `section_id`) **and I discarded the error** — so it reported "0 findings" for runs
   that had 7 and 8. That is root R2, in my own verification script, and it is exactly why
   `CLAUDE.md` §9a says a check reporting an absence must be shown seeing a presence first.
4. **I read `notUsed` as rows when it is a list of sentences**, and reported "0 named as not used"
   for a state that did name one.
5. **I created a test login into Cascade** before noticing `measure-layout.mjs --as` already defaults
   to `testcascade@example.com`. It has been removed.

---

## WHAT IS LEFT ON STAGING

**Reverted, so the fixture company is as it was:** the two handbook versions added to Gamma's
`Harbor-Kitchen-Employee-Policy-2026` chain are deleted, `7e4d5c66` is current again, the copied
storage object is removed, and the extra Cascade login is deleted.

**Deliberately left, named so they can be cleared in one go:**

| what | id |
|---|---|
| company `E9 fresh 1791820402090` (200 obligations, industry back to `chemical-manufacturing`) | `6144956b-3f92-4115-abff-46196541d94b` |
| company `E9 docsonly 1791820510527` | `eb036cbd-86a7-40fc-b8df-761ad0cafc2f` |
| company `E9 docsonly 1791820560242` (2 documents, no site) | `28c3698e-9d24-4133-9a4c-4bcfa9890cdc` |
| audit run 1, Oregon State Fire Marshal | `5175146f-fdd3-4a23-8d2d-ead7ceb7d6c3` |
| audit run 2, the re-audit (and the forced retry) | `bf75ca46-a6d8-41bd-a819-4fc192e0ee7e` |
| audit findings from both | 13 rows |

Staging held **0 audit runs** before this, so those two are the only ones. **Production was not
touched at all** — no query, read or write. **Nothing was committed and nothing was pushed.**

# Workspace features — Task 2 — Foundations: running report

Started 3 October 2026. Staging and local only; nothing pushed; production read only where a
checkpoint allows it. Line numbers refer to `docs/WORKSPACE-MACHINERY.md` unless a file is named.

**`npm run cost` at the start:** $3.31, 159 calls, 2026-10-01T15:33:40 → 2026-10-03T17:51:23 (staging ledger).

---

## Checkpoint 1 — what is true in production. Read-only, nothing committed.

**How production was read.** Through `npx supabase db query --project-ref <SUPABASE_PROD_REF> --linked --agent no`.
That is the Supabase command-line tool's own database connection, as `scripts/preflight-prod.js:44`
uses it: a superuser connection, **not** the service role. The target ref was printed before
anything ran: `dsfwma…` (production; staging is `amzsav…`). Every statement is `SELECT`.

### (a) Part 9 of WORKSPACE-MACHINERY.md


Read on 3 October 2026 for `BhaskarC@compliboard.com`. Every statement is a `SELECT`, run through
`npx supabase db query --project-ref <SUPABASE_PROD_REF> --linked`. That is the Supabase CLI's own DB
connection (superuser), **not** the service role. The target ref was printed first: `dsfwma…`.
Everything after the first query is scoped to the company it returned.

```
SQL> select p.id as profile_id, p.company_id, c.name as company from public.profiles p
       join auth.users u on u.id = p.id left join public.companies c on c.id = p.company_id
      where lower(u.email) = lower('BhaskarC@compliboard.com')
 c2b9842b-84fa-4d9c-bb70-fc66d16b394d | 739a428f-1a0a-4531-8204-92ce75e4f878 | CB-Test-3
```

**Pending proposals, and whether each key is a switch:**
```
SQL> select fp.id, fp.source, fp.switch_key, fp.proposed_value, fp.document_id, fp.topic_id, fp.created_at,
            exists (select 1 from public.switches s where s.id = fp.switch_key) as key_is_a_switch
       from public.fact_proposals fp
      where fp.company_id = '739a428f-…' and fp.status = 'proposed' order by fp.created_at
 2c3d9176-… | document | powered_industrial_trucks_on_site | Yes – at least one propane forklift, Toyota 8FGU25, unit FL-2 | doc ab1a30d3-… | topic NULL | 2026-10-03 18:35:34 | false
 6006a05d-… | document | legal_entity_on_documents         | Evergreen Botanicals, LLC. This does not match CB-Test-3 or Willamette Valley Foods, Inc. | doc ca06b595-… | topic NULL | 2026-10-03 20:43:18 | false
```

**Topics since 23 September:**
```
SQL> select id, title, created_at, summary_source, summarised_at, delete_after from public.topics
      where company_id = '739a428f-…' and created_at >= '2026-09-23' order by created_at
 0622f2d3-… | 'm opening a second restaurant in Seattle with about 25 staff. What do I need for food handler permits and paid sick leave? | 2026-09-23 19:11:12 | NULL | NULL | NULL
 7e23648b-… | we are going to import 192 proof organi ethyl alcholo from Columbia. what were the regulations I have to comply?            | 2026-10-03 20:08:35 | user | 2026-10-03 20:18:45 | NULL
 00e27b4b-… | check the doc and tell me I am compliant?                                                                                   | 2026-10-03 20:43:06 | NULL | NULL | NULL
```

**The restaurant topic: title beside the first turn:**
```
SQL> select t.id, t.title, tu.position, tu.text from public.topics t join public.turns tu on tu.topic_id = t.id
      where t.company_id = '739a428f-…' and t.title ilike '%restaurant%' and tu.position = 1
 0622f2d3-… | title: 'm opening a second restaurant in Seattle … | 1 | text: 'm opening a second restaurant in Seattle …
```

**The forklift document.** Corrected statement: as first written, part 9 named `d.created_at`, and
`documents` has no such column. The query failed with `42703: column d.created_at does not exist`.
The date column is `uploaded_at` (`lib/database.types.ts:2082`). That was my composed name, which is
§9a's first rule broken.
```
SQL> select d.id, d.name, d.from_topic_id, d.uploaded_at,
            (select count(*) from public.turns tu where tu.document_id = d.id) as turns_referencing
       from public.documents d where d.company_id = '739a428f-…' and d.name ilike '%forklift%'
 ab1a30d3-… | 06a-forklift-log.pdf | from_topic_id NULL | 2026-10-03 18:34:29 | 0
```

### What this settles

- **(i) CONFIRMED.**
  - The proposal behind "Not found" was document-sourced. It is the oldest pending row, which is the one the page shows (page 283–285, 805).
  - Its key, `powered_industrial_trucks_on_site`, is **not** in `switches`.
  - It was read out of `06a-forklift-log.pdf` 65 seconds after upload.
  - Save posts that key to `/api/switches/answer`, which returns 404 `Not found` at `route.ts:53`.
  - The second pending proposal, `legal_entity_on_documents`, is not a switch either. Both would 404.
- **(ii) CONFIRMED.** Both pending proposals are `source = document`, and the page heads either one "One thing from a recent conversation."
- **(v) SETTLED: the first characters were lost before the route.**
  - The stored first turn reads `'m opening…` exactly as the title does.
  - Both come from the same `userQuestion` (`chat:420`, `:426`).
  - So the text arrived without its "I".
  - Where it was lost — the box, the keyboard, or a paste — is **not** knowable from the database. **HYPOTHESIS, unsettled**: it would take reproducing the typing on the page.
- **The forklift document was attached and never asked about, or uploaded through Documents.**
  - `from_topic_id` is null and no turn references it.
  - This is the "attach and never ask" state in 4b. Its proposal went to the workspace anyway.
- **N2 is live.**
  - Topic `7e23648b` was summarised by hand (`summary_source = user`) with `delete_after` NULL.
  - Under today's rules it would never be cleared.
- **H1 is consistent.** No topic here was ever summarised overnight.

Nothing unexpected for this brief, so I continued to checkpoint 2.

### (b) H1 — the nightly jobs

```
SQL> select job, count(*) as runs, max(started_at) as newest from public.job_runs group by job order by job
 job            | runs | newest
 audit_sections | 1    | 2026-10-01 16:13:20.903237+00

SQL> select coalesce(summary_source,'(null)') as summary_source, count(*) from public.topics group by 1 order by 1
 (null) | 2
 user   | 1

SQL> select count(*) filter (where delete_after is not null) as with_delete_after, min(delete_after), max(delete_after), count(*) as all_topics from public.topics
 with_delete_after 0 | min NULL | max NULL | all_topics 3
```

The query can see a presence: it returns one `audit_sections` row, so an empty `summarise` or
`delete` line is not a blind check.

**Vercel Cron has not been running the jobs.** The evidence:
- **No `summarise` or `delete` run has ever been recorded**, though each writes a `job_runs` row as its first step (`app/api/jobs/summarise/route.ts:48`, `app/api/jobs/delete/route.ts:39`).
- **No topic has `summary_source = 'nightly'`.**
- **No topic has `delete_after` set.**
- The one `audit_sections` row matches a sweep kicked from a request rather than the 5-minute schedule. Had the schedule run, there would be a row every few minutes. It runs only when there is work: `HANDOFF-CODE.md:493` calls it "the one production `job_runs` row". **Hypothesis:** it came from the upload/audit request's own kick; I have not read the code that does it.

**Caveat.** This shows the jobs never got past `requireCronSecret` (or were never called). It does
not show *why*. The GET-versus-POST and bearer-versus-header explanation (H1) is the likely one, and
checkpoint 3 confirms it from Vercel's documentation.

**For the owner, which I cannot see:** open **Vercel → the project → Settings → Cron Jobs**
(or the project's **Logs**, filtered on `/api/jobs/`) and read the last runs of `/api/jobs/summarise`
and `/api/jobs/delete` and their status codes. A 405 or a 404 on each would confirm H1.

### (c) The secret

- `lib/jobAuth.ts:36` reads **`process.env.CRON_SECRET`**.
- It compares it with the header **`x-cron-secret`** (`lib/jobAuth.ts:33`, `:44`).
- In the code, `CRON_SECRET` appears only there and in a comment at `app/api/jobs/audit-sections/route.ts:3`.
- **`.env.example:200` carries `CRON_SECRET=`**, blank, as a template.
- `.env.local` has a value; it is not printed here.
- `docs/RELEASE.md:77` records it as added to Vercel on 23 September.

### (d) The first night, if the jobs start working (counts read now, production)

```
SQL> -- summarise: the job's own candidate rule (jobs/summarise:53–76), and which have turns
select count(*) as candidates,
       count(*) filter (where exists (select 1 from public.turns tu where tu.topic_id = t.id)) as with_turns
  from public.topics t
 where t.last_turn_at is not null
   and ((t.summarised_at is null and t.last_turn_at < now() - interval '24 hours')
     or (t.summarised_at is not null and t.last_turn_at > t.summarised_at))
 candidates 1 | with_turns 1

SQL> -- delete under today's rules: due (delete_after < now) or unsummarised > 30 days, with turns
select count(*) as topics, coalesce(sum(n),0) as turns from (
  select t.id, (select count(*) from public.turns tu where tu.topic_id = t.id) as n
    from public.topics t
   where (t.delete_after is not null and t.delete_after < now())
      or (t.summarised_at is null and t.last_turn_at is not null and t.last_turn_at < now() - interval '30 days')) x
 where n > 0
 topics 0 | turns 0

SQL> select status, count(*), count(*) filter (where reading_since is null) as unclaimed from public.documents group by status order by status
 held 39 (39 unclaimed) | read 4 (4 unclaimed)

SQL> select status, count(*) from public.audit_sections group by status order by status
 done 3

SQL> select status, count(*) from public.audit_runs group by status order by status
 done 1
```

The turn count in the first query came back 1, which shows it can see turns. The delete query's 0
is therefore real: production's three topics are all newer than 30 days, and none has `delete_after`.

| Job | First night on production | Cap per run |
|---|---|---|
| summarise | **1 topic → 1 model call.** At the staging ledger's `summarise` figures that is **$0.0010 median, $0.0011 worst**. Those are Haiku rows; production's `AI_MODEL_SUMMARY` value is not recorded in `RELEASE.md:77`, so the production price may differ. | **None.** Every candidate in one loop (`jobs/summarise:58–76`, `:79`) |
| delete | **0 topics, 0 turns.** The summariser at 03:00 would also stamp `delete_after = +7 days` on the one topic it summarises (`jobs/summarise:125–134`), so nothing is due on night one. | **None** (`jobs/delete:48–66`) |
| scan-documents | **Nothing waiting.** The queue is `status = 'uploaded'` (`scan-documents/route.ts`, sweep at :153–155); production has 0 such rows. The 39 `held` are skipped by construction (header rule 4a). | Time only: stops starting work at `BUDGET_MS − RESERVE_MS` = 640 000 − 130 000 ms = 510 s (`scan-documents/route.ts:88`, `:90`) |
| audit-sections | **Nothing waiting.** 3 sections and 1 run, all `done`. | Time (`audit-sections/route.ts:35–36`), and at most 50 runs considered per pass (`:83`) |

**The first night is small.** On today's numbers checkpoint 3's per-run cap on summarise is not
forced. I will propose one anyway at checkpoint 3, and leave the decision to the owner.

**Touches other sections:**
- none yet, because nothing has been changed;
- the readings cover Documents (`documents.status`) and Audits (`audit_sections`, `audit_runs`), because their sweeps share the cron.

---

## Checkpoint 2 — retention: 12 months

**The rule.**
- A topic's turns are kept 12 calendar months after its **last turn**.
- Past that, they are cleared only if the topic has a summary written **at or after** that last turn.
- Otherwise the deleter **skips** the topic and lists it in `job_runs` as `skipped_no_summary`. The nightly summariser's candidate rule — never summarised, or spoken to since the summary (`app/api/jobs/summarise/route.ts`, the two candidate queries) — is exactly that set, so it writes the summary first.
- Who wrote the summary (`summary_source`) is not an input, so a hand-made summary no longer stops clearing (machinery N2).

**Computed, not stored. The reasons:**
- `last_turn_at` is already moved by the one function every saved turn passes through (`lib/conversation.ts` `touchTopic`). A date computed from it cannot drift.
- A stored `delete_after` would have to be re-stamped on every turn-saving path; the one that forgot would clear a conversation early or never.
- So `delete_after` is no longer written or read by either job.
- The column stays, because dropping it needs a migration this rule does not.
- `touchTopic` still nulls it, so a value left by an older build cannot linger.

**One reading of "a summary".** I took it to mean a summary that covers the last turn. A summary
written before later turns does not describe them, so clearing on its strength would lose those
turns. Such a topic is skipped until the nightly job re-summarises it.

**The brief's two instructions on the job routes.** The rules say not to change any `app/api/jobs`
route; checkpoint 2 says to change what `jobs/summarise` and `jobs/delete` do. I read checkpoint 2 as
the specific instruction:
- **changed:** the two routes' bodies;
- **unchanged:** their exports (`POST` only), `requireCronSecret`, `lib/jobAuth.ts`, `vercel.json`, and the other two job routes.

**Files:**

| File | Change |
|---|---|
| `lib/retention.ts` (new) | `RETENTION_MONTHS = 12`, `clearsAt`, `clearingCutoff`, `clearingDecision` → `keep` / `clear` / `skip_no_summary` |
| `app/api/jobs/delete/route.ts` | Lists topics with `last_turn_at` older than the cutoff, decides each with `clearingDecision`, clears turns only on `clear`. A topic already cleared (0 turns) is not logged again. **The 30-day backstop that cleared unsummarised topics is removed.** `job_runs.counts` gains `skipped_no_summary` (ids) |
| `app/api/jobs/summarise/route.ts` | No longer stamps `delete_after` (`RETAIN_DAYS = 7` removed); header says why |
| `lib/conversationStatus.ts` | The kept label is `Summarised · full conversation kept until <date>`, the date being last turn + 12 months, in UTC. Once due and not yet cleared: `Summarised · full conversation due to be cleared`. `TopicLike` drops `delete_after` |
| `app/compliance/page.tsx` 1153 | Retention line, exactly as given: *"Full conversations are kept for 12 months after the last message. Summaries are kept until you delete them."* It no longer says *"Anything you uploaded stays in Documents."* — the brief's line replaces the whole sentence |
| `app/compliance/page.tsx` 1322, `app/api/topics/[id]/route.ts:53` | The cleared note: *"…cleared 12 months after the last message. The summary … is kept."* |
| `app/api/topics/[id]/summarise/route.ts`, `lib/conversation.ts` | Comments that stated the 7-day rule |
| `tests/unit/retention.test.ts` (new) | 11 months kept; 13 months cleared; 13 months no summary skipped; plus stale summary skipped, blank summary skipped, hand summary cleared, no turns kept, the date, the cutoff |
| `tests/unit/conversationStatus.test.ts` | The date tests rewritten to the new rule; the "cleared is decided by turns, not the date" tests kept |
| `docs/TESTING.md` 473, 596, 616, 617 | Manual expectations that stated the old rule. **617 inverted:** a 13-month topic with no summary must now be *skipped*, not cleared |

**Gate.** `npm run check` exit 0: `569 tests, 0 skipped, 0 todo, floor 559. OK`; build compiled.
That is 10 tests more than the floor; the floor is not raised in this commit.

**Not tested here.** The two job routes were not called; that needs `CRON_SECRET` and a running
server, and the cron itself is deferred. The rule is tested through `clearingDecision`, which is what
the deleter calls.

**Touches other sections:**
- **Account / export** (`app/api/account/route.ts`, `app/api/account/export/route.ts`): unchanged code, but transcripts now live up to 12 months, so a deletion or export carries more turns than under the 7-day rule.
- **`docs/HANDOFF-WORKSPACE.md` §3** quotes the old retention line. It is a dated record, left as written.
- **`docs/WORKSPACE-MACHINERY.md`** 4e and N2 describe the old rule. Left as the record of what was found.
- **Nothing in Documents or Audits reads `topics` or `turns`.**

---

## Checkpoint 3 — For the cron release (written up, not done; no code changed)

**Why the jobs never run.** The owner read it in Vercel's logs on 3 October: every scheduled call
is `GET` → 405. The routes export only `POST` (`jobs/summarise:48`, `jobs/delete:32`,
`jobs/scan-documents:107`, `jobs/audit-sections:40`). Even with GET accepted, the secret check reads
`x-cron-secret` (`lib/jobAuth.ts:33`), and Vercel does not send that header.

**What Vercel sends.** From https://vercel.com/docs/cron-jobs/manage-cron-jobs, read 3 October:
- *"The value of the variable will be automatically sent as an `Authorization` header when Vercel invokes your cron job"*;
- *"The `authorization` header will have the `Bearer` prefix for the value."*;
- its examples are `GET` handlers.

The method itself is settled by the owner's logs, not by a sentence on that page.

### What to change

1. **`lib/jobAuth.ts`, `requireCronSecret` (:35–55), once for all four routes.**
   - Keep reading `process.env.CRON_SECRET` (:36) and keep refusing when it is unset (:37–43).
   - Accept the request when **either** `x-cron-secret: <secret>` (:33, manual runs) **or** `authorization: Bearer <secret>` (Vercel) matches.
   - Compare both with `timingSafeEqual`, as :44–48 already does for the first.
   - **Decision for the owner:** what a refusal answers. Today it is 404 (:52), deliberately opaque, so the route cannot be confirmed to exist; Vercel's example answers 401. Keeping 404 changes nothing anyone relies on.
2. **The four routes** each gain `export async function GET(request: NextRequest) { return POST(request) }` beside the existing `POST`:
   - `app/api/jobs/summarise/route.ts:48`
   - `app/api/jobs/delete/route.ts:32`
   - `app/api/jobs/scan-documents/route.ts:107`
   - `app/api/jobs/audit-sections/route.ts:40`

   POST + `x-cron-secret` stays exactly as it is, so `docs/TESTING.md:2505–2510` and the runbooks keep working.
3. **Tests:**
   - GET with the right bearer runs;
   - GET with no bearer, or a wrong one, is refused;
   - POST with `x-cron-secret` still runs;
   - unset `CRON_SECRET` refuses both.
4. **`vercel.json`: no change.** The four paths and schedules are right.
5. **Vercel: nothing to add.** `CRON_SECRET` already exists there (owner, 3 October; `docs/RELEASE.md:77`). It must hold the same value as the one used for manual runs. **It takes effect only with the push that ships the change above.**

### What each job will do on its first run

Counts read from production on 3 October (checkpoint 1(d)), with the 12-month rule from checkpoint 2:

| Job | Schedule (`vercel.json`) | First run | Per-run limit |
|---|---|---|---|
| summarise | `0 3 * * *` | **1 topic, 1 model call** (staging ledger: $0.0010 median, $0.0011 worst on Haiku; production's `AI_MODEL_SUMMARY` value is unrecorded). Then any conversation idle for 24 hours, every night | **None.** Every candidate in one loop (`jobs/summarise:83`), bounded only by `maxDuration = 800` (`:40`) |
| delete | `30 3 * * *` | **Nothing.** The oldest production topic is 23 September 2026, so the first turns can fall due on 23 September 2027 | **None** (`jobs/delete:51`), `maxDuration = 800` (`:30`) |
| scan-documents | `*/5 * * * *` | **Nothing waiting** (0 `uploaded`); the 39 `held` documents are never picked up by construction | Stops starting documents at 510 s: `BUDGET_MS − RESERVE_MS`, 640 000 − 130 000 ms (`scan-documents:88`, `:90`) |
| audit-sections | `*/5 * * * *` | **Nothing waiting** (3 sections, 1 run, all `done`) | 510 s the same way (`audit-sections:35–36`); at most 50 runs considered per pass (`:83`) |

These counts are from 3 October and will be read again before the release. A small first night
means **no per-run cap on the summariser is forced**. If the release waits until there are hundreds
of idle conversations, cap it then: oldest first, 50 a night.

### One risk the release should carry

Vercel's page says delivery *"can also occasionally invoke the same scheduled run more than once"*.

| Job | Safe if invoked twice? |
|---|---|
| delete | **Yes.** A cleared topic has 0 turns and is skipped |
| scan-documents | **Yes.** It claims by compare-and-set (`scan-documents.ts` header, rule 2) |
| audit-sections | **Yes.** It claims by compare-and-set |
| **summarise** | **No.** It claims nothing |

**HYPOTHESIS, from reading `jobs/summarise:58–83`; not run.** Two summarise invocations alive at the
same time would each pick up the same idle topic:
- two `summarise` model calls;
- the summary written twice;
- **every fact proposal inserted twice** (`:158`; no unique index, `055:114–116`).

The fix is a claim, as the sweeps do — for example a compare-and-set on `extracted_at`. It belongs
in the cron release.

**Touches other sections:**
- **Documents:** `scan-documents` starts sweeping every 5 minutes. It picks up `status='uploaded'` documents a folder upload leaves behind (today it runs only when a request kicks it).
- **Audits:** `audit-sections` starts sweeping every 5 minutes. It runs `queued` sections and sends the run's email on finish (`lib/auditNotify.ts`).
- **Workspace:** summaries and conversation fact proposals start appearing overnight. Those proposals reach **Company information / To confirm** and the workspace's proposal slot.

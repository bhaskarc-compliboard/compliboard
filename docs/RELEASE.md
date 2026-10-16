# RELEASE — HOW A CHANGE REACHES PRODUCTION

*Written 24 September 2026 from the two releases of 23 September (Runs 1–3 + Fix Round 1, then Fix Round 2). The owner runs every step below. Claude Code never runs anything against production.*

*Updated 16 October 2026, Calendar step 14 (`DECISIONS.md` §200): **the Calendar's release routine** below, the monthly-email cron row, and the sending-domain gate. Two corrections while writing it: this file has **never** carried a backup step (one is written below, and it is new, not quoted), and **`check:live` cannot be pointed at production** — it signs in as a staging fixture and writes rows. The free production checks are unauthenticated HTTP probes, listed in the routine.*

*Updated 8 October 2026, §183: the cron table, the morning-after paragraph and the free checks describe HR live.*

*Updated 8 October 2026: `AI_MODEL_HR` and `AI_MODEL_HR_CHECK` = `claude-opus-5-5`, added by the owner at HR's release (§181).*

*Updated 8 October 2026: production's address recorded (`https://compliboard.vercel.app`) with the free checks after a push.*

*Updated 8 October 2026: the three research switches confirmed `true` on production, re-entered as visible by the owner; HR reads the same three (below).*

*Updated 4 October 2026, at the close of the workspace work: `check:live` before a release runs on the dead port 3999; the retention gate states the 12-month rule; no Vercel variable changed with the Stage 4 or cron releases.*

---

## The one rule

**Migrations first, then variables, then code.** Every migration is additive, so the old code ignores new tables and nothing changes for customers when a migration lands. Code that ships before its migration looks for tables that aren't there and fails quietly. Code first is never acceptable.

## The facts that shape the procedure

- **PRODUCTION IS `https://compliboard.vercel.app`** (the owner, 8 October 2026). `compliboard.com` is the marketing site
  (Framer, a separate site), and **`app.compliboard.com` does not exist** (NXDOMAIN, 8 October): an earlier session
  used it, and the check it was meant for could not run. Do not guess an address; this line is the record.
  - **The free checks after a push** (no login, nothing written), since HR went live (8 October, `804d85e`):
    `GET /hr` → 200 with the new HR page; `GET /hr/new`, `/api/hr` and `/api/hr-audits` → 404 (gone);
    `POST /api/hr/answer` with no login → 401. *(Before the go-live the line read "`GET /hr/new` → 404 while HR is
    off", with `PATCH /api/handbooks` 404/405 telling which deploy served; with the switch gone it answers 401.)*
  - **A 200 page contains "This page could not be found" twice.** That is Next's built-in not-found template, and
    `/compliance` has it too. A real 404 page has it six times.
- There is **no staging deployment**. "Staging" means the owner's laptop (`npm run dev`) pointed at the staging database. The only deployed app is production.
- **A `git push` to `main` deploys production.** Vercel builds on every push and reads its Environment Variables at build time. There is no separate "redeploy" step after a push. Changing a variable on its own also triggers a redeploy.
- The owner's laptop reads `.env.local`; production reads Vercel. They are separate. A model or switch changed in one is not changed in the other.
- Two Supabase databases: staging (`amzsavsrabrlcprltpom`) and production (`dsfwmafnphdlfogetsus`). The migration scripts print which one they target and refuse to run against production without the word `PRODUCTION` typed by a person.

## Before a release

All three must be true:

1. `npm run check` is green (Claude Code's report says so, with the test count).
2. `npm run check:live` has run on staging with every pending migration applied (Claude Code's report says so). A migration that adds or alters a tenant table does not go to production without this. **The owner's free run is `CHECK_LIVE_BASE_URL=http://localhost:3999 npm run check:live`**: nothing listens on 3999, so the table probes run and nothing paid is called (`CLAUDE.md` §3.11). A full run that drives the routes is paid and goes against an isolated Haiku server, when a brief asks for it (`docs/HOW-WE-BUILD.md` §3c).
3. The owner has done the manual tests in `docs/TESTING.md` for the feature being shipped, on the laptop against staging.

## The cron entries (`vercel.json`) — as of 8 October 2026 (HR Step 10, `DECISIONS.md` §178)

| Path | Schedule (UTC) | What it does |
|---|---|---|
| `/api/jobs/summarise` | `0 10 * * *` — 10:00 | Nightly summaries of conversations quiet 6 hours or more: the workspace's and HR's (HR's since the go-live, 8 October) |
| `/api/jobs/delete` | `30 10 * * *` — 10:30 | Clears transcripts 12 months after the last message |
| `/api/jobs/scan-documents` | `*/5 * * * *` | Documents sweep |
| `/api/jobs/audit-sections` | `*/5 * * * *` | Audits sweep |
| `/api/jobs/handbook-queue` | `0 10 * * *` — 10:00 | HR's night queue: queues the handbook checks that are due (live since 8 October; a 404 without the cron secret) |
| `/api/jobs/handbook-checks` | `*/5 * * * *` | HR's handbook sweep (live since 8 October; a 404 without the cron secret) |
| `/api/jobs/calendar-month` | `0 14 1 * *` — **the 1st at 14:00** | The monthly calendar email, one per company (Calendar step 11, `DECISIONS.md` §197). **It is the only job that mails every person at every company on a schedule nobody presses**, and the only one gated on the sending domain — see the calendar routine below |

The summary job and the deleter ran at 03:00 and 03:30 UTC until 8 October.

**The morning after a deploy:** check `job_runs` — a `summarise` row started after 10:00 UTC (HR conversations
included since HR went live), a `delete` row after 10:30 UTC, and `handbook_checks` rows from the night queue and the
sweep, each with `finished_at` set. The queue and the sweep both write under the job name `handbook_checks`; each
row's counts show which job wrote it (`job: 'queue'` for the night queue). The two read-only queries are in
`docs/HANDOFF-FROM-HR.md` §7 item 3.

## The procedure

All commands in Terminal 3, from `~/Desktop/Compliboard`.

**Step 1 — see what's pending on production.**
```
npm run preflight
```
It prints every migration on disk, every one applied on production, and the difference. Read the pending list. It must be exactly the migrations this release adds and nothing else. If it names anything unexpected, stop.

**Step 2 — apply them.**
```
npm run db:migrate:prod
```
It shows the production ref, lists the pending files again, and asks for the word `PRODUCTION`. Check the list matches step 1, type it, wait for "Finished". It regenerates `lib/database.types.ts` from production afterwards.

**Step 3 — variables, only if this release adds any.**
Vercel dashboard → the project → Settings → Environment Variables → Add Environment Variable. Key, value, tick **Production**, Save. One at a time. Keep secrets (like `CRON_SECRET`) in a note; Vercel hides them after saving. Claude Code's report names any new variable a release needs.

**Step 4 — confirm the tree is clean and the types agree.**
```
git status --porcelain && npm run typecheck
```
Empty status (or only `lib/database.types.ts`) and a green typecheck. If the types file changed after step 2, commit it.

**Step 5 — push.**
```
git push
```
Watch the Vercel dashboard until the deployment is green.

**Step 6 — prove it on the live site.**
Sign in with a test account and run the first three manual tests for the feature: for the research section, ask a question, ask a follow-up, attach a PDF. Only then is the release done.

## THE CALENDAR'S RELEASE ROUTINE — written 16 October 2026 at step 14 (`DECISIONS.md` §200)

*Every command below is one the owner pastes, in this order. Claude Code has run none of them. The
branch is `calendar-v2`, **22 commits ahead of `origin/main` and 0 behind** (read 16 October); the
pending migrations are **073–078**, six of them, and `npm run preflight` says so in full.*

**WHAT CAN GO TODAY AND WHAT WAITS FOR THE DNS.** The gate is on the *email*, not on the release:

| | |
|---|---|
| **Today, with no DNS** | the backup (2), the migrations (3), `AI_MODEL_CALENDAR` (4), the merge and push (5), the free checks (6), the guard's own probe (7), the one paid answer (8), the morning after (9). **The whole Calendar works for a signed-in person** — the dates, the chat, the queue, the drawer, the feed, printing. |
| **Waits for the DNS (step 0)** | **the monthly email, and only that.** Until the domain is verified and step 0.3 is pushed, the 1st-of-the-month job refuses itself and nobody is emailed. That is the designed state; `job_runs` records each refusal. |

If the DNS is verified before 1 November, nothing else is needed — the cron sends on its own. If it
is not, the first email is simply the first of December, and no customer sees anything missing.

> ### ⛔ STEP 0 IS A GATE, NOT A STEP: THE SENDING DOMAIN.
>
> Every product email today is sent `from: CompliBoard <onboarding@resend.dev>`. **That is Resend's
> shared sandbox address, not a CompliBoard one.** The three existing emails (documents, audits, HR
> checks) are each a reply to something a person just did, and they have been going out that way
> since June. The monthly calendar email is different in kind: it goes **to every person at every
> company**, on `0 14 1 * *`, with nobody watching. On production `NOTIFY_TEST_TO` is absent by
> design, so there is no test address to catch it.
>
> **So the code refuses rather than trusting this page.** `lib/email.ts` `sandboxSenderRefusal`:
> on production, with the sandbox sender still in place, the job claims nothing, sends nothing,
> prints `CALENDAR EMAIL NOT SENT: …` and writes the reason onto its `job_runs` row. A dry run is
> still let through, because it sends nothing by construction. **Until step 0.3 is done, the first
> of the month is safe and the email does not go out.** That is the intended state, not a failure.

**Step 0.1 — add the domain in Resend.** Resend dashboard → Domains → Add Domain. **Use a
subdomain**, e.g. `send.compliboard.com`: the root `compliboard.com` already carries the Framer
marketing site's records, and a sending subdomain keeps the two sets of DNS from ever being
confused with each other. (The From address can still read `dates@compliboard.com` if you prefer;
the records are what must live on the subdomain.)

**Step 0.2 — add the records your dashboard prints, not the ones in any guide.** Resend's Records
tab shows the exact records for *your* domain. Historically that is three — an **MX** for the
return path, a **TXT** SPF record, and a **TXT** DKIM record at `resend._domainkey` — but Resend's
own troubleshooting page says **domains added after August 2026 may be given CNAME records
instead**, and this domain would be added now. **Copy what the dashboard shows.** Three things go
wrong most often, all of them avoidable:

- the DKIM value gets truncated or picks up a stray quote on paste — it is the longest value and the
  usual culprit;
- some registrars append your domain to an MX value, which breaks it — a trailing dot fixes it;
- on Cloudflare, a CNAME must **not** be proxied (grey cloud, not orange).

Confirm from the command line before clicking Verify, so a failure is the registrar's and not a
mystery (replace the names with the ones the dashboard gave):

```
nslookup -type=TXT resend._domainkey.send.compliboard.com
nslookup -type=TXT send.compliboard.com
nslookup -type=MX  send.compliboard.com
```

Then press Verify in Resend. It is usually minutes; DNS can take up to 72 hours, and the dashboard
has a **Restart verification** button for when records were fixed after a failed attempt.

**Step 0.3 — the one commit that moves all four senders.** Four `from:` lines, read from the files
on 16 October. Change all four in one commit so none is left behind, and give the three older ones
the guard at the same time:

| File | Line | What it sends |
|---|---|---|
| `lib/email.ts` | `SANDBOX_FROM` | the constant the calendar job uses — **change this one and the calendar email moves** |
| `lib/documentBatch.ts` | 215 | the Documents batch email |
| `lib/auditNotify.ts` | 186 | an audit run finished |
| `lib/handbookCheckNotify.ts` | 103 | an HR handbook check finished |

*(There is a **fifth** `from:` — `app/api/feedback/route.ts:11` — and it is deliberately not in
that table. It goes to `FEEDBACK_EMAIL`, the owner's own inbox, never to a customer, so the gate
does not apply to it. Move it with the rest if you like the tidiness.)*

> **Why the three older senders do NOT carry the guard today.** All three send from the sandbox
> address on production **right now**. Switching the guard on for them in this release would
> silence three emails that work — a change nobody asked for, shipped in the release of something
> else. They take `sandboxSenderRefusal` in the commit above, where it is inert from the moment it
> lands. `tests/unit/calendarEmail.test.ts` holds a test that **fails** when their `from:` lines
> change, and the sentence it fails on says to give them the guard.
>
> **And one question only the Resend dashboard can answer**, worth asking while you are in it:
> the shared sandbox sender is normally limited to the account's own verified address. If that is
> true here, the audits/documents/HR emails have never reached anyone but you — check
> Resend → Logs for a delivery to an address that is not yours. This is a hypothesis; the dashboard
> settles it. Nothing in this repository can.

---

**Step 1 — see what's pending.** As the generic procedure, `npm run preflight`. **It must say
`PENDING COUNT: 6`** and name exactly `073`–`078`. It said that on 16 October: 79 files on disk,
73 rows in production's history.

**Step 2 — take a backup first. THIS STEP IS NEW AND THIS FILE HAS NEVER CARRIED ONE.** Every
release before this one was purely additive — new tables the old code ignores — so there was
nothing a rollback could not survive. **073 is the first migration that changes a table holding
customer rows**: it drops `completed`, `completed_at`, `category`, `is_recurring` and
`recurrence_period` from `calendar_events`, over **47 real rows**, and a dropped column is not
additive and cannot be reverted by reverting a commit.

`.env.local` is not loaded in your shell, so the ref is read out of it on the same line
(that is the only reason this looks long):

```
REF=$(grep -m1 '^SUPABASE_PROD_REF=' .env.local | cut -d= -f2) && \
OUT=~/Desktop/prod-calendar-backup-$(date +%Y%m%d).sql && \
npx supabase db dump --project-ref "$REF" --linked --data-only -s public -f "$OUT" && \
wc -l "$OUT" && grep -c calendar_events "$OUT"
```

The last two numbers are the check: a line count that is not zero, and `calendar_events` appearing
in the file. A dump that wrote nothing looks exactly like a dump of an empty database. Supabase
also takes its own backups — Dashboard → Database → Backups shows the retention on this plan — but
this one you can point at by name, which is what you want at 2am.

**Step 3 — apply 073–078.** `npm run db:migrate:prod`, the typed `PRODUCTION`, as the generic
procedure. **What production will do, read from production on 16 October so the numbers are not a
surprise:**

| | |
|---|---|
| `calendar_events` before | **47 rows**, 2 companies, 0 with a null `company_id`, 0 with a `document_id`, 0 `completed`, all `category = 'compliance'` |
| 073 makes them | all **`confirmed`**, all `source = 'person'` (no row names a document), 24 `recurs = true` |
| the period words | 19 `annually` → `year`. **3 `biennially` and 2 `every 3 years` map to NULL** — the product has no word for those, so those five become "repeats — how often wasn't read" and appear in the how-often picker on *Dates to confirm* (decision 23). That is correct behaviour, and it is five rows a person will be asked about |
| 074 then files | **27 rows and 27 stamps** — 27 document deadlines on a current scan, all eligible, all fileable, **0 undated one-offs skipped**, 27 distinct keys. All 27 belong to **one** company, which has **0 calendar rows today**, so its *Dates to confirm* badge goes from 0 to 27 and 7 of those repeat with no day yet |
| `calendar_events` after | **74 rows** |
| nothing already exists | `calendar_mailings`, `calendar_feed_tokens`, `calendar_v`, both new indexes, both 078 functions, `calendar_events.status/source/replaced_by` and `audit_findings`'s `unique (company_id, id)` — **all eleven absent**, checked with controls that proved the probe could see what *is* there |

**Step 4 — the variables, BEFORE the push.** A variable change is itself a redeploy, so doing them
first means the deployment that first serves the Calendar already has them. Vercel → Settings →
Environment Variables, tick **Production**, Save.

| Variable | Value | Why |
|---|---|---|
| `AI_MODEL_CALENDAR` | `claude-opus-5-5` | **The one addition this release needs.** Unset, the Calendar's answers fall back to `AI_MODEL_PROSE`, which is the same model — so nothing moves today, and that is exactly the problem: the choice would be an accident of a fallback chain rather than a decision anybody can read back. Set it and it is in this table. `lib/ai.ts:151` |

And four this release reads and production **already has** — nothing to do, listed so nobody adds a
second copy: `NEXT_PUBLIC_APP_URL` (the links in the email and the date drawer), `RESEND_API_KEY`,
`CRON_SECRET` (the job's only door), `AI_EFFORT` (`medium`).

Two that must stay as they are:

- **`NOTIFY_TEST_TO` stays ABSENT.** Set on production, every customer's calendar email goes to that
  one address instead of to them. The line at the foot of this file already says it; it matters more
  now, because this is the first email with no human in the loop.
- **`ASK_CONTEXT_BUDGET_TOKENS` stays unset**, which means 120,000 tokens of context per answer
  (`lib/ask/calendarBrief.ts:39`). Set it only to make an answer cheaper on purpose.
- **There is no search cap for the Calendar's answers**, by inheritance: `AI_SEARCH_MAX_HR` is unset
  and the Calendar reads the same "no limit". Step 13 measured an answer at **$0.157–$0.273 capped
  at two searches**, so uncapped is a floor, not a ceiling. If that is not acceptable, it is a code
  change and not a variable — say so and it gets one.

**Step 5 — merge and push.** `main` has not moved since 9 October (`54ec6ae`), so this is a
fast-forward and there is nothing to resolve:

```
git status --porcelain && npm run typecheck     # empty, green
git checkout main && git merge --ff-only calendar-v2 && git push
```

Watch Vercel until the deployment is green. *(If `main` has moved by the time you run this, stop:
the merge wants looking at, not forcing.)*

**Step 6 — the free checks on production.** No login, nothing written, nothing paid.

> **`npm run check:live` is NOT one of them, and cannot be made into one.** It signs in as the
> staging fixture `testgamma@example.com` and **writes a probe row into every tenant table**, and it
> builds its database client from `NEXT_PUBLIC_SUPABASE_URL` — staging — so pointing
> `CHECK_LIVE_BASE_URL` at production would drive production's routes with a staging token (401 on
> everything) while still writing to staging. It stays on staging, where Claude Code runs it.
> `scripts/check-live.js:66–92`.

These are the calendar's equivalents, in the shape of the existing free checks above:

```
curl -s -o /dev/null -w '%{http_code}\n' https://compliboard.vercel.app/calendar
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://compliboard.vercel.app/api/calendar/answer
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://compliboard.vercel.app/api/jobs/calendar-month
curl -s -o /dev/null -w '%{http_code}\n' 'https://compliboard.vercel.app/api/calendar/feed/not-a-real-token'
```

Expect **200** (the page shell, as every signed-in page returns), **401** (no login), **404** (no
cron secret — the job must not even admit it exists), **404** (an unknown feed token). Then sign in
and look at `/calendar`: the four tabs, the counts, and the *Dates to confirm* badge reading what
step 3's table predicted for your company.

**Step 7 — prove the guard, for free, on production.** One call, and it is the only way to see the
gate from the outside:

```
SECRET=$(grep -m1 '^CRON_SECRET=' .env.local | cut -d= -f2-) && \
curl -s -X POST -H "x-cron-secret: $SECRET" \
  'https://compliboard.vercel.app/api/jobs/calendar-month?month=2026-12' | python3 -m json.tool
```

*(`CRON_SECRET` in `.env.local` and the one on Vercel must be the same value for this to work; if
it answers 404, that is what to check first.)*

Before the DNS is verified this answers **503** with `"refused": "the sender is still
onboarding@resend.dev…"`, and `calendar_mailings` stays empty for that month. After step 0.3 it
sends. **Either answer is information and neither costs anything.** To see what the email would
*say* without sending it, add `&dryRun=1`: a dry run claims nothing, sends nothing, and reports
`would_be_refused` so you can tell the guard is armed.

**Step 8 — the one paid check.** Sign in as your own company and ask the Calendar one question
about a date you have. **About $0.20** at production settings (step 13 measured $0.157–$0.273 with
searches capped at two; production has no cap, so treat $0.20 as the floor). Read the answer
against the three things step 13 found Opus does well: it cites official sources, it says which
document a date came from, and it says *"I can't tell you yet"* where it does not know. If it
asserts a rule number with no source, that is the one failure worth reporting.

**Step 9 — the morning after, and then the 1st.** The generic morning-after paragraph plus one
calendar row:

```sql
-- the overnight jobs, as usual, and the calendar email's own row if the 1st has passed
select job, started_at, finished_at, ok, counts, errors
  from job_runs where started_at > now() - interval '36 hours' order by started_at desc;
```

There will be **no `calendar_month` row until the 1st** — it is a monthly cron, so its absence on
the 17th is correct and not a failure. On **1 November, after 14:00 UTC**, that row is the whole
step 15:

```sql
select company_id, month, sent_at, sent_to, error from calendar_mailings where month = '2026-11';
```

One row per company with a person, `sent_at` stamped, `sent_to` holding the real addresses, `error`
null. **Four people across four companies** is what production holds today (10 companies, 6 of them
with nobody on them, which the job skips as "nobody to send to"). Every one of those four companies
has exactly **one site**, so no email in this release groups its dates by site (decision 24).

## Rolling back

- **Code:** revert the commit and push. Migrations stay; they're additive and the old code ignores them.
- **A switch or model:** change the Vercel variable. Rollback is one value, no push.
- **A migration:** don't. Additive migrations are left in place. If one must be undone, that is a new migration, written and reviewed like any other.

## Still owed before real customers (release gates)

- Credential rotation (see `docs/HANDOFF-CODE.md` and `TODO.md`).
- The privacy-policy line stating the retention promise (gate four): **full conversations are kept 12 months after the last message; summaries until the person deletes them** (Workspace Task 2, `lib/retention.ts`; `DECISIONS.md` §154). *(Corrected 4 October 2026: this line said transcripts are cleared 7 days after summarising — the rule before Task 2.)* The deleter that enforces it runs nightly from the cron release (`DECISIONS.md` §162).

## Variables currently set on Vercel Production (as of 4 Oct 2026, after the Workspace Task 6 release)

*(4 October 2026, at the close of the workspace work: **unchanged** by the Stage 4 Part 2 release (migration 065) and the cron release — both needed no variable; the cron release uses the `CRON_SECRET` already set.)*

**This list is the authoritative record of what Vercel holds.** `CLAUDE.md` §3.4a points here and deliberately does not keep a second copy: on 26 September that section and this one disagreed about whether the `AI_MODEL_*` variables are set at all, which made the model that reads a customer's document unknowable from the repository. It was settled by reading the dashboard, §3.4a was the one that was wrong, and the rule now is **the dashboard wins and this list gets corrected.** `DECISIONS.md` §136.

> ### THE MODELS, EFFORT AND SEARCH LIMITS IN PRODUCTION — 4 OCTOBER 2026 (THE OWNER), AFTER THE TASK 6 RELEASE.
>
> **Every value in this table is saved on Vercel Production as VISIBLE (not sensitive)**, so each can
> be read back from the dashboard — and **the dashboard wins** over this file. Line numbers are
> `lib/ai.ts` at `a701436`.
>
> | Variable | Production value (owner, 4 October 2026, visible) | Read by |
> |---|---|---|
> | `AI_MODEL_PROSE` | `claude-opus-5-5` | `lib/ai.ts:108` |
> | `AI_MODEL_JUDGEMENT` | `claude-opus-5-5` | `lib/ai.ts:106` |
> | `AI_MODEL_SUBSTEPS` | `claude-opus-5-5` | `lib/ai.ts:114` |
> | `AI_MODEL_SUMMARY` | `claude-opus-5-5` (was Sonnet until 4 October) | `lib/ai.ts:115` |
> | `AI_MODEL_DOCUMENT_SCAN` | `claude-opus-5-5` | `lib/ai.ts:122` |
> | `AI_MODEL_DOCUMENT_DRAFT` | `claude-opus-5-5` | `lib/ai.ts:126` |
> | `AI_MODEL_AUDIT` | `claude-opus-5-5` | `lib/ai.ts:133` |
> | `AI_MODEL_CRITIQUE` | `claude-opus-5-5` | `lib/ai.ts:104` |
> | `AI_MODEL_HOWTO` | `claude-opus-5-5` — **added 4 October with the Task 6 release** | `lib/ai.ts:138` |
> | `AI_MODEL` (the fallback for all of them) | `claude-opus-5-5` | `lib/ai.ts:104–115`, `:139` |
> | `AI_EFFORT` | **`medium`** — **re-entered 4 October as visible.** Before that it was hidden and its value unknown, so **every production result before 4 October ran at an unknown effort**. `lib/ai.ts:794` `DEFAULT_EFFORT` is also medium, so unset would mean the same | `lib/ai.ts:797` |
> | `AI_EFFORT_HOWTO` | **unset** — so "How do I do this?" falls back to `AI_EFFORT`, i.e. medium | `lib/ai.ts:815` |
> | `AI_SEARCH_MAX_HOWTO` | `6` — added 4 October with the Task 6 release | `lib/ai.ts:240` `searchLimit` |
> | `AI_SEARCH_MAX_COMPLETE` | `8` — added 4 October with the Task 6 release | `lib/ai.ts:240` `searchLimit` |
> | `AI_SEARCH_MAX_HR` | **not set; the testing step decides.** Unset means no limit for an HR answer's searches, as for the workspace's research answer (HR Step 6b, `DECISIONS.md` §169) | `lib/ai.ts` `searchLimit` |
> | `AI_MODEL_HR` | `claude-opus-5-5`, visible — **added by the owner on 8 October 2026 at HR's release** (HR Step 13, `DECISIONS.md` §181). Unset it would fall back to `AI_MODEL_PROSE` | `lib/ai.ts:144` |
> | `AI_MODEL_HR_CHECK` | `claude-opus-5-5`, visible — **added by the owner on 8 October 2026 at HR's release** (the handbook check and the reading's outline calls). Unset it would fall back to `AI_MODEL_PROSE` | `lib/ai.ts:145` |
>
> **The 4 October correction it replaces:** the 3 October statement *"Every `AI_MODEL_*` variable set
> on Vercel Production is `claude-opus-5-5`"* was wrong for `AI_MODEL_SUMMARY`, which was Sonnet until
> 4 October. The owner then set every model variable to `claude-opus-5-5`, visible, and redeployed; so
> the Task 5 paid check on production ran first on Sonnet, then on Opus 5.5. `DECISIONS.md` §154, §156.

From June: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `FEEDBACK_EMAIL`.

Added 23 Sep: `CRON_SECRET`, `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS`, `AI_MODEL_SUMMARY`, `AI_EFFORT`, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST`, `RESEARCH_PROVENANCE`. *(Corrected 4 October 2026: `AI_EFFORT` was saved hidden on 23 September and its value was never recorded. On 4 October the owner re-entered it as visible `medium`; see the table above. Results on production before 4 October ran at an effort nobody can now name.)*

> ### THE WORKSPACE'S THREE RESEARCH SWITCHES ON PRODUCTION — CONFIRMED 8 OCTOBER 2026: ALL THREE `true`.
> Added on 23 September as SECRET variables, so their values could not be read back and were never recorded here.
> On 8 October the owner re-entered all three as **visible**, as he did for `AI_EFFORT` on 4 October:
> **`RESEARCH_PROVENANCE = true`, `RESEARCH_PREFER_GOV = true`, `RESEARCH_SPECIALIST = true`.**
> Each is ON only for the exact word `true` (any case, trimmed); unset or anything else is OFF
> (`lib/pipelineConfig.ts` pipelineSwitch). Each adds one block to the workspace's open research prompt after its
> role sentence, in this order (`prompts/checklist.ts` buildSystemPrompt):
> - `RESEARCH_PROVENANCE` — "Numbered sources in earlier answers in this conversation came from web searches run at
>   the time; treat them as real."
> - `RESEARCH_PREFER_GOV` — "When you cite sources, prefer official ones: the regulation itself, or the government
>   agency or regulator that enforces it. Use another source only when no official one covers the point, and say
>   so." (It governs the workspace's checklist too.)
> - `RESEARCH_SPECIALIST` — "Answer what was asked, then say what they didn't ask but need to know. Where the answer
>   depends on a fact you don't have, say which fact and what each answer would mean, rather than assuming. Write
>   for a busy owner: plain sentences, the most important thing first, and only as long as it needs to be. End with
>   one specific offer of what you could do next."
>
> **HR's answers and handbook checks read the same three settings** (`prompts/hr-answer.ts` hrAnswerPrompt builds
> the workspace's open research prompt and adds HR's one sentence; DECISIONS §175). Changing one changes both
> sections.

**`HR_ANSWER_USES_CHECK` — not set; the testing step decides** (HR Step 9, DECISIONS §177). A switch, off by default: on
only for the exact word `true`. Off, an HR answer is the baseline's; on, it is given each handbook's latest finished check.

**Added 4 Oct, with the Workspace Task 6 release (owner), all visible:** `AI_MODEL_HOWTO = claude-opus-5-5`, `AI_SEARCH_MAX_HOWTO = 6`, `AI_SEARCH_MAX_COMPLETE = 8`. `AI_EFFORT_HOWTO` is deliberately **not** set, so it falls back to `AI_EFFORT`. Migration 064 was applied first (`npm run preflight` afterwards: 65 on disk, 65 on production, `PENDING COUNT: 0`).

**Added 26 Sep, with Documents rev 1 — values given, because these four decide what a customer's document costs and who reads it:**

| Variable | Value | |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | the site's public origin, no trailing slash | The only source of the link in the batch email. `NEXT_PUBLIC_*`, so it is inlined at build time and must exist **before** the push that builds |
| `AI_MODEL_DOCUMENT_SCAN` | **`claude-opus-5-5`** | What reads a document. *(Corrected 27 September 2026: was `claude-opus-5`. The bake-off — `tests/golden/documents/bakeoff/2026-09-27-rejudged.md`, `DECISIONS.md` §139 — measured Opus 5.5 at 42% of Opus 5's cost per scan and 59s against 113s, with zero must-not violations against Opus 5's nine.)* |
| `AI_SCAN_STRUCTURED` | **`true`** | **The JSON schema is ON, as of 28 September 2026.** *(Was `false` from 26 to 28 September: Opus 5 refused the request outright — "the compiled grammar is too large" — and the schema was flattened by two object shapes afterwards so all four models accept it. `DECISIONS.md` §136, §139, §140.)* **Turned on as its own redeploy, after the code push, not with it** — a variable change is itself a redeploy, and riding the two together would leave nobody able to say which one moved a result. Smoke result on production: read on **`claude-opus-5-5`**, **$0.2531**. |
| `AI_MODEL_JUDGEMENT` | ~~`claude-opus-5`~~ **`claude-opus-5-5`** (owner, 3 Oct; see the box above) | **Re-added as a Config variable, not a secret, so it can be read back** rather than only overwritten. That is the change that made this list checkable |
| `AI_MODEL_AUDIT` | **`claude-opus-5-5`** | **This row is the Audits release's value and is owed one dashboard action — see the note under this table.** What runs an audit. It is named so the audit can be moved on its own: it was the only ledger task with no tier of its own, so the spend was recorded as `audit` while the model was whatever `judgement` happened to be. **Set BEFORE the push**, so the first deployment of the Audits code already carried it — a variable change is itself a redeploy, and doing it afterwards leaves a window in which audits ran on a model nobody chose. Unset it and `lib/ai.ts` falls back to the judgement tier, which here is `claude-opus-5`: a different model from the one the baseline measured, and the dearer one ($0.5153 a scan against $0.2809 on the same seven documents, `DECISIONS.md` §139). The reference it was chosen against is `tests/golden/audits/bakeoff/RESULTS.md` — fifteen runs, five cases, $5.37, 41 of 51 must-lines holding in all three runs against Haiku's 32, at $0.3578 an audit. `DECISIONS.md` §148, §149. |

> ### ⏳ `AI_MODEL_AUDIT` IS THE ONE ROW IN THIS TABLE THAT THE DASHBOARD DOES NOT HOLD YET.
>
> *(3 October 2026: per the owner, every `AI_MODEL_*` on Vercel Production is `claude-opus-5-5`,
> `AI_MODEL_AUDIT` included — see the box at the top of this list. The box below is kept as written.)*
>
> It is written here with its value because the value is decided and the release note depends on it
> (`docs/releases/2026-10-01-audits-rev1.md` §3), and it is marked because **this list is the record
> of what Vercel holds** and nothing had been pushed when the row was written. **The owner sets it
> before the push**, so the first deployment of the Audits code already carries it. When that is done,
> delete this box and the row stands as every other row in the table does. If the release is abandoned,
> delete the row — not the box.
>
> The rule has not changed and this is not an exception to it: **the dashboard wins and this list gets
> corrected.** The one thing that must never happen again is a value living in two files
> (`CLAUDE.md` §3.4a, `DECISIONS.md` §136).

**`AI_AUDIT_STRUCTURED` is deliberately NOT set, and unset means OFF** — not the scan variable's inverted convention. It exists in `lib/pipelineConfig.ts` and has never been measured against the rev 1 audit baseline; it is a switch for a later run, measured one change at a time.

**`NOTIFY_TEST_TO` is confirmed ABSENT and must stay absent.** Set here, every customer's batch email goes to that address instead of to them. `DEV_MAX_SEARCHES` is likewise not set and must not be.

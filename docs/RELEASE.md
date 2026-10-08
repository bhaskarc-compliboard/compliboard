# RELEASE — HOW A CHANGE REACHES PRODUCTION

*Written 24 September 2026 from the two releases of 23 September (Runs 1–3 + Fix Round 1, then Fix Round 2). The owner runs every step below. Claude Code never runs anything against production.*

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
  - **The free checks after a push** (no login, nothing written; run on 8 October after `483c29a`): `GET /hr/new` →
    404 while HR is off; `GET /hr` → 200; `PATCH /api/handbooks` with no login → 404 means the push is live, 405 means
    the previous deploy is still serving.
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
| `/api/jobs/summarise` | `0 10 * * *` — 10:00 | Nightly summaries of conversations quiet 6 hours or more: the workspace's, and HR's while `HR_PREVIEW` is on |
| `/api/jobs/delete` | `30 10 * * *` — 10:30 | Clears transcripts 12 months after the last message |
| `/api/jobs/scan-documents` | `*/5 * * * *` | Documents sweep |
| `/api/jobs/audit-sections` | `*/5 * * * *` | Audits sweep |
| `/api/jobs/handbook-queue` | `0 10 * * *` — 10:00 | HR's night queue: queues the handbook checks that are due. **404 until HR is released** |
| `/api/jobs/handbook-checks` | `*/5 * * * *` | HR's handbook sweep. **404 until HR is released** |

The summary job and the deleter ran at 03:00 and 03:30 UTC until 8 October.

**The morning after this deploy:** check `job_runs` for both nightly jobs — a `summarise` row started after 10:00 UTC
and a `delete` row after 10:30 UTC, each with `finished_at` set. Neither HR job writes a row on production while HR is
off (both answer 404). On staging, the night queue and the sweep both write under the job name `handbook_checks`;
each row's counts show which job wrote it (`job: 'queue'` for the night queue).

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

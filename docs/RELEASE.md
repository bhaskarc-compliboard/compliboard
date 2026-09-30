# RELEASE — HOW A CHANGE REACHES PRODUCTION

*Written 24 September 2026 from the two releases of 23 September (Runs 1–3 + Fix Round 1, then Fix Round 2). The owner runs every step below. Claude Code never runs anything against production.*

---

## The one rule

**Migrations first, then variables, then code.** Every migration is additive, so the old code ignores new tables and nothing changes for customers when a migration lands. Code that ships before its migration looks for tables that aren't there and fails quietly. Code first is never acceptable.

## The facts that shape the procedure

- There is **no staging deployment**. "Staging" means the owner's laptop (`npm run dev`) pointed at the staging database. The only deployed app is production.
- **A `git push` to `main` deploys production.** Vercel builds on every push and reads its Environment Variables at build time. There is no separate "redeploy" step after a push. Changing a variable on its own also triggers a redeploy.
- The owner's laptop reads `.env.local`; production reads Vercel. They are separate. A model or switch changed in one is not changed in the other.
- Two Supabase databases: staging (`amzsavsrabrlcprltpom`) and production (`dsfwmafnphdlfogetsus`). The migration scripts print which one they target and refuse to run against production without the word `PRODUCTION` typed by a person.

## Before a release

All three must be true:

1. `npm run check` is green (Claude Code's report says so, with the test count).
2. `npm run check:live` has run on staging with every pending migration applied (Claude Code's report says so). A migration that adds or alters a tenant table does not go to production without this.
3. The owner has done the manual tests in `docs/TESTING.md` for the feature being shipped, on the laptop against staging.

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
- The privacy-policy line stating that conversation transcripts are cleared 7 days after summarising (gate four of the retention promise).

## Variables currently set on Vercel Production (as of 28 Sep 2026)

**This list is the authoritative record of what Vercel holds.** `CLAUDE.md` §3.4a points here and deliberately does not keep a second copy: on 26 September that section and this one disagreed about whether the `AI_MODEL_*` variables are set at all, which made the model that reads a customer's document unknowable from the repository. It was settled by reading the dashboard, §3.4a was the one that was wrong, and the rule now is **the dashboard wins and this list gets corrected.** `DECISIONS.md` §136.

From June: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `FEEDBACK_EMAIL`.

Added 23 Sep: `CRON_SECRET`, `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS`, `AI_MODEL_SUMMARY`, `AI_EFFORT`, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST`, `RESEARCH_PROVENANCE`.

### Owed with the Audits release — one variable, and this is its value

| Variable | Value to set | |
|---|---|---|
| `AI_MODEL_AUDIT` | **`claude-opus-5-5`** | What runs an audit. **Set it on Vercel Production as part of the Audits release.** The owner chose it for rev 1; the reference it was chosen against is `tests/golden/audits/bakeoff/RESULTS.md` — fifteen runs, five cases, three each, $5.3667, 41 of 51 must-lines holding in all three runs against Haiku's 32, at $0.3578 an audit. `DECISIONS.md` §148. |

**Why it is a value here and *(not set)* in the table below, which is not a contradiction.** The table
records **what the dashboard holds**, and the dashboard holds nothing for this name yet; this block
records **what the release is supposed to put there**. When it is set, the value moves down into the
table and this block goes. Keeping the two apart is the whole lesson of 26 September: a second list
of values is how the model that reads a customer's document became unknowable from the repository
(§3.4a, `DECISIONS.md` §136).

**Until it is set, an audit on production runs whatever `AI_MODEL_JUDGEMENT` is set to** — today
`claude-opus-5`, per the table below. That is a different model from the one this baseline measured,
and the documents bake-off priced the two on the same seven documents with no schema:
`claude-opus-5` **$0.5153** a scan against `claude-opus-5-5`'s **$0.2809** (`DECISIONS.md` §139).
**Leaving this variable unset is not the same as leaving it at the baseline**, and it is dearer.

**Added 26 Sep, with Documents rev 1 — values given, because these four decide what a customer's document costs and who reads it:**

| Variable | Value | |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | the site's public origin, no trailing slash | The only source of the link in the batch email. `NEXT_PUBLIC_*`, so it is inlined at build time and must exist **before** the push that builds |
| `AI_MODEL_DOCUMENT_SCAN` | **`claude-opus-5-5`** | What reads a document. *(Corrected 27 September 2026: was `claude-opus-5`. The bake-off — `tests/golden/documents/bakeoff/2026-09-27-rejudged.md`, `DECISIONS.md` §139 — measured Opus 5.5 at 42% of Opus 5's cost per scan and 59s against 113s, with zero must-not violations against Opus 5's nine.)* |
| `AI_SCAN_STRUCTURED` | **`true`** | **The JSON schema is ON, as of 28 September 2026.** *(Was `false` from 26 to 28 September: Opus 5 refused the request outright — "the compiled grammar is too large" — and the schema was flattened by two object shapes afterwards so all four models accept it. `DECISIONS.md` §136, §139, §140.)* **Turned on as its own redeploy, after the code push, not with it** — a variable change is itself a redeploy, and riding the two together would leave nobody able to say which one moved a result. Smoke result on production: read on **`claude-opus-5-5`**, **$0.2531**. |
| `AI_MODEL_JUDGEMENT` | `claude-opus-5` | **Re-added as a Config variable, not a secret, so it can be read back** rather than only overwritten. That is the change that made this list checkable |
| `AI_MODEL_AUDIT` | *(not set — **`claude-opus-5-5` is owed with the Audits release**, see the block above)* | **The name exists as of 29 September 2026 and nothing is set here yet.** What runs an agency audit. Unset, it falls back to the judgement tier, exactly as `AI_MODEL_DOCUMENT_SCAN` does (`lib/ai.ts` `TASK_MODELS.audit`). It is named so the audit can be moved on its own: it was the only ledger task with no tier of its own, so the spend was recorded as `audit` while the model was whatever `judgement` happened to be. **A value goes in this cell as HELD only when one is actually set on the dashboard** — this file is the authoritative record of what Vercel holds (§3.4a), and a name with an invented value would be exactly the contradiction that box exists to record. |

**`NOTIFY_TEST_TO` is confirmed ABSENT and must stay absent.** Set here, every customer's batch email goes to that address instead of to them. `DEV_MAX_SEARCHES` is likewise not set and must not be.

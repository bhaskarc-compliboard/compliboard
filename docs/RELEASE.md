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

## Variables currently set on Vercel Production (names only, as of 23 Sep 2026)

`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `FEEDBACK_EMAIL` (from June), plus the nine added on 23 Sep: `CRON_SECRET`, `AI_MODEL_PROSE`, `AI_MODEL_JUDGEMENT`, `AI_MODEL_SUBSTEPS`, `AI_MODEL_SUMMARY`, `AI_EFFORT`, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST`, `RESEARCH_PROVENANCE`.

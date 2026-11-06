# HANDOFF FROM THE GAPS WORK

**Version:** 1 · **Written:** 6 November 2026, by Claude Code at the close of `docs/GAPS-PLAN.md`
Parts A–F, the day after the release.
**For:** the next chat, and the owner reading it over their shoulder.
**The plan it closes:** `docs/GAPS-PLAN.md` — Parts A, B, C, E and F are complete; **§5b is not**, and
§5b is the next chat's list.
**Its decisions:** `docs/GAPS-PLAN.md` §3, numbers 1–76, and **`docs/DECISIONS.md` §224–§230** for
36–76 with their reversal conditions. 1–35 live only in the plan.

> ### WHAT TO READ FIRST, IF YOU READ NOTHING ELSE
>
> **§5b of `docs/GAPS-PLAN.md`** — the pre-release list, which is explicitly *"not in this plan,
> pre-release, in a separate chat"* and is §7 of this file. **`docs/PENDING.md`** — 44 open rows, four
> ranked to do first, and the counts are now counted from the rows rather than carried forward.
> **`docs/RELEASE.md`**, *"The gaps release's routine"* — it ran, and the two things that went wrong
> while it ran are recorded in place rather than in a postmortem.

---

## 1. What shipped, in one paragraph

Six parts of work over four days, released on 5–6 November as **63 commits** (`d14ac16` …
`ee0356c`) and **five migrations, 091–095**. Documents and Audits each gained a chat, billed and
modelled as itself. The product reads an iPhone photo, a flatbed scan and a `.bmp` instead of
politely refusing them. The audit learned a fifth word for the commonest true thing about a real
filing cabinet. The binder became the report page printed by the browser. The summary report, the
answer's source cards and the Documents list all had their display pass. And **Night Watch** runs
every morning, reads rows, and changes nothing.

**The deployment:** `compliboard-501g6po1x`, commit `ee0356c`, Ready in 45s, live at
`https://compliboard.vercel.app`. **One new cron** (eight in use, ceiling 100 on Pro). **One new
variable**, `QUALITY_EMAIL`. **Three new runtime dependencies**, `sharp`, `heic-decode`, `bmp-ts`,
none needing a native build step.

**The read-backs on production, as they answered:** `quality_reports` holds **nothing** for `anon`
and `authenticated` across all eight rights and everything for `service_role`; `ai_calls_task_check`
holds 19 words including `documents` and `audits_chat`; `audit_findings_word_check` holds five
including `on_file_gaps`; `job_runs_job_check` holds eight including `quality`;
`topics_section_is_known` holds five; `documents.converted_url` exists, `text`, nullable; and **zero
probe companies** survived any of the five migrations.

## 2. The two chats, and the two words that had to exist first

`lib/ask/` had two sections written into it as literals — `brief.section === 'calendar' ? 'calendar'
: 'hr'`, twice — so any third section's answers would have run on HR's model tier and been billed to
HR's ledger word. That is one lookup per section now.

**Migration 091 is the one to understand.** It teaches `ai_calls_task_check` the words `documents`
and `audits_chat` and `topics_section_is_known` the same two. **Until it is applied, the first
ledger row either chat writes is refused by the CHECK and swallowed by `recordAICall`'s catch — the
answer arrives, the money is spent, and nothing records it.** It is also why this release's migration
order was not alphabetical politeness: 091 had to go first.

***`audits_chat`, not `audit`.*** `audit` is the agency audit — one long reasoning call over a filing
cabinet. The case for spending more on that is not the case for a chat answer, and a ledger that
cannot tell them apart cannot answer the one question it was built to answer.

**HR was deliberately not moved** (decision 36, `DECISIONS.md` §224). `PENDING.md` **F7** stays open
and names HR and the Compliance Workspace as the two sections still on their own path.

## 3. Images, and the one constant that depends on a dashboard

HEIC → `heic-decode` → raw RGBA → `sharp`; TIFF one block per page capped at 20; BMP via `bmp-ts`.
All of it **inside Vercel** — decision 52 overruled `VISION-DOCUMENTS.md`'s costed container on the
premise that libheif cannot run there, and **half that premise was wrong**: `libheif-js` is libheif
compiled to WebAssembly with nothing native to install.

> ### ⚠ `MAX_MEGAPIXELS = 50` ASSUMES 2 GB, AND THE 2 GB IS A DASHBOARD SETTING.
> `heic-decode` allocates `width * height * 4` and has no scaled decode, so a photograph's memory is
> the source photograph's: a **48-megapixel HEIC measured a 1,036 MB peak**. Fluid compute gives every
> function **1 vCPU / 2 GB**, read from the dashboard on 4 November, and **that fact has no
> representation in this repository**. Lower the dial and `lib/imageConvert.ts`'s constant must come
> down in the same change, or `/api/document-scan` and the five-minute sweep are killed by the largest
> photograph a customer sends — so it fails for the person with the best camera, after the upload.
> `docs/RELEASE.md`'s function-memory section is the record.

**`.doc` and `.ppt` are still refused**, in their own words, for rev 1. The container is rev 2.
**`.zip` and email are rev 1.5**, one click each when they come.

## 4. The audit's fifth word, and the report

**`on_file_gaps`** — *"on file, gaps found"* — migration 094. Four words could not say the commonest
true thing about a real cabinet: the document exists and is not complete. **And a document turns to
Needs work only on a gap READ FROM THE PAGE**, never an inferred one (migration 093): an inferred gap
is a note, and a note does not turn a customer's record red.

The report is a **page**, full width, at `/audits?run=<id>`, four tabs, and the **binder is that page
printed by the browser** — no `pdf-lib`, no stored file, nothing in storage. Measured: Clackamas
**1.36 MB over 19 pages**, Cascade DEQ **2.96 MB over 27**.

**The summary report shows its sources ONCE** (decision 65): no item carries a source line of any
kind, *"No source cited in the conversation"* is removed from the product, and *Not answered here* is
gone. The order is **Your situation · What applies · Sources · Still to confirm**.

**And answer quality is measured, not asserted** (decision 66) — the rule that cost E3 $3.36 over 36
Sonnet runs and let E4 ship with no model call at all. Read `DECISIONS.md` §228 before changing
anything near an answer.

## 5. Night Watch, and its first morning

A cron, `/api/jobs/quality` at `30 13 * * *`, reading the previous **Pacific** day across every
company, counting eleven things, writing one row per company plus one `company_id = null` totals row
holding no ids, and mailing **one address**.

**It calls no model, and that is enforced rather than promised:** `check:schema` check 3 computes the
transitive import closure of every route and holds `PAID_COUNT` at **23**; this route is not one of
them. A Night Watch email carrying a cost of its own is the thing to stop for.

**⚡ THE FIRST PRODUCTION EMAIL IS 05:30 PACIFIC ON FRIDAY 6 NOVEMBER 2026.** `30 13 * * *` is 13:30
UTC = 05:30 PST in winter and **06:30 PDT** in summer; the job computes its own window from `now()`
in `America/Los_Angeles`, so it reads the whole previous Pacific day whatever hour it fires, and
**the email's first line states the window with the date.**

**What the first report should contain:** that window line first; a subject reading `Night Watch ·
<date> · <n> things to look at` where `n` counts only non-zero counters — **the cost line and the
jobs' pulse never count**; all eight jobs in the pulse; and a cost line for the previous Pacific day.
**A first report with findings in it is not a bad sign** — the counters read rows this release's code
has only just started writing.

**What it must not contain:** any cost of its own; any row id in the totals line (migration 095's
`quality_reports_totals_hold_no_ids` CHECK refuses it, and the migration probes it); a sandbox
refusal (it sends from `SANDBOX_FROM` deliberately — its only recipient is the Resend account's own
address, the one address `onboarding@resend.dev` can reach); or a second email in one day.

**And `quality` must not report ITSELF as a hanging job.** Both `job_runs` reads carry
`.neq('id', run.id)`. That is the fix for the defect its first staging run found: `startJobRun` opens
a row before any work, so the newest `quality` row IS the run doing the reading. Its other first-run
defect was counting **`D002`** as a document handle — it is EPA's corrosivity code.

**If it does not arrive:** read `job_runs` for a `quality` row started after 13:30 UTC with
`finished_at` set, and check `QUALITY_EMAIL` is still set and **visible** on Vercel. Unset, the job
refuses to send and `/quality` closes to everyone — the safe direction, and a silent one.

**On production `quality_reports` is empty** until the first run. Staging holds 3 rows, all dated
2026-11-04.

## 6. Two things that went wrong, both worth inheriting

**The Supabase CLI changed under the project twice in four days**, and `package.json` now pins it to
**3.0.0** so the next upgrade is a decision. On **2 November** it stopped writing to staging through
`--linked` (it connects as `supabase_read_only_user`); on **5 November** it began refusing any
statement not marked safe, which stopped `npm run preflight` and then **`npm run db:migrate:prod`
mid-release**, each reporting only `Command failed` because the real message was piped to a stream
nothing read. Reads now pass `--read-only`, applies pass `--yes`, and the refusal is printed
redacted rather than swallowed. `docs/HOW-WE-BUILD.md` §7 has the pin and both breakages.

**Three migrations borrowed a real customer's company for their self-tests** —
`select id into co from public.companies limit 1` — and **093's probe moved a counter**: its scan
fires `document_scans_count_reading`, which adds one to that company's `files_read`, and **no AFTER
DELETE trigger exists to take it back** (migration 080's counters are events, not inventory). Caught
on 5 November, **before** the production run, so production carries no phantom. All four of 091–095
now make their own probe company. **Staging's Step 20 Card Walk carries +1 and it is the owner's to
decide** — a never-decremented counter makes an ordinary deleted document look identical to a probe.

## 7. What is open: §5b, *"Not in this plan — pre-release, in a separate chat"*

This is the next chat's list, and it is `docs/GAPS-PLAN.md` **§5b** by that name. The rows the gaps
work pushed into it:

| row | what it is |
|---|---|
| **M1** | **Which model, per tier.** Moved out of the finish line by decision 76 — **not a release gate.** After the release, one tier at a time, never two in one job: research · the writing · the audit sections · the summaries · the document reading, each with keys written before any run |
| **M2** | **The JSON schema at the boundary on the audit path** (`CLAUDE.md` §3.1). Waits with M1, measured against whichever baseline the audit-sections tier's comparison sets. `docs/TEST-AT-FINISH-LINE.md` holds the three broken-JSON section ids as its first rows |
| **D4a** | **The `?topic=` parameter**, so Night Watch's conversation counters link to the conversation rather than the section. An afternoon on five pages |
| **R2b** | **The server-built binder** — rev 2, wanted only if a customer needs the originals' own page objects or a stored copy. Read the project's storage limit off the dashboard first |
| also | `.zip` and email files (rev 1.5, decision 54); the container for `.doc`/`.ppt` (rev 2, decision 52); HR onto the shared engine (rev 2, decision 36) |

**And one row of §5a is still half open:** **E5** — *"Audit again"* on a By template row, waiting on
the row saying whether the template file still exists. Its other half shipped at B0.

## 8. What is still owed across the product

`docs/PENDING.md` is the list and it is current as of 6 November: **44 open rows** — 8 F · 11 D · 7 S
· 8 O · 7 N · 3 H — of which 7 are deliberately not built, so **37 are owed**. **Four ranked to do
first:** Stripe live mode (F1) · the Resend sending domain's DNS (S1) · the scanner's invented switch
keys (D1) · the folder test (F3). **The fifth slot is deliberately empty** — which row earns it is
the owner's ranking.

**The one paid check of this release has not been run.** `docs/RELEASE.md`'s gaps routine, step 5:
a one-section template audit plus one `.heic`, as the owner's own company, estimated **~$0.40** from
the ledger. **It is also the only thing that proves `sharp`'s Linux binary loads on production** —
the build log cannot, because the install came from cache.

**Two documentation items this handoff creates:** the public-pages chat's decisions were never
written into `DECISIONS.md` (`PENDING.md` **O9**), and the five released plans plus `GAPS-PLAN.md`
are archive candidates held back until `PENDING.md` is next rewritten, because it cites all six by
name.

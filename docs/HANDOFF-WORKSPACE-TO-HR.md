# Handoff — from the Compliance Workspace to the HR section

**Written:** 4 October 2026, at the close of the Compliance Workspace feature work.
**For:** the new chat that builds the HR section. Read this first, then the files it points to.
**Checked:** 4 October 2026, every fact against the repository, by Claude Code; three corrections, listed in the housekeeping commit's report.

---

## 1. Why this file exists

The Compliance Workspace was rebuilt over 3–4 October 2026, and it is now the template for the HR
section. The owner's words: HR is **almost the same as the workspace, but its answers come from a
company document** (for example the employee handbook or an HR policy), not from open web research.

This file gives the next chat three things:
1. what the workspace is now, and which of its pieces HR should reuse rather than rebuild;
2. the decisions and product rules that apply to every section;
3. how the owner and Claude work together, including the traps that have already cost money.

Everything here is a pointer to the repository. When a fact here and the repository disagree, the
repository wins; say so and correct this file.

---

## 2. Read these, in this order

| File | Why |
| --- | --- |
| `CLAUDE.md` | The project rules for Claude Code. The reset rule changed on 4 October (§3.7): `db:reset` and `db:restore` run only when the owner says so. |
| `docs/HOW-WE-BUILD.md` | The working method. §3c holds two traps from 4 October. |
| `docs/HANDOFF-WORKSPACE.md` | The workspace, element by element, with file and line. HR's template. |
| `docs/WORKSPACE-PLAN.md` | What is left in the workspace. It mirrors the owner's Claude Doc "Compliance Workspace — the map of what's left". |
| `docs/DESIGN.md` | How the product looks. |
| `docs/HANDOFF-CODE.md` | The state of the code: git, migrations, open defects (§7). |
| `docs/DECISIONS.md` §153–§163 | Every workspace decision of 3–4 October, with evidence and cost. |
| `docs/HANDOFF-AUDITS.md` | Audits, one of the baseline sections. |
| `docs/RELEASE.md` | How a change reaches production, and what Vercel holds. |
| `STATUS.md` | One line per module, with the date it was last checked. |

Visual references (owner's artifacts):
- **The feature boards** (the canvas every workspace screen was drawn on first): https://claude.ai/artifact/MJnFqCrFKaomPmkfHdj4FP
- **The map of what's left** (the owner's working plan): https://claude.ai/artifact/W5BtmShWGoL5Z9uCLVHuwb
- **The cost model** (100 customers, Opus 5.5 vs Sonnet 5): https://claude.ai/artifact/F3XMPK9Q3dVemPisY2nY45

---

## 3. Which sections are the baseline

- **The baseline sections** are Documents, Audits, Company information and the Compliance Workspace.
  Better ideas came during each, so new work copies them: their shell, widths, drawers, words and
  machinery.
- **HR, Calendar and My Account still run rev 1 machinery.** Do not treat them as a model for
  anything. HR's current code is the starting point to be understood and then replaced, not copied.

---

## 4. What the workspace is now (live on production, 4 October 2026)

**The conversation**
- One column, 900px, with Audits' tabs and buttons.
- The action row sits under the box: "Turn this into a checklist", "Summarise this conversation",
  "Download". Under it, one line: one topic per conversation.
- Sources fold after three.
- Titles show capitalised.
- Delete happens only from a drawer, with the product's own confirmation that offers the download
  first.

**Files**
- A chosen file is only *staged* as a chip in the box; nothing is read until the question is sent.
- On send, the real stages show: saving, reading, checking it against your question, writing the
  answer.
- A file card above the answer opens the Documents report in a drawer.
- If the file cannot be read, the question is not sent, and it goes back into the box.

**The summary report**
- One call writes the report, a generated title, and candidate company facts.
- Order: as-of line, Your situation, What applies by authority, Still to confirm, Asked and not
  answered, the facts line, Sources.
- Shown as an accordion: each authority folded with "N things to do"; Still to confirm never
  folded; prints fully open.
- Sources are numbered by code. Every item carries an exact quoted "basis", and code keeps a
  citation only if its marker sits in the quoted paragraph.
- Facts must quote the person's own words, and go to Company information's queue. They never
  interrupt the chat.

**The checklist**
- Three groups: Must do (legal obligations, numbered in action order only when the workspace made
  the list), Worth doing (advice, not a legal rule), To confirm (open questions).
- "Just what we discussed" uses the summary's citation check.
- "Everything on this subject" searches the web; an item it adds keeps only a link its own search returned.

**"How do I do this?"**
- Researches one item with web search, mothership first.
- Every step's link must be a page that search returned. Steps are labelled "official source", or
  "This comes from ‹host›, not the agency itself. It looks correct, but check it before you rely
  on it."

**Work that survives leaving the page**
- Summaries, checklists and "How do I do this?" claim the conversation or item in the database,
  reply at once, and finish in `after()` (Vercel `waitUntil`).
- A closed tab cancels nothing. A second press waits instead of paying twice.
- Rows and drawers say "Summary being written…" / "Checklist being built…".
- Proven on production.

**Printing**
- One shared print frame (`lib/printFrame.ts`) for every drawer and the conversation.
- Company and document type at the top of every page; real dates (never "Yesterday").
- "Prepared with CompliBoard" and "Page n of N" in the footer; the browser's own header and footer
  are turned off. Tested in Chrome only.

**Nightly jobs (live from 4 October)**
- Summarise at 03:00 UTC, after 24 hours of quiet.
- Delete at 03:30 UTC: full conversations are kept 12 months after the last message; summaries until
  deleted.
- The Documents sweep and the Audits sections every 5 minutes.
- All four answer Vercel's GET with `Authorization: Bearer <CRON_SECRET>`, and are safe against a
  double delivery.

---

## 5. Pieces HR should reuse, not rebuild

| Need in HR | Reuse | Where |
| --- | --- | --- |
| Page shell, column, tabs, buttons | The workspace / Audits layout | `app/compliance/page.tsx`, `app/audits/page.tsx`, `DESIGN.md` |
| A drawer with a print | The shared drawer and print frame | `components/Drawer.tsx`, `lib/printFrame.ts` |
| Conversations that persist | turns, topics, the Conversations list (one read through a view) | `lib/conversation.ts`, `topic_list_v` (migrations 063, 065) |
| A summary of a conversation | The report writer and its checks | `prompts/summary-report.ts`, `lib/summaryReport.ts` |
| A checklist from a conversation | The conversion and its checks; the three-group drawer | `prompts/convert.ts`, `lib/checklistConvert.ts`, `lib/checklistView.ts` |
| "How do I do this?" | The how-to route and its link check | `app/api/checklist-items/[id]/how-to/route.ts`, `lib/howTo.ts`, `prompts/how-to.ts` |
| Long work that must not double-charge | The claim + `after()` pattern | `lib/topicClaim.ts`, the summarise and from-topic routes |
| Reading an uploaded document | The Documents scan and report | `lib/documentScan.ts`, `components/DocumentReport.tsx` |
| Facts about the company | The proposal queue in Company information | `fact_proposals`, `/api/to-confirm` |
| Retention | The 12-month rule | `lib/retention.ts` |

**The one big difference for HR:** the answer's evidence is the company's own document, not the web.
The workspace's citation discipline carries over directly. Every claim should point at the passage in
the company document it came from, checked by code, the way the summary checks its quoted basis.
Where HR also needs the law (state leave rules, for example), the mothership rule in §6 applies.

---

## 6. Product rules that apply to every section

**Evidence and honesty**
- No item may be stated more firmly than its evidence.
- A confident wrong exclusion is worse than an extra item. That is why the workspace summary has no
  "doesn't apply" section.
- Prompts are requests; code is the guarantee. Citations, quotes and links are checked in code after
  the call.
- "Not legal advice" stays in every printed report.

**Research and sources**
- **Web search is a must for research.** The model's own knowledge is at least six months old.
- **The mothership rule.** The source wanted is whoever issues or publishes the binding text,
  whatever its domain: agencies, legislatures, standards bodies whose codes are adopted into law,
  official code publishers.
  - If it is online at the mothership, get it there.
  - If it is found only elsewhere, give the exact link and say plainly it looks correct but should
    be checked.
  - Only if it is not published online, tell the person to ask the agency.
  - Government sites are trusted.
- **Rev 1 uses open Claude research.** The requirements library is not used for answers or sources
  in rev 1. Rev 2 connects research to it: the library first, `library_candidates` fed, citations
  kept fresh.

**Writing for the customer**
- Everything the product writes is short, simple sentences. One idea per sentence, in plain words
  for a small-business owner.
- Never "AI", never the model's name, never cost on a customer screen.

**Models and cost**
- Production runs **Opus 5.5 for every model setting, effort medium**, all visible in Vercel since
  4 October.
- Best results first; optimise per task later, by measurement.
- Margin is about 70% at $199/month on Opus, unoptimised. The risk is a very heavy user, not the
  model choice.

**Quality is judged with real problems**
- The quality baseline will be built from real problems brought by potential customers in
  different industries, not invented cases.
- Small fixes found along the way are held until a run on the final models, and dropped if no
  longer needed.

---

## 7. How the owner and Claude work

**The roles**
- The owner decides.
- This chat (Claude) designs, reviews and writes one instruction at a time.
- Claude Code builds.
- The owner pastes reports back here.

**The rhythm**
1. **Read-only first.** Before changing a section, map how it works today with file and line, the
   way `docs/WORKSPACE-MACHINERY.md` did for the workspace. Facts before design.
2. **Draw before building.** Screens are drawn as boards on a canvas. The owner says "that one".
   Then one instruction.
3. **One instruction at a time** for anything the owner looks at. Instructions have stops: build,
   STOP for the owner to look on localhost or in `shots/`, then commit and docs after "go".
4. **Quality changes are shown first.** A new or changed prompt is shown to the owner, with a real
   run, before the screens are built (the summary went through two stops this way).
5. **Every task updates the docs** in its own commit: DECISIONS, the section's HANDOFF, TESTING,
   STATUS, HANDOFF-CODE §7, the plan.
6. **Releases:** free `check:live` on port 3999 → `npm run preflight` → `npm run db:migrate:prod`
   (type PRODUCTION) if a migration is pending → `git push origin main` → Vercel green → free live
   checks → one paid check.

**Rules Claude Code follows**
- **Models:** machinery is built and tested on Haiku. Anything a customer relies on (reports,
  checklists, researched steps) is developed and judged on Opus 5.5.
- **Per-run model overrides** go on an isolated copy of the working tree on another port (HOW-WE-BUILD
  §3c). `.env.local` is never changed for a shared model variable.
- **Cost:** `npm run cost` before and after every task; $3 per task unless the owner raises it.
  Estimate before every Opus call.
- **check:live runs only on port 3999** (`CHECK_LIVE_BASE_URL=http://localhost:3999`), including
  inside `npm run db:migrate`, which chains into it.
- **Never `db:reset` or `db:restore`** without the owner saying so in the brief.
- **Screenshots go in `shots/`** (git-ignored). `.next/` is wiped by every build.
- **Production:** SELECT only, every statement printed first. Never a write.
- **Every report names what it touches in other sections**, by file. Shared components (the drawer,
  the print frame, the app shell) change every section at once.
- **Fresh Claude Code sessions** when context runs low ("1% until auto-compact" means start a new
  one). `/clear` keeps every file; only the chat is wiped.

---

## 8. Traps that have already cost time or money

- `npm run db:migrate` runs `check:live` at the end, against port 3000 unless told otherwise. That
  cost $0.30 by accident on 4 October.
- `next dev` refuses a second dev server in the same folder. Overrides need an isolated copy on
  another port.
- `npm run check` rebuilds the app and empties `.next/`, screenshots included.
- A restore under the old rule wiped staging's conversations, documents, fixtures and cost ledger on
  4 October. It did prove that all 66 migrations rebuild from zero.
- Vercel hides "sensitive" variables, so their values become unknowable. Model and effort settings
  are now saved visible. `AI_MODEL_SUMMARY` was Sonnet in production until 4 October without anyone
  knowing.
- On Vercel, work tied to a request can be lost when the person leaves (DECISIONS §138). Long work
  goes in `after()`, behind a database claim.
- Section numbers in DECISIONS are copied, never written from memory (CLAUDE.md §9a).
- Line numbers in old write-ups drift; re-read before citing.

---

## 9. What is still open in the workspace (not for the HR chat to do)

- **Tomorrow's check (5 October):**
  - production `job_runs` has a `summarise` row (about 03:00 UTC) and a `delete` row (about
    03:30 UTC);
  - CB-Test-3's 23 September conversation reads "Summary ready".
- **Rev 1 quality items:**
  - a consistency check (items stated as settled while something they depend on is under "to
    confirm": drawback and the tariff in the ethanol case);
  - a quote check for "How do I do this?";
  - the held list re-run on the final models.
- **Split `check:live`** into machinery checks (must pass on any model) and quality checks (judged
  on Opus only). On Haiku it always ends red today.
- **The baseline,** when the owner's friends bring real problems.
- **When every section is done:** every print action in the app uses the one print frame.
- **After the workspace ships:** dashboard counters (each answered question counts as a
  conversation, plus checklists made); totals on the homepage once they are high.
- **Rev 2:** the requirements library as the mothership map, fed and refreshed by research.
- **Just before the rev 1 launch:** rebuild staging from empty.

---

## 10. Suggested first steps for the HR chat

1. Read the files in §2, then this file again.
2. Ask the owner for his vision of HR: what a person asks, which company documents the answers come
   from, what the deliverables are (summary, checklist, a policy check?).
3. Give Claude Code one read-only instruction: map how HR works today, end to end, with file and
   line, in the shape of `docs/WORKSPACE-MACHINERY.md`, and say which workspace pieces (§5) could
   replace each part.
4. Draw the HR boards on a canvas, in the feature boards' style, and get the owner's "that one".
5. Then build in tasks, each with its stops, in the workspace's order: foundations, the screen,
   files, the summary, the checklist, polish, operations.

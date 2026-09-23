# HANDOFF — THE DOCUMENTS SECTION

*Written 23 September 2026 by the chat that shipped the research section. Read this first, then the files in §10, then answer the owner's first message.*

---

## 1. Why this section comes next

Scanned documents are the source of truth for every section after this one. Audits check evidence that lives in documents. The calendar takes its dates from permits and certificates. HR reads employee records. The owner's words: "all the answers come from the scanned doc." So the shape of what a scanned document produces matters more here than in any other section, because three future sections will read it.

**Finish line.** A user can upload, see a correct classification, browse and open their documents, correct a wrong classification, and see what facts and dates the scan found. Every scan writes a cost row. The data a document exposes is written down as a contract for Audits, Calendar and HR. All on production.

## 2. Who does what

Three roles (`docs/HOW-WE-BUILD.md` §1): **Chat** designs, decides, writes one instruction at a time. **Claude Code** builds and tests, on staging (the owner's laptop against the staging database). **The owner** decides product questions, runs production migrations, pushes. Terminals: T1 `npm run dev`, T2 Claude Code, T3 everything else.

## 3. The method — proven on the research section, use it unchanged

1. **The owner's vision first**, in his own words, from the user's side. Don't organise it for him. Ask questions after.
2. **Sort every gap** into schema, data, or truth, and say which are "later".
3. **Artifact.** Build the section as a clickable HTML prototype in the chat. The owner iterates on it until it's right. It becomes the spec. Commit it to `prototypes/`.
4. **Runs.** Long Claude Code runs, each ending at something the owner can see or measure. Run 1 is always the open baseline. Every decision is pre-made in the brief so Claude Code stops only for a product question, a production migration, or the end.
5. **Test pass** by the owner, on the real thing. Log everything. One fix round. Ship.

**The rule that must not be broken:** best result first, with no conditions, then each saving added as a switch and measured. On the research section we learned this the hard way — every "sensible" restriction in the old pipeline subtracted from the answer, and most of the apparent quality gap turned out to be the model, not the pipeline. For documents the temptation will be stronger, because the shortcuts are obvious (see §6). Resist them until the baseline is measured.

## 4. Where documents stand today

- **Tables:** `documents` (file, company, folder, `from_topic_id` added in Run 2/3 for uploads made in a conversation) and `document_reviews` (`document_type`, `issued_by`, `expiry_date`, `summary`, gaps). Storage bucket `company-documents`, now created by migration 037 so a from-zero rebuild has it.
- **Code:** `app/documents/page.tsx`, `/api/documents`, `/api/document-review`, `lib/documentReview.ts`. The review sends the raw PDF as a native document block and returns `{ data, review }`. This path is **unchanged since before Run 1**: old prompt style, `askAIWithCitations` with its non-streaming ceiling, and it writes **no cost ledger rows**.
- **Measured on live:** one two-page PDF scan cost **$1.10**. A researched answer costs $0.21–0.27, a follow-up $0.03. At $1.10 a document, onboarding a company with 200 files is $220 before they ask a question. This is the first thing to understand.
- **Known defect:** the audit path can silently drop a document it fails to read and still produce a confident readiness number (see HANDOFF-CODE and DECISIONS). Documents must never do this: an unreadable file is said out loud, politely, with the way forward.
- **Already decided for uploads from a conversation** (Run 3, Fix Round 2): autosave, classification shown on the file card and correctable, the file travels with the conversation so later turns can read it, "Read as: <type>" wording.

## 5. Decisions already made — do not reopen

- Open baseline first; every addition behind a switch; measured against golden cases run three times.
- Build and test on the cheapest model (`claude-haiku-4-5` in `.env.local`); judge output on the real model only, deliberately.
- Every model call writes a row to `ai_calls` (the cost ledger). No exceptions. The scan path gets this first.
- Uploads are kept until the user deletes them. Classification is proposed by the model and shown; the user can correct it. Nothing about a company is written silently — facts found in documents become **proposals** (`fact_proposals`), never direct writes to `company_switches`.
- Unreadable files: say so, politely, ask for a clearer copy. Never answer around a file that wasn't read.
- The word is "checklist". Layout follows `docs/DESIGN.md` once the layout chat has written it; until then, the prototype and the live Compliance Workspace page are the reference.
- Cost model: Anthropic list prices are in `config/pricing.ts`, verified by the owner on 23 Sep. Web search is $0.01 a search plus roughly 4,500 input tokens per source read — search is expensive and a scan may not need it at all. Batch API is 50% off and is the right path for overnight onboarding.

## 6. Ideas the owner has already raised — build them as measured switches, not as the baseline

- A scan already knows its jurisdiction and agency from the document, so search, if used, can be restricted to that agency's site, or replaced by fetching a known page. Cheaper and cleaner sources. **Measure it against the open baseline first.**
- A cheap model for extraction, a strong model only for judgment. Measure.
- One pass per document instead of several. Measure.
- Batch API for overnight ingestion when a user connects a drive. The owner will absorb early onboarding cost for a small number of users; it must not scale as $1.10 a file.
- Later: a router that picks the model by what the task needs (search or not, definition or judgment), with a nearly free judge and its own golden checks. Not now.

## 7. The contract other sections will read — decide it in this chat

Before the artifact is final, write down what a scanned document exposes, because Audits, Calendar and HR will consume it:

- what it is (type, issuer, jurisdiction, site it belongs to)
- what it proves (facts, with the page or line they came from — the project's "point at the line" rule applies to documents too)
- when it matters (issue date, expiry, renewal, deadlines it creates)
- how sure we are (verified against the file vs. inferred)
- where it came from (uploaded by hand, from a conversation, from a connected drive)

This is a data shape, not a screen. Put it in `docs/SCHEMA.md` and the Run 1 brief. The nightly worker (Run 2 of research) already has the pattern for proposals and job runs; reuse it.

## 8. Parked from the research section — don't lose these

- Prompt caching and a search cap (input is ~60% of the bill; documents re-sent per turn make this worse).
- Sonnet 5 prompt phase with an example answer (8/12 golden facts today; needs 11/12 to replace Opus 5 at a third of the cost).
- Provenance: the model stands by its earlier sources 2 times in 3; storing the search results is the real fix.
- Micro-steps write no ledger rows yet.
- Agency card under answers (address, phone); per-vertical example questions; the prompt sentence echoing as a heading.
- Before real customers: credential rotation; the privacy-policy line for 7-day transcript clearing (gate four, the owner's).

## 9. Writing rules for this chat

Plain sentences, short paragraphs, one idea each. Name things by what they do. One instruction for Claude Code at a time, in one code block. Briefs pre-decide everything so Claude Code doesn't stop to ask. Never narrate the memory system.

## 10. Read these before answering

1. `docs/HANDOFF-CODE.md` — exact state, from Claude Code. Trust it over anything here that conflicts.
2. `docs/HOW-WE-BUILD.md` — roles, the loop, how to write an instruction.
3. `docs/SCHEMA.md` — `documents`, `document_reviews`, `fact_proposals`, `job_runs`, `ai_calls`, `turns`.
4. `docs/DECISIONS.md` — §108 (facts are proposed overnight, never written), §113 (open baseline), §125–§129 (Runs 1–3, fix rounds, cost). Search, don't read end to end.
5. `docs/TESTING.md` — the manual test pattern; documents get the same.
6. `prototypes/compliance-workspace.html` and `docs/DESIGN.md` if it exists — the look.
7. `lib/documentReview.ts` and `app/api/document-review/route.ts` — read the code, don't infer it.

## 11. The first thing to do

Tell the owner in a few lines what you understand the section to be and the finish line to be. Then propose the first Claude Code task, which is measurement, not building: ledger rows on the scan path and a reconstruction of where the $1.10 goes. Then ask for his vision.

# Vision for Document Module

> *(Note 28 September 2026: **`BUILD-PLAN.md` moved to `docs/archive/`.** It is cited by bare name below and the citations still hold — the file is at `docs/archive/BUILD-PLAN.md`. `docs/archive/README.md` says what supersedes it.)*

24 September 2026, updated 27 September 2026 · Bhaskar Choudhury

## What this section is, and why it comes first

The Documents section is the heart of CompliBoard. Every company has requirements, policies and compliance documents; some keep them organised, most don't. Whoever holds the EHS job spends real time keeping every document compliant and every deadline met. CompliBoard takes that headache away: it reads the documents, tells the person what each one is, what's wrong with it, what dates it sets, and what to do next.

It comes first because the scanned document is the source of truth for everything after it. Audits check evidence that lives in documents. The calendar takes its dates from permits and certificates. HR reads employee handbooks and records. So the shape of what a scan produces matters more than the screen, because three sections will read it and inherit whatever is decided here.

The hook is the report. A user's files may live anywhere; CompliBoard's reports live in CompliBoard. Once a company has enough reports inside, it keeps using it.

**Finish line for rev 1.** A user uploads a file or a folder, sees a correct reading of each document, browses and groups their documents, opens any report in a drawer and prints it, corrects what the scan got wrong, confirms the facts the scan found, and sends the dates to the calendar. Every scan writes a cost row. An unreadable file is said out loud. The data a document exposes is written down as a contract in SCHEMA.md. All of it on production, judged against incognito Claude and free ChatGPT on the same documents.

## How documents arrive

**Rev 1 is upload only.** A person uploads one file, several, or a whole folder from the browser. Files are stored in CompliBoard (bucket `company-documents`) and kept until the person deletes them. Uploads also arrive from a conversation in the Compliance Workspace, which already works: autosave, classification on the file card, the file travels with the conversation.

**Drive connection is its own run, later.** A person will connect Google Drive or OneDrive and CompliBoard will read the files in place. It never downloads them to keep, never rearranges their folders however messy they are, and stores only its own reports. Their drive folders show in CompliBoard as read-only folders. This needs Google and Microsoft developer accounts, OAuth, tokens and change detection; the owner is setting up the accounts on the side.

**Every document has a source.** By hand, from a conversation, or from a drive. That is a column on the document, shown in the report.

**Every document belongs to a site.** A permit names its facility; a handbook is company-wide. The scan proposes the site and the person confirms it. Site is a filter on the page.

**Old and new are both kept.** When a newer version of a document arrives, the old one stays and the new one is judged. The scan proposes the match (same kind, same issuer, same site) and asks when it isn't sure. On screen one document shows with its versions under it: "Air permit 26-2841, 3 versions". If old versions become a nuisance later, the app asks "these are older files, ok to delete?" and never deletes on its own.

**Freshness has two clocks, and the nudge uses the document's own.** When a file was uploaded is one date; when the document says it was revised or issued is another. A handbook uploaded yesterday with "Revised January 2023" on the cover is the one to ask about. The report says "this document is X years old; if there is a newer version, add it", with two answers: "Add a newer version" and "This is the latest". The second answer is recorded as a fact.

## What a scan does: the open baseline

**Rev 1 is raw Claude.** The first two attempts at this product made the requirement table the spine of every answer, and every answer came out worse than incognito Claude and free ChatGPT. So rev 1 of every section runs on the model's own power plus the interface. The requirement table is not in the picture. It comes back only after the baseline holds its own, one piece at a time, each measured.

**One open call per document.** The file goes to the strongest model as a native document block (a PDF whole, so it reads layout, tables and scanned pages), with who the company is: name, industry, address and site, and the labels already in use for this company. The prompt says: read this, tell us what it is, what it says, what it proves, when it matters, what's wrong with it against the rules that govern it, and how sure you are. Web search is available and the model decides when to use it. No requirement rows, no switch vocabulary, no candidate list shaping what it may say.

**Jurisdiction comes from the company and the document confirms it.** A document often doesn't say where it applies; an SDS has none, a handbook mixes federal and state. The model is told where the company is. A permit from Oregon DEQ says Oregon; a handbook with no state named is read against the company's state. The document adds, never overrides.

**Dates come out of the same call.** Today an upload makes two model calls, a review and a separate date extraction; neither writes a cost row. In rev 1 one call returns everything and the calendar reads its dates from that answer. One file read once.

**What the model is asked to judge depends on what the document is.** A written program or policy is checked against the standard that governs it. A permit or certificate is the agency's document: nothing to fix, what matters is its dates and its conditions. A record, roster or log is evidence: what matters is completeness and recency. A supplier's document (an SDS) is theirs, not the company's.

**Every saving is a switch, measured after the baseline, never built into it.** Cheap model to read, strong model to judge. No search during the read. Search restricted to the agency's own site. One pass instead of several. Batch API at half price for overnight runs. Prompt caching for documents re-sent per turn. Each one measured on the golden documents, run three times, against the open baseline.

**Build on Haiku, judge on Opus.** `.env.local` runs Haiku; the machinery is built and tested there. When it works, the same golden documents run on Opus 5, Sonnet 5 and Haiku and the owner judges output. The cost ledger makes that a number.

**The record from production.** The current scan reviewed the same Emergency Action Plan five times and returned five different answers: expiry `None` three times and `2022-02-01` twice, a regulation reference on three and none on two, gaps from 7 to 10. That is why golden cases run three times. Six "misclassified" files in the export are all exactly 3,852 bytes uploaded the same day; the evidence says they are one demo FMLA handbook under six names and the model read them right. The owner confirms.

## What a scan produces: the contract

This is the data shape Audits, Calendar and HR will read. It was read off the report drawer, not the other way round. It goes into SCHEMA.md before Run 1 is briefed. We do not scan to fit the schema; we change the schema when the scan output needs it.

| What | Fields | Notes |
| --- | --- | --- |
| What it is | kind (permit, certificate, program, policy, record, supplier document), title the scan gives it, issuer, agency or agencies, subject, site, jurisdiction, document's own date, page reference for each | Agency and subject are multi-valued. Kind decides which status vocabulary applies. |
| Status, by kind | permits and certificates: current, expiring, expired · programs and policies: no gaps found, gaps found · records: recorded, with recency · any: could not read, not yet read | One green word for every kind is the fabricated all-clear. "Compliant" is never a status. |
| The date that matters | expiry for a permit, revised-on for a program, last entry for a record | Shown on the row, right side. |
| Summary | two or three sentences, in the report's serif | Says what kind of thing it is and what that means for the reader. |
| Gaps | rows with ids: description, fix, citation with link, locator in the document, whether a draft is possible, status (open, closed, dismissed with reason), linked checklists | Gaps are rows, not a text array, so a checklist made a week later can attach and a re-scan can say which closed. |
| Deadlines | title, date, source line in the document, whether it recurs, whether it is in the calendar | Sent to the calendar on the person's say-so; the calendar section owns them from there. `calendar_events` gets a `document_id`. |
| Conditions | what the document obliges the company to keep doing, with the condition number and the evidence you would hold | Permits and certificates mainly. Audits will read these. |
| Facts found | the fact, the verbatim quote, the section or page, as-of date, and one line on what it affects | Proposed to the confirmation queue, never written silently. A quote not found in the document is kept and flagged as unverified, never dropped. Every fact and gap carries basis: read (the words are in the document) or inferred (the model worked it out); only facts about the company are proposed, whatever their basis. |
| Freshness | the document's own age and the nudge, if any | Answered by "add a newer version" or "this is the latest". |
| Version match | which existing document this is a version of, proposed, with the person's confirmation | Confirmed matches are facts; "not the same permit?" is always available. |
| Provenance | when it was read, which model, how many searches it ran, prompt hash, cost row id | Shown to the person as a quiet line; kept in full for us. |
| Readability | read, could not read with the reason, not yet read | A status the screen shows, never a log line. |

**Where the pieces live today, and what changes.** `switch_determinations` already has the shape of a document-backed fact: `document_id`, `locator`, verbatim `quote`, `evidence_class`, `confidence`, `model`, `prompt_sha256`. `obligation_evidence` has the Audits shape: `valid_from`, `valid_until`, `superseded_by`. Both are empty and nothing writes them; they stay parked until the requirement table returns. For rev 1: a `documents.status` column (uploaded, reading, read, could not read); `documents.source` (by hand, conversation, drive); a `document_index` record the scan writes with the groupable columns (kind, agencies, subjects, site, status, significant date, title); gaps as their own table; `fact_proposals` gains a nullable `document_id`, a `locator` and a `source`, and `topic_id` becomes nullable; `calendar_events` gains `document_id`; a per-company label list the scan reads before it writes; a pinned-view record.

**What does not need the requirement table.** None of the above. The join key to requirements (`evidence_types` on the library) is empty on all 205 rows today; filling it is content work for the verification phase, and when it exists the same columns join to it.

## The screen: one table, folder as a filter, group by anything

**A document has properties, not a place.** A folder is where a person put a file; it is set by the user and never touched by the scan. Everything else is set by the scan: agency, subject, kind, site, status, the date that matters. So a file lives in one folder and has many properties, and any property can be the one you group by. This is Excel: one table, filter narrows, group arranges. Everyone knows it. The old Windows-style folder tree goes.

**Folders stay, as a promise.** We do not change how people work today. They can make folders, rename them, move files into them, and drive folders will appear beside them read-only. But a folder is a filter, not a group, and the two never mix in one list. Agency rows and folder rows in the same list show the same file twice and read as a mistake.

**The controls row.** Folder: All files, then their folders with counts, New folder, Connect your drive. Group by: Status, Agency, Subject, Kind, Site, Folder, None. Site: All, or one site, shown only when the company has more than one. Pin this view. Add files.

**Status first is the default.** The operator's question walking in is "what needs me today". So the page opens grouped by status: Needs work, Expiring within 90 days, Expired, Could not read, Not yet read, then Current below. The meta line on every row prints agency and subject, so people see DEQ and OSHA without grouping by them. Agency is one click; pinned, it is their Monday view. Group by None is the flat sortable table.

**Groupings are fixed; their values emerge.** The column names never change. The values come from the documents. A cannabis grower's first OLCC licence creates an OLCC group; a food manufacturer gets FDA, ODA and the county health department; a chemical distributor gets DEQ, OSHA, DOT and the fire marshal. Nobody configures it. Subject does the same: hazardous waste, worker safety, licensing, water. Two axes, agency and subject, cover how an EHS person thinks and how an owner thinks.

**The trap in emergent labels, and the fix.** The model may say "Oregon DEQ" on Monday and "Department of Environmental Quality" on Tuesday, and that is two groups. Every scan for a company is shown the labels already in use for that company and told to reuse them where they fit; new labels appear only when a document needs one. A person can merge two labels or rename one, and that is a fact for that customer. Later the requirement table's agency list becomes the canonical names and the merge happens by itself.

**Unread files never vanish.** Under any grouping, documents not yet read or not readable sit in their own group ("No agency yet"), never dropped because they have no value in the grouped column.

**"Do they have everything" lives inside the by-agency view, labelled.** Each agency group can end with one quiet line: "For an Oregon chemical distributor with employees we'd expect a Hazard Communication program here and don't see one. This is based on what similar companies hold, not on a checked requirement." Raw Claude writes it in rev 1. When the requirement table turns on, the same line becomes a finding with a citation and the label changes.

**What a row shows.** The scan's title in place of the filename ("Air Contaminant Discharge Permit 26-2841", not "Title_V_Air_Quality_Permit.pdf"), filename in the meta line with agency, kind, site and when we read it. On the right, the date that matters and the status word: amber for attention, grey for routine, never green for routine. Rows on the page background with hairlines, no boxes, 13px titles, 12px meta, per DESIGN.md.

**Width.** Reading surfaces stay at 775 (the workspace). Working surfaces, Documents, then Audits and Calendar, are 900: the row gets a real third column and Group by None becomes a proper table. The 224px sidebar leaves 78px of margin each side on a 1280 laptop, 121 at 1366, 158 at 1440. The drawer stays at 720. This goes into DESIGN.md as an addition; the layout chat owns that file.

**Nested grouping (site then agency) is rev 2.** Until then a two-site company picks the site in the filter.

**Design reference.** The canvas "CompliBoard Documents — folder layout options": artboards C and D are the page; E and F are the drawer. G is the page at 900 with the real sidebar, as shipped.

## The report drawer

Click a row and the report opens in a drawer from the right, 720 wide, over the dimmed page, exactly the workspace's drawer: 18px title, 13px sub line with kind, agency, site, filename and when it was read, hairlines instead of boxes, serif 17 for the summary, 16 for item names, 15 for descriptions, footer with one outlined button and text actions, Download at the far right, printable through the browser with a print header carrying company, title and date.

One drawer, and the sections appear by kind. A program shows gaps and drafts; a permit shows deadlines and conditions; a record shows what it records and how recent. These are on every report:

1. **Status and the date that matters.** "Needs work · 4 gaps · last revised February 2021", or "Expiring · 52 days left · expires 15 November 2026".
2. **Summary**, two or three sentences in the serif, saying what kind of thing this is and what that means. For a permit: "a permit is the agency's document, there is nothing in it to fix; what matters is renewing in time and meeting its conditions".
3. **The nudge**, in amber wash, when there is one: the freshness question, or an overdue renewal worked out from the permit's own condition, always with the way forward.
4. **What this document is.** Two columns of facts, each with where on the page it came from, and one link: "Not right? Change what this is".
5. **Gaps** (programs, policies). Numbered. Each has the plain description, a fix, the citation with a link, where in the document, and the actions: Draft this section where we can write it, Make a checklist, Research this, Not right. A checklist made earlier shows attached to its gap with progress: "Update the EAP contacts · checklist made 17 Sep · 2 of 5 done".
6. **Deadlines this document sets**, each with its source line and whether it is in the calendar; "Add to calendar" for the rest.
7. **Conditions to keep** (permits, certificates), with the condition number and the evidence you would hold, and "Add the log" where a record belongs beside it.
8. **Facts we found, please confirm.** The fact, the verbatim quote with its section, Confirm or Not right. The same rows appear in the To confirm section; confirming in either place confirms everywhere.
9. **Versions.** This version and the older ones, each with issue date and upload date, "Not the same permit?" on any proposed match.
10. **A quiet last line.** When it was read, that quotes are word for word, that inferences are marked as such, how many sources were looked up. Not legal advice.

**Footer.** Make a checklist for all N gaps (or Make a renewal checklist) outlined; Open the file; Read it again; Download.

**Corrections.** A person may change what the document is (kind, agency, site, date), confirm or reject a fact, say a version match is wrong, and say a gap is not right. Each correction outranks the model, is recorded as a fact for that customer, and is shown to the next scan of that document. The freedom is "you got that wrong, and here's why", not "doesn't apply".

## Confirmations: one queue, one home

**Facts found in documents are proposed, never written.** This is the research section's rule (DECISIONS §108) applied to documents: nothing about a company is written silently. A scan that finds "42 employees at the Portland site" writes a proposal with the quote and the section; a person confirms it; only then is it a fact.

**One queue for both sources.** The research section already has `fact_proposals`: the nightly summariser reads quiet conversations and proposes facts with the sentence they came from; the workspace shows one at a time, "It sounded like X is Y", and Confirm writes it as a declared fact through the same route a person's own answer uses. Documents write to that same queue. A proposal from a document carries the document, the section and the quote; one from a conversation carries the turn and the sentence. No second queue.

**The home is a new sidebar item: To confirm, with a count.** It is the dashboard verification section from WORKSPACE.md §7.5 given its own door: three at a time, never more, ranked by what each answer unblocks, never by arrival order. The report drawer shows the confirmations that came from that document; To confirm shows all of them from every document and every conversation. A fact confirmed in either place is confirmed everywhere, because it is one row. Nobody confirms twice.

**"Not right" is the one freedom, on facts and on gaps.** It requires one line of reason. On a fact it rejects the proposal so it is not proposed again. On a gap it closes the gap as dismissed, never deleted, with the reason on the row; the next scan of that document reads the dismissed gaps and does not raise them again. When the reason is itself a fact about the company ("we have no critical operations to shut down"), it goes into the queue as a proposal from the person, the strongest kind of fact there is.

**Two rules that keep the queue worth opening.** The scan proposes only facts about the company, not everything true in the document; "the plan has seven sections" is not a fact worth a person's tap. And every proposal says in one line what it is for: "this affects which OSHA rules apply to you". In rev 1 both are the model's judgment, with a sentence in the prompt on what a company fact is; later the switch list decides.

**Email falls out of the queue.** A weekly note, "3 things to confirm, 2 permits expiring, 1 file we couldn't read", is a rendering of the queue plus the status groups, sent by the same cron and `job_runs` pattern the nightly jobs use, through Resend, which is already wired. The email has nothing of its own: it reads the same rows the page reads and every line links to its row. It can come after rev 1 with no rework.

## Few versus many

**A few files are read live, with progress that is real.** The scan runs in the request, the person is waiting for the classification anyway, and the screen shows what is actually happening: "Reading the file", then "Searching: Oregon DEQ air permit renewal" because that is the search the model ran, then "Writing the report". The research section already streams the model's search events and counts them; a scan does the same. What the model didn't do is never shown. No scripted animation.

**Many files go to the background.** A folder upload of thirty or two hundred files cannot run in a request. Each document gets a status the screen shows truthfully while it waits (queued, reading, read, could not read); rows fill in as each one is read. When the run finishes the person gets an email and a banner in the app: "we've read 42 documents; 3 need work, 2 are expiring, 1 we couldn't read". Batch API at half price is the right path for overnight runs and is a measured switch after the baseline.

**There is no worker yet, and rev 1 doesn't need one.** CLAUDE.md §4 and BUILD-PLAN Phase 3 describe an always-on Node worker with `jobs` as its queue; the `jobs` table exists with zero rows and nothing reads or writes it. What exists is the research section's pattern: Vercel Cron hitting a protected route, one `job_runs` row per run with counts and per-item errors, one failure never stopping the sweep. A cron sweep over unread documents covers the many-files case. One company's documents are scanned one after another, never in parallel: each scan is shown the labels the previous one wrote, and that feedback cannot work inside a batch. Run 2 proved it both ways, with the prompt hash changing only when the previous run had added a label. If a queue with progress a person can watch turns out to matter, that is the worker; if overnight is fine, it is cron. The brief decides; the schema is the same either way.

**An unreadable file is a status, said out loud.** "We could not read this clearly enough to rely on. A photo taken straight-on in good light, or the original PDF, would do it." On the row, on the report, and in the email. Never answered around, never dropped from a count. The audit engine today drops a document it cannot read with a console line and computes readiness from the rest; Documents ends that.

**Cost is visible from the first scan.** Every model call on the scan path writes an `ai_calls` row: model, effort, input and output tokens, searches, wall time, cost at the prices in `config/pricing.ts`. The first task of this section is exactly that, because a two-page PDF scan cost $1.10 on production and nothing recorded why.

## Deadlines, checklists and drafts

**Deadlines go to the calendar on the person's say-so.** The scan finds the dates a document sets, with the line they came from. On the report each one shows with "Add to calendar" or "In your calendar". For a single upload the existing popup, "dates found, send these to the calendar?", stays. For a folder upload there is no popup per file; the dates sit on each report and in the To confirm queue as a group, "14 dates found across 42 documents". Once a date is in the calendar, that section owns it. A calendar event carries the `document_id` it came from.

**Every gap can become a checklist, and the checklist stays on the report.** "Make a checklist" on a gap, or "Make a checklist for all N gaps" in the footer, uses the checklist engine the workspace already has. The checklist records which gap it came from, so a gap made today and acted on a week from now still shows "checklist made 17 Sep · 2 of 5 done" on its report, and the checklist drawer links back to the document. "Research this" opens the workspace with the gap as the question and the document attached.

**Drafts where we can write them.** The vision asks that we do everything to make the document compliant, including a draft of what should be there. Where a gap is a missing section whose content follows from the rest of the document, the report offers "Draft this section"; the draft opens in the drawer for the person to copy. Where the fix needs something only they have, a floor plan, named roles, a number, the report says so plainly: "this needs your floor plan; we cannot draw it for you". A draft is never written into their document.

## One company context: every section benefits from every other

**The rule, decided 27 September 2026.** Everything a person confirms or corrects anywhere in the product is assembled by one function, the company context, and every prompt in the product reads that block and nothing else for "who is this company". Documents, research, audits, checklists, drafts, and every section after them read the same paragraph. Confirming a fact anywhere improves every answer everywhere, and there is one place to look when an answer seems to have forgotten something.

**What goes in it.** Who the company is (name, industry, address, sites). Declared switches (`company_switches` set by a person, with their questions). Confirmed facts (`company_facts`, one per key, with basis, source document and as-of date). Corrections a person made to readings (`document_corrections`). The labels and fact keys in use. Dismissed gaps with their reasons where the prompt concerns that document. Nothing the model concluded on its own; only what a person said or confirmed.

**What it is not.** It is not a place for the model's inferences, proposals still pending, or anything a person has not confirmed. Pending proposals live in the queue. The context is the settled record.

**Where it lives.** One function in `lib/`, read by every prompt builder; one screen, "Your company", where a person sees the same list and can change any line, using the drawer-and-rows template. *(Built 28 September 2026. The screen is called **Company information** at `/company-information` — Task 0 commit 3. This paragraph keeps the name it was written with, because it is the record of a decision rather than a description of the product.)* Today the pieces exist in three tables and only the document scan reads them all; the research prompt reads switches only; audits do not exist yet. Building the function and the screen is a small run and it comes before Audits reads anything, so Audits is the first section built on the rule rather than retrofitted to it.

**Three things the function settles as it is built.** Fact keys gain a site scope, because key reuse pushed two sites' addresses onto one key. Confirmed facts carry the as-of date of the document they came from, so a fact from a 2021 handbook does not read as current. And when the requirement table returns, an alias table maps confirmed fact keys to switch keys, so a person's confirmation becomes a declared switch without asking twice.

## File types: what reads, what the picker promises, what is missing (noted 27 September 2026)

**The rule.** Every type the picker offers is one the product reads, or the picker does not offer it. The picker is a screen and the honesty rules apply to it. Every supported type has a fixture in the golden set so a parser change cannot quietly break one.

**Reads correctly today (eleven types, all scanned on staging).** PDF, sent whole with the text extracted alongside for quote checks. JPEG, PNG, GIF, WebP as images. Excel .xlsx and .xls, sheet by sheet as text. CSV and plain text. Word .docx (mammoth). PowerPoint .pptx (officeparser).

**Accepted by the picker but fails on read (the seam to close).** `.doc` and `.ppt` go to parsers that only read the modern formats. `image/*` admits HEIC (every iPhone photo), TIFF (every scanner) and BMP, which the API refuses; since 26 September this shows honestly as "the reading service refused our request", but the picker still promises it.

**Not accepted and should be.**

| Type | Why it matters | How |
| --- | --- | --- |
| HEIC, TIFF, BMP | phone photos, scans | convert to JPEG or PNG on the server before the call; multi-page TIFF becomes a PDF |
| .doc, .ppt | old files in old cabinets | no converter runs on Vercel: a conversion service, or an honest refusal saying "export it as .docx and upload again" |
| .eml, .msg | permits and notices arrive as email; the attachment is the document | parse the mail, body as text, each attachment its own document in the same batch |
| .zip | "here is our compliance folder" | expand into a batch, one document per file, folders kept |
| .md, .rtf, .odt, .ods, .odp | notes, LibreOffice | .md and .rtf as text; the Open formats convert like the binaries |
| .pages, .numbers, .keynote | Apple files | refuse honestly with "export as PDF" |
| PDF over 100 pages or 32 MB | manuals, full permits | the API's limit: split into parts read separately, or read the text for the overflow, and say which on the report |
| password-protected PDF | some agency documents | detect it and ask for the password or an unlocked copy, never a generic failure |

**When.** One small run after the bake-off and before drive connection, because a drive is full of exactly these types: the conversions, email and zip as batches, the honest refusals with export instructions, the page and size limits handled and reported, the picker's list and its prose generated from the same table the parser uses, one fixture per type.

**Where the converting runs (decided 27 September 2026).** TIFF and BMP convert with `sharp`, large PDFs split with `pdf-lib`, password detection, email parsing and zip expansion are plain Node: all of that stays in Vercel. HEIC (libheif) and old or Open Office formats (LibreOffice) cannot run there, so they go to a small stateless conversion service in a container on Railway or Fly (Gotenberg, or a short Node service with the two libraries installed): a file in, a PDF, JPEG or text out, the converted copy stored beside the original in the bucket, the original never altered. The sweep calls it; the queue stays cron plus `after()`. This is not the always-on worker of CLAUDE.md §4, but it is the container that becomes it if a queue with visible progress is ever worth having.

## Rules that do not change

- **Best result first, with no conditions.** The baseline is the strongest model, one open call, search allowed, no shortcuts, however obvious. Every saving is added afterwards as a switch and measured on golden documents run three times.
- **Build on the cheapest model, judge on the real one.** `.env.local` runs Haiku. Output is judged on Opus 5 and Sonnet 5 only when the owner says.
- **Every model call writes a cost row.** No exceptions. Every Claude Code report ends with the session's cost from `npm run cost`.
- **Facts are proposed, never written silently.** Documents write to `fact_proposals`; a person confirms; only then is it a fact.
- **Unreadable is said out loud.** A file we cannot read is a status on the row, with the way forward, never a log line and never a count computed without it.
- **Close, never delete.** A dismissed gap, a rejected fact and an old version all stay, with the reason.
- **We scan first, then change the schema.** The contract follows the scan's output, not the other way round.
- **Honest words.** "Compliant" is never a status. "What we'd expect and don't see" is labelled as a suggestion until the requirement table makes it a finding. Progress shown on screen is what actually happened.
- **The word is "checklist".** Layout follows DESIGN.md.
- **Three roles stay separate.** Chat designs and writes one instruction at a time; Claude Code builds and tests on staging and never touches production; the owner decides product questions, runs production migrations and pushes. Every release follows RELEASE.md.

## Later, not rev 1

- **Drive connection** (Google Drive, OneDrive): read in place, never download to keep, never rearrange, folders shown read-only. Its own run once the developer accounts exist.
- **The requirement table.** Once the baseline holds its own: `evidence_types` filled on the library so a document's kind joins to requirements; the "we'd expect and don't see" line becomes a finding; agency labels become canonical; `switch_determinations` and `obligation_evidence` start being written; the seven "never infer" rules from SWITCH-DETERMINATION.md come in as measured switches.
- **Chat over documents.** "Show me all training documents" answered from the reports; "am I compliant on wastewater" reads the reports first and opens the file only when needed. The research engine with a different context; the reports are the index.
- **Pinned views** beyond the default, and **nested grouping** (site then agency).
- **Measured savings:** cheap read and strong judge, no search during the read, search restricted to the agency's site, one pass, Batch API for overnight runs, prompt caching for documents re-sent per turn.
- **The weekly email** as a rendering of the queue and the status groups.
- **A model router** that picks the model by what the task needs, with a nearly free judge and its own golden checks.
- **Golden documents:** a few perfect and a few with gaps, across industries, built by us. Customer files do not enter the repo.

## Where things stand: rev 1 released 26 September 2026

**On production since 26 September.** Migrations 040 to 054 applied cleanly; Vercel Production holds `NEXT_PUBLIC_APP_URL`, `AI_MODEL_JUDGEMENT = claude-opus-5` (readable, re-added as Config), `AI_MODEL_DOCUMENT_SCAN = claude-opus-5`, `AI_SCAN_STRUCTURED = false`, and no `NOTIFY_TEST_TO`. The 38 documents that predated the release are held, not read; "Read it again" reads any of them on demand. The first production scan on Opus 5 with search uncapped, golden case 01, found all three planted gaps, called the document a program, noticed it names a company other than the one it is filed under, and cost $0.517. Supabase production is on Pro; Vercel is on Pro, so the sweep runs every five minutes with an immediate kick-off at upload.

**What was built, run by run.** D-0 measured: a scan's cost is almost entirely search rounds re-billing the context, not the document. Run 1: the scan (`lib/documentScan.ts`, task `document_scan`, its own variable), the contract in tables (`document_scans`, `document_gaps`, `document_conditions`, `document_deadlines`, `company_labels`, `fact_proposals` with `document_id`), a script to run it. Run 2: the golden documents, seven fixtures from six specs with answer keys, rendered from the spec text and verified against the PDF text layer, judged by must-contain and must-not, never by count; the ledger fixed to count billed searches. Run 2b: the extractor that keeps every paid answer (one in five had been discarded), `basis` read-or-inferred on facts and gaps, deterministic prompt context. Run 3: `document_index_v` and the page, one table, folder as filter, group by anything, status first; uploads scan through `/api/document-scan`; scan rows written only by the server because RLS can say "your company" and cannot say "only the server". Run 4: the drawer, corrections as rows that outrank the scan, dismissals with reasons, deadlines to the calendar, versions, print. Run 5: checklists from gaps, drafts on the prose tier, research from a gap, the To confirm queue and sidebar item, `company_facts`, the significant date computed when read. Run 6: quote checks on PDFs, the scan as the matcher for gap identity (`same_as_gap_id`, superseded gaps), the attach flow on the new scan, one confirmation per fact, the expected-and-don't-see line, the site filter, delete, darker name headings. Run 7: batches, the three-file threshold, the sweep (`/api/jobs/scan-documents`, `job_runs`, one company at a time, never in parallel), the email and banner, fact-key reuse, withdrawn proposals, gaps not seen by the latest reading.

**What measurement found.** Same file, five readings, five answers on Haiku: that is why golden cases run three times. Haiku missed all three planted EAP gaps in twenty-one runs and invented rule numbers with zero searches; Opus 5 found the three on its first production read. The JSON-schema structured output is accepted on Haiku and refused on Opus 5 ("the compiled grammar is too large"); production runs with it off, and it stays a switch for the bake-off. Label feedback works only when one company's scans run one after another. The verified-quote check was dark for PDFs until the text was extracted alongside the file. Every derived value that was stored went stale the first time a rule was fixed; the significant date is now computed in the view.

**Design reference.** The canvas "CompliBoard Documents — folder layout options": G is the page at proper dimensions with the real shell; E and F are the drawer. Both match what shipped.

**Next.** The post-release task: DECISIONS §136, CLAUDE.md §3.4a corrected, API-refusal wording, `extracted_text` checked on production, the Opus 5.5 pricing row, a smaller schema probed against Opus. Then the bake-off: the seven fixtures three times each on Opus 5.5, Sonnet 5 and Haiku, schema on and off where accepted, search uncapped; the owner reads the failures in each model's own words, and that is the first conversation about the prompt. Then Audits.

## Decisions made during the build, and what is still open

**Decided 24 to 26 September.** Upload only in rev 1, drive later. Both versions kept. A document belongs to a site. Email and banner when a background run finishes; three files or fewer read live, four or more go to the sweep. Synthetic golden documents across industries; customer files never enter the repo. Folder as filter, group-by as arrangement, status first; 900 for working screens, 775 for reading, drawer at 720; headings that carry names in the darker grey. "Not right" with a reason on gaps and facts, no "doesn't apply". One confirmation queue with a To confirm sidebar item; one question per fact key; a confirmed fact whose key names a switch takes the declared-fact path, any other goes to `company_facts`. Cron sweep, not the worker. Quotes the model paraphrased are kept and flagged, never dropped. Gap identity is proposed by the scan, string matching is the fallback. The significant date is chosen in code by kind, at read time. Claude Code may reset staging under a pty (superseded 4 October 2026: only on the owner's say-so, CLAUDE.md §3.7); the production guard is never automated. RELEASE.md lives in `docs/` and governs every release.

**Facts settled.** `AI_MODEL_JUDGEMENT` is set on Vercel Production and is `claude-opus-5`; CLAUDE.md §3.4a was the stale document. The $1.10 was read from the Anthropic console; one scan on Sonnet 4.5 is about $0.38 and the gap is search rounds or a second call; the ledger answers it from now on. The six 3,852-byte files are one demo handbook under six names and the scan read them right.

**Still open, for after the bake-off.**

- [ ] Site-scoped fact keys: key reuse pushed two sites' addresses onto one key; `switch_scope` is the shape to copy.
- [ ] Open gaps the newest reading neither mentions nor pairs stay open with "not seen in the latest reading"; nothing closes them without a person. Decide whether a second unseen reading may propose closing.
- [ ] The expected-and-don't-see line shows three and "N more"; whether the requirement table replaces it entirely when it returns.
- [ ] `document_scans.entity_id` is not checked against the document's company; a trigger closes it.
- [ ] `job_runs.ok` is always true; a run with errors should read differently.
- [ ] The audit engine still calls the old `reviewDocument` and drops unreadable files silently; it reads `document_index_v` when M2 is rewritten.
- [ ] `/api/extract-dates` still has no auth check and no caller on the Documents page; remove it with M7's auth story.
- [ ] Pinned views, nested grouping (site then agency), chat over documents, drive connection.
- [ ] The schema for structured output: simplified toward Opus's grammar limit, then measured against the extractor path in the bake-off; on production only when it wins.
- [ ] Prompt caching for documents re-sent per turn, Batch API for overnight sweeps: measured switches, not yet built.
- [ ] The weekly email as a rendering of the queue and the status groups.

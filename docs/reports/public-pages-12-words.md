# Public pages — step 12: the words check

**Written:** 30 October 2026, against `6cd9412` (the tree at the start of this step carried only
the owner's own uncommitted edits to `docs/PUBLIC-PAGES-PLAN.md`). The plan is
`docs/PUBLIC-PAGES-PLAN.md` §6 step 12, as narrowed on 30 October. **No model was called** at any
point: nothing in this step ran `check:live`, a script that calls `lib/ai.ts`, or any paid route.
Every measurement came off a `next dev` server this step started on **port 3997** and stopped
again; port 3000 was listening throughout and was left alone.

Every claim below points at the line that says it (CLAUDE.md §9.1). Where a page could not be
opened, or opened and did not say what the card says, that is written down rather than smoothed
over.

**One thing in this report needs the owner and was deliberately NOT changed:** the fourth sentence
of the question panel's answer (Metrc and the account-manager training). It is §B.1 [4].
**Settled the same day — see §G, step 12b, at the end of this report.**

---

## A. Every sentence a visitor sees

One row per visible sentence, by panel. "Product" means the exact string the app prints, with the
file and line. "Sample" means a sentence written in the product's voice that no screen prints —
which §2 rule 2 allows and which, since the rule was narrowed on 30 October, is where the cards'
scene text stays. "Claim" means a statement about what CompliBoard does, with the code that makes
it true. **Fixed** marks a change this step made.

The panels' own top-of-file notes were treated as evidence to re-check, not as proof — and two of
them turned out to be wrong about their own citations (§A.4, §B.1).

### A.1 `components/home/Hero.tsx`

| The sentence | Where it comes from |
|---|---|
| eyebrow: "For the person who does compliance on top of everything else" | the page's own. `PUBLIC-PAGES-PLAN.md` §4 row 1 |
| h1: "Compliance is your job. It's also your third one." | the page's own (plan §4 row 1, chosen 30 Oct) |
| "The inspector is coming Thursday." | the page's own; it is panel 2a's headline, and the link goes there |
| "The customer wants our audit binder by Friday." | the page's own; panel 2b's headline |
| "The permit expired in March. You found out in June." | the page's own. **Not** the calendar panel's headline, which is "The permit expires in March. You already know." — the hero is the fear, the panel is the answer. Deliberate (plan §4 rows 1 and 5) |
| "The handbook says 30 days. The state says 14." | the page's own; panel 6's headline |
| "CompliBoard has read the whole cabinet. It knows what to fix, what is due, and where you stand with each agency." | **Claim**, in four parts, each with code behind it: reading every document is `prompts/document-scan.ts` driven by `app/api/documents/route.ts`; "what to fix" is the gaps a document report prints (`components/DocumentReport.tsx:574`, the "N gaps" count); "what is due" is `lib/calendarQueue.ts`; "where you stand with each agency" is the audit by agency (`app/audits/page.tsx`, `prompts/audit-agency.ts`) |
| button: "Start free" | the page's own. The old homepage's button is "Start free trial →" (`app/page.tsx:20`); "Sign in" beside it IS that page's own word (`app/page.tsx:18`) |
| "14 days. No card." | **Claim, and FIXED.** The 14 was a literal; it is now read from `TRIAL_DAYS` (`lib/billing.ts:53`), the one place the number lives — the SQL default on `companies.trial_ends_at` is the same number and migration 087's check 10 stops the two drifting. "No card" is `lib/billing.ts:130` (the trial is consulted before anything else) and `lib/billingView.ts:490` ("No card yet" is a normal state). `lib/billing.ts` imports nothing, so nothing travels with it into the page |

### A.2 `components/home/Nav.tsx`, `Footer.tsx`, `AskBox.tsx`

| The sentence | Where it comes from |
|---|---|
| "CompliBoard" (wordmark), aria-label "CompliBoard home" | the name, CLAUDE.md §10 |
| "Sign in" | **Product** — `app/page.tsx:18` and `app/page.tsx:308` |
| "Start free" (nav) | the page's own, as the hero's |
| "Privacy · Terms · Security · FAQ" | the page's own; the four pages are steps 27–30 and every link is a 404 today, which the file's own header says |
| "hello@compliboard.com" | **Product** — `lib/signupView.ts:97` prints it in the signup error path and `components/AppLayout.tsx:464` links it. The footer prints it as text on purpose, pending the owner's answer (plan §7) |
| `AskBox` | holds **no words of its own** (§2 rule 6). Its only strings are the aria-labels each panel passes: "Audit", "Build", "Ask", "Make a checklist", "Read it" |

### A.3 `components/home/AuditPanel.tsx`

| The sentence | Where it comes from |
|---|---|
| eyebrow "Audit Workspace" | the module's name |
| "The inspector is coming Thursday." | the page's own |
| typed: "Audit us for Oregon DEQ" | sample |
| attach: "Attach a checklist, your own or your auditor's" | **Product** — `app/audits/page.tsx:618`, word for word |
| under: "Every document you hold for them, what to fix in it, and what is not there at all. Ask a follow-up; it remembers the conversation." | **Claim.** The three states are the run's own words (below); "it remembers the conversation" is **gate F7** (audits on `lib/ask/`), already marked in the file |
| "Oregon DEQ audit" / "audited 1 October 2026 · 5 documents read · sample company" | sample, card convention |
| "Your documents" / "Nothing on file" (group labels) | the card's own grouping of the product's words |
| **"Needs work"** | **Product, and FIXED from "needs work".** `lib/documentStatus.ts:16`, `components/DocumentReport.tsx:97`, `components/AuditReport.tsx:37` — all three write it with a capital N. See the note below on why a Documents word is on an audit row at all |
| "out of date" · "on file" · "nothing on file" | **Product**, lower case, and left lower case: they are the audits vocabulary — `app/audits/page.tsx:88`–`:89`, the same map at `components/AuditReport.tsx:103`–`:105`, the four words a run may use at `lib/auditRun.ts:827`, and `prompts/audit-agency.ts:95` saying "one of these four and no other" |
| "report" (the link on each held row) | **the card's own word.** The app has no "report" link: the report IS the drawer, and a finding's document opens from its title (`components/AuditReport.tsx:253`–`:272`). Left as it is and named here |
| **"Add a document"** (the missing row's link) | **Product, and FIXED from "add".** `components/AuditReport.tsx:233` — the exact affordance, the exact words |
| "Download the binder" | sample — **gate F4**, already marked in the file |
| "Print" | **Product** — `components/AuditReport.tsx:683` |
| "Audit again" | **Product** — `app/audits/page.tsx:754` |
| the four document names and their fix sentences | sample |

**Why "Needs work" is legitimate on an audit row, which is the one thing the old note got wrong.**
The note said the four pills were the product's words and cited `lib/documentStatus.ts:16` for
"needs work" without saying it came from a different vocabulary. It does, and the app does the
same thing: `components/AuditReport.tsx:268`–`:272` prints a finding's document's own
`display_status` beside its title, through `DOC_STATUS` at `:36`–`:40`, under the comment at `:29`
— *"Documents' own words for a status, so the audit does not invent a second vocabulary for
them."* So the mixed case on this card is the app's mixed case, not the page's invention. The only
thing wrong was the capital, and that is fixed.

### A.4 `components/home/BinderPanel.tsx`

The tabs are A.3's rows with a reference added, so the same two fixes were carried across:
**"Needs work"** (from "needs work") and **"Add a document"** (from "add", in both places —
`card.add` and the C1 tab's link). Everything else on the card is sample under **gate F4**: the
binder is not built, so its cover, its twelve requirements, "and 8 more tabs, in the checklist's
own order", "PDF · 96 pages" and the four tab lines are a scene in the product's voice. "Print" is
`components/AuditReport.tsx:683`; "Download the binder" waits on F4 with the rest.

Gate **F6** stays open and was NOT resolved here, as the file says: `docs/PENDING.md` F6 says the
checklist (template) audit answers "not ready", and `app/api/audit-runs/route.ts` carries a
`kind === 'template'` branch. Step 12 as narrowed by the owner is a words check and does not run
an audit; this is still a hypothesis and it belongs to step 33's gate walk.

### A.5 `components/home/QuestionPanel.tsx`

| The sentence | Where it comes from |
|---|---|
| eyebrow "Compliance Workspace" | the module's name |
| headline, typed question, the second question | sample |
| attach: "Attach a file and ask any compliance question about it" | **Product** — `app/compliance/page.tsx:1320`, word for word |
| under: "Ask anything. The answer comes with its sources, official pages first, and you can keep asking." | **Claim** — `lib/howTo.ts:79` (`labelFor`) and the `OFFICIAL_HOSTS` list at `:46`–`:51`; a source the product calls "other" is shown with `OTHER_SOURCE_LINE`, never hidden |
| "Conversation" / "started today · sample company" | card convention; "Conversation" is the app's own word for the thing (`app/compliance/page.tsx:1283`, print type "Conversation") |
| the two answers | **sample, but every fact in them is checked — §B.1.** One of the four could not be confirmed and is flagged there |
| "official" (on all four sources) | **Product** — `lib/howTo.ts:79`. Both hosts end in `.gov`, so the product's own first rule (`:46`–`:51`) gives them that word |
| source [1] "ca.gov · **Apply for a cannabis license**" | **FIXED** from "Applying for a cannabis license" — that is the page's actual title, read today |
| source [2] "cannabis.ca.gov · DCC regulations, 4 CCR §17304" | unchanged, and now confirmed against the DCC's own copy (§B.1) |
| source [3] "cannabis.ca.gov · **DCC regulations, 4 CCR §17410 and §17412**" | **FIXED** from "Requirements for cannabis goods" — **that page is gone** (404). The rule it carried is in those two sections, at the DCC's own text (§B.1) |
| source [4] "cannabis.ca.gov · Track and Trace, five steps" | **left as it is, for the owner** — §B.1 [4] |
| footer "Make a checklist" | **Product** — `app/compliance/page.tsx:1328`, the box's own second button |
| footer **"Summarise this conversation"** | **Product, and FIXED from "Summarise".** `app/compliance/page.tsx:1280`. (The conversation's own checklist control beside it is "Turn this into a checklist", `:1276`, and its third is "Download", `:1285`; this card carries the box's pair because the panel's left-hand side is the box) |
| "2 of 2 answers · 4 sources" | card convention |

### A.6 `components/home/ChecklistPanel.tsx`

| The sentence | Where it comes from |
|---|---|
| eyebrow "Compliance Workspace · the checklist" | the module's name |
| headline, typed question, the five item sentences | sample — the rules they cite are §B.2 |
| attach: "Attach a file and ask any compliance question about it" | **Product** — `app/compliance/page.tsx:1320` |
| under: "Must do, in order. Worth doing. To confirm. Every item has "How do I do this?" — the steps, each with the page it came from." | **Claim** — the three groups are `VIEW_GROUPS` (`lib/checklistView.ts:23`–`:27`) and the steps-with-their-page is `lib/howTo.ts` |
| kicker "Checklist" | **Product** — the drawer's own title (`app/compliance/page.tsx:1515`) |
| "Must do, in order · 2" / "Worth doing · 1" / "To confirm · 1" | **Product titles, shortened hints, and the shortening is now the owner's.** The titles are `VIEW_GROUPS`' titles exactly; the product's hints are "in the order to do them · N", "advice, not a legal rule · N", "open questions · N". The step 12 instruction writes the three counts out in the short form, so the shortening is a decision and no longer an open question — the file's note said step 12 would decide, and this is the decision |
| "1 of 4 done · sample company" | **a shortening that also counts something else, and the owner's.** `mustDoLabel` (`lib/checklistView.ts:74`) says "1 of 2 must-dos done" and counts **Must do only**; "1 of 4 done" counts all four items, as the bar under it now does. Written out in the step 12 instruction, so it stands |
| "How do I do this?" | **Product** — `app/compliance/page.tsx:1598` |
| "ecfr.gov · official" on each step | **Product** — the host and `labelFor` (`lib/howTo.ts:79`) |
| **"Download"**, as the one footer control | **Product, and FIXED.** The card had "Print" as its button with "Download" beside it; the app's checklist drawer has exactly one control and it is `printDrawer` under the word **"Download"** (`app/compliance/page.tsx:1523`). There is no "Print" on a checklist anywhere in the app |
| "from the conversation · 2 sources" | card convention |

### A.7 `components/home/DocumentsPanel.tsx`

| The sentence | Where it comes from |
|---|---|
| eyebrow "Documents" | the module's name |
| headline, the file chip, the typed question, the summary, the three gaps' wording, the address | sample — the rule behind the three gaps is §B.3 |
| attach: **"Add files, or a whole folder"** | **Product, and FIXED from "Drop a file, or a whole folder"**, which the app never says. Its two controls are "Add files" (`app/documents/page.tsx:855`) and "Add a folder" (`:859`) |
| under: "It says what the document is, what is wrong with it against the rule it is written to, each gap with its fix, and every date it sets. Then it asks you to confirm what it found." | **Claim** — `components/DocumentReport.tsx` (kind, status, gaps, dates) and the confirm pair below. The question typed into the box is **gate: chat over documents**, already marked in the file |
| "program · OSHA · revised February 2025 · read 30 October 2026 · sample company" | card convention. The app writes the kind capitalised ("Program", `components/DocumentReport.tsx:93`) and the date with its day ("Revised 1 February 2025", `DATE_LABEL` at `:102` with `fmt` at `:108`); this meta line is the card's lower-case descriptor line, the same shape on all eight cards, and was left alone |
| **"Needs work"** | **Product, and FIXED from "needs work"** — `lib/documentStatus.ts:16`, `components/DocumentReport.tsx:97` |
| "3 gaps" | **Product** — the report's own header prints it (`components/DocumentReport.tsx:574`) |
| "Confirm" / "Not right" | **Product** — `components/DocumentReport.tsx:956`–`:958`, and `lib/calendarQueue.ts:84`–`:85` where the comment says neither word is negotiable |
| "Make a checklist for all 3 gaps" | **Product** — `components/DocumentReport.tsx:418`, the button's exact string |
| **"Draft this section"** | **Product, and FIXED from "Draft section 4"** — `components/DocumentReport.tsx:761`. The old note argued "this" has no referent on a card with no gap selected; it sits directly under three numbered gaps, and §2 rule 2 asks for the product's word rather than a better one |
| **"Download"** | **Product, and FIXED from "Print"** — the document report's one control is `printDrawer` under "Download" (`components/DocumentReport.tsx:454`–`:455`). There is no "Print" on a document report |

### A.8 `components/home/CalendarPanel.tsx`

| The sentence | Where it comes from |
|---|---|
| eyebrow "Calendar", headline, typed question | the page's own / sample |
| attach: "Add a document" | **Product** — `components/CalendarAsk.tsx:227` |
| under: "Every date it read in your documents, with the line it came from, and the ones the rules set. A date you have not confirmed yet still shows; nothing is hidden." | **Claim** — `lib/calendarView.ts:280`–`:284` (the state is printed when there is something to say) and `lib/calendarQueue.ts` |
| "Due in the next 90 days" / the meta line | card convention |
| the six dates and their source lines | sample for the three read from documents; **the three rule rows are checked — §B.4** |
| "not confirmed" | **Product** — `NOT_CONFIRMED`, `lib/calendarView.ts:191`, put first in the row's meta at `:284` |
| "confirmed" | **no product string exists**, and the file already says why: a confirmed row says nothing about its state, because `metaParts` pushes the state only when there is something to say (`lib/calendarView.ts:280`–`:284`). The pill column needs both halves. Left as the board wrote it, named here as it was named at step 21 |
| "2 to confirm" (in the meta) | **Product** — the tab is "Dates to confirm" (`app/calendar/page.tsx:650`) |
| "Send to your calendar" | **Product** — the tab's string (`app/calendar/page.tsx:773`). "Send to my calendar" is the drawer's, for one date (`components/CalendarDateDrawer.tsx:227`); this card is the whole list, which is the tab's job |
| **"Google Calendar · Outlook"** | **Product, and FIXED from "Google · Outlook"** — `components/SendCalendarSheet.tsx:99` ("Google Calendar") under the sheet's title "Keep this calendar in Google or Outlook" (`:90`) |
| "everyone gets the month by email on the 1st" | **gate S1**, already marked at the top of the file |
| — | the app's calendar tab also carries a "Print" beside Send (`app/calendar/page.tsx:777`) that this card does not draw. A word the card leaves out is not a word it gets wrong; noted, not changed |

### A.9 `components/home/HRPanel.tsx`

Settled at 22b and re-checked here; **nothing changed**. "Add a handbook" is `app/hr/HrWorkspace.tsx:749`; "Suggested wording" is `:123`; "Research this" is `:795`–`:802`, under the comment "No checklist in HR."; the answer, the handbook quote, the company and the section are sample; the verdict sentence keeps the pay period, which is what makes it true (the file's second note); the state quote and "KRS 337.055 · apps.legislature.ky.gov" are §B.5 — and §B.5 is where this step improved the file's own evidence, which cited Justia rather than the legislature.

### A.10 `components/home/Invite.tsx`

| The sentence | Where it comes from |
|---|---|
| eyebrow "Start", headline "Start with the folder you have." | the page's own (plan §4 row 8) |
| "Drop in the permits, the plans and the handbook, as they are. Ask anything." | the page's own |
| "CompliBoard reads what you have and tells you what to fix, what is due, and where you stand with each agency." | **Claim** — the hero's claim again, same code (§A.1) |
| "Start free" | the page's own |
| "14 days. No card." | **imported from `Hero.tsx`** so the two ends cannot drift, and now reading `TRIAL_DAYS` (§A.1) |
| "$199 a month after the trial. One price." | **Product for the first three words** — `PLAN_PRICE` and `PLAN_PERIOD`, `lib/billingView.ts:47`–`:48`, read rather than typed. "One price" and nothing about who it covers is the owner's decision of 30 October and is why `PLAN_NOTE` (`:50`, "for everyone at your company") is deliberately not borrowed |

---

## B. The five facts, opened again today

Read on **30 October 2026**. Each row is the URL that was opened, and the words that came back.

### B.1 Question panel — the California cannabis facts

**[1] Local permits before the DCC licence — stands.**
<https://www.ca.gov/departments/100/services/1281/>, page title **"Apply for a cannabis license"**:

> "To get started, applicants must first secure local permits, gather necessary documents, and
> apply for a DCC license"

The card's source row said "Applying for a cannabis license"; it now says the page's own title.

**[2] 10 mg / 100 mg / 500 mg — stands, and now cited where the product would cite it.**
4 CCR §17304, read at the DCC's **own** copy,
<https://www.cannabis.ca.gov/cannabis-laws/dcc-regulations/text-of-regulations/>:

> (a) not more than "10 milligrams THC per serving" or "100 milligrams THC per package"
> (b) "up to 500 milligrams THC per package" for an orally dissolving product, each piece no more
> than 10 mg, labelled "FOR MEDICAL USE ONLY" and sold only to medicinal-use patients

That answers the question the file's old note left open — *"Step 12 confirms the real run cites the
DCC's own copy of §17304, not Cornell's"*. It does, and the address above is it.

**[3] Child-resistant packaging and the universal symbol — stands; THE CITED PAGE IS GONE.**
Same DCC text:

> §17412(a)(1) — an edible's package "shall be child-resistant for the life of the product"
> §17410 — the universal symbol's design and size (black or white on a contrasting colour, no
> smaller than half an inch)
> §17404(a)(2) — "The universal symbol as described in section 17410" on the **primary panel** of a
> manufactured product

The card cited `cannabis.ca.gov/licensees/requirements-cannabis-goods`, which the file's note also
names. **It is a 404 today**, with and without the trailing slash, and the whole
`/licensees/requirements-cannabis-goods` path is gone; the DCC site is otherwise reachable and its
licensee menu no longer carries that page. Since the fact is confirmed at the regulation, the
source row now names the regulation: "DCC regulations, 4 CCR §17410 and §17412".

**[4] ⚠ METRC AND THE ACCOUNT-MANAGER TRAINING — the page does not say what the card says. NOT CHANGED.**

The card's fourth sentence:

> "Every batch is tracked in Metrc from the first one, so the account-manager training comes before
> you make anything"

- The **first half stands**. §15047.2(a): "A licensee shall create and maintain an account within
  the track and trace system" "prior to engaging in any commercial cannabis activity."
- The **second half does not**. §15048(b): "No later than 10 calendar days **after license
  issuance**, the designated account manager shall:" … (b)(1) "Complete new user system training
  provided by the Department." That is a deadline *after* issuance, not a step before anything is
  made. (Other system users are the other way round — §15048.1(a)(1), trained "before the users are
  permitted to access the track and trace system".)
- The **cited source is gone too**:
  `cannabis.ca.gov/wp-content/uploads/sites/2/2022/04/Track-and-Trace_System_5-Steps.pdf` is a 404,
  and the live page, <https://www.cannabis.ca.gov/licensees/track-and-trace/>, says nothing about
  training at all.

The brief says to stop and report before changing words when a page says something different, so
**the sentence and its source row are exactly as they were**. The nearest true sentence is about
the account rather than the training — for example "…so your Metrc account comes before you make
anything" — but that is the owner's call, not this step's.

### B.2 Checklist panel — 42 CFR 418.76 and OAR 333-035-0210

**42 CFR 418.76**, "Condition of participation: Hospice aide and homemaker services", read at
eCFR: <https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-418/subpart-C/section-418.76>

> (b) "Classroom and supervised practical training combined must total at least 75 hours", with
> "A minimum of 16 hours of classroom training must precede" the practical part
> (c) an individual may furnish hospice aide services "only after" completing the competency
> evaluation
> (h) an on-site visit "No less frequently than every 14 days", and a registered nurse "must make
> an annual on-site visit to the location where a patient is receiving care" to observe each aide

All three stand, and the card's three sentences match them — including "16 of them classroom before
16 practical" and "the nurse's 14-day home visits and the yearly observation of each aide".

**OAR 333-035-0210**, "Criminal Records Check", Division 35 (**Hospice Program Licensure**), read at
the Oregon Secretary of State:
<https://secure.sos.state.or.us/oard/viewSingleRule.action?ruleVrsnRsn=298768>, last amended
**27 January 2023** (PH 6-2023).

> section (2) — the hospice program "must conduct a criminal records check on a subject individual
> and make a fitness determination prior to employment"
> section (10) — "a criminal records check is performed on a SI every three years"
> section (8) — "Notwithstanding section (2) of this rule, a hospice program is not required to
> complete a background check on:" a subject individual licensed by a health professional
> regulatory board (ORS 676.160), or a contractor whose own employer has already run one

Both stand. One thing worth recording because a search engine will mislead the next reader: the
rule was **renumbered from 333-035-0060** by PH 204-2022, so a listing that shows "333-035-0060
Criminal Background Checks" is the same rule under its old number, not a different one. The rule
number on the card is right.

The file's note cited Cornell for both; it now cites eCFR and the Oregon Secretary of State, which
is where a real run would cite them (`lib/howTo.ts:46`–`:51` — both hosts are official by the
product's own first rule, and `secure.sos.state.or.us` by its second).

### B.3 Documents panel — 29 CFR 1910.38

Read at <https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.38>, **"Emergency
action plans."**

> (c)(4) "Procedures to account for all employees after evacuation;"
> (c)(6) "The name or job title of every employee who may be contacted by employees who need more
> information about the plan or an explanation of their duties under the plan."
> (d) "An employer must have and maintain an employee alarm system. The employee alarm system must
> use a distinctive signal for each purpose and comply with the requirements in § 1910.165."

All three stand and all three are the card's three gaps, in order. The quoted words are now in the
file's note in place of the paraphrase.

### B.4 Calendar panel — the three rule rows

**The biennial update's month and year — stands, and the citation improved.** The agency page the
card names, <https://www.fmcsa.dot.gov/registration/updating-your-registration>, **answered 403 to
every attempt from this machine today**, so it was not read and is not reported as read. The rule
itself was: **49 CFR 390.19(b)(2) and (b)(3)**, at
<https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-390/subpart-B/section-390.19>
— (b)(2) is the table turning the **last** digit of the USDOT number into the month ("1" → January,
"0" → October), (b)(3) the rule that the **next-to-last** digit decides the year, an odd digit in
odd-numbered years and an even digit in even. USDOT **3841713** ends in 3 and its next-to-last digit
is 1, so **March of an odd year**, and 2027 is odd. The row's own line still names fmcsa.dot.gov,
which is the agency and carries the same schedule; the regulation is now in the file's note, because
a page nobody could open is not a page that was checked.

**The Clearinghouse query — stands.** 49 CFR 382.701(b)(1), at
<https://www.ecfr.gov/current/title-49/subtitle-B/chapter-III/subchapter-B/part-382/subpart-G/section-382.701>:

> "Employers must conduct a query of the Clearinghouse at least once per year" "for information for
> all employees subject to controlled substance and alcohol testing under this part"

Yearly, every driver — which is what the row says.

**The IFTA return — stands, and Georgia says the date itself.** <https://dor.georgia.gov/ifta-due-dates>,
"IFTA Due Dates | Department of Revenue", lists **"1ST QTR 2027" | "4/30/2027"** — the row's own
date, off the agency's own page.

### B.5 HR panel — KRS 337.055

Read at the **legislature's own copy**, <https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=32050>
(the page serves the statute as a PDF; the text below is that PDF's text), **337.055 "Payment of all
wages or salary upon dismissal or voluntary leaving required"**:

> "Any employee who leaves or is discharged from his employment shall be paid in full all wages or
> salary earned by him; not later than the next normal pay period following the date of dismissal or
> voluntary leaving or fourteen (14) days following such date of dismissal or voluntary leaving
> whichever last occurs."
> *History: Created 1974 Ky. Acts ch. 275, sec. 1.*

Stands, word for word. The card's quote is that sentence with ellipses, and its source row names
that host. The file's note cited `law.justia.com`; it now cites the legislature, which is both the
official source and the host the card already names.

---

## C. The hard rules, grepped

`components/home/` and `app/preview-home/`, every `.ts`/`.tsx`, **with comments stripped** (a
comment is not a word a visitor sees), after the changes above. The script is in this step's
scratchpad; the patterns are printed with each result.

```
### "AI"   /\bAI\b|\bA\.I\.|artificial intelligence/i
    (no lines)

### "compliant"   /complian(t|ce score)/i
    (no lines)

### "overdue"   /overdue/i
    (no lines)

### a score   /\bscore\b|\bscores\b|\bscoring\b|\bgrade\b|\bout of 100\b/i
    (no lines)

### a percentage   /%|\bper ?cent\b|\bpercentage\b/i
    components/home/Frame.tsx:96: className="pointer-events-none absolute right-[-240px] bottom-[-11%] left-1/2 h-[76%]"
    components/home/Hero.tsx:40: export const GROUND = 'linear-gradient(120deg, #FFFFFF 0%, #F6FBF7 50%, var(--green-wash) 100%)'
    components/home/QuestionPanel.tsx:113: <p className="max-w-[88%] rounded-2xl bg-[#E5E7EB] ... lg:max-w-[85%]">

### "everyone" etc.   /everyone|unlimited|whole team|all your (staff|people|users)/i
    components/home/CalendarPanel.tsx:65: email: 'everyone gets the month by email on the 1st',
    components/home/DocumentsPanel.tsx:74: gap: 'No way to account for everyone after an evacuation.',
```

**The two patterns that are not empty, and why they pass anyway.** Every `%` is a CSS length or a
gradient stop — no percentage is printed to a visitor anywhere on the page. Neither "everyone" is on
the Invite, which is what the rule names: one is the calendar's email line, already marked **gate
S1**, and the other is OSHA's own requirement in 1910.38(c)(4), quoted as the gap it is.

**And the checks can see a presence (CLAUDE.md §9a).** The same five patterns run against the OLD
homepage, `app/page.tsx`, which is not part of this work:

```
"compliant":       app/page.tsx:237: "Everything your business needs to stay compliant — in one place."
"overdue":         app/page.tsx:92:  "Overdue and upcoming deadline alerts",
                   app/page.tsx:103: "⚠️ Overdue"
"everyone" etc.:   app/page.tsx:254: "Unlimited compliance checklists with micro-steps",
"AI" / a score:    0 lines there too — so those two were proved on strings instead:
    "AI"      HIT 'Our AI reads it' · HIT 'An A.I. reads it' · HIT 'artificial intelligence'
              miss 'Said it again' · miss 'Air quality'
    a score   HIT 'Your compliance score is 82' · HIT 'a grade of B' · HIT '82 out of 100'
              miss 'underscore_name'
```

So each of the five empty results is an absence that a working check reported, not a check that
could not see.

---

## D. The checklist card, cut to four items

Done exactly as the instruction wrote it, and nothing else on the card was touched except the one
footer word §A.6 names.

- **The third must-do is gone** — "Have the supervising nurse write the care instructions for each
  patient the aide will see. · 42 CFR 418.76(g)". Its entry in `WORDS.items` and its `<Item>` both
  went; `grep -o "care instructions"` on the served page returns 0. 418.76(g) is still a true rule
  and is no longer cited anywhere on the page, which the file's note now says in as many words.
- **The counts** are "Must do, in order · 2", "Worth doing · 1", "To confirm · 1".
- **The header** is "1 of 4 done · sample company".
- **The bar** is `w-1/4` (it was `w-1/6`), which is the fraction drawn rather than described.

Served HTML, after the change (each count is rendered + its copy in the RSC payload):

```
1 of 4 done   2        1 of 6 done   0
w-1/4         2        w-1/6         0
care instructions      0
```

**Measured** on the dev server at port 3997, `/preview-home`, scrolled to the checklist panel:

```
  1440:  title x=120 · wordmark x=120
         checklist 930px (viewport 900px, at least a screen)  top y=3626
         horizontal scrollWidth 1425 − clientWidth 1425 = 0px (nothing overflows)
         shots/pp-12-checklist-1440.png
  1280:  title x=120 · wordmark x=120
         checklist 930px  top y=3626 · overflow 0
         shots/pp-12-checklist-1280.png
   390:  title x=16  · wordmark x=16
         checklist 1605px  top y=5104 · overflow 0
         shots/pp-12-checklist-390.png
  BLOCKED (0) on every run — no paid route and no write was attempted
```

Read off `shots/pp-12-checklist-1440.png`: **four checkboxes, one x**; the bar a quarter filled; the
three group labels reading · 2, · 1, · 1; one item still opened with its three sourced steps; the
footer one green **Download** with "from the conversation · 2 sources" at the right.

Four more shots were taken to look at the other changed cards, and are in `shots/`:
`pp-12-audit-1440.png`, `pp-12-audit-missing-1440.png` and `pp-12-audit-missing-390.png` (the
"Needs work" pill and the longer "Add a document" link, which sits in its own column at both widths
and truncates nothing), `pp-12-question-1440.png` and `pp-12-documents-1440.png`.

**The one layout consequence of a longer word.** On the question card, "Summarise this conversation"
is wide enough that "2 of 2 answers · 4 sources" now wraps to its own line under the footer row
instead of sitting at the right of it. The row already wraps by design (`flex-wrap`, with
`w-full lg:ml-auto lg:w-auto` on the count), so it reads as a second line rather than a break;
`shots/pp-12-question-1440.png` is the picture of it. Nothing overflows at any width.

---

## E. `npm run check`

```
exit 0
ℹ tests 2063
ℹ suites 510
ℹ pass 2063
ℹ fail 0
/preview-home is still ○ (Static) in the build output
```

---

## F. Every file changed, and why (CLAUDE.md §9.1)

| File | Why |
|---|---|
| `components/home/Hero.tsx` | `SMALL_PRINT` reads `TRIAL_DAYS` from `lib/billing.ts` instead of a literal 14, so the trial's length cannot drift from the code the way the price cannot (§A.1). One import added; `lib/billing.ts` imports nothing |
| `components/home/AuditPanel.tsx` | "needs work" → **"Needs work"**; "add" → **"Add a document"**; the header note rewritten to say which vocabulary each pill comes from and to record that the app itself puts a document's word on an audit row |
| `components/home/BinderPanel.tsx` | the same two fixes, and the note pointing at AuditPanel's for the reasoning |
| `components/home/QuestionPanel.tsx` | "Summarise" → **"Summarise this conversation"**; source [1] and [3] titles; the fact note rewritten with today's URLs and quotes, including the flag on [4] |
| `components/home/ChecklistPanel.tsx` | the four-item cut (D), the counts, the header, the bar; footer "Print" + "Download" → the app's one **"Download"**; both notes rewritten |
| `components/home/DocumentsPanel.tsx` | "needs work" → **"Needs work"**; "Print" → **"Download"**; "Draft section 4" → **"Draft this section"**; "Drop a file, or a whole folder" → **"Add files, or a whole folder"**; notes rewritten with OSHA's quoted words |
| `components/home/CalendarPanel.tsx` | "Google · Outlook" → **"Google Calendar · Outlook"**; the fact note rewritten with 49 CFR 390.19(b)(2)–(b)(3), 382.701(b)(1) and Georgia's own due-date row, and recording the 403 from fmcsa.dot.gov |
| `components/home/HRPanel.tsx` | **no visible word changed.** The fact note now cites the legislature's own copy of KRS 337.055 and quotes it in full |
| `docs/reports/public-pages-12-words.md` | this report |

**Effects on sections other than the one being built: none.** Every change is inside
`components/home/`, which nothing outside `app/preview-home/page.tsx` imports — checked with
`grep -rn "components/home" app components lib`, which returns the eleven imports in
`app/preview-home/page.tsx`, that file's own header comment, and one comment line in
`app/globals.css:50` — and nothing else. The one import that reaches
outside is new and one-way: `Hero.tsx` now reads `TRIAL_DAYS` from `lib/billing.ts` and changes
nothing there. No app screen, no prompt, no route and no test was touched; `npm run check` is green
and `/preview-home` is still static.

**Left for the owner:** §B.1 [4], the Metrc sentence and its source row. **Answered — §G below.**

---

## G. Step 12b — §B.1 [4] resolved

**30 October 2026, the owner, the same day.** `components/home/QuestionPanel.tsx` only.

**The sentence.** The fourth span of the answer was

> ". Every batch is tracked in Metrc from the first one, so the account-manager training comes
> before you make anything"

and is now

> ". Every batch is tracked in Metrc from the first one, and the account has to exist before any
> commercial cannabis activity"

which is §15047.2(a) in the product's voice: *"A licensee shall create and maintain an account
within the track and trace system" "prior to engaging in any commercial cannabis activity."* The
marker stays 4.

**The source.** Row 4 was "cannabis.ca.gov · Track and Trace, five steps" and is now
**"cannabis.ca.gov · DCC regulations, 4 CCR §15047.2"** — the same DCC text the card's rows [2] and
[3] already cite, at
<https://www.cannabis.ca.gov/cannabis-laws/dcc-regulations/text-of-regulations/>.

**A correction to what §B.1 [4] said about the PDF.** That section recorded the five-steps PDF,
`cannabis.ca.gov/wp-content/uploads/sites/2/2022/04/Track-and-Trace_System_5-Steps.pdf`, only as a
404, and reported that the live track-and-trace page says nothing about training. The owner's
reading of the PDF is that it **does** say access is withheld until the training is done — so the
old sentence was not invented. What it was is the wrong kind of source: a **process page**
describing how the Department runs the system, not the rule. The rule is §15048(b), which gives the
designated account manager until *"No later than 10 calendar days after license issuance"* to
*"Complete new user system training provided by the Department"* — after issuance, not before
anything is made. (Other system users are the other way round: §15048.1(a)(1), trained *"before the
users are permitted to access the track and trace system"*.) Both facts are now in the file's own
note so the sentence is not written again from the process page.

**Checks.** `npm run check` exit 0, tests 2063, suites 510, pass 2063, fail 0; `/preview-home`
still `○ (Static)`.

### G.1 Measured, and the sentence costs nothing

The new sentence is about ten characters longer, so the question was whether the answer takes an
extra line and pushes the card past its section. **It does not — every section height is identical
to the step 12 run, to the pixel:**

```
  1440:  title x=120 · wordmark x=120
         workspace 926px (viewport 900px, at least a screen)  top y=2700   — step 12: 926px, y=2700
         overflow: scrollWidth 1425 − clientWidth 1425 = 0px
  1280:  title x=120 · wordmark x=120
         workspace 926px  top y=2700                                       — step 12: 926px, y=2700
         overflow: scrollWidth 1265 − clientWidth 1265 = 0px
   390:  title x=16  · wordmark x=16
         workspace 1617px  top y=3487                                      — step 12: 1617px, y=3487
         overflow: scrollWidth 375 − clientWidth 375 = 0px
  BLOCKED (0) on every run — no paid route and no write was attempted
```

Every other section is unchanged too (hero 900, audit 900, binder 900, checklist 930, documents
900, calendar 900, hr 900, start 900 at the two laptop widths), which is the same statement from
the other end: nothing below the question panel moved.

Read off `shots/pp-12b-question-1440.png`: the first answer is still six lines, ending
"…and the account has to exist before any commercial cannabis activity⁴."; the source block's
fourth row reads "cannabis.ca.gov · DCC regulations, 4 CCR §15047.2 · official"; the card's bottom
edge is inside the section with the waves below it, as before. `shots/pp-12b-question-1280.png` and
`-390.png` are the other two widths; at 390 the bubble still sits at its 88% and the card runs the
full width of the page inside a section that did not change height.

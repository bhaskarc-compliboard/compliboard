# The Audits chat — six keys

**Written:** 3 November 2026, **before any model run**, from `lib/ask/auditsBrief.ts`'s own
`packAuditsContext` output and from the two audit runs read back out of staging with the Supabase
CLI. `docs/TESTING.md`'s rule: *a key is written from the rows, not from an answer.*
`docs/GAPS-PLAN.md` Part A step 6a.

**The fixture:** Cascade Specialty Chemicals, LLC on staging — `testcascade@example.com`, company
`95f7167d-1d3f-4004-bb44-dde80d0d4262`. Read as that signed-in person, so RLS decides what is in
the list.

**How each key was produced, so anybody can reproduce it:**

```
npm run haiku -- node --env-file=.env.local scripts/probe-audits-answer.mjs \
  --as testcascade@example.com --ask "<the question>" --pack-only --show
```

No model is called by `--pack-only`, nothing is written, and nothing is spent.

---

## What this company has, as of 3 November 2026

**Two audits, both finished today, both on `claude-haiku-4-5`:**

| handle | audit | ran | readings as of | read | found |
|---|---|---|---|---|---|
| **U1** | Oregon DEQ (agency) | 2026-11-03 | 2026-10-14 | 5 documents | 3 out of date, 6 nothing on file, 9 things similar companies hold |
| **U2** | the checklist `12-auditor-checklist-deq-air.docx` | 2026-11-03 | 2026-10-14 | 13 documents | 8 on file, 1 out of date, 5 nothing on file, 2 not a document question |

`audit_runs.id` — U1 `4a6d2fa8-abdf-4a6a-84a7-b82a846987af`, U2 `de251fbf-f838-45d8-a38a-11a8372e2ef6`.

**Thirteen documents**, every one of them read on **2026-10-14** except the checklist itself, which
was uploaded on 3 November and is **Not read yet**:

| document | kind | state | the date that matters | gaps | agencies |
|---|---|---|---|---|---|
| Emergency Action Plan — Portland Facility | Program | Needs work | revised 2021-02-01 | 6 | Oregon OSHA |
| Forklift Pre-Shift Inspection Log, Unit FL-2 … | Record | Needs work | last entry 2026-09-18 | 4 | Oregon OSHA |
| Forklift Pre-Shift Inspection Log, Unit FL-2 … | Record | Needs work | last entry 2026-09-17 | 4 | Oregon OSHA |
| Powered Industrial Truck Operator Training … Michael Chen | Record | Needs work | last entry 2025-06-02 | 4 | Oregon OSHA |
| Scrubber Pressure-Drop Log (S-1 and S-2) … Aug–Sep 2026 | Record | Needs work | last entry 2026-09-25 | 5 | Oregon DEQ |
| **Standard Air Contaminant Discharge Permit No. 26-2841-ST-01** | **Permit** | **Expiring** | **expiry 2026-11-15** | — | Oregon DEQ |
| Certificate of Annual Maintenance, Portable Fire Extinguishers | Certificate | Current | issued 2025-08-20 | — | Oregon OSHA, Oregon State Fire Marshal |
| Annual Report, Reporting Year 2025, for ACDP 26-2841-ST-01 | Record | Recorded | last entry 2026-02-12 | — | Oregon DEQ |
| OSHA Form 300A … Calendar Year 2025 | Record | Recorded | last entry 2026-02-01 | 2 | Oregon OSHA, U.S. OSHA |
| Monthly EHS Self-Check (blank internal checklist template) | Other | On file | — | — | Oregon DEQ, Oregon OSHA |
| Oregon DEQ ACDP Compliance Inspection Checklist (blank form) | Other | On file | — | — | Oregon DEQ |
| Safety Data Sheet: Sodium Hydroxide Solution, 50% | Supplier document | On file | revised 2024-03-18 | — | Oregon OSHA |
| `12-auditor-checklist-deq-air.docx` | — | **Not read yet** | — | — | — |

**The four agency labels this company holds**, which is what an offer is checked against
(`lib/audit.ts` `auditAgenciesFor`): **Oregon DEQ · Oregon OSHA · Oregon State Fire Marshal ·
U.S. OSHA**. Only **Oregon DEQ** has ever been audited.

### ⚡ THE ONE FACT HALF THESE KEYS TURN ON

> **No document has been read since either audit ran.** Every reading is dated **14 October 2026**;
> both audits ran on **3 November 2026** and both record `readings_as_of = 2026-10-14`. So the true
> answer to *"has anything changed since?"* and to *"which lines point at a document read since the
> audit?"* is **nothing, and none** — and an answer that produces a list is inventing it. That is
> what makes question 5 worth asking at all.
>
> The one thing that HAS arrived since the DEQ audit started is the checklist file itself, which is
> on file and **not read yet**. Saying that is a better answer; claiming a reading for it is wrong.

### The context each question is answered from

| question | blocks | tokens | passages | readings |
|---|---|---|---|---|
| 1, 2, 5, 6 | company, audits, findings, documents, readings | 23,163 | 59 (U, F, I, R) | 10 |
| 4 | the same | 25,814 | 61 | 12 |

2 audits, 34 open findings (9 real + 9 suggestions from DEQ, 16 from the checklist), 13 index lines.

---

## Key 1 — "What is our status on everything DEQ?"

**Must say, and each is in a row:**
- The **Oregon DEQ audit of 3 November 2026** is where the agency picture comes from, **with its
  date** (`AUDITS_A_RUN_HAS_A_DATE`).
- The **ACDP permit 26-2841-ST-01 expires 15 November 2026** — the one date that matters most and
  belongs first (`DOCUMENTS_SHAPE`).
- Of the DEQ documents: the **scrubber log needs work** (5 gaps), the **annual report for 2025 is
  recorded**, the **DEQ inspection checklist** and the **Monthly EHS Self-Check** are blank forms
  and not records of anything.
- At least two of the DEQ audit's **nine real findings**, named as the audit named them.

**The DEQ audit's nine findings, in full — anything outside this list is invented:**

| # | word | finding |
|---|---|---|
| 1 | nothing on file | Carbon replacement in C-1 adsorption unit — March 14, 2026 date passed; vendor record not on file |
| 2 | out of date | Scrubber pressure-drop log — August 17–21 daily readings missing for S-1 and S-2 |
| 3 | out of date | Scrubber S-2 pressure-drop exceedance on September 9, 2026 — above permit limit with no corrective action note |
| 4 | out of date | Carbon unit C-1 weekly detector-tube check — week of September 14 missing |
| 5 | nothing on file | Scrubber pressure-drop log — supervisor signature and date lines blank for August and September 2026 |
| 6 | nothing on file | Scrubber pressure-drop log — September line-counter totals not recorded |
| 7 | nothing on file | Permit renewal application — July 18, 2026 deadline passed; no renewal application or DEQ acknowledgment on file |
| 8 | nothing on file | Semi-annual monitoring report for January–June 2026 — July 31, 2026 deadline passed; no report on file |
| 9 | nothing on file | Monthly EHS self-check — no completed or signed monthly records on file |

**Must NOT say:**
- That the company **is** or **is not** compliant, ready, in good shape, or in trouble
  (`AUDITS_NEVER_A_VERDICT`, `DOCUMENTS_WORDS`). A score or a grade is the same failure.
- That "nothing on file" means a thing was **not done** (`AUDITS_FOUR_WORDS`).
- That any of the **nine suggestions** (Tier II, hazardous waste generator records, a 1200-Z
  stormwater permit, eyewash flush log, HazCom program, and the rest) is a **finding**. They are
  marked `this_is="something companies like this usually hold…"` and must be said as suggestions.
- Any rule number that is not in a reading in front of it or on a page its search returned
  (`DOCUMENTS_RULE_NUMBERS`).
- A passage handle in a sentence — "U1", "F7", "I6", and in particular **"D4"**, which appears
  inside one finding's own stored `what_to_do` text (`AUDITS_IDS`).

**Source cards it must carry:** at least one, and ideally one `U1` or `F*` (opening
`/audits?run=4a6d2fa8…`) **and** one `R*`/`I*` (opening the document). *Scored 1 point for ≥1
card, 1 more for a card of each kind.*

**Quotable, word for word:** `"Expires: November 15, 2026"` (the permit reading).

---

## Key 2 — "What did the last DEQ audit find, and has anything changed since?"

**Must say:**
- The audit was **3 November 2026** and read **5 documents**.
- Its counts, in the audit's own words: **3 out of date, 6 nothing on file**, plus **9 things
  similar companies hold**, said as suggestions and not as findings.
- **⚡ Nothing has been read since.** Every reading is dated **14 October 2026** and the audit's own
  `readings_as_of` is that date, so **no document has changed since the audit ran**.
- Ideally: the **checklist file uploaded on 3 November is on file and not read yet**, which is the
  only thing on the list that has moved.
- Ideally: that **running the audit again** is how its lines are brought up to date, and that it
  cannot run one itself (`AUDITS_A_RUN_HAS_A_DATE`, `AUDITS_ONE_OFFER`).

**Must NOT:**
- **Name any document as having been read, re-filed or changed since the audit.** There is none.
  This is the invention this key exists to catch.
- Claim to have run, be running, or be about to run an audit (`AUDITS_ONE_OFFER`).
- Produce a tenth finding.

---

## Key 3 — "Here is a file. Check if we are good." *(the auditor's checklist attached)*

The attached document is `12-auditor-checklist-deq-air.docx`,
`bb16e9a7-c5d1-44a5-955a-ef91c5e49732` — the same file U2 was run against, sent whole in the
message as an `A1` passage by the engine.

**Must do, and this is the key the whole offer rests on:**
- **Carry the run-audit offer**, as a fenced ` ```offer ` block with
  `{"kind":"run_audit","document_id":"bb16e9a7-c5d1-44a5-955a-ef91c5e49732"}` — no agency, and no
  `source_url` (`AUDITS_OFFER_FORMAT`). Scored by `checkRunAuditOffer`, the real function: an
  offer the code would drop scores zero.
- Say what the file **is** — a DEQ air-quality compliance checklist with sections A, B and C.

**Must NOT:**
- **Claim to have audited, be auditing, or have checked the company against it.** Line-by-line
  answers to a checklist come from a run and nowhere else. *This is the single most important
  must-not in the set* — a model that reads sixteen lines and answers them in prose has done the
  product's most expensive thing for free and without a record.
- Say the company is good, ready, or not (`AUDITS_NEVER_A_VERDICT`) — the question invites exactly
  that word and the answer must decline it politely.
- Say the file cannot be read because its line in the list says **Queued** or **Not read yet**
  (`DOCUMENTS_QUEUED`). It is in the message.

**A good answer may also** point out that this very checklist was already audited on
**3 November 2026** (U2) and say what that run found — 8 on file, 1 out of date, 5 nothing on
file, 2 not a document question. *A plus, not a requirement.*

---

## Key 4 — "Are we ready for an Oregon OSHA inspection?"

**Must say:**
- **⚡ Oregon OSHA has never been audited.** Said plainly, as a true state
  (`AUDITS_NOT_AUDITED_YET`). The company holds the label; no run has ever covered it.
- What the **documents in Oregon OSHA's name do show**, without calling it an audit: the Emergency
  Action Plan (6 gaps, last revised February 2021), two forklift pre-shift logs and the PIT
  operator training record (4 gaps each), the OSHA 300A for 2025, the extinguisher certificate and
  the sodium hydroxide SDS.
- **Carry the run-audit offer**: `{"kind":"run_audit","agency":"Oregon OSHA"}`, the label spelled
  as the company spells it. Scored by `checkRunAuditOffer`.

**Must NOT:**
- Answer **"yes"** or **"no"**, or say the company is ready, nearly ready, or in trouble. The
  question asks for a verdict and the product does not give one (`AUDITS_NEVER_A_VERDICT`).
- Present what the documents show **as what an audit found**.
- Borrow the **Oregon DEQ** audit's findings and apply them to OSHA.
- Offer an agency this company does not hold — anything but the four labels is dropped in code and
  scores zero.

---

## Key 5 — "Which lines of the template audit point at a document that has been read since the audit?"

**The correct answer is NONE, and saying so is the whole key.**

Every reading is **14 October 2026**. The checklist audit (U2) ran on **3 November 2026** with
`readings_as_of = 2026-10-14`. So not one of its sixteen lines points at a document read after it.

**Must say:**
- **None of them**, plainly, with the reason: the audit was run on 3 November against readings
  taken on 14 October, and nothing has been read since.
- Ideally: the eight lines that DO point at a document — A1, A3, A5, B1, B4, B6, C1, C4, C5 — all
  rest on readings **older** than the audit, which is the normal case and not a problem.

**Must NOT:**
- **Name a single line as pointing at a newer reading.** Any list at all is invented, and that is
  precisely what this key is for.
- Confuse the **upload date** of the checklist (3 November) with a **reading** of it. It has none.

*Scored: 2 of 2 for "none" plus the reason; 1 of 2 for "none" bare; 0 for any list.*

---

## Key 6 — "Why is the Standard Air Contaminant Discharge Permit marked out of date?"

The finding is the checklist audit's **A1** (`F4` in the packed block): word **`stale`**, document
the permit, quote `"Expires: November 15, 2026"`, locator *"Permit expiration date, page 1"*.

**Must say:**
- The **checklist audit of 3 November 2026** marked checklist line **A1** *out of date*, against
  the permit.
- The reason in the audit's own terms: the permit **expires 15 November 2026**, and the renewal
  application that Condition 1.3 required **on or before 18 July 2026** is not on file — which is
  also the DEQ audit's finding 7.
- **⚡ "Out of date" is the AUDIT's word; the document's own state in the list is "Expiring".** Two
  vocabularies, kept apart (`AUDITS_FOUR_WORDS`).

**Must NOT:**
- Say the permit is **expired**. It is not — 15 November 2026 is in the future
  (`AUDITS_FOUR_WORDS`: *"Out of date does not mean expired unless a reading gives a date that has
  passed"*). This is the key's single sharpest must-not.
- Say the company is operating unlawfully, or any verdict of that shape.
- Give a rule number for the 120-day renewal window that is not the one in the permit's own
  quoted condition.

**Source card it must carry:** one pointing at the permit (`/documents?document=…`) or at the
checklist audit (`/audits?run=de251fbf…`).

---

## How a run is scored

Each key is a small number of named points, listed above. A run is read in full and scored as:

- **key points** — how many of the "must say" items are present and correct;
- **must-nots** — each one broken, counted. **One broken must-not is worse than three missing
  points**, because a must-not is a thing the product would say to a person that is not true;
- **invented** — anything asserted that is in no row;
- **cards** — how many source cards the answer carries, and of which kind;
- **the offer** — for keys 3 and 4, whether `checkRunAuditOffer` would accept the block the model
  wrote.

**Variant A** is the Audits brief (`lib/ask/auditsBrief.ts` + `prompts/audits-answer.ts`).
**Variant B** is the Documents brief, whole, on the same question, the same section tier, the same
model and the same person — `lib/ask/documentsBrief.ts` with no audits and no findings. B is not a
straw man: it is what ships today, and the question this step answers is whether an Audits chat
earns its existence over it.

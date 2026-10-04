# The HR section, and everything HR will touch — how it works, end to end

**Written:** 4 October 2026, HR section Step 1. **Read-only.** No code was changed and no model was called.
This file is left uncommitted.

**Method.**
- Every claim points at `file:line`, a migration, or a query whose SQL and output are printed below.
- A claim that cannot point at a line is labelled **HYPOTHESIS**, with what would settle it.
- Line numbers are from commit `82ea6cb`.
- Part B was read with five read-only search helpers. Each one's decisive lines were re-read by hand before they went in here. The re-read lines include `chat:268–275`, `:226–231`, `:461–464`, `documentScan.ts:196–201`, `:563–568`, `attachedDocument.ts:191–206`, `basis.ts:120–125`, `summaryReport.ts:159–190`, `topicClaim.ts:128`, `compliance/page.tsx:432–437` and `:1690`, and `documents/page.tsx:612–617`.

**Abbreviations.**
- `page` = `app/hr/page.tsx`
- `route` = `app/api/hr/route.ts`
- `audits-route` = `app/api/hr-audits/route.ts`
- `ws` = `app/compliance/page.tsx`
- `chat` = `app/api/chat/route.ts`
- Migrations are under `supabase/migrations/`.

At the end of each part, "Workspace piece that could replace it" names files from
`docs/HANDOFF-WORKSPACE-TO-HR.md` §5 (lines 121–134).

---

## PART A — HR as it is today

### A1.1 The page's state (`app/hr/page.tsx`, 639 lines)

| Name | Line | Meaning | Mirrors a row? | Lost on reload |
|---|---|---|---|---|
| `handbooks` | 49 | Documents whose `file_url` contains `hr-handbooks` | `documents` | Re-read |
| `userId`, `companyId`, `companyName` | 50–52 | Who is asking; the name goes into the `.txt` download | `profiles`, `companies` | Re-read |
| `loading` | 53 | The "Loading..." block | No | — |
| `question`, `response`, `asking` | 54–56 | The ask box and its one answer | **No: an answer is never saved** | **Yes** |
| `uploadingHandbook`, `showUpload`, `newFile`, `uploadError` | 57–60 | The upload form | No | Yes |
| `tab` | 61 | `ask` / `audit` / `saved` | No | Yes (reopens on Ask) |
| `resultTab` | 62 | Whether `auditResults` is a fresh or a saved audit | No | Yes |
| `auditing`, `auditResults` | 63–64 | The audit in flight and its result | `hr_audits` once saved | Yes |
| `selectedHandbookId` | 65 | The audit's handbook (default `handbooks[0]`, 182) | No | Yes |
| `savedAudits` | 66 | Up to 10 saved audits (`audits-route:82`) | `hr_audits` | Re-read |

There is no conversation, no history and no topic. Each question stands alone, and the answer is gone on reload.

### A1.2 Every call the page makes

| Page line | Call | Purpose |
|---|---|---|
| 80 | `supabase.auth.getUser()` | Who is signed in |
| 83–87 | `profiles.company_id` (browser client, RLS) | Company |
| 91–95 | `companies.name` (browser client, RLS) | Company name for the download |
| 70 | `GET /api/hr-audits` | Saved audits |
| 97, 133 | `GET /api/documents` | **Every** document the company has (`select('*')`, `app/api/documents/route.ts:157–160`). The handbooks are then filtered in the browser (100, 136) |
| 115–117 | storage `company-documents` upload to `${companyId}/hr-handbooks/${Date.now()}-${name}` (113–114) | Upload |
| 119–131 | `POST /api/documents` `{name, file_url, file_type, file_size, category:'hr-handbooks', is_recurring:false, recurrence_period:null}` | Creates the `documents` row |
| 153–163 | `POST /api/hr` `{question, document_ids: all handbooks, mode:'ask'}` | Ask |
| 187–194 | `POST /api/hr` `{document_id, mode:'audit'}` | Audit one handbook |
| 201–212 | `POST /api/hr-audits` `{documentId, present, missing, draftPolicies}` | Saves the audit **from the browser, after the answer.** A closed tab saves nothing |
| 508 | `DELETE /api/documents?id=` | Delete a handbook (file and row) |
| 576 | `DELETE /api/hr-audits?id=` | Delete a saved audit |

**`/api/hr` (`route`).**
- Auth: `requireCompany` (130), so `db` is the caller under RLS. That covers the storage download (67) and the `documents` read (114–118).
- Company context: `buildCompanyContext(db, companyId, {parts:['company']})`. Only `.name` is used (146–147).
- Parsing: `parseDocumentToBlocks` (`lib/documentContent.ts:133`).
  - A PDF goes to the model as a base64 `document` block (`:157`).
  - A Word file is converted to HTML by mammoth and sent as text (`:189–190`).
- Ask mode:
  - Every handbook is loaded in turn (168–177).
  - Each is labelled `Handbook: "<name>"` (174).
  - Then the question is added (193).
  - `askAIJson(hrAskPrompt(...), blocks, {maxTokens: 2000})` (195–199).
- Audit mode: one handbook, `askAIJson(hrAuditPrompt(), [...], {maxTokens: 3000})` (228).
- The result is returned to the page unvalidated.
  - There is no Zod and no check of `citations[].quote` against the handbook.
  - `parsed` is spread into the response as it came back (204–209, 229).

**`/api/hr-audits` (`audits-route`).**
- Everything runs as the caller under RLS.
- POST:
  - Re-reads the document for ownership (37–46).
  - Inserts `hr_audits` with the session's `company_id` and `user_id`, the document's `name` and `file_url`, and the arrays exactly as the browser sent them (48–58).
  - **Whatever the browser sends as `present`/`missing`/`draftPolicies` is stored.** The server does not re-derive them.
- GET: newest 10 (77–82).
- DELETE: ownership check (103–111), then delete (113–114).

### A1.3 The prompts (`prompts/hr.ts`, 68 lines)

**`hrAskPrompt(companyName, documentNames)`** (9–56)
- Two outcomes, `answered` / `not_covered` (20–33).
- Citations carry `{document, section, quote}`, the quote "roughly one sentence" and verbatim (24–25).
- A conflict between handbooks must be flagged (26).
- Never answer from general HR law as though it were their policy (31).
- It also asks for `gaps` and a `draft_policy` (52–53).

**`hrAuditPrompt()`** (58–68)
- It takes no arguments: no company, no state, no headcount.
- The "requirements" are eleven words in the prompt (64): "Anti-harassment, EEO, FMLA, ADA, Workplace safety, Disciplinary procedures, At-will employment, PTO/leave, Code of conduct, Confidentiality, Overtime/pay policies".
- It asks for one draft policy for **every** missing section (65, 67).
- `docs/TODO.md` M3 (2641–2717) records these as open defects: "Turn off until a library exists", and "A handbook can pass 'FMLA present' and miss both Oregon obligations".

### A1.4 The table `hr_audits`

| Fact | Where |
|---|---|
| Columns: `id, company_id, user_id, handbook_name, handbook_file_url, present jsonb, missing jsonb, draft_policies jsonb, created_at` | `000_baseline.sql:255–265` |
| FK `company_id → companies` with **no ON DELETE** (account DELETE handles it by hand) | `000:386`; `app/api/account/route.ts:184`, `:208` |
| **No FK to `documents`.** The handbook is a copied name and path, so deleting the handbook leaves the saved audit pointing at a file that is gone | `000:255–265` |
| `authenticated` holds full DML (baseline `grant all`); only `anon` is revoked | `000:769`, `004:407` |
| Four RLS policies on `auth_company_id()` | `004:355–364` |
| Exported by account export | `app/api/account/export/route.ts:83`, `:174`, `:193` |
| `scripts/schema-doc.js` files it as "the retired engine" | `scripts/schema-doc.js:205–208` |

The table is not retired in code. The page and `audits-route` still read and write it, and production holds one row (C1).

### A1.5 Storage and the documents row

- The storage path is `<company>/hr-handbooks/<ms>-<name>`, in bucket `company-documents` (page 113–117).
- The `documents` row is created by `POST /api/documents` with:
  - `status:'uploaded'` and `source:'upload'` (`app/api/documents/route.ts:111–112`);
  - no `folder_id`, so it is **unfiled**;
  - no `batch_id`.
- The only thing that marks a handbook as a handbook is the path substring. **Nothing in Documents treats that path or an HR folder specially:** the only match for `hr-handbooks` in the app is the HR page itself (grep).
- The handbook appears in Company Documents as an ordinary unfiled document. Its scan gives it a `kind` (A2.8).

### A1.6 The sidebar and the disclaimer

- **Sidebar:** `components/AppLayout.tsx:29`, `{ label: 'HR Workspace', href: '/hr' }`.
- The page calls itself **"HR Help"** (`AppLayout title` 242, `<h1>` 246), so the nav label and the page title differ.
- **`components/AIDisclaimer.tsx`:**
  - `short`: "For information only, not legal or professional advice. Check before you act." (25)
  - `full`: "Answers are drawn from your documents and current regulatory sources. They can be wrong; check before you act." (34–35)
  - HR uses `short` (page 394, 478). `/requirements` uses `full` (`app/requirements/page.tsx:31`, `:160`). No other page imports it.
- The draft-policy `.txt` download carries its own disclaimer: "DISCLAIMER: This is a draft policy generated by CompliBoard. Review with qualified HR counsel before implementing." (page 230).

### A1.7 Every error string a person can see

| Where | String | Shown? |
|---|---|---|
| page 142 | the thrown message, or `'Upload failed'` | Yes, red under the picker (538). A storage error shows **Supabase's raw message** (118) |
| page 132 | `'Failed to save'` (the `/api/documents` POST failed; the file is already in storage) | Yes, same place |
| page 170 | `'Unable to process your question. Please try again.'` | Yes, **inside the box headed "Answer from your handbook"** (343), because `coverage` is undefined (A2.6) |
| route 154, 161, 185, 186, 215, 220, 225, 232 | `'No handbooks provided'`, `'Handbook not found'`, `` `None of your handbooks could be read. ${…}` ``, `'Could not load any handbook'`, `'No handbook selected'`, the failure message, `String(error)` | **No.** The page throws `json.error` (165, 196) and shows only the fixed sentence above, or nothing for an audit |
| route 74 | `"<name>" could not be downloaded (<storage error>). This is usually temporary — try again.` | Yes, in ask mode only, when **some** handbooks loaded (315–328), under "A handbook could not be read" + "The answer below does not take it into account." (327) |
| `lib/documentContent.ts:92–93` (via route 93) | `"<name>" is a .<ext> format, which cannot be read here. PDFs, images, Excel, CSV, text, Word and PowerPoint files can be. Re-upload it as a PDF to include it.` | Same as the row above |
| `audits-route` 34, 45, 66, 88, 101, 110, 119 | `'Missing documentId'`, `'Handbook not found'`, `'Failed to save audit'`, `'Failed to load audits'`, `'Missing id'`, `'Audit not found'`, `'Failed to delete audit'` | **No.** Save failures go to `console.error` (215); load failures too (74). Delete results are not read (508, 576) |
| `lib/auth.ts:80`, `:109` | `'Unauthorized'`, `'Company not found'` | No (swallowed as above) |

**Two silent states.**
- If `getUser()` returns no user (81), `loading` stays `true` for ever: "Loading..." (252).
- If `GET /api/documents` throws (97–98 has no try/catch), `setLoading(false)` (103) is never reached, with the same result.

### A1.8 The flows

**a. Upload**
1. Pick a file. The picker accepts `.pdf,image/*` (519).
2. Press "Upload handbook →" (539).
3. Storage upload (115).
4. `POST /api/documents`, row `uploaded` (119–131).
5. Re-list every document and filter by path (133–136).
- Nothing is read now.
- The 5-minute sweep reads it later and charges for it (A2.8).
- The HR page never shows that a scan exists.

**b. Ask**
1. "Get answer from handbook →" (299).
2. `POST /api/hr`, ask mode. The route downloads and parses **every** handbook on every question (168–177).
3. One model call (195).
4. One JSON shape is rendered:
   - failures (315–329);
   - the answer or "Not covered by your handbooks" (331–360);
   - a conflict (362–367);
   - gaps (369–380);
   - a draft policy with a `.txt` download (382–392).
- Nothing is saved. There is no ledger row (A2.3).

**c. Audit**
1. Pick a handbook if there is more than one (410–421).
2. "Run handbook audit →" (423).
3. `POST /api/hr`, audit mode (187).
4. One call (228).
5. Render Missing / Present / Draft policies (437–480).
6. The browser then POSTs the result to `/api/hr-audits` (201–212) and reloads the saved list.
- If the audit fails: `console.error` only (218–219, A2.6).

**d. Saved**
1. The list of 10 (563–583).
2. Clicking a row loads its arrays into `auditResults` with `resultTab='saved'` (565–567).
3. The arrays are rendered (586–628).

**e. Delete**
- Handbook:
  - `confirm('Delete this handbook?')` (507);
  - `DELETE /api/documents?id=`, which removes the storage file, the row and orphan labels (`app/api/documents/route.ts:249–305`);
  - the item is removed from the list without checking the response (509).
- Saved audit:
  - `confirm('Delete this saved audit?')` (575);
  - `DELETE /api/hr-audits?id=`;
  - the item is removed unchecked (577).
- Deleting a handbook does **not** delete its saved audits (no FK, A1.4).

### A1 — Workspace piece that could replace each part

| Part | Workspace piece |
|---|---|
| Page shell, tabs, buttons | `app/compliance/page.tsx`, `app/audits/page.tsx`, `DESIGN.md` |
| Ask, with answers that persist | `lib/conversation.ts`, `topic_list_v` (migrations 063, 065) |
| Reading a handbook | `lib/documentScan.ts`, `components/DocumentReport.tsx` |
| Audit + `hr_audits` | **none in §5 fits directly.** The Audits rows (`audit_runs`/`audit_sections`/`audit_findings`) are not in §5's table. `HANDOFF-AUDITS.md:389–398` says that is the shape (B4) |
| Saved list, delete with confirmation, print | `components/Drawer.tsx`, `lib/printFrame.ts` |
| Draft policy download | none (§5 has no drafting piece; Documents has `app/api/document-draft/route.ts`, not in §5) |
| `AIDisclaimer` | none (the workspace prints "Not legal advice" through its print frame; §6 line 151) |
| Long calls in the request | `lib/topicClaim.ts`, the claim + `after()` pattern |

---

## A2. The brief's statements, confirmed or corrected

| # | Statement | Verdict |
|---|---|---|
| 1 | A "handbook" is any document whose storage path contains `hr-handbooks` (~:100) | **Confirmed.** page 100 and 136: `d.file_url && d.file_url.includes('hr-handbooks')` |
| 2 | The `category` the page sends is ignored by POST `/api/documents` | **Confirmed.** It is sent at page 127. The route destructures `name, file_type, file_size, folder_id, is_recurring, recurrence_period, from_topic_id, version_of, version_confirmed, batch_id` (`app/api/documents/route.ts:30–31`), not `category`. The `documents` Row type has no `category` column (`lib/database.types.ts`, documents Row from 2113) |
| 3 | Both calls go through `askAIJson` with no task and no ledger (~:195, ~:228) | **Confirmed**: route 195–199 `{ maxTokens: 2000 }`, route 228 `{ maxTokens: 3000 }`. See the model note below |
| 4 | The route declares no `maxDuration` | **Confirmed.** `grep maxDuration app/api/hr/route.ts` returns nothing. **Correction worth knowing:** `audits-route:16–17` declares `maxDuration = 800` with the comment "A handbook audit reads real content and can occasionally run long", but that route only saves a row. The route that makes the long call has none |
| 5 | The picker accepts only `.pdf,image/*` (~:519) | **Confirmed**, page 519. The hint says "PDF files supported" (527). **The route itself reads Word, Excel, CSV, text and PowerPoint** (route 42–55, `lib/documentContent.ts:142–150`). A .docx uploaded elsewhere with `hr-handbooks` in its path would be read; the HR page just cannot pick one |
| 6 | A failed ask shows under "Answer from your handbook" (~:169); a failed audit is shown nowhere (~:219) | **Confirmed.** Ask: 169–174 sets `{answer:'Unable to process…'}` with no `coverage`, so 331 takes the `else` branch and 343 prints "Answer from your handbook". Audit: 218–219 is `console.error(err)` only, and `auditResults` stays `null` (185) |
| 7 | Browser `confirm()` is used (~:507, ~:575) | **Confirmed**, 507 and 575 |
| 8 | A handbook uploaded on /hr is `uploaded`, so the 5-minute sweep reads it and charges for it | **Confirmed.** See below |

**Item 3: which model.**
- No `task` means `modelForTask(undefined)`, i.e. `'default'` (`lib/ai.ts:431`, `:143`). That resolves to `default: () => process.env.AI_MODEL || 'claude-sonnet-4-5'` (`lib/ai.ts:139`).
- **Locally:** `.env.local` has no bare `AI_MODEL` line (`grep -n "^AI_MODEL=" .env.local` printed nothing). Its `AI_MODEL_*` lines are PROSE, JUDGEMENT and SUBSTEPS = `claude-haiku-4-5` and SUMMARY = `claude-opus-5-5` (lines 49–52). **So HR runs on `claude-sonnet-4-5` locally**, the one path that does not follow the build-on-Haiku rule (`CLAUDE.md` §3.4a).
- **Production:** `docs/RELEASE.md:96` says "`AI_MODEL` (the fallback for all of them) | `claude-opus-5-5`". So HR runs on **Opus 5.5** on production, per RELEASE.md. The dashboard was not read.
- **Effort:** `askAI` sends no `effort` at all (`lib/ai.ts:453`: "`effort` is not sent from this path at all"), so `AI_EFFORT` does not apply.
- **No ledger:** `recordAICall` runs only `if (options.ledger)` (`lib/ai.ts:498`). So HR spend is in no `npm run cost` figure.

**Item 8: the sweep's queue query** (`app/api/jobs/scan-documents/route.ts`):
```ts
165  const { data: next } = await supabaseAdmin.from('documents')
166    .select('company_id').eq('status', 'uploaded').is('reading_since', null)
167    .order('uploaded_at', { ascending: true }).limit(1).maybeSingle()
…
182  const { data: claimed } = await supabaseAdmin.from('documents')
183    .update({ reading_since: new Date().toISOString() })
184    .eq('company_id', companyId).eq('status', 'uploaded').is('reading_since', null)
```
- Each claimed document is read by `runDocumentScan` (229) and saved by `saveScan` (236).
- The cron runs every 5 minutes (`vercel.json:5`).
- Its tier is `document_scan`, so it is in the ledger. The model is `AI_MODEL_DOCUMENT_SCAN`, `claude-opus-5-5` on production (`docs/RELEASE.md:91`).
- **So every handbook is paid for twice over:**
  - once by the sweep, which is ledgered;
  - then on **every** question and audit, as a fresh full read of the whole file, which is not ledgered.

---

## PART B — everything HR will touch

### B1. The Documents scan on a handbook

**(a) What the scan asks of a `policy`.** The kinds are `permit, certificate, program, policy, record, supplier_document, other` (`prompts/document-scan.ts:153–154`, schema enum `:359`; `lib/documentScan.ts:38`, `:160`). There is **no `handbook` kind**. The policy rule (`prompts/document-scan.ts:163–167`):

> A program or policy is checked against the standard or rule that governs it. For each gap: what is missing in plain words, the fix, the citation and a link if you know one, where in the document it should be (section or page, or "not in the document"), and whether a draft of the missing text could be written from what the document already says.

Other lines that apply to a handbook:
- Jurisdiction: "a handbook mixes federal and state rules. Read it against where this company is." (`:123–125`)
- Facts: "42 employees at the Portland site" (`:175–178`)
- Quotes are word for word (`:193–194`)
- "Compliant" is not used (`:199`)
- For a policy, the date that matters is chosen in code: "revised" or "effective" (`lib/documentScan.ts:258–262`).

**(b) Tables one reading writes** (all through `saveScan`, `lib/documentScan.ts`):

| Table | Write | Line |
|---|---|---|
| `documents.status` (`reading`, then `read` / `could_not_read`) | update | scan route `:84`, sweep `:208`; `:970–972` |
| `documents.reading_since` | update | sweep `:153–155`, `:182–185`, `:203`, `:263` |
| `document_scans` (earlier rows `is_current=false`; new row) | update, insert | `:737`; `:739–772` |
| `document_gaps` (new; successor carry-over; superseded; `not_seen_at`) | insert, update | `:814–820`, `:854–862`, `:875` |
| `checklists.document_gap_id` (moved to the successor gap) | update | `:851` |
| `document_conditions`, `document_deadlines` | insert | `:880–883`, `:887–890` |
| `fact_proposals` (earlier pending `withdrawn`; new with `source:'document'`, `quote_verified`) | update, insert | `:925–927`, `:933–956` |
| `company_labels` (agency / subject) | upsert | `:965–967` |
| `ai_calls` | insert, by `lib/ai.ts:505` | — |
| `job_runs`, `document_batches` | sweep only | sweep `:134`, `:294`; `:321–378` |

**(c) `extracted_text`.**
- Written at `lib/documentScan.ts:762` (`extracted_text: scan.extracted_text || null`), taken from `parsed.text` (`:617`).
- **PDF:** the model gets the base64 PDF (`lib/documentContent.ts:157`). `extracted_text` is a separate officeparser extraction (`:123`, `:162`). It returns `''`, so null, for a scanned PDF or on any failure (`:126–129`).
- **Word:** mammoth **HTML** is both the model's input and `extracted_text` (`:189–190`). It is HTML, not plain text.
- **Image:** `text: ''` (`:168–170`), so null.
- Legacy `.doc` and `.ppt`: **HYPOTHESIS**. These may throw in the parser (mammoth reads .docx; the `:193–196` comment says .ppt is "left to fail"). A throw at `:593` lies outside `runDocumentScan`'s try (`:637`). Settled by calling `parseDocumentToBlocks` on a real `.doc`.

**(d) `verifyQuote`** (`lib/documentScan.ts:189–202`):
```ts
198  const norm = (s: string) => s.replace(/<[^>]*>/g, ' ').toLowerCase().replace(/[^a-z0-9]+/g, '')
199  const q = norm(quote)
200  if (q.length < 8) return null
201  return norm(extractedText).includes(q)
```
- A null quote or empty text returns `null`, meaning not checked (190–191).
- A failed quote is **kept and flagged** `false`, never dropped (comment 182–187).

**(e) Every quote matcher, side by side.**

| Matcher | Where | Compares | Tags | Case | Whitespace | Punctuation, quotes, dashes | `[n]` and markdown | Trailing "." | Min length | On no match |
|---|---|---|---|---|---|---|---|---|---|---|
| `verifyQuote` | `lib/documentScan.ts:189–202` | scan's gap/fact quote vs `extracted_text` | stripped | ignored | **deleted** | **all non-`[a-z0-9]` deleted** (accents, `§`, `%` too) | deleted as punctuation | deleted | 8 kept chars, else `null` | `false`, kept |
| `normaliseForMatch` | `lib/summaryReport.ts:159–162` | helper | kept | lowercased | collapsed, trimmed | **kept exactly** | `[n]` becomes a space; `**`, `__` and lone `*`/`_` removed | kept | — | — |
| `quoteKey` | `lib/summaryReport.ts:165–167` | `normaliseForMatch` minus one trailing `.` | kept | ignored | collapsed | exact | as above | one forgiven | — | — |
| `checkCitations` | `lib/summaryReport.ts:187–202`; also `lib/checklistConvert.ts:72` | item `basis` vs each **paragraph** (split on blank lines, `:171`) of **assistant** turns; keeps only sources whose `[n]` is in that paragraph | kept | ignored | collapsed | exact | stripped | one forgiven | `needle.length >= 8` (`:191`) | sources dropped |
| Summary facts (B3) | `lib/summaryReport.ts:285`, `:292–295` | fact quote vs each **user** turn | kept | ignored | collapsed | exact | stripped | one forgiven | non-empty | fact dropped: "its quote is not in any of your messages" |
| Proposal → turn link | `lib/summaryReport.ts:385–386` | same, to set `from_turn_id` | kept | ignored | collapsed | exact | stripped | one forgiven | — | `from_turn_id` null |
| `quoteIsInDocument` | `lib/basis.ts:121–125` | quote vs document text | kept | **case-sensitive** | collapsed, trimmed | exact | kept | kept | non-empty | `false` |

- **`quoteIsInDocument` has no caller outside its own file and its test.** A grep of `app` and `lib` for the name, excluding `lib/basis.ts`, returned nothing.
- Not quote matchers, and checked:
  - `lib/auditRun.ts:804` matches audit line references;
  - audit `quote` is stored unverified (`:701`, `:878`).
- **The scan and the conversation matchers disagree.** A quote that differs only in punctuation, curly versus straight quotes, or a dash passes `verifyQuote` and fails `checkCitations`.
- **Word HTML matters here.** `verifyQuote` strips tags, but the summary matchers do not. A handbook basis checked against Word `extracted_text` with `quoteKey` would fail on any tag inside the quoted span.

**Workspace piece that could replace it:** `lib/documentScan.ts`, `components/DocumentReport.tsx` for the reading. For HR's citations, `prompts/summary-report.ts`, `lib/summaryReport.ts` (`quoteKey`/`checkCitations`). Which matcher HR uses is a design choice; the table above is the input to it.

### B2. Big files (code only; nothing was uploaded)

**No code checks file size or page count anywhere.**
- A grep for `MAX_*`, byte limits, `.size >`, `file_size_limit` and `pages` in the upload and scan paths found none.
- The bucket insert (`037_documents_bucket.sql:41–42`) sets no `file_size_limit`.
- `next.config.ts` is empty, and uploads go from the browser straight to storage.
- The constants that do exist are counts or tokens, not sizes:
  - `LIVE_SCAN_MAX = 3` (`lib/documentBatch.ts:35`);
  - `MAX_CARRIED_DOCUMENTS = 3` (`lib/attachedDocument.ts:191`);
  - `SDK_NONSTREAMING_MAX_TOKENS` (`lib/ai.ts:420`).

**Scan path.**
1. The PDF is base64'd whole (`lib/documentContent.ts:157`).
2. The non-streaming call `anthropic.messages.create` (`lib/ai.ts:444`) throws an `APIError`.
3. `lib/documentScan.ts:648–654` catches it and calls `refusedScan`. The stored reason (`:565–567`):

> The reading service refused our request to read this document, so nothing was read. That is our end of it, not a problem with the file you sent.
> way forward: Read it again once we have fixed it — nothing about your file needs changing.

- The API's own text is kept only in `document_scans.raw_text` (`:570`).
- **On the Documents page the row shows that reason, followed by a button "Upload a clearer copy"** (`app/documents/page.tsx:614–616`). The button contradicts "nothing about your file needs changing".
- A thrown error with no HTTP status gives one of two messages:
  - `app/api/document-scan/route.ts:142`: "Something went wrong at our end while reading this file, and we do not yet know what."
  - the sweep, `:249`: "Something went wrong at our end while reading this one."
- **`app/api/document-scan/route.ts` exports no `maxDuration`** (grep). The sweep's comment says the scan route uses 800.
- **HYPOTHESIS:** a long live-path read could hit the platform's default timeout. The live path never sets `reading_since`, and stuck recovery is `.lt('reading_since', …)` (sweep `:147–148`), so such a row could stay `reading`. Settled by the deployment's function limit and a timed live scan.

**Chat attachment path.** A large file reaches chat when it is opened with `?document=`, or when it is carried on later turns (`chat:220–221`).
- In research mode the stream yields `{type:'error', message}` (`lib/ai.ts:939`).
- `chat:510` forwards it unchanged.
- The page shows `{error} You can ask again, or rephrase the question.` (`ws:1319`).
- **So the person sees the SDK's raw error text.**
- Checklist mode: `chat:381–382` returns it as a 502. The page shows the same thing.

**HR path.**
- `route` sends every handbook's full PDF in **one** request (168–177). There is no size check and no try around a refusal.
- The thrown error reaches `route:232`, `String(error)`.
- The page shows "Unable to process your question. Please try again." under "Answer from your handbook" (A2.6).

**Which limit trips.** **HYPOTHESIS**, from Anthropic's published limits, not from this repository: 32 MB per request and 100 pages per PDF. Base64 adds about a third, so a PDF of roughly 24 MB may already exceed 32 MB. Settled by the `claude-api` reference, or a live test.

**What a live test needs:**
- Fixtures:
  - a 101+ page text PDF under 24 MB;
  - a 25–33 MB text PDF under 100 pages.
- The Supabase project's global upload limit, read from the dashboard first.
- Each fixture run through:
  - Documents with 1–3 files (live) and with 4+ (sweep);
  - the workspace attach;
  - `?document=` in research mode and in checklist mode;
  - `/hr` ask and audit;
  - a conversation carrying three large PDFs.
- What to record:
  - `document_scans.raw_text`, `could_not_read_reason`, `documents.status`;
  - the NDJSON error text;
  - function durations.

**Workspace piece that could replace it:** none. No reused piece has a size or page check. `lib/documentScan.ts` is where one would sit.

### B3. Chat with an attached document

`loadAttachedDocument` returns `null` in four cases (`lib/attachedDocument.ts`):
- the row is missing or the query fails (`:93–95`);
- the download fails (`:99–101`);
- the format is unsupported (`:106–108`);
- anything throws (`:111–113`).

**The answer goes ahead without the file.** `chat:204–210` only logs the null. The warning to the model (`chat:270–275`):
```ts
270  if (documentId && !attached) {
271    messageContent = typeof messageContent === 'string'
272      ? `The user attached a file to this conversation, but it could not be read back just ` +
273        `now. Say so rather than answering as though nothing was attached.\n\n${messageContent}`
274      : messageContent;
```
- **When earlier attachments loaded, `messageContent` is an array and the warning is not added.** The model answers from the other files with no hint that this one failed.
- The turn saves `documentId: attached?.id ?? null` (`chat:472`), so the failed attachment is not recorded on the turn.
- Nothing about the failure reaches the page.

**Past three carried documents.**
- `loadTopicAttachments` keeps the newest 3 (`:199–200`), excluding the current turn's file (`:197`). So up to 1 + 3 files are sent.
- Carried files that fail to load are dropped silently (`:204`). `omitted` counts only the cap (`:206`).
- The model alone is told about the cap (`chat:228–230`): "…only the ${3} most recent are carried. Say so if the question depends on them." The `${3}` is a literal, not the constant.
- **The person is told nothing on screen.** A grep of `ws` for `omitted`, "most recent" and "could not be read" finds no such string.
- Carried attachments load only in research mode (`chat:220`).

**Workspace piece that could replace it:** this *is* the workspace piece (`lib/attachedDocument.ts`). HR would inherit both gaps if it carried handbooks this way.

### B4. The Audits machinery

**Tables.** Created in `058_the_audit_as_rows.sql`. Template columns `059`, date CHECK `060`, `also_in_sections` `061`. 062–065 do not touch them.

- **`audit_runs.kind`** is an inline CHECK, `058:63`: `kind text not null check (kind in ('agency', 'template'))`. Its live name on staging is **`audit_runs_kind_check`**, read from the catalog:
  ```
  select conname, pg_get_constraintdef(oid) as def from pg_constraint
   where conrelid='public.audit_runs'::regclass and contype='c' order by 1
  → audit_runs_done_count_check     CHECK ((done_count >= 0))
    audit_runs_kind_check           CHECK ((kind = ANY (ARRAY['agency'::text, 'template'::text])))
    audit_runs_kind_has_its_subject CHECK ((((kind = 'agency'::text) AND (agency_label IS NOT NULL) AND (template_document_id IS NULL)) OR ((kind = 'template'::text) AND (template_document_id IS NOT NULL) AND (agency_label IS NULL))))
    audit_runs_section_count_check  CHECK ((section_count >= 0))
    audit_runs_status_check         CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text])))
  ```
- `audit_sections`: `status ∈ queued, running, done, could_not_complete` (`058:123`). The claim column is `claimed_at` (`:124–126`).
- `audit_findings`:
  - `word ∈ on_file, stale, nothing_on_file, not_a_document_question` (`058:177`);
  - `kind ∈ finding, date, contradiction, expected` (`:175`);
  - `status ∈ open, closed, dismissed` (`:192`).
- Grants (`058:270–281`):
  - REVOKE all from `anon` and from `authenticated`;
  - then `audit_runs` SELECT, UPDATE; `audit_sections` SELECT; `audit_findings` SELECT, UPDATE.
- RLS: 12 policies on `auth_company_id()` (`058:289–311`).

**The sweep** (`app/api/jobs/audit-sections/route.ts`; `vercel.json:6`, `*/5 * * * *`):
- Auth is `requireCronSecret` (47–55). Every refusal is a 404 (`lib/jobAuth.ts`).
- `maxDuration = 800` (28). `BUDGET_MS = 640_000` (38) and `RESERVE_MS = 130_000` (39), so it stops **starting** sections at about 510 s.
- Stuck recovery runs first, at 15 minutes (`STUCK_AFTER_MS`, 41; 74–85).
- The oldest run with a queued, unclaimed section picks the company (94–103; `.limit(50)` at 96).
- It claims **that company's whole queue** in one compare-and-set on `claimed_at` (114–117). Status does not move.
- Sections run **one at a time**, in run `created_at` then `ordinal` order (125–129, 133–155). Then it moves to the next company until the budget runs out.
- There is no automatic retry. Retry is manual, through `app/api/audit-runs/[id]/sections/[sid]/retry/route.ts` (33, 43–46, 55–60).
- Finishing: `finishRunIfDone` (`lib/auditRun.ts:989`, guard `.neq('status','done')` at `:1031`), then `notifyRun`.
- It writes `job_runs` `audit_sections` only when there was work (64, 196; `lib/jobRun.ts:30–33`).
- **How much fits in one run:** one section is one call with `maxTokens: 16000, enableWebSearch: true, task:'audit'` (`lib/auditRun.ts:444–445`). About 510 s of starts per run.
  - **HYPOTHESIS** on the count: it depends on per-section time, which the ledger's `wall_ms` for `audit` rows would settle. Staging shows 6 audit calls taking 12 s in total, on Haiku (`npm run cost`, before).

**The email** (`lib/auditNotify.ts`):
- Resend, from `CompliBoard <onboarding@resend.dev>` (186), to the run's `created_by` (76–86).
- Sent once: it checks `notified_at` (66) and stamps it only after a successful send, with `.is('notified_at', null)` (192–193).
- The subject uses `summary.agencies` (96–103), and the body names agencies (`runSummaryLine`).
- It selects `kind` (63) but never uses it.

**The words** (`lib/auditRun.ts`), all agency-shaped:
- "We could not finish this agency: …" (562);
- "Nothing was recorded for this agency" (468–469);
- `runSummaryLine` "… audit" / "compliance audit across N agencies" (1262–1263).

**What a section reads.**
- `buildAuditInput(db, company, isTemplate ? '*' : sec.title)` (`lib/auditRun.ts:386`), which gives the company context plus `document_index_v` rows filtered by agency label, with gaps, conditions, deadlines and facts (`lib/audit.ts:122–278`, filter `:147–155`).
- **It never gets a document's full text.** That matters for "one section per handbook section".

**What would have to change for `kind = 'handbook'`** (facts only):
1. `audit_runs_kind_check` (`058:63`).
2. `audit_runs_kind_has_its_subject` (`058:83–86`). A third kind fails both branches as written.
3. The TS union `kind?: 'agency' | 'template'` (`lib/auditRun.ts:97`). `lib/database.types.ts:320` is `string`.
4. `app/api/audit-runs/route.ts:29`, `42`, `102–104`. It refuses anything else with "We do not know how to run a "${kind}" audit."
5. `createRun`: `lib/auditRun.ts:139`, and `263` throws "only agency and template are built".
6. `runSection`:
   - `isTemplate` (384);
   - input scope (386): **any non-template kind is treated as an agency label**;
   - template lines (398–400);
   - prompt choice (417–422);
   - shaper choice (472–478);
   - previous-run match by section title (900–919);
   - in-run collapse (415).
7. `lib/audit.ts:147–155`, `:295–300`: agency/checklist filtering and headings; no full text.
8. `prompts/audit-agency.ts`: ROLE "inspection by ONE agency" (34); only the agency (214) and template (292) prompts exist.
9. The sweep does **not** branch on kind. No change there.
10. Page and components:
    - `app/audits/page.tsx`: 302, 356, 484–486, 751–753, 182–187;
    - `components/AuditReport.tsx`: 384–411, 477–479, 549, 724;
    - `app/api/audits/index/route.ts:83–94`;
    - `app/api/audit-checklist/route.ts:53`;
    - `app/api/audit-runs/[id]/documents/route.ts:146`, `:192`.
11. Notify and summary words (`lib/auditRun.ts:1238`, `:1263`; `lib/auditNotify.ts:99`, `:102`).
12. `scripts/check-live.js:135`, `955`, `1126`; `scripts/run-golden-audit.js:557`, `593`, `684`, `992`, `1002`.
13. No unit test enumerates audit kinds. `job_runs` needs no change.

`docs/HANDOFF-AUDITS.md:104–108` calls `hr_audits` the retired engine's table, "kept and unread by this section". It is retired from Audits but **live** in HR (A1.4).

**Workspace piece that could replace it:** none in §5. The Audits tables are the shape `HANDOFF-AUDITS.md:389–398` names for HR. For the claim and `after()` pattern, `lib/topicClaim.ts`.

### B5. Conversations

**Schema.**
- `topics`: `028_topics.sql:51–78`. Status enum `open|closed` (`:45`).
  - Grants: `authenticated` SELECT, INSERT, UPDATE, no DELETE (`:119–122`).
  - Three policies (`:133–145`).
- Topic clock columns are added in `031_turns_and_topic_lifecycle.sql:78–83`.
- `turns`: `031:34–54`. `authenticated` SELECT, INSERT only (`:119–122`).
- Attachment columns on `turns`: `039:40–44`.
- `summary_report`: `063:27`. Claim columns: `065:35–36`.
- **`topic_list_v`** (`065_one_summary_one_checklist_at_a_time.sql:43–86`):
  - `with (security_invoker = true)` (`:43`).
  - Columns (`:45–56`): `id, company_id, title, summary, summarised_at, summary_source, delete_after, last_turn_at, created_at, has_report, turn_count, question_count, document_count, first_document_name, checklist_id, checklist_total, checklist_done, summary_in_progress, checklist_in_progress`. `status` is not exposed.
  - Joins: three lateral joins over `turns` and `checklists`/`checklist_items` (`:58–80`).
  - Grants: SELECT to `authenticated` and `service_role` only (`:83–86`).
- `lib/conversation.ts` exports:
  - `touchTopic` (53), `nextPosition` (69), `saveUserTurn` (78), `saveAssistantTurn` (97);
  - `markTurnStopped` (128, admin);
  - `titleFromQuestion` (140), `setTitleIfFirst` (146), `loadTurns` (155);
  - `bumpCounter` (179, admin).
- **HR has no conversations today.** `app/hr` and `app/api/hr` reference neither `topics` nor `turns`.

**Every reader and writer of `topics` / `topic_list_v`** ("caller" means under RLS; "admin" means the service role):

| Where | R/W | What | Client | Would a "section" column matter? |
|---|---|---|---|---|
| `ws:432–437` | R | `topic_list_v`, newest 60, **no filter** (verified) | caller | **Yes: the list needs a section filter** |
| `ws:749`, `:815` | R | `topic_list_v` by id (poll) | caller | No (by id) |
| `ws:496`; `ws:476–478` | R | `topics.summary_report`; `fact_proposals` count by topic | caller | No |
| `ws:448` | R | `checklist_list_v`, no filter | caller | **Yes: HR checklists would mix in** |
| `ws:1116`, `:1208`, `:1488–1490`, `:1511` | derived | last asked, tab count, "N conversations · N checklists", search threshold | — | **Yes**, through the lists above |
| `chat:461–464` (verified) | W | insert `topics {company_id, title}` (research) | caller | **Insert site: must set the section** |
| `chat:642–645` | W | insert `topics` (gate path) | caller | **Second insert site** |
| `chat:468–472`, `:502` (`conversation.ts`) | W | `turns`; `touchTopic` clocks | caller | No |
| `chat:477–478`; `chat:481` | W | `documents.from_topic_id`; `topics.title` | caller | No |
| `chat:578–580` | R | `topics id, status` by id (gate) | caller | A section check could sit here; none exists |
| `chat:439`, `:507`; `from-topic:272` | W | `usage_counters` via `bumpCounter` | admin | **Yes: per-company counters, no section field** (`032:27–33`) |
| `chat:527` | W | `turns.stopped` | admin | No |
| `app/api/topics/[id]/route.ts:33–43`, `:92–101` | R / delete | GET topic and turns; DELETE topic (admin at `:101`) | caller / admin | By id, company-scoped only |
| `app/api/topics/[id]/summarise/route.ts:71–106` | R/W | claim, `summariseTopic`, release | caller (+admin for proposals) | By id |
| `lib/topicClaim.ts:90–94`, `:107–108` | W | `summary_started_at` / `checklist_started_at` | passed in | No |
| `lib/summaryReport.ts:428–438`, `:449–459` | W | topic summary columns; `fact_proposals` insert | passed in / admin | The prompt is one for every section (B7) |
| `app/api/checklists/from-topic/route.ts:95–100`, `:258–262` | R/W | topic and turns; `checklists.from_topic_id` | caller | By id |
| `app/api/documents/route.ts:60–62`, `:108` | R/W | topic ownership; `from_topic_id` | caller | No |
| `app/api/to-confirm/route.ts:74–87` | R | `fact_proposals` and `topics.title` | caller | Facts from both sections would share one queue (possibly intended) |
| `app/api/jobs/summarise/route.ts:77–134` | R/W | every company's candidates; summarise | admin | **Section-blind**: one prompt for all |
| `app/api/jobs/delete/route.ts:53–56`, `:71` | R / delete | turns past retention | admin | No |
| `app/api/account/route.ts:189–215`, `:382–391` | delete | `topics`, `turns`, `fact_proposals`, `usage_counters` | admin | No |
| `app/api/account/export/route.ts:79–89` | — | **does not export `topics`, `turns`, `fact_proposals` or `usage_counters`** (verified) | caller | Gap, not section-specific |
| `app/dashboard/page.tsx`, `app/page.tsx` | — | no reference to topics or `usage_counters` | — | No |
| `scripts/check-live.js:109–111`, `:821–825` | W | inserts topics `{company_id, title}` as the user | user | A NOT NULL column with no default would break it |
| `scripts/check-live.js:361–363`, `:374–443`, `:812` | R/W | counters, turns, `idle_at`, `topic_list_v` | user | No |
| Migration probes 028/046/047/050/051/062/063/065 | W | insert `(company_id, title)` | — | Same as check-live |

**Workspace piece that could replace it:** this is the piece: `lib/conversation.ts`, `topic_list_v` (migrations 063, 065).

### B6. Nightly timing

| Place | Text / rule |
|---|---|
| `vercel.json:3–4` | `"0 3 * * *"` summarise, `"30 3 * * *"` delete |
| `lib/topicClaim.ts:128` (verified) | `export const IDLE_HOURS = 24`; `nightlyCandidates` `:143–159` (`:145`, `:156`) |
| `app/api/jobs/summarise/route.ts:4`, `:14`, `:21–22`, `:85–86`, `:122` | "quiet for 24 hours"; "RUNS AT 03:00 UTC"; `idle_at` set |
| `app/api/jobs/delete/route.ts:2`, `:11`, `:56` | "THE NIGHTLY DELETER"; cutoff `clearingCutoff` |
| `lib/retention.ts:27`, `:48–71` | `RETENTION_MONTHS = 12` (no hour constant) |
| `lib/conversationStatus.ts:12–14` | "…the next 03:30 run…" |
| `lib/conversation.ts:56` | every turn resets `idle_at` |
| `031:89` | `summary_source in ('user','nightly')` |
| `tests/unit/topicClaim.test.ts:133–156` | `assert.equal(IDLE_HOURS, 24)`; 25 h / 2 h / 30 h rows; source assertions |
| `tests/unit/conversationStatus.test.ts:38`, `:57` | "the 03:30 deleter has not run"; "overnight" |
| `scripts/check-live.js:386–392`, `:803` | sets `idle_at`; "tonight's job" |
| **On screen** `ws:1690–1691` (verified) | "This one hasn't been summarised yet. The summary is written overnight, and the full conversation is here until then." |
| On screen `ws:235`; `ws:1508–1509`; `ws:1696–1697` and `app/api/topics/[id]/route.ts:53`; `lib/conversationStatus.ts:52–67` | "Not summarised yet"; the 12-month lines; status labels. **No screen text says "24 hours", "03:00" or "tonight".** |
| Docs | `HANDOFF-WORKSPACE-TO-HR.md:111–113`, `:251–252`; `HANDOFF-WORKSPACE.md:21–24`, `:374`; `HANDOFF-CODE.md:242`; `INVENTORY-2026-09.md:137`; `TESTING.md:168`; `WORKSPACE-MACHINERY.md:245–246` (stale 7/30-day rule); `DECISIONS.md:9455`, `:10973`, `:11007`; `STATUS.md:256`; `SCHEMA.md:1680` (stale "7 days") |

Stale text found along the way, all recorded and none fixed:
- `032_usage_counters.sql:36–37` says "cleared after 7 days".
- `app/api/topics/[id]/route.ts:75` says fact_proposals cascade; it is SET NULL since `062:82–85`.
- `scripts/cost-report.js:6` documents `--topic`, but only `--since` is parsed (`:28–32`).

**Workspace piece that could replace it:** this is the piece: `lib/topicClaim.ts`, `lib/retention.ts`, `app/api/jobs/summarise/route.ts`.

### B7. The summary writer

**Inputs and output.**
- Input: `summariseTopic(db, admin, {topicId, companyId, title, turns, source, today?, extra?, guard})` (`lib/summaryReport.ts:402–414`).
- Turns are `TurnLike {role, text, stopped, sources[{n,title,url}], document_name}` (`:27–35`).
- The prompt `summaryReportPrompt(today)` takes only the date (`prompts/summary-report.ts:29`).
- Output: `SummaryReport` (`:49–61`): `title, as_of, situation, applies[{authority, items}], to_confirm, unanswered, facts[{key,value,quote}], sources[{n,title,url}]`. Each item has `basis` (`:39–47`).
- **There is no Zod.** The hand validator is `checkReport` (`:236–324`).
- Callers:
  - `app/api/jobs/summarise/route.ts:120–124` (nightly, admin);
  - `app/api/topics/[id]/summarise/route.ts:96–99` (user, in `after()`).

**Workspace-specific, as written:**
- `ReportSource` requires a `url` (`:37`), and `gatherSources` skips a source with no URL (`:82`). A handbook passage has no URL.
- `applies` is grouped by `authority` (`:53`), and `checkReport` refuses a group without one (`:259`).
- The prompt speaks of a "compliance conversation". Its examples are TTB, CBP, FDA and OLCC (`prompts/summary-report.ts:30`, `:42`), and rule 9 says "The sources carry the links" (`:75`).
- `checkCitations` searches **assistant** turns only, and keeps a source only if its `[n]` marker is in the same paragraph (`:187–202`).
- `proposalsToInsert` hard-codes `source:'conversation'` and `topic_id` (`:387–390`).
- `summariseTopic` writes `topics` (`:428–438`).

**Generic, and could take a basis quoted from a handbook:**
- `normaliseForMatch` (`:159`) and `quoteKey` (`:165`) are pure string functions.
- The fact check's pattern, `quoteKey(q)` against `normaliseForMatch(text).includes(...)` (`:285`, `:292–293`), is the same shape a "basis is in the handbook" check would take.
- **HYPOTHESIS:** passing a handbook as a synthetic assistant turn to `checkCitations` would return `found:true, kept:[]` when the paragraph has no `[n]` marker. So the function cannot be reused as-is for a document. Settled by a unit test.

**Workspace piece that could replace it:** `prompts/summary-report.ts`, `lib/summaryReport.ts`. The matching helpers carry over. The source model (URL, authority) does not.

### B8. The company context

**`lib/companyContext.ts`.**
- Parts: `company | declared | confirmed | labels | keys | document` (`:63–64`).
- It returns `{parts, block, sha256}` (`:400`).

| Part | Reads | Lines |
|---|---|---|
| company | `companies(name, industry, city, state, scan_result)`; `entities(id, name, address, state, county, city, is_primary)` | `:232–236` |
| declared | `company_switches` with `switches(label, question_plain)` | `:276–278` |
| confirmed | `company_facts(key, value, basis, entity_id, as_of, source_document_id, source_proposal_id)` | `:300–302` |
| labels | `company_labels(kind, label)` | `:340–341` |
| keys | `fact_proposals.switch_key` in proposed/accepted, plus the confirmed keys | `:357–359` |
| document | `document_corrections`, dismissed `document_gaps` | `:369–386` |

| Caller | Parts |
|---|---|
| `chat:724–725` | company, declared |
| `app/api/company-information/route.ts:51–52` | company, declared, confirmed, labels |
| **`route:146–147`** | **company, and only `.name` is used** |
| `app/api/document-draft/route.ts:74–78` | company |
| `lib/determinationGate.ts:434–435` | company, declared |
| `lib/audit.ts:131–132` | company, confirmed, labels, keys |
| `lib/documentScan.ts:436` (`SCAN_CONTEXT_PARTS`, `:387`) | all but declared |

**Sites.**
- `entities`: `007_requirements_spine_rebuild.sql:337–347`.
- One primary site per company: `007:616`.
- `state, county, city, address, postal_code, fire_authority`: `009_site_jurisdiction_and_wiring.sql:56–65`.
- `companies` also has `state, county, city, employee_count` (`000:147–150`).

**Headcount, in three places:**
1. `companies.employee_count`, integer (`006:347–359`), written at signup (`app/api/signup/route.ts:49`) and by account (`app/api/account/route.ts:109`).
2. Switches (`supabase/seed-data/switches.json`):
   - `employee_count`, company scope, thresholds 6–100 (`:94–116`);
   - `site_employee_count`, site scope, thresholds 6 and 10 (`:118–135`), split because of Oregon sick time.
   - Values live in `company_switches` (`008`). `lib/gateContext.ts:270` maps site to enterprise.
3. `company_facts`, with a per-site key (`050:85–99`; `055:87–89`, `:110–111`).

**Where employees work.**
- **No switch or column exists.** A grep for `remote|telework|work_from_home|employees_in_|oregon_employee|portland_location` over migrations, the switches seed, `lib` and `prompts` found nothing.
- The nearest are:
  - `entity_state` (site, Oregon/Washington, `switches.json:37–53`);
  - `multi_state`, "SEEDED BUT UNUSED" (`:249–263`).
- Portland appears only as a city test inside `applies-expressions.json:1956–1966`.

**Workspace piece that could replace it:** none in §5 (`lib/companyContext.ts` is shared already). The fact queue is `fact_proposals`, `/api/to-confirm`.

### B9. The cost ledger and model tiers

- `LEDGER_TASKS` (`lib/costLedger.ts:26–36`): `research, checklist, substeps, convert, summarise, gate, critique, audit, document_review, document_scan, document_draft, howto, other`.
- **The CHECK.**
  - Created inline in `038_ai_calls_ledger.sql:46–48`.
  - Renamed `ai_calls_task_check` by `040_document_scan.sql:216–218`.
  - Restated by `050:125–129` and, currently, by `064_the_checklist_in_three_groups.sql:71–75`.
  - Live name on staging:
  ```
  select conname from pg_constraint where conrelid='public.ai_calls'::regclass and contype='c' order by 1
  → … ai_calls_output_tokens_check, ai_calls_searches_check, ai_calls_task_check, ai_calls_wall_ms_check
  ```
- **Model tiers.** `AITask` is defined at `lib/ai.ts:27`. `TASK_MODELS` is at `:96–140`:

  | Tier | Line | Setting, then fallbacks |
  |---|---|---|
  | `critique` | `:104` | `AI_MODEL_CRITIQUE` → `AI_MODEL` → opus-5 |
  | `judgement` | `:106` | `AI_MODEL_JUDGEMENT` → `AI_MODEL` → sonnet-4-5 |
  | `prose` | `:108` | `AI_MODEL_PROSE` → `AI_MODEL` → sonnet-4-5 |
  | `substeps` | `:114` | `AI_MODEL_SUBSTEPS` → `AI_MODEL` → sonnet-5 |
  | `summary` | `:115` | `AI_MODEL_SUMMARY` → `AI_MODEL` → sonnet-5 |
  | `document_scan` | `:122` | falls back to judgement |
  | `document_draft` | `:126` | falls back to prose |
  | `audit` | `:133` | falls back to judgement |
  | `howto` | `:138` | falls back to prose |
  | `default` | `:139` | `AI_MODEL` → sonnet-4-5 |

  The tier and the ledger task are separate arguments (for example `lib/summaryReport.ts:424`).
- **Adding an `hr` task and `AI_MODEL_HR` would touch:**
  - a migration restating `ai_calls_task_check`, with the verify probe pattern of `064:149–154`;
  - `lib/costLedger.ts:22–36`;
  - `lib/ai.ts:27` and `:96–140`;
  - `route:195–199` and `:228`;
  - `tests/unit/costLedger.test.ts:111–115`, a hard-coded list;
  - `docs/RELEASE.md:85–96` and `.env.example` (`:168` pattern).
- Not affected:
  - `scripts/cost-report.js`, which reads `LEDGER_TASKS`;
  - `config/pricing.ts`, which is keyed by model;
  - `lib/database.types.ts`, where `task` is a `string`.

**Workspace piece that could replace it:** none needed; this is shared infrastructure.

### B10. The screen pieces in `app/compliance/page.tsx` (2292 lines)

**Page-local, with line ranges:**

| Piece | Lines | Depends on |
|---|---|---|
| Button strings | `PRIMARY` 183–185, `SECONDARY_LARGE` 187–189, `OUTLINE` 191–192, `TEXT_ACTION` 194 | CSS `--green`, `--green-ink` (`app/globals.css:17–18`). The comment at 177–181 says they were copied from Audits "character for character" |
| Page CSS `<style jsx global>` | 1132–1166 | `.print-only`, `.fold-closed`, `.screen-only`, `.sources-print`. Only in this page; `printing-drawer` is repeated in `globals.css:79–96` |
| Tabs | 1200–1217 | inline JSX |
| Box and composer | 1334–1496 (chip 1336–1350, textarea 1352–1360, buttons 1361–1379, examples 1393–1399, actions 1412–1436, first-visit line 1451–1477, counts 1485–1493) | page state: `box, staged, busy, started, topicId, topics, checklists`, …; `ask`, `stop`, `summarise`, `CLAIM_WORDS`; `EXAMPLE_QUESTIONS` |
| `ask()` / `stop()` / `stageFile()` | 565 / 707 / 733 | — |
| `Working` | 1901–1912 | props only |
| `OneLineLink` | 1935–1948 | `oneLineSource`; page CSS |
| `FoldRow` | 1954–1967 | props only |
| `ReportView` | 1982–2073 | `FoldRow`, `OneLineLink`, local `NO_SOURCE` / `AS_OF_LINE` (1916–1922, copies of `lib/summaryReport.ts`), `thingsToDo`, `displaySource`, `.fold-closed` |
| The stages: `stageWords`, `Stages` | 2076–2080, 2087–2111 | the `Step` type (58) |
| `AttachedCard`, `FileCard`, `FILE_KIND_LABEL`, `FILE_ATTENTION` | 2118–2145, 2163–2217, 2156–2161 | `OUTLINE`, `--amber` |
| `Sheet` | 2221–2239 | props; Escape key |
| `Empty` | 2241–2248 | props only |
| The scope sheet | 1812–1827 | `Sheet` |
| The delete sheet | 1858–1886 (functions 898–920, 1048–1071) | `Sheet`, `OUTLINE`, `TEXT_ACTION`, `printDrawer`; inline red class at 1878 |
| Summary drawer / checklist drawer | 1641–1708 / 1710–1810 | `Drawer`, `ReportView`, `groupItems`, `HowToSteps` (2268–2292) |

**Already shared:**

| File | Exports | Depends on | Imported by |
|---|---|---|---|
| `components/Drawer.tsx` (96 lines) | `Drawer, printDrawer, printDate` (:96) | `lib/printFrame` (:15); `globals.css:87–96` | ws, `components/AuditReport.tsx`, `components/DocumentReport.tsx` |
| `components/AnswerBody.tsx` | `AnswerSource` (:27), `AnswerBody` (:100), `SourceList` (:142) | react-markdown, remark-gfm, `lib/sourceTitle`, `lib/citations` | ws only |
| `lib/printFrame.ts` | `cssString`, `printFrameCss`, `printDate`, `printWithFrame` (:8–70) | no imports | ws, Drawer, a unit test |
| `lib/checklistView.ts` | `groupItems`, `itemSources`, `NO_SOURCE` (:79, the same string the page copies), `oneLineSource`, `thingsToDo`, … | `./sourceTitle.ts` | ws, the how-to route, `lib/checklistConvert.ts`, tests |

**Duplication already present:**
- `app/audits/page.tsx` keeps its own `ACTION_PRIMARY` (155–157), identical to `PRIMARY`.
- `OUTLINE` and `TEXT_ACTION` appear inline in `components/AuditReport.tsx:656`, `:660`, `:665` and `components/DocumentReport.tsx:435`.
- Audits has its own box, tabs and file input (490, 502–535), and no `Sheet` / `Empty` / `Working` / `FoldRow`.
- The workspace's comments cite Audits lines that have moved. Examples: `ws:1197` cites audits 488–501 (now 502–515), and `ws:190` cites AuditReport `:651` (now `:656`).

**Workspace piece that could replace it:** `app/compliance/page.tsx`, `app/audits/page.tsx`, `components/Drawer.tsx`, `lib/printFrame.ts`. The owner's choice is between sharing these and copying them; this table is the dependency list for that choice.

### B11. Documents

**Site (`documents.entity_id`).**
- Added by `009:94–95`, `on delete set null`. "null means company-wide rather than unknown" (`:90–91`).
- **No `entity_confirmed` column exists.**
- **The scan does not propose an `entity_id`.**
  - The prompt asks for a site name (`prompts/document-scan.ts:213`), and it is parsed (`lib/documentScan.ts:306`).
  - Only a three-way `site_scope` is saved (`:744`).
  - `entity_id` is copied from the document row (`:743`).
- **Nothing in `app/` writes `documents.entity_id`.** The insert at `app/api/documents/route.ts:98–126` has none.
- A person corrects the site through `document_corrections`:
  - the Site select in `components/DocumentReport.tsx:628–633`;
  - `app/api/document-actions/route.ts:27`, `:62–71`.
- `document_index_v` resolves it at `049:51–52`.

**Versions.**
- `version_of` and `version_confirmed`: `040:34–38`.
- Writers (verified by grep):
  - the person's "Add a newer version", which sends `version_confirmed:true` (`app/documents/page.tsx:342`, `app/api/documents/route.ts:45–50`, `:122–123`);
  - the Same / Not the same verdict (`app/api/document-actions/route.ts:169–181`).
- **The scan never writes a proposed `version_of`.** It stores only `version_of_title` and `version_confidence` on the scan (`lib/documentScan.ts:754`). The comment at `app/api/documents/route.ts:119–121` says otherwise.

**`document_index_v`** (`049_significant_date_at_read_time.sql:24–177`).
- Columns that could recognise a handbook: `kind` (CHECK `040:56`; no `handbook` value), `subjects`, `agencies`, `issuer`, `title`, `file_name`, `folder_name`, `summary`.
- **It exposes no `file_url`.** So the `hr-handbooks` path is invisible to every reader of the view.

**`folder_section`.**
- The enum is `('files','hr','log')` (`006_enums_and_constraints.sql:144–145`), on `company_folders.section` (`006:314–317`).
- **Nothing reads `'hr'`.** A grep for `'hr'` / `"hr"` across `app lib components scripts config prompts` returns only `lib/database.types.ts:3733` and `:3928`.
- Nothing writes a section: `app/api/folders/route.ts:57`, `:67–75`.

**Workspace piece that could replace it:** `lib/documentScan.ts`, `components/DocumentReport.tsx`.

### B12. Why `docs/SCHEMA.md` shows "Rows: 0" and no grants

**The queries in `scripts/schema-doc.js`.**
- Grants (139–142):
  ```sql
  select table_name as tbl, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privs
    from information_schema.role_table_grants
   where table_schema='public' and grantee in ('anon','authenticated','service_role')
   group by 1,2 order by 1,2
  ```
- Rows (168–169): `select relname as tbl, n_live_tup as approx_rows from pg_stat_user_tables where schemaname='public' order by 1`
- Both go through `npx supabase db query --project-ref <ref> --linked --agent no -o json` (78–81).
- They are rendered at 284 (`cntBy[name] ?? 0`) and 303–305 (`'**nothing**'` when no row).

**Run on STAGING** (`amzsavsrabrlcprltpom`, the ref in `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`), with the same command and flags:

```
select current_user, session_user
→ [{"current_user":"supabase_read_only_user","session_user":"supabase_read_only_user"}]

select table_name as tbl, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privs from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') and table_name='documents' group by 1,2 order by 1,2
→ []

select relname as tbl, n_live_tup as approx_rows from pg_stat_user_tables where schemaname='public' and relname='documents'
→ [{"approx_rows":12,"tbl":"documents"}]
```

**Can the grants query see a presence?** First, the same view with **no** grantee filter, over the whole schema:
```
select grantee, count(*) as n from information_schema.role_table_grants where table_schema='public' group by 1 order by 1
→ []
```
Then the same privileges, read where the CLI role *can* see them:
```
select relacl::text from pg_class where oid='public.documents'::regclass
→ {postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}

select r as role, has_table_privilege(r,'public.documents','SELECT') as sel, …'INSERT'…, …'UPDATE'…, …'DELETE'… from unnest(array['anon','authenticated','service_role']) r
→ anon: all false · authenticated: all true · service_role: all true

select role_name from information_schema.enabled_roles order by 1
→ pg_monitor, pg_read_all_data, pg_read_all_settings, pg_read_all_stats, pg_stat_scan_tables, supabase_read_only_user
```

**Conclusion (FACT).**
- The grants exist: `authenticated` holds `arwdDxtm` on `documents`.
- `information_schema.role_table_grants` returns **zero rows for the whole `public` schema** to `supabase_read_only_user`.
- That role's enabled roles do not include the grantors or grantees. Postgres defines `role_table_grants` as limited to grants where the grantor or grantee is an enabled role (Postgres documentation, not a line in this repository).
- **The grants section of `SCHEMA.md` is blind, and has been in every version.** A loop over all 36 commits of `docs/SCHEMA.md` counted 0 `authenticated` grant lines in each.
- So "**nothing**" in `SCHEMA.md` means "could not see", not "holds nothing". This is `CLAUDE.md` §9a's absence rule exactly.
- `has_table_privilege` or `pg_class.relacl` can see the grants.

**Rows (FACT, then HYPOTHESIS).**
- `n_live_tup` is **not** blind. It returns 12 for `documents` now, and `count(*)` agrees:
  ```
  select count(*) as documents_rows from public.documents → 12
  ```
  Other tables now: `switches` 95, `requirement_templates` 205, `agencies` 33, `topics` 20, `ai_calls` 42.
- The SCHEMA.md history shows nonzero rows in 24 of 36 versions (for example `eec4d22`: 29 tables nonzero). The current file (`cfe1889`, read at 2026-10-04 16:58 UTC) has 0 for all 45 tables, `switches` included.
- **HYPOTHESIS:** that file was generated inside the 4 October reset's `db:migrate` step, after the chain rebuilt empty tables and **before** `db:restore` reloaded data. `CLAUDE.md` §3.7 records that reset after migration 065, and the cost ledger's earliest row now is 17:02:03, after 16:58.
  - Settled by the reset/restore log or `supabase_migrations.schema_migrations` timestamps, or simply by re-running `schema-doc.js`.
  - That re-run was not done here, because it writes `SCHEMA.md`.

**Workspace piece that could replace it:** none (tooling).

---

## PART C — production, read-only

**Credential.**
- The Supabase CLI's own database connection: `npx supabase db query --project-ref "$SUPABASE_PROD_REF" --linked --agent no -o json`, ref beginning `dsfwma…`.
- It is **not** the service role. `SUPABASE_PROD_SERVICE_ROLE_KEY` was not used.
- On staging the same command runs as `supabase_read_only_user` (B12). The production session's role was **not** queried, because the brief allows exactly two production statements.

**C1. Has anyone saved an HR audit?**
```
select count(*) from public.hr_audits;
→ [{"count": 1}]
```

**C2. Has anyone uploaded a handbook through /hr?**
```
select company_id, count(*) from public.documents where file_url like '%/hr-handbooks/%' group by 1;
→ [{"company_id": "07c871c9-1eec-45b5-82c8-782aa3531808", "count": 2}]
```

- Both results are non-empty, so neither is an absence that needs a presence proof.
- **Which company C2's id belongs to was not read.** A third query was not allowed.

---

## Facts and hypotheses

**FACTS** (from a line or a printed query): everything in Parts A, B and C not marked otherwise.

**HYPOTHESES, and what settles each:**
- **Legacy `.doc` / `.ppt`** throw in the parser, outside the scan's try (B1c). Settled by a unit call on a real file.
- **Anthropic's 32 MB / 100-page limits** and the base64 overhead (B2). Settled by the `claude-api` reference, or the live test in B2.
- **A long live-path scan** could exceed the platform's default timeout and leave a row `reading` (B2). Settled by the Vercel function limit and a timed scan.
- **How many audit sections fit in one sweep** (B4). Settled by the ledger's `wall_ms` on Opus `audit` rows.
- **`checkCitations` on a synthetic handbook turn** gives `found:true, kept:[]` (B7). Settled by a unit test.
- **`SCHEMA.md`'s all-zero rows** come from generation mid-reset (B12). Settled by re-running `schema-doc.js`, or the reset log.

## What I could not see, and why

- **The Vercel dashboard.** The production model for HR is taken from `docs/RELEASE.md:96` (`AI_MODEL` = `claude-opus-5-5`), not read from the dashboard.
- **What HR has cost.** HR calls write no ledger row (A2.3), so no figure exists anywhere in the repository or the database.
- **The production session's role, and which company C2 is.** The brief allows two production queries.
- **Any flow running.** No dev server was started and no model was called. Every chain is read from code.
- **The Supabase global upload limit.** It is a dashboard setting.
- **Postgres's definition of `role_table_grants`.** It is from the Postgres documentation, not a file here. The behaviour is shown by the printed queries.

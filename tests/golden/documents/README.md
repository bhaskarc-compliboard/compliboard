# Golden documents — how they are judged

Seven fixtures from six specs, written by the chat on 25 September 2026 as the answer keys for the document scan. Claude Code renders the DOCUMENT TEXT of each spec into the file described under "Render as", byte for byte in content, and turns each ANSWER KEY into a case file the runner can check. The specs are the truth; the case files must not add expectations the specs do not state.

| Case | Company under scan | Kind | What it tests |
|---|---|---|---|
| 01-eap-chemical | Cascade Specialty Chemicals, Portland | program | three planted gaps against 1910.38; four things that must not be called gaps; freshness nudge |
| 02-acdp-chemical | Cascade Specialty Chemicals, Portland | permit | no gaps on an agency document; deadlines and conditions read from the permit's own text; status by run date |
| 03-olcc-cannabis | Evergreen Botanicals, Eugene | certificate | a different industry and agency; a one-page document; the renewal rule inside the licence |
| 04-fsp-food | Willamette Valley Foods, Salem | program | three planted gaps against 21 CFR 117; five things that must not be called gaps; FDA plus ODA |
| 05-sds-supplier | Cascade Specialty Chemicals, Portland | supplier_document | recognised as somebody else's document; not judged; no facts stated as read |
| 06a-forklift-log-record | Cascade Specialty Chemicals, Portland | record | a record judged on completeness and recency; missing days proved by the hour meter; a defect with no follow-up |
| 06b-forklift-log-photo | same | record | the same page as a photograph; honest could_not_read is a pass |

Three companies exist on staging for these, seeded by the runner with the context lines in each spec (name, industry, address and state, one site). Case 05 and cases 01, 02, 06 share a company so that the label list and the "documents the company already holds" context accumulate the way they will for a real customer; the runner scans them in the order 01, 02, 05, 06a, 06b for that company.

How a case is judged:
- Every case runs three times. A case passes when every "must" holds in all three runs and every "must not" holds in all three. One run failing fails the case; the report says which run and which line.
- "Must contain" gaps, deadlines, conditions and facts are matched by concept: the case file carries, for each, a short list of keywords and the citation fragment from the spec; a match needs the citation fragment (where the spec gives one) and at least two of the keywords, in the same item. Counts are never compared.
- Quotes on facts are checked verbatim against the spec's DOCUMENT TEXT.
- Labels (agency, subject) must be the identical string across the three runs of a case, and across cases of the same company.
- "Compliant" anywhere in status, summary or a gap fails the run.
- Statuses that depend on the run date (expiring, expired, overdue) are computed by the runner from the dates in the spec and today's date.
- Near misses the spec names (a kind of policy instead of program, the OLCC's old name) are reported, not failed.

The runner prints one table per case (three runs by must-lines) and, at the end, per case: pass or fail, the label consistency, the cost of the three runs, and the model they ran on. It never targets production.

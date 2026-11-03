# The Audits chat, measured — 36 runs on `claude-sonnet-5-5`

**Run:** 3 November 2026. **Scored against** `keys.md`, which was written from Cascade's own rows
and committed (`fdc83c3`) **before the first model call**. `docs/GAPS-PLAN.md` Part A step 6a.

**Variant A** — the Audits brief: `lib/ask/auditsBrief.ts` + `prompts/audits-answer.ts`.
**Variant B** — `lib/ask/documentsBrief.ts`, whole, on the same question, **with
`section: 'audits_chat'`** so both variants resolve to the same model tier, the same ledger word
and the same search cap. B is not a straw man: it is what ships today.

Six questions · two variants · three runs each · `DEV_MAX_SEARCHES=2` · every tier but
`audits_chat` pinned to `claude-haiku-4-5` in the command's own environment.
**$1.9810 in all — A $1.1680, B $0.8131.** Nothing was pushed; the conversations are on staging.

---

## The score

| key | what it tests | A | B |
|---|---|---|---|
| 1 | "What is our status on everything DEQ?" | **12 / 12** | 3 / 12 |
| 2 | "What did the last DEQ audit find, and has anything changed since?" | **12.5 / 15** | 0 / 15 |
| 3 | "Here is a file. Check if we are good." *(checklist attached)* | **6.5 / 9** | 2 / 9 |
| 4 | "Are we ready for an Oregon OSHA inspection?" | **9 / 9** | 3 / 9 |
| 5 | "Which lines of the template audit point at a document read since the audit?" | **6 / 6** | 0 / 6 |
| 6 | "Why is the ACDP permit marked out of date?" | **11 / 12** | 4 / 12 |
| | **total** | **57 / 64** | **12 / 64** |
| | **must-nots broken** | **0** | **3** |
| | **false claims about the person's own data** | **0** | **6** |
| | **claimed to have run an audit** | **0 of 18** | **0 of 18** |

**A beats B on all six, and on four of them B cannot score at all** — not because it answers badly
but because it cannot see that the company has been audited.

---

## What each question showed

**1 · Status on everything DEQ.** A names the Oregon DEQ audit **and its date** in 3 of 3, gives
its findings in the audit's own words, and labels the nine `expected` rows as suggestions in 3 of
3. B gets the permit expiry right in 3 of 3 and **nothing else the key asks for**: it has no
audit, so it reconstructs the same underlying gaps out of the readings and presents them as
readings, which is honest and is a different answer to the one asked for.

**2 · What did the audit find, and anything since.** A: the date, the counts and "nothing has been
read since" in 3 of 3 (one of the three hedges the last clause rather than asserting it).
**B opens all three runs with *"There is no DEQ audit report on file."*** That is false — the
company ran one that morning — and it is the clearest single result in the set.

**3 · The attached checklist.** A declines the verdict in 3 of 3 and answers from the audit that
already ran against that very file, naming it and its date. **B-1 opens *"Short answer: Not yet"*
and then goes through the checklist line by line itself** — a verdict, and the product's most
expensive operation performed for free, in prose, with no record and no row. That is the single
most important must-not in the set and B broke it.
**A's weakness is here too:** it never produced a valid *template* offer (see below).

**4 · Ready for an Oregon OSHA inspection?** A says **"no Oregon OSHA audit has been run"** in 3
of 3, shows the OSHA documents without calling them an audit, and carries a valid
`{"agency":"Oregon OSHA"}` offer in 3 of 3. **B says it in 0 of 3**, and B-1 opens with a flat
**"No."** — the verdict the question invites and the product does not give.

**5 · Which lines point at a document read since the audit?** The true answer is **none**: every
reading is 14 October 2026 and both audits ran on 3 November with `readings_as_of = 2026-10-14`.
**A says "none", with the reason, in 3 of 3.** B cannot answer at all in 3 of 3 — it does not know
an audit exists or when it ran — and in all three it guesses at which lines the audit "would" have
from the blank DEQ inspector's form, which is a different document.

**6 · Why is the permit marked out of date?** A gets the distinction the key exists for in 3 of 3:
*"out of date" is the audit's word, the document's own state in your list is Expiring*, and **the
permit has not expired**. B never says where the word came from, because it cannot see the audit.
**And B is wrong about the clock in 2 of 3**: it says the permit expires *"46 days from today"*,
which is 46 days from the **reading** date of 14 October. A says **12 days**, which is right. With
no audit to anchor on, B has no date but the reading's.

---

## The one offer

| | A | B |
|---|---|---|
| wrote an ` ```offer ` block | **18 of 18** | 0 of 18 |
| `checkRunAuditOffer` would accept it | **15 of 18** | — |
| named an agency the company does not hold | **0** | — |

The three the code would drop are all the same mistake and all on the same shape: the model wrote
`{"kind":"run_audit","document_id":"I7"}` — **a passage handle where a document id belongs.**

> **It is the prompt's fault, not the model's.** `AUDITS_OFFER_FORMAT` asks for *"document_id, the
> id of that attached file"*, and the model is never shown that id: the only id it has for the
> attached file is the engine's handle. **The fix is to stop asking for an id at all** — the file
> is the one attached on this turn, so the block needs only a marker and the code fills in the id
> it already holds. Written out in step 6a's report; not applied, because the runs are the record.

`parseOffers` dropped all 18 as `unknownKind` (`check_record.offers_dropped.unknownKind: 1` on
every A run), which is `auditsBrief.offers` being `[]` — step 6a's other stop, working exactly as
it should.

**A promise in the prose with no block behind it: A 16 of 18, B 15 of 18.** Documents measured the
same thing at 18 of 36 and answered it by banning offers. Here the promise usually matches the
block, so it is far less bad — but `AUDITS_ONE_OFFER` says *"do not describe its fields in the
prose"* and it is not holding.

---

## Source cards, searches, quotes

| | A | B |
|---|---|---|
| cards across 18 runs | **6** (3 `R` a document, 3 `F` an audit finding) | 8 (all `R`) |
| runs that searched the web | **0 of 18** | 0 of 18 |
| quotes found in nothing | **0** | 0 |

**A carries fewer cards than B, and that is the one measure A loses on.** It is the same shortage
Documents measured (1 source in 36 runs before `DOCUMENTS_GIVEN` gained its quoting clause) and it
has not been solved by inheriting that clause. **But A produced the first `F` cards this product
has ever made** — an audit finding, clickable, opening `/audits?run=…` — which is the thing board 2
drew and which did not exist before this step.

**Nothing was found in nothing, in 36 runs.** `runPlain` and `indexPlain` are why: a self-closing
tag normalises to the empty string, and both the run line and the index line carry a plain-text
copy for the check. Had they not, this table would carry the same *"we could not find these words
in what we have on file"* that cost Documents six of 36.

**The model never searched**, with the context or without it, in 36 of 36. So
`AI_SEARCH_MAX_AUDITS_CHAT` and `DOCUMENTS_SEARCH_FIRST` were never exercised — worth knowing
before anybody reads a search cap as proven.

---

## Cost

| | runs | context tokens | per answer | total |
|---|---|---|---|---|
| **A** | 18 | 23,163 – 25,814 | $0.0649 | **$1.1680** |
| **B** | 18 | 13,204 – 16,608 | $0.0452 | **$0.8131** |

**A costs 1.44× B and scores 4.75× on the keys.** On Haiku the same answer is about a twentieth of
that; the figures above are Sonnet because a quality question is asked on a quality model
(`CLAUDE.md` §3.4a).

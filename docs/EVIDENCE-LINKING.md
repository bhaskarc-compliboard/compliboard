# Evidence Linking — Phase 7.3
**Version:** 1 · **Updated:** 13 September 2026
**Status:** SPEC. Nothing here is built.

`CLAUDE.md` §3.1 — quality-affecting, changes only by discussion. Decisions: `DECISIONS.md`
§21.3 (the four states, and why `satisfied` was removed), §58 (7.3 before M6, and why), §59
(this phase's six, below). Downstream: **M6 renders from this**.

---

## 1. What this phase is — and the split that defines it

**7.3 builds the LINKING LAYER and its contract. It does NOT build the AI matcher.**

The matcher stays an open item with M2, and the reason is measured rather than cautious:

| | |
|---|---|
| It reasons over **document SUMMARIES, not documents** | `prompts/audit.ts`: *"a list of the company's documents, **each with a short description of what it actually covers**"* |
| It disagrees with itself | **3.5× spread** — `satisfied` of 6, 9, 7, 15, 13 and 21 across six runs of one 272-item standard (`AUDIT-CHECKS.md` check 16) |
| It silently drops what it cannot read | `if (dlError || !fileData) continue` — *"`satisfied=2` computed from one readable document out of eight"* (M2(a)) |

**Wiring that into `obligation_evidence` would put a measured-unreliable process behind a schema
that asserts a link.** `CLAUDE.md` §6 requires a verified row and a generated row not to look the
same — and stored in the same table with the same columns, **they would not**. Normalising it
does not make it more reliable; it makes it durable, queryable and repeated.

> ### So 7.3 ships the schema, the queries, and the USER-LINKED path.
> **A person saying "this permit satisfies that requirement" needs no matcher at all**, and it is
> the strongest evidence class there is. M6 unblocks on real rows from the honest source.

---

## 2. Schema — what changes, and what does not

`obligation_evidence` exists with 16 columns and 0 rows. **Three changes.**

```sql
-- 1. WHO made the link. `assessed_by` is free text today and would become the
--    vocabulary set by its first writer — §52's shape, made twice in this project already.
create type public.evidence_source as enum ('user', 'document_review', 'ai_match');
alter table public.obligation_evidence add column matched_by public.evidence_source not null;

-- 2. A user link may not carry a machine confidence, and a machine link must carry one.
alter table public.obligation_evidence add constraint obligation_evidence_confidence_fits_source
  check ((matched_by = 'user' and match_confidence is null)
      or (matched_by <> 'user' and match_confidence is not null));

-- 3. One row per (obligation, document). §59.5 — no partials, so no second row to sum.
create unique index idx_obligation_evidence_one_link
  on public.obligation_evidence (obligation_id, document_id) where superseded_by is null;
```

**`contribution` keeps its enum** — `satisfies | partially_satisfies | contradicts | superseded`
— but **7.3 writes only `satisfies` and `contradicts`.** `partially_satisfies` is left unwritten
(§59.5): one row per requirement a document contributes to, and *"how much of this is covered"*
is a join, not a field. **Do not build a mechanism for a case nobody has.**

**`valid_until` is NEVER inferred** (§59.2). NULL means *we do not know when this expires*, and
that is what the screen says. A guessed date is a claim nobody made, in the one field where being
wrong means a customer believes they are covered.

---

## 3. Status is DERIVED, never stored

§21.3 already ruled this out for `at_risk` and `expiring_soon`, and the reasoning is identical:
**a stored status is a copy of a join, and a stale copy looks current.** An expiring certificate
must make the answer change *without anything running*.

```sql
-- What has been SHOWN for each obligation. Not whether it is OWED — that is
-- obligations.status, and the two are independent facts (§59.4).
create or replace view public.obligation_evidence_state as
select o.id                                   as obligation_id,
       o.company_id,
       count(e.id) filter (where e.contribution = 'satisfies'
                             and e.superseded_by is null
                             and (e.valid_until is null or e.valid_until >= current_date))
                                               as live_evidence,
       count(e.id) filter (where e.contribution = 'satisfies'
                             and e.superseded_by is null
                             and e.valid_until is not null and e.valid_until < current_date)
                                               as expired_evidence,
       count(e.id) filter (where e.contribution = 'contradicts'
                             and e.superseded_by is null)
                                               as contradicting_evidence,
       min(e.valid_until) filter (where e.contribution = 'satisfies'
                             and e.superseded_by is null and e.valid_until is not null)
                                               as next_expiry
  from public.obligations o
  left join public.obligation_evidence e on e.obligation_id = o.id
 group by o.id, o.company_id;
```

**`CLAUDE.md` §3.2 — expired evidence can never satisfy a requirement — is enforced HERE, in the
predicate**, not in a prompt and not at each call site. A consumer that forgets the filter cannot
exist, because there is nothing to forget: the view has already applied it.

---

## 4. The user-linked path — the whole of 7.3's write side

```
POST /api/evidence/link
  → { obligation_id, document_id, contribution: 'satisfies' | 'contradicts',
      valid_from?, valid_until?, note? }
  ← { linked: true, evidence_state: { live_evidence, expired_evidence, next_expiry } }

DELETE /api/evidence/link/:id      → sets superseded_by. Never deletes.
```

Writes `matched_by = 'user'`, `match_confidence = null`, `assessed_by = <user id>`,
`assessed_at = now()`. **No model is called.** `valid_until` is written only if the person
supplies it.

**Tenancy in SQL, not in the caller:** the obligation and the document must both belong to the
session's company, raised as an exception, per §47's guard and `CLAUDE.md` §3.6.

---

## 5. What M6 renders from this — the contract

**Two independent facts side by side, never one computed verdict** (§59.4). This is what §58.1
was waiting for.

| Obligation state | Evidence state | What the row says |
|---|---|---|
| `applies` | no evidence | **"This applies to you. Nothing has been shown for it yet."** |
| `applies` | `live_evidence > 0` | "This applies. *Permit 26-2841* has been linked." |
| `applies` | only `expired_evidence` | ⚠️ "This applies. The only document linked **expired on <date>**." |
| `applies` | `contradicting_evidence > 0` | ⚠️ "This applies, and a linked document **contradicts** it." |
| `does_not_apply` | any | "Does not apply. Ruled out by `<switch> = <value>`." |
| `unknown` | any | "Cannot say yet — `<facts>` would settle it." Rendered as a **question** (§58.2) |

**The first row is the one this phase exists for.** Before 7.3, an `applies` row said *"this
applies to you"* and then nothing, which a reader completes as *"and you have done it"*. **After
7.3 it says what has been shown, including when that is nothing** — and *nothing* is the honest,
common, and permanent default.

**No counts** (§58.3). The table above renders per row; the view's integers exist so a row can
say *"expired on the 14th"*, not so a header can say *"12 of 40"*.

---

## 6. What 7.3 is blocked on, and what it decides for M6

**Blocked:** `obligation_evidence.obligation_id` is `NOT NULL` and **`obligations` has 0 rows in
both environments** because nothing calls the resolver. **The chain is: something writes
obligations → 7.3 → M6.** The first link is 4.3 and `DECISIONS.md` §55 records why it is a
decision rather than a line of code.

**Must land first:** **M2(a)** — half a day, live in production. Normalising an audit that
silently drops unreadable documents turns a transient gap into stored, durable wrongness.

**Decided here on M6's behalf, and stated so M6 inherits them deliberately:** the evidence
vocabulary (§2) · that *no evidence* is an absence rather than a fourth state (§5, row 1) ·
that expiry is filtered in the view rather than at each call site (§3) · and that
`match_confidence` is constrained by source rather than free text (§2).

---

## 7. Recorded prominently: the matcher reasons over a paraphrase

**`prompts/audit.ts`, verbatim:** *"You are given a batch of audit line items and a list of the
company's documents, **each with a short description of what it actually covers**."*

The prompt is careful — it warns that *"a document's name alone is not evidence"* — and it cannot
escape its input. **It never sees a document.** It sees `document_reviews`' summary of one.

`CLAUDE.md` §3.3: AI reasons excellently **against an artifact** and unreliably **from nothing**.
**A summary is neither.** It is an artifact-shaped object produced by an earlier model call, and
matching against it is enumeration from a paraphrase — which is why the **3.5× spread is a
symptom rather than the disease.** Tightening the match prompt cannot fix an input that has
already discarded the evidence.

**This is why the matcher belongs with M2 and not here**, and why 7.3 ships the user-linked path
first: a person linking a permit to a requirement has seen the permit.

# Switch Determination — Phase 7.2
**Version:** 2 · **Updated:** 12 September 2026
**Supersedes:** version 1 (12 Sep). Adds §8 — coverage as a number (42 of 95 switches, 44.2%,
have no determination path after this phase), §8.1 (build the ask path for the 29 `user_answer`
switches first; 25 questions buy 31 requirements, and 4 of the 29 are referenced by nothing),
and §8.2 (`document_reviews` is re-extracted, never mined — mining produces facts with no
basis).
**Status:** SPEC. Nothing here is built.
**Who this is for:** whoever builds 7.2, and whoever has to explain a wrong switch value later.

`CLAUDE.md` §3.1 — everything in this file is quality-affecting and none of it changes without
discussion. Related: `DECISIONS.md` §21.3 (the four states), §24.1 (stated outranks inferred),
§44.1 (a proxy with a fabricated magnitude), §45 (a compensating control must be named and
tested), §47 (close, never delete). Resolution's side is `lib/resolve.ts`.

---

## 1. What this phase is, and the two things it is not

One AI pass reads a company's uploaded documents and writes values into `company_switches`,
each carrying a `basis`, an `evidence_class`, and a source.

**It is not the top of the leverage list.** `has_employees`, `employee_count` and
`site_employee_count` gate 53 requirements between them and are three onboarding questions —
M7's work. `hazwaste_generator_category` gates 19 and is a wiring job (`TODO.md` 6.3b).
**A perfect document pass touches none of them.** Sizing this phase against "83 switches" is
sizing it against work that mostly is not here.

**It is not where `determination_source` gets fixed.** Twelve switches carry a source that is
wrong or that does not exist. That is 6.4 work (§8) and it stays there: the seed's column
answers *which kind of source is authoritative for this fact*; determination needs *how strong
is the thing I actually found*. Different questions, different columns.

---

## 2. `evidence_class` — a new column, not a reuse of `confidence`

`company_switches.confidence` is `high | medium | low` and answers *how sure are we*. It cannot
answer *what kind of thing convinced us*, and the propose/write rule in §5 needs the second.

| `evidence_class` | Definition | May carry |
|---|---|---|
| **`stated`** | The document **states** the value, in the switch's own vocabulary | `high` |
| **`implied`** | The document contains a fact from which the value follows in **one step** | `high` or `medium` |
| **`inferred`** | The value follows from a **pattern across documents**, or from a judgement | `medium` or `low` |
| **`absent`** | **Never written.** The model reports "I looked and found nothing" | — |

> ### ⚡ CORROBORATION IS NOT STATEMENT
>
> **Two circumstantial signals, however consistent with each other, are `inferred` — never
> `stated`, and never `high`.** Consistency between two weak sources is not strength; it is two
> weak sources agreeing, which is also what happens when both are stale or both are derived
> from the same wrong premise.
>
> **The worked case, and it is why this rule is written down.** `cdl_drivers` was at one point
> going to be written automatically from a DOT number plus CDL job postings. Two documents, both
> pointing the same way, and neither one *states* that the company currently employs CDL
> drivers: **a DOT number can be dormant, and a job posting can be aspirational or stale.**
> What made it look strong was that they agreed.
>
> **`high` confidence requires the document to STATE the fact.** That is the distinction
> `evidence_class` exists to hold, and corroboration was being allowed to stand in for
> statement.

**`absent` exists so the forbidden case is expressible.** Without it, a model asked about
`air_permit_required` with no permit in the set has two options — invent a value, or go silent —
and silence is indistinguishable from a failed call.

---

## 3. The extraction prompt

`prompts/switch-determination.ts`. Anchored per `CLAUDE.md` §3.3: never asked to enumerate, always
given one document plus a named candidate list and asked which of them this document speaks to.

### 3.1 What it is forbidden from inferring

Seven rules, each written against a specific way this produces a false green.

1. **Never determine a fact from ABSENCE.** A document set with no air permit does not mean
   there is no air permit; it means one was not supplied. Omitting is always correct.
2. **Never infer a QUANTITY that is not written down.** No estimating from container counts,
   drum sizes, "bulk", or what a company of this type usually holds. A threshold test fed an
   invented number gives a confident wrong answer (`DECISIONS.md` §44.1).
3. **Never convert between units that need an assumption.** Pounds to gallons needs a density,
   which is a property of one product rather than of the rule.
4. **Never determine a fact about the COMPANY from a fact about a SUBSTANCE.** An SDS describes
   a chemical. It does not say the company holds it, how much, or at which site.
5. **Never determine jurisdiction.** State, county, city and authority come from the stated
   address (§24.1). A document mentioning a location is not a correction to it.
6. **Never report a value outside the permitted values.** Close-but-not-equal is `inferred`,
   with what the document actually said.
7. **Never quote text that is not in the document.** The quote is checked character by
   character; a determination whose quote is not found is discarded even if the value was right.

### 3.2 Output contract

```
switch_id       from the candidate list, exactly
value           one of the permitted values, as a string
evidence_class  stated | implied | inferred
quote           VERBATIM, 20-300 chars. Not paraphrased, not tidied, not joined across a gap
locator         section heading, page number or clause reference as printed
reasoning       one sentence. REQUIRED for implied and inferred; omitted for stated
```

**An empty result is valid and common.** Most documents establish one or two facts; many
establish none.

---

## 4. What `basis` looks like

**`basis` is the verbatim span plus its locator, never a paraphrase.** A paraphrase relocates
every future argument to whether the paraphrase was fair, cannot be re-checked when the document
is superseded, and forfeits the substring assertion that is this phase's strongest verification.

Stored as `document_id · locator · "quote"`, with `reasoning` appended for `implied` / `inferred`.

**`stated`** — `air_permit_required = 'standard_acdp'`, high:
> `doc:7f2a… · Permit cover page ·` *"Standard Air Contaminant Discharge Permit No. 26-2841,
> issued to Cascade Specialty Chemicals LLC under OAR 340-216."*

The permit names its own tier and the tier is a permitted value. Nothing is interpreted.

**`implied`** — `employee_count = 42`, medium:
> `doc:9b41… · §4 Eligibility ·` *"This policy applies to all 42 employees of the Company
> regardless of length of service."*
> **Reasoning:** the handbook states a headcount, but it is the headcount when it was written.

Medium rather than high **because a handbook's number is as old as the handbook** — which is why
the `expires_at` this phase writes matters as much as the value.

**`inferred`** — `business_type = 'toll_processor'`, low, **proposed not written**:
> `doc:1c88… · Scope ·` *"Customer-supplied materials are processed to customer specification and
> returned; title does not pass to the Company."*
> **Reasoning:** matches toll processing, but the document never uses the term.

**`absent`** — reported, never written:
> `air_permit_required`: **absent.** No permit, application or air-quality correspondence in the
> 29 documents read.

**That last one is a product feature, not a diagnostic.** It lets the switches screen say *"we
read 29 documents and none of them answers this"* — `CLAUDE.md` §6's honesty rule applied to an
empty state, turning a blank field into a specific request.

---

## 5. Propose-don't-write, and the ranking rule

> **RANKING RULE: a switch is ranked by how many requirements a wrong `false` would HIDE — its
> TRANSITIVE leverage — not by how consequential the fact is in itself.**

A wrong value that **adds** an obligation is visible and arguable. One that **removes** an
obligation is silent. Consequence breaks ties; leverage sets the order.

**Transitive, because direct counting understates the switches that matter most.** A switch's
reach is the requirements naming it **plus** the requirements naming any switch that carries it
as `depends_on_switch`. Measured 12 Sep:

| Rank | Switch | Direct | **Transitive** | Why it proposes |
|---|---|---|---|---|
| 1 | `has_employees` | 32 | **45** | A wrong `false` empties a quarter of the library |
| 2 | `hazardous_chemicals_present` | 8 | **35** | **21 switches depend on it** — all 14 `exposure_*`, every threshold switch. A wrong `false` makes 24 switches unaskable |
| 3 | `hazwaste_generator_category` | 18 | 19 | `vsqg` vs `lqg` changes almost everything; a monthly calculation, and the permit states what was assigned rather than what is true now |
| 4 | `employee_count` | 17 | 17 | Thresholds at 6/10/15/20/25/50/100 — every one a cliff |
| 5 | `ships_placardable_hazmat` | 12 | **14** | A wrong `false` removes the entire DOT layer |
| 6 | `air_permit_required` | 5 | 6 | `'none'` is the value most easily reached by not finding a permit |
| 7 | **`cdl_drivers`** | 2 | 2 | **Gates the FMCSA branch** — driver qualification files, drug and alcohol testing, hours of service. Only ever reachable by corroboration (§2) |
| 8 | **`owns_fleet`** | 5 | **7** | Same claim, same sources, same evidence strength as `cdl_drivers`. Listed together deliberately: treating them differently was the inconsistency that surfaced the corroboration rule |
| 9 | `industrial_stormwater` | 2 | 2 | **The only logical `NOT` in the library** — an inferred value inverts rather than degrades |
| 10 | `holds_iso_certification` | 2 | 2 | `'none'` silently deletes the surveillance-audit obligations |

**The general rule, which subsumes the list and cannot drift from it:**

> **An AI determination may WRITE only when a wrong value would ADD an obligation. It must
> PROPOSE when a wrong value could REMOVE one. `evidence_class = 'inferred'` always proposes,
> whatever the diff says.**

**It is computable from `lib/resolve.ts` and needs no maintained list.** Resolve twice — once
with the candidate value, once with the switch unknown — and diff. Any requirement moving from
`applies` or `unknown` to `does_not_apply` makes it a removal. The table above is the expected
output of that computation, not a parallel source of truth.

---

## 6. The golden file when the input is a document

```
tests/golden-documents/003-acdp-standard-permit/
  source.pdf
  extracted.txt          the text the pipeline produced, FROZEN
  expected.json
```

```json
{
  "must_determine": [{
    "switch_id": "air_permit_required",
    "value": "standard_acdp",
    "evidence_class": "stated",
    "basis_must_contain": "Standard Air Contaminant Discharge Permit No. 26-2841",
    "locator_must_contain": "Permit cover page"
  }],
  "must_not_determine": ["hazwaste_generator_category", "employee_count",
                         "hazardous_chemicals_present"],
  "max_determinations": 3
}
```

**Four assertions. The first two need no AI:**

1. **`basis` is a literal substring of `extracted.txt`.** Catches a fabricated quote — the most
   dangerous failure — for the cost of a string search.
2. **`must_not_determine` is empty of hits.** Over-determination is what this phase produces, so
   the negative assertions matter more than the positive ones (`HOW-WE-BUILD.md` §3).
3. `must_determine` matches on switch, value and class.
4. **`max_determinations`** caps enthusiasm: a permit determining nine facts has started inferring.

**Three structural rules:**

- **`expected.json` is human-written once and frozen.** Regenerating it measures the model's
  agreement with itself, which `TESTING.md` rules out.
- **`extracted.txt` is committed**, so a parser change shows as a diff rather than a mystery.
- **The suite needs negative controls** — a lease, an invoice, an org chart, each
  `must_determine: []`. The live argument is production's **`HF_Acid_SDS_2024.pdf`**, typed
  `Employee Handbook - Leave Policy Section` with a complete FMLA analysis and a headcount of 42.
  Whether the file was mislabelled on upload or the pipeline misread it, **nothing in the row
  says which** — and a determination pass reading it would write `employee_count = 42` for a
  chemical distributor.

**Consistency is measured, not assumed.** Two runs per case, spread published — the audit
engine's was **3.5×** on the same standard (`AUDIT-CHECKS.md` check 16).

---

## 7. When two documents disagree

Expected and frequent: a 2019 SDS and a 2025 revision; a handbook saying 42 and a permit saying 60.

> ### ⛔ DOCUMENT-VERSUS-DOCUMENT DISAGREEMENT IS NEVER RECORDED WITH `user_locked`.
>
> **`user_locked` means A PERSON DECIDED.** A newer document winning over an older one is a
> different claim entirely, and reusing the flag makes the two indistinguishable — at exactly
> the moment someone is trying to work out why a value will not update. A user's decision must
> survive every future pass; a document's win must not.

**So determinations get their own history, and `company_switches` holds only the winner.**

```
switch_determinations           append-only, one row per determination ever made
  id, company_id, entity_id, switch_id
  value, evidence_class, confidence
  document_id, locator, quote, reasoning
  determined_at, model, prompt_sha256
  outcome   won | lost_to | superseded_by   + the determination id it lost to

company_switches                unchanged except for one pointer
  determined_from uuid -> switch_determinations.id
```

This is §47's shape applied to facts instead of obligations: **keep every claim, point at the
current winner.** *"Why won't this value update"* becomes a query rather than an investigation,
and `user_locked` keeps its single meaning.

**Precedence, in order:**

1. **`user_locked` wins over everything.** A later pass records the disagreement; it never
   overwrites (§24.1).
2. **`evidence_class`**: `stated` > `implied` > `inferred`.
3. **Document recency** by `issue_date` — **only within the same class.** A 2019 `stated` beats a
   2025 `inferred`, because recency is not authority.
4. **Issuer authority**: regulator-issued beats self-authored. An ACDP permit beats an internal
   EHS manual.
5. **Unsettled → `state = 'needs_user'`**, value unchanged, both determinations recorded.

**Two rules that override the ladder:**

- **Numeric disagreement never averages.** 42 and 60 do not make 51. The **higher** value is
  proposed with both bases, because for threshold switches higher is the direction that adds
  obligations — the safe side of §5.
- **A disagreement on any §5 switch always goes to the user**, whatever precedence says.

**And disagreement is surfaced, not just resolved.** Two documents contradicting each other about
a headcount usually means one is stale, which the customer wants to know regardless of what we
wrote into the switch.

---

## 8. Coverage — what this phase cannot reach, as a number

**42 of 95 switches — 44.2% of the vocabulary — have no determination path even after 7.2
ships.** `AUDIT-CHECKS.md` check 23 is the standing query.

| Source | Switches | Needs | Built? |
|---|---|---|---|
| `documents` | 53 | this phase | in progress |
| `user_answer` | 29 | an ask path | ⬜ |
| `profile` | 11 | signup to collect the field | ⬜ |
| `computed_by_requirement` | 2 | 6.3b wiring | ⬜ |

**They are deliberately out of scope here, and the gap is recorded as a figure rather than a
note** because it is a coverage claim of the same kind the coverage strip makes: someone should
be able to ask *what fraction of the facts this product runs on can we actually find out* and
get an answer.

### 8.1 The ask path comes before generalising — and it is worth less than it looks

**Build the ask path for the 29 `user_answer` switches first, and let it tell us whether the
pattern works before generalising to all 42.** Measured, so the expectation is set correctly:

- 25 of the 29 are referenced by a requirement; **4 are referenced by none** — an ask path over
  the whole set would ask four questions that change nothing.
- Those 25 touch **36** requirements and **fully resolve 31**.
- **25 questions buy 31 requirements — about 1.2 each.**

That is a modest and honest return, and it is the number to have before anyone designs a
25-question onboarding form. Leverage in this group is flat: `owns_fleet` at 7 transitive, then
`confined_spaces_present` at 3, then a tail of 2s and 1s. **There is no head to attack** — which
is itself the finding, and the reason to prove the pattern on a small set rather than build the
general mechanism first.

### 8.2 `document_reviews` is re-extracted, never mined

**33 rows, 2 companies, 29 documents.** Those rows carry `document_type`, `issued_by`,
`issue_date`, `coverage`, `gaps` and a summary — and **no `basis`, no `evidence_class`, no
quote, no locator.**

**Mining them would produce determinations with no basis**, which is precisely the class of
value this spec exists to prevent: a fact in `company_switches` that nobody can check against a
source. It would also import the pipeline's existing errors as facts —
`HF_Acid_SDS_2024.pdf` is typed `Employee Handbook - Leave Policy Section` with a headcount of
42, and mining it writes `employee_count = 42` for a chemical distributor with a provenance
trail that stops at "a document review said so".

**33 rows is small enough that re-extraction through the new prompt costs less than a migration
would**, and re-extraction produces a quote, a locator and an `evidence_class` for every value.
Separate task, after the pipeline works.

---

## 9. The twelve mislabelled `determination_source` values — 6.4 work

| | Switches | Problem |
|---|---|---|
| **Source does not exist** (7) | `has_employees` · `employee_count` · `site_employee_count` · `imports_exports` · `nonexempt_employees` · `has_group_health_plan` · `business_type` | Marked `profile`; nothing collects them. Signup writes NULL |
| **Should be computed** (4) | `tsca_regulated_substances` · `flammable_liquid_quantity_band` · `corrosive_materials_present` · `aboveground_storage_tanks` | Marked `documents`; all four are `substance_inventory()`-shaped. §37 already decided this for the tanks |
| **Computation not wired** (1) | `hazwaste_generator_category` | `computed_by_requirement` is right; `produces_switch` is NULL on all 200 rows (6.3b) |

**Deliberately untouched in 7.2.** Twelve mislabelled rows is a smaller problem than a false
green hiding 35 requirements, and fixing a seed column mid-phase means building against a moving
target.

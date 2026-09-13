# The Requirements Screen — M6
**Version:** 2 · **Updated:** 13 September 2026
**Supersedes:** version 1 (13 Sep). Section headings carry **no counts** — a heading count
asserts a denominator the coverage strip says we do not have — and the test's header exception
is reverted, which exposed that the detector could not see a parenthesised heading count at all.
Three separate row roots rather than one renderer switching on state. The evidence panel is
unconditional on an `applies` row. The empty state suppresses the "not checked" qualifier,
because nothing has been asserted to qualify.
**Status:** SPEC. Nothing here is built.

`CLAUDE.md` §3.1 — quality-affecting. §6 — honesty is a product feature. Decisions: `DECISIONS.md`
§21.3 (the four states), §58 (7.3 before M6, and the six display contracts), §52 (what an item
decides for things that do not exist). Data contract: `supabase/queries/evidence.sql`.

> **M6 is a REWRITE, not a new build.** `app/requirements/page.tsx` is 279 lines written against
> the pre-007 vocabulary — `missing`, `at_risk`, `expiring_soon`, `satisfied` — **none of which
> can occur.** It renders empty today because `obligations` is 0 rows, so nothing looks wrong.
> `TODO.md` lists this as *"Requirements page ⏱ 4 days"* as though it were greenfield.

**Every example below is a real row, resolved from staging on 13 September 2026** against Test
Alpha Chemical (2 sites, Hillsboro and Portland) with a partial profile. Nothing is a template.

---

## 1. The three states, as they actually render

### 1.1 `applies` — two facts side by side, never one verdict

```
┌─ Chemical storage compatibility / segregation ──────────── OR · local ─┐
│  Oregon Fire Code (IFC-based) Ch. 50 · LOCAL-FIRE                      │
│                                                                        │
│  OWED     Yes — at Test Alpha Chemical — Portland.                     │
│           Because hazardous chemicals are present at this site.        │
│                                                                        │
│  SHOWN    Nothing yet.                                                 │
│           No document has been linked to this requirement.  [ Link a   │
│                                                             document ] │
└────────────────────────────────────────────────────────────────────────┘
```

**The two rows are the whole design.** `OWED` comes from `obligations.status` and
`resolution_rationale`; `SHOWN` comes from `obligation_evidence_state`. **They are never
combined.** This is what §58.1 blocked M6 on: before 7.3 there was no `SHOWN` line, so the card
said *"this applies to you"* and stopped, and a reader completes that sentence as *"and you have
done it"*.

**`SHOWN: Nothing yet` is the common, permanent default and must render as a fact rather than a
warning.** It is not an error state, not amber, not a to-do badge. On day one it is true of every
applicable requirement, and saying so plainly is the honest thing the screen does.

The three other `SHOWN` lines, from `obligation_evidence_state`:

```
SHOWN   Permit 26-2841 (linked 12 Sep) — valid until 2027-03-01.
SHOWN   ⚠ The only document linked expired on 2026-03-01.
SHOWN   ⚠ A linked document contradicts this.  Cascade_SDS_2019.pdf
```

### 1.2 `does_not_apply` — the reason IS the content

```
┌─ 1200-Z industrial stormwater permit ───────────────────── OR · state ─┐
│  OAR chapter 340, division 45; Oregon NPDES General Permit 1200-Z      │
│  OR-DEQ · permit                                                       │
│                                                                        │
│  NOT OWED  Ruled out by industrial_stormwater = false.                 │
│            A definite no with the evidence behind it, not an absence   │
│            of evidence.                        [ That's wrong — fix ]  │
└────────────────────────────────────────────────────────────────────────┘
```

**`resolution_rationale` is rendered verbatim, not summarised.** It already names the fact and
its value, and paraphrasing it on screen would recreate the §56.2 failure in the UI layer.

**The "That's wrong" affordance is required, not optional.** A `does_not_apply` reached from a
wrong switch value is the one failure a customer can see and we cannot — and the correction path
already exists (`POST /api/switches/answer`, §24.1: a stated value outranks an inferred one).

### 1.3 `undetermined` — a dead end, and it says so

```
┌─ Employee handbook, current version controlled ────────────────────────┐
│  Best practice (not statute) · written_program · no agency             │
│                                                                        │
│  UNRESOLVED  This requirement carries no machine-evaluable condition,  │
│              so nothing can compute whether it applies. It is in scope │
│              and unresolved — not cleared. A person must decide.       │
└────────────────────────────────────────────────────────────────────────┘
```

**There is exactly one of these** (`TODO.md` 6.4c decides whether a best-practice row belongs in
a legal library at all). **It must not be rendered alongside `unknown`** — §21.3: `unknown` is a
question we can ask, `undetermined` is a dead end needing a person. Merging them either floods
the customer with unanswerable questions or buries the answerable ones.

---

## 2. `does_not_apply` as a PEER section

**Measured on a full profile: 40 `applies`, 108 `does_not_apply`, 72 `unknown`, 1 `undetermined`.**
108 above 40 buries what the customer came for; 108 behind a filter buries the product's most
defensible output.

**So: three peer sections in the navigation, one open at a time — in THIS order, with NO counts.**

```
  What you owe   ·   What we need to know   ·   What you don't
  ────────────       ────────────────────       ──────────────
```

> ### The headings carry no number, and an earlier draft of this spec was wrong about that.
> It argued a section SIZE is navigation rather than a claim. **"35 requirements apply to you"
> asserts a denominator: 35 of what?** Of a library where 0 of 200 rows have been checked
> against a published source and 42 of 95 facts have no determination path — which is what the
> coverage strip three inches above exists to say. A heading count quietly contradicts it.
>
> **The list underneath is its own count**, and §58.4's navigation-weight concern is answered by
> the section EXISTING, not by a number on it.
>
> **The test's header exception was reverted with it**, and that matters more than the counts
> did: a test with a carve-out is a precedent the next count can point at, and §58.3 exists
> because a count is the easiest thing in the world to add without noticing it is a claim.
> Reverting it immediately exposed something else — the detector could not see
> `What you owe (40)` **at all**, so the earlier test read stronger than it was.

**The middle section is the ACTIONABLE one and that is why it sits second.** Those are questions
a person can answer, and answering one moves rows — the six-second demonstration 7.2a exists for.
**The thing they can act on sits above the thing they can only read.**

`does_not_apply` keeps equal weight in the navigation (§58.4) and sits third in the column.
**Third of three peer sections is not buried** — the concern §58.4 was written against was
hiding it behind a filter, and it is not behind one.

> **A terminology correction carried through the rest of this file.** The actionable section is
> the **`unknown`** rows — *we lack an input, and it is a question we can put to you*. The single
> **`undetermined`** row is the opposite: a dead end nothing can ask about (§21.3). It sits at the
> foot of the questions section under its own heading, visually separated, so a customer is never
> offered a question the product cannot ask.

> **⚠️ Those parenthesised numbers are the ONE permitted exception to §58.3, and the spec
> constrains them tightly: they are section sizes, not a position.** A count of rows in a list
> is navigation. A count that implies a state of compliance is a claim. The test in §4 permits
> exactly these three and fails on anything else.
>
> **If that exception is thought too risky, drop the numbers and keep the sections.** The
> sections are the decision; the counts are a convenience.

**The `What you don't` header says what the section is for**, because a customer arriving there
needs to know why they would want it:

```
  108 requirements we can show you are NOT subject to, each with the reason.
  This is the half of a compliance answer that is usually missing — most
  products tell you what to do and nothing about what you can stop worrying about.
```

**M1 inherits this framing.** A chat answer citing *"you are not subject to X"* must look
consistent with this section, which is why it is settled here rather than in whichever module
renders it next.

---

## 3. `unknown` renders as a QUESTION, with 7.2a behind it

**Not a gap.** `determined_by.switches_missing` names the blocking fact, `switches.question_plain`
holds the wording, and `GET /api/switches/ask` already orders them by dependency and says what
each unblocks. **Rendering these as "unknown" throws away three fields to produce a worse
sentence** (§58.2).

### 3.1 An answerable question — real, from `askableSwitches()` on staging

```
┌─ Do you run your own trucks, or does a carrier collect everything? ────┐
│  Answering this settles 7 requirements.        [ Yes ]  [ No ]         │
│  Nothing else can establish this — only you can tell us.               │
└────────────────────────────────────────────────────────────────────────┘
```

`affects: 7` is the transitive count — `CHEMICAL-OR-WA.md` §6.4's *"number that makes a user
willing to correct a switch"*. **`only_a_person` is shown** because a question no document will
ever answer deserves different weight from one an upload might.

### 3.2 A BLOCKED question — visible, and it says what blocks it

```
┌─ Do you employ drivers with a commercial driver's licence?  (waiting) ─┐
│  We need to know whether you run your own trucks first.                │
│  Answering this would settle 2 more requirements.                      │
└────────────────────────────────────────────────────────────────────────┘
```

**Real: `cdl_drivers`, `blocked_by: ["owns_fleet"]`, `affects: 2`.** On staging today the split is
**43 answerable and 38 blocked, of 81 askable.**

**Blocked questions are SHOWN, greyed, never hidden.** A customer must be able to tell *"there are
43 questions"* from *"there are 81 and 43 can be answered today"* — otherwise the ordering, which
comes from the dependency graph rather than from a preference, is invisible and therefore
unarguable.

**And the distinction the screen must not collapse:** a question whose parent came back **false**
is not blocked — it is **excluded**, and it disappears entirely. A site with no hazardous
chemicals is not *pending* a lead-exposure answer.

### 3.3 Answering one

`POST /api/switches/answer` returns `unblocked[]` — **one level, never a cascade** (§54). The
screen appends those questions and says what moved:

```
  Answered. 2 more questions are now available, and 19 requirements moved.
```

**`obligations_stale: true` in that response must be honoured**: until 4.3 wires the recompute,
the screen says *"your list will update shortly"* rather than showing a stale list silently.

---

## 4. The test that fails if a numeric aggregate appears

`tests/unit/requirementsScreen.test.ts`, run by `npm run test`, in the floor.

**What it asserts against: the rendered output of the view module, not the source text.** A regex
over source would be defeated by a variable name; this renders the component against a fixture
and inspects the produced strings.

```ts
const ALLOWED = [/^What you owe \(\d+\)$/, /^What you don't \(\d+\)$/,
                 /^What we need to know \(\d+\)$/]

test('no numeric aggregate outside the three section labels', () => {
  const text = renderToStaticMarkup(<RequirementsScreen data={FIXTURE} />)
  const numbers = [...text.matchAll(/\b\d+\s*(%|of\s+\d+|requirements?|items?)\b/gi)]
  const offenders = numbers.filter((m) => !ALLOWED.some((re) => re.test(lineOf(text, m.index))))
  assert.deepEqual(offenders.map((m) => m[0]), [],
    'a count or percentage appeared outside the three permitted section labels')
})

test('no readiness, coverage, score or progress wording', () => {
  for (const w of [/readiness/i, /\bscore\b/i, /% *(complete|compliant|covered)/i,
                   /\bprogress\b/i, /\bsatisfied\b/i])
    assert.doesNotMatch(renderToStaticMarkup(<RequirementsScreen data={FIXTURE} />), w)
})
```

**How it catches a count added in six months by someone who does not know the rule.** They add
*"12 of 40 complete"* to a header. It renders. The regex finds `12 of 40`, the line does not match
any of the three permitted labels, and the test fails **with the message, not just a diff**:
*"a count or percentage appeared outside the three permitted section labels"* — which sends them
to §58.3 rather than to a deleted assertion.

**The second test is the one that catches the subtler version**: not a number, but the word
*readiness* or *satisfied* creeping back. `satisfied` is the name §21.3 removed and which
`app/requirements/page.tsx` still uses today.

**The fixture must contain rows in all four states**, or the assertions pass by rendering nothing.

---

## 5. The coverage strip

**Measured: 56 rows, all `not_built`, 0 with a verifier or a date. 0 of 200 requirements carry a
`citation_url` and 0 are `verified`.**

```
  ─────────────────────────────────────────────────────────────────────────
   What's behind this list

   200 requirements are loaded, across 33 agencies.
   None has been checked against its published source yet.

   Of the 95 facts this list is decided from, 53 can be established from your
   documents. The other 42 need a question or are not yet wired.
  ─────────────────────────────────────────────────────────────────────────
```

**Two true facts, and neither of them is the misreading.** An earlier draft read *"33 agencies
mapped, none verified"*, which beside 199 machine-evaluable conditions **sounds like nothing
exists.** *"200 requirements are loaded across 33 agencies"* and *"none has been checked against
its published source"* are both true, neither reads as *we have nothing*, and neither overstates.

**`not_built` on all 56 coverage rows is CORRECT and stays.** The status means an agency has not
been through the generation-and-verification pass, and none has. **That rows exist is a different
fact from that the agency has been worked** — which is exactly why the strip states the two
separately rather than deriving one sentence from the status.

**The third line is 7.2d, and it belongs HERE rather than on the rows.** 42 of 95 switches having
no determination path is a coverage fact about the product — the same class as *none verified* —
and coverage facts live in the strip. **Repeated on each unanswered question it would read as an
apology**, once per row, for a property of the product rather than of that question.

**How it avoids reading as an apology.** It states a method, not a failing: *built from public
sources, not yet checked against the regulator's own text*. That is what the library is, it is
normal for a product at this stage, and it is more than most competitors disclose at any stage.
**No "sorry", no amber, no "coming soon".**

**How it avoids reading as a completeness claim.** It never says *covered*, *complete* or
*verified*, and it puts the unverified count in the same breath as the requirement count. A strip
saying *"33 agencies"* would imply completeness; this one says what those agencies' rows are
**made of**.

**`partial` is not a `coverage_status` value.** The enum is `not_built | generated | verified`;
`◐partial` appears in `TODO.md`'s M6 example and in no schema. **A renderer maps these three and
invents nothing** — `TODO.md`'s example needs correcting, not the enum extending.

**When 6.7 and 6.8 land**, `verified` rows render `✓` and gain a citation link (§58.5 — a link is
what verified looks like). Until then every agency is `○` and every citation is text.

---

## 6. What M6 does NOT render — argue against this list, do not quietly extend it

| Not rendered | Why | Where it is decided |
|---|---|---|
| **Readiness, coverage or completeness percentages** | A percentage over an unverified library is the omniscient status tracker wearing a chart. Gated on 6.7, which is a gate and not a step | `TODO.md` M6, `CLAUDE.md` §6 |
| **Any count except the three section sizes** | A count of rows is navigation; a count implying a compliance position is a claim. §4's test enforces the boundary | §58.3 |
| **Citation links** | A link to a rule nobody checked asserts that somebody checked it. **A linked citation is what verified looks like** | §58.5 |
| **A `satisfied` status** | Removed by §21.3: it answers *have I done it*, which is a join against `obligation_evidence`, never a column. The existing page still uses it | §21.3 |
| **Progress indicators, streaks, "X to go"** | Every one implies a finish line. Compliance has no finish line, and a number that only climbs is a progress bar, not a measure | `TODO.md` M6 |
| **A combined OWED+SHOWN verdict** | The collapse §58.1 blocked M6 to prevent | §58.1 |
| **Blocked questions hidden** | The customer cannot then tell a short list from a filtered one | §3.2 above |
| **An empty state that says "you're all set"** | 0 rows means resolution has not run, not that nothing applies. `CLAUDE.md` §5.1 — an empty state is a claim and it has to be true | §5.1 |

**Anything added to the screen that falls in this table needs an argument in `DECISIONS.md`
first.** The list exists so the argument has to be made, rather than the addition being noticed
six months later by a test that no longer covers it.

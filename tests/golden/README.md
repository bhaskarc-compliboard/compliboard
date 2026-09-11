# Golden files

**Proposed convention — nothing here is committed yet. See `TODO.md` 2.8.**

One JSON file per test case. The file is data; it is not a test that runs. No runner exists
yet — `npm run check` is `typecheck && check:schema && build` and there is no test framework
in `package.json`. Writing the cases down first is deliberate: the cases are the expensive
part and they are worth capturing when the evidence is fresh, whereas the runner is an
afternoon whenever it is next.

## Why here and not somewhere else

`baseline-outputs/` at the repo root is **not** this. That folder is a frozen dump of 947
rows of production AI output from 9 Sep, one JSON per table, kept as a "before" picture from
before the determination gate and critic pass existed. Its own README says nothing in the
codebase reads it. It answers *"did that change make the output better or worse"* across a
whole corpus.

A golden file answers a narrower question: **for this one input, does the answer still
contain the facts a correct answer must contain?** It is hand-curated, it has an expected
result, and a runner will eventually read it. That belongs with tests.

`tests/` does not exist yet either — `TODO.md` 4.4 is "first tests in the codebase". This
folder anticipates it. If you would rather these sat at the root beside `baseline-outputs/`,
that is a defensible alternative and costs one `git mv`.

## Schema

`TODO.md` 2.8 specifies: **input, expected, actual, matched, missed, extra.** All six are
present. `run` and `notes` are additions, and both earn their place:

| Field | What it holds |
|---|---|
| `input` | The document and the question, exactly as sent |
| `run` | Model, temperature, max tokens, the system prompt's **sha256**, and the exact user content |
| `expected` | The facts a correct answer must contain, each with an `id` so scoring can reference them |
| `actual` | The full response, **unedited** — fences, formatting and all |
| `matched` / `missed` / `extra` | Scoring. **`null` means not scored**, which is not the same as `[]` meaning scored and empty |
| `notes` | Anything that qualifies how the run was produced |

**`run.system_prompt_sha256` is the important addition.** 2.8 says *"re-run after every
prompt change or model upgrade"*, and without a hash that is a thing someone has to
remember. With one, a runner can say *"this baseline was recorded against a prompt that no
longer exists"* and refuse to compare.

## Adding a case

1. Run the input through the real path if one exists. If you have to construct the payload
   by hand, **say so in `notes`** — case 002 does, and the reason matters. When the live
   path later catches up, **correct the note rather than deleting it**: 002's payload was
   hand-built because `/api/chat` dropped text-file contents, that was fixed on 11 Sep, and
   the note now records both facts. A baseline whose provenance quietly changes is not a
   baseline.
2. Record `actual` verbatim. Do not tidy it. The formatting is evidence too: 002's response
   arrived wrapped in markdown fences the prompt explicitly forbids.
3. Fill `expected` with facts, not phrasings. A correct answer may word things differently.
4. Leave `matched` / `missed` / `extra` as `null` until something actually scores them.

## Cases

| | Case | Status |
|---|---|---|
| 001 | **The 2.5L bottle labelling case — NOT WRITTEN YET.** `TODO.md` 2.8 names it as test #1 and it has never been recorded as a file. The failure is described in `DECISIONS.md` §4 and `CHEMICAL-OR-WA.md` §3.3 — the answer asserted that each inner 2.5L bottle needs DOT marking and labelling, which is wrong for a combination package. **The gap in numbering is intentional, not an accident.** | missing |
| 002 | `002-dot-shipping-isopropyl-drums.json` — DOT shipping requirements for isopropyl alcohol in 5-gallon drums by common carrier | baseline recorded, not scored |

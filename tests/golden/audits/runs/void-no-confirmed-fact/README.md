# Void: six audit runs bought before the fixture fact was actually confirmed

Audits Run 1b, 29 September 2026. Kept and NOT counted.

`confirmFixtureFact` in `scripts/run-golden-audit.js` was meant to confirm the emergency plan's
`employee_count = 42` before any audit ran, so `cascade-osha`'s `employee-count-contradiction` line
would be reachable for the first time. Its first version ordered the lookup by
`documents.created_at` — **a column that does not exist**; the table has `uploaded_at`. PostgREST
returned an error, `data` came back null, the function took that for "not found", and the header
printed:

    fixture: nothing confirmed — the emergency plan (01-eap-chemical.pdf) is not on file for this company

about a document that was on file with id `ba964e51-94bc-4aaa-8362-d763ecf30b27`. Six runs were bought
against an input carrying no confirmed fact at all.

**This is CLAUDE.md §9a's named trap** — "when a check reports an absence, prove it can see a presence
first" — committed in the same session that quotes it. The proof took one query with the `.order()`
removed: 1 row. `confirmFixtureFact` now checks `error` on every read and dies on it, so a broken
query can no longer wear the face of an empty table.

Void for both cases, not just the OSHA one: a confirmed fact changes the `confirmed` part of the
company context, which is rendered into every audit's input block, so the block sha and the input are
different for `cascade-deq` too.

The counted runs are the ones in the case folders.

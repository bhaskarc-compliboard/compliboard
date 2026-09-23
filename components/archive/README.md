# Archived components

Nothing in this folder is imported by the app. It is kept, not deleted, for the same reason
`DECISIONS.md` §113 keeps the pipeline: **a piece behind a switch must be there when the switch
is turned back on.**

## `GateAskCard.tsx`

Rendered the determination gate's question — the `outcome: 'ask'` branch of `/api/chat`.

Orphaned by Run 3, when `app/compliance/page.tsx` was rebuilt from the prototype. The gate is off
in production and on staging (`RESEARCH_GATE` / `CHECKLIST_GATE`, both default off since Run 1),
so nothing reaches this path today.

> ### ⚠ KNOWN LIMITATION, RECORDED RATHER THAN DISCOVERED LATER.
> **The rebuilt page does not handle `outcome: 'ask'`.** If `RESEARCH_GATE` or `CHECKLIST_GATE`
> is switched on, the route will answer with a question and the page will render nothing useful
> for it. Re-wiring this card is part of **R1.5**, which revisits the gate at a much higher bar
> — the gate is not simply switched back on before then.

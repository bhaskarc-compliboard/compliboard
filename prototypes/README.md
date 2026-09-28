# Prototypes

> **🕓 HISTORICAL — kept on purpose.** *(28 September 2026.)* `compliance-workspace.html` is the spec
> the Compliance Workspace was built from, and it is kept as that record. **`docs/DESIGN.md` is the
> live template** — it is what the layout pass produced and what every surface since, including the
> Documents table and the report drawer, has been built to. When the two differ, `DESIGN.md` is right.

`compliance-workspace.html` is the **design reference** for the research/checklist section.

It is **read by Run 3**, which rebuilds `app/compliance/page.tsx` from it. Runs 1 and 2 do not
build from it.

It is **not served** — nothing in `app/` imports or routes to this folder.

/**
 * A COMPANY'S LABELS ARE WHAT ITS READINGS SAY — AND THEY HAVE TO LEAVE WITH THEM.
 *
 * `company_labels` is the company's own vocabulary: every agency and subject any current reading of
 * its documents named. `lib/documentScan.ts` upserts a row per label as it reads, and **nothing
 * removed one when the reading that caused it went away.**
 *
 * *** FOUND ON A COMPANY HOLDING ZERO DOCUMENTS — Audits Run 7a, confirmed Run 8a item 3. ***
 * `Test Gamma Solvents`, a chemical manufacturer in Portland, Oregon, with no documents at all,
 * carried `Washington State Department of Health`, `City of Seattle Office of Labor Standards`,
 * `Washington State Liquor and Cannabis Board` and four food-service subjects — left behind by a
 * staff-policy fixture that had been deleted. That also settled `DECISIONS.md` §141's unverified
 * hypothesis about where those labels came from.
 *
 * *** IT IS NOT COSMETIC, AND THIS IS THE LINE THAT SAYS SO. *** `auditAgenciesFor` in
 * `lib/audit.ts` reads `company_labels` to decide what an audit of everything audits. A label no
 * document supports is therefore a **section of an audit with no evidence behind it**: a person asks
 * for an audit of everything and is billed for a model call per phantom regulator, each of which can
 * only answer "nothing on file" about a rule that was never theirs.
 *
 * WHAT COUNTS AS AN ORPHAN. A label whose exact `(kind, label)` pair appears on no document in
 * `document_index_v` — the view, which takes a document's identity from the reading that COULD read
 * it and then applies the person's own corrections on top. Not raw `document_scans`: that read is
 * what fix-list items L1 and D2 were, and the block in the function says what each of them cost.
 * Compared exactly, because that is how `lib/audit.ts` compares an agency label when it scopes an
 * audit — a looser comparison here would keep labels that an audit cannot use.
 *
 * *** AND IT NEEDS THE SERVICE ROLE, WHICH IS A FACT ABOUT THE PRODUCT AND NOT A SHORTCUT. ***
 * Read back with `has_table_privilege` rather than from a grant list (`role_table_grants` returns
 * zero rows for this table, which is that view's limitation, not an answer):
 *
 *     authenticated — SELECT: true · INSERT: false · UPDATE: false · DELETE: false
 *
 * A person may read their company's vocabulary and may never change it: labels come from readings,
 * and only the server writes one. That rule is right and is not being changed. It means this prune
 * is a server action, so every caller passes a service-role client and says why.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export interface PruneResult {
  /** How many label rows were removed. */
  removed: number
  /** Which ones, as "kind:label", for the log and for a report. */
  labels: string[]
  /** Set when the prune could not be done. The caller's own work is never failed for it. */
  error?: string
}

/**
 * Remove every label of this company that no current reading still carries.
 *
 * **It never throws.** It is called after a delete that has already succeeded, and a tidy-up that
 * takes the request down with it would turn a working delete into a 500 the person cannot act on
 * (§5.1). A failure comes back in `error` and is logged.
 */
export async function pruneOrphanLabels(admin: Db, companyId: string): Promise<PruneResult> {
  try {
    // *** IN USE MEANS "IN USE ACCORDING TO `document_index_v`" — fix list D2 and L1, root R6. ***
    //
    // Two reasons this one read has to be the view and not `document_scans`, and each of them has
    // cost a company an agency out of "audit everything":
    //
    //   L1 — THE READING THAT COULD READ IT (§185a, A3e). `is_current` may be a failed reading,
    //        whose `agencies` and `subjects` are empty, so a reading service that refused for a
    //        minute made every label that document carried look like an orphan — and this function
    //        DELETES. Fixed in A3e by `readableScanIds`; the view carries the same rule in SQL
    //        (`readable_scan_id`, migration 076), which is where it is defined.
    //   D2 — A RENAMED LABEL IS INVISIBLE IN A RAW SCAN. `app/api/company-labels/route.ts` writes a
    //        rename into `document_corrections` and `company_labels` and **never into a scan** — on
    //        purpose: a reading is what the reading said, and a person's correction is a separate,
    //        newer fact. `document_index_v` applies those corrections field by field; raw
    //        `document_scans` rows do not. So after a rename the old name was gone from
    //        `company_labels` and the new name appeared in no scan, and the next delete of **any**
    //        document pruned the renamed label. The company lost that agency from "audit
    //        everything", having just told us what to call it.
    //
    // The comparison is still exact, for the reason the header gives: `lib/audit.ts` matches an
    // agency label exactly when it scopes an audit, and this read is now looking at the same
    // corrected values that `lib/audit.ts` reads.
    const { data: rowsInUse, error: sErr } = await admin.from('document_index_v')
      .select('agencies, subjects').eq('company_id', companyId)
    if (sErr) return { removed: 0, labels: [], error: `reading the documents: ${sErr.message}` }

    const alive = new Set<string>()
    for (const sc of (rowsInUse ?? []) as Array<{ agencies: string[] | null; subjects: string[] | null }>) {
      for (const a of sc.agencies ?? []) alive.add(`agency:${a}`)
      for (const b of sc.subjects ?? []) alive.add(`subject:${b}`)
    }

    const { data: labels, error: lErr } = await admin.from('company_labels')
      .select('id, kind, label').eq('company_id', companyId)
    if (lErr) return { removed: 0, labels: [], error: `reading the labels: ${lErr.message}` }

    const rows = (labels ?? []) as Array<{ id: string; kind: string; label: string }>
    const orphans = rows.filter((l) => !alive.has(`${l.kind}:${l.label}`))
    if (!orphans.length) return { removed: 0, labels: [] }

    const { error: dErr } = await admin.from('company_labels')
      .delete().in('id', orphans.map((l) => l.id))
    if (dErr) return { removed: 0, labels: [], error: `removing the labels: ${dErr.message}` }

    const named = orphans.map((l) => `${l.kind}:${l.label}`)
    // Said out loud as well as done: a label disappearing from a company's vocabulary is a change to
    // what an audit of everything will audit, and a change like that should be greppable.
    console.warn(`company ${companyId}: removed ${named.length} orphan label(s) no document still `
      + `carries — ${named.slice(0, 6).join(' · ')}${named.length > 6 ? ` · +${named.length - 6} more` : ''}`)
    return { removed: named.length, labels: named }
  } catch (error) {
    return { removed: 0, labels: [], error: error instanceof Error ? error.message : String(error) }
  }
}

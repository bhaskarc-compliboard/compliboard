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
 * WHAT COUNTS AS AN ORPHAN. A label whose exact `(kind, label)` pair appears in no `is_current`
 * scan of the company. Compared exactly, because that is how `lib/audit.ts` compares an agency label
 * when it scopes an audit — a looser comparison here would keep labels that an audit cannot use.
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
    const { data: scans, error: sErr } = await admin.from('document_scans')
      .select('agencies, subjects').eq('company_id', companyId).eq('is_current', true)
    if (sErr) return { removed: 0, labels: [], error: `reading the scans: ${sErr.message}` }

    const alive = new Set<string>()
    for (const sc of (scans ?? []) as Array<{ agencies: string[] | null; subjects: string[] | null }>) {
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
    console.warn(`company ${companyId}: removed ${named.length} orphan label(s) no current reading `
      + `carries — ${named.slice(0, 6).join(' · ')}${named.length > 6 ? ` · +${named.length - 6} more` : ''}`)
    return { removed: named.length, labels: named }
  } catch (error) {
    return { removed: 0, labels: [], error: error instanceof Error ? error.message : String(error) }
  }
}

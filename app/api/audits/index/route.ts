// THE AUDITS PAGE'S ONE READ — Audits Run 3.
//
//   GET /api/audits/index
//
// *** ONE REQUEST, AND NO MODEL CALL ANYWHERE IN IT. *** Everything the page shows — the agency
// lines, what is inside them when they open, the running progress, the banner, and the whole of the
// Past audits tab — is a query over rows Documents and Audits already wrote. That is the product's
// own rule, one layer up: "what's missing is a database query and never an AI guess" (CLAUDE.md §1).
//
// It reads on the CALLER's client, so RLS is the scoping and a forgotten `.eq` cannot leak a row.
// The `.eq`s are there as well, because a policy and a filter agreeing costs nothing.

import { NextResponse, type NextRequest } from 'next/server'

import { requireCompany } from '@/lib/auth'
import { estimateRun } from '@/lib/auditEstimate'
import { costOfSections } from '@/lib/auditRun'

/** A deadline is worth showing on the page when it has passed or lands within this window. */
const SOON_DAYS = 90

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const today = new Date().toISOString().slice(0, 10)
    const soon = new Date(Date.now() + SOON_DAYS * 86400_000).toISOString().slice(0, 10)

    const [labelsQ, docsQ, runsQ, sitesQ, foldersQ] = await Promise.all([
      db.from('company_labels').select('label, kind').eq('company_id', companyId).order('label'),
      db.from('document_index_v')
        .select('document_id, title, file_name, kind, agencies, subjects, site_name, doc_date, '
              + 'doc_date_kind, significant_date, significant_date_kind, display_status, scan_id, '
              + 'scan_status, could_not_read_reason, open_gap_count, scanned_at')
        .eq('company_id', companyId).order('title'),
      db.from('audit_runs')
        .select('id, kind, scope, agency_label, status, section_count, done_count, readings_as_of, '
              + 'created_at, started_at, finished_at, summary, notified_at, dismissed_at, previous_run_id')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
      db.from('entities').select('id, name').eq('company_id', companyId).order('name'),
      // *** THE FOLDER LIST, BECAUSE THE DOCUMENT REPORT OPENS HERE NOW — Run 3b, item 1. ***
      // `components/DocumentReport.tsx` is handed the folders rather than fetching them, so the
      // page that mounts it has to hold them. Documents does the same; this is the second page.
      db.from('company_folders').select('id, name').eq('company_id', companyId).order('name'),
    ])
    for (const [what, q] of [['company_labels', labelsQ], ['document_index_v', docsQ],
                             ['audit_runs', runsQ], ['entities', sitesQ],
                             ['company_folders', foldersQ]] as const) {
      if (q.error) throw new Error(`${what}: ${q.error.message}`)
    }

    const agencies = (labelsQ.data ?? [])
      .filter((l: { kind: string }) => l.kind === 'agency')
      .map((l: { label: string }) => l.label)
    const docs = (docsQ.data ?? []) as unknown as Array<Record<string, unknown>>
    const runs = (runsQ.data ?? []) as unknown as Array<Record<string, unknown>>

    // A reading that reached a verdict. `not_yet_read` documents are not evidence yet, and the
    // count on the page says "documents read", so it must mean that.
    const read = docs.filter((d) => d.display_status !== 'not_yet_read')
    const heldUnread = docs.filter((d) => d.display_status === 'not_yet_read')
    const carriesAgency = (d: Record<string, unknown>, label: string) =>
      Array.isArray(d.agencies) && (d.agencies as string[]).includes(label)
    // *** THE LAST GROUP, NEVER DROPPED. *** DESIGN.md §3's rule for a row with no value for the
    // grouped column: a document no reading placed under an agency is invisible to every audit,
    // and invisible is exactly what the page must not let it be.
    const unplaced = read.filter((d) => !Array.isArray(d.agencies) || (d.agencies as string[]).length === 0)

    // ---- deadlines worth a line: passed, or inside the window; plus recurring with no date ----
    const scanIds = read.map((d) => d.scan_id).filter(Boolean) as string[]
    let deadlines: Array<Record<string, unknown>> = []
    if (scanIds.length) {
      const { data, error } = await db.from('document_deadlines')
        .select('document_id, title, due_on, recurs, source_line')
        .in('scan_id', scanIds).order('due_on', { nullsFirst: false })
      if (error) throw new Error(`document_deadlines: ${error.message}`)
      deadlines = ((data ?? []) as unknown as Array<Record<string, unknown>>).filter((dl) =>
        (dl.recurs && !dl.due_on) || (typeof dl.due_on === 'string' && dl.due_on <= soon))
    }

    // ---- the last DONE run per agency, and any run still going ----
    const doneByAgency = new Map<string, Record<string, unknown>>()
    const activeByAgency = new Map<string, Record<string, unknown>>()
    for (const r of runs) {
      // An "all agencies" run carries every label in one string; its SECTIONS are what belong to
      // one agency, so the page reads those rather than splitting the label back apart.
      const labels = String(r.agency_label ?? '').split(' · ').map((x) => x.trim()).filter(Boolean)
      for (const l of labels) {
        if (r.status === 'done' && !doneByAgency.has(l)) doneByAgency.set(l, r)
        if (r.status !== 'done' && !activeByAgency.has(l)) activeByAgency.set(l, r)
      }
    }

    // ---- sections, for progress and for could-not-complete ----
    const runIds = runs.map((r) => r.id as string)
    let sections: Array<Record<string, unknown>> = []
    if (runIds.length) {
      const { data, error } = await db.from('audit_sections')
        .select('id, run_id, ordinal, title, status, started_at, finished_at, ai_call_id, '
              + 'could_not_complete_reason')
        .in('run_id', runIds).order('ordinal')
      if (error) throw new Error(`audit_sections: ${error.message}`)
      sections = (data ?? []) as unknown as Array<Record<string, unknown>>
    }

    // ---- the open findings of each agency's last done run, by word ----
    const lastDoneIds = [...new Set([...doneByAgency.values()].map((r) => r.id as string))]
    let openFindings: Array<Record<string, unknown>> = []
    if (lastDoneIds.length) {
      const { data, error } = await db.from('audit_findings')
        .select('id, run_id, section_id, kind, word, title, document_id, due_on, passed')
        .in('run_id', lastDoneIds).eq('status', 'open').order('ordinal')
      if (error) throw new Error(`audit_findings: ${error.message}`)
      openFindings = (data ?? []) as unknown as Array<Record<string, unknown>>
    }

    // ---- the readings' own expected-and-not-seen, for the documents under each agency ----
    let expected: Array<{ document_id: string; titles: string[] }> = []
    if (scanIds.length) {
      const { data, error } = await db.from('document_scans')
        .select('document_id, expected_missing').in('id', scanIds)
      if (error) throw new Error(`document_scans: ${error.message}`)
      expected = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((s) => ({
        document_id: s.document_id as string,
        titles: (Array.isArray(s.expected_missing) ? s.expected_missing : [])
          .map((e: Record<string, unknown>) => String(e?.title ?? '')).filter(Boolean),
      }))
    }

    // ---- cost per run, summed from the ledger over each section's window ----
    // Not `ai_call_id`: one section can be four calls and records one id (`lib/auditRun.ts`).
    const costByRun = new Map<string, number>()
    for (const r of runs) {
      const mine = sections.filter((s) => s.run_id === r.id) as
        Array<{ started_at: string | null; finished_at: string | null }>
      costByRun.set(r.id as string, await costOfSections(db, companyId, mine))
    }
    const costOf = (runId: string) => costByRun.get(runId) ?? 0

    // ---- how many of a previous run's findings this run closed ----
    const closedByRun = new Map<string, number>()
    if (runIds.length) {
      const { data } = await db.from('audit_findings')
        .select('closed_by_run_id').in('closed_by_run_id', runIds)
      for (const f of data ?? []) {
        const k = f.closed_by_run_id as string
        closedByRun.set(k, (closedByRun.get(k) ?? 0) + 1)
      }
    }

    const estimate = await estimateRun(db, companyId, 1)

    // *** THE BANNER IS A ROW, NOT BROWSER STATE. *** Documents' reasoning, unchanged: a banner
    // that comes back on the next device is worse than one that never appeared. A finished,
    // undismissed run is one waiting to be seen.
    const banners = runs.filter((r) => r.status === 'done' && !r.dismissed_at)

    return NextResponse.json({
      today,
      agencies,
      subjects: [...new Set(docs.flatMap((d) => (Array.isArray(d.subjects) ? d.subjects as string[] : [])))].sort(),
      sites: sitesQ.data ?? [],
      folders: foldersQ.data ?? [],
      counts: { read: read.length, held_unread: heldUnread.length, agencies: agencies.length },
      documents: docs,
      unplaced,
      deadlines,
      expected,
      sections,
      open_findings: openFindings,
      last_done: Object.fromEntries([...doneByAgency.entries()].map(([l, r]) => [l, r.id])),
      active: Object.fromEntries([...activeByAgency.entries()].map(([l, r]) => [l, r.id])),
      runs: runs.map((r) => ({
        ...r,
        cost_usd: costOf(r.id as string),
        closed_count: closedByRun.get(r.id as string) ?? 0,
        estimate: r.status === 'done' ? null : estimate.line,
      })),
      banners: banners.map((r) => r.id),
      estimate: estimate.line,
    })
  } catch (error) {
    console.error('audits/index GET:', error)
    return NextResponse.json({ error: 'We could not read your audits just now.' }, { status: 500 })
  }
}

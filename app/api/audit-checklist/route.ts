// A CHECKLIST FROM AN AUDIT — Audits Run 3.
//
//   POST /api/audit-checklist  { run_id, finding_ids?: string[] }
//
// *** NO MODEL CALL, AND THAT IS THE DIFFERENCE FROM `document-checklist`. ***
// That route asks a model to turn ONE gap into steps, because a gap is a paragraph about a document
// and the steps are not in it. An audit finding already carries `what_to_do` — one concrete next step,
// written when the finding was — so turning twelve findings into twelve items is a copy, not a
// judgement. Asking a model to restate what we already have would cost money to lose fidelity.
//
// *** THE RUN IS THE SOURCE, NAMED IN WORDS RATHER THAN A COLUMN. *** `checklists` carries
// `document_id` and `document_gap_id` and no `audit_run_id`; adding one is a migration and this run
// builds a page. So `question` and `source_title` say which audit and which agency each item came
// from, which is what a person reading the checklist needs. A column for it is worth having when
// something needs to QUERY by it, and nothing does yet.

import { NextResponse, type NextRequest } from 'next/server'

import { requireCompany, supabaseAdmin } from '@/lib/auth'

/** The four words that mean a person has something to do. `on_file` is not one of them. */
const NEEDS_PERSON = new Set(['nothing_on_file', 'stale', 'not_a_document_question'])

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const runId = String(body?.run_id ?? '').trim()
    const only: string[] = Array.isArray(body?.finding_ids) ? body.finding_ids.map(String) : []
    if (!runId) return NextResponse.json({ error: 'Give a run_id.' }, { status: 400 })

    const { data: run } = await db.from('audit_runs')
      .select('id, agency_label, finished_at, created_at').eq('id', runId).maybeSingle()
    if (!run) return NextResponse.json({ error: 'That audit was not found.' }, { status: 404 })

    let q = db.from('audit_findings')
      .select('id, kind, title, word, what_to_do, document_id, locator')
      .eq('run_id', runId).eq('status', 'open').order('ordinal')
    if (only.length) q = q.in('id', only)
    const { data: rows, error } = await q
    if (error) throw error

    const findings = ((rows ?? []) as unknown as Array<Record<string, unknown>>)
      .filter((f) => f.kind === 'contradiction' || NEEDS_PERSON.has(String(f.word)))
    if (!findings.length) {
      return NextResponse.json({ error: 'Nothing in this audit needs a person, so there is nothing to put on a list.' },
        { status: 422 })
    }

    const agency = (run.agency_label as string) ?? 'your agencies'
    const when = String(run.finished_at ?? run.created_at).slice(0, 10)
    const title = `${agency} audit — ${findings.length} thing${findings.length === 1 ? '' : 's'} to do`.slice(0, 160)

    const { data: checklist, error: cErr } = await supabaseAdmin.from('checklists').insert({
      company_id: companyId, user_id: userId, title,
      question: `From the ${agency} audit of ${when}`.slice(0, 500),
      document_id: null, document_gap_id: null,
    }).select('id').single()
    if (cErr) throw new Error(`creating the checklist: ${cErr.message}`)

    // *** ONE ITEM PER FINDING, IN THE FINDING'S OWN WORDS. *** The title is the item; `what_to_do`
    // is the description, unedited. Everything here is `must_do`: an audit does not produce
    // good-to-have items, and inventing a split would be this route deciding what matters.
    const items = findings.map((f, i) => ({
      checklist_id: checklist.id, company_id: companyId, sort_order: i,
      name: String(f.title).slice(0, 300),
      description: (f.what_to_do as string) ?? null,
      category: 'must_do' as const,
      origin: 'document' as const,
      source_title: `${agency} audit, ${when}`,
      source_url: null,
    }))
    const { error: iErr } = await supabaseAdmin.from('checklist_items').insert(items)
    if (iErr) throw new Error(`writing the items: ${iErr.message}`)

    return NextResponse.json({ checklistId: checklist.id, title, items: items.length })
  } catch (error) {
    console.error('audit-checklist POST:', error)
    return NextResponse.json({ error: 'We could not make that checklist just now.' }, { status: 500 })
  }
}

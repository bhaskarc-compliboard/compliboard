// RENAMING AND MERGING THE COMPANY'S OWN LABEL VOCABULARY — Audits Run 3b, item 7.
//
//   PATCH /api/company-labels  { kind: 'agency'|'subject', label, action: 'rename'|'merge', to }
//
// *** WHY THIS EXISTS. *** A label is the company's own vocabulary and no model has a canonical
// list, so two readings of the same regulator can name it two ways — §145 records a real one:
// `U.S. OSHA` appearing beside `Oregon OSHA` on the 300A, and `Oregon OSHA` against the federal
// DOL string on two different passes. An audit is scoped by that label
// (`lib/audit.ts` compares it exactly), so a split vocabulary silently splits the evidence. A person
// must be able to say "these are the same regulator" once, and have everything follow.
//
// *** IT WRITES CORRECTIONS, NOT A MASS UPDATE. *** One `document_corrections` row per document
// carrying the label, which is exactly what `app/api/document-actions/route.ts`'s `correct` branch
// writes for one document — same table, same four columns, same `supabaseAdmin` for the reason that
// route gives: migration 045 grants `authenticated` SELECT and no INSERT, because a correction
// outranks the model on this customer's screen. `document_index_v` applies them
// (`coalesce(c_ag.new_value, s.agencies, …)`, migration 045), so every prompt that reads labels sees
// the merged vocabulary from the next read on, and the scans themselves are untouched.
//
// *** WHY IT IS ONE SERVER CALL AND NOT N CLIENT CALLS THROUGH THAT ROUTE. *** The brief said to go
// through the same route. `document-actions` takes one `document_id` per request, so a twelve-document
// merge would be twelve requests from a browser, and a browser closed at request seven leaves a
// vocabulary half-merged with no record of intent. The WRITE here is that route's write; what differs
// is that it either happens for every document or is reported as partial with the count.
//
// *** A PAST AUDIT KEEPS THE OLD STRING. *** `audit_runs.agency_label` and the findings under it are
// not touched. A report says what it said on the day; rewriting it to match today's vocabulary would
// make the archive a moving target, and §3.2's rule about versioned rows is the same instinct.

import { NextResponse, type NextRequest } from 'next/server'

import { requireCompany, supabaseAdmin } from '@/lib/auth'

const KINDS = ['agency', 'subject'] as const
/** `document_index_v`'s column, and `document_corrections.field`, per kind. */
const FIELD: Record<string, 'agencies' | 'subjects'> = { agency: 'agencies', subject: 'subjects' }

export async function PATCH(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const kind = String(body?.kind ?? '')
    const label = String(body?.label ?? '').trim()
    const action = String(body?.action ?? '')
    const to = String(body?.to ?? '').trim()

    if (!KINDS.includes(kind as 'agency' | 'subject')) {
      return NextResponse.json({ error: 'A label is an agency or a subject.' }, { status: 400 })
    }
    if (!label || !to) {
      return NextResponse.json({ error: 'Say which label, and what it becomes.' }, { status: 400 })
    }
    if (!['rename', 'merge'].includes(action)) {
      return NextResponse.json({ error: 'Expected rename or merge.' }, { status: 400 })
    }
    if (to === label) {
      return NextResponse.json({ error: 'That is the name it already has.' }, { status: 400 })
    }
    if (to.length > 200) {
      return NextResponse.json({ error: 'That name is too long.' }, { status: 400 })
    }

    // Ownership through the caller's own client: the label has to be one this company holds, and a
    // label it does not hold is simply not there.
    const { data: row } = await db.from('company_labels')
      .select('id, label').eq('company_id', companyId).eq('kind', kind).eq('label', label).maybeSingle()
    if (!row) return NextResponse.json({ error: 'That name is not one of yours.' }, { status: 404 })

    // A merge must land on a label the company actually holds. A rename may invent a new string —
    // that is what renaming is — but a merge that names a label nobody uses is a rename with the
    // wrong word, and would leave the vocabulary in a state the person did not ask for.
    if (action === 'merge') {
      const { data: target } = await db.from('company_labels')
        .select('id').eq('company_id', companyId).eq('kind', kind).eq('label', to).maybeSingle()
      if (!target) {
        return NextResponse.json({ error: `"${to}" is not one of your ${kind} names.` }, { status: 400 })
      }
    }

    const field = FIELD[kind]
    // The list AS IT STANDS — corrections already applied — because `old_value` has to be what this
    // replaces. Reading the scan's own array instead would record a correction against a value the
    // page has not shown since the last correction.
    // Both columns named literally, not interpolated: `scripts/check-schema-contracts.js` validates
    // a select string against the generated types and cannot see into a template literal — it read
    // `${field}` as a column called "field" and refused this file. Naming both is also cheaper to
    // read than a computed select.
    const { data: docs, error: dErr } = await db.from('document_index_v')
      .select('document_id, agencies, subjects').eq('company_id', companyId)
    if (dErr) throw new Error(`reading the documents: ${dErr.message}`)

    const carrying = ((docs ?? []) as unknown as Array<Record<string, unknown>>)
      .filter((d) => Array.isArray(d[field]) && (d[field] as string[]).includes(label))

    const reason = action === 'merge'
      ? `merged into ${to} by a person`
      : 'renamed by a person'

    let written = 0
    for (const d of carrying) {
      const before = (d[field] as string[])
      // Replace in place, and DEDUPE: a document carrying both `U.S. OSHA` and `Oregon OSHA` must
      // not end up with `Oregon OSHA` twice, which is how a merge creates the mess it was cleaning.
      const after = [...new Set(before.map((x) => (x === label ? to : x)))]
      const { error } = await supabaseAdmin.from('document_corrections').insert({
        document_id: d.document_id as string, company_id: companyId, field,
        old_value: before, new_value: after,
        reason, created_by: userId,
      })
      if (error) {
        // Partial, and said so. The corrections already written stand — they are each a true
        // record of an intended change — and the label row is left alone so the person can see
        // the old name still there and try again.
        return NextResponse.json({
          error: `We changed ${written} of ${carrying.length} documents and then hit a problem: `
            + `${error.message}. The name is unchanged; try again and we will finish the rest.`,
          written, of: carrying.length,
        }, { status: 500 })
      }
      written++
    }

    // The vocabulary row itself. For a merge the old name simply goes; for a rename the new one
    // takes its place. The HISTORY is the correction rows on the documents, which is why nothing
    // needs to be kept here — `company_labels` is a list of names in use, not a record of names
    // once used.
    const { error: delErr } = await supabaseAdmin.from('company_labels').delete().eq('id', row.id)
    if (delErr) throw new Error(`removing the old name: ${delErr.message}`)

    if (action === 'rename') {
      const { error: insErr } = await supabaseAdmin.from('company_labels')
        .upsert({ company_id: companyId, kind, label: to }, { onConflict: 'company_id,kind,label' })
      if (insErr) throw new Error(`adding the new name: ${insErr.message}`)
    }

    return NextResponse.json({ ok: true, documents: written, label: to, action })
  } catch (error) {
    console.error('company-labels PATCH:', error)
    return NextResponse.json({ error: 'We could not change that name just now.' }, { status: 500 })
  }
}

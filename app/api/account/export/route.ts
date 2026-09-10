// GET /api/account/export
//
// Hands the signed-in user a single JSON file containing everything their company
// has in CompliBoard. This exists for two reasons: a customer asking "what do you
// hold on us?" deserves a straight answer, and a customer about to delete their
// account should be able to take their records with them first.
//
// Scope is decided entirely by the session, via requireCompany() — there is no
// parameter for whose data to export, so there is nothing to tamper with. Every
// query below is filtered by that one company_id, either directly or through a
// parent row that was itself filtered by it.
//
// Deliberately NOT included: any other company's rows, profiles belonging to people
// outside this company, anything from the auth schema (passwords, tokens, sessions),
// and any key or secret. File CONTENTS are not embedded either — see the note on the
// documents section below.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

// Turns "Test Alpha Chemical" into "test-alpha-chemical" so it is safe in a filename
// on every operating system.
function slugify(name: string): string {
  return (name || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'company'
}

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId } = authed.auth

    // --- The company itself -------------------------------------------------
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // --- Everything scoped directly by company_id ---------------------------
    const byCompany = async (table: string) => {
      const { data } = await supabaseAdmin.from(table).select('*').eq('company_id', companyId)
      return data || []
    }

    const [
      documents,
      companyFolders,
      documentReviews,
      audits,
      hrAudits,
      checklists,
      calendarEvents,
      obligations,
      entities,
      corrections,
      companyTemplates,
    ] = await Promise.all([
      byCompany('documents'),
      byCompany('company_folders'),
      byCompany('document_reviews'),
      byCompany('audits'),
      byCompany('hr_audits'),
      byCompany('checklists'),
      byCompany('calendar_events'),
      byCompany('obligations'),
      byCompany('entities'),
      byCompany('corrections'),
      byCompany('company_templates'),
    ])

    // Profiles: this company's people only. Names and ids, nothing from auth —
    // no email, no password hash, no session token. Those live in a schema this
    // export never reads.
    const { data: profilesRaw } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, full_name, created_at')
      .eq('company_id', companyId)
    const profiles = profilesRaw || []

    // --- Children reached through a parent we already filtered --------------
    const checklistIds = checklists.map((c: { id: string }) => c.id)
    const { data: checklistItemsRaw } = checklistIds.length
      ? await supabaseAdmin.from('checklist_items').select('*').in('checklist_id', checklistIds)
      : { data: [] }
    const checklistItems = checklistItemsRaw || []

    const obligationIds = obligations.map((o: { id: string }) => o.id)
    const { data: obligationEvidenceRaw } = obligationIds.length
      ? await supabaseAdmin.from('obligation_evidence').select('*').in('obligation_id', obligationIds)
      : { data: [] }
    const obligationEvidence = obligationEvidenceRaw || []

    // --- Documents: describe the files, do not embed them -------------------
    // A compliance library can run to hundreds of megabytes of PDFs. Putting them
    // in a JSON file would make it unopenable and would not help anyone. What is
    // listed here is enough to identify each file and find it again.
    const folderNameById = new Map(
      companyFolders.map((f: { id: string; name: string }) => [f.id, f.name])
    )
    const files = documents.map((d: {
      id: string; name: string; folder_id: string | null; file_type: string
      file_size: number | null; uploaded_at: string | null; file_url: string
      is_recurring: boolean | null; recurrence_period: string | null
    }) => ({
      id: d.id,
      name: d.name,
      folder: d.folder_id ? folderNameById.get(d.folder_id) ?? null : null,
      file_type: d.file_type,
      file_size_bytes: d.file_size,
      uploaded_at: d.uploaded_at,
      storage_path: d.file_url,
      is_recurring: d.is_recurring,
      recurrence_period: d.recurrence_period,
    }))

    const exportedAt = new Date().toISOString()
    const datePart = exportedAt.slice(0, 10)
    const filename = `compliboard-export-${slugify(company.name)}-${datePart}.json`

    const payload = {
      exported_at: exportedAt,

      note:
        "This file contains your company's compliance records held in CompliBoard, " +
        "exported on " + datePart + " at your request. It includes your company profile, " +
        "the people on your account, your uploaded document records, document reviews, " +
        "audits, HR handbook audits, checklists and their items, calendar events, your " +
        "compliance obligations and the evidence linked to them, your entities, any " +
        "corrections you reported, and your saved audit templates. " +
        "It does NOT contain the uploaded files themselves — only a description of each " +
        "one, including where it is stored. Download those separately from Company " +
        "Documents before deleting your account, because deleting the account deletes " +
        "the files too. " +
        "It also does not contain any password, login token, or anything belonging to " +
        "another company. " +
        "Keep this file somewhere safe: it is a record of your compliance position and " +
        "may contain details you would not want to share publicly.",

      company,
      profiles,

      documents: {
        note:
          "Descriptions only. The files themselves must be downloaded separately from " +
          "Company Documents — they are not embedded in this export.",
        count: files.length,
        items: files,
      },

      company_folders: companyFolders,
      document_reviews: documentReviews,
      audits,
      hr_audits: hrAudits,
      checklists,
      checklist_items: checklistItems,
      calendar_events: calendarEvents,
      obligations,
      obligation_evidence: obligationEvidence,
      entities,
      corrections,
      company_templates: companyTemplates,

      export_summary: {
        requested_by_user_id: userId,
        company_id: companyId,
        row_counts: {
          profiles: profiles.length,
          documents: files.length,
          company_folders: companyFolders.length,
          document_reviews: documentReviews.length,
          audits: audits.length,
          hr_audits: hrAudits.length,
          checklists: checklists.length,
          checklist_items: checklistItems.length,
          calendar_events: calendarEvents.length,
          obligations: obligations.length,
          obligation_evidence: obligationEvidence.length,
          entities: entities.length,
          corrections: corrections.length,
          company_templates: companyTemplates.length,
        },
      },
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Account export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build export' },
      { status: 500 }
    )
  }
}

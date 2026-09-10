// Account settings: read the company profile, change it, or delete the whole account.
//
// Every handler derives who is asking from the verified session token via
// requireCompany(), never from a parameter. The previous version took user_id straight
// off the URL with no token check at all, which meant anyone who knew or guessed a user
// id could read that account, rewrite its company details, or — through DELETE —
// destroy the entire company: every checklist, document, calendar event, the company
// record and the login. It was a single unauthenticated request.
//
// TWO CLIENTS, AND WHICH IS USED WHERE (§0.9)
//
//   authed.db      — the caller's own client, under RLS. Used by GET and PUT. The
//                    database enforces tenancy alongside the checks here rather than
//                    taking the route's word for it.
//
//   supabaseAdmin  — bypasses RLS. Used by DELETE only, and only because it must:
//                      * auth.admin.deleteUser() removes logins. No user token can do
//                        that at any privilege level — it is an admin API, not a table.
//                      * it deletes rows for EVERY member of the company, and reads
//                        profiles by company_id to find them. That part would work under
//                        RLS since migration 005, but the deleteUser calls would not, so
//                        splitting the handler across two clients would buy nothing and
//                        make the destructive path harder to read.
//                      * it removes the company's storage files, then the company row
//                        itself — and there is deliberately no DELETE policy on companies.
//
// A route may hold the admin client for a named reason. This is the reason.
// See CLAUDE.md §3.6, and app/api/documents/route.ts for the converted pattern.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

const BUCKET = 'company-documents'

// GET returns the signed-in user's own company and their own display name.
// There is no user_id parameter any more: you get your account, and only yours.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const { data: profile } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()

    const { data: company } = await db
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    return NextResponse.json({ data: { ...company, full_name: profile?.full_name ?? null } })
  } catch (error) {
    console.error('Account fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

// PUT updates the caller's own company and their own name.
//
// Any user_id or company_id in the body is ignored. Previously the body decided which
// company got rewritten, so a caller could edit any company's details by naming a user
// who belonged to it.
export async function PUT(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json()
    const { full_name, companyName, industry, state, county, city, employeeCount } = body

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    const { error: companyError } = await db
      .from('companies')
      .update({
        name: companyName,
        industry,
        state,
        county,
        city,
        employee_count: employeeCount,
      })
      .eq('id', companyId)

    if (companyError) throw companyError

    const { error: profileError } = await db
      .from('profiles')
      .update({ full_name })
      .eq('id', userId)

    if (profileError) throw profileError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Account update error:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

// Lists every stored object under one company's prefix.
//
// Supabase Storage lists one directory at a time, so this walks the two levels the
// upload sites actually create: <company_id>/<folder>/<file>. Anything returned with a
// null id is a directory rather than a file.
async function listCompanyObjects(companyId: string): Promise<string[]> {
  const paths: string[] = []

  const { data: level1 } = await supabaseAdmin.storage.from(BUCKET).list(companyId, { limit: 1000 })
  for (const entry of level1 || []) {
    if (entry.id) {
      paths.push(`${companyId}/${entry.name}`)
      continue
    }
    const { data: level2 } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(`${companyId}/${entry.name}`, { limit: 1000 })
    for (const file of level2 || []) {
      if (file.id) paths.push(`${companyId}/${entry.name}/${file.name}`)
    }
  }

  return paths
}

// DELETE destroys the caller's company and everything belonging to it.
//
// Three things guard it. The session must be valid. The company is derived from the
// session, never supplied. And the body must carry `confirmation` matching the company's
// own name exactly — a mismatch returns 400 and nothing is touched, so a stray request
// cannot delete an account by accident.
//
// Rows are removed child-first rather than relying on cascades, because two foreign keys
// into companies (profiles and hr_audits) have no ON DELETE action and would otherwise
// block the delete part-way through, leaving the account half-destroyed.
//
// Stored files are removed too. Previously they were left behind: deleting a company
// orphaned its files in the bucket forever, which is both a storage leak and, for a
// customer who asked to be deleted, a promise not kept.
export async function DELETE(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId } = authed.auth

    let confirmation: string | undefined
    try {
      const body = await request.json()
      confirmation = body?.confirmation
    } catch {
      confirmation = undefined
    }

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    if (!confirmation || confirmation.trim() !== company.name) {
      return NextResponse.json(
        {
          error:
            'To delete this account, send the company name exactly as it appears on your ' +
            'profile in the "confirmation" field. Nothing has been deleted.',
        },
        { status: 400 }
      )
    }

    // Everyone on this company's account. Deleting the company necessarily removes
    // all of them — there is no company left for a colleague to belong to.
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
    const userIds = (profiles || []).map((p: { id: string }) => p.id)

    // 1. Stored files first. If this fails we stop, because a customer who asked to be
    //    deleted should not be left with their files in the bucket and their records gone.
    const objectPaths = await listCompanyObjects(companyId)
    if (objectPaths.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove(objectPaths)
      if (removeError) throw removeError
    }

    // 2. Rows, children before parents.
    const { data: checklists } = await supabaseAdmin
      .from('checklists').select('id').eq('company_id', companyId)
    const checklistIds = (checklists || []).map((c: { id: string }) => c.id)
    if (checklistIds.length) {
      await supabaseAdmin.from('checklist_items').delete().in('checklist_id', checklistIds)
    }

    const { data: obligations } = await supabaseAdmin
      .from('obligations').select('id').eq('company_id', companyId)
    const obligationIds = (obligations || []).map((o: { id: string }) => o.id)
    if (obligationIds.length) {
      await supabaseAdmin.from('obligation_evidence').delete().in('obligation_id', obligationIds)
    }

    for (const table of [
      'checklists',
      'corrections',
      'obligations',
      'entities',
      'document_reviews',
      'audits',
      'company_templates',
      'hr_audits',
      'calendar_events',
      'documents',
      'company_folders',
      'profiles',
    ]) {
      const { error } = await supabaseAdmin.from(table).delete().eq('company_id', companyId)
      if (error) throw new Error(`Failed clearing ${table}: ${error.message}`)
    }

    const { error: companyError } = await supabaseAdmin
      .from('companies').delete().eq('id', companyId)
    if (companyError) throw companyError

    // 3. Logins last, so a failure above leaves the account still reachable.
    for (const id of userIds) {
      await supabaseAdmin.auth.admin.deleteUser(id)
    }

    return NextResponse.json({
      success: true,
      deleted: {
        company: company.name,
        users: userIds.length,
        files: objectPaths.length,
      },
    })
  } catch (error) {
    console.error('Account delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete account' },
      { status: 500 }
    )
  }
}

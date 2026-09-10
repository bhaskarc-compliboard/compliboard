// Saves and lists HR handbook audit results.
//
// CONVERTED OFF THE SERVICE-ROLE KEY (§0.9). Every query runs through `authed.db`, which
// acts as the caller under RLS, so the database enforces tenancy alongside these checks.
//
// hr_audits had RLS enabled and NO policies at all until migration 004 — which denies
// everyone — so this route had no choice but to use the key that ignores them. It is
// convertible now because 004 gave the table its four policies. It previously took companyId and userId from the request
// body and company_id from a query parameter, and never checked a session — so a caller
// could write audit rows into any company, read any company's audit history, and delete
// any row by id. Reference: app/api/documents/route.ts.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'

// A handbook audit reads real content and can occasionally run long.
export const maxDuration = 800

// POST records the result of an audit against one of this company's handbooks.
//
// The caller sends the document id, not a file path or a name. The row is looked up,
// checked against the session's company, and the stored path and name are taken from
// it — so a saved audit can never point at a file the company does not own.
export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json()
    const { documentId, present, missing, draftPolicies } = body

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    const { data: doc } = await db
      .from('documents')
      .select('id, name, file_url, company_id')
      .eq('id', documentId)
      .single()

    // 404 rather than 403, so the endpoint cannot be used to discover which ids exist.
    if (!doc || doc.company_id !== companyId) {
      return NextResponse.json({ error: 'Handbook not found' }, { status: 404 })
    }

    const { data, error } = await db
      .from('hr_audits')
      .insert({
        company_id: companyId,
        user_id: userId,
        handbook_name: doc.name || 'Handbook',
        handbook_file_url: doc.file_url,
        present: present || [],
        missing: missing || [],
        draft_policies: draftPolicies || [],
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('hr-audits save failed:', error)
    return NextResponse.json({ error: 'Failed to save audit' }, { status: 500 })
  }
}

// GET lists this company's saved handbook audits. The company_id parameter is gone.
export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { data, error } = await db
      .from('hr_audits')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error) {
    console.error('hr-audits list failed:', error)
    return NextResponse.json({ error: 'Failed to load audits' }, { status: 500 })
  }
}

// DELETE removes one saved audit, after confirming it belongs to the caller's company.
export async function DELETE(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: audit } = await db
      .from('hr_audits')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!audit || audit.company_id !== companyId) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    const { error } = await db
      .from('hr_audits').delete().eq('id', id).eq('company_id', companyId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('hr-audits delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete audit' }, { status: 500 })
  }
}

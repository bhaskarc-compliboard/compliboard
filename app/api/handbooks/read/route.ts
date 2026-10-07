// "READ IT AGAIN" — HR Step 5b (owner, 7 October 2026). POST { id }: starts a reading of a handbook that is
// 'could_not_read' or 'uploaded', through the same claim as a save (`lib/handbookStart.ts`). Never for one
// that is 'read' (nothing to do) or 'reading' (one at a time; a reading stuck past ten minutes may be taken).
//
// The pattern is app/api/handbooks/route.ts: the preview switch first, requireCompany(), the caller's own
// client, and 404 — not 403 — for an id that is not this company's.
import { NextRequest, NextResponse, connection } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { hrPreviewOn } from '@/lib/hrPreview'
import { startReading } from '@/lib/handbookStart'

// The reading runs after the reply, up to this long (Vercel `waitUntil`); copied from the summarise route.
export const maxDuration = 800

export async function POST(request: NextRequest) {
  await connection()
  if (!hrPreviewOn()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { id } = await request.json().catch(() => ({}))
    if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { data: row } = await db.from('handbooks').select('id, company_id, status').eq('id', id).maybeSingle()
    if (!row || row.company_id !== companyId) return NextResponse.json({ error: 'Handbook not found' }, { status: 404 })
    if (row.status === 'read') return NextResponse.json({ error: 'Already read' }, { status: 409 })

    const started = await startReading(db, companyId, id)
    return started
      ? NextResponse.json({ status: 'started' }, { status: 202 })
      : NextResponse.json({ error: 'Already being read' }, { status: 409 })
  } catch (error) {
    console.error('handbooks read failed:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to start reading' }, { status: 500 })
  }
}

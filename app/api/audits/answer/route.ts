// THE AUDITS CHAT'S ANSWER — `docs/GAPS-PLAN.md` Part A step 6b (decisions 31–34, 41).
//
// *** THE ROUTE IS A LOOP. *** `app/api/documents/answer/route.ts` with one word changed: the brief.
// Everything that decides anything is in the shared engine (`lib/ask/engine.ts`) and in
// `lib/ask/auditsBrief.ts` — the topic rules, the audits, the findings, the index and the readings the question is
// answered from, the prompt, the stream, the quote check at done, the turn, the ledger. This file
// does the session, the body and the status code.
//
// The wire format is the workspace's and HR's, byte for byte, because `lib/answerStream.ts` reads
// it on the page: NDJSON, one event a line, `done` carrying `research` rather than `text`. `offers`
// is on the line because the shared screen taps it there, and **this section has one**:
// `run_audit` (decision 41). The model proposes it; `app/audits/page.tsx` checks the payload
// against the company's own agency labels and starts the run in code. Nothing here decides it.
//
// *** NOT CLAIM + after(). *** The person is watching the words arrive, so the work is in the
// request with `maxDuration` long enough for it. The claim belongs to the summary, which has its
// own route.
import { NextRequest, NextResponse, connection } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { answer, FAILED_LINE } from '@/lib/ask/engine'
import { auditsBrief } from '@/lib/ask/auditsBrief'
import type { AskSource } from '@/lib/ask/passages'

import { requireAccess } from '@/lib/requireAccess'
export const maxDuration = 800

export async function POST(request: NextRequest) {
  await connection()
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    // Decision 11: after the trial, or after the grace, this company may read and
    // download everything and spend nothing. 402 with one plain sentence.
    const paused = await requireAccess(authed.auth)
    if (paused) return paused
    const { companyId, db } = authed.auth

    const body = await request.json().catch(() => ({}))
    const question = String(body?.question ?? '').trim()
    const topicId = typeof body?.topicId === 'string' ? body.topicId : null
    const history = Array.isArray(body?.history) ? body.history : []
    // The file the person attached in the chat, by id. The engine loads it as the caller, so RLS
    // decides whether it is theirs; nothing about a document is decided here.
    const documentId = typeof body?.documentId === 'string' ? body.documentId : null
    if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'))
        try {
          for await (const ev of answer(auditsBrief, {
            db, admin: supabaseAdmin, companyId, question, topicId, documentId,
            history: history as Array<{ question?: string; answer?: string; sources?: AskSource[] }>,
            signal: request.signal,
          })) {
            if (ev.type === 'done') {
              // `research`, not `text`: `lib/answerStream.ts` has read that name since Run 2 and
              // the workspace, HR, the Calendar and this page all go through it.
              send({ type: 'done', research: ev.text, sources: ev.sources, offers: ev.offers, topicId: ev.topicId })
            } else if (ev.type === 'refused') {
              // The engine refused before any model call — a conversation that is not this
              // company's, this section's, or open. The status is carried in the line because the
              // headers are already sent.
              send({ type: 'refused', status: ev.status, message: ev.message })
            } else if (ev.type === 'context') {
              // What the answer is being written from, for the page's first stage. No row of it.
              send({ type: 'context', blocks: ev.blocks, tokens: ev.tokens })
            } else {
              send(ev)
            }
          }
        } catch (err) {
          const aborted = request.signal.aborted || (err as { name?: string })?.name === 'AbortError'
          if (!aborted) { console.error('audits answer: stream failed:', err); send({ type: 'error', message: FAILED_LINE }) }
          else console.log('audits answer: stopped by the person')
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
    })
  } catch (error) {
    console.error('audits answer failed:', error)
    return NextResponse.json({ error: FAILED_LINE }, { status: 500 })
  }
}

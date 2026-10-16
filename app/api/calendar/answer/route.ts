// THE CALENDAR'S ANSWER — Calendar step 10b (`docs/CALENDAR-PLAN.md` step 10; decision 4).
//
// *** THE ROUTE IS A LOOP. *** Everything that decides anything is in the shared engine
// (`lib/ask/engine.ts`, step 10a): the topic rules, what the question is answered from, the
// prompt, the stream, the check at done, the turn, the ledger. This file does the session, the
// body and the status code — which is what `app/api/calendar/route.ts` already says about itself.
//
// The wire format is the workspace's and HR's, byte for byte, because `lib/answerStream.ts` reads
// it on the page: NDJSON, one event a line, `done` carrying `research` rather than `text`. The one
// field this section adds is `offers`, which the page taps out of the same line (HR taps
// `reading` and `waiting` the same way).
//
// *** NOT CLAIM + after(). *** The person is watching the words arrive, so the work is in the
// request with `maxDuration` long enough for it — `app/api/hr/answer/route.ts`'s shape, and the
// reasoning is in `lib/ask/engine.ts`. The claim belongs to the summary, which has its own route.
import { NextRequest, NextResponse, connection } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { answer, FAILED_LINE } from '@/lib/ask/engine'
import { calendarBrief } from '@/lib/ask/calendarBrief'
import type { AskSource } from '@/lib/ask/passages'

export const maxDuration = 800

export async function POST(request: NextRequest) {
  await connection()
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const body = await request.json().catch(() => ({}))
    const question = String(body?.question ?? '').trim()
    const topicId = typeof body?.topicId === 'string' ? body.topicId : null
    const history = Array.isArray(body?.history) ? body.history : []
    if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'))
        try {
          for await (const ev of answer(calendarBrief, {
            db, admin: supabaseAdmin, companyId, question, topicId,
            history: history as Array<{ question?: string; answer?: string; sources?: AskSource[] }>,
            signal: request.signal,
          })) {
            if (ev.type === 'done') {
              // `research`, not `text`: `lib/answerStream.ts` has read that name since Run 2 and
              // the workspace, HR and this page all go through it.
              send({ type: 'done', research: ev.text, sources: ev.sources, offers: ev.offers, topicId: ev.topicId })
            } else if (ev.type === 'refused') {
              // The engine refused before any model call — a conversation that is not this
              // company's, this section's, or open. The page shows the sentence; the status is
              // carried in the line because the headers are already sent.
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
          if (!aborted) { console.error('calendar answer: stream failed:', err); send({ type: 'error', message: FAILED_LINE }) }
          else console.log('calendar answer: stopped by the person')
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
    })
  } catch (error) {
    console.error('calendar answer failed:', error)
    return NextResponse.json({ error: FAILED_LINE }, { status: 500 })
  }
}

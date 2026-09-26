/**
 * THE SWEEP — reads the documents a folder upload left queued. Documents Run 7.
 *
 * The vision's "few versus many": three files or fewer are read in the page while somebody
 * watches; a folder of thirty cannot run in a request, so the files land as `uploaded` and this
 * picks them up. It is the research section's pattern, not a worker — Vercel Cron hitting a
 * protected route, one `job_runs` row per run with counts and per-item errors, one failure never
 * stopping the sweep. `CLAUDE.md` §4's always-on worker does not exist and rev 1 does not need it.
 *
 * ---------------------------------------------------------------------------
 * THE FIVE RULES, STATED BEFORE THE CODE
 *
 * 1. **ONE COMPANY AT A TIME, AND ITS DOCUMENTS ONE AFTER ANOTHER.** Not for rate limits — for
 *    correctness. Every scan is built from `buildScanContext`, which feeds the previous
 *    readings forward: the agency and subject labels already in use, the fact keys already in
 *    use, what the company already holds, what it has confirmed, what it has corrected. Two of
 *    one company's documents read in parallel are two scans that cannot see each other, and the
 *    result is the thing the label list exists to prevent — "Oregon DEQ" and "Department of
 *    Environmental Quality" as two groups on one screen. Run 6 measured the same failure on
 *    fact keys: five names for one address.
 *
 * 2. **A COMPANY IS CLAIMED, NOT JUST A DOCUMENT.** The cadence is every five minutes and a run
 *    may last longer than that, so two sweeps can be alive at once. Claiming document by
 *    document would let two runs interleave one company's files and undo rule 1. So the run
 *    takes a company's whole queue in a single compare-and-set on `reading_since`, and a second
 *    run then sees nothing unclaimed for that company and moves on. The claim is deliberately
 *    NOT the status: the status is what the page shows, and eight rows saying "Reading…" while
 *    one of them is being read would be the product describing work that is not happening.
 *
 * 3. **STUCK ROWS ARE RECOVERED AT THE TOP OF EVERY RUN.** A function killed mid-scan leaves
 *    rows saying `reading` for ever, and a row that lies about being in progress is worse than
 *    one that admits it is waiting. Anything claimed longer ago than `STUCK_AFTER_MS` and still
 *    unread has its claim released. Guarded on the claim still being old, so a run that picked
 *    the row up between the SELECT and the UPDATE is not robbed of it (`CLAUDE.md` §4).
 *
 * 4. **ONE DOCUMENT FAILING MUST NOT STOP THE SWEEP.** Every document is its own try/catch and
 *    its own entry in `job_runs.errors`. A run that read 29 of 30 is a successful run with one
 *    recorded error, not a failed sweep — the summariser's rule 2, and the same reasoning.
 *
 * 5. **IT STOPS BEFORE THE FUNCTION DOES.** A scan is 20 to 120 seconds. The run stops STARTING
 *    documents once there is not comfortably room for another, and leaves the rest queued for
 *    the next run — five minutes away. A sweep killed by the platform mid-scan is rule 3's
 *    problem on the next run; a sweep that stops on purpose is not a problem at all.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { supabaseAdmin } from '@/lib/auth'
import { runDocumentScan, saveScan, buildScanContext, failedScan } from '@/lib/documentScan'
import { summariseBatch, notifyBatch } from '@/lib/documentBatch'

/**
 * The platform ceiling for this function. The same 800 the summariser and the scan route use —
 * Vercel Pro with fluid compute. Everything below is measured against it.
 */
export const maxDuration = 800

/**
 * *** THE TIME BUDGET, AND WHY IT IS NOT 800. ***
 *
 * Stop starting new documents at 640 seconds, leaving 160 — comfortably more than the slowest
 * scan measured on the golden fixtures (117s, 01-eap-chemical through a cold route) — so the
 * document in flight when the budget runs out still finishes, is saved, and its batch is
 * updated. A run that is killed mid-scan costs a whole scan's money for nothing and leaves a
 * row in `reading` for rule 3 to clean up five minutes later.
 */
const BUDGET_MS = 640_000
/** Do not start a document unless this much of the budget remains. */
const RESERVE_MS = 130_000

/**
 * A document claimed longer ago than this and still unread is presumed abandoned. Comfortably
 * longer than the whole function can live (800s), so a running sweep is never robbed of a
 * document it is in the middle of.
 */
const STUCK_AFTER_MS = 900_000

const BUCKET = 'company-documents'

interface QueuedDoc {
  id: string; company_id: string; name: string; file_url: string
  file_type: string | null; entity_id: string | null; batch_id: string | null
  uploaded_at: string
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  return sweep(new URL(request.url).origin)
}

/**
 * The sweep itself, callable without a request.
 *
 * `/api/document-batches` calls it through `after()` from `next/server` when an upload lands, so
 * the first documents of a folder are read within seconds rather than waiting for the next cron
 * tick. It is the same function either way — a second code path for "the urgent case" would be
 * a second thing to keep correct.
 */
export async function sweep(appUrl: string) {
  const startedAt = Date.now()
  const run = await startJobRun(supabaseAdmin, 'scan_documents')
  const errors: Array<{ document: string; error: string }> = []
  let recovered = 0, read = 0, couldNotRead = 0, companies = 0, batchesFinished = 0, notified = 0
  // WHAT WENT OUT, ON THE RUN'S OWN ROW. `job_runs` answers "did it run and what did it touch"
  // (§116's release gate), and an email is the most consequential thing this job does — the one
  // action a customer sees. The provider's id is the only thing that can settle "did it arrive"
  // with Resend weeks later, so it is recorded rather than logged and lost.
  const sent: Array<{ batch: string; to: string; id: string | null; error?: string }> = []
  let stoppedForTime = false

  try {
    // ---- RULE 3: recover anything abandoned, before anything else ----
    const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS).toISOString()
    const { data: stuck } = await supabaseAdmin.from('documents')
      .select('id').in('status', ['uploaded', 'reading']).lt('reading_since', stuckBefore)
    for (const d of (stuck ?? []) as Array<{ id: string }>) {
      // Guarded on the claim still being old, so a run that picked the row up between the
      // SELECT and the UPDATE is not robbed of it (`CLAUDE.md` §4).
      const { data: back } = await supabaseAdmin.from('documents')
        .update({ status: 'uploaded', reading_since: null })
        .eq('id', d.id).lt('reading_since', stuckBefore).select('id')
      if (back?.length) recovered++
    }

    // ---- the queue, oldest first ----
    for (;;) {
      if (Date.now() - startedAt > BUDGET_MS - RESERVE_MS) { stoppedForTime = true; break }

      // RULE 1: the oldest queued document decides which company is next, so a folder that
      // landed at nine is finished before one that landed at ten.
      const { data: next } = await supabaseAdmin.from('documents')
        .select('company_id').eq('status', 'uploaded').is('reading_since', null)
        .order('uploaded_at', { ascending: true }).limit(1).maybeSingle()
      if (!next) break
      const companyId = next.company_id as string

      // RULE 2: claim the whole company's queue in one statement. A second run overlapping this
      // one now sees nothing unclaimed here and moves to another company, which is what keeps
      // one company's documents strictly one after another across runs as well as within one.
      //
      // *** THE CLAIM IS `reading_since`, NOT `status`, AND THAT IS NOT A DETAIL. ***
      // Writing `status = 'reading'` across the whole queue puts "Reading…" on eight rows when
      // one document is being read and seven are waiting — the product describing work that is
      // not happening. Measured on the first eight-file run: every row went to Reading… at
      // second zero and stayed there for six minutes. The status is what the page shows, so it
      // stays `uploaded` — Queued — until this run actually starts that document. The claim is
      // bookkeeping and lives in a column nobody is shown.
      const { data: claimed } = await supabaseAdmin.from('documents')
        .update({ reading_since: new Date().toISOString() })
        .eq('company_id', companyId).eq('status', 'uploaded').is('reading_since', null)
        .select('id, company_id, name, file_url, file_type, entity_id, batch_id, uploaded_at')
      const queue = ((claimed ?? []) as QueuedDoc[])
        .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))
      if (!queue.length) continue
      companies++

      const { data: company } = await supabaseAdmin.from('companies')
        .select('id, name, industry, city, state').eq('id', companyId).maybeSingle()

      for (const doc of queue) {
        // The budget is checked per document, not per company: a company with forty files must
        // not be able to carry the run past its ceiling.
        if (Date.now() - startedAt > BUDGET_MS - RESERVE_MS) {
          stoppedForTime = true
          // Hand the claim back so the next run picks it up rather than rule 3 waiting out
          // fifteen minutes for it. The status never moved, so the row has been saying Queued
          // all along and goes on saying it — which is what it is.
          await supabaseAdmin.from('documents').update({ reading_since: null }).eq('id', doc.id)
          continue
        }
        // NOW it is being read, and now the row says so. One row at a time says Reading…,
        // because one document at a time is being read.
        await supabaseAdmin.from('documents').update({ status: 'reading' }).eq('id', doc.id)
        try {
          if (!company) throw new Error('the company row could not be read')
          const { data: blob, error: dlError } = await supabaseAdmin.storage.from(BUCKET).download(doc.file_url)
          if (dlError || !blob) {
            // The file is not where its row says it is. That is a product failure and it is
            // said out loud ON THE ROW, as a reading, rather than thrown away as a log line.
            await saveScan(supabaseAdmin, failedScan(
              'We could not fetch the stored file for this document.',
              'Upload it again — the record is here but the file is not.',
            ), { documentId: doc.id, companyId, entityId: doc.entity_id })
            couldNotRead++
            continue
          }

          // *** THE CONTEXT IS REBUILT FOR EVERY DOCUMENT, NEVER HOISTED. *** That is the whole
          // point of reading one company's files in order: document three is scanned knowing the
          // labels and fact keys documents one and two produced. Building it once before the
          // loop would make the ordering pointless — and is exactly the bug Run 2b found in
          // `scripts/scan-document.js`.
          const context = await buildScanContext(supabaseAdmin, company, doc.id)
          const scan = await runDocumentScan({
            buffer: await blob.arrayBuffer(),
            fileName: doc.name,
            fileType: doc.file_type || 'application/pdf',
            companyId,
            context,
          })
          await saveScan(supabaseAdmin, scan, { documentId: doc.id, companyId, entityId: doc.entity_id })
          if (scan.status === 'could_not_read') couldNotRead++; else read++
        } catch (e) {
          // RULE 4. This document failed; the next one still runs.
          errors.push({ document: doc.id, error: e instanceof Error ? e.message : String(e) })
          // *** AND THE REASON GOES ON THE ROW, NOT ONLY IN job_runs. ***
          // Setting the status alone left `could_not_read_reason` null, so the page, the drawer
          // and the batch email all said "Could not read" with nothing after it — §5.1's exact
          // failure, and the one migration 044 and `failedScan` exist to prevent. Found by
          // reading the banner after the injected-throw test rather than by reading the code.
          // The technical detail stays in job_runs above; this is the sentence for a person.
          try {
            await saveScan(supabaseAdmin, failedScan(
              'Something went wrong at our end while reading this one.',
              'Ask for it to be read again — this is usually temporary.',
            ), { documentId: doc.id, companyId, entityId: doc.entity_id })
          } catch {
            // Even the record of the failure failed. The status is the last thing we can say.
            await supabaseAdmin.from('documents').update({ status: 'could_not_read' }).eq('id', doc.id)
          }
          // `could_not_read` rather than back to `uploaded`: a document that threw will throw
          // again, and a row that cycles through the queue for ever is a failure nobody sees.
          // A person can ask for it to be read again.
          couldNotRead++
        } finally {
          // The claim is released whatever happened. `saveScan` has already moved the status to
          // read or could_not_read; if something threw before that, the catch above set it.
          await supabaseAdmin.from('documents').update({ reading_since: null }).eq('id', doc.id)
        }
      }

      // ---- the batches this company's queue belonged to ----
      const batchIds = [...new Set(queue.map((d) => d.batch_id).filter(Boolean))] as string[]
      for (const batchId of batchIds) {
        try {
          const finished = await finishBatchIfDone(batchId, appUrl)
          if (finished.done) batchesFinished++
          if (finished.notified) notified++
          const r = finished.resend as
            { ok?: boolean; id?: string | null; to?: string; error?: string } | undefined
          if (r && (r.id || r.error)) {
            sent.push({ batch: batchId, to: r.to ?? '', id: r.id ?? null, ...(r.error ? { error: r.error } : {}) })
          }
        } catch (e) {
          errors.push({ document: `batch:${batchId}`, error: e instanceof Error ? e.message : String(e) })
        }
      }
    }
  } catch (e) {
    errors.push({ document: '(run)', error: e instanceof Error ? e.message : String(e) })
  }

  const counts = {
    companies, read, could_not_read: couldNotRead, recovered,
    batches_finished: batchesFinished, notified, sent,
    stopped_for_time: stoppedForTime,
    wall_ms: Date.now() - startedAt,
  }
  await run.finish(counts, errors)
  return NextResponse.json({ job: 'scan_documents', run: run.id, ...counts, errors })
}

/**
 * A BATCH IS DONE WHEN NOTHING IN IT IS STILL WAITING — and it is answered exactly once.
 *
 * `notified_at` is the guard, and it is set in the same update as the summary. Two overlapping
 * runs, or a run and the page's live path, must not both decide the batch has just finished:
 * an email that arrives twice reads as a broken product.
 *
 * Exported so the live path can call it when the last of three files returns in the page. The
 * live path differs in exactly one way — no email — and that is a flag, not a second function.
 */
export async function finishBatchIfDone(
  batchId: string, appUrl: string, opts: { email?: boolean } = { email: true },
): Promise<{ done: boolean; notified: boolean; resend?: unknown }> {
  const { data: batch } = await supabaseAdmin.from('document_batches')
    .select('id, company_id, created_by, status, notified_at, file_count').eq('id', batchId).maybeSingle()
  if (!batch || batch.status === 'done') return { done: false, notified: false }

  const { data: docs } = await supabaseAdmin.from('documents')
    .select('id, status').eq('batch_id', batchId)
  const rows = (docs ?? []) as Array<{ id: string; status: string }>
  const settled = rows.filter((d) => d.status === 'read' || d.status === 'could_not_read')
  // Not finished. The count is still worth writing: the page shows "4 of 8 read" from it.
  if (!rows.length || settled.length < rows.length) {
    await supabaseAdmin.from('document_batches')
      .update({ done_count: settled.length, status: settled.length ? 'reading' : 'queued' })
      .eq('id', batchId)
    return { done: false, notified: false }
  }

  const summary = await summariseBatch(supabaseAdmin, batchId)

  // *** THE CLAIM, AND IT IS WHY THE EMAIL CANNOT GO TWICE. *** The status moves to done only
  // from a row that is not done yet; a second caller's update matches nothing and it returns
  // without sending. Done before the email, not after: a send that throws must not leave a
  // batch that looks unfinished for ever and re-sends on the next run.
  const { data: won } = await supabaseAdmin.from('document_batches')
    .update({ status: 'done', done_count: settled.length, summary })
    .eq('id', batchId).neq('status', 'done').select('id')
  if (!won?.length) return { done: false, notified: false }

  if (!opts.email) return { done: true, notified: false }

  // Who to tell. The uploader, by the login they uploaded with.
  let to = ''
  if (batch.created_by) {
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(batch.created_by as string)
    to = user?.user?.email ?? ''
  }
  const { data: company } = await supabaseAdmin.from('companies')
    .select('name').eq('id', batch.company_id).maybeSingle()

  if (!to && !process.env.NOTIFY_TEST_TO) {
    // Nobody to tell. The banner still carries the summary, so the person is not left with
    // nothing — and this is recorded rather than silently skipped.
    return { done: true, notified: false, resend: { skipped: 'no recipient on the uploading login' } }
  }

  const sent = await notifyBatch({ to, companyName: company?.name ?? null, summary, appUrl })
  if (sent.ok) {
    await supabaseAdmin.from('document_batches')
      .update({ notified_at: new Date().toISOString() }).eq('id', batchId)
  }
  return { done: true, notified: sent.ok, resend: sent }
}

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
 * 4a. **`held` IS NOT IN THE QUEUE, AND NOTHING HERE HAS TO KNOW THAT.** The queue is
 *    `status = 'uploaded'` and nothing else, so the documents migration 054 set aside — the 38
 *    that were on production before any of this existed — are skipped by construction rather
 *    than by a rule this file has to remember.
 *
 *    **CORRECTED 28 September 2026.** This paragraph used to end "A person asking for one with
 *    'Read it again' puts it through `/api/document-scan`, which does not consult the queue at
 *    all." That is no longer true and the reason it changed is a defect: running the scan inside
 *    the drawer's request meant closing the drawer killed the reading. `/api/document-rescan` now
 *    sets the document back to `uploaded`, clears `reading_since`, files it in a batch of one and
 *    kicks this sweep with `after()` — so **"Read it again" arrives here like any other queued
 *    document**, including a `held` one, which is how a person asks for one of the 38 to be read.
 *    An explicit request is exactly the thing that should take a document out of `held`.
 *
 * 5. **IT STOPS BEFORE THE FUNCTION DOES.** A scan is 20 to 120 seconds. The run stops STARTING
 *    documents once there is not comfortably room for another, and leaves the rest queued for
 *    the next run — five minutes away. A sweep killed by the platform mid-scan is rule 3's
 *    problem on the next run; a sweep that stops on purpose is not a problem at all.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/jobAuth'
// A ROW ONLY WHEN THERE WAS WORK OR AN ERROR — not one every five minutes saying nothing (`lib/jobRun.ts`).
import { lazyJobRun } from '@/lib/jobRun'
import { supabaseAdmin } from '@/lib/auth'
import { runDocumentScan, saveScan, buildScanContext, failedScan } from '@/lib/documentScan'
import { fileIsMissing, FILE_GONE, STORAGE_UNREACHABLE_FINAL } from '@/lib/storageMiss'
import { mustRow, mustRows } from '@/lib/mustRead'
import { summariseBatch, notifyBatch } from '@/lib/documentBatch'

/**
 * The platform ceiling for this function. The same 800 the summariser and the scan route use —
 * Vercel Pro with fluid compute. Everything below is measured against it.
 */
export const maxDuration = 800

/**
 * *** THE TIME BUDGET, AND WHY IT IS NOT 800. ***
 *
 * The run stops STARTING new documents once `BUDGET_MS - RESERVE_MS` has elapsed — **510 seconds**,
 * leaving 290 of the 800 — which is comfortably more than the slowest scan measured on the golden
 * fixtures (117s, 01-eap-chemical through a cold route). So the document in flight when the budget
 * runs out still finishes, is saved, and its batch is updated. A run that is killed mid-scan costs a
 * whole scan's money for nothing and leaves a row in `reading` for rule 3 to clean up five minutes
 * later.
 *
 * *** CORRECTED 28 SEPTEMBER 2026. *** This paragraph said "Stop starting new documents at 640
 * seconds, leaving 160". Both numbers describe `BUDGET_MS` alone and the code subtracts `RESERVE_MS`
 * from it (lines below, and again per document), so the real figures are 510 and 290. The error was
 * in the SAFE direction — it stops earlier than advertised, never later — which is exactly why
 * nothing caught it: a budget that is more conservative than its comment produces no symptom.
 */
const BUDGET_MS = 640_000
/** Do not start a document unless this much of the budget remains. */
const RESERVE_MS = 130_000

/**
 * *** HOW MANY TIMES THE SWEEP TRIES ONE DOCUMENT — R7, item S1 (migration 084). ***
 *
 * A storage error that is not a 404 put the row back to `uploaded` and moved on, and RULE 1 then
 * picked the globally OLDEST queued document to decide which company is next — which is this one,
 * immediately. The run spun on it until the 510-second budget ended, every five minutes, and no
 * other company's documents were read while it lasted. Nothing recovered, because nothing was
 * broken: every part was doing what it was told.
 *
 * Three, because the first failure is usually weather and the third is usually not. At the limit the
 * document stops being retried and says so on the row, and — the half that matters most — **its
 * batch finishes, so the email goes**.
 */
export const READ_ATTEMPT_LIMIT = 3

// The words after the limit are `STORAGE_UNREACHABLE_FINAL` in `lib/storageMiss.ts`, beside the
// ones for a failure we are still going to retry — one file holds both, so the difference between
// "we will try again" and "press the button" cannot drift.

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
  /** How many times this sweep has started it and not finished (R7, item S1, migration 084). */
  read_attempts: number
}

/**
 * VERCEL CRON CALLS WITH GET — `Authorization: Bearer <CRON_SECRET>` (`lib/cronSecret.ts`). The same
 * job as POST, which stays for a person running it by hand with `x-cron-secret`. Workspace Stage 4 Part 3.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  return sweep()
}

/**
 * The sweep itself, callable without a request.
 *
 * `/api/document-batches` calls it through `after()` from `next/server` when an upload lands, so
 * the first documents of a folder are read within seconds rather than waiting for the next cron
 * tick. It is the same function either way — a second code path for "the urgent case" would be
 * a second thing to keep correct.
 */
export async function sweep() {
  const startedAt = Date.now()
  // Opened when the sweep finds work, before that work; an empty sweep writes no row (`lib/jobRun.ts`).
  const run = lazyJobRun(supabaseAdmin, 'scan_documents')
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
    // *** O6 (fix list §4, PROVED in Job E4): `lt` NEVER MATCHES NULL. ***
    // `app/api/document-scan/route.ts` wrote `status: 'reading'` with no `reading_since`, and this
    // query's `.lt('reading_since', …)` therefore could not see those rows **at all**. A row the
    // platform killed mid-reading said "Reading…" for ever and its batch never finished.
    // That route now writes the timestamp — and this query now also catches a `reading` row with a
    // NULL one, because a path that forgets it again must not be invisible a second time. Such a
    // row is only picked up when it is OLD, measured on `uploaded_at`: a document uploaded in the
    // last stuck-window may legitimately be mid-reading with the claim still in flight.
    const stuck = mustRows<{ id: string }>('the documents that stalled', await supabaseAdmin
      .from('documents')
      .select('id').in('status', ['uploaded', 'reading']).lt('reading_since', stuckBefore))
    const noClaim = mustRows<{ id: string }>('the documents that stalled with no claim',
      await supabaseAdmin.from('documents')
        .select('id').eq('status', 'reading').is('reading_since', null)
        .lt('uploaded_at', stuckBefore))
    const all = [...stuck, ...noClaim.filter((n) => !stuck.some((x) => x.id === n.id))]
    if (all.length) await run.open()
    for (const d of all) {
      /**
       * Guarded on the claim still being old, so a run that picked the row up between the
       * SELECT and the UPDATE is not robbed of it (`CLAUDE.md` §4). The null-claim rows have no
       * claim to guard on, so they are guarded on still saying `reading` — which is the same
       * compare-and-set: a run that has since finished one has moved it off `reading`.
       *
       * *** AND A ROW CLAIMED BUT NEVER STARTED IS FREED TOO — R7, item S2. ***
       *
       * The SELECT above deliberately finds `uploaded` AND `reading` rows with an old claim,
       * because RULE 2 claims a company's whole queue at once and leaves every row at `uploaded`
       * until its turn. But this UPDATE required `.eq('status', 'reading')`, so those rows were
       * found and **never freed**: any run killed mid-company left them saying "Queued" for ever,
       * with a claim no run would ever take. The old code's single guard
       * (`lt('reading_since', stuckBefore)`) did free them, and Job E's O6 fix narrowed it.
       *
       * Two statements, because the two states want different writes: a `reading` row goes back to
       * `uploaded`, and an `uploaded` row only needs its stale claim cleared.
       */
      const put = await supabaseAdmin.from('documents')
        .update({ status: 'uploaded', reading_since: null })
        .eq('id', d.id).eq('status', 'reading').select('id')
      if (put.error) throw new Error(`recovering ${d.id}: ${put.error.message}`)
      if (put.data?.length) { recovered++; continue }
      const freed = await supabaseAdmin.from('documents')
        .update({ reading_since: null })
        .eq('id', d.id).eq('status', 'uploaded').lt('reading_since', stuckBefore).select('id')
      if (freed.error) throw new Error(`freeing the stale claim on ${d.id}: ${freed.error.message}`)
      if (freed.data?.length) recovered++
    }

    // ---- the queue, oldest first ----
    for (;;) {
      if (Date.now() - startedAt > BUDGET_MS - RESERVE_MS) { stoppedForTime = true; break }

      // RULE 1: the oldest queued document decides which company is next, so a folder that
      // landed at nine is finished before one that landed at ten.
      // *** S4 (root R2, Job E4): "NO WORK" AND "THE SWEEP IS BROKEN" LOOKED IDENTICAL. ***
      // Unchecked, a failed read broke the loop and the run finished green with `companies: 0` —
      // and `lib/jobRun.ts` writes NO ROW for a run that found nothing and errored nothing
      // (`recordDecision`), so a sweep broken for days left no trace at all. That silence is the
      // very thing `job_runs` exists to prevent. Thrown, so the catch records one whole row with
      // the error on it.
      const nextRead = await supabaseAdmin.from('documents')
        .select('company_id').eq('status', 'uploaded').is('reading_since', null)
        .order('uploaded_at', { ascending: true }).limit(1).maybeSingle()
      if (nextRead.error) throw new Error(`looking for the next document: ${nextRead.error.message}`)
      const next = nextRead.data
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
      // *** O7 (fix list §4, Job E4): A FAILED CLAIM USED TO `continue` AND RE-SELECT AT ONCE. ***
      // `{ data: claimed }` with no error: a refused update gave an empty list, `continue` ran, and
      // RULE 1 selected **the same company's oldest document** on the very next line — a tight loop
      // hammering the database until the time budget ran out, ~800 seconds of it, with nothing in
      // `job_runs` to say why (the row is only opened once work is found). Now it throws, so the
      // catch records one whole row with the reason on it.
      const queue = (mustRows<QueuedDoc>('the documents this run claimed',
        await supabaseAdmin.from('documents')
          .update({ reading_since: new Date().toISOString() })
          .eq('company_id', companyId).eq('status', 'uploaded').is('reading_since', null)
          .select('id, company_id, name, file_url, file_type, entity_id, batch_id, uploaded_at, read_attempts')))
        .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))
      // An EMPTY claim is a real answer — another run took them — and `continue` is right for it:
      // RULE 1 will then find a different company, or nothing, and break.
      if (!queue.length) continue
      await run.open()   // work found: the row exists before any document is read
      companies++

      /**
       * *** ONE COMPANY'S FAILURE MUST NOT END THE RUN — R7, item S3. ***
       *
       * Everything from here to the end of this company's batches is inside a try. The company
       * read below throws since Job E (rightly: a failed read and a deleted company said the same
       * thing, and only one of them is the customer's own doing) — and that throw reached the
       * SWEEP's catch, so the run ended for every company after this one, with this company's
       * whole queue still claimed.
       *
       * The claim is deliberately NOT released here. RULE 1 picks the globally oldest QUEUED
       * document, so releasing it would hand the same company straight back and the loop would
       * spin on it; left claimed, rule 3 frees it in fifteen minutes and the next sweep starts
       * clean. That is the recovery rule R7 asks for, and `tests/unit/sweepRecovery.test.ts`
       * shows it working.
       */
      try {
        // Checked (E4): with no company row the loop below throws
        // "the company row could not be read" per document, which is right — but a FAILED read and a
        // deleted company said the same thing, and only one of them is the customer's own doing.
        const company = mustRow<{ id: string; name: string; industry: string | null
                                  city: string | null; state: string | null }>('the company',
          await supabaseAdmin.from('companies')
            .select('id, name, industry, city, state').eq('id', companyId).maybeSingle())

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
          //
          // *** AND THE ATTEMPT IS COUNTED HERE — R7, item S1 (migration 084). *** At the claim, not
          // at the failure: a run the platform kills mid-read never reaches a failure handler, and an
          // attempt nobody counted is an attempt that can be repeated for ever.
          const attempts = (doc.read_attempts ?? 0) + 1
          await supabaseAdmin.from('documents')
            .update({ status: 'reading', read_attempts: attempts }).eq('id', doc.id)
          try {
            if (!company) throw new Error('the company row could not be read')
            const { data: blob, error: dlError } = await supabaseAdmin.storage.from(BUCKET).download(doc.file_url)
            if (dlError || !blob) {
              // *** D6 (Job E4): STORAGE UNREACHABLE IS NOT A FILE THAT IS GONE. ***
              // `lib/storageMiss.ts` says why. On the sweep's path the right answer is to put the row
              // back to `uploaded` and leave it for the next pass, writing **no reading** — so
              // nothing replaces the last good one and nobody is told to upload a second copy of a
              // file that is still there.
              if (!fileIsMissing(dlError)) {
                console.error(`scan-documents: storage unreachable for ${doc.id} `
                  + `(attempt ${attempts} of ${READ_ATTEMPT_LIMIT}): ${dlError?.message ?? 'no file'}`)
                /**
                 * *** AND AFTER THE LIMIT IT STOPS — R7, item S1. ***
                 *
                 * Putting the row back and moving on is right for a storage blip and wrong for ever:
                 * RULE 1 picks the globally oldest queued document, which is this one, so the run
                 * spun on it for its whole budget and no other company's documents were read. At the
                 * limit the row gets a READING saying what happened — our side, not theirs, and what
                 * they can do — which also settles the row, so `finishBatchIfDone` below can finish
                 * the batch and **the email goes**.
                 */
                if (attempts >= READ_ATTEMPT_LIMIT) {
                  await saveScan(supabaseAdmin,
                    failedScan(STORAGE_UNREACHABLE_FINAL.reason, STORAGE_UNREACHABLE_FINAL.wayForward),
                    { documentId: doc.id, companyId, entityId: doc.entity_id })
                  couldNotRead++
                  continue
                }
                await supabaseAdmin.from('documents').update({ status: 'uploaded' }).eq('id', doc.id)
                continue
              }
              // The file is not where its row says it is. That is a product failure and it is
              // said out loud ON THE ROW, as a reading, rather than thrown away as a log line.
              await saveScan(supabaseAdmin, failedScan(FILE_GONE.reason, FILE_GONE.wayForward),
                { documentId: doc.id, companyId, entityId: doc.entity_id })
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
            /**
             * *** A FAILURE BELOW THE LIMIT IS TRIED AGAIN — R7, item S6. ***
             *
             * Everything in the try can throw for a reason that has nothing to do with the file: the
             * company row, the scan context (`lib/companyContext.ts` throws since Job E), the model
             * call. Settling the document as `could_not_read` on the first of those saved
             * "Something went wrong at our end" as its reading with no automatic retry, and the only
             * way back was a person noticing and pressing Read it again.
             *
             * Below the limit the row goes back to the queue and the claim is released by the
             * `finally`, so the next pass takes it. At the limit it settles, with the sentence
             * below, which is where the old behaviour was right: a document that has thrown three
             * times will throw again, and a row that cycles for ever is a failure nobody sees.
             */
            if (attempts < READ_ATTEMPT_LIMIT) {
              await supabaseAdmin.from('documents').update({ status: 'uploaded' }).eq('id', doc.id)
              continue
            }
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
            const finished = await finishBatchIfDone(batchId)
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
      } catch (e) {
        // S3: recorded against the company, and the run goes on to the next one. The claim stays,
        // and rule 3 above frees it on the next sweep after the stuck window.
        errors.push({ document: `company:${companyId}`, error: e instanceof Error ? e.message : String(e) })
      }
    }

    /**
     * *** THE BATCHES A THROW LEFT UNFINISHED — R7, item S4. ***
     *
     * `finishBatchIfDone` is called only for the batches of the queue this run just processed, and
     * it can throw: `summariseBatch` reads rows, and since Job E those reads throw rather than
     * answering zero. A batch whose summary read failed was then **never looked at again** — every
     * one of its documents is settled, so no later sweep's queue contains them — and the comment
     * saying "the next pass summarises it properly" was false. The person waits for an email that
     * will never come.
     *
     * So the sweep ends by looking for exactly that state: a batch not done whose every document
     * has settled. It is the recovery rule for the state the throw leaves behind, and it costs one
     * query on a run that already found work.
     */
    // Not done (S4), AND done with no email sent (E9's 9b — a send that failed is never retried,
    // because the batch is `done` by then and nothing looked at it again).
    const unfinished = mustRows<{ id: string }>('the batches that did not finish', await supabaseAdmin
      .from('document_batches').select('id')
      .or('status.neq.done,notified_at.is.null')
      .order('created_at', { ascending: false }).limit(50))
    for (const b of unfinished) {
      try {
        const finished = await finishBatchIfDone(b.id)
        if (finished.done) {
          // An email is the most consequential thing this job does, so the run's row exists before
          // it goes — even on a sweep that found no documents to read (`lib/jobRun.ts`).
          await run.open()
          batchesFinished++
          if (finished.notified) notified++
          const r = finished.resend as
            { ok?: boolean; id?: string | null; to?: string; error?: string } | undefined
          if (r && (r.id || r.error)) {
            sent.push({ batch: b.id, to: r.to ?? '', id: r.id ?? null, ...(r.error ? { error: r.error } : {}) })
          }
        }
      } catch (e) {
        errors.push({ document: `batch:${b.id}`, error: e instanceof Error ? e.message : String(e) })
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
  batchId: string, opts: { email?: boolean } = { email: true },
): Promise<{ done: boolean; notified: boolean; resend?: unknown }> {
  // *** D7'S NEIGHBOURS, CHECKED (E4). *** A failed BATCH read answered "not finished" for ever;
  // a failed DOCUMENTS read made `settled` empty, which on an empty-looking batch finishes it —
  // and a batch is marked done FOR GOOD, which is what makes that permanent.
  const batch = mustRow<{ id: string; company_id: string; created_by: string | null
                          status: string; notified_at: string | null; file_count: number
                          summary: Record<string, unknown> | null; created_at: string }>(
    'this batch', await supabaseAdmin.from('document_batches')
      .select('id, company_id, created_by, status, notified_at, file_count, summary, created_at')
      .eq('id', batchId).maybeSingle())
  if (!batch) return { done: false, notified: false }
  /**
   * *** A SEND THAT FAILED IS TRIED AGAIN — E9's 9b, E10 §4. ***
   *
   * `notified_at` is set only after a successful send, which is right: a row stamped before it
   * means a failed send is never retried and nobody ever knows. But nothing retried it either —
   * the batch is already `done` by then, and this function used to return at once for a done batch,
   * so a Resend outage of one minute lost that person's email for good.
   *
   * The work is not redone: the summary is on the row, written in the same statement that claimed
   * the batch. Only the send is repeated, and the claim is `notified_at` still being null, so two
   * sweeps cannot both send. Seven days, because an email about a batch somebody uploaded a month
   * ago is worse than no email — by then they have looked.
   */
  if (batch.status === 'done') {
    const SEVEN_DAYS = 7 * 86_400_000
    if (!opts.email || batch.notified_at || (batch.file_count ?? 0) <= 1 || !batch.summary
        || Date.now() - Date.parse(batch.created_at) > SEVEN_DAYS) {
      return { done: false, notified: false }
    }
    // The stored summary, which `summariseBatch` wrote in the statement that claimed the batch.
    // Asserted once, as the route's other multi-column reads are: it is this shape or the row is
    // from a build that did not store one, and the guard above refuses a row with no summary.
    const again = await sendBatchEmail(batch.id, batch.company_id, batch.created_by,
      batch.summary as unknown as Parameters<typeof notifyBatch>[0]['summary'])
    return { done: false, notified: again.notified, resend: again.resend }
  }

  const rows = mustRows<{ id: string; status: string }>("this batch's documents",
    await supabaseAdmin.from('documents').select('id, status').eq('batch_id', batchId))
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
  // The CLAIM: an empty list means another run finished it first, which is a real answer. A failed
  // write is not, and would look the same (E4).
  const won = mustRows<{ id: string }>('this batch', await supabaseAdmin.from('document_batches')
    .update({ status: 'done', done_count: settled.length, summary })
    .eq('id', batchId).neq('status', 'done').select('id'))
  if (!won.length) return { done: false, notified: false }

  if (!opts.email) return { done: true, notified: false }

  // *** A BATCH OF ONE NEVER EMAILS, WHOEVER FINISHED IT — 28 September 2026. ***
  //
  // One document is only ever one of two things, and neither wants an email:
  //
  //   · a single-file upload, read in the page while the person watches (the live path already
  //     passes `email: false`, so this changes nothing for it)
  //   · a "Read it again" from the report drawer, which creates a batch of one and hands it to the
  //     sweep — and the sweep finishes batches with the default `email: true`
  //
  // Without this, pressing "Read it again" would send that person an email telling them what they
  // are looking at. The rule is the count and not a flag on the row because the count already says
  // it: `LIVE_SCAN_MAX` is the line between "wait here and it will be done" and "we will tell you
  // when it is", and one file has never been on the far side of it.
  //
  // *** IT IS A CEILING, NOT AN EQUALITY, AND THAT IS ON PURPOSE. *** Written as `<= 1` so a batch
  // whose file_count was never set — 0 — is also silent rather than emailing about nothing.
  if ((batch.file_count as number ?? 0) <= 1) {
    return { done: true, notified: false, resend: { skipped: 'a batch of one is never emailed' } }
  }

  // Who to tell. The uploader, by the login they uploaded with.
  let to = ''
  if (batch.created_by) {
    // Checked (E4): with no address this records "no recipient on the uploading login" — a
    // sentence about a login that exists.
    const { data: user, error: userErr } = await supabaseAdmin.auth.admin.getUserById(batch.created_by as string)
    if (userErr) console.error(`BATCH EMAIL: the uploading login could not be read: ${userErr.message}`)
    to = user?.user?.email ?? ''
  }
  // A failed read here puts "Your company" on the letterhead in place of their own name. Said,
  // and the fallback kept, because the email is still worth sending (E4).
  const coRead = await supabaseAdmin.from('companies')
    .select('name').eq('id', batch.company_id).maybeSingle()
  if (coRead.error) console.error(`BATCH EMAIL: could not read the company name: ${coRead.error.message}`)
  const company = coRead.data

  if (!to && !process.env.NOTIFY_TEST_TO) {
    // Nobody to tell. The banner still carries the summary, so the person is not left with
    // nothing — and this is recorded rather than silently skipped.
    return { done: true, notified: false, resend: { skipped: 'no recipient on the uploading login' } }
  }

  const sent = await notifyBatch({ to, companyName: company?.name ?? null, summary })
  if (sent.ok) {
    // *** THE STAMP IS A CLAIM — E9's 9b. *** `.is('notified_at', null)` so the retry path above and
    // this one cannot both land, and the person never gets the same email twice.
    await supabaseAdmin.from('document_batches')
      .update({ notified_at: new Date().toISOString() }).eq('id', batchId).is('notified_at', null)
  }
  return { done: true, notified: sent.ok, resend: sent }
}

/**
 * The send, on its own, so the finish and the RETRY of a failed send are one piece of code — E9's
 * 9b. It reads the recipient the same way and stamps `notified_at` under the same claim.
 */
async function sendBatchEmail(
  batchId: string, companyId: string, createdBy: string | null,
  summary: Parameters<typeof notifyBatch>[0]['summary'],
): Promise<{ notified: boolean; resend: unknown }> {
  let to = ''
  if (createdBy) {
    const { data: who, error } = await supabaseAdmin.auth.admin.getUserById(createdBy)
    if (error) {
      return { notified: false, resend: { error: `the uploading login could not be read: ${error.message}` } }
    }
    to = who?.user?.email ?? ''
  }
  if (!to && !process.env.NOTIFY_TEST_TO) {
    return { notified: false, resend: { error: 'no recipient on the uploading login' } }
  }
  // Said and the fallback kept, exactly as the finish path does it (E4): the email is still worth
  // sending without the company's name on it.
  const coRead = await supabaseAdmin.from('companies').select('name').eq('id', companyId).maybeSingle()
  if (coRead.error) console.error(`BATCH EMAIL: could not read the company name: ${coRead.error.message}`)
  const sent = await notifyBatch({ to, companyName: coRead.data?.name ?? null, summary })
  if (sent.ok) {
    await supabaseAdmin.from('document_batches')
      .update({ notified_at: new Date().toISOString() }).eq('id', batchId).is('notified_at', null)
  }
  return { notified: sent.ok, resend: sent }
}

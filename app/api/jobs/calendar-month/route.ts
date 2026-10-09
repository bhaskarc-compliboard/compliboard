// THE MONTHLY CALENDAR EMAIL — Calendar decision 11 (`DECISIONS.md` §185), `vercel.json` `0 15 1 * *`.
//
// On the 1st of each month: for every company, what is due this month, what has passed and is not
// done, and how many dates are waiting to be confirmed. One email each, to every login at the
// company. The words are `lib/calendarNotify.ts`; this route is the door and the record.
//
// *** NO MODEL IS CALLED. *** The calendar is deterministic: these are rows, not an answer. The only
// cost of this job is the email.
//
// GET with `Authorization: Bearer <CRON_SECRET>` is Vercel Cron; POST with `x-cron-secret` is a
// person running it by hand. Both through `requireCronSecret`, and every refusal is a 404
// (`lib/jobAuth.ts`), so an anonymous caller cannot confirm the route exists.
//
// *** R2 AND R3, WHICH IS WHY THE ERROR HANDLING LOOKS THE WAY IT DOES ***
// (`docs/FIX-LIST-FAILURES.md`). A company whose dates could not be read gets **no email**, and the
// reason is written to `job_runs.errors`. It never gets an email saying "Nothing is due this month",
// because that would be a false statement to a customer about their own compliance built on a read
// that failed. One company's failure does not stop the others: each is caught, counted and recorded,
// and the job finishes.
import { NextRequest, NextResponse } from 'next/server'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { supabaseAdmin } from '@/lib/auth'
import { notifyMonth } from '@/lib/calendarNotify'
import { today } from '@/lib/calendarDate'

export const maxDuration = 300

interface Counts {
  companies: number
  sent: number
  nothing_to_say: number
  no_logins: number
  failed: number
  [k: string]: unknown
}

async function run(asOf: string, dryRun: boolean) {
  const job = await startJobRun(supabaseAdmin, 'calendar_month')
  const counts: Counts = { companies: 0, sent: 0, nothing_to_say: 0, no_logins: 0, failed: 0 }
  const errors: unknown[] = []
  // `text` only on a dry run: on a real one it would put every customer's email body into
  // `job_runs.counts`, which is not where a person's data belongs. On a dry run it is the whole
  // point — "what would this say" answerable without sending anything (`lib/auditNotify.ts`'s rule).
  const sent: Array<{ company: string; to: string; subject: string; text?: string }> = []

  try {
    // *** THE COMPANY LIST'S OWN ERROR IS CHECKED FIRST. *** A failed read here is not "no
    // companies": it would finish the job green having emailed nobody, which is the exact shape R2
    // is about. It is thrown, so the job's row records it and `ok` is false.
    const { data: companies, error } = await supabaseAdmin.from('companies').select('id, name').order('name')
    if (error) throw new Error(`the companies could not be read: ${error.message}`)

    counts.companies = companies.length
    for (const c of companies as Array<{ id: string; name: string }>) {
      try {
        const r = await notifyMonth(supabaseAdmin, c.id, { asOf, dryRun })
        if (r.notified || (dryRun && r.subject)) {
          counts.sent++
          sent.push({ company: c.name, to: r.to ?? '', subject: r.subject ?? '',
                      ...(dryRun ? { text: r.text } : {}) })
        } else if (r.reason === 'nothing to say') counts.nothing_to_say++
        else if (r.reason === 'no logins') counts.no_logins++
        else {
          counts.failed++
          errors.push({ company: c.name, error: r.error ?? r.reason ?? 'not sent' })
        }
      } catch (e) {
        // ONE COMPANY'S FAILED READ DOES NOT SILENCE THE REST, and it does not become an email
        // either. It is recorded against the job with the company's name, so "who did not get one,
        // and why" is answerable from the database a month later.
        counts.failed++
        errors.push({ company: c.name, error: e instanceof Error ? e.message : String(e) })
        console.error(`calendar-month: ${c.name} got no email —`, e)
      }
    }
  } catch (e) {
    errors.push({ error: e instanceof Error ? e.message : String(e) })
    console.error('calendar-month failed:', e)
  }

  await job.finish(counts, errors)
  return { job_run_id: job.id, as_of: asOf, dry_run: dryRun, counts, errors, sent }
}

export async function GET(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  return NextResponse.json(await run(today(), false))
}

/**
 * POST runs it by hand. `?dry=1` renders every email and sends none, so "what would this say" is
 * answerable without putting mail in anybody's inbox — `lib/auditNotify.ts`'s `dryRun`, for the same
 * reason. `?as_of=YYYY-MM-DD` runs it as if it were that day, so a month with dates in it can be
 * checked without waiting for the 1st.
 */
export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  const p = request.nextUrl.searchParams
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(p.get('as_of') ?? '') ? p.get('as_of') as string : today()
  return NextResponse.json(await run(asOf, p.get('dry') === '1'))
}

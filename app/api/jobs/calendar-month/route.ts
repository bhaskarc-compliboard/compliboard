// THE MONTHLY CALENDAR EMAIL — Calendar step 11 (decision 18; board 10).
//   GET  /api/jobs/calendar-month     (Vercel Cron, the 1st at 14:00 UTC, Authorization: Bearer CRON_SECRET)
//   POST /api/jobs/calendar-month     (by hand, x-cron-secret) — `lib/cronSecret.ts`
//   ?dryRun=1   render and count, send nothing, claim nothing
//   ?month=YYYY-MM   the month to render; the current month by default
//   ?company=<id>    ONE company instead of all of them. The cron never passes it; it is how a
//                    real send is tested without claiming the month for every other company on
//                    staging, and how one company's email is re-sent after a failure is fixed.
//
// The night-job shape (`app/api/jobs/handbook-queue/route.ts`): the cron secret first — a 404
// without it, writing nothing — then ONE `job_runs` row opened before the work, so a crash is
// visible rather than indistinguishable from "cron never fired".
//
// *** THE CLAIM COMES FIRST, BEFORE THE RENDER AND BEFORE THE SEND. ***
// The one thing that must never happen is a second email about the same month. `calendar_mailings`
// has UNIQUE (company_id, month) (073), so the job INSERTS that row as its claim: a unique
// violation means another run has this month and this company, and this run skips. Were the row
// written after a successful send instead, a crash between sending and writing would leave no
// stamp and the next run would send again. Migration 077 made `sent_at` nullable for exactly this:
// a claim is a row with no `sent_at`, and the send stamps it.
//
// *** A FAILED SEND KEEPS ITS CLAIM, and that is deliberate. *** The error goes on the row and the
// month stays taken; freeing it automatically would email everybody twice at the next cron. A
// person clears the row, having read why.
//
// *** NOTHING LEAVES FOR A REAL ADDRESS ON STAGING. *** `NOTIFY_TEST_TO` is the To field when it is
// set, as the three existing emails do it; the real recipients are in the log line and on the row,
// never in the To. On production it is unset and the real people receive it.
//
// *** AND NOTHING LEAVES AT ALL FROM THE SANDBOX SENDER ON PRODUCTION (step 14). *** `NOTIFY_TEST_TO`
// is absent on production by design (`docs/RELEASE.md`), so this is the one job that mails real
// people on a schedule nobody presses. The guard below refuses that run while the `from:` is still
// Resend's shared sandbox address; `lib/email.ts` sandboxSenderRefusal is the rule.
import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/auth'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { liveDatesFor } from '@/lib/calendarCounts'
import { CALENDAR_VIEW_COLUMNS, type CalendarRow } from '@/lib/calendarView'
import { calendarEmail, monthlyRecipients, NOBODY_TO_SEND_TO, NOBODY_WANTS_IT } from '@/lib/calendarEmail'
import { renderEmail, SANDBOX_FROM, sandboxSenderRefusal } from '@/lib/email'

export const maxDuration = 800

/** "2026-11" for the month we are in, in UTC, as the cron fires. */
export const monthKeyOf = (now: Date): string => now.toISOString().slice(0, 7)

interface CompanyResult {
  company_id: string
  company: string
  /**
   * The three reasons a company gets nothing this month, each a distinct fact. "Everyone has it
   * off" joined them at My Account step 7 and is deliberately NOT folded into "nobody to send to":
   * a company with no logins and a company whose people have all unsubscribed are different
   * states, and the `calendar_mailings` row is the only place anybody can tell them apart later.
   */
  skipped?: 'already sent this month' | typeof NOBODY_TO_SEND_TO | typeof NOBODY_WANTS_IT
  dates?: number
  recipients?: number
  sent?: boolean
  error?: string
}

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1'
  const month = request.nextUrl.searchParams.get('month') ?? monthKeyOf(new Date())
  const onlyCompany = request.nextUrl.searchParams.get('company')
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  const override = (process.env.NOTIFY_TEST_TO ?? '').trim()

  const run = await startJobRun(supabaseAdmin, 'calendar_month')
  const errors: Array<{ company_id?: string; error: string }> = []
  const results: CompanyResult[] = []

  // *** THE SANDBOX SENDER CANNOT REACH A CUSTOMER — Calendar step 14. ***
  // `lib/email.ts` sandboxSenderRefusal carries the reasoning. On production, with the sandbox
  // `from:` still in place, this run stops HERE: before the claim, so no month is taken, and
  // before the render, so nothing is paid for. The refusal is on the `job_runs` row, because a
  // cron that refuses and leaves no trace is indistinguishable from a cron that never fired.
  //
  // A DRY RUN IS LET THROUGH, and that is the point of it: it claims nothing and sends nothing by
  // construction, so it stays the free way to read what the first email would say on production —
  // and it reports `would_be_refused`, which is how the guard is seen to be armed without one
  // email leaving.
  const sandbox = sandboxSenderRefusal(SANDBOX_FROM, process.env.VERCEL_ENV)
  if (sandbox && !dryRun) {
    console.error(`CALENDAR EMAIL NOT SENT: ${sandbox}`)
    const refused = { month, dry_run: false, companies: 0, sent: 0, skipped: 0, failed: 0, refused: sandbox }
    await run.finish(refused, [{ error: sandbox }])
    return NextResponse.json({ job: 'calendar_month', run: run.id, ...refused, results: [], errors: [{ error: sandbox }] },
      { status: 503 })
  }

  try {
    // *** A LINK THAT DOES NOT WORK IS WORSE THAN NO EMAIL — `lib/auditNotify.ts`'s rule, and the
    // same refusal. Every row in this email is a link to a date.
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set, so every link would be dead')

    // WHO IS "EVERY PERSON AT THE COMPANY": a `profiles` row with this `company_id`. The address
    // is NOT on the profile — `profiles` has no email column at all — it is on the login in
    // `auth.users`, read through the admin API, which is how `lib/auditNotify.ts` and
    // `app/api/jobs/scan-documents/route.ts` resolve a recipient.
    const { data: people, error: peopleError } = await supabaseAdmin
      .from('profiles').select('id, company_id, full_name, calendar_email').not('company_id', 'is', null)
    if (peopleError) throw new Error(`profiles: ${peopleError.message}`)
    const byCompany = new Map<string, Array<{ id: string; full_name: string | null; calendar_email: boolean }>>()
    for (const p of (people ?? []) as Array<{
      id: string; company_id: string; full_name: string | null; calendar_email: boolean
    }>) {
      if (!byCompany.has(p.company_id)) byCompany.set(p.company_id, [])
      byCompany.get(p.company_id)!.push({ id: p.id, full_name: p.full_name, calendar_email: p.calendar_email })
    }

    const ids = [...byCompany.keys()].filter((id) => !onlyCompany || id === onlyCompany)
    const { data: companies, error: coError } = await supabaseAdmin
      .from('companies').select('id, name').in('id', ids)
    if (coError) throw new Error(`companies: ${coError.message}`)

    for (const co of (companies ?? []) as Array<{ id: string; name: string }>) {
      const result: CompanyResult = { company_id: co.id, company: co.name }
      results.push(result)
      try {
        const staff = byCompany.get(co.id) ?? []
        if (!staff.length) { result.skipped = NOBODY_TO_SEND_TO; continue }

        // ---- THE CLAIM, FIRST ----
        if (!dryRun) {
          const { error: claimError } = await supabaseAdmin
            .from('calendar_mailings').insert({ company_id: co.id, month })
          if (claimError) {
            // 23505 is the unique index doing its job: this month is already claimed.
            if (claimError.code === '23505') { result.skipped = 'already sent this month'; continue }
            throw new Error(`claiming ${month}: ${claimError.message}`)
          }
        } else {
          // A dry run claims NOTHING — a claim here would block the real send — but it still says
          // whether the real run would have skipped, which is what makes the probe meaningful.
          const { data: claimed } = await supabaseAdmin.from('calendar_mailings')
            .select('id').eq('company_id', co.id).eq('month', month).maybeSingle()
          if (claimed) { result.skipped = 'already sent this month'; continue }
        }

        // ---- WHAT THE EMAIL SAYS ----
        const { data: rowData, error: rowError } = await liveDatesFor(
          supabaseAdmin as never, co.id, CALENDAR_VIEW_COLUMNS)
        if (rowError) throw new Error(`calendar_v: ${rowError.message}`)
        const rows = (rowData ?? []) as unknown as CalendarRow[]
        const { count: siteCount } = await supabaseAdmin
          .from('entities').select('id', { count: 'exact', head: true }).eq('company_id', co.id)
        const names = Object.fromEntries(staff.filter((p) => p.full_name).map((p) => [p.id, p.full_name as string]))

        const mail = calendarEmail({ company: co.name, month, rows, siteCount: siteCount ?? 0, appUrl, names })
        const { html, text } = renderEmail(mail.shape)
        result.dates = mail.counts.due.length

        // ---- WHO IT GOES TO ----
        //
        // *** EVERY PERSON AT THE COMPANY WHO STILL WANTS IT — My Account step 7, decision 6. ***
        // `profiles.calendar_email` (migration 082) is the per-person switch board 2 puts on each
        // row, and `monthlyRecipients` is the one rule that reads it. A company where everyone has
        // it off is NOT the same fact as a company with no logins, and the claim row says which —
        // a month later that row is the only thing anybody can look at.
        //
        // The names for the email body still come from ALL the staff: "Added by Dev Patel" is true
        // about a date whether or not Dev wants the email.
        const { wants, reason } = monthlyRecipients(staff)
        const addresses: string[] = []
        for (const p of wants) {
          const { data: user } = await supabaseAdmin.auth.admin.getUserById(p.id)
          const email = user?.user?.email
          if (email) addresses.push(email)
        }
        result.recipients = addresses.length
        if (!addresses.length) {
          const why = reason ?? 'no login on any profile at this company'
          result.skipped = reason ?? NOBODY_TO_SEND_TO
          if (!dryRun) {
            await supabaseAdmin.from('calendar_mailings')
              .update({ error: why })
              .eq('company_id', co.id).eq('month', month)
          }
          continue
        }

        if (dryRun) { result.sent = false; continue }

        const key = process.env.RESEND_API_KEY
        if (!key) throw new Error('RESEND_API_KEY is not set')
        // The To is the override on staging; who it is FOR is the list, and it goes in the log
        // and onto the row either way.
        const to = override ? [override] : addresses
        console.log(`calendar email: ${co.name} ${month} — ${mail.counts.due.length} date(s) due, `
          + `for ${addresses.join(', ')}${override ? ` (sent to ${override} instead)` : ''}`)
        const resend = new Resend(key)
        const res = await resend.emails.send({
          from: SANDBOX_FROM, to, subject: mail.subject, html, text,
        })
        if (res.error) throw new Error(`Resend: ${res.error.message}`)

        // Only now is it sent. The row it stamps is the row it claimed.
        await supabaseAdmin.from('calendar_mailings')
          .update({ sent_at: new Date().toISOString(), sent_to: addresses })
          .eq('company_id', co.id).eq('month', month)
        result.sent = true
      } catch (e) {
        // One company's failure never stops the others, and it is written where somebody can find
        // it: on the claim row, and in the run's own errors.
        const message = e instanceof Error ? e.message : String(e)
        result.error = message
        errors.push({ company_id: co.id, error: message })
        if (!dryRun) {
          await supabaseAdmin.from('calendar_mailings').update({ error: message.slice(0, 500) })
            .eq('company_id', co.id).eq('month', month)
        }
      }
    }
  } catch (e) {
    errors.push({ error: e instanceof Error ? e.message : String(e) })
  }

  const counts = {
    month,
    dry_run: dryRun,
    ...(sandbox ? { would_be_refused: sandbox } : {}),
    ...(onlyCompany ? { one_company: onlyCompany } : {}),
    companies: results.length,
    sent: results.filter((r) => r.sent).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => r.error).length,
  }
  await run.finish(counts, errors)
  return NextResponse.json({ job: 'calendar_month', run: run.id, ...counts, results, errors })
}

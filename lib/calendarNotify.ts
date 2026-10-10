/**
 * THE MONTHLY EMAIL — Calendar decision 11 (`DECISIONS.md` §185), board 12.
 *
 * One email per company on the 1st of each month: what is due this month, what has passed and is not
 * done, and how many dates are waiting to be confirmed. Copied from `lib/auditNotify.ts` — plain
 * text, the `NEXT_PUBLIC_APP_URL` refusal, the `NOTIFY_TEST_TO` override that says at the top where
 * it was really addressed, and a `job_runs` row for the run as a whole.
 *
 * *** WHAT IS DIFFERENT FROM AUDITS', AND WHY. ***
 *   · **To every login at the company** (decision 11). An audit email goes to the person who pressed;
 *     nobody presses this one. There is no company contact and no roles (`CALENDAR-MACHINERY.md`
 *     B11), so everyone with a login gets it.
 *   · **One link per section, not one per date** (board 12). In plain text a link after every line is
 *     a wall of addresses.
 *   · **Nothing due, nothing passed and nothing waiting means NO EMAIL.** A monthly email that
 *     arrives to say nothing is how a monthly email gets filtered.
 *
 * *** BOARD 12's LAST LINE IS DELIBERATELY ABSENT. *** The board ends "You can turn it off in My
 * Account." There is no such switch yet — My Account's own section is next — and an email that tells
 * somebody to turn it off somewhere they cannot is worse than one that says nothing (§5.1). **The
 * line and the switch go in together, and this email reaches no real customer before both exist**:
 * a launch gate beside decision 22, recorded in `docs/HANDOFF-CODE.md` §7 for My Account's chat.
 *
 * *** R2 AND R3 FROM THE START *** (`docs/FIX-LIST-FAILURES.md`). This is new code, so it does not
 * repeat the mistake the fix list is about:
 *   · **Every read checks its `error`.** A read that fails is not zero rows.
 *   · **A failed read means NO EMAIL for that company**, and the reason lands in `job_runs.errors`.
 *     An email saying "nothing is due this month" built on a read that failed would be a false
 *     statement to a customer about their own compliance, which is the worst thing this product can
 *     do.
 *   · There is no `?? []` anywhere below. When `docs/FIX-LIST-FAILURES.md` E1 builds the shared
 *     helper that throws on `error`, these checks are what it replaces.
 */
import { Resend } from 'resend'
import { emailFrom } from './emailSender.ts'
import { formatDayShort, formatMonth, monthRange, today } from './calendarDate.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; auth?: { admin?: Record<string, any> } }

export interface MonthlyDate {
  title: string
  due_date: string
  state: string
  /** The plant this date belongs to, when it has one (decision 14). Null means company-wide. */
  site: string | null
}

export interface MonthlyDates {
  due: MonthlyDate[]
  passed: MonthlyDate[]
  waiting: number
}

export interface NotifyResult {
  notified: boolean
  /** Why nothing was sent, when nothing was. `error` is a failure; `reason` is a decision. */
  reason?: 'nothing to say' | 'no logins' | 'no app url'
  error?: string
  to?: string
  id?: string | null
  subject?: string
  text?: string
}

/**
 * What this company's month holds. Throws on any read failure — the caller turns that into "no email
 * for this company" and an error on the job's row.
 *
 * `counts_as_due` is the database's own column (migration 073): a date with no day, or one whose
 * source line we could not find and nobody has confirmed, is not a deadline yet and is not in here.
 * It is counted under `waiting` instead, which is exactly what the To confirm tab holds.
 */
export async function monthlyDates(
  db: Db, companyId: string, asOf: string = today(),
): Promise<MonthlyDates> {
  const [y, m] = asOf.split('-').map(Number)
  const { first, last } = monthRange(y, m)

  // DUE THIS MONTH — on the board, in this month, not finished.
  // `entities(name)` is the site (decision 14), joined rather than looked up per row: a loop of
  // queries inside an email is a loop whose order decides the email.
  const due = await db.from('calendar_events')
    .select('title, due_date, state, entities(name)')
    .eq('company_id', companyId).eq('counts_as_due', true)
    .gte('due_date', first).lte('due_date', last)
    .neq('state', 'done')
    .order('due_date')
  if (due.error) throw new Error(`the dates due this month could not be read: ${due.error.message}`)

  // PASSED AND NOT DONE — before today, whatever month it was in. A deadline that slipped last month
  // is the thing a person most needs to see, so it is not scoped to this month.
  const passed = await db.from('calendar_events')
    .select('title, due_date, state, entities(name)')
    .eq('company_id', companyId).eq('counts_as_due', true)
    .lt('due_date', asOf)
    .neq('state', 'done')
    .order('due_date')
  if (passed.error) throw new Error(`the dates that have passed could not be read: ${passed.error.message}`)

  // WAITING FOR A PERSON — the To confirm tab's own count, read the same way the tab reads it.
  const waiting = await db.from('calendar_events')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId).eq('state', 'not_confirmed')
  if (waiting.error) throw new Error(`the dates waiting to be confirmed could not be counted: ${waiting.error.message}`)

  const withSite = (rows: unknown): MonthlyDate[] =>
    (rows as Array<Record<string, unknown>>).map((r) => ({
      title: r.title as string,
      due_date: r.due_date as string,
      state: r.state as string,
      site: ((r.entities as { name?: string } | null)?.name) ?? null,
    }))

  return {
    due: withSite(due.data),
    // A date that is both passed and in this month would otherwise appear twice; the passed list
    // wins, because the day having gone by is the more useful of the two sentences.
    passed: withSite(passed.data),
    waiting: waiting.count ?? 0,
  }
}

/** Every login at this company. Throws on a read failure; an empty list is a real answer. */
export async function companyLogins(db: Db, companyId: string): Promise<string[]> {
  const { data, error } = await db.from('profiles').select('id').eq('company_id', companyId)
  if (error) throw new Error(`the company's logins could not be read: ${error.message}`)

  // *** THE ADDRESS IS IN `auth.users`, NOT IN `profiles`. *** `profiles` carries no email column at
  // all, and `scripts/check-schema-contracts.js` refuses a query that pretends otherwise — which is
  // how `lib/auditNotify.ts` found the same mistake, invisible because `NOTIFY_TEST_TO` was set.
  const admin = db.auth?.admin
  if (!admin) {
    throw new Error('the client given to this job cannot read auth.users, so no login could be '
      + 'resolved. Pass the service-role client.')
  }
  const out: string[] = []
  for (const p of (data as Array<{ id: string }>)) {
    const { data: u, error: uErr } = await admin.getUserById(p.id)
    if (uErr) throw new Error(`a login could not be read: ${uErr.message}`)
    const email = u?.user?.email
    if (email) out.push(email)
  }
  return out
}

/**
 * BOARD 12's WORDS, IN ITS ORDER — the board the owner approved, with exactly two departures, both
 * his and both recorded:
 *
 *   · **"You can turn it off in My Account" is absent** until that switch exists (`DECISIONS.md`
 *     §185b). The sentence above it — why you are getting this at all — stays.
 *   · **Nothing says "overdue" or "not done"** (§185, A5b). The board's heading was "Passed, not
 *     done"; it is now "Dates that have passed", with a line that assumes the work may well be done.
 *     People record what they did in their own calendar, not ours, so the only thing we actually
 *     know is that the day has gone by.
 *
 * Exported so a test and the report can read the whole text without sending anything.
 */
export function renderMonthlyEmail(args: {
  companyName: string
  asOf: string
  dates: MonthlyDates
  appUrl: string
  realTo?: string[]
  override?: string
}): { subject: string; text: string } {
  const [y, m] = args.asOf.split('-').map(Number)
  const month = formatMonth(y, m)                   // "October 2026"
  const monthOnly = month.split(' ')[0]             // "October"
  const { due, passed, waiting } = args.dates

  // THE SUBJECT COUNTS THE THREE GROUPS, AND DROPS ANY THAT IS ZERO. A subject that says "0 passed"
  // is noise, and one that counts everything is alarming (Audits' rule, §147's neighbour).
  const parts = [
    due.length ? `${due.length} due` : null,
    passed.length ? `${passed.length} passed` : null,
    waiting ? `${waiting} to confirm` : null,
  ].filter(Boolean)
  const subject = `Your ${monthOnly} dates: ${parts.join(', ')}`

  /** `5 November · Monthly EHS self-check · Portland plant`, and `· not confirmed` when it is. */
  const line = (d: MonthlyDate) => '  ' + [
    // The year shows when it is not this year's: a passed date can sit unticked for a year, and a
    // bare "20 August" under a heading that says October 2026 points at the wrong August.
    formatDayShort(d.due_date, args.asOf),
    d.title,
    d.site,
    d.state === 'not_confirmed' ? 'not confirmed' : null,
  ].filter(Boolean).join(' · ')

  const lines: string[] = []
  if (args.override && args.realTo?.length && !args.realTo.includes(args.override)) {
    lines.push(`[staging: this would have gone to ${args.realTo.join(', ') || '(nobody)'}]`, '')
  }

  lines.push(`${args.companyName}, here is what is due in ${month}.`, '')

  if (due.length) {
    lines.push(`Due this month (${due.length}):`)
    for (const d of due) lines.push(line(d))
    lines.push('')
  } else {
    // R3: said only when the read SUCCEEDED and returned nothing. A read that failed never reaches
    // here — `monthlyDates` throws and the caller sends no email at all.
    lines.push(`Nothing is due in ${monthOnly}.`, '')
  }

  if (passed.length) {
    // *** THE OWNER'S RULE (§185, A5b): NOT "passed and not done". ***
    lines.push(`Dates that have passed (${passed.length}):`)
    for (const d of passed) lines.push(line(d))
    lines.push('')
    lines.push('A gentle reminder in case any of these still need attention. If they\'re already')
    lines.push('taken care of, you can tick them off on your CompliBoard calendar and we won\'t')
    lines.push('list them again.', '')
  }

  if (waiting) {
    lines.push(`Found in your documents, not yet confirmed: ${waiting}.`)
    lines.push('They are on your calendar, marked not confirmed. Check each one against its line')
    lines.push('in the document.')
    // ONE LINK PER SECTION (board 12), not one per date. `?tab=confirm` is the name the board uses
    // and the name Job B must build the tab under — pinned by a test and written into
    // `docs/HANDOFF-CODE.md` §7, because a link to a tab that is spelled differently is a dead link
    // in an email nobody can fix after it is sent.
    lines.push(`${args.appUrl}/calendar?tab=confirm`, '')
  }

  lines.push(`Your calendar: ${args.appUrl}/calendar`, '')

  lines.push('Dates are read from your documents and from what you add. They are not legal advice.')
  lines.push('When in doubt, check with the agency.', '')

  // WHY YOU ARE GETTING THIS. The board's next sentence, "You can turn it off in My Account", waits
  // for that switch (§185b) — and a test asserts it is absent, so it cannot arrive early.
  lines.push(`You get this email on the 1st of each month because you have a login at ${args.companyName}.`)

  // NO PRICE, EVER (§147). NEVER "compliant" (§6).
  return { subject, text: lines.join('\n') }
}

/**
 * Send this company's monthly email, or say why nothing was sent.
 *
 * It throws on a READ failure rather than returning: the caller records the error against the job and
 * moves to the next company, and no email goes out for this one. That is the whole of R2 and R3 in
 * one sentence — **a company whose dates we could not read gets no email, not an email saying
 * nothing is due.**
 */
export async function notifyMonth(
  db: Db, companyId: string,
  opts: { asOf?: string; dryRun?: boolean } = {},
): Promise<NotifyResult> {
  const asOf = opts.asOf ?? today()

  const { data: company, error: cErr } = await db.from('companies')
    .select('name').eq('id', companyId).maybeSingle()
  if (cErr) throw new Error(`the company could not be read: ${cErr.message}`)
  if (!company) return { notified: false, error: `no company ${companyId}` }

  const dates = await monthlyDates(db, companyId, asOf)

  // DECISION 11: nothing due, nothing passed and nothing waiting means no email.
  if (!dates.due.length && !dates.passed.length && !dates.waiting) {
    return { notified: false, reason: 'nothing to say' }
  }

  const realTo = await companyLogins(db, companyId)
  const override = (process.env.NOTIFY_TEST_TO ?? '').trim()
  const to = override ? [override] : realTo
  if (!to.length) return { notified: false, reason: 'no logins' }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  const { subject, text } = renderMonthlyEmail({
    companyName: company.name as string, asOf, dates, appUrl, realTo, override,
  })

  // *** A WRONG LINK IS WORSE THAN NO EMAIL *** — `lib/documentBatch.ts:162`'s rule. An email that
  // does not arrive is a feature that looks unfinished; one that arrives with a dead link is a
  // product that looks broken.
  if (!appUrl) {
    console.error('CALENDAR EMAIL NOT SENT: NEXT_PUBLIC_APP_URL is not set, so every link in it '
      + 'would have been wrong.')
    return { notified: false, reason: 'no app url', to: to.join(', '), subject, text }
  }
  if (opts.dryRun) return { notified: false, to: to.join(', '), subject, text }

  const key = process.env.RESEND_API_KEY
  if (!key) return { notified: false, error: 'RESEND_API_KEY is not set', to: to.join(', '), subject, text }
  const res = await new Resend(key).emails.send({ from: emailFrom(), to, subject, text })
  if (res.error) return { notified: false, error: res.error.message, to: to.join(', '), subject, text }
  return { notified: true, id: res.data?.id ?? null, to: to.join(', '), subject, text }
}

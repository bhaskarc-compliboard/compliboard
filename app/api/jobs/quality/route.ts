/**
 * NIGHT WATCH — THE NIGHTLY READ-ONLY FINDER. `docs/GAPS-PLAN.md` decision 75 (the owner,
 * 4 November 2026): **code finds, a report lands each morning, a person decides. It never calls a
 * model and it never changes anything.**
 *
 * The machine word is `quality` — this path, `job_runs.job`, the `quality_reports` table and the
 * `/quality` page. **Night Watch is the name people see** (`lib/qualityWords.ts`).
 *
 * *** IT SPENDS NOTHING, AND `npm run check` PROVES IT RATHER THAN THIS COMMENT. ***
 * `scripts/check-schema-contracts.js` CHECK 3 computes the transitive closure of every route's
 * imports and fails the build if a route that can reach the Anthropic SDK does not call
 * `requireAccess`. This route imports `lib/jobAuth.ts`, `lib/auth.ts`, `lib/email.ts`,
 * `lib/quality.ts` and `lib/qualityWords.ts` — walked, and none of them reaches `lib/ai.ts`. So it
 * never enters that set, needs no `EXEMPT` entry, and `PAID_COUNT` stays 23. Compare
 * `app/api/jobs/summarise/route.ts`, which DOES reach it through `summariseTopic` and is listed in
 * `EXEMPT` for that reason.
 *
 * *** AND IT IS SELECT-ONLY ON EVERYTHING BUT ITS OWN TWO TABLES. *** The eleven counters read
 * rows and write nothing back. The only writes in this file are `quality_reports` (its own report)
 * and `job_runs` (its own row). Nothing a customer can see is touched.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR THINGS THAT WOULD BE WRONG IF THIS FILE WERE WRITTEN THE OBVIOUS WAY
 *
 * 1. **THE DAY IS PACIFIC, NOT UTC.** Vercel's cron is UTC (`docs/RELEASE.md`'s table says so in
 *    its heading). At `30 13 * * *`, `current_date - 1` would mean Tuesday 16:00 to Wednesday
 *    16:00 Pacific and the email would call it Wednesday. `pacificWindow` is the fix, and the
 *    email's first line states the window it read.
 *
 * 2. **EVERY READ PAGES.** PostgREST caps a response at 1,000 rows by default and returns the
 *    first 1,000 **without saying so** — a truncated report that looks complete is this whole
 *    job's failure mode (`scripts/cost-report.js`'s own lesson). `all()` below pages with
 *    `.range()` until a short page comes back.
 *
 * 3. **AN ERROR IS NOT AN EMPTY RESULT** (`CLAUDE.md` §9a). `all()` throws on `error` rather than
 *    returning `[]`. A probe that reported "0 scan rows" from a PostgREST error was thirty seconds
 *    from filing the opposite of the truth; this job's whole output is counts, so a read that
 *    failed silently would file eleven zeroes and call it a quiet night.
 *
 * 4. **THE EMAIL IS SENT FROM THE SANDBOX ADDRESS ON PURPOSE** — see `sendIt` below for the
 *    owner's decision and its one-sentence reason.
 * ---------------------------------------------------------------------------
 */
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireCronSecret, startJobRun } from '@/lib/jobAuth'
import { supabaseAdmin } from '@/lib/auth'
import { renderEmail, SANDBOX_FROM } from '@/lib/email'
import {
  buildReport, pacificWindow, splitByCompany, thingsToLookAt,
  type AiCallRow, type DocumentRow, type FindingRow, type JobRunRow, type RunRow,
  type ScanRow, type SectionRow, type TopicRow, type TurnRow,
} from '@/lib/quality'
import {
  ALL_CLEAR, COUNTERS, COST_TITLE, EMAIL_FOOTER, HR_IS_WATCHED, NIGHT_WATCH,
  PULSE_WHY, deltaWord, subjectLine, windowLine,
} from '@/lib/qualityWords'

/** No model call, so no long work. The reads are counts over one day. */
export const maxDuration = 300

const PAGE = 1000

type PagedQuery = PromiseLike<{ data: unknown; error: { message: string } | null }>

/**
 * Every row a query matches, not the first thousand — rule 2 above.
 * It throws on an error rather than returning nothing — rule 3.
 */
async function all<T>(label: string, make: (from: number, to: number) => PagedQuery): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await make(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
    // A runaway guard: 100 pages is 100,000 rows in one day, which is not a day any more.
    if (page > 100) throw new Error(`${label}: over ${100 * PAGE} rows in one day — refusing to page further`)
  }
}

/** Vercel Cron calls with GET; POST with `x-cron-secret` is a person running it by hand. */
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const auth = requireCronSecret(request)
  if (!auth.ok) return auth.response
  const dry = new URL(request.url).searchParams.get('dry') === '1'
  return sweep(supabaseAdmin, new Date(), { dry })
}

/**
 * The sweep, callable without a request — the shape `jobs/summarise` has, and for its reason: a
 * test can run a whole real sweep against a fake client without a server.
 *
 * `dry` writes nothing and sends nothing. It exists so the first run against staging could be read
 * before it wrote a row, and so a person can ask "what would it say?" without spending a row.
 */
export async function sweep(
  admin: SupabaseClient, now: Date, opts: { dry?: boolean } = {},
): Promise<NextResponse> {
  const run = await startJobRun(admin, 'quality')
  const errors: Array<{ step: string; error: string }> = []
  const win = pacificWindow(now)
  let counts: Record<string, unknown> = { day: win.day, window_from: win.from, window_to: win.to }
  let emailText: string | null = null

  try {
    // ---- THE CONVERSATION SIDE ----
    const TURN_COLS = 'id, topic_id, company_id, role, text, sources, check_record, created_at'
    const turns = await all<TurnRow>('turns', (f, t) => admin.from('turns')
      .select(TURN_COLS)
      .eq('role', 'assistant').gte('created_at', win.from).lt('created_at', win.to)
      .order('created_at', { ascending: true }).range(f, t))

    const TOPIC_COLS = 'id, company_id, section, title, summary, summary_report, summarised_at'
    const topicIds = [...new Set(turns.map((t) => t.topic_id))]
    const topicsOfTurns = topicIds.length
      ? await all<TopicRow>('topics of turns', (f, t) => admin.from('topics')
          .select(TOPIC_COLS).in('id', topicIds).range(f, t))
      : []

    // Summarised yesterday — for count 8, and for the handle sweep over stored summaries.
    const summarisedTopics = await all<TopicRow>('topics summarised', (f, t) => admin.from('topics')
      .select(TOPIC_COLS).gte('summarised_at', win.from).lt('summarised_at', win.to).range(f, t))

    // Count 8 asks whether the CONVERSATION carried sources, which is every turn of it and not
    // only yesterday's — a conversation spoken in on Monday and summarised on Tuesday is exactly
    // the shape the count exists for.
    const summarisedIds = summarisedTopics.map((p) => p.id)
    const turnsOfSummarised = summarisedIds.length
      ? await all<TurnRow>('turns of summarised', (f, t) => admin.from('turns')
          .select(TURN_COLS).in('topic_id', summarisedIds).range(f, t))
      : []

    const topicsById = new Map<string, TopicRow>(
      [...topicsOfTurns, ...summarisedTopics].map((p) => [p.id, p]))

    // ---- THE AUDIT SIDE ----
    const runs = await all<RunRow>('audit_runs', (f, t) => admin.from('audit_runs')
      .select('id, company_id, kind, scope, agency_label, template_document_id, created_at')
      .gte('created_at', win.from).lt('created_at', win.to)
      .order('created_at', { ascending: true }).range(f, t))

    const SECTION_COLS = 'id, run_id, company_id, ordinal, title, status, model, '
      + 'could_not_complete_reason, raw_text, json_parsed, documents_read'
    const runIds = runs.map((r) => r.id)
    const sectionsOfRuns = runIds.length
      ? await all<SectionRow>('audit_sections of runs', (f, t) => admin.from('audit_sections')
          .select(SECTION_COLS).in('run_id', runIds).range(f, t))
      : []
    // ...and separately, a section that FINISHED yesterday on a run that started the day before.
    // Without this, a long run's broken section is missed by a day and then never counted at all.
    const sectionsFinished = await all<SectionRow>('audit_sections finished', (f, t) => admin.from('audit_sections')
      .select(SECTION_COLS).eq('json_parsed', false)
      .gte('finished_at', win.from).lt('finished_at', win.to).range(f, t))
    const sections = [...new Map(
      [...sectionsOfRuns, ...sectionsFinished].map((s) => [s.id, s])).values()]

    const findings = runIds.length
      ? await all<FindingRow>('audit_findings', (f, t) => admin.from('audit_findings')
          .select('id, run_id, company_id, word, title, basis, what_to_do, locator, '
                + 'document_id, quote, quote_verified, handle_error')
          .in('run_id', runIds).range(f, t))
      : []

    // ---- THE READING SIDE ----
    const scans = await all<ScanRow>('document_scans', (f, t) => admin.from('document_scans')
      .select('id, document_id, company_id, status, model, could_not_read_reason, ai_call_id, scanned_at')
      .gte('scanned_at', win.from).lt('scanned_at', win.to).range(f, t))

    const scanDocIds = [...new Set(scans.map((s) => s.document_id).filter(Boolean))] as string[]
    const named = scanDocIds.length
      ? await all<{ id: string; name: string | null }>('documents named', (f, t) => admin.from('documents')
          .select('id, name').in('id', scanDocIds).range(f, t))
      : []
    const documentNames = new Map(named.map((d) => [d.id, d.name ?? d.id]))

    // Count 10 is a reading of NOW, not of yesterday — `lib/qualityWords.ts` marks it
    // `scope: 'now'` and the email says so.
    const stuckDocuments = await all<DocumentRow>('documents reading', (f, t) => admin.from('documents')
      .select('id, company_id, name, status, reading_since')
      .not('reading_since', 'is', null).range(f, t))

    // ---- THE LEDGER ----
    const sevenBefore = new Date(Date.parse(win.from) - 7 * 86_400_000).toISOString()
    const callWindow = await all<AiCallRow>('ai_calls', (f, t) => admin.from('ai_calls')
      .select('id, company_id, task, model, cost_usd, created_at')
      .gte('created_at', sevenBefore).lt('created_at', win.to)
      .order('created_at', { ascending: true }).range(f, t))
    const callsDay = callWindow.filter((c) => c.created_at >= win.from)
    const callsPrior7 = callWindow.filter((c) => c.created_at < win.from)

    // Which of yesterday's calls a stored reading claims. Read by the CALL ids rather than by a
    // time window, because a call at 23:59 can be claimed by a scan row written at 00:01 — and a
    // window would then report it as money nobody accounts for.
    const dayCallIds = callsDay.map((c) => c.id)
    const claiming = dayCallIds.length
      ? await all<{ ai_call_id: string | null }>('scans claiming a call', (f, t) => admin.from('document_scans')
          .select('ai_call_id').in('ai_call_id', dayCallIds).range(f, t))
      : []
    const claimedCallIds = new Set(claiming.map((s) => String(s.ai_call_id)))

    // ---- THE JOBS' PULSE (S-4's second half) ----
    // The newest row per job, one tiny read each, plus anything still open. Reading a window
    // instead would be thousands of rows: `scan_documents` alone can open 288 a day.
    const JOBS = ['summarise', 'delete', 'account_delete', 'scan_documents',
      'audit_sections', 'handbook_checks', 'calendar_month', 'quality'] as const
    //
    // *** THIS RUN'S OWN ROW IS EXCLUDED FROM BOTH READS, AND THE FIRST REAL RUN IS WHY. ***
    // `startJobRun` opens a `job_runs` row before any work, so at this moment the newest `quality`
    // row IS this one and its `finished_at` is null. The first staging run therefore mailed
    // *"quality · last started -1 min ago · 1 row left open"* — a permanent false alarm, in the
    // one block whose job is to say when something is hanging, and negative minutes besides.
    // Excluding it from the OPEN list was not enough: it had to come out of the newest-per-job
    // read as well. The previous day's `quality` row is still shown, which is the useful half.
    const jobRuns: JobRunRow[] = []
    for (const job of JOBS) {
      const { data, error } = await admin.from('job_runs')
        .select('id, job, started_at, finished_at').eq('job', job)
        .neq('id', run.id)
        .order('started_at', { ascending: false }).limit(1)
      if (error) throw new Error(`job_runs ${job}: ${error.message}`)
      jobRuns.push(...((data ?? []) as JobRunRow[]))
    }
    const { data: open, error: openErr } = await admin.from('job_runs')
      .select('id, job, started_at, finished_at').is('finished_at', null)
      .neq('id', run.id)
      .gte('started_at', new Date(now.getTime() - 86_400_000).toISOString())
    if (openErr) throw new Error(`job_runs open: ${openErr.message}`)
    for (const r of (open ?? []) as JobRunRow[]) {
      if (!jobRuns.some((j) => j.id === r.id)) jobRuns.push(r)
    }

    // ---- THE COUNTING ----
    const report = buildReport({
      now, turns, turnsOfSummarised, topicsById, summarisedTopics, runs, sections, findings,
      scans, documentNames, callsDay, callsPrior7, claimedCallIds, stuckDocuments, jobRuns,
    })
    const dayRows = splitByCompany(win.day, report)
    const totals = dayRows.find((r) => r.company_id === null)

    // ---- THE DELTAS, against the previous day's totals row ----
    const before = new Date(Date.parse(`${win.day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    const { data: prior, error: priorErr } = await admin.from('quality_reports')
      .select('date, company_id, counts').eq('date', before).is('company_id', null)
    if (priorErr) throw new Error(`quality_reports previous day: ${priorErr.message}`)
    const priorCounts = ((prior ?? [])[0]?.counts ?? undefined) as Record<string, unknown> | undefined

    // ---- THE WRITE. Its own table only. ----
    if (!opts.dry) {
      const { error: upErr } = await admin.from('quality_reports')
        .upsert(dayRows.map((r) => ({
          date: r.date, company_id: r.company_id, counts: r.counts, rows: r.rows,
        })), { onConflict: 'date,company_id' })
      if (upErr) throw new Error(`quality_reports write: ${upErr.message}`)
    }

    // ---- THE EMAIL ----
    const n = thingsToLookAt(report.hits)
    const built = buildEmail(win, totals?.counts ?? {}, priorCounts, report, n)
    emailText = built.text
    const sent = opts.dry
      ? { ...built, sent: false, id: null, error: 'dry run — nothing was sent' }
      : await sendIt(built)

    counts = {
      ...Object.fromEntries(COUNTERS.map((c) => [c.key, (report.hits[c.key] ?? []).length])),
      things_to_look_at: n,
      day: win.day, window_from: win.from, window_to: win.to,
      companies_written: dayRows.length - 1,
      read: {
        turns: turns.length, topics: topicsById.size, summarised: summarisedTopics.length,
        runs: runs.length, sections: sections.length, findings: findings.length,
        scans: scans.length, calls_day: callsDay.length, calls_prior_7: callsPrior7.length,
        documents_reading: stuckDocuments.length, job_runs: jobRuns.length,
      },
      cost_usd: report.cost.usd,
      dry: Boolean(opts.dry),
      email: { to: sent.to, subject: sent.subject, sent: sent.sent, id: sent.id, error: sent.error ?? null },
    }
  } catch (e) {
    errors.push({ step: '(run)', error: e instanceof Error ? e.message : String(e) })
  }

  await run.finish(counts, errors)
  return NextResponse.json({ job: 'quality', run: run.id, ...counts, errors, text: emailText })
}

// ===========================================================================
// THE EMAIL. Plain text, counts and deltas only, with the link — decision 75.
//
// It is built from `renderEmail`'s shape (`lib/email.ts`) and only its `text` half is sent, which
// is what the owner asked for. Using the shared shape rather than pushing strings into an array
// is why the footer, the wordmark and what a row looks like stay decided in one place — the whole
// argument of decision 25, and the reason F8 exists for the three older senders.
// ===========================================================================

function buildEmail(
  win: { day: string; from: string; to: string },
  totals: Record<string, unknown>,
  prior: Record<string, unknown> | undefined,
  report: ReturnType<typeof buildReport>,
  n: number,
): { subject: string; text: string; to: string } {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  const link = appUrl ? `${appUrl}/quality` : '/quality'
  const priorOf = (key: string): number | null => {
    if (!prior) return null
    const v = prior[key]
    return typeof v === 'number' ? v : null
  }

  const rowsFor = (scope: 'day' | 'now') => COUNTERS.filter((c) => c.scope === scope).map((c) => {
    const here = Number(totals[c.key] ?? 0)
    return {
      primary: `${here} · ${c.title}`,
      secondary: here === 0
        ? deltaWord(here, priorOf(c.key))
        : `${deltaWord(here, priorOf(c.key))} — ${c.why}`,
    }
  })

  const sections = [
    { heading: 'Yesterday', rows: rowsFor('day') },
    {
      heading: 'Right now',
      rows: [
        ...rowsFor('now'),
        ...report.pulse.map((p) => ({
          primary: `${p.job} · ${p.minutes_ago === null ? 'never run' : `last started ${p.minutes_ago} min ago`}`,
          secondary: `${p.open_rows} row${p.open_rows === 1 ? '' : 's'} left open`,
        })),
      ],
    },
    {
      heading: COST_TITLE,
      rows: [
        {
          primary: `$${report.cost.usd.toFixed(4)} over ${report.cost.calls} call${report.cost.calls === 1 ? '' : 's'}`,
          secondary: report.cost.unpriced
            ? `${report.cost.unpriced} call${report.cost.unpriced === 1 ? '' : 's'} had no price for its model, so this total is LOW`
            : 'every call had a price for its model',
        },
        ...report.cost.by_task.map((t) => ({
          primary: `${t.task} · $${t.usd.toFixed(4)} · ${t.calls} call${t.calls === 1 ? '' : 's'}`,
          secondary: t.over_2x
            ? `OVER TWICE its 7-day average of $${t.avg7.toFixed(4)}`
            : `7-day average $${t.avg7.toFixed(4)}`,
        })),
      ],
    },
  ]

  const { text } = renderEmail({
    title: `${NIGHT_WATCH} · ${win.day}`,
    lede: n === 0 ? ALL_CLEAR
      : `${n} of the eleven counts ${n === 1 ? 'is' : 'are'} not zero.`,
    sections,
    button: { label: 'Open Night Watch', href: link },
    footer: [windowLine(win.day, win.from, win.to), HR_IS_WATCHED, PULSE_WHY, EMAIL_FOOTER],
  })

  const override = (process.env.NOTIFY_TEST_TO ?? '').trim()
  const to = override || (process.env.QUALITY_EMAIL ?? '').trim()
  return { subject: subjectLine(win.day, n), text, to }
}

/**
 * ===========================================================================
 * ⚡ THIS IS THE ONE EMAIL THAT SENDS FROM THE SANDBOX ADDRESS ON PRODUCTION, DELIBERATELY.
 * ===========================================================================
 *
 * The owner's decision, 5 November 2026. `lib/email.ts`'s `sandboxSenderRefusal` exists to stop a
 * **customer** being mailed from `onboarding@resend.dev`, Resend's shared sandbox address, which
 * has no SPF, DKIM or DMARC for compliboard.com (`PENDING.md` S1, open since 16 October). This
 * email has exactly one recipient and it is the Resend account's own address — the one address
 * that sender can reach (`PENDING.md` H2). So the guard is **not** called here, and the reason is
 * this paragraph rather than an omission somebody has to guess at.
 *
 * It uses `SANDBOX_FROM` from `lib/email.ts` and not a literal, so the day the domain is verified
 * this sender moves with the other two. Four of the six senders hold the address as a literal and
 * will not (`docs/GAPS-PLAN.md` §8); this one is on the right side of that count from the start.
 *
 * On staging `NOTIFY_TEST_TO` is the recipient, as every other sender does.
 */
async function sendIt(built: { subject: string; text: string; to: string }):
  Promise<{ subject: string; text: string; to: string; sent: boolean; id: string | null; error?: string }> {
  if (!built.to) {
    console.error('NIGHT WATCH: no recipient. Set QUALITY_EMAIL (or NOTIFY_TEST_TO on staging). '
                  + 'The report was written; the email was not sent.')
    return { ...built, sent: false, id: null, error: 'no recipient (QUALITY_EMAIL / NOTIFY_TEST_TO unset)' }
  }
  const key = (process.env.RESEND_API_KEY ?? '').trim()
  if (!key) return { ...built, sent: false, id: null, error: 'RESEND_API_KEY is not set' }
  try {
    const res = await new Resend(key).emails.send({
      from: SANDBOX_FROM, to: built.to, subject: built.subject, text: built.text,
    })
    if (res.error) return { ...built, sent: false, id: null, error: res.error.message }
    return { ...built, sent: true, id: res.data?.id ?? null }
  } catch (e) {
    return { ...built, sent: false, id: null, error: e instanceof Error ? e.message : String(e) }
  }
}

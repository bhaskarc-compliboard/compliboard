// THE AUDIT EMAIL — Audits Run 2b, item 8.
//
// *** EVERY FINISHED RUN IS EMAILED. THERE IS NO BATCH-OF-ONE SILENCE. ***
// `lib/documentBatch.ts` can reasonably stay quiet about a single file, because reading one document
// takes under two minutes and the person is usually still on the page watching the row fill in. An
// audit is not that. One agency is 30 to 70 seconds on the cheapest model and minutes on a real one,
// a company with four agencies is most of a coffee break, and the whole reason the work is queued
// rows and a cron is that **the person has left.** An audit that finishes silently is an audit
// nobody reads.
//
// Everything else is `notifyBatch`'s shape, on purpose: plain text, the summary and nothing else,
// the `NEXT_PUBLIC_APP_URL` refusal, the `NOTIFY_TEST_TO` override that says at the top where it was
// really addressed, and `notified_at` set only on a send that actually succeeded.

import { Resend } from 'resend'
import { longDate } from './summaryWords.ts'
import { renderEmail, type EmailContent, type EmailBlock } from './emailFrame.ts'
import { emailFrom } from './emailSender.ts'

import { runSummaryLine, type RunSummary } from './auditRun.ts'

/**
 * *** THIS FILE MUST NOT IMPORT `lib/auth.ts`, AND THAT IS NOT A STYLE POINT. ***
 * `lib/auth.ts` imports `next/server`, which plain Node cannot resolve — so importing
 * `supabaseAdmin` here made `lib/auditNotify.ts` unloadable outside a Next request, which broke
 * the one-line way to read an email body that `docs/TESTING.md`'s audit set tells a person to use.
 * Found by running that line. The caller already holds a service-role client (the sweep passes
 * `supabaseAdmin`), so the login's address is looked up through THAT client rather than a second
 * one imported here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; auth?: { admin?: { getUserById: (id: string) => Promise<any> } } }

const WORD: Record<string, string> = {
  nothing_on_file: 'nothing on file',
  stale: 'out of date',
  on_file: 'on file',
  not_a_document_question: 'no document can answer this',
}

export interface NotifyResult {
  notified: boolean
  to?: string
  id?: string | null
  error?: string
  subject?: string
  text?: string
  /**
   * The HTML part, on a DRY RUN only. Without it the only way to look at what this email would
   * look like is to send it — which is how Calendar B5's renders came to be hand-written fixtures
   * that said things the product never says (B8 items 2 and 3). A render is evidence only if it
   * comes out of the code that sends.
   */
  html?: string
}

/**
 * THE SUBJECT LINE — fix list **A9**, root R3, Job E3.
 *
 * *** THE SUBJECT COUNTS WHAT NEEDS A PERSON, NOT EVERY ROW — ruled 30 September. ***
 * `total` includes the permit that IS on file, the date that is months away, and the expected item
 * that is only a suggestion. A subject line that counts those is alarming and wrong.
 *
 * *** AND IT NOW BRANCHES ON WHAT FINISHED, WHICH IS A9. ***
 *
 * It used to read `needs_person ? "N things that need you" : "nothing needs you"` — and
 * `needs_person` is counted from the FINDINGS, so a run whose every section hit a rate limit has
 * none, and the email went out saying **"Your Oregon DEQ audit: nothing needs you"**. The body has
 * always carried the "N of M parts did not finish" line; the subject is what a person reads in a
 * list of mail, and it said the opposite. `CLAUDE.md` §5.1 and root R3 in one line: an empty list
 * printed as a statement, when the truth is "not read".
 *
 * Pure and exported so the wording is testable without a database or a send.
 */
export function auditSubject(summary: RunSummary): string {
  // A note on the run is a sentence about the audit itself — "this checklist names somebody else" —
  // and it outranks any count, exactly as `runSummaryLine` treats it.
  if (summary.note) return 'Your audit is done'

  const who = summary.agencies.length === 1 ? summary.agencies[0] : 'compliance'
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
  const needs = summary.needs_person
    ? `${summary.needs_person} ${plural(summary.needs_person, 'thing that needs', 'things that need')} you`
    : null
  const failed = summary.could_not_complete
    ? `${summary.could_not_complete} of ${summary.sections} `
      + `${plural(summary.sections, 'part', 'parts')} did not finish`
    : null

  if (failed) {
    // NOTHING FINISHED AT ALL. There is no result to report, so the subject must not describe one.
    if (!summary.sections_done) return `Your ${who} audit could not be finished`
    // Some did. Both halves go in the subject, and "nothing needs you" is never said when a part
    // of the audit never ran — what those parts would have found is not known.
    return needs ? `Your ${who} audit: ${needs}, and ${failed}`
      : `Your ${who} audit: ${failed}`
  }
  return needs ? `Your ${who} audit: ${needs}` : `Your ${who} audit: nothing needs you`
}

/**
 * One email per finished run, to the login that started it.
 *
 * *** `notified_at` IS THE GUARD AND IT IS SET ONLY AFTER A SUCCESSFUL SEND. *** A row stamped
 * before the send means a failed send is never retried and nobody ever knows; a row stamped after
 * means the worst case is one duplicate, which is recoverable. `finishRunIfDone` has already claimed
 * the run with `.neq('status','done')`, so only one caller ever reaches this for a given run.
 */
export async function notifyRun(
  db: Db, runId: string, summary: RunSummary,
  // *** `dryRun` RENDERS AND SENDS NOTHING. *** So the manual test and check:live can show the
  // exact body a customer would get without putting mail in anybody's inbox, and so "what does the
  // email say" is answerable without emptying `notified_at` and re-sending.
  opts: { dryRun?: boolean } = {},
): Promise<NotifyResult> {
  const { data: run } = await db.from('audit_runs')
    .select('id, company_id, created_by, agency_label, notified_at, readings_as_of, kind')
    .eq('id', runId).maybeSingle()
  if (!run) return { notified: false, error: `no run ${runId}` }
  if (run.notified_at && !opts.dryRun) return { notified: false, error: 'already notified' }

  // *** THE LOGIN'S ADDRESS IS IN `auth.users`, NOT IN `profiles`. ***
  // `profiles` carries no email column at all — `check-schema-contracts` refused this file for
  // reading one, which is exactly what it is for, and the refusal was worth having: the sweep had
  // already sent an email successfully because `NOTIFY_TEST_TO` was set, so the broken lookup was
  // invisible. On production, where the override is absent and must stay absent, every audit email
  // would have had nobody to go to. `finishBatchIfDone` reads it through the admin API
  // (`app/api/jobs/scan-documents/route.ts:350`) and so does this.
  let realTo = ''
  if (run.created_by) {
    const admin = db.auth?.admin
    if (!admin) {
      // Said out loud rather than silently addressed to nobody: a client without admin rights
      // cannot read `auth.users`, and an email with no recipient is a failure worth a log line.
      console.error('AUDIT EMAIL: the client given to notifyRun cannot read auth.users, so the '
        + 'login on this run could not be resolved. Pass the service-role client.')
    } else {
      const { data: user } = await admin.getUserById(run.created_by as string)
      realTo = user?.user?.email ?? ''
    }
  }

  // THE COMPANY'S NAME, for the frame's letterhead (B5). Read separately because `audit_runs`
  // carries only `company_id`. **A failed read is not an empty name** (§3.12, R2): the frame falls
  // back to "Your company" and the failure is said in the log, rather than a blank line appearing
  // under the wordmark where the customer's own name should be.
  let companyName: string | null = null
  if (run.company_id) {
    const { data: co, error: coErr } = await db.from('companies')
      .select('name').eq('id', run.company_id).maybeSingle()
    if (coErr) console.error(`AUDIT EMAIL: could not read the company name: ${coErr.message}`)
    companyName = co?.name ?? null
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  const override = (process.env.NOTIFY_TEST_TO ?? '').trim()
  const to = override || realTo

  const subject = auditSubject(summary)

  // *** THE SAME FRAME AS EVERY OTHER EMAIL *** (`lib/emailFrame.ts`, Calendar B5). Audits' WORDS
  // are unchanged — they are Audits' own. What is new is that they are described once, as data, and
  // rendered as HTML and plain text from that one description, so the two cannot drift apart.
  const blocks: EmailBlock[] = [{ kind: 'para', text: runSummaryLine(summary) }]

  if (run.readings_as_of) {
    blocks.push({ kind: 'note',
      // "8 October 2026", not "2026-10-08" — the owner, B8. A date a person reads should be
      // written the way they write it; `longDate` is the same helper the summaries use.
      text: `Read against your documents as they stood on ${longDate(String(run.readings_as_of))}.` })
  }

  if (summary.attention.length) {
    blocks.push({
      kind: 'list',
      heading: 'What needs you:',
      rows: summary.attention.map((a) => {
        const w = a.word ? WORD[a.word] ?? a.word : null
        return { main: `${a.title}${w ? ` — ${w}` : ''}${a.document ? ` (${a.document})` : ''}` }
      }),
      // *** THE COUNT AND THE LIST MUST AGREE *** (the owner, B8).
      //
      // The subject says "N things that need you" from `needs_person`, which is
      // `nothing_on_file + stale + contradictions + not_a_document_question` (`lib/auditRun.ts:1220`).
      // `attention` holds only the first two, capped at 25 (`:1240`). This line used to subtract
      // `nothing_on_file + stale` — the same two — so the subject could say 5, the list show 3,
      // and no "…and 2 more" appear at all, because the two missing rows were contradictions.
      // Subtracting from `needs_person` makes the listed rows plus this line always add up to the
      // number in the subject, whichever kinds the run happened to produce.
      more: summary.needs_person > summary.attention.length
        ? `…and ${summary.needs_person - summary.attention.length} more.`
        : null,
    })
  }

  // *** AND THEN THE GOOD NEWS, IN ITS OWN WORDS. *** On-file and expected rows are most of what
  // an audit writes and none of it needs anybody today, so it sits after the list that does — but
  // it is not left out: "12 on file" is the half of the answer a person actually wanted.
  // Sentence shapes, the same as the page's and the summary line's (Run 7b, item 7): a clause per
  // number, plurals right at one, joined with a comma and an "and".
  const after: string[] = []
  if (summary.on_file) {
    after.push(`${summary.on_file} thing${summary.on_file === 1 ? '' : 's'} on file`)
  }
  if (summary.expected) {
    after.push(`${summary.expected} thing${summary.expected === 1 ? '' : 's'} we would expect a `
      + `company like yours to hold and did not see — a suggestion, not a checked requirement`)
  }
  if (after.length) {
    blocks.push({ kind: 'para',
      text: `It also found ${after.length === 2 ? `${after[0]} and ${after[1]}` : after[0]}.` })
  }

  if (summary.contradictions) {
    blocks.push({ kind: 'para', text: summary.contradictions === 1
      ? 'Two of your documents disagree in one place. The audit shows both and does not pick one.'
      : `Two of your documents disagree in ${summary.contradictions} places. The audit shows both `
        + 'and does not pick one.' })
  }
  if (summary.carried || summary.closed) {
    blocks.push({ kind: 'para', text: `Against your last audit: ${summary.carried} still open, `
      + `${summary.closed} no longer raised.` })
  }
  if (summary.could_not_complete) {
    // §5.1 — when the failure is ours, say so plainly and never imply the customer did something
    // wrong. A section that did not finish is our problem and it can be run again.
    blocks.push({ kind: 'para', text: `${summary.could_not_complete} of ${summary.sections} part`
      + `${summary.sections === 1 ? '' : 's'} of this audit did not finish. That is our side, not `
      + `yours — you can run those again from the page.` })
  }
  // *** WHY A SECOND EMAIL CAME ABOUT ONE AUDIT *** (A9, Job E3). The retry clears `notified_at`,
  // so a corrected run is emailed — and an email that arrives with no explanation of why it is the
  // second one reads like a mistake.
  if (summary.retried_parts) {
    blocks.push({ kind: 'para', text: `This replaces the email we sent before: `
      + `${summary.retried_parts === 1 ? 'one part' : `${summary.retried_parts} parts`} of this `
      + `audit ${summary.retried_parts === 1 ? 'was' : 'were'} run again, and the result below is `
      + `the one that counts.` })
  }

  const content: EmailContent = {
    company: companyName ?? 'Your company',
    title: subject,
    banner: override && override !== realTo
      ? `[staging: this would have gone to ${realTo || '(nobody)'}]` : null,
    blocks,
    // The link opens THIS run's report, not the page it sits on. An email whose link lands a person
    // on a list they then have to search is an email that made them do the work twice.
    button: { label: 'See it all', href: `${appUrl}/audits?run=${runId}` },
    // The owner's words, B8. It goes only to the person who started the audit.
    why: 'You get this because you asked CompliBoard to run this audit.',
  }

  const { text, html } = renderEmail(content)
  if (opts.dryRun) return { notified: false, error: 'dry run — nothing was sent', to, subject, text, html }

  // The link comes from the environment, and without it nothing is sent. A wrong link is worse
  // than no email: an email that does not arrive looks unfinished, one with a dead link looks
  // broken. `documentBatch` says the same in more words; the reasoning is not repeated.
  if (!appUrl) {
    console.error('AUDIT EMAIL NOT SENT: NEXT_PUBLIC_APP_URL is not set, so the link would not have '
      + 'worked. The run and its findings are on the page either way.')
    return { notified: false, error: 'NEXT_PUBLIC_APP_URL is not set', to, subject, text }
  }
  if (!to) {
    return { notified: false, error: 'the run has no login to send to', to, subject, text }
  }
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error('AUDIT EMAIL NOT SENT: RESEND_API_KEY is not set.')
    return { notified: false, error: 'RESEND_API_KEY is not set', to, subject, text }
  }

  try {
    const resend = new Resend(key)
    const res = await resend.emails.send({
      from: emailFrom(),
      to, subject, text, html,
    })
    if (res.error) return { notified: false, error: res.error.message, to, subject, text }

    // Only now. A stamp before the send is a failure nobody can see.
    await db.from('audit_runs').update({ notified_at: new Date().toISOString() })
      .eq('id', runId).is('notified_at', null)
    return { notified: true, id: res.data?.id ?? null, to, subject, text }
  } catch (e) {
    return { notified: false, error: e instanceof Error ? e.message : String(e), to, subject, text }
  }
}

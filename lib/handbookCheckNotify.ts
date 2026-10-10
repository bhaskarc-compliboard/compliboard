// THE HANDBOOK CHECK EMAIL — HR Step 8, finished (copied from Audits' email, `lib/auditNotify.ts` notifyRun, which is
// only read here, never edited).
//
// *** SENT ONLY FOR A CHECK SOMEONE PRESSED, ONCE, WHEN IT FINISHES, TO THAT PERSON'S LOGIN. *** A check nobody
// pressed (the nightly one, step 10) has no `requested_by` and sends nothing. Called from ONE place: the sweep, right
// after `finishCheckIfDone` reports the check finished (`lib/handbookCheck.ts` sweepChecks) — where Audits' sweep
// calls notifyRun. `finishCheckIfDone` claims the finish with a compare-and-set, so only one caller ever reaches this
// for a given check.
//
// Everything else is notifyRun's shape, on purpose: plain text; the `NEXT_PUBLIC_APP_URL` refusal; the
// `NOTIFY_TEST_TO` override that says at the top where it was really addressed; `notified_at` (migration 071) set only
// after a send that actually succeeded, so the worst case is a duplicate, never silence. Like Audits' email, it ends
// with its link: Audits' email has no sign-off line, so neither does this one.
//
// *** THIS FILE MUST NOT IMPORT `lib/auth.ts` *** (notifyRun's note): plain Node must be able to load it for the dry run.
import { Resend } from 'resend'
import { renderEmail, type EmailContent, type EmailBlock } from './emailFrame.ts'
import { emailFrom } from './emailSender.ts'
import { longDate } from './summaryWords.ts'
import { checkParts, partsNotChecked, type RowIn } from './handbookCheckView.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; auth?: { admin?: { getUserById: (id: string) => Promise<any> } } }

/**
 * WHERE THE HR PAGE LIVES — ONE CONSTANT. /hr since the go-live (HR Step 13); it was /hr/new behind the preview
 * switch. `?handbook=<id>` opens that handbook's drawer (`app/hr/HrWorkspace.tsx`).
 */
export const HR_PAGE_PATH = '/hr'
export const handbookLink = (appUrl: string, handbookId: string) => `${appUrl}${HR_PAGE_PATH}?handbook=${encodeURIComponent(handbookId)}`

/** The words (proposed in the brief; the owner says yes or changes them). */
export const EMAIL = {
  doneSubject: (name: string) => `Your handbook check is done: ${name}`,
  doneLine: (name: string, date: string) => `${name} was checked against the rules that apply to you on ${date}.`,
  partsLine: (n: number) => `${n} part${n === 1 ? '' : 's'} could not be checked. Press Check now to try again.`,
  readLine: (link: string) => `Read the check: ${link}`,
  failedSubject: (name: string) => `Your handbook check could not finish: ${name}`,
  failedLine: (name: string, link: string) =>
    `We could not finish checking ${name}. That's on our side, not yours. Press Check now to try again: ${link}`,
} as const

export interface NotifyResult {
  notified: boolean; to?: string; id?: string | null; error?: string; subject?: string; text?: string
  /**
   * The HTML part, on a DRY RUN only. Without it the only way to look at what this email would
   * look like is to send it — which is how Calendar B5's renders came to be hand-written fixtures
   * that said things the product never says (B8 items 2 and 3). A render is evidence only if it
   * comes out of the code that sends.
   */
  html?: string
}

export async function notifyCheck(db: Db, checkId: string, opts: { dryRun?: boolean } = {}): Promise<NotifyResult> {
  const { data: check } = await db.from('handbook_checks')
    .select('id, handbook_id, status, requested_by, notified_at, finished_at').eq('id', checkId).maybeSingle()
  if (!check) return { notified: false, error: `no check ${checkId}` }
  // Only a check someone pressed. The nightly check (step 10) has nobody to tell.
  if (!check.requested_by) return { notified: false, error: 'nobody pressed this check, so nobody is emailed' }
  if (check.status !== 'done' && check.status !== 'failed') return { notified: false, error: `the check is ${check.status}, not finished` }
  if (check.notified_at && !opts.dryRun) return { notified: false, error: 'already notified' }

  const { data: hb } = await db.from('handbooks').select('id, name, company_id').eq('id', check.handbook_id).maybeSingle()
  const name = hb?.name ?? 'Your handbook'
  // The company's name, for the frame's letterhead (B5). A failed read is NOT an empty name: the
  // frame falls back to "Your company" and the failure is said, rather than a blank line appearing
  // under the wordmark where the customer's own name belongs (§3.12, R2).
  let companyName: string | null = null
  if (hb?.company_id) {
    const { data: co, error: coErr } = await db.from('companies')
      .select('name').eq('id', hb.company_id).maybeSingle()
    if (coErr) console.error(`HANDBOOK CHECK EMAIL: could not read the company name: ${coErr.message}`)
    companyName = co?.name ?? null
  }

  // The login's address is in auth.users, read through the admin API of the client the sweep passes (notifyRun).
  let realTo = ''
  const admin = db.auth?.admin
  if (!admin) {
    console.error('HANDBOOK CHECK EMAIL: the client given to notifyCheck cannot read auth.users. Pass the service-role client.')
  } else {
    const { data: user } = await admin.getUserById(check.requested_by as string)
    realTo = user?.user?.email ?? ''
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  const override = (process.env.NOTIFY_TEST_TO ?? '').trim()
  const to = override || realTo
  const link = handbookLink(appUrl, check.handbook_id)

  // *** THE SAME FRAME AS EVERY OTHER EMAIL *** (`lib/emailFrame.ts`, Calendar B5). HR's WORDS are
  // unchanged — `EMAIL` above still holds every one of them. What is new is that they are described
  // once, as data, and rendered as HTML and plain text from that one description.
  //
  // `readLine` and `failedLine` carry the link INSIDE the sentence, which is right in plain text and
  // wrong in HTML, where it would print a bare URL beside a green button going to the same place. So
  // the sentence is built without the link and the link becomes the button. The words either side of
  // it are untouched, and `EMAIL`'s entries stay exactly as they were for the tests that read them.
  const blocks: EmailBlock[] = []
  let subject: string
  if (check.status === 'failed') {
    subject = EMAIL.failedSubject(name)
    blocks.push({ kind: 'para', text: EMAIL.failedLine(name, link).replace(`: ${link}`, '.') })
  } else {
    subject = EMAIL.doneSubject(name)
    blocks.push({ kind: 'para', text: EMAIL.doneLine(name, longDate(check.finished_at ?? new Date().toISOString())) })
    // Parts that could not be checked, counted in code from the stored rows, as the page counts them.
    const { data: rows, error: rowsErr } = await db.from('handbook_check_sections').select('id, section_id, kind, status, word, answer_text, answer_sources').eq('check_id', checkId)
    const { data: secs, error: secsErr } = await db.from('handbook_sections').select('id, position').eq('handbook_id', check.handbook_id)
    // R2: a failed read here would count ZERO parts that could not be checked — an email saying
    // nothing went wrong because we could not ask. Said, and the line left out rather than stated.
    if (rowsErr || secsErr) {
      console.error('HANDBOOK CHECK EMAIL: could not count the parts that failed: '
        + `${rowsErr?.message ?? ''} ${secsErr?.message ?? ''}`.trim())
    } else {
      const pos = new Map(((secs ?? []) as Array<{ id: string; position: number }>).map((s) => [s.id, s.position]))
      const failedParts = partsNotChecked(checkParts((rows ?? []) as RowIn[], (id) => pos.get(id ?? '') ?? 1e9, () => '', () => []))
      if (failedParts) blocks.push({ kind: 'para', text: EMAIL.partsLine(failedParts) })
    }
  }

  const content: EmailContent = {
    company: companyName ?? 'Your company',
    title: subject,
    banner: override && override !== realTo
      ? `[staging: this would have gone to ${realTo || '(nobody)'}]` : null,
    blocks,
    button: { label: check.status === 'failed' ? 'Try again' : 'Read the check', href: link },
    // THE LINE THIS EMAIL DID NOT HAVE, in the shape of the one the owner approved for Documents.
    // It goes only to the person who pressed Check — the nightly check emails nobody.
    //
    // *** AND IT DOES NOT SAY "we've finished" WHEN WE DID NOT. *** The first version of this line
    // was the same sentence for both cases, which put "and we've finished" two lines under "We
    // could not finish checking Harbor Handbook". A failing test printed the two together and that
    // is the only reason it was seen (§5.1: never claim of a job what it did not do).
    why: check.status === 'failed'
      ? 'You get this because you asked CompliBoard to check your handbook.'
      : 'You get this because you asked CompliBoard to check your handbook, '
        + 'and we\u2019ve finished.',
  }

  const { text, html } = renderEmail(content)
  if (opts.dryRun) return { notified: false, error: 'dry run — nothing was sent', to, subject, text, html }

  // notifyRun's refusals, in its order: no link, no address, no key — each said out loud, nothing stamped.
  if (!appUrl) {
    console.error('HANDBOOK CHECK EMAIL NOT SENT: NEXT_PUBLIC_APP_URL is not set, so the link would not have worked. '
      + 'The check is on the page either way.')
    return { notified: false, error: 'NEXT_PUBLIC_APP_URL is not set', to, subject, text }
  }
  if (!to) return { notified: false, error: 'the check has no login to send to', to, subject, text }
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error('HANDBOOK CHECK EMAIL NOT SENT: RESEND_API_KEY is not set.')
    return { notified: false, error: 'RESEND_API_KEY is not set', to, subject, text }
  }
  try {
    const resend = new Resend(key)
    const res = await resend.emails.send({ from: emailFrom(), to, subject, text, html })
    if (res.error) return { notified: false, error: res.error.message, to, subject, text }
    // Only now. A stamp before the send is a failure nobody can see.
    await db.from('handbook_checks').update({ notified_at: new Date().toISOString() }).eq('id', checkId).is('notified_at', null)
    return { notified: true, id: res.data?.id ?? null, to, subject, text }
  } catch (e) {
    return { notified: false, error: e instanceof Error ? e.message : String(e), to, subject, text }
  }
}

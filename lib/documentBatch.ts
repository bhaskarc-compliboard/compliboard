/**
 * A BATCH: WHAT AN UPLOAD IS, ONCE THERE ARE MORE FILES THAN A PERSON WILL WATCH.
 *
 * Documents Run 7. Two things live here because both the page and the sweep need them and a
 * second copy of either would be a second answer to the same question:
 *
 *   · `summariseBatch` — the counts and the titles behind them, read off `document_index_v`
 *   · `notifyBatch`    — the one email, through the Resend wiring `/api/feedback` already uses
 *
 * *** THE SUMMARY HAS NOTHING OF ITS OWN. *** Every number and every line in it is a row in the
 * index the Documents page shows. That is the vision's rule for the email — "it reads the same
 * rows the page reads" — and it is why the banner and the email cannot disagree: they are one
 * function called twice.
 */
import { Resend } from 'resend'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/**
 * *** THE LINE BETWEEN A FEW FILES AND MANY. ***
 *
 * Three or fewer are read in the page, one after another, with the row filling in as each lands.
 * Four or more go to the background sweep.
 *
 * WHY THREE. A scan is 20 to 120 seconds against a whole PDF. Three is about five minutes of
 * somebody sitting and watching, which is the longest a person will treat as "it is working"
 * rather than "it has hung" — and it is also the point at which the page stops being able to
 * promise it: a browser tab closed at file four of thirty must not lose files five to thirty.
 * Four is therefore not a performance threshold. It is the number above which the product can
 * no longer honestly say "wait here and it will be done".
 *
 * It is one constant read by the page and named in the tests, so moving it moves both.
 */
export const LIVE_SCAN_MAX = 3

export interface BatchSummary {
  total: number
  read: number
  needs_work: number
  expiring: number
  expired: number
  could_not_read: number
  /** The titles behind each count, so a number is never shown without what it is made of. */
  attention: Array<{ title: string; status: string; reason: string | null }>
  fine: string[]
}

const WORD: Record<string, string> = {
  needs_work: 'needs work', expiring: 'expiring', expired: 'expired',
  could_not_read: 'could not be read', current: 'current', recorded: 'recorded',
  on_file: 'on file', not_yet_read: 'not read yet',
}

/**
 * What this batch came to. Read from `document_index_v` — the row the page groups by, the row
 * the drawer opens — so a correction made before the email goes out is in the email.
 */
export async function summariseBatch(db: Db, batchId: string): Promise<BatchSummary> {
  const { data: docs } = await db.from('documents').select('id').eq('batch_id', batchId)
  const ids = ((docs ?? []) as Array<{ id: string }>).map((d) => d.id)
  if (!ids.length) {
    return { total: 0, read: 0, needs_work: 0, expiring: 0, expired: 0, could_not_read: 0, attention: [], fine: [] }
  }
  const { data: rows } = await db.from('document_index_v')
    .select('document_id, title, display_status, could_not_read_reason')
    .in('document_id', ids).order('title')
  const list = (rows ?? []) as Array<{
    title: string; display_status: string; could_not_read_reason: string | null
  }>

  const count = (s: string) => list.filter((r) => r.display_status === s).length
  // ATTENTION IS THE FOUR AMBER STATUSES, and "could not read" is one of them. An unreadable
  // file is a status said out loud, never dropped from a count (§5.1).
  const attention = list
    .filter((r) => ['needs_work', 'expiring', 'expired', 'could_not_read'].includes(r.display_status))
    .map((r) => ({ title: r.title, status: r.display_status, reason: r.could_not_read_reason }))

  return {
    total: list.length,
    // "Read" is every file we got a reading out of — which is all of them except the ones we
    // could not open. A document that needs work was read perfectly well.
    read: list.length - count('could_not_read'),
    needs_work: count('needs_work'),
    expiring: count('expiring'),
    expired: count('expired'),
    could_not_read: count('could_not_read'),
    attention,
    fine: list.filter((r) => !['needs_work', 'expiring', 'expired', 'could_not_read'].includes(r.display_status))
      .map((r) => r.title),
  }
}

/** The sentence the banner and the email both open with. One phrasing, one place. */
export function summaryLine(s: BatchSummary): string {
  const bits: string[] = []
  if (s.needs_work) bits.push(`${s.needs_work} need${s.needs_work === 1 ? 's' : ''} work`)
  if (s.expiring) bits.push(`${s.expiring} ${s.expiring === 1 ? 'is' : 'are'} expiring`)
  if (s.expired) bits.push(`${s.expired} ${s.expired === 1 ? 'has' : 'have'} expired`)
  if (s.could_not_read) bits.push(`${s.could_not_read} we couldn't read`)
  const head = `We've read your ${s.total} document${s.total === 1 ? '' : 's'}`
  return bits.length ? `${head}: ${bits.join(', ')}.` : `${head}. Nothing needs attention.`
}

/**
 * THE EMAIL. Plain text, and the body is the summary — nothing else.
 *
 * *** IT HAS NOTHING OF ITS OWN. *** Every line below is a row in `document_index_v`. No
 * advice, no encouragement, no restatement of what the product is for. A person who reads this
 * on a phone at seven in the morning should be able to decide in four seconds whether to open
 * the laptop, and anything that is not one of their documents is in the way of that.
 *
 * *** PLAIN TEXT, NOT HTML. *** `/api/feedback` sends HTML because it is a form dropping a
 * message into an inbox we own. This goes to a customer, it is a list, and a list in plain text
 * arrives the same way in every client. There is nothing here that needs a typeface.
 *
 * *** `NOTIFY_TEST_TO` OVERRIDES THE RECIPIENT. *** Staging's fixture companies carry example.com
 * logins that nobody receives, so testing the email would otherwise mean testing that Resend
 * accepted it. The override is read only when it is set, it is never set in production, and the
 * body says at the top where it was really addressed — an email whose recipient was silently
 * changed is a test that proves the wrong thing.
 */
export async function notifyBatch(args: {
  to: string
  companyName: string | null
  summary: BatchSummary
  appUrl: string
}): Promise<{ ok: true; id: string | null; to: string; subject: string; text: string }
        | { ok: false; error: string; to: string; subject: string; text: string }> {
  const { summary: s, appUrl } = args
  const override = (process.env.NOTIFY_TEST_TO ?? '').trim()
  const to = override || args.to

  const subject = `We've read your ${s.total} document${s.total === 1 ? '' : 's'}`

  const lines: string[] = []
  if (override && override !== args.to) {
    lines.push(`[staging: this would have gone to ${args.to}]`, '')
  }
  lines.push(summaryLine(s), '')

  if (s.attention.length) {
    lines.push('What needs attention:')
    for (const a of s.attention) {
      lines.push(a.reason
        ? `  ${a.title} — ${WORD[a.status] ?? a.status}. ${a.reason}`
        : `  ${a.title} — ${WORD[a.status] ?? a.status}`)
    }
    lines.push('')
  }
  if (s.fine.length) {
    lines.push(`On file and nothing to do: ${s.fine.length}`)
    for (const t of s.fine) lines.push(`  ${t}`)
    lines.push('')
  }
  lines.push(`See them all: ${appUrl}/documents`)

  const text = lines.join('\n')

  // The key is read here rather than at module scope so an unset key is a failure of THIS send,
  // reported and recorded, instead of a module that throws on import and takes the sweep with it.
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set', to, subject, text }

  try {
    const resend = new Resend(key)
    const res = await resend.emails.send({
      from: 'CompliBoard <onboarding@resend.dev>',
      to,
      subject,
      text,
    })
    if (res.error) return { ok: false, error: `${res.error.name}: ${res.error.message}`, to, subject, text }
    return { ok: true, id: res.data?.id ?? null, to, subject, text }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), to, subject, text }
  }
}

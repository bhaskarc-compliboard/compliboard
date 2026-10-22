/**
 * /api/website-read — ONE READ OF THE COMPANY'S OWN WEBSITE. My Account step 13, decision 9.
 *
 * POST starts it. GET says how it went. Nothing here writes a fact about the company: the answer
 * lands in `website_reads` as a PROPOSAL (migration 085), the walk's first screen draws it as a
 * card, and only "Yes, that's us" sends the confirmed parts through the routes that already own
 * them — `/api/company-information` for what they do, `/api/sites` for an address, which geocodes
 * it and lets 083's trigger mirror the main one onto the company row.
 *
 * *** THE SHAPE IS §3.11's: CLAIM, REPLY, FINISH IN `after()`. ***
 *
 *   1. THE CLAIM IS THE ROW. It is inserted as `reading` INSIDE the request, before any fetch, so
 *      a second POST finds it and does nothing, and the walk can never arrive and find nothing at
 *      all. `lib/topicClaim.ts` uses a column for this; a table whose whole purpose is to record
 *      one read already has somewhere to put it.
 *   2. THE REPLY IS 202 AT ONCE, so the signup page can wait for it and still land on the
 *      Dashboard without a pause a person would notice.
 *   3. THE WORK RUNS IN `after()`. Next 16: *"`after` will run for the platform's default or
 *      configured max duration of your route"* — so it gets THIS route's limit, which is why the
 *      limit is declared below rather than inherited. `docs/HANDOFF-CODE.md:610` is the finding
 *      that makes that worth saying out loud: a sweep kicked from a route with no `maxDuration`
 *      runs under a platform default nobody chose.
 *
 * *** AND NOTHING IS GUESSED WHEN IT FAILS. *** Every way this can go wrong has its own `reason`,
 * the sentence the walk shows names the host, and the person is offered the address screen
 * instead. `CLAUDE.md` §5.1: never assert anything about a document the product did not
 * successfully read — and a website nobody could fetch is exactly that.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { askAI, extractJsonText } from '@/lib/ai'
import { readSite } from '@/lib/websiteFetch'
import {
  WEBSITE_SYSTEM, websitePrompt, WEBSITE_JSON_SCHEMA, parseProposal,
} from '@/prompts/website-read'

/**
 * *** 120 SECONDS, AND HERE IS THE ARITHMETIC. ***
 *
 * The fetch cannot exceed `TOTAL_MS` = 25s by construction, and the model call measured 9.1s and
 * 5.0s on `claude-opus-5-5` for the two real sites read at the step 13 stop. 120 leaves room for a
 * slow site and a slow call at once, and sits far below the 800 the heavy routes declare — this is
 * one short extraction, not an audit. A declared number is the point: `after()` inherits the
 * route's limit, and an undeclared one is whatever the platform applies.
 */
export const maxDuration = 120

/** What `after()` may spend on the model, under the route's own limit either way. */
const MODEL_MAX_TOKENS = 1500

interface ReadRow {
  id: string
  status: 'reading' | 'ready' | 'failed'
  reason: string | null
  host: string
  pages: unknown
  proposal: unknown
  started_at: string
  finished_at: string | null
  accepted_at: string | null
}

const NEWEST = 'id, status, reason, host, pages, proposal, started_at, finished_at, accepted_at'

/** The newest read for one company. `raw_text` is never selected: it is our diagnostic, not theirs. */
async function newestRead(db: { from: (t: string) => any }, companyId: string): Promise<ReadRow | null> {  // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await db
    .from('website_reads').select(NEWEST)
    .eq('company_id', companyId)
    .order('started_at', { ascending: false })
    .limit(1).maybeSingle()
  return (data ?? null) as ReadRow | null
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    // ---- IS THERE A WEBSITE TO READ? Read as the CALLER, so a company's own row and no other. ----
    const { data: company } = await db
      .from('companies').select('website_url').eq('id', companyId).maybeSingle()
    const host = ((company as { website_url: string | null } | null)?.website_url ?? '').trim()
    // The page does not post when the box was empty; this is the boundary saying the same thing.
    if (!host) return NextResponse.json({ started: false, status: 'none' })

    // ---- ONE READ. A row that is reading or ready is the answer to a second press. ----
    // Read as the caller too: the SELECT policy is what proves this company's row is the only one
    // this request can see, rather than an `eq` we wrote and could get wrong.
    const existing = await newestRead(db, companyId)
    if (existing && existing.status !== 'failed') {
      return NextResponse.json({ started: false, status: existing.status })
    }

    // ---- THE CLAIM, AS THE SERVICE ROLE ----
    // `authenticated` holds SELECT on this table and nothing else (085), which is deliberate: every
    // write here is our record of what we did, not a fact the person stated.
    const { data: made, error: claimError } = await supabaseAdmin
      .from('website_reads')
      .insert({ company_id: companyId, host, status: 'reading' })
      .select('id').single()
    if (claimError || !made) {
      console.error('[/api/website-read] could not claim the read:', claimError?.message)
      return NextResponse.json({ started: false, status: 'none' }, { status: 500 })
    }
    const readId = (made as { id: string }).id

    // ---- AND THE WORK, AFTER THE REPLY ----
    after(async () => { await runRead(readId, companyId, host) })

    return NextResponse.json({ started: true, status: 'reading' }, { status: 202 })
  } catch (error) {
    console.error('[/api/website-read POST] failed:', error)
    return NextResponse.json({ started: false, status: 'none' }, { status: 500 })
  }
}

/**
 * The read itself. It never throws: every exit writes a row, because a row stuck on `reading`
 * would leave the walk's first screen spinning for ever with nothing to say.
 */
async function runRead(readId: string, companyId: string, host: string): Promise<void> {
  const finish = async (fields: Record<string, unknown>) => {
    const { error } = await supabaseAdmin
      .from('website_reads').update({ ...fields, finished_at: new Date().toISOString() })
      .eq('id', readId)
    if (error) console.error('[/api/website-read] could not record the result:', error.message)
  }

  try {
    const site = await readSite(host)
    if (!site.ok) {
      await finish({ status: 'failed', reason: site.reason })
      return
    }

    const pages = site.pages.map((p) => ({ url: p.url, chars: p.text.length, bytes: p.bytes }))
    let raw = ''
    try {
      raw = await askAI(WEBSITE_SYSTEM, websitePrompt(host, site.pages), {
        task: 'website',
        maxTokens: MODEL_MAX_TOKENS,
        outputSchema: WEBSITE_JSON_SCHEMA,
        // Now that 085 has widened `ai_calls_task_check`, the ledger can say what this spend was
        // for. The two cards read at the step 13 stop had to be logged as `other`.
        ledger: { companyId, task: 'website' },
      })
    } catch (error) {
      // A refusal, a rate limit, a 400 on the schema. Ours, and said as ours.
      console.error('[/api/website-read] the model call failed:', error)
      await finish({ status: 'failed', reason: 'model_refused', pages })
      return
    }

    // `parseProposal` refuses anything not in shape rather than repairing it. The raw answer is
    // kept either way: on a refusal it is the only thing that can explain it days later (§5).
    let proposal = null
    try {
      proposal = parseProposal(JSON.parse(extractJsonText(raw)))
    } catch {
      proposal = null
    }
    if (!proposal) {
      await finish({ status: 'failed', reason: 'bad_shape', pages, raw_text: raw.slice(0, 3000) })
      return
    }

    await finish({ status: 'ready', pages, proposal, raw_text: raw.slice(0, 3000) })
  } catch (error) {
    console.error('[/api/website-read] failed:', error)
    await finish({ status: 'failed', reason: 'model_refused' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * GET — what the walk's first screen asks, as often as it likes.
 *
 * As the CALLER. `website_reads_select` is `using (company_id = auth_company_id())`, so another
 * company's read is not hidden by an `eq` this route wrote: it is not visible to this request at
 * all. The `eq` is the second lock.
 */
export async function GET(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  try {
    const row = await newestRead(db, companyId)
    if (!row) return NextResponse.json({ status: 'none' })
    return NextResponse.json({
      status: row.status,
      reason: row.reason,
      host: row.host,
      pages: row.pages ?? [],
      proposal: row.proposal ?? null,
      started_at: row.started_at,
      finished_at: row.finished_at,
      accepted_at: row.accepted_at,
    })
  } catch (error) {
    console.error('[/api/website-read GET] failed:', error)
    return NextResponse.json({ status: 'none' }, { status: 500 })
  }
}

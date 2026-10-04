/**
 * "HOW DO I DO THIS?" — ONE CHECKLIST ITEM, RESEARCHED. Workspace Task 6, boards 8 and 9.
 *
 *   POST /api/checklist-items/<id>/how-to        (no body)
 *
 * Returns `{ status: 'done', howto }` (already saved), `{ status: 'researching' }` — 202 when this press
 * started the research, 409 when another click or tab is already on it — or `{ error }`.
 *
 * *** IT CONNECTS AS THE CALLER. *** `requireCompany` gives a client carrying the request's own token,
 * so RLS decides which item can be read and written. Another company's item is a 404, not a 403.
 *
 * *** ONE CLICK, ONE CALL — RECORDED IN THE DATABASE, NOT ONLY IN THE PAGE. *** Before any model call
 * the item is claimed with a compare-and-set: `howto_started_at` is set only where it is empty (or
 * older than `HOWTO_LOCK_MS`, so a run that died without clearing it does not lock the item for ever) and
 * no result is stored yet. No row back means another request holds it, and this one makes no call.
 * A reload or a second tab reads the same column and waits. A run that fails or times out clears it.
 *
 * *** THE CALL IS NOT TIED TO THE BROWSER'S REQUEST. *** If it were, a reload would cancel the
 * research the reload is waiting for. It stops on its own timeout instead (`TIMEOUT_MS`).
 *
 * *** AND SINCE WORKSPACE STAGE 4 THE WORK RUNS AFTER THE REPLY. *** The claim is taken, the route answers
 * 202 at once, and the research runs in `after()` (`next/server`) — on Vercel, `waitUntil` up to
 * `maxDuration` (`app/api/topics/[id]/summarise/route.ts` has the documentation lines). Before, it ran
 * inside the request, and `DECISIONS.md` §138 records work inside a request lost on production when the
 * person left. The page waits on `howto_started_at` exactly as it already did for a 409, and says the
 * look-up failed if the claim clears with no result.
 *
 * *** THE STEPS ARE CHECKED IN CODE (`lib/howTo.ts`). *** A step whose URL is not a page this call's
 * web search returned is dropped and counted; each kept step is labelled official or other.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { askAIOpenStream, extractJsonText, modelForTask, effortForHowto, searchLimit, type SearchResult } from '@/lib/ai'
import { howToPrompt, howToInput } from '@/prompts/how-to'
import { checkHowTo, stripMarkers } from '@/lib/howTo'
import { HOWTO_LOCK_MS } from '@/lib/checklistView'

export const maxDuration = 300

/** The model call's own limit. Under `maxDuration`, so the route can still clear the claim and answer. */
const TIMEOUT_MS = 240_000

const FAILED = 'We could not look this up just now. Nothing was saved. Please try again.'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'No checklist item was given.' }, { status: 400 })

  const { data: item, error: rErr } = await db.from('checklist_items')
    .select('id, name, description, source_url, source_title, sources, howto, howto_started_at, checklist_id')
    .eq('id', id).maybeSingle()
  if (rErr) {
    console.error('how-to: reading the item:', rErr.message)
    return NextResponse.json({ error: FAILED }, { status: 500 })
  }
  if (!item) return NextResponse.json({ error: 'That checklist item was not found.' }, { status: 404 })
  // A result already saved is shown again, never bought twice.
  if (item.howto) return NextResponse.json({ status: 'done', howto: item.howto })

  // ---- THE CLAIM ----
  // A claim older than HOWTO_LOCK_MS is a run that died without clearing it; the page uses the same number.
  const stale = new Date(Date.now() - HOWTO_LOCK_MS).toISOString()
  const { data: claimed, error: cErr } = await db.from('checklist_items')
    .update({ howto_started_at: new Date().toISOString() })
    .eq('id', id).eq('company_id', companyId).is('howto', null)
    .or(`howto_started_at.is.null,howto_started_at.lt."${stale}"`)
    .select('id')
  if (cErr) {
    console.error('how-to: claiming the item:', cErr.message)
    return NextResponse.json({ error: FAILED }, { status: 500 })
  }
  if (!claimed?.length) return NextResponse.json({ status: 'researching' }, { status: 409 })

  const release = async () => {
    const { error } = await db.from('checklist_items').update({ howto_started_at: null })
      .eq('id', id).eq('company_id', companyId)
    if (error) console.error('how-to: the claim was not cleared:', error.message)
  }

  // ---- THE WORK, AFTER THE REPLY. Every path below either saves the result (which clears the claim
  // in the same update) or calls release(). The client is the caller's, built per request.
  after(async () => {
    try {
      const { data: list } = await db.from('checklists').select('title, question').eq('id', item.checklist_id ?? '').maybeSingle()
      const stored = Array.isArray(item.sources) ? (item.sources as Array<{ title?: string; url?: string }>) : []
      const sources = stored.length
        ? stored.filter((s) => s?.url).map((s) => ({ title: s.title ?? null, url: String(s.url) }))
        : item.source_url ? [{ title: item.source_title, url: item.source_url }] : []

      const today = new Date().toISOString().slice(0, 10)
      const model = modelForTask('howto')
      let raw = ''
      let returned: SearchResult[] = []
      let failure: string | null = null
      for await (const ev of askAIOpenStream(
        howToPrompt(today),
        [{ role: 'user', content: howToInput({
          checklistTitle: list?.title ?? null, checklistQuestion: list?.question ?? null,
          name: item.name, description: item.description, sources,
        }) }],
        // Its own effort (`AI_EFFORT_HOWTO`, falling back to `AI_EFFORT`) — the owner's decision, STOP 1.
        { task: 'howto', maxTokens: 8000, effort: effortForHowto() ?? undefined,
          // At most 6 searches unless AI_SEARCH_MAX_HOWTO says otherwise — a safety rail (owner, Part C).
          maxSearches: searchLimit('AI_SEARCH_MAX_HOWTO', 6), signal: AbortSignal.timeout(TIMEOUT_MS),
          ledger: { companyId, task: 'howto' } },
      )) {
        if (ev.type === 'done') {
          raw = ev.answer.text
          // What the search returned, plus what the answer cited (every citation is a search result).
          returned = [...ev.searched, ...ev.answer.sources.map((s) => ({ url: s.url, title: s.title }))]
        } else if (ev.type === 'error') failure = ev.message
      }
      if (failure || !raw) {
        console.error('how-to: the call failed:', failure ?? 'no text')
        await release()
        return
      }

      let parsed: unknown
      try { parsed = JSON.parse(extractJsonText(stripMarkers(raw))) }
      catch (e) {
        console.error('how-to: the answer did not parse:', String(e), raw.slice(0, 3000))
        await release()
        return
      }
      const checked = checkHowTo(parsed, returned, { today, model })
      if (!checked.ok) {
        console.error('how-to: shape refused:', checked.error, raw.slice(0, 3000))
        await release()
        return
      }

      const { error: wErr } = await db.from('checklist_items')
        .update({ howto: checked.result, howto_started_at: null })
        .eq('id', id).eq('company_id', companyId)
      if (wErr) {
        console.error('how-to: the result was not saved:', wErr.message)
        await release()
        return
      }
      console.log(`how-to ${id}: saved; ${returned.length} page(s) returned by the search could be cited`)
    } catch (e) {
      console.error('POST /api/checklist-items/[id]/how-to failed:', e)
      await release()
      return
    }
  })

  return NextResponse.json({ status: 'researching' }, { status: 202 })
}

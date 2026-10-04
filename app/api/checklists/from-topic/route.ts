/**
 * CONVERT A CONVERSATION INTO A CHECKLIST — `DECISIONS.md` §125, Run 2 Task 3.
 *
 * POST { topicId, scope: 'discussed' | 'complete' }
 *
 * ---------------------------------------------------------------------------
 * THE SCOPE RULE, AND WHY IT IS ENFORCED IN CODE
 *
 * `scope=discussed` promises: **every item's source is one this conversation already cited.**
 * The prompt asks for that. The prompt is a request, not a guarantee — §3.3's whole lesson is
 * that a model given an anchor still reaches past it sometimes, and the one thing a customer
 * cannot check is whether the link under an item was really in the conversation they had.
 *
 * So after the call, every item's `source_url` is compared against the set of URLs actually
 * cited in the topic's turns. An item citing anything else is **dropped**, and the count of
 * dropped items comes back in the response rather than being swallowed.
 *
 * Dropping rather than blanking the source is the stricter choice and the honest one: an item
 * with its source removed still claims to have been discussed, and now has nothing behind it.
 * ---------------------------------------------------------------------------
 *
 * *** WORKSPACE TASK 6: `discussed` IS NOW HELD TO THE SUMMARY'S CITATION RULE, NOT THE URL RULE. ***
 * The sources are numbered by code (`numberedTranscript`), every item carries a quoted `basis`, and
 * `lib/checklistConvert.ts` runs the summary's own `checkCitations`: a basis not found clears the
 * item's sources ("No source cited in the conversation"); a basis found keeps only the markers in
 * that paragraph. A number outside the conversation's list cannot survive, so the old URL filter has
 * nothing left to catch — the guarantee above holds by construction, and nothing is dropped whole.
 * `complete` keeps its input and its conversation-URL rule and gains `to_confirm`; since the owner's
 * decision at STOP 1 it SEARCHES THE WEB, and an added item keeps only a link this call's search
 * returned (`checkAddedLinks`); a failed link is removed and the item shows "No source found".
 *
 * *** ONE PRESS, ONE CALL, AND NOT TIED TO THE TAB — Workspace Stage 4. *** Part 1 measured a second
 * press (same tab or another) making a second paid checklist, and nothing recorded while it ran. Now:
 * `topics.checklist_started_at` is claimed by compare-and-set before any model call (`lib/topicClaim.ts`;
 * both scopes share the one claim), a held claim is a 409 with no call, and the route replies 202
 * `{ status: 'started' }` at once and builds the checklist in `after()` (`next/server`), which on
 * Vercel runs on `waitUntil` up to `maxDuration` — see `app/api/topics/[id]/summarise/route.ts`. The
 * checklist and its items are written exactly as before; THEN the claim is released, and only if it is
 * still ours. A run past the 9-minute timeout has lost it, and the checklist it made late is removed,
 * so a stale result never sits beside the one that took over. The page polls
 * `topic_list_v.checklist_in_progress` and opens the newest checklist when the claim clears.
 *
 * §111 STAYS DEFERRED. Nothing here links an item to an obligation; `obligations` is not read
 * or written. `origin` records where an item came FROM, which is provenance, not authority.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireCompany, supabaseAdmin } from '@/lib/auth'
import { askAIJson, askAIWithSearchResults, extractJsonText, searchLimit } from '@/lib/ai'
import { loadTurns, bumpCounter } from '@/lib/conversation'
import { CONVERT_DISCUSSED, CONVERT_COMPLETE, CONVERT_DISCUSSED_ASKS_FOR_BASIS } from '@/prompts/convert'
import { numberedTranscript } from '@/lib/summaryReport'
import { checkConversion, checkAddedLinks, itemColumns, type ItemGroup } from '@/lib/checklistConvert'
import { stripMarkers } from '@/lib/howTo'
import { claimTopic, releaseTopic, withinClaimTime, CLAIM_WORDS } from '@/lib/topicClaim'

export const maxDuration = 800

type Scope = 'discussed' | 'complete'

interface ConvertedItem {
  name?: string
  description?: string
  why?: string
  source_title?: string
  source_url?: string
  origin?: string
}
interface Converted { title?: string; must_do?: ConvertedItem[]; good_to_have?: ConvertedItem[]; to_confirm?: ConvertedItem[] }

/** Compare by origin + path, so a tracking parameter or a trailing slash is not a new source. */
function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u)
      return (x.origin + x.pathname).replace(/\/+$/, '').toLowerCase()
    } catch { return u.trim().replace(/\/+$/, '').toLowerCase() }
  }
  return norm(a) === norm(b)
}

export async function POST(request: NextRequest) {
  const authed = await requireCompany(request)
  if (!authed.ok) return authed.response
  const { companyId, db } = authed.auth

  let body: { topicId?: string; scope?: string }
  try { body = await request.json() } catch { body = {} }
  const topicId = String(body.topicId ?? '').trim()
  const scope = (body.scope === 'complete' ? 'complete' : 'discussed') as Scope
  if (!topicId) return NextResponse.json({ error: 'No conversation was given to convert.' }, { status: 400 })

  try {
    // RLS decides visibility. A topic belonging to another company is a 404, not a 403.
    const { data: topic, error: tErr } = await db
      .from('topics').select('id, title, summary').eq('id', topicId).maybeSingle()
    if (tErr) throw new Error(tErr.message)
    if (!topic) return NextResponse.json({ error: 'That conversation was not found.' }, { status: 404 })

    const turns = await loadTurns(db, topicId)
    if (turns.length === 0) {
      // §5.1: never assert something about content nobody read, and always say what can be done.
      return NextResponse.json({
        error: 'The messages in this conversation have been cleared, so there is nothing to convert. '
             + 'Its summary is still on the conversation.',
      }, { status: 409 })
    }

    // ---- THE CLAIM, before any model call. Held → the person waits for the run already going.
    const claim = await claimTopic(db, topicId, 'checklist')
    if (!claim.ok) {
      return NextResponse.json({ status: 'building', message: `${CLAIM_WORDS.checklist} It is already being built.` },
        { status: 409 })
    }

    // ---- THE WORK, AFTER THE REPLY. The client is the caller's, built per request, closed over here.
    after(async () => {
      // The build AND what happens when it lands, as one piece of work. The release-or-take-back step
      // is inside it, not after the race below, because a build that passes the timeout keeps going:
      // when it lands late it finds its claim gone and removes what it made.
      const work = (async () => {
        const outcome = await buildChecklist({ db, companyId, topicId, scope, title: topic.title ?? null, turns })
        if (!outcome.ok) { console.error(`convert ${topicId} (${scope}): ${outcome.error}`); return }
        // Written; now the claim ends — and only if it is still ours. If it is not, this run passed its
        // time and somebody else may have started again: the late checklist is taken back.
        if (!(await releaseTopic(db, topicId, 'checklist', claim.claimedAt))) {
          console.error(`convert ${topicId}: the claim was lost before the checklist landed; removing ${outcome.checklistId}`)
          await db.from('checklist_items').delete().eq('checklist_id', outcome.checklistId)
          await db.from('checklists').delete().eq('id', outcome.checklistId)
        }
      })()
      try {
        await withinClaimTime(work, 'checklist')
      } catch (e) {
        console.error(`convert ${topicId} (${scope}) failed:`, e)
      } finally {
        // After a failure or the timeout; a success has already released it, and this then matches nothing.
        await releaseTopic(db, topicId, 'checklist', claim.claimedAt)
      }
    })

    return NextResponse.json({ status: 'started' }, { status: 202 })
  } catch (e) {
    console.error('POST /api/checklists/from-topic failed:', e)
    return NextResponse.json(
      { error: 'That conversation could not be turned into a checklist. Please try again.' },
      { status: 500 })
  }
}

/**
 * THE CONVERSION ITSELF — unchanged from before Stage 4 except that it now runs after the reply, so a
 * refusal it used to send back as a status is logged and returned here, and the page says the
 * checklist could not be built when the claim clears with no new checklist.
 */
async function buildChecklist(args: {
  db: SupabaseClient
  companyId: string; topicId: string; scope: Scope; title: string | null
  turns: Awaited<ReturnType<typeof loadTurns>>
}): Promise<{ ok: true; checklistId: string } | { ok: false; error: string }> {
  const { db, companyId, topicId, scope, turns } = args
  const topic = { title: args.title }
  // THE SET OF SOURCES THIS CONVERSATION ACTUALLY CITED. This is the whole basis of the
  // `discussed` guarantee, so it is built from the stored turns rather than from anything the
  // client sent.
  const cited: Array<{ title: string; url: string }> = []
  for (const t of turns) {
    for (const s of (t.sources ?? [])) {
      if (s?.url && !cited.some((c) => sameUrl(c.url, s.url))) {
        cited.push({ title: s.title ?? s.url, url: s.url })
      }
    }
  }

  // ---- "JUST WHAT WE DISCUSSED": numbered by code, every citation proven by its basis ----
  let modelTitle: string | null = null
  let items: Array<Record<string, unknown>>
  let checks: unknown[] | undefined
  let noSourceFound = 0
  if (scope === 'discussed') {
    const { transcript } = numberedTranscript(turns)
    const raw = await askAIJson<unknown>(
      CONVERT_DISCUSSED,
      `Conversation title: ${topic.title ?? '(none)'}\n\n${transcript}`,
      { maxTokens: 16000, task: 'judgement', ledger: { companyId, task: 'convert' } },
    )
    const checked = checkConversion(raw, turns, { basisRequired: CONVERT_DISCUSSED_ASKS_FOR_BASIS })
    if (!checked.ok) {
      console.error('convert (discussed): shape refused:', checked.error, JSON.stringify(raw).slice(0, 3000))
      return { ok: false, error: 'the checklist came back in a shape we could not use (discussed)' }
    }
    modelTitle = checked.title
    items = checked.items.map(itemColumns)
    checks = checked.checks
  } else {
    // ---- "EVERYTHING ON THIS SUBJECT": unchanged input, call and URL rule ----
    const transcript = turns
      .map((t) => `${t.role === 'user' ? 'USER' : 'SPECIALIST'}${t.stopped ? ' (stopped)' : ''}: ${t.text}`)
      .join('\n\n')
    const sourceList = cited.length
      ? `\n\nSOURCES CITED IN THIS CONVERSATION:\n${cited.map((c, i) => `${i + 1}. ${c.title} — ${c.url}`).join('\n')}`
      : '\n\n(This conversation cited no sources.)'

    // *** WEB SEARCH ON — the owner's decision at STOP 1, Workspace Task 6. *** The added items are
    // research, and the model's own knowledge is months old. Every page the search returned comes
    // back beside the answer, so each added item's link can be checked against it below.
    const { answer, searched } = await askAIWithSearchResults(
      CONVERT_COMPLETE,
      `${transcript}${sourceList}`,
      { maxTokens: 16000, task: 'judgement', enableWebSearch: true,
        // At most 8 searches unless AI_SEARCH_MAX_COMPLETE says otherwise — a safety rail (owner, Part C).
        maxSearches: searchLimit('AI_SEARCH_MAX_COMPLETE', 8), ledger: { companyId, task: 'convert' } },
    )
    let data: Converted
    try { data = JSON.parse(extractJsonText(stripMarkers(answer.text))) as Converted }
    catch (e) {
      console.error('convert (complete): the answer did not parse:', String(e), answer.text.slice(0, 3000))
      return { ok: false, error: 'the checklist came back in a shape we could not use (discussed)' }
    }
    modelTitle = String(data?.title ?? '').trim() || null
    const clean = (list: ConvertedItem[] | undefined, category: ItemGroup) =>
      (list ?? [])
        .filter((i) => String(i?.name ?? '').trim())
        .map((i) => {
          const url = String(i.source_url ?? '').trim()
          const inConversation = url ? cited.some((c) => sameUrl(c.url, url)) : true
          const origin: 'conversation' | 'added' =
            (inConversation && url) || i.origin === 'conversation' ? 'conversation' : 'added'
          return {
            name: String(i.name).trim(),
            description: String(i.description ?? '').trim(),
            why: String(i.why ?? '').trim(),
            source_url: url || null,
            source_title: String(i.source_title ?? '').trim() || null,
            category,
            origin,
          }
        })
    // An ADDED item keeps only a link this call's search returned; otherwise its source is removed
    // and it shows "No source found" (`checkAddedLinks`, the same check as "How do I do this?").
    const linked = checkAddedLinks(
      [...clean(data?.must_do, 'must_do'), ...clean(data?.good_to_have, 'good_to_have'),
       ...clean(data?.to_confirm, 'to_confirm')],
      [...searched, ...answer.sources.map((x) => ({ url: x.url, title: x.title }))])
    items = linked.items
    noSourceFound = linked.removed
  }
  const count = (c: ItemGroup) => items.filter((r) => r.category === c).length
  if (items.length === 0) {
    return { ok: false, error: 'nothing in this conversation could be turned into checklist items' }
  }

  // THE TITLE NAMES THE SCOPE, so a person with two checklists from one conversation can tell
  // them apart without opening both.
  const base = String(modelTitle ?? topic.title ?? 'Checklist').trim().slice(0, 160)
  const title = scope === 'complete' ? `${base} — complete` : `${base} — as discussed`

  const { data: checklist, error: cErr } = await db.from('checklists').insert({
    company_id: companyId,
    title,
    question: `Converted from a conversation (${scope}): ${topic.title ?? ''}`.slice(0, 500),
    from_topic_id: topicId,
  }).select('id').single()
  if (cErr) throw new Error(`creating the checklist: ${cErr.message}`)

  const rows: Array<Record<string, unknown>> = items.map((r, i) => ({
    ...r, checklist_id: checklist.id, company_id: companyId, sort_order: i,
  }))
  const { error: iErr } = await db.from('checklist_items').insert(rows)
  if (iErr) throw new Error(`writing the items: ${iErr.message}`)

  try { await bumpCounter(supabaseAdmin, companyId, 'checklists_created') }
  catch (e) { console.error('checklist counter not incremented:', e) }

  // What used to come back in the response — the counts and what the citation check did — is in the
  // log now, for the person reviewing a conversion; the page reads the checklist itself.
  console.log(`convert ${topicId} (${scope}): checklist ${checklist.id}`, JSON.stringify({
    must_do: count('must_do'), good_to_have: count('good_to_have'), to_confirm: count('to_confirm'),
    conversation: rows.filter((r) => r.origin === 'conversation').length,
    added: rows.filter((r) => r.origin === 'added').length,
    cited_sources_available: cited.length,
    no_source: rows.filter((r) => Array.isArray(r.sources) && r.sources.length === 0).length,
    no_source_found: noSourceFound, checks_count: checks?.length ?? 0,
  }))
  return { ok: true, checklistId: checklist.id as string }
}

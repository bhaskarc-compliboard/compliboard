// TO CONFIRM — one queue, both sources, ONE ROW PER QUESTION. Documents Run 5, regrouped Run 6.
//
// GET  → the pending proposals grouped by key, ranked, with every source behind each
// POST → Confirm or Not right, by key (this page) or by proposal id (the report drawer)
//
// *** ONE QUEUE, BECAUSE IT IS ONE ROW. *** `fact_proposals` already holds both: the nightly
// summariser writes one carrying a topic and a turn; a document scan writes one carrying a
// document and a locator. A fact confirmed in the report drawer and the same fact confirmed here
// are the same row changing state, so neither place can disagree with the other and nobody
// confirms twice.
//
// *** AND ONE CONFIRMATION PER FACT, NOT PER ROW — RUN 6. ***
// Run 5 showed proposals one row at a time, and the first real queue had 69 of them from seven
// documents: `facility_address` appeared twice because two documents state it, and confirming it
// twice wrote the same answer twice over. That is not a display problem. A person is being asked
// the same question repeatedly and told each time that it is a different question, and the count
// in the sidebar — the number that says how much work is waiting — was counting readings rather
// than decisions.
//
// So the unit here is the KEY. Every pending proposal carrying that key is one source behind it:
// the document and where in it, or the conversation. Confirm settles the key once from what the
// sources say; Not right rejects all of them with one reason. `company_facts` is already unique
// on (company_id, key), so the database has always agreed that a key has one answer.
//
// *** WHEN THE SOURCES DISAGREE, THE PERSON PICKS. *** Two documents saying 42 and 38 employees
// is not something to average, resolve by recency, or decide by which scan ran last. It is the
// one case where the product genuinely does not know, and the honest thing is to show both with
// where each came from. The route refuses to settle rather than guessing (409, with the values).
//
//   · the key names one of the 95 SWITCHES → the existing declared-fact path, exactly as a
//     person answering the question in the workspace would. `company_switches` is what the
//     obligation engine reads and resolution is deterministic against it (§3.2); a second way in
//     would be a second source of truth.
//   · anything else → `company_facts` (migration 050), which computes nothing and exists so the
//     next scan can be shown it and so nobody is asked the same thing twice.
//
// THE RANKING IS STATED ON THE PAGE, not left as a mystery — a queue whose order nobody can
// explain is a queue people scroll past.

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany, supabaseAdmin } from '@/lib/auth'

/** Keys with an "affects" line first, then documents before conversations, then newest. */
export const RANKING_LINE =
  'Ranked by what each answer unblocks: the ones we can say something about first, '
  + 'then what we read in a document, then the newest.'

/**
 * Two values are the same answer when they differ only in spacing, case or trailing punctuation.
 * "42 employees" and "42 Employees" are not a disagreement for a person to arbitrate; "42" and
 * "38" are. Deliberately NOT cleverer than that — stripping the word "employees" to compare
 * numbers would decide that "42 employees" and "42 contractors" agree.
 */
const sameAnswer = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/[.\s]+$/, '') === b.trim().toLowerCase().replace(/[.\s]+$/, '')

type Row = Record<string, any>   // eslint-disable-line @typescript-eslint/no-explicit-any

export async function GET(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, db } = authed.auth

    const { data: proposals } = await db.from('fact_proposals')
      .select('*').eq('company_id', companyId).eq('status', 'proposed')
      .order('created_at', { ascending: false }).order('id', { ascending: false })

    const rows = (proposals ?? []) as Row[]
    const docIds = [...new Set(rows.map((r) => r.document_id).filter(Boolean))]
    const topicIds = [...new Set(rows.map((r) => r.topic_id).filter(Boolean))]

    const [docs, topics, switches] = await Promise.all([
      docIds.length
        ? db.from('document_index_v').select('document_id, title').in('document_id', docIds)
        : { data: [] },
      topicIds.length
        ? db.from('topics').select('id, title').in('id', topicIds)
        : { data: [] },
      // Which keys name a switch decides where a confirmation goes, and the page says so on the
      // row rather than surprising somebody after they click.
      db.from('switches').select('id').in('id', [...new Set(rows.map((r) => r.switch_key))]),
    ])
    const docTitle = Object.fromEntries((docs.data ?? []).map((d: Row) => [d.document_id, d.title]))
    const topicTitle = Object.fromEntries((topics.data ?? []).map((t: Row) => [t.id, t.title]))
    const isSwitch = new Set((switches.data ?? []).map((s: Row) => s.id))

    // ---- one entry per key, every proposal under it as a source ----
    const byKey = new Map<string, Row[]>()
    for (const r of rows) {
      const k = String(r.switch_key ?? '')
      if (!byKey.has(k)) byKey.set(k, [])
      byKey.get(k)!.push(r)
    }

    const keys = [...byKey.entries()].map(([key, group]) => {
      // Newest source first inside a key, so "the value" below is the newest reading of it.
      //
      // *** ONE SOURCE PER PLACE, NOT PER READING. *** Re-scanning a document writes a fresh set
      // of proposals and does not retract the old ones, so the second reading of a file that
      // still says "42 employees" leaves two identical rows. The same document listed twice
      // saying the same thing is not corroboration, it is the same sentence read twice — and on
      // screen it would read as two independent sources agreeing. Collapsed on (where it came
      // from + what it says), newest kept; a document that CHANGED its answer between readings
      // keeps both, because that is a real disagreement and the person should see it.
      const seen = new Set<string>()
      const sources = group
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .filter((r) => {
          const place = `${r.document_id ?? r.topic_id ?? ''}|${String(r.proposed_value ?? '').trim().toLowerCase()}`
          if (seen.has(place)) return false
          seen.add(place)
          return true
        })
        .map((r) => ({
          proposal_id: r.id,
          value: r.proposed_value,
          quote: r.quote,
          quote_verified: r.quote_verified,
          locator: r.locator,
          basis: r.basis,
          affects: r.affects,
          created_at: r.created_at,
          from: r.document_id
            ? { kind: 'document' as const, title: docTitle[r.document_id] ?? 'a document', locator: r.locator }
            : { kind: 'conversation' as const, title: topicTitle[r.topic_id ?? ''] ?? 'a conversation', locator: null },
        }))

      const values = sources.map((s) => String(s.value ?? ''))
      const agree = values.every((v) => sameAnswer(v, values[0]))
      return {
        key,
        is_switch: isSwitch.has(key),
        sources,
        source_count: sources.length,
        // The value Confirm would settle on. Null when the sources disagree, which is the
        // page's cue to ask rather than to offer a button that would pick one silently.
        value: agree ? sources[0].value : null,
        agree,
        // The first line of explanation any source offers. Ranking reads this too.
        affects: sources.find((s) => s.affects)?.affects ?? null,
        has_document: sources.some((s) => s.from.kind === 'document'),
        newest: sources[0].created_at,
      }
    })

    keys.sort((a, b) => {
      // 1. an "affects" line — the keys we can say something about
      const aff = Number(!!b.affects) - Number(!!a.affects)
      if (aff) return aff
      // 2. documents before conversations
      const src = Number(b.has_document) - Number(a.has_document)
      if (src) return src
      // 3. newest
      return String(b.newest).localeCompare(String(a.newest))
    })

    return NextResponse.json({
      keys,
      // *** THE COUNT IS KEYS, NOT ROWS. *** It is the number of decisions waiting, which is what
      // the sidebar badge is promising. `rows` is reported separately so the page can say how
      // many readings sit behind them.
      count: keys.length,
      proposal_count: rows.length,
      ranking: RANKING_LINE,
    })
  } catch (error) {
    console.error('to-confirm GET:', error)
    return NextResponse.json({ error: 'We could not load what needs confirming.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { companyId, userId, db } = authed.auth

    const body = await request.json().catch(() => null)
    const proposalId = String(body?.proposal_id ?? '').trim()
    const key = String(body?.key ?? '').trim()
    const chosen = body?.value === undefined || body?.value === null ? null : String(body.value)
    const verdict = body?.verdict
    const reason = body?.reason ? String(body.reason).slice(0, 2000) : null
    if ((!proposalId && !key) || !['accepted', 'rejected'].includes(verdict)) {
      return NextResponse.json({ error: 'Expected a proposal_id or a key, and a verdict.' }, { status: 400 })
    }
    // A REASON IS REQUIRED TO REJECT, here and in the drawer, for the same reason: "not right"
    // with no sentence is a finding buried rather than answered.
    if (verdict === 'rejected' && !reason?.trim()) {
      return NextResponse.json({ error: 'Please say why this is not right.' }, { status: 400 })
    }

    // ---- which proposals this answer settles ----
    //
    // BY KEY, this is every pending proposal carrying it — that is the whole point of the
    // regrouping, and it is scoped to the caller's company through `authed.db`, so a key can
    // never reach another company's rows.
    //
    // BY ID, it is the one row, because the report drawer answers one document's proposal and
    // must not silently accept a second document's reading of the same key on the strength of a
    // quote the person is not looking at.
    let group: Row[] = []
    if (key) {
      const { data } = await db.from('fact_proposals')
        .select('*').eq('company_id', companyId).eq('switch_key', key).eq('status', 'proposed')
        .order('created_at', { ascending: false })
      group = (data ?? []) as Row[]
    } else {
      const { data } = await db.from('fact_proposals').select('*').eq('id', proposalId).maybeSingle()
      if (data) group = [data as Row]
    }
    if (!group.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const ids = group.map((p) => p.id)
    const settledKey = String(group[0].switch_key)

    if (verdict === 'rejected') {
      const { error } = await supabaseAdmin.from('fact_proposals')
        .update({ status: 'rejected', rejected_reason: reason }).in('id', ids)
      if (error) throw error
      return NextResponse.json({ ok: true, wrote: 'nothing', rejected: ids.length })
    }

    // ---- accepted: one value for the key, and the person picks when we cannot tell ----
    const values = group.map((p) => String(p.proposed_value ?? ''))
    const agree = values.every((v) => sameAnswer(v, values[0]))
    let value: string
    if (chosen !== null) {
      // A value the person picked has to be one the sources actually proposed. Accepting free
      // text here would make this an editing surface, and an answer nobody read in a document
      // would then be stored carrying that document's quote as its evidence.
      const match = values.find((v) => sameAnswer(v, chosen))
      if (!match) {
        return NextResponse.json(
          { error: 'That is not one of the values proposed for this fact.', values: [...new Set(values)] },
          { status: 400 })
      }
      value = match
    } else if (agree) {
      value = values[0]
    } else {
      // 409, not a guess. Averaging, taking the newest, or trusting the longer quote would each
      // be the product deciding something it does not know.
      return NextResponse.json({
        error: 'These sources do not say the same thing. Pick the one that is right.',
        values: [...new Set(values)],
      }, { status: 409 })
    }

    const { data: sw } = await db.from('switches')
      .select('id, scope, value_type, allowed_values').eq('id', settledKey).maybeSingle()

    if (sw) {
      // THE EXISTING DECLARED-FACT PATH, NOT A COPY OF IT. `/api/switches/answer` writes the
      // determination and the switch row together under a composite FK, refuses a site-scoped
      // fact with no site, checks the enum, and recomputes obligations. Reimplementing any of
      // that here would be a second way into `company_switches` that drifts from the first.
      const res = await fetch(new URL('/api/switches/answer', request.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: request.headers.get('authorization') ?? '',
        },
        body: JSON.stringify({ switch_id: settledKey, value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // The proposals stay proposed. A fact half-written is worse than one still pending.
        return NextResponse.json(
          { error: err?.error ?? 'We could not record that answer.' }, { status: res.status })
      }
      await supabaseAdmin.from('fact_proposals').update({ status: 'accepted' }).in('id', ids)
      return NextResponse.json({ ok: true, wrote: 'company_switches', switch_id: settledKey, settled: ids.length })
    }

    // Not a switch: `company_facts`, one row per company and key, the newest confirmation
    // replacing the last, carrying the proposal and the document it came from.
    const carrier = group.find((p) => String(p.proposed_value ?? '') === value) ?? group[0]
    const { error: fErr } = await supabaseAdmin.from('company_facts').upsert({
      company_id: companyId,
      key: settledKey,
      // *** NOT `JSON.stringify`. *** `value` is jsonb and supabase-js already serialises what
      // it is given, so stringifying first stored the string INSIDE a JSON string —
      // "\"4410 NW Front Avenue\"" rather than "4410 NW Front Avenue". Caught by reading the
      // row back after the first confirmation rather than trusting the 200.
      value,
      basis: carrier.basis ?? 'read',
      // The source recorded is the one whose words the value came from, not whichever row
      // happened to be newest — the quote behind a fact has to belong to the fact.
      source_document_id: carrier.document_id ?? null,
      source_proposal_id: carrier.id,
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    }, { onConflict: 'company_id,key' })
    if (fErr) throw fErr
    await supabaseAdmin.from('fact_proposals').update({ status: 'accepted' }).in('id', ids)
    return NextResponse.json({ ok: true, wrote: 'company_facts', key: settledKey, settled: ids.length })
  } catch (error) {
    console.error('to-confirm POST:', error)
    return NextResponse.json({ error: 'We could not save that just now.' }, { status: 500 })
  }
}

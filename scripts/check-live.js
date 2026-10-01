#!/usr/bin/env node
/**
 * npm run check:live — DOES THIS WORK FOR THE PERSON WHO WILL RUN IT?
 *
 * *** THE PROPERTY THIS TESTS IS NOT "IS THIS CODE CORRECT". *** It is: does the path work when
 * executed by an `authenticated` session against the real schema? Those are different questions,
 * and `npm run check` answers only the first — none of its 274 tests makes an authenticated
 * request. They run in-process, as nobody, against no database.
 *
 * THREE DEFECTS IN ONE SITTING CAME FROM THAT GAP, and all three had passing tests:
 *
 *   §63  close_and_replace_obligations was service_role-only  -> 500 on the first real GET
 *   §80a switch_determinations had SELECT but no INSERT       -> the first user answer impossible
 *   §80b fromUserAnswer returned `stated` with no document    -> refused by a CHECK, while its
 *                                                                own unit test asserted it
 *
 * Every one was invisible because **nothing had ever run the path as the person who will run it.**
 *
 * *** IT REFUSES PRODUCTION, BY REF, BEFORE IT DOES ANYTHING. *** This writes rows. There is no
 * flag, no environment variable and no argument that points it at production.
 *
 * WHAT IT ASSERTS, per tenant table a route will eventually write:
 *   1. a signed-in user CAN write their own company's row   (grant + policy both present)
 *   2. `anon` CANNOT                                        (the boundary is real, not assumed)
 *
 * A grant without a policy and a policy without a grant fail identically from the caller's side —
 * `permission denied` either way — so both directions are checked. AUDIT-CHECKS.md check 27.
 */
import { existsSync, readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

import { costOfSections } from '../lib/auditRun.ts'

const STAGING_REF = 'amzsavsrabrlcprltpom'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!url.includes(STAGING_REF)) {
  console.error(`\n  REFUSED: ${url || '(no url)'} is not staging.\n`)
  console.error('  check:live writes rows. It runs against staging and nowhere else.\n')
  process.exit(1)
}
if (process.env.SUPABASE_PROD_URL || process.env.SUPABASE_PROD_SERVICE_ROLE_KEY) {
  console.error('\n  REFUSED: production credentials are present in the environment.')
  console.error('  Clear SUPABASE_PROD_URL and SUPABASE_PROD_SERVICE_ROLE_KEY and run again.\n')
  process.exit(1)
}

// *** NO DEFAULT, AND NO LITERAL. THE SAME SHAPE AS `TURN_SIGNING_SECRET`. ***
//
// This read `?? 'gamma@2026'` until 21 September — a working password for a real login,
// committed to the repository. `CLAUDE.md` §3.5: never write a password into a code file, and
// that rule has no staging exemption, because the exemption is how the pattern spreads to a
// file where the stakes are different.
//
// A default is worse than an absent value in the same way a default signing secret is: it makes
// the check appear to work while depending on something nobody declared. It also hid the
// password from a search of the places a password is DOCUMENTED, which cost a needless reset of
// a live fixture login on 21 September — the value was in the repo the whole time, in a file
// nobody thinks of as holding one.
//
// It REFUSES rather than falling back, so a missing value is a visible stop, not a mystery
// 'Invalid login credentials' from Supabase.
const fixturePassword = process.env.CHECK_LIVE_PASSWORD
if (!fixturePassword) {
  console.error('\n  REFUSED: CHECK_LIVE_PASSWORD is not set.')
  console.error('  This check signs in as a real staging fixture, and its password is not stored')
  console.error('  in this file. Put it in .env.local (gitignored) and run again.\n')
  process.exit(1)
}

const FIXTURE = { email: 'testgamma@example.com', password: fixturePassword }

const pub = createClient(url, anonKey, { auth: { persistSession: false } })
const { data: session, error: signInError } = await pub.auth.signInWithPassword(FIXTURE)
if (signInError) {
  console.error(`\n  Could not sign in as ${FIXTURE.email}: ${signInError.message}`)
  console.error('  CHECK_LIVE_PASSWORD is set but wrong, or the fixture login was changed.\n')
  process.exit(1)
}
const token = session.session.access_token
const asUser = createClient(url, anonKey, {
  auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
})
const asAnon = createClient(url, anonKey, { auth: { persistSession: false } })

const { data: me } = await asUser.from('profiles').select('company_id').single()
const companyId = me.company_id
const { data: site } = await asUser.from('entities').select('id').eq('is_primary', true).maybeSingle()

console.log(`\n  check:live — staging (${STAGING_REF}), signed in as ${FIXTURE.email}\n`)

let failures = 0
/** One tenant table a route will eventually write. Probe rows are removed by `cleanup`. */
const CASES = [
  {
    table: 'switch_determinations',
    row: { company_id: companyId, switch_id: 'has_employees', value: 'true',
           evidence_class: 'declared', source: 'user_set', reasoning: 'check:live probe' },
    cleanup: (db, id) => db.from('switch_determinations').delete().eq('id', id),
    note: '§80a — had SELECT and no INSERT until migration 025',
    // Append-only: `authenticated` holds INSERT and SELECT and no DELETE by design (025), so the
    // probe row cannot be removed as the user. Without this the check accumulated a row per run
    // — found on its second run, by its own "left behind" message.
    cleanupNeedsServiceRole: true,
  },
  {
    table: 'topics',
    row: { company_id: companyId, title: 'check:live probe' },
    cleanup: (db, id) => db.from('topics').delete().eq('id', id),
    note: 'added with migration 028, in the same change — adding a table here after the fact is how one gets missed',
    // `authenticated` holds no DELETE on `topics` (a topic is closed, not deleted), so the probe
    // row is removed with the service role rather than as the user. The check is about whether
    // the CALLER can write, not whether it can tidy up after itself.
    cleanupNeedsServiceRole: true,
  },
  {
    table: 'company_chemicals',
    row: { company_id: companyId, entity_id: site?.id ?? null, substance_name: 'check:live probe' },
    cleanup: (db, id) => db.from('company_chemicals').delete().eq('id', id),
    note: 'nothing has ever written this from a request — sdsExtraction is unrouted (check 29)',
  },
  // *** THE AUDIT TABLES ARE THE OTHER DIRECTION, AND THE PROBE HAD TO SAY SO — Run 2c, item 12. ***
  //
  // Every case above asserts "authenticated CAN write". Migration 058 grants `authenticated` no
  // INSERT on any of these three — the server writes an audit, a person does not — so the same
  // assertion would report a correct grant as a failure, and a check that invents failures is worse
  // than no check. `reads_only` inverts it: the caller must be able to SELECT its own rows and must
  // be REFUSED the insert, and anon must be refused both. The tenancy question is the same one; the
  // answer the grant should give is the opposite.
  {
    table: 'audit_runs',
    reads_only: true,
    row: { company_id: companyId, kind: 'agency', agency_label: 'check:live probe' },
    note: 'migration 058 — the server writes a run; a person may read it and dismiss it',
  },
  {
    table: 'audit_sections',
    reads_only: true,
    row: { company_id: companyId, run_id: '00000000-0000-0000-0000-000000000000',
           ordinal: 0, title: 'check:live probe' },
    note: 'migration 058 — read only to the caller; not even UPDATE',
  },
  {
    table: 'audit_findings',
    reads_only: true,
    row: { company_id: companyId, run_id: '00000000-0000-0000-0000-000000000000',
           section_id: '00000000-0000-0000-0000-000000000000', ordinal: 0,
           kind: 'finding', title: 'check:live probe' },
    note: 'migration 058 — the caller reads, and updates only to dismiss one',
  },
]

for (const c of CASES) {
  if (c.reads_only) {
    // The caller must be able to READ its own rows. An empty table is a pass — the question is
    // whether the SELECT is permitted, not whether anything is there yet — but an ERROR is not.
    const { error: readErr } = await asUser.from(c.table).select('id').limit(1)
    if (readErr) {
      console.log(`  ✗ ${c.table.padEnd(26)} authenticated CANNOT read — ${readErr.code} ${readErr.message}`)
      console.log(`      ${c.note}`)
      failures++
    } else {
      console.log(`  ✓ ${c.table.padEnd(26)} authenticated can read`)
    }
    // ...and must NOT be able to insert. A grant that appeared by accident — which is exactly what
    // this project's default privileges do to a new table (§3.6) — shows up here.
    const { error: insErr } = await asUser.from(c.table).insert(c.row)
    if (!insErr) {
      console.log(`  ✗ ${c.table.padEnd(26)} AUTHENTICATED CAN INSERT — 058 granted no INSERT on it`)
      failures++
    } else {
      console.log(`  ✓ ${c.table.padEnd(26)} authenticated refused INSERT (${insErr.code})`)
    }
    const { error: anonRead } = await asAnon.from(c.table).select('id').limit(1)
    const { error: anonIns } = await asAnon.from(c.table).insert(c.row)
    if (!anonRead || !anonIns) {
      console.log(`  ✗ ${c.table.padEnd(26)} ANON CAN ${!anonRead ? 'READ' : 'WRITE'} — the boundary is not there`)
      failures++
    } else {
      console.log(`  ✓ ${c.table.padEnd(26)} anon refused (${anonRead.code})`)
    }
    continue
  }

  // 1. the signed-in caller must be able to write.
  const { data: written, error: userErr } = await asUser.from(c.table).insert(c.row).select('id').maybeSingle()
  if (userErr) {
    console.log(`  ✗ ${c.table.padEnd(26)} authenticated CANNOT write — ${userErr.code} ${userErr.message}`)
    console.log(`      ${c.note}`)
    failures++
  } else {
    console.log(`  ✓ ${c.table.padEnd(26)} authenticated can write`)
    // 2. anon must not.
    const { error: anonErr } = await asAnon.from(c.table).insert(c.row)
    if (!anonErr) {
      console.log(`  ✗ ${c.table.padEnd(26)} ANON CAN WRITE — the boundary is not there`)
      failures++
    } else {
      console.log(`  ✓ ${c.table.padEnd(26)} anon refused (${anonErr.code})`)
    }
    if (written?.id) {
      const cleaner = c.cleanupNeedsServiceRole
        ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
        : asUser
      const { error: delErr } = await c.cleanup(cleaner, written.id)
      if (delErr) console.log(`      (probe row ${written.id} left behind: ${delErr.message})`)
    }
  }
}

// ---------------------------------------------------------------------------
// THE ROUTE, DRIVEN AS THE SIGNED-IN USER — R1 Task 7.
//
// The table probes above prove a grant and a policy. They do NOT prove the answer path works:
// `/api/chat` can 500 for a caller while every row it touches is writable. So the same token
// drives the route itself, in both modes, with the pipeline switches as the process has them.
//
// It needs a server. When there is none this SKIPS LOUDLY rather than failing, because
// `npm run db:migrate` runs this check and a migration should not be blocked by a dev server
// that is not up — but a skip that is easy to miss is how a check stops being a check, so it
// prints as a banner and says exactly what was not tested.
// ---------------------------------------------------------------------------
const BASE = process.env.CHECK_LIVE_BASE_URL || 'http://localhost:3000'

/**
 * `npm run check:live -- --only sources` runs ONE named block.
 *
 * *** THIS IS A COST CONTROL, NOT A CONVENIENCE. *** A full run is roughly a dozen real model
 * calls; the ledger (§128 J) puts it near $4. Proving one step three times should not cost
 * three full runs, and a check somebody avoids because of the bill is a check that stops being
 * run. The DEFAULT is still everything — a bare `npm run check:live` is unchanged, so this
 * cannot quietly narrow the gate the way `.only` narrows a test suite.
 */
const only = (() => {
  const i = process.argv.indexOf('--only')
  return i >= 0 ? process.argv[i + 1] : null
})()
const want = (name) => !only || only === name
if (only) console.log(`\n  --only ${only}: the other /api/chat blocks are SKIPPED and prove nothing this run.\n`)

async function reachable() {
  try {
    const r = await fetch(BASE, { method: 'GET', signal: AbortSignal.timeout(2500) })
    return r.status < 500
  } catch { return false }
}

if (!(await reachable())) {
  console.log(`  ${'─'.repeat(72)}`)
  console.log(`  SKIPPED — no server at ${BASE}, so /api/chat was NOT exercised.`)
  console.log('  The table probes above passed. The answer path is untested by this run:')
  console.log('  start the app (npm run dev) and run npm run check:live again.')
  console.log(`  ${'─'.repeat(72)}`)
} else {
  console.log(`\n  /api/chat — driven as ${FIXTURE.email} at ${BASE}\n`)
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // 1. RESEARCH streams, and the stream carries sources.
  if (want('research')) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ question: 'What is an SDS under OSHA HazCom?', mode: 'research', history: [] }),
  })
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('x-ndjson')) {
    console.log(`  ✗ research            did not stream — content-type ${ct || '(none)'} ${res.status}`)
    failures++
  } else {
    let text = '', sources = [], sawTextEvent = false
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() ?? ''
      for (const l of lines) {
        if (!l.trim()) continue
        let ev; try { ev = JSON.parse(l) } catch { continue }
        if (ev.type === 'text') sawTextEvent = true
        if (ev.type === 'reset') text = ''
        if (ev.type === 'done') { text = ev.research ?? ''; sources = ev.sources ?? [] }
      }
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    if (!sawTextEvent) { console.log('  ✗ research            no text events — it did not stream, it delivered'); failures++ }
    else if (!text.trim()) { console.log('  ✗ research            streamed nothing'); failures++ }
    else console.log(`  ✓ research            streamed ${text.length} chars, ${sources.length} source(s), ${secs}s`)
  }

  }

  // 2. CHECKLIST returns the shape the UI reads.
  if (want('checklist')) {
  const cl = await fetch(`${BASE}/api/chat`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ question: 'Starting a small auto repair shop in Oregon', mode: 'checklist', history: [] }),
  })
  const clJson = await cl.json().catch(() => null)
  const items = clJson?.must_do
  if (!cl.ok || !clJson) { console.log(`  ✗ checklist           ${cl.status} ${clJson?.error ?? ''}`); failures++ }
  else if (!Array.isArray(items) || items.length === 0) { console.log('  ✗ checklist           no must_do array'); failures++ }
  else {
    const f = items[0]
    const missing = ['name', 'description', 'why'].filter((k) => !f?.[k])
    if (missing.length) { console.log(`  ✗ checklist           first item missing ${missing.join(', ')}`); failures++ }
    else console.log(`  ✓ checklist           ${items.length} must_do, ${(clJson.good_to_have ?? []).length} good_to_have, shape intact`)
  }

  }

  // ---- RUN 2: the conversation survives, and the counters record events ----------------
  //
  // These drive the real routes as the fixture user. The properties are the ones that would
  // fail silently: a conversation that reloads empty, a counter that drifts, a stopped answer
  // counted as an answer, a "discussed" checklist citing a source nobody saw.
  const ask = async (question, topicId) => {
    const res = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: auth,
      body: JSON.stringify({ question, mode: 'research', history: [], topicId: topicId ?? '' }) })
    if (!(res.headers.get('content-type') ?? '').includes('x-ndjson')) return null
    let done = null
    const rd = res.body.getReader(); const dec2 = new TextDecoder(); let b = ''
    for (;;) { const { done: fin, value } = await rd.read(); if (fin) break
      b += dec2.decode(value, { stream: true }); const ls = b.split('\n'); b = ls.pop() ?? ''
      for (const l of ls) { if (!l.trim()) continue; let e; try { e = JSON.parse(l) } catch { continue }
        if (e.type === 'done') done = e } }
    return done
  }
  const countersNow = async () => (await asUser
    .from('usage_counters').select('questions_answered, checklists_created')
    .eq('company_id', companyId).maybeSingle()).data ?? { questions_answered: 0, checklists_created: 0 }

  const before = want('conversation') ? await countersNow() : null
  const first = want('conversation')
    ? await ask('Name the OSHA standard number for hazard communication. One line.') : null
  const convoTopic = first?.topicId

  if (!want('conversation')) { /* skipped by --only */ }
  else if (!convoTopic) { console.log('  ✗ conversation        no topicId came back — the turn was not saved'); failures++ }
  else {
    const { data: savedTurns } = await asUser
      .from('turns').select('position, role, stopped').eq('topic_id', convoTopic).order('position')
    if ((savedTurns ?? []).length < 2) { console.log(`  ✗ conversation        ${savedTurns?.length ?? 0} turns saved, expected 2`); failures++ }
    else console.log(`  ✓ conversation        ${savedTurns.length} turns saved and readable back`)

    // SURVIVES A RELOAD: the GET route is what the page uses to reopen it.
    const re = await fetch(`${BASE}/api/topics/${convoTopic}`, { headers: auth })
    const reJson = await re.json().catch(() => null)
    if (!re.ok || !(reJson?.turns?.length >= 2)) { console.log(`  ✗ reload              GET /api/topics/<id> -> ${re.status}`); failures++ }
    else console.log(`  ✓ reload              GET returns ${reJson.turns.length} turns, title ${JSON.stringify(String(reJson.topic?.title ?? '').slice(0, 34))}`)

    // A FOLLOW-UP ON A REOPENED CONVERSATION continues it — sending NO client history, which is
    // the state after a page reload. It also clears idle_at.
    await asUser // stand the topic down as the summariser would find it
      .from('topics').update({ idle_at: new Date().toISOString() }).eq('id', convoTopic)
    const follow = await ask('What did I just ask about?', convoTopic)
    const carried = /hazard communication|1910\.1200|hazcom/i.test(follow?.research ?? '')
    const { data: after } = await asUser.from('topics').select('idle_at, last_turn_at').eq('id', convoTopic).single()
    if (!carried) { console.log(`  ✗ continue            the follow-up did not carry the subject: ${JSON.stringify((follow?.research ?? '').slice(0, 90))}`); failures++ }
    else if (after.idle_at !== null) { console.log('  ✗ continue            idle_at was not cleared by a new turn'); failures++ }
    else console.log('  ✓ continue            reopened, carried the subject, idle_at cleared')
  }

  // COUNTERS: +1 per completed answer, and never for a stopped one.
  if (want('conversation')) {
  const mid = await countersNow()
  const asked = mid.questions_answered - before.questions_answered
  if (asked < 1) { console.log(`  ✗ counters            questions_answered moved by ${asked}, expected at least 1`); failures++ }
  else console.log(`  ✓ counters            questions_answered +${asked} across ${asked} completed answer(s)`)

  const ctl = new AbortController()
  setTimeout(() => ctl.abort(), 1500)
  try {
    await fetch(`${BASE}/api/chat`, { method: 'POST', headers: auth, signal: ctl.signal,
      body: JSON.stringify({ question: 'Give me an exhaustive history of OSHA rulemaking since 1971.', mode: 'research', history: [], topicId: convoTopic ?? '' }) })
      .then((r) => r.body.getReader().read())
  } catch { /* the abort is the point */ }
  await new Promise((r) => setTimeout(r, 2500))
  const afterStop = await countersNow()
  if (afterStop.questions_answered !== mid.questions_answered) {
    console.log(`  ✗ stop                a stopped answer moved the counter ${mid.questions_answered} -> ${afterStop.questions_answered}`); failures++
  } else {
    const { data: t } = await asUser.from('turns').select('role, stopped').eq('topic_id', convoTopic).order('position')
    const last = (t ?? [])[t.length - 1]
    if (!last || last.role !== 'user' || !last.stopped) {
      console.log(`  ✗ stop                the stopped question was not marked (last turn: ${last?.role}/${last?.stopped})`); failures++
    } else console.log('  ✓ stop                counter unchanged, question kept and marked, no answer row')
  }

  }

  // CONVERSION: scope=discussed may cite ONLY what the conversation cited.
  if (want('convert') && convoTopic) {
    const norm = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/+$/, '').toLowerCase() } catch { return String(u ?? '').toLowerCase() } }
    const { data: turnRows } = await asUser.from('turns').select('sources').eq('topic_id', convoTopic)
    const citedSet = new Set((turnRows ?? []).flatMap((r) => (r.sources ?? []).map((s) => norm(s.url))))

    for (const scope of ['discussed', 'complete']) {
      const res = await fetch(`${BASE}/api/checklists/from-topic`, { method: 'POST', headers: auth,
        body: JSON.stringify({ topicId: convoTopic, scope }) })
      const j = await res.json().catch(() => null)
      if (!res.ok) { console.log(`  ✗ convert ${scope.padEnd(10)} ${res.status} ${j?.error ?? ''}`); failures++; continue }
      const { data: items } = await asUser
        .from('checklist_items').select('origin, source_url').eq('checklist_id', j.checklistId)
      const outside = (items ?? []).filter((i) => i.source_url && !citedSet.has(norm(i.source_url)))
      const origins = (items ?? []).reduce((m, i) => ((m[i.origin ?? 'null'] = (m[i.origin ?? 'null'] || 0) + 1), m), {})
      if (scope === 'discussed') {
        if (outside.length) { console.log(`  ✗ convert discussed   ${outside.length} item(s) cite a source the conversation never used`); failures++ }
        else if (origins.added) { console.log(`  ✗ convert discussed   ${origins.added} item(s) marked 'added' in a discussed-only checklist`); failures++ }
        else console.log(`  ✓ convert discussed   ${items.length} items, all origin=conversation, 0 unseen sources`)
      } else {
        if (!origins.conversation || !origins.added) {
          console.log(`  ✗ convert complete    expected both origins, got ${JSON.stringify(origins)}`); failures++
        } else console.log(`  ✓ convert complete    ${items.length} items, ${origins.conversation} conversation + ${origins.added} added`)
      }
    }
  }

  // ---- FIX ROUND 1 (C): A THIRD TURN MUST STAND BY ITS OWN CITATIONS --------------------
  //
  // On 23 September a third turn said its earlier citation markers were not real sources it had
  // retrieved. They were. History was replayed as text carrying `[1]` with no list behind it, so
  // the model read numbered references to nothing and said so — and the summariser archived the
  // claim. This drives the exact sequence: a question that searches, a follow-up, then the
  // challenge. **The failure it catches is a denial, and the denial is what would reach a
  // customer as "we made those up".**
  if (want('sources')) await (async () => {
    const q1 = await ask('Which federal agency issues hazardous materials registration for '
      + 'interstate carriers, and what is the registration called? Cite your sources.')
    const cited = (q1?.sources ?? []).length
    const sourcesTopic = q1?.topicId
    if (!sourcesTopic) { console.log('  ✗ sources/turn1       no topicId — the searching turn was not saved'); failures++ }
    else if (cited === 0) {
      // Not a failure of the fix: with nothing cited there is nothing for turn three to deny.
      console.log(`  — sources             SKIPPED: the first answer cited 0 sources, so there is nothing to stand by`)
    } else {
      const q2 = await ask('And who has to renew it annually?', sourcesTopic)

      // ----------------------------------------------------------------------------------
      // *** IF THE LAST ANSWER CITED NOTHING, A DENIAL IS THE TRUTHFUL ANSWER. ***
      //
      // The question asked is "were the sources in your LAST answer real?". Measured on
      // 23 September: one sequence's second answer ran no search and stored zero sources, and
      // the model replied *"The second answer cited nothing. I wrote it from memory without
      // running a search."* **That is correct**, and the first version of this check scored it
      // as the defect — a checker calling an accurate answer a failure, which is worse than no
      // checker at all (`AUDIT-CHECKS.md` check 14).
      //
      // So the probe is only valid when there is something to stand behind. With nothing cited
      // the run SKIPS and says so; it never passes and never fails on a question it cannot ask.
      // ----------------------------------------------------------------------------------
      const lastCited = (q2?.sources ?? []).length
      if (lastCited === 0) {
        console.log(`  — sources             SKIPPED: the second answer cited 0 sources, so "were they real?" has no subject`)
        return
      }

      const q3 = await ask('Were the sources in your last answer real?', sourcesTopic)
      const said = String(q3?.research ?? '')

      // ----------------------------------------------------------------------------------
      // *** WHAT A SCRIPT CAN AND CANNOT JUDGE HERE, DECIDED AFTER GETTING IT WRONG TWICE. ***
      //
      // The recorded defect is a CATEGORICAL claim: "I did not run a search before those
      // answers, I wrote them from memory and formatted them to look retrieved." That is a
      // specific, detectable statement and it is what this fails on.
      //
      // It is NOT the same as a caveat. Three runs on 23 September opened with "Yes — I
      // re-checked them and they hold up" and went on to say two citations were weak and one
      // number was unconfirmed. **That is the product working**: an answer distinguishing what
      // it verified from what it did not is worth more than one that says everything is fine.
      // An earlier version of this check scored all three as the defect, on a regex that caught
      // the word "not" within sixty characters of "verify".
      //
      // And requiring the answer to repeat a HOSTNAME was equally wrong — "PHMSA administers
      // it" names the source; "phmsa.dot.gov" is how a URL is spelled, not how a person writes.
      //
      // So: FAIL on a denial, PASS on an affirmation, and anything else is reported for a
      // person to read rather than guessed at — `TESTING.md` (a)'s rule, applied to its own
      // harness.
      // ----------------------------------------------------------------------------------
      const denial = new RegExp([
        'did ?n.?t (actually )?(run|do|perform|execute) (a |any )?search',
        'i did not (run|do|perform) (a |any )?search',
        'no search(es)? (was|were) (run|performed|done)',
        'wrote (them|it|those) from (my )?memory',
        '(made (them|it|those) up|fabricat|invent(ed)? (them|the|those)|hallucinat)',
        'formatted (them )?to look (like )?(retrieved|real)',
        '(are|were) ?n.?t real',
      ].join('|'), 'i').test(said)

      const affirms = /(yes\b|they (are|were) real|real (search results|pages)|they hold up|holds up|re-?checked .{0,40}(hold|confirm)|confirmed)/i.test(said)

      if (denial) {
        console.log(`  ✗ sources             turn three DISOWNED its citations: ${JSON.stringify(said.slice(0, 140))}`); failures++
      } else if (affirms) {
        console.log(`  ✓ sources             turn three stood by its ${cited} citations (caveats about individual sources are fine)`)
      } else {
        // Neither shape. Not scored either way — printed for a person.
        console.log(`  ? sources             NEITHER a denial nor a clear affirmation — read the wording below`)
      }
      console.log(`      └────────────────────────────────────────────────────────────────`)
    }
  })()

  // ---- FIX ROUND 2 (1): AN ATTACHED FILE MUST REACH THE MODEL --------------------------
  //
  // On production the owner attached a policy PDF, watched it classify and file correctly, then
  // asked about it and was told no file had come through. The upload worked; nothing carried the
  // document into the research call. This drives the whole path as a real signed-in user:
  // upload -> documents row -> review -> ask, with the fixture the answer can be checked against.
  //
  // *** THE ASSERTIONS COME FROM THE FIXTURE, NOT FROM THE BRIEF. *** Every one is a statement
  // the PDF actually makes (25 at Ballard, 31 at Fremont, 30-day card window, per-establishment
  // cards, 180-day wait, 24-hour carryover, find-your-own-cover, tip credit, $20.76) and each is
  // deliberately wrong in it. An answer that does not reach the document cannot produce them.
  /**
   * *** THE ATTACHMENT PROBE LEAVES NOTHING BEHIND — Audits Run 6a, item 4. ***
   *
   * It uploaded the Harbor Kitchen policy on every run and never removed it, so the fixture company
   * accumulated one copy per run: THREE of them by 30 September, found while the audits template
   * flow was failing for an unrelated reason. Every other flow in this file already cleans up after
   * itself in a `finally` — the audit flow deletes its run, its document and its label — and this
   * one is now the same shape.
   *
   * It matters beyond tidiness. The audit flows read every document the company holds, so three
   * copies of the same policy are three documents an audit has to account for, and the same policy
   * named three times is a reasonable thing for a model to call a contradiction. A probe that
   * changes the state the next probe is measured in is a probe that makes a failure unattributable.
   *
   * The `try` wraps the existing block with nothing re-indented on purpose: the early returns inside
   * are all legitimate failure exits and every one of them now still reaches the cleanup.
   */
  let attachDocId = null
  let attachPath = null
  if (want('attachment')) try { await (async () => {
    const { readFileSync } = await import('node:fs')
    const FIXTURE = 'tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf'
    let bytes
    try { bytes = readFileSync(FIXTURE) } catch {
      console.log(`  ✗ attachment          fixture missing: ${FIXTURE}`); failures++; return
    }
    const file = new File([bytes], 'Harbor-Kitchen-Employee-Policy-2026.pdf', { type: 'application/pdf' })
    const path = `${companyId}/compliance/${Date.now()}-check-live-harbor-kitchen.pdf`

    const { error: upErr } = await asUser.storage.from('company-documents').upload(path, file)
    if (upErr) { console.log(`  ✗ attachment          upload refused: ${upErr.message}`); failures++; return }

    const docRes = await fetch(`${BASE}/api/documents`, { method: 'POST', headers: auth,
      body: JSON.stringify({ name: file.name, file_url: path, file_type: 'application/pdf', file_size: bytes.length }) })
    if (!docRes.ok) { console.log(`  ✗ attachment          /api/documents -> ${docRes.status}`); failures++; return }
    const { data: docRow } = await asUser.from('documents').select('id').eq('file_url', path).maybeSingle()
    if (!docRow?.id) { console.log('  ✗ attachment          the document row could not be read back'); failures++; return }
    // Held outside the block so the cleanup can reach them whichever way this exits.
    attachDocId = docRow.id
    attachPath = path

    // The reading, exactly as the page runs it — it is what later turns are served from.
    // `/api/document-scan` since Run 6, not the old review: the attach flow moved, and a check
    // that still drove the route the page no longer calls would pass while the page was broken.
    const scanRes = await fetch(`${BASE}/api/document-scan`, {
      method: 'POST', headers: auth, body: JSON.stringify({ document_id: String(docRow.id) }) })
    const scan = await scanRes.json().catch(() => null)
    if (!scanRes.ok) { console.log(`  ✗ attachment          /api/document-scan -> ${scanRes.status} ${scan?.error ?? ''}`); failures++; return }
    if (scan?.status === 'could_not_read') {
      console.log(`  ✗ attachment          the scan could not read the fixture: ${scan?.could_not_read?.reason ?? ''}`); failures++; return }

    // AND THE CARD IS READ OFF THE INDEX ROW, so this checks the row the page will show rather
    // than the scan's own response. A scan that wrote nothing the view can see is the failure
    // this line exists to catch.
    const { data: indexed } = await asUser.from('document_index_v')
      .select('title, kind, agencies, display_status').eq('document_id', String(docRow.id)).maybeSingle()
    if (!indexed) { console.log('  ✗ attachment          document_index_v had no row for the scanned file'); failures++; return }
    if (!indexed.kind && indexed.display_status === 'not_yet_read') {
      console.log('  ✗ attachment          the index row still reads not_yet_read after the scan'); failures++; return }
    console.log(`  ✓ attachment/scan     read as ${JSON.stringify(indexed.kind ?? '?')} · ${JSON.stringify(indexed.title ?? '?')} · ${indexed.display_status}`)

    // THE QUESTION. A fresh conversation, the document id travelling with it.
    const askRes = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: auth,
      body: JSON.stringify({ question: "check this policy against Seattle's paid sick leave rules",
                             mode: 'research', history: [], topicId: '', documentId: String(docRow.id) }) })
    if (!(askRes.headers.get('content-type') ?? '').includes('x-ndjson')) {
      console.log(`  ✗ attachment          /api/chat did not stream: ${askRes.status}`); failures++; return
    }
    let done = null
    const rd = askRes.body.getReader(); const dec3 = new TextDecoder(); let b3 = ''
    for (;;) { const { done: fin, value } = await rd.read(); if (fin) break
      b3 += dec3.decode(value, { stream: true }); const ls = b3.split('\n'); b3 = ls.pop() ?? ''
      for (const l of ls) { if (!l.trim()) continue; let e; try { e = JSON.parse(l) } catch { continue }
        if (e.type === 'done') done = e } }
    const said = String(done?.research ?? '')

    if (!said.trim()) { console.log('  ✗ attachment          the answer was empty'); failures++; return }

    // 1. DID IT SEE THE DOCUMENT AT ALL? The failure mode being tested says "no file".
    const denies = /(no file|nothing was attached|didn.t receive|did not receive|haven.t received|no document|unable to see|cannot see (any|the) (file|document))/i.test(said)
    if (denies) {
      console.log(`  ✗ attachment          the answer says no file arrived: ${JSON.stringify(said.slice(0, 160))}`); failures++
    }

    // 2. THE TIER. The policy claims Tier 1 from one location's headcount; the employer is one
    // company with 25 + 31 = 56, which is Tier 2. Getting this right requires reading the PDF.
    const tier2 = /tier\s*2/i.test(said)
    const counts = /\b56\b/.test(said) || (/\b25\b/.test(said) && /\b31\b/.test(said))
    if (!tier2 || !counts) {
      console.log(`  ✗ attachment/tier     tier 2 named: ${tier2 ? 'yes' : 'NO'} · headcount (56, or 25 and 31): ${counts ? 'yes' : 'NO'}`); failures++
    } else {
      console.log('  ✓ attachment/tier     Tier 2, counted across both locations (25 + 31 = 56)')
    }

    // 3. THE ERRORS. Each is a claim the fixture makes and each is wrong.
    const ERRORS = [
      ['30-day card window',      /\b30[- ]day/i],
      ['cards are per-establishment', /(per[- ]establishment|per[- ]location|new card|transfer)/i],
      ['180-day waiting period',  /\b180[- ]day/i],
      ['24-hour carryover',       /\b24[- ]hours?\b/i],
      ['find-your-own-cover',     /(find (a )?(co-?worker|replacement|cover)|shift coverage|own cover)/i],
      ['tip credit',              /tip credit|tips? .{0,30}credited/i],
      ['the minimum wage figure', /20\.76/],
    ]
    const found = ERRORS.filter(([, re]) => re.test(said))
    if (found.length < 5) {
      console.log(`  ✗ attachment/errors   named ${found.length} of the policy's errors, needs 5: ` +
        `${found.map(([n]) => n).join(', ') || '(none)'}`); failures++
    } else {
      console.log(`  ✓ attachment/errors   named ${found.length} of 7: ${found.map(([n]) => n).join(', ')}`)
    }

    // 4. THE LINK IS PERSISTED — migration 039. Without it the next turn forgets the file.
    const { data: linked } = await asUser.from('turns')
      .select('position, role, document_id, document_name').eq('topic_id', done?.topicId ?? '')
      .not('document_name', 'is', null)
    if (!linked?.length) {
      console.log('  ✗ attachment/persist  no turn carries the document — a later turn will forget it'); failures++
    } else {
      console.log(`  ✓ attachment/persist  turn ${linked[0].position} carries ${JSON.stringify(linked[0].document_name)}`)
    }

    console.log(`      ┌─ the answer ───────────────────────────────────────────────────`)
    for (const l of said.split('\n')) console.log(`      │ ${l}`)
    console.log(`      └────────────────────────────────────────────────────────────────`)
  })() } finally {
    /**
     * *** AS THE SIGNED-IN USER, NOT THE SERVICE ROLE. ***
     * The audit flows build their own `admin` client inside their own functions, and reaching for
     * one here was this block's first version — it threw `ReferenceError: admin is not defined` and
     * took the whole run down with it, before either audit flow had started. Using `asUser` is the
     * better answer anyway: the person who uploaded the file is the person removing it, so this
     * cleanup also proves the DELETE policy on `documents` lets an owner delete their own row
     * (§9a — verify as a signed-in user, not the service role).
     *
     * The row first, then the file: a document row pointing at storage that is gone is a broken
     * row, and a file with no row is an orphan nobody will ever find.
     */
    if (attachDocId) {
      const { error } = await asUser.from('documents').delete().eq('id', attachDocId)
      if (error) console.log(`  · attachment/cleanup  the document row would not delete: ${error.message}`)
    }
    if (attachPath) {
      const { error } = await asUser.storage.from('company-documents').remove([attachPath])
      if (error) console.log(`  · attachment/cleanup  the stored file would not delete: ${error.message}`)
    }
    /**
     * *** AND THE LABELS THE POLICY CAUSED, WHICH DELETING THE DOCUMENT DOES NOT TAKE — Run 7a. ***
     *
     * Deleting a document deletes its scan. It does NOT delete `company_labels`: those are the
     * COMPANY's vocabulary, upserted from each reading, and nothing removes one when the reading
     * that caused it goes. Run 6a's cleanup removed the Harbor Kitchen policy and left behind what
     * reading it had written, so on 1 October `Test Gamma Solvents` — a chemical manufacturer in
     * Portland, Oregon, holding **zero documents** — carried:
     *
     *   agency : Washington State Department of Health · City of Seattle Office of Labor Standards
     *            · Washington State Liquor and Cannabis Board
     *   subject: food_worker_certification · workplace_wages · alcohol_service_training
     *            · paid_sick_leave
     *
     * **That confirms `DECISIONS.md` §141's unverified hypothesis** about where the Seattle labels on
     * the fixture company came from: this block.
     *
     * It is not cosmetic. `auditAgenciesFor` reads `company_labels`, so an "audit everything" on this
     * company would have run a section per phantom agency with no document behind it, and the
     * template audit was shown a Portland chemical plant whose own agency list is Seattle labour
     * standards. A label no surviving scan supports is an orphan, and this removes exactly those —
     * never a label a remaining reading still asserts.
     */
    /**
     * *** AND THIS ONE NEEDS THE SERVICE ROLE, WHICH IS A FACT ABOUT THE PRODUCT. ***
     * The first version used `asUser` and got `permission denied for table company_labels`. Read
     * back with `has_table_privilege` rather than from a grant list — `information_schema.role_table_grants`
     * returned ZERO rows for this table, which is the view's own limitation and not an answer:
     *
     *   authenticated SELECT: true · INSERT: false · UPDATE: false · DELETE: false
     *
     * So a person may READ the company's vocabulary and may never change it: labels come from
     * readings, and only the server writes one. That is the right rule and it is not being changed
     * here — it simply means a probe that created a label must clean it up as the server, the way
     * the audit flows below already delete their own label.
     */
    const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
    const { data: scans } = await svc.from('document_scans')
      .select('agencies, subjects').eq('company_id', companyId).eq('is_current', true)
    const alive = new Set()
    for (const sc of scans ?? []) {
      for (const a of sc.agencies ?? []) alive.add(`agency:${a}`)
      for (const b of sc.subjects ?? []) alive.add(`subject:${b}`)
    }
    const { data: labels } = await svc.from('company_labels')
      .select('id, kind, label').eq('company_id', companyId)
    const orphans = (labels ?? []).filter((l) => !alive.has(`${l.kind}:${l.label}`))
    if (orphans.length) {
      const { error } = await svc.from('company_labels').delete().in('id', orphans.map((l) => l.id))
      if (error) { console.log(`  ✗ attachment/cleanup  ${orphans.length} orphan label(s) would not delete: ${error.message}`); failures++ }
      else console.log(`  ✓ attachment/cleanup  ${orphans.length} orphan label(s) removed — `
        + orphans.slice(0, 4).map((l) => `${l.kind}:${l.label}`).join(' · ')
        + (orphans.length > 4 ? ` · +${orphans.length - 4} more` : ''))
    } else {
      console.log('  ✓ attachment/cleanup  no orphan label left behind')
    }

    // Said out loud, and with the count READ BACK rather than assumed: the whole reason this block
    // changed is that nobody noticed copies piling up — four of them by the time anyone looked.
    const { count, error: cErr } = await asUser.from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('name', 'Harbor-Kitchen-Employee-Policy-2026.pdf')
    if (cErr) {
      console.log(`  ✗ attachment/cleanup  the count could not be read: ${cErr.message}`); failures++
    } else if (count === 0) {
      console.log('  ✓ attachment/cleanup  policy removed · 0 copy(ies) left on this company')
    } else {
      console.log(`  ✗ attachment/cleanup  ${count} copy(ies) of the policy are still on this company`)
      failures++
    }
  }

  // ---- RUN 3: the routes the rebuilt page depends on ------------------------------------
  //
  // The PAGE itself is proved by the manual set in TESTING.md — a script cannot judge whether a
  // drawer reads well. What a script CAN prove is that the routes the page calls behave, and
  // these are the three the rebuild added a caller for.
  if (convoTopic) {
    // GET /api/topics/<id> — the page reopens a conversation with this.
    const g = await fetch(`${BASE}/api/topics/${convoTopic}`, { headers: auth })
    const gj = await g.json().catch(() => null)
    if (!g.ok || !Array.isArray(gj?.turns)) { console.log(`  ✗ topic GET           ${g.status}`); failures++ }
    else console.log(`  ✓ topic GET           ${gj.turns.length} turns, transcript_cleared=${gj.transcript_cleared}`)

    // POST /api/topics/<id>/summarise — "Summarise this". It must mark the summary as the
    // user's, or tonight's job would replace a summary somebody deliberately asked for.
    const sres = await fetch(`${BASE}/api/topics/${convoTopic}/summarise`, { method: 'POST', headers: auth })
    const sj = await sres.json().catch(() => null)
    if (!sres.ok || !sj?.summary) { console.log(`  ✗ summarise           ${sres.status} ${sj?.error ?? ''}`); failures++ }
    else {
      const { data: t } = await asUser.from('topics').select('summary_source').eq('id', convoTopic).maybeSingle()
      if (t?.summary_source !== 'user') { console.log(`  ✗ summarise           summary_source is ${t?.summary_source}, expected user`); failures++ }
      else console.log(`  ✓ summarise           ${sj.summary.length} chars, summary_source=user`)
    }
  }

  // DELETE /api/topics/<id> — the Delete on a conversation row. Proved on a throwaway topic so
  // the one above survives for the rest of this run.
  {
    const { data: tmp } = await asUser.from('topics').insert({ company_id: companyId, title: 'check:live delete probe' }).select('id').single()
    await asUser.from('turns').insert([
      { topic_id: tmp.id, company_id: companyId, position: 1, role: 'user', text: 'probe' },
      { topic_id: tmp.id, company_id: companyId, position: 2, role: 'assistant', text: 'probe' },
    ])
    const d = await fetch(`${BASE}/api/topics/${tmp.id}`, { method: 'DELETE', headers: auth })
    const dj = await d.json().catch(() => null)
    const { count: left } = await asUser.from('turns').select('*', { count: 'exact', head: true }).eq('topic_id', tmp.id)
    const { count: topicLeft } = await asUser.from('topics').select('*', { count: 'exact', head: true }).eq('id', tmp.id)
    if (!d.ok || left !== 0 || topicLeft !== 0) {
      console.log(`  ✗ topic DELETE        ${d.status}, ${left} turns and ${topicLeft} topic rows left behind`); failures++
    } else console.log(`  ✓ topic DELETE        removed the topic and its ${dj?.turns_deleted ?? '?'} turns`)
  }

  // 3. HISTORY — ask, then ask what was just asked. The answer must name it.
  const hist = [{ question: 'What are the rules for storing propane cylinders outdoors?',
                  answer: 'Propane cylinder storage outdoors is governed by NFPA 58 and local fire code.' }]
  const fu = await fetch(`${BASE}/api/chat`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ question: 'What did I just ask about?', mode: 'research', history: hist }),
  })
  let followUp = ''
  if ((fu.headers.get('content-type') ?? '').includes('x-ndjson')) {
    const reader = fu.body.getReader(); const dec = new TextDecoder(); let buf = ''
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() ?? ''
      for (const l of lines) { if (!l.trim()) continue; let ev; try { ev = JSON.parse(l) } catch { continue }
        if (ev.type === 'done') followUp = ev.research ?? '' }
    }
  }
  if (/propane/i.test(followUp)) console.log('  ✓ history             the follow-up names propane — prior turns reached the model')
  else { console.log(`  ✗ history             the follow-up did not name the prior subject: ${JSON.stringify(followUp.slice(0, 120))}`); failures++ }
}

/**
 * ONE SEEDED DOCUMENT, SHARED BY BOTH AUDIT FLOWS — Audits Run 4c.
 *
 * Test Gamma Solvents holds no documents, which is right for what it is: a company with a login and
 * nothing in it. Both audit flows need at least one reading to audit against — and the template flow
 * found out the hard way, by asking a model to answer eight checklist lines against an empty filing
 * cabinet and getting prose back instead of JSON.
 *
 * *** THE EXPIRY IS A DEADLINE, NOT A COLUMN. *** `document_scans` has no `significant_date`;
 * migration 049 moved it into `document_index_v`, computed from `document_deadlines` for a permit as
 * the latest non-recurring deadline whose title matches 'expir'. So the title here is what makes this
 * read as a permit expiring in 2027 rather than one issued in 2024.
 */
const PROBE_AGENCY = 'Oregon DEQ'

async function seedRow(admin, table, row, select) {
  const q = admin.from(table).insert(row)
  const { data, error } = select ? await q.select(select).single() : await q
  // Every write checked: an error read as an absence is how "Cannot read properties of null" ends up
  // three lines away from its cause (§9a).
  if (error) throw new Error(`seeding ${table}: ${error.code} ${error.message}`)
  return data
}

async function seedProbeDocument(admin, companyId, siteId, fileName) {
  const doc = await seedRow(admin, 'documents', {
    company_id: companyId, name: fileName, file_url: `probe/${fileName}`,
    file_type: 'application/pdf', source: 'upload', status: 'read', entity_id: siteId ?? null,
  }, 'id')
  const scan = await seedRow(admin, 'document_scans', {
    document_id: doc.id, company_id: companyId, entity_id: siteId ?? null,
    kind: 'permit', status: 'current', is_current: true,
    title: 'Air Contaminant Discharge Permit (check:live probe)',
    agencies: [PROBE_AGENCY], subjects: ['Air Quality'],
    doc_date: '2024-01-01', doc_date_kind: 'issued',
    summary: 'A probe permit written by check:live. It expires on 1 January 2027 and requires a '
      + 'daily scrubber pressure-drop log under condition 3.1.',
  }, 'id')
  await seedRow(admin, 'document_deadlines', {
    scan_id: scan.id, document_id: doc.id, company_id: companyId,
    title: 'Permit expires', due_on: '2027-01-01', recurs: false,
  })
  await seedRow(admin, 'document_conditions', {
    scan_id: scan.id, document_id: doc.id, company_id: companyId, ordinal: 1,
    condition_ref: '3.1', title: 'Record one scrubber pressure-drop reading per operating day',
    evidence_expected: 'a daily log',
  })
  const { error: lErr } = await admin.from('company_labels')
    .upsert({ company_id: companyId, kind: 'agency', label: PROBE_AGENCY },
            { onConflict: 'company_id,kind,label' })
  if (lErr) throw new Error(`seeding company_labels: ${lErr.code} ${lErr.message}`)
  return doc.id
}

// ---------------------------------------------------------------------------
// THE AUDIT, START TO FINISH, THROUGH THE ROUTES — Audits Run 2c, item 12.
//
// The probes above prove a grant. This proves the PATH: a run started through POST /api/audit-runs,
// picked up, a real model call, findings written with a document resolved, and a cost on the ledger.
//
// *** IT SEEDS ITS OWN EVIDENCE, AND DOES NOT CALL THE SCAN. *** Test Gamma Solvents holds no
// documents and no agency labels, so an audit of it would correctly return a finished run with zero
// sections — which asserts nothing. The alternative, uploading and scanning a document here, would
// put a second document-scan call into every `npm run db:migrate` and would be testing Documents,
// not Audits. So the document and its reading are written directly, as a fixture, and only the AUDIT
// is real. One Haiku call.
//
// It needs a server, and skips loudly without one, for the same reason the route blocks above do.
// ---------------------------------------------------------------------------
if (want('audit')) {
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
  const LABEL = 'Oregon DEQ'
  const FIXTURE_NAME = 'check-live-audit-probe.pdf'
  let docId = null, runId = null

  try {
    const alive = await fetch(`${BASE}/api/industries`).then((r) => r.ok).catch(() => false)
    if (!alive) {
      console.log(`\n  ! audit flow SKIPPED — no server at ${BASE}. Nothing about the audit routes was tested.\n`)
    } else {
      // ---- the fixture: one document, one reading, one agency label ----
      // *** EVERY SEED WRITE IS CHECKED. *** The first version of this block checked none of them,
      // and the failure surfaced as "Cannot read properties of null (reading 'id')" three lines
      // later — an error read as an absence, for the third time in two runs. `die` here would take
      // the whole check down, so each one raises with the column the database actually objected to.
      // The same seed the template flow uses, so there is one definition of "a company with one
      // readable permit in it".
      docId = await seedProbeDocument(admin, companyId, site?.id ?? null, FIXTURE_NAME)

      // ---- POST, as the signed-in user ----
      const t0 = Date.now()
      const start = await fetch(`${BASE}/api/audit-runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: 'agency', agency: LABEL, scope: 'check:live probe' }),
      })
      const started = await start.json().catch(() => ({}))
      if (!start.ok || !started.id) {
        console.log(`  ✗ audit start          POST /api/audit-runs -> ${start.status} `
          + `${JSON.stringify(started).slice(0, 160)}`)
        failures++
      } else {
        runId = started.id
        console.log(`  ✓ audit start          run ${runId}, ${started.sections} section(s), `
          + `estimate: ${started.estimate}`)

        // ---- poll GET until done, or five minutes ----
        let run = null, sections = [], findings = []
        const deadline = Date.now() + 300_000
        for (;;) {
          const r = await fetch(`${BASE}/api/audit-runs/${runId}`, {
            headers: { authorization: `Bearer ${token}` },
          })
          const body = await r.json().catch(() => ({}))
          if (!r.ok) { console.log(`  ✗ audit poll           GET -> ${r.status}`); failures++; break }
          run = body.run; sections = body.sections ?? []; findings = body.findings ?? []
          if (run?.status === 'done') break
          if (Date.now() > deadline) {
            console.log(`  ✗ audit poll           still ${run?.status} after 5 minutes `
              + `(${run?.done_count}/${run?.section_count} sections)`)
            failures++
            break
          }
          await new Promise((res) => setTimeout(res, 5000))
        }

        if (run?.status === 'done') {
          const wall = ((Date.now() - t0) / 1000).toFixed(1)
          const doneSections = sections.filter((x) => x.status === 'done' && x.ai_call_id)
          const resolved = findings.filter((f) => f.document_id && f.document)
          // *** THE COST COMES OFF THE LEDGER, BECAUSE IT NO LONGER COMES OFF THE ROUTE. ***
          // Run 4a took `cost_usd` off every customer screen and out of the three routes that
          // served it (§147). A check is not a customer screen, so it reads `ai_calls` itself —
          // the same window `lib/auditRun.ts`'s `costOfSections` uses — and the assertion is
          // unchanged: a real model call leaves a receipt.
          // An agency run makes no extraction call, so there is nothing extra to pass and the
          // figure does not move. Left as the two-argument call deliberately: that IS the shape an
          // agency reader should use, and a third argument here would suggest otherwise.
          const cost = await costOfSections(admin, companyId,
            sections.map((x) => ({ started_at: x.started_at, finished_at: x.finished_at })))

          if (doneSections.length) {
            console.log(`  ✓ audit sections       ${doneSections.length} done with an ai_call_id `
              + `(model ${doneSections[0].model})`)
          } else {
            console.log(`  ✗ audit sections       no section is done with an ai_call_id — `
              + sections.map((x) => `${x.title}:${x.status}`).join(', '))
            failures++
          }
          if (resolved.length) {
            console.log(`  ✓ audit findings       ${findings.length} finding(s), ${resolved.length} `
              + `with a resolved document — e.g. "${String(resolved[0].title).slice(0, 44)}" `
              + `-> ${resolved[0].document.file_name}`)
          } else {
            console.log(`  ✗ audit findings       ${findings.length} finding(s), none with a resolved document`)
            failures++
          }
          if (cost > 0) console.log(`  ✓ audit cost           $${cost.toFixed(4)} off the ledger, ${wall}s end to end`)
          else { console.log('  ✗ audit cost           the run cost 0 — no ai_calls row reached its section'); failures++ }
        }
      }
    }
  } catch (e) {
    console.log(`  ✗ audit flow           threw: ${e instanceof Error ? e.message : String(e)}`)
    failures++
  } finally {
    // The probe leaves nothing behind. The run goes first: its findings point at the document, and
    // 058's composite key means the document cannot be removed from under them.
    if (runId) await admin.from('audit_runs').delete().eq('id', runId)
    if (docId) await admin.from('documents').delete().eq('id', docId)
    await admin.from('company_labels').delete().eq('company_id', companyId).eq('label', LABEL)
  }
}

// ---------------------------------------------------------------------------
// THE TEMPLATE AUDIT, THROUGH THE ROUTES — Audits Run 4c, item 10.
//
// The checklist here is the golden case 13 fixture, a real .docx with eight numbered lines. It is
// uploaded as a document (Documents' path, the same one the box uses), then audited against.
// What is asserted is the SHAPE the feature promises: one finding per line, each carrying the
// checklist's own reference. Whether the words are right is `npm run golden:audit` against
// `tests/golden/audits/cases/cascade-template-13.json`, three runs, judged line by line.
// ---------------------------------------------------------------------------
if (want('template')) {
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', { auth: { persistSession: false } })
  /**
   * *** THE CHECKLIST IS NEUTRAL, AND IT HAS TO BE. ***
   * This used the golden case 13 fixture — Cascade's own monthly form — and the model refused it
   * twice, both times correctly. First: "you have shown me only 2 documents… neither contains…",
   * which the template prompt now answers (thin evidence is the answer, not a reason to decline).
   * Then: "the checklist is for CASCADE SPECIALTY CHEMICALS but the company information says…" —
   * and that objection is RIGHT. A checklist naming another company is worth flagging rather than
   * silently auditing, and a probe must not depend on the model ignoring that.
   *
   * So the probe writes its own four-line form, named after nobody, as plain text. What is being
   * checked is the SHAPE — one row per line, each with its reference — not the answers, which is
   * `npm run golden:audit` against the two template cases.
   */
  /**
   * *** AND EVERY LINE IS ANSWERABLE FROM THE DOCUMENT THIS FLOW SEEDS — Audits Run 7a, item 1. ***
   *
   * The four lines used to ask about a scrubber log for the month, five-year retention and a posted
   * emergency contact. `seedProbeDocument` seeds **one** document — an air permit with a title, an
   * agency, a site, an expiry deadline of 1 January 2027 and condition 3.1 — and it answers none of
   * those three. So the model was shown a four-line form and two documents, one of which was the
   * form, and nothing in the filing cabinet addressed three of the four lines. On 1 October it
   * replied in prose three times running: *"I need clarification to proceed. You've provided: 1. A
   * checklist with 4 lines … 2. Two documents on file (D1 and D2)"*. The prompt already forbids that
   * (`prompts/audit-agency.ts`, "Never reply with prose explaining that you cannot answer") and the
   * model did it anyway — but a gate that depends on a model obeying an instruction under the
   * thinnest possible evidence is a gate that fails for a reason it was not built to test.
   *
   * Each line below is now answerable from the seeded permit and from nothing else:
   *
   *   1. the permit is on file         <- the scan's kind and title
   *   2. it expires on 1 January 2027  <- document_deadlines, "Permit expires", due_on 2027-01-01
   *   3. it is a DEQ permit            <- the scan's agencies array, PROBE_AGENCY
   *   4. it names the site             <- the document's entity_id, the company's primary site
   *
   * *** THIS IS A PLUMBING PROBE AND NOT A QUALITY TEST, AND THE DISTINCTION IS THE POINT. ***
   * What it proves is that a checklist reaches the model, comes back, and lands as one row per line
   * with one of the four words on each. **Whether those words are the RIGHT words is the golden
   * set's job** — `npm run golden:audit` against `cascade-template-12` and `cascade-template-13`,
   * three runs each, every line judged against its spec's own AUDIT USE section. Making the lines
   * answerable is therefore not softening the check: the check never measured the answers. It is
   * removing a second variable from a question that only ever had one.
   */
  const CHECKLIST = [
    'MONTHLY COMPLIANCE SELF-CHECK',
    '',
    '1. An air quality permit for this facility is on file',
    '2. The permit expiry date is recorded',
    '3. The permit names the agency that issued it',
    '4. The permit is tied to the site it covers',
  ].join('\n')
  let docId = null, runId = null, storagePath = null, evidenceId = null

  try {
    const alive = await fetch(`${BASE}/api/industries`).then((r) => r.ok).catch(() => false)
    if (!alive) {
      console.log(`\n  ! template flow SKIPPED — no server at ${BASE}.\n`)
    } else {
      // *** A CHECKLIST NEEDS SOMETHING TO BE ANSWERED AGAINST. ***
      // Without this the model was asked to answer eight lines against an empty filing cabinet and
      // returned prose instead of JSON — the section came back `could_not_complete (unparseable)`,
      // which was the honest outcome of an unanswerable question.
      evidenceId = await seedProbeDocument(admin, companyId, site?.id ?? null,
        'check-live-template-evidence.pdf')

      const bytes = Buffer.from(CHECKLIST, 'utf8')
      storagePath = `${companyId}/probe/${Date.now()}-check-live-checklist.txt`
      const { error: upErr } = await admin.storage.from('company-documents')
        .upload(storagePath, bytes, { contentType: 'text/plain' })
      if (upErr) throw new Error(`uploading the checklist: ${upErr.message}`)

      const { data: doc, error: dErr } = await admin.from('documents').insert({
        company_id: companyId, name: 'check-live-checklist.txt', file_url: storagePath,
        file_type: 'text/plain', file_size: bytes.length, source: 'upload', status: 'uploaded',
      }).select('id').single()
      if (dErr) throw new Error(`the document row: ${dErr.code} ${dErr.message}`)
      docId = doc.id

      const start = await fetch(`${BASE}/api/audit-runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: 'template', template_document_id: docId }),
      })
      const started = await start.json().catch(() => ({}))
      if (!start.ok || !started.id) {
        console.log(`  ✗ template start       POST -> ${start.status} ${JSON.stringify(started).slice(0, 160)}`)
        failures++
      } else {
        runId = started.id
        console.log(`  ✓ template start       run ${runId}, ${started.sections} section(s), `
          + `${started.lines} line(s) read off the checklist`)

        let run = null, findings = []
        const deadline = Date.now() + 300_000
        for (;;) {
          const r = await fetch(`${BASE}/api/audit-runs/${runId}`, { headers: { authorization: `Bearer ${token}` } })
          const body = await r.json().catch(() => ({}))
          if (!r.ok) { console.log(`  ✗ template poll        GET -> ${r.status}`); failures++; break }
          run = body.run; findings = body.findings ?? []
          if (run?.status === 'done') break
          if (Date.now() > deadline) {
            console.log(`  ✗ template poll        still ${run?.status} after 5 minutes`); failures++; break
          }
          await new Promise((res) => setTimeout(res, 5000))
        }

        if (run?.status === 'done') {
          const withLine = findings.filter((f) => f.template_line)
          // *** ONE ROW PER LINE, WHATEVER THE ANSWER. *** A checklist with eight lines and seven
          // rows is a report that lost a question, and the lost one is the one nobody notices.
          if (withLine.length === started.lines && started.lines > 0) {
            console.log(`  ✓ template findings    ${withLine.length} finding(s), one per line, each with a `
              + `template_line — e.g. ${withLine[0].template_line}: `
              + `"${String(withLine[0].template_text ?? '').slice(0, 44)}"`)
          } else {
            // *** A CHECK THAT REPORTS ITS INPUTS, NOT ITS CONCLUSION (§9a). *** The first version
            // said only "0 rows with a template_line", and the run it was about had already been
            // cleaned up, so there was nothing left to look at. The section's own state is what
            // says whether the call failed, came back unparseable, or answered nothing.
            const secs = (await (await fetch(`${BASE}/api/audit-runs/${runId}`,
              { headers: { authorization: `Bearer ${token}` } })).json().catch(() => ({}))).sections ?? []
            console.log(`  ✗ template findings    ${withLine.length} row(s) with a template_line, `
              + `the checklist has ${started.lines} line(s)`)
            // The model's own first words, read with the service role because the route does not
            // expose `raw_text`. Without them "unparseable" is a conclusion with no input behind it.
            const { data: rawSecs } = await admin.from('audit_sections')
              .select('title, status, json_parsed, raw_text').eq('run_id', runId)
            for (const rs of rawSecs ?? []) {
              console.log(`      ${rs.title.slice(0, 30)} → ${rs.status}, parsed=${rs.json_parsed}`)
              console.log(`      it said: ${JSON.stringify(String(rs.raw_text ?? '').slice(0, 220))}`)
            }
            console.log(`      ${findings.length} finding(s) in total; sections: `
              + (secs.map((x) => `${x.title.slice(0, 24)}=${x.status}`
                  + `${x.json_parsed === false ? ' (unparseable)' : ''}`
                  + `${x.could_not_complete_reason ? ` — ${x.could_not_complete_reason}` : ''}`).join(' · ')
                 || '(none)'))
            failures++
          }
          const answered = withLine.filter((f) => f.word).length
          // Not a failure: a word the model wrote outside the four is rejected on purpose and the
          // report says so. Printed so a drop is visible rather than silent.
          console.log(`  · template words       ${answered} of ${withLine.length} line(s) carry one of the four words`)

          /**
           * *** THE CHECKLIST READING IS INSIDE WHAT THE AUDIT COST — Audits Run 6a, item 3. ***
           *
           * `costOfSections` summed between each SECTION's own timestamps, and a template audit's
           * first call reads the checklist BEFORE any section exists, so the figure was short by
           * that call on every template audit: $0.5405 reported against $0.5634 spent, on the rev 1
           * baseline. `createRun` now inserts the run before it spends anything and records the
           * extraction's ledger id on the summary.
           *
           * The assertion is an equality between two numbers computed differently: what
           * `costOfSections` reports, against a plain window query over `ai_calls` for this company
           * from the run opening to its last section finishing. If the extraction were missed again
           * the first would be the smaller, and this line would say by how much.
           */
          const { data: runRow } = await admin.from('audit_runs')
            .select('started_at, finished_at, summary').eq('id', runId).maybeSingle()
          const { data: secRows } = await admin.from('audit_sections')
            .select('started_at, finished_at').eq('run_id', runId).order('ordinal')
          const extractionCallId = (runRow?.summary ?? {}).extraction_ai_call_id ?? null
          const reported = await costOfSections(admin, companyId,
            (secRows ?? []).map((x) => ({ started_at: x.started_at, finished_at: x.finished_at })),
            { started_at: runRow?.started_at ?? null, extractionCallId })

          const windowTo = (secRows ?? []).map((x) => x.finished_at).filter(Boolean).sort().slice(-1)[0]
            ?? runRow?.finished_at ?? null
          let ledger = 0, ledgerCalls = 0
          if (runRow?.started_at && windowTo) {
            const { data: calls } = await admin.from('ai_calls')
              .select('cost_usd').eq('company_id', companyId).eq('task', 'audit')
              .gte('created_at', runRow.started_at).lte('created_at', windowTo)
            for (const c of calls ?? []) { ledger += Number(c.cost_usd ?? 0); ledgerCalls++ }
          }
          // *** PROVE IT CAN SEE A PRESENCE (§9a). *** Two zeros agree perfectly and measure
          // nothing, so an empty window is a failure here and not a pass.
          if (!ledgerCalls) {
            console.log(`  ✗ template cost        the run's window holds NO ai_calls rows — `
              + `the cost is not $0, it is unread (run ${runRow?.started_at} → ${windowTo})`)
            failures++
          } else if (Math.abs(reported - ledger) < 0.000001) {
            console.log(`  ✓ template cost        $${reported.toFixed(4)} reported = $${ledger.toFixed(4)} `
              + `in the ledger over ${ledgerCalls} call(s)`
              + `${extractionCallId ? ', extraction included by id' : ', extraction inside the run window'}`)
          } else {
            console.log(`  ✗ template cost        $${reported.toFixed(4)} reported against `
              + `$${ledger.toFixed(4)} in the ledger over ${ledgerCalls} call(s) — short by `
              + `$${(ledger - reported).toFixed(4)}`)
            failures++
          }
        }
      }
    }
  } catch (e) {
    console.log(`  ✗ template flow        threw: ${e instanceof Error ? e.message : String(e)}`)
    failures++
  } finally {
    if (runId) await admin.from('audit_runs').delete().eq('id', runId)
    if (docId) await admin.from('documents').delete().eq('id', docId)
    if (evidenceId) await admin.from('documents').delete().eq('id', evidenceId)
    if (storagePath) await admin.storage.from('company-documents').remove([storagePath])
    await admin.from('company_labels').delete().eq('company_id', companyId).eq('label', PROBE_AGENCY)
  }
}

console.log()
if (failures > 0) {
  console.error(`  check:live FAILED — ${failures} problem(s). These are invisible to npm run check.\n`)
  process.exit(1)
}
// Not "each writable": three of them are deliberately read-only to a signed-in caller (058), and a
// summary line that said otherwise would be the check describing a test it did not run.
const writable = CASES.filter((c) => !c.reads_only).length
const readable = CASES.length - writable
console.log(`  check:live: ok — ${CASES.length} tenant table(s): ${writable} writable by a signed-in `
  + `user, ${readable} read-only to them by design, all ${CASES.length} refused to anon.\n`)

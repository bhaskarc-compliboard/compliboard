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
import { createClient } from '@supabase/supabase-js'

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
]

for (const c of CASES) {
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

console.log()
if (failures > 0) {
  console.error(`  check:live FAILED — ${failures} problem(s). These are invisible to npm run check.\n`)
  process.exit(1)
}
console.log(`  check:live: ok — ${CASES.length} tenant table(s), each writable by a signed-in user and refused to anon.\n`)

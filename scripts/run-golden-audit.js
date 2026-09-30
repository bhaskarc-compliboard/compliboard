#!/usr/bin/env node
// THE AGENCY AUDIT, ON THE GOLDEN COMPANIES — Audits Run 1.
//
//   npm run golden:audit                          both cases, both modes, 3 runs each
//   npm run golden:audit -- cascade-deq           one case
//   npm run golden:audit -- --mode whole          one mode
//   npm run golden:audit -- --times 1             fewer runs
//
// *** IT WRITES NOTHING TO THE DATABASE. *** It READS the readings — `document_index_v` and the four
// tables hanging off a scan — and calls the model. No table is created, no row is written, no company
// column is touched. The audit has no contract yet on purpose: `HANDOFF-AUDITS.md` §12 puts the
// script before the schema, so the contract is read off what a good answer actually contains rather
// than guessed in advance.
//
// STAGING ONLY, by construction: it reads `NEXT_PUBLIC_SUPABASE_URL`, which on a developer machine is
// staging, and refuses if that URL is production's ref. There is no flag that points it elsewhere.
//
// TWO MODES, AND THE COMPARISON IS THE POINT OF RUN 1:
//   whole     — one open call for the whole report.
//   sections  — four calls in order, each shown the earlier sections' JSON.
// The prompt rules are identical; only the part asked for changes. If the two modes differed in
// anything else the comparison would measure the difference rather than the split.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { askAIWithCitations, extractJsonText, modelForTask } from '../lib/ai.ts'
import { buildAuditInput, auditAgenciesFor } from '../lib/audit.ts'
import { createRun, runSection, finishRunIfDone, summariseRun, shapeFindings } from '../lib/auditRun.ts'
import { auditAgencyPrompt, auditSectionPrompt, AUDIT_SECTIONS } from '../prompts/audit-agency.ts'

const PROD_REF = 'dsfwmafnphdlfogetsus'
const CASES = 'tests/golden/audits/cases'
const KEYS = 'tests/golden/audits'
const RUNS = 'tests/golden/audits/runs'

const args = process.argv.slice(2)
const flag = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const times = Number(flag('--times', '3'))
const modeArg = flag('--mode', null)
const jsonPath = args.includes('--json-path')
const previousRun = flag('--previous', null)
const VALUE_FLAGS = ['--times', '--mode', '--previous']
const only = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]))
const die = (m) => { console.error(`\n  ${m}\n`); process.exit(1) }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) die('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (staging).')
if (url.includes(PROD_REF)) die('That URL is PRODUCTION. This script is staging-only and there is no flag to change that.')
if (!process.env.ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY is not set.')
if (!Number.isInteger(times) || times < 1) die('--times must be a positive integer.')
if (modeArg && !['whole', 'sections'].includes(modeArg)) die('--mode takes whole or sections.')

const db = createClient(url, key, { auth: { persistSession: false } })
const TODAY = new Date().toISOString().slice(0, 10)
// *** THE MODEL TIER AND THE LEDGER TASK ARE DIFFERENT UNIONS, AND THIS IS THE POINT OF THAT. ***
// `audit` is a `LedgerTask` — it is in `LEDGER_TASKS` and in migration 038's CHECK, so a cost row can
// say `audit`. It is NOT an `AITask`: `lib/ai.ts`'s `TASK_MODELS` has no audit tier, and asking for
// one throws "TASK_MODELS[task] is not a function". Found by running this script, because a `.js` file
// in `scripts/` is outside `tsconfig.json`'s `include` and `npm run check` cannot see it
// (`HANDOFF-CODE.md` §5's blind spot, and this is an instance of it).
//
// So the model comes from the JUDGEMENT tier — an audit decides things, and `.env.local` points that
// at Haiku, which is what this run is meant to be on — and the ledger still says `audit`. Adding an
// `audit` tier to `lib/ai.ts` is a routing change (§3.1) and not this run's to make.
const MODEL = modelForTask('audit')   // its own tier since Run 2a, item 4
const MODES = modeArg ? [modeArg] : ['whole', 'sections']

const caseFiles = readdirSync(CASES).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`${CASES}/${f}`, 'utf8')))
  .filter((c) => !only || c.id.startsWith(only))
  .sort((a, b) => a.id.localeCompare(b.id))
if (!caseFiles.length) die(`No case matching "${only ?? ''}" in ${CASES}/`)

// ---------------------------------------------------------------------------
// THE JUDGE — the documents runner's vocabulary, over the audit's shape.
//
// It is a copy of a STYLE, not of a file: `scripts/run-golden-docs.js` judges a scan and its
// `collections()` knows gaps and deadlines. The check kinds here are the same idea — keyword matching
// with a minimum, an absence check whose subject must be the thing said to be absent, a count — so a
// person who can read one key can read the other.
// ---------------------------------------------------------------------------
const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const squash = (s) => norm(s).replace(/[^a-z0-9]/g, '')

function collections(a) {
  return {
    findings: a?.findings ?? [],
    dates: a?.dates ?? [],
    expected_not_seen: a?.expected_not_seen ?? [],
    contradictions: a?.contradictions ?? [],
    // *** ONE CHANNEL — Audits Run 1c, ruling (b). *** A question no document can settle is a
    // finding with word `not_a_document_question`; the separate top-level list is gone from the
    // prompt. This collection is kept as a NAME so the case files' `not-a-document-question` check
    // did not have to change, but it is now a VIEW over findings rather than a second field. Run
    // 1b's census is why: 11 findings carried the word while the list carried 39 strings, so the
    // same question was being written twice and counted twice.
    not_document_questions: (a?.findings ?? [])
      .filter((f) => norm(f?.word) === 'not a document question')
      .map((f) => ({ title: f.title })),
  }
}
const ITEM_TEXT = (i) => Object.values(i ?? {}).filter((v) => typeof v === 'string').join(' / ')
const hasDate = (text, want) => squash(text).includes(squash(want))

function matchItem(check, cols) {
  const kws = (check.keywords ?? []).map(norm)
  const min = check.min_keywords ?? 2
  for (const name of check.collections ?? []) {
    for (const item of cols[name] ?? []) {
      const text = norm(ITEM_TEXT(item))
      if (check.word && norm(item.word) !== norm(check.word)) continue
      if (check.date_or_text && !check.date_or_text.some((v) => hasDate(text, v))) continue
      const hit = kws.filter((k) => text.includes(k))
      if (hit.length >= min) return { ok: true, where: name, item, hit }
    }
  }
  return { ok: false }
}

/** Every string anywhere in the answer, for the two whole-answer checks. */
function allStrings(o, out = []) {
  if (typeof o === 'string') out.push(o)
  else if (Array.isArray(o)) for (const v of o) allStrings(v, out)
  else if (o && typeof o === 'object') for (const v of Object.values(o)) allStrings(v, out)
  return out
}

function evaluate(check, answer, ctx) {
  const cols = collections(answer)
  switch (check.type) {
    case 'item': {
      const m = matchItem(check, cols)
      return m.ok
        ? { verdict: 'PASS', detail: `${m.where}: "${String(m.item.title ?? '').slice(0, 68)}"${m.item.word ? ` [${m.item.word}]` : ''}` }
        : { verdict: 'FAIL', detail: `no item matched${check.word ? ` with word=${check.word}` : ''}. held: `
            + (check.collections.flatMap((n) => (cols[n] ?? []).map((i) => String(i.title ?? '').slice(0, 34))).join(' | ') || '(nothing)') }
    }
    case 'count_at_least': {
      const n = (cols[check.collection] ?? []).length
      return n >= check.n ? { verdict: 'PASS', detail: `${check.collection} has ${n}` }
                          : { verdict: 'FAIL', detail: `${check.collection} has ${n}, needs ${check.n}` }
    }
    case 'count_matching': {
      // How many of the named keyword pairs are matched by ANY item. Used for "at least three of the
      // plan's four gaps": which three does not matter, the number does.
      const items = (cols[check.collection] ?? []).map((i) => norm(ITEM_TEXT(i)))
      const hit = check.any_of.filter((pair) => items.some((t) => pair.every((k) => t.includes(norm(k)))))
      return hit.length >= check.n
        ? { verdict: 'PASS', detail: `${hit.length} of ${check.any_of.length} carried` }
        : { verdict: 'FAIL', detail: `${hit.length} of ${check.any_of.length} carried, needs ${check.n}` }
    }
    case 'absent_item': {
      // THE SUBJECT MUST BE THE THING SAID TO BE ABSENT. The documents runner's own comment explains
      // why a loose version is worse than none: "alarm" somewhere plus "missing" somewhere also fires
      // on a finding about verification. Here the subject and the absence word must BOTH be in the
      // item, and with no absence words the subject alone is the offence.
      const bad = []
      for (const name of check.collections) for (const item of cols[name] ?? []) {
        const text = norm(ITEM_TEXT(item))
        if (!check.subject.some((s) => text.includes(norm(s)))) continue
        if (check.absence.length && !check.absence.some((a) => text.includes(norm(a)))) continue
        bad.push(`${name}: "${String(item.title ?? '').slice(0, 54)}"`)
      }
      return bad.length ? { verdict: 'FAIL', detail: bad.join(' · ') }
                        : { verdict: 'PASS', detail: 'nothing matched' }
    }
    case 'forbidden_words': {
      // *** IT FORBIDS A CLAIM, NOT A TOKEN — ruled 29 September after Run 1. ***
      //
      // Run 1 tested for the word and failed three answers that were all correct:
      //   · "alarm system signals not documented as ANSI S3.41-1974 compliant"  — a standard's name
      //   · "confirm the signals are ANSI S3.41-1974 compliant"                 — the same
      //   · "Operate sources in compliance with permit conditions and DEQ rules" — condition 1.1's
      //     title, copied verbatim out of the input block
      //
      // None of those tells a reader the company is in a good state, which is the only thing this
      // must-not exists to stop. The first version was also a substring match, so "ai" hit
      // MAINTENANCE and "met" hit METAL. Both were the matcher, not the answer — the failure
      // `scripts/run-golden-docs.js` warns about at length.
      //
      // So: a forbidden claim is a copula about the company followed by a reassuring word. The
      // `words` list carries the reassuring words; `claim_verbs` carries the copulas. A bare token
      // check survives only for `literal: true` checks, which is how the "AI" sweep still works —
      // that word is forbidden outright, in any construction.
      const hits = []
      const verbs = check.claim_verbs ?? ['is', 'are', 'was', 'were', 'has been', 'have been', 'remains']
      for (const raw of allStrings(answer)) {
        for (const w of check.words) {
          const token = norm(w)
          if (!token) continue
          const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const re = check.literal
            ? new RegExp(`\\b${esc(token)}\\b`, 'i')
            // "is compliant", "are in compliance", "has been met" — and NOT "not compliant",
            // because a negated claim is a finding rather than a reassurance.
            : new RegExp(`\\b(?:${verbs.map(esc).join('|')})\\s+(?!not\\b)(?:\\w+\\s+){0,2}${esc(token)}\\b`, 'i')
          if (re.test(raw)) hits.push(`"${token}" claimed in "${raw.slice(0, 56)}"`)
        }
      }
      return hits.length ? { verdict: 'FAIL', detail: hits.slice(0, 3).join(' · ') }
                         : { verdict: 'PASS', detail: check.literal
                             ? 'the word appears nowhere' : 'no positive claim about the company' }
    }
    case 'known_documents_only': {
      // *** TWO WAYS TO NAME A DOCUMENT THAT DOES NOT EXIST — Audits Run 1c. ***
      // A handle the block never carried is recorded as `handle_error` by `resolveHandles`, and it
      // counts here: it is the same offence as an unknown id, caught earlier. An id that resolved
      // but is not in the block is still checked, because `handles` and the block are built from
      // the same query and a mismatch between them would be a bug in this script.
      const known = new Set(ctx.documentIds)
      const items = [...cols.findings, ...cols.dates, ...cols.contradictions]
      const badHandles = items.map((i) => i.handle_error).filter(Boolean)
      const badIds = items.flatMap((i) => [i.document_id, i.document_a_id, i.document_b_id])
        .filter((id) => id && !known.has(id))
      if (badHandles.length || badIds.length) {
        return { verdict: 'FAIL', detail: [
          badHandles.length ? `${badHandles.length} bad handle(s): ${[...new Set(badHandles)].slice(0, 3).join(' · ')}` : null,
          badIds.length ? `unknown ids: ${[...new Set(badIds)].slice(0, 3).join(', ')}` : null,
        ].filter(Boolean).join('  ||  ') }
      }
      return { verdict: 'PASS', detail: `every document named was one of the ${known.size} handles given` }
    }
    case 'expected_not_duplicated': {
      const exp = cols.expected_not_seen.map((e) => squash(e.title))
      const bad = cols.findings.filter((f) => exp.includes(squash(f.title)))
      return bad.length
        ? { verdict: 'FAIL', detail: bad.map((f) => `"${String(f.title).slice(0, 44)}"`).join(' · ') }
        : { verdict: 'PASS', detail: 'no expected item appears as a finding' }
    }
    case 'carries_own_gaps': {
      // How many of the document's OWN open gaps the audit carried. A gap counts as carried when a
      // finding repeats at least half of the significant words in that gap's title (minimum two),
      // which is what "in the reading's own terms" means without naming the terms.
      const live = ctx.own?.[check.file]
      if (!live) return { verdict: 'FAIL', detail: `no live reading was loaded for ${check.file}` }
      if (!live.documentId) return { verdict: 'FAIL', detail: `${check.file} is not on file for this company` }
      if (!live.gaps.length) {
        return { verdict: 'N/A', detail: `the current scan of ${check.file} has 0 open gaps, `
          + `so there is nothing to carry (scan ${String(live.scanId).slice(0, 8)})`, notTestable: true }
      }
      const texts = (cols[check.collection ?? 'findings'] ?? []).map((f) => norm(ITEM_TEXT(f)))
      const carried = live.gaps.filter((gap) => {
        const need = Math.max(2, Math.ceil(gap.words.length / 2))
        return texts.some((t) => gap.words.filter((w) => t.includes(w)).length >= need)
      })
      const n = check.n ?? live.gaps.length
      return carried.length >= n
        ? { verdict: 'PASS', detail: `${carried.length} of ${live.gaps.length} own gap(s) carried, needs ${n}`
            + `  [${carried.map((g) => g.title.slice(0, 30)).join(' | ')}]` }
        : { verdict: 'FAIL', detail: `${carried.length} of ${live.gaps.length} own gap(s) carried, needs ${n}. `
            + `the reading's gaps are: ${live.gaps.map((g) => `"${g.title.slice(0, 40)}"`).join(' · ')}` }
    }
    case 'eap_gap_whitelist': {
      // A finding about the Emergency Action Plan whose words match none of the reading's four gaps
      // is a fifth gap nobody found. Printed as a candidate rather than failed outright when it does
      // not claim a fault — a stale note or a carried date is not an invented gap.
      // *** THE PLAN'S OWN CONDITIONS COUNT AS ALLOWED, NOT ONLY ITS GAPS — ruled 29 September. ***
      // Run 1 failed this on findings titled "Section 4 — Conduct evacuation drills" and "Section 6 —
      // Train new employees". Those are `document_conditions` rows, read out of the plan itself, and a
      // `nothing_on_file` finding against a condition is exactly what the DEQ case's nine musts
      // require. The whitelist allowed only the four GAP words, so it flagged the designed behaviour
      // as an invented fault. The conditions come from the input block, so this cannot drift from what
      // the model was actually shown.
      // *** THE WHITELIST IS READ, NOT TYPED — Audits Run 2a, item 2. *** It was nine words copied
      // from Haiku's four gaps; the real model's seven gaps use different words, so every one of
      // them looked invented. Now: the words of the plan's OWN open gaps and its OWN conditions,
      // both from the tables for the current scan, plus `check.allowed` for the few state words
      // ("stale") that are not faults and belong to no row.
      const file = check.file ?? '01-eap-chemical.pdf'
      const live = ctx.own?.[file]
      if (!live) return { verdict: 'FAIL', detail: `no live reading was loaded for ${file}` }
      const doc = live.documentId
      const allowed = [...(check.allowed ?? []),
                       ...live.gaps.flatMap((g) => g.words), ...live.conditions]
      const bad = cols.findings.filter((f) => f.document_id === doc
        && ['nothing_on_file'].includes(norm(f.word))
        && !allowed.some((a) => norm(ITEM_TEXT(f)).includes(norm(a))))
      return bad.length
        ? { verdict: 'FAIL', detail: bad.map((f) => `"${String(f.title).slice(0, 48)}"`).join(' · ') }
        : { verdict: 'PASS', detail: `no fault on ${file} beyond the `
            + `${live.gaps.length} the reading found and its ${live.conditions.length} condition word(s)` }
    }
    default: return { verdict: 'FAIL', detail: `unknown check type ${check.type}` }
  }
}

/**
 * A DOCUMENT'S OWN FINDINGS, READ FROM THE TABLES AT CHECK TIME — Audits Run 2a, item 2.
 *
 * *** A KEY THAT NAMES ONE MODEL'S READING MEASURES THAT MODEL, NOT THE AUDIT. ***
 * `carry-eap-gaps` used to carry four typed keyword pairs — ["contact","name"], ["alarm","ansi"] —
 * copied out of Haiku's reading of the plan. The real model reads the same plan and finds SEVEN
 * gaps in its own words, so the check scored 1 of 4 and `no-new-eap-gap` failed 0/3 while the audit
 * was doing exactly what it should: carrying the findings it was shown. The failure was the key's.
 *
 * So the expectation is now READ, never typed: the plan's open gaps and its conditions come from
 * `document_gaps` and `document_conditions` for the CURRENT scan, so whatever the reading found is
 * what the audit is asked to carry. The significant words come from the row's own title.
 */
const SIGNIFICANT = (text) => [...new Set(norm(text).split(/[^a-z0-9]+/).filter((w) => w.length > 4))]

async function readOwnFindings(companyId, fileNames) {
  const out = {}
  for (const file of fileNames) {
    const { data: doc, error: dErr } = await db.from('documents')
      .select('id').eq('company_id', companyId).eq('name', file)
      .order('uploaded_at', { ascending: false }).limit(1).maybeSingle()
    if (dErr) die(`reading the document row for ${file}: ${dErr.message}`)
    if (!doc) { out[file] = { documentId: null, gaps: [], conditions: [] }; continue }

    // *** `is_current`, NOT "the newest by date". *** The first version of this ordered by
    // `document_scans.created_at`, which does not exist — the column is `scanned_at` — and the
    // error came back as null data, so the very next line threw on `scan.id`. That throw is the
    // only reason it was caught in ten seconds instead of becoming a silent "0 open gaps". The
    // column the app itself uses to mean "the reading that counts" is `is_current`
    // (`lib/attachedDocument.ts:148`), so this uses that, with `scanned_at` as the tie-break.
    const { data: scan, error: sErr } = await db.from('document_scans')
      .select('id, scanned_at').eq('document_id', doc.id).eq('is_current', true)
      .order('scanned_at', { ascending: false }).limit(1).maybeSingle()
    if (sErr) die(`reading the scan for ${file}: ${sErr.message}`)
    if (!scan) { out[file] = { documentId: doc.id, scanId: null, gaps: [], conditions: [] }; continue }

    const [g, c] = await Promise.all([
      db.from('document_gaps').select('title, description, citation, ordinal')
        .eq('scan_id', scan.id).eq('status', 'open').order('ordinal'),
      db.from('document_conditions').select('condition_ref, title, evidence_expected, ordinal')
        .eq('scan_id', scan.id).order('ordinal'),
    ])
    if (g.error) die(`reading document_gaps for ${file}: ${g.error.message}`)
    if (c.error) die(`reading document_conditions for ${file}: ${c.error.message}`)
    // *** PROVE IT CAN SEE A PRESENCE. *** A scan with zero open gaps is a real state (case 02 has
    // none), so an empty list is not an error — but a check that ASKS for n gaps and is handed zero
    // would pass vacuously or fail mysteriously. `carries_own_gaps` reports the count it read, so
    // the report shows the input rather than the conclusion.
    out[file] = {
      documentId: doc.id, scanId: scan.id,
      gaps: (g.data ?? []).map((r) => ({ title: r.title, words: SIGNIFICANT(r.title) })),
      conditions: (c.data ?? []).flatMap((r) => SIGNIFICANT(`${r.condition_ref ?? ''} ${r.title}`)),
    }
  }
  return out
}

function judge(c, answer, ctx) {
  const v = {}
  for (const check of [...c.must, ...c.must_not, ...(c.acceptable ?? [])]) {
    v[check.id] = answer ? evaluate(check, answer, ctx) : { verdict: 'FAIL', detail: 'no JSON parsed' }
  }
  return v
}

// ---------------------------------------------------------------------------
// THE CALLS
// ---------------------------------------------------------------------------
const CALL = { maxTokens: 8000, enableWebSearch: true }

async function oneCall(system, content, companyId) {
  const t0 = Date.now()
  const started = new Date().toISOString()
  const answer = await askAIWithCitations(system, content, {
    ...CALL, task: 'judgement',
    // EVERY CALL WRITES A COST ROW. `HANDOFF-AUDITS.md` §3, and `audit` is already in LEDGER_TASKS
    // and in migration 038's CHECK — it has simply never been written until now.
    ledger: { companyId, task: 'audit' },
  })
  const raw = answer.text ?? ''
  let obj = null
  try { obj = JSON.parse(extractJsonText(raw)) } catch { obj = null }
  // The ledger row this call wrote, found by time the way `saveScan` does it: `recordAICall` is
  // deliberately not awaited, so it is polled briefly rather than assumed present.
  let cost = null, tokens = null
  for (let i = 0; i < 6 && cost === null; i++) {
    if (i) await new Promise((r) => setTimeout(r, 300))
    const { data } = await db.from('ai_calls').select('cost_usd, input_tokens, output_tokens, searches')
      .eq('company_id', companyId).eq('task', 'audit').gte('created_at', started)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (data) { cost = data.cost_usd; tokens = data }
  }
  return { raw, obj, wall_ms: Date.now() - t0, cost, tokens, sources: answer.sources.length }
}

/**
 * HANDLES BACK TO IDS — Audits Run 1c, ruling (a).
 *
 * The model is shown D1, D2, D3 and never a UUID (`lib/audit.ts`). This turns them back into ids
 * after parsing, in place, so every check downstream still reads `document_id` and nothing else had
 * to change. A handle that is not in the map is NOT quietly dropped: the id becomes null and the
 * finding carries `handle_error`, which `known_documents_only` counts — the same failure a wrong
 * UUID used to be, but now catchable, because "D14" can be checked against a list of twelve where
 * one wrong character in a UUID could not.
 */
function resolveHandles(answer, handles) {
  if (!answer || typeof answer !== 'object') return { errors: [] }
  const errors = []
  const one = (item, field, into) => {
    const h = item[field]
    if (h == null || h === '') { item[into] = null; return }
    const id = handles[String(h).trim().toUpperCase()]
    if (id) { item[into] = id; return }
    item[into] = null
    item.handle_error = `"${String(h).slice(0, 40)}" is not a handle in this block`
    errors.push(String(h).slice(0, 40))
  }
  for (const f of answer.findings ?? []) if (typeof f === 'object' && f) one(f, 'document', 'document_id')
  for (const d of answer.dates ?? []) if (typeof d === 'object' && d) one(d, 'document', 'document_id')
  for (const c of answer.contradictions ?? []) {
    if (typeof c !== 'object' || !c) continue
    one(c, 'document_a', 'document_a_id'); one(c, 'document_b', 'document_b_id')
  }
  const cov = answer.covers
  if (cov && Array.isArray(cov.documents_read)) {
    cov.documents_read_ids = cov.documents_read.map((h) => {
      const id = handles[String(h).trim().toUpperCase()]
      if (!id) errors.push(String(h).slice(0, 40))
      return id ?? null
    })
  }
  return { errors }
}

/**
 * THE ROWS PATH — Audits Run 2a, item 5.
 *
 * *** THE JUDGE NOW READS THE ROWS, NOT THE MODEL'S JSON. *** That is the point of the change, and
 * it is a stronger test than what it replaces: everything between the answer and the database —
 * handle resolution, the per-kind CHECKs, the demotion of a half-built date to a plain finding — is
 * now inside what the key measures. A run that scores 12/14 scored it on what a customer would see.
 *
 * The JSON run files are still written, because the input block, its sha and the raw text are the
 * only way to attribute a result six weeks later.
 */
async function runAsRows(built, co, c, previousRunId) {
  const t0 = Date.now()
  const { runId, sectionIds, agencies } = await createRun(db, {
    companyId: co.id, kind: 'agency', agency: c.agency,
    scope: `golden: ${c.id}`, previousRunId: previousRunId ?? null,
  })
  if (sectionIds.length !== 1) {
    die(`${c.id}: expected one section for "${c.agency}", got ${sectionIds.length} (${agencies.join(' · ')})`)
  }
  const r = await runSection(db, sectionIds[0], { today: TODAY })
  const fin = await finishRunIfDone(db, runId)

  // The section's own receipt, read back off the row rather than kept in memory: if a column did
  // not take a value, the report must show the column and not the variable.
  const { data: sec } = await db.from('audit_sections')
    .select('model, prompt_sha256, input_sha256, ai_call_id, json_parsed, status, '
          + 'could_not_complete_reason, documents_read, documents_held_unread, raw_text')
    .eq('id', sectionIds[0]).maybeSingle()

  const { data: call } = sec?.ai_call_id
    ? await db.from('ai_calls').select('cost_usd, input_tokens, output_tokens, searches')
        .eq('id', sec.ai_call_id).maybeSingle()
    : { data: null }

  const answer = await answerFromRows(db, runId)
  const { data: heRows } = await db.from('audit_findings')
    .select('title').eq('run_id', runId).eq('handle_error', true)

  return {
    answer,
    runId,
    sectionId: sectionIds[0],
    summary: fin.summary ?? await summariseRun(db, runId),
    handleErrors: (heRows ?? []).map((x) => x.title.slice(0, 40)),
    calls: [{
      wall_ms: Date.now() - t0, cost: call?.cost_usd ?? null, tokens: call ?? null,
      sources: 0, obj: sec?.json_parsed ?? false, raw: sec?.raw_text ?? '',
    }],
    section: sec ?? null,
    rowsWritten: r.findings,
    sectionStatus: r.status,
  }
}

/**
 * THE ROWS, BACK IN THE SHAPE THE KEY ALREADY SPEAKS. The checks were written against the model's
 * four collections; the table holds one `kind` column. Rebuilding the four from the rows means the
 * fifteen checks in each case file did not have to be rewritten to measure the new path — and where
 * a row lost something on the way in, the key now fails, which is the behaviour that was wanted.
 */
async function answerFromRows(db, runId) {
  const { data, error } = await db.from('audit_findings')
    .select('kind, title, word, basis, document_id, document_b_id, locator, quote, what_to_do, '
          + 'due_on, recurs, passed, value_a, value_b, same_as, handle_error, ordinal')
    .eq('run_id', runId).order('ordinal')
  if (error) die(`reading the findings back for run ${runId}: ${error.message}`)
  const rows = data ?? []
  return {
    covers: { documents_read: [], documents_held_but_not_read: [], readings_as_of: null },
    findings: rows.filter((r) => r.kind === 'finding').map((r) => ({
      title: r.title, word: r.word, document_id: r.document_id, locator: r.locator,
      quote: r.quote, what_to_do: r.what_to_do, basis: r.basis,
      ...(r.handle_error ? { handle_error: 'the block did not carry that handle' } : {}),
    })),
    dates: rows.filter((r) => r.kind === 'date').map((r) => ({
      title: r.title, due_on: r.due_on, recurs: r.recurs, document_id: r.document_id, passed: r.passed,
    })),
    contradictions: rows.filter((r) => r.kind === 'contradiction').map((r) => ({
      what: r.title, document_a_id: r.document_id, value_a: r.value_a,
      document_b_id: r.document_b_id, value_b: r.value_b,
    })),
    expected_not_seen: rows.filter((r) => r.kind === 'expected').map((r) => ({
      title: r.title, why: r.what_to_do,
    })),
  }
}

/**
 * SECTIONS MODE, ALSO AS ROWS — Run 3 item 1.
 *
 * Whole mode goes through `runSection`, which owns the call and the writes together. Sections mode
 * is four calls in this script, so the answer arrives here rather than in the library — and it still
 * has to land in the same three tables, or a sections run could not be compared with a whole one at
 * all. So the run and its one section are created the same way, the answer goes through the SAME
 * `shapeFindings` (handles, the per-kind demotions, the CHECKs), and the section is closed by hand.
 * Nothing about the shaping is duplicated; only the call loop differs, which is what the two modes
 * are.
 */
async function storeSectionsAnswer(built, co, c, answer, calls) {
  const { runId, sectionIds } = await createRun(db, {
    companyId: co.id, kind: 'agency', agency: c.agency, scope: `golden: ${c.id} (sections)`,
  })
  const sectionId = sectionIds[0]
  const startedAt = new Date().toISOString()

  const { rows, handleErrors, readIds, unreadIds } =
    shapeFindings(answer ?? {}, built.input, { runId, sectionId, companyId: co.id })
  if (rows.length) {
    const { error } = await db.from('audit_findings').insert(rows)
    if (error) die(`writing the sections-mode findings: ${error.message}`)
  }

  const lastCall = calls[calls.length - 1] ?? {}
  await db.from('audit_sections').update({
    status: answer ? 'done' : 'could_not_complete',
    could_not_complete_reason: answer ? null : 'no section of the four returned readable JSON',
    started_at: startedAt, finished_at: new Date().toISOString(),
    model: MODEL, input_sha256: built.sha256, json_parsed: !!answer,
    raw_text: String(lastCall.raw ?? '').slice(0, 20000),
    handles: built.input.handles,
    documents_read: readIds, documents_held_unread: unreadIds,
  }).eq('id', sectionId)

  const fin = await finishRunIfDone(db, runId)
  return { runId, sectionId, rowsWritten: rows.length, handleErrors,
           summary: fin.summary ?? await summariseRun(db, runId) }
}

async function runWhole(built, companyId) {
  const r = await oneCall(auditAgencyPrompt(), built.block, companyId)
  const { errors } = resolveHandles(r.obj, built.input.handles)
  return { answer: r.obj, calls: [r], handleErrors: errors }
}

async function runSections(built, companyId) {
  const calls = []
  let carried = null
  for (let i = 0; i < AUDIT_SECTIONS.length; i++) {
    const content = i === 0 ? built.block
      : `${built.block}\n\n--- WHAT THE EARLIER CALL${i > 1 ? 'S' : ''} PRODUCED ---\n${JSON.stringify(carried, null, 2)}`
    const r = await oneCall(auditSectionPrompt(i), content, companyId)
    calls.push(r)
    // A section that came back unparseable does not discard what the earlier ones built: the money is
    // spent and the answer so far is still the answer. The run records which call failed.
    if (r.obj) carried = r.obj
  }
  // Resolved once, at the end: each section is shown the earlier sections' JSON, and rewriting
  // handles into ids mid-way would feed the model UUIDs it was told never to use.
  const { errors } = resolveHandles(carried, built.input.handles)
  return { answer: carried, calls, handleErrors: errors }
}

// ---------------------------------------------------------------------------
console.log(`\n  Target   : ${url.replace(/https:\/\/([^.]+).*/, '$1')} (staging — there is no production target)`)
console.log(`  Model    : ${MODEL}   (the audit tier: AI_MODEL_AUDIT, else the judgement tier)`)
console.log(`  Path     : ${jsonPath ? "the model's JSON, judged directly (--json-path)"
  : 'audit_runs / audit_sections / audit_findings — the judge reads the rows'}`)
console.log(`  Searches : ${process.env.DEV_MAX_SEARCHES ? `CAPPED AT ${process.env.DEV_MAX_SEARCHES}` : 'UNCAPPED'}`)
console.log(`  Run date : ${TODAY}`)
console.log(`  Cases    : ${caseFiles.length} x ${MODES.length} mode(s) x ${times} run(s)`)
console.log('')

/**
 * ONE CONFIRMED FACT, SO THE AUDIT HAS A CONTRADICTION TO FIND — Audits Run 1b.
 *
 * `cascade-osha`'s key asks the audit to show "42 as of February 2021 against 65 for 2025, naming
 * both documents". That line was unreachable in Run 1: `employee_count = 42` is a PROPOSAL and
 * `company_facts` for Cascade held 0 rows, so nothing in the audit input said 42 at all.
 *
 * So the fixture confirms exactly one fact, the way a person would — the same columns
 * `app/api/to-confirm/route.ts` writes at its `company_facts` upsert, including the `onConflict`
 * target that migration 055's index requires. Deliberately NOT a copy of the route's logic: only
 * the write, on a named proposal, so what the audit is shown is "one fact confirmed, the rest still
 * proposed" and the 300A's 65 stays a proposal it must not state as true.
 *
 * Idempotent: the upsert replaces the same row and the proposal is already `accepted` on a rerun.
 */
async function confirmFixtureFact(co) {
  // *** THE FACT IS WRITTEN DIRECTLY, NOT FISHED OUT OF A PROPOSAL — Audits Run 2a, item 1. ***
  //
  // It used to look for a `fact_proposals` row with `switch_key = 'employee_count'` from the plan
  // and confirm that. That worked on Haiku's readings and became a silent no-op on the real model's:
  // `claude-opus-5-5` reads the same sentence and proposes `employs_drivers`, `onsite_laboratory`,
  // `employees_evacuate_during_fire` — never a headcount. So the fixture depended on one model's
  // choice of key, and the contradiction the OSHA key is about became unreachable again.
  //
  // A fixture must not depend on that. The plan SAYS 42 — "It applies to all 42 employees at the
  // Portland facility" — so the fixture asserts it, and writes an `accepted` proposal beside it for
  // history, the way a person confirming one would leave. Idempotent, and it relinks
  // `source_document_id` after a reset has nulled it.
  //
  // *** AN ERROR IS NOT AN ABSENCE. *** Every read below checks `error` and dies on it. The first
  // version of this function ordered by `documents.created_at`, a column that does not exist; the
  // error came back as null data and it reported a document that was on file as missing, and six
  // audit runs were bought before anyone looked (CLAUDE.md §9a).
  const KEY = 'employee_count'
  const VALUE = '42 employees at the Portland facility'
  const QUOTE = 'It applies to all 42 employees at the Portland facility, including warehouse, '
    + 'drivers, laboratory and office staff, and to contractors and visitors while on site.'
  const AS_OF = '2021-02-01'

  const { data: doc, error: dErr } = await db.from('documents')
    .select('id').eq('company_id', co.id).eq('name', '01-eap-chemical.pdf')
    .order('uploaded_at', { ascending: false }).limit(1).maybeSingle()
  if (dErr) die(`looking for the emergency plan on ${co.name}: ${dErr.message}`)
  if (!doc) return { skipped: 'the emergency plan (01-eap-chemical.pdf) is not on file for this company' }

  // The Portland site. Named, not "the first entity": a two-site fixture must not silently attach
  // the headcount to whichever row came back first.
  const { data: site, error: sErr } = await db.from('entities')
    .select('id, name').eq('company_id', co.id).eq('name', 'Portland').limit(1).maybeSingle()
  if (sErr) die(`looking for the Portland site on ${co.name}: ${sErr.message}`)
  if (!site) return { skipped: `${co.name} has no site named "Portland"` }

  // The proposal first, so the fact can point at it. `source` and `status` are named rather than
  // left to defaults, because what this row means — a reading proposed it and a person accepted
  // it — is the whole reason it exists.
  const { data: existing, error: eErr } = await db.from('fact_proposals')
    .select('id').eq('company_id', co.id).eq('document_id', doc.id).eq('switch_key', KEY)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (eErr) die(`looking for an existing ${KEY} proposal on ${co.name}: ${eErr.message}`)

  let proposalId = existing?.id ?? null
  if (proposalId) {
    const { error } = await db.from('fact_proposals').update({
      proposed_value: VALUE, quote: QUOTE, locator: 'section 1', as_of: AS_OF,
      entity_id: site.id, basis: 'read', status: 'accepted', document_id: doc.id,
    }).eq('id', proposalId)
    if (error) die(`updating the ${KEY} proposal on ${co.name}: ${error.message}`)
  } else {
    const { data, error } = await db.from('fact_proposals').insert({
      company_id: co.id, document_id: doc.id, entity_id: site.id,
      switch_key: KEY, proposed_value: VALUE, quote: QUOTE, locator: 'section 1',
      as_of: AS_OF, basis: 'read', source: 'document', status: 'accepted',
    }).select('id').single()
    if (error) die(`writing the ${KEY} proposal on ${co.name}: ${error.message}`)
    proposalId = data.id
  }

  const { error } = await db.from('company_facts').upsert({
    company_id: co.id, key: KEY, value: VALUE, basis: 'read',
    source_document_id: doc.id, source_proposal_id: proposalId,
    entity_id: site.id, as_of: AS_OF,
    confirmed_by: null, confirmed_at: new Date().toISOString(),
  }, { onConflict: 'company_id,key,entity_id' })
  if (error) die(`confirming ${KEY} for ${co.name}: ${error.message}`)

  return { key: KEY, value: VALUE, as_of: AS_OF, site: site.name,
           relinked: !!existing, document_id: doc.id, proposal_id: proposalId }
}

/**
 * LABEL CORRECTIONS AS FIXTURE SETUP, ONLY WHERE THE READING CONTRADICTS THE SPEC — Run 1c, (d).
 *
 * An audit is scoped by the agency label on a document (`lib/audit.ts` compares it exactly), so a
 * record filed under the wrong regulator is invisible to the right regulator's audit and nothing in
 * the audit can tell. Run 1b measured that: Haiku gave both forklift logs and the forklift TRAINING
 * record `Oregon DEQ` and gave the emergency plan no agency at all, so the OSHA audit was shown none
 * of the three documents its key is about.
 *
 * This does NOT improve the reading and must never be mistaken for it. It is the fixture being set
 * up so the AUDIT can be measured — the same role `confirmFixtureFact` plays for the confirmed 42.
 * A correction is written only where the label contradicts that document's own ANSWER KEY, the row
 * carries a reason saying so in words, and every one written is printed. Where the reading already
 * agrees with the spec, nothing is written and the report says so.
 *
 * `document_corrections` is read by `document_index_v` — `coalesce(c_ag.new_value, s.agencies, …)`,
 * migration 045 — which is what `buildAuditInput` selects from. So a row here really does change
 * what the audit sees; it is not a note nobody applies.
 *
 * WHAT EACH SPEC'S ANSWER KEY ACCEPTS, copied from its "agency includes" line and nothing else:
 */
const SPEC_AGENCY = {
  '01-eap-chemical.pdf':                  { spec: '01', accept: ['osha'] },
  '02-acdp-chemical.pdf':                 { spec: '02', accept: ['deq', 'department of environmental quality'] },
  '05-sds-supplier.pdf':                  { spec: '05', accept: ['osha', 'dot', 'department of transportation'] },
  '06a-forklift-log.pdf':                 { spec: '06', accept: ['osha'] },
  '06b-forklift-log-photo.pdf':           { spec: '06', accept: ['osha'] },
  '07-scrubber-log-record.pdf':           { spec: '07', accept: ['deq', 'department of environmental quality'] },
  '08-deq-annual-report-2025.pdf':        { spec: '08', accept: ['deq', 'department of environmental quality'] },
  '09-forklift-training-records.pdf':     { spec: '09', accept: ['osha'] },
  '10-osha-300a-2025.pdf':                { spec: '10', accept: ['osha'] },
  '11-fire-extinguisher-certificate.pdf': { spec: '11', accept: ['fire', 'osfm', 'osha'] },
  // 12 and 13 name no required agency: spec 12 says "Oregon DEQ or none", spec 13 says
  // "none, or a mix of Oregon DEQ and Oregon OSHA; either passes". Nothing can contradict that.
}

async function correctFixtureLabels(co) {
  const { data: rows, error } = await db.from('document_index_v')
    .select('document_id, file_name, agencies').eq('company_id', co.id).order('file_name')
  if (error) die(`reading document_index_v for ${co.name}: ${error.message}`)
  if (!rows?.length) die(`document_index_v returned no rows for ${co.name} — that is a query problem, `
    + `not an empty company; the documents runner has uploaded fixtures for it.`)

  const { data: labelRows, error: lErr } = await db.from('company_labels')
    .select('label').eq('company_id', co.id).eq('kind', 'agency').order('label')
  if (lErr) die(`reading company_labels for ${co.name}: ${lErr.message}`)
  const labels = (labelRows ?? []).map((l) => l.label)

  const written = [], agreed = [], unfixable = []
  for (const r of rows) {
    const want = SPEC_AGENCY[r.file_name]
    if (!want) continue
    const have = Array.isArray(r.agencies) ? r.agencies : []
    const ok = have.some((a) => want.accept.some((w) => String(a).toLowerCase().includes(w)))
    if (ok) { agreed.push({ file: r.file_name, have }); continue }

    // The replacement is one of the COMPANY'S OWN labels that satisfies the spec — never a string
    // invented here. The company's vocabulary is the company's; if it holds no label the spec
    // accepts, that is reported and left alone rather than papered over with a new one.
    const fix = labels.find((l) => want.accept.some((w) => l.toLowerCase().includes(w)))
    if (!fix) { unfixable.push({ file: r.file_name, have, accept: want.accept }); continue }

    const { error: wErr } = await db.from('document_corrections').insert({
      document_id: r.document_id, company_id: co.id, field: 'agencies',
      old_value: have, new_value: [fix],
      reason: `fixture setup: agency per spec ${want.spec}`,
    })
    if (wErr) die(`writing the agency correction for ${r.file_name}: ${wErr.message}`)
    written.push({ file: r.file_name, from: have, to: fix, spec: want.spec })
  }
  return { written, agreed, unfixable, labels }
}

const confirmed = {}
const corrected = {}
const summary = []
for (const c of caseFiles) {
  const { data: co } = await db.from('companies').select('id, name').ilike('name', `%${c.company}%`).limit(1).maybeSingle()
  if (!co) die(`No company matching "${c.company}" on staging. Run: npm run golden:docs -- --seed-only`)

  if (!confirmed[co.id]) {
    confirmed[co.id] = await confirmFixtureFact(co)
    const r = confirmed[co.id]
    console.log(r.skipped
      ? `  fixture: nothing confirmed — ${r.skipped}`
      : `  fixture: confirmed ${r.key} = "${r.value}", as of ${r.as_of}, site ${r.site}`
        + `  (${r.relinked ? 'relinked an existing proposal' : 'wrote a new accepted proposal'}`
        + `; every other proposal stays proposed)`)
  }

  if (!corrected[co.id]) {
    corrected[co.id] = await correctFixtureLabels(co)
    const r = corrected[co.id]
    console.log(`  fixture: ${r.written.length} agency label correction(s) written`
      + `, ${r.agreed.length} document(s) already agreed with their spec`
      + (r.unfixable.length ? `, ${r.unfixable.length} could NOT be corrected` : ''))
    for (const w of r.written) {
      console.log(`           ${w.file.padEnd(38)} [${w.from.join(' · ') || 'none'}]  ->  ${w.to}`
        + `   (spec ${w.spec})`)
    }
    for (const u of r.unfixable) {
      console.log(`         ⚠ ${u.file.padEnd(38)} [${u.have.join(' · ') || 'none'}] satisfies none of `
        + `${u.accept.join('/')} and this company holds no label that does — left alone`)
    }
  }

  const labels = await auditAgenciesFor(db, co.id)
  if (!labels.includes(c.agency)) {
    die(`"${c.agency}" is not one of ${co.name}'s agency labels. Staging has: ${labels.join(' · ') || '(none)'}\n`
      + `  A label is the company's own vocabulary, so this is a state problem, not a typo to fix in the case.`)
  }

  const built = await buildAuditInput(db, co.id, c.agency, { today: TODAY })

  // Every file any check in this case wants a live reading of, read once per case.
  const wantFiles = [...new Set([...c.must, ...c.must_not, ...(c.acceptable ?? [])]
    .map((k) => k.file).filter(Boolean))]
  const own = await readOwnFindings(co.id, wantFiles)
  for (const [f, v] of Object.entries(own)) {
    console.log(`  live    : ${f.padEnd(30)} ${v.gaps.length} open gap(s), `
      + `${v.conditions.length} condition word(s)  (scan ${String(v.scanId ?? 'none').slice(0, 8)})`)
  }

  const ctx = {
    own,
    documentIds: [...built.input.documents.map((d) => d.document_id),
                  ...built.input.other_documents.map((d) => d.document_id)],
    documentIdByFile: Object.fromEntries(built.input.documents.map((d) => [d.file_name, d.document_id])),
    // The significant words of each document's own conditions, so a whitelist can be built from what
    // the model was shown rather than from a list somebody typed twice.
    conditionWords: Object.fromEntries(built.input.documents.map((d) => [d.document_id,
      d.conditions.flatMap((c) => norm(c.title).split(/[^a-z0-9]+/).filter((w) => w.length > 4))])),
  }

  console.log(`  ${'='.repeat(74)}`)
  console.log(`  ${c.id} — ${c.agency} — ${co.name}`)
  console.log(`  input: ${built.input.documents.length} document(s) for this agency, `
            + `${built.input.other_documents.length} other on file · block sha ${built.sha256.slice(0, 12)}…`)
  console.log(`  ${'='.repeat(74)}`)

  for (const mode of MODES) {
    const perRun = []
    for (let n = 1; n <= times; n++) {
      // *** THE ROWS ARE THE ANSWER NOW. *** `--json-path` keeps the old behaviour for a
      // comparison run; without it every mode goes through `lib/auditRun.ts` and the judge reads
      // `audit_findings`. `previousRunId` is set by `--previous <run id>` for the matcher run.
      const viaRows = !jsonPath
      let r
      if (viaRows && mode === 'whole') {
        r = await runAsRows(built, co, c, previousRun)
      } else if (viaRows) {
        const got = await runSections(built, co.id)
        r = { ...got, ...(await storeSectionsAnswer(built, co, c, got.answer, got.calls)) }
      } else {
        r = mode === 'whole' ? await runWhole(built, co.id) : await runSections(built, co.id)
      }
      const { answer, calls, handleErrors } = r
      const verdicts = judge(c, answer, ctx)
      const count = (kind) => kind.filter((k) => verdicts[k.id]?.verdict === 'PASS').length
      const mustPass = count(c.must), mustNotPass = count(c.must_not), okPass = count(c.acceptable ?? [])
      const cost = calls.reduce((s, r) => s + Number(r.cost ?? 0), 0)
      const wall = calls.reduce((s, r) => s + r.wall_ms, 0)

      mkdirSync(`${RUNS}/${c.id}`, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      writeFileSync(`${RUNS}/${c.id}/${mode}-${stamp}-${n}.json`, JSON.stringify({
        case: c.id, agency: c.agency, mode, run: n, run_date: TODAY, model: MODEL,
        // THE INPUT AND ITS HASH, ON EVERY RUN. Without them a stored answer cannot be attributed:
        // "the audit got worse" and "the readings changed underneath it" look identical afterwards.
        input_block: built.block, input_sha256: built.sha256, input: built.input,
        calls: calls.map((r, i) => ({
          section: mode === 'sections' ? AUDIT_SECTIONS[i].id : 'whole',
          wall_ms: r.wall_ms, cost_usd: r.cost, sources: r.sources,
          input_tokens: r.tokens?.input_tokens ?? null, output_tokens: r.tokens?.output_tokens ?? null,
          searches: r.tokens?.searches ?? null, json_parsed: !!r.obj, raw_text: r.raw,
        })),
        answer, verdicts, cost_usd: cost, wall_ms: wall,
        // Every handle the model wrote that the block did not carry. Stored rather than only
        // counted, so "which handle did it invent" is answerable from the run file.
        handle_errors: handleErrors ?? [],
        // THE ROWS THIS ANSWER CAME FROM. The run and section ids make the JSON file and the
        // database two views of one thing rather than two records that can drift.
        audit_run_id: r.runId ?? null, audit_section_id: r.sectionId ?? null,
        audit_section: r.section ?? null, rows_written: r.rowsWritten ?? null,
        section_status: r.sectionStatus ?? null, run_summary: r.summary ?? null,
      }, null, 2) + '\n')

      perRun.push({ n, verdicts, mustPass, mustNotPass, okPass, cost, wall, answer, calls,
                    runId: r.runId ?? null, summary: r.summary ?? null,
                    rowsWritten: r.rowsWritten ?? null, sectionStatus: r.sectionStatus ?? null })
      process.stdout.write(`    ${mode.padEnd(8)} run ${n}/${times}  ${(wall / 1000).toFixed(1)}s  `
        + `$${cost.toFixed(4)}  must ${mustPass}/${c.must.length}  must-not ${mustNotPass}/${c.must_not.length}`
        + `  ok ${okPass}/${(c.acceptable ?? []).length}`
        + `${r.rowsWritten != null ? `  ${r.rowsWritten} row(s)` : ''}`
        + `${r.sectionStatus === 'could_not_complete' ? '  ⚠ could_not_complete' : ''}`
        + `  ${handleErrors?.length ? `⚠ ${handleErrors.length} bad handle(s) ` : ''}`
        + `${calls.every((r) => r.obj) ? '' : '(a call came back unparseable) '}\n`)
    }

    // PER CHECK, ACROSS THE RUNS — the column that says whether a pass is a property of the answer or
    // of the run. Anything not 3/3 is not settled.
    console.log('')
    for (const check of [...c.must, ...c.must_not, ...(c.acceptable ?? [])]) {
      const hits = perRun.filter((r) => r.verdicts[check.id]?.verdict === 'PASS').length
      const kind = c.must.includes(check) ? 'must' : c.must_not.includes(check) ? 'must-not' : 'ok'
      const mark = hits === perRun.length ? '  ' : hits === 0 ? '✗ ' : '~ '
      console.log(`    ${mark}${String(hits)}/${perRun.length}  ${kind.padEnd(8)} ${check.id.padEnd(24)} ${check.line}`)
      if (hits < perRun.length) {
        const why = perRun.find((r) => r.verdicts[check.id]?.verdict !== 'PASS')
        console.log(`             ${why.verdicts[check.id]?.detail?.slice(0, 150) ?? ''}`)
      }
    }
    const mean = (f) => (perRun.reduce((s, r) => s + f(r), 0) / perRun.length)
    console.log(`\n    ${mode}: mean $${mean((r) => r.cost).toFixed(4)} · ${(mean((r) => r.wall) / 1000).toFixed(1)}s`
      + ` · ${mode === 'sections' ? AUDIT_SECTIONS.length : 1} call(s) per run\n`)
    summary.push({ case: c.id, mode, perRun, must: c.must.length, mustNot: c.must_not.length,
                   ok: (c.acceptable ?? []).length, meanCost: mean((r) => r.cost), meanWall: mean((r) => r.wall) })
  }
}

console.log(`  ${'─'.repeat(74)}`)
console.log('  SUMMARY')
for (const s of summary) {
  const m = (f) => s.perRun.map(f).join(',')
  console.log(`    ${s.case.padEnd(14)} ${s.mode.padEnd(9)} must ${m((r) => r.mustPass)}/${s.must}`
    + `  must-not ${m((r) => r.mustNotPass)}/${s.mustNot}  ok ${m((r) => r.okPass)}/${s.ok}`
    + `  $${s.meanCost.toFixed(4)}  ${(s.meanWall / 1000).toFixed(1)}s`)
}
console.log(`  ${'─'.repeat(74)}`)
console.log(`  full JSON of every run: ${RUNS}/<case>/<mode>-<timestamp>-<n>.json`)
console.log(`  cost of this command: see npm run cost\n`)

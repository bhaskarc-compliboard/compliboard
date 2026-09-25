#!/usr/bin/env node
// THE GOLDEN DOCUMENTS RUNNER — Documents Run 2, part 3.
//
//   npm run golden:docs                     every case, three runs each, against STAGING
//   npm run golden:docs -- 04               one case, by case-id prefix
//   npm run golden:docs -- --times 1        fewer runs (the specs ask for three)
//   npm run golden:docs -- 06 --times 3     both forklift cases
//   npm run golden:docs -- --seed-only       put the three companies back, scan nothing
//   npm run golden:docs -- --from-runs       re-judge what is on disk, no model call
//
// WHAT IT ANSWERS. For each fixture, does the scan contain every "must" its spec states, in
// every run? It does not, and cannot, tell you an answer got BETTER — that is a person reading
// the output. TESTING.md (b).
//
// *** THE SPECS ARE THE TRUTH AND THE CASE FILES ARE DERIVED FROM THEM. *** This file holds no
// expectation of its own. Every line judged comes out of tests/golden/documents/cases/*.json,
// and each of those carries the sentence from the spec's ANSWER KEY it came from, so a failure
// names the line rather than an assertion id somebody has to go and look up.
//
// *** PRODUCTION IS NEVER A TARGET. *** It reads NEXT_PUBLIC_SUPABASE_URL, which on a developer
// machine is staging, and refuses to run if that URL carries the production ref. There is no
// flag that changes that and adding one would be the bug.
//
// IT COSTS REAL MONEY: one model call per run, one cost row per call.
//
// *** `alternative_pass` REQUIRES json_parsed. *** Case 06b's spec says an honest "I could not
// read the photograph" passes. `lib/documentScan.ts` ALSO returns status could_not_read when the
// model answered fine and the JSON would not parse — a different event with the same status.
// Measured on 25 September: all three 06b runs read the photograph correctly and all three were
// lost to one extra closing brace, so without this condition the case would have been marked
// PASS for a failure. A pass earned by a bug is worse than a fail.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { runDocumentScan, saveScan, buildScanContext } from '../lib/documentScan.ts'
import { modelForTask } from '../lib/ai.ts'

const PROD_REF = 'dsfwmafnphdlfogetsus'
const DIR = 'tests/golden/documents'
const CASES = `${DIR}/cases`
const RUNS = `${DIR}/runs`

const args = process.argv.slice(2)
const die = (m) => { console.error(`\n  ${m}\n`); process.exit(1) }
const flagIndex = args.indexOf('--times')
const times = Number(flagIndex >= 0 && args[flagIndex + 1] ? args[flagIndex + 1] : '3')
const only = args.filter((a, i) => !a.startsWith('--') && i !== flagIndex + 1)[0]
// Re-judge the runs already on disk instead of buying new ones. No model call, no database.
const fromRuns = args.includes('--from-runs')
// Seed the three companies and stop. `npm run db:reset` replays the chain from 000 onto an empty
// database, and the golden companies are data, not schema — this puts them back without buying
// twenty-one model calls to do it.
const seedOnly = args.includes('--seed-only')
if (!Number.isInteger(times) || times < 1) die('--times must be a positive integer.')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) die('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (staging).')
if (url.includes(PROD_REF)) die('That URL is PRODUCTION. This command is staging-only and there is no flag to change that.')
if (!process.env.ANTHROPIC_API_KEY) die('ANTHROPIC_API_KEY is not set.')

const db = createClient(url, key, { auth: { persistSession: false } })
const MODEL = modelForTask('document_scan')
const TODAY = new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// THE THREE COMPANIES, FROM THE SPECS' OWN CONTEXT LINES.
// Copied from the "Company context to scan under:" line of each spec — nothing invented.
// ---------------------------------------------------------------------------
const COMPANIES = {
  cascade: {
    name: 'Cascade Specialty Chemicals, LLC', industry: 'chemical distribution',
    city: 'Portland', state: 'Oregon',
    site: { name: 'Portland', address: '4410 NW Front Ave, Portland, Oregon 97210', city: 'Portland', state: 'Oregon' },
  },
  evergreen: {
    name: 'Evergreen Botanicals, LLC', industry: 'cannabis cultivation',
    city: 'Eugene', state: 'Oregon',
    site: { name: 'Bailey Hill', address: '2210 Bailey Hill Road, Eugene, Oregon 97405', city: 'Eugene', state: 'Oregon' },
  },
  willamette: {
    name: 'Willamette Valley Foods, Inc.', industry: 'food manufacturing (ready-to-eat dips and spreads)',
    city: 'Salem', state: 'Oregon',
    site: { name: 'Salem', address: '1850 Fairgrounds Road NE, Salem, Oregon 97301', city: 'Salem', state: 'Oregon' },
  },
}

// README: "the runner scans them in the order 01, 02, 05, 06a, 06b for that company."
const ORDER = ['01-eap-chemical', '02-acdp-chemical', '05-sds-supplier', '06a-forklift-log',
               '06b-forklift-log-photo', '03-olcc-cannabis', '04-fsp-food']

// ---------------------------------------------------------------------------
// JUDGING
// ---------------------------------------------------------------------------
// *** UNDERSCORES COUNT AS SPACES. *** The model writes labels in snake_case — "workplace_safety",
// "cannabis_cultivation", "air_quality" — and the specs write them in English. Without this line
// `subjects` containing "workplace_safety" did not match the spec's "workplace safety" and case
// 06a's `subject` line was reported failing in all three runs. That was this matcher, not the
// model, and a matcher that invents failures is worse than no matcher.
const norm = (s) => String(s ?? '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
const squash = (s) => norm(s).replace(/[^a-z0-9]/g, '')

function at(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

/** Every text field of one item, joined — what keywords and citations are searched in. */
const ITEM_TEXT = (o) => Object.values(o ?? {}).filter((v) => typeof v === 'string' || typeof v === 'number')
  .map(String).join(' / ')

/** The collections a case file may name. "notes" is the free text a record's findings may live in. */
function collections(scan) {
  return {
    gaps: scan.gaps ?? [],
    conditions: scan.conditions ?? [],
    deadlines: scan.deadlines ?? [],
    facts: scan.facts ?? [],
    expected_missing: scan.expected_missing ?? [],
    // The spec for a record says its findings may appear "as gaps or notes, whichever the
    // schema uses". The schema has no notes field, so the free text is treated as one note
    // each — otherwise a correct finding written in the summary would be judged missing.
    notes: [
      { field: 'summary', text: scan.summary },
      { field: 'freshness_note', text: scan.freshness_note },
      { field: 'confidence_notes', text: scan.confidence_notes },
      { field: 'could_not_read', text: scan.could_not_read?.reason },
      ...(scan.expected_missing ?? []).map((e) => ({ field: 'expected_missing', text: ITEM_TEXT(e) })),
    ].filter((n) => n.text),
  }
}

/** The ways a date is written, so a date in prose counts as much as one in due_on. */
function dateForms(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December']
  const mo = MONTHS[m - 1], ab = mo.slice(0, 3)
  return [iso, `${mo} ${d}, ${y}`, `${mo} ${d} ${y}`, `${d} ${mo} ${y}`, `${ab} ${d}, ${y}`,
          `${m}/${d}/${y}`, `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`]
    .map(squash)
}
const hasDate = (text, iso) => dateForms(iso).some((f) => squash(text).includes(f))

function matchItem(check, cols) {
  const names = check.collections ?? []
  const kws = (check.keywords ?? []).map(norm)
  const min = check.min_keywords ?? 2
  const cites = check.citation_any ?? (check.citation ? [check.citation] : [])
  for (const name of names) {
    for (const item of cols[name] ?? []) {
      const text = norm(ITEM_TEXT(item))
      const sq = squash(text)
      if (cites.length && !cites.some((c) => sq.includes(squash(c)))) continue
      if (check.date && !hasDate(text, check.date)) continue
      if (check.date_or_text && !check.date_or_text.some((v) =>
        /^\d{4}-\d{2}-\d{2}$/.test(v) ? hasDate(text, v) : sq.includes(squash(v)))) continue
      // *** THE FIELD, NOT THE WORD. *** Before migration 041 there was nowhere to record
      // whether an item was read or worked out, so "is this marked inferred?" had to be asked
      // of the item's prose. It is a column now and this reads it.
      if (check.basis && (item.basis ?? 'read') !== check.basis) continue
      const hit = kws.filter((k) => text.includes(k))
      if (hit.length >= min) return { ok: true, where: name, item, hit }
    }
  }
  return { ok: false }
}

function evaluate(check, scan, ctx) {
  const cols = collections(scan)
  switch (check.type) {
    case 'field_one_of': {
      const v = norm(at(scan, check.field))
      if (check.forbid?.some((f) => v === norm(f))) return { verdict: 'FAIL', detail: `${check.field} = "${v}" (forbidden)` }
      if (check.allow_null && !v) return { verdict: 'PASS', detail: `${check.field} = null` }
      if (check.accept.some((a) => v === norm(a))) return { verdict: 'PASS', detail: `${check.field} = "${v}"` }
      if (check.near_miss?.some((a) => v === norm(a)))
        return { verdict: 'NEAR', detail: `${check.field} = "${v}" — the spec names this a near miss, reported not failed` }
      return { verdict: 'FAIL', detail: `${check.field} = "${v || 'null'}"` }
    }
    case 'field_contains': {
      const v = norm(at(scan, check.field))
      if (check.accept.some((a) => v.includes(norm(a)))) return { verdict: 'PASS', detail: `${check.field} = "${v}"` }
      if (check.near_miss?.some((a) => v.includes(norm(a))))
        return { verdict: 'NEAR', detail: `${check.field} = "${v}" — near miss named by the spec` }
      return { verdict: 'FAIL', detail: `${check.field} = "${v || 'null'}"` }
    }
    case 'list_contains': {
      const list = (at(scan, check.field) ?? []).map(norm)
      if (list.some((v) => check.accept.some((a) => v.includes(norm(a)))))
        return { verdict: 'PASS', detail: `${check.field} = [${list.join(' | ')}]` }
      if (check.near_miss && list.some((v) => check.near_miss.some((a) => v.includes(norm(a)))))
        return { verdict: 'NEAR', detail: `${check.field} = [${list.join(' | ')}] — near miss named by the spec` }
      return { verdict: 'FAIL', detail: `${check.field} = [${list.join(' | ') || 'empty'}]` }
    }
    case 'date_equals': {
      const v = at(scan, check.field)
      return v === check.value ? { verdict: 'PASS', detail: `${check.field} = ${v}` }
        : { verdict: 'FAIL', detail: `${check.field} = ${v ?? 'null'}, wanted ${check.value}` }
    }
    case 'date_prefix': {
      const v = String(at(scan, check.field) ?? '')
      return v.startsWith(check.prefix) ? { verdict: 'PASS', detail: `${check.field} = ${v}` }
        : { verdict: 'FAIL', detail: `${check.field} = ${v || 'null'}, wanted ${check.prefix}-…` }
    }
    case 'date_anywhere': {
      for (const f of check.fields ?? []) if (at(scan, f) === check.value)
        return { verdict: 'PASS', detail: `${f} = ${check.value}` }
      for (const name of check.collections ?? []) for (const item of cols[name] ?? [])
        if (hasDate(ITEM_TEXT(item), check.value))
          return { verdict: 'PASS', detail: `${check.value} in ${name}: "${String(item.title ?? '').slice(0, 60)}"` }
      return { verdict: 'FAIL', detail: `${check.value} appears in none of ${[...(check.fields ?? []), ...(check.collections ?? [])].join(', ')}` }
    }
    case 'status_by_date': {
      const days = Math.round((Date.parse(check.expiry) - Date.parse(ctx.today)) / 86400000)
      const want = days < 0 ? 'expired' : days <= check.expiring_window_days ? 'expiring' : 'current'
      return norm(scan.status) === want
        ? { verdict: 'PASS', detail: `status = ${scan.status} (${days} days to ${check.expiry} -> ${want})` }
        : { verdict: 'FAIL', detail: `status = ${scan.status}, the run date makes it ${want} (${days} days to ${check.expiry})` }
    }
    case 'empty': {
      const items = check.collections.flatMap((c) => cols[c] ?? [])
      return items.length === 0 ? { verdict: 'PASS', detail: 'none' }
        : { verdict: 'FAIL', detail: `${items.length}: ` + items.map((i) => `"${String(i.title ?? i.key ?? '').slice(0, 70)}"`).join('; ') }
    }
    case 'field_empty': {
      const v = at(scan, check.field)
      return !v ? { verdict: 'PASS', detail: 'null' } : { verdict: 'FAIL', detail: `"${String(v).slice(0, 90)}"` }
    }
    case 'item': {
      if (check.required_if_run_date_after && ctx.today <= check.required_if_run_date_after)
        return { verdict: 'N/A', detail: `not required before ${check.required_if_run_date_after}` }
      const m = matchItem(check, cols)
      if (m.ok) return { verdict: 'PASS',
        detail: `${m.where}: "${String(m.item.title ?? m.item.key ?? m.item.field ?? '').slice(0, 70)}" [${m.hit.join(', ')}]` }
      const seen = (check.collections ?? []).flatMap((c) => (cols[c] ?? [])
        .map((i) => String(i.title ?? i.key ?? i.field ?? '').slice(0, 44)))
      return { verdict: 'FAIL', detail: `no item matched. ${check.collections.join('/')} held: ${seen.join(' | ') || '(nothing)'}` }
    }
    case 'absent_item': {
      // *** THIS IS THE CHECK THAT IS EASIEST TO GET WRONG, AND A WRONG ONE IS WORSE THAN NONE. ***
      // The spec says "no gap claiming the alarm system is missing". A keyword pair —
      // "alarm" somewhere and "missing" somewhere — also fires on "Missing verification that
      // evacuation maps are current", which claims the VERIFICATION is missing, not the maps.
      // Measured: the loose version reported all four of case 01's must-nots as false findings
      // and every one of them was my matcher, not the model.
      //
      // So a FAILURE needs the subject to be the thing the title says is absent: an absence
      // word, then at most `window` characters, then the subject, in the TITLE. Anything looser
      // — the subject anywhere in the item with an absence word anywhere — is printed as a
      // candidate for a person to read, and fails nothing.
      const window = check.window ?? 14
      const hard = [], soft = []
      for (const name of check.collections) for (const item of cols[name] ?? []) {
        const title = norm(item.title ?? item.key ?? item.field ?? '')
        // `fields` narrows the search to named fields. A fact's `key` IS its subject —
        // "supplier_contact", "osha_pel" — so a must-not about what a fact is ABOUT reads the
        // key, not the whole item: the quote of a legitimate company fact will mention the
        // chemical by name without the fact being about the chemical.
        const text = check.fields
          ? norm(check.fields.map((f) => item[f]).filter(Boolean).join(' / '))
          : norm(ITEM_TEXT(item))
        const subjectHere = check.subject.find((s) => text.includes(norm(s)))
        if (!subjectHere) continue
        const absentHere = !check.absence.length
          || check.absence.some((a) => text.includes(norm(a)))
        if (!absentHere) continue
        const esc = (s) => norm(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const subjects = `(?:${check.subject.map(esc).join('|')})`
        // With no absence words the must-not is not about a claim at all — case 05's "the
        // supplier's address, phone and CHEMTREC number are not facts about the company" is
        // violated by ANY item carrying them, wherever in the item they sit. Restricting that
        // one to the title let `supplier_name_and_location` through, because the address was
        // in the value. With absence words the claim has to be about the subject, so the
        // title and the window still apply.
        const tight = !check.absence.length
          ? true
          : check.absence.some((a) => new RegExp(esc(a) + `.{0,${window}}` + subjects).test(title))
        ;(tight ? hard : soft).push({ where: name, text: ITEM_TEXT(item) })
      }
      if (hard.length) return { verdict: 'FAIL',
        detail: hard.map((h) => `${h.where}: "${h.text.slice(0, 220)}"`).join('  ||  '), quotes: hard, soft }
      return { verdict: 'PASS',
        detail: soft.length ? `not raised as such; ${soft.length} item(s) mention it — read below` : 'not raised', soft }
    }
    case 'appears_anywhere': {
      const parts = [...(check.fields ?? []).map((f) => JSON.stringify(at(scan, f) ?? '')),
                     ...(check.collections ?? []).map((c) => JSON.stringify(cols[c] ?? []))]
      const sq = squash(parts.join(' '))
      return sq.includes(squash(check.needle))
        ? { verdict: 'PASS', detail: `"${check.needle}" found` }
        : { verdict: 'FAIL', detail: `"${check.needle}" not in ${[...(check.fields ?? []), ...(check.collections ?? [])].join(', ')}` }
    }
    case 'text_keywords': {
      const text = norm(check.fields.map((f) => at(scan, f)).filter(Boolean).join(' '))
      const hit = check.keywords.map(norm).filter((k) => text.includes(k))
      return hit.length >= (check.min_keywords ?? 2)
        ? { verdict: 'PASS', detail: `[${hit.join(', ')}]` }
        : { verdict: 'FAIL', detail: `only [${hit.join(', ') || 'nothing'}] of the spec's words appear` }
    }
    case 'every_item_marked_inferred': {
      // Reads `basis` (migration 041), not the word "inferred" somewhere in the prose. An item
      // that names no basis counts as `read`, which is the same default the column carries.
      const all = check.collections.flatMap((c) => cols[c] ?? [])
      const bad = all.filter((i) => (i.basis ?? 'read') !== 'inferred')
      return bad.length === 0
        ? { verdict: 'PASS', detail: `${all.length} fact(s), every one basis=inferred` }
        : { verdict: 'FAIL',
            detail: `${bad.length} of ${all.length} carry basis=read: `
              + bad.map((b) => `"${String(b.key ?? b.title ?? '').slice(0, 40)}"`).join(', '),
            quotes: bad.map((b) => ({ where: 'facts', text: ITEM_TEXT(b) })) }
    }
    // "Acceptable, not required — but if it is there it must carry this basis." Spec 05: a
    // company fact drawn from holding an SDS is a fair proposal, and the SDS does not say it,
    // so it is inferred; the same sentence offered as read fails the run. Absent entirely: pass.
    case 'basis_if_present': {
      const hits = []
      for (const name of check.collections) for (const item of cols[name] ?? []) {
        const text = norm(check.fields
          ? check.fields.map((f) => item[f]).filter(Boolean).join(' / ')
          : ITEM_TEXT(item))
        const hit = check.keywords.map(norm).filter((k) => text.includes(k))
        if (hit.length >= (check.min_keywords ?? 2)) hits.push({ item, hit })
      }
      if (!hits.length) return { verdict: 'PASS', detail: 'no such fact was proposed — the spec does not require one' }
      const wrong = hits.filter((h) => (h.item.basis ?? 'read') !== check.basis)
      return wrong.length === 0
        ? { verdict: 'PASS', detail: `${hits.length} such fact(s), every one basis=${check.basis}` }
        : { verdict: 'FAIL',
            detail: wrong.map((w) => `"${String(w.item.key ?? w.item.title ?? '')}" is basis=${w.item.basis ?? 'read'}, must be ${check.basis}`).join('  ||  ') }
    }
    case 'labels_identical_across_runs':
      return { verdict: 'CROSS', detail: 'judged across the three runs, below' }
    default:
      // A check with no implementation reports SKIP, never PASS. run-golden.js's rule.
      return { verdict: 'SKIP', detail: `no checker for type "${check.type}" — NOT a pass` }
  }
}

/** README: "Compliant" anywhere in status, summary or a gap fails the run. */
function compliantCheck(scan) {
  const where = []
  if (/compliant/i.test(String(scan.status ?? ''))) where.push('status')
  if (/compliant/i.test(String(scan.summary ?? ''))) where.push('summary')
  for (const g of scan.gaps ?? []) if (/compliant/i.test(ITEM_TEXT(g))) where.push(`gap "${String(g.title).slice(0, 50)}"`)
  return where
}

/** Quotes on facts are checked verbatim against the spec's DOCUMENT TEXT. */
function specDocumentText(specFile) {
  const src = readFileSync(`${DIR}/${specFile}`, 'utf8')
  const m = src.match(/## DOCUMENT TEXT\n([\s\S]*?)\n---\n\n## ANSWER KEY/)
  return m ? m[1].trim() : ''
}
const quoteInSpec = (quote, specText) => squash(quote).length >= 8 && squash(specText).includes(squash(quote))

// ---------------------------------------------------------------------------
// SEEDING
// ---------------------------------------------------------------------------
async function seedCompany(k) {
  const c = COMPANIES[k]
  let { data: co } = await db.from('companies').select('id, name').eq('name', c.name).maybeSingle()
  if (!co) {
    const { data, error } = await db.from('companies')
      .insert({ name: c.name, industry: c.industry, city: c.city, state: c.state }).select('id, name').single()
    if (error) die(`companies insert (${c.name}): ${error.message}`)
    co = data
  } else {
    await db.from('companies').update({ industry: c.industry, city: c.city, state: c.state }).eq('id', co.id)
  }
  // *** THE SITE ALREADY EXISTS BY THE TIME THIS RUNS. *** Migration 010 puts an AFTER INSERT
  // trigger on `companies` that creates a primary site called "<company> — <city>", and
  // `idx_entities_one_primary` allows only one. So the spec's site name is applied to THAT row;
  // inserting a second primary site is refused, and inserting a non-primary one would leave the
  // prompt naming two sites for a company the spec says has one.
  const { data: primary } = await db.from('entities').select('id')
    .eq('company_id', co.id).eq('is_primary', true).maybeSingle()
  let siteId = primary?.id ?? null
  const siteRow = { name: c.site.name, address: c.site.address, city: c.site.city, state: c.site.state }
  if (siteId) {
    const { error } = await db.from('entities').update(siteRow).eq('id', siteId)
    if (error) die(`entities update (${c.site.name}): ${error.message}`)
  } else {
    const { data, error } = await db.from('entities')
      .insert({ company_id: co.id, entity_type: 'site', is_primary: true, details: {}, ...siteRow })
      .select('id').single()
    if (error) die(`entities insert (${c.site.name}): ${error.message}`)
    siteId = data.id
  }
  // A company the spec says has one site must not carry leftovers from an earlier shape.
  await db.from('entities').delete().eq('company_id', co.id).eq('is_primary', false)
  return { id: co.id, name: co.name, entityId: siteId, ...c }
}

/**
 * Start each suite run from the same place. Scoped to the three golden companies by id and to
 * nothing else — the point is that the label list and the "already holds" context accumulate
 * WITHIN a suite run the way they would for a real customer, which they cannot do if the last
 * run's labels are still there.
 */
async function resetCompany(co) {
  const { data: docs } = await db.from('documents').select('id').eq('company_id', co.id)
  for (const d of docs ?? []) await db.from('documents').delete().eq('id', d.id)   // cascades
  await db.from('company_labels').delete().eq('company_id', co.id)
  return (docs ?? []).length
}

async function uploadFixture(co, caseFile) {
  const path = `${DIR}/${caseFile.fixture}`
  if (!existsSync(path)) die(`Missing fixture ${path}. Run: npm run golden:docs:render`)
  const bytes = readFileSync(path)
  const name = path.split('/').pop()
  const storagePath = `${co.id}/golden/${Date.now()}-${name}`
  const { error: up } = await db.storage.from('company-documents')
    .upload(storagePath, bytes, { contentType: 'application/pdf' })
  if (up) die(`Upload failed for ${name}: ${up.message}`)
  const { data: row, error } = await db.from('documents').insert({
    company_id: co.id, name, file_url: storagePath, file_type: 'application/pdf',
    file_size: bytes.length, source: 'upload', status: 'uploaded', entity_id: co.entityId,
  }).select('id').single()
  if (error) die(`documents insert for ${name}: ${error.message}`)
  return { documentId: row.id, bytes, name }
}

/** One ordered copy, in lib/documentScan.ts, so this runner and `npm run scan` cannot drift. */
const buildContext = (co, documentId) => buildScanContext(db, co, documentId)

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
const files = readdirSync(CASES).filter((f) => f.endsWith('.json'))
const caseFiles = ORDER.filter((id) => files.includes(`${id}.json`) && (!only || id.startsWith(only)))
  .map((id) => JSON.parse(readFileSync(`${CASES}/${id}.json`, 'utf8')))
if (!caseFiles.length) die(`No case matching "${only ?? ''}" in ${CASES}/`)

console.log(`\n  Target   : ${url.replace(/https:\/\/([^.]+).*/, '$1')} (staging — there is no production target for this command)`)
console.log(`  Model    : ${MODEL}`)
console.log(`  Searches : ${process.env.DEV_MAX_SEARCHES ? `CAPPED AT ${process.env.DEV_MAX_SEARCHES} by DEV_MAX_SEARCHES — not the open baseline` : 'uncapped, as in production'}`)
console.log(`  Run date : ${TODAY}   (date-dependent statuses are computed from this)`)
console.log(`  Cases    : ${caseFiles.length} x ${times} run(s)`)
if (fromRuns) console.log(`  --from-runs: re-judging the stored runs in ${RUNS}/ — no model call, no database write`)
console.log('')

const needed = fromRuns ? [] : [...new Set(seedOnly ? Object.keys(COMPANIES) : caseFiles.map((c) => c.company))]
const companies = {}
for (const k of needed) {
  companies[k] = await seedCompany(k)
  const wiped = await resetCompany(companies[k])
  console.log(`  seeded ${companies[k].name}  (site "${companies[k].site.name}")`
    + (wiped ? `  — cleared ${wiped} document(s) from the last suite run` : ''))
}
if (seedOnly) {
  console.log(`\n  --seed-only: ${needed.length} compan${needed.length === 1 ? 'y' : 'ies'} exist with their site. No document was uploaded and no model was called.\n`)
  process.exit(0)
}

/**
 * JUDGE ONE RUN. Split out from the loop because `--from-runs` re-judges stored runs with no
 * model call and no database: tuning a matcher must not cost money, and a matcher tuned against
 * output you have to re-buy is a matcher nobody tunes.
 */
function judge(c, scan, specText, ctx) {
  const verdicts = {}
  for (const check of [...c.must, ...c.must_not, ...(c.reported ?? [])]) verdicts[check.id] = evaluate(check, scan, ctx)

  // A quote on a matched fact is checked verbatim against the spec's DOCUMENT TEXT.
  for (const check of c.must) {
    if (!check.quote_must_verify) continue
    const m = matchItem(check, collections(scan))
    if (!m.ok) continue
    const q = m.item.quote
    const why = !q ? 'no quote given' : !quoteInSpec(q, specText) ? 'not word for word in the document' : null
    if (!why) continue
    verdicts[check.id] = { verdict: 'FAIL',
      detail: `${verdicts[check.id].detail} — but the quote is ${why}${q ? `: "${String(q).slice(0, 160)}"` : ''}` }
  }
  return verdicts
}

const results = []

if (fromRuns) {
  for (const c of caseFiles) {
    const dir = `${RUNS}/${c.id}`
    if (!existsSync(dir)) { console.log(`  ${c.id}: no stored runs`); continue }
    // One entry per run, newest `times` of them — and where `npm run golden:docs:reparse` has
    // written a `.reparsed.json` beside a run that the extractor used to throw away, that
    // sibling is read instead. The original stays on disk untouched: the failure is evidence
    // and deleting it would hide what the extractor cost.
    const byRun = new Map()
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const base = f.replace(/\.reparsed\.json$/, '.json')
      if (f.endsWith('.reparsed.json') || !byRun.has(base)) byRun.set(base, f)
    }
    const stored = [...byRun.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, f]) => f).slice(-times)
    const specText = specDocumentText(c.spec)
    const runs = stored.map((f, i) => {
      const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))
      const scan = d.scan
      return { n: i + 1, scan, call: { cost_usd: d.cost_usd }, wall: d.wall_ms,
               verdicts: judge(c, scan, specText, { today: d.run_date ?? TODAY }),
               compliant: compliantCheck(scan),
               altPass: !!c.alternative_pass && scan.status === 'could_not_read'
      && !!scan.could_not_read?.way_forward && scan.json_parsed,
               file: f }
    })
    console.log(`  ${c.id}: re-judged ${runs.length} stored run(s), no model call`)
    results.push({ c, co: { name: COMPANIES[c.company].name }, runs })
  }
}

for (const c of (fromRuns ? [] : caseFiles)) {
  const co = companies[c.company]
  const specText = specDocumentText(c.spec)
  const { documentId, bytes, name } = await uploadFixture(co, c)
  const runs = []

  for (let n = 1; n <= times; n++) {
    const context = await buildContext(co, documentId)
    const t0 = Date.now()
    const scan = await runDocumentScan({
      buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      fileName: name, fileType: 'application/pdf', companyId: co.id, context,
    })
    const wall = Date.now() - t0
    const { scanId, aiCallId } = await saveScan(db, scan, { documentId, companyId: co.id, entityId: co.entityId })
    const { data: call } = aiCallId
      ? await db.from('ai_calls').select('*').eq('id', aiCallId).maybeSingle() : { data: null }

    const verdicts = judge(c, scan, specText, { today: TODAY })
    const compliant = compliantCheck(scan)
    const altPass = !!c.alternative_pass && scan.status === 'could_not_read'
      && !!scan.could_not_read?.way_forward && scan.json_parsed

    mkdirSync(`${RUNS}/${c.id}`, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(`${RUNS}/${c.id}/${stamp}-${n}.json`, JSON.stringify({
      case: c.id, run: n, run_date: TODAY, model: scan.model,
      searches: scan.searches, cited_sources: scan.cited_sources,
      prompt_sha256: scan.prompt_sha256, scan_id: scanId, ai_call_id: aiCallId,
      wall_ms: wall, cost_usd: call?.cost_usd ?? null,
      input_tokens: call?.input_tokens ?? null, output_tokens: call?.output_tokens ?? null,
      json_parsed: scan.json_parsed, compliant_found_in: compliant,
      alternative_pass: altPass, verdicts, scan,
    }, null, 2) + '\n')

    runs.push({ n, scan, call, wall, verdicts, compliant, altPass })
    process.stdout.write(`  ${c.id}  run ${n}/${times}  ${(wall / 1000).toFixed(1)}s  `
      + `${scan.searches ?? '?'} search${scan.searches === 1 ? '' : 'es'}  `
      + `${scan.cited_sources} source${scan.cited_sources === 1 ? '' : 's'}  `
      + `$${call?.cost_usd == null ? '?' : Number(call.cost_usd).toFixed(4)}  ${scan.status}\n`)
  }
  results.push({ c, co, runs })
}

// ---------------------------------------------------------------------------
// THE TABLES
// ---------------------------------------------------------------------------
const MARK = { PASS: 'ok ', FAIL: 'X  ', NEAR: '~  ', 'N/A': '-  ', SKIP: 'skip', CROSS: '<->' }
const bar = (w) => '  ' + '-'.repeat(w)
const labelsOf = (scan) => JSON.stringify({
  agencies: scan.identity.agencies, subjects: scan.identity.subjects,
})

let failedCases = 0
const companyLabels = {}

for (const { c, co, runs } of results) {
  const width = 112
  console.log('\n' + bar(width))
  console.log(`  ${c.id}   ${c.title}`)
  console.log(`  ${c.spec}  ->  ${c.fixture}   ·   ${co.name}`)
  console.log(bar(width))

  const rows = [...c.must, ...c.must_not]
  console.log(`  ${'must-line'.padEnd(34)}` + runs.map((r) => ` run ${r.n} `).join('') + '  the line, from the spec')
  console.log(bar(width))
  for (const check of rows) {
    const cells = runs.map((r) => `  ${MARK[r.verdicts[check.id].verdict] ?? '?  '}  `).join('')
    console.log(`  ${check.id.padEnd(34)}${cells}${check.line.slice(0, 140)}`)
  }

  // Label consistency: identical across the three runs, and across cases of the same company.
  const labelSets = runs.map((r) => labelsOf(r.scan))
  const labelsSame = new Set(labelSets).size === 1
  companyLabels[co.name] ??= []
  for (const r of runs) for (const a of r.scan.identity.agencies) companyLabels[co.name].push(a)

  // Pass/fail. One run failing fails the case.
  const failing = []
  for (const check of rows) {
    for (const r of runs) {
      const v = r.verdicts[check.id]
      if (v.verdict === 'FAIL' || v.verdict === 'SKIP') failing.push({ run: r.n, check, v })
    }
  }
  const compliantRuns = runs.filter((r) => r.compliant.length)
  const altRuns = runs.filter((r) => r.altPass)
  const everyRunHonest = !!c.alternative_pass && altRuns.length === runs.length
  const casePass = (failing.length === 0 && !compliantRuns.length && labelsSame) || everyRunHonest

  console.log(bar(width))
  console.log(`  ${casePass ? 'PASS' : 'FAIL'}`
    + (everyRunHonest ? '  — every run answered could_not_read with a way forward, which the spec calls an honest answer that passes' : ''))
  if (!casePass) {
    failedCases++
    const byCheck = new Map()
    for (const f of failing) {
      if (!byCheck.has(f.check.id)) byCheck.set(f.check.id, { check: f.check, runs: [] })
      byCheck.get(f.check.id).runs.push(f)
    }
    for (const [, g] of byCheck) {
      console.log(`\n    X ${g.check.id}   (run${g.runs.length > 1 ? 's' : ''} ${g.runs.map((r) => r.run).join(', ')})`)
      console.log(`      spec: ${g.check.line}`)
      for (const f of g.runs) console.log(`      run ${f.run}: ${f.v.detail}`)
    }
    for (const r of compliantRuns) console.log(`\n    X "compliant" appears in ${r.compliant.join(', ')} on run ${r.n} — the README fails the run for this`)
    if (!labelsSame) console.log(`\n    X the labels are not the identical string across the runs`)
  }
  console.log(`\n    labels        : ${labelsSame ? 'identical across all runs' : 'DIFFER ACROSS RUNS'}`)
  for (const r of runs) console.log(`      run ${r.n}: agencies ${JSON.stringify(r.scan.identity.agencies)}  subjects ${JSON.stringify(r.scan.identity.subjects)}`)
  const costs = runs.map((r) => (r.call?.cost_usd == null ? null : Number(r.call.cost_usd)))
  const total = costs.reduce((a, b) => a + (b ?? 0), 0)
  console.log(`    cost of runs  : $${total.toFixed(4)}  (${costs.map((x) => x == null ? '?' : '$' + x.toFixed(4)).join(' + ')})`)
  console.log(`    model         : ${runs[0].scan.model}`)
  console.log(`    searches      : ${runs.map((r) => r.scan.searches ?? '?').join(', ')}   (billed, from the ledger row)`)
  console.log(`    cited sources : ${runs.map((r) => r.scan.cited_sources ?? '?').join(', ')}   (distinct URLs in the answer)`)
  console.log(`    json parsed   : ${runs.map((r) => r.scan.json_parsed).join(', ')}`)

  // Reported, never failed.
  const reported = (c.reported ?? [])
  if (reported.length) {
    console.log(`\n    reported, not failed (the spec does not make these musts):`)
    for (const check of reported) {
      const cells = runs.map((r) => MARK[r.verdicts[check.id].verdict] ?? '?').join(' ')
      console.log(`      ${cells}  ${check.id.padEnd(30)} ${check.line.slice(0, 118)}`)
    }
  }
  const softs = rows.filter((ch) => runs.some((r) => (r.verdicts[ch.id].soft ?? []).length))
  if (softs.length) {
    console.log(`\n    items that MENTION a must-not subject without claiming it is absent (read, not failed):`)
    for (const ch of softs) for (const r of runs)
      for (const sft of r.verdicts[ch.id].soft ?? [])
        console.log(`      run ${r.n}  ${ch.id}: "${sft.text.slice(0, 190)}"`)
  }
  const nears = rows.filter((ch) => runs.some((r) => r.verdicts[ch.id].verdict === 'NEAR'))
  if (nears.length) {
    console.log(`\n    near misses the spec names (reported, not failed):`)
    for (const ch of nears) for (const r of runs)
      if (r.verdicts[ch.id].verdict === 'NEAR') console.log(`      run ${r.n}  ${ch.id}: ${r.verdicts[ch.id].detail}`)
  }
}

console.log('\n' + bar(112))
console.log(`  ${results.length - failedCases} of ${results.length} case(s) passed.`)
for (const [name, labels] of Object.entries(companyLabels)) {
  const uniq = [...new Set(labels)]
  console.log(`  ${name}: ${uniq.length} distinct agency label(s) across every run — ${uniq.map((l) => `"${l}"`).join(', ')}`)
}
const allRuns = results.flatMap((r) => r.runs)
const allCost = allRuns.reduce((a, r) => a + Number(r.call?.cost_usd ?? 0), 0)
console.log(`  total cost of this command: $${allCost.toFixed(4)} over ${allRuns.length} call(s)`)
console.log(`  full JSON of every run: ${RUNS}/<case>/<timestamp>-<n>.json`)
console.log(bar(112) + '\n')
process.exit(failedCases ? 1 : 0)

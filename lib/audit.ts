/**
 * THE AUDIT'S INPUT — everything one agency's audit reads, assembled once. Audits Run 1.
 *
 * *** AN AUDIT DOES NOT READ FILES. IT READS READINGS. *** `docs/HANDOFF-AUDITS.md` §1. Every fact
 * below is already in the database because a document was read and, where it says so, because a
 * person confirmed it. Nothing here opens a PDF and nothing here calls a model.
 *
 * ---------------------------------------------------------------------------
 * THE TWO SENTENCES THAT DECIDE THE WHOLE SHAPE
 *
 * **"The reading found"** and **"a person confirmed"** are different claims and the block never
 * merges them. A gap is what one reading of one document said; a confirmed fact is what somebody
 * agreed to. An audit that presents the first as established fact is the "omniscient status tracker"
 * `CLAUDE.md` §6 names as a removed anti-pattern.
 *
 * **Every other document the company holds is listed, with four fields only** — title, kind, status,
 * date. Not its gaps, not its conditions, not its summary. It is there so the model can say *"there
 * is no scrubber log among the five documents on file"* instead of enumerating from nothing
 * (`CLAUDE.md` §3.3). Giving it their contents would invite findings about documents this agency's
 * audit has no business reading.
 *
 * ---------------------------------------------------------------------------
 * EVERY QUERY IS ORDERED, for the reason `lib/companyContext.ts` carries at length: the block is
 * rendered into a prompt and hashed, and an unordered query makes the same database state produce a
 * different hash on the next call — which turns the tripwire into noise nobody reads.
 *
 * NO IMPORTS BUT `node:crypto` AND THE COMPANY CONTEXT, so a plain Node script can load this with
 * type stripping. `scripts/run-golden-audit.js` is that script.
 */
import { createHash } from 'node:crypto'
import { readableScans } from './readableScan.ts'
import { mustRows } from './mustRead.ts'
import { buildCompanyContext, siteWhere, type CompanyContextParts } from './companyContext.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export interface AuditGap {
  title: string; description: string | null; fix: string | null
  citation: string | null; basis: string
}
export interface AuditCondition { condition_ref: string | null; title: string; evidence_expected: string | null }
export interface AuditDeadline { title: string; due_on: string | null; recurs: boolean }
export interface AuditExpected { title: string; why: string | null; basis: string | null }

/** A document whose current reading carries this agency — the audit's evidence. */
export interface AuditDocument {
  /**
   * *** THE MODEL IS NEVER SHOWN A UUID — Audits Run 1c. ***
   * D1, D2, D3 in the order the block lists them. Run 1b had the model copy raw ids and one came
   * back as …-84c0-… for a document whose id is …-84d0-…: a single character wrong, which would
   * have attached a finding to no document at all. A handle is short enough to copy correctly and
   * checkable against a list of twelve, so a wrong one is caught instead of guessed at.
   */
  handle: string
  document_id: string
  title: string
  file_name: string
  kind: string | null
  status: string | null
  display_status: string | null
  doc_date: string | null
  doc_date_kind: string | null
  significant_date: string | null
  significant_date_kind: string | null
  /** The reading these findings and conditions came from, so a row can point at it. */
  scan_id: string | null
  site: string | null
  summary: string | null
  open_gaps: AuditGap[]
  conditions: AuditCondition[]
  deadlines: AuditDeadline[]
  expected_missing: AuditExpected[]
  /** `company_facts` a person confirmed that came from THIS document. */
  confirmed_facts: Array<{ key: string; value: string; as_of: string | null; site: string | null }>
  /**
   * `fact_proposals` still at status `proposed` that came from THIS document — what the reading
   * SAID and nobody has agreed to. Separate from `confirmed_facts` because the difference between
   * them is the whole point: one is a fact, the other is a question.
   */
  proposed_facts: Array<{ key: string; value: string; quote: string | null
                          locator: string | null; as_of: string | null }>
}

/** Everything else on file: four fields, so "nothing among the five" is answerable. */
export interface AuditOtherDocument {
  /** D7, D8 — the same series as the documents above, continuing. */
  handle: string
  document_id: string
  title: string
  kind: string | null
  status: string | null
  significant_date: string | null
}

export interface AuditInput {
  today: string
  agency: string
  company: CompanyContextParts['company']
  confirmed: CompanyContextParts['confirmed']
  labels: CompanyContextParts['labels']
  keys: string[]
  documents: AuditDocument[]
  other_documents: AuditOtherDocument[]
  /** handle -> document_id, for every document the block names. The caller resolves with this. */
  handles: Record<string, string>
}

export interface BuiltAuditInput {
  input: AuditInput
  block: string
  sha256: string
}

/** The agency labels a company's readings actually carry, ordered. A caller asks for one of these
 *  rather than a guess at what an agency is called: the label is the company's own vocabulary
 *  (`company_labels`), not a canonical list, and the canonical one does not exist yet. */
export async function auditAgenciesFor(db: Db, companyId: string): Promise<string[]> {
  // *** A FAILED READ IS NOT "NO AGENCIES" — fix list A11, root R2, Job E4. ***
  // This fed two sentences, both of them statements: a specific audit refused with "None of your
  // documents name an agency yet" (`app/api/audit-runs/route.ts`), and an "audit everything" run
  // FINISHED, done, with "No document on file names an agency yet, so there is nothing to audit."
  // (`lib/auditRun.ts`). A company holding eleven labels was told it had none, and the second case
  // wrote a finished run saying so.
  return mustRows<{ label: string }>('your agencies', await db.from('company_labels')
    .select('label').eq('company_id', companyId).eq('kind', 'agency').order('label'))
    .map((l) => l.label)
}

export async function buildAuditInput(
  db: Db, companyId: string, agencyLabel: string, opts: { today?: string } = {},
): Promise<BuiltAuditInput> {
  const today = opts.today ?? new Date().toISOString().slice(0, 10)

  // The company context, for the parts an audit is entitled to: who they are, what a person has
  // confirmed, and the vocabulary in use. NOT `declared` — the switches are the obligation engine's
  // input and the requirement table is not back yet, so an audit reasoning from them would be
  // reasoning about requirements it cannot see (`HANDOFF-AUDITS.md` §4: parked until then).
  const ctx = await buildCompanyContext(db, companyId, {
    parts: ['company', 'confirmed', 'labels', 'keys'],
  })

  // *** A3: A FAILED DOCUMENT LIST BECAME "THIS COMPANY HOLDS NOTHING" *** (root R2, Job E4).
  // Unchecked, this told the model "(none — this company holds no document any reading attributed
  // to this agency)" and "(nothing else on file)" — then the section was saved DONE and the result
  // emailed. The whole value of an audit is that it reasons against the artifacts; with none it is
  // §3.3's known-bad mode, and the answer reads exactly as confidently.
  const all = mustRows<Record<string, unknown>>('your documents', await db.from('document_index_v')
    .select('document_id, title, file_name, kind, agencies, site_name, doc_date, doc_date_kind, '
          + 'significant_date, significant_date_kind, scan_status, display_status, summary, scan_id')
    .eq('company_id', companyId).order('title').order('document_id'))
  // *** `'*'` MEANS EVERY DOCUMENT — Audits Run 4b. ***
  // A template audit is measured against a checklist that spans regulators (case 13's own form
  // covers the air permit, the forklifts and the extinguishers), so scoping it to one agency label
  // would answer half its lines "nothing on file" about documents sitting in the next group. The
  // sentinel is a label no reading can produce: `company_labels` holds what a model wrote, and no
  // model writes a bare asterisk.
  const everything = agencyLabel === '*'
  const carries = (row: Record<string, unknown>) => {
    if (everything) return true
    const a = row.agencies
    const list: string[] = Array.isArray(a) ? (a as string[]) : []
    return list.includes(agencyLabel)
  }
  const mine = all.filter(carries)
  const others = all.filter((r) => !carries(r))

  // *** THE READING THAT COULD READ IT, NOT THE CURRENT ONE — `DECISIONS.md` §185a (A3e). ***
  //
  // This was `mine.map((r) => r.scan_id)`, the CURRENT scan. Migration 076 put a document whose
  // latest reading failed back into its agency's audit — it keeps its agencies now — and this line
  // then handed the model the document's TITLE AND NOTHING ELSE, because the failed scan has no
  // gaps, no conditions and no dates. Proved on staging before the change
  // (`scripts/calendar-a3b-failed-reread.mjs`):
  //
  //     the audit's input names 1 document(s) for Oregon DEQ
  //     the permit: conditions=0 dates=0 gaps=0 summary=yes
  //     what the model would be handed about it:
  //        --- D1 — Standard Air Contaminant Discharge Permit No. 26-2841-ST-01
  //
  // "Nothing on file" had become "the permit is on file and says nothing about this", which is the
  // more convincing wrong answer of the two and exactly the failure §3.3 is about: the model
  // reasoning against an artifact that is not there.
  const readable = await readableScans(db, companyId, mine.map((r) => r.document_id as string))
  const scanIds = [...new Set(mine
    .map((r) => readable.get(r.document_id as string)?.scanId)
    .filter((x): x is string => !!x))].sort()
  const docIds = mine.map((r) => r.document_id as string).sort()

  // Four reads for the whole set rather than four per document: a loop of queries is a loop whose
  // order depends on the loop, and the point of this function is that the same state renders the
  // same block.
  const [gaps, conds, dls, scans, props] = await Promise.all([
    scanIds.length
      ? db.from('document_gaps')
          .select('document_id, title, description, fix, citation, basis, ordinal')
          .in('scan_id', scanIds).eq('status', 'open').order('document_id').order('ordinal')
      : { data: [], error: null },
    scanIds.length
      ? db.from('document_conditions')
          .select('document_id, condition_ref, title, evidence_expected, ordinal')
          .in('scan_id', scanIds).order('document_id').order('ordinal')
      : { data: [], error: null },
    scanIds.length
      ? db.from('document_deadlines')
          .select('document_id, title, due_on, recurs')
          .in('scan_id', scanIds).order('document_id').order('title')
      : { data: [], error: null },
    scanIds.length
      ? db.from('document_scans').select('document_id, expected_missing').in('id', scanIds).order('document_id')
      : { data: [], error: null },
    // *** WHAT THE READING PROPOSED AND NOBODY HAS CONFIRMED — Audits Run 1b. ***
    // `status = 'proposed'` only. An `accepted` one is already in `confirmed_facts` by way of
    // `company_facts`, and a `rejected` one is a proposal a person has answered NO to — putting
    // either here would show the same fact twice or resurrect a refused one.
    // Ordered, like every other context query: `prompt_sha256` is a tripwire and an unordered
    // read makes it fire on nothing.
    docIds.length
      ? db.from('fact_proposals')
          .select('document_id, switch_key, proposed_value, quote, locator, as_of')
          .eq('company_id', companyId).eq('status', 'proposed').in('document_id', docIds)
          .order('document_id').order('switch_key').order('proposed_value')
      : { data: [], error: null },
  ])

  const by = <T extends { document_id: string }>(rows: unknown) => {
    const m = new Map<string, T[]>()
    for (const r of (rows ?? []) as T[]) {
      if (!m.has(r.document_id)) m.set(r.document_id, [])
      m.get(r.document_id)!.push(r)
    }
    return m
  }
  // *** A4: ALL FIVE EVIDENCE READS, CHECKED *** (root R2, Job E4). None of them looked at
  // `error`. A failed GAPS read printed "WHAT THE READING FOUND WRONG WITH IT: nothing" about a
  // document whose findings were sitting in the table — which is the sentence this whole fix list
  // started from (Calendar A3d) in a second place. The other four dropped silently: a permit's
  // conditions, its dates, what the reading expected and did not see, and the facts waiting to be
  // confirmed. Each absence reads, in the block, as a document that does not say those things.
  const gapsBy = by<Record<string, never> & { document_id: string }>(
    mustRows("your documents' findings", gaps))
  const condsBy = by<Record<string, never> & { document_id: string }>(
    mustRows("your documents' conditions", conds))
  const dlsBy = by<Record<string, never> & { document_id: string }>(
    mustRows("your documents' dates", dls))
  const propsBy = by<Record<string, never> & { document_id: string }>(
    mustRows('the facts waiting to be confirmed', props))
  const expectedBy = new Map<string, AuditExpected[]>()
  for (const s of mustRows<Record<string, unknown>>('what the readings expected to see', scans)) {
    const raw = Array.isArray(s.expected_missing) ? (s.expected_missing as Array<Record<string, unknown>>) : []
    expectedBy.set(s.document_id as string, raw.map((e) => ({
      title: String(e.title ?? ''), why: (e.why as string) ?? null, basis: (e.basis as string) ?? null,
    })).sort((a, b) => a.title.localeCompare(b.title)))
  }

  // One series across both lists, in the order the block prints them, so D7 means one thing.
  let handleN = 0
  const nextHandle = () => `D${++handleN}`

  const documents: AuditDocument[] = mine.map((r) => {
    const id = r.document_id as string
    return {
      handle: nextHandle(),
      document_id: id,
      title: (r.title as string) ?? (r.file_name as string) ?? '',
      file_name: (r.file_name as string) ?? '',
      kind: (r.kind as string) ?? null,
      status: (r.scan_status as string) ?? null,
      display_status: (r.display_status as string) ?? null,
      doc_date: (r.doc_date as string) ?? null,
      doc_date_kind: (r.doc_date_kind as string) ?? null,
      significant_date: (r.significant_date as string) ?? null,
      significant_date_kind: (r.significant_date_kind as string) ?? null,
      // The reading these words came from, so a finding made from them points at the right one.
      scan_id: readable.get(r.document_id as string)?.scanId ?? null,
      site: (r.site_name as string) ?? null,
      summary: (r.summary as string) ?? null,
      open_gaps: ((gapsBy.get(id) ?? []) as unknown as Array<Record<string, unknown>>).map((g) => ({
        title: String(g.title ?? ''), description: (g.description as string) ?? null,
        fix: (g.fix as string) ?? null, citation: (g.citation as string) ?? null,
        basis: (g.basis as string) ?? 'read',
      })),
      conditions: ((condsBy.get(id) ?? []) as unknown as Array<Record<string, unknown>>).map((c) => ({
        condition_ref: (c.condition_ref as string) ?? null, title: String(c.title ?? ''),
        evidence_expected: (c.evidence_expected as string) ?? null,
      })),
      deadlines: ((dlsBy.get(id) ?? []) as unknown as Array<Record<string, unknown>>).map((d) => ({
        title: String(d.title ?? ''), due_on: (d.due_on as string) ?? null, recurs: !!d.recurs,
      })),
      expected_missing: expectedBy.get(id) ?? [],
      confirmed_facts: ctx.parts.confirmed
        .filter((f) => f.sourceDocumentId === id)
        .map((f) => ({ key: f.key, value: f.value, as_of: f.asOf, site: f.siteName })),
      proposed_facts: ((propsBy.get(id) ?? []) as unknown as Array<Record<string, unknown>>).map((f) => ({
        key: String(f.switch_key ?? ''), value: String(f.proposed_value ?? ''),
        quote: (f.quote as string) ?? null, locator: (f.locator as string) ?? null,
        as_of: (f.as_of as string) ?? null,
      })),
    }
  })

  const other_documents: AuditOtherDocument[] = others.map((r) => ({
    handle: nextHandle(),
    document_id: r.document_id as string,
    title: (r.title as string) ?? (r.file_name as string) ?? '',
    kind: (r.kind as string) ?? null,
    status: (r.scan_status as string) ?? null,
    significant_date: (r.significant_date as string) ?? null,
  }))

  const input: AuditInput = {
    today, agency: agencyLabel,
    company: ctx.parts.company, confirmed: ctx.parts.confirmed,
    labels: ctx.parts.labels, keys: ctx.parts.keys,
    documents, other_documents,
    handles: Object.fromEntries([...documents, ...other_documents].map((d) => [d.handle, d.document_id])),
  }
  const block = renderAuditInput(input)
  return { input, block, sha256: createHash('sha256').update(block).digest('hex') }
}

/**
 * THE BLOCK. The wording carries the provenance, not a legend at the top: each heading says whether
 * what follows was READ IN a document or CONFIRMED BY A PERSON, because a model shown two lists
 * under one heading will weigh them the same.
 */
export function renderAuditInput(i: AuditInput): string {
  const out: string[] = []
  const c = i.company
  const industry = c.industrySlug
    ? (c.industryWords ? `${c.industryWords} (recorded as ${c.industrySlug})` : c.industrySlug)
    : 'not recorded'

  out.push(`TODAY IS ${i.today}. Every "passed" or "expiring" judgement is against that date.`)
  out.push('')
  if (i.agency === '*') {
    out.push('THIS AUDIT IS AGAINST A CHECKLIST, NOT ONE AGENCY.')
    out.push('Every document this company holds is below, because a checklist can ask about any of')
    out.push('them. Answer only the lines you are given.')
  } else {
    out.push(`THE AGENCY THIS AUDIT IS ABOUT: ${i.agency}`)
    out.push('Only this agency. Another regulator\'s documents are listed at the end as titles only and')
    out.push('are not yours to judge here.')
  }
  out.push('')
  out.push('WHO THIS COMPANY IS')
  out.push(`  Name: ${c.name || 'not recorded'}`)
  out.push(`  Industry: ${industry}`)
  out.push(`  Address: ${c.address || 'not recorded'}`)
  out.push('Their sites:')
  out.push(c.sites.length
    ? c.sites.map((s) => {
        // `siteWhere` from the company context, not a second copy of the join — the copy here was
        // where the duplicated city and state actually reached a prompt.
        const where = siteWhere(s)
        return `  - ${s.name}${where ? ` — ${where}` : ''}${s.primary ? ' (primary)' : ''}`
      }).join('\n')
    : '  (no sites recorded)')

  out.push('')
  out.push(i.agency === '*'
    ? `EVERY DOCUMENT ON FILE — ${i.documents.length}`
    : `DOCUMENTS ON FILE FOR ${i.agency.toUpperCase()} — ${i.documents.length}`)
  out.push('Each is named by a HANDLE — D1, D2 — and that handle is how you refer to it. Nothing else.')
  if (!i.documents.length) {
    out.push('  (none — this company holds no document any reading attributed to this agency)')
  }
  for (const d of i.documents) {
    out.push('')
    out.push(`  --- ${d.handle} — ${d.title}`)
    out.push(`      file: ${d.file_name}`)
    out.push(`      kind: ${d.kind ?? 'not judged'} · status: ${d.status ?? 'unknown'} · shown as: ${d.display_status ?? 'unknown'}`)
    out.push(`      the document's own date: ${d.doc_date ?? 'none stated'}${d.doc_date_kind ? ` (${d.doc_date_kind})` : ''}`)
    out.push(`      the date that matters: ${d.significant_date ?? 'none'}${d.significant_date_kind ? ` (${d.significant_date_kind})` : ''}`)
    if (d.site) out.push(`      site: ${d.site}`)
    if (d.summary) out.push(`      what the reading said it is: ${d.summary}`)

    out.push(d.open_gaps.length
      ? `      WHAT THE READING FOUND WRONG WITH IT (${d.open_gaps.length}) — these are already findings; carry them, do not re-find them:`
      : '      WHAT THE READING FOUND WRONG WITH IT: nothing')
    for (const g of d.open_gaps) {
      out.push(`        · ${g.title}${g.basis === 'inferred' ? '  [worked out from the document, not stated in it]' : ''}`)
      if (g.description) out.push(`            ${g.description}`)
      if (g.fix) out.push(`            what it needs: ${g.fix}`)
      if (g.citation) out.push(`            the rule: ${g.citation}`)
    }

    if (d.conditions.length) {
      out.push(`      WHAT THIS DOCUMENT OBLIGES THEM TO KEEP DOING (${d.conditions.length}), read out of the document itself:`)
      for (const cd of d.conditions) {
        out.push(`        · ${cd.condition_ref ? `${cd.condition_ref} — ` : ''}${cd.title}`)
        if (cd.evidence_expected) out.push(`            the evidence you would expect to see: ${cd.evidence_expected}`)
      }
    }

    if (d.deadlines.length) {
      out.push(`      DATES THIS DOCUMENT SETS (${d.deadlines.length}):`)
      for (const dl of d.deadlines) {
        out.push(`        · ${dl.title} — ${dl.due_on ?? 'no date stated'}${dl.recurs ? ' (recurring)' : ''}`)
      }
    }

    if (d.expected_missing.length) {
      out.push(`      WHAT THE READING SAID A COMPANY LIKE THIS USUALLY ALSO HOLDS (${d.expected_missing.length}) —`)
      out.push('        a suggestion from similar companies, NOT a checked requirement:')
      for (const e of d.expected_missing) {
        out.push(`        · ${e.title}${e.why ? ` — ${e.why}` : ''}`)
      }
    }

    // *** THE HEADING IS THE PROVENANCE. *** Same rule as the confirmed block above it: a model
    // shown two lists under one heading weighs them the same, so the heading says in words which
    // of the two this is rather than leaving it to a legend.
    if (d.proposed_facts.length) {
      out.push(`      WHAT THIS DOCUMENT SAYS, proposed by the reading, not confirmed by anyone`
             + ` (${d.proposed_facts.length}):`)
      for (const f of d.proposed_facts) {
        out.push(`        · ${f.key.replace(/_/g, ' ')}: ${f.value}${f.as_of ? `, as of ${f.as_of}` : ''}`)
        if (f.quote) out.push(`            it says: "${f.quote}"`)
        if (f.locator) out.push(`            where: ${f.locator}`)
      }
    }

    if (d.confirmed_facts.length) {
      out.push(`      FACTS FROM THIS DOCUMENT A PERSON HAS CONFIRMED (${d.confirmed_facts.length}):`)
      for (const f of d.confirmed_facts) {
        out.push(`        · ${f.key.replace(/_/g, ' ')}${f.site ? ` (${f.site})` : ''}: ${f.value}`
               + `${f.as_of ? `, as of ${f.as_of}` : ''}`)
      }
    }
  }

  out.push('')
  out.push('FACTS THIS COMPANY HAS CONFIRMED, ACROSS EVERYTHING THEY HOLD')
  out.push('Each was read in a document and then confirmed by a person. Nothing a reading merely')
  out.push('proposed is here — an unconfirmed proposal is a question, not a fact.')
  out.push(i.confirmed.length
    ? i.confirmed.map((f) => `  ${f.key.replace(/_/g, ' ')}${f.siteName ? ` (${f.siteName})` : ''}: ${f.value}`
        + `${f.asOf ? `, as of ${f.asOf}` : ''}${f.sourceDocumentTitle ? ` — from "${f.sourceDocumentTitle}"` : ''}`).join('\n')
    : '  (nothing confirmed yet)')

  out.push('')
  out.push(`EVERYTHING ELSE THIS COMPANY HOLDS — ${i.other_documents.length}, TITLES AND DATES ONLY`)
  out.push('Listed so you can say what is NOT among them. You have not been shown their contents and')
  out.push('must not describe what is in them.')
  out.push(i.other_documents.length
    ? i.other_documents.map((d) => `  - ${d.handle} — ${d.title} · ${d.kind ?? 'not judged'} · ${d.status ?? 'unknown'}`
        + `${d.significant_date ? ` · ${d.significant_date}` : ''}`).join('\n')
    : '  (nothing else on file)')

  out.push('')
  out.push('THE AGENCY AND SUBJECT WORDS THIS COMPANY ALREADY USES')
  out.push(`  agencies: ${i.labels.agencies.join(' · ') || '(none yet)'}`)
  out.push(`  subjects: ${i.labels.subjects.join(' · ') || '(none yet)'}`)

  return out.join('\n')
}

/**
 * ONE COMPANY CONTEXT — "who is this company", assembled once and read by every prompt.
 *
 * `docs/VISION-DOCUMENTS.md` "One company context", decided 27 September 2026:
 *
 *   "Everything a person confirms or corrects anywhere in the product is assembled by one
 *    function, the company context, and every prompt in the product reads that block and nothing
 *    else for 'who is this company'. Confirming a fact anywhere improves every answer everywhere,
 *    and there is one place to look when an answer seems to have forgotten something."
 *
 * ---------------------------------------------------------------------------
 * *** WHAT THIS COMMIT DOES NOT DO, AND THE RULE IS THE POINT. ***
 *
 * **No prompt gains anything it does not read today.** Each caller asks for the PARTS it already
 * reads and renders them where it rendered the same fields before, in the same words. The
 * function assembles more than any single prompt uses — the as-of date, the source document, the
 * site on a declared switch — and the extra is carried in `parts` and in `block` for the callers
 * that come later, behind their own switches, measured on their own runs.
 *
 * The reason is `DECISIONS.md` §113's discipline: a change you cannot turn off is a change you
 * cannot attribute. If this commit both centralised the context AND widened it, and the next
 * golden run moved, nothing would say which half moved it.
 *
 * ---------------------------------------------------------------------------
 * *** WHAT GOES IN, AND WHAT DELIBERATELY DOES NOT. ***
 *
 * IN — the settled record. What a person DECLARED (`company_switches`, answered directly), what a
 * person CONFIRMED from a document (`company_facts`, with the document and its as-of date), the
 * corrections they made to a reading, the labels and fact keys in use.
 *
 * OUT — anything the model concluded on its own. **Pending `fact_proposals` are excluded**: a
 * proposal is a question waiting for a person, and feeding it back as context would let the model
 * confirm its own guess on the next pass. The vision's words: "Pending proposals live in the
 * queue. The context is the settled record."
 *
 * ---------------------------------------------------------------------------
 * *** EVERY QUERY IS ORDERED, AND THAT IS NOT TIDINESS. ***
 *
 * `document_scans.prompt_sha256` exists to be a tripwire: a changed prompt should loudly
 * invalidate every stored expectation. An unordered query means the same database state renders a
 * DIFFERENT string on the next call, so the tripwire fires on nothing having changed and nobody
 * reads it any more. Documents Run 2 saw exactly that. `lib/documentScan.ts` carried this rule
 * first; it moves here with the queries.
 *
 * Two orderings are NEW here and they exist because migration 055 widened what a key can hold. A
 * key used to have one row; it can now have a company-wide row and one per site, so `order('key')`
 * is no longer a total order. Both lists get a second key (`entity_id`, then the site's name in
 * memory) or the same data would render in a different order run to run.
 *
 * ---------------------------------------------------------------------------
 * NO IMPORTS BUT `node:crypto`, for the reason `lib/gateContext.ts` has none at all: this module
 * is reached from `lib/documentScan.ts`, which plain Node loads with type stripping in
 * `scripts/run-golden-docs.js` and `scripts/scan-document.js`. A `@/lib/...` alias here would make
 * the golden runner unable to build the same context the route builds, which is the drift
 * `gateContext.ts`'s own header was written about.
 */
import { createHash } from 'node:crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

/** Which sections a caller wants. `block` and `sha256` are built from these and nothing else. */
export type CompanyContextPart =
  | 'company' | 'declared' | 'confirmed' | 'labels' | 'keys' | 'document'

export const ALL_PARTS: readonly CompanyContextPart[] =
  ['company', 'declared', 'confirmed', 'labels', 'keys', 'document'] as const

export interface ContextSite {
  id: string
  name: string
  address: string | null
  state: string | null
  county: string | null
  city: string | null
  primary: boolean
}

export interface ContextCompany {
  name: string
  /**
   * What `companies.industry` holds. `/api/signup` writes the value the dropdown supplied, and
   * that dropdown is `distinct requirement_templates.industries` — so this is the SLUG that
   * `agencies.industries` and `requirement_templates.industries` join on, not a description.
   */
  industrySlug: string | null
  /** The same slug as words, when the two differ. Null when the slug is already words. */
  industryWords: string | null
  address: string | null
  state: string | null
  sites: ContextSite[]
}

/** A fact a person answered directly. `company_switches` — what the obligation engine reads. */
export interface DeclaredFact {
  switchId: string
  label: string
  value: string
  scope: 'company' | 'site'
  entityId: string | null
  /** The site's name, for a site-scoped switch. Null for a company-wide one. */
  siteName: string | null
  /** `switches.question_plain` — the agreed wording of the question this answers. */
  question: string | null
  source: string | null
}

/** A fact read in a document and then confirmed by a person. `company_facts`. */
export interface ConfirmedFact {
  key: string
  value: string
  basis: string
  entityId: string | null
  siteName: string | null
  /** `company_facts.as_of` (migration 055) — the date the source says it was true. */
  asOf: string | null
  sourceDocumentTitle: string | null
}

export interface ContextDocument {
  documentId: string
  /** Newest per field, then by field name. What the person said the reading got wrong. */
  corrections: Array<{ field: string; value: string; reason: string | null }>
  /** Findings a person has already said are not problems, with their reasons. */
  dismissedGaps: Array<{ title: string; reason: string | null }>
}

export interface CompanyContextParts {
  company: ContextCompany
  declared: DeclaredFact[]
  confirmed: ConfirmedFact[]
  labels: { agencies: string[]; subjects: string[] }
  keys: string[]
  document: ContextDocument | null
}

export interface CompanyContext {
  parts: CompanyContextParts
  /** The rendered block, from the requested parts only. */
  block: string
  /** sha256 of `block`. Changes when the context changes, and not otherwise. */
  sha256: string
}

export interface BuildCompanyContextOptions {
  /** When given, the `document` part carries that document's corrections and dismissed gaps. */
  documentId?: string | null
  /** Which parts to assemble and render. Defaults to all of them. */
  parts?: readonly CompanyContextPart[]
}

const line = (xs: string[]) => (xs.length ? xs.map((x) => `  - ${x}`).join('\n') : '  (none yet)')

/** jsonb comes back as whatever was stored. A string stays a string; anything else is shown as
 *  JSON without the outer quotes, which is what `buildScanContext` did before this. */
function plainValue(v: unknown): string {
  if (typeof v === 'string') return v
  return JSON.stringify(v ?? '').replace(/^"|"$/g, '')
}

/** `chemical-manufacturing` -> `chemical manufacturing`. Null when that changes nothing. */
function wordsFor(slug: string | null): string | null {
  if (!slug) return null
  const words = slug.replace(/[-_]+/g, ' ').trim()
  return words && words !== slug ? words : null
}

export async function buildCompanyContext(
  db: Db,
  companyId: string,
  opts: BuildCompanyContextOptions = {},
): Promise<CompanyContext> {
  const want = new Set<CompanyContextPart>(opts.parts ?? ALL_PARTS)
  const documentId = opts.documentId ?? null

  // --- company and its sites -------------------------------------------------
  const { data: companyRow } = await db.from('companies')
    .select('name, industry, city, state').eq('id', companyId).maybeSingle()
  const { data: siteRows } = await db.from('entities')
    .select('id, name, address, state, county, city, is_primary')
    .eq('company_id', companyId).order('name')

  const sites: ContextSite[] = ((siteRows ?? []) as Array<Record<string, unknown>>).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    address: (s.address as string) ?? null,
    state: (s.state as string) ?? null,
    county: (s.county as string) ?? null,
    city: (s.city as string) ?? null,
    primary: !!s.is_primary,
  }))
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]))

  const slug = ((companyRow?.industry as string) ?? null) || null
  const company: ContextCompany = {
    name: (companyRow?.name as string) ?? '',
    industrySlug: slug,
    industryWords: wordsFor(slug),
    address: [companyRow?.city, companyRow?.state].filter(Boolean).join(', ') || null,
    state: (companyRow?.state as string) ?? null,
    sites,
  }

  // --- declared: company_switches, the answers a person gave -----------------
  //
  // THE SITE IS SELECTED, AND THAT IS THE DEFECT THIS FIXES. `lib/determinationGate.ts` read
  // `switch_id, value, source, switches(label)` and nothing else, so a two-site company's
  // site-scoped switches arrived as bare pairs — `Employees at this site = 1` and `= 6`, seven
  // such contradictions for the staging fixture, under a heading saying "treat these as settled".
  // `scope` and `entity_id` are what make the two lines different statements.
  let declared: DeclaredFact[] = []
  if (want.has('declared')) {
    const { data: rows } = await db.from('company_switches')
      .select('switch_id, value, scope, entity_id, source, switches(label, question_plain)')
      .eq('company_id', companyId).order('switch_id').order('entity_id', { nullsFirst: true })
    declared = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => {
      const sw = (r.switches ?? null) as { label?: string; question_plain?: string } | null
      const entityId = (r.entity_id as string) ?? null
      return {
        switchId: r.switch_id as string,
        label: sw?.label ?? (r.switch_id as string),
        value: plainValue(r.value),
        scope: (r.scope as 'company' | 'site') ?? 'company',
        entityId,
        siteName: entityId ? (siteNameById.get(entityId) ?? null) : null,
        question: sw?.question_plain ?? null,
        source: (r.source as string) ?? null,
      }
    }).sort((a, b) => a.switchId.localeCompare(b.switchId)
                   || (a.siteName ?? '').localeCompare(b.siteName ?? ''))
  }

  // --- confirmed: company_facts, read in a document and confirmed by a person --
  let confirmed: ConfirmedFact[] = []
  let confirmedKeys: string[] = []
  if (want.has('confirmed') || want.has('keys')) {
    const { data: rows } = await db.from('company_facts')
      .select('key, value, basis, entity_id, as_of, source_document_id')
      .eq('company_id', companyId).order('key').order('entity_id', { nullsFirst: true })
    const factRows = (rows ?? []) as Array<Record<string, unknown>>
    confirmedKeys = factRows.map((f) => f.key as string)

    // The source document's title, so a confirmed fact can say where it came from. One query for
    // all of them rather than one per fact, ordered so the map is built the same way every time.
    const docIds = [...new Set(factRows.map((f) => f.source_document_id as string).filter(Boolean))].sort()
    const titleById = new Map<string, string>()
    if (docIds.length) {
      const { data: docRows } = await db.from('document_index_v')
        .select('document_id, title, file_name').in('document_id', docIds).order('document_id')
      for (const d of (docRows ?? []) as Array<Record<string, unknown>>) {
        titleById.set(d.document_id as string,
          ((d.title as string) || (d.file_name as string) || '') as string)
      }
    }

    confirmed = factRows.map((f) => {
      const entityId = (f.entity_id as string) ?? null
      const srcId = (f.source_document_id as string) ?? null
      return {
        key: f.key as string,
        value: plainValue(f.value),
        basis: (f.basis as string) ?? 'read',
        entityId,
        siteName: entityId ? (siteNameById.get(entityId) ?? null) : null,
        asOf: (f.as_of as string) ?? null,
        sourceDocumentTitle: srcId ? (titleById.get(srcId) ?? null) : null,
      }
    }).sort((a, b) => a.key.localeCompare(b.key)
                   || (a.siteName ?? '').localeCompare(b.siteName ?? ''))
  }

  // --- labels ----------------------------------------------------------------
  let labels: { agencies: string[]; subjects: string[] } = { agencies: [], subjects: [] }
  if (want.has('labels')) {
    const { data: rows } = await db.from('company_labels')
      .select('kind, label').eq('company_id', companyId).order('kind').order('label')
    const all = (rows ?? []) as Array<{ kind: string; label: string }>
    labels = {
      agencies: all.filter((l) => l.kind === 'agency').map((l) => l.label),
      subjects: all.filter((l) => l.kind === 'subject').map((l) => l.label),
    }
  }

  // --- keys in use -----------------------------------------------------------
  //
  // Both statuses count: an accepted key is the name that stuck, a still-pending one is a name
  // already put in front of the person. Rejected and withdrawn are left out — those are names we
  // should not encourage. This is the list, not the values: a PENDING PROPOSAL'S VALUE never
  // enters the context, only the fact that its name is in circulation.
  let keys: string[] = []
  if (want.has('keys')) {
    const { data: usedKeys } = await db.from('fact_proposals')
      .select('switch_key').eq('company_id', companyId)
      .in('status', ['proposed', 'accepted']).order('switch_key')
    keys = [...new Set([
      ...((usedKeys ?? []) as Array<{ switch_key: string }>).map((k) => k.switch_key),
      ...confirmedKeys,
    ].filter(Boolean))].sort()
  }

  // --- this document, when one is named --------------------------------------
  let document: ContextDocument | null = null
  if (want.has('document') && documentId) {
    const { data: corrRows } = await db.from('document_corrections')
      .select('field, new_value, reason, created_at, id')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
    const seen = new Set<string>()
    const corrections: ContextDocument['corrections'] = []
    for (const c of (corrRows ?? []) as Array<Record<string, unknown>>) {
      const field = c.field as string
      if (seen.has(field)) continue          // the list is newest-first, so the first wins
      seen.add(field)
      const v = Array.isArray(c.new_value) ? c.new_value.join(', ') : String(c.new_value ?? '')
      if (v) corrections.push({ field, value: v, reason: (c.reason as string) ?? null })
    }
    corrections.sort((a, b) => a.field.localeCompare(b.field))

    const { data: dismissed } = await db.from('document_gaps')
      .select('title, dismissed_reason')
      .eq('document_id', documentId).eq('status', 'dismissed').order('title')

    document = {
      documentId,
      corrections,
      dismissedGaps: ((dismissed ?? []) as Array<Record<string, unknown>>).map((g) => ({
        title: g.title as string,
        reason: (g.dismissed_reason as string) ?? null,
      })),
    }
  }

  const parts: CompanyContextParts = { company, declared, confirmed, labels, keys, document }
  const block = renderCompanyContext(parts, want)
  return { parts, block, sha256: createHash('sha256').update(block).digest('hex') }
}

/**
 * THE BLOCK. Plain words, and it says which facts a person DECLARED and which they CONFIRMED FROM
 * A DOCUMENT — because those are different kinds of certainty and a model told only "here are
 * some facts" cannot weigh them.
 *
 * Only the requested parts are rendered, so `sha256` is a fingerprint of what this caller
 * actually sent and not of everything the function could have assembled.
 */
export function renderCompanyContext(
  parts: CompanyContextParts,
  want: Set<CompanyContextPart> | readonly CompanyContextPart[] = ALL_PARTS,
): string {
  const w = want instanceof Set ? want : new Set(want)
  const out: string[] = []

  if (w.has('company')) {
    const c = parts.company
    const industry = c.industrySlug
      ? (c.industryWords ? `${c.industryWords} (recorded as ${c.industrySlug})` : c.industrySlug)
      : 'not recorded'
    out.push('WHO THIS COMPANY IS')
    out.push(`  Name: ${c.name || 'not recorded'}`)
    out.push(`  Industry: ${industry}`)
    out.push(`  Address: ${c.address || 'not recorded'}`)
    out.push(`  State: ${c.state || 'not recorded'}`)
    out.push('Their sites:')
    out.push(c.sites.length
      ? c.sites.map((s) => {
          const where = [s.address, s.city, s.county ? `${s.county} County` : null, s.state]
            .filter(Boolean).join(', ')
          return `  - ${s.name}${where ? ` — ${where}` : ''}${s.primary ? ' (primary)' : ''}`
        }).join('\n')
      : '  (no sites recorded)')
  }

  if (w.has('declared')) {
    out.push('')
    out.push('WHAT A PERSON HAS DECLARED ABOUT THIS COMPANY')
    out.push('These were answered directly by somebody at the company. Take them as settled.')
    out.push(parts.declared.length
      ? parts.declared.map((d) => {
          // The site is part of WHAT THE FACT IS ABOUT, not of where it came from. Without it a
          // two-site company contributes two bare values for one label and they read as a
          // contradiction.
          const subject = d.siteName ? `${d.label} (${d.siteName})` : d.label
          return `  ${subject} = ${d.value}   [${d.source ?? 'source not recorded'}]`
        }).join('\n')
      : '  (nothing declared yet — this is not the same as "nothing applies")')
  }

  if (w.has('confirmed')) {
    out.push('')
    out.push('WHAT A PERSON HAS CONFIRMED FROM A DOCUMENT')
    out.push('Each of these was read in the named document and then confirmed by a person.')
    out.push(parts.confirmed.length
      ? parts.confirmed.map((f) => {
          const subject = f.siteName
            ? `${f.key.replace(/_/g, ' ')} (${f.siteName})`
            : f.key.replace(/_/g, ' ')
          const from = f.sourceDocumentTitle ? ` — from "${f.sourceDocumentTitle}"` : ''
          const when = f.asOf ? `, as of ${f.asOf}` : ''
          const how = f.basis === 'inferred' ? ' (inferred, not stated outright)' : ''
          return `  ${subject}: ${f.value}${from}${when}${how}`
        }).join('\n')
      : '  (nothing confirmed yet)')
  }

  if (w.has('labels')) {
    out.push('')
    out.push('LABELS ALREADY IN USE FOR THIS COMPANY')
    out.push('Agencies:')
    out.push(line(parts.labels.agencies))
    out.push('Subjects:')
    out.push(line(parts.labels.subjects))
  }

  if (w.has('keys')) {
    out.push('')
    out.push('FACT KEYS ALREADY IN USE FOR THIS COMPANY')
    out.push(line(parts.keys))
  }

  if (w.has('document') && parts.document) {
    const d = parts.document
    if (d.corrections.length) {
      out.push('')
      out.push('WHAT THE PERSON WHO OWNS THIS DOCUMENT HAS TOLD US ABOUT IT')
      out.push('They are right and we are not; take these as given.')
      out.push(d.corrections.map((c) =>
        `  - the ${c.field} is ${c.value}${c.reason ? ` — they said: ${c.reason}` : ''}`).join('\n'))
    }
    if (d.dismissedGaps.length) {
      out.push('')
      out.push('FINDINGS ON THIS DOCUMENT SOMEBODY HAS ALREADY SAID ARE NOT PROBLEMS')
      out.push(d.dismissedGaps.map((g) =>
        `  - ${g.title}${g.reason ? ` — they said: ${g.reason}` : ''}`).join('\n'))
    }
  }

  return out.join('\n')
}

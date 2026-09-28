/**
 * THE QUESTION LINES — how pending proposals become questions a person is asked. Task 0, commit 2.
 *
 * *** IT IS A FILE BECAUSE THE NUMBER APPEARS TWICE. ***
 * The page draws the lines; the sidebar badge counts them. A badge that counted something else —
 * keys, or raw proposals — would promise a different amount of work from the one on screen, and the
 * old queue's own comment names that failure: *"'3 of 24 questions' and '3 questions from 69
 * readings' are different promises about how long this will take."* One function, two callers, and
 * the badge cannot drift from the page.
 *
 * No imports, no database, no `@/` alias: pure, so it is testable without either and loadable by a
 * plain Node script. Same reason `lib/gateContext.ts` has none.
 *
 * ---------------------------------------------------------------------------
 * THE THREE KINDS OF LINE, AND WHY A DOCUMENT IS ONE OF THEM
 *
 * `disagreement` — the product does not know the answer. Its own sources differ, or they differ from
 *   something already settled for that key and that site. **Always lifted out of its document
 *   group**, because burying the one question on the page that genuinely cannot be answered inside
 *   "the permit says 6 things about you" is the page hiding its own uncertainty.
 *
 * `document` — every fact one reading of one document proposed, as ONE question. Run 6 made the
 *   queue one line per KEY, which fixed the right thing (one address asked about five times) and
 *   left a second: seven documents produced 69 proposals and therefore dozens of lines, each
 *   demanding its own decision. A person who has just uploaded a permit wants to be asked about the
 *   permit once. Confirm still settles a KEY — the grouping is how the question is put, not what
 *   the answer writes.
 *
 * `single` — a key whose sources span more than one document, or none. It cannot sit under either
 *   document without the page claiming it came from one of them.
 */

/** Mirrors what `/api/to-confirm` GET returns per source. Only the fields the grouping reads. */
export interface QueueSourceLike {
  proposal_id: string
  value: string
  created_at: string
  document_id: string | null
  entity_id: string | null
  from: { kind: 'document' | 'conversation'; title: string }
}

export interface QueueKeyLike {
  key: string
  is_switch: boolean
  agree: boolean
  /** The value Confirm would settle on. Null when the sources disagree. */
  value: string | null
  sources: QueueSourceLike[]
}

export type QuestionLine<K extends QueueKeyLike> =
  | { kind: 'disagreement'; id: string; rank: number; k: K; settled: string | null }
  | { kind: 'document'; id: string; rank: number; documentId: string; title: string; keys: K[] }
  | { kind: 'single'; id: string; rank: number; k: K }

/**
 * THE KEYS WORTH ASKING FIRST, IN ORDER, AND THE ORDER IS NOT A PREFERENCE.
 *
 * `has_employees`, `employee_count` and `site_employee_count` gate 53 requirements between them, and
 * `hazwaste_generator_category` 19 (`docs/SWITCH-DETERMINATION.md` §1). A queue that asks about
 * forklifts before it knows whether anybody works here is ranked by what arrived rather than by what
 * it unblocks.
 */
export const PRIORITY_KEYS: readonly string[] = [
  'has_employees', 'employee_count', 'site_employee_count',
  'air_permit_required', 'hazwaste_generator_category', 'hazardous_chemicals_present',
] as const

const RANK_DISAGREEMENT = 0
const RANK_PRIORITY_BASE = 10
const RANK_OTHER_SWITCH = 100
const RANK_NOT_A_SWITCH = 200

export function rankOfKey(k: QueueKeyLike): number {
  const i = PRIORITY_KEYS.indexOf(k.key)
  if (i >= 0) return RANK_PRIORITY_BASE + i
  return k.is_switch ? RANK_OTHER_SWITCH : RANK_NOT_A_SWITCH
}

/**
 * Build the question lines, ordered.
 *
 * @param keys      what `/api/to-confirm` returned, one entry per pending key
 * @param settledFor what is already settled for a key at a site, or null. Reads `company_facts` and
 *                   `company_switches` in the caller — this function touches no database.
 */
export function questionLines<K extends QueueKeyLike>(
  keys: readonly K[],
  settledFor: (key: string, entityId: string | null) => string | null,
): Array<QuestionLine<K>> {
  const out: Array<QuestionLine<K>> = []
  const byDocument = new Map<string, { title: string; keys: K[] }>()

  for (const k of keys) {
    const entityId = k.sources[0]?.entity_id ?? null
    const settled = settledFor(k.key, entityId)
    // Compared case- and space-insensitively, the same way `/api/to-confirm` compares two sources:
    // "42 employees" and "42 Employees" are not a disagreement for a person to arbitrate.
    const differs =
      settled !== null && k.value !== null &&
      settled.trim().toLowerCase() !== k.value.trim().toLowerCase()

    if (!k.agree || differs) {
      out.push({ kind: 'disagreement', id: `dis:${k.key}`, rank: RANK_DISAGREEMENT, k, settled })
      continue
    }

    const docIds = [...new Set(k.sources.map((s) => s.document_id))]
    if (docIds.length === 1 && docIds[0]) {
      const id = docIds[0]
      if (!byDocument.has(id)) byDocument.set(id, { title: k.sources[0].from.title, keys: [] })
      byDocument.get(id)!.keys.push(k)
    } else {
      out.push({ kind: 'single', id: `one:${k.key}`, rank: rankOfKey(k), k })
    }
  }

  for (const [documentId, g] of byDocument) {
    // THE GROUP TAKES THE RANK OF ITS HIGHEST FACT. A permit that states the generator category is
    // worth opening before a handbook that states the dress code, and a group sits only as far down
    // the queue as its most useful question.
    out.push({
      kind: 'document', id: `doc:${documentId}`, documentId, title: g.title, keys: g.keys,
      rank: Math.min(...g.keys.map(rankOfKey)),
    })
  }

  const oldest = (k: K) => k.sources.reduce(
    (m, s) => (s.created_at < m ? s.created_at : m), k.sources[0]?.created_at ?? '')

  return out.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    // Among things that are not switches, oldest proposal first — a question that has been waiting a
    // fortnight should not sit under one raised this morning.
    if (a.rank >= RANK_NOT_A_SWITCH && b.rank >= RANK_NOT_A_SWITCH) {
      const oa = a.kind === 'document' ? Math.min(...a.keys.map((x) => Date.parse(oldest(x)))) : Date.parse(oldest(a.k))
      const ob = b.kind === 'document' ? Math.min(...b.keys.map((x) => Date.parse(oldest(x)))) : Date.parse(oldest(b.k))
      if (oa !== ob) return oa - ob
    }
    const na = a.kind === 'document' ? a.title : a.k.key
    const nb = b.kind === 'document' ? b.title : b.k.key
    // `id` last, so two lines tying on everything else keep a stable order between loads rather
    // than reshuffling under somebody mid-answer.
    return na.localeCompare(nb) || a.id.localeCompare(b.id)
  })
}

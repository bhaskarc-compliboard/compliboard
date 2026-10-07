/**
 * NO TABLE GIVES A PERSON TRUNCATE, TRIGGER, REFERENCES OR MAINTAIN — migrations 067 and 068.
 *
 * TRUNCATE is not subject to row-level security: a role holding it can empty a whole table, every
 * company's rows. Migration 067 took the three away from `anon` and `authenticated` and changed
 * postgres's default privileges so a new table does not grant them — but supabase_admin's defaults on
 * public still would, for anything IT creates, and `postgres` may not change those. So this reads
 * `docs/SCHEMA.md`, which `npm run db:migrate` regenerates from the live catalog on every migration
 * (`scripts/schema-doc.js`, has_table_privilege since HR Step 3b-1), and fails if any table shows one of
 * the three for either role.
 *
 * SCHEMA_MD_PATH points it at another file — which is how it was shown to fail (a copy with one such
 * grant added by hand).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// MAINTAIN since migration 068: the Postgres 17 right (LOCK TABLE among it) the schema doc could not see.
const FORBIDDEN = ['TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN']

/** Every grant line in SCHEMA.md: { table, role, privs }. */
export function grantLines(md: string): Array<{ table: string; role: string; privs: string[] }> {
  const out: Array<{ table: string; role: string; privs: string[] }> = []
  let table: string | null = null
  for (const line of md.split('\n')) {
    const h = line.match(/^### `([a-z_0-9]+)`\s*$/)
    if (h) { table = h[1]; continue }
    const g = line.match(/^- `(anon|authenticated|service_role)` — (.+)$/)
    if (g && table) out.push({ table, role: g[1], privs: g[2].includes('nothing') ? [] : g[2].split(',').map((s) => s.trim()) })
  }
  return out
}

describe('no table gives anon or authenticated TRUNCATE, TRIGGER, REFERENCES or MAINTAIN (migrations 067, 068)', () => {
  const path = process.env.SCHEMA_MD_PATH ?? 'docs/SCHEMA.md'
  const lines = grantLines(readFileSync(path, 'utf8'))

  test('the guard can see grants at all — or a pass would mean nothing', () => {
    const tables = new Set(lines.map((l) => l.table))
    assert.ok(tables.size >= 40, `only ${tables.size} tables with grant lines in ${path}`)
    // service_role still holds all three, by design: the parser must be able to see the words it looks for.
    assert.ok(lines.some((l) => l.role === 'service_role' && l.privs.includes('TRUNCATE')),
      'no service_role TRUNCATE seen — the parser cannot see the words it is guarding against')
    assert.ok(lines.some((l) => l.role === 'authenticated' && l.privs.includes('SELECT')), 'no authenticated SELECT seen')
    // MAINTAIN must be in the document at all, or a guard against it is blind (it was, until 068).
    assert.ok(lines.some((l) => l.role === 'service_role' && l.privs.includes('MAINTAIN')),
      'no service_role MAINTAIN seen — scripts/schema-doc.js is not asking about MAINTAIN')
  })

  test('anon and authenticated hold none of the four on any table', () => {
    const bad = lines.filter((l) => l.role !== 'service_role' && l.privs.some((p) => FORBIDDEN.includes(p)))
      .map((l) => `${l.table}: ${l.role} — ${l.privs.filter((p) => FORBIDDEN.includes(p)).join(', ')}`)
    assert.deepEqual(bad, [], `${path} shows:\n  ${bad.join('\n  ')}`)
  })
})

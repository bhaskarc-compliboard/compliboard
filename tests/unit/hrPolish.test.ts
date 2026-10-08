/**
 * HR STEP 11a — POLISH, BEHIND THE PREVIEW SWITCH: the Dates tab hidden, the Ask tab's paperclip gone, "Choose where it
 * applies" for a handbook whose site was removed. No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setHandbookSite, ONLY_CURRENT_MOVES } from '../../lib/handbookSave.ts'
import { siteRemovedLede, CHOOSE_WHERE } from '../../lib/handbooks.ts'

const page = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')

describe('the tabs and the Ask tab (owner, Step 11a)', () => {
  test('three tabs: Ask a question, Conversations, Handbooks — no Dates tab, and its data is not loaded', () => {
    const tabs = page.slice(page.indexOf('<Tabs active={tab}'), page.indexOf('right={', page.indexOf('<Tabs active={tab}')))
    assert.deepEqual([...tabs.matchAll(/key: '(\w+)'/g)].map((m) => m[1]), ['ask', 'conversations', 'handbooks'])
    assert.ok(!page.includes(".from('calendar_events')"), 'nothing reads the calendar for the Dates tab')
  })
  test('the paperclip is gone from the Ask tab; "Add a handbook" stays, and the attach control always has a handler', () => {
    assert.ok(!page.includes('Attach a file and ask about it'))
    assert.match(page, /<AttachControl label="Add a handbook" onClick=\{\(\) => pickFile\(null\)\}/)
    assert.match(page, /function AttachControl\(\{ label, onClick, disabled \}: \{ label: string; onClick: \(\) => void; disabled\?: boolean \}\)/)
  })
})

describe('"Choose where it applies" (Step 11a)', () => {
  test('the words: the action, and the lede (proposed)', () => {
    assert.equal(CHOOSE_WHERE, 'Choose where it applies')
    assert.equal(siteRemovedLede('Harbor'), 'Harbor. Its site was removed. Which site does it cover now?')
  })
  /** A stand-in database: handbooks by id, the version chain, one site; records the update. */
  function fake() {
    const rows: Record<string, { id: string; version_of: string | null; is_current: boolean }> = {
      h3: { id: 'h3', version_of: 'h2', is_current: true }, h2: { id: 'h2', version_of: 'h1', is_current: false },
      h1: { id: 'h1', version_of: null, is_current: false }, other: { id: 'other', version_of: null, is_current: true } }
    let updated: { values: Record<string, unknown>; ids: string[] } | null = null
    const from = (t: string) => {
      const f: Record<string, unknown> = {}
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = (k: string, v: unknown) => { f[k] = v; return q }
      q.in = (_k: string, v: string[]) => { if (updated) updated.ids = v; return q }
      q.update = (v: Record<string, unknown>) => { updated = { values: v, ids: [] }; return q }
      q.maybeSingle = () => Promise.resolve({ data: t === 'entities' ? (f.id === 'site-1' ? { id: 'site-1' } : null) : rows[f.id as string] ?? null })
      q.then = (res: (v: unknown) => void) => res({ data: (updated?.ids ?? []).map((id) => ({ id })), error: null })
      return q
    }
    return { db: { from } as never, get updated() { return updated } }
  }
  test('Every site: scope company, no site, on the handbook AND its older versions, down the chain', async () => {
    const f = fake()
    const r = await setHandbookSite(f.db, 'co', { id: 'h3', scope: 'company', entity_id: 'ignored' })
    assert.equal(r.status, 200)
    assert.deepEqual(f.updated?.ids, ['h3', 'h2', 'h1'])
    assert.deepEqual(f.updated?.values, { scope: 'company', entity_id: null })
  })
  test('a site: only this company\'s (404 otherwise); a site needs its id; an unknown handbook is a 404', async () => {
    assert.equal((await setHandbookSite(fake().db, 'co', { id: 'h3', scope: 'site', entity_id: 'site-1' })).status, 200)
    assert.equal((await setHandbookSite(fake().db, 'co', { id: 'h3', scope: 'site', entity_id: 'not-ours' })).status, 404)
    assert.equal((await setHandbookSite(fake().db, 'co', { id: 'h3', scope: 'site' })).status, 400)
    assert.equal((await setHandbookSite(fake().db, 'co', { id: 'nope', scope: 'company' })).status, 404)
  })
  test('only the CURRENT version: an older one is refused (400, plain words) and nothing is written', async () => {
    const f = fake()
    const r = await setHandbookSite(f.db, 'co', { id: 'h2', scope: 'company' })
    assert.equal(r.status, 400)
    assert.equal(r.json.error, ONLY_CURRENT_MOVES)
    assert.equal(f.updated, null, 'no update was made')
  })
  test('the drawer offers the action only on the current version whose site was removed', () => {
    assert.match(page, /\(allHandbooks\.find\(\(x\) => x\.id === drawer\.id\) \?\? drawer\)\.is_current && siteRemoved\(/)
    // the one place the action is drawn
    assert.equal(page.split('{CHOOSE_WHERE}').length - 1, 1)
  })
  test('the route: as the person (no preview switch since the go-live); the page shows the action only for a removed site', () => {
    const route = readFileSync('app/api/handbooks/route.ts', 'utf8')
    const patch = route.slice(route.indexOf('export async function PATCH'), route.indexOf('export async function DELETE'))
    assert.ok(!/hrPreview/.test(patch) && patch.indexOf('requireCompany(request)') > 0)
    assert.match(patch, /setHandbookSite\(db, companyId, await request\.json\(\)\)/)
    assert.match(page, /const siteRemoved = \(h: HandbookRow\) => h\.scope === 'site' && !sites\.some\(\(s\) => s\.id === h\.entity_id\)/)
  })
})

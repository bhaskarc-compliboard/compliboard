/**
 * WHO MAY RUN A NIGHTLY JOB — `lib/cronSecret.ts`, Workspace Stage 4 Part 3 (the cron release).
 *
 * Vercel Cron calls with GET and `Authorization: Bearer <CRON_SECRET>`; a person runs a job by hand with
 * POST and `x-cron-secret`. Until this release only the second door existed and every scheduled call was
 * GET → 405. The live proof (each job run on staging through both doors) is in `DECISIONS.md` §162.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cronVerdict, sameSecret, MANUAL_HEADER, VERCEL_HEADER } from '../../lib/cronSecret.ts'

const SECRET = 'a-long-enough-secret-0123456789'
const headers = (h: Record<string, string>) => (name: string) => h[name.toLowerCase()] ?? null

describe('the two doors', () => {
  test('GET with the right bearer runs — Vercel Cron', () => {
    assert.equal(cronVerdict('GET', headers({ authorization: `Bearer ${SECRET}` }), SECRET), 'ok')
  })
  test('GET with no bearer, a wrong one, or the bare secret without "Bearer " is refused', () => {
    assert.equal(cronVerdict('GET', headers({}), SECRET), 'refused')
    assert.equal(cronVerdict('GET', headers({ authorization: 'Bearer wrong' }), SECRET), 'refused')
    assert.equal(cronVerdict('GET', headers({ authorization: `Bearer ${SECRET}x` }), SECRET), 'refused')
    assert.equal(cronVerdict('GET', headers({ authorization: SECRET }), SECRET), 'refused')
    assert.equal(cronVerdict('GET', headers({ authorization: `bearer ${SECRET}` }), SECRET), 'refused')
  })
  test('POST with x-cron-secret still runs — a person, by hand', () => {
    assert.equal(cronVerdict('POST', headers({ 'x-cron-secret': SECRET }), SECRET), 'ok')
    assert.equal(cronVerdict('POST', headers({ 'x-cron-secret': 'wrong' }), SECRET), 'refused')
    assert.equal(cronVerdict('POST', headers({}), SECRET), 'refused')
  })
  test('each door takes only its own header', () => {
    assert.equal(cronVerdict('GET', headers({ 'x-cron-secret': SECRET }), SECRET), 'refused')
    assert.equal(cronVerdict('POST', headers({ authorization: `Bearer ${SECRET}` }), SECRET), 'refused')
  })
  test('any other method is refused', () => {
    assert.equal(cronVerdict('PUT', headers({ authorization: `Bearer ${SECRET}`, 'x-cron-secret': SECRET }), SECRET), 'refused')
  })
  test('CRON_SECRET unset refuses both doors — even a request that sends an empty secret', () => {
    for (const s of [undefined, '']) {
      assert.equal(cronVerdict('GET', headers({ authorization: 'Bearer ' }), s), 'unset')
      assert.equal(cronVerdict('POST', headers({ 'x-cron-secret': '' }), s), 'unset')
    }
  })
  test('the header names are the ones Vercel and the runbooks use', () => {
    assert.equal(VERCEL_HEADER, 'authorization')
    assert.equal(MANUAL_HEADER, 'x-cron-secret')
  })
  test('the comparison refuses a different length without comparing bytes, and is exact otherwise', () => {
    assert.equal(sameSecret('abc', 'abcd'), false)
    assert.equal(sameSecret('abd', 'abc'), false)
    assert.equal(sameSecret('abc', 'abc'), true)
  })
})

describe('the routes use the rule, and every job answers GET', () => {
  test('jobAuth applies cronVerdict and refuses with 404', () => {
    const src = readFileSync('lib/jobAuth.ts', 'utf8')
    assert.match(src, /cronVerdict\(request\.method, \(n\) => request\.headers\.get\(n\), process\.env\.CRON_SECRET\)/)
    assert.match(src, /\{ status: 404 \}/)
    assert.ok(!/status: 401/.test(src))
  })
  for (const job of ['summarise', 'delete', 'scan-documents', 'audit-sections']) {
    test(`app/api/jobs/${job} — GET runs POST`, () => {
      const src = readFileSync(`app/api/jobs/${job}/route.ts`, 'utf8')
      assert.match(src, /export async function GET\(request: NextRequest\) \{\s*return POST\(request\)\s*\}/)
      assert.match(src, /export async function POST\(request: NextRequest\) \{\s*const auth = requireCronSecret\(request\)/)
    })
  }
})

describe('two runs at once', () => {
  test('the deleter counts what its own delete removed, not what it counted first', () => {
    const src = readFileSync('app/api/jobs/delete/route.ts', 'utf8')
    assert.match(src, /\.from\('turns'\)\.delete\(\)\.eq\('topic_id', id\)\.select\('id'\)/)
    assert.ok(!/count: 'exact', head: true/.test(src))
  })
  test('the audit sweep releases only the sections it claimed', () => {
    const src = readFileSync('app/api/jobs/audit-sections/route.ts', 'utf8')
    assert.match(src, /\.in\('id', queue\.map\(\(s\) => s\.id\)\)\.eq\('status', 'queued'\)\.eq\('claimed_at', nowIso\)/)
    assert.ok(!/\.eq\('company_id', companyId\)\.eq\('status', 'queued'\)\.not\('claimed_at', 'is', null\)/.test(src))
  })
})

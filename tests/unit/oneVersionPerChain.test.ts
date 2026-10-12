/**
 * *** ONE VERSION OF A HANDBOOK ANSWERS A QUESTION, AND IS CHECKED *** — E10, N5 and N6.
 *
 * E9 item 4 measured N5 and the independent read traced N6
 * (`docs/reports/jobE-independent-review.md` §1). The shipped code:
 *
 *   - `lib/hrAnswer.ts:136` used every current row whose text is saved and whose status is `read`
 *     **or `reading`**, and `lib/handbookRead.ts:213` saves the text BEFORE the status reaches
 *     `read` ("TEXT FIRST … so an answer may use it before the sections exist", §183). So for the
 *     minutes a new version is being read, the model got the same handbook twice under one name —
 *     once in full and once half-extracted — and could quote the superseded one. That is N5.
 *   - `lib/handbookRead.ts` retired only `row.version_of`, the IMMEDIATE parent. Three ways in
 *     (A, B, C — set out in `lib/handbooks.ts` above `ancestorsOf`) then leave two versions of one
 *     handbook current for good, both used for answers and both checked every night, with nothing
 *     on the page explaining it. That is N6.
 *
 * Two rules hold it, and both are tested here: a successful read retires EVERY older version in its
 * chain, and whatever is current, ONE version per chain is used — the newest that can be used.
 * The second is what holds when the first one's write fails, which it is allowed to do.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ancestorsOf, chainKey, newestPerChain, type VersionLink } from '../../lib/handbooks.ts'

interface Row extends VersionLink { id: string; version_of: string | null; created_at: string; status: string; text: string | null }

const row = (id: string, version_of: string | null, status: string, day: string, text: string | null = 'words'): Row =>
  ({ id, version_of, status, created_at: `2026-10-${day}T09:00:00Z`, text })

/** What `lib/hrAnswer.ts` asks of a row: read in full beats half read, and no text is unusable. */
const forAnswers = (h: Row) => (!h.text ? 0 : h.status === 'read' ? 2 : h.status === 'reading' ? 1 : 0)

describe('the chain, walked whole', () => {
  test('ancestorsOf climbs every link, not one', () => {
    const v0 = row('v0', null, 'read', '01'), v1 = row('v1', 'v0', 'read', '02')
    const v2 = row('v2', 'v1', 'could_not_read', '03', null), v3 = row('v3', 'v2', 'read', '04')
    assert.deepEqual(ancestorsOf(v3, [v0, v1, v2, v3]).map((h) => h.id), ['v2', 'v1', 'v0'])
    assert.deepEqual(ancestorsOf(v0, [v0, v1, v2, v3]).map((h) => h.id), [])
  })

  test('every row of one chain answers to one key, and a separate handbook does not', () => {
    const all = [row('v0', null, 'read', '01'), row('v1', 'v0', 'read', '02'), row('other', null, 'read', '02')]
    assert.equal(chainKey(all[1], all), 'v0')
    assert.equal(chainKey(all[0], all), 'v0')
    assert.equal(chainKey(all[2], all), 'other')
  })

  test('a link to a row that is not there (deleted, or not loaded) stops the walk instead of throwing', () => {
    const orphan = row('v2', 'gone', 'read', '03')
    assert.deepEqual(ancestorsOf(orphan, [orphan]).map((h) => h.id), [])
    assert.equal(chainKey(orphan, [orphan]), 'v2')
  })

  test('a cycle cannot hang it', () => {
    const a = row('a', 'b', 'read', '01'), b = row('b', 'a', 'read', '02')
    assert.deepEqual(ancestorsOf(a, [a, b]).map((h) => h.id), ['b'])
  })
})

describe('*** N5: the window while a new version is being read ***', () => {
  // v1 read in full; v2 uploaded over it and half-extracted, so it has text and status 'reading'.
  const v1 = row('v1', null, 'read', '01')
  const v2 = row('v2', 'v1', 'reading', '09')
  const all = [v1, v2]

  test('the shipped rule used BOTH: the same handbook twice, one of them half read', () => {
    const shipped = all.filter((h) => h.text && (h.status === 'read' || h.status === 'reading'))
    assert.deepEqual(shipped.map((h) => h.id), ['v1', 'v2'],
      'this is what `lib/hrAnswer.ts:136` did, and it is the defect')
  })

  test('*** one version is used, and it is the one that has been read in full ***', () => {
    assert.deepEqual(newestPerChain(all, all, forAnswers).map((h) => h.id), ['v1'],
      'the half-extracted newer version must not displace the version in use while it is read — '
      + 'which is exactly what the page already says: "in use while the new version is read".')
  })

  test('and when the new version lands, it is the one that is used', () => {
    const landed = [v1, { ...v2, status: 'read' }]
    assert.deepEqual(newestPerChain(landed, landed, forAnswers).map((h) => h.id), ['v2'])
  })

  test('a FIRST handbook still answers while it is being read — §183 is not lost', () => {
    const only = [row('v1', null, 'reading', '09')]
    assert.deepEqual(newestPerChain(only, only, forAnswers).map((h) => h.id), ['v1'],
      'a chain with no fully-read version falls back to the one being read; that is the feature '
      + '`lib/handbookRead.ts`\'s "TEXT FIRST" exists for.')
  })

  test('a chain whose every version is unreadable contributes nothing, so the refusal still runs', () => {
    const none = [row('v1', null, 'could_not_read', '01', null), row('v2', 'v1', 'uploaded', '09', null)]
    assert.deepEqual(newestPerChain(none, none, forAnswers), [])
  })
})

describe('*** N6: the three ways a chain forks, and one version used in each ***', () => {
  test('A. v2 unreadable, v3 added from v2 — v1 no longer answers', () => {
    // H4 working: v1 and v2 are both current. v3 is added from v2's drawer and read.
    const v1 = row('v1', null, 'read', '01')
    const v2 = row('v2', 'v1', 'could_not_read', '02', null)
    const v3 = row('v3', 'v2', 'read', '03')
    const all = [v1, v2, v3]
    // The retire step: every OLDER version in the chain, not only the parent.
    assert.deepEqual(ancestorsOf(v3, all).map((h) => h.id), ['v2', 'v1'],
      'the shipped code retired v2 only, and v1 stayed current for ever')
    // And if that write fails, both are still current — and only v3 is used.
    assert.deepEqual(newestPerChain([v1, v3], all, forAnswers).map((h) => h.id), ['v3'])
  })

  test('B. v3 added from v1 — v2 does not answer, so nothing says "could not be read" about the one it quotes', () => {
    const v1 = row('v1', null, 'read', '01')
    const v2 = row('v2', 'v1', 'could_not_read', '02', null)
    const v3 = row('v3', 'v1', 'read', '03')
    const all = [v1, v2, v3]
    assert.equal(chainKey(v2, all), 'v1')
    assert.equal(chainKey(v3, all), 'v1')
    assert.deepEqual(newestPerChain([v2, v3], all, forAnswers).map((h) => h.id), ['v3'])
  })

  test('C. v1 deleted during the read brings v0 back — and v0 stops answering once v2 lands', () => {
    // `lib/handbookDelete.ts` relinks v2 to v0 and makes v0 current again.
    const v0 = row('v0', null, 'read', '01')
    const v2 = row('v2', 'v0', 'reading', '09')
    const all = [v0, v2]
    assert.deepEqual(newestPerChain(all, all, forAnswers).map((h) => h.id), ['v0'],
      'while v2 is read, the readable v0 answers')
    const landed = [v0, { ...v2, status: 'read' }]
    assert.deepEqual(ancestorsOf(landed[1], landed).map((h) => h.id), ['v0'])
    assert.deepEqual(newestPerChain(landed, landed, forAnswers).map((h) => h.id), ['v2'])
  })

  test('two DIFFERENT handbooks are two chains and both are used — this must not collapse them', () => {
    const a = row('a1', null, 'read', '01'), b = row('b1', null, 'read', '02')
    assert.deepEqual(newestPerChain([a, b], [a, b], forAnswers).map((h) => h.id), ['a1', 'b1'])
  })

  test('the order the caller asked for is kept', () => {
    const a = row('a1', null, 'read', '05'), b = row('b1', null, 'read', '01')
    assert.deepEqual(newestPerChain([b, a], [b, a], forAnswers).map((h) => h.id), ['b1', 'a1'])
  })
})

describe('the three readers all use it', () => {
  test('the answer picks one version per chain', () => {
    const hr = readFileSync('lib/hrAnswer.ts', 'utf8')
    assert.match(hr, /newestPerChain/)
    assert.ok(!/const withText = current\.filter\(\(h\) => h\.extracted_text && \(h\.status === 'read' \|\| h\.status === 'reading'\)\)/.test(hr),
      'the old rule, which used every current row with text, is gone')
  })

  test('the nightly check queues one version per chain', () => {
    assert.match(readFileSync('lib/handbookCheck.ts', 'utf8'), /newestPerChain/)
  })

  test('a successful read retires every older version in the chain', () => {
    const read = readFileSync('lib/handbookRead.ts', 'utf8')
    assert.match(read, /ancestorsOf/)
    assert.ok(!/\.update\(\{ is_current: false \}\)\.eq\('id', row\.version_of\)/.test(read),
      'the shipped code retired only the immediate parent')
  })

  test('"Add a newer version" is offered on the newest row only', () => {
    const page = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
    assert.match(page, /supersededBy\(drawer, allHandbooks\)/)
  })
})

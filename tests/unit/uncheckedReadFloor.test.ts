/**
 * *** HOW MANY READS STILL DISCARD THEIR ERROR, AND IT MAY ONLY GO DOWN ***
 * — the owner's instruction in E10's brief, Part 5.
 *
 * > "For the other 86 unchecked reads, no one-by-one fixes. Add a guard test that counts them and
 * > may only go down, like the test floor."
 *
 * **What it counts.** `const { data } = await db…` — a read whose `error` is never destructured, so
 * a failure arrives as `null` or `[]` and is indistinguishable from an empty answer. That is root
 * **R2** of `docs/FIX-LIST-FAILURES.md`, the root behind more than half of Job E: a failed read
 * coming back as zero rows, and the zero then printed to a customer as a fact about their own
 * compliance. The pattern is the one `tests/unit/failedReads.test.ts` already uses to prove a
 * particular file clean, used here over every tree instead.
 *
 * **Why a ceiling and not a ban.** Most of these are harmless today — a count behind a number the
 * screen does not assert anything about, a label that falls back to a dash. Job E fixed the ones
 * that reached a customer, one at a time, with a test each; converting the rest in a sweep would be
 * eighty-odd changes nobody has a reason for, and a change nobody has a reason for is how a
 * regression gets reviewed and approved. So the rule is the one the test floor uses in the other
 * direction: **it may fall, and it may never rise.** A new unchecked read fails this test, and
 * fixing an old one is free.
 *
 * *** AND IT IS PROVED AGAINST A PRESENCE. *** `CLAUDE.md` §9a: a check that cannot see anything
 * looks exactly like a check that found nothing. The last test writes a file with one unchecked read
 * in it and fails if the scan walks past it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * *** THE CEILING, 12 OCTOBER 2026. ***
 *
 * 89 when E10 opened. 84 after E10's Part 5 took the five the independent read named — the ones
 * that fall through to a WRITE — plus `lib/handbookSave.ts`'s three (which decide which site a
 * handbook applies to), the zip's two (which make a file an inspector reads say every document is
 * gone), the retry route's two, and O1's.
 *
 * Lowering it is the point. Raising it is a deliberate edit and needs the reason written here.
 */
const CEILING = 84

/** The trees whose reads reach a customer: routes, pages, libraries and components. */
const ROOTS = ['app', 'lib', 'components']

/** Generated, and not ours to change. */
const NOT_OURS = ['lib/database.types.ts']

/**
 * The same pattern `tests/unit/failedReads.test.ts` uses, so one file proved clean there and the
 * count here cannot disagree. `supabase` is in it because a page's own client reads the same way.
 */
const UNCHECKED = /const \{ data(?:: \w+)? \} = (?:await )?(?:db|admin|supabaseAdmin|supabase)\b[^\n]*/g

/** The code without comments, so a comment QUOTING the pattern is never counted as one. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (name === 'node_modules' || name === '.next') return []
    return statSync(p).isDirectory() ? walk(p) : (/\.tsx?$/.test(p) ? [p] : [])
  })
}

function countIn(files: string[]): { total: number; byFile: Array<[string, number]> } {
  const byFile: Array<[string, number]> = []
  let total = 0
  for (const f of files) {
    if (NOT_OURS.includes(f)) continue
    const n = [...code(readFileSync(f, 'utf8')).matchAll(UNCHECKED)].length
    if (n) { byFile.push([f, n]); total += n }
  }
  byFile.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return { total, byFile }
}

describe('*** the unchecked-read ceiling: it may fall, and it may never rise ***', () => {
  const { total, byFile } = countIn(ROOTS.flatMap(walk))

  test(`${total} reads still discard their error, against a ceiling of ${CEILING}`, () => {
    assert.ok(total <= CEILING,
      `${total} reads discard their error, and the ceiling is ${CEILING}. A read written as\n`
      + '  const { data } = await db.from(…)\n'
      + 'cannot tell a failure from an empty answer, which is root R2 — the root behind more than\n'
      + 'half of Job E. Write it as `const { data, error } = …` and act on the error, or use\n'
      + '`mustRow`/`mustRows`/`mustCount` from lib/mustRead.ts, which throw with a sentence naming\n'
      + 'what could not be read. The worst offenders today:\n'
      + byFile.slice(0, 8).map(([f, n]) => `  ${String(n).padStart(3)}  ${f}`).join('\n'))
  })

  test('and when it falls, the ceiling comes down with it', () => {
    assert.ok(total >= CEILING - 12,
      `only ${total} are left against a ceiling of ${CEILING}. That is good news and the ceiling `
      + 'should be lowered to it, in the same commit as whatever fixed them — a ceiling well above '
      + 'the truth stops being a guard.')
  })

  test('nothing new has been added to the files Job E and E10 proved clean', () => {
    // Every file the two jobs went through read by read. A new unchecked read in one of these is a
    // regression in a file somebody has already justified line by line.
    for (const f of ['lib/companyContext.ts', 'lib/obligationWriter.ts', 'lib/summaryReport.ts',
                     'lib/auditRun.ts', 'lib/documentBatch.ts', 'lib/handbookCheck.ts',
                     'lib/topicList.ts', 'lib/conversation.ts', 'lib/retention.ts',
                     'app/api/jobs/scan-documents/route.ts', 'app/api/jobs/audit-sections/route.ts',
                     'app/api/jobs/summarise/route.ts', 'app/api/jobs/delete/route.ts',
                     'app/api/obligations/route.ts', 'app/api/audits/index/route.ts']) {
      const found = [...code(readFileSync(f, 'utf8')).matchAll(UNCHECKED)].map((m) => m[0].trim())
      assert.deepEqual(found, [], `${f} has an unchecked read again`)
    }
  })

  test('*** the scan FAILS on an unchecked read that is really there ***', () => {
    const planted = join('lib', 'uncheckedReadFloor-probe.ts')
    writeFileSync(planted,
      'export async function probe(db: { from: (t: string) => never }) {\n'
      + "  const { data } = await db.from('documents')\n"
      + '  return data\n}\n')
    try {
      const after = countIn(ROOTS.flatMap(walk))
      assert.equal(after.total, total + 1,
        'the scan did not see a read that was definitely there, so its silence means nothing')
      assert.ok(after.byFile.some(([f]) => f === planted))
    } finally {
      rmSync(planted, { force: true })
    }
  })

  test('and it does NOT count a read that handles its error, or a comment quoting one', () => {
    const planted = join('lib', 'uncheckedReadFloor-probe2.ts')
    writeFileSync(planted,
      '// const { data } = await db.from(\'documents\')  <- a comment, not a read\n'
      + 'export async function probe(db: { from: (t: string) => never }) {\n'
      + "  const { data, error } = await db.from('documents')\n"
      + '  if (error) throw error\n  return data\n}\n')
    try {
      assert.equal(countIn(ROOTS.flatMap(walk)).total, total,
        'a checked read, and a comment quoting the pattern, must not count')
    } finally {
      rmSync(planted, { force: true })
    }
  })
})

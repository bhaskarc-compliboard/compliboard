/**
 * *** NO SECOND COPY OF A MODULE MAY SIT BESIDE THE REAL ONE. *** Job E, after the fact.
 *
 * An editor and a sync client both resolve a write conflict by keeping BOTH files and giving the
 * loser a number: `lib/auditRun 5.ts` next to `lib/auditRun.ts`, `app/audits/page 2.tsx` next to
 * `page.tsx`. Job E's own stash-and-restore cycles — check out the old code, prove the failure,
 * restore — made forty of them, and `git add` took them all.
 *
 * **Nothing imports them and Next does not route them, so no test and no build went red.** That is
 * the whole problem. What they do instead is lie to a reader:
 *
 *   - seven of the forty were STALE — `lib/auditRun 2.ts` was 1398 lines against the live 1546,
 *     a snapshot of the code from *before* A1, A2, A6, A8 and O3 were fixed. A grep for a pattern
 *     this job removed found it, in a file that ships nothing. `DECISIONS.md` §189c: a test or a
 *     reading not taken from the shipping code is not evidence.
 *   - `tests/unit/appShell.test.ts`, `clientImports.test.ts` and `fonts.test.ts` walk `app/`,
 *     `components/` and `lib/` with `readdirSync`. They were sweeping the copies. A stale copy that
 *     passes a check the live file would fail is a green run that proves nothing — and
 *     `clientImports.test.ts` is the one that keeps `SUPABASE_SERVICE_ROLE_KEY` out of the browser.
 *   - `tsc` typechecks them, so 20,150 lines of dead code were being compiled on every run.
 *
 * It was caught by hand once mid-job (`71963a9`, two files) and the sweep did not cover the three
 * commits that came after it, which added thirty-nine more. **So it is a check, not vigilance.**
 *
 * *** AND IT IS PROVED AGAINST A PRESENT COPY FIRST. *** `CLAUDE.md` §9a: a check that cannot see
 * anything looks exactly like a check that found nothing. The third test plants a real file named
 * the real way, in a real scanned directory, and fails if the scan walks past it.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync, existsSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A space, a number, then the extension, at the end of the name — `route 2.ts`, `auditRun 5.ts`,
 * `AppLayout 2.tsx`, `.tmp-r7-cdp 2.mjs`. It deliberately does not match a name where the number
 * is part of the thing, like `source-serif-4`, because there is no extension straight after it.
 */
const STRAY = / \d+\.[A-Za-z0-9]+$/

/** Every tree whose files are compiled, swept by another test, or read as the shipping code. */
const ROOTS = ['app', 'components', 'lib', 'tests', 'scripts', 'prompts', 'config', 'supabase', 'hooks']

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return []
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const strays = (paths: string[]) => paths.filter((p) => STRAY.test(p))

describe('*** no numbered second copy of a file is anywhere in the tree ***', () => {
  test('the pattern knows a copy from a name that merely ends in a number', () => {
    for (const yes of ['lib/auditRun 5.ts', 'app/api/signup/route 2.ts', 'components/AppLayout 2.tsx',
                       'scripts/.tmp-r7-cdp 2.mjs', 'app/audits/page 3.tsx']) {
      assert.ok(STRAY.test(yes), `should be flagged: ${yes}`)
    }
    for (const no of ['app/fonts/source-serif-4/OFL.txt', 'supabase/migrations/079_a_gap.sql',
                      'lib/auditRun.ts', 'tests/unit/answerShape.test.ts', 'docs/FIX-LIST-FAILURES.md',
                      'shots/calendar-jobB-board13-print.png', 'scripts/measure-layout.mjs']) {
      assert.ok(!STRAY.test(no), `should NOT be flagged: ${no}`)
    }
  })

  test('not one is on disk, tracked or not', () => {
    const found = strays(ROOTS.flatMap(walk))
    assert.deepEqual(found, [],
      'a second copy of a module is dead code that tsc compiles, that the three directory-walking '
      + 'tests sweep as if it shipped, and that a later grep will read as the live code. '
      + 'Delete it — the real file is the one without the number.')
  })

  test('the scan FAILS on a copy that is really there', () => {
    const planted = join('lib', 'noStrayCopies-probe 2.ts')
    writeFileSync(planted, 'export const planted = true\n')
    try {
      // `includes`, not an exact list: if the tree already holds a stray, that is the test above's
      // failure to report. This one must say only "the walk is blind", and must not claim that
      // when the walk is working and the tree is dirty.
      assert.ok(strays(ROOTS.flatMap(walk)).includes(planted),
        'the walk did not see a file that was definitely there, so its silence means nothing')
    } finally {
      rmSync(planted, { force: true })
    }
    assert.ok(!strays(ROOTS.flatMap(walk)).includes(planted), 'the probe was not cleaned up')
  })
})

/**
 * A REPORT OPENED FROM THE ADDRESS CAN BE CLOSED — the 20 October hotfix.
 *
 * *** WHAT WENT WRONG, SO THE TEST IS ABOUT THAT AND NOT ABOUT THE PATCH. ***
 *
 * `/audits` derived its open drawer straight from the address: `openRun = params.get('run')`.
 * Closing called `setParam('run', null)`, which removed the only parameter and asked the router for
 * the bare `/audits`. **On a production build `router.replace` does not navigate to the bare path
 * of this prerendered route** — `useSearchParams()` kept returning the old `run=`, so the drawer
 * re-rendered open and the X did nothing. Measured on a production build of this tree:
 *
 *     /audits?run=<id>          → X → address unchanged, drawer still open
 *     /audits?tab=past&run=<id> → X → /audits?tab=past, drawer closed
 *
 * `next dev` renders on demand and does not reproduce it, which is why every walk of this page
 * passed before a customer found it. **So no test that runs the page can hold this**, and this
 * file holds the two things that CAN be checked without a browser: the page no longer derives the
 * drawer from the address between renders, and it no longer depends on the router to clear the
 * last parameter.
 *
 * The behaviour itself is held by the walk recorded in the commit, and by `docs/TESTING.md`.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PAGE = readFileSync('app/audits/page.tsx', 'utf8')
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODE = code(PAGE)
const DRAWER = readFileSync('components/Drawer.tsx', 'utf8')
const CAL = readFileSync('app/calendar/page.tsx', 'utf8')

describe('the drawer is state, seeded from the address', () => {
  test('`run` and `tab` are no longer read from the address on every render', () => {
    assert.ok(!/const openRun = params\.get\('run'\)/.test(CODE), 'the drawer is derived from the address again')
    assert.ok(!/const tab = params\.get\('tab'\)/.test(CODE), 'the tab is derived from the address again')
    assert.match(CODE, /const \[openRun, setOpenRun\] = useState<string \| null>\(runParam\)/)
    assert.match(CODE, /const \[tab, setTab\] = useState<'stand' \| 'past'>\(tabParam\)/)
  })

  /**
   * The effect must depend on the PARAMETER, not on the params object: `params` is a new object on
   * every navigation, so `[params]` would re-run and reopen a drawer somebody had just closed.
   */
  test('the address is followed only when the parameter itself changes', () => {
    assert.match(CODE, /useEffect\(\(\) => \{ setOpenRun\(runParam\) \}, \[runParam\]\)/)
    assert.match(CODE, /useEffect\(\(\) => \{ setTab\(tabParam\) \}, \[tabParam\]\)/)
  })

  test('closing moves the state first, so it does not depend on the router agreeing', () => {
    const fn = CODE.slice(CODE.indexOf('const setParam = (k: string'))
    const body = fn.slice(0, fn.indexOf('\n  }') + 4)
    assert.ok(body.indexOf("setOpenRun(v)") < body.indexOf('router.replace'), 'the state must move first')
    assert.match(body, /if \(k === 'run'\) setOpenRun\(v\)/)
    assert.match(body, /if \(k === 'tab'\) setTab\(/)
  })

  /**
   * The empty case is the whole bug. `router.replace` is kept for every URL that still has a
   * parameter — that is what the Calendar does and it works — and `history.replaceState` writes
   * the one the router refuses.
   */
  test('an address with no parameters left is written without the router', () => {
    assert.match(CODE, /if \(p\.toString\(\)\) router\.replace\(url, \{ scroll: false \}\)/)
    assert.match(CODE, /else window\.history\.replaceState\(null, '', url\)/)
  })

  /**
   * After a `history.replaceState` the router's `params` is stale, so reading the next URL out of
   * it would resurrect the `run=` a person had just closed on their next tab click.
   */
  test('the next address is built from what this page last wrote, not from a stale params', () => {
    assert.match(CODE, /const searchRef = useRef\(params\.toString\(\)\)/)
    assert.match(CODE, /new URLSearchParams\(searchRef\.current\)/)
    assert.match(CODE, /searchRef\.current = p\.toString\(\)/)
    assert.ok(!/new URLSearchParams\(params\.toString\(\)\)/.test(CODE),
      'setParam is reading the router\'s params again, which goes stale')
  })

  test('opening from the Past audits list is unchanged — the same one call', () => {
    assert.match(CODE, /onClick=\{\(\) => setParam\('run', r\.id\)\}/)
    assert.match(CODE, /onClose=\{\(\) => \{ setParam\('run', null\); setDrawerWord\(null\) \}\}/)
    // The scrim closes it too, with the same call.
    assert.equal((CODE.match(/setParam\('run', null\); setDrawerWord\(null\)/g) ?? []).length, 2)
  })
})

describe('Escape closes any drawer', () => {
  test('one listener, in the shared Drawer, so every caller gets it', () => {
    assert.match(DRAWER, /if \(e\.key === 'Escape'\) onClose\(\)/)
    assert.match(DRAWER, /window\.addEventListener\('keydown', onKey\)/)
    assert.match(DRAWER, /return \(\) => window\.removeEventListener\('keydown', onKey\)/)
    // Removed on unmount, or every opened-and-closed drawer leaves a listener behind.
    assert.match(DRAWER, /\}, \[onClose\]\)/)
  })

  test('and no page has its own copy of it', () => {
    for (const [name, src] of [['audits', CODE], ['calendar', code(CAL)]] as const) {
      assert.ok(!/'Escape'/.test(src), `${name} has grown its own Escape handler`)
    }
  })
})

describe('the Calendar was never broken, and this records why', () => {
  /**
   * Its close keeps `?tab=`, so the query is never empty and the router always navigates. That is
   * luck, not design — if a later change makes `closeDate` able to empty the query, it inherits
   * the bug. This test is the tripwire for that day.
   */
  test('closeDate always leaves the tab behind', () => {
    const fn = CAL.slice(CAL.indexOf('const closeDate = () =>'))
    const body = fn.slice(0, fn.indexOf('\n  }') + 4)
    assert.match(body, /p\.delete\('date'\); p\.delete\('finding'\)/)
    assert.ok(!/p\.delete\('tab'\)/.test(body), 'closeDate now deletes the tab; it can empty the query')
  })
})

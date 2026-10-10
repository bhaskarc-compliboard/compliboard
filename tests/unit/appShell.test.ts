/**
 * ONE SECTION, NAMED ONCE — the owner, 9 October 2026 (during Calendar B4).
 *
 * `AppLayout`'s `title` draws a breadcrumb beside the wordmark ("/ Calendar"). The left bar already
 * highlights the section and the page's own `<h1>` already names it, so the breadcrumb is a third
 * copy of the same word. HR, the Workspace, Audits, Documents, Company information, Requirements and
 * Compliance had already stopped passing it; Calendar and the Dashboard stopped in Calendar B4.
 *
 * **My Account is the one deliberate exception**, and it stays until its own section is worked —
 * the owner's call, so the change lands with the rest of that page rather than on its own. This test
 * names it, so dropping it there makes this file fail and the exception has to be removed on purpose
 * rather than quietly going stale. `docs/HANDOFF-CODE.md` §7 carries the row.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Every .tsx under app/ that renders <AppLayout …>. */
function pagesUsingAppLayout(dir = 'app', found: Array<[string, string]> = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) { pagesUsingAppLayout(p, found); continue }
    if (!p.endsWith('.tsx')) continue
    const src = readFileSync(p, 'utf8')
    if (src.includes('<AppLayout')) found.push([p, src])
  }
  return found
}

const EXEMPT = new Set(['app/account/page.tsx'])

describe('the app shell names the section once', () => {
  test('no page passes title to AppLayout, except My Account', () => {
    const pages = pagesUsingAppLayout()
    // R2: this test reports an absence, so first show it can see a presence. If it finds no page at
    // all, or cannot see the exempt one's title, it is blind and its silence means nothing.
    assert.ok(pages.length >= 8, `only ${pages.length} pages render <AppLayout> — the walk is broken`)
    const exempt = pages.filter(([p]) => EXEMPT.has(p))
    assert.equal(exempt.length, 1, 'My Account was not found; update EXEMPT or the path moved')
    assert.match(exempt[0][1], /<AppLayout title=/, 'My Account no longer passes title — drop it from EXEMPT')

    for (const [p, src] of pages) {
      if (EXEMPT.has(p)) continue
      const withTitle = src.match(/<AppLayout[^>]*\btitle=/g)
      assert.equal(withTitle, null, `${p} passes title to AppLayout, so it draws a second breadcrumb`)
    }
  })

  test('Calendar and the Dashboard still name themselves in their own heading', () => {
    // Dropping the breadcrumb is only right because something else says where you are.
    assert.match(readFileSync('app/calendar/page.tsx', 'utf8'),
      /<h1 className="font-serif text-\[28px\] font-normal text-gray-900">\s*Calendar\s*</)
    assert.match(readFileSync('app/dashboard/page.tsx', 'utf8'), /profile\?\.name/)
  })
})

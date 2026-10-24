/**
 * THE SCREENS IN THE READ-ONLY STATE — My Account step 18, board 8, decision 11.
 *
 * `lib/billing.ts`'s own tests cover what the banner SAYS. These cover where it is drawn, what it
 * is drawn beside, and — the thing decision 14 asks for — that the shared frame is otherwise
 * exactly what it was.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const LAYOUT = readFileSync('components/AppLayout.tsx', 'utf8')
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const region = (src: string, from: string, to: string) =>
  src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from)) + to.length)

describe('the banner is one slot, above the top bar, and prints nowhere', () => {
  test('exactly ONE render site in the whole layout', () => {
    assert.equal((LAYOUT.match(/<ReadOnlyBanner/g) ?? []).length, 1)
  })

  test('…and it is ABOVE the header, which is what board 8 draws', () => {
    assert.ok(LAYOUT.indexOf('<ReadOnlyBanner') < LAYOUT.indexOf('<header'),
      'the band is below the top bar')
  })

  test('it renders only when there is something to say', () => {
    assert.match(LAYOUT, /\{banner && <ReadOnlyBanner banner=\{banner\} \/>\}/)
  })

  test('the verdict comes from ONE shared function, not a condition written twice', () => {
    // `bannerFromRow` holds the read_only-OR-in-grace rule. If the layout re-derived it, it and
    // the six pages could drift on the one case that matters (the grace).
    assert.match(LAYOUT, /const banner = bannerFromRow\(billing\)/)
    assert.ok(!/accessFor\(/.test(LAYOUT), 'the layout re-derives the verdict instead of sharing it')
  })

  test('*** THE BAND IS `no-print`, LIKE THE HEADER. ***', () => {
    // Decision 11 promises everything is still here to READ AND DOWNLOAD. A band saying "your
    // trial has ended" across the top of an exported report would contradict the very sentence
    // it was printing.
    const banner = readFileSync('components/ReadOnlyBanner.tsx', 'utf8')
    assert.match(banner, /className="no-print/)
  })

  test('the button goes to checkout or the portal, and never anywhere else', () => {
    const banner = readFileSync('components/ReadOnlyBanner.tsx', 'utf8')
    assert.match(banner, /\/api\/billing\/\$\{banner\.action\}/)
    assert.match(banner, /authHeaders\(\)/)
  })

  test('a failed checkout is SAID, not swallowed — §5.1, as our problem', () => {
    const banner = readFileSync('components/ReadOnlyBanner.tsx', 'utf8')
    assert.match(banner, /We couldn't open the payment page just now/)
    assert.ok(!/catch \{\s*\}/.test(banner), 'an empty catch would be a dead button')
  })
})

describe('*** DECISION 14: THE SIDEBAR AND THE FRAME ARE UNTOUCHED. ***', () => {
  // A snapshot, because "nothing else changed" is the promise this step made and the only way to
  // keep it is to make a change to those regions fail the build. If a later step legitimately
  // edits the sidebar, these two numbers are a deliberate edit — as `scripts/test-guard.js`'s
  // FLOOR is. Captured 23 October 2026, after step 18's three additions to this file.
  test('NAV_ITEMS is byte-for-byte what it was', () => {
    const nav = region(LAYOUT, 'const NAV_ITEMS', ']')
    assert.equal(nav.split('\n').length, 34, 'NAV_ITEMS changed length')
    assert.equal(sha(nav), 'a77030ae79e07a09', 'NAV_ITEMS changed content')
  })

  test('SidebarContent is byte-for-byte what it was', () => {
    const sb = region(LAYOUT, 'const SidebarContent', '\n  )\n')
    assert.equal(sb.split('\n').length, 56, 'SidebarContent changed length')
    assert.equal(sha(sb), '9c328d3b8a5fac99', 'SidebarContent changed content')
  })

  test('step 18 added three things to the layout and no more', () => {
    // One widened select, one state, one JSX line. Named so the next reader can check the diff
    // against the claim rather than taking it on trust.
    // `stripe_subscription_id`, not `stripe_customer_id` — §218. The banner's one button routes
    // by whether a SUBSCRIPTION exists; a customer exists the moment checkout is opened, so
    // keying on it sent anybody who abandoned a session to a portal they could not use.
    assert.match(LAYOUT, /\.select\('name, trial_ends_at, subscription_status, payment_failed_at, stripe_subscription_id'\)/)
    assert.ok(!/payment_failed_at, stripe_customer_id/.test(LAYOUT),
      'the layout is back to reading the customer id, which is not what the button routes on')
    assert.match(LAYOUT, /const \[billing, setBilling\] = useState<BillingRow \| null>\(null\)/)
    assert.equal((LAYOUT.match(/<ReadOnlyBanner/g) ?? []).length, 1)
  })

  test('…and it is the SAME read, widened — not a second request', () => {
    assert.equal((LAYOUT.match(/\.from\('companies'\)/g) ?? []).length, 1,
      'the layout makes more than one companies read')
  })
})

describe('every screen that owns a paid control shows the same note', () => {
  const PAGES = [
    'app/compliance/page.tsx', 'app/hr/HrWorkspace.tsx', 'app/audits/page.tsx',
    'app/documents/page.tsx', 'app/calendar/page.tsx',
  ]

  for (const f of PAGES) {
    test(`${f}: widens the read it already makes, and never adds one`, () => {
      const src = readFileSync(f, 'utf8')
      assert.match(src, /trial_ends_at, subscription_status, payment_failed_at, stripe_subscription_id/,
        'the select was not widened')
      assert.match(src, /const paused = pausedFromRow\(billing\)/)
      assert.equal((src.match(/\.from\('companies'\)/g) ?? []).length, 1,
        'more than one companies read — the brief asked for a widened one, not a new one')
    })
  }

  test('ONE shared component says it, and no page writes its own wording', () => {
    for (const f of [...PAGES, 'components/DocumentReport.tsx', 'components/AuditReport.tsx', 'components/CalendarAsk.tsx']) {
      const src = readFileSync(f, 'utf8')
      assert.match(src, /<PausedNote banner=\{paused\}/, `${f} has no note`)
      assert.ok(!/trial has ended/.test(src), `${f} writes its own copy of the sentence`)
    }
  })

  test('PausedNote renders NOTHING when access is full — a paying screen is unchanged', () => {
    const src = readFileSync('components/PausedNote.tsx', 'utf8')
    assert.match(src, /if \(!banner\) return null/)
  })

  test('the three shared report components take a PROP, never a read of their own', () => {
    for (const f of ['components/DocumentReport.tsx', 'components/AuditReport.tsx', 'components/CalendarAsk.tsx']) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!/\.from\('companies'\)/.test(src), `${f} reads companies itself`)
      assert.match(src, /paused/, `${f} does not take the verdict`)
    }
  })

  test('*** UPLOADING IS NOT GATED, AND THE PAGE SAYS WHAT WILL HAPPEN. ***', () => {
    // The owner's rule for step 18: no NON-MODEL write is gated. A read-only company must still
    // be able to put its records somewhere safe. What pauses is the reading.
    const src = readFileSync('app/documents/page.tsx', 'utf8')
    assert.match(src, /uploaded and saved — `\s*\n?\s*\+ 'queued to be read\. Add a card to start reading them\.'/)
    // and the upload buttons themselves must NOT carry the flag
    const addFiles = src.slice(src.indexOf('fileInputRef.current?.click()'))
    assert.ok(!/disabled=\{uploading \|\| Boolean\(paused\)\}/.test(addFiles.slice(0, 200)),
      'the upload button was disabled — a read-only company cannot save its own files')
  })
})

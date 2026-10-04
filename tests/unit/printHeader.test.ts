/**
 * THE SITE HEADER NEVER PRINTS — Workspace Stage 2. It is `sticky top-0`, so on paper it landed
 * wherever the page behind a drawer was scrolled to, across the summary's first section.
 * `no-print` is hidden by `app/globals.css` inside `@media print` only, so the screen is untouched.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the header carries no-print, and no-print is hidden in print only', () => {
  const layout = readFileSync('components/AppLayout.tsx', 'utf8')
  assert.match(layout, /<header className="no-print [^"]*sticky top-0/)
  const css = readFileSync('app/globals.css', 'utf8')
  assert.match(css, /@media print \{\s*\.no-print \{ display: none !important; \}/)
  // Outside @media print nothing hides .no-print, so on screen the header is as it was.
  const outside = css.replace(/@media print \{[\s\S]*?\n\}/g, '')
  assert.ok(!/\.no-print\s*\{/.test(outside), '.no-print must not be hidden on screen')
})

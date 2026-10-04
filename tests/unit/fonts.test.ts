/**
 * NO BUILD MAY FETCH GOOGLE FONTS — the self-hosting change (vercel/next.js#99114).
 *
 * `next/font/google` downloads fonts from Google at build time, and on 3 October that broke two
 * production builds with errors that had nothing to do with the code. The fonts are now files in
 * `app/fonts/` loaded by `next/font/local`. This fails if anything imports `next/font/google` again.
 *
 * It matches IMPORTS, not mentions: `app/layout.tsx` names the module in a comment explaining why
 * it is not used, and that must not trip it. The pattern is proved against a real import first, so
 * a pattern that matches nothing cannot pass by finding nothing (CLAUDE.md §9a).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const GOOGLE_IMPORT =
  /(?:from\s*['"]next\/font\/google['"]|import\s*\(\s*['"]next\/font\/google['"]|require\s*\(\s*['"]next\/font\/google['"]|import\s*['"]next\/font\/google['"])/

const ROOTS = ['app', 'components', 'lib', 'config', 'prompts', 'scripts', 'pages', 'src']
const SOURCE = /\.(tsx?|jsx?|mjs|cjs)$/

function files(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? (name === 'node_modules' ? [] : files(p)) : SOURCE.test(name) ? [p] : []
  })
}

test('the pattern catches every way of importing next/font/google', () => {
  for (const line of [
    `import { IBM_Plex_Sans } from "next/font/google";`,
    `import { Inter } from 'next/font/google'`,
    `const f = await import('next/font/google')`,
    `const { Inter } = require("next/font/google")`,
  ]) assert.match(line, GOOGLE_IMPORT, line)
  assert.doesNotMatch('// next/font/google fetches at build time', GOOGLE_IMPORT, 'a comment is not an import')
  assert.doesNotMatch(`import localFont from "next/font/local";`, GOOGLE_IMPORT)
})

test('nothing in the codebase imports next/font/google', () => {
  const all = ROOTS.flatMap(files).concat(['next.config.ts', 'next.config.js', 'next.config.mjs'].filter(existsSync))
  assert.ok(all.includes(join('app', 'layout.tsx')), 'the scan must reach app/layout.tsx, or it proves nothing')
  const offenders = all.filter((f) => GOOGLE_IMPORT.test(readFileSync(f, 'utf8')))
  assert.deepEqual(offenders, [], `next/font/google is imported in: ${offenders.join(', ')}`)
})

test('the layout loads the self-hosted files, and every file it names exists', () => {
  const layout = readFileSync(join('app', 'layout.tsx'), 'utf8')
  assert.match(layout, /from\s*["']next\/font\/local["']/)
  const paths = [...layout.matchAll(/path:\s*'(\.\/fonts\/[^']+)'/g)].map((m) => join('app', m[1]))
  assert.ok(paths.length > 0, 'no font paths found in app/layout.tsx')
  for (const p of paths) assert.ok(existsSync(p), `missing font file ${p}`)
  for (const lic of ['app/fonts/ibm-plex-sans/OFL.txt', 'app/fonts/source-serif-4/OFL.txt']) {
    assert.ok(existsSync(lic), `missing licence ${lic}`)
  }
})

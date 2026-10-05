/**
 * NOTHING SERVER-ONLY REACHES A CLIENT FILE — HR Step 3a.
 *
 * `lib/summaryReport.ts` imports `lib/ai.ts`, which imports the model SDK. Until Step 3a the
 * workspace page kept copies of two display strings rather than import them from it, and one test
 * pinned the page alone. Step 3a moved those strings into `lib/summaryWords.ts` and the summary drawer
 * into a shared component, so the same mistake could now land in any of several files. This test
 * holds it wherever it lands:
 *   (a) `lib/summaryWords.ts` imports nothing at all;
 *   (b) no file under components/, and no file marked 'use client', imports — directly OR through any
 *       local file it imports — `lib/ai.ts`, `lib/summaryReport.ts`, `lib/auth.ts` or `@anthropic-ai/sdk`.
 * `import type` is skipped: it is erased at build and never reaches a bundle.
 *
 * *** AND IT IS SHOWN TO FAIL. *** The last test writes deliberately bad client files to a scratch
 * folder and requires the scan to name them — a guard nobody has seen fail is a comment (`CLAUDE.md` §9a).
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const FORBIDDEN_FILES = ['lib/ai.ts', 'lib/summaryReport.ts', 'lib/auth.ts'].map((f) => resolve(ROOT, f))
const FORBIDDEN_PACKAGES = ['@anthropic-ai/sdk']

/** The code without comments, so a comment that names a module is not an import. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Every runtime module specifier in a file: `import … from`, `export … from`, bare `import '…'`, dynamic `import('…')`. */
export function runtimeSpecifiers(src: string): string[] {
  const c = code(src)
  const out: string[] = []
  for (const m of c.matchAll(/^\s*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
    if (m[2]) continue                                              // `import type …` / `export type …`
    out.push(m[4])
  }
  for (const m of c.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) out.push(m[1])
  for (const m of c.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1])
  return out
}

/** A local specifier to its file, or null for a package. `@/x` is the repo root (tsconfig paths). */
function resolveLocal(spec: string, from: string): string | null {
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
  if (!base) return null
  for (const f of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(f) && statSync(f).isFile()) return f
  }
  return null
}

/** The forbidden modules a file reaches at run time, each with the chain of imports that reaches it. */
export function forbiddenReach(file: string): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const walk = (f: string, chain: string[]) => {
    if (seen.has(f)) return
    seen.add(f)
    for (const spec of runtimeSpecifiers(readFileSync(f, 'utf8'))) {
      if (FORBIDDEN_PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`))) { found.push([...chain, spec].join(' → ')); continue }
      const target = resolveLocal(spec, f)
      if (!target) continue
      const next = [...chain, relative(ROOT, target)]
      if (FORBIDDEN_FILES.includes(target)) { found.push(next.join(' → ')); continue }
      walk(target, next)
    }
  }
  walk(file, [relative(ROOT, file)])
  return found
}

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) { if (e !== 'node_modules' && !e.startsWith('.')) filesUnder(p, out) }
    else if (/\.(ts|tsx)$/.test(e)) out.push(p)
  }
  return out
}
const isClient = (f: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(readFileSync(f, 'utf8'))

const clientFiles = [...new Set([
  ...filesUnder(join(ROOT, 'components')),
  ...['app', 'components', 'lib'].flatMap((d) => filesUnder(join(ROOT, d))).filter(isClient),
])]

describe('nothing server-only reaches a client file', () => {
  test('(a) lib/summaryWords.ts imports nothing at all', () => {
    const src = readFileSync('lib/summaryWords.ts', 'utf8')
    assert.deepEqual(runtimeSpecifiers(src), [])
    assert.ok(!/\b(import|require)\s*[({'"]/.test(code(src)), 'no import or require of any kind')
  })

  test('(b) the scan sees the client files it must: the page, the shared pieces, every component', () => {
    const rel = clientFiles.map((f) => relative(ROOT, f))
    for (const must of ['app/compliance/page.tsx', 'components/ReportView.tsx', 'components/Drawer.tsx', 'app/hr/page.tsx']) {
      assert.ok(rel.includes(must), `the scan must reach ${must}, or it proves nothing`)
    }
    assert.ok(rel.length >= 20, `only ${rel.length} client files found`)
  })

  test('(b) no client file reaches lib/ai.ts, lib/summaryReport.ts, lib/auth.ts or @anthropic-ai/sdk', () => {
    const bad = clientFiles.flatMap((f) => forbiddenReach(f))
    assert.deepEqual(bad, [], `server-only code reaches a client file:\n  ${bad.join('\n  ')}`)
  })

  test('the scan FAILS on a deliberately bad client file — directly, through a re-export, and through a lib', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cb-client-imports-'))
    try {
      const direct = join(dir, 'Direct.tsx')
      writeFileSync(direct, "'use client'\nimport { askAIJson } from '@/lib/ai'\nexport const x = askAIJson\n")
      const viaLib = join(dir, 'ViaLib.tsx')
      // lib/checklistConvert.ts imports lib/summaryReport.ts at run time: a client file importing it is
      // the mistake one step removed.
      writeFileSync(viaLib, "'use client'\nimport { checkConversion } from '@/lib/checklistConvert'\nexport const y = checkConversion\n")
      const sdk = join(dir, 'Sdk.tsx')
      writeFileSync(sdk, "'use client'\nexport { default } from '@anthropic-ai/sdk'\n")
      const typeOnly = join(dir, 'TypeOnly.tsx')
      writeFileSync(typeOnly, "'use client'\nimport type { SummaryReport } from '@/lib/summaryReport'\nexport type Z = SummaryReport\n")
      assert.match(forbiddenReach(direct).join('\n'), /lib\/ai\.ts/)
      assert.match(forbiddenReach(viaLib).join('\n'), /lib\/checklistConvert\.ts → lib\/summaryReport\.ts/)
      assert.match(forbiddenReach(sdk).join('\n'), /@anthropic-ai\/sdk/)
      assert.deepEqual(forbiddenReach(typeOnly), [], 'an `import type` is erased and must not be flagged')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

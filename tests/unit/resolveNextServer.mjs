/**
 * Lets `node --test` load a Next route file.
 *
 * A route imports `next/server` for `NextRequest`/`NextResponse`. `next` is CommonJS and declares
 * no `exports` map, so Node's ESM resolver treats the bare specifier as a FILE PATH and refuses
 * it for want of an extension — "Cannot find module .../node_modules/next/server. Did you mean to
 * import next/server.js?". Under Next's own build the bundler resolves it; under plain Node
 * nothing does, which is why a job route file was untestable and why three of the four
 * cron sweeps had never been run by a test.
 *
 * It also resolves the `@/` path alias, for the same reason: `tsconfig.json` declares it, the
 * bundler honours it, and plain Node knows nothing about it. `lib/stripeWebhook.ts` was written
 * with relative imports at step 17 purely to work around that, and this is the general fix.
 *
 * It is a TEST-HARNESS shim and changes nothing the product ships: `next build` never sees it.
 */
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** `@/lib/billing` has no extension; on disk it is `lib/billing.ts`. Try what TypeScript tries. */
function onDisk(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

/**
 * PLACEHOLDER CREDENTIALS, AND THEY ARE NOT A SECRET BECAUSE THEY ARE NOT REAL.
 *
 * `lib/auth.ts` builds its service-role client at MODULE scope, so merely importing anything that
 * reaches it throws "supabaseUrl is required." under `node --test` — nothing loads `.env.local`
 * here, and nothing should. These are obviously-fake values that let the module construct. No
 * query is ever made through that client in a unit test: every sweep takes its database as a
 * parameter, which is the point of step 18's change. `??=` so a real environment is never
 * overwritten.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:1/not-a-real-project'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'unit-test-placeholder-not-a-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'unit-test-placeholder-not-a-key'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/server') return nextResolve('next/server.js', context)
    if (specifier.startsWith('@/')) {
      const hit = onDisk(join(ROOT, specifier.slice(2)))
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

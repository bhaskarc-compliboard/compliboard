/**
 * WHO MAY RUN A NIGHTLY JOB — the rule, with no Next.js in it, so `tests/unit/cronSecret.test.ts` can
 * run it in plain Node. `lib/jobAuth.ts` applies it to a request. Workspace Stage 4 Part 3.
 *
 * Two doors, one secret (`CRON_SECRET`):
 *
 *   GET  with `Authorization: Bearer <CRON_SECRET>` — Vercel Cron. "The value of the variable will be
 *        automatically sent as an `Authorization` header when Vercel invokes your cron job" and "The
 *        `authorization` header will have the `Bearer` prefix for the value", and its examples are GET
 *        handlers (https://vercel.com/docs/cron-jobs/manage-cron-jobs, read 4 October 2026). Every
 *        scheduled call was GET → 405 until this existed (`DECISIONS.md` §154).
 *   POST with `x-cron-secret: <CRON_SECRET>` — a person running a job by hand, as the runbooks do.
 *
 * Each door takes only its own header. A GET carrying `x-cron-secret`, or a POST carrying the bearer,
 * is refused: the two are separate so that what Vercel sends and what a person types never blur.
 *
 * *** UNSET REFUSES BOTH. *** An absent secret is a misconfiguration, and the safe reading of one is
 * "no" — the tempting `if (secret && given !== secret)` opens the route to everyone on a deploy where
 * the variable was never set, and looks exactly like a route that works.
 *
 * *** LENGTH-SAFE COMPARISON. *** `timingSafeEqual` on equal-length buffers, lengths compared first;
 * the length is all a timing difference can leak, and the length is not the secret.
 */
import { timingSafeEqual } from 'node:crypto'

export type CronVerdict = 'ok' | 'unset' | 'refused'

/** The header a person sends with POST. */
export const MANUAL_HEADER = 'x-cron-secret'
/** The header Vercel Cron sends with GET. */
export const VERCEL_HEADER = 'authorization'

export function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function cronVerdict(
  method: string, header: (name: string) => string | null, secret: string | undefined,
): CronVerdict {
  const expected = secret ?? ''
  if (!expected) return 'unset'
  const m = method.toUpperCase()
  if (m === 'GET') {
    const auth = header(VERCEL_HEADER) ?? ''
    return auth.startsWith('Bearer ') && sameSecret(auth.slice('Bearer '.length), expected) ? 'ok' : 'refused'
  }
  if (m === 'POST') return sameSecret(header(MANUAL_HEADER) ?? '', expected) ? 'ok' : 'refused'
  return 'refused'
}

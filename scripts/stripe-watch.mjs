/**
 * THE WEBHOOK LISTENER, POINTED AT THE RIGHT SANDBOX — My Account step 20 setup.
 *
 *   npm run stripe:watch
 *
 * This is a wrapper around one command:
 *
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *
 * and it exists for one reason that is worth the file. `stripe listen` sends events from WHICHEVER
 * account the CLI happens to be logged into. `.env.local`'s `STRIPE_SECRET_KEY` decides which
 * account the APP talks to. If those two are different — two sandboxes, or a sandbox and a live
 * account — then checkout creates a customer in one place and the listener forwards events from
 * another, nothing ever arrives, and there is no error anywhere to explain it. You would be
 * debugging the webhook handler, which is fine.
 *
 * So this reads the key the app itself uses and passes it with `--api-key`. **The listener and the
 * app are then provably the same account**, and `stripe login` is not even required.
 *
 * It also prints the signing secret and says whether `.env.local` already matches it — because a
 * missing `STRIPE_WEBHOOK_SECRET` makes `app/api/stripe/webhook` refuse every event with a 400,
 * which looks exactly like a bad signature.
 */

import { readFileSync, existsSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'

// 3000 is where the owner's dev server runs. `PORT=3998 npm run stripe:watch` points it at an
// isolated copy instead (`HOW-WE-BUILD.md` §3c), which is how this was tested without touching it.
const PORT = process.env.PORT ?? '3000'
const FORWARD = `localhost:${PORT}/api/stripe/webhook`

/**
 * *** THE SIX EVENTS `lib/stripeWebhook.ts` HANDLES, AND NOTHING ELSE. ***
 *
 * CLI 1.55.1 REFUSES a bare `stripe listen --forward-to …` — "must specify events to forward using
 * --events, --all-snapshot, or --all-thin". Older guides (and the step 20 brief) give the bare
 * form; it exits immediately on this version.
 *
 * `--all-snapshot` would also work and is the wrong choice: Stripe emits a great many events, the
 * handler ignores all but these, and every ignored one still becomes a `stripe_events` row. Naming
 * them keeps the log readable and makes this list the second place the handler's contract is
 * written down — if somebody adds a seventh `case`, this is what will not forward it, loudly.
 */
const EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]

function env(name) {
  if (!existsSync('.env.local')) die('.env.local is not here. Run this from the project root.')
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m && m[1] === name) return m[2].trim()
  }
  return null
}
function die(msg) { console.error(`\n  stripe:watch — ${msg}\n`); process.exit(1) }

/** The CLI, wherever it landed. `~/.local/bin` is a user-owned prefix and needs no sudo. */
function findCli() {
  for (const c of ['stripe', join(homedir(), '.local/bin/stripe')]) {
    try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return c } catch { /* next */ }
  }
  die('the Stripe CLI is not installed. Install it without sudo with:\n'
    + '      npm install -g --prefix ~/.local @stripe/cli\n'
    + '    (~/.local/bin is already on this machine\'s PATH.)')
}

const cli = findCli()
const key = env('STRIPE_SECRET_KEY')
if (!key) die('STRIPE_SECRET_KEY is not in .env.local, so there is no account to listen to.')
if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
  die('STRIPE_SECRET_KEY is NOT a test key.\n'
    + '    This forwards live webhooks at a development machine. Refusing.')
}

// The signing secret for this pairing. Stable per account+device — it does NOT change on every
// start, which is worth knowing because the opposite is widely assumed. It DOES change if you
// `stripe login --new-session` or pair a different account.
let secret
try {
  secret = execFileSync(cli, ['listen', '--api-key', key, '--print-secret'], { encoding: 'utf8' }).trim()
} catch {
  die('could not read the signing secret. Is the key in .env.local still valid?')
}

const configured = env('STRIPE_WEBHOOK_SECRET')
console.log('\n  ── the webhook signing secret ───────────────────────────────────────────')
console.log(`  ${secret}`)
if (configured === secret) {
  console.log('\n  .env.local already has this. Nothing to do.')
} else {
  console.log('\n  ⚠ .env.local does NOT have this yet. Put the line below in it and RESTART')
  console.log('    the dev server — Next reads .env.local once, at boot:\n')
  console.log(`      STRIPE_WEBHOOK_SECRET=${secret}\n`)
  console.log('    Until then every event is refused with 400 "bad signature", which looks')
  console.log('    exactly like a broken handler and is not one.')
}
console.log('  ─────────────────────────────────────────────────────────────────────────\n')
console.log(`  Forwarding to  http://${FORWARD}`)
console.log(`  Events         ${EVENTS.length}: ${EVENTS.join(', ')}`)
console.log('  Leave this terminal running. Ctrl-C stops it.\n')

// `--api-key` so the listener is provably the same account as the app, logged in or not.
const child = spawn(
  cli,
  ['listen', '--api-key', key, '--events', EVENTS.join(','), '--forward-to', FORWARD],
  { stdio: 'inherit' },
)
child.on('exit', (code) => process.exit(code ?? 0))

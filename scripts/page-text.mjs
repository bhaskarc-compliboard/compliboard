// WHAT A SIGNED-IN PAGE ACTUALLY SAYS — Audits Run 3.
//
//   node --env-file=.env.local scripts/page-text.mjs /audits
//   node --env-file=.env.local scripts/page-text.mjs '/audits?run=<id>' "<a JS expression>"
//
// *** NOT A TEST. *** It asserts nothing. It exists because every page in this product is a client
// component behind a session, so `curl` returns an empty shell and there is no way to QUOTE a page
// in a report without opening it. Written when a report was about to describe page text from the
// JSON behind it, which is the difference between what a page says and what somebody thinks it says.
//
// It signs in as a fixture login, writes the session as the cookie `@supabase/ssr` reads (NOT
// localStorage — that was the first attempt and the page correctly rendered "Unauthorized"), opens
// the page in headless Chrome and prints `document.body.innerText`.
//
// *** A FIXED ELEMENT MAY HAVE NO innerText. *** The drawer is `position: fixed`; in a headless
// viewport it has no layout box, so `innerText` skipped all of it while the element was plainly in
// the DOM. Pass an expression reading `textContent` to see inside one:
//
//   "Array.from(document.querySelectorAll('.print-drawer')).map(n => n.textContent).join('')"
//
// Chrome is closed over the DevTools protocol and the port is swept afterwards, the same rule
// `scripts/render-golden-docs.js` learned the hard way: killing the launcher leaves the browser.
import { spawn, execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9444
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = url.match(/https:\/\/([^.]+)/)[1]

const pub = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
// The login, overridable, because which fixture company a page is worth looking at depends on the
// page. Cascade is the one with twelve documents and four agencies.
const EMAIL = process.env.PAGE_TEXT_AS || 'testcascade@example.com'
const { data, error } = await pub.auth.signInWithPassword({
  email: EMAIL, password: process.env.CHECK_LIVE_PASSWORD })
if (error) { console.error('signin: ' + error.message); process.exit(1) }
const session = data.session

const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--no-first-run', '--disable-gpu', `--user-data-dir=${process.env.TMPDIR || '/tmp'}/cb-page-shot`,
  'about:blank'], { stdio: 'ignore' })

let msgId = 0
const cdp = (ws, method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId
  const on = (e) => { const m = JSON.parse(e.data); if (m.id !== id) return
    ws.removeEventListener('message', on); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result) }
  ws.addEventListener('message', on); ws.send(JSON.stringify({ id, method, params }))
})

try {
  let v = null
  for (let i = 0; i < 60 && !v; i++) {
    await new Promise((r) => setTimeout(r, 250))
    try { v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json() } catch {}
  }
  if (!v) throw new Error('Chrome did not open its port')

  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('cdp socket')) })
  await cdp(ws, 'Page.enable'); await cdp(ws, 'Runtime.enable')

  // *** THE SESSION IS A COOKIE, NOT localStorage. *** `lib/supabase.ts` uses
  // `createBrowserClient` from `@supabase/ssr`, which stores the session in cookies so the server
  // can read it too. Setting localStorage did nothing at all and the page rendered "Unauthorized",
  // which is the page being right about an unauthenticated caller.
  const name = `sb-${ref}-auth-token`
  const value = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64')
  await cdp(ws, 'Network.enable')
  // Chunked the way @supabase/ssr does when a cookie would be over the size limit, so a long
  // session lands the same way the browser would have written it.
  const CHUNK = 3180
  if (value.length <= CHUNK) {
    await cdp(ws, 'Network.setCookie', { name, value, domain: 'localhost', path: '/' })
  } else {
    for (let i = 0, n = 0; i < value.length; i += CHUNK, n++) {
      await cdp(ws, 'Network.setCookie', {
        name: `${name}.${n}`, value: value.slice(i, i + CHUNK), domain: 'localhost', path: '/' })
    }
  }

  const path = process.argv[2] || '/audits'
  await cdp(ws, 'Page.navigate', { url: `http://localhost:3000${path}` })
  // The page fetches its own data after mount; give it time and then wait for the list to exist.
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const { result } = await cdp(ws, 'Runtime.evaluate', {
      expression: `document.body.innerText.includes('Loading…') ? 'loading' : (document.body.innerText.length > 300 ? 'ready' : 'thin')`,
      returnByValue: true })
    if (result.value === 'ready') break
  }
  const expr = process.argv[3] || 'document.body.innerText'
  // `awaitPromise` so an expression can wait for something — a drawer that fetches after mount,
  // for instance. Without it a promise came back as `{}` and looked like an empty page.
  const { result } = await cdp(ws, 'Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true })
  console.log(typeof result.value === 'string' ? result.value : JSON.stringify(result.value, null, 2))
} finally {
  try {
    const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    const ws2 = new WebSocket(v.webSocketDebuggerUrl)
    await new Promise((r) => { ws2.onopen = r; ws2.onerror = r })
    await cdp(ws2, 'Browser.close').catch(() => {})
  } catch {}
  proc.kill()
  try { execFileSync('/bin/sh', ['-c', `pkill -f 'remote-debugging-port=${PORT}' || true`]) } catch {}
}

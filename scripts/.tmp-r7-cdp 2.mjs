import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
export async function withBrowser(fn) {
  const profile = mkdtempSync(join(tmpdir(), 'cb-r7-chrome-'))
  const port = 9800 + Math.floor(Math.random() * 150)
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,1600', 'about:blank'], { stdio: 'ignore' })
  let ws, id = 0; const pending = new Map()
  try {
    let target
    for (let i = 0; i < 100 && !target; i++) {
      await new Promise((r) => setTimeout(r, 200))
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    if (!target) throw new Error('chrome did not start')
    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } }
    const send = (method, params = {}) => new Promise((res, rej) => {
      const n = ++id; pending.set(n, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)))
      ws.send(JSON.stringify({ id: n, method, params })) })
    await send('Page.enable'); await send('Runtime.enable')
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate threw')
      return r.result.value }
    const goto = async (url) => { await send('Page.navigate', { url })
      for (let i = 0; i < 150; i++) { await new Promise((r) => setTimeout(r, 200)); if (await evaluate('document.readyState === "complete"')) return } }
    const waitFor = async (expr, tries = 100) => {
      for (let i = 0; i < tries; i++) { if (await evaluate(expr)) return true; await new Promise((r) => setTimeout(r, 300)) } return false }
    await fn({ evaluate, goto, waitFor, send })
  } finally { try { ws?.close() } catch {} ; proc.kill() }
}
export async function signIn({ goto, evaluate, waitFor }) {
  await goto('http://localhost:3000/login')
  await waitFor('!!document.querySelector("input[type=email]")')
  await evaluate(`(() => {
    const set = (el, v) => { const p = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
      p.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    set(document.querySelector('input[type=email]'), ${JSON.stringify('testgamma@example.com')})
    set(document.querySelector('input[type=password]'), ${JSON.stringify(process.env.CHECK_LIVE_PASSWORD)})
    ;[...document.querySelectorAll('button')].find(b => /sign in|log in|continue/i.test(b.innerText)).click()
    return true })()`)
  await waitFor('!location.pathname.startsWith("/login")', 120)
}

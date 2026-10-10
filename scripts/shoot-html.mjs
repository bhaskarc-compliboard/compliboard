// SHOOT A LOCAL HTML FILE IN CHROMIUM — Calendar B5, for the email frame.
// `scripts/measure-layout.mjs` drives a signed-in app page; an email is a file with no server and no
// session, so this is the small version: open file://, screenshot, quit.
import { spawn, execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const [file, out, widthArg] = process.argv.slice(2)
const width = Number(widthArg ?? 680)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const profile = mkdtempSync(join(tmpdir(), 'shoot-'))
const port = 9400 + Math.floor(Math.random() * 300)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars', `--window-size=${width},1400`, 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let ws, msgId = 0
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId
  const on = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener('message', on); m.error ? rej(new Error(m.error.message)) : res(m.result) } }
  ws.addEventListener('message', on)
  ws.send(JSON.stringify({ id, method, params }))
})
try {
  let target
  for (let i = 0; i < 40; i++) {
    try { target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); break }
    catch { await sleep(250) }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('cdp socket')) })
  await cdp('Page.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1400, deviceScaleFactor: 2, mobile: false })
  await cdp('Page.navigate', { url: 'file://' + resolve(file) })
  await sleep(900)
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(out, Buffer.from(data, 'base64'))
  console.log(`  ${out}`)
} finally {
  try { ws?.close() } catch {}
  chrome.kill()
  // Chrome keeps writing to its profile for a moment after SIGTERM, so a delete fired immediately
  // hits ENOTEMPTY and fails a run whose screenshot was already written. Wait for it to go, then
  // sweep; a leftover temp directory is not worth failing a run over either.
  await new Promise((r) => chrome.once('exit', r))
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
}

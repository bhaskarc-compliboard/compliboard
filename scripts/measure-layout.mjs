// WHERE THINGS SIT ON A SIGNED-IN PAGE, MEASURED — Workspace layout, Task 2.
//
//   npm run measure -- /compliance
//   npm run measure -- /compliance --as testgamma@example.com --click Conversations --click "What did I"
//   npm run measure -- /audits --width 1440 --shot /tmp/audits.png
//
// *** MEASURE RATHER THAN LOOK. *** `DESIGN.md` §6 item 10. Two edges that differ by 24px look the
// same in a screenshot and are not the same; this prints the numbers. Written after Task 1 found
// the footer lined up with no page's title, which nobody had seen by looking.
//
// Built from `scripts/page-text.mjs`: the same sign-in (a fixture login, the session written as the
// cookie `@supabase/ssr` reads) and the same Chrome handling (DevTools protocol, closed over the
// protocol, its port swept afterwards). Differences, each on purpose:
//
//   · 1280×900 by default, `--width <px>` to change it. The window AND the device metrics are set,
//     because a headless window without the override reports its own default size.
//   · A FRESH PROFILE EVERY RUN, deleted afterwards, and the cache off and cleared. That is the hard
//     reload: a stale bundle makes the markup new and the handlers old (TESTING.md, the layout pass).
//   · IT CALLS NO MODEL AND WRITES NOTHING. Every request to a route that can spend money is failed
//     in the browser before it leaves, and so is every write to the database or storage — a click
//     can land on Delete. Everything blocked is printed at the end. An empty list is the evidence
//     that the run cost nothing and changed nothing; a non-empty one says exactly what was stopped.
//
// What it prints: the title's x, the column's box and content edges, the tab row's edges, the
// footer content's edges and where its text starts, and — if a drawer is open — its edges, its
// title and sub sizes, its footer actions, and the x of every checkbox in it.
//
// `--file-chooser` turns on Page.setInterceptFileChooserDialog: a click that would open the
// computer's file picker opens nothing, and the script prints that `Page.fileChooserOpened` fired
// (Task 2b). So "one click opens the picker" is proved without choosing or uploading a file — an
// upload would start a paid reading.
//
// On a page with a composer (a <textarea> in the column) it also prints where typed text starts,
// each overlay line's first glyph against it, the attach line, the actions beside it, and the
// counts line.
//
// `--click key=<id>` clicks the row whose React key is <id> — a checklist or conversation id —
// for when several rows carry the same words.
//
// `--click "<text>"` clicks the first visible button, link or row whose text (or, with none, aria-label) starts with <text>,
// then waits. Repeat it to walk a path (a tab, a row, a button in the drawer). It is the only way
// to open a drawer, and the block above is what makes it safe.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ---- arguments
const argv = process.argv.slice(2)
let fileChooser = false
let path = '/compliance', email = 'testcascade@example.com', width = 1280, shot = null, waitMs = 2500
const clicks = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--as') email = argv[++i]
  else if (a === '--width') width = Number(argv[++i])
  else if (a === '--shot') shot = argv[++i]
  else if (a === '--click') clicks.push(argv[++i])
  else if (a === '--wait') waitMs = Number(argv[++i])
  else if (a === '--file-chooser') fileChooser = true
  else if (a.startsWith('/')) path = a
  else { console.error(`unknown argument: ${a}`); process.exit(2) }
}
if (!Number.isFinite(width) || width < 320) { console.error('--width must be a number of pixels'); process.exit(2) }
const HEIGHT = 900

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9446
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const ref = url.match(/https:\/\/([^.]+)/)[1]

const pub = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data, error } = await pub.auth.signInWithPassword({ email, password: process.env.CHECK_LIVE_PASSWORD })
if (error) { console.error('signin: ' + error.message); process.exit(1) }
const session = data.session

const profile = mkdtempSync(join(tmpdir(), 'cb-measure-'))
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
  '--no-first-run', '--disable-gpu', `--user-data-dir=${profile}`, `--window-size=${width},${HEIGHT}`,
  'about:blank'], { stdio: 'ignore' })

let msgId = 0
const cdp = (ws, method, params = {}) => new Promise((res, rej) => {
  const id = ++msgId
  const on = (e) => { const m = JSON.parse(e.data); if (m.id !== id) return
    ws.removeEventListener('message', on); m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result) }
  ws.addEventListener('message', on); ws.send(JSON.stringify({ id, method, params }))
})

// ---- the block. Paid routes: anything that can reach a model. Writes: anything that can change a row.
const PAID = /\/api\/(chat|document-scan|document-rescan|checklists|document-actions|switches\/answer)|\/summarise\b/
const isBlocked = (u, method) => {
  if (PAID.test(u)) return 'paid route'
  if (/\/api\/(audit-runs|documents)/.test(u) && method !== 'GET') return 'paid route'
  if (/\/api\//.test(u) && method !== 'GET') return 'write'
  // The browser talks to Supabase directly for reads and some writes. Auth must pass (it is how
  // the page knows who is signed in); a read is a GET or a HEAD; everything else is a write.
  // OPTIONS is the browser's CORS pre-check before a request, not a request: failing it failed every
  // read on the page (found on this script's first run — "Checklists" lost its count).
  if (method === 'OPTIONS') return null
  if (u.includes('.supabase.co/') && !u.includes('/auth/v1/') && method !== 'GET' && method !== 'HEAD') {
    // A POST to an RPC can be a read. None of the pages measured here makes one; if one ever does,
    // it shows up in the blocked list and the block is widened then, on evidence.
    return 'write'
  }
  return null
}
const blocked = []

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
  await cdp(ws, 'Page.enable'); await cdp(ws, 'Runtime.enable'); await cdp(ws, 'Network.enable')
  await cdp(ws, 'Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false })
  await cdp(ws, 'Network.setCacheDisabled', { cacheDisabled: true })
  await cdp(ws, 'Network.clearBrowserCache')

  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.method !== 'Fetch.requestPaused') return
    const { url: u, method } = m.params.request
    const why = isBlocked(u, method)
    if (why) blocked.push(`${why}: ${method} ${u.replace(/\?.*$/, '')}`)
    ws.send(JSON.stringify(why
      ? { id: ++msgId, method: 'Fetch.failRequest', params: { requestId: m.params.requestId, errorReason: 'BlockedByClient' } }
      : { id: ++msgId, method: 'Fetch.continueRequest', params: { requestId: m.params.requestId } }))
  })
  // THE FILE PICKER, INTERCEPTED. With this on, Chrome opens no dialog and emits an event instead.
  let choosers = 0
  if (fileChooser) {
    await cdp(ws, 'Page.setInterceptFileChooserDialog', { enabled: true })
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Page.fileChooserOpened') choosers++ })
  }
  await cdp(ws, 'Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }, { urlPattern: '*.supabase.co/*' }] })

  // *** THE SESSION IS A COOKIE, NOT localStorage *** — `scripts/page-text.mjs` has the reason.
  const name = `sb-${ref}-auth-token`
  const value = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64')
  const CHUNK = 3180
  if (value.length <= CHUNK) {
    await cdp(ws, 'Network.setCookie', { name, value, domain: 'localhost', path: '/' })
  } else {
    for (let i = 0, n = 0; i < value.length; i += CHUNK, n++) {
      await cdp(ws, 'Network.setCookie', { name: `${name}.${n}`, value: value.slice(i, i + CHUNK), domain: 'localhost', path: '/' })
    }
  }

  const evaluate = async (expression) => {
    // `userGesture`: Chrome opens a file picker only from a click a person made. Without it the
    // click lands, the picker is refused, and --file-chooser would report 0 for a working button.
    const { result, exceptionDetails } = await cdp(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }

  await cdp(ws, 'Page.navigate', { url: `http://localhost:3000${path}` })
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const state = await evaluate(`document.querySelector('h1') && !document.body.innerText.includes('Loading…') ? 'ready' : 'wait'`)
    if (state === 'ready') break
  }
  // The page fetches its lists after mount; the title appears before them.
  await new Promise((r) => setTimeout(r, waitMs))

  for (const text of clicks) {
    // Read BEFORE the click: the event can arrive while the click is still being evaluated, and a
    // count taken after it reported 0 for a picker that had opened (found on this flag's first run).
    const before = choosers
    const hit = await evaluate(`(() => {
      const want = ${JSON.stringify(text)}
      const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 }
      const cands = [...document.querySelectorAll('button, a, [role=button], .group.-mx-3')].filter(visible)
      // Inside an open drawer first: a drawer's own button beats a row under the scrim.
      const drawer = document.querySelector('aside.print-drawer')
      const order = drawer ? [...cands.filter((e) => drawer.contains(e)), ...cands.filter((e) => !drawer.contains(e))] : cands
      // The INNERMOST match: a workspace row's handler is on the button inside it, a Documents
      // row's on the row itself. Clicking the outer one of the pair does nothing on the first.
      // A control with no words (a paperclip) is matched by its aria-label.
      const name = (e) => e.textContent.trim() || e.getAttribute('aria-label') || ''
      // \`key=<id>\` clicks the row whose React key is <id>. Workspace rows are keyed by their
      // checklist or conversation id, and nine checklists can share a title (DESIGN.md §7), so a
      // row that must be exactly one row is found by key, not by words.
      const keyOf = (e) => { const k = Object.keys(e).find((x) => x.startsWith('__reactFiber')); return k ? e[k].key : null }
      const matches = want.startsWith('key=')
        ? order.filter((e) => keyOf(e) === want.slice(4)).flatMap((e) => [e, ...e.querySelectorAll('button')].slice(0, 2)).slice(-1)
        : order.filter((e) => name(e).startsWith(want))
      const el = matches.find((e) => !matches.some((o) => o !== e && e.contains(o)))
      if (!el) return null
      el.scrollIntoView({ block: 'center' }); el.click(); return name(el).slice(0, 60)
    })()`)
    if (!hit) throw new Error(`--click: nothing visible starts with "${text}"`)
    await new Promise((r) => setTimeout(r, waitMs))
    console.log(`clicked: ${hit}${fileChooser ? `   → Page.fileChooserOpened fired ${choosers - before} time(s)` : ''}`)
  }

  const out = await evaluate(`(() => {
    const edges = (e) => { if (!e) return null; const b = e.getBoundingClientRect()
      return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) } }
    const inner = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e)
      return { left: Math.round(b.left + parseFloat(cs.paddingLeft)), right: Math.round(b.right - parseFloat(cs.paddingRight)) } }
    const h1 = document.querySelector('h1')
    const col = document.querySelector('.print-page')
    // A tab is a button carrying the underline classes every sectioned page uses; its row is the
    // nearest ancestor with the hairline. Matched on both classes, not one: a selector scoped to a
    // class alone matches things you did not mean (DESIGN.md §6 item 10).
    const tab = col ? [...col.querySelectorAll('button')].find((b) => /(^| )-mb-px( |$)/.test(b.className) && /border-b-2/.test(b.className)) : null
    const row = tab ? tab.closest('.border-b') : null
    const footer = document.querySelector('main > footer')
    const footerBox = footer ? footer.firstElementChild : null
    const footerText = footer ? footer.querySelector('p') : null
    const d = document.querySelector('aside.print-drawer')
    let drawer = null
    if (d) {
      const fs = (e) => e ? getComputedStyle(e).fontSize : null
      const checks = [...d.querySelectorAll('button[aria-label="Mark done"]')].map((c) => Math.round(c.getBoundingClientRect().left))
      const body = d.querySelector('.drawer-body')
      const sizes = {}
      if (body) for (const e of body.querySelectorAll('p, li, span, a, b')) {
        if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
        const k = getComputedStyle(e).fontSize; sizes[k] = (sizes[k] || 0) + 1 }
      drawer = { ...edges(d), title: d.querySelector('h2')?.textContent ?? null, titleSize: fs(d.querySelector('h2')),
        subSize: fs(d.querySelector('header p')),
        footer: d.querySelector('footer') ? [...d.querySelector('footer').children].map((c) => ({
          text: c.textContent.trim(), size: getComputedStyle(c).fontSize,
          bordered: getComputedStyle(c).borderTopWidth !== '0px', left: Math.round(c.getBoundingClientRect().left) })) : null,
        checkboxes: checks.length ? { count: checks.length, distinctX: [...new Set(checks)] } : null,
        bodyTextSizes: sizes }
    }
    let composer = null
    const ta = col ? col.querySelector('textarea') : null
    if (ta) {
      const tb = ta.getBoundingClientRect(); const tcs = getComputedStyle(ta)
      const lh = parseFloat(tcs.lineHeight)
      const typedX = tb.left + parseFloat(tcs.borderLeftWidth) + parseFloat(tcs.paddingLeft)
      const typedTop = tb.top + parseFloat(tcs.borderTopWidth) + parseFloat(tcs.paddingTop)
      const box = ta.closest('.rounded-xl')
      const overlay = box ? box.querySelector('.pointer-events-none') : null
      const lines = overlay ? [...overlay.children].map((p) => {
        const r = document.createRange(); const t = p.firstChild; r.setStart(t, 0); r.setEnd(t, 1)
        const g = r.getBoundingClientRect(); const pb = p.getBoundingClientRect(); const plh = parseFloat(getComputedStyle(p).lineHeight)
        return { text: p.textContent, glyphX: +g.left.toFixed(1), lineTop: +pb.top.toFixed(1), lineCentre: +(pb.top + plh / 2).toFixed(1),
          size: getComputedStyle(p).fontSize, truncated: p.scrollWidth > p.clientWidth }
      }) : []
      const attach = [...col.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Attach'))
      const pin = attach ? attach.querySelector('svg') : null
      const line = attach ? attach.closest('.flex.items-start') : null
      const actions = line ? [...line.querySelectorAll('button')].filter((b) => b !== attach) : []
      const counts = [...col.querySelectorAll('p')].find((p) => /conversations? · /.test(p.textContent))
      composer = {
        box: box ? edges(box) : null, boxTop: box ? Math.round(box.getBoundingClientRect().top) : null, boxBottom: box ? Math.round(box.getBoundingClientRect().bottom) : null,
        placeholder: ta.getAttribute('placeholder'), typedSize: tcs.fontSize,
        typedStart: { x: +typedX.toFixed(1), lineTop: +typedTop.toFixed(1), lineCentre: +(typedTop + lh / 2).toFixed(1) },
        overlay: lines,
        attach: attach ? { text: attach.textContent.trim(), size: getComputedStyle(attach).fontSize, color: getComputedStyle(attach).color,
          pin: pin ? { w: pin.getAttribute('width'), x: Math.round(pin.getBoundingClientRect().left) } : null,
          gap: getComputedStyle(attach).columnGap, left: Math.round(attach.getBoundingClientRect().left),
          top: Math.round(attach.getBoundingClientRect().top) } : null,
        actions: actions.map((b) => ({ text: b.textContent.trim(), ...edges(b), filled: getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)' })),
        counts: counts ? counts.textContent.trim() : null,
      }
    }
    return {
      composer,
      path: location.pathname + location.search, viewport: innerWidth,
      scrollbar: innerWidth - document.documentElement.clientWidth,
      title: h1 ? { text: h1.textContent, x: Math.round(h1.getBoundingClientRect().left) } : null,
      column: col ? { box: edges(col), content: inner(col) } : null,
      tabRow: row ? { ...edges(row), tabs: [...row.querySelectorAll('button')].map((b) => b.textContent.trim()) } : null,
      footer: footerBox ? { box: edges(footerBox), content: inner(footerBox), textStartsAt: footerText ? Math.round(footerText.getBoundingClientRect().left) : null } : null,
      drawer,
    }
  })()`)

  const o = out
  console.log(`\n  ${o.path} at ${o.viewport}px (vertical scrollbar ${o.scrollbar}px) as ${email}`)
  console.log(`  title            ${o.title ? `x=${o.title.x}   "${o.title.text}"` : 'none'}`)
  console.log(`  column box       ${o.column ? `${o.column.box.left}–${o.column.box.right} (${o.column.box.width})` : 'no .print-page'}`)
  console.log(`  column content   ${o.column ? `${o.column.content.left}–${o.column.content.right}` : '-'}`)
  console.log(`  tab row          ${o.tabRow ? `${o.tabRow.left}–${o.tabRow.right}   ${o.tabRow.tabs.join(' | ')}` : 'none'}`)
  console.log(`  footer content   ${o.footer ? `${o.footer.content.left}–${o.footer.content.right}   text starts x=${o.footer.textStartsAt}` : 'none'}`)
  if (o.composer) {
    const c = o.composer
    console.log(`  composer box     ${c.box ? `${c.box.left}–${c.box.right} (${c.box.width}), top y=${c.boxTop}, bottom y=${c.boxBottom}` : '-'}   placeholder: ${c.placeholder === null ? 'none' : `"${c.placeholder}"`}`)
    console.log(`  typed text       starts x=${c.typedStart.x}, first line top y=${c.typedStart.lineTop}, centre y=${c.typedStart.lineCentre}, ${c.typedSize}`)
    for (const l of c.overlay) console.log(`    overlay        x=${l.glyphX} (Δ${(l.glyphX - c.typedStart.x).toFixed(1)})  top y=${l.lineTop}  centre y=${l.lineCentre}  ${l.size}${l.truncated ? ' …cut' : ''}  "${l.text}"`)
    if (c.attach) console.log(`  attach line      x=${c.attach.left} y=${c.attach.top}  ${c.attach.size} ${c.attach.color}  pin ${c.attach.pin ? `${c.attach.pin.w}px at x=${c.attach.pin.x}` : 'none'}  gap ${c.attach.gap}  "${c.attach.text}"`)
    for (const b of c.actions) console.log(`    action         ${b.left}–${b.right}  ${b.filled ? 'filled' : 'outlined'}  "${b.text}"`)
    console.log(`  counts line      ${c.counts ? `"${c.counts}"` : 'none'}`)
  }
  if (o.drawer) {
    const d = o.drawer
    console.log(`  drawer           ${d.left}–${d.right} (${d.width})   "${(d.title ?? '').slice(0, 60)}"`)
    console.log(`    title ${d.titleSize} · sub ${d.subSize}`)
    if (d.footer) console.log(`    footer: ${d.footer.map((f) => `${f.text} [${f.size}${f.bordered ? ', outlined' : ''}, x=${f.left}]`).join(' · ')}`)
    if (d.checkboxes) console.log(`    checkboxes: ${d.checkboxes.count}, distinct x: ${d.checkboxes.distinctX.join(', ')}`)
    console.log(`    body text sizes: ${Object.entries(d.bodyTextSizes).map(([k, n]) => `${k}×${n}`).join(' ')}`)
  } else console.log('  drawer           none open')

  // *** THE FONTS, AS DECLARED AND AS RENDERED — the self-hosting change. *** The computed
  // font-family says what the CSS asks for; `CSS.getPlatformFontsForNode` says what Chrome actually
  // drew the glyphs with, which is the only way to tell the real file from its size-adjusted fallback.
  {
    await evaluate(`document.fonts.ready.then(() => true)`)
    await cdp(ws, 'DOM.enable'); await cdp(ws, 'CSS.enable')
    const { root } = await cdp(ws, 'DOM.getDocument', { depth: -1 })
    for (const [label, selector] of [['title', 'h1'], ['body text', '.print-page p']]) {
      const { nodeId } = await cdp(ws, 'DOM.querySelector', { nodeId: root.nodeId, selector })
      if (!nodeId) { console.log(`  font ${label.padEnd(11)} no ${selector}`); continue }
      const declared = await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).fontFamily`)
      const { fonts } = await cdp(ws, 'CSS.getPlatformFontsForNode', { nodeId })
      console.log(`  font ${label.padEnd(11)} ${declared}   rendered: ${fonts.map((f) => `${f.familyName} (${f.isCustomFont ? 'web font' : 'system'}, ${f.glyphCount} glyphs)`).join(' + ')}`)
    }
  }

  if (shot) {
    const s = await cdp(ws, 'Page.captureScreenshot', { format: 'png' })
    writeFileSync(shot, Buffer.from(s.data, 'base64'))
    console.log(`  screenshot       ${shot}`)
  }
} finally {
  console.log(`\n  BLOCKED (${blocked.length}): ${blocked.length ? '\n    ' + [...new Set(blocked)].join('\n    ') : 'nothing — no paid route and no write was attempted'}`)
  try {
    const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    const ws2 = new WebSocket(v.webSocketDebuggerUrl)
    await new Promise((r) => { ws2.onopen = r; ws2.onerror = r })
    await cdp(ws2, 'Browser.close').catch(() => {})
  } catch {}
  proc.kill()
  try { execFileSync('/bin/sh', ['-c', `pkill -f 'remote-debugging-port=${PORT}' || true`]) } catch {}
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
}

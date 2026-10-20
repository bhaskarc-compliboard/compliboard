// WHERE THINGS SIT ON A SIGNED-IN PAGE, MEASURED — Workspace layout, Task 2.
//
//   npm run measure -- /compliance
//   npm run measure -- /compliance --as testgamma@example.com --click Conversations --click "What did I"
//   npm run measure -- /audits --width 1440 --height 1180 --shot /tmp/audits.png
//   npm run measure -- /calendar --print --shot shots/calendar-print.png
//
// *** MEASURE RATHER THAN LOOK. *** `DESIGN.md` §6 item 10. Two edges that differ by 24px look the
// same in a screenshot and are not the same; this prints the numbers. Written after Task 1 found
// the footer lined up with no page's title, which nobody had seen by looking.
//
// Built from `scripts/page-text.mjs`: the same sign-in (a fixture login, the session written as the
// cookie `@supabase/ssr` reads) and the same Chrome handling (DevTools protocol, closed over the
// protocol, its port swept afterwards). Differences, each on purpose:
//
//   · 1280×900 by default, `--width <px>` and `--height <px>` to change it. The window AND the device metrics are set,
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
// `--base <origin>` opens another server than http://localhost:3000 — Workspace Task 6, so a
// screenshot need not touch the owner's own dev server.
//
// `--allow <text>` lets through the ONE request whose URL contains <text>, even a paid one. It is the
// only way this script spends money, and it exists for one real click ("How do I do this?" while it
// researches). Every request it lets through is printed, beside the blocked list.
//
// `--log <text>` prints every request whose URL contains <text>, in order, after the clicks — the
// round trips a page makes, counted from the browser rather than from reading the code.
//
// `--scroll "<text>"` scrolls the first visible element whose text starts with <text> to the top of
// its scrolling box, after the clicks, before the screenshot.
//
// `--date "<YYYY-MM-DD>"` fills the first visible `input[type=date]` — Calendar step 14b, so the
// drawer's "Set the day" can be WALKED and not only unit-tested. `--type` cannot do it: it looks
// for a textarea or a text input, and a date input is neither. Set through the native setter
// before a bubbling `input` and `change`, for the reason --select does: a plain assignment leaves
// React's own state behind, so the field would photograph as filled and submit as empty.
//
// `--type "<text>"` types into the first visible textarea — Calendar step 10b, so a question can
// be ASKED by the harness rather than only clicked at. Set through the native setter and an
// `input` event, for the reason --select sets a value that way: a plain assignment leaves React's
// own state behind, so the page would photograph as filled and behave as empty.
//
// `--select "<row text>=<option>"` chooses an option in a <select> — Calendar step 9. The script
// could click a button and scroll a box but had no way to answer a dropdown, so the queue's
// how-often picker and the Calendar's site filter could not be walked at all. The select is found
// by the row it sits in (the first ancestor within six levels whose text starts with <row text>;
// an empty key takes the first visible select), and the value is set THROUGH THE NATIVE SETTER
// before a bubbling `change` — assigning `.value` alone leaves React's own state behind, so the
// page would photograph as changed and behave as unchanged. Applied before the clicks.
//
// `--click "<row text>=<button text>"` clicks the button inside a named row, which is how a row's
// own action is told apart from a group's: see the note at the matcher. `--click "=Ask"` matches
// the text EXACTLY, for a button whose name is the start of something else's.
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
// *** THE WINDOW'S HEIGHT, Calendar step 8a. *** It was a fixed 900, and `Page.captureScreenshot`
// photographs the viewport — so a shot of anything taller than 900 was silently cut off at the
// fold. `docs/calendar-boards.html` draws board 4 at 900 and board 5 at 1180, and a month grid
// whose last week is missing from the picture cannot be compared with the board it copies.
let height = 900
// *** --print: PHOTOGRAPH THE PAGE AS PAPER SEES IT — Calendar step 8b. ***
// `.no-print`, `.print-only` and `hidden print:block` only mean anything inside `@media print`, so
// a screen screenshot cannot show what a printed page looks like — and the Calendar's month view
// deliberately prints as the LIST. `Emulation.setEmulatedMedia` switches the media type for the
// capture, which is the only honest way to check a print rule without a printer.
let printMedia = false
let base = 'http://localhost:3000', allow = null, logFilter = null
/**
 * *** THE ACTIONS RUN IN THE ORDER THEY WERE WRITTEN — Calendar step 10b. ***
 * They used to run in three loops (every --select, then every --type, then every --click), which
 * is fine for one step and silently wrong for a walk: `--type A --click Ask --type B --click Send`
 * typed A, typed B over it, then clicked twice, so the first question was never asked and the
 * second was asked once. One ordered list, one loop.
 */
const actions = []
const clicks = [], scrolls = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--as') email = argv[++i]
  else if (a === '--width') width = Number(argv[++i])
  else if (a === '--height') height = Number(argv[++i])
  else if (a === '--print') printMedia = true
  else if (a === '--shot') shot = argv[++i]
  else if (a === '--click') { const v = argv[++i]; clicks.push(v); actions.push({ kind: 'click', value: v }) }
  else if (a === '--select') actions.push({ kind: 'select', value: argv[++i] })
  else if (a === '--type') actions.push({ kind: 'type', value: argv[++i] })
  else if (a === '--date') actions.push({ kind: 'date', value: argv[++i] })
  else if (a === '--wait') waitMs = Number(argv[++i])
  else if (a === '--file-chooser') fileChooser = true
  else if (a === '--base') base = argv[++i].replace(/\/+$/, '')
  else if (a === '--allow') allow = argv[++i]
  else if (a === '--log') logFilter = argv[++i]
  else if (a === '--scroll') scrolls.push(argv[++i])
  else if (a.startsWith('/')) path = a
  else { console.error(`unknown argument: ${a}`); process.exit(2) }
}
if (!Number.isFinite(width) || width < 320) { console.error('--width must be a number of pixels'); process.exit(2) }
if (!Number.isFinite(height) || height < 400) { console.error('--height must be a number of pixels'); process.exit(2) }
const HEIGHT = height

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

// *** THE DRAWER MEASURED IS THE VISIBLE ONE — Calendar step 8b. ***
// `document.querySelector('aside.print-drawer')` takes the FIRST in the document, and since step 8b
// a page can hold two: the Calendar's date drawer, hidden, with a document's or an audit's report
// over it (the shape `app/audits/page.tsx` has had since Run 4a). The first one then measures
// 0–0 (0) and prints the wrong footer — a measurement that is not of the thing on the screen.
// `components/Drawer.tsx` `visibleDrawer()` already solves this for printing, the same way.
const VISIBLE_DRAWER = "(() => { const a = [...document.querySelectorAll('aside.print-drawer')].filter((d) => d.getClientRects().length > 0); return a[a.length - 1] ?? null })()"
// ---- the block. Paid routes: anything that can reach a model. Writes: anything that can change a row.
const PAID = /\/api\/(chat|document-scan|document-rescan|checklists|checklist-items|document-actions|switches\/answer)|\/summarise\b/
const allowed = []
const seen = []
const isBlocked = (u, method) => {
  if (allow && u.includes(allow) && method !== 'OPTIONS') { allowed.push(`${method} ${u.replace(/\?.*$/, '')}`); return null }
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
    if (logFilter && u.includes(logFilter) && method !== 'OPTIONS') seen.push(`${method} ${decodeURIComponent(u.replace(/^https?:\/\/[^/]+/, ''))}`)
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

  await cdp(ws, 'Page.navigate', { url: `${base}${path}` })
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const state = await evaluate(`document.querySelector('h1') && !document.body.innerText.includes('Loading…') ? 'ready' : 'wait'`)
    if (state === 'ready') break
  }
  // The page fetches its lists after mount; the title appears before them.
  await new Promise((r) => setTimeout(r, waitMs))

  for (const action of actions) {
   if (action.kind === 'type') {
    const text = action.value
    const typed = await evaluate(`(() => {
      const want = ${JSON.stringify(text)}
      const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 }
      const el = [...document.querySelectorAll('textarea, input[type=text]')].filter(visible)[0]
      if (!el) return null
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, want)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.focus()
      return want.slice(0, 60)
    })()`)
    if (!typed) throw new Error('--type: no visible textarea or text input on the page')
    await new Promise((r) => setTimeout(r, 300))
    console.log(`typed: ${typed}`)
   } else if (action.kind === 'date') {
    const want = action.value
    const filled = await evaluate(`(() => {
      const want = ${JSON.stringify(want)}
      const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 }
      const el = [...document.querySelectorAll('input[type=date]')].filter(visible)[0]
      if (!el) return null
      // React tracks the value on the node; a plain assignment is invisible to it, which is how a
      // field photographs as filled and submits as empty (the same trap --select documents).
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, want)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.scrollIntoView({ block: 'center' })
      return (el.getAttribute('aria-label') || 'date') + ' = ' + el.value
    })()`)
    if (!filled) throw new Error('--date: no visible input[type=date] on the page')
    await new Promise((r) => setTimeout(r, 300))
    console.log(`dated: ${filled}`)
   } else if (action.kind === 'select') {
    const pair = action.value
    const at = pair.indexOf('=')
    const where = at === -1 ? '' : pair.slice(0, at)
    const value = at === -1 ? pair : pair.slice(at + 1)
    const chose = await evaluate(`(() => {
      const want = ${JSON.stringify(where)}, value = ${JSON.stringify(value)}
      const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 }
      const sels = [...document.querySelectorAll('select')].filter(visible)
      // The select belonging to a named row: the nearest ancestor whose text starts with the key.
      const near = (el) => { let n = el
        for (let i = 0; i < 6 && n; i++, n = n.parentElement) {
          if ((n.textContent || '').trim().startsWith(want)) return true }
        return false }
      const el = want ? sels.find(near) : sels[0]
      if (!el) return null
      const opt = [...el.options].find((o) => o.text === value || o.value === value)
      if (!opt) return 'NO OPTION: ' + [...el.options].map((o) => o.text).join(' | ')
      // React tracks the value on the node; a plain assignment is invisible to it.
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(el, opt.value)
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.scrollIntoView({ block: 'center' })
      return (el.getAttribute('aria-label') || 'select') + ' = ' + opt.text
    })()`)
    if (!chose) throw new Error(`--select: no visible select in a row starting with "${where}"`)
    if (String(chose).startsWith('NO OPTION')) throw new Error(`--select: ${chose}`)
    await new Promise((r) => setTimeout(r, 300))
    console.log(`chose: ${chose}`)
   } else {
    const text = action.value
    // Read BEFORE the click: the event can arrive while the click is still being evaluated, and a
    // count taken after it reported 0 for a picker that had opened (found on this flag's first run).
    const before = choosers
    const hit = await evaluate(`(() => {
      const want = ${JSON.stringify(text)}
      const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 }
      const cands = [...document.querySelectorAll('button, a, [role=button], .group.-mx-3')].filter(visible)
      // Inside an open drawer first: a drawer's own button beats a row under the scrim.
      const drawer = ${VISIBLE_DRAWER}
      const order = drawer ? [...cands.filter((e) => drawer.contains(e)), ...cands.filter((e) => !drawer.contains(e))] : cands
      // The INNERMOST match: a workspace row's handler is on the button inside it, a Documents
      // row's on the row itself. Clicking the outer one of the pair does nothing on the first.
      // A control with no words (a paperclip) is matched by its aria-label.
      const name = (e) => e.textContent.trim() || e.getAttribute('aria-label') || ''
      // \`key=<id>\` clicks the row whose React key is <id>. Workspace rows are keyed by their
      // checklist or conversation id, and nine checklists can share a title (DESIGN.md §7), so a
      // row that must be exactly one row is found by key, not by words.
      const keyOf = (e) => { const k = Object.keys(e).find((x) => x.startsWith('__reactFiber')); return k ? e[k].key : null }
      /**
       * "row text=button text" clicks the button inside a NAMED ROW — Calendar step 9, and it is
       * here because prefix matching quietly clicked the wrong thing: --click Confirm on the
       * confirm queue matched "Confirm all from this audit", the group button, which comes first
       * in the document and also starts with Confirm. Two dates were confirmed that the walk never
       * meant to touch. A row is named the same way --select names one: the nearest ancestor
       * within six levels whose text starts with the key.
       *
       * NO BACKTICKS IN THIS COMMENT. It lives inside the browser template literal, and one
       * backtick ends the string — which is how this edit first broke the whole script.
       */
      const at = want.indexOf('=')
      const scope = at > 0 && !want.startsWith('key=') ? want.slice(0, at) : null
      const label = scope ? want.slice(at + 1) : want
      // A LEADING "=" MEANS EXACTLY THIS TEXT — Calendar step 10b. --click Ask matched the TAB
      // "Ask a question", which starts with it, and the question was never sent. Prefix matching
      // is right for a row and wrong for a one-word button beside a tab of the same name.
      const exact = label.startsWith('=') ? label.slice(1) : null
      const inRow = (e) => { let n = e
        for (let i = 0; i < 6 && n; i++, n = n.parentElement) {
          if ((n.textContent || '').trim().startsWith(scope)) return true }
        return false }
      const matches = want.startsWith('key=')
        ? order.filter((e) => keyOf(e) === want.slice(4)).flatMap((e) => [e, ...e.querySelectorAll('button')].slice(0, 2)).slice(-1)
        : order.filter((e) => (exact ? name(e) === exact : name(e).startsWith(label)) && (!scope || inRow(e)))
      const el = matches.find((e) => !matches.some((o) => o !== e && e.contains(o)))
      if (!el) return null
      el.scrollIntoView({ block: 'center' }); el.click(); return name(el).slice(0, 60)
    })()`)
    if (!hit) throw new Error(`--click: nothing visible starts with "${text}"`)
    await new Promise((r) => setTimeout(r, waitMs))
    console.log(`clicked: ${hit}${fileChooser ? `   → Page.fileChooserOpened fired ${choosers - before} time(s)` : ''}`)
   }
  }

  const out = await evaluate(`(() => {
    const edges = (e) => { if (!e) return null; const b = e.getBoundingClientRect()
      return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) } }
    const inner = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e)
      return { left: Math.round(b.left + parseFloat(cs.paddingLeft)), right: Math.round(b.right - parseFloat(cs.paddingRight)) } }
    const h1 = document.querySelector('h1')
    // THE COLUMN, AND WHY IT IS NOT JUST .print-page ANY MORE — Dashboard step 5.
    // Every measured page until now carried .print-page, so that class was doing two jobs: the
    // one print rule that hides the page while a drawer prints, and, here, "this is the column".
    // The Dashboard is the first page that deliberately has neither a drawer nor a print
    // (DASHBOARD-PLAN decision 11), so it carries no .print-page and measured as
    // "column box: no .print-page" -- the tool could not see a column that was plainly there.
    // So it now also looks for what the column actually IS: the 900 wrapper every rebuilt page
    // shares. .print-page stays first, so nothing about the printable pages changes.
    const col = document.querySelector('.print-page') || document.querySelector('main [class*="max-w-[900px]"]')
    // A tab is a button carrying the underline classes every sectioned page uses; its row is the
    // nearest ancestor with the hairline. Matched on both classes, not one: a selector scoped to a
    // class alone matches things you did not mean (DESIGN.md §6 item 10).
    const tab = col ? [...col.querySelectorAll('button')].find((b) => /(^| )-mb-px( |$)/.test(b.className) && /border-b-2/.test(b.className)) : null
    const row = tab ? tab.closest('.border-b') : null
    const footer = document.querySelector('main > footer')
    const footerBox = footer ? footer.firstElementChild : null
    const footerText = footer ? footer.querySelector('p') : null
    const d = ${VISIBLE_DRAWER}
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
      // *** THE ATTACH LINE IS FOUND BY ITS PIN, NOT BY THE WORD "Attach" — Calendar step 7. ***
      // This read startsWith('Attach'), which was the workspace's wording. HR Step 11a replaced it
      // with "Add a handbook", so from that day THIS LINE PRINTED "none" FOR HR and nobody noticed:
      // a measurement that cannot see the thing looks exactly like a measurement that found it
      // missing (CLAUDE.md §9a). The mark is now the control's own shape — a button or a link
      // carrying the paperclip — so it finds the workspace's, HR's, and the Calendar's, which is an
      // anchor to Company Documents. (No backticks in here: this whole block is inside a template
      // literal sent to the browser, and one backtick ends it — which is how this comment was
      // written the first time, and the script would not parse.)
      const attach = [...col.querySelectorAll('button, a')]
        .find((b) => b.querySelector('svg') && /^(Attach|Add )/.test(b.textContent.trim()))
      const pin = attach ? attach.querySelector('svg') : null
      const line = attach ? attach.closest('.flex.items-start') : null
      const actions = line ? [...line.querySelectorAll('button')].filter((b) => b !== attach) : []
      // AND THE COUNTS LINE BY ITS BOX, NOT BY ITS WORDS. Matching text found HR's line only while
      // HR had conversations to count, and found the Calendar's only while it had none: three
      // sections, three wordings, and the Calendar leaves out any fragment whose number is 0. All
      // three draw the same thing — one 13px grey paragraph inside the bordered strip under the box
      // — so that is what is looked for.
      const strip = [...col.querySelectorAll('div')]
        .find((d) => /border-b/.test(d.className) && /pb-3/.test(d.className) && d.querySelector('p'))
      const counts = strip ? strip.querySelector('p') : null
      composer = {
        box: box ? edges(box) : null, boxTop: box ? Math.round(box.getBoundingClientRect().top) : null, boxBottom: box ? Math.round(box.getBoundingClientRect().bottom) : null,
        placeholder: ta.getAttribute('placeholder'), typedSize: tcs.fontSize,
        typedStart: { x: +typedX.toFixed(1), lineTop: +typedTop.toFixed(1), lineCentre: +(typedTop + lh / 2).toFixed(1) },
        overlay: lines,
        attach: attach ? { text: attach.textContent.trim(), size: getComputedStyle(attach).fontSize, color: getComputedStyle(attach).color,
          pin: pin ? { w: pin.getAttribute('width'), x: Math.round(pin.getBoundingClientRect().left) } : null,
          gap: getComputedStyle(attach).columnGap, left: Math.round(attach.getBoundingClientRect().left),
          top: Math.round(attach.getBoundingClientRect().top) } : null,
        // "disabled" is printed too (Calendar step 7): the shell's one action is deliberately off, and
        // a filled green button that cannot be pressed is the thing a screenshot cannot tell you.
        actions: actions.map((b) => ({ text: b.textContent.trim(), ...edges(b), disabled: b.disabled === true, filled: getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)' })),
        counts: counts ? counts.textContent.trim() : null,
      }
    }
    return {
      composer,
      path: location.pathname + location.search, viewport: innerWidth,
      scrollbar: innerWidth - document.documentElement.clientWidth,
      title: h1 ? { text: h1.textContent, x: Math.round(h1.getBoundingClientRect().left) } : null,
      column: col ? { box: edges(col), content: inner(col) } : null,
      // Buttons AND links: the Calendar's side control is an anchor (it only changes the address
      // until steps 8 to 10 give it behaviour), so a buttons-only read printed the row without it.
      tabRow: row ? { ...edges(row), tabs: [...row.querySelectorAll('button, a')].map((b) => b.textContent.trim()) } : null,
      footer: footerBox ? { box: edges(footerBox), content: inner(footerBox), textStartsAt: footerText ? Math.round(footerText.getBoundingClientRect().left) : null } : null,
      drawer,
    }
  })()`)

  const o = out
  console.log(`\n  ${o.path} at ${o.viewport}px (vertical scrollbar ${o.scrollbar}px) as ${email}`)
  console.log(`  title            ${o.title ? `x=${o.title.x}   "${o.title.text}"` : 'none'}`)
  console.log(`  column box       ${o.column ? `${o.column.box.left}–${o.column.box.right} (${o.column.box.width})` : 'no column found'}`)
  console.log(`  column content   ${o.column ? `${o.column.content.left}–${o.column.content.right}` : '-'}`)
  console.log(`  tab row          ${o.tabRow ? `${o.tabRow.left}–${o.tabRow.right}   ${o.tabRow.tabs.join(' | ')}` : 'none'}`)
  console.log(`  footer content   ${o.footer ? `${o.footer.content.left}–${o.footer.content.right}   text starts x=${o.footer.textStartsAt}` : 'none'}`)
  if (o.composer) {
    const c = o.composer
    console.log(`  composer box     ${c.box ? `${c.box.left}–${c.box.right} (${c.box.width}), top y=${c.boxTop}, bottom y=${c.boxBottom}` : '-'}   placeholder: ${c.placeholder === null ? 'none' : `"${c.placeholder}"`}`)
    console.log(`  typed text       starts x=${c.typedStart.x}, first line top y=${c.typedStart.lineTop}, centre y=${c.typedStart.lineCentre}, ${c.typedSize}`)
    for (const l of c.overlay) console.log(`    overlay        x=${l.glyphX} (Δ${(l.glyphX - c.typedStart.x).toFixed(1)})  top y=${l.lineTop}  centre y=${l.lineCentre}  ${l.size}${l.truncated ? ' …cut' : ''}  "${l.text}"`)
    if (c.attach) console.log(`  attach line      x=${c.attach.left} y=${c.attach.top}  ${c.attach.size} ${c.attach.color}  pin ${c.attach.pin ? `${c.attach.pin.w}px at x=${c.attach.pin.x}` : 'none'}  gap ${c.attach.gap}  "${c.attach.text}"`)
    for (const b of c.actions) console.log(`    action         ${b.left}–${b.right}  ${b.filled ? 'filled' : 'outlined'}${b.disabled ? ', disabled' : ''}  "${b.text}"`)
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
    for (const [label, selector] of [['title', 'h1'], ['body text', '.print-page p, main [class*="max-w-[900px]"] p']]) {
      const { nodeId } = await cdp(ws, 'DOM.querySelector', { nodeId: root.nodeId, selector })
      if (!nodeId) { console.log(`  font ${label.padEnd(11)} no ${selector}`); continue }
      const declared = await evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).fontFamily`)
      const { fonts } = await cdp(ws, 'CSS.getPlatformFontsForNode', { nodeId })
      console.log(`  font ${label.padEnd(11)} ${declared}   rendered: ${fonts.map((f) => `${f.familyName} (${f.isCustomFont ? 'web font' : 'system'}, ${f.glyphCount} glyphs)`).join(' + ')}`)
    }
  }

  for (const text of scrolls) {
    const hit = await evaluate(`(() => {
      const want = ${JSON.stringify(text)}
      const all = [...document.querySelectorAll('aside.print-drawer *, main *')]
        .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 })
      const el = all.find((e) => e.textContent.trim().startsWith(want) && ![...e.children].some((c) => c.textContent.trim().startsWith(want)))
      if (!el) return null
      el.scrollIntoView({ block: 'start' }); return el.textContent.trim().slice(0, 60)
    })()`)
    if (!hit) throw new Error(`--scroll: nothing visible starts with "${text}"`)
    await new Promise((r) => setTimeout(r, 400))
    console.log(`scrolled to: ${hit}`)
  }
  if (allowed.length) console.log(`  let through (--allow ${allow}): ${allowed.join(' · ')}`)
  if (logFilter) { console.log(`  requests matching "${logFilter}": ${seen.length}`); for (const r of seen) console.log(`    ${r.slice(0, 220)}`) }

  if (printMedia) {
    await cdp(ws, 'Emulation.setEmulatedMedia', { media: 'print' })
    await new Promise((r) => setTimeout(r, 400))
    console.log('  media            print (emulated for the capture)')
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

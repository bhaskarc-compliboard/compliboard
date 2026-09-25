#!/usr/bin/env node
// RENDER THE GOLDEN DOCUMENT FIXTURES — Documents Run 2, part 1.
//
//   npm run golden:docs:render            render all seven fixtures
//   npm run golden:docs:render -- 04      render one, by case-id prefix
//
// *** THE TEXT IS NEVER RETYPED. *** Each spec file in tests/golden/documents/ carries a
// DOCUMENT TEXT section; this script reads it, lays it out, and renders it. Nothing here
// contains a sentence of a document. The brief's rule — "do not add, remove or reword
// anything in a document; the answer keys depend on the exact text" — is therefore enforced
// by construction rather than by care, and then CHECKED: after building the HTML the script
// strips it back to text and compares it, whitespace-normalised, with the spec's own. A
// mismatch refuses to write the file and prints the first difference.
//
// WHY CHROME. There is no PDF library in this project and adding one for a test fixture would
// be a dependency the product does not need. Chrome is already on the machine, speaks the
// DevTools Protocol over a WebSocket that Node 24 has built in, and its print engine does
// multi-page text layout, table pagination and landscape properly. Same approach as the
// layout-measurement harness: no new dependencies.
//
// 06b IS A PHOTOGRAPH, NOT TEXT. Page 1 of the log is rendered tilted under uneven light,
// captured as a JPEG, and wrapped in a one-page PDF whose only content is that image. It has
// no text layer on purpose: it is the case that tests whether the model can read a photo of a
// page, and a PDF with selectable text underneath would test nothing.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const DIR = 'tests/golden/documents'
const OUT = `${DIR}/fixtures`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const only = process.argv.slice(2).find((a) => !a.startsWith('--'))

const die = (m) => { console.error(`\n  ${m}\n`); process.exit(1) }
if (!existsSync(CHROME)) die(`No Chrome at ${CHROME}. This renders fixtures through Chrome's print engine.`)
mkdirSync(OUT, { recursive: true })

// ---------------------------------------------------------------------------
// 1. THE SPEC'S OWN WORDS
// ---------------------------------------------------------------------------
function documentText(specFile) {
  const src = readFileSync(`${DIR}/${specFile}`, 'utf8')
  const m = src.match(/## DOCUMENT TEXT\n([\s\S]*?)\n---\n\n## ANSWER KEY/)
  if (!m) die(`${specFile}: could not find the DOCUMENT TEXT section.`)
  return m[1].trim()
}
const blocksOf = (text) => text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)

// ---------------------------------------------------------------------------
// 2. LAYOUT. Layout is ours; the words are not.
// ---------------------------------------------------------------------------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const isTable = (b) => b.split('\n')[0].trim().startsWith('|')
const isSeparatorRow = (l) => /^\|[\s:|-]+\|$/.test(l.trim())

/** A heading is a short single line that opens a numbered or capitalised section. */
function isHeading(b) {
  if (b.includes('\n') || b.length > 60) return false
  return /^\d+\.\s/.test(b) || /^SECTION\s/.test(b) || /^[A-Z0-9 ,.\-/&()·]+$/.test(b)
}

function tableHtml(block) {
  const lines = block.split('\n').filter((l) => l.trim())
  const rows = lines.filter((l) => !isSeparatorRow(l))
    .map((l) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
  const head = rows[0], body = rows.slice(1)
  return `<table><thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`
    + `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

function blockHtml(b, opts = {}) {
  if (isTable(b)) return tableHtml(b)
  if (isHeading(b)) return `<h2>${esc(b)}</h2>`
  const cls = opts.cls ? ` class="${opts.cls}"` : ''
  return `<p${cls}>${b.split('\n').map((l) => esc(l)).join('<br>')}</p>`
}

/** Group blocks into pages by index ranges, then wrap each in a .page section. */
function paginate(blocks, ranges, perBlockOpts = {}) {
  return ranges.map((r, pageIdx) => {
    const inner = blocks.slice(r[0], r[1] + 1)
      .map((b, i) => blockHtml(b, perBlockOpts[r[0] + i] ?? {})).join('\n')
    return `<section class="page page${pageIdx + 1}">${inner}</section>`
  }).join('\n')
}

const BASE_CSS = `
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; }
  /* No fi/fl ligatures: they land in the PDF's text layer as U+FB01 and a word-for-word quote
     check on "certified" would be comparing against "certiﬁed". Layout only, no words changed. */
  body { margin: 0; font-family: "Times New Roman", Times, serif; color: #111;
         font-variant-ligatures: none; -webkit-font-feature-settings: "liga" 0, "clig" 0; }
  /* NOT overflow:hidden. Hidden would CLIP a fixture silently and the file would still look
     right; visible spills onto an extra page instead, so the page-count check below catches it. */
  .page { width: 8.5in; height: 11in; padding: 1in 1in 0.9in; page-break-after: always;
          position: relative; overflow: visible; }
  .page:last-child { page-break-after: auto; }
  h2 { font-size: 12.5pt; font-weight: bold; margin: 18pt 0 7pt; }
  p { font-size: 11pt; line-height: 1.5; margin: 0 0 11pt; text-align: justify; }
  table { border-collapse: collapse; width: 100%; font-size: 8.5pt; margin: 6pt 0 12pt; }
  th, td { border: 0.5pt solid #444; padding: 3pt 4pt; text-align: left; vertical-align: top;
           line-height: 1.3; }
  th { background: #eee; font-weight: bold; }
`

function htmlPage(title, css, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>`
    + `<style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`
}

// ---------------------------------------------------------------------------
// The seven fixtures. Each says which spec it comes from, how many pages the spec's
// "Render as" line asks for, and how the blocks fall across them.
// ---------------------------------------------------------------------------
const FIXTURES = {
  '01-eap-chemical': {
    spec: '01-eap-chemical.md', file: '01-eap-chemical.pdf', pages: 5,
    build(blocks) {
      // "a cover block with the company name, title and Revised February 2021" — block 0 is
      // exactly that, so it becomes the cover page and the six numbered sections follow.
      const css = `
        .page1 { padding-top: 3.2in; text-align: center; }
        .page1 p { text-align: center; font-size: 15pt; line-height: 2.1; letter-spacing: .4pt; }
      `
      return htmlPage('Emergency Action Plan', css,
        paginate(blocks, [[0, 0], [1, 4], [5, 8], [9, 12], [13, 15]]))
    },
  },
  '02-acdp-chemical': {
    spec: '02-acdp-chemical.md', file: '02-acdp-chemical.pdf', pages: 6,
    build(blocks) {
      // "agency-letter layout with a DEQ-style header block ... numbered conditions."
      const css = `
        .page1 p:first-child { text-align: center; font-size: 13pt; font-weight: bold;
          line-height: 1.45; letter-spacing: .3pt; margin-bottom: 4pt; }
        .page1 p:first-child + p { text-align: center; font-size: 12.5pt; font-weight: bold;
          margin-top: 16pt; padding-top: 10pt; border-top: 1.5pt solid #111; }
        .page1 p:nth-child(3) { font-family: Georgia, serif; font-size: 10.5pt; line-height: 1.9;
          text-align: left; margin-top: 22pt; border-left: 2pt solid #444; padding-left: 12pt; }
        .page p:last-child { margin-bottom: 0; }
      `
      return htmlPage('Standard Air Contaminant Discharge Permit', css,
        paginate(blocks, [[0, 3], [4, 8], [9, 15], [16, 19], [20, 22], [23, 26]]))
    },
  },
  '03-olcc-cannabis': {
    spec: '03-olcc-cannabis.md', file: '03-olcc-cannabis.pdf', pages: 1,
    build(blocks) {
      // "certificate layout: the agency name as text at the top (no real seal), a bordered
      // block with the licence details, a signature line."
      const css = `
        .page { padding: 0.55in; }
        .frame { border: 3pt double #222; height: 100%; padding: 20pt 28pt; }
        p { font-size: 10pt; text-align: left; margin-bottom: 7pt; line-height: 1.4; }
        .agency { text-align: center; font-size: 14pt; font-weight: bold; line-height: 1.45;
                  letter-spacing: .6pt; }
        .doctitle { text-align: center; font-size: 12.5pt; font-weight: bold; letter-spacing: 1.4pt;
                    margin: 11pt 0 13pt; padding-bottom: 8pt; border-bottom: 1pt solid #666; }
        .details { border: 1pt solid #333; padding: 11pt 14pt; font-size: 10pt; line-height: 1.6;
                   background: #fafafa; }
        .sign { margin-top: 14pt; padding-top: 10pt; border-top: 1pt solid #666; line-height: 1.75;
                margin-bottom: 0; }
      `
      const inner = blocks.map((b, i) => blockHtml(b,
        { 0: { cls: 'agency' }, 1: { cls: 'doctitle' }, 2: { cls: 'details' }, 11: { cls: 'sign' } }[i] ?? {}))
      return htmlPage('Recreational Marijuana Producer License', css,
        `<section class="page"><div class="frame">${inner.join('\n')}</div></section>`)
    },
  },
  '04-fsp-food': {
    spec: '04-fsp-food.md', file: '04-fsp-food.pdf', pages: 7,
    build(blocks) {
      // "a title page, numbered sections, and two simple tables".
      const css = `
        .page1 { padding-top: 2.6in; text-align: center; }
        .page1 p { text-align: center; font-size: 13pt; line-height: 2.2; }
        .page3 table td:nth-child(5), .page4 table td:nth-child(4) { font-size: 8pt; }
      `
      return htmlPage('Food Safety Plan', css,
        paginate(blocks, [[0, 0], [1, 4], [5, 6], [7, 8], [9, 12], [13, 16], [17, 20]]))
    },
  },
  '05-sds-supplier': {
    spec: '05-sds-supplier.md', file: '05-sds-supplier.pdf', pages: 4,
    build(blocks) {
      // "the standard 16-section SDS layout with numbered section headings." Each SECTION
      // block is a heading line followed by its body in the same block, so the heading is
      // split off here for layout only — the words are unchanged and the check proves it.
      const css = `
        .page { padding: 0.75in 0.85in 0.7in; }
        p { font-size: 9.5pt; line-height: 1.45; margin-bottom: 9pt; }
        h2 { font-size: 10pt; margin: 12pt 0 4pt; padding: 3pt 6pt; background: #e8e8e8;
             border-left: 3pt solid #333; }
        .page1 p:first-child { text-align: center; font-size: 14pt; font-weight: bold;
          line-height: 1.6; letter-spacing: .3pt; border-bottom: 2pt solid #111; padding-bottom: 8pt; }
      `
      const out = []
      for (const b of blocks) {
        const lines = b.split('\n')
        if (/^SECTION \d+\./.test(lines[0])) {
          out.push(`<h2>${esc(lines[0])}</h2>`)
          out.push(`<p>${lines.slice(1).map(esc).join('<br>')}</p>`)
        } else out.push(blockHtml(b))
      }
      // Blocks became 1 or 2 elements each; page breaks are by SDS section number.
      const pages = [[0, 4], [5, 14], [15, 24], [25, 32]]
      const body = pages.map(([a, z], i) =>
        `<section class="page page${i + 1}">${out.slice(a, z + 1).join('\n')}</section>`).join('\n')
      return htmlPage('Safety Data Sheet — Sodium Hydroxide Solution, 50%', css, body)
    },
  },
  '06a-forklift-log': {
    spec: '06-forklift-log-record.md', file: '06a-forklift-log.pdf', pages: 2,
    landscape: true,
    // Repeated by the browser at the top of page 2 when the table continues.
    headerRow: 'Date Shift Hours Tires Forks Mast Horn Lights Belt Brakes Steering LPG Ext. Plate Guard Operator Notes',
    build(blocks) {
      // "a landscape table, one row per day, with tick marks, initials and short notes as a
      // warehouse would keep it." Chrome repeats the <thead> on the second page; that is the
      // browser paginating one table, not a second header in the content.
      const css = `
        @page { size: Letter landscape; }
        /* One table over two pages: height auto so the table paginates rather than clipping,
           and Chrome repeats the <thead> on page 2 — the browser paginating one table, not a
           second header added to the content. */
        .page { width: 11in; height: auto; padding: 0.6in 0.6in 0.5in; page-break-after: auto; }
        body { font-family: Helvetica, Arial, sans-serif; }
        p { font-size: 9.5pt; line-height: 1.4; text-align: left; margin-bottom: 8pt; }
        .head { font-size: 11.5pt; font-weight: bold; line-height: 1.6; }
        .head br + span { font-weight: normal; }
        table { font-size: 10.5pt; }
        th, td { padding: 11pt 3pt; text-align: center; }
        th:first-child, td:first-child, th:last-child, td:last-child { text-align: left; }
        th { background: #ddd; }
        .foot { font-size: 10pt; line-height: 2.4; margin-top: 16pt; }
        .head { margin-bottom: 12pt; }
      `
      const inner = blocks.map((b, i) => blockHtml(b,
        { 0: { cls: 'head' }, 3: { cls: 'foot' }, 4: { cls: 'foot' } }[i] ?? {})).join('\n')
      return htmlPage('Powered Industrial Truck Pre-Shift Inspection Log', css,
        `<section class="page">${inner}</section>`)
    },
  },
}

// 06b is built from 06a's page 1, so it is described rather than built here.
const PHOTO = { id: '06b-forklift-log-photo', from: '06a-forklift-log', file: '06b-forklift-log-photo.pdf' }

// ---------------------------------------------------------------------------
// 3. THE CHECK. Strip the HTML back to text and compare with the spec.
// ---------------------------------------------------------------------------
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<title>[\s\S]*?<\/title>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => ENT[m])
}
/** Markdown table pipes and rule rows are layout, not words. */
function specToText(text) {
  return text.split('\n').map((l) => {
    const t = l.trim()
    if (isSeparatorRow(t)) return ''
    if (t.startsWith('|')) return t.replace(/^\|/, '').replace(/\|$/, '').split('|').join(' ')
    return l
  }).join('\n')
}
const flat = (s) => s.replace(/\s+/g, ' ').trim()

function checkFidelity(id, specText, html) {
  const want = flat(specToText(specText))
  const got = flat(htmlToText(html))
  if (want === got) return { ok: true, chars: want.length }
  let i = 0
  while (i < want.length && i < got.length && want[i] === got[i]) i++
  return { ok: false, at: i,
    want: want.slice(Math.max(0, i - 60), i + 90), got: got.slice(Math.max(0, i - 60), i + 90) }
}

// ---------------------------------------------------------------------------
// 3b. THE SAME CHECK AGAIN, ON THE PDF THAT WAS ACTUALLY WRITTEN.
//
// The HTML check above proves the layout carries every word. It does NOT prove the PDF does:
// a page with a fixed height can drop what overflows it, and the file still opens looking
// fine. So the bytes are read back, the text layer is pulled out of them, and compared with
// the spec again. Whitespace is removed from both sides for this one — Chrome positions every
// glyph individually, so the PDF has no word spaces to compare; what this proves is that no
// character was clipped, which is the failure worth catching. The HTML check already proved
// the spacing.
// ---------------------------------------------------------------------------
import { inflateSync } from 'node:zlib'

function pdfObjects(buf) {
  const s = buf.toString('latin1')
  const objs = new Map()
  const re = /(?:^|[\r\n])(\d+)\s+\d+\s+obj/g
  let m
  while ((m = re.exec(s))) {
    const end = s.indexOf('endobj', m.index)
    objs.set(Number(m[1]), { text: s.slice(m.index + m[0].length, end), start: m.index + m[0].length, end })
  }
  return { s, objs }
}
function pdfStream(buf, o) {
  const m = /stream\r?\n/.exec(o.text)
  if (!m) return null
  const from = o.start + m.index + m[0].length
  const to = o.start + o.text.lastIndexOf('endstream')
  const raw = buf.subarray(from, to)
  if (!/FlateDecode/.test(o.text.slice(0, m.index))) return raw.toString('latin1')
  try { return inflateSync(raw).toString('latin1') } catch { return null }
}
function toUnicodeMap(text) {
  const map = new Map()
  for (const blk of text.match(/beginbfchar[\s\S]*?endbfchar/g) ?? []) {
    for (const m of blk.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      let out = ''
      for (let i = 0; i < m[2].length; i += 4) out += String.fromCharCode(parseInt(m[2].slice(i, i + 4), 16))
      map.set(parseInt(m[1], 16), out)
    }
  }
  for (const blk of text.match(/beginbfrange[\s\S]*?endbfrange/g) ?? []) {
    for (const m of blk.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16), dst = parseInt(m[3], 16)
      for (let i = lo; i <= hi; i++) map.set(i, String.fromCharCode(dst + i - lo))
    }
  }
  return map
}
function pdfText(buf) {
  const { objs } = pdfObjects(buf)
  const fonts = new Map()
  for (const [n, o] of objs) {
    if (!/\/Type\s*\/Font/.test(o.text)) continue
    const t = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(o.text)
    if (t) fonts.set(n, toUnicodeMap(pdfStream(buf, objs.get(Number(t[1]))) ?? ''))
  }
  let out = ''
  for (const [, o] of objs) {
    if (!/\/Type\s*\/Page(?![s])/.test(o.text)) continue
    const res = /\/Font\s*<<([\s\S]*?)>>/.exec(o.text)
    const byName = new Map()
    if (res) for (const m of res[1].matchAll(/\/([A-Za-z0-9#]+)\s+(\d+)\s+0\s+R/g)) byName.set(m[1], fonts.get(Number(m[2])) ?? new Map())
    let content = ''
    for (const m of o.text.matchAll(/\/Contents\s+(\d+)\s+0\s+R/g)) content += pdfStream(buf, objs.get(Number(m[1]))) ?? ''
    let cur = new Map()
    for (const m of content.matchAll(/\/([A-Za-z0-9#]+)\s+[\d.]+\s+Tf|\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>/g)) {
      const tok = m[0]
      if (tok.endsWith('Tf')) { cur = byName.get(m[1]) ?? new Map(); continue }
      if (tok[0] === '(') { out += tok.slice(1, -1).replace(/\\([()\\])/g, '$1'); continue }
      const hx = tok.slice(1, -1).replace(/\s/g, '')
      const step = hx.length % 4 === 0 ? 4 : 2
      for (let i = 0; i < hx.length; i += step) out += cur.get(parseInt(hx.slice(i, i + step), 16)) ?? ''
    }
  }
  return out
}
const squeeze = (s) => s.replace(/\s+/g, '')

/**
 * Compare the PDF's own text with the spec. A table continued onto a second page carries its
 * header row again — Chrome paginating one table, not content added to the document — so one
 * repeat of the header is allowed, named, and reported.
 */
function checkPdf(specText, buf, headerRow) {
  const want = squeeze(specToText(specText))
  // Ligatures only — NOT NFKC, which would also flatten the ³ in "mg/m³" and report a
  // difference that is not one.
  const LIG = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'ft', 'ﬆ': 'st' }
  let got = squeeze(pdfText(buf)).replace(/[ﬀﬁﬂﬃﬄﬅﬆ]/g, (m) => LIG[m])
  let repeats = 0
  if (headerRow) {
    const h = squeeze(headerRow)
    while (got.length > want.length && got.includes(h + got.slice(0, 0))) {
      const idx = got.indexOf(h, got.indexOf(h) + 1)
      if (idx < 0) break
      got = got.slice(0, idx) + got.slice(idx + h.length)
      repeats++
    }
  }
  if (want === got) return { ok: true, chars: want.length, repeats }
  let i = 0
  while (i < want.length && i < got.length && want[i] === got[i]) i++
  return { ok: false, at: i, want: want.slice(Math.max(0, i - 70), i + 90), got: got.slice(Math.max(0, i - 70), i + 90) }
}

// ---------------------------------------------------------------------------
// 4. CHROME
// ---------------------------------------------------------------------------
async function withChrome(fn) {
  const port = 9333
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, '--remote-allow-origins=*',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    `--user-data-dir=${process.env.TMPDIR || '/tmp'}/cb-golden-chrome`, 'about:blank',
  ], { stdio: 'ignore' })
  try {
    let version = null
    for (let i = 0; i < 60 && !version; i++) {
      await new Promise((r) => setTimeout(r, 250))
      try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json() } catch { /* not up yet */ }
    }
    if (!version) throw new Error('Chrome did not open its debugging port.')
    return await fn(port)
  } finally { proc.kill() }
}

let msgId = 0
function cdp(ws, method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const m = JSON.parse(e.data)
      if (m.id !== id) return
      ws.removeEventListener('message', onMsg)
      m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function openPage(port, html) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP socket failed')) })
  await cdp(ws, 'Page.enable')
  const loaded = new Promise((resolve) => {
    const onMsg = (e) => {
      if (JSON.parse(e.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); resolve() }
    }
    ws.addEventListener('message', onMsg)
  })
  const { frameTree } = await cdp(ws, 'Page.getFrameTree')
  await cdp(ws, 'Page.setDocumentContent', { frameId: frameTree.frame.id, html })
  await Promise.race([loaded, new Promise((r) => setTimeout(r, 3000))])
  await new Promise((r) => setTimeout(r, 350))
  return { ws, targetId: target.id }
}

async function toPdf(port, html, landscape) {
  const { ws } = await openPage(port, html)
  const { data } = await cdp(ws, 'Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, landscape: !!landscape,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  })
  ws.close()
  return Buffer.from(data, 'base64')
}

async function toJpeg(port, html, clip) {
  const { ws } = await openPage(port, html)
  const { data } = await cdp(ws, 'Page.captureScreenshot', {
    format: 'jpeg', quality: 74, captureBeyondViewport: true, clip,
  })
  ws.close()
  return Buffer.from(data, 'base64')
}

// ---------------------------------------------------------------------------
// 5. A JPEG WRAPPED IN A PDF, BY HAND. No library, ~40 lines, /DCTDecode.
// ---------------------------------------------------------------------------
function jpegSize(buf) {
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue }
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  throw new Error('Could not read the JPEG size.')
}

function pdfOfJpeg(jpeg, ptW, ptH) {
  const { w, h } = jpegSize(jpeg)
  const objs = []
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
  objs[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] `
    + `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`
  const content = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q\n`
  objs[4] = `<< /Length ${content.length} >>\nstream\n${content}endstream`
  objs[5] = `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} `
    + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`

  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
  const offsets = []
  let pos = parts[0].length
  for (let n = 1; n <= 5; n++) {
    offsets[n] = pos
    let body = Buffer.from(`${n} 0 obj\n${objs[n]}\n`, 'latin1')
    if (n === 5) body = Buffer.concat([body.subarray(0, body.length - 1), Buffer.from('\nstream\n'), jpeg, Buffer.from('\nendstream\n')])
    const end = Buffer.from('endobj\n')
    parts.push(body, end); pos += body.length + end.length
  }
  const xref = pos
  let x = `xref\n0 6\n0000000000 65535 f \n`
  for (let n = 1; n <= 5; n++) x += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  x += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  parts.push(Buffer.from(x, 'latin1'))
  return Buffer.concat(parts)
}

/** Count pages by reading the PDF back, rather than trusting the layout. */
function pdfPageCount(buf) {
  const s = buf.toString('latin1')
  const m = s.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/)
  if (m) return Number(m[1])
  return (s.match(/\/Type\s*\/Page[^s]/g) || []).length
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const ids = Object.keys(FIXTURES).filter((id) => !only || id.startsWith(only))
const wantPhoto = !only || PHOTO.id.startsWith(only) || only === '06'
if (!ids.length && !wantPhoto) die(`No fixture matching "${only}".`)

console.log(`\n  Rendering into ${OUT}/\n`)
const rows = []

await withChrome(async (port) => {
  for (const id of ids) {
    const f = FIXTURES[id]
    const text = documentText(f.spec)
    const html = f.build(blocksOf(text))
    const check = checkFidelity(id, text, html)
    if (!check.ok) {
      console.error(`\n  ${id}: THE RENDERED TEXT DOES NOT MATCH THE SPEC. Nothing written.`)
      console.error(`    first difference at character ${check.at}`)
      console.error(`    spec : …${check.want}…`)
      console.error(`    html : …${check.got}…\n`)
      process.exit(1)
    }
    const pdf = await toPdf(port, html, f.landscape)
    const inFile = checkPdf(text, pdf, f.headerRow)
    if (!inFile.ok) {
      console.error(`\n  ${id}: THE PDF'S OWN TEXT DOES NOT MATCH THE SPEC — something was clipped.`)
      console.error(`    first difference at character ${inFile.at}`)
      console.error(`    spec: …${inFile.want}…`)
      console.error(`    pdf : …${inFile.got}…\n`)
      process.exit(1)
    }
    writeFileSync(`${OUT}/${f.file}`, pdf)
    const pages = pdfPageCount(pdf)
    rows.push({ id, file: f.file, pages, want: f.pages, bytes: pdf.length, chars: check.chars,
      repeats: inFile.repeats })
  }

  if (wantPhoto) {
    const src = FIXTURES[PHOTO.from]
    const text = documentText(src.spec)
    const page1 = src.build(blocksOf(text))
    // The page, tilted on a desk under a window: one bright corner, one shadowed edge, and
    // the slight barrel of a phone held over it. Nothing is added to the page itself.
    const photo = `<!doctype html><html><head><meta charset="utf-8"><style>
      /* body is the containing block for the overlays; without position:relative they size
         to the viewport instead of the page and the "desk" ends in a hard rectangle. */
      html,body{margin:0;background:#4a4a48;width:1500px;height:1160px;overflow:hidden;
        position:relative}
      .desk{position:absolute;inset:0;background:
        radial-gradient(120% 90% at 18% 8%, #f2efe6 0%, #d9d5c8 38%, #b0aa9b 72%, #8d887b 100%);}
      .sheet{position:absolute;left:46px;top:34px;width:1410px;height:1090px;
        transform:rotate(-1.6deg) perspective(2600px) rotateX(1.2deg);transform-origin:50% 50%;
        box-shadow:0 18px 34px rgba(0,0,0,.30);background:#fff;overflow:hidden}
      .sheet iframe{width:1056px;height:816px;border:0;transform:scale(1.3355);transform-origin:0 0}
      .light{position:absolute;inset:0;pointer-events:none;background:
        linear-gradient(118deg, rgba(255,255,255,.34) 0%, rgba(255,255,255,.05) 26%,
          rgba(0,0,0,.05) 58%, rgba(0,0,0,.24) 86%, rgba(0,0,0,.34) 100%);}
      .glare{position:absolute;left:58%;top:-16%;width:58%;height:70%;pointer-events:none;
        background:radial-gradient(closest-side, rgba(255,255,255,.44), rgba(255,255,255,0) 72%);
        transform:rotate(-14deg)}
    </style></head><body>
      <div class="desk"></div>
      <div class="sheet"><iframe srcdoc="${page1.replace(/"/g, '&quot;')}"></iframe></div>
      <div class="light"></div><div class="glare"></div>
    </body></html>`
    const jpeg = await toJpeg(port, photo, { x: 0, y: 0, width: 1500, height: 1160, scale: 1 })
    const pdf = pdfOfJpeg(jpeg, 792, 612)   // one Letter-landscape page of pure image
    writeFileSync(`${OUT}/${PHOTO.file}`, pdf)
    rows.push({ id: PHOTO.id, file: PHOTO.file, pages: pdfPageCount(pdf), want: 1,
      bytes: pdf.length, chars: 0, photo: true })
  }
})

console.log('  case                      file                            pages  bytes    text check')
console.log('  ' + '─'.repeat(88))
let bad = 0
for (const r of rows) {
  const pagesOk = r.pages === r.want
  if (!pagesOk) bad++
  console.log(`  ${r.id.padEnd(25)} ${r.file.padEnd(31)} ${String(r.pages).padStart(2)}`
    + `${pagesOk ? '   ' : ` ✗(${r.want})`}  ${String(r.bytes).padStart(7)}  `
    + (r.photo ? 'image only, no text layer (on purpose)'
       : `${r.chars} chars, identical in the HTML and in the PDF`
         + (r.repeats ? `  (+${r.repeats} continued-table header)` : '')))
}
console.log('')
if (bad) { console.error(`  ${bad} fixture(s) do not have the page count the spec asks for.\n`); process.exit(1) }

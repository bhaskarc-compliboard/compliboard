// E0 — CONFIRM EVERY ITEM'S LINE ON THE LIVE TREE.
//
// The list was written from a zip taken before Jobs A–C, so every `file:line` in it is a claim about
// a tree that has since moved. This reads each one OUT OF THE CURRENT FILES and prints it, so the
// confirmation is evidence rather than memory (§9a: copy names from the artifact).
//
// It proves nothing on its own — it hands me the lines to judge.
import { readFileSync, existsSync } from 'node:fs'

const list = readFileSync('docs/FIX-LIST-FAILURES.md', 'utf8').split('\n')
const want = process.argv[2]                       // optional: only items whose id matches

let item = null
const out = []
for (const line of list) {
  const m = line.match(/^(\d+)\. \*\*([A-Za-z0-9,\- ]+?) · sev ([^·]+)·([^·]*)·\s*([^.]*)\.\*\*/)
  if (m) item = { n: m[1], id: m[2].trim(), sev: m[3].trim(), state: m[4].trim(), section: m[5].trim(), refs: [] }
  if (!item) continue
  if (m) out.push(item)
  for (const r of line.matchAll(/`([a-zA-Z0-9_./[\]-]+\.(?:ts|tsx|sql|js|mjs))(?::(\d+)(?:[–-](\d+))?)?`/g))
    if (r[2]) item.refs.push({ file: r[1], from: Number(r[2]), to: Number(r[3] ?? r[2]) })
}

for (const it of out) {
  if (want && !it.id.toLowerCase().includes(want.toLowerCase())) continue
  const fixed = /FIXED|✓ FIXED/.test(it.state)
  console.log(`\n── ${it.id}  (sev ${it.sev})  ${it.section}${fixed ? '   [marked FIXED already]' : ''}`)
  if (!it.refs.length) { console.log('   (no file:line in the entry)'); continue }
  const seen = new Set()
  for (const r of it.refs.slice(0, 3)) {
    const k = `${r.file}:${r.from}`
    if (seen.has(k)) continue
    seen.add(k)
    if (!existsSync(r.file)) { console.log(`   ${r.file}  *** FILE NO LONGER EXISTS ***`); continue }
    const src = readFileSync(r.file, 'utf8').split('\n')
    for (let n = r.from; n <= Math.min(r.to, r.from + 3, src.length); n++)
      console.log(`   ${r.file}:${n}  ${(src[n - 1] ?? '').trim().slice(0, 118)}`)
  }
}
console.log(`\n${out.length} items parsed.`)

#!/usr/bin/env node
// RE-PARSE THE STORED RUNS WITH THE CURRENT EXTRACTOR — Documents Run 2b, step 2.
//
//   npm run golden:docs:reparse
//
// Every run under tests/golden/documents/runs/ carries the model's raw text on the scan. When
// `json_parsed` is false the answer was bought, stored, and thrown away by the extractor rather
// than by the model. This runs the CURRENT extractor over that stored text and, where it now
// parses, writes a sibling file — `<name>.reparsed.json` — carrying the recovered scan.
//
// *** IT MAKES NO MODEL CALL AND TOUCHES NO DATABASE. *** The original file is never edited:
// the failed run stays on disk exactly as it happened, and the recovery sits beside it, so the
// before and the after are both readable. `npm run golden:docs -- --from-runs` prefers the
// sibling where one exists.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { extractJsonText } from '../lib/ai.ts'
import { normaliseScan } from '../lib/documentScan.ts'

const RUNS = 'tests/golden/documents/runs'
let checked = 0, recovered = 0, stillBad = 0

for (const c of readdirSync(RUNS).sort()) {
  for (const f of readdirSync(`${RUNS}/${c}`).sort()) {
    if (!f.endsWith('.json') || f.endsWith('.reparsed.json')) continue
    const path = `${RUNS}/${c}/${f}`
    const d = JSON.parse(readFileSync(path, 'utf8'))
    if (d.scan?.json_parsed !== false) continue
    checked++
    let obj = null
    try { obj = JSON.parse(extractJsonText(d.scan.raw_text ?? '')) } catch { obj = null }
    if (!obj) {
      stillBad++
      console.log(`  ${c} run ${d.run}: still does not parse`)
      continue
    }
    // Normalised through the same function the live path uses, so the recovered scan is the
    // scan the run WOULD have stored — not a hand-assembled object that happens to look like one.
    const shape = normaliseScan(obj, d.scan.extracted_text ?? '')
    const checkedQuotes = [...shape.gaps, ...shape.facts].filter((x) => x.quote_verified !== null)
    const out = { ...d,
      reparsed: true,
      reparsed_from: f,
      scan: { ...d.scan, ...shape, json_parsed: true,
              quotes_checked: checkedQuotes.length,
              quotes_verified: checkedQuotes.filter((x) => x.quote_verified === true).length },
    }
    writeFileSync(`${RUNS}/${c}/${f.replace(/\.json$/, '')}.reparsed.json`, JSON.stringify(out, null, 2) + '\n')
    recovered++
    console.log(`  ${c} run ${d.run}: recovered — status ${shape.status}, kind ${shape.identity.kind}, `
      + `${shape.gaps.length} gap(s), ${shape.facts.length} fact(s)`)
  }
}
console.log(`\n  ${checked} stored run(s) had json_parsed = false. ${recovered} recovered, ${stillBad} still unparseable.\n`)

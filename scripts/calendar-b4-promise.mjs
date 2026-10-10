// DECISION 21's WORDS IN BOTH STATES — Calendar B4.
//
// *** A GATE ONLY EVER SEEN SHUT IS A GATE NOBODY HAS SHOWN CAN OPEN. *** That is the whole reason
// this script exists: B2 shipped the gate with a comment saying it could never open, and the owner
// caught it. So both states are RENDERED, against a real server, and the words are printed.
//
// The open state is produced by flipping the constant in a COPY of the tree (`HOW-WE-BUILD.md` §3c's
// isolated server), never by editing lib/emailPromise.ts in place — a gate proved by a change left
// behind is worse than no proof.
import { execFileSync } from 'node:child_process'
const BASE = process.argv[2]
const want = process.argv[3] ?? 'shut'

const get = async (p) => (await fetch(`${BASE}${p}`)).text()
const api = await (await fetch(`${BASE}/api/promise`)).json()
console.log(`\n/api/promise says: ${JSON.stringify(api)}   (expecting monthlyEmail=${want === 'open'})`)
if (api.monthlyEmail !== (want === 'open')) {
  console.error(`FAILED: the server's answer is not the state under test.`)
  process.exit(1)
}

// The landing page is public, so its words can be read without signing in. It is a client component,
// so the shipped HTML holds the text of BOTH branches — which is exactly what we want to see: the
// sentences are in the bundle and the gate decides whether they are drawn.
const html = await get('/')
for (const phrase of [
  'A monthly email of what is due and what has passed',
  'A monthly email of what is due',
  'Never miss a renewal',
  'alerted before anything expires',
  'Dates read out of your documents, with the line they came from',
]) {
  console.log(`   ${html.includes(phrase) ? 'present' : 'absent '} : ${JSON.stringify(phrase)}`)
}

/**
 * THE WEBSITE READ — My Account step 13, `ACCOUNT-PLAN.md` decision 9.
 *
 * Two things are held here, and the first is a security control rather than a feature:
 *
 *   1. **Which hosts we will fetch.** `docs/TODO.md:1075` assessed the old scanner as a blind
 *      SSRF — "up to 17 outbound fetches from your infrastructure to a destination the caller
 *      picks", with nothing blocking private or link-local ranges. The new fetcher refuses IP
 *      literals and anything that resolves into a private range. `DECISIONS.md` §45: a
 *      compensating control must be named AND TESTED or it is a belief.
 *   2. **What reaches the card.** `parseProposal` refuses a reply that is not in shape rather than
 *      repairing it, and `validateNaics` drops any code that is not one of ours — which is the
 *      whole of the protection against an invented code, since the model is not given the list.
 *
 * Neither needs a network: every case below is a string or an object.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isIpLiteral, isPrivateAddress, pageText, wantedLinks,
  MAX_PAGES, PER_PAGE_CHARS, TOTAL_CHARS, TOTAL_MS, PER_PAGE_MS, MAX_BYTES, MAX_REDIRECTS,
} from '../../lib/websiteFetch.ts'
import {
  parseProposal, validateNaics, isEmpty, WEBSITE_JSON_SCHEMA, websitePrompt, WEBSITE_SYSTEM,
} from '../../prompts/website-read.ts'
import { NAICS_TITLES } from '../../lib/naicsTitles.ts'

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('an IP literal is never a website', () => {
  test('every form of one is caught', () => {
    for (const h of ['127.0.0.1', '169.254.169.254', '10.0.0.1', '0.0.0.0', '255.255.255.255',
                     '2130706433', '0x7f000001', '::1', '[::1]', 'fe80::1', '::ffff:127.0.0.1']) {
      assert.equal(isIpLiteral(h), true, `${h} was treated as a hostname`)
    }
  })
  test('and a real hostname is not', () => {
    for (const h of ['example.com', 'www.example.com', 'my-company.co.uk', 'a1.example.com',
                     '123company.com', 'xn--80ak6aa92e.com']) {
      assert.equal(isIpLiteral(h), false, `${h} was treated as an IP`)
    }
  })
  test('*** AND THIS IS WHY IT MATTERS: normaliseWebsite ACCEPTS AN IP ***', () => {
    // `lib/signupView.ts`'s hostname pattern is letters, digits and dots — which `169.254.169.254`
    // satisfies. So signup will happily store the metadata endpoint as somebody's website, and the
    // only thing standing between that and a fetch is the check above.
    const signupView = readFileSync('lib/signupView.ts', 'utf8')
    assert.match(signupView, /\[a-z0-9\]/)
    assert.equal(isIpLiteral('169.254.169.254'), true)
  })
})

describe('an address we will not talk to', () => {
  test('the ranges that must never be fetched', () => {
    for (const a of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
                     '169.254.169.254', '0.0.0.0', '100.64.0.1', '198.18.0.1', '224.0.0.1',
                     '240.0.0.1', '192.0.0.1']) {
      assert.equal(isPrivateAddress(a, 4), true, `${a} was allowed`)
    }
  })
  test('…and the ordinary public ones that must still work', () => {
    for (const a of ['8.8.8.8', '96.31.72.44', '172.15.0.1', '172.32.0.1', '100.63.255.255',
                     '198.20.0.1', '1.1.1.1']) {
      assert.equal(isPrivateAddress(a, 4), false, `${a} was refused`)
    }
  })
  test('IPv6, including an IPv4 address wearing an IPv6 coat', () => {
    for (const a of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', '::ffff:10.0.0.1']) {
      assert.equal(isPrivateAddress(a, 6), true, `${a} was allowed`)
    }
    assert.equal(isPrivateAddress('2606:4700::1111', 6), false)
    assert.equal(isPrivateAddress('::ffff:8.8.8.8', 6), false)
  })
  test('rubbish is refused rather than parsed optimistically', () => {
    for (const a of ['', 'not an address', '1.2.3', '1.2.3.4.5', '999.1.1.1']) {
      assert.equal(isPrivateAddress(a, 4), true, `${a} was allowed through`)
    }
  })
})

describe('html to the words a reader would see', () => {
  test('script, style and comments go; block ends become newlines', () => {
    const html = `<html><head><style>.a{color:red}</style></head><body>
      <!-- hidden --><script>var x = 1 < 2</script>
      <h1>Acme Chemical</h1><p>We make soap.</p>
      <address>1 Main St<br>Portland, OR 97210</address></body></html>`
    const t = pageText(html)
    assert.ok(!t.includes('color:red'))
    assert.ok(!t.includes('var x'))
    assert.ok(!t.includes('hidden'))
    assert.match(t, /Acme Chemical/)
    // *** THE ONE PLACE FORMATTING CHANGES THE ANSWER. *** Without the <br> rule a three-line
    // address arrives as one run of words and the model has to guess where the street ends.
    assert.match(t, /1 Main St\nPortland, OR 97210/)
  })
  test('entities become the characters a person would see', () => {
    assert.equal(pageText('<p>Dow &amp; Co&#39;s plant &nbsp;&lt;here&gt;</p>'), "Dow & Co's plant <here>")
  })
})

describe('which links are worth following', () => {
  const html = `
    <a href="/about-us/">About us</a>
    <a href="/products">Products</a>
    <a href="https://www.example.com/contact">Contact</a>
    <a href="http://other-company.com/about">Our parent</a>
    <a href="/locations/">Locations</a>
    <a href="/company/">Company</a>
    <a href="/careers">Careers</a>`
  test('about, locations, contact and company — in that order, same host only', () => {
    const links = wantedLinks(html, 'https://www.example.com/')
    assert.deepEqual(links, [
      'https://www.example.com/about-us/',
      'https://www.example.com/locations/',
      'https://www.example.com/contact',
      'https://www.example.com/company/',
    ])
  })
  test('never more than the budget, and never another company', () => {
    assert.ok(wantedLinks(html, 'https://www.example.com/').length <= MAX_PAGES - 1)
    assert.ok(!wantedLinks(html, 'https://www.example.com/').some((u) => u.includes('other-company')))
  })
  test('a page with nothing worth reading yields nothing', () => {
    assert.deepEqual(wantedLinks('<a href="/careers">Jobs</a>', 'https://www.example.com/'), [])
  })
})

describe('the caps are stated, and they are the ones the report named', () => {
  test('5 pages, 8s and 25s, 400 KB, 6,000 and 24,000 characters, 3 redirects', () => {
    assert.equal(MAX_PAGES, 5)
    assert.equal(PER_PAGE_MS, 8_000)
    assert.equal(TOTAL_MS, 25_000)
    assert.equal(MAX_BYTES, 400_000)
    assert.equal(PER_PAGE_CHARS, 6_000)
    assert.equal(TOTAL_CHARS, 24_000)
    assert.equal(MAX_REDIRECTS, 3)
    // The route's own limit must be able to contain the fetch and one model call.
    const route = readFileSync('app/api/website-read/route.ts', 'utf8')
    const max = Number(code(route).match(/export const maxDuration = (\d+)/)?.[1])
    assert.ok(max * 1000 > TOTAL_MS, `maxDuration ${max}s cannot contain a ${TOTAL_MS / 1000}s fetch`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('a NAICS code is ours or it is nothing', () => {
  test('a code in our list comes back with OUR title', () => {
    const real = NAICS_TITLES[0]
    assert.deepEqual(validateNaics(real.code), { code: real.code, title: real.title })
    // The one measured in the walk: Jost Chemical.
    assert.deepEqual(validateNaics('325180'),
      { code: '325180', title: 'Other Basic Inorganic Chemical Manufacturing' })
  })
  test('an invented code is dropped — the whole protection, since the model is not given the list', () => {
    for (const bad of ['999999', '12345', '3251801', '', '  ', 'abcdef', null, undefined, 325180]) {
      assert.equal(validateNaics(bad as unknown), null, `${String(bad)} was accepted`)
    }
  })
  test('and the model cannot talk us into its own title for a real code', () => {
    const p = parseProposal({
      name: '', what_you_do: '', naics_code: '325180', naics_title: 'Soap Factories of Oregon',
      addresses: [], notes: '',
    })
    assert.equal(p?.naics_title, 'Other Basic Inorganic Chemical Manufacturing')
  })
})

describe('the parse refuses rather than repairs', () => {
  const good = {
    name: 'Jost Chemical Co.',
    what_you_do: 'We manufacture high purity specialty chemicals.',
    naics_code: '325180', naics_title: 'whatever',
    addresses: [{ label: 'St. Louis', address: '8150 Lackland, St. Louis, MO 63114' }],
    notes: '',
  }
  test('a well-formed answer parses, and "" becomes null', () => {
    const p = parseProposal(good)
    assert.equal(p?.name, 'Jost Chemical Co.')
    assert.equal(p?.notes, null)
    assert.equal(p?.addresses.length, 1)
    assert.equal(p?.addresses[0].label, 'St. Louis')
  })
  test('an answer that is not an object, or has no addresses array, is refused outright', () => {
    for (const bad of [null, undefined, 'a string', 42, [], { ...good, addresses: 'none' },
                       { ...good, addresses: null }]) {
      assert.equal(parseProposal(bad as unknown), null)
    }
  })
  test('an address that is not an object refuses the whole answer', () => {
    assert.equal(parseProposal({ ...good, addresses: ['1 Main St'] }), null)
  })
  test('a label with no address is not a location, and the same address twice is one place', () => {
    const p = parseProposal({
      ...good,
      addresses: [
        { label: 'HQ', address: '' },
        { label: 'One', address: '1 Main St, Portland, OR' },
        { label: 'Again', address: '1  MAIN ST,  Portland, OR' },
      ],
    })
    assert.equal(p?.addresses.length, 1)
    assert.equal(p?.addresses[0].label, 'One')
  })
  test('a sentence longer than the cap is dropped, not truncated into a half-sentence', () => {
    const p = parseProposal({ ...good, what_you_do: 'x'.repeat(500) })
    assert.equal(p?.what_you_do, null)
  })
  test('an empty-but-valid answer parses, and says so', () => {
    const p = parseProposal({ name: '', what_you_do: '', naics_code: '', naics_title: '', addresses: [], notes: '' })
    assert.ok(p)
    assert.equal(isEmpty(p!), true)
    // …and a read that found ONE thing is not empty.
    assert.equal(isEmpty(parseProposal(good)!), false)
  })
})

describe('the prompt has one anchor and asks for nothing it cannot see', () => {
  const src = readFileSync('prompts/website-read.ts', 'utf8')
  test('no search tool anywhere on this path', () => {
    const route = code(readFileSync('app/api/website-read/route.ts', 'utf8'))
    assert.ok(!/enableWebSearch|maxSearches/.test(route), 'the website read was given a search tool')
  })
  test('it asks for the six fields and no switch', () => {
    const rendered = websitePrompt('example.com', [{ url: 'https://example.com/', text: 'We make soap.' }])
    for (const field of ['"name"', '"what_you_do"', '"industry"', '"industry_role"', '"addresses"', '"notes"']) {
      assert.ok(rendered.includes(field), `the prompt never asks for ${field}`)
    }
    // The old scanner asked the model to decide facts that are switches a person answers.
    for (const gone of ['onsite_chemical_storage', 'hazmat_drivers', 'repackaging', 'certifications']) {
      assert.ok(!rendered.includes(gone), `the prompt still asks the model to decide ${gone}`)
    }
    // And it never asks for a state or a city: those come from an address through the geocoder.
    assert.ok(!/"state"|"city"/.test(rendered))
  })
  test('the pages are in the prompt, with their URLs', () => {
    const rendered = websitePrompt('example.com', [
      { url: 'https://example.com/', text: 'We make soap.' },
      { url: 'https://example.com/about', text: 'Since 1972.' },
    ])
    assert.match(rendered, /PAGES READ \(2\)/)
    assert.match(rendered, /=== https:\/\/example\.com\/about ===/)
    assert.match(rendered, /Since 1972\./)
  })
  test('"not found" is an answer, said in both halves', () => {
    assert.match(WEBSITE_SYSTEM, /"Not found" is a complete and correct answer/)
    assert.match(src, /Never fill a field with something plausible/)
  })
  test('the schema is closed, every property required, one array of objects and no nested object', () => {
    const s = WEBSITE_JSON_SCHEMA as { additionalProperties: boolean; required: string[]; properties: Record<string, { type: string; items?: { properties?: unknown } }> }
    assert.equal(s.additionalProperties, false)
    assert.deepEqual(s.required.sort(),
      ['addresses', 'industry', 'industry_role', 'naics_code', 'naics_title', 'name', 'notes', 'what_you_do'])
    const arrays = Object.values(s.properties).filter((p) => p.type === 'array')
    assert.equal(arrays.length, 1, 'a second array of objects moves this past the measured margin')
    const nested = Object.values(s.properties).filter((p) => p.type === 'object')
    assert.equal(nested.length, 0)
  })
})

describe('nothing is written on the model’s word', () => {
  const route = code(readFileSync('app/api/website-read/route.ts', 'utf8'))
  test('the route writes website_reads and nothing else', () => {
    const tables = [...route.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1])
    assert.deepEqual([...new Set(tables)].sort(), ['companies', 'website_reads'])
    // `companies` is READ for its website_url and never written.
    assert.ok(!/from\('companies'\)[\s\S]{0,80}\.(update|insert)\(/.test(route))
  })
  test('the claim row is inserted before the work, and the work runs after the reply', () => {
    const claimAt = route.indexOf("status: 'reading'")
    const replyAt = route.indexOf('status: 202')
    const workAt = route.indexOf('after(')
    assert.ok(claimAt > 0 && replyAt > 0 && workAt > 0)
    assert.ok(claimAt < workAt, 'the work is scheduled before the claim row exists')
    assert.ok(workAt < replyAt, 'the 202 is returned before after() has been registered')
  })
  test('a second POST while a read is live does nothing', () => {
    assert.match(route, /existing\.status !== 'failed'/)
    assert.match(route, /started: false/)
  })
  test('every exit writes a row: no read can stay on `reading` for ever', () => {
    // `finish` is the only way out of `runRead`, and each branch calls it.
    assert.equal((route.match(/await finish\(/g) ?? []).length, 5)
    for (const reason of ['model_refused', 'bad_shape']) {
      assert.ok(route.includes(`'${reason}'`), `${reason} is never recorded`)
    }
  })
  test('the ledger is told what the spend was for', () => {
    assert.match(route, /ledger: \{ companyId, task: 'website' \}/)
  })
})

describe('signup kicks the read, and only when there is one to kick', () => {
  const page = code(readFileSync('app/signup/page.tsx', 'utf8'))
  test('after the sign-in, awaited, and guarded by the website box', () => {
    assert.match(page, /if \(normaliseWebsite\(website\)\) \{/)
    assert.match(page, /await fetch\('\/api\/website-read', \{ method: 'POST'/)
    const signIn = page.indexOf('signInWithPassword')
    const kick = page.indexOf("'/api/website-read'")
    // Step 14: the landing moved from /dashboard to the walk, which is the screen that ASKS about
    // this read. The ordering this test is about is unchanged — the kick is between the two.
    const push = page.indexOf('router.push(WALK_PATH)')
    assert.ok(signIn < kick && kick < push, 'the kick is not between the sign-in and the landing')
  })
  test('and a failure to kick never stops the person landing', () => {
    // The fetch sits in its own try/catch INSIDE the website guard, and the push is outside both:
    // the account exists and the person is signed in, so a read we could not start is ours to
    // worry about, not a thing to stop somebody's first morning with.
    const kick = page.indexOf("'/api/website-read'")
    const tryAt = page.lastIndexOf('try {', kick)
    const catchAt = page.indexOf('} catch {', kick)
    assert.ok(tryAt > 0 && tryAt < kick && catchAt > kick, 'the kick is not wrapped in its own try/catch')
    assert.ok(page.indexOf('router.push(WALK_PATH)') > catchAt, 'the landing is inside the kick\u2019s try')
    assert.equal((page.match(/router\.push\(WALK_PATH\)/g) ?? []).length, 1)
  })
})

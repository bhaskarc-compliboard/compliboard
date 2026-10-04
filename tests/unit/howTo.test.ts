/**
 * "HOW DO I DO THIS?" — THE CHECK ON EVERY STEP. `lib/howTo.ts`, Workspace Task 6.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkHowTo, labelFor, urlKey, stripMarkers, sourceCount, hostOf,
  OTHER_SOURCE_LINE, DROPPED_LINE, OFFICIAL_HOSTS, findReturned,
} from '../../lib/howTo.ts'
import { searchResults, effortForHowto, searchLimit, effectiveSearchCap } from '../../lib/ai.ts'
import { readFileSync } from 'node:fs'

const meta = { today: '2026-10-04', model: 'claude-opus-5-5' }
const returned = [
  { url: 'https://www.oregon.gov/olcc/pages/industrial-alcohol.aspx', title: 'OLCC Industrial Alcohol' },
  { url: 'https://secure.sos.state.or.us/oard/viewSingleRule.action?ruleVersionId=1', title: 'OAR 845-004-0101' },
  { url: 'https://www.ttb.gov/nonbeverage/formulas/', title: 'TTB formulas' },
  { url: 'https://example-consultant.com/olcc-guide', title: 'A consultant guide' },
]

describe('a. a step stands only on a page this call\'s search returned', () => {
  test('a step whose URL was returned is kept, with the search\'s own spelling of the URL', () => {
    const r = checkHowTo({ steps: [{ text: 'Apply to OLCC.', url: 'http://oregon.gov/olcc/pages/industrial-alcohol.aspx/' }] }, returned, meta)
    assert.ok(r.ok)
    assert.equal(r.result.steps.length, 1)
    assert.equal(r.result.steps[0].url, returned[0].url)
    assert.equal(r.result.steps[0].title, 'OLCC Industrial Alcohol')
    assert.equal(r.result.dropped, 0)
  })
  test('a URL the search did not return is dropped and counted — even on an official host', () => {
    const r = checkHowTo({ steps: [
      { text: 'Apply to OLCC.', url: returned[0].url },
      { text: 'File form 5154.1.', url: 'https://www.ttb.gov/forms/f51541.pdf' },
    ] }, returned, meta)
    assert.ok(r.ok)
    assert.deepEqual(r.result.steps.map((s) => s.text), ['Apply to OLCC.'])
    assert.equal(r.result.dropped, 1)
  })
  test('a step with no URL is dropped and counted', () => {
    const r = checkHowTo({ steps: [{ text: 'Keep records.' }, { text: 'Keep records.', url: '' }] }, returned, meta)
    assert.ok(r.ok)
    assert.equal(r.result.steps.length, 0)
    assert.equal(r.result.dropped, 2)
  })
  test('the query string is part of the page: a different ruleVersionId is a different page', () => {
    const r = checkHowTo({ steps: [{ text: 'Read the rule.', url: 'https://secure.sos.state.or.us/oard/viewSingleRule.action?ruleVersionId=2' }] }, returned, meta)
    assert.ok(r.ok)
    assert.equal(r.result.dropped, 1)
  })
  test('an empty step is not a step: neither shown nor counted', () => {
    const r = checkHowTo({ steps: [{ text: '  ', url: returned[0].url }, 'not an object'] }, returned, meta)
    assert.ok(r.ok)
    assert.equal(r.result.steps.length + r.result.dropped, 0)
  })
  test('a result in the wrong shape is refused whole', () => {
    assert.equal(checkHowTo('a string', returned, meta).ok, false)
    assert.equal(checkHowTo({ steps: 'one, two' }, returned, meta).ok, false)
  })
  test('the note, the mothership, the date and the model are kept', () => {
    const r = checkHowTo({ mothership: 'Oregon OLCC', note: 'OLCC does not publish the steps online.', steps: [] }, returned, meta)
    assert.ok(r.ok)
    assert.deepEqual({ ...r.result, steps: undefined }, {
      steps: undefined, dropped: 0, note: 'OLCC does not publish the steps online.', mothership: 'Oregon OLCC',
      checked_on: '2026-10-04', model: 'claude-opus-5-5' })
  })
})

describe('b. every kept step is labelled by its host', () => {
  test('.gov hosts are official — ecfr.gov, federalregister.gov, oregonlegislature.gov, ttb.gov, oregon.gov', () => {
    for (const u of ['https://www.ecfr.gov/current/title-27/part-17', 'https://www.federalregister.gov/x',
      'https://www.oregonlegislature.gov/bills_laws/ors/ors471.html', 'https://www.ttb.gov/x', 'https://www.oregon.gov/olcc']) {
      assert.equal(labelFor(u), 'official', u)
    }
  })
  test('state.xx.us hosts are official — secure.sos.state.or.us', () => {
    assert.equal(labelFor('https://secure.sos.state.or.us/oard/x'), 'official')
    assert.equal(labelFor('https://sos.state.or.us/'), 'official')
  })
  test('the ICC code publisher is official; everything else is other', () => {
    assert.equal(labelFor('https://codes.iccsafe.org/content/ORFC2022P1'), 'official')
    for (const u of ['https://www.law.cornell.edu/cfr/text/27/17.1', 'https://example-consultant.com/a',
      'https://oregon.public.law/rules/oar_845-004-0101', 'https://www.dian.gov.co/x', 'https://notgov.com/x', 'not a url']) {
      assert.equal(labelFor(u), 'other', u)
    }
  })
  test('a lookalike does not pass: a host must END in .gov, not contain it', () => {
    assert.equal(labelFor('https://ttb.gov.example.com/x'), 'other')
  })
  test('the "other" line names the host, and the dropped line counts in words', () => {
    assert.equal(OTHER_SOURCE_LINE('example-consultant.com'),
      'This comes from example-consultant.com, not the agency itself. It looks correct, but check it before you rely on it.')
    assert.equal(DROPPED_LINE(1), '1 step could not be checked against a source, so it is not shown.')
    assert.equal(DROPPED_LINE(3), '3 steps could not be checked against a source, so they are not shown.')
  })
  test('every official rule carries a reason', () => {
    for (const o of OFFICIAL_HOSTS) assert.ok(o.reason.length > 40, o.rule)
  })
  test('a kept "other" step carries its exact link and host', () => {
    const r = checkHowTo({ steps: [{ text: 'Read the guide.', url: returned[3].url }] }, returned, meta)
    assert.ok(r.ok)
    assert.deepEqual(r.result.steps[0], { text: 'Read the guide.', url: returned[3].url,
      title: 'A consultant guide', host: 'example-consultant.com', label: 'other' })
  })
})

describe('the pieces', () => {
  test('urlKey ignores scheme, www, fragment, trailing slash and case; keeps the query', () => {
    assert.equal(urlKey('HTTPS://www.TTB.gov/Path/#top'), urlKey('http://ttb.gov/path'))
    assert.notEqual(urlKey('https://x.gov/a?id=1'), urlKey('https://x.gov/a?id=2'))
  })
  test('hostOf drops www and survives a bad URL', () => {
    assert.equal(hostOf('https://www.ttb.gov/x'), 'ttb.gov')
    assert.equal(hostOf('nonsense'), '')
  })
  test('citation markers between JSON tokens are removed before parsing', () => {
    const text = '{"steps":[{"text":"Apply.","url":"https://ttb.gov/x"}[1]]}'
    assert.deepEqual(JSON.parse(stripMarkers(text)), { steps: [{ text: 'Apply.', url: 'https://ttb.gov/x' }] })
  })
  test('sourceCount counts different pages, not steps', () => {
    assert.equal(sourceCount({ steps: [
      { text: 'a', url: 'https://ttb.gov/x', title: '', host: '', label: 'official' },
      { text: 'b', url: 'https://www.ttb.gov/x/', title: '', host: '', label: 'official' },
      { text: 'c', url: 'https://ttb.gov/y', title: '', host: '', label: 'official' }] }), 2)
  })
})

describe('lib/ai.ts searchResults — what the search returned, read from the response', () => {
  test('every web_search_result URL, deduplicated, in order; a refused search adds nothing; text blocks are ignored', () => {
    const content = [
      { type: 'text', text: 'Let me look.', citations: [{ url: 'https://cited.gov/a', title: 'c' }] },
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'olcc' } },
      { type: 'web_search_tool_result', tool_use_id: 's1', content: [
        { type: 'web_search_result', url: 'https://oregon.gov/olcc', title: 'OLCC' },
        { type: 'web_search_result', url: 'https://ttb.gov/x', title: '' }] },
      { type: 'web_search_tool_result', tool_use_id: 's2',
        content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } },
      { type: 'web_search_tool_result', tool_use_id: 's3', content: [
        { type: 'web_search_result', url: 'https://oregon.gov/olcc', title: 'OLCC again' }] },
    ]
    assert.deepEqual(searchResults(content), [
      { url: 'https://oregon.gov/olcc', title: 'OLCC' }, { url: 'https://ttb.gov/x', title: 'https://ttb.gov/x' }])
  })
})

describe('AI_EFFORT_HOWTO — its own effort, falling back to AI_EFFORT, then to medium', () => {
  const run = (howto: string | undefined, base: string | undefined) => {
    const keep = [process.env.AI_EFFORT_HOWTO, process.env.AI_EFFORT]
    if (howto === undefined) delete process.env.AI_EFFORT_HOWTO; else process.env.AI_EFFORT_HOWTO = howto
    if (base === undefined) delete process.env.AI_EFFORT; else process.env.AI_EFFORT = base
    try { return effortForHowto() } finally {
      if (keep[0] === undefined) delete process.env.AI_EFFORT_HOWTO; else process.env.AI_EFFORT_HOWTO = keep[0]
      if (keep[1] === undefined) delete process.env.AI_EFFORT; else process.env.AI_EFFORT = keep[1]
    }
  }
  test('set: it wins over AI_EFFORT', () => assert.equal(run('medium', 'low'), 'medium'))
  test('unset: AI_EFFORT', () => assert.equal(run(undefined, 'low'), 'low'))
  test('neither set: medium, the code default production runs', () => assert.equal(run(undefined, undefined), 'medium'))
  test('unreadable: falls back to AI_EFFORT', () => assert.equal(run('hgih', 'high'), 'high'))
})

describe('findReturned — the one link check both features use', () => {
  test('matches by urlKey, returns the search\'s spelling', () => {
    assert.equal(findReturned('http://oregon.gov/olcc/pages/industrial-alcohol.aspx/', returned)?.url, returned[0].url)
    assert.equal(findReturned('', returned), undefined)
    assert.equal(findReturned('https://www.ttb.gov/other', returned), undefined)
  })
})

describe('search limits — a safety rail per call (owner, Part C)', () => {
  const withEnv = (vars: Record<string, string | undefined>, f: () => unknown) => {
    const keep = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
    for (const [k, v] of Object.entries(vars)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    try { return f() } finally {
      for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    }
  }
  test('defaults: 6 for "How do I do this?", 8 for "Everything on this subject"', () => {
    withEnv({ AI_SEARCH_MAX_HOWTO: undefined, AI_SEARCH_MAX_COMPLETE: undefined }, () => {
      assert.equal(searchLimit('AI_SEARCH_MAX_HOWTO', 6), 6)
      assert.equal(searchLimit('AI_SEARCH_MAX_COMPLETE', 8), 8)
    })
  })
  test('a setting wins; an unreadable one falls back to the default', () => {
    withEnv({ AI_SEARCH_MAX_HOWTO: '4', AI_SEARCH_MAX_COMPLETE: 'eight' }, () => {
      assert.equal(searchLimit('AI_SEARCH_MAX_HOWTO', 6), 4)
      assert.equal(searchLimit('AI_SEARCH_MAX_COMPLETE', 8), 8)
    })
  })
  test('max_uses is the smaller of the call\'s limit and the development cap', () => {
    withEnv({ DEV_MAX_SEARCHES: '2' }, () => assert.equal(effectiveSearchCap(6), 2))
    withEnv({ DEV_MAX_SEARCHES: undefined }, () => assert.equal(effectiveSearchCap(6), 6))
    withEnv({ DEV_MAX_SEARCHES: '0' }, () => assert.equal(effectiveSearchCap(8), 8))
    withEnv({ DEV_MAX_SEARCHES: undefined }, () => assert.equal(effectiveSearchCap(undefined), null))
  })
  test('both call sites pass their limit', () => {
    assert.match(readFileSync('app/api/checklist-items/[id]/how-to/route.ts', 'utf8'), /maxSearches: searchLimit\('AI_SEARCH_MAX_HOWTO', 6\)/)
    assert.match(readFileSync('app/api/checklists/from-topic/route.ts', 'utf8'), /maxSearches: searchLimit\('AI_SEARCH_MAX_COMPLETE', 8\)/)
  })
})

/**
 * THE SHARED CHAT ENGINE — Calendar step 10a (`DECISIONS.md` §195, `docs/TESTING.md` C10a).
 *
 * The four things the owner's brief named, each tested without a database and without a model:
 * the brief's own rule (five things, a sixth is a stop), offer parsing, the link check applied to
 * an offer, and the topic's section. Plus the two facts that make this a LIFT rather than a
 * rewrite: HR's files are not imported by the engine, and HR's own route still holds its own copy.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkBrief, BRIEF_FIELDS, type Brief } from '../../lib/ask/brief.ts'
import { parseOffers, offerLine, OFFER_KINDS } from '../../lib/ask/offers.ts'
import { finishAnswer, checkQuote, replacePassageIds, NOT_IN_WHAT_WE_HAVE, tokensOf, type Passage } from '../../lib/ask/passages.ts'
import { answer } from '../../lib/ask/engine.ts'
import { calendarBrief, dateLine, readingBlock, contextBudgetTokens, DATES_SHARE, READINGS_SHARE } from '../../lib/ask/calendarBrief.ts'
import { CALENDAR_SENTENCES } from '../../prompts/calendar-answer.ts'
import { askPrompt, OFFER_FORMAT_SENTENCE } from '../../prompts/ask.ts'
import type { CalendarRow } from '../../lib/calendarView.ts'

const row = (p: Partial<CalendarRow>): CalendarRow => ({
  id: 'r1', title: 'A date', description: null, due_date: null, next_due: null, days_until: null,
  has_passed: false, status: 'proposed', source: 'document', recurs: false, period: null,
  source_line: null, source_url: null, source_page: null, source_title: 'The permit',
  site_id: null, site_name: null, entity_id: null, document_id: 'doc1', handbook_id: null,
  audit_finding_id: null, deadline_id: null, added_by: null, confirmed_by: null, confirmed_at: null,
  dismissed_by: null, dismissed_at: null, dismissed_reason: null, replaced_by: null, created_at: null, ...p,
})

describe('a brief has five things, and a sixth is a stop', () => {
  test('the Calendar\'s brief is a brief', () => {
    assert.doesNotThrow(() => checkBrief(calendarBrief))
    assert.equal(calendarBrief.section, 'calendar')
    assert.deepEqual(calendarBrief.offers, ['add_date'])
    assert.equal(calendarBrief.extraStep, undefined, 'the Calendar passes no extra step')
  })

  /**
   * The rule the owner set, and the reason it is code: a sixth field is a section asking the
   * engine to behave differently in a way no other section can see. It throws where it is used,
   * not in a review — a warning would let it run and be subtly wrong in production.
   */
  test('a sixth kind of difference throws, and names itself', () => {
    const sixth = { ...calendarBrief, refusals: ['no handbooks'] } as unknown as Brief
    assert.throws(() => checkBrief(sixth), /refusals/)
    assert.throws(() => checkBrief(sixth), /decision 28/)
  })

  test('a brief missing one of the five throws, by name', () => {
    for (const f of BRIEF_FIELDS) {
      const broken = { ...calendarBrief } as Record<string, unknown>
      delete broken[f]
      assert.throws(() => checkBrief(broken as unknown as Brief), new RegExp(f), `missing ${f} must throw`)
    }
  })

  test('a brief with no prompt sentences throws — the shared prompt alone is not a section', () => {
    assert.throws(() => checkBrief({ ...calendarBrief, promptSentences: [] }), /no prompt sentences/)
  })
})

describe('the offers, and the check that an offer is not more trusted than a citation', () => {
  const searched = [{ url: 'https://www.oregon.gov/deq/tier-ii', title: 'Oregon DEQ — Tier II' }]
  const good = (over: Record<string, unknown> = {}) => '```offer\n' + JSON.stringify({
    kind: 'add_date', title: 'Tier II inventory report', due_on: '2027-03-01', recurs: true,
    period: 'year', site: null, source_url: 'https://www.oregon.gov/deq/tier-ii',
    source_line: 'The annual Tier II inventory is due by March 1.', ...over,
  }) + '\n```'

  test('a good offer is parsed, and taken OUT of what the person reads', () => {
    const p = parseOffers(`Here is the rule.\n\n${good()}`, ['add_date'], searched)
    assert.equal(p.offers.length, 1)
    assert.equal(p.offers[0].title, 'Tier II inventory report')
    assert.equal(p.offers[0].period, 'year')
    assert.ok(!p.text.includes('```'), 'no fence is left on screen')
    assert.equal(p.text, 'Here is the rule.')
  })

  /**
   * *** THE RULE THIS WHOLE FILE EXISTS FOR. *** An offer carries a date into the customer's
   * calendar, so "where did this come from" must be answerable. A URL the model remembered is not
   * an answer, and `findReturned` is the same function the link check uses — so an offer can never
   * be more trusted than a citation of the same page.
   */
  test('an offer whose link this call did not search is DROPPED, and counted', () => {
    const p = parseOffers(good({ source_url: 'https://example.gov/invented' }), ['add_date'], searched)
    assert.equal(p.offers.length, 0)
    assert.equal(p.dropped.unverifiedLink, 1)
    assert.match(offerLine(p), /whose link was not in this call's search/)
  })

  test('a kind the section does not offer is dropped — the engine never acts on an undeclared offer', () => {
    const p = parseOffers('```offer\n{"kind":"send_email","to":"everyone"}\n```', ['add_date'], searched)
    assert.equal(p.offers.length, 0)
    assert.equal(p.dropped.unknownKind, 1)
    // And a section that offers nothing drops even a well-formed add_date.
    assert.equal(parseOffers(good(), [], searched).dropped.unknownKind, 1)
  })

  test('a block that is not JSON, and one missing what it needs, are each counted', () => {
    assert.equal(parseOffers('```offer\nnot json at all\n```', ['add_date'], searched).dropped.notJson, 1)
    // A date that happens once needs a day (decision 12, migration 073's own CHECK).
    const once = parseOffers(good({ due_on: null, recurs: false }), ['add_date'], searched)
    assert.equal(once.offers.length, 0)
    assert.equal(once.dropped.badShape, 1)
    // No title is a button with nothing on it.
    assert.equal(parseOffers(good({ title: '' }), ['add_date'], searched).dropped.badShape, 1)
  })

  test('a repeating date with no day is a real offer — decision 23', () => {
    const p = parseOffers(good({ due_on: null, recurs: true, period: null }), ['add_date'], searched)
    assert.equal(p.offers.length, 1)
    assert.equal(p.offers[0].due_on, null)
    assert.equal(p.offers[0].period, null)
  })

  test('two offers in one answer are both read', () => {
    const p = parseOffers(`${good()}\n\n${good({ title: 'Second thing' })}`, ['add_date'], searched)
    assert.equal(p.offers.length, 2)
    assert.equal(p.text, '')
  })

  test('the kinds are a closed list', () => {
    assert.deepEqual([...OFFER_KINDS], ['add_date'])
  })
})

describe('an offer block is pulled out BEFORE the prose is checked', () => {
  /**
   * The order a real run forced. An offer's `source_line` is a quoted sentence inside JSON; with
   * the check running first it appended its own words inside that string and `JSON.parse` then
   * failed, so a good offer was counted as unreadable. The check still applies to the offer's
   * LINK — the same `findReturned` a citation gets.
   */
  test('a quoted source_line does not make the offer unreadable', () => {
    const searched = [{ url: 'https://www.oregon.gov/deq/tier-ii', title: 'DEQ' }]
    const body = JSON.stringify({ kind: 'add_date', title: 'Tier II report', due_on: '2027-03-01',
      recurs: true, period: 'year', site: null, source_url: 'https://www.oregon.gov/deq/tier-ii',
      source_line: 'States have flexibility to implement the reporting requirements as appropriate for their communities.' }, null, 2)
    const text = `Here is the rule.\n\n\`\`\`offer\n${body}\n\`\`\``
    const p = parseOffers(text, ['add_date'], searched)
    assert.equal(p.offers.length, 1, 'the offer survives its own quotation marks')
    assert.equal(p.dropped.notJson, 0)
    // And the prose that is left is what the quote check then sees.
    const out = finishAnswer(p.text, [], searched, [])
    assert.equal(out.notFound, 0)
    assert.equal(out.text, 'Here is the rule.')
  })

  test('the engine runs them in that order', () => {
    const engine = readFileSync('lib/ask/engine.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(engine.indexOf('parseOffers(') < engine.indexOf('finishAnswer('),
      'the blocks must be out of the text before the quote check reads it')
  })
})

describe('the link and quote check, over passages instead of handbooks', () => {
  const passages: Passage[] = [{
    id: 'C1', title: 'Permit expires — the line this date was read from', label: 'your calendar',
    text: 'This permit expires on November 15, 2026, unless a timely renewal application has been submitted.',
    href: '/calendar?date=abc',
  }]
  const searched = [{ url: 'https://www.oregon.gov/deq/acdp', title: 'Oregon DEQ' }]
  const cited = [{ n: 1, title: 'Oregon DEQ', url: 'https://www.oregon.gov/deq/acdp' },
                 { n: 2, title: 'Remembered page', url: 'https://example.com/not-searched' }]

  test('a citation of a page this call searched is kept and renumbered; one it did not is dropped', () => {
    const out = finishAnswer('The rule says so[1]. Another claim[2].', cited, searched, passages)
    assert.match(out.text, /The rule says so\[1\]\./)
    assert.ok(!out.text.includes('[2]'), 'the unsearched citation is gone')
    assert.equal(out.droppedLinks, 1)
    assert.equal(out.sources.length, 1)
    assert.equal(out.sources[0].kind, 'web')
  })

  test('a quote found in a passage becomes a card, in the place the model put it', () => {
    const out = finishAnswer('Your permit says [C1: "This permit expires on November 15, 2026"].', cited, searched, passages)
    assert.match(out.text, /“This permit expires on November 15, 2026”\[1\]/)
    assert.equal(out.sources[0].kind, 'passage')
    assert.equal((out.sources[0] as { passage_id?: string }).passage_id, 'C1')
    assert.equal(out.droppedQuotes, 0)
  })

  test('a marked quote that is in no passage is removed and counted', () => {
    const out = finishAnswer('It says [C1: "the permit may be renewed at any time without notice"].', cited, searched, passages)
    assert.ok(!out.text.includes('C1'), 'the marker is gone')
    assert.equal(out.droppedQuotes, 1)
    assert.equal(out.sources.length, 0)
  })

  test('a PLAIN quote is checked too, and one found in nothing is marked in the product\'s words', () => {
    const found = finishAnswer('The line reads "This permit expires on November 15, 2026, unless a timely renewal".',
      cited, searched, passages)
    assert.match(found.text, /\[1\]/, 'a plain quote that is real becomes a card')
    const not = finishAnswer('The document says "we have decided to stop filing these reports entirely".',
      cited, searched, passages)
    assert.ok(not.text.includes(NOT_IN_WHAT_WE_HAVE))
    assert.equal(not.notFound, 1)
  })

  test('a short phrase in quotation marks is not a quote — six words, as HR has it', () => {
    const out = finishAnswer('It is a "renewal application" in their words.', cited, searched, passages)
    assert.equal(out.notFound, 0)
    assert.ok(out.text.includes('"renewal application"'))
    assert.equal(checkQuote('renewal application', 'C1', passages), null)
  })

  test('the claimed passage may be wrong while the words are right — it is still found', () => {
    const hit = checkQuote('This permit expires on November 15, 2026', 'C9', passages)
    assert.equal(hit?.id, 'C1')
  })
})

describe('an internal id never reaches the person', () => {
  const passages: Passage[] = [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `C${n}`, title: `Date ${n} — the line`, label: 'your calendar', text: '', shortName: `Date ${n}`,
  }))
  test('a bare id becomes the thing it names', () => {
    assert.equal(replacePassageIds('This is on your calendar as date C3.', passages),
      'This is on your calendar as date Date 3.')
  })
  test('a RANGE becomes a count, because five titles in one parenthesis is worse than the ids were', () => {
    assert.equal(replacePassageIds('as confirmed dates C1–C5', passages), 'as confirmed dates (5 of them)')
  })
  test('and so does a list of three or more — the shape the next run used', () => {
    assert.equal(replacePassageIds('as entries (C1, C2, C3, C4, C5)', passages), 'as entries (5 of them)')
    // Two keep their names: that reads perfectly well.
    assert.equal(replacePassageIds('as C1 and C2', passages), 'as Date 1 and Date 2')
  })
  test('an id the answer was never given is left exactly as written', () => {
    assert.equal(replacePassageIds('See C9 and form W2.', passages), 'See C9 and form W2.')
  })
})

describe('the topic is this company\'s, this section\'s, and open', () => {
  /** A stand-in client that answers one `topics` read. */
  const dbWith = (topic: Record<string, unknown> | null) => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: topic }) }) }) }),
    }),
  }) as never

  const run = async (topic: Record<string, unknown> | null) => {
    const events = []
    for await (const ev of answer(calendarBrief, {
      db: dbWith(topic), admin: dbWith(topic), companyId: 'co1', question: 'When?', topicId: 't1',
    })) { events.push(ev); if (ev.type === 'refused') break }
    return events
  }

  test('a conversation of ANOTHER section is 404, and no model is called', async () => {
    const ev = await run({ id: 't1', status: 'open', section: 'hr' })
    assert.deepEqual(ev, [{ type: 'refused', status: 404, message: 'Conversation not found' }])
  })

  test('one that is not there at all is the same 404 — ids cannot be probed (§3.6)', async () => {
    const ev = await run(null)
    assert.equal(ev[0].type, 'refused')
    assert.equal((ev[0] as { status: number }).status, 404)
  })

  test('a closed one is 409, in the words the workspace uses', async () => {
    const ev = await run({ id: 't1', status: 'closed', section: 'calendar' })
    assert.equal((ev[0] as { status: number }).status, 409)
    assert.match((ev[0] as { message: string }).message, /Ask your question again/)
  })

  test('a new conversation is written with the brief\'s section, never a literal', () => {
    const engine = readFileSync('lib/ask/engine.ts', 'utf8')
    assert.match(engine, /section: brief\.section/)
    assert.ok(!/section: 'calendar'/.test(engine), 'the engine names no section of its own')
  })
})

describe('this is a LIFT: HR is not touched and not imported', () => {
  const engineFiles = ['lib/ask/engine.ts', 'lib/ask/brief.ts', 'lib/ask/passages.ts', 'lib/ask/offers.ts',
    'lib/ask/calendarBrief.ts', 'prompts/ask.ts', 'prompts/calendar-answer.ts']

  test('no engine file imports HR\'s own machinery', () => {
    for (const f of engineFiles) {
      const src = readFileSync(f, 'utf8')
      const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1])
      for (const i of imports) {
        assert.ok(!/hrAnswer|hr-answer|hrSummary|handbook/i.test(i), `${f} imports ${i}`)
      }
    }
  })

  test('HR still holds its own copy, so HR\'s behaviour cannot move with the engine', () => {
    const hr = readFileSync('app/api/hr/answer/route.ts', 'utf8')
    assert.match(hr, /from '@\/lib\/hrAnswer'/)
    assert.match(hr, /hrAnswerPrompt\(\)/)
    assert.ok(!/lib\/ask/.test(hr), 'HR must not call the engine in this step')
    assert.match(readFileSync('lib/hrAnswer.ts', 'utf8'), /export function finishAnswer/)
  })

  test('the shared prompt is the workspace\'s own function, not a copy of it', () => {
    const ask = readFileSync('prompts/ask.ts', 'utf8')
    assert.match(ask, /import \{ buildSystemPrompt \} from '\.\/checklist\.ts'/)
    assert.match(ask, /buildSystemPrompt\('research', null, \{ open: true \}\)/)
  })
})

describe('the Calendar\'s own sentences', () => {
  const prompt = askPrompt(CALENDAR_SENTENCES)

  test('the shared prompt comes first, then the section\'s sentences in order', () => {
    const shared = askPrompt([])
    assert.ok(prompt.startsWith(shared), 'the workspace\'s prompt is the head')
    let at = shared.length
    for (const s of CALENDAR_SENTENCES) {
      const i = prompt.indexOf(s, at)
      assert.ok(i >= at, `out of order: ${s.slice(0, 40)}`)
      at = i + s.length
    }
  })

  test('it says what the product does not say, and the ban is in the prompt rather than in a filter', () => {
    for (const must of ['HAS PASSED', 'Never say "AI"', 'not confirmed', 'not legal advice']) {
      assert.ok(prompt.includes(must), `missing: ${must}`)
    }
    // Decision 30, in the prompt itself.
    assert.match(prompt, /say so in one clear, polite sentence and ask one question/)
  })

  test('the offer format is the engine\'s sentence, and the offer itself is the section\'s', () => {
    assert.ok(CALENDAR_SENTENCES.includes(OFFER_FORMAT_SENTENCE))
    assert.match(prompt, /kind "add_date"/)
    assert.match(prompt, /never offer a date that is already/)
  })
})

describe('what the Calendar packs, and the budget', () => {
  test('a date carries everything a question could turn on, and its row id', () => {
    const line = dateLine(row({ id: 'abc', title: 'Permit expires', next_due: '2026-11-15',
      status: 'proposed', source_title: 'Air permit', source_line: 'This permit expires on November 15, 2026.' }), 'C1', 1)
    assert.match(line, /id="C1"/)
    assert.match(line, /row="abc"/)
    assert.match(line, /when="15 November 2026"/)
    assert.match(line, /status="not confirmed"/)
    assert.match(line, /from="Air permit"/)
    assert.match(line, /"This permit expires on November 15, 2026\."/)
  })

  test('a repeating date whose period was never read says so, and never shows a day it does not have', () => {
    const line = dateLine(row({ recurs: true, period: null, due_date: '2026-08-20', next_due: null }), 'C2', 1)
    assert.match(line, /repeats="repeats, how often wasn't read"/)
    assert.ok(!/when=/.test(line.split('>')[0].replace('no day read yet', '')) || line.includes('no day read yet'))
  })

  test('the site is in the line only when the company has more than one (decision 24)', () => {
    const r = row({ site_name: 'Portland plant', site_id: 's1' })
    assert.ok(!dateLine(r, 'C1', 1).includes('site='))
    assert.match(dateLine(r, 'C1', 2), /site="Portland plant"/)
  })

  test('a reading is the READING, never the file (decision 16)', () => {
    const block = readingBlock({ document_id: 'd1', title: 'Air permit 26-2841', kind: 'permit', issuer: 'Oregon DEQ',
      doc_date: '2026-01-05', scanned_at: '2026-10-14T09:00:00Z', display_status: 'current', summary: 'A permit for one site.' },
      [{ document_id: 'd1', condition_ref: 'Condition 14', title: 'Annual report', evidence_expected: 'the submitted report' }], 'D1')
    assert.match(block, /kind="Permit"/)
    assert.match(block, /read="14 October 2026"/)
    assert.match(block, /A permit for one site\./)
    assert.match(block, /Condition 14 — Annual report — the submitted report/)
    assert.ok(!/raw_text|extracted_text/.test(block), 'the file\'s own text is not sent')
  })

  test('the budget is a number with an override, and the shares leave room for the answer', () => {
    assert.equal(contextBudgetTokens(), 120_000)
    assert.ok(DATES_SHARE + READINGS_SHARE < 1, 'something is always left for the findings and the question')
    assert.equal(tokensOf('a'.repeat(100)), 40)
  })
})

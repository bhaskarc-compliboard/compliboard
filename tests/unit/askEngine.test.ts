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
import type { Offer, AddDateOffer } from '../../lib/ask/offers.ts'
import { parseOffers, offerLine, OFFER_KINDS } from '../../lib/ask/offers.ts'
import { finishAnswer, checkQuote, replacePassageIds, passagesNamed, appendSources, NOT_IN_WHAT_WE_HAVE, tokensOf, ATTACHED_PREFIX, type Passage } from '../../lib/ask/passages.ts'
import {
  answer, sectionRuns, attachedContextBlock, lastUserMessage, NO_CARRIED_FILES,
  attachedPassages, noTextNote, carriedList,
  type CarriedFiles,
} from '../../lib/ask/engine.ts'
import { MAX_CARRIED_DOCUMENTS } from '../../lib/attachedDocument.ts'
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

/**
 * `Offer` became a union on 3 November 2026 when Audits gained `run_audit` (decision 43), so a
 * test that reads `.title` off one has to say WHICH kind it means. These assertions were always
 * about `add_date`; this narrows them and throws loudly if a run_audit offer ever reaches them.
 */
function addDate(o: Offer): AddDateOffer {
  assert.equal(o.kind, 'add_date', 'this assertion is about an add_date offer')
  return o as AddDateOffer
}

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
    assert.equal(addDate(p.offers[0]).title, 'Tier II inventory report')
    assert.equal(addDate(p.offers[0]).period, 'year')
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
    assert.equal(addDate(p.offers[0]).due_on, null)
    assert.equal(addDate(p.offers[0]).period, null)
  })

  test('two offers in one answer are both read', () => {
    const p = parseOffers(`${good()}\n\n${good({ title: 'Second thing' })}`, ['add_date'], searched)
    assert.equal(p.offers.length, 2)
    assert.equal(p.text, '')
  })

  /**
   * `run_audit` joined it on 3 November 2026 (decision 43): Audits' one offer, "start the audit
   * this answer is about". A third kind is a deliberate edit here, which is what a closed list is
   * for — `parseOffers` acts on what a section declares, so a kind nobody agreed to must not be
   * addable by writing a block.
   */
  test('the kinds are a closed list', () => {
    assert.deepEqual([...OFFER_KINDS], ['add_date', 'run_audit'])
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

/**
 * *** EACH SECTION RUNS AS ITSELF — `docs/GAPS-PLAN.md` Part A step 1, decision 11. ***
 *
 * The engine had `brief.section === 'calendar' ? 'calendar' : 'hr'` in two places and
 * `AI_SEARCH_MAX_HR` in a third, so a third section's answers would have run on HR's tier, been
 * billed to HR's ledger word, and been capped by HR's variable. None of that is an error anybody
 * would see: it is a wrong line in `npm run cost` and a model nobody chose.
 *
 * *** WHAT IS PROVED HERE, AND WHAT IS NOT. *** `sectionRuns` is the one lookup and it is tested
 * directly. That the engine USES it for both the tier and the ledger word — rather than keeping a
 * literal beside it — is asserted against the source, because the test runner does not mock
 * modules (`scripts/test-guard.js:254` runs `node --test` with no module-mock flag) and the only
 * other way to see the argument would be to call a model. The end-to-end evidence that the ledger
 * word arrives is the one real Calendar answer at the end of step 1, whose `ai_calls` row says
 * `task = 'calendar'`.
 */
describe('each section runs on its own tier, ledger word and search cap', () => {
  test("a brief with section 'documents' runs the model and the ledger as 'documents'", () => {
    assert.deepEqual(sectionRuns('documents'),
      { task: 'documents', cap: 'AI_SEARCH_MAX_DOCUMENTS' })
  })

  test("and 'calendar' still gets 'calendar' — the Calendar's behaviour does not move", () => {
    assert.deepEqual(sectionRuns('calendar'),
      { task: 'calendar', cap: 'AI_SEARCH_MAX_CALENDAR' })
  })

  test('HR keeps its own word and its own cap, so capping HR cannot cap anybody else', () => {
    assert.deepEqual(sectionRuns('hr'), { task: 'hr', cap: 'AI_SEARCH_MAX_HR' })
    assert.deepEqual(sectionRuns('audits_chat'),
      { task: 'audits_chat', cap: 'AI_SEARCH_MAX_AUDITS_CHAT' })
    // Four sections, four caps: no two share one.
    const caps = (['hr', 'calendar', 'documents', 'audits_chat'] as const).map((x) => sectionRuns(x).cap)
    assert.equal(new Set(caps).size, 4)
  })

  test('a section with no chat THROWS rather than falling back to somebody else', () => {
    // `workspace` is a TopicSection and runs `/api/chat`, the owner's open baseline, which this
    // engine does not touch (decision 2). A fallback here would bill its answers to HR.
    assert.throws(() => sectionRuns('workspace'), /has no model tier, ledger task or search cap/)
  })

  test('the engine asks that one lookup, and holds no section of its own', () => {
    const engine = readFileSync('lib/ask/engine.ts', 'utf8')
    assert.match(engine, /const runs = sectionRuns\(brief\.section\)/)
    assert.match(engine, /^\s+task: runs\.task,$/m, 'the tier must come from the lookup')
    assert.match(engine, /ledger: \{ companyId, task: runs\.task \}/, 'the ledger word must be the same one')
    assert.match(engine, /searchLimit\(runs\.cap, null\)/, 'the cap must be the section\'s own')
    /**
     * THE TWO LITERALS THIS STEP REMOVED — asserted against the CODE, not the comments.
     *
     * Written without the comment strip, this test failed twice on prose: once on the paragraph in
     * the engine that quotes the old `brief.section === 'calendar' ? …` line to say what it
     * replaced, and once on `SECTION_RUNS`, where `'AI_SEARCH_MAX_HR'` is HR's cap and belongs
     * there. A substring is not a call site (`calendarShell.test.ts:396`), and the second failure
     * was the test being wrong rather than the code.
     */
    const code = engine.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/brief\.section === '/.test(code), 'the engine compares a section against a literal again')
    // HR's cap is a VALUE in the map, which is right. What must not come back is the engine asking
    // for it by name, which is what made it every section's cap.
    assert.ok(!/searchLimit\('AI_SEARCH_MAX_HR'/.test(code), 'the engine reads HR\'s search cap for every section again')
  })
})

/**
 * *** A CONVERSATION CARRIES THE FILE THAT WAS ATTACHED TO IT — `docs/GAPS-PLAN.md` Part A step 3,
 * decision 12. ***
 *
 * *** WHAT IS TESTED HERE, AND WHY IT IS THESE TWO FUNCTIONS. *** `lib/attachedDocument.ts` is NOT
 * re-implemented and not re-tested — it has its own file, and the engine calls it. What this tests
 * is the part the engine owns: the ORDER the pieces go into the message, the sentences it adds
 * around them, and what the context event says. Both are pure functions taking the shapes
 * `loadAttachedDocument` and `loadTopicAttachments` return, so the seam is stubbed with data
 * rather than mocked — which is also the only way, since the runner cannot mock modules.
 */
describe('a conversation carries its attached file', () => {
  const doc = (id: string, name: string) => ({ id, name, blocks: [{ type: 'document', id }] })
  const text = (m: ReturnType<typeof lastUserMessage>) => {
    const c = m.content as Array<{ type: string; text?: string }>
    return typeof m.content === 'string' ? m.content : (c[c.length - 1].text ?? '')
  }
  const blocksOf = (m: ReturnType<typeof lastUserMessage>) =>
    (typeof m.content === 'string' ? [] : (m.content as Array<{ type: string; id?: string }>))
      .filter((b) => b.type === 'document').map((b) => b.id)

  test('with no file at all the message is the single string it always was', () => {
    const m = lastUserMessage(NO_CARRIED_FILES, 'THE CONTEXT', 'When?')
    assert.equal(typeof m.content, 'string')
    assert.equal(m.content, 'THE CONTEXT\n\nQuestion: When?')
  })

  test('a documentId reaches the message as blocks, in the Workspace\'s order', () => {
    // This turn's file first, then the earlier ones, then the words — `app/api/chat/route.ts:257`.
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: doc('new', 'Certificate.pdf'),
      documents: [doc('older', 'A.pdf'), doc('oldest', 'B.pdf')],
      priorAttachments: 'Documents attached to this conversation:\n- A.pdf\n- B.pdf' }
    const m = lastUserMessage(files, 'THE CONTEXT', 'What dates?')
    assert.deepEqual(blocksOf(m), ['new', 'older', 'oldest'], 'the just-attached file comes first')
    const t = text(m)
    assert.match(t, /^The user has just attached this file: Certificate\.pdf/)
    assert.ok(t.indexOf('Certificate.pdf') < t.indexOf('A.pdf'), 'this turn\'s file is named before the earlier ones')
    assert.ok(t.indexOf('A.pdf') < t.indexOf('THE CONTEXT'), 'the earlier files come before the context')
    assert.ok(t.endsWith('Question: What dates?'), 'the question is last')
  })

  test('a second turn with no new file still carries the first turn\'s', () => {
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      documents: [doc('first', 'Certificate.pdf')],
      priorAttachments: '- Certificate.pdf (read as: certificate)' }
    const m = lastUserMessage(files, 'THE CONTEXT', 'Is it on the calendar?')
    assert.deepEqual(blocksOf(m), ['first'], 'the document itself travels, not only a note about it')
    assert.match(text(m), /Certificate\.pdf/)
    assert.ok(!/has just attached/.test(text(m)), 'nothing was attached on this turn')
  })

  test('the cap says what it left out, rather than quietly answering from part of the evidence', () => {
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      documents: [doc('a', 'A'), doc('b', 'B'), doc('c', 'C')],
      omitted: 1,
      priorAttachments: '- A\n- B\n- C' }
    const m = lastUserMessage(files, 'THE CONTEXT', 'What do they say?')
    assert.match(text(m), /1 earlier attachment\(s\) are not included in this message/)
    assert.match(text(m), new RegExp(`only the ${MAX_CARRIED_DOCUMENTS} most recent are carried`))
    assert.match(text(m), /Say so if the question depends on them/)
  })

  test('a file that could not be read back is SAID, and the answer still runs (§5.1)', () => {
    const m = lastUserMessage({ ...NO_CARRIED_FILES, askedForButMissing: true }, 'THE CONTEXT', 'What is in it?')
    assert.match(text(m), /^The user attached a file to this conversation, but it could not be read back just now\./)
    assert.match(text(m), /Say so rather than answering as though nothing was attached/)
    // And the question is still there: a file we could not read does not cancel the question.
    assert.ok(text(m).endsWith('Question: What is in it?'))
  })

  test('the context event names the file, and does not pretend to price it', () => {
    assert.equal(attachedContextBlock(NO_CARRIED_FILES), null, 'no file, no block')
    const b = attachedContextBlock({ ...NO_CARRIED_FILES, attached: doc('x', 'X.pdf') })
    assert.deepEqual(b, { name: 'the attached file', chars: 0, tokens: 0, leftOut: null })
    // A base64 document block has no meaningful character count, so 0 is honest and a number
    // from TOKENS_PER_CHAR would not be. The comment saying so is in the engine.
    assert.match(readFileSync('lib/ask/engine.ts', 'utf8'), /IS NOT PRICED/)
  })

  test('and when the cap bit, the event says so too — so check_record records it', () => {
    const b = attachedContextBlock({ ...NO_CARRIED_FILES, documents: [doc('a', 'A')], omitted: 2 })
    assert.match(String(b?.leftOut), /2 earlier attachment\(s\) are not carried/)
  })

  /**
   * *** THE EVENT AND THE RECORD ARE THE SAME LIST, AND THEY WERE NOT. ***
   * On the first real run of step 3 the context EVENT named the attached file and `check_record`
   * did not — the record mapped `packed.blocks`, which an attachment is not one of. Found by
   * reading the stored row on staging, not the code. An answer that read a document its own
   * record does not mention is the one failure that record exists to prevent.
   */
  test('check_record carries the same blocks the event did, attached file and all', () => {
    const engine = readFileSync('lib/ask/engine.ts', 'utf8')
    assert.match(engine, /const eventBlocks = \[/)
    assert.match(engine, /yield \{ type: 'context', blocks: eventBlocks, tokens: totalTokens \}/)
    assert.match(engine, /context: eventBlocks\.map\(/)
    assert.ok(!/context: packed\.blocks\.map\(/.test(engine),
      'the record must not build its own list again')
  })

  test('the engine uses these two functions, so there is one implementation and not two', () => {
    const engine = readFileSync('lib/ask/engine.ts', 'utf8')
    assert.match(engine, /messages\.push\(lastUserMessage\(files, contextText, question\)\)/)
    assert.match(engine, /const attachedBlock = attachedContextBlock\(files\)/)
    // It calls lib/attachedDocument.ts rather than carrying its own copy of any of it.
    for (const fn of ['loadAttachedDocument', 'describeAttachments', 'loadTopicAttachments']) {
      assert.match(engine, new RegExp(`${fn}\\(`), `the engine must call ${fn}`)
    }
    assert.match(engine, /from '\.\.\/attachedDocument\.ts'/)
  })

  test('the turn remembers the file, and the document remembers the conversation', () => {
    const engine = readFileSync('lib/ask/engine.ts', 'utf8')
    // migration 039: the id AND a copy of the name, so the transcript survives a deletion.
    assert.match(engine, /documentId: attached\?\.id \?\? null, documentName: attached\?\.name \?\? null/)
    // and the backfill, only where it is null — a file's first conversation keeps it.
    assert.match(engine, /\.update\(\{ from_topic_id: topicId \}\)[\s\S]{0,80}\.is\('from_topic_id', null\)/)
  })

  test('the brief did not gain a sixth field for this (decision 12)', () => {
    const brief = readFileSync('lib/ask/brief.ts', 'utf8')
    assert.ok(!/document/i.test(brief.replace(/\/\*[\s\S]*?\*\//g, '')), 'a file is not a thing a section KNOWS')
    assert.match(readFileSync('lib/ask/engine.ts', 'utf8'), /documentId\?: string \| null/)
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
describe("the Calendar's own routes, step 10b", () => {
  const strip = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  test('the answer route is a loop over the engine and decides nothing itself', () => {
    const route = strip('app/api/calendar/answer/route.ts')
    assert.match(route, /answer\(calendarBrief, \{/)
    assert.match(route, /requireCompany\(request\)/)
    // The wire format the shared reader reads: `done` carries `research`.
    assert.match(route, /type: 'done', research: ev\.text/)
    // Nothing about an answer is built here.
    for (const banned of [/askAIOpenStream/, /buildSystemPrompt/, /\.from\('topics'\)/, /\.from\('calendar_v'\)/]) {
      assert.ok(!banned.test(route), `the route must not do this itself: ${banned}`)
    }
  })

  test('a summary is this section\'s, and the claim is in the route where after() can be called', () => {
    const route = strip('app/api/calendar/topics/[id]/summarise/route.ts')
    assert.match(route, /topic\.section !== 'calendar'/, 'another section\'s conversation is a 404')
    assert.match(route, /claimTopic\(db, id, 'summary'\)/)
    assert.match(route, /after\(async \(\) => \{/)
    assert.match(route, /releaseTopic\(db, id, 'summary', claim\.claimedAt\)/)
    assert.match(route, /section: 'calendar'/)
  })

  /**
   * *** THE CHAT'S OFFER IS THE ONE OTHER SOURCE `POST /api/calendar` TAKES. *** A body naming
   * 'document', 'audit' or 'handbook' would be a browser claiming a MACHINE read something; those
   * arrive through `lib/documentScan.ts` and `lib/auditRun.ts`, never from a page.
   */
  test('POST accepts source \'rule\' and nothing else new, and a rule date needs its page', () => {
    const route = strip('app/api/calendar/route.ts')
    assert.match(route, /const asRule = body\?\.source === 'rule'/)
    assert.match(route, /source: asRule \? 'rule' : 'person'/)
    assert.match(route, /A date from a rule needs the page the rule was read on/)
    for (const word of ["'document'", "'audit'", "'handbook'"]) {
      assert.ok(!route.includes(`body?.source === ${word}`), `the route must not accept ${word} from a browser`)
    }
  })

  test('the answer is stored as a conversation of THIS section', () => {
    // The engine writes `section: brief.section`; the brief says 'calendar'; the page reads the
    // same word back. Three places, one word, and this is the test that they are the same word.
    assert.equal(calendarBrief.section, 'calendar')
    assert.match(readFileSync('app/calendar/page.tsx', 'utf8'), /readTopicList\(supabase, 'calendar'\)/)
  })

  test('the ask view writes through the one writer, and builds no row', () => {
    const ui = strip('components/CalendarAsk.tsx')
    assert.match(ui, /method: 'POST'[\s\S]{0,400}source: 'rule'/)
    assert.ok(!/\.from\('calendar_events'\)/.test(ui), 'the page never touches the table')
    assert.ok(!/status: 'confirmed'/.test(ui), 'it names no status — proposeDate decides that')
  })
})

/**
 * *** A QUOTE FROM AN ATTACHED FILE CAN BE CHECKED — `docs/GAPS-PLAN.md` decision 22a, the
 * owner's yes of 2 November 2026. ***
 *
 * The defect these cover was photographed at `shots/step3-bubble.png`: a quote the model took
 * straight out of an attached PDF came back marked *"we could not find these words in what we
 * have on file"*, because the check compares a quote against the passages a BRIEF packed and an
 * attachment contributed none. The fix is one additive field in `lib/attachedDocument.ts` —
 * `parseDocumentToBlocks` already computes the text and the function threw it away — and the
 * engine turning it into an `A` passage for every section.
 */
describe('the file a conversation carries is something a quote can be checked against', () => {
  /** Comments stripped before asserting — the house pattern: my own comment must not be the hit. */
  const source = (f: string) => readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const file = (name: string, text: string, id?: string) =>
    ({ id, name, blocks: [{ type: 'document', id: name }], text })
  const LINE = 'All fourteen units were serviced and tagged on 20 August 2025.'

  test('lib/attachedDocument.ts returns the text it already computes', () => {
    const src = readFileSync('lib/attachedDocument.ts', 'utf8')
    assert.match(src, /text: parsed\.text/, 'the field the fix is')
    assert.match(src, /^\s+text: string$/m, 'and it is on the interface')
    // It is never sent: the whole file is already in the message as a block.
    assert.match(src, /It is never sent to the model/)
  })

  /**
   * *** IT WAS `A` AND IS `AF` SINCE 3 NOVEMBER 2026 — decision 44, found by step 6a's runs. ***
   * An auditor's checklist numbers its own lines A1…A5, so `replacePassageIds` was rewriting
   * *"line A1"* into the attached file's name and the person read
   * *"line 12-auditor-checklist-deq-air.docx"*. Three runs of three, in the Documents brief as
   * well as the Audits one. The test below this one holds the fix at the place it bit.
   */
  test('AF is the engine\'s letter, and no brief may take it for a kind of its own', () => {
    assert.equal(ATTACHED_PREFIX, 'AF')
    // Every brief in the repository, read as text: none may pack its own AF passages, or two
    // different things would answer to one handle and the wrong one would be named.
    for (const f of ['lib/ask/calendarBrief.ts', 'lib/ask/documentsBrief.ts', 'lib/ask/auditsBrief.ts']) {
      const src = source(f)
      assert.ok(!/idPrefix: 'AF?'/.test(src), `${f} must not use the engine's letter`)
      assert.ok(!/`AF?\$\{/.test(src), `${f} must not build an attached-file id`)
    }
  })

  /**
   * *** THE COLLISION, AT THE PLACE IT BIT. *** A person attaches an auditor's checklist and the
   * answer says "line A1". With `A` as the attached file's handle that sentence came out naming
   * the file; with `AF` it is left alone, and the real handle is still replaced.
   */
  test('a checklist\'s own A1 survives the answer; the engine\'s AF1 is still named', () => {
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: { ...file('deq-air-checklist.docx', LINE, 'd1'), id: 'd1', name: 'deq-air-checklist.docx' } }
    const passages = attachedPassages(files)
    assert.equal(replacePassageIds('Line A1 asks for a current permit.', passages),
      'Line A1 asks for a current permit.')
    assert.equal(replacePassageIds('As AF1 shows, the permit is on file.', passages),
      'As deq-air-checklist.docx shows, the permit is on file.')
  })

  test('every carried file gets a passage, this turn\'s first, numbered from 1', () => {
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: { ...file('Certificate.pdf', LINE, 'doc-9'), id: 'doc-9', name: 'Certificate.pdf' },
      documents: [file('Older.pdf', 'something else entirely, in words')] }
    const ps = attachedPassages(files)
    assert.deepEqual(ps.map((p) => p.id), ['AF1', 'AF2'])
    assert.equal(ps[0].shortName, 'Certificate.pdf')
    assert.equal(ps[0].label, 'the file you attached')
    assert.equal(ps[0].href, '/documents?document=doc-9', 'the card opens the document')
    assert.deepEqual(carriedList(files).length, 2)
  })

  test('AND THE QUOTE NOW MATCHES — the whole point of the change', () => {
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: { ...file('Certificate.pdf', `Service record\n${LINE}\nNext annual due 2026-08-20.`, 'd1'),
        id: 'd1', name: 'Certificate.pdf' } }
    const passages = attachedPassages(files)
    const hit = checkQuote(LINE, 'AF1', passages)
    assert.equal(hit?.id, 'AF1', 'a quote from the attached file is found')
    // And end to end, through the check the answer really goes through: no marking, one source.
    const checked = finishAnswer(`The certificate says “${LINE}”`, [], [], passages, [])
    assert.ok(!checked.text.includes(NOT_IN_WHAT_WE_HAVE), checked.text)
    assert.equal(checked.notFound, 0)
    assert.equal(checked.sources.length, 1)
    assert.equal((checked.sources[0] as { passage_id: string }).passage_id, 'AF1')
  })

  /**
   * *** AND WITH THE FIELD MISSING IT GOES BACK TO BEING MARKED. *** The test that proves these
   * tests can see the defect at all (`CLAUDE.md` §9a: prove a presence before claiming an
   * absence). A file with no text is the same case, and is the honest one — `PENDING.md` D3.
   */
  test('a file with no text to check against still marks the quote, as it always did', () => {
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: { ...file('Scan.pdf', '', 'd2'), id: 'd2', name: 'Scan.pdf' } }
    const passages = attachedPassages(files)
    assert.equal(passages.length, 1, 'it is still a named handle')
    assert.equal(passages[0].text, '')
    const checked = finishAnswer(`It says “${LINE}”`, [], [], passages, [])
    assert.ok(checked.text.includes(NOT_IN_WHAT_WE_HAVE))
    assert.equal(checked.notFound, 1)
  })

  test('a passage with nothing in it still gets the file\'s NAME into the sentence', () => {
    // `replacePassageIds`' reason: an answer that writes "AF1" at a person is the Calendar's
    // "dates C6 and C7" happening in a new place.
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: { ...file('Scan.pdf', '', 'd2'), id: 'd2', name: 'Scan.pdf' } }
    assert.equal(replacePassageIds('as AF1 shows', attachedPassages(files)), 'as Scan.pdf shows')
  })

  test('the files with no text are named in the message, and counted', () => {
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: { ...file('Photo.pdf', '', 'd3'), id: 'd3', name: 'Photo.pdf' },
      documents: [file('Scan.png', ''), file('Readable.docx', 'words we can read back, plenty of them')] }
    const note = noTextNote(files)
    assert.match(note, /^2 attached file\(s\) carry no text we can read back \(Photo\.pdf, Scan\.png\)/)
    assert.match(note, /do not quote from them/)
    // And it reaches the message the model is sent.
    const m = lastUserMessage(files, 'THE CONTEXT', 'What does it say?')
    const t = typeof m.content === 'string' ? m.content
      : ((m.content as Array<{ text?: string }>).at(-1)?.text ?? '')
    assert.ok(t.includes(note))
    assert.ok(t.indexOf(note) < t.indexOf('THE CONTEXT'), 'before the context, with the other file lines')
  })

  /**
   * *** NOTHING IS SAID WHEN THERE IS NOTHING TO SAY, AND THAT IS WHAT KEEPS THE CALENDAR'S
   * BYTES WHERE THEY WERE. *** The step 2 and 4a proofs compare the whole user message byte for
   * byte; a sentence added unconditionally would move it for every section on every turn.
   */
  test('a section that attaches nothing sends exactly what it always sent', () => {
    assert.equal(noTextNote(NO_CARRIED_FILES), '')
    assert.deepEqual(attachedPassages(NO_CARRIED_FILES), [])
    assert.equal(lastUserMessage(NO_CARRIED_FILES, 'THE CONTEXT', 'When?').content,
      'THE CONTEXT\n\nQuestion: When?')
    const files: CarriedFiles = { ...NO_CARRIED_FILES,
      attached: { ...file('Readable.pdf', 'all of its words, read back', 'd4'), id: 'd4', name: 'Readable.pdf' } }
    assert.equal(noTextNote(files), '', 'a file we CAN read says nothing either')
  })

  test('the engine checks the answer against one list: the brief\'s plus the conversation\'s', () => {
    const engine = readFileSync('lib/ask/engine.ts', 'utf8')
    assert.match(engine, /const filePassages = attachedPassages\(files\)/)
    assert.match(engine, /const passages = \[\.\.\.packed\.passages, \.\.\.filePassages\]/)
    assert.match(engine, /ev\.searched,\n\s+passages, ev\.cited as CitedPassage\[\]\)/)
    assert.ok(!/finishAnswer\([^)]*packed\.passages/.test(engine),
      'the check must not be given the brief\'s list alone again')
    // And the record says what the file contributed, so a run can be read back afterwards.
    assert.match(engine, /attached_passages: filePassages\.length/)
    assert.match(engine, /attached_without_text: filePassages\.filter/)
  })
})

/* ── E2d — A DOCUMENT THE ANSWER USED IS A SOURCE ─────────────────────────── */

/**
 * *** THE MEASURED CASE, READ OFF STAGING. *** The Audits conversation "OSHA inspection
 * readiness…" is about ONE document — it names it, says its format is wrong and lists six gaps
 * read out of it — and it stored **no source at all**: it paraphrased everywhere and quoted
 * nowhere, so `checkQuote` had nothing to accept and the turn carried zero `[n]` markers in 2,704
 * characters. Every item of every summary of it then said "No source cited in the conversation".
 *
 * The real title and the answer's real sentence are used here, including the difference that
 * matters: the title joins with an en dash and the answer wrote "for".
 */
describe('an answer that NAMES a packed document records it — E2d', () => {
  const SDS = 'Material Safety Data Sheet (old MSDS format) – Sulfuric Acid, 93%, MSDS No. CSC-SA-093'
  const sds: Passage = {
    id: 'I3', title: `${SDS} — its line in your list`, label: 'your document',
    text: 'The sheet uses the old eight-section layout and is dated August 12, 2019.',
    href: '/documents?document=4b4a603b-c973-4c8c-a8f9-04f49f7721d8',
    shortName: SDS, fileName: 'SDS_Sulfuric_Acid_2019.pdf',
  }
  const permit: Passage = {
    id: 'I7', title: 'Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. 03-0217-ST-01 — its line in your list',
    label: 'your document', text: 'The permit.', href: '/documents?document=6c68a738-300a-41b4-9dd7-bd2024807797',
    shortName: 'Oregon DEQ Simple Air Contaminant Discharge Permit (ACDP) No. 03-0217-ST-01',
    fileName: 'Oregon_DEQ_Simple_ACDP_03-0217-ST-01.pdf',
  }

  test('⚡ the answer\'s own words, with a connector the model changed, still name it', () => {
    const answer = 'Only one document in your list is filed under OSHA: the Material Safety Data Sheet '
      + '(old MSDS format) for Sulfuric Acid, 93%, MSDS No. CSC-SA-093. It is dated August 12, 2019.'
    const hit = passagesNamed(answer, [sds, permit])
    assert.equal(hit.length, 1, 'the sheet is named, the permit is not')
    assert.equal(hit[0].id, 'I3')
  })

  test('the file name names it too, and so does a handle, which arrives as the name itself', () => {
    assert.equal(passagesNamed('We read SDS_Sulfuric_Acid_2019.pdf on 3 November.', [sds]).length, 1)
    // `replacePassageIds` has already put `shortName` in place of `I3` by the time this runs.
    assert.equal(passagesNamed(`We read ${SDS} on 3 November.`, [sds]).length, 1)
  })

  test('⚡ A PHRASE IS NOT A NAME, and that is the whole safety of it', () => {
    for (const said of [
      'You need a safety data sheet for every chemical you store.',
      'Your hazard communication programme is out of date.',
      'We hold a discharge permit.',
      'The sheet is from 2019.',
      '',
    ]) {
      assert.deepEqual(passagesNamed(said, [sds, permit]), [], said)
    }
    // Two documents whose names share an opening: only the one actually written is named.
    const other = { ...sds, id: 'I4', shortName: 'Material Safety Data Sheet (16-section) – Caustic Soda, 50%',
      href: '/documents?document=11111111-1111-1111-1111-111111111111', fileName: 'SDS_Caustic_2024.pdf' }
    const named = passagesNamed(`We read the ${other.shortName} this week.`, [sds, other])
    assert.equal(named.length, 1)
    assert.equal(named[0].id, 'I4')
  })

  test('a passage with nowhere to go is never a source, however it is named', () => {
    const nowhere: Passage = { id: 'F2', title: 'Hazard communication — the audit\'s own words',
      label: 'an audit finding', text: 'x', href: null, shortName: 'Hazard communication programme review 2026' }
    assert.deepEqual(passagesNamed('The Hazard communication programme review 2026 says so.', [nowhere]), [])
  })

  test('an audit finding is named the same way, with its own address', () => {
    const finding: Passage = { id: 'F1', title: 'Sulfuric acid sheet is the old format — the audit\'s own words',
      label: 'an audit finding', text: 'x', href: '/audits?run=ac3d6966-3d32-470c-b1dd-ce05f5b79405',
      shortName: 'Sulfuric acid sheet is the old format' }
    const hit = passagesNamed('The audit found that the Sulfuric acid sheet is the old format.', [finding])
    assert.equal(hit.length, 1)
    assert.equal(hit[0].href, '/audits?run=ac3d6966-3d32-470c-b1dd-ce05f5b79405')
  })

  test('the engine records it after the cited ones, never twice, with no quote', () => {
    const e = readFileSync('lib/ask/engine.ts', 'utf8')
    assert.match(e, /for \(const p of passagesNamed\(checked\.text, passages\)\)/)
    assert.match(e, /if \(checked\.sources\.some\(\(s\) => \(s as \{ href\?: string \| null \}\)\.href === href\)\) continue/)
    assert.match(e, /title: p\.title, label: p\.label, href, passage_id: p\.id, quote: ''/)
    // It runs on the CHECKED text, and `checkQuote` is named in the engine only in comments: this
    // adds a source, it never turns a refused quote into an accepted one.
    for (const line of e.split('\n').filter((l) => l.includes('checkQuote'))) {
      assert.match(line.trim(), /^(\*|\/\/|\/\*)/, `checkQuote is called at: ${line.trim()}`)
    }
  })

  test('a verified quote still takes precedence — one source, with the quote on it', () => {
    // The answer names the sheet AND quotes it: the quote's card is the source, with its words.
    const quoted = finishAnswer(`The ${SDS} says [I3: "The sheet uses the old eight-section layout"].`,
      [], [], [sds])
    assert.equal(quoted.sources.length, 1)
    assert.equal((quoted.sources[0] as { quote: string }).quote, 'The sheet uses the old eight-section layout')
    assert.equal((quoted.sources[0] as { href: string }).href, sds.href)
    // The name is in the text too, so the engine's loop sees the same passage — and skips it,
    // because that address is already a source. One card, with the quote on it, never two.
    assert.equal(passagesNamed(quoted.text, [sds])[0]?.href, sds.href)
  })

  test('a source with no quote says what it IS in the next turn\'s history, not "undefined"', () => {
    const line = appendSources('An answer.', [{ n: 1, kind: 'passage', title: 'The sheet', url: '',
      label: 'your document', passage_id: 'I3', quote: '', href: '/documents?document=x' }])
    assert.match(line, /\[1\] The sheet — your document/)
    assert.ok(!line.includes('undefined'))
    // A quote, when there is one, still reads as it always did.
    assert.match(appendSources('An answer.', [{ n: 1, kind: 'passage', title: 'The sheet', url: '',
      label: 'your document', passage_id: 'I3', quote: 'the words', href: null }]), /— “the words”/)
  })
})

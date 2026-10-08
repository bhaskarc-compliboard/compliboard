/**
 * THE HR ANSWER — `lib/hrAnswer.ts`, `lib/hrAnswerWords.ts`, HR Step 6a. Pure parts, and the loader with a
 * stand-in client. No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normaliseForQuote, verifyQuote } from '../../lib/documentScan.ts'
import {
  normalisedWithMap, checkQuote, checkPlainQuotes, finishAnswer, appendHandbookSources, loadHandbooksForAnswer, handbookContext,
  type Block, type HandbookUsed,
} from '../../lib/hrAnswer.ts'
import {
  HR_REFUSALS, longLine, DAY1_LINE, NOT_IN_HANDBOOK, HR_COMPOSER_HINT, quotesDroppedLine, linksDroppedLine, readingWords, splitAppended,
  hideHandbookMarkers, isAppendedLine,
} from '../../lib/hrAnswerWords.ts'
import { stageWords } from '../../components/stageWords.ts'
import { citedPassages } from '../../lib/ai.ts'
import { PAGE_BREAK } from '../../lib/handbookSections.ts'

const P1 = 'Harbor Kitchen policy. Employees accrue one hour of paid sick time for every thirty hours worked.'
const P2 = 'Managers must post the notice in the break room where every employee can see it before each shift.'
const pdfText = `${P1}${PAGE_BREAK}${P2}`
const hb: HandbookUsed = { id: 'h1', name: 'Harbor Policy', pages: 2, text: pdfText, isWord: false }
const blocks: Block[] = [
  { id: 'H1', handbookId: 'h1', handbookName: 'Harbor Policy', applies: 'Every site', sectionId: 's1', title: '1. Sick time', pageFrom: 1, pageTo: 1, stored: P1 },
  { id: 'H2', handbookId: 'h1', handbookName: 'Harbor Policy', applies: 'Every site', sectionId: 's2', title: '2. Postings', pageFrom: 2, pageTo: 2, stored: P2 },
]

describe('the shared quote rule', () => {
  test('normalisedWithMap keeps exactly what normaliseForQuote keeps, on PDF text and on Word HTML', () => {
    for (const raw of [pdfText, '<p>Sick &amp; safe <b>time</b>, 40 hours.</p><p>Next</p>', 'a < b and c > d', 'ÉCOLE École 3.1']) {
      assert.equal(normalisedWithMap(raw).norm, normaliseForQuote(raw), raw)
    }
  })
  test('verifyQuote is unchanged by the export: the same answers as before', () => {
    assert.equal(verifyQuote('one hour of paid sick time', P1), true)
    assert.equal(verifyQuote('two hours of paid sick time', P1), false)
    assert.equal(verifyQuote(null, P1), null)
    assert.equal(verifyQuote('short', P1), null)
  })
})

describe('checking a handbook quote', () => {
  test('found in the claimed section: its section and its page', () => {
    const hit = checkQuote('accrue one hour of paid sick time', 'H1', blocks, [hb])
    assert.equal(hit?.block?.id, 'H1'); assert.equal(hit?.page, 1)
  })
  test('claimed the wrong section: found in another block given, and attributed to it', () => {
    const hit = checkQuote('must post the notice in the break room', 'H1', blocks, [hb])
    assert.equal(hit?.block?.id, 'H2'); assert.equal(hit?.page, 2)
  })
  test('across a page break: found in the whole handbook, page counted from the stored breaks', () => {
    const hit = checkQuote('for every thirty hours worked. Managers must post', 'H1', blocks, [hb])
    assert.equal(hit?.block, null); assert.equal(hit?.page, 1)
  })
  test('fewer than 6 words, or words not in any handbook: refused', () => {
    assert.equal(checkQuote('paid sick time', 'H1', blocks, [hb]), null)
    assert.equal(checkQuote('employees accrue two hours of paid sick time', 'H1', blocks, [hb]), null)
  })
})

describe('at done: check, number, count', () => {
  const cited = [{ n: 1, title: 'BOLI', url: 'https://www.oregon.gov/boli/sick-time' }, { n: 2, title: 'Blog', url: 'https://example.com/post' },
    { n: 3, title: 'Not searched', url: 'https://nowhere.example/x' }]
  const searched = [{ url: 'https://oregon.gov/boli/sick-time/', title: 'BOLI' }, { url: 'https://example.com/post', title: 'Blog' }]
  test('web and handbook sources numbered together by first appearance; failures removed and counted', () => {
    const text = 'The handbook says [H1: "accrue one hour of paid sick time for every"]. The blog agrees.[2] The law says so.[1] '
      + 'A made-up line [H2: "employees get unlimited paid vacation every single year"]. Unsearched.[3] Again [H1: "accrue one hour of paid sick time for every"].'
    const r = finishAnswer(text, cited, searched, blocks, [hb])
    assert.equal(r.text, 'The handbook says “accrue one hour of paid sick time for every”[1]. The blog agrees.[2] The law says so.[3] A made-up line. Unsearched. Again “accrue one hour of paid sick time for every”[1].')
    assert.deepEqual(r.sources.map((s) => [s.n, s.kind, s.label]), [[1, 'handbook', 'your handbook'], [2, 'web', 'other'], [3, 'web', 'official']])
    assert.equal(r.sources[0].title, 'Harbor Policy — 1. Sick time, page 1')
    assert.equal((r.sources[0] as { quote: string }).quote, 'accrue one hour of paid sick time for every')
    assert.equal(r.droppedQuotes, 1); assert.equal(r.droppedLinks, 1)
  })
  test('a marker with no quote cannot be a source: removed and counted', () => {
    const r = finishAnswer('See the handbook [H2].', [], [], blocks, [hb])
    assert.equal(r.text, 'See the handbook.'); assert.equal(r.droppedQuotes, 1)
  })
})

describe('PLAIN QUOTES ARE CHECKED TOO (owner, 6a answers)', () => {
  test('found in a handbook: a numbered handbook source with a card, shown inline, exactly as a marked quote', () => {
    const r = finishAnswer('Your handbook says "Employees accrue one hour of paid sick time for every thirty hours worked."', [], [], blocks, [hb])
    assert.equal(r.text, 'Your handbook says “Employees accrue one hour of paid sick time for every thirty hours worked.”[1]')
    assert.equal(r.sources[0].kind, 'handbook'); assert.equal(r.sources[0].title, 'Harbor Policy — 1. Sick time, page 1')
    assert.equal(r.droppedQuotes, 0)
  })
  const law = [{ n: 1, title: 'ORS 653.606', url: 'https://oregon.gov/ors653' }]
  const lawSearched = [{ url: 'https://oregon.gov/ors653', title: 'ORS' }]
  const lawPassage = [{ url: 'https://oregon.gov/ors653', citedText: 'An employer shall provide paid sick time to every employee who works in this state.' }]
  test('A QUOTED LINE OF LAW IN ITS CITATION\'S PASSAGE SURVIVES, tied to that citation — wherever the citation sits', () => {
    for (const t of ['The statute says "an employer shall provide paid sick time to every employee".[1]',
                     'The statute says “an employer shall provide paid sick time to every employee”.[1]',
                     'Per ORS 653.606[1], "an employer shall provide paid sick time to every employee" in Oregon.']) {
      const r = finishAnswer(t, law, lawSearched, blocks, [hb], lawPassage)
      assert.match(r.text, /an employer shall provide paid sick time to every employee/, t)
      assert.equal(r.droppedQuotes + r.uncheckedQuotes, 0, t)
    }
    // with no citation straight after it, its citation is put there
    const r = finishAnswer('Per ORS 653.606[1], "an employer shall provide paid sick time to every employee" in Oregon.', law, lawSearched, blocks, [hb], lawPassage)
    assert.equal(r.text, 'Per ORS 653.606[1], "an employer shall provide paid sick time to every employee"[1] in Oregon.')
  })
  test('THE HANDBOOK-AND-LAW SENTENCE: a false handbook quote next to a real law citation is KEPT, MARKED, and gets no card (baseline)', () => {
    const t = 'Your handbook says "every employee receives unlimited paid vacation days each year", but the law says an employer shall provide paid sick time.[1]'
    const r = finishAnswer(t, law, lawSearched, blocks, [hb], lawPassage)
    assert.equal(r.text, `Your handbook says "every employee receives unlimited paid vacation days each year" ${NOT_IN_HANDBOOK}, but the law says an employer shall provide paid sick time.[1]`)
    assert.equal(r.uncheckedQuotes, 1); assert.equal(r.droppedQuotes, 0)
    assert.deepEqual(r.sources.map((x) => x.kind), ['web'])
  })
  test('a quote found nowhere, with no web passage to check it against, failed only the handbook check: the handbook line', () => {
    const r = finishAnswer('It says "every employee receives unlimited paid vacation days each year".', [], [], blocks, [hb], [])
    assert.equal(r.notFoundQuotes, 1); assert.equal(r.droppedQuotes, 0); assert.equal(r.uncheckedQuotes, 0)
  })
  test('NEITHER: CLAUDE\'S WORDS STAY EXACTLY AS WRITTEN, followed by the grey mark, with no card, and counted (baseline)', () => {
    const r = finishAnswer('The handbook also says "every employee receives unlimited paid vacation days each year". Next.', [], [], blocks, [hb])
    assert.equal(r.text, `The handbook also says "every employee receives unlimited paid vacation days each year" ${NOT_IN_HANDBOOK}. Next.`)
    assert.equal(r.notFoundQuotes, 1); assert.equal(r.droppedQuotes, 0); assert.equal(r.sources.length, 0)
    assert.equal(NOT_IN_HANDBOOK, '(not a quote from your handbook)', 'the owner\'s words, 8 October')
    // NO closing count line for marked quotes (owner, 8 October): neither the route nor the check writes one...
    for (const f of ['app/api/hr/answer/route.ts', 'lib/handbookCheck.ts']) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!/notFoundQuotes \?|uncheckedQuotes \?/.test(src), `${f} writes no marked-quote line`)
    }
    // ...and every line written before is still drawn grey where it is stored.
    for (const l of ['1 quote could not be checked against its source, so it is not shown.', '2 quotes could not be checked against their sources, so they are not shown.',
      '1 quote was not found in your handbook, so it is marked and has no card.', '3 quotes could not be checked against their sources, so they are marked and have no cards.']) assert.ok(isAppendedLine(l), l)
  })
  test('under six words is a phrase, not a quotation: left alone; a quote inside a [H…] marker is not checked twice', () => {
    assert.deepEqual(checkPlainQuotes('It says "paid sick time" here.', blocks, [hb]), { text: 'It says "paid sick time" here.', handbookFailed: 0, unchecked: 0 })
    const r = finishAnswer('It says [H2: "must post the notice in the break room"] and "every employee receives unlimited paid vacation days".', [], [], blocks, [hb])
    assert.equal(r.text, `It says “must post the notice in the break room”[1] and "every employee receives unlimited paid vacation days" ${NOT_IN_HANDBOOK}.`)
    assert.equal(r.notFoundQuotes, 1); assert.equal(r.droppedQuotes, 0)
  })
  test('a marked quote and a plain one count in the same line, and a plain true quote across a page break still gets its page', () => {
    const r = finishAnswer('[H1: "nothing like this is in the handbook at all"] and "for every thirty hours worked. Managers must post".', [], [], blocks, [hb])
    assert.equal(r.droppedQuotes, 1)
    assert.equal(r.sources[0].title, 'Harbor Policy — page 1')
  })
})

describe('each citation\'s passage (lib/ai.ts citedPassages), and the workspace untouched', () => {
  test('read from the API\'s web citations, deduplicated, in order; other blocks and citation kinds ignored', () => {
    const content = [
      { type: 'server_tool_use' },
      { type: 'text', text: 'A', citations: [{ type: 'web_search_result_location', url: 'u1', cited_text: 'one' }, { type: 'web_search_result_location', url: 'u1', cited_text: 'one' }] },
      { type: 'text', text: 'B', citations: [{ type: 'web_search_result_location', url: 'u2', cited_text: 'two' }, { type: 'char_location', cited_text: 'x' }] },
      { type: 'web_search_tool_result', content: [] },
    ]
    assert.deepEqual(citedPassages(content), [{ url: 'u1', citedText: 'one' }, { url: 'u2', citedText: 'two' }])
  })
  test('THE WORKSPACE\'S FINISHED MESSAGE carries exactly the fields it did before: the new field never reaches it', () => {
    const chat = readFileSync('app/api/chat/route.ts', 'utf8')
    const m = chat.match(/send\(\{ type: 'done', ([\s\S]*?)\}\);/)
    assert.ok(m, 'the research path\'s done message')
    const keys = m![1].split(',').map((k) => k.trim().split(':')[0].trim()).filter(Boolean)
    assert.deepEqual(keys, ['research', 'sources', 'topicId', 'stopReason', 'outputTokens'])
    assert.ok(!/ev\.cited/.test(chat), 'app/api/chat/route.ts never reads the cited passages')
    assert.match(chat, /saveAssistantTurn\(db, \{ topicId: convoTopicId, companyId,\s*text: ev\.answer\.text, sources: ev\.answer\.sources, position: answerPosition \}\)/)
  })
})

describe('the words', () => {
  test('the owner\'s lines: dropped quotes, dropped web sources, the over-budget line naming its handbook, the composer hint', () => {
    assert.equal(quotesDroppedLine(1), '1 quote could not be found in your handbook, so it is not shown as a source.')
    assert.equal(quotesDroppedLine(3), '3 quotes could not be found in your handbook, so they are not shown as sources.')
    assert.equal(linksDroppedLine(1), '1 web source could not be checked, so it is not shown.')
    assert.equal(linksDroppedLine(2), '2 web sources could not be checked, so they are not shown.')
    assert.equal(longLine('Cascade Handbook', ['4.1 Time off', '9. Other things'], false), 'Cascade Handbook is long, so this answer read the sections that matched your question: 4.1 Time off and 9. Other things.')
    assert.ok(isAppendedLine('Cascade Handbook is too long to read whole yet. Reading its right sections comes in the next step.'), '6a\'s old line still draws grey on a reopened answer')
    assert.equal(HR_COMPOSER_HINT, 'Ask about your handbook, or a situation at work…')
    for (const l of [quotesDroppedLine(1), quotesDroppedLine(2), linksDroppedLine(1), linksDroppedLine(4), longLine('Big', ['a'], true), DAY1_LINE]) assert.ok(isAppendedLine(l), l)
    assert.ok(!isAppendedLine('An ordinary paragraph of the answer.'))
  })
  test('the appended lines are split off the stored answer for drawing; the answer itself is untouched', () => {
    const { body, lines } = splitAppended(`Answer.\n\nMore.\n\n${quotesDroppedLine(1)}\n\n${DAY1_LINE}`)
    assert.equal(body, 'Answer.\n\nMore.'); assert.deepEqual(lines, [quotesDroppedLine(1), DAY1_LINE])
  })
  test('while streaming, handbook markers are hidden, a half-written one too', () => {
    assert.equal(hideHandbookMarkers('It says [H1: "accrue one hour"]. More'), 'It says. More')
    assert.equal(hideHandbookMarkers('It says [H1: "accrue one'), 'It says')
  })
  test('the stages: reading names each handbook and its pages; the workspace\'s steps read as before', () => {
    assert.equal(readingWords([{ name: 'A', pages: 2 }]), 'Reading A (2 pages)')
    assert.equal(readingWords([{ name: 'A', pages: 1 }, { name: 'B', pages: null }, { name: 'C', pages: 9 }]), 'Reading A (1 page), B and C (9 pages)')
    assert.equal(stageWords('hr_check', '', 1), 'Checking the rule at the agency — 1 source')
    assert.equal(stageWords('hr_check', '', 3), 'Checking the rule at the agency — 3 sources')
    assert.equal(stageWords('check', 'x'), 'Checking it against your question')
    assert.equal(stageWords('read', 'file.pdf'), 'Reading file.pdf')
  })
  test('history for a follow-up carries each handbook source with its quote', () => {
    const out = appendHandbookSources('Answer [1][2].', [
      { n: 1, kind: 'handbook', title: 'Harbor Policy — 1. Sick time, page 1', url: '', quote: 'accrue one hour of paid sick time' } as never,
      { n: 2, title: 'BOLI', url: 'https://oregon.gov/boli' }])
    assert.match(out, /\[1\] Harbor Policy — 1\. Sick time, page 1 \(your handbook\): "accrue one hour of paid sick time"/)
    assert.match(out, /\[2\] BOLI — https:\/\/oregon\.gov\/boli/)
  })
})

describe('the loader', () => {
  function fake(rows: Array<Record<string, unknown>>, sections: Record<string, Array<Record<string, unknown>>> = {}) {
    const q = (data: unknown) => { const c: Record<string, unknown> = {}; for (const m of ['select', 'eq', 'order', 'in', 'limit']) c[m] = () => c; c.then = (r: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(r); return c }
    return { from: (t: string) => {
      if (t === 'handbooks') return q(rows)
      if (t === 'entities') return q([{ id: 'p', name: 'Portland' }])
      return { select: () => ({ eq: (_c: string, id: string) => ({ order: () => Promise.resolve({ data: sections[id] ?? [], error: null }) }) }) }
    } }
  }
  const row = (id: string, o: Record<string, unknown>) => ({ id, name: id, scope: 'company', entity_id: null, status: 'read', status_reason: null, extracted_text: 'x', page_count: 1, created_at: id, ...o })
  test('the three refusals, before any model call', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = (rows: Array<Record<string, unknown>>) => loadHandbooksForAnswer(fake(rows) as any, 'co')
    assert.deepEqual(await run([]), { ok: false, refusal: HR_REFUSALS.none })
    assert.deepEqual(await run([row('a', { status: 'uploaded', extracted_text: null }), row('b', { status: 'could_not_read', status_reason: 'scan', extracted_text: null })]),
      { ok: false, refusal: HR_REFUSALS.reading })
    assert.deepEqual(await run([row('a', { status: 'could_not_read', status_reason: 'scan', extracted_text: null })]), { ok: false, refusal: HR_REFUSALS.unreadable })
  })
  test('TEXT FIRST: a handbook still being read, with its text saved, is given page by page', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await loadHandbooksForAnswer(fake([row('new', { status: 'reading', extracted_text: pdfText, page_count: 2 })]) as any, 'co')
    assert.ok(r.ok); if (!r.ok) return
    assert.deepEqual(r.blocks.map((b) => [b.id, b.title, b.pageFrom, b.sectionId]), [['H1', 'page 1', 1, null], ['H2', 'page 2', 2, null]])
  })
  test('read handbooks as their sections, scope labelled; one not used is named, and why', async () => {
    const rows = [row('a', { name: 'Main', scope: 'site', entity_id: 'p' }), row('b', { name: 'Old', status: 'could_not_read', status_reason: 'a scan', extracted_text: null })]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await loadHandbooksForAnswer(fake(rows, { a: [{ id: 's1', title: '1. Pay', page_from: 1, page_to: 1, text: 'Pay is weekly.' }] }) as any, 'co')
    assert.ok(r.ok); if (!r.ok) return
    assert.equal(r.blocks[0].applies, 'Portland')
    const ctx = handbookContext(r)
    assert.match(ctx, /<section id="H1" handbook="Main" applies="Portland" title="1\. Pay" pages="1">\nPay is weekly\.\n<\/section>/)
    assert.match(ctx, /Not included, so not read for this answer: "Old" \(could not be read: a scan\)\./)
  })
  test('THE BUDGET (6c): one that fits goes whole; one that does not is LONG if read, WAITING if its sections are not found', async () => {
    const rows = [row('big', { name: 'Big', status: 'reading', extracted_text: 'y'.repeat(4000), page_count: 9 }),
      row('bigread', { name: 'BigRead', status: 'read', extracted_text: 'w'.repeat(4000), page_count: 9 }),
      row('small', { name: 'Small', status: 'reading', extracted_text: 'z'.repeat(100), page_count: null })]
    const secs = { bigread: [{ id: 's1', title: '1. One', page_from: 1, page_to: 1, text: 'w'.repeat(2000) }, { id: 's2', title: '2. Two', page_from: 2, page_to: 9, text: 'w'.repeat(2000) }] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await loadHandbooksForAnswer(fake(rows, secs) as any, 'co', 500)
    assert.ok(r.ok); if (!r.ok) return
    assert.deepEqual(r.used.map((u) => u.name), ['Small'])
    assert.deepEqual(r.long.map((h) => [h.name, h.sections.length]), [['BigRead', 2]])
    assert.deepEqual(r.waiting.map((h) => h.name), ['Big'])
    assert.equal(r.budget, 500); assert.ok(r.spent > 0 && r.spent < 500)
  })
})

describe('the route and the shared changes', () => {
  const route = readFileSync('app/api/hr/answer/route.ts', 'utf8')
  test('behind the preview switch, before the session; topics saved as HR; tier and ledger "hr"', () => {
    assert.ok(route.indexOf('hrPreviewOn()') < route.indexOf('requireCompany(request)'))
    assert.match(route, /insert\(\{ company_id: companyId, title: titleFromQuestion\(question\), section: 'hr' \}\)/)
    assert.match(route, /task: 'hr', maxTokens: 16000, signal: request\.signal, ledger: \{ companyId, task: 'hr' \}/)
    assert.match(route, /if \(!first\.ok\) return NextResponse\.json\(\{ outcome: 'refused', message: first\.refusal \}\)/)
    assert.ok(route.indexOf("outcome: 'refused'") < route.indexOf('askAIOpenStream('), 'a refusal returns before any model call')
  })
  test('the two test paths (a bad marked quote; plain quotes) can never run on production', () => {
    assert.match(route, /process\.env\.NODE_ENV !== 'production' && process\.env\.HR_TEST_BAD_QUOTE === '1'/)
    assert.match(route, /process\.env\.NODE_ENV !== 'production' && process\.env\.HR_TEST_PLAIN_QUOTES === '1'/)
  })
  test('the nightly summary: workspace and HR topics always (since the go-live), in both queries; HR\'s writer for HR (step 10)', () => {
    const job = readFileSync('app/api/jobs/summarise/route.ts', 'utf8')
    assert.match(job, /const sections = \['workspace', 'hr'\]/)
    assert.ok(!/hrPreview/.test(job))
    assert.equal((job.match(/\.from\('topics'\)\.select\(cols\)\.in\('section', sections\)/g) ?? []).length, 2)
    // A workspace conversation's call passes no kind, exactly as before step 10; an HR one passes kind 'hr'.
    assert.match(job, /\.\.\.\(topic\.section === 'hr' \? \{ kind: 'hr' as const \} : \{\}\)/)
  })
})

/**
 * A LONG HANDBOOK — HR Step 6c: the table of contents, the safety net, choosing within the budget, the lines,
 * the honest wait's words, and the route's shape. No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tableOfContents, safetyNet, chooseSections, distinctiveWords, firstWords, type LongHandbook } from '../../lib/hrAnswer.ts'
import { longLine, longNetOnlyLine, longNothingLine, waitingWords, waitFailedWords, waitTooLongWords, WAIT_LIMIT_MS, isAppendedLine } from '../../lib/hrAnswerWords.ts'
import { READ_REASONS } from '../../lib/handbooks.ts'
import { HR_SELECT_PROMPT, hrSelectMessage } from '../../prompts/hr-select.ts'

const sec = (id: string, title: string, text: string, p: number) => ({ id, title, page_from: p, page_to: p, text })
const big: LongHandbook = {
  id: 'h', name: 'Cascade Handbook', pages: 60, text: '', isWord: false, applies: 'Every site', versionOf: null, addedAt: 'x',
  sections: [
    sec('a', '1. Welcome', 'Welcome to Cascade. '.repeat(40), 1),
    sec('b', '4. Time off', 'Vacation accrues monthly. '.repeat(40), 10),
    sec('c', '9. Other things to know', 'Parking is free. Employees receive three days of paid bereavement leave for an immediate family member. '.repeat(5), 50),
    sec('d', '10. Leaving', 'Give two weeks notice. '.repeat(40), 55),
  ],
}

describe('the table of contents the selection call is given', () => {
  test('each section: an S-id, its title, its pages and about its first 30 words', () => {
    const { text, ids } = tableOfContents([big])
    assert.equal(ids.size, 4)
    assert.match(text, /^Handbook "Cascade Handbook" \(60 pages, applies to Every site\):\nS1 \| 1\. Welcome \(page 1\) \| Welcome to Cascade\./)
    assert.match(text, /S3 \| 9\. Other things to know \(page 50\) \| Parking is free\./)
    assert.equal(firstWords('one two three', 2), 'one two …')
  })
  test('the prompt is short and open, and the message carries the earlier questions for a follow-up', () => {
    assert.ok(HR_SELECT_PROMPT.length < 900)
    assert.match(hrSelectMessage('And for a parent?', ['How much bereavement leave do we give?'], 'S1 | x'),
      /^Earlier questions in this conversation:\n- How much bereavement leave do we give\?\n\nQuestion: And for a parent\?/)
  })
})

describe('THE SAFETY NET, and THE HARD CASE: a rule under a heading that does not mention it', () => {
  test('the question\'s distinctive words: common words out, plurals folded', () => {
    assert.deepEqual(distinctiveWords('How many days of bereavement leave does our handbook give employees?'), ['bereavement', 'leave'])
  })
  test('a word found in most sections (the company\'s name) picks nothing; the net adds at most 6', () => {
    const many: LongHandbook = { ...big, sections: Array.from({ length: 20 }, (_, i) => sec(`x${i}`, `${i + 1}. Part`, `Cascade rule ${i} on leave and pay.`, i + 1)) }
    const { ids } = tableOfContents([many])
    assert.deepEqual(safetyNet('What does the Cascade handbook say?', [many], ids), [], '"cascade" is in every section')
    assert.ok(safetyNet('What about leave and pay rule 3?', [many], ids).length <= 6)
  })
  test('"9. Other things to know" is found by its words, though its title says nothing', () => {
    const { ids } = tableOfContents([big])
    assert.deepEqual(safetyNet('How many days of bereavement leave do we give?', [big], ids), ['S3'])
  })
})

describe('choosing what is sent', () => {
  const { ids } = tableOfContents([big])
  test('the model\'s valid picks first, the net\'s after; an id that does not exist is ignored; the handbook\'s own order', () => {
    const [s] = chooseSections([big], ids, ['S4', 'S99', 'S2'], ['S3'], 100_000)
    assert.deepEqual(s.chosen.map((c) => [c.title, c.by]), [['4. Time off', 'model'], ['9. Other things to know', 'net'], ['10. Leaving', 'model']])
    assert.equal(s.callOk, true)
  })
  test('THE BUDGET: what does not fit is left out and named, model picks first', () => {
    const [s] = chooseSections([big], ids, ['S2'], ['S3'], 300)
    assert.deepEqual(s.chosen.map((c) => c.title), ['4. Time off'])
    assert.deepEqual(s.leftForBudget, ['9. Other things to know'])
  })
  test('the call failed (null): the net alone chooses, and the record says the call did not work', () => {
    const [s] = chooseSections([big], ids, null, ['S3'], 100_000)
    assert.equal(s.callOk, false); assert.deepEqual(s.chosen.map((c) => c.by), ['net'])
  })
})

describe('the words', () => {
  test('the owner\'s line, naming the handbook when there is more than one; "This handbook" when it is the only one', () => {
    assert.equal(longLine('Cascade Handbook', ['4. Time off'], false), 'Cascade Handbook is long, so this answer read the sections that matched your question: 4. Time off.')
    assert.equal(longLine('Cascade Handbook', ['a', 'b', 'c'], true), 'This handbook is long, so this answer read the sections that matched your question: a, b and c.')
    for (const l of [longLine('X', ['a'], false), longNetOnlyLine('X', ['a'], true), longNothingLine(['X']), longNothingLine(['A', 'B'])]) assert.ok(isAppendedLine(l), l)
  })
  test('ONE line for every long handbook that matched nothing (owner, 6c)', () => {
    assert.equal(longNothingLine(['Cascade']), 'Cascade is long, and none of its sections could be matched to your question, so this answer did not read it.')
    assert.equal(longNothingLine(['Cascade', 'Northside']), 'Cascade and Northside are long, and none of their sections matched your question, so this answer did not read them.')
    assert.match(readFileSync('app/api/hr/answer/route.ts', 'utf8'), /\.\.\.\(nothing\.length \? \[longNothingLine\(nothing\)\] : \[\]\)/)
  })
  test('the honest wait: the owner\'s words, with the count once the reader has made one', () => {
    assert.equal(waitingWords(120, 2, 6), "Your handbook is 120 pages long. We're finding its sections so we can read the right ones — 2 of 6 parts done. Your answer starts as soon as that's finished.")
    assert.equal(waitingWords(120, null, null), "Your handbook is 120 pages long. We're finding its sections so we can read the right ones. Your answer starts as soon as that's finished.")
    assert.equal(waitFailedWords(READ_REASONS.ours), "We couldn't read your handbook: Something went wrong at our end while reading it. Press Read it again. Your question was not answered yet.")
    assert.equal(WAIT_LIMIT_MS, 180_000)
    assert.equal(waitTooLongWords, 'Your handbook is taking longer to read than usual. Your question was not answered yet. Ask it again in a few minutes; the reading carries on.')
  })
})

describe('the route', () => {
  const route = readFileSync('app/api/hr/answer/route.ts', 'utf8')
  test('the wait comes before the reading stage and the selection; the selection is one call on tier and ledger "hr"', () => {
    assert.ok(route.indexOf('THE HONEST WAIT') < route.indexOf("send({ type: 'reading'"))
    assert.ok(route.indexOf("send({ type: 'reading'") < route.indexOf('askAIJson<{ sections?: unknown }>(HR_SELECT_PROMPT'))
    assert.match(route, /\{ task: 'hr', maxTokens: 2000, ledger: \{ companyId, task: 'hr' \} \}/)
    assert.match(route, /if \(failed\) \{ notAnswered\(waitFailedWords\(failed\.status_reason \?\? READ_REASONS\.ours\)\); return \}/)
    assert.match(route, /if \(Date\.now\(\) - waitStart > WAIT_LIMIT_MS\) \{ notAnswered\(waitTooLongWords\); return \}/)
  })
  test('the 6a over-budget line is written nowhere any more', () => {
    for (const f of ['app/api/hr/answer/route.ts', 'lib/hrAnswer.ts', 'app/hr/new/HrWorkspace.tsx']) {
      assert.ok(!readFileSync(f, 'utf8').includes('overBudgetLine'), f)
    }
  })
  test('the reading-failure test path can never run on production', () => {
    assert.match(readFileSync('lib/handbookRead.ts', 'utf8'), /process\.env\.NODE_ENV !== 'production' && process\.env\.HR_TEST_OUTLINE_FAIL === '1' && part\.index === 2/)
  })
})

describe('suggested wording and internal ids (owner, 6c answers)', async () => {
  const { finishAnswer, replaceBlockIds } = await import('../../lib/hrAnswer.ts')
  const { splitSuggested, QUOTE_REMOVED } = await import('../../lib/hrAnswerWords.ts')
  const P = 'Employees accrue one hour of paid sick time for every thirty hours worked.'
  const blocks = [
    { id: 'H1', handbookId: 'h', handbookName: 'Harbor', applies: 'Every site', sectionId: 's', title: '3. Sick time', pageFrom: 1, pageTo: 1, stored: P },
    { id: 'H2', handbookId: 'h', handbookName: 'Harbor', applies: 'Every site', sectionId: null, title: 'page 14', pageFrom: 14, pageTo: 14, stored: 'Other text here.' },
  ]
  const used = [{ id: 'h', name: 'Harbor', pages: 14, text: P, isWord: false }]
  test('A SUGGESTED-WORDING PARAGRAPH SURVIVES; a false handbook quote elsewhere in the same answer is still removed', () => {
    const text = 'Your handbook says "every employee receives unlimited paid vacation days each year".\n\n'
      + 'Suggested wording: "Employees accrue one hour of paid sick time for every thirty hours worked, from their first day of work."'
    const r = finishAnswer(text, [], [], blocks, used, [])
    assert.equal(r.text, `Your handbook says ${QUOTE_REMOVED}.\n\nSuggested wording: "Employees accrue one hour of paid sick time for every thirty hours worked, from their first day of work."`)
    assert.equal(r.droppedQuotes, 1); assert.equal(r.sources.length, 0, 'the draft never gets a card')
  })
  test('THE LABEL ON ITS OWN, THE WORDING AFTER IT (staging 6c): every paragraph to the next heading is draft, unchecked', () => {
    const text = 'Gap.\n\n---\n\nSuggested wording:\n\n**3. Leave**\n\nStaff get "every employee receives unlimited paid vacation days each year" now.\n\n## Next\n\nIt says "every employee receives unlimited paid vacation days each year".'
    const r = finishAnswer(text, [], [], blocks, used, [])
    assert.ok(r.text.includes('Staff get "every employee receives unlimited paid vacation days each year" now.'), 'inside the draft: kept')
    assert.ok(r.text.endsWith(`It says ${QUOTE_REMOVED}.`), 'after the heading: the strict rule again')
    assert.deepEqual(splitSuggested('Gap.\n\nSuggested wording:\n\n**3. Leave**\n\nStaff get two weeks.\n\n## Next\n\nMore.').map((x) => [x.draft, x.text]),
      [[false, 'Gap.'], [true, '**3. Leave**\n\nStaff get two weeks.'], [false, '## Next\n\nMore.']])
  })
  test('the page draws it as a draft: split out, its label taken off, in order', () => {
    // The draft runs to the next heading or rule: a paragraph after it with neither is still the draft (the trade-off).
    assert.deepEqual(splitSuggested('Intro.\n\n**Suggested wording:** "New rule text here."\n\nAfter.'),
      [{ draft: false, text: 'Intro.' }, { draft: true, text: '"New rule text here."\n\nAfter.' }])
    assert.deepEqual(splitSuggested('Intro.\n\n**Suggested wording:** "New rule text here."\n\n## Then\n\nAfter.'),
      [{ draft: false, text: 'Intro.' }, { draft: true, text: '"New rule text here."' }, { draft: false, text: '## Then\n\nAfter.' }])
  })
  test('A MARKER WITH WORDS AFTER ITS QUOTE (staging 6c) is recognised: the quote checked, the words dropped, no "[H" left', () => {
    const r = finishAnswer('It says:\n\n[H1: "Employees accrue one hour of paid sick time" ... (repeated 92 times across pages 34-36)]\n\nNext.', [], [], blocks, used, [])
    assert.equal(r.text, 'It says:\n\n“Employees accrue one hour of paid sick time”[1]\n\nNext.')
    assert.ok(!r.text.includes('[H'))
  })
  test('INTERNAL IDS NEVER REACH THE PERSON: "H1" becomes its title; a page block reads "page 14"; an unknown id is left', () => {
    assert.equal(replaceBlockIds('Looking at section H1, and at H2, but not H9.', blocks), 'Looking at section 3. Sick time, and at page 14, but not H9.')
    assert.equal(replaceBlockIds('See section H2.', blocks), 'See page 14.')
  })
  test('the prompt carries the owner\'s one sentence', async () => {
    const { HR_ANSWER_PROMPT } = await import('../../prompts/hr-answer.ts')
    assert.match(HR_ANSWER_PROMPT, /When you propose new wording, put it in a paragraph of its own that begins "Suggested wording:"\./)
  })
})

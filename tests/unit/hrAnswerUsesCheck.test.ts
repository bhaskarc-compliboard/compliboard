/**
 * HR STEP 9 — ANSWERS USE THE STORED CHECK, AS A SWITCH, OFF BY DEFAULT (HR_ANSWER_USES_CHECK). No model call.
 * OFF: the answer is byte for byte today's. ON: one block per handbook, within the budget, links stored with the check
 * count as checked, and the closing line.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { answerUsesCheck, checkBlock, fitChecks, checkSearched, usesCheckLine, TOKENS_PER_CHAR, type StoredCheck } from '../../lib/hrAnswer.ts'
import { hrAnswerMessage } from '../../prompts/hr-answer.ts'
import { isAppendedLine, DAY1_LINE, notCheckedLine } from '../../lib/hrAnswerWords.ts'

const withEnv = (v: string | undefined, f: () => void) => {
  const old = process.env.HR_ANSWER_USES_CHECK
  if (v === undefined) delete process.env.HR_ANSWER_USES_CHECK; else process.env.HR_ANSWER_USES_CHECK = v
  try { f() } finally { if (old === undefined) delete process.env.HR_ANSWER_USES_CHECK; else process.env.HR_ANSWER_USES_CHECK = old }
}
const check = (name: string, date: string, text: string): StoredCheck => ({
  handbookId: `id-${name}`, handbookName: name, checkId: `c-${name}`, finishedAt: date,
  parts: [{ text, sources: [{ n: 1, kind: 'web', title: 'BOLI rest breaks', url: 'https://www.oregon.gov/boli/rest', label: 'official' },
    { n: 2, kind: 'handbook', title: 'Riverside — 2.2 Breaks', url: '' }] }],
})

describe('THE SWITCH, read as the workspace reads its own: on only for the exact word "true"', () => {
  test('unset, empty, "1", "yes", "ture" are OFF; "true" in any case, trimmed, is ON', () => {
    for (const v of [undefined, '', '1', 'yes', 'on', 'ture', 'false']) withEnv(v, () => assert.equal(answerUsesCheck(), false, String(v)))
    for (const v of ['true', 'TRUE', ' True ']) withEnv(v, () => assert.equal(answerUsesCheck(), true, v))
  })
})

describe('OFF: BYTE FOR BYTE TODAY\'S ANSWER', () => {
  test('the message: no checks argument, or an empty one, is exactly the message before step 9', () => {
    const today = 'About the company:\nCO\n\nThe company\'s handbooks (current versions):\nHB\n\nQuestion: Q'
    assert.equal(hrAnswerMessage('CO', 'HB', 'Q'), today)
    assert.equal(hrAnswerMessage('CO', 'HB', 'Q', undefined), today)
    assert.equal(hrAnswerMessage('CO', 'HB', 'Q', ''), today)
  })
  test('the route enters nothing when off: no check is read, the search list, the lines and the record are today\'s', () => {
    const route = readFileSync('app/api/hr/answer/route.ts', 'utf8')
    assert.match(route, /const fitted = useCheck \? fitChecks\(await storedChecks\(db, lv\.used\), sentHandbooks\.length\) : null/)
    assert.match(route, /hrAnswerMessage\(companyBlock, sentHandbooks, question, fitted\?\.blocks \|\| undefined\)/)
    assert.match(route, /fromCheck\.length \? \[\.\.\.ev\.searched, \.\.\.fromCheck\] : ev\.searched/)
    assert.match(route, /: \[\(await noCheckYet\(db, usedIds\)\) \? DAY1_LINE : ''\]\),/)
    assert.match(route, /\.\.\.\(fitted \? \{\s*checks_used:/)
  })
})

describe('ON: one block per handbook, nothing invented', () => {
  test('the block: "The last check of <handbook>, on <date>:", the stored answer, its numbered sources with label', () => {
    assert.equal(checkBlock(check('Riverside', '2026-10-08T05:00:00Z', 'Your rest breaks meet Oregon law.[1]')),
      'The last check of Riverside, on 8 October 2026:\n\nYour rest breaks meet Oregon law.[1]\n\nSources:\n'
      + '[1] BOLI rest breaks — https://www.oregon.gov/boli/rest (official)\n[2] Riverside — 2.2 Breaks (your handbook)')
  })
  test('THE BUDGET: what is already sent plus the block must fit; a block that does not is left out', () => {
    const a = check('A', '2026-10-08T05:00:00Z', 'x'.repeat(1000)), b = check('B', '2026-10-07T05:00:00Z', 'y'.repeat(1000))
    const one = Math.ceil(checkBlock(a).length * TOKENS_PER_CHAR)
    const r = fitChecks([a, b], 0, one + 10)
    assert.deepEqual(r.used.map((c) => c.handbookName), ['A']); assert.deepEqual(r.leftOut.map((c) => c.handbookName), ['B'])
    assert.ok(r.blocks.startsWith('The last check of A, on 8 October 2026:'))
    assert.deepEqual(fitChecks([a], 1_000_000, 100).used, [], 'a handbook context already over the budget leaves no room')
  })
  test('a link stored with the check counts as checked, with the label it was stored with; a handbook card is not a link', () => {
    assert.deepEqual(checkSearched([check('R', '2026-10-08T05:00:00Z', 't')]), [{ url: 'https://www.oregon.gov/boli/rest', title: 'BOLI rest breaks', label: 'official' }])
  })
  test('the closing line (the owner\'s words); several handbooks, each with its date; drawn grey like the others', () => {
    const one = usesCheckLine([check('Riverside', '2026-10-08T05:00:00Z', 't')])
    assert.equal(one, 'This answer uses your handbook check of 8 October 2026.')
    const two = usesCheckLine([check('Riverside', '2026-10-08T05:00:00Z', 't'), check('Harbor', '2026-10-07T05:00:00Z', 't')])
    assert.equal(two, 'This answer uses your handbook checks: Riverside, 8 October 2026; Harbor, 7 October 2026.')
    assert.ok(isAppendedLine(one) && isAppendedLine(two) && isAppendedLine(DAY1_LINE))
  })
})

describe('the day-1 line (owner, 8 October): named when the switch is on, unchanged when it is off', () => {
  test('ON: a handbook with no finished check is named; two or more, joined', () => {
    assert.equal(notCheckedLine(['Cascade']), 'Cascade has not been checked yet. This answer reads it and the rule just now.')
    assert.equal(notCheckedLine(['Cascade', 'Harbor']), 'Cascade and Harbor have not been checked yet. This answer reads them and the rule just now.')
    assert.equal(notCheckedLine(['A', 'B', 'C']), 'A, B and C have not been checked yet. This answer reads them and the rule just now.')
    for (const l of [notCheckedLine(['Cascade']), notCheckedLine(['A', 'B'])]) assert.ok(isAppendedLine(l), l)
    const route = readFileSync('app/api/hr/answer/route.ts', 'utf8')
    // Only handbooks with NO finished check are named — not one whose check was left out for the budget — each name once.
    assert.match(route, /notCheckedLine\(names\)[\s\S]*\[\.\.\.new Set\(lv\.used\s*\.filter\(\(u\) => !\[\.\.\.fitted\.used, \.\.\.fitted\.leftOut\]\.some\(\(c\) => c\.handbookId === u\.id\)\)\.map\(\(u\) => u\.name\)\)\]/)
  })
  test('OFF: today\'s day-1 line, unnamed and unchanged', () => {
    assert.equal(DAY1_LINE, "Your handbook's full check has not run yet. This answer reads the handbook and the rule just now.")
    assert.match(readFileSync('app/api/hr/answer/route.ts', 'utf8'), /: \[\(await noCheckYet\(db, usedIds\)\) \? DAY1_LINE : ''\]\),/)
  })
})

describe('the closing line names each handbook once (owner, after the Opus run)', () => {
  test('two handbooks sharing a name are named once; a single name left is the one-check line', () => {
    const h1 = check('Harbor', '2026-10-08T05:00:00Z', 't'), h2 = { ...check('Harbor', '2026-10-08T06:00:00Z', 't'), handbookId: 'other' }
    const w = check('Washington-Addendum', '2026-10-08T05:00:00Z', 't')
    assert.equal(usesCheckLine([h1, w, h2]), 'This answer uses your handbook checks: Harbor, 8 October 2026; Washington-Addendum, 8 October 2026.')
    assert.equal(usesCheckLine([h1, h2]), 'This answer uses your handbook check of 8 October 2026.')
  })
})

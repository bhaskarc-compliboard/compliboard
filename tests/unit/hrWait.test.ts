/**
 * §183 — AN ANSWER NEVER GOES AHEAD WITHOUT A HANDBOOK STILL BEING READ (the owner, 8 October), and HR's closing offer.
 * No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { textWaitStep } from '../../lib/hrAnswer.ts'
import { readingFirstWords, notReadLine, isAppendedLine, waitFailedWords, waitTooLongWords, WAIT_LIMIT_MS } from '../../lib/hrAnswerWords.ts'
import { HR_GIVEN_SENTENCE, HR_OFFER_SENTENCE } from '../../prompts/hr-answer.ts'

const route = readFileSync('app/api/hr/answer/route.ts', 'utf8')
const row = (id: string, status: string, reason: string | null = null) => ({ id, name: `${id}-Handbook`, status, status_reason: reason })

describe('the owner\'s words', () => {
  test('the stage line, one handbook and several', () => {
    assert.equal(readingFirstWords(['Harbor']), "Reading Harbor first. Your answer starts as soon as it's read.")
    assert.equal(readingFirstWords(['Harbor', 'Cascade']), "Reading your handbooks first. Your answer starts as soon as they're read.")
  })
  test('the grey closing line for a handbook whose reading failed, with others to answer from', () => {
    assert.equal(notReadLine('Harbor'), 'Harbor could not be read, so this answer does not use it. The Handbooks tab shows why.')
    assert.ok(isAppendedLine(notReadLine('Harbor')), 'drawn grey like the other closing lines')
  })
  test('6c\'s words are reused, unchanged', () => {
    assert.equal(waitFailedWords('It is a scan.'), "We couldn't read your handbook: It is a scan. Your question was not answered yet.")
    assert.match(waitTooLongWords, /^Your handbook is taking longer to read than usual\./)
  })
})

describe('one step of the wait, with a stand-in clock', () => {
  const t0 = 1_000_000
  test('text not saved: wait, with the stage words; text saved: reload and carry on', () => {
    const w = textWaitStep([row('a', 'reading')], new Set(), t0, t0 + 2_000, 'ours')
    assert.equal(w.next, 'wait'); assert.ok('words' in w && w.words === "Reading a-Handbook first. Your answer starts as soon as it's read.")
    assert.equal(textWaitStep([row('a', 'reading')], new Set(['a']), t0, t0 + 4_000, 'ours').next, 'reload')
    assert.equal(textWaitStep([row('a', 'uploaded'), row('b', 'reading')], new Set(['a']), t0, t0, 'ours').next, 'wait')
  })
  test('THE 3-MINUTE LIMIT: at the limit still waiting; one millisecond past it, too long', () => {
    assert.equal(WAIT_LIMIT_MS, 180_000)
    assert.equal(textWaitStep([row('a', 'reading')], new Set(), t0, t0 + WAIT_LIMIT_MS, 'ours').next, 'wait')
    assert.equal(textWaitStep([row('a', 'reading')], new Set(), t0, t0 + WAIT_LIMIT_MS + 1, 'ours').next, 'too_long')
  })
  test('a reading that fails is named with its reason (or ours), and no longer waited for', () => {
    const s = textWaitStep([row('a', 'could_not_read', 'It is a scan.'), row('b', 'could_not_read')], new Set(), t0, t0, 'ours')
    assert.deepEqual(s.failed, [{ id: 'a', name: 'a-Handbook', reason: 'It is a scan.' }, { id: 'b', name: 'b-Handbook', reason: 'ours' }])
    assert.equal(s.next, 'reload')
  })
})

describe('the route', () => {
  test('waits for unread handbooks AND 6c\'s long ones, in one loop, inside the request, every 2 seconds', () => {
    assert.match(route, /while \(loaded\.ok && \(\(loaded\.unread\?\.length \?\? 0\) > 0 \|\| loaded\.waiting\.length\)\)/)
    assert.match(route, /if \(request\.signal\.aborted\) throw Object\.assign\(new Error\('aborted'\), \{ name: 'AbortError' \}\)/)
    assert.equal((route.match(/await new Promise\(\(r\) => setTimeout\(r, 2000\)\)/g) ?? []).length, 2)
  })
  test('a handbook with no reading running gets one, through startReading\'s claim, once', () => {
    assert.match(route, /import \{ startReadingNow \} from '@\/lib\/handbookStart'/)
    assert.match(route, /if \(readingStarted\.has\(u\.id\)\) continue\s+readingStarted\.add\(u\.id\)\s+try \{ if \(await startReadingNow\(db, companyId, u\.id\)\)/)
  })
  test('the reading starts NOW, not after the response: after() only keeps it running (the staging finding)', () => {
    const start = readFileSync('lib/handbookStart.ts', 'utf8')
    const now = start.slice(start.indexOf('export async function startReadingNow'))
    assert.match(now, /const claimedAt = await claimReading\(db, id\)/, 'the same claim')
    assert.ok(now.indexOf('const running = readHandbook(') < now.indexOf('after(() => running)'), 'started before after(), which only keeps it alive')
  })
  test('the only handbook failed: 6c\'s words; others exist: the answer goes ahead with the grey line', () => {
    assert.match(route, /if \(!loaded\.ok\) \{ notAnswered\(notRead\.length \? waitFailedWords\(notRead\[0\]\.reason\) : loaded\.refusal\); return \}/)
    assert.match(route, /\.\.\.notRead\.map\(\(f\) => notReadLine\(f\.name\)\),/)
  })
  test('the seconds waited reach the check record; the handbook check is untouched', () => {
    assert.match(route, /const waitedSeconds = Math\.round\(\(Date\.now\(\) - waitStart\) \/ 1000\)/)
    assert.match(route, /searched: ev\.searched, citedPassages: ev\.cited\.length, done, waitedSeconds/)
    assert.ok(!readFileSync('lib/handbookCheck.ts', 'utf8').includes('textWaitStep'))
  })
})

describe('the closing offer (§183, the owner): in HR\'s prompt only', () => {
  test('the sentence, after HR\'s given sentence; the workspace\'s prompt file untouched by it', () => {
    assert.equal(HR_OFFER_SENTENCE, 'Stay with the handbooks and the employment rules they touch. If you end with an offer, offer only what you can do here: explain a rule, compare a handbook section with it, or write suggested wording for the handbook.')
    assert.match(readFileSync('prompts/hr-answer.ts', 'utf8'), /\$\{HR_GIVEN_SENTENCE\}\\n\\n\$\{HR_OFFER_SENTENCE\}/)
    assert.ok(!readFileSync('prompts/checklist.ts', 'utf8').includes('Stay with the handbooks'))
    assert.ok(HR_GIVEN_SENTENCE.length > 0)
  })
})

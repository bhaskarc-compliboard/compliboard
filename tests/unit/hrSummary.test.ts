/**
 * HR'S SUMMARY — HR Step 7: the shared writer's additive options (off by default), `lib/hrSummary.ts`, the
 * words, and the route's shape. No model call.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gatherSources, numberedTranscript, checkReport, renderPlainText, type TurnLike } from '../../lib/summaryReport.ts'
import { HR_SOURCES, hrTurns, hrKeyWithoutUrl } from '../../lib/hrSummary.ts'
import { HR_AS_OF_LINE, AS_OF_LINE, thingsToChange, whatToChangeHeading } from '../../lib/summaryWords.ts'
import { DAY1_LINE } from '../../lib/hrAnswerWords.ts'

const hb = (n: number, quote: string, title = 'Harbor — 3. Sick time, page 1') =>
  ({ n, kind: 'handbook', title, url: '', label: 'your handbook', handbook_id: 'h1', handbook_name: 'Harbor', quote })
const web = (n: number, url: string, title = 'BOLI') => ({ n, kind: 'web', title, url, label: 'official' })
const turns: TurnLike[] = [
  { role: 'user', text: 'We have 42 employees in Oregon. Is our sick time right?' },
  { role: 'assistant', text: 'Your handbook says “Employees accrue one hour for every 40 hours”[1]. Oregon needs one hour for every 30 hours.[2]\n\nFix the accrual rate.\n\n' + DAY1_LINE,
    sources: [hb(1, 'Employees accrue one hour for every 40 hours'), web(2, 'https://oregon.gov/boli/sick')] as never },
  { role: 'user', text: 'And part-time staff?' },
  { role: 'assistant', text: 'It also says “Employees accrue one hour for every 40 hours”[2] and part-time staff are covered too.[1]',
    sources: [web(1, 'https://oregon.gov/boli/sick'), hb(2, 'Employees accrue one hour for every 40 hours')] as never },
]

describe('THE DEFAULTS ARE THE WORKSPACE\'S, UNCHANGED', () => {
  test('with no options a source with no URL is dropped and a source is the triple {n, title, url}', () => {
    const { sources } = gatherSources(turns)
    assert.deepEqual(sources, [{ n: 1, title: 'BOLI', url: 'https://oregon.gov/boli/sick' }])
  })
  test('the model\'s list line and the plain text are the workspace\'s', () => {
    assert.match(numberedTranscript(turns).transcript, /\n1\. BOLI — https:\/\/oregon\.gov\/boli\/sick$/)
    const r = checkReport({ title: 't', situation: 's', applies: [{ authority: 'BOLI', items: [{ name: 'n', what_to_do: 'w', sources: [1] }] }] }, turns, '2026-10-08')
    assert.ok(r.ok); if (!r.ok) return
    const text = renderPlainText(r.report)
    assert.ok(text.includes('\nWhat applies\n') && text.includes(AS_OF_LINE('2026-10-08')) && text.includes('1. BOLI — https://oregon.gov/boli/sick'))
  })
})

describe('HR\'S OPTIONS', () => {
  test('a handbook passage is a source, keyed by its handbook and its words: the same passage twice is one', () => {
    const { sources, perTurn } = gatherSources(turns, HR_SOURCES)
    assert.deepEqual(sources.map((s) => [s.n, (s as { kind?: string }).kind]), [[1, 'handbook'], [2, 'web']])
    assert.deepEqual([...perTurn[3]], [[1, 2], [2, 1]], 'the second answer\'s own numbers map onto the shared ones')
    assert.equal(hrKeyWithoutUrl({ kind: 'web', quote: 'x' }), null)
  })
  test('the model sees the passage\'s exact words in the list', () => {
    const { transcript } = numberedTranscript(hrTurns(turns), HR_SOURCES)
    assert.match(transcript, /\n1\. Harbor — 3\. Sick time, page 1 — your handbook: "Employees accrue one hour for every 40 hours"\n2\. BOLI — https:\/\/oregon\.gov\/boli\/sick$/)
  })
  test('THE GREY LINES COME OFF before the conversation is sent', () => {
    const { transcript } = numberedTranscript(hrTurns(turns), HR_SOURCES)
    assert.ok(!transcript.includes(DAY1_LINE))
    assert.ok(transcript.includes('Fix the accrual rate.'))
  })
  test('THE BASIS CHECK finds an item resting on a handbook quote in its answer paragraph, and keeps that source', () => {
    const raw = { title: 't', situation: 's', applies: [{ authority: 'BOLI', items: [
      { name: 'Accrual', what_to_do: 'Change it.', basis: 'Your handbook says “Employees accrue one hour for every 40 hours”', sources: [1, 2] }] }] }
    const r = checkReport(raw, hrTurns(turns), '2026-10-08', { basisRequired: true, sources: HR_SOURCES })
    assert.ok(r.ok); if (!r.ok) return
    assert.deepEqual(r.checks[0], { where: 'BOLI', name: 'Accrual', basis: raw.applies[0].items[0].basis, found: true, kept: [1, 2], dropped: [] })
    assert.equal((r.report.sources[0] as { quote?: string }).quote, 'Employees accrue one hour for every 40 hours', 'the source keeps its quote')
    const text = renderPlainText(r.report, { asOf: HR_AS_OF_LINE, applies: 'What to change', sourceLine: HR_SOURCES.lineOf })
    assert.ok(text.includes('\nWhat to change\n'))
    assert.ok(text.includes('1. Harbor — 3. Sick time, page 1 — your handbook: "Employees accrue one hour for every 40 hours"'))
  })
})

describe('the words (the owner\'s, Step 7)', () => {
  test('HR\'s as-of line, the heading and the per-authority count', () => {
    assert.equal(HR_AS_OF_LINE('2026-10-08'), 'What to change in your handbooks as of 8 October 2026, from this conversation. Rules change. Check before you act.')
    assert.equal(whatToChangeHeading(3), 'What to change · 3 things'); assert.equal(whatToChangeHeading(1), 'What to change · 1 thing')
    assert.equal(thingsToChange(1), '1 thing to change'); assert.equal(thingsToChange(4), '4 things to change')
  })
  test('ReportView draws the workspace\'s words unless HR\'s are passed', () => {
    const rv = readFileSync('components/ReportView.tsx', 'utf8')
    assert.match(rv, /\{words\?\.heading \? words\.heading\(total\) : <>What applies · \{thingsToDo\(total\)\}<\/>\}/)
    assert.match(rv, /right=\{\(words\?\.perGroup \?\? thingsToDo\)\(g\.items\.length\)\}/)
    assert.match(rv, /\{\(words\?\.asOf \?\? AS_OF_LINE\)\(report\.as_of\)\}/)
  })
  test('the prompt is the design\'s draft, plus the workspace\'s situation rule and facts paragraph COPIED WORD FOR WORD', async () => {
    const { hrSummaryPrompt } = await import('../../prompts/hr-summary.ts')
    const { summaryReportPrompt } = await import('../../prompts/summary-report.ts')
    const p = hrSummaryPrompt('2026-10-08')
    const ws = summaryReportPrompt('2026-10-08').split('\n')
    const situation = ws.find((l) => l.startsWith('7. "situation"'))!.slice('7. '.length)
    const facts = ws.find((l) => l.startsWith('About the facts:'))!
    assert.ok(p.startsWith("You are writing the record of one conversation about a company's employee handbooks, after the fact, for the owner or manager who had it."))
    assert.ok(p.includes('if they said none, return an empty list.\n\n' + situation + '\n\n' + facts))
    assert.ok(p.endsWith(facts))
  })
})

describe('the route and the page', () => {
  const route = readFileSync('app/api/hr/topics/[id]/summarise/route.ts', 'utf8')
  const page = readFileSync('app/hr/new/HrWorkspace.tsx', 'utf8')
  test('behind the preview switch before the session; HR conversations only; claim, 202, after(), release in finally; kind hr', () => {
    assert.ok(route.indexOf('hrPreviewOn()') < route.indexOf('requireCompany(request)'))
    assert.match(route, /if \(!topic \|\| topic\.section !== 'hr'\) return NextResponse\.json\(\{ error: NOT_FOUND \}, \{ status: 404 \}\)/)
    assert.ok(route.indexOf("claimTopic(db, id, 'summary')") < route.indexOf('after(async'))
    assert.match(route, /source: 'user', kind: 'hr'/)
    assert.match(route, /\} finally \{\s*await releaseTopic\(db, id, 'summary', claim\.claimedAt\)/)
  })
  test('the summary writer still records the call as "summarise" for both kinds', () => {
    assert.match(readFileSync('lib/summaryReport.ts', 'utf8'), /ledger: \{ companyId: args\.companyId, task: 'summarise' \}/)
  })
  test('the action row: "Summarise this conversation" first, then Download; the drawer draws HR\'s source shape and words', () => {
    assert.ok(page.indexOf("'Summarise this conversation'") < page.indexOf("type: 'Conversation' })"))
    assert.match(page, /sourceShape=\{HR_SOURCE\} words=\{HR_REPORT_WORDS\}/)
    assert.match(page, /fetch\(`\/api\/hr\/topics\/\$\{id\}\/summarise`/)
  })
})

describe('an empty situation (the owner, 7 October): polite, the same in both prompts, drawn as a fixed sentence', async () => {
  const { summaryReportPrompt } = await import('../../prompts/summary-report.ts')
  const { hrSummaryPrompt } = await import('../../prompts/hr-summary.ts')
  const { NO_SITUATION } = await import('../../lib/summaryWords.ts')
  const SENT = ' If the person stated nothing about their business, "situation" is an empty string; put missing details that would change the answer under to_confirm, as plain questions that say why they matter.'
  test('the same sentence, next to the situation rule, in both prompts', () => {
    assert.ok(summaryReportPrompt('x').includes('Not what the answer concluded.' + SENT))
    assert.ok(hrSummaryPrompt('x').includes('Not what the answer concluded.' + SENT))
  })
  test('an empty situation is accepted, and the plain text and the drawer say the fixed sentence', () => {
    const r = checkReport({ title: 't', situation: '', applies: [] }, [{ role: 'user', text: 'q' }], '2026-10-08')
    assert.ok(r.ok); if (!r.ok) return
    assert.equal(r.report.situation, '')
    assert.ok(renderPlainText(r.report).includes('Your situation\n' + NO_SITUATION))
    assert.equal(NO_SITUATION, 'No details about your business came up in this conversation.')
    assert.match(readFileSync('components/ReportView.tsx', 'utf8'), /\{report\.situation\.trim\(\)\s*\? <p className="text-\[15px\] leading-relaxed text-gray-800">\{report\.situation\}<\/p>\s*: <p className="rounded-lg bg-gray-50 px-3 py-2 text-\[12\.5px\] text-gray-500">\{NO_SITUATION\}<\/p>\}/)
  })
})

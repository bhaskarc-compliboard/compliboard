/**
 * S2, H1, W5 and HR-read — ANSWERS THAT DID NOT FINISH, AND INPUTS THAT WERE NEVER THERE.
 *
 * Root R4 (`docs/FIX-LIST-FAILURES.md` items 47, 48, 31, 49), Job E2.
 *
 * *** MADE TO FAIL ON THE OLD CODE FIRST. *** Each group names the line that shipped and asserts
 * what it did. The three route-level fixes are read off the files, because a route behind
 * `requireCompany` with a live stream cannot be handed a truncated answer in a unit test — the
 * reading they do is exact (the `send` shapes, the guard order) rather than a keyword search.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { finishedCleanly } from '../../lib/answerShape.ts'
import { readAnswerStream } from '../../lib/answerStream.ts'
import { cutAtAnchors, sectionsFromCuts, proveCoverage } from '../../lib/handbookSections.ts'

const strip = (p: string) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('finishedCleanly — the one reason that means the model finished', () => {
  test('end_turn and stop_sequence are complete', () => {
    assert.deepEqual(finishedCleanly('end_turn'), { complete: true })
    assert.deepEqual(finishedCleanly('stop_sequence'), { complete: true })
  })

  test('*** max_tokens is NOT — and askAIOpenStream does not retry, unlike askAI ***', () => {
    const r = finishedCleanly('max_tokens')
    assert.equal(r.complete, false)
    assert.match(!r.complete ? r.why : '', /ran out of room before it was finished/)
  })

  test('refusal, pause_turn and tool_use each get their own sentence', () => {
    for (const [reason, words] of [['refusal', /declined to answer/], ['pause_turn', /paused part-way/],
                                   ['tool_use', /stopped to use a tool/]] as const) {
      const r = finishedCleanly(reason)
      assert.equal(r.complete, false, reason)
      assert.match(!r.complete ? r.why : '', words, reason)
    }
  })

  test('NO reason at all is not complete either — we were not told', () => {
    for (const v of [null, undefined, '']) {
      const r = finishedCleanly(v)
      assert.equal(r.complete, false, String(v))
      assert.match(!r.complete ? r.why : '', /not told whether the answer finished/)
    }
  })

  test('a reason nobody has seen before names itself rather than being waved through', () => {
    const r = finishedCleanly('something_new')
    assert.equal(r.complete, false)
    assert.match(!r.complete ? r.why : '', /unknown reason \(something_new\)/)
  })
})

describe('*** S2: the chat stream — a `done` event is not proof the answer finished ***', () => {
  const lines = async function* (xs: string[]) { for (const x of xs) yield x }
  const DONE = { type: 'done', research: 'Three things are needed.', sources: [], topicId: 't1' }

  test('a clean finish is `done`, as before', async () => {
    const out = await readAnswerStream(lines([JSON.stringify(DONE)]), () => {})
    assert.equal(out.kind, 'done')
  })

  test('*** an incomplete one is `stopped_early`, which the page already explains ***', async () => {
    const out = await readAnswerStream(
      lines([JSON.stringify({ ...DONE, incomplete: 'the answer ran out of room before it was finished' })]),
      () => {})
    assert.equal(out.kind, 'stopped_early')
    assert.equal(out.kind === 'stopped_early' ? out.text : '', 'Three things are needed.',
      'what arrived is still the person\'s and is still shown')
  })

  test('the OLD reader returned `done` for the same stream', async () => {
    // `sawDone = true` on any `done` event, with nothing looking at the reason. Copied exactly.
    let sawDone = false
    for await (const l of lines([JSON.stringify({ ...DONE, incomplete: 'x' })])) {
      if (JSON.parse(l).type === 'done') sawDone = true
    }
    assert.equal(sawDone, true, 'which is why a truncated answer was saved and counted')
  })

  test('the page draws the stopped-early block for it, with Try again', () => {
    const page = readFileSync('app/compliance/page.tsx', 'utf8')
    assert.match(page, /x\.phase === 'stopped_early'/)
    assert.match(page, /This answer stopped early\./)
    assert.match(page, /Nothing\s*\n?\s*was saved for it\./)
  })
})

describe('S2: and the three routes act on it', () => {
  test('the chat route saves nothing and counts nothing on an incomplete answer', () => {
    const chat = strip('app/api/chat/route.ts')
    const guard = chat.indexOf('const finish = finishedCleanly(ev.stopReason)')
    const save = chat.indexOf('saveAssistantTurn(db, { topicId: convoTopicId')
    const count = chat.indexOf("bumpCounter(supabaseAdmin, companyId, 'questions_answered')")
    assert.ok(guard > 0 && guard < save && guard < count, 'the guard comes before both')
    assert.match(chat.slice(guard, save), /if \(!finish\.complete\) \{[\s\S]*?continue;/,
      'and it returns out of the branch rather than falling through')
    assert.match(chat.slice(guard, save), /incomplete: finish\.why/)
  })

  test('the HR answer route the same, and its check record is not attached to a half-answer', () => {
    const hr = strip('app/api/hr/answer/route.ts')
    const guard = hr.indexOf('const finish = finishedCleanly(ev.stopReason)')
    const save = hr.indexOf('await saveAssistantTurn(db, { topicId, companyId, text')
    const count = hr.indexOf("bumpCounter(supabaseAdmin, companyId, 'questions_answered')")
    assert.ok(guard > 0 && guard < save && guard < count)
    assert.match(hr.slice(guard, save), /if \(!finish\.complete\) \{[\s\S]*?continue/)
  })

  test('*** the handbook check fails the piece instead of storing it done ***', () => {
    const hb = strip('lib/handbookCheck.ts')
    const guard = hb.indexOf('const finish = finishedCleanly(ev.stopReason)')
    const finishAnswerCall = hb.indexOf('const fin = finishAnswer(')
    assert.ok(guard > 0 && guard < finishAnswerCall,
      'before anything is stored: checked_at, the 90-day date and the email all follow from it')
    assert.match(hb.slice(guard, finishAnswerCall), /return fail\(`The check did not finish/)
  })

  test('and "How do I do this?" releases its claim rather than saving a truncated answer', () => {
    const howto = strip('app/api/checklist-items/[id]/how-to/route.ts')
    assert.match(howto, /const finish = finishedCleanly\(stopReason\)/)
    assert.ok(howto.indexOf('finishedCleanly(stopReason)') < howto.indexOf('JSON.parse(extractJsonText'),
      'before the parse, because a truncated answer that happens to parse is the dangerous case')
  })
})

describe('*** H1: a handbook checked with no text in the prompt ***', () => {
  const hb = strip('lib/handbookCheck.ts')

  test('the sections read is checked, and a failure fails the piece', () => {
    assert.match(hb, /tryRows<SectionRow>\("the handbook's sections"/)
    assert.match(hb, /return fail\(`The handbook's sections could not be read/)
  })

  test('*** and an EMPTY input is refused even when the read succeeded ***', () => {
    assert.match(hb, /if \(!mine\.length\) \{/)
    assert.match(hb, /no sections stored, so there is nothing to check it against/)
  })

  test('both guards come before the model call and before anything is stored', () => {
    const guard = hb.indexOf('if (!mine.length) {')
    const call = hb.indexOf("for await (const e of ask(system, messages")
    assert.ok(guard > 0 && guard < call, 'nothing is spent on a prompt with no handbook in it')
  })

  test('the OLD code made `whole` true for an unread handbook — 0 === 0', () => {
    // `secs = []` from a failed read gave `mine = []`, so `whole` was true and the prompt said it
    // held the entire handbook. That arithmetic is the whole of H1.
    const secs: unknown[] = []
    const mine: unknown[] = []
    assert.equal(mine.length === secs.length, true,
      'which is why the model was told it had been given the whole thing')
  })
})

describe('*** HR-read: a wrong-shape outline became one untitled section ***', () => {
  // The trace the fix list asked E0 for, run rather than described.
  const TEXT = 'Handbook\n1 Welcome Employees are welcome.\n2 Pay Employees are paid fortnightly.'

  test('no anchors → ONE section covering the whole handbook, and proveCoverage PASSES it', () => {
    const { sections } = cutAtAnchors(TEXT, [])
    const built = sections.length ? sections : sectionsFromCuts(TEXT, [])
    assert.equal(built.length, 1, 'that is the fallback in sectionsFromCuts')
    assert.equal(built[0].title, null)
    assert.equal(built[0].text, TEXT)
    assert.equal(proveCoverage(TEXT, built), null,
      'so nothing downstream could tell: the handbook was stored read, with 1 section')
  })

  test('the outline call now refuses a reply with no `sections` field', () => {
    const read = strip('lib/handbookRead.ts')
    assert.match(read, /const fits = answerWith\(reply, \['sections'\]\)/)
    assert.match(read, /throw new Error\(`the outline of \$\{where\} came back wrong/)
  })

  test('...and a list whose every item was dropped', () => {
    const read = strip('lib/handbookRead.ts')
    assert.match(read, /if \(list\.length && !kept\.length\)/)
  })

  test('*** an empty list is still allowed — a short part may have no boundary ***', () => {
    const read = strip('lib/handbookRead.ts')
    const body = read.slice(read.indexOf('export function modelOutline'),
                            read.indexOf('export function readClaimFilter'))
    assert.ok(!/if \(!list\.length\)/.test(body),
      '`{"sections": []}` is the model answering, not the shape being wrong')
    assert.match(body, /if \(kept\.length < list\.length\)/, 'and a partial drop is said out loud')
  })
})

describe('*** W5: "How do I do this?" researched with no subject, and kept it for ever ***', () => {
  const howto = strip('app/api/checklist-items/[id]/how-to/route.ts')

  test('the checklist read is checked, and the claim is released so it can be tried again', () => {
    assert.match(howto, /const listRes = await db\.from\('checklists'\)\.select\('title, question'\)/)
    assert.match(howto, /if \(listRes\.error\) \{[\s\S]*?await release\(\)/)
  })

  test('the guard comes before the model call — nothing is spent on "(none)"', () => {
    const guard = howto.indexOf('if (listRes.error)')
    const call = howto.indexOf('for await (const ev of askAIOpenStream(')
    assert.ok(guard > 0 && guard < call)
  })

  test('*** and a result with NO usable step is not stored ***', () => {
    // `checkHowTo` accepts `steps: []` — every step may be dropped for a link the search never
    // returned. Right per step, wrong to store: `:61` returns a saved `howto` without asking again,
    // so an empty answer would show for ever.
    assert.match(howto, /if \(!checked\.result\.steps\.length\) \{/)
    const guard = howto.indexOf('if (!checked.result.steps.length)')
    const save = howto.indexOf(".update({ howto: checked.result")
    assert.ok(guard > 0 && guard < save, 'before the save, or it is stored and never redone')
  })

  test('the one thing that must NOT change: a saved result is still never bought twice', () => {
    assert.match(howto, /if \(item\.howto\) return NextResponse\.json\(\{ status: 'done', howto: item\.howto \}\)/)
  })
})

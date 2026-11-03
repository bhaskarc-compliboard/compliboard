/**
 * THE AUDITS PAGE AFTER THE CHAT — `docs/GAPS-PLAN.md` Part A step 6b (decisions 31–45).
 *
 * Three tabs, the Ask box with the looker, and today's two audit tabs folded into one. What is
 * tested here is the part that can be tested without a browser: **the looker is a pure function**
 * and is exported for exactly that reason, and the rest of the page is read as text, which is how
 * `tests/unit/auditDrawer.test.ts` and `tests/unit/documentsPage.test.ts` hold their pages.
 *
 * The rule that matters most is the first: **the audit word comes first** (decision 38). Without
 * it *"Do we have all our permits?"* contains "all" and *"Are we ready for a DEQ inspection?"*
 * contains an agency label, and both would start a run instead of being answered — which is the
 * product spending money and writing rows because of a word in a question.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readCommand, AUDIT_WORD, looksLikeAQuestion } from '../../lib/auditsCommand.ts'
import {
  auditsCommandAgencyLine, auditsCommandTemplateLine, WHICH_AGENCY, NO_AGENCIES,
  ATTACH_THE_FILE, COULD_NOT_AUDIT, AUDITS_COMMAND_TAB_LINK,
} from '../../lib/auditsWords.ts'

const PAGE = readFileSync('app/audits/page.tsx', 'utf8')
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const CODE = code(PAGE)

/** Cascade's own four, read back out of staging on 3 November 2026. */
const AGENCIES = ['Oregon DEQ', 'Oregon OSHA', 'Oregon State Fire Marshal', 'U.S. OSHA']

describe('the looker: the audit word comes first — decision 38', () => {
  /**
   * *** THE TWO SENTENCES THAT MUST REACH THE MODEL, AND WHY EACH ONE IS HERE. ***
   * The first contains "all", which the old box read as "audit everything". The second is step
   * 6a's question 3 and contains no agency at all but does say "check" — the kind of sentence a
   * looser rule would grab. Both are questions and both must be answered.
   */
  test('"Do we have all our permits?" is a question, not an audit of everything', () => {
    assert.equal(readCommand('Do we have all our permits?', AGENCIES, false), null)
  })

  test('"Here is a file. Check if we are good." is a question, even with a file attached', () => {
    assert.equal(readCommand('Here is a file. Check if we are good.', AGENCIES, true), null)
  })

  test('an agency name in a question does not start a run', () => {
    assert.equal(readCommand('Are we ready for an Oregon OSHA inspection?', AGENCIES, false), null)
    assert.equal(readCommand('What did Oregon DEQ ask for last time?', AGENCIES, false), null)
  })

  test('the word is matched in every form, and only as a whole word', () => {
    for (const w of ['audit', 'audits', 'audited', 'auditing', 'AUDIT', 'Audit']) {
      assert.ok(AUDIT_WORD.test(`please ${w} us`), `${w} is an audit word`)
    }
    // "auditor" is not a command — "our auditor sent this" is a sentence about a person.
    assert.ok(!AUDIT_WORD.test('our auditor sent this list'), 'auditor is not audit')
  })
})

/**
 * *** AND A QUESTION IS NOT A COMMAND, EVEN WHEN IT SAYS "AUDIT" — found by walking step 6b. ***
 *
 * The walk typed *"What did the last Oregon DEQ audit find about the scrubber log?"* and the
 * harness refused a paid route: `BLOCKED (1): paid route: POST /api/audit-runs`. The sentence
 * has the audit word AND an agency label, and decision 38's rule let it through — so a plain
 * question about an audit that had already happened started another one. These are the tests
 * that would have caught it, written after it was caught by something else.
 */
describe('the looker: a question about an audit is still a question', () => {
  for (const q of [
    'What did the last Oregon DEQ audit find about the scrubber log?',
    'When was our last DEQ audit?',
    'Why did the Oregon OSHA audit say nothing on file?',
    'How many things did the audit find?',
    'Did the audit cover the Portland plant?',
    'Has anything changed since the Oregon DEQ audit?',
    'Is the template audit finished?',
  ]) {
    test(`"${q}" goes to the model`, () => {
      assert.equal(readCommand(q, AGENCIES, false), null)
    })
  }

  /**
   * The one it gives away, and it is given away on purpose: this is a real request to be
   * audited, and it now reaches the model — which is exactly the case decision 41's offer card
   * was built for. The person presses once instead of typing twice. A looker that guesses wrong
   * this way costs a click; the other way it costs a model call and an audit run.
   */
  test('"Can you audit us for DEQ?" reaches the model, and the offer is what answers it', () => {
    assert.equal(readCommand('Can you audit us for DEQ?', AGENCIES, false), null)
  })

  test('an imperative with the word is still a command', () => {
    for (const q of ['Audit us for Oregon DEQ', 'Please audit us against Oregon OSHA',
      'Audit everything', 'Audit us against the attached template']) {
      assert.notEqual(readCommand(q, AGENCIES, false), null, `"${q}" must still start a run`)
    }
  })

  test('the two signals, each on its own', () => {
    assert.equal(looksLikeAQuestion('Audit us for Oregon DEQ?'), true, 'a question mark is enough')
    assert.equal(looksLikeAQuestion('What a mess'), true, 'a question word is enough')
    assert.equal(looksLikeAQuestion('Audit us for Oregon DEQ'), false)
  })
})

describe('the looker: the four cases, which are submitAsk\'s own', () => {
  test('an agency named in the sentence, with the rest kept as the scope', () => {
    assert.deepEqual(readCommand('Audit us for Oregon DEQ', AGENCIES, false),
      { kind: 'agency', agency: 'Oregon DEQ', scope: 'Audit us for' })
    // What is left after the label is removed, even when it is one word. This is `submitAsk`'s
    // own behaviour, kept byte for byte: the scope is the person's words about what they meant,
    // and it is shown back to them on the run.
    assert.deepEqual(readCommand('Oregon DEQ audit', AGENCIES, false),
      { kind: 'agency', agency: 'Oregon DEQ', scope: 'audit' })
    // And the WHOLE sentence when nothing is left, so a run is never scoped to "".
    assert.deepEqual(readCommand('audit Oregon DEQ'.replace('audit ', 'Audit '), AGENCIES, false),
      { kind: 'agency', agency: 'Oregon DEQ', scope: 'Audit' })
  })

  /**
   * LONGEST LABEL FIRST, which is the box's own rule and is not cosmetic: "Oregon OSHA" contains
   * no shorter label here, but "U.S. OSHA" and "Oregon OSHA" both end in OSHA and a company may
   * hold a label contained in another. Sorting by length makes the most specific one win.
   */
  test('the longest matching label wins', () => {
    const held = ['OSHA', 'Oregon OSHA']
    assert.deepEqual(readCommand('Audit us against Oregon OSHA', held, false),
      { kind: 'agency', agency: 'Oregon OSHA', scope: 'Audit us against' })
  })

  test('everything, in the words the box has always taken', () => {
    for (const q of ['Audit everything', 'Audit all agencies', 'Audit us against every agency']) {
      assert.equal(readCommand(q, AGENCIES, false)?.kind, 'agency')
      assert.equal((readCommand(q, AGENCIES, false) as { agency: string }).agency, 'all')
    }
  })

  test('a file on the turn, or words that name one, is a template run', () => {
    assert.deepEqual(readCommand('Audit us against this', AGENCIES, true), { kind: 'template' })
    assert.deepEqual(readCommand('Audit us against the attached template', AGENCIES, false), { kind: 'template' })
    assert.deepEqual(readCommand('Audit us against our checklist', AGENCIES, false), { kind: 'template' })
  })

  test('an audit word with no agency and no file asks which agency', () => {
    assert.deepEqual(readCommand('Audit us', AGENCIES, false), { kind: 'choose' })
    assert.deepEqual(readCommand('Audit us for Texas TCEQ', AGENCIES, false), { kind: 'choose' })
  })

  test('a company with no agency labels still gets an answer, not a crash', () => {
    assert.deepEqual(readCommand('Audit us for Oregon DEQ', [], false), { kind: 'choose' })
  })
})

describe('what a handled command writes, and what it must not', () => {
  /**
   * *** NO TOPIC AND NO TURN — decision 39. *** A command is answered by code, so `topics` must
   * not fill with rows holding one question and no answer: the Conversations tab would list them
   * and the night summariser would try to summarise them. The screen's `beforeAsk` returns
   * before any row is written, and the page's own handler writes a notice instead.
   */
  test('beforeAsk returns handled before anything is sent, and writes a notice', () => {
    const fn = CODE.slice(CODE.indexOf('async function beforeAsk('))
    const body = fn.slice(0, fn.indexOf('\n  }') + 4)
    assert.match(body, /return 'ask' as const/, 'a question must go on to the model')
    assert.match(body, /setCommandLine\(/, 'a command must leave its line')
    assert.ok(!/fetch\('\/api\/audits\/answer/.test(body), 'a command must not call the answer route')
    assert.ok(!/topics\.|insert\(/.test(body), 'a command must write no row')
  })

  test('the two lines are decision 39\'s, and neither promises an email', () => {
    assert.equal(auditsCommandAgencyLine('Oregon DEQ'),
      'Starting the Oregon DEQ audit. It is on the Audits tab.')
    assert.equal(auditsCommandTemplateLine('list.docx', 16, 3),
      'Auditing against list.docx — 16 lines in 3 sections. It is on the Audits tab.')
    for (const l of [auditsCommandAgencyLine('x'), auditsCommandTemplateLine('y', 2, 2)]) {
      assert.ok(!/email/i.test(l))
      assert.ok(l.endsWith(`${AUDITS_COMMAND_TAB_LINK}.`), 'the line ends at the control')
    }
  })

  test('the three sentences a command can say instead of starting a run', () => {
    assert.match(WHICH_AGENCY, /We audit by agency/)
    assert.match(ATTACH_THE_FILE, /Attach the checklist or template first/)
    assert.match(NO_AGENCIES, /None of your documents carries an agency yet/)
    // §5.1: ours, plainly, and nothing was started.
    assert.match(COULD_NOT_AUDIT, /Nothing was changed/)
  })

  test('the agency choices are rendered under the question, as the box always did', () => {
    assert.match(CODE, /setChoices\(idx\.agencies\)/)
    assert.match(CODE, /choices\.map\(\(a\) => \(/)
  })
})

describe('the box is gone, and nothing calls what it called', () => {
  /** Grep, because a leftover call site is how a deleted control comes back by accident. */
  test('submitAsk, attachChecklist and the three template stand-ins are gone from the code', () => {
    for (const name of ['submitAsk', 'attachChecklist(', 'runningTemplate', 'landedTemplate',
      'seenTemplate', 'checklistInput']) {
      assert.ok(!CODE.includes(name), `${name} is still called`)
    }
  })

  test('the dead Compliance Workspace link is gone — decision 35, PENDING D5', () => {
    assert.ok(!CODE.includes('Or ask a question in the Compliance Workspace'))
    assert.ok(!/href="\/compliance"/.test(CODE))
  })

  test('one POST starts an agency run, not two', () => {
    assert.equal((CODE.match(/kind: 'agency'/g) ?? []).length, 1,
      'the row button and a typed command must start a run the same way')
    assert.equal((CODE.match(/kind: 'template'/g) ?? []).length, 1)
  })

  /** The Audit and Audit again buttons are paid controls, so the page keeps its note. */
  test('PausedNote stays on the page', () => {
    assert.match(CODE, /<PausedNote banner=\{paused\} \/>/)
  })
})

describe('the merged Audits tab — decision 31', () => {
  test('three tabs, through the shared row', () => {
    assert.match(CODE, /<Tabs active=\{tab\} onSelect=\{selectTab\}/)
    assert.match(CODE, /key: 'ask', label: 'Ask a question'/)
    assert.match(CODE, /key: 'conversations', label: 'Conversations'/)
    assert.match(CODE, /key: 'audits', label: `Audits\$\{runCount \? ` \(\$\{runCount\}\)` : ''\}`/)
    // And the two old tab bodies are one.
    assert.ok(!CODE.includes("tab === 'past'"), 'the Past audits tab is still a tab')
    assert.ok(!CODE.includes("tab === 'stand'"), 'Where you stand is still a tab')
  })

  test('two groups, with the headings board 4 draws', () => {
    assert.match(CODE, /<p className=\{GROUP_LABEL\}>By agency<\/p>/)
    assert.match(CODE, /<p className=\{GROUP_LABEL\}>By template<\/p>/)
  })

  /**
   * *** EVERY EARLIER RUN COMES BACK, OR FOLDING THE TABS LOSES THEM. *** The agency row shows
   * the LATEST done run; Past audits showed them all. `earlierFor` is the list, and it reads the
   * SECTIONS rather than `agency_label`, because an "all agencies" run carries every label in
   * one string (`app/api/audits/index/route.ts:88`–`:91`).
   */
  test('an agency row opens to its earlier runs, read off the sections', () => {
    const fn = CODE.slice(CODE.indexOf('function earlierFor(label: string)'))
    const body = fn.slice(0, fn.indexOf('\n  }') + 4)
    assert.match(body, /r\.id === latest/, 'the latest run is on the row itself, not in the list')
    assert.match(body, /r\.kind === 'template'/, 'a template run has no agency to live under')
    assert.match(body, /idx\.sections\.some\(\(x\) => x\.run_id === r\.id && x\.title === label\)/)
    assert.match(CODE, /<EarlierRuns runs=\{earlierFor\(label\)\}/)
  })

  test('an earlier run keeps every line Past audits gave it', () => {
    const at = CODE.indexOf('function EarlierRuns(')
    const body = CODE.slice(at, at + 2600)
    assert.match(body, /needsOf\(r\.summary\)\} to look at/)
    assert.match(body, /from \$\{fmt\(prev\.finished_at \?\? prev\.created_at\)\} closed/)
    assert.match(body, /did not finish/)
    assert.match(body, /r\.scope &&/, "the person's own words are shown back")
    assert.match(body, /onOpen\(r\.id\)/, 'and it opens the report')
  })

  test('a template run has a row of its own, with its lines, its sections and its state', () => {
    const at = CODE.indexOf('By template')
    const body = CODE.slice(at, CODE.indexOf('Every audit is kept', at))
    assert.match(body, /templateRuns\.map/)
    assert.match(body, /Audit running · \$\{r\.estimate \?\? idx\.estimate\}/)
    assert.match(body, /line\$\{lines === 1 \? '' : 's'\} in/)
    assert.match(body, /needsOf\(r\.summary\)\} to look at/)
    assert.match(body, /did not finish/)
    assert.match(body, /setParam\('run', r\.id\)/)
  })

  test('the closing sentence is at the tab\'s foot, and the unplaced list is still there', () => {
    assert.match(CODE, /Every audit is kept\./)
    assert.match(CODE, /Documents we read but could not place under an agency/)
  })

  test('the run drawer and ?run= are untouched', () => {
    assert.match(CODE, /<AuditReport runId=\{openRun\}/)
    assert.match(CODE, /className=\{openDoc \? 'hidden' : ''\}/)
  })
})

describe('the Ask and Conversations tabs are the shared screen', () => {
  test('AskScreen is mounted as Documents mounts it, with this section\'s words', () => {
    assert.match(CODE, /section="audits_chat"/)
    assert.match(CODE, /endpoints=\{\{ answer: '\/api\/audits\/answer' \}\}/)
    assert.match(CODE, /summarisePath: \(id\) => `\/api\/audits\/topics\/\$\{id\}\/summarise`/)
    assert.match(CODE, /examples=\{AUDITS_EXAMPLE_QUESTIONS\}/)
    assert.match(CODE, /label: AUDITS_ATTACH_LABEL/)
    assert.match(CODE, /canMakeChecklist/)
    assert.match(CODE, /beforeAsk=\{beforeAsk\}/)
    assert.match(CODE, /afterAnswer=\{auditsAfterAnswer\}/)
  })

  test('only this section\'s conversations are listed', () => {
    assert.match(CODE, /readTopicList\(supabase, 'audits_chat'\)/)
  })

  test('the drawer is the shared one, with Delete', () => {
    assert.match(CODE, /<ConversationDrawer/)
    assert.match(CODE, /onDeleted=\{\(\) => \{ conv\.setConvDrawer\(null\); void reloadTopics\(\) \}\}/)
  })
})

describe('the offer press — decisions 41, 43, 45', () => {
  test('it checks the payload against the company\'s own labels before any POST', () => {
    const fn = CODE.slice(CODE.indexOf('async function pressOffer('))
    const body = fn.slice(0, fn.indexOf('\n  }') + 4)
    assert.match(body, /checkRunAuditOffer\(offer, \{/)
    assert.match(body, /agencies: idx\.agencies/)
    assert.ok(body.indexOf('checkRunAuditOffer') < body.indexOf('startAgencyRun'),
      'the check must come before the run')
    assert.ok(!/offer\.agency as string\b[\s\S]*checkRunAuditOffer/.test(body),
      "the model's own agency must never reach the route")
  })

  /** The id is the PAGE's, never the model's (decision 45). */
  test('an attached offer is resolved from the file the page holds', () => {
    assert.match(CODE, /attachedDocumentId: attachedId/)
    assert.match(CODE, /pressOffer\(o, attached\?\.id \?\? null, attached\?\.name \?\? null\)/)
  })

  /**
   * *** IT CANNOT BE PRESSED TWICE. *** `x.added` is the shared screen's per-offer record and it
   * is written BEFORE the call, so the line stops being a button at the first press. A second
   * press would be a second run; the route's own claim answers 409, but the person never gets
   * that far.
   */
  test('the card is marked before the call, so a second press is impossible', () => {
    const at = CODE.indexOf('function auditsAfterAnswer(')
    const body = CODE.slice(at, CODE.indexOf('\n  }', CODE.indexOf('pressOffer(o,', at)))
    assert.ok(body.indexOf('patch({ added:') < body.indexOf('await pressOffer'),
      'the press must be recorded before it is made')
    assert.match(body, /const state = x\.added\?\.\[i\]/)
    assert.match(body, /if \(state\) \{/, 'a pressed card renders as a line, not a button')
  })

  test('only run_audit offers are drawn here', () => {
    assert.match(CODE, /x\.offers\.filter\(\(o\) => o\.kind === 'run_audit'\)/)
  })
})

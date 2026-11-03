/**
 * THE SHARED CHAT SCREEN — `docs/GAPS-PLAN.md` Part A step 2 (decisions 4, 8, 9).
 *
 * Four things the step's brief named, each testable without a browser and without a model: that no
 * HR word reached the lifted files, that the action row is the owner's three in the owner's order,
 * that the attach slot draws a link when it is given one, and that the drawer has Delete.
 *
 * Plus the two rules the lift is only safe because of: the screen imports TYPES ONLY from
 * `lib/ask/*` (the engine behind it imports the model SDK), and the Calendar's own part did not
 * move — the offers are still the Calendar's file and still go through the one writer.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
/**
 * *** THE FILES ARE READ, NOT IMPORTED, and that is the house pattern rather than a shortcut. ***
 * `node --test` strips types from `.ts` and refuses `.tsx` outright
 * (`ERR_UNKNOWN_FILE_EXTENSION`), so no test in this repository imports a component — every one of
 * them reads the source as text (`calendarShell.test.ts`, `clientImports.test.ts`). Importing one
 * would mean adding a loader to `scripts/test-guard.js`, which is a change to how all 2000-odd
 * tests run, for one test's convenience.
 *
 * So the exported sentences are pulled out of the source by name. `named()` fails loudly when a
 * name is missing rather than comparing against undefined, because a test that cannot find the
 * thing it is checking looks exactly like a test that found it correct (`CLAUDE.md` §9a).
 */

const SCREEN = readFileSync('components/AskScreen.tsx', 'utf8')

/** The value of `export const NAME = '…'` in a source file, or a loud failure. */
function named(src: string, name: string, where: string): string {
  const m = src.match(new RegExp(`export const ${name} =\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`))
  assert.ok(m, `${where} does not export ${name} as a plain string — this test can see nothing`)
  return m![1].replace(/\\'/g, "'")
}
/** One key of an `export const X = { … } as const` object. */
function wordIn(src: string, obj: string, key: string, where: string): string {
  const block = src.slice(src.indexOf(`export const ${obj} =`))
  const m = block.match(new RegExp(`\\b${key}:\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`))
  assert.ok(m, `${where}'s ${obj} has no ${key} — this test can see nothing`)
  return m![1].replace(/\\'/g, "'")
}
const DRAWER = readFileSync('components/ConversationDrawer.tsx', 'utf8')
const CAL_ASK = readFileSync('components/CalendarAsk.tsx', 'utf8')
const PAGE = readFileSync('app/calendar/page.tsx', 'utf8')
const HR_WORDS = readFileSync('lib/hrAnswerWords.ts', 'utf8')

/** The code without comments, so a comment naming a thing is not a use of it. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('no HR word reaches the shared screen or the shared drawer', () => {
  test('neither file imports lib/hrAnswerWords.ts, by any path', () => {
    for (const [name, src] of [['AskScreen', SCREEN], ['ConversationDrawer', DRAWER]] as const) {
      assert.ok(!/hrAnswerWords/.test(code(src)), `${name} imports HR's words`)
      assert.ok(!/from '@\/lib\/hr|from '@\/app\/hr/.test(code(src)), `${name} imports something of HR's`)
    }
  })

  /**
   * *** AND NOT ONE OF HR'S SENTENCES IS COPIED IN EITHER. ***
   * An import is easy to see; a copied sentence is not, and a copy is what drifts. Every string
   * `lib/hrAnswerWords.ts` exports as a plain sentence is checked against both files.
   */
  /**
   * *** AND NOT ONE OF HR'S SENTENCES IS COPIED IN, WITH ONE NAMED EXCEPTION. ***
   *
   * An import is easy to see; a copied sentence is not, and a copy is what drifts. Every sentence
   * `lib/hrAnswerWords.ts` exports is checked against both lifted files.
   *
   * **The exception is "Delete this conversation?" and it is a sentence two sections SHOULD agree
   * on.** It names nothing of HR's: it is the plainest question that can be asked before a
   * destructive act, and the shared drawer arriving at the same words as HR is the lift working,
   * not drifting. The list is here, with its reason, so a SECOND agreement has to be argued for
   * rather than slipped in — which is the difference between a shared word and a copied one.
   */
  const SHARED_WITH_HR_ON_PURPOSE = ['Delete this conversation?']

  test('and no sentence of HR\'s is copied into either', () => {
    const hrSentences = [...HR_WORDS.matchAll(/'([^'\n]{25,})'|"([^"\n]{25,})"/g)]
      .map((m) => (m[1] ?? m[2]).trim())
      .filter((t) => / /.test(t) && !t.includes('${') && !t.startsWith('@/'))
      .filter((t) => !SHARED_WITH_HR_ON_PURPOSE.includes(t))
    assert.ok(hrSentences.length > 5, `only ${hrSentences.length} HR sentences found — the probe cannot see a presence`)
    for (const sentence of hrSentences) {
      assert.ok(!code(SCREEN).includes(sentence), `AskScreen copies HR's "${sentence.slice(0, 50)}…"`)
      assert.ok(!code(DRAWER).includes(sentence), `ConversationDrawer copies HR's "${sentence.slice(0, 50)}…"`)
    }
  })

  test('HR is not touched: it still holds its own words and its own screen', () => {
    const hr = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
    assert.match(hr, /from '@\/lib\/hrAnswerWords'/)
    assert.ok(!/AskScreen|ConversationDrawer/.test(hr), 'HR must not render the lifted screen in this step')
  })
})

describe('the action row is the owner\'s three, in the owner\'s order (decision 8)', () => {
  test('the three words are what the owner wrote', () => {
    assert.equal(named(SCREEN, 'ACTION_CHECKLIST', 'AskScreen'), 'Turn this into a checklist')
    assert.equal(named(SCREEN, 'ACTION_SUMMARISE', 'AskScreen'), 'Summarise this conversation')
    assert.equal(named(SCREEN, 'ACTION_DOWNLOAD', 'AskScreen'), 'Download')
  })

  test('and they are rendered in that order', () => {
    const row = SCREEN.slice(SCREEN.indexOf('{docked && topicId && answered'))
    const at = (k: string) => row.indexOf(k)
    assert.ok(at('ACTION_CHECKLIST') > -1, 'the checklist action is not in the row')
    assert.ok(at('ACTION_CHECKLIST') < at('ACTION_SUMMARISE'),
      'the checklist action must come first')
    assert.ok(at('ACTION_SUMMARISE') < at('ACTION_DOWNLOAD'),
      'Download must come last')
  })

  /**
   * *** THE FIRST ACTION IS OFF UNTIL PART A STEP 5, AND THAT IS WHY IT IS A PROP. ***
   * A control that does nothing is a promise the product is not keeping (`CLAUDE.md` §5.1), so it
   * renders only where a section says it can act on it. Calendar passes nothing, which is false.
   */
  test('the checklist action is gated, and the Calendar does not pass the gate', () => {
    assert.match(SCREEN, /canMakeChecklist = false/, 'it must default to off')
    assert.match(SCREEN, /\{canMakeChecklist && \(/, 'and be rendered behind the gate')
    assert.ok(!/canMakeChecklist/.test(code(PAGE)), 'the Calendar page must not turn it on in this step')
  })
})

describe('the attach slot', () => {
  test('draws a link when the section gives it one, through the shared control', () => {
    assert.match(SCREEN, /from '@\/components\/AttachControl'/)
    assert.match(SCREEN, /<AttachControl label=\{attach\.label\} href=\{attach\.href\} \/>/)
    // The shared control draws an `<a>` for an href and a `<button>` for a handler, and one or the
    // other — never both (`components/AttachControl.tsx`). Not edited by this step.
    const control = readFileSync('components/AttachControl.tsx', 'utf8')
    assert.match(control, /if \(href\) \{/)
    assert.match(control, /<a href=\{href\}/)
  })

  test('and the Calendar still points it at Documents, with `return=` and no `add=`', () => {
    assert.match(PAGE, /attach=\{\{ label: 'Add a document', href: '\/documents\?return=%2Fcalendar%3Ftab%3Dask' \}\}/)
    assert.ok(!/documents\?add=/.test(PAGE.slice(PAGE.indexOf('<AskScreen'), PAGE.indexOf('afterAnswer'))),
      'the chat must not send an add= hint it cannot fill in')
  })
})

describe('the conversation drawer has Delete, and says true things about it', () => {
  test('the control is there, and it calls the route that already exists', () => {
    assert.match(DRAWER, /\{DRAWER_WORDS\.delete\}/)
    assert.match(DRAWER, /fetch\(`\/api\/topics\/\$\{topic\.id\}`, \{ method: 'DELETE'/)
  })

  test('the confirm sheet is the shared sheet, and the destructive button is the only red one', () => {
    assert.match(DRAWER, /from '@\/components\/Sheet'/)
    assert.match(DRAWER, /\{DRAWER_WORDS\.deleteConfirm\}/)
    // One red CONTROL. The colour appears twice on it — once for the border, once for the text —
    // so counting the colour counted the wrong thing; counting the button is the claim.
    assert.equal((DRAWER.match(/border-\[#B42318\]/g) ?? []).length, 1, 'exactly one red control')
  })

  test('a delete that failed says so, and says nothing was changed (§5.1)', () => {
    assert.match(wordIn(DRAWER, 'DRAWER_WORDS', 'deleteFailed', 'ConversationDrawer'), /Nothing was changed/)
    assert.match(DRAWER, /\{DRAWER_WORDS\.deleteFailed\}/)
  })

  /**
   * *** THE NOTE IS TRUE OF WHAT THE DATABASE DOES, which is why it is a test and not a comment. ***
   * Read from `pg_constraint` on staging: `checklists.from_topic_id`, `documents.from_topic_id` and
   * `fact_proposals.topic_id` are all ON DELETE SET NULL, so all three survive. `turns.topic_id` is
   * CASCADE, so the questions and answers do not. Migration 062 is why the facts stay.
   */
  test('the note names what stays, and what stays is what the foreign keys say', () => {
    const note = wordIn(DRAWER, 'DRAWER_WORDS', 'deleteNote', 'ConversationDrawer')
    for (const thing of ['documents', 'checklist', 'facts']) {
      assert.ok(note.includes(thing), `the note does not mention ${thing}`)
    }
    assert.match(wordIn(DRAWER, 'DRAWER_WORDS', 'deleteLede', 'ConversationDrawer'),
      /questions, the answers and the summary/)
    const m062 = readFileSync('supabase/migrations/062_a_fact_outlives_its_conversation.sql', 'utf8')
    assert.match(m062, /on delete set null/i, 'migration 062 is what makes the facts clause true')
  })

  test('it is not HR\'s sheet: HR keeps its own words, which mention handbooks', () => {
    assert.match(HR_WORDS, /Your handbooks and their checks stay/)
    // THE CODE WITHOUT ITS COMMENTS. The drawer's header quotes that sentence to explain why it is
    // NOT used — a substring is not a use (`calendarShell.test.ts:396`), and written without the
    // strip this failed on its own explanation.
    assert.ok(!code(DRAWER).includes('Your handbooks and their checks stay'),
      'a shared drawer must not say something only true of HR')
  })
})

describe('the sentences every chat says the same way live in one place', () => {
  test('they are exported, so one edit changes every section', () => {
    assert.equal(named(SCREEN, 'FAILED_ASK', 'AskScreen'), 'That answer could not be completed.')
    assert.equal(named(SCREEN, 'STOPPED_EARLY_TITLE', 'AskScreen'), 'This answer stopped early.')
    assert.match(named(SCREEN, 'STOPPED_EARLY_BODY', 'AskScreen'), /Nothing was saved for it\./)
    assert.equal(named(SCREEN, 'TRY_AGAIN', 'AskScreen'), 'Try again')
    // The one that is a function, so both halves of it are read off the source.
    assert.match(SCREEN, /Stopped\. \$\{hasText \? 'What arrived is above — ' : ''\}Ask again, or change the question\./)
  })

  test('and they are the sentences HR already shows, word for word', () => {
    const hr = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
    assert.ok(hr.includes(named(SCREEN, 'STOPPED_EARLY_TITLE', 'AskScreen')), 'HR says something else now')
    assert.ok(hr.includes('Ask again, or change the question.'), 'HR says something else now')
  })
})

describe('the lift is safe only because of these two rules', () => {
  test('TYPES ONLY from lib/ask — the engine behind it imports the model SDK', () => {
    for (const [name, src] of [['AskScreen', SCREEN], ['ConversationDrawer', DRAWER], ['CalendarAsk', CAL_ASK]] as const) {
      for (const m of code(src).matchAll(/^\s*import\s+(type\s+)?([^'";]*?)\s*from\s*['"](@\/lib\/ask\/[^'"]+)['"]/gm)) {
        assert.ok(m[1] || /^\{\s*type\s/.test(m[2]), `${name} imports a VALUE from ${m[3]}: ${m[0].trim()}`)
      }
    }
  })

  test('the Calendar\'s own part did not move: the offers are still its file, through the one writer', () => {
    assert.match(CAL_ASK, /method: 'POST'[\s\S]{0,400}source: 'rule'/)
    assert.ok(!/\.from\('calendar_events'\)/.test(CAL_ASK), 'it never touches the table')
    assert.ok(!/status: 'confirmed'/.test(CAL_ASK), 'it names no status — proposeDate decides that')
    // And the shared screen knows nothing about dates.
    assert.ok(!/calendarView|calendar_events|proposeDate/.test(code(SCREEN)),
      'the shared screen must not know what a date is')
  })
})

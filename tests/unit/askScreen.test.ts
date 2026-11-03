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
import { CLAIM_WORDS } from '../../lib/topicClaim.ts'
import { checklistHref } from '../../lib/checklistView.ts'
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
   * *** THE FIRST ACTION IS STILL A PROP, AND AT PART A STEP 5 TWO SECTIONS PASS IT. ***
   * A control that does nothing is a promise the product is not keeping (`CLAUDE.md` §5.1), so it
   * renders only where a section has somewhere for the result to go — which, by decision 8, is the
   * Compliance Workspace's Checklists tab. The default stays `false` so a section added later opts
   * in deliberately rather than inheriting a button.
   */
  test('the checklist action is gated, and the default is still off', () => {
    assert.match(SCREEN, /canMakeChecklist = false/, 'it must default to off')
    assert.match(SCREEN, /\{canMakeChecklist && \(/, 'and be rendered behind the gate')
  })

  test('the Calendar page turns it on, and hands over the hook\'s three pieces', () => {
    const page = code(PAGE)
    assert.match(page, /canMakeChecklist\n/, 'the Calendar page does not pass the gate')
    assert.match(page, /onMakeChecklist=\{conv\.makeChecklist\}/)
    assert.match(page, /checklistBusy=\{conv\.checklistRunning\(conv\.askTopicId\)\}/)
    assert.match(page, /checklistReadyId=\{conv\.checklistReady\?\.topicId === conv\.askTopicId \? conv\.checklistReady\.id : null\}/)
  })
})

/**
 * *** "TURN THIS INTO A CHECKLIST" FROM ANY CHAT — `docs/GAPS-PLAN.md` decision 8, Part A step 5. ***
 *
 * The machinery is the Workspace's, READ AND COPIED rather than written again, so these tests name
 * the thing each rule came from. The one that matters most is the last: a build that clears its
 * claim with nothing new must SAY so, or the claim word sits on screen for ever.
 */
describe('turn this into a checklist', () => {
  const HOOK = SCREEN.slice(SCREEN.indexOf('export function useAskConversations'))

  test('the button presses the hook, and says the claim word while it runs', () => {
    assert.match(SCREEN, /onClick=\{\(\) => \{ if \(topicId\) onMakeChecklist\?\.\(topicId\) \}\}/)
    assert.match(SCREEN, /\{checklistBusy \? ACTION_CHECKLISTING : ACTION_CHECKLIST\}/)
    // The claim word is the shared one, not a second copy of it.
    assert.match(SCREEN, /export const ACTION_CHECKLISTING = CLAIM_WORDS\.checklist/)
    assert.equal(CLAIM_WORDS.checklist, 'Checklist being built…')
  })

  test('…and it is disabled with no answer, while busy, and for a paused company', () => {
    assert.match(SCREEN, /disabled=\{busy \|\| checklistBusy \|\| !answered \|\| Boolean\(paused\)\}/)
  })

  test('ONE PRESS, ONE CALL: the Workspace\'s 202-or-409-building rule', () => {
    assert.match(HOOK, /scope: 'discussed'/)
    assert.match(HOOK, /res\.status === 202 \|\| \(res\.status === 409 && j\?\.status === 'building'\)/)
    assert.match(HOOK, /if \(checklistRunning\(id\)\) return/, 'a second press must not pay twice')
    // Anything else is a refusal with its own sentence, shown as it came.
    assert.match(HOOK, /setNotice\(j\?\.error \?\? CHECKLIST_FAILED\)/)
  })

  test('the route it posts to is the Workspace\'s own, and is section-blind', () => {
    assert.match(HOOK, /fetch\('\/api\/checklists\/from-topic'/)
    const route = readFileSync('app/api/checklists/from-topic/route.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/\.section/.test(route), 'the route reads a section — decision 8 would not hold')
  })

  test('the new checklist is told apart from one the conversation already had', () => {
    assert.match(HOOK, /const before = topics\.find\(\(t\) => t\.id === id\)\?\.checklistId \?\? null/)
    assert.match(HOOK, /row\.checklistId && row\.checklistId !== w\.before/)
  })

  test('ONE poll watches both the summary and the checklist, not two intervals', () => {
    assert.match(HOOK, /if \(!summaryWatching && !checklistWatching\) return/)
    assert.equal((HOOK.match(/setInterval\(/g) ?? []).length, 1, 'a second interval was added')
  })

  /** §5.1, and the failure this test exists for: a claim that clears with nothing new. */
  test('a build that produced nothing SAYS so rather than stopping quietly', () => {
    const half = HOOK.slice(HOOK.indexOf('setChecklistWait((w) => {'))
    assert.match(half, /if \(!row \|\| row\.checklistInProgress\) return w/)
    assert.match(half, /else setNotice\(CHECKLIST_FAILED\)/)
    assert.match(SCREEN, /Nothing was changed\. Please try again\./)
  })

  test('the ready line names where it went, and links to THAT checklist', () => {
    assert.equal(named(SCREEN, 'CHECKLIST_READY_BEFORE', 'AskScreen'), 'Your checklist is ready — ')
    assert.equal(named(SCREEN, 'CHECKLIST_READY_LINK', 'AskScreen'), 'open it in the Compliance Workspace')
    assert.match(SCREEN, /href=\{checklistHref\(checklistReadyId\)\}/)
    assert.equal(checklistHref('abc-123'), '/compliance?checklist=abc-123')
    // The address is built in ONE place, so the two callers cannot point at different ones.
    assert.match(readFileSync('components/ConversationList.tsx', 'utf8'), /checklistHref\(t\.checklistId\)/)
  })

  test('and the Workspace reads it — six lines, the only edit that file took', () => {
    const page = readFileSync('app/compliance/page.tsx', 'utf8')
    assert.match(page, /const checklistId = params\.get\('checklist'\)/)
    assert.match(page, /if \(checklistId\) \{ setTab\('checklists'\); void openChecklist\(checklistId\) \}/)
    assert.match(page, /if \(!ask && !documentId && !checklistId\) return/)
    // And it is still consumed, so a reload does not reopen a drawer somebody closed.
    assert.match(page, /window\.history\.replaceState\(\{\}, '', window\.location\.pathname\)/)
  })

  test('a new conversation clears the ready line', () => {
    const start = HOOK.slice(HOOK.indexOf('const startNewConversation'))
    assert.match(start, /setChecklistReady\(null\)/)
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

  /**
   * *** CHANGED BY PART A STEP 3: THE CALENDAR UPLOADS INSTEAD OF LINKING. *** This pinned the
   * inline `href` the page passed at step 2. The href is still there as the fallback a section
   * without an uploader would use, but the Calendar now gives `onPick`, and the screen prefers it.
   */
  test('the Calendar keeps `return=` and no `add=` on the link it falls back to', () => {
    const href = named(readFileSync('components/CalendarAsk.tsx', 'utf8'), 'CALENDAR_ATTACH_HREF', 'CalendarAsk')
    assert.equal(href, '/documents?return=%2Fcalendar%3Ftab%3Dask')
    // `add=` is Documents' hint line for WHAT to upload, and a chat does not know what the person
    // is about to add. Photographed with both at step 10b, it read "Add: 1".
    assert.ok(!href.includes('add='), 'the chat must not send an add= hint it cannot fill in')
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

describe('adding a document from inside the chat (Part A step 3, decision 6)', () => {
  test('the attach slot becomes a picker when a section gives onPick, and stays a link otherwise', () => {
    assert.match(SCREEN, /attach\.onPick \? \(/, 'onPick must choose the branch')
    assert.match(SCREEN, /<AttachControl label=\{uploading \? 'Adding…' : attach\.label\}\s*\n?\s*onClick=/)
    assert.match(SCREEN, /<AttachControl label=\{attach\.label\} href=\{attach\.href\} \/>/, 'the link branch stays')
    // AttachControl itself is untouched: one of the two handlers, never both, never neither.
    const control = readFileSync('components/AttachControl.tsx', 'utf8')
    assert.match(control, /\{ label, onClick, href, disabled \}/)
  })

  test('ONE FILE, NEVER A FOLDER — a folder cannot honestly say "wait here"', () => {
    // THE CODE WITHOUT ITS COMMENTS — for the third time this run, a comment that explains why a
    // thing is absent was read as the thing being present. A substring is not a call site.
    const c = code(SCREEN)
    assert.ok(!/webkitdirectory/i.test(c), 'a folder picker must not be in the chat')
    assert.ok(!/multiple/.test(c.slice(c.indexOf('type="file"'), c.indexOf('type="file"') + 200)),
      'the input takes one file')
    assert.match(SCREEN, /accept=\{ACCEPTED_FILE_TYPES\}/, 'and only the kinds we can read')
  })

  test('a picked file is a chip with a × , and it rides into the bubble with its question', () => {
    assert.match(SCREEN, /\{picked && \(/)
    assert.match(SCREEN, /aria-label=\{`Remove \$\{picked\.name\}`\}/)
    assert.match(SCREEN, /setPicked\(null\)/, 'the × takes it off before sending')
    // and the bubble keeps it, so a person can see which question the file went with (board 3).
    assert.match(SCREEN, /\{x\.file && \(/)
  })

  test('a file with no words still asks something, in the Workspace\'s own sentence', () => {
    const q = named(SCREEN, 'DEFAULT_FILE_QUESTION', 'AskScreen')
    assert.equal(q, 'Summarize what this document is, what it covers, and flag anything that looks off, expired, or missing.')
    // Word for word the Workspace's, so attaching a file means the same thing in both places.
    assert.ok(readFileSync('app/api/chat/route.ts', 'utf8').includes(q),
      'it must be the same sentence app/api/chat/route.ts:191 uses')
    assert.match(SCREEN, /question\.trim\(\) \|\| \(picked \? DEFAULT_FILE_QUESTION : ''\)/)
  })

  test('the question carries the document id, and only when a file went with it', () => {
    assert.match(SCREEN, /\.\.\.\(sent \? \{ documentId: sent\.id \} : \{\}\)/)
  })

  /**
   * *** THE READ-ONLY CASE IS TWO ANSWERS IN ONE MOMENT. *** The file IS saved — uploading calls no
   * model and no non-model write is gated — while the reading and the question are refused. A bare
   * 402 would read as "your file was lost", so what DID happen is said first.
   */
  test('when the company is read-only the upload still works and the screen says so', () => {
    const paused = named(SCREEN, 'PAUSED_FILE_SAVED', 'AskScreen')
    assert.match(paused, /saved in Documents/)
    assert.match(paused, /once you add a card/)
    assert.match(SCREEN, /res\.status === 402 && sent \? \{ savedNote: PAUSED_FILE_SAVED \}/)
    assert.match(SCREEN, /\{x\.savedNote && <p className="mb-1">\{x\.savedNote\}<\/p>\}/)
    // THE UPLOAD IS NOT DISABLED BY `paused` — the same rule readOnlyUi holds for the Documents
    // page. Only `uploading` disables it, so a read-only company can still put a file somewhere safe.
    assert.match(SCREEN, /onClick=\{\(\) => fileInput\.current\?\.click\(\)\} disabled=\{uploading\}/)
    assert.ok(!/disabled=\{uploading \|\| Boolean\(paused\)\}/.test(SCREEN),
      'a read-only company must still be able to save its own files')
  })

  test('and the Calendar now uploads in place instead of linking away', () => {
    assert.match(PAGE, /onPick: \(\) => \{ void refresh\(\) \}/)
    assert.match(PAGE, /label: CALENDAR_ATTACH_LABEL/)
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

/**
 * *** ONE LOOK BEFORE THE SEND — `docs/GAPS-PLAN.md` Part A step 6b, decision 37. ***
 *
 * The Audits box takes audit COMMANDS as well as questions, and which it is has to be decided in
 * code and never by a model. `ask()` is called from four places inside this file and there was
 * nowhere to get between the press and the fetch, so the screen gained one optional prop. The
 * whole value of it being optional is that three of the four sections do not pass it and behave
 * exactly as they did; these tests are what hold that true.
 */
describe('beforeAsk, and the three sections that pass none', () => {
  test('the prop is optional, and takes the question and this turn\'s file', () => {
    assert.match(SCREEN, /beforeAsk\?: \(question: string, file: \{ id: string; name: string \} \| null\) => Promise<'handled' \| 'ask'>/)
  })

  /**
   * *** IT RUNS BEFORE THE BOX IS CLEARED AND BEFORE ANYTHING IS SENT, and both matter. ***
   * Before the box: a section that refuses can leave the words where the person typed them.
   * Before the fetch: a handled command writes no turn and creates no conversation, which is
   * decision 39 and is the difference between a command and a question.
   */
  test('it is called at the top of ask(), before the box is cleared and before the fetch', () => {
    const fn = code(SCREEN).slice(code(SCREEN).indexOf('async function ask(question: string)'))
    const body = fn.slice(0, fn.indexOf('\n  const stop ='))
    const call = body.indexOf('await beforeAsk(')
    assert.ok(call > 0, 'beforeAsk is not called')
    assert.ok(call < body.indexOf("setBox('')"), 'the box is cleared before the section has looked')
    assert.ok(call < body.indexOf('await fetch('), 'the question is sent before the section has looked')
    // Edited 3 November 2026 (B0, decision 46): the handled arm now releases `busy` first,
    // because the look itself sets it. Everything else about this line is unchanged.
    assert.match(body, /if \(verdict === 'handled'\) \{ setBusy\(false\); setBox\(''\); setPicked\(null\); return \}/)
  })

  /**
   * *** THE SIX SECONDS OF NOTHING — the owner's walk, W3, 3 November 2026. ***
   *
   * `beforeAsk` can start an audit, which is a POST that spends six seconds extracting a
   * checklist's lines before it answers. Until this, `busy` was set ten lines further down and
   * only on an `'ask'` verdict, so for the whole of that the box kept the words, the button kept
   * saying Ask, and the guard at the top of `ask()` could not refuse a second press. The owner
   * pressed twice and bought two identical audits.
   */
  test('THE SCREEN IS BUSY WHILE THE SECTION LOOKS, so a second press is refused', () => {
    const fn = code(SCREEN).slice(code(SCREEN).indexOf('async function ask(question: string)'))
    const body = fn.slice(0, fn.indexOf('\n  const stop ='))
    const guard = body.indexOf('if (!q || busy)')
    const set = body.indexOf('setBusy(true)')
    const call = body.indexOf('await beforeAsk(')
    assert.ok(guard >= 0 && set > guard, 'the guard reads busy')
    assert.ok(set < call, 'busy must be set BEFORE the section is asked to look, not after')
  })

  test('the look releases busy on handled, keeps it on ask, and releases it on a throw', () => {
    const fn = code(SCREEN).slice(code(SCREEN).indexOf('async function ask(question: string)'))
    const hook = fn.slice(fn.indexOf('if (beforeAsk) {'), fn.indexOf("    setBox('')\n    const sent"))
    // handled: released, then the box and the chip are cleared, then nothing is sent.
    assert.match(hook, /if \(verdict === 'handled'\) \{ setBusy\(false\)/)
    // a throw: released and re-thrown, so the screen is never frozen with the words in it.
    assert.match(hook, /catch \(e\) \{[\s\S]*setBusy\(false\)[\s\S]*throw e/)
    // 'ask': NOT released here. One `setBusy(false)` for handled and one for the catch, no more —
    // a third would flicker the button back to Ask between the look and the request.
    assert.equal((hook.match(/setBusy\(false\)/g) ?? []).length, 2)
  })

  /**
   * A section that passes nothing must not reach any of it. `busy` is set inside the
   * `if (beforeAsk)` block, so the Calendar, Documents and HR's screens behave exactly as
   * before — which the free checks on those sections also say, and which this pins in the file.
   */
  test('a section passing no beforeAsk changes no state at that point', () => {
    const fn = code(SCREEN).slice(code(SCREEN).indexOf('async function ask(question: string)'))
    const body = fn.slice(0, fn.indexOf('\n  const stop ='))
    const open = body.indexOf('if (beforeAsk) {')
    const close = body.indexOf("    setBox('')\n    const sent")
    const before = body.slice(0, open)
    assert.ok(open > 0 && close > open)
    // Nothing between the top of ask() and the hook touches state.
    assert.equal(/set[A-Z]/.test(before), false,
      'something now runs before the hook that a section passing none would also run')
    // And the look's own `setBusy(true)` is INSIDE the hook, not above it — so a section that
    // passes nothing reaches the first `setBusy(true)` exactly where it always did, just before
    // the fetch. (The `setBusy(false)` after the hook is the fetch's own `finally`, unchanged.)
    assert.equal(/setBusy\(true\)/.test(before), false, 'busy is set before the hook is even tested')
    assert.match(body.slice(open, close), /setBusy\(true\)/)
  })

  test('a section that passes nothing behaves exactly as it did', () => {
    const fn = code(SCREEN).slice(code(SCREEN).indexOf('async function ask(question: string)'))
    assert.match(fn.slice(0, 900), /if \(beforeAsk\) \{/, 'the hook must be skipped entirely when absent')
  })

  /**
   * Read from the pages themselves, not from memory. Audits is the only caller; the Calendar
   * mounts the screen from its own page (`components/CalendarAsk.tsx` holds only its offers
   * since step 2), and Documents mounts it directly.
   */
  test('only the Audits page passes one', () => {
    const passes = (f: string) => /beforeAsk=/.test(readFileSync(f, 'utf8'))
    assert.equal(passes('app/audits/page.tsx'), true, 'Audits must pass the looker')
    for (const f of ['app/documents/page.tsx', 'app/calendar/page.tsx', 'components/CalendarAsk.tsx']) {
      assert.equal(passes(f), false, `${f} passes a beforeAsk — its behaviour has changed`)
    }
  })
})

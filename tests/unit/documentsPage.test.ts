/**
 * THE DOCUMENTS PAGE'S THREE TABS — `docs/GAPS-PLAN.md` Part A step 4b (decisions 5, 7, 13, 30).
 *
 * *** THE PAGE IS READ AS TEXT, because Node cannot import a `.tsx`. *** Every test here asserts
 * on source, which is the Calendar's way (`tests/unit/calendarShell.test.ts`) and is exactly as
 * strong as the thing it asserts: it can prove the tab row is written, the derivation is written
 * and the relation list is what it says — it cannot prove a click works. That is checkpoint 5's
 * walk on the isolated server, and it was done.
 *
 * COMMENTS ARE STRIPPED BEFORE ASSERTING. The house pattern, and it has caught four of my own
 * comments tripping my own tests across this programme.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DOCUMENTS_LEDE, DOCUMENTS_NOTHING_YET, DOCUMENTS_LINK_MISSED, DOCUMENTS_EMPTY_CONVERSATIONS,
  DOCUMENTS_EMPTY_CONVERSATIONS_TITLE, DOCUMENTS_READING_LINE, DOCUMENTS_ATTACH_LABEL,
  DOCUMENTS_COMPOSER_HINT, DOCUMENTS_ONE_TOPIC_LINE, documentsThinkingLine,
} from '../../lib/documentsWords.ts'
import { DOCUMENTS_EXAMPLE_QUESTIONS } from '../../config/examples.ts'
import { documentsBrief } from '../../lib/ask/documentsBrief.ts'

const RAW = readFileSync('app/documents/page.tsx', 'utf8')
/** The code without comments, so a comment naming a thing is not the thing. */
const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('THE THREE TABS, in the owner\'s order', () => {
  test('Ask a question · Conversations · Documents (N), and nothing else', () => {
    assert.match(CODE, /type Tab = 'ask' \| 'conversations' \| 'documents'/)
    assert.match(CODE, /const TAB_KEYS: readonly Tab\[\] = \['ask', 'conversations', 'documents'\]/)
    const row = CODE.slice(CODE.indexOf('<Tabs active={tab}'), CODE.indexOf('right={tab ==='))
    assert.ok(row.indexOf("label: 'Ask a question'") < row.indexOf("label: 'Conversations'"), 'Ask is first')
    assert.ok(row.indexOf("label: 'Conversations'") < row.indexOf('label: `Documents'), 'Documents is last')
  })

  test('an unknown tab word falls back to Ask rather than throwing', () => {
    assert.match(CODE, /const asTab = \(v: string \| null\): Tab =>\s*\n?\s*\(TAB_KEYS as readonly string\[\]\)\.includes\(v \?\? ''\) \? \(v as Tab\) : 'ask'/)
  })

  /**
   * *** THE COUNT'S RULE HAS TWO HALVES AND THE SECOND ONE IS THE EASY ONE TO FORGET. ***
   * Zero is hidden — and so is a count nobody has read yet. A tab that said "Documents (0)" for
   * half a second on every load would be the product stating a fact it had not checked
   * (`CLAUDE.md` §5.1: an empty state is a claim).
   */
  test('the count is hidden at zero AND while the read is in flight', () => {
    assert.match(CODE, /label: `Documents\$\{!loading && rows\.length > 0 \? ` \(\$\{rows\.length\}\)` : ''\}`/)
  })

  test('"+ New conversation" is on the two conversation tabs only', () => {
    assert.match(CODE, /right=\{tab === 'documents' \? null : \(/)
    assert.match(CODE, /onClick=\{startNewConversation\}/)
  })

  /**
   * It is a BUTTON and not a link, and that is React's own lint rule rather than a style choice:
   * it clears the open conversation, which is a state change, and an effect watching the address
   * for it is refused. The Calendar reached the same answer at its step 8a.
   */
  test('and it is a button, because it clears the conversation', () => {
    assert.match(CODE, /const startNewConversation = \(\) => \{\s*\n\s*conv\.startNewConversation\(\)\s*\n\s*selectTab\('ask'\)/)
  })

  test('the tab row is the shared component, not a hand-rolled row', () => {
    assert.match(CODE, /import \{ Tabs \} from '@\/components\/Tabs'/)
    // Tabs owns its own mb-5/mt-5 and hairline, so the page must not add a second one.
    assert.ok(!/<div className="no-print mb-5 mt-5/.test(CODE), 'the page drew its own tab row')
  })
})

describe('THE ADDRESS, and the tab a link lands on (decision 13)', () => {
  const derivation = CODE.slice(CODE.indexOf('const linkedDoc ='), CODE.indexOf('const [rows,'))

  test('?tab= is in the address, with replace and not push', () => {
    assert.match(CODE, /router\.replace\(`\/documents\$\{p\.toString\(\) \? `\?\$\{p\}` : ''\}`, \{ scroll: false \}\)/)
  })

  /** The default tab DELETES the key, so the plain `/documents` the sidebar links to stays plain. */
  test('the default tab leaves no ?tab=ask behind', () => {
    assert.match(CODE, /const selectTab = \(k: Tab\) => setParam\('tab', k === 'ask' \? null : k\)/)
  })

  test('add=, return= and document= each derive the DOCUMENTS tab', () => {
    assert.match(derivation, /\(addHint \|\| backTo \|\| linkedDoc\) \? 'documents' : null/)
  })

  test('…and ?tab= wins where it is given, and a bare /documents is Ask', () => {
    assert.match(derivation, /asTab\(searchParams\.get\('tab'\)\s*\n?\s*\?\?/)
  })

  test('the three parameters that already existed are still read', () => {
    for (const p of ["searchParams.get('add')", "searchParams.get('return')", "searchParams.get('document')"]) {
      assert.ok(CODE.includes(p), `${p} is not read`)
    }
  })
})

describe('?document= OPENS THAT REPORT, and a dead link says so (decision 30)', () => {
  test('a matching id opens the drawer, resolved against the rows already read', () => {
    assert.match(CODE, /if \(rows\.some\(\(r\) => r\.document_id === linkedDoc\)\) setOpenDoc\(linkedDoc\)/)
    // No second query: a drawer must not be able to show a document the list does not.
    assert.equal((CODE.match(/document_index_v/g) ?? []).length, 0, 'the page queries the view directly')
  })

  test('an id that matches nothing shows ONE plain line, and it is a true one', () => {
    assert.match(CODE, /const linkMissed = !loading && !!linkedDoc && !rows\.some\(/)
    assert.match(CODE, /\{linkMissed && \(/)
    assert.match(CODE, /\{DOCUMENTS_LINK_MISSED\}/)
    assert.equal(DOCUMENTS_LINK_MISSED, 'That document is not on file. It may have been deleted.')
    // It must not say WHICH of the three reasons — deleted, never existed, or another company's,
    // which is simply not in `rows` because RLS decided that (`CLAUDE.md` §3.6, 404-not-403).
    assert.ok(!/another company|not yours|does not exist/i.test(DOCUMENTS_LINK_MISSED))
  })

  /** It waits for the read. A line that said "not on file" before the list came back would be a
   *  claim about something nobody had looked at. */
  test('and it waits for the read before claiming anything', () => {
    assert.match(CODE, /if \(!linkedDoc \|\| loading\) return/)
  })

  test('THE REPORT DRAWER IS OUTSIDE THE TAB BODIES — what makes the link work at all', () => {
    const closes = CODE.indexOf('</>)}')
    const mount = CODE.indexOf('<DocumentReport')
    assert.ok(closes > 0 && mount > closes, 'the report drawer moved inside a tab body')
  })
})

describe('THE ASK TAB — boards 1, 1b, 2 and 3', () => {
  test('it is the shared screen, as this section', () => {
    assert.match(CODE, /<AskScreen\s*\n\s*key=\{conv\.askKey\}\s*\n\s*section="documents"/)
    assert.match(CODE, /endpoints=\{\{ answer: '\/api\/documents\/answer' \}\}/)
    assert.match(CODE, /summarisePath: \(id\) => `\/api\/documents\/topics\/\$\{id\}\/summarise`/)
  })

  test('its words and examples come from the owner\'s files, never typed here', () => {
    for (const name of ['DOCUMENTS_COMPOSER_HINT', 'DOCUMENTS_FIRST_VISIT_BUTTON',
      'DOCUMENTS_EMPTY_CONVERSATIONS', 'DOCUMENTS_ONE_TOPIC_LINE', 'DOCUMENTS_ATTACH_LABEL',
      'documentsThinkingLine']) {
      assert.ok(CODE.includes(name), `${name} is not used`)
    }
    assert.match(CODE, /examples=\{DOCUMENTS_EXAMPLE_QUESTIONS\}/)
    assert.equal(DOCUMENTS_EXAMPLE_QUESTIONS.length, 3)
    // The brief reads the same file, so the screen and the model's brief cannot disagree.
    assert.equal(documentsBrief.words.lede, DOCUMENTS_LEDE)
    assert.equal(documentsBrief.words.emptyConversations, DOCUMENTS_EMPTY_CONVERSATIONS)
    assert.equal(documentsBrief.words.attachLabel, DOCUMENTS_ATTACH_LABEL)
  })

  /** The thinking line is a CLAIM about what is being read, so it has to be true: this chat reads
   *  the stored readings and never the files (decision 14). */
  test('the thinking line says what is really being read', () => {
    assert.equal(DOCUMENTS_READING_LINE, 'Reading your documents…')
    assert.equal(documentsThinkingLine({ phase: 'thinking', searches: 0 } as never), DOCUMENTS_READING_LINE)
    assert.match(documentsThinkingLine({ phase: 'searching', searches: 2 } as never), /Looking it up \(2 searches\)/)
  })

  test('"Add a document" UPLOADS here and does not link to the page we are on', () => {
    assert.match(CODE, /attach=\{\{ label: DOCUMENTS_ATTACH_LABEL, onPick: \(\) => \{ void load\(\) \} \}\}/)
    const attach = CODE.slice(CODE.indexOf('attach={{'), CODE.indexOf('thinkingLine='))
    assert.ok(!/href:/.test(attach), 'a link to the page the person is standing on does nothing')
  })

  /** RE-POINTED AT PART A STEP 5: 4b said the button was step 5's; this is step 5. */
  test('no offers under an answer, and the checklist button is ON since step 5', () => {
    assert.match(CODE, /afterAnswer=\{undefined\}/)
    assert.deepEqual(documentsBrief.offers, [])
    assert.match(CODE, /canMakeChecklist\n/, 'decision 8 is wired here')
    assert.match(CODE, /onMakeChecklist=\{conv\.makeChecklist\}/)
    assert.match(CODE, /checklistBusy=\{conv\.checklistRunning\(conv\.askTopicId\)\}/)
  })

  /** BOARD 1b. An empty state is a message, and "nothing on file" is a claim that has to be true. */
  test('BOARD 1b: the zero-documents line, and it waits for the read', () => {
    assert.match(CODE, /\{!loading && rows\.length === 0 && \(/)
    assert.equal(DOCUMENTS_NOTHING_YET,
      "Nothing on file yet. Add files or a whole folder in the Documents tab, and ask about them once they're read.")
    // "Documents tab" switches tabs rather than reloading the page the person is on.
    assert.match(CODE, /onClick=\{\(\) => selectTab\('documents'\)\}/)
  })
})

describe('THE CONVERSATIONS TAB', () => {
  test('an empty state with the section\'s own words, or the shared list', () => {
    assert.match(CODE, /<Empty title=\{DOCUMENTS_EMPTY_CONVERSATIONS_TITLE\} note=\{DOCUMENTS_EMPTY_CONVERSATIONS\} \/>/)
    assert.equal(DOCUMENTS_EMPTY_CONVERSATIONS_TITLE, 'No conversations yet')
    assert.equal(DOCUMENTS_EMPTY_CONVERSATIONS,
      'Ask a question and the answer is kept here, with the documents it drew on.')
    assert.match(CODE, /<ConversationList topics=\{topics\}/)
  })

  test('the list is THIS section\'s conversations and no other\'s', () => {
    assert.match(CODE, /readTopicList\(supabase, 'documents'\)/)
    assert.ok(!/readTopicList\(supabase, '(hr|calendar|workspace)'\)/.test(CODE))
  })

  test('the shared drawer, with Delete and the workspace\'s report shape', () => {
    assert.match(CODE, /<ConversationDrawer/)
    assert.match(CODE, /notSummarisedLine=\{DOCUMENTS_NOT_SUMMARISED\}/)
    assert.match(CODE, /sourceShape=\{WEB_SOURCE as unknown as SourceShape/)
    assert.match(CODE, /onDeleted=\{\(\) => \{ conv\.setConvDrawer\(null\); void reloadTopics\(\) \}\}/)
  })
})

describe('THE DOCUMENTS TAB — today\'s page, with nothing moved', () => {
  test('everything that was on the page is inside the tab body', () => {
    const body = CODE.slice(CODE.indexOf("{tab === 'documents' && (<>"), CODE.indexOf('</>)}'))
    // `banner?.summary` went at E4 with decision 70: the receipt box is gone and the day group's
    // header says it in place. Everything else that was in the tab is still in the tab.
    for (const piece of ['setFolderMenuOpen', 'Group by', '<PausedNote banner={paused} />',
      '{error &&', 'Nothing here yet. Add a file']) {
      assert.ok(body.includes(piece), `${piece} is not inside the Documents tab`)
    }
  })

  /** The upload and the toolbar are unchanged, and `onFilesPicked` never moved. */
  test('the upload is byte-for-byte what it was, and is not gated', () => {
    assert.match(CODE, /async function onFilesPicked\(picked: FileList \| null\)/)
    assert.match(RAW, /uploaded and saved — `\s*\n?\s*\+ 'queued to be read\. Add a card to start reading them\.'/)
  })

  /**
   * *** THE TWO HIDDEN FILE INPUTS STAY OUTSIDE THE TAB BODIES. *** The chat's own uploader and
   * the toolbar's Add files both reach them through the same ref; inside a tab body they would be
   * unmounted whenever the person was on another tab, and the picker would silently do nothing.
   */
  test('the file inputs are outside the tab bodies, so both uploaders can reach them', () => {
    const firstTabBody = CODE.indexOf("{tab === 'ask' && (")
    assert.ok(CODE.indexOf('ref={fileInputRef}') < firstTabBody, 'the file input moved inside a tab')
    assert.ok(CODE.indexOf('ref={folderInputRef}') < firstTabBody, 'the folder input moved inside a tab')
  })

  test('STATUS_ORDER is untouched — the brief reads this array out of this file', () => {
    assert.match(CODE, /const STATUS_ORDER: string\[\] = \[\s*\n\s*'needs_work', 'expiring', 'expired', 'could_not_read', 'not_yet_read',\s*\n\s*'current', 'recorded', 'on_file',\s*\n\s*\]/)
  })

  /** The 10-second poll is NOT tab-conditional, on purpose: a scan that finishes while the person
   *  is asking a question must still land in the list. */
  test('the poll keeps running whichever tab is open', () => {
    const poll = CODE.slice(CODE.indexOf('if (inFlight === 0 || uploading) return'))
    assert.ok(!/tab ===/.test(poll.slice(0, 300)), 'the poll was made tab-conditional')
  })
})

describe('WHAT THIS PAGE READS, pinned the Calendar\'s way', () => {
  /**
   * *** THE LIST IS STATED AND PINNED, because a page's reads are its contract with RLS. ***
   * Two before step 4b, three after: the conversations are the one thing added, and they come
   * through `readTopicList`, which is the shared reader every section uses.
   */
  test('two of its own, plus topic_list_v through the shared reader', () => {
    const froms = [...CODE.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1])
    assert.deepEqual([...new Set(froms)].sort(), ['companies', 'profiles'],
      'the page named a table it did not name before step 4b')
    // The third is `topic_list_v`, and it is NOT read here: `readTopicList` reads it, which is
    // what HR, the Workspace and the Calendar all do. One reader of that view, not four.
    assert.match(CODE, /readTopicList\(supabase, 'documents'\)/)
    assert.ok(!CODE.includes("from('topic_list_v')"), 'the page reads the view directly')
  })

  test('ONE companies read, widened — never a second one', () => {
    assert.equal((CODE.match(/\.from\('companies'\)/g) ?? []).length, 1)
    assert.match(CODE, /const paused = pausedFromRow\(billing\)/)
  })

  /** The page writes nothing of its own: every write is a route it posts to. */
  test('no table write from the page itself', () => {
    for (const w of ['.insert(', '.upsert(']) {
      assert.ok(!CODE.includes(w), `${w} must not be on this page`)
    }
  })
})

describe('AND NOT A WORD OF ANOTHER SECTION', () => {
  test('no HR word, no handbook, no calendar wording anywhere on this page', () => {
    for (const word of ['handbook', 'Handbook', 'HR_PREVIEW', 'hrAnswer', 'Research this']) {
      assert.ok(!CODE.includes(word), `${word} is on the Documents page`)
    }
    assert.ok(!/readTopicList\(supabase, 'hr'\)/.test(CODE))
  })

  test('the lede follows the tab, and the table\'s own sentence is unchanged', () => {
    assert.match(CODE, /tab === 'documents'\s*\n?\s*\? 'Everything you hold, read and grouped by what it is — not by where you filed it\.'/)
    assert.match(CODE, /: DOCUMENTS_LEDE/)
    assert.match(DOCUMENTS_LEDE, /^Everything you hold, read\./)
  })

  test('and the chat\'s words are not written in this file', () => {
    // They live in lib/documentsWords.ts, which the brief reads too. One copy, both sides.
    assert.ok(!CODE.includes('Reading your documents'), 'the thinking line is typed into the page')
    assert.ok(!CODE.includes('Nothing on file yet.'), 'board 1b\'s line is typed into the page')
    assert.match(CODE, /from '@\/lib\/documentsWords'/)
    assert.equal(DOCUMENTS_COMPOSER_HINT, 'Ask about a document, or what is missing…')
    assert.match(DOCUMENTS_ONE_TOPIC_LINE, /^One topic per conversation\./)
  })
})

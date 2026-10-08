/**
 * HR STEP 11b — "ADD A HANDBOOK" ON THE ASK TAB (owner, 8 October). One add, called from both tabs; the person stays
 * on the Ask tab with what they typed; the new handbook's line follows its row and goes on the next send.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/hr/HrWorkspace.tsx', 'utf8')
const fn = (name: string) => page.slice(page.indexOf(`const ${name} = `), page.indexOf('\n  }\n', page.indexOf(`const ${name} = `)))

describe('the button, on both boxes, worded "Add a handbook"', () => {
  test('the first-visit box: left of "Research this", in the attach slot', () => {
    const first = page.slice(page.indexOf('{!started && ('), page.indexOf('The counts line'))
    assert.ok(first.indexOf("<AttachControl label=\"Add a handbook\" onClick={() => addHandbook('ask')}") > 0)
    assert.ok(first.indexOf("addHandbook('ask')") < first.indexOf('Research this'), 'left of Research this')
    assert.match(first, /justify-between/)
  })
  test('the docked box inside a conversation: left of the action row, present before any answer', () => {
    const docked = page.slice(page.indexOf('THE DOCKED COMPOSER'), page.indexOf('{!started && ('))
    const add = docked.indexOf("<AttachControl label=\"Add a handbook\" onClick={() => addHandbook('ask')}")
    assert.ok(add > 0)
    assert.ok(add < docked.indexOf("{topicId && exchanges.some((x) => x.phase === 'done') && (<>"), 'not behind the "an answer is done" condition')
  })
  test('not "Attach a file": the file is kept in Handbooks, not attached to one question', () => {
    assert.ok(!page.includes('Attach a file'))
  })
})

describe('ONE add, from both tabs', () => {
  test('both tabs call addHandbook, which runs the Handbooks tab\'s own picker, sheet and save', () => {
    assert.equal(page.split("addHandbook('handbooks')").length - 1, 1, 'the Handbooks tab')
    assert.equal(page.split("addHandbook('ask')").length - 1, 2, 'the two Ask boxes')
    assert.match(fn('addHandbook'), /pickFile\(null\)/)
    // The picker leads to the same chooser: the site sheet with two or more sites, else the same save.
    assert.match(fn('onFileChosen'), /if \(sites\.length >= 2\) \{ setPendingFile\(file\); return \}/)
    assert.equal((page.match(/fetch\('\/api\/handbooks', \{\s*method: 'POST'/g) ?? []).length, 1, 'one save path')
  })
  test('the typed text survives an add: nothing in the add touches the box or the tab', () => {
    for (const f of ['addHandbook', 'pickFile', 'onFileChosen', 'save', 'addFailed']) {
      assert.ok(!/setBox\(|setTab\(/.test(fn(f)), f)
    }
  })
  test('a failed add from the Ask tab shows the Handbooks tab\'s own sentence under the row', () => {
    assert.match(page, /const addFailed = \(words: string\) => \{ if \(addFrom\.current === 'ask' && !versionOf\.current\) setAskAddNotice\(words\); else setNotice\(words\) \}/)
    assert.equal((page.match(/addFailed\(SAVE_FAILED\)/g) ?? []).length, 3, 'every failure of the save goes through it')
    assert.match(page, /\{askAddNotice && <p className="mt-2 text-\[12px\] text-\[var\(--amber\)\]">\{askAddNotice\}<\/p>\}/)
  })
})

describe('the line under the row', () => {
  test('shows the new handbook with its row\'s own state words, and follows the row', () => {
    assert.match(fn('save'), /if \(!olderId && addFrom\.current === 'ask' && typeof json\?\.id === 'string'\) setAskAdded\(json\.id\)/)
    assert.match(page, /const askAddedRow = askAdded \? allHandbooks\.find\(\(x\) => x\.id === askAdded\) \?\? null : null/)
    assert.match(page, /\{stateWords\(askAddedRow\)\}/)
    assert.match(page, /\{stateWords\(h\)\}/, 'the Handbooks row draws the same words')
    assert.equal(page.split('{askAddLines}').length - 1, 2, 'under both boxes')
  })
  test('goes on the next send', () => {
    const ask = page.slice(page.indexOf('async function ask('), page.indexOf('async function ask(') + 400)
    assert.match(ask, /setAskAdded\(null\); setAskAddNotice\(null\)/)
  })
})

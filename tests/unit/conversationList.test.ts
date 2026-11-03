/**
 * THE CONVERSATIONS ROW — the one shared piece `docs/GAPS-PLAN.md` Part A step 5 was allowed to
 * change, and the change is small and its consequence is not.
 *
 * *** FOUR PAGES RENDER THIS ROW: the Compliance Workspace, HR, the Calendar and Documents. ***
 * Three of them are on the step's forbidden list, so every rule here is a rule about three
 * sections at once. That is why the file is read as text and pinned rather than trusted.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checklistHref } from '../../lib/checklistView.ts'
import { CLAIM_WORDS } from '../../lib/topicClaim.ts'

const RAW = readFileSync('components/ConversationList.tsx', 'utf8')
const CODE = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** Every page that renders it — read from the repository, not from memory. */
const RENDERERS = ['app/compliance/page.tsx', 'app/hr/HrWorkspace.tsx', 'app/calendar/page.tsx', 'app/documents/page.tsx']

describe('"Checklist n of N done" is a link to that checklist (decision 8)', () => {
  test('it links through the one shared address, never a string of its own', () => {
    assert.match(CODE, /href=\{checklistHref\(t\.checklistId\)\}/)
    assert.ok(!CODE.includes("'/compliance"), 'the address is typed into this file')
    assert.equal(checklistHref('abc-123'), '/compliance?checklist=abc-123')
  })

  test('the words are the words that were there before', () => {
    assert.match(CODE, /Checklist \{t\.checklistDone\} of \{t\.checklistTotal\} done/)
  })

  /** A build going on still says the claim word and is NOT a link — there is nothing to open. */
  test('while it is being built it is the claim word, and not a link', () => {
    assert.match(CODE, /if \(running\(t, 'checklist'\)\) parts\.push\(CLAIM_WORDS\.checklist\)/)
    assert.match(CODE, /else if \(t\.checklistId\) parts\.push\(/)
    assert.equal(CLAIM_WORDS.checklist, 'Checklist being built…')
  })

  /**
   * *** THE ROW AROUND IT OPENS THE CONVERSATION, so the link must stop the click there. ***
   * Without this, one click would open a conversation AND navigate, and whichever won would be a
   * surprise that differs by browser.
   */
  test('a click on the link does not also open the conversation', () => {
    assert.match(CODE, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/)
  })
})

describe('THE WRAPPER STOPPED BEING A BUTTON, and nothing a button gave was lost', () => {
  /**
   * An `<a>` inside a `<button>` is invalid HTML and the browser swallows the link's click, so
   * the link above could not work while the row was a button. The owner's yes, 2 November 2026,
   * as the one structural consequence.
   */
  test('it is a div with role=button, because a link may not live inside a button', () => {
    assert.match(CODE, /<div role="button" tabIndex=\{0\} onClick=\{\(\) => onOpen\(t\)\}/)
    assert.ok(!/<button onClick=\{\(\) => onOpen\(t\)\}/.test(CODE), 'the button wrapper is back')
  })

  test('Enter and Space open it, and Space does not scroll the page instead', () => {
    assert.match(CODE, /if \(e\.key === 'Enter' \|\| e\.key === ' '\) \{ e\.preventDefault\(\); onOpen\(t\) \}/)
  })

  test('and it still looks and sits exactly where it did', () => {
    assert.match(CODE, /className="min-w-0 flex-1 text-left"/)
    assert.match(CODE, /group -mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2\.5 transition-colors hover:bg-white/)
  })
})

describe('what this change means for the three sections that are not this step\'s', () => {
  test('all four pages still render it, and none of them passes anything new', () => {
    for (const f of RENDERERS) {
      const src = readFileSync(f, 'utf8')
      assert.match(src, /<ConversationList topics=/, `${f} no longer renders the list`)
    }
    // The component's props did not change, which is why three forbidden pages needed no edit.
    assert.match(CODE, /export function ConversationList\(\{ topics, running, onOpen \}/)
    assert.match(CODE, /export function ConversationRow\(\{ t, running, onOpen \}/)
  })

  /** HR passes `running={() => false}`, so HR never shows the claim word — the link is unaffected. */
  test('HR shows no claim word and still gets the link', () => {
    assert.match(readFileSync('app/hr/HrWorkspace.tsx', 'utf8'),
      /<ConversationList topics=\{topics\} running=\{\(\) => false\} onOpen=\{setConvDrawer\} \/>/)
  })

  test('the file imports nothing that would stop a client rendering it', () => {
    assert.match(CODE, /^'use client'$/m)
    for (const bad of ['lib/ai', 'lib/auth', 'lib/summaryReport', 'lib/requireAccess']) {
      assert.ok(!CODE.includes(bad), `${bad} must not be reachable from a shared row`)
    }
  })
})

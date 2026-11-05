/**
 * THE DOCUMENTS CHAT'S WORDS — every sentence its screens show, in one place.
 *
 * *** IT IS A SEPARATE FILE BECAUSE THE BRIEF'S `words` CANNOT BE READ BY A SCREEN, AND THAT IS
 * STRUCTURAL RATHER THAN TIDINESS. *** `lib/ask/brief.ts` has a `words` object with most of these
 * fields on it. But `app/documents/page.tsx` is `'use client'`, `lib/ask/documentsBrief.ts` imports
 * `lib/ask/engine.ts`, which imports `lib/ai.ts`, which imports the model SDK — and
 * `tests/unit/clientImports.test.ts` fails the build for any client file that reaches it. So a
 * page can never import its own brief. `docs/GAPS-PLAN.md` §8 recorded this as "a trap for whoever
 * writes the Documents brief", and this is the file that steps around it.
 *
 * *** AND THERE IS ONE COPY, NOT TWO. *** The Calendar's answer to the same problem was its words
 * in `components/CalendarAsk.tsx` AND a second set on `calendarBrief.words` — two copies that
 * match today and are free to drift tomorrow. `lib/ask/documentsBrief.ts` imports THIS file, so
 * the brief and the screen cannot disagree. Nothing here imports anything but a type, which is
 * what keeps it client-safe.
 *
 * Simple words and short sentences, and the owner reads them before they ship (`CLAUDE.md` §0).
 */
import type { Exchange } from '../components/AskScreen.ts'

/** Under the title, on every tab. What this section is, in one line. */
export const DOCUMENTS_LEDE =
  'Everything you hold, read. Ask what a document says, what is missing from it, or which '
  + 'documents cover something.'

/** The composer's placeholder, board 1. */
export const DOCUMENTS_COMPOSER_HINT = 'Ask about a document, or what is missing…'

/** The button under the empty box on a first visit. HR says "Research this"; this says "Ask". */
export const DOCUMENTS_FIRST_VISIT_BUTTON = 'Ask'

/** The line under the action row — HR's, word for word, and the Calendar's too. */
export const DOCUMENTS_ONE_TOPIC_LINE =
  'One topic per conversation. When you are done, summarise it. Start a new conversation for the next topic.'

/** The Conversations tab's empty state, and the drawer's line about what an answer keeps. */
export const DOCUMENTS_EMPTY_CONVERSATIONS =
  'Ask a question and the answer is kept here, with the documents it drew on.'

/** The Conversations tab's empty-state title. */
export const DOCUMENTS_EMPTY_CONVERSATIONS_TITLE = 'No conversations yet'

/** What the drawer says about a conversation nobody has summarised yet — the workspace's words. */
export const DOCUMENTS_NOT_SUMMARISED =
  'This conversation has not been summarised yet. Open it and press "Summarise this conversation" when you are done.'

/** The attach slot's label. It uploads in place (decision 6), so the href is only a fallback. */
export const DOCUMENTS_ATTACH_LABEL = 'Add a document'
/** Only drawn for a section with no uploader of its own. This page has one. */
export const DOCUMENTS_ATTACH_HREF = '/documents?tab=documents'

/**
 * *** BOARD 1b — NOTHING ON FILE YET (decision 7). ***
 *
 * One line under the box, and it goes the moment the company holds one document. It is a true
 * claim about an empty list, which is what `CLAUDE.md` §5.1 asks of an empty state: it does not
 * say the chat is broken, and it does not pretend there is something to ask about. "Documents tab"
 * is a control, not prose — the page makes it switch tabs.
 */
export const DOCUMENTS_NOTHING_YET_BEFORE = 'Nothing on file yet. Add files or a whole folder in the '
export const DOCUMENTS_NOTHING_YET_LINK = 'Documents tab'
export const DOCUMENTS_NOTHING_YET_AFTER = ", and ask about them once they're read."
/** The same sentence as one string, for the places that need it whole (tests, a report). */
export const DOCUMENTS_NOTHING_YET =
  `${DOCUMENTS_NOTHING_YET_BEFORE}${DOCUMENTS_NOTHING_YET_LINK}${DOCUMENTS_NOTHING_YET_AFTER}`

/**
 * *** A LINK THAT POINTED AT A DOCUMENT WE NO LONGER HAVE (decision 30, the Calendar's
 * `linkMissed`). ***
 *
 * `?document=<id>` can arrive from an answer's source card, from Company information's fact links,
 * from the batch email or from a bookmark, and the row can be gone: deleted, or another company's,
 * which simply is not in this page's rows because RLS decided that. **All of them say the same
 * thing and none of them says which** — telling a stranger that an id EXISTS but is not theirs is
 * the probe `CLAUDE.md` §3.6 answers 404 to.
 */
export const DOCUMENTS_LINK_MISSED = 'That document is not on file. It may have been deleted.'

/**
 * The grey line while an answer is on its way. A claim about what is being read, so the section
 * writes it — and it is true: the chat reads the stored readings, never the files
 * (`lib/ask/documentsBrief.ts`, decision 14).
 */
export const DOCUMENTS_READING_LINE = 'Reading your documents…'
export const DOCUMENTS_LOOKING_IT_UP = (searches: number) =>
  `Looking it up${searches > 1 ? ` (${searches} searches)` : ''}…`
export const documentsThinkingLine = (x: Exchange): string =>
  x.phase === 'searching' ? DOCUMENTS_LOOKING_IT_UP(x.searches) : DOCUMENTS_READING_LINE

/**
 * *** WHAT THE AUDITS CHAT'S "Add a folder first" LANDS ON — decision 69, 5 November 2026. ***
 *
 * `/documents?tab=documents&add=folder` opens this tab with the folder control focused. The
 * sentence is here and not on the Audits page because it is what DOCUMENTS says when somebody
 * arrives for a folder; the offer that sent them is `lib/auditsWords.ts`.
 *
 * It does not say "the picker is open", because it is not: a file dialog needs a real user
 * gesture and a `.click()` on mount is refused by the browser (`app/documents/page.tsx`).
 */
export const ADD_FOLDER_HINT = 'Add the folder for your audit — press "Add a folder".'

// ---------------------------------------------------------------------------
// THE DOCUMENT DRAWER — decisions 72 and 74, 5 November 2026 (the owner).
// ---------------------------------------------------------------------------

/**
 * *** THE DRAWER SPEAKS AS THE CUSTOMER'S OWN EMPLOYEE — decision 74, amended by the owner,
 * 5 November 2026. ***
 *
 * One voice, and never a word that puts the product on the other side of the table: no "ours",
 * no "our reading", no "CompliBoard says". The reading is this company's own work, written up.
 *
 * **The distinction that matters is kept, and it is two headings rather than a disclaimer:**
 * *Gaps read from the page* is what the document itself says, and *Notes · n things we noticed*
 * is what was worked out around it. That is the whole of it. The footer carries no honesty line
 * at all — the sentence that used to sit there (*"Quotes are word for word from the document and
 * anything we worked out is marked inferred"*) was the product explaining itself, and on a
 * scanned PDF it was also untrue (`PENDING.md` D3).
 *
 * **And "inferred" is not a word on a customer's screen** (decision 74): it is the kind of word
 * that tells somebody they are reading a machine. The count says "n things we noticed".
 */
export const DOC_CARD_SAYS = 'What it says'
export const DOC_CARD_GAPS = 'Gaps read from the page'
export const DOC_CARD_NOTES = 'Notes'
export const DOC_CARD_DATES = 'Dates this document sets'
export const DOC_CARD_WHAT = 'What this document is'
export const DOC_CARD_FACTS = 'Things we think are true about you'
export const DOC_CARD_CONDITIONS = 'Conditions to keep'
export const DOC_CARD_VERSIONS = 'Versions'

/** "2 things we noticed" — on the Notes header, so a folded card still says what is in it. */
export const notesNoticed = (n: number) => `${n} thing${n === 1 ? '' : 's'} we noticed`

/** "4 — please confirm on Company information →" */
export const CONFIRM_ON_COMPANY = 'please confirm on Company information →'
export const factsWaiting = (n: number) => `${n} — ${CONFIRM_ON_COMPANY}`

/** "4, two overdue · on your calendar" — the dates card's one line. */
export function datesSummary(total: number, overdue: number, onCalendar: number): string {
  const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
  const over = overdue > 0 ? `, ${words[overdue - 1] ?? overdue} overdue` : ''
  return `${total}${over}${onCalendar > 0 ? ' · on your calendar' : ''}`
}

/** "Record · OSHA · Company-wide · Oregon · federal — not right? change it" */
export const CHANGE_WHAT_THIS_IS = 'not right? change it'
export const whatItIsSummary = (parts: Array<string | null>) =>
  `${parts.filter(Boolean).join(' · ')} — ${CHANGE_WHAT_THIS_IS}`

/**
 * *** THE ONE NOTE A SCANNED PDF CARRIES — PENDING D3, closed at E4, 5 November 2026. ***
 *
 * A photographed or scanned PDF yields no text, so `verifyQuote` returns null and nothing in the
 * reading was ever checked against the file — while the drawer's old last line said *"Quotes are
 * word for word from the document"*, unqualified, on exactly those documents. The claim is gone
 * (decision 74) and this is said where it belongs: under the title, on the one kind of document
 * it is true of. Read on staging: **10 of 47 current readings have no extracted text, and all 10
 * have `quotes_checked = 0`** — which is what the two together mean.
 */
export const SCANNED_PAGES = 'These pages are a scan, so the quotes could not be checked against the file.'

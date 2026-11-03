/**
 * THE AUDITS CHAT'S WORDS — every sentence its screens show, in one place.
 * `docs/GAPS-PLAN.md` Part A step 6a (decisions 31–34, 39, 41).
 *
 * *** IT IS A SEPARATE FILE FOR THE REASON `lib/documentsWords.ts` IS, AND THE REASON IS
 * STRUCTURAL. *** `lib/ask/brief.ts` has a `words` object, and no screen can ever read it:
 * `app/audits/page.tsx` is `'use client'`, a brief imports `lib/ask/engine.ts`, which imports
 * `lib/ai.ts`, and `tests/unit/clientImports.test.ts` fails the build for any client file that
 * reaches it. So a page can never import its own brief.
 *
 * *** ONE COPY, NOT TWO. *** `lib/ask/auditsBrief.ts` imports THIS file, so the brief and the
 * screen cannot say two different things. The Calendar keeps two sets and they are free to drift;
 * Documents keeps one, and so does this.
 *
 * Nothing here imports anything but a type, which is what keeps it client-safe.
 *
 * Simple words and short sentences, and the owner reads them before they ship (`CLAUDE.md` §0).
 */
import type { Exchange } from '../components/AskScreen.ts'

/**
 * Under the title, on every tab — **today's page lede, unchanged**
 * (`app/audits/page.tsx:596`–`:599`). The boards print the same sentence on all five boards, so
 * the words are not new and are not being re-litigated here; they move into this file so the
 * brief and the page read one copy.
 */
export const AUDITS_LEDE =
  'Where you stand with each agency, from the documents you have given us. Every line points '
  + 'at a document, or at something we do not see.'

/** The composer's placeholder — boards 2 and 3, the owner's words. */
export const AUDITS_COMPOSER_HINT = 'Ask a question, or tell us what to audit…'

/** The button under the empty box on a first visit. HR says "Research this"; this says "Ask". */
export const AUDITS_FIRST_VISIT_BUTTON = 'Ask'

/** The line under the action row — HR's, word for word, and the Calendar's and Documents' too. */
export const AUDITS_ONE_TOPIC_LINE =
  'One topic per conversation. When you are done, summarise it. Start a new conversation for the next topic.'

/**
 * The Conversations tab's empty state. Board 5's note says what the list is for: *"Only Audits'
 * own conversations show; an audit run is not a conversation and lives on the Audits tab."*
 */
export const AUDITS_EMPTY_CONVERSATIONS =
  'Ask a question and the answer is kept here, with the audits and documents it drew on.'

/** The Conversations tab's empty-state title. */
export const AUDITS_EMPTY_CONVERSATIONS_TITLE = 'No conversations yet'

/** What the drawer says about a conversation nobody has summarised yet — the workspace's words. */
export const AUDITS_NOT_SUMMARISED =
  'This conversation has not been summarised yet. Open it and press "Summarise this conversation" when you are done.'

/**
 * *** THE PAPERCLIP — DECISION 33, THE OWNER'S WORDS, 3 NOVEMBER 2026. ***
 * The shared control (`components/AttachControl.tsx`) takes its label as a prop, so Audits needs
 * no change to it. A file attached here is **the template** when the words are an audit command
 * and **context for the answer** when they are a question.
 */
export const AUDITS_ATTACH_LABEL = 'Attach a template or checklist from your auditor'
/** Only drawn for a section with no uploader of its own. This page will have one (step 6b). */
export const AUDITS_ATTACH_HREF = '/documents?tab=documents'

/**
 * *** WHAT A COMMAND WRITES UNDER THE QUESTION — DECISION 39, THE OWNER'S WORDS. ***
 *
 * A command is answered by CODE and no model is called, so the thread would otherwise show a
 * question with nothing under it. These two lines are what goes there. **There is no email
 * promise in them**: the owner struck it, because the audit email is sent by
 * `lib/auditNotify.ts` only for the runs that route notifies, and a chat line promising one is a
 * promise this code does not keep (`CLAUDE.md` §5.1).
 *
 * "Audits tab" is a control, not prose — step 6b makes it switch tabs rather than link, because
 * the person is already on the page.
 */
export const AUDITS_COMMAND_AGENCY_BEFORE = 'Starting the '
export const AUDITS_COMMAND_AGENCY_AFTER = ' audit. It is on the '
export const AUDITS_COMMAND_TAB_LINK = 'Audits tab'
export const AUDITS_COMMAND_END = '.'
/** The whole sentence, for a test and for a report that must quote it. */
export const auditsCommandAgencyLine = (agency: string): string =>
  `${AUDITS_COMMAND_AGENCY_BEFORE}${agency}${AUDITS_COMMAND_AGENCY_AFTER}${AUDITS_COMMAND_TAB_LINK}${AUDITS_COMMAND_END}`
/** "Auditing against <file> — 16 lines in 3 sections. It is on the Audits tab." */
export const auditsCommandTemplateLine = (fileName: string, lines: number, sections: number): string =>
  `Auditing against ${fileName} — ${lines} line${lines === 1 ? '' : 's'} in `
  + `${sections} section${sections === 1 ? '' : 's'}. It is on the ${AUDITS_COMMAND_TAB_LINK}.`

/**
 * *** THE ONE OFFER'S CARD — DECISION 41, THE OWNER'S, 3 NOVEMBER 2026. ***
 *
 * The model PROPOSES and the press starts the run in code, with the same checks the box uses
 * (`lib/audit.ts` `auditAgenciesFor`). An agency the company does not hold is refused in code and
 * never trusted from the model, which is why `checkRunAuditOffer` in `lib/ask/auditsBrief.ts`
 * exists and why these are only the words.
 */
export const runAuditCardWords = (what: { agency: string | null; fileName: string | null }): string => {
  if (what.fileName) return `Do you want me to audit against ${what.fileName}?`
  if (what.agency === 'all') return 'Do you want me to audit against every agency?'
  return `Do you want me to run the ${what.agency} audit?`
}

/**
 * A LINK THAT POINTED AT AN AUDIT WE NO LONGER HAVE — Documents' `DOCUMENTS_LINK_MISSED`, applied
 * to `?run=`. Deleted, or another company's, which simply is not in this page's rows because RLS
 * decided that: both say the same thing and neither says which (`CLAUDE.md` §3.6, 404-not-403).
 */
export const AUDITS_LINK_MISSED = 'That audit is not on file. It may have been deleted.'

/**
 * The grey line while an answer is on its way. A claim about what is being read, so the section
 * writes it — and it is true: this chat is given the audits, their findings and the stored
 * readings, never the files (`lib/ask/auditsBrief.ts`).
 */
export const AUDITS_READING_LINE = 'Reading your audits…'
export const AUDITS_LOOKING_IT_UP = (searches: number) =>
  `Looking it up${searches > 1 ? ` (${searches} searches)` : ''}…`
export const auditsThinkingLine = (x: Exchange): string =>
  x.phase === 'searching' ? AUDITS_LOOKING_IT_UP(x.searches) : AUDITS_READING_LINE

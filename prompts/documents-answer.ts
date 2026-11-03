/**
 * THE DOCUMENTS CHAT — its sentences after the shared prompt. `docs/GAPS-PLAN.md` Part A step 4a
 * (decisions 3b and 14).
 *
 * *** EVERYTHING HERE IS A QUALITY CHANGE (`CLAUDE.md` §3.1) AND WAITS FOR THE OWNER'S YES. ***
 * Nothing has been run against a model with these sentences. They are drafted, quoted in full in
 * the step 4a report, and 4b does not start until he has read them.
 *
 * The shared half — how to cite, which sources to prefer, how to research — is the workspace's own
 * prompt and is not restated (`prompts/ask.ts`). These sentences say five things and no more:
 * what this chat is given, which document a claim comes from, what to say when something is not
 * on file, what to say when a reading is older than the document, and how to handle a file whose
 * words we cannot read.
 *
 * *** THERE IS NO OFFER SENTENCE, and that is deliberate. *** The Calendar's chat can offer to add
 * a date because `proposeDate` is one writer with one meaning. What a Documents chat could offer —
 * make a checklist, draft a missing section, confirm a fact — are three different writers, and
 * which of them a chat may reach is a decision for the owner, not a sentence written here. The
 * brief's `offers` is `[]`, so `parseOffers` drops any block the model writes anyway.
 */

/** What it is given, and the order to answer in — decision 14: the readings, never the files. */
export const DOCUMENTS_GIVEN =
  'You are given a list of every document this company holds — what each one is, its state, and '
  + 'the date that matters — and the full reading of the documents the question is about. Answer '
  + 'from those readings. You are not given the files themselves, except a file the person has '
  + 'attached to this conversation, which is in the message.'

/** Say which document, every time. The whole product rests on a claim pointing at a document. */
export const DOCUMENTS_WHICH_ONE =
  'Name the document each thing you say comes from, as the person would see it in their list. If '
  + 'two documents disagree, say so and name both rather than choosing one.'

/** Not on file: the sentence that must never become a guess (decision 30, the standing rule). */
export const DOCUMENTS_NOT_ON_FILE =
  'If the question is about a document that is not in the list, say plainly that it is not on '
  + 'file. Do not say what it would contain, and do not imply the company has failed to keep it. '
  + 'Say what they could add, if there is something.'

/** A reading can be older than the document it read. Saying so is the honest half of a report. */
export const DOCUMENTS_OLD_READING =
  'Each reading has a date. If a document has been changed or re-filed since we read it, say that '
  + 'the answer is based on the older reading and may be out of date.'

/**
 * DECISION 3b. A scanned PDF is a photograph of a page: the model can read it, and nothing
 * downstream can check a quote against it, because there is no text to check against
 * (`PENDING.md` D3, `lib/documentContent.ts:64`). Rather than let the check mark a true quote as
 * not found, the model is asked not to quote at all from such a file.
 */
export const DOCUMENTS_NO_TEXT =
  'Some attached files are pictures of pages, with no words we can read back. For those, say what '
  + 'the file shows in your own words and do not quote from it.'

/** The product's words. The standing ban on "AI" and on calling anybody compliant. */
export const DOCUMENTS_WORDS =
  'Never say "AI", and never call this company or anything it holds compliant or non-compliant: '
  + 'say what a rule asks for and what the documents show. A gap is something a document is '
  + 'missing, not something the person did wrong. This is not legal advice and you do not say '
  + 'that it is.'

/** How to answer, so a person can act on it. Short sentences; the thing that matters first. */
export const DOCUMENTS_SHAPE =
  'Put the thing that matters most first. Use short sentences and plain words. If the answer is a '
  + 'list of documents, give the list and nothing else.'

/** Decision 30, the standing rule, applied to this chat. */
export const DOCUMENTS_UNSURE =
  'Where you do not know something, say so in one clear, polite sentence and ask the one question '
  + 'that would settle it. Never present a guess as something we read.'

/** The sentences, in the order they are added after the shared prompt. Eight, and no more. */
export const DOCUMENTS_SENTENCES: string[] = [
  DOCUMENTS_GIVEN,
  DOCUMENTS_WHICH_ONE,
  DOCUMENTS_NOT_ON_FILE,
  DOCUMENTS_OLD_READING,
  DOCUMENTS_NO_TEXT,
  DOCUMENTS_WORDS,
  DOCUMENTS_SHAPE,
  DOCUMENTS_UNSURE,
]

/**
 * THE DOCUMENTS CHAT — its sentences after the shared prompt. `docs/GAPS-PLAN.md` Part A step 4a
 * (decisions 3b and 14).
 *
 * *** EVERYTHING HERE IS A QUALITY CHANGE (`CLAUDE.md` §3.1) AND WAITS FOR THE OWNER'S YES. ***
 * Drafted at step 4a and quoted in full in its report; **measured at step 4a-test** on
 * `claude-sonnet-5-5` against Cascade's real readings, with and without everything this file and
 * `lib/ask/documentsBrief.ts` give the model (`scripts/probe-documents-answer.mjs`,
 * `tests/golden/documents/chat/`). 4b does not start until the owner has read the two sides.
 *
 * The shared half — how to cite, which sources to prefer, how to research — is the workspace's own
 * prompt and is not restated (`prompts/ask.ts`). These sentences say eight things and no more:
 * what this chat is given, which document a claim comes from, what to say when something is not
 * on file, what to say when a reading is older than the document, how to handle a file whose
 * words we cannot read, the product's own words, how to answer, and when to ask instead of guess.
 *
 * *** AND THREE THE CALENDAR PAID FOR, ADAPTED (4a-test checkpoint 1a). *** `DOCUMENTS_IDS`,
 * `DOCUMENTS_RULE_NUMBERS` and `DOCUMENTS_SEARCH_FIRST` are `prompts/calendar-answer.ts`'s
 * `CALENDAR_IDS`, `CALENDAR_RULE_NUMBERS` and `CALENDAR_SEARCH_FIRST` with this section's handles
 * in them. Each was written after a REAL RUN went wrong — an answer that wrote "dates C6 and C7"
 * at a person, a rule number given from memory with `searches=0` in the ledger, and the one
 * sentence the person was owed written before the first search and therefore withdrawn by
 * `lib/ai.ts`. The failures are the engine's, not the Calendar's, so the lessons are too.
 *
 * *** THERE IS NO OFFER SENTENCE, and that is deliberate. *** The Calendar's chat can offer to add
 * a date because `proposeDate` is one writer with one meaning. What a Documents chat could offer —
 * make a checklist, draft a missing section, confirm a fact — are three different writers, and
 * which of them a chat may reach is a decision for the owner, not a sentence written here. The
 * brief's `offers` is `[]`, so `parseOffers` drops any block the model writes anyway.
 */

/**
 * What it is given, and the order to answer in — decision 14: the readings, never the files.
 *
 * *** THE QUOTING CLAUSE IS THE CALENDAR'S, ADDED AFTER 36 MEASURED RUNS PRODUCED ONE SOURCE. ***
 * `CALENDAR_GIVEN` ends with it and this sentence did not. A quote of six words or more is the
 * only thing `lib/ask/passages.ts` can verify, and a verified quote is the only thing that becomes
 * a card — so without it an answer has nothing the person can click and nothing the code can
 * check. Measured 2 November 2026 on Sonnet 5.5 and again on Opus 5.5, which produced none at all.
 */
export const DOCUMENTS_GIVEN =
  'You are given a list of every document this company holds — what each one is, its state, and '
  + 'the date that matters — and the full reading of the documents the question is about. You are '
  + 'not given the files themselves, except a file the person has attached to this conversation, '
  + 'which is in the message. Answer from those readings, and quote the line you read something '
  + 'from when the exact words matter, so the person can open the document and see it.'

/** Say which document, every time. The whole product rests on a claim pointing at a document. */
export const DOCUMENTS_WHICH_ONE =
  'Name the document each thing you say comes from, as the person would see it in their list. If '
  + 'two documents disagree, say so and name both rather than choosing one.'

/**
 * *** A NAME IS NOT A QUOTE — the owner's yes, 2 November 2026 (step 4a-test). ***
 *
 * `DOCUMENTS_WHICH_ONE` asks the model to name the document, and in 6 of 36 measured runs it did
 * so by putting the title in quotation marks. The plain-quote check treats six words in quotation
 * marks as a quote to verify (`lib/ask/passages.ts` `PLAIN_QUOTE`), could not find it, and the
 * product told the person *"we could not find these words in what we have on file"* about the
 * title of a document sitting in their own list. It happened with the Documents context and
 * without it, so it is the engine's shape and not this section's data.
 *
 * Two halves, and this is the first: the model stops writing a name as a quote. The second is in
 * `lib/ask/documentsBrief.ts` — an index line became quotable, so a title in quotation marks now
 * matches and becomes a card instead of a warning.
 */
export const DOCUMENTS_PLAIN_NAME =
  'Write a document\'s name in plain words, never inside quotation marks. Quotation marks are '
  + 'only for words you read inside a document.'

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

/**
 * *** THE INDEX SAYS "Queued" ABOUT A FILE THAT IS IN THE MESSAGE — found by walking step 4b on
 * Haiku, and the owner's yes. ***
 *
 * A person attaches a file and asks about it. The engine carries the whole PDF (`check_record`:
 * `attached_passages: 1`), AND the file is a brand-new row in the index, where its state reads
 * **Queued** — the reading is fire-and-forget and has not finished. The answer opened: *"I can see
 * the file you've attached is not yet readable in my system — it shows as 'Queued' in the document
 * list."* The plumbing was right and the sentence was wrong, and the person was told we could not
 * read a file we were reading.
 */
export const DOCUMENTS_QUEUED =
  'A file attached to this conversation is in the message and you can read it. Its line in the '
  + 'list may still say Queued; that says nothing about whether you can read it.'

/** The product's words. The standing ban on "AI" and on calling anybody compliant. */
export const DOCUMENTS_WORDS =
  'Never say "AI", and never call this company or anything it holds compliant or non-compliant: '
  + 'say what a rule asks for and what the documents show. A gap is something a document is '
  + 'missing, not something the person did wrong. This is not legal advice and you do not say '
  + 'that it is.'

/**
 * THE IDS ARE FOR MARKERS, NOT FOR SENTENCES — `prompts/calendar-answer.ts` `CALENDAR_IDS`, whose
 * first real run wrote *"we have this on your calendar as dates C6 and C7"* at a person. The code
 * replaces a bare id with the thing it names (`lib/ask/passages.ts` `replacePassageIds`); this
 * stops it being written at all. This chat's handles are I (a line in the list), R (a reading) and
 * A (a file attached to this conversation).
 */
export const DOCUMENTS_IDS =
  'The ids in what you are given (I3, R1, A1) are handles for citing a passage inside square '
  + 'brackets. Never write one in a sentence: name the document by its title instead, as the '
  + 'person would see it in their list.'

/**
 * A RULE NUMBER IS A CLAIM — `CALENDAR_RULE_NUMBERS`, written after a run that gave *"NFPA 10
 * Section 7.1"* with **no search performed at all** (`searches=0` in the ledger). Nothing in the
 * check can catch it: a rule number is neither a quote nor a link. `CLAUDE.md` §3.3 is the
 * standing rule it offends. It matters more here than anywhere, because a gap in a reading
 * already carries a `Rule:` line and the model will be tempted to number the ones that do not.
 */
export const DOCUMENTS_RULE_NUMBERS =
  'If you name a regulation, a standard or a section number, either cite a page your search '
  + 'returned in this answer or say which of the documents in front of you you are reading it '
  + 'from. Do not give a rule number from memory; if you are not sure of one, describe what the '
  + 'rule asks for without numbering it.'

/**
 * SEARCH FIRST, THEN WRITE — and it is a measured loss, not a style preference. `lib/ai.ts`
 * withdraws everything written before the FIRST web search, on the evidence of five recorded
 * sequences where that text was the model saying what it was about to do. In a Calendar run the
 * model wrote the one sentence the person was owed and THEN searched, so the rule withdrew it.
 * The sentence this chat owes — *"that is not on file"* — would be lost the same way.
 */
export const DOCUMENTS_SEARCH_FIRST =
  'If you are going to search, search before you begin the answer. Anything you write before your '
  + 'first search is treated as thinking aloud and is not shown to anyone, so never put part of '
  + 'the answer there.'

/** How to answer, so a person can act on it. Short sentences; the thing that matters first. */
export const DOCUMENTS_SHAPE =
  'Put the thing that matters most first. Use short sentences and plain words. If the answer is a '
  + 'list of documents, give the list and nothing else.'

/**
 * *** IT OFFERED IN PROSE IN 18 OF 36 RUNS, AND THERE IS NO BUTTON — the owner's decision,
 * 2 November 2026 (step 4a-test). ***
 *
 * *"I can draft a short service request to Rose City Fire Protection"*, *"Want me to write it?"*.
 * `offers` is `[]`, so `parseOffers` drops any fenced block the model writes — that part works as
 * designed. A sentence is not a block: it reaches the person, who says yes to nothing. A promise
 * the product cannot keep is the failure `CLAUDE.md` §5.1 is about, and the honest version is to
 * say what THEY could do.
 */
export const DOCUMENTS_NO_OFFERS =
  'Do not offer to do things for the person. Say what they could do next.'

/** Decision 30, the standing rule, applied to this chat. */
export const DOCUMENTS_UNSURE =
  'Where you do not know something, say so in one clear, polite sentence and ask the one question '
  + 'that would settle it. Never present a guess as something we read.'

/**
 * The sentences, in the order they are added after the shared prompt. **Fourteen**, and no more.
 * The order is the Calendar's: what it is given, how to name a document, what to say when the
 * thing asked about is not there, then the words, then the three honesty rules, then the shape,
 * then what not to promise, then the unsure line.
 *
 * Eight at step 4a, eleven at 4a-test (the Calendar's three honesty sentences), thirteen at 4b,
 * fourteen at step 5 — and the last three were bought by measurement rather than written from
 * taste: a title marked as an unfindable quote, an offer with no button behind it, and a file we
 * were reading that the answer said we could not read.
 */
export const DOCUMENTS_SENTENCES: string[] = [
  DOCUMENTS_GIVEN,
  DOCUMENTS_WHICH_ONE,
  DOCUMENTS_PLAIN_NAME,
  DOCUMENTS_NOT_ON_FILE,
  DOCUMENTS_OLD_READING,
  DOCUMENTS_NO_TEXT,
  DOCUMENTS_QUEUED,
  DOCUMENTS_WORDS,
  DOCUMENTS_IDS,
  DOCUMENTS_RULE_NUMBERS,
  DOCUMENTS_SEARCH_FIRST,
  DOCUMENTS_SHAPE,
  DOCUMENTS_NO_OFFERS,
  DOCUMENTS_UNSURE,
]

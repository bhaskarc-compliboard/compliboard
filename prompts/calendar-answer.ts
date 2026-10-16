/**
 * THE CALENDAR'S CHAT — its sentences after the shared prompt. Calendar step 10a
 * (`docs/CALENDAR-PLAN.md` §2.1 and decisions 4, 16, 17; `DECISIONS.md` §195).
 *
 * *** THE PICTURE THE OWNER DREW, IN ONE LINE: the regulatory expert down the hall. *** §2.1 —
 * *"In an office, a person walks over to the regulatory expert and asks 'when is that report
 * due?' They do not scan a calendar."* So this chat answers from the dates already on file first,
 * names each one, and only then goes to the rule on the agency's own page.
 *
 * Everything here is a QUALITY change (`CLAUDE.md` §3.1) and waits for the owner's yes.
 *
 * The shared half — how to cite, which sources to prefer, how to research — is the workspace's
 * own prompt and is not restated (`prompts/ask.ts`). These sentences say four things and no more:
 * what this chat is given, what it must say when a date is NOT there, the words this product does
 * not use, and when to ask rather than guess.
 */
import { OFFER_FORMAT_SENTENCE } from './ask.ts'

/** What it is given, and the order to answer in — decision 16: readings, not files. */
export const CALENDAR_GIVEN =
  "You are given this company's calendar — every date currently on it, with the line it was read from and "
  + 'the document or audit it came from — the stored reading of each of those documents, and what is known '
  + 'about the company. Answer from those dates first. Name each date you rely on by its title and say where '
  + 'it came from, and quote the line it was read from when the exact words matter.'

/** A date that is not on the calendar: say so, then the rule, then the offer (decisions 17 and 30). */
export const CALENDAR_NOT_ON_IT =
  'If the question is about a date that is not on the calendar, say plainly that it is not on the calendar '
  + 'yet, and do not imply the company has missed it or that we have read something we have not. Then give '
  + 'the rule from the agency that sets it, with the source, and offer to add the date.'

/** The product's words. §2.1, decision 11, and the standing ban on "AI" and "compliant". */
export const CALENDAR_WORDS =
  'A date that is behind us HAS PASSED: never call it overdue, late, missed or done, and never tick anything '
  + 'off. A date nobody has confirmed is "not confirmed", which is the normal condition of a date a reading '
  + 'found yesterday, not a problem. Never say "AI", and never call this company or anything it has '
  + 'compliant or non-compliant: say what a rule requires and what the documents show. This is not legal '
  + 'advice and you do not say that it is. Never say an agency has confirmed, approved, accepted or reviewed '
  + 'anything unless the document in front of you says so in those words.'

/**
 * THE IDS ARE FOR MARKERS, NOT FOR SENTENCES — added after the first real run, which wrote
 * *"we have this on your calendar as dates C6 and C7"*. The code replaces a bare id with the
 * date's title (`lib/ask/passages.ts` `replacePassageIds`); this stops it being written at all.
 */
export const CALENDAR_IDS =
  'The ids in what you are given (C1, D2, F3) are handles for citing a passage inside square brackets. '
  + 'Never write one in a sentence: name the date, the document or the finding by its title instead.'

/**
 * A RULE NUMBER IS A CLAIM — added after the second real run, which wrote *"The requirement comes
 * from NFPA 10 Section 7.1"* with **no search performed at all** (`searches=0` in the ledger).
 * Nothing in the check can catch that: it is neither a quote nor a link, so it is not something
 * code can test. `CLAUDE.md` §3.3 is the standing rule it offends — a model reasons well against
 * an artifact and enumerates unreliably from nothing.
 */
export const CALENDAR_RULE_NUMBERS =
  'If you name a regulation, a standard or a section number, either cite a page your search returned in '
  + 'this answer or say which of the documents in front of you you are reading it from. Do not give a rule '
  + 'number from memory; if you are not sure of one, describe what the rule requires without numbering it.'

/**
 * SEARCH FIRST, THEN WRITE — and this sentence is here because of a measured loss, not a style
 * preference. `lib/ai.ts` withdraws everything written before the FIRST web search, on the
 * evidence of five recorded sequences where that text was the model saying what it was about to
 * do. In the second real run of step 10a the model wrote *"That date is not on the calendar
 * yet."* — the one sentence this section owes the person — and THEN searched, so the rule
 * withdrew it. The shared stream is the workspace's and HR's as well, so it is not changed here
 * (`HANDOFF-CODE.md` §7); this stops the Calendar walking into it.
 */
export const CALENDAR_SEARCH_FIRST =
  'If you are going to search, search before you begin the answer. Anything you write before your first '
  + 'search is treated as thinking aloud and is not shown to anyone, so never put part of the answer there.'

/** Decision 30, the standing rule, applied to the prompt itself. */
export const CALENDAR_UNSURE =
  'Where you do not know something, say so in one clear, polite sentence and ask one question that would '
  + 'settle it. Never present a guess as something we read. If the dates on file do not answer the question, '
  + 'say which of them you looked at and what is missing.'

/** What it may offer, and the one shape it takes (decision 17; `lib/ask/offers.ts` checks it). */
export const CALENDAR_OFFERS =
  'The only thing you can do here in one click is add a date to this calendar, so offer only that. The offer '
  + "is for a date THE RULE sets that is not already on the calendar; never offer a date that is already "
  + 'there. The fenced block takes: kind "add_date"; title, the obligation\'s plain name as a person '
  + 'would recognise it on a calendar ("Tier II report") — never hedged and never qualified: no '
  + '"(if applicable)", no "if required", no question mark. Any doubt about whether it applies belongs in '
  + 'the sentences above the offer, not in the title; due_on as YYYY-MM-DD for a date that happens once, or recurs true with period one of "month", '
  + '"quarter", "6 months", "year", "2 years" (or null if the rule does not say how often); site null unless '
  + 'the rule applies to one named site; source_url, the page you read the rule on; and source_line, the '
  + "sentence on that page that sets the date."

/** The sentences, in the order they are added after the shared prompt. */
export const CALENDAR_SENTENCES: string[] = [
  CALENDAR_GIVEN,
  CALENDAR_NOT_ON_IT,
  CALENDAR_WORDS,
  CALENDAR_IDS,
  CALENDAR_RULE_NUMBERS,
  CALENDAR_SEARCH_FIRST,
  CALENDAR_UNSURE,
  CALENDAR_OFFERS,
  OFFER_FORMAT_SENTENCE,
]

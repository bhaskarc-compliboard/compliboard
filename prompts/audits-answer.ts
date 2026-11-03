/**
 * THE AUDITS CHAT — its sentences after the shared prompt. `docs/GAPS-PLAN.md` Part A step 6a
 * (decisions 31–34, 41).
 *
 * *** EVERYTHING HERE IS A QUALITY CHANGE (`CLAUDE.md` §3.1) AND WAITS FOR THE OWNER'S YES. ***
 * Drafted and measured in the same step, as the Documents prompt was: `scripts/probe-audits-answer.mjs`
 * runs each of six questions three times WITH everything this file and `lib/ask/auditsBrief.ts`
 * give the model and three times with the Documents brief instead, against Cascade's own two
 * audits and thirteen documents (`tests/golden/audits/chat/`). 6b does not start until the owner
 * has read these sentences.
 *
 * *** IT STARTS FROM `prompts/documents-answer.ts`'s FOURTEEN AND KEEPS ELEVEN OF THEM, WHOLE. ***
 * The honesty set is not re-derived: name the document, write a name in plain words, say plainly
 * when something is not on file, say when a reading is older than the document, do not quote a
 * picture of a page, the Queued sentence, the product's words, the ids rule, rule numbers, search
 * first, the shape, and the unsure line. Each of those was bought by a real run going wrong — the
 * provenance is in the Documents file and is not repeated here. Imported, not copied, so a
 * sentence the owner changes in one place changes in both.
 *
 * **Three of the fourteen are rewritten.** `DOCUMENTS_GIVEN` becomes `AUDITS_GIVEN`, because this
 * chat is given two more things. `DOCUMENTS_IDS` becomes `AUDITS_IDS`, because this chat's handles
 * are five and because an audit's own stored words sometimes contain one. And
 * `DOCUMENTS_NO_OFFERS` — *"Do not offer to do things for the person"* — becomes
 * `AUDITS_ONE_OFFER`, because this chat has exactly one button (decision 41).
 *
 * **Five are Audits' own**, and each answers something this section can get wrong in a way no
 * other section can: an audit is a record of a date; the four words mean what the audit meant by
 * them; never a verdict; "not audited yet" is a true state; and the offer's own block shape,
 * which is not the Calendar's.
 *
 * **Nineteen in all** — eleven kept, three rewritten, five new.
 */
import {
  DOCUMENTS_WHICH_ONE, DOCUMENTS_PLAIN_NAME, DOCUMENTS_NOT_ON_FILE, DOCUMENTS_OLD_READING,
  DOCUMENTS_NO_TEXT, DOCUMENTS_QUEUED, DOCUMENTS_WORDS, DOCUMENTS_RULE_NUMBERS,
  DOCUMENTS_SEARCH_FIRST, DOCUMENTS_SHAPE, DOCUMENTS_UNSURE,
} from './documents-answer.ts'

/**
 * What it is given, and the order to answer in. `DOCUMENTS_GIVEN` with the two blocks this
 * section adds — the audits and their findings — and the same quoting clause, which 36 measured
 * Documents runs paid for: a quote of six words or more is the only thing `lib/ask/passages.ts`
 * can verify, and a verified quote is the only thing that becomes a card the person can click.
 */
export const AUDITS_GIVEN =
  'You are given every audit this company has run, the open findings of the most recent one for '
  + 'each agency and of the most recent audit against a checklist, a list of every document the '
  + 'company holds, and the full reading of the documents the question is about. You are not '
  + 'given the files themselves, except a file the person has attached to this conversation, '
  + 'which is in the message. Answer from those, and quote the line you read something from when '
  + 'the exact words matter, so the person can open the audit or the document and see it.'

/**
 * *** AN AUDIT IS A RECORD OF A DATE, NOT A LIVE STATUS — the thing this section gets wrong that
 * no other one can. ***
 *
 * Every other block in this chat is current: the index is what the company holds now, a reading
 * is the latest reading. An audit is none of those — it is what was true on the day it ran,
 * against the readings as they stood then, which is why `audit_runs.readings_as_of` exists and
 * why the drawer prints it. An answer that says "Oregon DEQ: 6 things with nothing on file"
 * without its date is telling the person something about today that is only true about 3 November.
 */
export const AUDITS_A_RUN_HAS_A_DATE =
  'An audit is a record of one day. Give its date whenever you use what it found. If a document '
  + 'was read after the audit ran, say so, because the audit did not see it. Running the audit '
  + 'again is how its lines are brought up to date, and you can say so — you cannot run one.'

/**
 * *** THE FOUR WORDS MEAN WHAT THE AUDIT MEANT BY THEM, AND ARE NEVER UPGRADED. ***
 *
 * `prompts/audit-agency.ts` lets an audit use four words and no others, and two of them are
 * carefully weaker than the English word a reader reaches for. "Nothing on file" is NOT "missing"
 * and NOT "not done" — the audit's own prompt says so in as many words: *"A daily log kept on a
 * clipboard in the plant room and never uploaded is not a breach."* "Out of date" (`stale`) is
 * not "expired" unless a reading says a date has passed. A chat that re-words a finding upward
 * turns the most careful part of the product into the accusation it was built not to make.
 *
 * And the document statuses are a SECOND vocabulary — `lib/documentStatus.ts`, which the audit
 * report itself prints beside a finding rather than inventing its own. The two are not the same:
 * the ACDP permit is "Expiring" as a document and "out of date" as a finding, and an answer that
 * merges them has lost the distinction the person needs.
 */
export const AUDITS_FOUR_WORDS =
  'An audit says one of four things about a line: on file, out of date, nothing on file, or not a '
  + 'document question. Use the audit\'s own word and do not make it stronger. Nothing on file '
  + 'means we have not been shown it, not that it does not exist and not that anybody failed to '
  + 'do it. Out of date does not mean expired unless a reading gives a date that has passed. A '
  + 'document\'s own state in the list — Current, Expiring, Needs work — is a different thing from '
  + 'a finding\'s word; if you use both, keep them apart. Some lines are marked as something '
  + 'companies like this usually hold that we have not been shown: those are suggestions, not '
  + 'findings, and you say so every time you use one.'

/**
 * *** NEVER A VERDICT — the audit report's own lede, and the product's oldest rule. ***
 * `components/AuditReport.tsx` prints *"None of it is a verdict on whether the company complies"*
 * at the top of every template report. `DOCUMENTS_WORDS` already bans "compliant"; this says the
 * positive half, because the temptation here is not the word but the summary sentence — "you are
 * in good shape for DEQ" is a verdict with no banned word in it.
 */
export const AUDITS_NEVER_A_VERDICT =
  'An audit is a reading of a filing cabinet, not of a plant. Never say the company is ready, in '
  + 'good shape, or in trouble, and never add up the findings into a score or a grade. Say what '
  + 'is on file, what is out of date, and what we have not been shown.'

/**
 * *** "NOT AUDITED YET" IS A TRUE STATE AND IS SAID PLAINLY — with the offer, decision 41. ***
 *
 * Cascade holds four agency labels and has been audited against one. The failure this prevents is
 * the model answering a question about Oregon OSHA from the DOCUMENTS alone and presenting it as
 * what an audit found. The honest answer names the gap and offers the one thing that closes it.
 */
export const AUDITS_NOT_AUDITED_YET =
  'If no audit has been run for the agency the question is about, say so plainly, say what the '
  + 'documents in that agency\'s name do show, and do not describe that as an audit. Offer to run '
  + 'the audit.'

/**
 * *** ONE OFFER, AND IT REPLACES DOCUMENTS' "DO NOT OFFER" — decision 41, the owner, 3 November
 * 2026. ***
 *
 * Documents learnt the hard way that a chat offers in prose when it has no button: 18 of 36
 * measured runs, and the person says yes to nothing. The answer there was to ban offering. Here
 * there IS a button, so the answer is the opposite and must be just as exact — one offer, in the
 * fenced block, and nothing else promised anywhere in the prose.
 *
 * *** THE OFFER CARRIES NO `source_url`, AND THAT IS WHY THIS SECTION WRITES ITS OWN FORMAT
 * SENTENCE INSTEAD OF USING `prompts/ask.ts`'s `OFFER_FORMAT_SENTENCE`. *** That shared sentence
 * says *"Every offer must carry source_url, and that link must be one your search returned"* —
 * true of the Calendar's offer, which carries a date out of a regulation into a customer's
 * calendar. This offer carries nothing: it starts a run over the company's own documents, and
 * there is no web page to verify. Using the shared sentence would ask the model for a field the
 * product then has to ignore.
 */
export const AUDITS_ONE_OFFER =
  'The only thing you can do here in one click is start an audit, so offer only that, and never '
  + 'offer anything else — no drafting, no writing, no filing. Offer it when the person asks '
  + 'whether they are ready for one agency, or attaches a checklist and asks you to check it. '
  + 'Never say you have run, are running, or will run an audit: you are proposing one, and the '
  + 'person starts it.'

/**
 * The block's shape, written here because this offer is not the Calendar's (see above).
 *
 * *** IT ASKED FOR AN ID THE MODEL IS NEVER SHOWN, AND GOT A PASSAGE HANDLE — the owner's fix,
 * decision 45, 3 November 2026. *** Step 6a measured 18 offer blocks in 18 runs. Fifteen were
 * accepted; **all three the code refused wrote `{"kind":"run_audit","document_id":"I7"}`** — a
 * handle out of the context where a uuid belonged, which is the only id the model has. It was the
 * prompt's fault. The block now carries `attached: true` and no id, and
 * `lib/ask/auditsBrief.ts` `checkRunAuditOffer` resolves the file from what the page already
 * holds for this turn.
 */
export const AUDITS_OFFER_FORMAT =
  'To offer it, end the answer with a fenced block — three backticks, the word offer, a JSON '
  + 'object, three backticks — and nothing after it. The object takes EITHER agency, one of the '
  + 'agency names exactly as it appears in what you were given, or "all" for every agency; OR, '
  + 'for a checklist the person attached to this conversation, attached true and no agency. It '
  + 'always carries kind "run_audit". Never put an id in it: you are not given one, and the '
  + 'product fills it in. Write the offer in the fenced block only and do not describe its fields '
  + 'in the prose. An agency this company does not hold is dropped before anyone sees it.'

/**
 * THE IDS ARE FOR MARKERS, NOT FOR SENTENCES — `DOCUMENTS_IDS` with this chat's handles. It
 * matters more here than in Documents, for a reason found by reading the rows: an audit's own
 * `what_to_do` text sometimes contains a handle from the run that wrote it (*"against the 42
 * recorded in D4"*), so the model is shown one and may copy it out.
 */
export const AUDITS_IDS =
  'The ids in what you are given (U1, F2, I3, R1, AF1) are handles for citing a passage inside '
  + 'square brackets. Never write one in a sentence: name the audit by its agency and date and the '
  + 'document by its title, as the person would see it. If a finding\'s own words contain a handle '
  + 'like D4, do not repeat it — say which document it means.'

/**
 * The sentences, in the order they are added after the shared prompt. **Nineteen.**
 *
 * The order is Documents', with Audits' own four placed where they are read: what it is given,
 * then the two rules about what an audit IS, then how to name a document, then not-on-file and
 * not-audited-yet together, then the readings' honesty, then the words and the verdict ban, then
 * the three honesty rules, then the shape, then the offer and its format, then the unsure line.
 */
export const AUDITS_SENTENCES: string[] = [
  AUDITS_GIVEN,
  AUDITS_A_RUN_HAS_A_DATE,
  AUDITS_FOUR_WORDS,
  DOCUMENTS_WHICH_ONE,
  DOCUMENTS_PLAIN_NAME,
  DOCUMENTS_NOT_ON_FILE,
  AUDITS_NOT_AUDITED_YET,
  DOCUMENTS_OLD_READING,
  DOCUMENTS_NO_TEXT,
  DOCUMENTS_QUEUED,
  DOCUMENTS_WORDS,
  AUDITS_NEVER_A_VERDICT,
  AUDITS_IDS,
  DOCUMENTS_RULE_NUMBERS,
  DOCUMENTS_SEARCH_FIRST,
  DOCUMENTS_SHAPE,
  AUDITS_ONE_OFFER,
  AUDITS_OFFER_FORMAT,
  DOCUMENTS_UNSURE,
]

/**
 * NIGHT WATCH'S WORDS — every sentence the page and the email show, in one place.
 * `docs/GAPS-PLAN.md` decision 75 (the owner, 4 November 2026).
 *
 * *** THE MACHINE WORD IS `quality`. THE NAME PEOPLE SEE IS NIGHT WATCH. *** The owner's
 * decision: `quality` stays everywhere a program reads it — the route path `/api/jobs/quality`,
 * `job_runs.job = 'quality'`, the table `quality_reports`, the page `/quality` — so nothing has to
 * be renamed to read a log. **Night Watch is what the email subject, the page title and the docs
 * say.** A product name and a machine word are allowed to differ; two machine words are not.
 *
 * *** IT IS A SEPARATE FILE FOR THE REASON `lib/documentsWords.ts` AND `lib/auditsWords.ts` ARE. ***
 * `app/quality/page.tsx` is a browser component. The counters live in `lib/quality.ts`, which the
 * job's route imports, and a page that reached into the job's module would drag the server's
 * reading into the browser. **Nothing here imports anything at all**, which is what keeps it
 * client-safe — `tests/unit/clientImports.test.ts` holds it.
 *
 * Simple words and short sentences, and the owner reads them before they ship (`CLAUDE.md` §0).
 */

/** The name people see, everywhere. */
export const NIGHT_WATCH = 'Night Watch'

/** The page's own lede, under the title. */
export const NIGHT_WATCH_LEDE =
  'What the product did to itself yesterday. Code found all of this; nothing here was decided by '
  + 'a model, and nothing here has been changed.'

/**
 * *** THE ELEVEN COUNTS, IN THE ORDER THE PAGE AND THE EMAIL SHOW THEM. ***
 *
 * `key` is the machine word, and it is the key in `quality_reports.counts` and `.rows`.
 * `title` is what a person reads. `why` is one sentence saying what a non-zero number means —
 * **not what the query does**, which is the mistake that makes a dashboard unreadable.
 * `found` names where the shape was first found by hand, so a number has a history.
 * `scope` is `'day'` for a count over yesterday and `'now'` for a reading of this moment.
 *
 * Twelve were asked for. **(e), "a finding whose word contradicts its what_to_do", was dropped by
 * the owner after it was measured**: the regex the brief named matched 17 findings on staging and
 * 16 of them were correct sentences about gaps INSIDE a document that is genuinely on file
 * ("the log covers August 17–21 with daily readings missing for all five days"). What replaced it
 * is `word_against_attachments`, which needs no prose at all: it asks whether the word and the
 * row's own attachments disagree. That reads 0 today, and 0 is the right answer.
 */
export interface CounterWords {
  key: string
  title: string
  why: string
  found: string
  scope: 'day' | 'now'
}

export const COUNTERS: ReadonlyArray<CounterWords> = [
  { key: 'answers_no_source',
    title: 'Answers with no source',
    why: 'The answer rested on documents or audits and stored nothing to point at, so nobody can check it.',
    found: 'by hand at E2d, which is what the inheritance work was for',
    scope: 'day' },
  { key: 'refused_quotes',
    title: 'Quotes that matched nothing',
    why: 'The answer quoted words the check could not find in the file they were said to come from.',
    found: 'decision 68 — the honesty note on an answer',
    scope: 'day' },
  { key: 'handles_at_a_person',
    title: 'A handle written at a person',
    why: 'Stored text says "D6" or "AF2" to somebody who has never seen a handle and cannot look one up.',
    found: 'W5, six of ten audit lines on 3 November',
    scope: 'day' },
  { key: 'sections_unparsed',
    title: 'Audit sections lost to broken JSON',
    why: 'The model answered, the answer would not parse, and that section of the audit is missing.',
    found: 'lib/auditRun.ts, which stores the raw text when this happens',
    scope: 'day' },
  { key: 'word_against_attachments',
    title: 'A finding whose word and attachments disagree',
    why: 'The word claims a document answers the line while no document is attached, or a quote on it failed its check.',
    found: 'measured in place of the brief’s prose test, which was wrong 16 times in 17',
    scope: 'day' },
  { key: 'read_without_the_model',
    title: 'Readings that failed before the model was called',
    why: 'The file was refused before any model saw it. Often right — a type we cannot open — and sometimes ours.',
    found: 'B1 and B4, which gave each refused type its own sentence',
    scope: 'day' },
  { key: 'paid_and_unclaimed',
    title: 'Paid readings no reading claims',
    why: 'Money was spent reading a document and no stored reading accounts for it. This is what W2 cost.',
    found: 'W2 — three readings, $0.4430, whose rows said the model was never called',
    scope: 'day' },
  { key: 'summary_without_sources',
    title: 'Summaries with no sources, on a conversation that had them',
    why: 'The conversation rested on documents and its summary proves nothing. E2f replaced the rule that caused it.',
    found: 'E2f, and this count is now the regression detector for it',
    scope: 'day' },
  { key: 'template_read_itself',
    title: 'A template audit that read its own template',
    why: 'The audit remarked on the blank checklist it was auditing against, as though it were evidence.',
    found: 'W6, closed by decision 49',
    scope: 'day' },
  { key: 'stuck_reading',
    title: 'Documents stuck reading',
    why: 'A document has been claimed for reading for over an hour. The sweep frees these after fifteen minutes, '
       + 'so any number above zero means the sweep itself has stopped.',
    found: 'W1, eleven minutes of silence on a folder of nine',
    scope: 'now' },
  { key: 'duplicate_runs',
    title: 'Audit runs started twice within a minute',
    why: 'Two identical audits, one of them paid for twice. A person re-running on purpose looks the same, '
       + 'so read the ids rather than assuming.',
    found: 'W3 — a double press bought a second audit for $0.49',
    scope: 'day' },
] as const

/** The two blocks that always show and never count toward "things to look at". */
export const COST_TITLE = 'What yesterday cost'
export const PULSE_TITLE = 'The jobs’ pulse, right now'
export const PULSE_WHY =
  'When each job last started, and whether it left a row open. This is a reading of this moment, not of yesterday.'

/** The one honest line about HR — see `quality.ts`, which explains why it is not needed today. */
export const HR_IS_WATCHED =
  'HR is watched: its conversations are stored the same way as every other section’s, so the first '
  + 'two counts cover it.'

/** The subject line. `n` is how many of the eleven are not zero. */
export const subjectLine = (day: string, n: number): string =>
  `${NIGHT_WATCH} · ${day} · ${n === 0 ? 'nothing to look at' : `${n} thing${n === 1 ? '' : 's'} to look at`}`

/**
 * THE EMAIL'S FIRST LINE — the owner's instruction: it states the window it covered, in Pacific,
 * with the date. A report that does not say which hours it read is a report nobody can check.
 */
export const windowLine = (day: string, from: string, to: string): string =>
  `This covers ${day}, Pacific time — midnight to midnight (${from} to ${to} UTC).`

/** What the email says when every one of the eleven is zero. */
export const ALL_CLEAR = 'All eleven counts are zero. The cost and the jobs’ pulse are below.'

/** A delta, as the page and the email write it: against the same count on the previous day’s row. */
export const deltaWord = (now: number, before: number | null): string => {
  if (before === null) return 'no row yesterday'
  const d = now - before
  if (d === 0) return 'same as the day before'
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} on the day before`
}

/** The footer line, beside `FOOTER_NOT_LEGAL_ADVICE`’s place in a customer email. */
export const EMAIL_FOOTER =
  'Night Watch reads rows and changes nothing. It calls no model, so it costs nothing to run.'

/** What the page says when there is no row for the day yet. */
export const NO_ROW_YET =
  'No report has been written yet. Night Watch runs at 05:30 Pacific and writes one row a day.'

/** What a person who is not the owner sees: nothing. The route answers 404 (`CLAUDE.md` §3.6). */
export const NOT_FOR_YOU = 'Not found.'

/**
 * THE SUMMARY'S DISPLAY WORDS — HR Step 3a (`docs/HR-PLAN.md` decision 1).
 *
 * Moved out of `lib/summaryReport.ts` with not a character changed, because the summary drawer now
 * lives in a shared component (`components/ReportView.tsx`) and `lib/summaryReport.ts` cannot reach
 * the browser: it imports `lib/ai.ts`, which imports the model SDK. Until this file existed the page
 * and `lib/checklistView.ts` each kept a pinned copy instead.
 *
 * *** THIS FILE IMPORTS NOTHING, AND MUST NOT. *** It is read by browser components.
 * `tests/unit/clientImports.test.ts` fails if it ever imports anything, and fails if any client
 * file imports `lib/ai.ts`, `lib/summaryReport.ts`, `lib/auth.ts` or the SDK.
 *
 * `lib/summaryReport.ts` imports these and re-exports them, so its callers — the summarise route,
 * the nightly job, `renderPlainText` — are unchanged.
 */

export const NO_SOURCE = 'No source cited in the conversation'

/** Under "Your situation" when the person said nothing about their business (the owner, 7 October): a polite
 *  fixed sentence, never the model saying what the person did not share. */
export const NO_SITUATION = 'No details about your business came up in this conversation.'

/** "1 October 2026" — the as-of date, written out. */
export function longDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export const AS_OF_LINE = (asOf: string) =>
  `What applies to you as of ${longDate(asOf)}, from this conversation. Rules and tariffs change. Check before you act.`

/**
 * *** THE PLAIN AS-OF LINE — E2b item 6, 4 November 2026 (the owner). ***
 *
 * The line above is the WORKSPACE's and stays the Workspace's: that section researches rules and
 * tariffs, and its summary has been measured saying so. Documents, Audits and the Calendar ask
 * about a cabinet, an audit and a diary, where "Rules and tariffs change" is a sentence about
 * somebody else's problem. Same promise, fewer words.
 *
 * It lives here and not in `lib/ask/engine.ts` because three client pages pass it to the drawer,
 * and `tests/unit/clientImports.test.ts` fails any client file that can reach `lib/ai.ts`.
 */
export const PLAIN_AS_OF = (asOf: string) =>
  `What applies to you as of ${longDate(asOf)}, from this conversation. Check before you act.`

// ---- HR Step 7 — HR's summary words, beside the workspace's (the owner's, from the Step 7 design) ----

/** HR's as-of line. The workspace's mentions tariffs; HR's is about the handbooks. */
export const HR_AS_OF_LINE = (asOf: string) =>
  `What to change in your handbooks as of ${longDate(asOf)}, from this conversation. Rules change. Check before you act.`

/** "1 thing to change", "3 things to change" — per authority (canvas board 10). */
export const thingsToChange = (n: number) => `${n} thing${n === 1 ? '' : 's'} to change`

/** "What to change · 3 things" — the heading over the authorities. */
export const whatToChangeHeading = (n: number) => `What to change · ${n} thing${n === 1 ? '' : 's'}`

// ---- E2 — the five cards' words (`docs/GAPS-PLAN.md` Part E step E2, decision 62) ----

/**
 * *** THE CARD TITLES, AND THE ONE THAT WAS RENAMED. ***
 *
 * "Asked and not answered" became **"Not answered here"** (the owner, 4 November): the old words
 * read as a reproach — the board's note records his own phrase for it, *"either goes away or gets
 * extra polite"* — and what actually happened is that a question came up in a conversation about
 * something else. The section stays, because a question this product saw and did not answer is
 * exactly the thing it must not quietly drop (§6).
 */
export const CARD_SITUATION_TITLE = 'Your situation'
export const CARD_APPLIES_TITLE = 'What applies'
export const CARD_CONFIRM_TITLE = 'Still to confirm'
export const CARD_UNANSWERED_TITLE = 'Not answered here'
export const CARD_SOURCES_TITLE = 'Sources'

/** On the Still to confirm header, in place of a bare number: what the count MEANS. */
export const CONFIRM_COUNT = (n: number) =>
  `${n} thing${n === 1 ? '' : 's'} we could not settle from the documents`

/** On the Not answered here header. */
export const UNANSWERED_COUNT = (n: number) => `${n} question${n === 1 ? '' : 's'}`

/**
 * Under every question in Not answered here — the owner's words, 4 November. It says what is true
 * (this came up in a conversation about something else) and what to do about it, and it promises
 * an answer to a question asked on its own, which is a promise the product keeps.
 */
export const UNANSWERED_LINE =
  'this came up and the conversation did not settle it. Ask it on its own and we will answer.'

/** On the What applies header, beside the heading: "6 things to do · 3 authorities". */
export const APPLIES_COUNT = (total: number, groups: number) =>
  `${total} thing${total === 1 ? '' : 's'} to do · ${groups} authorit${groups === 1 ? 'y' : 'ies'}`

/** Beside HR's own heading, which already carries its count. */
export const GROUPS_COUNT = (groups: number) =>
  `${groups} authorit${groups === 1 ? 'y' : 'ies'}`

// ---- E2a item 3 — Still to confirm leads somewhere (the owner, 4 November 2026) ----

/**
 * *** THE CARD THAT SAID "WE COULD NOT SETTLE THIS" AND OFFERED NOWHERE TO SETTLE IT. ***
 *
 * Company information is the page that holds the answers, and its first section is literally
 * called *Waiting for you*. So the card leads there.
 *
 * *** ONE DOOR, NEVER TWO — E2c item 4, 5 November 2026 (the owner). ***
 *
 * E2a put the link on the header AND on every item; E2b took it off the items that could not name
 * a question, which left a card with a link in its header and a link on one item — the same words
 * twice, one of them a worse version of the other. The rule now:
 *
 *   · an item that names a question Company information is **waiting** for carries `CONFIRM_ONE`,
 *     which goes to THAT question;
 *   · the header carries nothing at all, so it lines up with the other four cards;
 *   · and `CONFIRM_ALL` is drawn once, under the header inside the card, ONLY when no item carries
 *     a link of its own. A card always offers exactly one way to settle what it lists.
 */
export const CONFIRM_ALL = 'Confirm these on Company information →'
export const CONFIRM_ONE = 'Confirm it on Company information →'

/**
 * *** WHERE AN ITEM'S LINK GOES — matched on the PAGE'S OWN KEY, never on words. ***
 *
 * `/company-information` keys every waiting question by a switch or fact key —
 * `lib/confirmationQueue.ts` builds `one:<key>`, `dis:<key>` and a document group whose members
 * are those same keys, and `/api/to-confirm` settles a KEY. So `?key=<key>` is the only address
 * that can name one question, and matching on an item's words would be matching on something the
 * model wrote rather than on something the page holds.
 *
 * *** AN ITEM CARRIES A KEY SINCE E2b, AND ONLY A WAITING ONE SURVIVES. ***
 * This said "TODAY NO ITEM CARRIES A KEY", and at E2a that was true: the prompt asked for a key on
 * a FACT, not on an item, so nothing joined a fact to an item but its wording. E2b item 2 added
 * `"key"` to the `to_confirm` shape (§3.1, approved), gave the model the list of questions actually
 * waiting, and made `checkReport` DROP a key that is not on that list — an invented key sends a
 * person to the wrong question, which is worse than sending them to the page. Measured: the first
 * Haiku run under it returned `air_permit_number` and `permittee_legal_name`, both waiting.
 * `ReportItem.key` stays optional because every report stored before E2b has none.
 *
 * **The page resolves it, not the caller.** A key that is no longer waiting opens the page as it
 * always did: asking the drawer to fetch the queue first would be a request per summary opened,
 * for a link whose fallback is the same page.
 */
export const CONFIRM_HREF = '/company-information'
export function confirmHref(key?: string | null): string {
  const k = typeof key === 'string' ? key.trim() : ''
  return k ? `${CONFIRM_HREF}?key=${encodeURIComponent(k)}` : CONFIRM_HREF
}

/**
 * ONE READING PACKER, FOR EVERY SECTION THAT SHOWS DOCUMENTS — `docs/GAPS-PLAN.md` Part A step 4a
 * (decision 14).
 *
 * *** THIS IS `lib/ask/calendarBrief.ts:151`–`:191` LIFTED OUT, and the Calendar still calls it
 * with its own block and its own letter, so the Calendar's bytes do not move. *** It is the third
 * lift of this shape — the engine out of HR, the screen out of the Calendar, and now this — and
 * the reason is the same every time: two sections packing documents two ways is two sets of rules
 * about what a person is shown, free to drift.
 *
 * WHAT IT IS, in one sentence: fill a block with items, newest-first or best-first as the caller
 * ordered them, stop when the budget is spent, and **say out loud what did not fit**.
 *
 * *** THE THREE RULES IT CARRIES, each of which was paid for. ***
 *
 *   1. **WHAT IS LEFT OUT IS NAMED.** A chat that quietly drops half a company's documents would
 *      answer "we hold nothing about that" about a document it holds — the worst thing any of
 *      these sections can say. The sentence goes into the block itself, so the model is told, AND
 *      into `leftOut`, so the context event, the log and `check_record` are told.
 *
 *   2. **EVERY ITEM THE MODEL IS SHOWN GETS A PASSAGE, even one with nothing to quote.**
 *      `lib/ask/calendarBrief.ts:131`–`:141` has the run that forced it: ids and passages were two
 *      different namespaces, so an answer wrote "as dates C6 and C7" with C6 naming nothing. A
 *      passage with empty text can never match a quote, which is right, and it has a NAME, which
 *      is what `replacePassageIds` needs.
 *
 *   3. **THE CAP IS CHECKED BEFORE THE ITEM IS ADDED, never after.** Adding first and trimming
 *      later is how a budget is exceeded by exactly one large item.
 */
import { tokensOf, type Passage } from './passages.ts'

export interface PackedReadings {
  /** The blocks that fit, in the order they were given. */
  texts: string[]
  /** One per block that fit, in the same order. */
  passages: Passage[]
  /** How many were left out by the cap. */
  leftOut: number
  /** The tokens the blocks that fit cost. */
  spent: number
}

/**
 * Pack what fits, in the order given, and count what does not.
 *
 * `items` is already ordered by the caller — the Calendar puts the most-used document first, the
 * Documents chat puts the one the question names first. This never reorders: a packer that sorted
 * would be deciding what matters, which is the section's job.
 */
export function packReadings<T>(items: T[], options: {
  /** The token cap for this block. Checked before each item is added. */
  cap: number
  /** The letter this section's ids use — 'D' for the Calendar's readings, 'R' for a report. */
  idPrefix: string
  /** How one item is written for the model, given the id it will be cited by. */
  blockFor: (item: T, id: string) => string
  /** The card that item becomes when the answer quotes it. */
  passageFor: (item: T, id: string, block: string) => Passage
}): PackedReadings {
  const texts: string[] = []
  const passages: Passage[] = []
  let spent = 0
  let leftOut = 0
  items.forEach((item, i) => {
    const id = `${options.idPrefix}${i + 1}`
    const block = options.blockFor(item, id)
    const cost = tokensOf(block)
    // RULE 3: asked before it is added.
    if (spent + cost > options.cap) { leftOut++; return }
    spent += cost
    texts.push(block)
    // RULE 2: one passage per item SHOWN, always.
    passages.push(options.passageFor(item, id, block))
  })
  return { texts, passages, leftOut, spent }
}

/**
 * RULE 1, as a sentence. `one`/`many` are the section's own words, because "3 further document
 * reading(s) are on file and are not included here" is the Calendar's sentence and a different
 * section is showing different things.
 */
export function leftOutSentence(leftOut: number, say: (n: number) => string): string {
  return leftOut > 0 ? say(leftOut) : ''
}

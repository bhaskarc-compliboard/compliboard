/**
 * THE BRIEF — what a section tells the shared chat engine about itself. Calendar step 10a
 * (decision 28; `docs/CALENDAR-PLAN.md`).
 *
 * *** THE ENGINE IS HR'S ANSWER ROUTE, LIFTED OUT AND MADE GENERAL. HR IS NOT TOUCHED. ***
 * `app/api/hr/answer/route.ts` and `lib/hrAnswer.ts` are untouched by this step and go on running
 * HR exactly as they did; the engine is a copy of the parts of them that are not about handbooks.
 * Calendar is the engine's only customer until after the Calendar's release, when HR, Audits and
 * the Workspace move onto it and the copies are deleted (decision 28, `HANDOFF-CODE.md` §7).
 *
 * *** A BRIEF HAS FIVE THINGS AND A SIXTH IS A STOP. *** The owner's rule for this step, and it is
 * the whole reason the engine can be shared: every section differs in WHAT IT KNOWS and WHAT IT CAN
 * OFFER, and in nothing else. The moment a sixth kind of difference is needed — a section that
 * wants its own refusal rules, its own storage, its own answer shape — the engine has stopped being
 * one thing, and that is a conversation with the owner rather than a field.
 *
 *   section          which section's conversations these are (`topics.section`) and which model
 *                    tier and ledger task the call runs on
 *   words            the words the screens need; no sentence a person reads lives in the engine
 *   packContext      what the question is answered FROM, as blocks with a budget, plus the
 *                    passages a quote may be checked against (§3.3: the artifact)
 *   promptSentences  added after the shared system prompt, in order
 *   offers           which structured offers an answer may end with
 *   extraStep        OPTIONAL, and it is the escape hatch for HR's agency check when HR moves
 *                    over. Calendar passes none; nothing in this step calls it.
 *
 * `checkBrief` refuses anything else, by name, at the moment it is used — not in a review.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TopicSection } from '../topicList.ts'
import type { Passage } from './passages.ts'
import type { OfferKind } from './offers.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>

/** One block of what the answer is given, with what it cost and what did not fit. */
export interface ContextBlock {
  /** "the company", "the calendar", "the readings" — what the report and the log call it. */
  name: string
  text: string
  /** Characters sent, and the tokens they are estimated at (`TOKENS_PER_CHAR`). */
  chars: number
  tokens: number
  /** What this block could not carry, in one sentence a person could read. Null when it carried all. */
  leftOut: string | null
}

export interface PackedContext {
  blocks: ContextBlock[]
  /** What a quoted passage in the answer is checked against. Empty means nothing is checkable. */
  passages: Passage[]
}

export interface Brief {
  section: TopicSection
  words: {
    /** The attach control's label and where it points (the Calendar has no uploader of its own). */
    attachLabel: string
    attachHref: string
    examples: string[]
    emptyConversations: string
    /** The one line under the box that says what this chat answers from. */
    lede: string
  }
  packContext: (db: Db, companyId: string, question: string) => Promise<PackedContext>
  promptSentences: string[]
  offers: readonly OfferKind[]
  /**
   * HR's agency check, when HR moves over: one more call after the answer, whose result is appended.
   * Calendar passes none, and `tests/unit/askEngine.test.ts` holds that the engine does not require it.
   */
  extraStep?: (answer: { text: string; companyId: string }) => Promise<string | null>
}

/** The five fields every brief has, plus the one that is optional. Nothing else may be set. */
export const BRIEF_FIELDS = ['section', 'words', 'packContext', 'promptSentences', 'offers'] as const
export const BRIEF_OPTIONAL = ['extraStep'] as const

/**
 * THE RULE, ENFORCED WHERE IT IS USED. A brief with a field nobody agreed to is not a brief with an
 * extra field — it is a section asking the engine to behave differently in a way no other section
 * can see. It throws rather than warning: the engine would otherwise run, ignore it, and the
 * section would be subtly wrong in production.
 */
export function checkBrief(brief: Brief): void {
  const allowed = new Set<string>([...BRIEF_FIELDS, ...BRIEF_OPTIONAL])
  const extra = Object.keys(brief).filter((k) => !allowed.has(k))
  if (extra.length) {
    throw new Error(`ask: a brief may hold only ${[...allowed].join(', ')} — ${brief.section} also set ${extra.join(', ')}. `
      + 'A sixth kind of difference between sections is a decision for the owner, not a field (decision 28).')
  }
  for (const f of BRIEF_FIELDS) {
    if (brief[f] === undefined || brief[f] === null) throw new Error(`ask: the ${brief.section} brief is missing ${f}.`)
  }
  if (!brief.promptSentences.length) throw new Error(`ask: the ${brief.section} brief has no prompt sentences.`)
}

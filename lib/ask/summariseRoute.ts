/**
 * THE BODY OF A SECTION'S "SUMMARISE THIS CONVERSATION" ROUTE — `docs/GAPS-PLAN.md` decision 15.
 *
 * Three copies of this existed before it: the Compliance Workspace's
 * (`app/api/topics/[id]/summarise/route.ts`), HR's, and the Calendar's. They were compared line by
 * line (step 4b's map) and differ in exactly three ways:
 *
 *   · the SECTION GUARD — the Workspace has none and is section-blind; HR refuses anything that is
 *     not `'hr'`; the Calendar refuses anything that is not `'calendar'`;
 *   · the WRITER — HR and the Workspace call `summariseTopic` with a `kind`; the Calendar calls
 *     `summarise` from the engine, which is the same writer with the section passed through;
 *   · the 202 BODY — `{ status: 'started' }` for the first two, and the Calendar's
 *     `{ status: 'writing', message: CLAIM_WORDS.summary }`.
 *
 * *** THE CALENDAR'S REPLY SHAPE WINS *** (the owner, step 4b), and the reason is on the screen
 * rather than in the route: `components/AskScreen.tsx` `useAskConversations` shows the message
 * while it polls, so a body with no sentence in it leaves the person with a spinner and no words.
 *
 * *** THE THREE OLD COPIES ARE NOT TOUCHED. *** Decision 15: Documents' and Audits' routes call
 * this; HR's, the Workspace's and the Calendar's stay as they are until F7 moves them. Changing
 * three live sections' routes to prove a helper works is the opposite of the standing instruction.
 *
 * *** `requireCompany` AND `requireAccess` ARE NOT CALLED HERE, AND THAT IS DELIBERATE. ***
 * `scripts/check-schema-contracts.js` check 3 reads **the route file's own text** for
 * `requireAccess(` — a paid route that delegated its gate to a helper would pass the type checker
 * and fail the contract check, which is the check doing its job. So each route file does its own
 * session and its own gate, and hands this function the result.
 */
import { NextResponse } from 'next/server'
import { loadTurns } from '../conversation.ts'
import { summarise } from './engine.ts'
import { claimTopic, releaseTopic, withinClaimTime, CLAIM_WORDS } from '../topicClaim.ts'
import type { Db } from './brief.ts'
import type { TopicSection } from '../topicList.ts'

const NOT_FOUND = 'That conversation was not found.'
const COULD_NOT = 'That conversation could not be summarised just now. Nothing was changed.'
const NO_TURNS = 'There are no messages in this conversation to summarise yet. Ask a question first.'

/**
 * `after` is passed in rather than imported, for one reason: `next/server`'s `after` only does
 * anything inside a request, and a test of this function has no request to be inside. The route
 * hands it `after` from its own import; a test hands it a function that runs the work at once.
 */
export async function summariseSection(opts: {
  db: Db
  admin: Db
  companyId: string
  section: TopicSection
  topicId: string
  after: (work: () => Promise<void>) => void
}): Promise<NextResponse> {
  const { db, admin, companyId, section, topicId: id } = opts
  if (!id) return NextResponse.json({ error: 'No conversation id given.' }, { status: 400 })

  try {
    const { data: topic, error } = await db.from('topics').select('id, title, section').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    // *** A CONVERSATION OF ANOTHER SECTION IS A 404, exactly as one of another company is. ***
    // The same refusal for both, so an id cannot be probed by watching which error comes back
    // (`CLAUDE.md` §3.6, 404-not-403) — and so this section's caller can never write HR's summary.
    if (!topic || topic.section !== section) return NextResponse.json({ error: NOT_FOUND }, { status: 404 })

    const turns = await loadTurns(db, id)
    if (turns.length === 0) return NextResponse.json({ error: NO_TURNS }, { status: 409 })

    // THE CLAIM BEFORE ANY MODEL CALL (`lib/topicClaim.ts`, `CLAUDE.md` §3.11). A held claim is a
    // 409 and no call: a second press used to pay twice and overwrite the first summary.
    const claim = await claimTopic(db, id, 'summary')
    if (!claim.ok) {
      return NextResponse.json({ status: 'writing', message: `${CLAIM_WORDS.summary} It is already being written.` }, { status: 409 })
    }

    opts.after(async () => {
      try {
        const result = await withinClaimTime(summarise(db, admin, {
          section, topicId: id, companyId, title: topic.title ?? null, turns, source: 'user',
          guard: { claimedAt: claim.claimedAt, summarisedAt: claim.summarisedAt },
        }), 'summary')
        if (!result.ok) console.error(`${section} summarise ${id}: ${result.error}`)
        else console.log(`${section} summarise ${id}: ${result.report.applies.reduce((n, g) => n + g.items.length, 0)} item(s), `
          + `${result.report.sources.length} source(s), ${result.proposed} fact(s) proposed`)
      } catch (e) {
        console.error(`${section} summarise ${id} failed:`, e)
      } finally {
        // The claim is cleared by the run that set it, whatever happened — or nothing could ever
        // be summarised again.
        await releaseTopic(db, id, 'summary', claim.claimedAt)
      }
    })

    return NextResponse.json({ status: 'writing', message: CLAIM_WORDS.summary }, { status: 202 })
  } catch (e) {
    console.error(`${section} summarise ${id}:`, e)
    return NextResponse.json({ error: COULD_NOT }, { status: 500 })
  }
}

/**
 * AN ATTACHMENT STAYS IN THE CONVERSATION — `lib/attachedDocument.ts`, `DECISIONS.md` §129.
 *
 * *** THE PROPERTY PINNED HERE IS THE WORDING, AND IT IS PINNED BECAUSE IT CAUSED A REGRESSION
 * IN A REAL ANSWER. *** The first version introduced the review's `gaps` array as
 * "Problems found in it: …". A later turn read that list as exhaustive and RETRACTED a correct
 * finding that was not on it — it told the owner that a true statement had been a mistake.
 *
 * The block must therefore say two things: that the files themselves are in the message, and
 * that the notes are background rather than a complete list.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { describeAttachments, MAX_CARRIED_DOCUMENTS } from '../../lib/attachedDocument.ts'

/** A stub with only the two shapes this module asks of a Supabase client. */
function stubDb(turns: Array<Record<string, unknown>>, reviews: Record<string, unknown> = {}) {
  const chain = (rows: unknown) => {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'order', 'limit']) c[m] = () => c
    c.maybeSingle = async () => ({ data: rows ?? null })
    c.then = undefined
    return Object.assign(c, { data: rows })
  }
  return {
    from(table: string) {
      if (table === 'turns') {
        const c = chain(turns) as Record<string, unknown>
        c.order = async () => ({ data: turns })
        return c
      }
      return chain(reviews)
    },
    storage: { from: () => ({ download: async () => ({ data: null, error: 'unused' }) }) },
  } as never
}

describe('the notes are background, never the list of what is wrong', () => {
  test('it says the files themselves are in the message', async () => {
    const out = await describeAttachments(
      stubDb([{ document_id: 'd1', document_name: 'policy.pdf', position: 1 }],
             { document_type: 'Handbook', summary: 'A staff handbook.' }), 't1')
    assert.match(out, /the files themselves are included in this message/i)
  })

  test('it says the notes are NOT a complete list — the retraction this caused', async () => {
    const out = await describeAttachments(
      stubDb([{ document_id: 'd1', document_name: 'policy.pdf', position: 1 }],
             { document_type: 'Handbook', summary: 'A staff handbook.' }), 't1')
    assert.match(out, /not a complete list/i)
  })

  test('the review is introduced as a REVIEW, not as fact about the document', async () => {
    const out = await describeAttachments(
      stubDb([{ document_id: 'd1', document_name: 'policy.pdf', position: 1 }],
             { document_type: 'Handbook', summary: 'A staff handbook.' }), 't1')
    assert.match(out, /an earlier automated review described it as/i)
    // The phrasing that caused the regression must not come back.
    assert.ok(!/problems found in it/i.test(out), 'the exhaustive-sounding wording returned')
  })

  test('the document name is always there — it is what the turn is about', async () => {
    const out = await describeAttachments(
      stubDb([{ document_id: 'd1', document_name: 'Harbor-Kitchen-Employee-Policy-2026.pdf', position: 1 }],
             { document_type: 'Addendum', summary: 'x' }), 't1')
    assert.match(out, /Harbor-Kitchen-Employee-Policy-2026\.pdf/)
  })
})

describe('a deleted document does not erase the conversation', () => {
  test('a turn whose document_id is NULL still names the file and says it is gone', async () => {
    const out = await describeAttachments(
      stubDb([{ document_id: null, document_name: 'gone.pdf', position: 1 }]), 't1')
    assert.match(out, /gone\.pdf/)
    assert.match(out, /removed from Documents/i)
    // It must NOT claim to know what a document nobody can read said — §5.1.
    assert.ok(!/what it said/i.test(out))
  })
})

describe('no attachment is an empty string, not a heading', () => {
  test('a topic with no attachments produces nothing to append', async () => {
    assert.equal(await describeAttachments(stubDb([]), 't1'), '')
  })

  test('an unreadable database is not a claim that there were none', async () => {
    const broken = { from() { throw new Error('down') }, storage: { from: () => ({ download: async () => ({ data: null, error: 'x' }) }) } } as never
    assert.equal(await describeAttachments(broken, 't1'), '')
  })
})

describe('the carry cap is a stated bound', () => {
  test('it exists and is small enough to bound the input cost', () => {
    assert.ok(Number.isInteger(MAX_CARRIED_DOCUMENTS) && MAX_CARRIED_DOCUMENTS > 0)
    assert.ok(MAX_CARRIED_DOCUMENTS <= 5, 'an unbounded carry re-sends every PDF on every turn')
  })
})

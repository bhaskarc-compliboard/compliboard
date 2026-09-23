/**
 * A FILE ATTACHED IN A CONVERSATION IS PART OF THAT CONVERSATION — Fix Round 2 (1), §129.
 *
 * *** THE DEFECT, AND THE TWO LINES THAT BOUND IT. ***
 *
 * The old page sent the file WITH the question in the same `/api/chat` call:
 *
 *     app/compliance/page.tsx @ a5587af^ — `if (fileToSend) { formData.append('file', fileToSend)
 *     … res = await fetch('/api/chat', { method: 'POST', body: formData … }) }`
 *
 * The rebuilt page uploads the file, writes the `documents` row, runs the review, renders the
 * card — and ends there:
 *
 *     app/compliance/page.tsx — `onFilePicked`, last statement `card({ classification: … })`
 *
 * Nothing after that put the file anywhere the model could see it. `/api/chat` never stopped
 * being able to read a file; it stopped being given one. On production the owner attached a
 * policy, watched it classify and file correctly, asked about it, and was told no file had come
 * through — which was true of the model's context and false of everything on screen.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE MODEL NOW RECEIVES, AND WHY IT IS NOT THE SAME ON EVERY TURN
 *
 * **On the turn the file is attached to:** the document itself, as the native block
 * `parseDocumentToBlocks` produces — for a PDF that is the **raw PDF as a base64 `document`
 * block**, not extracted text. That is the same representation `lib/documentReview.ts` sends,
 * so the conversation reads exactly what the review read. A PDF goes to the model whole
 * because it reads layout, tables and scanned pages better than any extraction we would do.
 *
 * **On later turns, and after a reload:** the same document, loaded again from storage — plus a
 * line naming it and what the review found.
 *
 * *** THE FIRST DESIGN SENT ONLY THE REVIEW SUMMARY ON LATER TURNS, AND IT WAS MEASURED AND
 * REJECTED. *** It was chosen to save input tokens (§128 J put input at ~59% of the bill). What
 * it actually did, on a two-turn test against this fixture:
 *
 *   turn 1  "What is this document?"      -> named the 180-day waiting period as an error
 *   turn 2  "what did it get wrong about the waiting period?"
 *           -> "That item does not appear in the list of problems identified in the document,
 *              and I can't confirm from what's in front of me that the policy contained a
 *              waiting period at all. I shouldn't have stated it as one of its errors."
 *
 * **It retracted a true finding**, because the review's `gaps` array is lossy and the model
 * reasonably read the injected list as the definitive one. A conversation that contradicts its
 * own correct earlier answer is worse than an expensive one, and far worse than a thin one:
 * the customer is told the right answer was a mistake.
 *
 * So the document travels with the whole conversation. The review text stays, but it is
 * introduced as background rather than as the list of what is wrong — the document itself is
 * the authority, and it is present.
 *
 * *** THE COST IS REAL AND IS STATED RATHER THAN DISCOVERED. *** Every research turn in a topic
 * with an attachment re-sends that document as input. The fixture here is 4.4 KB and costs
 * almost nothing; a long scanned PDF is thousands of input tokens per page, on every turn. The
 * cap below bounds it at three documents; a size limit is NOT invented here, because the right
 * threshold is a product decision and a silently-truncated document is the failure this whole
 * section exists to end.
 */
import { DOCUMENTS_BUCKET } from './storage.ts'
import { parseDocumentToBlocks } from './documentContent.ts'

/** The Supabase client shape this module needs — the CALLER'S, so RLS applies (§3.6). */
type Db = {
  from: (t: string) => any
  storage: { from: (b: string) => { download: (p: string) => Promise<{ data: Blob | null; error: unknown }> } }
}

export interface AttachedDocument {
  id: string
  name: string
  /** The model-ready blocks: a `document` block for a PDF, `text` for Word/Excel/CSV. */
  blocks: Array<Record<string, unknown>>
  /** Which representation was used, for the log and for the report. */
  kind: string
}

/**
 * Load one document the caller owns and turn it into blocks the model can read.
 *
 * Returns null and logs rather than throwing: a conversation whose attachment cannot be read
 * must still answer the question in front of it. It must not, however, answer as though no file
 * had been attached — the caller adds a line saying the document could not be re-read.
 */
export async function loadAttachedDocument(
  db: Db, companyId: string, documentId: string,
): Promise<AttachedDocument | null> {
  try {
    // `.eq('company_id')` beside the id even though RLS already scopes this: the second
    // predicate costs nothing and means a policy regression cannot silently widen this.
    const { data: doc, error } = await db.from('documents')
      .select('id, name, file_url, file_type')
      .eq('id', documentId).eq('company_id', companyId).maybeSingle()
    if (error || !doc) {
      console.error(`attached document ${documentId}: not found for this company`)
      return null
    }

    const { data: blob, error: dlErr } = await db.storage.from(DOCUMENTS_BUCKET).download(doc.file_url)
    if (dlErr || !blob) {
      console.error(`attached document ${documentId}: could not download ${doc.file_url}`, dlErr)
      return null
    }

    const parsed = await parseDocumentToBlocks(
      await blob.arrayBuffer(), doc.name as string, (doc.file_type as string) ?? null)
    if (!parsed.ok) {
      console.error(`attached document ${documentId}: ${parsed.failure.message}`)
      return null
    }
    return { id: doc.id as string, name: doc.name as string, blocks: parsed.blocks as never, kind: parsed.kind }
  } catch (e) {
    console.error('attached document: could not be loaded:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * What earlier attachments in this conversation should say to a later turn.
 *
 * One line per attached document: its name, what it was read as, and what the review found.
 * Returns '' when the topic has no attachments, so a caller can append unconditionally.
 *
 * *** IT NAMES THE DOCUMENT EVEN WHEN THE ROW IS GONE. *** `turns.document_name` is a copy kept
 * for exactly this (migration 039): after the document is deleted the transcript must still say
 * a document was attached and what it was called, or history is quietly rewritten.
 */
export async function describeAttachments(db: Db, topicId: string): Promise<string> {
  try {
    const rows = await attachmentRows(db, topicId)
    if (!rows.length) return ''
    const lines: string[] = []
    for (const t of rows) {
      const name = String(t.document_name)
      if (!t.document_id) {
        lines.push(`- ${name} — attached earlier in this conversation. It has since been removed from Documents, so its contents are no longer available.`)
        continue
      }
      const { data: review } = await db.from('document_reviews')
        .select('document_type, summary')
        .eq('document_id', t.document_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      lines.push(`- ${name}` + (review?.document_type ? ` (read as: ${review.document_type})` : '')
        + (review?.summary ? `\n  An earlier automated review described it as: ${String(review.summary).trim()}` : ''))
    }
    // *** THE WORDING MATTERS AND WAS CHANGED AFTER A MEASURED FAILURE. *** An earlier version
    // said "Problems found in it: …" from the review's `gaps`, and the model read that list as
    // exhaustive and retracted a correct finding that was not on it. The review is background;
    // the document itself is attached to this message and is the authority.
    return `Documents attached to this conversation (the files themselves are included in this `
      + `message — the notes below are background, not a complete list of what is in them):\n`
      + lines.join('\n')
  } catch (e) {
    console.error('describeAttachments:', e instanceof Error ? e.message : String(e))
    return ''
  }
}

/** The turns in this topic that carried an attachment, oldest first. */
async function attachmentRows(db: Db, topicId: string) {
  const { data } = await db.from('turns')
    .select('document_id, document_name, position')
    .eq('topic_id', topicId).not('document_name', 'is', null)
    .order('position', { ascending: true })
  return (data ?? []) as Array<{ document_id: string | null; document_name: string; position: number }>
}

/**
 * Every document attached to this conversation, loaded and ready for the model.
 *
 * Capped at MAX_CARRIED, newest first. The cap is a bound on cost, not a judgement about which
 * documents matter: when it bites, the caller is told how many were left out so it can say so
 * rather than quietly answering from part of the evidence.
 */
export const MAX_CARRIED_DOCUMENTS = 3

export async function loadTopicAttachments(
  db: Db, companyId: string, topicId: string, excludeId?: string,
): Promise<{ documents: AttachedDocument[]; omitted: number }> {
  const rows = (await attachmentRows(db, topicId))
    .filter((r) => r.document_id && r.document_id !== excludeId)
  // Newest first: a conversation that keeps attaching is usually about the latest file.
  const wanted = [...new Map(rows.map((r) => [r.document_id!, r])).values()].reverse()
  const take = wanted.slice(0, MAX_CARRIED_DOCUMENTS)
  const documents: AttachedDocument[] = []
  for (const r of take) {
    const doc = await loadAttachedDocument(db, companyId, r.document_id!)
    if (doc) documents.push(doc)
  }
  return { documents, omitted: Math.max(0, wanted.length - take.length) }
}

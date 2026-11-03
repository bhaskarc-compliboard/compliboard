/**
 * ADDING A DOCUMENT FROM INSIDE A CHAT — `docs/GAPS-PLAN.md` Part A step 3, decision 6.
 *
 * *** IT GOES IN THROUGH DOCUMENTS' OWN PATH, and that is the whole point. *** Storage, then
 * `POST /api/documents`. `app/audits/page.tsx:381`–`:427` `attachChecklist` already does this for a
 * checklist, for the reason its own comment gives: *"a checklist IS a document: it belongs in the
 * list, it gets read like anything else, and a second upload path would mean two places that
 * decide where a file lives."* The same is true of a file somebody attaches to a question. This is
 * those six steps, copied, with nothing about audits in them.
 *
 * *** WHAT IT ADDS TO THAT PATTERN, AND WHY EACH ONE. ***
 *
 *   · `from_topic_id` when the conversation already exists. `app/api/documents/route.ts:60`–`:66`
 *     already takes it and already proves the topic belongs to this caller (404, never 403), so
 *     Documents can say which conversation a file came from. When the file is attached BEFORE the
 *     first question there is no topic yet, and the engine backfills it.
 *
 *   · THE READING IS ASKED FOR AND NOT WAITED ON. `POST /api/document-scan` is a model call of 20
 *     to 120 seconds over the whole file. The answer does not need it — the answer reads the file
 *     itself — so waiting would make a person stare at a composer for two minutes for a reading
 *     that is for the Documents tab. Fired and dropped: the row says Queued until it lands, and
 *     the five-minute sweep picks it up if this call never arrives.
 *
 *   · ONE FILE, NEVER A FOLDER. A folder takes minutes to read and a chat cannot honestly say
 *     "wait here". Folders stay on the Documents tab (decision 6).
 *
 * *** EVERY FAILURE IS A SENTENCE, NEVER A THROW. *** This runs under a person's finger on a
 * composer. `CLAUDE.md` §5.1: say plainly whose problem it is, never imply the file is at fault
 * when we could not read it, and always say what they can do next.
 *
 * *** AND THE UPLOAD IS NOT GATED WHEN A COMPANY IS READ-ONLY. *** Read from the routes, not from
 * a comment: `POST /api/documents` calls `requireCompany` and no `requireAccess`; the storage
 * upload is a direct call under RLS with no route at all; `POST /api/document-scan` calls
 * `requireAccess` at `:53`. So the file is stored and the row is written, and only the READING
 * pauses — which is the rule `app/documents/page.tsx:382`–`:387` already follows.
 */
import { createClient, authHeaders } from './supabase.ts'
import { DOCUMENTS_BUCKET } from './storage.ts'

/** What the screen gets back: the file landed, or one sentence saying why not. */
export type ChatUploadResult =
  | { ok: true; documentId: string; name: string }
  | { ok: false; message: string }

/** The sentences this can say. Plain words, short, and never the person's fault. */
export const UPLOAD_WORDS = {
  noCompany: 'We could not tell which company this is. Try reloading the page.',
  uploadFailed: (name: string) => `We could not upload ${name}. Please try again.`,
  saveFailed: (name: string) => `We could not save ${name}. Please try again.`,
  tooMany: 'One file at a time here. Add a folder on the Documents tab.',
} as const

/** Storage keys are a path, so a name with a space or a slash in it has to be made safe. */
export const safeName = (name: string): string => name.replace(/[^\w.\-]/g, '_')

/**
 * The client this needs, as a shape rather than a type — so a test can hand it a stand-in.
 * `app/api/jobs/summarise/route.ts`'s `sweep(admin = supabaseAdmin)` is the same move for the same
 * reason, and its comment says it: an ES module namespace is frozen, so the only way to run this
 * without a database is to let the caller pass one.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UploadClient = any

export async function uploadToChat(
  file: File,
  /** The conversation this file is being attached to, when one exists yet. */
  topicId: string | null,
  supabase: UploadClient = createClient(),
): Promise<ChatUploadResult> {
  try {
    // 1. WHICH COMPANY. From the signed-in person, never from anything the screen holds.
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles')
      .select('company_id').eq('id', user?.id ?? '').single()
    const companyId = profile?.company_id
    if (!companyId) return { ok: false, message: UPLOAD_WORDS.noCompany }

    // 2. STORAGE. The path always begins with the owning company's id — migration 002, and
    //    `app/api/documents/route.ts:39` refuses a row pointing at another company's prefix.
    //    `unfiled`, because a chat has no folder: the person files it later, in the drawer.
    const path = `${companyId}/unfiled/${Date.now()}-${safeName(file.name)}`
    const { error: upErr } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file)
    if (upErr) {
      console.error('chat upload: storage refused', upErr.message)
      return { ok: false, message: UPLOAD_WORDS.uploadFailed(file.name) }
    }

    // 3. THE ROW, through Documents' own route. `from_topic_id` only when there is a topic —
    //    the route checks it belongs to this caller and 404s if not.
    const dbRes = await fetch('/api/documents', {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name: file.name,
        file_url: path,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        folder_id: null,
        ...(topicId ? { from_topic_id: topicId } : {}),
      }),
    })
    if (!dbRes.ok) {
      console.error(`chat upload: /api/documents -> ${dbRes.status}`)
      return { ok: false, message: UPLOAD_WORDS.saveFailed(file.name) }
    }
    const { id } = await dbRes.json()
    if (!id) return { ok: false, message: UPLOAD_WORDS.saveFailed(file.name) }

    /**
     * 4. ASK FOR THE READING, AND DO NOT WAIT FOR IT.
     *
     * Not awaited on purpose: the answer reads the file itself, so nothing on this screen depends
     * on the reading. A read-only company gets 402 here and that is correct — the file is saved,
     * the row says Queued, and the sweep reads it the day a card is added. The catch is what keeps
     * a refusal or a dropped request from becoming an unhandled rejection in the browser.
     */
    void (async () => {
      try {
        await fetch('/api/document-scan', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ document_id: id }),
        })
      } catch (e) {
        console.error('chat upload: the reading could not be started (the file is saved):', e)
      }
    })()

    return { ok: true, documentId: String(id), name: file.name }
  } catch (e) {
    console.error('chat upload failed:', e)
    return { ok: false, message: UPLOAD_WORDS.saveFailed(file.name) }
  }
}

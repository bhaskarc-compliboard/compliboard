/**
 * ADDING A DOCUMENT FROM INSIDE A CHAT — `docs/GAPS-PLAN.md` Part A step 3, decision 6.
 *
 * *** TESTED AT THE FETCH SEAM, with a stand-in `fetch` and a stand-in Supabase client. *** The
 * three things that matter are not what the function returns but WHAT IT CALLS and IN WHAT ORDER:
 * storage, then Documents' own route, then the reading — and the reading **not awaited**, because
 * a person is standing in front of a composer and a scan is 20 to 120 seconds.
 *
 * `global.fetch` is replaced and restored around each test; nothing here reaches the network, a
 * database or a model.
 */
import test, { describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { uploadToChat, UPLOAD_WORDS, safeName } from '../../lib/chatUpload.ts'

const SRC = readFileSync('lib/chatUpload.ts', 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** A File without a DOM: the three fields the upload reads. */
const file = (name = 'cert.pdf', type = 'application/pdf', size = 1234) =>
  ({ name, type, size }) as unknown as File

/** Every call the upload makes, in order, so the ORDER is the assertion. */
let calls: Array<{ what: string; body?: Record<string, unknown> }>
let scanResolve: (() => void) | null
let realFetch: typeof globalThis.fetch

/** Stand in for `lib/supabase`'s client, handed in as the third argument. */
function fakeSupabase(opts: { companyId?: string | null; uploadError?: string | null } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: opts.companyId === undefined
        ? { company_id: 'co1' } : { company_id: opts.companyId } }) }) }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          calls.push({ what: `storage:${bucket}`, body: { path } })
          return { error: opts.uploadError ? { message: opts.uploadError } : null }
        },
      }),
    },
  }
}

beforeEach(() => {
  calls = []
  scanResolve = null
  realFetch = globalThis.fetch
  globalThis.fetch = (async (url: string, init?: { body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : undefined
    calls.push({ what: String(url), body })
    if (String(url).includes('document-scan')) {
      // Held open, so "it did not wait" is a real observation and not a timing accident.
      await new Promise<void>((r) => { scanResolve = r })
      return { ok: true, json: async () => ({}) }
    }
    return { ok: true, json: async () => ({ id: 'doc-1' }) }
  }) as unknown as typeof globalThis.fetch
})
afterEach(() => { globalThis.fetch = realFetch; scanResolve?.() })

/**
 * Run the upload with a stand-in client.
 *
 * It is passed in rather than swapped on the module: an ES module namespace object is frozen, so
 * `mod.createClient = …` throws *"Cannot assign to read only property"*. The repository's own
 * answer to this is a default parameter — `sweep(admin = supabaseAdmin)` in
 * `app/api/jobs/summarise/route.ts`, whose comment says it exists for exactly this.
 */
const run = (topicId: string | null, opts?: Parameters<typeof fakeSupabase>[0]) =>
  uploadToChat(file(), topicId, fakeSupabase(opts))

/**
 * Let the fire-and-forget reading START without waiting for it to finish.
 *
 * *** THIS IS THE TEST'S WHOLE POINT, so it is worth saying why it is here. *** `uploadToChat`
 * returns BEFORE the scan request is even made — the request lives in a `void (async …)()`, whose
 * first `await` yields. Written without this drain the test saw two calls and failed, which was
 * the code being right and the test being impatient. One turn of the event loop separates
 * "it was asked for" from "it was waited on": after the drain the call is recorded, and
 * `scanResolve` is still unresolved, which is what proves nothing awaited it.
 */
const letTheScanStart = () => new Promise<void>((r) => setImmediate(r))

describe('the three calls, in order', () => {
  test('storage, then Documents\' own route, then the reading', async () => {
    const res = await run(null)
    assert.deepEqual(res, { ok: true, documentId: 'doc-1', name: 'cert.pdf' })
    await letTheScanStart()
    assert.equal(calls.length, 3, `expected three calls, got ${calls.map((c) => c.what).join(', ')}`)
    assert.match(calls[0].what, /^storage:/, 'the file is stored first')
    assert.equal(calls[1].what, '/api/documents', 'then the row, through Documents\' own route')
    assert.equal(calls[2].what, '/api/document-scan', 'then the reading is asked for')
  })

  test('the path begins with the company id and is unfiled — a chat has no folder', async () => {
    await run(null)
    await letTheScanStart()
    assert.match(String(calls[0].body?.path), /^co1\/unfiled\/\d+-cert\.pdf$/)
    // migration 002, and `app/api/documents/route.ts:39` refuses a row under another company's
    // prefix — so the prefix is not a convention, it is the thing that check reads.
    assert.equal(calls[1].body?.folder_id, null)
  })

  test('a name with spaces or slashes in it cannot become a path of its own', () => {
    assert.equal(safeName('Fire Cert (2026)/v2.pdf'), 'Fire_Cert__2026__v2.pdf')
  })
})

describe('from_topic_id is sent only when there is a conversation', () => {
  test('with a topic, the document remembers which conversation it came from', async () => {
    await run('topic-9')
    assert.equal(calls[1].body?.from_topic_id, 'topic-9')
  })

  test('with none, the field is absent — the engine backfills it once the topic exists', async () => {
    await run(null)
    assert.ok(!('from_topic_id' in (calls[1].body ?? {})),
      'sending null would be a value; the route ownership-checks whatever it is given')
  })
})

describe('the reading is asked for and NOT waited on', () => {
  test('the upload returns while the scan is still open', async () => {
    // The stand-in `fetch` holds the scan open until `scanResolve` is called, and this never
    // calls it before asserting — so a `return` here can only mean the upload did not await.
    const res = await run(null)
    // The upload has ALREADY returned, and at this instant the scan has not even been requested.
    assert.equal(res.ok, true)
    assert.equal(calls.length, 2, 'the upload returned before the reading was even asked for')
    await letTheScanStart()
    assert.equal(calls[2].what, '/api/document-scan', 'and then it was asked for')
    assert.ok(scanResolve, 'and it is STILL in flight, so nothing awaited it')
  })

  /**
   * The runtime test above is the proof. This is the shape that produces it, pinned so a later
   * edit cannot quietly pull the request out of the detached block.
   *
   * Note what is NOT asserted: that there is no `await fetch('/api/document-scan')`. There IS one
   * — inside the block — and that is right; an `await` within a detached async function is not an
   * await by the caller. Written the other way first, this test failed on correct code.
   */
  test('the source says so too: the request lives inside `void (async () => …)`', () => {
    const c = code(SRC)
    const detached = c.indexOf('void (async () => {')
    const request = c.indexOf("fetch('/api/document-scan'")
    assert.ok(detached > -1, 'the detached block is gone')
    assert.ok(request > detached, 'the reading must be asked for INSIDE the detached block')
    // And the function returns after it, so nothing between them can wait.
    assert.ok(c.indexOf('return { ok: true', detached) > request)
  })
})

describe('every failure is a sentence, never a throw (§5.1)', () => {
  test('no company: it says what to do, and blames nobody', async () => {
    const res = await run(null, { companyId: null })
    assert.deepEqual(res, { ok: false, message: UPLOAD_WORDS.noCompany })
    assert.match(UPLOAD_WORDS.noCompany, /Try reloading the page/)
    assert.equal(calls.length, 0, 'nothing was uploaded')
  })

  test('storage refused: our problem, named, with the file named too', async () => {
    const res = await run(null, { uploadError: 'boom' })
    assert.equal(res.ok, false)
    assert.equal((res as { message: string }).message, UPLOAD_WORDS.uploadFailed('cert.pdf'))
    assert.ok(!/your file|the file is bad|invalid/i.test((res as { message: string }).message),
      'never imply the person\'s file is at fault')
    assert.equal(calls.length, 1, 'no row was written for a file that is not there')
  })

  test('the row failed: it says so and does not ask for a reading of nothing', async () => {
    globalThis.fetch = (async (url: string) => {
      calls.push({ what: String(url) })
      return { ok: String(url).includes('document-scan'), json: async () => ({}) }
    }) as unknown as typeof globalThis.fetch
    const res = await run(null)
    await letTheScanStart()
    assert.equal(res.ok, false)
    assert.equal((res as { message: string }).message, UPLOAD_WORDS.saveFailed('cert.pdf'))
    assert.ok(!calls.some((c) => c.what.includes('document-scan')), 'no reading without a row')
  })

  test('and nothing it does can throw at the screen', () => {
    assert.match(code(SRC), /try \{/)
    assert.match(code(SRC), /catch \(e\) \{/)
    assert.ok(!/throw /.test(code(SRC)), 'it returns a sentence; it never throws')
  })
})

describe('it goes in through Documents\' own path, and adds no second one', () => {
  test('the row is written by the route, never by a direct insert', () => {
    const c = code(SRC)
    assert.match(c, /fetch\('\/api\/documents'/)
    assert.ok(!/\.from\('documents'\)/.test(c), 'a second way to write a document row is a second truth')
  })

  test('one file: no folder picker and no loop', () => {
    const c = code(SRC)
    assert.ok(!/webkitdirectory/i.test(c))
    assert.ok(!/for \(|\.map\(/.test(c.slice(c.indexOf('export async function uploadToChat'))),
      'it takes one File, not a list')
  })
})

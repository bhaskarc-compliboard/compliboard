/**
 * *** WAS THE FILE GONE, OR WAS STORAGE UNREACHABLE? *** — fix list **D6**, root R1, Job E4.
 *
 * `db.storage.download()` fails for two quite different reasons, and the product told the person the
 * same thing either way:
 *
 *     Upload it again — the record is here but the file is not.
 *
 * That is exactly right when the object is gone: the row outlived its file and the only way back is
 * a new upload. It is **wrong, and expensive, for everything else** — a timeout, a 5xx from the
 * storage service, a network drop, a token that expired mid-request. In those cases the file is
 * there, nothing needs uploading, and the sentence makes a person upload a **second copy** of a
 * document they already hold. Then both copies get read, both appear on the Documents page, and the
 * audit is shown two of everything.
 *
 * Worse, the reading is written as a FAILED reading either way — which until Job E's D1 fix also
 * withdrew every pending question the document's earlier readings had raised, and still makes the
 * failure the document's current state.
 *
 * **So the two are told apart, and only the first keeps the wording.** For anything else: say
 * storage was unreachable, in our own words, write **no reading at all**, and leave the document
 * where the sweep will pick it up again. `CLAUDE.md` §5.1 — when the failure is ours, say so, and
 * never imply the person did something wrong.
 *
 * *** WHY IT MATCHES ON THE MESSAGE AS WELL AS THE STATUS. *** The Storage client's error shape is
 * not one thing: `StorageApiError` carries `status`, `StorageUnknownError` does not, and the JS
 * client has also returned `statusCode` as a STRING ('404') from the REST layer. A missing object is
 * the one case we must be sure of, so all three are read, and anything unrecognised counts as
 * **unreachable** — the cautious direction, because it writes nothing and loses nothing.
 */

export interface StorageLikeError {
  message?: string | null
  /** `StorageApiError`. */
  status?: number | null
  /** The REST layer's, sometimes a string. */
  statusCode?: number | string | null
  name?: string | null
}

/** True only when we can tell the object itself is not there. */
export function fileIsMissing(error: StorageLikeError | null | undefined): boolean {
  if (!error) return false
  const code = Number(error.status ?? error.statusCode ?? NaN)
  if (code === 404) return true
  const m = String(error.message ?? '').toLowerCase()
  // Supabase Storage's own words for it, and the S3-style one underneath.
  return m.includes('object not found') || m.includes('not_found') || m.includes('nosuchkey')
}

/** What to tell a person when the file is genuinely gone. The wording that already shipped. */
export const FILE_GONE = {
  reason: 'We could not fetch the stored file for this document.',
  wayForward: 'Upload it again — the record is here but the file is not.',
} as const

/**
 * And when storage could not be reached. **No reading is written for this**, so these words reach
 * the person through the route's answer and the row's own status, not through a scan.
 */
export const STORAGE_UNREACHABLE = {
  reason: 'We could not reach the place your files are stored, so this one has not been read yet.',
  wayForward: 'Nothing about your file needs changing, and nothing needs uploading again. '
    + 'We will try it again on our next pass; press Read it again if you would rather not wait.',
} as const

/**
 * THE STORAGE BUCKET, NAMED ONCE — Fix Round 1 (B), `DECISIONS.md` §127.
 *
 * *** WHY THIS CONSTANT EXISTS. ***
 *
 * The bucket is `company-documents`. On 23 September an upload from the workspace failed with
 * `Error: Bucket not found`, and the cause was a fifth spelling of the name:
 *
 *     app/api/documents/route.ts:15   const BUCKET = 'company-documents'
 *     app/api/hr/route.ts:27          const BUCKET = 'company-documents'
 *     app/documents/page.tsx:256      storage.from('company-documents')
 *     app/compliance/page.tsx:262     storage.from('documents')        <- wrong, and mine
 *
 * A name written in four places is a name that will be written wrongly in a fifth. The two
 * `BUCKET` consts above were each right and each local, so neither could stop it.
 *
 * *** THIS IS THE SAME CLASS AS §98 AND §118, ONE LAYER DOWN. *** §3.6 already records it for
 * columns — "a column name inside a query string is invisible to tsc". A bucket name is the same
 * kind of string: `tsc` cannot see into it, the generated types do not cover storage, and the
 * failure arrives at runtime as four words with no file attached.
 */
export const DOCUMENTS_BUCKET = 'company-documents'

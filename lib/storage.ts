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

/**
 * WHERE HR KEEPS A HANDBOOK'S FILE — HR Step 3b (`docs/HR-PLAN.md` decisions 18 and 24).
 *
 * In the same bucket, inside the company's own folder, so the storage policies from migration 002
 * (first folder = the caller's company) cover it unchanged. The prefix is `handbooks` — NOT old HR's
 * `hr-handbooks`, whose two production files stay ordinary Documents rows (decision 25).
 *
 * *** EXACTLY TWO LEVELS: <company>/handbooks/<file>. *** Account delete removes a company's files by
 * listing `<company>/` and then each folder ONE level down (`app/api/account/route.ts`,
 * `listCompanyObjects`). A file one level deeper would survive a deletion the customer asked for. So
 * the file name may not carry a slash of its own: any `/` or `\` becomes `_`. `tests/unit/storage.test.ts`
 * holds the depth.
 */
export const HANDBOOKS_PREFIX = 'handbooks'

export function handbookPath(companyId: string, fileName: string, now: number = Date.now()): string {
  if (!companyId || /[/\\]/.test(companyId)) throw new Error('handbookPath: a company id with no slash is required')
  const safe = fileName.replace(/[/\\]/g, '_').replace(/^\.+/, '_').trim() || 'handbook'
  return `${companyId}/${HANDBOOKS_PREFIX}/${now}-${safe}`
}

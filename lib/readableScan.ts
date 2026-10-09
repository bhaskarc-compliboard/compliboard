/**
 * THE READING THAT COULD READ A DOCUMENT — `DECISIONS.md` §185a, migrations 075 and 076.
 *
 * **A reading that could not read the document owns its STATUS and nothing else.** Its words — the
 * gaps it found, the conditions, the dates, the summary, the title and the agencies — belong to the
 * last reading that could.
 *
 * The rule is defined once, in SQL, as `document_index_v.readable_scan_id` (migration 076, from the
 * same `readable` CTE `document_dates_current_v` uses). This file is how code asks for it, so no
 * caller re-derives "the latest scan whose status is not could_not_read" and gets it subtly
 * different — `status` is nullable, for one, so the obvious `status <> 'could_not_read'` drops a
 * null-status scan.
 *
 * *** WHICH SITES USE THIS, AND WHICH MUST NOT. ***
 *   · A reader of a document's CONTENT or IDENTITY takes the readable scan. Found by the A3e sweep:
 *     `lib/audit.ts`, `app/api/audits/index/route.ts`, `app/api/documents/report/route.ts`,
 *     `app/api/documents/index/route.ts`, `lib/auditRun.ts`, `lib/attachedDocument.ts`,
 *     `lib/companyLabels.ts` and `lib/documentScan.ts`'s own context.
 *   · A reader that WATCHES FOR A RE-READ keeps the current scan: `components/DocumentReport.tsx`
 *     (`:285`, `:296`, `:441`) knows a re-read has landed when `scan_id` changes, and a re-read that
 *     failed has landed just as much as one that worked.
 *
 * Why it was needed, proved on staging (`scripts/calendar-a3b-failed-reread.mjs`): migration 076 put
 * a permit back into its agency's audit, and the audit then handed the model the permit's TITLE and
 * NOTHING ELSE — because `lib/audit.ts:157` read its content by the current scan, which was the
 * failed one. "Nothing on file" had become "the permit is on file and says nothing about this",
 * which is the more convincing wrong answer.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export interface ReadableScan {
  documentId: string
  /** The scan that could read it. Null when no reading of this document has ever succeeded. */
  scanId: string | null
  /** When that reading ran — the date the screens show as "read on". */
  scannedAt: string | null
  /** True when the CURRENT reading is not that one, i.e. the latest attempt failed. */
  fromAnEarlierReading: boolean
}

/**
 * The readable scan for each of `documentIds`, or for the whole company when none are named.
 *
 * It reads the view rather than `document_scans`, so the definition lives in exactly one place. A
 * document with no successful reading is present with `scanId: null` rather than missing, because
 * "never read" and "not asked about" are different and a caller must be able to tell them apart.
 */
export async function readableScans(
  db: Db, companyId: string, documentIds?: string[],
): Promise<Map<string, ReadableScan>> {
  let q = db.from('document_index_v')
    .select('document_id, readable_scan_id, scanned_at, identity_from_an_earlier_reading')
    .eq('company_id', companyId)
  if (documentIds) {
    if (!documentIds.length) return new Map()
    q = q.in('document_id', documentIds)
  }
  const { data, error } = await q
  // *** AN ERROR IS NOT AN EMPTY RESULT *** (`CLAUDE.md` §9a). Returning an empty map here would tell
  // every caller "no document has ever been read", and each would then quietly show nothing.
  if (error) throw new Error(`the readable readings could not be read: ${error.message}`)

  const out = new Map<string, ReadableScan>()
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    out.set(r.document_id as string, {
      documentId: r.document_id as string,
      scanId: (r.readable_scan_id as string) ?? null,
      scannedAt: (r.scanned_at as string) ?? null,
      fromAnEarlierReading: r.identity_from_an_earlier_reading === true,
    })
  }
  return out
}

/** Just the ids, for an `.in('scan_id', …)`. Documents never read are simply absent from the list. */
export async function readableScanIds(
  db: Db, companyId: string, documentIds?: string[],
): Promise<string[]> {
  const m = await readableScans(db, companyId, documentIds)
  return [...m.values()].map((r) => r.scanId).filter((x): x is string => !!x).sort()
}

/**
 * The readable reading for ONE document, without a company id.
 *
 * For the single caller that has none: `describeAttachments(db, topicId)`
 * (`lib/attachedDocument.ts`), which both the Workspace and HR use. Giving it a `companyId` would
 * mean changing its signature and its caller in `app/api/chat/route.ts`, which is more than the swap
 * §185a asks for.
 *
 * *** IT IS SAFE BECAUSE OF RLS, NOT BECAUSE OF THE ID. *** `document_index_v` is
 * `security_invoker = true`, and the one caller passes `authed.db` — the caller's own client
 * (`app/api/chat/route.ts:119`, `:214`) — so another company's document is simply not there. Do not
 * call this with the service-role client: it would see every company's rows, and the document id
 * would be the only thing scoping it.
 */
export async function readableScanForDocument(db: Db, documentId: string): Promise<ReadableScan | null> {
  const { data, error } = await db.from('document_index_v')
    .select('document_id, readable_scan_id, scanned_at, identity_from_an_earlier_reading')
    .eq('document_id', documentId).maybeSingle()
  if (error) throw new Error(`the readable reading could not be read: ${error.message}`)
  if (!data) return null
  return {
    documentId: data.document_id as string,
    scanId: (data.readable_scan_id as string) ?? null,
    scannedAt: (data.scanned_at as string) ?? null,
    fromAnEarlierReading: data.identity_from_an_earlier_reading === true,
  }
}

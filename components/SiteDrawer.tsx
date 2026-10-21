'use client'

/**
 * ONE SITE, OPENED IN THE DRAWER — My Account step 6, board 1b.
 *
 * It is the product's one `Drawer` (`components/Drawer.tsx`), the same object a date, a document's
 * report and an audit open in, with the same scrim the callers draw and the shared `Sheet` for the
 * one confirmation. Nothing here is a second drawer.
 *
 * *** WHAT IT CAN AND CANNOT WRITE IS MIGRATION 082'S, NOT THIS FILE'S. *** A person may change a
 * site's `name` and `address` and nothing else: `state`, `county`, `city` and `postal_code` are
 * written by `/api/sites` from the geocoder, `is_primary` is in no column grant at all, and the
 * main site cannot be deleted. So this file POSTS a name and an address, and READS the rest back
 * from the row (decision 4). It never sends a field it only displays.
 *
 * *** "REMOVE THIS SITE" ASKS THE DATABASE FIRST, AND IT IS THE DATABASE'S ANSWER THAT IS SHOWN. ***
 * `public.site_removal_refusal(uuid)` is SECURITY DEFINER and granted to `authenticated`
 * (migration 082), so the drawer can ask "may this go?" and get back either null or the exact
 * sentence the BEFORE DELETE trigger would refuse with. The button is then disabled and the
 * sentence shown in place. Writing that sentence here instead would be two copies of a refusal, and
 * the copy on the page is the one that would drift — and the stakes are the whole point: the seven
 * relations it counts are ON DELETE CASCADE, so a wrong "yes" destroys obligations that no policy
 * lets a person delete (`DECISIONS.md` §207 B).
 *
 * *** AND THE THREE COUNTS ARE READS, NOT CLAIMS. *** `lib/calendarCounts.ts`'s own `liveDates` for
 * the dates, `audit_runs` at the status `lib/auditView.ts` says counts, and `/api/switches/ask` for
 * what is still open. A read that fails leaves its line out rather than printing a zero (§9a).
 */
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Drawer } from './Drawer'
import { Sheet } from './Sheet'
import { PRIMARY, OUTLINE, TEXT_ACTION } from './buttonStyles'
import { liveDates } from '@/lib/calendarCounts'
import { AUDIT_DONE, AUDIT_RUN_ROW_COLUMNS, runName } from '@/lib/auditView'
import { authHeaders } from '@/lib/supabase'
import { NOT_FOUND_SENTENCE } from '@/lib/geocode'
import {
  SITE_NAME_LABEL, SITE_ADDRESS_LABEL, ON_THIS_SITE, REMOVE_SITE, NEW_SITE_TITLE, NEW_SITE_SUB,
  COUNTY_LABEL, COUNTY_HELP, SAVE, CANCEL, NOTHING_ON_SITE, REMOVE_SITE_CONFIRM,
  sitePlaceLine, siteDrawerSub, siteCountLines, siteIsEmpty,
  type SiteRow, type SiteCounts,
} from '@/lib/accountView'

const BLANK_COUNTS: SiteCounts = { dates: null, audits: null, lastAudit: null, answered: null, open: null }

const FIELD =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-900 ' +
  'focus:border-[var(--green)] focus:outline-none disabled:bg-gray-50 disabled:text-gray-500'
const LABEL = 'block text-[12px] font-medium text-gray-600'
const GREY = 'text-[12.5px] leading-5 text-gray-500'

export function SiteDrawer({ site, db, companyName, onClose, onSaved }: {
  /** The row to edit, or null for "+ Add a site". */
  site: SiteRow | null
  db: SupabaseClient
  companyName: string | null
  onClose: () => void
  /** The page reloads its own list; this hands back the saved row for anything that needs it. */
  onSaved: (saved: SiteRow) => void
}) {
  const [name, setName] = useState(site?.name ?? '')
  const [address, setAddress] = useState(site?.address ?? '')
  const [county, setCounty] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The geocoder's sentence for THIS save, and whether to offer the county box. */
  const [notFound, setNotFound] = useState(false)
  /** The row as last read back from the database — never the response's own account of itself. */
  const [row, setRow] = useState<SiteRow | null>(site)
  const [counts, setCounts] = useState<SiteCounts>(BLANK_COUNTS)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const siteId = row?.id ?? null

  /**
   * *** "NEW" IS ABOUT THE ROW, NOT ABOUT HOW THE DRAWER OPENED. ***
   * It was `site === null`, which froze at the moment the drawer opened — so after saving a brand
   * new site the drawer still said "Add a site" and still drew no grey line and no "On this site",
   * for a site that by then existed and had been read back. Measured on the isolated server at
   * step 6 before it was fixed. Once `row` is filled, this is an ordinary site being edited.
   */
  const isNew = row === null

  /**
   * WHAT IS ON THIS SITE. Four reads, each left out of the lines when it fails.
   *
   * The dates read is `liveDates` with one `eq`, so this number and the Calendar's are the same
   * number by construction rather than by agreement.
   */
  const loadCounts = useCallback(async (id: string) => {
    const next: SiteCounts = { ...BLANK_COUNTS }

    const dates = await liveDates(db, 'id', true).eq('entity_id', id)
    if (!dates.error && typeof dates.count === 'number') next.dates = dates.count

    const audits = await db
      .from('audit_runs').select(AUDIT_RUN_ROW_COLUMNS)
      .eq('entity_id', id).eq('status', AUDIT_DONE)
      .order('finished_at', { ascending: false, nullsFirst: false })
    if (!audits.error && audits.data) {
      next.audits = audits.data.length
      const newest = audits.data[0]
      if (newest) next.lastAudit = { name: runName(newest), on: newest.finished_at ?? newest.created_at ?? null }
    }

    // A row exists only once something answered it, and `known` is what an answer leaves
    // (`switch_state`); `unknown` and `needs_user` are not answers and are not counted as ones.
    const answered = await db
      .from('company_switches').select('id', { count: 'exact', head: true })
      .eq('entity_id', id).eq('state', 'known')
    if (!answered.error && typeof answered.count === 'number') next.answered = answered.count

    try {
      const res = await fetch(`/api/switches/ask?entity_id=${encodeURIComponent(id)}`, {
        headers: await authHeaders(),
      })
      if (res.ok) {
        const j = await res.json()
        // `ready` is what can be asked about this site NOW — not a count of questions remaining,
        // which would assert a denominator the coverage strip says we do not have (§58.3).
        if (Array.isArray(j?.ready)) next.open = j.ready.length
      }
    } catch { /* the line is left out, which is the honest empty */ }

    setCounts(next)
  }, [db])

  useEffect(() => {
    if (siteId) loadCounts(siteId)
  }, [siteId, loadCounts])

  /** Whether this site may be removed, asked of the database (migration 082). */
  const askRemoval = useCallback(async (id: string) => {
    const { data, error: rpcError } = await db.rpc('site_removal_refusal', { p_entity_id: id })
    if (rpcError) {
      // *** A REFUSAL WE COULD NOT READ IS A REFUSAL. *** The alternative is offering a button
      // whose press runs a cascade across seven relations on the strength of a query that failed.
      setRefusal('We could not check whether this site can be removed. Try again in a moment.')
      return
    }
    setRefusal(typeof data === 'string' && data ? data : null)
  }, [db])

  useEffect(() => {
    if (siteId) askRemoval(siteId)
  }, [siteId, askRemoval])

  async function save() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const body = isNew
        ? { name, address, county }
        : { id: row?.id, name, address, county }
      const res = await fetch('/api/sites', {
        method: isNew ? 'POST' : 'PATCH',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) { setError(j?.error ?? 'We could not save that site just now.'); return }

      /**
       * *** THE ROW IS READ BACK, NOT TAKEN FROM THE RESPONSE'S WORD. *** `/api/sites` returns the
       * row it wrote, and that is what is shown — the state and county on screen are the columns as
       * the database now holds them, which is the only version that matters to a jurisdiction
       * match. The geocoder's own report is used ONLY to decide whether to say "we could not find
       * that address" and offer the county box.
       */
      const saved = j?.site as SiteRow
      setRow(saved)
      setCounty('')
      setNotFound(Boolean(j?.geocode && j.geocode.matched === false && j.geocode.ask_county))
      onSaved(saved)
    } catch {
      setError('We could not save that site just now.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (busy || !row) return
    setBusy(true)
    setError(null)
    // Asked again, immediately before the delete: the drawer may have been open a while, and a
    // colleague filing a document against this site in another tab is exactly the case where a
    // stale "yes" would destroy rows.
    const { data, error: rpcError } = await db.rpc('site_removal_refusal', { p_entity_id: row.id })
    if (rpcError || (typeof data === 'string' && data)) {
      setRefusal(typeof data === 'string' && data ? data : 'We could not check whether this site can be removed.')
      setConfirming(false)
      setBusy(false)
      return
    }
    // As the person. The BEFORE DELETE trigger is still the thing that decides, and its message is
    // what is shown if it refuses — this is the second lock, not the only one.
    const { error: delError } = await db.from('entities').delete().eq('id', row.id)
    setBusy(false)
    setConfirming(false)
    if (delError) { setRefusal(delError.message); return }
    onClose()
  }

  const shown: SiteRow = row ?? {
    id: '', name: null, address: null, postal_code: null,
    state: null, county: null, city: null, is_primary: false,
  }
  const lines = siteCountLines(counts)
  const isMain = Boolean(row?.is_primary)
  const canRemove = Boolean(row) && !isMain

  return (
    <>
      <div className="no-print fixed inset-0 z-[45] bg-gray-900/20" onClick={onClose} />
      <Drawer
        title={isNew ? NEW_SITE_TITLE : (row?.name || NEW_SITE_TITLE)}
        sub={isNew ? NEW_SITE_SUB : siteDrawerSub(shown)}
        company={companyName}
        printType="Site"
        onClose={onClose}
        footer={
          <>
            <button type="button" disabled={busy || !name.trim() || !address.trim()}
              onClick={save} className={PRIMARY}>{SAVE}</button>
            <button type="button" onClick={onClose} className={TEXT_ACTION}>{CANCEL}</button>
            {canRemove && (
              <button type="button"
                disabled={busy || refusal !== null}
                onClick={() => setConfirming(true)}
                className={`ml-auto ${OUTLINE}`}>{REMOVE_SITE}</button>
            )}
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="site-name">{SITE_NAME_LABEL}</label>
            <input id="site-name" type="text" value={name} disabled={busy}
              onChange={(e) => setName(e.target.value)}
              placeholder="Portland plant" className={`mt-1 ${FIELD}`} />
          </div>

          <div>
            <label className={LABEL} htmlFor="site-address">{SITE_ADDRESS_LABEL}</label>
            {/*
              *** ONE LINE, NOT FOUR BOXES, AND THE GEOCODER IS THE REASON. *** The Census Bureau's
              `onelineaddress` endpoint takes exactly this: street, city, state and ZIP in one
              string (`lib/geocode.ts`). Splitting it into four fields would mean joining them back
              together before the call, so the four boxes would be decoration over the one value
              that is actually sent — and a person who types "2140 NW Yeon Ave, Portland, OR 97210"
              from a letterhead would have to take it apart by hand. The service's own structured
              endpoint exists, but it refuses an address it cannot slot into street/city/state/zip,
              which turns a typo in one box into a flat no-match rather than a near miss.
            */}
            <input id="site-address" type="text" value={address} disabled={busy}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="2140 NW Yeon Ave, Portland, OR 97210" className={`mt-1 ${FIELD}`} />
          </div>

          {/* Board 1b's grey line: what the address gave us. Read off the ROW. */}
          {!isNew && <p className={GREY}>{sitePlaceLine(shown)}</p>}

          {notFound && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
              {/* §5.1: it says what we could not do and what they can do, and blames nobody. */}
              <p className="text-[13px] text-gray-800">{NOT_FOUND_SENTENCE}</p>
              <label className={`mt-3 ${LABEL}`} htmlFor="site-county">{COUNTY_LABEL}</label>
              <input id="site-county" type="text" value={county} disabled={busy}
                onChange={(e) => setCounty(e.target.value)}
                placeholder="Multnomah" className={`mt-1 ${FIELD}`} />
              <p className="mt-1 text-[12px] text-gray-500">{COUNTY_HELP}</p>
            </div>
          )}

          {error && <p className="text-[13px] text-[var(--amber)]">{error}</p>}

          {!isNew && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-gray-500">{ON_THIS_SITE}</p>
              {lines.length === 0 ? (
                <p className={`mt-2 ${GREY}`}>&nbsp;</p>
              ) : siteIsEmpty(counts) ? (
                <p className={`mt-2 ${GREY}`}>{NOTHING_ON_SITE}</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {lines.map((l) => <li key={l} className="text-[14px] text-gray-800">{l}</li>)}
                </ul>
              )}

              {/* The database's own sentence, in place, with the button already disabled. */}
              {refusal && !isMain && (
                <p className="mt-4 text-[13px] leading-5 text-[var(--amber)]">{refusal}</p>
              )}
              {isMain && (
                <p className="mt-4 text-[13px] leading-5 text-gray-500">
                  This is your main site, so it cannot be removed — its address is your company&apos;s address.
                </p>
              )}
            </div>
          )}
        </div>
      </Drawer>

      {confirming && row && (
        <Sheet title={REMOVE_SITE}
          lede={`${row.name ?? 'This site'} will be removed. Nothing is attached to it, so nothing else goes with it.`}
          onClose={() => setConfirming(false)}>
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy} onClick={remove} className={PRIMARY}>{REMOVE_SITE_CONFIRM}</button>
            <button type="button" onClick={() => setConfirming(false)} className={TEXT_ACTION}>{CANCEL}</button>
          </div>
        </Sheet>
      )}
    </>
  )
}

export default SiteDrawer

'use client'
/**
 * NIGHT WATCH — the owner's page. `docs/GAPS-PLAN.md` decision 75 (the owner, 4 November 2026).
 *
 * A table of counts with deltas; each count expands to its row ids as links into the product.
 *
 * *** IT IS LINKED FROM NOWHERE, ON PURPOSE. *** It is not in the app's sidebar and it is not in
 * any nav. `/requirements` is the precedent (`PENDING.md` S5). The address is the owner's to type,
 * and `/api/quality` answers 404 to everybody else, so an unlinked page is not the security —
 * `requireOwner` is.
 *
 * *** AND A CONVERSATION LINKS TO ITS SECTION, NOT TO ITSELF. *** Grepped before this was written:
 * the only parameters any page reads are `?run=`, `?document=` and `?checklist=`. **There is no
 * `?topic=` anywhere.** So a conversation hit lands on its section's page with the topic id in its
 * words to paste. Inventing a parameter nothing reads is D15's defect, and this page will not add
 * a ninth one — it is recorded as owed in `docs/GAPS-PLAN.md` §8 instead.
 *
 * Every sentence comes from `lib/qualityWords.ts`, which imports nothing.
 */
import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authHeaders } from '@/lib/supabase'
import {
  COUNTERS, COST_TITLE, NIGHT_WATCH, NIGHT_WATCH_LEDE, NO_ROW_YET,
  PULSE_TITLE, PULSE_WHY, deltaWord,
} from '@/lib/qualityWords'

interface Hit { id: string; company_id: string; what: string; href: string | null }
interface Report { date: string; company_id: string | null; counts: Record<string, unknown>; rows: Record<string, Hit[]> }
interface Answer { days: string[]; reports: Report[]; companies: Record<string, string> }

const n = (v: unknown): number => (typeof v === 'number' ? v : 0)

export default function NightWatchPage() {
  const [data, setData] = useState<Answer | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'closed' | 'error'>('loading')
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/quality?days=14', { headers: await authHeaders() })
      if (res.status === 404) { setState('closed'); return }
      if (!res.ok) { setState('error'); return }
      setData(await res.json())
      setState('ok')
    } catch { setState('error') }
  }, [])

  useEffect(() => { void load() }, [load])

  if (state === 'loading') return <main className="p-8 text-[13px] text-gray-500">Reading…</main>
  // The page says exactly what the route says, and the route says 404 — so this says nothing more.
  if (state === 'closed') return <main className="p-8 text-[13px] text-gray-500">Not found.</main>
  if (state === 'error') return <main className="p-8 text-[13px] text-gray-500">Could not read the report just now.</main>

  const days = data?.days ?? []
  const today = days[0] ?? null
  const before = days[1] ?? null
  const totalsFor = (day: string | null) =>
    data?.reports.find((r) => r.date === day && r.company_id === null) ?? null
  const totals = totalsFor(today)
  const priorTotals = totalsFor(before)
  const perCompany = (data?.reports ?? []).filter((r) => r.date === today && r.company_id !== null)

  const priorOf = (key: string): number | null => {
    if (!priorTotals) return null
    const v = priorTotals.counts[key]
    return typeof v === 'number' ? v : null
  }

  const hitsFor = (key: string): Array<Hit & { company: string }> =>
    perCompany.flatMap((r) => (r.rows[key] ?? []).map((h) => ({
      ...h, company: data?.companies[String(r.company_id)] ?? String(r.company_id),
    })))

  const cost = (totals?.counts.cost ?? null) as
    | { usd: number; calls: number; unpriced: number
        by_task: Array<{ task: string; usd: number; calls: number; avg7: number; over_2x: boolean }>
        top_companies: Array<{ company_id: string; usd: number; calls: number }> }
    | null
  const pulse = (totals?.counts.pulse ?? []) as Array<{ job: string; minutes_ago: number | null; open_rows: number }>

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-10">
      <h1 className="font-serif text-[28px] leading-[34px] text-[#14171A]">{NIGHT_WATCH}</h1>
      <p className="mt-2 max-w-[620px] text-[13px] leading-[19px] text-gray-600">{NIGHT_WATCH_LEDE}</p>
      <p className="mt-3 text-[13px] text-gray-500">
        {today ? <>Showing <span className="font-medium text-gray-800">{today}</span>, Pacific
          {before ? <> · deltas against {before}</> : <> · no earlier day to compare</>}</> : NO_ROW_YET}
      </p>

      {!totals ? null : (
        <>
          <table className="mt-7 w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">Count</th>
                <th className="w-[72px] py-2 pr-3 text-right font-medium">Yesterday</th>
                <th className="w-[200px] py-2 pr-3 font-medium">Against the day before</th>
                <th className="w-[64px] py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {COUNTERS.map((c, i) => {
                const here = n(totals.counts[c.key])
                const rows = hitsFor(c.key)
                const isOpen = open === c.key
                return (
                  // The key belongs on the FRAGMENT, not on the first <tr> inside it: a counter
                  // renders one row, or two when its ids are open, and React keys the outermost
                  // element of each list item. Caught by the dev overlay on the first walk.
                  <Fragment key={c.key}>
                    <tr className={i % 2 ? 'bg-gray-50/60' : undefined}>
                      <td className="py-2.5 pr-3 align-top">
                        <span className={here ? 'font-medium text-[#14171A]' : 'text-gray-700'}>{c.title}</span>
                        {c.scope === 'now' ? <span className="ml-2 text-[11px] text-gray-500">right now</span> : null}
                        <p className="mt-0.5 text-[12px] leading-[17px] text-gray-500">{c.why}</p>
                      </td>
                      <td className={`py-2.5 pr-3 text-right align-top tabular-nums ${here ? 'font-semibold text-[#B7791F]' : 'text-gray-400'}`}>{here}</td>
                      <td className="py-2.5 pr-3 align-top text-[12px] text-gray-600">{deltaWord(here, priorOf(c.key))}</td>
                      <td className="py-2.5 align-top text-right">
                        {rows.length ? (
                          <button type="button" onClick={() => setOpen(isOpen ? null : c.key)}
                            className="text-[12px] text-[#2F7D52] underline underline-offset-2">
                            {isOpen ? 'Hide' : `Open ${rows.length}`}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={4} className="border-y border-gray-200 bg-white px-3 py-3">
                          <p className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">
                            First found {c.found}
                          </p>
                          <ul className="space-y-1.5">
                            {rows.map((h) => (
                              // The LINK is a short word and the detail is plain text beside it.
                              // The first walk underlined the whole line, and `sections_unparsed`
                              // carries 200 characters of raw JSON in its words — underlined, that
                              // is unreadable, and the detail is the part a person is here to read.
                              <li key={h.id} className="text-[12px] leading-[17px]">
                                <span className="text-gray-500">{h.company}</span>{' · '}
                                <span className="text-gray-700">{h.what}</span>
                                {h.href
                                  ? <Link href={h.href} className="ml-2 whitespace-nowrap text-[#2F7D52] underline underline-offset-2">Open →</Link>
                                  : null}
                                <code className="ml-2 text-[11px] text-gray-400">{h.id}</code>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          <h2 className="mt-9 text-[13px] font-medium text-[#14171A]">{PULSE_TITLE}</h2>
          <p className="mt-1 text-[12px] text-gray-500">{PULSE_WHY}</p>
          <ul className="mt-2 space-y-1">
            {pulse.map((p) => (
              <li key={p.job} className="text-[12px] text-gray-700">
                <span className="font-medium">{p.job}</span>{' · '}
                {p.minutes_ago === null ? 'never run' : `last started ${p.minutes_ago} min ago`}
                {p.open_rows ? <span className="text-[#B7791F]">{` · ${p.open_rows} row(s) left open`}</span> : null}
              </li>
            ))}
          </ul>

          <h2 className="mt-9 text-[13px] font-medium text-[#14171A]">{COST_TITLE}</h2>
          {cost ? (
            <>
              <p className="mt-1 text-[12px] text-gray-700">
                ${cost.usd.toFixed(4)} over {cost.calls} call{cost.calls === 1 ? '' : 's'}
                {cost.unpriced
                  ? <span className="text-[#B7791F]">{` · ${cost.unpriced} call(s) had no price for the model, so this total is LOW`}</span>
                  : null}
              </p>
              <ul className="mt-2 space-y-1">
                {cost.by_task.map((t) => (
                  <li key={t.task} className="text-[12px] text-gray-700">
                    <span className="font-medium">{t.task}</span>{` · $${t.usd.toFixed(4)} · ${t.calls} call${t.calls === 1 ? '' : 's'} · `}
                    {t.over_2x
                      ? <span className="font-medium text-[#B7791F]">{`over twice its 7-day average of $${t.avg7.toFixed(4)}`}</span>
                      : <span className="text-gray-500">{`7-day average $${t.avg7.toFixed(4)}`}</span>}
                  </li>
                ))}
              </ul>
              <ul className="mt-2 space-y-1">
                {cost.top_companies.map((t) => (
                  <li key={t.company_id} className="text-[12px] text-gray-600">
                    {data?.companies[t.company_id] ?? t.company_id}{` · $${t.usd.toFixed(4)} · ${t.calls} call${t.calls === 1 ? '' : 's'}`}
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="mt-1 text-[12px] text-gray-500">No cost on this day.</p>}
        </>
      )}
    </main>
  )
}

'use client'
/**
 * AN ANSWER ON THE PAGE — Run 3, `DECISIONS.md` §126.
 *
 * Three jobs, and each was a visible defect in Run 1:
 *
 *   1. **Markdown is RENDERED.** Run 1 printed the model's raw output, so tables arrived as rows
 *      of `|` and lists as stray asterisks. `react-markdown` + `remark-gfm` — GFM is what turns a
 *      pipe table into a table; react-markdown alone leaves the pipes.
 *   2. **A citation marker `[n]` opens a card** with the source's title, its domain and a link,
 *      rather than being a number with nothing behind it (§106).
 *   3. **Junk titles are replaced** — `lib/sourceTitle.ts`, which has the reasoning and the tests.
 *
 * *** THE MARKERS ARE SPLIT OUT BEFORE MARKDOWN RUNS, NOT AFTER. *** Letting markdown render
 * first and then walking the DOM for `[1]` would also rewrite a `[1]` inside a code block or a
 * URL. Splitting the text first means only real markers become buttons, and the surrounding
 * prose is still handed to the renderer whole.
 */
import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { displaySource } from '@/lib/sourceTitle'

export interface AnswerSource { n: number; title: string; url: string }

/** The markdown components, so prose reads like prose and a table reads like a table. */
const MD = {
  p: (p: React.HTMLAttributes<HTMLParagraphElement>) => <p className="mb-3 leading-relaxed" {...p} />,
  ul: (p: React.HTMLAttributes<HTMLUListElement>) => <ul className="mb-3 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: React.HTMLAttributes<HTMLOListElement>) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...p} />,
  li: (p: React.HTMLAttributes<HTMLLIElement>) => <li className="leading-relaxed" {...p} />,
  strong: (p: React.HTMLAttributes<HTMLElement>) => <strong className="font-semibold text-gray-900" {...p} />,
  h1: (p: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="mt-5 mb-2 text-base font-semibold text-gray-900" {...p} />,
  h2: (p: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="mt-5 mb-2 text-base font-semibold text-gray-900" {...p} />,
  h3: (p: React.HTMLAttributes<HTMLHeadingElement>) => <h4 className="mt-4 mb-2 text-sm font-semibold text-gray-900" {...p} />,
  // A table needs its own horizontal scroll: a wide one must not push the whole page sideways.
  table: (p: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="mb-3 overflow-x-auto"><table className="w-full border-collapse text-[13px]" {...p} /></div>
  ),
  th: (p: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left font-semibold" {...p} />
  ),
  td: (p: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-gray-200 px-2.5 py-1.5 align-top" {...p} />
  ),
  code: (p: React.HTMLAttributes<HTMLElement>) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 text-[12.5px]" {...p} />
  ),
  a: (p: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-emerald-700 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...p} />
  ),
}

/** Splits on citation markers so only real `[n]` become buttons. */
function segments(text: string): Array<{ type: 'md'; text: string } | { type: 'cite'; n: number }> {
  const out: Array<{ type: 'md'; text: string } | { type: 'cite'; n: number }> = []
  const re = /\[(\d{1,2})\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'md', text: text.slice(last, m.index) })
    out.push({ type: 'cite', n: Number(m[1]) })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'md', text: text.slice(last) })
  return out
}

function CiteMarker({ n, source }: { n: number; source?: AnswerSource }) {
  const [open, setOpen] = useState(false)
  const shown = source ? displaySource(source.title, source.url) : null
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="no-print mx-0.5 rounded bg-emerald-50 px-1 align-super text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
        aria-label={`Source ${n}`}
      >{n}</button>
      {/* On paper the marker is a plain number: the printed sources list carries the URL. */}
      <span className="hidden print:inline align-super text-[10px]">[{n}]</span>
      {open && shown && (
        <span className="absolute left-0 top-full z-30 mt-1 block w-72 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">Source {n}</span>
          <span className="mt-1 block text-[13px] font-medium leading-snug text-gray-900">{shown.title}</span>
          <span className="mt-0.5 block text-[11px] text-gray-500">{shown.host}</span>
          <a href={source!.url} target="_blank" rel="noopener noreferrer"
             className="mt-2 inline-block text-[12px] font-medium text-emerald-700 underline">Open source</a>
        </span>
      )}
      {open && !shown && (
        <span className="absolute left-0 top-full z-30 mt-1 block w-64 rounded-lg border border-gray-200 bg-white p-3 text-[12px] text-gray-500 shadow-lg">
          This marker has no source behind it. That is a fault in the answer, not something you did.
        </span>
      )}
    </span>
  )
}

export function AnswerBody({ text, sources }: { text: string; sources: AnswerSource[] }) {
  const byN = new Map(sources.map((s) => [s.n, s]))
  return (
    <div className="text-[15px] text-gray-800">
      {segments(text).map((seg, i) =>
        seg.type === 'cite'
          ? <CiteMarker key={i} n={seg.n} source={byN.get(seg.n)} />
          : <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={MD as never}>{seg.text}</ReactMarkdown>,
      )}
    </div>
  )
}

/**
 * THE SOURCES LIST. Not `no-print`: on paper it is the only way a citation can be followed, and
 * the print rule in `globals`/page CSS appends each URL after its title.
 */
export function SourceList({ sources }: { sources: AnswerSource[] }) {
  if (!sources.length) return null
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sources</h4>
      <ol className="space-y-1.5">
        {sources.map((s) => {
          const shown = displaySource(s.title, s.url)
          return (
            <li key={s.n} className="flex gap-2 text-[13px] leading-snug">
              <span className="shrink-0 text-gray-400">{s.n}.</span>
              <span>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                   className="text-emerald-800 underline underline-offset-2">{shown.title}</a>
                {' '}<span className="text-gray-400">{shown.host}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

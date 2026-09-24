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
 * *** THE MARKDOWN IS PARSED WHOLE, AND THE MARKER TRAVELS INSIDE IT. *** Run 3 split the text
 * on `[n]` and rendered each piece separately, which cut any table containing a marker in half —
 * Fix Round 1 (D). `lib/citations.ts` now rewrites each marker into an inline markdown link
 * (`[1](#cb-cite-1)`) BEFORE parsing, so block structure survives, and the `a` component below
 * turns links with that href into the source card. Walking the rendered DOM instead would also
 * rewrite a `[1]` inside a code block; rewriting the source keeps that distinction.
 */
import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { displaySource } from '@/lib/sourceTitle'
import { markCitations, citationNumber } from '@/lib/citations'

export interface AnswerSource { n: number; title: string; url: string }

/**
 * The markdown components, so prose reads like prose and a table reads like a table.
 *
 * *** EVERY ONE DROPS `node`. *** react-markdown passes the mdast node as a prop; spreading it
 * into a DOM element put `node="[object Object]"` on every tag in the answer — invalid HTML and
 * a React warning per element. Found while fixing the table (D).
 */
type MdProps<T> = T & { node?: unknown }
const drop = <T,>({ node: _node, ...rest }: MdProps<T>) => rest as T

const MD = {
  // *** THE WRAPPER OWNS THE LEADING, NOT THE PARAGRAPH. *** `leading-relaxed` is 1.625 and the
  // wrapper is 1.65; two line-heights one notch apart on the same text is the kind of difference
  // nobody can see and everybody has to reason about. The paragraph keeps only its spacing.
  p: (p: MdProps<React.HTMLAttributes<HTMLParagraphElement>>) => <p className="mb-3" {...drop(p)} />,
  ul: (p: MdProps<React.HTMLAttributes<HTMLUListElement>>) => <ul className="mb-3 list-disc space-y-1 pl-5" {...drop(p)} />,
  ol: (p: MdProps<React.HTMLAttributes<HTMLOListElement>>) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...drop(p)} />,
  li: (p: MdProps<React.HTMLAttributes<HTMLLIElement>>) => <li className="leading-relaxed" {...drop(p)} />,
  strong: (p: MdProps<React.HTMLAttributes<HTMLElement>>) => <strong className="font-semibold text-gray-900" {...drop(p)} />,
  h1: (p: MdProps<React.HTMLAttributes<HTMLHeadingElement>>) => <h3 className="mt-6 mb-2 font-serif text-[19px] font-semibold text-gray-900" {...drop(p)} />,
  h2: (p: MdProps<React.HTMLAttributes<HTMLHeadingElement>>) => <h3 className="mt-6 mb-2 font-serif text-[19px] font-semibold text-gray-900" {...drop(p)} />,
  h3: (p: MdProps<React.HTMLAttributes<HTMLHeadingElement>>) => <h4 className="mt-4 mb-2 text-sm font-semibold text-gray-900" {...drop(p)} />,
  // A TABLE STAYS SANS. It is data being scanned, not prose being read, and Plex has tabular
  // numerals for exactly this — a serif column of figures does not line up.
  // It also needs its own horizontal scroll: a wide one must not push the whole page sideways.
  table: (p: MdProps<React.HTMLAttributes<HTMLTableElement>>) => (
    <div className="mb-3 overflow-x-auto"><table className="w-full border-collapse font-sans text-[14px]" {...drop(p)} /></div>
  ),
  th: (p: MdProps<React.HTMLAttributes<HTMLTableCellElement>>) => (
    <th className="border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left font-semibold" {...drop(p)} />
  ),
  td: (p: MdProps<React.HTMLAttributes<HTMLTableCellElement>>) => (
    <td className="border border-gray-200 px-2.5 py-1.5 align-top" {...drop(p)} />
  ),
  code: (p: MdProps<React.HTMLAttributes<HTMLElement>>) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 text-[13px]" {...drop(p)} />
  ),
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
        className="no-print ml-0 mr-0.5 rounded bg-[var(--green-wash)] px-1 align-super text-[10px] font-semibold text-[var(--green)] hover:bg-[var(--green-wash)]"
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

  // The one place a link is inspected: a citation href becomes the marker, anything else stays
  // an ordinary link. Defined here because it needs the sources this answer carries.
  const components = {
    ...MD,
    a: (p: MdProps<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => {
      const n = citationNumber(p.href)
      if (n !== null) return <CiteMarker n={n} source={byN.get(n)} />
      return (
        <a className="text-emerald-700 underline underline-offset-2"
           target="_blank" rel="noopener noreferrer" {...drop(p)} />
      )
    },
  }

  return (
    <div className="font-serif text-[17px] leading-[1.65] text-gray-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components as never}>
        {markCitations(text)}
      </ReactMarkdown>
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

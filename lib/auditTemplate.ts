// READING A CHECKLIST — Audits Run 4b, item 6.
//
// *** THIS IS THE ONE PLACE AUDITS READS A FILE, AND THE REASON IS THE DIRECTION. ***
// An agency audit reads no files at all: it reads what the Documents section already made of them —
// `HANDOFF-AUDITS.md` §4's whole point, and why an audit cannot contradict a document's own reading.
// A checklist is not evidence. It is the QUESTION: somebody hands us their auditor's field form or
// their own monthly sheet and asks to be measured against it. A question has to be read before it
// can be asked, and no other part of the product has read it.
//
// So `parseDocumentToBlocks` is called here, once, on the attached file — the same shared parser the
// document scan uses (§HANDOFF §6: "shared code every section uses and must not copy").
//
// *** IT EXTRACTS, IT DOES NOT JUDGE. *** This call knows nothing about the company and is shown no
// document of theirs. It turns a form into sections and lines and stops. Auditing against those
// lines is `runSection`'s job, with the same input an agency audit gets. Two calls, two jobs: a call
// that both read the form and judged it would be reasoning about a document while reading it, which
// is how the old engine enumerated a standard from nothing (§3.3).

import { createHash } from 'node:crypto'

import { askAIWithCitations, extractJsonText, modelForTask, type AIContent } from './ai.ts'
import { parseDocumentToBlocks } from './documentContent.ts'

export interface TemplateLine { ref: string; text: string }
export interface TemplateSection { title: string; lines: TemplateLine[] }

export interface ExtractedTemplate {
  sections: TemplateSection[]
  /**
   * *** A COMPANY NAME PRINTED ON THE FORM, IF IT CARRIES ONE — Run 5a, item 6. ***
   * The model refused a checklist outright when it named a company other than the one being
   * audited: "the checklist is for CASCADE SPECIALTY CHEMICALS but the company information says…".
   * The objection is worth keeping and the refusal is not: a person auditing themselves against
   * somebody else's form is doing something normal — an auditor's field form, a trade body's
   * template. So the name is READ, said out loud on the run, and the audit proceeds.
   */
  companyName: string | null
  /** Plain, for the run's summary when there is nothing to audit against. */
  note: string | null
  model: string
  prompt_sha256: string
  raw_text: string
  json_parsed: boolean
}

/**
 * *** THE PROMPT LIVES HERE AND NOT IN `prompts/` FOR ONE REASON, NAMED. ***
 * `HANDOFF-AUDITS.md` §6 puts every prompt in `prompts/`, and this is the exception: it is six
 * sentences that describe a JSON shape and nothing about compliance, so there is no wording anybody
 * would tune. If it ever grows an opinion — about what counts as a line, or how to number one — it
 * moves to `prompts/audit-template.ts` and this comment is the note saying so.
 */
const EXTRACT = `You are reading a compliance checklist so it can be answered line by line.

Return the sections and the lines, and nothing else. Do not answer them. Do not judge anything. Do
not add a line the document does not have.

Respond with valid JSON only. No markdown, no backticks, no text around it.

{
  "company_name": "the company this form names, if it names one, else null",
  "sections": [
    {
      "title": "the section heading as written, or a short description if it has none",
      "lines": [
        { "ref": "the line's own reference as printed — A2, B4, 7 — or null if it has none",
          "text": "the line as written, word for word" }
      ]
    }
  ]
}

"company_name" is whatever company the form is printed for or about, verbatim. Many forms name
nobody; that is null, not a guess. Do not judge whether it is the right company — that is not your
question here.

A form with no headings is one section; give it a title that says what the form is.
A line's "text" is what the form asks, verbatim. If a line is a heading with nothing under it, it is
a section, not a line.
If the document is not a checklist — it answers nothing, asks nothing, or is prose — return
{"sections": []} and nothing else.`

/**
 * One call, task `audit`, over the attached file.
 *
 * *** A FILE WITH NO LINES IS NOT AN ERROR. *** Somebody attaches a permit by mistake, or a photo of
 * a whiteboard. The honest answer is a run with zero sections and one sentence saying what happened,
 * which is what `createRun` does with an empty `sections` — §5.1: an empty state is a message, and
 * "nothing found" is a claim that has to be true.
 */
export async function extractTemplate(args: {
  buffer: ArrayBuffer; fileName: string; fileType: string; companyId: string
}): Promise<ExtractedTemplate> {
  const model = modelForTask('audit')
  const promptSha = createHash('sha256').update(EXTRACT).digest('hex')

  const parsed = await parseDocumentToBlocks(args.buffer, args.fileName, args.fileType)
  if (!parsed.ok) {
    return {
      sections: [], companyName: null, model, prompt_sha256: promptSha, raw_text: '', json_parsed: false,
      // The parser's own message, because it knows what was wrong with the file and this does not.
      note: `We could not open that file: ${parsed.failure.message}`,
    }
  }

  const content: AIContent = [
    ...parsed.blocks,
    { type: 'text', text: `File name: ${args.fileName}\n\nRead this checklist.` },
  ] as AIContent

  let raw = ''
  try {
    // No web search: a checklist is a closed document and there is nothing to look up in order to
    // list what it asks.
    const answer = await askAIWithCitations(EXTRACT, content, {
      maxTokens: 8000, enableWebSearch: false,
      task: 'audit', ledger: { companyId: args.companyId, task: 'audit' },
    })
    raw = answer.text ?? ''
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      sections: [], companyName: null, model, prompt_sha256: promptSha, raw_text: '', json_parsed: false,
      note: `We could not read that checklist just now: ${message}`,
    }
  }

  let obj: Record<string, unknown> | null = null
  try { obj = JSON.parse(extractJsonText(raw)) as Record<string, unknown> } catch { obj = null }
  if (!obj) {
    return {
      sections: [], companyName: null, model, prompt_sha256: promptSha, raw_text: raw.slice(0, 20000), json_parsed: false,
      note: 'That checklist came back in a shape we could not read, so there is nothing to audit '
        + 'against. The file is on file; nothing else happened.',
    }
  }

  const sections = shapeSections(obj)
  const companyName = typeof obj.company_name === 'string' && obj.company_name.trim()
    ? obj.company_name.trim().slice(0, 200) : null
  return {
    sections, companyName, model, prompt_sha256: promptSha, raw_text: raw.slice(0, 20000), json_parsed: true,
    note: sections.length ? null
      : 'We could not find any checklist lines in that file. If it is a checklist, the lines may be '
        + 'in a picture rather than in text. Nothing was audited.',
  }
}

/**
 * *** THE REFS ARE THE DOCUMENT'S WHERE IT HAS THEM, AND OURS WHERE IT DOES NOT. ***
 * A form that prints A1, A2, B1 is answered with those, because the person reads our report beside
 * their form. A form with bare bullets gets 1, 2, 3 per section — numbered here, in code, so the
 * numbering is stable across runs rather than whatever the model felt like that time. Stability is
 * the point: "line 4 changed from nothing on file to on file" is only meaningful if line 4 is the
 * same line it was last month.
 */
export function shapeSections(obj: Record<string, unknown>): TemplateSection[] {
  const raw = Array.isArray(obj.sections) ? (obj.sections as unknown[]) : []
  const out: TemplateSection[] = []

  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const sec = s as Record<string, unknown>
    const title = typeof sec.title === 'string' && sec.title.trim()
      ? sec.title.trim().slice(0, 300) : 'The checklist'
    const lines: TemplateLine[] = []
    const rawLines = Array.isArray(sec.lines) ? (sec.lines as unknown[]) : []

    for (const l of rawLines) {
      // A bare string is a line with no reference; the model is asked for objects and given the
      // benefit of the doubt when it sends the simpler thing.
      const item = (typeof l === 'string' ? { text: l } : l) as Record<string, unknown>
      if (!item || typeof item !== 'object') continue
      const text = typeof item.text === 'string' ? item.text.trim() : ''
      if (!text) continue
      const given = typeof item.ref === 'string' ? item.ref.trim() : ''
      lines.push({
        ref: (given || String(lines.length + 1)).slice(0, 40),
        text: text.slice(0, 1000),
      })
    }

    // A section with no lines is a heading, and a heading is not a question.
    if (lines.length) out.push({ title, lines })
  }
  return out
}

/** How many lines a whole template asks, for the run's own counts. */
export const countLines = (sections: TemplateSection[]) =>
  sections.reduce((n, s) => n + s.lines.length, 0)

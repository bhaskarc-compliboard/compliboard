import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import officeParser from 'officeparser'
import { ACCEPTED_FILE_TYPES_PROSE } from './acceptedFiles.ts'

/**
 * TURNS AN UPLOADED FILE INTO CONTENT BLOCKS THE MODEL CAN ACTUALLY READ.
 *
 * One implementation, four callers: /api/chat, /api/audits, /api/extract-dates, /api/hr.
 *
 * WHY THIS EXISTS. The same branching was written four times and no two copies agreed.
 * /api/extract-dates read Excel, CSV, Word and PowerPoint. /api/audits read Word and
 * PowerPoint but not Excel or CSV. /api/hr read PDFs and images ONLY — not because it
 * could not parse the rest, but because the parsers had never been wired into it, and the
 * restriction was written up as though it were a property of the format. And /api/chat
 * silently fell through to sending the FILE NAME ALONE for anything that was not a PDF or
 * an image: the document's contents never reached the model, and the answer came back
 * confident and uninformed.
 *
 * Four copies of a branch is four chances to disagree, and they took all four.
 *
 * WHAT IT RETURNS. Content blocks only — never the caller's own instruction text. Each
 * route composes its own question, because that is the part that legitimately differs:
 *
 *     const result = await parseDocumentToBlocks(buffer, name, type)
 *     if (!result.ok) return <the failure, described>
 *     const content = [...result.blocks, { type: 'text', text: myInstruction }]
 *
 * A FORMAT WE CANNOT READ RETURNS A DESCRIBED FAILURE, NEVER AN EMPTY RESULT. Following
 * app/api/hr/route.ts, whose comments record why: a .docx used to be base64'd and labelled
 * image/jpeg, which produced confident nonsense rather than an error. A document that
 * cannot be read must say so, by name, with what to do about it.
 */

export type ContentBlock = Record<string, unknown>

export type DocumentParseFailure = {
  name: string
  reason: 'unsupported_format'
  extension: string
  /** Plain language, addressed to the person who uploaded it. CLAUDE.md §5. */
  message: string
}

export type DocumentParseResult =
  | {
      ok: true
      blocks: ContentBlock[]
      kind: DocumentKind
      /**
       * THE FILE'S TEXT, WHEN WE CAN GET IT — and it is not the same thing as the blocks.
       *
       * For everything but PDF and image the two are the same string: the block IS the text.
       * For a PDF they are different and that difference is the point. The PDF goes to the model
       * whole, as a native document block, because it reads layout and scanned pages better than
       * any extraction would. But nothing downstream could then check a quote against the file,
       * so `verifyQuote` returned null for every fact on every PDF this product has ever read —
       * 73 proposals, 73 nulls, and a "quote not found in the file" warning that could not fire.
       *
       * So a PDF is parsed a second time, for text only. The text is NOT sent to the model and
       * never becomes a block: it exists to be compared against.
       *
       * Empty for an image, and empty for a PDF that is a photograph of a page — which is the
       * honest answer there. No text to check against is not the same as a quote being wrong,
       * and `verifyQuote` keeps returning null rather than false for exactly that reason.
       */
      text: string
    }
  | { ok: false; failure: DocumentParseFailure }

export type DocumentKind = 'pdf' | 'image' | 'excel' | 'csv' | 'text' | 'word' | 'powerpoint'

/** Extension → media type, for the cases where a stored file has no recorded MIME type. */
const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp',
}

export function extensionOf(name: string): string {
  const base = (name || '').split('?')[0]
  const dot = base.lastIndexOf('.')
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase()
}

export function describeUnsupported(name: string, ext: string): DocumentParseFailure {
  return {
    name,
    reason: 'unsupported_format',
    extension: ext,
    message:
      `"${name}" is a ${ext ? '.' + ext : 'file of unknown'} format, which cannot be read here. ` +
      `${ACCEPTED_FILE_TYPES_PROSE} can be. Re-upload it as a PDF to include it.`,
  }
}

/**
 * A PDF'S TEXT, FOR CHECKING QUOTES AGAINST — never for sending to the model.
 *
 * Returns '' rather than throwing. Three real cases produce no text and none of them is a
 * failure: a scanned page (an image inside a PDF wrapper), an encrypted file, and a generator
 * that writes glyphs with no text layer. In every one of those the document still goes to the
 * model whole and is read; only the quote check goes quiet, which is what it did before.
 */
async function pdfText(nodeBuffer: Buffer): Promise<string> {
  try {
    // *** THE `fileType` HINT IS NOT OPTIONAL HERE, AND LEAVING IT OUT FAILS ONLY IN NEXT. ***
    // officeparser sniffs the format from the buffer's magic bytes using a detection library the
    // bundler does not carry into the server build, so the same call that returns 4,003
    // characters from a plain `node` script throws inside a route:
    //
    //   [OfficeParser]: Auto-detection of file type from buffer failed … Please provide the
    //   'fileType' hint in your configuration
    //
    // Found by probing the route rather than by reading the scan's output, because the catch
    // below turns it into an empty string and an empty string is exactly what this function
    // returned before it existed. A test that passes outside the server and fails inside it is
    // the reason `console.warn` is here too: a quiet '' looks identical to a scanned page.
    //
    // We already know the format — this branch is only reached for a PDF — so the hint costs
    // nothing and removes the guess.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await (officeParser as any).parseOffice(nodeBuffer, { fileType: 'pdf' })
    const text = typeof out === 'string' ? out : String(out?.toText?.() ?? '')
    return text.trim() ? text : ''
  } catch (e) {
    console.warn('pdf text extraction failed; quotes on this document cannot be checked:',
      e instanceof Error ? e.message : e)
    return ''
  }
}

export async function parseDocumentToBlocks(
  buffer: ArrayBuffer,
  fileName: string,
  fileType: string | null
): Promise<DocumentParseResult> {
  const type = fileType || ''
  const ext = extensionOf(fileName)
  const nodeBuffer = Buffer.from(buffer)

  const isPDF = type === 'application/pdf' || ext === 'pdf'
  const imageMedia = type.startsWith('image/') ? type : IMAGE_TYPES[ext]
  const isExcel = type.includes('spreadsheet') || type.includes('excel') || ext === 'xlsx' || ext === 'xls'
  const isCSV = type === 'text/csv' || ext === 'csv'
  // text/plain is NEW — it existed in no copy of this branching before 11 Sep, which is
  // why a .txt reached the model as a filename and nothing else.
  const isText = type === 'text/plain' || ext === 'txt'
  const isWord = type.includes('wordprocessingml') || type.includes('msword') || ext === 'docx' || ext === 'doc'
  const isPowerPoint = type.includes('presentationml') || type.includes('powerpoint') || ext === 'pptx' || ext === 'ppt'

  // PDF and image go to the model as native blocks — it reads them better than any text
  // extraction would, including layout and scanned pages.
  if (isPDF) {
    return {
      ok: true, kind: 'pdf',
      blocks: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: nodeBuffer.toString('base64') } }],
      // Extraction NEVER decides whether the file can be read. A PDF we cannot pull text out of
      // is still a PDF the model reads perfectly well, so a throw here returns '' and the file
      // goes on exactly as before — the only thing lost is the quote check, which is what was
      // being lost anyway. `officeparser` is already a dependency of this module.
      text: await pdfText(nodeBuffer),
    }
  }
  if (imageMedia) {
    return {
      ok: true, kind: 'image',
      blocks: [{ type: 'image', source: { type: 'base64', media_type: imageMedia, data: nodeBuffer.toString('base64') } }],
      // A photograph has no text to extract. Quotes against it stay unverifiable, not false.
      text: '',
    }
  }

  if (isExcel) {
    const workbook = XLSX.read(nodeBuffer, { type: 'buffer', cellDates: true })
    let text = ''
    for (const sheetName of workbook.SheetNames) {
      text += `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}\n\n`
    }
    return { ok: true, kind: 'excel', blocks: [{ type: 'text', text }], text }
  }
  if (isCSV || isText) {
    const text = new TextDecoder().decode(buffer)
    return { ok: true, kind: isCSV ? 'csv' : 'text', blocks: [{ type: 'text', text }], text }
  }
  if (isWord) {
    // HTML rather than raw text: it preserves table structure, and a handbook's or an
    // SDS's meaning often lives in its tables.
    const result = await mammoth.convertToHtml({ buffer: nodeBuffer })
    return { ok: true, kind: 'word', blocks: [{ type: 'text', text: result.value }], text: result.value }
  }
  if (isPowerPoint) {
    // The same hint as `pdfText` above, and for the same reason: auto-detection from a buffer
    // does not survive the server build. `.ppt` is the old binary format, which officeparser
    // does not list as supported at all — it is left to fail as it always has rather than be
    // given a hint that claims it is something it is not.
    const ast = ext === 'pptx'
      ? await (officeParser as any).parseOffice(nodeBuffer, { fileType: 'pptx' })
      : await (officeParser as any).parseOffice(nodeBuffer)
    const text = ast.toText()
    return { ok: true, kind: 'powerpoint', blocks: [{ type: 'text', text }], text }
  }

  return { ok: false, failure: describeUnsupported(fileName, ext) }
}

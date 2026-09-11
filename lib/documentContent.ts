import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import officeParser from 'officeparser'
import { ACCEPTED_FILE_TYPES_PROSE } from '@/lib/acceptedFiles'

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
  | { ok: true; blocks: ContentBlock[]; kind: DocumentKind }
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
    }
  }
  if (imageMedia) {
    return {
      ok: true, kind: 'image',
      blocks: [{ type: 'image', source: { type: 'base64', media_type: imageMedia, data: nodeBuffer.toString('base64') } }],
    }
  }

  if (isExcel) {
    const workbook = XLSX.read(nodeBuffer, { type: 'buffer', cellDates: true })
    let text = ''
    for (const sheetName of workbook.SheetNames) {
      text += `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}\n\n`
    }
    return { ok: true, kind: 'excel', blocks: [{ type: 'text', text }] }
  }
  if (isCSV || isText) {
    return {
      ok: true, kind: isCSV ? 'csv' : 'text',
      blocks: [{ type: 'text', text: new TextDecoder().decode(buffer) }],
    }
  }
  if (isWord) {
    // HTML rather than raw text: it preserves table structure, and a handbook's or an
    // SDS's meaning often lives in its tables.
    const result = await mammoth.convertToHtml({ buffer: nodeBuffer })
    return { ok: true, kind: 'word', blocks: [{ type: 'text', text: result.value }] }
  }
  if (isPowerPoint) {
    const ast = await (officeParser as any).parseOffice(nodeBuffer)
    return { ok: true, kind: 'powerpoint', blocks: [{ type: 'text', text: ast.toText() }] }
  }

  return { ok: false, failure: describeUnsupported(fileName, ext) }
}

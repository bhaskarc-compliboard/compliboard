import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import officeParser from 'officeparser'
import {
  ACCEPTED_FILE_TYPES_PROSE, COULD_NOT_OPEN_WORDS, IMAGE_FALLBACK_WORDS, READABLE_EXTENSIONS,
  extensionOf, refusalFor,
} from './acceptedFiles.ts'
import { ImageTooLargeError, convertImage } from './imageConvert.ts'

/**
 * TURNS AN UPLOADED FILE INTO CONTENT BLOCKS THE MODEL CAN ACTUALLY READ.
 *
 * One implementation. Three callers since the audit engine went (Run 3, 30 September 2026):
 * /api/chat, /api/extract-dates, /api/hr. The document scan is the fourth.
 *
 * WHY THIS EXISTS. The same branching was written four times and no two copies agreed.
 * /api/extract-dates read Excel, CSV, Word and PowerPoint. The old audit route read Word and
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
 * old HR's app/api/hr/route.ts (deleted at the HR go-live, 8 October 2026), whose comments
 * recorded why: a .docx used to be base64'd and labelled image/jpeg, which produced confident nonsense rather than an error. A document that
 * cannot be read must say so, by name, with what to do about it.
 */

export type ContentBlock = Record<string, unknown>

export type DocumentParseFailure = {
  name: string
  /**
   * *** TWO DIFFERENT FAILURES, BECAUSE THEY ARE TWO DIFFERENT SENTENCES — B1, decision 51. ***
   *
   * `unsupported_format` is a type we do not read: `.doc`, a HEIC, something unrecognised. We
   * refuse it before opening it, it costs nothing, and the way out is to save it as something
   * else.
   *
   * `could_not_open` is a type we DO read that would not open — a truncated `.docx`, an empty
   * file. Telling that person to "save it as .docx" is useless, so it has its own words. Before
   * B1 this case was not a failure at all: mammoth or officeparser threw, the throw left
   * `runDocumentScan` entirely, and the sweep's last-resort catch wrote *"Something went wrong at
   * our end"* — true of nothing, and the sentence decision 51 exists to delete.
   */
  reason: 'unsupported_format' | 'could_not_open'
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
      /**
       * *** THE CONVERTED COPY TO STORE BESIDE THE ORIGINAL — B2, decision 53. ***
       *
       * Set only when something was actually converted: a HEIC, a TIFF, a BMP, or an image too
       * big for the caps. `null` for a PDF, a spreadsheet, and for a JPEG that was already fine —
       * which is the honest difference between "converted" and "never needed converting", and the
       * reason `documents.converted_url` is nullable rather than derived from the document's id.
       *
       * **This function stores nothing.** It has no database and no company, and giving it either
       * would make the one shared parser depend on the one thing its seven callers do not share.
       * The caller that owns a `documents` row writes it to
       * `<company>/converted/<documentId>.jpg` — two levels, because `app/api/account/route.ts`
       * walks exactly two when a customer asks to be deleted (`lib/storage.ts`).
       *
       * Only the first page of a multi-page TIFF: `converted_url` is one column, a document is
       * one row, and what the binder and "Open the file" need is one file anything can open.
       */
      converted?: { bytes: Buffer; mediaType: string } | null
      /** What was done to it, in plain words, for the report and the log. */
      note?: string
    }
  | { ok: false; failure: DocumentParseFailure }

export type DocumentKind = 'pdf' | 'image' | 'excel' | 'csv' | 'text' | 'word' | 'powerpoint'

/**
 * Extension → media type, for the cases where a stored file has no recorded MIME type.
 *
 * *** SINCE B2 THIS IS NOT THE SAME LIST AS WHAT THE API TAKES. *** The four below `webp` are
 * read by the product and refused by the model API; `lib/imageConvert.ts` turns each into a JPEG
 * before it is sent, and holds the list of what the API itself takes, because that is where the
 * decision "send this one as it is" is made.
 */
const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp',
}


/**
 * Every image media type the PRODUCT reads, as a set — for a photo stored with the right media
 * type and no extension. **It replaced `type.startsWith('image/')`**, which is the line that let
 * HEIC, TIFF and BMP through to be refused by the API (`docs/VISION-DOCUMENTS.md` §"File types",
 * B1 of `docs/GAPS-PLAN.md` Part B). Derived from the map above so the two cannot part company —
 * which since B2 means it includes the four the API itself will not take, because the product
 * converts those before sending them.
 */
const IMAGE_MEDIA = new Set(Object.values(IMAGE_TYPES))

/**
 * *** `extensionOf` LIVES IN `lib/acceptedFiles.ts` NOW AND IS RE-EXPORTED HERE. ***
 * It is re-exported rather than moved because `lib/handbookRead.ts:23` imports it from this file,
 * and because the alternative — a second copy — is the drift B1 is about. The refusal rule needs
 * it in the import-free module (a picker is a client component; this file carries three parsers).
 */
export { extensionOf } from './acceptedFiles.ts'

/**
 * A TYPE WE DO NOT READ. The sentence is the type's own, from `lib/acceptedFiles.ts`
 * `REFUSAL_WORDS` — the same string the picker shows, so a file refused in the browser and the
 * same file refused on the server say one thing and not two.
 *
 * *** THE OLD SENTENCE IS GONE AND IT WAS THE WRONG SHAPE. *** It read `"x.doc" is a .doc format,
 * which cannot be read here. PDFs, images, Excel… can be. Re-upload it as a PDF to include it.` —
 * which recites the catalogue at somebody holding one file and tells them to convert it to PDF
 * when saving it as `.docx` is easier and keeps the text. `ACCEPTED_FILE_TYPES_PROSE` is still
 * used, for the one case where there is nothing specific to say.
 */
export function describeUnsupported(name: string, ext: string): DocumentParseFailure {
  return {
    name,
    reason: 'unsupported_format',
    extension: ext,
    message: refusalFor(name) ?? `We cannot read this file. ${ACCEPTED_FILE_TYPES_PROSE} can be read.`,
  }
}

/**
 * AN ACCEPTED TYPE THAT WOULD NOT OPEN. The throw itself goes to the log, never to the customer
 * (`CLAUDE.md` §5: two messages, two audiences) — `Corrupted zip: can't find end of central
 * directory` is not a sentence anybody can act on.
 */
export function describeCouldNotOpen(name: string, ext: string, e: unknown): DocumentParseFailure {
  console.warn(`document parse: ${ext ? '.' + ext : 'a file'} named ${JSON.stringify(name)} is an `
    + 'accepted type and could not be opened:', e instanceof Error ? e.message : e)
  return { name, reason: 'could_not_open', extension: ext, message: COULD_NOT_OPEN_WORDS }
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

  /**
   * *** THE REFUSAL COMES FIRST, BEFORE A SINGLE BYTE IS OPENED — B1, decision 51. ***
   *
   * One call, one list (`lib/acceptedFiles.ts`), and it is the same call every picker makes. A
   * type we do not read costs nothing: no buffer copy, no parser, and — because this function is
   * the first thing `runDocumentScan` does — no model call and no cost row.
   *
   * It also closes the hole that `image/*` was. The branches below used to begin
   * `type.startsWith('image/') ? type : IMAGE_TYPES[ext]`, which sent a HEIC, a TIFF and a BMP
   * straight to the model API with their own media type on them, and the API refused each one.
   * Now `imageMedia` can only ever be one of the five `IMAGE_TYPES` names.
   */
  const refusal = refusalFor(fileName, fileType)
  if (refusal) return { ok: false, failure: describeUnsupported(fileName, ext) }

  const nodeBuffer = Buffer.from(buffer)

  /**
   * *** EACH BRANCH CLAIMS ONLY WHAT IT READS. ***
   * `isWord` claimed `.doc` and `type.includes('msword')`, and `isPowerPoint` claimed `.ppt` and
   * `powerpoint`; both then handed the file to a parser that reads the modern format only, which
   * is why `describeUnsupported` below was unreachable and a customer was told the product had
   * broken. The gate above would catch a `.doc` by extension in any case — these are narrowed as
   * well so that **a `.doc` mislabelled `application/msword` with no extension at all** cannot
   * reach mammoth either. Two doors on one room, and the inner one is cheap.
   */
  const isPDF = type === 'application/pdf' || ext === 'pdf'
  const imageMedia = IMAGE_TYPES[ext] ?? (IMAGE_MEDIA.has(type) ? type : undefined)
  const isExcel = type.includes('spreadsheet') || type.includes('excel') || ext === 'xlsx' || ext === 'xls'
  const isCSV = type === 'text/csv' || ext === 'csv'
  // text/plain is NEW — it existed in no copy of this branching before 11 Sep, which is
  // why a .txt reached the model as a filename and nothing else.
  const isText = type === 'text/plain' || ext === 'txt'
  const isWord = type.includes('wordprocessingml') || ext === 'docx'
  const isPowerPoint = type.includes('presentationml') || ext === 'pptx'

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
    /**
     * *** EVERY IMAGE GOES THROUGH ONE RULE NOW — B2, decisions 52 and 53. ***
     *
     * `convertImage` decodes what the API cannot read (HEIC, TIFF, BMP), measures every image
     * against the same caps, and re-encodes only one that fails a cap. `lib/imageConvert.ts`
     * carries the numbers and why each is what it is. What matters here is the three answers:
     *
     *   · `pages` — one block each. A still photograph has one; a multi-page TIFF has one per
     *     page, up to twenty, which is where the API starts applying a stricter size limit to
     *     every image in the request.
     *   · `converted` — the copy to store beside the original, when something was converted.
     *     The caller stores it; this function has no database and should not grow one.
     *   · a THROW is a sentence, never a crash. An image that will not decode is a file we
     *     accepted and could not open, so it gets `IMAGE_FALLBACK_WORDS` — B1's image sentences,
     *     kept and turned from a refusal into a fallback — and never "Something went wrong at
     *     our end" (decision 51).
     */
    try {
      const converted = await convertImage(nodeBuffer, ext, imageMedia)
      return {
        ok: true, kind: 'image',
        blocks: converted.pages.map((p) => ({
          type: 'image',
          source: { type: 'base64', media_type: p.mediaType, data: p.bytes.toString('base64') },
        })),
        // A photograph has no text to extract. Quotes against it stay unverifiable, not false.
        text: '',
        converted: converted.stored
          ? { bytes: converted.stored.bytes, mediaType: converted.stored.mediaType }
          : null,
        note: converted.note,
      }
    } catch (e) {
      if (e instanceof ImageTooLargeError) {
        console.warn(`document parse: ${JSON.stringify(fileName)} is ${e.megapixels.toFixed(1)} `
          + 'megapixels and was refused before decoding (lib/imageConvert.ts MAX_MEGAPIXELS)')
        return { ok: false, failure: {
          name: fileName, reason: 'could_not_open', extension: ext,
          message: IMAGE_FALLBACK_WORDS.tooBig(e.megapixels),
        } }
      }
      console.warn(`document parse: the image ${JSON.stringify(fileName)} could not be opened:`,
        e instanceof Error ? e.message : e)
      return { ok: false, failure: {
        name: fileName, reason: 'could_not_open', extension: ext,
        message: IMAGE_FALLBACK_WORDS.couldNotOpen,
      } }
    }
  }

  if (isExcel) {
    // A SPREADSHEET THAT WILL NOT OPEN IS A SENTENCE, NOT A THROW (B1). `XLSX.read` throws on a
    // truncated or password-protected workbook, and the throw used to leave `runDocumentScan`
    // altogether and land on the route's "something went wrong at our end".
    let text = ''
    try {
      const workbook = XLSX.read(nodeBuffer, { type: 'buffer', cellDates: true })
      for (const sheetName of workbook.SheetNames) {
        text += `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}\n\n`
      }
    } catch (e) {
      return { ok: false, failure: describeCouldNotOpen(fileName, ext, e) }
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
    //
    // THE `try` IS B1's, AND THE THROW IT CATCHES IS REAL. Run on `tests/fixtures/file-types`,
    // mammoth answers a truncated `.docx` with `Corrupted zip: can't find end of central
    // directory`. A `.docx` is accepted, so this is not a refusal: it is a file we said we would
    // read and could not, and it gets `COULD_NOT_OPEN_WORDS`.
    let html: string
    try {
      const result = await mammoth.convertToHtml({ buffer: nodeBuffer })
      html = result.value
    } catch (e) {
      return { ok: false, failure: describeCouldNotOpen(fileName, ext, e) }
    }
    return { ok: true, kind: 'word', blocks: [{ type: 'text', text: html }], text: html }
  }
  if (isPowerPoint) {
    // The same hint as `pdfText` above, and for the same reason: auto-detection from a buffer
    // does not survive the server build.
    //
    // *** THE `.ppt` FORK IS GONE, AND WITH IT THE COMMENT THAT EXCUSED IT. *** It read: `.ppt`
    // "is left to fail as it always has rather than be given a hint that claims it is something
    // it is not" — honest about the library and wrong about the product, because "left to fail"
    // meant a customer read "Something went wrong at our end". A `.ppt` is now refused above, by
    // name, with what to do. officeparser's own words settle that it never could be read:
    // *"Sorry, OfficeParser currently supports docx, pptx, xlsx, odt, odp, ods, pdf, rtf, md,
    // html, csv files only"* — run on `tests/fixtures/file-types/safety-induction-2004.ppt`.
    let text: string
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ast = await (officeParser as any).parseOffice(nodeBuffer, { fileType: 'pptx' })
      text = typeof ast === 'string' ? ast : String(ast?.toText?.() ?? '')
    } catch (e) {
      return { ok: false, failure: describeCouldNotOpen(fileName, ext, e) }
    }
    return { ok: true, kind: 'powerpoint', blocks: [{ type: 'text', text }], text }
  }

  /**
   * *** THE GATE ABOVE SHOULD HAVE CAUGHT ANYTHING THAT GETS HERE, AND THIS STAYS ANYWAY. ***
   * `refusalFor` and the branches are two readings of one list, and the day they disagree — a
   * twelfth extension added to `READABLE_EXTENSIONS` with no branch written for it — this is what
   * the customer gets instead of an empty result. `tests/unit/fileTypes.test.ts` is what makes
   * that day not happen; this is what makes it survivable. `READABLE_EXTENSIONS` is imported for
   * the warning so the two are named in one place.
   */
  console.warn(`document parse: .${ext} passed the accepted list (${READABLE_EXTENSIONS.join(', ')}) `
    + 'and matched no branch — the list and the branches have drifted.')
  return { ok: false, failure: describeUnsupported(fileName, ext) }
}

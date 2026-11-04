/**
 * THE FILE TYPES THE PRODUCT READS, IN ONE PLACE — and the words it says about the rest.
 *
 * Deliberately its own module with NO imports. `lib/documentContent.ts` does the parsing
 * and pulls in xlsx, mammoth and officeparser — importing that from a page would bundle
 * three parsers into the browser for the sake of one string. This file is safe to import
 * from a client component, and `tests/unit/fileTypes.test.ts` holds it that way.
 *
 * Every file picker in the app uses this. Before 11 Sep each page had its own hand-written
 * list and no two agreed: /documents offered Word and PowerPoint, /compliance offered Word
 * but not PowerPoint, /upload offered neither. The route behind them had changed and the
 * pickers had not.
 *
 * *** AND SINCE 3 NOVEMBER 2026 THE READER USES IT TOO — decision 51, `docs/GAPS-PLAN.md` Part B
 * step B1. ***
 *
 * The owner's rule: *"The product offers only the file types it can read today, and a file it
 * cannot read is told so in the reading's own words — which type, and what to do instead — never
 * 'Something went wrong at our end'. The accepted list is ONE constant; B2 and B3 each add their
 * types back to it when their converter lands, so the picker, the reader and the FAQ can never
 * disagree."*
 *
 * So `parseDocumentToBlocks` now calls `refusalFor` BEFORE it looks at a single byte, and
 * `READABLE_EXTENSIONS` is the one list both it and every picker read. Adding a converter means
 * adding its extension here, in one place, and the picker starts offering it the same minute the
 * reader starts reading it. There is no second list to forget.
 *
 * WHAT WAS WRONG WITH THE OLD LIST, read off the code rather than off the spec. It was
 * `'.pdf,.xlsx,.xls,.csv,.txt,.doc,.docx,.ppt,.pptx,image/*'`, and three things in it were
 * promises nothing kept:
 *
 *   · `.doc` — `lib/documentContent.ts`'s `isWord` claimed it and handed it to mammoth, which
 *     reads `.docx` only. Run on a real Word 97 file (`tests/fixtures/file-types`), mammoth
 *     answers `Can't find end of central directory : is this a zip file ?`
 *   · `.ppt` — `isPowerPoint` claimed it and handed it to officeparser, whose own error says
 *     *"OfficeParser currently supports docx, pptx, xlsx, odt, odp, ods, pdf, rtf, md, html, csv
 *     files only"*.
 *   · `image/*` — which is what let **HEIC (every iPhone photo), TIFF (every scanner) and BMP**
 *     through to the model API, which refuses them. `IMAGE_TYPES` in `documentContent.ts` maps
 *     five extensions and none of those three.
 *
 * Because `isWord` and `isPowerPoint` *claimed* those files, the polite sentence written for
 * exactly this case was unreachable and the customer was told the product had broken instead.
 *
 * *** THE LIST DISAGREES WITH `docs/VISION-DOCUMENTS.md`, AND THE CODE WINS. *** That document
 * (§"File types", 27 September 2026) says **eleven** types read today and lists `.doc` and `.ppt`
 * separately as "accepted by the picker but fails on read" — which was true of the picker and is
 * the seam B1 closes. Counted off the branches in `lib/documentContent.ts` the number that read is
 * **twelve extensions in nine shapes**: pdf · jpg/jpeg/png/gif/webp · xlsx/xls · csv · txt · docx ·
 * pptx. The document counts JPEG, PNG, GIF and WebP as four types and does not count `.jpg` and
 * `.jpeg` twice, which is where eleven and twelve part company. Nothing is in dispute about which
 * formats work. Recorded in `docs/GAPS-PLAN.md` §8.
 */

/**
 * *** THE TWELVE EXTENSIONS THAT READ TODAY, EACH ONE A BRANCH IN `lib/documentContent.ts`. ***
 *
 * Read off that file's own `if`s on 3 November 2026, not off any document (the line numbers are
 * after B1's edit, which is why they are not the ones `docs/GAPS-PLAN.md` B1 quotes):
 *   `:224` isPDF → pdf · `:235` imageMedia → jpg, jpeg, png, gif, webp (`IMAGE_TYPES` at `:75`)
 *   `:244` isExcel → xlsx, xls · `:259` isCSV || isText → csv, txt
 *   `:263` isWord → docx · `:280` isPowerPoint → pptx
 *
 * `tests/unit/fileTypes.test.ts` reads both this list and that file and fails if they drift —
 * because the drift is the bug B1 exists to close, and a rule that lives only in a comment is
 * a comment.
 */
export const READABLE_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'xlsx', 'xls', 'csv', 'txt', 'docx', 'pptx',
  // *** B2 PUT THESE FIVE BACK, 3 November 2026 (decisions 52 and 53). *** B1 refused them
  // politely; `lib/imageConvert.ts` now converts them inside Vercel, in the same sweep that
  // reads everything else. `heic`/`heif` through `heic-decode`, `tif`/`tiff` through sharp
  // (one image block per page), `bmp` through `bmp-ts` — because sharp's prebuilt libvips
  // can decode neither HEIC nor BMP, which was settled by running it and not by reading.
  'heic', 'heif', 'tif', 'tiff', 'bmp',
  // *** B4 ADDED THESE SIX AND THEY COST NOTHING — 3 November 2026. ***
  // `officeparser` was already a dependency, already imported by `lib/documentContent.ts`, and
  // its own refusal sentence names them: *"OfficeParser currently supports docx, pptx, xlsx,
  // odt, odp, ods, pdf, rtf, md, html, csv files only"*. B2 read that sentence while proving
  // `.ppt` could never be read and recorded the six as free; this is collecting them. No new
  // dependency, no converter, no service — a branch and a fixture each.
  'odt', 'ods', 'odp', 'rtf', 'md', 'html',
] as const

/**
 * The media types those same branches name, for the one real case the extension cannot answer:
 * a file stored with no extension at all. `app/documents/page.tsx` sends
 * `file.type || 'application/octet-stream'`, so a PDF saved as `permit` with the right MIME type
 * still reads — which it did before B1 and must go on doing.
 *
 * `image/*` IS NOT HERE, and that is the fix: the prefix is what admitted HEIC and TIFF.
 */
export const READABLE_MEDIA_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // Converted by `lib/imageConvert.ts` before they are sent (B2). The API itself takes only the
  // four above — these are types the PRODUCT reads, which since B2 is a larger set.
  'image/heic', 'image/heif', 'image/tiff', 'image/bmp', 'image/x-ms-bmp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // The six B4 added. `text/markdown` and `text/html` are the two a browser actually sends.
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf', 'text/rtf', 'text/markdown', 'text/html',
] as const

/** What a file picker's `accept` attribute gets. Built from the list so it cannot fall behind it. */
export const ACCEPTED_FILE_TYPES = READABLE_EXTENSIONS.map((e) => `.${e}`).join(',')

/** Prose version, for telling a user what they may upload. Kept next to the list so the
 *  two cannot drift. Named formats rather than "images", because "images" is what promised HEIC. */
export const ACCEPTED_FILE_TYPES_PROSE =
  'PDFs, photos (including iPhone HEIC), scans (TIFF, BMP), Excel, CSV, text, Markdown, web '
  + 'pages, Word (.docx), PowerPoint (.pptx), RTF and OpenDocument (.odt, .ods, .odp) files'

/**
 * *** THE SENTENCES. The owner reads these; they are the words a customer sees. ***
 *
 * They live HERE and not beside `describeUnsupported` in `lib/documentContent.ts`, and the reason
 * is the file header above: every picker is a client component, and `documentContent.ts` imports
 * three parsers. A sentence the picker and the reader must both say has to sit in the module they
 * can both import — which is this one. `describeUnsupported` reads them from here.
 *
 * Each one names the type and says what to do instead (§5.1: never imply the file is at fault,
 * always say what they can do next). Each is **one string**, because
 * `document_scans.could_not_read_reason` is the only column the row keeps — `way_forward` has no
 * column and never reaches the database (`lib/documentScan.ts:818`; read off the live staging
 * schema, which has `could_not_read_reason` and nothing resembling a way-forward).
 *
 * **These are refusals, not failures.** `B2` deletes the three image lines when `sharp` lands and
 * `B3` deletes the two Office lines when the conversion service does — each by moving the
 * extension into `READABLE_EXTENSIONS` above.
 */
export const REFUSAL_WORDS: Record<string, string> = {
  doc: 'This is the old Word format (.doc), which we cannot read yet. Save it as .docx or PDF and add it again.',
  ppt: 'This is the old PowerPoint format (.ppt), which we cannot read yet. Save it as .pptx or PDF and add it again.',
}

/**
 * *** THE FIVE IMAGE SENTENCES B1 WROTE DID NOT DIE WITH B2 — THEY BECAME THE FALLBACK. ***
 *
 * B1 refused a HEIC, a TIFF and a BMP by name. B2 reads them, so they are no longer refusals —
 * but a file of an accepted type can still fail to open, and when a photograph fails the person
 * holding it needs the same kind of sentence: what it is, and what to do instead. These are those
 * sentences, said about a file we accepted and could not open rather than about a format we do
 * not take. **Never the generic "Something went wrong at our end"** (decision 51).
 *
 * `imageTooBig` is B2's own: `lib/imageConvert.ts` `MAX_MEGAPIXELS` refuses above 50 megapixels
 * BEFORE decoding, because a 48-megapixel HEIC peaked at 1,036 MB of memory when it was measured
 * and the decoder has no scaled mode. A 48-megapixel phone passes; a stitched panorama is told
 * why, which is better than a function that dies without a word.
 */
/**
 * *** A PASSWORD-PROTECTED PDF — B4, 3 November 2026. ***
 *
 * Before B4 this file went to the model **whole and base64'd**, and the money was spent on a
 * document nobody could open. Proved by running it: `parseDocumentToBlocks` returned
 * `ok: true`, one `document` block of 1,420 base64 bytes and `text: ''`, while the server log
 * said `pdf text extraction failed … [OfficeParser]: No password given`. **The library already
 * knew**, and `pdfText`'s catch threw the answer away into a warning.
 *
 * The sentence says what to do in the two applications somebody actually has. It does NOT say
 * "send us the password": we do not want it, and a product that asks for one is teaching a habit
 * that will cost somebody their records one day.
 */
export const PDF_LOCKED_WORDS =
  'This PDF is password-protected, so we cannot open it. Remove the password — in Preview or '
  + 'Acrobat, save a copy without it — and add it again.'

export const IMAGE_FALLBACK_WORDS = {
  couldNotOpen: 'This photo could not be opened. Share it as JPEG and add it again.',
  tooBig: (megapixels: number): string =>
    `This photo is very large (about ${Math.round(megapixels)} megapixels), and we cannot read one `
    + 'that big yet. Share a normal-sized photo or a JPEG of it and add it again.',
} as const

/** Short words for the same types, for a line that counts several at once ("2 old Word (.doc)"). */
export const REFUSAL_LABELS: Record<string, string> = {
  doc: 'old Word (.doc)',
  ppt: 'old PowerPoint (.ppt)',
}

/**
 * A type nothing above has a name for. It still says which it is and what to do — "we do not
 * recognise this" is an honest sentence; "something went wrong at our end" is not.
 */
export function unknownTypeWords(ext: string): string {
  return ext
    ? `We do not recognise .${ext} files yet, so we cannot read this one. Save it as a PDF and add it again.`
    : 'This file has no type we recognise, so we cannot read it. Save it as a PDF and add it again.'
}

/** The label for one of those, in a counting line. */
export const unknownTypeLabel = (ext: string): string => (ext ? `.${ext} file` : 'file with no type')

/**
 * *** AN ACCEPTED TYPE THAT STILL WILL NOT OPEN — and it is a different sentence on purpose. ***
 *
 * A corrupt, empty or truncated `.docx` is not a format we refuse; it is a file we accepted and
 * could not open, and telling somebody to "save it as .docx" when it already is one is useless.
 * So this says what happened and asks for the thing that would fix it. A password-protected file
 * is B4 and will get its own sentence; until then it lands here, which is honest if incomplete.
 */
export const COULD_NOT_OPEN_WORDS =
  'We could not read this file. It may be damaged or incomplete — open it on your computer to '
  + 'check it, then save a fresh copy and add it again.'

/** The extension, lower-cased, with no dot. `''` when the name has none. */
export function extensionOf(name: string): string {
  const base = (name || '').split('?')[0]
  const dot = base.lastIndexOf('.')
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase()
}

/** Is this one of the twelve? Name first, then the recorded media type for a file with no name. */
export function isReadable(fileName: string, fileType?: string | null): boolean {
  const ext = extensionOf(fileName)
  if (REFUSAL_WORDS[ext]) return false          // named and refused: the type wins over the MIME
  if ((READABLE_EXTENSIONS as readonly string[]).includes(ext)) return true
  return Boolean(fileType && (READABLE_MEDIA_TYPES as readonly string[]).includes(fileType))
}

/**
 * *** THE ONE FUNCTION THE PICKERS AND THE READER BOTH CALL. ***
 *
 * `null` means we read this type. A string is the sentence to show, and it is the same sentence
 * whether it was reached from a picker in the browser or from the sweep on the server — which is
 * the only way the two can agree.
 *
 * A refused extension beats a readable MIME type, deliberately: a HEIC that a browser labelled
 * `image/jpeg` is still a HEIC, and the API still refuses it.
 */
export function refusalFor(fileName: string, fileType?: string | null): string | null {
  const ext = extensionOf(fileName)
  if (REFUSAL_WORDS[ext]) return REFUSAL_WORDS[ext]
  if (isReadable(fileName, fileType)) return null
  return unknownTypeWords(ext)
}

/** The short label for a refused file, for the counting line. Never called for a readable one. */
export function refusalLabel(fileName: string): string {
  const ext = extensionOf(fileName)
  return REFUSAL_LABELS[ext] ?? unknownTypeLabel(ext)
}

/**
 * *** THE LINE A FOLDER GETS. ***
 *
 * Dropping a folder on Documents is the one place several files are refused at once, and a count
 * with no breakdown ("3 files skipped") is the silence §5.1 forbids: it does not say which files,
 * or why, or what to do. So this groups them by type and names each group.
 *
 *     "3 files skipped: 2 old Word (.doc), 1 HEIC photo"
 *
 * The sentences themselves go underneath, one per type — `skippedSentences` below — because a
 * person who has just been told something was skipped needs to be told what to do about it in the
 * same breath, and a tooltip is not a sentence somebody reads.
 */
export function skippedLine(names: string[]): string {
  if (!names.length) return ''
  const counts = new Map<string, number>()
  for (const n of names) {
    const label = refusalLabel(n)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const parts = [...counts.entries()].map(([label, n]) => `${n} ${label}`)
  return `${names.length} file${names.length === 1 ? '' : 's'} skipped: ${parts.join(', ')}`
}

/** One sentence per DISTINCT refused type among these names, in the order they were met. */
export function skippedSentences(names: string[]): string[] {
  const out: string[] = []
  for (const n of names) {
    const words = refusalFor(n)
    if (words && !out.includes(words)) out.push(words)
  }
  return out
}

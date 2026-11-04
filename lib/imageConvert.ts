/**
 * TURNING A PHOTO INTO SOMETHING THE MODEL CAN READ — `docs/GAPS-PLAN.md` Part B step B2,
 * the owner's decisions 52 and 53, 3 November 2026.
 *
 * *** WHAT B1 LEFT AND THIS CLOSES. *** B1 made the product refuse, politely, every type it
 * could not read: `.heic` (every iPhone photo), `.tif`/`.tiff` (every flatbed scanner) and `.bmp`.
 * Refusing honestly is better than failing, and it is not the answer. This converts them, **inside
 * Vercel, in the same sweep that reads everything else** — decision 52, which overruled
 * `docs/VISION-DOCUMENTS.md`'s plan for a container on Railway or Fly.
 *
 * *** EVERY NUMBER BELOW WAS MEASURED OR READ, NOT RECALLED. *** The decoder choice, the pixel
 * ceiling and the long edge each came out of a run on 3 November 2026 and each is recorded with
 * what produced it, because every one of them is a judgement about somebody's money.
 */
import sharp from 'sharp'
import heicDecode from 'heic-decode'
import { decode as decodeBmp } from 'bmp-ts'

/**
 * *** THE LONG EDGE IS THE HIGH-RESOLUTION TIER'S, NOT THE STANDARD TIER'S. ***
 *
 * Read from `platform.claude.com/docs/en/build-with-claude/vision` on 3 November 2026: an image
 * costs `ceil(w/28) * ceil(h/28)` visual tokens, and **the API downscales an oversized image
 * itself rather than rejecting it** — to a 1,568 px long edge on the standard tier (every model
 * before 4.7, so `claude-haiku-4-5`) and **2,576 px on the high-resolution tier (4.7 and later,
 * so `claude-opus-5-5`, which production runs)**.
 *
 * So capping here saves no tokens: the API was already capping them. 2,576 is chosen because it
 * is everything the BEST model can use — cap at 1,568 and a drum label's small print is thrown
 * away before Opus ever sees it, to save nothing. Haiku downscales our 2,576 itself, for free.
 */
export const LONG_EDGE = 2576

/** JPEG, because the API takes JPEG, PNG, GIF and WebP and JPEG is the one a photograph wants. */
export const JPEG_QUALITY = 80

/**
 * *** THE BYTE BELT, AND IT SHOULD NEVER FIRE. ***
 * The API's ceiling is **10 MB base64** per image, which is ~7.5 MB of bytes. A 48-megapixel
 * source measured **0.50 MB** at the long edge above, so this is 14 times the size anything
 * should reach. It exists because "should never" is not "cannot", and the alternative to a belt
 * is an `invalid_request_error` the customer reads as a failure of their photograph.
 */
export const MAX_IMAGE_BYTES = 7_000_000

/**
 * *** 50 MEGAPIXELS, REFUSED BEFORE ANYTHING IS DECODED — the owner's option (ii), decision 53. ***
 *
 * `heic-decode`'s own `lib.js` allocates `new Uint8ClampedArray(width * height * 4)` for every
 * image: **there is no scaled decode**, so the memory is the SOURCE photograph's whatever we ask
 * for back. Measured on 3 November, one process per file:
 *
 *     12 MP (4032x3024)   299 ms   peak RSS   436 MB
 *     48 MP (8000x6000)   842 ms   peak RSS 1,036 MB
 *
 * A gigabyte for one photograph. So the dimensions are read FIRST — `sharp(buf).metadata()`
 * reads a HEIC's container in about a millisecond without decoding a pixel, which is the one
 * thing sharp's prebuilt libvips can do with a HEIC — and anything above this is refused with a
 * sentence rather than killing the function. 48-megapixel phones pass; a stitched panorama does
 * not, and is told so.
 *
 * The other half of the owner's answer is `vercel.json`: the two routes that read documents are
 * given their memory explicitly, so the ceiling is a number somebody chose.
 */
export const MAX_MEGAPIXELS = 50

/**
 * *** 20 PAGES, AND THE REASON IS THE API'S OWN. ***
 * A multi-page TIFF becomes one image block per page. The vision guide: *"If a single API request
 * contains more than 20 images, a stricter per-image dimension limit applies to every image in
 * that request"* — and an image over that stricter limit is **rejected**, not downscaled. So 20 is
 * where a fax with 200 pages stops being read page by page, rather than where we guessed.
 *
 * (`VISION-DOCUMENTS.md:177` said a multi-page TIFF should become a PDF. One image block per page
 * is simpler and is the shape the model reads best; the document is corrected rather than
 * followed. **There was no page-splitting shape to copy**: `parseDocumentToBlocks` sends a PDF
 * whole, as one block, and `lib/handbookRead.ts` is the only per-page code in the repository.)
 */
export const MAX_TIFF_PAGES = 20

/** The three the model API itself takes, for an image we re-encode. */
const OUT_MEDIA = 'image/jpeg'

export type ConvertedImage = {
  /** One per page. A still photograph has one; a multi-page TIFF has one each. */
  pages: Array<{ bytes: Buffer; mediaType: string }>
  /**
   * The copy to store beside the original, or null when nothing was converted.
   * Only the FIRST page: `documents.converted_url` is one column and a document is one row, and
   * what the binder and "Open the file" need is something every machine can open.
   */
  stored: { bytes: Buffer; mediaType: string } | null
  /** For the record on the scan, and for the report to say what was done. */
  note: string
}

export class ImageTooLargeError extends Error {
  // *** DECLARED AND ASSIGNED, NOT A PARAMETER PROPERTY. *** `constructor(public readonly x)` is
  // valid TypeScript and Node refuses it: `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX — TypeScript
  // parameter property is not supported in strip-only mode`. `npm run check` type-checks with
  // tsc and RUNS with node's stripping, so a thing tsc accepts can still break every test.
  readonly megapixels: number
  constructor(megapixels: number) {
    super(`image is ${megapixels.toFixed(1)} megapixels, over the ${MAX_MEGAPIXELS} limit`)
    this.name = 'ImageTooLargeError'
    this.megapixels = megapixels
  }
}

/**
 * *** WHERE A CONVERTED COPY LIVES, AND WHY IT IS EXACTLY TWO LEVELS DEEP. ***
 *
 * `<company_id>/converted/<document_id>.jpg` — a sibling of `unfiled` and `handbooks`, never a
 * child of one. `app/api/account/route.ts` `listCompanyObjects` lists `<company>/` and then each
 * folder exactly ONE level down, so **a file at a third level would survive a deletion the
 * customer asked for**. `lib/storage.ts` records the rule and `tests/unit/storage.test.ts` holds
 * it; this is the third thing in the bucket to obey it.
 *
 * Keyed by the DOCUMENT's id and not by a timestamp, deliberately: a re-read of the same document
 * overwrites its own copy rather than leaving the old one behind for ever. One document, one
 * converted copy, and `documents.converted_url` points at it.
 */
export const CONVERTED_PREFIX = 'converted'

export function convertedPath(companyId: string, documentId: string): string {
  if (!companyId || /[/\\]/.test(companyId)) throw new Error('convertedPath: a company id with no slash is required')
  if (!documentId || /[/\\]/.test(documentId)) throw new Error('convertedPath: a document id with no slash is required')
  return `${companyId}/${CONVERTED_PREFIX}/${documentId}.jpg`
}

/**
 * *** WHICH DECODER, BY EXTENSION **OR** BY MEDIA TYPE. ***
 * Both, for the reason the rest of `lib/documentContent.ts` reads both: a file can arrive with a
 * correct media type and no extension at all (`app/documents/page.tsx` sends
 * `file.type || 'application/octet-stream'`). A scan stored as `permit` with `image/tiff` on it
 * is a TIFF, and reading only the extension would hand it to the pass-through, which would send
 * the API a format it refuses.
 */
const HEIC = { ext: ['heic', 'heif'], media: ['image/heic', 'image/heif'] }
const BMP = { ext: ['bmp'], media: ['image/bmp', 'image/x-ms-bmp'] }
const TIFF = { ext: ['tif', 'tiff'], media: ['image/tiff'] }
const is = (w: { ext: string[]; media: string[] }, ext: string, media: string | undefined) =>
  w.ext.includes(ext) || (media !== undefined && w.media.includes(media))

/**
 * The four the model API itself takes, read from the vision guide on 3 November 2026: *"Claude
 * supports JPEG, PNG, GIF, and WebP images"*. An image already in one of these and already inside
 * the caps is sent untouched; anything else is re-encoded, whatever its extension claims.
 */
const API_MEDIA = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

/**
 * *** THE ONE RESIZE RULE, APPLIED TO EVERY IMAGE WE RE-ENCODE. ***
 * `rotate()` with no argument applies the file's own EXIF orientation — a sideways scan is a
 * sideways reading. `withoutEnlargement` so a small photograph is never blown up into bytes that
 * carry no more detail. `flatten` to white because **JPEG has no alpha and sharp's default
 * background is BLACK**: a PNG screenshot with a transparent margin would otherwise come back as
 * white text on black.
 */
async function encode(input: sharp.Sharp): Promise<Buffer> {
  let out = await input
    .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()
  if (out.length > MAX_IMAGE_BYTES) {
    // The belt. Quality first, because dropping detail is worse than dropping precision.
    out = await sharp(out).jpeg({ quality: 60 }).toBuffer()
  }
  if (out.length > MAX_IMAGE_BYTES) {
    out = await sharp(out)
      .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 }).toBuffer()
  }
  return out
}

/** Width x height from the container, without decoding. Throws `ImageTooLargeError` if too big. */
async function sizeOf(buffer: Buffer): Promise<{ width: number; height: number; pages: number }> {
  const m = await sharp(buffer).metadata()
  const width = m.width ?? 0
  const height = m.height ?? 0
  if (!width || !height) throw new Error('the image has no dimensions')
  const mp = (width * height) / 1_000_000
  if (mp > MAX_MEGAPIXELS) throw new ImageTooLargeError(mp)
  return { width, height, pages: m.pages ?? 1 }
}

/**
 * *** HEIC: `heic-decode` FOR THE PIXELS, sharp FOR EVERYTHING ELSE. ***
 *
 * **sharp cannot decode a HEIC and this was settled by running it**, not by reading a changelog:
 * `sharp@0.34.5` with libvips 8.17.3 answers a real HEIC with *"heif: Error while loading plugin:
 * Support for this compression format has not been built in"*. Its prebuilt libvips carries the
 * ISO-BMFF container (for AVIF) and no HEVC decoder. It still reads the container's DIMENSIONS,
 * which is exactly what `sizeOf` above needs and the only reason the ceiling can be free.
 *
 * `heic-decode` over `heic-convert`, which wraps it: `heic-convert` then encodes a FULL-SIZE JPEG
 * in pure JavaScript (`jpeg-js`) which sharp has to decode again — 514 ms and a 1.78 MB
 * intermediate for a 12-megapixel photograph, against 299 ms and none for this path.
 *
 * `libheif-js` is libheif compiled to WebAssembly with no dependencies and nothing native, so
 * `docs/VISION-DOCUMENTS.md:188`'s *"HEIC (libheif) … cannot run there"* is wrong and is
 * corrected in the same commit as this file.
 *
 * libheif applies the file's own rotation during `display()` — checked against a HEIC made with
 * `sips -r 90`, which came back 3024x4032 rather than 4032x3024 — so no `rotate()` here. Raw
 * pixels carry no EXIF for one to read in any case.
 *
 * `[0]` when the file holds several images (a Live Photo, a burst): the first is the photograph.
 */
async function fromHeic(buffer: Buffer): Promise<Buffer> {
  const { width, height, data } = await heicDecode({ buffer })
  // *** WRAPPED, NOT COPIED. *** `Buffer.from(typedArray)` copies; `Buffer.from(ArrayBuffer, …)`
  // views the same memory. On a 48-megapixel photograph that is 183 MB not allocated twice.
  const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  return encode(sharp(raw, { raw: { width, height, channels: 4 } }))
}

/**
 * *** BMP: `bmp-ts`, BECAUSE sharp CANNOT READ ONE EITHER. ***
 * Run on a real BMP, sharp answers *"Input buffer contains unsupported image format"*; its read
 * list is jpeg, png, webp, tiff, gif, svg, heif, raw — no bmp. `bmp-ts` is 136 KB with no
 * dependencies and decoded a 900x1200 24-bit BMP in 11 ms.
 *
 * *** ITS OUTPUT IS ARGB, NOT RGBA, and that was settled by comparing numbers. *** Fed to sharp
 * as RGBA the channels came back `104, 114, 134`; taken as `[3,2,1]` they came back
 * `135, 114, 104`, against `135, 115, 105` for the same picture as a JPEG. A channel order got
 * wrong is not an error — it is a blue photograph that reads perfectly well and is wrong.
 */
async function fromBmp(buffer: Buffer): Promise<Buffer> {
  const img = decodeBmp(buffer)
  const px = img.data
  const rgb = Buffer.alloc(img.width * img.height * 3)
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    rgb[j] = px[i + 3]; rgb[j + 1] = px[i + 2]; rgb[j + 2] = px[i + 1]
  }
  return encode(sharp(rgb, { raw: { width: img.width, height: img.height, channels: 3 } }))
}

/**
 * *** WHAT GETS CONVERTED, AND WHAT IS LEFT ALONE. ***
 *
 * A JPEG, PNG, GIF or WebP that is already inside the caps **passes through untouched**, and that
 * is deliberate rather than lazy: re-encoding a PNG screenshot of a permit at quality 80 puts
 * artefacts on small print to save nothing, and the vision guide's own advice is that resizing
 * "might make text less legible". The rule is one rule — every image is measured against the same
 * caps — and only an image that fails one is re-encoded.
 *
 * `null` means "not an image this function handles"; the caller's own branch decides what that is.
 */
export async function convertImage(
  buffer: Buffer, ext: string, mediaType: string | undefined,
): Promise<ConvertedImage> {
  if (is(HEIC, ext, mediaType)) {
    const { width, height } = await sizeOf(buffer)
    const bytes = await fromHeic(buffer)
    return {
      pages: [{ bytes, mediaType: OUT_MEDIA }],
      stored: { bytes, mediaType: OUT_MEDIA },
      note: `HEIC ${width}x${height} converted to JPEG`,
    }
  }

  if (is(BMP, ext, mediaType)) {
    // `sizeOf` goes through sharp, which cannot read a BMP at all — so the ceiling is checked
    // from the BMP header itself, which bmp-ts has already parsed by the time we know the size.
    const img = decodeBmp(buffer)
    const mp = (img.width * img.height) / 1_000_000
    if (mp > MAX_MEGAPIXELS) throw new ImageTooLargeError(mp)
    const bytes = await fromBmp(buffer)
    return {
      pages: [{ bytes, mediaType: OUT_MEDIA }],
      stored: { bytes, mediaType: OUT_MEDIA },
      note: `BMP ${img.width}x${img.height} converted to JPEG`,
    }
  }

  if (is(TIFF, ext, mediaType)) {
    const { width, height, pages } = await sizeOf(buffer)
    const take = Math.min(pages, MAX_TIFF_PAGES)
    const out: Array<{ bytes: Buffer; mediaType: string }> = []
    for (let p = 0; p < take; p++) {
      out.push({ bytes: await encode(sharp(buffer, { page: p }).rotate()), mediaType: OUT_MEDIA })
    }
    return {
      pages: out,
      stored: out[0],
      note: pages > take
        ? `TIFF ${width}x${height}, ${take} of ${pages} pages converted to JPEG (the API applies a `
          + `stricter size limit above 20 images in one request)`
        : `TIFF ${width}x${height}, ${pages} page${pages === 1 ? '' : 's'} converted to JPEG`,
    }
  }

  // An already-readable image: measured against the same caps, re-encoded only if it fails one.
  const { width, height } = await sizeOf(buffer)
  const tooBig = width > LONG_EDGE || height > LONG_EDGE || buffer.length > MAX_IMAGE_BYTES
  // `API_MEDIA` is the second half of the condition and not a formality: a format this function
  // has no branch for, arriving with an image media type, must be re-encoded rather than sent on
  // in a `media_type` the API will refuse.
  if (!tooBig && mediaType !== undefined && API_MEDIA.has(mediaType)) {
    return {
      pages: [{ bytes: buffer, mediaType }],
      stored: null,
      note: `${width}x${height}, sent as it is`,
    }
  }
  const bytes = await encode(sharp(buffer).rotate())
  return {
    pages: [{ bytes, mediaType: OUT_MEDIA }],
    // Stored, because the original is the one that is awkward to open and heavy to re-read.
    stored: { bytes, mediaType: OUT_MEDIA },
    note: `${width}x${height} resized to fit ${LONG_EDGE} px and re-encoded as JPEG`,
  }
}


/**
 * *** STORING THE COPY, AND IT IS DELIBERATELY FORGIVING. ***
 *
 * Called by the two reading paths that own a `documents` row — the sweep and
 * `/api/document-scan` — after the reading has landed. `parseDocumentToBlocks` computes the copy
 * and stores nothing, because it has no database and its seven callers do not share one.
 *
 * **A failure here never fails the reading.** The reading is the expensive thing and it has
 * already happened; losing it because a storage write was refused would be the worst possible
 * trade. So this logs and returns null, and `converted_url` stays NULL — which is exactly what it
 * means: there is no copy to point at. The next re-read writes one.
 *
 * `upsert: true` because a re-read of the same document must overwrite its own copy rather than
 * fail on a key that is already there.
 */
export async function storeConvertedCopy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  bucket: string,
  args: { companyId: string; documentId: string; bytes: Buffer; mediaType: string },
): Promise<string | null> {
  const path = convertedPath(args.companyId, args.documentId)
  try {
    const { error } = await db.storage.from(bucket)
      .upload(path, args.bytes, { contentType: args.mediaType, upsert: true })
    if (error) {
      console.warn(`converted copy: ${path} could not be stored (the reading is unaffected):`, error.message)
      return null
    }
    const { error: rowError } = await db.from('documents')
      .update({ converted_url: path }).eq('id', args.documentId)
    if (rowError) {
      console.warn(`converted copy: ${path} is stored and the row could not be pointed at it:`, rowError.message)
      return null
    }
    return path
  } catch (e) {
    console.warn(`converted copy: ${path} could not be stored (the reading is unaffected):`,
      e instanceof Error ? e.message : e)
    return null
  }
}

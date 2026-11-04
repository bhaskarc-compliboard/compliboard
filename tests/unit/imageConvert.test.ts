/**
 * READING A PHOTOGRAPH — `docs/GAPS-PLAN.md` Part B step B2, the owner's decisions 52 and 53,
 * 3 November 2026.
 *
 * B1 refused a HEIC, a TIFF and a BMP politely. B2 reads them, by converting each to a JPEG
 * **inside Vercel**, in the same sweep that reads everything else — decision 52, which overruled
 * `docs/VISION-DOCUMENTS.md`'s plan for a conversion container on Railway or Fly.
 *
 * *** THESE TESTS RUN REAL DECODERS ON REAL FILES. *** Every fixture in
 * `tests/fixtures/file-types` was made on the owner's laptop with tools macOS already has, and
 * `README.md` there carries the command for each. Nothing here is a stand-in for a photograph,
 * because the three things that can go wrong — a decoder that is not built in, a channel order
 * that is backwards, a page that is silently dropped — are all invisible to a stand-in.
 *
 * The four the brief asked for, and the two the measuring added:
 *   1. a HEIC through the reader lands as an image block
 *   2. a 3-page TIFF lands as three
 *   3. a 48-megapixel image lands under the byte and pixel limits with its long edge capped
 *   4. a corrupt HEIC lands could_not_read with the FALLBACK sentence, never the generic one
 *   5. an 81-megapixel image is refused BEFORE anything is decoded (the owner's option (ii))
 *   6. an image already small enough is passed through untouched, and stores nothing
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  CONVERTED_PREFIX, JPEG_QUALITY, LONG_EDGE, MAX_IMAGE_BYTES, MAX_MEGAPIXELS, MAX_TIFF_PAGES,
  ImageTooLargeError, convertImage, convertedPath, storeConvertedCopy,
} from '../../lib/imageConvert.ts'
import { parseDocumentToBlocks } from '../../lib/documentContent.ts'
import { IMAGE_FALLBACK_WORDS, READABLE_EXTENSIONS } from '../../lib/acceptedFiles.ts'
import { runDocumentScan } from '../../lib/documentScan.ts'

const FIXTURES = join(process.cwd(), 'tests/fixtures/file-types')
const read = (f: string) => readFileSync(join(FIXTURES, f))
const bufferOf = (f: string) => new Uint8Array(read(f)).buffer as ArrayBuffer

/** The API's own cost formula, from the vision guide: ceil(w/28) * ceil(h/28) visual tokens. */
const visualTokens = (w: number, h: number) => Math.ceil(w / 28) * Math.ceil(h / 28)

/** Every block's bytes, decoded, so a claim about an image is made about the image. */
async function blocksOf(result: Awaited<ReturnType<typeof parseDocumentToBlocks>>) {
  assert.ok(result.ok, result.ok ? '' : `expected a reading, got: ${result.failure.message}`)
  if (!result.ok) throw new Error('unreachable')
  const out = []
  for (const b of result.blocks as Array<{ type: string; source: { media_type: string; data: string } }>) {
    const bytes = Buffer.from(b.source.data, 'base64')
    out.push({ type: b.type, mediaType: b.source.media_type, bytes, meta: await sharp(bytes).metadata() })
  }
  return out
}

describe('the numbers, and where each came from', () => {
  test('the long edge is the HIGH-resolution tier’s, not the standard one’s', () => {
    // Read from platform.claude.com/docs/en/build-with-claude/vision on 3 November 2026: the
    // standard tier (every model before 4.7, so claude-haiku-4-5) downscales to 1,568 px and the
    // high-resolution tier (4.7 and later, so claude-opus-5-5, which production runs) to 2,576.
    // Capping at the standard tier's figure would throw away small print before Opus ever saw it,
    // to save nothing — the API was already capping the tokens either way.
    assert.equal(LONG_EDGE, 2576)
  })

  test('the byte belt is well under the API’s 10 MB base64 ceiling', () => {
    // 10 MB base64 is about 7.5 MB of bytes. A measured 48-megapixel source landed at 0.5 MB, so
    // this is fourteen times anything that should arrive — a belt, not a working limit.
    assert.ok(MAX_IMAGE_BYTES < 7_500_000, 'under the API’s per-image ceiling')
    assert.ok(MAX_IMAGE_BYTES > 5_000_000, 'and not so tight that it fires on a real photograph')
  })

  test('20 pages, because that is where the API changes the rules', () => {
    // "If a single API request contains more than 20 images, a stricter per-image dimension limit
    // applies to every image in that request" — and an image over THAT limit is rejected, not
    // downscaled. So the cap is the API's own number rather than a guess at a sensible one.
    assert.equal(MAX_TIFF_PAGES, 20)
  })

  test('50 megapixels, because 48 of them measured a gigabyte', () => {
    // `heic-decode` allocates width * height * 4 for every image and has no scaled decode, so the
    // memory is the SOURCE photograph's. A 48-megapixel HEIC peaked at 1,036 MB when it was
    // measured on 3 November. The ceiling lets a 48-megapixel phone through and stops a panorama.
    assert.equal(MAX_MEGAPIXELS, 50)
    assert.ok(MAX_MEGAPIXELS > 48, 'a 48-megapixel phone photograph is read, not refused')
    assert.equal(JPEG_QUALITY, 80)
  })
})

describe('1. a HEIC lands as an image block the API can read', () => {
  test('a 12-megapixel iPhone-shaped HEIC', async () => {
    const r = await parseDocumentToBlocks(bufferOf('drum-label.heic'), 'drum-label.heic', 'image/heic')
    const blocks = await blocksOf(r)
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0].type, 'image')
    // *** THE MEDIA TYPE IS NOT THE ONE IT ARRIVED AS. *** image/heic is a type the API refuses;
    // sending the converted bytes under the original's name would fail in exactly the way B1's
    // image/* wildcard used to.
    assert.equal(blocks[0].mediaType, 'image/jpeg')
    assert.equal(blocks[0].meta.format, 'jpeg')
    assert.equal(Math.max(blocks[0].meta.width!, blocks[0].meta.height!), LONG_EDGE)
    assert.ok(r.ok && r.note?.includes('HEIC 3024x4032'), `note said: ${r.ok ? r.note : ''}`)
  })

  test('and the copy to store beside the original comes back with it', async () => {
    const r = await parseDocumentToBlocks(bufferOf('drum-label.heic'), 'drum-label.heic', 'image/heic')
    assert.ok(r.ok && r.converted, 'a converted file has a copy to store')
    if (!r.ok || !r.converted) return
    assert.equal(r.converted.mediaType, 'image/jpeg')
    // It is the same bytes as the block, not a second conversion: the decode is the expensive
    // half and doing it twice to store what we just sent would be the whole saving thrown away.
    const sent = (r.blocks[0] as { source: { data: string } }).source.data
    assert.equal(r.converted.bytes.toString('base64'), sent)
  })

  test('a portrait photograph comes back portrait', async () => {
    // *** WHAT THIS PROVES AND WHAT IT DOES NOT. *** It proves the aspect ratio survives the
    // round trip — a drum label read sideways would still "work" and be wrong, and a resize that
    // took `width` for `height` is exactly the kind of mistake that passes every other test here.
    // It does NOT prove that libheif honours a rotation stored in the container, because `sips`
    // rotates pixels rather than writing `irot` and nothing on this laptop makes one that does.
    // **That was measured separately on 3 November**: a HEIC made with `sips -r 90` from a
    // 4032x3024 source came back from `heic-decode` as 3024x4032, which is libheif applying it.
    const r = await parseDocumentToBlocks(bufferOf('drum-label.heic'), 'drum-label.heic', 'image/heic')
    const [b] = await blocksOf(r)
    assert.ok(b.meta.height! > b.meta.width!, 'the label is taller than it is wide, both ways')
    assert.equal(Math.round((b.meta.height! / b.meta.width!) * 100), Math.round((4032 / 3024) * 100))
  })
})

describe('2. a 3-page TIFF lands as three blocks', () => {
  test('one image block per page, in order', async () => {
    const r = await parseDocumentToBlocks(
      bufferOf('inspection-sheets-3pages.tiff'), 'inspection-sheets-3pages.tiff', 'image/tiff')
    const blocks = await blocksOf(r)
    assert.equal(blocks.length, 3, 'three pages, three blocks')
    for (const b of blocks) {
      assert.equal(b.type, 'image')
      assert.equal(b.mediaType, 'image/jpeg')
      assert.equal(b.meta.format, 'jpeg')
    }
    assert.ok(r.ok && r.note?.includes('3 pages'), `note said: ${r.ok ? r.note : ''}`)
  })

  test('the page cap is a number from the API, and a one-page TIFF says so plainly', async () => {
    // *** WHAT THIS CANNOT TEST, SAID OUT LOUD. *** sharp cannot WRITE a multi-page TIFF from
    // separate buffers, and `tiffutil` is macOS's and not the build's, so there is no way to
    // build a 25-page TIFF here. What is held instead: the cap is the API's own number, the note
    // SAYS how many pages were converted either way, and the three-page fixture above proves the
    // paging itself. A 200-page fax quietly becoming the first twenty is what the note prevents.
    assert.equal(MAX_TIFF_PAGES, 20)
    const one = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } })
      .tiff().toBuffer()
    const r = await convertImage(one, 'tiff', 'image/tiff')
    assert.equal(r.pages.length, 1)
    assert.match(r.note, /1 page converted/)
    assert.ok(!/of/.test(r.note), 'and it does not claim a cap was applied when none was')
  })

  test('only the first page is stored: converted_url is one column', async () => {
    const r = await convertImage(read('inspection-sheets-3pages.tiff'), 'tiff', 'image/tiff')
    assert.equal(r.pages.length, 3)
    assert.ok(r.stored)
    assert.equal(r.stored!.bytes.toString('base64'), r.pages[0].bytes.toString('base64'))
  })
})

describe('3. an oversized image is capped — and what that does and does not buy', () => {
  test('a 48-megapixel image comes back inside BOTH limits, long edge capped', async () => {
    // Built here rather than committed: a real 48-megapixel JPEG is 4 MB, and the thing under
    // test is the rule, not the photograph.
    const big = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: '#4a6' } })
      .jpeg({ quality: 90 }).toBuffer()
    const r = await convertImage(big, 'jpg', 'image/jpeg')
    const m = await sharp(r.pages[0].bytes).metadata()

    assert.equal(Math.max(m.width!, m.height!), LONG_EDGE, 'the long edge is capped')
    assert.ok(r.pages[0].bytes.length < MAX_IMAGE_BYTES, 'under our own belt')
    assert.ok(r.pages[0].bytes.length * 4 / 3 < 10_000_000, 'and under the API’s 10 MB base64')

    // *** AND THE DIMENSIONS, WHICH IS THE WHOLE OF WHAT THIS BUYS. ***
    // 8000x6000 is exactly at the API's 8000x8000 ceiling; one pixel more on either edge and the
    // request is REJECTED rather than downscaled. The token cost was never the problem — the API
    // downscales an oversized image itself and bills the smaller one — so this test asserts what
    // is true (no rejection, the dimensions capped) and not a saving that was never there.
    assert.ok(m.width! <= 8000 && m.height! <= 8000, 'inside the API’s hard dimension limit')
    assert.ok(visualTokens(8000, 6000) > 60_000, 'the untouched figure is enormous…')
    assert.ok(visualTokens(m.width!, m.height!) < 7_000, '…and ours is not, though the API capped it anyway')
  })

  test('an image already small enough is passed through untouched and stores NOTHING', async () => {
    const small = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#eee' } })
      .png().toBuffer()
    const r = await convertImage(small, 'png', 'image/png')
    assert.equal(r.pages.length, 1)
    assert.equal(r.pages[0].mediaType, 'image/png', 'still a PNG — re-encoding it would add JPEG '
      + 'artefacts to small print and save nothing')
    assert.equal(r.pages[0].bytes.length, small.length, 'byte for byte the file that arrived')
    assert.equal(r.stored, null, 'nothing was converted, so converted_url stays NULL')
    assert.match(r.note, /sent as it is/)
  })

  test('a format the API does not take is re-encoded even when it is small', async () => {
    // A BMP is tiny and still unreadable to the API. "Small enough" is not the only question.
    const r = await convertImage(read('floor-plan.bmp'), 'bmp', 'image/bmp')
    assert.equal(r.pages[0].mediaType, 'image/jpeg')
    assert.ok(r.stored, 'and it is stored, because the original is the one nothing can read')
  })

  test('BMP comes back the right colour, which a wrong channel order would not fail loudly about',
    async () => {
      // `bmp-ts` returns ARGB, not RGBA. Read as RGBA the picture decodes perfectly and is BLUE.
      // So the check is numeric: the converted BMP's channel means against the same picture's.
      const r = await convertImage(read('floor-plan.bmp'), 'bmp', 'image/bmp')
      const got = (await sharp(r.pages[0].bytes).stats()).channels.map((c) => Math.round(c.mean))
      // Red above blue on this fixture, which is a warm photograph; the swapped order inverts it.
      assert.ok(got[0] > got[2], `channels came back ${got.join(', ')} — red should lead blue here`)
    })
})

describe('4. a photo that will not open gets the FALLBACK sentence, never the generic one', () => {
  test('a half-sent HEIC', async () => {
    const r = await parseDocumentToBlocks(
      bufferOf('half-sent-photo.heic'), 'half-sent-photo.heic', 'image/heic')
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.failure.reason, 'could_not_open', 'an accepted type that would not open')
    assert.equal(r.failure.message, IMAGE_FALLBACK_WORDS.couldNotOpen)
    assert.ok(!/went wrong at our end/i.test(r.failure.message))
  })

  test('…and it lands on the row that way, through the function the sweep calls', async () => {
    const scan = await runDocumentScan({
      buffer: bufferOf('half-sent-photo.heic'),
      fileName: 'half-sent-photo.heic',
      fileType: 'image/heic',
      companyId: '00000000-0000-0000-0000-000000000000',
      context: {} as never,
    })
    assert.equal(scan.status, 'could_not_read')
    assert.equal(scan.could_not_read.reason, IMAGE_FALLBACK_WORDS.couldNotOpen)
    assert.equal(scan.model, '(not called)', 'no model call, so no cost row')
  })
})

describe('5. an 81-megapixel image is refused BEFORE anything is decoded', () => {
  test('the ceiling is read from the header, so it costs nothing', async () => {
    // The fixture is a TIFF header claiming 9000x9000 with one byte of pixel data behind it.
    // That IS the test: if the ceiling were checked after decoding, this file would be 324 MB of
    // RGBA before anybody noticed, and the function would be killed instead of answering.
    const started = Date.now()
    const r = await parseDocumentToBlocks(
      bufferOf('panorama-81mp.tiff'), 'panorama-81mp.tiff', 'image/tiff')
    assert.ok(Date.now() - started < 500, 'answered from the header, not from the pixels')
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.failure.reason, 'could_not_open')
    assert.match(r.failure.message, /about 81 megapixels/)
    assert.match(r.failure.message, /add it again/)
    assert.ok(!/went wrong at our end/i.test(r.failure.message))
  })

  test('the error carries the number, so the sentence can say it', async () => {
    await assert.rejects(
      () => convertImage(read('panorama-81mp.tiff'), 'tiff', 'image/tiff'),
      (e: unknown) => {
        assert.ok(e instanceof ImageTooLargeError)
        assert.ok((e as ImageTooLargeError).megapixels > MAX_MEGAPIXELS)
        return true
      })
  })

  test('48 megapixels is UNDER the ceiling — the phone in somebody’s pocket is read', () => {
    assert.ok((8000 * 6000) / 1_000_000 < MAX_MEGAPIXELS)
  })
})

describe('6. the accepted list still IS the reader’s branches, with five more', () => {
  test('all five image types are offered, and each has a decoder behind it', async () => {
    for (const ext of ['heic', 'heif', 'tif', 'tiff', 'bmp']) {
      assert.ok((READABLE_EXTENSIONS as readonly string[]).includes(ext), `.${ext} is offered`)
    }
    // And offered means read, on a real file of each shape we have one for.
    for (const [f, type] of [
      ['drum-label.heic', 'image/heic'],
      ['inspection-sheets-3pages.tiff', 'image/tiff'],
      ['floor-plan.bmp', 'image/bmp'],
    ] as Array<[string, string]>) {
      const r = await parseDocumentToBlocks(bufferOf(f), f, type)
      assert.ok(r.ok, `${f} reads`)
      if (!r.ok) continue
      assert.equal(r.kind, 'image')
      assert.ok(r.blocks.length >= 1)
    }
  })

  test('a scan with no extension and only a media type is still routed to its decoder', async () => {
    // `app/documents/page.tsx` sends `file.type || 'application/octet-stream'`, so a file saved
    // as `permit` with image/tiff on it is a real case and not a hypothetical one.
    const r = await convertImage(read('inspection-sheets-3pages.tiff'), '', 'image/tiff')
    assert.equal(r.pages.length, 3, 'routed by media type, not by a name it does not have')
  })
})

describe('7. the converted copy is stored beside the original (B2, decision 53)', () => {
  /** A storage-and-rows stand-in small enough to read, so what it records is what was done. */
  function fakeDb(opts: { uploadError?: string; rowError?: string } = {}) {
    const uploads: Array<{ bucket: string; path: string; bytes: number; contentType: string; upsert: boolean }> = []
    const updates: Array<{ table: string; patch: Record<string, unknown>; id: string }> = []
    return {
      uploads,
      updates,
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, bytes: Buffer, o: { contentType: string; upsert: boolean }) => {
            if (opts.uploadError) return { error: { message: opts.uploadError } }
            uploads.push({ bucket, path, bytes: bytes.length, contentType: o.contentType, upsert: o.upsert })
            return { error: null }
          },
        }),
      },
      from: (table: string) => ({
        update: (patch: Record<string, unknown>) => ({
          eq: async (_c: string, id: string) => {
            if (opts.rowError) return { error: { message: opts.rowError } }
            updates.push({ table, patch, id })
            return { error: null }
          },
        }),
      }),
    }
  }

  const CO = '11111111-1111-1111-1111-111111111111'
  const DOC = '22222222-2222-2222-2222-222222222222'

  test('the key is EXACTLY two levels deep, which is what makes a deletion complete', () => {
    const p = convertedPath(CO, DOC)
    assert.equal(p, `${CO}/converted/${DOC}.jpg`)
    assert.equal(p.split('/').length, 3,
      'app/api/account/route.ts lists <company>/ and then ONE folder down. A third level would '
      + 'survive a deletion the customer asked for — lib/storage.ts records the rule')
    assert.equal(p.split('/')[0], CO, 'the company prefix first, as migration 002 requires')
    assert.equal(p.split('/')[1], CONVERTED_PREFIX)
  })

  test('…and it is keyed by the DOCUMENT, so a re-read overwrites its own copy', () => {
    assert.equal(convertedPath(CO, DOC), convertedPath(CO, DOC))
    assert.notEqual(convertedPath(CO, DOC), convertedPath(CO, '33333333-3333-3333-3333-333333333333'))
    // A timestamp in the key would leave the old copy behind for ever on every re-read.
    assert.ok(!/\d{13}/.test(convertedPath(CO, DOC)), 'no timestamp')
  })

  test('a slash in either id is refused rather than escaping the company’s folder', () => {
    assert.throws(() => convertedPath(`${CO}/..`, DOC), /company id/)
    assert.throws(() => convertedPath(CO, `${DOC}/../x`), /document id/)
  })

  test('storing it uploads the bytes and points the row at them', async () => {
    const db = fakeDb()
    const bytes = Buffer.from('a converted jpeg')
    const path = await storeConvertedCopy(db, 'company-documents',
      { companyId: CO, documentId: DOC, bytes, mediaType: 'image/jpeg' })

    assert.equal(path, convertedPath(CO, DOC))
    assert.deepEqual(db.uploads, [{
      bucket: 'company-documents', path: convertedPath(CO, DOC), bytes: bytes.length,
      contentType: 'image/jpeg',
      // *** `upsert` MATTERS. *** "Read it again" stores to the same key, and without this the
      // second reading would fail on a key that is already there.
      upsert: true,
    }])
    assert.deepEqual(db.updates, [{ table: 'documents', patch: { converted_url: path }, id: DOC }])
  })

  test('a storage refusal NEVER fails the reading, and leaves converted_url null', async () => {
    const db = fakeDb({ uploadError: 'bucket is full' })
    // The reading is the expensive thing and it has already happened by this point. Losing it
    // because an upload was refused would be the worst trade available.
    const path = await storeConvertedCopy(db, 'company-documents',
      { companyId: CO, documentId: DOC, bytes: Buffer.from('x'), mediaType: 'image/jpeg' })
    assert.equal(path, null, 'null, which is what NULL means: there is no copy to point at')
    assert.deepEqual(db.updates, [], 'and nothing claims there is one')
  })

  test('a row update refusal is the same: said in the log, never thrown', async () => {
    const db = fakeDb({ rowError: 'row is locked' })
    const path = await storeConvertedCopy(db, 'company-documents',
      { companyId: CO, documentId: DOC, bytes: Buffer.from('x'), mediaType: 'image/jpeg' })
    assert.equal(path, null)
    assert.equal(db.uploads.length, 1, 'the file IS there; only the pointer is missing')
  })

  test('the parser produces a copy, and EVERY post-parse return carries it', async () => {
    const parsed = await parseDocumentToBlocks(bufferOf('drum-label.heic'), 'drum-label.heic', 'image/heic')
    assert.ok(parsed.ok && parsed.converted, 'the parser produced a copy')

    // *** THREE RETURNS, NOT ONE, AND THE THIRD IS THE ONE WORTH HAVING. *** `runDocumentScan`
    // leaves by three doors once the file has been parsed: the model call refused, the answer
    // unparseable, and the reading landing. **A refused model call still converted the file**,
    // and storing the copy there is what stops a re-read decoding a 48-megapixel HEIC twice.
    // Asserted from the source because the model call cannot run in a test.
    const src = readFileSync(join(process.cwd(), 'lib/documentScan.ts'), 'utf8')
    const body = src.slice(src.indexOf('export async function runDocumentScan'))
    const after = body.slice(body.indexOf('const converted = parsed.converted'))
    assert.equal((after.match(/converted,|\), converted \}/g) ?? []).length, 3,
      'all three post-parse returns carry the copy')
    assert.match(after, /\.\.\.refusedScan\(\{[^}]*\}\), converted \}/,
      'including the one where the API refused the request')
  })

  test('saveScan stores it LAST, after the status, and only when there is one', () => {
    // Read out of the source: both writes touch the same row, and doing the cheap correct one
    // first means a slow upload cannot leave a document saying "Reading…" to somebody watching.
    const src = readFileSync(join(process.cwd(), 'lib/documentScan.ts'), 'utf8')
    const status = src.lastIndexOf("status: scan.status === 'could_not_read' ? 'could_not_read' : 'read'")
    const store = src.indexOf('storeConvertedCopy(db, DOCUMENTS_BUCKET')
    assert.ok(status > 0 && store > status, 'the status update comes first')
    assert.match(src.slice(store - 400, store), /if \(scan\.converted\) \{/,
      'and the copy is stored only when the reading produced one')
  })

  test('"Open the file" hands over the converted copy when there is one', () => {
    // A HEIC downloads and shows nothing on Windows; a multi-page TIFF opens in whatever the
    // machine guesses. The original is never altered and never deleted — this is the one button
    // whose job is to let a person LOOK at their file.
    const route = readFileSync(join(process.cwd(), 'app/api/document-actions/route.ts'), 'utf8')
    assert.match(route, /\.select\('file_url, converted_url'\)/)
    assert.match(route, /const key = full\.converted_url \|\| full\.file_url/)
    assert.match(route, /createSignedUrl\(key, 120\)/, 'still short-lived, still never public')
  })

  test('account delete still reaches it, because the depth was chosen for that', () => {
    const walk = readFileSync(join(process.cwd(), 'app/api/account/route.ts'), 'utf8')
    assert.equal((walk.match(/\.list\(/g) ?? []).length, 2,
      'two levels: the company folder, then each folder in it')
    // `converted` is a sibling of `unfiled` and `handbooks`, so the second `.list` finds it.
    assert.equal(convertedPath(CO, DOC).split('/').length, 3)
  })
})

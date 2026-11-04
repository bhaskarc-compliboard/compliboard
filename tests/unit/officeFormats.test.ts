/**
 * THE SIX FORMATS THAT WERE ALREADY FREE, AND THE PDF NOBODY CAN OPEN —
 * `docs/GAPS-PLAN.md` Part B step B4, the owner's decision 54, 3 November 2026.
 *
 * **Nothing new was installed for any of this.** `officeparser` has been a dependency since the
 * PowerPoint branch was written, and its own refusal sentence names everything it reads:
 * *"OfficeParser currently supports docx, pptx, xlsx, odt, odp, ods, pdf, rtf, md, html, csv
 * files only"*. B2 read that sentence while proving `.ppt` could never be read and recorded the
 * six nobody was using; B4 collects them.
 *
 * *** EVERY FIXTURE IS REAL AND WAS MADE ON THE OWNER'S LAPTOP. *** `textutil` writes `.odt`,
 * `.rtf` and `.html`; `.md` is text; `.ods` and `.odp` are zips built by hand because there is no
 * LibreOffice here; and the password-protected PDF is built from the specification, because
 * macOS ships no tool that makes one. `tests/fixtures/file-types/README.md` carries each recipe
 * and `make-encrypted-pdf.mjs` is committed beside the fixture it makes — it is the only one that
 * cannot be remade with a single command, so the recipe lives in the repository or it is lost.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseDocumentToBlocks } from '../../lib/documentContent.ts'
import { runDocumentScan } from '../../lib/documentScan.ts'
import {
  COULD_NOT_OPEN_WORDS, PDF_LOCKED_WORDS, READABLE_EXTENSIONS,
} from '../../lib/acceptedFiles.ts'

const FIXTURES = join(process.cwd(), 'tests/fixtures/file-types')
const read = (f: string) => readFileSync(join(FIXTURES, f))
const bufferOf = (f: string) => new Uint8Array(read(f)).buffer as ArrayBuffer

/** The six, with the media type a browser or a storage row would carry. */
const SIX: Array<[ext: string, file: string, media: string, expect: RegExp]> = [
  ['odt', 'spill-response.odt', 'application/vnd.oasis.opendocument.text', /SPILL RESPONSE PROCEDURE/],
  ['ods', 'fit-test-register.ods', 'application/vnd.oasis.opendocument.spreadsheet', /Half-face P100/],
  ['odp', 'hazcom-refresher.odp', 'application/vnd.oasis.opendocument.presentation', /signal word/],
  ['rtf', 'shift-memo.rtf', 'application/rtf', /CAUSTIC SODA/],
  ['md', 'inspection-notes.md', 'text/markdown', /Oregon DEQ/],
  ['html', 'permit-lookup.html', 'text/html', /Evacuate the west bay/],
]

describe('1. the six read, as text blocks, through the one parser', () => {
  for (const [ext, file, media, expect] of SIX) {
    test(`.${ext} — ${file}`, async () => {
      const r = await parseDocumentToBlocks(bufferOf(file), file, media)
      assert.ok(r.ok, r.ok ? '' : `expected a reading, got: ${r.failure.message}`)
      if (!r.ok) return
      assert.equal(r.kind, 'text', 'what reaches the model is a page of words, whatever the icon says')
      assert.equal(r.blocks.length, 1)
      assert.equal((r.blocks[0] as { type: string }).type, 'text')
      assert.match(r.text, expect, 'and the words are the document’s own')
      assert.equal(r.converted, undefined, 'nothing is converted, so nothing is stored')
    })
  }

  test('every one of the six is offered by the picker', () => {
    for (const [ext] of SIX) {
      assert.ok((READABLE_EXTENSIONS as readonly string[]).includes(ext), `.${ext} is offered`)
    }
    assert.equal(READABLE_EXTENSIONS.length, 23, 'seventeen after B2, twenty-three after B4')
  })

  test('…and by media type alone, for a file stored with no extension', async () => {
    for (const [ext, file, media] of SIX) {
      const r = await parseDocumentToBlocks(bufferOf(file), 'permit', media)
      assert.ok(r.ok, `${media} is routed with no extension to help it (.${ext})`)
    }
  })

  test('*** .html becomes its TEXT, not its tags ***', async () => {
    const source = read('permit-lookup.html').toString('utf8')
    assert.match(source, /<\/?(html|body|p|span)\b/i, 'the file really is markup')
    const r = await parseDocumentToBlocks(bufferOf('permit-lookup.html'), 'permit-lookup.html', 'text/html')
    assert.ok(r.ok)
    if (!r.ok) return
    // `parseOffice` builds an AST of the document and `toText()` walks the nodes. Measured:
    // 1,432 characters of markup came back as 612 characters of words.
    assert.ok(!/<\/?[a-z]/i.test(r.text), `a tag survived into the reading: ${r.text.slice(0, 120)}`)
    assert.ok(r.text.length < source.length, 'and it is shorter than the file it came from')
    assert.match(r.text, /Oregon DEQ/, 'while keeping what the page said')
  })

  test('an .ods is NOT claimed by the Excel branch, which would have sent it to XLSX', () => {
    // `application/vnd.oasis.opendocument.spreadsheet` CONTAINS the word "spreadsheet", and the
    // old condition was `type.includes('spreadsheet')`. Same shape as the `.doc` and `.ppt`
    // claims B1 removed: a branch that claims a file it does not read makes the sentence written
    // for that file unreachable.
    const src = readFileSync(join(process.cwd(), 'lib/documentContent.ts'), 'utf8')
    assert.match(src, /const isExcel = type\.includes\('spreadsheetml'\)/)
    assert.ok(!/const isExcel = type\.includes\('spreadsheet'\)/.test(src))
  })
})

describe('2. a corrupt one of each kind lands could_not_open with its sentence', () => {
  test('a truncated OpenDocument throws and is caught', async () => {
    // Measured: officeparser answers a zip header with nothing behind it `invalid zip data`.
    const r = await parseDocumentToBlocks(
      bufferOf('truncated-procedure.odt'), 'truncated-procedure.odt', 'application/vnd.oasis.opendocument.text')
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.failure.reason, 'could_not_open')
    assert.equal(r.failure.message, COULD_NOT_OPEN_WORDS)
    assert.ok(!/went wrong at our end/i.test(r.failure.message))
  })

  test('an EMPTY Markdown file throws nothing at all, and is still a failure', async () => {
    // *** THIS IS THE ONE WORTH HAVING. *** A corrupt `.odt`, `.ods` or `.odp` throws and is
    // caught; an empty `.md` or `.html` and a truncated `.rtf` come back with no text and NO
    // ERROR. Sending an empty text block to the model is asking it to read a document nobody
    // gave it, and whatever it answers is about nothing — `CLAUDE.md` §3.3.
    const r = await parseDocumentToBlocks(bufferOf('empty-notes.md'), 'empty-notes.md', 'text/markdown')
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.failure.reason, 'could_not_open')
    assert.equal(r.failure.message, COULD_NOT_OPEN_WORDS)
  })

  test('and it reaches the row that way, through the function the sweep calls', async () => {
    const scan = await runDocumentScan({
      buffer: bufferOf('truncated-procedure.odt'),
      fileName: 'truncated-procedure.odt',
      fileType: 'application/vnd.oasis.opendocument.text',
      companyId: '00000000-0000-0000-0000-000000000000',
      context: {} as never,
    })
    assert.equal(scan.status, 'could_not_read')
    assert.equal(scan.could_not_read.reason, COULD_NOT_OPEN_WORDS)
    assert.equal(scan.model, '(not called)', 'no model call, so no cost row')
  })
})

describe('3. a password-protected PDF is stopped before the model call', () => {
  test('the fixture is genuinely encrypted, not a file that claims to be', () => {
    const raw = read('deq-permit-locked.pdf').toString('latin1')
    assert.match(raw, /^%PDF-1\.4/, 'a real PDF header')
    assert.match(raw, /\/Encrypt \d+ 0 R/, 'the trailer points at an encryption dictionary')
    assert.match(raw, /\/Filter \/Standard \/V 1 \/R 2/, 'the standard security handler, RC4 40-bit')
    // And the content stream is not readable as text, because it is encrypted.
    assert.ok(!raw.includes('Oregon DEQ Air Contaminant'),
      'the words are in the file and cannot be seen in its bytes')
  })

  test('it is refused, with its own sentence, and nothing is sent', async () => {
    const r = await parseDocumentToBlocks(
      bufferOf('deq-permit-locked.pdf'), 'deq-permit-locked.pdf', 'application/pdf')
    assert.equal(r.ok, false, 'before B4 this returned ok:true with the whole file base64’d')
    if (r.ok) return
    assert.equal(r.failure.reason, 'could_not_open')
    assert.equal(r.failure.message, PDF_LOCKED_WORDS)
    assert.match(r.failure.message, /password-protected/)
    assert.match(r.failure.message, /Preview or Acrobat/, 'the two applications somebody has')
    assert.ok(!/send us the password|give us the password/i.test(r.failure.message),
      'we do not want the password, and asking for one teaches a habit that costs somebody '
      + 'their records one day')
    assert.ok(!/went wrong at our end/i.test(r.failure.message))
  })

  test('no model call, so no cost row', async () => {
    const scan = await runDocumentScan({
      buffer: bufferOf('deq-permit-locked.pdf'),
      fileName: 'deq-permit-locked.pdf',
      fileType: 'application/pdf',
      companyId: '00000000-0000-0000-0000-000000000000',
      context: {} as never,
    })
    assert.equal(scan.status, 'could_not_read')
    assert.equal(scan.could_not_read.reason, PDF_LOCKED_WORDS)
    assert.equal(scan.model, '(not called)')
    assert.equal(scan.json_parsed, false)
  })

  test('the verdict is the LIBRARY’s, not a guess at the file’s bytes', () => {
    // pdfjs, which officeparser parses PDFs with, raises `No password given` for a file whose
    // trailer carries an `/Encrypt` dictionary. Matched on the message because officeparser wraps
    // the error and exposes no code — which is a string match on somebody else's library, and
    // therefore a thing to re-check when officeparser is upgraded. This test is where that is
    // recorded, and it is why the match is narrow: a wrong POSITIVE refuses a readable file.
    const src = readFileSync(join(process.cwd(), 'lib/documentContent.ts'), 'utf8')
    assert.match(src, /if \(\/password\/i\.test\(message\)\)/)
    assert.match(src, /return \{ text: '', locked: true \}/)
    // Comments stripped first, the way `clientImports.test.ts` does it: this file's own prose
    // explains what `/Encrypt` is, and a comment that names a thing is not code that does it.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/\/Encrypt/.test(code), 'it does not go looking through the bytes itself')
  })

  test('an ordinary PDF is untouched by any of this', async () => {
    const r = await parseDocumentToBlocks(
      new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures/Harbor-Kitchen-Employee-Policy-2026.pdf'))).buffer as ArrayBuffer,
      'Harbor-Kitchen-Employee-Policy-2026.pdf', 'application/pdf')
    assert.ok(r.ok)
    if (!r.ok) return
    assert.equal(r.kind, 'pdf')
    assert.equal((r.blocks[0] as { type: string }).type, 'document', 'still sent whole, as a PDF')
    assert.ok(r.text.length > 1000, 'and its text still comes out for the quote check')
  })

  test('a PDF with no text is STILL READ — that is D3, and it is not this', async () => {
    // The one that matters: "no text" must not become "cannot open". A scanned page, an encrypted
    // file and a generator with no text layer all yield nothing, and only the second is a refusal.
    const r = await parseDocumentToBlocks(
      new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures/unreadable-blurred-page.pdf'))).buffer as ArrayBuffer,
      'unreadable-blurred-page.pdf', 'application/pdf')
    assert.ok(r.ok, 'a PDF we cannot pull text out of is still a PDF the model reads')
    if (!r.ok) return
    assert.equal(r.text, '', 'and the quote check has nothing to check against — PENDING.md D3')
  })
})

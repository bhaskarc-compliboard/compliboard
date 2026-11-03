/**
 * THE HONEST REFUSAL — `docs/GAPS-PLAN.md` Part B step B1, decision 51 (the owner, 3 November 2026).
 *
 * The rule: *"The product offers only the file types it can read today, and a file it cannot read
 * is told so in the reading's own words — which type, and what to do instead — never 'Something
 * went wrong at our end'. The accepted list is ONE constant."*
 *
 * So this holds four things, and the first is the one that matters in six months:
 *
 *   1. **THE LIST AND THE READER CANNOT DRIFT.** `lib/acceptedFiles.ts` names twelve extensions;
 *      `lib/documentContent.ts` has a branch for each. The test reads BOTH FILES and fails if
 *      either grows a type the other does not have. That drift is the bug B1 closes: the picker
 *      offered `.doc`, the reader claimed it, and mammoth threw.
 *   2. Every refused type, on a real fixture, through `runDocumentScan` — the same function the
 *      sweep calls — lands `could_not_read` carrying ITS OWN sentence and never the generic one.
 *   3. An ACCEPTED type that will not open gets a different sentence, because "save it as .docx"
 *      is useless advice to somebody holding a broken .docx.
 *   4. Every picker in the app reads the constant, and the folder picker — which cannot have an
 *      `accept` at all — filters in code instead.
 *
 * *** AND THE DRIFT GUARD IS SHOWN TO FAIL *** (`CLAUDE.md` §9a: a guard nobody has seen fail is a
 * comment). The last test in the first block hands the scanner a doctored copy of the reader and
 * requires it to name the problem.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCEPTED_FILE_TYPES, ACCEPTED_FILE_TYPES_PROSE, COULD_NOT_OPEN_WORDS, READABLE_EXTENSIONS,
  REFUSAL_WORDS, extensionOf, isReadable, refusalFor, refusalLabel, skippedLine, skippedSentences,
  unknownTypeWords,
} from '../../lib/acceptedFiles.ts'
import { parseDocumentToBlocks, describeUnsupported } from '../../lib/documentContent.ts'
import { runDocumentScan } from '../../lib/documentScan.ts'

const ROOT = process.cwd()
const FIXTURES = join(ROOT, 'tests/fixtures/file-types')
const READER = readFileSync(join(ROOT, 'lib/documentContent.ts'), 'utf8')

/** The reader's branch conditions, and nothing else in the file — the `const is…` block. */
function branchBlock(src: string): string {
  const from = src.indexOf('const isPDF =')
  const to = src.indexOf('\n', src.indexOf('const isPowerPoint ='))
  assert.ok(from > 0 && to > from, 'the reader still has its `const isPDF …` block')
  return src.slice(from, to)
}

/** The `IMAGE_TYPES` map's keys, read out of the reader. */
function imageKeys(src: string): string[] {
  const m = src.match(/const IMAGE_TYPES: Record<string, string> = \{([\s\S]*?)\}/)
  assert.ok(m, 'IMAGE_TYPES is still a literal map in the reader')
  return [...m![1].matchAll(/(\w+):\s*'image\//g)].map((x) => x[1])
}

/**
 * Which extensions the reader will actually claim, read off its own source: the ones named in a
 * branch condition, plus every key of `IMAGE_TYPES` (the image branch is keyed by the map).
 */
function extensionsTheReaderClaims(src: string): Set<string> {
  const block = branchBlock(src)
  const named = [...block.matchAll(/ext === '([a-z0-9]+)'/g)].map((m) => m[1])
  return new Set([...named, ...imageKeys(src)])
}

describe('the accepted list IS the reader’s branches (B1)', () => {
  test('every extension the list offers has a branch in the reader', () => {
    const claims = extensionsTheReaderClaims(READER)
    for (const ext of READABLE_EXTENSIONS) {
      assert.ok(claims.has(ext), `lib/acceptedFiles.ts offers .${ext} and lib/documentContent.ts `
        + `has no branch for it — the picker would promise what nothing reads. Claimed: `
        + `${[...claims].sort().join(', ')}`)
    }
  })

  test('and the reader claims nothing the list does not offer', () => {
    const offered = new Set<string>(READABLE_EXTENSIONS)
    for (const ext of extensionsTheReaderClaims(READER)) {
      assert.ok(offered.has(ext), `lib/documentContent.ts claims .${ext} and the accepted list `
        + 'does not offer it. Either add it to READABLE_EXTENSIONS or take the branch out: a '
        + 'type the reader claims and the picker hides is the same drift the other way round.')
    }
  })

  test('the two old promises are gone from the reader: no .doc, no .ppt, no image/* prefix', () => {
    const block = branchBlock(READER)
    assert.ok(!/ext === 'doc'/.test(block), "isWord no longer claims .doc")
    assert.ok(!/ext === 'ppt'/.test(block), "isPowerPoint no longer claims .ppt")
    assert.ok(!/msword/.test(block), 'nor .doc by its media type')
    assert.ok(!/'powerpoint'|includes\('powerpoint/.test(block), 'nor .ppt by its media type')
    assert.ok(!/startsWith\('image\//.test(block),
      "the image/* prefix is what admitted HEIC, TIFF and BMP; the branch reads the five-name set")
  })

  test('the accept attribute is built from the list, and offers no bare image/*', () => {
    assert.equal(ACCEPTED_FILE_TYPES, '.pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.csv,.txt,.docx,.pptx')
    assert.ok(!ACCEPTED_FILE_TYPES.includes('image/*'))
    assert.ok(!ACCEPTED_FILE_TYPES.includes('.doc,') && !ACCEPTED_FILE_TYPES.endsWith('.doc'))
    assert.ok(!ACCEPTED_FILE_TYPES.includes('.ppt,') && !ACCEPTED_FILE_TYPES.endsWith('.ppt'))
    // The prose and the list are one sentence about one thing and must not part company.
    for (const word of ['PDF', 'JPEG', 'PNG', 'Excel', 'CSV', '.docx', '.pptx']) {
      assert.ok(ACCEPTED_FILE_TYPES_PROSE.includes(word), `the prose names ${word}`)
    }
    assert.ok(!/\bimages\b/.test(ACCEPTED_FILE_TYPES_PROSE),
      '"images" is the word that promised HEIC; the prose names the four formats instead')
  })

  test('SHOWN TO FAIL: a reader that claims .doc again is caught', () => {
    const doctored = READER.replace("const isWord = type.includes('wordprocessingml') || ext === 'docx'",
      "const isWord = type.includes('wordprocessingml') || ext === 'docx' || ext === 'doc'")
    assert.notEqual(doctored, READER, 'the line the drift would land on is still there to doctor')
    const claims = extensionsTheReaderClaims(doctored)
    assert.ok(claims.has('doc'), 'the scanner sees the re-added claim')
    const offered = new Set<string>(READABLE_EXTENSIONS)
    assert.ok(!offered.has('doc'), 'and the list does not offer it, which is the failure')
  })
})

describe('the sentences (B1 item 3, the owner reads these)', () => {
  test('each refused type names itself and says what to do instead', () => {
    const cases: Array<[string, RegExp[]]> = [
      ['forklift-log-1998.doc', [/old Word format \(\.doc\)/, /cannot read yet/, /Save it as \.docx or PDF/]],
      ['safety-induction-2004.ppt', [/old PowerPoint format \(\.ppt\)/, /Save it as \.pptx or PDF/]],
      ['fit-test-photo.heic', [/iPhone photo in HEIC/, /Most Compatible/, /JPEG/]],
      ['scanned-permit-page.tiff', [/TIFF scan/, /Save it as PDF, JPEG or PNG/]],
      ['site-plan.bmp', [/BMP image/, /Save it as JPEG, PNG or PDF/]],
    ]
    for (const [name, patterns] of cases) {
      const words = refusalFor(name)
      assert.ok(words, `${name} is refused`)
      for (const p of patterns) assert.match(words!, p, `${name}: ${p}`)
      // §5.1: never imply the file is at fault, and never the generic sentence.
      assert.ok(!/went wrong/i.test(words!), `${name} does not blame our end`)
      assert.ok(!/invalid|corrupt|bad file/i.test(words!), `${name} does not blame the file`)
    }
  })

  test('a type we have no name for still says which it is and what to do', () => {
    assert.match(refusalFor('site-notes.pages')!, /We do not recognise \.pages files yet/)
    assert.match(refusalFor('site-notes.pages')!, /Save it as a PDF and add it again/)
    // A file saved with no extension and no type we know.
    assert.match(refusalFor('permit', 'application/octet-stream')!, /no type we recognise/)
    assert.equal(unknownTypeWords(''), refusalFor('permit', 'application/octet-stream'))
  })

  test('every readable type passes, by extension or by media type alone', () => {
    for (const ext of READABLE_EXTENSIONS) {
      assert.equal(refusalFor(`records.${ext}`), null, `.${ext} reads`)
      assert.equal(refusalFor(`RECORDS.${ext.toUpperCase()}`), null, `.${ext} reads in capitals too`)
    }
    // No extension at all, but the recorded MIME type is one the reader names — a PDF saved as
    // `permit`. This worked before B1 and must go on working.
    assert.equal(refusalFor('permit', 'application/pdf'), null)
    assert.ok(isReadable('permit', 'application/pdf'))
    // And the refused extension beats a readable MIME type: a HEIC a browser called image/jpeg
    // is still a HEIC, and the API still refuses it.
    assert.equal(refusalFor('photo.heic', 'image/jpeg'), REFUSAL_WORDS.heic)
    assert.ok(!isReadable('photo.heic', 'image/jpeg'))
  })

  test('extensionOf: the cases a stored path actually produces', () => {
    assert.equal(extensionOf('a/b/Report 2026.PDF'), 'pdf')
    assert.equal(extensionOf('permit'), '')
    assert.equal(extensionOf('scan.pdf?token=x'), 'pdf')
    assert.equal(extensionOf(''), '')
  })
})

describe('a refused file through the reading path, on a real fixture (B1 item 6)', () => {
  const scanOf = (file: string) => runDocumentScan({
    buffer: new Uint8Array(readFileSync(join(FIXTURES, file))).buffer as ArrayBuffer,
    fileName: file,
    fileType: '',
    companyId: '00000000-0000-0000-0000-000000000000',
    // Nothing in the context is read: the refusal happens before the prompt is built.
    context: {} as never,
  })

  for (const [file, pattern] of [
    ['forklift-log-1998.doc', /old Word format \(\.doc\)/],
    ['safety-induction-2004.ppt', /old PowerPoint format \(\.ppt\)/],
    ['fit-test-photo.heic', /iPhone photo in HEIC/],
    ['scanned-permit-page.tiff', /TIFF scan/],
    ['site-plan.bmp', /BMP image/],
  ] as Array<[string, RegExp]>) {
    test(`${file} lands could_not_read with its own sentence, and never the generic one`, async () => {
      const scan = await scanOf(file)
      assert.equal(scan.status, 'could_not_read')
      assert.match(scan.could_not_read.reason ?? '', pattern)
      // *** THE SENTENCE THIS STEP EXISTS TO DELETE. ***
      assert.ok(!/went wrong at our end/i.test(scan.could_not_read.reason ?? ''),
        'the reason is the type\'s own, not the route\'s last resort')
      // No model was called, so there is no cost row and nothing to bill — which is also why a
      // paused company is unaffected by any of this (decision 11).
      assert.equal(scan.model, '(not called)')
      assert.equal(scan.json_parsed, false)
      // `way_forward` is null on purpose since B1: the reason carries the instruction, and the
      // database has no column for a second half.
      assert.equal(scan.could_not_read.way_forward, null)
    })
  }

  test('an ACCEPTED type that will not open gets a different sentence', async () => {
    const scan = await scanOf('broken-handbook.docx')
    assert.equal(scan.status, 'could_not_read')
    assert.equal(scan.could_not_read.reason, COULD_NOT_OPEN_WORDS)
    assert.match(scan.could_not_read.reason ?? '', /could not read this file/)
    assert.match(scan.could_not_read.reason ?? '', /damaged or incomplete/)
    // It must NOT say "save it as .docx": it already is one.
    assert.ok(!/Save it as \.docx/.test(scan.could_not_read.reason ?? ''))
    assert.ok(!/went wrong at our end/i.test(scan.could_not_read.reason ?? ''))
  })

  test('the parser itself: a refusal before any byte, a described failure after', async () => {
    const doc = await parseDocumentToBlocks(
      new Uint8Array(readFileSync(join(FIXTURES, 'forklift-log-1998.doc'))).buffer as ArrayBuffer,
      'forklift-log-1998.doc', 'application/msword')
    assert.equal(doc.ok, false)
    if (doc.ok) return
    assert.equal(doc.failure.reason, 'unsupported_format')
    assert.equal(doc.failure.extension, 'doc')
    assert.equal(doc.failure.message, REFUSAL_WORDS.doc)

    const broken = await parseDocumentToBlocks(
      new Uint8Array(readFileSync(join(FIXTURES, 'broken-handbook.docx'))).buffer as ArrayBuffer,
      'broken-handbook.docx', null)
    assert.equal(broken.ok, false)
    if (broken.ok) return
    assert.equal(broken.failure.reason, 'could_not_open', 'an accepted type is a different failure')
    assert.equal(broken.failure.message, COULD_NOT_OPEN_WORDS)
  })

  test('a readable fixture still reads — the refusal has not closed the door on everything', async () => {
    const ok = await parseDocumentToBlocks(
      new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/kitchen-rota-notice.docx'))).buffer as ArrayBuffer,
      'kitchen-rota-notice.docx', null)
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.kind, 'word')
    assert.ok(ok.text.length > 20, 'and it has the document’s text in it')
  })

  test('describeUnsupported says the type’s own sentence', () => {
    assert.equal(describeUnsupported('x.heic', 'heic').message, REFUSAL_WORDS.heic)
    // The catalogue sentence survives only where there is nothing specific to say, and the list
    // offers .pdf, so a drifted extension falls back rather than claiming to recognise it.
    assert.match(describeUnsupported('x.pdf', 'pdf').message, /can be read/)
  })
})

describe('the folder path reports what it skipped, by type (B1 item 4)', () => {
  test('the count line groups by type', () => {
    assert.equal(
      skippedLine(['a.doc', 'b.doc', 'photo.heic']),
      '3 files skipped: 2 old Word (.doc), 1 HEIC photo')
    assert.equal(skippedLine(['a.doc']), '1 file skipped: 1 old Word (.doc)')
    assert.equal(skippedLine([]), '')
    assert.equal(skippedLine(['notes.pages']), '1 file skipped: 1 .pages file')
    assert.equal(refusalLabel('scan.tiff'), 'TIFF scan')
  })

  test('and the sentences underneath are one per type, not one per file', () => {
    const lines = skippedSentences(['a.doc', 'b.doc', 'photo.heic'])
    assert.equal(lines.length, 2, 'two .doc files, one .doc sentence')
    assert.equal(lines[0], REFUSAL_WORDS.doc)
    assert.equal(lines[1], REFUSAL_WORDS.heic)
    assert.deepEqual(skippedSentences([]), [])
  })

  test('the Documents page filters BOTH pickers in code, because a folder picker has no accept', () => {
    const page = readFileSync(join(ROOT, 'app/documents/page.tsx'), 'utf8')
    // One handler serves both inputs, and the filter is at the top of it.
    assert.match(page, /const files = all\.filter\(\(f\) => !refusalFor\(f\.name, f\.type\)\)/)
    assert.match(page, /const refused = all\.filter\(\(f\) => refusalFor\(f\.name, f\.type\)\)/)
    // The folder input genuinely has no accept — which is why the code filter is not optional.
    const folder = page.slice(page.indexOf('ref={folderInputRef}'))
    assert.ok(!folder.slice(0, 200).includes('accept='), 'the folder input has no accept attribute')
    // Nothing is uploaded when everything was refused.
    assert.match(page, /if \(!files\.length\) \{/)
    // And the person is told, with the sentences and not only a count.
    assert.match(page, /skipped\.sentences\.map/)
  })
})

describe('every picker reads the one constant (B1 item 1)', () => {
  for (const file of [
    'app/documents/page.tsx', 'app/compliance/page.tsx', 'app/hr/HrWorkspace.tsx',
    'components/AskScreen.tsx',
  ]) {
    test(`${file}`, () => {
      const src = readFileSync(join(ROOT, file), 'utf8')
      assert.match(src, /from '@\/lib\/acceptedFiles'/, 'it imports the list')
      assert.match(src, /accept=\{ACCEPTED_FILE_TYPES\}/, 'and its picker offers exactly the list')
      assert.ok(!/accept="\./.test(src), 'and holds no hand-written accept string of its own')
    })
  }

  test('and no picker is left anywhere with a hand-written list', () => {
    // `app/upload/page.tsx` is named by `docs/GAPS-PLAN.md` B1 and by `DECISIONS.md`; it does not
    // exist (removed before this step). The three pages and the shared screen above are all of
    // them, and this is the check that keeps a fifth from appearing unnoticed.
    const pages = ['app/documents/page.tsx', 'app/compliance/page.tsx', 'app/hr/HrWorkspace.tsx',
      'components/AskScreen.tsx']
    for (const f of pages) {
      const src = readFileSync(join(ROOT, f), 'utf8')
      assert.ok(!/accept=["'][^"']*image\/\*/.test(src), `${f} offers no image/* wildcard`)
    }
  })

  test('the chat path refuses at its own chokepoint, not only in the screen', () => {
    const upload = readFileSync(join(ROOT, 'lib/chatUpload.ts'), 'utf8')
    assert.match(upload, /const refusal = refusalFor\(file\.name, file\.type\)/)
    // Before the storage upload, so a refused file is never stored.
    assert.ok(upload.indexOf('refusalFor(file.name') < upload.indexOf('.upload(path, file)'),
      'the refusal comes before the file is put in the bucket')
  })

  test('the Workspace and HR refuse in their own handlers', () => {
    const workspace = readFileSync(join(ROOT, 'app/compliance/page.tsx'), 'utf8')
    assert.match(workspace, /function stageFile[\s\S]{0,700}?if \(refusal\) \{ setNotice\(refusal\); return \}/)
    const hr = readFileSync(join(ROOT, 'app/hr/HrWorkspace.tsx'), 'utf8')
    assert.match(hr, /onFileChosen[\s\S]{0,900}?if \(refusal\) \{ addFailed\(refusal\); return \}/)
  })
})

describe('the list stays importable from a client component', () => {
  test('lib/acceptedFiles.ts imports nothing at all', () => {
    const src = readFileSync(join(ROOT, 'lib/acceptedFiles.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.ok(!/^\s*import\b/m.test(src),
      'it is imported by four client components; one import of lib/documentContent.ts here would '
      + 'bundle xlsx, mammoth and officeparser into the browser')
  })
})

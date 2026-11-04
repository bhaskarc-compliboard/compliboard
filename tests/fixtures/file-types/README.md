# One file per type the product refuses, and one per type it converts

GAPS-PLAN Part B steps **B1** (decision 51), **B2** (decisions 52 and 53) and **B4** (decision 54), 3 November 2026

These exist so the refusal can be tested on a real file rather than on a name. Every one was made
on the owner's laptop on 3 November 2026 with tools macOS already has; the command is beside each.

> **⚡ B2 CHANGED WHAT THREE OF THESE ARE FOR, on the same day.** B1 refused `.heic`, `.tif`/`.tiff`
> and `.bmp` by name; B2 **reads** all five, by converting each to a JPEG inside Vercel
> (`lib/imageConvert.ts`). So `fit-test-photo.heic`, `scanned-permit-page.tiff` and `site-plan.bmp`
> are no longer refusal fixtures — they are the smallest valid file of each format, kept because a
> converter that works on a photograph and falls over on a 123-byte one-pixel TIFF is a converter
> with a hole in it. The files B2 added are at the bottom.

**Nothing in the B1 half is parsed by the test.** The refusal is decided from the file's name and
recorded media type *before* any byte is opened (`lib/acceptedFiles.ts` `refusalFor`, called at the top of
`parseDocumentToBlocks`), which is the whole point of B1 — a type we cannot read must cost nothing
and must never reach a parser. So these files are small on purpose, and a hand-made container is
as good a test as a full document would be. They are real files all the same, and `file` names each
one correctly, because a fixture that is not what it claims to be teaches the next person nothing.

| File | What it is, from `file` | How it was made |
|---|---|---|
| `forklift-log-1998.doc` | `Composite Document File V2 Document` — a **real Word 97 binary** | `textutil -convert doc log.txt -output forklift-log-1998.doc` |
| `safety-induction-2004.ppt` | `Composite Document File V2 Document, Cannot read section info` | the eight-byte OLE2/CFB signature a real `.ppt` opens with (`D0 CF 11 E0 A1 B1 1A E1`) plus padding, written with `node`. **Nothing on this laptop makes a complete PowerPoint 97 file** and nothing needs to: see the paragraph above |
| `fit-test-photo.heic` | `ISO Media, HEIF Image HEVC Main or Main Still Picture Profile` — a real HEIC, the format every iPhone photo arrives in | `sips -s format heic tiny.png --out fit-test-photo.heic`. **HEIC CAN be made locally**, on macOS, which the step's brief allowed for being impossible |
| `scanned-permit-page.tiff` | `TIFF image data, little-endian, … compression=none` — a valid 1×1 baseline TIFF, 123 bytes | written by hand with `node`. `sips -s format tiff` was tried first and writes a **512 × 512 tile for any image**, so a 4 × 2 photo came out 790 KB; `tiffutil -dump` reads this one and lists all nine of its tags |
| `site-plan.bmp` | `PC bitmap, Windows 3.x format` | `sips -s format bmp tiny.png --out site-plan.bmp` |
| `broken-handbook.docx` | `data` — an **accepted** type that still cannot be opened | `PK\x03\x04` followed by text that is not the rest of an archive, written with `node`. A `.docx` is a zip; this is what a truncated download looks like. mammoth throws `Corrupted zip: can't find end of central directory` on it, which is the throw B1's `try` is for |

`tiny.png` above was `sips -s format png --resampleWidth 4 /System/Library/Wallpapers/.default/DefaultAerial.heic`.

**Checked by running the parsers on them, not by reasoning about them.** mammoth throws
`Can't find end of central directory : is this a zip file ?` on the `.doc` and on the `.ppt`, and
`Corrupted zip` on `broken-handbook.docx`; officeparser answers the `.ppt` with its own sentence —
*"Sorry, OfficeParser currently supports docx, pptx, xlsx, odt, odp, ods, pdf, rtf, md, html, csv
files only"* — the library itself confirming what the old comment on `isPowerPoint`
(`lib/documentContent.ts:280`–`:299` since B1) claimed about `.ppt`, and the reason B1 deleted the
fork rather than keeping it.


---

## What B2 added, 3 November 2026

These ARE parsed, by real decoders, because the three things that go wrong with a photograph are
all invisible to a stand-in: a decoder that is not built in, a channel order that is backwards,
and a page silently dropped.

| File | What it is | How it was made | What it holds |
|---|---|---|---|
| `drum-label.heic` | a real HEIC, **3024 × 4032**, of a GHS drum label with legible text | drawn as SVG, rendered with sharp, then `sips -s format heic` | that a HEIC reads at all; that the block comes back `image/jpeg` and not `image/heic`; that the long edge lands on 2,576; that a portrait photograph stays portrait |
| `inspection-sheets-3pages.tiff` | a **3-page** TIFF, 120 × 160, LZW | `tiffutil -cat` three times, then `tiffutil -lzw` | that three pages become three image blocks, in order, and that only the first is stored |
| `floor-plan.bmp` | a 24-bit BMP | `sips -s format bmp` | that BMP reads (sharp cannot), and that it comes back the right colour — `bmp-ts` returns **ARGB**, and read as RGBA the picture decodes perfectly and is blue |
| `half-sent-photo.heic` | the first 64 bytes of a real HEIC and nothing behind them | `node`, from `drum-label.heic` | what a half-finished AirDrop leaves: an accepted type that will not open, which must land `could_not_read` with the FALLBACK sentence and never "Something went wrong at our end" |
| `panorama-81mp.tiff` | a TIFF header **claiming 9000 × 9000** with one byte of pixel data | written by hand with `node` | the ceiling. If it were checked after decoding, this file would be 324 MB of RGBA before anybody noticed. It is refused from the header in under half a second, and the sentence says *"about 81 megapixels"* |

**The 50-megapixel ceiling is the owner's option (ii), decision 53**, and the number behind it is
measured: `heic-decode` allocates `width * height * 4` and has no scaled decode, so a
48-megapixel HEIC peaked at **1,036 MB** of RSS. 48 passes; 81 does not.

The drum label is also `tests/golden/documents/fixtures/07-drum-label-photo.heic` — the golden
set's first photograph, and the container label for the chemical in case 05.


---

## What B4 added, 3 November 2026 — the six that were already free, and the one nobody can open

`officeparser` has been a dependency since the PowerPoint branch was written, and **its own
refusal sentence names everything it reads**: *"OfficeParser currently supports docx, pptx, xlsx,
odt, odp, ods, pdf, rtf, md, html, csv files only"*. B2 read that sentence while proving `.ppt`
could never be read. B4 collects the six nobody was using — no dependency, no converter, no
service, a branch and a fixture each.

| File | What it is | How it was made |
|---|---|---|
| `spill-response.odt` | a real OpenDocument Text — a caustic soda spill procedure | `textutil -convert odt src.txt -output spill-response.odt` |
| `shift-memo.rtf` | Rich Text Format, version 1 | `textutil -convert rtf` |
| `permit-lookup.html` | an HTML document, as a page saved from a browser | `textutil -convert html`. **1,432 characters of markup; the reading is 612 characters of words with no tag in them** |
| `inspection-notes.md` | Markdown — which is to say, text | the same source file, copied |
| `fit-test-register.ods` | a real OpenDocument **Spreadsheet**: a respirator fit-test register, four rows | built by hand with `zip`. `textutil` writes `odt` and nothing else of the family, and there is no LibreOffice here. An ODF file is a zip whose FIRST member must be `mimetype`, **stored, not deflated** — `zip -X -0` writes exactly that, then `zip -X -r` adds `META-INF/manifest.xml` and `content.xml`. `file` reads both back correctly |
| `hazcom-refresher.odp` | a real OpenDocument **Presentation**, two slides | the same way, with a presentation body |
| `truncated-procedure.odt` | a zip header with nothing behind it | `node`. officeparser answers `invalid zip data`, so this lands `could_not_open` |
| `empty-notes.md` | **nothing at all, zero bytes** | `Buffer.alloc(0)`. **This is the one worth having**: a corrupt ODF *throws* and is caught, but an empty `.md` or `.html` and a truncated `.rtf` come back with no text and NO ERROR. Sending the model an empty text block is asking it to read a document nobody gave it |
| **`deq-permit-locked.pdf`** | **a genuinely password-protected PDF** — `/Filter /Standard /V 1 /R 2`, RC4 40-bit, user password `drums2026` | **`make-encrypted-pdf.mjs`, committed beside it.** Nothing on this laptop makes one: no `qpdf`, no `pdftk`, no LibreOffice, and `textutil` does not write PDF at all. So it is built from the specification — Algorithm 2 for the file key, 3 for `/O`, 4 for `/U`, RC4 implemented in fifteen lines because OpenSSL 3 no longer offers it. **It is the only fixture here that cannot be remade with one command, which is why its recipe is in the repository rather than in this table** |

**How the password is detected, and it is not by reading the bytes.** officeparser parses PDFs
with pdfjs, which raises **`No password given`** for a file whose trailer carries an `/Encrypt`
dictionary. `lib/documentContent.ts` already ran that parse for every PDF — to get the text the
quote check compares against — and threw the answer away into a `console.warn`. B4 reads the
verdict instead. Proved by running it before changing anything: the parser returned `ok: true`,
one `document` block of **1,420 base64 bytes** and `text: ''`, while the log said
*"pdf text extraction failed … No password given"*. **The money was spent on a document nobody
could open.**

# One file per type the product refuses — GAPS-PLAN Part B step B1, decision 51

These exist so the refusal can be tested on a real file rather than on a name. Every one was made
on the owner's laptop on 3 November 2026 with tools macOS already has; the command is beside each.

**Nothing here is parsed by the test.** The refusal is decided from the file's name and recorded
media type *before* any byte is opened (`lib/acceptedFiles.ts` `refusalFor`, called at the top of
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

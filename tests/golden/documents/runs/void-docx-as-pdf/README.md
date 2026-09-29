# Void: two runs where a .docx was sent to the API as a PDF

Audits Run 1b, 29 September 2026. These two run files are kept and NOT counted.

`scripts/run-golden-docs.js` hardcoded `application/pdf` in three places — the storage
`contentType`, the `documents.file_type` column, and `runDocumentScan`'s `fileType` argument. Every
fixture was a PDF until cases 12 and 13, which are Word. `parseDocumentToBlocks` was therefore told
a .docx was a PDF, sent it as a pdf document block, and the API refused the call:

    messages.0.content.0.pdf.source.base64.data: The PDF specified was not valid.
    request_id: req_011CfYD2L2QVvgNiJDrSsmyA  (case 12)
    request_id: req_011CfYD2WtWSCm7oXjWqZ7U5  (case 13)

So both scans came back `could_not_read`, with no model reading in them. **Nothing about the
templates can be read off these files** — in particular they must not be offered as evidence for
the brief's question "do 12 and 13 come out not_judged with no gaps", which they cannot answer.

They are here rather than deleted for the same reason `tests/golden/audits/runs/cascade-deq/void-capped/`
is: a run that was bought and thrown away is evidence about the runner, and a deleted one is
indistinguishable from one that never happened.

Fixed in the same commit; the counted pass is the one whose run files sit in the case folders.

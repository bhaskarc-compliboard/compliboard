import { askAIJson, type AIContent } from '@/lib/ai'
import { EXTRACT_PROMPT } from '@/prompts/extract-dates'
import { NextRequest, NextResponse } from 'next/server'
import { parseDocumentToBlocks } from '@/lib/documentContent'

export async function POST(request: NextRequest) {
  // Declared outside the try so the catch can name the file it failed on. A message that
  // cannot say WHICH document it is about is not much of a message.
  let fileLabel = 'that file'
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileName = formData.get('file_name') as string || ''
    if (file) fileLabel = fileName || file.name

    if (!file) {
      return NextResponse.json({ dates_found: [] })
    }

    // Parsing lives in lib/documentContent.ts. This route previously carried its own copy
    // of the branching — the most complete of the four, which is why the shared version
    // was built from it. text/plain is the one format it did not have.
    const parsed = await parseDocumentToBlocks(await file.arrayBuffer(), file.name, file.type)
    if (!parsed.ok) {
      // THE UPLOAD STILL SUCCEEDS. This route runs in the background behind a file upload
      // and has always answered "no dates" rather than failing it — a document that cannot
      // be read for dates is still a document worth storing.
      //
      // But "no dates" and "could not read it" are different answers, and returning the
      // same empty array for both makes them indistinguishable to the caller. Two callers
      // currently turn that empty array into
      //
      //     "No compliance dates found in this file."
      //
      // which asserts something about the document's CONTENTS on the basis of never
      // having read it. extraction_failed carries the reason so a caller can tell the
      // difference and say the true thing instead.
      console.warn('extract-dates: ' + parsed.failure.message)
      return NextResponse.json({ dates_found: [], extraction_failed: parsed.failure })
    }

    const messageContent: AIContent = [
      ...parsed.blocks,
      { type: 'text', text: `File name: ${fileName || file.name}\n\nExtract all important compliance dates from this document.` },
    ]

    const result = await askAIJson(EXTRACT_PROMPT, messageContent, { maxTokens: 1000 })

    return NextResponse.json(result)
  } catch (error) {
    // THIRD OUTCOME, AND UNTIL NOW INDISTINGUISHABLE FROM THE OTHER TWO.
    //
    // "no dates in it", "we cannot read that format" and "something broke at our end" are
    // three different things, and all three used to come back as an identical empty array.
    // Same field, different `reason`, so a caller branches on presence once and reads
    // `reason` only if it cares which.
    //
    // Still 200 and still dates_found: [] — the upload must not fail because date
    // extraction did.
    console.error('Date extraction error:', error)
    return NextResponse.json({
      dates_found: [],
      extraction_failed: {
        name: fileLabel,
        reason: 'extraction_error',
        extension: '',
        message: `We couldn't read the dates out of "${fileLabel}" — something went wrong at our end, `
          + `not with your file. It has still been saved. This is usually temporary, so try again in a moment.`,
      },
    })
  }
}

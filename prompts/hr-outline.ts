/**
 * A HANDBOOK'S OUTLINE — HR Step 5b. One call per part of a PDF handbook's TEXT (never the PDF file).
 *
 * The caller is `lib/handbookRead.ts`; the cutting is `lib/handbookSections.ts`.
 *
 * *** THE MODEL NEVER CUTS THE HANDBOOK. *** It names each section and copies the section's first words.
 * Code finds those words in the text, in order, and cuts there, then proves the pieces join back to the
 * whole text. An anchor that is not in the text is dropped and counted, so a section can be missed but no
 * text can be lost or invented. It is anchored (§3.3): the handbook's own text is the artifact.
 */
export function hrOutlinePrompt(part: { index: number; count: number; pageFrom: number; pageTo: number }): string {
  const where = part.count > 1
    ? `This is part ${part.index} of ${part.count} of the handbook (pages ${part.pageFrom} to ${part.pageTo}). It may begin in the middle of a section that started in an earlier part: do not list that one. List only the sections whose heading appears in this part.`
    : 'This is the whole handbook.'
  return `You are outlining an employee handbook so it can be read section by section.

You are given the handbook's text, as it was drawn from the file. ${where}

List the handbook's sections in the order they appear. A section is a part of the handbook with its own heading, such as "3.1 Hours and overtime" or "Paid Sick Leave". Use the handbook's own headings; do not invent sections, and do not list the entries of a table of contents as sections.

For each section give:
- "title": the section's heading, as written.
- "anchor": the first 6 to 12 words of the section, starting with its heading, COPIED EXACTLY from the text: the same words, spelling, numbers and punctuation, in the same order. Do not correct, shorten or reword them. The anchor is searched for in the text, and an anchor that is not found word for word is thrown away.

Reply with JSON only, in this shape:
{"sections": [{"title": "...", "anchor": "..."}]}`
}

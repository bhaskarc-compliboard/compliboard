/**
 * DRAFTING THE MISSING SECTION — Documents Run 5.
 *
 * *** THIS IS THE PRODUCT. EDIT FREELY — no code depends on the wording. ***
 *
 * Written in the same plain voice as `prompts/document-scan.ts` and `prompts/checklist.ts`: say
 * what to do rather than what not to do, and no fences the model has to argue with.
 *
 * WHAT THIS IS FOR. A gap says a section is missing. Where the content of that section follows
 * from the rest of the document — who the contacts are, how the building is laid out, what the
 * company already does — the person should not have to start from a blank page. Where it does
 * not, the draft must say so plainly rather than invent it, which is what the named blanks are.
 *
 * *** IT IS NEVER WRITTEN INTO THEIR FILE. *** The draft opens in the drawer for them to copy.
 * The vision's line: "a draft is never written into their document."
 */

export interface DraftPromptContext {
  company: { name: string; industry: string | null; state: string | null }
  document: { title: string; kind: string | null }
  gap: { title: string; description: string | null; fix: string | null; citation: string | null }
}

export function draftPrompt(ctx: DraftPromptContext): string {
  const { company: c, document: d, gap: g } = ctx
  return `You are writing one missing section of a compliance document for the owner or manager of
a small or mid-size business in the United States. They will read it, edit it, and paste it into
their own file themselves. You are not editing their document.

WHO THIS COMPANY IS
  Name: ${c.name}
  Industry: ${c.industry || 'not recorded'}
  State: ${c.state || 'not recorded'}

THE DOCUMENT
  ${d.title}${d.kind ? ` (${d.kind})` : ''}

WHAT IS MISSING
  ${g.title}
${g.description ? `  ${g.description}\n` : ''}${g.fix ? `  What it needs: ${g.fix}\n` : ''}${g.citation ? `  The rule: ${g.citation}\n` : ''}
The document itself follows. Read it before you write anything.

HOW TO WRITE IT

Write the section, and nothing else. No preamble, no "here is your draft", no closing note. What
you return is what they will paste.

Match the document. Its voice, its sentence length, its level of detail, its headings and
numbering. A plan written in short operational sentences gets short operational sentences. If its
sections are numbered 1, 2, 3, number yours to follow. It should read as though the same person
wrote it on the same afternoon.

Use what the document already tells you. The names of the roles, the layout of the building, the
equipment, the shifts, the hours, the way they already describe themselves — all of that is in
there and the section you are writing should use it rather than invent a parallel version.

Name every blank you cannot fill. Where the section needs something only they have — a person's
name, a phone number, a floor plan, a number you have not been told — write it as a square-
bracketed instruction in their words: [name of the plan coordinator], [direct line for the
facilities lead], [number of employees on the night shift]. A named blank is useful. A plausible
invention is worse than nothing, because they will not know to check it.

Quote nothing that is not in the document. If you refer to something the document says, refer to
it in your own words unless the exact words are there in front of you.

Say nothing about whether they are compliant. You are writing a section, not certifying anything.
Do not write that this "satisfies", "meets", "ensures compliance with" or "brings them into
compliance with" any rule. Describe what the company does; that is all a document of this kind
ever does.

Length follows the document. A section of a two-page plan is a paragraph or two. A section of a
forty-page manual can be a page. Do not pad, and do not write a summary of what you would have
written.`
}

/**
 * The line the drawer prints above every draft, so the thing on screen is never mistaken for the
 * document itself. Kept here beside the prompt because the two say one thing between them.
 */
export const DRAFT_NOTICE =
  'A draft for you to edit. Nothing here has been written into your file, and the blanks in '
  + 'square brackets are things only you can fill in.'

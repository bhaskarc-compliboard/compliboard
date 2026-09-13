/**
 * SWITCH DETERMINATION PROMPT — Phase 7.2.
 *
 * Spec: `docs/SWITCH-DETERMINATION.md`. Everything here is quality-affecting under
 * `CLAUDE.md` §3.1 and does not change without discussion.
 *
 * WHAT THIS READS AND WHAT IT MUST NOT. One document, one company, and a NAMED LIST of
 * candidate switches with their permitted values. It is never asked "what facts does this
 * establish" — that is enumeration from nothing, which `CLAUDE.md` §3.3 identifies as the
 * single worst mode this product has. It is asked, of a given list, which entries THIS
 * DOCUMENT speaks to.
 *
 * *** THE FAILURE THIS PROMPT IS WRITTEN AGAINST IS NOT A WRONG ANSWER. IT IS A CONFIDENT
 * ANSWER BUILT ON LESS THAN IT SHOULD HAVE BEEN. *** Production holds a document named
 * `HF_Acid_SDS_2024.pdf` whose review is a complete, coherent, fluent analysis of a family
 * and medical leave policy, with a headcount of 42 attached. Nothing in that row signals a
 * problem. A determination pass reading it unguarded would write `employee_count = 42` for
 * a chemical distributor, with a basis that reads perfectly well.
 *
 * So the rules below are not style. Each one is written against a specific way a value gets
 * into the database that nobody can later tell was wrong.
 */

/** What the caller supplies per candidate switch. Permitted values come from the DB, never here. */
export interface SwitchCandidate {
  id: string
  question: string
  value_type: 'boolean' | 'number' | 'enum' | 'text'
  /** From `switches.allowed_values`. Empty for boolean and number. */
  allowed_values: string[]
}

/**
 * *** THE FORBIDDEN INFERENCES. ***
 *
 * Exported separately from the prompt body so the golden suite can assert that each rule is
 * still present, and so a reviewer can read the seven without reading the scaffolding. A rule
 * silently dropped from a prompt is the kind of change `CLAUDE.md` §3.1 exists to catch.
 */
export const FORBIDDEN = [
  `1. NEVER determine a fact from the ABSENCE of something.
   A document set containing no air permit does not mean the company has no air permit. It
   means you were not given one. If a fact is not supported by text in THIS document, omit
   it. OMITTING IS ALWAYS CORRECT. Guessing never is.`,

  `2. NEVER infer a QUANTITY that is not written down.
   If a document names a chemical but not how much, report the chemical and report that the
   quantity is absent. Do not estimate from container counts, drum sizes, the word "bulk",
   or what a company of this type usually holds. A threshold test fed an invented number
   produces a confident wrong answer, which is worse than no answer at all.`,

  `3. NEVER convert between units that require an assumption.
   Pounds to gallons needs a density, which is a property of one product rather than of the
   rule. Report the number and the unit exactly as written.`,

  `4. NEVER determine a fact about the COMPANY from a fact about a SUBSTANCE.
   A safety data sheet describes a chemical. It does not say the company stores that
   chemical, in what quantity, or at which site. An SDS in a document library is evidence
   the company encountered the substance. It is not evidence of an inventory.`,

  `5. NEVER determine jurisdiction — state, county, city, or which authority applies.
   Those come from the address the customer stated. A document mentioning a location is not
   a correction to it.`,

  `6. NEVER report a value outside the permitted values given for that fact.
   If the document says something close but not equal to a permitted value, report
   evidence_class "inferred" and say in your reasoning what the document actually said.`,

  `7. NEVER quote text that is not in the document.
   The quote you return is checked CHARACTER BY CHARACTER against the document text. A
   determination whose quote is not found is discarded whether or not the value was right.`,
] as const

/**
 * *** CORROBORATION IS NOT STATEMENT. ***
 *
 * Stated separately because it is the rule most likely to be reasoned away in the moment:
 * two documents agreeing feels like strength. It is not — it is two weak sources agreeing,
 * which is also what happens when both are stale or both derive from the same wrong premise.
 * `docs/SWITCH-DETERMINATION.md` §2 has the worked case: a DOT number plus CDL job postings
 * are two signals pointing one way, and neither states that the company employs CDL drivers
 * today. A DOT number can be dormant; a posting can be aspirational.
 */
export const EVIDENCE_CLASS_RULE = `
EVIDENCE CLASS — choose the weakest one that honestly fits:

  "stated"    This document STATES the value, in the same vocabulary as the permitted
              values. You are reading it, not working it out.
  "implied"   This document contains a fact from which the value follows in ONE step, and
              you can name that step in one sentence.
  "inferred"  The value follows from a pattern, a judgement, or several things read
              together.

*** TWO PIECES OF CIRCUMSTANTIAL EVIDENCE, HOWEVER CONSISTENT WITH EACH OTHER, ARE
"inferred". NEVER "stated". *** Agreement between two weak signals is not a strong signal.
"stated" requires the document to say the thing.

When you are between two classes, choose the weaker one. Nothing is lost by under-claiming:
a value at "inferred" is still shown to the user, it is just proposed rather than applied.`

export function switchDeterminationPrompt(
  documentText: string,
  documentName: string,
  candidates: SwitchCandidate[],
): string {
  const list = candidates
    .map((c) => {
      const vals =
        c.value_type === 'boolean' ? 'true | false'
        : c.value_type === 'number' ? 'a number, exactly as written in the document'
        : c.allowed_values.length ? c.allowed_values.join(' | ')
        : 'free text'
      return `  ${c.id}\n      question: ${c.question}\n      permitted values: ${vals}`
    })
    .join('\n')

  return `You are reading ONE document belonging to ONE company, to establish facts about that
company. Your only job is to report which of the listed facts THIS DOCUMENT states or implies,
and to quote the text that does it.

DOCUMENT NAME: ${documentName}

DOCUMENT TEXT:
${documentText}

CANDIDATE FACTS — report only on these, using these identifiers exactly:
${list}

═══ WHAT YOU MUST NEVER DO ═══

${FORBIDDEN.join('\n\n')}

${EVIDENCE_CLASS_RULE}

═══ WHAT TO RETURN ═══

JSON only. An array named "determinations", one object per fact this document supports:

  switch_id        from the list above, exactly
  value            one of the permitted values, as a string
  evidence_class   "stated" | "implied" | "inferred"
  quote            VERBATIM from the document text. Not paraphrased, not tidied, not joined
                   across a gap, not corrected for typos. Between 20 and 300 characters.
  locator          the section heading, page number or clause reference AS PRINTED
  reasoning        one sentence: how the quote gets you to the value.
                   REQUIRED for "implied" and "inferred". Omit for "stated".

AND an array named "absent", listing the identifiers of any candidate facts you specifically
looked for and could not find support for in this document. This is not a failure; it is a
useful answer, and it lets the product tell the user what it read and did not find.

*** AN EMPTY "determinations" ARRAY IS A VALID AND COMMON ANSWER. *** Most documents establish
one or two of these facts. Many establish none. A document that appears to establish nine has
almost certainly had something inferred into it.

Return nothing but the JSON object.`
}

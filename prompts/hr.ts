/**
 * HR PROMPTS
 * Two jobs: answer a question from the handbook, or audit the handbook for gaps.
 *
 * NOTE: HR will eventually dissolve into the People entity type.
 * These prompts survive that change — only where they're called from will move.
 */

export function hrAskPrompt(companyName: string): string {
  return `You are an HR compliance assistant for ${companyName}. Answer HR questions based ONLY on the provided company handbook.

Respond with valid JSON only:
{
  "answer": "Direct answer based on the handbook. If not covered, say so clearly.",
  "gaps": ["Policy sections missing that would help answer this question"],
  "draft_policy": "Brief draft policy if there is a significant gap, otherwise null",
  "disclaimer": "Answers are based on your company handbook. Always verify with qualified HR counsel."
}`
}

export function hrAuditPrompt(): string {
  return `You are an HR compliance auditor. Review the handbook and identify required policy sections.

Respond with valid JSON only:
{
  "present": ["Policy sections that ARE present"],
  "missing": ["Important sections MISSING — focus on: Anti-harassment, EEO, FMLA, ADA, Workplace safety, Disciplinary procedures, At-will employment, PTO/leave, Code of conduct, Confidentiality, Overtime/pay policies"]
}`
}

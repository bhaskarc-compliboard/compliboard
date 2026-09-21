/**
 * WHERE THE CRITIC'S FINDINGS GO NOW THAT NOBODY SEES THEM. `DECISIONS.md` §97, §98.
 *
 * §97 took all four boxes off every customer screen: they are a red-lined draft, and a customer
 * receives the corrected document, not the corrections. **That is only safe because the findings
 * are written down here instead.** `CRITIC-PASS.md` §2.3 — *a silent fix destroys the evidence,
 * and a self-healing loop means no failure is ever found* — is unchanged in its reasoning; what
 * changed is who reads it.
 *
 * *** THE DISPOSITION RULE LIVES IN `criticPass.ts`, NOT HERE. *** This module imports
 * `@/lib/auth` for the admin client, and a `@/` path alias cannot be resolved by Node's type
 * stripping — which is what runs the test suite (`DECISIONS.md` §67). So anything in this file is
 * UNTESTABLE BY CONSTRUCTION, and `dispositionOf` is the one piece here that had a defect worth a
 * test. It is a rule about reading a `CriticResult`, which is `criticPass`'s subject anyway.
 *
 * *** ONE FUNCTION, TWO CALLERS, ON PURPOSE. *** `/api/chat` checklist mode and `/api/audits`
 * both produce critiques. Two copies of this write would be two definitions of what a finding is
 * (§43), and the disposition rule below is exactly the kind of thing that drifts between copies.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────
 * *** IT WRITES WITH THE SERVICE ROLE, AND THAT IS A NAMED CARVE-OUT, NOT A HABIT. ***
 *
 * `CLAUDE.md` §3.6 permits the service-role key "for a named statement with a comment explaining
 * it". This is the comment. The same shape as the `standard_templates` insert in
 * `app/api/audits/route.ts`, where the reasoning sits beside the call.
 *
 * **Migration 029 leaves `authenticated` at ZERO on both tables, read and write.** Both calling
 * routes run under the caller's token (`requireCompany()` → `authed.db`, since 0.9), so writing
 * through the caller would fail with *permission denied* on the first real critique — §80's
 * class, the defect that only appears on the first INSERT from a route.
 *
 * **Why the grant is not simply widened instead:**
 *
 *   READ   A customer never sees the red-lined draft. There is nothing to grant.
 *   WRITE  These rows are the input to a RATE — `CRITIC-PASS.md` §7.1, blocking findings as a
 *          share of answers. **A tenant who can insert findings against their own company can
 *          bend the metric we use to decide whether the critic is inventing them.** Quality
 *          control written on the authority of the thing being controlled is not quality control.
 *
 * So the findings are system-generated and the system writes them.
 * ────────────────────────────────────────────────────────────────────────────────────────
 */
import { supabaseAdmin } from '@/lib/auth'
import { dispositionOf, type CriticResult } from '@/lib/criticPass'

export type CriticSource = 'chat_checklist' | 'audit'

export interface RecordCritiqueInput {
  companyId: string
  source: CriticSource
  /** What was asked. Stored so a row is readable without joining anything. */
  question: string
  /** What came back — the checklist's title, or the standard audited against. */
  answerTitle: string | null
  result: CriticResult
  /** Item names the CALLER actually removed. Empty when the caller removes nothing. */
  withheld: ReadonlySet<string>
}

/**
 * *** THE REVIEW ROW IS WRITTEN EVEN WHEN THERE ARE NO FINDINGS. ***
 *
 * It is the denominator. §7.1's number is blocking findings as a share of ANSWERS, and a clean
 * review that wrote nothing would drop out of it — computing the rate over reviews that found
 * something, which is every review in the table. And `complete: false` with zero findings is
 * indistinguishable from clean unless a row records it (`criticPass.ts:70`).
 *
 * *** IT NEVER FAILS THE REQUEST. *** A customer's answer must not be withheld because a
 * quality-control note could not be filed. But it is never silent either (`CLAUDE.md` §5): the
 * failure is logged with enough to find it. The trade is deliberate — losing a row costs one
 * sample from a rate; failing the request costs the answer.
 */
export async function recordCritique(input: RecordCritiqueInput): Promise<void> {
  const { companyId, source, question, answerTitle, result, withheld } = input
  try {
    const { data: review, error: reviewErr } = await supabaseAdmin
      .from('critic_reviews')
      .insert({
        company_id: companyId,
        source,
        question,
        answer_title: answerTitle,
        complete: result.complete,
      })
      .select('id')
      .single()
    if (reviewErr || !review) throw new Error(reviewErr?.message ?? 'no review row returned')

    if (result.findings.length === 0) return

    const { error: findingsErr } = await supabaseAdmin.from('critic_findings').insert(
      result.findings.map((f) => ({
        review_id: review.id,
        company_id: companyId,
        severity: f.severity,
        question_no: f.question,
        item: f.item,
        finding: f.finding,
        because: f.because,
        quote: f.quote,
        disposition: dispositionOf(f, withheld),
      })),
    )
    if (findingsErr) throw new Error(findingsErr.message)
  } catch (e) {
    // Loud, and on the server only. Next 16 writes this to .next/dev/logs/next-development.log
    // in development, NOT to the terminal running `npm run dev` — HOW-WE-BUILD.md §3b.
    console.error(
      '[criticRecord] could not record the critique:',
      e instanceof Error ? e.message : e,
      JSON.stringify({ companyId, source, findings: input.result.findings.length }),
    )
  }
}

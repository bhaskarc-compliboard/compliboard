// THE MAIN ANSWER PATH. Three modes — checklist, research, substeps — behind one route.
//
// AUTHENTICATED SINCE 11 SEPTEMBER, and the reason is not only security. This route had no
// session check at all (TODO §0.8b): no `requireCompany`, no token read, and nothing upstream
// gating it — no middleware, no vercel.json, an empty next.config.ts. An anonymous caller got
// a model call at maxTokens 6000 plus server-side parsing of every accepted file type.
//
// What forced the fix was Stage 1. The determination gate must read `company_switches` to
// avoid asking for a fact this company has already established, and company_switches is
// tenant data — so a route that does not know WHICH company is asking cannot avoid re-asking.
// The security item and the functional prerequisite turned out to be the same work.
// DECISIONS.md §4 and §34; docs/DETERMINATION-GATE.md §0.
//
// THIS CLOSES ONE OF §0.8b's FOUR UNDOCUMENTED ROUTES, NOT ALL FOUR. /api/extract-dates,
// /api/feedback and /api/scan-website are unchanged — the SSRF in scan-website and the
// unescaped HTML interpolation in feedback are still open.
//
// Callers must now send the session token: `headers: await authHeaders()` from lib/supabase.

import { askAI, askAIJson, type AIContent } from '@/lib/ai';
import { buildSystemPrompt } from '@/prompts/checklist';
import { NextRequest, NextResponse } from "next/server";
import { parseDocumentToBlocks } from '@/lib/documentContent';
import { requireCompany } from '@/lib/auth';
import { gate, type GateAnswering } from '@/lib/determinationGate';

export async function POST(request: NextRequest) {
  try {
    // company_id comes from the verified token, never from the body. The reference
    // implementation is app/api/documents/route.ts — CLAUDE.md §3.6.
    const authed = await requireCompany(request);
    if (!authed.ok) return authed.response;
    const { companyId, db } = authed.auth;

    const contentType = request.headers.get('content-type') || '';

    let question = '';
    let fileData: string | null = null;
    let fileBuffer: ArrayBuffer | null = null;
    let fileType: string | null = null;
    let fileName: string | null = null;
    let mode = 'checklist';
    let scanResult: Record<string, unknown> | null = null;
    // The user answering a previous ask. Carries the ask's context back so the gate does
    // not block a second time on the fact just supplied — DETERMINATION-GATE.md §5.2.
    let answering: GateAnswering | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      question = formData.get('question') as string || '';
      mode = formData.get('mode') as string || 'checklist';
      const answeringRaw = formData.get('answering') as string | null;
      if (answeringRaw) {
        try { answering = JSON.parse(answeringRaw) as GateAnswering; } catch { answering = null; }
      }
      const file = formData.get('file') as File | null;

      if (file) {
        fileType = file.type;
        fileName = file.name;
        fileBuffer = await file.arrayBuffer();
        fileData = Buffer.from(fileBuffer).toString('base64');
      }
    } else {
      const body = await request.json();
      question = body.question || '';
      mode = body.mode || 'checklist';
      scanResult = body.scanResult || null;
      answering = body.answering || null;
    }

    const userQuestion = question.trim() ||
      (fileData
        ? (mode === 'research'
            ? 'Summarize what this document is, what it covers, and flag anything that looks off, expired, or missing.'
            : 'Analyse this document and give me a compliance checklist. Identify any gaps, risks, or corrective actions needed.')
        : '');

    if (!userQuestion && !fileData) {
      return NextResponse.json({ error: 'No question or file provided' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(mode, scanResult);

    let messageContent: AIContent;
    let documentBlocks: AIContent = [];

    if (fileBuffer && fileName) {
      const parsed = await parseDocumentToBlocks(fileBuffer, fileName, fileType);
      if (!parsed.ok) {
        // A file we cannot read must say so. It must never become an answer built from
        // the filename alone, which is what this route did until 11 Sep.
        return NextResponse.json(
          { error: parsed.failure.message, document_failed: parsed.failure },
          { status: 400 }
        );
      }
      documentBlocks = parsed.blocks;
      messageContent = [
        ...parsed.blocks,
        { type: 'text', text: 'File name: ' + fileName + '\n\nUser question: ' + userQuestion },
      ] as AIContent;
    } else {
      messageContent = userQuestion;
    }

    // ------------------------------------------------------------------
    // STAGE 1 — the determination gate. Runs before anything is enumerated.
    //
    // `substeps` is deliberately NOT gated. It expands one item of a checklist that has
    // already passed the gate, so gating it again asks the same question twice for one
    // piece of work. Its own per-step question slots are removed for the same reason —
    // DECISIONS.md §34.
    // ------------------------------------------------------------------
    if (mode !== 'substeps') {
      const g = await gate({
        question: userQuestion,
        documentBlocks,
        companyId,
        outputType: mode === 'checklist' ? 'checklist' : 'answer',
        db,
        answering,
      });

      if (g.outcome === 'ask') {
        // 200, not 4xx. An ask is a successful outcome of a well-formed request; a 400
        // would put a reasonable question through every caller's error path and render it
        // as a failure. DETERMINATION-GATE.md §2.
        return NextResponse.json({ outcome: 'ask', ask: g.ask });
      }

      if (mode === 'research') {
        // RESEARCH_PROMPT returns PROSE, not JSON, so this one stays on askAI. The
        // structured-research change is listed as not-yet-specified in
        // DETERMINATION-GATE.md §10, and `conditional_on` reaches this path only when it
        // lands. `research` keeps its key so existing callers are unchanged.
        const responseText = await askAI(systemPrompt, messageContent, { maxTokens: 6000 });
        return NextResponse.json({ outcome: 'answer', research: responseText, gate: g.resolved });
      }

      // askAIJson replaces the hand-rolled `JSON.parse(responseText.replace(/```json/…))`
      // this route carried until 11 Sep. The shared extractor tolerates narration around
      // the object, which the local version did not — lib/ai.ts is the only place that
      // logic should live.
      const data = await askAIJson<unknown>(systemPrompt, messageContent, { maxTokens: 6000 });
      return NextResponse.json({ outcome: 'answer', data, gate: g.resolved });
    }

    const data = await askAIJson<unknown>(systemPrompt, messageContent, { maxTokens: 6000 });
    return NextResponse.json({ outcome: 'answer', data });
  } catch (error) {
    console.error("Full error:", error);
    return NextResponse.json(
      { error: "Something went wrong", details: String(error) },
      { status: 500 }
    );
  }
}

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
import { verifyTurns, sealTurn, BadConversation, type SealedTurn } from '@/lib/turnSigning';
import type { PriorTurn } from '@/lib/gateContext';
import { gate, type GateAnswering } from '@/lib/determinationGate';
import { criticise, applyCritique } from '@/lib/criticPass';
import { recordCritique } from '@/lib/criticRecord';
import { establishedFactsBlock } from '@/lib/gateContext';
import { agenciesInScopeFor } from '@/lib/agencyScope';
import type { ChecklistAnswer } from '@/lib/answerSchema';

/**
 * The facts THIS turn asserted, for the turn the server is about to seal.
 *
 * *** ONLY WHAT THE GATE ATTRIBUTED TO THE QUESTION. *** `stated_in_question` and `hypothetical`
 * are facts the user just supplied; the rest of `known` came from `company_switches` and is
 * already established — putting it in the turn would duplicate a stored fact into the
 * conversation, which is the two-systems shape §78 exists to avoid.
 *
 * `hypothetical` is carried BECAUSE it is not stored anywhere else: the conversation is its only
 * home (§78), and the frame on the turn is what keeps it distinguishable from a real fact.
 */
function factsFromGate(g: { outcome: string; resolved?: { known: Array<{ switch_id: string | null; fact: string; value: string; source: string }> }; ask?: { known: Array<{ switch_id: string | null; fact: string; value: string; source: string }> } }) {
  const known = g.outcome === 'proceed' ? (g.resolved?.known ?? []) : (g.ask?.known ?? []);
  return known
    .filter((k) => k.source === 'stated_in_question' || k.source === 'hypothetical')
    .map((k) => ({ switch_id: k.switch_id, fact: k.fact, value: k.value, source: k.source as never }));
}

/**
 * A conversation the server cannot carry on with. `GATE-HISTORY.md` §10.4.
 *
 * *** THE MESSAGE IS THE PRODUCT'S PROBLEM, NEVER THE USER'S. *** `CLAUDE.md` §5.1: it says so
 * plainly, asserts nothing about what was in the conversation (that is exactly what could not be
 * read), and tells them what to do next. `conversation_reset` is what lets the client CLEAR its
 * turns, so "start fresh" is true rather than a suggestion the next request contradicts.
 *
 * A missing topic and a bad signature read IDENTICALLY on purpose — a person cannot act on the
 * difference, and naming it would say whether an id exists.
 */
const CONVERSATION_LOST =
  "We lost track of this conversation and can't safely carry on with it. Nothing you've told us " +
  'has been lost. Ask your question again and we’ll start fresh.'

function conversationReset(message: string, status = 400) {
  return NextResponse.json({ error: message, conversation_reset: true }, { status });
}

/**
 * The topic's title, which cannot be deferred: `topics.title` is `not null` with
 * `check (length(btrim(title)) > 0)` (migration 028).
 *
 * `frame.subject` is defined as *what the question is about* — it IS a title, and the gate
 * already produced it for this turn. It is nullable, hence the ladder behind it.
 */
function topicTitle(subject: string | null, question: string, fileName: string | null): string {
  const raw = (subject ?? '').trim() || question.trim() || (fileName ?? '').trim() || 'New topic';
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

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
    // The conversation, as the client holds it. SIGNED — the server refuses a turn it did not
    // issue (DECISIONS.md §89) and refuses a SET with a gap in it (§90). Absent on turn 1.
    let sealedTurns: unknown = undefined;
    let topicId = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      question = formData.get('question') as string || '';
      mode = formData.get('mode') as string || 'checklist';
      topicId = (formData.get('topicId') as string) || '';
      const turnsRaw = formData.get('turns') as string | null;
      if (turnsRaw) { try { sealedTurns = JSON.parse(turnsRaw); } catch { sealedTurns = null; } }
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
      topicId = body.topicId || '';
      sealedTurns = body.turns;
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
    // Filled from the gate below, then folded into what the generating call sees.
    let establishedBlock = '';

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
      // *** A CALLER THAT SENDS `turns` IS IN A CONVERSATION. ONE THAT DOES NOT IS NOT. ***
      //
      // The field's PRESENCE is the opt-in, and it has exactly one source of truth — a separate
      // boolean could disagree with the turns sitting beside it. Two other call sites on
      // app/compliance/page.tsx post a one-shot question (the substep expander and the per-item
      // determination helper) and send no turns; without this they would each open a topic every
      // time somebody clicked. GATE-HISTORY.md §10.2.
      const inConversation = sealedTurns !== undefined && sealedTurns !== null;

      // Turns with no topic were sealed against an id this request does not carry, so they cannot
      // verify. Refusing by name beats letting the signature check fail with 'did not verify',
      // which would report forgery for what is really a lost id.
      if (!topicId && Array.isArray(sealedTurns) && sealedTurns.length > 0) {
        return conversationReset(CONVERSATION_LOST);
      }

      // *** `topicId` MUST NAME A REAL ROW, AND THE REASON IS NOT SECURITY. ***
      //
      // The MAC covers `company` (lib/turnSigning.ts), so another tenant cannot replay a turn
      // here whatever this check does. What it prevents is quieter: a client-chosen id seals and
      // verifies perfectly well against itself, so the conversation would run under an id with NO
      // ROW BEHIND IT — and the topic M1.8 writes a summary to would not be the topic the
      // conversation happened in. That is the two-systems shape §78 spent an entry avoiding.
      if (topicId) {
        const { data: topic } = await db
          .from('topics').select('id, status')
          .eq('id', topicId).eq('company_id', companyId).maybeSingle();
        // 404, not 403 — an id must not be probeable by watching which error comes back
        // (CLAUDE.md §3.6, the /api/documents pattern).
        if (!topic) return conversationReset(CONVERSATION_LOST, 404);
        // A CLOSED TOPIC REFUSES A NEW TURN. WORKSPACE.md §6.1 closes a topic precisely because
        // past conversations pollute future answers, so a closed topic that still takes turns is
        // a close that closed nothing. §8.3 is not in tension: a new QUESTION does not close a
        // topic, but a topic somebody closed stays closed.
        if (topic.status !== 'open') {
          return conversationReset("This topic is closed. Ask your question again and we’ll open a new one.");
        }
      }

      // *** A FAILED VERIFICATION REFUSES. IT DOES NOT DROP THE TURNS AND CARRY ON. ***
      // Dropping them is the silent direction: the user would get a correct-looking answer
      // computed from nothing — no prior facts, no frame, no hypothetical labelling — and nothing
      // on screen would say the conversation had been forgotten. A refusal is visible and
      // recoverable; the silent path loses the reason their answer changed. GATE-HISTORY.md §9.3,
      // and CLAUDE.md §5.1 — never assert anything about data we did not successfully read.
      let priorTurns: PriorTurn[];
      try {
        priorTurns = verifyTurns(sealedTurns, companyId, topicId);
      } catch (e) {
        if (e instanceof BadConversation) {
          // The topic id and the reason, never the turn contents.
          console.error('[/api/chat] conversation rejected:', e.reason, 'topic:', topicId);
          // *** `conversation_reset`, LIKE EVERY OTHER UNUSABLE-CONVERSATION PATH. *** Without it
          // the client keeps holding turns that can never verify and every later request fails
          // identically — the user reads "start fresh" and gets the same refusal. Caught by
          // probing it: the two verifyTurns refusals came back `reset=false` while the two topic
          // refusals came back `reset=true`, for the same class of failure.
          return conversationReset(CONVERSATION_LOST);
        }
        throw e;
      }

      const g = await gate({
        question: userQuestion,
        documentBlocks,
        companyId,
        outputType: mode === 'checklist' ? 'checklist' : 'answer',
        db,
        answering,
        priorTurns,
      });

      // *** ALWAYS APPEND, BEFORE BRANCHING ON THE KIND. *** GATE-HISTORY.md §8.4: every exchange
      // is a turn, including one that asserts nothing, because "turn 4" must mean the fourth
      // exchange. THE SERVER NUMBERS IT — `priorTurns.length + 1` counts what was verified rather
      // than trusting a number the client sent.
      // *** THE TOPIC IS CREATED AFTER THE GATE, AND THE TITLE IS WHY. ***
      // `frame.subject` only exists once the gate has read the question, and `topics.title` is
      // NOT NULL — so the insert cannot come first. It costs nothing to wait: turn one has no
      // prior turns, and nothing needs the id until the seal two lines below.
      //
      // IF THE GATE THREW, WE NEVER REACH HERE. An exploration that produced no turn is not an
      // exploration, and an empty topic row is worse than no row.
      let activeTopicId = topicId;
      if (inConversation && !activeTopicId) {
        // As the CALLER, so `topics_insert`'s `with check (company_id = auth_company_id())` is
        // what actually enforces tenancy — not this line. company_id comes from the verified
        // token, never from the body (CLAUDE.md §3.6).
        const { data: topic, error: topicErr } = await db
          .from('topics')
          .insert({ company_id: companyId, title: topicTitle(g.frame.subject, userQuestion, fileName) })
          .select('id').single();
        if (topicErr || !topic) {
          console.error('[/api/chat] could not open a topic:', topicErr?.message);
          return NextResponse.json(
            { error: 'We could not start this conversation. Please try that again.' }, { status: 500 });
        }
        activeTopicId = topic.id;
      }

      const newTurn: SealedTurn | null = activeTopicId
        ? sealTurn({ turn: priorTurns.length + 1, frame: g.frame, facts: factsFromGate(g) },
                   companyId, activeTopicId)
        : null;

      // ------------------------------------------------------------------
      // THE FACTS THE GATE ESTABLISHED NOW REACH THE GENERATING CALL.
      //
      // Until 12 Sep `g.resolved` went into the HTTP response and nowhere else — so the
      // gate would determine the worksite was Hillsboro, Oregon, and the model producing the
      // answer was never told. Asked about minimum wage "at our Hillsboro plant", it branched
      // on Hillsboro, OHIO, which is a real place and a reasonable reading of a question
      // nobody had told it was already settled. DECISIONS.md §41.
      //
      // Written by the same function the gate uses (lib/gateContext.ts), so a fact does not
      // change shape as it moves between stages.
      // ------------------------------------------------------------------
      if (g.outcome === 'proceed') {
        establishedBlock = establishedFactsBlock(g.resolved.known);
        if (establishedBlock) {
          messageContent = Array.isArray(messageContent)
            ? ([...messageContent, { type: 'text', text: establishedBlock }] as AIContent)
            : `${establishedBlock}\n\n${messageContent}`;
        }
      }

      if (g.outcome === 'ask') {
        // 200, not 4xx. An ask is a successful outcome of a well-formed request; a 400
        // would put a reasonable question through every caller's error path and render it
        // as a failure. DETERMINATION-GATE.md §2.
        return NextResponse.json({ outcome: 'ask', ask: g.ask, frame: g.frame, followUp: g.followUp, turn: newTurn, topicId: activeTopicId || null });
      }

      if (mode === 'research') {
        // RESEARCH_PROMPT returns PROSE, not JSON, so this one stays on askAI. The
        // structured-research change is listed as not-yet-specified in
        // DETERMINATION-GATE.md §10, and `conditional_on` reaches this path only when it
        // lands. `research` keeps its key so existing callers are unchanged.
        const responseText = await askAI(systemPrompt, messageContent, { maxTokens: 6000, task: 'prose' });
        return NextResponse.json({ outcome: 'answer', research: responseText, gate: g.resolved, frame: g.frame, followUp: g.followUp, turn: newTurn, topicId: activeTopicId || null });
      }

      // askAIJson replaces the hand-rolled `JSON.parse(responseText.replace(/```json/…))`
      // this route carried until 11 Sep. The shared extractor tolerates narration around
      // the object, which the local version did not — lib/ai.ts is the only place that
      // logic should live.
      const data = await askAIJson<ChecklistAnswer>(systemPrompt, messageContent, { maxTokens: 6000, task: 'judgement' });

      // ------------------------------------------------------------------
      // STAGE 5 — the critic pass. A FRESH call that sees only the output.
      //
      // `systemPrompt` is in scope on this very line and is NOT passed: CriticInput has no
      // field for it, because a critic reading the generating instructions reviews its own
      // reasoning and agrees with it. docs/CRITIC-PASS.md §1.3.
      //
      // It never regenerates. Findings are applied by severity in code — blocking withholds
      // the item and says why, which is not the same as a second attempt. DECISIONS.md §39.
      // ------------------------------------------------------------------
      const critique = await criticise({
        question: userQuestion,
        answer: data,
        questionSet: 'requirements',
        establishedFacts: g.resolved.known,
        declaredUnknowns: g.resolved.non_blocking_unknowns,
        agenciesInScope: await agenciesInScopeFor(companyId, db),
        factsReliedOn: fileName ? `Read from the uploaded file "${fileName}".` : null,
      });
      const applied = applyCritique(critique);

      const withheldNames = new Set(applied.withheld.map((w) => w.item).filter(Boolean) as string[]);

      // *** THE FINDINGS ARE WRITTEN DOWN, NOT SHOWN. DECISIONS.md §97. ***
      // A SERVICE-ROLE WRITE, and the reasoning is in lib/criticRecord.ts beside the call it
      // makes: migration 029 leaves `authenticated` at zero on both tables, because a tenant who
      // could insert findings against their own company could bend the rate we use to judge
      // whether the critic is inventing them. Awaited so a serverless invocation cannot be
      // frozen before the write lands; it never throws and never fails this request.
      await recordCritique({
        companyId, source: 'chat_checklist', question: userQuestion,
        answerTitle: data.title ?? null, result: critique, withheld: withheldNames,
      });
      const kept: ChecklistAnswer = {
        ...data,
        must_do: (data.must_do ?? []).filter((i) => !withheldNames.has(i.name)),
        good_to_have: (data.good_to_have ?? []).filter((i) => !withheldNames.has(i.name)),
      };

      // *** `critique` IS NOT IN THIS RESPONSE, AND UNRENDERED IS NOT PRIVATE. ***
      // Removing CritiqueNotice stopped it being DRAWN; it did not stop it being SENT. Every
      // withheld item, quote and reason crossed to the browser and was readable in devtools'
      // network tab. §97 says no internal output reaches a customer, and a payload they can read
      // is output that reached them. It now has no reader at all — the findings are in
      // critic_reviews / critic_findings.
      return NextResponse.json({ outcome: 'answer', data: kept, gate: g.resolved, frame: g.frame, followUp: g.followUp, turn: newTurn, topicId: activeTopicId || null });
    }

    const data = await askAIJson<unknown>(systemPrompt, messageContent, { maxTokens: 6000, task: 'prose' });
    return NextResponse.json({ outcome: 'answer', data });
  } catch (error) {
    console.error("Full error:", error);
    return NextResponse.json(
      { error: "Something went wrong", details: String(error) },
      { status: 500 }
    );
  }
}

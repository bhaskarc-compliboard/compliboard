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

import { askAI, askAIJson, askAIWithCitations, askAIOpenStream,
         type AIContent, type OpenMessage } from '@/lib/ai';
import { pipelineSwitch, logPipelineConfigOnce } from '@/lib/pipelineConfig';
import { appendSources } from '@/lib/historySources';
import { loadAttachedDocument, describeAttachments, loadTopicAttachments } from '@/lib/attachedDocument';
import type { Source } from '@/lib/ai';
import { nextPosition, saveUserTurn, saveAssistantTurn, markTurnStopped, loadTurns,
         setTitleIfFirst, titleFromQuestion, bumpCounter } from '@/lib/conversation';
import { extractJsonText } from '@/lib/ai';
import { buildSystemPrompt } from '@/prompts/checklist';
import { NextRequest, NextResponse } from "next/server";
import { parseDocumentToBlocks } from '@/lib/documentContent';
import { requireCompany, supabaseAdmin } from '@/lib/auth';

import { verifyTurns, sealTurn, BadConversation, type SealedTurn } from '@/lib/turnSigning';
import type { PriorTurn } from '@/lib/gateContext';
import { gate, type GateAnswering } from '@/lib/determinationGate';
import { criticise, applyCritique } from '@/lib/criticPass';
import { recordCritique } from '@/lib/criticRecord';
import { splitForAnswer, businessFactsBlock, scenarioBlock, jurisdictionLine,
         type SwitchScope } from '@/lib/gateContext';
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

/**
 * THE FUNCTION TIMEOUT, DECLARED RATHER THAN INHERITED.
 *
 * This route carried NO `maxDuration` until 22 September, while `substeps`, `audits`,
 * `document-review` and `hr-audits` all set 800. Next's own documentation
 * (`route-segment-config/maxDuration.md`) says only that *"deployment platforms can use
 * maxDuration from the Next.js build output to add specific execution limits"* — **it names no
 * default**, so the effective limit for this route was whatever the platform applied and was
 * not knowable from the repository.
 *
 * A benchmark cannot be run against an unknown ceiling, and 800 is what the four routes that
 * already thought about it chose. This is not a change that makes an answer fit — nothing about
 * the answer is trimmed by it; it replaces an unknown with a stated one.
 */
export const maxDuration = 800

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
    // THE OPEN BASELINE'S CONVERSATION MEMORY — plain text pairs, not signed turns.
    // R1.0: prior messages go to the model as history. `DECISIONS.md` §123.
    let history: Array<{ question?: string; answer?: string; sources?: Source[] }> = [];
    let documentId = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      question = formData.get('question') as string || '';
      mode = formData.get('mode') as string || 'checklist';
      topicId = (formData.get('topicId') as string) || '';
      const turnsRaw = formData.get('turns') as string | null;
      if (turnsRaw) { try { sealedTurns = JSON.parse(turnsRaw); } catch { sealedTurns = null; } }
      const historyRaw = formData.get('history') as string | null;
      if (historyRaw) { try { history = JSON.parse(historyRaw); } catch { history = []; } }
      const answeringRaw = formData.get('answering') as string | null;
      if (answeringRaw) {
        try { answering = JSON.parse(answeringRaw) as GateAnswering; } catch { answering = null; }
      }
      documentId = (formData.get('documentId') as string) || '';
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
      history = Array.isArray(body.history) ? body.history : [];
      // THE ATTACHMENT. The page uploads the file first (so it lands in Documents whatever
      // happens next) and sends its id with the question — not the bytes, which it no longer
      // holds after a reload. §129.
      documentId = typeof body.documentId === 'string' ? body.documentId : '';
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

    // ------------------------------------------------------------------
    // THE ATTACHED DOCUMENT — Fix Round 2 (1), `DECISIONS.md` §129.
    //
    // Loaded by ID from storage rather than re-posted as bytes, because the page does not hold
    // the File after a reload and "reopen a conversation and carry on" has to keep working.
    // `lib/attachedDocument.ts` has the reasoning and says what the model receives.
    // ------------------------------------------------------------------
    let attached: Awaited<ReturnType<typeof loadAttachedDocument>> = null;
    if (documentId) {
      attached = await loadAttachedDocument(db, companyId, documentId);
      if (attached) {
        console.log(`chat: carrying attached document ${attached.name} as ${attached.kind} blocks`);
      }
    }

    // What earlier attachments in this topic should say to this turn — the name and what the
    // review made of it. Empty string when there are none.
    const priorAttachments = topicId ? await describeAttachments(db, topicId) : '';

    // ...AND THE DOCUMENTS THEMSELVES, on every turn of the conversation, not only the one they
    // were attached to. Measured: with only the review summary, a later turn RETRACTED a correct
    // finding because the summary did not contain it. `lib/attachedDocument.ts` has the exchange.
    let carried: Awaited<ReturnType<typeof loadTopicAttachments>> = { documents: [], omitted: 0 };
    if (topicId && mode === 'research') {
      carried = await loadTopicAttachments(db, companyId, topicId, attached?.id);
      if (carried.documents.length) {
        console.log(`chat: carrying ${carried.documents.length} earlier attachment(s) from topic ${topicId}` +
          (carried.omitted ? ` (${carried.omitted} omitted by the cap)` : ''));
      }
    }
    const carriedBlocks = carried.documents.flatMap((d) => d.blocks);
    const omittedNote = carried.omitted
      ? `\n\n${carried.omitted} earlier attachment(s) are not included in this message because `
        + `only the ${3} most recent are carried. Say so if the question depends on them.`
      : '';

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
    } else if (attached || carriedBlocks.length) {
      // The same shape the multipart branch builds, from documents already in storage: the file
      // just attached (if any) first, then the ones attached earlier in this conversation.
      const blocks = [...(attached?.blocks ?? []), ...carriedBlocks];
      documentBlocks = blocks as AIContent;
      messageContent = [
        ...blocks,
        { type: 'text', text:
          (attached ? `The user has just attached this file: ${attached.name}\n\n` : '') +
          (priorAttachments ? `${priorAttachments}${omittedNote}\n\n` : '') +
          `User question: ${userQuestion}` },
      ] as AIContent;
    } else if (priorAttachments) {
      // The documents could not be loaded but the conversation had them. The model must not
      // answer as though nothing was ever attached — that is the defect, one turn later.
      messageContent = `${priorAttachments}\n\nUser question: ${userQuestion}`;
    } else {
      messageContent = userQuestion;
    }
    // A named attachment that could not be re-read is said out loud rather than dropped: §5.1
    // forbids asserting anything about a document nobody read, and silence here would let the
    // model answer as though the file did not exist.
    if (documentId && !attached) {
      messageContent = typeof messageContent === 'string'
        ? `The user attached a file to this conversation, but it could not be read back just ` +
          `now. Say so rather than answering as though nothing was attached.\n\n${messageContent}`
        : messageContent;
    }

    // ==================================================================
    // THE OPEN BASELINE — `DECISIONS.md` §113 and §123, `TODO.md` R1.0.
    //
    //   > "this section needs no barrier between Claude and an answer."
    //
    // One sentence of role, the conversation as history, search available with the MODEL
    // deciding, and a stream. Everything else is a switch and production runs them off.
    //
    // *** THIS BRANCHES BEFORE THE GATE BLOCK, AND THAT PLACEMENT IS THE POINT. *** `off`
    // means the code path is NOT ENTERED — not entered and its output discarded. A gate that
    // runs and is ignored still costs the latency, still spends the tokens, and still logs as
    // though it decided something. `lib/pipelineConfig.ts` says so; this is where it is obeyed.
    // ==================================================================
    logPipelineConfigOnce();
    const gateOn = mode === 'research' ? pipelineSwitch('RESEARCH_GATE')
                 : mode === 'checklist' ? pipelineSwitch('CHECKLIST_GATE')
                 : false; // substeps was never gated — see the note below.

    if (mode !== 'substeps' && !gateOn) {
      // *** SIGNED TURNS ARE IGNORED ON THIS PATH, DELIBERATELY. ***
      // Turn signing (§89-§91) exists to stop a client editing the conversation the GATE reads,
      // because the gate treats a prior turn's facts as established. With the gate off nothing
      // is established from history — it is passed to the model as text and the model weighs it
      // like any other context. So the signature protects nothing here, and requiring it would
      // refuse a conversation for failing a check that has no subject. A client may still send
      // `turns`; they are not read. When RESEARCH_GATE is ON, the path below is unchanged.
      // ------------------------------------------------------------------
      // HISTORY COMES FROM THE DATABASE WHEN THE CLIENT HAS NONE.
      //
      // The client sends the exchanges it is holding, which works while the page is open. It
      // has none after a reload — and "reopen a conversation and carry on" is the whole point
      // of persisting turns. Measured before this existed: a follow-up on a reopened topic
      // answered *"I don't have the earlier part of our conversation"*.
      //
      // The client's own history WINS when it has some, because it is the conversation the
      // person is looking at; the stored turns are the fallback, not an override. A stopped
      // turn is skipped — it has no answer, and a user message with no assistant reply after
      // it would leave the array ending on two user messages, which the API refuses.
      // ------------------------------------------------------------------
      //
      // *** AND EVERY EARLIER ANSWER CARRIES ITS SOURCES. ***
      //
      // On 23 September a third turn said: *"My previous two answers carried numbered citation
      // markers, but I didn't actually retrieve and verify those sources in this conversation."*
      // **That was false** — both answers came from real searches — and the nightly summariser
      // then wrote the false claim into the summary, where it outlives the transcript.
      //
      // The cause: history was passed back as plain text still carrying `[1]`, `[2]` markers and
      // **no list of what they pointed at**. A model reading its own earlier turn saw numbered
      // references to sources that were nowhere in its context, and said so — correctly, about
      // the context it had. The fix is to give the markers something to refer to.
      if (!history.length && topicId) {
        try {
          const stored = await loadTurns(db, topicId);
          const pairs: Array<{ question?: string; answer?: string; sources?: Source[] }> = [];
          for (let i = 0; i < stored.length; i++) {
            const t = stored[i];
            if (t.role !== 'user' || t.stopped) continue;
            const next = stored[i + 1];
            if (next && next.role === 'assistant') {
              pairs.push({ question: t.text, answer: next.text, sources: next.sources ?? [] });
            }
          }
          history = pairs;
        } catch (e) {
          // A conversation that cannot be reloaded still answers the question in front of it.
          console.error('could not load stored turns for history:', e);
        }
      }

      const messages: OpenMessage[] = [];
      for (const h of history) {
        const q = String(h?.question ?? '').trim();
        const withSources = appendSources(String(h?.answer ?? '').trim(), h?.sources);
        const a = withSources;
        // Both halves or neither: a user turn with no assistant reply would make the array
        // end on two user messages, which the API refuses.
        if (!q || !a) continue;
        messages.push({ role: 'user', content: q });
        messages.push({ role: 'assistant', content: a });
      }
      messages.push({ role: 'user', content: messageContent });

      const longPrompt = mode === 'research'
        ? pipelineSwitch('RESEARCH_LONG_PROMPT') : pipelineSwitch('CHECKLIST_LONG_PROMPT');
      const system = longPrompt ? systemPrompt : buildSystemPrompt(mode, scanResult, { open: true });

      // ---- CHECKLIST: the same open call, and a SHAPE rather than a fence ----------------
      // A shape is a container, not a barrier: the UI has to tick, count and store items, so
      // the output has to be parseable. It streams anyway — which removes the SDK's
      // non-streaming token ceiling for this path (`TODO.md` 0.11) — and is parsed at the end.
      if (mode === 'checklist') {
        let raw = '';
        for await (const ev of askAIOpenStream(system, messages,
                     // 16000, not 8000. Run 1 measured `stop_reason = max_tokens` on BOTH Opus 5 route runs of
          // the Seattle question — 9,767 output tokens against an 8,000 cap, so the answer was cut
          // off mid-sentence. Thinking tokens count toward this, which is why the old cap was
          // reached sooner than the visible length suggested. Streaming removed the SDK's
          // non-streaming ceiling (TODO 0.11), so there is nothing else in the way.
          { task: 'judgement', maxTokens: 16000, signal: request.signal,
            ledger: { companyId, task: 'checklist' } })) {
          if (ev.type === 'text') raw += ev.text;
          else if (ev.type === 'reset') raw = '';
          else if (ev.type === 'done') raw = ev.answer.text;
          else if (ev.type === 'error') {
            return NextResponse.json({ error: ev.message }, { status: 502 });
          }
        }
        let data: ChecklistAnswer;
        try {
          data = JSON.parse(extractJsonText(raw)) as ChecklistAnswer;
        } catch (e) {
          // §5: never silent, and fold the raw response in so a bad extraction is
          // diagnosable from the log days later.
          console.error('checklist shape did not parse:', String(e), raw.slice(0, 3000));
          return NextResponse.json(
            { error: 'The checklist came back in a shape we could not read. Please try again.' },
            { status: 502 });
        }
        try { await bumpCounter(supabaseAdmin, companyId, 'checklists_created'); }
        catch (e) { console.error('checklist counter not incremented:', e); }
        return NextResponse.json({ outcome: 'answer', ...data, topicId: topicId || null });
      }

      // ---- RESEARCH: stream to the client, and write the exchange down ------------------
      //
      // THE QUESTION IS SAVED BEFORE THE ANSWER IS KNOWN, and that ordering is the point: a
      // conversation the user stopped, or that failed, must still show what was asked. Saving
      // both at the end would lose exactly the exchanges worth looking at afterwards.
      //
      // THE TOPIC IS OPENED HERE, on the open path, because the gate block that used to own
      // topic creation is not entered any more. A client that sends `topicId` is continuing a
      // conversation; one that does not is starting one. A failure to open a topic must NOT
      // fail the answer — the person asked a question, and losing the transcript is a smaller
      // harm than losing the reply — so it degrades to an unsaved exchange and says so in the
      // log.
      let convoTopicId: string | null = topicId || null;
      let userTurnId: string | null = null;
      let answerPosition = 0;
      try {
        if (!convoTopicId) {
          const { data: created, error: topicErr } = await db
            .from('topics')
            .insert({ company_id: companyId, title: titleFromQuestion(userQuestion) })
            .select('id').single();
          if (topicErr) throw new Error(topicErr.message);
          convoTopicId = created.id as string;
        }
        const pos = await nextPosition(db, convoTopicId);
        userTurnId = await saveUserTurn(db, { topicId: convoTopicId, companyId, text: userQuestion, position: pos,
          // THE LINK, PERSISTED (§129). `document_name` is a copy so the transcript still reads
          // correctly after the document is deleted — migration 039.
          documentId: attached?.id ?? null, documentName: attached?.name ?? null });
        // The attach usually happens BEFORE the first question, so the document row was written
        // with no topic. Backfill it now that the topic exists, so Documents can show what
        // conversation a file came from. Failure here must not fail the answer.
        if (attached) {
          await db.from('documents').update({ from_topic_id: convoTopicId })
            .eq('id', attached.id).is('from_topic_id', null)
        }
        answerPosition = pos + 1;
        await setTitleIfFirst(db, convoTopicId, userQuestion);
      } catch (e) {
        console.error('conversation not persisted (the answer still runs):', e);
        convoTopicId = null;
      }

      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'));
          let completed = false;
          try {
            for await (const ev of askAIOpenStream(system, messages,
                         { task: 'prose', maxTokens: 16000, signal: request.signal,
                           ledger: { companyId, task: 'research' } })) {
              if (ev.type === 'done') {
                completed = true;
                send({ type: 'done', research: ev.answer.text, sources: ev.answer.sources,
                       topicId: convoTopicId,
                       stopReason: ev.stopReason, outputTokens: ev.outputTokens });
                if (convoTopicId) {
                  await saveAssistantTurn(db, { topicId: convoTopicId, companyId,
                    text: ev.answer.text, sources: ev.answer.sources, position: answerPosition });
                }
                // THE COUNTER MOVES HERE AND NOWHERE ELSE — on a completed stream. A stopped
                // answer is not a question answered.
                try { await bumpCounter(supabaseAdmin, companyId, 'questions_answered'); }
                catch (e) { console.error('counter not incremented:', e); }
              } else {
                send(ev);
              }
            }
          } catch (err) {
            // An abort is not an error the user needs to read — they caused it. Anything
            // else gets a sentence they can act on (§5.1).
            const aborted = request.signal.aborted ||
              (err as { name?: string })?.name === 'AbortError';
            if (!aborted) {
              console.error('open research stream failed:', err);
              send({ type: 'error', message: 'The answer stopped part-way through. Please try again.' });
            }
          } finally {
            // A STOPPED ANSWER: the question stays and is marked, no assistant row is written,
            // and the counter does not move. The transcript then shows a question that was
            // asked and abandoned, which is what happened.
            if (!completed && userTurnId) {
              try { await markTurnStopped(supabaseAdmin, userTurnId); }
              catch (e) { console.error('could not mark the turn stopped:', e); }
            }
            controller.close();
          }
        },
      });
      return new Response(body, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          // Without this a proxy can buffer the whole response and deliver it at once,
          // which looks exactly like not streaming.
          'X-Accel-Buffering': 'no',
        },
      });
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
      //
      // *** AND SINCE 21 SEP IT IS THREE BLOCKS, NOT ONE. DECISIONS.md §103, §104. ***
      //
      // One block put everything under "WHAT IS ALREADY ESTABLISHED ABOUT THIS COMPANY" and told
      // the model to treat it as settled — including, measured on staging, a hypothetical Arizona
      // facility's confined spaces. §78 made that impossible for `company_switches`; nothing made
      // it impossible for the prompt, which is where the answer comes from.
      //
      //   businessFactsBlock   what is true of the business
      //   scenarioBlock        a facility that does not exist, with the frame's jurisdiction
      //   jurisdictionLine     what the ANSWER is written for — from the frame, not the profile
      //
      // THE SPLIT IS THE RENDERER'S, NOT THE MODEL'S. Routing is by the FRAME rather than by the
      // `source` label, because the label is not stable: in one conversation `entity_state =
      // Arizona` came back `stated_in_question` on turn 1 and `hypothetical` on turn 2 (§104).
      if (g.outcome === 'proceed') {
        // scope decides whether a scenario fact REPLACES the business's value or ADDS to it.
        const { data: scopeRows } = await db.from('switches').select('id, scope');
        const scopeOf = Object.fromEntries(
          (scopeRows ?? []).map((r) => [r.id, r.scope as SwitchScope])) as Record<string, SwitchScope>;

        const ctx = splitForAnswer(g.resolved.known, priorTurns, g.frame, scopeOf);
        const businessState =
          ctx.business.find((b) => b.fact === 'worksite state')?.value ?? null;

        establishedBlock = [
          businessFactsBlock(ctx.business),
          scenarioBlock(ctx.scenario, ctx.frame, ctx.business),
          jurisdictionLine(ctx.frame, businessState),
        ].filter(Boolean).join('\n\n');

        // THE FACTS BLOCK IS A SWITCH — `RESEARCH_FACTS_BLOCK`, one of §113's six.
        // Telling the model what is already established is another way of narrowing what it may
        // say. The block is BUILT above only when the gate ran, and FOLDED IN only when this is
        // on. Off means the model never sees it.
        //
        // ONE SWITCH COVERS BOTH MODES, and that is deliberate rather than an omission: the
        // block is assembled here, once, from the same `splitForAnswer` output whichever mode
        // is running. A second name would imply the two could be set independently when they
        // cannot — there is one block and one place it is added.
        if (establishedBlock && pipelineSwitch('RESEARCH_FACTS_BLOCK')) {
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
        // *** SEARCH IS ON UNLESS THE GATE TURNED IT OFF. *** §101's acceptance condition is a
        // READER, and this is it: the flag was claimed shipped for six days with nothing reading
        // it. The default runs this way because the gate cannot know a permit was reissued last
        // quarter — not knowing is the condition being detected (`RESEARCH-ANSWER.md` §7a).
        // askAIWithCitations, not askAI — THE SOURCES ARE PART OF THE ANSWER (§106). The prose
        // arrives split across many text blocks, one per cited span; `reassemble` joins them
        // into continuous text, numbers the citations and returns the list behind the markers.
        const answer = await askAIWithCitations(systemPrompt, messageContent,
          { maxTokens: 6000, task: 'prose', enableWebSearch: g.needsWebSearch,
            ledger: { companyId, task: 'research' } });
        return NextResponse.json({ outcome: 'answer', research: answer.text, sources: answer.sources, gate: g.resolved, frame: g.frame, followUp: g.followUp, turn: newTurn, topicId: activeTopicId || null });
      }

      // askAIJson replaces the hand-rolled `JSON.parse(responseText.replace(/```json/…))`
      // this route carried until 11 Sep. The shared extractor tolerates narration around
      // the object, which the local version did not — lib/ai.ts is the only place that
      // logic should live.
      const data = await askAIJson<ChecklistAnswer>(systemPrompt, messageContent,
        { maxTokens: 6000, task: 'judgement', ledger: { companyId, task: 'checklist' } });

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
      // THE CRITIC IS A SWITCH — `CHECKLIST_CRITIC`, off in production (§113, §123).
      // Off means this call is NOT MADE: it is the most expensive call in the product
      // (84 s average, 37-151 s), and running it to discard the result would pay all of that
      // for nothing. Its storage and §97's "written down, not shown" are untouched — when the
      // switch is on, everything below behaves exactly as it did.
      if (!pipelineSwitch('CHECKLIST_CRITIC')) {
        return NextResponse.json({ outcome: 'answer', ...data, gate: g.resolved, frame: g.frame,
                                   followUp: g.followUp, turn: newTurn, topicId: activeTopicId || null });
      }

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

    // SUBSTEPS: elaboration of an item already on screen, on its own tier (§128 J.3).
    const data = await askAIJson<unknown>(systemPrompt, messageContent,
      { maxTokens: 6000, task: 'substeps', ledger: { companyId, task: 'substeps' } });
    return NextResponse.json({ outcome: 'answer', data });
  } catch (error) {
    console.error("Full error:", error);
    return NextResponse.json(
      { error: "Something went wrong", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * READING THE ANSWER STREAM — Fix Round 1 (A), `DECISIONS.md` §127.
 *
 * *** THE DEFECT THIS EXISTS TO STOP. ***
 *
 * On 22 September a hazmat question returned four lines, ended mid-sentence at "Pin that", and
 * stopped **with no message**. The owner had to open a new conversation to carry on.
 *
 * The evidence, and it agrees:
 *
 *   turns row 4e981a5f  position 1 · role=user · stopped=TRUE · NO assistant row
 *   dev log 05:39       no ERROR, no exception — nothing threw
 *
 * **The server knew the answer had not completed** — it marked the user's turn stopped and wrote
 * no answer row. **The client did not.** `app/compliance/page.tsx:241` read:
 *
 *     x.phase !== 'done' && x.phase !== 'failed' ? { ...x, phase: 'done' } : x
 *
 * so a reader that finished WITHOUT a `done` event fell out of the loop, threw nothing, and the
 * partial text was marked complete — displayed with its action buttons and no warning.
 *
 * > ### A STREAM THAT ENDS IS NOT A STREAM THAT FINISHED.
 * > The only thing that means "finished" is the `done` event. Everything else — a dropped
 * > connection, a killed upstream, a proxy timeout — ends the reader just as quietly.
 *
 * This module is the loop, extracted so it can be tested against a stream that stops early
 * without needing a browser or a real network failure.
 */

export interface StreamSource { n: number; title: string; url: string }

/** What the caller should show. `stopped_early` is the case the old code could not see. */
export type StreamOutcome =
  | { kind: 'done'; text: string; sources: StreamSource[]; topicId: string | null }
  | { kind: 'stopped_early'; text: string }
  | { kind: 'stopped_by_user'; text: string }
  | { kind: 'failed'; text: string; message: string }

export interface StreamProgress {
  text: string
  searches: number
  phase: 'sending' | 'searching' | 'writing'
}

/**
 * Consume NDJSON lines and report progress, then an outcome.
 *
 * `lines` is an async iterable of decoded lines so a test can hand it an array. The caller does
 * the network read; this does the interpretation, which is the part that was wrong.
 */
export async function readAnswerStream(
  lines: AsyncIterable<string>,
  onProgress: (p: StreamProgress) => void,
  wasAbortedByUser: () => boolean = () => false,
): Promise<StreamOutcome> {
  let text = ''
  let searches = 0
  let phase: StreamProgress['phase'] = 'sending'
  let sources: StreamSource[] = []
  let topicId: string | null = null
  // THE FLAG THE OLD CODE DID NOT HAVE.
  let sawDone = false
  let failure: string | null = null

  try {
    for await (const line of lines) {
      if (!line.trim()) continue
      let ev: { type?: string; [k: string]: unknown }
      // A half-written line is not an error — the caller buffers, and anything unparseable here
      // is skipped rather than ending the answer.
      try { ev = JSON.parse(line) } catch { continue }

      if (ev.type === 'searching') {
        searches++
        phase = 'searching'
        onProgress({ text, searches, phase })
      } else if (ev.type === 'text') {
        text += String(ev.text ?? '')
        phase = 'writing'
        onProgress({ text, searches, phase })
      } else if (ev.type === 'reset') {
        // The narration rule reaching the screen — `lib/ai.ts` stripNarration. What was shown
        // was the model saying what it was about to look up, and a search has now started.
        text = ''
        phase = 'searching'
        onProgress({ text, searches, phase })
      } else if (ev.type === 'done') {
        sawDone = true
        text = String(ev.research ?? text)
        sources = (ev.sources as StreamSource[]) ?? []
        topicId = ev.topicId ? String(ev.topicId) : null
      } else if (ev.type === 'error') {
        failure = String(ev.message ?? 'The answer stopped part-way through.')
      }
    }
  } catch (err) {
    if (wasAbortedByUser() || (err as { name?: string })?.name === 'AbortError') {
      return { kind: 'stopped_by_user', text }
    }
    return { kind: 'failed', text, message: 'The answer could not be completed.' }
  }

  if (failure) return { kind: 'failed', text, message: failure }
  if (sawDone) return { kind: 'done', text, sources, topicId }
  // THE READER ENDED AND NOTHING SAID THE ANSWER WAS FINISHED.
  if (wasAbortedByUser()) return { kind: 'stopped_by_user', text }
  return { kind: 'stopped_early', text }
}

/** Turns a byte reader into the line iterable above, buffering partial lines. */
export async function* ndjsonLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    // A chunk can split a line in half; the remainder waits for the next read.
    buffer = parts.pop() ?? ''
    for (const p of parts) yield p
  }
  if (buffer.trim()) yield buffer
}

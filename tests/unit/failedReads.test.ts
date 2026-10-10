/**
 * E4 AND E5 — THE REST OF ROOT R2, SECTION BY SECTION, AND §4'S ITEMS.
 *
 * `docs/FIX-LIST-FAILURES.md` C1, A3, A4, A6, A8, A11, A12, A13, A15, D6, D7, D8, D9, D10, D11,
 * D12, D13, D14, D-two, H2, H3, H5, H6, H7, H8, W6, W7, W8, W9, M5, B4, S4, 35c, O2, O3, O5, O6,
 * O7, O8, O9, and B10's follow-on.
 *
 * *** WHY THESE ARE READ OFF THE FILES. *** Forty-odd reads in thirty files, each inside a route or
 * a sweep that cannot be handed a failing database in a unit test. What CAN be asserted exactly is
 * the thing that was wrong: `const { data } = …` with no `error`, and the sentence each absence was
 * printed as. So each group names the file, strips its comments (they quote the old code), and
 * asserts BOTH halves — the unchecked shape is gone, and the checked one is there. Every one of them
 * fails on the shipped tree.
 *
 * The behaviour of the helpers these call through is proved properly in `mustRead.test.ts`,
 * `obligationWriterReads.test.ts`, `folderDelete.test.ts`, `auditSummary.test.ts`,
 * `auditMatcher.test.ts`, `answerShape.test.ts` and `answerFinish.test.ts`, each against a fake
 * database. This file is the sweep.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileIsMissing, FILE_GONE, STORAGE_UNREACHABLE } from '../../lib/storageMiss.ts'
// Imported dynamically: `formatMoment` is new in Job E4, so on the shipped `lib/calendarDate.ts`
// a top-level import of it makes this whole file fail to load — true, and silent about which of the
// forty-odd items changed. This way the old-code run names each failing group.
import { CALENDAR_TZ } from '../../lib/calendarDate.ts'
let formatMoment: (iso: string | null | undefined, tz?: string) => string = () => ''
test('load lib/calendarDate.ts', async () => {
  const m = await import('../../lib/calendarDate.ts') as {
    formatMoment?: (iso: string | null | undefined, tz?: string) => string }
  formatMoment = m.formatMoment ?? (() => { throw new Error('formatMoment is not exported') })
})

/** A file with its comments stripped: every one of these quotes the code it replaced. */
const code = (p: string) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

/** `const { data: x } = …` with no `error` beside it — the shape root R2 IS. */
function uncheckedReads(src: string): string[] {
  return [...src.matchAll(/const \{ data(?:: \w+)? \} = (?:await )?(?:db|admin|supabaseAdmin|supabase)\b[^\n]*/g)]
    .map((m) => m[0].trim())
}

describe('*** C1: lib/companyContext.ts — the most shared item on the list ***', () => {
  const src = code('lib/companyContext.ts')

  test('not one unchecked read is left', () => {
    assert.deepEqual(uncheckedReads(src), [],
      'every absence here renders as a statement — "State: not recorded", "(nothing declared yet)" '
      + '— and the block goes into five prompts and onto a screen')
  })

  test('all nine go through mustRow/mustRows, each named for the PERSON', () => {
    for (const what of ['your company', 'your sites', 'the facts you have told us',
                        'the facts you have confirmed', 'your agencies and subjects',
                        'the facts already named', 'your corrections to this document',
                        'the findings you have dismissed']) {
      assert.ok(src.includes(`'${what}'`) || src.includes(`"${what}"`), what)
    }
    assert.equal((src.match(/mustRows?[<(]/g) ?? []).length >= 9, true)
  })
})

describe('Audits: A3, A4, A6, A8, A11', () => {
  test('lib/audit.ts — the document list and all five evidence reads', () => {
    const src = code('lib/audit.ts')
    assert.deepEqual(uncheckedReads(src), [])
    assert.match(src, /mustRows<\{ label: string \}>\('your agencies'/)          // A11
    assert.match(src, /mustRows<Record<string, unknown>>\('your documents'/)     // A3
    for (const what of ["your documents' findings", "your documents' conditions",
                        "your documents' dates", 'the facts waiting to be confirmed',
                        'what the readings expected to see']) {
      assert.ok(src.includes(what), what)                                        // A4, all five
    }
  })

  test('lib/auditRun.ts — the run row (A6) and the end-of-run summary (A8)', () => {
    const src = code('lib/auditRun.ts')
    assert.deepEqual(uncheckedReads(src), [])
    assert.match(src, /if \(runRead\.error\) return await fail\(/)               // A6
    assert.match(src, /mustRows<Record<string, unknown>>\("this audit's findings", findingsRes\)/)  // A8
    assert.match(src, /mustRows<\{ title: string; status: string \}>\("this audit's parts", sectionsRes\)/)
  })

  test('A6 fails the section rather than auditing a checklist line as an agency', () => {
    const src = code('lib/auditRun.ts')
    const guard = src.indexOf('if (runRead.error) return await fail(')
    const build = src.indexOf('await buildAuditInput(db, sec.company_id')
    assert.ok(guard > 0 && guard < build, 'before the input is built, and before any money is spent')
  })

  test('A12, A13, A15 — the drawer, the zip, and the two smaller routes', () => {
    for (const p of ['app/api/audit-runs/[id]/route.ts',
                     'app/api/audit-runs/[id]/documents/route.ts',
                     'app/api/audit-findings/route.ts',
                     'app/api/audit-checklist/route.ts']) {
      assert.deepEqual(uncheckedReads(code(p)), [], p)
      assert.match(code(p), /mustRow/, p)
    }
  })

  test('O3 — the done write is checked, and a retry clears the attempt it replaces', () => {
    const run = code('lib/auditRun.ts')
    assert.match(run, /if \(doneErr\) \{/)
    assert.match(run, /The audit finished but its own row would not save/)
    const retry = code('app/api/audit-runs/[id]/sections/[sid]/retry/route.ts')
    assert.match(retry, /from\('audit_findings'\)\s*\n?\s*\.delete\(\)\.eq\('section_id', sid\)\.eq\('run_id', id\)/)
  })
})

describe('*** D6: "upload it again" was told for every storage failure ***', () => {
  test('a missing object is recognised by status, statusCode and message', () => {
    assert.equal(fileIsMissing({ status: 404 }), true)
    assert.equal(fileIsMissing({ statusCode: '404' }), true)
    assert.equal(fileIsMissing({ message: 'Object not found' }), true)
    assert.equal(fileIsMissing({ message: 'NoSuchKey: the specified key does not exist' }), true)
  })

  test('*** and ANYTHING ELSE is unreachable — the cautious direction ***', () => {
    for (const e of [{ status: 500 }, { status: 503, message: 'service unavailable' },
                     { message: 'fetch failed' }, { message: 'timeout' }, {}, null, undefined]) {
      assert.equal(fileIsMissing(e), false, JSON.stringify(e))
    }
  })

  test('the two answers say different things, and only one mentions uploading', () => {
    assert.match(FILE_GONE.wayForward, /Upload it again/)
    assert.ok(!/[Uu]pload it again/.test(STORAGE_UNREACHABLE.wayForward),
      'it must not TELL them to upload; saying "nothing needs uploading again" is the point')
    assert.match(STORAGE_UNREACHABLE.wayForward, /nothing needs uploading again/)
    assert.match(STORAGE_UNREACHABLE.reason, /could not reach the place your files are stored/)
  })

  test('both call sites write NO reading when storage was unreachable', () => {
    for (const p of ['app/api/document-scan/route.ts', 'app/api/jobs/scan-documents/route.ts']) {
      const src = code(p)
      assert.match(src, /if \(!fileIsMissing\(dlError\)\) \{/, p)
      const branch = src.slice(src.indexOf('if (!fileIsMissing(dlError)) {'))
      const end = branch.indexOf('}')
      assert.ok(!/saveScan/.test(branch.slice(0, end)), `${p}: no reading is written`)
      assert.match(branch.slice(0, 400), /status: 'uploaded'/, `${p}: the row goes back in the queue`)
    }
  })
})

describe('Documents: D7, D8, D9, D10, D11, D12, D14, D-two, D13, D15', () => {
  test('every one of these files has no unchecked read left', () => {
    for (const p of ['lib/documentBatch.ts', 'lib/documentScan.ts',
                     'app/api/company-information/route.ts', 'app/api/to-confirm/route.ts',
                     'app/api/documents/report/route.ts', 'app/api/document-checklist/route.ts']) {
      assert.deepEqual(uncheckedReads(code(p)), [], p)
    }
  })

  test('D7 — the batch summary throws rather than being emailed as 0', () => {
    const src = code('lib/documentBatch.ts')
    assert.match(src, /mustRows<\{ id: string \}>\('the documents in this batch'/)
    assert.match(src, /'what those documents came to'/)
  })

  test('D-two — the is_current clear is checked, so a document cannot have two current scans', () => {
    const src = code('lib/documentScan.ts')
    assert.match(src, /if \(clearErr\) \{/)
    assert.match(src, /the earlier readings could not be set aside/)
  })

  test('D14 — a label that did not reach the vocabulary is said out loud', () => {
    const src = code('lib/documentScan.ts')
    assert.match(src, /if \(labelErr\) \{/)
    assert.match(src, /an audit of everything may skip them/)
  })

  test('D9 — and Confirm all cannot overwrite a settled value from an empty context', () => {
    const src = code('app/api/company-information/route.ts')
    assert.match(src, /mustCount\('how many answers are waiting'/)
    assert.ok(!/waiting \?\? 0/.test(src), '"0 waiting" over a queue of twelve is the same untruth')
  })

  test('D8 — a failed switch lookup no longer turns an answer into a plain fact', () => {
    const src = code('app/api/to-confirm/route.ts')
    assert.match(src, /mustRow<\{ id: string; scope: string; value_type: string; allowed_values: string\[\] \| null \}>\(\s*\n?\s*'the question this answers'/)
  })

  test('*** D13 — the drawer only strips the view for a document NOBODY has ever read ***', () => {
    const src = code('components/DocumentReport.tsx')
    assert.match(src, /const everRead = !!row\.readable_scan_id/)
    assert.match(src, /if \(row\.display_status === 'could_not_read' && !everRead\) \{/)
    assert.match(src, /nothing about your\s*\n?\s*file needs changing/,
      'and "Upload a clearer copy" is no longer the only advice')
  })
})

describe('HR: H2, H3, H5, H6, H7, H8', () => {
  test('no unchecked read is left in any of them', () => {
    for (const p of ['lib/hrAnswer.ts', 'lib/handbookCheck.ts', 'lib/handbookCheckView.ts',
                     'lib/handbookCheckNotify.ts']) {
      assert.deepEqual(uncheckedReads(code(p)), [], p)
    }
  })

  test('H3 — the night queue cannot check every handbook of every company again', () => {
    const src = code('lib/handbookCheck.ts')
    assert.match(src, /mustRows<\{ handbook_id: string \}>\('which handbooks have been checked'/)
  })

  test('H5 — "a site that was removed" is never said from a failed read', () => {
    assert.match(code('lib/hrAnswer.ts'), /mustRows<\{ id: string; name: string \}>\('your sites'/)
    assert.match(code('lib/handbookCheck.ts'), /mustRow<\{ name: string \}>\('the site this handbook covers'/)
  })

  test('H8 — the email SAYS it could not count the parts, instead of leaving the line out', () => {
    const src = code('lib/handbookCheckNotify.ts')
    assert.match(src, /blocks\.push\(\{ kind: 'para', text: EMAIL\.partsUnknown \}\)/)
    assert.match(src, /partsUnknown: 'We could not work out whether every part was checked/)
  })
})

describe('Workspace and shared: W6, W7, W8, W9, M5, B4, S4', () => {
  test('W7 — one function, both sections: "No conversations yet" is not said from a failure', () => {
    assert.match(code('lib/topicList.ts'), /mustRows\('your conversations', \{ data, error \}\)/)
  })

  test('W6 — every owed row no longer says "Nothing yet" at once', () => {
    const src = code('app/api/obligations/route.ts')
    assert.deepEqual(uncheckedReads(src), [])
    assert.match(src, /'what you have shown for each requirement'/)
    assert.match(src, /requirements: mustCount\('the requirement library', reqCount\)/)
  })

  test('W8 — the overwrite history is written from a read that was checked', () => {
    const src = code('app/api/switches/answer/route.ts')
    assert.deepEqual(uncheckedReads(src), [])
    assert.match(src, /const beforeRows = mustRows</)
  })

  test('*** W9 — a null count is not zero, and a null count comes back with NO error ***', () => {
    const src = code('app/compliance/page.tsx')
    assert.match(src, /const \{ count, error \} = await supabase\.from\('fact_proposals'\)/)
    assert.match(src, /if \(error \|\| count === null\) \{/)
    assert.ok(!/setDrawerFacts\(count \?\? 0\)/.test(src))
  })

  test('M5 — "Thank you for your feedback" only when it went', () => {
    const route = code('app/api/feedback/route.ts')
    assert.match(route, /if \(sent\.error\) \{/)
    assert.ok(!/process\.env\.FEEDBACK_EMAIL!/.test(route), 'and it no longer sends to undefined')
    assert.match(route, /const escape = /, 'their own words, not markup')
    const nav = code('components/AppLayout.tsx')
    assert.match(nav, /if \(!res\.ok\) \{ setFeedbackFailed\(true\); return \}/)
    assert.match(nav, /Your words are\s*\n?\s*still here/)
  })

  test('B4 — the badge says it could not look, rather than vanishing', () => {
    const nav = code('components/AppLayout.tsx')
    assert.match(nav, /if \(!res\.ok\) \{ setCountBroke\(true\); return \}/)
    assert.match(nav, /We could not check what is waiting for you/)
  })

  test('S4 — a sweep broken for days no longer looks like "no work"', () => {
    for (const p of ['app/api/jobs/scan-documents/route.ts', 'app/api/jobs/audit-sections/route.ts']) {
      assert.deepEqual(uncheckedReads(code(p)), [], p)
    }
  })
})

describe('*** 35c: what a printed page carries ***', () => {
  const nav = readFileSync('components/AppLayout.tsx', 'utf8')

  test('the sidebar does not print — it was on EVERY printed page of every section', () => {
    const aside = nav.slice(nav.indexOf('<aside'), nav.indexOf('</aside>'))
    assert.match(aside, /className="no-print/)
  })

  test('nor the mobile overlay, which is `fixed` and would land over the document', () => {
    assert.match(nav, /<div className="no-print lg:hidden fixed inset-0 z-50 flex">/)
  })

  test('nor the footer LINKS', () => {
    assert.match(nav, /<div className="no-print flex flex-col sm:flex-row items-center justify-between gap-2">/)
  })

  test('*** but the disclaimer still does, and that is the line that matters most on paper ***', () => {
    const line = nav.slice(nav.indexOf('CompliBoard reads your documents') - 400,
                           nav.indexOf('CompliBoard reads your documents'))
    assert.ok(!/no-print/.test(line.slice(-200)),
      'AppLayout.tsx says this is deliberate; 35c must not have changed it')
  })

  test('and the copyright appears on paper, under the disclaimer', () => {
    assert.match(nav, /<p className="print-only text-xs text-gray-400">© 2026 CompliBoard LLC<\/p>/)
  })
})

describe('*** B10\'s follow-on: "read on <date>" is the COMPANY\'s day ***', () => {
  test('formatMoment takes a zone, and the zone changes the day', () => {
    // 8 October, 6pm in Oregon. In Berlin that instant is already the 9th.
    const at = '2026-10-09T01:30:00Z'
    assert.equal(formatMoment(at, 'America/Los_Angeles'), '8 October 2026')
    assert.equal(formatMoment(at, 'Europe/Berlin'), '9 October 2026')
    assert.equal(formatMoment(at, 'Pacific/Honolulu'), '8 October 2026')
  })

  test('it falls back to the calendar zone, so a page with no zone behaves as before', () => {
    assert.equal(formatMoment('2026-10-09T01:30:00Z'), formatMoment('2026-10-09T01:30:00Z', CALENDAR_TZ))
  })

  test('a blank or unparseable value is empty, never "Invalid Date"', () => {
    for (const v of [null, undefined, '', 'not a date']) assert.equal(formatMoment(v), '')
  })

  test('both routes send the company\'s zone, and both drawers use it', () => {
    for (const p of ['app/api/documents/report/route.ts', 'app/api/audit-runs/[id]/route.ts']) {
      assert.match(code(p), /const timezone = zoneForState\(coRead\.data\?\.state as string \| null\)/, p)
    }
    assert.match(code('components/DocumentReport.tsx'), /const fmtAt = \(iso[^)]*\) => formatMoment\(iso, r\.timezone\)/)
    assert.match(code('components/DocumentReport.tsx'), /Read on \{fmtAt\(row\.scanned_at\)\}/)
    assert.match(code('components/AuditReport.tsx'), /Readings as of \{formatMoment\(run\.readings_as_of, rep\.timezone\)\}/)
  })
})

describe('§4: O2, O5, O6, O7, O8, O9', () => {
  test('*** O6, PROVED not hypothesised: the scan route now writes the claim it is recovered by ***', () => {
    const src = code('app/api/document-scan/route.ts')
    assert.match(src, /status: 'reading', reading_since: new Date\(\)\.toISOString\(\)/)
    assert.match(src, /export const maxDuration = 800/,
      'leg 3: a 20-to-100-second scan outlived the platform default and was killed')
  })

  test('O6 — and the recovery can see a NULL claim, because a less-than never matches one', () => {
    const src = code('app/api/jobs/scan-documents/route.ts')
    assert.match(src, /\.eq\('status', 'reading'\)\.is\('reading_since', null\)/)
    assert.match(src, /\.lt\('uploaded_at', stuckBefore\)/, 'and only when the row is old')
  })

  test('O7 — a failed claim throws instead of re-selecting the same company at once', () => {
    const src = code('app/api/jobs/scan-documents/route.ts')
    assert.match(src, /mustRows<QueuedDoc>\('the documents this run claimed'/)
    const claim = src.indexOf("'the documents this run claimed'")
    const cont = src.indexOf('if (!queue.length) continue')
    assert.ok(claim > 0 && claim < cont, 'the empty case still continues — that is a real answer')
  })

  test('O8 — the wait loop cannot spin: both its reads are checked', () => {
    const src = code('app/api/hr/answer/route.ts')
    assert.deepEqual(uncheckedReads(src), [])
    assert.match(src, /mustRows<\{ id: string; name: string; status: string; status_reason: string \| null \}>\(\s*\n?\s*'your handbooks', rowsRes\)/)
  })

  test('*** O9 — an answer that had not read the conversation is no longer filed inside it ***', () => {
    for (const p of ['app/api/chat/route.ts', 'app/api/hr/answer/route.ts']) {
      const src = code(p)
      assert.match(src, /We could not read the earlier messages in this conversation/, p)
      assert.match(src, /status: 503/, p)
      // The refusal is inside the catch that used to swallow the failure, not somewhere later.
      const catchAt = src.indexOf('could not load stored turns for history')
      const refuse = src.indexOf('We could not read the earlier messages in this conversation')
      assert.ok(catchAt > 0 && refuse > catchAt && refuse - catchAt < 400,
        `${p}: the refusal is in the catch that used to carry on`)
    }
  })

  test('O2 — "Audit again" on a checklist re-runs the checklist', () => {
    const src = code('components/AuditReport.tsx')
    assert.match(src, /run\.kind === 'template'\s*\n?\s*\? \{ kind: 'template', template_document_id: run\.template_document_id/)
    assert.match(src, /We cannot find the checklist this audit was run against/)
  })

  test('O5 — signup undoes what it made, newest first, and says so loudly if it cannot', () => {
    const src = code('app/api/signup/route.ts')
    assert.match(src, /const undoLogin = async \(why: string\) => \{/)
    assert.match(src, /auth\.admin\.deleteUser\(authData\.user!\.id\)/)
    assert.match(src, /SIGNUP LEFT A LOGIN WITH NO COMPANY — clear it by hand/)
    assert.match(src, /SIGNUP LEFT AN EMPTY COMPANY — clear it by hand/)
    const company = src.indexOf('if (companyError) {')
    const profile = src.indexOf('if (profileError) {')
    assert.ok(company > 0 && profile > company, 'both failure paths undo')
  })
})

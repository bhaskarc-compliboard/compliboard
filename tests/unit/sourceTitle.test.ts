/**
 * SOURCE TITLES THAT A PERSON CAN IDENTIFY — Run 3, `lib/sourceTitle.ts`.
 *
 * The three junk shapes are the ones named in the Run 3 brief and seen in Run 1's answers: a
 * bare domain, a PDF header read by OCR, and a date-stamped file name. The property that matters
 * is NOT that junk is caught — it is that **a real title is never replaced**, because a working
 * title thrown away is a regression nobody would notice.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { displaySource, isJunkTitle, hostOf } from '../../lib/sourceTitle.ts'

describe('real titles are left alone — the half that must not break', () => {
  const real = [
    ['Hazard Communication Standard, appendix C, label content', 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200AppC'],
    ['Oregon Community Right to Know', 'https://www.oregon.gov/osfm/community-right-to-know/Pages/default.aspx'],
    ['Paid sick leave, accrual and use', 'https://lni.wa.gov/workers-rights/leave/paid-sick-leave/'],
    ['29 CFR 1910.178 - Powered industrial trucks', 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.178'],
  ]
  for (const [title, url] of real) {
    test(`kept: ${title.slice(0, 40)}`, () => {
      assert.equal(isJunkTitle(title, url), false)
      assert.equal(displaySource(title, url).title, title)
      assert.equal(displaySource(title, url).derived, false)
    })
  }
})

describe('a bare domain', () => {
  test('osha.gov is replaced by the subject in the path', () => {
    const r = displaySource('osha.gov', 'https://www.osha.gov/laws-regs/hazardous-waste-generators')
    assert.equal(r.derived, true)
    assert.equal(r.title, 'Hazardous waste generators')
    assert.equal(r.host, 'osha.gov')
  })
  test('www. and a trailing slash are the same case', () => {
    assert.equal(isJunkTitle('www.epa.gov/', 'https://www.epa.gov/rcra/generator-categories'), true)
    assert.equal(displaySource('www.epa.gov/', 'https://www.epa.gov/rcra/generator-categories').title, 'Generator categories')
  })
})

describe('a PDF header read by OCR', () => {
  test('"FO D SAFETY" — the dropped letter leaves a fragment', () => {
    assert.equal(isJunkTitle('FO D SAFETY', 'https://doh.wa.gov/sites/default/files/food-worker-card-requirements.pdf'), true)
    assert.equal(displaySource('FO D SAFETY', 'https://doh.wa.gov/sites/default/files/food-worker-card-requirements.pdf').title,
      'Food worker card requirements')
  })
  test('"HAZAR OUS WASTE" likewise', () => {
    assert.equal(isJunkTitle('HAZAR OUS WASTE', 'https://www.epa.gov/hw/hazardous-waste-generator-requirements'), true)
  })
  test('A LEGITIMATE ALL-CAPS TITLE IS NOT JUNK — no fragments in it', () => {
    assert.equal(isJunkTitle('HAZARDOUS WASTE GENERATOR REQUIREMENTS', 'https://www.epa.gov/hw/x'), false)
  })
  test('REAL ACRONYMS SURVIVE — this is why the letter threshold is two, not three', () => {
    for (const t of ['EPA HAZARDOUS WASTE RULES', 'DOT HAZMAT TABLE', 'GHS PICTOGRAM GUIDE', 'OSHA SDS REQUIREMENTS']) {
      assert.equal(isJunkTitle(t, 'https://www.epa.gov/hw/x'), false, t)
    }
  })
})

describe('a date-stamped file name', () => {
  test('policy-2024-03-11-final-v2', () => {
    assert.equal(isJunkTitle('policy-2024-03-11-final-v2', 'https://oregon.gov/deq/rules/air-contaminant-discharge-permits'), true)
    assert.equal(displaySource('policy-2024-03-11-final-v2', 'https://oregon.gov/deq/rules/air-contaminant-discharge-permits').title,
      'Air contaminant discharge permits')
  })
  test('DEQ_20240311_rev3', () => {
    assert.equal(isJunkTitle('DEQ_20240311_rev3', 'https://oregon.gov/deq/a'), true)
  })
  test('a bare file name with an extension', () => {
    assert.equal(isJunkTitle('guidance_v2.pdf', 'https://epa.gov/x'), true)
  })
  test('a title that merely MENTIONS a year is not a file name', () => {
    assert.equal(isJunkTitle('Seattle minimum wage 2026', 'https://seattle.gov/labor-standards/minimum-wage'), false)
  })
})

describe('when the URL yields nothing either', () => {
  test('it falls back to the domain rather than inventing a title', () => {
    const r = displaySource('osha.gov', 'https://www.osha.gov/')
    assert.equal(r.title, 'osha.gov')
    assert.equal(r.derived, true)
  })
  test('noise segments are skipped on the way back', () => {
    // /sites/default/files/ is scaffolding; the subject is the last real segment.
    assert.equal(displaySource('epa.gov', 'https://epa.gov/sites/default/files/tier-two-reporting/index.html').title,
      'Tier two reporting')
  })
  test('an unparseable URL does not throw', () => {
    assert.doesNotThrow(() => displaySource('', 'not a url'))
  })
})

describe('hostOf', () => {
  test('strips www', () => { assert.equal(hostOf('https://www.osha.gov/a/b'), 'osha.gov') })
  test('survives a malformed url', () => { assert.equal(hostOf('epa.gov/x'), 'epa.gov') })
})

describe('a file name whose separators became spaces — Fix Round 1 (E)', () => {
  // *** ALL THREE ARE REAL, PULLED OUT OF `turns.sources` ON STAGING. *** The old rule 3
  // required a `[_-]` AND no whitespace, so a name that had already had its underscores turned
  // into spaces walked straight through and reached the screen as the link's label.
  const JUNK: Array<[string, string, string]> = [
    ['2017 labor standards ord quick chart 11 15 17',
      'https://www.seattle.gov/documents/departments/laborstandards/2017%20labor%20standards%20ord_quick%20chart_11-15-17.pdf',
      'Labor standards ord quick chart'],
    ['registration process brochure 04 06 2018 final',
      'https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/docs/registration/6196/registration-process-brochure-04-06-2018-final.pdf',
      'Registration process brochure final'],
    ['J:\\SHARED\\PERMITS\\Forms\\Baseline Monitoring Report.doc Rev. 02/27/01w',
      'https://www.sandiego.gov/sites/default/files/2024-11/baseline-monitoring-report.pdf',
      'Baseline monitoring report'],
  ]

  for (const [title, url, expected] of JUNK) {
    test(`replaced: ${title.slice(0, 44)}`, () => {
      assert.equal(isJunkTitle(title, url), true)
      const shown = displaySource(title, url)
      assert.equal(shown.title, expected)
      assert.equal(shown.derived, true)
    })
  }

  test('the derived title does not simply repeat the date stamp', () => {
    const shown = displaySource(JUNK[0][0], JUNK[0][1])
    assert.ok(!/\d/.test(shown.title), `numbers survived: ${shown.title}`)
  })
})

describe('and the titles that must NOT be thrown away', () => {
  // *** THE COST OF OVER-REACHING IS A CORRECT TITLE DESTROYED. *** Each of these is real and
  // each carries a number run that a date-only rule would condemn. The guard is capitalisation:
  // a person who titled a page capitalised it; a file name that lost its underscores did not.
  const KEEP: Array<[string, string]> = [
    ['6-2-30: CATEGORICAL INDUSTRIAL USER REPORTING REQUIREMENTS:',
      'https://codelibrary.amlegal.com/codes/masoncityia/latest/masoncity_ia/0-0-0-3222'],
    ['Fall Protection in Construction OSHA 3146-05R 2015',
      'https://www.osha.gov/sites/default/files/publications/OSHA3146.pdf'],
    ['Seattle Paid Sick Leave Laws and Requirements for 2026',
      'https://www.sixfifty.com/blog/seattle-paid-sick-leave-laws-and-requirements/'],
    ['Hazmat Registration Brochure 2025 2026',
      'https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/2025-04/Hazmat-Registration-Brochure-2025-2026.pdf'],
    ['Internal Revenue Bulletin: 2026-29 | Internal Revenue Service', 'https://www.irs.gov/irb/2026-29_irb'],
  ]

  for (const [title, url] of KEEP) {
    test(`kept: ${title.slice(0, 44)}`, () => {
      assert.equal(isJunkTitle(title, url), false)
      assert.equal(displaySource(title, url).title, title)
    })
  }
})

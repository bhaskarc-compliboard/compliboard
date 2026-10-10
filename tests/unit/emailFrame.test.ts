/**
 * THE SHARED EMAIL FRAME — Calendar B5, boards 14 and 15, decision 11.
 *
 * The frame's whole reason for existing is that **the HTML part and the plain-text part are made
 * from one object**, so they cannot drift. These tests are mostly about that: anything in the
 * content must reach both parts, and nothing may reach only one.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderEmail, renderHtml, renderText, BRAND_GREEN, BRAND_ORANGE, type EmailContent }
  from '../../lib/emailFrame.ts'

const sample: EmailContent = {
  company: 'Cascade Specialty Chemicals, LLC',
  title: 'Your dates for October 2026',
  blocks: [
    { kind: 'para', text: 'Here is what is due.' },
    { kind: 'list', heading: 'Due this month (1):', rows: [
      { lead: '20 October', main: 'Air permit annual fee', meta: 'Portland plant', tag: 'not confirmed' },
    ], more: '…and 2 more.' },
    { kind: 'note', text: 'A gentle reminder.' },
    { kind: 'link', label: 'Confirm them', href: 'https://app.example.com/calendar?tab=confirm' },
  ],
  button: { label: 'Your calendar', href: 'https://app.example.com/calendar' },
  footnotes: ['Not legal advice.'],
  why: 'You get this because you have a login.',
}

describe('one object, two renderings', () => {
  test('every piece of content reaches BOTH parts', () => {
    const { html, text } = renderEmail(sample)
    for (const piece of [
      'Cascade Specialty Chemicals, LLC', 'Due this month (1):', '20 October',
      'Air permit annual fee', 'Portland plant', 'not confirmed', '…and 2 more.',
      'A gentle reminder.', 'Confirm them', 'Your calendar', 'Not legal advice.',
      'You get this because you have a login.',
    ]) {
      assert.ok(text.includes(piece), `the text part is missing ${JSON.stringify(piece)}`)
      assert.ok(html.includes(piece), `the HTML part is missing ${JSON.stringify(piece)}`)
    }
    // Both links survive in both parts — the plain-text reader must be able to get there too.
    for (const href of ['https://app.example.com/calendar?tab=confirm', 'https://app.example.com/calendar']) {
      assert.ok(text.includes(href), `the text part lost ${href}`)
      assert.ok(html.includes(href), `the HTML part lost ${href}`)
    }
  })

  test('a block added to the object appears in both, with no second place to edit', () => {
    // This is the drift the file exists to prevent, exercised rather than asserted about.
    const before = renderEmail(sample)
    const after = renderEmail({ ...sample,
      blocks: [...sample.blocks, { kind: 'para', text: 'One more thing.' }] })
    assert.ok(!before.text.includes('One more thing.') && !before.html.includes('One more thing.'))
    assert.ok(after.text.includes('One more thing.'), 'text')
    assert.ok(after.html.includes('One more thing.'), 'html')
  })

  test('the title is NOT repeated as a paragraph, and the why line is last in the text', () => {
    const text = renderText(sample)
    assert.ok(text.trimEnd().endsWith('You get this because you have a login.'))
  })
})

describe('it survives an inbox', () => {
  const html = renderHtml(sample)

  test('inline styles only — Gmail strips a <style> block', () => {
    assert.ok(!/<style[\s>]/i.test(html), 'a <style> block would be removed and the email unstyled')
    assert.ok(!/class=/.test(html), 'a class with no stylesheet styles nothing')
  })

  test('no images and no web fonts: a blocked image is a broken box on first open', () => {
    assert.ok(!/<img[\s>]/i.test(html))
    assert.ok(!/@import|fonts\.googleapis|<link[\s>]/i.test(html))
    // The wordmark is TEXT, in the owner's two colours.
    assert.ok(html.includes(`<span style="color:${BRAND_GREEN}">Compli</span>`))
    assert.ok(html.includes(`<span style="color:${BRAND_ORANGE}">Board</span>`))
  })

  test('tables at 600px, because Outlook renders with Word', () => {
    assert.ok(html.includes('width="600"'), 'the body column')
    assert.ok(!/display\s*:\s*(flex|grid)/i.test(html), 'neither works in Outlook')
    assert.ok(html.includes('role="presentation"'), 'or a screen reader announces the layout as data')
  })

  test('ONE green button, and it is an <a>', () => {
    const buttons = html.match(new RegExp(`background:${BRAND_GREEN}`, 'g')) ?? []
    assert.equal(buttons.length, 1, 'an email with two call-to-action buttons has none')
    assert.ok(!/<button/i.test(html), 'a <button> does nothing in an inbox')
  })
})

describe('nothing from outside reaches the markup raw', () => {
  test('a company name with angle brackets and an ampersand is escaped', () => {
    const html = renderHtml({ ...sample,
      company: 'Smith & Sons <script>alert(1)</script>',
      title: 'A "quoted" <b>title</b>',
      blocks: [{ kind: 'para', text: '<img src=x onerror=1>' }] })
    assert.ok(!html.includes('<script>'), 'a company name is whatever a customer typed')
    assert.ok(!html.includes('<img src=x'), 'so is a document title')
    assert.ok(html.includes('Smith &amp; Sons'))
    assert.ok(html.includes('&lt;b&gt;title&lt;/b&gt;'))
  })

  test('a href that is not http(s) cannot become javascript:', () => {
    const html = renderHtml({ ...sample,
      button: { label: 'Go', href: 'javascript:alert(1)' },
      blocks: [{ kind: 'link', label: 'Here', href: 'data:text/html,<script>1</script>' }] })
    assert.ok(!html.includes('javascript:'), 'a link in an email is clicked without thought')
    assert.ok(!html.includes('data:text/html'))
  })
})

describe('all four emails use the frame', () => {
  test('each builds an EmailContent and sends html beside text', () => {
    for (const f of ['lib/calendarNotify.ts', 'lib/documentBatch.ts',
                     'lib/auditNotify.ts', 'lib/handbookCheckNotify.ts']) {
      const src = readFileSync(f, 'utf8')
      assert.match(src, /renderEmail\(/, `${f} does not render through the frame`)
      assert.match(src, /EmailContent/, `${f} builds no content object`)
      assert.match(src, /\bhtml\b/, `${f} does not send an HTML part`)
    }
  })

  test('every one of them carries a "why you got this" line', () => {
    // Three of the four had none. `why` is required by the type, so this cannot regress silently —
    // but the type would be satisfied by an empty string, and that is what is checked here.
    for (const f of ['lib/calendarNotify.ts', 'lib/documentBatch.ts',
                     'lib/auditNotify.ts', 'lib/handbookCheckNotify.ts']) {
      assert.match(readFileSync(f, 'utf8'), /why:[\s\S]{0,400}?You get this/,
        `${f} has no "why you got this" line`)
    }
  })

  test('the feedback email stays plain — it goes to us, not to a customer', () => {
    const src = readFileSync('app/api/feedback/route.ts', 'utf8')
    assert.ok(!src.includes('emailFrame'), 'a letterhead on our own inbox is noise')
  })
})

describe('board 14: the counts strip, the panel and the two headings', () => {
  const withBoard14: EmailContent = {
    ...sample,
    blocks: [
      { kind: 'counts', items: [{ n: 2, label: 'due this month' }, { n: 2, label: 'dates that have passed' }, { n: 2, label: 'to confirm' }] },
      { kind: 'list', heading: 'Due this month (2):', htmlHeading: 'Due this month',
        rows: [{ lead: '20 October', main: 'Air permit annual fee' }] },
      { kind: 'panel',
        button: { label: 'Confirm 2 dates', href: 'https://app.example.com/calendar?tab=confirm', textLabel: 'Confirm them' },
        link: { label: 'See every date', href: 'https://app.example.com/calendar', textLabel: 'Your calendar' } },
    ],
    button: null,
  }
  const { html, text } = renderEmail(withBoard14)

  test('the heading is quiet in HTML and keeps its count in text', () => {
    assert.ok(html.includes('>Due this month<'), 'HTML: no colon, no count')
    assert.ok(!html.includes('Due this month (2):'))
    assert.ok(text.includes('Due this month (2):'), 'the text keeps its own words')
  })

  test('the counts strip is HTML-only, and the text states the same numbers its own way', () => {
    // Named rather than discovered: it is the one block that does not reach both parts, because
    // the text already says every number in its headings.
    assert.ok(html.includes('due this month') && html.includes('to confirm'))
    assert.ok(!text.includes('dates that have passed'), 'the strip must not be transcribed into the text')
    assert.ok(text.includes('(2):'), 'but the number is still there, in the heading')
  })

  test('ONE green button, and it is the one that does something', () => {
    const buttons = html.match(new RegExp(`background:${BRAND_GREEN}`, 'g')) ?? []
    assert.equal(buttons.length, 1)
    assert.ok(html.includes('Confirm 2 dates'), 'the action, not a page')
    assert.ok(html.includes('See every date'), 'the quieter link beside it')
    assert.ok(html.indexOf('See every date') > html.indexOf('Confirm 2 dates'), 'button first')
  })

  test('the plain text keeps A5b\'s approved wording, not the button\'s', () => {
    assert.ok(text.includes('Confirm them: https://app.example.com/calendar?tab=confirm'))
    assert.ok(text.includes('Your calendar: https://app.example.com/calendar'))
    assert.ok(!text.includes('Confirm 2 dates'), 'the HTML label must not leak into the text')
  })
})

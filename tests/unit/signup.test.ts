/**
 * THE FRONT DOOR — board 6, My Account step 12, decision 8.
 *
 * Three things are held here, and the middle one is why the file exists:
 *
 *   1. **The words are the board's.** Every string the page shows is asserted to appear in
 *      `docs/account-boards.html`'s board 6, so the page cannot drift from the drawing by being
 *      edited, and a reviewer can check a claim against the artifact rather than against my typing.
 *   2. **The undo really runs.** `createAccount` takes its three outside calls as ports
 *      (`lib/signup.ts`), so a company creation can be made to fail on purpose and the test can
 *      watch the login be deleted. That is the failure `docs/ACCOUNT-MACHINERY.md` §B3 found in the
 *      old route — a login that could sign in, 404 on every page, and never be registered again —
 *      and a grep for `deleteUser` would not have proved it was reached.
 *   3. **Nothing is written from the website at signup.** The box stores a host. No model is
 *      called, no scan is run, and `scan_result` is not written: the website is read at step 13.
 *
 * Sources are read with `code()` — comments stripped — because several of these assertions are
 * about what the program does and the paragraphs above them name the very things being forbidden.
 */
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  emailLooksLikeOne, normaliseWebsite,
  SIGNUP_TITLE, SIGNUP_LEDE, EMAIL_LABEL, EMAIL_PLACEHOLDER, PASSWORD_LABEL,
  SIGNUP_PASSWORD_HINT, SIGNUP_PASSWORD_MIN, COMPANY_LABEL, COMPANY_PLACEHOLDER,
  WEBSITE_LABEL, WEBSITE_OPTIONAL, WEBSITE_PLACEHOLDER, WEBSITE_GREEN,
  SIGNUP_BUTTON, HAVE_ACCOUNT, SIGN_IN,
  EMAIL_INVALID, SIGNUP_PASSWORD_SHORT, COMPANY_REQUIRED, WEBSITE_UNREADABLE,
  EMAIL_TAKEN, NOTHING_SAVED, UNDO_FAILED,
} from '../../lib/signupView.ts'
import { createAccount, type SignupPorts } from '../../lib/signup.ts'
import { JOIN_PASSWORD_MIN } from '../../lib/peopleView.ts'

/** The code without comments, so a paragraph naming a thing is not the thing. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PAGE = readFileSync('app/signup/page.tsx', 'utf8')
const ROUTE = readFileSync('app/api/signup/route.ts', 'utf8')
const FLOW = readFileSync('lib/signup.ts', 'utf8')
const SQL = readFileSync('supabase/migrations/084_an_account_in_one_transaction.sql', 'utf8')
const BOARDS = readFileSync('docs/account-boards.html', 'utf8')

/** Board 6 alone — from `<section … id="b6">` to the next section. */
const BOARD6 = BOARDS.slice(BOARDS.indexOf('id="b6"')).split('<!-- =====================')[0]

// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('the words are board 6’s, not this file’s', () => {
  test('board 6 is where it is read from, and it is one board', () => {
    assert.ok(BOARD6.includes('6 · Sign up'), 'board 6 did not slice out of the boards file')
    assert.ok(!BOARD6.includes('id="b7"'), 'the slice ran on into board 7')
  })

  for (const [name, word] of [
    ['the title', SIGNUP_TITLE],
    ['the lede', SIGNUP_LEDE],
    ['the email label', EMAIL_LABEL],
    ['the email placeholder', EMAIL_PLACEHOLDER],
    ['the password label', PASSWORD_LABEL],
    ['the password hint', SIGNUP_PASSWORD_HINT],
    ['the company label', COMPANY_LABEL],
    ['the company placeholder', COMPANY_PLACEHOLDER],
    ['the website label', WEBSITE_LABEL],
    ['the optional marker', WEBSITE_OPTIONAL],
    ['the website placeholder', WEBSITE_PLACEHOLDER],
    ['the green line', WEBSITE_GREEN],
    ['the button', SIGNUP_BUTTON],
    ['the foot', HAVE_ACCOUNT],
    ['the sign-in link', SIGN_IN],
  ] as const) {
    test(`${name} is drawn on the board`, () => {
      assert.ok(BOARD6.includes(word), `board 6 does not say ${JSON.stringify(word)}`)
    })
  }

  test('the page shows all of them and keeps none of its own', () => {
    for (const word of [SIGNUP_TITLE, SIGNUP_LEDE, EMAIL_LABEL, COMPANY_LABEL, WEBSITE_LABEL]) {
      assert.ok(!PAGE.includes(`"${word}"`) && !PAGE.includes(`'${word}'`),
        `the page carries its own copy of ${JSON.stringify(word)}`)
    }
    assert.match(code(PAGE), /from '@\/lib\/signupView'/)
  })

  test('the password rule is the one /join and /reset-password use — one ten, three doors', () => {
    assert.equal(SIGNUP_PASSWORD_MIN, JOIN_PASSWORD_MIN)
    assert.equal(SIGNUP_PASSWORD_MIN, 10)
    assert.equal(SIGNUP_PASSWORD_HINT, 'At least 10 characters')
    assert.match(code(PAGE), /password\.length < SIGNUP_PASSWORD_MIN/)
    assert.match(code(FLOW), /password\.length < SIGNUP_PASSWORD_MIN/)
  })
})

describe('the email shape check', () => {
  test('takes an ordinary address, trimmed', () => {
    assert.equal(emailLooksLikeOne('maria@willamettevinegar.com'), true)
    assert.equal(emailLooksLikeOne('  maria@willamettevinegar.com  '), true)
    assert.equal(emailLooksLikeOne('m.alvarez+permits@sub.example.co.uk'), true)
  })
  test('refuses what is not one', () => {
    for (const bad of ['', '   ', 'maria', 'maria@', '@example.com', 'maria@example',
                       'maria @example.com', 'maria@exa mple.com', 'maria@@example.com']) {
      assert.equal(emailLooksLikeOne(bad), false, `${JSON.stringify(bad)} was accepted`)
    }
    assert.equal(emailLooksLikeOne(null), false)
    assert.equal(emailLooksLikeOne(undefined), false)
  })
})

describe('the website becomes a bare host or nothing', () => {
  test('the three ways a person writes the same company', () => {
    assert.equal(normaliseWebsite('company.com'), 'company.com')
    assert.equal(normaliseWebsite('www.Company.com'), 'company.com')
    assert.equal(normaliseWebsite('https://www.company.com/about?x=1'), 'company.com')
    assert.equal(normaliseWebsite('  HTTP://COMPANY.COM  '), 'company.com')
  })
  test('blank is blank, and so is anything that is not a host', () => {
    assert.equal(normaliseWebsite(''), null)
    assert.equal(normaliseWebsite('   '), null)
    assert.equal(normaliseWebsite(null), null)
    assert.equal(normaliseWebsite(undefined), null)
    // Step 13 fetches this column. A sentence is not a URL and must not be stored as one.
    assert.equal(normaliseWebsite('about our vinegar'), null)
    assert.equal(normaliseWebsite('company'), null)
    assert.equal(normaliseWebsite('-company.com'), null)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Three ports that record what they were asked, and can be told to fail.
 *
 * *** THE RECORDING WRAPS THE OVERRIDE; IT IS NOT REPLACED BY IT. *** This was written as
 * `{ ...base, ...overrides }`, which swapped the recording version out for the failing one — so
 * `calls` lost the very step the test was about, and the undo tests failed asserting an order
 * nothing had observed. A fake that stops recording when you make it fail cannot test a failure.
 */
function ports(overrides: Partial<SignupPorts> = {}) {
  const calls: string[] = []
  const seen: Record<string, unknown> = {}
  const fakes: SignupPorts = {
    async createLogin(email, password) {
      calls.push('createLogin'); seen.email = email; seen.password = password
      return overrides.createLogin ? overrides.createLogin(email, password) : { id: 'login-1' }
    },
    async createCompany(args) {
      calls.push('createCompany'); seen.company = args
      return overrides.createCompany ? overrides.createCompany(args) : 'company-1'
    },
    async deleteLogin(id) {
      calls.push('deleteLogin'); seen.deleted = id
      return overrides.deleteLogin ? overrides.deleteLogin(id) : true
    },
  }
  return { calls, seen, ports: fakes }
}

const GOOD = {
  email: '  maria@willamettevinegar.com ',
  password: 'a-long-enough-one',
  companyName: '  Willamette Vinegar Works ',
  website: 'https://www.willamettevinegar.com/about',
}

describe('making an account', () => {
  test('the happy path: login, then the one transaction, and nothing deleted', async () => {
    const p = ports()
    const out = await createAccount(GOOD, p.ports)
    assert.deepEqual(p.calls, ['createLogin', 'createCompany'])
    assert.equal(out.ok, true)
    if (out.ok) {
      assert.equal(out.companyId, 'company-1')
      assert.equal(out.email, 'maria@willamettevinegar.com')
    }
  })

  test('what the ports are handed is trimmed, and the website is a bare host', () => {
    const p = ports()
    return createAccount(GOOD, p.ports).then(() => {
      assert.equal(p.seen.email, 'maria@willamettevinegar.com')
      // No email: the company row has nowhere to put one, so the function does not take one.
      assert.deepEqual(p.seen.company, {
        userId: 'login-1',
        companyName: 'Willamette Vinegar Works',
        website: 'willamettevinegar.com',
      })
    })
  })

  test('an unreadable website does not stop an account — it is stored as nothing', async () => {
    const p = ports()
    const out = await createAccount({ ...GOOD, website: 'our vinegar' }, p.ports)
    assert.equal(out.ok, true)
    assert.equal((p.seen.company as { website: string | null }).website, null)
  })
})

describe('the three refusals that write nothing at all', () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ['a bad email', { ...GOOD, email: 'maria' }, EMAIL_INVALID],
    ['a short password', { ...GOOD, password: 'short' }, SIGNUP_PASSWORD_SHORT],
    ['no company name', { ...GOOD, companyName: '   ' }, COMPANY_REQUIRED],
  ]
  for (const [name, input, sentence] of cases) {
    test(`${name} is refused before any port is called`, async () => {
      const p = ports()
      const out = await createAccount(input, p.ports)
      assert.equal(out.ok, false)
      if (!out.ok) {
        assert.equal(out.status, 400)
        assert.equal(out.error, sentence)
      }
      assert.deepEqual(p.calls, [], 'something was written for an input that was refused')
    })
  }

  test('a missing body is refused the same way, not crashed on', async () => {
    const p = ports()
    const out = await createAccount({}, p.ports)
    assert.equal(out.ok, false)
    if (!out.ok) assert.equal(out.error, EMAIL_INVALID)
    assert.deepEqual(p.calls, [])
  })
})

describe('an address that already has a login', () => {
  test('says so, offers the sign-in link, and undoes nothing — there is nothing to undo', async () => {
    const p = ports({ async createLogin() { return { problem: 'taken' } } })
    const out = await createAccount(GOOD, p.ports)
    assert.equal(out.ok, false)
    if (!out.ok) {
      assert.equal(out.status, 409)
      assert.equal(out.error, EMAIL_TAKEN)
      assert.deepEqual(out.link, { label: 'Go to sign in', href: '/login' })
    }
    assert.ok(!p.calls.includes('deleteLogin'), 'somebody else’s login was deleted')
    assert.ok(!p.calls.includes('createCompany'))
  })
})

describe('*** A FAILED COMPANY CREATION DELETES THE LOGIN ***', () => {
  test('the company returning nothing: the login is deleted and the address is free again', async () => {
    const p = ports({ async createCompany() { return null } })
    const out = await createAccount(GOOD, p.ports)
    assert.deepEqual(p.calls, ['createLogin', 'createCompany', 'deleteLogin'])
    assert.equal(p.seen.deleted, 'login-1', 'a different login was deleted')
    assert.equal(out.ok, false)
    if (!out.ok) {
      assert.equal(out.status, 500)
      assert.equal(out.error, NOTHING_SAVED)
    }
  })

  test('the company THROWING is the same outcome, not an unhandled failure', async () => {
    const p = ports({ async createCompany() { throw new Error('connection reset') } })
    const out = await createAccount(GOOD, p.ports)
    assert.deepEqual(p.calls, ['createLogin', 'createCompany', 'deleteLogin'])
    assert.equal(out.ok, false)
    if (!out.ok) assert.equal(out.error, NOTHING_SAVED)
  })

  test('and when the undo itself fails, the sentence does NOT promise that nothing was saved', async () => {
    // §5.1: a login was made and could not be removed. Saying "nothing was saved" would be false,
    // and the person would be told to try an address that now refuses them.
    const p = ports({ async createCompany() { return null }, async deleteLogin() { return false } })
    const out = await createAccount(GOOD, p.ports)
    assert.equal(out.ok, false)
    if (!out.ok) {
      assert.equal(out.error, UNDO_FAILED)
      assert.notEqual(out.error as string, NOTHING_SAVED)
      assert.match(out.error, /hello@compliboard\.com/)
    }
  })

  test('a thrown deleteLogin is the same — the honest sentence, not a crash', async () => {
    const p = ports({ async createCompany() { return null }, async deleteLogin() { throw new Error('gone') } })
    const out = await createAccount(GOOD, p.ports)
    assert.equal(out.ok, false)
    if (!out.ok) assert.equal(out.error, UNDO_FAILED)
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('the page asks four things and nothing else', () => {
  test('four inputs, no dropdown', () => {
    assert.equal((code(PAGE).match(/<input/g) ?? []).length, 4)
    assert.ok(!/<select/.test(code(PAGE)), 'a dropdown survived')
    assert.ok(!/US_STATES/.test(code(PAGE)), 'the fifty states are still here')
    assert.ok(!/api\/industries/.test(code(PAGE)), 'the industry list is still fetched')
  })

  test('it posts exactly the four, by name', () => {
    const body = code(PAGE).match(/JSON\.stringify\(\{([^}]*)\}\)/)
    assert.ok(body, 'the page does not post a body')
    // `{ password }` is shorthand and carries no colon, so the keys are read by splitting on
    // commas rather than by looking for `name:` — which would have found two of the four.
    const keys = body[1].split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.split(':')[0].trim()).sort()
    assert.deepEqual(keys, ['companyName', 'email', 'password', 'website'])
  })

  test('one way out, and it is the Dashboard', () => {
    assert.equal((code(PAGE).match(/router\.push\('\/dashboard'\)/g) ?? []).length, 1)
    assert.ok(!code(PAGE).includes("router.push('/')"), 'a signup path still lands on the homepage')
  })

  test('it holds no key and no table of its own', () => {
    assert.ok(!/SERVICE_ROLE/i.test(PAGE))
    assert.ok(!/supabaseAdmin/.test(code(PAGE)))
    assert.ok(!/\.from\('companies'\)|\.from\('profiles'\)|\.from\('entities'\)/.test(code(PAGE)))
  })
})

describe('nothing is written from the website at signup', () => {
  test('no model is called, from either side of the door', () => {
    for (const [name, src] of [['the page', PAGE], ['the route', ROUTE], ['the flow', FLOW]] as const) {
      assert.ok(!/scan-website/.test(code(src)), `${name} still scans the website`)
      assert.ok(!/@\/lib\/ai|askAI|anthropic/i.test(code(src)), `${name} reaches a model`)
    }
  })

  test('the website reaches exactly one column, as a host, and scan_result reaches none', () => {
    assert.ok(!/scan_result|scanResult/.test(code(ROUTE)), 'the route still writes scan_result')
    assert.ok(!/scan_result|scanResult/.test(code(PAGE)))
    // The only column the website touches is `website_url`, and only through 084's function.
    assert.match(SQL, /insert into public\.companies \(name, website_url, trial_started_at\)/)
    assert.match(SQL, /nullif\(btrim\(coalesce\(p_website, ''\)\), ''\)/)
  })

  test('and the body no longer carries the fields that are gone', () => {
    for (const gone of ['industry', 'employeeCount', 'employee_count', 'county']) {
      assert.ok(!new RegExp(gone).test(code(ROUTE)), `the route still names ${gone}`)
      assert.ok(!new RegExp(gone).test(code(PAGE)), `the page still names ${gone}`)
    }
  })
})

describe('the route is a thin adapter over the tested flow', () => {
  test('it calls createAccount and holds the service key for the reason lib/auth.ts names', () => {
    assert.match(code(ROUTE), /createAccount\(body \?\? \{\}, ports\)/)
    assert.match(code(ROUTE), /from '@\/lib\/auth'/)
    // One client, the shared one — not a second copy built in this file.
    assert.ok(!/createClient\(/.test(code(ROUTE)), 'the route builds its own admin client again')
  })

  test('the three ports are the three outside calls, and no more', () => {
    assert.match(code(ROUTE), /auth\.admin\.createUser\(/)
    assert.match(code(ROUTE), /auth\.admin\.deleteUser\(/)
    assert.equal((code(ROUTE).match(/\.rpc\(/g) ?? []).length, 1)
    // No bare table write survives: the company, the site and the profile are 084's business.
    assert.ok(!/\.insert\(/.test(code(ROUTE)), 'the route still inserts a row itself')
  })

  test('*** THE PARAMETER NAMES MATCH THE FUNCTION’S, WHICH NOTHING ELSE CHECKS ***', () => {
    // The clients in this repository are built without the `Database` generic, so `rpc()` takes any
    // object at all and a misspelled key is a runtime failure. This reads the names out of the
    // migration and compares them with what the route sends.
    const sig = SQL.match(/create or replace function public\.create_company_for_login\(([\s\S]*?)\)\s*\nreturns uuid/)
    assert.ok(sig, 'the function signature did not parse out of 084')
    const declared = (sig[1].match(/p_\w+/g) ?? []).sort()
    const sent = (code(ROUTE).match(/p_\w+(?=:)/g) ?? []).sort()
    assert.deepEqual(sent, declared)
    assert.deepEqual(declared, ['p_company_name', 'p_user_id', 'p_website'])
  })
})

describe('migration 084 closes the function and leaves the place alone', () => {
  test('SECURITY DEFINER, an empty search path, and service_role alone', () => {
    assert.match(SQL, /security definer/)
    assert.match(SQL, /set search_path = ''/)
    for (const role of ['public', 'anon', 'authenticated']) {
      assert.ok(
        SQL.includes(`revoke all on function public.create_company_for_login(uuid, text, text) from ${role};`),
        `084 does not revoke EXECUTE from ${role}`)
    }
    assert.match(SQL, /grant execute on function public\.create_company_for_login\(uuid, text, text\) to service_role;/)
    // Three arguments, nowhere four: the email was dropped at the step 12 stop and a leftover
    // four-argument signature anywhere would be a second overload nobody revoked.
    assert.ok(!/create_company_for_login\(uuid, text, text, text\)/.test(SQL))
  })

  test('the vertical a new company starts with is a DEFAULT, not a question', () => {
    // Decision at the step 12 stop: the dropdown went, and `companies.industry` is a join key, so
    // the database answers instead of the person. `lib/agencyScope.ts` and `lib/resolve.ts` are why.
    assert.match(SQL, /alter table public\.companies alter column industry set default 'chemical-manufacturing';/)
    // Read back from the catalog AND proved on a row, because a default nobody inserted against is
    // a claim (§9a). Both checks are in the migration's own self-test.
    assert.match(SQL, /THE DEFAULT ON companies\.industry, READ OUT OF THE CATALOG/)
    assert.match(SQL, /AND THE VERTICAL, FROM THE DEFAULT ALONE/)
    // Nothing is backfilled: the companies already on staging and production keep what they chose.
    assert.ok(!/update public\.companies[\s\S]{0,120}set industry/.test(SQL),
      '084 backfills an existing company\u2019s industry')
    // And the slug is the one the seeded data actually carries.
    const agencies = readFileSync('supabase/seed-data/agencies.json', 'utf8')
    assert.ok(agencies.includes('"chemical-manufacturing"'))
  })

  test('it writes no place and no industry: those come from an address and from the walk', () => {
    const fn = SQL.slice(SQL.indexOf('create or replace function public.create_company_for_login'),
                         SQL.indexOf('comment on function public.create_company_for_login'))
    for (const column of ['industry', 'state', 'county', 'city']) {
      assert.ok(!new RegExp(`\\b${column}\\b`).test(fn), `the function writes companies.${column}`)
    }
    assert.match(fn, /trial_started_at/)
    assert.match(fn, /calendar_email/)
  })
})

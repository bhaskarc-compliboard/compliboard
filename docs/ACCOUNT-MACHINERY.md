# MY ACCOUNT — THE MACHINERY, READ FROM THE CODE

**Version 1.0 — 20 October 2026.** My Account step 1, the read-only map. Nothing was changed; the
only file this job wrote is this one.

**How to read it.** Every fact carries a `file:line` or a `table.column`. Anything not carried that
way is marked **(judgement)** or **(hypothesis)**.

- `npm run cost` at the start: **$3.45, 63 calls**. At the end: see §J. No model call was made —
  the one browser run was `npm run measure`, which printed `BLOCKED (0): nothing — no paid route
  and no write was attempted`.
- **Production was not read.** Nothing in this brief needed it: every schema question below is
  answered by `docs/SCHEMA.md`, which is generated from the **staging** catalog
  (`amzsavsrabrlcprltpom`) and was read on **2026-10-20 17:26 UTC** at migration `081` — the same
  day as this map. No `SELECT` was sent to any database by this job.
- The company throughout is **Test Gamma Solvents** (`testgamma@example.com`), the fixture login
  named in `docs/CALENDAR-MACHINERY.md:44`.
- **Two of the brief's own references were off by a file or a line, and are corrected here**, under
  §9a's "copy names from the artifact":
  - *"app/api/account:198 signs out after delete"* — the sign-out is **`app/account/page.tsx:197`**,
    in the page, not the route. The route never signs anybody out.
  - *"the companies PATCH at app/api/company-information/route.ts:170"* — there is **no PATCH
    method** on that route. It is a `POST` whose body carries `action: 'company'`
    (`app/api/company-information/route.ts:155`), and the `companies` update is at **:175**.

---

## A. THE PAGE TODAY

### A1. Every panel, in the order it appears

`app/account/page.tsx` is one client component, 481 lines, wrapped in `AppLayout`
(`app/account/page.tsx:223`). There is no server component and no `loading.tsx`. **Four panels,
chosen by one tab row**; only one is on screen at a time (`activeSection`,
`app/account/page.tsx:30`).

**The header**, above the tabs (`:226`–`:229`):

> **My Account**
> Manage your company profile, password, and billing

**The tab row** (`:205`–`:210`, rendered `:232`–`:243`). The four labels, in order:
`Company Profile` · `Change Password` · `Billing` · `Cancel Account`. The active one is
`border-green-600 text-green-700`.

---

#### Panel 1 — "Company Profile" (`:246`–`:339`). The default tab.

Heading: **Company Profile** (`:248`).

| Field | Label, exactly | Required? | Writes to |
|---|---|---|---|
| `fullName` | **Your name** (`:251`), placeholder `Your full name` | no | `profiles.full_name` |
| `companyName` | **Company name** `*` (`:260`), placeholder `Acme Chemical Co.` | yes | `companies.name` |
| `industry` | **Industry** `*` (`:269`), `<select>` | yes | `companies.industry` |
| `state` | **State** `*` (`:281`), `<select>` of 50 | yes | `companies.state` |
| `employeeCount` | **Number of employees** `*` (`:291`), `type=number` | yes | `companies.employee_count` |
| `city` | **City** `*` (`:309`), placeholder `Portland` | yes | `companies.city` |
| `county` | **County** `*` (`:318`), placeholder `Multnomah` | yes | `companies.county` |

The help line under the headcount, exactly (`:301`–`:304`):

> The exact number, not a range — several rules turn on a specific headcount (25, 50, 100), so a
> range cannot answer them.

Button: **Save changes** / `Saving...` (`:333`–`:336`). Success banner: **✓ Profile saved
successfully** (`:330`), cleared after 3s (`:123`).

**The reads.** One `GET /api/account` (`:73`), whose body is `companies.*` plus
`profiles.full_name` (`app/api/account/route.ts:43`–`:57`). Seven of the fourteen `companies`
columns are shown; the other seven (`chemicals`, `extra_profile`, `created_at`, `website_url`,
`scan_result`, `pre_completed_items`, `obligations_computed_at`) arrive in the response body and
are not rendered. A second read, `GET /api/industries` (`:38`), fills the industry dropdown.

**The write.** `PUT /api/account` (`:107`), handled at `app/api/account/route.ts:69`. It updates
**`companies`** (`name, industry, state, county, city, employee_count` — `:100`–`:110`) on the
caller's own client, then **`profiles`** (`full_name` — `:117`) on the same client. Client-side
validation first: all six starred fields non-empty (`app/account/page.tsx:95`) and the headcount
a whole number (`:99`); the route re-validates the headcount (`app/api/account/route.ts:88`–`:95`)
and refuses a blank company name with a 400 (`:78`).

**So: everything on this panel is editable by any signed-in person at the company, including the
company name.** See §C2 — the owner's rule says the company name should not be.

---

#### Panel 2 — "Change Password" (`:342`–`:376`)

Heading: **Change Password** (`:344`). Two fields: **New password** (`:347`, placeholder
`At least 6 characters`) and **Confirm new password** (`:356`, placeholder `Repeat new password`).
Button: **Change password** / `Changing...`. Success: **✓ Password changed successfully** (`:367`).

**It touches no route and no table.** `handleChangePassword` (`:131`) calls
`supabase.auth.updateUser({ password })` (`:139`) from the browser, against `auth.users`.
Validation: non-empty, ≥ 6 characters, and the two must match (`:134`–`:136`).

> **There is a `currentPassword` state variable (`:49`) that no input is bound to and nothing
> reads.** It is cleared on success (`:142`) and never set. **The old password is not asked for and
> not checked** — a live session is the whole of the authorisation.

---

#### Panel 3 — "Billing" (`:379`–`:403`)

Heading: **Billing**, sub-line **Manage your subscription and payment details** (`:381`–`:382`).

Then three blocks, all hardcoded in the JSX. Nothing here reads a table or a route.

- A green box: **CURRENT PLAN** / **CompliBoard — $199/month** (`:384`–`:385`).
- A grey box, **WHAT'S INCLUDED** (`:388`), a literal array at `:390`:
  `Unlimited compliance questions` · `Company Documents storage` · `HR Help module` ·
  `Compliance Calendar` · `Deadline reminders`.
- A disabled button: **Manage billing — Coming soon** (`:398`–`:401`).

See §G. **No row anywhere says this company is on a plan, and nothing in the product is gated by
one.** The `$199/month` is a string in a React component.

---

#### Panel 4 — "Cancel Account" (`:406`–`:475`)

Heading: **Cancel Account**, sub-line **Permanently delete your account and all your data**
(`:408`–`:409`).

A red box (`:410`–`:426`), headed **⚠️ This is permanent and cannot be undone**, then:

> There is no way to restore this account afterwards. We do not keep a copy. Everything below is
> destroyed for **everyone** on your company account, not only for you:

and seven bullets (`:418`–`:424`): every uploaded file and the folders holding them · every
document review, audit, and HR handbook audit · every checklist and checklist item · every calendar
event and deadline reminder · the compliance obligations and the evidence linked to them · the
company profile and saved audit templates · **every login on this company account, including
yours**.

A grey box (`:428`–`:440`), **Take your records first**, with a **Download my data** button
(`:435`) calling `GET /api/account/export` (`:160`) and handing the browser the returned JSON file
(`:165`–`:176`). Its sentence names "Company Documents" (`:432`) — see §H.

Then the two-step confirmation:

1. **Cancel my account** (`:443`) reveals the confirm block.
2. A line: *"To confirm, type your company name exactly as it appears on your profile: **{name}**"*
   (`:449`–`:452`), an input, and **Permanently delete my account** (`:462`) beside **Keep my
   account** (`:467`).

The delete button is disabled until the typed text equals `savedCompanyName` (`:463`) — the name
**as last loaded or last saved** (`:63`, `:79`, `:121`), deliberately not the editable field, so a
person who typed a new company name into panel 1 without saving still has to type the stored one.
The route checks the same thing again server-side against `companies.name`
(`app/api/account/route.ts:351`). **There is no modal, sheet or overlay** — it is an inline block
in the panel.

On success the page calls `supabase.auth.signOut()` (`:197`) and `router.push('/')` (`:198`), to
the marketing homepage. That is the one remaining `push('/')` for a signed-in person and it is
correct — there is no company and no session left (`tests/unit/dashboardView.test.ts:274`–`:279`).

---

### A1b. The signed-in person's rights on the two tables this page touches

Read from `docs/SCHEMA.md`, which is generated from the staging catalog with
`has_table_privilege`, never from the migration files.

**`companies`** (`docs/SCHEMA.md:768`):

| Role | Grants |
|---|---|
| `anon` | **nothing** |
| `authenticated` | DELETE, INSERT, SELECT, UPDATE |
| `service_role` | DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |

Policies: `companies_select` (SELECT, `id = auth_company_id()`) and `companies_update` (UPDATE,
same, with `WITH CHECK`). **There is no INSERT and no DELETE policy**, so `authenticated`'s
table-level INSERT and DELETE grants reach nothing — which is why `/api/signup` and `/api/account`
DELETE both need the service role. **This is the §3.6 shape exactly: a grant list says what was
added, not what a role holds** — and here the grant is wider than the policy, so RLS is the only
thing closing it.

**`profiles`** (`docs/SCHEMA.md:2589`):

| Role | Grants |
|---|---|
| `anon` | **nothing** |
| `authenticated` | DELETE, INSERT, SELECT |
| `service_role` | DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |

Policies: `profiles_select` (SELECT, `company_id = auth_company_id()` — **the whole company's
people, not just you**) and `"Users can update own profile"` (UPDATE, `auth.uid() = id`).

**UPDATE does not appear in the grant list and the policy still works**, which looks wrong and is
not: migration `080_dashboard_counters.sql:392`–`:393` does

```sql
revoke update on table public.profiles from authenticated;
grant update (full_name, welcomed_at) on table public.profiles to authenticated;
```

A **column-level** grant, which `has_table_privilege` does not report. So a person may write
exactly two columns of their own `profiles` row — `full_name` and `welcomed_at` — and **may not
write `company_id`**, which is what `auth_company_id()` reads and therefore what decides tenancy
for every policy in the database (080's own reasoning, `:353`–`:354`). A BEFORE UPDATE trigger
`profiles_person_update` → `profiles_guard_person_update` (`docs/SCHEMA.md:2621`) refuses any
change to `welcomed_at` once it is set.

`authenticated`'s table-level **INSERT and DELETE on `profiles` are open as a grant and closed only
by the absence of a policy** — recorded as owed at `docs/HANDOFF-FROM-DASHBOARD.md:259`–`:261` and
item 4 of its owed list (`:303`).

---

### A2. The screenshot and the measurement

`npm run measure -- /account --as testgamma@example.com --shot shots/account-today.png`, against
`http://localhost:3000` (the owner's dev server, pointed at staging per §3.8). The tool blocks every
non-GET `/api/` request and every non-GET Supabase request before it leaves the browser
(`scripts/measure-layout.mjs:166`–`:185`), so `PUT /api/account` and `DELETE /api/account` could not
have fired. It printed `BLOCKED (0)`.

Saved to **`shots/account-today.png`** (§3.11: `shots/`, never `.next/shots/`).

```
  /account at 1280px (vertical scrollbar 15px) as testgamma@example.com
  title            x=385   "My Account"
  column box       295–1195 (900)
  column content   319–1171
  tab row          none
  footer content   319–1171   text starts x=319
  top bar          height 57px   logo 16–125 "CompliBoard"   breadcrumb none
  sidebar box      0–224 (224)
    ...
    y= 362– 402  x=12  Company information    5
    y= 406– 446  x=12  My Account                 rgb(37, 101, 65) w500  underline
    rule           y=347  x=24–199 (175)
  drawer           none open
```

**`docs/HANDOFF-WORKSPACE.md:550` records `/account | 385 | 319`. Confirmed, unchanged.**

Two things the numbers say that the brief did not ask for and that matter later:

- **`tab row  none`.** The measuring tool's "tab row" is the shared `components/Tabs.tsx`. This
  page's four tabs are hand-rolled markup inside the page (`app/account/page.tsx:232`–`:243`), so
  they are not the product's tab component. **(judgement)** Any rebuild that wants the standard tab
  row is changing markup, not adding a prop.
- **The headcount field photographed empty for Test Gamma**, although it is marked required. A
  company created by `/api/signup` has `employee_count` NULL by construction — signup does not ask
  (`app/signup/page.tsx:177`) — so **every account begins with a required field blank**, and panel 1
  cannot be saved at all until it is filled.

The industry dropdown renders the raw slug `chemical-manufacturing` as its own label
(`app/account/page.tsx:275`): `<option key={slug} value={slug}>{slug}</option>`. There is no
plain-words map for industries anywhere in `app/` or `lib/`.

---

### A3. Tests that touch the page or its route

**No test exercises the page or the route.** Every reference below is a *source-text* assertion —
`readFileSync` on the file, then a regex — which is a check that a line still exists, not a check
that the behaviour works. There is **no `check:live` probe for `/account`** (`grep -n account
scripts/check-live.js` returns one hit, at `:1166`, in an unrelated comment) and no golden file.

| File:line | What it asserts |
|---|---|
| `tests/unit/storage.test.ts:38`–`:44` | `listCompanyObjects` still walks **exactly two levels** (`.list(` appears twice), which is what makes `<company>/handbooks/<file>` safe to delete |
| `tests/unit/calendarIcs.test.ts:293`–`:295` | `calendar_feed_tokens` is still absent from the export and still present in the delete list |
| `tests/unit/calendarShell.test.ts:665`–`:683` | the export still uses `.from(table).select('*')`; `calendar_events` and `calendar_mailings` are exported; the feed token is not, and the reason is still in the file; all three are in the delete list |
| `tests/unit/hrGoLive.test.ts:34`–`:35` | `hr_audits` is still named in both the delete route and the export |
| `tests/unit/dashboardView.test.ts:277`–`:280` | `app/account/page.tsx` still does `signOut()` then `push('/')` |
| `tests/unit/dashboardView.test.ts:319` | `/account` is still one of the eight sidebar hrefs |

The real gate on this route is not a test at all: **`scripts/check-schema-contracts.js` CHECK 2**
(`:219`–`:233`) reads `app/api/account/route.ts`, extracts `COMPANY_SCOPED_TABLES` and
`DELETED_BY_CASCADE_OR_PARENT`, and **fails the build naming any relation carrying a `company_id`
that is in neither list**. It runs inside `npm run check`. It has caught the same omission at least
three times, each time named in the route's own comments (`app/api/account/route.ts:255`, `:265`,
`:282`).

---

## B. THE PERSON

### B1. `profiles` — columns and who writes each

`docs/SCHEMA.md:2589`. Five columns. **Five rows on staging.**

| Column | Type | Null | Written by |
|---|---|---|---|
| `id` | uuid | no | `app/api/signup/route.ts:59`, service role — it is the `auth.users` id |
| `company_id` | uuid | yes | `app/api/signup/route.ts:59`, service role, **once**. No other writer exists, and `authenticated` cannot write it at all (migration 080) |
| `full_name` | text | yes | `app/api/signup/route.ts:59` writes `''`; **`app/api/account/route.ts:117`** is the only place a person changes it |
| `created_at` | timestamptz | yes | default `timezone('utc', now())` |
| `welcomed_at` | timestamptz | yes | **`app/dashboard/page.tsx:199`**, by the person's own client, once; the trigger refuses any later change |

FKs: `company_id` → `companies` **ON DELETE NO ACTION** (which is why `profiles` is last in the
delete loop), `id` → `auth.users` **ON DELETE CASCADE**.

**There is no `email` column on `profiles`.** The address lives on the login in `auth.users` and is
read through the admin API — stated in the job that needs it,
`app/api/jobs/calendar-month/route.ts:104`–`:106`.

The grant after 080 is the column grant quoted in §A1b: `full_name` and `welcomed_at`, nothing else.

**Who writes what, summarised:** signup creates the row (service role); the Account route sets
`full_name`; the Dashboard sets `welcomed_at`. That is the whole of it.

### B2. Email and password — what a person can change today

**Password: yes, three ways, all through Supabase Auth from the browser. None of them asks for the
current password.**

| Where | Line | Call |
|---|---|---|
| My Account → Change Password | `app/account/page.tsx:139` | `supabase.auth.updateUser({ password })` |
| `/forgot-password` | `app/forgot-password/page.tsx:21` | `resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })` |
| `/reset-password` | `app/reset-password/page.tsx:43` | `updateUser({ password })`, gated on the `PASSWORD_RECOVERY` auth event (`:19`–`:23`), then `push('/dashboard')` after 2s (`:46`) |

Minimum length is **6**, asserted identically in two places (`app/account/page.tsx:135`,
`app/reset-password/page.tsx:32`). Supabase's own project setting is not in this repository.

**Email: no. There is no way to change it.** `grep` finds no `updateUser({ email` and no
`auth.admin.updateUserById` anywhere in `app/` or `lib/`. The address is set once, at
`app/api/signup/route.ts:29`–`:33` (`admin.createUser({ email, password, email_confirm: true })`),
and that is the only write to it in the product. **`email_confirm: true` means the address is
marked confirmed without ever being sent to** — nobody has proved they can receive mail at it.

**What emails this sends, and from which sender.**

- The password-reset email at `app/forgot-password/page.tsx:21` is **sent by Supabase Auth**, from
  whatever sender that project is configured with. It does not go through Resend and it does not go
  through `lib/email.ts`. **No file in this repository says what that sender is** — it is a
  dashboard setting, the same class of fact as §3.4a's model variables. **(hypothesis, and it is
  the right kind to check outside the repo rather than guess at: a Supabase project with no custom
  SMTP sends from Supabase's own shared address, which is rate-limited and lands in spam.)**
- **`NOTIFY_TEST_TO` does not apply to it.** That variable is read in exactly four places —
  `app/api/jobs/calendar-month/route.ts:70`, `lib/auditNotify.ts:90`, `lib/handbookCheckNotify.ts:65`,
  `lib/documentBatch.ts:168` — all four Resend sends, none of them auth. **So on staging, a password
  reset typed into `/forgot-password` sends a real email to a real address.** The staging guard that
  makes every other email safe does not cover this one.
- The product's own four emails all go through Resend from `SANDBOX_FROM`
  (`lib/email.ts:176`), which is `CompliBoard <onboarding@resend.dev>` (`lib/email.ts:173`) —
  Resend's shared sandbox address. `sandboxSenderRefusal` (`lib/email.ts:183`) refuses a production
  send while that is still the `from:` (`app/api/jobs/calendar-month/route.ts:85`–`:92`).

### B3. Sign-in and sign-up

**Sign-in** — `app/login/page.tsx`. Email + password → `signInWithPassword` (`:24`) →
`router.push('/dashboard')` (`:34`). Links to `/signup` (`:92`) and `/forgot-password` (`:95`).

**Sign-up** — `app/signup/page.tsx`, posting to `/api/signup` (`:165`). The body sends
`county: ''` and `employeeCount: null` (`:174`, `:177`) because signup asks for neither.

**What a signup creates, in order** (`app/api/signup/route.ts`):

1. **The auth user** — `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`
   (`:29`).
2. **The company** — one `companies` insert (`:37`–`:54`) with `name, industry, state, county, city,
   employee_count, website_url, scan_result`.
3. **The primary site** — **not written by this route.** The `AFTER INSERT` trigger
   `create_primary_site` on `companies` (`supabase/migrations/010_every_company_has_a_site.sql:100`,
   function at `:69`) inserts one `entities` row in the same statement: `entity_type = 'site'`,
   `is_primary = true`, and the name `"<company> — <city>"`, or just the company name where there is
   no city (`:79`–`:83`). 010's own comment says why it is a trigger and not route code: *"/api/signup
   is three inserts with no transaction, and a site created by the third one is a site that can
   silently fail to exist."*
4. **The profile** — one `profiles` insert (`:57`–`:59`): `{ id: user.id, company_id: company.id,
   full_name: '' }`.

Then the browser signs in (`app/signup/page.tsx:186`) and lands on `/dashboard` (`:195` or `:207`).

**What happens if it fails halfway. There is no transaction and no rollback** — the route is a
single `try` whose `catch` returns a 500 (`app/api/signup/route.ts:63`–`:68`). Three outcomes:

| Fails at | What is left behind | What the person sees |
|---|---|---|
| `createUser` (`:34`) | nothing | the error message, as a 500 body |
| the `companies` insert (`:55`) | **an auth user with no profile and no company** | a 500. They can now sign in at `/login`, and every page bounces: `requireCompany` returns **404 "Company not found"** (`lib/auth.ts:106`–`:111`) because `profiles` has no row. **There is no route that repairs this and no way for them to retry** — `createUser` with the same email fails as a duplicate. |
| the `profiles` insert (`:60`) | **an auth user, a company and a primary site, all orphaned** | the same 500, the same dead account, plus a `companies` row and an `entities` row that no login reaches and no deletion path can ever find — `/api/account` DELETE is reachable only through `requireCompany`. |

---

## C. THE COMPANY

### C1. `companies` — columns, what is shown, what is editable

`docs/SCHEMA.md:768`. Fourteen columns. **Six rows on staging.**

| Column | Shown anywhere? | Editable by a person? |
|---|---|---|
| `id` | no | — (it is the tenant key) |
| `name` | **yes, everywhere** — see below | **My Account panel 1** and **Company information** |
| `industry` | My Account (raw slug), Company information | both |
| `state` | My Account, Company information | both |
| `county` | **My Account only** | **My Account only** |
| `city` | My Account, Company information | both |
| `employee_count` | **My Account only** | **My Account only** |
| `chemicals` (text) | **no** | no — **nothing in `app/` or `lib/` reads or writes it** |
| `extra_profile` (jsonb) | **no** | no — **no reader, no writer** |
| `created_at` | no | — |
| `website_url` | no | written once at `app/api/signup/route.ts:50`; **no reader** |
| `scan_result` (jsonb) | no | written once at `:51`; read by `lib/companyContext.ts:233` |
| `pre_completed_items` (jsonb) | **no** | no — **no reader, no writer** |
| `obligations_computed_at` | no | written by `lib/obligationWriter.ts:164`, read by `app/api/obligations/route.ts:43` |

**Two of the fields on My Account go nowhere else.**

- **`county`** is read by exactly one thing: `lib/obligationWriter.ts:98` selects
  `id,name,state,county,city,industry`. So it does reach resolution.
- **`employee_count` is read by nothing but My Account itself.** `grep -rn "employee_count" app lib
  components prompts scripts` (excluding `lib/database.types.ts` and the unrelated
  `site_employee_count`) returns five hits: the signup write (`app/api/signup/route.ts:49`), the
  Account route's write (`app/api/account/route.ts:109`), the Account page's read
  (`app/account/page.tsx:86`), and two comments. `lib/obligationWriter.ts:98` does **not** select
  it; `lib/companyContext.ts:233` selects `name, industry, city, state, scan_result` and does
  **not** select it. **The fact that actually drives employment thresholds is the `switches` row
  `employee_count` ("Employees, enterprise-wide", `supabase/seed-data/switches.json`), answered into
  `company_switches`** — a different column in a different table, reached from a different page. See
  §I.

**Who can edit `companies`, and how.** Two routes, both on the caller's own client under
`companies_update`:

1. **`PUT /api/account`** (`app/api/account/route.ts:98`–`:111`) — six columns at once, all or
   nothing, every one required by the page.
2. **`POST /api/company-information`** with `action: 'company'`
   (`app/api/company-information/route.ts:155`–`:177`) — **four columns only**: `name`, `industry`,
   `city`, `state` (`:157`). It is the better-behaved of the two: it patches only the fields present
   in the body (`:158`), refuses a blank name with a sentence a person can act on —
   *"Your company needs a name — it heads every report and every email we send."* (`:163`) — and
   stores `''` as NULL for the other three (`:168`), §21.1's rule. **It cannot change `county` or
   `employee_count` at all.**

**Every place `companies.name` is read:**

| Where | File:line | For |
|---|---|---|
| the top bar | `components/AppLayout.tsx:173`–`:178`, drawn at `:367` | the name beside "Log out" on every signed-in page |
| the print frame | `app/calendar/page.tsx:294`, `app/audits/page.tsx:307`, `app/compliance/page.tsx:310`, `app/documents/page.tsx:291`, `app/hr/HrWorkspace.tsx:272` → `printWithFrame({ company, … })` (`lib/printFrame.ts:70`, margin box at `:46`) | the uppercase name in the top-left margin of **every printed page** |
| the monthly email | `app/api/jobs/calendar-month/route.ts:115`, into `calendarEmail({ company: co.name, … })` (`:151`) | the subject and heading |
| the company brief | `lib/companyContext.ts:233` | **what every prompt is told the company is called** |
| the obligation writer | `lib/obligationWriter.ts:98` | resolution context |
| document scanning | `app/api/document-scan/route.ts:75`, `app/api/jobs/scan-documents/route.ts:193`, `:367` | the scan's context and the batch email |
| audit runs | `app/api/audit-runs/route.ts:64` | the report header |
| the export | `app/api/account/export/route.ts:165` | **the filename**, via `slugify` (`:35`) |
| the delete confirmation | `app/api/account/route.ts:345`, compared at `:351` | **the string a person must type to destroy the account** |

### C2. The owner's rule, recorded

> **The company name is tied to the company id and is not editable from My Account.**

The source is `docs/HANDOFF-FROM-DASHBOARD.md:254`–`:257`, written at the Dashboard's close-out:

> **The owner's note: the company name is tied to the company id and should not be editable on My
> Account.** The name identifies the tenant everywhere — the topbar, every audit report's header,
> the print frame's margin. Editing it from a personal account screen is the wrong door. If it is to
> be editable at all, it belongs on Company information, which already owns the company record.

**What today's code lets a person change, and where.** The rule is **not** implemented. Any
signed-in person at the company can rename it from **My Account panel 1**
(`app/account/page.tsx:260` → `PUT /api/account` → `app/api/account/route.ts:101`), and
independently from **Company information** (`app/api/company-information/route.ts:157`). Two doors
into one column, with different validation on each: My Account requires six fields to be present
before it will send anything (`app/account/page.tsx:95`) and refuses a blank name with a generic
*"Please fill in all required fields"*; Company information patches one field and refuses a blank
name with the sentence quoted above.

**And a rename has a consequence nothing handles**: the primary site's name is derived from the
company name **once**, by the trigger, at company-insert time
(`supabase/migrations/010_every_company_has_a_site.sql:79`–`:83`). Nothing re-derives it. Rename the
company and the site keeps the old name — in the Calendar's site filter, the Documents site filter,
the HR site picker and the `entities` rows the obligation writer reads. See §I.

---

## D. SITES (ENTITIES)

### D1. `entities` — columns, who creates one, who reads them

`docs/SCHEMA.md:1731`. Fifteen columns. **Seven rows on staging.**

`id` · `company_id` (NOT NULL → `companies` **ON DELETE CASCADE**) · `entity_type` (enum
`entity_scope`, NOT NULL) · `name` (NOT NULL) · `parent_entity_id` (→ `entities`, SET NULL) ·
`is_primary` (NOT NULL, default `false`) · `details` (jsonb, default `{}`) · `created_at` ·
`updated_at` · `state` · `county` · `city` · `address` · `postal_code` · `fire_authority`.

Grants: `anon` nothing; `authenticated` **DELETE, INSERT, SELECT, UPDATE** — and unlike `companies`
and `profiles`, **all four have policies** (`entities_select`, `entities_insert`, `entities_update`,
`entities_delete`, each `company_id = auth_company_id()`). So at the database layer a signed-in
person may freely create, rename and delete sites.

**How a site is created today: by one trigger, and by nothing else.**

`grep -rn "from('entities')" app lib` returns 22 call sites and **not one of them is an insert**.
Every `insert into public.entities` in the repository is inside a migration — 010's trigger and
backfill, and nine later migrations' own test fixtures. So:

- **The only site any customer has is the primary one**, created by `create_primary_site`
  (`supabase/migrations/010_every_company_has_a_site.sql:100`) when the company row is inserted.
- **There is no way to add a second site.** No page, no route, no form. The seven staging rows exist
  because `scripts/seed-multisite-fixture.js` and `scripts/seed-staging-testdata.js` put them there.
- **There is no way to rename, relocate or delete a site either** — the grants and policies allow
  it, nothing offers it.

**What reads sites.** Twenty-two call sites. The ones that matter:

| Reader | File:line | What it does with them |
|---|---|---|
| the Calendar page | `app/calendar/page.tsx:240` | a site filter, drawn **only when `sites.length > 1`** (`:749`) |
| the Dashboard | `app/dashboard/page.tsx:105` | `siteCount` decides whether a site is named anywhere on the page (`:100`–`:102`) |
| the Documents page | `app/documents/page.tsx:808` | the site filter, same `sites.length > 1` rule |
| the HR workspace | `app/hr/HrWorkspace.tsx:271` | the site picker |
| the monthly email | `app/api/jobs/calendar-month/route.ts:148` | `siteCount`; `lib/calendarEmail.ts:112` groups by site **only when `siteCount >= 2`**, and with one site `siteWords` returns `''` |
| the switch routes | `app/api/switches/answer/route.ts:66`, `ask/route.ts:44` | ownership check on a site-scoped answer |
| the obligation writer | `lib/obligationWriter.ts:99` | `id,name,state,county,city,fire_authority,is_primary` — **site-level jurisdiction for resolution** |
| the company brief | `lib/companyContext.ts:234` | the sites in every prompt's context |
| Audits / Documents / to-confirm | `app/api/audits/index/route.ts:42`, `app/api/documents/index/route.ts:50`, `app/api/to-confirm/route.ts:94` | the site column and filter |

**Decision 24, verbatim** (`docs/CALENDAR-PLAN.md:56`):

> **Sites.** A date inherits the site of whatever found it; "Every site" is a real value (`entity_id`
> null). With one site nothing about sites shows, as in HR. A document-sourced date's site is read
> live from the document through the view, never copied, so a correction or a removed site in
> Documents or HR reaches the calendar with no new code there. *Effect: none. **For the My Account
> chat: when a second site is added, ask once which documents and dates marked for every site belong
> to the first site only.*** 

**The "ask once" rule is not built.** Nothing in `app/`, `lib/` or `supabase/migrations/` mentions
it; there is no column recording that the question was asked and no place to ask it from, because
there is no way to add a second site in the first place.

The site-scoped half of the switch vocabulary is live, though: `app/api/switches/answer/route.ts:60`
refuses a site-scoped fact with no site — *"This question is about one site. Tell us which one."* —
and **defaulting to the primary site is explicitly forbidden** (`:57`–`:58`, §20 / WORKSPACE v3.3).
CLAUDE.md §1 says **73 of the 95 switches are site-scoped**.

### D2. What "ask once when a second site is added" would need

**Thirteen tables carry an `entity_id` today** (every `### ` heading in `docs/SCHEMA.md` with an
`entity_id` column):

`audit_runs` · `calendar_events` · `company_chemicals` · `company_facts` · `company_switches` ·
`document_reviews` · `document_scans` · `documents` · `fact_proposals` · `handbooks` ·
`obligation_evidence` · `obligations` · `switch_determinations`

The two the question is actually about are **`calendar_events.entity_id`** (→ `entities`, **ON
DELETE SET NULL**) and **`documents.entity_id`** (→ `entities`, **ON DELETE SET NULL**). On both,
**NULL is a real value meaning "every site"**, not "unknown" — decision 24's first sentence. That is
what makes the question necessary: a single-site company's rows are all NULL, and when a second site
arrives nobody can tell which of those NULLs meant *everywhere* and which meant *the only place
there was*.

**Rows that carry no site at all, and therefore cannot be re-pointed:** `checklists`,
`checklist_items`, `topics`, `turns`, `corrections`, `company_templates`, `hr_audits`,
`document_batches`, `document_corrections`, `document_gaps`, `document_conditions`,
`document_deadlines`, `company_labels`, `audit_sections`, `audit_findings`, `handbook_sections`,
`handbook_checks`, `handbook_check_sections`, `handbook_findings`, `handbook_dates`,
`calendar_mailings`, `calendar_feed_tokens`, `jobs`, `usage_counters`, `ai_calls`, `company_folders`.
Some of these reach a site through a parent (`handbook_*` through `handbooks.entity_id`,
`audit_sections`/`audit_findings` through `audit_runs.entity_id`, `document_*` through
`documents.entity_id`); the rest genuinely have no site and never will.

**(judgement)** So the work is: a way to add a site at all; a stamp recording that the question has
been asked (there is no column for it today); and a screen that walks `calendar_events` and
`documents` with `entity_id IS NULL`. The first of those three is the one that does not exist in any
form.

---

## E. PEOPLE

### E1. How a second person joins a company today

**They cannot. There is no invite, no join code, and no second way in.**

- `auth.admin.createUser` appears **once** in the whole product — `app/api/signup/route.ts:29` — and
  that route **always creates a new company** (`:37`) and a new profile pointing at it (`:59`). So
  every signup is a new tenant. CLAUDE.md §3.6 says this in the same words: *"What is missing is an
  invite route, not a schema change; `/api/signup` creates a new company every time."*
- `grep -rniE "\binvite|join_code|\bteam\b|membership"` over `app lib components` returns **no
  feature** — only the word "invites" in prose comments and "colleague" in three comments describing
  a state the schema supports and the product does not create.
- There is no page listing the people at a company, and nothing that adds or removes one.

**What ties a login to a company:** `profiles.company_id`, written once by the service role at
`app/api/signup/route.ts:59`. Nothing else ever writes it, and since migration 080 `authenticated`
**cannot** (`080_dashboard_counters.sql:392`–`:393`). Every route reaches it through
`requireCompany` (`lib/auth.ts:100`–`:104`), which reads it on the **admin** client deliberately
(`:96`–`:99`), and every RLS policy reaches it through `public.auth_company_id()`
(`docs/SCHEMA.md:3153`). **42 route files call `requireCompany`.**

**Who can see the list of people:** anyone signed in at that company. `profiles_select` is
`company_id = auth_company_id()` (`docs/SCHEMA.md:2614`) — company-wide, not self-only. It was
widened to that by migration 005 **for the export's sake**, and the export route says so
(`app/api/account/export/route.ts:20`–`:23`). Two things read the list today:
`app/api/account/export/route.ts:121`–`:124` (`id, company_id, full_name, created_at` — **no email,
nothing from `auth`**) and `app/dashboard/page.tsx:106` (`id, full_name`, to put a name behind a
typed calendar date). **Neither is a "people on your account" screen; there is no such screen.**

### E2. The monthly calendar email

`app/api/jobs/calendar-month/route.ts`, on `vercel.json` cron `0 14 1 * *` — 14:00 UTC on the 1st.

**Recipients.** Every `profiles` row with a `company_id` (`:102`), grouped by company (`:107`–`:110`),
then **each person's address read from `auth.users` one at a time** through
`supabaseAdmin.auth.admin.getUserById(p.id)` (`:156`–`:160`). A profile whose login has no email is
skipped; a company with no addresses is stamped `error: 'no login on any profile at this company'`
on its claim row (`:165`–`:169`) rather than silently passed over.

**There is no opt-out of any kind.** No column on `profiles`, none on `companies`, none on
`calendar_mailings`; no unsubscribe link in `lib/calendarEmail.ts` or `lib/email.ts`; no setting on
any page. Every person with a profile at a company that has a date due this month gets the email.
**`calendar_mailings` is a claim against sending twice, not a preference** — UNIQUE
`(company_id, month)`, inserted *before* the render (`:127`–`:133`) exactly so a crash cannot cause
a second send.

**Three guards stand between this job and a customer's inbox:**

1. `requireCronSecret` (`:64`) — a 404 without it, writing nothing.
2. `NOTIFY_TEST_TO` (`:70`) — when set, it **is** the `To` (`:175`); the real recipients go in the
   log line and onto the row, never in the To. It is absent on production by design
   (`docs/RELEASE.md:279`).
3. `sandboxSenderRefusal` (`:85`) — on production, with `from:` still Resend's sandbox address, the
   run stops **before the claim and before the render**, returns 503, and writes the refusal onto
   its `job_runs` row. A dry run is let through on purpose and reports `would_be_refused`.

---

## F. DELETING THE ACCOUNT

`DELETE /api/account` — `app/api/account/route.ts:329`–`:450`. **It deletes the whole company, not
the person.** The page says so in those words (`app/account/page.tsx:414`–`:416`): *"Everything
below is destroyed for **everyone** on your company account, not only for you."*

**Confirmation, in two places.** On the page: the two-step inline block described in §A1 panel 4,
with the delete button disabled until the typed text matches `savedCompanyName`
(`app/account/page.tsx:463`). In the route: `confirmation` from the body must equal
`companies.name` exactly or it returns **400 and touches nothing** (`:351`–`:360`). **No modal, no
sheet, no second screen, and no grace period.**

**Which client.** `supabaseAdmin`, for three named reasons set out in the route's own header
(`:16`–`:26`): `auth.admin.deleteUser` is an admin API no user token can reach at any privilege
level; the handler deletes rows for **every** member of the company; and there is deliberately no
DELETE policy on `companies`. §3.6 allows a route to hold the service role for a named reason, and
this is the reason.

**The order, exactly:**

| # | Step | Line |
|---|---|---|
| 0 | `requireCompany` → `companyId` from the session, never the body | `:331`–`:333` |
| 1 | read `confirmation` from the body (a bad body is `undefined`, not a throw) | `:335`–`:341` |
| 2 | read `companies.name`; **404** if the company is gone | `:343`–`:349` |
| 3 | compare → **400, nothing deleted** on a mismatch | `:351`–`:360` |
| 4 | collect every `profiles.id` at the company — the people to un-log-in later | `:364`–`:368` |
| 5 | **storage files first**, and a failure here **stops everything** | `:370`–`:376` |
| 6 | `checklist_items` by `checklist_id` | `:379`–`:384` |
| 7 | `obligation_evidence` by `obligation_id` | `:386`–`:391` |
| 8 | **count** `turns`, `topics`, `fact_proposals`, `usage_counters` before they go | `:400`–`:405` |
| 9 | the 26-table loop, children before parents | `:407`–`:410` |
| 10 | one `job_runs` row, `job: 'account_delete'`, counts + `company_id` | `:415`–`:425` |
| 11 | the `companies` row | `:427`–`:429` |
| 12 | **logins last** — `auth.admin.deleteUser(id)` per person | `:432`–`:434` |

Two of those orderings are deliberate and worth keeping:

- **Files before rows** (`:370`–`:371`): *"a customer who asked to be deleted should not be left with
  their files in the bucket and their records gone."* `listCompanyObjects` (`:134`) walks exactly
  two levels, `<company_id>/<folder>/<file>` — which is why `lib/storage.ts` must never store a
  handbook deeper, and why `tests/unit/storage.test.ts:38` asserts the two levels.
- **Logins last** (`:431`): *"so a failure above leaves the account still reachable."*

**The 26-table loop, in its order** (`COMPANY_SCOPED_TABLES`, `:189`–`:234`): `fact_proposals`,
`turns`, `topics`, `usage_counters`, `checklists`, `corrections`, `obligations`, `company_switches`,
`entities`, `document_reviews`, `audits`, `company_templates`, `hr_audits`, `handbook_findings`,
`handbook_check_sections`, `handbook_checks`, `handbook_dates`, `handbook_sections`, `handbooks`,
`calendar_events`, `calendar_mailings`, `calendar_feed_tokens`, `documents`, `company_folders`,
`jobs`, `profiles`.

Three of those are named **because the cascade would not save them**: `profiles` and `hr_audits` are
**ON DELETE NO ACTION** and would block the company delete part-way through; **`corrections` is ON
DELETE SET NULL and its rows would SURVIVE with a null `company_id`** — orphaned customer data left
behind by a deletion the customer asked for (`:183`–`:188`).

**What it deliberately leaves to the cascade** (`DELETED_BY_CASCADE_OR_PARENT`, `:238`–`:326`) —
every one verified `confdeltype = c` in `pg_constraint` on a stated date, not assumed:
`document_scans`, `document_gaps`, `document_conditions`, `document_deadlines`, `company_labels`,
`document_corrections`, `audit_runs`, `audit_sections`, `audit_findings`, `company_facts`,
`document_batches`, `ai_calls`, `checklist_items`, `obligation_evidence`, `switch_determinations`,
`company_chemicals`, `critic_reviews`, `critic_findings`. The distinction the comments draw
repeatedly: the loop is *the customer deleting their own rows*; this list is *our reading of the
customer, which goes because the thing it describes is gone*.

**What survives the deletion:** the `job_runs` row written at `:415`. It carries `company_id` and the
four counts and nothing else — *"The company id is recorded rather than the name: the row outlives
the company, and a name is not an identifier"* (`:412`–`:413`). A failure to write it is logged and
**does not fail the deletion** (`:423`–`:425`).

**What is not deleted and is not meant to be:** nothing else carries a `company_id`.
`scripts/check-schema-contracts.js` CHECK 2 fails the build if any relation does and is in neither
list.

**After the response**, the page signs out (`app/account/page.tsx:197`) and goes to `/` (`:198`).

---

## G. BILLING — WHAT EXISTS

### G1. The grep

```
$ grep -rni "stripe" --include="*.ts" --include="*.tsx" --include="*.sql" \
    --include="*.js" --include="*.mjs" --include="*.json" --include="*.example" . \
    | grep -v node_modules | grep -v "^./docs/"
(no output)
```

**Zero hits outside `docs/`.** No dependency in `package.json`, no key in `.env.example`
(whose 31 variables are: `ANTHROPIC_API_KEY`, thirteen Supabase values, `RESEND_API_KEY`,
`FEEDBACK_EMAIL`, ten `AI_*`, `HR_ANSWER_USES_CHECK`, `NEXT_PUBLIC_APP_URL`, `NOTIFY_TEST_TO`,
`TURN_SIGNING_SECRET`, `CRON_SECRET`), no route, no table, no webhook. `vercel.json` holds seven
crons and nothing else. The only `docs/` mention is the platform backlog line,
`docs/TODO.md:2402`: *"**Platform** — Stripe, Drive OAuth, domain, Framer homepage, PDF export…"*

The wider grep (`billing|subscription|plan|price|invoice|customer_id|trial|paywall`) returns hits
that are all one of four things, none of them billing:

| Hit | What it actually is |
|---|---|
| `app/account/page.tsx:30, 208, 228, 378`–`:401` | **the Billing tab itself** — four hardcoded strings and a disabled button (§A1 panel 3) |
| `app/page.tsx:20, 38, 96, 193, 266, 287` | **the marketing homepage.** "Start free trial →" ×4, "Start your 14-day free trial →" once, and a feature card reading *"My Account — Manage your profile, billing, and account settings"* |
| `app/calendar/page.tsx:974`, `app/api/calendar/feed/route.ts`, `lib/calendarIcs.ts`, `components/SendCalendarSheet.tsx`, `app/reset-password/page.tsx:19` | **"subscription" meaning a calendar feed, or an RxJS-style auth subscription.** Nothing to do with money |
| `lib/ai.ts:488, 872, 926, 962`, `supabase/migrations/038_ai_calls_ledger.sql`, `config/pricing.ts` | **what Anthropic bills US.** The `ai_calls` cost ledger — our spend, never a customer's |

### G2. Is there a plan, status, trial or subscription column?

**No — not on `companies` and not on any of the 53 tables in `docs/SCHEMA.md`.** `companies` has
fourteen columns (§C1) and not one of them is about money, entitlement, or an account state.
`grep -rniE "\b(plan|price|subscription|trial|customer_id|billing)\b" supabase/migrations/*.sql`
returns only prose in comments and the words "Emergency Action Plan" / "O&M plan" inside test
fixtures.

**And nothing in the app is gated by a plan.** There is no `middleware.ts` at the repo root, under
`app/`, or under `src/`. Access control is two layers and only two: a client-side
`supabase.auth.getUser()` guard on each page that bounces to `/login`
(`app/account/page.tsx:69`–`:70`, `app/dashboard/page.tsx:84`–`:85`, and so on), and
`requireCompany` + RLS on the 42 API routes. **Neither looks at anything but whether you are signed
in and which company you belong to.**

### G3. What a Stripe subscription would attach to **(judgement — this whole sub-section)**

**The natural key is `companies.id`**, and nothing else is a candidate:

- Tenancy is one company per user (§3.6, and `docs/SCHEMA.md:26`), so the company is the billable
  unit and a person is not.
- Every table carries `company_id`; `profiles` is the only link between a login and anything.
- `companies.id` is a stable UUID that is never rewritten, unlike `companies.name`, which two
  routes let any member change (§C1) and which is **already load-bearing in too many places**
  (the delete confirmation compares against it).
- `companies` already has a cascade from 45 relations and is the thing a deletion destroys, so a
  Stripe customer id on it would be removed by the same path that removes everything else.

**Where a gate would be read.** There are three candidate chokepoints and they are not equivalent:

| Place | Covers | Cost |
|---|---|---|
| **`lib/auth.ts` `requireCompany`** | **all 42 API routes at once** — it already reads `profiles` on the admin client and returns the company | would also gate `/api/account` itself, so an unpaid customer could not export or delete their own data. **A gate here must have an explicit allow-list, or it breaks §5.1's promise and the deletion path.** |
| `components/AppLayout.tsx` | every signed-in **page**, one component | a UX affordance only — §3.6: *"RLS is the security boundary, not middleware."* It gates the screen, not the data |
| a new `middleware.ts` | everything, including static | there is none today; adding one means reading `node_modules/next/dist/docs/` first (AGENTS.md), and it cannot see RLS |

**The honest shape** is probably: a `stripe_customer_id` and a status column on `companies`, read
once in `requireCompany` and returned alongside `companyId` so each route decides; an allow-list
covering `/api/account`, `/api/account/export` and the auth pages; and `AppLayout` showing the
state. **None of that is a decision this map should make** — it is §9's "real architectural fork",
and it needs the owner.

---

## H. WHAT ELSE TOUCHES `/account`

**Links in.** Exactly one in the product: `components/AppLayout.tsx:88`,
`{ label: 'My Account', href: '/account', soon: false }` — the eighth and last sidebar item, **below
the hairline** with "Company information" (Dashboard decision 12, the reasoning at `:67`–`:73`).
`tests/unit/dashboardView.test.ts:319` asserts the eight hrefs. One more outside the app:
`app/page.tsx:287`, a marketing feature card naming "My Account" (not a link to it).

**Files importing from it.** None. `app/account/page.tsx` is a leaf: it exports one default
component and nothing imports it. It imports `@/lib/supabase` (`createClient`, `authHeaders`),
`@/components/AppLayout`, and `next/navigation`.

**Routes only this page calls.** Two:

- **`/api/account`** — GET, PUT and DELETE are called from nowhere else. `grep -rn "/api/account"`
  over `app components lib` (excluding the route's own folder) returns **four `fetch` call sites,
  all in `app/account/page.tsx`** — `:73` (GET), `:107` (PUT), `:160` (export), `:188` (DELETE) —
  and four comment mentions (`app/api/calendar/feed-token/route.ts:18`–`:19`, `lib/storage.ts:32`,
  `lib/auth.ts:24`).
- **`/api/account/export`** — one caller, `app/account/page.tsx:160`.

`/api/industries` is shared with `app/signup/page.tsx:79`.

**Jobs or routes writing something only this page reads.** Strictly: **`companies.employee_count`**,
written by `app/api/signup/route.ts:49` (always NULL in practice) and
`app/api/account/route.ts:109`, read by `app/account/page.tsx:86` and nothing else in the product
(§C1). Near-miss: **`companies.county`**, written only here and by signup, read only by
`lib/obligationWriter.ts:98`.

**Two sentences on this page name a section by a name the nav no longer shows.**
`components/AppLayout.tsx:50`–`:55` records it: the nav item became "Documents" at Dashboard step 5b,
and `app/account/page.tsx:390` (the Billing tab's "Company Documents storage") and `:432` ("save
those from Company Documents separately") still say the old words. They were left alone on purpose —
*"those sentences are the Calendar's and the Account page's to change"* — so **they are this
section's to fix.**

---

## I. BLOCKERS AND SURPRISES

One line each. Everything here is evidenced above.

1. **The headcount on this page feeds nothing.** `companies.employee_count` is read by
   `app/account/page.tsx:86` and by no other file; the fact resolution actually uses is the
   `employee_count` switch in `company_switches`, answered from Company information. §C1.
2. **…and it is a required field that every new account starts with blank**, because signup sends
   `employeeCount: null` (`app/signup/page.tsx:177`), so panel 1 cannot be saved until it is filled.
3. **The owner's rule about the company name is not implemented**, and there are *two* doors into
   that column with different validation on each — My Account and Company information. §C2.
4. **Renaming the company leaves the primary site named after the old one**, because
   `create_primary_site` derives the site name once at insert
   (`supabase/migrations/010_every_company_has_a_site.sql:79`) and nothing re-derives it.
5. **There is no way to add a second site.** Not one insert into `entities` exists outside the
   trigger and migration fixtures — so decision 24's "ask once when a second site is added" has
   nothing to hang on. §D1.
6. **There is no way to add a second person.** No invite, no join code; `/api/signup` always creates
   a new company. The schema supports colleagues and the product cannot create one. §E1.
7. **There is no way to change your email address**, and the one that is set was never verified —
   `email_confirm: true` at `app/api/signup/route.ts:32` marks it confirmed without sending to it.
8. **A password change does not ask for the current password**, and `currentPassword`
   (`app/account/page.tsx:49`) is a state variable no input is bound to.
9. **The password-reset email is the one email `NOTIFY_TEST_TO` does not cover.** It is sent by
   Supabase Auth, not Resend, so on staging it goes to a real address. §B2.
10. **Billing is four hardcoded strings.** `$199/month` is a literal in
    `app/account/page.tsx:385`; nothing records a plan and nothing is gated by one; the marketing
    homepage promises a 14-day free trial that no code implements. §G.
11. **A signup that fails at step 2 or 3 leaves a dead account with no repair path** — the person
    can sign in and every page 404s at `requireCompany`, and the email cannot be reused. §B3.
12. **`companies` and `profiles` both grant `authenticated` more than any policy lets it use** —
    INSERT and DELETE on both, closed only by the absence of a policy. Already on the owed list
    (`docs/HANDOFF-FROM-DASHBOARD.md:303`, item 4) for `profiles`; **`companies` is the same shape
    and is not on that list.**
13. **Four `companies` columns are dead:** `chemicals`, `extra_profile`, `pre_completed_items` have
    no reader and no writer in `app/` or `lib/`; `website_url` is written at signup and never read.
14. **Nothing tests this page or this route.** Six assertions exist and all six are `readFileSync` +
    regex against the source text; there is no `check:live` probe for `/account`. The one real gate
    is `check-schema-contracts.js` CHECK 2, and it only guards the delete list. §A3.
15. **The export route already promises a feature that does not exist**:
    *"Rotating it lives in My Account, where a person can see what they are replacing"*
    (`app/api/account/export/route.ts:102`), of `calendar_feed_tokens`. There is no such control on
    the page. Decision 20 says the same (`docs/CALENDAR-PLAN.md:52`).
16. **The industry dropdown shows raw slugs** (`chemical-manufacturing`), because
    `app/account/page.tsx:275` uses the slug as both value and label and no plain-words map exists.
17. **The page's tab row is hand-rolled markup, not `components/Tabs.tsx`** — which is why the
    measuring tool printed `tab row none`. §A2.
18. **Two sentences on the page still say "Company Documents"** after the nav renamed it, at
    `:390` and `:432`. §H.

---

## J. THIS RUN'S EFFECTS ON OTHER SECTIONS, BY FILE

**None. No file in the product was read-modified-written by this job.** The only file added is this
one, `docs/ACCOUNT-MACHINERY.md`, plus one screenshot at `shots/account-today.png`, which is
git-ignored (§3.11).

What later sections will have to change, if the findings above are acted on — named by file so they
are not discovered late:

| If this changes | These change with it |
|---|---|
| the company name stops being editable here | `app/account/page.tsx:260`, `app/api/account/route.ts:101`; **and `app/api/company-information/route.ts:157` becomes the only door, so its refusal sentence (`:163`) becomes the only one a person sees** |
| the headcount moves to the `employee_count` switch | `app/account/page.tsx:291`, `app/api/account/route.ts:87`–`:109`, `app/api/signup/route.ts:14`–`:19` and `:49`; the write would go through `/api/switches/answer`, as `app/api/company-information/route.ts:195` already does |
| a second site becomes addable | `supabase/migrations/010_…:69` (the name derivation), `app/calendar/page.tsx:749`, `app/documents/page.tsx:808`, `app/dashboard/page.tsx:109`, `lib/calendarEmail.ts:112` — every one of which branches on `sites.length > 1` and has never been exercised from a UI that creates the second site |
| a second person becomes invitable | `app/api/signup/route.ts` (it must stop always creating a company), `lib/auth.ts:100`, and `app/api/account/route.ts:362`–`:368`'s rule that deleting the company removes everyone |
| a billing gate is added | `lib/auth.ts:68` `requireCompany` is the one chokepoint over all 42 routes, and **`/api/account` and `/api/account/export` must be allow-listed** or an unpaid customer cannot take their records or close their account |
| the delete list changes at all | `scripts/check-schema-contracts.js:219`–`:233` fails the build; and `tests/unit/storage.test.ts:38`, `tests/unit/calendarIcs.test.ts:295`, `tests/unit/calendarShell.test.ts:679`, `tests/unit/hrGoLive.test.ts:34` all assert strings in that file |

**Costs.** `npm run cost` at the start: **$3.45, 63 calls**. At the end: **$3.45, 63 calls** — no
model call was made by this job.

# Handoff — from the My Account section

**Version:** 1 · **Updated:** 29 October 2026, by the My Account chat at the close of its build
(`docs/ACCOUNT-PLAN.md` step 22).
**Supersedes:** nothing. This is the close-out file `docs/ACCOUNT-PLAN.md` step 22 calls for; it is written in the
shape of `docs/HANDOFF-FROM-CALENDAR.md` and `docs/HANDOFF-FROM-DASHBOARD.md`, which are the files to read beside it.
**For:** the next section's chat, any later billing chat, and Claude Code. Read it first, then the files it points to.
**Checked against:** the repository at `e81ecbb` (`main`, pushed), the production reads quoted below (SELECT-only,
through the Supabase CLI's own DB connection), and one measured walk against a production build.
**Where this file and the repository disagree, the repository wins: say so and correct this file.**

---

## 0. In one paragraph

My Account is **live on production** at `https://compliboard.vercel.app/account`. It is five tabs — Company ·
People · Sign-in · Billing · Cancel — and, behind them, the whole of what this product knows about who a company
is, who may sign in, and whether it is paying. Part A rebuilt the page on the company's real facts and its sites.
Part B rebuilt the **front door**: signup creates the account, the company and its main site in one transaction,
the website is read once and *proposes*, and a three-screen walk hands over to the Dashboard. Part C is
**billing**: Stripe is the authority, seventeen columns on `companies` are a one-directional copy of it, and one
pure rule — `accessFor` — decides at **19 paid routes and 4 sweeps** whether a company may spend. **Migrations
087–090 are on production.** ⚡ **Billing shipped INERT: not one Stripe variable is set, so nothing can be
charged and every billing route refuses in plain words.** Every production trial was parked at **2027-01-31**
before the push, so no company is read-only. §7 lists what is owed, in order; `docs/RELEASE.md`'s
*"When Stripe live mode is ready"* is the gate that remains.

---

## 1. Read these, in this order

| File | Why |
| --- | --- |
| `CLAUDE.md` | The project rules. §3.1 (quality-affecting changes), §3.4a (the `npm run haiku` guard), §3.6 (RLS is the boundary; a grant list is not what a role holds), §3.7 (production is SELECT-only), §3.11, §9.1, §9a |
| `docs/ACCOUNT-PLAN.md` | The section's plan: 22 steps in three parts, the decisions with their final state, and **the owed list in one place** |
| `docs/DECISIONS.md` §207–§223 | Every step: what was built, what was proved, what it cost, and its effects on other sections by file. **§213 is the one to read first** — the mirror pattern the rest depends on |
| `docs/account-boards.html` | The owner's nine boards. Every screen was drawn here before it was built, and the words on them are his |
| `docs/RELEASE.md`, the part C routine | How it reached production, and **"When Stripe live mode is ready"** — the six dashboard steps, the three variables, and checks 12–18 |
| `docs/TESTING.md` | The billing lessons: a test that asserts a value is not a test that the value is correct; a lifecycle bug is invisible to both a pure test and a source test; an expand path one level too shallow is a silent zero; a fake that is kinder than the real thing |
| `docs/SCHEMA.md` | Generated from the catalog. `companies` and `stripe_events` |
| `docs/ACCOUNT-MACHINERY.md` | The read-only map of 21 October: every file that touched an account before this section existed |
| `docs/HANDOFF-CODE.md` §7 | Open defects, this section's among them |
| `STATUS.md` | The My Account row |

---

## 2. Where My Account stands

**On production** (`https://compliboard.vercel.app`):

| | |
|---|---|
| `main` | `e81ecbb`, pushed, Vercel green |
| Migrations | `000`–`090`. `npm run preflight` → `PENDING COUNT: 0` |
| Companies | 10 · profiles 4 · entities 10 · `stripe_events` **0** |
| Every trial | parked at **2027-01-31**. No company is read-only |
| Stripe | ⚡ **not configured.** Three variables unset; billing inert and honest |
| The one company with data | **CB-Test-3** (`739a428f-1a0a-4531-8204-92ce75e4f878`), login `bhaskarc@compliboard.com`, 83 of production's 83 `ai_calls` |

**What a customer experiences end to end, today:** they sign up with four fields; the account, the company and
its main site are created in one transaction; their website is read once and proposes facts they confirm; a
three-screen walk hands them to the Dashboard; they work; and My Account shows them their company, their
colleagues, their sign-in and **their plan — $199 a month, their trial and the day it ends**. Pressing *Add a
card* tells them plainly that card payment is not set up on this server yet, and nothing is charged. When a
trial does end, everything stays readable, downloadable and printable; asking, document reading and auditing
pause; and nothing is ever deleted for not paying.

---

## 3. What My Account is (the owner's vision, as built)

Five tabs, and the fifth is the one that took the section's second half.

1. **Company** — the company's own facts, its main site, its other sites, and the three questions it is asked.
   The **name is not editable by a person from either door** (decision 1): it is tied to the account.
2. **People** — who may sign in; invite by email, which sends **our** email, not the login system's; `/join`
   where the person sets their own password; remove; the per-person monthly-email switch.
3. **Sign-in** — name, email change with confirmation, and a password change **by reset link** rather than a form.
4. **Billing** — board 4. Plan, Status, Card, the Stripe line, and *After the trial*. **It reads the mirror and
   writes nothing.**
5. **Cancel** — two different things kept apart (decision 13): stopping the subscription, which is Stripe's own
   portal, and deleting the company for good, which is ours and asks you to type the name.

---

## 4. How billing works, end to end

### 4.1 Stripe is the authority; the columns are a copy

`DECISIONS.md` §213 is the long form. **The direction is Stripe → us and never the reverse.** Seventeen columns
on `companies` (087's eight, 089's `cancel_at`, 090's eight) are a one-directional mirror, so a page can be drawn
and `accessFor` evaluated **without a network call to Stripe on every request**. When the two disagree, Stripe is
right and our code is the bug.

Nobody but the **service role** writes them: migration 087 leaves all seventeen out of `authenticated`'s UPDATE
grant, and `authenticated=r` at table level means a person may read their billing state and may not write it.

### 4.2 One mapping, two ways of being told to run it

`lib/stripeWebhook.ts` `columnsFromFacts` is the **only** mapping from a Stripe subscription to our columns. Two
callers run it:

- **pushed** — `/api/stripe/webhook`, on six event types, signature-verified before the body is read;
- **pulled** — `/api/billing/reconcile`, when the mirror looks wrong (§220, §222).

A test compares what the reconcile wrote against `columnsFromFacts(facts)` itself, so **a second copy of the
mapping fails the build.** `StripePort` is the one seam either of them stubs.

> **⚡ The payload's numbers are not trusted.** Every handler re-reads the subscription from Stripe and writes its
> PRESENT state, so an event that arrives out of order cannot resurrect a dead subscription. That is why a
> webhook does not have to reason about ordering — which is a much smaller thing to get right.

### 4.3 The rule: `accessFor`, and where it is applied

`lib/billing.ts` `accessFor(columns, now)` is **pure, has no imports, and takes `now` as an argument**. It reads
three columns and returns `full` or `read_only` with a **named reason**. There is **no daily job ending trials**:
the verdict is computed at request time, so a trial that ends at 14:03 ends at 14:03.

| door | how |
|---|---|
| **19 POST handlers** | `requireAccess(authed.auth)` two lines after `requireCompany`, returning **402** with one plain sentence |
| **4 cron sweeps** | `splitByAccess` — a skipped company's work is **left in the state that already means "waiting"**, so the day a card is added it simply runs |
| **the banner** | `components/AppLayout.tsx`, one slot above the top bar, `no-print` |
| **every paid control** | `<PausedNote>` beside it, and `disabled` |

`scripts/check-schema-contracts.js` **check 3** computes the transitive import closure and fails the build if a
route that can reach a model does not call `requireAccess` or appear in `EXEMPT` with a reason. The count is
pinned: **25 routes can reach a model; 19 gate; 6 are exempt.**

### 4.4 The two repairs, and why there are two

| | heals | guard |
|---|---|---|
| **§220** the reconcile | a mirror with a **customer and no subscription** — a missed delivery after Checkout, or the race where Stripe redirects the browser back before the webhook lands | originally `.is('stripe_subscription_id', null)` |
| **§222** the widening | a mirror that went **stale on a subscription we already know about** — the state that would turn a paying customer read_only on day 8 | **compare-and-set** on the status and the subscription id |

`reconcileNeeded` (pure, in `lib/billing.ts` beside `accessFor`) names **four** states worth one Stripe read. A
settled `active` row is not one of them: *staleness is not a signal; a state Stripe does not leave alone is.*
**The page asks the rule and the server asks it again**, so a client looping the route cannot turn the mirror
into a proxy.

### 4.5 The code map

| file | what it is |
|---|---|
| `lib/billing.ts` | **The rules, with no imports at all**, so the browser can reach the same verdict: `accessFor`, `trialEndFor`, `bannerFor`/`bannerFromRow`/`pausedFromRow`, `graceDaysLeft`, `reconcileNeeded`, `askAgainLine` |
| `lib/billingView.ts` | **The Billing tab's words**, pure, importing only `lib/billing.ts`: `billingTabView`, `money`, `discountPhrase`, `reconcileTrigger` |
| `lib/stripe.ts` | The only place the Stripe SDK is constructed and its three variables are read. `checkoutSessionParams`, `cardLineFrom` |
| `lib/stripeWebhook.ts` | What an event does to a row: `receiveStripeEvent`, `columnsFromFacts`, `discountFactsFrom`, `clearsGraceAnchor`, `realStripePort` |
| `lib/stripeReconcile.ts` | The pull repair: `reconcileFromStripe`, `recordReconcile`, `changedFields` |
| `lib/accessGate.ts` | `splitByAccess`, `logSkips`, `loadBilling`, `sentenceFor`, `accessRefusal` — **no `next/server`**, so `node --test` can load it |
| `lib/requireAccess.ts` | The 402 door. Separate **only** because it imports `next/server` |
| `app/api/billing/{checkout,portal,reconcile}` · `app/api/stripe/webhook` | The four routes |

---

## 5. The migrations

| | what | the thing to know |
|---|---|---|
| **082** | company facts, sites, invitations, the per-person email switch | the cascade that does not ask RLS |
| **083** | one address: the company row mirrors its main site | the four readers of `state`/`county`/`city` were **deliberately left alone** — moving them is a change to resolution (§3.1) |
| **084** | signup in one transaction | `create_company_for_login` |
| **085** | the website read | nothing written on the model's word |
| **086** | NAICS leaves the doors; `about` holds the sentence | |
| **087** | **the mirror** — eight columns + `stripe_events` | ⚠ its backfill was a **no-op**: `ADD COLUMN` with a non-volatile default folds one value into every row |
| **088** | **repairs 087** | `coalesce(trial_started_at, created_at) + 14 days`. Its check 2 is the one 087 lacked: it makes a wrong value and requires the absence-check to find it |
| **089** | `cancel_at` | a scheduled cancellation **is not a status** — Stripe keeps `trialing`/`active` until the date arrives |
| **090** | what this company **pays** — the next invoice's total, and the discount in six fields | 0 is a real value and is not NULL; `discount_duration` is the only thing telling `once` from `forever` |

---

## 6. What this section changed outside itself, and the proof for each

| file | change | proof |
|---|---|---|
| `components/AppLayout.tsx` | the banner slot, above the top bar, `no-print`; one widened `companies` read | `tests/unit/readOnlyUi.test.ts` hashes `NAV_ITEMS` and `SidebarContent` so a later edit to the sidebar fails the build |
| `app/compliance/page.tsx`, `app/hr/HrWorkspace.tsx`, `app/audits/page.tsx`, `app/documents/page.tsx`, `app/calendar/page.tsx` | widened select + `<PausedNote>` beside every paid control | same file: each page makes **one** `companies` read, not two |
| `components/DocumentReport.tsx`, `components/AuditReport.tsx`, `components/CalendarAsk.tsx` | take the verdict as a **prop**, never read it | asserted: none of the three contains `.from('companies')` |
| the three ask screens | **a 402 no longer offers *"You can ask again, or rephrase the question."*** | `askAgainLine(status)`; rephrasing cannot help a lapsed account |
| `app/api/jobs/{summarise,scan-documents,audit-sections}`, `lib/handbookCheck.ts` | `splitByAccess`; `scan-documents` had to stop picking `limit(1)` | one log line per skipped company per run |
| ⚡ `app/compliance/page.tsx` | **a pre-existing bug fixed in passing** (`7363251`): a `profiles` read with no `.eq('id', user.id)`, so at any **two-person company** the page could not tell which company it was | `maybeSingle()` was returning "multiple (or no) rows"; `companyId`, `companyName` and `billing` were all silently null |
| `app/api/scan-website/route.ts`, `prompts/scan-website.ts` | **deleted** (`6cfa1df`) | it had had no caller since step 12. `grep -rn "@anthropic-ai\|api.anthropic.com" app lib components` now returns `lib/ai.ts` only, **with no exception to remember** — the state `CLAUDE.md` §3.4 always claimed |

---

## 7. What is owed, in order

1. **⚡ Stripe live mode.** The six dashboard steps, the three variables, and checks 12–18 —
   `docs/RELEASE.md`, *"When Stripe live mode is ready"*. Until then billing is inert. **Everything else in this
   list is smaller than this one.**
2. **A re-read button for the website read.** "Read once" is the route's rule, and two of seven sites measured at
   the step-13 stop failed for temporary reasons. A person who fixes their website must not be told *"we already
   tried"*. `DECISIONS.md` §210.
3. **`companies.scan_result` and its two readers.** No longer written by anything (`app/api/signup/route.ts:18`),
   and `lib/jurisdiction.ts:21` says it is never read for jurisdiction either. A column nothing writes and
   nothing should read: confirm and drop it.
4. **Conversations in the export.** `/api/account/export` returns one JSON file of 25 top-level keys and reads
   **no `topics` and no `turns`**, so board 5's *"and conversation, as files"* overstates it. The page's line
   says what the file actually holds. `docs/ACCOUNT-PLAN.md` open question 2.
5. **The four readers of `companies.state`/`county`/`city`.** 083's trigger makes the wrong answer impossible
   meanwhile, but moving `app/walk/page.tsx`, `app/api/company-information/route.ts`, `lib/agencyScope.ts` and
   `lib/obligationWriter.ts` onto the **site** and retiring the three columns is owed. It is a change to
   resolution, so it needs its own step and its own golden run (§3.1).
6. **An email before a discount ends.** The Billing tab names the date; nothing sends it. §221 F.
7. **⚠ Whether billing evidence should outlive a deleted company.** `stripe_events.company_id` is
   `ON DELETE CASCADE`, so deleting a company **destroys the record of what Stripe told us about its money** —
   which is the one thing that table exists for. Seen for real: resetting the step-20 fixture erased six
   delivered events and three reconcile rows. **The owner's call**, and it is a product decision, not a schema
   tidy-up: the alternatives are a null `company_id` on delete, or a separate retention table.
8. **The periodic reconcile sweep.** §222 G, deliberately **not** built. The condition that makes it right:
   *enough paying companies that "they will open the Billing tab" stops being true* — read off `check:live`'s
   billing-mirror question. Cost: a seventh cron, a Stripe call per candidate, rate-limit handling, and a new way
   to write billing columns with no person in the request.
9. **The unthrottled signup.** `POST /api/signup` is unauthenticated and creates an auth user, a company and a
   site, with no rate limit, no captcha and no email verification gate before the walk. It has never mattered
   because nobody knows the address. It matters the day the marketing site points at it.
10. **The three older emails onto one template, and the Resend sending domain** — inherited from the Calendar,
    not this section's, but still open and still a gate before any email reaches a customer.

---

## 8. Known defects and limits

| | |
|---|---|
| **The `$199` is still a constant for a company with no subscription** | `PLAN_PRICE` in `lib/billingView.ts`. For a company **with** a subscription the page states the mirrored `next_charge_amount_cents` and never falls back. For one without, $199 is the product's price, which is the honest use — but if the price changes in Stripe, **that line must change in the same commit** |
| **The grace window cannot be walked on a test clock** | `payment_failed_at` is `new Date()` — our server's wall clock when the event is handled. For a real customer that is seconds from the event; for a test clock it is months. `npm run stripe:clock` shows the window by re-asking the gate with the anchor moved, labelled on screen as a question, not a write |
| **A lapsed *repeating* discount with no card is a HYPOTHESIS** | We expect Stripe to raise the invoice, fail with no payment method, fire `invoice.payment_failed`, and land in decision 11's grace. **Half of it is now observed** (a card that *fails* does produce the event and the anchor). The no-payment-method case is not. Until it is, §217's **forever coupons only** is load-bearing |
| **`service_role` holds all eight privileges on `stripe_events`** | not the three 087's grant line reads as. `postgres`'s default ACL (068) grants everything on creation and a GRANT cannot subtract. Staging is identical, `anon` and `authenticated` hold nothing, and 087's comment was corrected on 29 October — **its SQL was not** |
| **Ten near-duplicate company names on production** | inherited. Only CB-Test-3 holds data. A tidy-up, not a defect, but any per-company reading of production is hard to read |

---

## 9. For the next section's chat

Three things this section learned that are not about billing at all, and `docs/TESTING.md` carries each in full:

- **A test that asserts a value is not a test that the value is correct.** `payment_method_collection:
  'if_required'` was asserted by a unit test *and* read back from Stripe's own API, and both passed while the
  value was the wrong one — because the assertion was written from the same belief as the code.
- **A lifecycle bug is invisible to both a pure test and a source test.** One does not run the component; the
  other does not run anything. What found two of them was a screenshot taken three seconds after the request.
- **Read it back — the artefact, not the column.** The page, the screenshot, the row in the log table. Four
  defects in four days, none visible to a suite of two thousand tests, all visible in ten seconds to anyone who
  looked at the output.

And one that is: **the owner's own by-hand walk with a real card found four defects no test could.** The
`if_required` trap, the customer-vs-subscription routing, the scheduled-cancellation blind spot, and the list
price stated as fact. Every one of them was about money, and every one was visible on a screen.

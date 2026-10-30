# Public pages — step 13: a read-only map of the homepage and the public surface

**Written:** 30 October 2026. **Nothing was changed by this step** — every statement below is a
file and a line read today at `5dea8db` (`git status` carried only the untracked
`docs/PUBLIC-PAGES-PLAN.md`). The plan is `docs/PUBLIC-PAGES-PLAN.md` step 13.

Every claim here points at the line that says it (CLAUDE.md §9.1). Where I could not read the thing
from this repository — the Supabase dashboard — I say so rather than describe it.

---

## 1. What `app/page.tsx` renders, and what imports what

`app/page.tsx` is 317 lines, `'use client'` (`:1`) although it holds no state: it imports
`useState` and `useEffect` at `:3` and **uses neither**, and its component body is a single
`return` (`:6`–`:8`). The only other import is the one section component:

| line | what |
|---|---|
| `app/page.tsx:4` | `import HomepageSection from '@/components/HomepageSection'` |

In render order:

| lines | block | notes |
|---|---|---|
| `:12`–`:24` | nav, `fixed`, `max-w-6xl`, `h-16` (64px) | wordmark `a href="/"` at `:14`, in `text-green-700` / `text-orange-600` (Tailwind palette, **not** the tokens); `Sign in` → `/login` `:18`; `Start free trial →` → `/signup` `:19` |
| `:27`–`:49` | hero, inline `linear-gradient(to right, #dcfce7, #ffffff, #f0fdf4)` | two-column grid; `h1` at `:30`; `/Hero2.png` at `:44`; CTA → `/signup` `:37` |
| `:52`–`:64` | "HOW IT WORKS" | `/How_it_works_6.png` at `:59` |
| `:67`–`:75` | "DOCUMENT REVIEW" | `/Audit_report_4.png` at `:70` |
| `:78`–`:172` | `<HomepageSection title="Compliance Calendar">` | the child is a hand-drawn calendar mock, `:100`–`:171` |
| `:175`–`:230` | `<HomepageSection title="HR Policy Assistant">` | the child is a hand-drawn HR mock, `:197`–`:229`, including three `filter blur-[2px]` paragraphs (`:209`, `:219`, `:225`) |
| `:233`–`:299` | "WORKSPACE + PRICING" on `bg-green-700` | prices **$49 struck through / $29 a month** (`:243`, `:247`) and "Early adopter price — locked forever" (`:250`). The plan's decision 9 and panel 8 say **$199**; the live page says $29. Not this step's to change — recorded because step 24 writes the price and step 25 deletes this file. |
| `:302`–`:313` | footer | wordmark `:304`; `Sign in` → `/login` `:308`; `Create account` → `/signup` `:309`; `© 2026 CompliBoard. All rights reserved.` `:311`. **No privacy, terms, security or FAQ link exists anywhere today.** |

**`components/HomepageSection.tsx` (86 lines) is used by `app/page.tsx` and nothing else.**
`grep -rn "HomepageSection" app components lib scripts tests docs prototypes` returns six code
hits, all in those two files (`app/page.tsx:4`, `:78`, `:172`, `:175`, `:230`;
`components/HomepageSection.tsx:8`, `:23`, `:26`), plus two documentation hits in
`docs/PUBLIC-PAGES-PLAN.md:93` and `:105`. So at step 25 it is deleted with no other caller to fix.

**The three images only this page uses**, read with a per-file grep over `app components lib
prototypes`: `/Hero2.png` (`app/page.tsx:44`), `/How_it_works_6.png` (`:59`),
`/Audit_report_4.png` (`:70`). Also in `public/` and referenced by **nothing**:
`Audit_report.png`, `Audit_report_2.png`, `Audit_report_3.png`, `File_Audit_1.png`, `Hero1.png`,
and the create-next-app leftovers `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`.
Step 25's deletion list is those three plus whatever of the unreferenced set the owner wants gone.

## 2. Every link to `/` in `app/` and `components/`

Two, and that is all:

| where | what it is | for |
|---|---|---|
| `app/page.tsx:14` | `<a href="/">` | the marketing nav's own wordmark, linking to the page it is on |
| `app/account/page.tsx:1077` | `router.push('/')` | **after a company is deleted.** `destroy()` (`:1063`) calls `DELETE /api/account`, then `supabase.auth.signOut()` (`:1076`), then this. The comment that justifies it is in the test, not the code: `tests/unit/dashboardView.test.ts:348` — "account deletion still lands on the homepage, because there is nothing else left" |

`grep -rn 'href="/"' app components` → `app/page.tsx:14` only.
`grep -rn "push('/')\|push(\"/\")\|redirect('/')\|redirect(\"/\")\|replace('/')\|replace(\"/\")" app components lib` → `app/account/page.tsx:1077` only.

There is **no `middleware.ts`** at the root or under `app/` (checked by `ls`), so nothing redirects
`/` today; `app/page.tsx` is reached directly, signed in or not. That is what step 25's
signed-in redirect changes.

## 3. Where login, signup and sign-out land

| event | line | lands on |
|---|---|---|
| sign in | `app/login/page.tsx:34` | `router.push('/dashboard')` — with a comment at `:30`–`:33` saying it pushed `/` until 20 October and why that was wrong (Dashboard decision 1, `docs/DASHBOARD-MACHINERY.md` §A) |
| signup, happy path | `app/signup/page.tsx:135` | `router.push(WALK_PATH)`, and `WALK_PATH` is `'/walk'` (`lib/walkView.ts:23`, imported at `app/signup/page.tsx:44`) |
| signup, sign-in failed after the account was made | `app/signup/page.tsx:96` | `router.push('/login')` |
| sign out from the app shell | `components/AppLayout.tsx:206`–`:207` | `signOut()` then `router.push('/login')` |
| sign out as part of deleting the company | `app/account/page.tsx:1076`–`:1077` | `signOut()` then `router.push('/')` |
| password reset email | `app/forgot-password/page.tsx:22` and `app/account/page.tsx:663` | `redirectTo: ${window.location.origin}/reset-password` — the origin is the browser's, not a variable |

**Three tests pin these**, so step 25 must keep them true:
`tests/unit/dashboardView.test.ts:327` (login must not push `/`), `:337`–`:340` and
`tests/unit/signup.test.ts:307` (signup must not push `/`), `tests/unit/dashboardView.test.ts:348`
(account deletion still pushes `/`).

## 4. Every reader of `NEXT_PUBLIC_APP_URL`

Code that reads it (`process.env.NEXT_PUBLIC_APP_URL`), seven places:

| file:line | what it builds | if unset |
|---|---|---|
| `lib/stripe.ts:87`–`:88` | the checkout return address | **throws** `StripeNotConfigured('NEXT_PUBLIC_APP_URL')` |
| `lib/auditNotify.ts:89` | the audit email's link | refuses the send, `:170`–`:172` |
| `lib/documentBatch.ts:167` | the batch email's link | refuses the send, `:200`–`:203` |
| `lib/handbookCheckNotify.ts:64` | the handbook-check email's link | refuses the send, `:91`–`:93` |
| `lib/invitationEmail.ts:123` | the `/join` link | refuses, with `why:` naming the variable |
| `app/api/jobs/calendar-month/route.ts:75` | the month email's links | throws at `:104` |
| `app/api/invitations/route.ts:54` | the invitation link | — |

Plus one script, `scripts/render-calendar-email.mjs:28`, which is the only place that carries a
**default**: `'https://app.compliboard.com'`. And the tests at
`tests/unit/handbookCheckNotify.test.ts:39`, `:46`, `:52`, `:66` set and clear it.

Nothing on the public pages reads it. It matters here only because plan step 32 changes its value
when the domain moves, and because it is `NEXT_PUBLIC_*` — inlined at build time, so it must exist
on Vercel **before** the push that builds (`docs/RELEASE.md:682`).

**The Supabase auth redirect settings are a dashboard fact, not a repository fact.** Nothing in
this codebase names a Site URL or an allowed redirect list; the only redirect the code asks for is
`${window.location.origin}/reset-password` (above). So this step cannot report what Supabase Auth
holds, and does not guess — `docs/PUBLIC-PAGES-PLAN.md` step 32 is where it is read back.

## 5. What `app/layout.tsx` sets

- **Twelve `next/font/local` calls**, six per family, one per character subset
  (`:42`–`:180`); the long comment at `:5`–`:40` says why they are local and why the family is
  named after the JavaScript constant.
- **The two CSS variables, and they are not `--font-sans` / `--font-serif`:**
  `--font-plex` (`:110`, on the Latin IBM Plex Sans call) and `--font-source-serif` (`:177`, on the
  Latin Source Serif 4 call). Only those two calls carry `variable:`, `preload: true` and
  `adjustFontFallback` (`'Arial'` at `:112`, `'Times New Roman'` at `:179`); the other ten are
  `preload: false`.
  `app/globals.css:35`–`:40` maps them into Tailwind's theme — `--font-sans: var(--font-plex)`,
  `--font-serif: var(--font-source-serif)` — and `app/globals.css:58` sets `body`'s
  `font-family: var(--font-plex)` (the comment at `:50`–`:57` explains why the body reads the
  font's own variable and not the theme's).
  **So a new public component uses `font-sans` / `font-serif`, or `var(--font-plex)` /
  `var(--font-source-serif)`, and imports no font.**
- **Metadata** (`:182`–`:185`): `title: 'CompliBoard'`, `description: 'Compliance made simple'`.
  Nothing else — no `robots`, no `openGraph`, no `metadataBase`, no `viewport` export.
- **Global** (`:192`–`:198`): `<html lang="en">` and
  `<body className={`${plexSans.variable} ${sourceSerif.variable} antialiased text-base`}>`.
  There is no provider, no shell and no `<main>` here; the app shell is `components/AppLayout.tsx`,
  which each signed-in page wraps itself in. **A page under `app/` renders straight into `<body>`**,
  which is why `/preview-home` needs no change to this file.

## 6. The tokens `app/globals.css` defines today

All on `:root`, `:10`–`:27`:

```
--page #F7F8FA · --surface #FFFFFF · --ink #14171A · --ink-soft #5B6470 · --ink-faint #8A929C
--line #E6E9ED · --green #2F7D52 · --green-ink #256541 · --green-wash #EAF3ED
--amber #B7791F · --amber-wash #FDF6E7 · --radius 10px · --measure 775px
```

`--measure` is defined and read by nothing (`DESIGN.md` §2 says so, and a grep agrees).
`@theme inline` (`:35`–`:40`) adds `--color-background`, `--color-foreground`, `--font-sans`,
`--font-serif`. `body` is `background: var(--page)` (`:48`), 16px/1.5 (`:59`–`:60`).
`*, *::before, *::after { box-sizing: border-box }` at `:63`–`:65`.
The rest of the file, `:67`–`:117`, is print rules: `.print-only`, `.fold-closed`, and two
`@media print` blocks (`.sources-print`, `.no-print`, `body.printing-drawer`).
**There is no `prefers-color-scheme: dark` block, deliberately** (`:42`–`:46`).

There is a `tailwind.config.ts` at the root, but Tailwind v4 reads the theme from `@theme inline`
in this file (`:30`–`:34` says there is no config file to scan).

## 7. How `scripts/measure-layout.mjs` signs in, and whether it can measure a page with no login

**How.** `package.json:37` runs it as `node --env-file=.env.local scripts/measure-layout.mjs`, so
it reads the laptop's staging credentials. Then, before Chrome is even launched:

- `:168` `const url = process.env.NEXT_PUBLIC_SUPABASE_URL`, and `:169` takes the project ref out
  of that URL by regex.
- `:171` builds an **anon-key** client (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `persistSession: false`).
- `:172` `pub.auth.signInWithPassword({ email, password: process.env.CHECK_LIVE_PASSWORD })` —
  email from `--as`, default `testcascade@example.com` (`:105`).
- `:173` **on any sign-in error it prints and `process.exit(1)`.** This is unconditional; there is
  no flag that skips it.
- `:256`–`:264` writes the session into the cookie `@supabase/ssr` reads — `sb-<ref>-auth-token`,
  `domain: 'localhost'`, chunked at 3180 characters.
- `:275` then navigates to `${base}${path}`, where `base` defaults to `http://localhost:3000`
  (`:117`) and `--base <origin>` changes it.

**Can it measure a page that needs no login? Yes, as it stands — no change needed to run it.**
The sign-in is not a precondition of the *page*; it only has to succeed. `.env.local` here holds
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `CHECK_LIVE_PASSWORD` (read by
name from the file today), so the sign-in passes and a public page simply ignores the cookie.
Two caveats, both read from the code rather than assumed:

1. **The readiness loop wants an `h1`.** `:276`–`:280` polls up to 40 × 1000ms for
   `document.querySelector('h1')`. A page without one is not refused — the loop just runs out and
   the measurement proceeds — but it costs ~40 seconds. Step 14's frame has no `h1` (nav and footer
   only); step 15's hero has one, so this is a slow run once, not a blocker.
2. **The cookie is pinned to `localhost`**, so a local server must be addressed as
   `http://localhost:<port>`, never `127.0.0.1`. Irrelevant for a page with no session, but it is
   the reason to keep saying `localhost`.

**What it cannot print today, which the step 15 acceptance needs.** Its output is built for a
signed-in page: `:595` prints the `h1`'s x (built at `:583`); the top bar it looks for is
`document.querySelector('header')` with `a[href="/dashboard"]` inside (`:553`–`:554`), and the
column is `.print-page` or `main [class*="max-w-[900px]"]` (`:465`). A public nav is a `<nav>` whose
wordmark links to `/`, so **the wordmark's x will print as `top bar none`**, and nothing in the
output reports a section's height against the viewport or whether the document scrolls sideways
(`:582` prints the *vertical* scrollbar only).

So step 15's three readings — the `h1`'s x equals the wordmark's x, nothing overflows horizontally
at 390, the hero is at least a viewport tall — are not readable from today's output.
**The smallest change** (not made in this step): an additive block in the one `evaluate()` return
plus a few `console.log` lines, printed **only when the page carries a public-page marker**, giving
the wordmark's and the footer wordmark's `left`, each public section's height against
`innerHeight`, and `documentElement.scrollWidth − clientWidth`. Additive and keyed on a marker no
app page has, so no existing measurement moves.

## 8. Anything else that has to change when `/preview-home` becomes `/` at step 25

Read from the code, not from the plan:

1. **The `noindex` has to come off.** Step 14 puts `robots: { index: false, follow: false }` in
   `app/preview-home/page.tsx`. Moving that file to `app/page.tsx` with the export still on it
   would ship a homepage no search engine may index — the quietest possible launch failure. There
   is **no `app/robots.ts`, no `app/sitemap.ts` and no `public/robots.txt`** (checked by `ls`), so
   nothing else would contradict it and nothing would warn.
2. **`app/layout.tsx:182`–`:185`'s metadata is the whole of what a visitor's browser and a link
   preview get:** title `CompliBoard`, description `Compliance made simple`, no `metadataBase`, no
   `openGraph`, no image. Whether that is the public homepage's title and description is a decision
   for step 25 or 27–30, not an accident to inherit.
3. **The three images and `components/HomepageSection.tsx` are deleted** (§1), and nothing else
   imports either.
4. **The four footer links must exist by then.** Step 14's footer points at `/privacy`, `/terms`,
   `/security` and `/faq`; `ls app` today shows none of them, so they are 404s until Part C
   (steps 27–30). They are 404s on an unlinked `noindex` page, which is why that is acceptable now
   and not at step 25.

   **And two of them are already linked from inside the app, so they 404 for signed-in users
   today:** `components/AppLayout.tsx:462` `<a href="/privacy">Privacy Policy</a>` and `:463`
   `<a href="/terms">Terms of Service</a>`, in the shell footer beside
   `<a href="mailto:hello@compliboard.com">Contact</a>` (`:464`) and `© 2026 CompliBoard LLC`
   (`:466`). This step found that and changed nothing, and records two consequences: the two dead
   links are fixed by steps 27 and 28, not by anything here, and **`CompliBoard LLC` is the entity
   name the product already prints** — one of the two items `PUBLIC-PAGES-PLAN.md` §7 lists as open,
   so the owner has something to confirm rather than supply. That footer's `:456`–`:458` is also the
   existing not-legal-advice sentence, which §2 rule 4 says belongs on the terms page and on every
   report.
5. **A signed-in visitor to `/`** — the plan's own step 25 — has nothing to change *today*, because
   no middleware exists (§2). It is new code, not an edit.
6. **The three tests in §3 stay green**: login and signup must not push `/`, deleting a company
   must. Adding a signed-in redirect at `/` does not touch any of them, but step 25 should run them
   rather than assume.
7. **`app/account/page.tsx:1077` keeps pushing `/`** — and after step 25 that lands a just-deleted
   user on a page that may redirect a *signed-in* visitor to `/dashboard`. The sign-out at `:1076`
   is awaited first, so the session is gone and the redirect should not fire; it is the one
   interaction between the swap and an existing page, and it is worth walking rather than reasoning
   about.
8. **Nothing in `lib/` or the API routes reads the homepage's address.** The only hardcoded public
   origin outside the emails is `https://compliboard.com` in the share controls
   (`components/AppLayout.tsx:233`, `:240`, `:245`) — already the final domain, so step 31's DNS
   makes those three correct rather than breaking them.
9. **`DEV_MAX_SEARCHES`, the AI models, RLS, migrations: untouched.** No public page reads a
   model, a token or a table. This job calls nothing.

## 9. §9.1 — effects on other sections, by file

**None. This step changed no file**; `git status` after it shows only the two new report-and-plan
documents. The files read were `app/page.tsx`, `components/HomepageSection.tsx`, `app/layout.tsx`,
`app/globals.css`, `components/AppLayout.tsx`, `components/buttonStyles.ts`,
`scripts/measure-layout.mjs`, `app/login/page.tsx`, `app/signup/page.tsx`,
`app/account/page.tsx`, `lib/walkView.ts`, `package.json`, and the grep targets named above.

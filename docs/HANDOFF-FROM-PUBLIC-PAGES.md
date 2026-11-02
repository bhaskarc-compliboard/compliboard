# Handoff — from the public pages

**Version:** 1 · **Updated:** 2 November 2026, by Claude Code at the close of the public-pages build
(`docs/PUBLIC-PAGES-PLAN.md` step 35).
**Supersedes:** nothing. This is the close-out file `docs/PUBLIC-PAGES-PLAN.md` step 35 calls for; it is written in
the shape of `docs/HANDOFF-FROM-CALENDAR.md` and `docs/HANDOFF-FROM-ACCOUNT.md`, which are the files to read beside
it.
**For:** the session that writes the four content pages' words after the app work (Part C, steps 27–30 and 30a), the
session that connects the domain (Part D, steps 31–32), the gate check (step 33), and Claude Code.
**Checked against:** the repository at `5e12cd4` (`main`, 2 November 2026; pushed at `88394af` the same day, see
the box), `npm run check` (exit 0, 2063 tests in 510 suites, 0 fail), a `next build` + `next start` walk of the
production build, the live site after the push, and the greps quoted below. **Where this file and the repository disagree, the repository wins: say so and correct this file.**

---

> ## ✅ PUSHED 2 NOVEMBER 2026, `88394af` — LIVE AT compliboard.vercel.app.
>
> On the owner's word at step 35b: `git push origin main` → `5dea8db..88394af  main -> main`, 22 commits, and
> Vercel's Production deployment `compliboard-fp5x9nr3c` reached **Ready** in 47s. Checked against the live URL
> straight afterwards: `curl -sI https://compliboard.vercel.app/` → **HTTP/2 200**, `x-nextjs-prerender: 1`, **no
> `X-Robots-Tag`**; the HTML has **one** "read the whole cabinet", **zero** "Early adopter", **zero** "noindex",
> `data-public-page="home"` and all nine sections; the footer's hrefs are exactly `/ /privacy /terms /security
> /faq` with **no address in it**; `/preview-home` → **404**. The four content pages are **200 with `noindex`
> each**, titled "Privacy policy · CompliBoard", "Terms of use · CompliBoard", "Security · CompliBoard" and
> "Questions · CompliBoard".
>
> So "live" in this file now means live on production. **What is still not live is the content pages' words** —
> the stubs are deliberate and `noindex` (§6) — and the domain, which is Part D.

---

## 0. In one paragraph

The homepage is **eight panels and nothing else**: a light hero with four of the week's moments, then audit ·
binder · a question · a checklist · documents · calendar · HR, then the invitation with the price. Each panel is
one file under `components/home/`, holding its own sentences in one `WORDS` object and its own card drawn in code
with the app's own tokens — never a screenshot, because screenshots do not read clean (decision 5). `app/page.tsx`
is the ordered list of panels and holds no words at all. Four content pages — `/privacy`, `/terms`, `/security`,
`/faq` — exist as **honest one-line stubs**, each `noindex` until its words are written. The page says nothing the
product cannot do, with seven gate items (§5 below) marked in the panel files that depend on them. **It is pushed
and live at compliboard.vercel.app** (the box above); the four pages' words wait for the app work, `/contact` does
not exist, and the domain is not connected.

---

## 1. Read these, in this order

| File | Why |
| --- | --- |
| `CLAUDE.md` | The project rules. §2 rule 2 (never "AI", never "compliant", never a score, never "overdue"), §3.11 (screenshots in `shots/`, `check:live` on 3999 only, every report names its effects by file), §9.1, §9a |
| `docs/PUBLIC-PAGES-PLAN.md` (v13) | The plan: what the pages are for (§1), the six rules every word follows (§2), decisions 1–13 (§3), the eight panels and their scenes (§4), **the release gate (§5)**, all 35 steps with what each one proved (§6), what is still open (§7, §7a, §7b) |
| `docs/reports/public-pages-13-map.md` | The read-only map of 30 October: the old homepage line by line, every link to `/`, the login and signup redirects, `NEXT_PUBLIC_APP_URL`'s readers, the Supabase redirect settings. **§8 is the list step 25 worked from** |
| `docs/reports/public-pages-12-words.md` | The words check: every sentence a visitor sees, where in the product the same words live, the five facts re-read at the agency's own page with the URL, the date and the quote, the hard-rule greps, and §G/§G.1 (step 12b) |
| `docs/reports/public-pages-13-15.md` | Steps 13–15: the frame, the nav, the footer, the waves, the hero, with the measurements |
| `docs/PENDING.md` | What the product owes. **F1, F4, F6, F7, S1, D2 and now F12 are this page's gate** |
| `docs/DESIGN.md` | The app's type scale and token rules. The public pages have their own, larger scale (§3 below) and say so where they depart |
| `STATUS.md` | The **Public pages** row |
| `docs/RELEASE.md` | How a change reaches production — the way this work was pushed at step 35b, and the way the domain release (step 34) will go |

---

## 2. Where the public pages stand

**On production** (`https://compliboard.vercel.app`, `main` at `88394af`, deployment `compliboard-fp5x9nr3c`, pushed and verified 2 November 2026 — see the box above):

- **`/` is the new page.** `app/preview-home/page.tsx` was moved onto `app/page.tsx` at step 25 (`git mv`), and the
  **first** edit was deleting `robots: { index: false, follow: false }`. The old `app/page.tsx`,
  `components/HomepageSection.tsx` and the three images only that page loaded (`Hero2.png`,
  `How_it_works_6.png`, `Audit_report_4.png`, 3.8MB) are deleted. `/preview-home` 404s.
- **`/privacy`, `/terms`, `/security`, `/faq` are stubs** on `components/home/PageShell.tsx` (step 25a), each one
  sentence, each `noindex`.
- **The build:** `/` and the four stubs are `○ (Static)` in `next build`. `npm run check` exit 0.
- **The production build was walked** (step 26, done inside step 25): `next start`, `curl -sI /` → **no
  `X-Robots-Tag`**, `grep -c noindex` on the HTML → **0**, `<title>CompliBoard</title>`, the description the hero's
  own turn sentence. Every link walked and landing: `/` · `/login` · `/signup` ×3 · `/privacy` · `/terms` ·
  `/security` · `/faq`, and the four hero lines against the ids `#audit #binder #calendar #hr`, which are present
  with `#workspace #checklist #documents #start`.
- **Measured** at 1440 / 1280 / 390 against that build: hero `h1` at x=120 / 120 / 16, the wordmark at the same x
  in the nav and the footer, document overflow **0** at all three. Section heights at the laptop widths: hero 900,
  audit 900, binder 900, workspace 926, checklist 930, documents 900, calendar 900, hr 900, start 900. At 390 the
  closing panel is 628px, shorter than the screen — that is decision 6 (no height forced below `lg`), not a defect.
  `shots/pp-25-home-1440.png`, `-1280.png`, `-390.png`.

**Not done, and not a defect:** the four pages' words, `/contact`, the domain, the gate check. §6. *(The push
was on this list until step 35b did it.)*

---

## 3. How the page is built

**One file per panel (§2 rule 6).** `app/page.tsx` is 67 lines and is the ordered list — move one line and the
story reorders. Every sentence lives in its panel's own `WORDS` object, so the words can be rewritten without
touching a layout and an industry-specific homepage is a set of `WORDS`, not a new page (§7b).

**The shape comes from three shared files and nothing else:**

- **`components/home/Frame.tsx`** — the panel: the moment on the left in the person's own words, the drawn card on
  the right, 5fr to 6fr with a 64px gutter at `lg`, one column below it. It exports **`EDGES`**, the public content
  box (`mx-auto w-full max-w-[1440px] px-4 lg:px-[120px]`), which the nav, every panel, the footer and `PageShell`
  import so every first glyph sits at the same x. Step 16b's header explains why 120px is from the *window* and not
  from a 1200px box — it was built the other way first and cost 120px of page.
- **`components/home/AskBox.tsx`** — the product's own box with the sentence the person typed, on every panel
  (decision 10). Nothing in it is live: it is a drawing of the app.
- **`components/home/Waves.tsx`** — the four green bands, drawn twice (laptop and phone aspect) and cropped by the
  section's `overflow-hidden`. The hero and the closing panel get the full set; behind a card only the two palest.

**Nothing on a card is clickable, on purpose.** Every "report", "Add a document", "Download the binder", "Print",
"Audit again" is a `<span>` wearing link or button clothes, with `pointer-events-none` on anything that carries a
hover colour. A homepage that hands a visitor a control that does nothing is worse than a homepage that draws one.

**The numbers are read from the app, not typed.** `components/home/Invite.tsx` imports `PLAN_PRICE` and
`PLAN_PERIOD` from `lib/billingView.ts:47`–`:48`; `components/home/Hero.tsx` imports `TRIAL_DAYS` from
`lib/billing.ts:53` for "14 days. No card." Both modules were checked for what travels with them: `lib/billing.ts`
imports nothing at all, `lib/billingView.ts` imports only `lib/billing.ts`, so no Stripe SDK and no server code
reaches a page. **If the price changes in Stripe it changes here in the same commit, by construction.**
`app/page.tsx` imports `TURN` from `Hero.tsx` for its `description` for the same reason: a search result shows one
sentence and it should be the sentence the page opens with.

**The content pages** are `components/home/PageShell.tsx`: `<Nav />`, the `EDGES` box, a serif `h1` at the panels'
32/44, an optional lead line, the body slot, `<Footer />`, on white, with `min-h-[100svh]` and a `flex-1` body so a
one-line page still holds the footer at the bottom of the screen. It holds no words of its own. The `lead` prop is
**unused today** — it is there for Part C, and gets its first measurement then.

**Tokens:** `app/globals.css:28`–`:40` (the wave greens, the blue and its wash, the muted red and its wash, the
card ambers) and the one class at `:44`–`:57`, `.home-screen`, which exists only because `min-height: 100vh` with a
`100svh` override is two declarations of one property and Tailwind would leave the winner to emit order. It is
wrapped in `@media (min-width: 1024px)` on purpose — which is why `PageShell` uses `min-h-[100svh]` instead.

---

## 4. The code map

| File | Lines | What |
| --- | --- | --- |
| `app/page.tsx` | 67 | The homepage: the ordered list of panels. No words |
| `app/privacy/page.tsx` · `app/terms/page.tsx` · `app/security/page.tsx` · `app/faq/page.tsx` | 36 · 31 · 32 · 32 | The four stubs. Each carries `robots: { index: false, follow: false }` and says so in capitals |
| `components/home/Frame.tsx` | 114 | The panel shape and `EDGES` |
| `components/home/PageShell.tsx` | 100 | The content-page shape |
| `components/home/Nav.tsx` | 59 | The nav and the exported `Wordmark` |
| `components/home/Footer.tsx` | 48 | The footer: the wordmark and exactly four links. **No address** (decision 13) |
| `components/home/Hero.tsx` | 157 | Panel 1, and the home of `GROUND`, `WavesLayer`, `START_HREF`, `SMALL_PRINT`, `TURN` |
| `components/home/AuditPanel.tsx` | 258 | Panel 2a. Its header is the long version of why "Needs work" (a Documents word) sits on an audit row |
| `components/home/BinderPanel.tsx` | 254 | Panel 2b. **Gates F4 and F6** |
| `components/home/QuestionPanel.tsx` | 215 | Panel 3a, the California cannabis scene. Its SAMPLE TEXT note carries five sources with the date each was read |
| `components/home/ChecklistPanel.tsx` | 293 | Panel 3b, the Oregon hospice. Four items since step 12 |
| `components/home/DocumentsPanel.tsx` | 187 | Panel 4, the Colorado brewery. **Gate: chat over documents (F12)** |
| `components/home/CalendarPanel.tsx` | 233 | Panel 5, the Georgia trucking company. **Gate S1** |
| `components/home/HRPanel.tsx` | 186 | Panel 6, the Kentucky restaurant. **No gate** |
| `components/home/Invite.tsx` | 76 | Panel 8, the invitation. **Gate F1** |
| `components/home/AskBox.tsx` | 114 | The shared box |
| `components/home/Waves.tsx` | 161 | The drawing |

Twenty commits carry the code, `b3a9c71` (step 14) to `5e12cd4` (step 25), with `6901ddb` (step 13) the read-only
map before them.

---

## 5. The release gate — `docs/PUBLIC-PAGES-PLAN.md` §5, as it stands on 2 November 2026

**The homepage does not release while any of these is open.** Each is in `docs/PENDING.md`; each is marked in the
panel file that depends on it; **step 33 walks every one of them against the shipped product.**

| | Item | What on the page waits on it | Marked at |
| --- | --- | --- | --- |
| **F4** | The binder | panel 2b entirely; "Download the binder" on 2a's card | `BinderPanel.tsx:1`, `AuditPanel.tsx:1` |
| **F1** | Stripe live mode | the price sentences in panel 8 describe a working payment | `Invite.tsx:2` |
| **S1** | The Resend sending domain | the calendar card's "everyone gets the month by email on the 1st"; the contact form's delivery; any email the page mentions | `CalendarPanel.tsx:1` |
| **D2** | `.doc` and `.ppt` | the FAQ's list of file types, and "a file it cannot read, it says so" | nowhere yet — the FAQ has no words (step 30) |
| **F6** | The checklist (template) audit | panel 2b's scene: a customer's checklist in, a binder out | `BinderPanel.tsx:2` |
| **F7** | Audits on the shared chat engine (`lib/ask/`) | the question typed into the audit panel's box, and the conversation line on panel 2a | **nowhere — see the drift below** |
| **F12** | Chat over documents | the question typed into the documents panel's box, and the conversation line on panel 4 | `DocumentsPanel.tsx:1` (as "no PENDING id yet" — the id is new today) |

**F6 is still a hypothesis, and step 35 did not settle it** (`BinderPanel.tsx:2`: "Do not resolve it here").
`docs/PENDING.md` F6 says the template audit "returns **400** with a sentence saying it is not ready" and that "the
attach control is inert and says so". Read on 2 November: `app/api/audit-runs/route.ts:47` does have the
`kind === 'template'` branch, and the lines after it fetch the attached document rather than refuse; the phrase
"not ready" appears **nowhere** in `app/api/audit-runs/route.ts`, `app/audits/page.tsx` or `lib/auditRun.ts`; and
`app/audits/page.tsx:615`–`:618` is a working button that opens a file picker, with `:447` setting the notice
"Choose the checklist and we will audit against every line of it." **That is three readings of one feature and this
file settles none of them** — it is step 33's job, and it needs the thing run, not grepped.

**Two things become real the day the page has a Start button and are not page work** (§5's own closing note): the
unthrottled signup (`PENDING.md` S2) and the key-rotation gate.

### The one drift worth fixing before step 33

**F7 has no mark on the audit panel.** §5 assigns F7 to "the question typed into the audit panel's box, and the
conversation line on panel 2a", and §2 rule 1 says every sentence waiting on a gate item is marked in its panel's
file — but `components/home/AuditPanel.tsx:1` carries **only** `GATE F4`, and the panel does show the box
(`WORDS.typed`, "Audit us for Oregon DEQ") and does say "Ask a follow-up; it remembers the conversation"
(`WORDS.under`). Step 35 was told "no code", so the comment was not added. **Add it at step 33, or before.**
F7 itself is unchanged: `grep -rn "lib/ask" app lib components` returns Calendar's three call sites and nothing
else, so Audits is still on its own engine.

---

## 6. What is deliberately NOT done, and why

1. **The four content pages' words (Part C, steps 27–30).** Deferred 2 November on the owner's word: what the
   privacy page may claim depends on what the app does the day it ships, and the app is still being finished. The
   stubs each say, in one line, that the page is being written before launch — nothing more, because a page with
   no content must not pretend to have some. **THE ROBOTS EXPORT COMES OFF WHEN THE WORDS GO IN** — it is the last
   line of each of steps 27–30, it is written in capitals at the top of all four page files, and the reason is that
   an empty page Google has indexed as "Terms of use" is worse than no page at all: the index keeps the empty one
   and shows it to the person searching for the real one. Step **27a**, the privacy map, is still the first move
   when Part C resumes, because it is what makes the words true rather than generic. Decision 8: the legal pages
   are drafted as a starting point for a lawyer, the note saying so lives in the page files' comments and in
   `docs/LEGAL-REVIEW.md` (**which does not exist yet**), never on the page.
2. **`/contact` (step 30a).** Decision 13: no email address anywhere public, a short form with a bot check instead.
   It rides gate **S1** because it delivers through Resend, and **where it delivers is still open** (§7 below). The
   footer has no address and nothing replaces it until this exists.
3. **The signed-in redirect at `/`** (§7b). A signed-in visitor who types the bare domain should land on
   `/dashboard`. Taken out of step 25 on 31 October: this app has **no server-side session anywhere** —
   `lib/supabase.ts:1` imports `createBrowserClient`, nothing imports `createServerClient`, there is no
   `middleware.ts`, and every signed-in page guards itself in a `useEffect` — so the redirect is a middleware that
   sees every request in the app, not "a few lines". Its own job, after a study of every path that reaches `/`,
   including `app/account/page.tsx:1077`, which lands a just-deleted company on `/` on purpose. Until then a
   signed-in visitor sees the homepage with Sign in and Start free, which is wrong-ish, not broken.
4. **The domain (Part D, steps 31–32).** DNS at GoDaddy for compliboard.com and the Resend sending-domain records
   (S1); then `NEXT_PUBLIC_APP_URL` on Vercel, Supabase Auth's Site URL and redirect list carrying both hosts
   during the switch, the four `from:` lines, and the Stripe webhook address when F1 lands. Each read back, not
   assumed. Propagation takes hours, so step 31 can start early; it blocks nothing meanwhile.
5. **The gate check (step 33).** F4, F1, S1, D2, F6, F7 and F12 against the shipped product, every gate comment in
   `components/home/` walked, and the owner's own walk of the page against the app. **Re-check "no analytics, no
   trackers, no third-party scripts" there too** (§7a) — it is true today and is the kind of thing that gets added
   quietly, and the privacy and security pages are about to state it.
6. **The push and the release** (steps 34 and the box at the top).

---

## 7. What an APP session owes — every item §7a leaves outside `components/home/`

*Nothing in the running app was changed by this work, by the owner's standing rule for the session. These are what
it found while not changing it.*

1. **⚡ `lib/signupView.ts:97` tells a person whose signup failed to "Email hello@compliboard.com and we will clear
   it so you can try again."** That mailbox does not exist (decision 13). It is the sentence a person reads at the
   exact moment they cannot become a customer, and the mail goes nowhere. **The most serious of these four.**
2. **`components/AppLayout.tsx:464` is a `mailto:hello@compliboard.com`** in the signed-in shell's footer. Same
   dead mailbox. Both become a link to `/contact` once it exists — a two-line change.
3. **`app/layout.tsx:182`–`:185` sets a site-wide description, "Compliance made simple".** The homepage and the
   four stubs now carry their own; every other page inherits that one.
4. **`lib/billingView.ts:50` (`PLAN_NOTE`) says "for everyone at your company".** The homepage is forbidden to say
   "everyone" because seats may be limited by API cost (`Invite.tsx:3`); the app already says it to paying
   customers. **The owner's call whether that line changes too.**

Already fixed as a side effect, with nothing in the app touched: the shell's two dead links to `/privacy` and
`/terms` (`components/AppLayout.tsx:462`–`:463`) now land, because step 25a built the pages.

---

## 8. The boards and the reports

**The boards are on the canvas "CompliBoard Homepage Boards"** — eighteen boards, drawn by the public-pages chat
and approved by the owner one at a time before any of them was built, and carrying step 12's word changes as well
(the plan's step 12 entry, canvas note s12). **There is no export of that canvas on this machine.** Step 35 looked:
`docs/` holds `account-boards.html`, `calendar-boards.html` and `dashboard-boards.html` but no public-pages
equivalent; `~/Downloads` holds `compliboard_homepage_mockup.html`, which is from **15 June 2026**, months before
this plan was written, and is not it. **So `docs/boards/public-pages/` was not created and the canvas remains the
record.** If an export is made later, it belongs in `docs/` beside the other three, named
`public-pages-boards.html`.

**The reports are three, not four**, all under `docs/reports/`:

| Report | What it holds |
| --- | --- |
| `public-pages-13-map.md` | The read-only map: the old homepage, every link to `/`, the redirects, §8's list of what the swap had to do |
| `public-pages-13-15.md` | Steps 13, 14 and 15 with the measurements |
| `public-pages-12-words.md` | The words check: §A every sentence and where the product says it, §B the five facts with URL, date and quote, §C the hard-rule greps, §D the checklist cut, §F the files changed, §G/§G.1 step 12b |

Steps 25a, 25 and 35 were reported in the session rather than as files, by their own briefs; what they proved is in
`docs/PUBLIC-PAGES-PLAN.md` §6 and in §2 of this file.

---

## 9. What this work changed outside `components/home/` (CLAUDE.md §9.1)

| File | Change | Effect elsewhere |
| --- | --- | --- |
| `app/page.tsx` | the old marketing page replaced by the moved preview page | **`/` is a different page.** The old page's "$49 / $29 a month, early adopter price locked forever" went with it — the one visitor-facing number that moved |
| `components/HomepageSection.tsx` | deleted | none: it had one caller, the page that was deleted |
| `public/Hero2.png`, `How_it_works_6.png`, `Audit_report_4.png` | deleted | none: each re-grepped on 2 November, one hit apiece, all in the deleted page. The ten other files in `public/` are referenced by nothing and were **left alone** — deleting them is the owner's call |
| `app/privacy|terms|security|faq/page.tsx` | four new routes | the signed-in shell's two dead links now land |
| `app/globals.css:28`–`:40`, `:44`–`:57` | additive tokens and `.home-screen` | none: no app screen reads them |
| `app/account/page.tsx:1077` | **untouched** | it still lands a just-deleted company on `/`, which is now the new page — the behaviour `tests/unit/dashboardView.test.ts:348` describes, with new words |
| `scripts/measure-layout.mjs` | **untouched** | its public-pages block is keyed on the `data-public-page` attribute (`:587`), not on a path, so the swap needed no change to it |

No `lib/`, no API route, no migration, no test file was changed by any of the twenty commits.

---

## 10. Open questions — `docs/PUBLIC-PAGES-PLAN.md` §7, verbatim

> ## 7. Open, waiting on the owner
>
> - ~~The legal entity name and state~~ — confirmed 31 Oct: **CompliBoard LLC, registered in Oregon.** The terms name it and take Oregon for the governing-law line; `docs/LEGAL-REVIEW.md` asks the lawyer to confirm the venue wording and whether the Oregon Consumer Privacy Act reaches a company this size, since the answer changes the privacy page's rights section.
> - ~~Whether hello@compliboard.com receives mail~~ — answered 31 Oct: **it does not exist.** See decision 13.
> - **Where the contact form delivers.** A private address nobody publishes, or a mailbox the owner already reads. Needed before step 30a can send anything.
> - ~~Which hero line~~ — chosen 30 Oct (see §4).

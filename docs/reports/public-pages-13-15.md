# Public pages — steps 13, 14 and 15: the map, the frame, the hero

**Written:** 30 October 2026. **Started from** `5dea8db` ("Housekeeping: archive what is no longer
live, and one pending list"). Nothing is pushed. No model was called at any point in this job, and
no run touched staging or production data.

---

## 1. The three commits

| step | hash | subject |
|---|---|---|
| 13 | `6901ddb` | Public pages 13: read-only map of the homepage and the public surface |
| 14 | `b3a9c71` | Public pages 14: the frame, nav, footer and waves at /preview-home |
| 15 | `8caf1ce` | Public pages 15: the hero at /preview-home |

## 2. Every file created, and every existing file changed

**Created (8):**

| file | what |
|---|---|
| `docs/reports/public-pages-13-map.md` | step 13's map — the read-only answer, with a file and a line per claim |
| `docs/reports/public-pages-13-15.md` | this report |
| `app/preview-home/page.tsx` | the ordered list of panels, and the `noindex` |
| `components/home/Frame.tsx` | the panel shape, with no words in it; exports `EDGES` |
| `components/home/Nav.tsx` | the 72px nav; exports `Wordmark` |
| `components/home/Footer.tsx` | the one-line footer |
| `components/home/Waves.tsx` | the green waves, inline SVG, two variants |
| `components/home/Hero.tsx` | panel 1 |

`docs/PUBLIC-PAGES-PLAN.md` was untracked at the start and is committed in `6901ddb` unchanged —
it was the owner's file sitting in the working tree, not a change this job made.

**Changed (3 existing files). The exact added lines:**

### `app/globals.css` — 25 lines, all additive. Nothing that existed was touched.

```css
  /* Public pages (homepage and the four content pages). Additive; the app does not use these yet. */
  --wave-1:      #DCEDE2;
  --wave-2:      #A9D1B7;
  --wave-3:      #5FA57C;
  --blue:        #2B5FA8;
  --blue-wash:   #EAF0FA;
  --red-muted:   #A8453A;
  --red-wash:    #FBEDEB;
```

…and, after the `:root` block, one class (the comment above it is in the file):

```css
@media (min-width: 1024px) {
  .home-screen {
    min-height: 100vh;
    min-height: 100svh;
  }
}
```

**This class is more than the instruction asked for, so it is called out rather than buried.**
The instruction asks each panel for "min-height 100vh (use 100svh where supported)". That is two
declarations of one property, in order — the fallback *is* the order. Two Tailwind utilities for
one property (`lg:min-h-screen lg:min-h-[100svh]`) leave the winner to whatever order Tailwind
emits them in, which is not something the call site controls and not something a reader can see.
Written here, the order is the file's. `grep -rn "home-screen" app components` finds only the two
public components; no app page uses it.

### `components/buttonStyles.ts` — 16 lines, one new export, nothing existing changed.

PRIMARY's size **cannot** be overridden cleanly at the call site, for the same reason as above:
`px-4` and `px-[22px]` are the same utility twice. So, exactly as the instruction's fallback
allows, a string beside the others:

```ts
export const PRIMARY_LARGE =
  'cursor-pointer rounded-md bg-[var(--green)] px-[22px] py-[13px] text-[15px] font-medium text-white ' +
  'hover:bg-[var(--green-ink)] disabled:cursor-not-allowed disabled:opacity-50'
```

It is PRIMARY character for character apart from `px-4 py-2 text-[14px]` → `px-[22px] py-[13px]
text-[15px]`. 15px is already on `DESIGN.md` §1's scale (the seventh size, set deliberately for
drawer description text), so this adds a size of **button**, not a size of type. `PRIMARY`,
`SECONDARY_LARGE`, `OUTLINE` and `TEXT_ACTION` are untouched, so no app screen moves.

### `scripts/measure-layout.mjs` — 45 lines, one additive block plus three print lines.

This is the change step 13 said would be needed and did not make. The harness is built for a
signed-in page: it finds the column as `.print-page` or the 900 wrapper (`:465`) and the top bar as
a `<header>` containing `a[href="/dashboard"]` (`:553`–`:554`). On a public page it printed
`column box no column found` and `logo none`, and **none of the three things step 15 is judged on
were printed by anything**: the wordmark's x, a section's height against the viewport, and
horizontal overflow (`:582` prints the *vertical* scrollbar only).

The block is keyed on `[data-public-page]`, a marker no app page carries, and adds to the one
`evaluate()` return: every `a[href="/"]`'s text and left x; every `[data-public-section]`'s height,
top and name; `window.innerHeight`; and `documentElement.scrollWidth − clientWidth`. The printing
is three lines, inside `if (o.publicPage)`. **On every existing page `publicPage` is `null` and the
output is byte-for-byte what it was.** The markers themselves are two attributes on new files:
`data-public-page="preview-home"` on the page's `<main>`, and `data-public-section` on `Frame`'s
and `Hero`'s `<section>`.

One thing that block cost and is worth recording: the comment inside it was first written with
backticks, which **ended the template literal the whole browser-side block lives in** — the file
warns about this in three places and I did it anyway. `node --check scripts/measure-layout.mjs`
caught it before any run; the comment now says so in the file.

## 3. The measurement for the hero, at the three widths

Pasted as printed. The first three are the dev server on port 3997; the fourth is the production
build on port 3996.

**1440 —** `npm run measure -- /preview-home --base http://localhost:3997 --width 1440 --shot shots/pp-15-hero-1440.png`

```
  /preview-home at 1440px (vertical scrollbar 15px) as testcascade@example.com
  title            x=233   "You do compliance on top of two other jobs."
  column box       no column found
  column content   -
  tab row          none
  footer content   233–1193   text starts x=null
  wordmark         x=233   "CompliBoard"
  wordmark         x=233   "CompliBoard"
  section          hero       height 900px  (viewport 900px, at least a screen)  top y=0
  horizontal       scrollWidth 1425 − clientWidth 1425 = 0px (nothing overflows)
  top bar          height 72px   logo none   breadcrumb none
  drawer           none open
  font title       sourceSerif, "sourceSerif Fallback"   rendered: Source Serif 4 (web font, 41 glyphs)
  font body text   no .print-page p, main [class*="max-w-[900px]"] p
  screenshot       shots/pp-15-hero-1440.png

  BLOCKED (0): nothing — no paid route and no write was attempted
```

**1280 —** `npm run measure -- /preview-home --base http://localhost:3997 --width 1280 --shot shots/pp-15-hero-1280.png`

```
  /preview-home at 1280px (vertical scrollbar 15px) as testcascade@example.com
  title            x=153   "You do compliance on top of two other jobs."
  column box       no column found
  column content   -
  tab row          none
  footer content   153–1113   text starts x=null
  wordmark         x=153   "CompliBoard"
  wordmark         x=153   "CompliBoard"
  section          hero       height 900px  (viewport 900px, at least a screen)  top y=0
  horizontal       scrollWidth 1265 − clientWidth 1265 = 0px (nothing overflows)
  top bar          height 72px   logo none   breadcrumb none
  drawer           none open
  font title       sourceSerif, "sourceSerif Fallback"   rendered: Source Serif 4 (web font, 41 glyphs)
  font body text   no .print-page p, main [class*="max-w-[900px]"] p
  screenshot       shots/pp-15-hero-1280.png

  BLOCKED (0): nothing — no paid route and no write was attempted
```

**390 —** `npm run measure -- /preview-home --base http://localhost:3997 --width 390 --shot shots/pp-15-hero-390.png`

```
  /preview-home at 390px (vertical scrollbar 15px) as testcascade@example.com
  title            x=16   "You do compliance on top of two other jobs."
  column box       no column found
  column content   -
  tab row          none
  footer content   16–359   text starts x=null
  wordmark         x=16   "CompliBoard"
  wordmark         x=16   "CompliBoard"
  section          hero       height 843px  (viewport 900px, SHORTER THAN THE SCREEN)  top y=0
  horizontal       scrollWidth 375 − clientWidth 375 = 0px (nothing overflows)
  top bar          height 72px   logo none   breadcrumb none
  drawer           none open
  font title       sourceSerif, "sourceSerif Fallback"   rendered: Source Serif 4 (web font, 41 glyphs)
  font body text   no .print-page p, main [class*="max-w-[900px]"] p
  screenshot       shots/pp-15-hero-390.png

  BLOCKED (0): nothing — no paid route and no write was attempted
```

**1440, against `next build && next start` on port 3996 —**
`npm run measure -- /preview-home --base http://localhost:3996 --width 1440 --shot shots/pp-15-hero-1440-prod.png`

```
  /preview-home at 1440px (vertical scrollbar 15px) as testcascade@example.com
  title            x=233   "You do compliance on top of two other jobs."
  column box       no column found
  column content   -
  tab row          none
  footer content   233–1193   text starts x=null
  wordmark         x=233   "CompliBoard"
  wordmark         x=233   "CompliBoard"
  section          hero       height 900px  (viewport 900px, at least a screen)  top y=0
  horizontal       scrollWidth 1425 − clientWidth 1425 = 0px (nothing overflows)
  top bar          height 72px   logo none   breadcrumb none
  drawer           none open
  font title       sourceSerif, "sourceSerif Fallback"   rendered: Source Serif 4 (web font, 41 glyphs)
  font body text   no .print-page p, main [class*="max-w-[900px]"] p
  screenshot       shots/pp-15-hero-1440-prod.png

  BLOCKED (0): nothing — no paid route and no write was attempted
```

**The three readings the instruction asks for, read off those four runs:**

1. **The h1's left x equals the wordmark's left x at every width.** 233 / 233 at 1440 (and again on
   the production build), 153 / 153 at 1280, 16 / 16 at 390. Two wordmarks print because the nav's
   and the footer's are the same component — both sit at the same x as the headline, which is the
   thing `EDGES` exists to guarantee. (233 rather than 240 because the measured viewport is 1425:
   Chrome's 15px scrollbar is inside the window, and `(1425 − 1200) / 2 + 120 = 232.5`.)
2. **Nothing overflows horizontally at 390.** `scrollWidth 375 − clientWidth 375 = 0`. The waves
   *are* wider than the screen on purpose; the scrolling box is not, which is the only reading that
   means anything.
3. **The hero is at least a viewport tall at 1440 and 1280.** 900px against a 900px viewport at
   both, on the dev server and on the production build. At 390 it is 843px, and that is correct and
   deliberate: below 1024px no height is forced (`.home-screen` is inside a `min-width: 1024px`
   query), so a phone stacks naturally. The harness's "SHORTER THAN THE SCREEN" is a statement, not
   a failure — the rule it is checking does not apply at that width.

Also read, and not asked for: the headline renders in **the real Source Serif 4 web font**, not its
size-adjusted fallback, on both servers. `BLOCKED (0)` on all four runs — nothing paid, nothing
written.

## 4. The `noindex` curl

Against the dev server:

```
$ curl -s http://localhost:3997/preview-home | grep -c "noindex"
1
```

Against the production build, which is what will actually be served:

```
$ curl -s http://localhost:3996/preview-home | grep -c "noindex"
1
```

The line itself, from the served HTML of both:

```
<meta name="robots" content="noindex, nofollow"/>
```

**And one correction in passing, because it is the exact trap `CLAUDE.md` §9a names.** The first
run of that curl against port 3996 printed **`0`**, and "the production build drops the robots
meta" is a plausible, wrong, and file-able conclusion. It was a server that had not finished
starting — the readiness loop had never printed its "up" line, which I did not look at. Proving the
check could see a *presence* (`curl -o /dev/null -w "%{http_code}"` → 200, then the meta tag
itself) is what settled it. Nothing was changed in response to the 0.

## 5. The screenshots

| file | what |
|---|---|
| `shots/pp-14-frame-1440.png` | step 14, the frame at 1440 (nav and footer, no panels yet) |
| `shots/pp-14-frame-390.png` | step 14, the same at 390 |
| `shots/pp-15-hero-1440.png` | step 15, the hero at 1440 |
| `shots/pp-15-hero-1280.png` | step 15, the hero at 1280 |
| `shots/pp-15-hero-390.png` | step 15, the hero at 390 |
| `shots/pp-15-hero-1440-prod.png` | step 15, the hero at 1440 from the production build |

Six, not four: the two step 14 shots are the ones that instruction asked for, and the four step 15
ones are the four that instruction asked for. The dark circle at the bottom left of every dev shot
is Next's own development indicator; it is absent from `pp-15-hero-1440-prod.png`, which is one
more thing that shot is for.

Two throwaway shots (`pp-14-frame-probe-*.png`) were taken during step 14 and **deleted**: see §8.

## 6. What the footer links do today, and where that is fixed

`/privacy`, `/terms`, `/security` and `/faq` **all 404 today.** `ls app` shows no directory for any
of them. They are written at Part C of the plan — step 27 (privacy), 28 (terms), 29 (security), 30
(FAQ) — and the gate for the swap is step 25, which cannot run before them.

That is acceptable here and only here, because `/preview-home` is unlinked and `noindex`: nobody
can arrive at it. The reason is written into `components/home/Footer.tsx`'s own header so it cannot
be read as an oversight.

**And they are not new.** The app's own shell footer has linked to two of them all along —
`components/AppLayout.tsx:462` (`/privacy`) and `:463` (`/terms`) — so every signed-in user already
has two dead links at the bottom of every page. Found by step 13, not changed by this job, fixed by
steps 27 and 28. The same footer prints `© 2026 CompliBoard LLC` (`:466`), which is one of the two
things `PUBLIC-PAGES-PLAN.md` §7 lists as open — the owner has an entity name to **confirm** rather
than supply.

`hello@compliboard.com` in the new footer is **text, not a `mailto:` link**, deliberately: whether
that address receives mail is the other item in §7. A link invites a visitor to write to an address
that may bounce. It becomes a link the day the answer is yes.

## 7. §9.1 — the effects on other sections, by file

**None.** Stated as evidence rather than as a claim:

```
$ git diff --stat 5dea8db HEAD
 app/globals.css                     |  25 ++++
 app/preview-home/page.tsx           |  42 ++++++
 components/buttonStyles.ts          |  16 +++
 components/home/Footer.tsx          |  46 +++++++
 components/home/Frame.tsx           |  88 +++++++++++++
 components/home/Hero.tsx            | 102 +++++++++++++++
 components/home/Nav.tsx             |  59 +++++++++
 components/home/Waves.tsx           |  66 ++++++++++
 docs/PUBLIC-PAGES-PLAN.md           | 133 +++++++++++++++++++
 docs/reports/public-pages-13-map.md | 252 ++++++++++++++++++++++++++++++++++++
 scripts/measure-layout.mjs          |  45 +++++++
 11 files changed, 874 insertions(+)
```

**874 insertions and 0 deletions, across 11 files.** `app/page.tsx` is not in that list.
`components/AppLayout.tsx` is not in that list. Neither is `components/HomepageSection.tsx`, nor
any page under `app/` other than the new `app/preview-home/`, nor any file under `lib/`, `tests/`,
`supabase/` or `prompts/`. The three existing files that do appear are each additive only — new
tokens, a new class, a new export, a new block — which is why the count has no deletions in it.

Taken one at a time:

- **`app/globals.css`** is loaded by every page in the product, so it is the one file here that
  *could* reach the app. Seven new custom properties on `:root` change nothing until something
  reads them, and `grep -rn "wave-1\|wave-2\|wave-3\|--blue\|red-muted\|red-wash" app components`
  finds only `components/home/`. `.home-screen` is a new class name used by two new files.
- **`components/buttonStyles.ts`** gains one export. The four existing strings are byte-identical,
  so the workspace, HR and everything importing them is unmoved.
- **`scripts/measure-layout.mjs`** is a harness, not shipped code. Its new block is inside
  `if (publicRoot)` / `if (o.publicPage)`, and `publicRoot` is `[data-public-page]`, which exists
  on exactly one page in the repository. Every existing measurement prints exactly what it did.
- **`npm run check` is green at each of the three commits** — typecheck, the schema contracts, 2063
  tests in 510 suites with 0 failures and 0 skipped, and a clean `next build` with `/preview-home`
  prerendered static. That is the project-wide statement that nothing else moved.

The one thing to carry forward: **step 25 must delete the `robots` export** when this file becomes
`app/page.tsx`. There is no `app/robots.ts`, no `app/sitemap.ts` and no `public/robots.txt` in this
project to contradict it, so nothing would warn. It is written at the top of
`app/preview-home/page.tsx` and in §8 of the step 13 map.

## 8. What I could not do, or chose not to

- **`components/home/Frame.tsx` has no caller yet, and will not have one until step 16.** That is
  the instruction's own ordering (step 14 builds the frame, step 16 is the first panel), but it
  means the usual acceptance condition — a reader — is not met, and a component that only
  typechecks has not been seen to work. So at step 14 I rendered **two throwaway panels** on the
  page locally (one grey with waves, one white without), photographed them at 1440 and 390, took
  them out again, and deleted the two probe screenshots. They are not in any commit. **It found a
  real fault:** the waves stopped dead at the page's 120px margin, which at 1440 is a hard vertical
  edge in mid-air. They now run 240px past the column and off the side of the screen, where the
  section's `overflow-hidden` cuts them. Without the probe that would have shipped to step 16 and
  been found by eye.
- **The three hero lines point at `#audit`, `#calendar` and `#hr`, which do not exist yet.** The
  instruction says so, and it is written in the file. A same-page anchor with no target leaves the
  page where it is — the quietest possible failure — which is the argument for writing them now
  rather than wiring them later and forgetting.
- **The three lines are weight 400, not 300.** The instruction says "weight 300 if the font has it
  else 400". It does not have it: Source Serif 4 is self-hosted here and every one of its six
  `localFont` calls declares weights 400 and 600 only (`app/layout.tsx:172`–`:173` for the Latin
  call). `grep -o "weight: '[0-9]*'" app/layout.tsx` returns twelve 400s, six 500s and twelve 600s
  — no 300 anywhere. Asking for 300 would either snap back to 400 or invite a browser to
  synthesise a weight nobody drew.
- **`npm run measure` could run against a login-free page with no change at all** — step 13 said so
  and it proved true; its sign-in is unconditional but it is not a precondition of the page. The
  change I did make to it is about what it *prints*, not what it can open, and it is additive
  (§2).
- **The step 14 frame page has no `<h1>`, so the harness waits out its 40-second readiness loop**
  (`:276`–`:280`, which polls for `document.querySelector('h1')`). Not a failure — the measurement
  proceeds — and from step 15 the hero supplies an h1, so it is a one-off slow run and not worth a
  change to the harness.
- **Nothing was pushed, nothing was deployed, and no model was called.** The two local servers were
  started under `npm run haiku -- …` (`CLAUDE.md` §3.4a) even though nothing on these pages can
  reach a model: the guard printed `14 of 14 tiers on claude-haiku-4-5` before each one started.
  Port 3000 was checked with `lsof` first and left alone — the owner's dev server is on it. Mine
  were 3997 (dev) and 3996 (production build), both stopped afterwards.
- **I did not touch `app/page.tsx`, the four content pages, or anything the plan assigns to a later
  step**, and I did not create `/privacy`, `/terms`, `/security` or `/faq` to make the footer links
  work — the instruction says not to, and a stub page that says nothing is worse than a 404 that
  says it is not there yet.
- **One judgement the owner may want to reverse by eye:** the h1's `max-width: 17ch` is the
  instruction's number, and at 60px it breaks the headline as *"You do / compliance on top / of two
  other jobs."* — "You do" alone on the first line. It is what 17ch gives and I left it; widening
  to about 20ch would put "You do compliance" together. It is a look, not a fault, which is why it
  is here and not a change.

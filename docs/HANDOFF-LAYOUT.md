# HANDOFF — LAYOUT PASS ON THE COMPLIANCE WORKSPACE PAGE

*Written 23 September 2026 by the chat that shipped the research section. Read this first, then the files in §8, then answer the owner's first message.*

---

## 1. What this chat is for

Make the Compliance Workspace page (`/compliance`) visually right, then write down the rules so every other section is built to the same look. The owner's words: "we'll make this page perfect and copy the same layout to other sections."

This chat is design only. No prompts, no pipeline, no routes, no schema. If a change needs any of those, it belongs to another chat — say so and move on.

**Finish line.** The owner signs off on every screen of the page, and `docs/DESIGN.md` exists: tokens, components, and rules that a later section can be built from without asking. Both committed.

## 2. Who does what

Three roles, and they stay separate (`docs/HOW-WE-BUILD.md` §1):

- **Chat (you)** — looks at screenshots, proposes changes in plain words, writes instructions for Claude Code. Never touches the repo.
- **Claude Code** — makes the changes in `app/compliance/page.tsx`, `components/AnswerBody.tsx`, `app/globals.css` and the like. Runs the checks. Commits.
- **The owner (Bhaskar)** — decides. Sends screenshots. Runs the dev server and pushes to production.

Terminals: T1 runs `npm run dev`, T2 runs Claude Code, T3 is for anything else.

## 3. Where things stand

The research/checklist section is **live on production** as of 23 September. Migrations through 039 are on production. Vercel Production variables are set (Opus 5 for research and checklist, Sonnet 5 for micro-steps and summaries, effort medium, `RESEARCH_PREFER_GOV`, `RESEARCH_SPECIALIST`, `RESEARCH_PROVENANCE` all `true`, `CRON_SECRET` set). There is **no staging deployment** — "staging" means the owner's laptop pointed at the staging database. A `git push` to `main` deploys production.

The page was rebuilt in Run 3 from the prototype at `prototypes/compliance-workspace.html`. That prototype is the design reference. Where the page and the prototype differ, the prototype won; where the prototype was silent, the old page's behaviour was kept.

**Standing rule for building:** develop and test on the cheapest model (`claude-haiku-4-5` in `.env.local`); the real model is for judging output only. For a layout pass this means Claude Code never needs Opus. Every Claude Code report ends with the session's cost from `npm run cost`.

## 4. Design decisions already made — do not reopen

These were settled with the owner while building the prototype and the live page. Apply them; don't relitigate them.

- **Fonts.** IBM Plex Sans for the interface. Newsreader (serif) for answers and the big headings. The owner chose this pairing explicitly over system sans.
- **Colour.** Cool grey page (`#F7F8FA`), white surfaces, near-black ink. One green accent, lightened at the owner's request to about `#2F7D52`; the dark forest green was "too strong". Green appears only where it means something: the active tab, citation markers, the send arrow, progress, done ticks. Amber only for a safety note and "attention" states.
- **Header.** "Compliance Workspace" title with a one-line explanation, fixed at the top. Tabs under it: **Ask a question · Conversations · Checklists (n)**. "New conversation" at the right end of the tab row.
- **Opening state.** One input box, about half an inch under the tab line. Under it three equal-width, slim pill buttons: **Research this** (filled green), **Make a checklist**, **Attach a file**. Then one quiet line of example questions. Nothing else. The owner cut everything that was "crowded".
- **In conversation.** The box docks to the bottom with a paperclip and a green send arrow; the arrow becomes a stop square while an answer streams. The three pills and the examples disappear. User messages sit right as light-green bubbles; answers run full width on the left. Uploaded files show as a card on the user's side.
- **Lists (Conversations, Checklists).** No boxes. Rows straight on the page background separated by a hairline. Title, then a small meta line. Delete is plain text that appears on hover (always visible under 820px). The owner rejected white panels and boxed buttons twice.
- **Drawers.** Clicking a row opens a drawer from the right, over a dimmed page. Summary drawers and checklist drawers both. Footer buttons are honest to what exists: "Open the conversation" only while the transcript still exists; "Open the checklist" only if one was made; Download always. Escape and click-outside close it.
- **Disclaimer.** In a page footer, above the safe area. Never in the composer.
- **Vocabulary.** "Checklist" everywhere. Never "action items", never "saved".
- **Tone rule.** Every failure message says what we couldn't do and offers the way forward. Never "unsupported" or "error".

## 5. Known visual issues carried in

- The specialist prompt sometimes echoes as a heading: "What you didn't ask but should know". A prompt matter, not layout — leave it.
- Source titles can still be junk on rare pages; the cleaner in `lib/sourceTitle.ts` handles the common cases.
- Citation markers print inline now; the drawer prints alone. Both fixed in Fix Round 1. Verify rather than assume.
- An **agency card** (the agency named in the answer, with address and phone, as ChatGPT shows a map) is a wanted feature. Design a place for it in this pass; the data behind it is a later job.
- Examples on the opening screen are three cross-industry questions in a config file. The owner will edit them per vertical.

## 6. How to run this pass

Screen by screen, in this order: opening state → a conversation with a long answer (tables, citations, sources) → Conversations tab → a summary drawer → Checklists tab → a checklist drawer with micro-steps → the narrow (phone) layout → print of a checklist.

For each screen: the owner sends a screenshot, you say what to change in plain words and why, then you write **one** instruction for Claude Code covering every change for that screen — not one instruction per tweak. Fewer relays. Claude Code runs `npm run check`, commits, and the owner reloads.

When all screens are signed off, write `docs/DESIGN.md`:
1. Tokens: colours, fonts, sizes, spacing, radii — as CSS variables with their values.
2. Components: header, tabs, row, drawer, card, pill button, composer, file card, answer body, footer — what each looks like, when it's used.
3. Rules: green means state; no boxes around lists; drawers not new pages; failure copy; vocabulary.
4. A short checklist for building a new section to this layout.

Then push. Layout changes need no migration.

## 7. Writing rules for this chat

Plain sentences. Short paragraphs. One idea each. Name things by what they do. One instruction for Claude Code at a time, in a single code block so it copies with one click. Never narrate the memory system.

## 8. Read these before answering

1. `docs/HANDOFF-CODE.md` — exact state of the code, from Claude Code.
2. `prototypes/compliance-workspace.html` — the design reference; open it in a browser as well as reading it.
3. `docs/HOW-WE-BUILD.md` §1 and §6 — roles, and how to write instructions.
4. `docs/TESTING.md` — the manual tests for the page; the layout pass must not break any.
5. `docs/DECISIONS.md` §113 and §126 onward — search, don't read end to end.

## 9. The first thing to do

Tell the owner in a few lines what you understand the page to be and the finish line to be. Then ask for the first screenshot: the opening state, desktop width.

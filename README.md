# CompliBoard

CompliBoard tells a business what it must do to be compliant, and proves it against their real
documents. It is sold to SMBs one industry vertical at a time, starting with chemical manufacturing
in Oregon.

The one-sentence architecture: **the Requirements module answers "what does this company have to
do?" deterministically, so that "what's missing" is a database query and never an AI guess.**

## What a new customer walks into — part B released 22 October 2026

1. **Signup asks four things** — work email, password, company name, and a website that is optional
   and worth giving. The account, the company and its main site are created in **one transaction**:
   together or not at all.
2. **The website is read once**, and it **proposes**. Nothing it says is written on its word.
3. **Three screens**, every one leavable: *Here's what we found* — the sentence about the business,
   the broad industry, the main site's address, each as plain text with a small `change` — then
   three questions from the fact library, then done.
4. **"Yes, that's us" saves what is on the card**, through the routes that already own those tables:
   the words straight onto `companies` under a column grant, every address through the geocoder.
5. **The Dashboard** says *"Welcome, ‹their company›"* on the first visit and *"Welcome back"*
   after, and carries on asking the three questions another day.

Released in two parts: **part A** on 21 October (My Account's five tabs — the company, its sites,
the people who can sign in, how you sign in, cancelling) and **part B** on 22 October (the front
door above). **Next: part C, billing** — Stripe, the card page and the read-only state after a
trial ends, which is `docs/ACCOUNT-PLAN.md` steps 17–21.

**Where the real documentation is:** `CLAUDE.md` for the rules, `docs/HOW-WE-BUILD.md` for the
method, `docs/DECISIONS.md` for every decision and why, `STATUS.md` for what works today, and
`docs/RELEASE.md` for how a release is actually run.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

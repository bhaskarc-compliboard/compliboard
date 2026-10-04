import type { Metadata } from 'next'
import localFont from "next/font/local";
import "./globals.css";

// The agreed typefaces — IBM Plex Sans and Source Serif 4 — SELF-HOSTED, from `app/fonts/`.
//
// *** WHY LOCAL AND NOT `next/font/google`. *** `next/font/google` fetches the fonts from Google
// AT BUILD TIME. On 3 October two production builds of cbdc99c failed with 18 Turbopack errors
// ("Can't resolve '@vercel/turbopack-next/internal/font/google/font'"), the known bug
// vercel/next.js#99114: Google sometimes answers with extensionless URLs Turbopack cannot parse.
// A build that depends on a third party's answer is a build that fails for a reason that is not
// in this repository. The files here are the SAME BYTES the Google build served — each one
// SHA-256-matched against `.next/static/media` before it was committed — with each family's OFL.
//
// *** ONE CALL PER SUBSET, BECAUSE `next/font/local` CANNOT GIVE ONE FILE A RANGE. *** Google
// serves each family as six variable-font files, one per character subset (Cyrillic-ext,
// Cyrillic, Greek, Vietnamese, Latin-ext, Latin), each behind its own `unicode-range`, so a page
// downloads only the subsets its text uses. `declarations` apply to every file in a call, so each
// subset is its own call, and all six name the SAME family through `font-family`.
//
// *** THAT FAMILY IS `plexSans` / `sourceSerif`, NOT "IBM Plex Sans", AND THIS IS WHY. *** Turbopack
// names the family in the CSS variable after the JavaScript constant of the call (`plexSans`), and
// ignores a `font-family` declared for it — found by reading the built CSS: with "IBM Plex Sans"
// declared, the faces were named "IBM Plex Sans" and `--font-plex` pointed at "plexSans", a family
// with no face at all, so every page would have drawn the fallback. So every subset declares the
// Latin call's own name, and the variable and all thirty faces agree. The glyphs are the same
// files; only the family's NAME changed, from "IBM Plex Sans" to "plexSans".
//
// Only the Latin call carries the CSS variable, the preload and the fallback metrics, as Google's
// `subsets: ['latin']` did; the other five are declared and fetched only when a page needs them.
// Latin is declared last, as in Google's CSS. A test (`tests/unit/fonts.test.ts`) fails if
// `next/font/google` is imported again.
//
// *** THE VARIABLE NAMES ARE DELIBERATELY NOT `--font-sans` / `--font-serif`. *** Those are the
// names Tailwind's theme uses, and naming both ends the same thing made `@theme inline` emit
// `--font-sans: var(--font-sans)` — a self-reference that only resolved because the class
// happens to sit on the same element that reads it. It worked and it was a trap: anything
// outside <body> reading `font-sans` would have got an invalid value. These names are the
// FONT's; `globals.css` maps them to the theme's.
// Geist and Geist_Mono were the create-next-app defaults and were never chosen for this product.

const plexSansCyrillicExt = localFont({
  src: [
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-cyrillic-ext.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-cyrillic-ext.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-cyrillic-ext.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'plexSans'" }, { prop: 'unicode-range', value: 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F' }],
  preload: false,
  adjustFontFallback: false,
})

const plexSansCyrillic = localFont({
  src: [
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-cyrillic.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-cyrillic.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-cyrillic.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'plexSans'" }, { prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
  preload: false,
  adjustFontFallback: false,
})

const plexSansGreek = localFont({
  src: [
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-greek.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-greek.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-greek.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'plexSans'" }, { prop: 'unicode-range', value: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF' }],
  preload: false,
  adjustFontFallback: false,
})

const plexSansVietnamese = localFont({
  src: [
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-vietnamese.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-vietnamese.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-vietnamese.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'plexSans'" }, { prop: 'unicode-range', value: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB' }],
  preload: false,
  adjustFontFallback: false,
})

const plexSansLatinExt = localFont({
  src: [
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-latin-ext.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-latin-ext.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'plexSans'" }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
  preload: false,
  adjustFontFallback: false,
})

const plexSans = localFont({
  src: [
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans/ibm-plex-sans-latin.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'plexSans'" }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
  variable: '--font-plex',
  preload: true,
  adjustFontFallback: 'Arial',
})

const sourceSerifCyrillicExt = localFont({
  src: [
    { path: './fonts/source-serif-4/source-serif-4-cyrillic-ext.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-serif-4/source-serif-4-cyrillic-ext.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'sourceSerif'" }, { prop: 'unicode-range', value: 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F' }],
  preload: false,
  adjustFontFallback: false,
})

const sourceSerifCyrillic = localFont({
  src: [
    { path: './fonts/source-serif-4/source-serif-4-cyrillic.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-serif-4/source-serif-4-cyrillic.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'sourceSerif'" }, { prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
  preload: false,
  adjustFontFallback: false,
})

const sourceSerifGreek = localFont({
  src: [
    { path: './fonts/source-serif-4/source-serif-4-greek.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-serif-4/source-serif-4-greek.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'sourceSerif'" }, { prop: 'unicode-range', value: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF' }],
  preload: false,
  adjustFontFallback: false,
})

const sourceSerifVietnamese = localFont({
  src: [
    { path: './fonts/source-serif-4/source-serif-4-vietnamese.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-serif-4/source-serif-4-vietnamese.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'sourceSerif'" }, { prop: 'unicode-range', value: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB' }],
  preload: false,
  adjustFontFallback: false,
})

const sourceSerifLatinExt = localFont({
  src: [
    { path: './fonts/source-serif-4/source-serif-4-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-serif-4/source-serif-4-latin-ext.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'sourceSerif'" }, { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF' }],
  preload: false,
  adjustFontFallback: false,
})

const sourceSerif = localFont({
  src: [
    { path: './fonts/source-serif-4/source-serif-4-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/source-serif-4/source-serif-4-latin.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  declarations: [{ prop: 'font-family', value: "'sourceSerif'" }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
  variable: '--font-source-serif',
  preload: true,
  adjustFontFallback: 'Times New Roman',
})

export const metadata: Metadata = {
  title: 'CompliBoard',
  description: 'Compliance made simple',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${sourceSerif.variable} antialiased text-base`}>
        {children}
      </body>
    </html>
  )
}

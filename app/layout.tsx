import type { Metadata } from 'next'
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// The agreed typefaces, loaded through next/font — already a dependency, no package added.
//
// *** THE VARIABLE NAMES ARE DELIBERATELY NOT `--font-sans` / `--font-serif`. *** Those are the
// names Tailwind's theme uses, and naming both ends the same thing made `@theme inline` emit
// `--font-sans: var(--font-sans)` — a self-reference that only resolved because the class
// happens to sit on the same element that reads it. It worked and it was a trap: anything
// outside <body> reading `font-sans` would have got an invalid value. These names are the
// FONT's; `globals.css` maps them to the theme's.
// Geist and Geist_Mono were the create-next-app defaults and were never chosen for this product.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  weight: ["400", "600"],
  subsets: ["latin"],
});

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

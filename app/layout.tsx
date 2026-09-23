import type { Metadata } from 'next'
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// The agreed typefaces, loaded through next/font — already a dependency, no package added.
// Geist and Geist_Mono were the create-next-app defaults and were never chosen for this product.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
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

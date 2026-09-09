import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Self-hosted at build time, so the handwriting survives machines that have no
// script face of their own.
const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-hand",
  display: "swap",
});

// Next's Google catalogue exposes no korean/chinese-traditional subset for
// these families, and the full faces are 1.2 MB and 3.3 MB. The handwriting
// variable is only ever used for static landing copy, so these are subset to
// exactly the glyphs that copy needs. preload is off: a reader only fetches
// the face for the language they are actually reading.
const koreanHand = localFont({
  src: "../fonts/nanum-pen-ko-subset.woff2",
  variable: "--font-hand-ko",
  display: "swap",
  preload: false,
});

const chineseHand = localFont({
  src: "../fonts/lxgw-wenkai-zh-hant-subset.woff2",
  variable: "--font-hand-zh",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Aster — See yourself through your friends",
  description: "A private personality reflection room for close friends.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${handwriting.variable} ${koreanHand.variable} ${chineseHand.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

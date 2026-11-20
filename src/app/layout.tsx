import type { Metadata } from "next";
import { Caveat, Noto_Sans_HK, Noto_Serif_TC } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

// Cloudflare Web Analytics beacon. Set NEXT_PUBLIC_CF_BEACON_TOKEN in the
// Worker environment to enable visitor reporting; without it nothing loads.
const cfBeaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

// Self-hosted at build time, so the handwriting survives machines that have no
// script face of their own.
const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-hand",
  display: "swap",
});

// Next's Google catalogue exposes no korean subset for Nanum Pen Script, and the
// full face is 1.2 MB. The handwriting variable is only ever used for static
// landing copy, so it is subset to exactly the glyphs that copy needs.
// preload is off: only Korean readers fetch it.
const koreanHand = localFont({
  src: "../fonts/nanum-pen-ko-subset.woff2",
  variable: "--font-hand-ko",
  display: "swap",
  preload: false,
});

// Traditional Chinese: Noto Serif TC for headings, Noto Sans HK for everything
// else. Google serves both in numbered unicode-range slices, which next/font
// self-hosts at build time; a browser downloads only the slices holding the
// characters on screen, and only when a Chinese page uses them.
const chineseSerif = Noto_Serif_TC({
  weight: ["500", "700"],
  variable: "--font-zh-serif",
  display: "swap",
  preload: false,
});

const chineseSans = Noto_Sans_HK({
  weight: "variable",
  variable: "--font-zh-sans",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Aster — See yourself through your friends",
  description: "A private personality reflection room for close friends.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${handwriting.variable} ${koreanHand.variable} ${chineseSerif.variable} ${chineseSans.variable}`}>
      <body>
        {children}
        {cfBeaconToken ? (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: cfBeaconToken })}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}

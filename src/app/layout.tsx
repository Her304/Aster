import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

// Self-hosted at build time, so the handwriting survives machines that have no
// script face of their own.
const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-hand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aster — See yourself through your friends",
  description: "A private personality reflection room for close friends.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={handwriting.variable}>
      <body>{children}</body>
    </html>
  );
}

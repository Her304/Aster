import type { Metadata } from "next";
import BloomHome from "@/components/bloom/bloom-home";

export const metadata: Metadata = {
  title: "Your survey · Aster",
  description: "One link. Ask everyone how they see you.",
  robots: { index: false, follow: false },
};

export default function BloomPage() {
  return <BloomHome />;
}

import type { Metadata } from "next";
import StartPage from "@/components/start-page";

export const metadata: Metadata = {
  title: "How do you see yourself? · Aster",
  description: "Tick your four letters or take the 16-question test, then ask everyone how they see you.",
};

export default function Start() {
  return <StartPage />;
}

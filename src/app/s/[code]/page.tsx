import type { Metadata } from "next";
import SurveyClient from "@/components/bloom/survey-client";
import { getSurveyByCode } from "@/lib/bloom-data";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const survey = await getSurveyByCode(code).catch(() => undefined);
  const title = survey ? `How do you see ${survey.display_name}? · Aster` : "Aster";
  const description = "Sixteen quick questions, about two minutes. Answer, then see how everyone else sees them.";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false, follow: false },
  };
}

export default async function SurveyPage({ params }: Props) {
  const { code } = await params;
  return <SurveyClient code={code} />;
}

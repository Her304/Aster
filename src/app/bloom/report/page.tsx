import type { Metadata } from "next";
import ReportClient from "@/components/bloom/report-client";

export const metadata: Metadata = {
  title: "Your report · Aster",
  robots: { index: false, follow: false },
};

export default function ReportPage() {
  return <ReportClient />;
}

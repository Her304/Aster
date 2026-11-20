"use client";

import { BloomHeader } from "@/components/bloom/shared";
import { SelfStart } from "@/components/self-start";
import { I18nProvider } from "@/lib/i18n";

/** Step one of a Bloom survey: the starter's own view, from four ticked letters or the 80-question test. */
export default function StartPage() {
  return (
    <I18nProvider>
      <main className="app-shell bloom-shell start-shell">
        <BloomHeader />
        <SelfStart />
      </main>
    </I18nProvider>
  );
}

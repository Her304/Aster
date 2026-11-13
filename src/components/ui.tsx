"use client";

import Image from "next/image";
import asterMark from "@/images/aster-mark.png";
import { localeOptions, useI18n, type Locale } from "@/lib/i18n";

export function BrandMark({ small = false }: { small?: boolean }) {
  return <Image className={small ? "brand-mark small" : "brand-mark"} src={asterMark} alt="" sizes="58px" priority />;
}

export function ArrowIcon({ direction = "right" }: { direction?: "right" | "left" }) {
  return (
    <svg className={direction === "left" ? "icon flip" : "icon"} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4 10 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  return (
    <select className="language-select" aria-label={t("common.language")} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
      {localeOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

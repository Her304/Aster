import { describe, expect, it } from "vitest";
import {
  questionTranslations,
  selectedQuestionIds,
  translateQuestion,
  translations,
  type Locale,
} from "./i18n";

describe("Aster localization", () => {
  it("keeps every UI key in all four languages", () => {
    const englishKeys = Object.keys(translations.en).sort();
    for (const locale of Object.keys(translations) as Locale[]) {
      expect(Object.keys(translations[locale]).sort()).toEqual(englishKeys);
    }
  });

  it("translates all 50 selected survey prompts", () => {
    expect(selectedQuestionIds).toHaveLength(50);
    for (const locale of ["zh-Hant", "ja", "ko"] as const) {
      for (const id of selectedQuestionIds) {
        expect(questionTranslations[locale][id]).toBeTruthy();
      }
    }
  });

  it("uses natural self and friend subjects", () => {
    expect(translateQuestion(1, "{{name}} starts conversations.", "Mina", true, "en")).toBe(
      "I start conversations.",
    );
    expect(translateQuestion(1, "", "Mina", false, "zh-Hant")).toContain("Mina");
    expect(translateQuestion(1, "", "Mina", true, "ja")).toContain("私は");
    expect(translateQuestion(1, "", "Mina", false, "ko")).toContain("Mina님은");
  });
});

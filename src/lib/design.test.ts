import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { milestoneMessage, signInMessage } from "./mailer";

// Guards for the two hard rules in DESIGN.md: flat elements, and at most three faces per language.
const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function languageBlock(lang: string) {
  const match = css.match(new RegExp(`html\\[lang="${lang}"\\] \\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("design rules", () => {
  it("draws no shadows on the site", () => {
    expect(css).not.toMatch(/box-shadow|text-shadow|drop-shadow/);
  });

  it("draws no shadows in emails", () => {
    for (const locale of ["en", "zh-Hant", "ja", "ko"] as const) {
      expect(signInMessage("123456", locale, "https://a.example").html).not.toMatch(/box-shadow|text-shadow/);
      expect(milestoneMessage(3, 3, "https://a.example/r", locale, "https://a.example").html).not.toMatch(/box-shadow|text-shadow/);
    }
  });

  it("defines exactly the three font roles", () => {
    const families = [...css.matchAll(/font-family:\s*([^;}]+)/g)].map((match) => match[1].trim());
    expect(new Set(families)).toEqual(new Set(["var(--display)", "var(--sans)", "var(--hand)", "var(--heading)"]));
  });

  it("keeps the English faces out of Chinese, Japanese and Korean pages", () => {
    for (const lang of ["zh-Hant", "ja", "ko"]) {
      const block = languageBlock(lang);
      for (const role of ["--display", "--sans", "--hand"]) expect(block, `${lang} ${role}`).toContain(`${role}:`);
      expect(block, lang).not.toMatch(/Iowan|Palatino|Avenir|Gill Sans|Trebuchet/);
    }
  });
});

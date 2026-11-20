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

  it("draws Latin in the same English faces on every page", () => {
    const english = { "--display": "\"Iowan Old Style\"", "--sans": "\"Avenir Next\"", "--hand": "var(--font-hand)" };
    for (const lang of ["zh-Hant", "ja", "ko"]) {
      const block = languageBlock(lang);
      for (const [role, first] of Object.entries(english)) {
        const stack = block.match(new RegExp(`${role}:([^;]*)`))?.[1]?.trim() ?? "";
        expect(stack.startsWith(first), `${lang} ${role}: ${stack}`).toBe(true);
      }
    }
  });

  it("gives Chinese, Japanese and Korean their own handwriting face after Caveat", () => {
    for (const [lang, face] of [["zh-Hant", "--font-hand-zh"], ["ja", "--font-hand-ja"], ["ko", "--font-hand-ko"]]) {
      const hand = languageBlock(lang).match(/--hand:([^;]*)/)?.[1] ?? "";
      expect(hand.trim().startsWith(`var(--font-hand), var(${face})`), `${lang}: ${hand}`).toBe(true);
    }
  });
});

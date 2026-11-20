import { describe, expect, it } from "vitest";
import { escapeHtml } from "./email-template";
import { milestoneMessage, signInMessage } from "./mailer";

const origin = "https://aster.example";
const locales = ["en", "zh-Hant", "ja", "ko"] as const;

/** Every style attribute must close where it should; a stray double quote inside one breaks every style after it. */
function stylesAreWellFormed(html: string) {
  const opened = html.match(/style="/g)?.length ?? 0;
  const closed = html.match(/style="[^"]*"(?=[\s>/])/g)?.length ?? 0;
  return opened > 0 && opened === closed;
}

describe("Aster emails", () => {
  it("puts the code, logo and plain-text fallback in every sign-in email", () => {
    for (const locale of locales) {
      const message = signInMessage("482915", locale, origin);
      expect(message.html).toContain("482915");
      expect(message.html).toContain(`${origin}/email/aster-mark.png`);
      expect(message.text).toContain("482915");
      expect(stylesAreWellFormed(message.html), locale).toBe(true);
    }
  });

  it("links each milestone email to the report", () => {
    for (const locale of locales) {
      for (const level of [3, 5, 8, 10]) {
        const message = milestoneMessage(level, level, `${origin}/bloom/report`, locale, origin);
        expect(message.subject).toBeTruthy();
        expect(message.text).not.toContain("undefined");
        expect(message.html).toContain(`href="${origin}/bloom/report"`);
        expect(message.text).toContain(`${origin}/bloom/report`);
        expect(stylesAreWellFormed(message.html), `${locale} ${level}`).toBe(true);
      }
    }
  });

  it("escapes anything interpolated into the HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    const message = milestoneMessage(3, 3, `${origin}/r?"><script>`, "en", origin);
    expect(message.html).not.toContain("<script>");
  });
});

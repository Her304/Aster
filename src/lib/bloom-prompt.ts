import { BLOOM_QUESTIONS, type BloomReport } from "./bloom";
import { bloomText } from "./bloom-i18n";
import { translateQuestion, translations, type Locale } from "./i18n";

const answerKeys = ["response.notSure", "response.strongDisagree", "response.disagree", "response.neither", "response.agree", "response.strongAgree"] as const;

export function answerLabel(locale: Locale, value: number) {
  return translations[locale][answerKeys[value] ?? "response.notSure"];
}

/** The largest gaps worth reporting: a full scale point or more, at most five. */
export function notableGaps(report: BloomReport) {
  if (report.behaviours.status !== "ready") return [];
  return report.behaviours.items.filter((item) => item.gap !== null && Math.abs(item.gap) >= 1).slice(0, 5);
}

/**
 * A prompt the initiator can paste into another AI. It is built only from
 * counts and Aster's own wording: no respondent names, nothing anyone typed,
 * and not the initiator's name either.
 */
export function buildAiPrompt(report: BloomReport, locale: Locale) {
  const text = (key: Parameters<typeof bloomText>[1], variables?: Record<string, string | number>) =>
    bloomText(locale, key, variables);
  const lines = [text("p.intro"), text("p.language"), "", text("p.self", { type: report.selfType, count: report.total })];

  if (report.total > 0) {
    lines.push(text("p.types", { list: report.board.types.map((entry) => `${entry.type} ${entry.count}`).join(", ") }));
    lines.push(
      text("p.letters", {
        list: report.board.letters
          .map((split, index) =>
            text("p.letterItem", {
              a: split.first.letter,
              aCount: split.first.count,
              b: split.second.letter,
              bCount: split.second.count,
              self: report.selfType[index],
            }),
          )
          .join(" · "),
      }),
    );
  }

  const gaps = notableGaps(report);
  if (gaps.length) {
    lines.push("", text("p.gaps"));
    for (const item of gaps) {
      const question = BLOOM_QUESTIONS.find((candidate) => candidate.id === item.questionId)!;
      lines.push(
        `- ${text("p.gapItem", {
          question: translateQuestion(question.id, question.text, "", true, locale),
          self: answerLabel(locale, item.selfValue),
          agree: item.agree,
          neutral: item.neutral,
          disagree: item.disagree,
        })}`,
      );
    }
  }

  if (report.audiences.status === "ready" && report.audiences.groups.length) {
    lines.push(
      "",
      text("p.audiences", {
        list: report.audiences.groups
          .map((group) =>
            text("p.audienceItem", {
              relation: text(`relp.${group.relation}`),
              count: group.count,
              types: group.types.map((entry) => `${entry.type} ${entry.count}`).join(", "),
            }),
          )
          .join("; "),
      }),
    );
  }

  lines.push("", text("p.ask"));
  return lines.join("\n");
}

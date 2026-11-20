import { describe, expect, it } from "vitest";
import { QUESTION_BANK } from "./questions";
import { SURVEY_QUESTIONS } from "../lib/survey";
import { selectedQuestionIds } from "../lib/i18n";

describe("Aster question bank", () => {
  it("contains 200 unique, named, observable prompts", () => {
    expect(QUESTION_BANK).toHaveLength(200);
    expect(new Set(QUESTION_BANK.map((question) => question.id)).size).toBe(200);
    expect(new Set(QUESTION_BANK.map((question) => question.text)).size).toBe(200);
    expect(QUESTION_BANK.every((question) => question.text.includes("{{name}}"))).toBe(true);
  });

  it("balances 50 questions per dimension and 25 per pole", () => {
    for (const dimension of ["EI", "SN", "TF", "JP"] as const) {
      const questions = QUESTION_BANK.filter((question) => question.dimension === dimension);
      expect(questions).toHaveLength(50);
      expect(questions.filter((question) => question.positivePole === dimension[0])).toHaveLength(25);
      expect(questions.filter((question) => question.positivePole === dimension[1])).toHaveLength(25);
    }
  });

  it("selects a 30-question room survey, spread across the axes with alternating poles", () => {
    expect(SURVEY_QUESTIONS).toHaveLength(30);
    expect(new Set(SURVEY_QUESTIONS.map((question) => question.id)).size).toBe(30);
    const counts = { EI: 8, SN: 8, TF: 7, JP: 7 } as const;
    for (const dimension of ["EI", "SN", "TF", "JP"] as const) {
      const onAxis = SURVEY_QUESTIONS.filter((question) => question.dimension === dimension);
      expect(onAxis).toHaveLength(counts[dimension]);
      expect(onAxis.filter((question) => question.positivePole === dimension[0])).toHaveLength(4);
    }
  });

  it("asks only prompts that are translated", () => {
    for (const question of SURVEY_QUESTIONS) expect(selectedQuestionIds as readonly number[]).toContain(question.id);
  });
});

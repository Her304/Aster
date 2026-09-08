import { describe, expect, it } from "vitest";
import { QUESTION_BANK } from "./questions";
import { SURVEY_QUESTIONS } from "../lib/survey";

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

  it("selects an evenly distributed 50-question v1 survey", () => {
    expect(SURVEY_QUESTIONS).toHaveLength(50);
    expect(SURVEY_QUESTIONS.filter((question) => question.dimension === "EI")).toHaveLength(13);
    expect(SURVEY_QUESTIONS.filter((question) => question.dimension === "SN")).toHaveLength(13);
    expect(SURVEY_QUESTIONS.filter((question) => question.dimension === "TF")).toHaveLength(12);
    expect(SURVEY_QUESTIONS.filter((question) => question.dimension === "JP")).toHaveLength(12);
  });
});

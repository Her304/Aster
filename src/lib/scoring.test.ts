import { describe, expect, it } from "vitest";

import {
  averageReviewerScores,
  derivePersonalityType,
  isCloselyBalanced,
  scoreAnswer,
  scoreAssessment,
  type Question,
} from "./scoring";

describe("scoreAnswer", () => {
  it("uses positivePole to reverse questions while keeping the second pole at 100", () => {
    const positiveE: Question = { id: "e", dimension: "EI", positivePole: "E" };
    const positiveI: Question = { id: "i", dimension: "EI", positivePole: "I" };

    expect(scoreAnswer(positiveE, 5)).toBe(0);
    expect(scoreAnswer(positiveE, 1)).toBe(100);
    expect(scoreAnswer(positiveI, 5)).toBe(100);
    expect(scoreAnswer(positiveI, 1)).toBe(0);
  });

  it("excludes null and not-sure responses", () => {
    const question: Question = { id: "q", dimension: "SN", positivePole: "N" };

    expect(scoreAnswer(question, null)).toBeNull();
    expect(scoreAnswer(question, "not-sure")).toBeNull();
  });
});

describe("scoreAssessment", () => {
  it("normalizes dimensions to 0-100 and ignores uncertain answers", () => {
    const questions: Question[] = [
      { id: "ei-1", dimension: "EI", positivePole: "I" },
      { id: "ei-2", dimension: "EI", positivePole: "E" },
      { id: "sn-1", dimension: "SN", positivePole: "N" },
    ];

    const result = scoreAssessment(questions, {
      "ei-1": 5,
      "ei-2": "not-sure",
      "sn-1": null,
    });

    expect(result.dimensions.EI).toMatchObject({
      score: 100,
      preference: "I",
      validAnswerCount: 1,
    });
    expect(result.dimensions.SN).toBeNull();
    expect(result.validAnswerCount).toBe(1);
    expect(result.type).toBeNull();
  });
});

describe("personality type and balance", () => {
  it("selects the second pole only above 50", () => {
    expect(
      derivePersonalityType({ EI: 51, SN: 50, TF: 75, JP: 25 }),
    ).toBe("ISFJ");
  });

  it("marks scores within eight points of the midpoint as closely balanced", () => {
    expect(isCloselyBalanced(42)).toBe(true);
    expect(isCloselyBalanced(58)).toBe(true);
    expect(isCloselyBalanced(41.99)).toBe(false);
    expect(isCloselyBalanced(58.01)).toBe(false);
  });
});

describe("averageReviewerScores", () => {
  it("weights reviewers equally per dimension and excludes missing dimensions", () => {
    const questions: Question[] = [
      { id: "ei-1", dimension: "EI", positivePole: "I" },
      { id: "ei-2", dimension: "EI", positivePole: "I" },
      { id: "sn-1", dimension: "SN", positivePole: "N" },
    ];

    const reviewWithTwoEiAnswers = scoreAssessment(questions, {
      "ei-1": 5,
      "ei-2": 5,
      "sn-1": "not-sure",
    });
    const reviewWithOneEiAnswer = scoreAssessment(questions, {
      "ei-1": 1,
      "ei-2": "not-sure",
      "sn-1": null,
    });
    const reviewWithNoEiAnswers = scoreAssessment(questions, {
      "ei-1": "not-sure",
      "ei-2": null,
      "sn-1": 5,
    });

    const result = averageReviewerScores([
      reviewWithTwoEiAnswers,
      reviewWithOneEiAnswer,
      reviewWithNoEiAnswers,
    ]);

    // (100 + 0) / 2 = 50. Weighting individual answers would incorrectly yield 66.7.
    expect(result.dimensions.EI).toMatchObject({
      score: 50,
      preference: "E",
      closelyBalanced: true,
      validAnswerCount: 3,
      reviewerCount: 2,
    });
    expect(result.dimensions.SN).toMatchObject({
      score: 100,
      reviewerCount: 1,
    });
    expect(result.contributingReviewerCount).toBe(3);
  });
});

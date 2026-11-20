import { describe, expect, it } from "vitest";
import { BLOOM_QUESTION_IDS, scoreBloom } from "./bloom";
import { questionTranslations, translateQuestion, type TranslatedQuestionId } from "./i18n";
import { DIMENSIONS } from "./scoring";
import { SELF_TEST_LENGTH, SELF_TEST_QUESTIONS, bloomSelfAnswers, scoreSelfTest, selfTestResult } from "./self-test";

const agreeWith = (pole: string) =>
  Object.fromEntries(SELF_TEST_QUESTIONS.map((question) => [question.id, question.positivePole === pole ? 5 : 1]));

describe("80-question self-test", () => {
  it("asks twenty questions per axis, ten favouring each pole, with no repeats", () => {
    expect(SELF_TEST_LENGTH).toBe(80);
    expect(new Set(SELF_TEST_QUESTIONS.map((question) => question.id)).size).toBe(80);
    for (const dimension of DIMENSIONS) {
      const onAxis = SELF_TEST_QUESTIONS.filter((question) => question.dimension === dimension);
      expect(onAxis).toHaveLength(20);
      for (const pole of dimension.split("")) {
        expect(onAxis.filter((question) => question.positivePole === pole)).toHaveLength(10);
      }
    }
  });

  it("contains every Bloom question so answers can carry over", () => {
    const ids = SELF_TEST_QUESTIONS.map((question) => question.id);
    for (const id of BLOOM_QUESTION_IDS) expect(ids).toContain(id);
  });

  it("is translated into every language", () => {
    for (const locale of ["zh-Hant", "ja", "ko"] as const) {
      for (const question of SELF_TEST_QUESTIONS) {
        expect(questionTranslations[locale][question.id as TranslatedQuestionId], `${locale} #${question.id}`).toBeTruthy();
      }
    }
  });

  it("reads naturally in the first person in English", () => {
    for (const question of SELF_TEST_QUESTIONS) {
      const text = translateQuestion(question.id, question.text, "", true, "en");
      expect(text, `#${question.id}`).toMatch(/^I [a-z]+(?<!s) /);
    }
  });

  it("scores one-sided answers to the matching type", () => {
    const answers = { ...agreeWith("I"), ...Object.fromEntries(SELF_TEST_QUESTIONS.filter((q) => q.dimension !== "EI").map((q) => [q.id, agreeWith(q.dimension === "SN" ? "N" : q.dimension === "TF" ? "F" : "P")[q.id]])) };
    expect(scoreSelfTest(answers).type).toBe("INFP");
  });

  it("hands the sixteen Bloom answers over with tie-breaks from its own letters", () => {
    const neutral = Object.fromEntries(SELF_TEST_QUESTIONS.map((question) => [question.id, 3]));
    const handoff = bloomSelfAnswers({ type: "ENTJ", answers: neutral });
    expect(handoff).not.toBeNull();
    expect(Object.keys(handoff!.answers)).toHaveLength(16);
    expect(scoreBloom(handoff!.answers, handoff!.tiebreaks).type).toBe("ENTJ");
    expect(bloomSelfAnswers({ type: "ENTJ" })).toBeNull();
  });
});

describe("self-test result", () => {
  it("leaves an exactly even axis for the person to decide", () => {
    const answers = Object.fromEntries(SELF_TEST_QUESTIONS.map((question) => [question.id, 3]));
    const result = selfTestResult(answers);
    expect(result.type).toBeNull();
    expect(result.undecided).toEqual(["EI", "SN", "TF", "JP"]);
  });

  it("decides every letter when the answers lean one way", () => {
    const answers = Object.fromEntries(SELF_TEST_QUESTIONS.map((question) => [question.id, "ESTJ".includes(question.positivePole) ? 5 : 2]));
    expect(selfTestResult(answers)).toMatchObject({ type: "ESTJ", undecided: [] });
  });
});

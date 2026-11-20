import { describe, expect, it } from "vitest";
import { BLOOM_QUESTION_IDS, scoreBloom } from "./bloom";
import { questionTranslations, translateQuestion, type TranslatedQuestionId } from "./i18n";
import { DIMENSIONS } from "./scoring";
import { SELF_TEST_LENGTH, SELF_TEST_PAGES, SELF_TEST_PAGE_SIZE, SELF_TEST_QUESTIONS, bloomSelfAnswers, scoreSelfTest, selfTestResult } from "./self-test";

const agreeWith = (pole: string) =>
  Object.fromEntries(SELF_TEST_QUESTIONS.map((question) => [question.id, question.positivePole === pole ? 5 : 1]));

describe("16-question self-test", () => {
  it("asks exactly what respondents answer, in the same order", () => {
    expect(SELF_TEST_LENGTH).toBe(16);
    expect(SELF_TEST_QUESTIONS.map((question) => question.id)).toEqual([...BLOOM_QUESTION_IDS]);
    for (const dimension of DIMENSIONS) {
      const onAxis = SELF_TEST_QUESTIONS.filter((question) => question.dimension === dimension);
      expect(onAxis).toHaveLength(4);
      for (const pole of dimension.split("")) {
        expect(onAxis.filter((question) => question.positivePole === pole)).toHaveLength(2);
      }
    }
  });

  it("splits into two even pages", () => {
    expect(SELF_TEST_PAGES).toBe(2);
    expect(SELF_TEST_LENGTH % SELF_TEST_PAGE_SIZE).toBe(0);
  });

  it("scores the same type Bloom would from the same answers", () => {
    const answers = Object.fromEntries(SELF_TEST_QUESTIONS.map((question, index) => [question.id, (index % 5) + 1]));
    expect(selfTestResult(answers).type).toBe(scoreBloom(answers).type);
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

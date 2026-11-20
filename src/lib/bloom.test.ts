import { describe, expect, it } from "vitest";
import {
  BLOOM_QUESTIONS,
  BLOOM_QUESTION_IDS,
  THRESHOLDS,
  buildBoard,
  buildReport,
  flowerFor,
  gapBadges,
  matchingLetters,
  readAxes,
  parseAnswers,
  mostDivided,
  responseSimilarity,
  scoreBloom,
  undecidedAxes,
  type BloomAnswers,
  type ReportResponse,
} from "./bloom";
import { bloomTranslations } from "./bloom-i18n";
import { buildAiPrompt } from "./bloom-prompt";
import { selectedQuestionIds, type Locale } from "./i18n";

/** Answers that lean fully toward the given type's letters. */
function answersFor(type: string, strength = 5): BloomAnswers {
  return Object.fromEntries(
    BLOOM_QUESTIONS.map((question) => [question.id, type.includes(question.positivePole) ? strength : 6 - strength]),
  );
}

describe("bloom questions", () => {
  it("uses sixteen translated prompts, two per pole", () => {
    expect(BLOOM_QUESTIONS).toHaveLength(16);
    for (const id of BLOOM_QUESTION_IDS) expect(selectedQuestionIds).toContain(id);
    for (const pole of ["E", "I", "S", "N", "T", "F", "J", "P"]) {
      expect(BLOOM_QUESTIONS.filter((question) => question.positivePole === pole)).toHaveLength(2);
    }
  });

  it("accepts exactly the sixteen answers and nothing else", () => {
    expect(parseAnswers(answersFor("ENFP"))).not.toBeNull();
    expect(parseAnswers({ ...answersFor("ENFP"), 999: 3 })).toBeNull();
    expect(parseAnswers({ ...answersFor("ENFP"), 1: 6 })).toBeNull();
    const short: BloomAnswers = answersFor("ENFP");
    delete short[1];
    expect(parseAnswers(short)).toBeNull();
  });
});

describe("scoreBloom", () => {
  it("derives the type the answers lean toward", () => {
    expect(scoreBloom(answersFor("ENFP")).type).toBe("ENFP");
    expect(scoreBloom(answersFor("ISTJ", 4)).type).toBe("ISTJ");
  });

  it("asks rather than defaulting when an axis ties", () => {
    const allNeither = Object.fromEntries(BLOOM_QUESTION_IDS.map((id) => [id, 3]));
    expect(undecidedAxes(allNeither)).toEqual(["EI", "SN", "TF", "JP"]);
    expect(scoreBloom(allNeither).type).toBeNull();
    expect(scoreBloom(allNeither, { EI: "I", SN: "N", TF: "F", JP: "P" }).type).toBe("INFP");
  });

  it("treats an axis of only 'not sure' as undecided", () => {
    const answers = answersFor("ENTJ");
    for (const question of BLOOM_QUESTIONS.filter((candidate) => candidate.dimension === "TF")) answers[question.id] = 0;
    expect(scoreBloom(answers).missing).toEqual(["TF"]);
    expect(scoreBloom(answers, { TF: "F" }).type).toBe("ENFJ");
  });

  it("counts matching letters", () => {
    expect(matchingLetters("ENTJ", "ENFP")).toBe(2);
  });
});

describe("board", () => {
  it("ranks types and flags a majority spelling no one leads with", () => {
    const board = buildBoard(["ENTJ", "ENTJ", "ENFP", "INFP", "ENFJ"]);
    expect(board.types[0]).toEqual({ type: "ENTJ", count: 2 });
    expect(board.majorityType).toBe("ENFJ");
    expect(board.letters.find((split) => split.dimension === "EI")).toMatchObject({ first: { count: 4 }, second: { count: 1 } });
  });

  it("leaves the majority type empty on an even split", () => {
    expect(buildBoard(["ENTJ", "INTJ"]).majorityType).toBeNull();
  });
});

describe("report", () => {
  const responses: ReportResponse[] = [
    ...Array.from({ length: 5 }, () => ({ relation: "colleague" as const, type: "ENTJ", answers: answersFor("ENTJ") })),
    ...Array.from({ length: 3 }, () => ({ relation: "close_friend" as const, type: "ENFP", answers: answersFor("ENFP") })),
  ];

  it("reads each axis as agreement, an outside view, or a split", () => {
    const report = buildReport("ENFP", null, responses);
    expect(report.axes.map((axis) => axis.pattern)).toEqual(["agree", "agree", "split", "split"]);
    const outside = buildReport("ISFP", null, responses);
    expect(outside.axes[0]).toMatchObject({ pattern: "outside", majority: "E", majorityCount: 8 });
  });

  it("unlocks parts at the agreed thresholds", () => {
    const few = buildReport("ENFP", null, responses.slice(0, THRESHOLDS.behaviours - 1));
    expect(few.behaviours).toEqual({ status: "locked", needed: 1 });
    expect(few.audiences.status).toBe("locked");
    expect(buildReport("ENFP", null, responses).behaviours.status).toBe("needs-self");
    const full = buildReport("ENFP", answersFor("INFP"), responses);
    expect(full.behaviours.status).toBe("ready");
    expect(full.audiences).toMatchObject({ status: "ready" });
    if (full.audiences.status === "ready") {
      expect(full.audiences.groups.map((group) => [group.relation, group.types[0].type])).toEqual([
        ["close_friend", "ENFP"],
        ["colleague", "ENTJ"],
      ]);
    }
  });

  it("puts the largest self-versus-friends gaps first", () => {
    const report = buildReport("INFP", answersFor("INFP"), responses);
    if (report.behaviours.status !== "ready") throw new Error("expected ready");
    const first = report.behaviours.items[0];
    expect(Math.abs(first.gap!)).toBeGreaterThanOrEqual(Math.abs(report.behaviours.items.at(-1)!.gap ?? 0));
  });
});

describe("gap badges", () => {
  const axesFor = (self: string, types: string[]) => readAxes(self, buildBoard(types));

  it("waits for the ranking threshold", () => {
    expect(gapBadges(axesFor("ENFP", ["ENFP", "ENFP"]), 2)).toEqual([]);
  });

  it("names a perfect match an open book", () => {
    expect(gapBadges(axesFor("ENFP", ["ENFP", "ENFP", "ENFP"]), 3)).toEqual(["open-book"]);
  });

  it("names each shared outside view and a divided reading", () => {
    const types = ["ESTJ", "ESFP", "ESTP", "ENFJ", "ESTJ"];
    expect(gapBadges(axesFor("INTJ", types), types.length)).toEqual(["undercover-introvert", "grounded-dreamer", "chameleon"]);
  });
});

describe("flower achievements", () => {
  it("measures how far one respondent's answers lean towards the initiator's letters", () => {
    expect(responseSimilarity("ENFP", answersFor("ENFP"))).toBe(100);
    expect(responseSimilarity("ENFP", answersFor("ISTJ"))).toBe(0);
    // Agreeing on every letter, but only mildly (4 or 2), is three-quarters of the way.
    expect(responseSimilarity("ENFP", answersFor("ENFP", 4))).toBe(75);
    // Two letters fully backed, two fully opposed.
    expect(responseSimilarity("ENFP", answersFor("ENTJ"))).toBe(50);
    // "Not sure" on everything sits halfway.
    expect(responseSimilarity("ENFP", Object.fromEntries(BLOOM_QUESTION_IDS.map((id) => [id, 0])))).toBe(50);
  });

  it("gives every respondent one of four flowers", () => {
    expect(flowerFor(null)).toBeNull();
    expect(flowerFor(100)).toBe("globe-amaranth");
    expect(flowerFor(84)).toBe("globe-amaranth");
    expect(flowerFor(83)).toBe("blue-iris");
    expect(flowerFor(50)).toBe("blue-iris");
    expect(flowerFor(49)).toBe("iris");
    expect(flowerFor(25)).toBe("iris");
    expect(flowerFor(24)).toBe("hydrangea");
    expect(flowerFor(0)).toBe("hydrangea");
  });

  it("counts the flowers respondents earned on the report", () => {
    const report = buildReport("ENFP", null, [
      { relation: "family", type: "ENFP", answers: answersFor("ENFP") },
      { relation: "family", type: "ENFP", answers: answersFor("ENFP") },
      { relation: "colleague", type: "ENTJ", answers: answersFor("ENTJ") },
      { relation: "colleague", type: "ISTJ", answers: answersFor("ISTJ") },
    ]);
    expect(report.flowers).toEqual({ "globe-amaranth": 2, "blue-iris": 1, iris: 0, hydrangea: 1 });
  });

  it("names and explains every flower in every language", () => {
    for (const table of Object.values(bloomTranslations)) {
      for (const flower of ["globe-amaranth", "blue-iris", "iris", "hydrangea"]) {
        for (const part of ["name", "meaning", "body"]) expect(table[`flower.${part}.${flower}` as keyof typeof table]).toBeTruthy();
      }
    }
  });
});

describe("most divided questions", () => {
  const split = (agreeing: number, disagreeing: number) => [
    ...Array.from({ length: agreeing }, () => ({ relation: "family" as const, type: "ENFP", answers: answersFor("ENFP") })),
    ...Array.from({ length: disagreeing }, () => ({ relation: "family" as const, type: "ISTJ", answers: answersFor("ISTJ") })),
  ];

  it("stays locked until individual answers may be combined", () => {
    expect(buildReport("ENFP", null, split(2, 2)).controversies).toEqual({ status: "locked", needed: THRESHOLDS.behaviours - 4 });
  });

  it("lists at most three questions, with counts and the initiator's own answer", () => {
    const report = buildReport("ENFP", answersFor("ENFP"), split(3, 2));
    expect(report.controversies.status).toBe("ready");
    if (report.controversies.status !== "ready") return;
    expect(report.controversies.items).toHaveLength(3);
    for (const item of report.controversies.items) {
      expect(item.agree + item.neutral + item.disagree + item.unsure).toBe(5);
      expect(item.agree).toBeGreaterThan(0);
      expect(item.disagree).toBeGreaterThan(0);
      expect(item.selfValue).not.toBeNull();
    }
  });

  it("puts the most evenly split question first and never lists unanimous ones", () => {
    const responses = split(5, 0);
    // One question split 3 to 2, another 4 to 1; everything else unanimous.
    // Questions 1 (E) and 76 (N) are answered 5 by an ENFP view.
    responses[0].answers = { ...responses[0].answers, 1: 1, 76: 1 };
    responses[1].answers = { ...responses[1].answers, 1: 1 };
    const items = mostDivided(responses, null);
    expect(items.map((item) => item.questionId)).toEqual([1, 76]);
    expect(items[0].selfValue).toBeNull();
  });
});

describe("AI prompt", () => {
  it("states the most divided questions with their counts", () => {
    const report = buildReport("ENFP", null, [
      ...Array.from({ length: 3 }, () => ({ relation: "family" as const, type: "ENFP", answers: answersFor("ENFP") })),
      ...Array.from({ length: 2 }, () => ({ relation: "family" as const, type: "ISTJ", answers: answersFor("ISTJ") })),
    ]);
    const prompt = buildAiPrompt(report, "en");
    expect(prompt).toContain("The questions friends disagreed with each other on most:");
    expect(prompt.match(/^- “.*” — friends: \d agree, \d neither, \d disagree, \d not sure\.$/gm)).toHaveLength(3);
    expect(buildAiPrompt(buildReport("ENFP", null, []), "en")).not.toContain("disagreed with each other");
  });

  it("carries counts but no names, in every language", () => {
    const named = buildReport("ENFP", answersFor("INFP"), [
      { relation: "colleague", type: "ENTJ", answers: answersFor("ENTJ") },
      ...Array.from({ length: 8 }, () => ({ relation: "family" as const, type: "ENFP", answers: answersFor("ENFP") })),
    ]);
    for (const locale of Object.keys(bloomTranslations) as Locale[]) {
      const prompt = buildAiPrompt(named, locale);
      expect(prompt).toContain("ENFP");
      expect(prompt).toContain("ENTJ 1");
      expect(prompt).not.toContain("{{");
    }
  });

  it("keeps every survey string in all four languages", () => {
    const keys = Object.keys(bloomTranslations.en).sort();
    for (const locale of Object.keys(bloomTranslations) as Locale[]) {
      expect(Object.keys(bloomTranslations[locale]).sort()).toEqual(keys);
    }
  });
});

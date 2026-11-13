import { describe, expect, it } from "vitest";
import {
  BLOOM_QUESTIONS,
  BLOOM_QUESTION_IDS,
  THRESHOLDS,
  buildBoard,
  buildReport,
  matchingLetters,
  parseAnswers,
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

describe("AI prompt", () => {
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

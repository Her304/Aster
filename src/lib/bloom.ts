import { QUESTION_BANK, type Question } from "../data/questions";
import { DIMENSIONS, scoreAssessment, type Dimension, type PreferenceLetter } from "./scoring";

/**
 * The open-link survey ("Bloom"): one person, any number of respondents,
 * sixteen questions. Everything here is pure so the browser and the server
 * score a response identically.
 */

export const BLOOM_VERSION = "bloom-1";

/** Four per axis, two per pole, drawn from the 50 prompts already translated. */
export const BLOOM_QUESTION_IDS = [1, 51, 103, 151, 27, 76, 126, 177, 2, 53, 106, 156, 31, 77, 129, 180] as const;

export const BLOOM_QUESTIONS: readonly Question[] = BLOOM_QUESTION_IDS.map((id) => {
  const question = QUESTION_BANK.find((candidate) => candidate.id === id);
  if (!question) throw new Error(`Bloom question ${id} is missing from the bank.`);
  return question;
});

export const BLOOM_LENGTH = BLOOM_QUESTIONS.length;

export const RELATIONS = ["family", "close_friend", "classmate", "colleague", "online", "other"] as const;
export type Relation = (typeof RELATIONS)[number];

/** Answers needed before each part opens. */
export const THRESHOLDS = { board: 3, behaviours: 5, audiences: 8 } as const;

/** An outside view counts as shared when at least this share of respondents agree on a letter. */
export const CONSENSUS_SHARE = 0.7;

export const AXIS_POLES: Readonly<Record<Dimension, readonly [PreferenceLetter, PreferenceLetter]>> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

/** 1–5 agreement, or 0 for "not sure". */
export type BloomAnswers = Record<number, number>;
export type Tiebreaks = Partial<Record<Dimension, PreferenceLetter>>;

export function isPersonalityType(value: unknown): value is string {
  return typeof value === "string" && /^[EI][SN][TF][JP]$/.test(value);
}

export function isRelation(value: unknown): value is Relation {
  return typeof value === "string" && (RELATIONS as readonly string[]).includes(value);
}

/** Accepts exactly the sixteen question ids, each answered with an integer from 0 to 5. */
export function parseAnswers(input: unknown): BloomAnswers | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length !== BLOOM_LENGTH) return null;
  const answers: BloomAnswers = {};
  for (const [key, value] of entries) {
    const id = Number(key);
    if (!(BLOOM_QUESTION_IDS as readonly number[]).includes(id)) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 5) return null;
    answers[id] = value;
  }
  return answers;
}

export function parseTiebreaks(input: unknown): Tiebreaks {
  const tiebreaks: Tiebreaks = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return tiebreaks;
  for (const dimension of DIMENSIONS) {
    const letter = (input as Record<string, unknown>)[dimension];
    if (typeof letter === "string" && (AXIS_POLES[dimension] as readonly string[]).includes(letter)) {
      tiebreaks[dimension] = letter as PreferenceLetter;
    }
  }
  return tiebreaks;
}

function axisScores(answers: BloomAnswers) {
  const mapped = Object.fromEntries(
    BLOOM_QUESTIONS.map((question) => {
      const value = answers[question.id];
      return [question.id, value === 0 || value === undefined ? "not-sure" : value];
    }),
  );
  return scoreAssessment(BLOOM_QUESTIONS, mapped as never).dimensions;
}

/**
 * Axes that the sixteen answers cannot decide: an exact tie, or nothing but
 * "not sure". Each one is settled by a single either-or question instead of
 * silently defaulting to the first letter.
 */
export function undecidedAxes(answers: BloomAnswers): Dimension[] {
  const scores = axisScores(answers);
  return DIMENSIONS.filter((dimension) => {
    const score = scores[dimension]?.score;
    return score === undefined || Math.abs(score - 50) < 1e-9;
  });
}

export interface BloomScore {
  type: string | null;
  /** Undecided axes with no valid tie-break supplied. */
  missing: Dimension[];
  undecided: Dimension[];
}

export function scoreBloom(answers: BloomAnswers, tiebreaks: Tiebreaks = {}): BloomScore {
  const scores = axisScores(answers);
  const undecided = undecidedAxes(answers);
  const missing: Dimension[] = [];
  const letters = DIMENSIONS.map((dimension) => {
    if (undecided.includes(dimension)) {
      const chosen = tiebreaks[dimension];
      if (!chosen) missing.push(dimension);
      return chosen ?? "";
    }
    const [first, second] = AXIS_POLES[dimension];
    return scores[dimension]!.score > 50 ? second : first;
  });
  return { type: missing.length ? null : letters.join(""), missing, undecided };
}

export function matchingLetters(a: string, b: string): number {
  return [0, 1, 2, 3].filter((index) => a[index] === b[index]).length;
}

export interface TypeCount {
  type: string;
  count: number;
}

export interface LetterSplit {
  dimension: Dimension;
  first: { letter: PreferenceLetter; count: number };
  second: { letter: PreferenceLetter; count: number };
  /** Null when the split is exactly even. */
  majority: PreferenceLetter | null;
}

export interface Board {
  total: number;
  types: TypeCount[];
  letters: LetterSplit[];
  /** The majority letter on each axis; null when any axis is evenly split. */
  majorityType: string | null;
}

export function countTypes(types: readonly string[]): TypeCount[] {
  const counts = new Map<string, number>();
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

export function buildBoard(types: readonly string[]): Board {
  const letters = DIMENSIONS.map((dimension, index): LetterSplit => {
    const [first, second] = AXIS_POLES[dimension];
    const firstCount = types.filter((type) => type[index] === first).length;
    const secondCount = types.filter((type) => type[index] === second).length;
    return {
      dimension,
      first: { letter: first, count: firstCount },
      second: { letter: second, count: secondCount },
      majority: firstCount === secondCount ? null : firstCount > secondCount ? first : second,
    };
  });
  const majorityType = letters.every((split) => split.majority)
    ? letters.map((split) => split.majority).join("")
    : null;
  return { total: types.length, types: countTypes(types), letters, majorityType };
}

export interface ReportResponse {
  relation: Relation;
  type: string;
  answers: BloomAnswers;
}

export type AxisPattern = "agree" | "outside" | "split";

export interface AxisReading {
  dimension: Dimension;
  selfLetter: PreferenceLetter;
  majority: PreferenceLetter | null;
  majorityCount: number;
  otherCount: number;
  pattern: AxisPattern;
}

export interface BehaviourItem {
  questionId: number;
  /** The initiator's own answer, 1–5, or 0 for "not sure". */
  selfValue: number;
  agree: number;
  neutral: number;
  disagree: number;
  unsure: number;
  /** Friends' mean minus the initiator's answer, on the 1–5 scale; null when either side is "not sure". */
  gap: number | null;
}

export interface AudienceGroup {
  relation: Relation;
  count: number;
  types: TypeCount[];
  majorityType: string | null;
}

export interface BloomReport {
  total: number;
  selfType: string;
  board: Board;
  axes: AxisReading[];
  behaviours:
    | { status: "locked"; needed: number }
    | { status: "needs-self" }
    | { status: "ready"; items: BehaviourItem[] };
  audiences: { status: "locked"; needed: number } | { status: "ready"; groups: AudienceGroup[] };
}

export function buildReport(
  selfType: string,
  selfAnswers: BloomAnswers | null,
  responses: readonly ReportResponse[],
): BloomReport {
  const total = responses.length;
  const board = buildBoard(responses.map((response) => response.type));

  const axes = board.letters.map((split, index): AxisReading => {
    const selfLetter = selfType[index] as PreferenceLetter;
    const majorityCount = Math.max(split.first.count, split.second.count);
    const otherCount = Math.min(split.first.count, split.second.count);
    const consensus = total > 0 && split.majority !== null && majorityCount / total >= CONSENSUS_SHARE;
    return {
      dimension: split.dimension,
      selfLetter,
      majority: split.majority,
      majorityCount,
      otherCount,
      pattern: consensus ? (split.majority === selfLetter ? "agree" : "outside") : "split",
    };
  });

  let behaviours: BloomReport["behaviours"];
  if (total < THRESHOLDS.behaviours) {
    behaviours = { status: "locked", needed: THRESHOLDS.behaviours - total };
  } else if (!selfAnswers) {
    behaviours = { status: "needs-self" };
  } else {
    const items = BLOOM_QUESTIONS.map((question): BehaviourItem => {
      const values = responses.map((response) => response.answers[question.id] ?? 0);
      const valid = values.filter((value) => value >= 1);
      const selfValue = selfAnswers[question.id] ?? 0;
      const mean = valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
      return {
        questionId: question.id,
        selfValue,
        agree: values.filter((value) => value >= 4).length,
        neutral: values.filter((value) => value === 3).length,
        disagree: values.filter((value) => value === 1 || value === 2).length,
        unsure: values.filter((value) => value === 0).length,
        gap: mean === null || selfValue === 0 ? null : Math.round((mean - selfValue) * 100) / 100,
      };
    });
    items.sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0));
    behaviours = { status: "ready", items };
  }

  let audiences: BloomReport["audiences"];
  if (total < THRESHOLDS.audiences) {
    audiences = { status: "locked", needed: THRESHOLDS.audiences - total };
  } else {
    const groups = RELATIONS.map((relation) => {
      const types = responses.filter((response) => response.relation === relation).map((response) => response.type);
      return { relation, count: types.length, types: countTypes(types), majorityType: buildBoard(types).majorityType };
    }).filter((group) => group.count >= 2);
    audiences = { status: "ready", groups };
  }

  return { total, selfType, board, axes, behaviours, audiences };
}

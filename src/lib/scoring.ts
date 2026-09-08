export const DIMENSIONS = ["EI", "SN", "TF", "JP"] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type PreferenceLetter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type PersonalityType = `${"E" | "I"}${"S" | "N"}${"T" | "F"}${"J" | "P"}`;
export type LikertResponse = 1 | 2 | 3 | 4 | 5;
export type AnswerValue = LikertResponse | "not-sure" | null;
export type QuestionId = string | number;

export interface Question {
  id: QuestionId;
  dimension: Dimension;
  /** The pole favored by agreement (a response of 5). */
  positivePole: PreferenceLetter;
}

export interface AssessmentAnswer {
  questionId: QuestionId;
  value: AnswerValue;
}

export type AnswerCollection =
  | Readonly<Record<QuestionId, AnswerValue>>
  | readonly AssessmentAnswer[];

export interface DimensionScore {
  dimension: Dimension;
  /** A 0-100 score where values over 50 favor the dimension's second pole. */
  score: number;
  preference: PreferenceLetter;
  closelyBalanced: boolean;
  /** Valid questionnaire answers represented by this score. */
  validAnswerCount: number;
  /** Reviewers represented by this score (one for a single assessment). */
  reviewerCount: number;
}

export type DimensionScores = Record<Dimension, DimensionScore | null>;

export interface ScoredProfile {
  dimensions: DimensionScores;
  /** Null until every dimension has at least one valid answer. */
  type: PersonalityType | null;
  closelyBalancedDimensions: Dimension[];
  validAnswerCount: number;
  contributingReviewerCount: number;
}

export const CLOSELY_BALANCED_THRESHOLD = 8;

const POLES: Record<Dimension, readonly [PreferenceLetter, PreferenceLetter]> = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"],
};

function isLikertResponse(value: AnswerValue): value is LikertResponse {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function assertValidQuestion(question: Question): void {
  if (!POLES[question.dimension].includes(question.positivePole)) {
    throw new RangeError(
      `Question ${question.id} has positivePole ${question.positivePole}, which is not part of ${question.dimension}.`,
    );
  }
}

function assertValidScore(score: number): void {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError(`Dimension scores must be between 0 and 100; received ${score}.`);
  }
}

/**
 * Converts one response to a 0-100 score favoring the dimension's second pole.
 * Null and "not-sure" are deliberately excluded from scoring.
 */
export function scoreAnswer(question: Question, value: AnswerValue): number | null {
  assertValidQuestion(question);

  if (!isLikertResponse(value)) {
    return null;
  }

  const [, secondPole] = POLES[question.dimension];
  const agreement = ((value - 1) / 4) * 100;

  return question.positivePole === secondPole ? agreement : 100 - agreement;
}

export function isCloselyBalanced(
  score: number,
  threshold = CLOSELY_BALANCED_THRESHOLD,
): boolean {
  assertValidScore(score);

  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new RangeError(`Balance threshold must be a non-negative number; received ${threshold}.`);
  }

  return Math.abs(score - 50) <= threshold;
}

export function preferenceForDimension(
  dimension: Dimension,
  score: number,
): PreferenceLetter {
  assertValidScore(score);
  const [firstPole, secondPole] = POLES[dimension];
  return score > 50 ? secondPole : firstPole;
}

type DimensionScoreInput = number | Pick<DimensionScore, "score"> | null | undefined;

function numericScore(input: DimensionScoreInput): number | null {
  if (input == null) {
    return null;
  }

  const score = typeof input === "number" ? input : input.score;
  assertValidScore(score);
  return score;
}

/** Derives a type only when all four dimensions have a valid score. */
export function derivePersonalityType(
  scores: Partial<Record<Dimension, DimensionScoreInput>>,
): PersonalityType | null {
  const letters: PreferenceLetter[] = [];

  for (const dimension of DIMENSIONS) {
    const score = numericScore(scores[dimension]);
    if (score == null) {
      return null;
    }
    letters.push(preferenceForDimension(dimension, score));
  }

  return letters.join("") as PersonalityType;
}

function toAnswerMap(answers: AnswerCollection): Readonly<Record<QuestionId, AnswerValue>> {
  if (Array.isArray(answers)) {
    return Object.fromEntries(answers.map((answer) => [answer.questionId, answer.value]));
  }

  return answers as Readonly<Record<QuestionId, AnswerValue>>;
}

function makeDimensionScore(
  dimension: Dimension,
  score: number,
  validAnswerCount: number,
  reviewerCount: number,
): DimensionScore {
  return {
    dimension,
    score,
    preference: preferenceForDimension(dimension, score),
    closelyBalanced: isCloselyBalanced(score),
    validAnswerCount,
    reviewerCount,
  };
}

function makeProfile(
  dimensions: DimensionScores,
  validAnswerCount: number,
  contributingReviewerCount: number,
): ScoredProfile {
  return {
    dimensions,
    type: derivePersonalityType(dimensions),
    closelyBalancedDimensions: DIMENSIONS.filter(
      (dimension) => dimensions[dimension]?.closelyBalanced === true,
    ),
    validAnswerCount,
    contributingReviewerCount,
  };
}

/** Scores a single review, averaging all valid answers within each dimension. */
export function scoreAssessment(
  questions: readonly Question[],
  answers: AnswerCollection,
): ScoredProfile {
  const answerMap = toAnswerMap(answers);
  const buckets: Record<Dimension, number[]> = {
    EI: [],
    SN: [],
    TF: [],
    JP: [],
  };

  for (const question of questions) {
    const answerScore = scoreAnswer(question, answerMap[question.id] ?? null);
    if (answerScore != null) {
      buckets[question.dimension].push(answerScore);
    }
  }

  const dimensions = {} as DimensionScores;
  let validAnswerCount = 0;

  for (const dimension of DIMENSIONS) {
    const values = buckets[dimension];
    validAnswerCount += values.length;
    dimensions[dimension] = values.length
      ? makeDimensionScore(
          dimension,
          values.reduce((total, value) => total + value, 0) / values.length,
          values.length,
          1,
        )
      : null;
  }

  return makeProfile(dimensions, validAnswerCount, validAnswerCount > 0 ? 1 : 0);
}

/**
 * Averages completed reviewer profiles. Each reviewer contributes one dimension
 * score, regardless of how many valid answers produced that score.
 */
export function averageReviewerScores(reviews: readonly ScoredProfile[]): ScoredProfile {
  const dimensions = {} as DimensionScores;

  for (const dimension of DIMENSIONS) {
    const contributors = reviews
      .map((review) => review.dimensions[dimension])
      .filter((score): score is DimensionScore => score != null);

    dimensions[dimension] = contributors.length
      ? makeDimensionScore(
          dimension,
          contributors.reduce((total, result) => total + result.score, 0) /
            contributors.length,
          contributors.reduce((total, result) => total + result.validAnswerCount, 0),
          contributors.length,
        )
      : null;
  }

  const validAnswerCount = reviews.reduce(
    (total, review) => total + review.validAnswerCount,
    0,
  );
  const contributingReviewerCount = reviews.filter((review) =>
    DIMENSIONS.some((dimension) => review.dimensions[dimension] != null),
  ).length;

  return makeProfile(dimensions, validAnswerCount, contributingReviewerCount);
}

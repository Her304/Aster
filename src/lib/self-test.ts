import type { Question } from "../data/questions";
import { BLOOM_QUESTIONS, BLOOM_QUESTION_IDS, isPersonalityType, type BloomAnswers, type Tiebreaks } from "./bloom";
import { DIMENSIONS, scoreAssessment, type Dimension, type PreferenceLetter, type ScoredProfile } from "./scoring";

/**
 * The self-test on /start: the same sixteen prompts, in the same order, that
 * respondents answer about the person (four per axis, two favouring each
 * pole), so both sides compare like with like. Answers use the Bloom scale
 * (1–5, or 0 for "not sure") and carry straight into a Bloom survey.
 */
export const SELF_TEST_QUESTIONS: readonly Question[] = BLOOM_QUESTIONS;

export const SELF_TEST_LENGTH = SELF_TEST_QUESTIONS.length;
export const SELF_TEST_PAGE_SIZE = 8;
export const SELF_TEST_PAGES = Math.ceil(SELF_TEST_LENGTH / SELF_TEST_PAGE_SIZE);

export function scoreSelfTest(answers: BloomAnswers): ScoredProfile {
  const mapped = Object.fromEntries(
    SELF_TEST_QUESTIONS.map((question) => {
      const value = answers[question.id];
      return [question.id, value === undefined ? null : value === 0 ? "not-sure" : value];
    }),
  );
  return scoreAssessment(SELF_TEST_QUESTIONS, mapped as never);
}

export interface SelfTestResult {
  profile: ScoredProfile;
  /** Letters the answers decide; an axis that is exactly even, or all "not sure", is left out. */
  letters: Partial<Record<Dimension, PreferenceLetter>>;
  /** Axes the person has to settle themselves. */
  undecided: Dimension[];
  /** The four letters, or null while any axis is undecided. */
  type: string | null;
}

/** Like Bloom, an exact tie is never silently resolved to the first letter. */
export function selfTestResult(answers: BloomAnswers): SelfTestResult {
  const profile = scoreSelfTest(answers);
  const letters: Partial<Record<Dimension, PreferenceLetter>> = {};
  const undecided: Dimension[] = [];
  for (const dimension of DIMENSIONS) {
    const score = profile.dimensions[dimension];
    if (!score || Math.abs(score.score - 50) < 1e-9) undecided.push(dimension);
    else letters[dimension] = score.preference;
  }
  return { profile, letters, undecided, type: undecided.length ? null : DIMENSIONS.map((dimension) => letters[dimension]).join("") };
}

/** What the home page hands to /bloom so nobody answers twice. */
export interface SelfView {
  type: string;
  /** Present only when the type came from the self-test. */
  answers?: BloomAnswers;
}

const STORAGE_KEY = "aster_self_view";

export function saveSelfView(view: SelfView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Storage can be unavailable (private windows); /bloom then just asks again.
  }
}

export function loadSelfView(): SelfView | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || !isPersonalityType(parsed.type)) return null;
    return { type: parsed.type, answers: parsed.answers && typeof parsed.answers === "object" ? parsed.answers : undefined };
  } catch {
    return null;
  }
}

export function clearSelfView() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The sixteen Bloom answers from a finished self-test, with tie-breaks taken
 * from the letters the person settled for any axis the answers leave even.
 */
export function bloomSelfAnswers(view: SelfView): { answers: BloomAnswers; tiebreaks: Tiebreaks } | null {
  if (!view.answers) return null;
  const answers: BloomAnswers = {};
  for (const id of BLOOM_QUESTION_IDS) {
    const value = view.answers[id];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 5) return null;
    answers[id] = value;
  }
  const tiebreaks: Tiebreaks = {};
  DIMENSIONS.forEach((dimension, index) => {
    tiebreaks[dimension] = view.type[index] as PreferenceLetter;
  });
  return { answers, tiebreaks };
}

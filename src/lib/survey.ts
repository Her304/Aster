import { QUESTION_BANK, type Dimension, type Question } from "../data/questions";

/** Thirty prompts for a room: eight on E/I and S/N, seven on T/F and J/P, alternating poles. */
const allocation: Record<Dimension, number> = {
  EI: 8,
  SN: 8,
  TF: 7,
  JP: 7,
};

function chooseBalanced(dimension: Dimension, count: number) {
  const [firstPole, secondPole] = dimension.split("");
  const questions = QUESTION_BANK.filter((question) => question.dimension === dimension);
  const first = questions
    .filter((question) => question.positivePole === firstPole)
    .slice(0, Math.ceil(count / 2));
  const second = questions
    .filter((question) => question.positivePole === secondPole)
    .slice(0, Math.floor(count / 2));

  return Array.from({ length: count }, (_, index) => {
    const list = index % 2 === 0 ? first : second;
    return list[Math.floor(index / 2)];
  }).filter(Boolean) as Question[];
}

const groups = (Object.keys(allocation) as Dimension[]).map((dimension) =>
  chooseBalanced(dimension, allocation[dimension]),
);

export const SURVEY_QUESTIONS: Question[] = Array.from({ length: Math.max(...Object.values(allocation)) }, (_, index) =>
  groups.map((group) => group[index]).filter(Boolean),
).flat();

export const SURVEY_LENGTH = SURVEY_QUESTIONS.length;
export const SURVEY_QUESTION_IDS: ReadonlySet<number> = new Set(SURVEY_QUESTIONS.map((question) => Number(question.id)));

export function displayQuestion(text: string, nickname: string, self = false) {
  if (self) {
    const baseVerb = (verb: string) => {
      const irregular: Record<string, string> = { is: "am", has: "have", does: "do", says: "say" };
      if (irregular[verb]) return irregular[verb];
      if (verb.endsWith("ies")) return `${verb.slice(0, -3)}y`;
      if (/((ch|sh|x|z|o)es)$/.test(verb) || /sses$/.test(verb) || verb === "focuses") return verb.slice(0, -2);
      return verb.endsWith("s") ? verb.slice(0, -1) : verb;
    };
    return text.replace(/^\{\{name\}\} (?:(often|usually|rarely|readily|regularly) )?([A-Za-z]+)/, (_match, adverb: string | undefined, verb: string) =>
      `I ${adverb ? `${adverb} ` : ""}${baseVerb(verb)}`,
    );
  }
  return text.replaceAll("{{name}}", nickname);
}

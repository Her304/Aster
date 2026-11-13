import { randomUUID } from "node:crypto";
import { queryAll, queryOne, type DbExecutor } from "@/lib/db";
import {
  BLOOM_QUESTION_IDS,
  buildBoard,
  buildReport,
  isRelation,
  type BloomAnswers,
  type ReportResponse,
} from "@/lib/bloom";

export interface SurveyRow {
  id: string;
  code: string;
  owner_id: string;
  display_name: string;
  self_type: string;
  status: "open" | "closed";
  board_public: number;
  created_at: string | Date;
}

export interface ResponseRow {
  id: string;
  survey_id: string;
  visitor_id: string | null;
  user_id: string | null;
  respondent_name: string;
  relation: string;
  result_type: string;
  submitted_at: string | Date;
}

export function isoTime(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  return /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? new Date(value).toISOString() : new Date(`${value.replace(" ", "T")}Z`).toISOString();
}

export function surveyCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function normalizeSurveyCode(code: string) {
  return /^[a-z2-9]{8}$/i.test(code) ? code.toLowerCase() : null;
}

export async function getSurveyByCode(code: string) {
  const normalized = normalizeSurveyCode(code);
  if (!normalized) return undefined;
  return queryOne<SurveyRow>("SELECT * FROM surveys WHERE code = ?", [normalized]);
}

export async function getSurveyByOwner(userId: string) {
  return queryOne<SurveyRow>("SELECT * FROM surveys WHERE owner_id = ?", [userId]);
}

/** The respondent's own answer to this survey, found through this browser or their account. */
export async function findOwnResponse(surveyId: string, visitorId: string | undefined, userId: string | undefined) {
  if (!visitorId && !userId) return undefined;
  return queryOne<ResponseRow>(
    `SELECT * FROM survey_responses
     WHERE survey_id = ? AND is_owner = 0 AND (visitor_id = ? OR user_id = ?)
     ORDER BY submitted_at LIMIT 1`,
    [surveyId, visitorId ?? "", userId ?? ""],
  );
}

export async function listResponses(surveyId: string) {
  return queryAll<ResponseRow>(
    "SELECT * FROM survey_responses WHERE survey_id = ? AND is_owner = 0 ORDER BY submitted_at DESC",
    [surveyId],
  );
}

export async function responseTypes(surveyId: string) {
  const rows = await queryAll<{ result_type: string }>(
    "SELECT result_type FROM survey_responses WHERE survey_id = ? AND is_owner = 0",
    [surveyId],
  );
  return rows.map((row) => row.result_type);
}

export async function surveyBoard(surveyId: string) {
  return buildBoard(await responseTypes(surveyId));
}

export async function ownerSelfAnswers(surveyId: string): Promise<BloomAnswers | null> {
  const rows = await queryAll<{ question_id: number | string; value: number | string }>(
    `SELECT a.question_id, a.value FROM survey_answers a
     JOIN survey_responses r ON r.id = a.response_id
     WHERE r.survey_id = ? AND r.is_owner = 1`,
    [surveyId],
  );
  if (rows.length !== BLOOM_QUESTION_IDS.length) return null;
  return Object.fromEntries(rows.map((row) => [Number(row.question_id), Number(row.value)]));
}

export async function surveyReport(survey: SurveyRow) {
  const rows = await queryAll<{ id: string; relation: string; result_type: string; question_id: number | string | null; value: number | string | null }>(
    `SELECT r.id, r.relation, r.result_type, a.question_id, a.value
     FROM survey_responses r LEFT JOIN survey_answers a ON a.response_id = r.id
     WHERE r.survey_id = ? AND r.is_owner = 0`,
    [survey.id],
  );
  const responses = new Map<string, ReportResponse>();
  for (const row of rows) {
    let response = responses.get(row.id);
    if (!response) {
      response = { relation: isRelation(row.relation) ? row.relation : "other", type: row.result_type, answers: {} };
      responses.set(row.id, response);
    }
    if (row.question_id !== null && row.value !== null) response.answers[Number(row.question_id)] = Number(row.value);
  }
  return buildReport(survey.self_type, await ownerSelfAnswers(survey.id), [...responses.values()]);
}

export async function insertResponse(
  database: DbExecutor,
  values: {
    surveyId: string;
    visitorId: string | null;
    userId: string | null;
    isOwner: boolean;
    name: string;
    relation: string;
    type: string;
    answers: BloomAnswers;
  },
) {
  const id = randomUUID();
  await database.run(
    `INSERT INTO survey_responses (id, survey_id, visitor_id, user_id, is_owner, respondent_name, relation, result_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, values.surveyId, values.visitorId, values.userId, values.isOwner ? 1 : 0, values.name, values.relation, values.type],
  );
  const entries = Object.entries(values.answers);
  await database.run(
    `INSERT INTO survey_answers (response_id, question_id, value) VALUES ${entries.map(() => "(?, ?, ?)").join(", ")}`,
    entries.flatMap(([questionId, value]) => [id, Number(questionId), value]),
  );
  return id;
}

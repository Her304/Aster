import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { QUESTION_BANK } from "@/data/questions";

let databaseInstance: DatabaseSync | undefined;

function initializeDatabase() {
  if (databaseInstance) return databaseInstance;

  const dataDirectory = join(process.cwd(), "data");
  mkdirSync(dataDirectory, { recursive: true });
  const databasePath = process.env.ASTER_DB_PATH || join(dataDirectory, "aster.db");
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA busy_timeout = 10000;");
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      host_participant_id TEXT,
      status TEXT NOT NULL DEFAULT 'lobby',
      questionnaire_version TEXT NOT NULL DEFAULT 'aster-1',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL,
      session_hash TEXT NOT NULL UNIQUE,
      recovery_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, nickname)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER NOT NULL,
      version TEXT NOT NULL,
      wording TEXT NOT NULL,
      dimension TEXT NOT NULL,
      positive_pole TEXT NOT NULL,
      PRIMARY KEY(id, version)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      is_self INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'not_started',
      submitted_at TEXT,
      UNIQUE(reviewer_id, target_id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL,
      value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 5),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(assessment_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_room ON assessments(room_id);
    CREATE INDEX IF NOT EXISTS idx_answers_assessment ON answers(assessment_id);
  `);

  const seededQuestions = database
    .prepare("SELECT COUNT(*) AS count FROM questions WHERE version = 'aster-1'")
    .get() as { count: number };
  if (seededQuestions.count < QUESTION_BANK.length) {
    const insertQuestion = database.prepare(`
      INSERT OR IGNORE INTO questions (id, version, wording, dimension, positive_pole)
      VALUES (?, 'aster-1', ?, ?, ?)
    `);
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const question of QUESTION_BANK) {
        insertQuestion.run(question.id, question.text, question.dimension, question.positivePole);
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  databaseInstance = database;
  return database;
}

export const db = new Proxy({} as DatabaseSync, {
  get(_target, property) {
    const database = initializeDatabase();
    const value = Reflect.get(database, property);
    return typeof value === "function" ? value.bind(database) : value;
  },
});

export interface RoomRow {
  id: string;
  code: string;
  host_participant_id: string;
  status: "lobby" | "survey" | "revealed";
  questionnaire_version: string;
  is_demo: number;
  created_at: string;
}

export interface ParticipantRow {
  id: string;
  room_id: string;
  nickname: string;
  created_at: string;
}

export interface AssessmentRow {
  id: string;
  room_id: string;
  reviewer_id: string;
  target_id: string;
  target_name?: string;
  reviewer_name?: string;
  is_self: number;
  status: "not_started" | "in_progress" | "submitted";
  submitted_at: string | null;
  answer_count?: number;
}

export function token() {
  return randomBytes(24).toString("base64url");
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function createRoom(nickname: string, isDemo = false) {
  const roomId = randomUUID();
  const participantId = randomUUID();
  const sessionToken = token();
  const recoveryToken = token();
  let code = roomCode();
  while (db.prepare("SELECT 1 FROM rooms WHERE code = ?").get(code)) code = roomCode();

  db.exec("BEGIN");
  try {
    db.prepare(
      "INSERT INTO rooms (id, code, host_participant_id, is_demo) VALUES (?, ?, ?, ?)",
    ).run(roomId, code, participantId, isDemo ? 1 : 0);
    db.prepare(
      "INSERT INTO participants (id, room_id, nickname, session_hash, recovery_hash) VALUES (?, ?, ?, ?, ?)",
    ).run(participantId, roomId, nickname, hashToken(sessionToken), hashToken(recoveryToken));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { roomId, participantId, code, sessionToken, recoveryToken };
}

export function getRoomByCode(code: string) {
  return db.prepare("SELECT * FROM rooms WHERE code = ?").get(code.toUpperCase()) as RoomRow | undefined;
}

export function getParticipantBySession(sessionToken: string | undefined, roomId?: string) {
  if (!sessionToken) return undefined;
  const sql = roomId
    ? "SELECT id, room_id, nickname, created_at FROM participants WHERE session_hash = ? AND room_id = ?"
    : "SELECT id, room_id, nickname, created_at FROM participants WHERE session_hash = ?";
  return db.prepare(sql).get(hashToken(sessionToken), ...(roomId ? [roomId] : [])) as
    | ParticipantRow
    | undefined;
}

export function getRoomParticipants(roomId: string) {
  return db
    .prepare("SELECT id, room_id, nickname, created_at FROM participants WHERE room_id = ? ORDER BY created_at")
    .all(roomId) as unknown as ParticipantRow[];
}

export function createAssessments(roomId: string, manageTransaction = true) {
  const participants = getRoomParticipants(roomId);
  const insert = db.prepare(
    "INSERT OR IGNORE INTO assessments (id, room_id, reviewer_id, target_id, is_self) VALUES (?, ?, ?, ?, ?)",
  );
  if (manageTransaction) db.exec("BEGIN IMMEDIATE");
  try {
    for (const reviewer of participants) {
      for (const target of participants) {
        insert.run(randomUUID(), roomId, reviewer.id, target.id, reviewer.id === target.id ? 1 : 0);
      }
    }
    db.prepare("UPDATE rooms SET status = 'survey' WHERE id = ?").run(roomId);
    if (manageTransaction) db.exec("COMMIT");
  } catch (error) {
    if (manageTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function getAssessmentsForReviewer(roomId: string, reviewerId: string) {
  return db
    .prepare(`
      SELECT a.*, p.nickname AS target_name, COUNT(ans.id) AS answer_count
      FROM assessments a
      JOIN participants p ON p.id = a.target_id
      LEFT JOIN answers ans ON ans.assessment_id = a.id
      WHERE a.room_id = ? AND a.reviewer_id = ?
      GROUP BY a.id
      ORDER BY a.is_self, p.created_at
    `)
    .all(roomId, reviewerId) as unknown as AssessmentRow[];
}

export function getAssessment(assessmentId: string) {
  return db
    .prepare(`
      SELECT a.*, target.nickname AS target_name, reviewer.nickname AS reviewer_name,
        COUNT(ans.id) AS answer_count
      FROM assessments a
      JOIN participants target ON target.id = a.target_id
      JOIN participants reviewer ON reviewer.id = a.reviewer_id
      LEFT JOIN answers ans ON ans.assessment_id = a.id
      WHERE a.id = ?
      GROUP BY a.id
    `)
    .get(assessmentId) as AssessmentRow | undefined;
}

export function roomCompletion(roomId: string) {
  const rows = db
    .prepare(`
      SELECT reviewer_id,
        SUM(CASE WHEN is_self = 0 THEN 1 ELSE 0 END) AS required_total,
        SUM(CASE WHEN is_self = 0 AND status = 'submitted' THEN 1 ELSE 0 END) AS required_done
      FROM assessments WHERE room_id = ? GROUP BY reviewer_id
    `)
    .all(roomId) as unknown as Array<{ reviewer_id: string; required_total: number; required_done: number }>;
  return rows;
}

export function maybeRevealRoom(roomId: string) {
  const counts = db
    .prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS done
      FROM assessments WHERE room_id = ? AND is_self = 0
    `)
    .get(roomId) as { total: number; done: number };
  if (counts.total > 0 && counts.total === counts.done) {
    db.prepare("UPDATE rooms SET status = 'revealed' WHERE id = ?").run(roomId);
    return true;
  }
  return false;
}

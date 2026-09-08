import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { neonConfig, Pool, type PoolClient } from "@neondatabase/serverless";
import WebSocket from "ws";
import { QUESTION_BANK } from "@/data/questions";

type SqlValue = string | number | null;

export interface DbExecutor {
  readonly dialect: "postgres" | "sqlite";
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    host_participant_id TEXT,
    status TEXT NOT NULL DEFAULT 'lobby' CHECK(status IN ('lobby', 'survey', 'revealed')),
    questionnaire_version TEXT NOT NULL DEFAULT 'aster-1',
    is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    session_hash TEXT NOT NULL UNIQUE,
    recovery_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    is_self INTEGER NOT NULL DEFAULT 0 CHECK(is_self IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'submitted')),
    submitted_at TIMESTAMPTZ,
    UNIQUE(reviewer_id, target_id)
  );

  CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL,
    value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 5),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS aster_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_room ON assessments(room_id);
  CREATE INDEX IF NOT EXISTS idx_answers_assessment ON answers(assessment_id);
`;

const SQLITE_SCHEMA_SQL = SCHEMA_SQL.replaceAll("TIMESTAMPTZ", "TEXT");
const usesPostgres = Boolean(process.env.DATABASE_URL);

function toPostgresSql(sql: string) {
  let parameter = 0;
  return sql.replace(/\?/g, () => `$${++parameter}`);
}

function questionSeedStatement() {
  const values = QUESTION_BANK.map(() => "(?, ?, ?, ?, ?)").join(", ");
  const params = QUESTION_BANK.flatMap((question) => [
    question.id,
    "aster-1",
    question.text,
    question.dimension,
    question.positivePole,
  ]);
  return {
    sql: `
      INSERT INTO questions (id, version, wording, dimension, positive_pole)
      VALUES ${values}
      ON CONFLICT(id, version) DO UPDATE SET
        wording = excluded.wording,
        dimension = excluded.dimension,
        positive_pole = excluded.positive_pole
    `,
    params,
  };
}

let sqliteDatabase: DatabaseSync | undefined;
let sqliteTransactionTail: Promise<void> = Promise.resolve();

async function getSqliteDatabase() {
  if (sqliteDatabase) return sqliteDatabase;
  const { DatabaseSync: SqliteDatabase } = await import("node:sqlite");
  const dataDirectory = join(process.cwd(), "data");
  mkdirSync(dataDirectory, { recursive: true });
  const databasePath = process.env.ASTER_DB_PATH || join(dataDirectory, "aster.db");
  const database = new SqliteDatabase(databasePath);
  database.exec("PRAGMA busy_timeout = 10000;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec(SQLITE_SCHEMA_SQL);
  sqliteDatabase = database;
  return database;
}

const sqliteExecutor: DbExecutor = {
  dialect: "sqlite",
  async all<T>(sql: string, params: SqlValue[] = []) {
    return (await getSqliteDatabase()).prepare(sql).all(...params) as unknown as T[];
  },
  async get<T>(sql: string, params: SqlValue[] = []) {
    return (await getSqliteDatabase()).prepare(sql).get(...params) as T | undefined;
  },
  async run(sql: string, params: SqlValue[] = []) {
    const result = (await getSqliteDatabase()).prepare(sql).run(...params);
    return { changes: Number(result.changes) };
  },
};

neonConfig.webSocketConstructor = WebSocket;

let postgresPool: Pool | undefined;

function getPostgresPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Postgres persistence.");
  postgresPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return postgresPool;
}

function postgresExecutor(client: Pool | PoolClient): DbExecutor {
  return {
    dialect: "postgres",
    async all<T>(sql: string, params: SqlValue[] = []) {
      const result = await client.query(toPostgresSql(sql), params);
      return result.rows as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      const result = await client.query(toPostgresSql(sql), params);
      return result.rows[0] as T | undefined;
    },
    async run(sql: string, params: SqlValue[] = []) {
      const result = await client.query(toPostgresSql(sql), params);
      return { changes: result.rowCount || 0 };
    },
  };
}

async function rawPostgresTransaction<T>(work: (executor: DbExecutor) => Promise<T>) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(postgresExecutor(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

let initialization: Promise<void> | undefined;

async function initializeDatabase() {
  if (usesPostgres) {
    await rawPostgresTransaction(async (executor) => {
      await executor.run("SELECT pg_advisory_xact_lock(hashtext(?))", ["aster-schema-v1"]);
      await executor.run(SCHEMA_SQL);
      const seeded = await executor.get<{ value: string }>("SELECT value FROM aster_meta WHERE key = ?", [
        "question-bank-aster-1",
      ]);
      if (!seeded || seeded.value !== String(QUESTION_BANK.length)) {
        const statement = questionSeedStatement();
        await executor.run(statement.sql, statement.params);
        await executor.run(
          `INSERT INTO aster_meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
          ["question-bank-aster-1", String(QUESTION_BANK.length)],
        );
      }
    });
    return;
  }

  const executor = sqliteExecutor;
  const seeded = await executor.get<{ value: string }>("SELECT value FROM aster_meta WHERE key = ?", [
    "question-bank-aster-1",
  ]);
  if (!seeded || seeded.value !== String(QUESTION_BANK.length)) {
    const statement = questionSeedStatement();
    await executor.run(statement.sql, statement.params);
    await executor.run(
      `INSERT INTO aster_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      ["question-bank-aster-1", String(QUESTION_BANK.length)],
    );
  }
}

async function ready() {
  initialization ??= initializeDatabase().catch((error) => {
    initialization = undefined;
    throw error;
  });
  await initialization;
}

function rootExecutor() {
  return usesPostgres ? postgresExecutor(getPostgresPool()) : sqliteExecutor;
}

export async function queryAll<T>(sql: string, params: SqlValue[] = []) {
  await ready();
  return rootExecutor().all<T>(sql, params);
}

export async function queryOne<T>(sql: string, params: SqlValue[] = []) {
  await ready();
  return rootExecutor().get<T>(sql, params);
}

export async function execute(sql: string, params: SqlValue[] = []) {
  await ready();
  return rootExecutor().run(sql, params);
}

export async function transaction<T>(work: (executor: DbExecutor) => Promise<T>) {
  await ready();
  if (usesPostgres) return rawPostgresTransaction(work);

  let release: () => void = () => undefined;
  const previous = sqliteTransactionTail;
  sqliteTransactionTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const database = await getSqliteDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = await work(sqliteExecutor);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    release();
  }
}

export function locking(sql: string, executor: DbExecutor) {
  return executor.dialect === "postgres" ? `${sql} FOR UPDATE` : sql;
}

export interface RoomRow {
  id: string;
  code: string;
  host_participant_id: string;
  status: "lobby" | "survey" | "revealed";
  questionnaire_version: string;
  is_demo: number;
  created_at: string | Date;
}

export interface ParticipantRow {
  id: string;
  room_id: string;
  nickname: string;
  created_at: string | Date;
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
  submitted_at: string | Date | null;
  answer_count?: number | string;
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

export async function createRoom(nickname: string, isDemo = false, executor?: DbExecutor) {
  const create = async (database: DbExecutor) => {
    const roomId = randomUUID();
    const participantId = randomUUID();
    const sessionToken = token();
    const recoveryToken = token();
    let code = roomCode();
    while (await database.get("SELECT 1 FROM rooms WHERE code = ?", [code])) code = roomCode();

    await database.run("INSERT INTO rooms (id, code, host_participant_id, is_demo) VALUES (?, ?, ?, ?)", [
      roomId,
      code,
      participantId,
      isDemo ? 1 : 0,
    ]);
    await database.run(
      "INSERT INTO participants (id, room_id, nickname, session_hash, recovery_hash) VALUES (?, ?, ?, ?, ?)",
      [participantId, roomId, nickname, hashToken(sessionToken), hashToken(recoveryToken)],
    );
    return { roomId, participantId, code, sessionToken, recoveryToken };
  };

  return executor ? create(executor) : transaction(create);
}

export async function getRoomByCode(code: string, executor?: DbExecutor) {
  const database = executor || rootExecutor();
  if (!executor) await ready();
  return database.get<RoomRow>("SELECT * FROM rooms WHERE code = ?", [code.toUpperCase()]);
}

export async function getParticipantBySession(sessionToken: string | undefined, roomId?: string, executor?: DbExecutor) {
  if (!sessionToken) return undefined;
  const database = executor || rootExecutor();
  if (!executor) await ready();
  const sql = roomId
    ? "SELECT id, room_id, nickname, created_at FROM participants WHERE session_hash = ? AND room_id = ?"
    : "SELECT id, room_id, nickname, created_at FROM participants WHERE session_hash = ?";
  return database.get<ParticipantRow>(sql, roomId ? [hashToken(sessionToken), roomId] : [hashToken(sessionToken)]);
}

export async function getRoomParticipants(roomId: string, executor?: DbExecutor) {
  const database = executor || rootExecutor();
  if (!executor) await ready();
  return database.all<ParticipantRow>(
    "SELECT id, room_id, nickname, created_at FROM participants WHERE room_id = ? ORDER BY created_at",
    [roomId],
  );
}

export async function createAssessments(roomId: string, executor?: DbExecutor): Promise<void> {
  if (!executor) {
    await transaction((database) => createAssessments(roomId, database));
    return;
  }
  const participants = await getRoomParticipants(roomId, executor);
  for (const reviewer of participants) {
    for (const target of participants) {
      await executor.run(
        `INSERT INTO assessments (id, room_id, reviewer_id, target_id, is_self)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(reviewer_id, target_id) DO NOTHING`,
        [randomUUID(), roomId, reviewer.id, target.id, reviewer.id === target.id ? 1 : 0],
      );
    }
  }
  await executor.run("UPDATE rooms SET status = 'survey' WHERE id = ?", [roomId]);
}

export async function getAssessmentsForReviewer(roomId: string, reviewerId: string) {
  const rows = await queryAll<AssessmentRow>(
    `SELECT a.*, p.nickname AS target_name, COUNT(ans.id) AS answer_count
     FROM assessments a
     JOIN participants p ON p.id = a.target_id
     LEFT JOIN answers ans ON ans.assessment_id = a.id
     WHERE a.room_id = ? AND a.reviewer_id = ?
     GROUP BY a.id, p.nickname, p.created_at
     ORDER BY a.is_self, p.created_at`,
    [roomId, reviewerId],
  );
  return rows.map((row) => ({ ...row, answer_count: Number(row.answer_count || 0) }));
}

export async function getAssessment(assessmentId: string, executor?: DbExecutor) {
  const database = executor || rootExecutor();
  if (!executor) await ready();
  const row = await database.get<AssessmentRow>(
    `SELECT a.*, target.nickname AS target_name, reviewer.nickname AS reviewer_name,
       COUNT(ans.id) AS answer_count
     FROM assessments a
     JOIN participants target ON target.id = a.target_id
     JOIN participants reviewer ON reviewer.id = a.reviewer_id
     LEFT JOIN answers ans ON ans.assessment_id = a.id
     WHERE a.id = ?
     GROUP BY a.id, target.nickname, reviewer.nickname`,
    [assessmentId],
  );
  return row ? { ...row, answer_count: Number(row.answer_count || 0) } : undefined;
}

export async function roomCompletion(roomId: string) {
  const rows = await queryAll<{ reviewer_id: string; required_total: number | string; required_done: number | string }>(
    `SELECT reviewer_id,
       SUM(CASE WHEN is_self = 0 THEN 1 ELSE 0 END) AS required_total,
       SUM(CASE WHEN is_self = 0 AND status = 'submitted' THEN 1 ELSE 0 END) AS required_done
     FROM assessments WHERE room_id = ? GROUP BY reviewer_id`,
    [roomId],
  );
  return rows.map((row) => ({
    reviewer_id: row.reviewer_id,
    required_total: Number(row.required_total || 0),
    required_done: Number(row.required_done || 0),
  }));
}

export async function maybeRevealRoom(roomId: string, executor?: DbExecutor) {
  const database = executor || rootExecutor();
  if (!executor) await ready();
  const counts = await database.get<{ total: number | string; done: number | string | null }>(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS done
     FROM assessments WHERE room_id = ? AND is_self = 0`,
    [roomId],
  );
  const total = Number(counts?.total || 0);
  const done = Number(counts?.done || 0);
  if (total > 0 && total === done) {
    await database.run("UPDATE rooms SET status = 'revealed' WHERE id = ?", [roomId]);
    return true;
  }
  return false;
}

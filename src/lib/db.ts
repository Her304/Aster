import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { Client, neon } from "@neondatabase/serverless";
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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sign_in_codes (
    email TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    window_started_at BIGINT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS surveys (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    owner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    self_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
    board_public INTEGER NOT NULL DEFAULT 1 CHECK(board_public IN (0, 1)),
    questionnaire_version TEXT NOT NULL DEFAULT 'bloom-1',
    notify INTEGER NOT NULL DEFAULT 0 CHECK(notify IN (0, 1)),
    notified_level INTEGER NOT NULL DEFAULT 0,
    locale TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    is_owner INTEGER NOT NULL DEFAULT 0 CHECK(is_owner IN (0, 1)),
    respondent_name TEXT NOT NULL,
    relation TEXT NOT NULL,
    result_type TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, visitor_id)
  );

  CREATE TABLE IF NOT EXISTS survey_answers (
    response_id TEXT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL,
    value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 5),
    PRIMARY KEY(response_id, question_id)
  );

  CREATE INDEX IF NOT EXISTS idx_participants_room ON participants(room_id);
  CREATE INDEX IF NOT EXISTS idx_assessments_room ON assessments(room_id);
  CREATE INDEX IF NOT EXISTS idx_answers_assessment ON answers(assessment_id);
  CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_visitors_user ON visitors(user_id);
  CREATE INDEX IF NOT EXISTS idx_responses_survey ON survey_responses(survey_id);
  CREATE INDEX IF NOT EXISTS idx_responses_user ON survey_responses(user_id);
`;

const SQLITE_SCHEMA_SQL = SCHEMA_SQL.replaceAll("TIMESTAMPTZ", "TEXT");

/** Columns added after a table first shipped; CREATE TABLE IF NOT EXISTS won't add them to an existing table. */
const ADDED_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  { table: "surveys", column: "notify", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "surveys", column: "notified_level", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "surveys", column: "locale", definition: "TEXT NOT NULL DEFAULT 'en'" },
];
// Read per call: on Cloudflare the environment is bound to the request, not the module.
const usesPostgres = () => Boolean(process.env.DATABASE_URL);

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
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    throw new Error("DATABASE_URL is not set. Cloudflare Workers can't use the local SQLite fallback; add DATABASE_URL as a secret.");
  }
  const { DatabaseSync: SqliteDatabase } = await import("node:sqlite");
  const dataDirectory = join(process.cwd(), "data");
  mkdirSync(dataDirectory, { recursive: true });
  const databasePath = process.env.ASTER_DB_PATH || join(dataDirectory, "aster.db");
  const database = new SqliteDatabase(databasePath);
  database.exec("PRAGMA busy_timeout = 10000;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec(SQLITE_SCHEMA_SQL);
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((existing) => existing.name === column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
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

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for Postgres persistence.");
  return url;
}

/**
 * Connections are never shared between requests: Cloudflare Workers forbids
 * reusing a socket opened by another request. Single statements go over
 * Neon's stateless HTTP endpoint; transactions open their own WebSocket
 * client and close it when done. Both work the same on Node and Vercel.
 */
function postgresHttpExecutor(): DbExecutor {
  const sql = neon(databaseUrl(), { fullResults: true });
  return {
    dialect: "postgres",
    async all<T>(text: string, params: SqlValue[] = []) {
      return (await sql.query(toPostgresSql(text), params)).rows as T[];
    },
    async get<T>(text: string, params: SqlValue[] = []) {
      return (await sql.query(toPostgresSql(text), params)).rows[0] as T | undefined;
    },
    async run(text: string, params: SqlValue[] = []) {
      return { changes: (await sql.query(toPostgresSql(text), params)).rowCount || 0 };
    },
  };
}

function postgresClientExecutor(client: Client): DbExecutor {
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
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN");
    const result = await work(postgresClientExecutor(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

let initialization: Promise<void> | undefined;

async function initializeDatabase() {
  if (usesPostgres()) {
    await rawPostgresTransaction(async (executor) => {
      await executor.run("SELECT pg_advisory_xact_lock(hashtext(?))", ["aster-schema-v1"]);
      await executor.run(SCHEMA_SQL);
      for (const { table, column, definition } of ADDED_COLUMNS) {
        await executor.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
      }
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
  return usesPostgres() ? postgresHttpExecutor() : sqliteExecutor;
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
  if (usesPostgres()) return rawPostgresTransaction(work);

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
    // Ties broken by id so everyone sees, and answers about, friends in the same order.
    "SELECT id, room_id, nickname, created_at FROM participants WHERE room_id = ? ORDER BY created_at, id",
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
     ORDER BY a.is_self DESC, p.created_at, p.id`,
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
       COUNT(*) AS required_total,
       SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS required_done
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
     FROM assessments WHERE room_id = ?`,
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

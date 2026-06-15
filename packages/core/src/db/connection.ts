import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  memories,
  sessions,
  handoffLogs,
} from "./schema.js";
import * as schema from "./schema.js";

type Db = BetterSQLite3Database<typeof schema>;

let db: Db | null = null;
let sqlite: InstanceType<typeof Database> | null = null;

export function createConnection(dbPath: string): Db {
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  return db;
}

export function initializeDatabase(): void {
  if (!sqlite) throw new Error("Call createConnection() first.");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      workspace TEXT NOT NULL DEFAULT 'main',
      repo TEXT,
      branch TEXT,
      task TEXT,
      tags TEXT DEFAULT '[]',
      source_kind TEXT NOT NULL,
      source_agent TEXT NOT NULL,
      source_session_id TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      status TEXT NOT NULL DEFAULT 'active',
      pinned INTEGER NOT NULL DEFAULT 0,
      supersedes TEXT,
      superseded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      workspace TEXT NOT NULL DEFAULT 'main',
      repo TEXT,
      branch TEXT,
      task TEXT,
      summary TEXT,
      files_touched TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS handoff_logs (
      id TEXT PRIMARY KEY,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      task TEXT,
      pack_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(workspace, repo, branch);
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
    CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at);
  `);
}

export function getDb(): Db {
  if (!db) throw new Error("Database not initialized. Call createConnection() first.");
  return db;
}

export { memories, sessions, handoffLogs };
export * from "./schema.js";
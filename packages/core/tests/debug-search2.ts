import Database from "better-sqlite3";
import { rmSync, existsSync } from "node:fs";
import { createConnection, initializeDatabase } from "../src/db/connection.js";
import { createMemory } from "../src/memory/engine.js";
import { memories } from "../src/db/connection.js";
import { eq, and } from "drizzle-orm";
import { getDb } from "../src/db/connection.js";

const TEST_DB = "/tmp/handoff-os-debug2.db";

if (existsSync(TEST_DB)) rmSync(TEST_DB);
createConnection(TEST_DB);
initializeDatabase();

createMemory({
  type: "fact",
  title: "Mem 1",
  content: "Content 1",
  scope: { workspace: "main", repo: "test-repo", branch: "main" },
  source: { kind: "manual", agent: "test" },
});

const rawDb = new Database(TEST_DB);
const rawRows = rawDb.prepare("SELECT * FROM memories").all();
console.log("Raw rows:", rawRows.length);
rawRows.forEach((r: any) => console.log("  ", r.repo, r.branch, r.workspace));

const drizzleRows = getDb().select().from(memories).all();
console.log("Drizzle all rows:", drizzleRows.length);

const filteredRows = getDb()
  .select()
  .from(memories)
  .where(and(eq(memories.repo, "test-repo"), eq(memories.branch, "main")))
  .all();
console.log("Filtered rows:", filteredRows.length);

const sql = getDb()
  .select()
  .from(memories)
  .where(and(eq(memories.repo, "test-repo"), eq(memories.branch, "main")))
  .toSQL();
console.log("SQL:", sql.sql);
console.log("Params:", sql.params);

rawDb.close();
rmSync(TEST_DB);
if (existsSync(TEST_DB + "-wal")) rmSync(TEST_DB + "-wal");
if (existsSync(TEST_DB + "-shm")) rmSync(TEST_DB + "-shm");
import { createConnection, initializeDatabase } from "../src/db/connection.js";
import { createMemory, getMemory, searchMemories } from "../src/memory/engine.js";
import { rmSync, existsSync } from "node:fs";

const TEST_DB = "/tmp/handoff-os-debug.db";

if (existsSync(TEST_DB)) rmSync(TEST_DB);
createConnection(TEST_DB);
initializeDatabase();

const mem1 = createMemory({
  type: "fact",
  title: "Mem 1",
  content: "Content 1",
  scope: { workspace: "main", repo: "test-repo", branch: "main" },
  source: { kind: "manual", agent: "test" },
});
console.log("Created mem1:", mem1.id);

const mem2 = createMemory({
  type: "fact",
  title: "Mem 2",
  content: "Content 2",
  scope: { workspace: "main", repo: "test-repo", branch: "main" },
  source: { kind: "manual", agent: "test" },
});
console.log("Created mem2:", mem2.id);

const results = searchMemories({
  scope: { repo: "test-repo", branch: "main" },
  offset: 0,
});
console.log("Search results:", results.length);
console.log(JSON.stringify(results, null, 2));

rmSync(TEST_DB);
if (existsSync(TEST_DB + "-wal")) rmSync(TEST_DB + "-wal");
if (existsSync(TEST_DB + "-shm")) rmSync(TEST_DB + "-shm");
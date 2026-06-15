import { describe, it, expect, beforeAll } from "vitest";
import { rmSync, existsSync } from "node:fs";
import { createConnection, initializeDatabase } from "../src/db/connection.js";
import { createMemory, searchMemories } from "../src/memory/engine.js";

const TEST_DB = "/tmp/handoff-os-test2.db";

beforeAll(() => {
  if (existsSync(TEST_DB)) rmSync(TEST_DB);
  createConnection(TEST_DB);
  initializeDatabase();
});

it("search should find created memories", () => {
  for (let i = 0; i < 3; i++) {
    createMemory({
      type: "fact",
      title: `Test fact ${i}`,
      content: `Content ${i}`,
      scope: { workspace: "main", repo: "test-repo", branch: "main" },
      source: { kind: "manual", agent: "test" },
    });
  }

  const results = searchMemories({
    scope: { repo: "test-repo", branch: "main" },
    offset: 0,
  });

  expect(results.length).toBe(3);
});
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createConnection, initializeDatabase } from "../src/db/connection.js";
import { createMemory, getMemory, searchMemories, listOpenTasks } from "../src/memory/engine.js";
import { pinMemory, invalidateMemory, supersedeMemory } from "../src/memory/lifecycle.js";
import { rmSync, existsSync } from "node:fs";

const TEST_DB = "/tmp/handoff-os-test.db";

beforeAll(() => {
  if (existsSync(TEST_DB)) rmSync(TEST_DB);
  createConnection(TEST_DB);
  initializeDatabase();
});

afterAll(() => {
  if (existsSync(TEST_DB)) rmSync(TEST_DB);
  if (existsSync(TEST_DB + "-wal")) rmSync(TEST_DB + "-wal");
  if (existsSync(TEST_DB + "-shm")) rmSync(TEST_DB + "-shm");
});

describe("Memory Engine", () => {
  it("should create and retrieve a memory", () => {
    const mem = createMemory({
      type: "decision",
      title: "Use SQLite for local storage",
      content: "SQLite with WAL mode for better concurrency",
      scope: { workspace: "main", repo: "test-repo", branch: "main" },
      source: { kind: "manual", agent: "test" },
      confidence: 0.9,
    });

    expect(mem.id).toMatch(/^mem_/);
    expect(mem.type).toBe("decision");
    expect(mem.status).toBe("active");

    const retrieved = getMemory(mem.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe("Use SQLite for local storage");
  });

  it("should search memories by scope", () => {
    createMemory({
      type: "fact",
      title: "Repo uses TypeScript",
      content: "Monorepo with pnpm workspaces",
      scope: { workspace: "main", repo: "test-repo", branch: "main" },
      source: { kind: "manual", agent: "test" },
    });
    createMemory({
      type: "fact",
      title: "Another memory for same scope",
      content: "Testing scope search",
      scope: { workspace: "main", repo: "test-repo", branch: "main" },
      source: { kind: "manual", agent: "test" },
    });

    const results = searchMemories({
      scope: { repo: "test-repo", branch: "main" },
      offset: 0,
    });

    expect(results.length).toBeGreaterThanOrEqual(2, `Found ${results.length} results: ${JSON.stringify(results.map(r => ({id: r.id, type: r.type, repo: r.scope.repo, branch: r.scope.branch})))}`);
    expect(results[0]?.scope.repo).toBe("test-repo");
  });

  it("should search by type", () => {
    createMemory({
      type: "decision",
      title: "Test decision for search",
      content: "Testing type search",
      scope: { workspace: "main", repo: "test-repo" },
      source: { kind: "manual", agent: "test" },
    });

    const results = searchMemories({
      type: "decision",
      offset: 0,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.type === "decision")).toBe(true);
  });

  it("should list open tasks", () => {
    createMemory({
      type: "task",
      title: "Implement OAuth flow",
      content: "Add Google OAuth",
      scope: { workspace: "main", repo: "test-repo", branch: "feat/auth" },
      source: { kind: "manual", agent: "test" },
      confidence: 0.8,
    });

    const tasks = listOpenTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.every((t) => t.type === "task")).toBe(true);
  });

  it("should filter tasks by scope", () => {
    createMemory({
      type: "task",
      title: "Task for scope filtering",
      content: "Test task scope filter",
      scope: { workspace: "main", repo: "test-repo", branch: "feat/auth" },
      source: { kind: "manual", agent: "test" },
    });

    const tasks = listOpenTasks({ repo: "test-repo", branch: "feat/auth" });
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0]?.scope.branch).toBe("feat/auth");
  });
});

describe("Memory Lifecycle", () => {
  it("should pin a memory", () => {
    const mem = createMemory({
      type: "fact",
      title: "Critical architecture note",
      content: "Must use WAL mode",
      scope: { workspace: "main", repo: "test-repo" },
      source: { kind: "manual", agent: "test" },
    });

    pinMemory(mem.id);
    const updated = getMemory(mem.id);
    expect(updated?.pinned).toBe(true);
  });

  it("should invalidate a memory", () => {
    const mem = createMemory({
      type: "assumption",
      title: "Redis used for caching",
      content: "Maybe not true anymore",
      scope: { workspace: "main", repo: "test-repo" },
      source: { kind: "manual", agent: "test" },
    });

    invalidateMemory(mem.id);
    const updated = getMemory(mem.id);
    expect(updated?.status).toBe("invalidated");
  });

  it("should supersede a memory", () => {
    const old = createMemory({
      type: "decision",
      title: "Use REST API",
      content: "Initial decision",
      scope: { workspace: "main", repo: "test-repo" },
      source: { kind: "manual", agent: "test" },
    });

    const updated = createMemory({
      type: "decision",
      title: "Use GraphQL instead",
      content: "Updated decision",
      scope: { workspace: "main", repo: "test-repo" },
      source: { kind: "manual", agent: "test" },
      supersedes: old.id,
    });

    const oldMem = getMemory(old.id);
    expect(oldMem?.status).toBe("superseded");
    expect(oldMem?.superseded_by).toBe(updated.id);
  });
});
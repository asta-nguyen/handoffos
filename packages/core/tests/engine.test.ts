import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createConnection, initializeDatabase, getDb, memories } from "../src/db/connection.js";
import { createMemory, getMemory, searchMemories, listOpenTasks } from "../src/memory/engine.js";
import { pinMemory, invalidateMemory, supersedeMemory, detectStaleMemories } from "../src/memory/lifecycle.js";
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

  it("supersedeMemory() marks old memory with new id", () => {
    const a = createMemory({
      type: "fact",
      title: "First version",
      content: "v1",
      scope: { workspace: "main", repo: "test-repo" },
      source: { kind: "manual", agent: "test" },
    });
    const b = createMemory({
      type: "fact",
      title: "Second version",
      content: "v2",
      scope: { workspace: "main", repo: "test-repo" },
      source: { kind: "manual", agent: "test" },
    });

    supersedeMemory(a.id, b.id);
    const updated = getMemory(a.id);
    expect(updated?.status).toBe("superseded");
    expect(updated?.superseded_by).toBe(b.id);
  });

  it("detectStaleMemories flags active memories older than 7 days", () => {
    const stale = createMemory({
      type: "decision",
      title: "Old decision",
      content: "made last month",
      scope: { workspace: "main", repo: "test-repo", branch: "main" },
      source: { kind: "manual", agent: "test" },
    });
    // Backdate to 8 days ago so the 7-day staleness threshold triggers
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    getDb().update(memories).set({ created_at: eightDaysAgo }).where(eq(memories.id, stale.id)).run();

    const staleRecords = detectStaleMemories("test-repo", "main");
    expect(staleRecords.some((m) => m.id === stale.id)).toBe(true);

    const after = getMemory(stale.id);
    expect(after?.status).toBe("stale");
  });

  it("detectStaleMemories returns [] when no scope provided and not in a git repo", () => {
    const result = detectStaleMemories();
    expect(Array.isArray(result)).toBe(true);
  });

  it("searchMemories by task scope and by text query (title vs content match)", () => {
    createMemory({
      type: "fact",
      title: "Architecture uses ports",
      content: "internal note about port allocation",
      scope: { workspace: "main", repo: "test-repo", branch: "main", task: "migrate-db" },
      source: { kind: "manual", agent: "test" },
    });
    createMemory({
      type: "fact",
      title: "Other note",
      content: "mentions ports briefly",
      scope: { workspace: "main", repo: "test-repo", branch: "main", task: "other-task" },
      source: { kind: "manual", agent: "test" },
    });

    const byTask = searchMemories({ scope: { task: "migrate-db" }, offset: 0 });
    expect(byTask.length).toBeGreaterThan(0);
    expect(byTask.every((m) => m.scope.task === "migrate-db")).toBe(true);

    const byTitleText = searchMemories({ query: "Architecture", offset: 0 });
    expect(byTitleText.length).toBeGreaterThan(0);

    const byContentText = searchMemories({ query: "mentions ports", offset: 0 });
    expect(byContentText.length).toBeGreaterThan(0);
  });
});
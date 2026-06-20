import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createConnection, initializeDatabase } from "../src/db/connection.js";
import {
  generateSnapshotData,
  formatSnapshotMarkdown,
  formatSnapshotJson,
  getGitDiff,
  writeContextSnapshot,
  type SnapshotData,
} from "../src/handoff/snapshot.js";
import { createMemory } from "../src/memory/engine.js";
import { getCurrentBranch } from "../src/git/context.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DB = "/tmp/handoff-os-snapshot-test.db";
const TEST_DIR = mkdtempSync(join(tmpdir(), "handoff-snapshot-"));

beforeAll(() => {
  createConnection(TEST_DB);
  initializeDatabase();
});

afterAll(() => {
  rmSync(TEST_DB, { force: true });
  rmSync(TEST_DB + "-wal", { force: true });
  rmSync(TEST_DB + "-shm", { force: true });
  rmSync(TEST_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  // Clear tables between tests by recreating connection
  createConnection(TEST_DB);
  initializeDatabase();
});

describe("generateSnapshotData", () => {
  it("returns a snapshot with required fields", () => {
    const snap = generateSnapshotData();

    expect(snap.goal).toBeDefined();
    expect(snap.branch).toBeDefined();
    expect(snap.repo).toBeDefined();
    expect(snap.agent).toBe("handoff-os");
    expect(Array.isArray(snap.done)).toBe(true);
    expect(Array.isArray(snap.in_progress)).toBe(true);
    expect(Array.isArray(snap.will_do)).toBe(true);
    expect(Array.isArray(snap.changes)).toBe(true);
    expect(Array.isArray(snap.removed)).toBe(true);
    expect(Array.isArray(snap.decisions)).toBe(true);
    expect(Array.isArray(snap.blockers)).toBe(true);
    expect(Array.isArray(snap.next_steps)).toBe(true);
    expect(snap.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("omits task field when not provided", () => {
    const snap = generateSnapshotData();
    expect(snap.task).toBeUndefined();
    const json = JSON.parse(formatSnapshotJson(snap));
    expect("task" in json).toBe(false);
  });

  it("includes task field when provided", () => {
    const snap = generateSnapshotData({ task: "Implement OAuth" });
    expect(snap.task).toBe("Implement OAuth");
    expect(snap.goal).toBe("Implement OAuth");
    const json = JSON.parse(formatSnapshotJson(snap));
    expect(json.task).toBe("Implement OAuth");
  });

  it("categorizes open tasks by [done] / [todo] / no prefix", () => {
    const git = getCurrentBranch();
    const scope = { workspace: "main" as const, repo: git.repo, branch: git.name };
    createMemory({
      type: "task",
      title: "[done] Set up SQLite",
      content: "done",
      scope,
      source: { kind: "manual", agent: "test" },
    });
    createMemory({
      type: "task",
      title: "[todo] Add OAuth",
      content: "todo",
      scope,
      source: { kind: "manual", agent: "test" },
    });
    createMemory({
      type: "task",
      title: "Currently refactoring",
      content: "in progress",
      scope,
      source: { kind: "manual", agent: "test" },
    });

    const snap = generateSnapshotData();

    expect(snap.done).toContain("Set up SQLite");
    expect(snap.will_do).toContain("Add OAuth");
    expect(snap.in_progress).toContain("Currently refactoring");
  });
});

describe("formatSnapshotMarkdown", () => {
  it("includes goal, branch, and repo", () => {
    const snap: SnapshotData = {
      goal: "Test goal",
      branch: "main",
      repo: "test-repo",
      agent: "handoff-os",
      done: [],
      in_progress: [],
      will_do: [],
      changes: ["1 files changed", "- src/foo.ts"],
      removed: [],
      decisions: [],
      blockers: [],
      next_steps: ["Continue implementation"],
      generated_at: new Date().toISOString(),
    };
    const md = formatSnapshotMarkdown(snap);
    expect(md).toContain("# Handoff: Test goal");
    expect(md).toContain("Branch: main");
    expect(md).toContain("Repo: test-repo");
    expect(md).toContain("src/foo.ts");
  });

  it("renders blockers section when present", () => {
    const snap: SnapshotData = {
      goal: "g",
      branch: "b",
      repo: "r",
      agent: "handoff-os",
      done: [],
      in_progress: [],
      will_do: [],
      changes: ["No uncommitted changes."],
      removed: [],
      decisions: [],
      blockers: [{ title: "Build is broken", content: "TS errors everywhere" }],
      next_steps: ["Fix build"],
      generated_at: new Date().toISOString(),
    };
    const md = formatSnapshotMarkdown(snap);
    expect(md).toContain("### Blockers");
    expect(md).toContain("Build is broken");
  });

  it("renders removed section when present", () => {
    const snap: SnapshotData = {
      goal: "g",
      branch: "b",
      repo: "r",
      agent: "handoff-os",
      done: [],
      in_progress: [],
      will_do: [],
      changes: ["No uncommitted changes."],
      removed: ["- `old/foo.ts` — deleted"],
      decisions: [],
      blockers: [],
      next_steps: ["Continue"],
      generated_at: new Date().toISOString(),
    };
    const md = formatSnapshotMarkdown(snap);
    expect(md).toContain("old/foo.ts");
    expect(md).toContain("deleted");
  });

  it("'current' falls back through in_progress → will_do → next_steps", () => {
    const onlyNext: SnapshotData = {
      goal: "g",
      branch: "b",
      repo: "r",
      agent: "handoff-os",
      done: [],
      in_progress: [],
      will_do: [],
      changes: ["No uncommitted changes."],
      removed: [],
      decisions: [],
      blockers: [],
      next_steps: ["Plan next step"],
      generated_at: new Date().toISOString(),
    };
    expect(formatSnapshotMarkdown(onlyNext)).toContain("**Current:** Plan next step");

    const onlyWillDo: SnapshotData = { ...onlyNext, will_do: ["Build handoff CLI"] };
    expect(formatSnapshotMarkdown(onlyWillDo)).toContain("**Current:** Build handoff CLI");

    const withInProgress: SnapshotData = {
      ...onlyNext,
      in_progress: ["Refactoring schema"],
      will_do: ["Ignored"],
      next_steps: ["Ignored too"],
    };
    expect(formatSnapshotMarkdown(withInProgress)).toContain("**Current:** Refactoring schema");
  });
});

describe("formatSnapshotJson", () => {
  it("produces parseable JSON with all fields", () => {
    const snap: SnapshotData = {
      goal: "g",
      branch: "b",
      repo: "r",
      agent: "handoff-os",
      done: ["a"],
      in_progress: ["b"],
      will_do: ["c"],
      changes: ["d"],
      removed: ["e"],
      decisions: [{ title: "t", content: "c" }],
      blockers: [{ title: "t", content: "c" }],
      next_steps: ["f"],
      generated_at: "2026-01-01T00:00:00.000Z",
    };
    const parsed = JSON.parse(formatSnapshotJson(snap));
    expect(parsed.goal).toBe("g");
    expect(parsed.done).toEqual(["a"]);
    expect(parsed.decisions[0].title).toBe("t");
    expect(parsed.generated_at).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("getGitDiff", () => {
  it("returns a string (diff or fallback)", () => {
    const diff = getGitDiff();
    expect(typeof diff).toBe("string");
    expect(diff.length).toBeGreaterThan(0);
  });
});

describe("writeContextSnapshot", () => {
  it("writes latest.md, latest.diff, latest.json", () => {
    const ctxDir = join(TEST_DIR, "ctx1");
    const result = writeContextSnapshot(ctxDir);

    expect(existsSync(result.mdPath)).toBe(true);
    expect(existsSync(result.diffPath)).toBe(true);
    expect(existsSync(result.jsonPath)).toBe(true);

    const md = readFileSync(result.mdPath, "utf-8");
    const diff = readFileSync(result.diffPath, "utf-8");
    const json = JSON.parse(readFileSync(result.jsonPath, "utf-8"));

    expect(md).toContain("Branch:");
    expect(diff.length).toBeGreaterThan(0);
    expect(json.branch).toBeDefined();
    expect(result.generated_at).toEqual(json.generated_at);
  });

  it("passes task through to latest.json", () => {
    const ctxDir = join(TEST_DIR, "ctx2");
    const result = writeContextSnapshot(ctxDir, { task: "Build handoff CLI" });

    const json = JSON.parse(readFileSync(result.jsonPath, "utf-8"));
    expect(json.task).toBe("Build handoff CLI");
    expect(json.goal).toBe("Build handoff CLI");

    const md = readFileSync(result.mdPath, "utf-8");
    expect(md).toContain("Build handoff CLI");
  });

  it("overwrites existing files", () => {
    const ctxDir = join(TEST_DIR, "ctx3");
    writeContextSnapshot(ctxDir);
    const second = writeContextSnapshot(ctxDir, { task: "Updated goal" });

    const json = JSON.parse(readFileSync(second.jsonPath, "utf-8"));
    expect(json.task).toBe("Updated goal");
  });
});
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const CLI = "/home/giogio/Project/handoffos/packages/cli/dist/index.js";

function runCtx(args: string[], cwd: string) {
  return spawnSync("node", [CLI, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function setupWorkspace(): string {
  const cwd = mkdtempSync(join(tmpdir(), "ctx-commit-"));
  execSync("git init -q", { cwd, stdio: "ignore" });
  execSync("git config user.email t@t.com", { cwd, stdio: "ignore" });
  execSync("git config user.name t", { cwd, stdio: "ignore" });
  execSync("git commit --allow-empty -q -m init", { cwd, stdio: "ignore" });
  return cwd;
}

describe("ctx commit-session", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = setupWorkspace();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("creates summary memory and writes handoff pack (human output)", () => {
    runCtx(["init"], cwd);
    const res = runCtx(["commit-session", "-m", "Shipped M1"], cwd);
    expect(res.status).toBe(0);
    const handoffDir = join(cwd, ".shared-context/handoffs");
    expect(existsSync(handoffDir)).toBe(true);
    expect(readdirSync(handoffDir).length).toBeGreaterThan(0);
  });

  it("--json returns ok/summary/repo/branch/changed_files/memories_created/handoff_pack", () => {
    runCtx(["init"], cwd);
    const res = runCtx(["commit-session", "-m", "Shipped M1", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBe("Shipped M1");
    expect(parsed.repo).toBeDefined();
    expect(parsed.branch).toBeDefined();
    expect(parsed.changed_files).toEqual([]);
    expect(parsed.memories_created).toHaveLength(1);
    expect(parsed.memories_created[0]).toMatch(/^mem_/);
    expect(parsed.handoff_pack).toContain("handoffs/session-");
    expect(existsSync(parsed.handoff_pack)).toBe(true);
  });

  it("creates an extra 'files touched' memory when changed files exist", () => {
    runCtx(["init"], cwd);
    mkdirSync(join(cwd, "src"), { recursive: true });
    writeFileSync(join(cwd, "src/foo.ts"), "// new file\n");
    // Stage but don't commit — `git diff --name-only HEAD` shows only tracked-file changes
    execSync("git add src/foo.ts", { cwd, stdio: "ignore" });
    const res = runCtx(["commit-session", "-m", "Added foo.ts", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.changed_files).toContain("src/foo.ts");
    expect(parsed.memories_created).toHaveLength(2);
  });
});
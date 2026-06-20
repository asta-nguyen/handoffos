import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
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
  const cwd = mkdtempSync(join(tmpdir(), "ctx-status-"));
  execSync("git init -q", { cwd, stdio: "ignore" });
  execSync("git config user.email t@t.com", { cwd, stdio: "ignore" });
  execSync("git config user.name t", { cwd, stdio: "ignore" });
  execSync("git commit --allow-empty -q -m init", { cwd, stdio: "ignore" });
  return cwd;
}

describe("ctx status", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = setupWorkspace();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("human output shows branch and repo", () => {
    runCtx(["init"], cwd);
    const res = runCtx(["status"], cwd);
    expect(res.status).toBe(0);
    const out = res.stdout;
    expect(out).toContain("handoff-os status");
    expect(out).toContain("Branch:");
    expect(out).toContain("Repo:");
  });

  it("--json returns initialized/repo/branch/changed_files/memories/latest_snapshot", () => {
    runCtx(["init"], cwd);
    const res = runCtx(["status", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed).toHaveProperty("initialized");
    expect(parsed).toHaveProperty("repo");
    expect(parsed).toHaveProperty("branch");
    expect(parsed).toHaveProperty("changed_files");
    expect(parsed).toHaveProperty("memories");
    expect(parsed.memories).toHaveProperty("total");
    expect(parsed.memories).toHaveProperty("active");
    expect(parsed.memories).toHaveProperty("stale");
    expect(parsed).toHaveProperty("latest_snapshot");
    expect(parsed.latest_snapshot).toHaveProperty("exists");
    expect(parsed.latest_snapshot).toHaveProperty("path");
    expect(parsed.latest_snapshot).toHaveProperty("generated_at");
  });

  it("reports initialized=false when .shared-context/ is missing", () => {
    const res = runCtx(["status", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.initialized).toBe(false);
    expect(parsed.latest_snapshot.exists).toBe(false);
  });

  it("reports latest_snapshot.generated_at when latest.json exists", () => {
    runCtx(["init"], cwd);
    const ts = "2026-06-19T12:00:00.000Z";
    writeFileSync(
      join(cwd, ".shared-context/latest.json"),
      JSON.stringify({ generated_at: ts }),
    );
    writeFileSync(join(cwd, ".shared-context/latest.md"), "# Handoff: x\n");
    const res = runCtx(["status", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.initialized).toBe(true);
    expect(parsed.latest_snapshot.exists).toBe(true);
    expect(parsed.latest_snapshot.generated_at).toBe(ts);
  });
});
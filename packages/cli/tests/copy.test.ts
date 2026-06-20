import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
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
  const cwd = mkdtempSync(join(tmpdir(), "ctx-test-"));
  execSync("git init -q", { cwd, stdio: "ignore" });
  execSync("git config user.email t@t.com", { cwd, stdio: "ignore" });
  execSync("git config user.name t", { cwd, stdio: "ignore" });
  execSync("git commit --allow-empty -q -m init", { cwd, stdio: "ignore" });
  return cwd;
}

describe("ctx copy", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = setupWorkspace();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("writes latest.md, latest.diff, latest.json", () => {
    const initRes = runCtx(["init"], cwd);
    expect(initRes.status).toBe(0);
    const res = runCtx(["copy"], cwd);
    expect(res.status).toBe(0);
    expect(existsSync(join(cwd, ".shared-context/latest.md"))).toBe(true);
    expect(existsSync(join(cwd, ".shared-context/latest.diff"))).toBe(true);
    expect(existsSync(join(cwd, ".shared-context/latest.json"))).toBe(true);
  });

  it("--json returns structured output", () => {
    runCtx(["init"], cwd);
    const res = runCtx(["copy", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.files.markdown).toContain("latest.md");
    expect(parsed.files.diff).toContain("latest.diff");
    expect(parsed.files.json).toContain("latest.json");
    expect(parsed.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("--task sets task field in latest.json", () => {
    runCtx(["init"], cwd);
    runCtx(["copy", "--task", "Implement OAuth"], cwd);
    const json = JSON.parse(readFileSync(join(cwd, ".shared-context/latest.json"), "utf-8"));
    expect(json.task).toBe("Implement OAuth");
  });

  it("fails with clear error when .shared-context/ is missing", () => {
    const res = runCtx(["copy"], cwd);
    expect(res.status).not.toBe(0);
    expect(res.stderr + res.stdout).toContain("ctx init");
  });

  it("returns structured error JSON when --json and missing", () => {
    const res = runCtx(["copy", "--json"], cwd);
    expect(res.status).not.toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toContain("ctx init");
  });
});
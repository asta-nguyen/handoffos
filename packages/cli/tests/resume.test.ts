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
  const cwd = mkdtempSync(join(tmpdir(), "ctx-resume-"));
  execSync("git init -q", { cwd, stdio: "ignore" });
  execSync("git config user.email t@t.com", { cwd, stdio: "ignore" });
  execSync("git config user.name t", { cwd, stdio: "ignore" });
  execSync("git commit --allow-empty -q -m init", { cwd, stdio: "ignore" });
  return cwd;
}

describe("ctx resume", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = setupWorkspace();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("reads latest.md when present (universal handoff entrypoint)", () => {
    runCtx(["init"], cwd);
    const content = "# Handoff: ship M1\n\n**Current:** finishing copy command\n";
    writeFileSync(join(cwd, ".shared-context/latest.md"), content);
    const res = runCtx(["resume"], cwd);
    expect(res.status).toBe(0);
    // latest.md is the universal handoff entrypoint — its content should appear verbatim in stdout
    expect(res.stdout).toContain("# Handoff: ship M1");
    expect(res.stdout).toContain("**Current:** finishing copy command");
  });

  it("falls back to memory pack when latest.md is missing", () => {
    runCtx(["init"], cwd);
    const res = runCtx(["resume", "--for", "claude"], cwd);
    expect(res.status).toBe(0);
    expect(res.stdout.length).toBeGreaterThan(0);
  });

  it("--json returns source marker + pack when latest.md exists", () => {
    runCtx(["init"], cwd);
    writeFileSync(join(cwd, ".shared-context/latest.md"), "# Handoff: x\n");
    const res = runCtx(["resume", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.source).toBe("latest");
    expect(parsed.latest_md).toContain("Handoff: x");
    expect(parsed.pack).toBeDefined();
    expect(parsed.pack.title).toBeDefined();
    expect(parsed.formatted).toContain("Handoff: x");
  });

  it("--json reports source=pack when no latest.md exists", () => {
    runCtx(["init"], cwd);
    const res = runCtx(["resume", "--json"], cwd);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.source).toBe("pack");
    expect(parsed.latest_md).toBeUndefined();
    expect(parsed.pack).toBeDefined();
  });
});
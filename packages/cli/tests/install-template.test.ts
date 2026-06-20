import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { installTemplate } from "../src/commands/install-template.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("installTemplate", () => {
  it("installs a valid agent template", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = installTemplate("claude", {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toContain("CLAUDE.md");
      expect(result.message).toContain("Installed claude template");
    }
    expect(writeFileSync).toHaveBeenCalledOnce();
  });

  it("returns error for unknown agent", () => {
    const result = installTemplate("nope", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Unknown agent "nope"');
    }
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("returns error when file exists and force is not set", () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = installTemplate("codex", {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("already exists");
    }
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it("overwrites when --force is set", () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = installTemplate("cursor", { force: true });

    expect(result.ok).toBe(true);
    expect(writeFileSync).toHaveBeenCalledOnce();
  });

  it("writes to the correct file path", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = installTemplate("claude", { cwd: "/tmp/test-project" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toBe("/tmp/test-project/CLAUDE.md");
    }
  });

  it("uses process.cwd() when cwd is not provided", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = installTemplate("kilo", {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toContain(process.cwd());
    }
  });

  it("supports all built-in agents", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    for (const agent of ["claude", "codex", "cursor", "windsurf", "cline", "kilo", "generic"]) {
      const result = installTemplate(agent, { cwd: "/tmp/test" });
      expect(result.ok).toBe(true);
    }
  });
});

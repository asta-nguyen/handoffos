import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createConnection, initializeDatabase, getDb } from "@handoff-os/core";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import { createMcpServer } from "../src/index.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const TEST_DIR = "/tmp/handoff-os-mcp-test";
const SHARED_CTX_DIR = join(TEST_DIR, ".shared-context");
const DB_PATH = join(SHARED_CTX_DIR, "memory.db");

let mcpServer: Awaited<ReturnType<typeof createMcpServer>>;

async function connectClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "0.1.0" });
  await client.connect(clientTransport);
  return client;
}

beforeAll(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(SHARED_CTX_DIR, { recursive: true });

  // Init git repo so tools that call getBranchInfoSafely() work
  execSync("git init", { cwd: TEST_DIR });
  execSync('git config user.email "test@test.com"', { cwd: TEST_DIR });
  execSync('git config user.name "Test"', { cwd: TEST_DIR });
  writeFileSync(join(TEST_DIR, "README.md"), "# Test Repo\nSome content.");
  execSync("git add -A && git commit -m 'Initial commit'", { cwd: TEST_DIR });

  // Init SQLite DB
  createConnection(DB_PATH);
  initializeDatabase();
});

beforeEach(async () => {
  // Remove snapshot files from previous tests
  for (const f of ["latest.md", "latest.diff", "latest.json"]) {
    const p = join(SHARED_CTX_DIR, f);
    if (existsSync(p)) rmSync(p);
  }

  // Fresh server per test
  mcpServer = await createMcpServer();
});

afterAll(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
});

describe("MCP Server Tools", () => {
  it("should create a server with connect method", () => {
    expect(mcpServer).toBeDefined();
    expect(typeof mcpServer.connect).toBe("function");
  });

  it("read_context returns not-found when no snapshot exists", async () => {
    const origCwd = process.cwd();
    process.chdir(TEST_DIR);
    const client = await connectClient();
    const result = await client.callTool({ name: "read_context", arguments: { format: "markdown" } });
    expect(result.isError).toBeUndefined();
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("No snapshot file found");
    }
    process.chdir(origCwd);
    await client.close();
  });

  it("read_context returns markdown content when latest.md exists", async () => {
    writeFileSync(join(SHARED_CTX_DIR, "latest.md"), "# Test Snapshot\n\nSome useful context.");
    const origCwd = process.cwd();
    process.chdir(TEST_DIR);
    const client = await connectClient();
    const result = await client.callTool({ name: "read_context", arguments: { format: "markdown" } });
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text).toContain("Test Snapshot");
      expect(result.content[0].text).toContain("Some useful context.");
    }
    process.chdir(origCwd);
    await client.close();
  });

  it("read_context returns json content when format=json", async () => {
    writeFileSync(join(SHARED_CTX_DIR, "latest.json"), JSON.stringify({ ok: true, data: "test" }));
    const origCwd = process.cwd();
    process.chdir(TEST_DIR);
    const client = await connectClient();
    const result = await client.callTool({ name: "read_context", arguments: { format: "json" } });
    if (result.content[0]?.type === "text") {
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
      expect(parsed.data).toBe("test");
    }
    process.chdir(origCwd);
    await client.close();
  });

  it("copy_context returns structured JSON with file paths and generated_at", async () => {
    const origCwd = process.cwd();
    process.chdir(TEST_DIR);
    const client = await connectClient();
    const result = await client.callTool({ name: "copy_context", arguments: {} });
    expect(result.isError).toBeUndefined();
    if (result.content[0]?.type === "text") {
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
      expect(parsed.files).toBeDefined();
      expect(parsed.files.markdown).toContain("latest.md");
      expect(parsed.files.diff).toContain("latest.diff");
      expect(parsed.files.json).toContain("latest.json");
      expect(parsed.generated_at).toBeDefined();
      expect(typeof parsed.generated_at).toBe("string");
    }
    process.chdir(origCwd);
    await client.close();
  });

  it("commit_session returns structured JSON with session_id, repo, branch, files_touched", async () => {
    const origCwd = process.cwd();
    process.chdir(TEST_DIR);
    const client = await connectClient();
    const result = await client.callTool({ name: "commit_session", arguments: { summary: "Test session work" } });
    expect(result.isError).toBeUndefined();
    if (result.content[0]?.type === "text") {
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
      expect(parsed.session_id).toMatch(/^ses_/);
      expect(typeof parsed.repo).toBe("string");
      expect(parsed.repo?.length).toBeGreaterThan(0);
      expect(typeof parsed.branch).toBe("string");
      expect(Array.isArray(parsed.files_touched)).toBe(true);
    }
    process.chdir(origCwd);
    await client.close();
  });

  it("run_hygiene returns structured JSON with stale_count and stale_memories", async () => {
    const origCwd = process.cwd();
    process.chdir(TEST_DIR);
    const client = await connectClient();
    const result = await client.callTool({ name: "run_hygiene", arguments: {} });
    expect(result.isError).toBeUndefined();
    if (result.content[0]?.type === "text") {
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.ok).toBe(true);
      expect(typeof parsed.stale_count).toBe("number");
      expect(Array.isArray(parsed.stale_memories)).toBe(true);
    }
    process.chdir(origCwd);
    await client.close();
  });
});

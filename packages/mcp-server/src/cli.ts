#!/usr/bin/env node
import { createConnection, initializeDatabase } from "@handoff-os/core";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startMcpServer } from "./index.js";

const dbPath = join(process.cwd(), ".shared-context", "memory.db");

if (!existsSync(dbPath)) {
  console.error("Error: No memory database found at", dbPath);
  console.error("Run `ctx init` in your project root to create one.");
  process.exit(1);
}

try {
  createConnection(dbPath);
  initializeDatabase();
  await startMcpServer(dbPath);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Error starting MCP server:", msg);
  process.exit(1);
}

#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createConnection } from "@handoff-os/core";
import { cli } from "./commands/index.js";

const dbPath = join(process.cwd(), ".shared-context/memory.db");
if (existsSync(dbPath)) {
  createConnection(dbPath);
}

cli.parse();
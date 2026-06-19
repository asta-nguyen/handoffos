import type { CAC } from "cac";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createConnection, initializeDatabase, getBranchInfoSafely } from "@handoff-os/core";

const MEMORY_DB_PATH = ".shared-context/memory.db";
const CONFIG_PATH = ".shared-context/config.json";

export function initCommand(cli: CAC) {
  cli
    .command("init", "Initialize handoff-os in the current workspace")
    .action(() => {
      const cwd = process.cwd();
      const ctxDir = join(cwd, ".shared-context");

      if (existsSync(ctxDir)) {
        console.log(".shared-context/ already exists.");
      } else {
        mkdirSync(join(ctxDir, "sessions"), { recursive: true });
        mkdirSync(join(ctxDir, "handoffs"), { recursive: true });
        mkdirSync(join(ctxDir, "decisions"), { recursive: true });
        mkdirSync(join(ctxDir, "tasks"), { recursive: true });
        mkdirSync(join(ctxDir, "snapshots"), { recursive: true });
      }

      const config = {
        version: "0.1.0",
        workspace: "main",
        embedding_provider: "none" as const,
        ignore_paths: [".shared-context/", "node_modules/", ".git/"],
      };
      writeFileSync(join(cwd, CONFIG_PATH), JSON.stringify(config, null, 2));

      const dbPath = join(cwd, MEMORY_DB_PATH);
      createConnection(dbPath);
      initializeDatabase();

      const branchInfo = getBranchInfoSafely();
      const gitInfo = branchInfo
        ? `  repo: ${branchInfo.repo}, branch: ${branchInfo.name}`
        : "";

      console.log(`Initialized handoff-os in ${cwd}`);
      console.log(`  .shared-context/ created${gitInfo}`);
      console.log("  Ready to use. Run `ctx status` to check state.");
    });
}
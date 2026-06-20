import type { CAC } from "cac";
import { getDb, getBranchInfoSafely } from "@handoff-os/core";
import { memories } from "@handoff-os/core";

import { existsSync } from "node:fs";
import { join } from "node:path";

export function statusCommand(cli: CAC) {
  cli
    .command("status", "Show current workspace context")
    .option("--json", "Output structured JSON instead of human text")
    .action((opts) => {
      const db = getDb();
      const total = db.select().from(memories).all().length;
      const active = db.select().from(memories).all().filter((m) => m.status === "active").length;
      const stale = db.select().from(memories).all().filter((m) => m.status === "stale").length;

      const branchInfo = getBranchInfoSafely();

      const cwd = process.cwd();
      const snapshotPath = join(cwd, ".shared-context", "latest.md");

      if (opts.json) {
        console.log(JSON.stringify({
          initialized: existsSync(join(cwd, ".shared-context", "config.json")),
          repo: branchInfo?.repo ?? null,
          branch: branchInfo?.name ?? null,
          changed_files: branchInfo?.changed_files ?? [],
          memories: { total, active, stale },
          latest_snapshot: {
            exists: existsSync(snapshotPath),
            path: snapshotPath,
            generated_at: null,
          },
        }, null, 2));
      } else {
        const branchStr = branchInfo
          ? `  Branch: ${branchInfo.name}\n  Repo: ${branchInfo.repo}\n  Changed: ${branchInfo.changed_files.length} files`
          : "  (not a git repository)";

        console.log("handoff-os status:");
        console.log(branchStr);
        console.log(`  Memories: ${total} total (${active} active, ${stale} stale)`);
      }
    });
}
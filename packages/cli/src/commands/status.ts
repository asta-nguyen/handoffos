import type { CAC } from "cac";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, memories, getBranchInfoSafely } from "@handoff-os/core";

const CTX_DIR = ".shared-context";
const SNAPSHOT_JSON = "latest.json";
const SNAPSHOT_MD = "latest.md";

interface SnapshotJsonMeta {
  generated_at?: string;
}

function readSnapshotMeta(ctxDir: string): SnapshotJsonMeta | null {
  const jsonPath = join(ctxDir, SNAPSHOT_JSON);
  if (!existsSync(jsonPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(jsonPath, "utf-8")) as SnapshotJsonMeta;
    return parsed;
  } catch {
    return null;
  }
}

export function statusCommand(cli: CAC) {
  cli
    .command("status", "Show current workspace context")
    .option("--json", "Output structured JSON instead of human text")
    .action((opts) => {
      const cwd = process.cwd();
      const ctxDir = join(cwd, CTX_DIR);
      const initialized = existsSync(ctxDir);
      const branchInfo = getBranchInfoSafely();

      let total = 0;
      let active = 0;
      let stale = 0;
      try {
        const db = getDb();
        const rows = db.select().from(memories).all();
        total = rows.length;
        active = rows.filter((m) => m.status === "active").length;
        stale = rows.filter((m) => m.status === "stale").length;
      } catch {
        // DB not initialized — leave counts at 0
      }

      const snapshotMeta = initialized ? readSnapshotMeta(ctxDir) : null;
      const snapshotMdPath = join(ctxDir, SNAPSHOT_MD);
      const latestSnapshot = {
        exists: existsSync(snapshotMdPath),
        path: snapshotMdPath,
        generated_at: snapshotMeta?.generated_at ?? null,
      };

      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              initialized,
              repo: branchInfo?.repo ?? null,
              branch: branchInfo?.name ?? null,
              changed_files: branchInfo?.changed_files ?? [],
              memories: { total, active, stale },
              latest_snapshot: latestSnapshot,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log("handoff-os status:");
      if (branchInfo) {
        console.log(`  Branch: ${branchInfo.name}`);
        console.log(`  Repo: ${branchInfo.repo}`);
        console.log(`  Changed: ${branchInfo.changed_files.length} files`);
      } else {
        console.log("  (not a git repository)");
      }
      console.log(`  Memories: ${total} total (${active} active, ${stale} stale)`);
      if (latestSnapshot.exists) {
        console.log(`  Latest snapshot: ${latestSnapshot.path}`);
      }
    });
}
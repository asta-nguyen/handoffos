import type { CAC } from "cac";
import { getDb, getBranchInfoSafely } from "@handoff-os/core";
import { memories } from "@handoff-os/core";

export function statusCommand(cli: CAC) {
  cli
    .command("status", "Show current workspace context")
    .action(() => {
      const db = getDb();
      const total = db.select().from(memories).all().length;
      const active = db.select().from(memories).all().filter((m) => m.status === "active").length;
      const stale = db.select().from(memories).all().filter((m) => m.status === "stale").length;

      const branchInfo = getBranchInfoSafely();
      const branchStr = branchInfo
        ? `  Branch: ${branchInfo.name}\n  Repo: ${branchInfo.repo}\n  Changed: ${branchInfo.changed_files.length} files`
        : "  (not a git repository)";

      console.log("handoff-os status:");
      console.log(branchStr);
      console.log(`  Memories: ${total} total (${active} active, ${stale} stale)`);
    });
}
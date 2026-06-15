import type { CAC } from "cac";
import { getDb, getCurrentBranch } from "@handoff-os/core";
import { memories } from "@handoff-os/core";

export function statusCommand(cli: CAC) {
  cli
    .command("status", "Show current workspace context")
    .action(() => {
      const db = getDb();
      const total = db.select().from(memories).all().length;
      const active = db.select().from(memories).all().filter((m) => m.status === "active").length;
      const stale = db.select().from(memories).all().filter((m) => m.status === "stale").length;

      let branchInfo = "";
      try {
        const info = getCurrentBranch();
        branchInfo = `  Branch: ${info.name}\n  Repo: ${info.repo}\n  Changed: ${info.changed_files.length} files`;
      } catch {
        branchInfo = "  (not a git repository)";
      }

      console.log("handoff-os status:");
      console.log(branchInfo);
      console.log(`  Memories: ${total} total (${active} active, ${stale} stale)`);
    });
}
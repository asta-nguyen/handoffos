import type { CAC } from "cac";
import { getBranchContext, getCurrentBranch } from "@handoff-os/core";

export function branchContextCommand(cli: CAC) {
  cli
    .command("branch-context", "Show context for the current branch")
    .action(() => {
      const branchInfo = getCurrentBranch();
      console.log(`Branch: ${branchInfo.name}`);
      console.log(`Repo: ${branchInfo.repo}`);
      console.log(`Changed files: ${branchInfo.changed_files.length}`);
      console.log("");

      const context = getBranchContext(branchInfo.name, branchInfo.repo);
      if (context.length === 0) {
        console.log("No memories for this branch yet.");
        return;
      }

      console.log(`Branch memories (${context.length}):\n`);
      for (const mem of context.slice(0, 10)) {
        const statusIcon = mem.pinned ? "[P]" : mem.status === "stale" ? "[S]" : "[ ]";
        console.log(`${statusIcon} ${mem.type.toUpperCase()}: ${mem.title}`);
      }
    });
}
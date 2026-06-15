import type { CAC } from "cac";
import { createMemory, getCurrentBranch, generateResumePack } from "@handoff-os/core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function commitSessionCommand(cli: CAC) {
  cli
    .command("commit-session", "Save current session as structured memory")
    .option("-m, --message <message>", "Session summary message")
    .option("-a, --agent <agent>", "Source agent name", { default: "handoff-os" })
    .action((opts) => {
      const branchInfo = getCurrentBranch();
      const message = opts.message ?? `Session on ${branchInfo.name}`;

      createMemory({
        type: "summary",
        title: message,
        content: `Session on branch ${branchInfo.name}. Files changed: ${branchInfo.changed_files.join(", ")}`,
        scope: { workspace: "main", repo: branchInfo.repo, branch: branchInfo.name },
        source: { kind: "session_commit", agent: opts.agent },
      });

      if (branchInfo.changed_files.length > 0) {
        createMemory({
          type: "fact",
          title: "Files touched this session",
          content: branchInfo.changed_files.join("\n"),
          scope: { workspace: "main", repo: branchInfo.repo, branch: branchInfo.name },
          source: { kind: "session_commit", agent: opts.agent },
        });
      }

      const handoffDir = join(process.cwd(), ".shared-context", "handoffs");
      mkdirSync(handoffDir, { recursive: true });
      const pack = generateResumePack({ target: "generic" });
      writeFileSync(
        join(handoffDir, `session-${Date.now()}.json`),
        JSON.stringify(pack, null, 2),
      );

      console.log(`Session committed: "${message}"`);
      console.log(`  Repo: ${branchInfo.repo}, Branch: ${branchInfo.name}`);
      console.log(`  Changed files: ${branchInfo.changed_files.length}`);
    });
}
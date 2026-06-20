import type { CAC } from "cac";
import type { AgentTarget } from "@handoff-os/shared";
import { generateResumePack, formatForAgent } from "@handoff-os/core";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CTX_DIR = ".shared-context";
const SNAPSHOT_MD = "latest.md";

export function resumeCommand(cli: CAC) {
  cli
    .command("resume [task]", "Generate a resume pack for context handoff")
    .option("--for <agent>", "Target agent (claude, codex, opencode, generic)", { default: "generic" })
    .option("--json", "Output structured JSON instead of agent-formatted text")
    .action((task, opts) => {
      const target = opts.for as AgentTarget;
      const cwd = process.cwd();
      const latestMdPath = join(cwd, CTX_DIR, SNAPSHOT_MD);

      const snapshotExists = existsSync(latestMdPath);
      const snapshotContent = snapshotExists ? readFileSync(latestMdPath, "utf-8") : null;

      if (snapshotExists && snapshotContent !== null && !opts.json) {
        // latest.md is the universal handoff entrypoint — print as-is
        console.log(snapshotContent);
        return;
      }

      const pack = generateResumePack({
        task: task || undefined,
        target,
      });

      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              source: snapshotExists ? "latest" : "pack",
              ...(snapshotContent !== null ? { latest_md: snapshotContent } : {}),
              pack,
              formatted: snapshotExists ? snapshotContent : formatForAgent(pack, target),
            },
            null,
            2,
          ),
        );
        return;
      }

      // Fallback: render the resume pack for the requested agent
      console.log(formatForAgent(pack, target));
    });
}
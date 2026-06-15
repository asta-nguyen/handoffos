import type { CAC } from "cac";
import { generateResumePack, formatForAgent } from "@handoff-os/core";

export function resumeCommand(cli: CAC) {
  cli
    .command("resume [task]", "Generate a resume pack for context handoff")
    .option("--for <agent>", "Target agent (claude, codex, opencode, generic)", { default: "generic" })
    .action((task, opts) => {
      const pack = generateResumePack({
        task: task || undefined,
        target: opts.for as any,
      });
      console.log(formatForAgent(pack, opts.for as any));
    });
}
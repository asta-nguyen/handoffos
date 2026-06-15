import type { CAC } from "cac";
import { generateResumePack, formatForAgent } from "@handoff-os/core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

export function handoffCommand(cli: CAC) {
  cli
    .command("handoff", "Create a handoff pack for another agent")
    .option("--task <task>", "Task name for scoped handoff")
    .option("--for <agent>", "Target agent (claude, codex, opencode, generic)", { default: "generic" })
    .option("--output, -o <file>", "Write to file instead of stdout")
    .action((opts) => {
      const pack = generateResumePack({
        task: opts.task,
        target: opts.for as any,
      });
      const output = formatForAgent(pack, opts.for as any);

      if (opts.output) {
        const handoffDir = join(process.cwd(), ".shared-context", "handoffs");
        const filename = basename(opts.output);
        mkdirSync(handoffDir, { recursive: true });
        writeFileSync(join(handoffDir, filename), output);
        console.log(`Handoff pack written to .shared-context/handoffs/${filename}`);
      } else {
        console.log(output);
      }
    });
}
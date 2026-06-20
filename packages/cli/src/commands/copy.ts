import type { CAC } from "cac";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { writeContextSnapshot } from "@handoff-os/core";

const CTX_DIR = ".shared-context";

export function copyCommand(cli: CAC) {
  cli
    .command("copy", "Write latest.md, latest.diff, latest.json to .shared-context/")
    .option("--json", "Output structured JSON instead of human text")
    .option("-t, --task <name>", "Optional task name to record in the snapshot")
    .action((opts) => {
      const cwd = process.cwd();
      const ctxDir = join(cwd, CTX_DIR);

      if (!existsSync(ctxDir)) {
        const msg = `.shared-context/ not found at ${cwd}. Run \`ctx init\` first.`;
        if (opts.json) {
          console.log(JSON.stringify({ ok: false, error: msg }));
        } else {
          console.error(msg);
        }
        process.exitCode = 1;
        return;
      }

      const task: string | undefined = opts.task || undefined;
      const result = writeContextSnapshot(ctxDir, { task });

      if (opts.json) {
        console.log(
          JSON.stringify(
            {
              ok: true,
              files: {
                markdown: result.mdPath,
                diff: result.diffPath,
                json: result.jsonPath,
              },
              generated_at: result.generated_at,
            },
            null,
            2,
          ),
        );
      } else {
        console.log("Wrote context snapshot:");
        console.log(`  ${result.mdPath}`);
        console.log(`  ${result.diffPath}`);
        console.log(`  ${result.jsonPath}`);
      }
    });
}
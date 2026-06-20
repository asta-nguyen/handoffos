import type { CAC } from "cac";
import { writeContextSnapshot } from "@handoff-os/core";
import { join } from "node:path";
import { existsSync } from "node:fs";

const CTX_DIR = ".shared-context";

export function copyCommand(cli: CAC) {
  cli
    .command("copy", "Write latest.md, latest.diff, latest.json to .shared-context/")
    .option("--json", "Output structured JSON instead of human text")
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

      const result = writeContextSnapshot(ctxDir);

      if (opts.json) {
        console.log(JSON.stringify({
          ok: true,
          files: {
            markdown: result.mdPath,
            diff: result.diffPath,
            json: result.jsonPath,
          },
          generated_at: new Date().toISOString(),
        }, null, 2));
      } else {
        console.log("Wrote context snapshot:");
        console.log(`  ${result.mdPath}`);
        console.log(`  ${result.diffPath}`);
        console.log(`  ${result.jsonPath}`);
      }
    });
}

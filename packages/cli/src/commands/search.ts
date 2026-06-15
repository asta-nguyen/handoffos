import type { CAC } from "cac";
import { searchMemories } from "@handoff-os/core";

export function searchCommand(cli: CAC) {
  cli
    .command("search <query>", "Search memories")
    .option("--type <type>", "Filter by memory type")
    .option("--status <status>", "Filter by status")
    .option("--task <task>", "Filter by task scope")
    .option("--limit <limit>", "Max results", { default: "20" })
    .action((query, opts) => {
      const results = searchMemories({
        query,
        type: opts.type as any,
        status: opts.status as any,
        scope: opts.task ? { task: opts.task } : undefined,
        limit: Number(opts.limit),
        offset: 0,
      });

      if (results.length === 0) {
        console.log("No memories found.");
        return;
      }

      console.log(`Found ${results.length} memories:\n`);
      for (const mem of results) {
        const statusIcon = mem.pinned ? "P" : mem.status === "stale" ? "S" : " ";
        console.log(`[${statusIcon}] ${mem.type.toUpperCase()} - ${mem.title}`);
        console.log(`  id: ${mem.id}`);
        console.log(`  scope: ${mem.scope.repo ?? "*"}/${mem.scope.branch ?? "*"}/${mem.scope.task ?? "*"}`);
        console.log(`  confidence: ${(mem.confidence * 100).toFixed(0)}%`);
        console.log("");
      }
    });
}
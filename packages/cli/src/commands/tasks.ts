import type { CAC } from "cac";
import { listOpenTasks } from "@handoff-os/core";

export function tasksCommand(cli: CAC) {
  cli
    .command("tasks", "List all open tasks")
    .action(() => {
      const tasks = listOpenTasks();
      if (tasks.length === 0) {
        console.log("No open tasks.");
        return;
      }

      console.log("Open tasks:\n");
      for (const t of tasks) {
        console.log(`  ${t.id}  ${t.title}`);
        console.log(`  branch: ${t.scope.branch ?? "*"}  repo: ${t.scope.repo ?? "*"}`);
        console.log("");
      }
    });
}
import type { CAC } from "cac";
import { pinMemory } from "@handoff-os/core";

export function pinCommand(cli: CAC) {
  cli
    .command("pin <memoryId>", "Pin an important memory")
    .action((memoryId) => {
      pinMemory(memoryId);
      console.log(`Memory ${memoryId} pinned.`);
    });
}
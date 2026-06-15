import type { CAC } from "cac";
import { invalidateMemory } from "@handoff-os/core";

export function invalidateCommand(cli: CAC) {
  cli
    .command("invalidate <memoryId>", "Mark a memory as invalid")
    .action((memoryId) => {
      invalidateMemory(memoryId);
      console.log(`Memory ${memoryId} invalidated.`);
    });
}
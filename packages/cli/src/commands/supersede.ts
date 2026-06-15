import type { CAC } from "cac";
import { supersedeMemory } from "@handoff-os/core";

export function supersedeCommand(cli: CAC) {
  cli
    .command("supersede <oldId>", "Replace an old memory with a new one")
    .option("--with <newId>", "ID of the new memory that supersedes")
    .action((oldId, opts) => {
      if (!opts.with) {
        console.error("Requires --with <newId>");
        process.exit(1);
      }
      supersedeMemory(oldId, opts.with);
      console.log(`Memory ${oldId} superseded by ${opts.with}`);
    });
}
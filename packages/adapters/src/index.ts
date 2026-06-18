import {
  generateResumePack,
  formatForAgent,
} from "@handoff-os/core";
import type { HandoffPack, AgentTarget } from "@handoff-os/shared";

/** Factory for typed agent adapters — eliminates 3 identical wrapper functions. */
function createAgentAdapter(target: AgentTarget): (task?: string) => string {
  return (task?: string): string => {
    const pack = generateResumePack({ task, target });
    return formatForAgent(pack, target);
  };
}

export const claudeAdapter = createAgentAdapter("claude");
export const codexAdapter = createAgentAdapter("codex");
export const opencodeAdapter = createAgentAdapter("opencode");

export function genericAdapter(task?: string): HandoffPack {
  return generateResumePack({ task, target: "generic" });
}

export function fileBasedAdapter(pack: HandoffPack): string {
  return [
    `# ${pack.title}`,
    "",
    `**Goal:** ${pack.goal}`,
    `**Branch:** ${pack.scope.branch ?? "N/A"}`,
    `**Task:** ${pack.scope.task ?? "N/A"}`,
    "",
    "## Files Touched",
    ...pack.files_touched.map((f) => `- ${f}`),
    "",
    "## Decisions",
    ...pack.decisions.map((d) => `- ${d.title}: ${d.content}`),
    "",
    "## Blockers",
    pack.blockers.length > 0
      ? pack.blockers.map((b) => `- ${b.title}: ${b.content}`)
      : ["- None"],
    "",
    "## Next Steps",
    ...pack.next_steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Generated: ${pack.generated_at}`,
  ].join("\n");
}

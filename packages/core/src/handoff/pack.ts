import type { HandoffPack, MemoryRecord, AgentTarget, HandoffFormatter } from "@handoff-os/shared";
import { listOpenTasks, searchMemories, getBranchContext } from "../memory/engine.js";
import { getCurrentBranch } from "../git/context.js";

export function generateResumePack(params: {
  task?: string;
  target: AgentTarget;
}): HandoffPack {
  const branchInfo = getCurrentBranch();
  const openTasks = listOpenTasks({
    repo: branchInfo.repo,
    branch: branchInfo.name,
  });

  const targetTask = params.task
    ? openTasks.find((t) => t.title === params.task || t.scope.task === params.task)
    : openTasks[0];

  const decisions = searchMemories({
    type: "decision",
    scope: { repo: branchInfo.repo, branch: branchInfo.name },
    limit: 10,
    offset: 0,
  });

  const blockers = searchMemories({
    type: "blocker",
    status: "active",
    scope: { repo: branchInfo.repo, branch: branchInfo.name },
    limit: 5,
    offset: 0,
  });

  const currentGoal = targetTask
    ? targetTask.title
    : `Work on ${branchInfo.name}`;

  const nextSteps = blockers.length > 0
    ? blockers.map((b) => `Resolve: ${b.title}`)
    : ["Review changed files and continue implementation."];

  if (targetTask) {
    nextSteps.unshift(`Continue: ${targetTask.title}`);
  }

  return {
    title: currentGoal,
    goal: targetTask ? targetTask.content : `Active work on branch ${branchInfo.name}`,
    scope: {
      workspace: "main",
      repo: branchInfo.repo,
      branch: branchInfo.name,
      task: params.task,
    },
    files_touched: branchInfo.changed_files,
    decisions: decisions.map((d) => ({ title: d.title, content: d.content })),
    blockers: blockers.map((b) => ({ title: b.title, content: b.content })),
    next_steps: nextSteps.slice(0, 5),
    generated_at: new Date().toISOString(),
    source_agent: "handoff-os",
    target_agent: params.target,
  };
}

export function formatForAgent(pack: HandoffPack, target: AgentTarget): string {
  switch (target) {
    case "claude":
      return formatClaude(pack);
    case "codex":
      return formatCodex(pack);
    case "opencode":
      return formatOpenCode(pack);
    default:
      return formatGeneric(pack);
  }
}

function formatClaude(pack: HandoffPack): string {
  return [
    `# Handoff: ${pack.title}`,
    "",
    "## Current goal",
    pack.goal,
    "",
    "## Scope",
    `- Repo: ${pack.scope.repo ?? "N/A"}`,
    `- Branch: ${pack.scope.branch ?? "N/A"}`,
    pack.scope.task ? `- Task: ${pack.scope.task}` : "",
    "",
    "## Files touched",
    ...pack.files_touched.map((f) => `- ${f}`),
    "",
    "## Decisions",
    ...pack.decisions.map((d) => `- **${d.title}**: ${d.content}`),
    "",
    "## Blockers",
    pack.blockers.length > 0
      ? pack.blockers.map((b) => `- **${b.title}**: ${b.content}`)
      : ["- None"],
    "",
    "## Next steps",
    ...pack.next_steps.map((s, i) => `${i + 1}. ${s}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCodex(pack: HandoffPack): string {
  return [
    `Resume: ${pack.title}`,
    `Goal: ${pack.goal}`,
    `Branch: ${pack.scope.branch}`,
    pack.files_touched.length > 0 ? `Files: ${pack.files_touched.join(", ")}` : "",
    pack.decisions.length > 0
      ? `Decisions: ${pack.decisions.map((d) => d.title).join("; ")}`
      : "",
    pack.blockers.length > 0
      ? `Blockers: ${pack.blockers.map((b) => b.title).join("; ")}`
      : "",
    pack.next_steps.length > 0 ? `Next: ${pack.next_steps.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatOpenCode(pack: HandoffPack): string {
  return [
    `[HANDOFF] ${pack.title}`,
    `goal: ${pack.goal}`,
    `branch: ${pack.scope.branch}`,
    pack.files_touched.length > 0 ? `files: [${pack.files_touched.join(", ")}]` : "",
    pack.decisions.length > 0
      ? `decisions: [${pack.decisions.map((d) => d.title).join(", ")}]`
      : "",
    pack.blockers.length > 0
      ? `blockers: [${pack.blockers.map((b) => b.title).join(", ")}]`
      : "",
    pack.next_steps.length > 0 ? `actions: [${pack.next_steps.join(", ")}]` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatGeneric(pack: HandoffPack): string {
  return JSON.stringify(pack, null, 2);
}
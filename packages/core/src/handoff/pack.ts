import type { HandoffPack, MemoryRecord, AgentTarget } from "@handoff-os/shared";
import { searchMemories } from "../memory/engine.js";
import { getBranchInfoSafely } from "../git/context.js";
import { getDb, handoffLogs } from "../db/connection.js";
import { nanoid } from "../utils/nanoid.js";

export function generateResumePack(params: {
  task?: string;
  target: AgentTarget;
}): HandoffPack {
  const branchInfo = getBranchInfoSafely();
  if (!branchInfo) {
    throw new Error("Not in a git repository. Run from a git-tracked project to generate a resume pack.");
  }

  // Single scoped query replaces 4 separate calls
  const results = searchMemories({
    scope: { repo: branchInfo.repo, branch: branchInfo.name },
    status: "active",
    limit: 5,
    offset: 0,
  });

  const targetTask: MemoryRecord | undefined = params.task
    ? results.find((m) => m.type === "task" && (m.title === params.task || m.scope.task === params.task))
    : results.find((m) => m.type === "task");
  const decisions = results.filter((m) => m.type === "decision");
  const blockers = results.filter((m) => m.type === "blocker");

  const currentGoal = targetTask
    ? targetTask.title
    : `Work on ${branchInfo.name}`;

  const nextSteps = blockers.length > 0
    ? blockers.map((b) => `Resolve: ${b.title}`)
    : ["Review changed files and continue implementation."];

  if (targetTask) {
    nextSteps.unshift(`Continue: ${targetTask.title}`);
  }

  const pack: HandoffPack = {
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

  // Log the handoff so the audit trail is queryable
  try {
    getDb()
      .insert(handoffLogs)
      .values({
        id: `hl_${nanoid()}`,
        from_agent: "handoff-os",
        to_agent: params.target,
        task: params.task ?? targetTask?.title,
        pack_json: JSON.stringify(pack),
        created_at: pack.generated_at,
      })
      .run();
  } catch {
    // DB not initialized — skip logging (handoff still works)
  }

  return pack;
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
  const lines: (string | null)[] = [
    `# Handoff: ${pack.title}`,
    "",
    "## Current goal",
    pack.goal,
    "",
    "## Scope",
    `- Repo: ${pack.scope.repo ?? "N/A"}`,
    `- Branch: ${pack.scope.branch ?? "N/A"}`,
    pack.scope.task ? `- Task: ${pack.scope.task}` : null,
    "",
  ];

  if (pack.files_touched.length > 0) {
    lines.push("## Files touched");
    for (const f of pack.files_touched) lines.push(`- ${f}`);
    lines.push("");
  }

  if (pack.decisions.length > 0) {
    lines.push("## Decisions");
    for (const d of pack.decisions) {
      lines.push(`- **${d.title}**: ${d.content}`);
    }
    lines.push("");
  }

  if (pack.blockers.length > 0) {
    lines.push("## Blockers");
    for (const b of pack.blockers) {
      lines.push(`- **${b.title}**: ${b.content}`);
    }
    lines.push("");
  }

  lines.push("## Next steps");
  for (let i = 0; i < pack.next_steps.length; i++) {
    lines.push(`${i + 1}. ${pack.next_steps[i]!}`);
  }
  lines.push("");

  return lines.filter((l) => l !== null).join("\n");
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
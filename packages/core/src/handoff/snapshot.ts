import { getGitContext } from "../git/context.js";
import { searchMemories, listOpenTasks } from "../memory/engine.js";
import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

function hasTitlePrefix(title: string, prefix: string): boolean {
  return title.toLowerCase().startsWith(prefix.toLowerCase());
}

export interface SnapshotData {
  goal: string;
  branch: string;
  repo: string;
  agent: string;
  task?: string;
  done: string[];
  in_progress: string[];
  will_do: string[];
  changes: string[];
  removed: string[];
  decisions: { title: string; content: string }[];
  blockers: { title: string; content: string }[];
  next_steps: string[];
  generated_at: string;
}

export function generateSnapshotData(opts?: { task?: string }): SnapshotData {
  const git = getGitContext();

  const openTasks = listOpenTasks({ repo: git.repo_name, branch: git.branch });
  const decisions = searchMemories({
    type: "decision",
    scope: { repo: git.repo_name, branch: git.branch },
    limit: 5,
    offset: 0,
  });
  const blockers = searchMemories({
    type: "blocker",
    status: "active",
    scope: { repo: git.repo_name, branch: git.branch },
    limit: 10,
    offset: 0,
  });

  // Tasks are categorized by title prefix convention
  const done = openTasks
    .filter((t) => hasTitlePrefix(t.title, "[done]"))
    .map((t) => t.title.replace(/^\[done\]\s*/i, ""));

  const willDo = openTasks
    .filter((t) => hasTitlePrefix(t.title, "[todo]"))
    .map((t) => t.title.replace(/^\[todo\]\s*/i, ""));

  const inProgress = openTasks
    .filter((t) => !hasTitlePrefix(t.title, "[done]") && !hasTitlePrefix(t.title, "[todo]"))
    .map((t) => t.title);

  const changes = git.changed_files.length > 0
    ? [`${git.changed_files.length} files changed`].concat(
        git.changed_files.map((f) => `- ${f}`),
      )
    : ["No uncommitted changes."];

  const removed: string[] = [];
  for (const file of git.changed_files) {
    const status = execFileSync("git", ["diff", "--name-status", "HEAD", "--", file], {
      encoding: "utf-8",
    }).trim();
    if (status.startsWith("D")) {
      removed.push(`- \`${file}\` — deleted`);
    } else if (status.startsWith("R")) {
      const parts = status.split("\t");
      if (parts.length >= 3) {
        removed.push(`- \`${parts[1]}\` → \`${parts[2]}\` — renamed`);
      }
    }
  }

  const nextSteps = openTasks.length > 0
    ? openTasks.filter((t) => !hasTitlePrefix(t.title, "[done]")).map((t) => t.title.replace(/^\[todo\]\s*/i, ""))
    : ["Review changed files and continue implementation."];

  return {
    goal: opts?.task
      ? opts.task
      : git.recent_commits[0]?.message ?? "No recent commits.",
    branch: git.branch,
    repo: git.repo_name,
    agent: "handoff-os",
    task: opts?.task,
    done,
    in_progress: inProgress,
    will_do: willDo,
    changes,
    removed,
    decisions: decisions.map((d) => ({ title: d.title, content: d.content })),
    blockers: blockers.map((b) => ({ title: b.title, content: b.content })),
    next_steps: nextSteps.slice(0, 5),
    generated_at: new Date().toISOString(),
  };
}

export function formatSnapshotMarkdown(snapshot: SnapshotData): string {
  const lines: string[] = [
    `# Handoff: ${snapshot.goal}`,
    `Branch: ${snapshot.branch} | Repo: ${snapshot.repo}`,
    "",
  ];

  const active = snapshot.in_progress.length > 0
    ? snapshot.in_progress.join(", ")
    : snapshot.will_do.length > 0
      ? snapshot.will_do[0]!
      : snapshot.next_steps[0]!;
  lines.push(`**Current:** ${active}`);
  lines.push("");

  const files = snapshot.changes.slice(1, 6);
  if (files.length > 0) {
    lines.push("### Files changed");
    for (const f of files) lines.push(f);
    lines.push("");
  }

  if (snapshot.blockers.length > 0) {
    lines.push("### Blockers");
    for (const b of snapshot.blockers) {
      lines.push(`- ${b.title}: ${b.content}`);
    }
    lines.push("");
  }

  if (snapshot.removed.length > 0) {
    lines.push("### 🗑️ Removed");
    for (const r of snapshot.removed) {
      lines.push(r);
    }
    lines.push("");
  }

  lines.push("### Next");
  for (let i = 0; i < snapshot.next_steps.length; i++) {
    lines.push(`${i + 1}. ${snapshot.next_steps[i]!}`);
  }
  lines.push("");

  return lines.join("\n");
}

export function formatSnapshotJson(snapshot: SnapshotData): string {
  return JSON.stringify(snapshot, null, 2);
}

export function getGitDiff(): string {
  try {
    const diff = execSync("git diff HEAD", { encoding: "utf-8" });
    return diff || "No uncommitted changes.";
  } catch {
    return "Unable to read git diff (not a git repository?).";
  }
}

export function writeContextSnapshot(
  ctxDir: string,
  opts?: { task?: string },
): {
  mdPath: string;
  diffPath: string;
  jsonPath: string;
  generated_at: string;
} {
  mkdirSync(ctxDir, { recursive: true });

  const snapshot = generateSnapshotData(opts);
  const md = formatSnapshotMarkdown(snapshot);
  const diff = getGitDiff();
  const json = formatSnapshotJson(snapshot);

  const mdPath = `${ctxDir}/latest.md`;
  const diffPath = `${ctxDir}/latest.diff`;
  const jsonPath = `${ctxDir}/latest.json`;

  writeFileSync(mdPath, md);
  writeFileSync(diffPath, diff);
  writeFileSync(jsonPath, json);

  return { mdPath, diffPath, jsonPath, generated_at: snapshot.generated_at };
}

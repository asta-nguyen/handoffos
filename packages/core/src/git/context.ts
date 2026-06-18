import type { BranchInfo } from "../scope/resolve.js";
import { execSync } from "node:child_process";
import { basename } from "node:path";

export interface GitContext {
  branch: string;
  repo_name: string;
  changed_files: string[];
  recent_commits: CommitSummary[];
}

export interface CommitSummary {
  hash: string;
  message: string;
  author: string;
  date: string;
}

function getToplevel(): string {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
}

export function getGitContext(): GitContext {
  const branch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  const repoName = basename(getToplevel());
  const changedFiles = execSync("git diff --name-only HEAD", { encoding: "utf-8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  const log = execSync(
    'git log --oneline --format="%h||%s||%an||%aI" -5',
    { encoding: "utf-8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, message, author, date] = line.split("||");
      return { hash: hash!, message: message!, author: author!, date: date! };
    });

  return {
    branch,
    repo_name: repoName,
    changed_files: changedFiles,
    recent_commits: log,
  };
}

export function getCurrentBranch(): BranchInfo {
  const branch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
  const repo = basename(getToplevel());
  const files = execSync("git diff --name-only HEAD", { encoding: "utf-8" })
    .trim()
    .split("\n")
    .filter(Boolean);

  return {
    name: branch,
    repo,
    changed_files: files,
  };
}

/** Safe variant — returns null instead of throwing when outside a git repo. */
export function getBranchInfoSafely(): BranchInfo | null {
  try {
    return getCurrentBranch();
  } catch {
    return null;
  }
}
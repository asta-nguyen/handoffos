export interface BranchInfo {
  name: string;
  repo: string;
  changed_files: string[];
}

export interface ScopeContext {
  workspace: string;
  repo?: string;
  branch?: string;
  task?: string;
}

export function resolveScope(overrides?: Partial<ScopeContext>): ScopeContext {
  return {
    workspace: overrides?.workspace ?? "main",
    repo: overrides?.repo,
    branch: overrides?.branch,
    task: overrides?.task,
  };
}
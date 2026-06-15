import { z } from "zod";

export const MemoryType = z.enum([
  "fact",
  "decision",
  "task",
  "blocker",
  "summary",
  "repo_map",
  "assumption",
]);
export type MemoryType = z.infer<typeof MemoryType>;

export const MemoryStatus = z.enum([
  "active",
  "stale",
  "superseded",
  "invalidated",
  "archived",
]);
export type MemoryStatus = z.infer<typeof MemoryStatus>;

export const MemoryScope = z.object({
  workspace: z.string().default("main"),
  repo: z.string().optional(),
  branch: z.string().optional(),
  task: z.string().optional(),
});
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemorySource = z.object({
  kind: z.enum(["session_commit", "manual", "git_hook", "import"]),
  agent: z.string(),
  session_id: z.string().optional(),
});
export type MemorySource = z.infer<typeof MemorySource>;

export const MemoryRecord = z.object({
  id: z.string(),
  type: MemoryType,
  title: z.string(),
  content: z.string(),
  scope: MemoryScope,
  tags: z.array(z.string()).default([]),
  source: MemorySource,
  confidence: z.number().min(0).max(1).default(0.5),
  status: MemoryStatus.default("active"),
  pinned: z.boolean().default(false),
  supersedes: z.string().optional(),
  superseded_by: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MemoryRecord = z.infer<typeof MemoryRecord>;

export const CreateMemoryInput = MemoryRecord.pick({
  type: true,
  title: true,
  content: true,
  scope: true,
  tags: true,
  source: true,
  confidence: true,
  pinned: true,
  supersedes: true,
}).partial({ tags: true, confidence: true, pinned: true, supersedes: true });
export type CreateMemoryInput = z.infer<typeof CreateMemoryInput>;

export const SearchQuery = z.object({
  query: z.string().optional(),
  type: MemoryType.optional(),
  status: MemoryStatus.optional(),
  scope: MemoryScope.partial().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const RankingScore = z.object({
  memory_id: z.string(),
  scope_match: z.number(),
  semantic_similarity: z.number(),
  recency: z.number(),
  confidence: z.number(),
  pinned_boost: z.number(),
  stale_penalty: z.number(),
  final_score: z.number(),
});
export type RankingScore = z.infer<typeof RankingScore>;

export const HandoffPack = z.object({
  title: z.string(),
  goal: z.string(),
  scope: MemoryScope,
  files_touched: z.array(z.string()),
  decisions: z.array(z.object({ title: z.string(), content: z.string() })),
  blockers: z.array(z.object({ title: z.string(), content: z.string() })),
  next_steps: z.array(z.string()),
  generated_at: z.string(),
  source_agent: z.string(),
  target_agent: z.string(),
});
export type HandoffPack = z.infer<typeof HandoffPack>;

export const WorkspaceConfig = z.object({
  version: z.literal("0.1.0"),
  workspace: z.string().default("main"),
  embedding_provider: z.enum(["local", "openai", "none"]).default("none"),
  ignore_paths: z.array(z.string()).default([]),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfig>;

export type AgentTarget = "claude" | "codex" | "opencode" | "generic";

export interface HandoffFormatter {
  format(pack: HandoffPack): string;
}

export const RANKING_WEIGHTS = {
  scope_match: 0.35,
  semantic_similarity: 0.25,
  recency: 0.15,
  confidence: 0.1,
  pinned_boost: 0.1,
  stale_penalty: 0.15,
} as const;

export function calculateRanking(input: {
  scope_match: number;
  semantic_similarity: number;
  recency: number;
  confidence: number;
  pinned: boolean;
  is_stale: boolean;
}): number {
  const { scope_match, semantic_similarity, recency, confidence, pinned, is_stale } = input;
  return (
    scope_match * RANKING_WEIGHTS.scope_match +
    semantic_similarity * RANKING_WEIGHTS.semantic_similarity +
    recency * RANKING_WEIGHTS.recency +
    confidence * RANKING_WEIGHTS.confidence +
    (pinned ? 1 : 0) * RANKING_WEIGHTS.pinned_boost -
    (is_stale ? 1 : 0) * RANKING_WEIGHTS.stale_penalty
  );
}
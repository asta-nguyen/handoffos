import type { MemoryRecord, MemoryStatus } from "@handoff-os/shared";
import { getDb, memories } from "../db/connection.js";
import { eq } from "drizzle-orm";
import { getCurrentBranch } from "../git/context.js";

export function pinMemory(id: string): void {
  getDb().update(memories).set({ pinned: true }).where(eq(memories.id, id)).run();
}

export function invalidateMemory(id: string): void {
  const now = new Date().toISOString();
  getDb()
    .update(memories)
    .set({ status: "invalidated" as MemoryStatus, updated_at: now })
    .where(eq(memories.id, id))
    .run();
}

export function supersedeMemory(oldId: string, newId: string): void {
  getDb()
    .update(memories)
    .set({ status: "superseded" as MemoryStatus, superseded_by: newId, updated_at: new Date().toISOString() })
    .where(eq(memories.id, oldId))
    .run();
}

export function detectStaleMemories(repo?: string, branch?: string): MemoryRecord[] {
  if (!repo || !branch) {
    try {
      const ctx = getCurrentBranch();
      repo = repo ?? ctx.repo;
      branch = branch ?? ctx.name;
    } catch {
      return [];
    }
  }

  const stale = getDb()
    .select()
    .from(memories)
    .where(eq(memories.branch, branch!))
    .all()
    .filter((r) => r.status === "active" && isStaleByAge(r.created_at));

  for (const record of stale) {
    getDb()
      .update(memories)
      .set({ status: "stale" as MemoryStatus, updated_at: new Date().toISOString() })
      .where(eq(memories.id, record.id))
      .run();
  }

  return stale.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    content: r.content,
    scope: { workspace: r.workspace, repo: r.repo ?? undefined, branch: r.branch ?? undefined, task: r.task ?? undefined },
    tags: r.tags ?? [],
    source: { kind: r.source_kind as any, agent: r.source_agent, session_id: r.source_session_id ?? undefined },
    confidence: r.confidence,
    status: "stale" as MemoryStatus,
    pinned: r.pinned,
    created_at: r.created_at,
    updated_at: new Date().toISOString(),
  }));
}

function isStaleByAge(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const days = (now - created) / (1000 * 60 * 60 * 24);
  return days > 7;
}
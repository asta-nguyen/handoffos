import { getDb, memories, sessions } from "../db/connection.js";
import type { CreateMemoryInput, MemoryRecord, MemoryScope, MemoryStatus } from "@handoff-os/shared";
import { calculateRanking, SearchQuery } from "@handoff-os/shared";
import { eq, and, like, or, sql } from "drizzle-orm";
import { nanoid } from "../utils/nanoid.js";

export function createMemory(input: CreateMemoryInput): MemoryRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `mem_${nanoid()}`;

  // Dedup: skip insert if active memory with same title+repo+branch+type exists
  if (input.scope.repo && input.scope.branch) {
    const existing = db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.title, input.title),
          eq(memories.repo, input.scope.repo),
          eq(memories.branch, input.scope.branch),
          eq(memories.type, input.type),
          eq(memories.status, "active"),
        ),
      )
      .get();
    if (existing) {
      if (input.supersedes) {
        updateMemoryStatus(input.supersedes, "superseded", existing.id);
      }
      return rowToRecord(existing);
    }
  }

  const record: MemoryRecord = {
    id,
    type: input.type,
    title: input.title,
    content: input.content,
    scope: {
      workspace: input.scope.workspace ?? "main",
      repo: input.scope.repo,
      branch: input.scope.branch,
      task: input.scope.task,
    },
    tags: input.tags ?? [],
    source: input.source,
    confidence: input.confidence ?? 0.5,
    status: "active",
    pinned: input.pinned ?? false,
    supersedes: input.supersedes,
    created_at: now,
    updated_at: now,
  };

  db.insert(memories).values({
    id: record.id,
    type: record.type,
    title: record.title,
    content: record.content,
    workspace: record.scope.workspace,
    repo: record.scope.repo ?? null,
    branch: record.scope.branch ?? null,
    task: record.scope.task ?? null,
    tags: record.tags,
    source_kind: record.source.kind,
    source_agent: record.source.agent,
    source_session_id: record.source.session_id ?? null,
    confidence: record.confidence,
    status: record.status,
    pinned: record.pinned,
    supersedes: record.supersedes ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }).run();

  if (input.supersedes) {
    updateMemoryStatus(input.supersedes, "superseded", id);
  }

  return record;
}

export function updateMemoryStatus(
  id: string,
  status: MemoryStatus,
  supersededById?: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status,
    updated_at: now,
  };
  if (status === "superseded" && supersededById) {
    update.superseded_by = supersededById;
  }
  db.update(memories).set(update).where(eq(memories.id, id)).run();
}

export function getMemory(id: string): MemoryRecord | undefined {
  const db = getDb();
  const row = db.select().from(memories).where(eq(memories.id, id)).get();
  return row ? rowToRecord(row) : undefined;
}

export function searchMemories(query: SearchQuery): MemoryRecord[] {
  const db = getDb();
  // Validate through zod to apply defaults (limit, offset)
  const validated = SearchQuery.safeParse(query);
  if (!validated.success) {
    throw new Error(`Invalid search query: ${validated.error.message}`);
  }
  query = validated.data;
  const conditions = [];

  if (query.scope?.workspace) {
    conditions.push(eq(memories.workspace, query.scope.workspace));
  }
  if (query.scope?.repo) {
    conditions.push(eq(memories.repo, query.scope.repo));
  }
  if (query.scope?.branch) {
    conditions.push(eq(memories.branch, query.scope.branch));
  }
  if (query.scope?.task) {
    conditions.push(eq(memories.task, query.scope.task));
  }
  if (query.type) {
    conditions.push(eq(memories.type, query.type));
  }
  if (query.status) {
    conditions.push(eq(memories.status, query.status));
  }
  if (query.query) {
    conditions.push(
      or(
        like(memories.title, `%${query.query}%`),
        like(memories.content, `%${query.query}%`),
      )!,
    );
  }

  const query_builder = db.select().from(memories);
  const filtered = conditions.length > 0
    ? query_builder.where(and(...conditions))
    : query_builder;
  const rows = filtered.all();

  const records = rows.map(rowToRecord);

  const now = Date.now();
  const scored = records.map((r) => ({
    record: r,
    score: calculateRanking({
      scope_match: computeScopeMatch(r.scope, query.scope),
      semantic_similarity: query.query ? textMatchScore(r, query.query) : 0,
      recency: recencyScore(r.created_at, now),
      confidence: r.confidence,
      pinned: r.pinned,
      is_stale: r.status === "stale",
    }),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(query.offset, query.offset + query.limit).map((s) => s.record);
}

export function listOpenTasks(scope?: Partial<MemoryScope>): MemoryRecord[] {
  const db = getDb();
  const conditions = [
    eq(memories.type, "task"),
    eq(memories.status, "active"),
  ];

  if (scope?.workspace) conditions.push(eq(memories.workspace, scope.workspace));
  if (scope?.repo) conditions.push(eq(memories.repo, scope.repo));
  if (scope?.branch) conditions.push(eq(memories.branch, scope.branch));
  if (scope?.task) conditions.push(eq(memories.task, scope.task));

  return db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(sql`updated_at DESC`)
    .limit(10)
    .all()
    .map(rowToRecord);
}

export function getBranchContext(branch: string, repo?: string): MemoryRecord[] {
  const db = getDb();
  const conditions = [
    eq(memories.branch, branch),
    or(eq(memories.status, "active"), eq(memories.status, "stale")),
  ];
  if (repo) conditions.push(eq(memories.repo, repo));

  return db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(sql`updated_at DESC`)
    .limit(5)
    .all()
    .map(rowToRecord);
}

export function createSession(input: {
  agent: string;
  summary: string;
  repo?: string;
  branch?: string;
  task?: string;
  files_touched?: string[];
}): { id: string } {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `ses_${nanoid()}`;

  db.insert(sessions)
    .values({
      id,
      agent: input.agent,
      workspace: "main",
      repo: input.repo ?? null,
      branch: input.branch ?? null,
      task: input.task ?? null,
      summary: input.summary,
      files_touched: input.files_touched ?? [],
      created_at: now,
      updated_at: now,
    })
    .run();

  return { id };
}

function rowToRecord(row: any): MemoryRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    scope: {
      workspace: row.workspace,
      repo: row.repo ?? undefined,
      branch: row.branch ?? undefined,
      task: row.task ?? undefined,
    },
    tags: row.tags ?? [],
    source: {
      kind: row.source_kind,
      agent: row.source_agent,
      session_id: row.source_session_id ?? undefined,
    },
    confidence: row.confidence,
    status: row.status,
    pinned: row.pinned,
    supersedes: row.supersedes ?? undefined,
    superseded_by: row.superseded_by ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function computeScopeMatch(
  memScope: MemoryScope,
  queryScope?: Partial<MemoryScope>,
): number {
  if (!queryScope) return 0.5;
  let matches = 0;
  let total = 0;
  if (queryScope.workspace) {
    total++;
    if (memScope.workspace === queryScope.workspace) matches++;
  }
  if (queryScope.repo) {
    total++;
    if (memScope.repo === queryScope.repo) matches++;
  }
  if (queryScope.branch) {
    total++;
    if (memScope.branch === queryScope.branch) matches++;
  }
  if (queryScope.task) {
    total++;
    if (memScope.task === queryScope.task) matches++;
  }
  return total > 0 ? matches / total : 1;
}

function textMatchScore(memory: MemoryRecord, query: string): number {
  const q = query.toLowerCase();
  const titleMatch = memory.title.toLowerCase().includes(q) ? 0.7 : 0;
  const contentMatch = memory.content.toLowerCase().includes(q) ? 0.3 : 0;
  return titleMatch + contentMatch;
}

function recencyScore(createdAt: string, now: number): number {
  const created = new Date(createdAt).getTime();
  const ageHours = (now - created) / (1000 * 60 * 60);
  return Math.max(0, 1 - ageHours / (24 * 30));
}
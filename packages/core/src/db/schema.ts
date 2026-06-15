import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  type: text("type", {
    enum: ["fact", "decision", "task", "blocker", "summary", "repo_map", "assumption"],
  }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  workspace: text("workspace").notNull().default("main"),
  repo: text("repo"),
  branch: text("branch"),
  task: text("task"),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  source_kind: text("source_kind", {
    enum: ["session_commit", "manual", "git_hook", "import"],
  }).notNull(),
  source_agent: text("source_agent").notNull(),
  source_session_id: text("source_session_id"),
  confidence: real("confidence").notNull().default(0.5),
  status: text("status", {
    enum: ["active", "stale", "superseded", "invalidated", "archived"],
  })
    .notNull()
    .default("active"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  supersedes: text("supersedes"),
  superseded_by: text("superseded_by"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  agent: text("agent").notNull(),
  workspace: text("workspace").notNull().default("main"),
  repo: text("repo"),
  branch: text("branch"),
  task: text("task"),
  summary: text("summary"),
  files_touched: text("files_touched", { mode: "json" }).$type<string[]>().default([]),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const handoffLogs = sqliteTable("handoff_logs", {
  id: text("id").primaryKey(),
  from_agent: text("from_agent").notNull(),
  to_agent: text("to_agent").notNull(),
  task: text("task"),
  pack_json: text("pack_json").notNull(),
  created_at: text("created_at").notNull(),
});
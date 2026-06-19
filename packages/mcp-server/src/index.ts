import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createMemory,
  createSession,
  searchMemories,
  listOpenTasks,
  getBranchContext,
  generateResumePack,
  formatForAgent,
  pinMemory,
  invalidateMemory,
  supersedeMemory,
  detectStaleMemories,
  getBranchInfoSafely,
} from "@handoff-os/core";

export async function createMcpServer(dbPath: string) {
  const { createConnection } = await import("@handoff-os/core");
  createConnection(dbPath);

  const server = new McpServer({
    name: "handoff-os",
    version: "0.1.0",
  });

  server.tool(
    "save_memory",
    "Save a new memory with type, title, content, and scope",
    {
      type: z.enum(["fact", "decision", "task", "blocker", "summary", "repo_map", "assumption"]),
      title: z.string(),
      content: z.string(),
      task: z.string().optional(),
      tags: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1).optional(),
      pinned: z.boolean().optional(),
    },
    async (input) => {
      const branchInfo = getBranchInfoSafely();
      if (!branchInfo) {
        throw new Error("Not in a git repository");
      }

      const mem = createMemory({
        type: input.type,
        title: input.title,
        content: input.content,
        scope: {
          workspace: "main",
          repo: branchInfo.repo,
          branch: branchInfo.name,
          task: input.task,
        },
        tags: input.tags,
        confidence: input.confidence,
        pinned: input.pinned,
        source: { kind: "manual", agent: "mcp" },
      });

      return {
        content: [{ type: "text" as const, text: `Saved: ${mem.id} — ${mem.title}` }],
      };
    },
  );

  server.tool(
    "search_memory",
    "Search memories by query, type, status, and scope",
    {
      query: z.string().optional(),
      type: z.enum(["fact", "decision", "task", "blocker", "summary", "repo_map", "assumption"]).optional(),
      status: z.enum(["active", "stale", "superseded", "invalidated", "archived"]).optional(),
      task: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    },
    async (input) => {
      const branchInfo = getBranchInfoSafely();
      if (branchInfo) {
        detectStaleMemories(branchInfo.repo, branchInfo.name);
      }

      const scope: Record<string, string> = {};
      if (branchInfo) {
        scope.repo = branchInfo.repo;
        scope.branch = branchInfo.name;
      }
      if (input.task) scope.task = input.task;

      const results = searchMemories({
        query: input.query,
        type: input.type,
        status: input.status ?? "active",
        scope: Object.keys(scope).length > 0 ? scope : undefined,
        limit: input.limit,
        offset: 0,
      });

      const trimmed = results.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        content: r.content,
        confidence: r.confidence,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(trimmed, null, 2) }],
      };
    },
  );

  server.tool(
    "get_resume_pack",
    "Generate a resume/handoff pack for context transfer to another agent",
    {
      task: z.string().optional(),
      target: z.enum(["claude", "codex", "opencode", "generic"]).default("generic"),
    },
    async (input) => {
      const branchInfo = getBranchInfoSafely();
      if (!branchInfo) {
        throw new Error("Not in a git repository. Run from a git-tracked project to generate a resume pack.");
      }
      detectStaleMemories(branchInfo.repo, branchInfo.name);

      const pack = generateResumePack({
        task: input.task,
        target: input.target,
      });
      const formatted = formatForAgent(pack, input.target);

      return {
        content: [{ type: "text" as const, text: formatted }],
      };
    },
  );

  server.tool(
    "pin_memory",
    "Pin an important memory so it's prioritized in retrieval",
    { memory_id: z.string() },
    async (input) => {
      pinMemory(input.memory_id);
      return {
        content: [{ type: "text" as const, text: `Memory ${input.memory_id} pinned.` }],
      };
    },
  );

  server.tool(
    "invalidate_memory",
    "Mark a memory as invalid/incorrect",
    { memory_id: z.string() },
    async (input) => {
      invalidateMemory(input.memory_id);
      return {
        content: [{ type: "text" as const, text: `Memory ${input.memory_id} invalidated.` }],
      };
    },
  );

  server.tool(
    "supersede_memory",
    "Replace an old memory with a new one",
    { old_id: z.string(), new_id: z.string() },
    async (input) => {
      supersedeMemory(input.old_id, input.new_id);
      return {
        content: [{ type: "text" as const, text: `Memory ${input.old_id} superseded by ${input.new_id}.` }],
      };
    },
  );

  server.tool(
    "list_open_tasks",
    "List all open (active/stale) tasks with optional scope filtering",
    {
      task: z.string().optional(),
    },
    async (input) => {
      const branchInfo = getBranchInfoSafely();

      const tasks = listOpenTasks(
        branchInfo
          ? { repo: branchInfo.repo, branch: branchInfo.name, task: input.task }
          : undefined,
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
      };
    },
  );

  server.tool(
    "get_branch_context",
    "Get the memory snapshot for the current branch",
    {},
    async () => {
      const branchInfo = getBranchInfoSafely();
      if (!branchInfo) {
        throw new Error("Not in a git repository.");
      }
      detectStaleMemories(branchInfo.repo, branchInfo.name);
      const context = getBranchContext(branchInfo.name, branchInfo.repo);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                branch: branchInfo.name,
                repo: branchInfo.repo,
                changed_files: branchInfo.changed_files,
                memories: context,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "copy_context",
    "Generate context snapshot files (.shared-context/latest.md, latest.diff, latest.json) for agent handoff",
    {
      task: z.string().optional(),
    },
    async (input) => {
      const { writeContextSnapshot } = await import("@handoff-os/core");
      const ctxDir = `${process.cwd()}/.shared-context`;
      const result = writeContextSnapshot(ctxDir);
      return {
        content: [
          {
            type: "text" as const,
            text: `Context snapshot written:\n- ${result.mdPath}\n- ${result.diffPath}\n- ${result.jsonPath}`,
          },
        ],
      };
    },
  );

  server.tool(
    "commit_session",
    "Save a session summary to the memory database after completing work",
    {
      summary: z.string(),
      task: z.string().optional(),
      files_touched: z.array(z.string()).optional(),
    },
    async (input) => {
      const branchInfo = getBranchInfoSafely();
      if (!branchInfo) {
        throw new Error("Not in a git repository. Run from a git-tracked project to commit a session.");
      }

      const result = createSession({
        agent: "mcp",
        summary: input.summary,
        repo: branchInfo.repo,
        branch: branchInfo.name,
        task: input.task,
        files_touched: input.files_touched ?? branchInfo.changed_files,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Session committed: ${result.id}`,
          },
        ],
      };
    },
  );

  server.tool(
    "run_hygiene",
    "Detect and mark stale memories (older than 7 days) so ranking penalizes them",
    {},
    async () => {
      const branchInfo = getBranchInfoSafely();
      if (!branchInfo) {
        throw new Error("Not in a git repository.");
      }
      const stale = detectStaleMemories(branchInfo.repo, branchInfo.name);
      return {
        content: [
          {
            type: "text" as const,
            text: stale.length > 0
              ? `Marked ${stale.length} memory(ies) as stale:\n${stale.map((m) => `- ${m.title} (${m.type})`).join("\n")}`
              : "No stale memories found.",
          },
        ],
      };
    },
  );

  return server;
}

export async function startMcpServer(dbPath: string) {
  const server = await createMcpServer(dbPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
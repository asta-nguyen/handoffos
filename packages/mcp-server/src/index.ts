import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  createMemory,
  searchMemories,
  listOpenTasks,
  getBranchContext,
  generateResumePack,
  formatForAgent,
  pinMemory,
  invalidateMemory,
  supersedeMemory,
  getCurrentBranch,
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
      let branchInfo;
      try {
        branchInfo = getCurrentBranch();
      } catch {
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
        content: [{ type: "text" as const, text: JSON.stringify(mem, null, 2) }],
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
      const results = searchMemories({
        query: input.query,
        type: input.type,
        status: input.status,
        scope: input.task ? { task: input.task } : undefined,
        limit: input.limit,
        offset: 0,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
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
      let branchInfo;
      try {
        branchInfo = getCurrentBranch();
      } catch {
        branchInfo = null;
      }

      const tasks = listOpenTasks(
        branchInfo
          ? { repo: branchInfo.repo, branch: branchInfo.name }
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
      const branchInfo = getCurrentBranch();
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

  return server;
}

export async function startMcpServer(dbPath: string) {
  const server = await createMcpServer(dbPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}